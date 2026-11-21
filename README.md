# Culinary Lab Book

Culinary Lab Book helps cooks turn what they say while they cook into recipes
that can be shared for others to repeat.

Design, Build, Ship (MPCS 51238) · **Project v2** (v1 is tagged `v1`; v1 repo: github.com/phamkd17/DBS-ProjectV1).

**Live (v2):** https://dbs-project-v2.vercel.app · **v1 (as submitted):** https://dbs-project-v1-omega.vercel.app

**Core task:** paste a cook's dictation → the app asks what a new cook couldn't
know → answer, or accept a suggestion → a recipe with every reason labeled by
who said it → send it by link; the recipient saves a copy to their own lab book.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

## Layout

- `app/` — Next.js app (App Router)
- `evals/samples/` — real dictations and their expected checks (never edit the transcripts)
- `lib/ai/` — two-pass Gemini pipeline (schema, prompts, calls)
- `app/actions.ts` — every write: signed-in user → Supabase as that user (RLS) → Gemini on the server
- `supabase/migrations/` — tables + row-level security; `supabase/tests/rls_check.sql` proves it
- `npm run eval` — scores the pipeline on the real dictations
- `notes/build-log.md` — decision log · `notes/talking-points.md` — notes for class
