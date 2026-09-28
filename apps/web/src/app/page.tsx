import Link from "next/link";
import { WorkspaceHeader } from "@/components/workspace-header";
import { dashboardData } from "@/application/queries";
import { DashboardProgress } from "@dtr/attendance/presentation/dashboard-progress";
import { TodayCard } from "@dtr/attendance/presentation/today-card";
import { TodayReportSection } from "@dtr/reports/presentation/today-report";

export default async function Dashboard() {
  const { today, workday, summary, open, record, report, targetHours, estimate } = await dashboardData();
  // Today's unfinished entry is handled by the Today card, so this list covers earlier days only.
  const pastOpen = open.rows.filter(row => row.work_date !== today);
  const pastCount = open.count - (open.rows.length - pastOpen.length);
  return <main id="main" className="app-main">
    <WorkspaceHeader />
    <div className="page-heading"><h1>Your internship at a glance</h1><p>Attendance recorded through {today}. Pick up where your last workday left off.</p></div>
    <div className="grid items-start gap-6 lg:items-stretch lg:grid-cols-[1.7fr_1fr]">
      {targetHours == null ? <section className="panel" aria-labelledby="target-setup-heading">
        <span className="status" data-tone="info">First-time setup</span>
        <h2 id="target-setup-heading" className="section-title mt-4">Set your internship target</h2>
        <p className="muted-copy mt-2">Add the hours required by your school before tracking progress. Your attendance records stay private to your account.</p>
        <Link href="/settings" className="primary-button mt-5">Complete profile</Link>
      </section> : <DashboardProgress total={summary.minutes} days={summary.days} targetHours={targetHours} estimate={estimate} />}
      <TodayCard today={today} workday={workday} record={record}>
        {workday && <TodayReportSection date={today} report={report} inProgress={Boolean(record && !record.absent && !record.time_out)} absent={record?.absent ?? false} />}
      </TodayCard>
    </div>
    {pastCount > 0 ?
      <section className="panel mt-6" aria-label="Needs attention">
        <h2 className="section-title">Needs attention</h2>
        <>
          <p className="muted-copy mt-2">Earlier workdays without a time out earn no hours until you complete them.</p>
          <ul className="record-list mt-4">{pastOpen.map(row => <li className="record-row" key={row.work_date}><Link href={`/attendance?date=${row.work_date}`} className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-accent"><span>{row.work_date} · started {row.time_in?.slice(0, 5) ?? "—"}</span><span className="underline">Add time out</span></Link></li>)}</ul>
          {pastCount > pastOpen.length && <Link href="/history?state=open" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">View all {pastCount} unfinished entries</Link>}
        </>
      </section> : <p className="muted-copy mt-5 flex items-start gap-2">
        <svg className="mt-0.5 shrink-0 text-accent" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        <span>You’re caught up on attendance. No earlier workdays need time out.</span>
      </p>}
      <nav className="dashboard-shortcuts mt-6" aria-label="Shortcuts">
        <h2 className="sr-only">Shortcuts</h2>
        <ul className="shortcut-grid">
          {[
            { href: "/reports", label: "Daily activity reports", icon: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" /><path d="M9 12h6M9 16h6" /></> },
            { href: "/reports/all", label: "All saved reports", icon: <><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></> },
            { href: "/history", label: "Attendance history", icon: <><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.5" /><path d="M3.5 3.5v5h5" /><path d="M12 7.5v5l3.5 2" /></> },
            { href: "/calendar", label: "Report calendar", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></> },
          ].map(({ href, label, icon }) => <li key={href}>
            <Link href={href} className="shortcut-link min-h-11">
              <span className="shortcut-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              </span>
              <span className="shortcut-label">{label}</span>
              <svg className="shortcut-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          </li>)}
        </ul>
      </nav>
  </main>;
}
