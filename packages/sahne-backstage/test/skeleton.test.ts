// A new episode's first draft (src/model/skeleton.ts) in every kind of series: with and without the lesson plugin,
// interactive and watch-only. Each must pass the story check as it is, or the editor could never save a new episode.

import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERACTIVE_MECHANICS, type PlayMode, type StoryDoc } from "sahne-story";
import { checkStory } from "../../sahne-story/check/rules.ts";
import { loadWorld, type World } from "../../sahne-story/check/world.ts";
import { skeleton } from "../src/model/skeleton.ts";
import { STORY_PLUGINS } from "../src/model/plugins.ts";

const world: World = loadWorld();
const s0 = world.drafts.find(d => d.id === "s1e00")!;
const se = world.seasons.s1, arcId = Object.keys(se.arcs ?? {})[0];

for (const lesson of [true, false]) for (const play of ["interactive", "watch"] as PlayMode[]) {
  test(`skeleton: a new draft passes the check (lesson plugin ${lesson ? "on" : "off"}, ${play})`, () => {
    const series = { ...world.series!, plugins: lesson ? ["lesson"] : [], play };
    const w: World = { ...world, series };
    // a watch-only series' arcs ask nothing of the viewer
    const arc = { ...se.arcs![arcId], id: arcId, mechanics: (se.arcs![arcId].mechanics ?? []).filter(m => play === "interactive" || !(INTERACTIVE_MECHANICS as readonly string[]).includes(m)) };
    const doc = skeleton({ id: "s1e02", season: 1, releaseDate: "2099-01-05", kind: "episode", week: 1, arc, place: "bakkal", cast: ["ismail"],
      ...(lesson ? { words: ["a1-w-a", "a1-w-b", "a1-w-c", "a1-w-d", "a1-w-e"], lessons: ["g_a1_2_var_yok"], level: "A1" } : {}), title: { tr: "Yeni" } },
      { narrator: "kerim", standin: "nima", places: world.places, languages: world.series?.languages, lesson, play });
    const errors = checkStory({ ...s0, id: "s1e02", story: doc as StoryDoc }, w, { plugins: STORY_PLUGINS }).filter(p => p.level === "error");
    assert.deepEqual(errors.map(p => `${p.rule}: ${p.message}`), []);
    const steps = JSON.stringify(doc.steps);
    assert.equal(steps.includes('"spot"'), lesson, "a spot only with the plugin");
    assert.equal("quiz" in doc, lesson, "a quiz only with the plugin");
    assert.equal(steps.includes('"choice"'), play === "interactive", "a choice only in an interactive episode");
  });
}
