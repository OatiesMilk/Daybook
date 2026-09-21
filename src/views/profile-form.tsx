"use client";
import { useActionState } from "react";
import { profileAction } from "@/controllers/reports";
import type { Profile } from "@/models/report-rules";

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, action, pending] = useActionState(profileAction, { error: "" });
  return <form action={action} className="panel max-w-2xl space-y-5">
    {([['full_name','Full name'],['last_name','Last name (for filenames)'],['school','School'],['department','Department / team']] as const).map(([key,label]) =>
      <label key={key}>{label}<input name={key} required maxLength={key === "last_name" ? 100 : 200} defaultValue={profile?.[key] ?? ""} /></label>)}
    <p className="text-xs text-muted">Filename format: DAR_LASTNAME_MMDDYY.docx or .pdf. Revision history is stored separately.</p>
    {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}{state.success && <p role="status" className="notice" data-tone="success">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
