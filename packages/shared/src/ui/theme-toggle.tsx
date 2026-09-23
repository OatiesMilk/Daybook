"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const dark = "(prefers-color-scheme: dark)";

// The chosen theme lives on <html data-theme>. With no choice saved, the system setting applies.
function subscribe(notify: () => void) {
  const media = window.matchMedia(dark);
  media.addEventListener("change", notify); window.addEventListener("themechange", notify);
  return () => { media.removeEventListener("change", notify); window.removeEventListener("themechange", notify); };
}
function current(): Theme {
  const chosen = document.documentElement.dataset.theme;
  return chosen === "light" || chosen === "dark" ? chosen : window.matchMedia(dark).matches ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* the choice still applies until the tab closes */ }
    window.dispatchEvent(new Event("themechange"));
  }
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  // The icon shows the theme you will switch to: a moon in light theme, a sun in dark theme.
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={toggle}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></> : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
    </svg>
  </button>;
}
