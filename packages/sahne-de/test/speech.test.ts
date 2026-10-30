// Tests of the German plugin: mouth timing for a scene's lines, numbers, lowercasing, and which
// words of a line are forms of a link token.
import { test } from "node:test";
import assert from "node:assert/strict";
import de, { speech, match, deixis, lowerDe, sayNumber, sayNumeral, sayWord, ordinal, tokens, syllables, phonemes, TIMING } from "../src/index.ts";
import type { Speech } from "sahne";

const SHAPES = new Set(["rest", "MBP", "A", "E", "I", "O", "U", "FV"]);

/** A scene's cue lines and their length at rate 1 (ms). */
const SCENE: [string, number][] = [
  ["Guten Tag! Wie geht es dir?", 2460],
  ["Zwei Brezeln, bitte.", 1780],
  ["Das Brot ist frisch.", 1600],
  ["Haben Sie Milch?", 1380],
  ["Ich möchte einen Kaffee.", 1870],
  ["Entschuldigung…", 1400],
  ["…", 900],
];

/** Every promise of the contract: sorted keys from 0, no shape twice in a row, a closing rest, spans in order. */
function wellFormed(text: string, sp: Speech) {
  const { keys, words, dur } = sp;
  assert.equal(keys[0].t, 0, `${text}: first key at 0`);
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i].t > keys[i - 1].t, `${text}: keys sorted at ${i}`);
    assert.notEqual(keys[i].v, keys[i - 1].v, `${text}: ${keys[i].v} twice at ${keys[i].t}`);
  }
  for (const k of keys) assert.ok(SHAPES.has(k.v), `${text}: unknown shape ${k.v}`);
  const last = keys[keys.length - 1];
  assert.equal(last.v, "rest", `${text}: ends on rest`);
  assert.ok(last.t <= dur, `${text}: last key inside the line`);
  if (/[\p{L}\p{N}]$/u.test(text.trim())) assert.equal(last.t, dur, `${text}: a line ending on a word closes at dur`);
  let end = 0, from = 0;
  for (const w of words) {
    assert.equal(text.slice(w.i, w.i + w.text.length), w.text, `${text}: span "${w.text}" at ${w.i}`);
    assert.ok(w.i >= from && w.t0 >= end && w.t1 > w.t0 && w.t1 <= dur, `${text}: span "${w.text}" in order`);
    from = w.i + w.text.length; end = w.t1;
  }
}

const syl = (w: string) => syllables(phonemes(w)).length;

test("the scene's lines are well formed, with the timings of the table", () => {
  for (const [text, dur] of SCENE) {
    const sp = speech(text);
    wellFormed(text, sp);
    assert.equal(sp.dur, dur, text);
  }
});

test("syllables follow the spelling: digraphs, diphthongs, silent h, schwa", () => {
  const cases: [string, number][] = [
    ["Schule", 2], ["Straße", 2], ["Brezeln", 2], ["Katze", 2], ["Frühstück", 2], ["Quark", 1],
    ["Bahn", 1], ["sehr", 1], ["Boot", 1], ["Bier", 1], ["Zeit", 1], ["Haus", 1], ["Freund", 1], ["Mädchen", 2], ["Sprache", 2],
    ["gehen", 2], ["Ruhe", 2], ["Lehrer", 2], ["Fenster", 2], ["Familie", 3], ["Zwiebel", 2], ["einundzwanzig", 4],
  ];
  for (const [w, n] of cases) assert.equal(syl(w), n, `${w}: ${phonemes(w)}`);
  assert.equal(phonemes("Schule"), "šulə");
  assert.equal(phonemes("Katze"), "kacə");
  assert.equal(phonemes("Pferd"), "ƥerd");
  assert.equal(phonemes("Straße"), phonemes("Strasse"));
});

test("a diphthong is two shapes in one syllable; a schwa is short", () => {
  assert.deepEqual(speech("Zeit").keys.map(k => k.v), ["A", "I", "rest"]);
  assert.deepEqual(speech("Frau").keys.map(k => k.v), ["FV", "A", "U", "rest"]);
  const eu = speech("Freund").keys.map(k => k.v);
  assert.ok(eu.includes("O") && eu.includes("I") && eu.indexOf("O") < eu.indexOf("I"), "eu is O then I");
  const au = speech("Haus").keys.map(k => k.v);
  assert.deepEqual(au.slice(0, 2), ["A", "U"], "au is A then U");
  // Katze: ka (200) + tse (schwa, 120)
  const k = speech("Katze");
  assert.equal(k.dur, TIMING.syllable + TIMING.schwa);
});

test("words keep their indices in the original text, and punctuation is never a word", () => {
  const sp = speech("Das Brot ist frisch.");
  assert.deepEqual(sp.words.map(w => [w.text, w.i]), [["Das", 0], ["Brot", 4], ["ist", 9], ["frisch", 13]]);
  assert.deepEqual(speech("„Zwei Brote“, sagte sie — bitte!").words.map(w => w.text), ["Zwei", "Brote", "sagte", "sie", "bitte"]);
  const ap = speech("Nima's Tasche ist da.");
  assert.deepEqual(ap.words.map(w => [w.text, w.i]), [["Nima's", 0], ["Tasche", 7], ["ist", 14], ["da", 18]]);
});

test("the lips close for m b p and touch the teeth for f v w; ö is O, ü is U", () => {
  assert.deepEqual(speech("Mama").keys.map(k => k.v), ["MBP", "A", "MBP", "A", "rest"]);
  assert.deepEqual(speech("Vater").keys.map(k => k.v), ["FV", "A", "E", "rest"]);
  assert.ok(speech("Wasser").keys.some(k => k.v === "FV"));
  assert.deepEqual(speech("öl, üben").keys.map(k => k.v)[0], "O");
  const mbp = speech("Oma").keys;
  assert.equal(mbp[2].t - mbp[1].t, TIMING.mbp);
});

test("pauses: 60 ms between words, 250 at a comma, 450 at a full stop, 600 at an ellipsis", () => {
  const gap = (sp: Speech, k: number) => sp.words[k + 1].t0 - sp.words[k].t1;
  const a = speech("Zwei Brezeln, bitte.");
  assert.equal(gap(a, 0), TIMING.gap);
  assert.equal(gap(a, 1), TIMING.comma);
  assert.equal(a.dur - a.words[2].t1, TIMING.stop);
  assert.equal(gap(speech("Das Brot. Danke"), 1), TIMING.stop);
  const b = speech("Entschuldigung…");
  assert.equal(b.dur - b.words[0].t1, TIMING.ellipsis);
  assert.equal(speech("Entschuldigung...").dur, b.dur);
  assert.equal(gap(speech("Was?! Ja."), 0), TIMING.stop, "a run of marks is one pause");
});

test("the silent card is 900 ms of rest with one span", () => {
  for (const text of ["…", "...", " … "]) {
    const sp = speech(text);
    assert.equal(sp.dur, TIMING.silent, text);
    assert.deepEqual(sp.keys, [{ t: 0, v: "rest" }]);
    assert.equal(sp.words.length, 1);
    assert.equal(sp.words[0].text, text.trim());
  }
  assert.deepEqual(speech(""), { dur: 0, keys: [{ t: 0, v: "rest" }], words: [] });
});

test("rate divides every time; voice does not change timing", () => {
  for (const [text] of SCENE) {
    const one = speech(text);
    for (const rate of [2, 0.8, 1.3]) {
      const sp = speech(text, { rate });
      wellFormed(text, sp);
      assert.ok(Math.abs(sp.dur - one.dur / rate) <= 1, `${text} at ${rate}`);
      assert.equal(sp.keys.length, one.keys.length);
      sp.keys.forEach((k, i) => assert.ok(Math.abs(k.t - one.keys[i].t / rate) <= 1));
    }
    assert.deepEqual(speech(text, { voice: "whisper" }), one);
  }
  assert.deepEqual(speech("Danke schön", { rate: 0 }), speech("Danke schön"), "a bad rate is 1");
});

test("lowercasing keeps the umlauts and ß; capitals do not change the timing", () => {
  assert.equal(lowerDe("STRAßE Äpfel ẞ"), "straße äpfel ß");
  assert.equal(speech("DAS BROT").dur, speech("das brot").dur);
  assert.deepEqual(speech("ÄPFEL").keys, speech("äpfel").keys);
  assert.equal(speech("Strasse").dur, speech("Straße").dur);
});

test("numbers are timed as their German words, and the span covers the digits", () => {
  assert.equal(sayNumber(2), "zwei");
  assert.equal(sayNumber(10), "zehn");
  assert.equal(sayNumber(15), "fünfzehn");
  assert.equal(sayNumber(21), "einundzwanzig");
  assert.equal(sayNumber(30), "dreißig");
  assert.equal(sayNumber(100), "hundert");
  assert.equal(sayNumber(101), "hunderteins");
  assert.equal(sayNumber(1000), "eintausend");
  assert.equal(sayNumber(1990), "eintausendneunhundertneunzig");
  assert.equal(sayNumber(2026), "zweitausendsechsundzwanzig");
  assert.equal(sayNumber(21000), "einundzwanzigtausend");
  assert.equal(sayNumber(1_500_000), "eine Million fünfhunderttausend");
  assert.equal(sayNumber(2_000_000), "zwei Millionen");
  assert.equal(sayWord("10:30"), "zehn uhr dreißig");
  assert.equal(sayWord("1:30"), "ein uhr dreißig");
  assert.equal(sayWord("50%"), "fünfzig prozent");
  assert.equal(sayWord("3,5"), "drei komma fünf");
  assert.equal(sayWord("1.000"), "eintausend");
  assert.equal(sayWord("05"), "null fünf");
  assert.equal(sayWord("TV"), "te fau");
  const y = speech("21");
  assert.deepEqual(y.words.map(w => w.text), ["21"]);
  assert.equal(y.dur, speech("einundzwanzig").dur);
  // "am 2. Mai": an ordinal, read "zweite", with no full stop after it
  assert.deepEqual(tokens("am 2. mai").map(t => t.kind === "word" ? t.said : t.mark), ["am", "zweite", "mai"]);
  assert.equal(sayNumeral("3", true), "dritte");
  assert.deepEqual([1, 2, 3, 7, 8, 12, 19, 20, 21, 100].map(ordinal), ["erste", "zweite", "dritte", "siebte", "achte", "zwölfte", "neunzehnte", "zwanzigste", "einundzwanzigste", "hundertste"]);
});

test("hums and shushes hold one shape", () => {
  assert.deepEqual(speech("Hmm").keys.map(k => k.v), ["MBP", "rest"]);
  assert.deepEqual(speech("Pst!").keys.map(k => k.v), ["U", "rest"]);
});

test("speech is deterministic", () => {
  for (const [text] of SCENE) assert.deepEqual(speech(text, { rate: 1.3 }), speech(text, { rate: 1.3 }));
});

test("match: inflected forms of the token", () => {
  const yes: [string, string][] = [
    ["Brot", "Brot"], ["brot", "Brot"], ["BROT", "brot"], ["Brot.", "Brot"], ["„Brot“", "Brot"],
    ["Brote", "Brot"], ["Brotes", "Brot"], ["Broten", "Brot"], ["Hund", "Hund"], ["Hunde", "Hund"], ["Hunden", "Hund"], ["Hundes", "Hund"],
    ["Apfel", "Apfel"], ["Äpfel", "Apfel"], ["Äpfeln", "Apfel"], ["Apfels", "Apfel"],
    ["Buch", "Buch"], ["Bücher", "Buch"], ["Büchern", "Buch"], ["Häuser", "Haus"], ["Hände", "Hand"], ["Brüder", "Bruder"], ["Mütter", "Mutter"], ["Stühle", "Stuhl"], ["Bäume", "Baum"],
    ["Kinder", "Kind"], ["Kindern", "Kind"], ["Katzen", "Katze"], ["Straßen", "Straße"], ["Strassen", "Straße"], ["Brezeln", "Brezel"], ["Frauen", "Frau"],
    ["Füße", "Fuß"], ["Füsse", "Fuß"], ["Nüsse", "Nuss"], ["Lehrerinnen", "Lehrerin"], ["Ergebnisse", "Ergebnis"],
    ["Museen", "Museum"], ["Themen", "Thema"], ["Autos", "Auto"], ["Cafés", "Café"], ["Herren", "Herr"],
    ["Nimas", "Nima"], ["Nima's", "Nima"], ["Ismails", "Ismail"], ["Brezeln", "rote Brezel"], ["Tees", "Tee"],
  ];
  for (const [w, t] of yes) assert.ok(match(w, t), `${w} is a form of ${t}`);
});

test("match: different words that start the same way", () => {
  const no: [string, string][] = [
    // compounds and derived words name other things: the roll, the basket, the baker's shop
    ["Brötchen", "Brot"], ["Brotkorb", "Brot"], ["Brotes", "Brötchen"], ["Bäckerei", "Bäcker"], ["Backwaren", "Back"], ["Brotzeit", "Brot"], ["Hundehütte", "Hund"], ["Apfelsaft", "Apfel"],
    ["Lehrerin", "Lehrer"], ["Kindergarten", "Kind"], ["Kindheit", "Kind"],
    // and words that only look like a stem plus something
    ["Haut", "Haus"], ["Hand", "Hund"], ["Katz", "Katze"], ["Tag", "Tasche"], ["Bro", "Brot"], ["", "Brot"], ["rote", "Brot"],
  ];
  for (const [w, t] of no) assert.ok(!match(w, t), `${w} is not a form of ${t}`);
});

test("match finds the linked word in a line, and deixis finds the demonstrative", () => {
  const sp = speech("Das Brot ist frisch. Dieses Brot ist gut.");
  assert.deepEqual(sp.words.filter(w => match(w.text, "Brot")).map(w => w.i), [4, 28]);
  assert.deepEqual(sp.words.map(w => deixis(w.text)), [null, null, null, null, "dies", null, null, null]);
  assert.deepEqual(["dieser", "dieses", "diesen", "jener", "jenes", "dich", "die"].map(w => deixis(w)), ["dies", "dies", "dies", "jen", "jen", null, null]);
  assert.equal(deixis("das", "hier"), "dies");
  assert.equal(deixis("der", "da"), "da");
  assert.equal(deixis("der", "dort"), "da");
  assert.equal(deixis("das", "Brot"), null);
});

test("the plugin", () => {
  assert.equal(de.id, "de");
  assert.equal(de.locale, "de-DE");
  assert.equal(de.speech, speech);
  assert.equal(de.match, match);
});
