// The season board's model (src/model/board.ts) as the board and the new-episode page use it: a day that is not one (a
// date field cleared or half typed) places nothing, rather than throwing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { boardOf, isDay, localDay, onBoard, rowOn, weekOf } from "../src/model/board.ts";

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

test("an episode on a Sunday, or on a day another one has, is not on the board, so it waits under it", () => {
  const dates = { s1e01: "2026-09-14", s1e02: "2026-09-14", s1e03: "2026-09-20", s1e04: "2026-09-15" };
  const shown = onBoard(boardOf(season, dates));
  assert.equal(shown.size, 2);
  assert.equal(shown.has("s1e03"), false, "a Sunday has no column");
  assert.equal([shown.has("s1e01"), shown.has("s1e02")].filter(Boolean).length, 1, "one day shows one episode");
  assert.equal(shown.has("s1e04"), true);
});

test("today is the day in this computer's time zone", () => {
  assert.equal(localDay(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
  assert.equal(localDay(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});
