import { store } from "../data/store";
import { Trace } from "../data/types";

// ---------------------------------------------------------------------------
// Product metrics derived from the trace log (one source of truth with evals).
// Mirrors PRD section 10: adoption, quality, value, and the guardrails
// (safety, cost, speed, trust).
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  totalQuestions: number;
  askers: number;
  helpfulRate: number; // thumbs-up share of rated answers
  ratedCount: number;
  verifiedAccuracyRate: number; // gate-passed share
  regulatedRedirects: number;
  wrongFigureReportsPer10k: number;
  cacheHitRate: number;
  escalationRate: number; // share routed to large model
  avgCostPerQueryMicros: number;
  costPerAskerMicros: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  byIntent: { intent: string; count: number }[];
  providerMix: { provider: string; count: number }[];
  recent: Trace[];
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

export function dashboardMetrics(): DashboardMetrics {
  const traces = store().allTraces();
  const total = traces.length;
  const askers = new Set(traces.map((t) => t.userId)).size;

  const rated = traces.filter((t) => t.feedback);
  const up = rated.filter((t) => t.feedback?.vote === "up").length;
  const helpfulRate = rated.length ? up / rated.length : 0;

  const gatePassed = traces.filter((t) => t.gate.passed).length;
  const verifiedAccuracyRate = total ? gatePassed / total : 1;

  const regulatedRedirects = traces.filter((t) => t.router.risk === "regulated_advice").length;

  const wrongFigureReports = rated.filter(
    (t) => t.feedback?.vote === "down" && /wrong|figure|amount|galat|number/i.test(t.feedback?.reason ?? "")
  ).length;
  const wrongFigureReportsPer10k = total ? (wrongFigureReports / total) * 10000 : 0;

  const cacheHits = traces.filter((t) => t.composerProvider === "cache").length;
  const cacheHitRate = total ? cacheHits / total : 0;

  const escalations = traces.filter((t) => t.modelTier === "large").length;
  const escalationRate = total ? escalations / total : 0;

  const totalCost = traces.reduce((a, t) => a + t.costMicros, 0);
  const avgCostPerQueryMicros = total ? Math.round(totalCost / total) : 0;
  const costPerAskerMicros = askers ? Math.round(totalCost / askers) : 0;

  const latencies = traces.map((t) => t.latencyMs);
  const p95LatencyMs = p95(latencies);
  const avgLatencyMs = total ? Math.round(latencies.reduce((a, b) => a + b, 0) / total) : 0;

  const intents = new Map<string, number>();
  for (const t of traces) intents.set(t.router.intent, (intents.get(t.router.intent) ?? 0) + 1);
  const byIntent = [...intents.entries()].map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count);

  const providers = new Map<string, number>();
  for (const t of traces) providers.set(t.composerProvider, (providers.get(t.composerProvider) ?? 0) + 1);
  const providerMix = [...providers.entries()].map(([provider, count]) => ({ provider, count })).sort((a, b) => b.count - a.count);

  const recent = [...traces].slice(-25).reverse();

  return {
    totalQuestions: total,
    askers,
    helpfulRate,
    ratedCount: rated.length,
    verifiedAccuracyRate,
    regulatedRedirects,
    wrongFigureReportsPer10k,
    cacheHitRate,
    escalationRate,
    avgCostPerQueryMicros,
    costPerAskerMicros,
    p95LatencyMs,
    avgLatencyMs,
    byIntent,
    providerMix,
    recent,
  };
}
