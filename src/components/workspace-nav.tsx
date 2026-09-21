"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "Dashboard"],
  ["/attendance", "Attendance"],
  ["/history", "History"],
  ["/reports", "Reports"],
  ["/settings", "Profile"],
] as const;

export function WorkspaceNav() {
  const pathname = usePathname();
  return <>{items.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (href === "/reports" && pathname === "/reports/all") ? "page" : undefined}>{label}</Link>)}</>;
}
