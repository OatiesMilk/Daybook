import type { Report } from "./rules.ts";

export type TodayReport = Pick<Report, "id" | "status" | "needs_review" | "rows">;

export function todayReportSummary(report: TodayReport | null) {
  const activityCount = report?.rows.filter(row => row.project.trim() || row.task.trim() || row.remarks.trim()).length ?? 0;
  if (!report) return { label: "Not started", tone: undefined, action: "Start report", activityCount };
  if (report.needs_review) return { label: "Needs review", tone: "warning", action: "Review report", activityCount };
  if (report.status === "draft") return { label: "Draft", tone: undefined, action: "Continue draft", activityCount };
  if (report.status === "ready") return { label: "Ready", tone: "info", action: "Open ready report", activityCount };
  return { label: "Submitted", tone: "success", action: "View report", activityCount };
}
