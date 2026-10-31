// The set's own drawing helpers, shared by every family of set pieces and props (one copy, not one
// per file). Not the same as `../draw/shapes.ts`, the avatar parts' helpers, whose `S` and `P` mean
// the other way round: here `S` takes a path and `P` takes points.

import { ellipse, groupBounds, rect, rrect, smooth, poly, TIMETABLE, type FlatMotion, type FlatSpec, type Path, type Rng, type Shape, type SolidLine, type TextSpec, type Vec2 } from "sahne";
import { SET, FABRIC, METAL, SKIN, HAIR } from "../palette.ts";

/** A point; a third value 0 makes it a corner in `smooth`. */
export type Pt = Vec2 | [number, number, number];
/** A shape from a path. */
export const S = (path: Path, fill: string, o: Partial<Shape> = {}): Shape => ({ path, fill, ...o });
/** A closed shape smoothed through points. */
export const P = (pts: Pt[], fill: string, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, true, 1), fill, ...o });
/** A printed line (flat, no rim). */
export const L = (pts: Vec2[], c: string, w = 0.6, op = 0.7): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w }, flat: true, opacity: op });
/** A param as a finite number, else `d`. */
export const num = (v: unknown, d: number) => typeof v === "number" && Number.isFinite(v) ? v : d;
/** A colour param: an id of the set, fabric, metal, skin or hair palette, or a `#rrggbb` hex; else `d`. */
export const hex = (v: unknown, d: string) => typeof v === "string" ? SET[v] ?? FABRIC[v] ?? METAL[v] ?? SKIN[v] ?? HAIR[v] ?? (/^#[0-9a-f]{6}$/i.test(v) ? v : d) : d;
/** A param as a string, else `d`. */
export const str = (v: unknown, d: string) => typeof v === "string" ? v : d;
/** Mirror shapes about x = 0 (a plane or a traveller going left). */
export const flip = (sh: Shape[], dir: number) => dir < 0 ? sh.map(s => ({ ...s, path: s.path.mirrorX() })) : sh;
/** An outline with holes cut in it (even-odd). */
export const holed = (outer: Path, holes: Path[]) => { for (const h of holes) outer.add(h); return outer; };
/** A path from a piece's params: `go` (offsets in the place, cm), `ms`, `wait`, `phase`, `hide` (default on); undefined without `go`. */
export function goes(p: Record<string, unknown>): FlatMotion | undefined {
  const go = p.go;
  if (!Array.isArray(go) || go.length < 2 || !go.every(q => Array.isArray(q) && q.length === 3 && q.every(v => Number.isFinite(v)))) return undefined;
  return { path: { pts: go as [number, number, number][], ms: Math.max(500, num(p.ms, 20000)), wait: Math.max(0, num(p.wait, 0)), hide: p.hide !== false }, phase: num(p.phase, 0) };
}

/** Every copy of a period's path from `lo` to `hi` in one path, so the strip costs one fill per shape. */
export function copies(path: Path, per: number, lo: number, hi: number): Path {
  const k0 = Math.floor(lo / per) - 1, k1 = Math.ceil(hi / per);
  const out = path.move(k0 * per, 0);
  for (let k = k0 + 1; k <= k1; k++) out.add(path.move(k * per, 0));
  return out;
}

/** A ridge line that repeats every `per`: a few sines of whole periods, sampled from `lo` to `hi`, closed down to the strip's foot. */
export function ridge(r: Rng, per: number, lo: number, hi: number, base: number, amp: number): Path {
  const waves = [1, 2, 3, 5].map(k => [k, amp * r.range(0.3, 1) / Math.sqrt(k), r.range(0, Math.PI * 2)]);
  // sampled on a grid that divides the period, so the points a period apart are the same points
  const step = per / Math.max(8, Math.round(per / 20)), x0 = Math.floor((lo - 20) / step) * step, pts: Vec2[] = [[x0, 0]];
  for (let i = 0, x = x0; x <= hi + 20 + step; x = x0 + ++i * step) pts.push([x, -base - waves.reduce((s, [k, a, f]) => s + a * Math.sin(2 * Math.PI * k * x / per + f), 0)]);
  pts.push([pts[pts.length - 1][0], 0]);
  return poly(pts);
}

/** A flat that is only light: an invisible speck for its paper, its `glow` in the emissive group. */
export const glowOnly = (glow: Shape[], o: Partial<FlatSpec> = {}): FlatSpec => ({ group: { shapes: [S(rect(0, -1, 1, 1), "#000000", { opacity: 0 })] }, emissive: { shapes: glow, edge: 0 }, switch: false, ...o });

/**
 * Lit windows that come on one by one as the evening deepens (`FlatSpec.glowAt`): the shapes split into
 * `n` glow-only flats by where each one is (a hash, not the piece's random stream, so the art is unchanged),
 * coming on from `from` to `to` of the time's glow.
 */
export function litByTurns(lit: Shape[], o: Partial<FlatSpec> = {}, n = 5, from = 0.15, to = 0.75): FlatSpec[] {
  const groups: Shape[][] = Array.from({ length: n }, () => []);
  for (const s of lit) {
    const [x0, y0, x1, y1] = groupBounds({ shapes: [s] }), h = Math.sin((x0 + x1) * 6.4949 + (y0 + y1) * 39.1165) * 43758.5453;
    groups[Math.floor((h - Math.floor(h)) * n)].push(s);
  }
  // each group spans the whole piece but is mostly dark: its glow is drawn at half the art's resolution (soft light keeps its shape)
  const glowPpcm = (o.ppcm ?? 1.6) / 2;
  return groups.flatMap((g, k) => g.length ? [glowOnly(g, { glowPpcm, ...o, glowAt: from + (to - from) * k / Math.max(1, n - 1) })] : []);
}

/**
 * A piece's solid line along its front (`PieceDef.solid`, DESIGN.md §7): from `x0` to `x1` cm at z 0, less the `gaps`
 * ([a, b] cm) people pass through; `door` makes it a leaf instead (solid but to its own door mark's entrances and exits).
 */
export function solidLine(x0: number, x1: number, gaps: [number, number][] = [], door = false): SolidLine[] {
  let spans: [number, number][] = [[x0, x1]];
  for (const [a, b] of gaps) spans = spans.flatMap(([u, v]) => b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([s, e]) => e - s > 1) as [number, number][]);
  return spans.map(([u, v]) => ({ a: [u, 0], b: [v, 0], ...(door ? { door: true as const } : {}) }));
}

// ---- a vehicle's timetable (FlatMotion.stops, PlaceDoc.stops): the metro car's and the bus's pieces share these

export type Timetable = typeof TIMETABLE;
/** A piece's `stops` param: `true` the engine's TIMETABLE, an object overriding some of it, else none. */
export function timetable(v: unknown): Timetable | null {
  if (!v) return null;
  return v === true ? TIMETABLE : { ...TIMETABLE, ...(v as Partial<Timetable>) };
}
/** At a stop, ms after the leg ends: the doors open (from, to) and, ms before the next leg, shut (from, to); one passenger gets off (at the spot, the doorway, outside) and then one gets on (outside, the doorway, the spot). */
export const AT_STOP = { open: [400, 1100], shut: [1400, 700], off: [1100, 1900, 2500], on: [2200, 2900, 4200] };
/** A door leaf's timed path on the timetable (`path.at`): shut, opening, open, shutting, shut. */
export const doorTimes = (t: Timetable) => [0, t.run + AT_STOP.open[0], t.run + AT_STOP.open[1], t.ms - AT_STOP.shut[0], t.ms - AT_STOP.shut[1]].map(x => x / t.ms);
/** The `stops` param's declaration. */
export const stopsParam = { type: ["bool", "object"] as const, about: "the vehicle's timetable: true, or {ms, run, ease} (TIMETABLE)" };

/** Shapes scaled by `k` about the origin and mirrored when `dir` is -1, their clips and strokes too. */
export function fit(ss: Shape[], k: number, dir: number, dx = 0, dy = 0): Shape[] {
  const m: [number, number, number, number, number, number] = [dir * k, 0, 0, k, dx, dy], f = (q: Path) => q.transform(m);
  return ss.map(s => ({ ...s, path: f(s.path), ...(s.clip ? { clip: f(s.clip as Path) } : {}), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * k } } : {}) }));
}
/** Text boxes the same way (the words themselves are never mirrored). */
export const fitText = (t: TextSpec[], k: number, dir: number, dx = 0): TextSpec[] => t.map(s => ({ ...s, x: (dir < 0 ? -s.x - s.w : s.x) * k + dx, y: s.y * k, w: s.w * k, h: s.h * k, ...(s.size ? { size: s.size * k } : {}) }));

/** A faceless rider in a window, head and shoulders, standing on `y` at `x`, `k` times the size; some in a headscarf. */
export function rider(r: Rng, x: number, y: number, k = 1): Shape[] {
  const sk = r.pick(["#E8B98F", "#C98E62", "#8D5A3B", "#F1CBA5", "#B4936A"]), cl = r.pick(["#2E5E8C", "#7A3E6E", "#3E7A3A", "#B3261E", "#4A4A4A", "#C9A227"]), o = { flat: true, opacity: 0.85 };
  const out = [S(rrect(x - 17 * k, y - 26 * k, 34 * k, 26 * k, [12 * k, 12 * k, 0, 0]), cl, o)];
  if (r.chance(0.3)) out.push(S(ellipse(x, y - 36 * k, 12.5 * k, 14 * k), r.pick(["#7A3E6E", "#2E5E8C", "#C4553A", "#E0D6C2"]), o), S(ellipse(x + k, y - 35 * k, 7 * k, 8.5 * k), sk, o));
  else out.push(S(ellipse(x, y - 36 * k, 10 * k, 11 * k), sk, o), S(ellipse(x, y - 43 * k, 10.5 * k, 6 * k), r.pick(["#2B2420", "#5B3A29", "#A0522D", "#8E8E8E"]), o));
  return out;
}
