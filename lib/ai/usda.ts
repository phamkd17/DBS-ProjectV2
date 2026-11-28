/**
 * The USDA FoodData Central lookup behind the nutrition tool (issue #14).
 * Server only: the key is read from USDA_API_KEY (falls back to the shared
 * DEMO_KEY, which allows only ~10 lookups an hour) and sent in a header, never
 * in a URL that could end up in logs.
 *
 * Every lookup is cached: in memory always, and on disk in .ai-cache/ outside
 * production. USDA's data is a stable reference database, so caching it doesn't
 * change what the model sees; it only saves the free API limit. (The disk cache
 * stays on for `npm run eval` too: AI_CACHE=off is about Gemini, not USDA.)
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Nutrients per 100 g of the food (all three data types below are per 100 g). */
export type Per100g = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugar_g: number;
  sodium_mg: number;
};
export const NUTRIENTS: (keyof Per100g)[] = ["kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "sodium_mg"];

export type UsdaFood = {
  fdc_id: number;
  description: string;
  data_type: string;
  per_100g: Per100g;
  /** USDA's own household measures, e.g. "1 cup = 245 g" (Survey foods have these). */
  portions: string[];
};

/** USDA is unreachable or over its limit. The message is shown as is. */
export class UsdaError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "UsdaError";
  }
}

const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
// Generic foods only (no brand products): Foundation, SR Legacy, and Survey (FNDDS).
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
const PAGE_SIZE = 5;

type RawNutrient = { nutrientNumber?: string; unitName?: string; value?: number };
type RawFood = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: RawNutrient[];
  foodMeasures?: { disseminationText?: string; gramWeight?: number; rank?: number }[];
};

function toFood(f: RawFood): UsdaFood {
  const by = new Map<string, number>();
  for (const n of f.foodNutrients ?? []) {
    if (n.nutrientNumber && typeof n.value === "number" && !by.has(n.nutrientNumber)) by.set(n.nutrientNumber, n.value);
  }
  // Energy: kcal (208); Foundation foods may only have the Atwater values (957/958) or kJ (268).
  const kj = by.get("268");
  const kcal = by.get("208") ?? by.get("958") ?? by.get("957") ?? (kj !== undefined ? kj / 4.184 : 0);
  const portions = (f.foodMeasures ?? [])
    .filter((m) => m.disseminationText && m.gramWeight && !/quantity not specified/i.test(m.disseminationText))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 6)
    .map((m) => `${m.disseminationText} = ${m.gramWeight} g`);
  return {
    fdc_id: f.fdcId,
    description: f.description,
    data_type: f.dataType,
    per_100g: {
      kcal: Math.round(kcal),
      protein_g: by.get("203") ?? 0,
      fat_g: by.get("204") ?? 0,
      carbs_g: by.get("205") ?? by.get("1050") ?? 0,
      sugar_g: by.get("269") ?? by.get("2000") ?? 0,
      sodium_mg: by.get("307") ?? 0,
    },
    portions,
  };
}

const memory = new Map<string, UsdaFood[]>();
const DIR = join(process.cwd(), ".ai-cache");
const diskCache = process.env.NODE_ENV !== "production";

/** Search USDA for a plain food name. Returns up to 5 generic foods (cached). */
export async function searchFood(rawQuery: string): Promise<UsdaFood[]> {
  const query = rawQuery.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!query) return [];
  const key = createHash("sha256").update(JSON.stringify(["usda-v1", query.toLowerCase()])).digest("hex").slice(0, 32);
  const hit = memory.get(key);
  if (hit) return hit;
  const file = join(DIR, `usda-${key}.json`);
  if (diskCache) {
    try {
      const foods = JSON.parse(await readFile(file, "utf8")) as UsdaFood[];
      memory.set(key, foods);
      return foods;
    } catch {}
  }

  console.log(`[usda] searching "${query}"`);
  let res: Response;
  try {
    res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": process.env.USDA_API_KEY || "DEMO_KEY" },
      body: JSON.stringify({ query, dataType: DATA_TYPES, pageSize: PAGE_SIZE }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new UsdaError("The USDA food database didn't answer. Try again in a minute.", String(err));
  }
  // Draft wording: for the student to review.
  if (res.status === 429) throw new UsdaError("The USDA food database is busy (its free limit is used up). Try again in an hour.");
  if (!res.ok) throw new UsdaError(`The USDA food database isn't working right now (${res.status}). Try again later.`);
  const body = (await res.json()) as { foods?: RawFood[] };
  const foods = (body.foods ?? []).map(toFood);
  memory.set(key, foods);
  if (diskCache) {
    try {
      await mkdir(DIR, { recursive: true });
      await writeFile(file, JSON.stringify(foods));
    } catch {}
  }
  return foods;
}
