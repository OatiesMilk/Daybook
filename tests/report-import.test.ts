import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import PizZip from "pizzip";
import { renderDar } from "../packages/reports/src/infrastructure/docx-renderer.ts";
import { MAX_IMPORT_BYTES, parseReportImport } from "../packages/reports/src/infrastructure/report-import.ts";
import { fillBlankProjects } from "../packages/reports/src/domain/import-types.ts";

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function docxPackage(documentXml: string) {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

function minimalPdf(lines: string[]) {
  const escaped = (value: string) => value.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 50 750 Td ${lines.map((line, index) => `${index ? "0 -20 Td " : ""}(${escaped(line)}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("DOCX import round-trips every supported field and preserves multiline cells", async () => {
  const template = await readFile(new URL("../apps/web/templates/dar-template.docx", import.meta.url));
  const snapshot = {
    profile: { full_name: "Example Intern", last_name: "Not Rendered", school: "Example University", department: "DISD", target_hours: 486 },
    date: "2026-09-17", totalMinutes: 3750,
    rows: [
      { project: "Portal", task: "First line\nSecond line", status: "Ongoing" as const, remarks: "Needs review" },
      { project: "Portal", task: "Released feature", status: "Completed" as const, remarks: "" },
    ],
  };
  const parsed = await parseReportImport({ name: "DAR_EXAMPLE_091726.docx", type: docxMime, bytes: renderDar(template, snapshot) });
  assert.equal(parsed.source, "docx");
  assert.deepEqual(parsed.header, { full_name: "Example Intern", school: "Example University", department: "DISD", date: "2026-09-17", statedMinutes: 3750 });
  assert.deepEqual(parsed.rows.map(row => ({ project: row.project, task: row.task, status: row.status, remarks: row.remarks })), snapshot.rows);
});

test("DOCX import flags ambiguous statuses and fills blank projects only on explicit request", async () => {
  const template = await readFile(new URL("../apps/web/templates/dar-template.docx", import.meta.url));
  const buffer = renderDar(template, {
    profile: { full_name: "Example", last_name: "Example", school: "School", department: "IT", target_hours: 486 }, date: "2026-09-17", totalMinutes: 60,
    rows: [
      { project: "Portal", task: "One", status: "Ongoing", remarks: "" },
      { project: "", task: "Two", status: "Done" as "Ongoing", remarks: "" },
    ],
  });
  const parsed = await parseReportImport({ name: "report.docx", type: docxMime, bytes: buffer });
  assert.equal(parsed.rows[1].project, "");
  assert.equal(parsed.rows[1].status, null);
  assert.equal(parsed.rows[1].rawStatus, "Done");
  assert.equal(fillBlankProjects(parsed.rows)[1].project, "Portal");
});

test("PDF import extracts headers but deliberately does not infer activity rows", async () => {
  const bytes = minimalPdf(["Name: Example Intern", "School: Example University", "Department/Team: DISD", "Date: 09/17/2026", "Total hours: 62 hours and 30 mins", "Project Task Status Remarks"]);
  const parsed = await parseReportImport({ name: "report.pdf", type: "application/pdf", bytes });
  assert.deepEqual(parsed.header, { full_name: "Example Intern", school: "Example University", department: "DISD", date: "2026-09-17", statedMinutes: 3750 });
  assert.deepEqual(parsed.rows, []);
  assert.match(parsed.warnings[0], /not imported/);
});

test("import rejects empty, oversized, spoofed, and structurally invalid files", async () => {
  await assert.rejects(parseReportImport({ name: "empty.docx", type: docxMime, bytes: Buffer.alloc(0) }), /non-empty/);
  await assert.rejects(parseReportImport({ name: "large.docx", type: docxMime, bytes: Buffer.alloc(MAX_IMPORT_BYTES + 1) }), /4 MB/);
  await assert.rejects(parseReportImport({ name: "fake.pdf", type: "application/pdf", bytes: Buffer.from("not a pdf") }), /do not match/);
  await assert.rejects(parseReportImport({ name: "fake.docx", type: docxMime, bytes: Buffer.from("PK not a zip") }), /valid, readable DOCX/);
  const noTable = docxPackage(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Name: Example</w:t></w:r></w:p></w:body></w:document>`);
  await assert.rejects(parseReportImport({ name: "no-table.docx", type: docxMime, bytes: noTable }), /No matching/);
  const suspicious = docxPackage(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${"A".repeat(3 * 1024 * 1024)}</w:t></w:r></w:p></w:body></w:document>`);
  await assert.rejects(parseReportImport({ name: "compressed.docx", type: docxMime, bytes: suspicious }), /compression ratio|too large/);
});
