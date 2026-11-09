// ---------------------------------------------------------------------------
// Core domain types for Aster.
//
// Money is stored as integer paise (1 INR = 100 paise) everywhere internally so
// that all arithmetic is exact. Formatting to rupees happens only at the edges.
// ---------------------------------------------------------------------------

export type Category =
  | "food_delivery"
  | "groceries"
  | "dining"
  | "transport"
  | "fuel"
  | "shopping"
  | "entertainment"
  | "utilities"
  | "rent"
  | "subscriptions"
  | "health"
  | "education"
  | "travel"
  | "transfer_out"
  | "salary"
  | "refund"
  | "fees"
  | "cash";

export const CATEGORIES: Category[] = [
  "food_delivery",
  "groceries",
  "dining",
  "transport",
  "fuel",
  "shopping",
  "entertainment",
  "utilities",
  "rent",
  "subscriptions",
  "health",
  "education",
  "travel",
  "transfer_out",
  "salary",
  "refund",
  "fees",
  "cash",
];

export type Direction = "debit" | "credit";
export type Method = "upi" | "card";
export type TxnStatus = "success" | "failed" | "refunded" | "pending";

export interface Transaction {
  id: string;
  userId: string;
  ts: string; // ISO timestamp
  amountPaise: number; // always positive; direction says in/out
  direction: Direction;
  merchant: string;
  category: Category;
  method: Method;
  status: TxnStatus;
  /**
   * Free-text as it would arrive from a payment rail. This field is deliberately
   * treated as untrusted DATA by the agent (never instructions) and is where
   * prompt-injection robustness cases are planted.
   */
  rawDescription: string;
  recurringKey?: string; // set for subscription-style charges
  note?: string;
}

export type PersonaType = "everyday" | "stretched" | "goal_saver";

export interface UserProfile {
  id: string;
  name: string;
  persona: PersonaType;
  monthlyIncomePaise: number;
  salaryDay: number; // day of month salary lands
  city: string;
}

export interface MemoryFact {
  id: string;
  userId: string;
  kind: "correction" | "goal" | "preference";
  text: string;
  // structured payload for goals
  goal?: {
    name: string;
    targetPaise: number;
    byDate: string; // ISO date
  };
  sourceMessage: string; // the user message that created this fact
  createdAt: string;
}

export interface TraceToolCall {
  tool: string;
  args: Record<string, unknown>;
  rowCount: number;
  resultSummary: Record<string, unknown>;
}

export interface Trace {
  id: string;
  userId: string;
  ts: string;
  question: string;
  language: "en" | "hinglish";
  router: {
    intent: Intent;
    risk: RiskClass;
    needsLargeModel: boolean;
    confidence: number;
    provider: string;
  };
  toolCalls: TraceToolCall[];
  modelTier: "none" | "small" | "mid" | "large";
  composerProvider: string;
  gate: {
    passed: boolean;
    retried: boolean;
    violations: string[];
  };
  answer: string;
  sources: string[]; // transaction ids backing the answer
  tokens: { in: number; out: number };
  costMicros: number; // cost in micro-USD (1e-6 USD)
  latencyMs: number;
  feedback?: { vote: "up" | "down"; reason?: string; at: string };
}

export type Intent =
  | "factual_lookup"
  | "period_comparison"
  | "affordability"
  | "leakage_detection"
  | "goal_planning"
  | "correction"
  | "regulated_advice"
  | "ambiguous"
  | "smalltalk";

export type RiskClass = "none" | "regulated_advice" | "money_movement";
