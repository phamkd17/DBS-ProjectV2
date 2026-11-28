-- Sections for the Recipes tab (student, Nov 21; issue #8): each user makes and
-- deletes their own (e.g. American, Indian, Mexican, Desserts), and a recipe can
-- be in several. Additive only: v1 never reads these tables.

create table public.sections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null default public.requesting_user_id(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
-- No two sections with the same name (ignoring case) in one lab book.
create unique index sections_owner_name_idx on public.sections (owner_id, lower(btrim(name)));

alter table public.sections enable row level security;

create policy "owners read their sections" on public.sections
  for select to authenticated using (owner_id = public.requesting_user_id());
create policy "owners add sections" on public.sections
  for insert to authenticated with check (owner_id = public.requesting_user_id());
create policy "owners delete their sections" on public.sections
  for delete to authenticated using (owner_id = public.requesting_user_id());

-- Which entries are in which sections. Deleting a section or an entry removes
-- the link only; recipes are never deleted with a section.
create table public.entry_sections (
  dictation_id uuid not null references public.dictations(id) on delete cascade,
  section_id   uuid not null references public.sections(id) on delete cascade,
  owner_id     text not null default public.requesting_user_id(),
  primary key (dictation_id, section_id)
);
create index entry_sections_section_idx on public.entry_sections (section_id);

alter table public.entry_sections enable row level security;

create policy "owners read their entry sections" on public.entry_sections
  for select to authenticated using (owner_id = public.requesting_user_id());
-- Both ends must be yours (the Nov 14 lesson: never let a row point at someone else's).
create policy "owners add entry sections" on public.entry_sections
  for insert to authenticated with check (
    owner_id = public.requesting_user_id()
    and exists (select 1 from public.dictations d
                where d.id = dictation_id and d.owner_id = public.requesting_user_id())
    and exists (select 1 from public.sections s
                where s.id = section_id and s.owner_id = public.requesting_user_id())
  );
create policy "owners remove entry sections" on public.entry_sections
  for delete to authenticated using (owner_id = public.requesting_user_id());

-- Least privilege: signed-out visitors get nothing; no updates at all
-- (rename = not offered; re-pointing a link = delete + insert, which is re-checked).
revoke all on public.sections, public.entry_sections from anon, authenticated;
grant select, insert, delete on public.sections, public.entry_sections to authenticated;
