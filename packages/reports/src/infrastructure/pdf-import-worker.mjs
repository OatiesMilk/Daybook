import { parentPort, workerData } from "node:worker_threads";

const MAX_PAGES = 20;
const MAX_ITEMS = 50_000;
const MAX_TEXT = 200_000;

try {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(workerData),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > MAX_PAGES) throw new Error(`PDFs may contain at most ${MAX_PAGES} pages.`);

  const pages = [];
  let itemCount = 0;
  let textLength = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      itemCount++;
      textLength += item.str.length;
      if (itemCount > MAX_ITEMS || textLength > MAX_TEXT) throw new Error("The PDF contains too much text to import safely.");
      items.push({ text: item.str, x: item.transform[4], y: item.transform[5] });
    }
    pages.push(items);
    page.cleanup();
  }
  await loadingTask.destroy();
  parentPort.postMessage({ ok: true, pages });
} catch (cause) {
  const message = cause instanceof Error ? cause.message : "The PDF could not be parsed.";
  parentPort.postMessage({ ok: false, error: message });
}
