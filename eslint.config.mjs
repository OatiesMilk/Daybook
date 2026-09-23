import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "apps/web/" } } },
  globalIgnores([".next/**", "apps/*/.next/**", ".tools/**", ".npm-cache/**", ".github/skills/**", "**/next-env.d.ts"]),
]);
