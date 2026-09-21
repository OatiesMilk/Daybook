import Link from "next/link";

export function Brand() {
  return <Link href="/" className="inline-flex min-h-11 items-center gap-3 no-underline hover:text-ink" aria-label="Daybook home">
    <span className="brand-mark" aria-hidden="true">D</span>
    <span className="text-xl font-bold tracking-[-.035em]">Daybook</span>
  </Link>;
}
