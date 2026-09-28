type CalendarAttendance = {
  work_date: string;
  absent: boolean;
  time_out: string | null;
  regular_minutes: number | null;
  overtime_minutes: number | null;
};

export function calendarCredit(entry: CalendarAttendance): number | null {
  if (entry.absent) return 0;
  if (!entry.time_out) return null;
  return (entry.regular_minutes ?? 0) + (entry.overtime_minutes ?? 0);
}

export function calendarSummary(entries: CalendarAttendance[], reportDates: ReadonlySet<string>) {
  return entries.reduce((summary, entry) => {
    if (entry.absent) summary.absences++;
    else if (entry.time_out) {
      summary.workedDays++;
      summary.minutes += calendarCredit(entry) ?? 0;
      if (!reportDates.has(entry.work_date)) summary.missingReports++;
    }
    return summary;
  }, { minutes: 0, workedDays: 0, absences: 0, missingReports: 0 });
}
