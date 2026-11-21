"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createManualRecipe } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { Button, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

type Ing = { key: string; amount: string; item: string };
type Step = { key: string; text: string; why: string; showWhy: boolean };

let n = 0;
const k = () => `r${++n}`;

const removeBtn = `grid size-11 shrink-0 cursor-pointer place-items-center text-xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error active:bg-ls-ink/[0.12] ${focusRing}`;
const addBtn = `min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`;

/** Type a recipe in yourself, in the same shape as an AI recipe: ingredients, then numbered steps with an optional "why". */
export function ManualRecipeForm() {
  const [ings, setIngs] = useState<Ing[]>(() => [
    { key: k(), amount: "", item: "" },
    { key: k(), amount: "", item: "" },
  ]);
  const [steps, setSteps] = useState<Step[]>(() => [{ key: k(), text: "", why: "", showWhy: false }]);
  const [state, action, pending] = useActionState<ActionState, FormData>(createManualRecipe, {});
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  const setIng = (key: string, p: Partial<Ing>) => setIngs((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const setStep = (key: string, p: Partial<Step>) => setSteps((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));

  return (
    <form action={action} className="space-y-8">
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify({
          ingredients: ings.map(({ amount, item }) => ({ amount, item })),
          steps: steps.map(({ text, why }) => ({ text, why })),
        })}
      />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-[17px] font-medium">
            Recipe name
          </label>
          <input
            id="title"
            name="title"
            maxLength={120}
            defaultValue={v.title}
            aria-invalid={!!err.title}
            aria-describedby={err.title ? "title-error" : undefined}
            className={fieldClass}
            placeholder="e.g. Grandma's yogurt"
          />
          {err.title && (
            <p id="title-error" className="text-[15px] text-ls-error">
              {err.title}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cook_name" className="block text-[17px] font-medium">
            Whose recipe? <span className={eyebrow}>Optional</span>
          </label>
          <input id="cook_name" name="cook_name" maxLength={60} defaultValue={v.cook_name} className={fieldClass} placeholder="e.g. Grandma" />
        </div>
      </div>

      <fieldset className="space-y-3" aria-describedby={err.ingredients ? "ing-error" : undefined}>
        <legend className="font-ls-serif text-3xl leading-tight">Ingredients</legend>
        <ul className="space-y-3">
          {ings.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <div className="col-start-1 row-start-2 max-w-48 space-y-1 sm:row-start-1 sm:max-w-none">
                <label htmlFor={`amt-${r.key}`} className={`${eyebrow} ${i === 0 ? "" : "sm:sr-only"}`}>
                  Amount<span className="sr-only"> {i + 1}</span>
                </label>
                <input id={`amt-${r.key}`} value={r.amount} maxLength={60} onChange={(e) => setIng(r.key, { amount: e.target.value })} placeholder="e.g. 1/2 gallon" className={`${fieldClass} py-2`} />
              </div>
              <div className="col-start-1 row-start-1 space-y-1 sm:col-start-2">
                <label htmlFor={`item-${r.key}`} className={`${eyebrow} ${i === 0 ? "" : "sm:sr-only"}`}>
                  Ingredient<span className="sr-only"> {i + 1}</span>
                </label>
                <input id={`item-${r.key}`} value={r.item} maxLength={120} onChange={(e) => setIng(r.key, { item: e.target.value })} placeholder="e.g. whole milk" className={`${fieldClass} py-2`} />
              </div>
              <button type="button" aria-label={`Remove ingredient ${i + 1}`} title="Remove" onClick={() => setIngs((x) => x.filter((y) => y.key !== r.key))} className={`col-start-2 row-start-1 self-end sm:col-start-3 ${removeBtn}`}>
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
        {err.ingredients && (
          <p id="ing-error" className="text-[15px] text-ls-error">
            {err.ingredients}
          </p>
        )}
        <button type="button" onClick={() => setIngs((x) => [...x, { key: k(), amount: "", item: "" }])} className={addBtn}>
          + Add ingredient
        </button>
      </fieldset>

      <fieldset className="space-y-3" aria-describedby={err.steps ? "steps-error" : undefined}>
        <legend className="font-ls-serif text-3xl leading-tight">Steps</legend>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-3">
              <span aria-hidden className="w-7 shrink-0 pt-2 font-ls-serif text-3xl leading-none text-ls-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor={`step-${s.key}`} className="sr-only">
                  Step {i + 1}
                </label>
                <textarea id={`step-${s.key}`} rows={2} value={s.text} maxLength={2000} onChange={(e) => setStep(s.key, { text: e.target.value })} placeholder={i === 0 ? "e.g. Heat the milk until it steams. Don't let it boil." : "Next step"} className={fieldClass} />
                {s.showWhy ? (
                  <div className="space-y-1">
                    <label htmlFor={`why-${s.key}`} className={eyebrow}>
                      Why it works <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <input id={`why-${s.key}`} value={s.why} maxLength={1000} onChange={(e) => setStep(s.key, { why: e.target.value })} placeholder="e.g. Boiling can scorch the milk" className={`${fieldClass} py-2`} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setStep(s.key, { showWhy: true })} className={`${addBtn} text-ls-muted`}>
                    + Why it works
                  </button>
                )}
              </div>
              <button type="button" aria-label={`Remove step ${i + 1}`} title="Remove" onClick={() => setSteps((x) => x.filter((y) => y.key !== s.key))} className={removeBtn}>
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ol>
        {err.steps && (
          <p id="steps-error" className="text-[15px] text-ls-error">
            {err.steps}
          </p>
        )}
        <button type="button" onClick={() => setSteps((x) => [...x, { key: k(), text: "", why: "", showWhy: false }])} className={addBtn}>
          + Add step
        </button>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-[17px] font-medium">
          Notes <span className={eyebrow}>Optional</span>
        </label>
        <textarea id="notes" name="notes" rows={3} maxLength={5000} defaultValue={v.notes} className={fieldClass} placeholder="e.g. Grandpa likes it more sour, so 12 hours" />
      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex flex-wrap items-center gap-3 border-t border-ls-border pt-5">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save recipe"}
        </Button>
        <Link href="/?tab=finished" className={`min-h-11 px-3 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
