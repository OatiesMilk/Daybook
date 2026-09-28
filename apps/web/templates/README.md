# DAR export templates

DOCX export fills `dar-template.docx`. PDF export uses `dar-template.pdf` as
static artwork and draws profile details and a growing activity table over it.
It runs in Node.js without Python, Word, a browser, or a conversion service.

The supplied PDF is a one-page DAR v2 form, landscape US Letter (792 × 612 pt).
The renderer removes the supplied blank table's drawing commands before
embedding the page, preserving the watermark underneath. Its coordinates and
table boundary are specific to this template. Replacing or re-exporting the
PDF requires reviewing the adapter in `pdf-renderer.ts` and running export QA;
an incompatible drawing structure is rejected rather than silently masked.

Activity rows wrap and grow. Ordinary rows stay together; rows taller than a
page continue on later pages. Every page repeats the background, report details
and table header. The embedded Noto Serif font and its SIL Open Font License
are in `fonts/`. Unsupported characters cause an export error rather than
invisible text; additional scripts require an appropriate bundled font.

Next.js traces both templates and fonts into the export function deployment.
Run `scripts/verify-exports.ts` with the Node `react-server` condition from
`apps/web`, then `scripts/render-export-qa.mjs` from the repository root for
visual samples. Generated samples are ignored under `.data/exports-qa`.

PDF downloads always use the current renderer. Past Ready and Submitted reports
use their frozen snapshot, so template changes do not alter their saved details.
Legacy archived PDFs remain stored but are no longer served by the download
endpoint. DOCX downloads continue using their immutable archived files.
