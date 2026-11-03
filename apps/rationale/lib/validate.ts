import { z } from "zod";
import { clamp } from "./score";
import { LIMITS, type Item, type Severity, type Theme } from "./types";

export const ItemSchema = z.object({
  id: z.number().int().min(1).max(100000),
  customer: z.string().min(1).max(60),
  tier: z.enum(["Enterprise", "Mid-market", "SMB"]),
  arr: z.number().min(0).max(LIMITS.maxArr),
  text: z.string().min(1).max(LIMITS.maxTextChars),
});

export const ItemsSchema = z
  .array(ItemSchema)
  .min(1)
  .max(LIMITS.maxItems)
  .refine((a) => a.reduce((s, i) => s + i.text.length, 0) <= LIMITS.maxTotalChars, "Too much text in one batch")
  .refine((a) => new Set(a.map((i) => i.id)).size === a.length, "Duplicate ids");

export const ThemeSchema = z.object({
  id: z.string().max(20),
  title: z.string().min(1).max(90),
  itemIds: z.array(z.number().int()).max(LIMITS.maxItems),
  summary: z.string().max(300),
  effort: z.number().min(1).max(5),
  effortWhy: z.string().max(200),
  confidence: z.number().min(0.2).max(1),
  blocksRevenue: z.boolean(),
  severity: z.enum(["blocker", "high", "medium", "low"]),
  prd: z.string().max(6000).optional(),
});

export const SessionSchema = z.object({
  items: ItemsSchema,
  themes: z.array(ThemeSchema).max(12),
  source: z.enum(["none", "rules", "ai"]),
});

/**
 * Turn whatever a model returned into safe themes: unknown or repeated item ids are dropped, numbers are clamped,
 * a theme with no valid evidence disappears. Throws when nothing usable is left.
 */
export function normalizeThemes(raw: unknown, items: Item[]): Theme[] {
  if (!Array.isArray(raw)) throw new Error("not an array");
  const ids = new Set(items.map((i) => i.id));
  const used = new Set<number>();
  const out: Theme[] = [];
  raw.forEach((t: any, i) => {
    if (!t || typeof t.title !== "string" || !t.title.trim()) return;
    const itemIds = (Array.isArray(t.itemIds) ? t.itemIds : []).map(Number).filter((id: number) => {
      if (!ids.has(id) || used.has(id)) return false;
      used.add(id);
      return true;
    });
    if (!itemIds.length) return;
    const severity: Severity = ["blocker", "high", "medium", "low"].includes(t.severity) ? t.severity : "medium";
    out.push({
      id: "T" + (i + 1),
      title: String(t.title).trim().slice(0, 90),
      itemIds,
      summary: String(t.summary ?? "").slice(0, 280),
      effort: clamp(Math.round(Number(t.effort) || 3), 1, 5),
      effortWhy: String(t.effortWhy ?? "").slice(0, 190),
      confidence: clamp(Number(t.confidence) || 0.6, 0.2, 1),
      blocksRevenue: !!t.blocksRevenue,
      severity,
    });
  });
  if (!out.length) throw new Error("no valid themes");
  return out;
}
