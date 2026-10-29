// The editor's pure model (src/model/): paths into a document, the cue each path plays at, undo and redo, the step list's
// rows, which edits only change words, and the flags a story's callbacks read. On the sample story, played through the
// story adapter as the editor plays it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHARACTERS, PLACES, storyFile } from "../../sahne-story/paths.ts";
import { adaptStory, type CharacterDoc, type StoryDoc } from "../../sahne-story/src/index.ts";
import { cueOf, cuePath, get, insert, move, same, set, within } from "../src/model/path.ts";
import * as H from "../src/model/history.ts";
import { flagsIn, kindOf, rows, wordsOnly } from "../src/model/steps.ts";

const json = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
const STORY: StoryDoc = json(storyFile("s1e00"));
const characters: Record<string, CharacterDoc> = Object.fromEntries(["kerim", "nima", "ismail"].map(id => [id, json(new URL(`${id}.json`, CHARACTERS))]));
const places = Object.fromEntries(["bakkal", "metro_m11"].map(id => [id, json(new URL(`${id}.json`, PLACES))]));

test("set writes one place, keeps the rest and the keys' order", () => {
  const doc = { a: 1, steps: [{ who: "x", tr: "a", en: "b" }, { beat: {} }], z: 2 };
  const out = set(doc, ["steps", 0, "tr"], "yeni");
  assert.equal(get(out, ["steps", 0, "tr"]), "yeni");
  assert.equal(out.steps[1], doc.steps[1], "untouched branches are the same objects");
  assert.deepEqual(Object.keys(out.steps[0]), ["who", "tr", "en"]);
  assert.deepEqual(Object.keys(set(doc, ["steps"], []) as object), ["a", "steps", "z"]);
  assert.deepEqual(Object.keys(set(doc, ["a"], undefined) as object), ["steps", "z"], "undefined removes a key");
  assert.deepEqual(set(doc, ["steps", 0], undefined).steps.length, 1, "undefined removes an item");
  assert.deepEqual(set({}, ["obj", 0, "id"], "k"), { obj: [{ id: "k" }] });
});

test("insert and move in an array", () => {
  const doc = { steps: ["a", "b", "c"] };
  assert.deepEqual(insert(doc, ["steps"], 1, "x").steps, ["a", "x", "b", "c"]);
  assert.deepEqual(insert(doc, ["steps"], 9, "x").steps, ["a", "b", "c", "x"]);
  assert.deepEqual(move(doc, ["steps"], 0, 2).steps, ["b", "c", "a"]);
  assert.equal(move(doc, ["steps"], 0, 5), doc);
});

test("every cue maps back to its place in the story, and every row's path to a cue", () => {
  const perf = adaptStory(STORY, { places, characters }).perform();
  for (const i of perf.info) {
    const v = get(STORY, cuePath(i));
    assert.ok(v && typeof v === "object", `cue of step ${i.step} (${i.kind}) has a place in the story`);
    if (i.kind === "line" || i.kind === "reply") assert.equal((v as { tr?: string }).tr, i.tr);
  }
  for (const r of rows(STORY)) {
    const k = cueOf(perf.info, r.path);
    // a row of the option not picked has no cue in this performance
    if (r.kind === "option" || r.kind === "reply") continue;
    if (r.gate?.startsWith("if")) continue;
    assert.ok(k >= 0, `row ${r.n} plays at a cue`);
    assert.ok(within(cuePath(perf.info[k]), r.path) || within(r.path, cuePath(perf.info[k])));
  }
  assert.ok(same(["steps", 1], ["steps", 1]) && !same(["steps", 1], ["steps", 2]));
});

test("undo, redo, revert; typing into one field is one step", () => {
  let d = H.open({ t: "a" }, 5);
  d = H.edit(d, { t: "ab" }, "t", 1000);
  d = H.edit(d, { t: "abc" }, "t", 1500);
  assert.equal(d.past.length, 1, "two keystrokes, one step");
  d = H.edit(d, { t: "abcd" }, "t", 4000);
  assert.equal(d.past.length, 2, "a pause starts a new step");
  assert.ok(H.dirty(d));
  d = H.undo(d); assert.deepEqual(d.doc, { t: "abc" });
  d = H.redo(d); assert.deepEqual(d.doc, { t: "abcd" });
  d = H.revert(d); assert.deepEqual(d.doc, { t: "a" }); assert.ok(!H.dirty(d));
  d = H.undo(d); assert.deepEqual(d.doc, { t: "abcd" }, "a revert is undone like any edit");
  d = H.saved(d, 9); assert.ok(!H.dirty(d)); assert.equal(d.mtime, 9);
  assert.equal(H.edit(d, { t: "abcd" }), d, "no change, no step");
});

test("the step list: every step, a choice's options and their replies", () => {
  const rs = rows(STORY);
  assert.equal(rs.filter(r => r.depth === 0).length, STORY.steps.length);
  const choice = STORY.steps.findIndex(s => kindOf(s) === "choice");
  assert.ok(choice >= 0);
  const opts = rs.filter(r => r.kind === "option");
  assert.ok(opts.length >= 2 && opts.every(r => r.path[1] === choice));
  for (const r of rs) assert.ok(get(STORY, r.path) !== undefined, `row ${r.n}`);
});

test("only words, or what the stage draws", () => {
  const words = set(STORY, ["steps", 1, "tr"], "Başka.");
  assert.ok(wordsOnly(STORY, words));
  assert.ok(wordsOnly(STORY, set(STORY, ["quiz", 0, "why"], "x")));
  assert.ok(!wordsOnly(STORY, set(STORY, ["steps", 1, "emo"], "sad")));
  assert.ok(!wordsOnly(STORY, set(STORY, ["steps", 1, "who"], "nima")));
});

test("the flags a story's callbacks read", () => {
  const s = set(set(STORY, ["steps", 2, "if"], "s1e00_a"), ["steps", 3, "unless"], "s1e00_b");
  assert.deepEqual(flagsIn(s), ["s1e00_a", "s1e00_b"]);
  assert.deepEqual(flagsIn({ steps: [] }), []);
});

test("what changed since a version: the rows, the fields, a word diff", async () => {
  const { changes, diffWords } = await import("../src/model/diff.ts");
  assert.deepEqual(diffWords("Bir portakal lütfen", "İki portakal lütfen"), [{ op: "-", text: "Bir" }, { op: "+", text: "İki" }, { op: "=", text: " portakal lütfen" }]);
  assert.deepEqual(diffWords("a", "a"), [{ op: "=", text: "a" }]);
  const now = set(set(STORY, ["steps", 1, "tr"], "Yeni."), ["title", "en"], "New");
  const c = changes(STORY, now);
  assert.deepEqual(c.fields, ["title"]);
  assert.deepEqual(c.rows.map(r => r.row.path), [["steps", 1]]);
  assert.equal(changes(null, STORY).added, STORY.steps.length);
});
