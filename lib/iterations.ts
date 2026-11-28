import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeRow } from "./types";

/** One version of a recipe. id null = iteration 1, the original in public.recipes. */
export type Iteration = { id: string | null; number: number; made_on: string; notes: string };

/**
 * Iterations (issue #9; student, Nov 28): the original plus every copy the cook
 * made and edited, oldest first. RLS: only your own rows come back.
 */
export async function loadIterations(supabase: SupabaseClient, dictationId: string, recipeCreatedAt: string) {
  const { data: rows } = await supabase
    .from("iterations")
    .select("id, made_on, notes, recipe, created_at")
    .eq("dictation_id", dictationId)
    .order("made_on")
    .order("created_at")
    .returns<{ id: string; made_on: string; notes: string; recipe: RecipeRow["recipe"]; created_at: string }[]>();
  const orig = (rows ?? []).find((r) => !r.recipe);
  const versions = (rows ?? []).filter((r) => r.recipe);
  const iterations: Iteration[] = [
    { id: null, number: 1, made_on: orig?.made_on ?? new Date(recipeCreatedAt).toLocaleDateString("en-CA"), notes: orig?.notes ?? "" },
    ...versions.map((r, i) => ({ id: r.id, number: i + 2, made_on: r.made_on, notes: r.notes })),
  ];
  return { iterations, versions };
}

/** ?it= → which iteration to show: "original" = 1, an id = that one, nothing = the latest (student, Nov 28). */
export function pickIteration<T extends { id: string }>(versions: T[], it: unknown): T | null {
  if (it === "original") return null;
  const byId = versions.find((v) => v.id === it);
  if (byId) return byId;
  return versions.length ? versions[versions.length - 1] : null;
}

/** Link to one iteration's page. */
export const iterationHref = (recipeId: string, id: string | null) => (id ? `/r/${recipeId}?it=${id}` : `/r/${recipeId}?it=original`);
