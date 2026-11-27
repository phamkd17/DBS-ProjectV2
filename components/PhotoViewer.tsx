"use client";

import { useRef, useState } from "react";
import { eyebrow, focusRing } from "./ui";

/**
 * Tap a photo to see it large on the same page (student, Nov 27): a native
 * <dialog>, so a tap anywhere (except the buttons), Escape, or × closes it and focus returns to the
 * photo you tapped. Previous/Next and the arrow keys move between photos.
 */
export function usePhotoViewer(photos: { url: string }[]) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(0);
  const open = (i: number) => {
    setShown(i);
    ref.current?.showModal();
  };
  const step = (d: number) => setShown((i) => (i + d + photos.length) % photos.length);
  const viewer = (
      <dialog
        ref={ref}
        aria-label={`Photo ${shown + 1} of ${photos.length}`}
        onClick={(e) => {
          // Tap anywhere to close, on the photo or outside it (student, Nov 27); the buttons still work.
          if (!(e.target as HTMLElement).closest("button")) ref.current?.close();
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
                onClick={() => ref.current?.close()}
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
  );
  return { open, viewer };
}

/** A list thumbnail that zooms in when tapped (instead of opening the item). */
export function ZoomThumb({ photos, title }: { photos: { url: string }[]; title: string }) {
  const { open, viewer } = usePhotoViewer(photos);
  return (
    <>
      <button
        type="button"
        onClick={() => open(0)}
        aria-label={`Zoom in on the photo of ${title}`}
        className={`my-2 mr-1 shrink-0 cursor-pointer border border-ls-ink transition-opacity hover:opacity-90 active:opacity-80 ${focusRing}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
        <img src={photos[0].url} alt="" className="block h-auto max-h-12 w-auto max-w-20" />
      </button>
      {viewer}
    </>
  );
}
