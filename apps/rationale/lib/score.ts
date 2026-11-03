import type { Item, Theme } from "./types";

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const pad = (n: number) => (n < 10 ? "0" : "") + n;
export const fid = (id: number) => "F-" + pad(id);

export function arrOf(t: Theme, items: Item[]): number {
  const by = new Map(items.map((i) => [i.id, i]));
  return t.itemIds.reduce((s, id) => s + (by.get(id)?.arr ?? 0), 0);
}

/** The whole score, in one line anyone can check: ARR at stake x confidence / effort. */
export function score(t: Theme, items: Item[]): number {
  return (arrOf(t, items) * t.confidence) / Math.max(1, t.effort);
}

export function ranked(themes: Theme[], items: Item[]): Theme[] {
  return themes.slice().sort((a, b) => score(b, items) - score(a, items) || a.title.localeCompare(b.title));
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "export";
}
