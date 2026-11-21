import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { deleteDictation, discardDraft, saveAnswersForLater } from "@/app/actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { RecipeView } from "@/components/RecipeView";
import { DictationEditor } from "@/components/DictationEditor";
import { EditableNotes } from "@/components/InlineEdit";
import { Button, eyebrow, focusRing, formatDate, SourceBadge, textLink } from "@/components/ui";
import { supabaseForUser } from "@/lib/supabase/server";
import type { DictationRow, QuestionRow, RecipeRow } from "@/lib/types";
import { QuestionsForm } from "./QuestionsForm";
import { MoveTo } from "@/components/MoveTo";
import { STAGE_LABEL } from "@/lib/types";
import { SharePanel } from "./SharePanel";
import { SectionPicker } from "@/components/SectionPicker";
import type { SectionRow } from "@/lib/types";

// Pass 2 can take a while on the free tier.
export const maxDuration = 300;

export default async function RecipePage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const supabase = await supabaseForUser();

  // RLS: each of these returns nothing unless the rows are yours.
  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle<RecipeRow>();
  if (!recipe) notFound();
  const [{ data: dictation }, { data: questions }] = await Promise.all([
    supabase.from("dictations").select("*").eq("id", recipe.dictation_id).single<DictationRow>(),
    supabase.from("recipe_questions").select("*").eq("recipe_id", id).order("position").returns<QuestionRow[]>(),
  ]);
  if (!dictation) notFound();

  if (recipe.status !== "ready" || !recipe.recipe) {
    return (
      <main className="space-y-8">
        <div className="space-y-3">
          <p className={eyebrow}>
            <Link href={`/?tab=${dictation.stage}`} className={textLink}>
              {STAGE_LABEL[dictation.stage]}
            </Link>{" "}
            / {dictation.dish_name || recipe.draft?.title || "Recipe"}
          </p>
          <h1 className="font-ls-serif text-5xl leading-none">A few questions first</h1>
          <p className="max-w-prose text-[17px] leading-relaxed text-ls-muted">
            These are things a new cook couldn&apos;t figure out from {dictation.cook_name ? `${dictation.cook_name}'s` : "the"}{" "}
            words. Answer what you know.
          </p>
          {/* Leave the questions: keep answers for later, or throw the AI draft away. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <Button
              type="submit"
              form="questions-form"
              formAction={saveAnswersForLater.bind(null, recipe.id)}
              formNoValidate
              variant="secondary"
            >
              Save for later
            </Button>
            <form action={discardDraft.bind(null, recipe.id)}>
              <ConfirmSubmit
                variant="danger"
                message="Discard these questions and the AI draft? Your answers will be lost. You can edit the cook's words and create the recipe again."
              >
                Discard questions
              </ConfirmSubmit>
            </form>
          </div>
        </div>
        <EditableNotes kind="dictation" id={dictation.id} note={dictation.notes} link={dictation.link} />
        <DictationEditor dictation={dictation} canDelete={false} />
        <QuestionsForm recipeId={recipe.id} questions={questions ?? []} cookName={dictation.cook_name} />
      </main>
    );
  }

  const answered = (questions ?? []).filter((q) => q.answer_source);
  // Sections (Recipes tab only): your list + which ones this recipe is in.
  const [{ data: sections }, { data: links }] =
    dictation.stage === "finished"
      ? await Promise.all([
          supabase.from("sections").select("id, name, created_at").order("name").returns<SectionRow[]>(),
          supabase.from("entry_sections").select("section_id").eq("dictation_id", dictation.id),
        ])
      : [{ data: null }, { data: null }];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const shareUrl = recipe.share_token ? `${origin}/s/${recipe.share_token}` : null;

  return (
    <main className="space-y-10">
      <p className={eyebrow}>
        <Link href={`/?tab=${dictation.stage}`} className={textLink}>
          {STAGE_LABEL[dictation.stage]}
        </Link>{" "}
        / {recipe.recipe.title}
        {recipe.copied_from ? " · saved from a link" : ""}
      </p>

      {dictation.edited_at && dictation.edited_at > recipe.updated_at && (
        <p role="note" className="border-l-2 border-ls-ink bg-ls-surface px-4 py-3 text-[15px]">
          Their words were edited on {formatDate(dictation.edited_at)}, after this recipe was made, so the recipe may
          not match them anymore.
        </p>
      )}

      <RecipeView recipe={recipe.recipe} cookName={dictation.cook_name} editableRecipeId={recipe.id} />

      <EditableNotes kind="dictation" id={dictation.id} note={dictation.notes} link={dictation.link} />

      {dictation.stage === "finished" && (
        <SectionPicker dictationId={dictation.id} sections={sections ?? []} selected={(links ?? []).map((l) => l.section_id)} />
      )}

      {/* Hand-typed recipes (model "manual") have no cook's words to show or add. */}
      {(recipe.model !== "manual" || dictation.transcript) && (
        <section aria-label="Original dictation" className="space-y-3">
          <DictationEditor dictation={dictation} />
        </section>
      )}

      {answered.length > 0 && (
        <details className="border border-ls-border bg-ls-surface">
          <summary className={`flex min-h-11 cursor-pointer items-center px-4 py-3 text-[15px] hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}>
            Questions the app asked ({answered.length})
          </summary>
          <ol className="divide-y divide-ls-border border-t border-ls-border px-4">
            {answered.map((q) => (
              <li key={q.id} className="space-y-1.5 py-3 text-[15px]">
                <p className="font-medium">{q.question}</p>
                {q.answer_source === "skipped" ? (
                  <p className="flex flex-wrap items-baseline gap-2 text-ls-muted">
                    <SourceBadge source="not_stated" /> Nobody knew yet
                  </p>
                ) : (
                  <p className="flex flex-wrap items-baseline gap-2">
                    <SourceBadge source={q.answer_source === "user_answer" ? "user_answer" : "suggested"} /> {q.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className={`border-t border-ls-border px-4 py-3 ${eyebrow}`}>
            Made with {recipe.model} · prompt {recipe.prompt_version}
          </p>
        </details>
      )}

      <SharePanel recipeId={recipe.id} url={shareUrl} title={recipe.recipe.title} />

      <MoveTo kind="dictation" id={dictation.id} current={dictation.stage} />

      <form action={deleteDictation.bind(null, dictation.id)} className="border-t border-ls-border pt-4">
        <ConfirmSubmit
          variant="danger"
          message="Delete this recipe and the words it came from? Links you've sent will stop working. This can't be undone."
        >
          Delete this recipe
        </ConfirmSubmit>
      </form>

    </main>
  );
}
