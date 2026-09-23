import { formatMinutes, pace } from "@dtr/attendance/domain/index";

const quarters = [0.25, 0.5, 0.75, 1] as const;

export function DashboardProgress({ total, days, targetHours }: { total: number; days: number; targetHours: number }) {
  const targetMinutes = targetHours * 60;
  const remaining = Math.max(0, targetMinutes - total);
  const percentage = Math.min(100, total / targetMinutes * 100);
  const projection = pace(total, days, targetMinutes);
  const stats = [
    ["Worked days", String(days)],
    ["Remaining", formatMinutes(remaining)],
    ["Average worked day", projection ? formatMinutes(projection.averageMinutes) : "—"],
    ["Days left at this pace", projection ? `About ${projection.daysLeft}` : "—"],
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
  </section>;
}
