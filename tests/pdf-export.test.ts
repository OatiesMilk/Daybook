import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("PDF template exports preserve artwork, wrap cells and paginate without losing activities", () => {
  // Use the server import condition just as Next.js does, without weakening the
  // renderer's server-only boundary for the ordinary test runner.
  const result = execFileSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", `
    import { renderReportPdf } from '../../packages/reports/src/infrastructure/pdf-renderer.ts';
    import { PDFDocument } from 'pdf-lib';
    import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const profile = { full_name: 'José Example', last_name: 'Example', school: 'Example School', department: 'IT', target_hours: 486 };
    const outputs = [];
    for (const count of [1, 3, 18]) {
      const rows = Array.from({ length: count }, (_, i) => ({ project: 'Project ' + i,
        task: 'Activity ' + i + ': Reviewed the application and verified the result.\\nSecond line.',
        status: 'Completed', remarks: 'No blockers' }));
      const bytes = await renderReportPdf({ profile, date: '2026-09-17', totalMinutes: 3750, rows });
      const loading = getDocument({ data: new Uint8Array(bytes) });
      const pdf = await loading.promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const items = (await page.getTextContent()).items.filter(x => x.str);
        if (items.some(x => x.transform[4] < 53 || x.transform[4] + x.width > 733 || x.transform[5] < 31)) throw Error('Text outside safe bounds');
        const pageText = items.map(x => x.str).join(' ');
        if (!pageText.includes('Task Description') || !pageText.includes('José Example')) throw Error('Missing repeated header');
        const ops = await page.getOperatorList();
        if (!ops.fnArray.includes(OPS.paintImageXObject)) throw Error('Missing template artwork');
        text += pageText;
      }
      for (let i = 0; i < count; i++) if (!text.includes('Activity ' + i + ':')) throw Error('Lost activity ' + i);
      if (!text.includes('62 hours and 30 mins')) throw Error('Lost total');
      outputs.push({ count, pages: pdf.numPages });
      await loading.destroy();
    }
    const oversized = await renderReportPdf({ profile, date: '2026-09-17', totalMinutes: 0,
      rows: [{ project: 'Long row', task: 'X'.repeat(3900) + ' END_OVERSIZE', status: 'Ongoing', remarks: 'Final remark' }] });
    const loading = getDocument({ data: new Uint8Array(oversized) });
    const pdf = await loading.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str || '').join(' ');
    if (!text.includes('END_OVERSIZE') || (text.match(/X/g) || []).length !== 3900) throw Error('Oversized row truncated');
    if (pdf.numPages < 2) throw Error('Oversized row not paginated');
    await loading.destroy();
    try { await renderReportPdf({ profile, date: '2026-09-17', totalMinutes: 0, rows: [] }, await (await PDFDocument.create()).save()); throw Error('Invalid template accepted'); }
    catch (error) { if (error.message === 'Invalid template accepted') throw error; }
    console.log('RESULT:' + JSON.stringify(outputs));
  `], { cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)), encoding: "utf8", timeout: 60000 });
  const outputs = JSON.parse(result.split("RESULT:")[1]);
  assert.equal(outputs[0].pages, 1);
  assert.ok(outputs[2].pages > 1);
});
