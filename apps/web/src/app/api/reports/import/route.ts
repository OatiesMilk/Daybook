import type { NextRequest } from "next/server";
import { importReport } from "@dtr/reports/application/import";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  return importReport(request);
}
