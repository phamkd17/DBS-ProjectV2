-- No original versions (student, Nov 21: doesn't need the first version kept).
-- Editing the cook's words just replaces them; only edited_at is kept (so a
-- recipe made before an edit can say so). Deleting clears edited_at too.
-- Existing kept originals are cleared. The original_transcript column stays
-- (additive-only rule: v1 still reads it, and simply shows nothing).
create or replace function public.track_transcript_edits()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.original_transcript := null; -- never kept
  if new.transcript is null and old.transcript is not null then
    new.edited_at := null;         -- deleted
  elsif new.transcript is distinct from old.transcript and old.transcript is not null then
    new.edited_at := now();        -- edited
  else
    new.edited_at := old.edited_at; -- first words added, or no change
  end if;
  return new;
end $$;

update public.dictations set original_transcript = null where original_transcript is not null;
