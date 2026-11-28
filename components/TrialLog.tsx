"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteTrial, saveTrial } from "@/app/actions";
import type { ActionState, TrialRow } from "@/lib/types";
import { PencilButton } from "./InlineEdit";
import { Button, chipClass, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

/** "2026-11-21" → "Nov 21, 2026" (no time zone shift). */
function showDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

/**
 * Iterations (issue #9; student, Nov 28): each time you make the recipe, log a trial:
 * the date, what you changed (one tap on the recipe's own adjustments), and how it
 * turned out. Trials sit side by side to compare. Draft wording, for the student to review.
 */
export function TrialLog({ dictationId, trials, adjustments }: { dictationId: string; trials: TrialRow[]; adjustments: string[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  const was = useRef<string | null>(null);
  useEffect(() => {
    if (!editing && was.current === "new") addBtn.current?.focus();
    was.current = editing;
  }, [editing]);

  return (
    <section aria-labelledby="trials" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="trials" className="font-ls-serif text-2xl leading-tight">
          Trials{trials.length > 0 && <span className="ml-2 text-base font-normal text-ls-muted">{trials.length}</span>}
        </h2>
        {editing !== "new" && (
          <button
            ref={addBtn}
            type="button"
            onClick={() => setEditing("new")}
            className={`min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
          >
            + Log a trial
          </button>
        )}
      </div>

      {trials.length === 0 && editing !== "new" && (
        <p className="text-[15px] text-ls-muted">Each time you make it, note what you changed and how it turned out.</p>
      )}

      {editing === "new" && (
        <TrialForm dictationId={dictationId} adjustments={adjustments} number={trials.length + 1} onDone={() => setEditing(null)} />
      )}

      {trials.length > 0 && (
        // Side by side to compare (scrolls sideways on phones).
        <ol aria-label="Trials, oldest first" className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:scroll-px-0 sm:grid-cols-2 sm:overflow-visible sm:px-0">
          {trials.map((t, i) =>
            editing === t.id ? (
              <li key={t.id} className="w-[85%] shrink-0 snap-start sm:col-span-2 sm:w-auto">
                <TrialForm dictationId={dictationId} adjustments={adjustments} number={i + 1} trial={t} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={t.id} className="w-[85%] shrink-0 snap-start space-y-2 border border-ls-ink bg-ls-surface p-3 sm:w-auto">
                <div className="-mt-1.5 -mr-1.5 flex items-center justify-between gap-2">
                  <p className={eyebrow}>
                    Trial {i + 1} · {showDate(t.tried_on)}
                  </p>
                  <span className="flex">
                    <PencilButton label={`Edit trial ${i + 1}`} onClick={() => setEditing(t.id)} />
                    <form
                      action={deleteTrial.bind(null, t.id)}
                      onSubmit={(e) => {
                        if (!window.confirm(`Delete trial ${i + 1}? This can't be undone.`)) e.preventDefault();
                      }}
                    >
                      <button
                        type="submit"
                        aria-label={`Delete trial ${i + 1}`}
                        title="Delete trial"
                        className={`grid size-11 cursor-pointer place-items-center text-xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error ${focusRing}`}
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </form>
                  </span>
                </div>
                {t.changed && (
                  <div>
                    <p className="text-[13px] font-medium text-ls-muted">Changed</p>
                    <p className="whitespace-pre-wrap text-[15px]">{t.changed}</p>
                  </div>
                )}
                {t.result && (
                  <div>
                    <p className="text-[13px] font-medium text-ls-muted">How it turned out</p>
                    <p className="whitespace-pre-wrap text-[15px]">{t.result}</p>
                  </div>
                )}
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}

function TrialForm({
  dictationId,
  adjustments,
  number,
  trial,
  onDone,
}: {
  dictationId: string;
  adjustments: string[];
  number: number;
  trial?: TrialRow;
  onDone: () => void;
}) {
  const [changed, setChanged] = useState(trial?.changed ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await saveTrial(dictationId, trial?.id ?? null, prev, fd);
    if (result.saved) onDone();
    return result;
  }, {});
  const err = state.fieldErrors ?? {};
  const v = state.values;
  const id = trial?.id ?? "new";

  return (
    <form
      action={action}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
      aria-label={trial ? `Edit trial ${number}` : `Log trial ${number}`}
      className="space-y-3 border border-ls-ink bg-ls-surface p-4"
    >
      <p className={eyebrow}>Trial {number}</p>
      <div className="space-y-1">
        <label htmlFor={`trial-date-${id}`} className="block text-[15px] font-medium">
          Date
        </label>
        <input
          id={`trial-date-${id}`}
          name="tried_on"
          type="date"
          defaultValue={v?.tried_on ?? trial?.tried_on ?? today()}
          aria-invalid={!!err.tried_on}
          className={`${fieldClass} w-auto py-2`}
        />
        {err.tried_on && <p className="text-[15px] text-ls-error">{err.tried_on}</p>}
      </div>
      <div className="space-y-1">
        <label htmlFor={`trial-changed-${id}`} className="block text-[15px] font-medium">
          What you changed
        </label>
        {adjustments.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Tap to add one of this recipe's adjustments">
            {adjustments.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setChanged((c) => (c.trim() ? `${c.trim()}; ${a}` : a))}
                className={`${chipClass(false)} h-8 min-h-0 text-[13px]`}
              >
                + {a}
              </button>
            ))}
          </div>
        )}
        <textarea
          id={`trial-changed-${id}`}
          name="changed"
          rows={2}
          maxLength={1000}
          autoFocus
          value={changed}
          onChange={(e) => setChanged(e.target.value)}
          aria-invalid={!!err.changed}
          aria-describedby={err.changed ? `trial-changed-${id}-error` : undefined}
          placeholder="e.g. Incubated 10 hours instead of 8; ¼ cup sugar"
          className={fieldClass}
        />
        {err.changed && (
          <p id={`trial-changed-${id}-error`} className="text-[15px] text-ls-error">
            {err.changed}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor={`trial-result-${id}`} className="block text-[15px] font-medium">
          How it turned out
        </label>
        <textarea
          id={`trial-result-${id}`}
          name="result"
          rows={3}
          maxLength={2000}
          defaultValue={v?.result ?? trial?.result ?? ""}
          placeholder="e.g. Tangier and thicker. Grandma: closer, but still not as sour."
          className={fieldClass}
        />
      </div>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex flex-wrap items-center gap-2 border-t border-ls-border pt-3">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save trial"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
