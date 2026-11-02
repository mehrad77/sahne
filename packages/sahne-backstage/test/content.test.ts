// The save gate (server/content.ts `check`) on a temp copy of the samples: what counts as a problem the edit brings, and
// what the files already had. An old problem stays old wherever its step moves.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-content-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
after(() => rmSync(root, { recursive: true, force: true }));

const { check, forget, readDoc } = await import("../server/content.ts");

const storyFile = join(root, "stories", "s1e00.json");
/** Change a file of the root as another editor would, and read the root again. */
const onDisk = (file: string, fn: (doc: any) => void) => { const d = JSON.parse(readFileSync(file, "utf8")); fn(d); writeFileSync(file, JSON.stringify(d, null, 2) + "\n"); forget(); };
const brought = (edits: Parameters<typeof check>[0]) => check(edits).filter(p => p.new && p.level === "error").map(p => p.message);

test("an old problem stays old when a step above it is inserted, deleted or moved; one more of it is new", () => {
  const was = readFileSync(storyFile, "utf8");
  try {
    onDisk(storyFile, d => { d.steps[11].narr = true; }); // ismail narrates: an error the file already has
    const story = () => structuredClone(readDoc("story", "s1e00").doc) as { steps: Record<string, unknown>[] };
    assert.ok(check([{ kind: "story", id: "s1e00", doc: story() }]).some(p => /narr is only for/.test(p.message) && !p.new));
    const inserted = story(); inserted.steps.splice(7, 0, structuredClone(inserted.steps[6]));
    assert.deepEqual(brought([{ kind: "story", id: "s1e00", doc: inserted }]), []);
    const deleted = story(); deleted.steps.splice(2, 1);
    assert.ok(!brought([{ kind: "story", id: "s1e00", doc: deleted }]).some(m => /narr is only for/.test(m)));
    const twice = story(); twice.steps.splice(12, 0, structuredClone(twice.steps[11]));
    assert.ok(brought([{ kind: "story", id: "s1e00", doc: twice }]).some(m => /narr is only for/.test(m)), "a second narrating ismail is new");
  } finally { writeFileSync(storyFile, was); forget(); }
});
