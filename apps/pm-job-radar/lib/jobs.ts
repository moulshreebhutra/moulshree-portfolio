import { MAX_YEARS } from "./profile";

export type Job = {
  id: string; title: string; company: string; website?: string; location: string; remote: boolean;
  applyLink: string; source: string; postedAt?: string; description: string;
  minYears?: number; score: number; reason: string;
};

const QUERIES = [
  "product manager in Bangalore, India",
  "associate product manager Bengaluru",
  "product manager remote India",
  "product manager India",
];

const TITLE_OK = /(product\s+(manager|owner)|\bapm\b|associate product|product lead)/i;
const TITLE_BAD = /(senior|sr\.?|director|head|vp\b|vice president|principal|staff|group product|chief|intern\b)/i;

export function parseMinYears(text: string): number | undefined {
  const t = text.toLowerCase();
  const range = t.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*(?:years|yrs)/);
  if (range) return Number(range[1]);
  const plus = t.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)/);
  if (plus) return Number(plus[1]);
  return undefined;
}

function locationScore(city: string, state: string, remote: boolean) {
  const loc = `${city} ${state}`.toLowerCase();
  if (/bengaluru|bangalore/.test(loc)) return { s: 50, why: "Bangalore" };
  if (remote) return { s: 40, why: "Remote India" };
  return { s: 10, why: "Other India" };
}

export async function fetchJobs(): Promise<Job[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY missing");
  const seen = new Map<string, Job>();
  for (const q of QUERIES) {
    const u = new URL("https://jsearch.p.rapidapi.com/search");
    u.search = new URLSearchParams({ query: q, page: "1", num_pages: "1", country: "in", date_posted: "today" }).toString();
    const r = await fetch(u, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }, cache: "no-store" });
    if (!r.ok) { console.error("JSearch", r.status, q); continue; }
    const data = (await r.json()).data ?? [];
    for (const d of data) {
      const title: string = d.job_title ?? "";
      if (!TITLE_OK.test(title) || TITLE_BAD.test(title)) continue;
      const desc: string = d.job_description ?? "";
      const minYears = parseMinYears(desc + " " + title);
      if (minYears !== undefined && minYears > MAX_YEARS) continue;
      const remote = !!d.job_is_remote;
      const loc = locationScore(d.job_city ?? "", d.job_state ?? "", remote);
      const lower = desc.toLowerCase();
      const kw = ["activation","onboarding","saas","b2b","ai","growth","analytics","experiment","startup"].filter((k) => lower.includes(k)).length;
      const apply = d.job_apply_link || d.apply_options?.[0]?.apply_link || "";
      const job: Job = {
        id: d.job_id, title, company: d.employer_name ?? "Unknown", website: d.employer_website ?? undefined,
        location: [d.job_city, d.job_state].filter(Boolean).join(", ") || (remote ? "Remote" : "India"),
        remote, applyLink: apply, source: d.job_publisher ?? "", postedAt: d.job_posted_at_datetime_utc,
        description: desc.slice(0, 3500), minYears,
        score: loc.s + Math.min(kw * 3, 20) + (minYears !== undefined && minYears <= 3 ? 8 : 0) + (/associate|apm/i.test(title) ? 5 : 0),
        reason: `${loc.why}${minYears !== undefined ? `, ${minYears}+ yrs` : ""}`,
      };
      const dup = `${job.company}|${job.title}`.toLowerCase();
      if (!seen.has(dup) || seen.get(dup)!.score < job.score) seen.set(dup, job);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}
