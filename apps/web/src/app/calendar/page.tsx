import Link from "next/link";
import { calendarData } from "@/application/queries";
import { WorkspaceHeader } from "@/components/workspace-header";
import { isWorkday } from "@dtr/attendance/domain/index";
import { calendarGrid, shiftCalendarMonth } from "@dtr/reports/domain/calendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statusLabel = { draft: "Draft", ready: "Ready", submitted: "Submitted" } as const;
const shortStatus = { draft: "D", ready: "R", submitted: "S" } as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requestedMonth } = await searchParams;
  const { today, month, reports } = await calendarData(requestedMonth);
  const reportByDate = new Map(reports.map(report => [report.report_date, report]));
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const currentMonth = today.slice(0, 7);

  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading flex flex-wrap items-end justify-between gap-4"><div><h1>Report calendar</h1><p>See each day&apos;s latest saved report and open a workday to continue writing.</p></div>
      <div className="flex flex-wrap gap-2"><Link className="secondary-button" href={`/calendar?month=${shiftCalendarMonth(month, -1)}`} aria-label="Previous month">Previous</Link><Link className="secondary-button" href={`/calendar?month=${currentMonth}`}>Today</Link><Link className="secondary-button" href={`/calendar?month=${shiftCalendarMonth(month, 1)}`} aria-label="Next month">Next</Link></div>
    </div>
    <section className="panel calendar-panel" aria-labelledby="calendar-month"><h2 id="calendar-month" className="section-title mb-5">{label}</h2>
      <div className="calendar-grid" role="grid" aria-label={`${label} report calendar`}>
        {weekdays.map(day => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {calendarGrid(month).map(day => {
          const report = reportByDate.get(day.date);
          const eligible = day.inMonth && day.date <= today && isWorkday(day.date);
          const contents = <><time dateTime={day.date} className="calendar-day-number">{day.day}</time>{report && <span className="calendar-badges"><span className="status calendar-status" data-tone={report.needs_review ? "warning" : report.status === "submitted" ? "success" : undefined} aria-label={report.needs_review ? "Needs review" : statusLabel[report.status]}><span className="calendar-status-full">{report.needs_review ? "Needs review" : statusLabel[report.status]}</span><span className="calendar-status-short" aria-hidden="true">{report.needs_review ? "!" : shortStatus[report.status]}</span></span></span>}</>;
          return <div role="gridcell" key={day.date} aria-current={day.date === today ? "date" : undefined} className="calendar-cell" data-outside={!day.inMonth || undefined} data-future={day.inMonth && day.date > today || undefined}>
            {eligible ? <Link href={`/reports?date=${day.date}`} aria-label={`${report ? "Open" : "Start"} report for ${day.date}`}>{contents}</Link> : <div>{contents}</div>}
          </div>;
        })}
      </div>
      {!reports.length && <p className="muted-copy mt-5">No saved reports this month. Choose a past or current weekday to start one.</p>}
    </section>
  </main>;
}
