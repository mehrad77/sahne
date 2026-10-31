// Tests of the English plugin's mouth timing: the contract every plugin keeps, the spelling rules'
// syllable counts, the labials and the glides.
import { test } from "node:test";
import assert from "node:assert/strict";
import en, { speech, respell, phonemes, syllables, sayWord, normalise, TIMING } from "../src/index.ts";
import type { Speech } from "sahne";

const SHAPES = new Set(["rest", "MBP", "A", "E", "I", "O", "U", "FV"]);

/** A baker's-shop scene: lines and their length at rate 1 (ms). */
const SCENE: [string, number][] = [
  ["Hello! Welcome.", 1710],
  ["Have you got any bread?", 2020],
  ["Two loaves, please.", 1530],
  ["Sorry, we don't have milk.", 2220],
  ["What time is it?", 1500],
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

test("the scene's lines are well formed and last as long as the table says", () => {
  for (const [text, dur] of SCENE) {
    const sp = speech(text);
    wellFormed(text, sp);
    assert.equal(sp.dur, dur, text);
  }
});

test("words keep their indices in the original text, and punctuation is never a word", () => {
  const sp = speech("Two loaves, please.");
  assert.deepEqual(sp.words.map(w => [w.text, w.i]), [["Two", 0], ["loaves", 4], ["please", 12]]);
  assert.deepEqual(speech("Don't you know?").words.map(w => w.text), ["Don't", "you", "know"]);
});

test("pauses: comma 250, stop 450, ellipsis 600, and several marks are one pause, the longest", () => {
  const word = speech("Yes").dur;
  assert.equal(speech("Yes, yes").dur - 2 * word, TIMING.comma);
  assert.equal(speech("Yes. Yes").dur - 2 * word, TIMING.stop);
  assert.equal(speech("Yes… yes").dur - 2 * word, TIMING.ellipsis);
  assert.equal(speech("Yes?! Yes").dur, speech("Yes! Yes").dur);
  assert.equal(speech("Yes.").dur, word + TIMING.stop, "a closing pause adds to dur");
});

test("rate divides every time; voice does not change the timing", () => {
  const a = speech("Two loaves, please."), b = speech("Two loaves, please.", { rate: 2 });
  assert.equal(b.dur, Math.round(a.dur / 2));
  assert.deepEqual(speech("Two loaves, please.", { voice: "whisper" }), a);
  assert.equal(speech("Yes", { rate: 0 }).dur, speech("Yes").dur, "a bad rate is 1");
});

test("the silent card, an empty line and a hum", () => {
  assert.deepEqual(speech("…").keys, [{ t: 0, v: "rest" }]);
  assert.equal(speech("…").dur, TIMING.silent);
  assert.deepEqual(speech("").words, []);
  const hm = speech("Hmm.");
  wellFormed("Hmm.", hm);
  assert.equal(hm.keys[0].v, "MBP");
  assert.equal(speech("Shh!").keys[0].v, "U", "a shush rounds the lips");
});

test("labials: m b p close the lips, f v touch the teeth", () => {
  const shapes = (t: string) => speech(t).keys.map(k => k.v);
  assert.ok(shapes("map").includes("MBP"));
  assert.ok(shapes("bread").includes("MBP"));
  assert.ok(shapes("five").includes("FV"));
  assert.ok(shapes("photo").includes("FV"), "ph is f");
  assert.ok(!shapes("tea").includes("MBP"));
});

test("a gliding vowel moves through two shapes inside its syllable", () => {
  // eye: A then I; cow: A then U; go: O then U
  assert.deepEqual(speech("eye").keys.map(k => k.v), ["A", "I", "rest"]);
  assert.deepEqual(speech("now").keys.map(k => k.v), ["A", "U", "rest"]);
  const go = speech("go");
  assert.deepEqual(go.keys.map(k => k.v), ["O", "U", "rest"]);
  assert.ok(go.keys[1].t > 0 && go.keys[1].t < go.dur);
});

test("an unstressed schwa is shorter than a full syllable", () => {
  assert.ok(speech("water").dur < speech("window").dur, "water ends in a schwa");
  assert.equal(speech("a").dur, TIMING.schwa);
});

test("numbers are timed as their English words, the span covers the digits", () => {
  const sp = speech("It costs 15.");
  assert.deepEqual(sp.words.map(w => w.text), ["It", "costs", "15"]);
  assert.equal(speech("15").dur, speech("fifteen").dur);
  assert.equal(speech("10:30").words.length, 1);
  assert.equal(speech("10:30").dur, syllables(phonemes("ten thirty")).length * TIMING.syllable);
  assert.equal(speech("2nd").dur, speech("second").dur);
});

test("a word in another script is timed by its length, and TV is spelled", () => {
  const sp = speech("سلام");
  wellFormed("سلام", sp);
  assert.ok(sp.dur > 200);
  assert.equal(speech("TV").dur, speech("tee vee").dur - TIMING.gap, "two words in one span");
});

// How many vowels the spelling rules find in a word: its syllables.
const SYLLABLES: Record<string, number> = {
  bread:1, milk:1, hello:2, please:1, thank:1, thanks:1, water:2, table:2, little:2, apple:2, apples:2, bottle:2, make:1, makes:1, making:2, running:2, hoping:2, hopping:2, walked:1, wanted:2, played:1, loved:1, boxes:2, churches:2, watches:2,
  baker:2, bakery:3, banana:3, tomato:3, potato:3, orange:2, coffee:2, tea:1, cheese:1, butter:2, sandwich:2, chicken:2, morning:2, afternoon:3, tonight:2, yesterday:3, today:2, tomorrow:3,
  family:3, beautiful:3, different:3, important:3, understand:3, remember:3, favourite:3, vegetable:4, restaurant:3, library:3, hospital:3, station:2, ticket:2, passport:2, umbrella:3, kitchen:2, bedroom:2, garden:2, window:2, door:1,
  cake:1, cakes:1, house:1, houses:2, mouse:1, mice:1, nice:1, nine:1, five:1, eight:1, twenty:2, thirty:2, forty:2, hundred:2, thousand:2, seventeen:3, eleven:3, twelve:1, thirteen:2, sixteen:2,
  nature:2, station:2, question:2, delicious:3, famous:2, serious:3, lovely:2, movement:2, careless:2, safety:2, quiet:2, science:2, idea:3, video:3, radio:3, music:2, student:2, cute:1, huge:1, bridge:1, edge:1,
  fly:1, my:1, try:1, tried:1, cry:1, happy:2, baby:2, monkey:2, money:2, they:1, grey:1, cookie:2, movie:2, pie:1, flying:2, gym:1, myth:1, yes:1, you:1, young:1,
  night:1, light:1, high:1, through:1, thought:1, enough:2, laugh:1, knife:1, know:1, write:1, wrong:1, lamb:1, comb:1, climb:1, island:2, listen:2, castle:2, whistle:2, talk:1, walk:1, ball:1, small:1, call:1,
  thing:1, sing:1, singer:2, finger:2, change:1, strange:1, danger:2, teacher:2, doctor:2, sugar:2, dollar:2, mother:2, brother:2, other:2, sorry:2, story:2, carry:2, very:2, four:1, door:1, floor:1,
  cat:1, dog:1, bird:1, girl:1, turn:1, burn:1, learn:1, work:1, world:1, word:1, first:1, third:1, birthday:2, shirt:1, skirt:1, purple:2, circle:2, simple:2, people:2, trouble:2, double:2,
  coat:1, boat:1, road:1, toe:1, goes:1, tomatoes:3, school:1, moon:1, cool:1, food:1, good:1, book:1, book:1, boy:1, toy:1, toys:1, coin:1, noise:1, cow:1, now:1, how:1, brown:1, down:1, town:1, snow:1, yellow:2, flower:2, power:2, our:1, hour:1, out:1, about:2, found:1, round:1, ground:1,
  say:1, day:1, play:1, rain:1, train:1, wait:1, eight:1, weigh:1, neighbour:2, break:1, great:1, steak:1, read:1, bean:1, team:1, meat:1, eat:1, sea:1, tea:1, head:1, ready:2, heavy:2, weather:2, 
  ice:1, cream:1, pizza:2, burger:2, salad:2, soup:1, juice:1, fruit:1, apple:2, grape:1, grapes:1, bun:1, buns:1, loaf:1, loaves:1, cookies:2, sandwiches:3, glasses:2, kisses:2,
  one:1, two:1, three:1, four:1, six:1, seven:2, ten:1, zero:2, first:1, second:2, fourth:1, fifth:1, ninth:1, o:1, ok:2, okay:2, mm:0, 
};

test("the spelling rules count the syllables of common words", () => {
  const bad: string[] = [];
  for (const [w, n] of Object.entries(SYLLABLES)) {
    const got = syllables(phonemes(w)).length;
    if (got !== n) bad.push(`${w} ${respell(w)}: ${got}, want ${n}`);
  }
  assert.deepEqual(bad, []);
});

test("silent final e, -ed, -es, -le and the magic e", () => {
  assert.equal(respell("make"), "mQk");
  assert.equal(respell("table"), "tQb@l");
  assert.equal(respell("walked"), "wolkd");
  assert.equal(respell("wanted"), "wontid");
  assert.equal(syllables(respell("boxes")).length, 2);
  assert.equal(syllables(respell("cats")).length, 1);
  assert.equal(respell("making"), "mQkin");
  assert.equal(respell("hopping"), "hopin");
});

test("the plugin carries the recogniser's locale", () => {
  assert.equal(en.id, "en");
  assert.equal(en.locale, "en-GB");
  assert.equal(typeof en.speech, "function");
});

test("a word with a y and no other vowel is a word, not an initialism (my, by, why, try, gym)", () => {
  for (const w of ["my", "by", "why", "try", "sky", "dry", "cry", "fly", "gym"]) {
    assert.equal(sayWord(w), w, w);
    assert.equal(normalise(w), w, w);
    const sp = speech(w);
    assert.ok(sp.dur < 350, `${w} lasts ${sp.dur} ms, one syllable`);
    assert.equal(sp.words.length, 1);
  }
  assert.equal(normalise("my favourite colour"), "my favourite colour");
  // the real initialisms are still spelled
  assert.equal(sayWord("TV"), "tee vee");
  assert.equal(sayWord("PM"), "pee em");
  assert.ok(speech("BBC").dur > speech("my").dur * 2);
});
