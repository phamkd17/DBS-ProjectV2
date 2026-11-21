"use client";

import { useTransition } from "react";
import { moveItem } from "@/app/actions";
import { AiBadge, Button, Spinner } from "./ui";

/**
 * Shown instead of the AI step when a dictation isn't in Development.
 * The AI recipe step only lives in Development (student's rule, Nov 15).
 * Draft wording: for the student to review.
 */
export function StartDeveloping({ dictationId, primary = true }: { dictationId: string; primary?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="start-dev" className="space-y-4 border border-ls-border bg-ls-surface p-5">
      <AiBadge>AI recipe step</AiBadge>
      <h2 id="start-dev" className="font-ls-serif text-3xl leading-tight">
        Ready to develop it?
      </h2>
      <p className="text-[15px] text-ls-muted">Add the cook&apos;s words there, then make the recipe.</p>
      {/* Secondary right after saving, so "Add another idea" stays the one primary action. */}
      <Button
        variant={primary ? "primary" : "secondary"}
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("stage", "development");
          start(() => moveItem("dictation", dictationId, fd));
        }}
        className="w-full sm:w-auto"
      >
        {pending && <Spinner />}
        {pending ? "Moving…" : "Move to Development"}
      </Button>
    </section>
  );
}
