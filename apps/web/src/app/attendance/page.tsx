import { attendanceData } from "@/application/queries";
import { AttendanceForm } from "@dtr/attendance/presentation/form";
import { WorkspaceHeader } from "@/components/workspace-header";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; saved?: string }> }) {
  const params = await searchParams;
  const { today, date, error, record } = await attendanceData(params.date);
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading"><h1>Attendance</h1><p>Record time in now, add time out later, or open a previous workday.</p></div>
    <form className="mb-6 flex flex-wrap items-end gap-3"><label className="w-full max-w-56">Open a date<input name="date" type="date" required max={today} defaultValue={date} /></label><button className="secondary-button">Open date</button></form>
    {params.saved === "1" && !error && <p role="status" className="notice mb-5" data-tone="success">Attendance saved.</p>}
    {error ? <p role="alert" className="notice" data-tone="danger">{error} Select another date above.</p> : <AttendanceForm key={`${date}-${record?.updated_at ?? "new"}`} record={record} initialDate={date} today={today} />}
  </main>;
}
