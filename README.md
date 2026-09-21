# Daybook · Personal internship tracker

Next.js + TypeScript + Tailwind + Supabase, designed for Vercel.

The app includes private email/password and Google sign-in, attendance CRUD/history,
progress totals, Viber message copying, profile settings, daily report revisions, and private DOCX/PDF exports.
Both formats are generated on the server (PDF via headless Chromium) and work from any device, including on Vercel.

## Upgrade your existing setup

Your original foundation migration stays unchanged. Apply these **new migrations once, in order**, using
Supabase SQL Editor (copy the complete contents of each file into a new query and Run):

1. `supabase/migrations/202609180002_attendance_workflow.sql`
2. `supabase/migrations/202609180003_reports.sql`
3. `supabase/migrations/202609210004_absences.sql`
4. `supabase/migrations/202609210005_report_submit_owner_id.sql`
5. `supabase/migrations/202609210006_optional_report_exports.sql`

Do not rerun `202609180001_foundation.sql` if you already applied it. The new migrations retain existing records.
The reports migration also creates the private `dar-exports` storage bucket and its access policies.
Migration 005 fixes the ambiguous `owner_id` reference that prevented Ready reports from being marked Submitted in Supabase.
Migration 006 lets you mark a Ready report Submitted without first downloading DOCX or PDF. Exports remain available afterward.

Run `npm ci` to install the export dependencies, then restart with `npm run dev`.
Your existing Supabase values were preserved. Never commit `.env.local` or `.tools`.

## Daily workflow

1. Open **Profile** and save your name, last name, school, and department/team.
2. Open **Attendance**, choose a weekday, and save your times. New entries suggest 6:30 PM for time out; clear it to save time in only. Select office/WFH and overtime as needed, or mark the day absent for zero hours.
3. Use **History** to edit the date/times, change an absence to attendance, or delete an entry with confirmation. Only completed worked entries earn credit.
4. Copy Viber messages from saved attendance. Both office and WFH currently use `@office`.
5. Open **Reports**, choose a day, enter activity rows, and **Save draft**.
6. **Mark Ready** after attendance and activities are complete. This freezes a snapshot of the rows, profile, and cumulative hours through that date.
7. Download DOCX and PDF whenever needed, before or after submission, from any device. Exports are archived in private Supabase Storage.
8. After you actually send the report, check the submission confirmation and **Mark Submitted**. Downloads are optional.
9. To correct a frozen report, **Reopen as a new draft revision**. Old snapshots and files remain unchanged.

Attendance changes flag Ready/Submitted reports on or after the affected date for review.
Universal filenames are `DAR_LASTNAME_MMDDYY.docx` and `.pdf`, for example `DAR_AKIA_091726.docx`.
Revisions use separate storage directories, not filename suffixes.

## Run locally

Install Node.js 24 LTS, then:

```sh
npm ci
```

Copy `.env.example` to `.env.local` and configure the values below. Without them, the app
shows a setup page and the calculator, with no personal records or pretend login.

```sh
npm run dev
```

Open http://localhost:3000. Do not use a development server as a production deployment.

## Supabase setup

Use a dedicated Supabase project for this personal app.

1. Apply all six files in `supabase/migrations/` in filename order, once each, using the Supabase SQL editor
   (or your normal Supabase migration workflow). Keep subsequent changes in new migrations.
2. In Authentication → Users, create your email/password user with a strong password and a verified email.
   Use the same email as the Google account you intend to use. Copy the user's UUID.
3. Provision access using the SQL editor, replacing the UUID placeholder in both statements:

```sql
insert into public.allowed_users (user_id)
values ('YOUR-AUTH-USER-UUID');

insert into public.profiles (user_id)
values ('YOUR-AUTH-USER-UUID');
```

4. Disable new user signups in Supabase Auth; this app has no public registration.
   The allowlist is an additional protection, not a replacement for authentication.
5. Enable the Google provider. Configure its Google OAuth client in Supabase.
   The Google authorized redirect URI is the callback shown by Supabase
   (`https://<project-ref>.supabase.co/auth/v1/callback`), not the Next.js callback.
6. In Supabase URL Configuration, set your production Site URL and allow these app redirect URLs:
   `http://localhost:3000/auth/callback` and `https://<your-app-domain>/auth/callback`.
   Add exact trusted deployment URLs as needed; avoid broad wildcard redirects.
7. Set `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
SITE_URL=http://localhost:3000
```

Use the **publishable** key, never a secret/service-role key. Restart after configuration changes.
Use your HTTPS deployment origin for `SITE_URL` in production. Keep `.env.local` out of Git.

Sign in with email/password, then test Google with the same verified email. Both methods must resolve
to the provisioned user UUID; check linked identities in Supabase if access is denied.
Password recovery UI is not included in this foundation; account administration currently uses Supabase.

## Verification

```sh
npm run check
npm run build
```

The tests cover attendance boundaries, date validation, database-generated credits, cross-user isolation,
blocked self-enrollment, revoked access, anonymous access, and historical totals. Database tests use PGlite
with minimal Supabase auth-role stubs; they do not connect to or alter your hosted Supabase project.

Before deployment, verify these against your configured project:

- Password and Google sign-in, refresh persistence, logout, and denied access for a different account.
- Browser/API reads and writes obey RLS; an unapproved user cannot grant itself access.
- Revoking `allowed_users.active` removes data access.
- Both localhost and production OAuth callback URLs work.

GitHub Actions runs lint, TypeScript, tests, and the production build. Import the repository into Vercel,
choose Node.js 24, and configure the three environment variables there when ready to deploy.

## Attendance rules

The internship target is 486 hours. Regular attendance counts only within 08:30–12:00 and 13:00–18:30
on weekdays. Optional overtime counts after 18:30 from actual login. No overnight entries.
All totals derive from attendance; the sample's 62h 30m is not added as an opening balance.

See [architecture and agreed requirements](docs/ARCHITECTURE.md) and [project status](PROJECT_STATUS.md).
The original DAR sample stays local and is ignored by Git alongside generated DOCX/PDF files.

Implementation references: [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google),
and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## PDF export and template

PDF export renders a print-styled HTML view of the report snapshot through headless Chromium
(`puppeteer-core` + `@sparticuz/chromium` in production, the `puppeteer` dev dependency's bundled
browser locally). No document ever leaves your own Vercel deployment or Supabase project — there is
no third-party conversion service. Generated files are archived in your private Supabase bucket.
To use a specific local Chrome/Chromium install instead of `puppeteer`'s bundled one, set `CHROME_PATH`
in `.env.local`.

`templates/dar-template.docx` is the reusable DOCX template derived from the user's sample, with personal
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

Before production, complete live browser/mobile verification and the hosted checklist in `PROJECT_STATUS.md`.
