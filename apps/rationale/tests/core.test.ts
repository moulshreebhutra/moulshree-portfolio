import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByRules } from "../lib/cluster";
import { parseArr, parseFeedback, parseCsv } from "../lib/csv";
import { checkPrd, mdToHtml, templatePrd } from "../lib/prd";
import { redact } from "../lib/redact";
import { SAMPLE_ITEMS, SAMPLE_THEMES } from "../lib/sample";
import { arrOf, ranked, score } from "../lib/score";
import { ItemsSchema, normalizeThemes } from "../lib/validate";
import { extractJson } from "../lib/ai";

test("score is ARR x confidence / effort and ranks the security gates first", () => {
  const r = ranked(SAMPLE_THEMES, SAMPLE_ITEMS);
  assert.equal(r[0].id, "t1");
  assert.equal(arrOf(r[0], SAMPLE_ITEMS), 366);
  assert.equal(Math.round(score(r[0], SAMPLE_ITEMS)), 82);
  assert.equal(r[r.length - 1].id, "t6");
});

test("rules grouping puts the SSO and audit items together and keeps every item once", () => {
  const themes = groupByRules(SAMPLE_ITEMS);
  const all = themes.flatMap((t) => t.itemIds).sort((a, b) => a - b);
  assert.deepEqual(all, SAMPLE_ITEMS.map((i) => i.id));
  const sec = themes.find((t) => t.itemIds.includes(3));
  assert.ok(sec && sec.itemIds.includes(10), "SAML items share a theme");
  assert.ok(themes.length >= 3 && themes.length <= 8);
});

test("csv and line parsing", () => {
  const csv = 'customer,tier,arr,text\n"Acme, Inc",enterprise,$84k,"Needs ""SSO"" now"\nZed,smb,5,Pricing is unclear';
  const r = parseFeedback(csv);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].customer, "Acme, Inc");
  assert.equal(r.items[0].tier, "Enterprise");
  assert.equal(r.items[0].arr, 84);
  assert.equal(r.items[0].text, 'Needs "SSO" now');
  const lines = parseFeedback("Kiln | SMB | 6k | Search misses clauses\njust a plain line of feedback");
  assert.equal(lines.items[0].arr, 6);
  assert.equal(lines.items[1].customer, "Unknown");
  assert.equal(parseCsv("a,b\n1,2").length, 2);
  assert.equal(parseArr("1.2m"), 1200);
  assert.equal(parseArr("84,000"), 84);
  assert.equal(parseArr("junk"), 0);
});

test("model output is normalised: bad ids dropped, duplicates removed, numbers clamped", () => {
  const raw = [
    { title: "A", itemIds: [3, 3, 999, 6], effort: 9, confidence: 7, severity: "weird", blocksRevenue: 1 },
    { title: "B", itemIds: [3, 4], effort: 0 },
    { title: "", itemIds: [1] },
    { title: "C", itemIds: [999] },
  ];
  const out = normalizeThemes(raw, SAMPLE_ITEMS);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].itemIds, [3, 6]);
  assert.deepEqual(out[1].itemIds, [4]);
  assert.equal(out[0].effort, 5);
  assert.equal(out[0].confidence, 1);
  assert.equal(out[0].severity, "medium");
  assert.throws(() => normalizeThemes([], SAMPLE_ITEMS));
  assert.throws(() => normalizeThemes("nope", SAMPLE_ITEMS));
});

test("PRD checks catch invented ids and invented money", () => {
  const t = SAMPLE_THEMES[0];
  const good = templatePrd(t, SAMPLE_ITEMS);
  assert.ok(checkPrd(good, t, SAMPLE_ITEMS).every((c) => c.ok), JSON.stringify(checkPrd(good, t, SAMPLE_ITEMS)));
  const bad = good + "\n- F-01 also wants this, worth $999k";
  const c = checkPrd(bad, t, SAMPLE_ITEMS);
  assert.equal(c.find((x) => x.label.startsWith("Only cites"))!.ok, false);
  assert.equal(c.find((x) => x.label.startsWith("No dollar"))!.ok, false);
});

test("markdown rendering escapes markup", () => {
  assert.ok(!mdToHtml("# <img src=x onerror=1>").includes("<img"));
  assert.ok(mdToHtml("- **bold** item").includes("<li><b>bold</b> item</li>"));
});

test("redaction and input limits", () => {
  assert.equal(redact("mail a@b.com or call +91 98765 43210 see https://x.io/p"), "mail [email] or call [phone] see [link]");
  assert.ok(ItemsSchema.safeParse(SAMPLE_ITEMS).success);
  assert.ok(!ItemsSchema.safeParse([]).success);
  assert.ok(!ItemsSchema.safeParse([{ ...SAMPLE_ITEMS[0], arr: -1 }]).success);
  assert.ok(!ItemsSchema.safeParse([{ ...SAMPLE_ITEMS[0], text: "x".repeat(601) }]).success);
});

test("json extraction tolerates fences and chatter", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n[{"a":1}]\n```\nDone'), [{ "a": 1 }]);
  assert.throws(() => extractJson("no json here"));
});
