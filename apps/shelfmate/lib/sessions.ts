import { CATALOG } from "./catalog";
import { getJson, listKeys, putJson } from "./store";
import { BY_ID, OPTIONS, bundleDiscount, rulesRoutine, type Answers } from "./shop";
import { prng, type Sess } from "./stats";

export const SID = /^[a-z0-9]{10,24}$/;
export interface Config { discountPct: number; updatedAt: number }
export const DEFAULT_CONFIG: Config = { discountPct: 10, updatedAt: 0 };

export const getConfig = async (): Promise<Config> => (await getJson<Config>("config.json")) ?? DEFAULT_CONFIG;
export const setConfig = (discountPct: number) => putJson("config.json", { discountPct, updatedAt: Date.now() });

export const getSess = (sid: string) => getJson<Sess>(`sessions/${sid}.json`);
export async function upsertSess(sid: string, f: (s: Sess) => void): Promise<Sess> {
  const s = (await getSess(sid)) ?? { sid, ts: Date.now(), swaps: [] };
  f(s);
  await putJson(`sessions/${sid}.json`, s);
  return s;
}

let cache: { at: number; data: Sess[] } | undefined;
/** Latest sessions, newest last. Session ids start with a base-36 timestamp, so key order is time order. Cached for 15 seconds. */
export async function loadSessions(max = 400): Promise<Sess[]> {
  if (cache && Date.now() - cache.at < 15_000) return cache.data;
  const keys = (await listKeys("sessions/", 5000)).sort().slice(-max);
  const out: Sess[] = [];
  for (let i = 0; i < keys.length; i += 25) {
    const part = await Promise.all(keys.slice(i, i + 25).map((k) => getJson<Sess>(k)));
    part.forEach((p) => p && out.push(p));
  }
  cache = { at: Date.now(), data: out };
  return out;
}
export const bust = () => { cache = undefined; };

/** Clearly flagged sample sessions so an empty dashboard is not mistaken for broken. They are never mixed with real ones unless the viewer asks. */
export async function seedSamples(count = 80): Promise<number> {
  if (await getJson("seeded.json")) return 0;
  const r = prng(20261103), day = 86_400_000, now = Date.now();
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const frees = ["", "", "", "fragrance-free please", "I want to fade acne marks and dark spots", "oily in summer but dry in winter", "I am pregnant, so nothing harsh", "under ₹1,000 if possible", "", "sensitive around my nose", "", "mostly want to stop breakouts"];
  for (let i = 0; i < count; i++) {
    const ts = now - Math.floor(r() * 8 * day);
    const sid = ts.toString(36).padStart(9, "0") + "sample" + String(i).padStart(3, "0");
    const s: Sess = { sid, ts, sample: true, swaps: [] };
    if (r() < 0.42) {
      s.started = true;
      if (r() < 0.74) {
        s.finished = true;
        const a: Answers = { skin: pick(OPTIONS.skin)[0], concern: pick(OPTIONS.concern)[0], size: r() < 0.6 ? "4" : "3", budget: pick(OPTIONS.budget)[0], free: pick(frees) };
        const rt = rulesRoutine(a, /pregnan/i.test(a.free));
        s.answers = a; s.free = a.free || undefined;
        s.routine = { picks: rt.picks, source: "rules", risk: rt.risk };
        if (r() < 0.45) { const k = Math.floor(r() * rt.picks.length); const cur = BY_ID.get(rt.picks[k].id)!; const alt = CATALOG.filter((p) => p.step === cur.step && p.id !== cur.id); if (alt.length) s.swaps.push({ from: cur.id, to: pick(alt).id }); }
        if (r() < 0.5) {
          s.carted = "bundle";
          if (r() < 0.45) {
            const ids = s.routine.picks.map((p) => p.id), d = bundleDiscount(ids.map((id) => ({ id })), 10);
            s.purchased = { orderId: "S" + sid.slice(-6), total: d.final, raw: d.raw, bundle: true, ids, discountPct: 10 };
          }
        }
      }
    } else if (r() < 0.03) {
      const p = pick(CATALOG); s.carted = "single";
      if (r() < 0.4) s.purchased = { orderId: "S" + sid.slice(-6), total: p.price, raw: p.price, bundle: false, ids: [p.id], discountPct: 0 };
    }
    await putJson(`sessions/${sid}.json`, s);
  }
  await putJson("seeded.json", { at: now, count });
  bust();
  return count;
}
