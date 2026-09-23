"use client";

import { useSyncExternalStore } from "react";
import { INTERNSHIP_TIME_ZONE } from "@dtr/attendance/domain/index";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: INTERNSHIP_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: INTERNSHIP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 1_000);
  return () => window.clearInterval(timer);
}

function currentMinute() {
  return Math.floor(Date.now() / 60_000);
}

export function CurrentDateTime() {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => 0);
  const now = minute ? new Date(minute * 60_000) : null;
  const date = now ? dateFormatter.format(now) : "Current date";
  const time = now ? timeFormatter.format(now) : "--:--";

  return <div className="current-date-time" aria-label={now ? `Current date and time: ${date}, ${time} Philippine time` : "Current date and time"} title="Philippine time">
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3.25 2" /></svg>
    <time dateTime={now?.toISOString()}>
      <span className="current-time">{time}</span>
      <span className="current-date">{date} · PHT</span>
    </time>
  </div>;
}
