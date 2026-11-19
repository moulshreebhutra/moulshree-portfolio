import { fetchJobs, type Job } from "./jobs";
import { searchLinks, hunterContacts, type Contacts } from "./contacts";
import { draftFor, type Draft } from "./draft";
import { getJSON, setJSON } from "./store";
import { JOB_TARGET } from "./profile";

export type Item = { job: Job; contacts: Contacts; draft?: Draft; draftError?: string; done?: boolean };
export type Day = { date: string; ranAt: string; items: Item[] };

export const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST date

export async function runPipeline(): Promise<Day> {
  const date = today();
  const prev = await getJSON<Day>(`day:${date}`);
  const seenIds = new Set((await getJSON<string[]>("seen")) ?? []);
  const have = new Set(prev?.items.map((i) => i.job.id));
  const fresh = (await fetchJobs()).filter((j) => !seenIds.has(j.id) && !have.has(j.id));
  const need = Math.max(0, JOB_TARGET - (prev?.items.length ?? 0));
  const picked = fresh.slice(0, need);

  const hunterMax = Number(process.env.HUNTER_MAX_PER_RUN ?? 2);
  const items: Item[] = [];
  for (let i = 0; i < picked.length; i++) {
    const job = picked[i];
    const found = i < hunterMax ? await hunterContacts(job.website) : [];
    items.push({ job, contacts: { ...searchLinks(job.company), found } });
  }
  for (let i = 0; i < items.length; i += 4) {
    await Promise.all(items.slice(i, i + 4).map(async (it) => {
      try { it.draft = await draftFor(it.job, it.contacts.found[0]?.name); }
      catch (e: any) { it.draftError = String(e.message ?? e); }
    }));
  }
  const day: Day = { date, ranAt: new Date().toISOString(), items: [...(prev?.items ?? []), ...items] };
  await setJSON(`day:${date}`, day, 60 * 60 * 24 * 30);
  await setJSON("seen", [...seenIds, ...items.map((i) => i.job.id)].slice(-2000));
  await setJSON("days", [...new Set([date, ...((await getJSON<string[]>("days")) ?? [])])].slice(0, 30));
  return day;
}

export async function markDone(date: string, id: string, done: boolean) {
  const day = await getJSON<Day>(`day:${date}`);
  if (!day) return;
  const it = day.items.find((i) => i.job.id === id);
  if (it) it.done = done;
  await setJSON(`day:${date}`, day, 60 * 60 * 24 * 30);
}
