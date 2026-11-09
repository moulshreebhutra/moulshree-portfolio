"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";

interface Txn {
  id: string;
  ts: string;
  amountPaise: number;
  direction: "debit" | "credit";
  merchant: string;
  category: string;
  method: string;
  status: string;
}
interface Trace {
  id: string;
  question: string;
  language: string;
  router: { intent: string; risk: string; needsLargeModel: boolean; confidence: number };
  modelTier: string;
  composerProvider: string;
  gate: { passed: boolean; retried: boolean; violations: string[] };
  answer: string;
  sources: string[];
  costMicros: number;
  latencyMs: number;
}
interface Msg {
  role: "user" | "aster";
  text: string;
  trace?: Trace;
  sources?: Txn[];
}
interface UserOpt {
  id: string;
  name: string;
  persona: string;
  city: string;
  monthlyIncome: string;
}

const SUGGESTIONS = [
  "How much did I spend on food delivery this month?",
  "Can I afford a ₹40,000 phone this month?",
  "Was I charged twice for anything recently?",
  "How many subscriptions do I have?",
  "Did I spend more on shopping this month vs last month?",
  "Should I invest my savings in mutual funds?",
];

function rupee(paise: number) {
  const r = Math.round(paise) / 100;
  return "₹" + r.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const INTENT_LABEL: Record<string, string> = {
  factual_lookup: "Lookup",
  period_comparison: "Comparison",
  affordability: "Affordability",
  leakage_detection: "Leakage",
  goal_planning: "Goal",
  correction: "Correction",
  regulated_advice: "Safe redirect",
  ambiguous: "Clarify",
  smalltalk: "Chat",
};

export default function ChatPage() {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users);
        setUserId(d.users[0]?.id ?? "");
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || loading || !userId) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, question }),
      });
      const data = await res.json();
      if (data.error) {
        setMsgs((m) => [...m, { role: "aster", text: "Something went wrong: " + data.error }]);
      } else {
        setMsgs((m) => [...m, { role: "aster", text: data.trace.answer, trace: data.trace, sources: data.sources }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "aster", text: "Network error." }]);
    } finally {
      setLoading(false);
    }
  }

  async function vote(traceId: string, v: "up" | "down") {
    let reason: string | undefined;
    if (v === "down") reason = prompt("What was wrong? (optional)") ?? undefined;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ traceId, vote: v, reason }),
    });
    setMsgs((m) =>
      m.map((x) => (x.trace?.id === traceId ? { ...x, voted: v } as any : x))
    );
  }

  const current = users.find((u) => u.id === userId);

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      {/* Chat column */}
      <div className="card flex flex-col h-[76vh] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
          {msgs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center rise">
              <Logo size={54} />
              <h1 className="mt-4 text-2xl font-semibold text-fg">Ask your money anything.</h1>
              <p className="mt-2 text-mut max-w-md">
                Every number comes from your own transactions. Tap{" "}
                <span className="text-aster2">Show the working</span> on any answer to see the exact rows behind it.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="pill px-3.5 py-2 text-sm text-mut hover:text-fg hover:bg-aster/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <MessageBubble
              key={i}
              m={m}
              open={!!open[m.trace?.id ?? ""]}
              onToggle={() => m.trace && setOpen((o) => ({ ...o, [m.trace!.id]: !o[m.trace!.id] }))}
              onVote={vote}
            />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-mut text-sm rise">
              <Logo size={22} />
              <span className="typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about your spending…"
              className="flex-1 bg-panel2 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-aster/40 placeholder:text-mut"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-3 rounded-xl bg-aster text-white text-sm font-medium disabled:opacity-40 hover:bg-aster2 transition"
            >
              Ask
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-[11px] text-mut hover:text-aster2 border border-line rounded-full px-2.5 py-1 hover:border-aster/40 transition"
              >
                {s.length > 42 ? s.slice(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context sidebar */}
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-mut mb-2">Demo user</div>
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setMsgs([]);
            }}
            className="w-full bg-panel2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-aster/40"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.persona}
              </option>
            ))}
          </select>
          {current && (
            <div className="mt-3 space-y-1.5 text-sm">
              <Row k="City" v={current.city} />
              <Row k="Persona" v={current.persona} />
              <Row k="Monthly income" v={current.monthlyIncome} />
            </div>
          )}
        </div>

        <div className="card p-4 text-sm text-mut leading-relaxed">
          <div className="text-xs uppercase tracking-wide text-mut mb-2">How Aster answers</div>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>Router reads intent &amp; risk</li>
            <li>Tools compute from your rows</li>
            <li>Composer writes the answer</li>
            <li>Gate checks every figure</li>
            <li>Trace logged for evals</li>
          </ol>
          <p className="mt-3 text-xs">
            Regulated advice is redirected, never answered. Numbers are computed, never guessed.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-mut">{k}</span>
      <span className="text-fg text-right">{v}</span>
    </div>
  );
}

function MessageBubble({
  m,
  open,
  onToggle,
  onVote,
}: {
  m: Msg & { voted?: string };
  open: boolean;
  onToggle: () => void;
  onVote: (id: string, v: "up" | "down") => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end rise">
        <div className="max-w-[80%] bg-aster/15 border border-aster/30 rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-fg">
          {m.text}
        </div>
      </div>
    );
  }
  const t = m.trace;
  const redirect = t?.router.risk === "regulated_advice";
  return (
    <div className="flex gap-3 rise">
      <div className="shrink-0 mt-1">
        <Logo size={26} />
      </div>
      <div className="max-w-[88%] space-y-2">
        <div
          className={`rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border ${
            redirect ? "bg-warn/10 border-warn/30 text-amber-100" : "bg-panel2 border-line text-slate-100"
          }`}
        >
          {m.text}
        </div>

        {t && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Badge tone="aster">{INTENT_LABEL[t.router.intent] ?? t.router.intent}</Badge>
            <Badge tone={t.gate.passed ? "good" : "bad"}>
              {t.gate.passed ? "✓ grounded" : "gate blocked"}
            </Badge>
            <Badge tone="mut">
              {t.composerProvider === "cache"
                ? "cached · $0"
                : t.modelTier === "none"
                ? "template · $0"
                : `${t.composerProvider} · ${t.modelTier}`}
            </Badge>
            {t.costMicros > 0 && <Badge tone="mut">${(t.costMicros / 1e6).toFixed(5)}</Badge>}
            <Badge tone="mut">{t.latencyMs}ms</Badge>
            {t.gate.retried && <Badge tone="warn">retried</Badge>}
            {m.sources && m.sources.length > 0 && (
              <button onClick={onToggle} className="text-aster2 hover:underline ml-1">
                {open ? "Hide working" : `Show the working (${m.sources.length})`}
              </button>
            )}
            <span className="ml-auto flex gap-1">
              <button
                onClick={() => t && onVote(t.id, "up")}
                className={`px-1.5 rounded hover:bg-fg/10 ${m.voted === "up" ? "text-good" : "text-mut"}`}
                title="Helpful"
              >
                ▲
              </button>
              <button
                onClick={() => t && onVote(t.id, "down")}
                className={`px-1.5 rounded hover:bg-fg/10 ${m.voted === "down" ? "text-bad" : "text-mut"}`}
                title="Not helpful"
              >
                ▼
              </button>
            </span>
          </div>
        )}

        {open && m.sources && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="text-mut bg-fg/5">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Merchant</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {m.sources.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-3 py-1.5 text-mut">{new Date(s.ts).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-1.5 text-fg">{s.merchant}</td>
                    <td className="px-3 py-1.5 text-mut">{s.category.replace(/_/g, " ")}</td>
                    <td className={`px-3 py-1.5 text-right ${s.direction === "credit" ? "text-good" : "text-fg"}`}>
                      {s.direction === "credit" ? "+" : ""}
                      {rupee(s.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "aster" | "good" | "bad" | "warn" | "mut" }) {
  const map = {
    aster: "bg-aster/15 text-aster2 border-aster/30",
    good: "bg-good/15 text-good border-good/30",
    bad: "bg-bad/15 text-bad border-bad/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    mut: "bg-fg/5 text-mut border-line",
  }[tone];
  return <span className={`px-2 py-0.5 rounded-full border ${map}`}>{children}</span>;
}
