// Props of the bakery family (STYLE.md): what a European bakery, café, market stall and deli sell: pastries, plated dishes, café
// drinks and deli goods. No alcohol: the stories are for learners. Units cm, real size; each flat's origin is its bottom centre; held
// (`held`), a prop is drawn as people carry it, its origin at the grip. Each generator is a table: kind -> how wide, how drawn.
// Already drawn elsewhere, so not here: pasta is `dish` makarna, an olive-oil tin is `pantry` olive_oil, a small black coffee is `cup` fincan.

import { Path, arcPoints, ellipse, rect, rrect, poly, smooth, tone, mul, rotate, translate, groupBounds, type Affine, type EmitSpec, type ParamSpec, type PieceDef, type Rng, type Shape, type Vec2 } from "sahne";
import { S, P, num, str, hex } from "./draw.ts";
import { drawnFamily } from "../drawing.ts";
import { DRAWN } from "./drawn/bakery.gen.ts";

const PI = Math.PI, WHITE = "#FBF8F2", STEEL = "#B8BEC4", DARK = "#2E2F35", WOOD = "#8A5A3C", CREAM = "#F3E6C4", LEMON = "#EFD04A", RED = "#C23B2B";
// Separate materials, each with its own ramp: chocolate, jam, custard, cheese rind, mustard, a pan, the greens.
const CHOC = "#4A2A1A", JAM = "#D7792A", CUSTARD = "#F2CD52", RIND = "#C98A3E", MUSTARD = "#E0B31F", PAN = "#3D4048", CHEESE = "#F4D272", MINT = "#4E9A45", PRAWN = "#EB6F44", MUSSEL = "#2A3552", FISH = "#D9A13C", KRAUT = "#EAE0A8", SCH = "#CC8F42", DOUGH = "#EFDDAE", BREAD = "#D9AE62", TOPC = "#F0C25A", WAF = "#E3AB55";
type Prm = Record<string, unknown>;
type Em = [EmitSpec["kind"], number, number, number];

// ---- helpers -------------------------------------------------------------------------------------

/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a stick, a stem, a handle. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** An ellipse turned by `a` about its centre. */
const el = (x: number, y: number, rx: number, ry: number, a = 0) => ellipse(0, 0, rx, ry).transform(mul(translate(x, y), rotate(a)));
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(), w = x1 - x0; return [F(rect(x1 - w * k, y0 - 1, w * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, w * 0.1 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** A cut outline with its light. */
const O = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...lit(o, c, k)];
/** An ellipse with its light. */
const E = (x: number, y: number, rx: number, ry: number, c: string, a = 0, k = 0.2) => O(el(x, y, rx, ry, a), c, k);
/** Many small round marks in one shape. */
const dots = (pts: Vec2[], r: number, c: string, op = 1, ry = r): Shape => { const p = new Path(); for (const [x, y] of pts) p.add(ellipse(x, y, r, ry)); return F(p, c, op); };
/** Printed strokes as one flat shape. */
const lines = (segs: Vec2[][], c: string, w = 0.4, op = 0.7, clip?: Path): Shape => { const p = new Path(); for (const s of segs) p.add(poly(s, false)); return { path: p, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }; };
/** A lumpy outline round (cx, cy): `n` points, each pushed in or out a little (fixed, so the same every time). */
const lump = (cx: number, cy: number, rx: number, ry: number, n = 14, amp = 0.1, seed = 0): Path => smooth(Array.from({ length: n }, (_, i) => { const a = i / n * 2 * PI, k = 1 + amp * Math.sin(i * 2.7 + seed) * Math.cos(i * 1.3 + seed * 2); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as Vec2; }), true, 1);
/** Shapes moved by a shift or a turn. */
const turn = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}) }));
const at = (sh: Shape[], x: number, y = 0) => turn(sh, translate(x, y));
/** A long thing lying along x (centred), stood up at the angle `a` so its lower end is on y = 0 (`half` is half its length). */
const stand = (sh: Shape[], half: number, a: number): Shape[] => turn(sh, mul(translate(half * Math.cos(a), -half * Math.sin(a)), rotate(-a)));
/** A lemon wedge standing at (x, y). */
const wedge = (x: number, y: number, s = 1): Shape[] => at([...O(smooth([[-2.5 * s, 0, 0], [2.5 * s, 0, 0], [2.1 * s, -1.6 * s], [0, -2.8 * s], [-2.1 * s, -1.6 * s]], true, 1), LEMON, 0.2), F(poly([[-1.8 * s, -0.5], [1.8 * s, -0.5], [1.4 * s, -1.4 * s], [0, -2.1 * s], [-1.4 * s, -1.4 * s]]), "#FBF1A6", 0.9), lines([[[0, -0.6], [0, -1.9 * s]], [[-1 * s, -0.7], [-1.2 * s, -1.5 * s]], [[1 * s, -0.7], [1.2 * s, -1.5 * s]]], WHITE, 0.2, 0.8)], x, y);
/** A parsley or dill sprig at (x, y). */
const sprig = (x: number, y: number, s = 1, c = "#4E9A45"): Shape[] => [R([[x, y], [x + 0.4 * s, y - 1.8 * s]], tone(c, "deep"), 0.3 * s), ...[[-1, -2], [0.4, -2.9], [1.3, -1.8], [0, -1.3]].map(([a, b], i) => S(el(x + a * s, y + b * s, 1 * s, 0.65 * s, a * 0.5), i % 2 ? c : tone(c, "light")))];
/** A plate `w` across seen from a little above, on y = 0, its rim `rim`. */
function plate(w: number, rim: string): Shape[] {
  const ry = w * 0.16, yc = -1 - ry;
  return [P([[-w * 0.26, 0, 0], [w * 0.26, 0, 0], [w * 0.32, -1.2, 0], [-w * 0.32, -1.2, 0]], tone(WHITE, "shade")), S(ellipse(0, yc + 0.6, w / 2 - 0.3, ry), tone(WHITE, "shade")), S(ellipse(0, yc, w / 2, ry), WHITE),
    F(ellipse(0, yc + 0.15, w * 0.33, ry * 0.6), tone(WHITE, "shade"), 0.35), { path: ellipse(0, yc, w * 0.45, ry * 0.86), stroke: { color: rim, width: 0.35 }, flat: true, opacity: 0.85 }];
}
/** Food drawn round (0, 0), the middle of the plate's face. */
const served = (w: number, rim: string, food: Shape[]) => [...plate(w, rim), ...at(food, 0, -1 - w * 0.12)];
/** A cup `w` wide and `h` tall on y = 0 with its handle on the right, coffee surface `liq` (its saucer under it when `s`). */
function cup(w: number, h: number, c: string, liq: string, s = 0): Shape[] {
  const ry = w * 0.2, body = smooth([[-w / 2, -h, 0], [w / 2, -h, 0], [w * 0.42, -h * 0.4], [w * 0.28, -h * 0.06], [w * 0.2, 0, 0], [-w * 0.2, 0, 0], [-w * 0.28, -h * 0.06], [-w * 0.42, -h * 0.4]], true, 1);
  return [...(s ? [...O(poly(arcPoints(0, 0, s / 2, s * 0.09, 0, PI, 18)), WHITE, 0.2), S(ellipse(0, -0.5, s / 2, s * 0.09), WHITE)] : []),
    R([[w * 0.45, -h * 0.82], [w * 0.74, -h * 0.74], [w * 0.62, -h * 0.34], [w * 0.36, -h * 0.28]], c, w * 0.12), ...O(body, c, 0.24), S(ellipse(0, -h, w / 2, ry), c), S(ellipse(0, -h + 0.2, w / 2 - 0.5, ry - 0.3), liq)];
}

// ---- the table-driven generator ------------------------------------------------------------------

/** What one thing draws, at its own origin: shapes, and emitters (kind, x, y, w; the art's y, up is negative). */
interface B { sh: Shape[]; em?: Em[] }
interface Cx { p: Prm; r: Rng; c: string; i: number; held: boolean }
/** One kind: its slot `w` (and `h` for stacking in `cols` columns), art resolution, default colour, how it is drawn, and how it is held (`k` smaller; `g` the grip in the art, else it sits on the hand). */
interface Kd { w: number; h?: number; cols?: number; gap?: number; ppcm: number; c: string; edge?: number; hold?: { k?: number; g?: Vec2 }; hp?: number; d(c: Cx): B; /** what it draws in a hand instead, when the whole thing is too big to carry */ hd?(c: Cx): B }

function gen(T: Record<string, Kd>, m: { about: string; terms: string[]; tags: string[]; nmax?: number; params?: Record<string, ParamSpec> }): PieceDef {
  const kinds = Object.keys(T), nmax = m.nmax ?? 12;
  const kd = (p: Prm) => T[str(p.kind, str(p.variant, kinds[0]))] ?? T[kinds[0]];
  const cnt = (p: Prm) => Math.max(1, Math.min(nmax, Math.round(num(p.n, 1))));
  return {
    draw(p, r) {
      const k = kd(p), held = !!p.held, n = held ? 1 : cnt(p), cols = Math.min(n, k.cols ?? n), cx = { p, r, c: hex(p.color, k.c), held };
      const hk = held ? k.hold?.k ?? 1 : 1, g = k.hold?.g, hm: Affine = held ? [hk, 0, 0, hk, g ? -g[0] * hk : 0, g ? -g[1] * hk : -7.5] : [1, 0, 0, 1, 0, 0];
      const sh: Shape[] = [], em: EmitSpec[] = [];
      for (let i = 0; i < n; i++) {
        const rw = Math.floor(i / cols), rn = Math.min(cols, n - rw * cols), b = (held && k.hd ? k.hd : k.d)({ ...cx, i }), a = mul(hm, translate((i % cols - (rn - 1) / 2) * (k.w + (k.gap ?? 4)), -rw * (k.h ?? 0)));
        sh.push(...turn(b.sh.map(s => s.stroke && a[0] !== 1 ? { ...s, stroke: { ...s.stroke, width: s.stroke.width * a[0] } } : s), a));
        if (!held) for (const [kind, x, y, w] of b.em ?? []) em.push({ kind, x: x * a[0] + a[4], y: -(y * a[0] + a[5]), w: w * a[0] });
      }
      const edge = (k.edge ?? 0.4) * hk, [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge });
      return { flats: [{ group: { shapes: sh, edge }, ppcm: Math.min(held && k.hp ? k.hp : k.ppcm, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), ...(held ? {} : { shadow: "drop" as const }) }], ...(em.length ? { emitters: em } : {}) };
    },
    variants: Object.fromEntries(kinds.map(v => [v, { kind: v }])),
    meta: {
      about: m.about, terms: m.terms, tags: m.tags,
      params: {
        kind: { type: "enum", values: kinds, default: kinds[0] },
        n: { type: "int", min: 1, max: nmax, default: 1, about: "how many, side by side" },
        color: { type: "color", about: "the main colour (a palette id or a hex): the dough, the plate's rim, the mug; each kind has its own default" },
        ...m.params,
      },
    },
  };
}

// ---- pastry --------------------------------------------------------------------------------------

/** A baguette lying (70 cm), its five slashes cut and risen. */
const baguette = (c: string): Shape[] => {
  const o = smooth([[-36, -3.4], [-31, -6.6], [0, -7.6], [31, -6.6], [36, -3.4], [31, -0.7], [0, 0], [-31, -0.7]], true, 1);
  return [...O(o, c, 0.16), ...[-24, -12, 0, 12, 24].map(x => F(el(x, -4.4, 4.2, 1.1, -0.55), tone(c, "edge"), 0.95, o)), ...[-24, -12, 0, 12, 24].map(x => F(el(x + 0.3, -3.6, 3.8, 0.45, -0.55), tone(c, "deep"), 0.5, o)), dots([[-33, -2.6], [30, -2], [-18, -6.2]], 0.5, WHITE, 0.55)];
};
/** A rye loaf lying (24 cm): a dark crust cracked in a lattice, seeds on top. */
const rye = (c: string): Shape[] => {
  const o = smooth([[-12, -3.8], [-9, -8], [0, -9.6], [9, -8], [12, -3.8], [10, -0.6], [0, 0], [-10, -0.6]], true, 1);
  return [...O(o, c, 0.2), lines([[[-8, -8], [-3, -1]], [[-2, -9], [3, -1]], [[4, -8.4], [9, -1.6]], [[-9, -1.6], [-4, -8.6]], [[-3, -1], [2, -9]], [[3, -1.2], [8, -8]]], tone(c, "light"), 0.5, 0.75, o), dots([[-6, -5], [-1, -6.6], [5, -5.6], [8, -3.4], [-9, -3.2], [1, -2.6]], 0.42, tone(c, "edge"), 0.9)];
};
/** A macaron (7 cm): two shells with their feet, cream between. */
const macaron = (c: string): Shape[] => [...O(smooth([[-3.2, -1.5, 0], [-2.8, -0.3], [0, 0, 0], [2.8, -0.3], [3.2, -1.5, 0]], true, 1), c, 0.2), S(rrect(-3.5, -2.6, 7, 1.2, 0.6), tone(CREAM, "light")),
  ...O(smooth([[-3.2, -2.6, 0], [-2.8, -4.2], [0, -4.9], [2.8, -4.2], [3.2, -2.6, 0]], true, 1), c, 0.2), lines([[[-3, -1.6], [3, -1.6]]], tone(c, "deep"), 0.3, 0.5), F(el(-1.2, -3.9, 1.2, 0.5, -0.3), WHITE, 0.45)];
/** A slice of rye bread face-on (11.6 cm wide, 9 tall): the crust all round, the crumb inside with a few seeds. */
const ryeSlice = (c: string): Shape[] => {
  const face = (k: number) => smooth([[-5.8 * k, 0, 0], [-6 * k, -5.2], [-4.4 * k, -7.9], [0, -8.9], [4.4 * k, -7.9], [6 * k, -5.2], [5.8 * k, 0, 0]], true, 1);
  const o = face(1), crumb = face(0.84).transform([1, 0, 0, 1, 0, -0.45]), b = tone(c, "edge");
  return [...O(o, c, 0.2), ...O(crumb, b, 0.16), dots([[-3.4, -6.6], [0.6, -6.9], [3.6, -5.4], [-2.2, -3.4], [2.2, -2.6], [-4, -1.4], [0.4, -4.6]], 0.36, tone(c, "light"), 0.95, 0.26), dots([[-1.6, -1.4], [3.4, -1.2], [-3.6, -4.6], [1.8, -7.4]], 0.18, tone(b, "shade"), 0.6)];
};
const MACS = ["#F2A3B6", "#B7D98B", "#C8A6E0", "#F5D468", "#8ED2C6"];

const pastry = gen({
  croissant: { w: 21, ppcm: 14, c: "#D8943A", hold: { g: [0, -4] }, d: ({ c }) => { const th = Array.from({ length: 19 }, (_, i) => -1.35 + i * 0.15), pt = (a: number, r: number): Vec2 => [r * Math.sin(a), -0.8 - r * 0.94 * Math.cos(a)], bump = (a: number) => 0.7 * Math.cos(a * 2 * PI / 0.3) * (1 - Math.abs(a) / 1.5), ri = (a: number) => 3 + 4.6 * (Math.abs(a) / 1.35) ** 1.3 + bump(a) * 0.8;
    const o = smooth([[-10.2, -0.6, 0], ...th.slice(1, -1).map(a => pt(a, 9.8 + bump(a))), [10.2, -0.6, 0], ...th.slice(1, -1).reverse().map(a => pt(a, ri(a)))], true, 1);
    return { sh: [...O(o, c, 0.22), lines([-1.05, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1.05].map(a => [pt(a, 9.9), pt(a, ri(a) + 0.4)]), tone(c, "deep"), 0.55, 0.65, o), F(el(-3, -8.9, 2.8, 0.6, -0.4), tone(c, "light"), 0.55, o), F(el(5, -6.2, 2, 0.7, 0.9), tone(c, "shade"), 0.4, o)] }; } },
  baguette: { w: 76, ppcm: 6, c: "#D69B45", hold: { g: [5.2, -13.3] }, d: ({ c }) => ({ sh: baguette(c) }), hd: ({ c }) => ({ sh: stand(baguette(c), 36, 1.2) }) },
  pain_au_chocolat: { w: 16, ppcm: 14, c: "#D49237", hold: { g: [0, -3] }, d: ({ c }) => { const o = rrect(-7.2, -6.4, 14.4, 6.4, 3);
    return { sh: [S(ellipse(-7, -3.3, 1.1, 2.3), CHOC), S(ellipse(7, -3.3, 1.1, 2.3), CHOC), ...O(o, c, 0.2), lines([[[-4, -6], [-2.4, -0.4]], [[-1, -6.2], [0.6, -0.2]], [[2, -6.2], [3.8, -0.4]], [[5, -5.8], [6.4, -1]], [[-6.4, -5], [-5.2, -0.8]]], tone(c, "deep"), 0.4, 0.6, o), F(rrect(-5.4, -5.6, 8.6, 1.1, 0.5), tone(c, "light"), 0.7), F(ellipse(-7, -3.3, 0.6, 1.4), tone(CHOC, "light"), 0.9), F(ellipse(7, -3.3, 0.6, 1.4), tone(CHOC, "light"), 0.9)] }; } },
  pretzel: { w: 20, ppcm: 14, c: "#A5602A", hold: { g: [0, -8] }, d: ({ c }) => { const a: Vec2[] = [[-7.5, -3.6], [-3.6, -6.4], [0, -8.6], [4, -11.6], [8, -13.4], [10.2, -10.4], [8, -4.6]], b = a.map(([x, y]) => [-x, y] as Vec2), d = tone(c, "deep");
    return { sh: [R([[-8, -4.4], [-6, -1.8], [0, -1], [6, -1.8], [8, -4.4]], c, 2.6), R(b, c, 2.6), R(a, c, 2.6), R(a.slice(0, 4), tone(c, "light"), 0.7, { flat: true, opacity: 0.55 }), dots([[-7, -3.4], [-3, -6.2], [3, -10.4], [9, -12.6], [0, -1.4], [-5, -2.2], [5, -2.2], [9.6, -9.6], [-9.6, -9.6], [-8, -12.6]], 0.42, WHITE, 0.95), dots([[-1.4, -8.8], [1.4, -8.8]], 0.2, d, 0.5)] }; } },
  brioche: { w: 14, ppcm: 14, c: "#C8802C", hold: { g: [0, -5] }, d: ({ c }) => { const o = smooth([[-4.2, -0.4, 0], [-6, -2.8], [-6.8, -5], [-4.8, -6.4], [0, -6.8], [4.8, -6.4], [6.8, -5], [6, -2.8], [4.2, -0.4, 0]], true, 1);
    return { sh: [...O(o, c, 0.22), lines([[[-3.4, -0.8], [-5.2, -5.6]], [[-1.7, -0.5], [-2.6, -6.2]], [[0, -0.4], [0, -6.4]], [[1.7, -0.5], [2.6, -6.2]], [[3.4, -0.8], [5.2, -5.6]]], tone(c, "deep"), 0.35, 0.55, o), F(el(-3.4, -5.2, 1.6, 0.8, -0.6), tone(c, "light"), 0.55, o), ...E(0, -8.4, 2.7, 2.2, c), F(el(-0.9, -9.1, 1.1, 0.7, -0.3), tone(c, "light"), 0.6)] }; } },
  rye_loaf: { w: 38, ppcm: 10, c: "#6B4325", hold: { g: [4.8, -12.4] }, d: ({ c }) => ({ sh: [...at(rye(c), -6.9), ...at(ryeSlice(c), 13.1)] }), hd: ({ c }) => ({ sh: stand(rye(c), 12, 1.2) }) },
  cinnamon_bun: { w: 15, ppcm: 14, c: "#D9A25A", hold: { g: [0, -3] }, d: ({ c }) => { const sp: Vec2[] = Array.from({ length: 17 }, (_, i) => { const t = i / 16 * 4.4 * PI, r = 0.6 + i / 16 * 5.2; return [Math.cos(t) * r, -5.6 + Math.sin(t) * r * 0.5]; });
    return { sh: [...O(rrect(-6.6, -5.8, 13.2, 5.8, 2.6), c, 0.22), ...E(0, -5.6, 6.8, 3.4, tone(c, "light"), 0, 0.2), R(sp, tone(c, "deep"), 0.9, { flat: true, opacity: 0.8 }), R([[-5, -5.4], [-3.6, -7], [-2, -4.6], [0, -7.6], [2, -4.4], [3.6, -7], [5, -5.2]], WHITE, 0.55, { flat: true }), F(el(-3.6, -2.4, 1.4, 0.5), tone(c, "light"), 0.7)] }; } },
  pastel_de_nata: { w: 9, ppcm: 16, c: "#E3B25F", hold: { g: [0, -2.4] }, d: ({ c }) => { const o = smooth([[-3.5, -4.4, 0], [3.5, -4.4, 0], [3, -2.4], [2.5, 0, 0], [-2.5, 0, 0], [-3, -2.4]], true, 1);
    return { sh: [...O(o, c, 0.25), lines([[[-2, -4], [-1.6, -0.4]], [[0, -4.2], [0, -0.3]], [[2, -4], [1.6, -0.4]]], tone(c, "deep"), 0.3, 0.6, o), S(ellipse(0, -4.4, 3.7, 1.35), c), S(ellipse(0, -4.5, 3.1, 1.0), CUSTARD), dots([[-1.2, -4.7], [1, -4.3], [0.2, -4.9], [1.9, -4.7]], 0.32, tone(c, "deep"), 0.9, 0.2), F(el(-1.4, -4.2, 0.8, 0.28, -0.3), tone(CUSTARD, "edge"), 0.8)] }; } },
  stroopwafel: { w: 11, ppcm: 16, c: "#E2A650", hold: { g: [0, -1.6] }, d: ({ c }) => { const top = el(0, -1.9, 5.1, 2.2);
    return { sh: [S(ellipse(0, -1.1, 5.1, 2.2), tone(c, "shade")), ...O(poly(arcPoints(0, -1.5, 5.1, 2.1, 0, PI, 16)), tone(c, "shade"), 0.2), S(top, c), lines(Array.from({ length: 9 }, (_, i) => [[-6 + i * 1.5, -4.6], [-2 + i * 1.5, 0.8]] as Vec2[]).concat(Array.from({ length: 9 }, (_, i) => [[-6 + i * 1.5, 0.8], [-2 + i * 1.5, -4.6]] as Vec2[])), tone(c, "deep"), 0.3, 0.7, top), { path: el(0, -1.9, 4.6, 1.9), stroke: { color: tone(c, "deep"), width: 0.45 }, flat: true, opacity: 0.8 }, F(el(-1.6, -2.7, 1.8, 0.5, -0.2), tone(c, "light"), 0.6, top)] }; } },
  macarons: { w: 8, ppcm: 16, c: MACS[0], hold: { g: [0, -2.4] }, d: ({ c, i }) => ({ sh: macaron(i ? MACS[i % 5] : c) }) },
  sachertorte: { w: 20, ppcm: 14, c: "#4A2A1C", hold: { g: [0, -3] }, d: ({ c }) => { const sp = tone(c, "light"), side = tone(sp, "shade"), jam = (x: number, y: number, w: number) => F(rect(x, y, w, 0.75), JAM);
    // a wedge seen from the front right: glaze on top, sponge with two jam lines inside, a dollop of cream beside it
    const glazeFront = smooth([[-5.4, -5.2, 0], [5.4, -5.2, 0], [5.4, -4.1], [3.7, -3.7], [2.3, -4.3], [0.4, -3.8], [-1.5, -4.4], [-3.3, -3.8], [-5.4, -4.2]], true, 1);
    return { sh: [
      S(poly([[5.4, -5.2], [7.4, -6.9], [7.4, -1.7], [5.4, 0]]), side), F(poly([[5.4, -3], [7.4, -4.7], [7.4, -3.9], [5.4, -2.3]]), JAM, 0.9), F(poly([[5.4, -1.2], [7.4, -2.9], [7.4, -2.1], [5.4, -0.5]]), JAM, 0.9), F(poly([[5.4, -5.2], [7.4, -6.9], [7.4, -5.8], [5.4, -4.2]]), c, 0.95),
      S(rect(-5.4, -5.2, 10.8, 5.2), sp), jam(-5.4, -3.1, 10.8), jam(-5.4, -1.3, 10.8), F(glazeFront, c), F(rect(-5.4, -0.45, 10.8, 0.45), c), F(rect(-5.4, -3.1, 10.8, 0.2), tone(JAM, "light"), 0.6), F(rect(-5.4, -2.35, 10.8, 0.2), tone(JAM, "deep"), 0.5),
      ...lit(rect(-5.4, -5.2, 10.8, 5.2), sp, 0.2),
      ...O(poly([[-5.4, -5.2], [5.4, -5.2], [7.4, -6.9], [-3.4, -6.9]]), c, 0.2), F(poly([[-3.6, -6.2], [1.6, -6.2], [2.4, -6.65], [-2.8, -6.65]]), tone(c, "edge"), 0.55), F(el(3.6, -6, 1.2, 0.3, -0.5), tone(c, "light"), 0.7),
      ...O(lump(10.6, -1.4, 2.7, 1.4, 10, 0.1, 3), WHITE, 0.2), ...O(lump(10.6, -3.2, 2.1, 1.1, 10, 0.1, 5), WHITE, 0.2), ...O(lump(10.7, -4.6, 1.4, 0.9, 8, 0.1, 7), WHITE, 0.2), S(smooth([[9.5, -5, 0], [10.6, -6.9], [11.8, -5, 0]], true, 1), WHITE), F(el(9.6, -3.4, 0.5, 0.9, 0.3), tone(WHITE, "shade"), 0.35), F(el(9.9, -1.9, 0.9, 0.3, -0.2), WHITE, 0.9)] }; } },
}, {
  about: "Bakery pastries at real size: a croissant, a baguette (held upright, the way it goes home), a pain au chocolat, a pretzel, a brioche, a rye loaf (with a slice), a cinnamon bun, a pastel de nata, a stroopwafel, macarons (a different colour each) and a slice of Sachertorte with cream. No alcohol: the stories are for learners.",
  terms: [], tags: ["food", "bakery", "pastry", "bread", "sweet"],
});

// ---- plated --------------------------------------------------------------------------------------

/** A potato in its skin, or any cream-coloured lump. */
const tater = (x: number, y: number, r = 2.6, c = "#D9B766"): Shape[] => [...O(lump(x, y, r, r * 0.8, 9, 0.12, x), c, 0.25), dots([[x - r * 0.3, y - r * 0.2], [x + r * 0.4, y + r * 0.1]], 0.25, tone(c, "deep"), 0.7)];
const prawn = (x: number, y: number, a = 0): Shape[] => turn([R([[-3.4, 0.6], [-1.6, -1], [1, -1.2], [2.8, 0.2], [2.6, 1.8]], PRAWN, 2.2), lines([[[-1.4, -1.6], [-1.6, 0.4]], [[0.2, -1.8], [0, 0.2]], [[1.8, -1.2], [1.8, 0.6]]], tone(PRAWN, "deep"), 0.3, 0.8), dots([[-3.6, 0.2]], 0.3, DARK, 1)], mul(translate(x, y), rotate(a)));
const mussel = (x: number, y: number, a = 0): Shape[] => turn([...O(el(0, 0, 2.4, 1.5), MUSSEL, 0.3), F(el(0.4, 0.2, 1.4, 0.8), "#E8A26A", 0.9), F(el(-0.8, -0.8, 1, 0.3, -0.3), tone(MUSSEL, "edge"), 0.7)], mul(translate(x, y), rotate(a)));
/** A sausage lying along x, `l` long. */
const wurst = (x: number, y: number, l: number, a: number, c: string): Shape[] => turn([...O(rrect(-l / 2, -1.9, l, 3.8, 1.9), c, 0.25), lines([[[-l * 0.3, -1], [-l * 0.3, 1]], [[0, -1.2], [0, 1.1]], [[l * 0.3, -1], [l * 0.3, 1]]], tone(c, "deep"), 0.3, 0.55), F(rrect(-l / 2 + 1, -1.5, l * 0.6, 0.6, 0.3), tone(c, "light"), 0.7)], mul(translate(x, y), rotate(a)));

const plated = gen({
  paella: { w: 40, ppcm: 8, c: "#E5B63A", hold: { k: 0.6, g: [0, -3.4] }, hp: 10, d: ({ c }) => ({ sh: [
    R([[-17, -5], [-23, -6], [-22, -3.4], [-17, -3.8]], PAN, 1.1), R([[17, -5], [23, -6], [22, -3.4], [17, -3.8]], PAN, 1.1),
    ...O(poly(arcPoints(0, -3.4, 18, 7, 0, PI, 20)), PAN, 0.2), ...E(0, -5, 18.4, 7, PAN, 0, 0.1), S(ellipse(0, -5.4, 16.8, 6), tone(PAN, "light")), S(ellipse(0, -5.5, 15.8, 5.4), c),
    dots(Array.from({ length: 34 }, (_, i) => [Math.cos(i * 2.4) * (3 + (i * 7) % 11), -4.6 + Math.sin(i * 2.4) * (0.5 + (i * 5) % 3)] as Vec2), 0.34, tone(c, "deep"), 0.8, 0.22), ...prawn(-9, -5.6, -0.2), ...prawn(8, -6.2, 0.3), ...prawn(-1, -3.4, 3.3), ...prawn(13, -4, -0.4), ...mussel(-12, -3.2, 0.3), ...mussel(3, -6.4), ...mussel(-4.6, -6.2, -0.4), ...mussel(11, -2.6, 0.5),
    dots([[-6, -4.4], [2, -4], [5.4, -3.4], [-11, -5.6], [14, -5.6], [-2.4, -5], [8, -5]], 0.5, "#6AA84F", 1), R([[-6, -3.6], [-3, -5]], RED, 0.8), R([[5, -4.2], [8, -3]], RED, 0.8), ...wedge(-14.4, -4.6, 1), ...wedge(14, -2.4, 1)], em: [["steam", 0, -8, 12]] }),
    hd: () => ({ sh: served(24, "#C23B2B", [...O(lump(0, -2, 8, 3.2, 12, 0.08, 1), "#E5B63A", 0.2), ...prawn(-3, -3.4, -0.1), ...prawn(3.4, -2.8, 0.2), ...mussel(0, -1.4), dots([[-5, -2], [4, -1.2], [-1, -4.2]], 0.5, "#6AA84F"), ...wedge(8.6, -0.8)]) }) },
  fish_and_chips: { w: 28, ppcm: 10, c: "#2E5C9E", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(28, c, [
    ...[[-8, -2.4, 0.5], [-5.6, -1.2, 0.2], [-9, 0.4, -0.4], [-6.4, 0.8, -0.1], [-3.4, -2.2, 0.8], [-7.6, -3.4, -0.6], [-4.4, 0.6, 0.4]].flatMap(([x, y, a]) => turn(O(rrect(-3.4, -0.8, 6.8, 1.6, 0.6), "#EBC15A", 0.25), mul(translate(x - 1.4, y), rotate(a)))),
    ...O(lump(4.4, -1.4, 8, 3.6, 14, 0.1, 2), FISH, 0.25), F(el(1.6, -2.8, 4, 1, -0.2), tone(FISH, "light"), 0.7), dots([[2, -2], [6, -0.4], [8.4, -2.4], [4.4, -3], [10, -1.2], [0, -0.6]], 0.55, tone(FISH, "deep"), 0.6), ...O(lump(10.6, 2.4, 3, 1.5, 9, 0.12, 4), "#6FAF4A", 0.3), dots([[9, 2], [11, 2.6], [10, 1.4]], 0.4, "#9CD070", 0.9), ...wedge(-1.4, 3.4, 1)]) }) },
  waffle: { w: 26, ppcm: 10, c: "#B24A3A", hold: { k: 0.85 }, d: ({ c }) => { const w = el(0, -1.4, 9.4, 5.4);
    return { sh: served(26, c, [S(ellipse(0, -0.4, 9.4, 5.4), tone(WAF, "shade")), S(w, WAF), lines([...Array.from({ length: 8 }, (_, i) => [[-9 + i * 2.6, -6.4], [-3 + i * 2.6, 3.4]] as Vec2[]), ...Array.from({ length: 8 }, (_, i) => [[-9 + i * 2.6, 3.4], [-3 + i * 2.6, -6.4]] as Vec2[])], tone(WAF, "deep"), 0.5, 0.8, w), F(el(-2.4, -3.4, 4.4, 1.2, -0.2), tone(WAF, "light"), 0.6, w), dots([[-6, -2.4], [-3, 1.2], [4, -3.4], [6.4, 0.4], [0, -4.4]], 0.4, WHITE, 0.9),
      ...O(lump(3.4, -3.2, 3, 1.8, 10, 0.1, 5), WHITE, 0.2), ...[[-5.6, -0.4], [-1.6, 1.8], [4.4, 1.2]].flatMap(([x, y]) => [...O(smooth([[x - 2.2, y - 1.4, 0], [x + 2.2, y - 1.4, 0], [x + 0.4, y + 1.6], [x - 0.4, y + 1.6]], true, 1), "#D93A3A", 0.25), S(el(x, y - 1.6, 1.6, 0.7), "#4E9A3A"), dots([[x - 0.6, y - 0.4], [x + 0.7, y]], 0.2, "#F3D27A", 0.9)])]) }; } },
  churros: { w: 28, ppcm: 10, c: "#2E5C9E", hold: { k: 0.85 }, d: ({ c }) => ({ sh: served(28, c, [
    ...[[-9, -3.6, -0.5], [-8.4, -0.4, -0.35], [-7.6, 2.8, -0.2], [-6.4, 5.4, -0.1]].flatMap(([x, y, a]) => turn([...O(rrect(-8, -1.4, 16, 2.8, 1.3), "#D69A44", 0.25), lines(Array.from({ length: 14 }, (_, i) => [[-7 + i * 1.1, -1.3], [-7 + i * 1.1, 1.3]] as Vec2[]), tone("#D69A44", "deep"), 0.3, 0.7), dots(Array.from({ length: 10 }, (_, i) => [-7 + i * 1.5, i % 2 ? 0.5 : -0.6] as Vec2), 0.3, WHITE, 0.8)], mul(translate(x + 3, y), rotate(a)))),
    ...O(poly(arcPoints(10, -2, 4.4, 1.4, 0, PI, 12)), WHITE, 0.2), ...O(rrect(6.4, -5.8, 7.2, 4, 1), WHITE, 0.2), S(ellipse(10, -5.8, 3.6, 1.2), WHITE), S(ellipse(10, -5.8, 3, 0.9), tone(CHOC, "shade")), F(el(8.8, -6, 1.3, 0.25, -0.2), tone(CHOC, "light"), 0.8)]) }) },
  fondue: { w: 26, ppcm: 10, c: "#D8452B", hold: { g: [0, -5] }, d: ({ c }) => ({ sh: [
    ...O(rrect(-8, -3.4, 16, 2.2, 0.8), "#3A3B42", 0.2), ...O(poly([[-3, -3.4], [3, -3.4], [4.4, -6.4], [-4.4, -6.4]]), "#3A3B42", 0.2), F(poly([[-1.4, -6.4], [0, -9.4], [1.4, -6.4]]), "#F5A623", 0.95), F(poly([[-0.6, -6.4], [0, -8], [0.6, -6.4]]), "#FFE27A"),
    ...O(smooth([[-8.4, -12, 0], [8.4, -12, 0], [8, -9.4], [5.6, -7], [0, -6.4, 0], [-5.6, -7], [-8, -9.4]], true, 1), c, 0.24), R([[-8.4, -11], [-11.6, -11.4], [-11.4, -9.4]], c, 1.2), R([[8.4, -11], [11.6, -11.4], [11.4, -9.4]], c, 1.2), S(ellipse(0, -12, 8.6, 2.2), c), S(ellipse(0, -12.1, 7.7, 1.8), CHEESE), F(el(-2.6, -12.4, 2.6, 0.5, -0.1), tone(CHEESE, "light"), 0.9),
    ...[[-7, -1.2], [-4, -0.6], [7, -1.4]].flatMap(([x, y]) => O(rrect(x - 1.5, y - 3, 3, 3, 0.3), "#E4BC74", 0.3)), R([[7, -34], [3, -16], [1, -9]], STEEL, 0.5), R([[7.2, -34], [9, -42]], WOOD, 1.5), ...O(rrect(-1.2, -16, 2.6, 2.6, 0.3), "#E4BC74", 0.3), R([[0.2, -13.5], [0.4, -12.4]], CHEESE, 0.5)], em: [["steam", 0, -14, 7]] }),
    hd: () => ({ sh: [R([[0, 0], [0, -11]], WOOD, 1.5), R([[0, -11], [0, -20]], STEEL, 0.5), ...O(rrect(-1.6, -24, 3.2, 3.2, 0.4), "#E4BC74", 0.3), R([[0.2, -20.6], [0.4, -19], [0, -17.8]], CHEESE, 0.8), F(el(0.1, -17, 0.7, 0.8), CHEESE, 0.95), F(el(-0.5, -23.2, 0.6, 0.5), tone(CHEESE, "light"), 0.8)] }) },
  raclette: { w: 28, ppcm: 10, c: "#B24A3A", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(28, c, [
    ...tater(-9, 0.4, 3.6), ...tater(-3, 2, 3.8), ...tater(-6.4, -3, 3.4), ...O(lump(-5.6, -3.4, 7.4, 2.6, 12, 0.12, 3), "#F4D060", 0.2), F(el(-7.6, -4.2, 3.4, 0.7, -0.2), tone("#F4D060", "light"), 0.8),
    ...O(smooth([[-10.6, -2, 0], [-11, 1.6], [-10, 1.8], [-9.6, -0.2, 0]], true, 1), "#F4D060", 0.25), ...O(smooth([[-2.4, -2.2, 0], [-1.8, 2.2], [-0.6, 2.2], [-0.4, -1.4, 0]], true, 1), "#F4D060", 0.25), ...[[5.6, 0.6], [8, 2.2], [9.2, -0.6]].flatMap(([x, y]) => O(rrect(x - 2.2, y - 0.9, 4.4, 1.8, 0.9), "#5F9A3C", 0.3)), ...[[5.4, -3.6], [8.4, -4.2], [10.4, -2.8]].flatMap(([x, y]) => O(ellipse(x, y, 1.2), "#F2EBD6", 0.25)), dots([[-4, -4.2], [-8, -4], [-1.4, 0.4]], 0.26, "#2E2F35", 0.8)]) }) },
  schnitzel: { w: 32, ppcm: 10, c: "#2E5C9E", hold: { k: 0.8 }, d: ({ c }) => { const o = lump(-1, -1, 13.4, 6.8, 18, 0.07, 1);
    return { sh: served(32, c, [...O(o, SCH, 0.2), dots(Array.from({ length: 36 }, (_, i) => [-1 + Math.cos(i * 2.1) * (2 + (i * 5) % 11), -1 + Math.sin(i * 2.1) * (1 + (i * 3) % 4.4)] as Vec2), 0.5, tone(SCH, "light"), 0.6, 0.38), dots(Array.from({ length: 22 }, (_, i) => [-1 + Math.cos(i * 3.3) * (1 + (i * 7) % 11), -1 + Math.sin(i * 3.3) * (0.6 + (i * 5) % 4.6)] as Vec2), 0.42, tone(SCH, "deep"), 0.5, 0.3), F(el(-5, -4, 5, 1.1, -0.15), tone(SCH, "light"), 0.55, o),
      ...O(ellipse(3.4, -1.6, 3, 1.6), LEMON, 0.2), lines([[[3.4, -1.6], [3.4, -3]], [[3.4, -1.6], [1.2, -2.2]], [[3.4, -1.6], [5.6, -2.2]], [[3.4, -1.6], [4.6, -0.6]], [[3.4, -1.6], [2, -0.6]]], "#FBF1A6", 0.25, 0.9), ...sprig(-6, -2, 1.1), ...O(lump(11, 3.6, 4.4, 2.2, 10, 0.1, 6), "#EFE3BC", 0.25), dots([[10, 3], [12, 4], [9.6, 4.4]], 0.3, "#6AA84F", 0.9)]) }; } },
  sausage_mustard: { w: 28, ppcm: 10, c: "#B24A3A", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(28, c, [
    ...O(lump(-8, 1.6, 3.6, 2.2, 10, 0.1, 7), "#E3B66E", 0.25), ...O(lump(9, 1.4, 4.4, 2.8, 12, 0.12, 8), KRAUT, 0.25), lines([[[7, 0.6], [9.6, 2.4]], [[10, 0.2], [11.6, 2.8]]], tone(KRAUT, "deep"), 0.3, 0.6), ...wurst(0, -2.6, 20, -0.18, "#B05A34"), ...wurst(-0.4, 0.6, 20, -0.12, "#B8643A"), R([[-8, -1.6], [-6, -3.8], [-4, -1.2], [-2, -3.6], [0, -1], [2, -3.4], [4, -0.8], [6, -3.2]], MUSTARD, 1.1, { flat: true }), F(ellipse(-11, 3.4, 1.4, 0.7), MUSTARD, 0.95), ...sprig(11, -2.6, 1)]) }) },
  smorrebrod: { w: 30, ppcm: 10, c: "#5A3A24", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(30, "#B8322A", [
    ...O(poly([[-11, -1.6], [11, -1.6], [13, -4.4], [-9, -4.4]]), c, 0.2), ...O(rect(-11, -1.6, 22, 1.8), tone(c, "shade"), 0.2), F(poly([[-10, -2], [10, -2], [11.6, -4], [-8.4, -4]]), "#F1DE9A", 0.8),
    ...[-6, 0, 6].flatMap((x, i) => O(el(x + 1, -5.6 + (i % 2) * 0.4, 2.6, 1.4), "#FBF8F2", 0.2)), ...[-6, 0, 6].map((x, i) => F(el(x + 1, -5.6 + (i % 2) * 0.4, 1, 0.5), "#F2B83A", 1)),
    ...[[-8, -6.8, 0.6], [-3, -7.2, -0.2], [3, -7, 0.4], [8, -6.6, 0.1]].flatMap(([x, y, a]) => turn(O(smooth([[-1.8, 0.6, 0], [-1.4, -1], [0.6, -1.4], [1.8, 0], [1.2, 1.2]], true, 1), "#F29A82", 0.25), mul(translate(x, y), rotate(a)))), ...sprig(-10, -5, 1.3), ...sprig(11, -5.4, 1.2), ...sprig(0, -8, 1.1), ...O(ellipse(9.4, -4.6, 1.5, 0.9), "#D93A3A", 0.2)]) }) },
  croque_monsieur: { w: 28, ppcm: 10, c: "#2E5C9E", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(28, c, [
    ...O(rect(-7, -3.6, 14, 4.8), BREAD, 0.2), F(rect(-7, -2.6, 14, 1), "#E8A0A0", 1), F(rect(-7, -1.2, 14, 0.8), "#F4E1A2", 1), lines([[[-7, -3.6], [-7, 1.2]]], tone(BREAD, "light"), 0.3, 0.6),
    ...O(poly([[-7, -3.6], [7, -3.6], [9.4, -6.4], [-4.6, -6.4]]), TOPC, 0.2), F(poly([[-6, -3.9], [6, -3.9], [8, -6], [-4, -6]]), tone(TOPC, "light"), 0.8), dots([[-3, -4.6], [1, -5.4], [4, -4.4], [6.4, -5.4], [-1, -3.9]], 0.65, tone(TOPC, "deep"), 0.75, 0.38), ...O(lump(-11, 0.4, 3.4, 1.8, 10, 0.2, 9), "#6FAF4A", 0.3), ...O(ellipse(-10, 3.2, 2.2, 1.3), "#D93A3A", 0.2), ...sprig(10, 1.2, 1.2)]) }) },
  tapas: { w: 36, ppcm: 8, c: "#8A5A3C", hold: { k: 0.75 }, d: ({ c }) => ({ sh: [
    ...O(poly(arcPoints(0, -2.4, 17, 6.4, 0, PI, 18)), tone(c, "deep"), 0.2), ...E(0, -3.6, 17.6, 6.4, c, 0, 0.18), S(ellipse(0, -3.8, 15.4, 5.4), tone(c, "light")),
    ...O(poly(arcPoints(-9, -4.4, 4.2, 1.4, 0, PI, 10)), WHITE, 0.2), S(ellipse(-9, -5.4, 4.4, 1.7), WHITE), S(ellipse(-9, -5.6, 3.6, 1.2), "#B8341F"), ...[[-10.4, -6.4], [-8, -6.4], [-9.4, -5.4], [-7.4, -5.2]].flatMap(([x, y]) => O(rrect(x - 0.8, y - 0.8, 1.6, 1.6, 0.3), "#E8C970", 0.3)),
    ...O(poly([[-1, -5.4], [7, -5.4], [4.6, -9.6]]), "#F2CD52", 0.2), F(poly([[0.2, -5.8], [6, -5.8], [4.4, -8.6]]), "#F8E48A", 0.8), F(rect(-1, -6.4, 8, 0.6), "#C9701F", 0.7), F(poly([[-1, -5.4], [7, -5.4], [7, -6.6], [-1, -6.6]]), "#FBF1BA", 0.5),
    ...[[9, -3.2, 0.3], [12, -4.6, -0.2]].flatMap(([x, y, a]) => turn(O(smooth([[-2.4, 0, 0], [-1.6, -1.6], [1.6, -1.6], [2.4, 0, 0], [0, 0.8]], true, 1), "#E58C8C", 0.25), mul(translate(x, y), rotate(a)))),
    ...[[-3.4, -1.8], [-1, -1.6], [1.4, -1.8]].flatMap(([x, y]) => [...O(rrect(x - 1.4, y - 1.4, 2.8, 1.4, 0.4), "#E4BC74", 0.3), ...O(ellipse(x, y - 2, 1.1, 0.9), "#6B7A32", 0.3), F(ellipse(x, y - 2, 0.35, 0.3), "#D93A3A"), R([[x, y - 4], [x, y - 0.4]], "#E8D8A8", 0.2)]), ...O(ellipse(-12.4, -1.6, 1.5, 1), "#6B7A32", 0.3), ...O(ellipse(-9.6, -1.2, 1.5, 1), "#4A5A28", 0.3)] }) },
  moussaka: { w: 26, ppcm: 10, c: "#B24A3A", hold: { k: 0.8 }, d: ({ c }) => ({ sh: served(26, c, [
    ...O(rect(-6.4, -4.6, 12.8, 5.6), "#F0C25A", 0.2), F(rect(-6.4, -4.6, 12.8, 1.8), "#F4D487", 1), F(rect(-6.4, -2.8, 12.8, 1.2), "#6B3A6E", 1), F(rect(-6.4, -1.6, 12.8, 1.6), "#9A4430", 1), F(rect(-6.4, -0.2, 12.8, 1.1), "#E8D69A", 1), lines([[[-6.4, -1.6], [6.4, -1.6]]], "#5A2E1A", 0.3, 0.6), dots([[-4, -1], [-1, -0.8], [3, -1.1], [5, -0.7]], 0.3, "#C23B2B", 0.8),
    ...O(poly([[-6.4, -4.6], [6.4, -4.6], [9, -7.4], [-3.8, -7.4]]), "#EBB84E", 0.2), dots([[-2, -6], [1.6, -6.6], [5, -5.8], [-0.6, -5], [3, -5.2]], 0.7, "#A96A28", 0.8, 0.38), F(poly([[-4.8, -5.2], [4, -5.2], [6, -7], [-2.6, -7]]), "#F7DA8C", 0.55), ...sprig(8.4, -4.6, 1.3), ...O(lump(-10, 0.6, 3.2, 1.6, 10, 0.2, 11), "#5F9A3C", 0.3)]) }) },
  pierogi: { w: 28, ppcm: 10, c: "#2E5C9E", hold: { k: 0.8 }, d: ({ c }) => { const pg = (x: number, y: number, a: number): Shape[] => turn([...O(smooth([[-4, 0.6, 0], [-3.4, -1.8], [0, -3], [3.4, -1.8], [4, 0.6, 0], [0, 1.6]], true, 1), DOUGH, 0.25), dots([-3.4, -2.4, -1.2, 0, 1.2, 2.4, 3.4].map((u, i) => [u, -2.8 + Math.abs(u) * 0.55 + (i % 2) * 0.1] as Vec2), 0.28, tone(DOUGH, "deep"), 0.9), F(el(-1.4, -0.4, 1.8, 0.4), WHITE, 0.55)], mul(translate(x, y), rotate(a)));
    return { sh: served(28, c, [...pg(-6, -1.6, -0.3), ...pg(1, -3, 0.15), ...pg(7, -0.2, 0.5), ...pg(-3, 2.4, 0.1), ...pg(4, 2.6, -0.2), ...O(lump(-10, -1.4, 3.6, 2, 12, 0.2, 12), RIND, 0.25), dots([[-11, -1.8], [-9, -0.6], [-10.6, 0], [-8.6, -2.2]], 0.5, tone(RIND, "deep"), 0.8), ...O(lump(10.4, 4, 3, 1.6, 10, 0.12, 13), WHITE, 0.2), ...sprig(10.4, 3.4, 1.1)]) }; } },
}, {
  about: "A plated dish at real size, served on a plate (the colour is its rim): paella in its pan, fish and chips, a waffle, churros with chocolate, a cheese fondue, raclette, a schnitzel, sausage with mustard, a smørrebrød, a croque monsieur, tapas on a board, moussaka and pierogi. The pan and the fondue are held as a plate and a fork with bread. No alcohol: no wine, beer or schnapps, in the dish or beside it. For pasta use `dish` makarna.",
  terms: [], tags: ["food", "dish", "bakery"],
});

// ---- cafe_drink ----------------------------------------------------------------------------------

const cafe = gen({
  cappuccino: { w: 22, ppcm: 14, c: "#F4F0E6", hold: { g: [5, -6] }, d: ({ c }) => ({ sh: [...cup(10, 6.4, c, "#9C6A3A", 15), S(ellipse(0, -6.2, 4.4, 1.55), "#F6EAD2"), ...[0].map(() => F(smooth([[0, -5.6, 0], [-1.6, -6.9], [-0.8, -7.6], [0, -7], [0.8, -7.6], [1.6, -6.9]], true, 1), "#9C6A3A", 0.9)), F(el(0, -6.5, 1.4, 0.38), WHITE, 0.5), F(el(-2.4, -6.4, 1.4, 0.3, -0.2), "#FFFFFF", 0.7)], em: [["steam", 0, -8, 4], ["steam", 1.6, -8, 3]] }) },
  hot_chocolate: { w: 16, ppcm: 14, c: "#C45A3B", hold: { g: [6.6, -6.5] }, d: ({ c }) => ({ sh: [
    R([[4.6, -10.4], [8.8, -9.6], [9, -4.4], [4.2, -3.2]], c, 1.4), ...O(rrect(-4.6, -11.6, 9.2, 11.6, [1.4, 1.4, 2.6, 2.6]), c, 0.26), F(rect(-4.6, -7.6, 9.2, 1.1), tone(c, "deep"), 0.6), F(rect(-4.6, -5.4, 9.2, 0.5), tone(c, "light"), 0.6), S(ellipse(0, -11.6, 4.6, 1.4), c), S(ellipse(0, -11.7, 3.9, 1.05), "#4A2A1C"),
    ...O(lump(0, -12.8, 3.9, 1.7, 10, 0.1, 2), WHITE, 0.2), ...O(smooth([[-2.4, -13.4, 0], [-1.6, -15.6], [0, -16.8], [1.6, -15.6], [2.4, -13.4, 0]], true, 1), WHITE, 0.2), dots([[-1, -13.8], [1.4, -14.4], [0, -12.6]], 0.35, tone(CHOC, "light"), 0.7), ...O(rrect(-3.6, -14.2, 1.8, 1.6, 0.5), "#F2A7B8", 0.25), ...O(rrect(1.6, -14, 1.8, 1.6, 0.5), WHITE, 0.25)], em: [["steam", 0, -17, 4]] }) },
  teapot_set: { w: 34, ppcm: 10, c: "#4C78B5", hold: { k: 0.8, g: [0, -4] }, d: ({ c }) => ({ sh: [
    ...O(poly(arcPoints(0, -2, 17, 3.2, 0, PI, 16)), WOOD, 0.2), S(ellipse(0, -2.6, 17, 3.2), tone(WOOD, "light")), F(el(-3, -3.2, 10, 1.1), tone(WOOD, "edge"), 0.5),
    R([[7.6, -9.4], [13, -10.6], [13.4, -5.4], [8.2, -4.4]], c, 1.4), R([[-9.4, -6], [-12.6, -9.4], [-15.6, -10.2]], c, 2), ...O(smooth([[-9.4, -3.4, 0], [-9.6, -7.4], [-6.4, -11.6], [0, -12.6], [6.4, -11.6], [9.6, -7.4], [9.4, -3.4, 0]], true, 1), c, 0.26), F(rect(-9.6, -6.6, 19.2, 1.4), WHITE, 0.85), dots([[-6, -6], [-2, -6], [2, -6], [6, -6]], 0.5, c, 1), ...O(smooth([[-4.4, -12.4, 0], [-3, -14], [3, -14], [4.4, -12.4, 0]], true, 1), c, 0.26), ...O(ellipse(0, -14.8, 1.2), WHITE, 0.2), F(el(-4.2, -9.4, 2, 1.3, -0.6), WHITE, 0.4),
    ...at(cup(7.4, 4.6, WHITE, "#A85A28", 11), 12.4, -3.6)], em: [["steam", -15.8, -10.6, 5]] }) },
  lemonade: { w: 14, ppcm: 14, c: "#F3E37A", hold: { g: [7.8, -9] }, d: ({ c }) => ({ sh: [
    R([[5.6, -17.6], [10, -16.4], [10.4, -7.4], [5.2, -5.6]], "#C9D8DC", 1.4), ...O(smooth([[-5.6, -18.6, 0], [-3.4, -19.8], [5.8, -18.8, 0], [5.4, -9], [5, -0.4, 0], [-5, -0.4, 0], [-5.6, -9]], true, 1), "#DDEBEE", 0.24),
    S(rrect(-4.8, -15.6, 9.6, 14.8, [0, 0, 1.8, 1.8]), c), F(rect(-4.8, -15.6, 9.6, 1.2), tone(c, "light"), 0.7), ...[[-2.4, -12], [1.6, -9.6], [-1.6, -6.4], [2.4, -13.2]].flatMap(([x, y]) => O(rrect(x - 1.5, y - 1.5, 3, 3, 0.6), WHITE, 0.25)).map(s => ({ ...s, opacity: 0.6 })),
    ...[[-1.6, -14.6], [2, -5.4]].flatMap(([x, y]) => [...O(ellipse(x, y, 2.5), LEMON, 0.2), F(ellipse(x, y, 1.9), tone(LEMON, "edge"), 0.9), lines([[[x, y - 1.8], [x, y + 1.8]], [[x - 1.7, y - 0.9], [x + 1.7, y + 0.9]], [[x - 1.7, y + 0.9], [x + 1.7, y - 0.9]]], LEMON, 0.25, 0.9)]),
    ...O(el(-2.8, -19.4, 1.8, 0.9, -0.4), MINT, 0.3), ...O(el(-0.6, -19.8, 1.8, 0.9, 0.3), tone(MINT, "light"), 0.3), F(rect(-4.8, -2.4, 9.6, 1.2), WHITE, 0.4), F(rect(-5, -18.4, 1.2, 17), WHITE, 0.4)] }) },
}, {
  about: "Café drinks at real size, each in its own cup: a cappuccino with a milk-foam heart (on a saucer), a hot chocolate with whipped cream and marshmallows, a teapot with a cup on a tray, and a jug of lemonade with lemon, ice and mint (held by its handle). Steam rises from the hot ones. No alcohol: the stories are for learners. For a small black coffee use `cup` fincan.",
  terms: [], tags: ["food", "drink", "cafe", "bakery"],
});

// ---- deli ----------------------------------------------------------------------------------------

/** A wedge of cheese lying, 9 cm: the cut face with its holes, the rind round the back. */
const slice = (c: string): Shape[] => [...O(poly([[-4.4, -4], [4.4, -4], [6.2, -5.6], [-2.6, -5.6]]), tone(c, "light"), 0.2), ...O(rect(-4.4, -4, 8.8, 4), c, 0.22), dots([[-2.4, -2.4], [1.4, -1.4], [2.8, -3]], 0.7, tone(c, "deep"), 0.7, 0.5), F(rect(-4.4, -4, 8.8, 0.8), RIND, 1), F(rect(3.4, -4, 1, 4), RIND, 0.9)];
/** A ham leg lying, its hoof to the right (46 cm): fat, lean and a cut face. */
const ham = (c: string): Shape[] => {
  const o = smooth([[-23, -12, 0], [-21, -20], [-12, -23], [0, -20], [12, -12], [20, -6], [24, -3.4], [22, -1.4], [17, -2.4], [8, -2], [-12, -1], [-21, -4]], true, 1);
  return [...O(o, c, 0.18), F(el(-8, -19.4, 12, 3, 0.1), tone(c, "light"), 0.55, o), F(el(-13, -9, 6, 8.4, 0.05), "#EDDDBC", 1, o), F(el(-13, -9, 4.2, 6.2, 0.05), "#C9503E", 1, o), dots([[-14, -11], [-12, -7], [-15, -8]], 0.5, "#EDDDBC", 0.8), ...O(smooth([[22, -4.4, 0], [25, -5.4], [27, -3.2], [25.6, -1.4], [22, -1.6, 0]], true, 1), "#2A2A2A", 0.3), lines([[[-4, -17], [4, -10]], [[2, -18], [9, -10]]], tone(c, "deep"), 0.5, 0.5, o)];
};
const deli = gen({
  cheese_wheel: { w: 36, ppcm: 8, c: "#EFCB62", hold: { k: 1, g: [0, -3.4] }, d: ({ c }) => ({ sh: [
    ...O(poly(arcPoints(-3, -4.4, 15, 3.6, 0, PI, 18)), RIND, 0.2), ...O(rrect(-18, -12.4, 30, 8, 0.4), RIND, 0.22), F(rect(-18, -10.4, 30, 0.8), tone(RIND, "deep"), 0.5), S(el(-3, -12.2, 15, 5), tone(RIND, "light")), S(el(-3, -12.6, 13.6, 4.2), c), dots([[-8, -12.4], [-1, -13.6], [3, -11.8], [-5, -10.6], [6, -13.4]], 1, tone(c, "deep"), 0.6, 0.6), F(el(-8, -14, 5, 0.9, -0.1), tone(c, "light"), 0.7),
    ...at(slice(c), 20, 0)], em: [] }), hd: ({ c }) => ({ sh: slice(c) }) },
  ham_leg: { w: 56, ppcm: 6, c: "#8A3B2E", hold: { k: 0.55, g: [11.5, -37] }, d: ({ c }) => ({ sh: [...O(rrect(-22, -3.2, 44, 3.2, 1), WOOD, 0.2), ...at(ham(c), 0, -3.2)] }), hd: ({ c }) => ({ sh: stand(ham(c), 25, 1.2) }) },
  mustard_pot: { w: 12, ppcm: 16, c: "#F5EFE0", hold: { g: [0, -3.6] }, d: ({ c }) => ({ sh: [
    R([[0.4, -6.6], [3, -10.4], [5.6, -13.4]], tone(WOOD, "light"), 1.1), ...O(ellipse(5.8, -13.6, 1, 1.6), tone(WOOD, "light"), 0.3), F(ellipse(5.6, -12.6, 0.8, 0.9), MUSTARD), ...O(rrect(-4.4, -6.6, 8.8, 6.6, [1, 1, 2.4, 2.4]), c, 0.24), S(ellipse(0, -6.6, 4.4, 1.1), c), S(ellipse(0, -6.6, 3.6, 0.8), MUSTARD), F(el(-1, -6.8, 1.4, 0.25), tone(MUSTARD, "light"), 0.9), F(rect(-4.4, -4.4, 8.8, 1.8), MUSTARD, 1), dots([[-2.4, -3.5], [0, -3.5], [2.4, -3.5]], 0.32, tone(MUSTARD, "deep"), 0.8)] }) },
}, {
  about: "Deli goods at real size: a cheese wheel with a wedge cut out (held as the wedge), a ham leg on its stand (carried by the hock), and a pot of mustard with its wooden dipper. No alcohol: the stories are for learners. An olive-oil tin is `pantry` olive_oil.",
  terms: [], tags: ["food", "deli", "bakery", "cheese"],
});

// the items promoted from stories into this family are drawings, not code (drawing/promote.ts; DRAWING.md *Promoting*)
const drawn = drawnFamily(DRAWN);
export const set: Record<string, PieceDef> = { ...drawn.set };
export const props: Record<string, PieceDef> = { pastry, plated, cafe_drink: cafe, deli, ...drawn.props };
