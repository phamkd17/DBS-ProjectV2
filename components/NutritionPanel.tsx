"use client";

import { useActionState } from "react";
import { estimateRecipeNutrition } from "@/app/actions";
import type { Nutrition } from "@/lib/ai/nutrition";
import type { Per100g } from "@/lib/ai/usda";
import { AiBadge, Button, Chevron, eyebrow, focusRing, formatDate, SourceBadge, Spinner, textLink } from "@/components/ui";

// Draft wording throughout: for the student to review.
const STATS: { key: keyof Per100g; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "" },
  { key: "protein_g", label: "Protein", unit: " g" },
  { key: "fat_g", label: "Fat", unit: " g" },
  { key: "carbs_g", label: "Carbs", unit: " g" },
  { key: "sugar_g", label: "Sugar", unit: " g" },
  { key: "sodium_mg", label: "Sodium", unit: " mg" },
];

const fmt = (n: number, key: keyof Per100g) =>
  key === "kcal" || key === "sodium_mg" || n >= 10 ? Math.round(n).toLocaleString() : (Math.round(n * 10) / 10).toString();

/**
 * Nutrition (issue #14): folded into one row like the notes below it, with the
 * calories a serving showing even when closed. The estimate is the AI's food
 * matching (tool calls to USDA) + the app's math; every match is listed.
 */
export function NutritionPanel({
  recipeId,
  iterationId,
  nutrition,
  stale,
}: {
  recipeId: string;
  iterationId: string | null;
  nutrition: Nutrition | null;
  stale: boolean;
}) {
  const [state, action, pending] = useActionState(estimateRecipeNutrition.bind(null, recipeId, iterationId), {});
  const per = nutrition?.servings ?? 1;
  const perServing = (k: keyof Per100g) => (nutrition ? nutrition.total[k] / per : 0);

  const estimateButton = (label: string, variant: "secondary" | "quiet") => (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button variant={variant} disabled={pending} aria-busy={pending} className={variant === "secondary" ? "min-h-10 px-4" : "-ml-3"}>
        {pending && <Spinner />} {pending ? "Estimating… about 30 seconds" : label}
      </Button>
      {variant === "secondary" && !pending && <AiBadge />}
      {state.error && (
        <p role="alert" className="w-full text-[15px] text-ls-error">
          {state.error}
        </p>
      )}
    </form>
  );

  return (
    <details className="group border-t border-ls-ink">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}
      >
        Nutrition
        <span className="flex items-center gap-3 text-ls-ink">
          {nutrition && (
            <span className="normal-case tracking-normal text-[15px] font-normal text-ls-muted">
              ≈ {fmt(perServing("kcal"), "kcal")} kcal {nutrition.servings ? "a serving" : "in all"}
            </span>
          )}
          <span aria-hidden className="flex items-center gap-1.5">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
            <Chevron className="group-open:rotate-180" />
          </span>
        </span>
      </summary>

      <div className="space-y-4 pt-1 pb-5">
        {!nutrition ? (
          <>
            <p className="text-[15px] text-ls-muted">Estimate calories and nutrients from the USDA food database.</p>
            {estimateButton("Estimate nutrition", "secondary")}
          </>
        ) : (
          <>
            {stale && (
              <p role="note" className="border-l-2 border-ls-ink bg-ls-surface px-4 py-2 text-[15px]">
                The ingredients changed after this estimate.
              </p>
            )}
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-[15px]">
                {nutrition.servings ? (
                  <>
                    Per serving · makes {nutrition.servings}
                    {nutrition.servings_source === "suggested" && <SourceBadge source="suggested" />}
                  </>
                ) : (
                  "Whole recipe"
                )}
              </p>
              <dl className="grid grid-cols-3 border-t border-l border-ls-border sm:grid-cols-6">
                {STATS.map((s) => (
                  <div key={s.key} className="border-r border-b border-ls-border px-3 py-2">
                    <dt className={eyebrow}>{s.label}</dt>
                    <dd className="text-xl tabular-nums">
                      {fmt(perServing(s.key), s.key)}
                      <span className="text-[15px] text-ls-muted">{s.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {nutrition.servings && (
                <p className="text-[15px] text-ls-muted">Whole recipe: {fmt(nutrition.total.kcal, "kcal")} kcal</p>
              )}
            </div>

            <details className="group/how border border-ls-border bg-ls-surface">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-[15px] hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}>
                How it was counted
                <Chevron className="group-open/how:rotate-180" />
              </summary>
              <ul className="divide-y divide-ls-border border-t border-ls-border px-4">
                {nutrition.items.map((i, n) => (
                  <li key={n} className="space-y-0.5 py-2.5 text-[15px]">
                    <p className="flex justify-between gap-3">
                      <span>{i.ingredient}</span>
                      <span className="shrink-0 tabular-nums">
                        {i.grams.toLocaleString()} g · {fmt(i.kcal, "kcal")} kcal
                      </span>
                    </p>
                    <p className="text-[13px] leading-snug text-ls-muted">
                      USDA:{" "}
                      <a
                        href={`https://fdc.nal.usda.gov/food-details/${i.fdc_id}/nutrients`}
                        target="_blank"
                        rel="noreferrer"
                        className={textLink}
                      >
                        {i.food}
                      </a>{" "}
                      · {i.grams_basis}
                    </p>
                  </li>
                ))}
                {nutrition.skipped.length > 0 && (
                  <li className="py-2.5 text-[15px] text-ls-muted">
                    Not counted: {nutrition.skipped.map((s) => `${s.ingredient} (${s.reason})`).join(", ")}
                  </li>
                )}
              </ul>
            </details>

            <p className="text-[13px] leading-snug text-ls-muted">
              An estimate: AI matched each ingredient to a USDA food and its weight; the app added up USDA&apos;s numbers.{" "}
              {formatDate(nutrition.made_at)}.
            </p>
            {estimateButton("Estimate again", "quiet")}
          </>
        )}
      </div>
    </details>
  );
}
