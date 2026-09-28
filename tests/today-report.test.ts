import { test } from "node:test";
import assert from "node:assert/strict";
import { todayReportSummary, type TodayReport } from "../packages/reports/src/domain/today-report.ts";

test("today report summary shows the right status, next action and meaningful saved activity count", () => {
  assert.deepEqual(todayReportSummary(null), { label: "Not started", tone: undefined, action: "Start report", activityCount: 0 });
  const draft: TodayReport = { id: "example", status: "draft", needs_review: false, rows: [
    { project: "Project", task: "Task", remarks: "", status: "Completed" },
    { project: "", task: "Another task", remarks: "", status: "Ongoing" },
    { project: " ", task: " ", remarks: " ", status: "Ongoing" },
  ] };
  assert.equal(todayReportSummary(draft).activityCount, 2);
  assert.equal(todayReportSummary(draft).action, "Continue draft");
  assert.equal(todayReportSummary({ ...draft, status: "ready" }).label, "Ready");
  assert.equal(todayReportSummary({ ...draft, status: "submitted" }).action, "View report");
  for (const status of ["draft", "ready", "submitted"] as const) {
    assert.equal(todayReportSummary({ ...draft, status, needs_review: true }).label, "Needs review");
    assert.equal(todayReportSummary({ ...draft, status, needs_review: true }).action, "Review report");
  }
  assert.equal(todayReportSummary({ ...draft, rows: [] }).activityCount, 0);
  assert.equal(draft.status, "draft");
});
