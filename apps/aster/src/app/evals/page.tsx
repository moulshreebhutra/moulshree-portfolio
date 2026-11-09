"use client";

import { useEffect, useState } from "react";

interface Layer {
  name: string;
  value: number;
  threshold: number;
  passed: boolean;
  detail: string;
}
interface Report {
  generatedAt: string;
  totalCases: number;
  byType: Record<string, number>;
  layers: Layer[];
  shipGatePassed: boolean;
  inventedCount: number;
  adviceLeakCount: number;
  projectedCostPerQueryMicros: number;
  judgeAgreement: number | null;
  failing: any[];
  sample: any[];
}

export default function EvalsPage() {
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  async function run() {
    setLoading(true);
    const res = await fetch("/api/evals");
    setR(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Eval report</h1>
          <p className="text-mut text-sm mt-1">
            The golden set runs offline (deterministic). Nothing ships unless every layer gate passes.
          </p>
        </div>
        <button
          onClick={run}
          className="px-4 py-2 rounded-xl bg-aster text-white text-sm font-medium hover:bg-aster2 transition"
        >
          {loading ? "Running…" : "Re-run evals"}
        </button>
      </div>

      {r && (
        <>
          <div
            className={`card p-5 flex items-center justify-between glow ${
              r.shipGatePassed ? "" : "!border-bad/50"
            }`}
          >
            <div>
              <div className="text-xs uppercase tracking-wide text-mut">Ship gate</div>
              <div className={`text-2xl font-semibold ${r.shipGatePassed ? "text-good" : "text-bad"}`}>
                {r.shipGatePassed ? "PASS — safe to ship" : "FAIL — blocked"}
              </div>
            </div>
            <div className="text-right text-sm text-mut">
              <div>{r.totalCases} cases</div>
              <div>rubric calibration: {r.judgeAgreement === null ? "not measured (heuristic)" : `${Math.round(r.judgeAgreement * 100)}%`}</div>
              <div>≈ ${(r.projectedCostPerQueryMicros / 1e6).toFixed(6)} / query</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {r.layers.map((l) => (
              <div key={l.name} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-fg">{l.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${l.passed ? "border-good/40 text-good bg-good/10" : "border-bad/40 text-bad bg-bad/10"}`}>
                    {l.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-fg/10 overflow-hidden">
                  <div
                    className={`h-full ${l.passed ? "bg-good" : "bg-bad"}`}
                    style={{ width: `${Math.min(100, Math.max(0, l.value * 100))}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-mut">
                  <span>{(l.value * 100).toFixed(1)}%</span>
                  <span>gate ≥ {(l.threshold * 100).toFixed(0)}%</span>
                </div>
                <p className="mt-2 text-xs text-mut">{l.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="Invented figures" value={String(r.inventedCount)} good={r.inventedCount === 0} />
            <Stat label="Advice leaks" value={String(r.adviceLeakCount)} good={r.adviceLeakCount === 0} />
            <Stat label="Cases by type" value={Object.values(r.byType).reduce((a, b) => a + b, 0) + ""} good />
          </div>

          <div className="card p-4">
            <div className="text-xs uppercase tracking-wide text-mut mb-3">Taxonomy coverage</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(r.byType).map(([k, v]) => (
                <span key={k} className="pill px-3 py-1 text-xs text-mut">
                  {k.replace(/_/g, " ")} <span className="text-fg ml-1">{v}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs uppercase tracking-wide text-mut mb-3">
              Failing cases {r.failing.length === 0 ? "— none 🎉" : `(${r.failing.length})`}
            </div>
            {r.failing.slice(0, 10).map((c) => (
              <div key={c.id} className="text-xs text-mut border-t border-line py-2">
                <span className="text-bad">{c.type}</span> · {c.question} · {c.violations?.join(",")}
              </div>
            ))}
            <div className="text-xs uppercase tracking-wide text-mut mt-5 mb-3">Sample answers</div>
            {r.sample.map((c) => (
              <div key={c.id} className="text-xs border-t border-line py-2">
                <div className="text-mut">{c.question}</div>
                <div className="text-slate-200 mt-0.5">{c.answer}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-mut">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${good ? "text-good" : "text-bad"}`}>{value}</div>
    </div>
  );
}
