// The series and its seasons (check/rules.ts checkSeries, check/world.ts calendarOf): the content root's documents
// pass, and each seeded break is refused: a season's file name, a story without its season, the calendar both ways
// and against days.json, a week's arc, the narrator; a root without series.json gets one warning.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDoc } from "../check/schema.ts";
import { arcId, checkSeries, checkStory } from "../check/rules.ts";
import { calendarOf, loadWorld, type World } from "../check/world.ts";
import { seasonOf } from "../src/index.ts";

const world = loadWorld();
const fresh = (): World => structuredClone(world);
const errors = (w: World) => checkSeries(w).filter(p => p.level === "error").map(p => p.message);

test("the content root's series and seasons are valid", () => {
  if (!world.series) return; // a root that predates series: its own test below
  assert.deepEqual(validateDoc("series", world.series), []);
  for (const se of Object.values(world.seasons)) assert.deepEqual(validateDoc("season", se), [], se.id);
  assert.deepEqual(errors(world), []);
});

test("ids: seasons of story ids, arc ids of weeks", () => {
  assert.equal(seasonOf("s1e00"), 1);
  assert.equal(seasonOf("s12e03"), 12);
  assert.equal(seasonOf("x1"), 0);
  assert.equal(arcId(1, 3), "s1w03");
  assert.equal(arcId(2, 11), "s2w11");
});

test("a root without series.json gets one warning, no error", () => {
  const w = fresh(); w.series = null; w.seasons = {};
  const ps = checkSeries(w);
  assert.equal(ps.filter(p => p.level === "error").length, 0);
  assert.equal(ps.filter(p => p.level === "warning" && p.story === "series").length, 1);
});

test("a season's id and n follow its file name", () => {
  const w = fresh();
  w.series ??= { v: 1, id: "t", title: { tr: "t", en: "t", fa: "t" }, narrator: "kerim", standin: "nima" };
  w.seasons = { s1: { v: 1, id: "s2", n: 2, title: { tr: "t", en: "t", fa: "t" } } };
  const es = errors(w);
  assert.ok(es.some(m => /the file is s1 but the season's id is s2/.test(m)));
  assert.ok(es.some(m => /n is 2 but the file is s1/.test(m)));
});

test("every story's season has a document", () => {
  const w = fresh();
  w.series ??= { v: 1, id: "t", title: { tr: "t", en: "t", fa: "t" }, narrator: "kerim", standin: "nima" };
  w.seasons = {};
  assert.ok(errors(w).some(m => /season s1 has no document/.test(m)));
});

test("the calendar has a row for every story of its season and a story for every row", () => {
  const w = fresh(), id = w.drafts[0].id, n = seasonOf(id);
  w.seasons = { [`s${n}`]: { v: 1, id: `s${n}`, n, title: { tr: "t", en: "t", fa: "t" }, calendar: { [`s${n}e99`]: { date: "2026-12-01", kind: "episode", week: 1 } } } };
  const ps = checkSeries(w);
  assert.ok(ps.some(p => p.level === "error" && p.message === `${id} has no row in season s${n}'s calendar`));
  assert.ok(ps.some(p => p.level === "warning" && /s\d+e99, which is not written yet/.test(p.message)));
});

test("the seasons' calendars are the release calendar, kept in step with days.json", () => {
  const seasons = { s1: { v: 1 as const, id: "s1", n: 1, title: { tr: "t", en: "t", fa: "t" }, calendar: { s1e01: { date: "2026-10-28", kind: "episode" as const, week: 1 } } } };
  assert.deepEqual(calendarOf(seasons, null), { s1e01: { id: "s1e01", date: "2026-10-28", kind: "episode", week: 1 } });
  const file = { s1e01: { id: "s1e01", date: "2026-10-28", kind: "episode" as const, week: 1 } };
  assert.equal(calendarOf({}, file), file, "without a season calendar, days.json");
  const w = fresh();
  w.seasons = seasons; w.days = calendarOf(seasons, null);
  w.daysFile = { s1e01: { ...file.s1e01, date: "2026-10-29" }, s1e02: { id: "s1e02", date: "2026-10-30", kind: "episode", week: 1 } };
  const ws = checkSeries(w).filter(p => p.level === "warning").map(p => p.message);
  assert.ok(ws.some(m => /days.json is behind the season's calendar \(2026-10-29 episode week 1, the season 2026-10-28/.test(m)), "the seasons are the source: days.json is regenerated");
  assert.ok(ws.some(m => /s1e02 is in no season's calendar/.test(m)));
  assert.ok(!errors(w).some(m => /days.json/.test(m)));
});

test("a story's arc is its season's, and its week's", () => {
  const w = fresh(), d = w.drafts[0], n = seasonOf(d.id);
  const arc = d.story.arc!;
  w.seasons = { [`s${n}`]: { v: 1, id: `s${n}`, n, title: { tr: "t", en: "t", fa: "t" }, arcs: { [arc.id]: { tr: "başka", en: arc.en, fa: arc.fa, mechanics: arc.mechanics } } } };
  assert.ok(errors(w).some(m => m === `arc ${arc.id} differs from season s${n}'s`));
  // the calendar's week names the arc: week 3 of season n is s<n>w03
  const w2 = fresh();
  w2.days = { [d.id]: { id: d.id, date: d.story.releaseDate!, kind: d.story.kind!, week: 3 } };
  assert.ok(checkStory(w2.drafts[0], w2).some(p => p.rule === "calendar" && p.message === `arc ${arc.id} but the story is in week 3`));
});

test("the narrator and the stand-in are the stage's", () => {
  const w = fresh();
  w.series = { v: 1, id: "t", title: { tr: "t", en: "t", fa: "t" }, narrator: "ismail", standin: "nima" };
  const es = errors(w);
  assert.ok(es.some(m => /the narrator ismail is a cast, not a narrator/.test(m)));
  assert.ok(es.some(m => /another narrator is not supported yet/.test(m)));
});

test("two stories' arcs are the same arc whatever order their keys were written in", async () => {
  const { checkSeason } = await import("../check/rules.ts");
  const w = fresh(), d = w.drafts[0], arc = d.story.arc!;
  const twin = { ...d, id: "s1e98", story: { ...d.story, id: "s1e98", releaseDate: "2026-12-31", arc: Object.fromEntries(Object.entries(arc).reverse()) as typeof arc } };
  assert.ok(!checkSeason(w, [d, twin]).some(p => /differs/.test(p.message)));
  const other = { ...twin, story: { ...twin.story, arc: { ...arc, tr: "başka" } } };
  assert.ok(checkSeason(w, [d, other]).some(p => /differs/.test(p.message)));
});
