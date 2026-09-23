import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dtr/shared/infrastructure/database.types";
import type { AttendanceValues } from "../domain/rules";

type Client = SupabaseClient<Database>;
export const HISTORY_PAGE_SIZE = 20;

export async function attendanceSummary(db: Client, throughDate: string) {
  const { data, error } = await db.rpc("attendance_summary", { through_date: throughDate });
  if (error) throw new Error("Could not load attendance totals.");
  return { minutes: Number(data?.[0]?.total_minutes ?? 0), days: Number(data?.[0]?.recorded_days ?? 0) };
}

export async function findAttendance(db: Client, userId: string, date: string) {
  const { data, error } = await db.from("attendance").select("*").eq("user_id", userId).eq("work_date", date).maybeSingle();
  if (error) throw new Error("Could not load this attendance record.");
  return data;
}

export async function openAttendance(db: Client, userId: string) {
  const { data, count, error } = await db.from("attendance")
    .select("work_date,time_in", { count: "exact" })
    .eq("user_id", userId).eq("absent", false).is("time_out", null)
    .order("work_date", { ascending: false }).limit(HISTORY_PAGE_SIZE);
  if (error) throw new Error("Could not load unfinished attendance.");
  return { rows: data ?? [], count: count ?? 0 };
}

export async function listAttendance(db: Client, userId: string, filters: { from?: string; to?: string; location?: string; state?: string; page: number }) {
  let query = db.from("attendance").select("*", { count: "exact" }).eq("user_id", userId).order("work_date", { ascending: false });
  if (filters.from) query = query.gte("work_date", filters.from);
  if (filters.to) query = query.lte("work_date", filters.to);
  if (filters.location === "office" || filters.location === "home") query = query.eq("work_location", filters.location);
  if (filters.state === "open") query = query.eq("absent", false).is("time_out", null);
  if (filters.state === "complete") query = query.eq("absent", false).not("time_out", "is", null);
  if (filters.state === "absent") query = query.eq("absent", true);
  const start = (filters.page - 1) * HISTORY_PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + HISTORY_PAGE_SIZE - 1);
  if (error) throw new Error("Could not load attendance history.");
  return { rows: data ?? [], count: count ?? 0 };
}

function writeError(code: string | undefined) {
  if (code === "23505") return "An attendance record already exists on that date. Open it from history to edit.";
  if (code === "23514") return "The date or times are not allowed. Check the weekday, time order, and future date.";
  if (code === "42703" || code === "23502") return "Apply the latest attendance migration before saving this record.";
  return "Could not save the change. Please retry.";
}

export async function saveAttendance(db: Client, userId: string, values: AttendanceValues, original?: { date: string; version: string }) {
  const query = original
    ? db.from("attendance").update(values).eq("user_id", userId).eq("work_date", original.date).eq("updated_at", original.version)
    : db.from("attendance").insert({ ...values, user_id: userId });
  const { data, error } = await query.select("work_date").maybeSingle();
  if (error) throw new Error(writeError(error.code));
  if (!data) throw new Error("This record changed in another tab or was deleted. Reload before editing.");
}

export async function deleteAttendance(db: Client, userId: string, date: string, version: string) {
  const { data, error } = await db.from("attendance").delete().eq("user_id", userId).eq("work_date", date).eq("updated_at", version).select("work_date").maybeSingle();
  if (error) throw new Error("Could not delete this record. Please retry.");
  if (!data) throw new Error("This record changed or was already deleted. Reload the page.");
}
