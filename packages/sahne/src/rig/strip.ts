// The geometry of a limb strip (arms, sleeves, trouser legs): a tapered band along a quadratic
// Bézier through the chain's three joints, so a bend at the middle joint stays smooth. Pure, and
// the one place this is written: the paper backend turns the sections into triangles, the still
// backend into a polygon. Inputs are what the stage has: the joints in paper space, the strip's
// spec and its layer.

import type { StripSpec } from "../core/kit.ts";
import { apply, type Affine, type Vec2 } from "../core/math.ts";
import { CHAINS } from "./skeleton.ts";

export const STRIP_SEGMENTS = 12;
export const STRIP_CAP_SEGMENTS = 8;

/** A round end: a half circle of points from the band's left side, round the tip, to its right side. */
export interface StripCap { center: Vec2; pts: Vec2[]; /** Arc length at the cap (0 at the start, the band's length at the end). */ along: number }

export interface StripGeom {
  /** The band's two sides at the N + 1 sections: a point on the normal side and on the other one. */
  left: Vec2[];
  right: Vec2[];
  /** Arc length at each section, for stripes. */
  along: number[];
  length: number;
  capFrom: StripCap | null;
  capTo: StripCap | null;
}

/** The three joints of a strip's chain in paper space (null when the skeleton lacks one of the bones). */
export function stripJoints(world: Map<string, Affine>, chain: StripSpec["chain"]): [Vec2, Vec2, Vec2] | null {
  const m = CHAINS[chain]?.map(n => world.get(n));
  return m && m.every(Boolean) ? m.map(a => apply(a!, 0, 0)) as [Vec2, Vec2, Vec2] : null;
}

/** The skin layers: their strips end round at the wrist and the ankle. Every other strip ends flat. */
const ROUND_END = ["arm", "leg"];

/**
 * Which ends of a strip are round (`StripSpec.caps`): by default the start when the strip starts
 * at the root joint (a shoulder, a hip), and the end only on the skin layers. So a sleeve is round
 * at the shoulder and cut flat at the cuff, and a cuff, a boot shaft or a trouser hem is flat at
 * both ends.
 */
export function stripCaps(s: Pick<StripSpec, "from" | "caps">, layer: string): { from: boolean; to: boolean } {
  if (s.caps) return { from: s.caps === "both" || s.caps === "from", to: s.caps === "both" || s.caps === "to" };
  return { from: (s.from ?? 0) <= 0.01, to: ROUND_END.includes(layer) };
}

/**
 * The band of a strip. Widths run linearly from the first to the middle width over the first half
 * of the chain and on to the last; `from` … `to` is the covered range; `seg` sections. Its ends are
 * round or flat as `stripCaps` says. `scale` narrows the band (the still backend's rim).
 */
export function stripGeometry(j: [Vec2, Vec2, Vec2], s: Pick<StripSpec, "widths" | "from" | "to" | "caps">, layer: string, o: { seg?: number; capSeg?: number; scale?: number } = {}): StripGeom {
  const N = o.seg ?? STRIP_SEGMENTS, M = o.capSeg ?? STRIP_CAP_SEGMENTS, k = o.scale ?? 1;
  const C: Vec2 = [2 * j[1][0] - (j[0][0] + j[2][0]) / 2, 2 * j[1][1] - (j[0][1] + j[2][1]) / 2];
  const B = (t: number): Vec2 => { const u = 1 - t; return [u * u * j[0][0] + 2 * u * t * C[0] + t * t * j[2][0], u * u * j[0][1] + 2 * u * t * C[1] + t * t * j[2][1]]; };
  const dB = (t: number): Vec2 => [2 * (1 - t) * (C[0] - j[0][0]) + 2 * t * (j[2][0] - C[0]), 2 * (1 - t) * (C[1] - j[0][1]) + 2 * t * (j[2][1] - C[1])];
  const width = (t: number) => k * (t < 0.5 ? s.widths[0] + (s.widths[1] - s.widths[0]) * t * 2 : s.widths[1] + (s.widths[2] - s.widths[1]) * (t - 0.5) * 2);
  const from = s.from ?? 0, to = s.to ?? 1;
  const left: Vec2[] = [], right: Vec2[] = [], along: number[] = [];
  let len = 0, prev: Vec2 | null = null;
  for (let i = 0; i <= N; i++) {
    const t = from + (to - from) * (i / N), p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const n: Vec2 = [-d[1] / l, d[0] / l];
    if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p; along.push(len);
    left.push([p[0] + n[0] * w, p[1] + n[1] * w]); right.push([p[0] - n[0] * w, p[1] - n[1] * w]);
  }
  const cap = (t: number, sAt: number, dir: number): StripCap => {
    const p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const tx = d[0] / l * dir, ty = d[1] / l * dir, nx = -ty, ny = tx, pts: Vec2[] = [];
    for (let i = 0; i <= M; i++) {
      const a = Math.PI * i / M;
      pts.push([p[0] + (nx * Math.cos(a) + tx * Math.sin(a)) * w, p[1] + (ny * Math.cos(a) + ty * Math.sin(a)) * w]);
    }
    return { center: p, pts, along: sAt };
  };
  const caps = stripCaps(s, layer);
  return { left, right, along, length: len, capFrom: caps.from ? cap(from, 0, -1) : null, capTo: caps.to ? cap(to, len, 1) : null };
}

/** The whole strip as one closed polygon: down the left side, round the end cap, up the right side, round the start cap. */
export function stripOutline(g: StripGeom): Vec2[] {
  const mid = (c: StripCap | null) => c ? c.pts.slice(1, -1) : [];
  return [...g.left, ...mid(g.capTo), ...[...g.right].reverse(), ...mid(g.capFrom)];
}

/** The part of the band between two arc lengths, as a polygon (a stripe); sections are cut linearly, as the GPU interpolates them. */
export function stripSlice(g: StripGeom, a: number, b: number): Vec2[] {
  const lo = Math.max(0, a), hi = Math.min(g.length, b), L: Vec2[] = [], R: Vec2[] = [];
  if (!(hi > lo)) return [];
  const at = (s: number) => {
    let i = 0;
    while (i < g.along.length - 2 && g.along[i + 1] < s) i++;
    const f = (s - g.along[i]) / ((g.along[i + 1] - g.along[i]) || 1), mix = (p: Vec2[]): Vec2 => [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f];
    L.push(mix(g.left)); R.push(mix(g.right));
  };
  at(lo);
  for (const s of g.along) if (s > lo && s < hi) at(s);
  at(hi);
  return [...L, ...R.reverse()];
}

/** A stripe's duty, the share of the period it covers, made safe: 0.5 when it is not a number in (0, 1). */
export const stripeDuty = (d: unknown): number => (typeof d === "number" && d > 0 && d < 1 ? d : 0.5);

/**
 * The stripe intervals along a band: the first `duty` of every period is the stripe colour, as in
 * the paper shader. Empty when the period is unusable.
 */
export function stripeSpans(length: number, period: number, duty = 0.5): [number, number][] {
  const out: [number, number][] = [], d = stripeDuty(duty);
  if (!(period > 0) || !(length > 0) || length / period > 200) return out;
  for (let a = 0; a < length; a += period) out.push([a, Math.min(length, a + period * d)]);
  return out;
}
