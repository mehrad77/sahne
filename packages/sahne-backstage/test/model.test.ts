// The editor's pure model (src/model/): paths into a document, the cue each path plays at, undo and redo, the step list's
// rows, which edits only change words, and the flags a story's callbacks read. On the sample story, played through the
// story adapter as the editor plays it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHARACTERS, PLACES, storyFile } from "../../sahne-story/paths.ts";
import { adaptStory, type CharacterDoc, type StoryDoc } from "../../sahne-story/src/index.ts";
import { cueOf, cuePath, get, insert, move, same, set, within } from "../src/model/path.ts";
import * as H from "../src/model/history.ts";
import { flagsIn, kindOf, rows, wordsOnly } from "../src/model/steps.ts";

const json = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
const STORY: StoryDoc = json(storyFile("s1e00"));
const characters: Record<string, CharacterDoc> = Object.fromEntries(["kerim", "nima", "ismail"].map(id => [id, json(new URL(`${id}.json`, CHARACTERS))]));
const places = Object.fromEntries(["bakkal", "metro_m11"].map(id => [id, json(new URL(`${id}.json`, PLACES))]));

test("set writes one place, keeps the rest and the keys' order", () => {
  const doc = { a: 1, steps: [{ who: "x", tr: "a", en: "b" }, { beat: {} }], z: 2 };
  const out = set(doc, ["steps", 0, "tr"], "yeni");
  assert.equal(get(out, ["steps", 0, "tr"]), "yeni");
  assert.equal(out.steps[1], doc.steps[1], "untouched branches are the same objects");
  assert.deepEqual(Object.keys(out.steps[0]), ["who", "tr", "en"]);
  assert.deepEqual(Object.keys(set(doc, ["steps"], []) as object), ["a", "steps", "z"]);
  assert.deepEqual(Object.keys(set(doc, ["a"], undefined) as object), ["steps", "z"], "undefined removes a key");
  assert.deepEqual(set(doc, ["steps", 0], undefined).steps.length, 1, "undefined removes an item");
  assert.deepEqual(set({}, ["obj", 0, "id"], "k"), { obj: [{ id: "k" }] });
});

test("insert and move in an array", () => {
  const doc = { steps: ["a", "b", "c"] };
  assert.deepEqual(insert(doc, ["steps"], 1, "x").steps, ["a", "x", "b", "c"]);
  assert.deepEqual(insert(doc, ["steps"], 9, "x").steps, ["a", "b", "c", "x"]);
  assert.deepEqual(move(doc, ["steps"], 0, 2).steps, ["b", "c", "a"]);
  assert.equal(move(doc, ["steps"], 0, 5), doc);
});

test("every cue maps back to its place in the story, and every row's path to a cue", () => {
  const perf = adaptStory(STORY, { places, characters }).perform();
  for (const i of perf.info) {
    const v = get(STORY, cuePath(i));
    assert.ok(v && typeof v === "object", `cue of step ${i.step} (${i.kind}) has a place in the story`);
    if (i.kind === "line" || i.kind === "reply") assert.equal((v as { tr?: string }).tr, i.tr);
  }
  for (const r of rows(STORY)) {
    const k = cueOf(perf.info, r.path);
    // a row of the option not picked has no cue in this performance
    if (r.kind === "option" || r.kind === "reply") continue;
    if (r.gate?.startsWith("if")) continue;
    assert.ok(k >= 0, `row ${r.n} plays at a cue`);
    assert.ok(within(cuePath(perf.info[k]), r.path) || within(r.path, cuePath(perf.info[k])));
  }
  assert.ok(same(["steps", 1], ["steps", 1]) && !same(["steps", 1], ["steps", 2]));
});

test("undo, redo, revert; typing into one field is one step", () => {
  let d = H.open({ t: "a" }, 5);
  d = H.edit(d, { t: "ab" }, "t", 1000);
  d = H.edit(d, { t: "abc" }, "t", 1500);
  assert.equal(d.past.length, 1, "two keystrokes, one step");
  d = H.edit(d, { t: "abcd" }, "t", 4000);
  assert.equal(d.past.length, 2, "a pause starts a new step");
  assert.ok(H.dirty(d));
  d = H.undo(d); assert.deepEqual(d.doc, { t: "abc" });
  d = H.redo(d); assert.deepEqual(d.doc, { t: "abcd" });
  d = H.revert(d); assert.deepEqual(d.doc, { t: "a" }); assert.ok(!H.dirty(d));
  d = H.undo(d); assert.deepEqual(d.doc, { t: "abcd" }, "a revert is undone like any edit");
  d = H.saved(d, 9); assert.ok(!H.dirty(d)); assert.equal(d.mtime, 9);
  assert.equal(H.edit(d, { t: "abcd" }), d, "no change, no step");
});

test("the step list: every step, a choice's options and their replies", () => {
  const rs = rows(STORY);
  assert.equal(rs.filter(r => r.depth === 0).length, STORY.steps.length);
  const choice = STORY.steps.findIndex(s => kindOf(s) === "choice");
  assert.ok(choice >= 0);
  const opts = rs.filter(r => r.kind === "option");
  assert.ok(opts.length >= 2 && opts.every(r => r.path[1] === choice));
  for (const r of rs) assert.ok(get(STORY, r.path) !== undefined, `row ${r.n}`);
});

test("only words, or what the stage draws", () => {
  const words = set(STORY, ["steps", 1, "tr"], "Başka.");
  assert.ok(wordsOnly(STORY, words));
  assert.ok(wordsOnly(STORY, set(STORY, ["quiz", 0, "why"], "x")));
  assert.ok(!wordsOnly(STORY, set(STORY, ["steps", 1, "emo"], "sad")));
  assert.ok(!wordsOnly(STORY, set(STORY, ["steps", 1, "who"], "nima")));
  assert.ok(wordsOnly(STORY, set(STORY, ["steps", 1, "de"], "Hallo"), ["de", "en"]), "a series' own language is words");
  assert.ok(!wordsOnly(STORY, set(STORY, ["steps", 1, "de"], "Hallo")), "and is staging where the series has no such language");
});

test("the flags a story's callbacks read", () => {
  const s = set(set(STORY, ["steps", 2, "if"], "s1e00_a"), ["steps", 3, "unless"], "s1e00_b");
  assert.deepEqual(flagsIn(s), ["s1e00_a", "s1e00_b"]);
  assert.deepEqual(flagsIn({ steps: [] }), []);
});

test("what changed since a version: the rows, the fields, a word diff", async () => {
  const { changes, diffWords } = await import("../src/model/diff.ts");
  assert.deepEqual(diffWords("Bir portakal lütfen", "İki portakal lütfen"), [{ op: "-", text: "Bir" }, { op: "+", text: "İki" }, { op: "=", text: " portakal lütfen" }]);
  assert.deepEqual(diffWords("a", "a"), [{ op: "=", text: "a" }]);
  const now = set(set(STORY, ["steps", 1, "tr"], "Yeni."), ["title", "en"], "New");
  const c = changes(STORY, now);
  assert.deepEqual(c.fields, ["title"]);
  assert.deepEqual(c.rows.map(r => r.row.path), [["steps", 1]]);
  assert.equal(changes(null, STORY).added, STORY.steps.length);
});

test("search: every word of the query in a label or its keywords, accents ignored, the closest first", async () => {
  const { search } = await import("../src/model/search.ts");
  const items = [{ label: "s1e00 · Portakal var mı?", keywords: "bakkal ismail" }, { label: "İsmail", keywords: "ismail grocer" }, { label: "Bakkal", keywords: "bakkal" }];
  assert.deepEqual(search(items, "ismail").map(i => i.label), ["İsmail", "s1e00 · Portakal var mı?"]);
  assert.deepEqual(search(items, "bak var").map(i => i.label), ["s1e00 · Portakal var mı?"]);
  assert.equal(search(items, "").length, 3);
  assert.deepEqual(search(items, "zzz"), []);
});

test("board: weeks from the launch, Monday to Saturday, a Saturday a special, a row's week its episodes'", async () => {
  const { boardOf, rowOn, mondayOf, datesOf } = await import("../src/model/board.ts");
  const season = { v: 1 as const, id: "s1", n: 1, title: { tr: "t" }, launch: "2026-10-28", calendar: { s1e01: { date: "2026-10-28", kind: "episode" as const, week: 1 }, s1e02: { date: "2026-11-09", kind: "episode" as const, week: 2 } } };
  assert.equal(mondayOf("2026-10-28"), "2026-10-26");
  const dates = datesOf(season, [{ id: "s1e01" }, { id: "s1e02" }, { id: "s1e03", releaseDate: "2026-11-14" }]);
  assert.deepEqual(dates, { s1e01: "2026-10-28", s1e02: "2026-11-09", s1e03: "2026-11-14" });
  const weeks = boardOf(season, dates);
  assert.equal(weeks.length, 4, "three weeks, then one to plan into");
  assert.deepEqual(weeks.map(w => w.week), [1, null, 2, 3], "an empty week between week 1 and week 2 is a break; the one after the last is the next");
  assert.equal(weeks[0].days.find(d => d.date === "2026-10-28")?.episode, "s1e01");
  assert.equal(weeks[0].days[5].kind, "special");
  assert.deepEqual(rowOn(weeks, "2026-11-14"), { date: "2026-11-14", kind: "special", week: 2 });
  assert.deepEqual(rowOn(weeks, "2026-11-10"), { date: "2026-11-10", kind: "episode", week: 2 });
  // episodes released before the launch: the board starts with the first of them
  assert.equal(boardOf({ ...season, launch: "2026-12-01" }, dates)[0].monday, "2026-10-26");
});

test("a new episode: a skeleton in the series' languages, or a copy of another with its texts cleared", async () => {
  const { skeleton, duplicate } = await import("../src/model/skeleton.ts");
  const brief = { id: "s1e05", season: 1, releaseDate: "2026-09-16", kind: "episode" as const, week: 1, arc: { id: "s1w01", tr: "a", en: "b", fa: "c", mechanics: ["say" as const] }, place: "bakkal", cast: ["ismail"], words: [], lessons: ["g_a1_1_x"], title: { tr: "Yeni" } };
  const de = skeleton({ ...brief, title: { de: "Yeni" } }, { narrator: "kerim", standin: "nima", places, languages: { main: "de", translations: ["en"] } });
  assert.deepEqual(de.title, { de: "Yeni", en: "Yeni" }, "the main title stands in for a missing translation");
  assert.deepEqual(de.steps[2], { who: "ismail", de: "…", en: "…" }, "a placeholder in each language");
  const copy = duplicate(STORY, brief);
  assert.equal(copy.id, "s1e05");
  assert.equal(copy.steps.length, STORY.steps.length, "the structure is kept");
  const line = copy.steps.find(s => "who" in s) as unknown as Record<string, unknown>;
  assert.equal(line.tr, "…");
  assert.ok(!JSON.stringify(copy.steps).includes("Portakal"), "no text of the old episode is left");
  assert.equal(copy.draft, true);
});

test("script: blocks, the next speaker, add, move, duplicate, delete and convert", async () => {
  const S = await import("../src/model/script.ts");
  const langs = { main: "tr", translations: ["en", "fa"] };
  const bs = S.blocks(STORY);
  assert.ok(bs.some(b => b.kind === "option" && b.depth === 1));
  assert.equal(bs.length, rows(STORY).length, "a block for every row of the step list");
  const story = { ...STORY, cast: ["nima", "ismail"], steps: [{ scene: "bakkal", at: {} }, { who: "ismail", tr: "a" }, { who: "nima", tr: "b" }] } as unknown as StoryDoc;
  assert.equal(S.nextSpeaker(story, ["steps", 2], { standin: "nima", narrator: "kerim" }), "ismail", "the one before last speaks next");
  assert.equal(S.nextSpeaker(story, ["steps", 1], { standin: "nima", narrator: "kerim" }), "nima", "after one speaker, someone else of the cast");
  const added = S.addAfter(story, ["steps", 1], S.emptyLine("nima", langs));
  assert.deepEqual(added.focus, ["steps", 2]);
  assert.deepEqual((added.story.steps[2] as unknown as Record<string, unknown>), { who: "nima", tr: "", en: "", fa: "" });
  const moved = S.moveBy(story, ["steps", 2], -1);
  assert.equal((moved.story.steps[1] as { who: string }).who, "nima");
  assert.equal(S.duplicateAt(story, ["steps", 1]).story.steps.length, 4);
  const gone = S.remove(story, ["steps", 2]);
  assert.equal(gone.story.steps.length, 2);
  assert.deepEqual(gone.focus, ["steps", 1]);
  const beat = S.convert({ ...story, steps: [{ who: "nima", tr: "x", do: "wave" }] } as unknown as StoryDoc, ["steps", 0], "action", langs);
  assert.deepEqual(beat.steps[0], { beat: { who: "nima", do: "wave" } });
  assert.deepEqual(S.convert(beat, ["steps", 0], "line", langs).steps[0], { who: "nima", tr: "", en: "", fa: "", do: "wave" });
});

test("parenthetical: gestures, feelings, who it is said to, where it points, walks, voice and shot", async () => {
  const { parseParenthetical, chipsOf } = await import("../src/model/parenthetical.ts");
  const v = { gestures: ["wave", "point", "shrug", "nod"], emotions: ["happy", "annoyed"], cast: [{ id: "ismail", names: ["İsmail"] }], marks: ["counter", "door"], props: [{ id: "apple", names: ["elma"] }] };
  assert.deepEqual(parseParenthetical("(waves, happy, to İsmail)", v).staging, { do: "wave", emo: "happy", to: "ismail" });
  assert.deepEqual(parseParenthetical("points at the apple", v).staging, { do: "point", at: "obj:apple" });
  assert.deepEqual(parseParenthetical("walks to counter, whispers, close", v, "nima").staging, { move: { who: "nima", to: "counter" }, voice: "whisper", cam: "close" });
  assert.deepEqual(parseParenthetical("angry, juggles", v), { staging: { emo: "annoyed" }, rest: ["juggles"] });
  assert.deepEqual(chipsOf({ do: "wave", to: "ismail", at: "obj:apple" }, id => (id === "ismail" ? "İsmail" : id)).map(c => c.label), ["wave", "→ İsmail", "at apple"]);
});

test("autostage: the director's choices as ghosts, the rules' as suggestions", async () => {
  const { ghostsOf, suggestionsOf, taken } = await import("../src/model/autostage.ts");
  const { trLang } = await import("../../sahne-story/src/index.ts");
  const info = [{ step: 0, kind: "scene" }, { step: 1, kind: "line", who: "ismail" }] as never;
  const perfs = [{ after: { shot: { kind: "wide", ids: [] } } }, { after: { last: { who: "ismail", to: "nima" }, shot: { kind: "two", ids: ["ismail", "nima"] } } }];
  assert.deepEqual(ghostsOf(info, perfs), { "steps/1": { to: "nima", cam: "two", camIds: ["ismail", "nima"] } });
  const story = { ...STORY, steps: [{ scene: "bakkal", at: {} }, { who: "ismail", tr: "Merhaba!" }, { who: "nima", tr: "Ekmek var mı?" }, { who: "nima", tr: "Evet.", do: "nod" }] } as unknown as StoryDoc;
  const s = suggestionsOf(story, { lang: trLang, lints: [], gestures: ["wave", "nod"], emotions: ["curious", "surprised"], narrator: "kerim", standin: "nima" });
  assert.deepEqual(s["steps/1"].map(x => x.fix), [{ do: "wave" }, { emo: "surprised" }], "merhaba motivates a wave; ! a surprise");
  assert.deepEqual(s["steps/2"].map(x => x.fix), [{ emo: "curious" }], "a question");
  assert.equal(s["steps/3"], undefined, "a gesture already written is not suggested again");
  assert.deepEqual(taken({ link: { a: "obj:a" }, do: "nod" }, { link: { b: "obj:b" }, do: "wave" }), { link: { a: "obj:a", b: "obj:b" }, do: "wave" });
});

test("autostage: English motives (whole words, phrases at the end of a line)", async () => {
  const { suggestionsOf } = await import("../src/model/autostage.ts");
  const { enLang } = await import("../../sahne-story/src/index.ts");
  const story = { ...STORY, steps: [{ scene: "bakkal", at: {} }, { who: "ismail", en: "Hi there." }, { who: "nima", en: "I don't know." }, { who: "ismail", en: "This history is long." }] } as unknown as StoryDoc;
  const s = suggestionsOf(story, { lang: enLang, lints: [], gestures: ["wave", "shrug", "nod"], emotions: [], narrator: "kerim", standin: "nima" });
  assert.deepEqual(s["steps/1"].map(x => x.fix), [{ do: "wave" }], "hi$ is a whole word");
  assert.ok(!s["steps/1"][0].why.includes("$"), s["steps/1"][0].why);
  assert.deepEqual(s["steps/2"].map(x => x.fix), [{ do: "shrug" }], "a phrase that ends the line");
  assert.equal(s["steps/3"], undefined, "history does not wave");
});

test("notes: problems in plain words, with a fix where one is obvious", async () => {
  const { notesOf } = await import("../src/model/notes.ts");
  const c = { name: (id: string) => (id === "ismail" ? "İsmail" : id), langName: (l: string) => (l === "fa" ? "Persian" : l), standin: "nima" };
  const story = { ...STORY, cast: ["nima"], steps: [{ who: "ismail", tr: "a" }] } as unknown as StoryDoc;
  const ns = notesOf([
    { rule: "lint", level: "warning", message: "x", step: 0 },
    { rule: "cast", level: "error", message: "ismail speaks but is not in cast", step: 0, new: true },
    { rule: "schema", level: "error", message: "/steps/0: the line has no fa text" },
    { rule: "suggest", level: "info", message: "link a" },
  ], c);
  assert.deepEqual(ns.map(n => n.text), ["İsmail speaks but isn't in the cast.", "The line has no Persian yet.", "X."], "the new first; suggestions are chips, not notes");
  assert.deepEqual(ns[1].path, ["steps", 0]);
  assert.deepEqual(ns[0].fix!.apply(story).cast, ["nima", "ismail"]);
  const [deixis] = notesOf([{ rule: "deixis", level: "error", message: "\"bu elma\" needs a deixis gesture at obj:elma (hold_up)", step: 0, fix: { do: "hold_up", at: "obj:elma" } }], c);
  assert.deepEqual(deixis.fix!.apply(story).steps[0], { who: "ismail", tr: "a", do: "hold_up", at: "obj:elma" });
});

test("abilities: by mode, and the page's own first", async () => {
  const { abilities } = await import("../src/model/abilities.ts");
  const ro = abilities({ writable: false, agentEdits: "proposals" });
  assert.match(ro.cannot[0], /read-only/);
  assert.ok(!ro.can.some(x => /^Edit an episode/.test(x)));
  const place = abilities({ writable: true, agentEdits: "proposals", page: "place" });
  assert.match(place.can[0], /this place/);
  assert.ok(place.cannot.some(x => /^Change this place/.test(x)));
  assert.ok(!place.cannot.some(x => /^Change places, characters/.test(x)));
  const direct = abilities({ writable: true, agentEdits: "direct", page: "episode" });
  assert.ok(direct.can.some(x => /^Set where an episode stands/.test(x)));
  assert.ok(!direct.cannot.some(x => /^Save anything/.test(x)));
});
