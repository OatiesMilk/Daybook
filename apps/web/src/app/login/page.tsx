import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@dtr/shared/ui/brand";
import { LoginForm } from "@dtr/identity/presentation/login-form";
import { ThemeToggle } from "@dtr/shared/ui/theme-toggle";
import { supabaseConfig } from "@dtr/shared/infrastructure/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!supabaseConfig()) redirect("/setup");
  const { error } = await searchParams;
  return <main id="main" className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-20">
    <section><div className="flex items-center justify-between gap-4"><Brand /><ThemeToggle /></div><div className="mt-12 max-w-xl"><h1 className="text-4xl leading-tight font-bold tracking-[-.02em] sm:text-5xl">Keep each working day in order.</h1>
      <p className="mt-5 max-w-md text-lg leading-8 text-muted">Attendance, daily activities, and progress toward your required internship hours in one private workspace.</p></div>
      <div className="mt-10 border-t border-line pt-5 text-sm text-muted">Your private internship record · phone and desktop</div>
    </section>
    <section className="panel w-full max-w-md justify-self-center"><h2 className="section-title">Sign in to Daybook</h2>
      <p className="muted-copy mt-2 mb-7">Use your email and password, or continue with Google.</p>
      {error && <p role="alert" className="notice mb-5" data-tone="danger">Sign-in could not be completed. Please try again.</p>}
      <LoginForm />
      <p className="mt-6 text-sm text-muted">New to Daybook? <Link className="font-semibold text-accent underline" href="/signup">Create an account</Link></p>
    </section>
  </main>;
}
