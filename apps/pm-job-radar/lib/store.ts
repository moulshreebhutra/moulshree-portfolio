// Tiny Upstash Redis REST client. Falls back to memory when env vars are missing (local dev only).
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map<string, string>();

async function cmd(args: (string | number)[]): Promise<any> {
  const r = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash ${r.status}`);
  return (await r.json()).result;
}

export const storeConfigured = () => !!(URL_ && TOKEN);

export async function getJSON<T>(key: string): Promise<T | null> {
  const v = storeConfigured() ? await cmd(["GET", key]) : mem.get(key) ?? null;
  return v ? (JSON.parse(v) as T) : null;
}
export async function setJSON(key: string, value: unknown, ttlSeconds?: number) {
  const s = JSON.stringify(value);
  if (!storeConfigured()) return void mem.set(key, s);
  await cmd(ttlSeconds ? ["SET", key, s, "EX", ttlSeconds] : ["SET", key, s]);
}
