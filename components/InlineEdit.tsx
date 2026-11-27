"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { renameItem, updateNotes } from "@/app/actions";
import type { ActionState } from "@/lib/types";
import { Button, ErrorNote, eyebrow, fieldClass, focusRing, Spinner, textLink } from "./ui";

type Kind = "idea" | "dictation";

/** A small pencil button. 44px tap target, visible focus, hover and press states. */
export function PencilButton({ label, onClick, ref }: { label: string; onClick: () => void; ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-grid size-11 shrink-0 cursor-pointer place-items-center text-ls-muted transition-colors hover:bg-ls-ink/[0.06] hover:text-ls-ink active:bg-ls-ink/[0.12] ${focusRing}`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]">
        <path
          d="M13.6 3.2a1.6 1.6 0 0 1 2.3 0l.9.9a1.6 1.6 0 0 1 0 2.3L7.4 15.8 3.5 16.5l.7-3.9z M12.2 4.6l3.2 3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Return focus to the pencil after Save or Cancel. */
function useReturnFocus(editing: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  const was = useRef(false);
  useEffect(() => {
    if (!editing && was.current) ref.current?.focus();
    was.current = editing;
  }, [editing]);
  return ref;
}

function useSave(action: (prev: ActionState, fd: FormData) => Promise<ActionState>, done: () => void) {
  return useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.saved) done();
    return result;
  }, {});
}

function SaveCancel({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Secondary on purpose: the page's one primary action stays the next step. */}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending && <Spinner />}
        {pending ? "Saving…" : "Save"}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title: pencil right after it. Enter saves, Escape cancels.
// ---------------------------------------------------------------------------
export function EditableTitle({
  kind,
  id,
  title,
  placeholder = "Untitled",
}: {
  kind: Kind;
  id: string;
  title: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const pencil = useReturnFocus(editing);
  const [state, action, pending] = useSave(renameItem.bind(null, kind, id), () => setEditing(false));

  if (editing) {
    const err = state.fieldErrors?.title;
    return (
      <form action={action} className="space-y-3">
        <label htmlFor={`title-${id}`} className="sr-only">
          Title
        </label>
        {/* A textarea so long titles wrap like the heading; Enter saves (no line breaks). */}
        <textarea
          id={`title-${id}`}
          name="title"
          autoFocus
          rows={2}
          maxLength={120}
          defaultValue={state.values?.title ?? title}
          placeholder={placeholder}
          aria-invalid={!!err}
          aria-describedby={err ? `title-${id}-error` : undefined}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          // Same size as the title, so it reads as editing the title (fieldClass's text-base removed).
          className={`${fieldClass.replace("text-base", "")} resize-none font-ls-serif text-4xl leading-tight [field-sizing:content] sm:text-5xl`}
        />
        {err && (
          <p id={`title-${id}-error`} className="text-[15px] text-ls-error">
            {err}
          </p>
        )}
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <SaveCancel pending={pending} onCancel={() => setEditing(false)} />
      </form>
    );
  }

  return (
    <h1 className="font-ls-serif text-4xl leading-tight sm:text-5xl">
      <span className={title ? "" : "text-ls-muted"}>{title || placeholder}</span>
      <span className="ml-1 inline-block align-middle">
        <PencilButton ref={pencil} label="Edit title" onClick={() => setEditing(true)} />
      </span>
    </h1>
  );
}

// ---------------------------------------------------------------------------
// Inspiration (first called "Idea notes"; renamed by the student, Nov 27): heading + pencil. For ideas also edits the link; for a dictation
// in Ideas, the notes are its words (they become the cook's words in Development).
// ---------------------------------------------------------------------------
export function EditableNotes({
  kind,
  id,
  note,
  link,
  hint,
}: {
  kind: Kind;
  id: string;
  note: string;
  link?: string | null;
  hint?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const pencil = useReturnFocus(editing);
  const [state, action, pending] = useSave(updateNotes.bind(null, kind, id), () => setEditing(false));
  const err = state.fieldErrors ?? {};

  return (
    <section aria-labelledby={`notes-${id}`} className="space-y-2 border-y border-ls-ink py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`notes-${id}`} className={eyebrow}>
          Inspiration
        </h2>
        {!editing && <PencilButton ref={pencil} label="Edit inspiration" onClick={() => setEditing(true)} />}
      </div>

      {editing ? (
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`note-${id}`} className="sr-only">
              Inspiration
            </label>
            <textarea
              id={`note-${id}`}
              name="note"
              rows={6}
              autoFocus
              defaultValue={state.values?.note ?? note}
              aria-invalid={!!err.note}
              aria-describedby={err.note ? `note-${id}-error` : undefined}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className={fieldClass}
              placeholder="e.g. Had it at a restaurant. Crunchy and sweet. Try drying in a low oven?"
            />
            {err.note && (
              <p id={`note-${id}-error`} className="text-[15px] text-ls-error">
                {err.note}
              </p>
            )}
          </div>
          {kind === "idea" && (
            <div className="space-y-1.5">
              <label htmlFor={`link-${id}`} className="block text-[15px] font-medium">
                Link <span className={eyebrow}>Optional</span>
              </label>
              <input
                id={`link-${id}`}
                name="link"
                inputMode="url"
                defaultValue={state.values?.link ?? link ?? ""}
                aria-invalid={!!err.link}
                aria-describedby={err.link ? `link-${id}-error` : undefined}
                className={fieldClass}
                placeholder="e.g. https://…"
              />
              {err.link && (
                <p id={`link-${id}-error`} className="text-[15px] text-ls-error">
                  {err.link}
                </p>
              )}
            </div>
          )}
          {state.error && <ErrorNote>{state.error}</ErrorNote>}
          <SaveCancel pending={pending} onCancel={() => setEditing(false)} />
        </form>
      ) : (
        <>
          {note ? (
            <p className="max-w-prose whitespace-pre-wrap text-[17px] leading-relaxed">{note}</p>
          ) : (
            <p className="text-[15px] text-ls-muted">Nothing yet. Tap the pencil to note what inspired it.</p>
          )}
          {link && (
            <p className="text-[15px]">
              <a href={link} target="_blank" rel="noopener noreferrer" className={`break-all ${textLink}`}>
                {link.replace(/^https?:\/\//, "")}
              </a>
              <span aria-hidden> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </p>
          )}
          {hint && <p className="text-[15px] text-ls-muted">{hint}</p>}
        </>
      )}
    </section>
  );
}
