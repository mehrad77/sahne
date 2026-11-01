// The plugin seam (src/plugin.ts): a series turns plugins on by name, and a plugin's step kind, fields, checks and lints
// join the core's only then. A made-up plugin, `sign` (a sign held up to the viewer), stands in for a real one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { PLACES } from "../paths.ts";
import { adaptStory, lintStory, missingPlugins, pluginsOf, type CharacterDoc, type StoryDoc, type StoryPlugin } from "../src/index.ts";
import { validateDoc } from "../check/schema.ts";
import { checkSeries, checkStory } from "../check/rules.ts";
import { loadWorld, type World } from "../check/world.ts";

const json = <T>(f: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };
const characters: Record<string, CharacterDoc> = Object.fromEntries(["ismail", "nima", "kerim"].map(id => [id, json<CharacterDoc>(`characters/${id}.json`)]));

const isSign = (s: object): s is { sign: { text: string } } => "sign" in s;
const SIGN: StoryPlugin = {
  id: "sign",
  steps: [{
    key: "sign",
    schema: { required: ["sign"], properties: { sign: { type: "object", required: ["text"], properties: { text: { type: "string" } }, additionalProperties: false } }, additionalProperties: false },
    is: isSign,
    adapt: (s, ctx) => { const t = (s as { sign: { text: string } }).sign.text; ctx.push({ overlay: { kind: "sign", text: ctx.p(t) } }, { step: ctx.step, kind: "spot", tr: t }); },
  }],
  schema: { story: { properties: { mood: { enum: ["calm", "busy"] } }, required: ["mood"] } },
  check: ({ story, add }) => { if (!story.steps.some(isSign)) add("sign", "error", "a story of this series holds up at least one sign"); },
  lint: story => story.steps.flatMap((s, step) => (isSign(s) && !s.sign.text.trim() ? [{ rule: "sign", level: "warning" as const, step, message: "an empty sign" }] : [])),
};

const withSign = (s: StoryDoc): StoryDoc => ({ ...structuredClone(s), mood: "calm", steps: [...s.steps.slice(0, 2), { sign: { text: "Ekmek var" } } as never, ...s.steps.slice(2)] });

test("plugins: a series turns on the plugins it names, of those the host has", () => {
  assert.deepEqual(pluginsOf({ plugins: ["sign"] }, [SIGN]).map(p => p.id), ["sign"]);
  assert.deepEqual(pluginsOf({}, [SIGN]), [], "a series that names none has none");
  assert.deepEqual(pluginsOf({ plugins: ["sign"] }, []), []);
  assert.deepEqual(missingPlugins({ plugins: ["sign", "quiz"] }, [SIGN]), ["quiz"]);
});

test("plugins: the schema takes a plugin's step and fields only while it is on", () => {
  const story = withSign(json<StoryDoc>("bakkal.json"));
  assert.ok(validateDoc("story", story).some(p => p.path === "/steps/2"), "core alone refuses the sign step");
  assert.ok(validateDoc("story", story).some(p => /mood/.test(p.message)), "core alone refuses the plugin's field");
  const on = validateDoc("story", story, [SIGN]);
  assert.ok(!on.some(p => p.path.startsWith("/steps/2") || /mood/.test(p.message)), JSON.stringify(on));
  const { mood: _m, ...noMood } = story;
  assert.ok(validateDoc("story", noMood, [SIGN]).some(p => /mood/.test(p.message)), "the plugin's required field is required");
});

test("plugins: a plugin step becomes the cues its adapt makes, and nothing without the plugin", () => {
  const story = withSign(json<StoryDoc>("bakkal.json"));
  const on = adaptStory(story, { places, characters, plugins: [SIGN] }).perform();
  const at = on.info.findIndex(i => i.step === 2);
  assert.deepEqual(on.script.cues[at], { overlay: { kind: "sign", text: "Ekmek var" } });
  const off = adaptStory(story, { places, characters }).perform();
  assert.ok(!off.info.some(i => i.step === 2));
  assert.equal(off.info.length, on.info.length - 1);
});

test("plugins: a plugin's lints run with the core's", () => {
  const story = withSign(json<StoryDoc>("bakkal.json"));
  (story.steps[2] as unknown as { sign: { text: string } }).sign.text = " ";
  assert.ok(lintStory(story, { places, characters, plugins: [SIGN] }).some(p => p.rule === "sign" && p.step === 2));
  assert.ok(!lintStory(story, { places, characters }).some(p => p.rule === "sign"));
});

test("plugins: the story check runs a plugin's checks for a series that turns it on", () => {
  const world: World = loadWorld();
  const d = world.drafts.find(x => x.id === "s1e00")!;
  const signed = { ...world, series: { ...world.series!, plugins: ["sign"] } };
  const base = checkStory(d, world).filter(p => p.level === "error").map(p => p.message);
  // the plugin is on: its check reports the story with no sign, and its required field
  const bare = checkStory(d, signed, { plugins: [SIGN] }).filter(p => p.level === "error");
  assert.ok(bare.some(p => p.rule === "sign"));
  assert.ok(bare.some(p => /mood/.test(p.message)));
  // with a sign and a mood, the story has the errors it has without the plugin, no more
  const draft = { ...d, story: withSign(d.story) };
  const errs = checkStory(draft, signed, { plugins: [SIGN] }).filter(p => p.level === "error").map(p => p.message);
  assert.deepEqual(errs.filter(m => !base.includes(m)), []);
  // a series that does not name it never runs it, even when the host has it
  assert.ok(!checkStory(d, world, { plugins: [SIGN] }).some(p => p.rule === "sign"));
  // a series that names a plugin the host lacks is an error of the series
  assert.ok(checkSeries(signed, { plugins: [] }).some(p => /plugin sign/.test(p.message)));
  assert.ok(!checkSeries(signed, { plugins: [SIGN] }).some(p => /plugin/.test(p.message)));
});
