import type { AnswerSource, Question, QuestionKind, Recipe } from "./ai/schema";

export const STAGES = ["ideas", "development", "finished"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  ideas: "Ideas",
  development: "Development",
  // Shown as "Recipes" (student, Nov 20); the stored value stays "finished" (v1 shares the DB).
  finished: "Recipes",
};
export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

export type IdeaRow = {
  id: string;
  owner_id: string;
  title: string;
  note: string;
  link: string | null;
  stage: Stage;
  created_at: string;
  updated_at: string;
};

export type DictationRow = {
  id: string;
  owner_id: string;
  stage: Stage;
  dish_name: string | null;
  cook_name: string | null;
  /** Idea notes + link: the user's own notes. Kept in every stage. */
  notes: string;
  link: string | null;
  /** The cook's words. Optional until someone adds them. */
  transcript: string | null;
  original_transcript: string | null;
  edited_at: string | null;
  copied_from: string | null;
  created_at: string;
};

export type RecipeStatus = "needs_answers" | "ready" | "failed";

export type RecipeRow = {
  id: string;
  owner_id: string;
  dictation_id: string;
  status: RecipeStatus;
  draft: (Recipe & { scan?: unknown }) | null;
  recipe: Recipe | null;
  model: string | null;
  prompt_version: string | null;
  share_token: string | null;
  copied_from: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionRow = {
  id: string;
  recipe_id: string;
  position: number;
  kind: QuestionKind;
  quote: string;
  question: string;
  why_it_matters: string;
  suggestion: string;
  answer: string | null;
  answer_source: AnswerSource | null;
  answered_at: string | null;
};

export function toQuestion(q: QuestionRow): Question {
  return {
    kind: q.kind,
    quote: q.quote,
    question: q.question,
    why_it_matters: q.why_it_matters,
    suggestion: q.suggestion,
  };
}

/** Result shape for server actions used with useActionState. */
export type ActionState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

// Tags in the Recipes tab (student, Nov 21). Your own list; a recipe can have several.
// Stored in the `sections` table (they were first called sections).
export type TagRow = { id: string; name: string; created_at: string };
/** Offered when you have no tags yet. Draft names: for the student to review. */
export const STARTER_TAGS = ["American", "Indian", "Mexican", "Desserts"];

// ---------------------------------------------------------------------------
// Parts of a recipe (student, Nov 28): e.g. a flan's "Caramel sauce", "Milk",
// "Egg mixture". Stored as an optional `section` on each ingredient and step
// in the recipe JSON (not part of the AI's output schema; older recipes have none).
// ---------------------------------------------------------------------------
export const cleanPart = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 60);

/** The parts in the order they first appear. */
export function partsOf(items: { section?: string }[]): string[] {
  const seen: string[] = [];
  for (const x of items) {
    const p = cleanPart(x.section);
    if (p && !seen.includes(p)) seen.push(p);
  }
  return seen;
}

/** Ingredients grouped by part (items with no part first), keeping their order within each part. */
export function groupByPart<T extends { section?: string }>(items: T[]): { part: string; items: { item: T; index: number }[] }[] {
  const order = ["", ...partsOf(items)];
  return order
    .map((part) => ({ part, items: items.map((item, index) => ({ item, index })).filter(({ item }) => cleanPart(item.section) === part) }))
    .filter((g) => g.items.length > 0);
}

/** Steps stay in order; a new run starts whenever the part changes. */
export function runsByPart<T extends { section?: string }>(items: T[]): { part: string; items: { item: T; index: number }[] }[] {
  const runs: { part: string; items: { item: T; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const part = cleanPart(item.section);
    const last = runs[runs.length - 1];
    if (last && last.part === part) last.items.push({ item, index });
    else runs.push({ part, items: [{ item, index }] });
  });
  return runs;
}
