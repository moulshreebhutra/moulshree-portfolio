import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { selfTest } from "@/lib/store";

export const dynamic = "force-dynamic";

/** What the page needs to know to enable buttons. Never returns a key or a token. */
export async function GET() {
  const ai = aiConfigured();
  return NextResponse.json({ ai: ai.claude || ai.gemini, providers: { claude: ai.claude, gemini: ai.gemini }, store: await selfTest() });
}
