import "server-only";
import type { NextRequest } from "next/server";
import { requireOwner } from "@dtr/identity/application/auth";
import { internshipToday, validateWorkday } from "@dtr/attendance/domain/index";
import { attendanceSummary } from "@dtr/attendance/infrastructure/repository";
import { MAX_IMPORT_BYTES, parseReportImport, ReportImportError } from "@dtr/reports/infrastructure/report-import";
import { reportsForDate } from "@dtr/reports/infrastructure/repository";
import { getProfile } from "@dtr/identity/infrastructure/profile-repository";
import type { Profile } from "@dtr/identity/domain/profile";
import type { ReportImportResult } from "@dtr/reports/domain/import-types";

const MAX_REQUEST_BYTES = MAX_IMPORT_BYTES + 256 * 1024;
const responseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function importReport(request: NextRequest) {
  const { supabase, user } = await requireOwner();
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return Response.json({ error: "Cross-site uploads are not allowed." }, { status: 403, headers: responseHeaders });
  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
    return Response.json({ error: "The upload size could not be verified." }, { status: 411, headers: responseHeaders });
  }
  const contentLength = Number(contentLengthHeader);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Choose a non-empty file of 4 MB or less." }, { status: contentLength > MAX_REQUEST_BYTES ? 413 : 400, headers: responseHeaders });
  }

  try {
    const form = await request.formData();
    const value = form.get("report");
    if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") throw new ReportImportError("Choose a DOCX or PDF report file.", 400);
    const parsed = await parseReportImport({ name: value.name, type: value.type, bytes: Buffer.from(await value.arrayBuffer()) });
    let dateError = "";
    if (!parsed.header.date) dateError = "The report date was missing or was not in MM/DD/YYYY format.";
    else {
      try {
        validateWorkday(parsed.header.date);
        if (parsed.header.date > internshipToday()) throw new Error("Imported reports cannot use a future date.");
      } catch (cause) { dateError = cause instanceof Error ? cause.message : "The imported report date is invalid."; }
    }

    const currentProfilePromise = getProfile(supabase, user.id);
    const dateDataPromise = parsed.header.date && !dateError
      ? Promise.all([attendanceSummary(supabase, parsed.header.date), reportsForDate(supabase, user.id, parsed.header.date)])
      : Promise.resolve(null);
    const [profileRow, dateData] = await Promise.all([currentProfilePromise, dateDataPromise]);
    const currentProfile: Profile | null = profileRow ? {
      full_name: profileRow.full_name, last_name: profileRow.last_name, school: profileRow.school, department: profileRow.department, target_hours: profileRow.target_hours,
    } : null;
    const result: ReportImportResult = {
      ...parsed,
      currentProfile,
      attendanceMinutes: dateData?.[0].minutes ?? null,
      dateError,
      targetStatus: dateData?.[1][0]?.status ?? null,
    };
    return Response.json(result, { headers: responseHeaders });
  } catch (cause) {
    if (cause instanceof ReportImportError) return Response.json({ error: cause.message }, { status: cause.status, headers: responseHeaders });
    return Response.json({ error: "The report could not be imported. Check the file and try again." }, { status: 500, headers: responseHeaders });
  }
}
