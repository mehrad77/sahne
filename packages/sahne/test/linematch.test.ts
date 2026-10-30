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
