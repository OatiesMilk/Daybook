"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="mx-auto max-w-lg px-6 py-20"><section className="panel">
    <h1 className="text-2xl font-bold">We couldn’t load your workspace</h1>
    <p className="mt-4 leading-7 text-muted">Please try again. If the problem continues, check the Supabase connection and database setup.</p>
    <button className="primary-button mt-6" onClick={reset}>Try again</button>
  </section></main>;
}
