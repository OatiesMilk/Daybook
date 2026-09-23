import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { ReportSnapshot } from "../domain/rules.ts";

export function renderDar(template: Buffer, snapshot: ReportSnapshot): Buffer {
  const doc = new Docxtemplater(new PizZip(template), { paragraphLoop: true, linebreaks: true });
  doc.render({
    ...snapshot.profile,
    date: `${snapshot.date.slice(5, 7)}/${snapshot.date.slice(8, 10)}/${snapshot.date.slice(0, 4)}`,
    hours: `${Math.floor(snapshot.totalMinutes / 60)} hours and ${snapshot.totalMinutes % 60} mins`,
    activities: snapshot.rows,
  });
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
