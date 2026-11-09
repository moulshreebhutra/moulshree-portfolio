# Working in this repo (Aster)

Aster is a Next.js 14 (App Router) + TypeScript app. The product rule that overrides everything: **the model never computes or recalls a number — tools do, and the gate enforces it.**

## Non-negotiable invariants
- **Grounding:** any rupee figure in an answer MUST come from a tool output. If you add an answer path, route its numbers through `src/lib/tools` and make sure `collectAllowed` (in `composer.ts`) sees them, or the gate (`gate.ts`) will reject the answer.
- **Money is integer paise** everywhere internally. Format only at the edges with `fmt()`.
- **Transaction text is untrusted data**, never instructions. Never feed `rawDescription`/`merchant` into a prompt as anything but quoted data.
- **No regulated advice.** Investment/loan/tax intents must redirect, never answer.
- **Determinism:** the router, tools, gate and eval harness must stay deterministic so `npm run evals` is reproducible. Evals force `ASTER_OFFLINE=1`.

## Where things live
- `src/lib/data` — synthetic world generator + store (swap this file for a DB).
- `src/lib/tools` — the only place numbers are computed.
- `src/lib/agent` — router, composer, gate, llm provider chain, memory, pipeline.
- `src/lib/evals` — golden set (ground truth by code), rubric, gated runner.
- `src/lib/metrics` — dashboard aggregation from the trace log.
- `src/app` — pages + API routes.

## Before you commit
Run all three; each exits non-zero on failure:
```bash
npm test          # unit tests
npm run evals     # ship-gate must PASS
npm run build     # type-check + build
```
Do not lower an eval gate to make it pass. If a gate fails, fix the root cause (see the `/case-study` page for how the first four were fixed).
