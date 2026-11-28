"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { updateSteps } from "@/app/actions";
import type { Recipe } from "@/lib/ai/schema";
import type { ActionState } from "@/lib/types";
import { PencilButton } from "./InlineEdit";
import { BulkMoveBar, PartSelect, PartsBar, RowCheck } from "./Parts";
import { Button, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

type Why = { key: string; orig: number | null; text: string };
type Dial = { key: string; orig: number | null; setting: string; effect: string };
type Row = { key: string; orig: number | null; text: string; section: string; why: Why[]; dials: Dial[] };

const removeBtn = `grid size-11 shrink-0 cursor-pointer place-items-center text-xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error active:bg-ls-ink/[0.12] ${focusRing}`;
const addBtn = `min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`;
let n = 0;
const k = () => `n${Date.now()}-${n++}`;

/**
 * The instructions, edited at once from one pencil next to the heading (student, Nov 28):
 * each step's text, and its "Why it works" (food science) and "Adjust to taste" notes.
 * `children` is the read-only list.
 */
export function EditableSteps({
  recipeId,
  steps,
  allParts = [],
  children,
}: {
  recipeId: string;
  steps: Recipe["steps"];
  /** The recipe's parts, from both ingredients and instructions (student, Nov 28). */
  allParts?: string[];
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const tick = (key: string, on: boolean) => setSel((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
  const pencil = useRef<HTMLButtonElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (!editing && was.current) pencil.current?.focus();
    was.current = editing;
  }, [editing]);

  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateSteps(recipeId, prev, fd);
    if (result.saved) setEditing(false);
    return result;
  }, {});

  const start = () => {
    setRows(
      steps.map((s, i) => ({
        key: `o${i}`,
        orig: i,
        text: s.text,
        section: (s as { section?: string }).section ?? "",
        why: s.why
          .map((w, j) => ({ key: `o${i}w${j}`, orig: j, text: w.source === "cook" && w.quote?.trim() ? w.quote : w.text }))
          .filter((w) => w.text.trim()),
        dials: s.dials.map((d, j) => ({ key: `o${i}d${j}`, orig: j, setting: d.setting, effect: d.effect })),
      })),
    );
    setParts(allParts);
    setSel(new Set());
    setEditing(true);
  };
  const patch = (key: string, p: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.key === key ? p(r) : r)));

  return (
    <section aria-labelledby="steps" className="space-y-2">
      <div className="flex items-center gap-1">
        <h2 id="steps" className="font-ls-serif text-2xl leading-tight">
          Instructions
        </h2>
        {!editing && <PencilButton ref={pencil} label="Edit instructions" onClick={start} />}
      </div>

      {!editing ? (
        children
      ) : (
        <form
          action={action}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className="space-y-4 border border-ls-ink bg-ls-surface p-4"
        >
          <p className="text-[15px] text-ls-muted">Change any step, and add why it works or how to adjust it to taste.</p>
          <input
            type="hidden"
            name="rows"
            value={JSON.stringify(
              rows.map((r) => ({
                orig: r.orig,
                text: r.text,
                section: r.section,
                why: r.why.map(({ orig, text }) => ({ orig, text })),
                dials: r.dials.map(({ orig, setting, effect }) => ({ orig, setting, effect })),
              })),
            )}
          />
          <PartsBar
            idPrefix="steps"
            parts={parts}
            onAdd={(name) => setParts((p) => [...p, name])}
            onRemove={(name) => {
              setParts((p) => p.filter((x) => x !== name));
              setRows((rs) => rs.map((x) => (x.section === name ? { ...x, section: "" } : x)));
            }}
          />
          <BulkMoveBar
            count={sel.size}
            parts={parts}
            noun="steps"
            onMove={(p) => {
              setRows((rs) => rs.map((x) => (sel.has(x.key) ? { ...x, section: p } : x)));
              setSel(new Set());
            }}
            onClear={() => setSel(new Set())}
          />
          <ol className="space-y-5">
            {rows.map((r, i) => (
              <li key={r.key} className="space-y-2 border-b border-ls-border pb-4 last:border-b-0">
                <div className="flex gap-2">
                  <RowCheck show={parts.length > 0} label={`step ${i + 1}`} checked={sel.has(r.key)} onChange={(on) => tick(r.key, on)} />
                  <span aria-hidden className="w-5 shrink-0 pt-2.5 font-ls-serif text-[17px] text-ls-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`step-${r.key}`} className="sr-only">
                      Step {i + 1}
                    </label>
                    <textarea
                      id={`step-${r.key}`}
                      rows={2}
                      value={r.text}
                      maxLength={2000}
                      autoFocus={i === 0}
                      onChange={(e) => patch(r.key, (x) => ({ ...x, text: e.target.value }))}
                      placeholder="e.g. Heat the milk until it steams."
                      className={fieldClass}
                    />
                  </div>
                  <button type="button" aria-label={`Remove step ${i + 1}`} title="Remove step" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className={removeBtn}>
                    <span aria-hidden>×</span>
                  </button>
                </div>

                <div className={`space-y-2 ${parts.length > 0 ? "pl-14" : "pl-7"}`}>
                  <PartSelect id={`spart-${r.key}`} label={`step ${i + 1}`} parts={parts} value={r.section} onChange={(v) => patch(r.key, (x) => ({ ...x, section: v }))} />
                  {r.why.map((w, j) => (
                    <div key={w.key} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <label htmlFor={`why-${w.key}`} className={eyebrow}>
                          Why it works<span className="sr-only"> (step {i + 1}, note {j + 1})</span>
                        </label>
                        <textarea
                          id={`why-${w.key}`}
                          rows={2}
                          value={w.text}
                          maxLength={1000}
                          onChange={(e) => patch(r.key, (x) => ({ ...x, why: x.why.map((y) => (y.key === w.key ? { ...y, text: e.target.value } : y)) }))}
                          placeholder="e.g. Boiling can scorch the milk."
                          className={`${fieldClass} py-2 text-[15px]`}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove why it works ${j + 1} from step ${i + 1}`}
                        title="Remove"
                        onClick={() => patch(r.key, (x) => ({ ...x, why: x.why.filter((y) => y.key !== w.key) }))}
                        className={removeBtn}
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </div>
                  ))}
                  {r.dials.map((d, j) => (
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
                          onChange={(e) => patch(r.key, (x) => ({ ...x, dials: x.dials.map((y) => (y.key === d.key ? { ...y, setting: e.target.value } : y)) }))}
                          placeholder="e.g. 12 hours"
                          className={`${fieldClass} min-w-0 flex-1 basis-32 py-2 text-[15px]`}
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
                          onChange={(e) => patch(r.key, (x) => ({ ...x, dials: x.dials.map((y) => (y.key === d.key ? { ...y, effect: e.target.value } : y)) }))}
                          placeholder="e.g. super tangy"
                          className={`${fieldClass} min-w-0 flex-1 basis-32 py-2 text-[15px]`}
                        />
                        <button
                          type="button"
                          aria-label={`Remove adjust to taste ${j + 1} from step ${i + 1}`}
                          title="Remove"
                          onClick={() => patch(r.key, (x) => ({ ...x, dials: x.dials.filter((y) => y.key !== d.key) }))}
                          className={removeBtn}
                        >
                          <span aria-hidden>×</span>
                        </button>
                      </div>
                    </fieldset>
                  ))}
                  <div className="flex flex-wrap gap-x-4">
                    <button
                      type="button"
                      onClick={() => patch(r.key, (x) => ({ ...x, why: [...x.why, { key: k(), orig: null, text: "" }] }))}
                      className={`${addBtn} text-ls-muted`}
                    >
                      + Why it works
                    </button>
                    <button
                      type="button"
                      onClick={() => patch(r.key, (x) => ({ ...x, dials: [...x.dials, { key: k(), orig: null, setting: "", effect: "" }] }))}
                      className={`${addBtn} text-ls-muted`}
                    >
                      + Adjust to taste
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setRows((rs) => [...rs, { key: k(), orig: null, text: "", section: rs[rs.length - 1]?.section ?? "", why: [], dials: [] }])} className={addBtn}>
            + Add step
          </button>
          {state.error && <ErrorNote>{state.error}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-2 border-t border-ls-border pt-4">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save instructions"}
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
