"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { post } from "@/lib/client";
import { inr } from "@/lib/shop";

interface Data {
  config: { discountPct: number };
  counts: { real: number; sample: number };
  dial: { pct: number; revPerSession: number; marginPerSession: number; bundleMargin: number | null };
  stats: {
    n: number; funnel: [string, number][]; conv: number; aov: number; bundleShare: number; orders: number; revPerSession: number; marginPerSession: number; bundleMargin: number | null;
    withRoutine: { sessions: number; conv: number; aov: number; orders: number }; withoutRoutine: { sessions: number; conv: number; aov: number; orders: number };
    swaps: { id: string; name: string; share: number }[]; asks: { label: string; share: number; count: number; hint: string }[]; freeCount: number; byDay: { label: string; aov: number | null; orders: number }[];
  };
}
const p1 = (x: number) => (x * 100).toFixed(1) + "%";
const MARGIN_FLOOR = 0.4;

export default function Merchant() {
  const [d, setD] = useState<Data | null>(null);
  const [incl, setIncl] = useState(true);
  const [dial, setDial] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState<{ theme: string; count: number; suggestion: string }[] | null>(null);
  const [sumNote, setSumNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (sample: boolean, dialPct: number | null) => {
    const r = await fetch(`/api/merchant?sample=${sample ? 1 : 0}${dialPct !== null ? "&dial=" + dialPct : ""}`, { cache: "no-store" });
    if (r.ok) { const j = (await r.json()) as Data; setD(j); setDial((x) => x ?? j.config.discountPct); }
  }, []);
  useEffect(() => { load(incl, dial); /* eslint-disable-next-line */ }, [incl]);
  useEffect(() => { if (dial === null) return; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => load(incl, dial), 200); /* eslint-disable-next-line */ }, [dial]);

  async function seed() { setMsg("Adding sample sessions. This takes a few seconds."); const r = await post("/api/merchant/seed", {}); setMsg(r.ok ? (r.data.added ? `Added ${r.data.added} sample sessions, clearly labelled.` : "Sample sessions are already there.") : r.data.error || "Could not add samples."); load(incl, dial); }
  async function ship() { if (dial === null) return; const r = await post("/api/merchant/config", { discountPct: dial }); setMsg(r.ok ? `Shipped. Shoppers now see ${dial}% off a full routine.` : r.data.error || "Could not ship that."); load(incl, dial); }
  async function summarise() { setSumNote("Reading the answers."); const r = await post("/api/merchant/summary", {}); if (r.ok) { setSummary(r.data.points); setSumNote(`Summarised by ${r.data.provider === "claude" ? "Claude" : "Gemini"} from ${r.data.basedOn} answers.`); } else setSumNote(r.data.error || "Could not summarise."); }

  if (!d) return <main className="wrap"><section className="hero"><h1>Merchant view</h1><p>Loading.</p></section></main>;
  const s = d.stats, cur = d.config.discountPct, pct = dial ?? cur;
  const empty = s.n === 0;
  const revOk = d.dial.revPerSession >= s.revPerSession * 0.95 || s.revPerSession === 0;
  const marginOk = d.dial.bundleMargin === null || d.dial.bundleMargin >= MARGIN_FLOOR;
  const W = 640, H = 220, ml = 46, mr = 24, mt = 14, mb = 28;
  const pts = s.byDay.map((x, i) => ({ x: ml + (i * (W - ml - mr)) / 7, v: x.aov, l: x.label }));
  const vals = pts.map((p) => p.v).filter((v): v is number => v !== null);
  const lo = vals.length ? Math.floor(Math.min(...vals) / 100) * 100 - 100 : 0, hi = vals.length ? Math.ceil(Math.max(...vals) / 100) * 100 + 100 : 1000;
  const y = (v: number) => mt + ((hi - v) / (hi - lo || 1)) * (H - mt - mb);
  const line = pts.filter((p) => p.v !== null).map((p) => `${p.x.toFixed(1)},${y(p.v!).toFixed(1)}`).join(" ");

  return (
    <main className="wrap" style={{ marginBottom: 60 }}>
      <section className="hero">
        <h1>What shoppers did, and what to change.</h1>
        <p>Every number below is computed from the sessions and orders recorded by the shop on this site. Nothing is simulated, except where a label says "what-if".</p>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="badge ok">{d.counts.real} real session{d.counts.real === 1 ? "" : "s"}</span>
          <span className={"badge" + (d.counts.sample ? " warn" : "")}>{d.counts.sample} sample session{d.counts.sample === 1 ? "" : "s"}</span>
          <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}><input type="checkbox" checked={incl} onChange={(e) => setIncl(e.target.checked)} /> Include sample sessions</label>
          {d.counts.sample === 0 && <button className="btn ghost sm" onClick={seed}>Add sample sessions</button>}
        </div>
        {incl && d.counts.sample > 0 && <div className="sample" style={{ marginTop: 10 }}>Sample sessions are generated by this app to show how the dashboard looks with traffic. Untick the box to see only real shoppers.</div>}
        <div className="status" role="status" aria-live="polite">{msg}</div>
      </section>

      {empty ? <div className="empty">No sessions yet. <a href="/">Build a routine and place an order</a> to see it appear here, or add sample sessions above.</div> : (
        <>
          <div className="kpis">
            <div className="kpi"><span className="l">Sessions</span><b>{s.n}</b><i>{s.orders} orders</i></div>
            <div className="kpi"><span className="l">Conversion</span><b>{p1(s.conv)}</b><i>orders ÷ sessions</i></div>
            <div className="kpi"><span className="l">Average order value</span><b>{inr(s.aov)}</b><i>{p1(s.bundleShare)} of orders had a routine</i></div>
            <div className="kpi"><span className="l">Revenue per session</span><b>{inr(s.revPerSession)}</b><i>at {cur}% routine discount</i></div>
            <div className="kpi"><span className="l">Margin per session</span><b>{inr(s.marginPerSession)}</b><i>assumes 45% cost of goods</i></div>
          </div>

          <section className="gx panel" aria-labelledby="dial-h">
            <div className="phead"><h3 id="dial-h">You are the founder: set the routine discount</h3><span className="note">Live now: {cur}% off</span></div>
            <p className="note">What-if: re-prices every routine order in this data at the discount you pick, assuming the same shoppers buy the same baskets. It is arithmetic on real orders, not a forecast of how shoppers would react.</p>
            <div className="dial"><input type="range" min={0} max={30} step={1} value={pct} aria-label="Routine discount percent" onChange={(e) => setDial(Number(e.target.value))} /><output>{pct}%</output></div>
            <div className="tiles">
              <div className={"tile " + (revOk ? "ok" : "fail")}><span className="l">Revenue per session (stays within 5% of today)</span><b>{inr(d.dial.revPerSession)}</b></div>
              <div className="tile"><span className="l">Margin per session</span><b>{inr(d.dial.marginPerSession)}</b></div>
              <div className={"tile " + (marginOk ? "ok" : "fail")}><span className="l">Margin on a routine (stays above {Math.round(MARGIN_FLOOR * 100)}%)</span><b>{d.dial.bundleMargin === null ? "no routine orders" : p1(d.dial.bundleMargin)}</b></div>
            </div>
            <div className="row"><button className="btn" onClick={ship} disabled={pct === cur}>{pct === cur ? "Already live" : `Ship ${pct}% to the shop`}</button>{!marginOk && <span className="note">That discount breaks the margin guardrail. You can still ship it.</span>}</div>
          </section>

          <div className="two2">
            <section className="panel" aria-labelledby="f-h"><h3 id="f-h" style={{ marginBottom: 8 }}>Funnel</h3>
              <div className="fun">{s.funnel.map(([l, v]) => <div key={l}><span>{l}</span><span className="bar"><i style={{ width: `${s.n ? (v / s.n) * 100 : 0}%` }} /></span><b>{v}</b></div>)}</div></section>
            <section className="panel" aria-labelledby="a-h"><h3 id="a-h" style={{ marginBottom: 8 }}>Average order value, last 8 days</h3>
              {vals.length ? <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of average order value by day">
                {[lo, (lo + hi) / 2, hi].map((t) => <g key={t}><line className="gl" x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} /><text x={ml - 6} y={y(t) + 4} textAnchor="end">₹{Math.round(t)}</text></g>)}
                {pts.map((p) => <text key={p.l} x={p.x} y={H - 8} textAnchor="middle">{p.l}</text>)}
                <polyline className="ln" points={line} />{pts.filter((p) => p.v !== null).map((p) => <circle key={p.l} className="dt" cx={p.x} cy={y(p.v!)} r="4" />)}
              </svg> : <p className="note">No orders in the last 8 days.</p>}</section>
          </div>

          <section className="panel" aria-labelledby="c-h"><h3 id="c-h" style={{ marginBottom: 4 }}>Sessions with a routine vs without</h3>
            <p className="note">Observational, not an experiment: shoppers who build a routine may differ from those who browse.</p>
            <div className="tw"><table><thead><tr><th></th><th className="n">Sessions</th><th className="n">Orders</th><th className="n">Conversion</th><th className="n">Avg order value</th></tr></thead><tbody>
              <tr><td>Built a routine</td><td className="n">{s.withRoutine.sessions}</td><td className="n">{s.withRoutine.orders}</td><td className="n">{p1(s.withRoutine.conv)}</td><td className="n">{inr(s.withRoutine.aov)}</td></tr>
              <tr><td>Browsed only</td><td className="n">{s.withoutRoutine.sessions}</td><td className="n">{s.withoutRoutine.orders}</td><td className="n">{p1(s.withoutRoutine.conv)}</td><td className="n">{inr(s.withoutRoutine.aov)}</td></tr></tbody></table></div></section>

          <div className="two2">
            <section className="panel" aria-labelledby="s-h"><h3 id="s-h" style={{ marginBottom: 4 }}>What shoppers change</h3><p className="note">Share of routines where this product was swapped out.</p>
              {s.swaps.length ? <div className="tw"><table><thead><tr><th>Product</th><th className="n">Swapped</th></tr></thead><tbody>{s.swaps.map((x) => <tr key={x.id}><td>{x.name}</td><td className="n">{p1(x.share)}</td></tr>)}</tbody></table></div> : <p className="note">No swaps yet.</p>}</section>
            <section className="panel" aria-labelledby="k-h"><div className="phead"><h3 id="k-h">What shoppers typed</h3><button className="btn ghost sm" onClick={summarise}>Summarise with AI</button></div>
              <p className="note">{s.freeCount} free-text answer{s.freeCount === 1 ? "" : "s"}, sorted by simple keyword rules. {sumNote}</p>
              {s.asks.length ? <div className="tw"><table><thead><tr><th>Theme</th><th className="n">Share</th><th>What it suggests</th></tr></thead><tbody>{s.asks.map((x) => <tr key={x.label}><td>{x.label}</td><td className="n">{p1(x.share)}</td><td>{x.hint}</td></tr>)}</tbody></table></div> : <p className="note">Nobody has typed anything yet.</p>}
              {summary && <><h4 style={{ margin: "12px 0 4px" }}>AI summary</h4><ul>{summary.map((x) => <li key={x.theme}><b>{x.theme}</b> ({x.count}): {x.suggestion}</li>)}</ul></>}</section>
          </div>
        </>
      )}
    </main>
  );
}
