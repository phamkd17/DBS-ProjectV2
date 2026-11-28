-- Deleting the cook's words (student, Nov 21) really deletes them: when the
-- transcript is set to null, the kept first version (original_transcript) and
-- edited_at are cleared too. Otherwise unchanged. Backward-compatible with v1:
-- v1's code never sets the transcript to null.
create or replace function public.track_transcript_edits()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.transcript is null and old.transcript is not null then
    -- Deleted: remove every copy of the words.
    new.original_transcript := null;
    new.edited_at := null;
  elsif new.transcript is distinct from old.transcript and old.transcript is not null then
    -- Edited: keep the very first version, once.
    new.original_transcript := coalesce(old.original_transcript, old.transcript);
    new.edited_at := now();
  else
    -- First words added, or no change: clients can't rewrite history directly.
    new.original_transcript := old.original_transcript;
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;
