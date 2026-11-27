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
