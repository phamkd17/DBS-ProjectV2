import Link from "next/link";
import { IdeaForm } from "@/components/IdeaForm";
import { eyebrow, textLink } from "@/components/ui";

export const metadata = { title: "New idea · Culinary Lab Book" };

export default async function NewIdeaPage({ searchParams }: PageProps<"/ideas/new">) {
  const { added, n } = await searchParams;
  const justAdded = typeof added === "string" ? added.slice(0, 120) : null;
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href="/?tab=ideas" className={textLink}>
            Ideas
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">New idea</h1>
        <p className="text-[17px] text-ls-muted">Something to make someday. A note or a link is enough.</p>
      </div>
      {justAdded && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-ls-success bg-ls-surface px-4 py-3 text-[15px]">
          <span>
            <span aria-hidden className="text-ls-success">✓ </span>Saved “{justAdded}” to Ideas. Add the next one.
          </span>
          <Link href="/?tab=ideas" className={textLink}>
            See all ideas
          </Link>
        </p>
      )}
      {/* A new key resets the form for the next idea. */}
      <IdeaForm key={typeof n === "string" ? n : "first"} />
    </main>
  );
}
