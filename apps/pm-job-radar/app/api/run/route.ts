import { auth } from "@/auth";
import { runPipeline } from "@/lib/pipeline";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  try { const day = await runPipeline(); return Response.json({ ok: true, total: day.items.length }); }
  catch (e: any) { return Response.json({ ok: false, error: String(e.message ?? e) }, { status: 500 }); }
}
