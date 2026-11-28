# Culinary Lab Book

Culinary Lab Book helps cooks turn what they say while they cook into recipes
that can be shared for others to repeat.

Design, Build, Ship (MPCS 51238) · **Project v2** (v1 is tagged `v1`; v1 repo: github.com/phamkd17/DBS-ProjectV1).

**Live (v2):** https://dbs-project-v2.vercel.app · **v1 (as submitted):** https://dbs-project-v1-omega.vercel.app

**Core task:** paste a cook's dictation → the app asks what a new cook couldn't
know → answer, or accept a suggestion → a recipe with every reason labeled by
who said it → send it by link; the recipient saves a copy to their own lab book.

## How to use it

1. **Ideas:** tap **New → Idea** to save what inspires you: a name, a note, a
   link. Use **Save and add another** to jot down several in a row.
2. **Development:** open an idea and tap **Move to Development**. Add the
   cook's words: type or dictate the ingredients, then each step (the phone's 🎤
   works). Tick **I'm ready** and tap **Create recipe with AI**. Answer what
   you know, or tap **Use suggestion**.
3. **Recipes:** the recipe is ready to cook. Tap the 🧪 icon on a step for
   *why it works*, and the sliders icon to *adjust to taste*. **Show sources**
   shows what came from the cook, from you, and from the AI. Keep it, or tap
   **Make a link** to send it.

Already have a recipe written down? On **Recipes**, tap **+ New recipe** and type it in. No AI needed.

Lost? Tap **?** at the top of any page.

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
