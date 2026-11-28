-- Photos on ideas (student, Nov 27; issue #7). An idea can be text, a photo,
-- or both. Additive only: v1 never reads these.
--
-- Files live in a PRIVATE Storage bucket under "<owner id>/<entry id>/<file>".
-- Nobody can list, read, add, or delete another person's folder. The app shows
-- photos with short-lived signed URLs made on the server.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "owners read their photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.requesting_user_id());
create policy "owners add photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.requesting_user_id());
create policy "owners delete their photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.requesting_user_id());
-- No update policy: a photo is replaced by deleting it and adding a new one.

-- Which photos belong to which entry, in order.
create table public.entry_photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null default public.requesting_user_id(),
  dictation_id uuid not null references public.dictations(id) on delete cascade,
  path         text not null unique check (char_length(path) <= 300),
  created_at   timestamptz not null default now()
);
create index entry_photos_entry_idx on public.entry_photos (dictation_id, created_at);

alter table public.entry_photos enable row level security;

create policy "owners read their entry photos" on public.entry_photos
  for select to authenticated using (owner_id = public.requesting_user_id());
-- The entry must be yours, and the file must be in your own folder for that entry.
create policy "owners add entry photos" on public.entry_photos
  for insert to authenticated with check (
    owner_id = public.requesting_user_id()
    and exists (select 1 from public.dictations d
                where d.id = dictation_id and d.owner_id = public.requesting_user_id())
    and starts_with(path, public.requesting_user_id() || '/' || dictation_id::text || '/')  -- exact (no LIKE wildcards)
  );
create policy "owners delete their entry photos" on public.entry_photos
  for delete to authenticated using (owner_id = public.requesting_user_id());

revoke all on public.entry_photos from anon, authenticated;
grant select, insert, delete on public.entry_photos to authenticated;
