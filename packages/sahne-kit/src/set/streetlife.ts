// Props of the streetlife family (STYLE.md): street vendors, street things, shop kit and travel kit. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { Path, arcPoints, ellipse, rect, rrect, poly, smooth, tone, mul, rotate, scale, translate, groupBounds, type Affine, type EmitSpec, type ParamSpec, type PieceDef, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, solidLine } from "./draw.ts";

const DARK = "#2E2F35", STEEL = "#B8BEC4", BRASS = "#D9A72E", CREAM = "#F3EBD8", WOOD = "#8A5A3C", GLASS = "#CFE6EE", LEAF = "#4E7A48", INK = "#2B2420", WHITE = "#FBF8F2";
type Prm = Record<string, unknown>;
type Em = [EmitSpec["kind"], number, number, number];

// ---- helpers -------------------------------------------------------------------------------------

/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a rod, a strap, a handle. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(), w = x1 - x0; return [F(rect(x1 - w * k, y0 - 1, w * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, w * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** A cut outline with its light. */
const O = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...lit(o, c, k)];
/** A rounded box with its light. */
const K = (x: number, y: number, w: number, h: number, c: string, r = 1, k = 0.2) => O(rrect(x, y, w, h, r), c, k);
/** Many small round marks in one shape. */
const dots = (pts: Vec2[], r: number, c: string, op = 1, o: Partial<Shape> = {}, ry = r): Shape => { const p = new Path(); for (const [x, y] of pts) p.add(ellipse(x, y, r, ry)); return { path: p, fill: c, flat: true, opacity: op, ...o }; };
/** Printed strokes as one flat shape. */
const lines = (segs: Vec2[][], c: string, w = 0.5, op = 0.7, clip?: Path): Shape => { const p = new Path(); for (const s of segs) p.add(poly(s, false)); return { path: p, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }; };
/** Rings (a simit) in one shape: outer circles with their holes cut. */
const rings = (pts: Vec2[], r: number, c: string, h = 0.38): Shape => { const p = new Path(); for (const [x, y] of pts) p.add(ellipse(x, y, r)).add(ellipse(x, y, r * h)); return { path: p, fill: c, evenodd: true }; };
/** A rubber wheel with a steel hub. */
const wh = (x: number, y: number, r: number): Shape[] => [S(ellipse(x, y, r), DARK), S(ellipse(x, y, r * 0.56), STEEL), F(ellipse(x, y, r * 0.2), DARK, 0.7), F(ellipse(x - r * 0.12, y - r * 0.5, r * 0.14), "#FFFFFF", 0.35)];
/** A glass pane over x, y, w, h: a faint tint, two glints, a frame. */
const pane = (x: number, y: number, w: number, h: number): Shape[] => [F(rect(x, y, w, h), GLASS, 0.28), F(poly([[x + w * 0.1, y + h], [x + w * 0.3, y], [x + w * 0.42, y], [x + w * 0.22, y + h]]), "#FFFFFF", 0.3, rect(x, y, w, h)), { path: rect(x, y, w, h), stroke: { color: DARK, width: 1.6 } }];
/** Words in a box of the art; nothing for an empty string. */
/** The language tag of a kind's default words (while they are the default), else the `lang` param. */
const lg = (c: Cx, def: string, lang: string): Partial<TextSpec> => { const l = typeof c.p.lang === "string" && c.p.lang ? c.p.lang : c.t === def ? lang : undefined; return l ? { lang: l } : {}; };
const tx = (t: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec[] => t.trim() ? [{ text: t.trim(), x, y, w, h, font: "print", ...o }] : [];
/** A tulip tea glass (10 cm) at (x, y) on its saucer, `fill` of tea. */
const tulip = (x: number, y: number, tea = "#B03A1C"): Shape[] => [S(ellipse(x, y - 0.6, 4.4, 0.9), WHITE), P([[x - 2.8, y - 1], [x - 2.2, y - 5], [x - 2.5, y - 9.6], [x + 2.5, y - 9.6], [x + 2.2, y - 5], [x + 2.8, y - 1]], GLASS, { opacity: 0.8 }), F(poly([[x - 2.3, y - 8], [x + 2.3, y - 8], [x + 1.9, y - 1.6], [x - 1.9, y - 1.6]]), tea, 0.92), F(rect(x - 1.6, y - 8, 0.7, 6), "#FFFFFF", 0.35)];

// ---- the table-driven generator ------------------------------------------------------------------

/** What one thing draws, at its own origin: shapes, words, glow, and emitters (kind, x, y, w; the art's y, up is negative). */
interface B { sh: Shape[]; tx?: TextSpec[]; gl?: Shape[]; em?: Em[] }
interface Cx { p: Prm; r: Rng; c: string; i: number; held: boolean; t: string }
/** One kind: its slot `w` (and `h` for stacking in `cols` columns), art resolution, default colour and words, how it is drawn, and how it is held (`k` smaller; `g` the grip in the art, else it sits on the hand). */
interface Kd { w: number; h?: number; cols?: number; gap?: number; ppcm: number; c: string; t?: string; edge?: number; hold?: { k?: number; g?: Vec2 }; hp?: number; /** the art drawn this much smaller (not with a grip `g`) */ s?: number; d(c: Cx): B; /** what it draws in a hand instead, when the whole thing is too big to carry */ hd?(c: Cx): B }

/** Shapes moved by an affine that scales uniformly (their clips, strokes and tiles with them). */
const mv = (sh: Shape[], m: Affine): Shape[] => { const k = m[0]; return sh.map(s => ({
  ...s, path: s.path.transform(m),
  ...(s.stroke && k !== 1 ? { stroke: { ...s.stroke, width: s.stroke.width * k, ...(s.stroke.dash ? { dash: s.stroke.dash.map(d => d * k) } : {}) } } : {}),
  ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}),
  ...(s.tile ? { tile: { ...s.tile, w: s.tile.w * k, h: s.tile.h * k, x: (s.tile.x ?? 0) * k + m[4], y: (s.tile.y ?? 0) * k + m[5], shapes: k !== 1 ? mv(s.tile.shapes, [k, 0, 0, k, 0, 0]) : s.tile.shapes } } : {}),
})); };

function gen(T: Record<string, Kd>, m: { about: string; terms: string[]; tags: string[]; tp?: string; ta: string; nmax?: number; solid?: boolean; params?: Record<string, ParamSpec> }): PieceDef {
  const kinds = Object.keys(T), tp = m.tp ?? "label", nmax = m.nmax ?? 24;
  const kd = (p: Prm) => T[str(p.kind, str(p.variant, kinds[0]))] ?? T[kinds[0]];
  const cnt = (p: Prm) => Math.max(1, Math.min(nmax, Math.round(num(p.n, 1))));
  return {
    draw(p, r) {
      const k = kd(p), held = !!p.held, n = held ? 1 : cnt(p), cols = Math.min(n, k.cols ?? n), cx = { p, r, c: hex(p.color, k.c), held, t: str(p[tp], k.t ?? "") };
      const hk = held ? k.hold?.k ?? 1 : 1, g = k.hold?.g, hm: Affine = held ? [hk, 0, 0, hk, g ? -g[0] * hk : 0, g ? -g[1] * hk : -7.5] : [1, 0, 0, 1, 0, 0];
      const sh: Shape[] = [], txt: TextSpec[] = [], gl: Shape[] = [], em: EmitSpec[] = [];
      for (let i = 0; i < n; i++) {
        const rw = Math.floor(i / cols), rn = Math.min(cols, n - rw * cols), b = (held && k.hd ? k.hd : k.d)({ ...cx, i }), a = mul(hm, mul(translate((i % cols - (rn - 1) / 2) * (k.w + (k.gap ?? 4)), -rw * (k.h ?? 0)), scale(k.s ?? 1)));
        sh.push(...mv(b.sh, a)); gl.push(...mv(b.gl ?? [], a));
        for (const t of b.tx ?? []) txt.push({ ...t, x: t.x * a[0] + a[4], y: t.y * a[0] + a[5], w: t.w * a[0], h: t.h * a[0], ...(t.size ? { size: t.size * a[0] } : {}) });
        if (!held) for (const [kind, x, y, w] of b.em ?? []) em.push({ kind, x: x * a[0] + a[4], y: -(y * a[0] + a[5]), w: w * a[0] });
      }
      const edge = (k.edge ?? 0.4) * hk, [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge });
      return { flats: [{ group: { shapes: sh, edge }, ppcm: Math.min(held && k.hp ? k.hp : k.ppcm, 16, 1900 /Math.max(1, x1 - x0, y1 - y0)), ...(held ? {} : { shadow: "drop" as const }), ...(txt.length ? { text: txt } : {}), ...(gl.length ? { emissive: { shapes: gl, edge: 0 } } : {}) }], ...(em.length ? { emitters: em } : {}) };
    },
    variants: Object.fromEntries(kinds.map(v => [v, { kind: v }])),
    ...(m.solid ? { solid(p: Prm) { const h = (kd(p).w + (kd(p).gap ?? 4)) * cnt(p) / 2; return solidLine(-h, h); } } : {}),
    meta: {
      about: m.about, terms: m.terms, tags: m.tags,
      params: {
        kind: { type: "enum", values: kinds, default: kinds[0] },
        n: { type: "int", min: 1, max: nmax, default: 1, about: "how many, side by side (the ones that stack, in columns)" },
        color: { type: "color", about: "the main colour (a palette id or a hex); each kind has its own default" },
        [tp]: { type: "text", about: m.ta },
        ...m.params,
      },
    },
  };
}

// ---- vendor --------------------------------------------------------------------------------------

/** A street cart's body (w wide, its top `top` high on two side wheels), push handle and plank lines. */
const cart = (w: number, top: number, c: string, wr = 22): Shape[] => [
  ...[-1, 1].flatMap(d => wh(d * (w / 2 - 4), -wr, wr)),
  R([[w / 2 - 2, -top + 8], [w / 2 + 14, -top + 2], [w / 2 + 16, -top - 12]], DARK, 2.6),
  ...K(-w / 2, -top, w, top - 28, c, 2.5, 0.14), S(rect(-w / 2 - 1, -34, w + 2, 6), tone(c, "deep")),
  lines([[[-w / 2 + 3, -top + 6], [w / 2 - 3, -top + 6]], [[-w / 2 + 3, -37], [w / 2 - 3, -37]]], tone(c, "deep"), 0.6, 0.5),
];
/** A cream plate on a cart's front, for its words. */
const plate = (x: number, y: number, w: number, h: number, c = CREAM): Shape[] => [S(rrect(x, y, w, h, 2), c), F(rrect(x + 1.2, y + 1.2, w - 2.4, h - 2.4, 1.4), "#FFFFFF", 0.0), { path: rrect(x + 1.4, y + 1.4, w - 2.8, h - 2.8, 1.2), stroke: { color: tone(c, "shade"), width: 0.4 }, flat: true, opacity: 0.8 }];
const cob = (x: number, y: number, w: number, c: string): Shape[] => { const o = rrect(x - w / 2, y - 4.6, w, 9.2, 4.6); return [P([[x - w / 2 - 3, y], [x - w / 2 + 8, y - 6.4], [x - w / 2 + 13, y], [x - w / 2 + 8, y + 6.4]], LEAF), S(o, c), { path: o, tile: { w: 2.8, h: 2.8, shapes: [S(ellipse(1.4, 1.4, 0.85), tone(c, "shade"))] }, flat: true, opacity: 0.8 }, F(rect(x - w / 2 + 3, y - 3.6, w - 6, 1.2), "#FFFFFF", 0.3, o)]; };
const orange = (x: number, y: number, r: number): Shape[] => [S(ellipse(x, y, r), "#F08A1C"), F(ellipse(x - r * 0.3, y - r * 0.34, r * 0.3), "#FFD27A", 0.6), F(ellipse(x + r * 0.34, y + r * 0.4, r * 0.5), tone("#F08A1C", "shade"), 0.35), F(ellipse(x, y - r * 0.78, 0.7), "#4E7A48")];

/** A scalloped striped awning over x0 … x1, y0 … y1 (its scallops hang below y1). */
const awning = (x0: number, x1: number, y0: number, y1: number, n: number, c: string): Shape[] => {
  const w = (x1 - x0) / n, pts: Vec2[] = [[x0, y0], [x1, y0]];
  for (let i = n - 1; i >= 0; i--) pts.push(...arcPoints(x0 + (i + 0.5) * w, y1, w / 2, w * 0.36, 0, Math.PI, 6));
  const o = poly(pts);
  return [S(o, CREAM), ...Array.from({ length: Math.ceil(n / 2) }, (_, j) => F(rect(x0 + 2 * j * w, y0 - 1, w, y1 - y0 + w), c, 1, o)), ...lit(o, CREAM, 0.14)];
};
/** Simit rings (15 cm) at the points, their sesame printed on. */
const simits = (pts: Vec2[]): Shape[] => [rings(pts, 7.4, "#C98A35"), dots(pts.flatMap(([x, y]) => Array.from({ length: 5 }, (_, i) => [x + Math.cos(i * 1.26 + x) * 5.4, y + Math.sin(i * 1.26 + x) * 5.4] as Vec2)), 0.6, "#F3DDA0", 0.9)];
/** A round steel tray at (x, y), seen a little from above: its bowl under a lit face. */
const tray = (x: number, y: number, rx: number, ry: number): Shape[] => [...O(poly(arcPoints(x, y, rx, ry * 1.2, 0, Math.PI, 28)), STEEL), ...O(ellipse(x, y, rx, ry), STEEL, 0.2), S(ellipse(x, y - 0.4, rx * 0.9, ry * 0.78), tone(STEEL, "shade"))];
const NUTS = (r: Rng) => Array.from({ length: 44 }, () => { const x = r.range(-32, 44); return [x, -92 - (1 - ((x - 6) / 42) ** 2) * r.range(2, 20)] as Vec2; });

const vendor = gen({
  simit_cart: { w: 134, ppcm: 4, c: "#C0392B", t: "SİMİT", hold: { k: 1 }, hp: 10, hd: () => ({ sh: [...tray(0, -4, 23, 4.4), ...simits([[-7, -18], [7, -18]]), ...simits([[-14, -10.5], [0, -10.5], [14, -10.5]])] }), d: ({ c, r, t }) => {
    const pts = [-87, -104, -121].flatMap((y, j) => Array.from({ length: j < 2 ? 7 : 6 }, (_, i) => [-48 + i * 16 + (j > 1 ? 8 : 0) + r.range(-1, 1), y + r.range(-1, 1)] as Vec2));
    return { sh: [...cart(124, 78, c), ...plate(-44, -72, 88, 28), S(rect(-58, -140, 116, 62), "#8B6A4E"), ...simits(pts), F(rect(-58, -96, 116, 1.4), "#3E2A1C", 0.5), F(rect(-58, -113, 116, 1.4), "#3E2A1C", 0.5), ...pane(-58, -140, 116, 62), ...O(poly([[-63, -139], [0, -161], [63, -139]]), tone(c, "shade"), 0.12), S(ellipse(0, -163, 3), BRASS)],
      tx: tx(t, -42, -70, 84, 24, { color: tone(c, "deep"), weight: 700 }) };
  } },
  chestnut_cart: { w: 124, ppcm: 4, c: "#2F6B5B", t: "KESTANE", hold: { k: 0.3 }, d: ({ c, r, t }) => {
    const nuts = NUTS(r);
    return { sh: [...cart(112, 74, c), S(rrect(-50, -92, 100, 16, 4), "#3A3D45"), S(rrect(-52, -94, 104, 5, 2), STEEL), dots(nuts, 4.3, "#7B4527", 1, { flat: false }), dots(nuts.map(([x, y]) => [x - 1.4, y - 1.2] as Vec2), 1.2, "#B5784A", 0.8),
      ...plate(-54, -68, 44, 26), S(rrect(-6, -68, 56, 26, 3), "#1E1E22"), F(rrect(-2, -64, 48, 18, 2), "#FF7A28", 0.92), dots(Array.from({ length: 9 }, (_, i) => [2 + i * 5.2, -52 + (i % 2) * 5] as Vec2), 2.4, "#26201E", 0.9),
      ...K(-52, -196, 12, 106, STEEL, 2), ...O(poly([[-56, -196], [-36, -196], [-46, -210]]), DARK), S(rrect(-53, -140, 14, 5, 1.5), "#8E959C")],
      tx: tx(t, -52, -66, 40, 22, { color: tone(c, "deep"), weight: 700 }), gl: [F(rrect(-2, -64, 48, 18, 2), "#FF8A30", 0.9)], em: [["smoke", -46, -212, 8], ["steam", 8, -110, 22]] };
  } },
  corn_cart: { w: 134, ppcm: 4, c: "#2D79B3", t: "MISIR", hold: { k: 0.3 }, d: ({ c, t }) => ({
    sh: [...cart(116, 72, c), ...plate(-50, -66, 100, 26), ...K(-52, -124, 46, 52, STEEL, 4), ...O(poly([[-55, -124], [-30, -124], [-30, -137], [-48, -134]]), tone(STEEL, "shade"), 0.1), ...O(smooth([[-55, -123, 0], [-51, -131], [-29, -136], [-7, -131], [-3, -123, 0]], true, 1), STEEL, 0.3), S(ellipse(-29, -138, 3.4), DARK), S(rrect(-59, -112, 7, 6, 3), DARK), S(rrect(-7, -112, 7, 6, 3), DARK),
      S(rect(6, -130, 52, 58), "#4A3A2A"), ...[-80, -91, -102, -113, -124].flatMap((y, i) => cob(32, y, 40, i % 2 ? "#F5D86A" : "#F2C230")), ...pane(6, -130, 52, 58)],
    tx: tx(t, -48, -64, 96, 22, { color: tone(c, "deep"), weight: 700 }), em: [["steam", -29, -140, 14], ["steam", -20, -134, 8]] }) },
  ice_cream: { w: 112, ppcm: 4, c: "#B3282D", t: "DONDURMA", hold: { k: 0.3 }, d: ({ c, t }) => {
    const cone = (x: number, sc: string): Shape[] => [...O(poly([[x - 5, -96], [x + 5, -96], [x, -72]]), "#D9A55B"), lines([[[x - 3, -90], [x + 2, -80]], [[x + 3, -90], [x - 2, -80]]], "#9C6A2E", 0.4, 0.8), S(ellipse(x, -99, 6.4, 5.6), sc), F(ellipse(x - 2, -101, 2, 1.4), "#FFFFFF", 0.5)];
    return { sh: [...cart(104, 70, c), F(rect(-52, -70, 104, 7), BRASS, 0.9), dots(Array.from({ length: 9 }, (_, i) => [-44 + i * 11, -66.5] as Vec2), 1.6, "#FFF3D6", 0.9),
      ...K(-50, -118, 52, 48, STEEL, 5), S(ellipse(-24, -118, 26, 6), tone(STEEL, "shade")), S(ellipse(-24, -118.6, 22, 4.2), CREAM), S(rrect(-52, -121, 56, 5, 2.5), "#9AA2AA"),
      R([[-22, -112], [-6, -150], [10, -188]], "#A9AFB5", 3), ...O(smooth([[3, -196], [12, -202], [19, -194], [15, -180], [12, -168], [9, -182]], true, 1), CREAM, 0.15),
      ...[0, 1, 2].flatMap(i => cone(22 + i * 13, ["#F6E2E8", "#E8B98A", CREAM][i])), S(rrect(18, -73, 44, 4, 1.5), "#7A4A2A")],
      tx: tx(t, -44, -60, 88, 22, { color: "#FFF3D6", weight: 700 }) };
  } },
  juice_stand: { w: 134, ppcm: 4, c: "#F28C28", t: "PORTAKAL SUYU", hold: { k: 0.3 }, d: ({ c, t }) => {
    const ors = [4, 3, 2, 1].flatMap((k, j) => Array.from({ length: k }, (_, i) => orange(-43 + j * 6.8 + i * 13.6, -79 - j * 11.8, 6.9)).flat());
    return { sh: [R([[-57, -72], [-57, -192]], DARK, 2.6), R([[57, -72], [57, -192]], DARK, 2.6), ...cart(112, 72, c), ...plate(-50, -66, 100, 26), ...ors,
      ...K(8, -128, 38, 56, STEEL, 4), ...O(poly([[6, -128], [48, -128], [42, -142], [12, -142]]), tone(STEEL, "shade")), ...orange(20, -146, 5.8), ...orange(34, -146, 5.8), S(rrect(14, -120, 26, 24, 3), "#2B2F36"), F(ellipse(27, -102, 9, 5), "#E6B14A"), S(rrect(23, -92, 8, 6, 2), DARK),
      P([[47, -72], [55, -72], [56, -86], [46, -86]], GLASS, { opacity: 0.8 }), F(poly([[47.4, -73], [54.6, -73], [55.4, -82], [46.6, -82]]), "#F5A623", 0.95), ...awning(-64, 64, -210, -188, 8, c), ...O(poly([[-66, -208], [0, -226], [66, -208]]), tone(c, "shade"), 0.12)],
      tx: tx(t, -48, -64, 96, 22, { color: tone(c, "deep"), weight: 700 }) };
  } },
  midye: { w: 82, ppcm: 8, c: "#2C3A5A", hold: { k: 0.6 }, d: ({ c, held }) => {
    const row = (y: number, x0: number, k: number) => Array.from({ length: k }, (_, i) => [x0 + i * 8.6, y] as Vec2);
    const a = row(-16, -25.8, 7), b = row(-10.4, -21.5, 6), lem = (x: number, y: number): Shape[] => [S(ellipse(x, y, 4.4, 3.6), "#F2D13B"), F(ellipse(x, y, 3.3, 2.6), "#FFF1A6", 0.9), lines([[[x - 3, y], [x + 3, y]], [[x - 2, y - 2], [x + 2, y + 2]], [[x - 2, y + 2], [x + 2, y - 2]]], "#E3B820", 0.4, 0.8)];
    const tr = [...tray(0, -12, 37, 11), dots([...a, ...b], 4.9, c, 1, { flat: false }, 3), dots([...a, ...b].map(([x, y]) => [x, y - 0.7] as Vec2), 3.5, "#F2EAD0", 1, {}, 1.7), dots([...a, ...b].map(([x, y]) => [x + 1, y - 1] as Vec2), 0.5, "#C9BC94", 0.8), ...lem(-30, -14), ...lem(-31, -8), ...lem(30, -14), ...lem(31, -8)];
    return { sh: held ? tr : [R([[-22, -62], [-32, 0]], DARK, 2.4), R([[22, -62], [32, 0]], DARK, 2.4), R([[0, -58], [0, 0]], DARK, 2.4), { path: ellipse(0, -28, 28, 5), stroke: { color: DARK, width: 1.6 } }, ...mv(tr, translate(0, -62))] };
  } },
  lottery: { w: 112, ppcm: 4, c: "#C0392B", t: "PİYANGO", hold: { k: 0.25 }, d: ({ c, t, r }) => {
    const tk = Array.from({ length: 12 }, (_, i) => { const x = -37 + (i % 4) * 19.5, y = -186 + Math.floor(i / 4) * 30, tc = r.pick(["#E94F4F", "#F2C230", "#3E8E4E", "#F4EDE0", "#E58FA0", "#4F9ED9"]); return [S(rrect(x, y, 17.5, 26, 1), tc), F(rect(x + 1.5, y + 1.5, 14.5, 6), INK, 0.45), lines([[[x + 2, y + 12], [x + 15, y + 12]], [[x + 2, y + 16], [x + 12, y + 16]], [[x + 2, y + 20], [x + 14, y + 20]]], tone(tc, "deep"), 0.7, 0.7)]; }).flat();
    return { sh: [R([[-42, 0], [-42, -220]], DARK, 3.4), R([[42, 0], [42, -220]], DARK, 3.4), ...K(-44, -82, 88, 82, "#2B3A59", 1.5), dots([[-6, -50], [6, -50], [0, -57], [0, -43]], 5.4, CREAM, 0.9), S(rect(-1, -44, 2, 14), LEAF), S(rrect(-50, -90, 100, 9, 2), WOOD), S(rrect(-44, -190, 88, 100, 3), "#233B66"), ...tk, ...K(-50, -222, 100, 28, c, 3), S(rrect(-54, -228, 108, 8, 3), tone(c, "deep"))],
      tx: tx(t, -46, -220, 92, 24, { color: "#FFF3D6", weight: 800 }) };
  } },
  shoe_shine: { w: 56, ppcm: 10, c: "#6B3F22", hold: { g: [0, -33] }, edge: 0.3, d: ({ c, held }) => ({
    sh: [...K(-23, -17, 46, 17, c, 2.5), ...[[-23, -17], [17, -17], [-23, -6], [17, -6]].map(([x, y]) => S(rrect(x, y, 6, 6, 1.2), BRASS)), ...O(ellipse(0, -8.6, 5.4), BRASS), F(ellipse(0, -8.6, 3), tone(BRASS, "deep"), 0.6), S(rrect(-13, -2.2, 26, 1.1, 0.5), BRASS),
      ...O(poly([[-19, -17], [-13, -25], [0, -25], [3, -17]]), BRASS, 0.3), S(rrect(-13, -26.6, 13, 2, 1), tone(BRASS, "light")), ...O(poly([[7, -17], [9, -26], [17, -26], [19, -17]]), BRASS, 0.3), S(rrect(8, -28, 10, 2, 1), tone(BRASS, "light")),
      S(rrect(-22, -21, 9, 4, 1.5), "#9B6B3A"), F(rect(-22, -21.6, 9, 1.4), DARK, 0.85), ...(held ? [] : [S(rrect(26, -15, 7, 12, 1.5), "#7B1E1E"), S(rrect(26.8, -18, 5.4, 3.4, 1), DARK), S(rrect(35, -13, 6, 10, 1.4), "#2C4A7A"), S(rrect(35.8, -16, 4.4, 3.4, 1), DARK)]),
      R([[-8, -17], [-8, -30], [8, -30], [8, -17]], BRASS, 1.6), S(rrect(-4, -32, 8, 2.6, 1.2), tone(BRASS, "light"))] }) },
  newspaper: { w: 120, ppcm: 4, c: "#C0392B", t: "GAZETE", hold: { k: 0.25 }, d: ({ c, t, r }) => {
    const paper = (x: number, y: number): Shape[] => { const pc = r.pick([WHITE, "#EDE5D2", "#E2E8EE"]), mc = r.pick(["#2F5FA8", "#B33A3A", "#2E2F35", "#3E8E4E"]); return [S(rect(x, y, 26, 36), pc), F(rect(x + 1.5, y + 1.5, 23, 6.4), mc, 0.9), F(rect(x + 2, y + 10, 11, 9), "#8E959C", 0.7), lines([[[x + 15, y + 11], [x + 24, y + 11]], [[x + 15, y + 14.5], [x + 24, y + 14.5]], [[x + 15, y + 18], [x + 22, y + 18]], [[x + 2, y + 22], [x + 24, y + 22]], [[x + 2, y + 25.5], [x + 24, y + 25.5]], [[x + 2, y + 29], [x + 24, y + 29]], [[x + 2, y + 32.5], [x + 18, y + 32.5]]], INK, 0.7, 0.45)]; };
    return { sh: [R([[-52, 0], [-52, -208]], DARK, 3.4), R([[52, 0], [52, -208]], DARK, 3.4), S(rrect(-50, -182, 100, 100, 3), "#4A5A6A"), ...[-1, 0, 1].flatMap(i => [paper(i * 32 - 13, -178), paper(i * 32 - 13, -134)].flat()), S(rrect(-50, -141, 100, 3.6, 1), WOOD), S(rrect(-50, -97, 100, 4, 1), WOOD),
      ...K(-56, -210, 112, 28, c, 3), ...K(-46, -22, 66, 7, "#E9E4D6", 1), ...K(-44, -15, 62, 7, "#DDD6C2", 1), ...K(-46, -8, 66, 8, "#E9E4D6", 1), R([[-46, -11], [20, -11]], "#A9824A", 0.8), ...K(26, -34, 22, 34, "#8A6B4E", 2), lines([[[28, -26], [46, -26]], [[28, -18], [46, -18]]], tone("#8A6B4E", "deep"), 0.6, 0.7)],
      tx: tx(t, -48, -208, 96, 24, { color: "#FFF3D6", weight: 800 }) };
  } },
  tea_cart: { w: 134, ppcm: 4, c: "#2F7F86", t: "ÇAY", hold: { k: 1 }, hp: 12, hd: () => ({ sh: [...tray(0, -3.4, 16, 3.2), ...[-9.4, 0, 9.4].flatMap(x => tulip(x, -3.4))] }), d: ({ c, t }) => {
    const pot = (x: number, y: number, w: number, h: number): Shape[] => [...O(smooth([[x - w / 2, y], [x - w * 0.55, y - h * 0.4], [x - w * 0.34, y - h * 0.9], [x, y - h], [x + w * 0.34, y - h * 0.9], [x + w * 0.55, y - h * 0.4], [x + w / 2, y]], true, 1), STEEL, 0.28), S(ellipse(x, y - h - 1.2, 2.2), DARK)];
    return { sh: [...cart(116, 70, c), ...plate(-50, -64, 100, 26), ...K(-60, -76, 120, 6, WOOD, 2), ...pot(-34, -76, 36, 28), R([[-18, -88], [-10, -90], [-5, -98]], STEEL, 2.4), R([[-52, -88], [-56, -102], [-48, -104]], DARK, 1.8), ...pot(-34, -104, 24, 22), R([[-23, -112], [-18, -118], [-14, -122]], STEEL, 2), S(rrect(-34, -80, 18, 3, 1), DARK),
      ...K(6, -81, 52, 4, STEEL, 1.5), ...[0, 1, 2, 3, 4].map(i => tulip(14 + i * 10, -81)).flat(), ...K(62, -92, 12, 16, "#F4EFE6", 2), S(rrect(60.5, -95, 15, 3.6, 1.5), tone("#F4EFE6", "shade"))],
      tx: tx(t, -48, -62, 96, 22, { color: tone(c, "deep"), weight: 700 }), em: [["steam", -4, -100, 5], ["steam", -14, -126, 6]] };
  } },
  salep: { w: 122, ppcm: 4, c: "#7A3E2A", t: "SALEP", hold: { k: 0.3 }, d: ({ c, t }) => {
    const cu = "#C07A3A", o = smooth([[-34, -76], [-39, -92], [-36, -110], [-29, -122], [-20, -126], [-11, -122], [-4, -110], [-1, -92], [-6, -76]], true, 1), mug = (x: number, y: number): Shape[] => [R([[x + 3.2, y - 5.4], [x + 6, y - 4.6], [x + 5, y - 1.6], [x + 3, y - 1.4]], WHITE, 1.1), ...O(rrect(x - 3.6, y - 7.4, 7.2, 7.4, 1.4), WHITE, 0.25), F(rect(x - 3.6, y - 5.4, 7.2, 1), "#C8283A", 0.8)];
    return { sh: [...cart(110, 70, c), ...plate(-50, -64, 100, 26), ...K(-56, -76, 112, 6, WOOD, 2), S(rrect(-36, -80, 32, 5, 2), "#8A5A2A"), ...O(o, cu, 0.26), F(rect(-40, -104, 40, 3), tone(cu, "deep"), 0.6, o), F(rect(-40, -92, 40, 2), tone(cu, "deep"), 0.5, o), ...O(rrect(-26, -136, 12, 12, 2), cu, 0.25), ...O(smooth([[-30, -136, 0], [-27, -144], [-20, -148], [-13, -144], [-10, -136, 0]], true, 1), cu, 0.25), S(ellipse(-20, -151, 2.6), BRASS),
      R([[-2, -96], [8, -98]], BRASS, 2.4), S(rrect(6, -103, 4, 7, 1.2), BRASS), R([[-40, -104], [-46, -104], [-46, -96]], tone(cu, "deep"), 1.8), ...[0, 1, 2, 3].flatMap(i => mug(18 + i * 11, -76)), S(rrect(54, -88, 7, 12, 1.4), "#A5642F"), S(rrect(54.6, -91, 5.8, 3, 1), DARK)],
      tx: tx(t, -48, -62, 96, 22, { color: tone(c, "deep"), weight: 700 }), em: [["steam", -20, -153, 8], ["steam", 30, -86, 14]] };
  } },
}, { about: "A street vendor's cart: simit, roasted chestnuts, boiled corn, Maraş ice cream, fresh orange juice, stuffed mussels, lottery tickets, a shoe-shine box, newspapers, tea or hot salep.", terms: ["a2-w-simit", "a2-w-simitci", "a2-w-kestane", "a2-w-misir", "a1-w-dondurma", "a1-w-portakal", "a1-w-limon", "a2-w-piyango", "a1-w-gazete", "a1-w-cay", "a1-w-caydanlik"], tags: ["street", "vendor"], tp: "sign", ta: "the words on the cart's board (each kind has its own default)", nmax: 6, solid: true });

// ---- street kit ----------------------------------------------------------------------------------

/** A bicycle side on, facing right, its wheels at x ± 36. */
const bike = (c: string): Shape[] => {
  const spokes = [-36, 36].flatMap(x => Array.from({ length: 8 }, (_, i) => [[x, -30], [x + Math.cos(i * 0.785) * 27, -30 + Math.sin(i * 0.785) * 27]] as Vec2[]));
  return [...[-36, 36].map(x => ({ path: ellipse(x, -30, 28), stroke: { color: DARK, width: 3.4 } }) as Shape), lines(spokes, "#8E959C", 0.35, 0.8), ...[-36, 36].map(x => S(ellipse(x, -30, 2.6), STEEL)),
    R([[-36, -30], [-8, -28]], c, 2.4), R([[-36, -30], [-18, -66]], c, 2.2), R([[-8, -28], [-18, -66]], c, 2.6), R([[-18, -66], [24, -68]], c, 2.6), R([[-8, -28], [24, -62]], c, 3), R([[25, -70], [28, -56]], tone(c, "deep"), 3.4), R([[28, -56], [36, -30]], STEEL, 2.2),
    S(ellipse(-20, -71, 7, 2.4), DARK), R([[-18, -66], [-19, -70]], STEEL, 2), R([[24, -70], [21, -80], [30, -84]], DARK, 2), S(ellipse(-8, -28, 3.4), DARK), F(ellipse(-8, -28, 6.4), "#8E959C", 0.4), S(ellipse(34, -76, 2.6), "#FFF3B0")];
};

/** The recycling sign: three arrows chasing round a triangle centred (x, y). */
const recy = (x: number, y: number): Shape[] => {
  const V: Vec2[] = [[x, y - 9], [x + 9, y + 7], [x - 9, y + 7]], seg: Vec2[][] = [], hd = new Path();
  for (let i = 0; i < 3; i++) {
    const a = V[i], b = V[(i + 1) % 3], at = (t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * 2.4, ny = (b[0] - a[0]) / l * 2.4, [mx, my] = at(0.56), [ex, ey] = at(0.92);
    seg.push([at(0.14), at(0.6)]); hd.add(poly([[mx + nx, my + ny], [ex, ey], [mx - nx, my - ny]]));
  }
  return [lines(seg, WHITE, 2, 0.95), F(hd, WHITE, 0.95)];
};

const street = gen({
  bin: { w: 54, ppcm: 8, c: "#2E7D5B", hold: { k: 0.4 }, d: ({ c }) => ({ sh: [...wh(-17, -5, 5), ...wh(17, -5, 5), ...O(smooth([[-22, -84, 0], [22, -84, 0], [24, -9], [20, -4, 0], [-20, -4, 0], [-24, -9]], true, 1), c, 0.2), ...O(rrect(-25, -97, 50, 13, 4), tone(c, "deep"), 0.2), F(rrect(-15, -92, 30, 3.4, 1.6), DARK, 0.9), S(rrect(-7, -101, 14, 5, 2.5), DARK), F(rect(-24, -30, 48, 3), tone(c, "light"), 0.5), F(ellipse(0, -55, 11), WHITE, 0.92),
    F(smooth([[-5.2, -62, 0], [-2.6, -57.5], [0, -64, 0], [2.6, -57.5], [5.2, -62, 0], [4.2, -52], [0, -49], [-4.2, -52]], true, 1), c, 1), F(rect(-0.5, -50, 1, 3.6), c, 1)] }) },
  recycling: { w: 124, ppcm: 6, c: "#2F6DB5", hold: { k: 0.24 }, d: ({ c }) => {
    const rb = (x: number, bc: string, i: number): Shape[] => [...wh(x - 12, -4, 3.4), ...wh(x + 12, -4, 3.4), ...O(rrect(x - 17, -78, 34, 74, 4), bc), ...O(rrect(x - 19, -86, 38, 10, 3), tone(bc, "deep")), i === 1 ? S(ellipse(x, -81, 3.6), DARK) : S(rrect(x - 8, -83, 16, 3.4, 1.7), DARK),
      ...recy(x, -57)];
    return { sh: [...rb(-41, c, 0), ...rb(0, "#E8B923", 1), ...rb(41, "#3E8E4E", 2)] };
  } },
  cone: { w: 38, ppcm: 10, c: "#EE6A1F", hold: { k: 0.5 }, edge: 0.3, d: ({ c }) => { const o = P([[-5, -66, 0], [5, -66, 0], [14.4, -7, 0], [-14.4, -7, 0]], c).path; return { sh: [S(o, c), ...lit(o, c, 0.28), F(rect(-20, -53, 40, 9), WHITE, 0.95, o), F(rect(-20, -37, 40, 7), WHITE, 0.95, o), S(rrect(-6, -68, 12, 4, 2), tone(c, "shade")), S(rrect(-18, -7, 36, 7, 1.6), DARK), F(rect(-16, -6, 32, 1.4), "#4B5058", 0.8)] }; } },
  bollard: { w: 28, ppcm: 10, c: "#3A3D45", hold: { k: 0.5 }, edge: 0.3, d: ({ c }) => { const o = rrect(-6.5, -88, 13, 84, [6.5, 6.5, 0, 0]); return { sh: [...O(o, c, 0.3), F(rect(-8, -78, 16, 5), WHITE, 0.95, o), F(rect(-8, -68, 16, 3), "#F2C230", 0.95, o), S(rrect(-9.5, -6, 19, 6, 1.6), tone(c, "shade")), F(ellipse(0, -87, 5, 1.2), tone(c, "light"), 0.6)] }; } },
  ptt_box: { w: 54, ppcm: 6, c: "#F4C20D", t: "PTT", hold: { k: 0.35 }, d: ({ c, t }) => ({ sh: [S(rrect(-14, -14, 5, 14, 1), DARK), S(rrect(9, -14, 5, 14, 1), DARK), ...O(rrect(-19, -102, 38, 90, [17, 17, 3, 3]), c, 0.22), S(rrect(-13.5, -88, 27, 7, 2.4), DARK), F(rect(-13, -86, 26, 2), "#5A5F66", 0.7),
    ...O(rrect(-13, -50, 26, 30, 2), tone(c, "shade")), S(ellipse(0, -35, 2.6), DARK), lines([[[-9, -46], [9, -46]], [[-9, -43], [6, -43]]], DARK, 0.5, 0.55), F(rrect(-17, -14, 34, 2.4, 1), tone(c, "deep"), 0.7)], tx: tx(t, -16, -77, 32, 18, { color: "#1A1A1A", weight: 800 }) }) },
  parking_meter: { w: 40, ppcm: 8, c: "#37506B", t: "2,50 TL", hold: { k: 0.26 }, d: ({ c, t }) => ({
    sh: [R([[0, -170], [0, -148]], STEEL, 3), S(rrect(-14, -200, 28, 29, 3), "#1F5FC0"), F(rrect(-12, -198, 24, 25, 2), "#FFFFFF", 0.18), ...O(rrect(-15, -150, 30, 150, [8, 8, 2, 2]), c, 0.25), S(rrect(-11, -141, 22, 13, 1.6), "#0F2A22"), S(rrect(-10, -122, 20, 12, 2), DARK), F(ellipse(7, -116, 1.4), "#4CD964"),
      ...[0, 1, 2].flatMap(j => [0, 1, 2].map(i => F(rrect(-8.5 + i * 6, -104 + j * 5.4, 4.6, 3.6, 1), "#8E959C", 0.95))), S(rrect(-6, -84, 12, 3, 1.4), DARK), S(rrect(-8, -76, 16, 4, 1.5), DARK), S(rect(-4.6, -72, 9.2, 7), WHITE), F(rect(-3, -68, 6, 0.8), "#8E959C", 0.8), F(rect(-15, -20, 30, 2), tone(c, "deep"), 0.6)],
    gl: [F(rrect(-11, -141, 22, 13, 1.6), "#7FF5C8", 0.8)], tx: [...tx("P", -14, -200, 28, 29, { color: WHITE, weight: 800 }), ...tx(t, -10.4, -140, 20.8, 11, { font: "screen", color: "#9FF5D0", lit: 0 })] }) },
  hydrant: { w: 46, ppcm: 10, c: "#C8283A", hold: { k: 0.7 }, edge: 0.3, d: ({ c }) => ({ sh: [...[-1, 1].flatMap(d => [...O(rrect(d > 0 ? 6 : -18, -43, 12, 13, 2), c), S(rrect(d > 0 ? 17 : -22, -44.5, 5, 16, 1.8), STEEL)]), R([[-20, -32], [-13, -22], [-6, -26]], "#8E959C", 0.7),
    ...O(rrect(-9.5, -54, 19, 50, 2), c), ...O(smooth([[-10.5, -54, 0], [-9.5, -62], [0, -68], [9.5, -62], [10.5, -54, 0]], true, 1), c), ...O(rrect(-3.6, -75, 7.2, 8, 1.6), STEEL), S(ellipse(0, -31, 7.4), tone(c, "deep")), S(ellipse(0, -31, 5.4), STEEL), F(ellipse(0, -31, 2), DARK, 0.6), ...O(rrect(-13.5, -8, 27, 8, 2), c), F(rect(-9.5, -52, 19, 2), tone(c, "deep"), 0.6), F(rect(-9.5, -17, 19, 2), tone(c, "deep"), 0.6)] }) },
  bus_stop: { w: 60, ppcm: 3, c: "#1F5FC0", t: "DURAK", hold: { k: 0.2 }, d: ({ c, t }) => ({
    sh: [...K(-2.4, -266, 4.8, 266, STEEL, 1, 0.4), ...K(-12, -9, 24, 9, "#8E959C", 2), ...O(rrect(-23, -266, 46, 46, 6), c), F(rrect(-15.5, -258, 31, 25, 4.4), WHITE, 0.96), F(rect(-12.6, -254.6, 11, 9), c, 0.9), F(rect(1.6, -254.6, 11, 9), c, 0.9), F(rect(-12.6, -240, 25, 2), c, 0.5), F(ellipse(-9.6, -233, 3), c), F(ellipse(9.6, -233, 3), c), F(ellipse(-12.5, -241, 1.3), "#F2C230"), F(ellipse(12.5, -241, 1.3), "#F2C230"),
      ...K(-27, -216, 54, 22, tone(c, "deep"), 2), ...K(-14, -190, 28, 12, "#F2C230", 2), lines([[[-9, -184], [9, -184]]], DARK, 0.9, 0.7)],
    tx: tx(t, -25, -214, 50, 18, { color: WHITE, weight: 700 }) }) },
  atm: { w: 96, ppcm: 3, c: "#C8283A", t: "Hoş geldiniz", hold: { k: 0.2 }, d: ({ c, t }) => ({
    sh: [...O(rrect(-44, -180, 88, 180, 2), "#BDB8AC", 0.1), lines([[[-44, -150], [44, -150]], [[-44, -120], [44, -120]], [[-44, -90], [44, -90]], [[-44, -60], [44, -60]], [[-44, -30], [44, -30]], [[-22, -180], [-22, 0]], [[0, -180], [0, 0]], [[22, -180], [22, 0]]], "#8E8A7E", 0.5, 0.4),
      ...O(rrect(-31, -154, 62, 114, 4), "#323A46", 0.18), S(rrect(-31, -160, 62, 13, 3), c), F(rrect(-22, -156.6, 44, 4, 2), WHITE, 0.85), S(rrect(-23, -141, 46, 34, 2.4), "#0E2433"), ...[0, 1, 2, 3].flatMap(j => [-1, 1].map(d => F(rrect(d * 27 - 2, -139 + j * 8, 4, 4, 1), "#8E959C", 0.9))),
      ...[0, 1, 2, 3].flatMap(j => [0, 1, 2].map(i => F(rrect(-10.5 + i * 8, -98 + j * 6, 6.4, 4, 1), "#9AA0A6", 0.95))), S(rrect(-22, -104, 12, 4, 1.4), "#14171B"), F(ellipse(-26, -102, 1.4), "#4CD964"), S(rrect(12, -104, 12, 3, 1), "#14171B"), S(rrect(-23, -66, 46, 11, 2), "#14171B"), F(rect(-21, -62, 42, 2), "#4CD964", 0.8)],
    gl: [F(rrect(-23, -141, 46, 34, 2.4), "#8ED3F0", 0.7), F(rect(-21, -62, 42, 2), "#4CD964", 0.8)], tx: tx(t, -21, -139, 42, 30, { font: "screen", color: "#E6F6FF", lit: 0 }) }) },
  bike_rack: { w: 180, ppcm: 4, c: "#2F6DB5", hold: { k: 0.25 }, d: ({ c }) => ({ sh: mv([...bike(c), R([[-74, -4], [-62, -12], [-52, -44], [-40, -48], [-28, -44], [-20, -12], [-8, -4], [8, -12], [20, -44], [32, -48], [44, -44], [52, -12], [62, -4], [74, -12]], "#8E959C", 3.2)], [1.2, 0, 0, 1.2, 0, 0]) }) },
  scooter: { w: 98, ppcm: 8, c: "#2F9E8F", hold: { k: 0.4 }, d: ({ c }) => ({ sh: [...wh(-46, -9, 9), ...wh(33, -10, 10), ...O(P([[-47, -18, 0], [-10, -18], [28, -17, 0], [29, -10, 0], [-10, -9], [-47, -10, 0]], c).path, c, 0.2), ...O(P([[-54, -13, 0], [-52, -22], [-42, -23, 0], [-40, -15, 0]], c).path, tone(c, "shade")), R([[24, -14], [17, -102]], STEEL, 3.6), S(rrect(18, -34, 12, 12, 3), tone(c, "deep")), S(rrect(12, -106, 4, 3, 1), DARK),
    R([[6, -105], [27, -108]], DARK, 2.6), S(rrect(2, -110, 9, 6, 2.4), DARK), S(rrect(24, -112, 6, 5, 2), DARK), F(ellipse(28, -34, 2.4), "#FFE9A0", 1), R([[24, -14], [33, -10]], STEEL, 2.6), S(rrect(14, -74, 6, 9, 2), DARK)] }) },
  courier: { w: 186, ppcm: 3, c: "#2F5FA8", t: "KARGO", hold: { k: 0.22 }, edge: 0.5, d: ({ c, t }) => ({
    sh: [...wh(-56, -22, 22), ...wh(58, -22, 22), R([[40, -76], [58, -24]], STEEL, 3.4), R([[-56, -22], [-20, -36]], DARK, 3), ...O(P([[-64, -40, 0], [-66, -58], [-38, -68], [-10, -60], [10, -38, 0]], c).path, c, 0.2), ...O(rrect(-22, -38, 56, 8, 3), tone(c, "deep")), ...O(P([[26, -30, 0], [42, -34], [48, -84], [38, -98], [28, -62]], c).path, c, 0.25), ...K(-54, -72, 48, 11, DARK, 5, 0.2),
      R([[-64, -56], [-82, -72]], DARK, 2.6), S(rrect(-96, -77, 62, 5, 2), DARK), ...K(-90, -128, 52, 52, "#E4572E", 5), F(rect(-90, -108, 52, 1.6), tone("#E4572E", "deep"), 0.7), F(rrect(-82, -122, 36, 16, 2), WHITE, 0.95), R([[40, -92], [36, -106], [26, -106]], DARK, 3), S(ellipse(31, -118, 5, 3), DARK), S(ellipse(49, -80, 4.4, 5.4), "#FFF3B0"), S(rrect(-80, -38, 28, 7, 3.4), STEEL)],
    gl: [F(ellipse(49, -80, 6, 7), "#FFF3B0", 0.6)], tx: tx(t, -80, -121, 34, 14, { color: "#C0391B", weight: 800 }) }) },
  traffic_light: { w: 40, ppcm: 4, c: "#3A3D45", hold: { k: 0.2 }, d: ({ c, p }) => {
    const on = str(p.lamp, "red"), lamps: [string, string, number][] = [["red", "#E5392B", -276], ["yellow", "#F2B51C", -258], ["green", "#2FB866", -240]], hood = (y: number): Shape => S(smooth([[-7.4, y - 5.6, 0], [-5, y - 8.6], [5, y - 8.6], [7.4, y - 5.6, 0]], true, 1), tone(c, "deep"));
    return { sh: [...K(-2.8, -286, 5.6, 286, "#6D737A", 1, 0.4), ...K(-8, -10, 16, 10, "#6D737A", 2), ...O(rrect(-10.5, -296, 21, 62, 4.4), c, 0.22), ...lamps.flatMap(([k, lc, y]) => [hood(y), S(ellipse(0, y, 6.2), "#14171B"), S(ellipse(0, y, 5.2), on === k ? lc : tone(lc, "deep")), F(ellipse(-1.6, y - 1.6, 1.4), WHITE, on === k ? 0.55 : 0.2)])],
      gl: lamps.filter(([k]) => on === k).map(([, lc, y]) => F(ellipse(0, y, 7), lc, 0.85)) };
  } },
  stop_sign: { w: 40, ppcm: 4, c: "#C8283A", t: "DUR", hold: { k: 0.2 }, d: ({ c, t }) => { const oct = (r: number) => poly(Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4 + Math.PI / 8) * r, -236 + Math.sin(i * Math.PI / 4 + Math.PI / 8) * r] as Vec2));
    return { sh: [...K(-2.2, -216, 4.4, 216, "#6D737A", 1, 0.4), ...K(-8, -8, 16, 8, "#6D737A", 2), ...O(oct(22), WHITE, 0.15), ...O(oct(19.4), c, 0.2)], tx: tx(t, -15, -245, 30, 18, { color: WHITE, weight: 800 }) }; } },
  no_parking: { w: 40, ppcm: 4, c: "#1F5FC0", hold: { k: 0.2 }, d: ({ c }) => ({
    sh: [...K(-2.2, -216, 4.4, 216, "#6D737A", 1, 0.4), ...K(-8, -8, 16, 8, "#6D737A", 2), ...O(ellipse(0, -236, 21), WHITE, 0.15), ...O(ellipse(0, -236, 19.4), c, 0.2), { path: ellipse(0, -236, 16.4), stroke: { color: "#C8283A", width: 3.6 }, flat: true }, lines([[[-11.6, -247.6], [11.6, -224.4]]], "#C8283A", 3.4, 1)] }) },
  phone_box: { w: 100, ppcm: 4, c: "#C8283A", t: "TELEPHONE", hold: { k: 0.2 }, d: c => {
    const o = rrect(-40, -236, 80, 236, 2), panes = [-1, 0, 1].flatMap(i => [0, 1, 2, 3, 4, 5].map(j => rrect(-33 + (i + 1) * 23.5, -204 + j * 28, 19, 24, 1.4))), glass = new Path();
    for (const q of panes) glass.add(q);
    return { sh: [S(rrect(-45, -8, 90, 8, 1.4), tone(c.c, "deep")), S(o, c.c), ...lit(o, c.c, 0.14), F(glass, "#A9D3E6", 0.85), lines([[[-33, -204], [-14, -178]], [[3, -204], [-6, -190]]], WHITE, 1.4, 0.4), S(rrect(-44, -246, 88, 14, 3), tone(c.c, "deep")), S(smooth([[-42, -246, 0], [-34, -256], [0, -262], [34, -256], [42, -246, 0]], true, 1), c.c), F(rrect(-34, -240, 68, 16, 1.4), WHITE, 0.95), S(rrect(33, -116, 4, 24, 1.6), BRASS)],
      gl: [F(glass, "#FFE2A6", 0.55)], tx: tx(c.t, -32, -240, 64, 16, { color: INK, weight: 700, ...lg(c, "TELEPHONE", "en") }) };
  } },
  pillar_box: { w: 56, ppcm: 8, c: "#C8283A", t: "POST", hold: { k: 0.4 }, edge: 0.3, d: c => {
    const o = rrect(-23, -132, 46, 124, [10, 10, 1, 1]);
    return { sh: [S(rrect(-27, -8, 54, 8, 1.6), tone(c.c, "deep")), S(o, c.c), ...lit(o, c.c, 0.2), S(smooth([[-26, -132, 0], [-18, -142], [0, -146], [18, -142], [26, -132, 0]], true, 1), tone(c.c, "shade")), S(ellipse(0, -147, 3), tone(c.c, "deep")), S(rrect(-19, -108, 38, 5, 2), DARK), F(rrect(-19, -111, 38, 1.2, 0.6), tone(c.c, "light"), 0.7), F(rect(-23, -96, 46, 1.6), tone(c.c, "deep"), 0.7), S(rrect(-15, -86, 30, 14, 1.4), CREAM), F(rect(-23, -22, 46, 1.6), tone(c.c, "deep"), 0.7)],
      tx: tx(c.t, -14, -85, 28, 12, { color: INK, weight: 700, ...lg(c, "POST", "en") }) };
  } },
  morris_column: { w: 120, ppcm: 3, c: "#2F5A45", t: "SPECTACLE", hold: { k: 0.15 }, d: c => {
    const o = rrect(-46, -270, 92, 246, 1), pc = ["#E4572E", "#F2C230", "#4F9ED9", "#F4F1EA", "#E58FA0", "#8BC34A"];
    return { sh: [S(ellipse(0, -9, 54, 8), tone(c.c, "deep")), ...K(-52, -26, 104, 22, c.c, 3), S(o, "#EFE6D2"), ...lit(o, "#EFE6D2", 0.22), ...[0, 1, 2].flatMap(i => [F(rect(-42 + i * 29.5, -246, 26, 70), pc[i], 0.95, o), F(rect(-42 + i * 29.5, -166, 26, 100), pc[(i + 3) % 6], 0.95, o), F(rect(-37 + i * 29.5, -230, 16, 4), WHITE, 0.8, o), F(rect(-37 + i * 29.5, -150, 16, 4), INK, 0.5, o)]),
      ...K(-50, -278, 100, 10, c.c, 2), S(smooth([[-44, -278, 0], [-36, -296], [0, -308], [36, -296], [44, -278, 0]], true, 1), c.c), ...lit(smooth([[-44, -278, 0], [-36, -296], [0, -308], [36, -296], [44, -278, 0]], true, 1), c.c, 0.2), S(ellipse(0, -313, 4.4), tone(c.c, "deep")), R([[0, -318], [0, -330]], c.c, 3)],
      tx: tx(c.t, -39, -242, 78, 14, { color: INK, weight: 800, ...lg(c, "SPECTACLE", "fr") }) };
  } },
  drinking_fountain: { w: 56, ppcm: 8, c: "#2F4A3A", hold: { k: 0.4 }, edge: 0.3, d: c => ({
    sh: [...K(-18, -8, 36, 8, tone(c.c, "deep"), 1.4), ...O(smooth([[-9, -8, 0], [-11, -26], [-7, -48], [-5, -86, 0], [5, -86, 0], [7, -48], [11, -26], [9, -8, 0]], true, 1), c.c, 0.24), ...O(smooth([[-22, -90, 0], [-19, -80], [0, -76], [19, -80], [22, -90, 0]], true, 1), c.c, 0.2), S(ellipse(0, -90, 22, 4), tone(c.c, "shade")), F(ellipse(0, -90, 18, 2.6), "#9CC4D8", 0.8), ...K(-3.4, -120, 6.8, 30, c.c, 2), R([[0, -116], [14, -112], [15, -100]], c.c, 3.4), F(poly([[14, -100], [15, -96], [13.4, -90], [16.6, -90]]), "#9CC4D8", 0.7), S(ellipse(0, -122, 5), tone(c.c, "deep")), F(rect(-3, -66, 6, 2), BRASS, 0.9)] }) },
  canal_bollard: { w: 34, ppcm: 10, c: "#2E3036", hold: { k: 0.5 }, edge: 0.3, d: c => ({
    sh: [...K(-13, -5, 26, 5, tone(c.c, "light"), 1.2), ...O(smooth([[-11, -5, 0], [-9, -28], [-7, -35], [-13, -40, 0], [-13, -47, 0], [0, -51], [13, -47, 0], [13, -40, 0], [7, -35], [9, -28], [11, -5, 0]], true, 1), c.c, 0.26), F(rect(-10, -22, 20, 3), WHITE, 0.9), R([[-8, -33], [8, -30]], "#C9B38A", 2.8), R([[-8.4, -29.6], [8.6, -26.8]], "#C9B38A", 2.6), R([[8, -30], [14, -22], [12, -10]], "#C9B38A", 2.2), F(ellipse(-4, -47, 4, 1.2), tone(c.c, "light"), 0.5)] }) },
  name_plate: { w: 96, ppcm: 6, c: "#2C5E9E", t: "Rue des Fleurs", hold: { k: 0.3 }, d: c => ({
    sh: [...K(-2.4, -264, 4.8, 264, STEEL, 1, 0.4), ...K(-10, -8, 20, 8, "#8E959C", 2), ...O(rrect(-46, -266, 92, 24, 3), c.c, 0.14), { path: rrect(-43.6, -263.6, 87.2, 19.2, 1.8), stroke: { color: WHITE, width: 0.9 }, flat: true, opacity: 0.95 }, S(ellipse(-38, -254, 1), tone(c.c, "deep")), S(ellipse(38, -254, 1), tone(c.c, "deep"))],
    tx: tx(c.t, -40, -262, 80, 16, { color: WHITE, weight: 700, ...lg(c, "Rue des Fleurs", "fr") }) }) },
  stop_pole: { w: 50, ppcm: 4, c: "#2E7D4F", t: "H", hold: { k: 0.2 }, d: c => ({
    sh: [...K(-2.4, -268, 4.8, 268, STEEL, 1, 0.4), ...K(-11, -9, 22, 9, "#8E959C", 2), ...O(ellipse(0, -276, 22), "#F2C230", 0.16), ...O(ellipse(0, -276, 19), c.c, 0.2), ...K(-17, -228, 34, 40, CREAM, 2), lines([[[-12, -220], [12, -220]], [[-12, -212], [10, -212]], [[-12, -204], [12, -204]], [[-12, -196], [8, -196]]], INK, 0.8, 0.6), F(rect(-17, -228, 34, 5), c.c, 0.95)],
    tx: tx(c.t, -14, -290, 28, 28, { color: "#F2C230", weight: 800, ...lg(c, "H", "de") }) }) },
}, { about: "Street furniture: a municipal bin, three recycling bins, a traffic cone, a bollard, the yellow PTT post box, a parking pay station, a fire hydrant, a bus-stop sign post, an ATM in its wall panel, a bike rack with a bike, an e-scooter, a courier moped with its delivery box, a traffic light, a stop sign, a no-parking sign, a telephone box, a pillar box, a Morris poster column, a drinking fountain, a canal mooring bollard, a street-name plate or a tram-stop pole.", terms: ["a1-w-cop-kutusu", "a1-w-postane", "a2-w-otopark", "a1-w-durak", "a1-w-banka", "b1-w-kargo", "a2-w-trafik", "b1-w-kurye", "a1-w-bisiklet", "a2-w-levha"], tags: ["street", "city"], ta: "the words on it (PTT box, pay-station screen, bus-stop name, ATM screen, delivery box, stop sign, phone-box and pillar-box words, a column's poster, a street-name plate, a stop pole's letter); each kind has its own default or none", solid: true, params: { lang: { type: "text", about: "the language tag of the words on it (fr, de, en); a kind's default words carry their own" }, lamp: { type: "enum", values: ["red", "yellow", "green"], default: "red", about: "traffic_light: the lamp that is lit (it glows at night)" } } });

// ---- shop kit ------------------------------------------------------------------------------------

/** A banknote of `c` at (x, y) turned `a`. */
const bill = (x: number, y: number, a: number, c: string): Shape[] => { const m = mul(translate(x, y), rotate(a)); return [S(rrect(-8, -3.6, 16, 7.2, 0.6).transform(m), c), F(ellipse(0, 0, 2.2).transform(m), tone(c, "light"), 0.8), F(rect(-6.6, -2.4, 2, 4.8).transform(m), tone(c, "shade"), 0.5)]; };
/** A printed grid (mesh, weave) over an outline. */
const mesh = (o: Path, c: string, s: number, op = 0.7): Shape => ({ path: o, tile: { w: s, h: s, shapes: [S(rrect(s * 0.2, s * 0.2, s * 0.6, s * 0.6, s * 0.15), c)] }, flat: true, opacity: op });
const BEANS: [string, number][] = [["#8E3B2A", 1.3], ["#F3EEDD", 0.8], ["#D9852E", 1], ["#E3C58A", 1.5], ["#5A7A3A", 1]];

const shop = gen({
  scale: { w: 48, ppcm: 10, c: "#D8D4CC", t: "1,25 kg", edge: 0.3, d: ({ c, t }) => ({
    sh: [...O(rrect(-18, -11, 36, 11, 3), c), S(rrect(-12, -8, 12, 3, 1.4), tone(c, "shade")), ...[0, 1, 2, 3].map(i => F(ellipse(3 + i * 3.6, -4.6, 0.9), "#8E959C", 0.9)), ...O(rrect(5, -33, 15, 22, 2.4), c), S(rrect(6.4, -31, 12.2, 8, 1.2), "#14201A"), S(rrect(6.4, -21, 12.2, 5, 1), "#14201A"), F(ellipse(12.5, -13.4, 0.7), "#E4572E"),
      ...O(ellipse(-4, -14.6, 14, 2.8), STEEL, 0.25), S(ellipse(-4, -15.4, 11.6, 1.6), tone(STEEL, "shade"))],
    gl: [F(rrect(6.4, -31, 12.2, 8, 1.2), "#7FF5C8", 0.75), F(rrect(6.4, -21, 12.2, 5, 1), "#FFD27A", 0.6)], tx: tx(t, 6.6, -30.6, 11.8, 7.2, { font: "screen", color: "#9FF0C8", lit: 0 }) }), hold: { k: 0.9 } },
  basket: { w: 56, ppcm: 8, c: "#D9534A", hold: { g: [0, -46] }, d: ({ c }) => { const o = rrect(-21, -28, 42, 28, [3, 3, 6, 6]); return { sh: [R([[-23, -30], [-21, -43], [-3, -46]], DARK, 2.2), R([[23, -30], [21, -43], [3, -46]], DARK, 2.2), ...O(o, c, 0.22), mesh(o, tone(c, "deep"), 4.4), ...O(rrect(-24, -31, 48, 4.4, 2.2), tone(c, "shade"), 0.2), S(rrect(-5, -48.4, 10, 4, 2), DARK)] }; } },
  sack: { w: 58, ppcm: 8, c: "#B88A55", hold: { k: 0.55 }, d: ({ c, r }) => {
    const [bc, bs] = r.pick(BEANS), o = smooth([[-21, -3], [-24, -28], [-20, -50], [-15, -58, 0], [15, -58, 0], [20, -50], [24, -28], [21, -3], [0, 0]], true, 1), top = Array.from({ length: 34 }, () => { const x = r.range(-14, 14); return [x, -57 - (1 - (x / 15) ** 2) * r.range(0, 11)] as Vec2; });
    return { sh: [...O(smooth([[-15, -56], [-9, -66], [0, -70], [9, -66], [15, -56]], true, 1), bc, 0.2), dots(top, bs, tone(bc, "light"), 0.7), dots(top.map(([x, y]) => [x + 1.4, y + 1] as Vec2), bs * 0.8, tone(bc, "deep"), 0.45), S(o, c), ...lit(o, c, 0.22), F(rect(-25, -30, 50, 5), "#B5412F", 0.75, o), L([[-22, -14], [-21, -48]], tone(c, "deep"), 0.4, 0.7), ...O(rrect(-18, -62, 36, 7, 3.4), tone(c, "light"), 0.2), lines([[[-14, -58], [14, -58]]], tone(c, "deep"), 0.4, 0.6)] };
  } },
  card_reader: { w: 18, ppcm: 14, c: "#3A3D45", t: "85,50 TL", edge: 0.2, d: ({ c, t }) => ({
    sh: [...O(rrect(-3.3, -26, 6.6, 12, 1), "#E4572E", 0.2), F(rect(-2, -24, 4, 1.6), BRASS, 0.9), ...O(rrect(-4.6, -17, 9.2, 17, 1.6), c, 0.2), S(rrect(-3.6, -16, 7.2, 4.4, 0.6), "#0E2A22"), ...[0, 1, 2, 3].flatMap(j => [0, 1, 2].map(i => F(rrect(-3.4 + i * 2.4, -10.8 + j * 2.4, 2, 1.5, 0.4), j === 3 ? ["#C8283A", "#F2C230", "#3E8E4E"][i] : "#9AA0A6", 0.95))), S(rrect(-3.8, -17.6, 7.6, 1, 0.5), "#14171B")],
    gl: [F(rrect(-3.6, -16, 7.2, 4.4, 0.6), "#7FF5C8", 0.75)], tx: tx(t, -3.4, -15.8, 6.8, 4, { font: "screen", color: "#9FF0C8", lit: 0 }) }), hold: { k: 1 } },
  cash_box: { w: 46, ppcm: 10, c: "#5F7F6B", hold: { g: [0, -37.5] }, edge: 0.3, d: ({ c }) => ({
    sh: [...O(poly([[-17, -13], [17, -13], [15, -31], [-15, -31]]), tone(c, "shade"), 0.2), F(poly([[-14, -14], [14, -14], [12.6, -29], [-12.6, -29]]), tone(c, "deep"), 0.45), ...bill(-5, -18, -0.15, "#8FBF7A"), ...bill(5, -19, 0.2, "#E6B25A"), ...bill(0, -21, 0.02, "#7FB2D9"), dots([[11, -15], [14, -15], [12.6, -17.5], [-13, -15.4], [-10, -15.6]], 1.6, BRASS, 1, { flat: false }),
      ...O(rrect(-18.5, -14, 37, 14, 1.5), c, 0.2), S(rrect(-2.4, -11, 4.8, 5, 1.2), BRASS), F(ellipse(0, -8.5, 0.8), DARK, 0.8), R([[-7, -31], [-6, -37], [6, -37], [7, -31]], DARK, 1.8), S(rrect(-3.4, -39, 6.8, 3, 1.4), DARK)] }) },
  receipt_roll: { w: 14, ppcm: 16, c: "#F6F3EA", hold: { g: [0, -3] }, edge: 0.25, d: ({ c }) => ({
    sh: [...O(rrect(-4.2, -6.4, 8.4, 6.4, 0.9), c, 0.22), S(ellipse(0, -6.4, 4.2, 1.5), tone(c, "light")), F(ellipse(-2.8, -6.5, 0.8, 0.38), DARK, 0.7),
      S(poly([[-1.4, -6.2], [-0.7, -12], [0.5, -17.4], [1.5, -18.8], [2.7, -17.4], [3.9, -18.8], [5.1, -17.4], [6.3, -18.8], [6.1, -12], [3.4, -6.2]]), WHITE),
      lines([[[-0.4, -8], [3, -8]], [[-0.2, -9.6], [4.4, -9.6]], [[0.2, -11.4], [4.8, -11.4]], [[0.4, -13.6], [3.4, -13.6]], [[0.9, -15.8], [5.2, -15.8]]], INK, 0.4, 0.6)] }) },
  peel: { w: 44, ppcm: 6, c: "#C9A06A", hold: { k: 0.5, g: [0, -92] }, d: ({ c }) => ({
    sh: [...O(rrect(-2.6, -202, 5.2, 170, 2), tone(c, "deep"), 0.3), S(ellipse(0, -197, 1.2), tone(c, "shade")), ...O(rrect(-20, -48, 40, 48, [8, 8, 17, 17]), c, 0.2), F(poly([[-20, -48], [20, -48], [18, -39], [-18, -39]]), tone(c, "light"), 0.45), lines([[[-8, -30], [-8, -4]], [[0, -32], [0, -2]], [[8, -30], [8, -4]]], tone(c, "deep"), 0.4, 0.5),
      ...O(ellipse(0, -20, 12.5, 7.4), "#D9A05B", 0.25), lines([[[-6, -24], [-3, -17]], [[0, -25], [3, -17]], [[6, -24], [9, -18]]], "#9C6A2E", 0.5, 0.7)] }) },
  bread_basket: { w: 58, ppcm: 8, c: "#B98A57", hold: { g: [0, -44] }, d: ({ c }) => { const o = smooth([[-25, -26], [-23, -8], [-14, 0, 0], [14, 0, 0], [23, -8], [25, -26]], true, 1);
    return { sh: [R([[-24, -26], [-21, -44], [21, -44], [24, -26]], tone(c, "deep"), 2), ...O(P([[-21, -33], [-6, -39], [8, -41], [20, -34], [10, -28], [-10, -28]], "#D9A05B").path, "#D9A05B", 0.2), ...O(ellipse(-9, -31, 11, 6.4), "#E0AE66", 0.2), lines([[[-14, -35], [-12, -28]], [[-9, -36], [-7, -28]], [[-4, -35], [-2, -28]]], "#9C6A2E", 0.5, 0.7), ...O(P([[8, -26], [10, -32], [22, -40], [25, -36], [14, -26]], "#D9A05B").path, "#D9A05B", 0.2),
      S(o, c), ...lit(o, c, 0.2), mesh(o, tone(c, "deep"), 4, 0.5), lines([[[-24, -17], [24, -17]], [[-22, -9], [22, -9]]], tone(c, "deep"), 0.5, 0.5), ...O(P([[-26, -24, 0], [26, -24, 0], [29, -17], [-29, -17]], "#EDE5D2").path, "#EDE5D2", 0.2),] }; } },
  crate: { w: 54, h: 33, cols: 3, ppcm: 8, c: "#B98A57", hold: { k: 0.7 }, edge: 0.3, d: ({ c }) => ({
    sh: [S(rect(-24, -32, 48, 32), "#4A3220"), ...[0, 1, 2].flatMap(i => K(-24, -31 + i * 10.4, 48, 8.6, i === 1 ? tone(c, "light") : c, 0.8, 0.12)), ...K(-24, -32, 5.4, 32, tone(c, "shade"), 0.8, 0.2), ...K(18.6, -32, 5.4, 32, tone(c, "shade"), 0.8, 0.2), dots([[-21.3, -27], [-21.3, -6], [21.3, -27], [21.3, -6]], 0.6, "#6A7078", 0.9), lines([[[-15, -26], [-4, -27]], [[6, -16], [16, -15]]], tone(c, "deep"), 0.4, 0.5)] }) },
  cart: { w: 112, ppcm: 5, c: "#D9342B", hold: { k: 0.4, g: [-48, -96] }, d: ({ c }) => { const o = poly([[-46, -98], [42, -98], [36, -52], [-40, -52]]);
    return { sh: [...wh(-30, -8, 6.5), ...wh(32, -8, 6.5), R([[-40, -52], [-32, -14]], "#8E959C", 1.8), R([[36, -52], [32, -14]], "#8E959C", 1.8), ...O(rrect(-36, -26, 70, 3.4, 1.2), STEEL), F(o, STEEL, 0.28), mesh(o, "#8E959C", 6, 0.8), { path: o, stroke: { color: "#8E959C", width: 1.6 } }, ...O(rrect(-46, -87, 16, 4, 1.4), tone(c, "deep"), 0.2), R([[-46, -98], [-52, -102]], "#8E959C", 2), ...O(rrect(-60, -105, 20, 5.4, 2.7), c, 0.2), R([[-40, -52], [40, -52]], "#8E959C", 2), R([[-46, -98], [42, -98]], "#8E959C", 2.2)] }; } },
  mannequin: { w: 52, ppcm: 5, c: "#E9E1D4", hold: { k: 0.35 }, d: ({ c }) => { const o = smooth([[-4, -142, 0], [-17, -138], [-20, -128], [-15, -112], [-14, -100], [-17, -84], [-16, -76, 0], [16, -76, 0], [17, -84], [14, -100], [15, -112], [20, -128], [17, -138], [4, -142, 0]], true, 1);
    return { sh: [...O(ellipse(0, -4, 19, 4.4), DARK, 0.2), R([[0, -76], [0, -6]], STEEL, 2.8), S(ellipse(0, -76, 16, 2.4), tone(c, "shade")), S(o, c), ...lit(o, c, 0.22), S(rrect(-4.4, -152, 8.8, 14, 2.4), c), S(ellipse(0, -152, 4.6, 1.4), tone(c, "shade")), F(ellipse(0, -122, 9, 4), tone(c, "light"), 0.35, o), L([[0, -142], [0, -80]], tone(c, "deep"), 0.4, 0.3),
      R([[-18, -134], [-7, -127], [0, -115], [9, -108]], "#F2C230", 3), { path: smooth([[-18, -134], [-7, -127], [0, -115], [9, -108]], false, 1), stroke: { color: INK, width: 3, dash: [0.35, 1.6] }, flat: true, opacity: 0.55 }] }; } },
  a_board: { w: 70, ppcm: 6, c: "#2B3A3A", t: "AÇIĞIZ", hold: { k: 0.35 }, d: ({ c, t }) => ({
    sh: [...K(-28, -98, 56, 4, tone(WOOD, "shade"), 1), ...K(-29, -96, 58, 96, WOOD, 2), S(rrect(-24.4, -91, 48.8, 78, 1), c), { path: rrect(-22, -88.6, 44, 73.2, 1.4), stroke: { color: "#F2F0E6", width: 0.5 }, flat: true, opacity: 0.6 }, S(rrect(-31, -4, 7, 4, 1), tone(WOOD, "deep")), S(rrect(24, -4, 7, 4, 1), tone(WOOD, "deep")),
      lines([[[-8, -34], [-8, -40], [8, -40], [8, -34]], [[-8, -34], [-6, -26], [6, -26], [8, -34]], [[8, -37], [12, -37], [12, -31], [8, -30]], [[-3, -45], [-2, -42]], [[2, -45], [3, -42]], [[-14, -22], [14, -22]]], "#F2F0E6", 0.7, 0.8)],
    tx: tx(t, -21, -86, 42, 34, { font: "hand", color: "#F2F0E6", weight: 700 }) }) },
  scanner: { w: 20, ppcm: 16, c: "#2E2F35", edge: 0.2, hold: { g: [1.5, -5] }, d: ({ c }) => ({
    sh: [...O(rrect(-9, -18, 18, 8.4, 2.6), c, 0.2), ...O(P([[-2, -10, 0], [3.4, -10, 0], [5, -0.6, 0], [-0.6, 0, 0]], c).path, c, 0.25), S(rrect(-9.6, -17, 2, 6.4, 0.6), "#3A0F10"), S(rrect(-5, -9.4, 2, 4.4, 1), tone(c, "deep")), F(ellipse(3.6, -15, 0.9), "#4CD964"), F(rect(-4, -17, 9, 1.4), "#FFFFFF", 0.3)],
    gl: [F(rrect(-9.6, -17, 2, 6.4, 0.6), "#FF3B30", 0.85)] }) },
  stand: { w: 156, ppcm: 3.5, c: "#2F7F86", t: "STANT", hold: { k: 0.2 }, d: ({ c, t, r }) => ({
    sh: [S(rect(-74, -4, 148, 4), "#5A6068"), ...K(-66, -200, 132, 112, c, 2), ...K(-66, -226, 132, 28, tone(c, "deep"), 3), S(rrect(-34, -190, 68, 38, 2), "#14201A"), F(rrect(-32, -188, 64, 34, 1.4), "#7FB2D9", 0.9), F(poly([[-32, -154], [-8, -176], [10, -162], [32, -176], [32, -154]]), "#4E8A3A", 0.9, rrect(-32, -188, 64, 34, 1.4)),
      ...K(-60, -92, 120, 88, "#F4F0E6", 2), F(rect(-60, -48, 120, 8), c, 0.9), S(rrect(-64, -98, 128, 7, 2), WOOD), ...[-48, -26, 0, 26, 46].flatMap((x, i) => K(x - 9, -98 - 12 - (i % 2) * 3, 18, 14 + (i % 2) * 3, r.pick(["#E4572E", "#F2C230", "#3E8E4E", "#4F9ED9", "#E58FA0"]), 1)), ...O(smooth([[-58, -98], [-56, -112], [-48, -122], [-40, -112], [-38, -98]], true, 1), LEAF, 0.2)],
    tx: tx(t, -62, -224, 124, 24, { color: "#FFF3D6", weight: 800 }) }) },
  parcel: { w: 50, h: 28, cols: 3, ppcm: 10, c: "#C79A63", t: "KARGO", hold: { k: 0.9 }, d: ({ c, t }) => { const o = rrect(-20, -27, 40, 27, 1.6);
    return { sh: [S(o, c), ...lit(o, c, 0.2), F(rect(-20, -21, 40, 1), tone(c, "shade"), 0.7, o), F(rect(-3.6, -27, 7.2, 27), "#DCC590", 0.9, o), F(rect(-3.6, -27, 1.2, 27), WHITE, 0.3, o), S(rrect(-16, -23, 21, 15, 0.8), WHITE), lines([[[-14.6, -10.4], [3.6, -10.4]]], INK, 0.5, 0.55), lines(Array.from({ length: 9 }, (_, i) => [[-14.4 + i * 1.9, -17.4], [-14.4 + i * 1.9, -12.6]] as Vec2[]), INK, 0.6, 0.8), F(poly([[11, -17], [16, -17], [13.5, -22]]), "#C8283A", 0.9, o)],
      tx: tx(t, -14.6, -22.4, 18.2, 4.4, { color: INK, weight: 800 }) }; } },
  hang_tag: { w: 18, ppcm: 16, c: "#F2C230", t: "49,90 TL", edge: 0.25, hold: { g: [0, -24] }, d: ({ c, t }) => ({
    sh: [R([[0, -17], [-3.4, -22], [0, -28], [3.4, -22], [0, -17]], "#8E959C", 0.5), ...O(smooth([[-5.4, -2, 0], [5.4, -2, 0], [5.4, -14, 0], [2.8, -18, 0], [-2.8, -18, 0], [-5.4, -14, 0]], true, 1), c, 0.2), S(ellipse(0, -15.2, 0.9), "#8E959C"), F(ellipse(0, -15.2, 0.4), DARK, 0.6), F(rrect(-4.2, -12.4, 8.4, 6.6, 0.5), WHITE, 0.92), lines(Array.from({ length: 8 }, (_, i) => [[-3.6 + i, -4.6], [-3.6 + i, -3.2]] as Vec2[]), INK, 0.35, 0.7)],
    tx: tx(t, -4, -12.2, 8, 6.2, { color: INK, weight: 800 }) }) },
}, { about: "Shop kit: a weighing scale, a hand basket, an open jute sack, a card reader, a cash box, a receipt roll, a bakery peel, a bread basket, a wooden crate, a supermarket cart, a shop mannequin, a chalk A-board, a barcode scanner, a display stand, a taped parcel or a clothes hang tag with its price.", terms: ["a1-w-kredi-karti", "a2-w-kurek", "a1-w-market", "a2-w-butik", "a2-w-stant", "a1-w-paket", "b1-w-kargo", "a1-w-fiyat", "a2-w-manken"], tags: ["shop"], ta: "the words on it (the scale's or card reader's display, the A-board's chalk, the stand's header, the parcel's label, the hang tag's price); each kind has its own default or none" });

// ---- travel kit ----------------------------------------------------------------------------------

const travel = gen({
  luggage_tag: { w: 14, ppcm: 16, c: "#C8283A", t: "İSTANBUL", edge: 0.25, hold: { g: [0, -26] }, d: ({ c, t }) => ({
    sh: [R([[0, -13], [-3.2, -19], [0, -26], [3.2, -19], [0, -13]], tone(c, "deep"), 1.1), ...O(rrect(-5.2, -15, 10.4, 15, [4, 4, 1.4, 1.4]), c, 0.2), S(ellipse(0, -12.6, 1), tone(c, "deep")), F(ellipse(0, -12.6, 0.5), DARK, 0.5), S(rrect(-4, -10, 8, 8, 0.6), WHITE), lines([[[-3, -3.4], [3, -3.4]]], INK, 0.3, 0.5)],
    tx: tx(t, -3.8, -9.6, 7.6, 5.4, { color: INK, weight: 700 }) }) },
  neck_pillow: { w: 40, ppcm: 12, c: "#4F6E9E", hold: { k: 1 }, d: ({ c }) => { const o = smooth([[-16, -24], [-18, -12], [-10, -2], [0, 0], [10, -2], [18, -12], [16, -24], [12, -27.5], [7, -24], [8, -14], [0, -9], [-8, -14], [-7, -24], [-12, -27.5]], true, 1);
    return { sh: [S(o, c), ...lit(o, c, 0.2), { path: smooth([[-12, -24], [-13, -12], [-6, -5], [0, -4], [6, -5], [13, -12], [12, -24]], false, 1), stroke: { color: tone(c, "deep"), width: 0.4, dash: [1, 0.8] }, flat: true, opacity: 0.8 }, F(ellipse(-12.2, -18, 1.4, 5), tone(c, "light"), 0.4, o), S(ellipse(-9.6, -25, 1.2), STEEL), S(ellipse(9.6, -25, 1.2), STEEL)] }; } },
  adapter: { w: 10, s: 0.7, ppcm: 16, c: "#F4F1EA", edge: 0.25, hold: { k: 1 }, d: ({ c }) => ({
    sh: [R([[-2.4, -10], [-2.4, -15.4]], STEEL, 1.3), S(rrect(0.8, -14.8, 2.8, 5.4, 0.4), STEEL), S(rrect(-0.3, -13, 0.7, 3.4, 0.3), tone(STEEL, "shade")), ...O(rrect(-5, -10, 10, 10, 1.6), c, 0.2), lines([[[-4, -3.6], [4, -3.6]], [[-4, -5.6], [4, -5.6]], [[-4, -7.6], [4, -7.6]]], tone(c, "deep"), 0.35, 0.6), F(rect(-5, -2, 10, 2), tone(c, "shade"), 0.6), ...O(rrect(-6.4, -8, 2.2, 4.8, 0.9), "#2F6DB5"), S(ellipse(3, -1.4, 0.5), tone(c, "deep"))] }) },
  compass: { w: 9, s: 0.7, ppcm: 16, c: BRASS, edge: 0.25, hold: { k: 1 }, d: ({ c }) => { const a = -0.7, ux = Math.cos(a), uy = Math.sin(a), nx = -uy * 0.8, ny = ux * 0.8, tp: Vec2 = [ux * 3, -5.2 + uy * 3], tl: Vec2 = [-ux * 3, -5.2 - uy * 3];
    return { sh: [{ path: ellipse(0, -11.4, 1.2), stroke: { color: c, width: 0.6 } }, S(rrect(-0.8, -10.8, 1.6, 1.6, 0.4), c), ...O(ellipse(0, -5.2, 5.2), c, 0.25), S(ellipse(0, -5.2, 4.2), CREAM), lines(Array.from({ length: 12 }, (_, i) => [[Math.sin(i * 0.5236) * 3.5, -5.2 - Math.cos(i * 0.5236) * 3.5], [Math.sin(i * 0.5236) * 4, -5.2 - Math.cos(i * 0.5236) * 4]] as Vec2[]), INK, 0.3, 0.7), F(poly([[0, -9.4], [0.7, -8.4], [-0.7, -8.4]]), "#C8283A"), S(poly([tp, [nx, -5.2 + ny], [-nx, -5.2 - ny]]), "#C8283A"), S(poly([tl, [nx, -5.2 + ny], [-nx, -5.2 - ny]]), WHITE), F(ellipse(0, -5.2, 0.6), DARK), F(ellipse(-1.8, -8, 1.4, 0.7), WHITE, 0.5)] }; } },
  passport_holder: { w: 20, ppcm: 14, c: "#B9835A", edge: 0.25, hold: { k: 1 }, d: ({ c }) => ({
    sh: [...O(rrect(0.6, -19, 6.2, 11, 0.5), WHITE, 0.2), lines(Array.from({ length: 7 }, (_, i) => [[1.4 + i * 0.8, -12.4], [1.4 + i * 0.8, -9.8]] as Vec2[]), INK, 0.35, 0.7), ...O(rrect(-5.4, -18, 10.2, 13.6, 0.8), "#7A1F35", 0.2), F(ellipse(-0.3, -13, 2.6), BRASS, 0.9), F(ellipse(-0.3, -13, 1.6), "#7A1F35", 1), F(ellipse(0.3, -13, 1.3), BRASS, 0.9), F(rect(-3.8, -8.4, 7, 0.5), BRASS, 0.8),
      ...O(rrect(-6.6, -10, 13.2, 10, 1.4), c, 0.2), { path: rrect(-5.8, -9.2, 11.6, 8.4, 0.9), stroke: { color: tone(c, "deep"), width: 0.3, dash: [0.7, 0.5] }, flat: true, opacity: 0.8 }, F(rect(3.6, -10, 1, 10), DARK, 0.6)] }) },
  flask: { w: 14, ppcm: 16, c: "#2F6DB5", edge: 0.3, hold: { g: [0, -31] }, d: ({ c }) => ({
    sh: [R([[-2.8, -24], [-3, -31], [3, -31], [2.8, -24]], DARK, 1), ...O(rrect(-3.6, -27, 7.2, 4.4, 1.4), DARK, 0.25), ...O(rrect(-4.5, -24, 9, 24, [3.4, 3.4, 2.2, 2.2]), c, 0.24), F(rect(-4.5, -15, 9, 2.6), tone(c, "deep"), 0.6), F(rect(-4.5, -6, 9, 1), tone(c, "light"), 0.5), F(ellipse(-2.4, -16, 0.7, 5), WHITE, 0.3), S(rrect(-4.8, -2.2, 9.6, 2.2, 1), STEEL)] }) },
}, { about: "Travel kit: a luggage tag with a label, a U-shaped neck pillow, a travel plug adapter, a brass compass, a passport holder with its passport and boarding pass, or a water flask.", terms: ["a1-w-bavul", "a1-w-seyahat", "a2-w-valiz", "a2-w-pasaport", "a2-w-bagaj", "a1-w-yastik", "b1-w-priz"], tags: ["travel"], ta: "the words on the luggage tag's label (default İSTANBUL)" });

export const set: Record<string, PieceDef> = { vendor, street_kit: street };
export const props: Record<string, PieceDef> = { vendor, street_kit: street, shop_kit: shop, travel_kit: travel };
