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
import { AiLimitError, recordAiCall } from "@/lib/ai/limits";
import { deletePhotos, MAX_PHOTOS_PER_ENTRY, readPhoto, savePhoto } from "@/lib/photos";
import {
  cleanPart,
  isStage,
  STARTER_TAGS,
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
  if (err instanceof AiLimitError) return err.message; // our per-user limit (#5): no call was made
  if (err instanceof RateLimitError) return err.message;
  if (err instanceof ModelError) {
    console.error("[model]", err.message, err.detail ?? "");
    return "The recipe helper couldn't finish. Your kitchen notes are saved. Try again in a minute.";
  }
  console.error("[unexpected]", err);
  return "Something went wrong. Your kitchen notes are saved. Try again.";
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
    return { values, fieldErrors: { transcript: "Dictate or paste the kitchen notes here first." } };
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
    return { values, error: "Couldn't save just now. Your kitchen notes are still here. Try again." };
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

  if (transcript.length > MAX_TRANSCRIPT) {
    return { values, fieldErrors: { transcript: `That's too long for one recipe (${transcript.length} of ${MAX_TRANSCRIPT} characters).` } };
  }
  const supabase = await supabaseForUser();
  // Saving the words empty deletes them (student, Nov 21), unless AI questions are
  // still open, because finishing them needs the words.
  const empty = !transcript.trim();
  if (empty) {
    const { data: draft } = await supabase
      .from("recipes")
      .select("id")
      .eq("dictation_id", dictationId)
      .eq("status", "needs_answers")
      .limit(1)
      .maybeSingle();
    if (draft) {
      return {
        values,
        fieldErrors: { transcript: "The AI questions still need these notes. Finish or discard the questions first." },
      };
    }
  }
  const { error } = await supabase
    .from("dictations")
    .update({ transcript: empty ? null : transcript, dish_name, cook_name })
    .eq("id", dictationId);
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
  if (!dictation.transcript) return { error: "Add kitchen notes first. The AI makes the recipe from them." };
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
    result = await draftRecipe(dictation.transcript, dictation.dish_name ?? undefined, () => recordAiCall(supabase, "draft"));
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
    final = await finalizeRecipe(dictation.transcript, draft, answers, () => recordAiCall(supabase, "finalize"));
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
  await deletePhotos(supabase, { dictationId }); // the files too, not just the rows
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
    return { values, error: "Couldn't save your inspiration. What you typed is still here. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Edit the whole ingredient list of a finished recipe at once. Changed or added
// amounts are labeled as family answers; old values are kept in notes; removed
// ingredients are recorded in the recipe's "What the app changed" notes.
// The recipe JSON being edited: the original (public.recipes) or one of its
// iterations (public.iterations, student Nov 28). RLS limits both to your own.
type Supa = Awaited<ReturnType<typeof supabaseForUser>>;
async function loadRecipeJson(supabase: Supa, recipeId: string, iterationId: string | null) {
  if (!iterationId) {
    const { data } = await supabase.from("recipes").select("recipe").eq("id", recipeId).single<Pick<RecipeRow, "recipe">>();
    return data;
  }
  // The iteration must belong to this recipe's entry (security pass: no mixing rows).
  const { data: base } = await supabase.from("recipes").select("dictation_id").eq("id", recipeId).maybeSingle();
  if (!base) return null;
  const { data } = await supabase
    .from("iterations")
    .select("recipe")
    .eq("id", iterationId)
    .eq("dictation_id", base.dictation_id)
    .not("recipe", "is", null)
    .single<Pick<RecipeRow, "recipe">>();
  return data;
}
async function saveRecipeJson(supabase: Supa, recipeId: string, iterationId: string | null, recipe: NonNullable<RecipeRow["recipe"]>) {
  if (!iterationId) return supabase.from("recipes").update({ recipe }).eq("id", recipeId);
  const { data: base } = await supabase.from("recipes").select("dictation_id").eq("id", recipeId).maybeSingle();
  return supabase.from("iterations").update({ recipe }).eq("id", iterationId).eq("dictation_id", base?.dictation_id ?? "");
}

// ---------------------------------------------------------------------------
export async function updateIngredients(
  recipeId: string,
  cookName: string,
  iterationId: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  let rows: { orig: number | null; amount: string; item: string; section?: string }[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(rows) || rows.length > 80) throw new Error("bad");
  } catch {
    return { error: "Something went wrong reading the list. Refresh and try again." };
  }

  const supabase = await supabaseForUser();
  // RLS: only your own recipe (or iteration of it) comes back.
  const row = await loadRecipeJson(supabase, recipeId, iterationId);
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
    const section = cleanPart(r.section); // the recipe part (student, Nov 28); "" = none
    const o = typeof r.orig === "number" && Number.isInteger(r.orig) ? old[r.orig] : undefined;
    if (o && typeof r.orig === "number") {
      kept.add(r.orig);
      const history: string[] = [];
      if (amount !== o.amount) history.push(o.amount ? `Changed from “${o.amount}” (${whoSaid(o.source)}) on ${when}.` : `Amount added on ${when}.`);
      if (item !== o.item) history.push(`Renamed from “${o.item}” on ${when}.`);
      const { section: _old, ...rest } = o as typeof o & { section?: string };
      void _old;
      ingredients.push({
        ...rest,
        item,
        amount,
        source: amount !== o.amount ? (amount ? "user_answer" : "not_stated") : o.source,
        note: [o.note, ...history].filter(Boolean).join(" "),
        ...(section ? { section } : {}),
      });
    } else {
      ingredients.push({
        item,
        amount,
        source: amount ? "user_answer" : "not_stated",
        note: `Added on ${when}.`,
        from_answers: [],
        ...(section ? { section } : {}),
      });
    }
  }
  const removed = old.filter((_, i) => !kept.has(i)).map((o) => `Removed “${[o.amount, o.item].filter(Boolean).join(" ")}” (${whoSaid(o.source)}) on ${when}.`);

  // Not bumping updated_at: it marks when the AI made the recipe, which the
  // "words edited after this recipe was made" notice compares against.
  const { error } = await saveRecipeJson(supabase, recipeId, iterationId, { ...row.recipe, ingredients, notes: [...row.recipe.notes, ...removed] });
  if (error) {
    console.error("[updateIngredients]", error);
    return { error: "Couldn't save the ingredients. Your changes are still here. Try again." };
  }
  revalidatePath(`/r/${recipeId}`);
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Edit the instructions (student, Nov 28): each step's text, its "Why it works"
// (food science) and "Adjust to taste" notes. Unchanged parts keep their source;
// anything changed or added is labeled as yours (user_answer).
// ---------------------------------------------------------------------------
type StepRow = {
  orig: number | null;
  text: string;
  section?: string;
  why: { orig: number | null; text: string }[];
  dials: { orig: number | null; setting: string; effect: string }[];
};

export async function updateSteps(recipeId: string, iterationId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  let rows: StepRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(rows) || rows.length > 60) throw new Error("bad");
  } catch {
    return { error: "Something went wrong reading the steps. Refresh and try again." };
  }
  const supabase = await supabaseForUser();
  // RLS: only your own recipe (or iteration of it) comes back.
  const row = await loadRecipeJson(supabase, recipeId, iterationId);
  if (!row?.recipe) return { error: "We couldn't find that recipe in your lab book." };
  const old = row.recipe.steps;
  const idx = (v: unknown, list: unknown[]) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < list.length ? v : null);
  const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

  const steps: typeof old = [];
  for (const r of rows) {
    const text = clip(r.text, 2000);
    const o = old[idx(r.orig, old) ?? -1];
    const whyIn = (Array.isArray(r.why) ? r.why : []).slice(0, 8);
    const dialsIn = (Array.isArray(r.dials) ? r.dials : []).slice(0, 8);
    const why = whyIn.flatMap((w) => {
      const t = clip(w.text, 1000);
      if (!t) return [];
      const ow = o?.why[idx(w.orig, o?.why ?? []) ?? -1];
      const shown = ow ? (ow.source === "cook" && ow.quote?.trim() ? ow.quote : ow.text) : null;
      return [ow && shown === t ? ow : { source: "user_answer" as const, text: t, quote: "" }];
    });
    const dials = dialsIn.flatMap((d) => {
      const setting = clip(d.setting, 120);
      const effect = clip(d.effect, 200);
      if (!setting && !effect) return [];
      const od = o?.dials[idx(d.orig, o?.dials ?? []) ?? -1];
      return [od && od.setting === setting && od.effect === effect ? od : { setting, effect, source: "user_answer" as const }];
    });
    if (!text && why.length === 0 && dials.length === 0) continue; // an empty new step
    if (!text) return { error: "A step has notes but no instructions. Add the step's text, or remove it." };
    const section = cleanPart(r.section);
    steps.push({ text, from_answers: o?.from_answers ?? [], why, dials, ...(section ? { section } : {}) });
  }
  if (steps.length === 0) return { error: "Keep at least one step." };

  // Not bumping updated_at (see updateIngredients).
  const { error } = await saveRecipeJson(supabase, recipeId, iterationId, { ...row.recipe, steps });
  if (error) {
    console.error("[updateSteps]", error);
    return { error: "Couldn't save the instructions. Your changes are still here. Try again." };
  }
  revalidatePath(`/r/${recipeId}`);
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Quick-add an idea from the Ideas tab: just a name, Enter, and it's in the
// list (student, Nov 20). Notes and a link can be added later with the pencil.
// ---------------------------------------------------------------------------
export async function quickAddIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  // Inspiration in the same step (student, Nov 27: fewer taps).
  const note = String(formData.get("note") ?? "").trim().slice(0, 5000);
  // Text, a photo, or both (student, Nov 27).
  const file = formData.get("photo");
  const hasPhoto = file instanceof File && file.size > 0;
  if (!title && !note && !hasPhoto) return { fieldErrors: { title: "Type the idea or add a photo first." } };
  const photo = hasPhoto ? await readPhoto(file) : null;
  if (photo && !photo.ok) return { values: { title, note }, fieldErrors: { photo: photo.error } };

  const supabase = await supabaseForUser();
  const { data, error } = await supabase.from("dictations").insert({ dish_name: title || null, notes: note }).select("id").single();
  if (error || !data) {
    console.error("[quickAddIdea]", error);
    return { values: { title, note }, error: "Couldn't add it. Try again." };
  }
  revalidatePath("/");
  const added = title || (hasPhoto ? "Photo idea" : "Untitled idea");
  if (photo?.ok && !(await savePhoto(supabase, userId, data.id, photo)).ok) {
    return { saved: true, values: { added }, error: "The idea is saved, but the photo didn't upload. Open the idea to try again." };
  }
  return { saved: true, values: { added } };
}

// ---------------------------------------------------------------------------
// Photos on an entry (issue #7): add one more, or delete one.
// ---------------------------------------------------------------------------
export async function addPhoto(dictationId: string, formData: FormData): Promise<{ error?: string }> {
  const userId = await requireUser();
  const photo = await readPhoto(formData.get("photo"));
  if (!photo.ok) return { error: photo.error };
  const supabase = await supabaseForUser();
  // RLS: only your own entry comes back, and the insert re-checks it.
  const { data: entry } = await supabase.from("dictations").select("id").eq("id", dictationId).maybeSingle();
  if (!entry) return { error: "Couldn't find this idea." };
  const { count } = await supabase
    .from("entry_photos")
    .select("id", { count: "exact", head: true })
    .eq("dictation_id", dictationId)
    .eq("kind", "idea");
  if ((count ?? 0) >= MAX_PHOTOS_PER_ENTRY) return { error: `Up to ${MAX_PHOTOS_PER_ENTRY} photos each. Delete one to add another.` };
  if (!(await savePhoto(supabase, userId, dictationId, photo)).ok) return { error: "The photo didn't upload. Try again." };
  revalidatePath("/", "layout");
  return {};
}

/** The photo of the finished dish on a recipe (student, Nov 28): one per recipe; a new one replaces the old. */
export async function setDishPhoto(dictationId: string, formData: FormData): Promise<{ error?: string }> {
  const userId = await requireUser();
  const photo = await readPhoto(formData.get("photo"));
  if (!photo.ok) return { error: photo.error };
  const supabase = await supabaseForUser();
  const { data: entry } = await supabase.from("dictations").select("id").eq("id", dictationId).maybeSingle();
  if (!entry) return { error: "Couldn't find this recipe." };
  const { data: old } = await supabase.from("entry_photos").select("id").eq("dictation_id", dictationId).eq("kind", "dish");
  if (old?.length) await deletePhotos(supabase, { ids: old.map((o) => o.id) });
  if (!(await savePhoto(supabase, userId, dictationId, photo, "dish")).ok) return { error: "The photo didn't upload. Try again." };
  revalidatePath("/", "layout");
  return {};
}

export async function deletePhoto(photoId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  await deletePhotos(supabase, { ids: [photoId] });
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Add a recipe by hand, in the same format as an AI recipe (student, Nov 20).
// No AI call. Saved straight into Recipes: an entry (stage "finished") + a ready
// recipe. Everything is labeled as the cook's (the "Whose recipe?" name).
// ---------------------------------------------------------------------------
type ManualRows = {
  ingredients: { amount: string; item: string; section?: string }[];
  // section = the part of the recipe, e.g. "Caramel sauce" (student, Nov 28).
  // why: one string (older form) or several; dials: "Adjust to taste" pairs (student, Nov 28).
  steps: { text: string; section?: string; why: string | string[]; dials?: { setting: string; effect: string }[] }[];
};

export async function createManualRecipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const cook_name = String(formData.get("cook_name") ?? "").trim().slice(0, 60) || null;
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  let rows: ManualRows;
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "{}"));
    if (!Array.isArray(rows.ingredients) || !Array.isArray(rows.steps)) throw new Error("bad");
  } catch {
    return { error: "Something went wrong reading the recipe. Refresh and try again." };
  }
  const ingredients = rows.ingredients
    .slice(0, 80)
    .map((r) => ({ amount: String(r?.amount ?? "").trim().slice(0, 60), item: String(r?.item ?? "").trim().slice(0, 120), section: cleanPart(r?.section) }))
    .filter((r) => r.item || r.amount);
  const steps = rows.steps
    .slice(0, 80)
    .map((r) => ({
      text: String(r?.text ?? "").trim().slice(0, 2000),
      section: cleanPart(r?.section),
      why: (Array.isArray(r?.why) ? r.why : [r?.why]).slice(0, 8).map((w) => String(w ?? "").trim().slice(0, 1000)).filter(Boolean),
      dials: (Array.isArray(r?.dials) ? r.dials : [])
        .slice(0, 8)
        .map((d) => ({ setting: String(d?.setting ?? "").trim().slice(0, 120), effect: String(d?.effect ?? "").trim().slice(0, 200) }))
        .filter((d) => d.setting || d.effect),
    }))
    .filter((r) => r.text);

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Give the recipe a name.";
  if (ingredients.some((r) => !r.item)) fieldErrors.ingredients = "Every amount needs an ingredient name (or remove that row).";
  else if (!ingredients.length) fieldErrors.ingredients = "Add at least one ingredient.";
  if (!steps.length) fieldErrors.steps = "Add at least one step.";
  const values = { title, cook_name: cook_name ?? "", notes };
  if (Object.keys(fieldErrors).length) return { values, fieldErrors };

  const recipe = {
    title,
    ingredients: ingredients.map((r) => ({
      item: r.item,
      amount: r.amount,
      source: r.amount ? ("cook" as const) : ("not_stated" as const),
      note: "",
      from_answers: [],
      ...(r.section ? { section: r.section } : {}),
    })),
    steps: steps.map((r) => ({
      text: r.text,
      ...(r.section ? { section: r.section } : {}),
      from_answers: [],
      dials: r.dials.map((d) => ({ ...d, source: "cook" as const })),
      why: r.why.map((w) => ({ source: "cook" as const, text: w, quote: w })),
    })),
    notes: ["Added by hand (no AI)."],
  };

  const supabase = await supabaseForUser();
  // Written for an existing entry (from Development), or a brand-new one (from Recipes).
  const fromId = String(formData.get("dictation_id") ?? "") || null;
  let entry: { id: string } | null = null;
  let createdEntry = false;
  if (fromId) {
    // RLS: only your own entry comes back.
    const { data: own } = await supabase.from("dictations").select("id").eq("id", fromId).maybeSingle();
    if (!own) return { values, error: "We couldn't find that item in your lab book." };
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("dictation_id", fromId)
      .neq("status", "failed")
      .limit(1)
      .maybeSingle();
    if (existing) return { values, error: "This item already has a recipe. Discard its AI questions first, or edit the recipe." };
    const { error: eu } = await supabase
      .from("dictations")
      .update({ dish_name: title, cook_name, notes, stage: "finished" })
      .eq("id", fromId);
    if (eu) {
      console.error("[createManualRecipe update entry]", eu);
      return { values, error: "Couldn't save the recipe. What you typed is still here. Try again." };
    }
    entry = own;
  } else {
    const { data: made, error: e1 } = await supabase
      .from("dictations")
      .insert({ dish_name: title, cook_name, notes, stage: "finished" })
      .select("id")
      .single();
    if (e1 || !made) {
      console.error("[createManualRecipe entry]", e1);
      return { values, error: "Couldn't save the recipe. What you typed is still here. Try again." };
    }
    entry = made;
    createdEntry = true;
  }
  const { data: made, error: e2 } = await supabase
    .from("recipes")
    .insert({ dictation_id: entry.id, status: "ready", recipe, model: "manual", prompt_version: null })
    .select("id")
    .single();
  if (e2 || !made) {
    console.error("[createManualRecipe recipe]", e2);
    // Don't leave a half-saved entry: remove a new one, or move an existing one back.
    if (createdEntry) await supabase.from("dictations").delete().eq("id", entry.id);
    else await supabase.from("dictations").update({ stage: "development" }).eq("id", entry.id);
    return { values, error: "Couldn't save the recipe. What you typed is still here. Try again." };
  }
  revalidatePath("/");
  redirect(`/r/${made.id}`);
}

// ---------------------------------------------------------------------------
// Leave the AI questions (student, Nov 20): save for later, or discard.
// ---------------------------------------------------------------------------
/** Save whatever answers are typed so far (no AI call) and go back to Development. */
export async function saveAnswersForLater(recipeId: string, formData: FormData): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { data: questions } = await supabase
    .from("recipe_questions")
    .select("*")
    .eq("recipe_id", recipeId)
    .returns<QuestionRow[]>();
  const now = new Date().toISOString();
  for (const q of questions ?? []) {
    const text = String(formData.get(`answer_${q.id}`) ?? "").slice(0, 2000);
    const mode = String(formData.get(`mode_${q.id}`) ?? "own");
    // Untouched questions stay unanswered, so they're still open next time.
    if (!text.trim()) continue;
    const { error } = await supabase
      .from("recipe_questions")
      .update({ answer: text.trim(), answer_source: answerSourceFor(mode, text, q.suggestion), answered_at: now })
      .eq("id", q.id);
    if (error) console.error("[saveAnswersForLater]", error);
  }
  revalidatePath("/", "layout");
  redirect("/?tab=development");
}

/** Throw the AI draft and its questions away, back to the cook's words, to start over. */
export async function discardDraft(recipeId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  // RLS: only your own recipe comes back, and only a draft can be discarded here.
  const { data: recipe } = await supabase
    .from("recipes")
    .select("dictation_id, status")
    .eq("id", recipeId)
    .maybeSingle<{ dictation_id: string; status: string }>();
  if (!recipe || recipe.status === "ready") redirect(`/r/${recipeId}`);
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId); // questions cascade
  if (error) console.error("[discardDraft]", error);
  revalidatePath("/", "layout");
  redirect(`/d/${recipe.dictation_id}`);
}

// ---------------------------------------------------------------------------
// Delete the cook's words (student, Nov 21). The entry, its idea notes, and
// any finished recipe stay. Nothing is kept: no copy of the old words.
// ---------------------------------------------------------------------------
export async function deleteWords(dictationId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("dictations").update({ transcript: null }).eq("id", dictationId);
  if (error) console.error("[deleteWords]", error);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Tags for the Recipes tab (student, Nov 21; issue #8). Your own list (create,
// delete); a recipe can have several. Stored in `sections` / `entry_sections`
// (first called sections). Deleting a tag never deletes recipes, only the
// links. RLS checks both ends of every link.
// ---------------------------------------------------------------------------
const cleanTag = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);

/** Tags page: make a tag. */
export async function addTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const name = cleanTag(formData.get("name"));
  if (!name) return { fieldErrors: { name: "Name the tag, like “Desserts”." } };
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("sections").insert({ name });
  if (error) {
    if (error.code === "23505") return { values: { name }, fieldErrors: { name: `You already have a tag called “${name}”.` } };
    console.error("[addTag]", error);
    return { values: { name }, error: "Couldn't add the tag. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true, values: { added: name } };
}

/** Add the starter tags (lib/types.ts). Skips ones you already have. */
export async function addStarterTags(): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  for (const name of STARTER_TAGS) {
    const { error } = await supabase.from("sections").insert({ name });
    if (error && error.code !== "23505") console.error("[addStarterTags]", error);
  }
  revalidatePath("/", "layout");
}

export async function deleteTag(tagId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("sections").delete().eq("id", tagId);
  if (error) console.error("[deleteTag]", error);
  revalidatePath("/", "layout");
}

/**
 * Type-to-add on a recipe: tag it with `name`. Uses your existing tag with that
 * name (any case), or makes a new one.
 */
export async function tagEntry(
  dictationId: string,
  rawName: string,
): Promise<{ ok: true; tag: { id: string; name: string } } | { ok: false; error: string }> {
  await requireUser();
  const name = cleanTag(rawName);
  if (!name) return { ok: false, error: "Type a tag first." };
  const supabase = await supabaseForUser();
  const { data: mine } = await supabase.from("sections").select("id, name").returns<{ id: string; name: string }[]>();
  let tag = (mine ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (!tag) {
    const { data, error } = await supabase.from("sections").insert({ name }).select("id, name").single();
    if (error || !data) {
      console.error("[tagEntry]", error);
      return { ok: false, error: "Couldn't add the tag. Try again." };
    }
    tag = data;
  }
  const { error } = await supabase.from("entry_sections").insert({ dictation_id: dictationId, section_id: tag.id });
  if (error && error.code !== "23505") {
    console.error("[tagEntry link]", error);
    return { ok: false, error: "Couldn't add the tag. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, tag };
}

/**
 * Take a tag off a recipe (the tag itself stays). By name, so it also works on
 * a tag that was added a moment ago and has no id on screen yet.
 */
export async function untagEntry(dictationId: string, rawName: string): Promise<{ ok: boolean }> {
  await requireUser();
  const name = cleanTag(rawName).toLowerCase();
  const supabase = await supabaseForUser();
  const { data: mine } = await supabase.from("sections").select("id, name").returns<{ id: string; name: string }[]>();
  const tag = (mine ?? []).find((t) => t.name.toLowerCase() === name);
  if (!tag) return { ok: true }; // nothing to remove
  const { error } = await supabase.from("entry_sections").delete().eq("dictation_id", dictationId).eq("section_id", tag.id);
  if (error) console.error("[untagEntry]", error);
  revalidatePath("/", "layout");
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Iterations (issue #9; student, Nov 28): versions of a recipe. A new iteration
// copies the version you're looking at; you then edit its ingredients and
// instructions. Each has a date and the cook's own notes. Iteration 1 is the
// original recipe (its notes live in a row with recipe = null).
// ---------------------------------------------------------------------------
export async function createIteration(recipeId: string, fromIterationId: string | null): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  // RLS: your own recipe only.
  const { data: base } = await supabase.from("recipes").select("dictation_id").eq("id", recipeId).maybeSingle();
  const src = base ? await loadRecipeJson(supabase, recipeId, fromIterationId) : null;
  if (!base || !src?.recipe) redirect(`/r/${recipeId}`);
  const { data, error } = await supabase
    .from("iterations")
    .insert({ dictation_id: base.dictation_id, recipe: src.recipe, made_on: new Date().toLocaleDateString("en-CA") })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[createIteration]", error);
    redirect(`/r/${recipeId}`);
  }
  revalidatePath(`/r/${recipeId}`);
  redirect(`/r/${recipeId}?it=${data.id}`);
}

/** Save an iteration's date and notes. iterationId null = the original recipe (iteration 1). */
export async function saveIterationNotes(recipeId: string, iterationId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const made_on = String(formData.get("made_on") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  const values = { made_on, notes };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(made_on) || Number.isNaN(Date.parse(made_on))) return { values, fieldErrors: { made_on: "Pick the date you made it." } };
  const supabase = await supabaseForUser();
  let error;
  if (iterationId) {
    ({ error } = await supabase.from("iterations").update({ made_on, notes }).eq("id", iterationId));
  } else {
    const { data: base } = await supabase.from("recipes").select("dictation_id").eq("id", recipeId).maybeSingle();
    if (!base) return { values, error: "We couldn't find that recipe in your lab book." };
    const { data: orig } = await supabase.from("iterations").select("id").eq("dictation_id", base.dictation_id).is("recipe", null).maybeSingle();
    ({ error } = orig
      ? await supabase.from("iterations").update({ made_on, notes }).eq("id", orig.id)
      : await supabase.from("iterations").insert({ dictation_id: base.dictation_id, made_on, notes }));
  }
  if (error) {
    console.error("[saveIterationNotes]", error);
    return { values, error: "Couldn't save the notes. What you typed is still here. Try again." };
  }
  revalidatePath(`/r/${recipeId}`);
  return { saved: true };
}

export async function deleteIteration(recipeId: string, iterationId: string): Promise<void> {
  await requireUser();
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("iterations").delete().eq("id", iterationId).not("recipe", "is", null);
  if (error) console.error("[deleteIteration]", error);
  revalidatePath(`/r/${recipeId}`);
  redirect(`/r/${recipeId}`);
}
