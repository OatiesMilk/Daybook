"use client";

import { useState } from "react";
import { calculateAttendance, formatMinutes } from "@/lib/attendance";

export function AttendanceCalculator({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [timeIn, setTimeIn] = useState("08:30");
  const [timeOut, setTimeOut] = useState("18:30");
  const [overtime, setOvertime] = useState(false);
  let error = "";
  let result;
  try { result = calculateAttendance({ date, timeIn, timeOut, overtime }); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Check the attendance times."; }

  return <section className="panel" aria-labelledby="calculator-title">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="calculator-title" className="section-title">Check your hours</h2>
        <p className="mt-1 text-sm text-muted">Try your schedule before recording attendance.</p></div>
      <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-muted">Preview · not saved</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Time in<input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} /></label>
      <label>Time out<input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} /></label>
    </div>
    <div className="mt-5"><label className="checkbox-option">
      <input type="checkbox" checked={overtime} onChange={e => setOvertime(e.target.checked)} />
      <span>Include overtime<span className="mt-1 block text-xs font-normal text-muted">Count actual time worked after 6:30pm.</span></span>
    </label></div>
    <div className="mt-6" aria-live="polite" aria-atomic="true">
      {error ? <p className="notice" data-tone="danger">{error}</p> : result && <dl className="grid grid-cols-3 gap-3 rounded-lg bg-paper p-4">
        <div><dt className="text-xs text-muted">Regular</dt><dd className="mt-1 font-semibold tabular-nums">{formatMinutes(result.regularMinutes)}</dd></div>
        <div><dt className="text-xs text-muted">Overtime</dt><dd className="mt-1 font-semibold tabular-nums">{formatMinutes(result.overtimeMinutes)}</dd></div>
        <div><dt className="text-xs text-muted">Credited</dt><dd className="mt-1 font-semibold text-accent tabular-nums">{formatMinutes(result.totalMinutes)}</dd></div>
      </dl>}
    </div>
    <p className="mt-4 text-xs leading-5 text-muted">Weekdays · starts at 8:30am · lunch excluded from 12–1pm · same-day entries only. Office and WFH follow the same schedule.</p>
  </section>;
}
