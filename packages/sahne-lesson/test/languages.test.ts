// The lesson checks in a series whose main language is not Turkish: they read each line in the main language.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStory } from "../../sahne-story/check/rules.ts";
import { loadWorld, type World } from "../../sahne-story/check/world.ts";
import { lesson } from "../src/index.ts";

const world: World = loadWorld();
const d0 = world.drafts.find(x => x.id === "s1e00")!;
const mistakes = (story: unknown, w: World) => checkStory({ ...d0, story: story as typeof d0.story }, w, { plugins: [lesson] }).filter(p => p.rule === "mistake").map(p => p.message);

test("lesson: a mistake's fix is looked for in the main language's lines", () => {
  // line 4 (İsmail: "Good evening! Come in.") is fixed by line 5 ("Are there oranges?")
  const s = structuredClone(d0.story) as { steps: Record<string, unknown>[] };
  s.steps[4].mistake = { fix: "oranges" };
  // English with Turkish kept as a translation: the fix is English, so it is found
  const enTr: World = { ...world, series: { ...world.series!, languages: { main: "en", translations: ["tr", "fa"] } } };
  assert.deepEqual(mistakes(s, enTr), []);
  // English with no Turkish at all: no line has a `tr`, and the check still runs
  const strip = (x: unknown): void => { if (Array.isArray(x)) x.forEach(strip); else if (x && typeof x === "object") { delete (x as { tr?: unknown }).tr; Object.values(x).forEach(strip); } };
  const bare = structuredClone(s); strip(bare.steps);
  const en: World = { ...world, series: { ...world.series!, languages: { main: "en", translations: ["fa"] } } };
  assert.deepEqual(mistakes(bare, en), []);
  (bare.steps[4] as { mistake: { fix: string } }).mistake.fix = "bread";
  assert.match(mistakes(bare, en)[0], /“bread” is not used in the next 3 lines/);
});
