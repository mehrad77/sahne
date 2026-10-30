// Tests of the Persian plugin's word matching, numbers, clock times and say-it-aloud matching. Every language
// rule here wants a native speaker's check; the known misses are tests too, so a change to them is on purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import fa, { match, deixis, placeDeixis, isNear, sayNumber, sayNumeral, sayDigits, ordinal, readNumber, readClock, clockMinutes, normalise, matchLine, sayWords, letters, allowance } from "../src/index.ts";

test("match: the plural, the indefinite and ezafe ی, the possessives and the copula, with or without ZWNJ", () => {
  const yes = (w: string, t: string) => assert.ok(match(w, t), `${w} ← ${t}`);
  const no = (w: string, t: string) => assert.ok(!match(w, t), `${w} is no form of ${t}`);
  yes("نان", "نان");
  for (const w of ["نان‌ها", "نانها", "نان ها".replace(" ", ""), "نانا"]) yes(w, "نان");
  for (const w of ["نانی", "نان‌های", "نان‌هایی", "نانم", "نانت", "نانش", "نانمان", "نانتان", "نانشان", "نان‌هایم", "نان‌هایش", "نان‌هاست", "نانه", "نانست"]) yes(w, "نان");
  yes("دوستان", "دوست"); yes("دوستانم", "دوست"); yes("دوستم", "دوست");
  // a silent ه: خانه takes ای / اش / ام after a ZWNJ, and ها; بچه → بچگان; کلمه → کلمات
  for (const w of ["خانه‌ها", "خانه‌ای", "خانه‌ی", "خانه‌ام", "خانه‌ات", "خانه‌اش", "خانه‌مان", "خانه‌است", "خانه‌هایمان"]) yes(w, "خانه");
  yes("بچگان", "بچه"); yes("بچه‌ها", "بچه"); yes("کلمات", "کلمه");
  // a vowel: جا → جایی, جای, جایم; آقا → آقایان; بابا → بابام
  yes("جایی", "جا"); yes("جای", "جا"); yes("جایم", "جا"); yes("آقایان", "آقا"); yes("بابام", "بابا"); yes("موها", "مو"); yes("موهایم", "مو");
  // the Arabic letter forms and the marks do not matter, nor do punctuation and case around the word
  yes("کتاب‌ها،", "كتاب"); yes("«نانِ»", "نان"); yes("خانۀ", "خانه");
  // a token of two words: the last one takes the endings, or the two run together
  yes("بربری‌ها", "نان بربری"); yes("نانبربری", "نان بربری");
  // other words are other words
  no("نانوایی", "نان"); no("نامه", "نان"); no("مان", "ما"); no("شیر", "نان"); no("", "نان"); no("نان", "");
});

test("match: known misses are documented (verbs, broken plurals, the object marker, را)", () => {
  assert.ok(!match("می‌خرم", "خریدن"), "verbs are not forms of the infinitive");
  assert.ok(!match("کتب", "کتاب"), "the Arabic broken plural");
  assert.ok(!match("نونو", "نان"), "the colloquial object marker run on to the noun");
  assert.ok(!match("را", "نان"), "را is a separate word, not a form");
});

test("deixis: این / آن (اون), their plurals, and اینجا / آنجا", () => {
  assert.equal(deixis("این"), "this"); assert.equal(deixis("همین"), "this");
  assert.equal(deixis("اینها"), "these"); assert.equal(deixis("اینا"), "these");
  assert.equal(deixis("آن"), "that"); assert.equal(deixis("اون"), "that"); assert.equal(deixis("همان"), "that");
  assert.equal(deixis("آنها"), "those"); assert.equal(deixis("اونا"), "those");
  assert.equal(deixis("نان"), null); assert.equal(deixis("اینجا"), null);
  assert.equal(placeDeixis("اینجا"), "here"); assert.equal(placeDeixis("اونجا"), "there"); assert.equal(placeDeixis("آنجا"), "there");
  assert.equal(placeDeixis("این"), null);
  assert.ok(isNear("this") && isNear("these") && isNear("here") && !isNear("that") && !isNear("those") && !isNear("there"));
});

test("sayNumber: the Persian numbers, joined by و", () => {
  const want: [number, string][] = [
    [0, "صفر"], [1, "یک"], [9, "نه"], [10, "ده"], [11, "یازده"], [15, "پانزده"], [19, "نوزده"], [20, "بیست"], [21, "بیست و یک"], [30, "سی"], [99, "نود و نه"],
    [100, "صد"], [105, "صد و پنج"], [200, "دویست"], [300, "سیصد"], [500, "پانصد"], [600, "ششصد"], [900, "نهصد"], [999, "نهصد و نود و نه"],
    [1000, "هزار"], [1001, "هزار و یک"], [1990, "هزار و نهصد و نود"], [2000, "دو هزار"], [2105, "دو هزار و صد و پنج"], [21000, "بیست و یک هزار"],
    [1e6, "یک میلیون"], [3e6 + 5, "سه میلیون و پنج"], [1e9, "یک میلیارد"], [-4, "منفی چهار"],
  ];
  for (const [n, w] of want) assert.equal(sayNumber(n), w, String(n));
  assert.equal(sayNumber(NaN), "");
  assert.equal(sayDigits("0532"), "صفر پنج سه دو");
});

test("sayNumeral: digits as written, a clock time, a decimal, thousands, percent, ordinals", () => {
  assert.equal(sayNumeral("15"), "پانزده");
  assert.equal(sayNumeral("1,000"), "هزار");
  assert.equal(sayNumeral("3.5"), "سه ممیز پنج");
  assert.equal(sayNumeral("0.05"), "صفر ممیز صفر پنج");
  assert.equal(sayNumeral("10:30"), "ده و سی");
  assert.equal(sayNumeral("4:00"), "چهار");
  assert.equal(sayNumeral("50%"), "پنجاه درصد");
  assert.equal(sayNumeral("05"), "صفر پنج");
  assert.equal(sayNumeral("1", true), "اول");
  assert.equal(sayNumeral("3", true), "سوم");
  assert.equal(sayNumeral("5", true), "پنجم");
  assert.equal(sayNumeral("21", true), "بیست و یکم");
  assert.equal(sayNumeral("30", true), "سیام");
  assert.equal(ordinal("نود و نه"), "نود و نهم");
});

test("readNumber: Persian number words and digits, the counter تا, and نه as nine or no", () => {
  const read = (s: string) => readNumber(s.split(" "), 0);
  assert.deepEqual(read("سه"), { n: 3, len: 1 });
  assert.deepEqual(read("بیست و یک نان"), { n: 21, len: 3 });
  assert.deepEqual(read("صد و پنج"), { n: 105, len: 3 });
  assert.deepEqual(read("دو هزار و پانصد"), { n: 2500, len: 4 });
  assert.deepEqual(read("هزار و نهصد و نود"), { n: 1990, len: 5 });
  assert.deepEqual(read("سه میلیون و پنج"), { n: 3000005, len: 4 });
  assert.deepEqual(read("3"), { n: 3, len: 1 });
  assert.deepEqual(read("1,000"), { n: 1000, len: 1 });
  assert.deepEqual(read("صفر"), { n: 0, len: 1 });
  assert.deepEqual(read("یه"), { n: 1, len: 1 }, "colloquial یه is one");
  assert.deepEqual(read("دوتا"), { n: 2, len: 1 }, "the counter joined on");
  assert.deepEqual(read("دو تا"), { n: 2, len: 1 }, "the counter stands apart");
  assert.deepEqual(read("دو سه"), { n: 2, len: 1 }, "two numbers, not twenty-three");
  assert.deepEqual(read("بیست یک"), { n: 20, len: 1 }, "a ones word without و is another number");
  assert.equal(read("و بیست"), null);
  assert.equal(read("نان"), null);
  // نه: no, or nine
  assert.equal(read("نه"), null, "a lone نه is no");
  assert.equal(read("نه شیر"), null, "نه before a noun is no");
  assert.deepEqual(read("نه تا نان"), { n: 9, len: 1 }, "before a counter it is nine");
  assert.deepEqual(read("بیست و نه"), { n: 29, len: 3 }, "inside a number it is nine");
  assert.deepEqual(readNumber(["من", "بیست", "و", "دو"], 1), { n: 22, len: 3 });
});

test("readClock: ساعت, و نیم / ربع, ربع / دقیقه + به, گذشته, digits", () => {
  const t = (s: string) => readClock(s);
  assert.deepEqual(t("ساعت سه است."), [{ h: 3, m: 0 }]);
  assert.deepEqual(t("ساعت سه و نیم است."), [{ h: 3, m: 30 }]);
  assert.deepEqual(t("ساعت چهار و ربع"), [{ h: 4, m: 15 }]);
  assert.deepEqual(t("ساعت سه و ده دقیقه"), [{ h: 3, m: 10 }]);
  assert.deepEqual(t("ساعت سه و بیست و پنج دقیقه"), [{ h: 3, m: 25 }]);
  assert.deepEqual(t("ساعت ۱۰:۳۰"), [{ h: 10, m: 30 }]);
  assert.deepEqual(t("ساعت ۱۰"), [{ h: 10, m: 0 }]);
  assert.deepEqual(t("ساعت 9.45"), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("سه و نیم."), [{ h: 3, m: 30 }]);
  assert.deepEqual(t("یه ربع به ده"), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("ربع به ده"), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("ربع کم ده"), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("ده دقیقه به هفت"), [{ h: 6, m: 50 }]);
  assert.deepEqual(t("بیست و پنج دقیقه به هفت"), [{ h: 6, m: 35 }]);
  assert.deepEqual(t("ده دقیقه به یک"), [{ h: 12, m: 50 }]);
  assert.deepEqual(t("ده دقیقه از سه گذشته"), [{ h: 3, m: 10 }]);
  assert.deepEqual(t("ساعت ده دقیقه به هفت"), [{ h: 6, m: 50 }], "ساعت before the minutes does not make it ten o'clock");
  assert.deepEqual(t("ساعت یک ربع به ده"), [{ h: 9, m: 45 }]);
  assert.deepEqual(t("ساعت سه، ساعت پنج و نیم"), [{ h: 3, m: 0 }, { h: 5, m: 30 }]);
  // not times
  assert.deepEqual(t("دو تا نان"), []);
  assert.deepEqual(t("سه و نیم کیلو نان"), [], "three and a half kilos");
  assert.deepEqual(t("سه و نیم تا نان"), []);
  assert.deepEqual(t("قیمت ۳.۵۰ تومان است"), [], "a price");
  assert.deepEqual(t("نسخه 2.10"), []);
  assert.deepEqual(t("پنج دقیقه راه است"), []);
});

test("clockMinutes: a prop's time on a 12-hour face, in Latin or Persian digits", () => {
  assert.equal(clockMinutes("10:10"), 10 * 60 + 10);
  assert.equal(clockMinutes("۳:۳۰"), 3 * 60 + 30);
  assert.equal(clockMinutes("12:00"), 0);
  assert.equal(clockMinutes({ h: 15, m: 30 }), 3 * 60 + 30);
  assert.equal(clockMinutes("ten"), null);
});

test("normalise: Arabic forms folded to Persian, harakat, tatweel and ZWNJ gone, digits and numerals as words, fillers and punctuation dropped", () => {
  assert.equal(normalise("دو تا نان، لطفاً."), "دو تا نان لطفا");
  assert.equal(normalise("اِم... ۲ تا نان؟"), "دو تا نان");
  assert.equal(normalise("٢ تا نان"), "دو تا نان", "Arabic-Indic digits");
  assert.equal(normalise("21 نفر"), "بیست و یک نفر");
  assert.equal(normalise("كتاب‌ي"), "کتابی", "ك ي → ک ی, ZWNJ gone");
  assert.equal(normalise("مدرسة"), "مدرسه");
  assert.equal(normalise("أحمد إبراهيم"), "احمد ابراهیم");
  assert.equal(normalise("تَطْوِيل"), "تطویل");
  assert.equal(normalise("سـلام"), "سلام", "tatweel");
  assert.equal(normalise("ممم هوم اوم بله"), "بله", "fillers");
  assert.equal(normalise("خب، دو تا نان"), "خب دو تا نان", "خب is a word");
  assert.equal(normalise("نون اون یه نان"), "نان آن یک نان", "colloquial spellings");
  assert.deepEqual(sayWords("«نان» و شیر!"), ["نان", "و", "شیر"]);
  assert.equal(normalise("نان 50% ارزان"), "نان پنجاه درصد ارزان");
});

test("letters and the allowance: near letters cost a quarter, the rest a whole letter", () => {
  assert.equal(letters("سلام", "صلام"), 0.25, "س ص");
  assert.equal(letters("زمان", "ذمان"), 0.25, "ز ذ");
  assert.equal(letters("زمان", "ظمان"), 0.25, "ز ظ");
  assert.equal(letters("ضرب", "زرب"), 0.25, "ض ز");
  assert.equal(letters("تب", "طب"), 0.25, "ت ط");
  assert.equal(letters("هال", "حال"), 0.25, "ه ح");
  assert.equal(letters("قلب", "غلب"), 0.25, "ق غ");
  assert.equal(letters("عمیق", "امیق"), 0.25, "ع ا: near anywhere in a word");
  assert.equal(letters("عمیق", "آمیق"), 0.25, "ع آ");
  assert.equal(letters("نان", "بان"), 1, "ن ب are not near");
  assert.equal(allowance(3), 0.5);
  assert.ok(allowance(20) >= 1);
});

test("matchLine: transcript digits, Arabic forms, a filler, colloquial spellings, and the closest line within its allowance", () => {
  const expected = ["دو تا نان، لطفاً.", "دو تا نان بدهید."];
  assert.deepEqual(matchLine("دو تا نان لطفا", expected), { matched: true, best: 0, heard: "دو تا نان لطفا", score: 1 });
  assert.equal(matchLine("2 تا نون لطفا", expected).best, 0, "digits and the colloquial نون");
  assert.equal(matchLine("۲ تا نان لطفا", expected).best, 0, "Persian digits");
  assert.equal(matchLine("اِم دو تا نان لطفا", expected).best, 0, "a filler");
  assert.equal(matchLine("دو تا نون بدین", expected).best, 1, "نون بدین is the second line, not the first");
  assert.equal(matchLine("دو تا نان بدید", expected).best, 1);
  assert.equal(matchLine("دو تا نان لطفأ", expected).best, 0, "أ for ا");
  assert.equal(matchLine("دو تا ناں لطفاً", expected).matched, true, "a stray mark");
  assert.equal(matchLine("دو تا نان لطفا", ["دو تا نان لطفاً."]).matched, true);
  assert.equal(matchLine("دو تا شیر لطفا", expected).matched, false, "another word is no match");
  assert.equal(matchLine("", expected).matched, false);
  assert.equal(matchLine(["چیزی نیست", "دو تا نان لطفا"], expected).best, 0, "any n-best alternative");
  // the near letters: a recogniser's س for ص, ز for ذ, ت for ط
  assert.equal(matchLine("صلام آقا", ["سلام آقا"]).matched, true);
  assert.equal(matchLine("سلام آقا", ["صلام آقا"]).matched, true);
  assert.equal(matchLine("زکر", ["ذکر"]).matched, true);
  assert.equal(matchLine("طبیعت", ["تبیعت"]).matched, true);
  assert.equal(matchLine("حوب", ["هوب"]).matched, true);
  assert.equal(matchLine("قلب", ["غلب"]).matched, true);
  assert.equal(matchLine("عمیق", ["امیق"]).matched, true);
  // names, split and run-together words
  assert.equal(matchLine("سلام ن ا", ["سلام نیما"], { names: ["نیما"] }).matched, true, "a name the recogniser could not spell");
  assert.equal(matchLine("می روم", ["می‌روم"]).matched, true, "a split word");
  assert.equal(matchLine("میروم", ["می‌روم"]).matched, true);
  assert.equal(matchLine("نان ها", ["نان‌ها"]).matched, true);
});

test("matchLine: a line with negation never passes for one without (and the reverse)", () => {
  assert.equal(matchLine("نان داریم", ["نان نداریم."]).matched, false, "داریم is not نداریم");
  assert.equal(matchLine("نان نداریم", ["نان داریم."]).matched, false);
  assert.equal(matchLine("نان هست", ["نان نیست."]).matched, false);
  assert.equal(matchLine("نان نیست", ["نان هست."]).matched, false);
  assert.equal(matchLine("نان نداریم", ["نان داریم.", "نان نداریم."]).best, 1, "the line that agrees on not");
  assert.equal(matchLine("نان داریم", ["نان داریم؟", "نان نداریم."]).best, 0);
  assert.equal(matchLine("می‌خواهم", ["نمی‌خواهم."]).matched, false);
  assert.equal(matchLine("نان نمی‌خواهم", ["نان نمی‌خواهم."]).matched, true);
  assert.equal(matchLine("هیچ نانی نیست", ["هیچ نانی نیست."]).matched, true);
  // ن at the start of a word is no negation: نان, نمک
  assert.equal(matchLine("نان و نمک", ["نان و نمک."]).matched, true);
  assert.equal(matchLine("نمک", ["نان."]).matched, false);
});

test("matchLine: خب before the line is dropped unless the card's line starts with it", () => {
  assert.equal(matchLine("خب دو تا نان لطفا", ["دو تا نان لطفاً."]).matched, true);
  assert.equal(matchLine("خب بفرمایید", ["خب، بفرمایید."]).matched, true);
  assert.equal(matchLine("بفرمایید", ["خب، بفرمایید."]).matched, false, "a word the card has is a word the learner must say");
  assert.equal(matchLine("خب", ["دو تا نان."]).matched, false);
});

test("matchLine: the bound of the shared matcher holds (a long transcript is no match)", () => {
  const long = Array.from({ length: 60 }, () => "نان").join(" ");
  const t0 = performance.now();
  assert.equal(matchLine(long, [long]).matched, false);
  assert.ok(performance.now() - t0 < 500);
  assert.equal(fa.matchLine?.("دو تا نان", ["دو تا نان"]).matched, true);
  assert.equal(fa.normalise?.("۲ تا نان"), "دو تا نان");
});
