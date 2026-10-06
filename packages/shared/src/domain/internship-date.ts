/** Internship dates are Philippine local dates. Shared so every package agrees on "today". */
export const INTERNSHIP_TIME_ZONE = "Asia/Manila";

export function internshipToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INTERNSHIP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** "2026-09-30" → "Sep 30, 2026". Values that are not ISO dates are returned unchanged. */
export function formatShortDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
