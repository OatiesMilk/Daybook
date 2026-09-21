import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderDar } from "../src/models/docx-renderer.ts";
import { convertPdf } from "../src/models/pdf-converter.ts";

const output = new URL("../.data/exports-qa/", import.meta.url);
await mkdir(output, { recursive: true });
const template = await readFile(new URL("../templates/dar-template.docx", import.meta.url));
for (const [name, count] of [["short", 3], ["long", 18]] as const) {
  const docx = renderDar(template, {
    profile: { full_name: "Example Intern", last_name: "Intern", school: "Example University", department: "IT - Digital Innovation Group" },
    date: "2026-09-17", totalMinutes: 3750,
    rows: Array.from({ length: count }, (_, index) => ({
      project: "Supply Chain Portal", task: `Activity ${index + 1}: Reviewed the application structure and separated request handling from data access.\nChecked validation and access control.`,
      status: index % 2 ? "Completed" : "Ongoing", remarks: "Verified changes and documented the result.",
    })),
  });
  await writeFile(new URL(`${name}.docx`, output), docx);
  const pdf = await convertPdf(docx);
  await writeFile(new URL(`${name}.pdf`, output), pdf);
  console.log(`${name}: valid PDF, ${pdf.length} bytes`);
}
