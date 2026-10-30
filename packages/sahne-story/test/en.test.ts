// English as a story language (src/langs/en.ts, en-words.ts): its words and dictionary forms for the check, and its lints
// (deixis, there is / there isn't, numbers, clock times, the words that motivate a gesture), on the bakkal test scene
// written as a series in English: its lines are the `en` texts of test/fixtures/bakkal.json, its links English words.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { PLACES } from "../paths.ts";
import { enLang, langFor, lintStory, type LineStep, type Problem, type StoryDoc } from "../src/index.ts";

const FIXTURE = readFileSync(new URL("./fixtures/bakkal.json", import.meta.url), "utf8");
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };

/** The scene as an English series reads it: links by English word, the `on` word English. */
function story(): StoryDoc {
  const s = JSON.parse(FIXTURE.replace(/"ekmek":/g, '"bread":').replace(/"süt":/g, '"milk":').replace('"on": "yok"', '"on": "no"')) as StoryDoc;
  const options = (s.steps[8] as unknown as { choice: { options: { link: Record<string, string> }[] } }).choice.options;
  for (const o of options) o.link = { loaves: "obj:ekmek" };
  (s.steps[4] as LineStep & { en: string }).en = "There is bread. This bread is very fresh.";
  return s;
}
const lint = (s: StoryDoc) => lintStory(s, { places, lang: enLang });
const rules = (ps: Problem[], level?: Problem["level"]) => ps.filter(p => !level || p.level === level).map(p => `${p.rule}@${p.step}${p.option !== undefined ? "." + p.option : ""}`);
const line = (s: StoryDoc, i: number) => s.steps[i] as LineStep & { en: string };

test("langFor('en') is the English plugin; its words and pauses keep their offsets", () => {
  assert.equal(langFor("en"), enLang);
  assert.deepEqual(enLang.words("Isn't it, Nima's bread?").map(w => w.w), ["isn't", "it", ",", "nima's", "bread", "."]);
  assert.equal(enLang.words("Really?").at(-1)?.q, true);
  assert.equal(enLang.fold("Café"), "cafe");
  assert.ok(enLang.match("loaves", "loaf") && enLang.match("went", "go") && !enLang.match("baker", "bake"));
  assert.ok(enLang.pointing("those") && !enLang.pointing("the"));
});

test("the check's resolver: forms of a card, names, particles and numbers", () => {
  const r = enLang.resolver(["loaf", "go", "ice cream", "child", "Nima"]);
  for (const t of ["loaf", "loaves", "went", "going", "ice", "creams", "children", "nima", "the", "don", "two", "twenty", "oclock"]) {
    if (t !== "don") assert.ok(r(t), t);
  }
  assert.ok(!r("bakery") && !r("tractor"));
  assert.deepEqual(enLang.checkWords("Don't go, Nima's 2 loaves! It's £5.50 at 10:30."), ["do", "not", "go", "nima", "loaves", "it", "is"].concat(["at"]));
  assert.ok(!enLang.resolver(["loaf"], { particles: false })("the"));
});

test("lints: the bakkal scene in English is clean, with this at the loaf", () => {
  const s = story(); line(s, 4).en = "There is bread. This bread is very fresh.";
  assert.deepEqual(lint(s), []);
});

test("lint deixis: this / that + a linked noun needs a gesture at it, and they agree", () => {
  let s = story(); delete line(s, 4).do;
  const p = lint(s);
  assert.deepEqual(rules(p), ["deixis@4"]);
  assert.deepEqual(p[0].fix, { do: "hold_up", at: "obj:ekmek" });
  s = story(); line(s, 4).at = "obj:simit";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "pointing at the wrong thing");
  s = story(); line(s, 4).do = "point_far";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "this does not point far");
  s = story(); line(s, 4).en = "There is bread. That bread is very fresh.";
  assert.deepEqual(rules(lint(s), "warning"), ["deixis@4"], "that bread, 0.6 m away");
  s = story(); line(s, 4).en = "There is bread. This fresh bread is lovely.";
  assert.deepEqual(lint(s), [], "an adjective between this and the noun");
  s = story(); line(s, 4).en = "There is bread. I think that bread is fresh."; delete line(s, 4).do;
  assert.deepEqual(rules(lint(s)), [], "that joining two clauses points at nothing");
  s = story(); line(s, 4).en = "There is bread. That is fresh."; delete line(s, 4).do;
  assert.deepEqual(rules(lint(s)), [], "that as a pronoun, before no linked noun");
});

test("lint there is / there isn't: the prop is shown or hidden by then; questions are not assertions", () => {
  let s = story(); delete line(s, 6).obj;
  const p = lint(s);
  assert.deepEqual(rules(p), ["var_yok@6"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "sut", op: "hide" }] });
  s = story(); line(s, 9).en = "There isn't any milk, but there is bread."; line(s, 9).link = { milk: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "after the hide, there isn't milk holds; there is bread too");
  s = story(); line(s, 9).en = "There is milk."; line(s, 9).link = { milk: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = story(); line(s, 9).en = "There's milk."; line(s, 9).link = { milk: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = story(); line(s, 9).en = "Is there milk?"; line(s, 9).link = { milk: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a question");
  s = story(); line(s, 6).obj = [];
  line(s, 6).en = "But there is no milk."; (s.steps[3] as LineStep).obj = [{ id: "sut", op: "show" }];
  assert.deepEqual(rules(lint(s)), ["var_yok@6"], "there is no milk, but the milk is still on the shelf");
});

test("lint number: a number before a linked prop matches n", () => {
  let s = story(); line(s, 4).en = "There are three loaves. This bread is very fresh."; line(s, 4).link = { loaves: "obj:ekmek", bread: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "three loaves are on the counter");
  s = story(); line(s, 4).en = "There are two loaves. This bread is very fresh."; line(s, 4).link = { loaves: "obj:ekmek", bread: "obj:ekmek" };
  assert.deepEqual(rules(lint(s)), ["number@4"]);
  s = story(); line(s, 4).en = "There is one loaf. This bread is very fresh."; line(s, 4).link = { loaf: "obj:ekmek", bread: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "one is also the article");
  s = story(); const ch = (s.steps[8] as unknown as { choice: { options: { n?: number }[] } }).choice;
  ch.options[1].n = 3;
  assert.deepEqual(rules(lint(s)), ["number@8.1"], "give three loaves, n 3, but the text says two");
});

test("lint time: a clock time said aloud matches the linked clock; a price is no time", () => {
  const s = story();
  s.props = { clock: { kit: "clock", at: { x: -3.5, y: 2.3, z: -2.1 }, time: "10:10" } } as StoryDoc["props"];
  line(s, 9).en = "It's half past ten!"; delete line(s, 9).do;
  assert.deepEqual(lint(s), [], "not linked to the clock");
  line(s, 9).link = { ten: "obj:clock" };
  const p = lint(s);
  assert.deepEqual(rules(p), ["time@9"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "clock", op: "set", set: { time: "10:30" } }] });
  line(s, 9).obj = [{ id: "clock", op: "set", set: { time: "10:30" } }];
  assert.deepEqual(lint(s), [], "the hands move to the time said");
  line(s, 9).en = "It costs £5.50, ten pounds for two.";
  assert.deepEqual(rules(lint(s)), [], "a price is no time");
});

test("lint budget: a gesture needs an English word to motivate it", () => {
  let s = story(); line(s, 9).do = "shrug";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "a shrug at Anything else?");
  s = story(); line(s, 9).do = "shrug"; line(s, 9).en = "I don't know, sorry.";
  assert.deepEqual(rules(lint(s)), []);
  s = story(); line(s, 9).do = "wave"; line(s, 9).en = "Hello again!";
  assert.deepEqual(rules(lint(s)), []);
  s = story(); line(s, 9).do = "wave"; line(s, 9).en = "This history is long.";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "hi$ is a whole word: history does not wave");
  s = story(); line(s, 9).do = "wave"; line(s, 9).en = "Hi, how are you?";
  assert.deepEqual(rules(lint(s)), []);
});
