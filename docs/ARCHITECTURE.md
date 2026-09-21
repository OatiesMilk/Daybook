# Architecture

## MVC adapted to Next.js

- **Models (`src/models/`)**: attendance calculations/validation, database reads and writes, report domain types,
  profile persistence, DOCX rendering, and local PDF conversion. Persistence/conversion modules are server-only.
- **Controllers (`src/controllers/`)**: authenticated read orchestration, server actions, report transitions, and export responses.
  Every protected controller obtains a verified owner identity; ownership is never taken from a form.
- **Views (`src/views/`, `src/app/*/page.tsx`, `src/components/`)**: presentation, forms, navigation, and pending/error states.
  Page views call query controllers. Route handlers are thin adapters. Views never make database queries.
- **Infrastructure (`src/lib/`, `src/proxy.ts`)**: Supabase clients, verified session guard, database types, cookie refresh.
  `src/lib/attendance.ts` is a compatibility re-export; the calculation lives in the model layer.
- **Database (`supabase/migrations/`)**: constraints, generated credits, RLS, report state transitions, and private storage policies.

## Attendance

One interval per weekday, office or home. Time out is nullable, and unfinished entries receive no credit.
Dates cannot be in the future (Asia/Manila, UTC+8). End time must be after start on the same date.
Regular credit is overlap with 08:30-12:00 and 13:00-18:30. Optional overtime is actual overlap after 18:30,
including afternoon-only days. No pre-08:30 credit. All arithmetic uses integer minutes; the target is 29,160 minutes.
There is no opening balance. The sample's 3,750 minutes through 2026-09-17 is only a reconciliation reference.

Insert rejects duplicates. Update/delete includes the original date, owner ID, and last-seen timestamp to reject stale edits.
SQL-generated credits prevent inflated totals supplied by clients. History is paginated. Summary aggregation runs in PostgreSQL,
not on the first API page of results. Saved entries supply Viber text; no messages are sent automatically.

## Reports and revisions

Each date has one logical report and numbered immutable revisions once Ready. Activity rows are a bounded, ordered JSON array;
they are edited and versioned together as a document, so independent row tables would add unnecessary joins and partial-write risks.
Clients cannot directly mutate reports. The `report_command` RPC validates owner access, expected version, latest revision,
date, activity fields, prerequisites, and allowed transition. Per-owner database locks serialize snapshot creation and attendance/profile writes.

- Save: create/update a Draft; at most 100 activity rows.
- Ready: require completed attendance, filled profile, and at least one complete activity. Capture profile, rows, and cumulative minutes through the report date.
- Submitted: require a current Ready snapshot and archived DOCX/PDF. The user confirms actual submission; the app does not send reports.
- Reopen: create the next Draft revision while retaining earlier snapshots/files.
- Attendance corrections: flag affected frozen reports for review. Their snapshots and exports stay unchanged.

Exports use `DAR_LASTNAME_MMDDYY` with the format extension. Private object paths are `owner UUID/report UUID/report.docx` or `.pdf`.
Storage RLS authorizes owner reads and Ready-report inserts, with no client update/delete policy. DOCX is rendered from the DOCX
template; PDF is rendered independently, straight from the report snapshot, so the two formats never need to agree byte-for-byte.
Concurrent export requests return the winning archived bytes.

## PDF generation

PDF export renders a print-styled HTML view of the report snapshot through headless Chromium (`puppeteer-core`, using
`@sparticuz/chromium`'s prebuilt binary on Vercel and the `puppeteer` dev dependency's bundled browser locally). No document
leaves the app's own Vercel deployment or Supabase project — there is no external conversion endpoint. PDF creation, like
DOCX creation, now works on Vercel and from any device, superseding the earlier local-only-LibreOffice constraint.
The DOCX template retains the sample's layout and images; rendering checks covered one-page and four-page reports.

## Verification boundaries

Automated tests run the migration chain in embedded PostgreSQL with Supabase auth/storage stubs. They verify calculations,
access policies, generated credits, state transitions, immutability, correction flags, and XML-safe DOCX output.
These are not a substitute for hosted Supabase Storage/API and browser verification. The user reported successful Google sign-in.
Remote migrations, live CRUD/storage checks, browser/mobile acceptance, password recovery, and deployment remain release tasks.
