// The gallery shows everything Sahne does (src/coverage.ts): every system demo is registered, every
// engine vocabulary entry is in some demo's `covers`, and every DESIGN.md section from §5 to §10 is
// named by a demo or a view.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { SYSTEMS } from "../src/systems/registry.ts";
import { coverage, designShown } from "../src/coverage.ts";

const SYS = new URL("../src/systems/", import.meta.url);

test("every system demo in src/systems/ is in the registry, once", () => {
  const files = readdirSync(SYS).filter(f => f.endsWith(".ts") && !["registry.ts", "view.ts", "bench.ts"].includes(f)).map(f => f.slice(0, -3)).sort();
  const ids = SYSTEMS.map(s => s.id);
  assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), "an id twice");
  assert.deepEqual(ids.slice().sort(), files, "src/systems/<id>.ts and the registry differ");
});

test("every demo's covers name real vocabulary entries", () => {
  assert.deepEqual(coverage().unknown, [], "covers names entries the engine doesn't have");
});

test("every engine vocabulary entry has a demo", () => {
  assert.deepEqual(coverage().missing, [], "no demo covers these: add them to a demo's covers (and show them there)");
});

test("every DESIGN.md section from §5 to §10 is shown somewhere", () => {
  const design = readFileSync(new URL("../../sahne/DESIGN.md", import.meta.url), "utf8");
  const sections = [...design.matchAll(/^###? (\d+)(?:\.(\d+))? /gm)]
    .filter(m => +m[1] >= 5 && +m[1] <= 10)
    // a top section with subsections is shown through them
    .filter(m => m[2] || !new RegExp(`^### ${m[1]}\\.`, "m").test(design))
    .map(m => `§${m[1]}${m[2] ? `.${m[2]}` : ""}`);
  const shown = designShown();
  assert.deepEqual(sections.filter(s => !shown.has(s)), [], "no demo or view shows these sections");
});
