"use client";

import { useEffect, useState } from "react";

interface Metrics {
  totalQuestions: number;
  askers: number;
  helpfulRate: number;
  ratedCount: number;
  verifiedAccuracyRate: number;
  regulatedRedirects: number;
  wrongFigureReportsPer10k: number;
  cacheHitRate: number;
  escalationRate: number;
  avgCostPerQueryMicros: number;
  costPerAskerMicros: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  byIntent: { intent: string; count: number }[];
  providerMix: { provider: string; count: number }[];
  recent: any[];
}

export default function DashboardPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dashboard");
    setM(await res.json());
    setLoading(false);
  }
  // Load once on open and when the tab regains focus. No polling — the backend
  // is only hit when you ask for it, so an open tab costs nothing.
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!m) return <div className="text-mut">Loading…</div>;

  const usd = (micros: number) => "$" + (micros / 1e6).toFixed(6);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Metrics</h1>
          <p className="text-mut text-sm mt-1">
            Built from the same trace log the eval pipeline uses — one source of truth. Ask questions on the{" "}
            <a href="/" className="text-aster2 hover:underline">Ask</a> tab, then refresh.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-aster text-white text-sm font-medium hover:bg-aster2 transition"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {m.totalQuestions === 0 && (
        <div className="card p-5 text-mut text-sm">
          No traces yet. Go ask a few questions, rate some answers, then come back.
        </div>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-wide text-mut mb-2">North star &amp; adoption</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          <Kpi label="Questions" value={String(m.totalQuestions)} />
          <Kpi label="Askers" value={String(m.askers)} />
          <Kpi label="Helpful rate" value={pct(m.helpfulRate)} sub={`${m.ratedCount} rated`} tone="good" />
          <Kpi label="Verified accuracy" value={pct(m.verifiedAccuracyRate)} sub="gate-passed" tone="good" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-mut mb-2">Guardrails</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          <Kpi label="Cost / query" value={usd(m.avgCostPerQueryMicros)} tone="aster" />
          <Kpi label="Cost / asker" value={usd(m.costPerAskerMicros)} tone="aster" />
          <Kpi label="Cache hit rate" value={pct(m.cacheHitRate)} sub="saved spend" tone="good" />
          <Kpi label="Escalation to large" value={pct(m.escalationRate)} sub="target < 15%" />
        </div>
        <div className="grid sm:grid-cols-4 gap-4 mt-4">
          <Kpi label="p95 latency" value={`${m.p95LatencyMs}ms`} />
          <Kpi label="avg latency" value={`${m.avgLatencyMs}ms`} />
          <Kpi label="Advice redirects" value={String(m.regulatedRedirects)} tone="warn" />
          <Kpi
            label="Wrong-figure / 10k"
            value={m.wrongFigureReportsPer10k.toFixed(1)}
            tone={m.wrongFigureReportsPer10k > 0 ? "bad" : "good"}
          />
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-mut mb-3">Questions by intent</div>
          <BarList items={m.byIntent.map((x) => ({ label: x.intent.replace(/_/g, " "), value: x.count }))} />
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-mut mb-3">Composer provider mix</div>
          <BarList items={m.providerMix.map((x) => ({ label: x.provider, value: x.count }))} />
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs uppercase tracking-wide text-mut mb-3">Recent traces</div>
        <div className="space-y-1">
          {m.recent.map((t) => (
            <div key={t.id} className="flex items-center gap-3 text-xs border-t border-line py-2">
              <span className={`w-2 h-2 rounded-full ${t.gate.passed ? "bg-good" : "bg-bad"}`} />
              <span className="text-mut w-24 shrink-0">{t.router.intent}</span>
              <span className="text-slate-200 flex-1 truncate">{t.question}</span>
              <span className="text-mut">{t.composerProvider}</span>
              <span className="text-mut">{t.latencyMs}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function pct(x: number) {
  return (x * 100).toFixed(1) + "%";
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" | "aster" }) {
  const color =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "aster" ? "text-aster2" : "text-fg";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-mut">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-mut mt-0.5">{sub}</div>}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <div className="text-mut text-sm">No data yet.</div>;
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 text-mut truncate">{i.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-fg/10 overflow-hidden">
            <div className="h-full bg-aster" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-fg">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
