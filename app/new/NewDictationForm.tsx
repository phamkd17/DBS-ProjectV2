"use client";

import { useActionState } from "react";
import { createDictation, updateDictation } from "@/app/actions";
import { Button, ErrorNote, eyebrow, fieldClass, Spinner, textLink, KitchenNotesTip } from "@/components/ui";
import type { ActionState, DictationRow } from "@/lib/types";

const FIELD = fieldClass;

type Editing = Pick<DictationRow, "id" | "transcript" | "dish_name" | "cook_name">;

export function NewDictationForm({
  defaultDish = "",
  dictation,
  onSaved,
  onCancel,
}: {
  defaultDish?: string;
  dictation?: Editing;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const base = dictation ? updateDictation.bind(null, dictation.id) : createDictation;
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await base(prev, fd);
    if (result.saved) onSaved?.();
    return result;
  }, {});
  const v =
    state.values ??
    (dictation
      ? { transcript: dictation.transcript ?? "", dish_name: dictation.dish_name ?? "", cook_name: dictation.cook_name ?? "" }
      : { dish_name: defaultDish });
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="transcript" className="block text-[17px] font-medium">
          Kitchen notes
        </label>
        <KitchenNotesTip id="transcript-tip" />
        <textarea
          id="transcript"
          name="transcript"
          rows={12}
          autoFocus={!!dictation}
          defaultValue={v.transcript}
          aria-invalid={!!err.transcript}
          aria-describedby={err.transcript ? "transcript-tip transcript-error" : "transcript-tip"}
          className={FIELD}
          placeholder="e.g. “Half a gallon of whole milk. Heat it until it steams, about 180°F, then let it cool to warm, about 110°F. Stir in 2 tablespoons of yogurt…”"
        />
        {err.transcript && (
          <p id="transcript-error" className="text-[15px] text-ls-error">
            {err.transcript}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dish_name" className="block text-[17px] font-medium">
          Dish name <span className={eyebrow}>Optional</span>
        </label>
        <input id="dish_name" name="dish_name" maxLength={120} defaultValue={v.dish_name} className={FIELD} placeholder="e.g. Yogurt" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cook_name" className="block text-[17px] font-medium">
          Whose recipe? <span className={eyebrow}>Optional</span>
        </label>
        <input
          id="cook_name"
          name="cook_name"
          maxLength={60}
          defaultValue={v.cook_name}
          className={FIELD}
          placeholder="e.g. Grandma"
        />

      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending && <Spinner />}
        {pending ? "Saving…" : dictation ? "Save changes" : "Save kitchen notes"}
      </Button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={`ml-2 inline-flex min-h-11 cursor-pointer items-center px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
        >
          Cancel
        </button>
      )}
    </form>
  );
}
