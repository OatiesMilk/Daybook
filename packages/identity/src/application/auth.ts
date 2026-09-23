import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@dtr/shared/infrastructure/supabase/server";
import { supabaseConfig } from "@dtr/shared/infrastructure/supabase/config";

const elapsedMs = (started: number) => Math.round((performance.now() - started) * 10) / 10;
const logAuthTiming = (values: Record<string, string | number>) => console.info("[performance]", JSON.stringify({ scope: "requireOwner", ...values }));

export async function requireOwner() {
  const started = performance.now();
  if (!supabaseConfig()) {
    logAuthTiming({ outcome: "not-configured", totalMs: elapsedMs(started) });
    redirect("/setup");
  }
  const supabase = await createClient();
  const userStarted = performance.now();
  const { data: { user }, error } = await supabase.auth.getUser();
  const getUserMs = elapsedMs(userStarted);
  if (error || !user) {
    logAuthTiming({ outcome: "unauthenticated", getUserMs, totalMs: elapsedMs(started) });
    redirect("/login");
  }
  const accessStarted = performance.now();
  const { data: access, error: accessError } = await supabase
    .from("allowed_users").select("active").eq("user_id", user.id).maybeSingle();
  const allowedUsersMs = elapsedMs(accessStarted);
  if (accessError) {
    logAuthTiming({ outcome: "access-error", getUserMs, allowedUsersMs, totalMs: elapsedMs(started) });
    throw new Error("Unable to verify account access. Check the database migration and connection.");
  }
  if (!access?.active) {
    logAuthTiming({ outcome: "denied", getUserMs, allowedUsersMs, totalMs: elapsedMs(started) });
    redirect("/access-denied");
  }
  logAuthTiming({ outcome: "allowed", getUserMs, allowedUsersMs, totalMs: elapsedMs(started) });
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
