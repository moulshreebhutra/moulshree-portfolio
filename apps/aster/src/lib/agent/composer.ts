import {
  affordabilityCheck,
  comparePeriods,
  detectDuplicates,
  filterTransactions,
  fmt,
  incomeSummary,
  listRecurring,
  resolvePeriod,
  runTool,
  sumSpend,
  ToolName,
  ToolResult,
} from "../tools";
import { ANCHOR } from "../data/generator";
import { RouteDecision } from "./router";
import { memoryContext } from "./memory";
import { store } from "../data/store";

export interface PlannedCall {
  tool: ToolName;
  args: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Tool-call plan. Deterministic given the route decision. The eval harness
// checks these planned calls against reference calls (tool-call correctness).
// ---------------------------------------------------------------------------
export function planTools(route: RouteDecision, userId: string): PlannedCall[] {
  const s = route.slots;
  switch (route.intent) {
    case "factual_lookup":
      return [{ tool: "sum_spend", args: { userId, category: s.category, period: s.period, merchant: s.merchant } }];
    case "period_comparison":
      return [
        {
          tool: "compare_periods",
          args: {
            userId,
            category: s.category,
            periodA: s.period ?? "last month",
            periodB: s.periodB ?? "this month",
          },
        },
      ];
    case "affordability":
      return [{ tool: "affordability_check", args: { userId, amountPaise: s.amountPaise ?? 0, item: s.item } }];
    case "goal_planning": {
      const goal = store()
        .memoryForUser(userId)
        .filter((f) => f.kind === "goal" && f.goal)
        .slice(-1)[0];
      // The current question wins over an older remembered goal.
      const targetPaise = s.amountPaise ?? goal?.goal?.targetPaise ?? 0;
      const byDate = s.months ? undefined : goal?.goal?.byDate;
      return [{ tool: "goal_plan", args: { userId, targetPaise, byDate, months: s.months } }];
    }
    case "leakage_detection":
      // Subscription questions -> list recurring; "charged twice" -> duplicates.
      if (route.slots.category === "subscriptions") {
        return [{ tool: "list_recurring", args: { userId } }];
      }
      return [
        { tool: "detect_duplicates", args: { userId, windowMinutes: 10 } },
        { tool: "list_recurring", args: { userId } },
      ];
    default:
      return [];
  }
}

export interface ComposeInput {
  userId: string;
  question: string;
  route: RouteDecision;
}

export interface ComposeResult {
  toolResults: ToolResult[];
  plannedCalls: PlannedCall[];
  facts: AllowedFacts;
  offlineAnswer: string;
  modelTier: "none" | "small" | "mid" | "large";
}

// Figures that are allowed to appear in the final answer (rupee strings), used
// by the gate. Built ONLY from tool outputs.
export interface AllowedFacts {
  rupeeValues: number[]; // allowed rupee amounts (2dp)
  numbers: number[]; // every other number a tool returned (counts, percentages, months...)
  summaryLines: string[];
}

function collectAllowed(results: ToolResult[]): AllowedFacts {
  const paiseSet = new Set<number>();
  const numberSet = new Set<number>();
  const summaryLines: string[] = [];
  const addNum = (n: number) => {
    if (Number.isFinite(n)) {
      numberSet.add(n);
      numberSet.add(Math.abs(n));
    }
  };
  const addNumbersFromText = (t: string) => {
    for (const m of t.matchAll(/[0-9][0-9,]*(?:\.[0-9]+)?/g)) addNum(parseFloat(m[0].replace(/,/g, "")));
  };
  for (const r of results) {
    addNum(r.rows.length);
    for (const [k, v] of Object.entries(r.summary)) {
      if (typeof v === "number" && !k.endsWith("_paise")) addNum(v);
      if (Array.isArray(v)) {
        addNum(v.length);
        for (const item of v) {
          if (typeof item === "string") addNumbersFromText(item);
          else if (item && typeof item === "object") {
            for (const [kk, vv] of Object.entries(item)) {
              if (typeof vv === "number" && !kk.endsWith("_paise")) addNum(vv as number);
            }
          }
        }
      }
    }
    for (const [k, v] of Object.entries(r.summary)) {
      if (typeof v === "number" && k.endsWith("_paise")) paiseSet.add(v);
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === "object") {
            for (const [kk, vv] of Object.entries(item)) {
              if (typeof vv === "number" && kk.endsWith("_paise")) paiseSet.add(vv as number);
            }
          }
        }
      }
    }
    for (const row of r.rows) paiseSet.add(row.amountPaise);
  }
  // Answers print absolute amounts (e.g. a negative delta shown as "₹63 less"),
  // so both the signed value and its absolute value are valid grounded figures.
  const rupeeValues = [...paiseSet].flatMap((p) => [Math.round(p) / 100, Math.abs(Math.round(p)) / 100]);
  return { rupeeValues: [...new Set(rupeeValues)], numbers: [...numberSet], summaryLines };
}

// ---------------------------------------------------------------------------
// Offline (deterministic) answer templates. These are guaranteed-grounded
// because they format ONLY tool-output numbers via fmt(). They are also the
// safe fallback if the LLM answer fails the gate twice.
// ---------------------------------------------------------------------------
function offlineAnswer(route: RouteDecision, results: ToolResult[]): string {
  const r0 = results[0];
  switch (route.intent) {
    case "factual_lookup": {
      const total = r0.summary.total_paise as number;
      const count = r0.summary.count as number;
      const period = r0.summary.period as string;
      const cat = route.slots.category ? route.slots.category.replace(/_/g, " ") : "all categories";
      // Be exact about scope: a merchant filter is "at Amazon", not "on shopping".
      const where = route.slots.merchant ? `at ${route.slots.merchant}` : `on ${cat}`;
      const when = /^(this|last)\b/.test(period) ? period : `in ${period}`;
      if (count === 0) return `You spent ${fmt(0)} ${where} ${when} — I couldn't find any transactions in that window.`;
      return `You spent ${fmt(total)} ${where} ${when}, across ${count} transaction${count === 1 ? "" : "s"}. Tap "Show the working" to see every transaction behind this total.`;
    }
    case "period_comparison": {
      const a = r0.summary.a_total_paise as number;
      const b = r0.summary.b_total_paise as number;
      const delta = r0.summary.delta_paise as number;
      const pct = r0.summary.pct_change as number | null;
      const dir = delta > 0 ? "more" : "less";
      const cat = route.slots.category ? route.slots.category.replace(/_/g, " ") : "overall";
      const pctStr = pct === null ? "" : ` (${Math.abs(pct)}% ${delta > 0 ? "up" : "down"})`;
      return `For ${cat}: ${fmt(b)} ${/^(this|last)\b/.test(String(r0.summary.b_label)) ? "" : "in "}${r0.summary.b_label}, versus ${fmt(a)} ${/^(this|last)\b/.test(String(r0.summary.a_label)) ? "" : "in "}${r0.summary.a_label}. That's ${fmt(Math.abs(delta))} ${dir}${pctStr}.`;
    }
    case "affordability": {
      const s = r0.summary;
      const verdict = s.verdict as string;
      const price = s.price_paise as number;
      const low = s.affordable_low_paise as number;
      const high = s.affordable_high_paise as number;
      const itemRaw = ((s.item as string) || "that").trim();
      const item = itemRaw.charAt(0).toUpperCase() + itemRaw.slice(1);
      const head =
        verdict === "yes"
          ? `Yes — ${item} at ${fmt(price)} looks affordable this month.`
          : verdict === "tight"
          ? `It's tight. ${item} at ${fmt(price)} is within reach but would eat into your cushion.`
          : `Probably not this month. ${item} at ${fmt(price)} is above what you can comfortably spare.`;
      const range = `Based on your money, you can comfortably spend roughly ${fmt(low)}–${fmt(high)} this month.`;
      const assumptions = (s.assumptions as string[]).map((a) => `• ${a}`).join("\n");
      return `${head}\n\n${range}\n\nAssumptions:\n${assumptions}\n\nThis is a cashflow estimate, not financial advice.`;
    }
    case "goal_planning": {
      const g = r0.summary;
      const target = g.target_paise as number;
      const monthlyReq = g.monthly_required_paise as number;
      const surplus = g.monthly_surplus_paise as number;
      const shortfall = g.shortfall_paise as number;
      const label = g.timeframe_label as string;
      const feasible = g.feasible as boolean;
      if (!target) {
        return `On average you take home ${fmt(g.avg_monthly_income_paise as number)} a month and spend about ${fmt(g.avg_monthly_spend_paise as number)}, leaving roughly ${fmt(surplus)} to save. Tell me a target amount and date and I'll check if the plan is realistic. This is a cashflow estimate, not financial advice.`;
      }
      const head = `To reach ${fmt(target)} in ${label}, you'd need to set aside about ${fmt(monthlyReq)} a month. Right now you have roughly ${fmt(surplus)} a month free.`;
      const verdict = feasible
        ? `That looks achievable on your current cashflow.`
        : `That's about ${fmt(shortfall)} a month short — you'd need to stretch the date or trim spending to hit it.`;
      return `${head} ${verdict}\n\nThis is a cashflow estimate, not financial advice.`;
    }
    case "leakage_detection": {
      const dup = results.find((r) => r.tool === "detect_duplicates");
      const rec = results.find((r) => r.tool === "list_recurring");
      if (dup && (dup.summary.group_count as number) > 0) {
        const groups = dup.summary.groups as any[];
        const g = groups[0];
        return `Heads up: I found ${dup.summary.group_count} likely duplicate charge${(dup.summary.group_count as number) === 1 ? "" : "s"}. For example, ${g.merchant} charged ${fmt(g.amount_paise)} twice within minutes. That's ${fmt(dup.summary.total_duplicated_paise as number)} potentially charged twice — tap to review or dispute.`;
      }
      if (rec) {
        const subs = rec.summary.subscriptions as any[];
        const top = subs.slice(0, 3).map((x) => `${x.merchant} ${fmt(x.amount_paise)}`).join(", ");
        return `You have ${rec.summary.subscription_count} recurring subscriptions costing ${fmt(rec.summary.monthly_total_paise as number)} a month. The largest: ${top}. Tap to see all of them.`;
      }
      return `Good news — I didn't find any duplicate charges in the window I checked.`;
    }
    default:
      return "";
  }
}

export function compose(input: ComposeInput): ComposeResult {
  const { userId, route } = input;
  const plannedCalls = planTools(route, userId);
  const toolResults = plannedCalls.map((c) => runTool(c.tool, c.args));
  const facts = collectAllowed(toolResults);
  const offline = offlineAnswer(route, toolResults);
  const modelTier: ComposeResult["modelTier"] =
    plannedCalls.length === 0 ? "none" : route.needsLargeModel ? "large" : "mid";
  return { toolResults, plannedCalls, facts, offlineAnswer: offline, modelTier };
}

// Build the grounded facts block handed to the LLM composer.
export function factsForPrompt(results: ToolResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    lines.push(`Tool ${r.tool} returned:`);
    for (const [k, v] of Object.entries(r.summary)) {
      if (k === "assumptions" || k === "groups" || k === "subscriptions") continue;
      if (typeof v === "number" && k.endsWith("_paise")) {
        lines.push(`  ${k}: ${fmt(v)} (exact)`);
      } else if (typeof v !== "object") {
        lines.push(`  ${k}: ${v}`);
      }
    }
    if (Array.isArray(r.summary.assumptions)) {
      lines.push(`  assumptions: ${(r.summary.assumptions as string[]).join("; ")}`);
    }
  }
  return lines.join("\n");
}

export { collectAllowed };
