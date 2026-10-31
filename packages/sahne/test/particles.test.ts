// Tests of the particles (DESIGN.md §6.7): worked out from the time alone, so the
// same time draws the same; rain stays in its box; a firework never flickers; the cap holds; and on
// the stage rain draws only while it rains, fireworks only after the cue asks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { breathAt, burstAt, flameAt, puffAt, rainAt, BURST_MS, type Sprite } from "../src/render/paper/particles.ts";
import { directAll, type DirectCtx } from "../src/director/direct.ts";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import type { PlaceDoc } from "../src/core/types.ts";

const box = { x0: -4, x1: 4, y0: 0, y1: 3, z0: -3, z1: 1 };
const run = (f: (out: Sprite[]) => void) => { const out: Sprite[] = []; f(out); return out; };

test("the same time draws the same particles, whatever was drawn before", () => {
  const a = run(o => rainAt("s", box, 12345, 100, o));
  run(o => rainAt("s", box, 999, 100, o));
  assert.deepEqual(run(o => rainAt("s", box, 12345, 100, o)), a);
  assert.deepEqual(run(o => puffAt("steam", "k", [0, 1, 0], 777, o)), run(o => puffAt("steam", "k", [0, 1, 0], 777, o)));
  assert.notDeepEqual(run(o => rainAt("s", box, 12345, 100, o)), run(o => rainAt("s", box, 12400, 100, o)), "and it moves");
});

test("rain falls inside its box, at most 260 drops; more rain adds drops, never moves the ones there", () => {
  for (let t = 0; t < 10000; t += 333) for (const s of run(o => rainAt("s", box, t, 400, o))) {
    assert.ok(s.pos[1] >= box.y0 - 0.01 && s.pos[1] <= box.y1 + 0.01 && s.pos[2] >= box.z0 && s.pos[2] <= box.z1, JSON.stringify(s.pos));
    assert.ok(s.pos[0] >= box.x0 - 0.3 && s.pos[0] <= box.x1);
  }
  assert.equal(run(o => rainAt("s", box, 0, 400, o)).length, 260);
  assert.deepEqual(run(o => rainAt("s", box, 5000, 50, o)), run(o => rainAt("s", box, 5000, 120, o)).slice(0, 50));
});

test("a firework rises in 0.12 s, fades from 0.6 s, is gone by 1.8 s, and never flickers", () => {
  const glow = (age: number) => run(o => burstAt("b", [0, 3, -10], age, o))[0]?.color[3] ?? 0;
  assert.equal(glow(-1), 0);
  assert.ok(glow(60) > 0.3 && glow(60) < 0.7 && glow(120) === 1 && glow(500) === 1);
  assert.ok(glow(1200) > 0 && glow(1200) < 1 && glow(BURST_MS + 1) === 0);
  // brightness only rises once: no flashing (DESIGN.md §6.7: never more than three a second)
  let rises = 0, prev = 0;
  for (let a = 0; a <= BURST_MS; a += 10) { const g = glow(a); if (g > prev + 1e-9 && prev === 0) rises++; prev = g; }
  assert.equal(rises, 1);
});

test("a breath lasts 1.3 s and drifts the way the face turns", () => {
  assert.equal(run(o => breathAt([0, 1.5, 0], 1400, 1, o)).length, 0);
  const r = run(o => breathAt([0, 1.5, 0], 600, 1, o)), l = run(o => breathAt([0, 1.5, 0], 600, -1, o));
  assert.ok(r[0].pos[0] > 0 && l[0].pos[0] < 0);
});

const yard: PlaceDoc = { v: 1, id: "yard", size: { w: 8, d: 4 }, pieces: [], marks: { here: { x: 0, z: 0 } } };
const ctx: DirectCtx = { places: { yard }, gestures: {}, lang: { id: "x", speech: speechFallback, match: matchFallback } };

test("fireworks: n bursts 0.7 s apart over the wide shot's far band; do: breath is a puff, not a gesture", () => {
  const ps = directAll([{ scene: { place: "yard", at: { a: "here" } } }, { beat: { env: "fireworks:3" } }, { beat: { who: "a", do: "breath" } }], ["a"], ctx);
  const b = ps[1].bursts!;
  assert.deepEqual(b.map(x => x.t), [0, 700, 1400]);
  assert.ok(b.every(x => x.at[2] < -8 && x.at[1] > 2), "far behind and up in the sky");
  assert.ok(ps[1].dur >= 1400 + 1800);
  assert.deepEqual(directAll([{ scene: { place: "yard", at: { a: "here" } } }, { beat: { env: "fireworks:3" } }], ["a"], ctx)[1].bursts, b, "the same every time");
  assert.equal(ps[2].puffs?.length, 1);
  assert.equal(ps[2].tracks.a?.gestures.length ?? 0, 0);
});

test("a candle's flame stays on its wick, burns its own light, flickers, and never goes out", () => {
  const at: [number, number, number] = [1, 0.8, -0.5], w = 0.012;
  const frames = [0, 50, 137, 260, 900, 4321].map(t => run(o => flameAt("c", at, t, o, w)));
  for (const f of frames) {
    assert.ok(f.length >= 3 && f.every(s => s.lit === 0 && [...s.pos, s.w, s.h, ...s.color].every(Number.isFinite)));
    // within a few flame-widths of the wick, above it, and a bright core on it at every moment
    assert.ok(f.every(s => Math.abs(s.pos[0] - at[0]) < w * 2 && s.pos[1] >= at[1] && s.pos[1] < at[1] + w * 3.5 && s.pos[2] === at[2]));
    assert.ok(f.some(s => !s.additive && s.color[3] > 0.9 && s.pos[1] < at[1] + w));
  }
  assert.notDeepEqual(frames[1], frames[2], "it moves");
  assert.deepEqual(run(o => flameAt("c", at, 137, o, w)), frames[2], "the same time, the same flame");
});
