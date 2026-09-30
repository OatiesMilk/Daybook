import type { ReactNode } from "react";

// Sticks beside the editor on wide screens. Import reviews can grow taller than the
// window, so the sidebar scrolls on its own instead of hiding content below the fold.
// The 4px inset keeps panel shadows and focus rings from being clipped by the scroll box.
export function ReportSidebar({ children }: { children: ReactNode }) {
  return <aside aria-label="Report tools" className="grid min-w-0 content-start gap-6 lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1">
    {children}
  </aside>;
}
