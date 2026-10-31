// Props of the produce family (STYLE.md): fruit, vegetables, nuts and pantry goods. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip (the fist covers about 8 cm above it): a thing
// that sits on the hand is lifted, a bunch that hangs (grapes, bananas) hangs below it. Words are `text` on the first flat, never
// letters in the art.

import { ellipse, rect, rrect, smooth, poly, band, tone, mul, rotate, rotateAbout, translate, scale, groupBounds, type Affine, type FlatSpec, type Path, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, num, str, hex, holed, type Pt } from "./draw.ts";

type Prm = Record<string, unknown>;
const PI = Math.PI, WHITE = "#FFFFFF", LEAF = "#4E8A3A", WOOD = "#6B4A35", CREAM = "#F4EFE4", INK = "#2B2420";
/** Colours a story names in Turkish. */
const TR: Record<string, string> = { kırmızı: "#C8283A", yeşil: "#6BA03E", sarı: "#F2C230", mor: "#6B3A7A", turuncu: "#EE8A2E", beyaz: "#F4EFE4", kahverengi: "#8A5A3C", siyah: "#2A2B30", pembe: "#E58FA0", mavi: "#2E6FB6" };

// ---- helpers (no params read here) ---------------------------------------------------------------

const col = (v: unknown, d: string) => typeof v === "string" && TR[v] || hex(v, d);
const cnt = (v: unknown, d = 1) => Math.max(1, Math.min(24, Math.round(num(v, d))));
/** Shapes moved by an affine, their clips (and a tile's origin) with them. */
const mv = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({
  ...s, path: s.path.transform(m),
  ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}),
  ...(s.tile ? { tile: { ...s.tile, x: (s.tile.x ?? 0) + m[4], y: (s.tile.y ?? 0) + m[5] } } : {}),
}));
const at = (sh: Shape[], x: number, y = 0) => mv(sh, translate(x, y));
const turn = (sh: Shape[], a: number, x = 0, y = 0) => mv(sh, rotateAbout(a, x, y));
/** Paint printed on the paper (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A printed line. */
const ln = (pts: Vec2[], c: string, w = 0.3, op = 0.6, clip?: Path): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a stem, a stalk. */
const R = (pts: Vec2[], c: string, w: number): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w, cap: "round", join: "round" } });
/** A closed outline symmetric about x = 0, from its right side given bottom to top. */
const sym = (pts: Pt[]) => smooth([...pts, ...pts.slice().reverse().filter(q => Math.abs(q[0]) > 1e-6).map(q => (q.length === 3 ? [-q[0], q[1], 0] : [-q[0], q[1]]) as Pt)], true, 1);
/** Light from the upper left on an outline `o` that fits the ellipse (cx, cy, rx, ry): a shade crescent below right, a glint above left. */
const bulb = (o: Path, c: string, cx: number, cy: number, rx: number, ry: number, k = 0.2): Shape[] => [
  { path: holed(ellipse(cx, cy, rx + 3, ry + 3), [ellipse(cx - rx * k, cy - ry * k * 0.9, rx * 1.02, ry * 1.02)]), fill: tone(c, "shade"), evenodd: true, flat: true, opacity: 0.55, clip: o },
  F(ellipse(cx - rx * 0.42, cy - ry * 0.42, rx * 0.2, ry * 0.12), WHITE, 0.5)];
/** A round thing. */
const ball = (cx: number, cy: number, rx: number, ry: number, c: string): Shape[] => { const o = ellipse(cx, cy, rx, ry); return [S(o, c), ...bulb(o, c, cx, cy, rx, ry)]; };
/** Lines from pole to pole round a lying oval (a melon's ribs, stripes): `ths` are how far round each runs. */
const merid = (cy: number, rx: number, ry: number, ths: number[], c: string, w: number, op: number, clip: Path): Shape[] =>
  ths.map(t => ln(Array.from({ length: 7 }, (_, k) => [rx * Math.cos(PI * k / 6), cy - ry * Math.sin(t) * Math.sin(PI * k / 6)] as Vec2), c, w, op, clip));
/** A leaf pointing up from the origin, `len` long and `wid` wide. */
const leaf = (len: number, wid: number) => sym([[0, 0, 0], [wid * 0.5, -len * 0.2], [wid * 0.5, -len * 0.6], [wid * 0.2, -len * 0.92], [0, -len, 0]]);
/** Dots as one flat shape. */
const dots = (pts: Vec2[], rx: number, ry: number, c: string, op = 1, clip?: Path): Shape => { const p = ellipse(pts[0][0], pts[0][1], rx, ry); for (const [x, y] of pts.slice(1)) p.add(ellipse(x, y, rx, ry)); return F(p, c, op, clip); };

/** Places for `n` things: a row `sx` apart, or (`sy` given) a pile, top row first so the front row overlaps it. */
const plan = (n: number, sx: number, sy?: number): Vec2[] => {
  if (!sy) return Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * sx, 0] as Vec2);
  let m = 1; while (m * (m + 1) / 2 < n) m++;
  const rows: Vec2[][] = [];
  for (let i = 0, y = 0; i < n; y++) { const k = Math.min(m - y, n - i); rows.push(Array.from({ length: k }, (_, j) => [(j - (k - 1) / 2) * sx, -y * sy] as Vec2)); i += k; }
  return rows.reverse().flat();
};
/** Held, turned to hang from (cx, cy) (a stalk, a crown), or to stand up out of the fist from it. */
const hang = (cx: number, cy: number) => (sh: Shape[]) => mv(sh, mul(translate(-cx, -cy), rotateAbout(PI / 2, cx, cy)));
const up = (cx: number, cy: number) => (sh: Shape[]) => mv(sh, mul(translate(-cx, -cy), rotateAbout(-PI / 2, cx, cy)));
/** A prop of one flat, its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.3): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(ppcm, 16, 2000 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}

/** One kind: how far apart the things stand (`w`), a pile when `sy` is given, how many one drawing covers (`per`), its colour, resolution, rim, how it is held. */
interface K {
  w: number; sy?: number; per?: number; c: string; pp: number; ed?: number;
  /** Held: lifted this high (a negative number hangs below the grip). */
  g: number; hn?: number; s?: number; n0?: number;
  /** Held: moved this far right (a handle off the middle). */
  hx?: number;
  /** Held: how one thing is turned first (stood upright, hung by its stalk). */
  hold?: (sh: Shape[]) => Shape[];
  /** `k` things of this drawing (fewer than `per` for the last); `i` its place in the row or pile. */
  draw(c: string, r: Rng, i: number, k: number, held: boolean): Shape[];
  /** Pantry: the label's box in the pack (cm from its bottom centre) and its default words. */
  lab?: { x: number; y: number; w: number; h: number; t: string; size?: number; color?: string };
}
function build(id: string, ks: Record<string, K>, p: Prm, r: Rng): PieceOut {
  const names = Object.keys(ks), kd = ks[str(p.kind, names[0])] ?? ks[names[0]], held = !!p.held, c = col(p.color, kd.c), per = kd.per ?? 1;
  const n = Math.min(cnt(p.n, kd.n0 ?? 1), held ? kd.hn ?? 1 : 24), pos = plan(Math.ceil(n / per), kd.w, kd.sy).map(([x, y]) => [x + (held ? kd.hx ?? 0 : 0), y] as Vec2);
  const m = held ? mul(translate(0, -kd.g), scale(kd.s ?? 1)) : translate(0, 0), text: TextSpec[] = [];
  const sh = mv(pos.flatMap(([x, y], i) => { const d = kd.draw(c, r, i, Math.min(per, n - i * per), held); return at(held && kd.hold ? kd.hold(d) : d, x, y); }), m);
  if (kd.lab) {
    const w = p.label, b = kd.lab, words = Array.isArray(w) ? w.map(String) : typeof w === "string" || typeof w === "number" ? [String(w)] : b.t.split("|");
    pos.forEach(([x, y], i) => { const t = words[i % words.length]; if (t.trim()) text.push({ text: t, x: (x + b.x) * m[0] + m[4], y: (y + b.y) * m[3] + m[5], w: b.w * m[0], h: b.h * m[3], size: b.size, color: b.color ?? INK, font: "print", align: "center" }); });
  }
  return one(id, sh, kd.pp, held, text.length ? { text } : {}, kd.ed);
}

// ---- fruit ----------------------------------------------------------------------------------------

const apple = (c: string): Shape[] => {
  const o = smooth([[0, -6.6, 0], [2.4, -7.5], [4.1, -5.6], [4.3, -3], [3, -0.9], [1.2, -0.1], [0, -0.5, 0], [-1.2, -0.1], [-3, -0.9], [-4.3, -3], [-4.1, -5.6], [-2.4, -7.5]], true, 1);
  return [R([[0, -6.4], [0.3, -8], [0.9, -9]], WOOD, 0.5), S(o, c), ...bulb(o, c, 0, -3.8, 4.3, 3.8), F(ellipse(-1.5, -4.2, 1.2, 2.4), tone(c, "light"), 0.3, o), P([[0.5, -7.9, 0], [1.9, -9.1], [3.4, -8.5], [2, -7.6]], LEAF)];
};
const orange = (c: string): Shape[] => [...ball(0, -4, 4.1, 3.9, c), F(ellipse(0, -7.7, 1.1, 0.4), LEAF), R([[0, -7.8], [0.1, -8.6]], "#5A7A32", 0.5), P([[0.2, -7.9, 0], [1.2, -8.8], [2.4, -8.2], [1.1, -7.6]], LEAF)];
const lemon = (c: string): Shape[] => {
  const o = smooth([[-4.5, -2.8, 0], [-3.4, -4.2], [-1.4, -5.3], [1.6, -5.3], [3.5, -4.2], [4.5, -2.8, 0], [3.5, -1.4], [1.6, -0.1], [-1.4, -0.1], [-3.4, -1.4]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -2.7, 4.5, 2.7), dots([[-2, -3.6], [0.4, -4.4], [2.2, -2.6], [-1, -1.4], [1.2, -1]], 0.2, 0.14, tone(c, "deep"), 0.4, o), P([[1, -5.2, 0], [2.2, -6.8], [4, -6.4], [2.6, -5.1]], LEAF)];
};
/** A bunch of grapes: resting, a mound with its twig on top; held, hanging from its stalk (the stalk at the origin). */
const grapes = (c: string, r: Rng, _i: number, _k: number, held: boolean): Shape[] => {
  const rows = held ? [4, 4, 3, 3, 2, 1] : [6, 5, 4, 3, 2], g = 2.5, sh: Shape[] = [], hi: Vec2[] = [];
  rows.forEach((m, j) => { for (let q = 0; q < m; q++) {
    const x = (q - (m - 1) / 2) * g * 0.92 + (held ? 0 : r.range(-0.3, 0.3)), y = held ? 2.6 + j * g * 0.85 : -1.3 - j * g * 0.85;
    sh.push(S(ellipse(x, y, g / 2 + 0.1), r.pick([c, c, tone(c, "shade"), tone(c, "light")]))); hi.push([x - 0.45, y - 0.5]);
  } });
  const top = -1.3 - (rows.length - 1) * g * 0.85;
  return [...(held ? [R([[0, -2], [0.3, 1.8]], "#6B8A3A", 0.7)] : [R([[0.2, top], [0.8, top - 2.2], [2, top - 3.4]], "#6B8A3A", 0.7), P([[1.4, top - 2.2, 0], [3.2, top - 4], [5.2, top - 3.2], [3.2, top - 1.6]], LEAF)]), ...sh.reverse(), dots(hi, 0.4, 0.28, WHITE, 0.55)];
};
const watermelon = (c: string): Shape[] => {
  const o = ellipse(0, -11, 16, 11);
  return [S(o, c), ...merid(-11, 16, 11, [0, 0.55, -0.55, 1.1, -1.1, 1.45, -1.45], tone(c, "deep"), 1.7, 0.7, o), ...bulb(o, c, 0, -11, 16, 11, 0.14), R([[-0.5, -21.6], [-0.4, -23.4]], "#6B8A3A", 1)];
};
const POM = "#B3262E";
const pomegranate = (c: string, _r: Rng, i: number): Shape[] => {
  if (i % 2) {
    const o = ellipse(0, -4.6, 4.7), seeds: Vec2[] = [];
    for (let s = 0; s < 5; s++) for (const [d, a] of [[1.5, -0.3], [1.6, 0.35], [2.6, -0.45], [2.6, 0.05], [2.7, 0.5], [3.5, -0.2], [3.5, 0.3]]) seeds.push([Math.cos((s * 72 - 90) * PI / 180 + a * 0.9) * d, -4.6 + Math.sin((s * 72 - 90) * PI / 180 + a * 0.9) * d]);
    return [S(o, c), F(ellipse(0, -4.6, 4.1), "#F2E3C4"), ...Array.from({ length: 5 }, (_, s) => ln([[0, -4.6], [Math.cos((s * 72 - 54) * PI / 180) * 4.1, -4.6 + Math.sin((s * 72 - 54) * PI / 180) * 4.1]], "#E2CBA0", 0.3, 0.9)), dots(seeds, 0.72, 0.72, "#C41E3A"), dots(seeds.map(([x, y]) => [x - 0.2, y - 0.2] as Vec2), 0.2, 0.2, WHITE, 0.6)];
  }
  const o = smooth([[0, -8.6, 0], [2.9, -8.1], [4.7, -5.4], [4.2, -2.2], [1.8, -0.2], [0, -0.1, 0], [-1.8, -0.2], [-4.2, -2.2], [-4.7, -5.4], [-2.9, -8.1]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -4.4, 4.7, 4.3), F(ellipse(-1.8, -4.8, 0.9, 2.2), tone(c, "light"), 0.3, o), P([[-1.7, -8.4, 0], [-1.8, -10.2, 0], [-0.7, -8.9], [0, -10.4, 0], [0.7, -8.9], [1.8, -10.2, 0], [1.7, -8.4, 0]], tone(c, "deep"))];
};
const cherry = (c: string, _r: Rng, i: number, k: number): Shape[] => {
  const ch = (x: number, tx: number) => [R([[x, -2.2], [(x + tx) / 2, -3.8], [tx, -5.2]], "#5E7A32", 0.35), ...ball(x, -1.2, 1.2, 1.2, c)];
  return [...(k > 1 ? [...ch(-1.4, 0.2), ...ch(1.4, 0.2)] : ch(0, 0.8)), ...(i % 2 ? [] : [P([[0.2, -5, 0], [1.4, -6.2], [2.8, -5.5, 0], [1.4, -4.8]], LEAF)])];
};
/** A banana lying, crown at the left, tip at the right, its belly `d` cm above the floor. */
const banana = (c: string, d: number): Shape[] => {
  const sp: Vec2[] = [[-9.5, -9.5], [-5, -3.6 - d], [1, -1.7 - d], [7, -3 - d], [11, -7.6 - d]], b = band(sp, [1.2, 2.8, 3.4, 3, 1.5]);
  return [S(b, c), ln([[-5, -2.4 - d], [1, -0.6 - d], [7, -1.9 - d]], tone(c, "shade"), 1.1, 0.55, b), ln([[-5.4, -4.7 - d], [0, -3.3 - d], [6, -4.5 - d]], tone(c, "light"), 0.5, 0.7), S(ellipse(11.2, -7.9 - d, 0.9, 0.7), "#4A3A2A")];
};
/** A hand of `k` bananas from one crown, a stack of smiles; held, it hangs from the crown. */
const bananas = (c: string, _r: Rng, _i: number, k: number): Shape[] => [...Array.from({ length: k }, (_, j) => banana(c, (k - 1 - j) * 3)).flat(), S(rrect(-11.8, -12.4, 3.2, 4.6, 1.2), "#7A8A3A")];
const peach = (c: string): Shape[] => {
  const o = smooth([[0, -7.2, 0], [1.9, -7.9], [3.8, -6.2], [4.3, -3.6], [3.2, -1.2], [1.2, -0.1], [0, -0.3, 0], [-1.2, -0.1], [-3.2, -1.2], [-4.3, -3.6], [-3.8, -6.2], [-1.9, -7.9]], true, 1);
  return [R([[0, -7.4], [0.1, -8.6]], WOOD, 0.5), S(o, c), F(ellipse(2.4, -3.2, 3.6, 4.2), "#E0556A", 0.55, o), ...bulb(o, c, 0, -4, 4.3, 4), ln([[0.2, -7.4], [-0.6, -4.5], [0.4, -0.8]], tone(c, "deep"), 0.35, 0.55, o), P([[0.4, -7.7, 0], [1.6, -9], [3.2, -8.4, 0], [1.7, -7.5]], LEAF)];
};
const strawberry = (c: string): Shape[] => {
  const o = smooth([[0, -0.1, 0], [-1.6, -1.3], [-2.2, -3], [-1.5, -4], [0, -3.7, 0], [1.5, -4], [2.2, -3], [1.6, -1.3]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -2.2, 2.2, 2.1), dots([[-1, -3], [0.6, -3.2], [1.5, -2.2], [-1.5, -1.9], [0, -2], [0.9, -1], [-0.6, -0.9], [-0.3, -3.2], [1.3, -3.4]], 0.13, 0.2, "#F6D98E", 0.9, o), P([[0, -3.7, 0], [-1.7, -3.4], [-2.3, -4.4, 0], [-0.7, -4.3], [0, -5.2, 0], [0.7, -4.3], [2.3, -4.4, 0], [1.7, -3.4]], LEAF)];
};
const fig = (c: string): Shape[] => {
  const o = sym([[0, -0.1, 0], [1.6, -0.4], [2.8, -2.3], [2.2, -4.6], [1, -6], [0.5, -6.8, 0]]);
  return [S(o, c), ...bulb(o, c, 0, -3.4, 2.8, 3.4), F(ellipse(-0.9, -3.4, 0.5, 2.2), tone(c, "light"), 0.45, o), R([[0, -6.7], [0.2, -7.7]], "#7A8A3A", 0.5), F(ellipse(0, -0.5, 0.35), "#D9A8C0", 0.9)];
};
const apricot = (c: string): Shape[] => {
  const o = ellipse(0, -2.3, 2.4, 2.25);
  return [S(o, c), F(ellipse(1.5, -1.5, 1.5, 1.5), "#E8782E", 0.4, o), ...bulb(o, c, 0, -2.3, 2.4, 2.25), dots([[-1, -3], [0.6, -3.5], [-1.4, -1.4], [0.9, -0.8]], 0.14, 0.1, tone(c, "deep"), 0.35, o), ln([[0, -4.4], [-0.3, -2.4], [0.2, -0.4]], tone(c, "deep"), 0.2, 0.4, o)];
};
const quince = (c: string): Shape[] => {
  const o = sym([[0, -0.1, 0], [3, -0.8], [4.6, -3.4], [3.8, -5.8], [2.5, -7.6], [1.4, -9], [0, -8.7, 0]]);
  return [S(o, c), F(ellipse(-1.4, -3.4, 1.4, 2.8), tone(c, "light"), 0.35, o), ...bulb(o, c, 0, -4.6, 4.6, 4.5), F(ellipse(0, -8.6, 1.3, 0.5), tone(c, "deep"), 0.7), P([[0.4, -8.7, 0], [1.8, -10], [3.5, -9.4, 0], [1.8, -8.4]], LEAF)];
};
const melon = (c: string): Shape[] => {
  const o = ellipse(0, -8, 11, 8);
  return [S(o, c), ...merid(-8, 11, 8, [0, 0.6, -0.6, 1.2, -1.2], "#B9A24E", 0.5, 0.8, o), ...merid(-8, 11, 8, [0.3, -0.3, 0.9, -0.9], "#D2BF72", 0.3, 0.8, o), ...bulb(o, c, 0, -8, 11, 8, 0.15), R([[0, -15.6], [0.4, -17.2]], "#6B8A3A", 1)];
};
const chestnut = (c: string): Shape[] => {
  const o = smooth([[-2.4, -0.3, 0], [2.4, -0.3, 0], [2.9, -2.4], [2.2, -4.1], [0.9, -5], [0, -5.4, 0], [-0.9, -5], [-2.2, -4.1], [-2.9, -2.4]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -2.9, 2.9, 2.9), ...[-1.6, -0.5, 1.1].map(x => ln([[x * 0.3, -5.3], [x, -3], [x * 0.9, -0.8]], tone(c, "light"), 0.2, 0.45, o)), P([[-2.2, -2.1, 0], [0, -3.4], [2.2, -2.1, 0], [0, -0.9]], "#EBCB78", { flat: true }), F(ellipse(0.3, -2.1, 1, 0.45), "#C9A24A", 0.8), F(ellipse(0, -0.4, 2.3, 0.5), "#2A1A10", 0.5, o)];
};
const walnut = (c: string, _r: Rng, i: number): Shape[] => {
  if (i % 2) return [S(smooth([[-2.4, -2.4, 0], [-2, -1], [0, -0.1], [2, -1], [2.4, -2.4, 0]], true, 1), c), P([[-2.1, -2.5, 0], [-1.8, -4], [-0.6, -4.2], [0, -3.2], [0.7, -4.3], [1.9, -4], [2.1, -2.5, 0]], "#E8CE9A"), ln([[-1.4, -3.6], [-0.8, -3], [-1.3, -2.8]], "#B58B55", 0.25, 0.8), ln([[1.3, -3.6], [0.8, -3], [1.3, -2.8]], "#B58B55", 0.25, 0.8), ln([[0, -3.2], [0, -2.5]], "#B58B55", 0.25, 0.8)];
  const o = smooth([[0, -4.8, 0], [1.1, -4.9], [2.1, -4], [2.6, -2.7], [2.1, -1.3], [1.2, -0.1], [0, -0.2, 0], [-1.2, -0.1], [-2.1, -1.3], [-2.6, -2.7], [-2.1, -4], [-1.1, -4.9]], true, 1), d = tone(c, "deep");
  return [S(o, c), ...bulb(o, c, 0, -2.5, 2.6, 2.5), ...Array.from({ length: 14 }, (_, k) => { const sd = k % 2 ? 1 : -1, x = sd * (0.7 + (k * 0.53) % 1.2), y = -4.1 + (k * 0.97) % 3.6, a = k * 2.3, dx = Math.cos(a) * 0.55, dy = Math.sin(a) * 0.5; return ln([[x - dx, y - dy], [x + dy * 0.6, y - dx * 0.6], [x + dx, y + dy]], d, 0.2, 0.55, o); }), F(ellipse(0, -2.5, 0.22, 2.4), d, 0.7, o), ln([[0, -4.8], [0.1, -2.5], [0, -0.2]], d, 0.25, 0.9)];
};
const hazelnut = (c: string): Shape[] => {
  const o = smooth([[-1.2, -1.4], [-0.9, -2.3], [0, -2.9, 0], [0.9, -2.3], [1.2, -1.4], [0.8, -0.3], [0, -0.1, 0], [-0.8, -0.3]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -1.5, 1.2, 1.4), F(ellipse(0, -0.45, 0.65, 0.35), "#D9B88A", 0.95, o), F(ellipse(0, -2.5, 0.35, 0.5), tone(c, "deep"), 0.8)];
};
const pear = (c: string): Shape[] => {
  const o = sym([[0, -0.1, 0], [3.1, -0.6], [4.4, -2.8], [3.2, -4.8], [1.9, -6.3], [1.4, -8.6], [0.9, -10.4], [0, -10.6, 0]]);
  return [R([[0, -10.4], [0.4, -11.6], [1.2, -12.3]], WOOD, 0.5), S(o, c), ...bulb(o, c, 0, -4.4, 4.4, 4.4), F(ellipse(-1.5, -3.4, 1, 2.3), tone(c, "light"), 0.35, o), dots([[1, -2], [-0.5, -1.2], [2, -4], [-2.5, -5], [0.6, -6.6]], 0.14, 0.1, tone(c, "deep"), 0.4, o), P([[0.6, -10.2, 0], [1.9, -11.5], [3.8, -11], [2.3, -9.9]], LEAF)];
};
const plum = (c: string): Shape[] => {
  const o = ellipse(0, -3, 3, 3.1);
  return [R([[0, -6], [0.2, -7]], WOOD, 0.4), S(o, c), F(ellipse(-0.5, -3.8, 2.2, 1.7), "#C9C2E0", 0.3, o), ...bulb(o, c, 0, -3, 3, 3.1), ln([[0.1, -6], [-0.5, -3], [0.2, -0.1]], tone(c, "deep"), 0.3, 0.6, o)];
};
const BOWL = "#F4EFE4";
const fruitBowl = (c: string, r: Rng): Shape[] => {
  const bowl = smooth([[-14, -9.4, 0], [14, -9.4, 0], [12.6, -4.8], [7.4, -1.2], [4.4, -0.2, 0], [-4.4, -0.2, 0], [-7.4, -1.2], [-12.6, -4.8]], true, 1);
  return [...at(orange("#EE8A2E"), -5.4, -13.2), ...at(peach("#F5A67E"), 4, -14), ...mv(banana("#F2C230", 0), mul(translate(-0.6, -19.4), mul(rotateAbout(0.12, 0, 0), scale(0.7, -0.7)))), ...mv(grapes("#6B3A7A", r, 0, 1, false), mul(translate(-8.6, -7.4), scale(0.6))), ...at(apple("#C8283A"), -0.6, -7.4), ...at(apple("#8DB84A"), 8, -8),
    S(bowl, BOWL), ...bulb(bowl, BOWL, 0, -5, 14, 5, 0.12), F(rect(-14, -9.4, 28, 1.5), c, 0.95, bowl), F(rect(-12, -2.6, 24, 0.7), c, 0.8, bowl), S(rrect(-4.8, -0.9, 9.6, 0.9, 0.4), tone(BOWL, "shade"))];
};

const FRUIT: Record<string, K> = {
  apple: { w: 9, c: "#C8283A", pp: 12, ed: 0.25, g: 6, hn: 1, draw: apple },
  orange: { w: 9, c: "#EE8A2E", pp: 12, ed: 0.25, g: 6, hn: 1, draw: orange },
  lemon: { w: 9, c: "#F2D430", pp: 12, ed: 0.25, g: 6, hn: 1, draw: lemon },
  grapes: { w: 14, c: "#6B3A7A", pp: 10, ed: 0.25, g: 0, hn: 1, draw: grapes },
  watermelon: { w: 34, c: "#5E9A4A", pp: 5, ed: 0.5, g: 8, s: 0.6, hn: 1, draw: watermelon },
  pomegranate: { w: 10.4, c: POM, pp: 12, ed: 0.25, g: 6, hn: 1, draw: pomegranate },
  sour_cherry: { w: 5.4, sy: 3.4, per: 2, c: "#8E1B2E", pp: 14, ed: 0.18, g: 5, hn: 6, n0: 6, draw: cherry },
  banana: { w: 24, c: "#F2C230", pp: 8, ed: 0.3, g: 2, hn: 1, per: 5, n0: 4, hold: hang(-9.5, -9.5), draw: bananas },
  peach: { w: 9.2, c: "#F5A67E", pp: 12, ed: 0.25, g: 6, hn: 1, draw: peach },
  strawberry: { w: 4.2, sy: 3.4, c: "#D92B38", pp: 16, ed: 0.15, g: 5, hn: 4, draw: strawberry },
  fig: { w: 6.2, sy: 4.8, c: "#5A3A5E", pp: 14, ed: 0.2, g: 5, hn: 3, draw: fig },
  apricot: { w: 5.2, sy: 4.2, c: "#F2B33C", pp: 16, ed: 0.15, g: 5, hn: 4, draw: apricot },
  quince: { w: 10.2, c: "#D9B83A", pp: 12, ed: 0.25, g: 6, hn: 1, draw: quince },
  melon: { w: 24, c: "#E7D58A", pp: 7, ed: 0.4, g: 8, s: 0.7, hn: 1, draw: melon },
  chestnut: { w: 4.6, sy: 3.6, c: "#5B351D", pp: 16, ed: 0.15, g: 5, hn: 5, n0: 5, draw: c => mv(chestnut(c), scale(0.82)) },
  walnut: { w: 5, sy: 3.8, c: "#B8864E", pp: 16, ed: 0.15, g: 5, hn: 4, draw: walnut },
  hazelnut: { w: 2.4, sy: 1.9, c: "#A8703A", pp: 16, ed: 0.1, g: 5, hn: 8, n0: 6, draw: c => mv(hazelnut(c), scale(0.85)) },
  fruit_bowl: { w: 31, c: "#2E6FB6", pp: 8, ed: 0.3, g: 8, s: 0.7, hn: 1, draw: fruitBowl },
  pear: { w: 10, c: "#BDC84A", pp: 12, ed: 0.25, g: 6, hn: 1, draw: pear },
  plum: { w: 6.8, sy: 5.2, c: "#4A2A5E", pp: 14, ed: 0.2, g: 5, hn: 3, draw: plum },
};

const fruit: PieceDef = { draw: (p, r) => build("fruit", FRUIT, p, r),
  variants: Object.fromEntries(Object.keys(FRUIT).map(k => [k, { kind: k }])),
  meta: {
    about: "Fruit and nuts: an apple, orange, lemon, bunch of grapes, whole watermelon, pomegranate (whole and split), sour cherries, bananas, peach, strawberry, fig, apricot, quince, melon, roasted chestnut, walnut, hazelnut, a bowl heaped with mixed fruit, a pear or a plum.",
    params: {
      kind: { type: "enum", values: Object.keys(FRUIT), default: "apple" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many: a row of big ones, a pile of small ones; grapes and bowls count bunches and bowls, bananas are in hands of five; cherries (6), bananas (4), chestnuts (5) and hazelnuts (6) start at a handful; held, what a hand carries" },
      color: { type: "color", about: "its colour (a Turkish colour name, a palette id or a hex): a green apple, white grapes; the bowl's band" },
    },
    terms: ["a1-w-elma", "a1-w-portakal", "a1-w-limon", "a1-w-uzum", "a1-w-karpuz", "a1-w-nar", "a1-w-visne", "a2-w-kestane", "a1-w-ceviz", "a1-w-findik", "a1-w-meyve"],
    tags: ["fruit", "food", "market"],
  } };

// ---- vegetables -----------------------------------------------------------------------------------

const potato = (c: string): Shape[] => {
  const o = smooth([[-4, -2.8], [-2.6, -5.4], [1.2, -6], [3.8, -4.6], [4.3, -2.4], [2.6, -0.4], [-1.4, -0.2], [-3.6, -1]], true, 1);
  return [S(o, c), ...bulb(o, c, 0, -3, 4.3, 3), dots([[-1.6, -3.6], [1.8, -2.2], [-0.6, -1.2]], 0.35, 0.22, tone(c, "deep"), 0.8, o), F(ellipse(-1.6, -4.3, 1.2, 0.5), tone(c, "light"), 0.45)];
};
/** A leaf tuft pointing at angle `a` (0 up) from (x, y). */
const tuft = (x: number, y: number, a: number, len: number, wid: number, c: string): Shape[] => turn([S(leaf(len, wid).move(x, y), c)], a, x, y);
const carrot = (c: string): Shape[] => {
  const b = band([[-6, -1.8], [-2, -1.8], [3, -1.5], [7.5, -1.1], [10.5, -0.8]], [3.5, 3.6, 3, 1.9, 0.5]), g = "#4E9A3E";
  return [...tuft(-6, -1.9, -2, 6, 2.2, tone(g, "shade")), ...tuft(-6, -1.9, -1.1, 6.6, 2.2, g), ...tuft(-6, -1.9, -1.57, 7.4, 2.4, tone(g, "light")), S(b, c), ln([[-5.5, -3.1], [0, -3], [5, -2.3]], tone(c, "light"), 0.6, 0.6), ln([[-5.5, -0.6], [0, -0.5], [6, -0.4]], tone(c, "shade"), 0.9, 0.5, b), ...[-2.5, 1, 4.2].map(x => ln([[x, -3.3], [x + 0.3, -0.6]], tone(c, "deep"), 0.3, 0.45, b))];
};
const onion = (c: string): Shape[] => {
  const o = smooth([[0, -8.6, 0], [1.1, -7], [3.4, -5.1], [3.9, -2.9], [2.5, -0.7], [0, -0.1, 0], [-2.5, -0.7], [-3.9, -2.9], [-3.4, -5.1], [-1.1, -7]], true, 1);
  return [R([[0, -8.2], [0.5, -9.2], [1.2, -9.4]], tone(c, "deep"), 0.5), S(o, c), ...bulb(o, c, 0, -3.8, 3.9, 3.8), ln([[0, -8], [-2.5, -4], [-0.8, -0.4]], tone(c, "deep"), 0.3, 0.5, o), ln([[0, -8], [2.3, -4], [0.9, -0.4]], tone(c, "deep"), 0.3, 0.5, o), ln([[0, -8], [-1.2, -4], [-0.1, -0.4]], tone(c, "light"), 0.3, 0.5, o)];
};
const aubergine = (c: string): Shape[] => {
  const o = sym([[0, -0.1, 0], [2.4, -0.4], [3.9, -2.6], [3.9, -5.6], [3.1, -9.6], [2.1, -13], [1.6, -15.2], [0, -15.4, 0]]), g = "#4E7A3A";
  const cap = smooth([[-3.1, -13.2], [-3.4, -11.4, 0], [-1.9, -12.6], [-0.9, -10.8, 0], [0, -12.4], [0.9, -10.8, 0], [1.9, -12.6], [3.4, -11.4, 0], [3.1, -13.2], [2, -15.8], [-2, -15.8]], true, 1);
  return [R([[0, -15.4], [0.5, -17.4], [1.4, -18.4]], "#5A7A32", 1.4), S(o, c), ...bulb(o, c, 0, -7.6, 3.9, 7.6, 0.22), F(ellipse(-1.9, -6.5, 0.6, 3.6), WHITE, 0.3, o), S(cap, g), F(rect(0.6, -16, 3, 5), tone(g, "shade"), 0.5, cap)];
};
const pepper = (c: string): Shape[] => {
  const b = band([[-7.2, -2.5], [-6, -2.3], [-2, -1.9], [3, -1.6], [7, -2.4], [9.8, -4]], [0.6, 3, 3.2, 2.7, 1.5, 0.35]), g = "#3E7A2A";
  return [R([[-6.8, -3.6], [-7.6, -5], [-7, -6.4]], "#4A7A30", 1), S(b, c), ln([[-5, -3.2], [-1, -3], [4, -2.9], [7, -3.5]], tone(c, "light"), 0.6, 0.7), ln([[-4.6, -0.5], [0, -0.3], [5, -0.7]], tone(c, "shade"), 1, 0.5, b), P([[-6.6, -3.6, 0], [-5.4, -4.4], [-4.8, -3.4, 0], [-5, -1.1], [-6.4, -0.7], [-7.4, -1.9, 0]], g)];
};
const cucumber = (c: string): Shape[] => {
  const o = rrect(-9, -4, 18, 4, 2);
  return [S(o, c), F(rect(-9, -1.5, 18, 1.5), tone(c, "shade"), 0.45, o), ln([[-8, -3.2], [8, -3.2]], tone(c, "light"), 0.6, 0.7), ln([[-8, -1.8], [8, -2]], tone(c, "deep"), 0.3, 0.45), dots([[-5, -2.6], [-1, -3.2], [3, -2.2], [6, -3]], 0.18, 0.18, tone(c, "deep"), 0.6, o), S(ellipse(9.1, -2, 0.7, 1), "#7A8A3A"), F(ellipse(-8.4, -2, 0.5, 1), tone(c, "light"), 0.6)];
};
const courgette = (c: string): Shape[] => {
  const o = smooth([[-10.5, -2.3], [-8, -4.6], [0, -4.9], [7, -4.2], [10.2, -3.1], [10.2, -1.4], [7, -0.5], [0, -0.1], [-8, -0.2]], true, 1);
  return [R([[9.6, -3.2], [11.4, -4.6], [12.4, -6]], "#4E7A32", 2.2), S(o, c), F(rect(-11, -1.6, 22, 1.6), tone(c, "shade"), 0.45, o), ln([[-9, -3.6], [0, -3.8], [8, -3.1]], tone(c, "light"), 0.7, 0.7), ...[-3.4, -0.9, 1.8].map(y => ln([[-9, y - 0.6], [0, y], [9, y - 0.4]], tone(c, "light"), 0.25, 0.5, o)), F(ellipse(-9.8, -2.3, 0.6, 1.2), tone(c, "deep"), 0.7)];
};
const bean = (c: string, r: Rng): Shape[] => {
  const b = band([[-6.4, -1], [-4.4, -1.6], [-2.4, -1.9], [-0.4, -2], [1.6, -1.9], [3.6, -1.6], [5.6, -1.1], [7.2, -0.7]], [0.5, 1.9, 2.3, 1.9, 2.3, 1.9, 1.6, 0.3]);
  return turn([R([[7, -0.7], [8.2, -1.5], [8.6, -2.6]], tone(c, "deep"), 0.3), S(b, c), ln([[-5, -2.4], [-1, -2.9], [4, -2.3]], tone(c, "light"), 0.35, 0.7), ln([[-5, -0.5], [0, -0.8], [5, -0.4]], tone(c, "shade"), 0.4, 0.5, b)], r.range(-0.4, 0.4), 0, -1);
};
const spinach = (c: string, r: Rng): Shape[] => {
  const ls = [-0.9, 0.9, -0.62, 0.62, -0.32, 0.32, 0.02].map((a, k) => { const len = 17 + r.range(0, 3) - Math.abs(a) * 3; return turn([R([[0, -1], [0, -len * 0.4]], "#B5CF80", 1), S(leaf(len * 0.82, 9).move(0, -len * 0.18 - 1), [tone(c, "shade"), c, tone(c, "light")][k % 3]), ln([[0, -len * 0.3], [0, -len * 0.9]], "#9CC070", 0.35, 0.8)], a, 0, -1); });
  return [...ls.flat(), S(rrect(-2.6, -5.6, 5.2, 1.5, 0.6), "#C4553A")];
};
const parsley = (c: string, r: Rng): Shape[] => {
  const ls = [-0.95, 0.95, -0.7, 0.7, -0.45, 0.45, -0.2, 0.2, 0].map((a, k) => { const len = 13 + r.range(0, 4) - Math.abs(a) * 3, cl = k % 2 ? c : tone(c, "shade"); return turn([R([[0, -1], [0, -len]], "#7AA85A", 0.6), ...[-0.8, 0, 0.8].flatMap(q => tuft(0, -len, q, 5.2 - Math.abs(q) * 1.5, 3.6, cl)), ...tuft(0, -len, -0.4, 3.6, 2.6, tone(cl, "light")), ...tuft(0, -len, 0.4, 3.6, 2.6, tone(cl, "light"))], a, 0, -1); });
  return [...ls.flat(), S(rrect(-2.1, -5, 4.2, 1.2, 0.5), "#C9A23A")];
};
const corn = (c: string): Shape[] => {
  const o = sym([[0, -2, 0], [2, -3], [2.7, -8], [2.5, -14], [1.7, -18], [0, -19.6, 0]]), hk = "#6BA03E", ker = { w: 0.8, h: 0.8, shapes: [S(rrect(0.08, 0.08, 0.64, 0.64, 0.26), tone(c, "light"), { flat: true })] };
  return [P([[0, -1, 0], [-2.6, -3], [-4.3, -8], [-4.7, -12.6, 0], [-2.8, -9], [-1.4, -5]], tone(hk, "shade")), P([[0, -1, 0], [2.4, -3], [4, -8], [4.3, -11.8, 0], [2.6, -8.6], [1.2, -5]], tone(hk, "deep")), S(o, tone(c, "shade")), { path: o, tile: ker, flat: true, opacity: 0.95 }, ...bulb(o, c, 0, -10.8, 2.7, 8.8, 0.25), P([[0, -0.6, 0], [-1.9, -2], [-2.5, -6], [-0.5, -10, 0], [1.4, -6], [2, -2]], hk), ln([[0, -1], [0, -8.4]], tone(hk, "deep"), 0.3, 0.6), ln([[-0.9, -2], [-1.1, -6]], tone(hk, "light"), 0.3, 0.7), S(rrect(-1.3, -1.6, 2.6, 1.6, 0.5), "#A98A5A")];
};
const mushroom = (c: string): Shape[] => {
  const st = smooth([[-1.4, -0.2, 0], [1.4, -0.2, 0], [1.1, -2.4], [1.8, -4.3, 0], [-1.8, -4.3, 0], [-1.1, -2.4]], true, 1), cap = smooth([[-3.8, -4.3, 0], [3.8, -4.3, 0], [3.6, -5.8], [2.1, -7.5], [0, -8.1], [-2.1, -7.5], [-3.6, -5.8]], true, 1), W = "#F3EBDD";
  return [S(st, W), F(rect(0.3, -4.4, 2, 4.5), tone(W, "shade"), 0.5, st), S(cap, c), ...bulb(cap, c, 0, -6, 3.8, 2.2), F(ellipse(0, -4.3, 3.8, 0.55), tone(c, "deep"), 0.7, cap), ...[-2.4, -1.2, 0, 1.2, 2.4].map(x => ln([[x * 0.4, -4.6], [x, -4.3]], tone(W, "deep"), 0.2, 0.6))];
};
const radish = (c: string): Shape[] => {
  const g = "#4E9A3E";
  return [...tuft(0, -5.3, 0, 6.4, 2.2, g), ...tuft(0, -5.3, -0.55, 5.4, 2, tone(g, "shade")), ...tuft(0, -5.3, 0.55, 5.4, 2, tone(g, "light")), S(band([[0, -1.9], [0, -0.1]], [1.1, 0.1]), "#F4EFE4"), ...ball(0, -3.3, 2.1, 2.1, c), F(ellipse(0, -1.5, 0.7, 0.35), "#F4EFE4", 0.9)];
};
const pumpkin = (c: string): Shape[] => {
  const o = smooth([[0, -13.4, 0], [5, -14.1], [10.8, -11.4], [12.2, -6.6], [10, -2], [4.8, -0.2], [0, -0.1, 0], [-4.8, -0.2], [-10, -2], [-12.2, -6.6], [-10.8, -11.4], [-5, -14.1]], true, 1);
  return [R([[0, -13.6], [0.6, -16.2], [2.2, -17.4]], "#6B7A32", 2.4), S(o, c), ...[-0.92, -0.7, -0.4, 0, 0.4, 0.7, 0.92].map(f => ln(Array.from({ length: 7 }, (_, k) => [f * 12.2 * Math.sin(PI * k / 6), -0.1 - 13.4 * (1 - Math.cos(PI * k / 6)) / 2] as Vec2), tone(c, "deep"), 0.5, 0.5, o)), ...bulb(o, c, 0, -6.8, 12.2, 6.8, 0.15)];
};
const ruffle = (cx: number, cy: number, rx: number, ry: number, m: number, amp: number): Path => {
  const pts: Pt[] = Array.from({ length: m + 1 }, (_, k) => { const a = PI + PI * k / m, q = rx + (k % 2 ? amp : -amp * 0.3); return [cx + Math.cos(a) * q, cy + Math.sin(a) * q * ry / rx] as Pt; });
  return smooth([...pts, [cx + rx * 0.9, cy + 0.6, 0], [cx - rx * 0.9, cy + 0.6, 0]], true, 1);
};
const lettuce = (c: string): Shape[] => {
  const o = ruffle(0, -1, 8.8, 11, 16, 1);
  return [S(o, tone(c, "shade")), S(ruffle(0.2, -1.2, 7.6, 9.8, 12, 0.9), c), S(ruffle(0.6, -1.4, 5.2, 7.4, 10, 0.7), tone(c, "light")), ...[-0.9, -0.45, 0, 0.45, 0.9].map(a => ln([[0, -0.8], [Math.sin(a) * 4, -3 - Math.cos(a) * 3.5], [Math.sin(a) * 8, -1 - Math.cos(a) * 8.6]], tone(c, "deep"), 0.3, 0.45, o)), F(ellipse(0, -0.2, 3.8, 0.8), "#E8EBC8", 0.9, o), F(ellipse(-3.4, -8.6, 1.4, 0.5), WHITE, 0.3)];
};
const garlic = (c: string): Shape[] => {
  const o = sym([[0, -0.1, 0], [2.4, -0.9], [3, -3], [1.9, -5.4], [0.7, -6.9], [0, -8.4, 0]]);
  return [S(o, c), ...bulb(o, c, 0, -3.8, 3, 3.8), ln([[0, -0.8], [-1.4, -3.2], [-0.6, -6.4]], tone(c, "shade"), 0.35, 0.8, o), ln([[0.2, -0.8], [1.5, -3.4], [0.8, -6.2]], tone(c, "shade"), 0.35, 0.8, o), ln([[-0.3, -1], [-0.5, -3.4], [-0.1, -6.8]], "#C98AA0", 0.3, 0.55, o), ln([[0.7, -1], [0.9, -3.4], [0.5, -6.6]], "#C98AA0", 0.3, 0.5, o)];
};
const cabbage = (c: string): Shape[] => {
  const o = ellipse(0, -10, 10.2, 9.6), lf = "#E4F0CC";
  return [S(o, c), ...bulb(o, c, 0, -10, 10.2, 9.6, 0.16), F(smooth([[0, -0.2, 0], [-6, -0.3], [-10.2, -4], [-10.4, -9], [-8.4, -6.4], [-4.6, -3.8]], true, 1), tone(c, "light"), 0.6, o), F(smooth([[0, -0.2, 0], [6, -0.3], [10.2, -4], [10.4, -9], [8.4, -6.4], [4.6, -3.8]], true, 1), tone(c, "shade"), 0.5, o), ln([[-9, -12], [-4, -17], [4, -17.4], [9, -12]], tone(c, "deep"), 0.5, 0.45, o), ln([[0, -1], [0.4, -8], [0, -15]], lf, 0.7, 0.8, o), ...[[-3.6, -7.4], [3.6, -7.8], [-2.6, -11.6], [2.8, -12]].map(([x, y]) => ln([[0.2, y + 2.4], [x, y]], lf, 0.4, 0.7, o)), ln([[-7.4, -2], [-5.6, -6]], lf, 0.4, 0.6, o)];
};
const leek = (c: string): Shape[] => {
  const sh = sym([[1.5, -0.1, 0], [1.6, -5], [1.7, -12], [2.4, -14.4], [0, -14.4, 0]]), lv = "#4E8A5A";
  return [...[[-0.2, 22], [0.2, 21], [-0.07, 24], [0.1, 18.5]].flatMap(([a, len], k) => turn([S(leaf(len, 3.8).move(0, -11), k % 2 ? lv : tone(lv, "shade")), ln([[0, -12], [0, -9 - len]], tone(lv, "light"), 0.3, 0.6)], a, 0, -11)), S(sh, c), F(rect(-3, -14.4, 6, 3.4), "#9CC58A", 0.85, sh), F(rect(0.4, -15, 3, 15), tone(c, "shade"), 0.5, sh), ln([[-0.8, -1], [-0.8, -10]], WHITE, 0.4, 0.6), ...[-0.9, 0, 0.9].map(x => ln([[x, -0.2], [x * 1.5, 0.8]], "#D8D2B8", 0.25, 1))];
};
const ginger = (c: string): Shape[] => {
  const o = smooth([[-6.8, -1.4], [-7.2, -3.6], [-6.6, -6], [-5.6, -7.8], [-4.4, -8.2], [-3.3, -7.4], [-2.8, -5.4], [-2.4, -4.4], [-2.2, -6.4], [-1.5, -8.4], [0, -9.3], [1.4, -8.6], [2, -6.6], [2.4, -4.6], [3.2, -6.2], [4.2, -7.6], [5.4, -7.8], [6.4, -6.6], [6.8, -4.6], [6.6, -2.4], [5, -0.8], [1, -0.1], [-3, -0.3]], true, 1);
  return [S(o, c), F(ellipse(1, -0.9, 7.4, 1.4), tone(c, "shade"), 0.45, o), F(ellipse(-4.4, -6.4, 0.7, 1.6), tone(c, "light"), 0.5, o), F(ellipse(-0.2, -7, 0.7, 1.8), tone(c, "light"), 0.5, o), ...[[[-6.5, -5.8], [-3.4, -5.6]], [[-1.9, -6], [1.8, -5.9]], [[3.6, -5.4], [6.6, -5.4]], [[-6.9, -2.6], [-2.4, -2.4]], [[2.6, -2.7], [6.7, -2.9]]].map(l => ln(l as Vec2[], tone(c, "deep"), 0.3, 0.5)), F(ellipse(-4.4, -7.9, 0.7, 0.35), "#E3B7A0", 0.9), F(ellipse(0, -9, 0.7, 0.35), "#E3B7A0", 0.9), F(ellipse(5.3, -7.6, 0.6, 0.3), "#E3B7A0", 0.9)];
};

const VEG: Record<string, K> = {
  potato: { w: 7.8, sy: 4.8, c: "#C79A63", pp: 10, ed: 0.25, g: 5, hn: 3, draw: potato },
  carrot: { w: 10.5, sy: 3.7, c: "#EE7A1E", pp: 8, ed: 0.25, g: 2, hold: hang(-6, -1.9), draw: carrot },
  onion: { w: 8, sy: 5.6, c: "#C98A3E", pp: 10, ed: 0.25, g: 5, hn: 2, draw: onion },
  aubergine: { w: 8.8, c: "#4B2A5A", pp: 9, ed: 0.25, g: 6, draw: aubergine },
  pepper: { w: 7, sy: 2.8, c: "#6DAA3C", pp: 10, ed: 0.2, g: 3, hold: hang(-7, -4.6), draw: pepper },
  cucumber: { w: 10, sy: 3.4, c: "#4E8A3A", pp: 8, ed: 0.25, g: 2, hold: up(-9, -2), draw: cucumber },
  spinach: { w: 22, c: "#2F6B34", pp: 7, ed: 0.3, g: 3, draw: spinach },
  parsley: { w: 22, c: "#3E8E3E", pp: 7, ed: 0.25, g: 3, draw: parsley },
  corn: { w: 10.6, c: "#F2C230", pp: 8, ed: 0.25, g: 4, draw: corn },
  lettuce: { w: 18, c: "#8CC152", pp: 7, ed: 0.3, g: 6, s: 0.8, draw: lettuce },
  garlic: { w: 5.8, sy: 4.8, c: "#F1EBDD", pp: 12, ed: 0.2, g: 5, hn: 3, draw: garlic },
  cabbage: { w: 21.4, c: "#A9CF72", pp: 6, ed: 0.4, g: 8, s: 0.6, draw: cabbage },
  leek: { w: 9, c: "#EEF0DA", pp: 6, ed: 0.3, g: 4, s: 0.8, draw: leek },
  courgette: { w: 12, sy: 3.8, c: "#7FB04A", pp: 7, ed: 0.25, g: 2, hold: hang(10.2, -2.3), draw: courgette },
  beans: { w: 7, sy: 1.9, c: "#6BB03E", pp: 12, ed: 0.2, g: 4, hn: 8, n0: 8, draw: bean },
  ginger: { w: 9.4, sy: 4, c: "#C9A56B", pp: 10, ed: 0.25, g: 5, draw: ginger },
  mushroom: { w: 8.2, sy: 6.6, c: "#E3D2B6", pp: 12, ed: 0.2, g: 5, hn: 3, draw: mushroom },
  radish: { w: 5.4, sy: 4.2, c: "#C8283A", pp: 14, ed: 0.2, g: 3, hn: 4, draw: radish },
  pumpkin: { w: 26.4, c: "#E0842E", pp: 6, ed: 0.4, g: 8, s: 0.55, draw: pumpkin },
};

const veg: PieceDef = { draw: (p, r) => build("veg", VEG, p, r),
  variants: Object.fromEntries(Object.keys(VEG).map(k => [k, { kind: k }])),
  meta: {
    about: "Vegetables: a potato, carrot, onion, aubergine, long green pepper, cucumber, bunch of spinach, bunch of parsley, corn cob, lettuce, garlic bulb, cabbage, leek, courgette, green beans, a root of ginger, button mushrooms, radishes or a pumpkin.",
    params: {
      kind: { type: "enum", values: Object.keys(VEG), default: "potato" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many: a row of upright ones, a pile of round or long ones lying; beans start at 8; held, what a hand carries" },
      color: { type: "color", about: "its colour (a Turkish colour name, a palette id or a hex): a red onion, a red cabbage, a red pepper" },
    },
    terms: ["a1-w-patates", "a1-w-havuc", "a1-w-sogan", "a1-w-patlican", "a1-w-biber", "a2-w-salatalik", "a1-w-ispanak", "a2-w-maydanoz", "a2-w-misir", "a2-w-zencefil", "a1-w-sebze"],
    tags: ["vegetable", "food", "market"],
  } };

// ---- pantry ---------------------------------------------------------------------------------------

/** Shade down the right of a pack, a sheen down the left. */
const lt = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number): Shape[] => [F(rect(x1 - (x1 - x0) * 0.2, y0 - 1, (x1 - x0) * 0.2 + 1, y1 - y0 + 2), tone(c, "shade"), 0.4, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.07 + 1, y1 - y0 + 2), WHITE, 0.3, o)];
/** Crimped seam: fine lines across a strip. */
const crimp = (x0: number, x1: number, y0: number, y1: number, c: string, o: Path): Shape => { const p = poly([[x0, y0], [x0, y1]], false); for (let x = x0 + 0.7; x < x1; x += 0.7) p.add(poly([[x, y0], [x, y1]], false)); return { path: p, stroke: { color: c, width: 0.2 }, flat: true, opacity: 0.5, clip: o }; };
/** A printed cream label panel. */
const cart = (x: number, y: number, w: number, h: number, c = CREAM): Shape => F(rrect(x, y, w, h, 0.9), c, 0.97);
const GRAIN = "#C9A23A", GLASS = "#E4EEF0";
/** Grain on a grid of `cols` × `rows` across x0…x1, y0…y1, every other row shifted. */
const grid = (x0: number, x1: number, y0: number, y1: number, cols: number, rows: number): Vec2[] => Array.from({ length: cols * rows }, (_, k) => { const i = k % cols, j = Math.floor(k / cols); return [x0 + (i + (j % 2 ? 0.75 : 0.25)) * (x1 - x0) / cols, y0 + (j + 0.5) * (y1 - y0) / rows] as Vec2; });
/** A sack `w` × `h` with its top folded and stitched in `c`, a wheat ear on its band; `win` the colour of the grain in a window. */
const sack = (w: number, h: number, body: string, c: string, win: string | null): Shape[] => {
  const x = w / 2, b0 = h * 0.72, b1 = h * 0.4, o = smooth([[-x + 0.2, -0.2, 0], [x - 0.2, -0.2, 0], [x + 0.2, -h / 2], [x - 0.2, -h, 0], [-x + 0.2, -h, 0], [-x - 0.2, -h / 2]], true, 1);
  return [S(o, body), F(rect(-x - 1, -h - 1, w + 2, 3.8), tone(body, "shade"), 0.5, o), ln([[-x, -h + 2.8], [x, -h + 2.8]], tone(body, "deep"), 0.3, 0.6, o), { path: poly([[-x + 0.8, -h + 1.4], [x - 0.8, -h + 1.4]], false), stroke: { color: c, width: 0.25, dash: [0.7, 0.5] }, flat: true, opacity: 0.9 },
    F(rect(-x - 1, -b0, w + 2, b0 - b1), c, 1, o), cart(-x + 1.6, -b0 + 1.1, w - 3.2, b0 - b1 - 2.2), ln([[0, -b0 - 0.4], [0, -b0 - 3]], GRAIN, 0.3, 0.9), dots([[-0.7, -b0 - 1.1], [0.7, -b0 - 1.1], [-0.7, -b0 - 2.1], [0.7, -b0 - 2.1], [0, -b0 - 3.2]], 0.5, 0.28, GRAIN),
    ...(win ? [F(rrect(-x + 2.4, -b1 + 1.2, w - 4.8, b1 - 3, 1.5), "#FBF8EF"), dots(grid(-x + 3, x - 3, -b1 + 1.8, -2.4, 5, 3), 0.55, 0.28, win)] : []), ...lt(o, body, -x, x, -h, 0)];
};
const sugar = (c: string): Shape[] => {
  const W = "#F6F2EA", o = smooth([[-5.3, -0.2, 0], [5.3, -0.2, 0], [5.6, -8], [5.3, -16.8, 0], [-5.3, -16.8, 0], [-5.6, -8]], true, 1);
  return [S(o, W), crimp(-6, 6, -16.8, -15.2, tone(W, "deep"), o), crimp(-6, 6, -1.6, -0.2, tone(W, "deep"), o), F(rect(-6, -12.8, 12, 6.8), c, 1, o), cart(-4.4, -12, 8.8, 5.2), ...lt(o, W, -5.6, 5.6, -16.8, 0)];
};
const rice = (c: string): Shape[] => {
  const W = "#EDE6D0", o = sym([[7.8, -0.2, 0], [8.6, -8], [8.1, -17], [5.8, -23], [2.6, -26], [1.9, -27.6, 0]]);
  return [P([[-5, -31.6, 0], [-2.6, -30.8], [0, -31.8, 0], [2.6, -30.8], [5, -31.6, 0], [2.2, -27.4], [-2.2, -27.4]], tone(W, "light")), ln([[-2, -30.6], [-1.2, -27.8]], tone(W, "deep"), 0.3, 0.5), ln([[1.6, -30.6], [1, -27.8]], tone(W, "deep"), 0.3, 0.5), S(o, W), F(rect(-9, -19.5, 18, 7.5), c, 1, o), cart(-6.3, -18.7, 12.6, 5.9), F(rrect(-5.8, -10.2, 11.6, 7.6, 1.6), "#FBF8EF"), dots(grid(-5, 5, -9.6, -3.2, 4, 3), 0.7, 0.25, "#E0D6B8"), ...lt(o, W, -8.6, 8.6, -28, 0), S(rrect(-2.7, -28.2, 5.4, 1.2, 0.5), c)];
};
const lentils = (c: string): Shape[] => {
  const o = sym([[6.4, -0.2, 0], [7, -8], [6.7, -14], [4.6, -18], [2.2, -20.6], [1.6, -22, 0]]), m = smooth([[-8, -0.2, 0], [8, -0.2, 0], [8, -11], [4, -13.6], [0, -14.2], [-4, -13.6], [-8, -11]], true, 1);
  return [P([[-5, -25.6, 0], [-2.4, -24.6], [0, -25.8, 0], [2.4, -24.6], [5, -25.6, 0], [2, -21.8], [-2, -21.8]], GLASS, { opacity: 0.7 }), S(o, GLASS, { opacity: 0.6 }), F(m, c, 1, o), { path: m, tile: { w: 1.1, h: 1.1, shapes: [S(ellipse(0.55, 0.55, 0.42, 0.3), tone(c, "light"), { flat: true }), S(ellipse(0, 0, 0.3, 0.22), tone(c, "deep"), { flat: true })] }, flat: true, opacity: 0.8, clip: o }, ...lt(o, c, -7, 7, -22, 0), F(rect(-6, -11, 1.1, 9), WHITE, 0.45, o), cart(-5.2, -11.6, 10.4, 5.4), S(rrect(-2.6, -22.4, 5.2, 1.1, 0.5), "#C8283A")];
};
const pasta = (c: string): Shape[] => {
  const o = smooth([[-5.6, -0.2, 0], [5.6, -0.2, 0], [5.9, -11], [5.6, -21.8, 0], [-5.6, -21.8, 0], [-5.9, -11]], true, 1);
  let p: Path | null = null;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) { const x = -2.7 + i * 2.7 + (j % 2 ? 1.2 : 0), y = -13 + j * 2.3, t = rrect(x - 1.15, y - 0.45, 2.3, 0.9, 0.45).transform(rotateAbout(j % 2 ? -0.6 : 0.6, x, y)); p = p ? p.add(t) : t; }
  return [S(o, c), crimp(-6, 6, -21.8, -20.3, tone(c, "deep"), o), crimp(-6, 6, -1.6, -0.2, tone(c, "deep"), o), F(rect(-6.5, -20.2, 13, 4.8), tone(c, "deep"), 1, o), F(rrect(-4.4, -14.4, 8.8, 11.6, 1.6), "#FBF6E8"), F(p!, "#E8B84A", 1, rrect(-4.4, -14.4, 8.8, 11.6, 1.6)), ...lt(o, c, -5.9, 5.9, -21.8, 0)];
};
const coffee = (c: string): Shape[] => {
  const g = "#F3E3B8", cup = smooth([[-1.6, -4.7, 0], [1.6, -4.7, 0], [1.3, -2.9], [0, -2.3], [-1.3, -2.9]], true, 1);
  return [S(poly([[3.7, -0.1], [5.4, -1.2], [5.4, -12.2], [3.7, -11]]), tone(c, "shade")), S(poly([[-3.75, -11], [-2, -12.2], [5.4, -12.2], [3.7, -11]]), tone(c, "light")), S(rect(-3.75, -11, 7.5, 11), c), F(rect(-3.75, -7.8, 7.5, 0.5), "#D4AF4A"), F(rect(-3.75, -1.4, 7.5, 0.4), "#D4AF4A"), F(cup, g), ln([[1.6, -4.4], [2.6, -4.2], [2.4, -3.2], [1.4, -3.2]], g, 0.35, 1), F(ellipse(0, -2.1, 2.4, 0.4), g), ln([[-0.6, -6.6], [-0.2, -5.9], [-0.6, -5.3]], "#D4AF4A", 0.3, 0.9), ln([[0.7, -6.6], [1.1, -5.9], [0.7, -5.3]], "#D4AF4A", 0.3, 0.9)];
};
const yeast = (c: string, r: Rng): Shape[] => {
  const W = "#F6F2EA", o = smooth([[-2.5, -0.2, 0], [2.5, -0.2, 0], [2.8, -4.4], [2.5, -8.4, 0], [-2.5, -8.4, 0], [-2.8, -4.4]], true, 1);
  return turn([S(o, W), crimp(-3, 3, -8.4, -7.2, tone(W, "deep"), o), crimp(-3, 3, -1.4, -0.2, tone(W, "deep"), o), F(rect(-3.2, -6.4, 6.4, 3.4), c, 1, o), ...lt(o, W, -2.8, 2.8, -8.4, 0)], r.range(-0.08, 0.08), 0, -0.2);
};
const tin = (c: string): Shape[] => {
  const o = rect(-4, -10.6, 8, 10.2), st = "#C3C8CE";
  return [S(o, st), F(rect(-4, -9.4, 8, 7.6), c, 1, o), cart(-3.4, -8.6, 6.8, 5.6), ln([[-4, -10], [4, -10]], "#8E959C", 0.3, 0.8), ln([[-4, -1.2], [4, -1.2]], "#8E959C", 0.3, 0.8), ...lt(o, st, -4, 4, -10.6, 0), S(ellipse(0, -10.7, 4.1, 0.9), "#D9DEE2"), F(ellipse(0, -10.7, 3.3, 0.6), "#9AA0A6", 0.8), { path: ellipse(0.9, -10.9, 1.3, 0.35), stroke: { color: "#8E959C", width: 0.3 }, flat: true }, F(ellipse(0, -0.45, 4, 0.45), "#8E959C", 0.7)];
};
const SPICE = ["#8A5A2C", "#5E8A3E", "#8A9A52", "#C8283A", "#7A1F35", "#B8743A"];
const spice = (c: string, _r: Rng, i: number): Shape[] => [S(rrect(-2.5, -8.4, 5, 8.2, 1), GLASS, { opacity: 0.85 }), F(rrect(-2.2, -7.4, 4.4, 7, 0.8), SPICE[i % SPICE.length]), cart(-2.2, -6.1, 4.4, 3.4, CREAM), F(rect(-2.3, -7.6, 0.5, 6.8), WHITE, 0.5), S(rrect(-2.8, -10.2, 5.6, 2, 0.6), c), ln([[-1, -10.1], [-1, -8.4]], tone(c, "shade"), 0.25, 0.7), ln([[1, -10.1], [1, -8.4]], tone(c, "shade"), 0.25, 0.7)];
const oil = (c: string): Shape[] => {
  const o = P([[-6.5, -0.2, 0], [6.5, -0.2, 0], [6.5, -17.8, 0], [5.4, -19.2, 0], [-5.4, -19.2, 0], [-6.5, -17.8, 0]], c), st = "#C3C8CE";
  return [{ path: smooth([[-5, -19.2], [-4.6, -22.6], [-0.8, -22.6], [-0.4, -19.2]], false, 1), stroke: { color: "#8E959C", width: 1.1, cap: "round", join: "round" } }, S(rrect(2, -20.8, 3.2, 2, 0.4), st), S(rrect(1.6, -22.2, 4, 1.6, 0.5), "#C8283A"), o, ...lt(o.path, c, -6.5, 6.5, -19.2, 0), F(rect(-6.5, -18.4, 13, 0.5), tone(c, "deep"), 0.7, o.path), F(rect(-6.5, -1.6, 13, 0.5), tone(c, "deep"), 0.7, o.path), cart(-5, -15.4, 10, 10.2), F(ellipse(-0.8, -13.8, 0.9, 0.65), "#3E5A2A"), F(ellipse(0.9, -13.7, 0.9, 0.65), "#2A3E1C"), F(leaf(2.6, 1.2).transform(mul(translate(0, -14.2), rotate(0.9))), "#4E8A3A"), F(rect(-6.5, -4, 13, 0.7), GRAIN, 0.9, o.path)];
};

const PANTRY: Record<string, K> = {
  flour: { w: 17, c: "#C4553A", pp: 9, g: -22, draw: c => sack(15, 24, "#EFE8D6", c, null), lab: { x: -5.9, y: -16.2, w: 11.8, h: 5.5, t: "UN" } },
  sugar: { w: 13, c: "#2E6FB6", pp: 10, g: 5, draw: sugar, lab: { x: -4.4, y: -12, w: 8.8, h: 5.2, t: "ŞEKER" } },
  rice: { w: 19, c: "#4E8A3A", pp: 8, g: -28, draw: rice, lab: { x: -6.3, y: -18.7, w: 12.6, h: 5.9, t: "PİRİNÇ" } },
  lentils: { w: 16, c: "#D9632A", pp: 10, g: -19, draw: lentils, lab: { x: -5.2, y: -11.6, w: 10.4, h: 5.4, t: "MERCİMEK" } },
  pasta: { w: 14, c: "#E0A83A", pp: 10, g: 5, draw: pasta, lab: { x: -5.4, y: -19.8, w: 10.8, h: 4, t: "MAKARNA", color: WHITE } },
  bulgur: { w: 18, c: "#6F8A3A", pp: 9, g: -24, draw: c => sack(16, 26, "#D2AA78", c, "#D9A441"), lab: { x: -6.4, y: -17.6, w: 12.8, h: 6.1, t: "BULGUR" } },
  coffee: { w: 10.8, c: "#8A3A28", pp: 12, g: 4, draw: coffee, lab: { x: -3.3, y: -10.6, w: 6.6, h: 2.6, t: "KAHVE", color: "#F3E3B8" } },
  yeast: { w: 6, c: "#C8283A", pp: 14, g: 3, hn: 4, n0: 4, draw: yeast, lab: { x: -2.6, y: -6.2, w: 5.2, h: 3, t: "MAYA", color: WHITE } },
  tin: { w: 9.6, c: "#C8283A", pp: 12, g: 4, draw: tin, lab: { x: -3.4, y: -8.6, w: 6.8, h: 5.6, t: "KONSERVE" } },
  spices: { w: 6.4, c: "#C8283A", pp: 14, g: 4, hn: 3, n0: 5, draw: spice, lab: { x: -2.2, y: -6.1, w: 4.4, h: 3.4, t: "KİMYON|NANE|KEKİK|PUL BİBER|SUMAK|TARÇIN", size: 1 } },
  olive_oil: { w: 15.4, c: "#4E7A3A", pp: 10, g: -19, draw: oil, lab: { x: -4.6, y: -11.6, w: 9.2, h: 3.8, t: "ZEYTİNYAĞI" }, hx: 2.3 },
  chickpeas: { w: 16, c: "#D8B26C", pp: 10, g: -19, draw: lentils, lab: { x: -5.2, y: -11.6, w: 10.4, h: 5.4, t: "NOHUT" } },
};

const pantry: PieceDef = { draw: (p, r) => build("pantry", PANTRY, p, r),
  variants: Object.fromEntries(Object.keys(PANTRY).map(k => [k, { kind: k }])),
  meta: {
    about: "Pantry goods, each pack with its label: a paper sack of flour, a sugar pack, a rice bag, a clear bag of red lentils, a pasta packet, a bulgur bag, a Turkish coffee pack, small yeast packets, a tin can, a row of spice jars, a square olive-oil tin or a clear bag of chickpeas.",
    params: {
      kind: { type: "enum", values: Object.keys(PANTRY), default: "flour" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (yeast packets start at four, spice jars at five); held, what a hand carries" },
      color: { type: "color", about: "the pack's band or brand colour (the grain's own colour in the clear bags; the tin's body); a Turkish colour name, a palette id or a hex" },
      label: { type: "text", about: "the words on the pack, in its label panel (a list gives each jar or pack its own); default the thing's Turkish name, UN, ŞEKER, PİRİNÇ, MERCİMEK, MAKARNA, BULGUR, KAHVE, MAYA, KONSERVE, ZEYTİNYAĞI, NOHUT; spice jars their own names" },
    },
    terms: ["b1-w-un", "a1-w-seker", "a1-w-pilav", "a2-w-mercimek", "a2-w-makarna", "a1-w-kahve", "b1-w-maya"],
    tags: ["pantry", "food", "shop", "words"],
  } };

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { fruit, veg, pantry };
