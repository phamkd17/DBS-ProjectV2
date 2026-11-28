/**
 * Eval runner: real dictations → pass 1 (+ scripted answers → pass 2) → checks.
 *
 *   npm run eval                 # all samples
 *   npm run eval -- yogurt       # one sample
 *
 * Results are saved to evals/results/<timestamp>.json with the model id and
 * prompt version, so runs can be compared.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { draftRecipe, finalizeRecipe } from "../lib/ai/pipeline";
import { PROMPT_VERSION } from "../lib/ai/prompts";
import type { Answer, Pass1Output, Question, Recipe } from "../lib/ai/schema";

type Check = { name: string; pass: boolean; must?: boolean; detail?: string };

const SAMPLES_DIR = join(__dirname, "samples");
const RESULTS_DIR = join(__dirname, "results");

// ---------- helpers ----------

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();

const qText = (q: Question) => `${q.quote} ${q.question} ${q.suggestion}`;
const anyQ = (qs: Question[], re: RegExp, kind?: Question["kind"]) =>
  qs.find((q) => (!kind || q.kind === kind) && re.test(qText(q)));

const stepsText = (r: Recipe) => r.steps.map((s) => s.text).join("\n");
const allDials = (r: Recipe) => r.steps.flatMap((s) => s.dials);
const allWhy = (r: Recipe) => r.steps.flatMap((s) => s.why);
const ing = (r: Recipe, re: RegExp) => r.ingredients.filter((i) => re.test(i.item));

function readTranscript(file: string) {
  const md = readFileSync(join(SAMPLES_DIR, file), "utf8");
  const m = md.match(/## Transcript\s*```\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`No transcript block in ${file}`);
  return m[1];
}

/** Checks that apply to every sample. */
function commonChecks(transcript: string, r: Recipe, label: string): Check[] {
  const t = norm(transcript);
  const badQuotes = allWhy(r).filter(
    (w) => w.source === "cook" && !t.includes(norm(w.quote || "<empty>"))
  );
  const badAmounts = r.ingredients.filter((i) => {
    if (i.source !== "cook") return false;
    const nums = i.amount.match(/\d+(\/\d+)?/g) ?? [];
    return nums.some((n) => !t.includes(n));
  });
  return [

    {
      name: `${label}: has title, ingredients, ordered steps`,
      pass: !!r.title && r.ingredients.length >= 2 && r.steps.length >= 3,
    },
    {
      name: `${label}: every "cook" why quotes the transcript exactly`,
      pass: badQuotes.length === 0,
      detail: badQuotes.map((w) => JSON.stringify(w.quote)).join(", "),
    },
    {
      name: `${label}: no "cook" amount has a number she never said`,
      pass: badAmounts.length === 0,
      detail: badAmounts.map((i) => `${i.item}: ${i.amount}`).join(", "),
    },
    // p5: components (rule 8). The steps' components are the ingredients' components.
    (() => {
      const comp = (xs: { section?: string }[]) => new Set(xs.map((x) => (x.section ?? "").trim().toLowerCase()).filter(Boolean));
      const ings = comp(r.ingredients);
      const steps = comp(r.steps);
      const odd = [...steps].filter((c) => !ings.has(c)).concat([...ings].filter((c) => !steps.has(c)));
      return { name: `${label}: components match between ingredients and steps`, pass: odd.length === 0, detail: odd.join(", ") };
    })(),
  ];
}

/** No digits = no invented number. */
function noInventedNumbers(r: Recipe, items: [string, RegExp][]): Check[] {
  return items.map(([name, re]) => {
    const hits = ing(r, re).filter((i) => /\d/.test(i.amount) && i.source === "cook");
    return {
      name: `draft: no invented amount for ${name}`,
      pass: hits.length === 0,
      detail: hits.map((i) => `${i.item}: ${i.amount}`).join(", "),
    };
  });
}

// ---------- per-sample spec ----------

type Spec = {
  pass1: (p: Pass1Output) => Check[];
  /** Scripted family answers. Unmatched questions accept the suggestion. */
  answers: { match: RegExp; answer: string }[];
  pass2?: (r: Recipe) => Check[];
};

const SPECS: Record<string, Spec> = {
  yogurt: {
    pass1: ({ draft, questions: qs }) => [
      { name: 'asks about the "10 in" yogurt container', pass: !!anyQ(qs, /10 in/i) },
      {
        // The cousin's yogurt failed because of the starter, so size alone isn't enough.
        name: 'asks the starter\'s brand or live cultures, not just size',
        must: true,
        pass: qs.some((q) => /10 in/i.test(q.quote + q.question) && /brand|dannon|live|cultur|which yogurt|kind of yogurt|type of yogurt/i.test(q.question + q.suggestion)),
      },
      {
        name: "flags the missing cooling step",
        must: true,
        pass: !!anyQ(qs, /cool/i, "missing_step"),
      },
      { name: "milk is heated and not boiled", pass: /\b(not|n't|never|without)\b[^.]{0,30}boil/i.test(stepsText(draft)) },
      { name: "asks which kind of milk", pass: !!anyQ(qs, /whole|kind of milk|type of milk|which milk/i) },
      { name: "asks the incubator temperature", pass: !!anyQ(qs, /incubat[\s\S]*(temp|°|degree)|(temp|°|degree)[\s\S]*incubat/i) },
      { name: "asks fridge or freezer", pass: !!anyQ(qs, /freez/i) },
      {
        name: "incubation dial: 8 h milder vs 12 h tangy",
        pass: allDials(draft).some((d) => /8/.test(d.setting)) && allDials(draft).some((d) => /12/.test(d.setting)),
      },
      // p5 rule 8: a one-pot dish isn't split into components.
      {
        name: "no needless components (one-pot dish)",
        pass: [...draft.ingredients, ...draft.steps].every((x) => !(x.section ?? "").trim()),
      },
    ],
    answers: [
      { match: /10 in/i, answer: "It's plain Dannon yogurt, the small single cup." },
      { match: /cool/i, answer: "Yes, she lets the milk cool before adding the yogurt." },
    ],
    pass2: (r) => [
      {
        name: "final: starter is Dannon, credited to the family answer",
        must: true,
        pass: r.ingredients.some(
          (i) =>
            /dannon/i.test(i.item + i.note + i.from_answers.map((a) => a.text).join(" ")) &&
            (i.source === "user_answer" ||
              i.from_answers.some((a) => a.source === "user_answer" && /dannon/i.test(a.text)))
        ),
      },
      { name: "final: has a cooling step", must: true, pass: /cool/i.test(stepsText(r)) },
      {
        name: "final: accepted suggestions are labeled suggested",
        must: true,
        pass:
          [...r.ingredients.map((i) => i.source), ...allWhy(r).map((w) => w.source)].includes("suggested") ||
          [...r.ingredients, ...r.steps].some((x) => x.from_answers.some((a) => a.source === "suggested")),
      },
      {
        name: "final: no suggestion hidden under a cook/family label",
        must: true,
        pass: !r.ingredients.some(
          (i) => i.source !== "suggested" && /suggest/i.test(i.note) && !i.from_answers.some((a) => a.source === "suggested")
        ),
      },
    ],
  },

  "tomato-tofu": {
    pass1: ({ draft, questions: qs }) => [
      {
        name: "garlic = 5 (her self-correction wins)",
        pass: ing(draft, /garlic/i).some((i) => /\b5\b|five/i.test(i.amount)),
        detail: ing(draft, /garlic/i).map((i) => i.amount).join(", "),
      },
      { name: "tomatoes ≈ 5", pass: ing(draft, /tomato/i).some((i) => /\b5\b|five/i.test(i.amount + i.note)) },
      ...noInventedNumbers(draft, [
        ["fish sauce", /fish sauce/i],
        ["tofu", /tofu/i],
        ["onions", /onion/i],
        ["oil", /\boil\b/i],
        ["water", /water/i],
      ]),
      { name: 'asks how much fish sauce ("just about that much")', pass: !!anyQ(qs, /fish sauce/i) },
      { name: "asks how much / what kind of tofu", pass: !!anyQ(qs, /tofu/i, "amount") || !!anyQ(qs, /(firm|kind|type|how much)[\s\S]*tofu|tofu[\s\S]*(firm|kind|type)/i) },
      { name: "asks how many onions", pass: !!anyQ(qs, /onion/i) },
      { name: "notes the tofu frying was moved", pass: /(mov|reorder|earlier|before)/i.test(draft.notes.join(" ")) },
      { name: "onion dial: 5 min vs 7 min sweeter", pass: allDials(draft).some((d) => /7/.test(d.setting)) },
    ],
    answers: [],
  },

  "pork-mango-soup": {
    pass1: ({ draft, questions: qs }) => {
      const st = stepsText(draft).toLowerCase();
      const p = st.indexOf("pepper");
      const f = st.indexOf("fish sauce", p === -1 ? 0 : 0);
      return [
        { name: "asks mango: 5 or 10 minutes (contradiction)", pass: !!anyQ(qs, /mango[\s\S]*(5|10|five|ten)|(5|10|five|ten)[\s\S]*mango/i, "contradiction") },
        { name: "asks when the green onions go in", pass: !!anyQ(qs, /green onion|scallion/i) },
        { name: "asks same pot or separate pan", pass: !!anyQ(qs, /pot[\s\S]*pan|pan[\s\S]*pot/i) },
        { name: 'asks how many parboils is "a couple"', pass: !!anyQ(qs, /couple|how many times|parboil|boil/i) },
        { name: "pepper goes in before fish sauce", pass: p !== -1 && f !== -1 && p < f },
        { name: "simmer shown as 30–60 min", pass: /30[\s\S]{0,15}(60|hour)/i.test(stepsText(draft)) },
        ...noInventedNumbers(draft, [
          ["pork", /pork|rib/i],
          ["fish sauce", /fish sauce/i],
          ["water", /water/i],
          ["mangoes", /mango/i],
          ["cilantro", /cilantro/i],
        ]),
      ];
    },
    answers: [],
  },
};

// ---------- runner ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runSample(file: string) {
  const name = file.replace(/\.md$/, "");
  const spec = SPECS[name];
  const transcript = readTranscript(file);
  const before = transcript;

  const p1 = await draftRecipe(transcript);
  const checks: Check[] = [
    ...commonChecks(transcript, p1.draft, "draft"),
    ...spec.pass1(p1),
  ];

  let final: Recipe | undefined;
  let p2ms: number | undefined;
  if (spec.pass2) {
    await sleep(4000); // stay under the free-tier rate limit
    const answers: Answer[] = p1.questions.map((q) => {
      const scripted = spec.answers.find((a) => a.match.test(qText(q)));
      return scripted
        ? { question: q, answer: scripted.answer, answer_source: "user_answer" }
        : { question: q, answer: q.suggestion, answer_source: "suggestion_accepted" };
    });
    const p2 = await finalizeRecipe(transcript, p1.draft, answers);
    final = p2.recipe;
    p2ms = p2.ms;
    checks.push(...commonChecks(transcript, final, "final"), ...spec.pass2(final));
  }

  checks.unshift({ name: "transcript unchanged", pass: transcript === before, must: true });
  return { name, model: p1.model, ms: { pass1: p1.ms, pass2: p2ms }, pass1: p1, final, checks };
}

async function main() {
  const only = process.argv[2];
  const files = readdirSync(SAMPLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !only || f.startsWith(only));

  const results = [];
  for (const file of files) {
    process.stdout.write(`\n▶ ${file}\n`);
    try {
      const r = await runSample(file);
      for (const c of r.checks) {
        const mark = c.pass ? "✓" : c.must ? "✗ MUST" : "✗";
        console.log(`  ${mark.padEnd(7)} ${c.name}${!c.pass && c.detail ? `  (${c.detail})` : ""}`);
      }
      const passed = r.checks.filter((c) => c.pass).length;
      const secs = (ms?: number) => (ms === undefined ? "–" : `${(ms / 1000).toFixed(0)}s`);
      console.log(
        `  ${passed}/${r.checks.length} passed · ${r.pass1.questions.length} questions · pass 1 ${secs(r.ms.pass1)}, pass 2 ${secs(r.ms.pass2)}`
      );
      results.push(r);
    } catch (err) {
      const e = err as Error & { detail?: string };
      console.log(`  ERROR ${e.message}${e.detail ? `\n        ${e.detail}` : ""}`);
      results.push({ name: file, error: (err as Error).message });
    }
    await sleep(4000);
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = join(RESULTS_DIR, `${stamp}_${PROMPT_VERSION}_${process.env.GEMINI_MODEL}.json`);
  writeFileSync(
    out,
    JSON.stringify(
      { prompt_version: PROMPT_VERSION, model: process.env.GEMINI_MODEL, thinking: process.env.GEMINI_THINKING ?? "default", results },
      null,
      2
    )
  );

  const all = results.flatMap((r) => ("checks" in r ? r.checks : []));
  const mustFail = all.filter((c) => c.must && !c.pass);
  console.log(`\nTotal: ${all.filter((c) => c.pass).length}/${all.length} checks passed`);
  const errors = results.filter((r) => "error" in r).length;
  if (errors) console.log(`RUN ERRORS: ${errors} sample(s) did not finish, so checks are incomplete.`);
  else console.log(mustFail.length ? `MUST-PASS FAILURES: ${mustFail.length}` : "All must-pass checks passed.");
  console.log(`Saved ${out}`);
  process.exitCode = mustFail.length || results.some((r) => "error" in r) ? 1 : 0;
}

main();
