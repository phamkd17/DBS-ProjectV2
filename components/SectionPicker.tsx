"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addSection, setInSection } from "@/app/actions";
import type { ActionState, SectionRow } from "@/lib/types";
import { Button, chipClass, eyebrow, fieldClass, Spinner, textLink } from "./ui";

/** On a recipe: tap the sections it belongs in (several allowed), or make a new one. */
export function SectionPicker({
  dictationId,
  sections,
  selected,
}: {
  dictationId: string;
  sections: SectionRow[];
  selected: string[];
}) {
  const [on, setOn] = useOptimistic(selected, (cur: string[], { id, value }: { id: string; value: boolean }) =>
    value ? [...cur, id] : cur.filter((x) => x !== id),
  );
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const toggle = (id: string) => {
    const value = !on.includes(id);
    setFailed(false);
    start(async () => {
      setOn({ id, value });
      const { ok } = await setInSection(dictationId, id, value);
      if (!ok) setFailed(true);
    });
  };

  return (
    <section aria-labelledby="sections-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="sections-heading" className={eyebrow}>
          Sections
        </h2>
        {sections.length > 0 && (
          <Link href="/sections" className={`font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
            Edit sections
          </Link>
        )}
      </div>
      {sections.length === 0 && (
        <p className="text-[15px] text-ls-muted">Sort your recipes into sections, like Mexican or Desserts.</p>
      )}
      {sections.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tap to add or remove">
          {sections.map((s) => {
            const isOn = on.includes(s.id);
            return (
              <li key={s.id}>
                <button type="button" aria-pressed={isOn} onClick={() => toggle(s.id)} className={chipClass(isOn)}>
                  {isOn && <span aria-hidden>✓</span>}
                  {s.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {failed && (
        <p role="alert" className="text-[15px] text-ls-error">
          Couldn&apos;t save that. Try again.
        </p>
      )}
      <NewSection dictationId={dictationId} startOpen={sections.length === 0} />
    </section>
  );
}

/** "+ New section": type a name, Enter. It's added and this recipe goes in it. */
function NewSection({ dictationId, startOpen }: { dictationId: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const input = useRef<HTMLInputElement>(null);
  const opened = useRef(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await addSection(prev, fd);
    if (result.saved) setOpen(false);
    return result;
  }, {});
  useEffect(() => {
    if (open && opened.current) input.current?.focus();
  }, [open]);
  const err = state.fieldErrors?.name ?? state.error;

  if (!open)
    return (
      <div className="flex flex-wrap items-baseline gap-x-3">
        <button
          type="button"
          onClick={() => {
            opened.current = true;
            setOpen(true);
          }}
          className={`min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
        >
          + New section
        </button>
        {state.saved && (
          <p aria-live="polite" className="text-[15px] text-ls-muted">
            <span aria-hidden className="text-ls-success">✓ </span>Added to “{state.values?.added}”.
          </p>
        )}
      </div>
    );

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="attach" value={dictationId} />
      <label htmlFor="new-section" className="block text-[15px] font-medium">
        New section
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id="new-section"
          name="name"
          maxLength={40}
          autoComplete="off"
          defaultValue={state.values?.name}
          placeholder="e.g. Desserts"
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={err ? "new-section-error" : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? <Spinner /> : "Add"}
        </Button>
      </div>
      {err && (
        <p id="new-section-error" className="text-[15px] text-ls-error">
          {err}
        </p>
      )}
    </form>
  );
}
