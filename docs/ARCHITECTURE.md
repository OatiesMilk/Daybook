# Architecture

## Clean symmetric monorepo

The repository is an npm-workspaces monorepo. `apps/web` is the only deployable application and the composition root; Next.js pages, route handlers, proxy, and cross-context read composition live there. A separate BFF is intentionally avoided because Next.js already supplies the server boundary.

Business capabilities live in `packages/attendance`, `packages/reports`, and `packages/identity`. Each capability uses the same layers when they are needed:

- **Domain:** framework-independent types, calculations, and validation.
- **Application:** authenticated use cases and server actions.
- **Infrastructure:** Supabase repositories, document parsing, and rendering.
- **Presentation:** React forms and feature views.

`packages/shared` contains database and Supabase adapters, small cross-cutting contracts, and reusable UI primitives. It must not become a home for feature-specific business rules. `apps/web` may compose multiple packages; feature packages must not import application files from `apps/web`.

Dependencies point inward: presentation calls application/domain code, application coordinates domain and infrastructure code, and domain code stays independent from React, Next.js, and Supabase. Cross-capability orchestration belongs in `apps/web/src/application` when no single capability owns the workflow.

The database remains in `supabase/migrations`: constraints, generated credits, RLS, report state transitions, and private storage policies are trusted boundaries.

## Attendance

One interval per weekday, office or home. Time out is nullable, and unfinished entries receive no credit.
Dates cannot be in the future (Asia/Manila, UTC+8). End time must be after start on the same date.
Regular credit is overlap with 08:30-12:00 and 13:00-18:30. Optional overtime is actual overlap after 18:30,
including afternoon-only days. No pre-08:30 credit. All arithmetic uses integer minutes; the target is 29,160 minutes.
Students who began before Daybook may record one self-reported starting balance on their profile (`prior_minutes`,
`prior_hours_as_of`, optional note). It covers every date up to and including `prior_hours_as_of`; database triggers reject
attendance on those dates and reject moving the date over existing attendance, so hours are never counted twice. No
attendance rows are fabricated. `attendance_summary` and Ready snapshots add the balance; worked-day counts and the pace
forecast stay attendance-only. Changing the balance flags Ready/Submitted reports for review. The sample's 3,750 minutes
through 2026-09-17 is only a reconciliation reference.

Insert rejects duplicates. Update/delete includes the original date, owner ID, and last-seen timestamp to reject stale edits.
SQL-generated credits prevent inflated totals supplied by clients. History is paginated. Summary aggregation runs in PostgreSQL,
not on the first API page of results.

## Reports and revisions

Each date has one logical report and numbered immutable revisions once Ready. Activity rows are a bounded, ordered JSON array;
they are edited and versioned together as a document, so independent row tables would add unnecessary joins and partial-write risks.
Clients cannot directly mutate reports. The `report_command` RPC validates owner access, expected version, latest revision,
date, activity fields, prerequisites, and allowed transition. Per-owner database locks serialize snapshot creation and attendance/profile writes.

- Save: create/update a Draft; at most 100 activity rows.
- Draft export: require a filled profile and complete saved activity rows, then render a transient preview using completed attendance totals through the report date. Open attendance contributes zero until time out is saved. Draft previews are never archived.
- Ready: require completed attendance, filled profile, and at least one complete activity. Capture profile, rows, and cumulative minutes through the report date.
- Submitted: require a current Ready snapshot. The user confirms actual submission; downloads are optional and the app does not send reports.
- Reopen: create the next Draft revision while retaining earlier snapshots/files.
- Attendance corrections: flag affected frozen reports for review. Their snapshots and exports stay unchanged.

Exports use `DAR_LASTNAME_MMDDYY` with the format extension. Private object paths are `owner UUID/report UUID/report.docx` or `.pdf`.
Storage RLS authorizes owner reads and Ready-report inserts, with no client update/delete policy. Draft previews bypass storage and are regenerated from the saved Draft. DOCX is rendered from the DOCX
template; PDF is rendered independently from the same snapshot or preview, so the two formats never need to agree byte-for-byte.
Concurrent export requests return the winning archived bytes.

## PDF generation

PDF export renders a print-styled HTML view of the report snapshot through headless Chromium (`puppeteer-core`, using
`@sparticuz/chromium`'s prebuilt binary on Vercel and the `puppeteer` dev dependency's bundled browser locally). No document
leaves the app's own Vercel deployment or Supabase project — there is no external conversion endpoint. PDF creation, like
DOCX creation, now works on Vercel and from any device, superseding the earlier local-only-LibreOffice constraint.
The DOCX template retains the sample's layout and images; rendering checks covered one-page and four-page reports.

## External AI processing (scoped exceptions)

Report content otherwise never leaves the Vercel deployment and Supabase project. Two features are deliberate,
user-approved exceptions that call Google Gemini through one shared REST client
(`packages/shared/src/infrastructure/gemini.ts`: server-only key in a header, structured JSON output, abortable timeout,
streamed response byte cap, no retries, no content logging):

- **Help** sends one question plus version-controlled public guidance. It never sends records, account IDs, or history.
- **AI drafting** (`packages/reports`: domain `ai-draft.ts`, application `ai-draft.ts`, presentation `ai-draft.tsx`) sends only
  the notes typed into the Draft with AI box and the report date. The domain layer rejects credentials, emails, and phone
  numbers before any call and strictly validates the model's rows through `validateRows()`. The server action enforces
  Auth, active access, and a database-backed quota (migration 011, separate from Help's migration 010). Drafted rows only
  populate unsaved editor state; saving still goes through `report_command`.

Adding any other data to a provider request is a new privacy decision and must be approved and documented here.

## Verification boundaries

Automated tests run the migration chain in embedded PostgreSQL with Supabase auth/storage stubs. They verify calculations,
access policies, generated credits, state transitions, immutability, correction flags, and XML-safe DOCX output.
These are not a substitute for hosted Supabase Storage/API and browser verification. The user reported successful Google sign-in.
Remote migrations, live CRUD/storage checks, browser/mobile acceptance, password recovery, and deployment remain release tasks.
