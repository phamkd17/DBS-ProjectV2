"use client";

import { useActionState, useRef } from "react";
import { addSection } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { Button, fieldClass, Spinner } from "./ui";

/** Type a section name, Enter. Ready for the next one right away. */
export function AddSectionForm() {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await addSection(prev, fd);
    if (result.saved) {
      form.current?.reset();
      input.current?.focus();
    }
    return result;
  }, {});
  const err = state.fieldErrors?.name ?? state.error;

  return (
    <form ref={form} action={action} className="space-y-1.5">
      <label htmlFor="section-name" className="block text-[17px] font-medium">
        New section
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id="section-name"
          name="name"
          maxLength={40}
          autoComplete="off"
          defaultValue={state.saved ? undefined : state.values?.name}
          placeholder="e.g. Desserts"
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={err ? "section-name-error" : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? <Spinner /> : "Add"}
        </Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-[15px]">
        {err ? (
          <span id="section-name-error" className="text-ls-error">
            {err}
          </span>
        ) : state.saved ? (
          <span className="text-ls-muted">
            <span aria-hidden className="text-ls-success">✓ </span>Added “{state.values?.added}”.
          </span>
        ) : null}
      </p>
    </form>
  );
}
