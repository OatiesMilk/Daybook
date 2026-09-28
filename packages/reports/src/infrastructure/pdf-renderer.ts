import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportSnapshot } from "../domain/rules.ts";

// Coordinates match the supplied landscape-letter DAR v2 template, in PDF points.
const edges = [73.584, 192.02, 349.61, 474.79, 731.4];
const tableTop = 348.91, headerHeight = 42, bottom = 54;
const fontSize = 10, lineHeight = 14, padding = 7;

/** Remove the original table's commands, leaving the watermark intact.
 * The boundary belongs to the supplied Word-exported template. Reject a
 * different drawing structure rather than accidentally erase its artwork.
 */
async function loadBackground(bytes: Uint8Array) {
  const template = await PDFDocument.load(bytes);
  const page = template.getPages()[0];
  if (template.getPageCount() !== 1 || page.getWidth() !== 792 || page.getHeight() !== 612) {
    throw new Error("The PDF template must be the supplied landscape-letter DAR v2 form.");
  }
  const contents = page.node.Contents();
  if (contents instanceof PDFArray && contents.size() !== 1) throw new Error("The PDF template drawing structure has changed.");
  const stream = contents instanceof PDFArray ? template.context.lookup(contents.get(0)) : contents;
  if (!(stream instanceof PDFRawStream)) throw new Error("The PDF template content is missing.");
  const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  const boundary = "/Artifact BMC 0.0902 0.212 0.361 rg\r\n74.064 307.99 117.48 40.44 re";
  const index = content.indexOf(boundary);
  if (index < 0 || !content.slice(0, index).includes("/Image15 Do")) {
    throw new Error("The PDF template table or background has changed; update the layout adapter.");
  }
  page.node.set(template.context.obj("Contents"), template.context.register(
    template.context.flateStream(Buffer.from(content.slice(0, index), "latin1")),
  ));
  return page;
}

function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    let line = "";
    // Split unbroken strings as well as words so no cell can overflow.
    for (const word of paragraph.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(line + word, size) <= width) { line += word; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ""; }
      for (const char of word.trimStart()) {
        if (font.widthOfTextAtSize(line + char, size) > width && line) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function detail(page: PDFPage, font: PDFFont, value: string, x: number, y: number, width: number, underline = false) {
  let size = 11;
  while (size > 8 && font.widthOfTextAtSize(value, size) > width) size -= 0.5;
  const lines = wrap(value, font, size, width);
  if (lines.length > 2) throw new Error("A profile detail is too long for the PDF template.");
  lines.forEach((line, i) => {
    const baseline = y - i * 10;
    page.drawText(line, { x, y: baseline, size, font });
    if (underline && line) page.drawLine({
      start: { x, y: baseline - size * 0.15 },
      end: { x: x + font.widthOfTextAtSize(line, size), y: baseline - size * 0.15 },
      thickness: 0.5, color: rgb(0, 0, 0),
    });
  });
}

export async function renderReportPdf(snapshot: ReportSnapshot, templateBytes?: Uint8Array): Promise<Buffer> {
  const root = join(process.cwd(), "templates");
  const [template, fontBytes] = await Promise.all([
    templateBytes ?? readFile(join(root, "dar-template.pdf")),
    readFile(join(root, "fonts", "NotoSerif-Regular.ttf")),
  ]);
  const source = await loadBackground(template);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const values = [snapshot.profile.full_name, snapshot.profile.school, snapshot.profile.department,
    ...snapshot.rows.flatMap(row => [row.project, row.task, row.status, row.remarks])];
  for (const value of values) for (const char of value) {
    if (!/[\r\n\t]/.test(char) && !supported.has(char.codePointAt(0)!)) {
      throw new Error("The report contains a character unsupported by the bundled PDF font.");
    }
  }
  const background = await doc.embedPage(source);
  const date = `${snapshot.date.slice(5, 7)}/${snapshot.date.slice(8, 10)}/${snapshot.date.slice(0, 4)}`;
  const hours = `${Math.floor(snapshot.totalMinutes / 60)} hours and ${snapshot.totalMinutes % 60} mins`;
  const navy = rgb(0.0902, 0.212, 0.361);
  function newPage() {
    const page = doc.addPage([792, 612]);
    page.drawPage(background);
    detail(page, font, snapshot.profile.full_name, 110, 426.7, 280);
    detail(page, font, snapshot.profile.school, 113, 402.91, 277);
    detail(page, font, hours, 160, 378.19, 230, true);
    detail(page, font, date, 434, 426.7, 285, true);
    detail(page, font, snapshot.profile.department, 504, 402.91, 216, true);
    const labels = ["Project", "Task Description", "Status\n(Completed/Ongoing)", "Remarks/Blockers"];
    labels.forEach((label, i) => {
      const x = edges[i], width = edges[i + 1] - x;
      page.drawRectangle({ x, y: tableTop - headerHeight, width, height: headerHeight, color: navy,
        borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
      const lines = label.split("\n");
      lines.forEach((line, n) => page.drawText(line, {
        x: x + (width - font.widthOfTextAtSize(line, 10)) / 2,
        y: tableTop - (lines.length === 1 ? 25 : 18 + n * 13), font, size: 10, color: rgb(1, 1, 1),
      }));
    });
    return page;
  }
  let page = newPage(), y = tableTop - headerHeight;
  for (const row of snapshot.rows) {
    const cells = [row.project, row.task, row.status, row.remarks].map((value, i) =>
      wrap(value, font, fontSize, edges[i + 1] - edges[i] - 2 * padding));
    let offset = 0;
    const length = Math.max(...cells.map(cell => cell.length));
    const fullPageLines = Math.floor((tableTop - headerHeight - bottom - 2 * padding) / lineHeight);
    const remainingLines = Math.floor((y - bottom - 2 * padding) / lineHeight);
    // Keep normal rows together; very tall rows continue across pages.
    if (length <= fullPageLines && (length > remainingLines || y - Math.max(41, length * lineHeight + 2 * padding) < bottom)) {
      page = newPage(); y = tableTop - headerHeight;
    }
    while (offset < length) {
      const capacity = Math.floor((y - bottom - 2 * padding) / lineHeight);
      if (capacity < 1 || y - bottom < 41) { page = newPage(); y = tableTop - headerHeight; continue; }
      const count = Math.min(length - offset, capacity);
      const height = Math.max(41, count * lineHeight + 2 * padding);
      cells.forEach((lines, i) => {
        page.drawRectangle({ x: edges[i], y: y - height, width: edges[i + 1] - edges[i], height,
          borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
        lines.slice(offset, offset + count).forEach((line, n) => page.drawText(line, {
          x: edges[i] + padding, y: y - padding - fontSize - n * lineHeight, font, size: fontSize,
        }));
      });
      offset += count;
      y -= height;
    }
  }
  doc.getPages().forEach((p, i, pages) => p.drawText(`Page ${i + 1} of ${pages.length}`, {
    x: 650, y: 32, font, size: 8, color: rgb(0.3, 0.3, 0.3),
  }));
  return Buffer.from(await doc.save());
}
