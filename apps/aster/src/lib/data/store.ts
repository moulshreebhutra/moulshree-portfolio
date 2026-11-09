import fs from "fs";
import path from "path";
import { generateWorld, GeneratedWorld } from "./generator";
import { MemoryFact, Trace, Transaction, UserProfile } from "./types";

// ---------------------------------------------------------------------------
// In-memory world (deterministic) + JSON-persisted traces & memory facts.
//
// For the prototype this avoids a native DB build. The README documents how to
// swap this layer for Postgres/SQLite on Vercel without touching the agent,
// tools or eval code (they only depend on the exported accessor functions).
// ---------------------------------------------------------------------------

// Vercel's deployment filesystem is read-only; /tmp is writable but per-instance and
// ephemeral. Traces/memory therefore survive only for the life of a warm instance on
// Vercel. Use a real database (Postgres/KV) for durable history.
const DATA_DIR = process.env.VERCEL ? "/tmp/aster-data" : path.join(process.cwd(), ".data");
const TRACES_FILE = path.join(DATA_DIR, "traces.json");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

interface PersistShape {
  traces: Trace[];
  memory: MemoryFact[];
}

// Use a global singleton so Next.js hot-reload / route modules share one world.
declare global {
  // eslint-disable-next-line no-var
  var __ASTER_STORE__: AsterStore | undefined;
}

class AsterStore {
  world: GeneratedWorld;
  traces: Trace[] = [];
  memory: MemoryFact[] = [];

  constructor() {
    this.world = generateWorld(42);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(TRACES_FILE)) {
        const raw = JSON.parse(fs.readFileSync(TRACES_FILE, "utf8")) as PersistShape["traces"];
        this.traces = raw;
      }
      if (fs.existsSync(MEMORY_FILE)) {
        this.memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")) as MemoryFact[];
      }
    } catch {
      // Corrupt/partial files are non-fatal for a prototype.
      this.traces = this.traces || [];
      this.memory = this.memory || [];
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(TRACES_FILE, JSON.stringify(this.traces.slice(-2000), null, 0));
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 0));
    } catch {
      // On Vercel's read-only FS this is a no-op; traces still live in memory
      // for the lifetime of the serverless instance.
    }
  }

  // ---- Users ----
  users(): UserProfile[] {
    return this.world.users;
  }
  user(userId: string): UserProfile | undefined {
    return this.world.users.find((u) => u.id === userId);
  }
  defaultUserId(): string {
    return this.world.users[0]?.id ?? "u01";
  }

  // ---- Transactions (scoped per user — no cross-user access) ----
  txnsForUser(userId: string): Transaction[] {
    return this.world.txns.filter((t) => t.userId === userId);
  }
  txnById(userId: string, id: string): Transaction | undefined {
    return this.world.txns.find((t) => t.userId === userId && t.id === id);
  }

  // ---- Traces ----
  addTrace(t: Trace) {
    this.traces.push(t);
    this.persist();
  }
  getTrace(id: string): Trace | undefined {
    return this.traces.find((t) => t.id === id);
  }
  recordFeedback(id: string, vote: "up" | "down", reason?: string): boolean {
    const t = this.getTrace(id);
    if (!t) return false;
    t.feedback = { vote, reason, at: new Date().toISOString() };
    this.persist();
    return true;
  }
  tracesForUser(userId: string): Trace[] {
    return this.traces.filter((t) => t.userId === userId);
  }
  allTraces(): Trace[] {
    return this.traces;
  }

  // ---- Memory facts ----
  memoryForUser(userId: string): MemoryFact[] {
    return this.memory.filter((m) => m.userId === userId);
  }
  addMemory(fact: MemoryFact) {
    this.memory.push(fact);
    this.persist();
  }
  deleteMemory(userId: string, id: string): boolean {
    const before = this.memory.length;
    this.memory = this.memory.filter((m) => !(m.userId === userId && m.id === id));
    this.persist();
    return this.memory.length < before;
  }
  clearMemory(userId: string) {
    this.memory = this.memory.filter((m) => m.userId !== userId);
    this.persist();
  }
}

export function store(): AsterStore {
  if (!global.__ASTER_STORE__) {
    global.__ASTER_STORE__ = new AsterStore();
  }
  return global.__ASTER_STORE__;
}

export type { AsterStore };
