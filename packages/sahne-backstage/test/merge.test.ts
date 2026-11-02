// Two edits of one document made one (src/model/path.ts `merge3`), as accepting an agent's proposal over the person's
// unsaved edits does (src/events.ts): a step the proposal adds, removes or moves lands among the person's steps, a change
// to a step lands on that step wherever the person moved it, and a place both changed differently is a conflict.

import { test } from "node:test";
import assert from "node:assert/strict";
import { insert, merge3, move, set } from "../src/model/path.ts";

const line = (n: string, tr = n) => ({ who: "a", tr, en: n });
const disk = { title: "t", steps: ["s0", "s1", "s2", "s3", "s4", "s5", "s6"].map(n => line(n)) };
const mine = set(disk, ["steps", 1, "tr"], "s1 mine");
const steps = (d: unknown) => (d as typeof disk).steps.map(s => s.tr);

test("a step added, removed or moved by the proposal lands right among the person's edits", () => {
  assert.deepEqual(steps(merge3(disk, mine, insert(disk, ["steps"], 4, line("new"))).doc), ["s0", "s1 mine", "s2", "s3", "new", "s4", "s5", "s6"]);
  assert.deepEqual(steps(merge3(disk, mine, set(disk, ["steps", 2], undefined)).doc), ["s0", "s1 mine", "s3", "s4", "s5", "s6"]);
  assert.deepEqual(steps(merge3(disk, mine, move(disk, ["steps"], 5, 2)).doc), ["s0", "s1 mine", "s5", "s2", "s3", "s4", "s6"]);
});

test("a step's new words land on that step, after the person added a line before it", () => {
  const added = insert(disk, ["steps"], 2, line("mine"));
  assert.deepEqual(steps(merge3(disk, added, set(disk, ["steps", 5, "tr"], "s5 theirs")).doc), ["s0", "s1", "mine", "s2", "s3", "s4", "s5 theirs", "s6"]);
});

test("one place changed both ways is a conflict; the same change both ways is taken once", () => {
  assert.deepEqual(merge3(disk, mine, set(disk, ["steps", 1, "tr"], "s1 theirs")).conflict, ["steps", 1, "tr"]);
  assert.equal(merge3(disk, set(disk, ["steps", 2], undefined), set(disk, ["steps", 2, "tr"], "x")).conflict?.join("/"), "steps/2");
  const both = insert(disk, ["steps"], 3, line("same"));
  assert.deepEqual(steps(merge3(disk, both, both).doc), steps(both));
  assert.deepEqual(merge3(disk, mine, set(disk, ["title"], "T")).doc, set(mine, ["title"], "T"));
});

test("a proposal built on another takes that one's changes too, applied first (events.ts chainOf)", () => {
  const p1 = set(disk, ["steps", 2, "tr"], "s2 p1"), p2 = insert(p1, ["steps"], 5, line("p2"));
  const alone = merge3(p1, mine, p2).doc, chained = merge3(p1, merge3(disk, mine, p1).doc, p2).doc;
  assert.equal(steps(alone)[2], "s2", "merged from its own base only, the held change is missing");
  assert.deepEqual(steps(chained), ["s0", "s1 mine", "s2 p1", "s3", "s4", "p2", "s5", "s6"]);
});

test("the same step added twice by the proposal lands twice; once when the person added it too", () => {
  const wait = { beat: { who: "a", wait: 600 } }, twice = insert(insert(disk, ["steps"], 3, wait), ["steps"], 3, wait);
  assert.equal((merge3(disk, mine, twice).doc as { steps: unknown[] }).steps.filter(s => "beat" in (s as object)).length, 2);
  assert.equal((merge3(disk, insert(mine, ["steps"], 3, wait), twice).doc as { steps: unknown[] }).steps.filter(s => "beat" in (s as object)).length, 2);
});

test("a step both rewrote, or one removed and the other rewrote, is a conflict, not two steps", () => {
  const rewrite = (d: unknown, tr: string) => set(d, ["steps", 0], { who: "a", tr, en: `${tr} en` });
  assert.deepEqual(merge3(disk, rewrite(disk, "mine"), rewrite(disk, "theirs")).conflict, ["steps", 0]);
  assert.deepEqual(merge3(disk, set(disk, ["steps", 0], undefined), rewrite(disk, "theirs")).conflict, ["steps", 0]);
  assert.deepEqual(steps(merge3(disk, rewrite(disk, "same"), rewrite(disk, "same")).doc)[0], "same");
  assert.deepEqual(steps(merge3(disk, set(disk, ["steps", 0], undefined), set(disk, ["steps", 0], undefined)).doc)[0], "s1");
});
