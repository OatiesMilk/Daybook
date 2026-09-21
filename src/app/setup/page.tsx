import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AttendanceCalculator } from "@/components/attendance-calculator";
import { supabaseConfig } from "@/lib/supabase/config";
import { internshipToday } from "@/lib/attendance";

export default function SetupPage() {
  if (supabaseConfig()) redirect("/login");
  return <main id="main" className="app-main">
    <header className="workspace-header"><Brand /><span className="status" data-tone="warning">Setup required</span></header>
    <div className="page-heading"><h1>Your internship starts here.</h1>
      <p className="mt-4 max-w-xl leading-7 text-muted">Connect your private workspace to record attendance, track your progress, and prepare daily activity reports.</p></div>
    <div className="grid items-start gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <section className="panel"><span className="text-xs font-bold uppercase tracking-wider text-muted">One-time setup</span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Connect your private workspace</h2>
        <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-6 text-muted">
          <li>Apply the database migration to your Supabase project.</li>
          <li>Provision your account and add its ID to the access list.</li>
          <li>Configure email/password and Google sign-in.</li>
          <li>Add the project connection settings and restart the app.</li>
        </ol>
        <p className="mt-6 border-t border-line pt-5 text-sm leading-6">The repository’s <strong>README.md</strong> contains the setup steps. No attendance records or opening balance have been created.</p>
      </section>
      <AttendanceCalculator initialDate={internshipToday()} />
    </div>
    <footer className="mt-12 text-xs text-muted">486-hour target · exact minute calculations · private by default</footer>
  </main>;
}
