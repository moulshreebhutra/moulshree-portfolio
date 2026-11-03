import { notFound } from "next/navigation";
import Workspace from "@/components/Workspace";
import { getJson } from "@/lib/store";
import { SessionSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

export default async function Shared({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10}$/.test(id)) notFound();
  const raw = await getJson(`sessions/${id}.json`);
  const parsed = SessionSchema.safeParse(raw);
  if (!parsed.success) notFound();
  return <Workspace initial={parsed.data as any} sharedId={id} />;
}
