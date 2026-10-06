"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "./auth";
import { CarryOverConflict, getProfile, saveProfile } from "../infrastructure/profile-repository";
import { parseCarryOver, type Profile } from "../domain/profile";
import { formatShortDate, internshipToday } from "@dtr/shared/domain/internship-date";
import type { ActionState } from "@dtr/shared/contracts/action-state";

function refresh() { for (const path of ["/settings", "/reports", "/", "/welcome"]) revalidatePath(path); }

/** Server-side validation of the full profile form, shared by onboarding and the Profile page. */
async function saveFullProfile(form: FormData) {
  const { supabase, user } = await requireOwner();
  const fields = Object.fromEntries(["full_name", "last_name", "school", "department"].map(key => [key, String(form.get(key) ?? "").trim()])) as Omit<Profile, "target_hours">;
  for (const [key, value] of Object.entries(fields)) if (!value || value.length > (key === "last_name" ? 100 : 200)) throw new Error("Complete all profile fields within their length limits.");
  const target_hours = Number(form.get("target_hours"));
  if (!Number.isInteger(target_hours) || target_hours < 1 || target_hours > 10000) throw new Error("Required internship hours must be a whole number from 1 to 10,000.");
  const carryOver = parseCarryOver({
    mode: String(form.get("carry_mode") ?? ""), hours: String(form.get("prior_hours") ?? ""), minutes: String(form.get("prior_extra_minutes") ?? ""),
    asOf: String(form.get("prior_hours_as_of") ?? ""), note: String(form.get("prior_hours_note") ?? ""),
  }, target_hours, internshipToday());
  try { await saveProfile(supabase, user.id, { ...fields, target_hours }, carryOver); return carryOver; }
  catch (cause) {
    if (cause instanceof CarryOverConflict) throw new Error(`You already have attendance recorded on ${formatShortDate(cause.overlap)}. Choose a counted-up-to date before your first Daybook attendance, or remove those records first.`);
    throw cause;
  }
}

export async function profileAction(_state: ActionState, form: FormData): Promise<ActionState> {
  let carried: number;
  try { carried = (await saveFullProfile(form)).prior_minutes; }
  catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not save profile." }; }
  refresh();
  return { error: "", success: carried > 0 ? "Profile saved. If your carried-over hours changed, Ready and Submitted reports are marked for review." : "Profile saved." };
}

export async function onboardingAction(_state: ActionState, form: FormData): Promise<ActionState> {
  try { await saveFullProfile(form); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not save your details." }; }
  refresh();
  redirect("/");
}

export async function importProfileAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  try {
    const selected = new Set(form.getAll("fields").map(String));
    const allowed = ["full_name", "school", "department"] as const;
    if (!allowed.some(key => selected.has(key))) throw new Error("Select at least one profile field to update.");
    const current = await getProfile(supabase, user.id);
    if (!current?.last_name.trim()) throw new Error("Set your last name in Profile before applying imported profile fields.");
    const profile: Profile = { full_name: current.full_name, last_name: current.last_name, school: current.school, department: current.department, target_hours: current.target_hours };
    for (const key of allowed) if (selected.has(key)) profile[key] = String(form.get(key) ?? "").trim();
    for (const [key, value] of Object.entries(profile).filter(([key]) => key !== "target_hours")) if (!value || String(value).length > (key === "last_name" ? 100 : 200)) throw new Error("Imported profile fields must be complete and within their length limits.");
    await saveProfile(supabase, user.id, profile);
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not update your profile." }; }
  revalidatePath("/settings"); revalidatePath("/reports");
  return { error: "", success: "Selected profile fields updated. Existing report snapshots were not changed." };
}
