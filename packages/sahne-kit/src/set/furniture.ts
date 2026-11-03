// Set pieces and props of the furniture family, following STYLE.md: chairs, tables,
// desks, a sofa, a bed, kitchen fittings, boards, the queue's machines, a café's coffee machine and the
// belediye's small stage. Units cm; each flat's origin is its bottom centre. Furniture people use is at
// puppet scale (a seat at 45 cm, a table at 72–80): a little of each top shows, as from a standing eye.
// Words (a board's writing, a screen's number) are text boxes on the flat (TextSpec), never drawn.

import { ellipse, rect, rrect, smooth, poly, band, tone, mix, groupBounds, type PieceDef, type Shape, type FlatSpec, type TextSpec, type Rng, type Path, type Vec2, type SolidLine } from "sahne";
import { S, P, L, num, str, type Pt } from "./draw.ts";
import { SET, FABRIC } from "../palette.ts";

// ---- Helpers ------------------------------------------------------------------------------------

type Sh = Shape[];
type O = Partial<Shape>;
type Params = Record<string, unknown>;
const fl = (opacity = 1): O => ({ flat: true, opacity });
const R = (x: number, y: number, w: number, h: number, c: string, o: O = {}) => S(rect(x, y, w, h), c, o);
const RR = (x: number, y: number, w: number, h: number, k: number, c: string, o: O = {}) => S(rrect(x, y, w, h, k), c, o);
const E = (x: number, y: number, rx: number, ry: number, c: string, o: O = {}) => S(ellipse(x, y, rx, ry), c, o);
const Q = (pts: Vec2[], c: string, o: O = {}) => S(poly(pts), c, o);
const lt = (c: string) => tone(c, "light"), sd = (c: string) => tone(c, "shade"), dk = (c: string) => tone(c, "deep");
/** A colour param: a fabric or set palette id, or a hex; else `d`. */
const col = (v: unknown, d: string) => typeof v === "string" ? FABRIC[v] ?? SET[v] ?? (/^#[0-9a-f]{6}$/i.test(v) ? v : d) : d;
/** A param as a list of non-empty strings (one string is a list of one; numbers count as strings). */
const strs = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map(s => typeof s === "number" ? String(s) : s).filter((s): s is string => typeof s === "string" && s.trim() !== "").map(s => s.trim());
const cp = (v: Vec2): Pt => [v[0], v[1], 0];

/** A straight bar from (x0, y0) to (x1, y1), `w` wide at its start and `w1` at its end: a leg, a rail, a tube. */
function bar(x0: number, y0: number, x1: number, y1: number, w: number, c: string, w1 = w, o: O = {}): Shape {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l / 2, ny = dx / l / 2;
  return S(poly([[x0 + nx * w, y0 + ny * w], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w, y0 - ny * w]]), c, o);
}
const mv = (sh: Sh, dx: number, dy: number): Sh => sh.map(s => ({ ...s, path: s.path.move(dx, dy), ...(s.clip ? { clip: (s.clip as Path).move(dx, dy) } : {}) }));
const mirror = (sh: Sh): Sh => sh.map(s => ({ ...s, path: s.path.mirrorX(), ...(s.clip ? { clip: (s.clip as Path).mirrorX() } : {}) }));
/** `n` copies side by side, `gap` apart, centred. */
const rowOf = (sh: Sh, n: number, gap: number): Sh => Array.from({ length: n }, (_, i) => mv(sh, (i - (n - 1) / 2) * gap, 0)).flat();
const count = (p: Params) => Math.max(1, Math.min(24, Math.round(num(p.n, 1))));
const ppcmFor = (sh: Sh, max: number) => { const [x0, y0, x1, y1] = groupBounds({ shapes: sh }); return Math.min(max, 1900 / Math.max(x1 - x0 + 4, y1 - y0 + 4)); };
/** A puffy cushion `s` cm square at (x, y), turned by `rot`. */
function pillow(x: number, y: number, s: number, rot: number, c: string): Sh {
  const q = (u: number, v: number): Vec2 => [x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)], h = s / 2, k = s * 0.08;
  return [P([cp(q(-h, -h)), q(0, -h + k), cp(q(h, -h)), q(h - k, 0), cp(q(h, h)), q(0, h - k), cp(q(-h, h)), q(-h + k, 0)], c), S(ellipse(...q(0, 0), 1.3, 1.3), sd(c), fl(0.8)), L([q(-h * 0.6, h * 0.5), q(h * 0.3, h * 0.65)], sd(c), 0.6, 0.35)];
}
/** The flat of a piece that is also a prop (`id`): `n` of `one()` side by side, `gap` apart; held, `held()` (its grip at the origin), more of them stacked behind. */
function propFlat(id: string, p: Params, one: () => Sh, gap: number, held: () => Sh, ppcm: number, o: Partial<FlatSpec> = {}): FlatSpec {
  const n = count(p), shapes: Sh = [];
  if (p.held) { const h = held(); for (let i = n - 1; i >= 0; i--) shapes.push(...mv(h, i * 4, i * 2.5)); }
  else shapes.push(...rowOf(one(), n, gap));
  return { group: { shapes, edge: 0.7 }, ppcm: ppcmFor(shapes, ppcm), id, ...o };
}

const WOODS = ["#A8754A", "#8B5E3C", "#C99A68", "#7A5034", "#B5835A"], DARKWOOD = ["#6B4A35", "#7A5034", "#5A3A28"];
const PAINT = ["#3C6E9E", "#2F7D5B", "#C4553A", "#2E3A59", "#8E979E", "#D18A1C"];
const SOFT = ["fab_06", "fab_04", "fab_12", "fab_08", "fab_19", "fab_16", "fab_43", "fab_13", "fab_03", "fab_09"];
const STEEL = "#B8BEC4", DARK = "#2B2B30", PAPER = "#FBF7EE", NOTE = ["#FBF7EE", "#F6E7A8", "#F4C9C9", "#CFE3F2", "#DCEFD5"];

// ---- Chairs -------------------------------------------------------------------------------------

/** The seat's height (puppet scale), and how much higher its back edge shows than its front. */
const SEAT = 45, DEEP = 7;
type ChairArt = { front(back: boolean): Sh; side(): Sh; fold?(): Sh; w: number };
type Leg = (x: number, y0: number, y1: number, near: boolean) => Sh;

/** A four-legged chair `W` wide, its back `T` high, from the front (`back`: from behind, the back nearest): `leg` draws a leg, `seat(top, a)` the seat on its top face, `rest(xb, yb, yt)` the back from the seat's back edge `yb` up to `yt`. */
function chair4(W: number, T: number, back: boolean, leg: Leg, seat: (top: Path, a: number) => Sh, rest: (xb: number, yb: number, yt: number) => Sh): Sh {
  const a = W / 2, b = a * 0.92, yb = back ? -SEAT : -SEAT - DEEP, yo = back ? -SEAT - DEEP : -SEAT, xb = back ? a : b, xo = back ? b : a;
  const legs = (x: number, y0: number, y1: number, near: boolean) => [...leg(-x, y0, y1, near), ...leg(x, y0, y1, near)];
  const bk = [...legs(xb - 2.5, yb + 3, back ? 0 : -DEEP, back), ...rest(xb, yb, yb - T + SEAT)];
  const ot = legs(xo - 2.5, yo + 3, back ? -DEEP : 0, !back), st = seat(poly([[-xb, yb], [xb, yb], [xo, yo], [-xo, yo]]), a);
  return back ? [...ot, ...st, ...bk] : [...bk, ...st, ...ot];
}

function plainChair(c: string, f: string | null, style: number): ChairArt {
  const T = 90, D = 40;
  const leg: Leg = (x, y0, y1, near) => [bar(x, y0, x * 1.03, y1, 4, near ? c : sd(c), 3)];
  const seat = (top: Path, a: number): Sh => f
    ? [S(top, lt(f)), RR(-a, -SEAT - 3, 2 * a, 7, 3, f), R(-a + 1, -SEAT + 3.6, 2 * a - 2, 2.4, c)]
    : [S(top, lt(c)), R(-a, -SEAT, 2 * a, 4, c), L([[-a + 5, -SEAT - 2.6], [a - 9, -SEAT - 4.6]], sd(c), 0.5, 0.35)];
  const rest = (xb: number, yb: number, yt: number): Sh => {
    const out = [-1, 1].map(s => bar(s * (xb - 2.5), yb, s * (xb - 2.8), yt + 3, 3.8, c));
    if (style === 2 && f) out.push(RR(-xb + 1.5, yt + 5, 2 * xb - 3, yb - yt - 15, 6, f), R(-xb + 5, yt + 10, 3, yb - yt - 28, lt(f), fl(0.45)));
    else if (style === 1) for (const k of [0.38, 0.62]) out.push(R(-xb + 2, yt + (yb - yt) * k, 2 * xb - 4, 4.5, c), R(-xb + 2, yt + (yb - yt) * k + 3.6, 2 * xb - 4, 1, sd(c), fl(0.6)));
    else { for (const k of [-0.38, 0, 0.38]) out.push(bar(k * xb, yt + 8, k * xb, yb - 6, 3.2, c, 2.4)); out.push(R(-xb + 2, yb - 8, 2 * xb - 4, 3, c)); }
    out.push(RR(-xb - 1, yt, 2 * xb + 2, 9, 3, c), R(-xb, yt + 7, 2 * xb, 1.4, sd(c), fl(0.5)));
    return out;
  };
  return {
    w: 44, front: back => chair4(44, T, back, leg, seat, rest),
    side: () => [
      bar(-D / 2 + 5, -2, -D / 2 + 3, -SEAT, 3.4, dk(c)), bar(D / 2, -2, D / 2, -SEAT, 3.4, dk(c)),
      bar(-D / 2 + 2, 0, -D / 2 - 2, -T + 4, 3.8, c), bar(D / 2 - 3, 0, D / 2 - 3, -SEAT, 3.8, c, 3.2), bar(-D / 2 + 2, -15, D / 2 - 3, -15, 2, sd(c)),
      RR(-D / 2 - 1, -SEAT - 4, D + 2, 4.5, 1.5, c),
      ...(f ? [RR(-D / 2 + 1, -SEAT - 9, D - 2, 6, 2.5, f)] : []),
      ...(style === 2 && f ? [bar(-D / 2 + 0.5, -SEAT - 13, -D / 2 - 2, -T + 7, 5, f)] : []),
      RR(-D / 2 - 4.5, -T, 5.5, 9, 2, c),
    ],
  };
}

function schoolChair(c: string): ChairArt {
  const T = 84, D = 40, ply = "#D7AE74";
  const leg: Leg = (x, y0, y1, near) => [bar(x, y0, x * 1.05, y1, 2.6, near ? c : sd(c)), RR(x * 1.05 - 1.8, y1 - 2.2, 3.6, 2.4, 1, DARK)];
  const seat = (top: Path, a: number): Sh => [S(top, lt(ply)), R(-a + 1, -SEAT, 2 * a - 2, 2.6, ply), L([[-a + 4, -SEAT - 3], [a - 10, -SEAT - 5]], sd(ply), 0.5, 0.3)];
  const rest = (xb: number, yb: number, yt: number): Sh => [
    ...[-1, 1].map(s => bar(s * (xb - 3), yb, s * (xb - 3.4), yt + 6, 2.6, c)),
    RR(-xb - 1, yt, 2 * xb + 2, 17, 5, ply), R(-xb + 2, yt + 3, 2 * xb - 4, 2, lt(ply), fl(0.6)), R(-xb, yt + 13, 2 * xb, 2, sd(ply), fl(0.45)),
  ];
  return {
    w: 44, front: back => chair4(42, T, back, leg, seat, rest),
    side: () => [
      bar(-D / 2 + 4, -2, -D / 2 + 3, -SEAT, 2.4, dk(c)), bar(D / 2 - 1, -2, D / 2 - 1, -SEAT, 2.4, dk(c)),
      bar(-D / 2 + 1, 0, -D / 2 + 1, -SEAT, 2.6, c), bar(-D / 2 + 1, -SEAT, -D / 2 - 3, -T + 4, 2.6, c), bar(D / 2 - 3, 0, D / 2 - 3, -SEAT, 2.6, c),
      RR(-D / 2 - 1, -SEAT - 3, D + 2, 3, 1.2, ply), bar(-D / 2 - 1.5, -T + 17, -D / 2 - 3.6, -T, 3, ply),
    ],
  };
}

function foldChair(c: string, slats: boolean): ChairArt {
  const T = 84, D = 40, wd = "#C99A68", s = slats ? wd : c;
  const leg: Leg = (x, y0, y1, near) => [bar(x, y0, x * (near ? 1.03 : 1.16), y1, 2.2, near ? c : sd(c))];
  const seat = (top: Path, a: number): Sh => [S(top, lt(s)), R(-a + 0.5, -SEAT, 2 * a - 1, 2.8, s), ...(slats ? [1, 2].map(k => L([[-a * 0.95, -SEAT - DEEP * (1 - k / 3)], [a * 0.95, -SEAT - DEEP * (1 - k / 3)]], sd(wd), 0.6, 0.6)) : [])];
  const back = (xb: number, yt: number): Shape => P([[-xb - 1, yt + 3, 0], [0, yt], [xb + 1, yt + 3, 0], [xb + 1, yt + 13, 0], [0, yt + 10], [-xb - 1, yt + 13, 0]], s);
  const rest = (xb: number, yb: number, yt: number): Sh => [...[-1, 1].map(k => bar(k * (xb - 2.5), yb, k * (xb - 2.5), yt + 6, 2.2, c)), back(xb, yt), L([[-xb + 1, yt + 5], [0, yt + 2.5], [xb - 1, yt + 5]], lt(s), 0.8, 0.5)];
  return {
    w: 42, front: b => [...chair4(42, T, b, leg, seat, rest), R(-19.5, -12, 39, 2, c)],
    side: () => [
      bar(-D / 2 - 1, 0, D / 2 - 4, -SEAT + 1, 2.4, sd(c)), RR(-D / 2 + 7, -SEAT - 3, D - 5, 3, 1.2, s),
      bar(D / 2 - 1, 0, -D / 2 - 4, -T + 2, 2.4, c), bar(-D / 2 - 3.2, -T + 14, -D / 2 - 4.8, -T, 3, s),
      E(D / 2 - 1, -1, 1.6, 1.2, DARK), E(-D / 2 - 1, -1, 1.6, 1.2, DARK),
    ],
    // folded flat, carried by the top of its back
    fold: () => { const a = 20; return [
      ...[-1, 1].flatMap(k => [bar(k * (a - 5), 30, k * (a - 4.5), 86, 2, sd(c)), bar(k * (a - 2), 6, k * (a - 1.6), 88, 2.2, c)]),
      RR(-a + 3, 22, 2 * a - 6, 34, 2, s), ...(slats ? [1, 2].map(k => L([[-a + 4, 22 + k * 11.3], [a - 4, 22 + k * 11.3]], sd(wd), 0.6, 0.6)) : []),
      R(-a + 2, 80, 2 * a - 4, 2, c), back(a, 0),
    ]; },
  };
}

function deckChair(c: string): ChairArt {
  const wd = "#D2A56C";
  const stripes = (path: Path, x0: number, x1: number, y0: number, hh: number): Sh => { const out: Sh = []; for (let x = x0; x < x1; x += 9) out.push(R(x, y0, 4.5, hh, "#F4EFE4", { flat: true, clip: path })); return out; };
  return {
    w: 56,
    front: () => {
      const cv = 22, cloth = smooth([[-cv, -90, 0], [cv, -90, 0], [cv + 1.5, -40, 0], [0, -33], [-cv - 1.5, -40, 0]], true, 1);
      return [
        bar(-24, -58, -28, -DEEP, 3, sd(wd)), bar(24, -58, 28, -DEEP, 3, sd(wd)), bar(-25.5, -93, -27, 0, 3.4, wd), bar(25.5, -93, 27, 0, 3.4, wd),
        S(cloth, c), ...stripes(cloth, -cv - 2, cv + 2, -92, 62), R(-cv - 3, -54, 2 * cv + 6, 22, sd(c), { flat: true, opacity: 0.3, clip: cloth }),
        RR(-28, -95, 56, 4, 1.5, wd), RR(-29.5, -42, 59, 4.5, 1.5, wd),
      ];
    },
    side: () => [
      bar(-48, 0, -27, -60, 3, sd(wd)),
      S(band([[-36, -88], [-24, -60], [-8, -38], [8, -33], [22, -36], [32, -41]], [3.2]), c), L([[-34, -86], [-22, -58], [-7, -37.5], [8, -32.5], [22, -35.5]], "#F4EFE4", 0.8, 0.7),
      bar(-30, 0, 34, -42, 3.2, wd), bar(30, 0, -38, -93, 3.4, wd), E(34, -42, 2.4, 2.4, lt(wd)), E(-37.5, -92.5, 2.4, 2.4, lt(wd)),
    ],
    fold: () => { const cl = rect(-22, 4, 44, 100); return [bar(-25.5, 0, -25.5, 112, 3.4, wd), bar(25.5, 0, 25.5, 112, 3.4, wd), S(cl, c), ...stripes(cl, -24, 24, 4, 100), RR(-28, 0, 56, 4, 1.5, wd), RR(-28, 104, 56, 4, 1.5, wd)]; },
  };
}

function officeChair(c: string): ChairArt {
  const m = "#4B5058";
  const caster = (x: number, y: number, k = DARK) => E(x, y - 2.6, 3, 2.6, k);
  return {
    w: 54,
    front: back => {
      const base: Sh = [bar(0, -9, -16, -11, 3, sd(m)), bar(0, -9, 16, -11, 3, sd(m)), caster(-16, -8, "#1B1B1F"), caster(16, -8, "#1B1B1F"),
        bar(0, -9, -26, -5, 3.4, m), bar(0, -9, 26, -5, 3.4, m), bar(0, -9, 0, -4, 4, m), caster(-26, 0), caster(26, 0), caster(0, 0),
        R(-2.5, -SEAT + 3, 5, SEAT - 12, STEEL), R(-2.5, -SEAT + 3, 1.4, SEAT - 12, lt(STEEL), fl(0.7)), R(-4, -SEAT + 3, 8, 6, m)];
      const seat: Sh = [RR(-25, -SEAT - 6, 50, 11, 5, c), RR(-22, -SEAT - 5, 44, 3, 1.5, lt(c), fl(0.5)), R(-9, -SEAT + 4, 18, 2.5, DARK)];
      const rest: Sh = [R(-3, -SEAT - 20, 6, 16, DARK), RR(-21, -SEAT - 58, 42, 42, 9, back ? sd(c) : c),
        ...(back ? [RR(-17, -SEAT - 54, 34, 34, 7, dk(c), fl(0.4))] : [L([[-14, -SEAT - 30], [14, -SEAT - 30]], sd(c), 0.8, 0.5), RR(-18, -SEAT - 55, 4, 30, 2, lt(c), fl(0.35))])];
      const arms: Sh = [-1, 1].flatMap(s => [bar(s * 23.5, -SEAT - 1, s * 24.5, -SEAT - 19, 2.6, DARK), RR(s * 24.5 - 3.5, -SEAT - 23, 7, 4.5, 2, DARK)]);
      return back ? [...base, ...seat, ...arms, ...rest] : [...rest, ...base, ...seat, ...arms];
    },
    side: () => [
      bar(-24, -6, 24, -6, 3, m), caster(-24, 0), caster(24, 0), R(-2.5, -SEAT + 2, 5, SEAT - 9, STEEL), bar(-16, -SEAT - 1, -23, -SEAT - 12, 3, DARK),
      P([[-30, -SEAT - 10], [-21, -SEAT - 12], [-23, -SEAT - 55], [-31, -SEAT - 54]], c), RR(-24, -SEAT - 5, 47, 9, 4, c), RR(-21, -SEAT - 5, 40, 3, 1.5, lt(c), fl(0.5)),
      bar(3, -SEAT - 4, 3, -SEAT - 20, 2.6, DARK), RR(-9, -SEAT - 23, 22, 4.5, 2, DARK),
    ],
  };
}

function cafeChair(c: string): ChairArt {
  const cane = "#D9B77E", T = 88, D = 40;
  const weave: O = { tile: { w: 2.4, h: 2.4, shapes: [L([[0, 0], [2.4, 2.4]], sd(cane), 0.35, 0.7), L([[2.4, 0], [0, 2.4]], sd(cane), 0.35, 0.7)] } };
  const leg: Leg = (x, y0, y1, near) => [bar(x, y0, x * 1.12, y1, 2.8, near ? c : sd(c), 2.2)];
  const seat = (_t: Path, a: number): Sh => { const y = -SEAT - DEEP / 2, top = ellipse(0, y, a - 1, DEEP / 2 + 1.5); return [{ path: ellipse(0, -16, a - 3, 3.2), stroke: { color: c, width: 1.6 } }, E(0, y + 2.6, a, DEEP / 2 + 2, c), S(top, cane), S(top, cane, weave)]; };
  const rest = (xb: number, yb: number, yt: number): Sh => {
    const cy = yt + 19;
    return [...[-1, 1].map(s => bar(s * (xb - 5), yb, s * (xb - 4.5), cy, 2.6, c)), S(ellipse(0, cy, xb - 4, 19).add(ellipse(0, cy, xb - 7, 16)), c, { evenodd: true }), S(ellipse(0, cy + 9, 6, 5).add(ellipse(0, cy + 9, 4.4, 3.4)), c, { evenodd: true })];
  };
  return {
    w: 44, front: back => chair4(42, T, back, leg, seat, rest),
    side: () => [
      bar(-D / 2 + 4, -2, -D / 2 + 6, -SEAT, 2.4, dk(c)), bar(D / 2 - 2, -2, D / 2 - 4, -SEAT, 2.4, dk(c)), bar(-D / 2, 0, -D / 2 + 4, -SEAT, 2.8, c, 2.2), bar(D / 2, 0, D / 2 - 3, -SEAT, 2.8, c, 2.2),
      { path: ellipse(0, -16, D / 2 - 2, 1.6), stroke: { color: c, width: 1.6 } }, RR(-D / 2 + 1, -SEAT - 3.5, D - 2, 4, 2, c), R(-D / 2 + 2, -SEAT - 4.2, D - 4, 1.4, cane),
      S(band([[-D / 2 + 4, -SEAT - 2], [-D / 2 + 1, -SEAT - 22], [-D / 2 - 2, -T + 8], [-D / 2 + 1, -T]], [2.6]), c), S(band([[-D / 2 + 1, -SEAT - 10], [-D / 2 - 1, -SEAT - 30], [-D / 2 + 1, -T + 4]], [1.8]), c),
    ],
  };
}

/** The rattan bistro chair of a pavement terrace: bent cane legs with knuckles, a round woven seat in a loop, a tall oval back of two-tone weave. */
function bistroChair(c: string): ChairArt {
  const wv = "#D2A869", T = 90, D = 40;
  const weave: O = { tile: { w: 2.2, h: 2.2, shapes: [L([[0, 0], [2.2, 2.2]], sd(wv), 0.4, 0.8), L([[2.2, 0], [0, 2.2]], lt(wv), 0.4, 0.8)] } };
  const knuckles = (x0: number, y0: number, x1: number, y1: number): Sh => [0.3, 0.62].map(t => RR(x0 + (x1 - x0) * t - 2.4, y0 + (y1 - y0) * t - 1, 4.8, 2.2, 1, dk(c)));
  const leg: Leg = (x, y0, y1, near) => [bar(x, y0, x * 1.18, y1, 2.6, near ? c : sd(c), 2.1), ...(near ? knuckles(x, y0, x * 1.18, y1) : [])];
  const seat = (_t: Path, a: number): Sh => { const y = -SEAT - DEEP / 2, top = ellipse(0, y, a - 1, DEEP / 2 + 1.5); return [{ path: ellipse(0, -18, a - 4, 3), stroke: { color: c, width: 1.8 } }, E(0, y + 2.6, a, DEEP / 2 + 2.4, c), S(top, wv), S(top, wv, weave)]; };
  const rest = (xb: number, yb: number, yt: number): Sh => {
    const cy = yt + 22, o = ellipse(0, cy, xb - 2, 22), inner = ellipse(0, cy, xb - 5.4, 19);
    return [...[-1, 1].map(s => bar(s * (xb - 5), yb, s * (xb - 3.5), cy, 2.6, c)), S(o, c), S(inner, wv), S(inner, wv, weave), { path: ellipse(0, cy, xb - 9, 15), stroke: { color: sd(wv), width: 0.7 }, flat: true, opacity: 0.8 }, RR(-xb + 3, cy + 19, 2 * xb - 6, 3, 1.4, c)];
  };
  return {
    w: 46, front: back => chair4(44, T, back, leg, seat, rest),
    side: () => [
      bar(-D / 2 + 4, -2, -D / 2 + 7, -SEAT, 2.4, dk(c)), bar(D / 2 - 2, -2, D / 2 - 5, -SEAT, 2.4, dk(c)), bar(-D / 2, 0, -D / 2 + 4, -SEAT, 2.8, c, 2.2), bar(D / 2 + 3, 0, D / 2 - 3, -SEAT, 2.8, c, 2.2), ...knuckles(-D / 2, 0, -D / 2 + 4, -SEAT), ...knuckles(D / 2 + 3, 0, D / 2 - 3, -SEAT),
      { path: ellipse(0, -18, D / 2 - 2, 1.6), stroke: { color: c, width: 1.6 } }, RR(-D / 2 + 1, -SEAT - 3.5, D - 2, 4, 2, c), R(-D / 2 + 2, -SEAT - 4.2, D - 4, 1.4, wv),
      S(band([[-D / 2 + 4, -SEAT - 2], [-D / 2 + 1, -SEAT - 24], [-D / 2 - 4, -T + 12], [-D / 2 - 2, -T + 2]], [3]), wv), S(band([[-D / 2 + 4, -SEAT - 2], [-D / 2 + 1, -SEAT - 24], [-D / 2 - 4, -T + 12], [-D / 2 - 2, -T + 2]], [1.6]), c),
    ],
  };
}

function waitRow(c: string, seats: number): ChairArt {
  const sw = 50, Lw = seats * sw, m = "#9AA0A6";
  return {
    w: Lw,
    front: back => {
      const legs: Sh = [], backs: Sh = [], pans: Sh = [], arms: Sh = [];
      for (const s of [-1, 1]) { const x = s * (Lw / 2 - 30); legs.push(bar(x, -40, x, -3, 4.5, sd(m)), RR(x - 20, -4, 40, 4, 1.5, "#3A3D45")); }
      legs.push(R(-Lw / 2 + 6, -44, Lw - 12, 6, m), R(-Lw / 2 + 6, -44, Lw - 12, 1.4, lt(m), fl(0.7)));
      for (let i = 0; i < seats; i++) {
        const x = -Lw / 2 + sw / 2 + i * sw;
        backs.push(R(x - 2, -58, 4, 16, sd(m)), RR(x - 21, -92, 42, 40, 9, back ? sd(c) : c));
        if (back) backs.push(...[-8, 0, 8].map(dx => L([[x + dx, -86], [x + dx, -58]], dk(c), 0.8, 0.4)));
        else backs.push(RR(x - 17, -88, 4, 30, 2, lt(c), fl(0.45)));
        pans.push(Q([[x - 21, -SEAT - DEEP], [x + 21, -SEAT - DEEP], [x + 23, -SEAT], [x - 23, -SEAT]], lt(c)), RR(x - 23.5, -SEAT - 1.5, 47, 6, 3, c));
      }
      for (let j = 0; j <= seats; j++) { const x = -Lw / 2 + j * sw; arms.push(bar(x, -44, x, -62, 2.6, m), RR(x - 3, -65, 6, 4.5, 2, DARK)); }
      return back ? [...legs, ...pans, ...arms, ...backs] : [...backs, ...legs, ...pans, ...arms];
    },
    side: () => [bar(0, -40, 0, -3, 4.5, sd(m)), RR(-20, -4, 40, 4, 1.5, "#3A3D45"), bar(-6, -46, -22, -52, 3, sd(m)), R(-3.5, -46, 7, 7, m),
      S(band([[23, -SEAT - 1], [0, -SEAT - 2], [-18, -SEAT - 4], [-24, -SEAT - 18], [-27, -88]], [4]), c), bar(-2, -47, -2, -64, 2.6, m), RR(-12, -67, 22, 4.5, 2, DARK)],
  };
}

/**
 * A chair, `kind`: `plain` (a kitchen or dining chair: a slatted, ladder or padded back, seeded), `school` (a metal
 * frame, a plywood seat and back), `office` (a swivel chair on castors), `cafe` (a bentwood bistro chair with a cane
 * seat), `folding` (a folding chair, slatted or plain, for rows in a park), `deck` (a deckchair in striped canvas) or
 * `waiting` (`seats` moulded seats joined on a beam, default 3) or `bistro` (a rattan terrace chair with a woven oval back). `color` is its wood, frame, fabric, canvas or shell
 * (a palette id or a hex; seeded when left out); `cushion` a plain chair's seat fabric (`false`: none). `facing`:
 * `front` (default), `back` (from behind: its back in front of the sitter), `l` or `r` (side on, the sitter facing
 * that way). The seat is at 45 cm. `n` chairs stand in a row `gap` cm apart; `held`, it hangs from the hand by
 * its back (a folding chair or a deckchair folded flat).
 */
const chair: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "plain"), facing = str(p.facing, "front"), c0 = p.color;
  let art: ChairArt;
  if (kind === "school") art = schoolChair(col(c0, r.pick(PAINT)));
  else if (kind === "office") art = officeChair(col(c0, FABRIC[r.pick(["fab_22", "fab_24", "fab_04", "fab_21"])]));
  else if (kind === "folding") art = foldChair(col(c0, r.pick(["#CBBBA0", "#8E979E", "#3F6B4E", "#B8443A", "#3A3D45"])), r.chance(0.6));
  else if (kind === "deck") art = deckChair(col(c0, FABRIC[r.pick(["fab_14", "fab_06", "fab_04", "fab_11", "fab_05", "fab_49"])]));
  else if (kind === "waiting") art = waitRow(col(c0, r.pick(["#3C6E9E", "#D18A1C", "#5A6470", "#2F8C88", "#B8443A"])), Math.max(1, Math.min(8, Math.round(num(p.seats, 3)))));
  else if (kind === "cafe") art = cafeChair(col(c0, r.pick(["#4A2E22", "#2A2624", "#6B4A35"])));
  else if (kind === "bistro") art = bistroChair(col(c0, r.pick(["#7A4A2A", "#5A3A22", "#9A6A3A"])));
  else {
    const style = r.int(0, 2), wood = col(c0, r.pick(WOODS));
    const f = p.cushion === false ? null : typeof p.cushion === "string" ? col(p.cushion, FABRIC.fab_12) : style === 2 || r.chance(0.3) ? FABRIC[r.pick(SOFT)] : null;
    art = plainChair(wood, f, style);
  }
  const one = () => facing === "l" ? mirror(art.side()) : facing === "r" ? art.side() : art.front(facing === "back");
  const held = () => { if (art.fold) return art.fold(); const s = art.side(), [x0, y0] = groupBounds({ shapes: s, edge: 0 }); return mv(s, -x0 - 4, -y0); };
  return { flats: [propFlat("chair", p, one, num(p.gap, art.w + 16), held, 2.5)] };
}, variants: { school: { kind: "school" }, office: { kind: "office" }, cafe: { kind: "cafe" }, folding: { kind: "folding" }, deck: { kind: "deck" }, waiting_row: { kind: "waiting" }, bistro: { kind: "bistro" } },
  meta: {
    about: "A chair or a row of them: plain, school, office, café, folding, deck, a waiting row of joined seats or a rattan bistro chair.",
    params: {
      kind: { type: "enum", values: ["plain", "school", "office", "cafe", "folding", "deck", "waiting", "bistro"], default: "plain", about: "which chair" },
      color: { type: "color", about: "its wood, frame, fabric, canvas or shell; a fabric or set palette id, or a hex; default seeded" },
      cushion: { type: ["color", "bool"], about: "a plain chair's seat fabric, or false for none; default seeded" },
      facing: { type: "enum", values: ["front", "back", "l", "r"], default: "front", about: "back: from behind; l, r: side on" },
      seats: { type: "int", min: 1, max: 8, default: 3, about: "a waiting row's seats" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      gap: { type: "num", about: "cm between chairs; default its width + 16" },
    },
    terms: ["a1-w-sandalye"],
    tags: ["seating"],
  } };

// ---- Tables and desks -----------------------------------------------------------------------------

type TableOpt = { w: number; h: number; d: number; c: string; ec?: string; lc: string; th: number; legs: string; round?: boolean; apron?: number; drawer?: number; cloth?: string | null; hem?: string; drop?: number; print?: string; grain?: string; divider?: boolean };

/** A table from the front, a little of its top showing: legs (`square`, `turned`, `tube`, `pedestal`, `x`, `trestle`, `panel`, `none`), an apron and drawer, a cloth with its hem and print. */
function tableArt(o: TableOpt, r: Rng): Sh {
  const { w, h, d, c, lc, th } = o, a = w / 2, td = d * 0.13, b = a - td * 0.6, yF = o.round ? -h - td / 2 : -h - td, ec = o.ec ?? c, far: Sh = [], near: Sh = [], top: Sh = [], cloth: Sh = [];
  const leg = (x: number, y0: number, y1: number, k: string): Sh => {
    const l = y1 - y0;
    if (o.legs === "turned") return [P([[x - 2.6, y0, 0], [x + 2.6, y0, 0], [x + 2.6, y0 + l * 0.12], [x + 4, y0 + l * 0.3], [x + 2, y0 + l * 0.46], [x + 1.6, y1 - 3], [x + 2.6, y1, 0], [x - 2.6, y1, 0], [x - 1.6, y1 - 3], [x - 2, y0 + l * 0.46], [x - 4, y0 + l * 0.3], [x - 2.6, y0 + l * 0.12]], k), L([[x - 2.4, y0 + l * 0.3], [x - 1, y1 - 4]], lt(k), 0.6, 0.4)];
    if (o.legs === "tube") return [bar(x, y0, x * 1.03, y1, 3, k), RR(x * 1.03 - 2.2, y1 - 2.4, 4.4, 2.4, 1, DARK)];
    return [bar(x, y0, x, y1, 5, k, 3.8)];
  };
  if (o.legs === "pedestal") {
    const y0 = (o.round ? yF : -h) + th;
    near.push(R(-3.4, y0, 6.8, -y0 - 6, lc), R(-3.4, y0, 2, -y0 - 6, lt(lc), fl(0.4)), E(0, -h * 0.42, 4.6, 3, lc));
    for (const s of [-1, 1]) near.push(P([[0, -9, 0], [s * a * 0.55, -2.5], [s * a * 0.62, 0, 0], [s * a * 0.42, 0, 0], [0, -4, 0]], lc));
    near.push(P([[-3, -8, 0], [3, -8, 0], [2.6, 1, 0], [-2.6, 1, 0]], lc));
  } else if (o.legs === "x") {
    for (const s of [-1, 1]) { far.push(bar(s * (b - 6), -td, -s * (b - 6), -h + th - td + 2, 2.6, sd(lc))); near.push(bar(s * (a - 6), 0, -s * (a - 6), -h + th, 3, lc)); }
    near.push(E(0, -(h - th) / 2, 1.8, 1.8, dk(lc)));
  } else if (o.legs === "trestle") {
    for (const s of [-1, 1]) { const x = s * (a - 18); for (const dx of [-8, 8]) near.push(bar(x + dx, -h + th, x + dx * 1.5, 0, 2.6, lc)); near.push(R(x - 9, -h * 0.4, 18, 2, lc)); }
  } else if (o.legs === "panel") {
    for (const s of [-1, 1]) { const x = s * (a - 10); near.push(R(x - 5, -h + th, 10, h - th - 5, lc), R(x - 9, -6, 18, 6, sd(lc)), R(x - 5, -h + th, 2.5, h - th - 5, lt(lc), fl(0.35))); }
    near.push(R(-a + 15, -24, w - 30, 6, sd(lc)));
  } else if (o.legs !== "none") for (const s of [-1, 1]) { far.push(...leg(s * (b - 5), yF + th, -td, sd(lc))); near.push(...leg(s * (a - 5), -h + th, 0, lc)); }
  if (o.apron) {
    near.push(R(-a + 3, -h + th, w - 6, o.apron, sd(lc)));
    if (o.drawer !== undefined) { const dw = Math.min(30, w * 0.28), x = o.drawer; near.push(RR(x - dw / 2, -h + th + 1.5, dw, o.apron - 3, 1, lc), E(x, -h + th + o.apron / 2, 1.4, 1.4, "#D9C08A")); }
  }
  if (o.round) top.push(E(0, yF + th, a, td / 2 + 0.6, sd(ec)), R(-a, yF, w, th, ec), E(0, yF, a, td / 2 + 0.6, lt(c)));
  else top.push(Q([[-b, yF], [b, yF], [a, -h], [-a, -h]], lt(c)), R(-a, -h, w, th, ec), R(-a, -h + th - 1, w, 1, sd(ec), fl(0.6)));
  if (!o.cloth && o.grain === "marble") for (let i = 0; i < 3; i++) { const x = r.range(-a * 0.7, a * 0.4); top.push(L([[x, yF + td * 0.25], [x + a * 0.15, yF + td * r.range(0.4, 0.6)], [x + a * 0.35, yF + td * 0.8]], "#9C978E", 0.5, 0.45)); }
  else if (!o.cloth && o.grain) for (let i = 0; i < 3; i++) { const y = yF + td * (0.25 + i * 0.25); top.push(L([[-b + r.range(4, 20), y], [b - r.range(4, 30), y + 0.4]], sd(c), 0.5, 0.3)); }
  if (o.divider) top.push(R(-a + 22, yF + td / 2 - 22, w - 44, 22, lc), R(-a + 20, yF + td / 2 - 25, w - 40, 3.5, lt(lc)), R(-a + 22, yF + td / 2 - 2, w - 44, 2, dk(lc), fl(0.5)));
  if (o.cloth) {
    const cc = o.cloth, yb = -h + (o.drop ?? 20), k = Math.max(4, Math.round(w / 16)), y0 = o.round ? yF : -h - 0.5, pts: Pt[] = [[-a - 2, y0, 0], [a + 2, y0, 0]];
    for (let i = 0; i <= k; i++) { const x = a + 3 - (w + 6) * i / k, y = yb + (i % 2 ? 1.8 : 0); pts.push(i === 0 || i === k ? [x, y, 0] : [x, y]); }
    const hang = smooth(pts, true, 1), surf = o.round ? ellipse(0, yF, a + 2, td / 2 + 1.6) : poly([[-b - 1.5, yF - 0.6], [b + 1.5, yF - 0.6], [a + 2, -h - 0.5], [-a - 2, -h - 0.5]]);
    cloth.push(S(hang, cc), S(surf, lt(cc)));
    const tile = o.print === "check" ? [R(0, 0, 5, 10, "#FFFFFF", fl(0.5)), R(0, 0, 10, 5, "#FFFFFF", fl(0.5))] : o.print === "dots" ? [E(2.5, 2.5, 1.3, 1.3, "#FFFFFF", fl(0.85)), E(7.5, 7.5, 1.3, 1.3, "#FFFFFF", fl(0.85))] : null;
    if (tile) for (const pth of [hang, surf]) cloth.push(S(pth, cc, { tile: { w: 10, h: 10, shapes: tile } }));
    for (let i = 0; i < k; i++) { const x = -a + (i + 0.5 + r.range(-0.25, 0.25)) * w / k; cloth.push(L([[x, -h + 3], [x + r.range(-1, 1), yb - 2]], sd(cc), 0.8, 0.3)); }
    if (o.hem === "lace") for (let x = -a - 2; x <= a + 2.1; x += 4) cloth.push(E(x, yb + 1.4, 2.2, 2.2, cc), E(x, yb + 1.6, 0.7, 0.7, sd(cc), fl(0.8)));
    else if (o.hem === "scallop") for (let x = -a; x <= a + 0.1; x += 7) cloth.push(E(x, yb + 0.5, 3.6, 2.6, cc));
  }
  return [...far, ...near, ...top, ...cloth];
}

/** Each table kind's size, cm: width, height (puppet scale) and depth. */
const TABLE_SIZE: Record<string, { w: number; h: number; d: number }> = {
  kitchen: { w: 110, h: 76, d: 70 },
  dining: { w: 180, h: 76, d: 90 },
  tea: { w: 58, h: 55, d: 58 },
  party: { w: 170, h: 76, d: 75 },
  cafe: { w: 62, h: 74, d: 62 },
  library: { w: 240, h: 76, d: 100 },
  folding: { w: 80, h: 72, d: 55 },
  plain: { w: 120, h: 76, d: 75 },
};

function tableOpt(kind: string, p: Params, r: Rng): TableOpt {
  const wood = col(p.color, r.pick(WOODS)), dw = col(p.color, r.pick(DARKWOOD));
  const cloth = (d: string) => p.cloth === true ? d : typeof p.cloth === "string" ? col(p.cloth, d) : null;
  switch (kind) {
    case "kitchen": return { ...TABLE_SIZE.kitchen, c: col(p.color, r.pick(["#E9E1CC", "#CFE0CF", "#C9DCE6", "#F0DDBF"])), ec: STEEL, lc: r.pick(["#F4F1EA", "#A8754A", "#5B7F6A"]), th: 3, legs: "square", apron: 9, drawer: 22, cloth: cloth(FABRIC.fab_14), print: "check", drop: 16 };
    case "dining": return { ...TABLE_SIZE.dining, c: dw, lc: dw, th: 4, legs: "turned", apron: 10, cloth: cloth(FABRIC.fab_01), hem: "lace", drop: 26, grain: "wood" };
    case "tea": return { ...TABLE_SIZE.tea, c: dw, lc: dw, th: 3, legs: r.chance(0.5) ? "pedestal" : "turned", round: true, cloth: cloth(FABRIC.fab_01), hem: "lace", drop: 6 };
    case "party": return { ...TABLE_SIZE.party, c: "#E9E4DA", lc: "#8E979E", th: 3, legs: "trestle", cloth: cloth(FABRIC[r.pick(["fab_14", "fab_11", "fab_06", "fab_15", "fab_05", "fab_10"])]), print: "dots", hem: "scallop", drop: 52 };
    case "cafe": { const t = r.pick(["marble", "wood", "metal"]); return { ...TABLE_SIZE.cafe, c: col(p.color, t === "marble" ? "#E8E4DC" : t === "wood" ? "#B5835A" : "#C3C8CE"), lc: "#2E2B2B", th: 2.5, legs: "pedestal", round: true, grain: t === "marble" ? "marble" : undefined, cloth: cloth(FABRIC.fab_14), print: "check", drop: 14 }; }
    case "library": return { ...TABLE_SIZE.library, c: dw, lc: dw, th: 6, legs: "panel", grain: "wood", divider: p.divider !== false };
    case "folding": return { ...TABLE_SIZE.folding, c: col(p.color, r.pick(["#E9E4DA", "#D8CFBF", "#8DB8DA"])), ec: "#5A6470", lc: "#8E979E", th: 2.5, legs: "x" };
    default: return { ...TABLE_SIZE.plain, c: wood, lc: wood, th: 4, legs: "square", apron: 8, grain: "wood", cloth: cloth(FABRIC.fab_02), hem: "plain", drop: 18 };
  }
}

/**
 * A table, `kind`: plain (default, wooden), `kitchen` (a formica top on painted legs, a drawer), `dining` (a long family
 * table on turned legs), `tea` (a small round tea table), `party` (a trestle table under a dotted cloth to the knees),
 * `cafe` (a small round café table on a cast-iron foot: marble, wood or metal), `library` (a long reading table on end
 * panels, a low divider along its middle unless `divider` is false) or `folding` (a small table on X legs). `w`, `h` (72–80 at puppet scale)
 * and `d` (depth) in cm; `color` its top (or wood); `cloth`: true or a colour lays a cloth on it (a check oilcloth on a
 * kitchen or café table, lace on a dining or tea table, a dotted one on a party table). `n` tables `gap` apart; held,
 * it is carried hanging from its top edge (a folding table folded flat).
 */
const table: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "plain"), o = tableOpt(kind, p, r);
  o.w = num(p.w, o.w); o.h = num(p.h, o.h); o.d = num(p.d, o.d);
  const art = tableArt(o, r), a = o.w / 2;
  const held = () => kind === "folding"
    ? [RR(-a, 0, o.w, 40, 2, o.ec ?? o.c), RR(-a + 1.5, 1.5, o.w - 3, 37, 1.5, o.c), bar(-a + 8, 6, -a + 8, 34, 2.4, o.lc), bar(a - 8, 6, a - 8, 34, 2.4, o.lc), bar(-a + 8, 20, a - 8, 20, 2, o.lc)]
    : mv(art, 0, o.h + o.d * 0.13);
  return { flats: [propFlat("table", p, () => art, num(p.gap, o.w + 30), held, 2.2)] };
}, variants: { kitchen: { kind: "kitchen" }, dining: { kind: "dining", cloth: true }, tea: { kind: "tea", cloth: true }, party: { kind: "party", cloth: true }, cafe: { kind: "cafe" }, library: { kind: "library" }, folding: { kind: "folding" } },
  meta: {
    about: "A table: plain, kitchen, dining, tea, party, café, library or folding; a cloth on it if asked.",
    params: {
      kind: { type: "enum", values: ["plain", "kitchen", "dining", "tea", "party", "cafe", "library", "folding"], default: "plain", about: "which table" },
      w: { type: "num", about: "cm; default by kind" },
      h: { type: "num", about: "cm; default by kind (72–80)" },
      d: { type: "num", about: "depth, cm; default by kind" },
      color: { type: "color", about: "its top or wood; a fabric or set palette id, or a hex; default seeded" },
      cloth: { type: ["bool", "color"], about: "true lays the kind's cloth; a colour (palette id or hex) lays one in it" },
      divider: { type: "bool", default: true, about: "a library table's low divider" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      gap: { type: "num", about: "cm between tables; default w + 30" },
    },
    terms: ["a1-w-masa"],
  } };

/** Papers, a pen pot, books and a mug on a teacher's desk; a monitor's back, a paper tray and folders on an office one: standing on y = 0, across `w`. */
function deskThings(kind: string, w: number, r: Rng): Sh {
  const a = w / 2, out: Sh = [];
  const papers = (x: number) => { out.push(RR(x - 15, -4, 30, 4, 0.5, "#E9E4DA"), L([[x - 14, -1.3], [x + 14, -1.3]], "#C9C2B4", 0.4, 0.8), L([[x - 14, -2.7], [x + 14, -2.7]], "#C9C2B4", 0.4, 0.8), Q([[x - 13, -4.5], [x + 14, -5.5], [x + 15, -3.6], [x - 12, -3]], PAPER)); };
  if (kind === "teacher") {
    papers(-a * 0.15);
    const px = a * 0.55, pc = r.pick(["#2F8C88", "#C4553A", "#2E3A59"]);
    for (const [dx, h, c] of [[-2, 16, "#2E3A59"], [0.5, 18, "#D9534A"], [2.5, 15, "#E0A83A"]] as const) out.push(bar(px + dx, -8, px + dx * 1.6, -h, 1.2, c));
    out.push(RR(px - 4.5, -11, 9, 11, 1.5, pc), R(px - 4.5, -11, 9, 1.5, lt(pc), fl(0.6)));
    out.push(RR(-a * 0.72 - 13, -4, 26, 4, 0.8, "#4F6E9E"), RR(-a * 0.72 - 12, -7.5, 24, 3.5, 0.8, "#B3261E"), R(-a * 0.72 - 11, -6.8, 22, 1, PAPER, fl(0.7)));
    if (r.chance(0.6)) out.push({ path: ellipse(a * 0.8 + 4, -5, 2.6, 3), stroke: { color: "#F2F1EC", width: 1.2 } }, RR(a * 0.8 - 4, -10, 8, 10, 1.5, "#F2F1EC"));
    else out.push(E(a * 0.82, -4, 4, 4, "#C4402E"), L([[a * 0.82, -7.6], [a * 0.82 + 0.6, -9.8]], "#5A3A28", 0.7, 1), E(a * 0.82 + 2, -9, 1.6, 0.8, "#4E7A48"));
  } else {
    const mx = -a * 0.45;
    out.push(E(mx, -1, 9, 1.6, "#3A3D45"), R(mx - 2, -16, 4, 15, "#4B5058"), RR(mx - 26, -50, 52, 34, 2, "#3A3D45"), RR(mx - 22, -46, 44, 26, 2, "#4B5058", fl(0.6)), ...[0, 1, 2].map(i => L([[mx - 10, -42 + i * 3], [mx + 10, -42 + i * 3]], "#2B2B30", 0.6, 0.6)));
    papers(a * 0.05);
    out.push(R(a * 0.05 - 16, -9, 32, 2, "#9AA0A6"), R(a * 0.05 - 16, -9, 1.5, 9, "#9AA0A6"), R(a * 0.05 + 14.5, -9, 1.5, 9, "#9AA0A6"));
    let x = a * 0.55;
    for (let i = 0; i < r.int(3, 5); i++) { const c = r.pick(["#2E3A59", "#C4553A", "#2F8C88", "#E0A83A", "#6F7A45"]); out.push(RR(x, -28, 6, 28, 0.8, c), E(x + 3, -20, 1.6, 1.6, PAPER, fl(0.9)), R(x + 1, -10, 4, 6, PAPER, fl(0.8))); x += 6.4; }
  }
  return out;
}

/** Each desk kind's size, cm: width, height and depth. */
const DESK_SIZE: Record<string, { w: number; h: number; d: number }> = {
  home: { w: 110, h: 75, d: 60 },
  school: { w: 70, h: 72, d: 50 },
  teacher: { w: 140, h: 76, d: 70 },
  office: { w: 150, h: 76, d: 75 },
};

/**
 * A desk, `kind`: a writing desk (default: wood, a drawer), `school` (a laminate top on a tube frame in `color`, a book
 * shelf under it), `teacher` (wooden, a front panel and a drawer pedestal; papers, a pen pot, books and a mug or an
 * apple on it) or `office` (a laminate top on a steel leg and a grey drawer pedestal; a monitor seen from behind, a
 * paper tray and folders on it). `w`, `h` in cm; `color` its wood or (school) its frame. `things: false` clears the top.
 * `n` desks side by side, `gap` apart (a row of school desks).
 */
const desk: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "home"), wood = col(p.color, r.pick(WOODS));
  let o: TableOpt;
  if (kind === "school") o = { ...DESK_SIZE.school, c: r.pick(["#E2D4B4", "#D9C29A", "#CFDCCF"]), ec: "#5A4A3E", lc: col(p.color, r.pick(PAINT)), th: 2.6, legs: "tube" };
  else if (kind === "teacher") o = { ...DESK_SIZE.teacher, c: wood, lc: wood, th: 4, legs: "square", grain: "wood" };
  else if (kind === "office") o = { ...DESK_SIZE.office, c: r.pick(["#D9D6CF", "#EDEAE3", "#C9A47A"]), ec: "#4A4F55", lc: "#9AA0A6", th: 3, legs: "none" };
  else o = { ...DESK_SIZE.home, c: wood, lc: wood, th: 3.5, legs: "square", apron: 10, drawer: 28, grain: "wood" };
  o.w = num(p.w, o.w); o.h = num(p.h, o.h);
  const { w, h, th, lc } = o, a = w / 2, sh = tableArt(o, r);
  if (kind === "school") {
    sh.push(R(-a + 5, -h + th, w - 10, 12, dk(lc)));
    let x = -a + 8;
    while (x < a - 14) { const bw = r.range(2.5, 5); sh.push(R(x, -h + th + r.range(2, 4), bw, 9, r.pick(["#C4553A", "#2E3A59", "#E0A83A", "#2F8C88", PAPER]))); x += bw + r.range(0.3, 3); }
    for (let k = 0; k < 6; k++) sh.push(L([[-a + 5 + (k + 0.5) * (w - 10) / 6, -h + th], [-a + 5 + (k + 0.5) * (w - 10) / 6, -h + th + 12]], lc, 0.8, 0.9));
    sh.push(R(-a + 5, -h + th + 10.5, w - 10, 1.5, lc), R(-a + 6, -16, w - 12, 2.4, lc));
  } else if (kind === "teacher") {
    sh.push(R(-a + 3, -h + th, w - 6, h - th - 22, sd(wood)));
    for (const x of [-a + 8, -a + 8 + (w - 62) / 2]) sh.push(RR(x, -h + th + 5, (w - 62) / 2 - 4, h - th - 32, 1.5, wood, fl(0.6)));
    sh.push(R(a - 46, -h + th, 42, h - th - 3, wood), R(a - 46, -h + th, 3, h - th - 3, lt(wood), fl(0.35)));
    for (let i = 0; i < 3; i++) { const y = -h + th + 3 + i * (h - th - 8) / 3; sh.push(RR(a - 42, y, 34, (h - th - 8) / 3 - 3, 1.2, lt(wood), fl(0.5)), R(a - 31, y + 5, 12, 2, "#C9B48A")); }
  } else if (kind === "office") {
    const m = "#9AA0A6";
    sh.push(bar(-a + 9, -h + th - 4, -a + 9, -4, 4.5, sd(m)), bar(-a + 6, -h + th, -a + 6, -2, 4.5, m), R(-a + 1, -4, 14, 4, dk(m)), R(-a + 12, -h + th, w - 60, 32, sd("#C9C6BF")));
    sh.push(S(rect(-a + 12, -h + th, w - 60, 32), "#000000", { tile: { w: 4, h: 4, shapes: [E(2, 2, 0.6, 0.6, "#000000", fl(0.25))] } }));
    sh.push(R(a - 46, -h + th + 1, 42, h - th - 7, "#8E979E"), R(a - 46, -h + th + 1, 3, h - th - 7, lt("#8E979E"), fl(0.4)));
    for (let i = 0; i < 3; i++) { const y = -h + th + 4 + i * (h - th - 12) / 3; sh.push(RR(a - 43, y, 36, (h - th - 12) / 3 - 2.5, 1, "#A3AAB0"), R(a - 31, y + 3, 12, 1.6, "#4B5058")); }
    sh.push(E(a - 40, -2.6, 2.6, 2.6, DARK), E(a - 10, -2.6, 2.6, 2.6, DARK));
  }
  if ((kind === "teacher" || kind === "office") && p.things !== false) sh.push(...mv(deskThings(kind, w, r), 0, -h - o.d * 0.06));
  const row = rowOf(sh, count(p), num(p.gap, w + 30));
  return { flats: [{ group: { shapes: row, edge: 0.7 }, ppcm: ppcmFor(row, 2.2) }] };
}, variants: { school: { kind: "school" }, teacher: { kind: "teacher" }, office: { kind: "office" } },
  meta: {
    about: "A desk: a wooden writing desk, a school desk with a book shelf, a teacher's desk or an office desk with a monitor.",
    params: {
      kind: { type: "enum", values: ["home", "school", "teacher", "office"], default: "home", about: "home: a writing desk" },
      w: { type: "num", about: "cm; default by kind" },
      h: { type: "num", about: "cm; default by kind" },
      color: { type: "color", about: "its wood, or a school desk's frame; default seeded" },
      things: { type: "bool", default: true, about: "papers and things on a teacher's or office desk" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (a row of school desks)" },
      gap: { type: "num", about: "cm between desks; default w + 30" },
    },
    terms: ["a1-w-masa"],
  } };

// ---- Sofa and bed -------------------------------------------------------------------------------

/** Lace: a crocheted doily or cloth `w` × `h` under (x, y), scalloped, its holes showing. */
function lace(x: number, y: number, w: number, h: number): Sh {
  const c = "#F7F3EA", out: Sh = [P([[x - w / 2, y, 0], [x + w / 2, y, 0], [x + w * 0.42, y + h * 0.6], [x, y + h], [x - w * 0.42, y + h * 0.6]], c)];
  for (let i = 0; i <= 8; i++) { const t = i / 8, [px, py] = t < 0.5 ? [x - w * 0.42 + t * 2 * w * 0.42, y + h * 0.6 + t * 2 * h * 0.4] : [x + (t - 0.5) * 2 * w * 0.42, y + h - (t - 0.5) * 2 * h * 0.4]; out.push(E(px, py, 2, 2, c)); }
  for (let j = 0; j < 3; j++) for (let i = -3 + j; i <= 3 - j; i++) out.push(E(x + i * w * 0.11, y + h * (0.2 + j * 0.22), 1, 1, "#C9C2B4", fl(0.55)));
  return out;
}

/**
 * A sofa `w` cm wide (default 200) in `color` (a palette fabric id or a hex; seeded): back and seat cushions, rolled
 * arms, two scatter cushions; or (`kind` `armchair`) an old armchair, 86 cm, on a carved wooden frame with a buttoned
 * back. `lace` lays a lace cloth on its back (an armchair's default); `throw` drapes a knitted shawl over it (true, or a
 * colour). The seat is at about 45 cm.
 */
const sofa: PieceDef = { draw(p, r) {
  const arm = str(p.kind, "sofa") === "armchair", c = col(p.color, FABRIC[r.pick(arm ? ["fab_50", "fab_09", "fab_19", "fab_16", "fab_43", "fab_13"] : SOFT)]), wood = r.pick(DARKWOOD);
  const w = num(p.w, arm ? 86 : 200), a = w / 2, sh: Sh = [];
  if (!arm) {
    const k = Math.max(1, Math.round((w - 52) / 50)), cw = (w - 52) / k;
    sh.push(...[-1, 1].map(s => bar(s * (a - 12), -10, s * (a - 11), 0, 4, wood, 3)), RR(-a + 8, -94, w - 16, 58, 12, sd(c)));
    for (let i = 0; i < k; i++) { const x = -a + 26 + i * cw; sh.push(RR(x + 1, -90, cw - 2, 42, 10, c), RR(x + 5, -88, cw - 10, 4, 2, lt(c), fl(0.5))); }
    sh.push(Q([[-a + 22, -56], [a - 22, -56], [a - 20, -48], [-a + 20, -48]], lt(c)));
    for (let i = 0; i < k; i++) { const x = -a + 26 + i * cw; sh.push(RR(x, -51, cw, 14, 4, c), RR(x + 3, -50.5, cw - 6, 2.6, 1.3, lt(c), fl(0.5))); }
    sh.push(R(-a + 12, -38, w - 24, 28, sd(c)), L([[-a + 12, -36], [a - 12, -36]], dk(c), 0.6, 0.4));
    for (const s of [-1, 1]) { const x = s > 0 ? a - 26 : -a; sh.push(RR(x, -68, 26, 58, 10, c), RR(x + 4, -58, 18, 44, 6, sd(c), fl(0.22)), E(x + 13, -66, 14, 6.5, lt(c))); }
    for (const s of [-1, 1]) sh.push(...pillow(s * (a - 44), -64, 28, -s * 0.2, FABRIC[r.pick(SOFT.filter(f => FABRIC[f] !== c))]));
  } else {
    sh.push(...[-1, 1].map(s => P([[s * (a - 9), -20, 0], [s * (a - 3), -20, 0], [s * (a - 2), -8], [s * (a + 1.5), -0.5, 0], [s * (a - 3), 0, 0], [s * (a - 6), -9]], wood)));
    sh.push(P([[-a + 7, -54, 0], [-a + 5, -98], [0, -116], [a - 5, -98], [a - 7, -54, 0]], wood), P([[-a + 11, -56, 0], [-a + 9.5, -97], [0, -111], [a - 9.5, -97], [a - 11, -56, 0]], c));
    for (let j = 0; j < 3; j++) for (let i = -2 + (j % 2) * 0.5; i <= 2; i++) sh.push(E(i * (a - 18) / 2.2, -95 + j * 12, 1.1, 1.1, dk(c), fl(0.7)));
    sh.push(Q([[-a + 16, -54], [a - 16, -54], [a - 13, -47], [-a + 13, -47]], lt(c)), RR(-a + 12, -49, w - 24, 13, 5, c), RR(-a + 15, -48.5, w - 30, 2.5, 1.2, lt(c), fl(0.5)));
    sh.push(P([[-a + 7, -37, 0], [a - 7, -37, 0], [a - 7, -22, 0], [a * 0.4, -18], [0, -21], [-a * 0.4, -18], [-a + 7, -22, 0]], wood), L([[-a + 12, -33], [a - 12, -33]], lt(wood), 0.6, 0.4));
    for (const s of [-1, 1]) { const x = s > 0 ? a - 17 : -a + 1; sh.push(RR(x, -68, 16, 48, 6, c), RR(x - 1.5, -72, 19, 6, 3, wood), E(x + 8, -69, 4, 3.6, lt(wood))); }
  }
  if (p.lace ?? arm) sh.push(...lace(0, arm ? -108 : -93, arm ? 34 : 46, arm ? 30 : 34));
  if (p.throw) {
    const tc = col(p.throw === true ? r.pick(["fab_15", "fab_10", "fab_17", "fab_07", "fab_12"]) : p.throw, FABRIC.fab_15), x0 = arm ? -a + 6 : -a + 30, x1 = arm ? a - 10 : -a + 100, xm = (x0 + x1) / 2;
    const edge: Vec2[] = [[x0 + 4, -56], [xm, -60], [x1 - 6, -52]], path = smooth([[x0, -96, 0], [x1, -94, 0], [x1 + 4, -72], cp(edge[2]), edge[1], cp(edge[0]), [x0 - 2, -76]], true, 1);
    sh.push(S(path, tc), S(path, tc, { tile: { w: 4, h: 3, shapes: [L([[0, 0], [2, 2], [4, 0]], sd(tc), 0.5, 0.6)] } }));
    for (let i = 0; i < 2; i++) for (let t = 0; t <= 1; t += 0.12) { const x = edge[i][0] + (edge[i + 1][0] - edge[i][0]) * t, y = edge[i][1] + (edge[i + 1][1] - edge[i][1]) * t; sh.push(L([[x, y], [x + 0.3, y + 4]], sd(tc), 0.6, 0.9)); }
  }
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, ppcm: 2.2, shadow: "drop" }] };
}, variants: { armchair: { kind: "armchair" } },
  meta: {
    about: "A sofa with cushions and rolled arms, or an old buttoned armchair on a carved frame; a lace cloth or a knitted throw on it.",
    params: {
      kind: { type: "enum", values: ["sofa", "armchair"], default: "sofa" },
      w: { type: "num", about: "cm; sofa 200, armchair 86" },
      color: { type: "color", about: "a fabric or set palette id, or a hex; default seeded" },
      lace: { type: "bool", about: "a lace cloth on its back; default on an armchair" },
      throw: { type: ["bool", "color"], about: "a knitted shawl over it; true, or a colour" },
    },
    terms: ["a1-w-kanepe", "a1-w-koltuk"],
    tags: ["seating"],
  } };

/**
 * A bed `w` cm long (default 200), seen from its side and a little above, its head at the left (`dir` −1: at the right):
 * a wooden head- and footboard (`wood`), the mattress, a pillow, and a cover in `color` (a palette id or a hex;
 * seeded) turned down at the pillow, its print seeded (plain, stripes or checks).
 */
const bed: PieceDef = { draw(p, r) {
  const Lb = num(p.w, 200), a = Lb / 2, c = col(p.color, FABRIC[r.pick(SOFT)]), wood = col(p.wood, r.pick(WOODS)), top = -52, td = 18, sheet = "#F4F1EA", x0 = -a + 50, hem = -26;
  const sh: Sh = [RR(-a - 2, -112 - td, 9, 110, 3, sd(wood)), RR(a - 8, -72 - td, 8, 70, 3, sd(wood)), R(-a, -38, Lb, 16, wood), R(-a, -38, Lb, 2, lt(wood), fl(0.4))];
  sh.push(Q([[-a + 6, top - td], [a - 8, top - td], [a - 6, top], [-a + 4, top]], sheet), R(-a + 4, top, Lb - 10, 16, "#E6DFD0"), L([[-a + 5, top + 5], [a - 7, top + 5]], "#CFC6B4", 0.6, 0.6), L([[-a + 5, top + 10], [a - 7, top + 10]], "#CFC6B4", 0.6, 0.6));
  sh.push(P([[-a + 8, top - td + 3], [-a + 10, top - td - 9], [x0 - 12, top - td - 8], [x0 - 8, top - td + 3], [x0 - 12, top + 1], [-a + 9, top + 1]], "#FBF8F2"), L([[-a + 14, top - td - 3], [x0 - 16, top - td - 2]], "#D8D2C4", 0.6, 0.6));
  const pts: Pt[] = [[x0, top - td - 1, 0], [a - 9, top - td - 1, 0], [a - 6, top + 2], [a - 5, hem, 0]];
  for (let i = 1, k = Math.round((a - 5 - x0) / 14); i < k; i++) pts.push([a - 5 - i * (a - 5 - x0) / k, hem + (i % 2) * 1.6]);
  pts.push([x0 - 3, hem + 1, 0], [x0 - 3, top, 0]);
  const cover = smooth(pts, true, 1), surf = poly([[x0, top - td - 1], [a - 9, top - td - 1], [a - 7, top + 0.5], [x0 - 3, top + 0.5]]), print = r.int(0, 2);
  sh.push(S(cover, c), S(surf, lt(c)));
  if (print) for (const pth of [cover, surf]) sh.push(S(pth, c, { tile: { w: 12, h: 12, shapes: print === 1 ? [R(0, 0, 4, 12, "#FFFFFF", fl(0.35))] : [R(0, 0, 6, 12, "#FFFFFF", fl(0.3)), R(0, 0, 12, 6, "#FFFFFF", fl(0.3))] } }));
  for (let i = 0; i < 4; i++) { const x = x0 + 20 + i * (a - x0 - 30) / 3 + r.range(-6, 6); sh.push(L([[x, top + 4], [x + r.range(-2, 2), hem - 2]], sd(c), 0.8, 0.35)); }
  sh.push(Q([[x0 - 9, top - td - 1], [x0 + 3, top - td - 1], [x0, top + 1], [x0 - 12, top + 1]], sheet), R(x0 - 12, top, 12, hem - top + 1, sheet), L([[x0 - 1, top + 2], [x0 - 1, hem]], "#D8D2C4", 0.6, 0.7));
  sh.push(P([[-a - 7, 0, 0], [-a + 6, 0, 0], [-a + 6, -100], [-a + 1, -112], [-a - 7, -106, 0]], wood), RR(-a - 3, -98, 6, 60, 2, lt(wood), fl(0.3)), RR(a - 7, -70, 10, 70, 3, wood), R(a - 7, -70, 10, 3, lt(wood), fl(0.5)));
  return { flats: [{ group: { shapes: num(p.dir, 1) < 0 ? mirror(sh) : sh, edge: 0.8 }, ppcm: 2, shadow: "drop" }] };
}, meta: {
  about: "A bed seen from its side: wooden head- and footboard, mattress, pillow and a cover turned down, its print seeded.",
  params: {
    w: { type: "num", default: 200, about: "length, cm" },
    color: { type: "color", about: "the cover; a fabric or set palette id, or a hex; default seeded" },
    wood: { type: "color", about: "default seeded" },
    dir: { type: "int", min: -1, max: 1, default: 1, about: "-1: its head at the right" },
  },
  terms: ["a1-w-yatak"],
} };

// ---- Kitchen ------------------------------------------------------------------------------------

/** Base cupboards `w` × `h` in `cc` with `doors` doors (a drawer over each), a plinth and a worktop `wt`, its top showing. */
function cupboards(w: number, h: number, cc: string, wt: string, doors: number): Sh {
  const a = w / 2, dw = (w - 6) / doors, out: Sh = [R(-a, -h + 4, w, h - 4, cc), R(-a + 3, -9, w - 6, 9, mix(dk(cc), "#3A3430", 0.55))];
  for (let i = 0; i < doors; i++) {
    const x = -a + 3 + i * dw, hx = i % 2 ? x + 5 : x + dw - 5;
    out.push(RR(x + 1.5, -h + 8, dw - 3, 11, 1.2, lt(cc), fl(0.5)), R(x + dw / 2 - 5, -h + 12.5, 10, 2, STEEL));
    out.push(RR(x + 1.5, -h + 22, dw - 3, h - 33, 1.5, sd(cc), fl(0.35)), RR(x + 3, -h + 24, dw - 6, h - 37, 1.2, cc), R(hx - 1, -h + 26, 2, 12, STEEL));
  }
  out.push(Q([[-a + 1, -h - 7], [a - 1, -h - 7], [a + 2, -h - 1], [-a - 2, -h - 1]], lt(wt)), R(-a - 2, -h - 1, w + 4, 5, wt), R(-a - 2, -h + 3, w + 4, 1, dk(wt), fl(0.5)));
  return out;
}

/** The tiles behind a worktop: `w` wide from `y0` up `hh`, in `tc` with a band of `accent` tiles. */
function splash(w: number, y0: number, hh: number, tc: string, accent: string): Sh {
  const a = w / 2, grid = { tile: { w: 15, h: 15, shapes: [R(0, 0, 15, 0.8, "#BDB4A4", fl(0.9)), R(0, 0, 0.8, 15, "#BDB4A4", fl(0.9))] } };
  return [R(-a, y0 - hh, w, hh, tc), S(rect(-a, y0 - hh, w, hh), tc, grid), R(-a, y0 - hh * 0.6, w, 7.5, accent), S(rect(-a, y0 - hh * 0.6, w, 7.5), accent, { tile: { w: 7.5, h: 7.5, shapes: [Q([[3.75, 0.8], [6.7, 3.75], [3.75, 6.7], [0.8, 3.75]], "#FFFFFF", fl(0.5))] } })];
}

/**
 * Kitchen fittings, `kind`: `counter` (default: base cupboards, a worktop, a tiled splash and `upper` wall cupboards,
 * a few things at its ends), `sink` (the sink and its tap, a dish rack, a tea towel; `running` lets the tap run), `oven`
 * (a home cooker: four burners, knobs, a glass door that glows when `on`) or `bakery_oven` (a bakery's big oven, its
 * `front` `tile` or `steel`, a glowing arched mouth with loaves inside, a peel; steam, and a warm light). `w`, `h` in
 * cm; `color` the cupboards' colour.
 */
const kitchen: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "counter");
  if (kind === "bakery_oven") return bakeryOven(p, r);
  const cc = col(p.color, r.pick(["#F4F1EA", "#CFE0CF", "#C99A68", "#E3D6BC", "#9DB5C4"])), wt = r.pick(["#8A7F72", "#D8CFBF", "#5A5048", "#C99A68"]), tc = r.pick(["#F4F1EA", "#E8EEF0", "#F2E6D0"]), accent = r.pick(["#2F5E9E", "#C4553A", "#2F8C88", "#E0A83A"]);
  const sh: Sh = [], glow: Sh = [];
  if (kind === "oven") {
    const w = num(p.w, 60), h = num(p.h, 86), a = w / 2, body = r.pick(["#F2F1EC", "#E9E4DA", "#C9CED3"]);
    sh.push(R(-a, -h - 22, w, 16, sd(body)), R(-a + 3, -h - 19, w - 6, 2, lt(body), fl(0.5)));
    sh.push(Q([[-a + 2, -h - 8], [a - 2, -h - 8], [a, -h], [-a, -h]], "#3A3D45"));
    for (const [x, y] of [[-a * 0.48, -h - 5.5], [a * 0.48, -h - 5.5], [-a * 0.5, -h - 2.4], [a * 0.5, -h - 2.4]]) sh.push(E(x, y, 6, 1.6, "#1E1E22"), L([[x - 6, y], [x + 6, y]], "#6B737A", 0.5, 0.9));
    sh.push(R(-a, -h, w, h - 4, body), R(-a, -h, w, 9, sd(body)), ...[-0.7, -0.35, 0, 0.35, 0.7].map(k => E(a * k, -h + 4.5, 2.2, 2.2, DARK)));
    sh.push(RR(-a + 3, -h + 12, w - 6, 48, 2, body), RR(-a + 3, -h + 12, w - 6, 48, 2, sd(body), fl(0.25)), RR(-a + 9, -h + 22, w - 18, 26, 3, "#2E3338"), L([[-a + 12, -h + 44], [-a + 20, -h + 26]], "#FFFFFF", 1.2, 0.18));
    glow.push(RR(-a + 9, -h + 22, w - 18, 26, 3, "#FF9A40", fl(0.85)));
    sh.push(R(-a + 6, -h + 15.5, w - 12, 2.6, STEEL), RR(-a + 3, -h + 63, w - 6, 15, 1.5, sd(body), fl(0.3)), R(-8, -h + 66, 16, 2, STEEL), R(-a + 2, -4, 5, 4, DARK), R(a - 7, -4, 5, 4, DARK));
    const on = !!p.on;
    return { flats: [{ group: { shapes: sh, edge: 0.7 }, ...(on ? { emissive: { shapes: glow, edge: 0 } } : {}), ppcm: 2.6, shadow: "drop" }], ...(on ? { lights: [{ x: 0, y: h - 35, z: 20, color: "#FFB070", radius: 1.6, intensity: 0.35 }] } : {}) };
  }
  const sink = kind === "sink", w = num(p.w, sink ? 110 : 180), h = num(p.h, 86), a = w / 2;
  sh.push(...splash(w, -h - 7, 56, tc, accent));
  if (p.upper ?? !sink) {
    const k = Math.max(1, Math.round(w / 50)), dw = w / k, uy = -h - 63;
    sh.push(R(-a, uy, w, 6, "#000000", fl(0.1)), R(-a, uy - 70, w, 70, cc), R(-a - 2, uy - 73, w + 4, 4, lt(cc)), R(-a, uy - 3, w, 3, sd(cc)));
    for (let i = 0; i < k; i++) sh.push(RR(-a + i * dw + 2, uy - 67, dw - 4, 60, 1.5, lt(cc), fl(0.35)), R(-a + i * dw + (i % 2 ? 5 : dw - 7), uy - 18, 2, 10, STEEL));
  }
  sh.push(...cupboards(w, h, cc, wt, Math.max(1, Math.round(w / 45))));
  if (sink) {
    sh.push(Q([[-24, -h - 6], [24, -h - 6], [26, -h - 1.6], [-26, -h - 1.6]], "#9AA0A6"), Q([[-21, -h - 5.4], [21, -h - 5.4], [22.5, -h - 2.4], [-22.5, -h - 2.4]], "#6B737A"));
    sh.push(S(band([[0, -h - 5], [0, -h - 28], [3, -h - 34], [9, -h - 34], [11, -h - 27]], [2.6]), "#C9CED3"), R(-1.6, -h - 8, 3.2, 4, "#9AA0A6"), bar(0, -h - 16, -7, -h - 18, 1.8, "#C9CED3"));
    if (p.running) sh.push(R(10.2, -h - 26, 1.6, 22, "#BFE3F2", fl(0.75)), E(11, -h - 4, 4, 0.8, "#DCEFF5", fl(0.8)));
    const rx = a - 30;
    sh.push(R(rx - 14, -h - 9, 28, 3, "#C9CED3"), ...[-8, -2, 4, 10].map(dx => E(rx + dx, -h - 18, 1.8, 10, r.pick(["#F7F3EA", "#DCEFF5", "#F2E6D0"]))), R(rx - 14, -h - 12, 28, 1.2, "#C9CED3"));
    const tw = r.pick(["#C4553A", "#2F5E9E", "#2F8C88"]), tx = -a + 14;
    sh.push(R(tx - 9, -h + 3, 18, 26, PAPER), S(rect(tx - 9, -h + 3, 18, 26), PAPER, { tile: { w: 6, h: 6, shapes: [R(0, 0, 3, 6, tw, fl(0.45)), R(0, 0, 6, 3, tw, fl(0.45))] } }), R(tx - 9, -h + 3, 18, 3, sd(PAPER), fl(0.5)));
  } else {
    const things: Sh = [], y = -h - 3;
    const jars = (x: number) => { for (let i = 0; i < 3; i++) things.push(RR(x + i * 9 - 13, y - 14 + i, 8, 14 - i, 2, "#DCEFF5", fl(0.6)), R(x + i * 9 - 12.5, y - 8 + i * 0.5, 7, 7.5 - i * 0.5, r.pick(["#E9D9A6", "#B98A57", "#F2E6D0", "#C4553A"]), fl(0.85)), RR(x + i * 9 - 13.5, y - 16 + i, 9, 3, 1, r.pick(["#C4553A", "#D9A72E", "#2F8C88"]))); };
    const board = (x: number) => things.push(P([[x - 11, y, 0], [x + 9, y, 0], [x + 12, y - 34], [x + 8, y - 38], [x - 6, y - 37], [x - 9, y - 32]], "#C99A68"), E(x + 3, y - 32, 1.8, 1.8, sd("#C99A68")));
    const fruit = (x: number) => { for (const [dx, dy, fc] of [[-6, -9, "#E58A2E"], [0, -11, "#C4402E"], [6, -9, "#E58A2E"], [-3, -14, "#A9CC3A"], [3, -14, "#E58A2E"]] as const) things.push(E(x + dx, y + dy, 3.6, 3.6, fc)); things.push(P([[x - 13, y - 8, 0], [x + 13, y - 8, 0], [x + 8, y, 0], [x - 8, y, 0]], r.pick(["#2F5E9E", "#C4553A", "#F7F3EA"]))); };
    const plant = (x: number) => { things.push(P([[x - 6, y, 0], [x + 6, y, 0], [x + 7, y - 10, 0], [x - 7, y - 10, 0]], "#B8562F")); for (let i = 0; i < 6; i++) things.push(E(x - 6 + i * 2.4, y - 14 - (i % 3) * 3, 3, 2.2, i % 2 ? "#4E7A48" : "#6E9A52")); };
    const oil = (x: number) => things.push(P([[x - 3.5, y, 0], [x + 3.5, y, 0], [x + 3.5, y - 16], [x + 1.4, y - 21, 0], [x - 1.4, y - 21, 0], [x - 3.5, y - 16]], "#C9A43A", { opacity: 0.9 }), R(x - 1.5, y - 24, 3, 3, "#2E3A59"));
    const pick = [jars, board, fruit, plant, oil];
    r.pick([[0, 2], [1, 3], [0, 4], [2, 3]]).forEach((k, i) => pick[k](i ? a - 26 : -a + 26));
    sh.push(...things);
  }
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: ppcmFor(sh, 2.2), shadow: "drop" }] };
}, variants: { counter: { kind: "counter" }, sink: { kind: "sink" }, oven: { kind: "oven" }, bakery_oven: { kind: "bakery_oven" } },
  meta: {
    about: "Kitchen fittings: a counter with cupboards, a sink, a home cooker, or a bakery's big glowing oven.",
    params: {
      kind: { type: "enum", values: ["counter", "sink", "oven", "bakery_oven"], default: "counter" },
      w: { type: "num", about: "cm; counter 180, sink 110, oven 60, bakery oven 300" },
      h: { type: "num", about: "cm; 86, bakery oven 230" },
      color: { type: "color", about: "the cupboards; default seeded" },
      upper: { type: "bool", about: "wall cupboards; default on a counter, not a sink" },
      running: { type: "bool", about: "the sink's tap runs" },
      on: { type: "bool", about: "the oven is on: its door glows" },
      front: { type: "enum", values: ["tile", "steel"], about: "a bakery oven's front; default seeded" },
    },
    terms: ["a1-w-mutfak"],
  } };

function bakeryOven(p: Params, r: Rng) {
  const w = num(p.w, 300), h = num(p.h, 230), a = w / 2, front = str(p.front, r.pick(["tile", "steel"])), fc = front === "steel" ? "#B8BEC4" : "#F4F1EA", sh: Sh = [], glow: Sh = [];
  const mouth = smooth([[-55, -92, 0], [55, -92, 0], [55, -138], [0, -176], [-55, -138]], true, 1), ring = smooth([[-70, -86, 0], [70, -86, 0], [70, -140], [0, -192], [-70, -140]], true, 1);
  sh.push(R(-24, -h - 70, 48, 72, sd(fc)), R(-30, -h - 74, 60, 6, dk(fc)), R(-a, -h, w, h, fc));
  if (front === "steel") {
    sh.push(...[-a / 2, 0, a / 2].map(x => L([[x, -h + 4], [x, -4]], sd(fc), 0.8, 0.6)), ...[-h + 60, -60].map(y => L([[-a + 4, y], [a - 4, y]], sd(fc), 0.8, 0.6)));
    for (let x = -a + 8; x < a; x += 24) for (const y of [-h + 6, -6]) sh.push(E(x, y, 1, 1, dk(fc), fl(0.7)));
    sh.push(E(a - 40, -h + 40, 12, 12, "#F7F3EA"), E(a - 40, -h + 40, 13.5, 13.5, "#4B5058", { evenodd: true }), L([[a - 40, -h + 40], [a - 33, -h + 34]], "#B3261E", 1, 1));
  } else {
    sh.push(S(rect(-a, -h, w, h), fc, { tile: { w: 20, h: 20, shapes: [R(0, 0, 20, 1, "#C9C0B0", fl(0.9)), R(0, 0, 1, 20, "#C9C0B0", fl(0.9))] } }));
    sh.push(R(-a, -h, w, 12, "#2F5E9E"), S(rect(-a, -h, w, 12), "#2F5E9E", { tile: { w: 12, h: 12, shapes: [E(6, 6, 3, 3, "#FFFFFF", fl(0.5))] } }));
  }
  sh.push(R(-a - 4, -h - 6, w + 8, 8, dk(fc)), R(-a, -14, w, 14, "#8C6A4E"), S(ring, front === "steel" ? "#6B737A" : "#B8562F"));
  for (let k = 0; k <= 8; k++) { const t = Math.PI * k / 8, cx = -Math.cos(t), cy = -Math.sin(t); sh.push(L([[cx * 55, -132 + cy * 44], [cx * 70, -132 + cy * 58]], dk(front === "steel" ? "#6B737A" : "#B8562F"), 0.8, 0.6)); }
  sh.push(S(mouth, "#2A1A12"), Q([[-55, -92], [55, -92], [44, -104], [-44, -104]], "#5A3A28"), E(0, -116, 42, 14, "#C4552A", fl(0.85)), E(0, -114, 26, 8, "#F2A33A", fl(0.8)));
  for (const [x, s] of [[-30, 1], [-12, 1.3], [14, 1.1], [32, 0.9]]) sh.push(P([[x - 4 * s, -110, 0], [x + 4 * s, -110, 0], [x + 1, -118 - 8 * s], [x, -124 - 8 * s, 0], [x - 2, -117 - 6 * s]], "#F2B33A", fl(0.9)));
  for (const x of [-34, -12, 10, 32]) sh.push(P([[x - 9, -95, 0], [x + 9, -95, 0], [x + 8, -99], [x, -102.5], [x - 8, -99]], "#C8863F"), L([[x - 5, -99.5], [x + 4, -100.5]], "#E3B37A", 0.8, 0.8));
  glow.push(S(mouth, "#FF7A2A", fl(0.85)), E(0, -114, 36, 12, "#FFD27A", fl(0.9)));
  sh.push(R(-78, -92, 156, 7, "#D8CFBF"), R(-78, -86, 156, 2, "#A9A397", fl(0.7)), ...[-60, 60].map(x => P([[x - 5, -85, 0], [x + 5, -85, 0], [x, -74, 0]], "#A9A397")));
  sh.push(bar(a - 34, -2, a - 58, -214, 3.4, "#C99A68"), P([[a - 64, -206, 0], [a - 50, -206, 0], [a - 47, -238], [a - 57, -244], [a - 67, -236]], "#D2A56C"));
  return { flats: [{ group: { shapes: sh, edge: 1 }, emissive: { shapes: glow, edge: 0 }, switch: false as const, ppcm: Math.min(1.6, 1900 / (w + 10)), shadow: "drop" as const }],
    lights: [{ x: 0, y: 120, z: 60, color: "#FF9A50", radius: 3.2, intensity: 0.7, switch: false as const }], emitters: [{ kind: "steam" as const, x: 0, y: 178, z: 4, w: 60 }] };
}

// ---- Boards on the wall -----------------------------------------------------------------------------

/** The art of one board `w` × `h` standing on y = 0, and its words. */
function boardArt(kind: string, w: number, h: number, p: Params, r: Rng): { sh: Sh; text: TextSpec[] } {
  const a = w / 2, sh: Sh = [], text: TextSpec[] = [], wood = r.pick(WOODS);
  if (kind === "notice") {
    sh.push(R(-a, -h, w, h, wood), R(-a + 3, -h + 3, w - 6, h - 6, "#C9A26B"), S(rect(-a + 3, -h + 3, w - 6, h - 6), "#C9A26B", { tile: { w: 5, h: 5, shapes: [E(1, 1.5, 0.5, 0.4, "#9C7444", fl(0.6)), E(3.5, 4, 0.4, 0.4, "#E0C08C", fl(0.6))] } }), R(-a + 3, -h + 3, w - 6, 2, "#000000", fl(0.12)));
    const cards = strs(p.cards), m = cards.length || r.int(5, 7), cols = Math.max(1, Math.round(Math.sqrt(m * w / h))), rows = Math.ceil(m / cols), cw = (w - 10) / cols, ch = (h - 10) / rows;
    for (let i = 0; i < m; i++) {
      const x = -a + 5 + (i % cols) * cw + cw / 2 + r.range(-cw * 0.06, cw * 0.06), y = -h + 5 + Math.floor(i / cols) * ch + ch / 2 + r.range(-ch * 0.05, ch * 0.05), pw = cw * r.range(0.72, 0.84), ph = ch * r.range(0.7, 0.82), pc = r.pick(NOTE), t = cards[i];
      sh.push(R(x - pw / 2 + 0.8, y - ph / 2 + 1, pw, ph, "#000000", fl(0.12)), R(x - pw / 2, y - ph / 2, pw, ph, pc));
      if (t) text.push({ text: t, x: x - pw / 2 + 1.5, y: y - ph / 2 + 3, w: pw - 3, h: ph - 4.5, size: Math.min(4, ph * 0.2), font: "hand" });
      else {
        for (let k = 0; k < 4; k++) sh.push(L([[x - pw / 2 + 2.5, y - ph / 2 + 5 + k * ph * 0.12], [x + pw / 2 - 2.5 - (k % 2) * pw * 0.2, y - ph / 2 + 5 + k * ph * 0.12]], "#8A847A", 0.5, 0.6));
        if (r.chance(0.5)) for (let k = 0; k < 6; k++) sh.push(L([[x - pw / 2 + (k + 0.5) * pw / 6, y + ph * 0.18], [x - pw / 2 + (k + 0.5) * pw / 6, y + ph / 2 - 1]], "#8A847A", 0.35, 0.7), R(x - pw / 2 + k * pw / 6, y + ph * 0.14, 0.3, ph * 0.36, sd(pc), fl(0.8)));
      }
      sh.push(E(x + 0.6, y - ph / 2 + 2.4, 1.6, 1.2, "#000000", fl(0.2)), E(x, y - ph / 2 + 2, 1.6, 1.6, r.pick(["#D9534A", "#2F5E9E", "#F2B705", "#2F8C88"])));
    }
  } else if (kind === "map") {
    const sea = "#BFDCE6", m = rect(-a + 3, -h + 4, w - 6, h - 9), city = str(p.style, "countries") === "city";
    sh.push(R(-a, -h + 1, w, h - 3, "#F4EEDC"), S(m, city ? "#E9E1CC" : sea));
    sh.push(S(rect(-a + 3, -h + 4, w - 6, h - 9), sea, { tile: { w: 15, h: 15, shapes: [R(0, 0, 15, 0.3, "#7FA7B8", fl(0.5)), R(0, 0, 0.3, 15, "#7FA7B8", fl(0.5))] } }));
    const land: Vec2[] = [];
    if (city) {
      const river = smooth([[-a * 0.1, -h], [a * 0.05, -h * 0.6], [-a * 0.05, -h * 0.35], [a * 0.15, 0]], false, 1);
      sh.push({ path: river, stroke: { color: sea, width: w * 0.08 }, clip: m });
      for (let k = 0; k < 9; k++) { const y = -h + 6 + k * (h - 12) / 8; sh.push(L([[-a + 4, y + r.range(-2, 2)], [a - 4, y + r.range(-2, 2)]], "#FFFFFF", 0.9, 0.9)); }
      for (let k = 0; k < 11; k++) { const x = -a + 6 + k * (w - 12) / 10; sh.push(L([[x + r.range(-2, 2), -h + 5], [x + r.range(-2, 2), -6]], "#FFFFFF", 0.9, 0.9)); }
      sh.push({ path: river, stroke: { color: sea, width: w * 0.07 }, flat: true, clip: m });
      for (let k = 0; k < 4; k++) sh.push(E(r.range(-a * 0.8, a * 0.8), r.range(-h * 0.8, -h * 0.2), r.range(4, 8), r.range(3, 5), "#B9D49A", { flat: true, clip: m }));
      for (let k = 0; k < 8; k++) land.push([r.pick([-1, 1]) * r.range(a * 0.25, a * 0.85), r.range(-h * 0.85, -h * 0.15)]);
    } else {
      const k = r.int(3, 5);
      for (let i = 0; i < k; i++) {
        const cx = -a + w * (i + 0.5) / k + r.range(-w * 0.06, w * 0.06), cy = -h / 2 + r.range(-h * 0.15, h * 0.12), rx = w / k * r.range(0.5, 0.75), ry = h * r.range(0.25, 0.38), pts: Vec2[] = [];
        for (let j = 0; j < 9; j++) { const t = j / 9 * Math.PI * 2, f = r.range(0.75, 1.15); pts.push([cx + Math.cos(t) * rx * f, cy + Math.sin(t) * ry * f]); }
        sh.push(P(pts, r.pick(["#E9D9A6", "#CFE0B4", "#F0C9A8", "#D8C8E0", "#F2E2A0"]), { clip: m }));
        land.push([cx + r.range(-rx * 0.4, rx * 0.4), cy + r.range(-ry * 0.4, ry * 0.4)], [cx + r.range(-rx * 0.4, rx * 0.4), cy + r.range(-ry * 0.4, ry * 0.4)]);
        if (r.chance(0.6)) sh.push(L([[cx - rx * 0.6, cy + r.range(-4, 4)], [cx, cy + r.range(-ry * 0.3, ry * 0.3)], [cx + rx * 0.5, cy + r.range(-4, 4)]], "#5E95B8", 0.8, 0.8));
      }
    }
    const cx = a - 14, cy = -h + 16;
    sh.push(P([[cx, cy - 8, 0], [cx + 2, cy - 2, 0], [cx + 8, cy, 0], [cx + 2, cy + 2, 0], [cx, cy + 8, 0], [cx - 2, cy + 2, 0], [cx - 8, cy, 0], [cx - 2, cy - 2, 0]], "#B3261E", fl(0.85)));
    const labels = strs(p.labels), pins = Math.max(0, Math.min(16, Math.round(num(p.pins, labels.length || 4)))), at: Vec2[] = [];
    for (let i = 0; i < pins; i++) { const [x, y] = land[i % land.length], q: Vec2 = [x + (i >= land.length ? r.range(-6, 6) : 0), y + (i >= land.length ? r.range(-6, 6) : 0)]; at.push(q); }
    if (p.route && at.length > 1) sh.push({ path: smooth(at, false, 1), stroke: { color: "#B3261E", width: 0.9, dash: [2.4, 1.8] }, flat: true, opacity: 0.85 });
    at.forEach(([x, y], i) => {
      sh.push(E(x + 0.8, y + 0.8, 1.8, 1.2, "#000000", fl(0.25)), E(x, y, 1.8, 1.8, r.pick(["#D9534A", "#2F5E9E", "#F2B705", "#2F8C88", "#7A3E6E"])), E(x - 0.5, y - 0.6, 0.6, 0.6, "#FFFFFF", fl(0.7)));
      const t = labels[i];
      if (t) { const lw = Math.min(30, Math.max(12, t.length * 2.1)), lx = Math.min(a - 4 - lw, x + 3); sh.push(RR(lx, y - 3.2, lw, 6, 1, PAPER, { opacity: 0.92 })); text.push({ text: t, x: lx + 0.8, y: y - 2.8, w: lw - 1.6, h: 5.2, size: 3, font: "print", align: "left" }); }
    });
    const title = str(p.title, "").trim();
    if (title) { const tw = Math.min(w * 0.5, 70), ty = -16; sh.push(RR(-a + 7, ty, tw, 10, 1.5, "#F4EEDC"), { path: rrect(-a + 8, ty + 1, tw - 2, 8, 1), stroke: { color: "#8A6A44", width: 0.5 }, flat: true }); text.push({ text: title, x: -a + 8.5, y: ty + 1, w: tw - 3, h: 8, size: 5, font: "print" }); }
    sh.push(R(-a - 4, -h - 3, w + 8, 4.5, wood), E(-a - 4.5, -h - 0.8, 2.6, 2.6, sd(wood)), E(a + 4.5, -h - 0.8, 2.6, 2.6, sd(wood)), R(-a - 4, -3, w + 8, 4, wood), L([[-a * 0.3, -h - 3], [0, -h - 14], [a * 0.3, -h - 3]], "#3B3B40", 0.6, 0.9), E(0, -h - 14, 1.2, 1.2, "#6B737A"));
  } else if (kind === "score") {
    const bc = r.pick(["#2F4A3A", "#2B2F2E"]);
    sh.push(R(-a, -h, w, h, wood), R(-a + 4, -h + 4, w - 8, h - 10, bc), ...[0, 1, 2].map(() => E(r.range(-a * 0.6, a * 0.6), r.range(-h * 0.8, -h * 0.25), r.range(8, 18), r.range(3, 6), "#F4F1EA", fl(0.07))));
    sh.push(L([[0, -h + 8], [0, -10]], "#F4F1EA", 0.8, 0.7), L([[-a + 8, -h + 4 + h * 0.27], [a - 8, -h + 4 + h * 0.27]], "#F4F1EA", 0.8, 0.7), R(-a + 2, -6, w - 4, 3, sd(wood)), RR(-a * 0.5, -8.5, 7, 2.2, 1, "#F4F1EA"), RR(-a * 0.3, -8.4, 5, 2, 1, "#F2B7C4"));
    const teams = strs(p.teams), scores = strs(p.scores), cw = (w - 16) / 2;
    for (let i = 0; i < 2; i++) {
      const x = -a + 6 + i * (cw + 4);
      if (teams[i]) text.push({ text: teams[i], x, y: -h + 6, w: cw, h: h * 0.22, size: Math.min(7, h * 0.12), font: "hand", color: "#F4F1EA", lit: 1 });
      if (scores[i]) text.push({ text: scores[i], x, y: -h + 8 + h * 0.27, w: cw, h: h * 0.5, size: h * 0.36, font: "hand", color: "#F4F1EA" });
    }
  } else if (kind === "guide") {
    const fw = r.pick(DARKWOOD), f = Math.max(3, w * 0.09), back = r.pick(["#2F5D4A", "#C9A26B", "#7A3E3E"]);
    sh.push(R(-a, -h, w, h, fw), R(-a + f, -h + f, w - 2 * f, h - 2 * f, back), R(-a, -h, w, 1.4, lt(fw), fl(0.6)));
    const sx = -a + f + 3, sy = -h + f + 3, sw = w - 2 * f - 6, shh = h - 2 * f - 6;
    sh.push(Q([[sx + 2, sy + 1], [sx + sw + 1, sy + 2], [sx + sw, sy + shh + 1], [sx + 1, sy + shh]], "#E9E1CC"), R(sx, sy, sw, shh, PAPER), R(sx, sy, sw, shh * 0.18, r.pick(["#2F8C88", "#E0A83A", "#C4553A"]), fl(0.85)));
    for (let k = 0; k < 6; k++) { const y = sy + shh * (0.3 + k * 0.11); sh.push(E(sx + 3, y, 0.7, 0.7, "#5A544A"), L([[sx + 5, y], [sx + sw - 3 - (k % 3) * sw * 0.15, y]], "#8A847A", 0.5, 0.7)); }
    for (const x of [sx + 2, sx + sw - 2]) sh.push(E(x, sy + 1.5, 1.4, 1.4, r.pick(["#D9534A", "#2F5E9E"])));
    const title = str(p.title, "").trim();
    if (title) text.push({ text: title, x: sx + 1, y: sy + 0.5, w: sw - 2, h: shh * 0.17, size: Math.min(4, shh * 0.1), font: "hand", color: "#FFFFFF" });
    sh.push(L([[a - f / 2, -f / 2], [a - f / 2 + 2, h * 0.18], [a - f / 2 + 1, h * 0.3]], "#8A847A", 0.4, 0.9), bar(a - f / 2 + 1, h * 0.3, a - f / 2 + 1.6, h * 0.3 + 12, 1.4, "#E0A83A"), P([[a - f / 2 + 0.3, h * 0.3 + 12, 0], [a - f / 2 + 2.3, h * 0.3 + 12, 0], [a - f / 2 + 1.5, h * 0.3 + 15, 0]], "#E3C8A0"), R(a - f / 2 + 0.3, h * 0.3 - 1.6, 1.4, 1.8, "#F2B7C4"));
  } else {
    sh.push(RR(-a, -h, w, h, 1.5, "#C9CED3"), R(-a + 3, -h + 3, w - 6, h - 6, "#FBFBF8"), R(-a + 3, -h + 3, w - 6, 1.6, "#000000", fl(0.06)));
    for (let k = 0; k < 3; k++) sh.push(E(r.range(-a * 0.6, a * 0.6), r.range(-h * 0.75, -h * 0.3), r.range(w * 0.04, w * 0.11), r.range(2, 5), "#9FB3D1", fl(0.1)));
    sh.push(L([[a * 0.35, -h + 6], [a * 0.6, -h * 0.55]], "#FFFFFF", 3, 0.5), R(-a * 0.8, -3, w * 0.8, 3.5, "#AEB6BC"), R(-a * 0.8, -4.5, w * 0.8, 1.5, "#8E979E"));
    const k = Math.min(1, w / 160);
    let x = -a * 0.6;
    for (const mc of ["#26272C", "#1F5FC0", "#B3261E", "#1F8F5E"].slice(0, r.int(2, 4))) { sh.push(RR(x, -7, 11 * k, 2.6, 1.2, "#F2F1EC"), RR(x + 8 * k, -7, 3.5 * k, 2.6, 1, mc)); x += 14 * k; }
    sh.push(RR(x + 4 * k, -8.5, 13 * k, 4.5, 1, "#2E3A59"), R(x + 4 * k, -5, 13 * k, 1.2, "#D8CFBF"));
    const words = strs(p.lines).join("\n") || str(p.text, "").trim();
    if (words) text.push({ text: words, x: -a + 7, y: -h + 6, w: w - 14, h: h - 17, size: num(p.size, Math.min(9, h * 0.11)), font: "hand", color: col(p.ink, "#1F3A7A"), align: "left" });
  }
  return { sh, text };
}

/**
 * A board on the wall, `kind`: `white` (default: a whiteboard, markers on its tray; `text` or `lines` written on it in
 * marker, `ink` its colour, `size` its height in cm), `notice` (a cork board with paper cards pinned on it: `cards` one
 * string per card, else seeded blank notes and tear-off flat ads), `map` (a wall map on rods: seeded countries, or a
 * city plan with `style` `city`; `pins` coloured pins, `labels` one per pin, `route` a dashed line through them, a
 * `title` cartouche), `score` (a chalk scoreboard: `teams` two names, `scores` two scores) or `guide` (a paper guide
 * pinned in a thick frame, a pencil on a string; `title` on it). `w`, `h` in cm. `n` boards `gap` apart; held, it is
 * shown, held by its bottom edge.
 */
const board: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "white"), held = !!p.held, dim: Record<string, [number, number]> = { white: [180, 100], notice: [120, 80], map: [150, 100], score: [100, 70], guide: [56, 72] };
  const [dw, dh] = dim[kind] ?? dim.white, w = num(p.w, held ? dw * 0.45 : dw), h = num(p.h, held ? dh * 0.45 : dh), { sh, text } = boardArt(kind, w, h, p, r);
  const n = held ? 1 : count(p), gap = num(p.gap, w + 20), dy = held ? 4 : 0, shapes: Sh = [], words: TextSpec[] = [];
  for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * gap; shapes.push(...mv(sh, dx, dy)); words.push(...text.map(t => ({ ...t, x: t.x + dx, y: t.y + dy }))); }
  return { flats: [{ group: { shapes, edge: 0.6 }, ppcm: ppcmFor(shapes, held ? 3 : 2.4), id: "board", ...(held ? { front: true as const } : { shadow: "drop" as const }), ...(words.length ? { text: words } : {}) }] };
}, variants: { white: { kind: "white" }, notice: { kind: "notice" }, map: { kind: "map" }, score: { kind: "score" }, guide: { kind: "guide" } },
  meta: {
    about: "A board on the wall: a whiteboard, a cork notice board, a wall map, a chalk scoreboard or a framed paper guide.",
    params: {
      kind: { type: "enum", values: ["white", "notice", "map", "score", "guide"], default: "white" },
      w: { type: "num", about: "cm; default by kind" },
      h: { type: "num", about: "cm; default by kind" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      gap: { type: "num", about: "cm between boards; default w + 20" },
      text: { type: "text", about: "a whiteboard's writing" },
      lines: { type: ["list", "text"], about: "a whiteboard's writing, one string per line" },
      ink: { type: "color", about: "the marker; default blue" },
      size: { type: "num", about: "the writing's height, cm; default from h" },
      cards: { type: ["list", "text"], about: "a notice board's cards, one string each; default seeded blank notes" },
      style: { type: "enum", values: ["countries", "city"], default: "countries", about: "a map's" },
      pins: { type: "int", min: 0, max: 16, about: "a map's pins; default the labels' count or 4" },
      labels: { type: ["list", "text"], about: "a map's pin labels" },
      route: { type: "bool", about: "a dashed line through the map's pins" },
      title: { type: "text", about: "a map's cartouche or a guide's heading" },
      teams: { type: ["list", "text"], about: "a scoreboard's two names" },
      scores: { type: ["list", "text"], about: "a scoreboard's two scores" },
    },
    terms: ["a1-w-tahta", "a2-w-pano", "a2-w-ilan"],
    tags: ["sign"],
  } };

// ---- The queue's machines, a café's coffee machine -------------------------------------------------

/**
 * The queue's machines, `kind`: `ticket` (default: a number machine on a stand, a big button, `screen` its words, a
 * slip coming out with `number` on it; `slip: false` without) or `display` (a wall display, `number` in red digits
 * and `desk`, the counter called, in green; its digits glow at night).
 */
const queue: PieceDef = { draw(p, r) {
  const sh: Sh = [], glow: Sh = [], text: TextSpec[] = [], number = str(p.number, "").trim();
  if (str(p.kind, "ticket") === "display") {
    const w = num(p.w, 90), h = num(p.h, 40), a = w / 2, split = -a + w * 0.62;
    sh.push(RR(-a, -h, w, h, 4, "#2B2F36"), R(-a + 4, -h + 4, w - 8, h - 8, "#111317"), R(split - 0.5, -h + 6, 1, h - 12, "#2B2F36"), ...[[-a + 2.5, -h + 2.5], [a - 2.5, -h + 2.5], [-a + 2.5, -2.5], [a - 2.5, -2.5]].map(([x, y]) => E(x, y, 0.8, 0.8, "#6B737A")));
    glow.push(R(-a + 6, -h + 6, split - (-a + 6) - 2, h - 12, "#FF3B30", fl(0.3)), R(split + 2, -h + 6, a - 6 - split - 2, h - 12, "#3BE07A", fl(0.3)));
    if (number) text.push({ text: number, x: -a + 6, y: -h + 6, w: split - (-a + 6) - 2, h: h - 12, size: h * 0.5, font: "screen", color: "#FF4A3A", lit: 0 });
    const deskNo = str(p.desk, "").trim();
    if (deskNo) text.push({ text: deskNo, x: split + 2, y: -h + 6, w: a - 6 - split - 2, h: h - 12, size: h * 0.5, font: "screen", color: "#4BE88A", lit: 0 });
    return { flats: [{ group: { shapes: sh, edge: 0.6 }, emissive: { shapes: glow, edge: 0 }, ppcm: 3, shadow: "drop", ...(text.length ? { text } : {}) }] };
  }
  const band0 = col(p.color, r.pick(["#C4553A", "#2F5E9E", "#2F8C88"]));
  sh.push(E(0, -2, 20, 3.4, "#3A3D45"), R(-3, -100, 6, 98, STEEL), R(-3, -100, 1.6, 98, lt(STEEL), fl(0.6)));
  sh.push(RR(-24, -154, 48, 58, 6, "#F2F1EC"), R(18, -150, 6, 50, sd("#F2F1EC"), fl(0.4)), RR(-24, -154, 48, 10, 5, band0), R(-24, -147, 48, 3, band0));
  sh.push(RR(-17, -140, 34, 18, 2, "#1D2A36"), E(0, -112, 7.5, 7.5, "#C9CED3"), E(0, -112, 6, 6, "#2F9E5A"), E(-1.6, -113.6, 2, 1.4, "#FFFFFF", fl(0.5)), R(-10, -103, 20, 2, DARK));
  glow.push(RR(-17, -140, 34, 18, 2, "#8FD3FF", fl(0.35)));
  const screen = str(p.screen, "").trim();
  if (screen) text.push({ text: screen, x: -16, y: -139, w: 32, h: 16, size: 3.6, font: "screen", color: "#BFE8FF", lit: 0 });
  if (p.slip !== false) {
    sh.push(P([[-7, -102, 0], [7, -102, 0], [7.5, -88], [5, -85, 0], [-6.5, -86, 0], [-7.5, -90]], PAPER), L([[-5, -94], [5, -94]], "#C9C2B4", 0.4, 0.8));
    if (number) text.push({ text: number, x: -6, y: -101, w: 12, h: 7, size: 4.2, font: "print" });
  }
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, emissive: { shapes: glow, edge: 0 }, ppcm: 3, ...(text.length ? { text } : {}) }] };
}, variants: { ticket: { kind: "ticket" }, display: { kind: "display" } },
  meta: {
    about: "A queue's machines: a ticket machine on a stand giving numbered slips, or a wall display of the number and counter called.",
    params: {
      kind: { type: "enum", values: ["ticket", "display"], default: "ticket" },
      number: { type: "text", about: "on the slip or the display" },
      screen: { type: "text", about: "the ticket machine's screen" },
      slip: { type: "bool", default: true, about: "a slip coming out" },
      color: { type: "color", about: "the ticket machine's band; default seeded" },
      desk: { type: "text", about: "the display's counter number" },
      w: { type: "num", default: 90, about: "the display's width, cm" },
      h: { type: "num", default: 40, about: "the display's height, cm" },
    },
    terms: ["a1-w-numara", "a1-w-sira"],
    tags: ["sign"],
  } };

/** An espresso machine on a café counter, `color` its front (seeded): two groups with their handles, a cup under one, cups warming on top, a gauge, a steam wand; steam rises from the wand. */
const coffeeMachine: PieceDef = { draw(p, r) {
  const c = col(p.color, r.pick(["#B3261E", "#F0E2C8", "#26272C", "#2F8C88"])), m = "#C9CED3", w = 72, h = 50, a = w / 2, sh: Sh = [];
  sh.push(R(-a + 2, -h - 3, w - 4, 3, m), ...[-a + 4, a - 6].map(x => R(x, -h - 6, 2, 6, m)));
  for (let i = 0; i < 4; i++) { const x = -a + 12 + i * 15; sh.push(P([[x - 4.5, -h - 3, 0], [x + 4.5, -h - 3, 0], [x + 3.5, -h - 10, 0], [x - 3.5, -h - 10, 0]], r.pick(["#F7F3EA", "#F7F3EA", "#E9D9A6"]))); }
  sh.push(RR(-a, -h, w, h - 3, 3, m), R(a - 6, -h + 2, 5, h - 7, sd(m), fl(0.4)), R(-a + 5, -h + 4, w - 10, 18, c), R(-a + 5, -h + 4, w - 10, 3, lt(c), fl(0.5)), RR(-9, -h + 8, 18, 8, 2, "#E9E4DA"));
  sh.push(E(a - 13, -h + 13, 5.5, 5.5, "#4B5058"), E(a - 13, -h + 13, 4.4, 4.4, "#FBF7EE"), L([[a - 13, -h + 13], [a - 10, -h + 10.5]], "#B3261E", 0.6, 1));
  for (const gx of [-14, 14]) sh.push(R(gx - 6, -h + 22, 12, 6, dk(m)), RR(gx - 7.5, -h + 28, 15, 5, 2, "#8E979E"), RR(gx - 2.6, -h + 31, 5.2, 10, 2.2, DARK), R(gx - 3, -h + 33, 1.2, 4, "#8E979E"), R(gx + 1.8, -h + 33, 1.2, 4, "#8E979E"));
  sh.push(R(-a + 4, -9, w - 8, 6, "#8E979E"), ...Array.from({ length: 12 }, (_, i) => L([[-a + 8 + i * 5, -8], [-a + 8 + i * 5, -4]], "#4B5058", 0.6, 0.8)));
  sh.push(RR(-19, -16, 10, 7, 2, "#F7F3EA"), { path: ellipse(-8, -12.5, 2.2, 2.4), stroke: { color: "#F7F3EA", width: 1 } }, E(-14, -9, 7, 1, "#F7F3EA"));
  sh.push(S(band([[a - 3, -h + 22], [a + 2, -h + 24], [a + 4, -h + 30], [a + 4, -14]], [1.8]), "#AEB6BC"), E(a - 3, -h + 21, 2.6, 2.6, DARK), S(band([[-a + 3, -h + 24], [-a + 1, -h + 28], [-a + 1, -h + 36]], [1.8]), "#AEB6BC"), R(-a + 2, -3, 6, 3, DARK), R(a - 8, -3, 6, 3, DARK));
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, ppcm: 3, shadow: "drop" }], emitters: [{ kind: "steam", x: a + 4, y: 14, z: 4, w: 4 }] };
}, meta: {
  about: "An espresso machine on a café counter: two groups, cups warming on top, a gauge and a steaming wand.",
  params: {
    color: { type: "color", about: "its front; default seeded" },
  },
  terms: ["a1-w-kahve"],
  tags: ["food"],
} };

// ---- The belediye's small stage ---------------------------------------------------------------------

/**
 * A belediye's small outdoor stage `w` cm wide (default 560), its deck `h` high (70): a pleated skirt in `color`
 * (seeded), steps at the left, two truss towers and a beam `top` cm high holding a backdrop with `banner` words on
 * it, bunting and two spotlights (lit at night, off the place's switch). `kind` `speaker`: a loudspeaker on a
 * tripod stand, `h` its stand's height (175).
 */
const smallStage: PieceDef = { draw(p, r) {
  if (str(p.kind, "stage") === "speaker") {
    const hh = num(p.h, 175), bw = 46, bh = 70, by = -hh - bh + 12, sh: Sh = [];
    sh.push(bar(0, -62, -38, -2, 2.6, "#3A3D45"), bar(0, -62, 38, -2, 2.6, "#3A3D45"), bar(0, -60, 5, 0, 2.6, DARK), ...[-38, 38, 5].map(x => E(x, -1.2, 2.4, 1.4, DARK)));
    sh.push(R(-2, -hh + 10, 4, hh - 70, STEEL), R(-3.5, -66, 7, 7, DARK), RR(-bw / 2, by, bw, bh, 4, "#26272C"), R(bw / 2 - 5, by + 2, 4, bh - 4, "#1B1B1F", fl(0.6)));
    sh.push(RR(-bw / 2 + 4, by + 22, bw - 8, bh - 28, 3, "#1B1B1F"), S(rect(-bw / 2 + 4, by + 22, bw - 8, bh - 28), "#1B1B1F", { tile: { w: 2, h: 2, shapes: [E(1, 1, 0.35, 0.35, "#4B5058", fl(0.6))] } }));
    sh.push(E(0, by + 46, 15, 15, "#3A3D45"), E(0, by + 46, 11.5, 11.5, "#26272C"), E(0, by + 46, 4.5, 4.5, "#4B5058"), RR(-14, by + 5, 28, 13, 3, "#3A3D45"), E(0, by + 11.5, 9, 4, "#1B1B1F"), E(bw / 2 - 6, by + bh - 5, 1, 1, "#3BE07A"));
    return { flats: [{ group: { shapes: sh, edge: 0.7 }, emissive: { shapes: [E(bw / 2 - 6, by + bh - 5, 2.4, 2.4, "#5CFF8A", fl(0.9))], edge: 0 }, switch: false, ppcm: 2.2 }] };
  }
  const w = num(p.w, 560), dh = num(p.h, 70), top = num(p.top, 340), sk = col(p.color, r.pick(["#2E3A59", "#B3261E", "#2F6E8C"])), a = w / 2, m = "#AEB6BC", sh: Sh = [], glow: Sh = [], text: TextSpec[] = [];
  const truss = (x0: number, y0: number, x1: number, y1: number, k = 22) => {
    const vert = x0 === x1, len = vert ? y0 - y1 : x1 - x0, n = Math.max(2, Math.round(len / k));
    const at = (t: number, s: number): Vec2 => vert ? [x0 + s * 10, y0 - t * len] : [x0 + t * len, y0 + s * 10];
    sh.push(bar(...at(0, -1), ...at(1, -1), 2.4, m), bar(...at(0, 1), ...at(1, 1), 2.4, m));
    for (let i = 0; i < n; i++) sh.push(bar(...at(i / n, i % 2 ? 1 : -1), ...at((i + 1) / n, i % 2 ? -1 : 1), 1.3, sd(m)));
  };
  const bx = a - 24, bt = -top + 24, banner0 = str(p.banner, "").trim();
  sh.push(R(-bx + 12, bt, 2 * bx - 24, -bt - dh - 20, mix(sk, "#FFFFFF", 0.82)), R(-bx + 12, -dh - 40, 2 * bx - 24, 20, sk), R(-bx + 12, bt, 2 * bx - 24, 6, sk, fl(0.9)));
  // the city's tulip, printed on the backdrop
  for (const x of banner0 ? [-bx + 80, bx - 80] : [0]) {
    const y = -dh - 46, k = banner0 ? 1 : 1.6, tc = mix(sk, "#FFFFFF", 0.15);
    sh.push(L([[x, y], [x + 2 * k, y - 30 * k], [x, y - 54 * k]], tc, 2.4 * k, 0.9), P([[x, y - 10 * k, 0], [x - 16 * k, y - 34 * k, 0], [x - 2 * k, y - 26 * k]], tc, fl(0.9)));
    sh.push(P([[x - 13 * k, y - 66 * k], [x - 15 * k, y - 88 * k, 0], [x - 6 * k, y - 78 * k], [x, y - 94 * k, 0], [x + 6 * k, y - 78 * k], [x + 15 * k, y - 88 * k, 0], [x + 13 * k, y - 66 * k], [x, y - 52 * k]], tc, fl(0.9)), L([[x - 3 * k, y - 60 * k], [x - 1 * k, y - 82 * k]], "#FFFFFF", 1.2 * k, 0.4));
  }
  if (banner0) text.push({ text: banner0, x: -bx + 120, y: bt + 50, w: 2 * bx - 240, h: 60, size: 22, font: "print", color: sk });
  for (const s of [-1, 1]) truss(s * bx, -dh, s * bx, -top);
  truss(-bx - 10, -top + 12, bx + 10, -top + 12);
  sh.push(L(Array.from({ length: 13 }, (_, i): Vec2 => [-bx + 14 + i * (2 * bx - 28) / 12, -top + 50 + Math.sin(i / 12 * Math.PI * 4) ** 2 * 10]), "#3B3B40", 0.6, 0.9));
  for (let i = 0; i < 24; i++) { const t = (i + 0.5) / 24, x = -bx + 14 + t * (2 * bx - 28), y = -top + 50 + Math.sin(t * Math.PI * 4) ** 2 * 10; sh.push(P([[x - 5, y, 0], [x + 5, y, 0], [x, y + 11, 0]], r.pick(["#D9534A", "#F2B705", "#2F8C88", "#1F5FC0", "#F7F3EA"]))); }
  for (const x of [-a * 0.35, a * 0.35]) { const y = -top + 24; sh.push(R(x - 1, y, 2, 8, DARK), RR(x - 7, y + 6, 14, 14, 3, "#26272C"), E(x, y + 20, 5.5, 3, "#4B5058")); glow.push(E(x, y + 20, 8, 5, "#FFE9B0", fl(0.95))); }
  sh.push(Q([[-a, -dh - 16], [a, -dh - 16], [a + 4, -dh], [-a - 4, -dh]], "#C99A68"), ...Array.from({ length: 4 }, (_, i) => L([[-a + 2, -dh - 4 - i * 4], [a - 2, -dh - 4 - i * 4]], "#A8754A", 0.6, 0.6)));
  sh.push(R(-a - 4, -dh, w + 8, 5, "#A8754A"), R(-a - 2, -dh + 5, w + 4, dh - 5, sk), R(-a - 2, -dh + 5, w + 4, 5, dk(sk)));
  for (let x = -a + 6; x < a; x += 12) sh.push(L([[x, -dh + 10], [x + 1, -2]], dk(sk), 1, 0.35));
  for (let i = 0; i < 3; i++) { const x0 = -a - 66 + i * 22, y = -(i + 1) * dh / 3; sh.push(R(x0, y, -a - x0, -y, "#8E979E"), R(x0, y, -a - x0, 3.5, "#C9CED3"), R(x0, y + 3.5, -a - x0, 1, "#6B737A", fl(0.6))); }
  sh.push(bar(-a - 62, -dh / 3 - 80, -a - 8, -dh - 82, 2, m), bar(-a - 62, -dh / 3, -a - 62, -dh / 3 - 80, 2, m), bar(-a - 8, -dh, -a - 8, -dh - 82, 2, m));
  return { flats: [{ group: { shapes: sh, edge: 1 }, emissive: { shapes: glow, edge: 0 }, switch: false, ppcm: Math.min(1, 1900 / (w + 150)), ...(text.length ? { text } : {}) }],
    lights: [{ x: 0, y: top - 40, z: 140, color: "#FFE9C0", radius: 5, intensity: 0.6, at: ["dusk", "night"], switch: false }] };
}, variants: { speaker: { kind: "speaker" } },
  meta: {
    about: "A belediye's small outdoor stage with truss towers, a backdrop banner, bunting and spotlights; or a loudspeaker on a tripod.",
    params: {
      kind: { type: "enum", values: ["stage", "speaker"], default: "stage" },
      w: { type: "num", default: 560, about: "the stage's width, cm" },
      h: { type: "num", about: "the deck's height (70) or the speaker stand's (175), cm" },
      top: { type: "num", default: 340, about: "the beam's height, cm" },
      color: { type: "color", about: "the skirt and backdrop; default seeded" },
      banner: { type: "text", about: "the backdrop's words" },
    },
  } };

/** The family's set pieces and props (`index.ts`). */
// ---- Solid lines: what people walk round (DESIGN.md §7) ---------------------------------------

/**
 * The floor lines of furniture people sit at, `n` of them `gap` apart: its front, `w` wide at z 0, and its two sides back
 * by half its depth `d`. The back half stays open: a chair and its sitter go there, walked to from behind.
 */
function sitAt(w: number, d: number, n = 1, gap = 0): SolidLine[] {
  const a = w / 2, k = -d / 2;
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap).flatMap((x): SolidLine[] => [
    { a: [x - a, k], b: [x - a, 0] }, { a: [x - a, 0], b: [x + a, 0] }, { a: [x + a, 0], b: [x + a, k] },
  ]);
}
table.solid = p => {
  if (p.held) return [];
  const t = TABLE_SIZE[str(p.kind, "plain")] ?? TABLE_SIZE.plain, w = num(p.w, t.w);
  return sitAt(w, num(p.d, t.d), count(p), num(p.gap, w + 30));
};
desk.solid = p => { const t = DESK_SIZE[str(p.kind, "home")] ?? DESK_SIZE.home, w = num(p.w, t.w); return sitAt(w, t.d, count(p), num(p.gap, w + 30)); };

export const set: Record<string, PieceDef> = { chair, table, desk, sofa, bed, kitchen, board, queue, coffee_machine: coffeeMachine, small_stage: smallStage };
export const props: Record<string, PieceDef> = { chair, table, board };
