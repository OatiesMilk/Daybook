"use client";

import { useActionState, useState } from "react";
import { calculateAttendance, formatMinutes } from "@dtr/attendance/domain/index";
import type { Attendance } from "@dtr/shared/infrastructure/database.types";
import { saveAttendanceAction, deleteAttendanceAction } from "@dtr/attendance/application/actions";

export function AttendanceForm({ record, initialDate, today }: { record: Attendance | null; initialDate: string; today: string }) {
  const [state, action, pending] = useActionState(saveAttendanceAction, { error: "" });
  const [deletion, deleteAction, deleting] = useActionState(deleteAttendanceAction, { error: "" });
  const [date, setDate] = useState(record?.work_date ?? initialDate);
  const [absent, setAbsent] = useState(record?.absent ?? false);
  const [timeIn, setTimeIn] = useState(record?.time_in?.slice(0, 5) ?? "08:30");
  const [timeOut, setTimeOut] = useState(record ? record.time_out?.slice(0, 5) ?? "" : "18:30");
  const [overtime, setOvertime] = useState(record?.overtime_enabled ?? false);
  // Blank time out on today’s date means the day is still in progress. On an earlier date the day stays unfinished.
  const inProgress = !absent && date === today && timeOut === "";
  let preview = absent ? "Absent: 0 hours credited for this day." : inProgress ? "In progress: hours are credited once you add time out." : "No time out yet. This day stays unfinished and earns no hours until you add one.";
  if (!absent && timeIn && timeOut) {
    try {
      const credit = calculateAttendance({ date, timeIn, timeOut, overtime });
      preview = `${formatMinutes(credit.regularMinutes)} regular + ${formatMinutes(credit.overtimeMinutes)} overtime = ${formatMinutes(credit.totalMinutes)} credited`;
    } catch (error) { preview = error instanceof Error ? error.message : "Check your times."; }
  }
  // The side column only holds deletion, so a new entry uses one readable column.
  return <div className={record ? "grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]" : "max-w-3xl"}>
    <section className="panel"><h2 className="section-title">{record ? "Edit attendance" : "Record attendance"}</h2>
      <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="original_date" value={record?.work_date ?? ""} /><input type="hidden" name="version" value={record?.updated_at ?? ""} />
        <fieldset disabled={pending || deleting} className="space-y-5">
          <label>Date<input name="work_date" type="date" required max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
          <div><label className="checkbox-option"><input type="checkbox" name="absent" checked={absent} onChange={e => setAbsent(e.target.checked)} /><span>Mark as absent</span></label></div>
          {absent ? <input type="hidden" name="work_location" value="office" /> : <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Time in<input name="time_in" type="time" required value={timeIn} onChange={e => setTimeIn(e.target.value)} /></label>
              <label>Time out (optional)<input name="time_out" type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} /><span className="mt-1 block text-xs font-normal text-muted">6:30 PM suggested for new entries. Clear it, or choose In progress, to save time in only.</span></label>
            </div>
            {date === today && <div><label className="checkbox-option"><input type="checkbox" checked={inProgress} onChange={e => setTimeOut(e.target.checked ? "" : "18:30")} /><span>In progress — I’m still working today</span></label></div>}
            <label>Work location<select name="work_location" defaultValue={record?.work_location ?? "office"}><option value="office">Office</option><option value="home">Work from home</option></select></label>
            <div><label className="checkbox-option"><input type="checkbox" name="overtime_enabled" checked={overtime} onChange={e => setOvertime(e.target.checked)} /><span>Include time worked after 6:30 PM</span></label></div>
          </>}
          <p aria-live="polite" className="notice">{preview}</p>
          <p className="text-xs leading-5 text-muted">Weekdays only. Regular hours: 8:30am–12pm and 1pm–6:30pm. New entries suggest a 6:30pm time out; clear it to save time in only. Changes to past attendance will affect cumulative hours.</p>
          {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}
          <button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save attendance"}</button>
        </fieldset>
      </form>
    </section>
    {record && <aside className="space-y-6">
      <section className="panel"><h2 className="font-semibold">Delete this record</h2><p className="mt-2 text-sm text-muted">This removes the day’s attendance and recalculates your hours.</p>
        <form action={deleteAction} className="mt-4 space-y-4"><input type="hidden" name="original_date" value={record.work_date} /><input type="hidden" name="version" value={record.updated_at} />
          <div><label className="checkbox-option"><input type="checkbox" required name="confirm" /><span>Delete attendance for {record.work_date}</span></label></div>
          {deletion.error && <p role="alert" className="notice" data-tone="danger">{deletion.error}</p>}
          <button className="secondary-button danger-button" disabled={deleting || pending}>{deleting ? "Deleting…" : "Delete attendance"}</button>
        </form>
      </section>
    </aside>}
  </div>;
}
