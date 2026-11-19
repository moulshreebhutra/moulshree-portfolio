import { auth } from "@/auth";
import { markDone } from "@/lib/pipeline";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  const { date, id, done } = await req.json();
  await markDone(String(date), String(id), !!done);
  return Response.json({ ok: true });
}
