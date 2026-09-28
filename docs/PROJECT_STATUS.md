# Project Status

**Project:** Daybook - multi-tenant internship attendance and Daily Activity Reports
**Last updated:** 2026-09-28
**Current phase:** Open-signup and calendar implementation complete locally; hosted migration/configuration and live acceptance pending
**Current signup rollout:** Google registration; email registration disabled by default until SMTP is available. Existing password sign-in remains available.
**Deployment:** Vercel production in Seoul (`icn1`), colocated with Supabase Seoul (`ap-northeast-2`)

## Confirmed requirements

- Open self-serve use on phone and desktop, with private per-student workspaces and email/password or Google sign-in.
- Next.js, TypeScript, Tailwind, Supabase, Vercel; clean symmetric monorepo boundaries.
- One time-in/time-out pair per weekday; office/WFH; no overnight work or future attendance dates.
- Save time in alone, then complete time out. Open entries earn no hours.
- Regular credit: overlap with 08:30-12:00 and 13:00-18:30. Optional overtime counts actual work after 18:30.
- Configurable per-user internship target, required during first-time profile setup. No opening balance. Historical records are entered individually.
- Sample reconciliation: 62h 30m through September 17, 2026.
- Date/time corrections allowed; duplicate dates rejected; deletion requires confirmation.
- Viber copied messages use @office for both locations.
- One DAR per date with revisions; Draft -> Ready -> Submitted.
- Ready requires completed attendance, a complete profile, and at least one complete activity row.
- Reopening retains earlier snapshots and exports; attendance corrections flag frozen reports for review.
- Universal filename DAR_LASTNAME_MMDDYY.docx / .pdf; revisions stored in separate private paths.
- PDF generation runs server-side via headless Chromium, self-contained in the app's own Vercel deployment.
  No third-party conversion service. (Supersedes the earlier local-computer-only PDF constraint.)

## Implemented

### Foundation and architecture

- Next.js App Router, strict TypeScript, Tailwind, typed database contracts, CI configuration.
- Self-serve password signup with email confirmation, Google signup/sign-in, SSR cookies, separate PKCE/confirmation callbacks, logout, verified owner guard, and a suspendable active-access row.
- New Auth identities are automatically provisioned with an active `allowed_users` row and blank profile by migration 009. Conflict-safe backfill preserves existing profiles and suspensions.
- Signup responses preserve Supabase's account-enumeration protection. Cloudflare Turnstile is supported without an added application dependency.
- npm-workspaces monorepo: `apps/web` is the single deployable composition root; attendance, reports, identity, and shared code are isolated packages.
- Symmetric feature layers separate domain, application, infrastructure, and presentation concerns without introducing a second BFF deployment.
- Credentials, original sample, local tools, and QA artifacts are ignored by Git.
- User reported successful Google sign-in before this increment.

### Attendance

- Create open/completed entries; edit date/time/location/overtime; confirm deletion.
- Mark a weekday absent with zero credited hours; switch between absence and attendance. New entries suggest 6:30 PM time out while existing unfinished entries remain blank.
- Server validation and SQL constraints, including future dates and nullable time out.
- SQL-generated credits and completed-entry aggregates; no API result-limit truncation.
- Optimistic timestamp checks reject stale update/delete operations.
- Date-range/location/status filters and paginated history.
- Dashboard: hours-recorded hero with quarter milestones, worked days, remaining hours, average worked day and estimated worked days left; a Today card that shows today’s attendance state and next action; earlier unfinished days with an all-caught-up state; shortcuts to reports and history.
- In progress: an open entry is In progress on its own date and Unfinished on any earlier date (derived from the date, no schema change). The form has an In progress checkbox for today; the Today card and history show the label.
- Copy saved Viber login/logout messages with manual-copy fallback.

### Reports

- Profile editing: full name, last name, school, department/team, and required internship hours.
- Bounded ordered activity rows with project, task, Completed/Ongoing status, remarks.
- Database-enforced state transitions; clients cannot directly update report rows.
- Submission SQL disambiguates the owner's ID from Supabase Storage's `owner_id` column.
- Ready reports can be marked Submitted without downloading exports first.
- Saved Drafts can be downloaded as DOCX or PDF while attendance is in progress. Draft previews use completed totals only and are not archived.
- Ready snapshots capture cumulative hours through the report date and profile/activity data.
- Submitted snapshots/files preserved; reopening creates a new revision.
- Attendance changes flag affected Ready/Submitted reports. Per-owner locks serialize changes and snapshots.
- Report date navigation and paginated revision history filtered to the selected date.
- All reports page (`/reports/all`): every saved version across dates (date desc, version desc), 20 per page via `?page=`, each row opens that exact version in the editor. URL-based filters: From/To report date (inclusive) and status; invalid values ignored, inverted range shows an error, and paging/retry keep filters. Owner-scoped, RLS-backed, uncached; no migration.
- Authenticated report import review: DOCX extracts headers and four-column activity rows; text-based PDF extracts headers only. Imports never auto-save. Rows remain local until Save draft, profile differences use a separate opt-in action, dates reuse the normal report validation/navigation flow, and stated hours are compared with attendance but never trusted as the system total.
- Selected import files and their unsaved previews can be cleared from the report editor.
- The latest Draft revision can be permanently deleted after explicit confirmation. Ready, Submitted, older, and stale revisions remain protected by the database command.
- Import safety: 4 MB upload cap, content/extension checks, bounded DOCX ZIP expansion and XML, no filesystem extraction, and isolated PDF parsing with page/text/memory/time limits. Ambiguous statuses and blank Project cells are surfaced for explicit review.

### Calendar

- `/calendar` provides a dependency-free month grid with Today/previous/next navigation.
- Each date shows the latest saved revision's Draft, Ready, Submitted, or Needs review state using the existing status badges.
- Past and current weekdays link directly to `/reports?date=YYYY-MM-DD`; weekends and future dates remain noninteractive because the report model rejects them.
- Month reads are owner-scoped, range-bounded, and select only the fields needed by the calendar.

### Visual design

- Token-based light and dark themes (`apps/web/src/app/globals.css`): system-following by default, header/login toggle with saved choice and no-flash script. Ink-blue accent, cool mineral paper, flat paper background. One typeface (IBM Plex Sans via next/font) for the whole UI. No hardcoded colours remain in components. Contrast checked numerically (text 4.5:1, borders/focus 3:1).

### Exports

- Reusable DOCX derived from the user's sample; original unchanged.
- Landscape layout, watermark, table/field styling retained. Header text normalized for LibreOffice.
- Dynamic table rows; repeated column headings; normal activity rows kept together across pages.
- PDF export now runs server-side (works on Vercel, from any device): a print-styled HTML view of the report
  snapshot is rendered to PDF via headless Chromium (`puppeteer-core` + `@sparticuz/chromium` on Vercel,
  `puppeteer`'s bundled browser locally, overridable with `CHROME_PATH`). No document leaves the app's own
  deployment; there is no third-party conversion service. PDF is generated independently from the report
  snapshot, not from the archived DOCX, so the two exports no longer share a conversion step.
- Private Supabase export bucket: authorized owner reads, Ready/Submitted inserts, no client overwrites/deletes.
- Concurrent upload races return stored bytes (both formats).
- Universal filenames independent of revision path. Downloads are optional before submission and remain available afterward.

### Performance

- Report history fetches only fields shown for the selected date; the main report fetches only its latest revision.
- Report history and current-report lookups run concurrently once the selected date is known.
- Dashboard unfinished-attendance lookup fetches only the date and time needed by the view.
- Production profiling identified region distance, not query complexity, as the main signed-in navigation cost. With Vercel functions in Washington, three measured owner checks took 434-710 ms total (466 ms median). Moving the single function region to Seoul, alongside Supabase, reduced 29 signed-in owner checks to a 57 ms median, 69 ms mean, and 146 ms p95 without weakening `getUser()` verification or the active allowlist.
- Warm middleware claim verification is normally about 2-3 ms. Occasional cold JWKS/key-fetch outliers remain, but they do not justify weakening session verification.
- The emitted production trace keeps Chromium/Puppeteer out of every normal page route. Normal page traces are about 1.85-2.29 MB; the isolated export route is about 71.43 MB, including roughly 66.8 MB of compressed Chromium assets.
- Existing attendance and report primary/unique indexes match the owner/date/revision query shapes. The captured hosted attendance-history query completed in 29 ms; no additional index or caching layer is currently justified.

## Verification

- [x] ESLint without errors or warnings.
- [x] TypeScript.
- [x] Twenty-four automated test groups passed (includes automatic provisioning/suspension, cross-user RLS, calendar month logic/latest-revision selection, Draft preview validation, monorepo boundaries, report-import safety, all-reports behavior, dashboard pace helpers, and the in-progress rule).
- [x] Migration chain executes in embedded PostgreSQL (PGlite), using auth/storage stubs.
- [x] Calculation boundaries, half-days, lunch, overtime, incomplete attendance, future dates, duplicates.
- [x] Owner isolation, anonymous/revoked access, blocked self-enrollment.
- [x] Report prerequisites/transitions, immutable snapshots/files, revision preservation, correction flags, cross-user export access.
- [x] DOCX filename rules, escaping, adjustable row count, preserved images/layout.
- [x] DOCX import round trip for all supported fields, multiline cells, ambiguous statuses, blank projects, and malformed/spoofed/oversized inputs.
- [x] PDF header-only import with bounded worker parsing; PDF table rows deliberately remain unsupported.
- [x] Headless-Chromium PDF export: one-page and four-page test reports generated and rendered (valid PDF, correct page counts).
- [x] Visual export review; fixed clipped source header label and row splitting found during review.
- [x] Production build passes with new routes.
- [x] Local production build includes `/signup`, `/auth/confirm`, and `/calendar`.
- [ ] Apply migration 008 to hosted Supabase to enable configurable internship targets.
- [x] User reports migration 009 applied to hosted Supabase; independent hosted verification pending.
- [x] Git whitespace/ignore checks; environment values were not printed or committed.
- [x] Migration 006 applied to hosted Supabase by the user.
- [ ] Apply migration 007 to hosted Supabase to enable Draft deletion.
- [ ] Live browser CRUD and export round-trip against hosted database/storage.
- [ ] Phone/desktop browser visual, light and dark theme review, and interaction checks (no browser connection available to automation).
- [x] Measured signed-in production navigation against hosted Supabase and colocated Vercel functions with Supabase in Seoul; owner authorization median fell from 466 ms to 57 ms while preserving both checks.
- [ ] Password recovery UI before production release; account administration currently uses Supabase.
- [ ] Configure hosted Confirm Email, the token-hash confirmation template, custom SMTP, Turnstile, password policy, and exact redirect allowlist.
- [ ] Complete a hosted two-account isolation test and verify that setting `allowed_users.active = false` cuts off access without deleting data.
- [x] Production deployment and signed-in navigation validation on Vercel; automated tests continue to cover anonymous and revoked-user denial.

## Required setup to use this increment

1. Apply 202609180002_attendance_workflow.sql once in Supabase SQL Editor.
2. Apply 202609180003_reports.sql once. It includes the private export bucket/policies.
3. Apply 202609210004_absences.sql once to enable absent days.
4. Apply 202609210005_report_submit_owner_id.sql once to fix report submission (SQLSTATE 42702).
5. Apply 202609210006_optional_report_exports.sql once to make downloads optional before submission.
6. Apply 202609210007_delete_report_drafts.sql once to allow deletion of the latest Draft revision.
7. Apply 202609210008_profile_target_hours.sql once to add configurable required internship hours.
8. Apply 202609280009_open_signup_provisioning.sql once to enable automatic signup provisioning.
9. Configure the Supabase Auth settings and Turnstile environment variable documented in README.md.
10. Run npm ci and restart npm run dev.
11. Sign up, confirm email, complete Profile, add real attendance, save a report, mark Ready, then confirm submission. Export whenever needed.

Do not rerun migration 001. Existing records are retained. No remote migrations or data changes were performed by the agent.
`LIBREOFFICE_PATH` is no longer used and was removed from `apps/web/.env.example`; PDF export runs via headless Chromium instead
(see Exports above). An optional `CHROME_PATH` env var can point at a specific local Chrome/Chromium for dev.

## Known limits / remaining release work

- Browser end-to-end validation is still required; embedded PostgreSQL is not the hosted Supabase API/storage service.
- Import UI browser validation against an authenticated Supabase session is still required; automated browser access was unavailable locally.
- The DOCX template has been checked in LibreOffice rendering; exact Word/LibreOffice font metrics can differ. The PDF
  export uses its own independent HTML layout and does not depend on LibreOffice at all.
- `@sparticuz/chromium` is isolated to the export function. Its emitted trace is about 71.43 MB, including roughly
  66.8 MB of compressed Chromium assets; normal page traces contain no Chromium/Puppeteer references. A cold
  production PDF export still needs runtime timing against the active Vercel timeout budget.
- ESLint 9 is retained for compatibility with the current Next.js React lint plugin.
- Production deploys from GitHub `main`; no remote migrations were performed by the agent.
- Open signup depends operationally on hosted Auth configuration: Confirm Email, production SMTP, password policy, Turnstile, the token-hash email template, and exact redirect URLs.

## Change log

- 2026-09-28: User selected Google signup for the initial rollout while SMTP is unavailable. Signup page and server action now gate email registration on `EMAIL_SIGNUP_ENABLED=true`; default is false. Existing password sign-in remains available. Hosted migration 009 application was reported by the user. Lint, TypeScript, all 24 tests, and production build pass for this rollout change.

- 2026-09-28: Pivoted Daybook from a manually provisioned personal app to an open multi-tenant product. Added self-serve signup, SSR email confirmation, conflict-safe Auth-trigger provisioning, suspendable access, first-run target/profile setup, enumeration-safe responses, Turnstile support, and updated operating documentation. Added a dependency-free report calendar with owner-scoped monthly status data and direct report-editor links. Lint, TypeScript, 24 tests, and the production build pass; hosted Auth configuration and two-account live acceptance remain pending.

- 2026-09-23: Profiled signed-in production navigation before optimizing. Vercel functions were in Washington while Supabase was in Seoul, making the required `getUser()` plus allowlist chain take 434-710 ms (466 ms median across three baseline samples). Configured Vercel's single function region as Seoul (`icn1`); 29 post-change samples measured a 57 ms median, 69 ms mean, and 146 ms p95. Auth checks and denial behavior remain unchanged. Temporary timing logs were removed. Bundle tracing also confirmed Chromium is isolated to the 71.43 MB export route, and the captured attendance-history query completed in 29 ms, so no speculative query/index/cache changes were added.
- 2026-09-23: Added a compact live Philippine date/time indicator beside the Daybook identity. It updates without animation, uses tabular time figures, and preserves responsive header wrapping. ESLint and TypeScript pass.
- 2026-09-23: Changed the report editor heading from an ISO date to a timezone-safe long date such as `September 23, 2026`, while preserving the ISO value semantically and internally. ESLint, TypeScript, and focused report tests pass.
- 2026-09-23: Moved saved-Draft downloads into the editor toolbar, right-aligned on wider screens and wrapped on phones. Download controls disappear when edits are unsaved; lifecycle actions remain in Next step. ESLint, TypeScript, and the production build pass.
- 2026-09-23: Enabled non-archived DOCX/PDF previews for saved Draft reports while attendance is still in progress. Preview totals include completed attendance only; lint, TypeScript, 22 tests, and the production build pass.
- 2026-09-23: Migrated the single Next.js application to a clean symmetric npm-workspaces monorepo. `apps/web` remains the only deployment; attendance, reports, identity, and shared packages now expose explicit domain/application/infrastructure/presentation boundaries. Lint, TypeScript, all 20 tests, and the production build pass.
- 2026-09-18: Foundation implemented and locally verified.
- 2026-09-18: User confirmed sign-in works and clarified open attendance, correction, reporting, filename, and local PDF rules.
- 2026-09-18: Implemented MVC attendance/report workflows and exports; tested locally; documented hosted setup steps.
- 2026-09-21: Reduced report and dashboard read payloads and removed a Reports query waterfall. Production build and checks pass; signed-in latency remains unmeasured.
- 2026-09-21: Reproduced and fixed ambiguous `owner_id` in report submission; the regression test now uses Supabase Storage's `owner_id` column.
- 2026-09-21: Made report exports optional before submission and available afterward.
- 2026-09-21: Added the paginated All reports page; lint, typecheck, tests, and build pass. Signed-in browser check pending.
- 2026-09-21: Redesigned the UI for light and dark themes with a theme toggle; checks and build pass. Visual review in a real browser pending.
- 2026-09-21: Replaced local-only LibreOffice PDF conversion with server-side headless Chromium (`puppeteer-core` + `@sparticuz/chromium`), so PDF export now works on Vercel from any device. Removed `pdf-converter.ts` and `LIBREOFFICE_PATH`; PDF now renders independently from the report snapshot instead of converting the archived DOCX. Lint, typecheck, tests, and production build pass; QA script confirmed valid one-page and two-page PDFs generated locally via headless Chromium. Vercel function bundle size/cold-start timing not yet verified against the deployed project's actual limits.
- 2026-09-21: Added an In progress state for today’s open attendance (form option, Today card, history labels); no migration. Checks and build pass; browser review pending.
- 2026-09-21: Unified typography on IBM Plex Sans (removed the serif title font); checks and build pass; visual review pending.
- 2026-09-21: Redesigned the dashboard (progress hero, Today card, needs-attention list); one extra existing-model read for today’s attendance, no migration. Checks and build pass; browser review pending.
- 2026-09-21: Added date-range and status filters to All reports; checks and build pass. Browser check of the filter form pending.
- 2026-09-21: Added reviewed DOCX/PDF report imports. DOCX supports activity rows; PDF is header-only. Profile/date/hours remain governed by their existing sources of truth, and imports never auto-save. No migration.
- 2026-09-21: Added import-file clearing, database-protected draft deletion, and a wider responsive application canvas.
- 2026-09-21: Added a per-user required-hours setting with a 486-hour default and dynamic dashboard progress.
