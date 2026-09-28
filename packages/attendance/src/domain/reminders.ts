import { INTERNSHIP_TIME_ZONE } from "./calculation.ts";

export type Reminder = { id: string; kind: "time_out" | "report"; date: string; title: string; description: string; href: string };
type ReminderDay = { work_date: string; absent: boolean; time_out: string | null };
type ReminderReport = { status: "draft" | "ready" | "submitted"; needs_review: boolean };
export const DAILY_REMINDER_START = 18 * 60 + 20;

export function reminderWindow(today: string) {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return start.toISOString().slice(0, 10);
}

export function internshipClockMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: INTERNSHIP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  return Number(parts.find(part => part.type === "hour")?.value) * 60 + Number(parts.find(part => part.type === "minute")?.value);
}

/** Today's open entry is due ten minutes before standard 18:30 time out; DAR remains due until submitted. */
export function attendanceReminders(entries: ReminderDay[], reports: ReadonlyMap<string, ReminderReport>, today: string, clockMinutes: number): Reminder[] {
  const from = reminderWindow(today);
  return entries.filter(day => !day.absent && day.work_date >= from && day.work_date <= today)
    .sort((a, b) => b.work_date.localeCompare(a.work_date))
    .flatMap<Reminder>(day => {
      const reminders: Reminder[] = [];
      const due = day.work_date < today || clockMinutes >= DAILY_REMINDER_START;
      if (!day.time_out && due) reminders.push({
        id: `time_out:${day.work_date}`, kind: "time_out" as const, date: day.work_date,
        title: "Add your time out", description: "This attendance entry is still open and earns no hours until completed.", href: `/attendance?date=${day.work_date}`,
      });
      const report = reports.get(day.work_date);
      if ((due || day.time_out) && (!report || report.status !== "submitted" || report.needs_review)) reminders.push({
        id: `report:${day.work_date}:${report?.needs_review ? "review" : report?.status ?? "missing"}`, kind: "report", date: day.work_date,
        title: report?.needs_review ? "Review your DAR" : report?.status === "ready" ? "Submit your DAR" : report ? "Finish your DAR" : "Prepare your DAR",
        description: report?.needs_review ? "Attendance changed. Review this report before confirming submission again."
          : report?.status === "ready" ? "Your DAR is ready. Send it to your supervisor, then mark it Submitted."
          : report ? "Your DAR is still a draft. Finish it, mark it Ready, then confirm submission after sending it."
          : "Prepare your daily activity report. Complete attendance before marking it Ready, then confirm submission after sending it.",
        href: `/reports?date=${day.work_date}`,
      });
      return reminders;
    });
}
