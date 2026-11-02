// Watch-only episodes (src/play.ts): a story that plays on time alone. The series sets the default and a story may
// differ; nothing in it waits for the viewer, and the check refuses what would.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { PLACES } from "../paths.ts";
import { adaptStory, isAct, isChoice, lintStory, playOf, type CharacterDoc, type Step, type StoryDoc } from "../src/index.ts";
import { validateDoc } from "../check/schema.ts";
import { checkSeries, checkStory } from "../check/rules.ts";
import { loadWorld, type World } from "../check/world.ts";
// the samples' series uses the lesson plugin: a test is a host, so it passes it in
import { lesson } from "../../sahne-lesson/src/index.ts";

const json = <T>(f: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const STORY = json<StoryDoc>("bakkal.json");
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };
const characters: Record<string, CharacterDoc> = Object.fromEntries(["ismail", "nima", "kerim"].map(id => [id, json<CharacterDoc>(`characters/${id}.json`)]));
const watched = (s: StoryDoc): StoryDoc => ({ ...structuredClone(s), play: "watch" });

test("watch: the story's own play wins, then the series', then interactive", () => {
  assert.equal(playOf({}, {}), "interactive");
  assert.equal(playOf({}, { play: "watch" }), "watch");
  assert.equal(playOf({ play: "interactive" }, { play: "watch" }), "interactive");
  assert.equal(playOf({ play: "watch" }, null), "watch");
  assert.deepEqual(validateDoc("series", { v: 1, id: "x", title: { tr: "x" }, narrator: "kerim", standin: "nima", play: "watch" }), []);
  assert.ok(validateDoc("series", { v: 1, id: "x", title: { tr: "x" }, narrator: "kerim", standin: "nima", play: "film" }).length);
});

test("watch: the adapter makes no turn; the stand-in's lines are lines, a choice plays its first option, an act only its reaction", () => {
  const on = adaptStory(watched(STORY), { places, characters, plugins: [lesson] }).perform();
  assert.ok(on.info.every(i => !i.turn), "no cue has a card");
  assert.ok(!on.info.some(i => i.kind === "say" || i.kind === "act"));
  assert.ok(!on.script.cues.some(c => "act" in c));
  const both = adaptStory(STORY, { places, characters, plugins: [lesson] }).perform();
  assert.equal(on.info.length, both.info.length - both.info.filter(i => i.kind === "act").length, "the same cues, less the acts");
  // the series' default reaches the adapter through `play`
  assert.ok(adaptStory(STORY, { places, characters, plugins: [lesson], play: "watch" }).turns.length === 0);
});

test("watch: no lint asks for the learner's turns", () => {
  const s = watched(STORY);
  s.steps = s.steps.filter(st => !isChoice(st) && !isAct(st) && !("who" in st && st.who === "nima"));
  assert.ok(lintStory(STORY, { places, characters, plugins: [lesson] }).every(p => p.rule !== "standin"));
  assert.ok(lintStory({ ...s, play: "interactive" }, { places, characters, plugins: [lesson] }).some(p => p.rule === "standin"), "an interactive story needs them");
  assert.ok(lintStory(s, { places, characters, plugins: [lesson] }).every(p => p.rule !== "standin"));
});

test("watch: the check refuses a choice, an act and, in a watch-only series, an arc mechanic that needs the viewer, and asks no choice count", () => {
  const world: World = loadWorld();
  const d = world.drafts.find(x => x.id === "s1e00")!;
  const errs = (story: StoryDoc, w: World = world) => checkStory({ ...d, story }, w, { plugins: [lesson] }).filter(p => p.level === "error");
  const asIs = errs(watched(d.story));
  assert.ok(asIs.some(p => p.rule === "play" && /a choice/.test(p.message)));
  assert.ok(asIs.some(p => p.rule === "play" && /an act/.test(p.message)));
  // a choice becomes the line that is said (its first option, then its replies), as the error asks
  const plain = watched(d.story);
  plain.steps = plain.steps.flatMap(st => {
    if (isAct(st)) return [];
    if (!isChoice(st)) return [st];
    const { ok: _o, tone: _t, sets: _s, warm: _w, reply, ...line } = st.choice.options[0];
    return [{ who: "nima", ...line } as Step, ...((reply ?? []) as Step[])];
  });
  if (plain.arc) plain.arc = { ...plain.arc, mechanics: [] };
  assert.deepEqual(errs(plain).map(p => `${p.rule}: ${p.message}`), [], "no choice count, no play error");
  // a series that watches by default makes the same story watch-only without its own field
  const { play: _p, ...noField } = plain;
  const watching: World = { ...world, series: { ...world.series!, play: "watch" } };
  assert.deepEqual(errs(noField as StoryDoc, watching).map(p => p.message), []);
  assert.ok(errs(noField as StoryDoc).some(p => /choices/.test(p.message)), "in an interactive series it needs its choices");
  const mech = structuredClone(plain);
  mech.arc = { ...(mech.arc ?? { id: "s1w01", tr: "x" }), mechanics: ["say", "unlocks"] };
  // a watch-only episode in an interactive series carries its week's arc as it is; a series that only watches asks no viewer
  assert.ok(!errs(mech).some(p => p.rule === "play"), "the week's arc of an interactive series");
  assert.ok(errs(mech, watching).some(p => p.rule === "play" && /say/.test(p.message)));
});

test("watch: a watch-only special in an interactive week passes with the season's arc", () => {
  const world: World = loadWorld();
  const d = world.drafts.find(x => x.id === "s1e00")!;
  const story = watched(d.story);
  story.steps = story.steps.flatMap(st => {
    if (isAct(st)) return [];
    if (!isChoice(st)) return [st];
    const { ok: _o, tone: _t, sets: _s, warm: _w, reply, ...line } = st.choice.options[0];
    return [{ who: "nima", ...line } as Step, ...((reply ?? []) as Step[])];
  });
  const w: World = { ...world, drafts: [{ ...d, story }] };
  // the season's arc s1w00 asks say, explore and act, as the week's interactive episodes do
  const errors = [...checkStory({ ...d, story }, w, { plugins: [lesson] }), ...checkSeries(w, { plugins: [lesson] })].filter(p => p.level === "error");
  assert.deepEqual(errors.map(p => `${p.rule}: ${p.message}`), []);
});
