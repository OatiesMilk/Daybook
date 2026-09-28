import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@dtr/shared/ui/brand";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { SignupForm } from "@dtr/identity/presentation/signup-form";
import { googleLogin } from "@dtr/identity/application/actions";
import { supabaseConfig } from "@dtr/shared/infrastructure/supabase/config";

export default function SignupPage() {
  if (!supabaseConfig()) redirect("/setup");
  const emailSignupEnabled = process.env.EMAIL_SIGNUP_ENABLED === "true";
  return <main id="main" className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-20">
    <section><div className="flex items-center justify-between gap-4"><Brand /><ThemeToggle /></div><div className="mt-12 max-w-xl"><h1 className="text-4xl leading-tight font-bold tracking-[-.02em] sm:text-5xl">Your internship record, organized.</h1>
      <p className="mt-5 max-w-md text-lg leading-8 text-muted">Create a private workspace for attendance, daily reports, and progress toward the hours required by your school.</p></div>
      <div className="mt-10 border-t border-line pt-5 text-sm text-muted">Private by default &middot; phone and desktop</div>
    </section>
    <section className="panel w-full max-w-md justify-self-center"><h2 className="section-title">Create your Daybook account</h2>
      <p className="muted-copy mt-2 mb-7">Continue with Google to create your private workspace, then complete your profile and internship target.</p>
      {emailSignupEnabled && <><SignupForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div></>}
      <form action={googleLogin}><button className="primary-button w-full">Continue with Google</button></form>
      <p className="mt-6 text-sm text-muted">Already have an account? <Link className="font-semibold text-accent underline" href="/login">Sign in</Link></p>
    </section>
  </main>;
}
