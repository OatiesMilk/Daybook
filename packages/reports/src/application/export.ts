import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireOwner } from "@dtr/identity/application/auth";
import { getProfile } from "@dtr/identity/infrastructure/profile-repository";
import { attendanceSummary } from "@dtr/attendance/infrastructure/repository";
import { getReport } from "@dtr/reports/infrastructure/repository";
import { renderDar } from "@dtr/reports/infrastructure/docx-renderer";
import { renderReportPdf } from "@dtr/reports/infrastructure/pdf-renderer";
import { buildReportSnapshot, reportFilename, type ReportSnapshot } from "@dtr/reports/domain/rules";

const responseHeaders = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

async function renderReport(format: "docx" | "pdf", snapshot: ReportSnapshot) {
  return format === "docx"
    ? renderDar(await readFile(join(process.cwd(), "templates", "dar-template.docx")), snapshot)
    : renderReportPdf(snapshot);
}

export async function exportReport(id: string, format: string) {
  const { supabase, user } = await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(id) || (format !== "docx" && format !== "pdf")) return new Response("Invalid export request.", { status: 400 });
  const report = await getReport(supabase, user.id, id);
  if (!report) return new Response("Report not found.", { status: 404 });
  let snapshot: ReportSnapshot;
  if (report.status === "draft") {
    try {
      const [profile, summary] = await Promise.all([
        getProfile(supabase, user.id),
        attendanceSummary(supabase, report.report_date),
      ]);
      snapshot = buildReportSnapshot(profile, report.report_date, summary.minutes, report.rows);
    } catch (cause) {
      return new Response(cause instanceof Error ? cause.message : "The draft is not ready to download.", { status: 409, headers: responseHeaders });
    }
  } else {
    if (!report.snapshot) return new Response("This report does not have a saved snapshot.", { status: 409, headers: responseHeaders });
    snapshot = report.snapshot;
  }
  const filename = reportFilename(snapshot.profile.last_name, report.report_date, format);
  const bucket = supabase.storage.from("dar-exports");
  const path = `${user.id}/${report.id}/report.${format}`;
  const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  let bytes: Buffer;
  if (report.status === "draft") {
    try {
      bytes = await renderReport(format, snapshot);
      if (bytes.length > 10485760) throw new Error("The report exceeds the 10 MB export limit.");
    } catch (cause) {
      const message = cause instanceof Error && /exceeds the 10 MB/.test(cause.message)
        ? cause.message : "Export failed. Check the DAR template and try again.";
      return new Response(message, { status: 503, headers: responseHeaders });
    }
  } else {
    const existing = await bucket.download(path);
    if (existing.data) bytes = Buffer.from(await existing.data.arrayBuffer());
    else {
    try {
      bytes = await renderReport(format, snapshot);
      if (bytes.length > 10485760) throw new Error("The report exceeds the 10 MB export limit.");
      const { error } = await bucket.upload(path, bytes, { contentType: mime, upsert: false });
      if (error) {
        // Another request may have won the immutable upload race. Return only
        // the archived bytes, never an unarchived replacement.
        const retry = await bucket.download(path);
        if (!retry.data) throw new Error("Could not archive the export. Check storage policies and retry.");
        bytes = Buffer.from(await retry.data.arrayBuffer());
      }
    } catch (cause) {
      const message = cause instanceof Error && /exceeds the 10 MB|Could not archive/.test(cause.message)
        ? cause.message : "Export failed. Check the DAR template and try again.";
      return new Response(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
    }
  }
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    ...(report.status === "draft" ? { "X-Report-Preview": "draft" } : {}),
  } });
}
