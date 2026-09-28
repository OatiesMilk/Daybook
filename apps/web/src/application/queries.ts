import "server-only";
import { requireOwner } from "@dtr/identity/application/auth";
import { attendanceReminders, completionEstimate, internshipClockMinutes, internshipToday, isWorkday, reminderWindow, validateWorkday } from "@dtr/attendance/domain/index";
import { attendanceForMonth, attendanceSummary, findAttendance, listAttendance, openAttendance, recentWorkedAttendance } from "@dtr/attendance/infrastructure/repository";
import { getReport, listAllReports, reminderReportsForRange, reportHistory, reportsForDate, reportsForMonth, todayReport, type AllReportsFilters } from "@dtr/reports/infrastructure/repository";
import { calendarMonthBounds, parseCalendarMonth } from "@dtr/reports/domain/calendar";
import { getProfile } from "@dtr/identity/infrastructure/profile-repository";
import { parsePage } from "@dtr/reports/domain/rules";

const reportStatuses = ["draft", "ready", "submitted"] as const;
/** Accepts only a real YYYY-MM-DD calendar date from the URL; anything else is ignored. */
const parseIsoDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;

export async function dashboardData() {
  const { supabase, user } = await requireOwner();
  const today = internshipToday(); const workday = isWorkday(today);
  const [summary, open, record, profile, recent, report] = await Promise.all([
    attendanceSummary(supabase, today), openAttendance(supabase, user.id),
    workday ? findAttendance(supabase, user.id, today) : Promise.resolve(null),
    getProfile(supabase, user.id),
    recentWorkedAttendance(supabase, user.id, today),
    workday ? todayReport(supabase, user.id, today) : Promise.resolve(null),
  ]);
  const targetHours = profile?.target_hours ?? null;
  return { today, workday, summary, open, record, report, targetHours, estimate: targetHours == null ? null : completionEstimate(today, summary.minutes, targetHours, recent) };
}

export async function notificationData() {
  const { supabase, user } = await requireOwner();
  const now = new Date();
  const today = internshipToday(now);
  const from = reminderWindow(today);
  const [entries, reports] = await Promise.all([
    attendanceForMonth(supabase, user.id, from, today), reminderReportsForRange(supabase, user.id, from, today),
  ]);
  return { userId: user.id, today, from, reminders: attendanceReminders(entries, reports, today, internshipClockMinutes(now)) };
}

export async function attendanceData(requestedDate?: string) {
  const { supabase, user } = await requireOwner();
  const today = internshipToday(); const date = requestedDate ?? today;
  let error = "";
  try { validateWorkday(date); if (date > today) throw new Error("Choose today or an earlier weekday."); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Choose a valid date."; }
  return { today, date, error, record: error ? null : await findAttendance(supabase, user.id, date) };
}

export async function historyData(params: Record<string, string | undefined>) {
  const { supabase, user } = await requireOwner();
  const validDate = parseIsoDate;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const filters = { from: validDate(params.from), to: validDate(params.to), location: params.location, state: params.state, page };
  return { filters, page, today: internshipToday(), ...await listAttendance(supabase, user.id, filters) };
}

export async function reportsData(params: { date?: string; id?: string; page?: string }) {
  const { supabase, user } = await requireOwner();
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const selected = params.id && /^[0-9a-f-]{36}$/i.test(params.id) ? await getReport(supabase, user.id, params.id) : null;
  const date = selected?.report_date ?? params.date ?? internshipToday();
  let error = params.id && !selected ? "Report not found." : "";
  try { validateWorkday(date); if (date > internshipToday()) throw new Error("Choose today or an earlier weekday."); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Choose a valid date."; }
  if (error) return { date, error, revisions: [], report: null, page, history: { reports: [], count: 0 } };
  const [revisions, history] = await Promise.all([
    reportsForDate(supabase, user.id, date), reportHistory(supabase, user.id, date, page),
  ]);
  return { date, error, revisions, report: selected ?? revisions[0] ?? null, page, history };
}

export async function allReportsData(params: { page?: string; from?: string; to?: string; status?: string }) {
  const { supabase, user } = await requireOwner();
  const page = parsePage(params.page);
  const filters: AllReportsFilters = { from: parseIsoDate(params.from), to: parseIsoDate(params.to), status: reportStatuses.find(s => s === params.status) };
  if (filters.from && filters.to && filters.from > filters.to) return { page, filters, error: "The From date must be on or before the To date.", reports: [], count: 0, retryable: false };
  try { return { page, filters, error: "", retryable: false, ...await listAllReports(supabase, user.id, page, filters) }; }
  catch (cause) { return { page, filters, error: cause instanceof Error ? cause.message : "Could not load reports.", reports: [], count: 0, retryable: true }; }
}

export async function calendarData(requestedMonth?: string) {
  const { supabase, user } = await requireOwner();
  const today = internshipToday();
  const month = parseCalendarMonth(requestedMonth, today);
  const { from, to } = calendarMonthBounds(month);
  const [reports, attendance] = await Promise.all([
    reportsForMonth(supabase, user.id, from, to),
    attendanceForMonth(supabase, user.id, from, to),
  ]);
  return { today, month, reports, attendance };
}

export async function profileData() {
  const { supabase, user } = await requireOwner();
  return getProfile(supabase, user.id);
}
