"use client";

import { useRef, useState, useTransition } from "react";
import { addPhoto, deletePhoto } from "@/app/actions";
import { PHOTO_OPEN_ERROR, shrinkPhoto } from "@/lib/shrinkPhoto";
import { CameraIcon } from "./CameraIcon";
import { eyebrow, focusRing, Spinner, textLink } from "./ui";

/** Photos on an idea (issue #7): see them, add more, delete one. */
export function EntryPhotos({
  dictationId,
  photos,
  max,
}: {
  dictationId: string;
  photos: { id: string; url: string }[];
  max: number;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startRemove] = useTransition();
  // Tap a photo to see it large, in place (no new tab).
  const viewer = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(0);
  const open = (i: number) => {
    setShown(i);
    viewer.current?.showModal();
  };
  const step = (d: number) => setShown((i) => (i + d + photos.length) % photos.length);

  const choose = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startAdd(async () => {
      try {
        const blob = await shrinkPhoto(file);
        const fd = new FormData();
        fd.set("photo", blob, "photo.jpg");
        const result = await addPhoto(dictationId, fd);
        if (result.error) setError(result.error);
      } catch {
        setError(PHOTO_OPEN_ERROR);
      } finally {
        if (fileInput.current) fileInput.current.value = "";
      }
    });
  };

  const remove = (id: string, n: number) => {
    if (!window.confirm(`Delete photo ${n}? This can't be undone.`)) return;
    setRemoving(id);
    startRemove(async () => {
      await deletePhoto(id);
      setRemoving(null);
    });
  };

  return (
    <section aria-labelledby={`photos-${dictationId}`} aria-busy={adding || !!removing} className="space-y-3">
      <h2 id={`photos-${dictationId}`} className={eyebrow}>
        Photos
      </h2>
      {photos.length > 0 && (
        <ul className="flex flex-wrap items-start gap-3">
          {photos.map((p, i) => (
            <li key={p.id} className={`max-w-full ${removing === p.id ? "opacity-40" : ""}`}>
              <button
                type="button"
                onClick={() => open(i)}
                aria-label={`Open photo ${i + 1}`}
                className={`block max-w-full cursor-zoom-in border border-ls-ink transition-opacity hover:opacity-90 active:opacity-80 ${focusRing}`}
              >
                {/* Whole photo at its own shape: never cropped, no empty bars (student, Nov 27). */}
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="block h-auto max-h-44 w-auto max-w-full sm:max-h-56" />
              </button>
              <button
                type="button"
                aria-label={`Delete photo ${i + 1}`}
                onClick={() => remove(p.id, i + 1)}
                disabled={!!removing}
                className={`mt-1 min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-error underline decoration-ls-error/40 underline-offset-4 hover:decoration-ls-error active:opacity-80 ${focusRing}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden aria-label="Photo" onChange={(e) => choose(e.target.files?.[0])} />
      {photos.length < max ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={adding}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] disabled:cursor-wait ${textLink}`}
        >
          {adding ? <Spinner /> : <CameraIcon className="size-5" />}
          {adding ? "Adding photo…" : photos.length ? "Add another photo" : "Add a photo"}
        </button>
      ) : (
        <p className="text-[15px] text-ls-muted">That&apos;s the most photos for one idea ({max}).</p>
      )}
      {error && (
        <p role="alert" className="text-[15px] text-ls-error">
          {error}
        </p>
      )}

      <dialog
        ref={viewer}
        aria-label={`Photo ${shown + 1} of ${photos.length}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) viewer.current?.close(); // tap outside the photo
        }}
        onKeyDown={(e) => {
          if (photos.length > 1 && e.key === "ArrowRight") step(1);
          if (photos.length > 1 && e.key === "ArrowLeft") step(-1);
        }}
        className="m-auto max-h-none max-w-none border border-ls-ink bg-ls-bg p-0 text-ls-ink backdrop:bg-ls-ink/80"
      >
        {photos[shown] && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-ls-border px-3">
              <p className={eyebrow}>
                Photo {shown + 1} of {photos.length}
              </p>
              <button
                type="button"
                autoFocus
                aria-label="Close"
                onClick={() => viewer.current?.close()}
                className={`-mr-3 grid size-11 cursor-pointer place-items-center text-2xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-ink ${focusRing}`}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
            <img
              src={photos[shown].url}
              alt={`Photo ${shown + 1}, full size`}
              className="block max-h-[calc(100dvh-8rem)] w-auto max-w-[calc(100vw-2rem)] object-contain"
            />
            {photos.length > 1 && (
              <div className="flex justify-between border-t border-ls-border">
                <button type="button" onClick={() => step(-1)} className={`min-h-11 cursor-pointer px-4 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] hover:bg-ls-ink/[0.06] ${focusRing}`}>
                  ← Previous
                </button>
                <button type="button" onClick={() => step(1)} className={`min-h-11 cursor-pointer px-4 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] hover:bg-ls-ink/[0.06] ${focusRing}`}>
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
