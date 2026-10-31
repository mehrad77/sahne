// Props of the leisure family (STYLE.md): instruments, games, art and party things. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { smooth, band, ellipse, rect, rrect, poly, tone, mix, luma, mul, rotate, scale, translate, apply, groupBounds, Path, type Affine, type EmitSpec, type FlatSpec, type ParamSpec, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, holed, type Pt } from "./draw.ts";

/** How high a hanging hand grips above the floor, less the stage's drop to the held art (cm). */
const GRIP = 46;
const INK = "#2B2420", CREAM = "#F3EBD8", STEEL = "#B8BEC4", BRASS = "#D9A72E", DARK = "#2E2F35", WHITE = "#FBF7EE";

// ---- helpers --------------------------------------------------------------------------------------

const cnt = (v: unknown, d = 1, hi = 24) => Math.max(1, Math.min(hi, Math.round(num(v, d))));
/** Shapes moved by an affine (clips and stroke widths too). */
const T = (sh: Shape[], m: Affine): Shape[] => { const k = Math.hypot(m[0], m[1]); return sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * k, ...(s.stroke.dash ? { dash: s.stroke.dash.map(d => d * k) } : {}) } } : {}) })); };
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Turn shapes by `a` radians about (x, y). */
const turn = (sh: Shape[], a: number, x = 0, y = 0) => T(sh, mul(translate(x, y), mul(rotate(a), translate(-x, -y))));
/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a string, a stem, a rod. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Printed straight lines, all in one shape. */
const lines = (segs: Vec2[][], color: string, width: number, op = 1): Shape => { const p = new Path(); for (const s of segs) { p.moveTo(...s[0]); for (const q of s.slice(1)) p.lineTo(...q); } return { path: p, stroke: { color, width, cap: "round" }, flat: true, opacity: op }; };
/** Printed dots (ellipses) in one shape. */
const dots = (pts: Vec2[], rx: number, c: string, op = 1, ry = rx): Shape => F(pts.reduce((p, [x, y]) => p.add(ellipse(x, y, rx, ry)), new Path()), c, op);
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(), w = x1 - x0; return [F(rect(x1 - w * k, y0 - 1, w * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, w * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** A cut piece with its light and shade. */
const pc = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...lit(o, c, k)];
/** An outline from its right half, axis point to axis point, mirrored. */
const sym = (h: Pt[]): Pt[] => [...h, ...h.slice(1, -1).reverse().map(q => [-q[0], q[1], ...q.slice(2)] as Pt)];
const O = (h: Pt[]) => smooth(sym(h), true, 1);
/** Words laid over the box x, y, w, h (art cm), only when there are any. */
const words = (t: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec[] => t.trim() ? [{ text: t, x, y, w, h, font: "print", ...o }] : [];

/** One look of a kind: its shapes (at the origin), the words on it, its glow and its flame wicks (art cm). */
interface Part { sh: Shape[]; text?: TextSpec[]; glow?: Shape[]; fl?: Vec2[] }
interface Ctx { p: Record<string, unknown>; r: Rng; h: boolean; i: number }
/** A kind: its width (for a row), resolution, how it is held (`g` the grip, `foot` what swings down from it, `s` its size held), its cut rim `e`. */
interface Kd { w: number | ((c: Ctx) => number); pp: number; d: (c: Ctx) => Shape[] | Part; g?: Vec2; foot?: Vec2; s?: number; gap?: number; e?: number; m?: boolean; lean?: number }

const make = (K: Record<string, Kd>, id: string) => (p: Record<string, unknown>, r: Rng): PieceOut => {
  const k = K[str(p.kind, "")] ?? Object.values(K)[0], held = !!p.held, n = held && !k.m ? 1 : cnt(p.n), gap = k.gap ?? 3, e = k.e ?? 0.3;
  let sh: Shape[] = [], text: TextSpec[] = [], glow: Shape[] = [], fl: Vec2[] = [];
  const ws = Array.from({ length: n }, (_, i) => { const c = { p, r, h: held, i }, w = typeof k.w === "function" ? k.w(c) : k.w; return { c, w }; });
  let x = -(ws.reduce((s, q) => s + q.w, 0) + (n - 1) * gap) / 2;
  for (const { c, w } of ws) {
    x += w / 2;
    // a leaning kind leans each copy about its own foot, so a row keeps one floor line
    const o = k.d(c), q0: Part = Array.isArray(o) ? { sh: o } : o, lm = !held && k.lean ? rotate(k.lean) : null,
      q: Part = lm ? { ...q0, sh: T(q0.sh, lm), glow: T(q0.glow ?? [], lm), fl: (q0.fl ?? []).map(a => apply(lm, ...a)) } : q0, mx = (a: Shape[]) => x ? mv(a, x, 0) : a;
    sh.push(...mx(q.sh)); glow.push(...mx(q.glow ?? [])); text.push(...(q.text ?? []).map(t => ({ ...t, x: t.x + x }))); fl.push(...(q.fl ?? []).map(([a, b]) => [a + x, b] as Vec2));
    x += w / 2 + gap;
  }
  // more than 16 flames: drawn in the art, not burning as particles
  if (fl.length > 16) { sh.push(...fl.flatMap(([x, y]) => [P([[x, y - 2.8], [x + 0.65, y - 1.2], [x + 0.45, y], [x, y + 0.3], [x - 0.45, y], [x - 0.65, y - 1.2]], "#FFC23C"), P([[x, y - 1.8], [x + 0.25, y - 0.9], [x, y - 0.1], [x - 0.25, y - 0.9]], "#FFF2B8", { flat: true })]));
    glow.push(...fl.map(([x, y]) => F(ellipse(x, y - 1.2, 2.2, 3), "#FF9A3C", 0.3))); fl = []; }
  if (held) {
    // the grip becomes the origin; what hangs from it stays within a hand's height of the floor: tilted further (`foot`), else shrunk
    const g = k.g ?? [0, 0], s = k.s ?? 1, base: Affine = mul(translate(-g[0] * s, -g[1] * s), scale(s)), low = (m: Affine) => groupBounds({ shapes: T(sh, m), edge: e })[3];
    const turnTo = (dr: number): Affine => { if (!k.foot) return base; const [dx, dy] = apply(base, ...k.foot), d = Math.hypot(dx, dy), y = Math.min(dr, d); return mul(rotate(Math.atan2(y, -Math.sqrt(Math.max(0, d * d - y * y))) - Math.atan2(dy, dx)), base); };
    let m = turnTo(GRIP), dr = GRIP;
    for (let i = 0; i < 6 && k.foot && low(m) > GRIP + 0.3; i++) { dr = Math.max(0, dr - (low(m) - GRIP)); m = turnTo(dr); }
    const lo = low(m); if (lo > GRIP + 0.3) m = mul(scale(GRIP / lo), m);
    const sc = Math.hypot(m[0], m[1]);
    sh = T(sh, m); glow = T(glow, m); fl = fl.map(q => apply(m, ...q));
    text = text.map(t => ({ ...t, x: t.x * sc + m[4], y: t.y * sc + m[5], w: t.w * sc, h: t.h * sc, ...(t.size ? { size: t.size * sc } : {}) }));
  }
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: e });
  const f: FlatSpec = { group: { shapes: sh, edge: e }, ppcm: Math.min(k.pp, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...(text.length ? { text } : {}), ...(glow.length ? { emissive: { shapes: glow, edge: 0 }, switch: false as const } : {}) };
  const emitters: EmitSpec[] = fl.map(([a, b]) => ({ kind: "flame", x: a, y: -b, z: 0.5, w: 1.2 }));
  return { flats: [f], ...(emitters.length ? { emitters } : {}) };
};

/** A generator from its kinds: a named variant for each, the kind and `n` params, then the generator's own. */
const mk = (id: string, K: Record<string, Kd>, about: string, kindAbout: string, terms: string[], params: Record<string, ParamSpec>, tags: string[], nAbout = "how many, side by side"): PieceDef => {
  const kinds = Object.keys(K);
  return {
    draw: make(K, id), variants: Object.fromEntries(kinds.map(k => [k, { kind: k }])),
    meta: { about, params: { kind: { type: "enum", values: kinds, default: kinds[0], about: kindAbout }, n: { type: "int", min: 1, max: 24, default: 1, about: nAbout }, ...params }, terms, tags },
  };
};

// ---- instrument -----------------------------------------------------------------------------------

/** A bowl-backed body (oud, bağlama): the carved bowl showing as ribs down the right of the soundboard. */
function bowl(h: Pt[], top: string, rib: string, dx = 2.6): Shape[] {
  const b = O(h).move(dx, 0.5);
  return [S(b, rib), ...lit(b, rib, 0.25), ...[0.4, 0.75].map(t => ({ path: O(h).move(dx * t, 0.5 * t), stroke: { color: tone(rib, "deep"), width: 0.3 }, flat: true, opacity: 0.55, clip: b })), ...pc(O(h), top, 0.16)];
}
/** Pegs along the edge a→b of a peg box, `off` cm outside it. */
const pegs = (a: Vec2, b: Vec2, ts: number[], off: number): Shape[] => ts.map(t => S(ellipse(a[0] + (b[0] - a[0]) * t + off, a[1] + (b[1] - a[1]) * t, 1.2, 0.9), STEEL));

const INSTRUMENT: Record<string, Kd> = {
  guitar: { w: 40, pp: 9, g: [0, -72], foot: [0, 0], d: ({ p }) => {
    const c = hex(p.color, "#D69A55"), o = O([[0, -49], [7, -48.6], [12.6, -45], [14.2, -40], [12.2, -34], [11, -30.6], [12.4, -27], [16.6, -21], [18.4, -14], [16.8, -6], [10.4, -1.2], [0, 0]]), fr = Array.from({ length: 13 }, (_, i) => -85 + 64 * (1 - 2 ** (-(i + 1) / 12)));
    return [
      S(rect(-2.4, -86, 4.8, 44), mix(c, "#4A3022", 0.55)), ...pc(o, c), S(rect(-2.7, -85, 5.4, 46), "#35261F"), lines(fr.map(y => [[-2.6, y], [2.6, y]] as Vec2[]), "#D5D8DB", 0.25, 0.85),
      S(ellipse(0, -28, 6.8), tone(c, "deep")), S(ellipse(0, -28, 5.3), "#1E1A18"), S(rrect(-7.5, -13.8, 15, 2.4, 1.1), "#35261F"), S(rect(-2.8, -85.4, 5.6, 1), CREAM),
      S(rrect(-3.9, -98.5, 7.8, 13.6, 1.4), mix(c, "#4A3022", 0.35)), ...[-1, 1].flatMap(d => [0, 1, 2].map(j => S(rrect(d * 4.6 - 1.2, -96.5 + j * 4, 2.4, 2, 0.6), STEEL))),
      lines([-1, -0.6, -0.2, 0.2, 0.6, 1].map(v => [[v * 2, -85], [v * 5.2, -13]] as Vec2[]), "#E9E4DA", 0.14, 0.8),
    ];
  } },
  clarinet: { w: 9, pp: 12, g: [0, -42], foot: [0, 0], lean: 0.16, d: () => {
    const bell = smooth([[-4.4, 0, 0], [4.4, 0, 0], [2.4, -5.5], [1.8, -10, 0], [-1.8, -10, 0], [-2.4, -5.5]], true, 1), keys: Vec2[] = [[1.8, -14], [-1.9, -19], [1.9, -24], [-1.8, -29], [1.8, -38], [-1.9, -43], [1.8, -47]];
    return [
      S(rect(-1.75, -56, 3.5, 47), DARK), ...pc(bell, DARK, 0.3), S(ellipse(0, -56.5, 2.3, 3.4), DARK), F(rect(-1.5, -57, 0.6, 46), tone(DARK, "light"), 0.5),
      ...[-9.8, -33, -53].map(y => S(rect(-2.2, y - 0.6, 4.4, 1.2), STEEL)), R([[0, -13], [0, -48]], STEEL, 0.28, { flat: true, opacity: 0.8 }),
      ...keys.map(([x, y]) => S(ellipse(x, y, 1.2, 0.85), STEEL)), ...keys.map(([x, y]) => F(ellipse(x - 0.3, y - 0.2, 0.4, 0.3), "#FFFFFF", 0.6)),
      S(poly([[-1.6, -59], [1.6, -59], [1.1, -67], [-0.2, -67]]), "#1A1A1C"), F(poly([[-1.2, -60], [-0.7, -60], [-0.2, -66.6], [-0.5, -66.6]]), "#D8B87A", 0.95), S(rrect(-1.9, -63.2, 3.8, 2.4, 0.5), STEEL), dots([[-0.8, -62], [0.8, -62]], 0.3, "#6B7076"),
    ];
  } },
  violin: { w: 42, pp: 9, g: [0, -50], foot: [0, 0], d: ({ p, h }) => {
    const c = hex(p.color, "#A4491F"), o = O([[0, -36], [5, -35.5], [8.4, -32.5], [8.7, -28], [5.8, -23], [5.2, -20], [6.2, -17.5], [10, -13.5], [10.4, -7], [7.2, -1.5], [0, 0]]), a = Math.atan2(65, 38), u: Vec2 = [Math.cos(a), -Math.sin(a)], at = (t: number): Vec2 => [-22 + u[0] * t, -6 + u[1] * t];
    return [
      S(rect(-1.6, -53, 3.2, 26), "#2A1F1B"), ...pc(o, c, 0.2), S(rrect(-2.2, -59.5, 4.4, 8, 1.2), tone(c, "deep")), S(ellipse(0.2, -60.6, 2.5, 2.2), c), F(ellipse(0.2, -60.6, 1.2, 1), tone(c, "deep"), 0.7),
      ...[-1, 1].map(d => S(rect(d * 3.1 - 0.7, -56 + (d > 0 ? 0 : 2), 1.4, 1.6), "#2A1F1B")),
      ...[-1, 1].map(d => R([[d * 4.4, -25.5], [d * 3.4, -23], [d * 4.4, -19.5], [d * 3.6, -17]], "#1E1713", 0.55, { flat: true })), S(rrect(-2.8, -17.4, 5.6, 1.2, 0.5), CREAM),
      P([[-1.3, -11, 0], [1.3, -11, 0], [1.9, -2.6, 0], [-1.9, -2.6, 0]], "#1E1713"), S(ellipse(-5.8, -5.4, 2.5, 1.8), "#1E1713"),
      lines([-1.5, -0.5, 0.5, 1.5].map(v => [[v * 0.7, -52], [v * 1.1, -3]] as Vec2[]), "#E9E4DA", 0.13, 0.8),
      ...(h ? [] : [R([at(0), at(75)], "#6B3F22", 0.5), R([[at(14)[0] + 0.7, at(14)[1] + 0.3], [at(70)[0] + 0.7, at(70)[1] + 0.3]], WHITE, 0.4, { flat: true, opacity: 0.9 }), R([at(0), at(7)], "#1E1713", 1.5)]),
    ];
  } },
  oud: { w: 52, pp: 8, g: [0, -62], foot: [0, 0], d: ({ p }) => {
    const c = hex(p.color, "#D8A864"), h: Pt[] = [[0, -52], [8, -51], [15, -47], [21, -38], [23.5, -26], [21.5, -13], [14, -4], [0, 0]];
    return [
      ...turn([S(poly([[-4.2, -70], [4.2, -70], [3.6, -88], [-3.6, -88]]), "#4B3426"), ...pegs([4.2, -70], [3.6, -88], [0.18, 0.38, 0.58, 0.78], 1.2), ...pegs([-4.2, -70], [-3.6, -88], [0.18, 0.38, 0.58, 0.78], -1.2)], -0.78, 0, -70),
      S(rect(-3.2, -70, 6.4, 24), "#4B3426"), ...bowl(h, c, mix(c, "#6A3E22", 0.55)), S(rect(-3.2, -62, 6.4, 22), "#35261F"), S(rect(-3.2, -70.6, 6.4, 1.2), CREAM),
      S(ellipse(0, -29, 7.2), tone(c, "deep")), S(ellipse(0, -29, 5.8), "#1E1A18"), F(ellipse(0, -29, 4), tone(c, "deep"), 0.9), F(ellipse(0, -29, 2.2), "#1E1A18"), dots(Array.from({ length: 12 }, (_, i) => [Math.cos(i * 0.5236) * 5.1, -29 + Math.sin(i * 0.5236) * 5.1] as Vec2), 0.4, tone(c, "light"), 0.9),
      S(rrect(-8.5, -9, 17, 2.2, 1), "#35261F"), lines([-2, -1, 0, 1, 2].map(v => [[v * 0.9, -70], [v * 3.4, -8]] as Vec2[]), "#E9E4DA", 0.14, 0.8),
    ];
  } },
  baglama: { w: 32, pp: 8, g: [0, -78], foot: [0, 0], d: ({ p }) => {
    const c = hex(p.color, "#B9783A"), h: Pt[] = [[0, -38], [5.5, -37.6], [10.5, -33], [13.6, -24], [14.3, -14], [11.5, -5], [5.5, -0.8], [0, 0]], fr = Array.from({ length: 16 }, (_, i) => -90 + 50 * (1 - 2 ** (-(i + 1) / 12)) * 1.6);
    return [
      S(rect(-2.4, -92, 4.8, 56), "#4B3426"), ...bowl(h, c, mix(c, "#5A3A24", 0.6), 2.2), lines(fr.filter(y => y > -66).map(y => [[-2.4, y], [2.4, y]] as Vec2[]), "#E9E4DA", 0.3, 0.8),
      S(rrect(-3.2, -102, 6.4, 11, 1.4), "#35261F"), ...[-1, 1].flatMap(d => [0, 1, 2].map(j => S(ellipse(d * 4, -99.5 + j * 3, 0.9, 0.7), STEEL))),
      dots([[-4, -29], [-1.3, -31], [1.3, -31], [4, -29], [0, -27]], 1, "#1E1A18"), S(rrect(-5.5, -9.6, 11, 1.8, 0.8), "#35261F"),
      lines([-1, 0, 1].map(v => [[v * 0.9, -91], [v * 2.4, -9]] as Vec2[]), "#E9E4DA", 0.18, 0.85),
    ];
  } },
  kaval: { w: 9, pp: 12, g: [0, -50], foot: [0, 0], lean: 0.2, d: ({ p }) => {
    const c = hex(p.color, "#8A5A34"), o = rrect(-1.6, -75, 3.2, 75, 0.8), hs: Vec2[] = [-12, -18, -24, -30, -36, -42, -48].map(y => [0, y] as Vec2);
    return [
      ...pc(o, c, 0.25), S(ellipse(0, -75, 1.7, 0.6), tone(c, "deep")), F(ellipse(0, -75, 1.1, 0.35), "#1A1210"), F(ellipse(0.3, -3, 1.2, 0.5), "#1A1210", 0.6),
      ...[-73, -67, -56, -5, -1.5].map(y => S(rect(-1.95, y - 0.7, 3.9, 1.4), BRASS)), dots(hs, 1.05, tone(c, "light"), 0.7, 1.1), dots(hs, 0.75, "#1A1210", 1, 0.8),
      lines([[[-1.6, -62], [1.6, -61]], [[-1.6, -34], [1.6, -33]]], tone(c, "deep"), 0.35, 0.6),
    ];
  } },
  accordion: { w: 48, pp: 8, g: [-16.5, -41], d: ({ p }) => {
    const c = hex(p.color, "#B02A33"), z: Vec2[] = Array.from({ length: 10 }, (_, i) => [-12 + i * 2.667, i % 2 ? -34.2 : -36]), z2: Vec2[] = Array.from({ length: 10 }, (_, i) => [12 - i * 2.667, i % 2 ? -4 : -5.8]);
    const lb = rrect(-23, -37, 11, 34, 2), rb = rrect(12, -37, 11, 34, 2);
    return [
      R([[-20, -37], [-18.5, -41], [-14.5, -41], [-13, -37]], "#5A3A24", 1.3), S(poly([...z, ...z2]), "#34363C"),
      ...Array.from({ length: 9 }, (_, i) => F(poly([[-12 + i * 2.667, i % 2 ? -3.5 : -35.5], [-10.667 + i * 2.667, i % 2 ? -35.5 : -3.5], [-9.4 + i * 2.667, i % 2 ? -35.5 : -3.5], [-10.7 + i * 2.667, i % 2 ? -3.5 : -35.5]]), "#5B5E67", 0.55)),
      ...pc(lb, c, 0.2), ...pc(rb, c, 0.2), dots([-20, -17.3, -14.6].flatMap(x => [-31, -26, -21, -16, -11, -6].map(y => [x, y] as Vec2)), 0.85, CREAM),
      ...Array.from({ length: 11 }, (_, i) => F(rect(13.4, -34.4 + i * 2.7, 8, 2.3), WHITE)), F([1, 2, 4, 5, 6, 8, 9].reduce((q, i) => q.add(rect(18.6, -34.4 + i * 2.7 - 0.7, 3.4, 1.4)), new Path()), "#1E1F23"),
      S(rect(-23, -37, 11, 1.8), STEEL), S(rect(12, -37, 11, 1.8), STEEL), S(rect(-23, -4.8, 11, 1.8), STEEL), S(rect(12, -4.8, 11, 1.8), STEEL),
    ];
  } },
  darbuka: { w: 28, pp: 10, g: [0, -22], d: ({ p }) => {
    const c = hex(p.color, "#C8993F"), o = smooth(sym([[0, -39, 0], [13.4, -39, 0], [13.6, -34], [11, -27], [7, -21], [5.2, -15], [6.2, -10], [9.6, -4.4], [9.8, 0, 0], [0, 0, 0]]), true, 1);
    return [
      ...pc(o, c, 0.22), lines([[[-13, -32], [13, -32]], [[-9.5, -24], [9.5, -24]]], tone(c, "deep"), 0.45, 0.6), dots(Array.from({ length: 9 }, (_, i) => [-10 + i * 2.5, -28.3] as Vec2), 0.7, "#2F8C88", 1, 0.9),
      S(ellipse(0, -39, 13.8, 3.3), tone(c, "light")), S(ellipse(0, -39.3, 12.3, 2.6), "#EFE3C8"), F(ellipse(3, -38.8, 8, 1.6), tone("#EFE3C8", "shade"), 0.4), dots(Array.from({ length: 6 }, (_, i) => [-10 + i * 4, -36.3 + (i % 2) * 0.3] as Vec2), 0.6, STEEL),
    ];
  } },
  def: { w: 47, pp: 8, g: [0, -45], d: ({ p }) => {
    const c = hex(p.color, "#8A5A34"), sk = "#EDE0C4", slot = (a: number) => turn([S(rrect(-1.3, -2.5, 2.6, 5, 0.6), "#2A1F1B"), S(ellipse(-0.9, 0, 1.6), STEEL), S(ellipse(0.9, 0, 1.6), tone(STEEL, "light")), dots([[-0.9, 0], [0.9, 0]], 0.5, "#6B7076")], a, 0, 0), s5 = [0, 1, 2, 3, 4].flatMap(i => { const a = i * 1.2566; return mv(slot(a), Math.sin(a) * 20.9, -22.5 - Math.cos(a) * 20.9); });
    const sko = ellipse(0, -22.5, 19.2);
    return [S(ellipse(0, -22.5, 22.5), c), ...lit(ellipse(0, -22.5, 22.5), c, 0.2), S(sko, sk), ...lit(sko, sk, 0.14), ...s5];
  } },
  ney: { w: 9, pp: 12, g: [0, -45], foot: [0, 0], lean: -0.17, d: ({ p }) => {
    const c = hex(p.color, "#D2B070"), hs: Vec2[] = [-21, -29, -36, -44, -51, -58].map(y => [0, y] as Vec2);
    return [
      ...pc(rrect(-1.35, -73, 2.7, 73, 0.6), c, 0.25), ...[-12, -26, -39, -50, -61, -69].map(y => S(ellipse(0, y, 1.65, 0.55), tone(c, "deep"))), dots(hs, 0.7, "#2A1F1B", 1, 0.85),
      S(poly([[-1.6, -73], [1.6, -73], [1.1, -77.4], [-1.1, -77.4]]), BRASS), F(rect(-1.5, -73, 0.7, 4), "#FFFFFF", 0.35), S(rect(-1.7, -69.4, 3.4, 1), BRASS),
    ];
  } },
  whistle: { w: 6, pp: 16, e: 0.12, g: [0, -0.9], m: true, gap: 1, d: ({ p }) => {
    const c = hex(p.color, "#D9342B"), ch = ellipse(2.2, -2.6, 2.6, 2.5), mo = poly([[-4.6, -3.5], [0.6, -4.2], [0.6, -1.1], [-4.6, -1.8]]);
    return T([...pc(mo, c, 0.25), F(poly([[-4.6, -3.5], [-3.9, -3.6], [-3.9, -1.75], [-4.6, -1.8]]), tone(c, "deep"), 0.5), ...pc(ch, c, 0.25), F(poly([[-0.3, -3.9], [1.6, -4.7], [1.6, -3.5], [-0.3, -3.3]]), INK), F(rect(-0.3, -3.35, 1.9, 0.25), tone(c, "light"), 0.8), F(ellipse(2.7, -2.1, 0.55), tone(c, "deep"), 0.7), F(ellipse(1.1, -4, 0.5, 0.3), "#FFFFFF", 0.6), S(holed(ellipse(3.9, -5.3, 1.05), [ellipse(3.9, -5.3, 0.65)]), STEEL, { evenodd: true })], scale(0.58));
  } },
  piano: { w: 164, pp: 6, e: 0.5, g: [0, -125], s: 0.22, d: ({ p }) => {
    const c = hex(p.color, "#3A2A24"), kw = 136 / 52, kx = (i: number) => -68 + i * kw, bl = Array.from({ length: 51 }, (_, i) => i).filter(i => "ACDFG".includes("ABCDEFG"[i % 7]));
    return [
      S(rect(-74, -13, 12, 13), tone(c, "deep")), S(rect(62, -13, 12, 13), tone(c, "deep")), S(rect(-62, -7, 124, 4), tone(c, "deep")), ...pc(rrect(-76, -121, 152, 110, 2), c, 0.1), S(rrect(-80, -126, 160, 6, 2), tone(c, "light")),
      S(rrect(-68, -116, 136, 18, 1.5), tone(c, "shade")), F(rect(-22, -114, 44, 14), CREAM), lines([-112, -109.6, -107.2, -104.8, -102.4].map(y => [[-20, y], [20, y]] as Vec2[]), "#6B7076", 0.2, 0.8), dots([[-12, -108.4], [-4, -106], [4, -110.6], [12, -104]], 1, INK, 0.8, 0.75),
      S(rect(-70, -97, 140, 2.4), tone(c, "light")), S(rect(-72, -94.6, 144, 21), tone(c, "deep")), S(rect(-68, -90, 136, 15), WHITE), lines(Array.from({ length: 51 }, (_, i) => [[kx(i + 1), -90], [kx(i + 1), -75]] as Vec2[]), "#9AA0A6", 0.2, 0.9),
      F(bl.reduce((q, i) => q.add(rect(kx(i + 1) - 0.55, -90, 1.1, 9)), new Path()), "#1E1F23"), S(rect(-76, -75, 152, 3.4), tone(c, "light")),
      S(rrect(-66, -69, 132, 53, 2), tone(c, "shade")), F(rrect(-62, -65, 124, 45, 1.5), tone(c, "deep"), 0.45), S(rrect(-9, -8, 6, 4, 1.5), BRASS), S(rrect(3, -8, 6, 4, 1.5), BRASS),
    ];
  } },
  zurna: { w: 14, pp: 12, e: 0.25, g: [0, -22], foot: [0, 0], lean: 0.15, d: ({ p }) => {
    const c = hex(p.color, "#7A4A2A"), body = poly([[-1.5, -35], [1.5, -35], [3, -9], [-3, -9]]), bell = smooth([[-3, -9, 0], [3, -9, 0], [4.4, -5], [7, -1.2], [6.6, 0, 0], [-6.6, 0, 0], [-7, -1.2], [-4.4, -5]], true, 1);
    return [
      R([[0, -38], [0, -43]], BRASS, 0.9), S(ellipse(0, -43.4, 1.3, 0.7), "#D8B87A"), ...pc(bell, c, 0.2), ...pc(body, c, 0.25), S(ellipse(0, -37.4, 3.6, 0.9), BRASS), S(rect(-1.7, -36.6, 3.4, 1.8), tone(BRASS, "deep")),
      ...[-33, -9.6].map(y => S(rect(-3.3 + (y > -20 ? 0 : 1.6), y - 0.5, 6.6 - (y > -20 ? 0 : 3.2), 1), BRASS)), dots([-30, -26, -22, -18, -14, -10.6].map(y => [0, y] as Vec2), 0.65, "#1A1210", 1, 0.8), S(rect(-7, -1.4, 14, 1.4), tone(BRASS, "deep")),
    ];
  } },
  kanun: { w: 98, pp: 6, e: 0.4, g: [0, -12], s: 0.6, d: ({ p }) => {
    const c = hex(p.color, "#8A5A34"), o = poly([[-47, -38], [47, -14], [47, 0], [-47, 0]]), top = poly([[-44, -35], [44, -12.4], [44, -2.6], [-44, -2.6]]), st: Vec2[][] = [];
    for (let i = 0; i < 20; i++) { const u = i / 19; st.push([[-43, -33 + u * 28], [26, -11.4 - u * 9.4]]); }
    return [S(rect(-47, -2.4, 94, 2.4), tone(c, "shade")), ...plan([S(o, c), S(top, tone(c, "light")), F(poly([[22, -13.4], [44, -12.4], [44, -2.6], [22, -2.6]]), "#E8D9B8"), ...[[32, -11], [38, -7], [31.5, -5]].flatMap(([x, y]) => [F(ellipse(x, y, 2.6), "#5A3A24"), F(ellipse(x, y, 1.8), "#1E1A18")]), lines(st, "#E9E4DA", 0.12, 0.85), F(rect(-45, -35, 3.5, 32), tone(c, "deep"), 0.8), dots(Array.from({ length: 16 }, (_, i) => [-43.3, -33.6 + i * 2.04] as Vec2), 0.5, BRASS), lines([[[24, -11.5], [24, -3]]], tone(c, "deep"), 0.6, 0.9)], 0.6, -2.4)];
  } },
};

const instrument = mk("instrument", INSTRUMENT, "An instrument: a guitar, a clarinet, a violin with its bow, an oud, a bağlama, a kaval, an accordion, a darbuka, a def with jingle rings, a ney, a whistle, an upright piano, a zurna or a kanun.",
  "which instrument (the first, a guitar, is the default)", ["a1-w-gitar", "a1-w-klarnet", "a2-w-keman", "a2-w-ud", "a2-w-kaval", "a2-w-akordeon", "a1-w-piyano", "b1-w-duduk", "b1-w-enstruman", "a1-w-muzik"],
  { color: { type: "color", about: "the wood or body colour (a palette id or a hex); each kind has its own default, a whistle's plastic" } }, ["music", "instrument"], "how many side by side");

// ---- game ------------------------------------------------------------------------------------------

/** Table-top art drawn in plan, laid down at a slant: y squashed by `k`, a plan's front edge (y = 0) at `y0`. */
const plan = (sh: Shape[], k: number, y0: number) => T(sh, [1, 0, 0, k, 0, y0]);
/** A die `s` cm, its front face from (x, y - s) to (x + s, y), top and right showing, pips on three faces. */
function die(x: number, y: number, s: number, c: string): Shape[] {
  const d = s * 0.36, ink = luma(c) > 0.55 ? "#26272C" : WHITE, pip = (o: Vec2, ex: Vec2, ey: Vec2, uv: Vec2[]) => dots(uv.map(([u, v]) => [o[0] + ex[0] * u + ey[0] * v, o[1] + ex[1] * u + ey[1] * v] as Vec2), s * 0.085, ink);
  return [
    S(poly([[x + s, y], [x + s + d, y - d], [x + s + d, y - s - d], [x + s, y - s]]), tone(c, "shade")), S(poly([[x, y - s], [x + d, y - s - d], [x + s + d, y - s - d], [x + s, y - s]]), tone(c, "light")), S(rect(x, y - s, s, s), c),
    pip([x, y - s], [s, 0], [0, s], [[0.22, 0.22], [0.5, 0.5], [0.78, 0.78]]), pip([x, y - s], [s, 0], [d, -d], [[0.5, 0.5]]), pip([x + s, y], [d, -d], [0, -s], [[0.3, 0.3], [0.7, 0.7]]),
  ];
}
/** A suit sign about `s` cm across, centred at (x, y): 0 spade, 1 heart, 2 diamond, 3 club. Each part is its own shape: parts of one path with opposite turns would cancel where they overlap. */
function suit(k: number, x: number, y: number, s: number, c: string): Shape[] {
  const q = (u: number, v: number) => [x + u * s, y + v * s] as Vec2, e = (u: number, v: number, r: number) => F(ellipse(x + u * s, y + v * s, r * s), c), t = (...a: Vec2[]) => F(poly(a), c);
  if (k === 2) return [t(q(0, -0.55), q(0.4, 0), q(0, 0.55), q(-0.4, 0))];
  if (k === 3) return [e(0, -0.2, 0.22), e(-0.24, 0.08, 0.22), e(0.24, 0.08, 0.22), t(q(0, 0), q(0.12, 0.5), q(-0.12, 0.5))];
  const f = k ? 1 : -1;
  return [e(-0.22, -0.16 * f, 0.26), e(0.22, -0.16 * f, 0.26), t(q(-0.47, -0.05 * f), q(0.47, -0.05 * f), q(0, 0.5 * f)), ...(k ? [] : [t(q(0, 0.1), q(0.14, 0.52), q(-0.14, 0.52))])];
}
/** A 32 cm board of 4 cm squares in the table plane, frame and dark squares from `d`; `at(i, r)` is a square's centre on the page (r 0 nearest). */
function board(d: string) {
  const c = tone(d, "shade"), py = (y: number) => -2.4 + y * 0.5, sq = new Path();
  for (let i = 0; i < 8; i++) for (let r = 0; r < 8; r++) if ((i + r) % 2 === 0) sq.add(rect(-16 + i * 4, -4 * (r + 1), 4, 4));
  return { sh: [S(rect(-17.6, -1.6, 35.2, 1.6), tone(c, "shade")), S(rect(-17.6, py(-33.6), 35.2, 16.8), c), S(rect(-16, py(-32), 32, 16), "#E8D5B0"), ...plan([F(sq, d)], 0.5, -2.4)], at: (i: number, r: number): Vec2 => [-14 + i * 4, py(-2 - 4 * r)] };
}
/** A chess man (p r n b q k) standing at (x, y), in `c`. */
function man(t: string, x: number, y: number, c: string): Shape[] {
  const hh = ({ p: 3.7, r: 4.5, n: 5, b: 5.6, q: 6.2, k: 6.9 } as Record<string, number>)[t], top: Shape[] = [];
  if (t === "p") top.push(S(ellipse(x, y - hh + 0.9, 0.95), c));
  else if (t === "r") top.push(S(rect(x - 1.3, y - hh + 0.4, 2.6, hh * 0.3), c), ...[-1.3, -0.4, 0.5].map(u => S(rect(x + u, y - hh - 0.3, 0.8, 0.9), c)));
  else if (t === "n") top.push(P([[x + 1, y - hh * 0.45, 0], [x + 0.9, y - hh * 0.95], [x + 0.2, y - hh], [x - 0.5, y - hh * 0.88], [x - 1.7, y - hh * 0.7], [x - 1.5, y - hh * 0.6], [x - 0.4, y - hh * 0.62], [x - 1, y - hh * 0.45, 0]], c));
  else {
    top.push(S(ellipse(x, y - hh * 0.78, 1.0, t === "b" ? 1.5 : 1.2), c));
    if (t === "b") top.push(S(ellipse(x, y - hh, 0.4), c), R([[x - 0.3, y - hh * 0.9], [x + 0.5, y - hh * 0.72]], tone(c, "deep"), 0.25, { flat: true }));
    if (t === "q") top.push(S(poly([[x - 1.3, y - hh * 0.88], [x - 1.5, y - hh], [x - 0.7, y - hh * 0.94], [x, y - hh - 0.5], [x + 0.7, y - hh * 0.94], [x + 1.5, y - hh], [x + 1.3, y - hh * 0.88]]), c));
    if (t === "k") top.push(S(rect(x - 0.25, y - hh - 1.2, 0.5, 1.8), c), S(rect(x - 0.8, y - hh - 0.7, 1.6, 0.5), c));
  }
  return [S(ellipse(x, y, 1.55, 0.6), c), S(poly([[x - 1.2, y - 0.2], [x + 1.2, y - 0.2], [x + 0.5, y - hh * 0.62], [x - 0.5, y - hh * 0.62]]), c), ...top, F(rect(x - 0.85, y - hh * 0.55, 0.35, hh * 0.3), "#FFFFFF", 0.35)];
}
/** A draughts man at (x, y): a thick disc. */
const disk = (x: number, y: number, c: string): Shape[] => [S(ellipse(x, y + 0.6, 1.7, 0.75), tone(c, "shade")), S(ellipse(x, y, 1.7, 0.75), c), F(ellipse(x, y, 1.05, 0.42), tone(c, "shade"), 0.5), F(ellipse(x - 0.6, y - 0.25, 0.5, 0.2), "#FFFFFF", 0.4)];
/** A playing card in a hand, its foot at the origin, turned by `a` about (0, 2); its index sits in the corner the fan leaves bare; the front one shows a big spade and the ace's index. */
function card(a: number, i: number, front: boolean): Shape[] {
  const k = [0, 2, 1, 3, 0][i], ink = k === 1 || k === 2 ? "#C8283A" : INK;
  return turn([S(rrect(-3.15, -8.9, 6.3, 8.9, 0.5), WHITE), ...suit(k, a > 0 ? 2.1 : -2.1, -5.8, 1.5, ink), ...(front ? suit(0, 0, -3.6, 3.6, INK) : [])], a, 0, 2);
}
/** A pencil lying along x, 17 cm long: eraser, ferrule, yellow body, wood and graphite tip. */
const pencil = (): Shape[] => [S(rrect(-9.3, -0.45, 1.5, 0.9, 0.4), "#E58FA0"), S(rect(-7.9, -0.45, 1.6, 0.9), STEEL), S(rect(-6.3, -0.45, 12.4, 0.9), "#E8B923"), F(rect(-6.3, 0.1, 12.4, 0.35), tone("#E8B923", "shade"), 0.7), F(rect(-6.3, -0.4, 12.4, 0.18), "#FFF2A8", 0.6), S(poly([[6.1, -0.45], [6.1, 0.45], [8.1, 0.12], [8.1, -0.12]]), "#E9C892"), F(poly([[7.5, -0.17], [7.5, 0.17], [8.4, 0]]), "#3A3A3A")];
/** The pips of a domino half showing `n`, in a unit square. */
const dpips = (n: number): Vec2[] => { const a = [0.22, 0.78], c: Vec2[] = n % 2 ? [[0.5, 0.5]] : []; if (n > 1) c.push([a[0], a[0]], [a[1], a[1]]); if (n > 3) c.push([a[1], a[0]], [a[0], a[1]]); if (n === 6) c.push([a[0], 0.5], [a[1], 0.5]); return c; };

/** A closed folding case, face on, to hang by its handle; `inl` is inlaid on its lid. */
const casing = (w: number, h: number, c: string, inl: Shape[]): Shape[] => [R([[-4, -h], [-3, -h - 3.4], [3, -h - 3.4], [4, -h]], "#3A2A22", 0.9), ...pc(rrect(-w / 2, -h, w, h, 2), c, 0.14), F(rect(-w / 2, -h / 2 - 0.3, w, 0.6), tone(c, "deep"), 0.7, rrect(-w / 2, -h, w, h, 2)), ...inl, S(rrect(-1.8, -h / 2 - 1.5, 3.6, 3, 0.5), BRASS), S(rrect(-w / 2 + 0.5, -h / 2 - 1.2, 1.6, 2.4, 0.4), BRASS), S(rrect(w / 2 - 2.1, -h / 2 - 1.2, 1.6, 2.4, 0.4), BRASS)];
/** An n × n chequer of `s` cm squares, its middle at (0, cy). */
const chequer = (n: number, s: number, cy: number, c: string): Shape[] => { const q = new Path(); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) q.add(rect((i - n / 2) * s, cy + (j - n / 2) * s, s, s)); return [F(rect(-n * s / 2, cy - n * s / 2, n * s, n * s), "#E8D5B0"), F(q, tone(c, "deep"))]; };

const OK = ["#C8283A", "#26272C", "#1F5FC0", "#D98B1F"];
const GAME: Record<string, Kd> = {
  tavla: { w: 62, pp: 8, g: [0, -31.4], d: ({ p, h }) => {
    if (h) { const c = hex(p.color, "#8A5A34"); return casing(46, 28, c, [F(rrect(-17, -25.5, 34, 9, 1.5), tone(c, "light"), 0.6), F(poly([[0, -24.6], [3.4, -21], [0, -17.4], [-3.4, -21]]), tone(c, "deep"), 0.7)]); }
    const c = hex(p.color, "#8A5A34"), pw = 25 / 6, xs = (j: number) => j < 6 ? -26.5 + pw * (j + 0.5) : 1.5 + pw * (j - 6 + 0.5), py = (y: number) => -4 + y * 0.5, a = new Path(), b = new Path(), chk: [number, number, string][] = [];
    for (let j = 0; j < 12; j++) { const x0 = xs(j) - pw / 2; (j % 2 ? b : a).add(poly([[x0, -39], [x0 + pw, -39], [x0 + pw / 2, -24]])); (j % 2 ? a : b).add(poly([[x0, -1], [x0 + pw, -1], [x0 + pw / 2, -16]])); }
    for (const [pt, n, k] of [[24, 2, 0], [13, 5, 0], [8, 3, 0], [6, 5, 0], [1, 2, 1], [12, 5, 1], [17, 3, 1], [19, 5, 1]]) {
      const top = pt >= 13, j = top ? pt - 13 : 12 - pt;
      for (let s = 0; s < n; s++) chk.push([xs(j), py(top ? -37.2 + s * 3.4 : -2.8 - s * 3.4), k ? "#3A2A22" : "#F2EAD8"]);
    }
    return [
      S(rect(-31, -3, 62, 3), tone(c, "shade")), S(rect(-31, py(-42), 62, 22), c), S(rect(-28, py(-39), 56, 19), "#D9C49A"), ...plan([F(a, "#7A3E2A"), F(b, "#F2E6C8")], 0.5, -4), S(rect(-1.6, py(-41), 3.2, 21), tone(c, "light")),
      ...chk.sort((u, v) => u[1] - v[1]).flatMap(([x, y, k]) => disk(x, y, k)), ...die(10, -7, 2.4, WHITE), ...die(14.5, -8.4, 2.4, WHITE),
    ];
  } },
  chess: { w: 38, pp: 9, g: [0, -20.4], d: ({ p, h }) => {
    if (h) return casing(34, 17, hex(p.color, "#8A5A34"), chequer(4, 1.45, -13.6, hex(p.color, "#8A5A34")));
    const b = board(hex(p.color, "#8A5A34")), sh = [...b.sh];
    for (const r of [7, 6, 1, 0]) for (let i = 0; i < 8; i++) { const [x, y] = b.at(i, r); sh.push(...man(r % 7 ? "p" : "rnbqkbnr"[i], x, y + 0.6, r > 3 ? "#3A2A22" : "#F2EAD8")); }
    return sh;
  } },
  draughts: { w: 38, pp: 9, g: [0, -20.4], d: ({ p, h }) => {
    if (h) return casing(34, 17, hex(p.color, "#8A5A34"), chequer(6, 0.97, -13.6, hex(p.color, "#8A5A34")));
    const b = board(hex(p.color, "#8A5A34")), sh = [...b.sh];
    for (const r of [6, 5, 2, 1]) for (let i = 0; i < 8; i++) { const [x, y] = b.at(i, r); sh.push(...disk(x, y, r > 3 ? "#3A2A22" : "#F2EAD8")); }
    return sh;
  } },
  cards: { w: 19, pp: 12, g: [0, -1], d: () => ({ sh: [-0.62, -0.31, 0.62, 0.31, 0].flatMap((a, i) => card(a, i, i === 4)), text: words("A", -3, -8.7, 1.8, 1.7, { color: INK, weight: 700, size: 1.5 }) }) },
  okey: { w: 36, pp: 12, g: [0, -3.4], d: ({ r, p }) => {
    const c = hex(p.color, "#B98A57"), tiles = Array.from({ length: 14 }, (_, i) => ({ x: -16.2 + i * 2.49, n: r.int(1, 13), c: OK[(i + r.int(0, 3)) % 4] }));
    return { sh: [S(rrect(-17.6, -6.8, 35.2, 2.2, 0.7), tone(c, "deep")), ...tiles.map(t => S(rrect(t.x - 1.15, -5.4, 2.3, 3.6, 0.45), "#F4EBD4")), ...pc(rrect(-17.6, -2, 35.2, 2, 0.8), c, 0.12)], text: tiles.map(t => ({ text: String(t.n), x: t.x - 1, y: -5.2, w: 2, h: 2.4, font: "print" as const, color: t.c, weight: 700, size: 1.5 })) };
  } },
  dice: { w: 3.2, pp: 16, e: 0.12, m: true, g: [0, -1.2], gap: 1.2, d: ({ p }) => die(-1.1, 0, 2.2, hex(p.color, "#F6F1E4")) },
  jigsaw: { w: 54, pp: 8, g: [0, -10], d: ({ h }) => {
    if (h) { const win = rrect(-12.6, -18.6, 25.2, 12.2, 0.6); return [...pc(rrect(-16, -22, 32, 22, 1.5), "#3F74C4", 0.12), S(rrect(-13.5, -19.5, 27, 14, 1), WHITE), ...scene(-12.6, -18.6, 25.2, 12.2, win), { ...lines([...[1, 2, 3, 4, 5].map(i => [[-12.6 + i * 4.2, -18.6], [-12.6 + i * 4.2, -6.4]] as Vec2[]), ...[1, 2].map(j => [[-12.6, -18.6 + j * 4.07], [12.6, -18.6 + j * 4.07]] as Vec2[])], "#26272C", 0.15, 0.35), clip: win }]; }
    const cols = [6, 6, 5, 6, 7, 8, 8], z = 4.4, done = new Path(), pic = (y: number) => y < -18 ? "#8EC5E6" : y < -9 ? "#6FA24E" : "#4E7A48", gl: Vec2[][] = [], tabs: Shape[] = [], loose: Shape[] = [];
    cols.forEach((n, j) => { for (let i = 0; i < n; i++) done.add(rect(-22 + z * i, -35 + z * j, z, z)); gl.push([[-22, -35 + z * (j + 1)], [-22 + z * n, -35 + z * (j + 1)]]); for (let i = 1; i < n; i++) gl.push([[-22 + z * i, -35 + z * j], [-22 + z * i, -35 + z * (j + 1)]]); tabs.push(F(ellipse(-22 + z * n, -35 + z * (j + 0.5), 0.85), pic(-35 + z * (j + 0.5)))); });
    [[13, -30, 0.4, 0], [20, -23, -0.3, 1], [9, -15, 0.8, 2], [21, -8, -0.5, 3], [6, -29, -0.2, 0]].forEach(([x, y, a, k]) => loose.push(...T(turn([S(new Path().add(rect(-2.2, -2.2, 4.4, 4.4)).add(ellipse(2.5, 0, 0.85)).add(ellipse(0, -2.5, 0.85)), ["#8EC5E6", "#6FA24E", "#F6D35A", "#4E7A48"][k])], a), translate(x, y))));
    return plan([S(rect(-26, -37, 52, 37), "#7A5A3C"), F(rect(-22, -35, 44, 17), "#8EC5E6", 1, done), F(ellipse(10, -29, 3.2), "#F6D35A", 1, done), F(poly([[-22, -17], [-12, -23], [0, -18], [12, -24], [22, -18], [22, 0], [-22, 0]]), "#6FA24E", 1, done), F(poly([[-22, -9], [-8, -14], [6, -9], [22, -13], [22, 0], [-22, 0]]), "#4E7A48", 1, done), { ...lines(gl, "#26272C", 0.15, 0.4), clip: done }, ...tabs, ...loose], 0.55, -2).concat(S(rect(-26, -2, 52, 2), tone("#7A5A3C", "shade")));
  } },
  crossword: { w: 40, pp: 12, g: [0, -26], d: ({ r, p, h }) => {
    const lab = str(p.label, "BULMACA"), py = (y: number) => -1.5 + y * 0.6, bl = new Path(), gr: Vec2[][] = [], tx: Vec2[][] = [];
    if (h) {
      const q = new Path(), gq: Vec2[][] = [], z = 1.67;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (r.chance(0.26)) q.add(rect(-0.5 + i * z, -24 + j * z, z, z));
      for (let i = 0; i <= 6; i++) gq.push([[-0.5 + i * z, -24], [-0.5 + i * z, -14]], [[-0.5, -24 + i * z], [9.5, -24 + i * z]]);
      return { sh: [S(rect(-11, -30, 22, 30), "#EDE6D4"), F(rect(-9.5, -28.4, 19, 3), INK), lines(Array.from({ length: 12 }, (_, i) => [[-9.5, -23 + i * 1.7], [-9.5 + r.range(5, 8), -23 + i * 1.7]] as Vec2[]), "#8B8578", 0.35, 0.6), F(rect(-0.5, -24, 10, 10), WHITE), F(q, INK), lines(gq, "#4B4E56", 0.12, 0.75), lines(Array.from({ length: 6 }, (_, i) => [[-0.5, -11.2 + i * 1.7], [9.5, -11.2 + i * 1.7]] as Vec2[]), "#8B8578", 0.35, 0.6), F(rect(-11, -12.9, 22, 0.6), tone("#EDE6D4", "shade"), 0.5), ...mv(turn(T(pencil(), scale(0.7)), -0.9), 3, -7)], text: words(lab, -9.5, -28.4, 19, 3, { color: WHITE, weight: 700, size: 1.5 }) };
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (r.chance(0.26)) bl.add(rect(i * 1.9, -21 + j * 1.9, 1.9, 1.9));
    for (let i = 0; i <= 9; i++) gr.push([[i * 1.9, -21], [i * 1.9, -3.9]], [[0, -21 + i * 1.9], [17.1, -21 + i * 1.9]]);
    for (let y = -20; y < -3; y += 1.6) tx.push([[-17, y], [-17 + r.range(8, 13), y]]);
    return { sh: [...plan([S(rect(-19, -27, 38, 27), "#EDE6D4"), F(rect(-17, -25.6, 34, 3.4), INK), lines(tx, "#8B8578", 0.35, 0.6), F(rect(0, -21, 17.1, 17.1), WHITE), F(bl, INK), lines(gr, "#4B4E56", 0.12, 0.75)], 0.6, -1.5), S(rect(-19, -1.5, 38, 1.5), tone("#EDE6D4", "shade")), ...mv(turn(pencil(), -0.38), 7, -6)], text: words(lab, -17, py(-25.6), 34, 2.04, { color: WHITE, weight: 700, size: 1.6 }) };
  } },
  domino: { w: 17, pp: 14, e: 0.15, g: [0, -1.3], d: ({ p, h }) => {
    const c = hex(p.color, "#26272C"), ink = luma(c) > 0.55 ? "#26272C" : "#F4EBD4", t = [[3, 5], [5, 2], [2, 6]], sh: Shape[] = [S(rect(-7.5, -1, 15, 1), tone(c, "shade"))], pl: Shape[] = [];
    t.forEach(([a, b], i) => { const x = -7.5 + i * 5; pl.push(S(rrect(x, -2.5, 5, 2.5, 0.35), c), lines([[[x + 2.5, -2.2], [x + 2.5, -0.3]]], BRASS, 0.2, 0.9), dots([...dpips(a).map(([u, v]) => [x + 0.35 + u * 1.8, -2.15 + v * 1.8] as Vec2), ...dpips(b).map(([u, v]) => [x + 2.85 + u * 1.8, -2.15 + v * 1.8] as Vec2)], 0.26, ink)); });
    return h ? plan(pl, 1, 0) : [...sh, ...plan(pl, 0.6, -1)];
  } },
  mangala: { w: 56, pp: 8, g: [0, -23.4], d: ({ r, p, h }) => {
    const c = hex(p.color, "#A8754A"), dk = tone(c, "deep"), pit = (x: number, y: number, rx: number, ry: number) => [F(ellipse(x, y, rx, ry), tone(dk, "deep")), F(ellipse(x + 0.3, y + 0.4, rx * 0.85, ry * 0.85), tone(dk, "deep"), 0.7)], sh: Shape[] = [], st = ["#3F74C4", "#D9342B", "#3E8E4E", "#F2C230", "#7B4FB3", "#F6F1E4"];
    const stones = (x: number, y: number, k: number) => Array.from({ length: k }, (_, i) => [x + r.range(-1.2, 1.2) * (k > 1 ? 1 : 0), y + r.range(-1.6, 1.6) * (k > 1 ? 1 : 0) + i * 0.01] as Vec2).flatMap(([a, b]) => [F(ellipse(a, b, 0.95), st[r.int(0, 5)]), F(ellipse(a - 0.3, b - 0.3, 0.3), "#FFFFFF", 0.6)]);
    if (h) return casing(44, 20, c, [dots([0, 1].flatMap(j => Array.from({ length: 6 }, (_, i) => [-13.5 + i * 5.4, -16.8 + j * 3.6] as Vec2)), 1.1, dk), dots([[-19, -15], [19, -15]], 1.5, dk, 1, 3.2)]);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 6; i++) { const x = -17.5 + i * 7, y = -14 + j * 8; sh.push(...pit(x, y, 2.9, 2.9), ...stones(x, y, 4)); }
    sh.push(...pit(-25, -10, 3.6, 8), ...pit(25, -10, 3.6, 8), ...stones(-25, -10, 5), ...stones(25, -10, 3));
    return [S(rect(-27, -2, 54, 2), tone(c, "shade")), ...plan([S(rect(-27, -20, 54, 20), tone(c, "shade")), S(rrect(-26, -19, 52, 18, 3), c), ...sh], 0.6, -2)];
  } },
};

const game = mk("game", GAME, "A game: an open tavla (backgammon) board with checkers and dice, a chess board with its men, a draughts (dama) board, a fanned hand of playing cards, an okey rack of tiles, dice, a half-done jigsaw, a newspaper crossword with a pencil, a row of dominoes or a mangala board with its stones.",
  "which game (the first, tavla, is the default)", ["a2-w-tavla", "a1-w-satranc", "b1-w-dama", "a2-w-as", "b1-w-yapboz", "a1-w-bulmaca", "a1-w-oyun"],
  { color: { type: "color", about: "the board wood (tavla, chess, draughts: the dark squares), the okey rack, a die or the dominoes (each kind has its own default)" }, label: { type: "text", about: "the crossword's heading (default BULMACA)" } }, ["game"], "how many units side by side: a unit is one board, one hand of five cards, one okey rack of 14 tiles, one die, one chain of three dominoes");

// ---- art -------------------------------------------------------------------------------------------

/** A painted scene (sky, sun, two hills) in the box x, y, w, h, cut to `clip`; `c` its four colours. */
const scene = (x: number, y: number, w: number, h: number, clip?: Path, c = ["#8EC5E6", "#F6D35A", "#6FA24E", "#4E7A48"]): Shape[] => [
  F(rect(x, y, w, h * 0.65), c[0], 1, clip), F(ellipse(x + w * 0.72, y + h * 0.2, w * 0.1), c[1], 1, clip),
  F(poly([[x, y + h * 0.5], [x + w * 0.3, y + h * 0.36], [x + w * 0.6, y + h * 0.52], [x + w, y + h * 0.4], [x + w, y + h], [x, y + h]]), c[2], 1, clip), F(poly([[x, y + h * 0.72], [x + w * 0.4, y + h * 0.6], [x + w, y + h * 0.74], [x + w, y + h], [x, y + h]]), c[3], 1, clip),
];
const PAINTS = ["#D9342B", "#EE8A2E", "#F2C230", "#3E8E4E", "#3F74C4", "#7B4FB3", "#F6F1E4", "#7A4A2A"];
/** A paint tube standing on its cap at x, leaning `a`. */
const tube = (x: number, c: string, a: number): Shape[] => turn([
  S(rrect(x - 1.7, -13, 3.4, 12, 0.5), "#C9CED3"), F(rect(x - 1.7, -10.5, 3.4, 8.5), c), F(rect(x - 1.4, -10.5, 0.6, 8.5), "#FFFFFF", 0.35), S(rect(x - 1.7, -14.4, 3.4, 1.6), tone(STEEL, "deep")),
  lines([[[x - 1.5, -13.9], [x + 1.5, -13.9]], [[x - 1.5, -13.3], [x + 1.5, -13.3]]], "#6B7076", 0.2, 0.7), S(poly([[x - 1.7, -2], [x + 1.7, -2], [x + 1.1, -0.2], [x - 1.1, -0.2]]), "#C9CED3"), S(rrect(x - 1.2, -1.6, 2.4, 1.6, 0.4), c),
], a, x, 0);
/** A closed album, face on: leather cover, spine strap, a photo in a window, gilt corners. */
const closedAlbum = (c: string): Shape[] => { const o = rrect(-14, -30, 28, 30, 1.2); return [...pc(o, c, 0.14), F(rect(-14, -30, 4.5, 30), tone(c, "deep"), 0.55, o), S(rect(-9.5, -30, 0.7, 30), tone(c, "light")), S(rrect(-6, -24.5, 17, 14, 0.8), CREAM), ...scene(-5, -23.5, 15, 12), ...[[-12.6, -28.6], [12.6, -28.6], [12.6, -1.4], [-12.6, -1.4]].map(([x, y]) => S(ellipse(x, y, 1.1), BRASS))]; };
const ART: Record<string, Kd> = {
  easel: { w: 82, pp: 5, g: [0, -62], d: ({ p, h }) => {
    const c = hex(p.color, "#B98A57"), y0 = h ? 0 : -60, cv = [S(rect(-25, y0 - 65, 50, 65), "#F6F1E4"), S(rect(25, y0 - 65, 1.4, 65), tone("#F6F1E4", "shade")), ...scene(-23, y0 - 63, 46, 38), lines([[[-21, y0 - 20], [19, y0 - 17]], [[-18, y0 - 12], [8, y0 - 9]], [[-21, y0 - 5], [-4, y0 - 4]]], "#6B7076", 0.3, 0.5)];
    return h ? cv : [R([[-3, -165], [-35, -1]], tone(c, "shade"), 4), R([[3, -165], [35, -1]], tone(c, "shade"), 4), S(rect(-2.4, -172, 4.8, 152), c), S(rect(-24, -38, 48, 3.2), c), S(rrect(-29, -62, 58, 3.4, 1), tone(c, "light")), ...cv, S(rrect(-7.5, -133, 15, 8, 1.4), c), S(ellipse(0, -129, 1.3), STEEL)];
  } },
  palette: { w: 48, pp: 12, g: [-13.5, -12], d: ({ p, h }) => {
    const c = hex(p.color, "#C99A68"), o = holed(smooth([[-19, -20], [-12, -27], [0, -28.5], [12, -26.5], [20.5, -19], [21, -10], [16, -3.5], [8, -1.5], [3, -6], [-3, -9], [-10, -6.5], [-14, -1], [-20, -4], [-22, -12]], true, 1), [ellipse(-13.5, -12, 2.2, 2.8)]);
    const dab = (c2: string, [x, y]: Vec2): Shape[] => [F(ellipse(x, y, 2.3, 1.8), c2), F(ellipse(x - 0.7, y - 0.6, 0.8, 0.5), "#FFFFFF", 0.5)], ds = PAINTS.flatMap((c2, i) => dab(c2, ([[-16, -19.5], [-10.5, -23.5], [-4, -25], [2.5, -25], [9, -23.5], [15, -20], [17.5, -13], [-1, -17]] as Vec2[])[i]));
    return h ? [S(o, c, { evenodd: true }), ...ds] : [S(o.transform([1, 0, 0, 0.6, 0, 0]).move(0, 0), tone(c, "shade"), { evenodd: true }), ...plan([S(o, c, { evenodd: true }), ...ds], 0.6, -1.2)];
  } },
  paints: { w: 22, pp: 14, e: 0.2, g: [0, -7], d: ({ p, h }) => {
    const cs = PAINTS.slice(), c0 = typeof p.color === "string" ? hex(p.color, cs[0]) : null, col = (i: number) => i === 0 && c0 ? c0 : cs[[0, 4, 2, 6][i]];
    return h ? tube(0, col(0), 0.1) : [-5.4, -1.8, 1.8, 5.4].flatMap((x, i) => tube(x, col(i), [-0.1, 0.05, -0.05, 0.1][i]));
  } },
  brushes: { w: 18, pp: 12, e: 0.25, g: [0, -5], d: ({ p }) => {
    const c = hex(p.color, "#2F8C88"), hd = ["#B98A57", "#C4553A", "#2E3A59", "#6B4A35", "#E0A83A"], bc = ["#D9342B", "#3F74C4", "#F2C230", "#3E8E4E", "#7B4FB3"], o = rrect(-5, -11, 10, 11, 1.5);
    return [-0.42, -0.2, 0, 0.22, 0.44].flatMap((a, i) => turn([R([[0, -9], [0, -30]], hd[i], 0.85), R([[0, -28], [0, -31.4]], STEEL, 1.2), P([[-0.7, -31], [0.7, -31], [0.75, -35], [0, -38], [-0.75, -35]], bc[i])], a, 0, -9)).concat(pc(o, c, 0.2), F(rect(-5, -7, 10, 0.8), tone(c, "light"), 0.6, o), F(rect(-5, -3.5, 10, 0.5), tone(c, "deep"), 0.5, o));
  } },
  sketchbook: { w: 24, pp: 10, g: [0, -27], d: ({ p }) => {
    const c = hex(p.color, "#4F6E9E"), o = rrect(-10.5, -29.7, 21, 29.7, 1);
    return [S(rect(9.5, -28.6, 2.2, 28), WHITE), S(rect(-9, -1.2, 20, 1.2), tone(WHITE, "shade")), ...pc(o, c, 0.14), ...Array.from({ length: 14 }, (_, i) => S(ellipse(-10.1, -28 + i * 2, 0.6, 1), STEEL)), S(rrect(-6.5, -23, 14, 12, 0.5), CREAM), L([[-5, -14], [-2, -17], [1, -14.5], [4, -18], [6, -15]], "#6B7076", 0.3, 0.8), L([[-5, -20], [-3.4, -21.6], [-1.6, -20]], "#6B7076", 0.3, 0.8), F(ellipse(3.6, -20.4, 1.1), "#F2C230", 0.9)];
  } },
  masks: { w: 28, pp: 12, g: [0, -9], d: ({ p }) => {
    const c = hex(p.color, "#E8B84A"), tr = "#5B73B8", ol: Pt[] = [[0, -11], [5, -10.4], [8, -6], [8.3, -1], [6, 4.5], [2.6, 9], [0, 10.5]];
    const DK = "#2A1F1B", mask = (cx: number, cy: number, a: number, col: string, glad: boolean): Shape[] => {
      const eye = (d: number) => glad ? smooth([[d * 6.2, -1.2], [d * 4.2, -3.4], [d * 2, -1.2], [d * 4.2, -2.2]], true, 1) : ellipse(0, 0, 1.9, 1.1).transform(mul(translate(d * 4.2, -1.4), rotate(d * 0.5))), mouth = glad ? smooth([[-5, 3], [0, 6.8], [5, 3], [0, 5]], true, 1) : smooth([[-4, 6.8], [0, 3.6], [4, 6.8], [0, 5.2]], true, 1);
      const brow = (d: number) => R(glad ? [[d * 6.6, -5.4], [d * 4, -6.8], [d * 1.6, -5.6]] : [[d * 6.6, -4.2], [d * 3.4, -5.4], [d * 1.2, -7.4]], tone(col, "deep"), 0.45, { flat: true });
      return mv(turn([...pc(O(ol), col, 0.2), F(eye(-1), DK), F(eye(1), DK), F(mouth, DK), F(ellipse(-4.4, 2.2, 1.7, 1.1), "#FFFFFF", 0.25), brow(-1), brow(1)], a), cx, cy);
    };
    return [S(rrect(-14, -4.5, 28, 4.5, 1), "#4B4E56"), ...mask(5.6, -15, 0.12, tr, false), R([[-9, -23], [-2, -27], [4, -24]], "#C8283A", 0.7), ...mask(-5.6, -15, -0.08, c, true)];
  } },
  statuette: { w: 24, pp: 12, g: [0, -5], d: ({ p }) => {
    const c = hex(p.color, "#CFCBC2"), st = "#4A4750", bust = smooth([[1.6, -34], [-2.4, -33.2], [-4.8, -30.6], [-5.3, -28.6], [-5, -27.4], [-6.8, -25.8, 0], [-5.2, -24.8, 0], [-5.3, -23.6], [-4.5, -22.4], [-3.4, -21.4], [-1.8, -21], [-2, -19.4], [-3.2, -17.6], [-7.2, -15.8], [-10.6, -13.4], [-11.4, -11], [-11, -9.6, 0], [10.4, -9.6, 0], [11, -11.6], [9.4, -14.6], [5.8, -16.8], [4, -19.2], [5.4, -22.4], [6.6, -26.4], [5.6, -31], [3.6, -33.4]], true, 1),
      hair = smooth([[-4.7, -30.4], [-2.4, -33.3], [1.6, -34.2], [4.6, -33], [6.9, -28.6], [6.6, -24.4], [4.2, -24], [3.2, -26.6], [2.4, -28.4], [0.4, -29.3], [-1.8, -29.8], [-3.6, -29]], true, 1);
    return [
      S(rrect(-9, -2.4, 18, 2.4, 0.6), tone(st, "shade")), ...pc(O([[0, -9, 0], [7, -9, 0], [6.6, -8], [4.2, -7], [3.4, -5.4], [4.2, -3.8], [6.8, -2.8], [0, -2.4, 0]]), st, 0.22), ...pc(bust, c, 0.2), S(hair, tone(c, "shade")),
      ...[[[-3.4, -30.6], [-1.8, -32.2], [0, -32]], [[0.6, -33.2], [2.4, -33], [3.6, -31.4]], [[-0.4, -30.4], [1.4, -31.2], [2.6, -29.8]], [[4.2, -30.2], [5.4, -28.6], [5.6, -26.2]], [[3, -28.4], [4.2, -27.6], [4.4, -25.8]]].map(q => L(q as Vec2[], tone(c, "deep"), 0.4, 0.5)), F(ellipse(2.6, -26, 0.8, 1.3), tone(c, "shade"), 0.7), L([[-6.4, -14.2], [-1.4, -10.4]], tone(c, "shade"), 0.4, 0.55), L([[6.6, -15.6], [1.6, -11]], tone(c, "shade"), 0.4, 0.55),
    ];
  } },
  album: { w: 56, pp: 8, g: [-14, -15], d: ({ r, p, h }) => {
    const c = hex(p.color, "#7A3E2A"), page = "#F1E9D6", sh: Shape[] = [];
    if (h) return closedAlbum(c);
    const pics = [["#8EC5E6", "#F6D35A", "#6FA24E", "#4E7A48"], ["#F0A8A0", "#FFF1C2", "#B86A7A", "#6B4A66"], ["#BFDDE6", "#FFFFFF", "#9CD3C0", "#2F8C88"], ["#F2C97A", "#E8892E", "#C99A68", "#7A5A3C"]];
    for (const d of [-1, 1]) for (let i = 0; i < 4; i++) {
      const w = r.range(8.4, 10.4), hh = r.range(7.4, 9.4), x = d * 12.3 + (i % 2 ? 5.6 : -5.6), y = i < 2 ? -20 : -8;
      sh.push(...turn([S(rect(x - w / 2, y - hh / 2, w, hh), WHITE), ...scene(x - w / 2 + 0.7, y - hh / 2 + 0.7, w - 1.4, hh - 1.4, undefined, pics[(i + (d > 0 ? 2 : 0) + r.int(0, 1)) % 4])], r.range(-0.1, 0.1), x, y));
    }
    return [S(rect(-26, -1.6, 52, 1.6), tone(c, "shade")), ...plan([S(rect(-26, -30, 52, 30), c), S(rect(-24, -28, 23.4, 26.5), page), S(rect(0.6, -28, 23.4, 26.5), page), F(rect(-2, -28, 4, 26.5), "#000000", 0.14), ...sh], 0.6, -1.6)];
  } },
  vinyl: { w: 46, pp: 8, g: [0, -30], d: ({ p }) => {
    const c = hex(p.color, "#C4553A"), cx = 13, cy = -15.75, dk = ellipse(cx, cy, 15.25), o = rect(-15.75, -31.5, 31.5, 31.5);
    return [
      S(dk, "#1E1F23"), ...[0.92, 0.78, 0.64, 0.5].map(k => ({ path: ellipse(cx, cy, 15.25 * k), stroke: { color: "#FFFFFF", width: 0.12 }, flat: true, opacity: 0.14 })), F(poly([[cx, cy], [cx + 9, cy - 13], [cx + 15, cy - 8]]), "#FFFFFF", 0.09, dk), S(ellipse(cx, cy, 5), "#E0A83A"), F(ellipse(cx, cy, 0.5), "#1E1F23"),
      ...pc(o, c, 0.14), F(ellipse(0, -17, 12), tone(c, "light"), 0.5, o), F(ellipse(0, -17, 8.6), c, 1, o), F(ellipse(0, -17, 5.4), "#F2C230", 1, o), F(ellipse(0, -17, 2.4), c, 1, o), F(rect(-15.75, -6, 31.5, 2.2), tone(c, "deep"), 0.55, o), S(rect(-15.75, -31.5, 31.5, 0.9), tone(c, "deep")),
    ];
  } },
  cassette: { w: 12, pp: 16, e: 0.15, g: [0, -3.2], d: ({ p }) => {
    const c = hex(p.color, "#2E3A59"), o = rrect(-5, -6.4, 10, 6.4, 0.6);
    return [
      ...pc(o, c, 0.14), S(rrect(-4.3, -5.9, 8.6, 3.9, 0.3), CREAM), F(rect(-4.3, -5.9, 8.6, 1), "#C8283A"), S(rrect(-3.3, -4.5, 6.6, 2.2, 0.9), "#1E1F23"), ...[-2, 2].flatMap(x => [F(ellipse(x, -3.4, 0.95), WHITE), F(ellipse(x, -3.4, 0.4), "#1E1F23")]),
      S(poly([[-3.7, 0], [3.7, 0], [3.1, -1.9], [-3.1, -1.9]]), tone(c, "deep")), dots([[-1.9, -0.9], [1.9, -0.9]], 0.3, "#1E1F23"), dots([[-4.3, -0.7], [4.3, -0.7], [-4.3, -5.7], [4.3, -5.7]], 0.25, STEEL),
    ];
  } },
  clay_pot: { w: 13, pp: 14, e: 0.25, g: [0, -9], d: ({ p }) => {
    const c = hex(p.color, "#B8643A"), o = smooth([[-3, -15], [3.4, -15.2], [4.4, -13.5], [3.8, -12], [6.6, -8.5], [7.6, -4.5], [6.4, -1], [3, 0, 0], [-3.4, 0, 0], [-6.8, -1.2], [-7.9, -5], [-6.6, -9], [-3.8, -12.2], [-4.4, -13.6]], true, 1);
    return [...pc(o, c, 0.22), S(ellipse(0, -15.1, 4.1, 0.9), tone(c, "light")), F(ellipse(0.1, -15.1, 3.2, 0.55), tone(c, "deep")), lines([[[-6.9, -7.6], [-5, -6], [-3, -7.8], [-1, -6], [1, -7.8], [3, -6], [5, -7.8], [6.9, -6.2]], [[-7.2, -4.6], [7.4, -4.4]]], tone(c, "deep"), 0.4, 0.8), dots([-5.4, -2.7, 0, 2.7, 5.4].map(x => [x, -2.8] as Vec2), 0.35, tone(c, "deep"), 0.8), F(ellipse(-3.8, -8, 1, 3.2), tone(c, "light"), 0.4, o)];
  } },
  ebru: { w: 48, pp: 9, g: [0, -1], d: ({ r, p }) => {
    const cs = [hex(p.color, "#2F5F9E"), "#C8283A", "#E0A83A", "#2F8C88", "#F6F1E4", "#7B4FB3"], wr = rect(-20, -28, 40, 26), sw: Shape[] = [];
    for (let k = 0; k < 6; k++) { const ph = r.range(0, 6); sw.push({ path: smooth(Array.from({ length: 13 }, (_, i) => [-21 + i * 3.5, -26 + k * 4.4 + 1.7 * Math.sin(i * 0.9 + ph)] as Vec2), false, 1), stroke: { color: cs[k], width: 1.8, cap: "round" }, flat: true, opacity: 0.85, clip: wr }); }
    for (let k = 0; k < 3; k++) { const x = r.range(-12, 12), y = r.range(-22, -8); sw.push({ path: smooth(Array.from({ length: 28 }, (_, i) => [x + i * 0.22 * Math.cos(i * 0.5), y + i * 0.2 * Math.sin(i * 0.5)] as Vec2), false, 1), stroke: { color: cs[(k + 3) % 6], width: 1.1, cap: "round" }, flat: true, opacity: 0.9, clip: wr }); }
    for (const [x, y] of [[-10, -14], [8, -19], [13, -8]]) sw.push(...[[5, 0], [3.6, 4], [2.2, 1], [0.9, 4]].map(([rr, a]) => F(ellipse(x, y, rr), cs[(a + (x > 0 ? 1 : 0)) % 6], 1, wr)));
    return [S(rect(-22, -2, 44, 2), "#3A3D45"), ...plan([S(rect(-22, -30, 44, 30), "#5A6068"), S(wr, "#D9E6EA"), ...sw], 0.6, -2)];
  } },
  calligraphy: { w: 42, pp: 10, g: [0, -23], d: ({ p, h }) => {
    const ink = hex(p.color, "#26272C"), st = (pts: Vec2[], w: number[]) => F(band(pts, w), ink, 0.92);
    const sheet = [S(rect(-18, -24, 28, 24), "#EFE3C8"), { path: rect(-16.5, -22.5, 25, 21), stroke: { color: BRASS, width: 0.25 }, flat: true, opacity: 0.8 }, st([[-12, -9], [-8, -16], [-2, -17.5], [3, -13], [6, -9]], [0.3, 1.3, 1.8, 1.2, 0.3]), st([[-11, -13], [-6, -12], [0, -8.5], [5, -5.5]], [0.2, 0.9, 1.2, 0.2]), st([[-13, -4], [-4, -3], [4, -5], [8, -8]], [0.2, 0.7, 0.5, 0.2]), dots([[-4, -6], [-2.8, -5.4], [2, -3.4]], 0.35, ink, 0.9)];
    if (h) return mv(sheet, 4, 0);
    return [
      S(rect(-18, -1.2, 28, 1.2), tone("#EFE3C8", "shade")), ...plan(sheet, 0.6, -1.2),
      S(rrect(13.5, -5.8, 7, 5.8, 1.6), "#2E3A59"), S(rect(15.1, -7.6, 3.8, 1.9), BRASS), F(ellipse(17, -7.6, 1.7, 0.5), ink), F(ellipse(15.3, -3.8, 0.7, 1.8), "#FFFFFF", 0.3),
      R([[-13, -2.4], [8, -12]], "#B88A4A", 0.75), dots([[-6, -5.6], [1, -8.8]], 0.4, tone("#B88A4A", "deep")), R([[-13, -2.4], [-11.4, -3.1]], tone("#B88A4A", "deep"), 0.75),
    ];
  } },
  plate: { w: 30, pp: 10, e: 0.3, g: [0, -2], d: ({ p, h }) => {
    const b = hex(p.color, "#1F4FA8"), o = ellipse(0, -15, 13.4), tulip = (x: number, y: number, s: number, c: string): Shape[] => [F(poly([[x - 1.9 * s, y - 2.6 * s], [x - 2.2 * s, y - 6 * s], [x - 0.9 * s, y - 4.6 * s], [x, y - 7.6 * s], [x + 0.9 * s, y - 4.6 * s], [x + 2.2 * s, y - 6 * s], [x + 1.9 * s, y - 2.6 * s]]), c), F(ellipse(x, y - 2.6 * s, 1.9 * s, 1.1 * s), c)];
    return [
      ...(h ? [] : [S(rect(-5, -2, 10, 2), tone(STEEL, "shade"))]), S(o, WHITE), ...lit(o, WHITE, 0.14), { path: ellipse(0, -15, 12.4), stroke: { color: b, width: 0.8 }, flat: true }, { path: ellipse(0, -15, 10.4), stroke: { color: "#2F8C88", width: 0.4 }, flat: true },
      dots(Array.from({ length: 14 }, (_, i) => [Math.cos(i * 0.4488) * 11.4, -15 + Math.sin(i * 0.4488) * 11.4] as Vec2), 0.45, "#C8283A"), F(poly([[-8, -13], [-3, -10], [-2, -8.4], [-6.4, -10]]), "#2F8C88", 0.95), F(poly([[8, -13], [3, -10], [2, -8.4], [6.4, -10]]), "#2F8C88", 0.95),
      R([[0, -8], [0, -14]], "#3E8E4E", 0.55, { flat: true }), ...tulip(0, -11.6, 1.5, "#C8283A"), ...tulip(-5.6, -11.4, 0.85, b), ...tulip(5.6, -11.4, 0.85, b), dots([[0, -19.5], [-3.4, -17.6], [3.4, -17.6]], 0.5, "#E0A83A"),
    ];
  } },
};

// ---- party -----------------------------------------------------------------------------------------

const BRIGHT = ["#D9342B", "#F2C230", "#3F74C4", "#3E8E4E", "#E58FA0", "#7B4FB3", "#EE8A2E", "#2F8C88"];
/** Characters of a text param (a number too), at most `hi`. */
const chars = (v: unknown, d: string, hi: number) => { const t = typeof v === "number" ? String(v) : str(v, d); return Array.from(t.trim() ? t : d).slice(0, hi); };
/** A serpentine streamer: a paper coil standing face on at x, its ribbon curling up from it in loops (`dir` the way it drifts, `up` the height it climbs, `lp` how many loops). */
function serp(x: number, c: string, dir: number, up: number, lp: number): Shape[] {
  const T = lp * 2 * Math.PI, sp: Vec2[] = [], wd: number[] = [];
  for (let i = 0; i <= 52; i++) { const u = i / 52, t = T * u, f = 1 - 0.35 * u; sp.push([x + dir * (4 * f * (1 - Math.cos(t)) + 5 * u), -4.7 - up * u - 5.2 * f * Math.sin(t)]); wd.push(1.1); }
  return [S(band(sp, wd), c), S(ellipse(x + 0.9, -2.4, 2.4), tone(c, "shade")), S(ellipse(x, -2.4, 2.4), c), ...[0.55, 1.1, 1.65].map(r => ({ path: ellipse(x, -2.4, r), stroke: { color: tone(c, "deep"), width: 0.18 }, flat: true, opacity: 0.55 })), F(ellipse(x, -2.4, 0.4), tone(c, "deep"), 0.9), F(ellipse(x - 0.8, -3.2, 0.7, 0.45), WHITE, 0.35)];
}
/** The party kinds. */
const PARTY: Record<string, Kd> = {
  streamers: { w: 40, pp: 10, e: 0.2, g: [0, -2.4], d: ({ p, h }) => { const cs = [hex(p.color, "#D9342B"), "#F2C230", "#3F74C4"]; return h ? serp(0, cs[0], 1, 24, 1.7) : [[-9, -1, 26, 1.75], [0, 1, 20, 1.5], [9, -1, 24, 1.6]].flatMap(([x, dr, up, lp], i) => serp(x, cs[i], dr, up, lp)); } },
  confetti: { w: 52, pp: 10, e: 0.12, g: [0, 0], d: ({ r, p, h }) => {
    const cs = p.color ? [hex(p.color, BRIGHT[0]), ...BRIGHT.slice(1)] : BRIGHT, ps = cs.map(() => new Path());
    for (let i = 0; i < 110; i++) {
      const a = r.range(0, 6.28), hy = r() ** 1.5 * 16, m = mul(translate(h ? r.range(-1, 1) * (2.5 + hy * 0.5) : r.range(-24, 24), h ? -hy - 0.5 : -(r() ** 2.4) * 16 - 0.3), rotate(a)), k = r.int(0, 2), q = k === 0 ? rect(-0.5, -0.25, 1, 0.5) : k === 1 ? ellipse(0, 0, 0.36) : poly([[-0.4, 0.3], [0.4, 0.3], [0, -0.4]]);
      ps[i % cs.length].add(q.transform(m));
    }
    return ps.map((q, i) => S(q, cs[i]));
  } },
  garland: { w: c => 10 * chars(c.p.letters, "İYİ Kİ DOĞDUN", 24).length, pp: 8, g: [0, -22], d: ({ p, h }) => {
    const cs = chars(p.letters, "İYİ Kİ DOĞDUN", 24), W = cs.length * 10, sg = h ? -8 : 6, top = h ? 14 : 19, y = (x: number) => -top + sg * (1 - (2 * x / W) ** 2), sh: Shape[] = [], text: TextSpec[] = [];
    cs.forEach((ch, i) => {
      const x = -W / 2 + 5 + i * 10;
      if (ch.trim() === "") return;
      const c = p.color ? hex(p.color, BRIGHT[0]) : BRIGHT[i % 8], t = y(x);
      sh.push(S(poly([[x - 4.4, t], [x + 4.4, t], [x + 4.4, t + 11.4], [x, t + 8.8], [x - 4.4, t + 11.4]]), c), F(rect(x - 4.4, t, 1.1, 11), "#FFFFFF", 0.22), F(rect(x + 3.2, t, 1.2, 11), tone(c, "shade"), 0.4));
      text.push(...words(ch, x - 4.2, t + 0.9, 8.4, 7.4, { color: luma(c) > 0.62 ? INK : WHITE, weight: 700, size: 6 }));
    });
    return { sh: [R(Array.from({ length: 9 }, (_, i) => [-W / 2 + (W * i) / 8, y(-W / 2 + (W * i) / 8)] as Vec2), "#7A5A3C", 0.4), ...sh], text };
  } },
  number_candles: { w: c => 7.6 * chars(c.p.digits, "30", 8).length, pp: 12, e: 0.2, g: [0, -4], d: ({ p, r }) => {
    const ds = chars(p.digits, "30", 8), on = p.lit !== false, pals = ["#F2A7B4", "#8DB8DA", "#F2D06B", "#9CD3C0", "#B9A6DC"], sh: Shape[] = [], text: TextSpec[] = [], fl: Vec2[] = [], st = r.int(0, 4);
    ds.forEach((ch, i) => {
      const x = -((ds.length - 1) * 7.6) / 2 + i * 7.6, c = i === 0 && p.color ? hex(p.color, pals[0]) : pals[(st + i) % 5], o = rrect(x - 3.2, -9, 6.4, 8.6, 1.6);
      sh.push(S(rrect(x - 2.6, -0.9, 5.2, 0.9, 0.4), "#F2B705"), ...pc(o, c, 0.18), F(rect(x - 3.2, -2.6, 6.4, 0.7), tone(c, "light"), 0.6, o), F(rect(x - 3.2, -8.8, 6.4, 0.7), tone(c, "light"), 0.6, o), R([[x, -9], [x, -10.2]], INK, 0.28));
      text.push(...words(ch, x - 2.6, -7.8, 5.2, 5.6, { color: tone(c, "deep"), weight: 700, size: 5 }));
      if (on) fl.push([x, -10.4]); else sh.push(L([[x, -10.6], [x + 0.6, -12.2], [x - 0.4, -13.6], [x + 0.3, -15]], "#9AA0A6", 0.25, 0.5));
    });
    return { sh, text, fl };
  } },
  popper: { w: 40, pp: 10, e: 0.2, g: [-3, -9], d: ({ p, r }) => {
    const c = hex(p.color, "#D9342B"), T0: Vec2 = [-9, -0.6], M: Vec2 = [2, -15.5], L0 = Math.hypot(M[0] - T0[0], M[1] - T0[1]), u: Vec2 = [(M[0] - T0[0]) / L0, (M[1] - T0[1]) / L0], n: Vec2 = [-u[1], u[0]];
    const at = (a: number, b: number, o: Vec2 = M): Vec2 => [o[0] + u[0] * a + n[0] * b, o[1] + u[1] * a + n[1] * b], pt = (f: number, s: number): Vec2 => [T0[0] + u[0] * L0 * f + n[0] * 5.2 * f * s, T0[1] + u[1] * L0 * f + n[1] * 5.2 * f * s];
    const cone = poly([T0, pt(1, 1), pt(1, -1)]), bd = (f0: number, f1: number) => F(poly([pt(f0, -1), pt(f0, 1), pt(f1, 1), pt(f1, -1)]), BRASS, 0.9, cone), rib = [[13, -8], [18, -3], [20, 3], [16, 9], [10, -11]];
    return [
      ...rib.map(([a, b], i) => S(band([M, at(a * 0.5, b * 0.5 + (i % 2 ? 3 : -3)), at(a * 0.8, b * 0.9 + (i % 2 ? -2 : 2)), at(a, b)], [1.1]), BRIGHT[(i * 2 + 1) % 8])),
      ...pc(cone, c, 0.2), bd(0.3, 0.4), bd(0.62, 0.72), S(ellipse(0, 0, 5.2, 1.6).transform(mul(translate(M[0], M[1]), rotate(Math.atan2(n[1], n[0])))), tone(c, "deep")),
      ...Array.from({ length: 16 }, (_, i) => F(rect(-0.4, -0.25, 0.8, 0.5).transform(mul(translate(...at(r.range(5, 27), r.range(-15, 15))), rotate(r.range(0, 3)))), BRIGHT[i % 8])),
    ];
  } },
  sparkler: { w: 24, pp: 12, e: 0.15, lean: 0.2, g: [0, -8], d: ({ r, p, h }) => {
    const on = p.lit !== false, hd: Vec2 = [0, -30.4], glow: Shape[] = [], sp: Vec2[][] = [], sh: Shape[] = [R([[0, 0], [0, -30]], "#6B7076", 0.22), S(rrect(-0.45, -30.4, 0.9, 19.4, 0.3), on ? "#4B4E56" : "#6B6F76"), F(rect(-0.45, -30.4, 0.25, 19.4), "#FFFFFF", 0.2)];
    if (on) {
      for (let i = 0; i < 16; i++) { const a = r.range(0, 6.28), l = r.range(3, 8.5); sp.push([[hd[0] + Math.cos(a) * 1.2, hd[1] + Math.sin(a) * 1.2], [hd[0] + Math.cos(a) * l, hd[1] + Math.sin(a) * l]]); }
      sh.push(lines(sp, "#FFE9A0", 0.22, 0.95), dots(sp.map(q => q[1]), 0.28, "#FFFFFF", 0.95), S(ellipse(hd[0], hd[1], 1.1), "#FFF4C8", { flat: true }));
      glow.push(F(ellipse(hd[0], hd[1], 9), "#FFC864", 0.28), F(ellipse(hd[0], hd[1], 5), "#FFE08A", 0.5), F(ellipse(hd[0], hd[1], 2), "#FFFFFF", 0.85), lines(sp, "#FFE9A0", 0.4, 0.8));
    } else sh.push(L([[0, -31], [0.5, -33], [-0.3, -35]], "#9AA0A6", 0.25, 0.5));
    return { sh, glow };
  } },
  lantern: { w: 26, pp: 10, e: 0.3, g: [0, -30], d: ({ p, h }) => {
    const on = p.lit !== false, c = hex(p.color, "#D9342B"), o = ellipse(0, -12.4, 11, 9.4), cy = -12.4;
    return {
      sh: [R([[-5, -23], [-4, -30.6], [4, -30.6], [5, -23]], "#6B4A35", 0.45), S(rrect(-3.6, -3, 7.2, 3, 0.8), BRASS), ...pc(o, c, 0.2), ...[3.6, 7.4].map(k => ({ path: ellipse(0, cy, k, 9.4), stroke: { color: tone(c, "deep"), width: 0.3 }, flat: true, opacity: 0.45, clip: o })), lines([[[0, cy - 9.4], [0, cy + 9.4]]], tone(c, "deep"), 0.3, 0.45), S(rrect(-3.6, -23.4, 7.2, 2.4, 0.8), BRASS), F(ellipse(-4.6, cy - 3.4, 2, 3.4), "#FFFFFF", on ? 0.4 : 0.22)],
      glow: on ? [F(ellipse(0, cy, 15, 13), "#FFC864", 0.3), F(ellipse(0, cy, 10, 8.4), "#FFE8A8", 0.5), F(ellipse(0, cy, 5, 4.4), "#FFFFFF", 0.7)] : [],
    };
  } },
  string_lights: { w: 154, pp: 6, e: 0.15, g: [0, -46], d: ({ p, h }) => {
    const on = p.lit !== false, W = h ? 74 : 150, nb = h ? 5 : 10, y = (x: number) => h ? -46 + 40 * (2 * x / W) ** 2 : -24 + 16 * (1 - (2 * x / W) ** 2), c = hex(p.color, "#FFC24A"), wire = "#2A3A2E", sh: Shape[] = [], glow: Shape[] = [];
    sh.push(R(Array.from({ length: 13 }, (_, i) => [-W / 2 + (W * i) / 12, y(-W / 2 + (W * i) / 12)] as Vec2), wire, 0.45));
    for (let i = 0; i < nb; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / nb, t = y(x), b = on ? c : mix(c, "#E9E4DA", 0.6);
      sh.push(S(rrect(x - 0.8, t - 0.4, 1.6, 2.2, 0.4), wire), S(ellipse(x, t + 3.9, 1.8, 2.4), b), F(ellipse(x - 0.6, t + 3, 0.55, 0.85), "#FFFFFF", 0.7));
      if (on) glow.push(F(ellipse(x, t + 3.9, 5), c, 0.28), F(ellipse(x, t + 3.9, 2.4), "#FFFFFF", 0.7));
    }
    return { sh, glow };
  } },
  party_hat: { w: 14, pp: 14, e: 0.25, g: [0, -9], d: ({ p, i }) => {
    const c = p.color ? hex(p.color, BRIGHT[0]) : BRIGHT[i % 8], o = smooth([[-6.2, -0.8, 0], [-0.7, -19.4, 0], [0.7, -19.4, 0], [6.2, -0.8, 0], [3.4, 0.1], [0, 0.5], [-3.4, 0.1]], true, 1), bd = (k: number) => F(poly([[-8 + k * 5, 0], [-5 + k * 5, 0], [3 + k * 5, -20], [0 + k * 5, -20]]), tone(c, "light"), 0.55, o);
    return [...pc(o, c, 0.22), bd(0.3), bd(1.5), bd(2.7), { ...dots([[-2.8, -4.6], [2.6, -6.4], [-0.6, -9.6], [1.8, -13], [-2.8, -10.8], [0.2, -15.6]], 0.7, WHITE, 0.9), clip: o }, S(new Path().add(ellipse(0, -20.6, 2.2)).add(ellipse(-1.8, -19.4, 1.5)).add(ellipse(1.8, -19.6, 1.5)).add(ellipse(0, -22, 1.5)), "#F6F1E4")];
  } },
  ribbon: { w: 26, pp: 12, e: 0.2, g: [0, -6.2], d: ({ p }) => {
    const c = hex(p.color, "#C8283A"), o = ellipse(0, -6.2, 6.2);
    return [S(band([[5.2, -2.6], [8.5, -0.9], [12.5, -1], [15.5, -2.6], [18.5, -1], [22, -1]], [2.3]), tone(c, "light")), S(o, "#EDE3C8"), F(ellipse(0, -6.2, 5.4), c), ...[2.6, 3.3, 4, 4.7].map(k => ({ path: ellipse(0, -6.2, k), stroke: { color: tone(c, "deep"), width: 0.15 }, flat: true, opacity: 0.5 })), S(ellipse(0, -6.2, 2.1), "#EDE3C8"), F(ellipse(0, -6.2, 1), "#2A1F1B"), F(ellipse(-2.3, -8.6, 2, 1), "#FFFFFF", 0.3, o)];
  } },
  wrapping: { w: 62, pp: 8, e: 0.3, g: [0, -30], d: ({ p, h }) => {
    const c = hex(p.color, "#C8283A"), cap = "#F4EFE4", grid = (x0: number, y0: number, w: number, hh: number, s: number, rr: number, k = 1) => { const q = new Path(); for (let j = 0, yy = y0; yy < y0 + hh; yy += s * k, j++) for (let xx = x0 + (j % 2 ? s / 2 : 0); xx < x0 + w; xx += s) q.add(ellipse(xx, yy, rr, rr * k)); return q; };
    const spiral = (x: number, y: number, rx: number, ry: number): Shape[] => [0.45, 0.8].map(k => ({ path: ellipse(x, y, rx * k, ry * k), stroke: { color: tone(c, "deep"), width: 0.15 }, flat: true, opacity: 0.6 }));
    if (h) { const o = rect(-3.3, -60, 6.6, 60); return [...pc(o, c, 0.25), F(grid(-3.3, -57, 6.6, 57, 3.6, 0.7), WHITE, 0.85, o), S(ellipse(0, -60, 3.3, 1.1), cap), ...spiral(0, -60, 3.3, 1.1), F(ellipse(0, -60, 0.5, 0.2), "#2A1F1B")]; }
    const bd = rrect(-30, -15.5, 60, 7, 0.8), sheet = poly([[-30, -9.5], [30, -9.5], [30, -7.5], [21, 0], [-30, 0]]);
    return [
      S(sheet, c), F(grid(-28, -7.6, 58, 7, 4.4, 0.8, 0.4), WHITE, 0.9, sheet), F(rect(-30, -9.5, 60, 1.6), "#000000", 0.14, sheet), F(rect(-30, -1.8, 60, 1.8), tone(c, "shade"), 0.7, sheet), F(rect(-30, -2.1, 60, 0.35), tone(c, "light"), 0.6, sheet),
      S(poly([[21, 0], [30, -7.5], [22.6, -8.85]]), cap), F(poly([[21, 0], [30, -7.5], [28.6, -6.6], [21.9, -0.9]]), tone(cap, "shade"), 0.55),
      S(bd, c), F(grid(-30, -14, 60, 7, 4.4, 0.8), WHITE, 0.85, bd), F(rect(-30, -15.5, 60, 1.8), tone(c, "light"), 0.5, bd), F(rect(-30, -10.4, 60, 1.9), tone(c, "shade"), 0.55, bd),
      S(ellipse(-30, -12, 1.7, 3.5), cap), ...spiral(-30, -12, 1.7, 3.5), F(ellipse(-30, -12, 0.3, 0.6), "#2A1F1B"),
    ];
  } },
  banner: { w: 130, pp: 6, e: 0.4, g: [0, -52], d: ({ p }) => {
    const c = hex(p.color, "#C8283A"), o = smooth([[-60, -40, 0], [60, -40, 0], [60, -1, 0], [40, -3], [20, 0], [0, -3], [-20, 0], [-40, -3], [-60, -1, 0]], true, 1), sh: Shape[] = [];
    for (const d of [-1, 1]) sh.push(R([[d * 57, -38.4], [d * 61, -46], [d * 64, -53]], "#6B4A35", 0.5));
    sh.push(...pc(o, c, 0.1), F(rect(-60, -40, 120, 3.6), tone(c, "shade"), 0.7, o), lines([-1, 0, 1].map(k => [[k * 30 - 5, -36], [k * 30 - 7, -3]] as Vec2[]), tone(c, "shade"), 0.7, 0.3), ...[-57, -29, 0, 29, 57].map(x => S(ellipse(x, -38.2, 0.9), BRASS)));
    return { sh, text: words(str(p.words, "KUTLU OLSUN"), -54, -34, 108, 28, { color: luma(c) > 0.62 ? INK : WHITE, weight: 700, size: 13 }) };
  } },
  gift: { w: 22, pp: 12, e: 0.25, g: [0, -8], d: ({ p, i }) => {
    const c = p.color ? hex(p.color, BRIGHT[0]) : BRIGHT[(i * 3) % 8], k = [1, 0.8, 1.12][i % 3], rb = luma(c) > 0.7 ? "#C8283A" : "#F6F1E4", lid = tone(c, "light");
    const bow = (d: number) => P([[0, -16], [d * 5.4, -21.4], [d * 7, -17.4], [d * 2, -15.4]], rb), lo = rrect(-9, -13, 18, 13, 0.8);
    return T([...pc(lo, c, 0.18), S(rect(-1.7, -13, 3.4, 13), rb), S(rrect(-9.9, -16.4, 19.8, 4, 0.8), lid), S(rect(-1.7, -16.4, 3.4, 4), rb), S(poly([[0, -16], [-2.6, -9], [-0.6, -9.6]]), tone(rb, "shade")), S(poly([[0, -16], [2.6, -9], [0.6, -9.6]]), tone(rb, "shade")), bow(-1), bow(1), S(ellipse(0, -16.2, 1.5, 1.2), tone(rb, "shade"))], scale(k));
  } },
  blower: { w: 26, pp: 12, e: 0.2, g: [-9, -3.5], d: ({ p }) => {
    const cs = [hex(p.color, "#D9342B"), "#F2C230", "#3F74C4", "#3E8E4E"], tb = rrect(-8, -5.6, 15, 3.6, 1.8), sp = ellipse(11.4, -3.8, 3.3, 3.3);
    return [S(rrect(-11.4, -4.9, 4.6, 2.2, 0.8), "#2E2F35"), S(tb, cs[1]), ...[0, 1, 2, 3].map(k => F(poly([[-6 + k * 3.8, -5.6], [-4.2 + k * 3.8, -5.6], [-2.6 + k * 3.8, -2], [-4.4 + k * 3.8, -2]]), cs[0], 1, tb)), ...lit(tb, cs[1], 0.18), S(sp, cs[0]), ...[0.8, 1.6, 2.4].map(k => ({ path: ellipse(11.4, -3.8, k * 1.2, k * 1.2), stroke: { color: tone(cs[0], "deep"), width: 0.2 }, flat: true, opacity: 0.6 })), F(ellipse(11.4, -3.8, 0.6), tone(cs[0], "deep"))];
  } },
};

const art = mk("art", ART, "Art things: an easel with a canvas, a palette with paint dabs, paint tubes, brushes in a jar, a sketchbook, theatre comedy and tragedy masks, a stylised bust, a photo album, a record in its sleeve, a cassette, a hand-made clay pot, an ebru marbling tray, a calligraphy set or a painted plate.",
  "which art thing (the first, an easel, is the default)", ["a2-w-ressamlik", "b1-w-maske", "a1-w-heykel", "a2-w-album", "b1-w-sanat", "a1-w-resim", "a1-w-boya", "a1-w-tiyatro", "a1-w-muze", "a1-w-tabak"],
  { color: { type: "color", about: "the main colour: the easel's wood, a mask (the comedy one), the stone, the album's cover, a record sleeve, a cassette, the pot, the ebru's first swirl or the ink (each kind has its own default)" } }, ["art"], "how many side by side: a unit is one thing, one bunch of four tubes for paints, one pair of masks");

const party = mk("party", PARTY, "Party things: serpentine streamers, confetti, a letter garland (its letters from text), number candles (their digits from text, lit or not), a party popper, a sparkler, a paper lantern, fairy string lights, a party hat, a ribbon roll, a roll of wrapping paper, a cloth banner (its words from text), a wrapped gift or a party blower.",
  "which party thing (the first, streamers, is the default)", ["a1-w-dogum-gunu", "a1-w-kutlama", "a1-w-bayram", "b1-w-mum", "a1-w-hediye", "a2-w-hediye-paketi", "a1-w-dugun"],
  {
    color: { type: "color", about: "the main colour: the streamers' first roll, the confetti's first colour (then the rest bright), every garland flag, the first number candle, the popper, the lantern, the bulbs, every hat, the ribbon, the wrapping paper or the banner cloth (each kind has its own default)" },
    letters: { type: "text", about: "the garland: one flag per letter, a space leaves a gap (default İYİ Kİ DOĞDUN, up to 24)" },
    digits: { type: "text", about: "number_candles: a block candle for each digit (default 30, up to 8; a number is fine)" },
    words: { type: "text", about: "the banner's words on its cloth (default KUTLU OLSUN)" },
    lit: { type: "bool", default: true, about: "number candles burn, the sparkler sparks, the lantern and the string lights glow; false: out" },
  }, ["party"], "how many units side by side: a unit is one thing, one set of three serpentine rolls, one garland or one whole number of candles");

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { instrument, game, art, party };
