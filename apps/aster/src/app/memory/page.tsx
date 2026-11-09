"use client";

import { useEffect, useState } from "react";

interface Fact {
  id: string;
  kind: string;
  text: string;
  goal?: { name: string; targetPaise: number; byDate: string };
  sourceMessage: string;
  createdAt: string;
}
interface UserOpt {
  id: string;
  name: string;
  persona: string;
}

export default function MemoryPage() {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [userId, setUserId] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]);

  async function load(uid: string) {
    const res = await fetch(`/api/memory?userId=${uid}`);
    const d = await res.json();
    setFacts(d.facts);
  }

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users);
        const first = d.users[0]?.id ?? "";
        setUserId(first);
        if (first) load(first);
      });
  }, []);

  async function del(id: string) {
    await fetch(`/api/memory?userId=${userId}&id=${id}`, { method: "DELETE" });
    load(userId);
  }
  async function clearAll() {
    if (!confirm("Delete everything Aster remembers for this user?")) return;
    await fetch(`/api/memory?userId=${userId}&id=*`, { method: "DELETE" });
    load(userId);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-fg">What Aster remembers</h1>
          <p className="text-mut text-sm mt-1">
            Only explicit corrections and goals you told Aster. Everything is viewable and deletable — nothing is used
            to train models.
          </p>
        </div>
        <select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            load(e.target.value);
          }}
          className="bg-panel2 rounded-lg px-3 py-2 text-sm outline-none"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {facts.length === 0 ? (
        <div className="card p-6 text-mut text-sm">
          Nothing stored yet. On the <a href="/" className="text-aster2 hover:underline">Ask</a> tab, tell Aster a goal
          (&ldquo;I want to save for a ₹60,000 trip by March&rdquo;) or a correction (&ldquo;that Flipkart charge was
          reimbursed&rdquo;) and it will appear here.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {facts.map((f) => (
              <div key={f.id} className="card p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        f.kind === "goal" ? "border-aster/40 text-aster2 bg-aster/10" : "border-good/40 text-good bg-good/10"
                      }`}
                    >
                      {f.kind}
                    </span>
                    {f.goal && (
                      <span className="text-xs text-mut">
                        {f.goal.name} · ₹{(f.goal.targetPaise / 100).toLocaleString("en-IN")} by {f.goal.byDate}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-100 mt-1.5">{f.text}</div>
                  <div className="text-[11px] text-mut mt-1">
                    captured {new Date(f.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
                <button
                  onClick={() => del(f.id)}
                  className="text-xs text-mut hover:text-bad border border-line rounded-lg px-2.5 py-1 transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <button onClick={clearAll} className="text-sm text-bad hover:underline">
            Delete everything
          </button>
        </>
      )}
    </div>
  );
}
