import Link from "next/link";
import { internshipToday } from "@dtr/attendance/domain/index";
import { reportsData } from "@/application/queries";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ReportEditor } from "@dtr/reports/presentation/editor";
import { ReportSidebar } from "@dtr/reports/presentation/sidebar";
import { geminiConfiguration } from "@dtr/shared/infrastructure/gemini";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string; id?: string; page?: string; saved?: string; deleted?: string }> }) {
  const params = await searchParams;
  const { date, error, revisions, report, page, history } = await reportsData(params);
  const historyPanel = <section className="panel min-w-0" aria-labelledby="report-history-title"><h2 id="report-history-title" className="section-title">Version history</h2><p className="muted-copy mt-2">Every saved version of this date stays available.</p>
    <ul className="record-list mt-5">{history.reports.map(item => <li className="record-row" key={item.id}><Link className="block min-h-11 text-sm text-accent underline" href={`/reports?id=${item.id}`}><span className="block font-semibold">{item.report_date} · Version {item.revision}</span><span className="mt-1 inline-flex items-center gap-2"><span className="status" data-tone={item.needs_review ? "warning" : item.status === "submitted" ? "success" : undefined}>{item.status === "draft" ? "Draft" : item.status === "ready" ? "Ready" : "Submitted"}</span>{item.needs_review && <span className="text-xs font-semibold text-warning-ink">Attendance changed</span>}</span></Link></li>)}</ul>
    {!history.count && !error && <p className="muted-copy mt-5">No saved reports for this date yet. Save a draft to start its version history.</p>}
    {history.count > 20 && <nav className="mt-6 flex gap-4 text-sm" aria-label="Report history pages">{page > 1 && <Link className="secondary-button" href={`/reports?date=${date}&page=${page - 1}`}>Previous</Link>}{page * 20 < history.count && <Link className="secondary-button" href={`/reports?date=${date}&page=${page + 1}`}>Next</Link>}</nav>}
  </section>;
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading page-heading-row"><div><h1>Daily activity reports</h1><p>Write, review, and submit your DARs.</p></div>
      <form className="date-open-form"><label>Report date<input name="date" type="date" required max={internshipToday()} defaultValue={date} /></label><button className="secondary-button">Open report</button><Link href="/reports/all" className="secondary-button">All reports</Link></form></div>
    {params.saved && <p role="status" className="notice mb-4" data-tone="success">Report updated.</p>}
    {params.deleted && <p role="status" className="notice mb-4" data-tone="success">Draft deleted.</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">{error ? <><div className="min-w-0"><p role="alert" className="notice" data-tone="danger">{error}</p></div><ReportSidebar>{historyPanel}</ReportSidebar></>
      : <ReportEditor key={`${report?.id ?? date}-${report?.updated_at ?? "new"}`} report={report} date={date} isLatest={!report || report.id === revisions[0]?.id} aiDraftEnabled={geminiConfiguration().enabled} sidebar={historyPanel} />}
    </div>
  </main>;
}
