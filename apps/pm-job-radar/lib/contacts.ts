export type Contact = { name: string; position?: string; email?: string };
export type Contacts = { productSearch: string; recruiterSearch: string; found: Contact[] };

const q = (s: string) => encodeURIComponent(s);
// Links you open yourself while logged in to LinkedIn. Nothing is scraped.
export function searchLinks(company: string) {
  return {
    productSearch: `https://www.linkedin.com/search/results/people/?keywords=${q(company + " product manager")}&origin=GLOBAL_SEARCH_HEADER`,
    recruiterSearch: `https://www.linkedin.com/search/results/people/?keywords=${q(company + " talent acquisition recruiter")}&origin=GLOBAL_SEARCH_HEADER`,
  };
}

export async function hunterContacts(website?: string): Promise<Contact[]> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !website) return [];
  const domain = website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?domain=${q(domain)}&limit=10&api_key=${key}`, { cache: "no-store" });
    if (!r.ok) return [];
    const emails = (await r.json()).data?.emails ?? [];
    const rel = emails.filter((e: any) => /product|talent|recruit|hr|people|hiring|head/i.test(`${e.position ?? ""} ${e.department ?? ""}`));
    return rel.slice(0, 3).map((e: any) => ({ name: [e.first_name, e.last_name].filter(Boolean).join(" "), position: e.position ?? undefined, email: e.value }));
  } catch { return []; }
}
