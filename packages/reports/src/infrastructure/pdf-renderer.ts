import "server-only";
import puppeteer from "puppeteer-core";
import type { ReportSnapshot } from "../domain/rules.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function renderReportHtml(snapshot: ReportSnapshot): string {
  const date = `${snapshot.date.slice(5, 7)}/${snapshot.date.slice(8, 10)}/${snapshot.date.slice(0, 4)}`;
  const hours = `${Math.floor(snapshot.totalMinutes / 60)} hours and ${snapshot.totalMinutes % 60} mins`;
  const rows = snapshot.rows.map(row => `
    <tr>
      <td>${escapeHtml(row.project)}</td>
      <td>${escapeHtml(row.task)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.remarks)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: legal landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .meta div { line-height: 1.5; }
  .meta span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #666; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  td:nth-child(1) { width: 18%; }
  td:nth-child(2) { width: 42%; }
  td:nth-child(3) { width: 10%; }
  td:nth-child(4) { width: 30%; }
</style>
</head>
<body>
  <h1>Daily Activity Report</h1>
  <div class="meta">
    <div>
      <div><span>Name:</span> ${escapeHtml(snapshot.profile.full_name)}</div>
      <div><span>School:</span> ${escapeHtml(snapshot.profile.school)}</div>
      <div><span>Department:</span> ${escapeHtml(snapshot.profile.department)}</div>
    </div>
    <div>
      <div><span>Date:</span> ${escapeHtml(date)}</div>
      <div><span>Total hours:</span> ${escapeHtml(hours)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Project</th><th>Task</th><th>Status</th><th>Remarks</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = process.env.CHROME_PATH ?? await (await import("puppeteer")).default.executablePath();
  // --no-sandbox is required in containerized/CI dev environments that run as root.
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
}

export async function renderReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(renderReportHtml(snapshot), { waitUntil: "load" });
    const pdf = await page.pdf({ format: "legal", landscape: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
