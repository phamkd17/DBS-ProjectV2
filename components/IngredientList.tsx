import type { Recipe } from "@/lib/ai/schema";
import { SourceBadge } from "./ui";

// History sentences the app appends when someone edits an ingredient.
const HISTORY = /(Changed from “[^”]*” \([^)]*\) on [^.]*\.|Renamed from “[^”]*” on [^.]*\.|Amount added on [^.]*\.|Added on [^.]*\.)/g;

export function splitNote(note: string) {
  const history = note.match(HISTORY) ?? [];
  const rest = note.replace(HISTORY, "").replace(/\s+/g, " ").trim();
  return { rest, history: history.join(" ") };
}

/**
 * Read-only ingredient rows. Labels, answer details, and edit history carry
 * .src-only, so they show only when "Show sources" is on.
 */
export function IngredientList({ ingredients, cookName }: { ingredients: Recipe["ingredients"]; cookName?: string | null }) {
  return (
    <ul className="divide-y divide-ls-border">
      {ingredients.map((ing, i) => {
        const { rest, history } = splitNote(ing.note);
        return (
          <li key={i} className="flow-root space-y-0.5 py-2 first:border-t first:border-t-ls-ink last:border-b last:border-b-ls-ink">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[17px]">
                {ing.amount ? <span className="font-medium">{ing.amount} </span> : null}
                {ing.item}
                {!ing.amount && <span className="text-ls-muted"> · amount not stated</span>}
              </p>
              <span className="src-only">
                <SourceBadge source={ing.source} cookName={cookName} />
              </span>
            </div>
            {ing.from_answers.map((a, j) => (
              <p key={j} className="src-only flex flex-wrap items-baseline gap-2 text-[15px] text-ls-muted">
                <SourceBadge source={a.source} /> {a.text}
              </p>
            ))}
            {rest && <p className="text-[15px] text-ls-muted">{rest}</p>}
            {history && <p className="src-only text-[15px] text-ls-muted">{history}</p>}
          </li>
        );
      })}
    </ul>
  );
}
