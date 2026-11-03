// Shared JSON storage. Vercel Blob when BLOB_READ_WRITE_TOKEN is set (shared by every visitor and server instance),
// otherwise this instance's memory, which is enough for local development and tests.
import { put, head, list } from "@vercel/blob";

// globalThis so every route bundle in one server process sees the same fallback store
const MEM: Map<string, string> = ((globalThis as any).__shelfmateMem ??= new Map<string, string>());
const on = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const storeKind = () => (on() ? "vercel-blob" : "memory");

const safe = (k: string) => k.replace(/[^a-zA-Z0-9/_.-]/g, "-").slice(0, 160);

export async function getJson<T>(key: string): Promise<T | undefined> {
  const k = safe(key);
  if (!on()) { const v = MEM.get(k); return v ? (JSON.parse(v) as T) : undefined; }
  try {
    const meta = await head(k);
    const r = await fetch(meta.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return r.ok ? ((await r.json()) as T) : undefined;
  } catch { return undefined; }
}

export async function putJson(key: string, value: unknown): Promise<void> {
  const k = safe(key), body = JSON.stringify(value);
  if (!on()) { MEM.set(k, body); return; }
  await put(k, body, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}

export async function listKeys(prefix: string, max = 1000): Promise<string[]> {
  const p = safe(prefix);
  if (!on()) return [...MEM.keys()].filter((k) => k.startsWith(p)).slice(0, max);
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: p, cursor, limit: Math.min(1000, max - out.length) });
    out.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && out.length < max);
  return out;
}

export async function selfTest(): Promise<{ kind: string; ok: boolean; error?: string }> {
  try {
    await putJson("health/ping.json", { at: Date.now() });
    const v = await getJson<{ at: number }>("health/ping.json");
    return { kind: storeKind(), ok: !!v?.at };
  } catch (e) {
    return { kind: storeKind(), ok: false, error: String((e as Error).message).replace(/vercel_blob_[A-Za-z0-9_]+/g, "[token]").slice(0, 160) };
  }
}
