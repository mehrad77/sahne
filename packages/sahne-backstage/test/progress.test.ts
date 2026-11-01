// Where an episode stands in the work (src/model/progress.ts): each stage's state and the one next step, on the sample
// episode, a blank one and a half-staged one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { storyFile } from "../../sahne-story/paths.ts";
import type { StoryDoc } from "../../sahne-story/src/index.ts";
import { episodeSig, nextStepOf, progressOf, type ProgressInput } from "../src/model/progress.ts";
import { rowKey } from "../src/model/review.ts";
import { blocks } from "../src/model/script.ts";
import { get, set } from "../src/model/path.ts";
import { sigAt } from "../src/model/review.ts";

const S1 = (): StoryDoc => JSON.parse(readFileSync(storyFile("s1e00"), "utf8"));
const langs = { main: "tr", translations: ["en", "fa"] };
const input = (story: StoryDoc, o: Partial<ProgressInput> = {}): ProgressInput => ({ story, langs, errors: 0, suggestions: {}, ...o });
const stage = (p: ReturnType<typeof progressOf>, k: string) => p.stages.find(x => x.key === k)!;
/** Every translation of every line checked, as a translator would. */
const allChecked = (story: StoryDoc) => ({ steps: Object.fromEntries(blocks(story).map(b => [rowKey(b.path), { checked: ["en", "fa"], sig: sigAt(story, b.path) }])) });

test("progress: the sample has its brief and script; its translations are not checked yet", () => {
  const p = progressOf(input(S1()));
  assert.deepEqual(p.stages.map(x => x.key), ["brief", "script", "translate", "review"]);
  assert.equal(stage(p, "brief").done, true);
  assert.equal(stage(p, "script").done, true, stage(p, "script").state);
  assert.equal(stage(p, "translate").done, false);
  assert.match(stage(p, "translate").state, /^EN 0\/\d+ · FA 0\/\d+$/);
  assert.equal(p.next, "translate");
  assert.deepEqual(nextStepOf(p, "translate", { lang: "fa" }).act, { label: "Go to the first", action: "first-untranslated" });
});

test("progress: a blank episode wants a brief, and its next step is the assistant's draft", () => {
  const blank = { ...S1(), summary: {}, steps: [] } as unknown as StoryDoc;
  const p = progressOf(input(blank));
  assert.equal(stage(p, "brief").done, false);
  assert.equal(stage(p, "script").state, "Empty");
  assert.equal(p.next, "brief");
  assert.equal(nextStepOf(p, "brief").act?.action, "draft");
  assert.equal(nextStepOf(p, "script").act?.action, "draft");
  // while a task writes it
  const live = progressOf(input(blank, { drafting: { step: 3, total: 15 } }));
  assert.equal(stage(live, "script").state, "Writing… 3/15");
  assert.equal(nextStepOf(live, "script", { drafting: true }).act, undefined);
});

test("progress: a half-staged episode names its unstaged lines and the suggestions", () => {
  const s = S1();
  const at = blocks(s).find(b => b.kind === "line" && b.who === "nima")!.path;
  const bare = Object.fromEntries(Object.entries(get(s, at) as Record<string, unknown>).filter(([k]) => ["who", "tr", "en", "fa"].includes(k)));
  const half = set(s, at, bare);
  const p = progressOf(input(half, { suggestions: { [at.join("/")]: [{}, {}] } }));
  assert.deepEqual(p.unstaged, [at]);
  assert.equal(stage(p, "script").done, false);
  assert.match(stage(p, "script").state, /1 without directions/);
  assert.equal(p.next, "script");
  const n = nextStepOf(p, "script");
  assert.match(n.what, /^1 line has no stage directions, and 2 suggestions wait\.$/);
  assert.deepEqual(n.alt, { label: "Add all 2", action: "add-all" });
  // the narrator speaking to the viewer needs no direction
  const narr = blocks(s).find(b => b.kind === "line" && b.who === "kerim")!.path;
  assert.ok(!progressOf(input(s)).unstaged.some(x => x.join("/") === narr.join("/")));
});

test("progress: a checked translation counts until its line changes", () => {
  const s = S1();
  const review = allChecked(s);
  const p = progressOf(input(s, { review }));
  assert.equal(stage(p, "translate").done, true);
  const line = blocks(s).find(b => b.kind === "line" && b.who === "ismail")!.path;
  const edited = set(s, [...line, "fa"], "چیز دیگری");
  const q = progressOf(input(edited, { review }));
  assert.equal(stage(q, "translate").done, false);
  assert.equal(q.langs.find(l => l.lang === "fa")!.done, q.langs.find(l => l.lang === "fa")!.total - 1);
  // a language the series just added starts empty
  const de = progressOf(input(s, { review, langs: { main: "tr", translations: ["en", "fa", "de"] } }));
  assert.equal(de.langs.find(l => l.lang === "de")!.empty, true);
  assert.match(nextStepOf(de, "translate", { lang: "de" }).what, /^No German yet: \d+ lines to translate\.$/);
});

test("progress: a plugin's stage goes before Review, and approval holds until the episode changes", () => {
  const s = S1();
  const review = { ...allChecked(s), status: "approved" as const, sig: episodeSig(s) };
  const p = progressOf(input(s, { review, stages: [{ key: "lesson", name: "Lesson", done: true, state: "All checks pass" }] }));
  assert.deepEqual(p.stages.map(x => x.key), ["brief", "script", "translate", "lesson", "review"]);
  assert.equal(p.approved, true);
  assert.equal(p.next, null);
  const changed = progressOf(input(set(s, ["title", "tr"], "Başka"), { review }));
  assert.equal(changed.approved, false);
  assert.equal(changed.changedSinceApproved, true);
  assert.equal(stage(changed, "review").state, "Changed since approved");
});

test("progress: Review lists what is not ready, and comments keep it open", () => {
  const s = S1();
  const p = progressOf(input(s, { review: { comments: [{ id: "c1", by: "Deniz", text: "x", date: "2026-11-01" }] } }));
  const n = nextStepOf(p, "review");
  assert.match(n.what, /Not ready: translate, 1 open comment/);
  assert.equal(n.act?.action, "watch");
});

test("directions: a step's staging in plain words", async () => {
  const { directionsOf, verb } = await import("../src/model/directions.ts");
  const name = (id: string) => ({ ismail: "İsmail", nima: "Nima" })[id] ?? id;
  assert.deepEqual(["nod", "look_around", "hand_over", "wish", "cry"].map(verb), ["nods", "looks around", "hands over", "wishes", "cries"]);
  assert.deepEqual(directionsOf({ do: "nod", emo: "happy", at: "obj:portakal", to: "ismail", cam: "two" }, name).map(d => d.label),
    ["nods", "happy", "looks at the portakal", "says it to İsmail", "camera: two people"]);
  assert.deepEqual(directionsOf({ to: "viewer", move: { who: "ismail", to: "counter", how: "enter" } } as never, name).map(d => d.label), ["says it to us", "İsmail comes in, to counter"]);
  assert.deepEqual(directionsOf({ link: { portakal: "obj:portakal" }, voice: "whisper" } as never, name).map(d => [d.key, d.label]), [["link", "times “portakal” to the portakal"], ["voice", "whispers"]]);
});
