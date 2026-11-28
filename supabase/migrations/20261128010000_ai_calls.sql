-- Per-user limit on AI calls (issue #5; v2 brief: "set a rate limit and a token
-- cap"). One row per real Gemini call (not dev cache hits). The server counts
-- your rows in the last hour/day before calling. Additive: v1 never reads it.

create table public.ai_calls (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null default public.requesting_user_id(),
  kind       text not null check (kind in ('draft', 'finalize')),
  created_at timestamptz not null default now()
);
create index ai_calls_owner_time_idx on public.ai_calls (owner_id, created_at desc);

alter table public.ai_calls enable row level security;

create policy "owners read their ai calls" on public.ai_calls
  for select to authenticated using (owner_id = public.requesting_user_id());
create policy "owners record their ai calls" on public.ai_calls
  for insert to authenticated with check (owner_id = public.requesting_user_id());

-- No update or delete: you can't erase your history to get around the limit.
-- created_at can't be set by the client either (insert only names `kind`).
revoke all on public.ai_calls from anon, authenticated;
grant select on public.ai_calls to authenticated;
grant insert (kind) on public.ai_calls to authenticated;
