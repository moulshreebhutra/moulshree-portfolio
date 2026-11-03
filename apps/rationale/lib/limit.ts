// Abuse protection for a public demo: per-visitor rate limits, input caps (see types.ts) and a daily AI budget.
import { getJson, putJson } from "./store";

const hits = new Map<string, number[]>();

/** True when this visitor has used up `max` calls of this kind inside the window. Per server instance, which is enough to stop casual abuse. */
export function limited(ip: string, bucket: string, max: number, windowMs = 3_600_000): boolean {
  const key = bucket + ":" + ip, now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return recent.length > max;
}

export function ipOf(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}

/** Daily cap on model calls across all visitors. Best effort: a race can overshoot by a few calls, never by orders of magnitude. */
export async function spendOk(): Promise<boolean> {
  const cap = Number(process.env.AI_DAILY_CAP ?? 400);
  const key = "caps/" + new Date().toISOString().slice(0, 10) + ".json";
  try {
    const cur = (await getJson<{ n: number }>(key))?.n ?? 0;
    if (cur >= cap) return false;
    await putJson(key, { n: cur + 1 });
  } catch { /* if the counter is unreachable, the per-visitor limit still applies */ }
  return true;
}
