import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireOwner } from "@/lib/auth";
import { getReport } from "@/models/reports";
import { renderDar } from "@/models/docx-renderer";
import { convertPdf } from "@/models/pdf-converter";
import { reportFilename } from "@/models/report-rules";

export async function exportReport(id: string, format: string) {
  const { supabase, user } = await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(id) || (format !== "docx" && format !== "pdf")) return new Response("Invalid export request.", { status: 400 });
  const report = await getReport(supabase, user.id, id);
  if (!report) return new Response("Report not found.", { status: 404 });
  if (report.status === "draft" || !report.snapshot) return new Response("Mark the report Ready before exporting.", { status: 409 });
  const filename = reportFilename(report.snapshot.profile.last_name, report.report_date, format);
  const bucket = supabase.storage.from("dar-exports");
  const path = `${user.id}/${report.id}/report.${format}`;
  const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const existing = await bucket.download(path);
  let bytes: Buffer;
  if (existing.data) bytes = Buffer.from(await existing.data.arrayBuffer());
  else {
    try {
      const docxPath = `${user.id}/${report.id}/report.docx`;
      const archivedDocx = format === "pdf" ? await bucket.download(docxPath) : null;
      let docx = archivedDocx?.data ? Buffer.from(await archivedDocx.data.arrayBuffer())
        : renderDar(await readFile(join(process.cwd(), "templates", "dar-template.docx")), report.snapshot);
      if (format === "pdf" && !archivedDocx?.data) {
        const archived = await bucket.upload(docxPath, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
        if (archived.error) {
          const winner = await bucket.download(docxPath);
          if (!winner.data) throw new Error("Could not archive the export. Check storage policies and retry.");
          docx = Buffer.from(await winner.data.arrayBuffer());
        }
      }
      bytes = format === "docx" ? docx : await convertPdf(docx);
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
      const message = cause instanceof Error && /LIBREOFFICE_PATH|configured for your computer|exceeds the 10 MB|Could not archive/.test(cause.message)
        ? cause.message : "Export failed. Check the DAR template and local LibreOffice installation, then try again.";
      return new Response(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
  }
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
