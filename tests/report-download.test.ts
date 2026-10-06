import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("past PDF downloads use the current renderer and frozen details instead of stale archives", () => {
  execFileSync(process.execPath, ["--experimental-test-module-mocks", "--conditions=react-server", "--input-type=module", "-e", `
    import { mock } from 'node:test';
    import assert from 'node:assert/strict';
    const id = '11111111-1111-4111-8111-111111111111';
    const snapshot = { profile: { full_name: 'Saved Name', last_name: 'Name', school: 'Saved School', department: 'Saved Team', target_hours: 486 },
      date: '2026-09-17', totalMinutes: 3750,
      rows: [{ project: 'Saved Project', task: 'Saved activity', status: 'Completed', remarks: '' }] };
    let report = { id, report_date: snapshot.date, status: 'submitted', snapshot, rows: [] };
    let renders = 0, downloads = 0, failRender = false;
    const bucket = {
      download: async () => { downloads++; return { data: new Blob(['old archived design']) }; },
      upload: async () => { throw Error('Unexpected archive write'); },
    };
    mock.module('@dtr/identity/application/auth', { namedExports: { requireOwner: async () => ({
      user: { id: 'owner' }, supabase: { storage: { from: () => bucket } },
    }) } });
    mock.module('@dtr/identity/infrastructure/profile-repository', { namedExports: { getProfile: async () => { throw Error('Saved profile must be preserved'); } } });
    mock.module('@dtr/attendance/infrastructure/repository', { namedExports: { attendanceSummary: async () => { throw Error('Saved hours must be preserved'); } } });
    mock.module('@dtr/reports/infrastructure/repository', { namedExports: { getReport: async (_db, user, reportId) => {
      assert.equal(user, 'owner'); assert.equal(reportId, id); return report;
    } } });
    mock.module('@dtr/reports/infrastructure/pdf-renderer', { namedExports: { renderReportPdf: async input => {
      assert.equal(input, snapshot); renders++; if (failRender) throw Error('Renderer failed'); return Buffer.from('new template PDF');
    } } });
    const { exportReport } = await import('./packages/reports/src/application/export.ts');
    for (const status of ['ready', 'submitted']) {
      report.status = status;
      const response = await exportReport(id, 'pdf');
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'new template PDF');
      assert.equal(response.headers.get('Content-Type'), 'application/pdf');
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('X-Report-Preview'), null);
    }
    assert.equal(renders, 2); assert.equal(downloads, 0);
    const docx = await exportReport(id, 'docx');
    assert.equal(await docx.text(), 'old archived design'); assert.equal(downloads, 1);
    failRender = true;
    assert.equal((await exportReport(id, 'pdf')).status, 503);
    assert.equal(downloads, 1); // Do not silently fall back to the old PDF design.
    report.snapshot = null;
    assert.equal((await exportReport(id, 'pdf')).status, 409);
  `], { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8", timeout: 30000 });
});
