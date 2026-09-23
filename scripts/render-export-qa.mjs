import { readFile, writeFile } from "node:fs/promises";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

for (const name of ["short", "long"]) {
  const bytes = new Uint8Array(await readFile(new URL(`../.data/exports-qa/${name}.pdf`, import.meta.url)));
  const loading = getDocument({ data: bytes, useSystemFonts: true });
  const pdf = await loading.promise;
  let allText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
    await writeFile(new URL(`../.data/exports-qa/${name}-${i}.png`, import.meta.url), canvas.toBuffer("image/png"));
    allText += (await page.getTextContent()).items.map(item => item.str ?? "").join(" ");
  }
  if (!allText.includes("62 hours and 30 mins") || !allText.includes(name === "long" ? "Activity 18" : "Activity 3")) throw new Error("PDF content verification failed");
  console.log(`${name}: ${pdf.numPages} pages rendered; cumulative total and last activity verified`);
  await loading.destroy();
}
