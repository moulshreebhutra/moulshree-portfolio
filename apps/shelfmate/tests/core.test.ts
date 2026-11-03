import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../lib/catalog";
import { BY_ID, bundleDiscount, checksFor, rulesRoutine, stepsFor, sum, validBundle, validateAi, type Answers } from "../lib/shop";
import { bucketOf, summarize, whatIf, type Sess } from "../lib/stats";
import { extractJson } from "../lib/ai";

const A: Answers = { skin: "oily", concern: "breakouts", size: "4", budget: "2500", free: "" };

test("rules routine: one catalog product per step, inside budget, all checks pass", () => {
  const r = rulesRoutine(A, false);
  assert.deepEqual(r.picks.map((p) => BY_ID.get(p.id)!.step), stepsFor("4"));
  assert.ok(sum(r.picks) <= 2500);
  assert.ok(checksFor(r, A).every((c) => c.ok));
});

test("tight budget swaps to cheaper products, sensitive skin and risk notes force gentle products", () => {
  const cheap = rulesRoutine({ ...A, size: "3", budget: "1500" }, false);
  assert.ok(sum(cheap.picks) <= 1500, String(sum(cheap.picks)));
  const sens = rulesRoutine({ ...A, skin: "sensitive" }, false);
  assert.ok(sens.picks.every((p) => BY_ID.get(p.id)!.gentle));
  const risky = rulesRoutine(A, true);
  assert.ok(risky.picks.every((p) => BY_ID.get(p.id)!.gentle));
});

test("every skin x concern x size x budget combination yields a passing routine", () => {
  for (const skin of ["oily", "dry", "combination", "sensitive"]) for (const concern of ["breakouts", "dullness", "dryness", "lines", "redness"]) for (const size of ["3", "4"] as const) for (const budget of ["1500", "2500", "0"]) {
    const a = { skin, concern, size, budget, free: "" }; const r = rulesRoutine(a, false);
    const bad = checksFor(r, a).filter((c) => !c.ok);
    // the only impossible case is a 4-step routine under 1,500 rupees, and the routine must say so
    if (size === "4" && budget === "1500") { assert.ok(bad.length === 1 && /budget/i.test(r.summary), JSON.stringify(a)); continue; }
    assert.equal(bad.length, 0, JSON.stringify(a) + JSON.stringify(bad));
  }
});

test("AI answers are validated: non-catalog ids, missing steps, unsafe or over-budget picks are rejected", () => {
  const ok = { routine: [{ productId: "c2", reason: "x" }, { productId: "t1", reason: "x" }, { productId: "m2", reason: "x" }, { productId: "s1", reason: "x" }], summary: "s" };
  assert.equal(validateAi(ok, A, false, "claude").picks.length, 4);
  assert.throws(() => validateAi({ routine: ok.routine.slice(0, 3) }, A, false, "claude"));
  assert.throws(() => validateAi({ routine: [{ productId: "zz" }] }, A, false, "claude"));
  assert.throws(() => validateAi(ok, { ...A, skin: "sensitive" }, false, "gemini"), /failed checks/);
  assert.throws(() => validateAi(ok, { ...A, budget: "1500" }, false, "claude"), /failed checks/);
  assert.throws(() => validateAi(null, A, false, "claude"));
});

test("bundle pricing and validity", () => {
  const ids = ["c1", "t1", "m1", "s1"];
  assert.ok(validBundle(ids));
  assert.ok(!validBundle(["c1", "c2", "m1", "s1"]), "two cleansers");
  assert.ok(!validBundle(["c1", "m1"]));
  assert.ok(!validBundle(["nope", "t1", "m1", "s1"]));
  const d = bundleDiscount(ids.map((id) => ({ id })), 10);
  assert.equal(d.raw, 399 + 599 + 549 + 499);
  assert.equal(d.final, d.raw - Math.round(d.raw * 0.1));
  assert.equal(bundleDiscount([{ id: "c1" }], 20).off, 0);
});

test("dashboard maths from sessions", () => {
  const ids = ["c1", "t1", "m1", "s1"];
  const raw = bundleDiscount(ids.map((id) => ({ id })), 10);
  const now = Date.now();
  const S: Sess[] = [
    { sid: "a", ts: now, swaps: [] },
    { sid: "b", ts: now, started: true, swaps: [] },
    { sid: "c", ts: now, started: true, finished: true, routine: { picks: ids.map((id) => ({ id, reason: "" })), source: "rules", risk: false }, swaps: [{ from: "t1", to: "t2" }], carted: "bundle", free: "fragrance-free please", purchased: { orderId: "SM1", total: raw.final, raw: raw.raw, bundle: true, ids, discountPct: 10 } },
    { sid: "d", ts: now, started: true, finished: true, routine: { picks: [], source: "rules", risk: false }, swaps: [], free: "I am pregnant" },
  ];
  const st = summarize(S, 10);
  assert.equal(st.n, 4); assert.equal(st.orders, 1); assert.equal(st.conv, 0.25);
  assert.equal(st.aov, raw.final); assert.equal(st.bundleShare, 1);
  assert.deepEqual(st.funnel.map((f) => f[1]), [4, 3, 2, 2, 1, 1]);
  assert.equal(st.swaps[0].id, "t1"); assert.equal(st.swaps[0].share, 0.5);
  assert.equal(st.asks.length, 2);
  // what-if: a deeper discount lowers revenue and bundle margin, a shallower one raises them
  const w0 = whatIf(S, 0), w10 = whatIf(S, 10), w30 = whatIf(S, 30);
  assert.ok(w0.revPerSession > w10.revPerSession && w10.revPerSession > w30.revPerSession);
  assert.ok(w0.bundleMargin! > w30.bundleMargin!);
  assert.ok(Math.abs(w10.revPerSession - st.revPerSession) < 1e-9);
  assert.equal(bucketOf("no fragrance please"), "Fragrance-free");
  assert.equal(bucketOf("zzz"), "Something else");
});

test("catalog sanity", () => {
  assert.ok(new Set(CATALOG.map((p) => p.id)).size === CATALOG.length);
  for (const step of ["Cleanse", "Treat", "Moisturize", "Protect"]) assert.ok(CATALOG.filter((p) => p.step === step).length >= 2, step);
  assert.deepEqual(extractJson('x {"a":1} y'), { a: 1 });
});
