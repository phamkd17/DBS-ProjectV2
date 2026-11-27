"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { quickAddIdea } from "@/app/actions";
import { PHOTO_OPEN_ERROR, shrinkPhoto } from "@/lib/shrinkPhoto";
import type { ActionState } from "@/lib/types";
import { CameraIcon } from "./CameraIcon";
import { Button, fieldClass, focusRing, Spinner, textLink } from "./ui";

/**
 * Type an idea, add a photo, or both, plus what inspired it, all in one step;
 * press Enter (in the name) or Add and it appears in the list. No separate page
 * (student, Nov 20; photos and inspiration Nov 27).
 */
export function QuickAddIdea() {
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [shrinking, setShrinking] = useState(false);

  // Free the preview's memory when it changes or the box goes away.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    if (photo) fd.set("photo", photo.blob, "photo.jpg");
    const result = await quickAddIdea(prev, fd);
    if (result.saved) {
      form.current?.reset();
      setPhoto(null);
      input.current?.focus(); // ready for the next one
    }
    return result;
  }, {});
  const err = state.fieldErrors?.title;
  const fileErr = photoError ?? state.fieldErrors?.photo;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setShrinking(true);
    try {
      const blob = await shrinkPhoto(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoError(PHOTO_OPEN_ERROR);
    } finally {
      setShrinking(false);
      if (fileInput.current) fileInput.current.value = ""; // choosing the same file again still works
    }
  };

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
          defaultValue={state.error && !state.saved ? state.values?.title : undefined}
          placeholder={photo ? "Name it (optional)" : "What's the idea?"}
          aria-invalid={!!err}
          aria-describedby={err ? "quick-idea-error" : undefined}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          aria-label="Photo"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={shrinking || pending}
          aria-label={photo ? "Change photo" : "Add a photo"}
          title={photo ? "Change photo" : "Add a photo"}
          className={`grid w-12 shrink-0 cursor-pointer place-items-center border border-ls-ink bg-ls-surface text-ls-ink transition-colors hover:bg-white active:translate-y-px active:bg-ls-ink/[0.08] disabled:cursor-wait disabled:text-ls-muted ${focusRing}`}
        >
          {shrinking ? <Spinner /> : <CameraIcon />}
        </button>
        <Button type="submit" disabled={pending || shrinking} className="shrink-0">
          {pending ? <Spinner /> : "Add"}
        </Button>
      </div>

      <label htmlFor="quick-inspiration" className="sr-only">
        Inspiration (optional)
      </label>
      <textarea
        id="quick-inspiration"
        name="note"
        rows={2}
        maxLength={5000}
        defaultValue={state.error && !state.saved ? state.values?.note : undefined}
        placeholder="Inspiration (optional): where you had it, what you loved"
        className={`${fieldClass} block`}
      />

      {photo && (
        <div className="flex items-center gap-3 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) */}
          <img src={photo.url} alt="The photo you chose" className="h-auto max-h-16 w-auto max-w-24 border border-ls-ink" />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className={`min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}
          >
            Remove photo
          </button>
        </div>
      )}

      <p aria-live="polite" className="min-h-5 text-[15px]">
        {err ? (
          <span id="quick-idea-error" className="text-ls-error">
            {err}
          </span>
        ) : fileErr ? (
          <span className="text-ls-error">{fileErr}</span>
        ) : state.error ? (
          <span className="text-ls-error">{state.error}</span>
        ) : state.saved ? (
          <span className="text-ls-muted">
            <span aria-hidden className="text-ls-success">✓ </span>Added “{state.values?.added}”. Add another, or open it to add more.
          </span>
        ) : null}
      </p>
    </form>
  );
}
