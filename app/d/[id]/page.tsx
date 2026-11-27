import { notFound, redirect } from "next/navigation";
import { deleteDictation } from "@/app/actions";
import { DictationEditor } from "@/components/DictationEditor";
import { eyebrow, formatDate, textLink } from "@/components/ui";
import { EditableNotes, EditableTitle } from "@/components/InlineEdit";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { supabaseForUser } from "@/lib/supabase/server";
import type { DictationRow } from "@/lib/types";
import { CreateRecipe } from "./CreateRecipe";
import { SavedBanner } from "@/components/SavedBanner";
import { EntryPhotos } from "@/components/EntryPhotos";
import { MAX_PHOTOS_PER_ENTRY, photosFor } from "@/lib/photos";
import { StartDeveloping } from "@/components/StartDeveloping";
import { MoveTo } from "@/components/MoveTo";
import { STAGE_LABEL, type TagRow } from "@/lib/types";
import { TagPicker } from "@/components/TagPicker";

// Gemini can take a while on the free tier.
export const maxDuration = 300;

export default async function DictationPage({ params, searchParams }: PageProps<"/d/[id]">) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseForUser();

  // RLS: returns nothing unless this dictation is yours.
  const { data: d } = await supabase.from("dictations").select("*").eq("id", id).maybeSingle<DictationRow>();
  if (!d) notFound();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("dictation_id", id)
    .neq("status", "failed")
    .limit(1)
    .maybeSingle();
  if (recipe) redirect(`/r/${recipe.id}`);

  const justSaved = saved === "1" && d.stage === "ideas";
  const photos = await photosFor(supabase, [d.id]);
  const [{ data: sections }, { data: links }] =
    d.stage === "finished"
      ? await Promise.all([
          supabase.from("sections").select("id, name, created_at").order("name").returns<TagRow[]>(),
          supabase.from("entry_sections").select("section_id").eq("dictation_id", d.id),
        ])
      : [{ data: null }, { data: null }];

  return (
    <main className="space-y-8">
      {justSaved && <SavedBanner />}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className={eyebrow}>
            <Link href={`/?tab=${d.stage}`} className={textLink}>
              {STAGE_LABEL[d.stage]}
            </Link>
          </p>
          {/* Issue #3: another idea is always one tap away. */}
          {d.stage === "ideas" && !justSaved && (
            <Link href="/ideas/new" className={`font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
              + New idea
            </Link>
          )}
        </div>
        <EditableTitle kind="dictation" id={d.id} title={d.dish_name ?? ""} placeholder={photos.length ? "Photo idea" : "Untitled"} />
        <p className={eyebrow}>
          {d.cook_name ? `${d.cook_name} · ` : ""}Saved {formatDate(d.created_at)}
        </p>
      </div>

      {/* Idea notes stay in every stage. */}
      <EditableNotes kind="dictation" id={d.id} note={d.notes} link={d.link} />

      {/* Photos stay with the entry in every stage, like the notes. */}
      <EntryPhotos dictationId={d.id} photos={photos} max={MAX_PHOTOS_PER_ENTRY} />

      {d.stage === "finished" && (
        <TagPicker dictationId={d.id} allTags={sections ?? []} selected={(links ?? []).map((l) => l.section_id)} />
      )}

      {/* Cook · Their words: added only in Development (shown anywhere once they exist). */}
      {d.stage === "development" || d.transcript ? (
        <DictationEditor dictation={d} open addIsPrimary={d.stage === "development"}>
          {d.stage === "development" ? (
            d.transcript ? (
              <CreateRecipe dictationId={d.id} />
            ) : null
          ) : (
            <StartDeveloping dictationId={d.id} primary={!justSaved} />
          )}
        </DictationEditor>
      ) : (
        <StartDeveloping dictationId={d.id} primary={!justSaved} />
      )}

      <MoveTo kind="dictation" id={d.id} current={d.stage} hide={d.stage === "development" ? [] : ["development"]} />

      <form action={deleteDictation.bind(null, d.id)} className="border-t border-ls-border pt-4">
        <ConfirmSubmit variant="danger" message="Delete this, with its notes, words, and any recipe made from them? This can't be undone.">
          Delete
        </ConfirmSubmit>
      </form>
    </main>
  );
}
