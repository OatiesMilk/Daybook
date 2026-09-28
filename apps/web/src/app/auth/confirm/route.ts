import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@dtr/shared/infrastructure/supabase/server";
import { siteOrigin } from "@dtr/identity/application/auth";

const allowedTypes = new Set<EmailOtpType>(["email", "signup"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && allowedTypes.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/?confirmed=1", siteOrigin()));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", siteOrigin()));
}
