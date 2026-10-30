import { test } from "node:test";
import assert from "node:assert/strict";
import { lineMatcher } from "../src/index.ts";

const m = lineMatcher({
  normalise: s => s.toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, "")),
  near: { ä: "a", ö: "o" },
  fillers: /^(?:u?h+m+|e+r+m*)$/,
  spellings: { okay: "ok", cannot: "can not" },
});

test("fillers and spellings are unified", () => {
  assert.equal(m.normalise("Um, hmm okay!"), "um ok");
  assert.deepEqual(m.sayWords("I cannot"), ["i", "can", "not"]);
});

test("joins, splits and names", () => {
  assert.equal(m.matchLine("canot go", ["can not go"]).matched, true);
  assert.equal(m.matchLine("Lima has bread", ["Nima has bread"], { names: ["Nima"] }).matched, true);
});

test("a near letter is a slip, a different word is a miss", () => {
  assert.equal(m.matchLine("schon", ["schön"]).matched, true);
  assert.equal(m.matchLine("two breads please", ["two breads, thanks"]).matched, false);
  assert.equal(m.matchLine("no bread", ["yes bread"]).best, -1);
  assert.equal(m.letters("o", "ö"), 0.25);
  assert.equal(m.allowance(3), 0.5);
});

test("a letter that folds to several letters (ß → ss) is a slip, both ways", () => {
  const m = lineMatcher({ normalise: s => s.toLowerCase().split(/\s+/).filter(Boolean), near: { ß: "ss", ä: "a" } });
  assert.equal(m.letters("ß", "ss"), 0.25);
  assert.equal(m.letters("straße", "strasse"), 0.25);
  assert.equal(m.letters("strasse", "straße"), 0.25);
  assert.equal(m.letters("bär", "bar"), 0.25);
  assert.equal(m.matchLine("strasse", ["straße"]).matched, true);
  assert.equal(m.matchLine("straße", ["strasse"]).matched, true);
  assert.equal(m.matchLine("strase", ["straße"]).matched, true);
  assert.equal(m.matchLine("strand", ["straße"]).matched, false);
});

test("the input is bounded: a long transcript is no match, and is refused fast", () => {
  const long = Array.from({ length: 5000 }, (_, i) => `w${i}`).join(" ");
  const t = performance.now();
  assert.equal(m.matchLine(long, [long]).matched, false);
  assert.equal(m.matchLine(Array.from({ length: 50 }, () => long), ["hello there"]).matched, false);
  assert.equal(m.matchLine("x".repeat(100000), ["hello there"]).matched, false);
  assert.ok(performance.now() - t < 100, "refused fast");
  const forty = Array.from({ length: 40 }, () => "bread").join(" ");
  assert.equal(m.matchLine(forty, [forty]).matched, true, "a line at the cap still matches");
});
