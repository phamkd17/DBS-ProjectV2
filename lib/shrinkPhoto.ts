/**
 * Browser-side: shrink a phone photo (often 3–12MB) to a JPEG under ~900KB
 * (longest side 1600px), keeping its rotation. Keeps uploads under the 1MB
 * server-action limit and the free Storage quota small.
 */
const MAX_SIDE = 1600;
const TARGET_BYTES = 900 * 1024;

export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const img = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  let blob: Blob | null = null;
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= TARGET_BYTES) return blob;
  }
  if (!blob) throw new Error("could not encode");
  return blob;
}

export const PHOTO_OPEN_ERROR = "Couldn't open that photo. Try a JPEG or PNG.";

/** Load an image (a blob: URL or a signed Storage URL) so it can be drawn on a canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // signed Storage URLs: needed to read the pixels back
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load"));
    img.src = src;
  });
}

/** Cut out the chosen area (in the image's own pixels), then shrink it like any upload. */
export async function cropPhoto(src: string, area: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  canvas.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  let blob: Blob | null = null;
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= TARGET_BYTES) return blob;
  }
  if (!blob) throw new Error("could not encode");
  return blob;
}
