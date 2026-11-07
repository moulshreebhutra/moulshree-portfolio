"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AnimatedNumber from "./AnimatedNumber";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { useFlip } from "@/lib/useFlip";
import { groupByRules } from "@/lib/cluster";
import { parseFeedback, toCsv } from "@/lib/csv";
import { checkPrd, mdToHtml, templatePrd } from "@/lib/prd";
import { SAMPLE_ITEMS, SAMPLE_THEMES } from "@/lib/sample";
import { arrOf, ranked, score, slug } from "@/lib/score";
import { LIMITS, type Item, type Theme, type Workspace as WS } from "@/lib/types";

type Stage = "add" | "rank" | "spec";
const empty: WS = { items: [], themes: [], source: "none" };
const LEVELS = [{ k: "Low", v: 1 }, { k: "Medium", v: 3 }, { k: "High", v: 5 }];
const CONF = [{ k: "Low", v: 0.4 }, { k: "Medium", v: 0.7 }, { k: "High", v: 0.95 }];
const confOf = (c: number) => (c < 0.55 ? 0 : c < 0.85 ? 1 : 2);
const levelOf = (e: number) => (e <= 2 ? 0 : e === 3 ? 1 : 2);
const who = (p: string) => (p === "claude" ? "Claude" : p === "gemini" ? "Gemini" : "simple rules");

interface Health { ai: boolean; providers: { claude: boolean; gemini: boolean } }

function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function Workspace({ initial, sharedId }: { initial?: WS; sharedId?: string }) {
  const [ws, setWs] = useState<WS>(initial ?? empty);
  const [stage, setStage] = useState<Stage>(initial && initial.themes.length ? "rank" : "add");
  const [selected, setSelected] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "rank" | "spec" | "share">("");
  const [health, setHealth] = useState<Health | null>(null);
  const [provider, setProvider] = useState("");
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [edge, setEdge] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { items, themes } = ws;

  useEffect(() => { const f = () => setEdge(window.scrollY > 4); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [stage]);

  const aiOn = !!health?.ai;
  const list = useMemo(() => ranked(themes, items), [themes, items]);
  const flipRef = useFlip<HTMLDivElement>(list.map((t) => t.id).join(","));
  const max = Math.max(1, ...list.map((t) => score(t, items)));
  const sel = useMemo(() => themes.find((t) => t.id === selected), [themes, selected]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const patchTheme = (id: string, p: Partial<Theme>) => setWs((w) => ({ ...w, themes: w.themes.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const startOver = () => { setWs(empty); setStage("add"); setSelected(null); setPaste(""); setError(""); setProvider(""); };

  function loadSample() {
    setWs({ items: SAMPLE_ITEMS, themes: SAMPLE_THEMES, source: "rules" });
    setSelected(null); setProvider(""); setError(""); setStage("rank");
  }

  function regroupRules() {
    setWs((w) => ({ ...w, themes: groupByRules(w.items), source: "rules" }));
    setProvider(""); setToast("Regrouped with the simple rules.");
  }
  function exportCsv() {
    const rows: (string | number)[][] = [["rank", "theme", "customers", "arr_k", "confidence", "effort", "priority"]];
    list.forEach((t, i) => rows.push([i + 1, t.title, t.itemIds.length, arrOf(t, items), t.confidence, t.effort, Math.round(score(t, items))]));
    download("rationale-ranking.csv", toCsv(rows), "text/csv");
  }

  async function rank(raw: string, again = false) {
    setError("");
    const r = again ? { items: items.map(({ id: _id, ...x }) => x), skipped: 0, note: "" } : parseFeedback(raw);
    if (!r.items.length) { setError("I couldn't find any feedback in that. Put one comment per line, or upload a CSV with customer, tier, arr and text columns."); return; }
    const take = r.items.slice(0, LIMITS.maxItems);
    const parsed = take.map((x, i) => ({ ...x, id: i + 1 })) as Item[];
    setBusy("rank");
    let themesOut: Theme[] = [], src: WS["source"] = "rules", prov = "";
    if (aiOn) {
      try {
        const res = await fetch("/api/group", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: parsed }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "failed");
        themesOut = j.themes; src = "ai"; prov = j.provider;
      } catch { /* fall back to the simple rules below */ }
    }
    if (!themesOut.length) themesOut = groupByRules(parsed);
    setWs({ items: parsed, themes: themesOut, source: src });
    setProvider(prov); setSelected(null); setPaste(""); setBusy(""); setStage("rank");
    if (take.length < r.items.length) setToast(`Used the first ${LIMITS.maxItems} comments.`);
  }

  async function onFile(f?: File) {
    if (!f) return;
    if (f.size > 200_000) { setError("That file is over 200 KB. Try a smaller one."); return; }
    const text = await f.text();
    setPaste(text);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openSpec(t: Theme) {
    setSelected(t.id); setEditing(false); setStage("spec"); setError("");
    if (t.prd) return;
    if (!aiOn) { patchTheme(t.id, { prd: templatePrd(t, items) }); return; }
    setBusy("spec");
    try {
      const res = await fetch("/api/prd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: { ...t, prd: undefined }, items }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      patchTheme(t.id, { prd: j.text }); setProvider(j.provider);
    } catch {
      patchTheme(t.id, { prd: templatePrd(t, items) });
      setToast("The AI was busy, so this spec uses the simple template.");
    } finally { setBusy(""); }
  }

  async function share() {
    setBusy("share");
    try {
      const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ws) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      const url = `${location.origin}/s/${j.id}`;
      try { await navigator.clipboard.writeText(url); setToast("Link copied. Anyone with it can view this ranking."); }
      catch { setToast(url); }
    } catch (e) { setToast((e as Error).message || "Couldn't create a link."); }
    finally { setBusy(""); }
  }

  const specText = sel?.prd ?? "";
  const checks = useMemo(() => (sel?.prd ? checkPrd(sel.prd, sel, items) : null), [sel, items]);
  const failed = checks ? checks.filter((c) => !c.ok) : [];
  const step = stage === "add" ? 0 : stage === "rank" ? 1 : 2;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className={"top" + (edge ? " edge" : "")}>
        <div className="wrap narrow">
          <a className="brand" href="/" onClick={(e) => { if (stage !== "add") { e.preventDefault(); setStage("add"); } }}><Logo /><span>Rationale</span></a>
          <div className="right">
            {health && <span className={"badge " + (aiOn ? "ok" : "warn")}>{aiOn ? "AI on" : "Simple rules"}</span>}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="wrap narrow" id="main">
        <ol className="steps" aria-label="Progress">
          {["Add feedback", "See what matters", "Get the spec"].map((l, i) => (
            <li key={l} className={i === step ? "now" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}><i>{i < step ? "✓" : i + 1}</i><span>{l}</span></li>
          ))}
        </ol>
        {sharedId && <div className="banner info">You're viewing a shared ranking. <a href="/">Start your own</a>.</div>}

        {stage === "add" && (
          <section className="stage rise" aria-labelledby="h-add">
            <h1 id="h-add">Turn customer feedback into what to build next.</h1>
            <p className="lede">Paste what customers are saying. Rationale groups it by the need underneath, ranks what matters most, and writes the spec for the winner.</p>
            <label className="sr" htmlFor="paste">Customer feedback, one comment per line</label>
            <textarea id="paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Acme Logistics | Enterprise | $84k | Approvals stall when the approver is on leave.\nOr just one comment per line."} />
            {error && <p className="err" role="alert">{error}</p>}
            <div className="row cta">
              <button className={"btn big" + (busy === "rank" ? " loading" : "")} disabled={!paste.trim() || busy === "rank"} onClick={() => rank(paste)}>{busy === "rank" ? "Finding the themes…" : "Rank my feedback"}</button>
              <button className="btn ghost big" onClick={loadSample} disabled={busy === "rank"}>Try sample feedback</button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="note">Have a spreadsheet? <button className="link" onClick={() => fileRef.current?.click()}>Upload a CSV</button>. Use invented or anonymised feedback; emails, phone numbers and links are removed before any AI sees it.</p>
          </section>
        )}

        {stage === "rank" && (
          <section className="stage rise" aria-labelledby="h-rank">
            <div className="shead">
              <div>
                <h1 id="h-rank">What to build first</h1>
                <p className="lede">{list.length} themes from {items.length} comments{provider ? `, grouped by ${who(provider)}` : ""}. The top one has the most revenue riding on it for the least effort.</p>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={exportCsv}>Export CSV</button>
                <button className={"btn ghost" + (busy === "share" ? " loading" : "")} onClick={share} disabled={busy === "share"}>Share</button>
                <button className="btn ghost" onClick={startOver}>Start over</button>
              </div>
            </div>
            <dl className="strip">
              <div><dt>Comments</dt><dd>{items.length}</dd></div>
              <div><dt>Themes</dt><dd>{list.length}</dd></div>
              <div><dt>Revenue in play</dt><dd>${items.reduce((n, i) => n + i.arr, 0)}k</dd></div>
              <div><dt>Blocking a deal</dt><dd>{list.filter((t) => t.blocksRevenue).length}</dd></div>
            </dl>
            <div className="regroup row">
              <span className="note">Not the grouping you expected?</span>
              {aiOn && <button className={"btn ghost sm" + (busy === "rank" ? " loading" : "")} disabled={busy === "rank"} onClick={() => rank("", true)}>Regroup with AI</button>}
              <button className="btn ghost sm" onClick={regroupRules}>Regroup by rules</button>
            </div>
            <div className="stack" ref={flipRef}>
              {list.map((t, i) => {
                const s = score(t, items), a = arrOf(t, items), pct = Math.max(3, Math.round((s / max) * 100));
                return (
                  <article key={t.id} data-flip={t.id} className={"card" + (i === 0 ? " top1" : "")} style={{ ["--i" as string]: i }}>
                    <div className="chead">
                      <span className="rank" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                      <div>
                        <h2>{t.title}</h2>
                        <p className="why">{t.summary}</p>
                      </div>
                    </div>
                    <div className="facts">
                      <span><b>{t.itemIds.length}</b> {t.itemIds.length === 1 ? "customer" : "customers"}</span>
                      <span><b><AnimatedNumber value={a} format={(n) => "$" + Math.round(n) + "k"} /></b> at stake</span>
                      <span className={"sev " + t.severity}>{t.severity}</span>
                      {t.blocksRevenue && <span className="gate">Blocks a renewal or deal</span>}
                    </div>
                    <div className="pbar" role="img" aria-label={`Priority ${Math.round((s / max) * 100)} out of 100`}><i style={{ width: pct + "%" }} /></div>
                    <div className="crow">
                      <div className="seg" role="group" aria-label={`Effort for ${t.title}`}>
                        <span className="seglab">Effort</span>
                        {LEVELS.map((l, k) => <button key={l.k} aria-pressed={levelOf(t.effort) === k} onClick={() => patchTheme(t.id, { effort: l.v })}>{l.k}</button>)}
                      </div>
                      <div className="seg" role="group" aria-label={`Confidence for ${t.title}`}>
                        <span className="seglab">Sure it's real</span>
                        {CONF.map((l, k) => <button key={l.k} aria-pressed={confOf(t.confidence) === k} onClick={() => patchTheme(t.id, { confidence: l.v })}>{l.k}</button>)}
                      </div>
                      <button className={"btn" + (i === 0 ? "" : " ghost")} onClick={() => openSpec(t)}>Write the spec</button>
                    </div>
                    <p className="formula">Priority {Math.round(s)} = ${a}k × {t.confidence} ÷ {t.effort}</p>
                    <details className="more">
                      <summary>What customers said</summary>
                      <ul>{t.itemIds.map((id) => byId.get(id)).filter(Boolean).map((f) => <li key={f!.id}><q>{f!.text}</q><span>{f!.customer}, {f!.tier}, ${f!.arr}k</span></li>)}</ul>
                      <label className="rename">Theme name <input value={t.title} maxLength={80} onChange={(e) => patchTheme(t.id, { title: e.target.value })} /></label>
                      <p className="note">Effort estimate: {t.effortWhy || "Set by you."}</p>
                    </details>
                  </article>
                );
              })}
            </div>
            <details className="how">
              <summary>How the ranking works</summary>
              <p>Priority = revenue at stake × how sure we are the need is real ÷ effort. Change effort or confidence and the order updates. {aiOn ? "The AI proposes the effort and confidence; the arithmetic never changes." : "Without AI, themes are grouped by repeated wording."}</p>
            </details>
          </section>
        )}

        {stage === "spec" && sel && (
          <section className="stage rise" aria-labelledby="h-spec">
            <div className="shead">
              <div>
                <button className="link back" onClick={() => setStage("rank")}>← Back to the ranking</button>
                <h1 id="h-spec">Spec: {sel.title}</h1>
              </div>
              {busy !== "spec" && specText && (
                <div className="row">
                  <button className="btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(specText); setToast("Spec copied."); } catch { setToast("Couldn't copy. Use Download instead."); } }}>Copy</button>
                  <button className="btn ghost" onClick={() => download(slug(sel.title) + "-spec.md", specText)}>Download</button>
                  <button className={"btn" + (busy === "share" ? " loading" : "")} onClick={share} disabled={busy === "share"}>Share</button>
                </div>
              )}
            </div>
            {busy === "spec" ? (
              <div className="doc" aria-busy="true" aria-live="polite"><p className="note">Writing the spec from the evidence…</p><div className="skel" style={{ height: 28, width: "60%" }} /><div className="skel" style={{ height: 14, marginTop: 14 }} /><div className="skel" style={{ height: 14, width: "92%", marginTop: 8 }} /><div className="skel" style={{ height: 14, width: "78%", marginTop: 8 }} /><div className="skel" style={{ height: 120, marginTop: 18 }} /></div>
            ) : (
              <>
                <div className="doc">
                  <div className="tabs" role="group" aria-label="Spec view">
                    <button aria-pressed={!editing} onClick={() => setEditing(false)}>Preview</button>
                    <button aria-pressed={editing} onClick={() => setEditing(true)}>Edit</button>
                    <button className="link" onClick={() => { patchTheme(sel.id, { prd: templatePrd(sel, items) }); setToast("Reset to the template."); }}>Use the template</button>
                  </div>
                  {editing ? <textarea aria-label="Edit the spec" value={specText} onChange={(e) => patchTheme(sel.id, { prd: e.target.value })} style={{ minHeight: 420 }} /> : <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(specText) }} />}
                </div>
                <div className="trust">
                  {checks && (
                    <details open={failed.length > 0}>
                      <summary className={failed.length ? "warnt" : "okt"}>{failed.length === 0 ? "✓ All " + checks.length + " checks passed" : failed.length + " of " + checks.length + " checks need a look"}</summary>
                      <ul className="checks">{checks.map((c) => <li key={c.label} className={c.ok ? "pass" : "fail"}>{c.ok ? "✓" : "!"} {c.label}</li>)}</ul>
                    </details>
                  )}
                  <span className="note">{provider && provider !== "none" ? `Written by ${who(provider)}.` : ""}</span>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <footer><div className="wrap narrow">Rationale is a concept project by <a href="https://moulshree-portfolio.vercel.app">Moulshree Bhutra</a>. The customers in the sample are invented. <a href="https://github.com/moulshreebhutra/moulshree-portfolio/tree/main/apps/rationale">Code</a></div></footer>
      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
