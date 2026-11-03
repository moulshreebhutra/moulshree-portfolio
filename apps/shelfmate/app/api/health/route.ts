import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { selfTest } from "@/lib/store";
import { getConfig } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const ai = aiConfigured();
  return NextResponse.json({ ai: ai.claude || ai.gemini, providers: ai, store: await selfTest(), discountPct: (await getConfig()).discountPct });
}
