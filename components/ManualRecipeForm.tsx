"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createManualRecipe } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { Button, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";
import { BulkMoveBar, PartSelect, PartsBar, RowCheck } from "./Parts";

type Ing = { key: string; amount: string; item: string; section: string };
// Each step can have several "Why it works" notes and "Adjust to taste" pairs, like the recipe editor (student, Nov 28).
type Step = { key: string; text: string; section: string; why: { key: string; text: string }[]; dials: { key: string; setting: string; effect: string }[] };


const removeBtn = `grid size-11 shrink-0 cursor-pointer place-items-center text-xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error active:bg-ls-ink/[0.12] ${focusRing}`;
const addBtn = `min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`;

/** Type a recipe in yourself, in the same shape as an AI recipe: ingredients, then numbered steps with an optional "why". */
export function ManualRecipeForm({
  from,
}: {
  /** Writing the recipe for an existing entry (from Development): prefilled, and saved onto it. */
  from?: { id: string; title: string; cook_name: string; notes: string };
} = {}) {
  // Stable per-component ids, so server and browser render the same ids.
  const uid = useId().replace(/:/g, "");
  const next = useRef(3);
  const k = () => `${uid}-${next.current++}`;
  const [ings, setIngs] = useState<Ing[]>(() => [
    { key: `${uid}-0`, amount: "", item: "", section: "" },
    { key: `${uid}-1`, amount: "", item: "", section: "" },
  ]);
  const [steps, setSteps] = useState<Step[]>(() => [{ key: `${uid}-2`, text: "", section: "", why: [], dials: [] }]);
  // Parts of the recipe, e.g. "Caramel sauce", "Custard" (student, Nov 28).
  const [parts, setParts] = useState<string[]>([]);
  // Bulk move: tick several rows, then pick a component once (student, Nov 28).
  const [selIng, setSelIng] = useState<Set<string>>(new Set());
  const [selStep, setSelStep] = useState<Set<string>>(new Set());
  const toggle = (set: (f: (s: Set<string>) => Set<string>) => void, key: string, on: boolean) =>
    set((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  // Errors clear as soon as you edit that part, and come back only on the next Save.
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const [state, action, pending] = useActionState<ActionState, FormData>((prev, fd) => {
    setEdited({});
    return createManualRecipe(prev, fd);
  }, {});
  const v = state.values ?? (from ? { title: from.title, cook_name: from.cook_name, notes: from.notes } : {});
  const all = state.fieldErrors ?? {};
  const err = Object.fromEntries(Object.entries(all).filter(([f]) => !edited[f]));
  const touch = (f: string) => setEdited((e) => (e[f] ? e : { ...e, [f]: true }));
  const setIng = (key: string, p: Partial<Ing>) => {
    touch("ingredients");
    setIngs((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  };
  const setStep = (key: string, p: Partial<Step>) => {
    touch("steps");
    setSteps((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));
  };

  // Shortcut: Enter adds the next ingredient or step right below and moves the cursor there.
  const focusId = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId.current) return;
    document.getElementById(focusId.current)?.focus();
    focusId.current = null;
  }, [ings, steps]);
  const isEnter = (e: KeyboardEvent) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
  const nextIngredient = (e: KeyboardEvent, after: string) => {
    if (!isEnter(e)) return;
    e.preventDefault(); // don't submit the form
    const key = k();
    // The first field on screen: Ingredient on phones, Amount on wider screens.
    focusId.current = `${window.matchMedia("(min-width: 40rem)").matches ? "amt" : "item"}-${key}`;
    setIngs((r) => {
      const i = r.findIndex((x) => x.key === after);
      return [...r.slice(0, i + 1), { key, amount: "", item: "", section: r[i]?.section ?? "" }, ...r.slice(i + 1)]; // same part as the row above
    });
  };
  const nextStep = (e: KeyboardEvent, after: string) => {
    if (!isEnter(e)) return;
    e.preventDefault(); // Shift+Enter still starts a new line
    const key = k();
    focusId.current = `step-${key}`;
    setSteps((r) => {
      const i = r.findIndex((x) => x.key === after);
      return [...r.slice(0, i + 1), { key, text: "", section: r[i]?.section ?? "", why: [], dials: [] }, ...r.slice(i + 1)];
    });
  };

  return (
    <form action={action} className="space-y-8">
      {from && <input type="hidden" name="dictation_id" value={from.id} />}
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify({
          ingredients: ings.map(({ amount, item, section }) => ({ amount, item, section })),
          steps: steps.map(({ text, section, why, dials }) => ({ text, section, why: why.map((w) => w.text), dials: dials.map(({ setting, effect }) => ({ setting, effect })) })),
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
            onChange={() => touch("title")}
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

      <PartsBar
        idPrefix="manual"
        parts={parts}
        onAdd={(name) => setParts((p) => [...p, name])}
        onRemove={(name) => {
          setParts((p) => p.filter((x) => x !== name));
          setIngs((r) => r.map((x) => (x.section === name ? { ...x, section: "" } : x)));
          setSteps((r) => r.map((x) => (x.section === name ? { ...x, section: "" } : x)));
        }}
      />

      <fieldset className="space-y-3" aria-describedby={err.ingredients ? "ing-error" : undefined}>
        <legend className="font-ls-serif text-3xl leading-tight">Ingredients</legend>
        <p className="text-[15px] text-ls-muted">Press Enter for the next ingredient.</p>
        <BulkMoveBar
          count={selIng.size}
          parts={parts}
          noun="ingredients"
          onMove={(p) => {
            setIngs((r) => r.map((x) => (selIng.has(x.key) ? { ...x, section: p } : x)));
            setSelIng(new Set());
          }}
          onClear={() => setSelIng(new Set())}
        />
        <ul className="space-y-3">
          {ings.map((r, i) => (
            <li key={r.key} className="flex gap-1">
              <RowCheck show={parts.length > 0} label={`ingredient ${i + 1}`} checked={selIng.has(r.key)} onChange={(on) => toggle(setSelIng, r.key, on)} />
              <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <div className="col-start-1 row-start-2 max-w-48 space-y-1 sm:row-start-1 sm:max-w-none">
                <label htmlFor={`amt-${r.key}`} className={`${eyebrow} ${i === 0 ? "" : "sm:sr-only"}`}>
                  Amount<span className="sr-only"> {i + 1}</span>
                </label>
                <input id={`amt-${r.key}`} value={r.amount} maxLength={60} onChange={(e) => setIng(r.key, { amount: e.target.value })} onKeyDown={(e) => nextIngredient(e, r.key)} placeholder="e.g. 1/2 gallon" className={`${fieldClass} py-2`} />
              </div>
              <div className="col-start-1 row-start-1 space-y-1 sm:col-start-2">
                <label htmlFor={`item-${r.key}`} className={`${eyebrow} ${i === 0 ? "" : "sm:sr-only"}`}>
                  Ingredient<span className="sr-only"> {i + 1}</span>
                </label>
                <input id={`item-${r.key}`} value={r.item} maxLength={120} onChange={(e) => setIng(r.key, { item: e.target.value })} onKeyDown={(e) => nextIngredient(e, r.key)} placeholder="e.g. whole milk" className={`${fieldClass} py-2`} />
              </div>
              <button type="button" aria-label={`Remove ingredient ${i + 1}`} title="Remove" onClick={() => setIngs((x) => x.filter((y) => y.key !== r.key))} className={`col-start-2 row-start-1 self-end sm:col-start-3 ${removeBtn}`}>
                <span aria-hidden>×</span>
              </button>
              <div className="col-span-full">
                <PartSelect id={`ipart-${r.key}`} label={`ingredient ${i + 1}`} parts={parts} value={r.section} onChange={(v) => setIng(r.key, { section: v })} />
              </div>
              </div>
            </li>
          ))}
        </ul>
        {err.ingredients && (
          <p id="ing-error" className="text-[15px] text-ls-error">
            {err.ingredients}
          </p>
        )}
        <button type="button" onClick={() => setIngs((x) => [...x, { key: k(), amount: "", item: "", section: x[x.length - 1]?.section ?? "" }])} className={addBtn}>
          + Add ingredient
        </button>
      </fieldset>

      <fieldset className="space-y-3" aria-describedby={err.steps ? "steps-error" : undefined}>
        <legend className="font-ls-serif text-3xl leading-tight">Instructions</legend>
        <p className="text-[15px] text-ls-muted">Press Enter for the next step, Shift+Enter for a new line.</p>
        <BulkMoveBar
          count={selStep.size}
          parts={parts}
          noun="steps"
          onMove={(p) => {
            setSteps((r) => r.map((x) => (selStep.has(x.key) ? { ...x, section: p } : x)));
            setSelStep(new Set());
          }}
          onClear={() => setSelStep(new Set())}
        />
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-3">
              <RowCheck show={parts.length > 0} label={`step ${i + 1}`} checked={selStep.has(s.key)} onChange={(on) => toggle(setSelStep, s.key, on)} />
              <span aria-hidden className="w-7 shrink-0 pt-2 font-ls-serif text-3xl leading-none text-ls-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor={`step-${s.key}`} className="sr-only">
                  Step {i + 1}
                </label>
                <textarea id={`step-${s.key}`} rows={2} value={s.text} maxLength={2000} onChange={(e) => setStep(s.key, { text: e.target.value })} onKeyDown={(e) => nextStep(e, s.key)} placeholder={i === 0 ? "e.g. Heat the milk until it steams. Don't let it boil." : "Next step"} className={fieldClass} />
                <PartSelect id={`spart-${s.key}`} label={`step ${i + 1}`} parts={parts} value={s.section} onChange={(v) => setStep(s.key, { section: v })} />
                {s.why.map((w, j) => (
                  <div key={w.key} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <label htmlFor={`why-${w.key}`} className={eyebrow}>
                        Why it works<span className="sr-only"> (step {i + 1}, note {j + 1})</span>
                      </label>
                      <input
                        id={`why-${w.key}`}
                        value={w.text}
                        maxLength={1000}
                        autoFocus={!w.text}
                        onChange={(e) => setStep(s.key, { why: s.why.map((y) => (y.key === w.key ? { ...y, text: e.target.value } : y)) })}
                        placeholder="e.g. Boiling can scorch the milk"
                        className={`${fieldClass} py-2`}
                      />
                    </div>
                    <button type="button" aria-label={`Remove why it works ${j + 1} from step ${i + 1}`} title="Remove" onClick={() => setStep(s.key, { why: s.why.filter((y) => y.key !== w.key) })} className={removeBtn}>
                      <span aria-hidden>×</span>
                    </button>
                  </div>
                ))}
                {s.dials.map((d, j) => (
                  <fieldset key={d.key} className="space-y-1">
                    <legend className={eyebrow}>
                      Adjust to taste<span className="sr-only"> (step {i + 1}, {j + 1})</span>
                    </legend>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`set-${d.key}`} className="sr-only">
                        If you
                      </label>
                      <input
                        id={`set-${d.key}`}
                        value={d.setting}
                        maxLength={120}
                        autoFocus={!d.setting && !d.effect}
                        onChange={(e) => setStep(s.key, { dials: s.dials.map((y) => (y.key === d.key ? { ...y, setting: e.target.value } : y)) })}
                        placeholder="e.g. 12 hours"
                        className={`${fieldClass} min-w-0 flex-1 basis-32 py-2`}
                      />
                      <span aria-hidden className="text-ls-muted">
                        →
                      </span>
                      <label htmlFor={`eff-${d.key}`} className="sr-only">
                        It comes out
                      </label>
                      <input
                        id={`eff-${d.key}`}
                        value={d.effect}
                        maxLength={200}
                        onChange={(e) => setStep(s.key, { dials: s.dials.map((y) => (y.key === d.key ? { ...y, effect: e.target.value } : y)) })}
                        placeholder="e.g. super tangy"
                        className={`${fieldClass} min-w-0 flex-1 basis-32 py-2`}
                      />
                      <button type="button" aria-label={`Remove adjust to taste ${j + 1} from step ${i + 1}`} title="Remove" onClick={() => setStep(s.key, { dials: s.dials.filter((y) => y.key !== d.key) })} className={removeBtn}>
                        <span aria-hidden>×</span>
                      </button>
                    </div>
                  </fieldset>
                ))}
                <div className="flex flex-wrap gap-x-4">
                  <button type="button" onClick={() => setStep(s.key, { why: [...s.why, { key: k(), text: "" }] })} className={`${addBtn} text-ls-muted`}>
                    + Why it works
                  </button>
                  <button type="button" onClick={() => setStep(s.key, { dials: [...s.dials, { key: k(), setting: "", effect: "" }] })} className={`${addBtn} text-ls-muted`}>
                    + Adjust to taste
                  </button>
                </div>
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
        <button type="button" onClick={() => setSteps((x) => [...x, { key: k(), text: "", section: x[x.length - 1]?.section ?? "", why: [], dials: [] }])} className={addBtn}>
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
        <Link href={from ? `/d/${from.id}` : "/?tab=finished"} className={`min-h-11 px-3 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
