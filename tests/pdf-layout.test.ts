import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("PDF rows fit their text and columns adapt, so short activities share a page", () => {
  // Same server import condition as Next.js; see pdf-export.test.ts.
  const result = execFileSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", `
    import { renderReportPdf } from '../../packages/reports/src/infrastructure/pdf-renderer.ts';
    import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const profile = { full_name: 'Juan Dela Cruz', last_name: 'Dela Cruz', school: 'Example University', department: 'IT', target_hours: 486 };
    const short = n => Array.from({ length: n }, (_, i) => ({ project: 'Microgenesis Supply Chain Portal',
      task: 'Performed UAT and bug fixes on TSK-' + (80 + i) + '.', status: i % 2 ? 'Ongoing' : 'Completed', remarks: i % 3 ? '' : 'None' }));
    const long = { project: 'Portal', task: 'Conducted user acceptance testing for the purchase order approval flow, executing the agreed scenarios and logging defects found in the shared tracker for follow-up.', status: 'Completed', remarks: '' };
    const out = {};
    for (const [name, rows] of Object.entries({ nine: short(9), ten: short(10), mixed: [long, ...short(5)] })) {
      const loading = getDocument({ data: new Uint8Array(await renderReportPdf({ profile, date: '2026-09-17', totalMinutes: 3750, rows })) });
      const pdf = await loading.promise;
      const project = [];
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const items = (await (await pdf.getPage(p)).getTextContent()).items.filter(x => x.str);
        if (items.some(x => x.transform[5] < 307 && x.transform[5] > 54 && (x.transform[4] < 73 || x.transform[4] + x.width > 732))) throw Error('Table text outside the table edges');
        text += items.map(x => x.str).join(' ');
        project.push(...items.filter(x => x.str.startsWith('Microgenesis')).map(x => x.str));
      }
      rows.forEach((row, i) => { if (!text.includes(row.task.slice(0, 30))) throw Error(name + ' lost activity ' + i); });
      out[name] = { pages: pdf.numPages, projectOneLine: project.every(s => s === 'Microgenesis Supply Chain Portal') };
      await loading.destroy();
    }
    console.log('RESULT:' + JSON.stringify(out));
  `], { cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)), encoding: "utf8", timeout: 60000 });
  const out = JSON.parse(result.split("RESULT:")[1]);
  // One-line rows are 28pt, so nine fit under the header (previously a 41pt minimum allowed six).
  assert.equal(out.nine.pages, 1);
  assert.equal(out.ten.pages, 2, "font size stays fixed, so a tenth row continues on page 2");
  // Project widens enough to keep the name on one line instead of wrapping into tall rows.
  assert.equal(out.mixed.pages, 1);
  assert.equal(out.mixed.projectOneLine, true);
  assert.equal(out.nine.projectOneLine, true);
});
