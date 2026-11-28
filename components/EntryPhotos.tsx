"use client";

import { useRef, useState, useTransition } from "react";
import { addPhoto, deletePhoto } from "@/app/actions";
import { PHOTO_OPEN_ERROR, shrinkPhoto } from "@/lib/shrinkPhoto";
import { CameraIcon } from "./CameraIcon";
import { usePhotoViewer } from "./PhotoViewer";
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
  const { open, viewer } = usePhotoViewer(photos);

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
      {/* No photos yet: the heading and "Add a photo" share one line (compact, Nov 27). */}
      <div className="flex items-center justify-between gap-3">
        <h2 id={`photos-${dictationId}`} className={eyebrow}>
          Photos
        </h2>
        {photos.length === 0 && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={adding}
            className={`-my-2 inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] disabled:cursor-wait ${textLink}`}
          >
            {adding ? <Spinner /> : <CameraIcon className="size-5" />}
            {adding ? "Adding photo…" : "Add a photo"}
          </button>
        )}
      </div>
      {photos.length > 0 && (
        <ul className="flex flex-wrap items-start gap-3">
          {photos.map((p, i) => (
            <li key={p.id} className={`max-w-full ${removing === p.id ? "opacity-40" : ""}`}>
              <button
                type="button"
                onClick={() => open(i)}
                aria-label={`Open photo ${i + 1}`}
                className={`block max-w-full cursor-pointer border border-ls-ink transition-opacity hover:opacity-90 active:opacity-80 ${focusRing}`}
              >
                {/* Whole photo at its own shape: never cropped, no empty bars (student, Nov 27). */}
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="block h-auto max-h-28 w-auto max-w-full sm:max-h-36" />
              </button>
              <button
                type="button"
                aria-label={`Delete photo ${i + 1}`}
                onClick={() => remove(p.id, i + 1)}
                disabled={!!removing}
                className={`min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-error underline decoration-ls-error/40 underline-offset-4 hover:decoration-ls-error active:opacity-80 ${focusRing}`}
              >
                Delete
              </button>
            </li>
          ))}
          {photos.length < max && (
            <li>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={adding}
                aria-label={adding ? "Adding photo" : "Add another photo"}
                title="Add another photo"
                className={`grid size-28 cursor-pointer place-items-center border border-dashed border-ls-ink/50 text-ls-ink transition-colors hover:border-ls-ink hover:bg-ls-surface active:bg-ls-ink/[0.08] disabled:cursor-wait sm:size-36 ${focusRing}`}
              >
                {adding ? <Spinner /> : <CameraIcon className="size-7" />}
              </button>
            </li>
          )}
        </ul>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden aria-label="Photo" onChange={(e) => choose(e.target.files?.[0])} />
      {photos.length >= max ? (
        <p className="text-[15px] text-ls-muted">That&apos;s the most photos for one idea ({max}).</p>
      ) : null}
      {error && (
        <p role="alert" className="text-[15px] text-ls-error">
          {error}
        </p>
      )}

      {viewer}
    </section>
  );
}
