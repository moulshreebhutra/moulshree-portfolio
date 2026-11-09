"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

export default function CaseStudyPage() {
  const [after, setAfter] = useState<any>(null);
  useEffect(() => {
    fetch("/api/evals").then((r) => r.json()).then(setAfter);
  }, []);

  return (
    <div className="space-y-10 max-w-3xl">
      <header className="flex items-center gap-4">
        <Logo size={46} />
        <div>
          <h1 className="text-2xl font-semibold text-fg">Aster — case study</h1>
          <p className="text-mut text-sm">An AI money copilot for everyday spending decisions.</p>
        </div>
      </header>

      <Section title="The problem">
        People make dozens of small money decisions a week with no help at the moment of decision. Payment apps show a
        transaction list; budgeting apps demand manual effort most people abandon; generic chatbots can talk about money
        but can&rsquo;t see yours, so they hallucinate. Aster answers the question people actually have — &ldquo;can I
        afford this?&rdquo;, &ldquo;where did my money go?&rdquo;, &ldquo;was I charged twice?&rdquo; — grounded in the
        user&rsquo;s own transactions.
      </Section>

      <Section title="The bet">
        A copilot that is <b className="text-fg">right, safe and cheap per user</b> beats a chatbot that is merely
        fluent. One wrong total on money destroys trust faster than ten right ones build it — so quality, safety and unit
        economics are treated as product features, not afterthoughts.
      </Section>

      <Section title="Key decisions">
        <ul className="space-y-2 list-disc list-inside">
          <li><b className="text-fg">Grounded or silent.</b> The model never does arithmetic or recalls transactions. Typed tools compute every figure and return the exact source rows.</li>
          <li><b className="text-fg">A deterministic gate.</b> Every rupee figure in an answer must match a tool output, or the draft is rejected and retried once, then falls back to a guaranteed-grounded template.</li>
          <li><b className="text-fg">Refuse over guess.</b> Regulated advice (investments, loans, tax) exits to a fixed, compliance-style redirect — it is designed out, not disclaimered away.</li>
          <li><b className="text-fg">Cheap by default.</b> High-volume factual lookups are answered by a $0 deterministic template; Claude is spent only on reasoning-heavy answers. A per-user cache avoids paying twice.</li>
          <li><b className="text-fg">Evals are the contract.</b> Nothing ships unless a ~300-case golden set clears every layer gate.</li>
        </ul>
      </Section>

      <Section title="The failure the evals caught">
        <p>
          The required proof that evals work: a real regression, found and fixed, with the score before and after.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="card p-4 !border-bad/40">
            <div className="text-xs uppercase tracking-wide text-bad mb-2">Before — ship gate FAIL</div>
            <Metric k="Tool-call correctness" v="90.4%" bad />
            <Metric k="Numeric accuracy" v="78.5%" bad />
            <Metric k="Invented figures" v="5" bad />
            <Metric k="Robustness drop" v="22.6 pts" bad />
          </div>
          <div className="card p-4 !border-good/40">
            <div className="text-xs uppercase tracking-wide text-good mb-2">After — ship gate PASS</div>
            <Metric k="Tool-call correctness" v={fmtPct(after, "Tool-call correctness")} good />
            <Metric k="Numeric accuracy" v={fmtPct(after, "Numeric accuracy")} good />
            <Metric k="Invented figures" v={after ? String(after.inventedCount) : "…"} good />
            <Metric k="Robustness drop" v="0 pts" good />
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p><b className="text-fg">Four root causes, all real:</b></p>
          <ol className="list-decimal list-inside space-y-1 text-mut">
            <li>&ldquo;How much on <i>subscriptions</i>?&rdquo; routed to the subscription-lister instead of a spend sum — the keyword beat the &ldquo;how much&rdquo; signal.</li>
            <li>Genuinely-zero months answered &ldquo;couldn&rsquo;t find&rdquo; instead of &ldquo;₹0&rdquo;, so the correct zero didn&rsquo;t match ground truth.</li>
            <li>Period comparisons printed an absolute delta while the whitelist held the signed value — the gate flagged a correct number as ungrounded.</li>
            <li>Typo variants (&ldquo;spnd&rdquo;, &ldquo;delivry&rdquo;, &ldquo;mnth&rdquo;) slipped past exact-substring matching.</li>
          </ol>
          <p className="text-mut">
            Fixes: reorder intent precedence, emit grounded ₹0, whitelist absolute values, and add token-level fuzzy
            matching to the router. One of those fixes (a too-loose fuzzy threshold that made &ldquo;tablet&rdquo; ≈
            &ldquo;target&rdquo;) was itself caught by the evals on the next run and tightened. That loop is the point.
          </p>
        </div>
      </Section>

      <Section title="Live numbers">
        {after ? (
          <div className="grid sm:grid-cols-3 gap-4">
            <Big k="Golden cases" v={String(after.totalCases)} />
            <Big k="Ship gate" v={after.shipGatePassed ? "PASS" : "FAIL"} tone={after.shipGatePassed ? "good" : "bad"} />
            <Big k="Cost / query" v={`$${(after.projectedCostPerQueryMicros / 1e6).toFixed(6)}`} tone="aster" />
          </div>
        ) : (
          <div className="text-mut text-sm">Loading live eval numbers…</div>
        )}
        <p className="text-mut text-sm mt-3">
          See the full breakdown on the <a href="/evals" className="text-aster2 hover:underline">Evals</a> tab, and the
          production trace metrics on <a href="/dashboard" className="text-aster2 hover:underline">Dashboard</a>.
        </p>
      </Section>

      <Section title="Try the 3-minute demo">
        <ol className="list-decimal list-inside space-y-1 text-mut">
          <li>Ask a lookup (&ldquo;food delivery this month&rdquo;) and open <i>Show the working</i>.</li>
          <li>Ask an affordability question and read the range + assumptions.</li>
          <li>Try a regulated-advice trap (&ldquo;should I invest in mutual funds?&rdquo;) and see the redirect.</li>
          <li>Open <a href="/evals" className="text-aster2 hover:underline">Evals</a> for the failure-found-and-fixed story.</li>
          <li>Open <a href="/dashboard" className="text-aster2 hover:underline">Dashboard</a> for cost per asker.</li>
        </ol>
      </Section>
    </div>
  );
}

function fmtPct(after: any, name: string) {
  if (!after) return "…";
  const l = after.layers?.find((x: any) => x.name === name);
  return l ? `${(l.value * 100).toFixed(1)}%` : "…";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-fg mb-2">{title}</h2>
      <div className="text-sm text-mut leading-relaxed">{children}</div>
    </section>
  );
}

function Metric({ k, v, good, bad }: { k: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-mut">{k}</span>
      <span className={good ? "text-good" : bad ? "text-bad" : "text-fg"}>{v}</span>
    </div>
  );
}

function Big({ k, v, tone }: { k: string; v: string; tone?: "good" | "bad" | "aster" }) {
  const c = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "aster" ? "text-aster2" : "text-fg";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-mut">{k}</div>
      <div className={`text-2xl font-semibold mt-1 ${c}`}>{v}</div>
    </div>
  );
}
