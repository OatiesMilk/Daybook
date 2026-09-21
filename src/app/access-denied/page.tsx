import { Brand } from "@/components/brand";
import { logout } from "@/app/auth/actions";
import { supabaseConfig } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export default function AccessDeniedPage() {
  if (!supabaseConfig()) redirect("/setup");
  return <main id="main" className="mx-auto max-w-lg px-6 py-16"><Brand />
    <section className="panel mt-10"><span className="status" data-tone="warning">Access denied</span><h1 className="mt-4 text-2xl font-bold">This account has no access</h1>
      <p className="mt-4 leading-7 text-muted">Sign in with the account provisioned for this personal workspace. If this is your account, check its access entry in Supabase.</p>
      <form action={logout} className="mt-6"><button className="primary-button">Sign out</button></form>
    </section>
  </main>;
}
