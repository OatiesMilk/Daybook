"use server";

import { redirect } from "next/navigation";
import { createClient } from "@dtr/shared/infrastructure/supabase/server";
import { siteOrigin } from "@dtr/identity/application/auth";

export type LoginState = { error: string };
export type SignupState = { error: string; success?: string; attempt: number };

function validCredentials(form: FormData, minimumPasswordLength = 1) {
  const email = form.get("email");
  const password = form.get("password");
  return typeof email === "string" && typeof password === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254 &&
    password.length >= minimumPasswordLength && password.length <= 1024 ? { email: email.trim(), password } : null;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const credentials = validCredentials(form);
  if (!credentials) {
    return { error: "Enter your email address and password." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: "Sign-in failed. Check your credentials and try again." };
  redirect("/");
}

export async function signup(state: SignupState, form: FormData): Promise<SignupState> {
  const fail = (error: string): SignupState => ({ error, attempt: state.attempt + 1 });
  if (process.env.EMAIL_SIGNUP_ENABLED !== "true") return fail("Use Google to create your account.");
  const accepted = (): SignupState => ({
    error: "",
    success: "Check your inbox for a confirmation link. If an account can be created for this address, we sent the next step.",
    attempt: state.attempt + 1,
  });
  const credentials = validCredentials(form, 8);
  const confirmation = form.get("password_confirmation");
  if (!credentials) return fail("Enter a valid email address and a password of at least 8 characters.");
  if (confirmation !== credentials.password) return fail("Passwords do not match.");

  const captchaToken = form.get("captcha_token");
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (captchaEnabled && (typeof captchaToken !== "string" || !captchaToken)) {
    return fail("Complete the security check and try again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/confirm`,
      ...(typeof captchaToken === "string" && captchaToken ? { captchaToken } : {}),
    },
  });

  // Treat an existing address like an accepted request. With Confirm Email
  // enabled Supabase already returns an obfuscated user; this fallback keeps
  // the UI non-enumerating if project configuration drifts.
  if (error?.code === "user_already_exists" || error?.message === "User already registered") {
    return accepted();
  }
  if (error?.code === "weak_password") return fail("Choose a stronger password that meets the security requirements.");
  if (error?.code === "captcha_failed") return fail("The security check expired or failed. Please try again.");
  if (error?.status === 429 || error?.code?.includes("rate_limit")) return fail("Too many attempts. Wait a few minutes, then try again.");
  if (error?.code === "signup_disabled") return fail("Signups are temporarily unavailable.");
  if (error) return fail("Signup could not be completed. Please try again.");
  return accepted();
}

export async function googleLogin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteOrigin()}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Could not sign out. Please retry.");
  redirect("/login");
}
