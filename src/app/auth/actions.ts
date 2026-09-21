"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/auth";

export type LoginState = { error: string };

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
      password.length < 1 || password.length > 1024) {
    return { error: "Enter your email address and password." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: "Sign-in failed. Check your credentials and try again." };
  redirect("/");
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
