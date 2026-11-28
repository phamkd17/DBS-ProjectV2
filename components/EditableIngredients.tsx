"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateIngredients } from "@/app/actions";
import type { Recipe } from "@/lib/ai/schema";
import type { ActionState } from "@/lib/types";
import { IngredientList } from "./IngredientList";
import { PencilButton } from "./InlineEdit";
import { Button, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

type Row = { key: string; orig: number | null; amount: string; item: string };

/** The whole ingredient list, edited at once from one pencil next to the heading. */
export function EditableIngredients({
  recipeId,
  ingredients,
  cookName,
}: {
  recipeId: string;
  ingredients: Recipe["ingredients"];
  cookName?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const pencil = useRef<HTMLButtonElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (!editing && was.current) pencil.current?.focus();
    was.current = editing;
  }, [editing]);

  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateIngredients(recipeId, cookName ?? "", prev, fd);
    if (result.saved) setEditing(false);
    return result;
  }, {});

  const start = () => {
    setRows(ingredients.map((x, i) => ({ key: `o${i}`, orig: i, amount: x.amount, item: x.item })));
    setEditing(true);
  };
  const update = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <section aria-labelledby="ingredients" className="space-y-2">
      <div className="flex items-center gap-1">
        <h2 id="ingredients" className="font-ls-serif text-2xl leading-tight">
          Ingredients
        </h2>
        {!editing && <PencilButton ref={pencil} label="Edit ingredients" onClick={start} />}
      </div>

      {!editing ? (
        <IngredientList ingredients={ingredients} cookName={cookName} />
      ) : (
        <form
          action={action}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className="space-y-4 border border-ls-ink bg-ls-surface p-4"
        >
          <p className="text-[15px] text-ls-muted">
            Changes are labeled <span className="font-medium text-ls-ink">Family answer</span>, and the old amounts
            are kept in each ingredient&apos;s note.
          </p>
          <input type="hidden" name="rows" value={JSON.stringify(rows.map(({ orig, amount, item }) => ({ orig, amount, item })))} />
          <ul className="space-y-3">
            {rows.map((r, n) => (
              // Phones: name full width with the amount under it. Wider: amount | name | remove.
              <li
                key={r.key}
                className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 border-b border-ls-border pb-3 last:border-b-0 sm:grid-cols-[10rem_1fr_auto] sm:items-end sm:border-b-0 sm:pb-0"
              >
                <div className="col-start-1 row-start-2 max-w-48 space-y-1 sm:row-start-1 sm:max-w-none">
                  <label htmlFor={`amt-${r.key}`} className={`${eyebrow} ${n === 0 ? "" : "sm:sr-only"}`}>
                    Amount<span className="sr-only"> of {r.item || "new ingredient"}</span>
                  </label>
                  <input
                    id={`amt-${r.key}`}
                    value={r.amount}
                    maxLength={60}
                    onChange={(e) => update(r.key, { amount: e.target.value })}
                    placeholder="e.g. 1/4 cup"
                    className={`${fieldClass} py-2`}
                  />
                </div>
                <div className="col-start-1 row-start-1 space-y-1 sm:col-start-2">
                  <label htmlFor={`item-${r.key}`} className={`${eyebrow} ${n === 0 ? "" : "sm:sr-only"}`}>
                    Ingredient<span className="sr-only"> {n + 1}</span>
                  </label>
                  <input
                    id={`item-${r.key}`}
                    value={r.item}
                    maxLength={120}
                    autoFocus={n === 0}
                    onChange={(e) => update(r.key, { item: e.target.value })}
                    placeholder="e.g. sugar"
                    className={`${fieldClass} py-2`}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${r.item || "this ingredient"}`}
                  title="Remove"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className={`col-start-2 row-start-1 grid size-11 cursor-pointer place-items-center self-end text-xl sm:col-start-3 text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error active:bg-ls-ink/[0.12] ${focusRing}`}
                >
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { key: `n${Date.now()}`, orig: null, amount: "", item: "" }])}
            className={`min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
          >
            + Add ingredient
          </button>
          {state.error && <ErrorNote>{state.error}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-2 border-t border-ls-border pt-4">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save ingredients"}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
