import { auth, signOut } from "@/auth";
import { getJSON, storeConfigured } from "@/lib/store";
import { today, type Day } from "@/lib/pipeline";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const session = await auth();
  const { d } = await searchParams;
  const date = d || today();
  const day = await getJSON<Day>(`day:${date}`);
  const days = (await getJSON<string[]>("days")) ?? [];
  return (
    <main>
      <div className="top">
        <div><h1>PM Job Radar</h1><div className="mut">{session?.user?.email}</div></div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button>Sign out</button></form>
      </div>
      {!storeConfigured() && <div className="card">Storage is not configured (UPSTASH_REDIS_REST_URL / TOKEN). Results will not persist.</div>}
      <Dashboard date={date} days={days} day={day} />
    </main>
  );
}
