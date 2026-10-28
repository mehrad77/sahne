// Saving keeps what an edit did not touch (server/save.ts): a number's spelling (1.0), the key order, whether the file ends
// in a newline, Turkish and Persian as written; an edit of one line changes only that line of the file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format, keepNumbers, keepOrder, parseKeep, plain, readFile, sortedKeys, textFor, writeAtomic } from "../server/save.ts";

const TEXT = `{
  "v": 1,
  "id": "kahve",
  "name": { "tr": "Kahve", "fa": "قهوه" },
  "marks": {
    "a": {
      "x": 1.0,
      "z": -2.50
    }
  },
  "order": 3
}`.replace(/\{ "tr": "Kahve", "fa": "قهوه" \}/, `{\n    "tr": "Kahve",\n    "fa": "قهوه"\n  }`);

test("a file read and written again is the same, numbers as spelled", () => {
  const doc = parseKeep(TEXT);
  assert.equal(format(doc, false), TEXT);
  assert.equal(format(doc, true), TEXT + "\n");
});

test("an edit from the browser keeps the old spelling where the value did not change", () => {
  const edited = plain(parseKeep(TEXT)) as { order: number; marks: { a: { x: number; z: number } } };
  assert.equal(edited.marks.a.x, 1);
  edited.order = 4;
  const out = format(keepNumbers(edited, parseKeep(TEXT)), false);
  const diff = out.split("\n").filter((l, i) => l !== TEXT.split("\n")[i]);
  assert.deepEqual(diff, [`  "order": 4`]);
  edited.marks.a.x = 1.5;
  assert.match(format(keepNumbers(edited, parseKeep(TEXT)), false), /"x": 1\.5,\n\s+"z": -2\.50/);
});

test("textFor keeps the file's newline; a new file gets one; writes are atomic", () => {
  const dir = mkdtempSync(join(tmpdir(), "backstage-save-"));
  try {
    const u = pathToFileURL(join(dir, "kahve.json"));
    writeFileSync(u, TEXT);
    const doc = plain(readFile(u).doc) as Record<string, unknown>;
    doc.order = 5;
    const t = textFor(u, doc);
    assert.ok(!t.endsWith("\n"), "no newline, as the file had none");
    assert.match(t, /"x": 1\.0/);
    writeAtomic(u, t);
    assert.equal(readFileSync(u, "utf8"), t);
    assert.deepEqual(readdirSync(dir), ["kahve.json"], "no temp file left");
    const fresh = pathToFileURL(join(dir, "yeni.json"));
    assert.ok(textFor(fresh, { id: "yeni" }).endsWith("}\n"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an object written in another order keeps the file's order; a sorted file stays sorted", () => {
  const prev = { b: 1, a: { y: 1, x: 2 }, c: [{ q: 1, p: 2 }] };
  const next = { a: { x: 3, y: 1, z: 0 }, c: [{ p: 2, q: 1 }], b: 1, d: 4 };
  assert.deepEqual(JSON.stringify(keepOrder(next, prev, false)), JSON.stringify({ b: 1, a: { y: 1, x: 3, z: 0 }, c: [{ q: 1, p: 2 }], d: 4 }));
  assert.ok(!sortedKeys(prev));
  assert.ok(sortedKeys({ a: 1, b: { c: 1, d: [{ e: 1, f: 2 }] } }));
  assert.deepEqual(Object.keys(keepOrder({ z: 1, a: 2 }, { a: 1 }, true) as object), ["a", "z"]);
});
