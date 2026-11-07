# Shelfmate

Your skincare routine, built in a minute. A concept project by [Moulshree Bhutra](https://moulshree-portfolio.vercel.app). The skincare brand is invented, nothing is sold, and no payment, name or address is collected.

## What works end to end
**Shopper**
1. Answer three questions (skin, main concern, budget), plus an optional note.
2. Get a routine built only from the shelf: one product per step, inside the budget, gentle products only for sensitive skin or when the note mentions pregnancy, allergies, prescriptions or a skin condition. Swap any step for an alternative.
3. Add the routine, or single products from "Browse the whole shelf", to the cart and place a demo order. Prices and the routine discount are always computed on the server.

Every AI routine is checked before it is shown: products must exist on the shelf, one per step, within budget, gentle where needed. A failed check replaces the answer with the simple rules-based routine, so a made-up or unsafe product never reaches a cart.

**Merchant view** (`/merchant`)
- Four numbers: routines built, orders and revenue, conversion, average order.
- A plain-language "what stands out" line (the biggest drop-off, and routine vs no routine, labelled as a comparison and not proof).
- Where shoppers drop off (funnel), best sellers, and recent orders.
- A switch for the 10% routine discount, which shoppers see immediately.
- Demo data: the first visit adds 80 clearly flagged sessions so the dashboard is never empty. A checkbox hides them, and real and demo counts are always shown.

## AI providers
Claude (`ANTHROPIC_API_KEY`), then Gemini free tier (`GEMINI_API_KEY`), then rules. Answers are validated before use; a rejected answer counts as a failure and the next provider gets a turn.

## Abuse protection
Per-visitor hourly limits on routines, orders, tracking, discount changes and demo-data setup; zod validation on every input; free text is capped and stripped of emails, phone numbers and links; a daily cap on model calls across all visitors (`AI_DAILY_CAP`, default 400). The merchant view is open to anyone with the link, because this is a public demo: anyone can change the discount, and the discount is the only setting it exposes.

## Setup
```
npm install
npm test
npm run dev
```
Server-only environment variables (set in the host, never committed; see `.env.example`): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, optional `ANTHROPIC_MODEL`, `GEMINI_MODEL` (default: `gemini-flash-latest`, then `gemini-3-flash-preview`), `AI_DAILY_CAP`. `BLOB_READ_WRITE_TOKEN` is added by Vercel when a Blob store is connected; without it sessions and orders live in server memory only, which is fine locally but not across serverless instances. `/api/health` reports the active providers and storage, never a key.

## Limits, honestly
Margins in the code assume a 45% cost of goods, which is an input and not a measured number. A 4-step routine cannot fit under ₹1,500 with this catalog, so that budget gets a 3-step routine. Conversion numbers from a handful of real visitors mean little; the demo data shows the shape of the dashboard and proves nothing.
