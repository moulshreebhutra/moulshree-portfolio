"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSid, post, readCart, writeCart, emptyCart, type Cart } from "@/lib/client";
import { BY_ID, bundleDiscount, inr } from "@/lib/shop";

export default function CartView() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [pct, setPct] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setCart(readCart()); fetch("/api/config").then((r) => r.json()).then((j) => setPct(j.discountPct)).catch(() => {}); }, []);
  const save = (c: Cart) => { setCart(c); writeCart(c); };
  const bd = bundleDiscount(cart.bundle.map((id) => ({ id })), pct);
  const singles = cart.items.reduce((s, i) => s + (BY_ID.get(i)?.price ?? 0), 0);
  const total = bd.final + singles;
  const empty = !cart.bundle.length && !cart.items.length;

  async function place() {
    setBusy(true); setErr("");
    const { ok, data } = await post("/api/order", { sid: getSid(), bundle: cart.bundle, items: cart.items });
    if (!ok) { setErr(data.error || "The order did not go through."); setBusy(false); return; }
    writeCart(emptyCart); router.push("/order/" + data.id);
  }

  return (
    <main className="wrap" style={{ maxWidth: 720, marginBottom: 60 }}>
      <section className="hero"><h1>Your cart</h1><p>A demo checkout. No payment, name or address is asked for.</p></section>
      <section className="panel" aria-labelledby="c-h">
        <h3 id="c-h" style={{ marginBottom: 8 }}>Items</h3>
        {empty ? <div className="empty">Your cart is empty. <a href="/">Build a routine</a>.</div> : (
          <>
            {cart.bundle.length > 0 && <div className="cartline" style={{ display: "block" }}><div className="row" style={{ justifyContent: "space-between" }}><b>Routine ({cart.bundle.length} steps)</b><button className="btn danger sm" onClick={() => save({ ...cart, bundle: [] })}>Remove</button></div>
              {cart.bundle.map((id) => <div className="cartline" key={id} style={{ borderBottom: 0, padding: "4px 0" }}><span>{BY_ID.get(id)?.step}: {BY_ID.get(id)?.name}</span><span>{inr(BY_ID.get(id)?.price ?? 0)}</span></div>)}
              <div className="cartline" style={{ borderBottom: 0, color: "var(--ok)" }}><span>{bd.off > 0 ? `Routine discount, ${pct}%` : "No routine discount"}</span><span>{bd.off > 0 ? "−" + inr(bd.off) : inr(0)}</span></div></div>}
            {cart.items.map((id) => <div className="cartline" key={id}><span>{BY_ID.get(id)?.name}</span><span>{inr(BY_ID.get(id)?.price ?? 0)} <button className="btn danger sm" aria-label={`Remove ${BY_ID.get(id)?.name}`} onClick={() => save({ ...cart, items: cart.items.filter((x) => x !== id) })}>×</button></span></div>)}
            <div className="total"><div className="save">Total</div><div className="big">{inr(total)}</div></div>
            {err && <div className="warnbox" role="alert">{err}</div>}
            <button className="btn" onClick={place} disabled={busy}>{busy ? "Placing…" : "Place demo order"}</button>
          </>
        )}
      </section>
    </main>
  );
}
