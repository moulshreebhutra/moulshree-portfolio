import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { fmt } from "@/lib/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const users = store().users().map((u) => ({
    id: u.id,
    name: u.name,
    persona: u.persona,
    city: u.city,
    monthlyIncome: fmt(u.monthlyIncomePaise),
    txnCount: store().txnsForUser(u.id).length,
  }));
  return NextResponse.json({ users });
}
