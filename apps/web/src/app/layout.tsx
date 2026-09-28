import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by Next, so there is no runtime request to Google.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-app" });

// Auth and configuration must be evaluated per request, never frozen at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daybook · Internship tracker",
  description: "Private internship attendance, progress, and daily activity reports for every student.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecefee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1519" },
  ],
};

// Applies a saved theme choice before first paint so the page never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={plex.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body className="min-h-screen antialiased">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:text-ink focus:p-4">Skip to content</a>
    {children}
  </body></html>;
}
