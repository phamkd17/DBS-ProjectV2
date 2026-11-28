# What changed since v1

> Required by the v2 brief: "what you changed since v1, and why." Every change
> points back to the v1 test with my cousin (`notes/v2-plan.md`), a v2 plan item
> (GitHub issues #1–#15), or a decision I made while building
> (`notes/decisions.md`; implementation notes in `notes/build-log.md`).
> Compare the code with v1: `git diff v1..main`. *Draft, for me to review.*

## In short

- **My cousin's three stuck points are fixed:** a short landing page with three
  illustrated steps, a clear next step after saving an idea, and a one-line
  quick-add for more ideas. The main screens went from **300 → 149 words**.
- **Development is easier and more flexible:** type, dictate, or paste rough
  **kitchen notes** (with a tip to include amounts), or skip the AI and **write
  the recipe yourself**, with **Enter** to add the next line.
- **Recipes are more like a real lab book:** **iterations** (versions of a
  recipe, each with its own notes and a summary page), **components** (a flan's
  caramel and custard), editable **instructions** with food science and taste
  adjustments, a **dish photo** you can crop, and **tags**.
- **The AI got better and safer:** prompt **p5** splits dishes into components;
  on the same 50 eval checks it scores **47/50 (p4: 45/50)**, with every
  must-pass check passing. Each person gets **20 AI requests an hour / 50 a day**,
  and every call has a token cap.
- **Security pass:** every action checks who's signed in, every table has
  owner-only rules, photos are private, and a fresh-session review found nothing
  exploitable (`notes/security-pass.md`).
- **Calmer design:** one font (Figtree), a new logo, compact pages, and notes
  hidden until you ask for them. Checked on every change at 390 and 1440 px with
  `npm run verify` (0 accessibility violations).

## Getting started (my cousin's feedback)

| Change | Why | Where |
|---|---|---|
| **Landing page:** headline + three illustrated steps (Ideas → Development → Recipes), fits one screen | My cousin: *"took a while to read the intro page"* | #1 · `app/page.tsx`, `components/HowItWorks.tsx` |
| **"Saved to Ideas"** + one next step right after saving an idea | My cousin: *"after they created an Idea they didn't know what to do next"* | #2 · `components/SavedBanner.tsx` |
| **Quick-add on the Ideas tab:** type an idea (and what inspired it, and a photo), press Enter, and it's in the list; the box is ready for the next one | My cousin: *"didn't know how to create multiple ideas"*; creating an idea used to take a tab, a button, and a separate page | #3 · `components/QuickAddIdea.tsx` |
| **? How it works** in the header, and much less text: the main screens went from **300 → 149 words** (`npm run words`) | My cousin: *"text heavy… a lot of reading to understand what the different tabs are"*; wanted a read-me | #4 · `components/HelpButton.tsx`, `verify/words-v1.txt` vs `words-v2.txt` |
| **README: How to use it** in three steps | My cousin wanted *"a read me or instructions"* | #4 · `README.md` |
| **Tabs at the top of every page** (Ideas · Development · Recipes); "Finished" renamed **Recipes** | The tabs were hard to understand and only on the home page; "Recipes" is plainer | `components/TopTabs.tsx`, `lib/types.ts` |
| **One start button per tab:** quick-add (Ideas), **+ Kitchen notes** (Development), **+ New recipe** (Recipes) | Three buttons on one screen did the same thing | `app/page.tsx` |

## Ideas

| Change | Why | Where |
|---|---|---|
| **Photos on ideas:** a camera button in the quick-add; up to 6 photos per idea; tap one to view it large; thumbnails never cropped | My cousin wanted more pictures; inspiration is often a photo of a dish (#7) | `components/EntryPhotos.tsx`, `lib/photos.ts`, migration `20261127000000_photos.sql` |
| **"Inspiration"** instead of "Idea notes" | With kitchen notes added, two kinds of "notes" would be confusing | `components/InlineEdit.tsx` |

## Development

| Change | Why | Where |
|---|---|---|
| **"Kitchen notes"** instead of "the cook's words": dictate or paste rough instructions, with a tip to include amounts and detail | The app is for developing recipes from rough instructions, not only recording someone else's words; more detail means fewer AI questions | `components/DictationEditor.tsx`, `components/ui.tsx` |
| **Edit or delete the kitchen notes** (no hidden old copies kept) | I want to fix or remove them freely, and I don't need old versions | `deleteWords`, migrations `20261121*` |
| **Leave the AI questions:** Save for later, or Discard questions and start over | The questions page had no way out except finishing it | `saveAnswersForLater`, `discardDraft` |
| **Write the recipe yourself** (no AI), from Development or **+ New recipe**; **Enter** adds the next ingredient or step | Some recipes are already written down, or the cook wants to type them in directly | `components/ManualRecipeForm.tsx` |
| **Compact page:** long kitchen notes show 6 lines with "Show all" | A long dictation pushed the AI step far down | `components/ClampText.tsx` |

## Recipes

| Change | Why | Where |
|---|---|---|
| **Iterations:** versions of a recipe. "+ New iteration" copies the one you're viewing, then you edit it; each has a date and its own notes; a recipe opens on the latest; an **Iteration summary** page lists them all | The "lab" in Culinary Lab Book: my own flan document is a series of dated batches, each slightly different (#9) | `components/IterationBar.tsx`, `app/r/[id]/iterations/`, migration `20261128040000_iterations.sql` |
| **Components** (e.g. Caramel sauce, Custard): each with its own ingredients and instructions; pick a row's component with one tap, or tick several rows and move them at once | My flan has three components (Egg mixture, Milk, Caramel sauce) | `components/Parts.tsx`, `lib/types.ts` |
| **Edit the instructions** (was "Steps"): change any step and add **Why it works** (food science) or **Adjust to taste** notes, also when writing a recipe by hand | The AI's food science is a starting point; the cook should correct and add to it | `components/EditableSteps.tsx` |
| **Notes behind icons:** a flask for food science, sliders for taste adjustments, a note icon for other notes; one **All notes** switch opens them all | The recipe was busy with notes everywhere | `components/RecipeExtras.tsx` |
| **Dish photo** beside the title and ingredients (the text wraps around it); tap to zoom, crop (Original, Square, Wide, Tall), change, or remove; it's the recipe's thumbnail | A recipe should show what the dish looks like | `components/DishPhoto.tsx`, `components/PhotoCropper.tsx` (react-easy-crop, MIT) |
| **Tags:** small chips with "+ Tag"; filter the Recipes tab by tag; an **All tags** page with each tag's recipes | My cousin asked for a way to categorize recipes; a flan is both Mexican and a dessert (#8) | `components/TagPicker.tsx`, `app/tags/`, migration `20261121020000_sections.sql` |
| **The recipe comes first:** inspiration, photos, kitchen notes, and the AI's questions fold into one "Notes from Ideas and Development" row; Send is one line | Too many things on the page; once it's a recipe, the notes are history | `app/r/[id]/page.tsx`, `SharePanel.tsx` |
| **No "Show sources" labels** (still stored with every recipe) | Calmer page. Trade-off: AI suggestions no longer look different from the cook's own amounts | `components/RecipeExtras.tsx` |

## AI

| Change | Why | Where |
|---|---|---|
| **Prompt p5: components.** The AI splits a dish into components only when it has separate parts, in the cook's words; one-pot dishes stay whole. Eval: **52/55**, all must-pass; **47/50 on the p4 checks (p4: 45/50)**. It split tomato tofu into Tofu / Tomato sauce and kept the yogurt whole | Components should come from the dictation too, not only from typing (#12) | `lib/ai/prompts.ts`, `lib/ai/schema.ts`, `evals/results/2026-11-28T02-57-38-324Z_p5_gemini-3.5-flash.json` |
| **AI limits:** 20 requests per person per hour and 50 per day, checked before calling Gemini ("You can make more in about 40 minutes"); a token cap on every call and a cap on prompt size | Required by the v2 brief ("set a rate limit and a token cap"); protects the free Gemini tier (#5) | `lib/ai/limits.ts`, migration `20261128010000_ai_calls.sql`, `npm run verify:limits` |

## Security

| Change | Why | Where |
|---|---|---|
| **Security pass:** every action checks the user, every table has owner-only rules, photos are private, no keys in the repo; a fresh-session review found nothing exploitable; v1's tables lost Supabase's broad default grants | Required by the v2 brief: "what you checked, what you found, what you fixed" (#6) | `notes/security-pass.md`, migration `20261128020000_tighten_v1_grants.sql` |

## Look and feel

| Change | Why | Where |
|---|---|---|
| **One font, Figtree**, replacing Instrument Serif + Jost | The two fonts felt like they conflicted; I compared 14 options and chose one friendly, readable font | `app/layout.tsx`, `notes/design/font-options-2.html` |
| **A logo:** a lab notebook with a mortar and pestle, in the header and as the browser-tab icon | The mortar and pestle belongs to both the kitchen and the lab; explored over six rounds | `components/Logo.tsx`, `app/icon.svg`, `notes/design/logo-options*.html` |
| **Compact pages and lists:** the tab's name as the title, no repeated "Move to", tags beside the name, even spacing and single lines, headings clearly bigger than items | Less scrolling and less clutter on a phone | `app/page.tsx`, `components/IngredientList.tsx`, `components/RecipeView.tsx` |
