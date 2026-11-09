import { store } from "../data/store";
import { MemoryFact } from "../data/types";
import { parseAmountPaise } from "./router";

// ---------------------------------------------------------------------------
// Memory: only explicit user corrections and goals are stored, as typed facts
// with the source message. Everything is viewable and deletable from the
// "What Aster remembers" screen.
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Try to capture a correction or goal from a user message. Returns the fact if one was stored. */
export function captureMemory(userId: string, message: string): MemoryFact | null {
  const lower = message.toLowerCase();

  // Goal: "save for a phone by March", "goal: 60000 by 2026-03"
  if (/goal|save for|saving for|bachana hai|down payment/.test(lower)) {
    const amount = parseAmountPaise(message);
    const byMatch = message.match(
      /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december|20\d{2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i
    );
    const nameMatch = message.match(
      /(?:save for|saving for|goal[:]?)\s+(?:a |an |the )?(?:₹?\s?[\d,]+\s*(?:k|lakh|lac)?\s*)?([a-zA-Z][a-zA-Z\s]{1,24}?)(?:\s+(?:by|for|in)\b|,|\.|$)/i
    );
    const fact: MemoryFact = {
      id: newId("goal"),
      userId,
      kind: "goal",
      text: message.trim(),
      goal: amount
        ? {
            name: nameMatch?.[1]?.trim() ?? "savings goal",
            targetPaise: amount,
            byDate: byMatch?.[1] ?? "unspecified",
          }
        : undefined,
      sourceMessage: message,
      createdAt: new Date().toISOString(),
    };
    store().addMemory(fact);
    return fact;
  }

  // Correction: "that was reimbursed", "that's not mine", "actually that was a refund"
  if (/that was|that's not|thats not|not mine|reimbursed|actually .* was|galat hai|wo mera nahi/.test(lower)) {
    const fact: MemoryFact = {
      id: newId("corr"),
      userId,
      kind: "correction",
      text: message.trim(),
      sourceMessage: message,
      createdAt: new Date().toISOString(),
    };
    store().addMemory(fact);
    return fact;
  }

  return null;
}

/** Render stored facts as a compact context block for the composer. */
export function memoryContext(userId: string): string {
  const facts = store().memoryForUser(userId);
  if (facts.length === 0) return "";
  const lines = facts.map((f) => {
    if (f.kind === "goal" && f.goal) {
      return `- Goal: ${f.goal.name}, target ${f.goal.targetPaise / 100} INR by ${f.goal.byDate}`;
    }
    return `- ${f.kind}: ${f.text}`;
  });
  return `Known facts the user told Aster earlier:\n${lines.join("\n")}`;
}
