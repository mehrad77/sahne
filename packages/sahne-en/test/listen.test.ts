// Say it aloud: normalising a recogniser's transcript and matching it to the card's line, with transcripts
// as Chrome's and Safari's en-GB recognisers write them. Plus the numbers and clock times the story lints read.

import { test } from "node:test";
import assert from "node:assert/strict";
import en, { match, normalise, matchLine, letters, readNumber, readClock, clockMinutes, sayNumber, sayNumeral, sayWord, ordinal } from "../src/index.ts";

test("normalise: lower case, contractions opened, numerals in words, no punctuation or fillers", () => {
  assert.equal(normalise("Hello! I'm Nima."), "hello i am nima");
  assert.equal(normalise("Two loaves, please."), "two loaves please");
  assert.equal(normalise("2 loaves please"), "two loaves please");
  assert.equal(normalise("um, uh, hmm two loaves erm please"), "two loaves please");
  assert.equal(normalise("Isn't it? I can't. We won't."), "is not it i can not we will not");
  assert.equal(normalise("It's Nima's bread, and that's hers."), "it is nima bread and that is hers");
  assert.equal(normalise("It's 10:30"), "it is ten thirty");
  assert.equal(normalise("That's £5"), "that is five pounds");
  assert.equal(normalise("OK"), "ok");
  assert.equal(normalise("Okay, I've got a colour"), "ok i have got a colour");
  assert.equal(normalise("my favorite color"), "my favourite colour");
  assert.equal(normalise("…"), "");
  // um is a filler but umbrella and hum are words
  assert.equal(normalise("an umbrella"), "an umbrella");
});

test("letters: English has no near letters, a different letter is a whole one", () => {
  assert.equal(letters("bread", "bread"), 0);
  assert.equal(letters("bread", "breed"), 1);
  assert.equal(letters("cafe", "café"), 1);
});

test("matchLine: the line as recognisers write it", () => {
  const yes: [string | string[], string][] = [
    ["hello i am nima", "Hello! I'm Nima."],
    ["Hello I'm Nima", "Hello! I'm Nima."],
    ["2 loaves please", "Two loaves, please."],
    ["two loaves please", "2 loaves, please."],
    ["to loaves please", "Two loaves, please."],
    ["uh two loaves um please", "Two loaves, please."],
    ["do you have any milk", "Do you have any milk?"],
    ["i would like a coffee", "I'd like a coffee."],
    ["i am fine thanks", "I'm fine, thanks."],
    ["can not", "Can't."],
    ["what colour is it", "What color is it?"],
    [["wear is the bank", "where is the bank"], "Where is the bank?"],
  ];
  for (const [heard, line] of yes) assert.equal(matchLine(heard, [line]).matched, true, `${heard} → ${line}`);
  const no: [string, string][] = [
    ["i have bread", "I have milk."],
    ["two loaves", "Two loaves, please."],
    ["thank you", "Thank you very much."],
    ["where is the bank", "Where is the station?"],
    ["i like coffee", "I like tea."],
  ];
  for (const [heard, line] of no) assert.equal(matchLine(heard, [line]).matched, false, `${heard} ≠ ${line}`);
});

test("matchLine: not is never forgiven", () => {
  assert.equal(matchLine("there is bread", ["There is no bread."]).matched, false);
  assert.equal(matchLine("there is no bread", ["There is bread."]).matched, false);
  assert.equal(matchLine("i do not like it", ["I like it."]).matched, false);
  assert.equal(matchLine("i don't like it", ["I do not like it."]).matched, true);
  assert.equal(matchLine("we have no milk", ["We have milk.", "We have no milk."]).best, 1, "the line that agrees on not wins");
  assert.equal(matchLine("we have milk", ["We have no milk.", "We have milk."]).best, 1);
});

test("matchLine: the closest of several lines wins, and names stand for any word", () => {
  const lines = ["Two loaves, please.", "Two rolls, please."];
  assert.equal(matchLine("two rolls please", lines).best, 1);
  assert.equal(matchLine("two loaves please", lines).best, 0);
  assert.equal(matchLine("Lima has bread", ["Nima has bread."]).matched, true, "one slipped letter in a long line is forgiven");
  assert.equal(matchLine("Sara has bread", ["Nima has bread."]).matched, false);
  assert.equal(matchLine("Sara has bread", ["Nima has bread."], { names: ["Nima"] }).matched, true);
  assert.equal(matchLine("has bread", ["Nima has bread."], { names: ["Nima"] }).matched, true, "a name left out costs one letter, within the allowance");
  assert.equal(matchLine("", ["Hello."]).matched, false);
  assert.equal(matchLine("hello there", ["Hello."]).matched, false, "a word more than the line is not forgiven");
});

test("matchLine: joins and splits", () => {
  assert.equal(matchLine("thankyou very much", ["Thank you very much."]).matched, true);
  assert.equal(matchLine("ice cream please", ["Icecream, please."]).matched, true);
  assert.equal(matchLine("every one is here", ["Everyone is here."]).matched, true);
});

test("the plugin hands the engine its matcher", () => {
  assert.equal(en.normalise!("It's OK"), "it is ok");
  assert.equal(en.matchLine!("two loaves please", ["Two loaves, please."]).matched, true);
});

test("numbers: said and read", () => {
  const say: [number, string][] = [[0, "zero"], [5, "five"], [13, "thirteen"], [21, "twenty one"], [100, "one hundred"], [105, "one hundred and five"], [999, "nine hundred and ninety nine"],
    [1000, "one thousand"], [1005, "one thousand and five"], [1990, "one thousand nine hundred and ninety"], [2100, "two thousand one hundred"], [12000, "twelve thousand"], [1000000, "one million"], [-3, "minus three"]];
  for (const [n, w] of say) assert.equal(sayNumber(n), w);
  const read = (s: string) => readNumber(s.split(" "), 0);
  assert.deepEqual(read("two loaves"), { n: 2, len: 1 });
  assert.deepEqual(read("twenty one loaves"), { n: 21, len: 2 });
  assert.deepEqual(read("one hundred and five loaves"), { n: 105, len: 4 });
  assert.deepEqual(read("a hundred"), { n: 100, len: 2 });
  assert.deepEqual(read("two thousand and ten"), { n: 2010, len: 4 });
  assert.deepEqual(read("fifteen"), { n: 15, len: 1 });
  assert.deepEqual(read("12 loaves"), { n: 12, len: 1 });
  assert.deepEqual(read("1,000 loaves"), { n: 1000, len: 1 });
  assert.deepEqual(read("two three"), { n: 2, len: 1 }, "two numbers side by side are two numbers");
  assert.deepEqual(read("twenty twenty"), { n: 20, len: 1 });
  assert.equal(read("a loaf"), null, "a is an article");
  assert.equal(read("and five"), null);
  assert.equal(read("bread"), null);
  assert.deepEqual(read("one and"), { n: 1, len: 1 }, "an and left hanging is not part of it");
  for (const n of [0, 7, 16, 40, 99, 101, 342, 2024, 70000]) assert.equal(readNumber(sayNumber(n).split(" "), 0)?.n, n, String(n));
});

test("numerals as written: thousands, decimals, clock times, percent, ordinals", () => {
  assert.equal(sayNumeral("1,000"), "one thousand");
  assert.equal(sayNumeral("3.5"), "three point five");
  assert.equal(sayNumeral("10:30"), "ten thirty");
  assert.equal(sayNumeral("9:05"), "nine oh five");
  assert.equal(sayNumeral("4:00"), "four o clock");
  assert.equal(normalise("4:00"), normalise("four o'clock"));
  assert.equal(sayNumeral("50%"), "fifty percent");
  assert.equal(sayNumeral("05"), "zero five");
  assert.equal(ordinal("two"), "second");
  assert.equal(ordinal("twenty one"), "twenty first");
  assert.equal(ordinal("forty"), "fortieth");
  assert.equal(ordinal("twelve"), "twelfth");
  assert.equal(sayWord("1st"), "first");
  assert.equal(sayWord("22nd"), "twenty second");
  assert.equal(sayWord("1990"), "nineteen ninety", "a year");
  assert.equal(sayWord("199"), "one hundred and ninety nine");
  assert.equal(sayWord("Mr"), "mister");
  assert.equal(sayWord("well-known"), "well known");
});

test("clock times: o'clock, past and to, digits", () => {
  const clock = (s: string) => readClock(s).map(t => `${t.h}:${String(t.m).padStart(2, "0")}`);
  assert.deepEqual(clock("It's ten o'clock."), ["10:00"]);
  assert.deepEqual(clock("Half past three."), ["3:30"]);
  assert.deepEqual(clock("Quarter past nine."), ["9:15"]);
  assert.deepEqual(clock("Quarter to ten."), ["9:45"]);
  assert.deepEqual(clock("Quarter to one."), ["12:45"]);
  assert.deepEqual(clock("Twenty five past two."), ["2:25"]);
  assert.deepEqual(clock("Ten to twelve."), ["11:50"]);
  assert.deepEqual(clock("It's twenty to six"), ["5:40"]);
  assert.deepEqual(clock("Half two"), ["2:30"], "British half two");
  assert.deepEqual(clock("It's 10:30"), ["10:30"]);
  assert.deepEqual(clock("The train is at 9.45"), ["9:45"]);
  assert.deepEqual(clock("It's three fifteen"), ["3:15"]);
  assert.deepEqual(clock("At seven oh five"), ["7:05"]);
  assert.deepEqual(clock("Two loaves, please."), [], "a number is no time");
  assert.deepEqual(clock("I go to school at home."), []);
  assert.deepEqual(clock("Two to three loaves"), [], "two to three is not a time");
  assert.deepEqual(clock("Half a loaf."), []);
  assert.equal(clockMinutes("10:10"), 10 * 60 + 10);
  assert.equal(clockMinutes("12:00"), 0);
  assert.equal(clockMinutes({ h: 3, m: 30 }), 210);
  assert.equal(clockMinutes("noon"), null);
});

test("prices are said with their minor unit, and matched as said", () => {
  assert.equal(sayWord("£5.50"), "five pounds fifty");
  assert.equal(sayWord("£1"), "one pound");
  assert.equal(sayWord("£0.50"), "fifty pence");
  assert.equal(sayWord("$3.50"), "three dollars fifty");
  assert.equal(normalise("It costs £5.50"), "it costs five pounds fifty");
  assert.equal(matchLine("five pounds fifty", ["It costs £5.50"]).matched, false, "the card has more words");
  assert.equal(matchLine("it costs five pounds fifty", ["It costs £5.50"]).matched, true);
  assert.equal(matchLine("it costs one pound", ["It costs £1"]).matched, true);
  assert.equal(matchLine("that is £5.50", ["That's five pounds fifty."]).matched, true);
});

test("clock times: a decimal or a price is no time; noon and midnight are", () => {
  const clock = (s: string) => readClock(s).map(t => `${t.h}:${String(t.m).padStart(2, "0")}`);
  assert.deepEqual(clock("It costs 3.50"), []);
  assert.deepEqual(clock("Version 2.10"), []);
  assert.deepEqual(clock("It's £5.50"), []);
  assert.deepEqual(clock("It's 3.50pm"), ["15:50"]);
  assert.deepEqual(clock("The train is at 9.45"), ["9:45"]);
  assert.deepEqual(clock("It's 10:30 and half past four"), ["10:30", "4:30"], "a digit time does not hide a worded one");
  assert.deepEqual(clock("Ten past noon"), ["12:10"]);
  assert.deepEqual(clock("Quarter past midnight"), ["0:15"]);
  assert.deepEqual(clock("Quarter to midnight"), ["23:45"]);
  assert.deepEqual(clock("At noon"), ["12:00"]);
  assert.deepEqual(clock("It's midnight"), ["0:00"]);
  assert.deepEqual(clock("12am"), []);
  assert.deepEqual(clock("12:05am"), ["0:05"]);
});

test("matchLine: the input is bounded", () => {
  const long = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(" ");
  const t = performance.now();
  assert.equal(matchLine(long, [long]).matched, false);
  assert.equal(matchLine(long, ["Hello there."]).matched, false);
  assert.equal(matchLine(Array.from({ length: 50 }, () => long), ["Hello there."]).matched, false);
  assert.ok(performance.now() - t < 1000, "refused fast (it took half a minute unbounded; the margin is for a busy machine)");
});

test("matchLine: a line the learner finishes at rest, a repeated word is not two", () => {
  assert.equal(matchLine("hello hello", ["Hello."]).matched, false);
  assert.equal(matchLine("  ", ["Hello."]).matched, false);
  assert.equal(matchLine("Hello", ["Hello."]).score, 1);
});

test("known misses: forms the plugin does not know are not forms", () => {
  assert.equal(match("baker", "bake"), false, "a derived word is another word");
  assert.equal(match("bakery", "bake"), false);
  assert.equal(match("mice", "mouse"), true);
  assert.equal(match("geese", "goose"), true);
  assert.equal(match("bigger", "big"), false, "comparatives are not covered");
  assert.equal(match("happily", "happy"), false);
  assert.equal(match("brought", "bring"), true);
  assert.equal(match("catches", "catch"), true);
});
