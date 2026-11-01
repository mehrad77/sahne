// The lesson plugin on the samples: it adds its step, fields and checks to a series that turns it on, and a story with
// none of them passes the core check in a series that does not.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { adaptStory, type CharacterDoc, type StoryDoc } from "sahne-story";
import { PLACES } from "../../sahne-story/paths.ts";
import { validateDoc } from "../../sahne-story/check/schema.ts";
import { checkSeason, checkStory } from "../../sahne-story/check/rules.ts";
import { loadWorld, type Draft, type World } from "../../sahne-story/check/world.ts";
import { isSpot, lesson, lessonOf, type LessonStory } from "../src/index.ts";

const world: World = loadWorld();
const d0 = world.drafts.find(x => x.id === "s1e00")!;
const draft = (edit: (s: LessonStory) => void): Draft => { const story = structuredClone(d0.story) as LessonStory; edit(story); return { ...d0, story }; };
const errors = (d: Draft, w: World = world, plugins = [lesson]) => checkStory(d, w, { plugins }).filter(p => p.level === "error");
const rules = (d: Draft) => errors(d).map(p => `${p.rule}: ${p.message}`);

test("lesson: the samples turn the plugin on, and s1e00 has no errors with it", () => {
  assert.deepEqual(world.series?.plugins, ["lesson"]);
  assert.deepEqual(rules(d0), []);
});

test("lesson: without the plugin, its step and fields are the core's errors", () => {
  const off = errors(d0, world, []);
  assert.ok(off.some(p => p.rule === "schema" && /spot/.test(p.message)), "the spot step");
  assert.ok(off.some(p => p.rule === "schema" && /quiz|words|lessons/.test(p.message)), "the lesson fields");
});

test("lesson: a story with none of its parts passes the core check in a series without it", () => {
  const plain = draft(s => {
    for (const k of ["level", "ref", "lessons", "words", "gl", "quiz"] as const) delete s[k];
    s.steps = s.steps.filter(st => !isSpot(st));
    for (const st of s.steps) { delete (st as { note?: unknown }).note; delete (st as { mistake?: unknown }).mistake; }
  });
  const bare: World = { ...world, series: { ...world.series!, plugins: [] } };
  assert.deepEqual(errors(plain, bare, [lesson]).map(p => `${p.rule}: ${p.message}`), []);
  // the same story in the lesson series misses what the plugin requires
  assert.ok(errors(plain).some(p => /quiz/.test(p.message)));
});

test("lesson: the schema's lesson fields and step", () => {
  const s = structuredClone(d0.story) as LessonStory;
  assert.deepEqual(validateDoc("story", s, [lesson]), []);
  const noQuiz = structuredClone(s); delete noQuiz.quiz;
  assert.match(validateDoc("story", noQuiz, [lesson])[0].message, /quiz/);
  const badA = structuredClone(s); badA.quiz![0].a = 3 as 0;
  assert.ok(validateDoc("story", badA, [lesson]).some(p => p.path === "/quiz/0/a"));
  const meaning = structuredClone(s) as StoryDoc;
  const ch = meaning.steps.find(st => "choice" in st) as { choice: { kind?: string } };
  ch.choice.kind = "meaning";
  assert.deepEqual(validateDoc("story", meaning, [lesson]), [], "a meaning choice is the plugin's");
  assert.ok(validateDoc("story", meaning).some(p => /choice\/kind/.test(p.path)), "the core has polite and action only");
});

test("lesson: each rule finds its break", () => {
  const has = (d: Draft, rule: string, re: RegExp) => assert.ok(rules(d).some(r => r.startsWith(`${rule}:`) && re.test(r)), `${rule} ${re}: ${rules(d).join(" | ")}`);
  has(draft(s => { s.words = s.words!.slice(0, 4); }), "schema", /words/);
  has(draft(s => { s.quiz![0].why = "“Bu satır yok.”"; }), "quiz", /not a line/);
  has(draft(s => { s.quiz = s.quiz!.map(q => ({ ...q, kind: "comp" })); }), "quiz", /comp and one word/);
  has(draft(s => { const sp = s.steps.find(isSpot)!; sp.spot.ex = "Hiç yok bu."; }), "ref", /spot example/);
  has(draft(s => { const sp = s.steps.find(isSpot)!; sp.spot.lesson = "g_a1_9_other"; }), "ref", /not in the story's lessons/);
  has(draft(s => { s.steps = s.steps.filter(st => !isSpot(st)); }), "counts", /0 grammar spots/);
  has(draft(s => { const g = Object.values(s.gl!)[0]; delete g.fa; }), "schema", /gloss of .* has no fa text/);
  has(draft(s => { const l = s.steps.find(st => "who" in st && st.who === "ismail") as { mistake?: { fix: string } }; l.mistake = { fix: "hiçbir yerde" }; }), "mistake", /next 3 lines/);
});

test("lesson: a spot becomes Kerim's overlay, and a line's note reaches its cue", () => {
  const places: Record<string, PlaceDoc> = Object.fromEntries(["bakkal", "metro_m11"].map(id => [id, JSON.parse(readFileSync(new URL(`${id}.json`, PLACES), "utf8"))]));
  const characters = d0.characters as Record<string, CharacterDoc>;
  const story = structuredClone(d0.story) as LessonStory;
  const at = story.steps.findIndex(isSpot);
  const line = story.steps.findIndex(st => "who" in st);
  (story.steps[line] as { note?: Record<string, string> }).note = { en: "A note." };
  const on = adaptStory(story, { places, characters, plugins: [lesson] }).perform();
  const i = on.info.findIndex(x => x.step === at);
  assert.equal(on.info[i].kind, "spot");
  assert.equal((on.script.cues[i] as { overlay: { who: string } }).overlay.who, "kerim");
  assert.deepEqual(on.info.find(x => x.step === line)?.note, { en: "A note." });
  const off = adaptStory(story, { places, characters }).perform();
  assert.ok(!off.info.some(x => x.step === at), "the core skips a step it does not know");
  assert.equal(off.info.find(x => x.step === line)?.note, undefined);
});

test("lesson: the season's recycling report runs only with the plugin", () => {
  const w: World = { ...world, days: { s1e00: { id: "s1e00", date: d0.story.releaseDate!, week: 1, kind: "episode" } } };
  const second = draft(s => { s.id = "s1e01"; s.releaseDate = "2099-01-01"; });
  const later = { ...second, id: "s1e01", story: { ...second.story, releaseDate: addDay(d0.story.releaseDate!) } };
  const on = checkSeason(w, [d0, later], { plugins: [lesson] }).filter(p => p.rule === "recycle");
  assert.ok(on.length, "recycling reports");
  assert.deepEqual(checkSeason(w, [d0, later]).filter(p => p.rule === "recycle"), []);
  assert.ok(lessonOf(d0.story).words!.length >= 5);
});

function addDay(date: string) { return new Date(Date.parse(`${date}T12:00:00Z`) + 864e5).toISOString().slice(0, 10); }
