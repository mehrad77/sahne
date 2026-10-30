// Persian as a story language (src/langs/fa.ts, fa-words.ts): its words and dictionary forms for the check, and its lints
// (deixis, هست / نیست, numbers, clock times, the words that motivate a gesture), on the bakkal test scene written as a
// series in Persian: its lines are the `fa` texts of test/fixtures/bakkal.json, its links Persian words.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { lowerFa } from "sahne-fa";
import { PLACES } from "../paths.ts";
import { faLang, langFor, lintStory, type LineStep, type Problem, type StoryDoc } from "../src/index.ts";

const FIXTURE = readFileSync(new URL("./fixtures/bakkal.json", import.meta.url), "utf8");
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };

/** The scene as a Persian series reads it: links by Persian word, the `on` word Persian. */
function story(): StoryDoc {
  const s = JSON.parse(FIXTURE.replace(/"ekmek":/g, '"نان":').replace(/"süt":/g, '"شیر":').replace('"on": "yok"', '"on": "نیست"')) as StoryDoc;
  const options = (s.steps[8] as unknown as { choice: { options: { link: Record<string, string> }[] } }).choice.options;
  for (const o of options) o.link = { نان: "obj:ekmek" };
  (s.steps[4] as LineStep & { fa: string }).fa = "نان هست. این نان خیلی تازه است.";
  return s;
}
const lint = (s: StoryDoc) => lintStory(s, { places, lang: faLang });
const rules = (ps: Problem[], level?: Problem["level"]) => ps.filter(p => !level || p.level === level).map(p => `${p.rule}@${p.step}${p.option !== undefined ? "." + p.option : ""}`);
const line = (s: StoryDoc, i: number) => s.steps[i] as LineStep & { fa: string };

test("langFor('fa') is the Persian plugin; its words and pauses keep their offsets", () => {
  assert.equal(langFor("fa"), faLang);
  assert.deepEqual(faLang.words("نیما، نان‌های «علی» را دید؟").map(w => w.w), ["نیما", ",", "نانهای", "علی", "را", "دید", "."]);
  assert.equal(faLang.words("واقعاً؟").at(-1)?.q, true);
  assert.deepEqual(faLang.words("می‌روم، بلی.").map(w => w.i), [0, 6, 8, 11]);
  assert.equal(faLang.fold("كتابِ"), "کتاب");
  assert.ok(faLang.match("نان‌ها", "نان") && faLang.match("خانه‌اش", "خانه") && !faLang.match("نانوا", "نان"));
  assert.ok(faLang.pointing("اون") && !faLang.pointing("نان"));
  assert.equal(faLang.lower("ك‌ي"), "کی");
});

test("every word in the language's tables is already in its folded form", () => {
  for (const [g, ms] of Object.entries(faLang.motive)) for (const m of ms) assert.equal(lowerFa(m.replace(/\$$/, "")), m.replace(/\$$/, ""), `${g}: ${m}`);
  // the parenthetical keys keep their ZWNJ (the editor's `norm` drops it on both sides); apart from that they are folded
  for (const k of Object.keys(faLang.parenthetical ?? {})) assert.equal(lowerFa(k), k.replace(/\u200c/g, ""), k);
});

test("the check's resolver: forms of a card, names, particles and numbers", () => {
  const r = faLang.resolver(["نان", "خانه", "شیرینی", "علی"]);
  for (const t of ["نان", "نانها", "نانی", "خانه", "خانهای", "خانهاش", "شیرینی", "شیرینیها", "علی", "و", "را", "است", "دو", "بیست", "اول", "تا", "ها", "می"]) assert.ok(r(t), t);
  assert.ok(!r("نانوایی") && !r("تراکتور"));
  assert.deepEqual(faLang.checkWords("نان‌ها را ۲ تا بخر، می‌خواهم! ساعت ۱۰:۳۰."), ["نان", "ها", "را", "تا", "بخر", "می", "خواهم", "ساعت"]);
  assert.ok(!faLang.resolver(["نان"], { particles: false })("را"));
  // the endings after a ZWNJ are parts of their own: نان‌هایم, بچه‌هایی, نان‌هاست
  const rc = faLang.resolver(["نان", "بچه"]);
  for (const w of faLang.checkWords("نان‌هایم نان‌هایش بچه‌هایی نان‌ها نان‌هاست نان‌مان")) assert.ok(rc(w), w);
  assert.ok(!rc("تراکتورهایم") && !rc("هایتراکتور"));
});

test("lints: the bakkal scene in Persian is clean, with این at the loaf", () => {
  assert.deepEqual(lint(story()), []);
});

test("lint deixis: این / آن + a linked noun needs a gesture at it, and they agree", () => {
  let s = story(); delete line(s, 4).do;
  const p = lint(s);
  assert.deepEqual(rules(p), ["deixis@4"]);
  assert.deepEqual(p[0].fix, { do: "hold_up", at: "obj:ekmek" });
  s = story(); line(s, 4).at = "obj:simit";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "pointing at the wrong thing");
  s = story(); line(s, 4).do = "point_far";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "این does not point far");
  s = story(); line(s, 4).fa = "نان هست. آن نان خیلی تازه است.";
  assert.deepEqual(rules(lint(s), "warning"), ["deixis@4"], "آن نان, 0.6 m away");
  s = story(); line(s, 4).fa = "نان هست. اون نان خیلی تازه است.";
  assert.deepEqual(rules(lint(s), "warning"), ["deixis@4"], "اون is آن");
  s = story(); line(s, 4).fa = "نان هست. این دو نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "a number between این and the noun");
  s = story(); line(s, 4).fa = "نان هست. این خیلی تازه است."; delete line(s, 4).do;
  assert.deepEqual(rules(lint(s)), [], "این as a pronoun, before no linked noun");
});

test("lint هست / نیست: the prop is shown or hidden by then; questions, adjectives and است are not assertions", () => {
  // the fixture's "نان هست؟ شیر هست؟" (step 3) is a pair of questions and lints clean (the scene above)
  let s = story(); delete line(s, 6).obj;
  const p = lint(s);
  assert.deepEqual(rules(p), ["var_yok@6"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "sut", op: "hide" }] });
  s = story(); line(s, 9).fa = "شیر نداریم، ولی نان داریم."; line(s, 9).link = { شیر: "obj:sut", نان: "obj:ekmek" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "after the hide, شیر نداریم holds; نان داریم too");
  s = story(); line(s, 9).fa = "شیر داریم."; line(s, 9).link = { شیر: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = story(); line(s, 9).fa = "شیر هست."; line(s, 9).link = { شیر: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = story(); line(s, 9).fa = "شیر هست؟"; line(s, 9).link = { شیر: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a question");
  s = story(); line(s, 9).fa = "آیا شیر داریم."; line(s, 9).link = { شیر: "obj:sut" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "آیا makes it a question");
  s = story(); line(s, 9).fa = "نان هیچ‌وقت تازه نیست. نان تازه نیست."; line(s, 9).link = { نان: "obj:ekmek" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "نیست after an adjective says the bread is not fresh, not that it is gone");
  s = story(); line(s, 9).fa = "نان دیگر نیست."; line(s, 9).link = { نان: "obj:ekmek" }; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"], "a quantifier may stand between: the bread is still on the shelf");
  s = story(); line(s, 6).obj = [];
  line(s, 6).fa = "ولی شیر نیست."; (s.steps[3] as LineStep).obj = [{ id: "sut", op: "show" }];
  assert.deepEqual(rules(lint(s)), ["var_yok@6"], "شیر نیست, but the milk is still on the shelf");
});

test("lint number: a number before a linked prop matches n, through the counter تا", () => {
  let s = story(); line(s, 4).fa = "سه نان هست. این نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "three loaves are on the counter");
  s = story(); line(s, 4).fa = "سه تا نان هست. این نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "سه تا نان: the counter stands between");
  s = story(); line(s, 4).fa = "دو تا نان هست. این نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(rules(lint(s)), ["number@4"]);
  s = story(); line(s, 4).fa = "دوتا نان هست. این نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(rules(lint(s)), ["number@4"], "دوتا, the counter joined on");
  s = story(); line(s, 4).fa = "یک نان هست. این نان خیلی تازه است."; line(s, 4).link = { نان: "obj:ekmek" };
  assert.deepEqual(lint(s), [], "one is also the article");
  s = story(); const ch = (s.steps[8] as unknown as { choice: { options: { n?: number }[] } }).choice;
  ch.options[1].n = 3;
  assert.deepEqual(rules(lint(s)), ["number@8.1"], "give three loaves, n 3, but the text says two");
});

test("lint number: a number of several words is read once (بیست و یک), not again from its tail", () => {
  for (const [text, n] of [["بیست و یک تا نان هست.", 21], ["بیست و دو نان هست.", 22], ["صد و دو نان هست.", 102]] as const) {
    const s = story(); line(s, 4).fa = `${text} این نان خیلی تازه است.`; line(s, 4).link = { نان: "obj:ekmek" };
    (s.steps[4] as unknown as { obj: { id: string; op: string; n?: number }[] }).obj = [{ id: "ekmek", op: "show", n }];
    assert.deepEqual(rules(lint(s)).filter(r => r.startsWith("number")), [], text);
    (s.steps[4] as unknown as { obj: { n?: number }[] }).obj[0].n = n + 1;
    assert.deepEqual(rules(lint(s)).filter(r => r.startsWith("number")), ["number@4"], `${text} against ${n + 1}`);
  }
});

test("lint var_yok: ZWNJ words between (هیچ‌جا), and the singular and third-person verbs", () => {
  for (const fa of ["شیر هیچ‌جا نیست.", "شیر هیچ‌وقت نیست.", "شیر ندارم.", "شیر نداره.", "شیر ندارد.", "شیر ندارن."]) {
    const s = story(); line(s, 6).fa = fa; line(s, 6).link = { شیر: "obj:sut" }; delete line(s, 6).do;
    (s.steps[3] as LineStep).obj = [{ id: "sut", op: "show" }]; line(s, 6).obj = [];
    assert.deepEqual(rules(lint(s)).filter(r => r.startsWith("var_yok")), ["var_yok@6"], fa);
  }
  for (const fa of ["شیر دارم.", "شیر داره.", "شیر دارد."]) {
    const s = story(); line(s, 9).fa = fa; line(s, 9).link = { شیر: "obj:sut" }; delete line(s, 9).do;
    assert.deepEqual(rules(lint(s)), ["var_yok@9"], fa);
  }
});

test("lint time: a clock time said aloud matches the linked clock; a price and سه و نیم کیلو are no time", () => {
  const s = story();
  s.props = { clock: { kit: "clock", at: { x: -3.5, y: 2.3, z: -2.1 }, time: "10:10" } } as StoryDoc["props"];
  line(s, 9).fa = "ساعت ده و نیم است!"; delete line(s, 9).do;
  assert.deepEqual(lint(s), [], "not linked to the clock");
  line(s, 9).link = { ساعت: "obj:clock" };
  const p = lint(s);
  assert.deepEqual(rules(p), ["time@9"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "clock", op: "set", set: { time: "10:30" } }] });
  line(s, 9).obj = [{ id: "clock", op: "set", set: { time: "10:30" } }];
  assert.deepEqual(lint(s), [], "the hands move to the time said");
  line(s, 9).fa = "قیمتش ۳.۵۰ تومان است، سه و نیم کیلو."; line(s, 9).link = { تومان: "obj:clock" };
  assert.deepEqual(rules(lint(s)), [], "a price and a weight are no time");
});

test("lint budget: a gesture needs a Persian word to motivate it", () => {
  let s = story(); line(s, 9).do = "shrug";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "a shrug at چیز دیگری؟");
  s = story(); line(s, 9).do = "shrug"; line(s, 9).fa = "نمی‌دانم، ببخشید.";
  assert.deepEqual(rules(lint(s)), []);
  s = story(); line(s, 9).do = "wave"; line(s, 9).fa = "سلام دوباره!";
  assert.deepEqual(rules(lint(s)), []);
  s = story(); line(s, 9).do = "shake_head"; line(s, 9).fa = "نه، ممنون.";
  assert.deepEqual(rules(lint(s)), [], "نه$ is a whole word");
  s = story(); line(s, 9).do = "shake_head"; line(s, 9).fa = "نان تازه است.";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "نان does not shake the head: نه$ is a whole word");
  s = story(); line(s, 9).do = "me"; line(s, 9).fa = "من نان می‌خواهم.";
  assert.deepEqual(rules(lint(s)), []);
  s = story(); line(s, 9).do = "you"; line(s, 9).fa = "توی خانه نان هست."; line(s, 9).link = {};
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "توی (in) is not تو (you)");
  s = story(); line(s, 9).do = "count"; line(s, 9).fa = "نه، ممنون."; line(s, 9).n = 9;
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "a lone نه is no, not nine, so count has no number");
  s = story(); line(s, 9).do = "count"; line(s, 9).fa = "نه تا نان."; line(s, 9).n = 9; line(s, 9).link = { نان: "obj:ekmek" };
  assert.deepEqual(rules(lint(s), "warning").filter(r => r.startsWith("budget")), [], "نه تا is nine");
});
