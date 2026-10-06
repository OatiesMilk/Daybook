export type Profile = {
  full_name: string;
  last_name: string;
  school: string;
  department: string;
  target_hours: number | null;
};

/**
 * Hours a student rendered before joining Daybook, carried over as one
 * self-reported starting balance. It covers every date up to and including
 * prior_hours_as_of; the database blocks attendance on those dates so the same
 * hours are never counted twice.
 */
export type CarryOver = {
  prior_minutes: number;
  prior_hours_as_of: string | null;
  prior_hours_note: string;
};

export const NO_CARRY_OVER: CarryOver = { prior_minutes: 0, prior_hours_as_of: null, prior_hours_note: "" };
export const PRIOR_NOTE_MAX = 300;

export type CarryOverInput = { mode: string; hours: string; minutes: string; asOf: string; note: string };

const wholeNumber = (value: string) => /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Validates the starting-fresh / continuing choice. Mirrors the database constraints. */
export function parseCarryOver(input: CarryOverInput, targetHours: number, today: string): CarryOver {
  if (input.mode === "fresh") return NO_CARRY_OVER;
  if (input.mode !== "continuing") throw new Error("Choose whether you are starting fresh or continuing an internship.");
  const hours = wholeNumber(input.hours || "0");
  const minutes = wholeNumber(input.minutes || "0");
  if (!Number.isInteger(hours) || hours > 10000) throw new Error("Carried-over hours must be a whole number from 0 to 10,000.");
  if (!Number.isInteger(minutes) || minutes > 59) throw new Error("Carried-over minutes must be a whole number from 0 to 59.");
  const prior_minutes = hours * 60 + minutes;
  if (prior_minutes === 0) throw new Error("Enter the hours you have already rendered, or choose Starting fresh.");
  if (prior_minutes > targetHours * 60) throw new Error(`Carried-over hours cannot exceed your ${targetHours}h internship target.`);
  const asOf = input.asOf.trim();
  if (!isIsoDate(asOf)) throw new Error("Enter the date your carried-over hours are counted up to.");
  if (asOf > today) throw new Error("The counted-up-to date cannot be in the future.");
  const note = input.note.trim();
  if (note.length > PRIOR_NOTE_MAX) throw new Error(`Keep the note to ${PRIOR_NOTE_MAX} characters or fewer.`);
  return { prior_minutes, prior_hours_as_of: asOf, prior_hours_note: note };
}

/** True once the details required for reports and progress tracking are filled in. */
export function isProfileComplete(profile: Partial<Profile> | null | undefined): boolean {
  return Boolean(profile && profile.full_name?.trim() && profile.last_name?.trim() && profile.school?.trim()
    && profile.department?.trim() && profile.target_hours != null);
}
