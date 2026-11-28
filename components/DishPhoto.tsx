"use client";

import { useRef, useState, useTransition } from "react";
import { deletePhoto, setDishPhoto } from "@/app/actions";
import { PHOTO_OPEN_ERROR } from "@/lib/shrinkPhoto";
import { PhotoCropper } from "./PhotoCropper";
import { CameraIcon } from "./CameraIcon";
import { usePhotoViewer } from "./PhotoViewer";
import { focusRing, Spinner } from "./ui";

const smallLink = `min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] underline underline-offset-4 ${focusRing}`;

/**
 * The photo of the finished dish, beside the recipe's title and ingredients
 * (student, Nov 28). One per recipe: a new one replaces the old. Tap to zoom.
 */
export function DishPhoto({
  dictationId,
  photo,
  className = "",
}: {
  dictationId: string;
  photo?: { id: string; url: string };
  className?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Tap the photo: it opens large, with Change and Remove (student, Nov 28).
  const { open, viewer } = usePhotoViewer(photo ? [photo] : [], (close) => (
    <>
      <button
        type="button"
        onClick={() => {
          close();
          if (photo) setCropSrc(photo.url);
        }}
        className={`${smallLink} decoration-ls-rule hover:decoration-ls-ink`}
      >
        Crop
      </button>
      <button
        type="button"
        onClick={() => {
          close();
          fileInput.current?.click();
        }}
        className={`${smallLink} decoration-ls-rule hover:decoration-ls-ink`}
      >
        Change
      </button>
      <button
        type="button"
        onClick={() => {
          if (!photo || !window.confirm("Remove the dish photo?")) return;
          close();
          start(() => deletePhoto(photo.id));
        }}
        className={`${smallLink} text-ls-error decoration-ls-error/40 hover:decoration-ls-error`}
      >
        Remove
      </button>
    </>
  ));

  // Cropping (student, Nov 28): a new photo opens the cropper first; "Crop" re-crops the saved one.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const closeCropper = () => {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  const choose = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ""; // choosing the same file again still works
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    // Check the browser can open it (e.g. HEIC on a desktop browser can't) before cropping.
    const test = new Image();
    test.onload = () => setCropSrc(url);
    test.onerror = () => {
      URL.revokeObjectURL(url);
      setError(PHOTO_OPEN_ERROR);
    };
    test.src = url;
  };
  const upload = async (blob: Blob) => {
    const fd = new FormData();
    fd.set("photo", blob, "dish.jpg");
    const result = await setDishPhoto(dictationId, fd);
    if (result.error) throw new Error(result.error);
    closeCropper();
  };

  return (
    <div aria-busy={busy} className={className}>
      <input ref={fileInput} type="file" accept="image/*" hidden aria-label="Dish photo" onChange={(e) => choose(e.target.files?.[0])} />
      {photo ? (
        <>
          <button
            type="button"
            onClick={() => open(0)}
            aria-label="Dish photo: zoom in, change, or remove"
            className={`block w-fit max-w-full cursor-pointer border border-ls-ink transition-opacity hover:opacity-90 active:opacity-80 ${busy ? "opacity-40" : ""} ${focusRing}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private Storage */}
            <img src={photo.url} alt="The dish" className="block h-auto max-h-44 w-auto max-w-full sm:max-h-72" />
          </button>
          {viewer}
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className={`grid aspect-square w-28 cursor-pointer place-items-center content-center gap-1 border border-dashed border-ls-ink/50 px-2 text-center font-ls-sans text-xs font-medium uppercase tracking-[0.14em] text-ls-ink transition-colors hover:border-ls-ink hover:bg-ls-surface active:bg-ls-ink/[0.08] disabled:cursor-wait sm:aspect-[4/3] sm:w-56 ${focusRing}`}
        >
          {busy ? <Spinner /> : <CameraIcon className="size-7" />}
          <span>{busy ? "Adding…" : "Add dish photo"}</span>
        </button>
      )}
      {cropSrc && <PhotoCropper src={cropSrc} onSave={upload} onCancel={closeCropper} />}
      {error && (
        <p role="alert" className="pt-1 text-[13px] leading-snug text-ls-error">
          {error}
        </p>
      )}
    </div>
  );
}
