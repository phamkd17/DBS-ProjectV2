-- Iterations (issue #9; student, Nov 28): a trial log on each recipe. Each trial
-- records when it was made, what changed, and how it turned out. Hangs off the
-- entry (dictations), like tags and photos, so it survives re-creating a recipe.
-- Additive: v1 never reads it.

create table public.trials (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null default public.requesting_user_id(),
  dictation_id uuid not null references public.dictations(id) on delete cascade,
  tried_on     date not null default current_date,
  changed      text not null default '' check (char_length(changed) <= 1000),
  result       text not null default '' check (char_length(result) <= 2000),
  created_at   timestamptz not null default now()
);
create index trials_entry_idx on public.trials (dictation_id, tried_on, created_at);

alter table public.trials enable row level security;

create policy "owners read their trials" on public.trials
  for select to authenticated using (owner_id = public.requesting_user_id());
-- The entry must be yours (never point a trial at someone else's recipe).
create policy "owners add trials" on public.trials
  for insert to authenticated with check (
    owner_id = public.requesting_user_id()
    and exists (select 1 from public.dictations d
                where d.id = dictation_id and d.owner_id = public.requesting_user_id())
  );
create policy "owners edit their trials" on public.trials
  for update to authenticated
  using (owner_id = public.requesting_user_id())
  with check (owner_id = public.requesting_user_id());
create policy "owners delete their trials" on public.trials
  for delete to authenticated using (owner_id = public.requesting_user_id());

-- Only the text and date can change after a trial is logged (no re-pointing).
revoke all on public.trials from anon, authenticated;
grant select, insert, delete on public.trials to authenticated;
grant update (tried_on, changed, result) on public.trials to authenticated;
