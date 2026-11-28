import Link from "next/link";
import { addStarterTags, deleteTag } from "@/app/actions";
import { AddTagForm } from "@/components/AddTagForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Button, ErrorNote, eyebrow, focusRing, textLink } from "@/components/ui";
import { supabaseForUser } from "@/lib/supabase/server";
import { STARTER_TAGS, type RecipeStatus, type TagRow } from "@/lib/types";

export const metadata = { title: "All tags · Culinary Lab Book" };

type Entry = {
  id: string;
  dish_name: string | null;
  recipes: { id: string; status: RecipeStatus; recipe: { title?: string } | null }[];
};
type Row = TagRow & { entry_sections: { dictations: Entry | null }[] };

// All tags, each with its recipes (student, Nov 21). Draft wording: for the student to review.
export default async function TagsPage() {
  const supabase = await supabaseForUser();
  // RLS: only your tags, your links, and your entries come back.
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, created_at, entry_sections(dictations(id, dish_name, recipes(id, status, recipe)))")
    .order("name")
    .returns<Row[]>();
  const tags = (data ?? []).map((t) => ({
    ...t,
    entries: t.entry_sections
      .map((l) => l.dictations)
      .filter((d): d is Entry => !!d)
      .map((d) => {
        const r = d.recipes.find((x) => x.status !== "failed");
        return { id: d.id, title: r?.recipe?.title || d.dish_name || "Untitled", href: r ? `/r/${r.id}` : `/d/${d.id}` };
      })
      .sort((a, b) => a.title.localeCompare(b.title)),
  }));

  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href="/?tab=finished" className={textLink}>
            Recipes
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">All tags</h1>
        <p className="text-[17px] text-ls-muted">Every tag and its recipes. A recipe can have more than one.</p>
      </div>

      <AddTagForm />

      {error && <ErrorNote>We couldn&apos;t load your tags. Refresh the page to try again.</ErrorNote>}

      {!error && tags.length === 0 ? (
        <div className="space-y-3 border border-dashed border-ls-border p-5">
          <p className="text-[15px] text-ls-muted">No tags yet. Start with {STARTER_TAGS.join(", ")}?</p>
          <form action={addStarterTags}>
            <Button type="submit" variant="secondary">
              Add these {STARTER_TAGS.length}
            </Button>
          </form>
        </div>
      ) : (
        <ul className="divide-y divide-ls-border border-y border-ls-ink">
          {tags.map((t) => {
            const n = t.entries.length;
            return (
              <li key={t.id}>
                <section aria-labelledby={`tag-${t.id}`} className="space-y-2 py-4 pl-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <h2 id={`tag-${t.id}`} className="truncate font-ls-serif text-2xl leading-tight">
                        {t.name}
                      </h2>
                      <p className={eyebrow}>
                        {n} {n === 1 ? "recipe" : "recipes"}
                      </p>
                    </div>
                    <form action={deleteTag.bind(null, t.id)} className="-mt-1 shrink-0">
                      <ConfirmSubmit
                        variant="danger"
                        aria-label={`Delete ${t.name}`}
                        message={`Delete the tag “${t.name}” from every recipe? The recipes stay in your lab book.`}
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                  {n === 0 ? (
                    <p className="text-[15px] text-ls-muted">No recipes yet. Open a recipe and add this tag.</p>
                  ) : (
                    <ul aria-label={`Recipes tagged ${t.name}`} className="space-y-0.5">
                      {t.entries.map((e) => (
                        <li key={e.id}>
                          <Link
                            href={e.href}
                            className={`-mx-1 flex min-h-11 items-center px-1 text-[17px] underline decoration-ls-rule underline-offset-4 transition-colors hover:bg-ls-ink/[0.04] hover:decoration-ls-ink active:bg-ls-ink/[0.08] ${focusRing}`}
                          >
                            {e.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
