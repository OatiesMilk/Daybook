/** Schema contract for the foundation migration. Regenerate after hosted schema changes. */
type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

type Profile = {
  user_id: string;
  full_name: string;
  last_name: string;
  school: string;
  department: string;
  target_hours: number | null;
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
type ActivityRow = { project: string; task: string; status: "Completed" | "Ongoing"; remarks: string };
type Report = {
  id: string; user_id: string; report_date: string; revision: number;
  status: "draft" | "ready" | "submitted"; rows: ActivityRow[];
  snapshot: { profile: Omit<Profile, "user_id" | "created_at" | "updated_at">; date: string; totalMinutes: number; rows: ActivityRow[] } | null;
  needs_review: boolean; submitted_at: string | null; created_at: string; updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      allowed_users: Table<{ user_id: string; active: boolean; created_at: string }, never, never>;
      profiles: Table<Profile, Pick<Profile, "user_id"> & Partial<Pick<Profile, "full_name" | "last_name" | "school" | "department" | "target_hours">>, Partial<Pick<Profile, "full_name" | "last_name" | "school" | "department" | "target_hours">>>;
      attendance: Table<Attendance, AttendanceInsert, Partial<AttendanceInsert>>;
      reports: Table<Report, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      acquire_help_request: { Args: Record<string, never>; Returns: string };
      release_help_request: { Args: { permit: string }; Returns: undefined };
      report_command: { Args: { command: string; work_day: string; report_id?: string; expected_version?: string; activity_rows?: ActivityRow[] }; Returns: string };
      attendance_summary: {
        Args: { through_date: string };
        Returns: { total_minutes: number; recorded_days: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
