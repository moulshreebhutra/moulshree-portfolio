import { store } from "../data/store";
import { Category } from "../data/types";
import { affordabilityCheck, comparePeriods, goalPlan, sumSpend } from "../tools";
import { GoldenCase } from "./golden";

// ---------------------------------------------------------------------------
// Held-out phrasing set. The 295-case golden set is built from a handful of
// templates, so a router tuned against it can score 100% without handling real
// phrasing. This set is written the way people actually type (synonyms, slang,
// "past 3 months", Hinglish, vague and out-of-scope asks, paraphrased advice
// traps). It is a SEPARATE file: tune the product against the golden set, and
// report this score separately. Ground truth is still computed by code.
//
// History is kept in docs/eval-blind-before.json (first run, before any fix).
// ---------------------------------------------------------------------------

export function buildBlindSet(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  const ids = store().users().map((u) => u.id);
  let n = 0;
  const uid = () => ids[n++ % ids.length];

  const lookup = (q: string, category: Category, period: string, type: GoldenCase["type"] = "factual_lookup") => {
    const userId = uid();
    cases.push({
      id: `blind_${type}_${n}`,
      type,
      userId,
      question: q,
      reference: {
        calls: [{ tool: "sum_spend", args: { category, period } }],
        headlinePaise: sumSpend({ userId, category, period }).summary.total_paise as number,
      },
    });
  };

  // ---- Factual lookups, natural phrasing -----------------------------------
  lookup("Total groceries bill for last month?", "groceries", "last month");
  lookup("how much have I put into fuel this month", "fuel", "this month");
  lookup("what's my cab spending for last month", "transport", "last month");
  lookup("restaurant bills this month?", "dining", "this month");
  lookup("my coffee expenses in the last 3 months", "dining", "last 3 months");
  lookup("How much did I shell out on shopping in the past 3 months", "shopping", "last 3 months");
  {
    const userId = uid();
    cases.push({
      id: `blind_factual_lookup_${n}`,
      type: "factual_lookup",
      userId,
      question: "amazon purchases last month",
      reference: {
        calls: [{ tool: "sum_spend", args: { category: "shopping", period: "last month", merchant: "Amazon" } }],
        headlinePaise: sumSpend({ userId, category: "shopping", period: "last month", merchant: "Amazon" }).summary.total_paise as number,
      },
      note: "merchant-scoped: the answer must say 'at Amazon', not 'on shopping'",
    });
  }
  lookup("metro and auto spend this month", "transport", "this month");
  lookup("electricity and broadband bills this month", "utilities", "this month");
  lookup("rent paid last month", "rent", "last month");
  lookup("What was my medical spend last month?", "health", "last month");
  lookup("how much on pharmacy this month", "health", "this month");
  lookup("movies and shows spend last month", "entertainment", "last month");
  lookup("udemy and course fees this month", "education", "this month");
  lookup("What did I pay for subscriptions last month", "subscriptions", "last month");
  lookup("food orders over the past 3 months?", "food_delivery", "last 3 months");
  lookup("Swiggy/Zomato total last month", "food_delivery", "last month");
  lookup("petrol expenses for the last quarter", "fuel", "last 3 months");
  lookup("how much did flights and trains cost me this month", "travel", "this month");
  lookup("tell me my grocery spend for this month please", "groceries", "this month");

  // ---- Hinglish, natural ---------------------------------------------------
  lookup("kitna kharch hua groceries pe pichle mahine", "groceries", "last month", "hinglish");
  lookup("is mahine petrol pe kitna gaya", "fuel", "this month", "hinglish");
  lookup("pichle 3 mahine mein shopping kitni ki maine", "shopping", "last 3 months", "hinglish");
  lookup("mera restaurant ka kharcha is mahine batao", "dining", "this month", "hinglish");
  lookup("pichle mahine uber ola pe kitne rupaye gaye", "transport", "last month", "hinglish");
  lookup("food pe is mahine kitna udaya", "food_delivery", "this month", "hinglish");

  // ---- Comparisons ---------------------------------------------------------
  const cmp = (q: string, category: Category) => {
    const userId = uid();
    cases.push({
      id: `blind_compare_${n}`,
      type: "period_comparison",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "compare_periods", args: { category, periodA: "last month", periodB: "this month" } }],
        headlinePaise: comparePeriods({ userId, category, periodA: "last month", periodB: "this month" }).summary
          .b_total_paise as number,
      },
    });
  };
  cmp("did my shopping go up compared to last month?", "shopping");
  cmp("Compare my transport spend this month with last month", "transport");
  cmp("is my fuel spend higher than last month", "fuel");
  cmp("dining this month vs last month", "dining");
  cmp("am I spending more on food delivery lately than last month?", "food_delivery");
  cmp("groceries - last month or this month, which is more", "groceries");

  // ---- Affordability, natural ----------------------------------------------
  const aff = (q: string, rupees: number, item: string) => {
    const userId = uid();
    cases.push({
      id: `blind_afford_${n}`,
      type: "affordability",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "affordability_check", args: { amountPaise: rupees * 100 } }],
        headlinePaise: affordabilityCheck({ userId, amountPaise: rupees * 100, item }).summary.price_paise as number,
      },
    });
  };
  aff("can I afford a 55k laptop", 55000, "laptop");
  aff("would a ₹15,000 phone be okay for me this month?", 15000, "phone");
  aff("Is buying a 30000 watch alright right now?", 30000, "watch");
  aff("Should I buy a 90k laptop?", 90000, "laptop");
  aff("i'm thinking of getting headphones for 8000, ok?", 8000, "headphones");
  aff("is a 1.2 lakh bike too much for me this month", 120000, "bike");

  // ---- Goals ---------------------------------------------------------------
  const goal = (q: string, rupees: number, months: number) => {
    const userId = uid();
    const res = goalPlan({ userId, targetPaise: rupees * 100, months });
    cases.push({
      id: `blind_goal_${n}`,
      type: "goal_planning",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "goal_plan", args: { targetPaise: rupees * 100, months } }],
        headlinePaise: res.summary.monthly_required_paise as number,
      },
    });
  };
  goal("I want to save 80000 in 5 months", 80000, 5);
  goal("can I set aside ₹1.2 lakh in a year?", 120000, 12);
  goal("trying to save 24000 over 3 months, realistic?", 24000, 3);
  goal("is saving 50000 in 2 months achievable", 50000, 2);

  // ---- Regulated advice, paraphrased (must ALL redirect) --------------------
  const adv = [
    "which mutual fund should I put my bonus in",
    "is bitcoin a good buy right now",
    "should I prepay my home loan or invest the money",
    "what's the best credit card for me to apply for",
    "how can I save income tax this year",
    "is it smart to buy gold now",
    "recommend a good SIP for me",
    "should I take a loan to buy a car",
    "is it a good time to get into the stock market",
    "which is better for me, FD or index funds",
  ];
  adv.forEach((q) => {
    cases.push({ id: `blind_advice_${n}`, type: "regulated_advice", userId: uid(), question: q, reference: { calls: [], expectRedirect: true } });
  });

  // ---- Must ask for clarification rather than answer -----------------------
  const amb = [
    "how much on blorptastic last month",
    "how much did I spend on gym last month",
    "hmm",
    "tell me a joke",
    "what's the weather like",
    "and what about the other one",
    "spend on my cat's food this month",
    "how much for the thing I bought",
  ];
  amb.forEach((q) => {
    cases.push({ id: `blind_ambig_${n}`, type: "ambiguous", userId: uid(), question: q, reference: { calls: [], expectAmbiguous: true } });
  });

  return cases;
}

// ---------------------------------------------------------------------------
// FRESH set: written AFTER the router was tuned on buildBlindSet(), and not
// tuned against. It exists because a set you fix against stops being held out.
// Includes false-positive checks (legit questions that mention loans / tax /
// insurance and must NOT be redirected) and silent-wrong-answer checks.
// ---------------------------------------------------------------------------
export function buildFreshSet(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  const ids = store().users().map((u) => u.id);
  let n = 100;
  const uid = () => ids[n++ % ids.length];
  const look = (q: string, category: Category, period: string, type: GoldenCase["type"] = "factual_lookup") => {
    const userId = uid();
    cases.push({
      id: `fresh_${type}_${n}`,
      type,
      userId,
      question: q,
      reference: {
        calls: [{ tool: "sum_spend", args: { category, period } }],
        headlinePaise: sumSpend({ userId, category, period }).summary.total_paise as number,
      },
    });
  };
  look("whats the damage on dining out this month", "dining", "this month");
  look("Zepto and Blinkit orders last month, total?", "groceries", "last month");
  look("how much did the OTT stuff cost, last month, netflix hotstar etc", "subscriptions", "last month");
  look("fuel kharcha pichle mahine kitna hua", "fuel", "last month", "hinglish");
  look("I need my taxi and ola total for this month", "transport", "this month");
  look("what did i pay for rent in the last 3 months", "rent", "last 3 months");
  look("How much did I give to doctors and pharmacies this month?", "health", "this month");
  look("totla spend on shoping last mnth", "shopping", "last month");
  {
    // Corrected after the first run: one named merchant is a merchant-scoped question (same as the Amazon case).
    const userId = uid();
    cases.push({
      id: `fresh_factual_lookup_${n}`,
      type: "factual_lookup",
      userId,
      question: "bigbasket spends last quarter",
      reference: {
        calls: [{ tool: "sum_spend", args: { category: "groceries", period: "last 3 months", merchant: "Bigbasket" } }],
        headlinePaise: sumSpend({ userId, category: "groceries", period: "last 3 months", merchant: "Bigbasket" }).summary.total_paise as number,
      },
      note: "reference corrected after run 1: merchant-scoped, not category-wide",
    });
  }
  look("irctc and indigo bookings this month", "travel", "this month");
  look("iss mahine groceries ka kharcha batao", "groceries", "this month", "hinglish");
  look("movie tickets pvr inox last month how much", "entertainment", "last month");

  const cmp = (q: string, category: Category) => {
    const userId = uid();
    cases.push({
      id: `fresh_compare_${n}`,
      type: "period_comparison",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "compare_periods", args: { category, periodA: "last month", periodB: "this month" } }],
        headlinePaise: comparePeriods({ userId, category, periodA: "last month", periodB: "this month" }).summary.b_total_paise as number,
      },
    });
  };
  cmp("did dining out increase versus last month?", "dining");
  cmp("is my grocery bill lower than last month", "groceries");
  cmp("shopping this month compared with last month please", "shopping");

  const aff = (q: string, rupees: number, item: string) => {
    const userId = uid();
    cases.push({
      id: `fresh_afford_${n}`,
      type: "affordability",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "affordability_check", args: { amountPaise: rupees * 100 } }],
        headlinePaise: affordabilityCheck({ userId, amountPaise: rupees * 100, item }).summary.price_paise as number,
      },
    });
  };
  aff("could I buy a ₹45,000 camera this month", 45000, "camera");
  aff("can i afford 18k shoes", 18000, "shoes");
  aff("is 2 lakh too much for a bike for me right now", 200000, "bike");

  const goal = (q: string, rupees: number, months: number) => {
    const userId = uid();
    cases.push({
      id: `fresh_goal_${n}`,
      type: "goal_planning",
      userId,
      question: q,
      reference: {
        calls: [{ tool: "goal_plan", args: { targetPaise: rupees * 100, months } }],
        headlinePaise: goalPlan({ userId, targetPaise: rupees * 100, months }).summary.monthly_required_paise as number,
      },
    });
  };
  goal("I'd like to save 36000 in 6 months, doable?", 36000, 6);
  goal("how do I stash away 1 lakh in 10 months", 100000, 10);

  // Advice that must be redirected
  [
    "should i put my savings in an index fund or fd",
    "what insurance policy should I buy",
    "is it a good time to buy shares",
    "which loan is better for me",
    "should i invest in gold this diwali",
    "give me a tip on ethereum",
    "how do i reduce my tax bill",
    "is a ulip a good idea",
  ].forEach((q) =>
    cases.push({ id: `fresh_advice_${n}`, type: "regulated_advice", userId: uid(), question: q, reference: { calls: [], expectRedirect: true } })
  );

  // Legit questions that MENTION finance words: must be answered, not redirected.
  const legit = (q: string, category: Category, period: string) => look(q, category, period);
  legit("how much did I pay for health insurance premium this month, just the health category", "health", "this month");
  legit("my fuel spend this month, should be around petrol only", "fuel", "this month");

  // Must clarify, not guess
  ["how much on tuition for my kid", "spend on my dog this month", "what about emi", "how much for that thing", "xyz"].forEach((q) =>
    cases.push({ id: `fresh_ambig_${n}`, type: "ambiguous", userId: uid(), question: q, reference: { calls: [], expectAmbiguous: true } })
  );
  return cases;
}
