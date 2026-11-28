import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Photos on ideas (issue #7). Files go to the private "photos" bucket under
 * "<user id>/<entry id>/<random>.<ext>"; Storage RLS only lets you touch your
 * own folder. The browser shrinks photos first (components/PhotoPicker.tsx),
 * so uploads stay under the 1MB server-action limit.
 */
export const MAX_PHOTO_BYTES = 1024 * 1024; // after shrinking in the browser
export const MAX_PHOTOS_PER_ENTRY = 6;
const BUCKET = "photos";

const KINDS = [
  { type: "image/jpeg", ext: "jpg", magic: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", magic: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    ext: "webp",
    magic: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

/** A real JPEG/PNG/WebP under the size limit? Checks the bytes, not just the name. */
export async function readPhoto(file: unknown): Promise<{ ok: true; bytes: Uint8Array; type: string; ext: string } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "That photo is too big. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.magic(bytes));
  if (!kind) return { ok: false, error: "That file isn't a photo we can use. Try a JPEG or PNG." };
  return { ok: true, bytes, type: kind.type, ext: kind.ext };
}

/** Upload one photo for an entry and record it. Cleans up the file if the record fails. */
export async function savePhoto(
  supabase: SupabaseClient,
  userId: string,
  dictationId: string,
  photo: { bytes: Uint8Array; type: string; ext: string },
  kind: PhotoKind = "idea",
): Promise<{ ok: boolean }> {
  const path = `${userId}/${dictationId}/${randomUUID()}.${photo.ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, photo.bytes, { contentType: photo.type, upsert: false });
  if (up.error) {
    console.error("[savePhoto upload]", up.error);
    return { ok: false };
  }
  const { error } = await supabase.from("entry_photos").insert({ dictation_id: dictationId, path, kind });
  if (error) {
    console.error("[savePhoto row]", error);
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false };
  }
  return { ok: true };
}

/** "idea" = inspiration photos; "dish" = the one photo of the finished dish on a recipe. */
export type PhotoKind = "idea" | "dish";
export type Photo = { id: string; dictation_id: string; url: string; kind: PhotoKind };

/** Signed URLs (1 hour) for photos you can see, newest entry order kept. */
export async function photosFor(supabase: SupabaseClient, dictationIds: string[]): Promise<Photo[]> {
  if (dictationIds.length === 0) return [];
  const { data: rows, error } = await supabase
    .from("entry_photos")
    .select("id, dictation_id, path, kind")
    .in("dictation_id", dictationIds)
    .order("created_at");
  if (error || !rows?.length) return [];
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    60 * 60,
  );
  const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return rows.flatMap((r) =>
    urlByPath.has(r.path) ? [{ id: r.id, dictation_id: r.dictation_id, url: urlByPath.get(r.path)!, kind: r.kind as PhotoKind }] : [],
  );
}

/** Delete photos (rows + files). Pass ids, or an entry id for all of its photos. */
export async function deletePhotos(supabase: SupabaseClient, by: { ids: string[] } | { dictationId: string }) {
  const q = supabase.from("entry_photos").select("id, path");
  const { data: rows } = "ids" in by ? await q.in("id", by.ids) : await q.eq("dictation_id", by.dictationId);
  if (!rows?.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(rows.map((r) => r.path));
  if (error) console.error("[deletePhotos files]", error);
  await supabase.from("entry_photos").delete().in("id", rows.map((r) => r.id));
}
