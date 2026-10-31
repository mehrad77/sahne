// Say it aloud: normalising a recogniser's transcript and matching it to the card's line, with
// transcripts as Chrome's and Safari's tr-TR recognisers write them. Plus the numbers and clock
// times the story lints read.

import { test } from "node:test";
import assert from "node:assert/strict";
import tr, { normalise, matchLine, letters, readNumber, readClock, clockMinutes } from "../src/index.ts";

test("normalise: Turkish lower case, numerals in words, no punctuation or fillers", () => {
  assert.equal(normalise("Merhaba! Ben Nima."), "merhaba ben nima");
  assert.equal(normalise("İki ekmek, lütfen."), "iki ekmek lütfen");
  assert.equal(normalise("2 ekmek lütfen"), "iki ekmek lütfen");
  assert.equal(normalise("IŞIK"), "ışık");
  assert.equal(normalise("ıı hmm iki ekmek eee lütfen"), "iki ekmek lütfen");
  assert.equal(normalise("Nima'nın çantası"), "nimanın çantası");
  assert.equal(normalise("Saat 10:30"), "saat on otuz");
  assert.equal(normalise("Buyurun"), "buyrun");
  assert.equal(normalise("Hoşgeldiniz"), "hoş geldiniz");
  assert.equal(normalise("…"), "");
  // şey is a word (başka bir şey), not a filler
  assert.equal(normalise("Başka bir şey?"), "başka bir şey");
});

test("letters: a dot or a cedilla is a quarter of a letter", () => {
  assert.equal(letters("mı", "mi"), 0.25);
  assert.equal(letters("lütfen", "lutfen"), 0.25);
  assert.equal(letters("ekmeği", "ekmei"), 0.25);
  assert.equal(letters("var", "yok"), 3);
});

test("matchLine: the line as recognisers write it", () => {
  const yes: [string | string[], string][] = [
    ["merhaba ben nima", "Merhaba! Ben Nima."],
    ["Merhaba ben Nima", "Merhaba! Ben Nima."],
    ["2 ekmek lütfen", "İki ekmek, lütfen."],
    ["iki ekmek lütfen", "2 ekmek, lütfen."],
    ["Iki ekmek lutfen", "İki ekmek, lütfen."],
    ["hoşgeldiniz buyurun", "Hoş geldiniz! Buyrun."],
    ["ekmek varmı süt varmı", "Ekmek var mı? Süt var mı?"],
    ["ekmek var mi süt var mi", "Ekmek var mı? Süt var mı?"],
    ["ıı iki ekmek lütfen", "İki ekmek, lütfen."],
    ["evet iki ekmek lütfen", "İki ekmek, lütfen."],
    ["teşekkür ederim", "Teşekkür ederim."],
    ["teşekkürederim", "Teşekkür ederim."],
    ["saat on otuz", "Saat 10:30."],
    ["evet", "Evet."],
    // the n-best list: the second alternative is the line
    [["iki ekmek bitti", "iki ekmek lütfen"], "İki ekmek, lütfen."],
  ];
  for (const [h, e] of yes) {
    const m = matchLine(h, [e]);
    assert.ok(m.matched, `"${h}" is "${e}" (score ${m.score.toFixed(2)})`);
    assert.equal(m.best, 0);
  }
  assert.equal(matchLine(["iki ekmek bitti", "iki ekmek lütfen"], ["İki ekmek, lütfen."]).heard, "iki ekmek lütfen");
});

test("matchLine: a different line never matches", () => {
  const no: [string, string][] = [
    ["merhaba nasılsın", "Merhaba! Ben Nima."],
    ["üç ekmek lütfen", "İki ekmek, lütfen."],
    ["iki simit lütfen", "İki ekmek, lütfen."],
    ["ekmek yok", "Ekmek var."],
    ["süt var mı", "Ekmek var mı?"],
    ["iki ekmek ver", "İki ekmek, lütfen."],
    ["hayır", "Evet."],
    ["ev", "Evet."],
    ["lütfen", "İki ekmek, lütfen."],
    ["", "Evet."],
  ];
  for (const [h, e] of no) {
    const m = matchLine(h, [e]);
    assert.ok(!m.matched, `"${h}" is not "${e}" (score ${m.score.toFixed(2)})`);
    assert.equal(m.best, -1);
  }
});

test("matchLine: a choice picks the option that was said", () => {
  const options = ["İki ekmek, lütfen.", "İki ekmek ver."];
  assert.deepEqual([matchLine("iki ekmek lütfen", options).best, matchLine("2 ekmek ver", options).best], [0, 1]);
  assert.equal(matchLine("iki ekmek ver lütfen", options).best, 0);
  assert.equal(matchLine("dört ekmek", options).matched, false);
});

test("matchLine: the learner's name matches any word the recogniser makes of it", () => {
  const line = "Merhaba, ben Nima.";
  assert.ok(!matchLine("merhaba ben ali", [line]).matched);
  for (const h of ["merhaba ben lima", "merhaba ben ali", "merhaba ben nee ma", "merhaba ben"]) assert.ok(matchLine(h, [line], { names: ["Nima"] }).matched, h);
  assert.ok(!matchLine("merhaba ben", ["Nima"], { names: ["Nima"] }).matched, "a line that is only the name is never heard");
});

test("matchLine: tolerance follows the length of the line", () => {
  assert.ok(matchLine("tamım", ["Tamam."]).matched, "one letter off in a short word");
  assert.ok(!matchLine("tamıl", ["Tamam."]).matched, "two letters off in a short word");
  assert.ok(!matchLine("vir", ["Var."]).matched, "no letter off in a word of three");
  assert.ok(matchLine("var", ["Var."]).matched);
  assert.ok(matchLine("iki ekmek lütfen", ["İki ekmek, lütfen."], { tolerance: 0 }).matched);
  assert.ok(!matchLine("iki ekmek lutfen", ["İki ekmek, lütfen."], { tolerance: 0 }).matched);
});

test("the plugin carries the recogniser's locale and the matcher", () => {
  assert.equal(tr.locale, "tr-TR");
  assert.equal(tr.matchLine, matchLine);
  assert.equal(tr.normalise?.("2 ekmek"), "iki ekmek");
});

test("readNumber: digits and number words", () => {
  const w = (s: string) => s.split(" ");
  assert.deepEqual(readNumber(w("iki ekmek"), 0), { n: 2, len: 1 });
  assert.deepEqual(readNumber(w("on beş lira"), 0), { n: 15, len: 2 });
  assert.deepEqual(readNumber(w("bin dokuz yüz doksan"), 0), { n: 1990, len: 4 });
  assert.deepEqual(readNumber(w("3 simit"), 0), { n: 3, len: 1 });
  assert.equal(readNumber(w("ekmek"), 0), null);
});

test("readClock: the ways A1 says a time", () => {
  const t = (s: string) => readClock(s).map(c => `${c.h}:${String(c.m).padStart(2, "0")}`);
  assert.deepEqual(t("Saat on."), ["10:00"]);
  assert.deepEqual(t("Saat… on?"), ["10:00"]);
  assert.deepEqual(t("Saat üç buçuk."), ["3:30"]);
  assert.deepEqual(t("Ona çeyrek var."), ["9:45"]);
  assert.deepEqual(t("Saat on bire beş var."), ["10:55"]);
  assert.deepEqual(t("İkiyi on geçiyor."), ["2:10"]);
  assert.deepEqual(t("Dördü çeyrek geçiyor."), ["4:15"]);
  assert.deepEqual(t("Saat 10:30."), ["10:30"]);
  assert.deepEqual(t("3'e çeyrek var."), ["2:45"]);
  assert.deepEqual(t("Saat yarım."), ["12:30"]);
  assert.deepEqual(t("Saat on otuz."), ["10:30"]);
  assert.deepEqual(t("İki ekmek, lütfen."), [], "a number is no time without saat");
  assert.deepEqual(t("Saat kaç?"), []);
  assert.equal(clockMinutes("10:10"), clockMinutes({ h: 22, m: 10 }));
});
