import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
export async function convertPdf(docx: Buffer): Promise<Buffer> {
  if (process.env.VERCEL) throw new Error("PDF conversion is configured for your computer. Run the app locally to create this PDF.");
  const executable = process.env.LIBREOFFICE_PATH;
  if (!executable) throw new Error("Set LIBREOFFICE_PATH in .env.local to your local soffice.exe, then restart the app.");
  // Each conversion owns a fresh private directory and LibreOffice profile.
  const directory = await mkdtemp(join(tmpdir(), "daybook-pdf-"));
  try {
    const input = join(directory, "report.docx");
    await writeFile(input, docx);
    await run(executable, [`-env:UserInstallation=${pathToFileURL(join(directory, "profile")).href}`, "--headless", "--convert-to", "pdf:writer_pdf_Export", "--outdir", directory, input], { timeout: 60000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const bytes = await readFile(join(directory, "report.pdf"));
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Conversion did not produce a PDF.");
    return bytes;
  } finally {
    // directory comes only from mkdtemp under the OS temp root, never user input.
    await rm(directory, { recursive: true, force: true });
  }
}
