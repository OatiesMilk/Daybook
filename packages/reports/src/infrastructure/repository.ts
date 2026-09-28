import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dtr/shared/infrastructure/database.types";
import type { ActivityRow, Report } from "../domain/rules";
import { latestReportPerDate, type CalendarReport } from "../domain/calendar";

type Client = SupabaseClient<Database>;
export async function getReport(db: Client, owner: string, id: string) {
  const { data, error } = await db.from("reports").select("*").eq("user_id", owner).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the report. Check that the reports migration has been applied.");
  return data;
}
export async function reportsForDate(db: Client, owner: string, date: string) {
  const { data, error } = await db.from("reports").select("*").eq("user_id", owner).eq("report_date", date).order("revision", { ascending: false }).limit(1);
  if (error) throw new Error("Could not load reports. Apply the reports migration first.");
  return data ?? [];
}
export async function reportHistory(db: Client, owner: string, date: string, page: number) {
  const { data, count, error } = await db.from("reports").select("id,report_date,revision,status,needs_review", { count: "exact" }).eq("user_id", owner).eq("report_date", date)
    .order("revision", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Could not load reports. Apply the reports migration first.");
  return { reports: data ?? [], count: count ?? 0 };
}
export const ALL_REPORTS_PAGE_SIZE = 20;
// Every saved version across all dates, newest date first. The (user_id, report_date, revision) unique index serves this order.
export type AllReportsFilters = { from?: string; to?: string; status?: Report["status"] };
export async function listAllReports(db: Client, owner: string, page: number, filters: AllReportsFilters = {}) {
  const start = (page - 1) * ALL_REPORTS_PAGE_SIZE;
  let query = db.from("reports").select("id,report_date,revision,status,needs_review", { count: "exact" }).eq("user_id", owner);
  if (filters.from) query = query.gte("report_date", filters.from);
  if (filters.to) query = query.lte("report_date", filters.to);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, count, error } = await query.order("report_date", { ascending: false }).order("revision", { ascending: false }).range(start, start + ALL_REPORTS_PAGE_SIZE - 1);
  if (error) throw new Error("Could not load reports. Apply the reports migration first.");
  return { reports: data ?? [], count: count ?? 0 };
}
export async function reportsForMonth(db: Client, owner: string, from: string, to: string) {
  const { data, error } = await db.from("reports").select("id,report_date,revision,status,needs_review")
    .eq("user_id", owner).gte("report_date", from).lte("report_date", to)
    .order("report_date", { ascending: true }).order("revision", { ascending: false });
  if (error) throw new Error("Could not load the report calendar. Please retry.");
  return latestReportPerDate((data ?? []) as CalendarReport[]);
}
export async function commandReport(db: Client, args: { command: string; work_day: string; report_id?: string; expected_version?: string; activity_rows?: ActivityRow[] }) {
  const { data, error } = await db.rpc("report_command", args);
  if (error) {
    if (error.code === "P0001") throw new Error(error.message);
    if (error.code === "PGRST202") throw new Error("The report action is missing from Supabase. Apply the reports migration and refresh the API schema cache.");
    if (error.code === "42501") throw new Error("Your account does not have permission to update this report. Sign in again or check your access entry.");
    const code = /^[A-Z0-9]{5,12}$/.test(error.code) ? error.code : "unknown";
    const action = args.command === "submit" ? "submit" : args.command === "delete" ? "delete" : "update";
    throw new Error(`Could not ${action} the report (error ${code}). Please retry and share this code if it continues.`);
  }
  return data;
}
