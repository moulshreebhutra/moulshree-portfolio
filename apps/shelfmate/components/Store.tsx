"use client";
import { useEffect, useState } from "react";
import AnimatedNumber from "./AnimatedNumber";
import ProductArt from "./ProductArt";
import { toast } from "./Shell";
import { CATALOG } from "@/lib/catalog";
import { getSid, post, readCart, writeCart } from "@/lib/client";
import { BY_ID, OPTIONS, RISK, inr, needsGentle, type Answers, type Check, type Pick, type Routine } from "@/lib/shop";

const QUESTIONS = [["skin", "What's your skin like?"], ["concern", "What bothers you most?"], ["budget", "What's your budget?"]] as const;
interface Pricing { raw: number; off: number; final: number }

export default function Store() {
  const [a, setA] = useState({ skin: "oily", concern: "breakouts", budget: "2500", free: "" });
  const [note, setNote] = useState(false);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [pct, setPct] = useState(10);
  const [builtFor, setBuiltFor] = useState<Answers | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [sid, setSid] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => { setSid(getSid()); fetch("/api/config").then((r) => r.json()).then((j) => setPct(j.discountPct)).catch(() => {}); }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [routine === null]);

  function choose(g: "skin" | "concern" | "budget", v: string) {
    setA((x) => ({ ...x, [g]: v }));
    if (!started && sid) { setStarted(true); post("/api/track", { event: "start", sid }); }
  }

  async function build() {
    setBusy(true); setError(""); setInfo("");
    const answers: Answers = { ...a, size: a.budget === "1500" ? "3" : "4" };
    try {
      const { ok, data } = await post("/api/routine", { sid, answers });
      if (!ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setRoutine(data.routine); setChecks(data.checks); setPricing(data.pricing); setPct(data.discountPct); setBuiltFor(answers); setAdded(false); setOpen(null); setInfo(data.note || "");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function swap(from: string, to: string) {
    const { ok, data } = await post("/api/track", { event: "swap", sid, from, to });
    if (!ok) { setError(data.error || "That swap didn't work."); return; }
    setRoutine((r) => (r ? { ...r, picks: data.picks } : r)); setChecks(data.checks); setPricing(data.pricing); setAdded(false); setOpen(null); setError("");
  }

  function addRoutine() {
    if (!routine) return;
    const c = readCart(); c.bundle = routine.picks.map((p) => p.id); writeCart(c);
    post("/api/track", { event: "cart", sid, kind: "bundle" });
    setAdded(true); toast({ text: "Routine added to your cart", href: "/cart", label: "View cart" });
  }
  function addProduct(id: string) {
    const c = readCart(); if (!c.items.includes(id)) c.items.push(id); writeCart(c);
    post("/api/track", { event: "cart", sid, kind: "single" });
    toast({ text: `${BY_ID.get(id)?.name} added`, href: "/cart", label: "View cart" });
  }

  const risk = !!routine && (routine.risk || RISK.test(a.free));
  const gentle = builtFor ? needsGentle(builtFor, !!routine?.risk) : false;
  const who = routine?.source === "claude" ? "Claude" : routine?.source === "gemini" ? "Gemini" : "simple rules";
  const bad = checks.filter((c) => !c.ok);

  return (
    <main className="wrap narrow">
      {!routine ? (
        <section className="stage rise" aria-labelledby="h-quiz">
          <h1 id="h-quiz">Your skincare routine, built in a minute.</h1>
          <p className="lede">Answer three questions. We'll build a routine from our shelf, and you can swap anything in it.</p>
          {QUESTIONS.map(([g, label], i) => (
            <div className="q" key={g} style={{ ["--i" as string]: i }}>
              <h2 id={"g-" + g}><span>{i + 1}</span>{label}</h2>
              <div className="chips" role="group" aria-labelledby={"g-" + g}>
                {OPTIONS[g].map(([v, l]) => <button key={v} type="button" className="qchip" aria-pressed={a[g] === v} onClick={() => choose(g, v)}>{l}</button>)}
              </div>
            </div>
          ))}
          {note
            ? <div className="q"><label htmlFor="free">Anything else we should know?</label><textarea id="free" maxLength={400} value={a.free} onChange={(e) => setA({ ...a, free: e.target.value })} placeholder="For example: fragrance-free please." /></div>
            : <p className="note"><button className="link" onClick={() => setNote(true)}>Add a note (optional)</button></p>}
          {error && <p className="err" role="alert">{error}</p>}
          <div className="row cta"><button className={"btn big" + (busy ? " loading" : "")} onClick={build} disabled={!sid || busy}>{busy ? "Building your routine…" : "Build my routine"}</button></div>
          <p className="note">A concept store for an invented brand. Nothing is sold and there is no payment. Please don't type personal details.</p>
        </section>
      ) : (
        <section className="stage rise" aria-labelledby="h-res">
          <div className="shead">
            <div>
              <h1 id="h-res">Your routine</h1>
              <p className="lede">{routine.summary}</p>
            </div>
            <button className="btn ghost" onClick={() => { setRoutine(null); setInfo(""); }}>Start over</button>
          </div>
          {info && <div className="banner info">{info}</div>}
          {risk && <div className="warnbox">You mentioned something that's best checked with a professional. These are general suggestions with gentle products only. Please ask a dermatologist before starting anything new.</div>}
          <div className="panel list">
            {routine.picks.map((pk: Pick, i: number) => {
              const p = BY_ID.get(pk.id)!;
              const alts = CATALOG.filter((x) => x.step === p.step && x.id !== p.id && (!gentle || x.gentle)).slice(0, 3);
              return (
                <div className="step" key={p.id} style={{ ["--i" as string]: i }}>
                  <ProductArt step={p.step} />
                  <div><div className="lab">{p.step}</div><h2>{p.name}</h2><p>{pk.reason}</p></div>
                  <div className="price">{inr(p.price)}</div>
                  {alts.length > 0 && (
                    <div className="swap">
                      <button className="link" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Keep this one" : "Swap"}</button>
                      {open === p.id && <div className="alts">{alts.map((x) => <button key={x.id} className="qchip" onClick={() => swap(p.id, x.id)}>{x.name} · {inr(x.price)}</button>)}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {pricing && <div className="total"><div className="save">{pricing.off > 0 ? `${pct}% off the full routine, you save ${inr(pricing.off)}` : "Routine price"}</div><div>{pricing.off > 0 && <s>{inr(pricing.raw)}</s>}<span className="big"><AnimatedNumber value={pricing.final} format={inr} /></span></div></div>}
          <div className="trust">
            {bad.length === 0 ? <span className="ok">✓ Checked: every product is from our shelf, one per step{checks.some((c) => /Within/.test(c.t)) ? ", within your budget" : ""}{gentle ? ", gentle only" : ""}.</span> : <span className="warnt">Check: {bad.map((c) => c.t).join(", ")}</span>}
            <span className="note">Built by {who}.</span>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="row cta">
            <button className="btn big" onClick={addRoutine}>{added ? "Added ✓" : "Add routine to cart"}</button>
            {added && <a className="btn ghost big" href="/cart">Go to cart</a>}
          </div>
        </section>
      )}

      <details className="shelf">
        <summary>Browse the whole shelf</summary>
        <div className="cat">
          {CATALOG.map((p, i) => (
            <article className="prod" key={p.id} style={{ ["--i" as string]: Math.min(i, 12) }}>
              <ProductArt step={p.step} />
              <div><span className="lab">{p.step}</span><h3>{p.name}</h3></div>
              <p>{p.how}</p>
              <div className="row" style={{ justifyContent: "space-between" }}><b>{inr(p.price)}</b><button className="btn ghost sm" onClick={() => addProduct(p.id)}>Add</button></div>
            </article>
          ))}
        </div>
      </details>
    </main>
  );
}
