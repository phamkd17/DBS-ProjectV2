import Link from "next/link";
import { addStarterTags, deleteTag } from "@/app/actions";
import { AddTagForm } from "@/components/AddTagForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Button, ErrorNote, eyebrow, textLink } from "@/components/ui";
import { supabaseForUser } from "@/lib/supabase/server";
import { STARTER_TAGS, type TagRow } from "@/lib/types";

export const metadata = { title: "Tags · Culinary Lab Book" };

type Row = TagRow & { entry_sections: { count: number }[] };

// Draft wording: for the student to review.
export default async function TagsPage() {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, created_at, entry_sections(count)")
    .order("name")
    .returns<Row[]>();
  const tags = data ?? [];

  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href="/?tab=finished" className={textLink}>
            Recipes
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">Tags</h1>
        <p className="text-[17px] text-ls-muted">Sort your recipes. A recipe can have more than one.</p>
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
          {tags.map((s) => {
            const n = s.entry_sections[0]?.count ?? 0;
            return (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2 pl-1">
                <Link href={`/?tab=finished&tag=${s.id}`} className={`min-w-0 py-2 ${textLink} decoration-transparent`}>
                  <span className="block truncate font-ls-serif text-2xl leading-tight">{s.name}</span>
                  <span className={eyebrow}>
                    {n} {n === 1 ? "recipe" : "recipes"}
                  </span>
                </Link>
                <form action={deleteTag.bind(null, s.id)}>
                  <ConfirmSubmit
                    variant="danger"
                    aria-label={`Delete ${s.name}`}
                    message={`Delete the tag “${s.name}” from every recipe? The recipes stay in your lab book.`}
                  >
                    Delete
                  </ConfirmSubmit>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
