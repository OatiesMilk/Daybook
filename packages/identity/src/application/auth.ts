import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@dtr/shared/infrastructure/supabase/server";
import { supabaseConfig } from "@dtr/shared/infrastructure/supabase/config";

export async function requireOwner() {
  if (!supabaseConfig()) redirect("/setup");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: access, error: accessError } = await supabase
    .from("allowed_users").select("active").eq("user_id", user.id).maybeSingle();
  if (accessError) throw new Error("Unable to verify account access. Check the database migration and connection.");
  if (!access?.active) redirect("/access-denied");
  return { supabase, user };
}

export function siteOrigin() {
  const value = process.env.SITE_URL;
  if (!value) throw new Error("Set SITE_URL before using Google sign-in.");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("SITE_URL must use HTTPS, except localhost.");
  }
  return url.origin;
}
