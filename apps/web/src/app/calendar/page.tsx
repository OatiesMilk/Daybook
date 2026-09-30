import Link from "next/link";
import { calendarData } from "@/application/queries";
import { WorkspaceHeader } from "@/components/workspace-header";
import { attendanceState, calendarCredit, calendarSummary, formatMinutes, isWorkday } from "@dtr/attendance/domain/index";
import { calendarGrid, shiftCalendarMonth } from "@dtr/reports/domain/calendar";

const weekdays = [["Sunday", "Sun"], ["Monday", "Mon"], ["Tuesday", "Tue"], ["Wednesday", "Wed"], ["Thursday", "Thu"], ["Friday", "Fri"], ["Saturday", "Sat"]] as const;
type DotTone = "success" | "info" | "warning" | "danger";
const legend: [DotTone, string][] = [["success", "Submitted"], ["info", "Draft or Ready"], ["warning", "Needs action"], ["danger", "Absent"]];
const statusLabel = { draft: "Draft", ready: "Ready", submitted: "Submitted" } as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const { month: requestedMonth, date: requestedDate } = await searchParams;
  const { today, month, reports, attendance } = await calendarData(requestedMonth);
  const attendanceByDate = new Map(attendance.map(record => [record.work_date, record]));
  const reportByDate = new Map(reports.map(report => [report.report_date, report]));
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const currentMonth = today.slice(0, 7);
  const days = calendarGrid(month);
  const selectedDate = days.find(day => day.date === requestedDate && day.inMonth && day.date <= today && isWorkday(day.date))?.date;
  const selectedEntry = selectedDate ? attendanceByDate.get(selectedDate) : undefined;
  const selectedReport = selectedDate ? reportByDate.get(selectedDate) : undefined;
  const summary = calendarSummary(attendance, new Set(reportByDate.keys()));

  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading flex flex-wrap items-end justify-between gap-4"><div><h1>Work calendar</h1><p>See your hours, absences, and reports. Select a workday for details.</p></div>
      <div className="flex flex-wrap gap-2"><Link className="secondary-button" href={`/calendar?month=${shiftCalendarMonth(month, -1)}`} aria-label="Previous month">Previous</Link><Link className="secondary-button" href={`/calendar?month=${currentMonth}`}>Today</Link><Link className="secondary-button" href={`/calendar?month=${shiftCalendarMonth(month, 1)}`} aria-label="Next month">Next</Link></div>
    </div>
    <dl className="calendar-summary" aria-label={`${label} summary`}>
      <div className="panel"><dt>Credited hours</dt><dd>{formatMinutes(summary.minutes)}</dd></div>
      <div className="panel"><dt>Worked days</dt><dd>{summary.workedDays}</dd></div>
      <div className="panel"><dt>Absences</dt><dd>{summary.absences}</dd></div>
      <div className="panel"><dt>Missing reports</dt><dd>{summary.missingReports}</dd></div>
    </dl>
    <section className="panel calendar-panel" aria-labelledby="calendar-month"><h2 id="calendar-month" className="section-title mb-5">{label}</h2>
      <form className="calendar-month-picker" action="/calendar"><label htmlFor="calendar-month-input">Jump to month</label><input id="calendar-month-input" type="month" name="month" defaultValue={month} required /><button className="secondary-button" type="submit">Go</button></form>
      <div className="calendar-grid" role="grid" aria-label={`${label} report calendar`}>
        {weekdays.map(([full, short]) => <div className="calendar-weekday" role="columnheader" aria-label={full} key={full}><span className="calendar-weekday-long" aria-hidden="true">{short}</span><span className="calendar-weekday-short" aria-hidden="true">{short[0]}</span></div>)}
        {days.map(day => {
          const report = reportByDate.get(day.date);
          const entry = attendanceByDate.get(day.date);
          const absent = entry?.absent ?? false;
          const state = entry ? attendanceState(entry, today) : null;
          const creditedMinutes = entry ? calendarCredit(entry) : null;
          const missingReport = Boolean(entry && !absent && entry.time_out && !report);
          const hoursLabel = creditedMinutes != null ? formatMinutes(creditedMinutes)
            : state === "in_progress" ? "In progress" : state === "unfinished" ? "Unfinished" : null;
          const eligible = day.inMonth && day.date <= today && isWorkday(day.date);
          // Phones show one dot per distinct state; the link's aria-label and day details carry the words.
          const dots = [...new Set<DotTone>([
            ...(absent ? ["danger" as const] : []),
            ...(missingReport || state === "unfinished" || report?.needs_review ? ["warning" as const] : []),
            ...(report && !report.needs_review ? [report.status === "submitted" ? "success" as const : "info" as const] : []),
          ])];
          const contents = <><time dateTime={day.date} className="calendar-day-number">{day.day}</time>
            {dots.length > 0 && <span className="calendar-dots" aria-hidden="true">{dots.map(tone => <span key={tone} className="calendar-dot" data-tone={tone} />)}</span>}
            {hoursLabel && <span className="calendar-hours" data-open={creditedMinutes == null || undefined} title={creditedMinutes != null ? `${hoursLabel} credited` : "Hours are credited after time out is saved"}>{hoursLabel}</span>}
            {(absent || report || missingReport) && <span className="calendar-badges">
            {missingReport && <span className="status calendar-status" data-tone="warning">Missing report</span>}
            {absent && <span className="status calendar-status" data-tone="danger">Absent</span>}
            {report && <span className="status calendar-status" data-tone={report.needs_review ? "warning" : report.status === "submitted" ? "success" : undefined}>{report.needs_review ? "Needs review" : statusLabel[report.status]}</span>}
          </span>}</>;
          return <div role="gridcell" key={day.date} aria-current={day.date === today ? "date" : undefined} className="calendar-cell" data-selected={day.date === selectedDate || undefined} data-outside={!day.inMonth || undefined} data-future={day.inMonth && day.date > today || undefined}>
            {eligible ? <Link href={`/calendar?month=${month}&date=${day.date}#day-details`} aria-label={`View ${day.date}${absent ? ", absent" : ""}${missingReport ? ", missing report" : ""}${report ? `, report ${report.needs_review ? "needs review" : statusLabel[report.status].toLowerCase()}` : ""}${hoursLabel ? `, ${hoursLabel}${creditedMinutes != null ? " credited" : ""}` : ""}`}>{contents}</Link> : <div>{contents}</div>}
          </div>;
        })}
      </div>
      <ul className="calendar-legend" aria-label="Calendar dot legend">{legend.map(([tone, text]) => <li key={tone}><span className="calendar-dot" data-tone={tone} aria-hidden="true" />{text}</li>)}</ul>
      <p className="muted-copy mt-5">Hours include regular credit and enabled overtime. Open entries earn no hours yet. Missing reports are completed, non-absent attendance days without a saved report.<span className="calendar-legend-hint"> Tap a day to see its hours and report.</span></p>
      {!reports.length && !attendance.length && <p className="muted-copy mt-3">No saved attendance or reports this month. Choose a past or current weekday to get started.</p>}
    </section>
    {selectedDate && <section id="day-details" className="panel calendar-details mt-6" aria-labelledby="day-details-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="day-details-heading" className="section-title">{new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedDate}T00:00:00Z`))}</h2><Link className="secondary-button" href={`/calendar?month=${month}`}>Close details</Link></div>
      <dl className="calendar-detail-list">
        <div><dt>Attendance</dt><dd>{!selectedEntry ? "Not recorded" : selectedEntry.absent ? "Absent" : selectedEntry.time_out ? "Worked" : selectedDate === today ? "In progress" : "Unfinished"}</dd></div>
        <div><dt>Time in / out</dt><dd>{selectedEntry && !selectedEntry.absent ? `${selectedEntry.time_in?.slice(0, 5) ?? "—"} / ${selectedEntry.time_out?.slice(0, 5) ?? "—"}` : "—"}</dd></div>
        <div><dt>Location</dt><dd>{selectedEntry && !selectedEntry.absent ? selectedEntry.work_location === "home" ? "Work from home" : "Office" : "—"}</dd></div>
        <div><dt>Regular credit</dt><dd>{selectedEntry && calendarCredit(selectedEntry) !== null ? formatMinutes(selectedEntry.absent ? 0 : selectedEntry.regular_minutes ?? 0) : "Not credited yet"}</dd></div>
        <div><dt>Overtime credit</dt><dd>{selectedEntry && calendarCredit(selectedEntry) !== null ? formatMinutes(selectedEntry.absent ? 0 : selectedEntry.overtime_minutes ?? 0) : "Not credited yet"}</dd></div>
        <div><dt>Report</dt><dd>{selectedReport ? selectedReport.needs_review ? "Needs review" : statusLabel[selectedReport.status] : selectedEntry && !selectedEntry.absent && selectedEntry.time_out ? "Missing report" : "Not started"}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3"><Link className="secondary-button" href={`/attendance?date=${selectedDate}`}>{selectedEntry ? "Edit attendance" : "Add attendance"}</Link><Link className="primary-button" href={`/reports?date=${selectedDate}`}>{selectedReport ? "Open report" : "Start report"}</Link></div>
    </section>}
  </main>;
}
