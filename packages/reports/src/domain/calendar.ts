import type { Report } from "./rules.ts";

export type CalendarReport = Pick<Report, "id" | "report_date" | "revision" | "status" | "needs_review">;
export type CalendarDay = { date: string; day: number; inMonth: boolean };

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function parseCalendarMonth(value: string | undefined, today: string): string {
  if (!/^\d{4}-\d{2}$/.test(value ?? "")) return today.slice(0, 7);
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 7) === value ? value! : today.slice(0, 7);
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return iso(new Date(Date.UTC(year, monthNumber - 1 + offset, 1))).slice(0, 7);
}

export function calendarMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    from: iso(new Date(Date.UTC(year, monthNumber - 1, 1))),
    to: iso(new Date(Date.UTC(year, monthNumber, 0))),
  };
}

export function calendarGrid(month: string): CalendarDay[] {
  const { from, to } = calendarMonthBounds(month);
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const days: CalendarDay[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = iso(cursor);
    days.push({ date, day: cursor.getUTCDate(), inMonth: date.startsWith(month) });
  }
  return days;
}

export function latestReportPerDate(reports: CalendarReport[]): CalendarReport[] {
  const latest = new Map<string, CalendarReport>();
  for (const report of reports) {
    const current = latest.get(report.report_date);
    if (!current || report.revision > current.revision) latest.set(report.report_date, report);
  }
  return [...latest.values()].sort((a, b) => a.report_date.localeCompare(b.report_date));
}
