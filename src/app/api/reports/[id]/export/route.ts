import type { NextRequest } from "next/server";
import { exportReport } from "@/controllers/exports";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return exportReport((await params).id, request.nextUrl.searchParams.get("format") ?? "docx");
}
