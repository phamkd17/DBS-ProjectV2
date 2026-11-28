-- Iterations (issue #9; student, Nov 28): versions of a recipe. Replaces the
-- trial log from 20261128030000_trials.sql (never merged; test data only).
--
-- Each row is one iteration of an entry's recipe: when it was made, the cook's
-- own notes, and its own copy of the recipe (slightly different each time).
-- The row with recipe = null holds the notes and date for the original recipe
-- (iteration 1, in public.recipes). Additive for v1: it never reads this.

drop table if exists public.trials;

create table public.iterations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null default public.requesting_user_id(),
  dictation_id uuid not null references public.dictations(id) on delete cascade,
  made_on      date not null default current_date,
  notes        text not null default '' check (char_length(notes) <= 5000),
  recipe       jsonb check (recipe is null or pg_column_size(recipe) <= 200000),
  created_at   timestamptz not null default now()
);
create index iterations_entry_idx on public.iterations (dictation_id, made_on, created_at);
-- At most one "original recipe" notes row per entry.
create unique index iterations_one_original_idx on public.iterations (dictation_id) where recipe is null;

alter table public.iterations enable row level security;

create policy "owners read their iterations" on public.iterations
  for select to authenticated using (owner_id = public.requesting_user_id());
create policy "owners add iterations" on public.iterations
  for insert to authenticated with check (
    owner_id = public.requesting_user_id()
    and exists (select 1 from public.dictations d
                where d.id = dictation_id and d.owner_id = public.requesting_user_id())
  );
create policy "owners edit their iterations" on public.iterations
  for update to authenticated
  using (owner_id = public.requesting_user_id())
  with check (owner_id = public.requesting_user_id());
create policy "owners delete their iterations" on public.iterations
  for delete to authenticated using (owner_id = public.requesting_user_id());

-- An iteration can't be moved to another entry after it's made.
revoke all on public.iterations from anon, authenticated;
grant select, insert, delete on public.iterations to authenticated;
grant update (made_on, notes, recipe) on public.iterations to authenticated;
