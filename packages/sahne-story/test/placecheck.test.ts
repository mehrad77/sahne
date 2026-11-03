// The place checker (places.ts) on a content root of its own: places are named in the series' languages, and a kit item
// of the root that is not good is an error.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../samples/", import.meta.url));
const run = (root: string) => spawnSync(process.execPath, [fileURLToPath(new URL("../places.ts", import.meta.url)), "--check"], { env: { ...process.env, SAHNE_CONTENT: root }, encoding: "utf8" });

test("places.ts: the series' languages name the places, and a bad kit file is an error", () => {
  const root = mkdtempSync(join(tmpdir(), "sahne-places-"));
  try {
    cpSync(SAMPLES, root, { recursive: true });
    assert.equal(run(root).status, 0, "the samples pass");
    // a series that adds German: every place lacks its German name, and Persian is no longer asked
    const series = JSON.parse(readFileSync(join(root, "series.json"), "utf8"));
    writeFileSync(join(root, "series.json"), JSON.stringify({ ...series, languages: { main: "tr", translations: ["en", "de"] } }, null, 2) + "\n");
    const de = run(root);
    assert.equal(de.status, 1);
    assert.match(de.stdout, /no name in de/);
    assert.doesNotMatch(de.stdout, /no name in (tr|en|fa)/);
    writeFileSync(join(root, "series.json"), JSON.stringify(series, null, 2) + "\n");
    // a kit piece that is not good is named and fails the check, though no place uses it
    mkdirSync(join(root, "kit", "pieces"), { recursive: true });
    writeFileSync(join(root, "kit", "pieces", "x_bad.json"), "{}\n");
    const bad = run(root);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /kit\/pieces\/x_bad\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
