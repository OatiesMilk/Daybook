import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const origin = siteOrigin();
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", origin));
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
