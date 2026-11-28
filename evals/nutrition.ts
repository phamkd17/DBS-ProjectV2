/**
 * Nutrition eval (issue #14): the tool-calling loop on recipes with known answers.
 *
 *   npm run eval:nutrition            # all cases
 *   npm run eval:nutrition -- flan    # one case
 *
 * Expected grams and calories were worked out by hand from USDA values
 * (e.g. 1 cup whole milk = 244 g, 61 kcal / 100 g). The model only has to find
 * the right foods and grams; the app does the math. Results are saved to
 * evals/results/<timestamp>_nutrition_<version>_<model>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateNutrition, NUTRITION_PROMPT_VERSION } from "../lib/ai/nutrition";
import type { Recipe } from "../lib/ai/schema";

type Check = { name: string; pass: boolean; must?: boolean; detail?: string };

type Case = {
  name: string;
  recipe: Pick<Recipe, "title" | "ingredients" | "steps">;
  /** Ingredient (regex on its name) → grams for the whole recipe, and a word the USDA food must contain. */
  expect: { re: RegExp; grams: number; food: RegExp }[];
  mustSkip: RegExp[];
  kcal: number;
  kcalTolerance: number;
  servings?: number; // stated by the cook
};

const ing = (amount: string, item: string): Recipe["ingredients"][number] => ({ item, amount, source: "cook", note: "", from_answers: [] });
const step = (text: string): Recipe["steps"][number] => ({ text, from_answers: [], why: [], dials: [] });

const CASES: Case[] = [
  {
    name: "yogurt",
    recipe: {
      title: "Homemade yogurt",
      ingredients: [ing("1/2 gallon", "whole milk"), ing("2 tablespoons", "plain yogurt with live cultures")],
      steps: [step("Heat the milk to 180°F, then cool it to 110°F."), step("Stir in the yogurt."), step("Keep warm for 8 to 12 hours.")],
    },
    // 1/2 gallon = 8 cups × 244 g = 1952 g × 61 kcal/100 g ≈ 1191; 2 tbsp yogurt ≈ 30 g ≈ 18 kcal.
    expect: [
      { re: /milk/i, grams: 1952, food: /milk/i },
      { re: /yogurt/i, grams: 30, food: /yogurt/i },
    ],
    mustSkip: [],
    kcal: 1210,
    kcalTolerance: 0.2,
  },
  {
    name: "flan",
    recipe: {
      title: "Flan",
      ingredients: [
        ing("1 cup", "sugar"),
        ing("5", "large eggs"),
        ing("1 can (14 oz)", "sweetened condensed milk"),
        ing("1 can (12 oz)", "evaporated milk"),
        ing("1 teaspoon", "vanilla extract"),
        ing("", "salt, to taste"),
      ],
      steps: [
        step("Melt the sugar in a pan until amber and pour it into the mold."),
        step("Blend the eggs, both milks, vanilla, and a pinch of salt."),
        step("Bake in a water bath at 350°F for 1 hour. Serves 8."),
      ],
    },
    // sugar 200 g × 387 = 774; eggs 250 g × 143 = 358; condensed 397 g × 321 = 1274;
    // evaporated ~370 g × 134 ≈ 496; vanilla 4 g × 288 ≈ 12. Total ≈ 2914.
    expect: [
      { re: /^sugar/i, grams: 200, food: /sugar/i },
      { re: /egg/i, grams: 250, food: /egg/i },
      { re: /condensed/i, grams: 397, food: /condensed/i },
      { re: /evaporated/i, grams: 370, food: /evaporated/i },
    ],
    mustSkip: [/salt/i],
    kcal: 2914,
    kcalTolerance: 0.2,
    servings: 8,
  },
  {
    name: "tomato-soup",
    recipe: {
      title: "Tomato soup",
      ingredients: [
        ing("2 tablespoons", "olive oil"),
        ing("1 medium", "onion"),
        ing("2 lb", "tomatoes"),
        ing("4 cups", "water"),
        ing("1", "bay leaf"),
        ing("", "salt and pepper, to taste"),
      ],
      steps: [
        step("Cook the onion in the oil until soft."),
        step("Add the tomatoes, water, and bay leaf and simmer for 30 minutes."),
        step("Take out the bay leaf, blend, and season."),
      ],
    },
    // oil 27 g × 884 = 239; onion 110 g × 40 = 44; tomatoes 907 g × 18 = 163. Total ≈ 446.
    expect: [
      { re: /oil/i, grams: 27, food: /oil/i },
      { re: /onion/i, grams: 110, food: /onion/i },
      { re: /tomato/i, grams: 907, food: /tomato/i },
    ],
    mustSkip: [/water/i, /bay/i, /salt/i],
    kcal: 446,
    kcalTolerance: 0.25,
  },
];

const within = (got: number, want: number, tol: number) => Math.abs(got - want) <= want * tol;

async function runCase(c: Case) {
  const started = Date.now();
  const { nutrition: n, trace } = await estimateNutrition(c.recipe);
  const checks: Check[] = [];
  const L = c.name;

  checks.push({
    name: `${L}: every food came from a USDA search (no made-up fdc_id)`,
    must: true,
    pass: trace.ungrounded.length === 0,
    detail: trace.ungrounded.join(", ") || undefined,
  });
  const names = [...n.items.map((i) => i.ingredient), ...n.skipped.map((s) => s.ingredient)];
  const missing = c.recipe.ingredients.filter((i) => !names.some((nm) => nm.toLowerCase().includes(i.item.split(/[ ,]/)[0].toLowerCase())));
  checks.push({
    name: `${L}: every ingredient is counted or skipped with a reason`,
    must: true,
    pass: missing.length === 0 && n.items.length + n.skipped.length === c.recipe.ingredients.length,
    detail: `${n.items.length} counted + ${n.skipped.length} skipped of ${c.recipe.ingredients.length}${missing.length ? `; missing ${missing.map((m) => m.item).join(", ")}` : ""}`,
  });
  for (const re of c.mustSkip) {
    const counted = n.items.find((i) => re.test(i.ingredient));
    checks.push({
      name: `${L}: skips ${re.source} (no amount, removed, or no calories)`,
      must: true,
      pass: !counted,
      detail: counted ? `counted ${counted.grams} g` : n.skipped.find((s) => re.test(s.ingredient))?.reason,
    });
  }
  for (const e of c.expect) {
    const it = n.items.find((i) => e.re.test(i.ingredient));
    checks.push({
      name: `${L}: ${e.re.source} matches a USDA ${e.food.source} food`,
      pass: !!it && e.food.test(it.food),
      detail: it ? `${it.food} (${it.fdc_id})` : "not counted",
    });
    checks.push({
      name: `${L}: ${e.re.source} ≈ ${e.grams} g (±35%)`,
      pass: !!it && within(it.grams, e.grams, 0.35),
      detail: it ? `${it.grams} g: ${it.grams_basis}` : "not counted",
    });
  }
  checks.push({
    name: `${L}: total ≈ ${c.kcal} kcal (±${c.kcalTolerance * 100}%)`,
    pass: within(n.total.kcal, c.kcal, c.kcalTolerance),
    detail: `${n.total.kcal} kcal`,
  });
  checks.push(
    c.servings
      ? { name: `${L}: uses the cook's servings (${c.servings})`, pass: n.servings === c.servings && n.servings_source === "cook", detail: `${n.servings} (${n.servings_source})` }
      : { name: `${L}: servings not stated → labeled suggested`, pass: n.servings_source === "suggested", detail: `${n.servings} (${n.servings_source})` },
  );
  return { name: c.name, ms: Date.now() - started, nutrition: n, trace, checks };
}

async function main() {
  const only = process.argv[2];
  const cases = CASES.filter((c) => !only || c.name === only);
  const results = [];
  for (const c of cases) {
    process.stdout.write(`\n== ${c.name} ==\n`);
    try {
      const r = await runCase(c);
      for (const ch of r.checks) console.log(`${ch.pass ? "✓" : ch.must ? "✗ MUST" : "✗"} ${ch.name}${ch.detail ? `  [${ch.detail}]` : ""}`);
      console.log(`  ${r.trace.rounds} rounds, ${r.trace.geminiCalls} Gemini calls, ${r.trace.searches.length} USDA searches, ${(r.ms / 1000).toFixed(1)} s`);
      results.push(r);
    } catch (err) {
      console.log("✗ MUST", c.name, "failed:", err instanceof Error ? `${err.message} ${(err as { detail?: string }).detail ?? ""}` : err);
      results.push({ name: c.name, error: String(err), checks: [{ name: `${c.name}: runs`, pass: false, must: true }] });
    }
  }
  const all = results.flatMap((r) => r.checks);
  const must = all.filter((c) => c.must);
  console.log(`\n${all.filter((c) => c.pass).length}/${all.length} checks · must-pass ${must.filter((c) => c.pass).length}/${must.length}`);
  const model = process.env.GEMINI_MODEL ?? "unknown";
  mkdirSync(join(__dirname, "results"), { recursive: true });
  const file = join(__dirname, "results", `${new Date().toISOString().replace(/[:.]/g, "-")}_nutrition_${NUTRITION_PROMPT_VERSION}_${model}.json`);
  writeFileSync(file, JSON.stringify({ model, version: NUTRITION_PROMPT_VERSION, results }, null, 2));
  console.log("saved", file);
}

main();
