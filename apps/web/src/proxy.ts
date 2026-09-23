import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@dtr/shared/infrastructure/supabase/config";
import type { Database } from "@dtr/shared/infrastructure/database.types";

const elapsedMs = (started: number) => Math.round((performance.now() - started) * 10) / 10;

export async function proxy(request: NextRequest) {
  const started = performance.now();
  const config = supabaseConfig();
  if (!config) {
    console.info("[performance]", JSON.stringify({ scope: "proxy", route: request.nextUrl.pathname, outcome: "not-configured", totalMs: elapsedMs(started) }));
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const claimsStarted = performance.now();
  await supabase.auth.getClaims();
  const getClaimsMs = elapsedMs(claimsStarted);
  response.headers.set("Cache-Control", "private, no-store");
  console.info("[performance]", JSON.stringify({ scope: "proxy", route: request.nextUrl.pathname, getClaimsMs, totalMs: elapsedMs(started) }));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
