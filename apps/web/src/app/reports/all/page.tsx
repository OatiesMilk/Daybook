import Link from "next/link";
import { allReportsData } from "@/application/queries";
import { ALL_REPORTS_PAGE_SIZE } from "@dtr/reports/infrastructure/repository";
import { WorkspaceHeader } from "@/components/workspace-header";

const statusLabel = { draft: "Draft", ready: "Ready", submitted: "Submitted" } as const;

export default async function AllReportsPage({ searchParams }: { searchParams: Promise<{ page?: string; from?: string; to?: string; status?: string }> }) {
  const { page, filters, error, retryable, reports, count } = await allReportsData(await searchParams);
  const totalPages = Math.max(1, Math.ceil(count / ALL_REPORTS_PAGE_SIZE));
  const filtered = Boolean(filters.from || filters.to || filters.status);
  // Every link keeps the active filters so paging and retrying never lose them.
  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const text = query.toString(); return text ? `/reports/all?${text}` : "/reports/all";
  }
  const badge = (item: (typeof reports)[number]) => <span className="inline-flex flex-wrap items-center gap-2"><span className="status" data-tone={item.needs_review ? "warning" : item.status === "submitted" ? "success" : undefined}>{statusLabel[item.status]}</span>{item.needs_review && <span className="text-xs font-semibold text-warning-ink">Attendance changed</span>}</span>;
  const openIcon = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>;
  const noun = `${filtered ? "matching " : "saved "}${count === 1 ? "version" : "versions"}`;
  return <main id="main" className="app-main"><WorkspaceHeader />
    <div className="page-heading flex flex-wrap items-end justify-between gap-4"><div><h1>All reports</h1><p>{error ? "Every saved version across all dates." : `${count} ${noun} across all dates, newest first.`}</p></div><Link href="/reports" className="secondary-button">Back to editor</Link></div>
    <form className="panel mb-6 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter reports">
      <label>From<input type="date" name="from" defaultValue={filters.from} /></label><label>To<input type="date" name="to" defaultValue={filters.to} /></label>
      <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="submitted">Submitted</option></select></label>
      <div className="grid grid-cols-2 gap-3"><button className="primary-button">Apply filters</button><Link href="/reports/all" className="secondary-button">Clear</Link></div>
    </form>
    {error ? <section className="panel"><p role="alert" className="notice" data-tone="danger">{error}</p>{retryable && <Link href={pageHref(page)} className="secondary-button mt-4">Try again</Link>}</section>
    : reports.length ? <section aria-label="All saved reports" className="panel">
      <div className="hidden overflow-x-auto md:block"><table className="data-table"><caption className="sr-only">{filtered ? "Matching" : "Saved"} report versions, newest date first, then newest version. Page {page} of {totalPages}.</caption>
        <colgroup><col style={{ width: "16%" }} /><col style={{ width: "14%" }} /><col style={{ width: "48%" }} /><col style={{ width: "22%" }} /></colgroup>
        <thead><tr>{["Report date", "Version", "Status", "Action"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
        <tbody>{reports.map(item => <tr key={item.id}><th scope="row" className="whitespace-nowrap font-semibold">{item.report_date}</th><td>Version {item.revision}</td><td>{badge(item)}</td><td><Link className="row-action" href={`/reports?id=${item.id}`} aria-label={`Open report for ${item.report_date}, version ${item.revision}`}>{openIcon}Open report</Link></td></tr>)}</tbody>
      </table></div>
      <ul className="record-list md:hidden">{reports.map(item => <li className="record-row" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.report_date}</p><p className="mt-1 text-sm text-muted">Version {item.revision}</p></div>{badge(item)}</div><Link className="row-action mt-2" href={`/reports?id=${item.id}`} aria-label={`Open report for ${item.report_date}, version ${item.revision}`}>{openIcon}Open report</Link></li>)}</ul>
    </section>
    : count ? <section className="panel"><h2 className="section-title">That page is past the end</h2><p className="muted-copy mt-2">There are only {totalPages} {totalPages === 1 ? "page" : "pages"} of {filtered ? "matching " : ""}reports.</p><Link href={pageHref(totalPages)} className="secondary-button mt-4">Go to last page</Link></section>
    : filtered ? <section className="panel"><h2 className="section-title">No matching reports</h2><p className="muted-copy mt-2">No saved version matches these filters. Try a wider date range or a different status.</p><Link href="/reports/all" className="secondary-button mt-4">Clear filters</Link></section>
    : <section className="panel"><h2 className="section-title">No saved reports yet</h2><p className="muted-copy mt-2">Save a draft from the report editor and it will appear here, with every later version.</p><Link href="/reports" className="primary-button mt-4">Write a report</Link></section>}
    {!error && count > ALL_REPORTS_PAGE_SIZE && <nav aria-label="All reports pages" className="mt-5 flex items-center gap-4">{page > 1 && <Link className="secondary-button" href={pageHref(page - 1)} rel="prev">Previous</Link>}<span className="text-sm" aria-current="page">Page {page} of {totalPages}</span>{page < totalPages && <Link className="secondary-button" href={pageHref(page + 1)} rel="next">Next</Link>}</nav>}
  </main>;
}
