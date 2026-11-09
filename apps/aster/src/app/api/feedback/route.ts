import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const traceId = String(body.traceId ?? "");
  const vote = body.vote === "down" ? "down" : "up";
  const reason = body.reason ? String(body.reason).slice(0, 300) : undefined;
  const ok = store().recordFeedback(traceId, vote, reason);
  return NextResponse.json({ ok });
}
