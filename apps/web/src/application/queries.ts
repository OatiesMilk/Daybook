import "server-only";
import { requireOwner } from "@dtr/identity/application/auth";
import { internshipToday, isWorkday, validateWorkday } from "@dtr/attendance/domain/index";
import { attendanceSummary, findAttendance, listAttendance, openAttendance } from "@dtr/attendance/infrastructure/repository";
import { getReport, listAllReports, reportHistory, reportsForDate, type AllReportsFilters } from "@dtr/reports/infrastructure/repository";
import { getProfile } from "@dtr/identity/infrastructure/profile-repository";
import { parsePage } from "@dtr/reports/domain/rules";

const reportStatuses = ["draft", "ready", "submitted"] as const;
/** Accepts only a real YYYY-MM-DD calendar date from the URL; anything else is ignored. */
const parseIsoDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;
const elapsedMs = (started: number) => Math.round((performance.now() - started) * 10) / 10;
function logTiming(scope: string, phase: string, started: number) {
  console.info("[performance]", JSON.stringify({ scope, phase, durationMs: elapsedMs(started) }));
}
async function timed<T>(scope: string, phase: string, work: () => Promise<T>) {
  const started = performance.now();
  try { return await work(); }
  finally { logTiming(scope, phase, started); }
}

export async function dashboardData() {
  const started = performance.now();
  const { supabase, user } = await timed("dashboardData", "requireOwner", requireOwner);
  const today = internshipToday(); const workday = isWorkday(today);
  const [summary, open, record, profile] = await Promise.all([
    timed("dashboardData", "attendanceSummary", () => attendanceSummary(supabase, today)),
    timed("dashboardData", "openAttendance", () => openAttendance(supabase, user.id)),
    workday ? timed("dashboardData", "findAttendance", () => findAttendance(supabase, user.id, today)) : Promise.resolve(null),
    timed("dashboardData", "getProfile", () => getProfile(supabase, user.id)),
  ]);
  logTiming("dashboardData", "total", started);
  return { today, workday, summary, open, record, targetHours: profile?.target_hours ?? 486 };
}

export async function attendanceData(requestedDate?: string) {
  const started = performance.now();
  const { supabase, user } = await timed("attendanceData", "requireOwner", requireOwner);
  const today = internshipToday(); const date = requestedDate ?? today;
  let error = "";
  try { validateWorkday(date); if (date > today) throw new Error("Choose today or an earlier weekday."); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Choose a valid date."; }
  const record = error ? null : await timed("attendanceData", "findAttendance", () => findAttendance(supabase, user.id, date));
  logTiming("attendanceData", "total", started);
  return { today, date, error, record };
}

export async function historyData(params: Record<string, string | undefined>) {
  const started = performance.now();
  const { supabase, user } = await timed("historyData", "requireOwner", requireOwner);
  const validDate = parseIsoDate;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const filters = { from: validDate(params.from), to: validDate(params.to), location: params.location, state: params.state, page };
  const result = await timed("historyData", "listAttendance", () => listAttendance(supabase, user.id, filters));
  logTiming("historyData", "total", started);
  return { filters, page, today: internshipToday(), ...result };
}

export async function reportsData(params: { date?: string; id?: string; page?: string }) {
  const started = performance.now();
  const { supabase, user } = await timed("reportsData", "requireOwner", requireOwner);
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const selected = params.id && /^[0-9a-f-]{36}$/i.test(params.id)
    ? await timed("reportsData", "getReport", () => getReport(supabase, user.id, params.id!))
    : null;
  const date = selected?.report_date ?? params.date ?? internshipToday();
  let error = params.id && !selected ? "Report not found." : "";
  try { validateWorkday(date); if (date > internshipToday()) throw new Error("Choose today or an earlier weekday."); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Choose a valid date."; }
  if (error) {
    logTiming("reportsData", "total", started);
    return { date, error, revisions: [], report: null, page, history: { reports: [], count: 0 } };
  }
  const [revisions, history] = await Promise.all([
    timed("reportsData", "reportsForDate", () => reportsForDate(supabase, user.id, date)),
    timed("reportsData", "reportHistory", () => reportHistory(supabase, user.id, date, page)),
  ]);
  logTiming("reportsData", "total", started);
  return { date, error, revisions, report: selected ?? revisions[0] ?? null, page, history };
}

export async function allReportsData(params: { page?: string; from?: string; to?: string; status?: string }) {
  const started = performance.now();
  const { supabase, user } = await timed("allReportsData", "requireOwner", requireOwner);
  const page = parsePage(params.page);
  const filters: AllReportsFilters = { from: parseIsoDate(params.from), to: parseIsoDate(params.to), status: reportStatuses.find(s => s === params.status) };
  if (filters.from && filters.to && filters.from > filters.to) {
    logTiming("allReportsData", "total", started);
    return { page, filters, error: "The From date must be on or before the To date.", reports: [], count: 0, retryable: false };
  }
  try {
    const result = await timed("allReportsData", "listAllReports", () => listAllReports(supabase, user.id, page, filters));
    logTiming("allReportsData", "total", started);
    return { page, filters, error: "", retryable: false, ...result };
  }
  catch (cause) { return { page, filters, error: cause instanceof Error ? cause.message : "Could not load reports.", reports: [], count: 0, retryable: true }; }
}

export async function profileData() {
  const started = performance.now();
  const { supabase, user } = await timed("profileData", "requireOwner", requireOwner);
  const profile = await timed("profileData", "getProfile", () => getProfile(supabase, user.id));
  logTiming("profileData", "total", started);
  return profile;
}
