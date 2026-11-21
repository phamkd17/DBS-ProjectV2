# What changed since v1

> Required by the v2 brief: "what you changed since v1, and why." Filled in as
> v2 is built. Every entry points back to the v1 feedback (`notes/v2-plan.md`)
> or a decision in `notes/build-log.md`. Compare with v1: `git diff v1..main`.

| Change | Why (from v1) | Where |
|---|---|---|
| **Landing page:** headline + three illustrated steps (Ideas → Development → Finished) instead of a paragraph | My cousin: *"took a while to read the intro page"* | #1 · `app/page.tsx`, `components/HowItWorks.tsx` |
| **"Saved to Ideas"** + one next step (**Add another idea**) right after saving an idea, shown once | My cousin: *"after they created an Idea they didn't know what to do next"* | #2 · `components/SavedBanner.tsx` |
| **Save and add another** on the idea form; **+ New idea** on the Ideas tab and idea pages | My cousin: *"didn't know how to create multiple ideas"* | #3 · `components/IdeaForm.tsx`, `app/d/[id]/page.tsx` |
| **? How it works** guide in the header, one-line tab hints, shorter copy everywhere: the main screens went from **300 → 149 words** (`npm run words`) | My cousin: *"text heavy… a lot of reading to understand what the different tabs are"*; wanted a read-me | #4 · `components/HelpButton.tsx`, `verify/words-v1.txt` vs `words-v2.txt` |
| **README: How to use it** in three steps | My cousin wanted *"a read me or instructions"* | #4 · `README.md` |
| **Tabs at the top of every page** (Ideas · Development · Recipes), always one tap away | My cousin found the tabs hard to understand; I wanted them reachable from anywhere, not only on the home page | `components/TopTabs.tsx` |
| **"Finished" renamed "Recipes"** (label only; the stored value stays `finished` because v1 shares the database) | "I don't like finished": *Recipes* is plainer (Ideas → Development → Recipes) | `lib/types.ts` |
| **Type or dictate** the cook's words, said everywhere; a new headline about easy recipe development; a landing page that fits on one screen at 5 sizes | Typing should be an obvious option; *"the text is too big. I want to minimize scrolling"* | `app/page.tsx`, `components/HowItWorks.tsx` |
| **One start button per tab**: + New idea / + Cook's words / New ▾; the empty lab book shows the three steps + that button | New, Save an idea, and Add the cook's words did the same thing on one screen (redundant) | `app/page.tsx` |
