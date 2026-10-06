/** Local wall-clock times. No timezone conversion or fractional-hour arithmetic. */
import { INTERNSHIP_TIME_ZONE, internshipToday } from "@dtr/shared/domain/internship-date";
export { INTERNSHIP_TIME_ZONE, internshipToday };

export type AttendanceInput = {
  date: string;
  timeIn: string;
  timeOut: string;
  overtime: boolean;
};
export type AttendanceCredit = {
  regularMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
};

export function parseTime(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Enter a valid time in HH:MM format.");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateWorkday(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date.");
  }
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    throw new Error("Attendance is available for weekdays only.");
  }
}

export function calculateAttendance(input: AttendanceInput): AttendanceCredit {
  validateWorkday(input.date);
  if (typeof input.overtime !== "boolean") throw new Error("Choose whether to count overtime.");
  const start = parseTime(input.timeIn);
  const end = parseTime(input.timeOut);
  if (end <= start) throw new Error("Time out must be after time in on the same day.");
  const overlap = (from: number, to: number) => Math.max(0, Math.min(end, to) - Math.max(start, from));
  const regularMinutes = overlap(510, 720) + overlap(780, 1110);
  const overtimeMinutes = input.overtime ? overlap(1110, 1440) : 0;
  return { regularMinutes, overtimeMinutes, totalMinutes: regularMinutes + overtimeMinutes };
}

export function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function isWorkday(value: string): boolean {
  try { validateWorkday(value); return true; } catch { return false; }
}

/** Average credit per worked day, and how many more worked days the remaining target needs at that average. Null until a day is worked. */
export function pace(totalMinutes: number, workedDays: number, targetMinutes: number): { averageMinutes: number; daysLeft: number } | null {
  if (workedDays <= 0 || totalMinutes <= 0) return null;
  const average = totalMinutes / workedDays;
  return { averageMinutes: Math.round(average), daysLeft: Math.ceil(Math.max(0, targetMinutes - totalMinutes) / average) };
}

export type AttendanceState = "absent" | "worked" | "in_progress" | "unfinished";
/** A record without time out is still in progress on its own date; on any earlier date it is unfinished. Derived, so it never goes stale. */
export function attendanceState(record: { absent: boolean; time_out: string | null; work_date: string }, today: string): AttendanceState {
  if (record.absent) return "absent";
  if (record.time_out) return "worked";
  return record.work_date === today ? "in_progress" : "unfinished";
}
