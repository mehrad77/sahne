// Tests of the Persian plugin's mouth timing: the contract every plugin keeps, the spelling rules' syllable
// counts, the labials, and the Arabic forms and digits a line may be written with. Every expected duration is the
// rule set's own answer, to catch a change; none is a measurement of a native speaker, and each rule wants one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fa, { speech, respell, phonemes, syllables, sayWord, normalise, lowerFa, tokens, TIMING, VISEME } from "../src/index.ts";
import type { Speech } from "sahne";

const SHAPES = new Set(["rest", "MBP", "A", "E", "I", "O", "U", "FV"]);

/** A baker's-shop scene: lines and their length at rate 1 (ms). */
const SCENE: [string, number][] = [
  ["خوش آمدید! بفرمایید.", 2420],
  ["نان هست؟ شیر هست؟", 1820],
  ["نان هست. آن نان خیلی تازه است.", 2930],
  ["ولی شیر نیست.", 1370],
  ["دو تا نان، لطفاً.", 1740],
  ["چیز دیگری؟", 1110],
  ["آهسته آهسته…", 1320],
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

test("the scene's lines are well formed and last as long as the rules say", () => {
  for (const [text, dur] of SCENE) {
    const sp = speech(text);
    wellFormed(text, sp);
    assert.equal(sp.dur, dur, text);
  }
});

test("the plugin is Persian, right to left, and carries the recogniser's locale", () => {
  assert.equal(fa.id, "fa");
  assert.equal(fa.dir, "rtl");
  assert.equal(fa.locale, "fa-IR");
  assert.equal(typeof fa.speech, "function");
});

test("words keep their indices in the original text, punctuation (Latin and Arabic) is never a word, ZWNJ joins a word", () => {
  const sp = speech("دو تا نان، لطفاً.");
  assert.deepEqual(sp.words.map(w => [w.text, w.i]), [["دو", 0], ["تا", 3], ["نان", 6], ["لطفاً", 11]]);
  assert.deepEqual(speech("می‌خواهم «نان» بخرم؛ ممنون!").words.map(w => w.text), ["می‌خواهم", "نان", "بخرم", "ممنون"]);
  assert.equal(speech("کتاب‌های من").words.length, 2, "کتاب‌های is one word");
  assert.deepEqual(tokens("چه؟ نه…").map(t => t.kind === "pause" ? t.mark : "word"), ["word", "stop", "word", "ellipsis"]);
});

test("pauses: comma 250, stop 450, ellipsis 600, and several marks are one pause, the longest; ، ؛ ؟ count", () => {
  const word = speech("بله").dur;
  assert.equal(speech("بله، بله").dur - 2 * word, TIMING.comma);
  assert.equal(speech("بله؛ بله").dur - 2 * word, TIMING.comma);
  assert.equal(speech("بله. بله").dur - 2 * word, TIMING.stop);
  assert.equal(speech("بله؟ بله").dur - 2 * word, TIMING.stop);
  assert.equal(speech("بله… بله").dur - 2 * word, TIMING.ellipsis);
  assert.equal(speech("بله؟! بله").dur, speech("بله! بله").dur);
  assert.equal(speech("بله.").dur, word + TIMING.stop, "a closing pause adds to dur");
});

test("rate divides every time; voice does not change the timing", () => {
  const a = speech("دو تا نان، لطفاً."), b = speech("دو تا نان، لطفاً.", { rate: 2 });
  assert.equal(b.dur, Math.round(a.dur / 2));
  assert.deepEqual(speech("دو تا نان، لطفاً.", { voice: "whisper" }), a);
  assert.equal(speech("بله", { rate: 0 }).dur, speech("بله").dur, "a bad rate is 1");
});

test("the silent card, an empty line, a hum and a shush", () => {
  assert.deepEqual(speech("…").keys, [{ t: 0, v: "rest" }]);
  assert.equal(speech("…").dur, TIMING.silent);
  assert.deepEqual(speech("").words, []);
  const hm = speech("هوم.");
  wellFormed("هوم.", hm);
  assert.equal(hm.keys[0].v, "MBP");
  assert.equal(speech("هیس!").keys[0].v, "U", "a shush rounds the lips");
  assert.notEqual(speech("هم").keys[0].v, "MBP", "هم (also) is a word, not a hum");
});

test("labials: م ب پ close the lips, ف and the consonant و touch the teeth", () => {
  const shapes = (t: string) => speech(t).keys.map(k => k.v);
  assert.ok(shapes("مادر").includes("MBP"));
  assert.ok(shapes("نان بربری").includes("MBP"));
  assert.ok(shapes("پدر").includes("MBP"));
  assert.ok(shapes("فردا").includes("FV"));
  assert.ok(shapes("ولی").includes("FV"), "initial و is v");
  assert.ok(shapes("گاو").includes("FV"), "final و after ā is v");
  assert.ok(!shapes("تا").includes("MBP"));
});

test("the mouth shapes of the vowels: ā → A, i → I, u → U, o → O, e → E, a → A", () => {
  assert.deepEqual(VISEME, { A: "A", I: "I", U: "U", O: "O", E: "E", a: "A", e: "E", o: "O" });
  const shapes = (t: string) => speech(t).keys.map(k => k.v).filter(v => v !== "rest");
  assert.deepEqual(shapes("نان"), ["A"]);
  assert.deepEqual(shapes("شیر"), ["I"]);
  assert.deepEqual(shapes("دوست"), ["U"]);
  assert.deepEqual(shapes("تو"), ["O"]);
  assert.deepEqual(shapes("او"), ["O"], "initial او is O");
  assert.deepEqual(shapes("خانه"), ["A", "E"], "the silent final ه is a light e");
});

test("a short vowel is shorter than a long one, and the silent final ه lighter still", () => {
  assert.ok(speech("من").dur < speech("نان").dur, "man has a short vowel");
  assert.ok(speech("بچه").dur < speech("بچا").dur, "the ه of بچه is a light e");
});

test("numbers are timed as their Persian words, the span covers the digits (Latin, Persian and Arabic-Indic)", () => {
  const sp = speech("۱۵ تا");
  assert.deepEqual(sp.words.map(w => w.text), ["۱۵", "تا"]);
  assert.equal(speech("15").dur, speech("پانزده").dur);
  assert.equal(speech("۱۵").dur, speech("پانزده").dur);
  assert.equal(speech("١٥").dur, speech("پانزده").dur);
  assert.equal(speech("10:30").words.length, 1);
  assert.equal(speech("10:30").dur, speech("ده و سی").dur - 2 * TIMING.gap, "two words in one span");
  assert.equal(speech("50%").dur, speech("پنجاه درصد").dur - TIMING.gap);
});

test("a word in another script is timed by its length", () => {
  const sp = speech("Wi-Fi");
  wellFormed("Wi-Fi", sp);
  assert.ok(sp.dur > 200);
});

/** How many vowels the rules find in a word: its syllables. (The rules count a stem's و after a consonant as u, so verbs like می‌روم come out one short: a known miss.) */
const SYLLABLES: Record<string, number> = {
  سلام: 2, کتاب: 2, مدرسه: 3, خانه: 2, بفرمایید: 4, ممنون: 2, دوست: 1, خواهر: 2, لطفاً: 2, هست: 1, نیست: 1, داریم: 2, نداریم: 3, ایران: 2, اینجا: 2, شیر: 1, نان: 1, بله: 2,
  چطور: 2, خوب: 1, کردم: 2, بزرگ: 2, پیاده: 3, آقایان: 3, استاد: 2, امروز: 2, برای: 2, خیلی: 2, تازه: 2, پانصد: 2, دو: 1, تو: 1, من: 1, ما: 1, تا: 1, چای: 1, پایین: 2,
  پنیر: 2, همه: 2, بچه: 2, مادر: 2, پدر: 2, برادر: 3, دختر: 2, شهر: 1, سفر: 2, خبر: 2, قهوه: 2, کجا: 2, چرا: 2, آب: 1, که: 1, به: 1, از: 1, را: 1, این: 1, آن: 1, اون: 1,
  یک: 1, یازده: 2, دوازده: 3, بیست: 1, صد: 1, هزار: 2, خدا: 2, مرسی: 2, صبح: 1, شب: 1, ساعت: 2, دقیقه: 3, ربع: 1, نیم: 1, دست: 1, پنج: 1, چهار: 2,
};

test("the spelling rules count the syllables of common words", () => {
  const bad: string[] = [];
  for (const [w, n] of Object.entries(SYLLABLES)) {
    const got = syllables(respell(w)).length;
    if (got !== n) bad.push(`${w} ${respell(w)}: ${got}, want ${n}`);
  }
  assert.deepEqual(bad, []);
});

test("the rules: long vowels, و as a vowel or a consonant, ی as i or y, the final ه, and the short vowels between consonants", () => {
  assert.equal(respell("خانه"), "xAnE");
  assert.equal(respell("شاه"), "SAh", "ه after a long vowel is h");
  assert.equal(respell("کوه"), "kUh");
  assert.equal(respell("دوست"), "dUst", "و between consonants is u");
  assert.equal(respell("ولی"), "valI", "initial و is v");
  assert.equal(respell("خواب"), "xAb", "the و of خوا is not said");
  assert.equal(respell("گاو"), "gAv");
  assert.equal(respell("روی"), "rUy");
  assert.equal(respell("پای"), "pAy");
  assert.equal(respell("یک"), "yek", "initial ی is y");
  assert.equal(respell("پیاده"), "pIyAdE");
  assert.equal(respell("کیه"), "kIyE");
  assert.equal(respell("و"), "O", "the word و (and) is o");
  assert.equal(respell("آب"), "Ab");
  assert.equal(respell("اینجا"), "InjA");
  assert.equal(respell("امروز"), "emrUz", "ا before ن or م and a consonant is e");
  assert.equal(respell("مدرسه"), "madresE", "three consonants with a liquid in the middle: mad-re-se");
  assert.equal(respell("کردم"), "kardam", "a final run of three: kar-dam");
  assert.equal(respell("سلام"), "salAm", "two consonants at the start: se-lām");
});

test("ZWNJ ends a part of a word, each part gets its own short vowels; ezafe marks are said", () => {
  assert.equal(respell("می‌روم"), "mIrUm");
  assert.equal(respell("خانه‌ها"), "xAnEhA");
  assert.equal(respell("خانه‌ی"), "xAnEye", "a lone ی after ZWNJ is ye");
  assert.equal(respell("کتابِ"), "katAbe", "a kasra at the end of a word is the ezafe");
  assert.equal(respell("خانۀ"), "xAnEye", "ۀ is ه with the ezafe hamza");
  assert.equal(respell("لُطفاً"), "lotfan", "short-vowel marks and tanween are read");
  assert.equal(respell("مدّت"), "maddat", "a shadda doubles the consonant");
});

test("Arabic letter forms, marks and tatweel do not change the sounds or the duration", () => {
  assert.equal(speech("كتاب").dur, speech("کتاب").dur);
  assert.equal(speech("كيف").dur, speech("کیف").dur);
  assert.equal(speech("مدرسة").dur, speech("مدرسه").dur);
  assert.equal(speech("أحمد").dur, speech("احمد").dur);
  assert.equal(speech("سـلام").dur, speech("سلام").dur);
  assert.equal(phonemes("خانه"), "xAnE");
});

test("sayWord: numerals in words, ordinals, percent; normalise folds forms and digits", () => {
  assert.equal(sayWord("۲۱"), "بیست و یک");
  assert.equal(sayWord("٢١"), "بیست و یک");
  assert.equal(sayWord("3م"), "سوم");
  assert.equal(sayWord("50%"), "پنجاه درصد");
  assert.equal(sayWord("۵٪"), "پنج درصد");
  assert.equal(sayWord("۳٫۵"), "سه ممیز پنج");
  assert.equal(sayWord("۱٬۰۰۰"), "هزار");
  assert.equal(lowerFa("ي ك ة أ إ ؤ ۰۱۲ ٣٤٥ تَطْوِيل"), "ی ک ه ا ا و 012 345 تطویل");
  assert.equal(normalise("اِم، ۲ تا نان!"), "دو تا نان");
  assert.equal(normalise("می‌روم"), normalise("میروم"));
});
