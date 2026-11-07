import { COST_SHARE } from "./catalog";
import { BY_ID, RISK, bundleDiscount, type Answers, type Pick } from "./shop";

export interface Sess {
  sid: string;
  ts: number;
  sample?: boolean;
  started?: boolean;
  finished?: boolean;
  answers?: Answers;
  routine?: { picks: Pick[]; source: string; risk: boolean };
  swaps: { from: string; to: string }[];
  carted?: "bundle" | "single" | "both";
  purchased?: { orderId: string; total: number; raw: number; bundle: boolean; ids: string[]; discountPct: number };
  free?: string;
}

export const ASK_BUCKETS: [string, RegExp, string][] = [
  ["Acne marks and dark spots", /acne mark|dark spot|pigment|scar|marks|spots/i, "Lead with a brightening pairing in the quiz results"],
  ["Fragrance-free", /fragrance|perfume|scent/i, "Add a fragrance-free filter to the quiz"],
  ["Seasonal change", /summer|winter|season|monsoon|humid|weather/i, "Offer a seasonal swap for the moisturizer"],
  ["Pregnancy or a skin condition", RISK, "Keep the gentle routine and the dermatologist note"],
  ["Budget", /budget|cheap|afford|expensive|under\s*₹?\s*\d+/i, "Add a two-product starter option"],
];
export const bucketOf = (t: string) => ASK_BUCKETS.find(([, re]) => re.test(t))?.[0] ?? "Something else";

const pct = (a: number, b: number) => (b ? a / b : 0);
const costOf = (ids: string[]) => ids.reduce((s, i) => s + (BY_ID.get(i)?.price ?? 0) * COST_SHARE, 0);

/** Revenue and margin per session if every bundle order had been priced at a different discount. Same shoppers, same baskets: a mechanical what-if, not a forecast of behaviour. */
export function whatIf(sessions: Sess[], discountPct: number) {
  const n = sessions.length || 1;
  let rev = 0, margin = 0, bundleMarginPct = 0, bundles = 0;
  for (const s of sessions) {
    const p = s.purchased; if (!p) continue;
    let total = p.total;
    if (p.bundle) { const d = bundleDiscount(p.ids.map((id) => ({ id })), discountPct); const extra = p.total - (p.raw - Math.round(p.raw * (p.discountPct / 100))); total = d.final + Math.max(0, extra); bundles++; bundleMarginPct += (d.final - costOf(p.ids)) / (d.final || 1); }
    rev += total; margin += total - costOf(p.ids);
  }
  return { revPerSession: rev / n, marginPerSession: margin / n, bundleMargin: bundles ? bundleMarginPct / bundles : null };
}

export function summarize(sessions: Sess[], discountPct: number) {
  const n = sessions.length;
  const c = (f: (s: Sess) => unknown) => sessions.filter((s) => f(s)).length;
  const started = c((s) => s.started || s.finished), finished = c((s) => s.finished), viewed = c((s) => s.routine), carted = c((s) => s.carted), bought = c((s) => s.purchased);
  const orders = sessions.filter((s) => s.purchased).map((s) => s.purchased!);
  const aov = orders.length ? orders.reduce((a, o) => a + o.total, 0) / orders.length : 0;
  const withR = sessions.filter((s) => s.routine), without = sessions.filter((s) => !s.routine);
  const grp = (g: Sess[]) => { const o = g.filter((s) => s.purchased); return { sessions: g.length, conv: pct(o.length, g.length), aov: o.length ? o.reduce((a, s) => a + s.purchased!.total, 0) / o.length : 0, orders: o.length }; };

  const swapCount = new Map<string, number>();
  for (const s of sessions) for (const from of new Set(s.swaps.map((x) => x.from))) swapCount.set(from, (swapCount.get(from) ?? 0) + 1);
  const swaps = [...swapCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, k]) => ({ id, name: BY_ID.get(id)?.name ?? id, share: pct(k, viewed) }));

  const frees = sessions.map((s) => s.free).filter((x): x is string => !!x && x.trim().length > 2);
  const bm = new Map<string, number>();
  frees.forEach((t) => bm.set(bucketOf(t), (bm.get(bucketOf(t)) ?? 0) + 1));
  const asks = [...bm.entries()].sort((a, b) => b[1] - a[1]).map(([label, k]) => ({ label, share: pct(k, frees.length), count: k, hint: ASK_BUCKETS.find((b) => b[0] === label)?.[2] ?? "Read these and look for a pattern" }));

  // average order value by day for the last 8 days
  const day = 86_400_000, today = Math.floor(Date.now() / day);
  const byDay = Array.from({ length: 8 }, (_, i) => {
    const d = today - 7 + i;
    const o = sessions.filter((s) => s.purchased && Math.floor(s.ts / day) === d);
    return { label: new Date(d * day).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), aov: o.length ? o.reduce((a, s) => a + s.purchased!.total, 0) / o.length : null, orders: o.length };
  });

  const prodCount = new Map<string, number>();
  for (const o of orders) for (const id of o.ids) prodCount.set(id, (prodCount.get(id) ?? 0) + 1);
  const topProducts = [...prodCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, name: BY_ID.get(id)?.name ?? id, count }));
  const recent = sessions.filter((s) => s.purchased).sort((a, b) => b.ts - a.ts).slice(0, 8).map((s) => ({ orderId: s.purchased!.orderId, ts: s.ts, total: s.purchased!.total, items: s.purchased!.ids.length, routine: s.purchased!.bundle, sample: !!s.sample }));
  const cur = whatIf(sessions, discountPct);
  return {
    n, real: c((s) => !s.sample), sample: c((s) => s.sample),
    funnel: [["Sessions", n], ["Started the quiz", started], ["Finished the quiz", finished], ["Viewed a routine", viewed], ["Added to cart", carted], ["Purchased", bought]] as [string, number][],
    conv: pct(bought, n), aov, bundleShare: pct(orders.filter((o) => o.bundle).length, orders.length), orders: orders.length,
    revPerSession: cur.revPerSession, marginPerSession: cur.marginPerSession, bundleMargin: cur.bundleMargin,
    withRoutine: grp(withR), withoutRoutine: grp(without), swaps, asks, freeCount: frees.length, byDay, topProducts, recent, revenue: orders.reduce((a, o) => a + o.total, 0),
  };
}

/** Small deterministic generator, so seeding twice produces the same sample sessions. */
export function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
