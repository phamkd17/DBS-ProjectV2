-- A photo of the finished dish on a recipe (student, Nov 28), shown beside the
-- title and ingredients. It's an entry photo with kind = 'dish'; inspiration
-- photos stay kind = 'idea'. One dish photo per entry. Additive: v1 never
-- reads entry_photos, and existing rows default to 'idea'. The RLS policies
-- from 20261127000000_photos.sql (own entry, own folder) still apply.

alter table public.entry_photos
  add column kind text not null default 'idea' check (kind in ('idea', 'dish'));

create unique index entry_photos_one_dish_idx on public.entry_photos (dictation_id) where kind = 'dish';
