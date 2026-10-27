// The speech clock: the stage's time while a voice speaks (audio/clock.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SpeechClock } from "../src/audio/clock.ts";
import { speechFallback } from "../src/core/lang.ts";

const sp = speechFallback("Ekmek var. Şu ekmek çok taze.");
const mk = () => new SpeechClock(1000, sp.words, sp.dur);

test("it waits at the line's start until the voice starts", () => {
  const c = mk();
  assert.equal(c.at(0), 1000); assert.equal(c.at(5000), 1000);
  assert.ok(c.waiting);
  c.start(5000);
  assert.equal(c.at(5000), 1000);
  assert.equal(c.at(5100), 1100);
});

test("without word marks it runs at the estimate's pace and waits at the end for the voice", () => {
  const c = mk();
  c.start(0);
  assert.equal(c.at(sp.dur + 2000), 1000 + sp.dur, "held at the line's end");
  c.end(sp.dur + 2500);
  assert.equal(c.at(sp.dur + 2600), 1000 + sp.dur);
});

test("a voice ahead of the estimate: the clock jumps forward to each word it reaches", () => {
  const c = mk();
  c.start(0);
  const w3 = sp.words[3]; // the second "ekmek"
  c.word(w3.i, 200);
  assert.equal(c.at(200), 1000 + w3.t0);
  assert.ok(c.at(250) > 1000 + w3.t0);
});

test("a voice behind the estimate: the clock waits at the next word until the voice gets there", () => {
  const c = mk();
  c.start(0);
  c.word(sp.words[0].i, 0);
  const next = sp.words[1].t0;
  assert.equal(c.at(next + 5000), 1000 + next, "waits at 'var'");
  c.word(sp.words[1].i, next + 5000);
  assert.equal(c.at(next + 5000), 1000 + next);
  assert.ok(c.at(next + 5050) > 1000 + next, "and goes on");
});

test("it never runs backwards, and ends at the line's end", () => {
  const c = mk();
  c.start(0);
  let prev = -Infinity;
  const marks = [[0, 0], [3, 1300], [1, 1400], [5, 1500]] as const;
  for (let real = 0; real <= 3000; real += 25) {
    for (const [k, r] of marks) if (r === real) c.word(sp.words[k].i, real);
    if (real === 2600) c.end(real);
    const t = c.at(real);
    assert.ok(t >= prev, `at ${real}: ${t} < ${prev}`);
    prev = t;
  }
  assert.equal(c.at(3000), 1000 + sp.dur);
});
