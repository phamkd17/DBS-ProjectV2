import Link from "next/link";
import { addStarterSections, deleteSection } from "@/app/actions";
import { AddSectionForm } from "@/components/AddSectionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Button, ErrorNote, eyebrow, textLink } from "@/components/ui";
import { supabaseForUser } from "@/lib/supabase/server";
import { STARTER_SECTIONS, type SectionRow } from "@/lib/types";

export const metadata = { title: "Sections · Culinary Lab Book" };

type Row = SectionRow & { entry_sections: { count: number }[] };

// Draft wording: for the student to review.
export default async function SectionsPage() {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, created_at, entry_sections(count)")
    .order("name")
    .returns<Row[]>();
  const sections = data ?? [];

  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href="/?tab=finished" className={textLink}>
            Recipes
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">Sections</h1>
        <p className="text-[17px] text-ls-muted">Sort your recipes. A recipe can be in more than one.</p>
      </div>

      <AddSectionForm />

      {error && <ErrorNote>We couldn&apos;t load your sections. Refresh the page to try again.</ErrorNote>}

      {!error && sections.length === 0 ? (
        <div className="space-y-3 border border-dashed border-ls-border p-5">
          <p className="text-[15px] text-ls-muted">No sections yet. Start with {STARTER_SECTIONS.join(", ")}?</p>
          <form action={addStarterSections}>
            <Button type="submit" variant="secondary">
              Add these {STARTER_SECTIONS.length}
            </Button>
          </form>
        </div>
      ) : (
        <ul className="divide-y divide-ls-border border-y border-ls-ink">
          {sections.map((s) => {
            const n = s.entry_sections[0]?.count ?? 0;
            return (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2 pl-1">
                <Link href={`/?tab=finished&section=${s.id}`} className={`min-w-0 py-2 ${textLink} decoration-transparent`}>
                  <span className="block truncate font-ls-serif text-2xl leading-tight">{s.name}</span>
                  <span className={eyebrow}>
                    {n} {n === 1 ? "recipe" : "recipes"}
                  </span>
                </Link>
                <form action={deleteSection.bind(null, s.id)}>
                  <ConfirmSubmit
                    variant="danger"
                    aria-label={`Delete ${s.name}`}
                    message={`Delete the section “${s.name}”? The recipes in it stay in your lab book.`}
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
