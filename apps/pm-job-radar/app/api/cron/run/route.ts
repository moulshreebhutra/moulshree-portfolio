import { runPipeline } from "@/lib/pipeline";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET)
    return new Response("Unauthorized", { status: 401 });
  const day = await runPipeline();
  return Response.json({ date: day.date, total: day.items.length });
}
