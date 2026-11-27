import { NewDictationForm } from "./NewDictationForm";

export const metadata = { title: "New kitchen notes · Culinary Lab Book" };

export default async function NewDictationPage({ searchParams }: PageProps<"/new">) {
  const { dish } = await searchParams;
  return (
    <main className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-ls-serif text-5xl leading-none">New kitchen notes</h1>
        <p className="text-[17px] text-ls-muted">Dictate or paste rough instructions. The AI turns them into a recipe.</p>
      </div>
      <NewDictationForm defaultDish={typeof dish === "string" ? dish.slice(0, 120) : ""} />
    </main>
  );
}
