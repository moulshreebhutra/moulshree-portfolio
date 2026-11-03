import { NextResponse } from "next/server";
import { ipOf, limited } from "@/lib/limit";
import { seedSamples } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (limited(ipOf(req), "seed", 3)) return NextResponse.json({ error: "Already seeding." }, { status: 429 });
  const n = await seedSamples();
  return NextResponse.json({ added: n });
}
