import { NextResponse } from "next/server";
import { z } from "zod";
import { ipOf, limited } from "@/lib/limit";
import { bust, setConfig } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (limited(ipOf(req), "config", 12)) return NextResponse.json({ error: "Too many changes this hour." }, { status: 429 });
  let b;
  try { b = z.object({ discountPct: z.number().int().min(0).max(30) }).parse(await req.json()); } catch { return NextResponse.json({ error: "Pick a discount from 0 to 30 percent." }, { status: 400 }); }
  await setConfig(b.discountPct); bust();
  return NextResponse.json({ ok: true, discountPct: b.discountPct });
}
