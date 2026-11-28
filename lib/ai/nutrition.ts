/**
 * Nutrition estimate with tool calling (issue #14; AI focus: "the app calls
 * models itself, with tools, and evals").
 *
 * Gemini gets the recipe's ingredients and two tools:
 *  - search_food(query): we call USDA FoodData Central and return real foods
 *    with nutrients per 100 g and USDA's portion weights;
 *  - report_nutrition(...): its final answer, which USDA food each ingredient
 *    is and how many grams the recipe uses.
 * The model never does the math and never invents numbers: the server checks
 * that every food it names came back from a search, then computes the totals
 * from USDA's values. Only the ingredients and steps are sent (no idea notes).
 *
 * Every Gemini round is one AI request toward the per-user limit.
 */
import { ApiError, FunctionCallingConfigMode, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { z } from "zod";
import { aiCacheGet, aiCacheKey, aiCacheSet } from "./cache";
import { getConfig, ModelError, RateLimitError } from "./pipeline";
import { jsonSchemaFor, type Recipe } from "./schema";
import { NUTRIENTS, searchFood, type Per100g, type UsdaFood } from "./usda";

export const NUTRITION_PROMPT_VERSION = "n3";
const MAX_ROUNDS = 5; // the last round may only report
const MAX_SEARCHES = 40; // per estimate, to protect the USDA limit
const MAX_GRAMS = 10_000; // one ingredient in a home recipe

export type NutritionItem = {
  ingredient: string;
  fdc_id: number;
  food: string;
  grams: number;
  grams_basis: string;
} & Per100g;

export type Nutrition = {
  version: string;
  model: string;
  made_at: string;
  servings: number | null;
  servings_source: "cook" | "suggested";
  items: NutritionItem[];
  skipped: { ingredient: string; reason: string }[];
  total: Per100g;
  /** The ingredients this was made from, to tell when it's out of date. */
  for_ingredients: string;
};

/** Ingredients as text: the same string means the same ingredients. */
export function ingredientsKey(r: Pick<Recipe, "ingredients">) {
  return r.ingredients.map((i) => `${i.amount.trim()}|${i.item.trim()}`.toLowerCase()).join("\n");
}

const SearchArgs = z.object({
  query: z.string().describe('Plain food words, the way USDA names foods, e.g. "milk whole", "sugar granulated", "egg whole raw".'),
});

const ReportArgs = z.object({
  items: z
    .array(
      z.object({
        ingredient: z.string().describe("The ingredient as written in the recipe."),
        fdc_id: z.number().int().describe("The fdc_id of the USDA food it matches. Must come from a search_food result."),
        grams: z.number().describe("How many grams of it the whole recipe uses."),
        grams_basis: z.string().describe('How you got the grams, e.g. "2 eggs × 50 g (USDA: 1 egg = 50 g)" or "1 cup sugar ≈ 200 g".'),
      }),
    )
    .describe("Every ingredient you counted."),
  skipped: z
    .array(
      z.object({
        ingredient: z.string(),
        reason: z.string().describe('Short, e.g. "no amount", "removed before serving", "no calories".'),
      }),
    )
    .describe("Every ingredient you didn't count, and why."),
  servings: z.number().int().describe("How many servings the recipe makes."),
  servings_source: z.enum(["cook", "suggested"]).describe('"cook" if the recipe says it; otherwise "suggested".'),
});
type ReportArgs = z.infer<typeof ReportArgs>;

const TOOLS: FunctionDeclaration[] = [
  {
    name: "search_food",
    description:
      "Search the USDA FoodData Central database. Returns up to 5 generic foods, each with an fdc_id, nutrients per 100 g, and USDA portion weights.",
    parametersJsonSchema: jsonSchemaFor(SearchArgs),
  },
  {
    name: "report_nutrition",
    description: "Give your final answer: the USDA food and grams for each ingredient. The app computes the totals.",
    parametersJsonSchema: jsonSchemaFor(ReportArgs),
  },
];

// Draft prompt: for the student to review.
export const NUTRITION_SYSTEM = `You estimate the nutrition of a home recipe with the USDA FoodData Central database.

Tools:
- search_food(query): returns USDA foods with an fdc_id, nutrients per 100 g, and portion weights.
- report_nutrition(...): your final answer. The app does all the math; never compute totals.

Rules:
1. In your first turn, search for every ingredient that has an amount, all at once (one search_food call per ingredient). Use plain USDA-style words ("milk whole", "sugar granulated", "egg whole raw", "milk sweetened condensed").
   Search again only for an ingredient whose results don't fit, with simpler words. A result fits if it's the same kind of food; it doesn't need to be exact.
   As soon as every ingredient has a fitting result, call report_nutrition.
2. Pick the closest generic match. Only report an fdc_id that a search returned. Never make one up.
3. Convert each amount to grams for the whole recipe. Use a USDA portion weight when one fits ("1 egg = 50 g"); otherwise use a standard kitchen conversion. Say how in grams_basis.
4. Don't invent amounts. Skip an ingredient, with a short reason, when it has no amount ("salt to taste"), is removed before eating (bay leaf, bones, a marinade you throw away), or has no calories (water, ice).
5. servings: use the recipe's own number if it gives one (servings_source "cook"). Otherwise suggest a reasonable number (servings_source "suggested").
6. Every ingredient goes in items or skipped, exactly once.`;

export function nutritionUser(r: Pick<Recipe, "ingredients" | "steps">) {
  const ings = r.ingredients
    .map((i) => `- ${[i.amount, i.item].filter(Boolean).join(" ")}${i.note ? ` (${i.note})` : ""}`)
    .join("\n");
  const steps = r.steps.map((s, n) => `${n + 1}. ${s.text}`).join("\n");
  // No title: the ingredients and steps are enough, and it keeps the dev cache stable.
  return `Ingredients:\n${ings}\n\nInstructions (for servings and what's removed):\n${steps}`.slice(0, 20_000);
}

/** What happened during one estimate, for the eval and the logs. */
export type NutritionTrace = {
  rounds: number;
  geminiCalls: number;
  searches: string[];
  /** fdc_ids the model reported that no search returned (dropped). */
  ungrounded: number[];
  /** Items dropped for impossible grams. */
  badGrams: string[];
  report: ReportArgs | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round1 = (n: number) => Math.round(n * 10) / 10;

async function callModel(contents: Content[], onlyReport: boolean, beforeCall?: () => Promise<void>) {
  const { ai, model, thinkingLevel } = getConfig();
  const config = {
    systemInstruction: NUTRITION_SYSTEM,
    temperature: 0.2,
    maxOutputTokens: 8192,
    tools: [{ functionDeclarations: TOOLS }],
    // ANY: every turn is a tool call. The last round may only report.
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        ...(onlyReport ? { allowedFunctionNames: ["report_nutrition"] } : {}),
      },
    },
    ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
  };
  // Dev-only cache, keyed by the whole conversation so far (USDA answers included).
  const key = aiCacheKey(["nutrition", model, thinkingLevel ?? null, NUTRITION_SYSTEM, TOOLS, onlyReport, contents]);
  const cached = (await aiCacheGet(key)) as Content | undefined;
  if (cached?.parts) {
    console.log(`[ai] cache hit (${key.slice(0, 8)}): no Gemini call`);
    return { content: cached, real: false, model };
  }
  console.log(`[ai] calling Gemini with tools (${model})`);
  const delays = [2000, 8000];
  for (let attempt = 0; ; attempt++) {
    await beforeCall?.(); // each real call counts toward the per-user limit
    try {
      const res = await ai.models.generateContent({ model, contents, config });
      const content = res.candidates?.[0]?.content;
      if (!content?.parts?.length) throw new ModelError("The model returned an empty response.");
      await aiCacheSet(key, content);
      return { content, real: true, model };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      if ((status === 429 || (status !== undefined && status >= 500)) && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      if (status === 429) throw new RateLimitError();
      if (err instanceof ModelError) throw err;
      throw new ModelError(
        `The nutrition helper is unavailable${status ? ` (${status})` : ""}.`,
        err instanceof Error ? err.message.slice(0, 500) : String(err),
      );
    }
  }
}

/** Run the tool loop. Throws ModelError / RateLimitError / UsdaError / AiLimitError. */
export async function estimateNutrition(
  recipe: Pick<Recipe, "title" | "ingredients" | "steps">,
  beforeCall?: () => Promise<void>,
): Promise<{ nutrition: Nutrition; trace: NutritionTrace }> {
  if (recipe.ingredients.length === 0) throw new ModelError("There are no ingredients to count yet.");
  if (recipe.ingredients.length > 60) throw new ModelError("That's too many ingredients to count at once.");

  const seen = new Map<number, UsdaFood>();
  const trace: NutritionTrace = { rounds: 0, geminiCalls: 0, searches: [], ungrounded: [], badGrams: [], report: null };
  const contents: Content[] = [{ role: "user", parts: [{ text: nutritionUser(recipe) }] }];
  let model = "";

  for (let round = 0; round < MAX_ROUNDS && !trace.report; round++) {
    trace.rounds++;
    const res = await callModel(contents, round === MAX_ROUNDS - 1, beforeCall);
    model = res.model;
    if (res.real) trace.geminiCalls++;
    // Send back the model's turn as is (it carries Gemini's thought signatures).
    contents.push({ role: "model", parts: res.content.parts });

    const calls = (res.content.parts ?? []).flatMap((p) => (p.functionCall ? [p.functionCall] : []));
    if (calls.length === 0) throw new ModelError("The model didn't use its tools.");
    const replies: Part[] = [];
    for (const call of calls) {
      if (call.name === "report_nutrition") {
        const parsed = ReportArgs.safeParse(call.args);
        if (parsed.success) {
          trace.report = parsed.data;
          break;
        }
        replies.push({
          functionResponse: { id: call.id, name: call.name, response: { error: "Invalid report: " + parsed.error.issues[0]?.message } },
        });
      } else if (call.name === "search_food") {
        const q = SearchArgs.safeParse(call.args);
        if (!q.success || trace.searches.length >= MAX_SEARCHES) {
          replies.push({
            functionResponse: { id: call.id, name: call.name, response: { error: q.success ? "No more searches. Report now." : "Missing query." } },
          });
          continue;
        }
        trace.searches.push(q.data.query);
        const foods = await searchFood(q.data.query); // UsdaError ends the estimate
        for (const f of foods) seen.set(f.fdc_id, f);
        replies.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: foods.length ? { foods } : { foods: [], note: "No match. Try simpler words." },
          },
        });
      } else {
        replies.push({ functionResponse: { id: call.id, name: call.name, response: { error: "Unknown tool." } } });
      }
    }
    if (!trace.report) contents.push({ role: "user", parts: replies });
  }
  const report = trace.report;
  if (!report) throw new ModelError("The nutrition helper didn't finish.");

  // Check the model's answer against what USDA actually returned, then do the math here.
  const items: NutritionItem[] = [];
  const skipped = [...report.skipped];
  for (const it of report.items) {
    const food = seen.get(it.fdc_id);
    if (!food) {
      trace.ungrounded.push(it.fdc_id);
      skipped.push({ ingredient: it.ingredient, reason: "couldn't match it in USDA" });
      continue;
    }
    if (!(it.grams > 0 && it.grams <= MAX_GRAMS)) {
      trace.badGrams.push(`${it.ingredient}: ${it.grams} g`);
      skipped.push({ ingredient: it.ingredient, reason: "couldn't work out the amount" });
      continue;
    }
    const scaled = Object.fromEntries(NUTRIENTS.map((k) => [k, (food.per_100g[k] * it.grams) / 100])) as Per100g;
    items.push({ ingredient: it.ingredient, fdc_id: food.fdc_id, food: food.description, grams: Math.round(it.grams), grams_basis: it.grams_basis, ...scaled });
  }
  const total = Object.fromEntries(NUTRIENTS.map((k) => [k, round1(items.reduce((s, i) => s + i[k], 0))])) as Per100g;
  for (const i of items) for (const k of NUTRIENTS) i[k] = round1(i[k]);

  return {
    nutrition: {
      version: NUTRITION_PROMPT_VERSION,
      model,
      made_at: new Date().toISOString(),
      servings: report.servings >= 1 && report.servings <= 200 ? report.servings : null,
      servings_source: report.servings_source,
      items,
      skipped,
      total,
      for_ingredients: ingredientsKey(recipe),
    },
    trace,
  };
}
