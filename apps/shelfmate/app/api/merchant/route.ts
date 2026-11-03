import { NextResponse } from "next/server";
import { getConfig, loadSessions } from "@/lib/sessions";
import { summarize, whatIf } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const includeSample = u.searchParams.get("sample") !== "0";
  const dial = Number(u.searchParams.get("dial"));
  const cfg = await getConfig();
  const all = await loadSessions();
  const used = includeSample ? all : all.filter((s) => !s.sample);
  const stats = summarize(used, cfg.discountPct);
  const dialPct = Number.isFinite(dial) && dial >= 0 && dial <= 30 ? Math.round(dial) : cfg.discountPct;
  return NextResponse.json({ config: cfg, stats, dial: { pct: dialPct, ...whatIf(used, dialPct) }, counts: { real: all.filter((s) => !s.sample).length, sample: all.filter((s) => s.sample).length } });
}
