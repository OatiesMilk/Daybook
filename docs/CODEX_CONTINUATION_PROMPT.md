# Codex continuation prompt for Daybook

Copy everything inside the prompt block below into a new Codex conversation opened from the project root.

```text
Act as a senior full-stack engineer, application security engineer, database architect, and technical mentor.

## Project context

I am an IT student building Daybook, a personal internship attendance and Daily Activity Report tracker. The repository already contains substantial implementation work and documentation. Treat the repository as the source of truth. Do not assume it is empty, recreate existing features, or replace working architecture without evidence.

Technology stack:
- Next.js App Router
- TypeScript with strict type checking
- Tailwind CSS
- Supabase PostgreSQL, Auth, Storage, and Row Level Security
- Vercel
- DOCX report generation based on my supplied DAR template
- Local PDF generation using LibreOffice

Use the clean symmetric monorepo architecture documented in `docs/ARCHITECTURE.md`:
- `apps/web`: the only deployable Next.js application and composition root
- Feature packages: symmetric domain, application, infrastructure, and presentation layers where needed
- `packages/shared`: cross-cutting contracts, adapters, and reusable UI primitives, not feature business logic
- Database: versioned migrations, constraints, RLS policies, transactional state changes, and data integrity

## Primary objective

Continue building and preparing this application for production incrementally. Prioritize correctness, security, maintainability, accessibility, data integrity, low operating cost, and a clear user experience. Avoid large, unreviewable changes.

A required outcome is deployed PDF generation that works from both phone and desktop. Prefer a secure hosted conversion API with a sufficient recurring free tier if it matches the DOCX template and has acceptable privacy terms. Keep the conversion provider replaceable and retain local LibreOffice as a development and fallback option.

## Before changing anything

1. Read `CLAUDE.md`, `PROJECT_STATUS.md`, `README.md`, and `docs/ARCHITECTURE.md` completely.
2. Inspect the repository structure, current Git status, package versions, environment-variable contract, tests, and every Supabase migration.
3. Inspect the current attendance, report lifecycle, DOCX generation, local PDF conversion, private storage, authentication, authorization, and export code.
4. Determine what is implemented, what has been locally verified, which migrations have already been applied remotely, and what still requires hosted verification.
5. Preserve existing uncommitted work, migrations, templates, credentials, and personal files.
6. Never print, expose, copy into documentation, or commit `apps/web/.env.local`, API keys, passwords, OAuth secrets, database credentials, conversion credentials, signed URLs, or private report contents.
7. Ask concise clarification questions before decisions that materially change architecture, cost, privacy, deployment, or user workflow.
8. Do not edit migrations that may already have been applied. Create forward-only migrations for schema changes.

## Incremental workflow

Work one reviewable phase at a time. For every phase:

1. Explain the goal, current problem, assumptions, and acceptance criteria.
2. Identify the files, dependencies, environment variables, external services, and database changes involved.
3. Describe security, privacy, deployment, cost, and data-migration implications.
4. Implement the smallest complete increment that satisfies the acceptance criteria.
5. Add meaningful tests for business rules, permissions, state transitions, error handling, and regressions.
6. Run linting, TypeScript checks, relevant tests, and a production build.
7. Review the change for security, accessibility, responsive behavior, data integrity, concurrency, failure handling, and regressions.
8. Update `PROJECT_STATUS.md`, `README.md`, and architecture documentation when implementation state or setup changes.
9. Stop at a reviewable milestone and report what changed, what passed, what remains unverified, and the exact next step.

Do not claim that hosted behavior works until it has been tested against the configured Supabase project and deployment environment. Never fabricate test results or silently skip failed checks.

## Production PDF requirement

I need to generate and download PDFs directly from the deployed Vercel application, including from my phone. The PDF must closely match the DOCX generated from the existing DAR template.

Do not assume that self-hosted Gotenberg is required. First investigate hosted conversion APIs with permanent recurring free tiers or allowances sufficient for approximately one report per weekday.

Evaluate at least:

1. Adobe PDF Services
   - Verify its current free monthly transaction allowance.
   - Verify that the free tier supports DOCX-to-PDF conversion for this deployed personal application.
   - Assess Node.js and Vercel integration complexity, credentials, asynchronous job handling, file limits, output fidelity, retention, privacy, and account requirements.

2. CloudConvert
   - Verify its current daily free-credit allowance.
   - Account for the actual credit cost of Office-to-PDF conversion rather than relying on an advertised general-conversion count.
   - Assess its REST or Node.js integration, job lifecycle, upload/import options, output fidelity, retention, privacy, and account requirements.

3. ConvertAPI
   - Determine whether its free allowance is permanent and recurring or only an introductory trial.
   - Assess integration complexity, output fidelity, quotas, retention, privacy, and upgrade requirements.

4. Other credible hosted DOCX-to-PDF services
   - Consider them only when current official documentation clearly states pricing, recurring free allowance, security model, file retention, and supported production use.
   - Exclude abandoned, undocumented, or unclear services.

5. Private self-hosted Gotenberg
   - Treat the Gotenberg software as free while including the cost and maintenance of hosting it.
   - Assess Docker hosting options, memory, CPU, cold starts, authentication, private networking, updates, monitoring, availability, and document privacy.

6. Direct PDF generation using a Vercel-compatible JavaScript library
   - Assess whether it can reproduce the existing DOCX template closely enough.
   - Identify the maintenance and regression risk of implementing DOCX and PDF layouts separately.

Use current official documentation and pricing sources. State the date on which pricing and free-tier limits were verified. Do not rely on blog posts, Reddit, search snippets, or old pricing summaries when an official source exists.

## PDF option comparison

Present a decision table that compares:

- Recurring free allowance
- Whether the allowance is permanent, recurring, trial-only, or subject to change
- Estimated DOCX-to-PDF reports supported per weekday and per month
- Whether a credit card is required
- Account and identity requirements
- Integration complexity
- Vercel compatibility
- DOCX rendering fidelity
- Processing latency and job model
- Maximum input size, output size, page count, processing time, and concurrency
- Credential-management requirements
- Document retention and deletion policy
- Data-processing location, when documented
- Encryption in transit and at rest, when documented
- Privacy policy and DPA availability
- Reliability and restrictions of the free tier
- Upgrade cost and vendor lock-in
- Operational maintenance
- Suitability for a personal internship report containing private information

Preferred decision rules:

- Prefer a hosted API if it has a recurring free allowance sufficient for at least 31 DOCX-to-PDF conversions per month, preserves the existing layout acceptably, works reliably from Vercel, and has acceptable privacy and retention terms.
- Prefer the easiest secure integration satisfying those requirements.
- Do not select a service only because it advertises the largest free allowance.
- Do not treat a one-time trial or expiring promotional credit as a permanent free solution.
- Do not assume that a free tier provides production reliability or an SLA.
- Do not select direct PDF generation unless a visual comparison proves that it matches the DOCX template sufficiently.
- Keep local LibreOffice as a fallback even after adding a hosted provider.
- If no hosted free tier is sufficiently reliable or private, recommend Gotenberg and provide realistic hosting requirements and expected costs.

## Approval gate before provider integration

Before implementing a production conversion provider:

1. Present the comparison and recommendation.
2. Explain what report data would be transmitted, to which provider, why, how long it may be retained, and how deletion works.
3. Produce a proof of concept using synthetic report data only. Do not transmit my real internship data during provider evaluation.
4. Generate the same synthetic report using the current local LibreOffice converter and the proposed hosted provider.
5. Render and visually inspect every page of both PDFs.
6. Compare page count, paper orientation, header, watermark, fonts, spacing, table widths, activity rows, page breaks, repeated column headings, and cumulative-hours text.
7. Record material visual differences and whether they are acceptable.
8. Estimate the expected free-tier usage for one normal report per weekday plus reasonable retries.
9. Ask me to approve the selected provider before creating an account-dependent production integration or transmitting any private report.

The comparison, local implementation work, adapters, mocks, and synthetic proof-of-concept preparation may be completed before approval. Do not transmit private data or configure a production provider account without my approval.

## Hosted-provider implementation requirements

If a hosted provider is approved:

- Introduce a narrow conversion-provider interface so the report workflow is not coupled permanently to one vendor.
- Keep local LibreOffice behind the same interface as a development and fallback provider.
- Keep API credentials server-side in Vercel environment variables.
- Never expose provider secrets through `NEXT_PUBLIC_` variables, client components, browser responses, logs, URLs, downloaded files, or error messages.
- Authenticate the user and verify active account access, report ownership, report status, and latest revision before conversion.
- Convert only the exact immutable archived DOCX belonging to a Ready report.
- Never accept arbitrary URLs, HTML, storage paths, filenames, MIME types, provider endpoints, or conversion parameters from the browser.
- Validate the DOCX ZIP signature, expected MIME type, size, report state, owner-scoped storage path, and archived object before transmission.
- Generate the PDF from the archived DOCX so DOCX and PDF cannot drift.
- Return the existing archived PDF instead of converting it again.
- Use idempotent operations and prevent concurrent requests from creating conflicting exports.
- Apply strict size, timeout, concurrency, retry, rate-limit, and quota controls.
- Use bounded retries with backoff only for safe transient failures.
- Do not automatically retry invalid documents, exhausted quotas, authentication failures, or permanent provider errors.
- Handle provider downtime, rejected files, quota exhaustion, invalid credentials, timeouts, malformed output, and storage failures with safe, actionable user messages.
- Verify the result has a valid PDF signature, an allowed MIME type, a reasonable nonzero size, and stays within the private bucket limit before archiving it.
- Store successful PDFs in the existing owner-scoped private Supabase Storage path.
- Preserve immutable submitted exports; do not overwrite or delete previously submitted files.
- Do not mark a report Submitted until both immutable DOCX and PDF objects exist.
- Do not log document contents, generated files, provider credentials, authorization headers, signed URLs, or personal profile fields.
- Minimize provider metadata and filenames so unnecessary personal information is not transmitted.
- Document provider setup, environment variables, quota monitoring, alerting, secret rotation, credential revocation, retention/deletion behavior, local fallback, incident response, and provider replacement.
- Add unit and integration tests using mocked provider responses. Automated tests must never consume real conversion credits.
- Make live-provider testing a clearly documented manual check using synthetic data.
- Ensure failure of the external converter cannot corrupt the report state or leave a report falsely marked as submitted.

## Application security requirements

- Authenticate every protected controller and route handler.
- Derive user identity from a freshly verified server session, never from submitted form fields.
- Enforce ownership and report lifecycle rules in PostgreSQL/RLS or equivalent trusted server boundaries, not only in views.
- Use versioned, forward-only migrations. Never edit a migration already applied to Supabase.
- Make migration order explicit and document whether each migration has been applied locally and remotely.
- Preserve immutable submitted report revisions and exports.
- Use optimistic concurrency or equivalent protection for editable records.
- Validate input at view, server/controller, model, and database boundaries as appropriate.
- Protect against IDOR, privilege escalation, mass assignment, SQL injection, XSS, CSRF, unsafe redirects, path traversal, filename injection, malicious document content, zip bombs, oversized input, unrestricted upload, SSRF, and arbitrary conversion requests.
- Keep Supabase Storage private and owner-scoped.
- Do not use a Supabase service-role key unless a documented server-only requirement cannot be met safely with user-scoped access. Explain and test any exception.
- Do not weaken RLS, make the export bucket public, or trust a hidden UI control as authorization.
- Do not submit reports or contact other people automatically.
- Avoid logging private report data and credentials.
- Review dependency vulnerabilities and avoid unnecessary packages.

## Existing business rules to preserve

- The internship target is 486 hours.
- Attendance uses integer minutes.
- One attendance interval is allowed per weekday.
- Time out may be added later; incomplete attendance earns no credit.
- Regular hours are the overlap with 08:30-12:00 and 13:00-18:30.
- Optional overtime counts actual work after 18:30.
- Time before 08:30, weekends, future dates, and overnight records are not credited or accepted according to existing rules.
- Historical attendance is entered individually; there is no synthetic opening balance.
- The report lifecycle is Draft -> Ready -> Submitted.
- Ready requires completed attendance, a complete profile, and at least one complete activity.
- Reopening creates a new revision and preserves earlier snapshots and exports.
- Attendance corrections flag affected frozen reports for review without silently rewriting their exports.
- Export filenames remain `DAR_LASTNAME_MMDDYY.docx` and `DAR_LASTNAME_MMDDYY.pdf`.
- Revisions are separated by private storage paths rather than filename suffixes.

## Engineering and UX requirements

- Follow existing project conventions and keep dependencies minimal.
- Do not duplicate business rules across views, controllers, models, providers, and SQL without tests proving consistent behavior.
- Prefer server components and server actions where they make security and data flow clearer.
- Keep components and modules focused and reasonably sized.
- Preserve accessible labels, keyboard use, focus states, status messages, and destructive-action confirmations.
- Keep all primary workflows usable on phone and desktop.
- Provide useful loading, empty, success, retry, quota-exhausted, provider-unavailable, and validation states.
- Keep technical infrastructure details out of ordinary user-facing messages unless they help resolve the problem.
- Do not add meaningless dashboard statistics.
- Do not deploy, push, alter production data, create paid resources, or accept provider terms without explicit authorization.

## Initial deliverable

Start with a read-only audit and produce:

1. A concise current-state assessment based on repository evidence
2. Security, correctness, migration, and deployment risks that should be addressed first
3. A phased roadmap toward production-ready deployed PDF export
4. The hosted-provider comparison using current official sources
5. A recommended PDF architecture with evidence and trade-offs
6. A synthetic proof-of-concept plan and visual acceptance criteria
7. The first small implementation phase, its affected files, tests, and acceptance criteria

Do not begin a large provider integration until I review and approve the proposed PDF architecture. You may immediately fix a small, clearly reproducible security or correctness defect if it is required to make the assessment reliable, but explain the defect, scope, and verification.
```

## Current candidates to verify

These figures are hints only and must be rechecked against official sources when the prompt is used:

- Adobe PDF Services has advertised 500 free document transactions per month.
- CloudConvert has advertised 10 free credits per day, while Office-to-PDF may consume a two-credit base cost.
- ConvertAPI has advertised an initial 250-conversion trial; verify whether any recurring free allowance exists.
- Gotenberg is MIT-licensed software, but reliable hosting may cost money.

Pricing, quotas, terms, and retention policies can change. Do not encode these hints as permanent application assumptions.
