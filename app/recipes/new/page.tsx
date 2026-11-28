import Link from "next/link";
import { ManualRecipeForm } from "@/components/ManualRecipeForm";
import { eyebrow, textLink } from "@/components/ui";
import { supabaseForUser } from "@/lib/supabase/server";
import type { DictationRow } from "@/lib/types";

export const metadata = { title: "New recipe · Culinary Lab Book" };

export default async function NewRecipePage({ searchParams }: PageProps<"/recipes/new">) {
  const { from } = await searchParams;
  // Writing it for an item in Development? Prefill from that item (RLS: only your own).
  let entry: DictationRow | null = null;
  if (typeof from === "string" && /^[0-9a-f-]{36}$/i.test(from)) {
    const supabase = await supabaseForUser();
    const { data } = await supabase.from("dictations").select("*").eq("id", from).maybeSingle<DictationRow>();
    entry = data;
  }
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href={entry ? `/d/${entry.id}` : "/?tab=finished"} className={textLink}>
            {entry ? entry.dish_name || "Back" : "Recipes"}
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">{entry ? "Write the recipe" : "New recipe"}</h1>
        <p className="text-[17px] text-ls-muted">
          {entry ? "Write it yourself, no AI. It moves to Recipes when you save." : "Type in a recipe you already know. No AI needed."}
        </p>
      </div>
      <ManualRecipeForm
        from={entry ? { id: entry.id, title: entry.dish_name ?? "", cook_name: entry.cook_name ?? "", notes: entry.notes } : undefined}
      />
    </main>
  );
}
