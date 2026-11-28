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
import { TagPicker } from "@/components/TagPicker";
import { EntryPhotos } from "@/components/EntryPhotos";
import { DishPhoto } from "@/components/DishPhoto";
import { AllNotesProvider, AllNotesSwitch } from "@/components/RecipeExtras";
import { recipeHasNotes } from "@/components/IngredientList";
import { MAX_PHOTOS_PER_ENTRY, photosFor } from "@/lib/photos";
import type { TagRow } from "@/lib/types";

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
            These are things a new cook couldn&apos;t figure out from the kitchen notes. Answer what you know.
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
                message="Discard these questions and the AI draft? Your answers will be lost. You can edit the kitchen notes and create the recipe again."
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
  const allPhotos = await photosFor(supabase, [dictation.id]);
  const dish = allPhotos.find((p) => p.kind === "dish");
  const photos = allPhotos.filter((p) => p.kind === "idea"); // inspiration photos stay in the notes
  // Tags (Recipes tab only): your list + which ones this recipe has.
  const [{ data: sections }, { data: links }] =
    dictation.stage === "finished"
      ? await Promise.all([
          supabase.from("sections").select("id, name, created_at").order("name").returns<TagRow[]>(),
          supabase.from("entry_sections").select("section_id").eq("dictation_id", dictation.id),
        ])
      : [{ data: null }, { data: null }];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const shareUrl = recipe.share_token ? `${origin}/s/${recipe.share_token}` : null;

  return (
    <AllNotesProvider>
    <main className="space-y-6">
      {/* Breadcrumb and the "All notes" switch share one line; the recipe's name is the title below (student, Nov 28). */}
      <div className="flex items-center justify-between gap-3">
        <p className={eyebrow}>
          <Link href={`/?tab=${dictation.stage}`} className={textLink}>
            {STAGE_LABEL[dictation.stage]}
          </Link>
          {recipe.copied_from ? " · saved from a link" : ""}
        </p>
        {recipeHasNotes(recipe.recipe) && <AllNotesSwitch />}
      </div>

      {dictation.edited_at && dictation.edited_at > recipe.updated_at && (
        <p role="note" className="border-l-2 border-ls-ink bg-ls-surface px-4 py-3 text-[15px]">
          The kitchen notes were edited on {formatDate(dictation.edited_at)}, after this recipe was made, so the recipe may
          not match them anymore.
        </p>
      )}

      <RecipeView
        recipe={recipe.recipe}
        cookName={dictation.cook_name}
        editableRecipeId={recipe.id}
        switchOutside
        aside={<DishPhoto dictationId={dictation.id} photo={dish && { id: dish.id, url: dish.url }} />}
      />

      {dictation.stage === "finished" && (
        <TagPicker dictationId={dictation.id} allTags={sections ?? []} selected={(links ?? []).map((l) => l.section_id)} />
      )}

      {/* Everything from Ideas and Development, folded away so the recipe page
          stays calm (student, Nov 28). Open it to see or edit them. */}
      <details className="group border-y border-ls-ink">
        <summary
          className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}
        >
          Notes from Ideas and Development
          <span aria-hidden className="text-sm text-ls-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="space-y-5 pt-1 pb-5">
        <EditableNotes kind="dictation" id={dictation.id} note={dictation.notes} link={dictation.link} />

        <EntryPhotos dictationId={dictation.id} photos={photos} max={MAX_PHOTOS_PER_ENTRY} />

        {/* Hand-typed recipes (model "manual") have no kitchen notes to show or add. */}
        {(recipe.model !== "manual" || dictation.transcript) && (
          <section aria-label="Kitchen notes" className="space-y-3">
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
        </div>
      </details>

      <SharePanel recipeId={recipe.id} url={shareUrl} title={recipe.recipe.title} />

      {/* Move to and Delete share one line at the bottom (compact, student Nov 27). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-ls-border pt-2">
        <MoveTo kind="dictation" id={dictation.id} current={dictation.stage} />
        <form action={deleteDictation.bind(null, dictation.id)} className="-mr-3">
          <ConfirmSubmit
            variant="danger"
            message="Delete this recipe and the kitchen notes it came from? Links you've sent will stop working. This can't be undone."
          >
            Delete recipe
          </ConfirmSubmit>
        </form>
      </div>

    </main>
    </AllNotesProvider>
  );
}
