"use client";

import { useActionState } from "react";
import { signup } from "@dtr/identity/application/actions";
import { Turnstile } from "@dtr/identity/presentation/turnstile";

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const [state, action, pending] = useActionState(signup, { error: "", attempt: 0 });
  if (state.success) return <p role="status" className="notice" data-tone="success">{state.success}</p>;
  return <form action={action} className="space-y-5">
    <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
    <label>Password<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={1024} aria-describedby="password-help" /><span id="password-help" className="mt-1 block text-xs font-normal text-muted">Use at least 8 characters. Additional project password rules also apply.</span></label>
    <label>Confirm password<input type="password" name="password_confirmation" autoComplete="new-password" required minLength={8} maxLength={1024} /></label>
    {turnstileSiteKey && <Turnstile key={state.attempt} siteKey={turnstileSiteKey} />}
    {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}
    <button className="primary-button w-full" disabled={pending}>{pending ? "Creating account..." : "Create account"}</button>
  </form>;
}
