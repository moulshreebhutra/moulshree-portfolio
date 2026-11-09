import { AllowedFacts } from "./composer";

// ---------------------------------------------------------------------------
// The gate. Deterministic checks run first (cheaper and more reliable than a
// model judging a model):
//   1. Grounding: every rupee figure, percentage and count in the answer must
//      match a tool output.
//   2. Safety: no regulated-advice phrasing leaks into a non-redirect answer.
// A draft that fails gets exactly one retry upstream; if it fails again, the
// guaranteed-grounded offline template is used instead.
// ---------------------------------------------------------------------------

export interface GateResult {
  passed: boolean;
  violations: string[];
}

// Pull every rupee amount out of a free-text answer.
export function extractRupeeFigures(text: string): number[] {
  const out: number[] = [];
  // Match ₹ amounts and "Rs" amounts, with Indian grouping and optional decimals.
  const re = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

// Percentages ("12%") and counts of things ("3 charges") must also come from a tool.
export function extractPercentages(text: string): number[] {
  return [...text.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%/g)].map((m) => parseFloat(m[1]));
}
export function extractCounts(text: string): number[] {
  const re = /\b([0-9]+)\s+(?:likely\s+|recurring\s+|duplicate\s+)*(?:transactions?|charges?|payments?|subscriptions?|duplicates?|purchases?|orders?|times)\b/gi;
  return [...text.matchAll(re)].map((m) => parseInt(m[1], 10));
}

const ADVICE_LEAK_PATTERNS = [
  /you should invest/i,
  /i recommend (buying|investing|a loan|this fund)/i,
  /put (it|this|your money) in (mutual funds|stocks|crypto)/i,
  /take (out )?a (personal )?loan/i,
  /best (mutual fund|stock|investment) (is|would be)/i,
];

export function runGate(answer: string, facts: AllowedFacts, opts?: { isRedirect?: boolean }): GateResult {
  const violations: string[] = [];

  // 1) Grounding — every figure must match an allowed tool output (±1 rupee for rounding).
  const figures = extractRupeeFigures(answer);
  const allowed = facts.rupeeValues;
  for (const f of figures) {
    const ok = allowed.some((a) => Math.abs(a - f) <= 1.0) || f === 0;
    if (!ok) {
      violations.push(`ungrounded_figure:₹${f}`);
    }
  }

  // 1b) Grounding for non-rupee numbers: percentages and counts.
  const nums = facts.numbers ?? [];
  for (const p of extractPercentages(answer)) {
    if (!nums.some((a) => Math.abs(a - p) <= 0.5)) violations.push(`ungrounded_percentage:${p}%`);
  }
  for (const n of extractCounts(answer)) {
    if (!nums.includes(n)) violations.push(`ungrounded_count:${n}`);
  }

  // 2) Safety — regulated advice must never appear in a normal answer.
  if (!opts?.isRedirect) {
    for (const re of ADVICE_LEAK_PATTERNS) {
      if (re.test(answer)) violations.push(`regulated_advice_leak:${re.source.slice(0, 24)}`);
    }
  }

  return { passed: violations.length === 0, violations };
}
