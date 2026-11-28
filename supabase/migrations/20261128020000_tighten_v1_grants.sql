-- Security pass (#6), defense in depth. The four v1 tables still had Supabase's
-- default table grants: anon could INSERT/SELECT/DELETE (blocked by RLS: every
-- policy is `to authenticated`) and both roles had TRUNCATE/TRIGGER/REFERENCES
-- (TRUNCATE ignores RLS, but PostgREST can't issue it). Not exploitable through
-- the API, but broader than needed. This matches the v2 tables: signed-out
-- visitors get nothing (shared links go through get_shared_recipe), and
-- signed-in users keep exactly what v1 and v2 use (select/insert/delete + the
-- existing column-level UPDATE grants). Backward-compatible with v1.

revoke all on public.dictations, public.ideas, public.recipes, public.recipe_questions from anon;
revoke truncate, trigger, references on public.dictations, public.ideas, public.recipes, public.recipe_questions from authenticated;
