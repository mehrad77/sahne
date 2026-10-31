// The particles of the paper stage (DESIGN.md §6.7): rain, steam and smoke, breath, fireworks.
// Each particle is worked out from the time alone (closed form, seeded): no simulation state, so a
// frame at any time is exact, seeking works, and the same time draws the same picture. The stage
// draws them as soft discs and streaks in its one buffer, sorted with everything else by depth.

import { rng } from "../../core/rng.ts";
import type { Vec3 } from "../../core/math.ts";

/** One sprite: a quad facing the camera's axis at `pos` (its centre, metres), `w` × `h` metres. */
export interface Sprite {
  pos: Vec3;
  w: number; h: number;
  /** Straight colour 0…1 and alpha. */
  color: [number, number, number, number];
  /** 0 a soft disc, 1 a streak (a raindrop). */
  shape: 0 | 1;
  /** Added light (a spark), not paint. */
  additive?: boolean;
  /** Lit by the scene (steam, breath) or not (sparks, rain's own sheen). */
  lit?: number;
  /** In the sky, behind the whole set (fireworks): drawn before everything, floors too. */
  sky?: boolean;
  /** A slant: x shift of the top edge relative to the bottom, metres (rain in the wind). */
  slant?: number;
}

/** The most sprites a frame draws (DESIGN.md §6.7, §12). */
export const MAX_SPRITES = 400;

/** Per-particle constants from the seed: `n` rows of `k` numbers in 0…1. */
function table(seed: string, n: number, k: number): number[][] {
  const r = rng(seed);
  return Array.from({ length: n }, () => Array.from({ length: k }, () => r()));
}
const cache = new Map<string, number[][]>();
const rows = (seed: string, n: number, k: number) => {
  const key = `${seed}|${n}|${k}`;
  let t = cache.get(key);
  if (!t) { t = table(seed, n, k); cache.set(key, t); if (cache.size > 64) cache.delete(cache.keys().next().value!); }
  return t;
};
const frac = (x: number) => x - Math.floor(x);

export interface RainBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/** Rain falling through `box` at time `t` (ms): `n` streaks at about 7 m/s, slanted a little by the wind. */
export function rainAt(seed: string, box: RainBox, t: number, n: number, out: Sprite[]) {
  const H = box.y1 - box.y0, fall = 7, period = H / fall * 1000;
  // one table of drops whatever `n` is, so rain fading in adds drops and never reshuffles them
  for (const [a, b, c, d] of rows(seed, 260, 4).slice(0, Math.min(n, 260))) {
    const u = frac(t / (period * (0.85 + 0.3 * d)) + a);
    const y = box.y1 - u * H;
    out.push({ pos: [box.x0 + b * (box.x1 - box.x0) - u * 0.25, y, box.z0 + c * (box.z1 - box.z0)], w: 0.022, h: 0.32, color: [0.86, 0.91, 0.98, 0.42], shape: 1, lit: 0.4, slant: 0.05 });
  }
}

/** Steam (white, quick) or smoke (grey, slower) rising from `at`: a few puffs that grow and fade. */
export function puffAt(kind: "steam" | "smoke", seed: string, at: Vec3, t: number, out: Sprite[], w = 0.06) {
  const steam = kind === "steam", life = steam ? 2200 : 3600, n = steam ? 6 : 8, rise = steam ? 0.45 : 1.1;
  for (const [a, b] of rows(seed, n, 2)) {
    const u = frac(t / life + a);
    const s = (steam ? 0.05 : 0.08) + u * (steam ? 0.2 : 0.35);
    const alpha = Math.sin(Math.PI * u) * (steam ? 0.55 : 0.32);
    const g = steam ? 0.97 : 0.62;
    out.push({ pos: [at[0] + (b - 0.5) * w + Math.sin(u * 5 + b * 6) * 0.04 * u, at[1] + u * rise, at[2]], w: s, h: s, color: [g, g, g + 0.01, alpha], shape: 0, lit: 0.5 });
  }
}

/**
 * A candle's flame on the wick at `at`, `w` wide (m): tongues of fire rising from the wick in a fraction of a second,
 * narrowing and turning from yellow to orange, leaning as the air moves; a bright core that never leaves the wick,
 * and a soft halo of light round it. Its own light (`lit` 0); frozen at t 0 in reduced motion it is a still flame.
 */
export function flameAt(seed: string, at: Vec3, t: number, out: Sprite[], w = 0.012) {
  const [[ph]] = rows(seed, 1, 1), f = 0.5 * Math.sin(t / 90 + ph * 6) + 0.5 * Math.sin(t / 37 + ph * 11);
  const lean = (0.6 * Math.sin(t / 420 + ph * 9) + 0.25 * f) * w * 0.35;
  out.push({ pos: [at[0] + lean, at[1] + w * 1.2, at[2]], w: w * 4.2, h: w * 5, color: [1, 0.72, 0.35, 0.16 + 0.04 * f], shape: 0, additive: true, lit: 0 });
  for (const [a, b] of rows(seed + "|f", 6, 2)) {
    const u = frac(t / 380 + a), s = w * (1 - u * 0.7) * (0.85 + b * 0.3);
    out.push({ pos: [at[0] + lean * u * 2 + (b - 0.5) * w * 0.15, at[1] + w * 0.55 + u * w * 1.7 * (1 + f * 0.1), at[2]], w: s, h: s * 1.5, color: [1, 0.86 - u * 0.36, 0.42 - u * 0.3, 0.8 * (1 - u * u)], shape: 0, lit: 0 });
  }
  out.push({ pos: [at[0] + lean * 0.4, at[1] + w * 0.75, at[2]], w: w * 0.7, h: w * 1.2, color: [1, 0.97, 0.78, 0.95], shape: 0, lit: 0 });
}

/** One breath in cold air from a mouth at `at`, `age` ms into it (it lasts BREATH_MS), drifting the way the face turns (`dir` ±1). */
export const BREATH_MS = 1300;
export function breathAt(at: Vec3, age: number, dir: number, out: Sprite[]) {
  if (age < 0 || age > BREATH_MS) return;
  const u = age / BREATH_MS, s = 0.06 + u * 0.2, a = 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.4));
  // a cloud of three soft puffs, drifting out and up from the mouth
  for (const [dx, dy, k] of [[0, 0, 1], [0.05, 0.03, 0.75], [-0.03, 0.05, 0.6]]) out.push({ pos: [at[0] + dir * (0.06 + u * 0.22) + dx * s * 3, at[1] + u * 0.08 + dy * s * 3, at[2] + 0.06], w: s * k, h: s * 0.8 * k, color: [0.97, 0.98, 1, a], shape: 0, lit: 0.4 });
}

/** A firework's colours: red and white (29 Ekim), gold. */
const BURST: [number, number, number][] = [[1, 0.32, 0.3], [1, 0.97, 0.92], [1, 0.8, 0.35]];
export const BURST_MS = 1800, BURST_RISE_MS = 120;

/**
 * A firework `age` ms after it bursts at `at`: sparks flying out and falling, rising in BURST_RISE_MS
 * and fading out from 0.6 s to BURST_MS (never a flicker: DESIGN.md §6.7).
 */
export function burstAt(seed: string, at: Vec3, age: number, out: Sprite[], scale = 1) {
  if (age < 0 || age > BURST_MS) return;
  const k = age / 1000, glow = Math.min(1, age / BURST_RISE_MS) * (age < 600 ? 1 : Math.max(0, 1 - (age - 600) / (BURST_MS - 600)));
  const col = BURST[Math.floor(rows(seed, 1, 1)[0][0] * BURST.length)];
  for (const [a, b] of rows(seed + "|s", 36, 2)) {
    const ang = a * Math.PI * 2, v = (1.6 + b * 1.4) * scale;
    const r = v * (1 - Math.exp(-2.6 * k)) / 1.2;
    out.push({ pos: [at[0] + Math.cos(ang) * r, at[1] + Math.sin(ang) * r - 0.6 * scale * k * k, at[2]], w: 0.22 * scale, h: 0.22 * scale, color: [...col, glow], shape: 0, additive: true, lit: 0, sky: true });
  }
}
