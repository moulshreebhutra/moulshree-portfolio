import { EvalType } from "./golden";

// ---------------------------------------------------------------------------
// Answer-quality rubric. In the PRD this is a model judge calibrated against
// ~50 human labels. For offline reproducibility the prototype ships a
// deterministic HEURISTIC scorer with the same rubric dimensions. It is NOT
// human-calibrated, so no agreement figure is claimed (the report shows null).
// Swap in an LLM judge by implementing the same interface, then calibrate it.
//
// Dimensions (each 0..1): clarity, completeness, assumptions-stated, tone.
// ---------------------------------------------------------------------------

const BANNED_TONE = [/\bobviously\b/i, /\bsimply just\b/i, /as an ai/i];

export interface RubricScore {
  clarity: number;
  completeness: number;
  assumptions: number;
  tone: number;
  overall: number;
}

export function scoreAnswer(answer: string, type: EvalType): RubricScore {
  const a = answer.trim();
  const len = a.length;

  // Clarity: non-empty, not too long, has a rupee figure where expected.
  let clarity = 1;
  if (len === 0) clarity = 0;
  else if (len > 900) clarity = 0.7;
  else if (len < 20) clarity = 0.5;

  // Completeness: mentions a number for numeric types; a verdict for afford.
  let completeness = 1;
  const hasFigure = /₹\s?[0-9]/.test(a);
  if (["factual_lookup", "period_comparison", "leakage_detection", "hinglish", "robustness"].includes(type)) {
    completeness = hasFigure ? 1 : 0.3;
  }
  if (type === "affordability") {
    const hasVerdict = /(yes|tight|not this month|probably not|affordable)/i.test(a);
    completeness = hasVerdict && hasFigure ? 1 : hasVerdict || hasFigure ? 0.6 : 0.2;
  }

  // Assumptions stated (affordability/goal should).
  let assumptions = 1;
  if (type === "affordability") {
    assumptions = /assumption|based on|cushion|not financial advice/i.test(a) ? 1 : 0.4;
  }

  // Tone: warm, no banned phrases.
  let tone = 1;
  if (BANNED_TONE.some((re) => re.test(a))) tone = 0.5;

  const overall = +(clarity * 0.3 + completeness * 0.4 + assumptions * 0.15 + tone * 0.15).toFixed(3);
  return { clarity, completeness, assumptions, tone, overall };
}
