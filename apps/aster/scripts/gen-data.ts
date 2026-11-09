import { generateWorld } from "../src/lib/data/generator";

// Quick sanity dump of the synthetic world.
const world = generateWorld(42);
console.log(`Users: ${world.users.length}`);
console.log(`Transactions: ${world.txns.length}`);
const byUser = world.txns.reduce<Record<string, number>>((acc, t) => {
  acc[t.userId] = (acc[t.userId] ?? 0) + 1;
  return acc;
}, {});
console.log("Txns per user (first 3):", Object.entries(byUser).slice(0, 3));
const u01 = world.txns.filter((t) => t.userId === "u01");
console.log("u01 duplicates present:", u01.filter((t) => t.id.includes("dup")).length);
console.log("u01 failed-debit present:", u01.filter((t) => t.id.includes("faildebit")).length);
console.log("u01 injection row present:", u01.filter((t) => t.id.includes("inject")).length);
