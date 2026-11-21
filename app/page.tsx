import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { supabaseForUser } from "@/lib/supabase/server";
import { Button, ErrorNote, eyebrow, focusRing, formatDate, LinkButton } from "@/components/ui";
import { MoveTo } from "@/components/MoveTo";
import { QuickAddIdea } from "@/components/QuickAddIdea";
import { HowItWorks } from "@/components/HowItWorks";
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

  // Explicit ?tab= wins; otherwise open where the work is. Redirect so the URL
  // (and the header tabs) always say which section is open.
  if (!(typeof tabParam === "string" && tabParam in TABS)) {
    redirect(`/?tab=${byTab.development.length ? "development" : byTab.finished.length ? "finished" : "ideas"}`);
  }
  const tab = tabParam as Tab;

  const items = byTab[tab];

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-ls-serif text-5xl leading-none">Your lab book</h1>
        {/* One start button per tab, for what you do there (student, Nov 20). */}
        {tab === "ideas" ? null : tab === "development" ? (
          <LinkButton href="/new">+ Cook&apos;s words</LinkButton>
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
