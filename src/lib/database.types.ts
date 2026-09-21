/** Schema contract for the foundation migration. Regenerate after hosted schema changes. */
type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

type Profile = {
  user_id: string;
  full_name: string;
  last_name: string;
  school: string;
  department: string;
  created_at: string;
  updated_at: string;
};
export type Attendance = {
  user_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  absent: boolean;
  work_location: "office" | "home";
  overtime_enabled: boolean;
  regular_minutes: number | null;
  overtime_minutes: number | null;
  created_at: string;
  updated_at: string;
};
type AttendanceInsert = Pick<Attendance, "user_id" | "work_date" | "time_in" | "time_out"> &
  Partial<Pick<Attendance, "work_location" | "overtime_enabled" | "absent">>;

export type Database = {
  public: {
    Tables: {
      allowed_users: Table<{ user_id: string; active: boolean; created_at: string }, never, never>;
      profiles: Table<Profile, Pick<Profile, "user_id"> & Partial<Pick<Profile, "full_name" | "last_name" | "school" | "department">>, Partial<Pick<Profile, "full_name" | "last_name" | "school" | "department">>>;
      attendance: Table<Attendance, AttendanceInsert, Partial<AttendanceInsert>>;
      reports: Table<import("../models/report-rules").Report, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      report_command: { Args: { command: string; work_day: string; report_id?: string; expected_version?: string; activity_rows?: import("../models/report-rules").ActivityRow[] }; Returns: string };
      attendance_summary: {
        Args: { through_date: string };
        Returns: { total_minutes: number; recorded_days: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
