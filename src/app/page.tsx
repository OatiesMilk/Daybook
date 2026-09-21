import Link from "next/link";
import { WorkspaceHeader } from "@/components/workspace-header";
import { dashboardData } from "@/controllers/queries";
import { DashboardProgress } from "@/views/dashboard-progress";
import { TodayCard } from "@/views/today-card";

export default async function Dashboard() {
  const { today, workday, summary, open, record } = await dashboardData();
  // Today's unfinished entry is handled by the Today card, so this list covers earlier days only.
  const pastOpen = open.rows.filter(row => row.work_date !== today);
  const pastCount = open.count - (open.rows.length - pastOpen.length);
  return <main id="main" className="app-main">
    <WorkspaceHeader />
    <div className="page-heading"><h1>Your internship at a glance</h1><p>Attendance recorded through {today}. Pick up where your last workday left off.</p></div>
    <div className="grid items-stretch gap-6 lg:grid-cols-[1.7fr_1fr]">
      <DashboardProgress total={summary.minutes} days={summary.days} />
      <TodayCard today={today} workday={workday} record={record} />
    </div>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
      <section className="panel" aria-label="Needs attention">
        <h2 className="section-title">Needs attention</h2>
        {pastCount > 0 ? <>
          <p className="muted-copy mt-2">Earlier workdays without a time out earn no hours until you complete them.</p>
          <ul className="record-list mt-4">{pastOpen.map(row => <li className="record-row" key={row.work_date}><Link href={`/attendance?date=${row.work_date}`} className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-accent"><span>{row.work_date} · started {row.time_in?.slice(0, 5) ?? "—"}</span><span className="underline">Add time out</span></Link></li>)}</ul>
          {pastCount > pastOpen.length && <Link href="/history?state=open" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">View all {pastCount} unfinished entries</Link>}
        </> : <p className="muted-copy mt-2">You’re caught up. Every earlier workday has a time out.</p>}
      </section>
      <nav className="panel" aria-label="Shortcuts">
        <h2 className="section-title">Go to</h2>
        <ul className="record-list mt-4">
          {[["/reports", "Daily activity reports"], ["/reports/all", "All saved reports"], ["/history", "Attendance history"]].map(([href, label]) => <li className="record-row" key={href}><Link href={href} className="flex min-h-11 items-center text-sm font-semibold text-accent underline">{label}</Link></li>)}
        </ul>
      </nav>
    </div>
  </main>;
}
