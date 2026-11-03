// The release calendar across seasons (check/world.ts `calendarOf`, check/rules.ts): a season's own `calendar` is the
// source for its stories, and days.json still dates the stories of a season that has none yet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSeries, checkStory } from "../check/rules.ts";
import { calendarOf, loadWorld, type Day, type World } from "../check/world.ts";
import type { SeasonDoc, StoryDoc } from "../src/types.ts";
import { lesson } from "../../sahne-lesson/src/index.ts";

const world: World = loadWorld();
const d0 = world.drafts.find(x => x.id === "s1e00")!;
const date = d0.story.releaseDate!;
const s1: SeasonDoc = { ...world.seasons.s1, calendar: { s1e00: { date, kind: "episode", week: 0 } } };
const s2: SeasonDoc = { v: 1, id: "s2", n: 2, title: { tr: "İki", en: "Two", fa: "دو" } };
const story2 = (() => { const { arc: _a, ...s } = structuredClone(d0.story); return { ...s, id: "s2e01", season: 2, releaseDate: "2027-03-01" } as StoryDoc; })();
const d2 = { ...d0, id: "s2e01", story: story2 };
const row = (id: string, date: string, week: number): Day => ({ id, date, week, kind: "episode" });
const worldOf = (daysFile: Record<string, Day> | null): World => ({ ...world, seasons: { s1, s2 }, drafts: [d0, d2], daysFile, days: calendarOf({ s1, s2 }, daysFile) });
const calendar = (w: World) => [...checkStory(d2, w, { plugins: [lesson] }), ...checkSeries(w, { plugins: [lesson] })].filter(p => p.rule === "calendar").map(p => `${p.level}: ${p.message}`);

test("calendar: days.json still dates the stories of a season with no calendar of its own", () => {
  const daysFile = { s1e00: row("s1e00", date, 0), s2e01: row("s2e01", "2027-03-01", 1) };
  const w = worldOf(daysFile);
  assert.deepEqual(w.days?.s2e01, daysFile.s2e01);
  assert.deepEqual(calendar(w), []);
  // a season's own calendar wins over days.json for its stories
  assert.equal(calendarOf({ s1 }, { s1e00: row("s1e00", "2000-01-01", 9) })?.s1e00.date, date);
});

test("calendar: without days.json, a season with no calendar asks no row; one with a calendar does", () => {
  assert.deepEqual(calendar(worldOf(null)), []);
  const w = worldOf(null), lost = { ...w, seasons: { ...w.seasons, s1: { ...s1, calendar: {} } } };
  assert.ok(checkStory(d0, { ...lost, days: calendarOf(lost.seasons, null) }, { plugins: [lesson] }).some(p => p.message === "s1e00 has no row in season s1's calendar"));
});
