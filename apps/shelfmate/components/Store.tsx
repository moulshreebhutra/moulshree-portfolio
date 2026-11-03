"use client";
import { useEffect, useMemo, useState } from "react";
import { CATALOG } from "@/lib/catalog";
import { getSid, post, readCart, writeCart } from "@/lib/client";
import { BY_ID, OPTIONS, RISK, inr, labelOf, needsGentle, stepsFor, type Answers, type Check, type Pick, type Routine } from "@/lib/shop";

const GROUPS = [["skin", "Skin type"], ["concern", "Main concern"], ["size", "Routine size"], ["budget", "Budget"]] as const;
interface Pricing { raw: number; off: number; final: number }

export default function Store() {
  const [a, setA] = useState<Answers>({ skin: "oily", concern: "breakouts", size: "4", budget: "2500", free: "" });
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [pct, setPct] = useState(10);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [cartNote, setCartNote] = useState("");
  const [sid, setSid] = useState("");
  const [builtFor, setBuiltFor] = useState<Answers | null>(null);

  useEffect(() => { setSid(getSid()); fetch("/api/config").then((r) => r.json()).then((j) => setPct(j.discountPct)).catch(() => {}); }, []);
  const started = useMemo(() => ({ done: false }), []);
  function choose(g: keyof Answers, v: string) {
    setA((x) => ({ ...x, [g]: v }));
    if (!started.done && sid) { started.done = true; post("/api/track", { event: "start", sid }); }
  }

  async function build() {
    setBusy(true); setStatus("Building your routine. This can take a few seconds.");
    try {
      const { ok, data } = await post("/api/routine", { sid, answers: a });
      if (!ok) throw new Error(data.error || "Something went wrong.");
      setRoutine(data.routine); setChecks(data.checks); setPricing(data.pricing); setPct(data.discountPct); setBuiltFor(a); setCartNote("");
      setStatus(data.note || (data.routine.source === "rules" ? "Built by simple rules." : "Done."));
    } catch (e) { setStatus((e as Error).message); } finally { setBusy(false); }
  }

  async function swap(from: string, to: string) {
    if (!to || to === from) return;
    const { ok, data } = await post("/api/track", { event: "swap", sid, from, to });
    if (!ok) { setStatus(data.error || "That swap did not work."); return; }
    setRoutine((r) => (r ? { ...r, picks: data.picks } : r)); setChecks(data.checks); setPricing(data.pricing); setCartNote("");
    setStatus(`Swapped to ${BY_ID.get(to)?.name}.`);
  }

  function addRoutine() {
    if (!routine) return;
    const c = readCart(); c.bundle = routine.picks.map((p) => p.id); writeCart(c);
    post("/api/track", { event: "cart", sid, kind: "bundle" });
    setCartNote(`Routine added to your cart. `);
  }
  function addProduct(id: string) {
    const c = readCart(); if (!c.items.includes(id)) c.items.push(id); writeCart(c);
    post("/api/track", { event: "cart", sid, kind: "single" });
    setStatus(`${BY_ID.get(id)?.name} added to your cart.`);
  }

  const risk = routine?.risk || RISK.test(a.free);
  const gentle = builtFor ? needsGentle(builtFor, !!routine?.risk) : false;
  const badge = !routine ? "Answer the questions, then build" : routine.source === "claude" ? "Built live by Claude" : routine.source === "gemini" ? "Built live by Gemini" : "Built by simple rules";

  return (
    <main className="wrap">
      <section className="hero">
        <h1>Tell us about your skin. Get one good routine.</h1>
        <p>Shelfmate builds a routine only from this store's shelves, checks it against your budget and skin, and lets you swap any step. What shoppers do feeds the <a href="/merchant">merchant view</a>.</p>
        <div className="banner" role="note">This is a concept store for an invented brand. Nothing is sold, and there is no payment. Please do not type personal details in the free-text box.</div>
      </section>

      <div className="two">
        <section className="panel" aria-labelledby="quiz-h">
          <h3 id="quiz-h" style={{ marginBottom: 12 }}>Your skin</h3>
          {GROUPS.map(([g, label]) => (
            <div className="q" key={g}><h4 id={"g-" + g}>{label}</h4>
              <div className="chips" role="group" aria-labelledby={"g-" + g}>
                {OPTIONS[g].map(([v, l]) => <button key={v} type="button" className="qchip" aria-pressed={a[g] === v} onClick={() => choose(g, v)}>{l}</button>)}
              </div></div>
          ))}
          <div className="q"><h4><label htmlFor="free">Anything else we should know? (optional)</label></h4>
            <textarea id="free" maxLength={400} value={a.free} onChange={(e) => setA({ ...a, free: e.target.value })} placeholder="For example: fragrance-free please, or I break out in summer." /></div>
          <div className="row"><button className="btn" onClick={build} disabled={busy || !sid}>{busy ? "Building…" : "Build my routine"}</button></div>
          <div className="status" role="status" aria-live="polite" style={{ marginTop: 8 }}>{status}</div>
        </section>

        <section className="panel" aria-labelledby="res-h">
          <div className="phead"><h3 id="res-h">Your routine</h3><span className={"badge" + (routine && routine.source !== "rules" ? " ok" : "")}>{badge}</span></div>
          {!routine ? <div className="empty">Your routine appears here, built from the catalog below.</div> : (
            <>
              {risk && <div className="warnbox">You mentioned something that is best checked with a professional. These are general suggestions with gentle products only. Please ask a dermatologist before starting anything new.</div>}
              <p style={{ margin: "0 0 6px" }}>{routine.summary}</p>
              <div>
                {routine.picks.map((pk: Pick) => {
                  const p = BY_ID.get(pk.id)!;
                  const alts = CATALOG.filter((x) => x.step === p.step && x.id !== p.id && (!gentle || x.gentle));
                  return (
                    <div className="step" key={p.step}>
                      <div className="lab">{p.step}</div>
                      <div><h4>{p.name}</h4><p>{pk.reason}</p><p>{p.how}</p></div>
                      <div className="price">{inr(p.price)}</div>
                      {alts.length > 0 && <div className="swap"><label htmlFor={"sw-" + p.step} style={{ margin: 0 }}>Swap for</label>
                        <select id={"sw-" + p.step} value="" onChange={(e) => swap(p.id, e.target.value)}><option value="">Choose…</option>{alts.map((x) => <option key={x.id} value={x.id}>{x.name} ({inr(x.price)})</option>)}</select></div>}
                    </div>
                  );
                })}
              </div>
              {pricing && <div className="total"><div className="save">{pricing.off > 0 ? `Routine price, ${pct}% off, you save ${inr(pricing.off)}` : "Routine price"}</div><div>{pricing.off > 0 && <s>{inr(pricing.raw)}</s>}<span className="big">{inr(pricing.final)}</span></div></div>}
              <div className="checks">{checks.map((c) => <span key={c.t} className={"check" + (c.ok ? "" : " fail")}>{c.ok ? "Passed" : "Failed"}: {c.t}</span>)}</div>
              <div className="row"><button className="btn" onClick={addRoutine}>Add routine to cart</button>{cartNote && <span className="note">{cartNote}<a href="/cart">Go to cart</a></span>}</div>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="cat-h" style={{ marginBottom: 60 }}>
        <h3 id="cat-h" style={{ marginBottom: 10 }}>The whole shelf</h3>
        <div className="cat">
          {CATALOG.map((p) => (
            <article className="prod" key={p.id}><span className="lab">{p.step}</span><h4>{p.name}</h4><p>{p.how} Good for {p.skin.join(", ")} skin.</p><div className="row" style={{ justifyContent: "space-between" }}><b>{inr(p.price)}</b><button className="btn ghost sm" onClick={() => addProduct(p.id)}>Add to cart</button></div></article>
          ))}
        </div>
      </section>
    </main>
  );
}
