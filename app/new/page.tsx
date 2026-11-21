import { NewDictationForm } from "./NewDictationForm";

export const metadata = { title: "New dictation · Culinary Lab Book" };

export default async function NewDictationPage({ searchParams }: PageProps<"/new">) {
  const { dish } = await searchParams;
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-ls-serif text-5xl leading-none">New dictation</h1>
        <p className="text-[17px] text-ls-muted">Have the cook say the ingredients, then each step. The AI turns it into a recipe.</p>
      </div>
      <NewDictationForm defaultDish={typeof dish === "string" ? dish.slice(0, 120) : ""} />
    </main>
  );
}
