// Checks .env.local without printing secrets. Only public values are shown.
const e = process.env;
const ok = (b) => (b ? "✓" : "✗");
const shape = (v) => (v ? `${v.length} chars` : "missing");
const trimmed = (v) => !v || v === v.trim();

const url = e.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = e.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const pk = e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const sk = e.CLERK_SECRET_KEY ?? "";
const gk = e.GEMINI_API_KEY ?? "";

let clerkDomain = "";
try { clerkDomain = Buffer.from(pk.replace(/^pk_(test|live)_/, ""), "base64").toString().replace(/\$$/, ""); } catch {}

console.log(ok(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)), "NEXT_PUBLIC_SUPABASE_URL:", url || "missing");
console.log(ok(/^(eyJ|sb_publishable_)/.test(anon) && trimmed(anon)), "NEXT_PUBLIC_SUPABASE_ANON_KEY:", anon.startsWith("sb_secret_") || /service_role/.test(Buffer.from(anon.split(".")[1] ?? "", "base64").toString()) ? "✗ THIS IS A SECRET/SERVICE KEY — replace with the anon/publishable key" : `${anon.slice(0, 3) === "eyJ" ? "legacy anon JWT" : anon.startsWith("sb_publishable_") ? "publishable key" : "unrecognized format"}, ${shape(anon)}`);
console.log(ok(pk.startsWith("pk_test_") && trimmed(pk)), "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: domain =", clerkDomain || "(could not decode)");
console.log(ok(sk.startsWith("sk_test_") && trimmed(sk)), "CLERK_SECRET_KEY:", sk.startsWith("sk_test_") ? `sk_test_…, ${shape(sk)}` : shape(sk));
console.log(ok(gk.length > 20 && trimmed(gk)), "GEMINI_API_KEY:", shape(gk));
console.log(ok(!!e.GEMINI_MODEL), "GEMINI_MODEL:", e.GEMINI_MODEL || "missing");
const uk = e.USDA_API_KEY ?? "";
console.log(uk ? ok(uk.length >= 30 && trimmed(uk)) : "~", "USDA_API_KEY:", uk ? shape(uk) : "missing (nutrition uses DEMO_KEY, ~30 lookups an hour)");

for (const [k, v] of Object.entries({ url, anon, pk, sk, gk })) {
  if (/^[A-Z_]+=/.test(v)) console.log("✗", k, "has its name doubled (NAME=NAME=…)");
}

if (url && anon) {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } }).catch((err) => ({ status: String(err) }));
  console.log(ok(res.status === 200), "Supabase test request:", res.status, res.status === 200 ? "(URL and key work together)" : "");
}
