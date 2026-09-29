import "server-only";
import { createClient } from "@dtr/shared/infrastructure/supabase/server";
import type { HelpAccess } from "../application/handler";

export async function authorizeHelp(): Promise<HelpAccess | "forbidden" | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: access, error: accessError } = await supabase.from("allowed_users").select("active").eq("user_id", user.id).maybeSingle();
  if (accessError) throw new Error("access unavailable");
  if (!access?.active) return "forbidden";
  // Only account identity may read the current user's profile name. It is
  // returned directly to that user and never passed to Gemini.
  return {
    async accountName(signal) {
      const { data, error } = await supabase.from("profiles").select("full_name")
        .eq("user_id", user.id).abortSignal(AbortSignal.any([signal, AbortSignal.timeout(1500)])).maybeSingle();
      if (error) throw new Error("profile name unavailable");
      return data?.full_name ?? null;
    },
    async acquire() {
      const { data, error } = await supabase.rpc("acquire_help_request").abortSignal(AbortSignal.timeout(2500));
      if (error || !data) throw new Error("limiter unavailable");
      return data;
    },
    async release(permit) {
      const { error } = await supabase.rpc("release_help_request", { permit }).abortSignal(AbortSignal.timeout(2500));
      if (error) throw new Error("permit release unavailable");
    },
  };
}
