import type { Recipe } from "@/lib/ai/schema";
import { EditableIngredients } from "./EditableIngredients";
import { EditableSteps } from "./EditableSteps";
import { SourcesScope, StepExtras } from "./RecipeExtras";
import { IngredientList, partHeading, recipeHasNotes } from "./IngredientList";
import { partsOf, runsByPart } from "@/lib/types";
import { SourceBadge, Transcript } from "./ui";
import type { ReactNode } from "react";

type Props = {
  recipe: Recipe;
  /** Omit to render the words elsewhere (e.g. the owner's editable copy). */
  transcript?: string;
  cookName?: string | null;
  editedAt?: string | null;
  /** Owner's own recipe: amounts get a pencil to edit them. Omit for read-only (shared links). */
  editableRecipeId?: string;
  /** Shown to the right of the title and ingredients (the dish photo, student Nov 28). */
  aside?: ReactNode;
  /** The page shows the "All notes" switch itself (on its breadcrumb line). */
  switchOutside?: boolean;
};

/** The finished recipe: ingredients, steps, the why labeled by source, and her words. */
export function RecipeView({ recipe, transcript, cookName, editedAt, editableRecipeId, aside, switchOutside }: Props) {
  const allParts = partsOf([...recipe.ingredients, ...recipe.steps] as { section?: string }[]);
  return (
    <SourcesScope hasNotes={recipeHasNotes(recipe)} ownSwitch={!switchOutside}>
    <article className="space-y-5">
      {/* The dish photo floats right; the title and ingredient rows wrap around it,
          and rows below it run full width (student, Nov 28). */}
      <div className="flow-root">
      {aside && <div className="float-right mb-3 ml-4 w-fit max-w-28 sm:ml-6 sm:max-w-56">{aside}</div>}
      <header className="mb-5 space-y-2">
        <h1 className="font-ls-serif text-3xl leading-tight sm:text-4xl">{recipe.title}</h1>
        <Legend cookName={cookName} />
      </header>

      {editableRecipeId ? (
        <EditableIngredients recipeId={editableRecipeId} ingredients={recipe.ingredients} cookName={cookName} allParts={allParts} />
      ) : (
        <section aria-labelledby="ingredients" className="space-y-2">
          <h2 id="ingredients" className="font-ls-serif text-2xl leading-tight">
            Ingredients
          </h2>
          <IngredientList ingredients={recipe.ingredients} cookName={cookName} />
        </section>
      )}
      </div>

      {/* "Instructions" (was "Steps"; student, Nov 28). The owner can edit them from one pencil. */}
      {editableRecipeId ? (
        <EditableSteps recipeId={editableRecipeId} steps={recipe.steps} allParts={allParts}>
        <StepsList steps={recipe.steps} cookName={cookName} />
        </EditableSteps>
      ) : (
        <section aria-labelledby="steps" className="space-y-2">
          <h2 id="steps" className="font-ls-serif text-2xl leading-tight">
            Instructions
          </h2>
        <StepsList steps={recipe.steps} cookName={cookName} />
        </section>
      )}

      {recipe.notes.length > 0 && (
        <section aria-labelledby="changes" className="src-only space-y-3">
          <h2 id="changes" className="font-ls-serif text-2xl leading-tight">
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

/** Steps in order; a part heading wherever the part changes, numbering straight through (student, Nov 28). */
function StepsList({ steps, cookName }: { steps: Recipe["steps"]; cookName?: string | null }) {
  const runs = runsByPart(steps as (Recipe["steps"][number] & { section?: string })[]);
  return (
    // Every run looks the same (student, Nov 28): a dark line above and below, light lines
    // between steps. A run with no heading that follows another shares its line (never two).
    <div>
      {runs.map((run, r) => (
        <div key={r} className={run.part ? `space-y-1.5 ${r > 0 ? "pt-6" : ""}` : ""}>
          {run.part && <h3 className={partHeading}>{run.part}</h3>}
          {/* Steps under a component are indented a little (student, Nov 28). */}
          <ol className={`divide-y divide-ls-border border-b border-ls-ink ${run.part || r === 0 ? "border-t" : ""} ${run.part ? "ml-4" : ""}`}>
            {run.items.map(({ item: step, index: i }) => (
                <li key={i} className="flex gap-3 py-2">
                  {/* The number sits on the first line of the step (compact, Nov 28). */}
                  <span aria-hidden className="w-5 shrink-0 font-ls-serif text-base leading-relaxed text-ls-muted">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
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
        </div>
      ))}
    </div>
  );
}
