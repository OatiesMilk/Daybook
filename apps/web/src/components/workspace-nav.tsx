"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const items = [
  ["/", "Home", "dashboard"],
  ["/attendance", "Attendance", "attendance"],
  ["/calendar", "Calendar", "calendar"],
  ["/reports", "Reports", "reports"],
  ["/more", "More", "more"],
] as const;

function NavIcon({ name }: { name: (typeof items)[number][2] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === "attendance") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === "reports") return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
}

export function WorkspaceNav() {
  const pathname = usePathname();
  return <>{items.filter(([href]) => href !== "/more").map(([href, label, icon]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><span className="workspace-nav-icon"><NavIcon name={icon} /></span><span>{label}</span></Link>)}<MoreMenu key={pathname} pathname={pathname} /></>;
}

const moreItems = [
  ["/history", "Attendance history"],
  ["/reports/all", "All reports"],
] as const;

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const id = useId();
  const active = moreItems.some(([href]) => pathname === href);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    const breakpoint = window.matchMedia("(max-width: 700px)");
    const resized = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    breakpoint.addEventListener("change", resized);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      breakpoint.removeEventListener("change", resized);
    };
  }, [open]);
  function focusItem(index: number) {
    setOpen(true);
    requestAnimationFrame(() => links.current[index]?.focus());
  }
  return <div className="more-navigation" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button className="more-trigger" ref={trigger} type="button" data-active={active || undefined} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} onKeyDown={event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusItem(event.key === "ArrowDown" ? 0 : moreItems.length - 1); }
    }}><span className="workspace-nav-icon"><NavIcon name="more" /></span><span>More</span></button>
    <ul id={id} className="more-menu" hidden={!open} aria-label="More navigation">
      {moreItems.map(([href, label], index) => <li key={href}><Link ref={element => { links.current[index] = element; }} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)} onKeyDown={event => {
        const next = event.key === "ArrowDown" ? (index + 1) % moreItems.length : event.key === "ArrowUp" ? (index + moreItems.length - 1) % moreItems.length : event.key === "Home" ? 0 : event.key === "End" ? moreItems.length - 1 : null;
        if (next !== null) { event.preventDefault(); links.current[next]?.focus(); }
      }}><span>{label}</span>{pathname === href && <span aria-hidden="true">✓</span>}</Link></li>)}
    </ul>
  </div>;
}
