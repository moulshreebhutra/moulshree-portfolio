import { store } from "../data/store";
import { ANCHOR } from "../data/generator";
import { Category, Transaction } from "../data/types";

// ---------------------------------------------------------------------------
// Tool layer. The model NEVER does arithmetic or recalls transactions — these
// deterministic functions do. Every tool returns:
//   - computed figures (in paise, exact integers)
//   - the exact source transaction rows + their ids
// The agent's gate later checks that every number in the answer appears here.
// ---------------------------------------------------------------------------

export type ToolName =
  | "sum_spend"
  | "filter_transactions"
  | "compare_periods"
  | "detect_duplicates"
  | "list_recurring"
  | "income_summary"
  | "affordability_check"
  | "goal_plan";

export interface ToolResult {
  tool: ToolName;
  args: Record<string, any>;
  rows: Transaction[];
  sources: string[];
  // arbitrary numeric/summary payload; all money fields are *_paise integers
  summary: Record<string, unknown>;
}

// ---- Date helpers (relative to the fixed ANCHOR) --------------------------
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export interface DateRange {
  start: string; // ISO inclusive
  end: string; // ISO exclusive
  label: string;
}

function startOfMonth(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1, 0, 0, 0));
}

export function monthRange(year: number, month0: number): DateRange {
  const start = startOfMonth(year, month0);
  const end = startOfMonth(year, month0 + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${MONTHS[((month0 % 12) + 12) % 12].replace(/^./, (c) => c.toUpperCase())} ${year}`,
  };
}

/** Resolve a natural phrase into a date range, anchored to ANCHOR. */
export function resolvePeriod(phrase?: string): DateRange {
  const now = ANCHOR;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const p = (phrase ?? "").toLowerCase().trim();

  if (!p || p === "this month") return { ...monthRange(y, m), label: "this month" };
  if (p === "last month") {
    const r = monthRange(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
    return { ...r, label: "last month" };
  }
  if (p === "last 7 days" || p === "this week") {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString(), end: end.toISOString(), label: "the last 7 days" };
  }
  if (p === "last 30 days") {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { start: start.toISOString(), end: end.toISOString(), label: "the last 30 days" };
  }
  if (p === "last 3 months" || p === "last quarter") {
    const start = new Date(Date.UTC(y, m - 3, 1));
    const end = startOfMonth(y, m + 1);
    return { start: start.toISOString(), end: end.toISOString(), label: "the last 3 months" };
  }
  // Named month, optionally with year
  const monthIdx = MONTHS.findIndex((mm) => p.includes(mm));
  if (monthIdx >= 0) {
    const yearMatch = p.match(/(20\d{2})/);
    let year = yearMatch ? parseInt(yearMatch[1], 10) : y;
    // If no explicit year and that month is in the future, use previous year.
    if (!yearMatch && monthIdx > m) year = y - 1;
    return monthRange(year, monthIdx);
  }
  // Default
  return { ...monthRange(y, m), label: "this month" };
}

// ---- Core helpers ---------------------------------------------------------
function inRange(t: Transaction, r?: DateRange): boolean {
  if (!r) return true;
  return t.ts >= r.start && t.ts < r.end;
}

function matchCategory(t: Transaction, c?: Category | Category[]): boolean {
  if (!c) return true;
  const arr = Array.isArray(c) ? c : [c];
  return arr.includes(t.category);
}

function sumPaise(rows: Transaction[]): number {
  return rows.reduce((acc, t) => acc + t.amountPaise, 0);
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

export interface SumSpendArgs {
  userId: string;
  category?: Category | Category[];
  period?: string;
  merchant?: string;
  direction?: "debit" | "credit";
  includeFailed?: boolean;
}

export function sumSpend(args: SumSpendArgs): ToolResult {
  const { userId } = args;
  const range = resolvePeriod(args.period);
  const direction = args.direction ?? "debit";
  let rows = store()
    .txnsForUser(userId)
    .filter(
      (t) =>
        inRange(t, range) &&
        t.direction === direction &&
        matchCategory(t, args.category) &&
        (args.includeFailed ? true : t.status === "success")
    );
  if (args.merchant) {
    const q = args.merchant.toLowerCase();
    rows = rows.filter((t) => t.merchant.toLowerCase().includes(q));
  }
  const total = sumPaise(rows);
  return {
    tool: "sum_spend",
    args,
    rows,
    sources: rows.map((r) => r.id),
    summary: {
      total_paise: total,
      count: rows.length,
      period: range.label,
      period_start: range.start,
      period_end: range.end,
      direction,
    },
  };
}

export interface FilterArgs {
  userId: string;
  category?: Category | Category[];
  period?: string;
  merchant?: string;
  status?: Transaction["status"];
  limit?: number;
}

export function filterTransactions(args: FilterArgs): ToolResult {
  const range = args.period ? resolvePeriod(args.period) : undefined;
  let rows = store()
    .txnsForUser(args.userId)
    .filter((t) => inRange(t, range) && matchCategory(t, args.category));
  if (args.merchant) {
    const q = args.merchant.toLowerCase();
    rows = rows.filter((t) => t.merchant.toLowerCase().includes(q));
  }
  if (args.status) rows = rows.filter((t) => t.status === args.status);
  rows = rows.sort((a, b) => b.ts.localeCompare(a.ts));
  if (args.limit) rows = rows.slice(0, args.limit);
  return {
    tool: "filter_transactions",
    args,
    rows,
    sources: rows.map((r) => r.id),
    summary: { count: rows.length, total_paise: sumPaise(rows) },
  };
}

export interface ComparePeriodsArgs {
  userId: string;
  category?: Category | Category[];
  periodA: string; // e.g. "last month"
  periodB: string; // e.g. "this month"
}

export function comparePeriods(args: ComparePeriodsArgs): ToolResult {
  const a = sumSpend({ userId: args.userId, category: args.category, period: args.periodA });
  const b = sumSpend({ userId: args.userId, category: args.category, period: args.periodB });
  const aTotal = a.summary.total_paise as number;
  const bTotal = b.summary.total_paise as number;
  const delta = bTotal - aTotal;
  const pct = aTotal === 0 ? null : Math.round((delta / aTotal) * 1000) / 10;
  return {
    tool: "compare_periods",
    args,
    rows: [...a.rows, ...b.rows],
    sources: [...a.sources, ...b.sources],
    summary: {
      a_label: a.summary.period,
      b_label: b.summary.period,
      a_total_paise: aTotal,
      b_total_paise: bTotal,
      delta_paise: delta,
      pct_change: pct,
    },
  };
}

export interface DetectDuplicatesArgs {
  userId: string;
  windowMinutes?: number;
  period?: string;
}

export function detectDuplicates(args: DetectDuplicatesArgs): ToolResult {
  const windowMs = (args.windowMinutes ?? 10) * 60000;
  const range = args.period ? resolvePeriod(args.period) : undefined;
  const rows = store()
    .txnsForUser(args.userId)
    .filter((t) => t.direction === "debit" && inRange(t, range))
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const groups: { merchant: string; amount_paise: number; ids: string[]; ts: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.merchant !== b.merchant || a.amountPaise !== b.amountPaise) continue;
      const dt = new Date(b.ts).getTime() - new Date(a.ts).getTime();
      if (dt >= 0 && dt <= windowMs) {
        groups.push({
          merchant: a.merchant,
          amount_paise: a.amountPaise,
          ids: [a.id, b.id],
          ts: [a.ts, b.ts],
        });
      }
    }
  }
  const sources = groups.flatMap((g) => g.ids);
  const dupRows = rows.filter((r) => sources.includes(r.id));
  return {
    tool: "detect_duplicates",
    args,
    rows: dupRows,
    sources,
    summary: {
      group_count: groups.length,
      groups,
      total_duplicated_paise: groups.reduce((a, g) => a + g.amount_paise, 0),
    },
  };
}

export interface ListRecurringArgs {
  userId: string;
}

export function listRecurring(args: ListRecurringArgs): ToolResult {
  const rows = store().txnsForUser(args.userId).filter((t) => t.recurringKey);
  const byKey = new Map<string, Transaction[]>();
  for (const t of rows) {
    const k = t.recurringKey!;
    byKey.set(k, [...(byKey.get(k) ?? []), t]);
  }
  const subs = [...byKey.entries()].map(([key, txs]) => {
    const latest = txs.sort((a, b) => b.ts.localeCompare(a.ts))[0];
    return {
      key,
      merchant: latest.merchant,
      amount_paise: latest.amountPaise,
      occurrences: txs.length,
      last_charge: latest.ts,
      ids: txs.map((t) => t.id),
    };
  });
  const monthly = subs.reduce((a, s) => a + s.amount_paise, 0);
  return {
    tool: "list_recurring",
    args,
    rows,
    sources: rows.map((r) => r.id),
    summary: {
      subscription_count: subs.length,
      monthly_total_paise: monthly,
      subscriptions: subs.sort((a, b) => b.amount_paise - a.amount_paise),
    },
  };
}

export interface IncomeSummaryArgs {
  userId: string;
  months?: number;
}

export function incomeSummary(args: IncomeSummaryArgs): ToolResult {
  const months = args.months ?? 3;
  const salary = store()
    .txnsForUser(args.userId)
    .filter((t) => t.category === "salary" && t.direction === "credit")
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const recent = salary.slice(0, months);
  const avg =
    recent.length === 0 ? 0 : Math.round(recent.reduce((a, t) => a + t.amountPaise, 0) / recent.length);
  const user = store().user(args.userId);
  return {
    tool: "income_summary",
    args,
    rows: recent,
    sources: recent.map((r) => r.id),
    summary: {
      avg_monthly_income_paise: avg,
      salary_day: user?.salaryDay ?? null,
      samples: recent.length,
    },
  };
}

export interface AffordabilityArgs {
  userId: string;
  amountPaise: number;
  item?: string;
}

/**
 * Affordability check. Produces a RANGE and the assumptions behind it rather
 * than a single false-precision number. Every figure it returns is also a tool
 * output, so the gate can verify it.
 */
export function affordabilityCheck(args: AffordabilityArgs): ToolResult {
  const income = incomeSummary({ userId: args.userId, months: 3 });
  const avgIncome = income.summary.avg_monthly_income_paise as number;

  // Average monthly discretionary + committed spend over last 3 months.
  const now = ANCHOR;
  const spend3 = sumSpend({ userId: args.userId, period: "last 3 months" });
  const avgSpend = Math.round((spend3.summary.total_paise as number) / 3);

  // Upcoming committed outflows this month: rent + subscriptions remaining.
  const recurring = listRecurring({ userId: args.userId });
  const committed = recurring.summary.monthly_total_paise as number;

  // This month's spend so far.
  const thisMonth = sumSpend({ userId: args.userId, period: "this month" });
  const spentThisMonth = thisMonth.summary.total_paise as number;

  // Simple cashflow buffer = income - typical spend, with a safety band.
  const typicalBuffer = Math.max(0, avgIncome - avgSpend);
  const safetyFloor = Math.round(avgIncome * 0.1); // keep 10% as cushion

  const availableLow = Math.max(0, typicalBuffer - safetyFloor);
  const availableHigh = Math.max(0, avgIncome - spentThisMonth - committed - safetyFloor);

  const low = Math.min(availableLow, availableHigh);
  const high = Math.max(availableLow, availableHigh);

  let verdict: "yes" | "tight" | "no";
  if (args.amountPaise <= low) verdict = "yes";
  else if (args.amountPaise <= high) verdict = "tight";
  else verdict = "no";

  return {
    tool: "affordability_check",
    args,
    rows: [...income.rows, ...recurring.rows],
    sources: [...income.sources],
    summary: {
      item: args.item ?? null,
      price_paise: args.amountPaise,
      avg_monthly_income_paise: avgIncome,
      avg_monthly_spend_paise: avgSpend,
      spent_this_month_paise: spentThisMonth,
      committed_recurring_paise: committed,
      safety_floor_paise: safetyFloor,
      affordable_low_paise: low,
      affordable_high_paise: high,
      verdict,
      assumptions: [
        `Average monthly income over last ${income.summary.samples} salary credits: ${fmt(avgIncome)}`,
        `Typical monthly spend (last 3 months average): ${fmt(avgSpend)}`,
        `Already spent this month: ${fmt(spentThisMonth)}`,
        `Keeping a safety cushion of ${fmt(safetyFloor)} (10% of income)`,
      ],
    },
  };
}

export interface GoalPlanArgs {
  userId: string;
  targetPaise: number;
  byDate?: string; // month name, YYYY-MM, or ISO date
  months?: number; // explicit horizon ("in 4 months"); wins over byDate
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Months from ANCHOR until the target date (min 1). */
function monthsUntil(byDate?: string): { months: number; label: string } {
  const now = ANCHOR;
  if (!byDate || byDate === "unspecified") return { months: 6, label: "~6 months (assumed)" };
  const monthIdx = MONTH_NAMES.findIndex((m) => byDate.toLowerCase().includes(m));
  let target: Date | null = null;
  if (monthIdx >= 0) {
    let year = now.getUTCFullYear();
    if (monthIdx <= now.getUTCMonth()) year += 1; // next occurrence
    target = new Date(Date.UTC(year, monthIdx, 1));
  } else {
    const parsed = new Date(byDate);
    if (!Number.isNaN(parsed.getTime())) target = parsed;
  }
  if (!target) return { months: 6, label: "~6 months (assumed)" };
  const months = Math.max(
    1,
    (target.getUTCFullYear() - now.getUTCFullYear()) * 12 + (target.getUTCMonth() - now.getUTCMonth())
  );
  return { months, label: `${months} month${months === 1 ? "" : "s"}` };
}

/** Goal planner: how much to save per month, and whether the plan is realistic. */
export function goalPlan(args: GoalPlanArgs): ToolResult {
  const income = incomeSummary({ userId: args.userId, months: 3 });
  const avgIncome = income.summary.avg_monthly_income_paise as number;
  const spend3 = sumSpend({ userId: args.userId, period: "last 3 months" });
  const avgSpend = Math.round((spend3.summary.total_paise as number) / 3);
  const monthlySurplus = Math.max(0, avgIncome - avgSpend);

  const { months, label } = args.months
    ? { months: args.months, label: `${args.months} month${args.months === 1 ? "" : "s"}` }
    : monthsUntil(args.byDate);
  const monthlyRequired = Math.ceil(args.targetPaise / months);
  const feasible = monthlyRequired <= monthlySurplus;
  const shortfall = Math.max(0, monthlyRequired - monthlySurplus);

  return {
    tool: "goal_plan",
    args,
    rows: income.rows,
    sources: income.sources,
    summary: {
      target_paise: args.targetPaise,
      months_remaining: months,
      timeframe_label: label,
      monthly_required_paise: monthlyRequired,
      monthly_surplus_paise: monthlySurplus,
      shortfall_paise: shortfall,
      avg_monthly_income_paise: avgIncome,
      avg_monthly_spend_paise: avgSpend,
      feasible,
    },
  };
}

// ---- Dispatcher (used by the agent + eval tool-call checker) --------------
export function runTool(name: ToolName, args: Record<string, any>): ToolResult {
  switch (name) {
    case "goal_plan":
      return goalPlan(args as GoalPlanArgs);
    case "sum_spend":
      return sumSpend(args as SumSpendArgs);
    case "filter_transactions":
      return filterTransactions(args as FilterArgs);
    case "compare_periods":
      return comparePeriods(args as ComparePeriodsArgs);
    case "detect_duplicates":
      return detectDuplicates(args as DetectDuplicatesArgs);
    case "list_recurring":
      return listRecurring(args as ListRecurringArgs);
    case "income_summary":
      return incomeSummary(args as IncomeSummaryArgs);
    case "affordability_check":
      return affordabilityCheck(args as AffordabilityArgs);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---- Money formatting (Indian grouping) -----------------------------------
export function fmt(paise: number): string {
  const rupees = Math.round(paise) / 100;
  const neg = rupees < 0;
  const abs = Math.abs(rupees);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  // Indian grouping: last 3 digits, then groups of 2
  let s = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    s = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  const dec = decPart === "00" ? "" : "." + decPart;
  return `${neg ? "-" : ""}₹${s}${dec}`;
}
