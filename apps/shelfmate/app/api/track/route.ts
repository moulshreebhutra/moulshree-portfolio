import { NextResponse } from "next/server";
import { z } from "zod";
import { ipOf, limited } from "@/lib/limit";
import { SID, getConfig, getSess, upsertSess } from "@/lib/sessions";
import { BY_ID, bundleDiscount, checksFor, needsGentle } from "@/lib/shop";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("event", [
  z.object({ event: z.literal("start"), sid: z.string().regex(SID) }),
  z.object({ event: z.literal("cart"), sid: z.string().regex(SID), kind: z.enum(["bundle", "single"]) }),
  z.object({ event: z.literal("swap"), sid: z.string().regex(SID), from: z.string().max(8), to: z.string().max(8) }),
]);

export async function POST(req: Request) {
  if (limited(ipOf(req), "track", 150)) return NextResponse.json({ ok: false }, { status: 429 });
  let b;
  try { b = Body.parse(await req.json()); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (b.event === "start") { await upsertSess(b.sid, (s) => { s.started = true; }); return NextResponse.json({ ok: true }); }
  if (b.event === "cart") { await upsertSess(b.sid, (s) => { s.carted = s.carted && s.carted !== b.kind ? "both" : b.kind; }); return NextResponse.json({ ok: true }); }
  // swap: the server is the authority on what a valid swap is, and returns the repriced routine
  const s = await getSess(b.sid);
  const from = BY_ID.get(b.from), to = BY_ID.get(b.to);
  if (!s?.routine || !s.answers || !from || !to || from.step !== to.step || from.id === to.id) return NextResponse.json({ ok: false, error: "That swap is not valid." }, { status: 400 });
  const i = s.routine.picks.findIndex((p) => p.id === from.id);
  if (i < 0) return NextResponse.json({ ok: false, error: "That product is not in your routine." }, { status: 400 });
  if (needsGentle(s.answers, s.routine.risk) && !to.gentle) return NextResponse.json({ ok: false, error: "Only gentle products can go in this routine." }, { status: 400 });
  const updated = await upsertSess(b.sid, (x) => { x.routine!.picks[i] = { id: to.id, reason: `You chose ${to.name} instead.` }; x.swaps.push({ from: from.id, to: to.id }); });
  const cfg = await getConfig();
  const routine = { ...updated.routine!, summary: "", source: updated.routine!.source as any };
  return NextResponse.json({ ok: true, picks: updated.routine!.picks, checks: checksFor(routine, updated.answers!), pricing: bundleDiscount(updated.routine!.picks, cfg.discountPct), discountPct: cfg.discountPct });
}
