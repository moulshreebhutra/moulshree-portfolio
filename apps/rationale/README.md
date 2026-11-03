# Rationale

Customer feedback in. A ranked roadmap out. A concept project by [Moulshree Bhutra](https://moulshree-portfolio.vercel.app).

Paste or upload customer feedback, group it by the need underneath, rank the themes with one formula anyone can read aloud (`ARR at stake × confidence ÷ effort`), draft the PRD from the evidence, and share the result by link. The feedback in the sample is invented.

## What works end to end
- **Add feedback:** paste lines, `Customer | Tier | $84k | text` rows, or a CSV (customer, tier, arr, text). Edit any item, move it between themes, delete it.
- **Group:** with AI (by need), or by rules (word overlap, no AI). If the AI call fails or its answer is invalid, the page says so and falls back to rules.
- **Rank:** arithmetic only. The model proposes effort and confidence; you can overrule both with sliders.
- **PRD:** AI draft from the theme's evidence, or a template. Four checks run on every draft and again as you edit: cites items, cites only this theme's items, no dollar figures outside the evidence, names the customers it relies on.
- **Share and export:** save a session to a link (`/s/<id>`), download the PRD as Markdown, download the ranking as CSV.

## AI providers
Order: **Claude** (`ANTHROPIC_API_KEY`), then **Gemini** free tier (`GEMINI_API_KEY`), then rules. A provider's answer that fails validation counts as a failure and the next provider gets a turn.

## Abuse protection
Per-visitor hourly limits on grouping, PRD drafts and saves; 60 items, 600 characters each and 20,000 characters per batch; emails, phone numbers and links are stripped before any model call; a daily cap on model calls across all visitors (`AI_DAILY_CAP`, default 400).

## Setup
```
npm install
npm test
npm run dev
```
Environment variables (server only, set in the host, never committed; see `.env.example`): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, optional `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `AI_DAILY_CAP`. `BLOB_READ_WRITE_TOKEN` is added by Vercel when a Blob store is connected; without it, saved sessions live in server memory only. `/api/health` reports which providers and which storage are active, and never returns a key.

## Limits, honestly
Rules grouping catches repeated wording, not repeated needs. Saved links are readable by anyone who has them. The score is only as good as the ARR and effort inputs.
