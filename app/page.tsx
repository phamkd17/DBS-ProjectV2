import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { supabaseForUser } from "@/lib/supabase/server";
import { Button, chipClass, ErrorNote, eyebrow, focusRing, LinkButton, textLink } from "@/components/ui";
import { QuickAddIdea } from "@/components/QuickAddIdea";
import { HowItWorks } from "@/components/HowItWorks";
import { photosFor } from "@/lib/photos";
import { ZoomThumb } from "@/components/PhotoViewer";
import type { DictationRow, RecipeStatus, TagRow } from "@/lib/types";

type Row = DictationRow & {
  recipes: { id: string; status: RecipeStatus; recipe: { title?: string } | null }[];
  entry_sections: { section_id: string }[];
};


// Draft wording: for the student to review.
const TABS = {
  ideas: {
    label: "Ideas",
    blurb: "Inspiration, photos, and links to come back to.",
    empty: "No ideas yet.",
  },
  development: {
    label: "Development",
    blurb: "Add kitchen notes and make the recipe.",
    empty: "Nothing in development yet.",
  },
  finished: {
    label: "Recipes",
    blurb: "Ready to cook, keep, or send.",
    empty: "No recipes yet.",
  },
} as const;
type Tab = keyof typeof TABS;


export default async function Home({ searchParams }: PageProps<"/">) {
  const { userId } = await auth();
  if (!userId) return <Landing />;

  const supabase = await supabaseForUser();
  const [{ tab: tabParam, tag: tagParam }, { data, error }, { data: tagData }] = await Promise.all([
    searchParams,
    supabase
      .from("dictations")
      .select("*, recipes(id, status, recipe), entry_sections(section_id)")
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
    supabase.from("sections").select("id, name, created_at").order("name").returns<TagRow[]>(), // tags
  ]);
  const tags = tagData ?? [];

  const rows = data ?? [];
  const byTab: Record<Tab, Row[]> = { ideas: [], development: [], finished: [] };
  for (const d of rows) byTab[d.stage].push(d);

  // Explicit ?tab= wins; otherwise open where the work is. Redirect so the URL
  // (and the header tabs) always say which section is open.
  if (!(typeof tabParam === "string" && tabParam in TABS)) {
    redirect(`/?tab=${byTab.development.length ? "development" : byTab.finished.length ? "finished" : "ideas"}`);
  }
  const tab = tabParam as Tab;

  // Recipes tab: filter by one tag (?tag=<id>); a recipe can have several.
  const tag = tab === "finished" ? tags.find((t) => t.id === tagParam) : undefined;
  const items = tag ? byTab[tab].filter((d) => d.entry_sections.some((l) => l.section_id === tag.id)) : byTab[tab];
  const tagNames = new Map(tags.map((t) => [t.id, t.name]));
  // Each item's photos: the first is the thumbnail; tapping it zooms in on all of them.
  const thumbs = new Map<string, { url: string }[]>();
  for (const p of await photosFor(supabase, items.map((d) => d.id))) thumbs.set(p.dictation_id, [...(thumbs.get(p.dictation_id) ?? []), { url: p.url }]);

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-ls-serif text-5xl leading-none">Your lab book</h1>
        {/* One start button per tab, for what you do there (student, Nov 20). */}
        {tab === "ideas" ? null : tab === "development" ? (
          <LinkButton href="/new">+ Kitchen notes</LinkButton>
        ) : (
          <LinkButton href="/recipes/new">+ New recipe</LinkButton>
        )}
      </div>

      {error && <ErrorNote>We couldn&apos;t load your lab book. Refresh the page to try again.</ErrorNote>}

      {rows.length === 0 && !error ? (
        <>
          {tab === "ideas" && <QuickAddIdea />}
          <FirstRun />
        </>
      ) : (
        <>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-ls-muted">
              <span className="font-medium text-ls-ink">{TABS[tab].label}</span>
              {items.length ? ` · ${items.length}` : ""} · {TABS[tab].blurb}
            </p>
          </div>

          {tab === "ideas" && <QuickAddIdea />}

          {tab === "finished" && byTab.finished.length > 0 && <TagFilter tags={tags} current={tag?.id} />}

          {items.length === 0 ? (
            <p className="border border-dashed border-ls-border p-6 text-[15px] text-ls-muted">
              {tag ? `No recipes tagged ${tag.name} yet. Open a recipe and add the tag.` : TABS[tab].empty}
            </p>
          ) : (
            <ul className="divide-y divide-ls-border border-y border-ls-ink">
              {items.map((d) => (
                <EntryCard
                  key={d.id}
                  d={d}
                  thumb={thumbs.get(d.id)}
                  tags={tab === "finished" ? d.entry_sections.map((l) => tagNames.get(l.section_id)).filter((n): n is string => !!n).sort() : []}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

/** Recipes tab: All · each tag · All tags. */
function TagFilter({ tags, current }: { tags: TagRow[]; current?: string }) {
  if (tags.length === 0)
    return (
      <p className="text-[15px] text-ls-muted">
        <Link href="/tags" className={`text-ls-ink ${textLink}`}>
          Add tags
        </Link>{" "}
        to sort your recipes, like Mexican or Desserts.
      </p>
    );
  return (
    <nav aria-label="Filter by tag" className="flex flex-wrap items-center gap-2">
      <Link href="/?tab=finished" aria-current={current ? undefined : "page"} className={chipClass(!current)}>
        All
      </Link>
      {tags.map((s) => (
        <Link
          key={s.id}
          href={`/?tab=finished&tag=${s.id}`}
          aria-current={current === s.id ? "page" : undefined}
          className={chipClass(current === s.id)}
        >
          {s.name}
        </Link>
      ))}
      <Link href="/tags" className={`min-h-11 px-2 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
        All tags
      </Link>
    </nav>
  );
}

function EntryCard({ d, tags = [], thumb }: { d: Row; tags?: string[]; thumb?: { url: string }[] }) {
  const r = d.recipes[0];
  const title = r?.recipe?.title || d.dish_name || (d.stage === "ideas" ? (thumb ? "Photo idea" : "Untitled idea") : "Untitled");
  const href = r ? `/r/${r.id}` : `/d/${d.id}`;
  const next = r
    ? r.status === "ready"
      ? null
      : "Answer questions"
    : d.stage === "development"
      ? d.transcript
        ? "Create recipe"
        : "Add kitchen notes"
      : null;
  const preview = d.notes || d.transcript;
  const meta = [d.cook_name, d.copied_from && "from a link", d.link && "has a link"].filter(Boolean);
  // Compact rows (student, Nov 27): name, one meta line, one preview line.
  // "Move to" lives on each item's page, not repeated on every row.
  return (
    <li className="flex items-center gap-3">
      <Link
        href={href}
        className={`group flex min-w-0 flex-1 items-center justify-between gap-4 px-1 py-3 transition-colors hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}
      >
        {/* Two lines, three styles (student, Nov 27): the name with its tags and cook
            beside it in the small label style, then one line of preview. No date. */}
        <div className="min-w-0 space-y-0.5">
          <p className="flex min-w-0 items-baseline gap-x-3">
            <span className="truncate font-ls-serif text-xl leading-tight">{title}</span>
            {[...tags, ...meta].length > 0 && (
              <span className={`shrink-0 truncate ${eyebrow} max-w-[50%]`}>{[...tags, ...meta].join(" · ")}</span>
            )}
          </p>
          {preview && <p className="truncate text-[15px] text-ls-muted">{preview}</p>}
        </div>
        {next && (
          <span className="shrink-0 text-xs font-medium uppercase tracking-[0.18em] underline decoration-ls-rule underline-offset-4 group-hover:decoration-ls-ink">
            {next}
          </span>
        )}
      </Link>
      {/* Tapping the photo zooms in on it; tapping the name opens the item (student, Nov 27). */}
      {thumb && <ZoomThumb photos={thumb} title={title} />}
    </li>
  );
}

function FirstRun() {
  return (
    <section aria-labelledby="first-run" className="space-y-5">
      <h2 id="first-run" className="font-ls-serif text-3xl leading-tight">
        Start with one dish
      </h2>
      <HowItWorks headingLevel={3} />
    </section>
  );
}

function Landing() {
  return (
    // Sized so the headline, the three steps, and the button fit on one screen (no scrolling).
    <main className="space-y-6 py-2 sm:py-4">
      <p className={eyebrow}>A lab book for recipe development</p>
      <h1 className="max-w-[24ch] font-ls-serif text-[2rem] leading-[1.1] text-balance sm:text-4xl lg:text-5xl">
        From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.
      </h1>
      <HowItWorks />
      <div className="flex flex-wrap gap-3">
        <SignUpButton mode="modal">
          <Button>Start your lab book</Button>
        </SignUpButton>
      </div>
    </main>
  );
}
