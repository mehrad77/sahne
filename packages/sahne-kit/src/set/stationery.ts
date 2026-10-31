// Props of the stationery family (STYLE.md): desk things, print, cards, money, tickets and bags. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art. Every generator is a table of kinds (`Kind`): one drawing
// each, around the origin, laid out by `build` (n copies, the held look, the text of the top copy).

import { Path, band, smooth, ellipse, rect, rrect, poly, tone, mix, mul, rotate, translate, groupBounds, type Affine, type PieceDef, type PieceOut, type ParamSpec, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, num, str, hex, holed } from "./draw.ts";

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = {};

const DARK = "#2E2F35", STEEL = "#B8BEC4", CREAM = "#F3EBD8", INK = "#2B2420", PAPER = "#F7F3EA", GOLD = "#D9A72E", WOOD = "#C79A63", PINE = "#E8C48A", WHITE = "#FFFFFF";

// ---- helpers ---------------------------------------------------------------------------------------------

const cnt = (v: unknown, d: number) => Math.max(1, Math.min(24, Math.round(num(v, d))));
/** A text param as a string (a list of lines joined). */
const txt = (v: unknown, d: string) => typeof v === "string" ? v : typeof v === "number" ? String(v) : Array.isArray(v) ? v.join("\n") : d;
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Paint printed on the paper (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand (wire, string, strap). */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Printed lines: a path of segments, stroked flat. */
const D = (p: Path, c: string, w = 0.2, op = 0.7, dash?: number[]): Shape => ({ path: p, stroke: { color: c, width: w, ...(dash ? { dash } : {}) }, flat: true, opacity: op });
/** A segment path from point pairs. */
const seg = (...q: number[][]) => q.reduce((p, [a, b, c, d]) => p.moveTo(a, b).lineTo(c, d), new Path());
/** Light from the upper left on an outline spanning x0…x1, y0…y1: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.2): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** A cut rounded slab, lit. */
const slab = (x: number, y: number, w: number, h: number, c: string, r = 0.5, k = 0.18): Shape[] => { const o = rrect(x, y, w, h, r); return [S(o, c), ...lit(o, c, x, x + w, y, y + h, k)]; };
/** A ring of `n` points of radii a and b about (x, y), turned by `t`: a star, a seal, a burst. */
const star = (x: number, y: number, n: number, a: number, b: number, t = 0) => poly(Array.from({ length: n * 2 }, (_, i) => [x + Math.sin(t + i * Math.PI / n) * (i % 2 ? b : a), y - Math.cos(t + i * Math.PI / n) * (i % 2 ? b : a)] as Vec2));
/** Printed text lines: `n` strips of varying length from (x, y), `gap` apart. */
const bars = (x: number, y: number, w: number, n: number, gap: number, c: string, th = 0.4, op = 0.55): Shape => {
  const p = new Path();
  for (let i = 0; i < n; i++) p.moveTo(x, y + i * gap).lineTo(x + w * (i === n - 1 && n > 1 ? 0.55 : 0.84 + ((i * 7) % 5) * 0.04), y + i * gap);
  return { path: p, stroke: { color: c, width: th }, flat: true, opacity: op };
};

interface Say { f?: "print" | "hand" | "screen"; k?: string; s?: number; a?: "left" | "center" | "right"; b?: boolean; n?: number; lit?: 0 }
/** What a kind draws with: its colour, the text params, whether it is the top copy (the only one that carries words), and `say`. */
interface G { c: string; n: number; t: Record<string, string>; on: boolean; r: Rng; tx: TextSpec[]; say(t: string, x: number, y: number, w: number, h: number, o?: Say): Shape[] }
/** One kind: `d` draws it around the origin (bottom centre) in `w` × `h` cm; `c` its colour, `pp` its ppcm, `e` the rim, `dx`/`dy` the step between copies (default side by side; `dx` 0 stacks them), `n` its usual count, `all` it draws all `n` itself, `hx` how far a held copy sits to the left of the next (round things that fanning would not part), `grip` the point a hand holds it by and the turn that stands it up. */
interface Kind { d(g: G): Shape[]; w: number; h: number; c?: string; pp?: number; e?: number; dx?: number; dy?: number; n?: number; all?: boolean; hx?: number; grip?: [number, number, number?] }

/** Words in a box: the text when this is the top copy and there is some, else strips standing for it. */
function sayOf(g: { tx: TextSpec[]; on: boolean }): G["say"] {
  return (t, x, y, w, h, o = {}) => {
    const k = o.k ?? INK, a = o.a ?? "center";
    if (t && g.on) { g.tx.push({ text: t, x, y, w, h, font: o.f ?? "print", color: k, align: a, ...(o.s ? { size: o.s } : {}), ...(o.b ? { weight: 700 } : {}), ...(o.lit === 0 ? { lit: 0 } : {}) }); return []; }
    if (o.n) return [bars(x, y + h / o.n / 2, w, o.n, h / o.n, k, Math.min(0.5, h / o.n * 0.4))];
    const th = Math.min(h * 0.4, 1.2), bw = w * 0.7;
    return [F(rrect(a === "left" ? x : a === "right" ? x + w - bw : x + (w - bw) / 2, y + (h - th) / 2, bw, th, th / 2), k, 0.55)];
  };
}

/** Lay out `n` copies of a kind (side by side, stacked, or fanned in the hand) and make the flat. */
function build(id: string, ks: Record<string, Kind>, p: Record<string, unknown>, r: Rng, tn: Record<string, string>): PieceOut {
  const k = ks[str(p.kind, "")] ?? Object.values(ks)[0], held = !!p.held, n = cnt(p.n, k.n ?? 1), c = hex(p.color, k.c ?? "#C4553A"), t: Record<string, string> = {};
  for (const [nm, d] of Object.entries(tn)) t[nm] = txt(p[nm], d);
  const [gx, gy, rot = 0] = k.grip ?? [0, -Math.min(6, k.h * 0.3)], dx = k.dx ?? k.w + 2, dy = k.dy ?? 0, e = k.e ?? 0.3, sh: Shape[] = [], tx: TextSpec[] = [];
  const m0 = k.all ? 1 : n;
  for (let i = 0; i < m0; i++) {
    const g = { c, t, r, n, on: i === m0 - 1, tx: [] as TextSpec[] } as G;
    g.say = sayOf(g);
    const art = k.d(g);
    if (held) {
      const m = mul(translate(-(m0 - 1 - i) * (k.hx ?? 0), 0), mul(rotate(-(m0 - 1 - i) * Math.min(0.3, 0.9 / m0)), mul(rotate(rot), translate(-gx, -gy))));
      sh.push(...T(art, m));
      if (!rot && i === m0 - 1) tx.push(...g.tx.map(q => ({ ...q, x: q.x - gx, y: q.y - gy })));
    } else {
      const x = (i - (m0 - 1) / 2) * dx + (dx ? 0 : (i % 3 - 1) * 0.3), y = dy * i;
      sh.push(...mv(art, x, y));
      tx.push(...g.tx.map(q => ({ ...q, x: q.x + x, y: q.y + y })));
    }
  }
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: e });
  // `lying`: laid flat on a seat or a table, its top away from the viewer (a hair off level, so it sorts by depth and is not
  // drawn under everything as a floor is); held, it is held as ever
  const lying = !!p.lying && !held;
  return { flats: [{ group: { shapes: sh, edge: e }, ppcm: Math.min(k.pp ?? 8, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(lying ? { pitch: -Math.PI / 2 + 0.02, y: 0.3 } : held ? {} : { shadow: "drop" as const }), ...(tx.length ? { text: tx } : {}) }] };
}

/** A generator from a table of kinds: `tn` the text params it reads (with defaults), `ps` their declarations. */
function gen(id: string, ks: Record<string, Kind>, tn: Record<string, string>, about: string, ps: Record<string, ParamSpec>, terms: string[], tags: string[], n = "how many, side by side or stacked"): PieceDef {
  const kinds = Object.keys(ks);
  return {
    draw: (p, r) => build(id, ks, p, r, tn),
    variants: Object.fromEntries(kinds.map(k => [k, { kind: k }])),
    meta: { about, params: { kind: { type: "enum", values: kinds, default: kinds[0] }, n: { type: "int", min: 1, max: 24, default: 1, about: n }, color: { type: "color", about: "the main colour (a palette id or a hex); each kind has its own default" }, lying: { type: "bool", default: false, about: "laid flat on a seat or a table, seen from above" }, ...ps }, terms, tags },
  };
}

// ---- stationery ------------------------------------------------------------------------------------------

const PENCIL_PTS: Vec2[] = [[-0.3, -1.2], [-0.3, -2.5], [0, -2.9], [0.3, -2.5], [0.3, -0.5], [0, 0], [-0.55, -0.5], [-0.55, -2.9], [-0.1, -3.4], [0.6, -2.9], [0.6, -1.5]];
const CRAYON = ["#D9332B", "#EE8A2E", "#F2C230", "#5E9A55", "#2F8C88", "#3F74C4", "#7A3E6E", "#6B4A35"];

const STATION: Record<string, Kind> = {
  pencil: { w: 17.5, h: 0.8, c: "#F2C230", pp: 16, e: 0.12, dx: 0, dy: -0.9, grip: [4.6, -0.4, 1.25], d: g => [
    S(rrect(-8.75, -0.8, 1, 0.8, 0.3), "#E58FA0"), S(rect(-7.8, -0.83, 1.1, 0.86), STEEL), D(seg([-7.4, -0.8, -7.4, 0], [-7.1, -0.8, -7.1, 0]), DARK, 0.08, 0.5),
    S(rect(-6.7, -0.8, 11.2, 0.8), g.c), F(rect(-6.7, -0.4, 11.2, 0.4), tone(g.c, "shade"), 0.5), F(rect(-6.7, -0.8, 11.2, 0.12), tone(g.c, "light"), 0.7),
    S(poly([[4.45, -0.8], [8.75, -0.4], [4.45, 0]]), PINE), F(poly([[4.45, -0.4], [8.75, -0.4], [4.45, 0]]), tone(PINE, "shade"), 0.5), F(poly([[7.7, -0.52], [8.75, -0.4], [7.7, -0.28]]), DARK, 0.9),
  ] },
  ruler: { w: 30, h: 3.4, c: "#8FD0E6", pp: 11, e: 0.2, dx: 0, dy: -3.6, grip: [-13, -1.7, -Math.PI / 2], d: g => {
    const o = rrect(-15, -3.4, 30, 3.4, 0.35), t = new Path();
    for (let i = 0; i <= 58; i++) t.moveTo(-14.5 + i / 2, -3.38).lineTo(-14.5 + i / 2, i % 2 ? -2.8 : -2.2);
    return [S(o, g.c), ...lit(o, g.c, -15, 15, -3.4, 0, 0.08), D(t, DARK, 0.08, 0.75), F(ellipse(13.4, -1.4, 0.5), tone(g.c, "deep"), 0.8), F(rect(-15, -0.5, 30, 0.5), tone(g.c, "shade"), 0.35, o)];
  } },
  eraser: { w: 5.5, h: 2.4, c: "#2F6DB5", pp: 16, e: 0.15, grip: [0, -1.2], d: g => [
    ...slab(-2.75, -2.4, 5.5, 2.4, "#F4F1EA", 0.5), F(ellipse(-2.3, -0.5, 0.5, 0.35), "#8E959C", 0.3),
    ...slab(-1.6, -2.55, 3.2, 2.55, g.c, 0.2), F(rect(-1.6, -1.7, 3.2, 0.45), "#F4F1EA"), F(rect(-1.6, -1.0, 3.2, 0.4), "#C8283A"),
  ] },
  sharpener: { w: 5.4, h: 2.2, c: "#D9534A", pp: 16, e: 0.12, grip: [-0.5, -1.1], d: g => [
    R([[2.0, -0.2], [2.5, -0.9], [2.9, -0.4], [3.2, -1.0]], PINE, 0.18), R([[2.2, -0.15], [2.6, -0.5], [3.0, -0.12]], PINE, 0.15),
    ...slab(-1.9, -2.2, 3.8, 2.2, g.c, 0.5), S(ellipse(-0.6, -1.15, 0.65), DARK), F(ellipse(-0.6, -1.15, 0.36), "#4B5058", 0.8),
    S(poly([[0.3, -1.95], [1.2, -1.95], [1.8, -0.3], [0.9, -0.3]]), STEEL), F(ellipse(1.15, -0.95, 0.17), DARK), F(rect(0.45, -1.8, 0.2, 1.3), WHITE, 0.4),
  ] },
  glue: { w: 3.2, h: 9.6, c: "#D9332B", pp: 16, e: 0.15, grip: [0, -3.2], d: g => [
    ...slab(-1.45, -6.4, 2.9, 6.4, "#F4F1EA", 0.4), F(rect(-1.45, -4.7, 2.9, 2.6), g.c), F(ellipse(0, -3.4, 0.75), "#F4F1EA", 0.9), F(rect(-1.45, -0.6, 2.9, 0.6), tone(g.c, "deep")),
    ...slab(-1.6, -9.6, 3.2, 3.7, g.c, 0.55), D(seg([-0.7, -8.8, -0.7, -6.8], [0, -8.8, 0, -6.8], [0.7, -8.8, 0.7, -6.8]), tone(g.c, "deep"), 0.12, 0.5),
  ] },
  stapler: { w: 15.6, h: 5.6, c: "#C8283A", pp: 12, e: 0.25, grip: [0, -4.6], d: g => {
    const arm = smooth([[-7.5, -1.9, 0], [-7.7, -4.6], [-5, -5.6], [2, -5.4], [7.2, -4.4], [7.8, -3.3, 0], [7.3, -2.3, 0], [-4, -2.2, 0]]);
    return [S(rrect(-7.6, -1.5, 15.2, 1.5, 0.6), DARK), S(rect(4.0, -1.95, 3.4, 0.5), STEEL), S(rect(-4.5, -3.0, 11.5, 0.9), STEEL), S(arm, g.c), F(ellipse(-1.5, -4.95, 4.6, 0.32), tone(g.c, "light"), 0.6), F(rect(3, -5.2, 5, 3.2), tone(g.c, "shade"), 0.4, arm), S(ellipse(-6.9, -2.2, 0.55), STEEL)];
  } },
  tape: { w: 14.6, h: 9.8, c: "#3A3D45", pp: 12, e: 0.25, grip: [0, -4.5], d: g => [
    S(ellipse(-1.8, -6.4, 3.4), "#E9D58A"), F(ellipse(-1.8, -6.4, 2.4, 2.4), "#B5874C", 0.18), S(ellipse(-1.8, -6.4, 1.3), mix("#E9D58A", "#8E959C", 0.5)), S(ellipse(-1.8, -6.4, 0.6), tone(g.c, "deep")),
    F(poly([[1.2, -4.9], [6.9, -3.5], [6.9, -2.8], [1.6, -3.9]]), "#E9D58A", 0.8),
    P([[-6.5, 0, 0], [6.5, 0, 0], [6.3, -2.0], [3, -3.3], [-3.5, -3.6], [-6.5, -2.2]], g.c), F(ellipse(-2.5, -3.0, 3.6, 0.25), tone(g.c, "light"), 0.6),
    S(poly([[6.0, -3.6], [7.4, -3.3], [7.1, -3.0], [7.4, -2.7], [7.1, -2.4], [7.4, -2.1], [6.0, -2.0]]), STEEL),
  ] },
  clips: { w: 1.3, h: 3.4, c: STEEL, pp: 16, e: 0.1, dx: 2.1, grip: [0, -1.5], d: g => [R(PENCIL_PTS, g.c, 0.2)] },
  calculator: { w: 9.8, h: 15.5, c: "#3A3D45", pp: 12, e: 0.3, grip: [0, -5], d: g => {
    const sh = [...slab(-4.9, -15.5, 9.8, 15.5, g.c, 1, 0.14), S(rrect(-4, -14.7, 8, 3, 0.4), "#B7C9A8"), S(rect(1.2, -15.1, 3, 0.9), "#5A4A3A")];
    g.tx.push({ text: g.t.display, x: -3.8, y: -14.6, w: 7.6, h: 2.8, size: 2.2, font: "screen", color: "#26302A", align: "right" });
    for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) if (j < 4 || i !== 1) sh.push(S(rrect(-4 + i * 2.08, -10.6 + j * 1.85, j === 4 && !i ? 3.83 : 1.75, 1.3, 0.35), i === 3 ? "#E8892E" : j ? "#D8D4CC" : "#8E959C"));
    return sh;
  } },
  highlighter: { w: 14, h: 2.1, c: "#EDE72E", pp: 14, e: 0.15, dx: 0, dy: -2.3, grip: [3.2, -1.05, 1.25], d: g => {
    const pale = mix(g.c, WHITE, 0.55);
    return [S(rrect(-7, -2.05, 3.8, 2.05, 0.5), g.c), F(rect(-4.2, -2.05, 1, 2.05), tone(g.c, "shade"), 0.4), S(rrect(-3.4, -2, 8.2, 2, 0.5), pale), F(rect(-3.4, -1, 8.2, 1), tone(pale, "shade"), 0.4), F(rect(-1.4, -2, 3.8, 2), g.c, 0.9), F(rect(2.4, -2, 0.4, 2), tone(g.c, "shade"), 0.5),
      S(rrect(-6.8, -2.4, 3, 0.5, 0.2), tone(g.c, "shade")), S(rect(4.4, -1.7, 1.2, 1.4), pale), S(poly([[5.4, -1.7], [7, -1.4], [7, -0.55], [5.4, -0.3]]), g.c), F(poly([[6.2, -1.45], [7, -1.4], [7, -0.55], [6.2, -0.6]]), tone(g.c, "shade"), 0.6)];
  } },
  crayons: { w: 10, h: 11.3, c: "#F2C230", pp: 14, e: 0.25, grip: [0, -3], d: g => [
    ...CRAYON.flatMap((c, i) => { const x = -3.85 + i * 1.1, h = 9.6 + (i * 5 % 3) * 0.5; return [S(rect(x - 0.52, -h, 1.04, h - 5), c), S(poly([[x - 0.52, -h], [x, -h - 1.5], [x + 0.52, -h]]), tone(c, "light"))]; }),
    ...slab(-5, -6.5, 10, 6.5, g.c, 0.4, 0.14), F(rect(-5, -6.5, 10, 0.9), tone(g.c, "deep"), 0.6), F(ellipse(0, -3.2, 3.2, 1.8), "#F4F1EA", 0.92), F(rect(-3.2, -3.6, 6.4, 0.5), "#C8283A"), F(rect(-3.2, -2.7, 6.4, 0.5), "#3F74C4"),
  ] },
  chalk: { w: 8.2, h: 1.1, c: "#F4F1EA", pp: 16, e: 0.1, dx: 0, dy: -1.2, grip: [1.6, -0.55, 1.25], d: g => [
    F(ellipse(-1, -0.1, 3.4, 0.35), "#F4F1EA", 0.35), S(rrect(-4, -1.1, 8, 1.1, 0.4), g.c), F(rect(-4, -0.45, 8, 0.45), tone(g.c, "shade"), 0.5), F(ellipse(3.7, -0.55, 0.28, 0.5), tone(g.c, "shade"), 0.7),
  ] },
  board_eraser: { w: 13, h: 6.2, c: WOOD, pp: 14, e: 0.25, grip: [0, -4.8], d: g => [
    ...slab(-6.2, -3.8, 12.4, 3.8, "#4A4D55", 0.4, 0.12), F(ellipse(-2, -1.4, 3, 0.7), WHITE, 0.3), F(ellipse(3, -2.4, 2.2, 0.5), WHITE, 0.25), F(ellipse(0, -0.6, 4, 0.4), WHITE, 0.2),
    ...slab(-6.5, -6.2, 13, 2.8, g.c, 0.6), D(seg([-5, -5.2, 3, -5.2], [-4, -4.4, 5, -4.4]), tone(g.c, "shade"), 0.1, 0.5),
  ] },
  globe: { w: 22, h: 31, c: "#5B93C7", pp: 9, e: 0.35, grip: [0, -4], d: g => {
    const s = ellipse(0, -21, 9.4), land = ["#C9B26B", "#7DA06A", "#B8B07A"], tl = (sh: Shape[]) => T(sh, mul(translate(0, -21), mul(rotate(0.4), translate(0, 21))));
    return [
      ...slab(-6, -2.2, 12, 2.2, DARK, 1), S(rect(-0.9, -12, 1.8, 10), DARK),
      { path: ellipse(0, -21, 10.5), stroke: { color: GOLD, width: 0.8 } },
      S(s, g.c),
      ...tl([F(smooth([[-6, -26], [-2, -29], [1, -26], [-1, -22], [-5, -21]]), land[0], 1, s), F(smooth([[3, -22], [8, -23], [7, -15], [4, -13], [2, -17]]), land[1], 1, s), F(smooth([[-6, -16], [-2, -17], [-1, -11], [-4, -9], [-7, -12]]), land[2], 1, s), F(smooth([[-1, -31], [3, -31], [3, -29], [-1, -29]]), WHITE, 0.8, s)]),
      D(ellipse(0, -21, 4.2, 9.4), WHITE, 0.12, 0.3), D(seg([-9.4, -21, 9.4, -21], [-8.6, -26, 8.6, -26], [-8.6, -16, 8.6, -16]), WHITE, 0.12, 0.3),
      { path: holed(ellipse(0, -21, 14), [ellipse(-2.6, -23, 9.2)]), fill: tone(g.c, "deep"), evenodd: true, flat: true, opacity: 0.45, clip: s },
      F(ellipse(-4, -26, 2.2, 1.3), WHITE, 0.3),
    ];
  } },
  hole_punch: { w: 20, h: 8.6, c: "#2F6DB5", pp: 14, e: 0.25, grip: [-3, -5], d: g => [
    ...slab(-9.4, -2, 12.4, 2, STEEL, 0.6), S(rect(-7.8, -1.5, 9.2, 0.8), DARK), S(rect(-6.8, -4.1, 1.7, 2.2), STEEL), S(rect(-1.3, -4.1, 1.7, 2.2), STEEL),
    P([[-9.4, -3.2, 0], [-9, -6.8], [-4.2, -8.6], [1, -7.4], [3, -4.8], [2.6, -3.4, 0], [-5.2, -3.9]], g.c), F(ellipse(-4.8, -7.7, 3.6, 0.35), tone(g.c, "light"), 0.6), S(ellipse(-8.8, -3.4, 0.6), STEEL),
    { path: holed(rrect(4.4, -9, 6.6, 9, 0.2), [ellipse(5.9, -2.7, 0.55), ellipse(5.9, -6.3, 0.55)]), fill: PAPER, evenodd: true }, F(rect(4.4, -0.5, 6.6, 0.5), "#8E959C", 0.3),
  ] },
  stamp: { w: 25, h: 11, c: "#2F4FB5", pp: 12, e: 0.25, grip: [0, -7], d: g => [
    ...slab(-12.3, -2.4, 8.6, 2.4, STEEL, 0.5), S(rrect(-11.8, -3.1, 7.6, 1.1, 0.4), g.c), F(rect(-11.8, -2.6, 7.6, 0.4), tone(g.c, "deep"), 0.5),
    S(ellipse(0, -9.6, 1.9, 1.8), WOOD), S(rect(-0.8, -8, 1.6, 3.2), PINE), ...slab(-3, -4.8, 6, 1.7, WOOD, 0.4), S(rect(-2.7, -3.2, 5.4, 1.2), DARK), S(rect(-2.4, -2.2, 4.8, 0.9), g.c),
    ...slab(3.8, -6.6, 8.4, 6.6, PAPER, 0.3, 0.08), ...g.say(g.t.label, 4.6, -4.8, 6.8, 2.8, { k: g.c, b: true, s: 1.7 }), D(rrect(4.4, -5.6, 7.2, 4.4, 0.4), g.c, 0.2, 0.85),
  ] },
  sticky_notes: { w: 7.6, h: 7.6, c: "#F6E27A", pp: 14, e: 0.25, dx: 8.6, grip: [0, -2], d: g => {
    const o = rect(-3.8, -7.6, 7.6, 7.6), sh = [S(o, g.c), F(rect(-3.8, -7.6, 7.6, 1.8), tone(g.c, "light"), 0.35), D(seg([-3.8, -0.45, 3.8, -0.45], [-3.8, -0.9, 3.8, -0.9]), tone(g.c, "deep"), 0.1, 0.5), F(poly([[3.8, -2.2], [1.6, 0], [3.8, 0]]), tone(g.c, "deep"), 0.45), F(poly([[3.8, -2.2], [1.6, 0], [2.7, -1.2]]), tone(g.c, "light"), 0.95)];
    return [...sh, ...g.say(g.t.label, -3.3, -5.6, 6.6, 4, { f: "hand", k: "#2A3A8C", n: 4, a: "left" })];
  } },
  pen_cup: { w: 9, h: 19.5, c: "#2F8C88", pp: 12, e: 0.25, grip: [0, -5], d: g => [
    ...([[-2, -3.8, -18, "#F2C230"], [-0.5, -0.8, -19.5, "#2F5FA8"], [1, 2.2, -17, "#C8283A"], [0.5, 3.6, -16, DARK]] as [number, number, number, string][]).flatMap(([x0, x1, y, c]) => [R([[x0, -6], [x1, y + 1.4]], c, 0.85), S(poly([[x1 - 0.42, y + 1.4], [x1, y], [x1 + 0.42, y + 1.4]]), c === DARK ? STEEL : PINE)]),
    ...slab(-4.25, -10, 8.5, 10, g.c, 1), F(rect(-4.25, -6.2, 8.5, 0.7), tone(g.c, "light"), 0.5), F(rect(-4.25, -3.4, 8.5, 0.7), tone(g.c, "deep"), 0.35), ...slab(-4.5, -10.4, 9, 1.1, tone(g.c, "light"), 0.5),
  ] },
  business_cards: { w: 9, h: 5.5, c: "#2F6DB5", pp: 16, e: 0.2, dx: 1.5, grip: [0, -1.2], d: g => [
    ...slab(-4.5, -5.5, 9, 5.5, PAPER, 0.3, 0.08), F(rect(-4.5, -5.5, 1.1, 5.5), g.c), F(ellipse(2.9, -4.1, 0.8), g.c, 0.9), F(ellipse(2.9, -4.1, 0.35), PAPER),
    ...g.say(g.t.label, -2.8, -4.7, 4.8, 1.4, { b: true, a: "left", s: 1.1 }), bars(-2.8, -2.6, 4.2, 2, 0.8, INK, 0.25, 0.5),
  ] },
};

props.stationery = gen("stationery", STATION, { display: "0", label: "" },
  "Desk things: a pencil, ruler, eraser, sharpener, glue stick, stapler, tape dispenser, paper clips, calculator (its display text), highlighter, box of crayons, chalk, felt board eraser, desk globe, hole punch, rubber stamp with ink pad (its imprint text), pad of sticky notes (a note's words), pen cup and business cards (a name).",
  { display: { type: "text", default: "0", about: "calculator: the number on its display" }, label: { type: "text", about: "stamp: the imprint; sticky_notes: the note's words; business_cards: the name" } },
  ["a1-w-cetvel", "a1-w-silgi", "b1-w-hesap-makinesi", "a1-w-kalem", "a1-w-tahta"], ["stationery", "desk", "school"], "how many (long things stack, flat things lie side by side)");

// ---- print -----------------------------------------------------------------------------------------------

/** A printed tile over an outline (checks, dots). */
const tiled = (path: Path, tile: { w: number; h: number; shapes: Shape[] }, op = 1, clip?: Path): Shape => ({ path, tile, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A printed photo of a faceless figure (head and shoulders) in the box. */
const photo = (x: number, y: number, w: number, h: number, c = "#8E959C"): Shape[] => {
  const o = rect(x, y, w, h);
  return [F(o, mix(c, WHITE, 0.5)), F(rect(x, y + h * 0.62, w, h * 0.38), c, 0.8, o), F(ellipse(x + w * 0.5, y + h * 0.4, w * 0.12, w * 0.14), tone(c, "deep"), 0.9, o), F(ellipse(x + w * 0.5, y + h * 0.98, w * 0.3, h * 0.4), tone(c, "deep"), 0.9, o)];
};
/** A printed skyline of a mosque (dome, two minarets) on the line y, `s` × its size, centred at x. */
const skyline = (x: number, y: number, s: number, c: string, clip?: Path): Shape[] => [
  F(rect(x - 6.5 * s, y - 2 * s, 13 * s, 2 * s), c, 1, clip), F(ellipse(x, y - 2 * s, 3.6 * s, 3.2 * s), c, 1, clip), F(ellipse(x - 4 * s, y - 2 * s, 1.8 * s, 1.8 * s), c, 1, clip), F(ellipse(x + 4 * s, y - 2 * s, 1.8 * s, 1.8 * s), c, 1, clip),
  ...[-6.3, 6.3].flatMap(d => [F(rect(x + d * s - 0.35 * s, y - 9 * s, 0.7 * s, 7 * s), c, 1, clip), F(poly([[x + d * s - 0.5 * s, y - 9 * s], [x + d * s, y - 11.2 * s], [x + d * s + 0.5 * s, y - 9 * s]]), c, 1, clip)]),
];
const PAP = "#E9E3D3";

const PRINT: Record<string, Kind> = {
  newspaper: { w: 31, h: 22.5, c: "#B3261E", pp: 10, e: 0.3, dx: 4, grip: [0, -5], d: g => {
    const sh = [...slab(-15.5, -22.5, 31, 22.5, PAP, 0.2, 0.06), ...g.say(g.t.title || "GAZETE", -13.5, -21.6, 27, 4.4, { b: true, s: 3.6 })];
    sh.push(F(rect(-14, -16.8, 28, 0.4), INK, 0.85), F(rect(-14, -16.1, 28, 0.12), INK, 0.7), F(rect(-14, -15.5, 6, 0.8), g.c), F(rrect(-14, -14, 21, 1.1, 0.3), INK, 0.85), F(rrect(-14, -12.4, 16, 1.1, 0.3), INK, 0.85), ...photo(-14, -10.6, 9, 7), bars(-4, -10.6, 18, 5, 1.3, INK, 0.4),
      F(rect(-15.5, -1.3, 31, 1.3), tone(PAP, "shade"), 0.5), F(rect(-15.5, -1.55, 31, 0.25), WHITE, 0.45), D(seg([-15.5, -0.6, 15.5, -0.6]), tone(PAP, "deep"), 0.1, 0.5));
    if (g.t.lines && g.on) sh.push(...g.say(g.t.lines, -4, -4.6, 18, 3, { a: "left", s: 0.8 }));
    else sh.push(bars(-14, -2.6, 28, 1, 1, INK, 0.4));
    return sh;
  } },
  magazine: { w: 21, h: 28, c: "#C8283A", pp: 11, e: 0.3, dx: 4, grip: [0, -6], d: g => {
    const o = rect(-10.5, -23, 21, 23);
    return [...slab(-10.5, -28, 21, 28, g.c, 0.3, 0.07), F(o, mix(g.c, "#F2C230", 0.55)), F(ellipse(3.5, -14, 4.2), "#FFF1C2"), ...skyline(-3, -6.5, 0.9, tone(g.c, "deep"), o), F(rect(-10.5, -6.5, 21, 6.5), tone(g.c, "deep"), 0.9),
      ...g.say(g.t.title, -9.5, -27.6, 19, 5.2, { b: true, s: 4.2, k: WHITE }), bars(-9.5, -5.2, 9, 3, 1.3, WHITE, 0.4, 0.8), F(rect(5, -5.6, 5, 3.6), PAPER), D(seg(...Array.from({ length: 12 }, (_, i) => [5.4 + i * 0.37, -5.2, 5.4 + i * 0.37, -2.4])), INK, 0.12, 0.8), F(ellipse(7.3, -17.6, 2.2), "#F2C230"), F(ellipse(7.3, -17.6, 1.4), g.c)];
  } },
  poster: { w: 42, h: 59, c: "#E8892E", pp: 7, e: 0.4, dx: 8, grip: [0, -10], d: g => {
    const o = ellipse(0, -33, 13);
    return [...slab(-21, -59, 42, 59, g.c, 0.3, 0.06), ...g.say(g.t.title, -18, -56.5, 36, 10, { b: true, s: 8, k: WHITE }), S(o, CREAM), F(rect(-13, -33, 26, 13), "#4F8FBF", 1, o), F(ellipse(5, -35, 3.4), g.c, 1, o), F(poly([[-13, -26], [-7, -33], [-1, -27], [6, -34], [13, -26], [13, -20], [-13, -20]]), tone(g.c, "deep"), 1, o),
      ...(g.t.lines && g.on ? g.say(g.t.lines, -16, -16.6, 32, 12, { k: WHITE, s: 3 }) : [bars(-14, -14.6, 28, 3, 3.2, WHITE, 1, 0.9)]), F(rrect(-5, -6, 10, 2.8, 1.4), WHITE, 0.9),
      ...[[-21, -59, 0.8], [21, -59, -0.8], [-21, 0, -0.8], [21, 0, 0.8]].map(([x, y, a]) => F(poly([[-3, -1.2], [3, -1.2], [3, 1.2], [-3, 1.2]]).transform(mul(translate(x, y), rotate(a))), "#E9D58A", 0.75))];
  } },
  menu: { w: 15, h: 24, c: "#8A3B2E", pp: 12, e: 0.3, dx: 5, grip: [0, -5], d: g => {
    const sh = [...slab(-7.5, -24, 15, 24, CREAM, 0.8, 0.06), D(rrect(-6.6, -23.1, 13.2, 22.2, 0.5), g.c, 0.25, 0.8), ...g.say(g.t.title || "MENÜ", -5, -22.4, 10, 3.8, { b: true, s: 3.2, k: g.c }), D(seg([-4.5, -17.5, -1, -17.5], [1, -17.5, 4.5, -17.5]), g.c, 0.15, 0.7), F(ellipse(0, -17.5, 0.6), g.c)];
    if (g.t.lines && g.on) return [...sh, ...g.say(g.t.lines, -5.5, -16, 11, 14, { a: "left", s: 1 })];
    for (let i = 0; i < 6; i++) { const y = -15 + i * 2.2; sh.push(F(rrect(-5.5, y, 5.2 + (i * 3 % 4) * 0.5, 0.5, 0.25), INK, 0.6), D(seg([1.2, y + 0.25, 3, y + 0.25]), INK, 0.12, 0.5, [0.2, 0.4]), F(rrect(3.3, y, 2.2, 0.5, 0.25), g.c, 0.75)); }
    return sh;
  } },
  brochure: { w: 25, h: 21, c: "#2F8C88", pp: 11, e: 0.3, dx: 8, grip: [0, -5], d: g => {
    const win = rect(-4.1, -14.2, 8.2, 7.6);
    return [S(poly([[-12.3, -20.4], [-4.8, -21], [-4.8, 0], [-12.3, -0.6]]), "#F1ECE0"), S(poly([[4.8, -21], [12.3, -20.4], [12.3, -0.6], [4.8, 0]]), mix(PAPER, "#8E959C", 0.3)), S(rect(-4.8, -21, 9.6, 21), PAPER),
      F(rect(-4.8, -21, 9.6, 6), g.c), ...g.say(g.t.title, -4.2, -20.5, 8.4, 4.8, { b: true, s: 2.4, k: WHITE }), F(win, "#BFD9E8"), ...skyline(0, -7, 0.55, tone(g.c, "deep"), win), F(rect(-4.1, -8, 8.2, 1.4), "#4F8FBF", 1, win), bars(-4.1, -4.6, 8.2, 3, 1.2, INK, 0.35),
      bars(-11, -17.6, 5.6, 6, 1.3, INK, 0.35), ...photo(-11.2, -9, 6, 5.5), bars(-11, -2.8, 5.6, 2, 1.2, INK, 0.35),
      F(rect(5.8, -18.5, 5.8, 6), "#E6DFC8"), D(smooth([[6, -13], [8, -15], [9, -14], [11.4, -17.5]], false, 1), "#D9332B", 0.25, 0.9, [0.6, 0.4]), F(ellipse(11.4, -17.5, 0.5), "#D9332B"), bars(5.8, -10.8, 5.8, 6, 1.3, INK, 0.35)];
  } },
  map: { w: 20, h: 26, c: "#C8283A", pp: 9, e: 0.3, dx: 5, grip: [0, -6], d: g => {
    const o = poly([[-10, -25.5], [-5, -26], [0, -25.5], [5, -26], [10, -25.5], [10, -0.5], [5, 0], [0, -0.5], [-5, 0], [-10, -0.5]]), land = "#E6DFC8", clipped = (p: Path, c: string, w: number, op: number, dash?: number[]) => ({ ...D(p, c, w, op, dash), clip: o });
    return [S(o, land), F(rect(-5, -27, 5, 28), tone(land, "shade"), 0.18, o), F(rect(5, -27, 5, 28), tone(land, "shade"), 0.18, o), F(band([[-11, -6], [-4, -10], [3, -12], [11, -18]], [3.4, 3.8, 3.2, 3.8]), "#9CC6DD", 1, o),
      F(ellipse(-6, -19, 2.8, 2), "#A9CC9A", 1, o), F(ellipse(6.5, -5.5, 3.2, 2.2), "#A9CC9A", 1, o), clipped(seg(...[-7.5, -2.5, 2.5, 7.5].map(x => [x, -26, x + 1, 0]), [-11, -20, 11, -19], [-11, -4, 11, -3.4]), WHITE, 0.25, 0.9),
      clipped(seg([-11, -14, 11, -16], [-1, -26, 2, 0]), "#F2C230", 0.7, 0.95), clipped(seg([0, -26, 0, 0], [5, -26, 5, 0], [-5, -26, -5, 0]), tone(land, "shade"), 0.1, 0.5),
      D(smooth([[-7, -2.4], [-3, -7], [1, -10], [3, -15]], false, 1), "#2F5FA8", 0.3, 0.9, [0.8, 0.5]), F(smooth([[3, -15, 0], [1.5, -17.8], [3, -20], [4.5, -17.8]]), "#D9332B"), F(ellipse(3, -17.9, 0.6), WHITE),
      F(rect(-10, -24.6, 20, 3.4), g.c, 1, o), ...g.say(g.t.title, -9.2, -24.5, 18.4, 3.2, { b: true, s: 2.4, k: WHITE })];
  } },
  sketch_map: { w: 15, h: 20.5, c: "#2F5FA8", pp: 12, e: 0.3, dx: 5, grip: [0, -5], d: g => {
    const bld = [[-5.5, -9, 3, 2.6], [2.5, -11, 3.4, 3], [-5.8, -4.5, 3.2, 2.4], [3.2, -5.6, 3, 2.6]], ink = (p: Path, w = 0.18, op = 0.9, dash?: number[]) => D(p, g.c, w, op, dash);
    return [...slab(-7.5, -20.5, 15, 20.5, PAPER, 0.2, 0.05), ...g.say(g.t.title, -6, -19.6, 12, 2.6, { f: "hand", k: g.c, s: 2 }),
      ink(seg([-1.3, -1, -1.1, -16], [0.3, -1, 0.5, -16], [-7, -8, 7, -8.6], [-7, -7.2, 7, -7.8]), 0.18, 0.9), ...bld.map(([x, y, w, h]) => ink(rect(x, y, w, h).add(rect(x + 0.5, y + 0.5, w - 1, h - 1)), 0.14, 0.9)),
      ink(smooth([[-7, -17], [-4, -16], [-2.5, -14.2], [-2.8, -12]], false, 1), 0.2), ink(smooth([[-6.4, -16], [-4.6, -15.2], [-3.4, -13.6]], false, 1), 0.14, 0.5), ink(ellipse(5.5, -2, 0.9).add(ellipse(3.8, -2.4, 0.7)), 0.14, 0.8),
      ink(smooth([[-0.4, -1.5], [-0.2, -6], [3.4, -8.2], [4, -13.5]], false, 1), 0.34, 0.95, [0.9, 0.55]), ink(poly([[3.2, -13], [4, -14.4], [4.8, -13]], false), 0.3, 0.95), ink(seg([5.2, -17.4, 6.8, -15.8], [6.8, -17.4, 5.2, -15.8]), 0.35, 0.95), F(ellipse(-0.4, -1.4, 0.55), g.c, 0.9)];
  } },
  letter: { w: 25, h: 21, c: "#2A3A8C", pp: 11, e: 0.3, dx: 6, grip: [-3, -5], d: g => {
    const env = "#E7D9B4", ink = g.c, sh = [...slab(-1, -10.5, 15, 10.5, env, 0.3, 0.1), F(poly([[-1, -10.5], [6.5, -4.6], [14, -10.5]]), tone(env, "shade"), 0.55), F(rect(10, -9.4, 3, 3.6), "#C8283A", 0.85), D(rect(10, -9.4, 3, 3.6), WHITE, 0.2, 0.8, [0.3, 0.3]), bars(5, -3.8, 8, 2, 1.1, INK, 0.3, 0.5)];
    sh.push(...slab(-10, -20.5, 14, 20, PAPER, 0.15, 0.06), F(rect(-10, -13.5, 14, 0.35), tone(PAPER, "shade"), 0.5), F(rect(-10, -13.15, 14, 0.3), WHITE, 0.5), F(rect(-10, -6.9, 14, 0.35), tone(PAPER, "shade"), 0.5), F(rect(-10, -6.55, 14, 0.3), WHITE, 0.5),
      ...g.say(g.t.title, -8.8, -19.6, 8, 2.2, { f: "hand", k: ink, a: "left", s: 1.5 }), ...g.say(g.t.lines, -8.8, -17, 11.6, 14.6, { f: "hand", k: ink, a: "left", s: 1.1, n: 9 }));
    return sh;
  } },
  bill: { w: 19, h: 26.5, c: "#2F6DB5", pp: 10, e: 0.3, dx: 5, grip: [0, -6], d: g => {
    const sh = [...slab(-9.5, -26.5, 19, 26.5, PAPER, 0.2, 0.06), F(rect(-9.5, -26.5, 19, 5), g.c), F(ellipse(-7.2, -24, 1.5), WHITE, 0.9), F(ellipse(-7.2, -24, 0.7), g.c), ...g.say(g.t.title || "FATURA", -4.8, -25.8, 13.4, 3.4, { b: true, s: 2.4, k: WHITE, a: "right" }),
      D(rrect(-8.5, -19.4, 8.6, 3.6, 0.3), INK, 0.15, 0.5), bars(-8, -18.6, 6.5, 3, 1, INK, 0.3, 0.5), F(rrect(2, -19.4, 6.5, 3.6, 0.3), g.c, 0.14), bars(2.6, -18.6, 4.2, 2, 1.3, INK, 0.3, 0.5)];
    if (g.t.lines && g.on) sh.push(...g.say(g.t.lines, -8.5, -14.6, 17, 8.4, { a: "left", s: 1 }));
    else for (let i = 0; i < 7; i++) { const y = -14.2 + i * 1.2; sh.push(F(rrect(-8.5, y, 5 + (i * 3 % 3), 0.4, 0.2), INK, 0.5), F(rrect(4.6, y, 3.9, 0.4, 0.2), INK, 0.5), D(seg([-8.5, y + 0.8, 8.5, y + 0.8]), INK, 0.07, 0.22)); }
    sh.push(F(rrect(-8.5, -5.6, 17, 2.8, 0.4), g.c, 0.16), F(rrect(2.5, -4.7, 6, 1, 0.5), g.c, 0.9), D(seg(...Array.from({ length: 22 }, (_, i) => [-8.4 + i * 0.4, -2.4, -8.4 + i * 0.4, -0.9])), INK, 0.1, 0.7));
    return sh;
  } },
  receipt: { w: 7.2, h: 22, c: "#2B2420", pp: 14, e: 0.2, dx: 3.2, grip: [0, -5], d: g => {
    const o = poly([[-3.6, -22], [3.6, -22], ...Array.from({ length: 7 }, (_, i) => [3.6 - i * 1.2, i % 2 ? -0.9 : 0] as Vec2)]);
    return [S(o, "#F6F2E8"), F(rect(2, -22, 1.6, 22), tone("#F6F2E8", "shade"), 0.4, o), ...g.say(g.t.title, -3, -21.2, 6, 2.2, { b: true, s: 1.4 }), D(seg([-3, -18.4, 3, -18.4], [-3, -9.4, 3, -9.4]), INK, 0.1, 0.5, [0.3, 0.3]),
      ...(g.t.lines && g.on ? g.say(g.t.lines, -3, -18, 6, 8.2, { a: "left", s: 0.8 }) : [bars(-3, -17.2, 6, 6, 1.35, INK, 0.3, 0.55)]), F(rrect(-3, -8.4, 3, 0.6, 0.3), INK, 0.8), F(rrect(0.6, -8.4, 2.4, 0.6, 0.3), INK, 0.8), D(seg(...Array.from({ length: 16 }, (_, i) => [-3 + i * 0.4 + (i % 3) * 0.05, -6.2, -3 + i * 0.4 + (i % 3) * 0.05, -2.6])), INK, 0.14, 0.8)];
  } },
  certificate: { w: 28, h: 20, c: "#B8862B", pp: 9, e: 0.3, dx: 6, grip: [0, -5], d: g => [
    ...slab(-14, -20, 28, 20, "#F7F0DC", 0.2, 0.05), D(rect(-13, -19, 26, 18), g.c, 0.5, 0.9), D(rect(-12.2, -18.2, 24.4, 16.4), g.c, 0.12, 0.8), ...[-1, 1].flatMap(a => [-1, 1].map(b => F(ellipse(a * 12.6, -10 + b * 8.6, 0.8), g.c))),
    ...g.say(g.t.title || "SERTİFİKA", -9.5, -17.4, 19, 3.8, { b: true, s: 3.2, k: g.c }), bars(-6, -12.6, 12, 2, 1.2, INK, 0.3, 0.5), ...g.say(g.t.lines, -8, -10.6, 16, 3.2, { f: "hand", s: 2.4 }), D(seg([-7, -7.6, 7, -7.6]), INK, 0.1, 0.6),
    S(poly([[7, -4.2], [5.8, -0.5], [7.2, -1.6], [8, -4.2]]), "#C8283A"), S(poly([[8.4, -4.2], [9.4, -0.5], [8.2, -1.6], [7.6, -4.2]]), tone("#C8283A", "shade")), S(star(8, -5.4, 14, 2.9, 2.4), GOLD), S(ellipse(8, -5.4, 1.7), tone(GOLD, "light")), F(ellipse(8, -5.4, 1), GOLD, 0.8),
    D(smooth([[-10, -3.2], [-8.6, -4.6], [-7.6, -2.6], [-6, -4.4], [-4.6, -3]], false, 1), INK, 0.18, 0.8), D(seg([-10.5, -2.2, -3.5, -2.2]), INK, 0.1, 0.6),
  ] },
  diploma: { w: 31, h: 4.4, c: "#B3261E", pp: 11, e: 0.25, dx: 0, dy: -4.4, grip: [0, -2.1, -1.1], d: g => [
    S(ellipse(15, -2.1, 1, 2.1), tone(CREAM, "shade")), S(rrect(-15, -4.2, 30, 4.2, 2.1), CREAM), F(rect(-14, -2, 28, 2), tone(CREAM, "shade"), 0.45), F(rect(-14, -4, 28, 0.5), WHITE, 0.4), S(ellipse(-15, -2.1, 1, 2.1), "#F7F0DC"), D(smooth([[-14.6, -2.1], [-15.2, -3.3], [-15.6, -2.1], [-15, -1.2]], false, 1), tone(CREAM, "deep"), 0.12, 0.8),
    S(rect(-1.1, -4.35, 2.2, 4.5), g.c), F(rect(0.5, -4.35, 0.6, 4.5), tone(g.c, "shade"), 0.5), P([[0, -2.2], [-2.8, -4.2], [-3.5, -2.2], [-2.7, -0.4]], g.c), P([[0, -2.2], [2.8, -4.2], [3.5, -2.2], [2.7, -0.4]], tone(g.c, "shade")), S(ellipse(0, -2.2, 0.7), tone(g.c, "deep")),
  ] },
  timetable: { w: 10, h: 22, c: "#1F6FA8", pp: 14, e: 0.3, dx: 3.5, grip: [0, -5], d: g => {
    const sh = [...slab(-5, -22, 10, 22, PAPER, 0.5, 0.06), F(rrect(-5, -22, 10, 5.6, [0.5, 0.5, 0, 0]), g.c), ...g.say(g.t.title || "TARİFE", -4.2, -21.6, 8.4, 2.3, { b: true, s: 1.9, k: WHITE }), F(poly([[-3.4, -17.6], [3.4, -17.6], [2.6, -16.8], [-2.6, -16.8]]), WHITE), F(rect(-1.8, -18.6, 3.6, 1.1), WHITE), F(rect(-0.4, -19.3, 0.8, 0.8), "#F2C230"), D(seg([-3.6, -16.3, 3.6, -16.3]), WHITE, 0.15, 0.5), F(rect(-5, -1.2, 10, 1.2), g.c)];
    if (g.t.lines && g.on) return [...sh, ...g.say(g.t.lines, -4, -15.2, 8, 13.4, { s: 0.9 })];
    for (let i = 0; i < 10; i++) { const y = -15.4 + i * 1.35; sh.push(...(i % 2 ? [] : [F(rect(-4.4, y - 0.15, 8.8, 1.2), g.c, 0.1)]), F(rrect(-3.6, y + 0.2, 2.8, 0.5, 0.25), INK, 0.6), F(rrect(0.8, y + 0.2, 2.8, 0.5, 0.25), INK, 0.6), D(seg([-0.4, y + 0.45, 0.2, y + 0.45]), INK, 0.12, 0.6)); }
    return sh;
  } },
  guidebook: { w: 12.5, h: 19, c: "#1F7A8C", pp: 14, e: 0.3, dx: 4, grip: [0, -5], d: g => {
    const o = rrect(-6.25, -19, 12.5, 19, 0.4), win = rrect(-5, -14, 10.6, 9.6, 0.3);
    return [S(o, g.c), ...lit(o, g.c, -6.25, 6.25, -19, 0, 0.14), F(rect(-6.25, -19, 0.9, 19), tone(g.c, "deep"), 0.7, o), ...g.say(g.t.title, -5, -18.4, 10.4, 3.2, { b: true, s: 2.4, k: WHITE }),
      F(win, "#BFD9E8"), F(ellipse(3.2, -11.6, 1.2), "#FFF1C2", 1, win), ...skyline(0, -6.6, 0.5, tone(g.c, "deep"), win), F(rect(-5, -6.4, 10.6, 2.2), "#4F8FBF", 1, win), D(seg([-4, -5.4, -2, -5.4], [0, -4.8, 2.5, -4.8]), WHITE, 0.12, 0.6), bars(-5, -3.3, 9, 2, 1, WHITE, 0.3, 0.8)];
  } },
  cookbook: { w: 20, h: 26, c: "#D9732E", pp: 10, e: 0.35, dx: 6, grip: [0, -6], d: g => {
    const o = rrect(-10, -26, 20, 26, 0.6), bowl = smooth([[-4.4, -13.6, 0], [4.4, -13.6, 0], [3.5, -10], [0, -9], [-3.5, -10]]);
    return [S(o, g.c), ...lit(o, g.c, -10, 10, -26, 0, 0.1), F(rect(-10, -26, 1.2, 26), tone(g.c, "deep"), 0.6, o), ...g.say(g.t.title, -8.4, -24.8, 16.8, 4.6, { b: true, s: 3.4, k: CREAM }),
      S(ellipse(0, -12.5, 7.4), CREAM), D(ellipse(0, -12.5, 5.8), g.c, 0.2, 0.5), S(bowl, "#C8283A"), F(ellipse(0, -13.6, 4.4, 0.9), "#E8892E"), F(ellipse(-1.2, -13.8, 1.2, 0.3), "#F2C230", 0.8), R([[1, -14.5], [0.2, -16], [1.2, -17.4], [0.5, -18.6]], WHITE, 0.3, { opacity: 0.8 }), R([[-1.6, -14.8], [-2.2, -16.2], [-1.4, -17.2]], WHITE, 0.25, { opacity: 0.7 }),
      tiled(rect(-10, -4, 20, 4), { w: 2, h: 2, shapes: [F(rect(0, 0, 1, 1), WHITE), F(rect(1, 1, 1, 1), WHITE)] }, 0.85)];
  } },
  comic: { w: 17, h: 26, c: "#C8283A", pp: 11, e: 0.3, dx: 5, grip: [0, -6], d: g => {
    const o = rect(-8.5, -26, 17, 26);
    return [...slab(-8.5, -26, 17, 26, "#F2C230", 0.3, 0.07), { ...D(seg(...Array.from({ length: 14 }, (_, i) => { const a = i * Math.PI / 7; return [0, -13, Math.sin(a) * 20, -13 - Math.cos(a) * 20]; })), "#EE8A2E", 0.9, 0.55), clip: o },
      S(star(0, -13, 12, 8.2, 6.2), g.c), S(star(0, -13, 12, 5.6, 4.2, 0.26), "#EE8A2E"), F(poly([[-1, -17], [2.6, -17], [0.8, -13.4], [3.6, -13.4], [-1.8, -8.4], [-0.3, -12.4], [-2.6, -12.4]]), WHITE, 0.95),
      F(rect(-8.5, -26, 17, 5), g.c, 1, o), ...g.say(g.t.title, -7.6, -25.7, 15.2, 4.4, { b: true, s: 3.2, k: WHITE }), S(ellipse(6.4, -19, 1.6), WHITE), F(ellipse(6.4, -19, 0.9), g.c), ...[-6.2, -2.1, 2.1].map(x => D(rect(x, -5, 3.8, 3.6), INK, 0.2, 0.7))];
  } },
};

props.print = gen("print", PRINT, { title: "", lines: "" },
  "Things with print: a newspaper folded in half (masthead), magazine, poster, café menu, tri-fold brochure, folded city map, hand-drawn sketch map, handwritten letter with its envelope, utility bill, till receipt, certificate with a seal, rolled diploma with a ribbon, ferry timetable card, travel guidebook, cookbook and comic.",
  { title: { type: "text", about: "the title or masthead (defaults: newspaper GAZETE, menu MENÜ, bill FATURA, certificate SERTİFİKA, timetable TARİFE; the covers show a strip until given a title); a letter's greeting, a receipt's shop" }, lines: { type: "text", about: "the body: lines separated by newlines (menu dishes, bill rows, receipt items, timetable times, a letter's text); strips stand for them when empty" } },
  ["a1-w-gazete", "a1-w-dergi", "a2-w-afis", "a2-w-menu", "a1-w-harita", "a1-w-kroki", "a1-w-mektup", "b1-w-fatura", "b1-w-sertifika", "a1-w-mezuniyet", "b1-w-tarife", "a2-w-yemek-kitabi", "a1-w-hesap"], ["print", "paper", "reading"]);

// ---- pass ------------------------------------------------------------------------------------------------

/** The chip of a card at (x, y). */
const chip = (x: number, y: number, w = 1.3): Shape[] => [S(rrect(x, y, w, w * 0.78, 0.2), GOLD), D(seg([x + w * 0.35, y, x + w * 0.35, y + w * 0.78], [x + w * 0.7, y, x + w * 0.7, y + w * 0.78], [x, y + w * 0.39, x + w, y + w * 0.39]), tone(GOLD, "deep"), 0.07, 0.7)];
/** A QR-like code of 7 × 7 cells in the box at (x, y), `s` wide. */
const qr = (x: number, y: number, s: number, c = INK): Shape => {
  const p = new Path(), u = s / 7;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (((i < 3 && j < 3) || (i > 3 && j < 3) || (i < 3 && j > 3)) ? !(i % 4 === 1 && j % 4 === 1) : (i * 3 + j * 5 + i * j) % 4 < 2) p.add(rect(x + i * u, y + j * u, u, u));
  return F(p, c, 0.9);
};
/** Vertical barcode strips from x to x + w, y0 to y1. */
const barcode = (x: number, y0: number, y1: number, w: number, c = INK): Shape => D(seg(...Array.from({ length: Math.round(w / 0.3) }, (_, i) => [x + i * 0.3 + (i % 3) * 0.03, y0, x + i * 0.3 + (i % 3) * 0.03, y1])), c, 0.13, 0.8);
/** A card 8.6 × 5.4: its slab, then `f(o)`; the name in `say` at the card's name box. */
const card = (c: string, f: (o: Path) => Shape[]): Shape[] => { const o = rrect(-4.3, -5.4, 8.6, 5.4, 0.5); return [S(o, c), ...lit(o, c, -4.3, 4.3, -5.4, 0, 0.1), ...f(o)]; };
const arcs = (x: number, y: number, c: string): Shape => D(seg(...[0.5, 0.9, 1.3].map(r => [x + r * 0.5, y - r * 0.6, x + r * 0.5, y + r * 0.6])), c, 0.12, 0.85);

const PASS: Record<string, Kind> = {
  id_card: { w: 8.6, h: 5.4, c: "#CFE0EC", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(rect(-4.3, -5.4, 8.6, 0.95), tone(g.c, "deep"), 0.75, o), F(rrect(-3.95, -5.2, 0.8, 0.55, 0.05), "#D9332B"), F(ellipse(-3.55, -4.92, 0.14), WHITE), F(rrect(-2.7, -5.05, 4.6, 0.28, 0.14), WHITE, 0.9),
    ...photo(-3.9, -4.2, 2.5, 3.1), ...g.say(g.t.name, -1, -4.3, 4.9, 0.9, { a: "left", b: true, s: 0.7 }), bars(-1, -3.1, 3.4, 4, 0.45, INK, 0.18, 0.6), ...chip(2.9, -1.6, 1.1), F(ellipse(-3.4, -0.6, 0.5), "#8E7CC3", 0.5)]) },
  residence_permit: { w: 8.6, h: 5.4, c: "#DCD3E8", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(rect(-4.3, -5.4, 8.6, 0.95), "#6B4F9E", 0.9, o), F(rrect(-3.7, -5.1, 4.8, 0.3, 0.15), WHITE, 0.9), F(rrect(2.6, -5.1, 1.2, 0.3, 0.15), "#F2C230", 0.9), ...photo(1.7, -4.2, 2.4, 3.1, "#8E86A8"),
    ...g.say(g.t.name, -3.9, -4.3, 5.2, 0.9, { a: "left", b: true, s: 0.7 }), bars(-3.9, -3.1, 4.9, 4, 0.45, INK, 0.18, 0.6), F(ellipse(-3, -0.8, 0.75), "#9B8BD0", 0.65), F(ellipse(-3, -0.8, 0.4), "#E8C4F0", 0.8), ...chip(0.9, -1.5, 1.1)]) },
  istanbulkart: { w: 8.6, h: 5.4, c: "#1F4E9E", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(smooth([[-4.3, -2.4, 0], [-1.5, -3.3], [1.5, -1.8], [4.3, -2.9, 0], [4.3, 0, 0], [-4.3, 0, 0]]), "#D9332B", 1, o), D(smooth([[-4.3, -2.7], [-1.5, -3.6], [1.5, -2.1], [4.3, -3.2]], false, 1), WHITE, 0.2, 0.9),
    F(ellipse(-2.9, -4.1, 0.6), WHITE), F(ellipse(-2.65, -4.1, 0.5), g.c), F(rrect(-1.9, -4.35, 3.2, 0.55, 0.27), WHITE, 0.9), ...chip(-3.7, -2.3, 1.2), arcs(2.2, -3.9, WHITE)]) },
  credit_card: { w: 8.6, h: 5.4, c: "#2E3A59", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(poly([[-1, -5.4], [2.4, -5.4], [-1.8, 0], [-5.2, 0]]), WHITE, 0.07, o), ...chip(-3.6, -3.9, 1.3), arcs(-1.6, -3.4, WHITE), ...[0, 1, 2, 3].map(i => F(rrect(-3.6 + i * 1.95, -2.3, 1.5, 0.4, 0.2), WHITE, 0.85)),
    ...g.say(g.t.name, -3.6, -1.6, 4.4, 0.7, { a: "left", k: WHITE, s: 0.5 }), F(ellipse(2.6, -1, 0.7), "#D9332B", 0.9), F(ellipse(3.3, -1, 0.7), "#F2A33A", 0.85)]) },
  bank_card: { w: 8.6, h: 5.4, c: "#2F8C88", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(ellipse(3, 0.5, 4.5, 3.4), tone(g.c, "light"), 0.35, o), F(ellipse(-3, -6, 4.5, 3), tone(g.c, "deep"), 0.4, o), F(poly([[-3.9, -4.4], [-3.2, -5], [-2.5, -4.4]]), WHITE), ...[0, 1, 2].map(i => F(rect(-3.8 + i * 0.5, -4.3, 0.28, 0.7), WHITE)), F(rect(-3.9, -3.55, 1.7, 0.2), WHITE), F(rrect(-1.8, -4.8, 1.8, 0.35, 0.17), WHITE, 0.8),
    ...chip(-3.7, -3.1, 1.2), ...[0, 1, 2, 3].map(i => F(rrect(-3.6 + i * 1.95, -1.7, 1.5, 0.38, 0.19), WHITE, 0.85)), ...g.say(g.t.name, -3.6, -1.1, 4.4, 0.7, { a: "left", k: WHITE, s: 0.5 }), F(ellipse(3, -0.95, 0.55), WHITE, 0.85), F(ellipse(3, -0.95, 0.3), g.c)]) },
  student_card: { w: 8.6, h: 5.4, c: "#2F6DB5", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(PAPER, o => [
    F(rect(-4.3, -5.4, 8.6, 1.25), g.c, 1, o), F(ellipse(-3.5, -4.78, 0.45), WHITE), F(rect(-3.7, -4.9, 0.4, 0.3), g.c), F(rrect(-2.6, -5.1, 4.2, 0.3, 0.15), WHITE, 0.9), F(rrect(-2.6, -4.6, 2.6, 0.22, 0.11), WHITE, 0.7), ...photo(-3.9, -3.7, 2.4, 2.8),
    ...g.say(g.t.name, -1.2, -3.7, 5, 0.9, { a: "left", b: true, s: 0.7 }), bars(-1.2, -2.6, 3.6, 3, 0.45, INK, 0.18, 0.6), barcode(-1.2, -1.4, -0.5, 3.8)]) },
  museum_pass: { w: 8.6, h: 5.4, c: "#8E1B2D", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(rrect(-3.4, -5, 6.8, 0.32, 0.16), GOLD, 0.85), F(star(0, -3.1, 8, 1.8, 1.2), GOLD, 0.9), F(ellipse(0, -3.1, 0.8), g.c), D(ellipse(0, -3.1, 2.0), GOLD, 0.15, 0.8), D(ellipse(0, -3.1, 1.05), GOLD, 0.1, 0.8),
    ...[-1, 1].flatMap(a => [-1, 1].map(b => F(ellipse(a * 3.6, -3.1 + b * 1.6, 0.28), GOLD, 0.85))), ...g.say(g.t.name, -3.4, -0.95, 6.8, 0.6, { k: GOLD, b: true, s: 0.5 })]) },
  library_card: { w: 8.6, h: 5.4, c: "#6F7A45", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(CREAM, o => [
    F(rect(-4.3, -5.4, 8.6, 1.1), g.c, 1, o), F(rrect(-1.9, -5.1, 3.8, 0.3, 0.15), WHITE, 0.9), F(poly([[-3.9, -4.1], [-2.8, -3.8], [-1.7, -4.1], [-1.7, -2.9], [-2.8, -3.2], [-3.9, -2.9]]), g.c), D(seg([-2.8, -3.8, -2.8, -3.2]), CREAM, 0.1, 0.9),
    ...g.say(g.t.name, -1.2, -3.9, 5.1, 0.9, { a: "left", b: true, s: 0.7 }), bars(-1.2, -2.8, 3.8, 3, 0.45, INK, 0.18, 0.6), barcode(-3.8, -1.5, -0.5, 7.4)]) },
  licence: { w: 8.6, h: 5.4, c: "#E8B4C8", pp: 16, e: 0.15, dx: 3.2, grip: [0, -1], d: g => card(g.c, o => [
    F(rect(-4.3, -5.4, 8.6, 0.95), tone(g.c, "deep"), 0.8, o), F(rrect(-3.95, -5.2, 0.8, 0.55, 0.05), "#D9332B"), F(ellipse(-3.55, -4.92, 0.14), WHITE), F(rrect(-2.7, -5.05, 4.6, 0.28, 0.14), WHITE, 0.9), ...photo(-3.9, -4.2, 2.3, 2.9, "#8E959C"),
    ...g.say(g.t.name, -1.3, -4.3, 5.2, 0.8, { a: "left", b: true, s: 0.65 }), ...[0, 1, 2, 3].flatMap(i => [F(ellipse(-1.1, -3.2 + i * 0.5, 0.14), INK, 0.6), F(rrect(-0.8, -3.35 + i * 0.5, 2.4 + (i % 2) * 0.9, 0.3, 0.15), INK, 0.5)]),
    ...[0, 1, 2, 3, 4, 5].map(i => F(rrect(-3.9 + i * 0.7, -1.4, 0.55, 0.55, 0.12), i % 2 ? "#3F74C4" : "#F2C230", 0.9)), F(ellipse(3.2, -1.1, 0.6), "#9B8BD0", 0.55)]) },
  boarding_pass: { w: 20, h: 8.5, c: "#C8283A", pp: 11, e: 0.2, dx: 6, grip: [0, -1.4], d: g => {
    const o = rrect(-10, -8.5, 20, 8.5, 0.5);
    return [S(o, PAPER), ...lit(o, PAPER, -10, 10, -8.5, 0, 0.05), F(rect(-10, -8.5, 20, 2.2), g.c, 1, o), F(rect(5.6, -6.3, 4.4, 6.3), tone(g.c, "light"), 0.18, o), F(ellipse(-8, -7.4, 1.4, 0.26), WHITE), F(poly([[-8.4, -7.2], [-7.5, -7.2], [-8.3, -6]]), WHITE), F(poly([[-8.4, -7.6], [-7.5, -7.6], [-8.3, -8.4]]), WHITE), F(poly([[-9.3, -7.4], [-9.7, -8.1], [-8.9, -7.4]]), WHITE),
      F(rrect(-5.6, -7.7, 6, 0.55, 0.27), WHITE, 0.9), F(rrect(-5.6, -7, 3.6, 0.35, 0.17), WHITE, 0.7), F(rrect(-9, -5.5, 4, 1.1, 0.3), INK, 0.8), D(seg([-4, -4.95, -1.6, -4.95], [-2.2, -5.5, -1.6, -4.95, -2.2, -4.4]), INK, 0.2, 0.8), F(rrect(-0.8, -5.5, 4, 1.1, 0.3), INK, 0.8),
      ...g.say(g.t.name, -9, -3.9, 10.6, 1.2, { a: "left", b: true, s: 1 }), bars(-9, -2.3, 8, 2, 0.8, INK, 0.25, 0.55), D(seg([5.6, -8.4, 5.6, -0.1]), INK, 0.1, 0.5, [0.3, 0.3]), qr(6.5, -5.4, 3.2), bars(6.5, -1.6, 3.2, 1, 0.5, INK, 0.25, 0.6)];
  } },
};

props.pass = gen("pass", PASS, { name: "" },
  "Cards that open doors: a national ID card (kimlik), residence permit (ikamet), Istanbulkart (blue and red), credit card, bank card, student card, museum pass, library card, driving licence (ehliyet) and a paper boarding pass; a faceless photo where there is one, a name on the card.",
  { name: { type: "text", about: "the holder's name on the card (strips stand for it when empty)" } },
  ["b1-w-kimlik-karti", "a1-w-kredi-karti", "a2-w-banka-karti", "a2-w-muze-karti", "a2-w-ehliyet", "b1-w-ucus", "a1-w-jeton"], ["card", "pass", "id"], "how many, overlapping a little so each shows");

// ---- money -----------------------------------------------------------------------------------------------

const NOTE: [string, string][] = [["5", "#A5683F"], ["10", "#C8433A"], ["20", "#4E8F5A"], ["50", "#E08A3A"], ["100", "#3F6FB5"], ["200", "#9B5C9A"]];
const EURO = ["#9AA39A", "#D9534A", "#4F80C8", "#E8892E", "#5E9A55", "#E0B83A"];
const vi = (v: string) => Math.max(0, NOTE.findIndex(n => n[0] === v.trim()));
/** A faceless portrait in an oval at (x, y). */
const portrait = (x: number, y: number, rx: number, ry: number, c: string): Shape[] => { const o = ellipse(x, y, rx, ry); return [F(o, tone(c, "light"), 0.95), F(ellipse(x, y - ry * 0.28, rx * 0.4, ry * 0.34), tone(c, "deep"), 0.9), F(ellipse(x, y + ry * 0.85, rx * 0.8, ry * 0.5), tone(c, "deep"), 0.9, o)]; };
/** A Turkish lira note lying face up, centred, value `v`. */
const lira = (g: G, v: string): Shape[] => {
  const i = vi(v), c = NOTE[i][1], w = 13 + i * 0.6, h = i ? 6.8 : 6.4, o = rrect(-w / 2, -h, w, h, 0.3), px = w / 2 - 3.3;
  return [S(o, c), ...lit(o, c, -w / 2, w / 2, -h, 0, 0.1), D(rrect(-w / 2 + 0.4, -h + 0.4, w - 0.8, h - 0.8, 0.2), WHITE, 0.12, 0.55), D(ellipse(px, -h / 2, 2.6, 3), WHITE, 0.1, 0.5), ...portrait(px, -h / 2, 1.9, 2.5, c), F(rect(px - 4.2, -h, 0.3, h), STEEL, 0.7),
    ...g.say(NOTE[i][0], -w / 2 + 0.7, -h + 0.8, 5.2, h - 1.6, { b: true, s: 4, k: WHITE, a: "left" }), bars(-w / 2 + 0.7, -1.7, 5, 2, 0.6, WHITE, 0.2, 0.7), bars(px - 3.6, -h + 1.1, 2.6, 2, 0.7, WHITE, 0.2, 0.6)];
};
/** A note standing upright (portrait), `L` long, in colour `c`, its numeral on top. */
const noteUp = (g: G, i: number, L: number, c: string, words: boolean): Shape[] => {
  const o = rrect(-3.4, -L, 6.8, L, 0.3);
  return [S(o, c), ...lit(o, c, -3.4, 3.4, -L, 0, 0.12), D(rrect(-3, -L + 0.4, 6, L - 0.8, 0.2), WHITE, 0.12, 0.55), ...portrait(0, -L * 0.52, 2.3, 3, c), ...(words ? g.say(NOTE[i][0], -2.8, -L + 0.8, 5.6, 2.2, { b: true, s: 2, k: WHITE }) : [F(rrect(-2, -L + 1.2, 4, 1.2, 0.5), WHITE, 0.8)])];
};
const EDIM = [[12, 6.2], [12.7, 6.7], [13.3, 7.2], [14, 7.7], [14.7, 8.2], [15.3, 8.7]];
/** Pound (polymer, a clear window and a foil strip, a faceless portrait) and franc notes (colour by value, a wave of lines round a disc), stylised and never traced, by value index `i`. */
const GBP = ["#4FB3B8", "#E88B3A", "#7B4F9E", "#C8433A", "#C8433A", "#C8433A"], CHF = ["#F2C230", "#F2C230", "#D9433A", "#5BAA6A", "#4F86C6", "#A5683F"], GBP_DIM = [[12.5, 6.5], [13.2, 6.9], [13.9, 7.3], [14.6, 7.7]];
const noteOther = (g: G, i: number, chf: boolean): Shape[] => {
  const [w, h] = chf ? [12.3, 7] : GBP_DIM[Math.min(i, 3)], c = (chf ? CHF : GBP)[i], o = rrect(-w / 2, -h, w, h, 0.3), px = w / 2 - 3.2, n = NOTE[i][0];
  const sh = [S(o, c), ...lit(o, c, -w / 2, w / 2, -h, 0, 0.1), D(rrect(-w / 2 + 0.4, -h + 0.4, w - 0.8, h - 0.8, 0.2), WHITE, 0.14, 0.6)];
  if (chf) sh.push(F(ellipse(px - 0.4, -h / 2, 2.7), tone(c, "light"), 0.85), D(ellipse(px - 0.4, -h / 2, 2.1), WHITE, 0.14, 0.7), D(ellipse(px - 0.4, -h / 2, 1.4), WHITE, 0.12, 0.7), F(ellipse(px - 0.4, -h / 2, 0.7), WHITE, 0.8), ...[0, 1, 2].map(k => D(smooth([[-w / 2 + 0.6, -1.2 - k * 0.7], [-1.2, -1.9 - k * 0.7], [0.6, -1.2 - k * 0.7]], false, 1), WHITE, 0.14, 0.6)), F(rrect(w / 2 - 1.5, -h + 0.7, 0.9, 1.6, 0.3), "#E8F2F4", 0.85));
  else sh.push(F(ellipse(px, -h / 2, 2.4, 2.9), tone(c, "light"), 0.9), ...portrait(px, -h / 2, 1.9, 2.5, c), F(rect(px - 3.5, -h, 0.8, h), "#D9B25A", 0.85), F(rrect(px - 2.5, -h + 0.7, 1, 1.9, 0.4), "#E8F2F4", 0.85), F(rect(-w / 2 + 0.7, -0.9, 5.6, 0.4), WHITE, 0.6));
  return [...sh, ...g.say(n, -w / 2 + 0.7, -h + 0.8, 4.6, 2.8, { b: true, s: 3, k: WHITE, a: "left" }), ...g.say(chf ? "Fr." : "£", -w / 2 + 0.7, -h + 3.6, 2.2, 1.6, { b: true, s: 1.5, k: WHITE, a: "left" })];
};

const MONEY: Record<string, Kind> = {
  notes: { w: 16, h: 6.8, c: "#C8283A", pp: 12, e: 0.25, dx: 4, grip: [0, -1.4], d: g => lira(g, g.t.value) },
  wad: { w: 9, h: 8, c: "#C8283A", pp: 14, e: 0.25, grip: [0, -3], d: g => {
    const i = vi(g.t.value), c = NOTE[i][1], sh = [[-0.14, 2], [0.12, 1], [-0.06, 3]].flatMap(([a, k]) => T([S(rrect(-3.4, -7.4, 6.8, 7.4, 0.3), NOTE[(i + k) % 6][1])], rotate(a)));
    return [...sh, ...slab(-3.5, -7, 7, 7, c, 0.3, 0.1), F(rect(-0.15, -7, 0.3, 7), tone(c, "deep"), 0.5), ...portrait(1.9, -3.5, 1, 1.5, c), ...g.say(NOTE[i][0], -3.1, -6.6, 2.8, 1.5, { b: true, s: 1.3, k: WHITE, a: "left" }), S(rect(-3.7, -4.6, 7.4, 1.9), CREAM), F(rect(-3.7, -3.95, 7.4, 0.5), g.c)];
  } },
  fan: { w: 24, h: 17, n: 5, all: true, pp: 12, e: 0.25, grip: [0, -1.4], d: g => {
    const i0 = vi(g.t.value), n = g.n, step = Math.min(0.34, 1 / Math.ceil((n - 1) / 2) || 0.34), sh: Shape[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const i = (i0 + k) % 6, L = 13 + i * 0.6, a = k ? (k % 2 ? -1 : 1) * Math.ceil(k / 2) * step : 0;
      sh.push(...T(noteUp(g, i, L, NOTE[i][1], !k), mul(translate(0, -1.4), mul(rotate(a), translate(0, 1.4)))));
    }
    return sh;
  } },
  ceyrek: { w: 4, h: 15, c: "#C8283A", pp: 16, e: 0.2, dx: 5, grip: [0, -14], d: g => [
    P([[-1.7, -14, 0], [1.7, -14, 0], [1.7, 0, 0], [0, -2.4], [-1.7, 0, 0]], g.c), F(rect(-1.7, -14, 0.55, 14), tone(g.c, "light"), 0.4), F(rect(1.1, -14, 0.6, 14), tone(g.c, "shade"), 0.45), D(seg([-1.7, -11.9, 1.7, -11.9]), tone(g.c, "deep"), 0.1, 0.5),
    R([[-0.5, -12.8], [0.5, -11.1]], STEEL, 0.12), S(ellipse(0, -11, 0.92), GOLD), D(ellipse(0, -11, 0.72), tone(GOLD, "deep"), 0.06, 0.7), F(ellipse(-0.07, -11, 0.4), tone(GOLD, "deep"), 0.7), F(ellipse(0.08, -11, 0.33), GOLD), F(star(0.3, -11, 5, 0.14, 0.06), tone(GOLD, "deep"), 0.9), crescent(0, -11, 0.92, GOLD), F(ellipse(-0.35, -11.4, 0.27, 0.14), WHITE, 0.45),
  ] },
  foreign: { w: 16, h: 8.7, c: "#4F80C8", pp: 12, e: 0.25, dx: 4, grip: [0, -1.4], d: g => {
    if (g.t.currency === "pound" || g.t.currency === "franc") return noteOther(g, vi(g.t.value), g.t.currency === "franc");
    const i = vi(g.t.value), usd = g.t.currency === "dollar", [w, h] = usd ? [15.6, 6.6] : EDIM[i], c = usd ? "#8FB08A" : EURO[i], o = rrect(-w / 2, -h, w, h, 0.3), px = usd ? 0 : w / 2 - 3.4;
    const sh = [S(o, c), ...lit(o, c, -w / 2, w / 2, -h, 0, 0.1), D(rrect(-w / 2 + 0.4, -h + 0.4, w - 0.8, h - 0.8, 0.2), usd ? tone(c, "deep") : WHITE, 0.14, 0.6)];
    if (usd) sh.push(D(ellipse(0, -h / 2, 3, 2.7), tone(c, "deep"), 0.12, 0.6), ...portrait(0, -h / 2, 2.2, 2.4, "#E6EBD6"), F(ellipse(-w / 2 + 2.6, -h / 2, 1.1), "#4C7A55", 0.8), F(ellipse(w / 2 - 2.6, -h / 2, 1.1), "#2E5237", 0.8), ...g.say(NOTE[i][0], -w / 2 + 0.7, -h + 0.6, 2.6, 1.8, { b: true, s: 1.6, k: "#1F3F2A", a: "left" }), ...g.say(NOTE[i][0], w / 2 - 3.3, -2.4, 2.6, 1.8, { b: true, s: 1.6, k: "#1F3F2A", a: "right" }), ...g.say("$", -w / 2 + 3.4, -h + 0.6, 1.2, 1.8, { b: true, s: 1.4, k: "#1F3F2A" }));
    else sh.push(F(rrect(px - 1.9, -h + 1.2, 3.8, h - 2.2, [1.9, 1.9, 0, 0]), tone(c, "light"), 0.85), D(seg([px - 1.9, -2.8, px + 1.9, -2.8]), tone(c, "deep"), 0.12, 0.7), D(smooth([[px - 1.9, -2.8], [px - 1, -3.6], [px, -2.8], [px + 1, -3.6], [px + 1.9, -2.8]], false, 1), tone(c, "deep"), 0.1, 0.7), ...Array.from({ length: 12 }, (_, k) => F(ellipse(-w / 2 + 2.4 + Math.sin(k * Math.PI / 6) * 1.1, -h + 1.9 - Math.cos(k * Math.PI / 6) * 1.1, 0.14), WHITE, 0.85)), ...g.say(NOTE[i][0], -w / 2 + 0.7, -h + 3.2, 4.4, 2.8, { b: true, s: 3, k: WHITE, a: "left" }), ...g.say("€", -w / 2 + 4.1, -h + 0.7, 1.6, 1.6, { b: true, s: 1.5, k: WHITE }), bars(-w / 2 + 3, -1.8, 4.8, 2, 0.5, WHITE, 0.2, 0.7));
    return sh;
  } },
};

props.money = gen("money", MONEY, { value: "20", currency: "euro" },
  "Money: Turkish lira banknotes (5, 10, 20, 50, 100 or 200, each in its colour with a faceless portrait), a folded wad with a paper band, a fan of notes held in the hand, a çeyrek altın gold coin on a red ribbon, and foreign (euro, dollar, pound or franc) notes.",
  { color: { type: "color", default: "#C8283A", about: "the wad's paper band or the çeyrek's ribbon (a palette id or a hex); notes keep the colour of their value" }, n: { type: "int", min: 1, max: 24, about: "how many (fan: the notes in the hand, default 5; notes overlap a little)" }, value: { type: "enum", values: ["5", "10", "20", "50", "100", "200"], default: "20", about: "the note's value (notes, wad, fan: the first; foreign)" }, currency: { type: "enum", values: ["euro", "dollar", "pound", "franc"], default: "euro", about: "foreign: euro, dollar, pound or franc notes" } },
  ["a1-w-para", "a2-w-banknot", "a1-w-lira", "a2-w-ceyrek-altin", "a2-w-doviz", "a1-w-nakit"], ["money", "cash", "lira"], "how many (fan: the notes in the hand, default 5; notes: overlapping a little)");

// ---- ticket ----------------------------------------------------------------------------------------------

/** The shading of a disc's lower right (a painted crescent) for a coin, a token. */
const crescent = (x: number, y: number, r: number, c: string): Shape => ({ path: holed(ellipse(x, y, r * 1.6), [ellipse(x - r * 0.22, y - r * 0.22, r * 1.02)]), fill: tone(c, "shade"), evenodd: true, flat: true, opacity: 0.55, clip: ellipse(x, y, r) });
/** A ticket w × h with two notches at x = sx and a dashed tear line between them. */
const stubTicket = (w: number, h: number, c: string, sx: number): Shape[] => [{ path: holed(rrect(-w / 2, -h, w, h, 0.4), [ellipse(sx, -h, 0.55), ellipse(sx, 0, 0.55)]), fill: c, evenodd: true }, D(seg([sx, -h + 0.8, sx, -0.8]), WHITE, 0.1, 0.7, [0.3, 0.25])];
/** `n` small squares in a row from (x, y), `s` wide: sprocket holes, seats. */
const dots = (x: number, y: number, n: number, s: number, gap: number, c: string, op = 0.7): Shape => { const p = new Path(); for (let i = 0; i < n; i++) p.add(rect(x + i * (s + gap), y, s, s)); return F(p, c, op); };

const TICKET: Record<string, Kind> = {
  token: { w: 2.5, h: 2.5, c: "#E8892E", pp: 16, e: 0.1, dx: 2.1, hx: 1, grip: [0, -1.25], d: g => [
    S(ellipse(0, -1.25, 1.25), g.c), D(ellipse(0, -1.25, 0.98), tone(g.c, "deep"), 0.1, 0.8), F(ellipse(0, -1.25, 0.62), tone(g.c, "light"), 0.9), F(ellipse(0, -1.25, 0.28), tone(g.c, "deep"), 0.7), crescent(0, -1.25, 1.25, g.c), F(ellipse(-0.5, -1.85, 0.32, 0.17), WHITE, 0.5),
  ] },
  bus: { w: 6.2, h: 13, c: "#2F8C88", pp: 14, e: 0.2, dx: 2.4, grip: [0, -2], d: g => [
    ...slab(-3.1, -13, 6.2, 13, PAP, 0.2, 0.08), F(rect(-3.1, -13, 6.2, 3.2), g.c), F(rrect(-2.2, -12.3, 4.4, 1.5, 0.3), WHITE), ...[-1.4, 0, 1.4].map(x => F(rect(x - 0.4, -12.1, 0.8, 0.6), g.c)), F(ellipse(-1.2, -10.7, 0.35), g.c), F(ellipse(1.2, -10.7, 0.35), g.c),
    ...g.say(g.t.text, -2.7, -9.4, 5.4, 2.4, { b: true, s: 0.9, n: 2 }), D(seg([-3.1, -6, 3.1, -6]), INK, 0.1, 0.5, [0.3, 0.25]), qr(-1.7, -5.3, 3.4), bars(-2.6, -1.6, 5.2, 1, 0.5, INK, 0.25, 0.55),
  ] },
  cinema: { w: 14, h: 6.2, c: "#7A3E6E", pp: 14, e: 0.2, dx: 4, grip: [0, -1.2], d: g => [
    ...stubTicket(14, 6.2, g.c, 3.6), F(rect(-7, -1.5, 10.2, 1), DARK, 0.45), dots(-6.6, -1.3, 14, 0.4, 0.3, WHITE), ...g.say(g.t.text, -6.4, -5.5, 9.6, 2.2, { b: true, s: 1.6, k: WHITE, a: "left" }), bars(-6.4, -3, 7, 2, 0.9, WHITE, 0.25, 0.75),
    F(ellipse(5.3, -3.6, 1.5), WHITE, 0.92), ...[0, 1, 2, 3, 4].map(i => F(ellipse(5.3 + Math.sin(i * 1.2566) * 0.85, -3.6 - Math.cos(i * 1.2566) * 0.85, 0.28), g.c)), F(ellipse(5.3, -3.6, 0.2), g.c), bars(4.4, -1.6, 1.9, 1, 0.5, WHITE, 0.2, 0.7),
  ] },
  concert: { w: 16, h: 6.6, c: "#1F3F8F", pp: 13, e: 0.2, dx: 4.5, grip: [0, -1.2], d: g => [
    ...stubTicket(16, 6.6, g.c, 4), F(star(-4.8, -3.3, 10, 2.9, 1.8), "#F2C230", 0.95), F(ellipse(-5.3, -2.5, 0.75, 0.55), g.c), F(rect(-4.7, -4.6, 0.22, 2.1), g.c), F(poly([[-4.5, -4.6], [-3.6, -4.2], [-4.5, -3.7]]), g.c),
    ...g.say(g.t.text, -1.4, -5.6, 5.6, 2.2, { b: true, s: 1.7, k: WHITE, a: "left" }), bars(-1.4, -3, 5.6, 2, 0.9, WHITE, 0.25, 0.8), qr(4.5, -5, 3.1, WHITE), bars(4.5, -1.4, 3.1, 1, 0.5, WHITE, 0.2, 0.7),
  ] },
  lottery: { w: 8.5, h: 15, c: "#C8283A", pp: 14, e: 0.25, dx: 3.5, grip: [0, -2.5], d: g => {
    const o = rrect(-4.25, -15, 8.5, 15, 0.4), sc = rrect(-3.6, -5.1, 7.2, 3.3, 0.4);
    return [S(o, g.c), ...lit(o, g.c, -4.25, 4.25, -15, 0, 0.1), tiled(rect(-4.25, -15, 8.5, 15), { w: 3, h: 3, shapes: [F(ellipse(1.5, 1.5, 0.5), GOLD), F(ellipse(0, 0, 0.3), GOLD)] }, 0.35, o), F(star(0, -12.3, 12, 2.6, 2), "#F2C230"), S(ellipse(0, -12.3, 1.4), GOLD), D(ellipse(0, -12.3, 1), tone(GOLD, "deep"), 0.1, 0.8),
      F(rrect(-3.6, -9, 7.2, 2.9, 0.4), PAPER), ...g.say(g.t.text, -3.4, -8.8, 6.8, 2.5, { b: true, s: 2 }), S(sc, "#B8BEC4"), F(ellipse(0.4, -3.5, 1.9, 0.95), "#F2C230"), D(seg([-2.8, -4.7, 0, -2.2], [-1.6, -4.7, 1.4, -2.2], [0.2, -4.7, 3, -2.4], [-3, -3.2, -1, -2]), WHITE, 0.2, 0.7), bars(-3.4, -1.2, 6.8, 1, 0.5, WHITE, 0.25, 0.8)];
  } },
  ferry: { w: 3.2, h: 3, c: "#2F6DB5", pp: 16, e: 0.1, dx: 2.7, hx: 1.2, grip: [0, -1.5], d: g => [
    S(ellipse(0, -1.5, 1.5), g.c), D(ellipse(0, -1.5, 1.22), WHITE, 0.1, 0.7, [0.14, 0.1]), crescent(0, -1.5, 1.5, g.c), F(poly([[-0.8, -1.2], [0.8, -1.2], [0.5, -0.78], [-0.5, -0.78]]), WHITE), F(rect(-0.4, -1.65, 0.8, 0.45), WHITE), F(rect(-0.1, -2.05, 0.2, 0.4), "#F2C230"), D(seg([-0.9, -0.5, 0.9, -0.5]), WHITE, 0.08, 0.7),
  ] },
  museum: { w: 7, h: 14.5, c: "#B5651D", pp: 14, e: 0.2, dx: 2.8, grip: [0, -2.5], d: g => [
    ...slab(-3.5, -14.5, 7, 14.5, PAP, 0.2, 0.08), F(rect(-3.5, -14.5, 7, 4.8), g.c), F(poly([[-2.5, -13.4], [0, -14.2], [2.5, -13.4]]), WHITE), F(rect(-2.5, -13.1, 5, 0.35), WHITE), ...[-1.9, -0.65, 0.6, 1.85].map(x => F(rect(x - 0.25, -12.6, 0.5, 2.1), WHITE)), F(rect(-2.7, -10.4, 5.4, 0.4), WHITE),
    ...g.say(g.t.text, -3, -9, 6, 2.6, { b: true, s: 1, n: 2 }), D(seg([-3.5, -5.6, 3.5, -5.6]), INK, 0.1, 0.5, [0.3, 0.25]), qr(-1.8, -4.9, 3.6), bars(-3, -1.1, 6, 1, 0.5, INK, 0.25, 0.55),
  ] },
};

props.ticket = gen("ticket", TICKET, { text: "" },
  "Tickets: a plastic transport token (jeton), a bus ticket, a cinema ticket with its stub, a concert ticket, a lottery ticket (piyango) with a scratch panel, a ferry token and a museum ticket; a line of words on the paper ones.",
  { text: { type: "text", about: "the line on the ticket: the film, the band, the route, the number, the museum (strips stand for it when empty)" } },
  ["a1-w-bilet", "a1-w-jeton", "a2-w-piyango", "a1-w-sinema", "a1-w-konser", "a1-w-muze"], ["ticket", "transport", "event"], "how many, overlapping a little so each shows");

// ---- pack ------------------------------------------------------------------------------------------------

const PACK: Record<string, Kind> = {
  backpack: { w: 36, h: 44, c: "#C4553A", pp: 6, e: 0.4, grip: [0, -43.6], d: g => {
    const o = rrect(-14.5, -40, 29, 40, [10, 10, 4, 4]), pk = rrect(-10.5, -23, 21, 17, [6, 6, 3, 3]), pc = tone(g.c, "light");
    return [R([[-3.4, -39], [-3.4, -43.6], [3.4, -43.6], [3.4, -39]], DARK, 1.3), S(rrect(-17.4, -17, 5, 13, 2), tone(g.c, "shade")), S(rrect(12.4, -17, 5, 13, 2), tone(g.c, "shade")), S(o, g.c), ...lit(o, g.c, -14.5, 14.5, -40, 0, 0.14), F(rect(-14.5, -3.4, 29, 3.4), tone(g.c, "deep"), 0.5, o),
      D(smooth([[-10, -35], [0, -36.4], [10, -35]], false, 1), tone(g.c, "deep"), 0.4, 0.9, [0.6, 0.35]), F(ellipse(8.6, -35.2, 0.7), DARK), F(rrect(-3, -31, 6, 2.8, 0.7), WHITE, 0.85), S(pk, pc), ...lit(pk, pc, -10.5, 10.5, -23, -6, 0.14), D(seg([-9, -20.4, 9, -20.4]), tone(g.c, "deep"), 0.4, 0.9, [0.6, 0.35]), F(ellipse(8.6, -20.4, 0.7), DARK), S(rrect(-1.3, -16, 2.6, 5.6, 0.6), DARK)];
  } },
  school_bag: { w: 33, h: 37, c: "#2F5FA8", pp: 6, e: 0.4, grip: [0, -36.5], d: g => {
    const o = rrect(-14, -31, 28, 31, 4), flap = smooth([[-14.6, -33, 0], [14.6, -33, 0], [14.6, -15], [8, -10.6], [-8, -10.6], [-14.6, -15]]), fc = tone(g.c, "light");
    return [R([[-4, -31], [-4, -36.5], [4, -36.5], [4, -31]], DARK, 1.4), S(rrect(-16.6, -15, 3.6, 10, 1.6), tone(g.c, "shade")), S(rrect(13, -15, 3.6, 10, 1.6), tone(g.c, "shade")), S(o, g.c), ...lit(o, g.c, -14, 14, -31, 0, 0.14), F(rect(-14, -4.8, 28, 1.2), "#E8D83A", 0.85, o),
      S(rrect(-10, -16, 20, 11, 2.5), tone(g.c, "shade")), S(flap, fc), ...lit(flap, fc, -14.6, 14.6, -33, -10.6, 0.14), D(smooth([[-13.2, -32], [13.2, -32], [13.2, -15.4], [7.6, -11.8], [-7.6, -11.8], [-13.2, -15.4]]), tone(fc, "light"), 0.25, 0.8, [0.7, 0.4]), F(rrect(-3.5, -28, 7, 3.4, 0.8), WHITE, 0.85),
      ...[-7.2, 7.2].flatMap(x => [S(rect(x - 1.1, -14, 2.2, 6), DARK), S(rrect(x - 1.6, -11.2, 3.2, 2.4, 0.5), GOLD)])];
  } },
  briefcase: { w: 42, h: 35, c: "#6B4A35", pp: 5, e: 0.4, grip: [0, -34], d: g => {
    const o = rrect(-21, -30, 42, 30, 3), hc = tone(g.c, "deep");
    return [R([[-5.4, -30], [-5.4, -34], [5.4, -34], [5.4, -30]], hc, 1.8), S(o, g.c), ...lit(o, g.c, -21, 21, -30, 0, 0.12), F(rect(-21, -16, 42, 0.6), hc, 0.5, o), D(rrect(-19.4, -28.4, 38.8, 26.8, 2), tone(g.c, "light"), 0.25, 0.8, [0.8, 0.5]),
      ...[-12, 6].map(x => S(rrect(x, -18.5, 6, 4.6, 1), GOLD)), S(rrect(-2.6, -19, 5.2, 4, 0.8), GOLD), F(rect(-0.25, -17.8, 0.5, 1.6), tone(GOLD, "deep")), S(rrect(-21.4, -27, 1.8, 3.2, 0.6), GOLD), S(rrect(19.6, -27, 1.8, 3.2, 0.6), GOLD)];
  } },
  laptop_bag: { w: 42, h: 36, c: "#3A3D45", pp: 5, e: 0.4, grip: [0, -35], d: g => {
    const o = rrect(-20, -28, 40, 28, 3), flap = smooth([[-20, -28, 0], [20, -28, 0], [20, -15], [0, -10.5], [-20, -15]]), fc = tone(g.c, "light");
    return [R([[-11, -28], [-11, -35], [-3.5, -35], [-3.5, -28]], DARK, 1.6), R([[3.5, -28], [3.5, -35], [11, -35], [11, -28]], DARK, 1.6), S(o, g.c), ...lit(o, g.c, -20, 20, -28, 0, 0.12), S(rrect(-15, -9, 30, 7, 1.5), tone(g.c, "shade")), D(seg([-13, -5.5, 13, -5.5]), fc, 0.3, 0.8, [0.6, 0.4]),
      S(flap, fc), ...lit(flap, fc, -20, 20, -28, -10.5, 0.14), D(smooth([[-18.6, -27], [18.6, -27], [18.6, -15.5], [0, -11.8], [-18.6, -15.5]]), tone(fc, "light"), 0.25, 0.8, [0.7, 0.4]), S(rect(-1.4, -21, 2.8, 9.4), DARK), S(rrect(-2.6, -14.4, 5.2, 3.6, 0.8), STEEL), F(ellipse(0, -12.6, 0.5), DARK), F(rrect(-17, -26, 6, 2.4, 0.6), WHITE, 0.8)];
  } },
  pencil_case: { w: 21, h: 7.2, c: "#E0A83A", pp: 12, e: 0.25, grip: [0, -3.4], d: g => {
    const o = rrect(-10.5, -6.6, 21, 6.6, [3.3, 3.3, 2.2, 2.2]);
    return [S(o, g.c), ...lit(o, g.c, -10.5, 10.5, -6.6, 0, 0.12), D(seg([-8.8, -5.3, 8.6, -5.3]), tone(g.c, "deep"), 0.3, 0.9, [0.3, 0.22]), F(rect(-10.5, -6.6, 21, 0.8), tone(g.c, "light"), 0.5, o), S(rrect(8.2, -6.4, 1.7, 1.9, 0.6), DARK), S(rrect(8.6, -5.0, 0.7, 2.2, 0.35), STEEL), F(ellipse(-4.6, -2.7, 1.5), WHITE, 0.9), F(ellipse(-4.6, -2.7, 0.8), g.c), F(star(0.4, -2.8, 5, 1.1, 0.5), WHITE, 0.85), F(star(4.2, -2.4, 5, 0.8, 0.35), WHITE, 0.7)];
  } },
  lunchbox: { w: 19, h: 14, c: "#2F8C88", pp: 12, e: 0.3, grip: [0, -13.6], d: g => {
    const lid = tone(g.c, "light");
    return [R([[-4.5, -10.2], [-4.5, -13.6], [4.5, -13.6], [4.5, -10.2]], DARK, 1.3), S(rrect(-9, -6.2, 18, 6.2, [0.6, 0.6, 2.2, 2.2]), g.c), ...lit(rrect(-9, -6.2, 18, 6.2, 1), g.c, -9, 9, -6.2, 0, 0.14), S(rrect(-9.5, -10.4, 19, 4.6, [2.2, 2.2, 0.6, 0.6]), lid), F(rect(-9.5, -7.2, 19, 1.4), tone(lid, "shade"), 0.4),
      ...[-6.6, 4].map(x => S(rrect(x, -8.6, 2.6, 4, 0.7), DARK)), F(rrect(-7.8, -4.4, 5.6, 2.6, 0.5), WHITE, 0.85), D(seg([-7, -3.6, -3.2, -3.6], [-7, -2.8, -4.6, -2.8]), tone(lid, "deep"), 0.2, 0.7), F(star(4.8, -3.1, 5, 1.5, 0.7), "#F2C230"), F(ellipse(-5, -9.4, 1.4, 0.4), WHITE, 0.4)];
  } },
  net_bag: { w: 28, h: 36, c: "#C79A63", pp: 7, e: 0.3, grip: [0, -35.5], d: g => {
    const out = smooth([[-13.2, -4.5], [-12.5, -13], [-7, -21], [-1.6, -25.8], [1.6, -25.8], [7, -21], [12.5, -13], [13.2, -4.5], [8, 0.2], [0, 0.6], [-8, 0.2]]);
    return [...([[-8.4, -4.4], [0, -4.6], [8.4, -4.4], [-4.2, -12], [4.2, -12], [0, -19.4]] as Vec2[]).flatMap(([x, y], i) => [S(ellipse(x, y, 4.4, 4.2), i % 2 ? "#F08A2B" : "#EE8A2E"), crescent(x, y, 4.3, "#EE8A2E"), F(ellipse(x - 1.5, y - 1.6, 1.1, 0.7), WHITE, 0.45), F(ellipse(x + 0.2, y - 3.9, 0.45, 0.25), "#5E9A55")]),
      tiled(out, { w: 3, h: 3, shapes: [F(poly([[0, 0.12], [0.12, 0], [3, 2.88], [2.88, 3]]), g.c), F(poly([[3, 0.12], [2.88, 0], [0, 2.88], [0.12, 3]]), g.c)] }, 0.85), D(out, g.c, 0.5, 0.9), R([[-1.8, -25], [-5.5, -31], [-1, -35.4], [0, -35.5]], g.c, 0.8), R([[1.8, -25], [5.5, -31], [1, -35.4], [0, -35.5]], g.c, 0.8)];
  } },
  sports_bag: { w: 54, h: 30, c: "#C8283A", pp: 5, e: 0.4, grip: [0, -29.5], d: g => {
    const o = rrect(-24, -22, 48, 22, 10);
    return [R([[-7.5, -21], [-6.5, -29.5], [6.5, -29.5], [7.5, -21]], DARK, 2.2), S(o, g.c), ...lit(o, g.c, -24, 24, -22, 0, 0.12), F(rect(-24, -13, 48, 3.2), WHITE, 0.9, o), S(rrect(-26, -19, 6, 16, 3), tone(g.c, "shade")), S(rrect(20, -19, 6, 16, 3), tone(g.c, "shade")), S(rrect(14, -16, 8.4, 11, 2), tone(g.c, "light")), D(seg([15.4, -13, 21, -13]), tone(g.c, "deep"), 0.3, 0.9, [0.4, 0.3]),
      D(smooth([[-19, -20.6], [0, -21.9], [19, -20.6]], false, 1), tone(g.c, "deep"), 0.4, 0.9, [0.6, 0.35]), F(ellipse(-4, -7.5, 2.2), WHITE, 0.9), F(ellipse(-4, -7.5, 1.2), g.c)];
  } },
  makeup_bag: { w: 19, h: 16.4, c: "#E58FA0", pp: 14, e: 0.3, grip: [0, -8.4], d: g => {
    const o = smooth([[-8.5, -9, 0], [8.5, -9, 0], [9, -1.5], [7, 0, 0], [-7, 0, 0], [-9, -1.5]]);
    return [S(rrect(-3.6, -13.2, 1.8, 4.4, 0.35), GOLD), S(rrect(-3.6, -15.8, 1.8, 2.9, 0.4), "#C8283A"), R([[3, -9], [3.8, -14]], DARK, 0.5), S(ellipse(3.9, -14.6, 0.7, 1.4), "#E8C4A8"),
      S(o, g.c), ...lit(o, g.c, -9, 9, -9, 0, 0.14), D(seg([-7.6, -7.6, 7.4, -7.6]), tone(g.c, "deep"), 0.3, 0.9, [0.3, 0.22]), S(rrect(6.6, -9, 1.5, 1.9, 0.5), DARK), F(star(-2.2, -3.6, 5, 1.7, 0.8), WHITE, 0.85), F(star(3.2, -3.2, 5, 1.1, 0.5), WHITE, 0.7), F(ellipse(-4.6, -5.8, 0.45), WHITE, 0.6)];
  } },
};

props.pack = gen("pack", PACK, {},
  "Bags to carry: a backpack, school bag with a flap, briefcase, laptop bag, pencil case, lunchbox, string market bag with oranges, sports duffel and makeup bag; held, they hang from the hand by their handles.",
  {}, ["a1-w-canta"], ["bag", "carry", "school"], "how many side by side; held, they hang in a bunch");
