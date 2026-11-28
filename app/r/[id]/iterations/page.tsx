import Link from "next/link";
import { notFound } from "next/navigation";
import { eyebrow, textLink } from "@/components/ui";
import { iterationHref, loadIterations } from "@/lib/iterations";
import { supabaseForUser } from "@/lib/supabase/server";
import type { RecipeRow } from "@/lib/types";

export const metadata = { title: "Iteration summary · Culinary Lab Book" };

function longDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Iteration summary (student, Nov 28): every iteration's date and notes on one page,
 * oldest first, each linking to that version of the recipe. Draft wording.
 */
export default async function IterationSummaryPage({ params }: PageProps<"/r/[id]/iterations">) {
  const { id } = await params;
  const supabase = await supabaseForUser();
  // RLS: only your own recipe and iterations come back.
  const { data: recipe } = await supabase.from("recipes").select("id, dictation_id, created_at, recipe").eq("id", id).maybeSingle<Pick<RecipeRow, "id" | "dictation_id" | "created_at" | "recipe">>();
  if (!recipe?.recipe) notFound();
  const { iterations } = await loadIterations(supabase, recipe.dictation_id, recipe.created_at);

  return (
    <main className="space-y-6">
      <p className={eyebrow}>
        <Link href={`/r/${recipe.id}`} className={textLink}>
          {recipe.recipe.title}
        </Link>
      </p>
      <h1 className="font-ls-serif text-3xl leading-tight sm:text-4xl">Iteration summary</h1>
      <ol className="border-b border-ls-ink">
        {[...iterations].reverse().map((it) => (
          <li key={it.id ?? "original"} className="space-y-1 border-t border-ls-ink py-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-ls-serif text-xl leading-tight">
                Iteration {it.number}
                <span className="ml-2 font-ls-sans text-[15px] font-normal text-ls-muted">{longDate(it.made_on)}</span>
              </h2>
              <Link href={iterationHref(recipe.id, it.id)} className={`shrink-0 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
                Open<span className="sr-only"> iteration {it.number}</span>
              </Link>
            </div>
            {it.notes ? (
              <p className="max-w-prose whitespace-pre-wrap text-base leading-relaxed">{it.notes}</p>
            ) : (
              <p className="text-[15px] text-ls-muted">No notes.</p>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
