import Link from "next/link";
import { todayReportSummary, type TodayReport } from "../domain/today-report";

export function TodayReportSection({ date, report, inProgress, absent }: { date: string; report: TodayReport | null; inProgress: boolean; absent: boolean }) {
  const summary = todayReportSummary(report);
  return <section className="today-report-section mt-6 border-t border-line pt-5" aria-label="Today's activity report">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Today’s activity report</h3><span className="status" data-tone={summary.tone}>{summary.label}</span></div>
    <p className="muted-copy mt-3">{report ? `${summary.activityCount} ${summary.activityCount === 1 ? "activity" : "activities"} saved.` : absent ? "No report started. Add one only if your school requires an absence report." : "Capture what you worked on today."}</p>
    {report?.needs_review ? <p className="muted-copy mt-2">Attendance changed. Review the report before confirming submission again.</p>
      : report?.status === "ready" ? <p className="muted-copy mt-2">Send your DAR to your supervisor, then mark it Submitted.</p>
      : inProgress && (!report || report.status === "draft") && <p className="muted-copy mt-2">Write activities as you work. Finalize after time out.</p>}
    <Link className="secondary-button mt-4 w-full sm:w-auto" href={report ? `/reports?id=${report.id}` : `/reports?date=${date}`}>{summary.action}</Link>
  </section>;
}
