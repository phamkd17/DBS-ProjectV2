-- Nutrition estimates (issue #14) use Gemini with tools; each Gemini round is
-- one AI request toward the same per-user limit, recorded as kind 'nutrition'.
-- Additive: only widens the allowed values. v1 never reads ai_calls.

alter table public.ai_calls drop constraint ai_calls_kind_check;
alter table public.ai_calls
  add constraint ai_calls_kind_check check (kind in ('draft', 'finalize', 'nutrition'));
