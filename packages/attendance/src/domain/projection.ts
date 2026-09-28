import { calendarCredit } from "./calendar.ts";

type RecentDay = Parameters<typeof calendarCredit>[0];

/** Forecast future weekdays, starting after today; saved totals already include today's credit. */
export function completionEstimate(today: string, totalMinutes: number, targetHours: number, recent: RecentDay[]) {
  const remainingMinutes = Math.max(0, targetHours * 60 - totalMinutes);
  if (remainingMinutes === 0) return { date: null, remainingMinutes, daysLeft: 0, averageMinutes: 0, sampleDays: 0, complete: true };
  const completed = recent.filter(day => !day.absent && day.time_out && day.work_date <= today)
    .sort((a, b) => b.work_date.localeCompare(a.work_date)).slice(0, 10);
  const minutes = completed.reduce((sum, day) => sum + (calendarCredit(day) ?? 0), 0);
  if (!completed.length || minutes <= 0) return null;
  const average = minutes / completed.length;
  const daysLeft = Math.ceil(remainingMinutes / average);
  // Whole weeks plus at most six daily steps; avoids a large loop for very slow pace.
  const date = new Date(`${today}T00:00:00Z`);
  let pending = daysLeft;
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
    pending--;
  }
  date.setUTCDate(date.getUTCDate() + Math.floor(pending / 5) * 7);
  for (let left = pending % 5; left > 0;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left--;
  }
  return { date: date.getUTCFullYear() > 9999 ? null : date.toISOString().slice(0, 10), remainingMinutes, daysLeft, averageMinutes: Math.round(average), sampleDays: completed.length, complete: false };
}
