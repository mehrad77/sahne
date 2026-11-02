// The season board's model (src/model/board.ts) as the board and the new-episode page use it: a day that is not one (a
// date field cleared or half typed) places nothing, rather than throwing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { boardOf, isDay, rowOn, weekOf } from "../src/model/board.ts";

const season = { v: 1, id: "s1", n: 1, title: { en: "Season 1" }, launch: "2026-09-14" } as never;
const weeks = boardOf(season, { s1e01: "2026-09-14", s1e02: "2026-09-15" });

test("a cleared or half-typed date is no day, and has no row on the board", () => {
  for (const s of ["", "2026-09", "2026-13-40", "abc"]) {
    assert.equal(isDay(s), false, s);
    assert.equal(weekOf(weeks, s), null, s);
    assert.equal(rowOn(weeks, s), null, s);
  }
  assert.equal(isDay("2026-09-16"), true);
  assert.deepEqual(rowOn(weeks, "2026-09-19"), { date: "2026-09-19", kind: "special", week: 1 });
});
