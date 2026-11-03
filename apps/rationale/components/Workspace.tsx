"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupByRules } from "@/lib/cluster";
import { parseFeedback, toCsv } from "@/lib/csv";
import { checkPrd, mdToHtml, templatePrd, type PrdCheck } from "@/lib/prd";
import { SAMPLE_ITEMS, SAMPLE_THEMES } from "@/lib/sample";
import { arrOf, fid, ranked, score, slug } from "@/lib/score";
import { LIMITS, TIERS, type Item, type Theme, type Tier, type Workspace as WS } from "@/lib/types";

const COLORS = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"];
const KEY = "rationale-workspace-v1";
const empty: WS = { items: [], themes: [], source: "none" };

interface Health { ai: boolean; providers: { claude: boolean; gemini: boolean }; store: { kind: string; ok: boolean } }

function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function Workspace({ initial, sharedId }: { initial?: WS; sharedId?: string }) {
  const [ws, setWs] = useState<WS>(initial ?? empty);
  const [selected, setSelected] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"" | "group" | "prd" | "save">("");
  const [health, setHealth] = useState<Health | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [prdView, setPrdView] = useState<"preview" | "edit">("preview");
  const [checks, setChecks] = useState<PrdCheck[] | null>(null);
  const [provider, setProvider] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { items, themes } = ws;

  // restore the last local session (not on shared pages, which show the shared data)
  useEffect(() => {
    if (initial) return;
    try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); if (Array.isArray(p?.items) && Array.isArray(p?.themes)) setWs(p); } } catch { /* private mode */ }
  }, [initial]);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ws)); } catch { /* ignore */ } }, [ws]);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null)); }, []);

  const list = useMemo(() => ranked(themes, items), [themes, items]);
  const sel = useMemo(() => themes.find((t) => t.id === selected) ?? list[0], [themes, selected, list]);
  const max = Math.max(1, ...list.map((t) => score(t, items)));
  const assigned = useMemo(() => { const m = new Map<number, Theme>(); themes.forEach((t) => t.itemIds.forEach((id) => m.set(id, t))); return m; }, [themes]);
  const colorOf = (t?: Theme) => (t ? COLORS[themes.findIndex((x) => x.id === t.id) % COLORS.length] : "--line");
  const aiOn = !!health?.ai;

  const patchTheme = (id: string, p: Partial<Theme>) => setWs((w) => ({ ...w, themes: w.themes.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const patchItem = (id: number, p: Partial<Item>) => setWs((w) => ({ ...w, items: w.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const nextId = () => Math.max(0, ...items.map((i) => i.id)) + 1;

  function addParsed(raw: string) {
    const r = parseFeedback(raw);
    if (!r.items.length) { setStatus("I could not find any feedback in that. Try one item per line, or a CSV with customer, tier, arr and text columns."); return; }
    const room = LIMITS.maxItems - items.length;
    const take = r.items.slice(0, Math.max(0, room));
    let id = nextId();
    const added = take.map((x) => ({ ...x, id: id++ })) as Item[];
    setWs((w) => ({ ...w, items: [...w.items, ...added], source: w.source }));
    setStatus(`Added ${added.length} item${added.length === 1 ? "" : "s"}.${r.skipped ? ` Skipped ${r.skipped} that were too short.` : ""}${take.length < r.items.length ? ` The limit is ${LIMITS.maxItems} items, so ${r.items.length - take.length} were left out.` : ""} ${r.note}`);
    setPaste("");
  }

  async function onFile(f?: File) {
    if (!f) return;
    if (f.size > 200_000) { setStatus("That file is over 200 KB. Split it and add it in parts."); return; }
    addParsed(await f.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  function loadSample() {
    setWs({ items: SAMPLE_ITEMS, themes: SAMPLE_THEMES, source: "rules" });
    setSelected(null); setChecks(null); setProvider("");
    setStatus("Loaded 12 invented feedback items with a saved grouping. Edit anything, or regroup.");
  }

  function groupRules() {
    if (!items.length) return;
    setWs((w) => ({ ...w, themes: groupByRules(w.items), source: "rules" }));
    setSelected(null); setChecks(null);
    setStatus("Grouped by word overlap, with no AI. It catches repeated wording, not repeated needs. Adjust effort and confidence yourself.");
  }

  async function groupAi() {
    if (!items.length) return;
    setBusy("group"); setStatus("Asking the AI to group by the need underneath. This can take up to a minute.");
    try {
      const r = await fetch("/api/group", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      setWs((w) => ({ ...w, themes: j.themes, source: "ai" }));
      setProvider(j.provider); setSelected(null); setChecks(null);
      setStatus(`Grouped by AI (${j.provider === "claude" ? "Claude" : "Gemini, the free fallback"}). Every theme lists its evidence. Move any slider to re-rank.`);
    } catch (e) {
      setStatus(`${(e as Error).message} Falling back to grouping by rules.`);
      groupRules();
    } finally { setBusy(""); }
  }

  async function draftAi() {
    if (!sel) return;
    setBusy("prd"); setStatus("Drafting the PRD from this theme's evidence.");
    try {
      const r = await fetch("/api/prd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: { ...sel, prd: undefined }, items }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      patchTheme(sel.id, { prd: j.text }); setChecks(j.checks); setProvider(j.provider);
      setStatus(`Draft ready (${j.provider === "claude" ? "Claude" : "Gemini, the free fallback"}). Read the checks, then edit freely.`);
    } catch (e) {
      patchTheme(sel.id, { prd: templatePrd(sel, items) });
      setChecks(null);
      setStatus(`${(e as Error).message} Using the template draft instead.`);
    } finally { setBusy(""); }
  }

  async function save() {
    setBusy("save"); setStatus("Saving.");
    try {
      const r = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ws) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      const url = `${location.origin}/s/${j.id}`;
      setShareUrl(url); setStatus("Saved. Anyone with the link can open this ranking. Do not paste real customer data.");
    } catch (e) { setStatus((e as Error).message); } finally { setBusy(""); }
  }

  const prdText = sel ? sel.prd ?? templatePrd(sel, items) : "";
  const liveChecks = useMemo(() => (sel && sel.prd ? checkPrd(sel.prd, sel, items) : null), [sel, items]);
  const shownChecks = checks && sel?.prd ? liveChecks : liveChecks;

  const exportCsv = useCallback(() => {
    download("rationale-ranking.csv", toCsv([["rank", "theme", "requests", "arr_k", "confidence", "effort", "score", "evidence"], ...list.map((t, i) => [i + 1, t.title, t.itemIds.length, arrOf(t, items), t.confidence.toFixed(2), t.effort, score(t, items).toFixed(1), t.itemIds.map(fid).join(" ")])]), "text/csv");
  }, [list, items]);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <svg viewBox="0 0 48 48" width="40" height="40" role="img" aria-label="Rationale logo"><rect x="1" y="1" width="46" height="46" rx="12" fill="none" stroke="var(--line)" strokeWidth="1.5" /><path d="M10 15H38" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" /><path d="M10 24H30" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" /><path d="M10 33H22" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" opacity=".6" /></svg>
            <div>Rationale<small>Customer feedback in. A ranked roadmap out.</small></div>
          </div>
          <div className="badges" aria-live="polite">
            <span className="badge">Concept project</span>
            {health && (aiOn ? <span className="badge ok">AI on{health.providers.claude && health.providers.gemini ? ": Claude, Gemini fallback" : health.providers.claude ? ": Claude" : ": Gemini"}</span> : <span className="badge warn">AI off: rules only</span>)}
            {health && <span className={"badge " + (health.store.ok && health.store.kind === "vercel-blob" ? "ok" : "warn")}>{health.store.kind === "vercel-blob" && health.store.ok ? "Share links on" : "Share links limited"}</span>}
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>Show your work on every roadmap decision.</h1>
          <p>Paste feedback from calls, tickets and renewals. Rationale groups it by the need underneath, ranks the themes with one formula you can read aloud, and drafts the PRD from the evidence. Every judgement stays visible and editable.</p>
          {sharedId && <div className="banner info">You are viewing a shared ranking. Changes you make stay in your browser. <a href="/">Start your own</a>.</div>}
          <div className="banner" role="note">Use invented or anonymised feedback. Pasted text is sent to an AI model when you choose AI, and saved links are readable by anyone who has them. Emails, phone numbers and links are stripped before any model call.</div>
        </section>

        <div className="grid">
          <div>
            <section className="panel" aria-labelledby="in-h">
              <div className="phead"><h3 id="in-h">1. Add feedback</h3><span className="note">{items.length} of {LIMITS.maxItems} items</span></div>
              <label htmlFor="paste">Paste lines, or CSV with customer, tier, arr, text columns</label>
              <textarea id="paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Acme Logistics | Enterprise | $84k | Approvals stall when the approver is on leave.\nor just one piece of feedback per line"} />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => addParsed(paste)} disabled={!paste.trim()}>Add</button>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <button className="btn ghost" onClick={() => fileRef.current?.click()}>Upload CSV or text</button>
                <button className="btn ghost" onClick={loadSample}>Load sample</button>
                {items.length > 0 && <button className="btn danger sm" onClick={() => { if (confirm("Clear all feedback and themes?")) { setWs(empty); setSelected(null); setShareUrl(""); setChecks(null); } }}>Clear</button>}
              </div>
            </section>

            <section className="panel" aria-labelledby="inbox-h">
              <div className="phead"><h3 id="inbox-h">Feedback inbox</h3><span className="note">{items.length - assigned.size > 0 && themes.length ? `${items.length - assigned.size} not grouped` : ""}</span></div>
              {!items.length ? <div className="empty">Nothing here yet. Paste some feedback, or load the invented sample.</div> : (
                <div className="stack">
                  {items.map((f) => {
                    const t = assigned.get(f.id);
                    return (
                      <article key={f.id} className={"fb" + (t ? "" : " un")} style={{ ["--tc" as string]: `var(${colorOf(t)})` }}>
                        <div className="fbtop"><span className="id">{fid(f.id)}</span><span className="pill">{t ? t.title.slice(0, 34) : "not grouped"}</span></div>
                        <p>{f.text}</p>
                        <div className="edit">
                          <div><label htmlFor={`c${f.id}`}>Customer</label><input id={`c${f.id}`} type="text" value={f.customer} maxLength={60} onChange={(e) => patchItem(f.id, { customer: e.target.value })} /></div>
                          <div><label htmlFor={`t${f.id}`}>Tier</label><select id={`t${f.id}`} value={f.tier} onChange={(e) => patchItem(f.id, { tier: e.target.value as Tier })}>{TIERS.map((x) => <option key={x}>{x}</option>)}</select></div>
                          <div><label htmlFor={`a${f.id}`}>ARR $k</label><input id={`a${f.id}`} type="number" min={0} max={LIMITS.maxArr} value={f.arr} onChange={(e) => patchItem(f.id, { arr: Math.max(0, Math.min(LIMITS.maxArr, Number(e.target.value) || 0)) })} /></div>
                          <div><label htmlFor={`m${f.id}`}>Theme</label>
                            <select id={`m${f.id}`} value={t?.id ?? ""} onChange={(e) => setWs((w) => ({ ...w, themes: w.themes.map((x) => ({ ...x, itemIds: x.itemIds.filter((i) => i !== f.id).concat(x.id === e.target.value ? [f.id] : []) })).filter((x) => x.itemIds.length) }))}>
                              <option value="">Not grouped</option>
                              {themes.map((x) => <option key={x.id} value={x.id}>{x.title.slice(0, 40)}</option>)}
                            </select></div>
                          <button className="btn danger sm" aria-label={`Delete ${fid(f.id)}`} onClick={() => setWs((w) => ({ ...w, items: w.items.filter((i) => i.id !== f.id), themes: w.themes.map((x) => ({ ...x, itemIds: x.itemIds.filter((i) => i !== f.id) })).filter((x) => x.itemIds.length) }))}>×</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div>
            <section className="panel" aria-labelledby="th-h">
              <div className="phead">
                <h3 id="th-h">2. Themes, ranked</h3>
                <div className="row">
                  <button className="btn" onClick={groupAi} disabled={!items.length || busy !== "" || !aiOn} title={aiOn ? "" : "AI is not switched on for this deployment"}>{busy === "group" ? "Grouping…" : "Group with AI"}</button>
                  <button className="btn ghost" onClick={groupRules} disabled={!items.length || busy !== ""}>Group by rules</button>
                </div>
              </div>
              <p className="note" style={{ marginTop: -4 }}>score = ARR at stake × confidence ÷ effort. The AI proposes confidence and effort; the arithmetic is fixed, and you can overrule any input.</p>
              <div className="status" role="status" aria-live="polite">{status}</div>
              {!themes.length ? <div className="empty">Add feedback, then group it. Themes show up here, ranked.</div> : (
                <div className="stack">
                  {list.map((t, i) => {
                    const s = score(t, items), a = arrOf(t, items);
                    return (
                      <article key={t.id} className={"theme" + (sel?.id === t.id ? " sel" : "")} style={{ ["--tc" as string]: `var(${colorOf(t)})` }}>
                        <div className="thead">
                          <span className="rank" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                          <div style={{ flex: 1 }}>
                            <label className="sr" htmlFor={`ti${t.id}`} style={{ position: "absolute", left: -9999 }}>Theme title</label>
                            <input id={`ti${t.id}`} className="title" type="text" value={t.title} maxLength={90} onChange={(e) => patchTheme(t.id, { title: e.target.value })} style={{ width: "100%" }} />
                            <div className="tmeta"><span className={"pill sev-" + t.severity}>{t.severity}</span>{t.blocksRevenue && <span className="pill gate">Revenue gate</span>}</div>
                          </div>
                        </div>
                        <p className="tsum">{t.summary}</p>
                        <div className="nums"><div>Requests<b>{t.itemIds.length}</b></div><div>ARR at stake<b>${a}k</b></div><div>Score<b>{s.toFixed(1)}</b></div></div>
                        <div className="sl"><label htmlFor={`e${t.id}`}>Effort</label><input id={`e${t.id}`} type="range" min={1} max={5} step={1} value={t.effort} onChange={(e) => patchTheme(t.id, { effort: Number(e.target.value) })} /><output>{t.effort} of 5</output></div>
                        <div className="sl"><label htmlFor={`k${t.id}`}>Confidence</label><input id={`k${t.id}`} type="range" min={20} max={100} step={5} value={Math.round(t.confidence * 100)} onChange={(e) => patchTheme(t.id, { confidence: Number(e.target.value) / 100 })} /><output>{Math.round(t.confidence * 100)}%</output></div>
                        <p className="why">{t.effortWhy}</p>
                        <div className="formula">${a}k × {t.confidence.toFixed(2)} ÷ {t.effort} = {s.toFixed(1)}</div>
                        <div className="bar"><i style={{ width: `${Math.max(2, Math.round((s / max) * 100))}%` }} /></div>
                        <div className="scoreline"><span>Evidence: {t.itemIds.map(fid).join(", ")}</span><button className="btn ghost sm" onClick={() => { setSelected(t.id); setChecks(null); }}>{sel?.id === t.id ? "Showing PRD" : "Show PRD"}</button></div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="prd-h">
              <div className="phead">
                <h3 id="prd-h">3. PRD draft{sel ? `: ${sel.title.slice(0, 40)}` : ""}</h3>
                <div className="row">
                  <button className="btn" onClick={draftAi} disabled={!sel || busy !== "" || !aiOn} title={aiOn ? "" : "AI is not switched on for this deployment"}>{busy === "prd" ? "Drafting…" : "Draft with AI"}</button>
                  <button className="btn ghost" disabled={!sel} onClick={() => sel && download(slug(sel.title) + "-prd.md", prdText)}>Download .md</button>
                </div>
              </div>
              {!sel ? <div className="empty">Pick a theme to see its PRD.</div> : (
                <>
                  <div className="tabs"><button aria-pressed={prdView === "preview"} onClick={() => setPrdView("preview")}>Preview</button><button aria-pressed={prdView === "edit"} onClick={() => setPrdView("edit")}>Edit</button></div>
                  {prdView === "preview" ? <div className="prd" dangerouslySetInnerHTML={{ __html: mdToHtml(prdText) }} /> : <textarea style={{ minHeight: 280 }} aria-label="PRD markdown" value={prdText} onChange={(e) => patchTheme(sel.id, { prd: e.target.value })} />}
                  {shownChecks && <div className="checks" aria-label="Faithfulness checks">{shownChecks.map((c) => <span key={c.label} className={"check" + (c.ok ? "" : " fail")}>{c.ok ? "Passed" : "Check"}: {c.label}</span>)}</div>}
                  {provider && sel.prd && <p className="note">Drafted by {provider === "claude" ? "Claude" : "Gemini"}. Checks re-run as you edit.</p>}
                </>
              )}
            </section>

            <section className="panel" aria-labelledby="sh-h">
              <div className="phead"><h3 id="sh-h">4. Share or export</h3></div>
              <div className="row">
                <button className="btn" onClick={save} disabled={!themes.length || busy !== ""}>{busy === "save" ? "Saving…" : "Save and get a link"}</button>
                <button className="btn ghost" disabled={!themes.length} onClick={exportCsv}>Download ranking CSV</button>
              </div>
              {shareUrl && <div className="share" style={{ marginTop: 10 }}><input type="text" readOnly value={shareUrl} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} /><button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => setStatus("Link copied."))}>Copy</button></div>}
            </section>
          </div>
        </div>
      </main>
      <footer><div className="wrap">Rationale is a concept project by <a href="https://moulshree-portfolio.vercel.app">Moulshree Bhutra</a>. The customers in the sample are invented. <a href="https://github.com/moulshreebhutra/moulshree-portfolio/tree/main/apps/rationale">Source</a></div></footer>
    </>
  );
}
