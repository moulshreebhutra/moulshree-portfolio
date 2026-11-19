import { PROFILE } from "./profile";
import type { Job } from "./jobs";

export type Draft = { subject: string; email: string; dm: string };

const RULES = `Write in the voice of ${PROFILE.name}. Formal, plain, pitch-style: lead with what she can do for the company, not gaps. Say "about three years of experience". Never invent facts, employers, metrics or tools. Use only the facts given. No emojis, no dashes as punctuation, no buzzwords.
Email: starts "Dear Hiring Team," (or "Dear <Name>," if a contact name is given), 3 short paragraphs (fit with the role's needs, proof with the 74% activation lift and the 13 to 4 day onboarding result, closing line), then links lines "Portfolio: ${PROFILE.links.portfolio}", "Resume: ${PROFILE.links.resume}", "LinkedIn: ${PROFILE.links.linkedin}", then "Regards," "${PROFILE.name}" "${PROFILE.phone}".
LinkedIn DM: under 600 characters, starts "Hi <Name or there>,", one line on why this role, one proof point, ask for a short chat or referral, include the portfolio link.
Return JSON only: {"subject": string, "email": string, "dm": string}.`;

export async function draftFor(job: Job, contactName?: string): Promise<Draft> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `${RULES}

Candidate: ${PROFILE.summary}

Role: ${job.title} at ${job.company} (${job.location}).
Contact name: ${contactName ?? "unknown"}
Job description excerpt:
${job.description}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const text = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const j = JSON.parse(text);
  return { subject: j.subject ?? `Application for ${job.title}`, email: j.email ?? "", dm: j.dm ?? "" };
}
