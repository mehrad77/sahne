// Tests of the Turkish plugin: mouth timing for the test scene's lines, numbers, lowercasing,
// and which words of a line are forms of a link token.
import { test } from "node:test";
import assert from "node:assert/strict";
import tr, { speech, match, deixis, lowerTr, sayNumber, sayWord, tokens, syllables, phonemes, TIMING } from "../src/index.ts";
import type { Speech } from "sahne";

const SHAPES = new Set(["rest", "MBP", "A", "E", "I", "O", "U", "FV"]);

/** The test scene's cue lines and their length at rate 1 (ms). */
const SCENE: [string, number][] = [
  ["Hoş geldiniz! Buyrun.", 2160],
  ["Ekmek var mı? Süt var mı?", 2540],
  ["Ekmek var. Şu ekmek çok taze.", 2940],
  ["Ama süt yok.", 1370],
  ["İki ekmek, lütfen.", 1960],
  ["İki ekmek ver.", 1570],
  ["Başka bir şey?", 1370],
  ["Yavaş yavaş…", 1460],
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

const vowelsOf = (sp: Speech) => sp.words.reduce((n, w) => n + syllables(phonemes(sayWord(w.text).replace(/ /g, ""))).length, 0);
const pauses = (sp: Speech) => sp.words.slice(1).reduce((n, w, k) => n + (w.t0 - sp.words[k].t1), sp.words[0].t0) + (sp.dur - sp.words[sp.words.length - 1].t1);

test("the test scene's lines are well formed, about 200 ms a vowel plus pauses", () => {
  for (const [text, dur] of SCENE) {
    const sp = speech(text);
    wellFormed(text, sp);
    assert.equal(sp.dur, dur, text);
    if (text === "…") continue;
    const perVowel = (sp.dur - pauses(sp)) / vowelsOf(sp);
    assert.ok(perVowel >= 180 && perVowel <= 230, `${text}: ${perVowel} ms a vowel`);
  }
});

test("words keep their indices in the original text, and punctuation is never a word", () => {
  const sp = speech("Ekmek var. Şu ekmek çok taze.");
  assert.deepEqual(sp.words.map(w => [w.text, w.i]), [["Ekmek", 0], ["var", 6], ["Şu", 11], ["ekmek", 14], ["çok", 20], ["taze", 24]]);
  assert.deepEqual(speech("“İki ekmek,” dedi — lütfen!").words.map(w => w.text), ["İki", "ekmek", "dedi", "lütfen"]);
  const ap = speech("Nima'nın çantası İstanbul'a gitti.");
  assert.deepEqual(ap.words.map(w => [w.text, w.i]), [["Nima'nın", 0], ["çantası", 9], ["İstanbul'a", 17], ["gitti", 28]]);
});

test("the lips close for m b p and touch the teeth for f v; ı is I", () => {
  assert.deepEqual(speech("Ekmek var mı?").keys.map(k => k.v), ["E", "MBP", "E", "rest", "FV", "A", "rest", "MBP", "I", "rest"]);
  const mbp = speech("Ama").keys;
  assert.equal(mbp[2].t - mbp[1].t, TIMING.mbp);
  assert.deepEqual(speech("kırk").keys.map(k => k.v), ["I", "rest"]);
  assert.deepEqual(speech("göz, üzüm").keys.map(k => k.v), ["O", "rest", "U", "rest", "U", "MBP", "rest"]);
  // two syllables with one shape dip between them (ka-la-cak), but a long vowel holds (saat)
  assert.deepEqual(speech("kalacak").keys.map(k => k.v), ["A", "rest", "A", "rest", "A", "rest"]);
  assert.deepEqual(speech("saat").keys.map(k => k.v), ["A", "rest"]);
});

test("pauses: 60 ms between words, 250 at a comma, 450 at a full stop, 600 at an ellipsis", () => {
  const gap = (sp: Speech, k: number) => sp.words[k + 1].t0 - sp.words[k].t1;
  const a = speech("İki ekmek, lütfen.");
  assert.equal(gap(a, 0), TIMING.gap);
  assert.equal(gap(a, 1), TIMING.comma);
  assert.equal(a.dur - a.words[2].t1, TIMING.stop);
  assert.equal(gap(speech("Ekmek var. Şu ekmek"), 1), TIMING.stop);
  const b = speech("Yavaş yavaş…");
  assert.equal(b.dur - b.words[1].t1, TIMING.ellipsis);
  assert.equal(speech("Yavaş yavaş...").dur, b.dur);
  assert.equal(gap(speech("Ne?! Evet."), 0), TIMING.stop, "a run of marks is one pause");
});

test("the silent card is 900 ms of rest with one span", () => {
  for (const text of ["…", "...", " … "]) {
    const sp = speech(text);
    assert.equal(sp.dur, TIMING.silent, text);
    assert.deepEqual(sp.keys, [{ t: 0, v: "rest" }]);
    assert.equal(sp.words.length, 1);
    assert.equal(sp.words[0].text, text.trim());
    assert.equal(text.slice(sp.words[0].i, sp.words[0].i + sp.words[0].text.length), text.trim());
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
  assert.deepEqual(speech("Ama süt yok.", { rate: 0 }), speech("Ama süt yok."), "a bad rate is 1");
});

test("lowercasing is Turkish: I is ı and İ is i", () => {
  assert.equal(lowerTr("İSTANBUL"), "istanbul");
  assert.equal(lowerTr("ISPARTA"), "ısparta");
  assert.equal(lowerTr("İki"), "iki", "a decomposed İ");
  assert.equal(speech("İKİ EKMEK").dur, speech("iki ekmek").dur);
  assert.deepEqual(speech("KIRK").keys, speech("kırk").keys);
});

test("numbers are timed as their Turkish words, and the span covers the digits", () => {
  assert.equal(sayNumber(2), "iki");
  assert.equal(sayNumber(10), "on");
  assert.equal(sayNumber(15), "on beş");
  assert.equal(sayNumber(100), "yüz");
  assert.equal(sayNumber(1000), "bin");
  assert.equal(sayNumber(1990), "bin dokuz yüz doksan");
  assert.equal(sayNumber(2026), "iki bin yirmi altı");
  assert.equal(sayNumber(1_500_000), "bir milyon beş yüz bin");
  assert.equal(sayWord("10:30"), "on otuz");
  assert.equal(sayWord("1990'da"), "bin dokuz yüz doksanda");
  assert.equal(sayWord("%50"), "yüzde elli");
  assert.equal(sayWord("3,5"), "üç virgül beş");
  assert.equal(sayWord("1.000"), "bin");
  assert.equal(sayWord("TL"), "te le");
  const y = speech("1990");
  assert.deepEqual(y.words.map(w => w.text), ["1990"]);
  assert.equal(y.dur, 6 * TIMING.syllable, "bin-do-kuz-yüz-dok-san");
  const c = speech("Saat 10:30'da.");
  assert.deepEqual(c.words.map(w => [w.text, w.i]), [["Saat", 0], ["10:30'da", 5]]);
  assert.equal(c.words[1].t1 - c.words[1].t0, 4 * TIMING.syllable, "o-no-tuz-da");
  // "2. kat": an ordinal, read "ikinci", with no full stop after it
  assert.deepEqual(tokens("2. kat").map(t => t.kind === "word" ? t.said : t.mark), ["ikinci", "kat"]);
  assert.equal(speech("2. kat").words[1].t0 - speech("2. kat").words[0].t1, TIMING.gap);
});

test("hums and shushes hold one shape", () => {
  assert.deepEqual(speech("Hmm").keys.map(k => k.v), ["MBP", "rest"]);
  assert.deepEqual(speech("Şşş!").keys.map(k => k.v), ["U", "rest"]);
});

test("speech is deterministic", () => {
  for (const [text] of SCENE) assert.deepEqual(speech(text, { rate: 1.3 }), speech(text, { rate: 1.3 }));
});

test("match: inflected forms of the token", () => {
  const yes: [string, string][] = [
    ["ekmek", "ekmek"], ["Ekmek", "ekmek"], ["EKMEK", "ekmek"], ["ekmek.", "ekmek"], ["“Ekmek”", "ekmek"],
    ["ekmeği", "ekmek"], ["ekmekler", "ekmek"], ["ekmekte", "ekmek"], ["ekmeğe", "ekmek"], ["ekmeğimi", "ekmek"], ["ekmeklerimiz", "ekmek"], ["ekmekteki", "ekmek"], ["ekmekti", "ekmek"],
    ["kitabı", "kitap"], ["kitaplar", "kitap"], ["kitabını", "kitap"], ["kitabında", "kitap"],
    ["sütü", "süt"], ["sütler", "süt"], ["çayı", "çay"], ["çaylar", "çay"], ["çayla", "çay"],
    ["suyu", "su"], ["suyun", "su"], ["sular", "su"], ["suda", "su"], ["suya", "su"],
    ["İsmail'in", "İsmail"], ["İSMAİL'İN", "ismail"], ["İsmail’e", "İsmail"], ["İsmail'inki", "İsmail"], ["Nima'nın", "Nima"], ["İstanbul'a", "İstanbul"],
    ["rengi", "renk"], ["simidi", "simit"], ["ağzı", "ağız"], ["burnu", "burun"], ["hakkı", "hak"], ["saati", "saat"], ["rolü", "rol"],
    ["kapısı", "kapı"], ["kapısını", "kapı"], ["kapıyı", "kapı"], ["öğrenciyim", "öğrenci"], ["masadakini", "masa"], ["kâğıdı", "kağıt"],
    ["bardağını", "çay bardağı"],
  ];
  for (const [w, t] of yes) assert.ok(match(w, t), `${w} is a form of ${t}`);
});

test("match: different words that start the same way", () => {
  const no: [string, string][] = [
    // derived words name other things: the baker, the bookshop, the teapot, a sausage
    ["ekmekçi", "ekmek"], ["ekmeksiz", "ekmek"], ["kitapçı", "kitap"], ["kitaplık", "kitap"], ["sütlü", "süt"],
    ["çayır", "çay"], ["çaycı", "çay"], ["çaydanlık", "çay"], ["sucuk", "su"], ["susuz", "su"], ["Türkçe", "Türk"],
    // and words that only look like a stem plus something
    ["sun", "su"], ["sus", "su"], ["susadım", "su"], ["elma", "el"], ["evet", "ev"], ["balık", "bal"], ["gözlük", "göz"], ["pastane", "pasta"], ["masal", "masa"],
    ["ekme", "ekmek"], ["ikinci", "iki"], ["kitabi", "kitap"], ["İsmail'den", "Ismail"], ["", "ekmek"],
  ];
  for (const [w, t] of no) assert.ok(!match(w, t), `${w} is not a form of ${t}`);
});

test("match finds the linked word in a line, and deixis finds the demonstrative", () => {
  const sp = speech("Ekmek var. Şu ekmek çok taze.");
  assert.deepEqual(sp.words.filter(w => match(w.text, "ekmek")).map(w => w.i), [0, 14]);
  assert.deepEqual(sp.words.map(w => deixis(w.text)), [null, null, "şu", null, null, null]);
  assert.deepEqual(["bu", "bunu", "şuna", "orada", "on", "böyle"].map(deixis), ["bu", "bu", "şu", "o", null, "bu"]);
});

test("the plugin", () => {
  assert.equal(tr.id, "tr");
  assert.equal(tr.speech, speech);
  assert.equal(tr.match, match);
});
