<div align="center">

# ✳︎ Aster

**An AI money copilot that answers questions about your own spending — grounded in tools, scored by evals, guarded for safety.**

*Ask your money anything. See exactly why.*

</div>

---

Aster is a consumer-scale AI product that answers the questions people actually have about money — *"Can I afford this?"*, *"Where did my money go?"*, *"Why was I charged twice?"* — over a user's own transactions. **Every number comes from a tool call, never the model's memory**, and **every answer is checked by an automated gate and scored by a ~300-case eval suite before it ships.**

This repo is a working prototype on synthetic data. It proves the hard parts: grounding, the safety gate, the eval harness, trace logging, and cost-per-user tracking.

## Why it's built this way

| Principle | How it shows up in the code |
|---|---|
| **Grounded or silent** | The model never does arithmetic. Typed tools (`src/lib/tools`) compute every figure and return the exact source rows. |
| **A deterministic gate** | `src/lib/agent/gate.ts` rejects any answer containing a rupee figure not found in a tool output, and any regulated-advice leak. One retry, then a guaranteed-grounded template. |
| **Refuse over guess** | Investment / loan / tax questions exit to a fixed redirect (`REGULATED_REDIRECT`) — designed out, not disclaimered. |
| **Cheap by default** | Highest-volume factual lookups are answered by a $0 deterministic template; Claude is spent only on reasoning-heavy answers. A per-user cache avoids paying twice. See *Judicious AI use* below. |
| **Evals are the contract** | `npm run evals` runs the golden set with a hard gate per layer. Nothing ships unless all gates pass. |

## Architecture

```
question
  │
  ▼
router ──(regulated advice)──► safe redirect
  │                               (no model, no tools)
  ├─ intent + risk + language + slots   src/lib/agent/router.ts   [deterministic, fuzzy, $0]
  ▼
tool plan ──► tools compute + return source rows   src/lib/tools/index.ts
  ▼
composer ──► writes answer from TOOL FACTS only    src/lib/agent/composer.ts
  │            (template for lookups = $0 · Claude for reasoning)
  ▼
gate ──► every ₹ figure must match a tool output   src/lib/agent/gate.ts
  │        fail → 1 retry → guaranteed-grounded template
  ▼
trace logged ──► feeds dashboard AND evals (one source of truth)
```

## Tech stack

- **Next.js 14 (App Router) + React 18 + TypeScript + Tailwind** — UI and API routes in one deployable.
- **Claude (Anthropic)** as the primary composer model, with an **OpenAI fallback** and a **deterministic offline provider** (`src/lib/agent/llm.ts`). The offline provider is why the whole app, the evals, and the demo run reproducibly with **zero API keys**.
- **Vercel** for hosting (free/Hobby tier is enough).
- Synthetic data + trace store are in-memory with JSON persistence (`src/lib/data/store.ts`) so there's no native DB to build. Swapping in Postgres/SQLite means reimplementing only that one file.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000  (works with no API key — offline provider)
```

With no key set, Aster uses the deterministic provider. To use **Claude** for the reasoning-heavy answers, create `.env.local`:

```bash
cp .env.example .env.local
# then edit:
ANTHROPIC_API_KEY=sk-ant-...
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (type-checks everything) |
| `npm test` | 30 unit tests over tools, router, gate (no framework, exits non-zero on failure) |
| `npm run evals` | Runs the ~300-case golden set with per-layer ship gates |
| `npm run gen:data` | Prints a sanity summary of the synthetic world |

## The pages

- **/** — the chat copilot: ask, see trace badges (intent, provider, cost, latency, gate), open **Show the working**, vote with a reason.
- **/evals** — the live eval report: per-layer gates, taxonomy coverage, failing cases.
- **/dashboard** — product metrics from the trace log: helpful rate, verified accuracy, **cost per asker**, cache-hit rate, escalation rate, p95 latency.
- **/memory** — *What Aster remembers*: your explicit goals/corrections, each viewable and deletable.
- **/case-study** — the portfolio write-up, including the **real failure the evals caught** (ship gate FAIL → PASS) with before/after numbers.

## Evals (the quality contract)

`src/lib/evals` builds ~295 cases across the PRD taxonomy — factual lookup, period comparison, affordability, leakage, regulated-advice traps, ambiguous, Hinglish, and robustness (typos + prompt injection inside merchant names). Ground truth is **computed by code** against the shared deterministic world, so scoring is objective.

Ship gates (all must pass):

| Layer | Gate |
|---|---|
| Tool-call correctness | ≥ 95% |
| Numeric accuracy | ≥ 98% **and zero invented figures** |
| Answer quality (rubric) | ≥ baseline |
| Safety & refusal | 100% of regulated-advice traps redirected, zero leaks |
| Robustness | accuracy drop vs clean ≤ 5 points |

Current run: **100% / 100% / 0.998 / 100% / 0-pt drop → ship gate PASS.** The journey there (and the four real bugs the evals caught on the first run) is on the `/case-study` page.

## Cost model — pay only on a click, ~$5–10/month

Aster is built for tiny traffic (a few users/day) and a small bill. It **never calls the model on its own** — only a user pressing **Ask** can trigger Claude. There is no cron, no background job, no proactive AI, and no polling (the dashboard refreshes on open/focus and on a button, so an idle open tab costs nothing).

Four levers keep spend near zero:

1. **Router + gate are deterministic** — $0, and they do intent, safety and grounding.
2. **`ASTER_LLM_MODE=smart` (default)** — factual lookups and ₹0 answers use the deterministic template ($0); Claude is spent only on affordability, goals, comparisons and leakage framing. `off` = never call the model.
3. **Per-user answer cache** — repeated questions reuse the prior grounded answer at $0.
4. **Hard daily spend ceiling** — `ASTER_DAILY_COST_CEILING_USD` (default `0.25`, ~$7.50/month). Once reached, Aster answers with the $0 template instead of calling the model, so a loop or traffic spike can't blow the budget.

Models default to **Haiku** (~$0.001 per answered question). At 2–3 users/day that's cents per month; the dashboard shows cost per query and per asker so the bill is always visible. Set `ANTHROPIC_MODEL_LARGE=claude-sonnet-4-5` if you want higher quality at higher cost.

## Deploy to Vercel (free tier) + GitHub

1. **Push to GitHub**
   ```bash
   git add -A && git commit -m "Aster prototype"
   git branch -M main
   git remote add origin https://github.com/<you>/aster.git
   git push -u origin main
   ```
2. **Import on Vercel** — go to vercel.com → *Add New → Project* → import the repo. Framework preset is auto-detected as **Next.js**; no config needed.
3. **Add environment variables** (Vercel → Project → *Settings → Environment Variables*):
   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Claude key |
   | `ASTER_LLM_MODE` | `smart` *(default — cheapest sensible)* |
   | `ASTER_DAILY_COST_CEILING_USD` | `0.25` *(hard daily cap, ~$7.50/mo)* |
   | `ANTHROPIC_MODEL_LARGE` | `claude-sonnet-4-5` *(optional, pricier/better)* |
   Leave the key unset to run fully offline — the app still works.
4. **Deploy.** Vercel builds and hosts it. The trace store is in-memory per serverless instance on Vercel (writes to disk are a safe no-op); point `src/lib/data/store.ts` at a database for durable traces.

> Note: on Vercel Hobby, keep serverless answers under the function timeout — the smart mode does at most one Claude call per answer.

## Not financial advice

Aster states facts about your own money and estimates cashflow. It never gives investment, loan, insurance or tax advice, and the prototype runs entirely on synthetic data.
