import { arrOf, fid } from "./score";
import type { Item, Theme } from "./types";

export function templatePrd(t: Theme, items: Item[]): string {
  const by = new Map(items.map((i) => [i.id, i]));
  const ev = t.itemIds.map((id) => by.get(id)).filter(Boolean) as Item[];
  const lines = [`# ${t.title}`, "", "## Problem", t.summary || "Customers are asking for this.", "", "## Evidence"];
  ev.forEach((f) => lines.push(`- ${fid(f.id)} ${f.customer} ($${f.arr}k, ${f.tier}): ${f.text}`));
  lines.push("", "## Impact", `${ev.length} request${ev.length === 1 ? "" : "s"}, $${arrOf(t, items)}k ARR at stake${t.blocksRevenue ? ", with a renewal or expansion depending on it." : "."}`);
  lines.push("", "## Effort", `${t.effort} of 5. ${t.effortWhy}`);
  lines.push("", "## Next step", "Use Draft with AI to expand this into goals, requirements and success metrics.");
  return lines.join("\n");
}

export interface PrdCheck { label: string; ok: boolean }

/** Cheap, deterministic faithfulness checks on a drafted PRD. They catch the usual inventions: ids and money that are not in the evidence. */
export function checkPrd(text: string, t: Theme, items: Item[]): PrdCheck[] {
  const allowed = new Set(t.itemIds);
  const cited = [...text.matchAll(/\bF-(\d{2,})\b/g)].map((m) => parseInt(m[1], 10));
  const unknownIds = cited.filter((n) => !allowed.has(n));
  const evidenceText = items.filter((i) => allowed.has(i.id)).map((i) => i.text + " " + i.customer).join(" ") + ` ${arrOf(t, items)} ` + items.filter((i) => allowed.has(i.id)).map((i) => i.arr).join(" ");
  const money = [...text.matchAll(/\$\s?(\d+(?:\.\d+)?)\s?(k|m)?/gi)].map((m) => m[1]);
  const invented = money.filter((n) => !new RegExp("\\b" + n.replace(".", "\\.") + "\\b").test(evidenceText));
  const customers = items.filter((i) => allowed.has(i.id)).map((i) => i.customer.toLowerCase());
  return [
    { label: "Cites at least one feedback item", ok: cited.length > 0 },
    { label: "Only cites items from this theme", ok: unknownIds.length === 0 },
    { label: "No dollar figures outside the evidence", ok: invented.length === 0 },
    { label: "Names the customers it relies on", ok: customers.some((c) => text.toLowerCase().includes(c)) },
  ];
}

/** Minimal Markdown to HTML for display. Escapes first, so model output can never inject markup. */
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out: string[] = [];
  let list = false;
  for (const raw of md.split("\n")) {
    const l = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(l)) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + inline(l.replace(/^\s*[-*]\s+/, "")) + "</li>"); continue; }
    if (list) { out.push("</ul>"); list = false; }
    if (/^#\s+/.test(l)) out.push("<h2>" + inline(l.replace(/^#\s+/, "")) + "</h2>");
    else if (/^#{2,3}\s+/.test(l)) out.push("<h3>" + inline(l.replace(/^#{2,3}\s+/, "")) + "</h3>");
    else if (l.trim()) out.push("<p>" + inline(l) + "</p>");
  }
  if (list) out.push("</ul>");
  return out.join("");
}
