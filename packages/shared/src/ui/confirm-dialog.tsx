"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PopupIcon } from "./popup-chrome";

type Confirmation = { title: string; description: string; detail?: string; confirmLabel: string; cancelLabel?: string; tone?: "danger" | "warning" };

/** Await a decision without blocking the browser or replacing the user's editor. */
export function useConfirmDialog() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [options, setOptions] = useState<Confirmation | null>(null);
  const confirm = useCallback((next: Confirmation): Promise<boolean> => {
    // A second request must never replace a decision that is already on screen.
    if (pending.current) return Promise.resolve(false);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise(resolve => { pending.current = resolve; setOptions(next); });
  }, []);
  const finish = useCallback((confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    dialog.current?.close();
    setOptions(null);
    const target = returnFocus.current;
    if (target?.isConnected) target.focus();
    resolve?.(confirmed);
  }, []);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  useEffect(() => {
    if (!options) return;
    dialog.current?.showModal();
    cancelButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [options]);

  const confirmation = <dialog ref={dialog} className="confirmation-popup" aria-labelledby={options ? `${id}-title` : undefined} aria-describedby={options ? `${id}-description` : undefined}
    onCancel={event => { event.preventDefault(); finish(false); }} onClose={() => { if (pending.current && !dialog.current?.open) finish(false); }}>
    {options && <>
      <div className="confirmation-body" data-tone={options.tone ?? "warning"}>
        <span className="popup-emblem confirmation-emblem"><PopupIcon name={options.tone === "danger" ? "trash" : "import"} /></span>
        <p className="popup-eyebrow">{options.tone === "danger" ? "Review before removing" : "Review before replacing"}</p>
        <h2 id={`${id}-title`} className="confirmation-title">{options.title}</h2>
        <p id={`${id}-description`} className="confirmation-description">{options.description}</p>
        {options.detail && <p className="confirmation-detail">{options.detail}</p>}
      </div>
      <div className="confirmation-footer">
        <button ref={cancelButton} type="button" className="secondary-button" onClick={() => finish(false)}>{options.cancelLabel ?? "Keep editing"}</button>
        <button type="button" className="confirmation-action" data-tone={options.tone ?? "warning"} onClick={() => finish(true)}>{options.confirmLabel}</button>
      </div>
    </>}
  </dialog>;
  return { confirm, confirmation };
}
