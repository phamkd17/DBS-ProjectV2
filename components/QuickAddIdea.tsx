"use client";

import { useActionState, useRef } from "react";
import { quickAddIdea } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { Button, fieldClass, Spinner } from "./ui";

/** Type an idea, press Enter, and it appears in the list. No separate page. */
export function QuickAddIdea() {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await quickAddIdea(prev, fd);
    if (result.saved) {
      form.current?.reset();
      input.current?.focus(); // ready for the next one
    }
    return result;
  }, {});
  const err = state.fieldErrors?.title;

  return (
    <form ref={form} action={action} className="space-y-1.5">
      <label htmlFor="quick-idea" className="sr-only">
        New idea
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id="quick-idea"
          name="title"
          maxLength={120}
          autoComplete="off"
          defaultValue={state.error ? state.values?.title : undefined}
          placeholder="What's the idea?"
          aria-invalid={!!err}
          aria-describedby={err ? "quick-idea-error" : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? <Spinner /> : "Add"}
        </Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-[15px]">
        {err ? (
          <span id="quick-idea-error" className="text-ls-error">
            {err}
          </span>
        ) : state.error ? (
          <span className="text-ls-error">{state.error}</span>
        ) : state.saved ? (
          <span className="text-ls-muted">
            <span aria-hidden className="text-ls-success">✓ </span>Added “{state.values?.added}”. Add another, or open it to add notes.
          </span>
        ) : null}
      </p>
    </form>
  );
}
