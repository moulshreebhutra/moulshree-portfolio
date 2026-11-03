// Grouping without AI. Plain word overlap, so it is a floor, not the product: it catches repeated wording,
// where the model catches repeated needs. The page says so whenever this path is used.
import type { Item, Severity, Theme } from "./types";

const STOP = new Set(("a an the and or but if of to in on for with without at by from as is are was were be been being it its this that these those we our us you your they them their " +
  "i me my can could would should will just not no yes do does did have has had need needs want wants like would love please also when which what who how why more most very too " +
  "than then there here into out up down over under about after before while still even really much many some any all each every one two three").split(" "));

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s|ly|ion|ions)$/, "");
}
export function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem).filter((w) => w.length > 2);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter || 1);
}

const GATE = /renew|cannot (?:sign|expand|roll|go live)|must[- ]have|is a must|required|requires|blocker|blocked|before we|by q[1-4]|or we cannot|deal/i;

export function groupByRules(items: Item[], maxThemes = 8): Theme[] {
  const sets = items.map((i) => new Set(tokens(i.text)));
  let clusters: number[][] = items.map((_, i) => [i]);
  const sim = (a: number[], b: number[]) => Math.max(...a.flatMap((x) => b.map((y) => jaccard(sets[x], sets[y]))));
  // single-link merge: join the most similar pair while they share enough words
  for (;;) {
    let best = 0, bi = -1, bj = -1;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        const s = sim(clusters[i], clusters[j]);
        if (s > best) { best = s; bi = i; bj = j; }
      }
    if (best < 0.14 || bi < 0) break;
    clusters[bi] = clusters[bi].concat(clusters[bj]);
    clusters.splice(bj, 1);
  }
  // too many themes: fold the smallest into whichever is most similar
  while (clusters.length > maxThemes) {
    clusters.sort((a, b) => a.length - b.length);
    const small = clusters.shift()!;
    let bi = 0, bs = -1;
    clusters.forEach((c, i) => { const s = sim(small, c); if (s > bs) { bs = s; bi = i; } });
    clusters[bi] = clusters[bi].concat(small);
  }

  return clusters.map((c, n) => {
    const members = c.map((i) => items[i]);
    const freq = new Map<string, number>();
    c.forEach((i) => sets[i].forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1)));
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 3).map(([w]) => w);
    // show the original spelling of each stem
    const original = (stemmed: string) => {
      for (const m of members) { const hit = m.text.toLowerCase().match(new RegExp("\\b" + stemmed + "[a-z]*", "i")); if (hit) return hit[0]; }
      return stemmed;
    };
    const words = top.map(original);
    const title = words.length ? words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" · ") : members[0].text.slice(0, 40);
    const gates = members.filter((m) => GATE.test(m.text)).length;
    const arr = members.reduce((s, m) => s + m.arr, 0);
    const severity: Severity = gates && members.some((m) => m.tier === "Enterprise") ? "blocker" : arr >= 100 ? "high" : arr >= 25 ? "medium" : "low";
    return {
      id: "T" + (n + 1),
      title,
      itemIds: members.map((m) => m.id),
      summary: `${members.length} request${members.length > 1 ? "s" : ""} from ${new Set(members.map((m) => m.customer)).size} account${members.length > 1 ? "s" : ""} repeat the words: ${words.join(", ")}.`,
      effort: 3,
      effortWhy: "Default estimate. Set it with the slider; this grouping did not use AI.",
      confidence: Math.min(0.9, 0.45 + 0.15 * members.length),
      blocksRevenue: gates > 0,
      severity,
    };
  });
}
