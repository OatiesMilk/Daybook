"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@dtr/identity/application/auth";
import { validateWorkday } from "@dtr/attendance/domain/index";
import { parseAttendanceForm } from "@dtr/attendance/domain/rules";
import { deleteAttendance, saveAttendance } from "@dtr/attendance/infrastructure/repository";
import type { ActionState } from "@dtr/shared/contracts/action-state";

export type { ActionState } from "@dtr/shared/contracts/action-state";

function refresh() { for (const path of ["/", "/attendance", "/history", "/reports", "/calendar", "/notifications"]) revalidatePath(path); }

export async function saveAttendanceAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  let date: string;
  try {
    const values = parseAttendanceForm(form);
    date = values.work_date;
    const originalDate = String(form.get("original_date") ?? "");
    const version = String(form.get("version") ?? "");
    if (originalDate) {
      validateWorkday(originalDate);
      if (!version || !Number.isFinite(Date.parse(version))) throw new Error("Reload the record before editing.");
    }
    await saveAttendance(supabase, user.id, values, originalDate ? { date: originalDate, version } : undefined);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not save attendance." }; }
  refresh();
  redirect(`/attendance?date=${date}&saved=1`);
}

export async function deleteAttendanceAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  try {
    const date = String(form.get("original_date") ?? "");
    validateWorkday(date);
    if (form.get("confirm") !== "on") throw new Error("Confirm deletion first.");
    await deleteAttendance(supabase, user.id, date, String(form.get("version") ?? ""));
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not delete attendance." }; }
  refresh();
  redirect("/history?deleted=1");
}
