import { completionEstimate, formatMinutes } from "@dtr/attendance/domain/index";

const quarters = [0.25, 0.5, 0.75, 1] as const;

export function DashboardProgress({ total, days, targetHours, estimate }: { total: number; days: number; targetHours: number; estimate: ReturnType<typeof completionEstimate> }) {
  const targetMinutes = targetHours * 60;
  const remaining = Math.max(0, targetMinutes - total);
  const percentage = Math.min(100, total / targetMinutes * 100);
  const stats = [
    ["Worked days", String(days)],
    ["Remaining", formatMinutes(remaining)],
    ["Daily average", estimate && estimate.sampleDays > 0 ? formatMinutes(estimate.averageMinutes) : "—"],
    ["Workdays left", estimate ? `About ${estimate.daysLeft}` : "—"],
  ];
  return <section className="panel dashboard-progress" aria-label="Internship progress">
    <div className="dashboard-card-heading"><p className="text-sm font-semibold text-muted">Hours recorded</p><span className="progress-percentage">{percentage.toFixed(1)}% complete</span></div>
    <p className="metric-number dashboard-total">{formatMinutes(total)}</p>
    <p className="mt-2 text-sm text-muted">of your {targetHours}h internship target</p>
    <progress className="mt-6" value={Math.min(total, targetMinutes)} max={targetMinutes} aria-label={`Progress toward ${targetHours} internship hours`} />
    {/* Quarter milestones. Their hours are decorative here; the totals above and below carry the meaning. */}
    <div className="milestones" aria-hidden="true">{quarters.map(share => <span key={share} data-passed={total >= targetMinutes * share ? "true" : undefined} style={{ left: `${share * 100}%` }}>{Math.round(targetHours * share)}h</span>)}</div>
    <dl className="dashboard-stats">
      {stats.map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="metric-number mt-1 font-semibold">{value}</dd></div>)}
    </dl>
    <div className="completion-estimate dashboard-forecast">
      <div className="forecast-heading">
        <span className="forecast-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18m-10 5 2 2 4-4" /></svg></span>
        <div>
          <h2 className="text-sm font-semibold text-muted">{estimate?.complete ? "Target reached" : "Estimated completion"}</h2>
          <p className="forecast-date">{estimate?.complete ? "You have recorded your required hours." : estimate?.date ? <time dateTime={estimate.date}>{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${estimate.date}T00:00:00Z`))}</time> : estimate ? "Estimate exceeds the supported calendar range" : "Not enough credited attendance yet"}</p>
        </div>
      </div>
      {!estimate?.complete && <>
        <p className="forecast-note">{estimate ? `Based on your last ${estimate.sampleDays} completed workday${estimate.sampleDays === 1 ? "" : "s"}. Estimate only; holidays and leave are not included.` : "Complete a workday with credited hours to see your estimate."}</p>
        {estimate && <details className="forecast-details"><summary>How this is estimated</summary><p>{formatMinutes(estimate.remainingMinutes)} remaining at an average of {formatMinutes(estimate.averageMinutes)} per workday means about {estimate.daysLeft} more workdays. The forecast counts Monday–Friday dates after today. Your actual completion date may change as you record attendance.</p></details>}
      </>}
    </div>
  </section>;
}
