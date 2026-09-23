"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { googleLogin, login } from "@dtr/identity/application/actions";

function GoogleButton() {
  const { pending } = useFormStatus();
  return <button className="secondary-button w-full" disabled={pending}>{pending ? "Connecting…" : "Continue with Google"}</button>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return <>
    <form action={action} className="space-y-5">
      <label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={1024} /></label>
      {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}
      <button className="primary-button w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
    <form action={googleLogin}><GoogleButton /></form>
  </>;
}
