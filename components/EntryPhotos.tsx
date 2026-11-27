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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className={`relative ${removing === p.id ? "opacity-40" : ""}`}>
              <a href={p.url} target="_blank" rel="noreferrer" className={`block ${focusRing}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-square w-full border border-ls-ink object-cover" />
                <span className="sr-only"> (opens full size)</span>
              </a>
              <button
                type="button"
                aria-label={`Delete photo ${i + 1}`}
                title="Delete photo"
                onClick={() => remove(p.id, i + 1)}
                disabled={!!removing}
                className={`absolute top-0 right-0 grid size-11 cursor-pointer place-items-center border-b border-l border-ls-ink bg-ls-surface text-xl text-ls-ink hover:bg-white hover:text-ls-error active:bg-ls-ink/[0.08] ${focusRing}`}
              >
                <span aria-hidden>×</span>
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
    </section>
  );
}
