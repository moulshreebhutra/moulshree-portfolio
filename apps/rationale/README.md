# Rationale

Turn customer feedback into what to build next. A concept project by [Moulshree Bhutra](https://moulshree-portfolio.vercel.app).

Paste customer feedback and Rationale groups it by the need underneath, ranks the themes by revenue at stake and effort, and writes a one-page spec for the one you pick. The feedback in the sample is invented.

## How it works (three steps)
1. **Add feedback.** Paste one comment per line (or `Customer | Tier | $84k | text`), upload a CSV, or try the sample.
2. **See what matters.** Themes come back ranked, each with a plain reason, the number of customers, the revenue at stake and the comments behind it. Change a theme's effort (Low, Medium, High) and the ranking re-sorts. The score is `revenue at stake x confidence / effort`.
3. **Get the spec.** One page with problem, who is affected, evidence, goals, requirements, success metrics and risks. Copy it, download it as Markdown, edit it, or share the ranking by link.

## What happens under the hood
- **Grouping:** by AI (by need), or by simple word-overlap rules when AI is off or fails.
- **Spec checks:** every AI spec is checked for invented customers, ids and dollar figures. The page shows one line when everything traces back to your feedback, and lists what to double-check otherwise.
- **Sharing:** a saved ranking opens at `/s/<id>`.

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
Environment variables (server only, set in the host, never committed; see `.env.example`): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, optional `ANTHROPIC_MODEL`, `GEMINI_MODEL` (default: `gemini-flash-latest`, then `gemini-3-flash-preview`), `AI_DAILY_CAP`. `BLOB_READ_WRITE_TOKEN` is added by Vercel when a Blob store is connected; without it, saved sessions live in server memory only. `/api/health` reports which providers and which storage are active, and never returns a key.

## Limits, honestly
Rules grouping catches repeated wording, not repeated needs. Saved links are readable by anyone who has them. The score is only as good as the ARR and effort inputs.
