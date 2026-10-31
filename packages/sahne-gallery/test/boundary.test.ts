// The repo stands alone: no source, script or config names a path outside it. Every relative path literal
// ("../…") resolves inside the repo, and nothing names the monorepo Sahne came from (its apps, tools, docs or
// content). Story data comes only through sahne-story/paths.ts (SAHNE_CONTENT or the samples).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "golden"]);
const EXT = /\.(ts|mjs|js|json|ya?ml|html|css)$/;

function* files(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* files(join(dir, e.name)); }
    else if (EXT.test(e.name)) yield join(dir, e.name);
  }
}
const all = [...files(ROOT)].filter(f => f !== SELF);

test("nothing names the monorepo's apps, tools, docs or content", () => {
  const banned = [/\.\.\/\.\.\/(apps|tools|docs|content)\b/, /apps\/yakerim/];
  const bad = all.flatMap(f => readFileSync(f, "utf8").split("\n").flatMap((l, i) => banned.some(re => re.test(l)) ? [`${relative(ROOT, f)}:${i + 1}: ${l.trim().slice(0, 120)}`] : []));
  assert.deepEqual(bad, []);
});

test("every relative path in a source or script resolves inside the repo", () => {
  const bad: string[] = [];
  for (const f of all.filter(f => /\.(ts|mjs|js)$/.test(f))) {
    readFileSync(f, "utf8").split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/["'`](\.\.\/[^"'`$]*)["'`]/g)) {
        const to = resolve(dirname(f), m[1]);
        if (to !== ROOT.slice(0, -1) && !to.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) bad.push(`${relative(ROOT, f)}:${i + 1}: ${m[1]}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});
