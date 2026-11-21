"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NewDictationForm } from "@/app/new/NewDictationForm";
import type { DictationRow } from "@/lib/types";
import { Button, eyebrow, SourceBadge, Transcript } from "./ui";

type Props = {
  dictation: DictationRow;
  open?: boolean;
  /** Make "Add the cook's words" the page's primary action (when it's the next step). */
  addIsPrimary?: boolean;
  /** Next step (e.g. the AI panel): hidden while editing, so Save is the only main action. */
  children?: ReactNode;
};

/**
 * The "Cook · Their words" section. Shows the words (editable in place), or, if
 * there are none yet, a way to add them. The database keeps the first version.
 */
export function DictationEditor({ dictation: d, open = false, addIsPrimary = false, children }: Props) {
  const [editing, setEditing] = useState(false);
  const editBtn = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) editBtn.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const hasWords = !!d.transcript;

  if (editing) {
    return (
      <section aria-label={hasWords ? "Edit their words" : "Add the cook's words"} className="space-y-4 border border-ls-ink bg-ls-surface p-5">
        <p className="text-[15px] text-ls-muted">
          {hasWords
            ? "The first version is always kept, so you can see the original later."
            : "Type how the cook makes it, or tap the microphone on your keyboard to dictate: the ingredients, then each step."}
        </p>
        <NewDictationForm dictation={d} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {hasWords ? (
        <div className="space-y-2">
          <Transcript
            text={d.transcript!}
            cookName={d.cook_name}
            original={d.original_transcript}
            editedAt={d.edited_at}
            open={open}
          />
          <div className="flex justify-end">
            <Button ref={editBtn} variant="quiet" onClick={() => setEditing(true)}>
              Edit their words
            </Button>
          </div>
        </div>
      ) : (
        <section aria-labelledby={`words-${d.id}`} className="space-y-3 border border-dashed border-ls-border p-5">
          <div className="flex items-center gap-3">
            <SourceBadge source="cook" cookName={d.cook_name} />
            <h2 id={`words-${d.id}`} className={eyebrow}>
              Their words
            </h2>
          </div>
          <p className="text-[15px] text-ls-muted">
            No cook&apos;s words yet. Type or dictate how they make the dish: the ingredients, then each step. The AI
            turns it into a recipe.
          </p>
          <Button ref={editBtn} variant={addIsPrimary ? "primary" : "secondary"} onClick={() => setEditing(true)}>
            Add the cook&apos;s words
          </Button>
        </section>
      )}
      {children}
    </div>
  );
}
