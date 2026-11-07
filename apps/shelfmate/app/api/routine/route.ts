import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, ask, extractJson } from "@/lib/ai";
import { ipOf, limited } from "@/lib/limit";
import { redact } from "@/lib/redact";
import { OPTIONS, RISK, aiPrompt, bundleDiscount, checksFor, rulesRoutine, validateAi, type Answers } from "@/lib/shop";
import { SID, getConfig, upsertSess } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const oneOf = (g: keyof typeof OPTIONS) => z.enum(OPTIONS[g].map((o) => o[0]) as [string, ...string[]]);
const Body = z.object({
  sid: z.string().regex(SID),
  answers: z.object({ skin: oneOf("skin"), concern: oneOf("concern"), size: z.enum(["3", "4"]), budget: oneOf("budget"), free: z.string().max(400).default("") }),
});

export async function POST(req: Request) {
  let body;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "Answer the questions first." }, { status: 400 }); }
  const a: Answers = { ...body.answers, free: redact(body.answers.free).trim(), size: body.answers.size as "3" | "4" };
  const risk = RISK.test(a.free);
  let routine = rulesRoutine(a, risk), note = "";
  if (limited(ipOf(req), "routine", 15)) note = "Hourly AI limit reached, so this routine was built by simple rules.";
  else {
    try {
      const { value, provider } = await ask({ prompt: aiPrompt(a, risk), maxTokens: 700, json: true, timeoutMs: 30_000 }, (t) => validateAi(extractJson(t), a, risk, "claude"));
      routine = { ...value, source: provider };
    } catch (e) {
      note = e instanceof AiError && e.code === "off" ? "" : e instanceof AiError && e.code === "cap" ? "Today's AI budget is used up, so this routine was built by simple rules." : "The AI routine did not pass the safety checks, so this one was built by simple rules.";
    }
  }
  await upsertSess(body.sid, (s) => { s.started = true; s.finished = true; s.answers = a; s.free = a.free || undefined; s.routine = { picks: routine.picks, source: routine.source, risk: routine.risk }; s.swaps = []; });
  const cfg = await getConfig();
  return NextResponse.json({ routine, checks: checksFor(routine, a), pricing: bundleDiscount(routine.picks, cfg.discountPct), discountPct: cfg.discountPct, note });
}
