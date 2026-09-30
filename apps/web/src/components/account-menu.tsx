"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { logout } from "@dtr/identity/application/actions";

type Account = { name: string | null; email: string | null };

function initials({ name, email }: Account) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = (word?: string) => (word ? Array.from(word)[0] : "");
  if (words.length) return (first(words[0]) + (words.length > 1 ? first(words.at(-1)) : "")).toUpperCase();
  return first(email ?? "").toUpperCase() || "?";
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className="account-item" data-menu-item disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>;
}

export function AccountMenuPlaceholder() {
  return <span className="account-trigger" aria-hidden="true"><span className="account-avatar account-avatar-placeholder" /></span>;
}

export function AccountMenu(account: Account) {
  const pathname = usePathname();
  // Remounting per route closes the menu after navigation without an effect.
  return <Menu key={pathname} pathname={pathname} {...account} />;
}

function Menu({ pathname, ...account }: Account & { pathname: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const onProfile = pathname === "/settings";

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

  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("[data-menu-item], .account-row button") ?? []);
  function focusItem(index: number) {
    setOpen(true);
    requestAnimationFrame(() => { const list = items(); list[(index + list.length) % list.length]?.focus(); });
  }

  return <div className="account-menu" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="account-trigger" data-active={onProfile || undefined}
      aria-expanded={open} aria-controls={id} aria-label={`Account${account.name ? `: ${account.name}` : ""}`}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); focusItem(event.key === "ArrowDown" ? 0 : -1); } }}>
      <span className="account-avatar" aria-hidden="true">{initials(account)}</span>
    </button>
    <div id={id} ref={panel} className="account-popover" hidden={!open} onKeyDown={event => {
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : null;
      if (next !== null) { event.preventDefault(); list[(next + list.length) % list.length]?.focus(); }
    }}>
      <div className="account-identity">
        <p className="truncate font-semibold">{account.name ?? "Your account"}</p>
        {account.email && <p className="truncate text-xs text-muted">{account.email}</p>}
      </div>
      <Link className="account-item" data-menu-item href="/settings" aria-current={onProfile ? "page" : undefined} onClick={() => setOpen(false)}>
        <span>Profile &amp; internship</span>{onProfile && <span aria-hidden="true">✓</span>}
      </Link>
      <div className="account-row"><span>Appearance</span><ThemeToggle /></div>
      <form action={logout} className="account-signout"><SignOutButton /></form>
    </div>
  </div>;
}
