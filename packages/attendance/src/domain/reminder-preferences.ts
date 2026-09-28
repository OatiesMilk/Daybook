import type { Reminder } from "./reminders.ts";

export const defaultReminderPreferences = { time_out: true, report: true, dismissed: [] as string[] };

export function parseReminderPreferences(snapshot: string): typeof defaultReminderPreferences {
  try {
    const value = JSON.parse(snapshot);
    return { time_out: value.time_out !== false, report: value.report !== false,
      dismissed: Array.isArray(value.dismissed) ? value.dismissed.filter((id: unknown): id is string => typeof id === "string") : [] };
  } catch { return defaultReminderPreferences; }
}

export function activeReminders(reminders: Reminder[], preferences: typeof defaultReminderPreferences) {
  return reminders.filter(item => preferences[item.kind] && !preferences.dismissed.includes(item.id));
}
