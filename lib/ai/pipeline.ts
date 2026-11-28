import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import {
  Answer,
  jsonSchemaFor,
  Pass1Output,
  Recipe,
} from "./schema";
import { aiCacheGet, aiCacheKey, aiCacheSet } from "./cache";
import {
  PASS1_SYSTEM,
  PASS2_SYSTEM,
  PROMPT_VERSION,
  pass1User,
  pass2User,
} from "./prompts";

/** Thrown when Gemini's free-tier rate limit is hit and retries ran out. */
export class RateLimitError extends Error {
  constructor() {
    super("The recipe helper is busy right now. Try again in a minute.");
    this.name = "RateLimitError";
  }
}

/** Thrown when the model is down, or returns something we can't use. */
export class ModelError extends Error {
  /** Raw detail for server logs and evals. Never shown to users. */
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "ModelError";
    this.detail = detail;
  }
}

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey) throw new ModelError("GEMINI_API_KEY is not set.");
  if (!model) throw new ModelError("GEMINI_MODEL is not set.");
  // Optional: GEMINI_THINKING=MINIMAL|LOW|MEDIUM|HIGH (unset = model default).
  const level = process.env.GEMINI_THINKING?.toUpperCase();
  const thinkingLevel =
    level && level in ThinkingLevel ? (level as ThinkingLevel) : undefined;
  return {
    // Give up after 90 s so a phone never waits forever.
    ai: new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } }),
    model,
    thinkingLevel,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Token cap (issue #5; v2 brief: "set a token cap"). Output includes thinking
 * tokens; a full recipe is a few thousand. Input is capped elsewhere (kitchen
 * notes ≤ 20,000 characters, answers ≤ 2,000 each).
 */
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 16_384;

async function generate<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  /** Runs right before a real Gemini call (not on a dev cache hit): the per-user limit. */
  beforeCall?: () => Promise<void>,
): Promise<{ data: T; model: string; ms: number }> {
  const { ai, model, thinkingLevel } = getConfig();
  const started = Date.now();
  const delays = [2000, 8000];
  const responseJsonSchema = jsonSchemaFor(schema);

  // Dev-only: reuse an identical earlier response instead of spending quota.
  const cacheKey = aiCacheKey([model, thinkingLevel ?? null, system, user, responseJsonSchema]);
  const cached = schema.safeParse(await aiCacheGet(cacheKey));
  if (cached.success) {
    console.log(`[ai] cache hit (${cacheKey.slice(0, 8)}): no Gemini call`);
    return { data: cached.data, model, ms: 0 };
  }
  await beforeCall?.(); // throws AiLimitError when over the limit: no call is made
  console.log(`[ai] calling Gemini (${model})`);

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseJsonSchema,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      });
      if (res.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        throw new ModelError("The recipe came out too long for one answer. Try shorter kitchen notes, or split them.");
      }
      const text = res.text;
      if (!text) throw new ModelError("The model returned an empty response.");
      const parsed = schema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new ModelError(
          "The model's answer didn't match the recipe format: " +
            parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ")
        );
      }
      await aiCacheSet(cacheKey, parsed.data);
      return { data: parsed.data, model, ms: Date.now() - started };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (retryable && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      if (status === 429) throw new RateLimitError();
      if (err instanceof ModelError) throw err;
      if (err instanceof SyntaxError)
        throw new ModelError("The model returned malformed JSON.");
      throw new ModelError(
        `The recipe helper is unavailable${status ? ` (${status})` : ""}.`,
        err instanceof Error ? err.message.slice(0, 500) : String(err)
      );
    }
  }
}

/** Pass 1: transcript → draft recipe + questions. */
export async function draftRecipe(transcript: string, dishName?: string, beforeCall?: () => Promise<void>) {
  const { data, model, ms } = await generate(
    Pass1Output,
    PASS1_SYSTEM,
    pass1User(transcript, dishName),
    beforeCall,
  );
  return { ...data, model, ms, prompt_version: PROMPT_VERSION };
}

/** Pass 2: transcript + draft + answers → final recipe. */
export async function finalizeRecipe(
  transcript: string,
  draft: Recipe,
  answers: Answer[],
  beforeCall?: () => Promise<void>,
) {
  const answersForModel = answers.map((a) => ({
    kind: a.question.kind,
    quote: a.question.quote,
    question: a.question.question,
    answer: a.answer_source === "skipped" ? "" : a.answer,
    answer_source: a.answer_source,
  }));
  const { data, model, ms } = await generate(
    Recipe,
    PASS2_SYSTEM,
    pass2User(
      transcript,
      JSON.stringify(draft, null, 2),
      JSON.stringify(answersForModel, null, 2)
    ),
    beforeCall,
  );
  return { recipe: data, model, ms, prompt_version: PROMPT_VERSION };
}
