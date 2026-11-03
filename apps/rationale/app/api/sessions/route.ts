import { NextResponse } from "next/server";
import { ipOf, limited } from "@/lib/limit";
import { getJson, putJson } from "@/lib/store";
import { SessionSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{10}$/;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

export async function POST(req: Request) {
  if (limited(ipOf(req), "save", 20)) return NextResponse.json({ error: "Too many saves this hour." }, { status: 429 });
  let data;
  try {
    const raw = await req.text();
    if (raw.length > 150_000) throw new Error("big");
    data = SessionSchema.parse(JSON.parse(raw));
  } catch { return NextResponse.json({ error: "That session could not be saved. Check the size and try again." }, { status: 400 }); }
  const id = newId();
  try { await putJson(`sessions/${id}.json`, { ...data, savedAt: Date.now() }); }
  catch { return NextResponse.json({ error: "Storage is unavailable right now." }, { status: 503 }); }
  return NextResponse.json({ id });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const s = await getJson(`sessions/${id}.json`);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
