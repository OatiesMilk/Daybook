import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import type { Database } from "@/lib/database.types";

export async function createClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase environment variables are not configured.");
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  });
}
