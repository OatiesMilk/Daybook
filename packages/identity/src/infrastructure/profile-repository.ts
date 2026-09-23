import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dtr/shared/infrastructure/database.types";
import type { Profile } from "../domain/profile";

type Client = SupabaseClient<Database>;

export async function getProfile(db: Client, owner: string) {
  const { data, error } = await db.from("profiles").select("*").eq("user_id", owner).maybeSingle();
  if (error) throw new Error("Could not load your profile.");
  return data;
}

export async function saveProfile(db: Client, owner: string, profile: Profile) {
  const { error } = await db.from("profiles").upsert({ ...profile, user_id: owner });
  if (error) throw new Error("Could not save your profile. Check that the reports migration has been applied.");
}
