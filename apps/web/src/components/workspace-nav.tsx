"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "Dashboard", "dashboard"],
  ["/attendance", "Attendance", "attendance"],
  ["/history", "History", "history"],
  ["/calendar", "Calendar", "calendar"],
  ["/reports", "Reports", "reports"],
  ["/settings", "Profile", "profile"],
] as const;

function NavIcon({ name }: { name: (typeof items)[number][2] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === "attendance") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === "reports") return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}

export function WorkspaceNav() {
  const pathname = usePathname();
  return <>{items.map(([href, label, icon]) => <Link key={href} href={href} aria-current={pathname === href || (href === "/reports" && pathname === "/reports/all") ? "page" : undefined}><span className="workspace-nav-icon"><NavIcon name={icon} /></span><span>{label}</span></Link>)}</>;
}
