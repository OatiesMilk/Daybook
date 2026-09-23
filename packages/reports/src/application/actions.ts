"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@dtr/identity/application/auth";
import { internshipToday, validateWorkday } from "@dtr/attendance/domain/index";
import { commandReport } from "../infrastructure/repository";
import { validateRows } from "../domain/rules";
import type { ActionState } from "@dtr/shared/contracts/action-state";

export async function reportAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireOwner();
  let id: string;
  let date = "";
  let command = "save";
  try {
    date = String(form.get("date") ?? ""); validateWorkday(date);
    if (date > internshipToday()) throw new Error("Choose today or an earlier date.");
    command = String(form.get("command") ?? "save");
    if (!["save", "ready", "submit", "reopen", "delete"].includes(command)) throw new Error("Invalid report action.");
    if (command === "submit" && form.get("confirm") !== "on") throw new Error("Confirm that you submitted this report.");
    if (command === "delete" && form.get("confirm_delete") !== "on") throw new Error("Confirm that you want to delete this draft.");
    id = await commandReport(supabase, { command, work_day: date,
      report_id: String(form.get("id") ?? "") || undefined,
      expected_version: String(form.get("version") ?? "") || undefined,
      ...(command === "save" ? { activity_rows: validateRows(JSON.parse(String(form.get("rows") ?? "[]"))) } : {}),
    });
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not update report." }; }
  revalidatePath("/reports"); revalidatePath("/");
  if (command === "delete") redirect(`/reports?date=${encodeURIComponent(date)}&deleted=1`);
  redirect(`/reports?id=${id}&saved=1`);
}
