import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") ?? store().defaultUserId();
  return NextResponse.json({ facts: store().memoryForUser(userId) });
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") ?? store().defaultUserId();
  const id = req.nextUrl.searchParams.get("id");
  if (id === "*") {
    store().clearMemory(userId);
    return NextResponse.json({ ok: true, cleared: true });
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const ok = store().deleteMemory(userId, id);
  return NextResponse.json({ ok });
}
