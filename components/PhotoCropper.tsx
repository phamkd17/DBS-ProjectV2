"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { cropPhoto, PHOTO_OPEN_ERROR } from "@/lib/shrinkPhoto";
import { Button, chipClass, eyebrow, focusRing, Spinner } from "./ui";

// Shapes to crop to (student, Nov 28: different sizes, and no empty space). Draft names.
const SHAPES = [
  { key: "original", label: "Original" },
  { key: "square", label: "Square", aspect: 1 },
  { key: "wide", label: "Wide", aspect: 4 / 3 },
  { key: "tall", label: "Tall", aspect: 3 / 4 },
] as const;
type ShapeKey = (typeof SHAPES)[number]["key"];

/**
 * Crop a photo before saving it: pick a shape, drag to frame it, zoom.
 * `src` is a blob: URL (a new photo) or the saved photo's signed URL (re-crop).
 */
export function PhotoCropper({
  src,
  onSave,
  onCancel,
}: {
  src: string;
  onSave: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shape, setShape] = useState<ShapeKey>("original");
  const [natural, setNatural] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const picked = SHAPES.find((s) => s.key === shape)!;
  const aspect = "aspect" in picked ? picked.aspect : natural;

  const save = async () => {
    if (!area) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(await cropPhoto(src, area));
    } catch {
      setError(PHOTO_OPEN_ERROR);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onCancel();
      }}
      className="m-auto w-[min(40rem,calc(100vw-1.5rem))] border border-ls-ink bg-ls-bg p-0 text-ls-ink backdrop:bg-ls-ink/80"
    >
      <div className="space-y-3 p-4">
        <h2 id="crop-title" className="font-ls-serif text-2xl leading-tight">
          Crop the photo
        </h2>
        <div className="relative h-[min(55dvh,26rem)] w-full bg-ls-ink">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => setArea(px)}
            onMediaLoaded={({ naturalWidth, naturalHeight }) => setNatural(naturalWidth / naturalHeight)}
            showGrid={false}
            style={{ cropAreaStyle: { border: "2px solid #f8f6f1", color: "rgba(28,29,31,0.6)" } }}
          />
        </div>
        <div className="space-y-1.5">
          <p className={eyebrow} id="shape-label">
            Shape
          </p>
          <div role="radiogroup" aria-labelledby="shape-label" className="flex flex-wrap gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={shape === s.key}
                onClick={() => {
                  setShape(s.key);
                  setCrop({ x: 0, y: 0 });
                }}
                className={chipClass(shape === s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 text-[15px]">
          <span className={eyebrow}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={`w-full accent-ls-ink ${focusRing}`}
          />
        </label>
        <p className="text-[15px] text-ls-muted">Drag the photo to frame it.</p>
        {error && (
          <p role="alert" className="text-[15px] text-ls-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-ls-border pt-3">
          <Button type="button" onClick={save} disabled={saving || !area}>
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save photo"}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`min-h-11 cursor-pointer px-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] underline decoration-ls-rule underline-offset-4 hover:decoration-ls-ink ${focusRing}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
