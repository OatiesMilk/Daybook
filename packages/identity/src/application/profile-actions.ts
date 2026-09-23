"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "./auth";
import { getProfile, saveProfile } from "../infrastructure/profile-repository";
import type { Profile } from "../domain/profile";
import type { ActionState } from "@dtr/shared/contracts/action-state";

export async function profileAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  try {
    const fields = Object.fromEntries(["full_name", "last_name", "school", "department"].map(key => [key, String(form.get(key) ?? "").trim()])) as Omit<Profile, "target_hours">;
    for (const [key, value] of Object.entries(fields)) if (!value || value.length > (key === "last_name" ? 100 : 200)) throw new Error("Complete all profile fields within their length limits.");
    const target_hours = Number(form.get("target_hours"));
    if (!Number.isInteger(target_hours) || target_hours < 1 || target_hours > 10000) throw new Error("Required internship hours must be a whole number from 1 to 10,000.");
    await saveProfile(supabase, user.id, { ...fields, target_hours });
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not save profile." }; }
  revalidatePath("/settings"); revalidatePath("/reports"); revalidatePath("/");
  return { error: "", success: "Profile saved. Existing report snapshots remain unchanged." };
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
