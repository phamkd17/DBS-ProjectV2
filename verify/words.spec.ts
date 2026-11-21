/**
 * Word count on the main screens (issue #4: "at most half of v1's words").
 * Run: npm run words. Counts visible words in <main> (not the header).
 */
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";

const EMPTY = "labbook-empty+clerk_test@example.com";
test("word counts", async ({ page }) => {
  await clerkSetup();
  const api = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data } = await api.users.getUserList({ emailAddress: [EMPTY] });
  if (!data.length) await api.users.createUser({ emailAddress: [EMPTY], skipPasswordRequirement: true });
  const count = async () =>
    (await page.locator("main").filter({ visible: true }).first().innerText()).split(/\s+/).filter(Boolean).length;
  const out: Record<string, number> = {};
  await page.goto("/");
  out["landing (signed out)"] = await count();
  await clerk.signIn({ page, emailAddress: EMPTY });
  await page.goto("/");
  out["empty lab book"] = await count();
  await page.goto("/ideas/new");
  out["new idea"] = await count();
  await page.goto("/new");
  out["new dictation"] = await count();
  for (const tab of ["ideas", "development", "finished"]) {
    await page.goto(`/?tab=${tab}`);
    out[`tab: ${tab} (empty)`] = await count();
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  const lines = Object.entries(out).map(([k, v]) => `${k}: ${v}`).concat(`TOTAL: ${total}`);
  console.log(lines.join("\n"));
  writeFileSync(`verify/words-${process.env.WORDS_LABEL ?? "now"}.txt`, lines.join("\n") + "\n");
});
