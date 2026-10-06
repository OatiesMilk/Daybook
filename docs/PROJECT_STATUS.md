# Project Status

**Project:** Daybook - multi-tenant internship attendance and Daily Activity Reports
**Last updated:** 2026-10-06
**Current phase:** Open-signup and calendar implementation complete locally; hosted migration/configuration and live acceptance pending
**Current signup rollout:** Google registration; email registration disabled by default until SMTP is available. Existing password sign-in remains available.
**Deployment:** Vercel production in Seoul (`icn1`), colocated with Supabase Seoul (`ap-northeast-2`)

## Confirmed requirements

- Open self-serve use on phone and desktop, with private per-student workspaces and email/password or Google sign-in.
- Next.js, TypeScript, Tailwind, Supabase, Vercel; clean symmetric monorepo boundaries.
- One time-in/time-out pair per weekday; office/WFH; no overnight work or future attendance dates.
- Save time in alone, then complete time out. Open entries earn no hours.
- Regular credit: overlap with 08:30-12:00 and 13:00-18:30. Optional overtime counts actual work after 18:30.
- Configurable per-user internship target, required during first-time onboarding (`/welcome`).
- **Decision changed 2026-10-06 (user-approved):** students continuing an internship may carry over hours rendered before Daybook as one self-reported starting balance with a counted-up-to date. This replaces the earlier "No opening balance" rule. Attendance on or before that date is blocked so hours are never counted twice; no attendance rows are fabricated; no admin approval.
- Sample reconciliation: 62h 30m through September 17, 2026.
- Date/time corrections allowed; duplicate dates rejected; deletion requires confirmation.
- One DAR per date with revisions; Draft -> Ready -> Submitted.
- Ready requires completed attendance, a complete profile, and at least one complete activity row.
- Reopening retains earlier snapshots and exports; attendance corrections flag frozen reports for review.
- Universal filename DAR_LASTNAME_MMDDYY.docx / .pdf; revisions stored in separate private paths.
- PDF generation runs server-side via headless Chromium, self-contained in the app's own Vercel deployment.
  No third-party conversion service. (Supersedes the earlier local-computer-only PDF constraint.)
- Report content stays inside the app's Vercel deployment and Supabase project, with two deliberate, user-approved
  exceptions that use Google Gemini: Help (one question plus public guidance) and AI drafting (only the notes the student
  types into the Draft with AI box plus the report date). Saved reports, other days' rows, attendance, and profiles are
  never sent. Emails, phone numbers, and credentials are blocked before sending. Approved 2026-09-30.

## Implemented

### Carried-over hours and required onboarding

- New students are sent to `/welcome` until name, last name, school, department, and required hours are complete, then choose **Starting fresh** or **Continuing an internship** (hours + minutes, counted-up-to date, optional 300-character note). The same fields are editable on the Profile page. The redirect is navigation only; RLS and server-side validation protect data.
- Migration 012 adds `prior_minutes`, `prior_hours_as_of`, and `prior_hours_note` to `profiles`, with constraints: 0 to 600,000 minutes, date required exactly when minutes > 0, balance <= target, note <= 300 chars. Existing profiles default to zero.
- Database triggers (SECURITY INVOKER, so they see only the caller's rows under RLS) reject attendance or absences on covered dates (`DBC01`), future counted-up-to dates, and moving the date over existing attendance (`DBC02`). They run after the per-owner lock, so concurrent profile/attendance writes are serialized.
- `attendance_summary` and Ready snapshots in `report_command` add the balance once its covered period is reached, so dashboard totals, remaining hours, Draft downloads, and Ready/Submitted DOCX/PDF exports include it. Worked days, daily average, and completion pace stay attendance-only. Changing the balance flags Ready/Submitted reports for review.
- Dashboard shows "Includes Xh carried over as of <date>". The soft first-time target card was replaced by the required onboarding step.
- Consequence accepted by the user: reports cannot be marked Ready for covered dates, because Ready requires completed attendance on that date.
- `internshipToday`/`INTERNSHIP_TIME_ZONE` moved to `@dtr/shared/domain/internship-date` (re-exported by attendance) to avoid an identity↔attendance package cycle; a shared `formatShortDate` replaces three duplicate formatters.

### Popup design refinement

- Shared popup header and tokens align reminders, Help, account menus, and navigation menus with the existing Daybook palette and typography.
- Reminders include skeleton, empty, error/retry, and stale-list states; Help has clearer starter actions, conversation surfaces, and a separate composer.
- Activity removal and import replacement use styled native confirmation dialogs with safe initial focus, explicit consequences, and cancellation. Row identity and change checks guard against background drafting updates while a decision is open.
- Popup contents preserve the reminders hydration fix. Browser QA covers light/dark layouts at 320/375/768/1280px, focus, Escape, confirmation, refresh, retry, and reduced motion. Phone hardware verification remains manual.

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
- Today card includes a compact activity-report section on weekdays: latest saved status, nonblank saved activity count, and Start report/Continue draft/Open ready report/View report/Review report action. Open attendance includes a write-now/finalize-after-time-out hint. The report link is secondary and attendance remains the primary action. Desktop top cards share the tallest content-driven height with the attendance action bottom-aligned; mobile cards stack at natural heights. Shortcuts form a full-width responsive strip. Needs attention is a full-width panel only for unfinished earlier entries; otherwise a compact attendance-caught-up message appears. One owner/date-scoped, latest-revision report query runs alongside existing dashboard reads; no migration or new dependency.
- In progress: an open entry is In progress on its own date and Unfinished on any earlier date (derived from the date, no schema change). The form has an In progress checkbox for today; the Today card and history show the label.

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

### Completion forecast and reminders

- Home estimates completion from the latest 10 completed, non-absent attendance records, using exact credited minutes before rounding the displayed average. Future weekdays begin after today; holidays/leave are not modeled. Zero-credit samples produce no estimate; reaching the target shows Target reached.
- Header bell opens a compact desktop popup or safe-area-aware mobile bottom sheet. A native modal dialog provides Escape dismissal and focus containment; Close, outside clicks, and action links dismiss it. Badge counts enabled, undismissed reminders. Preferences are expandable inside the panel; More no longer lists a notification page, and old `/notifications` bookmarks redirect Home.
- An owner-guarded server action (no client-provided user ID) loads the bounded 30-day attendance window and owner-scoped, paginated latest-report states. Today's open attendance gets time-out and DAR reminders at 18:20 Asia/Manila (10 minutes before standard 18:30 time out). Prior unfinished entries remain due; completed attendance can prompt DAR earlier. DAR reminders cover missing reports, Draft, Ready, and Needs review, clearing only for Submitted without review. State-specific reminder IDs let a new submission/review stage appear even if an earlier stage was dismissed. Absences are excluded; reminders never mutate records or submit on the user's behalf.
- Reminder loading runs after header hydration instead of blocking page rendering. Data refreshes on opening, route changes, every visible-app minute, and browser tab reactivation. Stale async results are discarded; errors have a retry control rather than a false all-caught-up state. The dialog opens only on user request; no automatic interruption or added bottom tab.
- Reminder-type toggles and dismiss/restore controls are stored per-account in browser localStorage, with safe parsing and visible storage-error feedback. Resolved reminders disappear without maintaining a second database source of truth. These are in-app reminders, not push/email or background scheduled delivery. Preferences do not sync across browsers; older unfinished entries remain available via history.
- No new migration, dependency, elevated credentials, or remote data mutation is required. Real-phone touch/visual acceptance remains pending; mobile-native guidance informed touch-sized bell controls and compact header spacing.

### Calendar

- `/calendar` provides a dependency-free month grid with Today/previous/next navigation and a native month/year picker.
- Monthly summary shows credited hours, completed worked days, absences, and missing reports. Only completed, non-absent attendance without any saved report is flagged as missing; open entries are excluded.
- Each date shows the latest saved revision's Draft, Ready, Submitted, or Needs review state using the existing status badges.
- Daily credited hours use PostgreSQL-generated regular and overtime minutes for completed attendance. Absent days show zero; open entries show In progress or Unfinished without credit. One monthly attendance query supplies both absence markers and hours.
- Saved attendance absences appear as an Absent badge, including days without a report; a saved report's status remains visible alongside it. Absence reads are owner-scoped and month-bounded. Attendance saves, corrections, and deletion revalidate the calendar. No migration required.
- Past and current weekdays open URL-driven day details with attendance state, time in/out, location, regular/overtime credit, and report status. Details link to attendance editing and the report editor. Weekends and future dates remain noninteractive because the report model rejects them.
- Attendance and report changes refresh calendar data and missing-report indicators. No new migration or dependency is needed.
- Month reads are owner-scoped, range-bounded, and select only the fields needed by the calendar.

### Daybook Help

- Header Help opens a native modal desktop popup/mobile sheet without adding a tab. Starter questions, plain-text replies, approved source links, loading, retry, unavailable, and clear-chat states are implemented. Native focus containment/Escape and inert background prevent simultaneous user interaction with Reminders. Chat is bounded to ten in-memory turns, never persisted; requests do not accept history or client user IDs.
- Gemini can answer using version-controlled public guidance when a server-only `GEMINI_API_KEY` is configured. Model defaults to `gemini-3.5-flash-lite`; `DAYBOOK_GEMINI_ENABLED=false` restores FAQ-only mode. Ordinary paraphrases no longer require exact FAQ keywords. Capability and configured-model questions receive direct answers. Account identity reads only the authenticated user's profile name after quota acquisition and never forwards it to Gemini. Gemini has no model tools, internet retrieval, private-record reads or product writes. Only one question and public guidance reach the provider; obvious sensitive inputs and unsupported/action requests skip it. Structured generated answers have bounded text and allowlisted source links. Provider failures fall back to deterministic FAQs. Filters and valid citations do not guarantee factual accuracy.
- `/api/help` verifies Auth and active access, rejects cross-site calls, bounds streamed JSON to 4 KiB and questions to 800 characters, uses eight-second response/six-second provider/2.5-second limiter RPC deadlines, and returns private/no-store safe errors. Migration 010 adds one private counter row per account and auth-bound security-definer quota/lease commands: 20 accepted requests per fixed minute, 200 per UTC day, one ten-second expiring permit per account across serverless instances. No messages or records are stored. Missing migration/limiter failure fails closed. Existing Supabase configuration suffices; optional `DAYBOOK_HELP_ENABLED=false` disables the API.
- Hosted migration/application and browser/real-phone acceptance still require verification. A generic time-out question succeeded in a live Gemini smoke test on 2026-09-29 without sending personal records or exposing the key. This is a connectivity check, not a comprehensive model quality evaluation. The UI discloses possible Google processing and AI inaccuracies; Google provider data-use terms apply.

### AI report drafting

- The editable report editor shows a Draft with AI panel when Gemini is configured. The student types rough notes; Gemini returns structured activity rows that are added to the editor as ordinary unsaved rows marked "AI draft". Nothing is saved, marked Ready, or submitted until the student uses the existing Save draft flow.
- Only the typed notes (up to 2,000 characters) and the report date are sent. Notes containing credentials, emails, or phone numbers (10+ digit runs; dates and times pass) are rejected server-side before any provider call.
- Output uses Gemini structured JSON (at most 20 rows) and must pass strict key checks plus the existing `validateRows()`; anything else is discarded with a safe message and the editor is left untouched. Status defaults to Ongoing unless the notes clearly say work is done.
- Drafted rows replace an untouched editor and otherwise append, so typed work is never overwritten; merging reads the latest rows so edits made while drafting are kept. The 100-row report cap still applies.
- `draftActivitiesAction` verifies Auth and active access, then takes a permit from migration 011's separate quota: 5 per minute, 30 per UTC day, one 20-second lease per account across serverless instances. Provider calls use a 12-second timeout and 32 KiB response cap with no retries. Logs record failure categories only, never notes, rows, or keys.
- The Gemini REST client is shared with Help (`packages/shared/src/infrastructure/gemini.ts`); Help's behavior is unchanged. No dependency was added.
- UI: status is announced through a persistent live region, errors use alerts, focus moves to the first drafted row, and drafted rows enter with a 220 ms ease-out fade/rise that reduces to a fade under reduced motion.

### Visual design

- Primary navigation is Home, Attendance, Calendar, Reports, and More. More opens a desktop dropdown or a mobile menu above its bottom tab, linking directly to Attendance history and All reports. Profile, appearance, and sign out live in the account menu (initials button, top right on desktop and phones). Current links and the More section are highlighted. Selection, outside pointer interaction, Escape, focus leaving, route navigation, and responsive breakpoint changes dismiss the menu. Arrow keys/Home/End aid keyboard navigation; normal Tab order is preserved without a modal focus trap. Old `/more` bookmarks redirect Home. Mobile retains five safe-area-aware tabs and touch-sized controls. No added dependency or database change.

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
- [x] `npm run check` on 2026-09-30: 40 tests pass. Help coverage is limited to `tests/help.test.ts` (Draft with AI answers, write-request redirects, retained refusals); the Help endpoint, quota, and scope tests described in earlier entries are not present in the repository and should be restored. Other coverage includes today's report status/action/activity-count rules, reminder preferences and DAR lifecycle, completion forecast boundaries, reminder window/exclusions, provisioning/suspension, cross-user RLS, calendar summaries, Draft previews, monorepo boundaries, report-import safety, all-reports behavior, and AI drafting: input filters, strict output validation, merge rules, mocked Gemini client failures, and the drafting limiter SQL).
- [x] `npm run check` on 2026-10-06: 50 tests pass, including `tests/carry-over.test.ts` (validation bounds, totals = balance + attendance, covered-date rejection for attendance/absences/moves, date-move conflict, Ready snapshot totals, review flagging, starting-fresh reset, cross-user isolation and no cross-tenant date leakage through trigger errors). The leak test was confirmed to fail against the earlier SECURITY DEFINER trigger version. Production build passes with `/welcome`.
- [x] Carried-over UI stress-tested with worst-case data (200-character names/school/department, 300-character note with URL/email/emoji/non-Latin text, 10,000h target, 1-minute balance) at 320px in a temporary dev-only harness (since removed). No horizontal overflow; the dashboard date was fixed to stay on one line. Code review and security review run; a cross-tenant leak via SECURITY DEFINER validation triggers was found and fixed.
- [x] User reports migration 012 applied to hosted Supabase on 2026-10-06; independent hosted verification pending.
- [ ] After deploying the code, live-test onboarding (fresh and continuing), a covered-date attendance rejection, and a Ready export total. Real-phone review of the onboarding form pending.
- [ ] Apply migration 011 to hosted Supabase, then run a live Draft with AI smoke test with a real key and review the panel on desktop and a real phone (no authenticated browser session was available to automation).
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
12. Apply 202609280010_help_request_limits.sql once before using Daybook Help. Set the optional server-only GEMINI_API_KEY in local/Vercel environments for Gemini answers, or use FAQ-only mode. Help fails unavailable until the shared limiter is present.
13. Apply 202609300011_ai_draft_request_limits.sql once before using Draft with AI. It uses the same GEMINI_API_KEY; without the key the panel is hidden, and without the migration drafting fails closed with an unavailable message.
14. Apply 202610060012_profile_prior_hours.sql once to enable carried-over hours. Without it, saving a profile fails with an "apply the latest profile migration" message.

Do not rerun migration 001. Existing records are retained. No remote migrations or data changes were performed by the agent.
`LIBREOFFICE_PATH` is no longer used and was removed from `apps/web/.env.example`; PDF export runs via headless Chromium instead
(see Exports above). An optional `CHROME_PATH` env var can point at a specific local Chrome/Chromium for dev.

## Known limits / remaining release work

- Carried-over hours are self-reported and unverified by design; reports and exports show the cumulative total without marking which part was carried over.
- Draft reports can still be saved for covered dates, but cannot become Ready. Their download preview total excludes the balance, because the balance applies only after its counted-up-to date.
- Dashboard quarter milestone labels can collide at 320px with four- or five-digit targets (pre-existing, not introduced here).

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
- AI drafting sends typed notes to Google; Google's data-use terms apply. Names and project details in notes are allowed and disclosed in the UI. The credential/contact filters are conservative and incomplete, and drafted rows can be inaccurate, which is why every row stays editable and unsaved until reviewed.
- Google's API documentation could not be fetched from the development environment (network egress blocked), so drafting reuses Help's request format, which passed the 2026-09-29 live smoke test. Drafting itself has not been run against the live API yet.

## Change log

- 2026-10-06: User applied migration 012 to hosted Supabase. The application code is not yet committed or deployed; live acceptance is pending.
- 2026-10-06: Added carried-over hours and required onboarding (migration 012, `/welcome`, profile form, dashboard line). Reversed the "No opening balance" requirement with user approval. Used the frontend-design, emil-design-eng, break-ui, mobile-native, code-review, and security-review skills; fixed a cross-tenant date leak in the validation triggers, duplicate date formatters, a confusing form field name, and misleading success copy. Lint, TypeScript, 50 tests, and production build pass. No commit, push, remote migration, or deployment was performed.

- 2026-09-30: Added a favicon matching the brand mark (white vector "D" on the indigo rounded square): `app/icon.svg`, a 180×180 `app/apple-icon.png` for iPhone home screens, and a 16/32/48 px `app/favicon.ico` fallback, all picked up by Next.js file conventions with no config or dependency. Checked legible at 16 px on light and dark tab bars; middleware already skips these paths.

- 2026-09-30: Added an account menu (initials button, top right on desktop and phones) grouping name/email, Profile & internship, Appearance, and Sign out. Removed the standalone header Sign out and theme buttons, Profile from More, and the phone-only Account section on the Profile page (phones previously had to scroll the Profile page to sign out). `requireOwner()` and `profileData()` are wrapped in React `cache()` so the header reuses the page's auth check; the account button streams in behind Suspense and degrades to "Your account" if the name can't load. Menu entry follows the animate skill's dropdown recipe (150 ms ease-out scale from the trigger corner, instant close, fade-only under reduced motion), now shared with More. Help gained an account-menu answer (sign out, dark mode). Lint, TypeScript, all 40 tests, and production build pass; layout checked in rendered screenshots. Real-device and signed-in review pending.

- 2026-09-30: Removed Viber message copying at the user's request: the attendance-form panel, its clipboard copy button, the `viberMessage` helper, its test assertions, and all documentation mentions. No database, API, Help, or report behavior depended on it. With only the delete panel left in the side column, new attendance entries use a single readable column. Also corrected the README migration list (added 011) and count (eleven files). Lint, TypeScript, all 40 tests, and production build pass.

- 2026-09-30: UI fixes from user review, guided by the design-engineering, mobile-native, animate, and apple-design skills. Disabled buttons now show a not-allowed cursor instead of `wait` (busy buttons already say "Saving…"/"Drafting…"). Form fields no longer inherit bold 600 weight from their labels: typed values are 400 weight at 14px with a mouse and 16px on touch screens, which also stops iOS zooming when a field is focused. On phones the calendar becomes a native-style month view: day numbers with one status dot per state, today in the accent color, the selected day filled, one-letter weekdays, and a dot legend. The cryptic A/M/D/R/S/! letter codes were removed, and day links now announce report status to screen readers. Desktop calendar is unchanged. Lint, TypeScript, all 40 tests, and production build pass; computed styles and screenshots were checked with the compiled CSS. Real-phone review pending.

- 2026-09-30: Reports page polish, guided by the design-engineering, mobile-native, and animate skills. Draft with AI is now a remembered collapsible disclosure (native `<details>`, outlined instead of grey-on-grey, 180 ms ease-out reveal, instant close, fade-only under reduced motion), so activity rows start near the top. Its notice is one line with details behind "How it works". Import from file uses a drop zone that reads "Choose a DOCX or PDF" on touch and "Drop… or browse" with a mouse, keeps the native input for keyboard/screen readers, and has press/drag feedback. The date picker shares the title row, the subtitle is shorter, the sidebar heading is "Version history", and Help's intro/starter questions mention Draft with AI. Auto-opening a date on change was deliberately not done: iOS date wheels and typed years emit intermediate valid dates that would navigate mid-selection. Lint, TypeScript, all 40 tests, and production build pass; layouts were checked in screenshots rendered with the compiled CSS (desktop light/dark, 390 px phone). Real-phone and authenticated browser review pending.

- 2026-09-30: Aligned Daybook Help with AI drafting. Added a Draft with AI knowledge article, removed wording that implied Daybook cannot draft activities, clarified the Help system instruction (the chat itself still never writes rows), and routed "write/generate/draft my DAR" requests to that article deterministically without calling Gemini. Added `tests/help.test.ts`; found and documented that earlier Help test coverage is missing from the repository. Lint, TypeScript, all 40 tests, and production build pass.

- 2026-09-30: Moved Import from file out of the editing card into the Reports sidebar, as its own panel under Report history. The sidebar sticks beside the editor on wide screens and scrolls internally when an import review is taller than the window; on phones it stacks below the editor, and applying imported rows moves focus to the first filled row. Import behavior is unchanged. Lint, TypeScript, all 37 tests, and production build pass; authenticated browser review pending.

- 2026-09-30: Added Draft with AI in the report editor: typed notes become reviewed, unsaved activity rows via Gemini structured output. Scoped privacy exception approved by the user and documented. New migration 011 (separate 5/minute, 30/day drafting quota); Gemini REST client extracted and shared with Help; no new dependency. Lint, TypeScript, all 37 tests, and production build pass. Live API, hosted migration, and browser/real-phone acceptance pending.

- 2026-09-28: Implemented Daybook-only read-only FAQ chat, approved guidance/source allowlist, authenticated endpoint, distributed database quotas/expiring permits (new migration 010), compact header launcher, desktop popup/mobile sheet, and adversarial/endpoint/SQL permission tests. Lint, TypeScript, all 35 tests, and production build pass. No AI provider, added dependency, remote migration, or deployment. Hosted/real-device acceptance pending.

- 2026-09-28: Balanced the dashboard's desktop card heights, bottom-aligned the Today attendance action, replaced the tall shortcut panel with a responsive full-width strip, and reduced the empty attendance alert to a small caught-up message. Design-engineering/mobile-native guidance informed alignment, natural mobile sizing, and capability-gated shortcut hover. Lint, TypeScript, all 30 tests, and production build pass; real-phone and live visual acceptance remain pending. No database changes or dependencies.

- 2026-09-28: Added today's activity-report status/count/action inside the Today card and reduced forced vertical whitespace. Reports presentation is composed by the web app into the attendance card without crossing feature infrastructure boundaries. Design-engineering guidance shaped the compact section and action hierarchy. Lint, TypeScript, all 30 tests, and production build pass; live desktop/mobile visual acceptance remains pending.

- 2026-09-28: Replaced the intermediate More page with an inline desktop dropdown/mobile upward menu, direct record/account links, current-page indicators, light dismissal, and keyboard navigation. Native-mobile/design-engineering guidance informed touch sizes, capability-gated hover, bounded scrolling, and instant keyboard interactions. Old `/more` URL redirects Home. Lint, TypeScript, all 29 tests, and production build pass; real-phone and live browser keyboard/interaction checks remain pending.

- 2026-09-28: Moved today's time-out reminder to 18:20 Philippine time, ten minutes before the standard 18:30 time out. Added simultaneous DAR preparation/submission reminders, based on the latest revision, which persist through Draft/Ready and reappear for Needs review. No automatic external submission, schema change, or push/email delivery. Lint, TypeScript, 29 tests, and production build pass; live reminder acceptance remains pending.

- 2026-09-28: Replaced the notification page with a bell-triggered desktop popup/mobile bottom sheet, count badge, native-dialog keyboard/focus handling, outside-click dismissal, and expandable preferences. Removed its More destination; old URL redirects Home. Design-engineering/mobile-native skills guided compact controls, bounded scrolling, instant keyboard interaction, and safe-area spacing. No dependency or migration. Lint, TypeScript, 28 tests, and production build pass; authenticated browser and real-phone acceptance remain pending.

- 2026-09-28: Added a recent-pace completion forecast to Home and an in-app notification center with missing time-out/report reminders, account-scoped browser preferences and dismiss/restore, visible-page refresh, and header/More links while preserving five mobile tabs. Queries remain owner-scoped with RLS and reminders are derived from saved data. No migration or dependency. Lint, TypeScript, 27 tests and production build pass; real-phone and hosted interaction acceptance pending.

- 2026-09-28: Added calendar monthly totals, missing-report badges, URL-driven day details with attendance/report links, and a native month/year picker. Simplified primary navigation to five destinations with records and account grouped under `/more`. Mobile-native guidance informed touch sizing, coarse-pointer input sizing, capability-gated hover, and safe-area-aware tabs. No migration or dependency added. Lint, TypeScript, all 25 tests, and production build pass; real-phone and hosted visual/interaction checks remain pending.

- 2026-09-28: Added daily credited hours to the calendar, including enabled overtime, zero-hour absences, and clear open-entry states. Extended the existing monthly attendance read instead of adding another query. No migration. Lint, TypeScript, 24 tests, and production build pass; hosted visual acceptance pending.

- 2026-09-28: Added saved attendance absences to the calendar with separate Absent badges, compact mobile labels and a legend. Report and absence queries run concurrently; attendance changes refresh the calendar. Lint, TypeScript, 24 tests, and production build pass. Hosted visual/interaction verification remains pending.

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
