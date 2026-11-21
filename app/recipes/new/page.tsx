import Link from "next/link";
import { ManualRecipeForm } from "@/components/ManualRecipeForm";
import { eyebrow, textLink } from "@/components/ui";

export const metadata = { title: "New recipe · Culinary Lab Book" };

export default function NewRecipePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <p className={eyebrow}>
          <Link href="/?tab=finished" className={textLink}>
            Recipes
          </Link>
        </p>
        <h1 className="font-ls-serif text-5xl leading-none">New recipe</h1>
        <p className="text-[17px] text-ls-muted">Type in a recipe you already know. No AI needed.</p>
      </div>
      <ManualRecipeForm />
    </main>
  );
}
