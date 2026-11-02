// What a proposal was computed from (server/proposals.ts `from`), so the editor merges only its own changes into what it
// has (src/events.ts) and never reverts a save made since: the file at the proposal's mtime, the agent's own pending
// proposal it was built on, and nothing when the file changed in between.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-from-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
after(() => rmSync(root, { recursive: true, force: true }));

const { readDoc } = await import("../server/content.ts");
const { Proposals } = await import("../server/proposals.ts");
const { Events } = await import("../server/events.ts");
const { merge3 } = await import("../src/model/path.ts");

test("a proposal keeps the document it was computed from", async () => {
  const q = new Proposals(new Events()), disk = readDoc("story", "s1e00");
  const doc = disk.doc as { title: Record<string, string> };
  const edit = (title: string, base = disk.mtime) => ({ kind: "story" as const, doc: "s1e00", base, next: { ...doc, title: { ...doc.title, en: title } }, paths: [["title"]], summary: "retitle", by: "agent", problems: [] });
  const a = await q.add(edit("One"));
  assert.deepEqual(a.from, disk.doc, "the file at its mtime");
  const b = await q.add(edit("Two"));
  assert.deepEqual(b.from, a.next, "built on the same agent's pending one");
  const c = await q.add({ ...edit("Three", disk.mtime - 1), by: "other" });
  assert.equal("from" in c, false, "a file that changed since: none");
});

test("a save made after the proposal is kept when it is accepted", () => {
  const disk = readDoc("story", "s1e00").doc as { title: Record<string, string>; steps: unknown[] };
  const proposed = { ...disk, title: { ...disk.title, en: "Theirs" } };
  const saved = { ...disk, steps: disk.steps.slice(1) };
  assert.deepEqual(merge3(disk, saved, proposed).doc, { ...saved, title: proposed.title });
});
