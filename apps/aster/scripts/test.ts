// Lightweight unit tests (no framework) for the deterministic core. Run with
// `npm test`. Exits non-zero on any failure so it can gate CI / Vercel builds.
import { fmt, sumSpend, detectDuplicates, listRecurring, comparePeriods, affordabilityCheck } from "../src/lib/tools";
import { route, parseAmountPaise } from "../src/lib/agent/router";
import { runGate } from "../src/lib/agent/gate";
import { store } from "../src/lib/data/store";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

console.log("\nASTER unit tests\n");

// --- Money formatting (Indian grouping) ---
eq("fmt 0", fmt(0), "₹0");
eq("fmt 150000 paise", fmt(150000), "₹1,500");
eq("fmt 10000000 paise", fmt(10000000), "₹1,00,000");
eq("fmt decimals", fmt(125099), "₹1,250.99");

// --- parseAmount ---
eq("parse 40,000", parseAmountPaise("can i afford a ₹40,000 phone"), 4000000);
eq("parse 40k", parseAmountPaise("afford 40k phone"), 4000000);
eq("parse 2 lakh", parseAmountPaise("buy a 2 lakh bike"), 20000000);

// --- Router intents ---
eq("router factual", route("how much did I spend on food delivery last month?").intent, "factual_lookup");
eq("router subscriptions-is-factual", route("how much did I spend on subscriptions this month?").intent, "factual_lookup");
eq("router subscriptions-count-is-leakage", route("how many subscriptions do I have?").intent, "leakage_detection");
eq("router affordability", route("can I afford a ₹40,000 phone this month?").intent, "affordability");
eq("router duplicate", route("was I charged twice recently?").intent, "leakage_detection");
eq("router regulated", route("should I invest in mutual funds?").intent, "regulated_advice");
eq("router regulated-risk", route("should I invest in mutual funds?").risk, "regulated_advice");
eq("router hinglish-lang", route("is mahine food delivery pe kitna kharch hua?").language, "hinglish");
eq("router typo-robust", route("how mcuh did i spnd on food delivry this mnth?").intent, "factual_lookup");
eq("router tablet-not-goal", route("can I afford a ₹60,000 tablet this month?").intent, "affordability");

// --- Tool exactness (ground truth) ---
const u = store().defaultUserId();
const s = sumSpend({ userId: u, category: "food_delivery", period: "last month" });
ok("sum_spend returns integer paise", Number.isInteger(s.summary.total_paise as number));
ok("sum_spend sources match rows", (s.sources.length === s.rows.length));
ok("sum total equals row sum", (s.summary.total_paise as number) === s.rows.reduce((a, r) => a + r.amountPaise, 0));

// --- Duplicate detection finds the planted duplicate ---
const dup = detectDuplicates({ userId: u, windowMinutes: 10 });
ok("duplicate detected", (dup.summary.group_count as number) >= 1);
ok("duplicate amount correct", (dup.summary.groups as any[])[0].amount_paise === 89900);

// --- Recurring ---
const rec = listRecurring({ userId: u });
ok("recurring found", (rec.summary.subscription_count as number) >= 1);

// --- Affordability produces a range + verdict ---
const aff = affordabilityCheck({ userId: u, amountPaise: 4000000, item: "phone" });
ok("affordability has verdict", ["yes", "tight", "no"].includes(aff.summary.verdict as string));
ok("affordability low <= high", (aff.summary.affordable_low_paise as number) <= (aff.summary.affordable_high_paise as number));
ok("affordability has assumptions", (aff.summary.assumptions as string[]).length >= 3);

// --- Gate: rejects an ungrounded figure, accepts a grounded one ---
const facts = { rupeeValues: [690, 753, 63], summaryLines: [] };
ok("gate accepts grounded", runGate("You spent ₹690 this month.", facts).passed);
ok("gate rejects ungrounded", !runGate("You spent ₹9,999 this month.", facts).passed);
ok("gate rejects advice leak", !runGate("You should invest in mutual funds.", { rupeeValues: [], summaryLines: [] }).passed);

// --- compare_periods sign handling ---
const cmp = comparePeriods({ userId: u, category: "food_delivery", periodA: "last month", periodB: "this month" });
ok("compare has both totals", typeof cmp.summary.a_total_paise === "number" && typeof cmp.summary.b_total_paise === "number");

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
