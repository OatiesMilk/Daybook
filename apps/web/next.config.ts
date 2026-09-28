import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: ["@dtr/attendance", "@dtr/identity", "@dtr/reports", "@dtr/shared"],
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/reports/*/export": ["./templates/dar-template.docx", "./templates/dar-template.pdf", "./templates/fonts/**"],
    "/api/reports/import": ["../../packages/reports/src/infrastructure/pdf-import-worker.mjs", "../../node_modules/pdfjs-dist/**"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
