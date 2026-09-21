import Link from "next/link";
import { historyData } from "@/controllers/queries";
import { attendanceState, formatMinutes } from "@/lib/attendance";
import { WorkspaceHeader } from "@/components/workspace-header";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { filters, page, today, rows, count } = await historyData(params);
  const labels = { absent: ["Absent", "danger"], worked: ["Worked", "success"], in_progress: ["In progress", "info"], unfinished: ["Unfinished", "warning"] } as const;
  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
    query.set("page", String(target)); return `/history?${query}`;
  }
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading flex flex-wrap items-end justify-between gap-4"><div><h1>Attendance history</h1><p>{count} records match your filters. Open any date to make a correction.</p></div><Link href="/attendance" className="primary-button">Record attendance</Link></div>
    {params.deleted && <p role="status" className="notice mb-4" data-tone="success">Attendance deleted.</p>}
    <form className="panel mb-6 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <label>From<input type="date" name="from" defaultValue={filters.from} /></label><label>To<input type="date" name="to" defaultValue={filters.to} /></label>
      <label>Location<select name="location" defaultValue={filters.location ?? ""}><option value="">All locations</option><option value="office">Office</option><option value="home">WFH</option></select></label>
      <label>Status<select name="state" defaultValue={filters.state ?? ""}><option value="">All entries</option><option value="open">Missing time out</option><option value="complete">Worked</option><option value="absent">Absent</option></select></label>
      <div className="flex items-center gap-3"><button className="primary-button">Apply filters</button><Link href="/history" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">Clear</Link></div>
    </form>
    {rows.length ? <section aria-label="Attendance records" className="panel">
      <div className="hidden overflow-x-auto md:block"><table className="data-table"><caption className="sr-only">Attendance records, newest first</caption><thead><tr>{["Date", "Status", "Location", "Time in", "Time out", "Regular", "Overtime", ""].map(t => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.work_date}><td className="whitespace-nowrap font-semibold">{row.work_date}</td><td><span className="status" data-tone={labels[attendanceState(row, today)][1]}>{labels[attendanceState(row, today)][0]}</span></td><td>{row.absent ? "—" : row.work_location === "home" ? "WFH" : "Office"}</td><td>{row.time_in?.slice(0, 5) ?? "—"}</td><td className="whitespace-nowrap">{row.absent ? "—" : row.time_out?.slice(0, 5) ?? (attendanceState(row, today) === "in_progress" ? "In progress" : "Missing")}</td><td className="whitespace-nowrap">{row.absent ? "0h" : row.time_out ? formatMinutes(row.regular_minutes ?? 0) : "—"}</td><td className="whitespace-nowrap">{row.absent ? "0h" : row.time_out ? formatMinutes(row.overtime_minutes ?? 0) : "—"}</td><td><Link className="font-semibold text-accent underline" href={`/attendance?date=${row.work_date}`} aria-label={`Edit attendance for ${row.work_date}`}>Edit</Link></td></tr>)}</tbody>
      </table></div>
      <ul className="record-list md:hidden">{rows.map(row => <li className="record-row" key={row.work_date}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{row.work_date}</p><p className="mt-1 text-sm text-muted">{row.absent ? "Absent · 0h credited" : `${row.work_location === "home" ? "WFH" : "Office"} · ${row.time_in?.slice(0, 5) ?? "—"}–${row.time_out?.slice(0, 5) ?? "pending"}`}</p></div><span className="status" data-tone={labels[attendanceState(row, today)][1]}>{labels[attendanceState(row, today)][0]}</span></div><div className="mt-2 flex items-center justify-between gap-3"><p className="text-sm text-muted">{row.absent ? "No hours" : row.time_out ? `${formatMinutes(row.regular_minutes ?? 0)} regular · ${formatMinutes(row.overtime_minutes ?? 0)} overtime` : "Add time out to credit hours"}</p><Link className="inline-flex min-h-11 items-center font-semibold text-accent underline" href={`/attendance?date=${row.work_date}`} aria-label={`Edit attendance for ${row.work_date}`}>Edit</Link></div></li>)}</ul>
    </section> : <section className="panel"><h2 className="section-title">No matching attendance</h2><p className="muted-copy mt-2">Try clearing your filters, or record a workday to start your history.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/history" className="secondary-button">Clear filters</Link><Link href="/attendance" className="primary-button">Record attendance</Link></div></section>}
    {count > 20 && <nav aria-label="History pages" className="mt-5 flex items-center gap-4">{page > 1 && <Link className="secondary-button" href={pageHref(page - 1)}>Previous</Link>}<span className="text-sm">Page {page}</span>{page * 20 < count && <Link className="secondary-button" href={pageHref(page + 1)}>Next</Link>}</nav>}
  </main>;
}
