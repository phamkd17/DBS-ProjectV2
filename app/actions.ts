"use server";

/**
 * Every write in the app goes through here. Each action:
 *  1. requires a signed-in Clerk user,
 *  2. talks to Supabase *as that user* (so RLS decides access), and
 *  3. calls Gemini only from the server (the key never reaches the phone).
 */
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftRecipe, finalizeRecipe, ModelError, RateLimitError } from "@/lib/ai/pipeline";
import type { Answer, AnswerSource } from "@/lib/ai/schema";
import { supabaseForUser } from "@/lib/supabase/server";
import {
  isStage,
  toQuestion,
  type ActionState,
  type DictationRow,
  type QuestionRow,
  type RecipeRow,
} from "@/lib/types";

const MAX_TRANSCRIPT = 20000;

async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

function friendlyModelError(err: unknown): string {
  if (err instanceof RateLimitError) return err.message;
  if (err instanceof ModelError) {
    console.error("[model]", err.message, err.detail ?? "");
    return "The recipe helper couldn't finish. Your words are saved. Try again in a minute.";
  }
  console.error("[unexpected]", err);
  return "Something went wrong. Your words are saved. Try again.";
}

// ---------------------------------------------------------------------------
// 1. Capture: save the dictation verbatim. Asks nothing else.
// ---------------------------------------------------------------------------
export async function createDictation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  // Keep her words exactly as typed: no trimming inside, no "cleanup".
  const transcript = String(formData.get("transcript") ?? "");
  const dish_name = String(formData.get("dish_name") ?? "").trim().slice(0, 120) || null;
  const cook_name = String(formData.get("cook_name") ?? "").trim().slice(0, 60) || null;
  const values = { transcript, dish_name: dish_name ?? "", cook_name: cook_name ?? "" };

  if (!transcript.trim()) {
    return { values, fieldErrors: { transcript: "Type, paste, or dictate the cook's words here first." } };
  }
  if (transcript.length > MAX_TRANSCRIPT) {
    return {
      values,
      fieldErrors: { transcript: `That's too long for one recipe (${transcript.length} of ${MAX_TRANSCRIPT} characters). Split it into two.` },
    };
  }

  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("dictations")
    // Adding the cook's words is Development work, so a new dictation starts there.
    .insert({ transcript, dish_name, cook_name, stage: "development" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createDictation]", error);
    return { values, error: "Couldn't save just now. Your words are still here. Try again." };
  }
  revalidatePath("/");
  redirect(`/d/${data.id}`);
}

// Edit a dictation (student's decision: always editable). The database keeps
// the first version in original_transcript and stamps edited_at.
export async function updateDictation(dictationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const transcript = String(formData.get("transcript") ?? "");
  const dish_name = String(formData.get("dish_name") ?? "").trim().slice(0, 120) || null;
  const cook_name = String(formData.get("cook_name") ?? "").trim().slice(0, 60) || null;
  const values = { transcript, dish_name: dish_name ?? "", cook_name: cook_name ?? "" };

  if (!transcript.trim()) return { values, fieldErrors: { transcript: "Their words can't be empty. To remove this, delete it instead." } };
  if (transcript.length > MAX_TRANSCRIPT) {
    return { values, fieldErrors: { transcript: `That's too long for one recipe (${transcript.length} of ${MAX_TRANSCRIPT} characters).` } };
  }

  const supabase = await supabaseForUser();
  const { error } = await supabase.from("dictations").update({ transcript, dish_name, cook_name }).eq("id", dictationId);
  if (error) {
    console.error("[updateDictation]", error);
    return { values, error: "Couldn't save your changes. What you typed is still here. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// 2. Create recipe: pass 1 (draft + questions).
// ---------------------------------------------------------------------------
export async function createRecipe(dictationId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  const supabase = await supabaseForUser();

  // RLS: this returns nothing unless the dictation is yours.
  const { data: dictation } = await supabase
    .from("dictations")
    .select("*")
    .eq("id", dictationId)
    .single<DictationRow>();
  if (!dictation) return { error: "We couldn't find that dictation in your lab book." };
  if (!dictation.transcript) return { error: "Add the cook's words first. The AI makes the recipe from them." };
  // The AI step only runs from Development (the UI hides it elsewhere; this enforces it).
  if (dictation.stage !== "development") {
    return { error: "Move this to Development first, then create the recipe." };
  }

  // Don't make a second recipe if one exists (e.g. a double tap).
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("dictation_id", dictationId)
    .neq("status", "failed")
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/r/${existing.id}`);

  let result;
  try {
    result = await draftRecipe(dictation.transcript, dictation.dish_name ?? undefined);
  } catch (err) {
    return { error: friendlyModelError(err) };
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      dictation_id: dictationId,
      status: "needs_answers",
      draft: { ...result.draft, scan: result.scan },
      model: result.model,
      prompt_version: result.prompt_version,
    })
    .select("id")
    .single();
  if (error || !recipe) {
    console.error("[createRecipe]", error);
    return { error: "Couldn't save the draft. Try again." };
  }

  if (result.questions.length) {
    const { error: qErr } = await supabase.from("recipe_questions").insert(
      result.questions.map((q, i) => ({ ...q, recipe_id: recipe.id, position: i }))
    );
    if (qErr) console.error("[createRecipe questions]", qErr);
  }
  // Working on it now: move it to Development (the user can move it back).
  await supabase.from("dictations").update({ stage: "development" }).eq("id", dictationId);

  revalidatePath("/");
  redirect(`/r/${recipe.id}`);
}

// ---------------------------------------------------------------------------
// 3. Answer questions → pass 2 (final recipe).
// ---------------------------------------------------------------------------
function answerSourceFor(mode: string, text: string, suggestion: string): AnswerSource {
  if (!text.trim()) return "skipped";
  if (mode === "suggestion") return text.trim() === suggestion.trim() ? "suggestion_accepted" : "suggestion_edited";
  return "user_answer";
}

export async function submitAnswers(recipeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUser();
  const supabase = await supabaseForUser();

  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", recipeId).single<RecipeRow>();
  if (!recipe || !recipe.draft) return { error: "We couldn't find that recipe in your lab book." };

  const { data: dictation } = await supabase
    .from("dictations")
    .select("transcript")
    .eq("id", recipe.dictation_id)
    .single<{ transcript: string | null }>();
  const { data: questions } = await supabase
    .from("recipe_questions")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("position")
    .returns<QuestionRow[]>();
  if (!dictation?.transcript || !questions) return { error: "Couldn't load the questions. Try again." };

  const values: Record<string, string> = {};
  const answers: Answer[] = [];
  const now = new Date().toISOString();

  for (const q of questions) {
    const text = String(formData.get(`answer_${q.id}`) ?? "").slice(0, 2000);
    const mode = String(formData.get(`mode_${q.id}`) ?? "own");
    values[`answer_${q.id}`] = text;
    values[`mode_${q.id}`] = mode;
    const answer_source = answerSourceFor(mode, text, q.suggestion);
    answers.push({ question: toQuestion(q), answer: text.trim(), answer_source });

    const { error } = await supabase
      .from("recipe_questions")
      .update({ answer: text.trim() || null, answer_source, answered_at: now })
      .eq("id", q.id);
    if (error) console.error("[submitAnswers save]", error);
  }

  let final;
  try {
    const { scan: _scan, ...draft } = recipe.draft;
    void _scan;
    final = await finalizeRecipe(dictation.transcript, draft, answers);
  } catch (err) {
    return { values, error: friendlyModelError(err) };
  }

  const { error } = await supabase
    .from("recipes")
    .update({
      status: "ready",
      recipe: final.recipe,
      model: final.model,
      prompt_version: final.prompt_version,
      updated_at: now,
    })
    .eq("id", recipeId);
  if (error) {
    console.error("[submitAnswers finalize]", error, userId);
    return { values, error: "Couldn't save the recipe. Your answers are saved. Try again." };
  }
  await supabase.from("dictations").update({ stage: "finished" }).eq("id", recipe.dictation_id);

  revalidatePath(`/r/${recipeId}`);
  revalidatePath("/");
  redirect(`/r/${recipeId}`);
}

// ---------------------------------------------------------------------------
// 4. Send: turn a private link on or off.
// ---------------------------------------------------------------------------
export async function setSharing(recipeId: string, on: boolean): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from("recipes")
    .update({ share_token: on ? randomUUID() : null })
    .eq("id", recipeId)
    .eq("status", "ready");
  if (error) console.error("[setSharing]", error);
  revalidatePath(`/r/${recipeId}`);
}

// ---------------------------------------------------------------------------
// 5. Receive: save a copy of a shared recipe into your own lab book.
// ---------------------------------------------------------------------------
export async function saveSharedCopy(token: string, _prev: ActionState): Promise<ActionState> {
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/s/${token}`)}`);
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("save_shared_recipe", { token });
  if (error || !data) {
    console.error("[saveSharedCopy]", error);
    return { error: "This link isn't shared anymore, or something went wrong. Ask for a new link." };
  }
  revalidatePath("/");
  redirect(`/r/${data}`);
}

// ---------------------------------------------------------------------------
// Delete a dictation (and its recipe) from your lab book.
// ---------------------------------------------------------------------------
export async function deleteDictation(dictationId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("dictations").delete().eq("id", dictationId);
  if (error) console.error("[deleteDictation]", error);
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Ideas: quick notes and links. No AI.
// ---------------------------------------------------------------------------
function readIdea(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const note = String(formData.get("note") ?? "").slice(0, 5000);
  const rawLink = String(formData.get("link") ?? "").trim();
  const values = { title, note, link: rawLink };
  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Give the idea a short name, like “Caramelized onion crunch”.";
  let link: string | null = null;
  if (rawLink) {
    try {
      const u = new URL(/^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
      link = u.toString().slice(0, 2000);
    } catch {
      fieldErrors.link = "That doesn't look like a web link. Paste the full address, like https://…";
    }
  }
  return { title, note, link, values, fieldErrors };
}

export async function createIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const { title, note, link, values, fieldErrors } = readIdea(formData);
  if (Object.keys(fieldErrors).length) return { values, fieldErrors };

  const supabase = await supabaseForUser();
  // One kind of lab-book entry: an idea is an entry with notes and no cook's words yet.
  const { data, error } = await supabase
    .from("dictations")
    .insert({ dish_name: title, notes: note, link })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createIdea]", error);
    return { values, error: "Couldn't save the idea. What you typed is still here. Try again." };
  }
  revalidatePath("/");
  // Issue #3: "Save and add another" goes straight to a fresh form.
  if (formData.get("intent") === "another") {
    redirect(`/ideas/new?added=${encodeURIComponent(title)}&n=${Date.now()}`);
  }
  // Issue #2: show "Saved to Ideas" and the next step, once.
  redirect(`/d/${data.id}?saved=1`);
}

export async function updateIdea(ideaId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const { title, note, link, values, fieldErrors } = readIdea(formData);
  if (Object.keys(fieldErrors).length) return { values, fieldErrors };

  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from("ideas")
    .update({ title, note, link, updated_at: new Date().toISOString() })
    .eq("id", ideaId);
  if (error) {
    console.error("[updateIdea]", error);
    return { values, error: "Couldn't save your changes. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteIdea(ideaId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) console.error("[deleteIdea]", error);
  revalidatePath("/");
  redirect("/?tab=ideas");
}

// ---------------------------------------------------------------------------
// Move anything between Ideas / Development / Finished.
// ---------------------------------------------------------------------------
export async function moveItem(kind: "idea" | "dictation", id: string, formData: FormData): Promise<void> {
  await requireUser();
  const stage = formData.get("stage");
  if (!isStage(stage)) return;
  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from(kind === "idea" ? "ideas" : "dictations")
    .update({ stage })
    .eq("id", id);
  if (error) console.error("[moveItem]", error);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// In-place edits, one part at a time (pencil icons).
// For a dictation, its title is dish_name and its notes are the words.
// ---------------------------------------------------------------------------
export async function renameItem(
  kind: "idea" | "dictation",
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const values = { title };
  if (kind === "idea" && !title) return { values, fieldErrors: { title: "Give it a short name." } };

  const supabase = await supabaseForUser();
  const { error } =
    kind === "idea"
      ? await supabase.from("ideas").update({ title, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("dictations").update({ dish_name: title || null }).eq("id", id);
  if (error) {
    console.error("[renameItem]", error);
    return { values, error: "Couldn't save the name. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function updateNotes(
  kind: "idea" | "dictation",
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const supabase = await supabaseForUser();

  const { note, link, fieldErrors } = readIdea(formData);
  const values = { note, link: String(formData.get("link") ?? "") };
  if (fieldErrors.link) return { values, fieldErrors: { link: fieldErrors.link } };
  const { error } =
    kind === "idea"
      ? await supabase.from("ideas").update({ note, link, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("dictations").update({ notes: note, link }).eq("id", id);
  if (error) {
    console.error("[updateNotes]", error);
    return { values, error: "Couldn't save your notes. What you typed is still here. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Edit the whole ingredient list of a finished recipe at once. Changed or added
// amounts are labeled as family answers; old values are kept in notes; removed
// ingredients are recorded in the recipe's "What the app changed" notes.
// ---------------------------------------------------------------------------
export async function updateIngredients(
  recipeId: string,
  cookName: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  let rows: { orig: number | null; amount: string; item: string }[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(rows) || rows.length > 80) throw new Error("bad");
  } catch {
    return { error: "Something went wrong reading the list. Refresh and try again." };
  }

  const supabase = await supabaseForUser();
  // RLS: only your own recipe comes back.
  const { data: row } = await supabase.from("recipes").select("recipe").eq("id", recipeId).single<Pick<RecipeRow, "recipe">>();
  if (!row?.recipe) return { error: "We couldn't find that recipe in your lab book." };
  const old = row.recipe.ingredients;

  const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const whoSaid = (src: string) =>
    src === "cook" ? cookName || "the cook" : src === "suggested" ? "a suggestion" : src === "user_answer" ? "a family answer" : "not stated";

  const kept = new Set<number>();
  const ingredients: typeof old = [];
  for (const r of rows) {
    const amount = String(r.amount ?? "").trim().slice(0, 60);
    const item = String(r.item ?? "").trim().slice(0, 120);
    if (!item && !amount) continue; // empty new row
    if (!item) return { error: `Give the ingredient with “${amount}” a name, or remove it.` };
    const o = typeof r.orig === "number" && Number.isInteger(r.orig) ? old[r.orig] : undefined;
    if (o && typeof r.orig === "number") {
      kept.add(r.orig);
      const history: string[] = [];
      if (amount !== o.amount) history.push(o.amount ? `Changed from “${o.amount}” (${whoSaid(o.source)}) on ${when}.` : `Amount added on ${when}.`);
      if (item !== o.item) history.push(`Renamed from “${o.item}” on ${when}.`);
      ingredients.push({
        ...o,
        item,
        amount,
        source: amount !== o.amount ? (amount ? "user_answer" : "not_stated") : o.source,
        note: [o.note, ...history].filter(Boolean).join(" "),
      });
    } else {
      ingredients.push({
        item,
        amount,
        source: amount ? "user_answer" : "not_stated",
        note: `Added on ${when}.`,
        from_answers: [],
      });
    }
  }
  const removed = old.filter((_, i) => !kept.has(i)).map((o) => `Removed “${[o.amount, o.item].filter(Boolean).join(" ")}” (${whoSaid(o.source)}) on ${when}.`);

  const { error } = await supabase
    .from("recipes")
    // Not bumping updated_at: it marks when the AI made the recipe, which the
    // "words edited after this recipe was made" notice compares against.
    .update({ recipe: { ...row.recipe, ingredients, notes: [...row.recipe.notes, ...removed] } })
    .eq("id", recipeId);
  if (error) {
    console.error("[updateIngredients]", error);
    return { error: "Couldn't save the ingredients. Your changes are still here. Try again." };
  }
  revalidatePath(`/r/${recipeId}`);
  return { saved: true };
}
