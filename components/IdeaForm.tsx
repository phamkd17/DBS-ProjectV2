"use client";

import { useActionState } from "react";
import { createIdea, updateIdea } from "@/app/actions";
import type { ActionState, IdeaRow } from "@/lib/types";
import { Button, ErrorNote, eyebrow, fieldClass, Spinner, textLink } from "./ui";

/** New idea, or edit an existing one. One column; errors sit under their field. */
export function IdeaForm({
  idea,
  onSaved,
  onCancel,
}: {
  idea?: Pick<IdeaRow, "id" | "title" | "note" | "link">;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const base = idea ? updateIdea.bind(null, idea.id) : createIdea;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await base(prev, fd);
    if (result.saved) onSaved?.();
    return result;
  }, {});
  const v = state.values ?? { title: idea?.title ?? "", note: idea?.note ?? "", link: idea?.link ?? "" };
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-[17px] font-medium">
          Idea
        </label>
        <input
          id="title"
          name="title"
          autoFocus={!!idea}
          maxLength={120}
          defaultValue={v.title}
          aria-invalid={!!err.title}
          aria-describedby={err.title ? "title-error" : undefined}
          className={fieldClass}
          placeholder="e.g. Dehydrated caramelized onions"
        />
        {err.title && (
          <p id="title-error" className="text-[15px] text-ls-error">
            {err.title}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="note" className="block text-[17px] font-medium">
          Inspiration <span className={eyebrow}>Optional</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={5}
          maxLength={5000}
          defaultValue={v.note}
          className={fieldClass}
          placeholder="e.g. Had it on pho at a restaurant. Crunchy and sweet. Try in the oven at low heat?"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="link" className="block text-[17px] font-medium">
          Link <span className={eyebrow}>Optional</span>
        </label>
        <input
          id="link"
          name="link"
          inputMode="url"
          autoComplete="url"
          defaultValue={v.link}
          aria-invalid={!!err.link}
          aria-describedby={err.link ? "link-error" : undefined}
          className={fieldClass}
          placeholder="e.g. https://…"
        />
        {err.link && (
          <p id="link-error" className="text-[15px] text-ls-error">
            {err.link}
          </p>
        )}
      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Spinner />}
          {pending ? "Saving…" : idea ? "Save changes" : "Save idea"}
        </Button>
        {!idea && (
          <Button type="submit" name="intent" value="another" variant="secondary" disabled={pending} className="w-full sm:w-auto">
            Save and add another
          </Button>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
