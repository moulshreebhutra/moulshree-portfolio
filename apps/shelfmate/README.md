# Shelfmate

A routine that builds itself, and a dashboard that proves it. A concept project by [Moulshree Bhutra](https://moulshree-portfolio.vercel.app). The skincare brand is invented, nothing is sold, and no payment, name or address is collected.

## What works end to end
**Shopper**
- Answer four questions (plus an optional note) and get a routine built only from the catalog: one product per step, inside the budget, gentle products only for sensitive skin or when the note mentions pregnancy, allergies, prescriptions or a skin condition.
- Every routine runs visible checks. A model's answer that fails any check is thrown away and replaced by the rules-based routine, so a non-catalog or unsafe product can never reach a basket.
- Swap any step for another product from the same step (the server validates the swap and reprices).
- Add the routine, or single products, to a cart; place a demo order. Prices and the routine discount are computed on the server, never taken from the browser.

**Merchant** (`/merchant`)
- Funnel, conversion, average order value, revenue and margin per session, swaps, and what shoppers typed, all computed from the sessions and orders this app records.
- Sessions with a routine vs without (observational, labelled as such).
- Routine-discount dial: a what-if that re-prices every routine order in the data at another discount, with two guardrails. **Ship** changes the discount shoppers see.
- Optional AI summary of the free-text answers; keyword buckets work without AI.
- Sample sessions: one click adds 160 clearly flagged, generated sessions so the dashboard is not empty. A checkbox excludes them. Real and sample counts are always shown side by side.

## AI providers
Claude (`ANTHROPIC_API_KEY`), then Gemini free tier (`GEMINI_API_KEY`), then rules. Answers are validated before use; a rejected answer counts as a failure and the next provider gets a turn.

## Abuse protection
Per-visitor hourly limits on routines, orders, tracking, discount changes and seeding; zod validation on every input; free text is capped and stripped of emails, phone numbers and links; a daily cap on model calls across all visitors (`AI_DAILY_CAP`, default 400). The merchant view is open to anyone with the link, because this is a public demo: anyone can change the discount, and the what-if is arithmetic on recorded orders.

## Setup
```
npm install
npm test
npm run dev
```
Server-only environment variables (set in the host, never committed; see `.env.example`): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, optional `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `AI_DAILY_CAP`. `BLOB_READ_WRITE_TOKEN` is added by Vercel when a Blob store is connected; without it sessions and orders live in server memory only, which is fine locally but not across serverless instances. `/api/health` reports the active providers and storage, never a key.

## Limits, honestly
Margins assume a 45% cost of goods, which is an input, not a measured number. A 4-step routine cannot fit under ₹1,500 with this catalog, and the app says so instead of hiding it. Conversion numbers from a handful of real visitors mean little; the sample data exists to show the shape of the dashboard, not to prove anything.
