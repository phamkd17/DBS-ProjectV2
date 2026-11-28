"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NewDictationForm } from "@/app/new/NewDictationForm";
import { deleteWords } from "@/app/actions";
import { ConfirmSubmit } from "./ConfirmSubmit";
import type { DictationRow } from "@/lib/types";
import Link from "next/link";
import { Button, eyebrow, KitchenNotesTip, textLink, Transcript } from "./ui";

type Props = {
  dictation: DictationRow;
  open?: boolean;
  /** Make "Add the cook's words" the page's primary action (when it's the next step). */
  addIsPrimary?: boolean;
  /** Offer "Delete their words" (off while the AI questions are open, since they need the words). */
  canDelete?: boolean;
  /** Next step (e.g. the AI panel): hidden while editing, so Save is the only main action. */
  children?: ReactNode;
};

/**
 * The "Kitchen notes" section: rough instructions, dictated or pasted, that the
 * AI turns into a recipe (first called "the cook's words"). Shows them
 * (editable in place), or, if there are none yet, a way to add them.
 */
export function DictationEditor({ dictation: d, open = false, addIsPrimary = false, canDelete = true, children }: Props) {
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
      <section aria-label={hasWords ? "Edit kitchen notes" : "Add kitchen notes"} className="space-y-4 border border-ls-ink bg-ls-surface p-5">
        <p className="text-[15px] text-ls-muted">
          {hasWords
            ? "Change anything, or clear it all to delete the notes."
            : "Dictate (tap the microphone on your keyboard) or paste rough instructions."}
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
            editedAt={d.edited_at}
            open={open}
          />
          {/* Edit first (the common action); Delete second, so it never sits above Edit when they wrap. */}
          {/* Short labels so both fit on one line; the full names are for screen readers. */}
          <div className="flex flex-wrap justify-end gap-x-1">
            <Button ref={editBtn} variant="quiet" aria-label="Edit kitchen notes" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {canDelete && (
              <form action={deleteWords.bind(null, d.id)}>
                <ConfirmSubmit variant="danger" aria-label="Delete kitchen notes" message="Delete the kitchen notes? Your inspiration and any recipe made from them stay. This can't be undone.">
                  Delete
                </ConfirmSubmit>
              </form>
            )}
          </div>
        </div>
      ) : (
        <section aria-labelledby={`words-${d.id}`} className="space-y-3 border border-dashed border-ls-border p-4">
          <h2 id={`words-${d.id}`} className={eyebrow}>
            Kitchen notes
          </h2>
          <p className="text-[15px] text-ls-muted">
            Nothing yet. Dictate or paste rough instructions, and the AI turns them into a recipe.
          </p>
          <KitchenNotesTip />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button ref={editBtn} variant={addIsPrimary ? "primary" : "secondary"} onClick={() => setEditing(true)}>
              Add kitchen notes
            </Button>
            {addIsPrimary && (
              <Link href={`/recipes/new?from=${d.id}`} className={`text-[15px] ${textLink}`}>
                or write the recipe yourself
              </Link>
            )}
          </div>
        </section>
      )}
      {children}
    </div>
  );
}
