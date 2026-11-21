import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { supabaseForUser } from "@/lib/supabase/server";
import { Button, ErrorNote, eyebrow, focusRing, formatDate, LinkButton } from "@/components/ui";
import { MoveTo } from "@/components/MoveTo";
import { HowItWorks } from "@/components/HowItWorks";
import { NewMenu } from "@/components/NewMenu";
import type { DictationRow, RecipeStatus } from "@/lib/types";

type Row = DictationRow & { recipes: { id: string; status: RecipeStatus; recipe: { title?: string } | null }[] };


// Draft wording: for the student to review.
const TABS = {
  ideas: {
    label: "Ideas",
    blurb: "Notes and links to come back to.",
    empty: "No ideas yet.",
  },
  development: {
    label: "Development",
    blurb: "Add the cook's words and make the recipe.",
    empty: "Nothing in development yet.",
  },
  finished: {
    label: "Finished",
    blurb: "Ready to cook, keep, or send.",
    empty: "No finished recipes yet.",
  },
} as const;
type Tab = keyof typeof TABS;


export default async function Home({ searchParams }: PageProps<"/">) {
  const { userId } = await auth();
  if (!userId) return <Landing />;

  const supabase = await supabaseForUser();
  const [{ tab: tabParam }, { data, error }] = await Promise.all([
    searchParams,
    supabase
      .from("dictations")
      .select("*, recipes(id, status, recipe)")
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
  ]);

  const rows = data ?? [];
  const byTab: Record<Tab, Row[]> = { ideas: [], development: [], finished: [] };
  for (const d of rows) byTab[d.stage].push(d);

  // Explicit ?tab= wins; otherwise open where the work is.
  const tab: Tab =
    typeof tabParam === "string" && tabParam in TABS
      ? (tabParam as Tab)
      : byTab.development.length
        ? "development"
        : byTab.finished.length
          ? "finished"
          : "ideas";

  const items = byTab[tab];

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-ls-serif text-5xl leading-none">Your lab book</h1>
        <NewMenu />
      </div>

      {error && <ErrorNote>We couldn&apos;t load your lab book. Refresh the page to try again.</ErrorNote>}

      {rows.length === 0 && !error ? (
        <FirstRun />
      ) : (
        <>
          <nav aria-label="Lab book sections" className="border-b border-ls-border">
            <ul className="flex gap-6 sm:gap-8">
              {(Object.keys(TABS) as Tab[]).map((t) => {
                const active = t === tab;
                return (
                  <li key={t}>
                    <Link
                      href={`/?tab=${t}`}
                      aria-current={active ? "page" : undefined}
                      className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] transition-colors duration-150 ${focusRing} ${
                        active
                          ? "border-ls-ink text-ls-ink"
                          : "border-transparent text-ls-muted hover:border-ls-rule hover:text-ls-ink active:border-ls-border"
                      }`}
                    >
                      {TABS[t].label}
                      <span className="tabular-nums text-ls-muted">{byTab[t].length}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-ls-muted">{TABS[tab].blurb}</p>
            {tab === "ideas" && (
              <LinkButton href="/ideas/new" variant="secondary">
                + New idea
              </LinkButton>
            )}
          </div>

          {items.length === 0 ? (
            <p className="border border-dashed border-ls-border p-6 text-[15px] text-ls-muted">{TABS[tab].empty}</p>
          ) : (
            <ul className="divide-y divide-ls-border border-y border-ls-ink">
              {items.map((d) => (
                <EntryCard key={d.id} d={d} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function EntryCard({ d }: { d: Row }) {
  const r = d.recipes[0];
  const title = r?.recipe?.title || d.dish_name || "Untitled dictation";
  const href = r ? `/r/${r.id}` : `/d/${d.id}`;
  const next = r
    ? r.status === "ready"
      ? null
      : "Answer questions"
    : d.stage === "development"
      ? d.transcript
        ? "Create recipe"
        : "Add the cook's words"
      : null;
  const preview = d.notes || d.transcript;
  return (
    <li className="pb-1">
      <Link
        href={href}
        className={`group block px-1 pt-4 pb-1 transition-colors hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="truncate font-ls-serif text-2xl leading-tight">{title}</p>
            <p className={eyebrow}>
              {d.cook_name ? `${d.cook_name} · ` : ""}
              {formatDate(d.created_at)}
              {d.copied_from ? " · from a link" : ""}
              {d.link ? " · has a link" : ""}
            </p>
          </div>
          {next && (
            <span className="shrink-0 pt-1 text-xs font-medium uppercase tracking-[0.18em] underline decoration-ls-rule underline-offset-4 group-hover:decoration-ls-ink">
              {next}
            </span>
          )}
        </div>
        {preview && <p className="mt-2 line-clamp-2 text-[15px] text-ls-muted">{preview}</p>}
      </Link>
      <div className="px-1">
        <MoveTo kind="dictation" id={d.id} current={d.stage} />
      </div>
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
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/ideas/new" variant="secondary">
          Save an idea
        </LinkButton>
        <LinkButton href="/new" variant="secondary">
          Add the cook&apos;s words
        </LinkButton>
      </div>
    </section>
  );
}

function Landing() {
  return (
    <main className="space-y-8 py-8">
      <p className={eyebrow}>A lab book for recipe development</p>
      <h1 className="font-ls-serif text-[2.5rem] leading-[1.05] text-balance sm:text-7xl">
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
