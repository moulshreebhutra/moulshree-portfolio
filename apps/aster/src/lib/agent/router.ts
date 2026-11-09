import { Category } from "../data/types";
import { Intent, RiskClass } from "../data/types";

// ---------------------------------------------------------------------------
// Router: a cheap, deterministic intent + risk + language classifier.
//
// This plays the role of the "small, fast model" in the PRD. Keeping it
// deterministic makes evals reproducible and costs ~nothing. Token-level fuzzy
// matching gives typo/Hinglish robustness without an LLM. It can be swapped for
// an LLM classifier behind the same interface without touching callers.
// ---------------------------------------------------------------------------

export interface RouteDecision {
  intent: Intent;
  risk: RiskClass;
  language: "en" | "hinglish";
  needsLargeModel: boolean;
  confidence: number;
  slots: {
    category?: Category;
    period?: string;
    periodB?: string;
    merchant?: string;
    amountPaise?: number;
    item?: string;
    months?: number;
    unresolvedScope?: string;
  };
  provider: string;
}

// ---- Fuzzy matching helpers ----------------------------------------------
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function collapse(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

function tokenEq(tok: string, word: string): boolean {
  if (tok === word) return true;
  // Stretched letters ("foood" -> "food") are a common typo and a safe match.
  if (word.length >= 4 && tok.length >= 4 && collapse(tok) === collapse(word)) return true;
  if (Math.abs(tok.length - word.length) > 2) return false;
  // Tight enough that "tablet" != "target", loose enough that real typos match.
  const maxDist = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
  return lev(tok, word) <= maxDist;
}

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Does the token list contain `word` (fuzzily)? */
function hasWord(tokens: string[], word: string): boolean {
  return tokens.some((t) => tokenEq(t, word));
}

/** Does the token list contain all words of a phrase as a consecutive run (fuzzily)? */
function hasPhrase(tokens: string[], phrase: string): boolean {
  const words = phrase.split(/\s+/);
  if (words.length === 1) return hasWord(tokens, words[0]);
  for (let i = 0; i + words.length <= tokens.length; i++) {
    let ok = true;
    for (let k = 0; k < words.length; k++) {
      if (!tokenEq(tokens[i + k], words[k])) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function hasAnyWord(tokens: string[], words: string[]): boolean {
  return words.some((w) => hasWord(tokens, w));
}

// ---- Keyword tables -------------------------------------------------------
const CATEGORY_KEYWORDS: { cat: Category; phrases: string[] }[] = [
  { cat: "food_delivery", phrases: ["food delivery", "food", "swiggy", "zomato", "khana order"] },
  { cat: "groceries", phrases: ["grocery", "groceries", "bigbasket", "blinkit", "zepto", "sabzi", "ration"] },
  { cat: "dining", phrases: ["dining", "restaurant", "cafe", "coffee"] },
  { cat: "transport", phrases: ["transport", "uber", "ola", "rapido", "cab", "cabs", "auto", "metro"] },
  { cat: "fuel", phrases: ["fuel", "petrol", "diesel"] },
  { cat: "shopping", phrases: ["shopping", "amazon", "flipkart", "myntra", "ajio", "clothes"] },
  { cat: "entertainment", phrases: ["entertainment", "movie", "bookmyshow", "pvr", "inox"] },
  { cat: "utilities", phrases: ["utility", "utilities", "electricity", "broadband", "recharge"] },
  { cat: "rent", phrases: ["rent", "makaan", "kiraya"] },
  { cat: "subscriptions", phrases: ["subscription", "subscriptions", "netflix", "spotify", "prime", "hotstar"] },
  { cat: "health", phrases: ["health", "pharmacy", "medicine", "medical", "hospital", "clinic", "chemist", "doctor", "dawai"] },
  { cat: "education", phrases: ["education", "course", "courses", "udemy", "coursera", "padhai"] },
  { cat: "travel", phrases: ["flight", "flights", "trip", "irctc", "makemytrip", "indigo", "train", "trains"] },
  { cat: "salary", phrases: ["salary", "income", "earned", "tankhwah"] },
];

const HINGLISH_MARKERS = [
  "kitna", "kitne", "mera", "meri", "paise", "kharch", "kiya", "hua", "kaise",
  "batao", "mahine", "pichle", "pichhle", "rupaye", "sakta", "sakti", "bacha", "bachat",
];

function detectLanguage(tokens: string[]): "en" | "hinglish" {
  return HINGLISH_MARKERS.some((m) => hasWord(tokens, m)) ? "hinglish" : "en";
}

function detectCategory(tokens: string[]): Category | undefined {
  for (const { cat, phrases } of CATEGORY_KEYWORDS) {
    if (phrases.some((p) => hasPhrase(tokens, p))) return cat;
  }
  return undefined;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function detectPeriods(tokens: string[]): { period?: string; periodB?: string } {
  const found: string[] = [];
  // Named months (fuzzy)
  for (const mo of MONTHS) {
    if (hasWord(tokens, mo)) found.push(mo);
  }
  // Relative periods, using the "this/last + unit" shape (fuzzy, Hinglish-aware)
  const lastMarker = hasAnyWord(tokens, ["last", "pichle", "pichhle", "past"]);
  const thisMarker = hasAnyWord(tokens, ["this", "is", "iss", "current"]);
  const monthUnit = hasAnyWord(tokens, ["month", "mahine", "mahina"]);
  const weekUnit = hasAnyWord(tokens, ["week", "hafte", "hafta"]);
  const quarterUnit = hasAnyWord(tokens, ["quarter"]);
  const threeMonths = hasPhrase(tokens, "3 months") || hasPhrase(tokens, "three months");

  if (lastMarker && monthUnit) found.push("last month");
  if (thisMarker && monthUnit) found.push("this month");
  if ((lastMarker || thisMarker) && weekUnit) found.push("last 7 days");
  if ((lastMarker && quarterUnit) || threeMonths) found.push("last 3 months");

  // "past 3 months" / "pichle 3 mahine" is ONE period; never also "last month".
  const threeMonthsHinglish = hasPhrase(tokens, "3 mahine") || hasPhrase(tokens, "3 mahino") || hasPhrase(tokens, "teen mahine");
  if (threeMonths || threeMonthsHinglish || (lastMarker && quarterUnit)) {
    return { period: "last 3 months", periodB: found.find((f) => f !== "last month" && f !== "this month" && f !== "last 3 months") };
  }
  const uniq = [...new Set(found)];
  return { period: uniq[0], periodB: uniq[1] };
}

export function parseAmountPaise(q: string): number | undefined {
  const lower = q.toLowerCase().replace(/,/g, "");
  const lakh = lower.match(/(\d+(?:\.\d+)?)\s*(lakh|lac)/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000 * 100);
  const k = lower.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1000 * 100);
  const plain = lower.match(/(?:₹|rs\.?|inr)\s*(\d{3,})/);
  if (plain) return Math.round(parseFloat(plain[1]) * 100);
  const bare = lower.match(/\b(\d{3,7})\b/);
  if (bare) return Math.round(parseFloat(bare[1]) * 100);
  return undefined;
}

const REGULATED_PATTERNS = [
  /mutual fund/i, /\bsip\b/i, /\bstock(s)?\b/i, /\bshare(s)? (to buy|should)/i, /should i invest/i,
  /invest (in|my)/i, /\bipo\b/i, /\bcrypto\b/i, /bitcoin/i, /which fund/i,
  /take (out )?a?\s*(personal )?loan/i, /should i (take|get) a loan/i,
  /tax saving/i, /save tax/i, /\b80c\b/i, /which insurance/i, /best (policy|mutual fund|stock|investment)/i,
  /\bnps\b/i, /\bppf\b/i, /fixed deposit.*(should|best|recommend)/i, /recommend a (mutual fund|fund|stock)/i,
];

/** "in 4 months", "4 mahine", "in a year" -> number of months. */
export function parseMonths(q: string): number | undefined {
  const lower = q.toLowerCase();
  const m = lower.match(/(\d{1,2})\s*(?:months?|mahine|mahino|mnths?)\b/);
  if (m) return Math.min(60, Math.max(1, parseInt(m[1], 10)));
  if (/\b(?:a|one|1)\s+year\b/.test(lower)) return 12;
  return undefined;
}

// Words that name a scope other than a category; used by the unresolved-scope guard.
const SCOPE_STOPWORDS = new Set([
  "all", "everything", "total", "overall", "money", "spending", "expenses", "month", "months", "week", "weeks",
  "day", "days", "year", "last", "this", "my", "the", "a", "an", "it", "that", "these", "those", "me", "mine",
  "kharch", "paise", "rupaye", "is", "pichle", "pichhle", "mahine", "mahina", "much", "many", "each", "per",
  "and", "or", "of", "in", "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "yesterday", "today", "recently", "lately", "so", "far",
]);

/**
 * If the user scopes the question to something ("on X", "X pe") that we could not map
 * to a category, we must not silently answer with the all-categories total.
 */
function findUnresolvedScope(tokens: string[], category: Category | undefined, merchant: string | undefined): string | undefined {
  // "my cat's food": we only see the user's own transactions by category/merchant.
  const other = tokens.join(" ").match(/\b(?:my|our)\s+(cat|dog|pet|kid|kids|son|daughter|wife|husband|friend|friends|parents|mom|dad|brother|sister)\b/);
  if (other) return `${other[0]}`;
  if (category || merchant) return undefined;
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if ((tokens[i] === "on" || tokens[i] === "for") && i + 1 < tokens.length) {
      let j = i + 1;
      while (j < tokens.length - 1 && ["the", "a", "an", "my", "that", "this"].includes(tokens[j]) && tokens[j] !== "this") j++;
      const next = tokens[j];
      if (!SCOPE_STOPWORDS.has(next) && !/^\d+$/.test(next) && !["the", "a", "an", "my"].includes(next)) out.push(next);
    }
    if ((tokens[i] === "pe" || tokens[i] === "par" || tokens[i] === "mein") && i > 0) {
      const prev = tokens[i - 1];
      if (!SCOPE_STOPWORDS.has(prev) && !/^\d+$/.test(prev)) out.push(prev);
    }
  }
  return out[0];
}

const MONEY_MOVEMENT_PATTERNS = [/\bsend money\b/i, /transfer (to|rs|₹)/i, /\bdispute\b/i];

// Second line of defence: a recommendation cue AND a financial-product noun.
// Heuristic recall, not a guarantee: the blind eval tracks how well it does.
const ADVICE_CUES = /\b(should i|which (?:one )?is better|which is best|better for me|best (?:for me|option|way)|recommend|suggest|advise|good time (?:to|for)|tip (?:on|for)|smart to|worth (?:it|investing)|good idea|is it ok to|what should i (?:buy|invest|do with))\b/i;
const FINANCIAL_PRODUCTS = /\b(fund|funds|sip|stock|stocks|share market|stock market|market|loan|prepay|credit card|insurance|policy|fd|fixed deposit|gold|bitcoin|crypto|nps|ppf|tax|invest|investing|investment|bond|bonds|etf|demat|mortgage|index fund|equity|ulip|annuity|shares|ethereum|eth|solana|dogecoin|altcoin|altcoins)\b/i;

function detectRisk(q: string): RiskClass {
  if (REGULATED_PATTERNS.some((re) => re.test(q))) return "regulated_advice";
  if (ADVICE_CUES.test(q) && FINANCIAL_PRODUCTS.test(q)) return "regulated_advice";
  if (/\b(prepay|credit card|income tax|save tax|index fund|demat)\b/i.test(q) && /\b(which|best|should|better|apply|how can i)\b/i.test(q)) return "regulated_advice";
  if (/\bgold\b/i.test(q) && /\b(buy|invest|smart|good)\b/i.test(q)) return "regulated_advice";
  if (/\b(reduce|lower|cut|save|avoid|minimi[sz]e)\b[^?]*\btax\b|\btax\b[^?]*\b(saving|planning|avoid)/i.test(q)) return "regulated_advice";
  if (MONEY_MOVEMENT_PATTERNS.some((re) => re.test(q))) return "money_movement";
  return "none";
}

export function route(question: string): RouteDecision {
  const q = question.trim();
  const tokens = tokenize(q);
  const language = detectLanguage(tokens);
  const risk = detectRisk(q);
  const category = detectCategory(tokens);
  const { period, periodB } = detectPeriods(tokens);
  const amountPaise = parseAmountPaise(q);
  const months = parseMonths(q);

  // ---- Intent signals (fuzzy) --------------------------------------------
  const spendSignal =
    hasAnyWord(tokens, ["spend", "spent", "much", "total", "kharch", "kharcha", "kitna", "kitne", "breakdown", "pay", "paid", "bill", "bills", "expenses", "spending", "purchases", "gaya", "gaye", "udaya"]) ||
    hasPhrase(tokens, "how much") ||
    hasPhrase(tokens, "where") ;
  const affordSignal =
    hasAnyWord(tokens, ["afford", "buy", "buying", "kharid", "purchase", "getting"]) ||
    hasPhrase(tokens, "can i") ||
    (amountPaise !== undefined &&
      (hasAnyWord(tokens, ["okay", "ok", "alright", "worth", "expensive"]) || hasPhrase(tokens, "too much")));
  const goalSignal =
    hasAnyWord(tokens, ["goal", "target", "realistic", "achievable"]) ||
    (hasAnyWord(tokens, ["save", "saving", "savings", "bachat"]) && (amountPaise !== undefined || months !== undefined)) ||
    hasPhrase(tokens, "set aside") ||
    hasPhrase(tokens, "stash away") ||
    hasPhrase(tokens, "put away") ||
    hasWord(tokens, "stash") ||
    hasPhrase(tokens, "put aside") ||
    hasPhrase(tokens, "save for") ||
    hasPhrase(tokens, "saving for") ||
    hasWord(tokens, "bachana");
  const dupSignal = hasAnyWord(tokens, ["duplicate", "twice", "double"]) || hasPhrase(tokens, "charged twice");
  const subCountSignal =
    (hasAnyWord(tokens, ["how", "many", "which", "list", "kaunse"]) && hasWord(tokens, "subscription")) ||
    (hasWord(tokens, "subscription") && !spendSignal) ||
    hasWord(tokens, "recurring");
  const compareSignal =
    (!!period && !!periodB) ||
    hasAnyWord(tokens, ["compare", "versus", "vs", "zyada", "kam"]) ||
    hasPhrase(tokens, "more than") ||
    (hasAnyWord(tokens, ["higher", "lower", "more", "less", "up", "down", "increased", "decreased"]) &&
      hasAnyWord(tokens, ["than", "compared", "versus", "vs"]));

  let intent: Intent;
  let needsLargeModel = false;
  let confidence = 0.9;

  if (risk === "regulated_advice") {
    intent = "regulated_advice";
    confidence = 0.97;
  } else if (
    (hasAnyWord(tokens, ["reimbursed", "refunded"]) || hasPhrase(tokens, "that was") || hasPhrase(tokens, "not mine") || hasPhrase(tokens, "thats not")) &&
    !affordSignal
  ) {
    intent = "correction";
  } else if (goalSignal) {
    intent = "goal_planning";
    needsLargeModel = true;
  } else if (affordSignal && amountPaise !== undefined) {
    intent = "affordability";
    needsLargeModel = true;
  } else if (dupSignal) {
    intent = "leakage_detection";
  } else if (subCountSignal && !spendSignal) {
    intent = "leakage_detection";
  } else if (compareSignal && (category || period)) {
    intent = "period_comparison";
  } else if (spendSignal || category) {
    // A spend-type question, or any question naming a category/period.
    intent = "factual_lookup";
    // Never answer a scoped question with the all-categories total: ask instead.
    if (findUnresolvedScope(tokens, category, detectMerchant(tokens))) {
      intent = "ambiguous";
      confidence = 0.5;
    }
  } else if (q.length < 4 || hasAnyWord(tokens, ["hi", "hello", "hey", "namaste", "thanks"])) {
    intent = "smalltalk";
    confidence = 0.8;
  } else {
    intent = "ambiguous";
    confidence = 0.45;
  }

  if (q.length > 160 || (q.match(/\?/g)?.length ?? 0) > 1) needsLargeModel = true;

  return {
    intent,
    risk,
    language,
    needsLargeModel,
    confidence,
    slots: { category, period, periodB, merchant: detectMerchant(tokens), amountPaise, item: extractItem(q), months, unresolvedScope: findUnresolvedScope(tokens, category, detectMerchant(tokens)) },
    provider: "router:heuristic-fuzzy-v2",
  };
}

function detectMerchant(tokens: string[]): string | undefined {
  const known = ["amazon", "flipkart", "swiggy", "zomato", "netflix", "spotify", "hotstar", "uber", "ola", "rapido", "myntra", "blinkit", "zepto", "bigbasket"];
  const hits = known.filter((m) => hasWord(tokens, m));
  // Two merchants named ("Swiggy or Zomato") means the category total, not just the first one.
  if (hits.length !== 1) return undefined;
  return hits[0][0].toUpperCase() + hits[0].slice(1);
}

function extractItem(q: string): string | undefined {
  const m = q.match(
    /(?:buy|afford|kharid\w*)\s+(?:a |an |the )?(?:₹?\s?[\d,]+\s*(?:k|lakh|lac)?\s*)?([a-zA-Z][a-zA-Z\s]{1,24}?)(?:\s+(?:this|next|by|for|in)\b|\?|$)/i
  );
  if (m) return m[1].trim();
  return undefined;
}
