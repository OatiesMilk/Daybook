"use client";
import { useActionState } from "react";
import { profileAction } from "@dtr/identity/application/profile-actions";
import type { Profile } from "@dtr/identity/domain/profile";

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, action, pending] = useActionState(profileAction, { error: "" });
  return <form action={action} className="panel max-w-2xl space-y-5">
    {profile?.target_hours == null && <p className="notice" data-tone="info">Complete your profile and set the internship hours required by your school to personalize your workspace.</p>}
    {([['full_name','Full name'],['last_name','Last name (for filenames)'],['school','School'],['department','Department / team']] as const).map(([key,label]) =>
      <label key={key}>{label}<input name={key} required maxLength={key === "last_name" ? 100 : 200} defaultValue={profile?.[key] ?? ""} /></label>)}
    <label>Required internship hours<input name="target_hours" type="number" inputMode="numeric" required min={1} max={10000} step={1} defaultValue={profile?.target_hours ?? ""} placeholder="Enter your required hours" /></label>
    {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}{state.success && <p role="status" className="notice" data-tone="success">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
