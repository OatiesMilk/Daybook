"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { internshipToday, validateWorkday } from "@/lib/attendance";
import { commandReport, saveProfile } from "@/models/reports";
import { validateRows, type Profile } from "@/models/report-rules";
import type { ActionState } from "./attendance";

export async function reportAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireOwner();
  let id: string;
  try {
    const date = String(form.get("date") ?? ""); validateWorkday(date);
    if (date > internshipToday()) throw new Error("Choose today or an earlier date.");
    const command = String(form.get("command") ?? "save");
    if (!["save", "ready", "submit", "reopen"].includes(command)) throw new Error("Invalid report action.");
    if (command === "submit" && form.get("confirm") !== "on") throw new Error("Confirm that you submitted this report.");
    id = await commandReport(supabase, { command, work_day: date,
      report_id: String(form.get("id") ?? "") || undefined,
      expected_version: String(form.get("version") ?? "") || undefined,
      ...(command === "save" ? { activity_rows: validateRows(JSON.parse(String(form.get("rows") ?? "[]"))) } : {}),
    });
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not update report." }; }
  revalidatePath("/reports"); revalidatePath("/"); redirect(`/reports?id=${id}&saved=1`);
}

export async function profileAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  try {
    const profile = Object.fromEntries(["full_name", "last_name", "school", "department"].map(key => [key, String(form.get(key) ?? "").trim()])) as Profile;
    for (const [key, value] of Object.entries(profile)) if (!value || value.length > (key === "last_name" ? 100 : 200)) throw new Error("Complete all profile fields within their length limits.");
    await saveProfile(supabase, user.id, profile);
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not save profile." }; }
  revalidatePath("/settings"); revalidatePath("/reports"); return { error: "", success: "Profile saved. Existing report snapshots remain unchanged." };
}
