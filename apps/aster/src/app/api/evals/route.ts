import { NextResponse } from "next/server";
import { runEvals } from "@/lib/evals/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const report = runEvals();
  // Trim the per-case list for the wire; keep a sample of failures + examples.
  const failing = report.cases.filter(
    (c) => !c.toolCallOk || !c.grounded || c.headlineOk === false || c.redirectOk === false
  );
  const sample = report.cases.slice(0, 12);
  return NextResponse.json({ ...report, cases: undefined, failing, sample });
}
