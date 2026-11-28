# Fair demo script (Dec 1)

> About 3 minutes, live on dbs-project-v2.vercel.app. Show it on my phone
> (390px is what it's built for) or on the laptop with the phone as a backup.
> *Draft, for me to rehearse and edit.* Bold = what I click.

## Before the fair (setup checklist)

- [ ] **Laptop and phone signed in** to my demo lab book (not the test account).
- [ ] **Ready-made items** in that lab book, so nothing depends on waiting:
  - an **Idea** with a photo (e.g. "Orange blossom flan", a photo of the batch)
  - a **Development** item with kitchen notes already in (the yogurt dictation)
  - a **finished recipe** with **components** (Caramel sauce / Custard), a
    **dish photo**, and **2–3 iterations** with dated notes (my flan batches:
    water bath ¾ vs. fully covered)
- [ ] One fresh tab on **Ideas**, one on the yogurt **Development** item.
- [ ] Wi-Fi checked; phone hotspot as a backup.
- [ ] Gemini quota: don't run `npm run verify:fresh` or evals that morning.
- [ ] Backup if the AI is slow or rate-limited: the finished recipe is already
  there ("here's one it made earlier").

## The script

### 0. Hook (15 s)

> "This is Culinary Lab Book. I develop recipes the way a lab works: you start
> from an idea, you dictate rough kitchen notes, and AI turns them into a real
> recipe, asking only what it can't know, with the food science built in."

### 1. Ideas: capture inspiration (20 s)

- On **Ideas**, type "Miso caramel" in the quick-add, tap the **camera**, pick
  a photo, press **Enter**.
- > "Inspiration is often a photo. One step: name, photo, what inspired me.
  > My cousin got stuck here in v1, so it's now a single box."

### 2. Development: rough notes → AI recipe (60 s)

- Open the yogurt item in **Development**. Point at the kitchen notes:
  > "These are my grandma's words, dictated with the phone keyboard: they
  > ramble, have mistakes, and skip steps."
- Tick **"The kitchen notes are complete"** → **Create recipe with AI**.
- While it works (about 20 s):
  > "Two passes on Gemini Flash. The first pass reads every sentence and lists
  > what a first-time cook couldn't figure out. The rule is: never invent an
  > amount. Ask instead."
- On the questions: point at the **"10 in" container** question.
  > "It caught that '10 in' is a misheard brand, and asked which yogurt, which
  > is the whole secret of the recipe. If nobody knows, I can accept a
  > suggestion, and it stays marked as a suggestion."
- Answer one, accept one suggestion, **Make the recipe with AI**.

### 3. The recipe (30 s)

- Show the recipe: ingredients, instructions, the **flask** (why it works) and
  **sliders** (8 hours milder, 12 hours tangier).
  > "The food science is one tap away, never in the way."
- Switch to the **flan**: point at **components** (Caramel sauce, Custard) and
  the **dish photo**.

### 4. Iterations: the "lab" part (30 s)

- Tap **Iteration 3 ▾** → show the chips → **Iteration summary**.
  > "Every time I make it, I make a new iteration: a copy I tweak, with notes.
  > Batch 1 rose with big bubbles; fully covering the jars in the water bath
  > fixed it. The summary shows how the recipe evolved."

### 5. Close: how I know it works (25 s)

> "Because the focus was AI, I measured it: an eval on three real dictations
> checks it never invents amounts and always asks the critical questions. The
> new prompt scores 47 of 50 on the same checks where the old one scored 45,
> with every must-pass check passing. Each person gets 20 AI requests an hour,
> and a fresh-session security review found nothing exploitable. Want to try
> it?"

## If someone asks…

| Question | Short answer |
|---|---|
| How do you stop the AI making things up? | Hard rules (never invent an amount; quote the cook exactly), and an eval that checks every recipe for invented numbers and fake quotes. Unknowns become questions. |
| Why Gemini? | Free tier, fast enough: I compared models with the same eval. 3.8 Flash timed out; 3.5 Flash passed. |
| What did user testing change? | My cousin got stuck three times in v1 (long intro, no next step after an idea, no way to add more). All three are fixed, and the main screens went from 300 to 149 words. |
| Is my data private? | Every table only shows your own rows (database rules, not just the app). Photos are private files with short-lived links. Shared recipes go out only through a link you can turn off. |
| What happens if the AI is busy? | A clear message and your notes are saved; the limit says when you can try again. |
| What's next? | Nutrition facts, portion scaling, and my own flan dictation as a fourth eval sample. |

## Rehearsal notes

- Time it twice with a stopwatch; cut section 3 to 15 s if over 3:15.
- Practice the 20-second AI wait out loud: that's where the explanation goes.
- Have the finished recipe open in a second tab in case the AI is slow.
