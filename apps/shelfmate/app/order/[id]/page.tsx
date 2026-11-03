import Link from "next/link";
import { notFound } from "next/navigation";
import { getJson } from "@/lib/store";
import { BY_ID, inr } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^SM[0-9A-Z]{6}$/.test(id)) notFound();
  const o = await getJson<{ id: string; lines: { id: string; via: string }[]; bundleOff: number; discountPct: number; total: number }>(`orders/${id}.json`);
  if (!o) notFound();
  return (
    <main className="wrap" style={{ maxWidth: 720, marginBottom: 60 }}>
      <section className="hero"><h1>Order {o.id} placed</h1><p>This is a demo order. Nothing will be shipped and nothing was charged. It now shows up in the <Link href="/merchant">merchant view</Link>.</p></section>
      <section className="panel">
        {o.lines.map((l, i) => <div className="cartline" key={i}><span>{BY_ID.get(l.id)?.name} <span className="pill">{l.via === "routine" ? "in routine" : "single"}</span></span><span>{inr(BY_ID.get(l.id)?.price ?? 0)}</span></div>)}
        {o.bundleOff > 0 && <div className="cartline" style={{ color: "var(--ok)" }}><span>Routine discount, {o.discountPct}%</span><span>−{inr(o.bundleOff)}</span></div>}
        <div className="total"><div className="save">Total</div><div className="big">{inr(o.total)}</div></div>
        <Link className="btn ghost" href="/">Back to the shop</Link>
      </section>
    </main>
  );
}
