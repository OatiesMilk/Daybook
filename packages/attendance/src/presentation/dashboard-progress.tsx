import { completionEstimate, formatMinutes } from "@dtr/attendance/domain/index";

const quarters = [0.25, 0.5, 0.75, 1] as const;

export function DashboardProgress({ total, days, targetHours, estimate }: { total: number; days: number; targetHours: number; estimate: ReturnType<typeof completionEstimate> }) {
  const targetMinutes = targetHours * 60;
  const remaining = Math.max(0, targetMinutes - total);
  const percentage = Math.min(100, total / targetMinutes * 100);
  const stats = [
    ["Worked days", String(days)],
    ["Remaining", formatMinutes(remaining)],
    ["Recent average day", estimate && estimate.sampleDays > 0 ? formatMinutes(estimate.averageMinutes) : "—"],
    ["Days left at this pace", estimate ? `About ${estimate.daysLeft}` : "—"],
  ];
  return <section className="panel" aria-label="Internship progress">
    <p className="text-sm font-semibold text-muted">Hours recorded</p>
    <p className="metric-number mt-1 text-6xl font-bold leading-none sm:text-7xl">{formatMinutes(total)}</p>
    <p className="mt-3 text-sm text-muted">of the {targetHours}h target · {percentage.toFixed(1)}% complete</p>
    <progress className="mt-6" value={Math.min(total, targetMinutes)} max={targetMinutes} aria-label={`Progress toward ${targetHours} internship hours`} />
    {/* Quarter milestones. Their hours are decorative here; the totals above and below carry the meaning. */}
    <div className="milestones" aria-hidden="true">{quarters.map(share => <span key={share} data-passed={total >= targetMinutes * share ? "true" : undefined} style={{ left: `${share * 100}%` }}>{Math.round(targetHours * share)}h</span>)}</div>
    <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 lg:grid-cols-4">
      {stats.map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="metric-number mt-1 text-2xl font-bold">{value}</dd></div>)}
    </dl>
    <div className="completion-estimate mt-6">
      <h2 className="section-title">{estimate?.complete ? "Target reached" : "Estimated completion"}</h2>
      <p className="mt-2 text-xl font-bold">{estimate?.complete ? "You have recorded your required hours." : estimate?.date ? <time dateTime={estimate.date}>{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${estimate.date}T00:00:00Z`))}</time> : estimate ? "Estimate exceeds the supported calendar range" : "Not enough credited attendance yet"}</p>
      {!estimate?.complete && <p className="muted-copy mt-2">{estimate ? `${formatMinutes(estimate.remainingMinutes)} remaining · about ${estimate.daysLeft} more workdays at ${formatMinutes(estimate.averageMinutes)} per day, based on your last ${estimate.sampleDays} completed workday${estimate.sampleDays === 1 ? "" : "s"}.` : "Complete a workday with credited hours to see your estimate."} Assumes Monday–Friday work starting after today; excludes future holidays and leave. This is an estimate, not a guaranteed end date.</p>}
    </div>
  </section>;
}
