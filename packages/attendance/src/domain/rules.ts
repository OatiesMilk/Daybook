import { calculateAttendance, internshipToday, parseTime, validateWorkday } from "./index.ts";

export type AttendanceValues = {
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  work_location: "office" | "home";
  overtime_enabled: boolean;
  absent: boolean;
};

export function validateAttendance(values: AttendanceValues, today = internshipToday()) {
  validateWorkday(values.work_date);
  if (values.work_date > today) throw new Error("Attendance cannot be entered for a future date.");
  if (values.work_location !== "office" && values.work_location !== "home") throw new Error("Select office or work from home.");
  if (typeof values.overtime_enabled !== "boolean") throw new Error("Select a valid overtime option.");
  if (typeof values.absent !== "boolean") throw new Error("Select a valid attendance status.");
  if (values.absent) {
    if (values.time_in !== null || values.time_out !== null || values.overtime_enabled) throw new Error("Absent days cannot have work times or overtime.");
    return values;
  }
  if (values.time_in === null) throw new Error("Enter a time in or mark the day absent.");
  parseTime(values.time_in);
  if (values.time_out !== null) calculateAttendance({ date: values.work_date, timeIn: values.time_in, timeOut: values.time_out, overtime: values.overtime_enabled });
  return values;
}

export function parseAttendanceForm(form: FormData): AttendanceValues {
  const text = (name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };
  const location = text("work_location");
  if (location !== "office" && location !== "home") throw new Error("Select office or work from home.");
  const overtime = text("overtime_enabled");
  if (overtime !== "" && overtime !== "on") throw new Error("Select a valid overtime option.");
  const absent = text("absent");
  if (absent !== "" && absent !== "on") throw new Error("Select a valid attendance status.");
  return validateAttendance({ work_date: text("work_date"), time_in: text("time_in") || null, time_out: text("time_out") || null,
    work_location: location, overtime_enabled: overtime === "on", absent: absent === "on" });
}
