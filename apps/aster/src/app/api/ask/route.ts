import { NextRequest, NextResponse } from "next/server";
import { ask } from "@/lib/agent/pipeline";
import { store } from "@/lib/data/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public demo + paid model key = cap abuse. In-memory, per warm instance: a speed bump,
// not a guarantee. The daily spend ceiling in pipeline.ts is the hard cost limit.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 25;
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many questions, please wait a few minutes." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const question = String(body.question ?? "").slice(0, 500);
    const userId = String(body.userId ?? store().defaultUserId());
    if (!question.trim()) {
      return NextResponse.json({ error: "empty question" }, { status: 400 });
    }
    if (!store().user(userId)) {
      return NextResponse.json({ error: "unknown user" }, { status: 400 });
    }
    const { trace } = await ask(userId, question);
    // Resolve source rows (scoped to this user) for "show the working".
    const sources = trace.sources
      .map((id) => store().txnById(userId, id))
      .filter(Boolean);
    return NextResponse.json({ trace, sources });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
