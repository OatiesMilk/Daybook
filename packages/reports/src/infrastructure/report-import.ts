import { Worker } from "node:worker_threads";
import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import PizZip from "pizzip";
import type { ActivityRow } from "../domain/rules";
import type { ImportedActivityRow, ImportedReportHeader, ParsedReportImport } from "../domain/import-types";

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 256;
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 2 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_ACTIVITY_ROWS = 100;
const PDF_TIMEOUT_MS = 5_000;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

type Upload = { name: string; type: string; bytes: Buffer };
type ZipEntryWithMetadata = {
  name: string;
  dir: boolean;
  asText(): string;
  _data?: { compressedSize?: number; uncompressedSize?: number };
};
type PdfTextItem = { text: string; x: number; y: number };

export class ReportImportError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}

function normalized(value: string) {
  return value.normalize("NFKC").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function parseDate(value: string): string | null {
  const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return null;
  const month = Number(match[1]); const day = Number(match[2]); const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseHours(value: string): number | null {
  const match = normalized(value).match(/\b(\d{1,5})\s*(?:hours?|hrs?|h)\s*(?:(?:and\s*)?(\d{1,2})\s*(?:minutes?|mins?|m))?\b/i);
  if (!match) return null;
  const hours = Number(match[1]); const minutes = Number(match[2] ?? 0);
  return minutes < 60 ? hours * 60 + minutes : null;
}

function normalizeStatus(value: string): ActivityRow["status"] | null {
  const status = normalized(value).toLocaleLowerCase("en-US");
  if (status === "completed") return "Completed";
  if (status === "ongoing") return "Ongoing";
  return null;
}

function childElements(node: XmlNode, localName: string): XmlElement[] {
  return Array.from(node.childNodes).filter(child => {
    if (child.nodeType !== 1) return false;
    const element = child as XmlElement;
    return element.namespaceURI === WORD_NS && element.localName === localName;
  }) as XmlElement[];
}

function inlineText(node: XmlNode): string {
  let result = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) { result += child.nodeValue ?? ""; continue; }
    if (child.nodeType !== 1) continue;
    const element = child as XmlElement;
    if (element.namespaceURI === WORD_NS && element.localName === "t") result += element.textContent ?? "";
    else if (element.namespaceURI === WORD_NS && element.localName === "tab") result += "\t";
    else if (element.namespaceURI === WORD_NS && (element.localName === "br" || element.localName === "cr")) result += "\n";
    else result += inlineText(element);
  }
  return result;
}

function cellText(cell: XmlElement): string {
  return childElements(cell, "p").map(paragraph => inlineText(paragraph).trimEnd()).join("\n").trim();
}

function extractLabeledValue(value: string, labels: RegExp[]): string | null {
  for (const label of labels) {
    const match = value.match(label);
    if (match?.[1] !== undefined) return normalized(match[1]) || null;
  }
  return null;
}

function headerFromCells(cells: string[]): ImportedReportHeader {
  const header: ImportedReportHeader = { full_name: null, school: null, department: null, date: null, statedMinutes: null };
  for (const cell of cells) {
    header.full_name ??= extractLabeledValue(cell, [/^\s*Name\s*:\s*([\s\S]*)$/i]);
    header.school ??= extractLabeledValue(cell, [/^\s*School\s*:\s*([\s\S]*)$/i]);
    header.department ??= extractLabeledValue(cell, [/^\s*Department(?:\s*\/\s*Team)?\s*:\s*([\s\S]*)$/i]);
    const dateValue = extractLabeledValue(cell, [/^\s*Date\s*:\s*([\s\S]*)$/i]);
    if (!header.date && dateValue) header.date = parseDate(dateValue);
    const hoursValue = extractLabeledValue(cell, [/^\s*(?:Hours rendered|Total hours)\s*:\s*([\s\S]*)$/i]);
    if (header.statedMinutes === null && hoursValue) header.statedMinutes = parseHours(hoursValue);
  }
  return header;
}

function normalizedHeader(value: string) {
  return normalized(value).toLocaleLowerCase("en-US").replace(/[^a-z]/g, "");
}

function parseDocx(bytes: Buffer): ParsedReportImport {
  let zip: PizZip;
  try { zip = new PizZip(bytes); }
  catch { throw new ReportImportError("This file is not a valid, readable DOCX document."); }

  const entries = Object.values(zip.files) as ZipEntryWithMetadata[];
  if (entries.length > MAX_ZIP_ENTRIES) throw new ReportImportError("The DOCX contains too many files to import safely.");
  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    if (entry.name.includes("\\") || entry.name.split("/").includes("..")) throw new ReportImportError("The DOCX contains an unsafe file path.");
    const compressed = entry._data?.compressedSize; const uncompressed = entry._data?.uncompressedSize;
    if (!Number.isSafeInteger(compressed) || !Number.isSafeInteger(uncompressed) || compressed! < 0 || uncompressed! < 0) {
      throw new ReportImportError("The DOCX ZIP metadata could not be validated.");
    }
    totalUncompressed += uncompressed!;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new ReportImportError("The DOCX expands beyond the safe import limit.");
    if (compressed === 0 ? uncompressed! > 0 : uncompressed! / compressed! > MAX_COMPRESSION_RATIO) {
      throw new ReportImportError("The DOCX has a suspicious compression ratio and was rejected.");
    }
  }

  const contentTypes = zip.file("[Content_Types].xml") as ZipEntryWithMetadata | null;
  const documentEntry = zip.file("word/document.xml") as ZipEntryWithMetadata | null;
  if (!contentTypes || !documentEntry) throw new ReportImportError("The uploaded ZIP is not a Word DOCX document.");
  if ((documentEntry._data?.uncompressedSize ?? Infinity) > MAX_DOCUMENT_XML_BYTES) throw new ReportImportError("The Word document content is too large to import safely.");
  const contentTypeXml = contentTypes.asText();
  if (!/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml/i.test(contentTypeXml)) {
    throw new ReportImportError("The uploaded ZIP is not a Word DOCX document.");
  }

  const documentXml = documentEntry.asText();
  if (/<!DOCTYPE|<!ENTITY/i.test(documentXml)) throw new ReportImportError("DOCX files containing document type or entity declarations are not supported.");
  const parserErrors: string[] = [];
  const document = new DOMParser({ onError: (level, message) => { if (level !== "warning") parserErrors.push(message); } })
    .parseFromString(documentXml, "application/xml");
  if (parserErrors.length || !document?.documentElement) throw new ReportImportError("The DOCX contains malformed document XML.");

  const tables = Array.from(document.getElementsByTagNameNS(WORD_NS, "tbl"));
  const allCells = tables.flatMap(table => childElements(table, "tr").flatMap(row => childElements(row, "tc").map(cellText)));
  const header = headerFromCells(allCells);
  let activityRows: ImportedActivityRow[] | null = null;

  for (const table of tables) {
    const rows = childElements(table, "tr");
    const headerIndex = rows.findIndex(row => {
      const names = childElements(row, "tc").map(cell => normalizedHeader(cellText(cell)));
      return names.length >= 4 && names[0] === "project" && (names[1] === "taskdescription" || names[1] === "task")
        && names[2].startsWith("status") && (names[3] === "remarksblockers" || names[3] === "remarks");
    });
    if (headerIndex < 0) continue;
    const parsed = rows.slice(headerIndex + 1).map(row => childElements(row, "tc").map(cellText)).filter(cells => cells.some(Boolean)).map(cells => ({
      project: cells[0] ?? "", task: cells[1] ?? "", rawStatus: cells[2] ?? "", status: normalizeStatus(cells[2] ?? ""), remarks: cells[3] ?? "",
    }));
    if (parsed.length > MAX_ACTIVITY_ROWS) throw new ReportImportError(`The document contains more than ${MAX_ACTIVITY_ROWS} activity rows.`);
    activityRows = parsed;
    break;
  }
  if (!activityRows) throw new ReportImportError("No matching Project, Task, Status, and Remarks activity table was found in this DOCX.");
  if (!activityRows.length) throw new ReportImportError("The DOCX activity table does not contain any rows.");

  const warnings: string[] = [];
  if (activityRows.some(row => row.status === null)) warnings.push("One or more statuses need review before the rows can be used.");
  if (activityRows.some(row => !row.project)) warnings.push("One or more Project cells are blank. Confirm them or copy the previous project in the review step.");
  return { source: "docx", header, rows: activityRows, warnings };
}

function pdfLines(pages: PdfTextItem[][]): string[] {
  const lines: string[] = [];
  for (const items of pages) {
    const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
    for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const group = groups.find(candidate => Math.abs(candidate.y - item.y) <= 2);
      if (group) group.items.push(item); else groups.push({ y: item.y, items: [item] });
    }
    for (const group of groups) lines.push(normalized(group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ")));
  }
  return lines.filter(Boolean);
}

const PDF_LABEL = /\b(?:Name|School|Department(?:\s*\/\s*Team)?|Date|Hours rendered|Total hours)\s*:/ig;
function pdfValue(lines: string[], label: RegExp): string | null {
  for (const line of lines) {
    const match = line.match(label);
    if (!match || match.index === undefined) continue;
    const after = line.slice(match.index + match[0].length);
    PDF_LABEL.lastIndex = 0;
    const next = PDF_LABEL.exec(after);
    return normalized(after.slice(0, next?.index ?? after.length)) || null;
  }
  return null;
}

async function readPdfText(bytes: Buffer): Promise<PdfTextItem[][]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf-import-worker.mjs", import.meta.url), {
      workerData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
      execArgv: [],
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new ReportImportError("PDF parsing took too long and was stopped.")); }, PDF_TIMEOUT_MS);
    worker.once("message", message => {
      clearTimeout(timer); void worker.terminate();
      if (message?.ok) resolve(message.pages as PdfTextItem[][]);
      else reject(new ReportImportError(/password/i.test(message?.error ?? "") ? "Password-protected PDFs cannot be imported." : "This PDF could not be read safely."));
    });
    worker.once("error", () => { clearTimeout(timer); reject(new ReportImportError("This PDF could not be read safely.")); });
    worker.once("exit", code => { if (code !== 0) { clearTimeout(timer); reject(new ReportImportError("This PDF could not be read safely.")); } });
  });
}

async function parsePdf(bytes: Buffer): Promise<ParsedReportImport> {
  const lines = pdfLines(await readPdfText(bytes));
  if (!lines.length) throw new ReportImportError("This PDF has no readable text. Scanned PDFs are not supported.");
  const name = pdfValue(lines, /\bName\s*:/i);
  const school = pdfValue(lines, /\bSchool\s*:/i);
  const department = pdfValue(lines, /\bDepartment(?:\s*\/\s*Team)?\s*:/i);
  const rawDate = pdfValue(lines, /\bDate\s*:/i);
  const rawHours = pdfValue(lines, /\b(?:Hours rendered|Total hours)\s*:/i);
  const header = { full_name: name, school, department, date: rawDate ? parseDate(rawDate) : null, statedMinutes: rawHours ? parseHours(rawHours) : null };
  if (!Object.values(header).some(value => value !== null)) throw new ReportImportError("No recognizable Daily Activity Report header fields were found in this PDF.");
  return { source: "pdf", header, rows: [], warnings: ["PDF activity tables are not imported because positioned PDF text does not preserve reliable row and cell structure. Upload the DOCX version to import activities."] };
}

export async function parseReportImport(upload: Upload): Promise<ParsedReportImport> {
  if (!upload.bytes.length) throw new ReportImportError("Choose a non-empty DOCX or PDF file.", 400);
  if (upload.bytes.length > MAX_IMPORT_BYTES) throw new ReportImportError("The file must be 4 MB or smaller.", 413);
  const extension = upload.name.toLocaleLowerCase("en-US").match(/\.(docx|pdf)$/)?.[1];
  if (!extension) throw new ReportImportError("Choose a file ending in .docx or .pdf.", 415);
  const isPdf = upload.bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const isZip = upload.bytes[0] === 0x50 && upload.bytes[1] === 0x4b;
  if ((extension === "pdf" && !isPdf) || (extension === "docx" && !isZip)) throw new ReportImportError("The file contents do not match its extension.", 415);
  const genericMime = !upload.type || upload.type === "application/octet-stream";
  const expectedMime = extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!genericMime && upload.type !== expectedMime) throw new ReportImportError("The file type reported by the browser does not match its extension.", 415);
  return extension === "docx" ? parseDocx(upload.bytes) : parsePdf(upload.bytes);
}
