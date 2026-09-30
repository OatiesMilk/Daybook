# Daybook

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
One student tracking an internship on a phone and computer each working day.

## Product Purpose
Record weekday attendance and daily activities, track progress toward 486 credited internship hours, and prepare Daily Activity Reports through Draft, Ready, and Submitted.

## Positioning
A private personal record that connects attendance, cumulative credited hours, report revisions, and archived exports for one internship.

## Operating Context
The student saves time in at the start of a workday, can finish the entry later, and may mark a weekday absent. They review attendance history, write activity rows, export a report, and confirm submission after sending it to their project manager.

## Capabilities and Constraints
- Keep the existing Next.js App Router, React, TypeScript, Tailwind, Supabase, and clean symmetric monorepo boundaries.
- Preserve attendance calculations, validation, authentication, authorization, database policies, report transitions, and export behavior.
- New attendance entries suggest 6:30 PM time out; it can be cleared to save time in only. An absent day has no times and earns zero hours.
- Ready requires completed attendance, a complete profile, and a complete activity row. Corrections may flag frozen reports for review; revisions and earlier exports remain available.
- A saved Draft can be downloaded while attendance is in progress. Its preview excludes unfinished attendance and is not archived.
- PDF creation runs server-side via headless Chromium and works from any device, including Vercel.
- Do not expose personal report contents or environment secrets.

## Brand Commitments
Keep the Daybook name and product terminology. A new visual identity is authorized for this redesign.

## Product Principles
- Make the student's next daily action clear.
- Make worked, unfinished, absent, and report states easy to distinguish.
- Keep entry and correction quick on phone and computer.
- Preserve trustworthy calculations and explicit confirmation steps.

## Accessibility & Inclusion
Readable text, accessible contrast, keyboard operation, visible focus, clear errors, and comfortable touch targets are required.
