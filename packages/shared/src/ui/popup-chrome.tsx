import type { ReactNode } from "react";

export type PopupIconName = "bell" | "help" | "check" | "trash" | "import" | "user" | "arrow";

export function PopupIcon({ name }: { name: PopupIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "bell" && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>}
    {name === "help" && <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.8-4A8.5 8.5 0 1 1 21 11.5Z" /><path d="M9.5 8.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3M11.5 14h.01" /></>}
    {name === "check" && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
    {name === "trash" && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    {name === "import" && <><path d="M14 3H6v18h12V7zM14 3v4h4M12 10v7m-3-3 3 3 3-3" /></>}
    {name === "user" && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    {name === "arrow" && <path d="M5 12h14m-5-5 5 5-5 5" />}
  </svg>;
}

export function PopupHeader({ id, title, description, icon, onClose, action }: {
  id: string; title: string; description: string; icon: PopupIconName; onClose: () => void; action?: ReactNode;
}) {
  return <div className="popup-header">
    <div className="popup-heading">
      <span className="popup-emblem"><PopupIcon name={icon} /></span>
      <div><h2 id={`${id}-heading`} className="popup-title">{title}</h2><p id={`${id}-scope`} className="popup-subtitle">{description}</p></div>
    </div>
    <div className="popup-header-actions">{action}<button type="button" className="popup-close" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button></div>
  </div>;
}
