import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = new URL("../packages/", import.meta.url);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

test("workspace packages respect the clean architecture boundaries", async () => {
  const root = decodeURIComponent(packageRoot.pathname).replace(/^\/(?:([A-Za-z]:))/, "$1");
  const files = await sourceFiles(root);
  assert.ok(files.length > 0, "expected workspace source files");

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from ["']@\//, `${file} must not reach into the web application`);

    if (file.includes(`${join("src", "domain")}`)) {
      assert.doesNotMatch(
        source,
        /from ["'](?:next(?:\/|["'])|react(?:\/|["'])|@supabase\/|[^"']*\/(?:application|infrastructure|presentation)\/)/,
        `${file} domain code must remain framework and adapter independent`,
      );
    }
  }
});
