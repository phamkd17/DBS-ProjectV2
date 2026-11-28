import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { RecipeView } from "@/components/RecipeView";
import { eyebrow, LinkButton } from "@/components/ui";
import type { Recipe } from "@/lib/ai/schema";
import { supabaseAnon } from "@/lib/supabase/server";
import { SaveCopy } from "./SaveCopy";

export const metadata: Metadata = {
  title: "Shared recipe · Culinary Lab Book",
  // Private links shouldn't show up in search engines.
  robots: { index: false, follow: false },
};

type Shared = { title: string; recipe: Recipe; transcript: string; dish_name: string | null; cook_name: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharedRecipePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;

  // No user needed: the database function returns this one recipe only if the token matches.
  let shared: Shared | null = null;
  if (UUID.test(token)) {
    const { data } = await supabaseAnon().rpc("get_shared_recipe", { token }).maybeSingle<Shared>();
    shared = data;
  }

  if (!shared) {
    return (
      <main className="space-y-6 py-6">
        <h1 className="font-ls-serif text-5xl leading-none">This link isn&apos;t shared anymore</h1>
        <p className="max-w-prose text-[17px] leading-relaxed text-ls-muted">
          The person who sent it may have turned the link off. Ask them to send a new one.
        </p>
        <LinkButton href="/" variant="secondary">
          Go to Culinary Lab Book
        </LinkButton>
      </main>
    );
  }

  const { userId } = await auth();

  return (
    <main className="space-y-8">
      <p className={eyebrow}>
        Someone sent you this recipe{shared.cook_name ? `, from ${shared.cook_name}'s kitchen notes` : ""}.
      </p>
      <RecipeView recipe={shared.recipe} transcript={shared.transcript} cookName={shared.cook_name} />
      <SaveCopy token={token} signedIn={!!userId} />
    </main>
  );
}
