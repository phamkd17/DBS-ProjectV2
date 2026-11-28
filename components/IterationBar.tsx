"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createIteration, deleteIteration, saveIterationNotes } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { PencilButton } from "./InlineEdit";
import { Button, chipClass, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

export type Iteration = { id: string | null; number: number; made_on: string; notes: string };

/** "2026-11-21" → "Nov 21" (no time zone shift). */
function shortDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function longDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Iterations (issue #9; student, Nov 28): versions of the recipe. Tap one to see that
 * version; "+ New iteration" copies the one you're looking at (then edit it with the
 * pencils). Each iteration has its date and the cook's own notes. Draft wording.
 */
export function IterationBar({ recipeId, iterations, current }: { recipeId: string; iterations: Iteration[]; current: Iteration }) {
  const [editing, setEditing] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (!editing && was.current) pencil.current?.focus();
    was.current = editing;
  }, [editing]);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await saveIterationNotes(recipeId, current.id, prev, fd);
    if (r.saved) setEditing(false);
    return r;
  }, {});
  const err = state.fieldErrors ?? {};

  return (
    <section aria-labelledby="iterations-heading" className="space-y-2">
      <h2 id="iterations-heading" className={eyebrow}>
        Iterations
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Iterations of this recipe" className="contents">
          {iterations.map((it) => (
            <Link
              key={it.id ?? "original"}
              href={it.id ? `/r/${recipeId}?it=${it.id}` : `/r/${recipeId}`}
              aria-current={it.number === current.number ? "page" : undefined}
              className={`${chipClass(it.number === current.number)} text-[14px]`}
            >
              {it.number} · {shortDate(it.made_on)}
            </Link>
          ))}
        </nav>
        <form action={createIteration.bind(null, recipeId, current.id)}>
          <NewIterationButton />
        </form>
      </div>

      <div className="border-l border-ls-rule pl-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-medium">
            Iteration {current.number} · {longDate(current.made_on)}
          </p>
          {!editing && (
            <span className="-my-2 flex items-center">
              <PencilButton ref={pencil} label={`Edit iteration ${current.number} notes`} onClick={() => setEditing(true)} />
              {current.id && (
                <form
                  action={deleteIteration.bind(null, recipeId, current.id)}
                  onSubmit={(e) => {
                    if (!window.confirm(`Delete iteration ${current.number} and its recipe changes? This can't be undone.`)) e.preventDefault();
                  }}
                >
                  <button
                    type="submit"
                    aria-label={`Delete iteration ${current.number}`}
                    title="Delete iteration"
                    className={`grid size-11 cursor-pointer place-items-center text-xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-error ${focusRing}`}
                  >
                    <span aria-hidden>×</span>
                  </button>
                </form>
              )}
            </span>
          )}
        </div>
        {editing ? (
          <form
            action={action}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            className="space-y-3 pt-2"
          >
            <div className="space-y-1">
              <label htmlFor="it-date" className="block text-[15px] font-medium">
                Date
              </label>
              <input id="it-date" name="made_on" type="date" defaultValue={state.values?.made_on ?? current.made_on} aria-invalid={!!err.made_on} className={`${fieldClass} w-auto py-2`} />
              {err.made_on && <p className="text-[15px] text-ls-error">{err.made_on}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="it-notes" className="block text-[15px] font-medium">
                Iteration notes
              </label>
              <textarea
                id="it-notes"
                name="notes"
                rows={4}
                maxLength={5000}
                autoFocus
                defaultValue={state.values?.notes ?? current.notes}
                placeholder="e.g. Fully covered the jars in the water bath. Silky, no bubbles."
                className={fieldClass}
              />
            </div>
            {state.error && <ErrorNote>{state.error}</ErrorNote>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                {pending ? "Saving…" : "Save notes"}
              </Button>
              <button type="button" onClick={() => setEditing(false)} className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
                Cancel
              </button>
            </div>
          </form>
        ) : current.notes ? (
          <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed">{current.notes}</p>
        ) : (
          <p className="text-[15px] text-ls-muted">No notes yet. Tap the pencil to add them.</p>
        )}
      </div>
    </section>
  );
}

function NewIterationButton() {
  return (
    <button
      type="submit"
      className={`inline-flex min-h-11 cursor-pointer items-center border border-dashed border-ls-ink/50 px-3 font-ls-sans text-[14px] text-ls-ink hover:border-ls-ink hover:bg-ls-surface ${focusRing}`}
    >
      + New iteration
    </button>
  );
}
