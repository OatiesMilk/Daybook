import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dtr/shared/infrastructure/database.types";
import type { CarryOver, Profile } from "../domain/profile";

type Client = SupabaseClient<Database>;

export async function getProfile(db: Client, owner: string) {
  const { data, error } = await db.from("profiles").select("*").eq("user_id", owner).maybeSingle();
  if (error) throw new Error("Could not load your profile.");
  return data;
}

/** Error raised when the database rejects carried-over hours; `overlap` is the latest conflicting attendance date. */
export class CarryOverConflict extends Error {
  constructor(readonly overlap: string) { super("Attendance already exists inside the carried-over period."); }
}

export async function saveProfile(db: Client, owner: string, profile: Profile, carryOver?: CarryOver) {
  const { error } = await db.from("profiles").upsert({ ...profile, ...carryOver, user_id: owner });
  if (!error) return;
  if (error.code === "DBC02") throw new CarryOverConflict(error.details ?? "");
  if (error.code === "23514") throw new Error("These values are not allowed. Check that carried-over hours do not exceed your target and the date is not in the future.");
  if (error.code === "42703") throw new Error("Apply the latest profile migration before saving carried-over hours.");
  throw new Error("Could not save your profile. Please retry.");
}
