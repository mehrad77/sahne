// Props of the health family (STYLE.md): medicine, care and toiletries. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { smooth, ellipse, rect, rrect, poly, tone, mul, rotate, translate, scale, groupBounds, type Affine, type ParamSpec, type PieceDef, type PieceOut, type Shape, type Path, type TextSpec, type Vec2, type Rng } from "sahne";
import { S, P, L, num, str, hex, holed, type Pt } from "./draw.ts";

type Rec = Record<string, unknown>;
const PAPER = "#F6F2E8", STEEL = "#B8BEC4", DARK = "#2E2F35", RUBBER = "#2A2B30", RED = "#D9534A";

// ---- helpers -----------------------------------------------------------------------------------------

/** A count param, 1…24. */
const cnt = (v: unknown) => Math.max(1, Math.min(24, Math.round(num(v, 1))));
/** A words param: a string, a number or a list, else `d`. */
const say = (v: unknown, d: string) => typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : Array.isArray(v) ? v.join(" ").trim() : d;
/** Shapes moved by an affine (their clips too). */
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Turned by `a` about (x, y). */
const rt = (sh: Shape[], a: number, x = 0, y = 0) => T(sh, mul(translate(x, y), mul(rotate(a), translate(-x, -y))));
/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a tube, a strap, a wire. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Light from the upper left on an outline spanning x0…x1, y0…y1: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.2): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** A words box over the art. */
const W = (text: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec => ({ text, x, y, w, h, font: "print", ...o });
/** A carton w × h standing at the origin, seen a little from the right: its side and top going back `d`, then its front. */
const cart = (w: number, h: number, d: number, c: string, rad = 0.4): Shape[] => {
  const x0 = -w / 2, x1 = w / 2, k = d * 0.55;
  return [S(poly([[x1 - 0.1, -h], [x1 + d, -h - k], [x1 + d, -k], [x1 - 0.1, 0]]), tone(c, "shade")), S(poly([[x0, -h + 0.1], [x0 + d, -h - k], [x1 + d, -h - k], [x1, -h + 0.1]]), tone(c, "light")), S(rrect(x0, -h, w, h, rad), c)];
};
/** A plus sign centred at (x, y), `r` from the middle to an arm's end. */
const plus = (x: number, y: number, r: number): Path => { const t = r / 3; return poly([[x - t, y - r], [x + t, y - r], [x + t, y - t], [x + r, y - t], [x + r, y + t], [x + t, y + t], [x + t, y + r], [x - t, y + r], [x - t, y + t], [x - r, y + t], [x - r, y - t], [x - t, y - t]]); };
/** Shapes scaled by `f` about the origin, their lines too. */
const sz = (sh: Shape[], f: number): Shape[] => T(sh, scale(f)).map(s => s.stroke ? { ...s, stroke: { ...s.stroke, width: s.stroke.width * f, ...(s.stroke.dash ? { dash: s.stroke.dash.map(d => d * f) } : {}) } } : s);
/** A capsule lying at (x, y), `l` long, in two colours, turned by `a`. */
const caps = (x: number, y: number, l: number, h: number, c1: string, c2: string, a = 0): Shape[] => rt([S(rrect(x - l / 2, y - h / 2, l / 2 + 0.1, h, [h / 2, 0, 0, h / 2]), c1), S(rrect(x - 0.1, y - h / 2, l / 2 + 0.1, h, [0, h / 2, h / 2, 0]), c2), F(rect(x - l / 2 + 0.4, y - h / 2 + 0.2, l - 0.8, h * 0.18), "#FFFFFF", 0.4)], a, x, y);
/** A tube standing on its cap, w × h: a sealed crimp at the top, a printed band at `band`. */
function tube(w: number, h: number, c: string, cap: string, band: string, at = 0.5): Shape[] {
  const bw = w / 2, ch = h * 0.15, o = smooth([[-bw * 0.6, -ch, 0], [bw * 0.6, -ch, 0], [bw, -ch - h * 0.1], [bw, -h + 1.3, 0], [-bw, -h + 1.3, 0], [-bw, -ch - h * 0.1]], true, 1);
  const crimp = rect(-bw, -h, w, 1.4), sh: Shape[] = [S(crimp, tone(c, "shade")), S(o, c), ...lit(o, c, -bw, bw, -h, -ch), F(rect(-bw, -h * at - h * 0.07, w, h * 0.14), band, 1, o), S(rrect(-bw * 0.62, -ch, bw * 1.24, ch, 0.35), cap)];
  for (let i = 0; i < 4; i++) sh.push(F(rect(-bw + 0.25 + i * (w - 0.5) / 3.5, -h + 0.15, 0.2, 1.1), tone(c, "deep"), 0.5));
  for (let i = 0; i < 3; i++) sh.push(F(rect(-bw * 0.5 + i * bw * 0.5, -ch + 0.3, 0.18, ch - 0.6), tone(cap, "shade"), 0.6));
  return sh;
}

/** One kind of a generator: one thing drawn at the origin (`sh`), its pitch in a row, the words on it, and how it is held. */
interface Kind {
  w: number;
  sh(i: number): Shape[];
  tx?: TextSpec[];
  ppcm: number;
  edge?: number;
  /** Most it is drawn in one go; how many to a row; how far a row behind stands up (default a quarter of its height). */
  max?: number; per?: number; up?: number;
  /** Held: how far down the art moves (negative lifts it) so the fist, about 7 cm above the grip and 2 below, keeps a third of it; or a function that turns and sizes it for a hand. */
  hold?: number | ((s: Shape[]) => Shape[]);
}
interface A { r: Rng; held: boolean; c(d: string): string; say(k: "label" | "sub", d?: string): string }

/** A prop of one flat: `n` of the kind side by side (back rows stand higher), held a few in a hand; a drop shadow unless held. */
function make(id: string, k: Kind, p: Rec): PieceOut {
  const held = !!p.held, n = Math.min(cnt(p.n), held ? 3 : k.max ?? 24), per = held ? 3 : k.per ?? 6, rows = Math.ceil(n / per), cols = Math.ceil(n / rows);
  const items = Array.from({ length: n }, (_, i) => k.sh(i)), [, t0, , t1] = groupBounds({ shapes: items[0], edge: k.edge ?? 0.25 }), up = k.up ?? Math.max(2, Math.min(12, (t1 - t0) * 0.28));
  let sh: Shape[] = [], tx: TextSpec[] = [];
  for (let j = rows - 1; j >= 0; j--) {
    const m = Math.min(cols, n - j * cols);
    for (let q = 0; q < m; q++) {
      const x = (q - (m - 1) / 2) * k.w + (j % 2 ? k.w / 4 : j ? -k.w / 4 : 0), y = -j * up;
      sh.push(...mv(items[j * cols + q], x, y));
      for (const t of k.tx ?? []) if (t.text) tx.push({ ...t, x: t.x + x, y: t.y + y });
    }
  }
  const hd = held ? k.hold ?? 0 : 0;
  if (typeof hd === "function") { sh = hd(sh); tx = []; } else if (hd) { sh = mv(sh, 0, hd); tx = tx.map(t => ({ ...t, y: t.y + hd })); }
  const group = { shapes: sh, edge: k.edge ?? 0.25 }, [x0, y0, x1, y1] = groupBounds(group);
  return { flats: [{ group, ppcm: Math.min(16, k.ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...(tx.length ? { text: tx } : {}) }] };
}

const N = { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (back rows stand higher; big things are drawn at most a few)" } as const;
const COLOR = { type: "color", about: "its main colour (a palette id or a hex): a box's body, a jar, a bag, the cuff, a frame, the soap; the default is each kind's own" } as const;
const LABEL = { type: "text", about: "the words on it" } as const;
const SUB = { type: "text", about: "a second, smaller line" } as const;

/** A generator over a table of kinds: the first is the default, each has a variant of its own name. */
function gen(id: string, kinds: Record<string, (a: A) => Kind>, about: string, terms: string[], tags: string[], params: Record<string, ParamSpec> = {}): PieceDef {
  const names = Object.keys(kinds);
  return {
    draw(p, r) {
      const f = kinds[str(p.kind, names[0])] ?? kinds[names[0]];
      return make(id, f({ r, held: !!p.held, c: d => hex(p.color, d), say: (key, d = "") => say(p[key], d) }), p);
    },
    variants: Object.fromEntries(names.map(k => [k, { kind: k }])),
    meta: { about, params: { kind: { type: "enum", values: names, default: names[0] }, n: N, color: COLOR, label: LABEL, sub: SUB, ...params }, terms, tags },
  };
}

// ---- medicine ----------------------------------------------------------------------------------------

/** A medicine box 7.4 × 11.6 cm: its name on a white band, an `icon` on a disc, a strength line at the foot. */
function drugBox(a: A, c0: string, lab: string, sub: string, icon: (c: string) => Shape[]): Kind {
  const c = a.c(c0), w = 7.4, h = 11.6, x0 = -w / 2, front = rrect(x0, -h, w, h, 0.4);
  const sh = [...cart(w, h, 2.8, c), ...lit(front, c, x0, w / 2, -h, 0), F(rrect(x0 + 0.5, -h + 1.1, w - 1, 4, 0.3), PAPER), F(rect(x0, -1.9, w, 0.4), tone(c, "deep"), 0.6), F(ellipse(0, -4.6, 1.9), PAPER), ...icon(c).map(s => ({ ...s, path: s.path.move(0, -4.6) }))];
  return { w: w + 4, ppcm: 10, edge: 0.25, hold: -3, sh: () => sh, tx: [W(a.say("label", lab), x0 + 0.7, -h + 1.3, w - 1.4, 3.6, { size: 1.1, weight: 700 }), W(a.say("sub", sub), x0 + 0.5, -1.8, w - 1, 1.3, { color: PAPER, size: 0.8 })] };
}
const tablet = (c: string): Shape[] => [F(ellipse(0, 0, 1.3), c), F(rect(-1.3, -0.1, 2.6, 0.2), PAPER, 0.9)];

const MEDICINE: Record<string, (a: A) => Kind> = {
  pills: a => {
    const c = a.c("#3FA7A3"), body = "#E6EAEE", tp = (u: number, v: number): Vec2 => [-8.5 + u * 17 + v * 1.4, -2.6 - v * 4.2];
    const sh: Shape[] = [S(poly([[8.5, -2.6], [9.9, -6.8], [9.9, -4.2], [8.5, 0]]), tone(body, "shade")), S(poly([tp(0, 0), tp(1, 0), tp(1, 1), tp(0, 1)]), tone(body, "light")), S(rrect(-8.5, -2.6, 17, 2.6, 0.4), body), F(rect(-8.5, -0.5, 17, 0.5), tone(body, "shade"), 0.6)];
    for (let i = 0; i < 7; i++) {
      const u0 = i / 7 + 0.014, u1 = (i + 1) / 7 - 0.014, q = poly([tp(u0, 0.14), tp(u1, 0.14), tp(u1, 0.86), tp(u0, 0.86)]);
      if (i === 2 || i === 5) { const [x, y] = tp((u0 + u1) / 2, 0.5); sh.push(S(q, tone(body, "deep")), F(ellipse(x - 0.3, y, 0.55, 0.4), RED), F(ellipse(x + 0.4, y - 0.2, 0.5, 0.38), "#F2C230")); } else sh.push(S(q, c), F(poly([tp(u0, 0.14), tp(u1, 0.14), tp(u1, 0.26), tp(u0, 0.26)]), tone(c, "light"), 0.6));
    }
    const loose = [...caps(12.2, -0.6, 3.4, 1.2, RED, PAPER, -0.12), S(rrect(14.8, -1.1, 1.9, 1.1, 0.5), PAPER), F(rect(15.2, -0.7, 1.1, 0.14), STEEL, 0.9)];
    return { w: a.held ? 20 : 24, ppcm: 10, edge: 0.2, hold: -4.5, sh: () => a.held ? mv(sh, -0.7, 0) : mv([...sh, ...loose], -3.5, 0) };
  },
  blister: a => {
    const foil = a.c("#CDD2D7"), o = rrect(-3.6, -11.6, 7.2, 11.6, 0.6), pc = ["#F2C230", PAPER, "#E58FA0", "#F2C230", PAPER, "#E58FA0", RED, "#F2C230"], sh: Shape[] = [S(o, foil), ...lit(o, foil, -3.6, 3.6, -11.6, 0, 0.18), F(rect(-3.6, -6, 7.2, 0.15), tone(foil, "deep"), 0.6)];
    for (let j = 0; j < 5; j++) for (const [i, x] of [-1.8, 1.8].entries()) {
      const y = -1.9 - j * 2.1, gone = j === 0 && i === 1 || j === 1 && i === 0 && !!a.r.chance(0.6), b = rrect(x - 1.3, y - 0.85, 2.6, 1.7, 0.85);
      sh.push(gone ? S(b, tone(foil, "deep"), { flat: true, opacity: 0.8 }) : S(b, "#E4EEF1", { opacity: 0.92 }), ...(gone ? [] : [F(ellipse(x, y, 0.95, 0.55), pc[(j * 2 + i) % pc.length]), F(ellipse(x - 0.5, y - 0.45, 0.35, 0.15), "#FFFFFF", 0.7)]));
    }
    return { w: 8.4, ppcm: 12, edge: 0.2, hold: -3, sh: () => sh };
  },
  syrup: a => {
    const c = a.c("#B9672B"), lab = a.say("label", "ŞURUP"), bt = smooth([[-3.1, 0, 0], [3.1, 0, 0], [3.1, -9.6], [1.9, -11.4], [1.7, -12.6, 0], [-1.7, -12.6, 0], [-1.9, -11.4], [-3.1, -9.6]], true, 1), cup = poly([[-1.7, 0], [1.7, 0], [2.1, -3.6], [-2.1, -3.6]]);
    const sh = [S(bt, c), ...lit(bt, c, -3.1, 3.1, -12.6, 0, 0.22), F(rrect(-3.1, -8.8, 6.2, 5.6, 0.3), PAPER), F(rect(-3.1, -8.8, 6.2, 0.9), "#D9534A"), F(rect(-2.4, -11.2, 0.5, 7), "#FFFFFF", 0.3, bt), S(rrect(-2, -14.4, 4, 2.6, 0.5), PAPER), F(rect(-1.5, -14.1, 0.2, 2), STEEL, 0.5), F(rect(0, -14.1, 0.2, 2), STEEL, 0.5), F(rect(1.4, -14.1, 0.2, 2), STEEL, 0.5)];
    const cp: Shape[] = [S(cup, "#DCEEF3", { opacity: 0.95 }), F(poly([[-1.45, -1.2], [1.45, -1.2], [1.8, -2.5], [-1.8, -2.5]]), "#E58FA0", 0.9, cup)];
    for (const y of [-1, -2, -3]) cp.push(F(rect(0.6, y, 1.2, 0.12), "#5E7C86", 0.8));
    const dx = a.held ? 0 : -2.2;
    return { w: a.held ? 8 : 12, ppcm: 10, edge: 0.2, hold: -2, sh: () => a.held ? sh : [...mv(sh, dx, 0), ...mv(cp, 4.4, 0)], tx: [W(lab, dx - 2.9, -8.6, 5.8, 3.4, { size: 1, weight: 700 })] };
  },
  painkiller: a => drugBox(a, "#D9534A", "AĞRI KESİCİ", "500 mg", c => [...tablet(c), F(poly([[1.5, -1.6], [0.5, -0.1], [1.2, -0.1], [0.4, 1.4], [2, -0.4], [1.3, -0.4]]), "#F2C230", 1)]),
  fever_reducer: a => drugBox(a, "#3F74C4", "ATEŞ DÜŞÜRÜCÜ", "250 mg", c => [F(rrect(-0.3, -1.5, 0.6, 2.2, 0.3), c), F(ellipse(0, 1, 0.55), "#D9534A"), F(rect(0.3, -1.1, 0.5, 0.12), c), F(rect(0.3, -0.5, 0.5, 0.12), c), F(rect(0.3, 0.1, 0.5, 0.12), c)]),
  prescription: a => {
    const lab = a.say("label", "REÇETE"), hw = a.say("sub"), g = a.c("#3E8E6A"), o = poly([[-4.6, -13.6], [4.6, -13.6], [4.6, -2.2], [2.4, 0], [-4.6, 0]]), sh = [S(o, PAPER), ...lit(o, PAPER, -4.6, 4.6, -13.6, 0, 0.14), F(rect(-4.6, -13.6, 9.2, 2.6), g, 1, o), S(poly([[4.6, -2.2], [4.6, 0], [2.4, 0]]), tone(PAPER, "shade")), F(ellipse(-3.2, -12.3, 0.9), PAPER), F(plus(-3.2, -12.3, 0.6), g)];
    for (let i = 0; i < 3; i++) sh.push(F(rect(-3.8, -10 + i * 1.5, 7.6 - (i === 2 ? 2.6 : 0), 0.12), "#9AA0A6", 0.8));
    for (let i = 0; i < 14; i++) sh.push(F(rect(0.6 + i * 0.28 + (i % 3) * 0.04, -4.2, 0.12 + (i % 3) * 0.06, 1.6), DARK, 0.7));
    sh.push({ path: ellipse(-2.2, -3.6, 1.3), stroke: { color: "#B33A3A", width: 0.25 }, flat: true, opacity: 0.7 }, L([[-3, -3.5], [-2.4, -4.2], [-2, -3.2], [-1.4, -3.9]], "#B33A3A", 0.2, 0.7));
    if (!hw) for (const [i, y] of [-8.6, -7.1].entries()) sh.push(L([[-3.7, y], [-2.6, y - 0.5], [-1.6, y + 0.3], [-0.5, y - 0.4], [0.6, y + 0.2], [i ? 1.4 : 3.2, y - 0.2]], "#25358C", 0.22, 0.85));
    return { w: 11, ppcm: 12, edge: 0.15, hold: -2, sh: () => sh, tx: [W(lab, -2.4, -13.4, 6.4, 2.2, { color: PAPER, size: 1.2, weight: 700 }), ...(hw ? [W(hw, -3.9, -9.6, 7.8, 3.6, { font: "hand" as const, color: "#25358C", size: 1.1, align: "left" as const })] : [])] };
  },
  insert: a => {
    const lab = a.say("label", "PROSPEKTÜS"), o = rect(-4.5, -13, 9, 13), hc = a.c("#4F9FD6"), sh: Shape[] = [S(o, PAPER), F(rect(-1.5, -13, 3, 13), "#000000", 0.05, o), F(rect(1.5, -13, 3, 13), tone(PAPER, "shade"), 0.5, o), F(rect(-4.5, -13, 9, 3), hc, 1, o), F(rect(-4.5, -6.6, 9, 0.18), tone(PAPER, "deep"), 0.7), F(rect(-1.5, -10, 0.15, 10), tone(PAPER, "deep"), 0.6), F(rect(1.5, -10, 0.15, 10), tone(PAPER, "deep"), 0.6)];
    for (let r = 0; r < 3; r++) for (let j = 0; j < 7; j++) if (j !== 3 || r !== 1) sh.push(F(rect(-4 + r * 3, -9.3 + j * 1.2 + (j > 3 ? 0.4 : 0), 2.4 - (j % 3) * 0.4, 0.14), "#7A8086", 0.6));
    sh.push(S(poly([[4.5, -13], [4.5, -11.4], [2.9, -13]]), tone(PAPER, "shade")), F(ellipse(-3.2, -11.5, 0.9), PAPER), F(plus(-3.2, -11.5, 0.6), hc));
    return { w: 10, ppcm: 11, edge: 0.15, hold: -2.5, sh: () => sh, tx: [W(lab, -2.1, -12.8, 5, 2.3, { color: PAPER, size: 1.1, weight: 700 })] };
  },
  vitamin: a => {
    const c = a.c("#E8982E"), lab = a.say("label", "VİTAMİN"), b = smooth([[-3.7, 0, 0], [3.7, 0, 0], [3.7, -9], [3, -10.4], [-3, -10.4], [-3.7, -9]], true, 1), cp = rrect(-3.4, -13.4, 6.8, 3.2, 0.6);
    const sh = [S(b, c), ...lit(b, c, -3.7, 3.7, -10.4, 0, 0.22), F(rrect(-3.7, -8.8, 7.4, 6.2, 0.3), PAPER), F(rect(-3.7, -8.8, 7.4, 0.9), tone(c, "deep")), F(ellipse(0, -3.7, 1.1), "#F2A33A"), F(ellipse(0, -3.7, 0.7), "#FBD58A"), S(cp, PAPER), ...lit(cp, PAPER, -3.4, 3.4, -13.4, -10.2, 0.2)];
    for (let i = 0; i < 8; i++) sh.push(F(rect(-3.1 + i * 0.85, -13.2, 0.14, 2.8), tone(PAPER, "shade"), 0.7));
    const tabs = [[5.6, -0.8], [7.1, -0.8], [6.3, -2.1]].flatMap(([x, y], i) => [S(ellipse(x, y, 0.8), ["#F2C230", "#E8892E", "#F2C230"][i]), F(ellipse(x - 0.3, y - 0.3, 0.25), "#FFFFFF", 0.6)]);
    const dx = a.held ? 0 : -1.6;
    return { w: a.held ? 9 : 12, ppcm: 10, edge: 0.22, hold: -2, sh: () => a.held ? sh : mv([...sh, ...tabs], dx, 0), tx: [W(lab, dx - 3.3, -8.6, 6.8, 2.8, { size: 1.1, weight: 700 }), W(a.say("sub"), dx - 3.3, -5.9, 6.8, 1.2, { size: 0.8 })].filter(t => t.text) };
  },
  antibiotic: a => drugBox(a, "#2F8C88", "ANTİBİYOTİK", "500 mg", () => [...caps(0, 0, 3, 1.3, "#2F8C88", "#F2C230", -0.6)]),
  ointment: a => {
    const c = a.c("#F4F1E8"), lab = a.say("label", "MERHEM");
    return { w: 6, ppcm: 12, edge: 0.18, hold: -2, sh: () => [...tube(4, 13.5, c, "#3E8E6A", "#3E8E6A"), F(plus(0, -3.7, 0.95), "#3E8E6A")], tx: [W(lab, -1.9, -9.8, 3.8, 2.2, { size: 0.8, weight: 700 }), W(a.say("sub"), -1.9, -7.2, 3.8, 1.2, { size: 0.6 })].filter(t => t.text) };
  },
  drops: a => {
    const c = a.c("#B9672B"), lab = a.say("label", "DAMLA"), bt = smooth([[-2.4, 0, 0], [2.4, 0, 0], [2.4, -5.4], [1.4, -6.8], [1.2, -7.6, 0], [-1.2, -7.6, 0], [-1.4, -6.8], [-2.4, -5.4]], true, 1);
    const sh = [S(bt, c), ...lit(bt, c, -2.4, 2.4, -7.6, 0, 0.24), F(rrect(-2.4, -5, 4.8, 3.6, 0.2), PAPER), F(rect(-2.4, -5, 4.8, 0.6), "#4F9FD6"), S(rrect(-1.5, -9.2, 3, 1.8, 0.4), DARK), S(smooth([[-1.1, -9.1, 0], [1.1, -9.1, 0], [1.3, -11.6], [0.6, -13.6], [-0.6, -13.6], [-1.3, -11.6]], true, 1), RUBBER), F(ellipse(-0.5, -11.4, 0.25, 0.9), "#FFFFFF", 0.4)];
    const dp = smooth([[0, -2, 0], [0.9, -0.6], [0.8, 0.6], [0, 1.1], [-0.8, 0.6], [-0.9, -0.6]], true, 1);
    const dx = a.held ? 0 : -0.8;
    return { w: a.held ? 6 : 8, ppcm: 12, edge: 0.18, hold: -2, sh: () => a.held ? sh : [...mv(sh, dx, 0), ...mv([S(dp, "#8EC9E8", { opacity: 0.95 }), F(ellipse(-0.3, -0.2, 0.25, 0.4), "#FFFFFF", 0.7)], 3.6, -1.4)], tx: [W(lab, dx - 2.1, -4.9, 4.4, 1.8, { size: 0.8, weight: 700 })] };
  },
  inhaler: a => {
    const c = a.c("#3F74C4"), o = smooth([[-2.3, -8.2, 0], [2.3, -8.2, 0], [2.3, -4.6, 0], [5.8, -4.6, 0], [6.1, -3.6], [6.1, -0.9], [5.8, 0, 0], [-2.3, 0, 0]], true, 0.6), cn = rrect(-1.7, -11, 3.4, 3.2, 0.5);
    const sh = [S(cn, "#C9CED3"), F(rect(-1.7, -10.2, 3.4, 0.9), "#D9534A"), F(rrect(-0.9, -9.2, 1.8, 0.6, 0.2), DARK, 0.7), S(o, c), ...lit(o, c, -2.3, 6.1, -8.2, 0, 0.16), F(ellipse(6.1, -2.4, 0.5, 1.6), tone(c, "deep"), 0.9), F(rrect(-1.6, -7.2, 3.2, 2.2, 0.5), tone(c, "light"), 0.55), F(rect(-2.3, -1.4, 8, 0.2), tone(c, "deep"), 0.5)];
    return { w: 9, ppcm: 12, edge: 0.2, hold: -3, sh: () => mv(sh, -1.8, 0) };
  },
};
const medicine = gen("medicine", MEDICINE, "Medicine: a weekly pill box with loose pills, a blister pack, a syrup bottle with its measuring cup, painkiller, fever reducer and antibiotic boxes, a prescription slip, a folded package insert, a vitamin jar, an ointment tube, a dropper bottle or an inhaler.",
  ["a1-w-ilac", "a1-w-surup", "a1-w-agri-kesici", "a1-w-ates-dusurucu", "a1-w-recete", "a2-w-prospektus", "b1-w-vitamin", "b1-w-antibiyotik"], ["medicine", "pharmacy"],
  { label: { type: "text", about: "the words on it: a box's name, the prescription's header, a jar or tube's label (each kind has its Turkish word)" }, sub: { type: "text", about: "a second line: a box's strength, the prescription's handwritten line" } });

// ---- care --------------------------------------------------------------------------------------------

const CARE: Record<string, (a: A) => Kind> = {
  thermometer: a => {
    const c = a.c("#F2F4F5"), ac = "#3F9BD0", lab = a.say("label", "36,6"), o = rrect(-1.4, -14.4, 2.8, 10.2, [1.3, 1.3, 0.3, 0.3]);
    const sh = [S(smooth([[-0.55, -2.6, 0], [0.55, -2.6, 0], [0.5, -0.6], [0, 0], [-0.5, -0.6]], true, 1), STEEL), S(poly([[-1.4, -4.4], [1.4, -4.4], [0.7, -2.4], [-0.7, -2.4]]), c), S(o, c), ...lit(o, c, -1.4, 1.4, -14.4, -2, 0.25), F(rect(-1.4, -3.4, 2.8, 0.7), ac, 1, o), F(rrect(-1, -12.6, 2, 3.4, 0.3), "#B9D3BC"), F(ellipse(0, -5.8, 0.55), ac), F(ellipse(0, -5.8, 0.3), "#FFFFFF", 0.7), F(rect(-1, -7.6, 2, 0.15), tone(c, "deep"), 0.5)];
    return { w: 5, ppcm: 14, edge: 0.14, hold: -2, sh: () => sh, tx: [W(lab, -1, -12.6, 2, 3.4, { font: "screen", color: "#1F2A24", lit: 0, size: 1.2 })] };
  },
  plaster: a => {
    const c = a.c("#E8C39E"), strip = (x: number, y: number, rot: number): Shape[] => rt([S(rrect(x - 3.7, y - 1.1, 7.4, 2.2, 1.1), c), F(rrect(x - 1.5, y - 0.95, 3, 1.9, 0.3), "#F6F1E6"), ...[-3, -2.4, 2.4, 3].flatMap(dx => [F(ellipse(x + dx, y - 0.4, 0.13), tone(c, "deep"), 0.5), F(ellipse(x + dx, y + 0.4, 0.13), tone(c, "deep"), 0.5)])], rot, x, y);
    const wr = rrect(-3, -5.2, 6, 5.2, [0.5, 0.5, 1.4, 1.4]), cr = "#F1ECE0";
    const roll = [S(wr, cr), ...lit(wr, cr, -3, 3, -5.2, 0, 0.22), ...[1.3, 2.6, 3.9].map(y => F(rect(-3, -y, 6, 0.14), tone(cr, "deep"), 0.5, wr)), S(ellipse(0, -5.2, 3, 0.8), tone(cr, "light")), F(ellipse(0, -5.2, 1.6, 0.42), tone(cr, "deep"), 0.7), F(ellipse(0, -5.2, 0.7, 0.2), DARK, 0.8), S(rect(-3, -2.3, 6, 0.9), "#7FB8D8", { flat: true, opacity: 0.8, clip: wr })];
    return { w: a.held ? 4 : 18, ppcm: 14, edge: 0.15, sh: () => a.held ? strip(0, -10.4, -1.4) : [...mv(roll, -5.6, 0), ...strip(3.8, -1.1, 0.03), ...strip(4.9, -3.4, -0.1)] };
  },
  first_aid: a => {
    const c = a.c("#2F8C5E"), w = 28, h = 20, d = 9, x0 = -w / 2, k = d * 0.55, f = rrect(x0, -h, w, h, 1.6), ly = -h * 0.76;
    const sh = [R([[-5, -h - 0.8], [-4.4, -h - k - 2.4], [4.4, -h - k - 2.4], [5, -h - 0.8]], DARK, 1.1), ...cart(w, h, d, c, 1.6), ...lit(f, c, x0, w / 2, -h, 0, 0.14), F(rect(x0, ly, w, 0.35), tone(c, "deep"), 0.8, f), F(rect(x0, ly + 0.35, w, 0.5), tone(c, "light"), 0.4, f), S(plus(0, -7.6, 5.8), PAPER)];
    for (const x of [-9, 6]) sh.push(S(rrect(x, ly - 1.4, 3, 3, 0.6), STEEL), F(rect(x + 0.5, ly - 0.2, 2, 0.4), tone(STEEL, "deep"), 0.6));
    return { w: w + 14, ppcm: 6, edge: 0.3, max: 6, per: 3, hold: 26.5, sh: () => sh };
  },
  mask: a => {
    const c = a.c("#8EC5E3"), o = rrect(-8.6, -9.6, 17.2, 9.6, [3, 3, 3.6, 3.6]), sh: Shape[] = [];
    for (const d of [-1, 1]) sh.push(R([[d * 8.2, -8.6], [d * 12.4, -6.2], [d * 12.6, -3.6], [d * 8.2, -1]], "#CBD5DA", 0.3));
    sh.push(S(o, c), F(rect(-9, -9.6, 18, 3.2), tone(c, "light"), 0.7, o), F(rect(-9, -3.2, 18, 3.4), tone(c, "shade"), 0.65, o), F(rect(-9, -6.5, 18, 0.14), tone(c, "deep"), 0.6, o), F(rect(-9, -3.3, 18, 0.14), tone(c, "deep"), 0.6, o), F(rect(-9, -9.6, 18, 0.5), PAPER, 1, o), F(rect(-9, -0.5, 18, 0.5), PAPER, 1, o), F(rrect(-4.5, -9.1, 9, 0.35, 0.17), "#D3DADE"), ...lit(o, c, -8.6, 8.6, -9.6, 0, 0.12));
    return { w: 21, ppcm: 10, edge: 0.22, hold: 8, sh: () => sh };
  },
  crutch: a => {
    const c = a.c("#C7CCD1"), sh: Shape[] = [S(rrect(-0.9, -66, 1.8, 61.5, 0.9), c), S(poly([[-1.5, 0], [1.5, 0], [1.1, -5], [-1.1, -5]]), RUBBER), R([[0, -64], [0, -76], [-1.6, -88], [-4.4, -98.5]], c, 1.8), R([[-1.4, -98], [-7, -92.4], [-7.6, -85.6], [-3.2, -80.4]], DARK, 2.8), S(rrect(-1.4, -69, 2.8, 7, 0.9), DARK), S(rrect(0, -68, 12, 4.6, 2.3), DARK), F(rect(1, -67, 9.6, 0.6), "#FFFFFF", 0.2)];
    for (let i = 0; i < 8; i++) sh.push(F(ellipse(0, -10 - i * 4, 0.3), DARK, 0.75));
    for (let i = 0; i < 6; i++) sh.push(F(rect(1.8 + i * 1.5, -68, 0.2, 4.6), tone(DARK, "light"), 0.35), F(rect(-1, -1.2 - i * 0.7, 2, 0.12), "#4A4B52", 0.5));
    return { w: 22, ppcm: 4.5, edge: 0.3, max: 6, hold: s => sz(mv(s, -6, 65.7), 0.78), sh: () => sh };
  },
  sunscreen: a => {
    const c = a.c("#F28C28"), lab = a.say("label", "GÜNEŞ KREMİ"), sub = a.say("sub", "SPF 50"), sh = [...tube(5.6, 16, c, PAPER, "#F2C230", 0.16), F(ellipse(0, -12.3, 1.1), "#F2C230")];
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; sh.push(L([[Math.cos(t) * 1.5, -12.3 + Math.sin(t) * 1.5], [Math.cos(t) * 2.1, -12.3 + Math.sin(t) * 2.1]], "#F2C230", 0.28, 1)); }
    return { w: 8, ppcm: 12, edge: 0.18, hold: -1.5, sh: () => sh, tx: [W(lab, -2.5, -10.2, 5, 3.4, { color: PAPER, size: 0.9, weight: 700 }), W(sub, -2.5, -6.6, 5, 1.6, { color: PAPER, size: 0.9 })] };
  },
  tissues: a => {
    const c = a.c("#8EC5E3"), lab = a.say("label", "MENDİL"), o = rrect(-3.5, -10, 7, 10, 1);
    const sh = [S(smooth([[-2.4, -9, 0], [-3.5, -11.2], [-2.7, -13.2], [-1.1, -13.2], [-0.3, -11.6], [0.6, -9, 0]], true, 1), tone(PAPER, "light")), S(smooth([[-0.9, -9, 0], [0.2, -11.4], [1.3, -13.6], [2.8, -13], [3.1, -11], [2.4, -9, 0]], true, 1), PAPER), L([[1.3, -13], [0.9, -11.4], [1, -9.6]], tone(PAPER, "deep"), 0.16, 0.5), S(o, c), ...lit(o, c, -3.5, 3.5, -10, 0, 0.2), F(rect(-3.5, -10, 7, 0.9), tone(c, "light"), 0.7, o), F(rect(-3.5, -0.9, 7, 0.9), tone(c, "light"), 0.7, o), F(rrect(-2.5, -8.3, 5, 1.2, 0.4), PAPER, 0.9)];
    for (const [x, y] of [[-1.8, -2.4], [0, -3.4], [1.8, -2.4]]) sh.push(F(ellipse(x, y, 0.55), tone(c, "light"), 0.8), F(ellipse(x, y, 0.2), PAPER, 0.8));
    return { w: 8.4, ppcm: 14, edge: 0.18, hold: -2, sh: () => sh, tx: [W(lab, -3, -6.4, 6, 2.2, { size: 0.9, weight: 700, color: PAPER })] };
  },
  hot_water_bottle: a => {
    const c = a.c("#D9534A"), r: Pt[] = [[8.2, 0, 0], [10.3, -3.5], [11, -12], [9.8, -20], [7, -26], [4.2, -29.5], [2.6, -31.6]];
    const o = smooth([...r, [2.5, -34.2, 0], [-2.5, -34.2, 0], ...[...r].reverse().map((p): Pt => p.length === 3 ? [-p[0], p[1], 0] : [-p[0], p[1]])], true, 1);
    const sh = [S(o, c), ...lit(o, c, -11, 11, -34, 0, 0.24), { path: o, stroke: { color: tone(c, "deep"), width: 0.9 }, flat: true, opacity: 0.35, clip: o }, F(ellipse(-5.6, -15, 1.5, 8), "#FFFFFF", 0.22, o), S(rrect(-3.6, -38, 7.2, 4.2, 1.1), "#F2EFE6"), ...Array.from({ length: 7 }, (_, i) => F(rect(-3 + i * 1, -37.5, 0.15, 3.2), tone("#F2EFE6", "shade"), 0.6))];
    for (let i = 0; i < 10; i++) sh.push({ ...L([[-12, -2.6 - i * 2.55 + 0.9], [0, -2.6 - i * 2.55 - 0.3], [12, -2.6 - i * 2.55 + 0.9]], tone(c, "deep"), 0.35, 0.4), clip: o });
    return { w: 26, ppcm: 6, edge: 0.3, max: 6, hold: 33, sh: () => sh };
  },
  syringe: a => {
    const c = a.c("#4F9FD6"), barrel = rrect(-1.1, -14, 2.2, 8.8, 0.3), sh = [S(rect(-0.3, -6, 0.6, 5.8), PAPER), S(ellipse(0, -0.4, 1.7, 0.45), PAPER), S(barrel, "#DCEEF3", { opacity: 0.95 }), F(rect(-1.1, -13.6, 2.2, 5.2), "#BFE6F2", 0.85), S(rect(-1, -8.6, 2, 1.1), RUBBER), S(rrect(-2.3, -6.1, 4.6, 0.9, 0.35), PAPER), S(rect(-0.45, -15.6, 0.9, 1.7), "#DCEEF3"), S(poly([[-0.85, -15.2], [0.85, -15.2], [0.45, -16.9], [-0.45, -16.9]]), c), R([[0, -16.7], [0, -22.4]], STEEL, 0.3), S(poly([[-0.15, -22.2], [0.15, -22.2], [0.1, -23.2]]), STEEL), F(rect(-1.1, -14, 0.3, 7), "#FFFFFF", 0.5, barrel), S(smooth([[0.8, -26.4, 0], [1.4, -25.4], [0.8, -24.6], [0.2, -25.4]], true, 1), "#8EC9E8", { flat: true })];
    for (let i = 0; i < 6; i++) sh.push(F(rect(0.3, -13 + i * 1.2, i % 2 ? 0.45 : 0.75, 0.1), "#5E7C86", 0.8));
    return { w: 6, ppcm: 12, edge: 0.15, hold: 5, sh: () => sh };
  },
  bp_cuff: a => {
    const c = a.c("#3A4A63"), lab = a.say("label", "120/80"), o = rrect(-28, -12.4, 26, 12.4, 3), mo = rrect(6, -9.6, 14, 9.6, 1.8);
    const cuff = [S(o, c), ...lit(o, c, -28, -2, -12.4, 0, 0.12), F(rect(-28, -12.4, 26, 0.5), tone(c, "light"), 0.5, o), F(rect(-6, -12.4, 4, 12.4), tone(c, "light"), 0.5, o), F(poly([[-17, -3], [-15.4, -6.2], [-13.8, -3]]), PAPER, 0.9), F(rect(-23, -9.6, 14, 0.3), PAPER, 0.7), S(rrect(-26.6, -9, 2.8, 5, 0.8), STEEL), F(rrect(-26, -8.4, 1.6, 3.8, 0.5), tone(c, "deep"), 0.8), S(rrect(-2.6, -4.6, 2.2, 2.6, 0.5), STEEL), R([[-0.8, -3.4], [1.5, -1.2], [3.6, -4.2], [5.2, -3.4], [6.4, -4.6]], "#E6E6E6", 0.8)];
    const mon = [S(mo, "#EEF0F1"), ...lit(mo, "#EEF0F1", 6, 20, -9.6, 0, 0.14), S(rrect(7.4, -8.2, 7.8, 5.6, 0.5), "#C5D6B8"), S(ellipse(17.6, -5.4, 1.4), "#3E8E4E"), F(ellipse(17.2, -5.8, 0.5), "#FFFFFF", 0.4), S(rect(5.2, -5.8, 1, 3), DARK), F(rect(15.6, -2.4, 3.8, 0.3), "#9AA0A6", 0.8)];
    return { w: a.held ? 18 : 50, ppcm: 9, edge: 0.25, max: 4, per: 2, hold: -5.5, sh: () => a.held ? mv(mon, -13, 0) : mv([...cuff, ...mon], 4, 0), tx: [W(lab, a.held ? -5.4 : 11.4, -8, 7.4, 5.2, { font: "screen", color: "#26332A", lit: 0, size: 2.2, weight: 700 })] };
  },
  stethoscope: a => {
    const c = a.c("#2E3A59"), sh: Shape[] = [R([[0, -7.4], [0.6, -12], [-0.9, -16], [0, -20.6]], c, 0.95), S(ellipse(0, -2.9, 3.2, 2.9), STEEL), S(ellipse(0, -2.9, 2.3, 2.1), "#DDE1E4"), F(ellipse(-0.7, -3.6, 0.8, 0.5), "#FFFFFF", 0.7), S(rrect(-0.7, -8.4, 1.4, 2.6, 0.5), STEEL), S(ellipse(0, -21, 1.2, 0.95), STEEL)];
    for (const d of [-1, 1]) sh.push(R([[0, -21], [d * 2.2, -25], [d * 4.6, -30], [d * 5.6, -34], [d * 4.4, -37.2]], STEEL, 0.65), S(ellipse(d * 4.2, -37.6, 0.95, 0.7), "#F3F5F6"));
    return { w: 14, ppcm: 12, edge: 0.18, hold: 21, sh: () => sh };
  },
  wheelchair: a => {
    const c = a.c("#2E3A59"), cy = -30.5, sp = poly([[0, cy], [0, cy]], false);
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; sp.add(poly([[Math.cos(t) * 3, cy + Math.sin(t) * 3], [Math.cos(t) * 25.4, cy + Math.sin(t) * 25.4]], false)); }
    const sh: Shape[] = [
      P([[-14.6, -51, 0], [-18.8, -51, 0], [-23.6, -92, 0], [-19.4, -92, 0]], c), S(rrect(-33, -96, 12.4, 3.2, 1.6), DARK),
      R([[-15, -47], [34, -47]], STEEL, 1.7), R([[-16, -48], [-19.6, -91]], STEEL, 1.5), R([[33, -47], [35, -26], [36, -14]], STEEL, 1.6), R([[33, -47], [44, -36], [51, -24]], STEEL, 1.6),
      S(rrect(47, -25, 11.5, 2.6, 1), DARK), S(rrect(-15, -52, 48.5, 5, 2), c), ...lit(rrect(-15, -52, 48.5, 5, 2), c, -15, 33.5, -52, -47, 0.1),
      R([[36, -14], [36, -6.4]], STEEL, 1.4), S(ellipse(36, -6.4, 6.4), DARK), S(ellipse(36, -6.4, 2.2), STEEL), F(ellipse(36, -6.4, 0.8), DARK),
      S(holed(ellipse(0, cy, 30.5), [ellipse(0, cy, 27.2)]), RUBBER, { evenodd: true }), S(holed(ellipse(0, cy, 27.2), [ellipse(0, cy, 25.6)]), STEEL, { evenodd: true }),
      { path: sp, stroke: { color: "#8E959C", width: 0.25 }, flat: true, opacity: 0.8 }, { path: ellipse(0, cy, 22.6), stroke: { color: STEEL, width: 0.7 } }, S(ellipse(0, cy, 3.4), STEEL), F(ellipse(0, cy, 1.4), DARK),
      R([[-12, -73], [-13, -50]], STEEL, 1.3), R([[16, -73], [17, -49]], STEEL, 1.3), S(rrect(-16, -75, 35, 3.6, 1.8), c),
    ];
    return { w: 104, ppcm: 3.5, edge: 0.45, max: 4, per: 2, hold: s => sz(mv(s, 27.2, 94.5), 0.5), sh: () => sh };
  },
};
const care = gen("care", CARE, "Health care: a digital thermometer, plasters with a bandage roll, a first-aid box with a cross, a pleated face mask, an elbow crutch, a sunscreen tube, a pocket pack of tissues, a ribbed hot-water bottle, a syringe, a blood-pressure cuff with its monitor, a stethoscope or a wheelchair seen side on.",
  ["a2-w-ecza-dolabi", "b1-w-koltuk-degnegi", "b1-w-gunes-kremi", "a1-w-mendil", "b1-w-igne", "a1-w-tansiyon", "a1-w-saglik"], ["health", "care"],
  { label: { type: "text", about: "the words on it: the thermometer's and the monitor's display (36,6; 120/80), the sunscreen's and the tissues' pack" }, sub: { type: "text", about: "the sunscreen's second line (default SPF 50)" } });

// ---- toiletries --------------------------------------------------------------------------------------

const TOILETRY: Record<string, (a: A) => Kind> = {
  toothbrush: a => {
    const c = a.c("#2F8C88"), lab = a.say("label", "DİŞ MACUNU"), neck = smooth([[-0.8, -13.6, 0], [0.8, -13.6, 0], [0.45, -17.4], [-0.45, -17.4]], true, 1), head = rrect(-0.95, -22, 1.9, 4.8, 0.8);
    const brush = [S(rrect(-0.9, -14.4, 1.8, 14.4, 0.9), c), F(rrect(-0.45, -11.6, 0.9, 3.4, 0.4), tone(c, "deep"), 0.6), F(rect(-0.7, -13, 0.25, 11.5), "#FFFFFF", 0.3), S(neck, c), S(head, c), S(rect(0.8, -21.8, 1.7, 4.4), PAPER), F(rect(0.8, -21.8, 1.7, 1.2), "#3F9BD0"), ...[0, 1, 2].map(i => F(rect(0.8, -20.4 + i * 1.1, 1.7, 0.1), tone(PAPER, "deep"), 0.5)), R([[0.6, -22], [1.3, -23.2], [2.2, -22.6], [3, -22]], "#EAF6FB", 1)];
    const t = tube(4.4, 14.5, "#F4F1E8", "#3F9BD0", "#3F9BD0", 0.34);
    return { w: a.held ? 5 : 12, ppcm: 11, edge: 0.18, hold: 1, sh: () => a.held ? brush : [...mv(brush, -3.6, 0), ...mv(t, 3.8, 0)], tx: a.held ? [] : [W(lab, 1.8, -10.6, 4, 3.8, { size: 0.8, weight: 700 })] };
  },
  soap: a => {
    const c = a.c("#F2B8C6"), dish = "#E4EEF2", dp = smooth([[-5.9, -2.2, 0], [5.9, -2.2, 0], [4.4, 0, 0], [-4.4, 0, 0]], true, 1);
    const base: Shape[] = [S(dp, dish), F(rect(-5.9, -0.6, 11.8, 0.6), tone(dish, "shade"), 0.6, dp), S(ellipse(0, -2.3, 5.9, 0.9), tone(dish, "light")), F(ellipse(0, -2.2, 5, 0.6), tone(dish, "shade"), 0.5)], sh: Shape[] = [];
    const top = poly([[-3.2, -5.7], [-2.3, -7], [3.3, -7], [3.8, -5.7]]);
    sh.push(S(rrect(-3.8, -5.9, 7.6, 3.7, 1.2), c), S(top, tone(c, "light")), F(rect(2.9, -5.9, 0.9, 3.7), tone(c, "shade"), 0.5, rrect(-3.8, -5.9, 7.6, 3.7, 1.2)), F(rrect(-2.1, -4.9, 4.2, 1.7, 0.85), tone(c, "shade"), 0.35), F(rect(-3.5, -5.3, 0.5, 2.5), "#FFFFFF", 0.4));
    for (const [x, y, r] of [[-1.6, -8.4, 0.9], [0.4, -9.9, 0.6], [1.9, -8.6, 0.45], [-0.2, -7.8, 0.3]]) sh.push(S(ellipse(x, y, r), "#FFFFFF", { opacity: 0.6 }), F(ellipse(x - r * 0.3, y - r * 0.3, r * 0.25), "#FFFFFF", 0.8));
    return { w: a.held ? 9 : 14, ppcm: 12, edge: 0.18, hold: -3.8, sh: () => a.held ? sh : [...base, ...sh] };
  },
  shampoo: a => {
    const c = a.c("#3A9BC1"), lab = a.say("label", "ŞAMPUAN"), o = smooth([[-3.3, 0, 0], [3.3, 0, 0], [3.5, -12], [3, -15.4], [2, -17, 0], [-2, -17, 0], [-3, -15.4], [-3.5, -12]], true, 1);
    const sh = [S(o, c), ...lit(o, c, -3.5, 3.5, -17, 0, 0.22), F(rrect(-3.3, -13, 6.6, 9.4, 0.5), PAPER, 1, o), F(rect(-3.3, -13, 6.6, 0.9), tone(c, "deep"), 0.8, o), F(smooth([[0, -5.2, 0], [1.1, -6.2], [0, -7.5, 0], [-1.1, -6.2]], true, 1), "#3E8E4E"), F(smooth([[0, -5.2, 0], [-1.4, -4.4], [-0.2, -4, 0]], true, 1), "#6AB04A"), S(rrect(-2.2, -21.8, 4.4, 4.8, 1), PAPER), F(rect(-2.2, -18.6, 4.4, 0.25), tone(PAPER, "deep"), 0.7), F(rrect(-0.8, -20.2, 1.6, 0.35, 0.17), DARK, 0.8), F(rect(-3, -16.2, 0.5, 12), "#FFFFFF", 0.3, o)];
    return { w: 9, ppcm: 11, edge: 0.2, hold: 1, sh: () => sh, tx: [W(lab, -3, -12.4, 6, 3.2, { size: 1, weight: 700 }), W(a.say("sub"), -3, -9, 6, 1.6, { size: 0.8 })] };
  },
  razor: a => {
    const c = a.c("#3F74C4"), h = smooth([[-0.9, 0, 0], [0.9, 0, 0], [1.3, -13], [-1.3, -13]], true, 1), blade = poly([[3.6, -0.4], [8.2, -0.4], [7.4, -2.5], [2.8, -2.5]]);
    const sh = [S(h, c), ...lit(h, c, -1.3, 1.3, -13, 0, 0.26), ...[0, 1, 2, 3, 4].map(i => F(rect(-1, -10 + i * 1.3, 2, 0.28), RUBBER, 0.7)), S(rrect(-0.6, -15, 1.2, 2.4, 0.4), RUBBER), S(rrect(-2.2, -18.2, 4.4, 3.6, 0.7), "#E9EEF0"), F(rect(-1.8, -17, 3.6, 0.35), STEEL), F(rect(-1.8, -16.2, 3.6, 0.35), STEEL), F(rrect(-1.9, -18, 3.8, 0.7, 0.3), "#6AB0C8"), F(rect(-2, -17.9, 0.3, 3), "#FFFFFF", 0.5)];
    return { w: a.held ? 6 : 12, ppcm: 14, edge: 0.15, hold: 0, sh: () => a.held ? sh : [...mv(sh, -2.4, 0), S(blade, STEEL), F(rrect(4.6, -1.9, 2.4, 0.8, 0.4), DARK, 0.6), F(ellipse(3.9, -1.2, 0.2), DARK, 0.6), F(ellipse(7, -1.2, 0.2), DARK, 0.6)] };
  },
  hairbrush: a => {
    const c = a.c("#B07A4A"), cu = "#3B4660", dots = ellipse(0, 0, 0.01);
    for (let j = 0; j < 8; j++) for (let i = -3; i <= 3; i++) { const x = i * 1.25 + (j % 2 ? 0.62 : 0), y = -24.6 + j * 1.55; if ((x / 3.7) ** 2 + ((y + 19.5) / 6.3) ** 2 < 1) dots.add(ellipse(x, y, 0.3)); }
    const hd = smooth([[-1.1, 0, 0], [1.1, 0, 0], [1.7, -12.5], [-1.7, -12.5]], true, 1);
    return { w: 12, ppcm: 11, edge: 0.2, hold: 2, sh: () => [S(hd, c), ...lit(hd, c, -1.7, 1.7, -12.5, 0, 0.28), S(rrect(-1.5, -13.2, 3, 1.3, 0.5), STEEL), S(ellipse(0, -19.5, 5, 7.6), c), ...lit(ellipse(0, -19.5, 5, 7.6), c, -5, 5, -27, -12, 0.2), S(ellipse(0, -19.5, 4.2, 6.8), cu), F(dots, "#F4F1E8", 1)] };
  },
  comb: a => {
    const c = a.c("#3A3D45"), teeth = rect(-9, -3, 0.2, 3);
    let x = -8.6; for (let i = 0; i < 40 && x < 8.5; i++) { const fine = x > 0.5; teeth.add(rect(x, -3.1, fine ? 0.22 : 0.4, 3.1)); x += fine ? 0.5 : 0.85; }
    const sp = rrect(-9, -4.5, 18, 1.7, 0.8);
    return { w: 21, ppcm: 15, edge: 0.14, per: 4, hold: -4, sh: () => [S(teeth, c), S(sp, c), F(rect(-8.4, -4.2, 16.8, 0.3), tone(c, "light"), 0.7, sp), F(rect(-9, -3.4, 18, 0.5), tone(c, "shade"), 0.6, sp)] };
  },
  mirror: a => {
    const c = a.c("#D9A72E"), g = ellipse(0, -20, 6.2, 7.2), hd = smooth([[-1.2, 0, 0], [1.2, 0, 0], [1.6, -11], [-1.6, -11]], true, 1), sh: Shape[] = [S(hd, c), ...lit(hd, c, -1.6, 1.6, -11, 0, 0.28), S(ellipse(0, -20, 7.6, 8.6), c), S(g, "#CFE3EA"), F(poly([[-6, -23], [-3.2, -27], [-1.6, -27], [-6, -21]]), "#FFFFFF", 0.5, g), F(poly([[-2.6, -14.6], [2, -22], [3.2, -22], [-1.4, -14.2]]), "#FFFFFF", 0.35, g), F(rect(3, -27, 3.4, 15), tone("#CFE3EA", "shade"), 0.35, g)];
    for (let i = 0; i < 14; i++) { const t = i * Math.PI * 2 / 14; sh.push(F(ellipse(Math.cos(t) * 6.9, -20 + Math.sin(t) * 7.9, 0.32), tone(c, "light"), 0.9)); }
    return { w: 17, ppcm: 10, edge: 0.22, hold: 2, sh: () => sh };
  },
  makeup: a => {
    const c = a.c("#E58FA0"), o = rrect(-10, -11, 20, 11, [3.5, 3.5, 2, 2]);
    const bag = [S(o, c), ...lit(o, c, -10, 10, -11, 0, 0.16), F(rect(-10, -11, 20, 1.6), tone(c, "deep"), 0.3, o), { path: smooth([[-9, -10.2], [9, -10.2]], false, 1), stroke: { color: STEEL, width: 0.5, dash: [0.4, 0.35] as number[] }, flat: true }, S(rrect(7.2, -11.6, 1.2, 2.8, 0.5), STEEL), F(ellipse(7.8, -8.4, 0.35), STEEL), F(rrect(-7.4, -7, 5, 2.4, 0.4), PAPER, 0.9), F(ellipse(-4.9, -5.8, 0.6), tone(c, "deep"), 0.8)];
    const lip = [S(rrect(-1.1, -3, 2.2, 3, 0.3), DARK), S(rrect(-1, -6.6, 2, 3.6, 0.3), "#D9A72E"), F(rect(-0.8, -6.2, 0.3, 2.8), "#FFFFFF", 0.4), S(poly([[-0.8, -6.6], [0.8, -6.6], [0.8, -9.6], [-0.8, -8.8]]), "#C8283A"), F(rect(-0.6, -9, 0.25, 2), "#FFFFFF", 0.35)];
    const cp = rt([S(ellipse(0, 0, 3.7), "#D9A72E"), S(ellipse(0, 0, 3), "#F2D8B0"), F(ellipse(-0.9, -1, 1.1, 0.6), "#FFFFFF", 0.5), S(rrect(-0.7, 3.1, 1.4, 1, 0.3), STEEL)], 0.14);
    return { w: a.held ? 22 : 36, ppcm: 10, edge: 0.22, hold: a.held ? 8 : 0, sh: () => a.held ? bag : [...mv(bag, -2, 0), ...mv(lip, -14.6, 0), ...mv(cp, 13, -3.6)] };
  },
  manicure: a => {
    const c = a.c("#6B4A35"), li = "#EEDFD5", o = rrect(-8.8, -15.4, 17.6, 15.4, 1.4), inn = rrect(-7.6, -14.2, 15.2, 13, 0.9);
    const sh: Shape[] = [S(o, c), ...lit(o, c, -8.8, 8.8, -15.4, 0, 0.12), { path: rrect(-8.1, -14.7, 16.2, 14, 1.1), stroke: { color: tone(c, "light"), width: 0.2, dash: [0.5, 0.4] }, flat: true, opacity: 0.8 }, S(inn, li), F(rect(-7.6, -14.2, 15.2, 1.4), tone(li, "shade"), 0.4, inn),
      S(poly([[-6.5, -3], [-5, -3], [-4.8, -11.4], [-5.7, -12.9], [-6.7, -11.4]]), STEEL), ...[0, 1, 2, 3, 4, 5].map(i => F(rect(-6.5, -4 - i * 1.3, 1.6, 0.1), tone(STEEL, "deep"), 0.7)),
      R([[-3, -4.6], [-2.3, -8.2], [-1.6, -13.2]], STEEL, 0.55), R([[-1.6, -4.6], [-2.4, -8.2], [-3.1, -13.2]], STEEL, 0.55), { path: ellipse(-3.4, -3.3, 0.95, 0.85), stroke: { color: "#C8283A", width: 0.5 } }, { path: ellipse(-1.3, -3.3, 0.95, 0.85), stroke: { color: "#C8283A", width: 0.5 } }, F(ellipse(-2.3, -8.2, 0.25), DARK, 0.8),
      R([[1.6, -2.9], [0.7, -8], [1.2, -12.8]], STEEL, 0.6), R([[1.6, -2.9], [2.6, -8], [2.1, -12.8]], STEEL, 0.6), F(rrect(1.1, -4.6, 1, 1.4, 0.3), STEEL),
      S(rrect(4.2, -8.8, 2.6, 6, 0.9), STEEL), F(rect(4.4, -8.4, 2.2, 0.4), DARK, 0.6), R([[5, -8.6], [5.1, -12], [6.4, -13.2]], STEEL, 0.5), F(rect(4.5, -7.6, 0.4, 3.8), "#FFFFFF", 0.4),
      F(rect(-7.6, -9.4, 15.2, 0.4), tone(li, "deep"), 0.45), F(rect(-7.6, -4.6, 15.2, 0.4), tone(li, "deep"), 0.45)];
    return { w: 20, ppcm: 12, edge: 0.2, hold: -2, sh: () => sh };
  },
  tissue_box: a => {
    const c = a.c("#8EC5E3"), lab = a.say("label", "KÂĞIT MENDİL"), w = 24, h = 11, d = 11, k = d * 0.55, oy = -h - k / 2, ox = d / 2, f = rrect(-w / 2, -h, w, h, 0.6);
    const sh = [...cart(w, h, d, c, 0.6), ...lit(f, c, -w / 2, w / 2, -h, 0, 0.12), F(rrect(-9.6, -9.6, 19.2, 7.2, 1.4), PAPER), S(ellipse(ox, oy, 7.6, 1.7), tone(c, "deep")), S(smooth([[ox - 3.6, oy + 0.2, 0], [ox - 4.6, oy - 3.4], [ox - 1.4, oy - 6], [ox + 0.6, oy - 4], [ox + 2.8, oy - 7], [ox + 4.8, oy - 3.2], [ox + 3.8, oy + 0.2, 0]], true, 1), PAPER), F(poly([[ox - 1.4, oy - 5.6], [ox + 0.4, oy - 1]], false), tone(PAPER, "deep"), 0.6)];
    for (const x of [-8.6, 8.6]) sh.push(F(ellipse(x, -8.4, 0.5), tone(c, "light"), 0.9), F(ellipse(x, -3.6, 0.5), tone(c, "light"), 0.9));
    return { w: w + 12, ppcm: 9, edge: 0.25, max: 12, per: 3, hold: -3, sh: () => sh, tx: [W(lab, -9, -9, 18, 6, { size: 1.8, weight: 700 })] };
  },
  toilet_roll: a => {
    const c = a.c("#F6F1E4"), o = rrect(-5, -10.4, 10, 10.4, [0.4, 0.4, 2, 2]), tl = { w: 2.2, h: 2.2, shapes: [S(ellipse(0.55, 0.55, 0.2), tone(c, "shade")), S(ellipse(1.65, 1.65, 0.2), tone(c, "shade"))] };
    const sh = [S(o, c), ...lit(o, c, -5, 5, -10.4, 0, 0.22), { path: o, tile: tl, flat: true, opacity: 0.55, clip: o }, S(ellipse(0, -10.4, 5, 1.5), tone(c, "light")), F(ellipse(0, -10.4, 2, 0.62), "#B98A57"), F(ellipse(0, -10.5, 1.5, 0.42), "#6B4A35", 0.9), S(poly([[-2.6, -9.6], [2.6, -9.6], [2.9, -1.4], [-2.4, -1]]), tone(c, "light")), F(rect(-2.5, -4, 5.1, 0.12), tone(c, "deep"), 0.5), S(poly([[2.9, -1.4], [1.2, -1.1], [2.9, -3.2]]), tone(c, "shade"))];
    return { w: 11.4, ppcm: 14, edge: 0.18, per: 8, hold: -3, sh: () => sh };
  },
};
const toiletry = gen("toiletry", TOILETRY, "Toiletries: a toothbrush with toothpaste, a bar of soap on its dish, a shampoo bottle, a razor with a spare blade, a paddle hairbrush, a comb, a hand mirror, a make-up bag with lipstick and a compact, a manicure set, a box of paper tissues or a toilet roll.",
  ["a1-w-dis-fircasi", "a1-w-jilet", "a2-w-sac-fircasi", "a2-w-makyaj", "a1-w-manikur", "b1-w-kagit-mendil"], ["toiletry", "bathroom"],
  { label: { type: "text", about: "the words on it: the toothpaste tube (DİŞ MACUNU), the shampoo bottle (ŞAMPUAN), the tissue box (KÂĞIT MENDİL)" }, sub: { type: "text", about: "the shampoo bottle's second line (a size, say)" } });

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { medicine, care, toiletry };
