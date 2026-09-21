---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/attendance/page.tsx","src/app/history/page.tsx","src/app/reports/page.tsx","src/app/settings/page.tsx","src/app/login/page.tsx"]
---

# Daybook workspace redesign

Mode: Operate. The student should see the next daily action, enter attendance quickly, distinguish missing time out and absences, and move a report through its existing stages. All calculations, server actions, confirmation steps, and export limits remain intact.

## Direction contract

**THESIS:** Daybook reads like a trustworthy personal timetable: dates, states, and next actions align in a clear schedule, without decorative dashboard tiles.

**OWN-WORLD:** Cool paper white and pale slate surfaces, deep ink text, one clear blue for action, and restrained amber and red for attention. Thin rules, structured rows, compact status tags, and a humanist sans organize both forms and records.

**STORY:** Start or finish a workday, understand credited progress toward 486 hours, then write and submit the day's report. A date stays the common thread between screens.

**FIRST VIEWPORT:** Navigation sits in a compact top rail. The dashboard leads with hours remaining and a long horizontal progress track, with completed days and open attendance alongside; the next action appears immediately below. On phones these elements stack in reading order and actions span a comfortable touch width.

**FORM:** A timetable and service record, fourth grounded direction from seed 6b1e8489. Status changes behave like updated schedule lines; navigation stays conventional and exact. The signature interaction is the attendance preview updating as the student changes times or chooses absence.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
