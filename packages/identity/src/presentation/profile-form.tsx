"use client";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { onboardingAction, profileAction } from "@dtr/identity/application/profile-actions";
import { PRIOR_NOTE_MAX, type CarryOver, type Profile } from "@dtr/identity/domain/profile";

type Mode = "fresh" | "continuing";

/**
 * One form for first-run onboarding and the Profile page, so both validate and
 * save the same way. Onboarding forces an explicit fresh/continuing choice;
 * the Profile page starts from whatever is saved.
 */
export function ProfileForm({ profile, today, onboarding = false }: { profile: (Profile & Partial<CarryOver>) | null; today: string; onboarding?: boolean }) {
  const [state, action, pending] = useActionState(onboarding ? onboardingAction : profileAction, { error: "" });
  const saved = profile?.prior_minutes ?? 0;
  const [mode, setMode] = useState<Mode | null>(saved > 0 ? "continuing" : onboarding ? null : "fresh");
  // After hydration, submitting through a transition keeps typed values after a
  // validation error (React resets <form action> forms). The action prop still works pre-hydration.
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(() => action(data)); };
  return <form action={action} onSubmit={submit} className="panel max-w-2xl space-y-5">
    {!onboarding && profile?.target_hours == null && <p className="notice" data-tone="info">Complete your profile and set the internship hours required by your school to personalize your workspace.</p>}
    {([['full_name','Full name'],['last_name','Last name (for filenames)'],['school','School'],['department','Department / team']] as const).map(([key,label]) =>
      <label key={key}>{label}<input name={key} required maxLength={key === "last_name" ? 100 : 200} defaultValue={profile?.[key] ?? ""} autoComplete={key === "full_name" ? "name" : key === "last_name" ? "family-name" : "off"} /></label>)}
    <label>Required internship hours<input name="target_hours" type="number" inputMode="numeric" required min={1} max={10000} step={1} defaultValue={profile?.target_hours ?? ""} placeholder="Enter your required hours" /></label>

    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Have you already rendered hours for this internship?</legend>
      <div className="carry-choice">
        <label className="carry-option"><input type="radio" name="carry_mode" value="fresh" required checked={mode === "fresh"} onChange={() => setMode("fresh")} />
          <span><span className="block font-semibold">Starting fresh</span><span className="carry-option-hint">Daybook counts every hour from your first attendance.</span></span></label>
        <label className="carry-option"><input type="radio" name="carry_mode" value="continuing" required checked={mode === "continuing"} onChange={() => setMode("continuing")} />
          <span><span className="block font-semibold">Continuing an internship</span><span className="carry-option-hint">Add the hours you rendered before using Daybook.</span></span></label>
      </div>
      {mode === "continuing" && <div className="carry-fields space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label>Hours rendered<input name="prior_hours" type="number" inputMode="numeric" required min={0} max={10000} step={1} defaultValue={saved ? Math.floor(saved / 60) : ""} /></label>
          <label>Minutes<input name="prior_extra_minutes" type="number" inputMode="numeric" min={0} max={59} step={1} defaultValue={saved ? saved % 60 : ""} placeholder="0" /></label>
        </div>
        <label>Counted up to<input name="prior_hours_as_of" type="date" required max={today} defaultValue={profile?.prior_hours_as_of ?? ""} aria-describedby="carry-date-help" /></label>
        <p id="carry-date-help" className="text-sm text-muted">The last day these hours cover. You can record attendance in Daybook only after this date, so hours are never counted twice.</p>
        <label>Note <span className="font-normal text-muted">(optional)</span><textarea name="prior_hours_note" rows={2} maxLength={PRIOR_NOTE_MAX} defaultValue={profile?.prior_hours_note ?? ""} placeholder="For example: from my school DTR signed by my supervisor" /></label>
      </div>}
    </fieldset>

    {!onboarding && saved > 0 && <p className="text-sm text-muted">Changing carried-over hours marks your Ready and Submitted reports for review, because their cumulative totals change.</p>}
    {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}{state.success && <p role="status" className="notice" data-tone="success">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : onboarding ? "Save and open Daybook" : "Save profile"}</button>
  </form>;
}
