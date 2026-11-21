"use client";

import { useActionState, useState } from "react";
import { createRecipe } from "@/app/actions";
import { AiBadge, Button, ErrorNote } from "@/components/ui";
import { Working } from "@/components/Working";
import type { ActionState } from "@/lib/types";

/**
 * The AI step. Marked clearly, and only enabled after the user confirms the
 * words are complete, so the model (and the free-tier quota) is used on purpose.
 * Draft wording: for the student to review.
 */
export function CreateRecipe({ dictationId }: { dictationId: string }) {
  const [state, action, pending] = useActionState<ActionState>(createRecipe.bind(null, dictationId), {});
  const [ready, setReady] = useState(false);

  if (pending) {
    return (
      <Working
        messages={[
          "Reading their words…",
          "Writing a first draft…",
          "Looking for anything a new cook couldn't figure out…",
          "Almost done…",
        ]}
      />
    );
  }

  return (
    <form action={action} aria-labelledby="ai-step" className="space-y-4 border border-ls-ink bg-ls-surface p-5">
      <AiBadge />
      <h2 id="ai-step" className="font-ls-serif text-3xl leading-tight">
        Ready to make it a recipe?
      </h2>
      <p className="max-w-prose text-[15px] leading-relaxed text-ls-muted">
        The AI drafts the recipe and asks about anything missing. About 30 seconds.
      </p>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[17px]">
        <input
          type="checkbox"
          checked={ready}
          onChange={(e) => setReady(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-ls-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-ink"
        />
        Their words are complete. I&apos;m ready.
      </label>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="space-y-2">
        <Button type="submit" disabled={!ready} aria-describedby="ai-step-hint" className="w-full sm:w-auto">
          {state.error ? "Try again with AI" : "Create recipe with AI"}
        </Button>
        <p id="ai-step-hint" className="text-[15px] text-ls-muted">
          {ready ? "Uses one AI request." : "Tick the box above when you're ready."}
        </p>
      </div>
    </form>
  );
}
