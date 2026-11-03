import { LIMITS, TIERS, type Item, type Tier } from "./types";

/** Minimal RFC 4180 style CSV parser: quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => { const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");
}

function tierOf(s: string): Tier {
  const t = s.trim().toLowerCase();
  if (t.startsWith("ent")) return "Enterprise";
  if (t.startsWith("mid")) return "Mid-market";
  if (t.startsWith("smb") || t.startsWith("small")) return "SMB";
  return TIERS.find((x) => x.toLowerCase() === t) ?? "Mid-market";
}

/** "$84k", "84", "84,000", "1.2m" -> thousands of dollars. Returns 0 when it cannot tell. */
export function parseArr(s: string): number {
  const m = String(s).trim().toLowerCase().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const v = m[2] === "m" ? n * 1000 : m[2] === "k" ? n : n >= 1000 ? n / 1000 : n;
  return Math.min(LIMITS.maxArr, Math.round(v * 10) / 10);
}

export interface ParsedFeedback { items: Omit<Item, "id">[]; skipped: number; note: string }

/**
 * Accepts three shapes:
 * 1. CSV with a header row containing customer / tier / arr / text (any order, any extra columns).
 * 2. Lines like "Customer | Tier | $84k | the feedback".
 * 3. Plain lines, one piece of feedback each (customer "Unknown", ARR 0, which the PM can edit).
 */
export function parseFeedback(raw: string): ParsedFeedback {
  const text = raw.replace(/^﻿/, "").trim();
  if (!text) return { items: [], skipped: 0, note: "Nothing to add." };
  const out: Omit<Item, "id">[] = [];
  let skipped = 0;
  const push = (customer: string, tier: Tier, arr: number, body: string) => {
    const t = body.replace(/\s+/g, " ").trim().slice(0, LIMITS.maxTextChars);
    if (t.length < 4) { skipped++; return; }
    out.push({ customer: (customer || "Unknown").trim().slice(0, 60) || "Unknown", tier, arr, text: t });
  };

  const first = text.split(/\r?\n/, 1)[0].toLowerCase();
  const header = first.includes(",") && /(text|feedback|comment|message)/.test(first) && /(customer|account|company|name)/.test(first);
  if (header) {
    const rows = parseCsv(text);
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const col = (re: RegExp) => h.findIndex((x) => re.test(x));
    const ci = col(/customer|account|company|name/), ti = col(/tier|plan|segment/), ai = col(/arr|revenue|value|amount/), xi = col(/text|feedback|comment|message/);
    for (const r of rows.slice(1)) push(r[ci] ?? "", tierOf(r[ti] ?? ""), parseArr(r[ai] ?? ""), r[xi] ?? "");
    return { items: out, skipped, note: "Read as CSV." };
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length >= 4) push(parts[0], tierOf(parts[1]), parseArr(parts[2]), parts.slice(3).join(" | "));
    else push("Unknown", "Mid-market", 0, line);
  }
  return { items: out, skipped, note: out.some((i) => i.customer === "Unknown") ? "Some lines had no customer or ARR. Fill those in below, because ARR drives the ranking." : "Read as lines." };
}
