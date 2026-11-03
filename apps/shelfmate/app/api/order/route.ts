import { NextResponse } from "next/server";
import { z } from "zod";
import { ipOf, limited } from "@/lib/limit";
import { SID, bust, getConfig, upsertSess } from "@/lib/sessions";
import { BY_ID, bundleDiscount, validBundle } from "@/lib/shop";
import { getJson, putJson } from "@/lib/store";

export const dynamic = "force-dynamic";

const Id = z.string().max(8);
const Body = z.object({ sid: z.string().regex(SID), bundle: z.array(Id).max(4).optional(), items: z.array(Id).max(12).optional() });
const newId = () => "SM" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 34]).join("");

/** A demo order: no payment, no name, no address. Prices are computed here, never taken from the browser. */
export async function POST(req: Request) {
  if (limited(ipOf(req), "order", 20)) return NextResponse.json({ error: "Too many orders from this connection this hour." }, { status: 429 });
  let b;
  try { b = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "That cart could not be read." }, { status: 400 }); }
  const bundle = b.bundle ?? [], items = b.items ?? [];
  if (!bundle.length && !items.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  if (bundle.length && !validBundle(bundle)) return NextResponse.json({ error: "That routine is not valid." }, { status: 400 });
  if (items.some((i) => !BY_ID.has(i))) return NextResponse.json({ error: "A product in the cart is not in the catalog." }, { status: 400 });
  const cfg = await getConfig();
  const bd = bundle.length ? bundleDiscount(bundle.map((id) => ({ id })), cfg.discountPct) : { raw: 0, off: 0, final: 0 };
  const singles = items.reduce((s, i) => s + BY_ID.get(i)!.price, 0);
  const total = bd.final + singles;
  const id = newId();
  const lines = [...bundle.map((i) => ({ id: i, via: "routine" as const })), ...items.map((i) => ({ id: i, via: "single" as const }))];
  const order = { id, sid: b.sid, ts: Date.now(), lines, bundleRaw: bd.raw, bundleOff: bd.off, discountPct: bundle.length ? cfg.discountPct : 0, singles, total };
  try { await putJson(`orders/${id}.json`, order); } catch { return NextResponse.json({ error: "Storage is unavailable right now." }, { status: 503 }); }
  await upsertSess(b.sid, (s) => { s.purchased = { orderId: id, total, raw: bd.raw + singles, bundle: bundle.length > 0, ids: [...bundle, ...items], discountPct: order.discountPct }; });
  bust();
  return NextResponse.json({ id });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^SM[0-9A-Z]{6}$/.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const o = await getJson(`orders/${id}.json`);
  return o ? NextResponse.json(o) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
