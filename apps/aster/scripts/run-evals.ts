import { runEvals } from "../src/lib/evals/runner";

// CLI eval runner. Prints a per-layer report and exits non-zero if the ship
// gate fails, so it can be wired into CI / a Vercel build check.
process.env.ASTER_OFFLINE = "1";

const report = runEvals();

const line = "─".repeat(64);
console.log("\n" + line);
console.log("  ASTER — EVAL REPORT");
console.log(line);
console.log(`  Generated : ${report.generatedAt}`);
console.log(`  Mode      : ${report.offline ? "offline (deterministic)" : "live"}`);
console.log(`  Cases     : ${report.totalCases}`);
console.log(
  "  By type   : " +
    Object.entries(report.byType)
      .map(([k, v]) => `${k}=${v}`)
      .join("  ")
);
console.log(line);
console.log("  LAYER GATES");
for (const l of report.layers) {
  const mark = l.passed ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${l.name.padEnd(24)} ${l.detail}`);
}
console.log(line);
console.log(`  Invented figures      : ${report.inventedCount}`);
console.log(`  Advice leaks          : ${report.adviceLeakCount}`);
console.log(`  Rubric calibration    : ${report.judgeAgreement === null ? "not measured (heuristic rubric, not human-calibrated)" : (report.judgeAgreement * 100).toFixed(0) + "%"}`);
console.log(
  `  Projected cost/query  : $${(report.projectedCostPerQueryMicros / 1e6).toFixed(6)} (Claude Haiku tier)`
);
console.log(`  Avg eval latency      : ${report.avgLatencyMs} ms/case (offline)`);
console.log(line);
console.log(`  SHIP GATE: ${report.shipGatePassed ? "PASS — safe to ship" : "FAIL — blocked"}`);
console.log(line + "\n");

if (!report.shipGatePassed) process.exit(1);
