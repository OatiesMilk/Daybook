import Link from "next/link";
import { internshipToday } from "@/lib/attendance";
import { reportsData } from "@/controllers/queries";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ReportEditor } from "@/views/report-editor";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string; id?: string; page?: string; saved?: string }> }) {
  const params = await searchParams;
  const { date, error, revisions, report, page, history } = await reportsData(params);
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading"><h1>Daily activity reports</h1><p>Write activities, review the snapshot, then mark the report submitted after sending it.</p></div>
    <form className="mb-6 flex flex-wrap items-end gap-3"><label className="w-full max-w-56">Report date<input name="date" type="date" required max={internshipToday()} defaultValue={date} /></label><button className="secondary-button">Open report</button><Link href="/reports/all" className="secondary-button">All reports</Link><Link href="/settings" className="secondary-button">Edit profile</Link></form>
    {params.saved && <p role="status" className="notice mb-4" data-tone="success">Report updated.</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]"><div className="min-w-0">{error ? <p role="alert" className="notice" data-tone="danger">{error}</p> : <ReportEditor key={`${report?.id ?? date}-${report?.updated_at ?? "new"}`} report={report} date={date} isLatest={!report || report.id === revisions[0]?.id} />}</div>
      <aside className="panel min-w-0"><h2 className="section-title">Report history for {date}</h2><p className="muted-copy mt-2">Versions of this date stay saved when you update the report.</p>
        <ul className="record-list mt-5">{history.reports.map(item => <li className="record-row" key={item.id}><Link className="block min-h-11 text-sm text-accent underline" href={`/reports?id=${item.id}`}><span className="block font-semibold">{item.report_date} · Version {item.revision}</span><span className="mt-1 inline-flex items-center gap-2"><span className="status" data-tone={item.needs_review ? "warning" : item.status === "submitted" ? "success" : undefined}>{item.status === "draft" ? "Draft" : item.status === "ready" ? "Ready" : "Submitted"}</span>{item.needs_review && <span className="text-xs font-semibold text-warning-ink">Attendance changed</span>}</span></Link></li>)}</ul>
        {!history.count && !error && <p className="muted-copy mt-5">No saved reports for this date yet. Save a draft to start its version history.</p>}
        {history.count > 20 && <nav className="mt-6 flex gap-4 text-sm" aria-label="Report history pages">{page > 1 && <Link className="secondary-button" href={`/reports?date=${date}&page=${page - 1}`}>Previous</Link>}{page * 20 < history.count && <Link className="secondary-button" href={`/reports?date=${date}&page=${page + 1}`}>Next</Link>}</nav>}
      </aside>
    </div>
  </main>;
}
