import { NextResponse } from "next/server";
import { dashboardMetrics } from "@/lib/metrics/trace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(dashboardMetrics());
}
