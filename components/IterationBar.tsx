"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createIteration, deleteIteration, saveIterationNotes } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { PencilButton } from "./InlineEdit";
import { Button, Chevron, chipClass, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

import type { Iteration } from "@/lib/iterations";
export type { Iteration };

const href = (recipeId: string, id: string | null) => (id ? `/r/${recipeId}?it=${id}` : `/r/${recipeId}?it=original`);

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
 * Iterations (issue #9; student, Nov 28): versions of the recipe, in place of the
 * breadcrumb. Mostly hidden: one line ("Iteration 2 · Nov 28 ▾") until tapped. Open, it
 * lists every iteration, "+ New iteration" (copies the one you're viewing; then edit it
 * with the pencils), this iteration's date and notes, and the Iteration summary.
 * Draft wording, for the student to review.
 */
export function IterationBar({
  recipeId,
  iterations,
  current,
  right,
}: {
  recipeId: string;
  iterations: Iteration[];
  current: Iteration;
  /** Shown at the right of the top line (the "All notes" switch). */
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
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
    <section aria-label="Iterations" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          // Outlined like a dropdown, with a clear chevron, so it reads as a control (student, Nov 28).
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border border-ls-ink/40 bg-ls-surface px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-ink transition-colors hover:border-ls-ink hover:bg-white active:bg-ls-ink/[0.08] ${focusRing}`}
        >
          Iteration {current.number}
          <span className="text-ls-muted">· {shortDate(current.made_on)}</span>
          <Chevron className={open ? "rotate-180" : ""} />
        </button>
        {right}
      </div>
      <div id={panelId} hidden={!open} className="space-y-2 border-b border-ls-border pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Iterations of this recipe" className="contents">
          {iterations.map((it) => (
            <Link
              key={it.id ?? "original"}
              href={href(recipeId, it.id)}
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
        <Link href={`/r/${recipeId}/iterations`} className={`ml-auto min-h-11 px-1 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
          Iteration summary
        </Link>
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
