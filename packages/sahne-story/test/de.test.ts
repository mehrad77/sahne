// German as a story language (src/langs/de.ts): the bakkal test scene (test/fixtures/bakkal.json) with its texts in
// German, read by the German lints (dieser/jener, es gibt, numbers, clock times), the motive words of a gesture and the
// check's dictionary forms. Every German word here is a test of a rule that wants a native speaker's check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { PLACES } from "../paths.ts";
import { deLang, langFor, LANGS, lintStory, type LineStep, type Problem, type StoryDoc } from "../src/index.ts";

const json = <T>(f: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };

/** The test scene with every `tr` text moved to `de`, then the lines the tests read written in German. */
function german(): StoryDoc {
  const s = structuredClone(json<StoryDoc>("bakkal.json")) as StoryDoc & { steps: Record<string, unknown>[] };
  const rename = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(rename);
    else if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (typeof r.tr === "string" || (r.tr && typeof r.tr === "object")) { r.de = r.tr; delete r.tr; }
      Object.values(r).forEach(rename);
    }
  };
  rename(s.steps);
  const set = (i: number, v: Record<string, unknown>) => Object.assign(s.steps[i], v);
  set(1, { de: "Nima ist im Laden." });
  set(2, { de: "Willkommen! Bitte." });
  set(3, { de: "Gibt es Brot? Gibt es Milch?", link: { brot: "obj:ekmek", milch: "obj:sut" } });
  set(4, { de: "Es gibt Brot. Dieses Brot ist frisch.", link: { brot: "obj:ekmek" } });
  set(6, { de: "Aber es gibt keine Milch.", link: { milch: "obj:sut" }, on: "keine" });
  set(9, { de: "Noch etwas?" });
  set(10, { de: "…" });
  set(11, { de: "Langsam…" });
  const ch = (s.steps[8] as { choice: { options: Record<string, unknown>[] } }).choice;
  Object.assign(ch.options[0], { de: "Zwei Brote, bitte.", link: { brote: "obj:ekmek" } });
  Object.assign(ch.options[1], { de: "Gib zwei Brote.", link: { brote: "obj:ekmek" } });
  ((ch.options[0].reply as Record<string, unknown>[])[0]).de = "Bitte schön!";
  ((ch.options[1].reply as Record<string, unknown>[])[1]).de = "…Bitte schön.";
  return s as StoryDoc;
}

const lint = (s: StoryDoc) => lintStory(s, { places, lang: deLang });
const rules = (ps: Problem[], level?: Problem["level"]) => ps.filter(p => !level || p.level === level).map(p => `${p.rule}@${p.step}${p.option !== undefined ? "." + p.option : ""}`);
const line = (s: StoryDoc, i: number) => s.steps[i] as LineStep & Record<string, unknown>;

test("German is a registered story language", () => {
  assert.equal(langFor("de"), deLang);
  assert.equal(LANGS.de, deLang);
  assert.deepEqual(deLang.words("Guten Tag, Nima's Brote!").map(w => w.w), ["guten", "tag", ",", "nima's", "brote", "."]);
  assert.ok(deLang.match("Äpfel", "Apfel") && !deLang.match("Brötchen", "Brot"));
  assert.equal(deLang.fold("Brötchen Straße"), "broetchen strasse");
});

test("lints: the German scene is clean", () => {
  assert.deepEqual(lint(german()), []);
});

test("lint deixis: dieser / jener + a linked noun needs a gesture at it, and they agree", () => {
  let s = german(); delete line(s, 4).do;
  const p = lint(s);
  assert.deepEqual(rules(p), ["deixis@4"]);
  assert.deepEqual(p[0].fix, { do: "hold_up", at: "obj:ekmek" });
  s = german(); line(s, 4).do = "hold_up";
  assert.deepEqual(lint(s), [], "dieser with hold_up");
  s = german(); line(s, 4).at = "obj:simit";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "pointing at the wrong thing");
  s = german(); line(s, 4).do = "point_far";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "dieser is not point_far");
  s = german(); line(s, 4).de = "Es gibt Brot. Jenes Brot ist frisch.";
  assert.deepEqual(rules(lint(s), "warning"), ["deixis@4"], "jener at a loaf within reach");
  s = german(); line(s, 4).de = "Es gibt Brot. Das Brot da ist frisch."; line(s, 4).do = "point";
  assert.deepEqual(lint(s), [], "a noun with da, and a point");
  s = german(); line(s, 4).de = "Es gibt Brot. Dieses frische Brot."; line(s, 4).do = "hold_up";
  assert.deepEqual(rules(lint(s)), [], "an adjective between");
  // dies as a pronoun, before no linked noun, is no demonstrative
  s = german(); line(s, 9).de = "Das ist frisch."; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), []);
});

test("lint es gibt: the prop is shown or hidden by then; questions are not assertions", () => {
  let s = german(); delete line(s, 6).obj;
  const p = lint(s);
  assert.deepEqual(rules(p), ["var_yok@6"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "sut", op: "hide" }] });
  s = german(); line(s, 9).de = "Es gibt keine Milch."; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "after the hide, keine Milch holds");
  s = german(); line(s, 9).de = "Es gibt Milch."; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = german(); line(s, 9).de = "Gibt es Milch?"; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a question");
  s = german(); line(s, 9).de = "Es gibt Milch?"; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a question by its mark");
});

test("lint es gibt: \"gibt\" alone is the verb to give, not the existential", () => {
  let s = german(); line(s, 9).de = "Nima gibt dem Kunden Milch."; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a hidden prop, and gibt means gives");
  s = german(); line(s, 9).de = "Er gibt ihr kein Brot."; line(s, 9).link = { brot: "obj:ekmek" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a shown prop, and gibt means gives");
  s = german(); line(s, 9).de = "Heute gibt es Milch."; line(s, 9).link = { milch: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"], "inverted order is still the existential");
});

test("lint time: a clock time said aloud matches the linked clock", () => {
  const clock = (time: string, text: string) => {
    const s = german();
    s.props = { uhr: { kit: "clock", at: { x: -3.5, y: 2.3, z: -2.1 }, time } } as StoryDoc["props"];
    Object.assign(line(s, 9), { de: text, link: { uhr: "obj:uhr" } }); delete line(s, 9).do;
    return s;
  };
  assert.deepEqual(lint(clock("2:30", "Die Uhr zeigt halb drei.")), [], "halb drei is 2:30");
  const p = lint(clock("3:30", "Die Uhr zeigt halb drei."));
  assert.deepEqual(rules(p), ["time@9"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "uhr", op: "set", set: { time: "2:30" } }] });
  assert.deepEqual(lint(clock("9:45", "Die Uhr zeigt Viertel vor zehn.")), []);
  assert.deepEqual(rules(lint(clock("10:00", "Die Uhr zeigt Viertel vor zehn."))), ["time@9"]);
});

test("lint number: a number before a linked prop matches n", () => {
  let s = german();
  const ch = (s.steps[8] as { choice: { options: { n?: number; reply?: LineStep[] }[] } }).choice;
  ch.options[1].n = 3;
  assert.deepEqual(rules(lint(s)), ["number@8.1"]);
  s = german(); line(s, 4).de = "Es gibt drei Brote. Dieses Brot ist frisch.";
  assert.deepEqual(lint(s), [], "three loaves are on the counter");
  s = german(); line(s, 4).de = "Es gibt zwei Brote. Dieses Brot ist frisch.";
  assert.deepEqual(rules(lint(s)), ["number@4"]);
  s = german(); line(s, 4).de = "Es gibt ein Brot. Dieses Brot ist frisch.";
  assert.deepEqual(lint(s), [], "ein is also the article");
});

test("lint budget: a gesture needs a German word to motivate it", () => {
  let s = german(); line(s, 2).de = "Guten Abend.";
  assert.deepEqual(rules(lint(s), "warning").filter(r => r.endsWith("@2")), ["budget@2"], "welcome with no welcoming word");
  s = german(); line(s, 6).de = "Aber es gibt keine Milch."; line(s, 6).do = "shake_head";
  assert.deepEqual(rules(lint(s)), []);
  s = german(); line(s, 6).do = "wave";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@6"], "no greeting in the line");
});

test("the check's words: nouns, plurals, verbs, numbers and particles resolve", () => {
  const r = deLang.resolver(["Brot", "Apfel", "Kind", "gehen", "machen", "Milch"]);
  for (const w of ["brot", "brote", "äpfel", "kinder", "geht", "gehe", "gehst", "gemacht", "macht", "milch", "zwei", "einundzwanzig", "erste", "zweiten", "und", "bitte"]) assert.ok(r(w), w);
  for (const w of ["brotkorb", "brötchen", "gegangen", "hund", "gehörig", "ma"]) assert.ok(!r(w), w);
  assert.deepEqual(deLang.checkWords("Nima's Äpfel, 2 Brote!"), ["nima", "äpfel", "brote"]);
  assert.ok(!deLang.resolver(["Brot"], { particles: false })("und"));
});
