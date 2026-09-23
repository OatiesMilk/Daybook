import type { NextRequest } from "next/server";
import { exportReport } from "@dtr/reports/application/export";
export const runtime = "nodejs";
// Vercel Hobby plan caps function duration at 60s; raise this only if you
// upgrade plans (Pro: up to 300s, or 800s with Fluid Compute enabled).
export const maxDuration = 60;
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return exportReport((await params).id, request.nextUrl.searchParams.get("format") ?? "docx");
}
