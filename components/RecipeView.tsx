import type { Recipe } from "@/lib/ai/schema";
import { EditableIngredients } from "./EditableIngredients";
import { SourcesScope, StepExtras } from "./RecipeExtras";
import { IngredientList } from "./IngredientList";
import { SourceBadge, Transcript } from "./ui";

type Props = {
  recipe: Recipe;
  /** Omit to render the words elsewhere (e.g. the owner's editable copy). */
  transcript?: string;
  cookName?: string | null;
  editedAt?: string | null;
  /** Owner's own recipe: amounts get a pencil to edit them. Omit for read-only (shared links). */
  editableRecipeId?: string;
};

/** The finished recipe: ingredients, steps, the why labeled by source, and her words. */
export function RecipeView({ recipe, transcript, cookName, editedAt, editableRecipeId }: Props) {
  return (
    <SourcesScope>
    <article className="space-y-10">
      <header className="space-y-4">
        <h1 className="font-ls-serif text-5xl leading-none sm:text-6xl">{recipe.title}</h1>
        <Legend cookName={cookName} />
      </header>

      {editableRecipeId ? (
        <EditableIngredients recipeId={editableRecipeId} ingredients={recipe.ingredients} cookName={cookName} />
      ) : (
        <section aria-labelledby="ingredients" className="space-y-3">
          <h2 id="ingredients" className="font-ls-serif text-3xl leading-tight">
            Ingredients
          </h2>
          <IngredientList ingredients={recipe.ingredients} cookName={cookName} />
        </section>
      )}

      <section aria-labelledby="steps" className="space-y-3">
        <h2 id="steps" className="font-ls-serif text-3xl leading-tight">
          Steps
        </h2>
        <ol className="divide-y divide-ls-border border-y border-ls-ink">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-4 py-5">
              <span aria-hidden className="w-7 shrink-0 font-ls-serif text-3xl leading-none text-ls-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-4">
                <StepExtras step={step} number={i + 1} cookName={cookName} />
                {step.from_answers.length > 0 && (
                  <ul className="src-only space-y-1.5">
                    {step.from_answers.map((a, j) => (
                      <li key={j} className="flex flex-wrap items-baseline gap-2 text-[15px] text-ls-muted">
                        <SourceBadge source={a.source} /> {a.text}
                      </li>
                    ))}
                  </ul>
                )}

              </div>
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes.length > 0 && (
        <section aria-labelledby="changes" className="src-only space-y-3">
          <h2 id="changes" className="font-ls-serif text-3xl leading-tight">
            What the app changed
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ls-muted marker:text-ls-rule">
            {recipe.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {transcript !== undefined && (
        <section aria-label="Kitchen notes">
          <Transcript text={transcript} cookName={cookName} editedAt={editedAt} />
        </section>
      )}
    </article>
    </SourcesScope>
  );
}

/** One line that explains the labels, near the top where they first appear. */
function Legend({ cookName }: { cookName?: string | null }) {
  return (
    <p className="src-only flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-ls-muted">
      <span>Where each part came from:</span>
      <SourceBadge source="cook" cookName={cookName} />
      <SourceBadge source="user_answer" />
      <SourceBadge source="suggested" />
      <SourceBadge source="food_science" />
    </p>
  );
}
