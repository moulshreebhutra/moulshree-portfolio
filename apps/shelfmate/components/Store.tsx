"use client";
import { useEffect, useMemo, useState } from "react";
import AnimatedNumber from "./AnimatedNumber";
import ProductArt from "./ProductArt";
import { toast } from "./Shell";
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
    setCartNote("added"); toast({ text: "Routine added to your cart", href: "/cart", label: "View cart" });
  }
  function addProduct(id: string) {
    const c = readCart(); if (!c.items.includes(id)) c.items.push(id); writeCart(c);
    post("/api/track", { event: "cart", sid, kind: "single" });
    toast({ text: `${BY_ID.get(id)?.name} added`, href: "/cart", label: "View cart" });
  }

  const risk = routine?.risk || RISK.test(a.free);
  const gentle = builtFor ? needsGentle(builtFor, !!routine?.risk) : false;
  const badge = !routine ? "Answer the questions, then build" : routine.source === "claude" ? "Built live by Claude" : routine.source === "gemini" ? "Built live by Gemini" : "Built by simple rules";

  return (
    <main className="wrap">
      <section className="hero rise">
        <h1>Tell us about your skin. Get one good routine.</h1>
        <p>Shelfmate builds a routine only from this store's shelves, checks it against your budget and skin, and lets you swap any step. What shoppers do feeds the <a href="/merchant">merchant view</a>.</p>
        <div className="banner" role="note">This is a concept store for an invented brand. Nothing is sold, and there is no payment. Please do not type personal details in the free-text box.</div>
      </section>

      <div className="two">
        <section className="panel" aria-labelledby="quiz-h">
          <h2 id="quiz-h" style={{ marginBottom: 14, fontSize: "1.2rem" }}>Your skin</h2>
          {GROUPS.map(([g, label]) => (
            <div className="q" key={g}><h3 id={"g-" + g}>{label}</h3>
              <div className="chips" role="group" aria-labelledby={"g-" + g}>
                {OPTIONS[g].map(([v, l]) => <button key={v} type="button" className="qchip" aria-pressed={a[g] === v} onClick={() => choose(g, v)}>{l}</button>)}
              </div></div>
          ))}
          <div className="q"><h3><label htmlFor="free" style={{ font: "inherit", color: "inherit", margin: 0 }}>Anything else we should know? (optional)</label></h3>
            <textarea id="free" maxLength={400} value={a.free} onChange={(e) => setA({ ...a, free: e.target.value })} placeholder="For example: fragrance-free please, or I break out in summer." /></div>
          <div className="row"><button className={"btn" + (busy ? " loading" : "")} onClick={build} disabled={!sid}>{busy ? "Building…" : "Build my routine"}</button></div>
          <div className="status pop" key={status} role="status" aria-live="polite" style={{ marginTop: 8 }}>{status}</div>
        </section>

        <section className="panel" aria-labelledby="res-h">
          <div className="phead"><h2 id="res-h">Your routine</h2><span className={"badge" + (routine && routine.source !== "rules" ? " ok" : "")}>{badge}</span></div>
          {busy ? <div className="stack" aria-hidden="true">{[0, 1, 2, 3].map((k) => <div key={k} className="skel" style={{ height: 78 }} />)}</div> : !routine ? <div className="empty"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 40h32M13 40V22h8v18M27 40V10h8v30"/></svg><b>Your routine appears here</b><span>Answer the questions, then build. It is made only from the shelf below.</span></div> : (
            <>
              {risk && <div className="warnbox">You mentioned something that is best checked with a professional. These are general suggestions with gentle products only. Please ask a dermatologist before starting anything new.</div>}
              <p style={{ margin: "0 0 6px" }}>{routine.summary}</p>
              <div>
                {routine.picks.map((pk: Pick, i: number) => {
                  const p = BY_ID.get(pk.id)!;
                  const alts = CATALOG.filter((x) => x.step === p.step && x.id !== p.id && (!gentle || x.gentle));
                  return (
                    <div className="step" key={p.id} style={{ ["--i" as string]: i }}>
                      <ProductArt step={p.step} />
                      <div><div className="lab">{p.step}</div><h3>{p.name}</h3><p>{pk.reason}</p><p>{p.how}</p></div>
                      <div className="price">{inr(p.price)}</div>
                      {alts.length > 0 && <div className="swap"><label htmlFor={"sw-" + p.step} style={{ margin: 0 }}>Swap for</label>
                        <select id={"sw-" + p.step} value="" onChange={(e) => swap(p.id, e.target.value)}><option value="">Choose…</option>{alts.map((x) => <option key={x.id} value={x.id}>{x.name} ({inr(x.price)})</option>)}</select></div>}
                    </div>
                  );
                })}
              </div>
              {pricing && <div className="total"><div className="save">{pricing.off > 0 ? `Routine price, ${pct}% off, you save ${inr(pricing.off)}` : "Routine price"}</div><div>{pricing.off > 0 && <s>{inr(pricing.raw)}</s>}<span className="big"><AnimatedNumber value={pricing.final} format={inr} /></span></div></div>}
              <div className="checks">{checks.map((c) => <span key={c.t} className={"check" + (c.ok ? "" : " fail")}>{c.ok ? "Passed" : "Failed"}: {c.t}</span>)}</div>
              <div className="row"><button className="btn" onClick={addRoutine}>Add routine to cart</button>{cartNote && <span className="note swap-in">Added. <a href="/cart">Go to cart</a></span>}</div>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="cat-h" style={{ marginBottom: 60 }}>
        <h2 id="cat-h" style={{ marginBottom: 14, fontSize: "1.4rem" }}>The whole shelf</h2>
        <div className="cat">
          {CATALOG.map((p) => (
            <article className="prod" key={p.id} style={{ ["--i" as string]: Math.min(CATALOG.indexOf(p), 12) }}><ProductArt step={p.step} /><div><span className="lab">{p.step}</span><h3>{p.name}</h3></div><p>{p.how} Good for {p.skin.join(", ")} skin.</p><div className="row" style={{ justifyContent: "space-between" }}><b>{inr(p.price)}</b><button className="btn ghost sm" onClick={() => addProduct(p.id)} aria-label={`Add ${p.name} to cart`}>Add to cart</button></div></article>
          ))}
        </div>
      </section>
    </main>
  );
}
