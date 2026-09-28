"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: { sitekey: string; callback(token: string): void; "expired-callback"(): void; "error-callback"(): void; theme: "auto" }): string;
      remove(widgetId: string): void;
    };
  }
}

export function Turnstile({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const render = useCallback(() => {
    if (!container.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, [siteKey]);

  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} />
    <div ref={container} aria-label="Security check" />
    <input type="hidden" name="captcha_token" value={token} />
  </>;
}
