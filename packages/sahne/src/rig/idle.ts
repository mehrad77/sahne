// Idle life (DESIGN.md §7): breathing, a slight sway, blinks and small gaze flicks. A pure
// function of (time, seed): a seed's random events are drawn once over a long cycle, cached, and
// looked up by binary search, so it costs a few sines and two searches per actor and frame.

import { rng, type Rng } from "../core/rng.ts";
import { ease, smoothstep, type Vec2 } from "../core/math.ts";

/** Events at cumulative times `t` (ms, from 0) that repeat every `cycle` ms, starting at `start`. */
interface Track { t: Float64Array; x: Float64Array; y: Float64Array; cycle: number; start: number }
interface Life { breath: number; breathAt: number; sway: number; swayAt: number; blinks: Track; looks: Track }

const SPAN = 240_000;
const NONE = new Float64Array(0);
const LIVES = new Map<string, Life>();

function track(r: Rng, gap: () => number, at: (r: Rng) => [number, number] | null, extra?: () => number | null): Track {
  const t: number[] = [], x: number[] = [], y: number[] = [];
  let now = 0;
  while (now < SPAN) {
    const p = at(r);
    t.push(now); if (p) { x.push(p[0]); y.push(p[1]); }
    const d = extra?.();
    if (d != null) t.push(now + d);
    now += gap();
  }
  return { t: Float64Array.from(t), x: x.length ? Float64Array.from(x) : NONE, y: y.length ? Float64Array.from(y) : NONE, cycle: now, start: 0 };
}

function life(seed: string): Life {
  let l = LIVES.get(seed);
  if (l) return l;
  if (LIVES.size >= 256) LIVES.clear();
  const r = rng(`idle:${seed}`);
  const breath = r.range(3800, 4600), sway = r.range(6400, 7800);
  const blinks = track(r, () => r.range(2200, 5500), () => null, () => r.chance(0.12) ? 240 : null);
  blinks.start = r.range(400, 3000);
  const looks = track(r, () => r.range(800, 2600), r => r.chance(0.3) ? [0, 0] : [r.range(-0.06, 0.06), r.range(-0.04, 0.04)]);
  looks.start = r.range(0, 800);
  l = { breath, breathAt: r() * breath, sway, swayAt: r() * sway, blinks, looks };
  LIVES.set(seed, l);
  return l;
}

/** Index of the last event at or before global time t, and the time since it. */
function find(k: Track, t: number): [number, number] {
  const tau = ((t - k.start) % k.cycle + k.cycle) % k.cycle;
  let lo = 0, hi = k.t.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (k.t[m] <= tau) lo = m; else hi = m - 1; }
  return [lo, tau - k.t[lo]];
}

/** Close fast, stay shut for a frame or two, open more slowly: about 150 ms. */
const blinkAt = (dt: number) => dt < 45 ? dt / 45 : dt < 70 ? 1 : dt < 150 ? 1 - ease.inOut((dt - 70) / 80) : 0;

/** Inhale over 40% of the breath, exhale over the rest, smooth at both turns. */
const breathAt = (u: number) => u < 0.4 ? smoothstep(0, 0.4, u) : 1 - smoothstep(0.4, 1, u);

export interface Idle {
  /** 0 (out) … 1 (in). */
  breath: number;
  /** −1 … 1. */
  sway: number;
  blink: number;
  saccade: Vec2;
}

export function idleAt(t: number, seed: string): Idle {
  const l = life(seed);
  const [, db] = find(l.blinks, t);
  const [i, dl] = find(l.looks, t), n = l.looks.t.length, j = i > 0 ? i - 1 : n - 1;
  // a saccade takes about 30 ms
  const s = Math.min(1, dl / 30), sx = l.looks.x[j] + (l.looks.x[i] - l.looks.x[j]) * s, sy = l.looks.y[j] + (l.looks.y[i] - l.looks.y[j]) * s;
  const breath = breathAt((((t + l.breathAt) % l.breath) + l.breath) % l.breath / l.breath);
  return { breath, sway: Math.sin(2 * Math.PI * (t + l.swayAt) / l.sway), blink: blinkAt(db), saccade: [sx, sy] };
}
