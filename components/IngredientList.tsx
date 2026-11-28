import type { Recipe } from "@/lib/ai/schema";
import { SourceBadge } from "./ui";
import { groupByPart } from "@/lib/types";
import { IngredientNote } from "./RecipeExtras";

// History sentences the app appends when someone edits an ingredient.
const HISTORY = /(Changed from “[^”]*” \([^)]*\) on [^.]*\.|Renamed from “[^”]*” on [^.]*\.|Amount added on [^.]*\.|Added on [^.]*\.)/g;

/** Does this recipe have any notes for "Show all notes" to open? (Same rules as the icons.) */
export function recipeHasNotes(recipe: Recipe) {
  return (
    recipe.ingredients.some((i) => !!splitNote(i.note ?? "").rest) ||
    recipe.steps.some(
      (st) =>
        st.why.some((w) => (w.source === "cook" && w.quote?.trim()) || w.text?.trim()) ||
        st.dials.some((d) => d.setting?.trim() && d.effect?.trim()),
    )
  );
}

export function splitNote(note: string) {
  const history = note.match(HISTORY) ?? [];
  const rest = note.replace(HISTORY, "").replace(/\s+/g, " ").trim();
  return { rest, history: history.join(" ") };
}

/**
 * Read-only ingredient rows. Labels, answer details, and edit history carry
 * .src-only, so they show only when "Show sources" is on.
 */
/**
 * The heading over a component ("Caramel sauce"): bigger than its items, smaller than
 * "Ingredients"/"Instructions" (student, Nov 28: 24px > 19px > 16px items).
 */
// Medium weight in Slate (not the semibold Ink of section headings), so it reads as a sub-level (student, Nov 28).
export const partHeading = "font-ls-sans text-[19px] font-medium leading-tight text-ls-muted";

export function IngredientList({ ingredients, cookName }: { ingredients: Recipe["ingredients"]; cookName?: string | null }) {
  // Grouped under part headings when the recipe has parts (student, Nov 28).
  const groups = groupByPart(ingredients as (Recipe["ingredients"][number] & { section?: string })[]);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.part || "_"} className="space-y-1.5">
          {g.part && <h3 className={partHeading}>{g.part}</h3>}
          {/* Items under a component are indented a little (student, Nov 28). */}
          <ul className={`divide-y divide-ls-border ${g.part ? "ml-4" : ""}`}>
            {g.items.map(({ item: ing, index: i }) => {
              const { rest, history } = splitNote(ing.note);
              const line = (
                <p className="text-base">
                  {ing.amount ? <span className="font-medium">{ing.amount} </span> : null}
                  {ing.item}
                  {!ing.amount && <span className="text-ls-muted"> · amount not stated</span>}
                </p>
              );
              return (
                <li key={i} className="flow-root space-y-0.5 py-2 first:border-t first:border-t-ls-ink last:border-b last:border-b-ls-ink">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    {rest ? (
                      <IngredientNote note={rest} item={ing.item}>
                        {line}
                      </IngredientNote>
                    ) : (
                      line
                    )}
                    <span className="src-only">
                      <SourceBadge source={ing.source} cookName={cookName} />
                    </span>
                  </div>
                  {ing.from_answers.map((a, j) => (
                    <p key={j} className="src-only flex flex-wrap items-baseline gap-2 text-[15px] text-ls-muted">
                      <SourceBadge source={a.source} /> {a.text}
                    </p>
                  ))}
                  {history && <p className="src-only text-[15px] text-ls-muted">{history}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
