# Daybook · Private internship tracker for students

Next.js + TypeScript + Tailwind + Supabase, designed for Vercel.

The app is an open multi-tenant product with self-serve email/password and Google signup, per-student data isolation, attendance CRUD/history,
calendar navigation, configurable progress targets, Viber message copying, profile settings, daily report revisions, reviewed DOCX/PDF imports, and private DOCX/PDF exports.
Both formats are generated on the server (PDF via headless Chromium) and work from any device, including on Vercel.

## Upgrade your existing setup

Your original foundation migration stays unchanged. Apply these **new migrations once, in order**, using
Supabase SQL Editor (copy the complete contents of each file into a new query and Run):

1. `supabase/migrations/202609180002_attendance_workflow.sql`
2. `supabase/migrations/202609180003_reports.sql`
3. `supabase/migrations/202609210004_absences.sql`
4. `supabase/migrations/202609210005_report_submit_owner_id.sql`
5. `supabase/migrations/202609210006_optional_report_exports.sql`
6. `supabase/migrations/202609210007_delete_report_drafts.sql`
7. `supabase/migrations/202609210008_profile_target_hours.sql`
8. `supabase/migrations/202609280009_open_signup_provisioning.sql`

Do not rerun `202609180001_foundation.sql` if you already applied it. The new migrations retain existing records.
The reports migration also creates the private `dar-exports` storage bucket and its access policies.
Migration 005 fixes the ambiguous `owner_id` reference that prevented Ready reports from being marked Submitted in Supabase.
Migration 006 lets you mark a Ready report Submitted without first downloading DOCX or PDF. Exports remain available afterward.
Migration 009 enables automatic account/profile provisioning for open signup and makes each new student choose an internship target.

Run `npm ci` to install the export dependencies, then restart with `npm run dev`.
Your existing Supabase values were preserved. Never commit `apps/web/.env.local` or `.tools`.

## Daily workflow

1. After verifying your email, open **Profile** and save your name, last name, school, department/team, and required internship hours.
2. Open **Attendance**, choose a weekday, and save your times. New entries suggest 6:30 PM for time out; clear it to save time in only. Select office/WFH and overtime as needed, or mark the day absent for zero hours.
3. Use **History** to edit the date/times, change an absence to attendance, or delete an entry with confirmation. Only completed worked entries earn credit.
4. Copy Viber messages from saved attendance. Both office and WFH currently use `@office`.
5. Open **Reports**, choose a day, enter activity rows, and **Save draft**.
   You can also use **Import from file**: DOCX imports activity rows and report headers; PDF imports headers only because PDF text does not preserve reliable table cells. Review everything before applying it to the editor.
6. Download DOCX or PDF from a saved Draft even while attendance is in progress. Draft previews use completed attendance totals, exclude the open entry until time out is saved, and are not archived.
7. **Mark Ready** after attendance and activities are complete. This freezes a snapshot of the rows, profile, and cumulative hours through that date. Ready and Submitted downloads are archived in private Supabase Storage.
8. After you actually send the report, check the submission confirmation and **Mark Submitted**. Downloads are optional.
9. To correct a frozen report, **Reopen as a new draft revision**. Old snapshots and files remain unchanged.
10. Use **Calendar** to see the latest report status for each day and open or start a report for any eligible weekday.

Attendance changes flag Ready/Submitted reports on or after the affected date for review.
Universal filenames are `DAR_LASTNAME_MMDDYY.docx` and `.pdf`, for example `DAR_AKIA_091726.docx`.
Revisions use separate storage directories, not filename suffixes.

## Importing an existing report

The Reports editor accepts DOCX and text-based PDF files up to 4 MB. Files are parsed inside the authenticated Node.js application and are not sent to a third-party service or stored automatically.

- DOCX imports Name, School, Department/Team, Date, stated cumulative hours, and the four-column activity table.
- PDF imports the header fields only. Scanned PDFs and PDF activity tables are not supported because their text has no dependable row/cell structure.
- Imported activities fill local editor state only; **Save draft** remains required.
- Imported profile differences require a separate opt-in profile update. Last name is never inferred.
- Imported cumulative hours are comparison-only. Attendance remains the source of truth and produces the Ready snapshot total.
- Ambiguous statuses require review. Blank Project cells remain blank until you explicitly fill them from the previous row or edit them yourself.

DOCX packages are checked for size, entry count, expanded size, compression ratio, required Word parts, and safe paths before content is read. PDF parsing runs in a bounded worker with page, text, memory, and time limits.

## Run locally

Install Node.js 24 LTS, then:

```sh
npm ci
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and configure the values below. Without them, the app
shows a setup page and the calculator, with no student records or pretend login.

```sh
npm run dev
```

Open http://localhost:3000. Do not use a development server as a production deployment.

## Supabase setup

### Current rollout: Google signup

Registration currently uses Google. `EMAIL_SIGNUP_ENABLED` defaults to false; existing accounts can still sign in with a password. Keep Supabase's global **Allow new users to sign up** enabled, enable the Google provider, and configure the exact `/auth/callback` redirect URL and matching app `SITE_URL`. SMTP and email-template setup below can wait until email registration is enabled.

The app flag controls the signup page and server action. It does not disable Supabase's direct email signup endpoint. To disable email registration there while retaining existing password sign-in, disable **email signup** in the Email provider if that separate setting is available; keep the global signup setting enabled for Google.

### Future email registration setup

Use a dedicated Supabase project for Daybook.

1. Apply all nine files in `supabase/migrations/` in filename order, once each, using the Supabase SQL editor
   (or your normal Supabase migration workflow). Keep subsequent changes in new migrations.
2. In Authentication settings, enable new-user signup and **Confirm Email**. Keep anonymous sign-ins disabled. Set a minimum password length of at least 8 and the strongest practical character requirements. Enable leaked-password protection when the project plan supports it.
3. Configure production SMTP. Supabase's built-in email sender is intended for testing and has a very low project-wide delivery limit.
4. Enable Cloudflare Turnstile under Authentication → Bot and Abuse Protection. Put its public site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; store the matching secret only in Supabase, never in the app.
5. Change the Confirm signup email template link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

6. Enable the Google provider. Configure its Google OAuth client in Supabase.
   The Google authorized redirect URI is the callback shown by Supabase
   (`https://<project-ref>.supabase.co/auth/v1/callback`), not the Next.js callback.
7. In Supabase URL Configuration, set your production Site URL and allow the exact app callback URLs:
   `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm`, and their `https://<your-app-domain>` equivalents.
   Add exact trusted deployment URLs as needed; avoid broad wildcard redirects.
8. Set `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<public-turnstile-site-key>
EMAIL_SIGNUP_ENABLED=false
```

Use the **publishable** key, never a secret/service-role key. Restart after configuration changes.
Use your HTTPS deployment origin for `SITE_URL` in production. Keep `apps/web/.env.local` out of Git.

Create and confirm an email/password account, then test Google signup/sign-in. Supabase automatically links trusted identities that use the same verified email. Migration 009 creates the `allowed_users` and blank `profiles` rows; manual provisioning is no longer required.
Set `EMAIL_SIGNUP_ENABLED=true` only after completing SMTP, email-template, confirmation, and abuse-protection configuration, then redeploy.
Password recovery UI is not included in this foundation; account administration currently uses Supabase.

## Verification

```sh
npm run check
npm run build
```

The tests cover attendance boundaries, date validation, database-generated credits, automatic provisioning,
cross-user isolation, revoked access without deletion, anonymous access, calendar calculations, and historical totals. Database tests use PGlite
with minimal Supabase auth-role stubs; they do not connect to or alter your hosted Supabase project.

Before deployment, verify these against your configured project:

- Email signup and confirmation, Google signup/sign-in, refresh persistence, and logout.
- Two real accounts cannot read or mutate one another's attendance, profile, reports, or exports.
- Revoking `allowed_users.active` removes data access.
- Both localhost and production OAuth and email-confirmation callback URLs work.

GitHub Actions runs lint, TypeScript, tests, and the production build. Import the repository into Vercel,
select `apps/web` as the application root, choose Node.js 24, and configure the four environment variables there when ready to deploy.

## Attendance rules

The internship target is required during each student's profile setup. Regular attendance counts only within 08:30–12:00 and 13:00–18:30
on weekdays. Optional overtime counts after 18:30 from actual login. No overnight entries.
All totals derive from attendance; the sample's 62h 30m is not added as an opening balance.

See [architecture and agreed requirements](docs/ARCHITECTURE.md) and [project status](docs/PROJECT_STATUS.md).
The original DAR sample stays local and is ignored by Git alongside generated DOCX/PDF files.

Implementation references: [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google),
[user-data provisioning triggers](https://supabase.com/docs/guides/auth/managing-user-data),
[CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha),
and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## PDF export and template

PDF export renders a print-styled HTML view of the report snapshot or saved Draft preview through headless Chromium
(`puppeteer-core` + `@sparticuz/chromium` in production, the `puppeteer` dev dependency's bundled
browser locally). No document ever leaves your own Vercel deployment or Supabase project — there is
no third-party conversion service. Generated files are archived in your private Supabase bucket.
To use a specific local Chrome/Chromium install instead of `puppeteer`'s bundled one, set `CHROME_PATH`
in `apps/web/.env.local`.

`apps/web/templates/dar-template.docx` is the reusable DOCX template derived from the user's sample, with personal
example content removed. It retains the landscape layout, watermark, table styling, and field formatting.
The small DAR v2 label is ordinary header text for LibreOffice compatibility; multi-page tables repeat
column headings and keep ordinary rows together. The original source document remains unchanged and
ignored by Git. The PDF export uses its own independent HTML layout — it does not depend on this template.

To regenerate the DOCX template after editing the original source:

```sh
python scripts/prepare-template.py DAR_Akia_091726.docx
```

Development-only export verification:

```sh
node --conditions=react-server --experimental-strip-types scripts/verify-exports.ts
node scripts/render-export-qa.mjs
```

QA artifacts are written under ignored `.data/exports-qa/`.

## Deployment limits

The web app, DOCX export, and PDF export all run on Vercel and work from any device, including phones.

Before production, complete live browser/mobile verification and the hosted checklist in `docs/PROJECT_STATUS.md`.
