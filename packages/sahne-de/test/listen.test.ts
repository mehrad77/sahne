// Say it aloud: normalising a recogniser's transcript and matching it to the card's line, with
// transcripts as Chrome's and Safari's de-DE recognisers write them. Plus the numbers and clock
// times the story lints read.

import { test } from "node:test";
import assert from "node:assert/strict";
import de, { normalise, matchLine, letters, readNumber, readClock, clockMinutes } from "../src/index.ts";

test("normalise: German lower case, numerals in words, no punctuation or fillers", () => {
  assert.equal(normalise("Guten Tag! Ich bin Nima."), "guten tag ich bin nima");
  assert.equal(normalise("Zwei Brezeln, bitte."), "zwei brezeln bitte");
  assert.equal(normalise("2 Brezeln bitte"), "zwei brezeln bitte");
  assert.equal(normalise("21 Äpfel"), "einundzwanzig äpfel");
  assert.equal(normalise("äh ähm zwei Brezeln eh bitte hmm"), "zwei brezeln bitte");
  assert.equal(normalise("Nima's Tasche"), "nimas tasche");
  assert.equal(normalise("Es ist 10:30"), "es ist zehn uhr dreißig");
  assert.equal(normalise("Zwo Brote"), "zwei brote");
  assert.equal(normalise("Wie gehts?"), "wie geht es");
  assert.equal(normalise("Dankeschön"), "danke schön");
  assert.equal(normalise("…"), "");
  // ah and oh are words, not fillers
  assert.equal(normalise("Ach so"), "ach so");
});

test("letters: an umlaut or ß for ss is a quarter of a letter", () => {
  assert.equal(letters("Bäcker", "Backer"), 0.25);
  assert.equal(letters("schön", "schon"), 0.25);
  assert.equal(letters("straße", "strasse"), 0.25);
  assert.equal(letters("strasse", "straße"), 0.25);
  assert.equal(letters("Hund", "Hand"), 1);
  assert.equal(letters("Brot", "Brezel"), 4);
});

test("matchLine: the line as recognisers write it", () => {
  const yes: [string | string[], string][] = [
    ["guten tag ich bin nima", "Guten Tag! Ich bin Nima."],
    ["Guten Tag ich bin Nima", "Guten Tag! Ich bin Nima."],
    ["2 Brezeln bitte", "Zwei Brezeln, bitte."],
    ["zwei brezeln bitte", "2 Brezeln, bitte."],
    ["Danke schön", "Dankeschön!"],
    ["dankeschön", "Danke schön!"],
    ["die strasse ist lang", "Die Straße ist lang."],
    ["die Straße ist lang", "Die Strasse ist lang."],
    ["Brötchen bitte", "Brötchen, bitte."],
    ["Brotchen bitte", "Brötchen, bitte."],
    ["zwo brote bitte", "Zwei Brote, bitte."],
    ["äh zwei Brezeln bitte", "Zwei Brezeln, bitte."],
    ["ja zwei brezeln bitte", "Zwei Brezeln, bitte."],
    [["zwei brezel bitte", "zwei brezeln bitte"], "Zwei Brezeln, bitte."],
  ];
  for (const [heard, line] of yes) assert.ok(matchLine(heard, [line]).matched, `${JSON.stringify(heard)} is ${line}`);
});

test("matchLine: a different word is a different line", () => {
  const no: [string, string][] = [
    ["Zwei Brote bitte", "Zwei Brezeln, bitte."],
    ["Brot bitte", "Zwei Brote, bitte."],
    ["Ich habe Brot", "Ich habe kein Brot."],
    ["Es ist halb drei", "Es ist halb vier."],
    ["Das Haus ist alt", "Das Hund ist alt."],
    ["Strand", "Straße"],
    ["", "Zwei Brote, bitte."],
  ];
  for (const [heard, line] of no) assert.ok(!matchLine(heard, [line]).matched, `${heard} is not ${line}`);
  assert.deepEqual(matchLine("strand", ["Straße"]).best, -1);
});

test("matchLine chooses between near options", () => {
  const options = ["Zwei Brezeln, bitte.", "Zwei Brote, bitte."];
  assert.equal(matchLine("zwei brezeln bitte", options).best, 0);
  assert.equal(matchLine("zwei brote bitte", options).best, 1);
  assert.equal(matchLine("2 Brote bitte", options).best, 1);
  assert.equal(matchLine(["zwei brezel bitte", "zwei brote bitte"], options).best, 1);
  assert.equal(matchLine("zwei äpfel bitte", options).matched, false);
});

test("matchLine: names match any one or two words", () => {
  assert.ok(matchLine("ich bin nema", ["Ich bin Nima."], { names: ["Nima"] }).matched);
  assert.ok(matchLine("ich bin nima", ["Ich bin Nima."], { names: ["Nima"] }).matched);
});

test("readNumber: digits and German number words", () => {
  const n = (s: string) => readNumber(s.split(" "), 0);
  assert.deepEqual(n("2"), { n: 2, len: 1 });
  assert.deepEqual(n("1.000"), { n: 1000, len: 1 });
  assert.deepEqual(n("zwei brote"), { n: 2, len: 1 });
  assert.deepEqual(n("einundzwanzig"), { n: 21, len: 1 });
  assert.deepEqual(n("dreißig"), { n: 30, len: 1 });
  assert.deepEqual(n("dreissig"), { n: 30, len: 1 });
  assert.deepEqual(n("hunderteins"), { n: 101, len: 1 });
  assert.deepEqual(n("zweitausendsechshundert"), { n: 2600, len: 1 });
  assert.deepEqual(n("eintausendneunhundertneunzig"), { n: 1990, len: 1 });
  assert.deepEqual(n("zwei millionen dreihunderttausend"), { n: 2_300_000, len: 3 });
  assert.deepEqual(n("eine million"), { n: 1_000_000, len: 2 });
  assert.deepEqual(readNumber(["brot", "zwei"], 1), { n: 2, len: 1 });
  assert.equal(n("brot"), null);
  assert.equal(n("zweihundertbrot"), null);
  assert.equal(n("und"), null);
  assert.equal(n("sechsundsechs"), null);
});

test("readClock: halb drei is 2:30, Viertel vor zehn is 9:45", () => {
  const t = (s: string) => readClock(s);
  assert.deepEqual(t("Es ist halb drei."), [{ h: 2, m: 30 }]);
  assert.deepEqual(t("Halb eins."), [{ h: 12, m: 30 }]);
  assert.deepEqual(t("Viertel vor zehn."), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("Viertel nach eins."), [{ h: 1, m: 15 }]);
  assert.deepEqual(t("Fünf nach halb drei."), [{ h: 2, m: 35 }]);
  assert.deepEqual(t("Fünf vor halb drei."), [{ h: 2, m: 25 }]);
  assert.deepEqual(t("Zehn nach drei."), [{ h: 3, m: 10 }]);
  assert.deepEqual(t("Zwanzig vor zwölf."), [{ h: 11, m: 40 }]);
  assert.deepEqual(t("Zehn vor eins."), [{ h: 12, m: 50 }]);
  assert.deepEqual(t("Dreiviertel drei."), [{ h: 2, m: 45 }]);
  assert.deepEqual(t("Es ist zehn Uhr."), [{ h: 10, m: 0 }]);
  assert.deepEqual(t("Es ist ein Uhr."), [{ h: 1, m: 0 }]);
  assert.deepEqual(t("Zehn Uhr dreißig."), [{ h: 10, m: 30 }]);
  assert.deepEqual(t("Es ist 10:30 Uhr."), [{ h: 10, m: 30 }]);
  assert.deepEqual(t("Um 8.15 Uhr."), [{ h: 8, m: 15 }]);
  assert.deepEqual(t("Zwei Brezeln, bitte."), [], "a bare number is no time");
  assert.deepEqual(t("Ich habe zwei Brote."), []);
  assert.equal(clockMinutes("10:10"), 10 * 60 + 10);
  assert.equal(clockMinutes({ h: 12, m: 30 }), 30);
  assert.equal(clockMinutes("zehn"), null);
});

test("the plugin hears", () => {
  assert.equal(de.normalise, normalise);
  assert.equal(de.matchLine, matchLine);
});

test("numerals: a decimal comma reads its fraction digit by digit, a price in euros and cents", () => {
  assert.equal(normalise("3,14"), "drei komma eins vier");
  assert.equal(normalise("3,50"), "drei komma fünf null");
  assert.equal(normalise("3,50 Euro"), "drei euro fünfzig");
  assert.equal(normalise("3,50 €"), "drei euro fünfzig");
  assert.equal(normalise("1,00 Euro"), "ein euro");
  assert.ok(matchLine("drei euro fünfzig", ["3,50 Euro"]).matched);
  assert.ok(matchLine("drei komma fünf null", ["3,50"]).matched);
});

test("ordinals: 'N.' after an article or preposition, in -n after am, im, zum, den", () => {
  assert.equal(normalise("am 2. Mai"), "am zweiten mai");
  assert.equal(normalise("im 3. Stock"), "im dritten stock");
  assert.equal(normalise("die 1. Tür"), "die erste tür");
  assert.equal(normalise("der 3. Oktober"), "der dritte oktober");
  assert.equal(normalise("Es sind 5. Dann"), "es sind fünf dann", "a sentence end, not an ordinal");
  assert.ok(matchLine("am dritten Mai", ["Am 3. Mai"]).matched);
});
