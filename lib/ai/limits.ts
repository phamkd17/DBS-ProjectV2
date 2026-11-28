import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-user limit on Gemini calls (issue #5; v2 brief: "set a rate limit").
 * One recipe is 1–2 calls (draft, then finish after the questions).
 * Counted from public.ai_calls (owner-only RLS, insert-only, server time).
 * Only real Gemini calls count: dev cache hits don't (see lib/ai/pipeline.ts).
 */
export const AI_LIMITS = {
  perHour: Number(process.env.AI_LIMIT_PER_HOUR) || 20,
  perDay: Number(process.env.AI_LIMIT_PER_DAY) || 50,
};

/** Thrown before calling Gemini when you're over the limit. The message is shown as is. */
export class AiLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiLimitError";
  }
}

function inAbout(ms: number) {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `in about ${min} minute${min === 1 ? "" : "s"}`;
  const h = Math.ceil(min / 60);
  return `in about ${h} hour${h === 1 ? "" : "s"}`;
}

/** Check the limit, then record this call. Throws AiLimitError (no call made) when over. */
export async function recordAiCall(supabase: SupabaseClient, kind: "draft" | "finalize") {
  const now = Date.now();
  const { data, error } = await supabase
    .from("ai_calls")
    .select("created_at")
    .gte("created_at", new Date(now - 24 * 3600_000).toISOString())
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[ai limit read]", error);
    throw new AiLimitError("Couldn't check your AI limit just now. Try again in a minute.");
  }
  const times = (data ?? []).map((r) => Date.parse(r.created_at));
  const lastHour = times.filter((t) => t > now - 3600_000);
  // Draft wording: for the student to review.
  if (times.length >= AI_LIMITS.perDay) {
    throw new AiLimitError(
      `You've used today's ${AI_LIMITS.perDay} AI requests. You can make more ${inAbout(times[0] + 24 * 3600_000 - now)}. Your kitchen notes are saved.`,
    );
  }
  if (lastHour.length >= AI_LIMITS.perHour) {
    throw new AiLimitError(
      `That's ${AI_LIMITS.perHour} AI requests in the last hour. You can make more ${inAbout(lastHour[0] + 3600_000 - now)}. Your kitchen notes are saved.`,
    );
  }
  const { error: insertError } = await supabase.from("ai_calls").insert({ kind });
  if (insertError) {
    console.error("[ai limit record]", insertError);
    throw new AiLimitError("Couldn't check your AI limit just now. Try again in a minute.");
  }
}
