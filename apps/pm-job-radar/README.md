# PM Job Radar

Daily PM/APM job matches (0-4 yrs, Bangalore first, then remote India, then rest of India) with a ready email and LinkedIn DM per job. You apply and send; the app never touches LinkedIn.

Stack: Next.js on Vercel (Hobby), Google login (allow-list), JSearch (jobs), Upstash Redis (storage), Gemini (drafts), Hunter (optional emails).
Schedule: one Vercel cron run per day (Hobby limit), plus a "Run now" button.
Secrets: see `.env.example`. Set them only in Vercel environment variables.
