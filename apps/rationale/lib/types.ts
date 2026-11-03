export type Tier = "Enterprise" | "Mid-market" | "SMB";
export const TIERS: Tier[] = ["Enterprise", "Mid-market", "SMB"];
export type Severity = "blocker" | "high" | "medium" | "low";

export interface Item {
  id: number;
  customer: string;
  tier: Tier;
  /** Annual recurring revenue in thousands of dollars. */
  arr: number;
  text: string;
}

export interface Theme {
  id: string;
  title: string;
  itemIds: number[];
  summary: string;
  effort: number; // 1..5
  effortWhy: string;
  confidence: number; // 0.2..1
  blocksRevenue: boolean;
  severity: Severity;
  prd?: string;
}

export interface Workspace {
  items: Item[];
  themes: Theme[];
  source: "none" | "rules" | "ai";
}

export const LIMITS = { maxItems: 60, maxTextChars: 600, maxTotalChars: 20000, maxArr: 100000 } as const;
