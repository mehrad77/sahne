// Props of the garden family (STYLE.md): nature bits, potted plants and garden tools. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip: what sits on the hand is lifted LIFT clear
// of the fist, what hangs (a can, a bag, a glove) hangs below the grip, what is long (a spade, a barrow) tilts until it reaches
// the floor. Words are `text` on the first flat, never letters in the art.

import { Path, smooth, ellipse, rect, rrect, poly, band, tone, mul, rotate, scale, translate, groupBounds, type Affine, type PieceDef, type PieceOut, type FlatSpec, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, flip, holed, type Pt } from "./draw.ts";

const PI = Math.PI, SOIL = "#4A3A30", INK = "#2B2420", LIFT = -7.5, GRIP = 46, TERRA = "#B8562F", GRN = "#4E7A48";

// ---- helpers -------------------------------------------------------------------------------------------

type Ctx = { r: Rng; p: Record<string, unknown>; i: number; n: number; held: boolean; tx: TextSpec[] };
/** One kind: its slot `w` in a row (`gap` apart), `ppcm`, `d` draws item `c.i` at x, or `all` the whole lot of `n`; `hn` how many show held; `h` the held look: a drop in cm (default LIFT) or a function of the shapes; `hp` its ppcm. */
type Kind = { w: number; gap?: number; ppcm: number; hp?: number; edge?: number; hn?: number; d?: (x: number, c: Ctx) => Shape[]; all?: (n: number, c: Ctx) => Shape[]; h?: number | ((sh: Shape[], c: Ctx) => Shape[]) };

const cnt = (v: unknown, d = 1) => Math.max(1, Math.min(24, Math.round(num(v, d))));
/** Shapes moved by an affine, strokes, clips and all. */
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * Math.hypot(m[0], m[1]) } } : {}), ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Paint printed on the paper (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a stem, a rod, a rim. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Printed lines: segments [x0, y0, x1, y1] as one flat shape. */
const ln = (segs: number[][], color: string, width: number, op = 0.6, clip?: Path): Shape => { const path = new Path(); for (const [a, b, c, d] of segs) path.moveTo(a, b).lineTo(c, d); return { path, stroke: { color, width, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }; };
/** Light from the upper left on an outline spanning x0…x1, y0…y1: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.2): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** The shaded crescent of a round thing (low right, away from the light) cut to its outline `o`. */
const cres = (o: Path, x: number, y: number, rx: number, ry: number, c: string, op = 0.4): Shape => ({ path: new Path().add(ellipse(x, y, rx, ry)).add(ellipse(x - rx * 0.22, y - ry * 0.22, rx * 0.86, ry * 0.86)), fill: tone(c, "shade"), flat: true, evenodd: true, opacity: op, clip: o });
/** A round thing: a crescent of shade low right, a glint high left. */
const ball = (x: number, y: number, rx: number, ry: number, c: string): Shape[] => { const o = ellipse(x, y, rx, ry); return [S(o, c), cres(o, x, y, rx, ry, c), F(ellipse(x - rx * 0.38, y - ry * 0.42, rx * 0.3, ry * 0.2), tone(c, "light"), 0.75)]; };
/** An irregular rounded outline. */
const blob = (r: Rng, x: number, y: number, rx: number, ry: number, j = 0.14, m = 9): Path => smooth(Array.from({ length: m }, (_, i) => { const a = i / m * PI * 2, k = 1 + r.range(-j, j); return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k] as Vec2; }), true, 1);
/** `n` things `w` wide side by side, `gap` apart, centred; `f(x, i)` draws each. */
const row = (n: number, w: number, gap: number, f: (x: number, i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => f(-(n * w + (n - 1) * gap) / 2 + w / 2 + i * (w + gap), i)).flat();
/** A pointed leaf `l` long, `w` × l wide, its base at (x, y), pointing at angle `a` (0 right, up negative), midrib printed. */
const lf = (x: number, y: number, l: number, a: number, c: string, w = 0.46): Shape[] => T([P([[0, 0, 0], [l * 0.45, -l * w * 0.5], [l * 0.78, -l * w * 0.28], [l, 0, 0], [l * 0.78, l * w * 0.28], [l * 0.45, l * w * 0.5]], c), L([[l * 0.08, 0], [l * 0.9, 0]], tone(c, "light"), Math.max(0.2, l * 0.035), 0.55)], mul(translate(x, y), rotate(a)));
/** A lobed (oak, chrysanthemum) leaf, the same way. */
const oak = (x: number, y: number, l: number, a: number, c: string): Shape[] => { const up: Pt[] = [], dn: Pt[] = []; for (let k = 1; k < 9; k++) { const t = k / 9, w = l * 0.3 * Math.sin(PI * t) * (k % 2 ? 1.2 : 0.7); up.push([t * l, -w]); dn.unshift([t * l, w]); } return T([P([[0, 0, 0], ...up, [l, 0, 0], ...dn], c), L([[l * 0.05, 0], [l * 0.92, 0]], tone(c, "deep"), l * 0.03, 0.5)], mul(translate(x, y), rotate(a))); };
/** A prop of one flat (`id`), its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.45): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}
/** Turn shapes about the grip `g` towards the side `dir` until their lowest point lies GRIP below it (the floor under a hanging hand); the grip becomes the origin. */
function tilt(sh: Shape[], g: Vec2, dir = 1): Shape[] {
  const at = (t: number) => T(sh, mul(rotate(-dir * t), translate(-g[0], -g[1]))), low = (a: Shape[]) => groupBounds({ shapes: a, edge: 0 })[3];
  if (low(at(0)) <= GRIP) return at(0);
  let a = 0, b = PI / 2;
  for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if (low(at(m)) > GRIP) a = m; else b = m; }
  return at(b);
}
/** A colour param, else one of `d` (seeded) or `d`. */
const pc = (c: Ctx, d: string | string[]) => typeof c.p.color === "string" ? hex(c.p.color, Array.isArray(d) ? d[0] : d) : Array.isArray(d) ? c.r.pick(d) : d;
/** The draw of a generator over a table of kinds, the first the default. */
const make = (id: string, kinds: Record<string, Kind>): PieceDef["draw"] => (p, r) => {
  const held = !!p.held, k = kinds[str(p.kind, "")] ?? Object.values(kinds)[0], n = cnt(p.n), m = held ? Math.min(n, k.hn ?? 1) : n, tx: TextSpec[] = [], c: Ctx = { r, p, i: 0, n: m, held, tx };
  let sh = k.all ? k.all(m, c) : row(m, k.w, held ? -k.w * 0.5 : k.gap ?? 2, (x, i) => k.d!(x, { ...c, i }));
  if (held) { const h = k.h ?? LIFT; if (typeof h === "function") sh = h(sh, c); else { sh = mv(sh, 0, h); for (const t of tx) t.y += h; } }
  return one(id, sh, held && k.hp ? k.hp : k.ppcm, held, tx.length ? { text: tx } : {}, k.edge);
};
/** A variant of its own name for every kind. */
const vs = (t: Record<string, Kind>) => Object.fromEntries(Object.keys(t).map(k => [k, { kind: k }]));
const N = { type: "int", min: 1, max: 24, default: 1 } as const;

// ---- nature bits ---------------------------------------------------------------------------------------

const AUTUMN = ["#C8501E", "#E0902A", "#D9B23A", "#A8321E", "#8A5A2A", "#B8662A"], ROCKS = ["#9A9FA3", "#8C8479", "#B3A89A", "#7B8085", "#A39380"], SHELLS = ["#F0D2C2", "#EBCBA8", "#F3E6D0", "#E9B9B0"], FEATHERS = ["#F4F1EA", "#B9BDC2", "#9A7A55", "#3A5F8A"];

const rays = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, m: number) => Array.from({ length: m }, (_, k) => { const a = a0 + (a1 - a0) * k / Math.max(1, m - 1); return [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]; });

/** A scallop shell of radius s, hinge at (x, 0). */
const scallop = (x: number, s: number, c: string): Shape[] => {
  const pts: Pt[] = [[x - 1.2, 0, 0], [x + 1.2, 0, 0]];
  for (let k = 0; k <= 14; k++) { const a = -PI * (0.1 + 0.8 * k / 14), q = s * (k % 2 ? 0.94 : 1); pts.push([x + Math.cos(a) * q, -0.4 + Math.sin(a) * q]); }
  const o = P(pts, c);
  return [o, ln(rays(x, -0.4, 0.8, s * 0.88, -PI * 0.14, -PI * 0.86, 8), tone(c, "deep"), 0.3, 0.35, o.path), F(ellipse(x - s * 0.3, -s * 0.55, s * 0.22, s * 0.12), tone(c, "light"), 0.7), F(rrect(x - 1.3, -1, 2.6, 1, 0.4), tone(c, "shade"), 0.6)];
};
/** A turret shell 4.2 s tall, base radius s, at (x, 0): slanted whorl lines, its mouth low right. */
const whorl = (x: number, s: number, c: string): Shape[] => {
  const side = (d: number) => [0, 1, 2, 3].flatMap(j => [[x + d * s * (1.05 - 0.2 * j), -s * (0.7 + 0.85 * j)], [x + d * s * (0.74 - 0.2 * j), -s * (1.4 + 0.85 * j), 0]] as Pt[]);
  const o = P([...side(-1), [x, -s * 4.4, 0], ...side(1).reverse(), [x + s * 0.75, -s * 0.1], [x, 0, 0], [x - s * 0.7, -s * 0.1]], c);
  return [o, cres(o.path, x + s * 0.2, -s * 1.6, s * 1.1, s * 2.2, c, 0.35), ln([0, 1, 2, 3].flatMap(j => { const hw = s * (0.95 - j * 0.2), y = -s * (1.4 + 0.85 * j); return [[x - hw, y + s * 0.3, x + hw, y - s * 0.12], [x - hw * 0.9, y - s * 0.38, x + hw * 0.9, y - s * 0.7]]; }), tone(c, "shade"), 0.3, 0.8, o.path), F(ellipse(x + s * 0.35, -s * 0.5, s * 0.5, s * 0.3), tone(c, "deep"), 0.7, o.path), F(ellipse(x - s * 0.45, -s * 1.8, s * 0.12, s * 0.6), tone(c, "light"), 0.7)];
};
/** A pine cone 11 cm tall, scales in rows from the tip down. */
const cone = (x: number, c: string): Shape[] => { const sh: Shape[] = [S(smooth([[x - 3.2, -1.2], [x - 3.9, -5], [x - 2.6, -9], [x, -11.4, 0], [x + 2.6, -9], [x + 3.9, -5], [x + 3.2, -1.2], [x + 2, 0, 0], [x - 2, 0, 0]], true, 1), tone(c, "deep"))]; [1, 2, 2, 3, 3, 3, 2].forEach((m, j) => { for (let k = 0; k < m; k++) sh.push(S(ellipse(x + (k - (m - 1) / 2) * 2.4, -10.2 + j * 1.55, 1.45, 1.1), (j + k) % 2 ? c : tone(c, "light"))); }); return sh; };
/** A feather 23 cm long lying flat, its quill to the left. */
const feather = (x: number, c: string): Shape[] => {
  const sp: Vec2[] = [[-8, -1.5], [-4, -2.5], [0, -3.2], [4, -3.3], [8, -2.8], [11, -2]], wd = [0.4, 2.2, 4, 4.4, 3.4, 0.4], bar = new Path();
  for (let i = 0; i < 5; i++) for (const t of [0.3, 0.7]) { const px = sp[i][0] + (sp[i + 1][0] - sp[i][0]) * t, py = sp[i][1] + (sp[i + 1][1] - sp[i][1]) * t, w = (wd[i] + (wd[i + 1] - wd[i]) * t) / 2; bar.moveTo(px, py).lineTo(px + 1.7, py - w * 0.95).moveTo(px, py).lineTo(px + 1.7, py + w * 0.95); }
  return T([R([[-12, -1], [-7, -1.4]], tone(c, "light"), 0.5), S(band(sp, wd), c), L(sp, tone(c, "deep"), 0.3, 0.7), { path: bar, stroke: { color: tone(c, "deep"), width: 0.15 }, flat: true, opacity: 0.45 }], mul(translate(x, 0), scale(0.8)));
};
/** A nest 20 cm across of woven twigs with `ne` eggs. */
const nest = (r: Rng, x: number, ne: number, ec: string): Shape[] => {
  const tw = "#7A5A3A", bowl = smooth([[x - 10.2, -7.6, 0], [x - 9.6, -2.6], [x - 5, -0.2], [x + 5, -0.2], [x + 9.6, -2.6], [x + 10.2, -7.6, 0], [x + 5, -5.4], [x, -4.9], [x - 5, -5.4]], true, 1), sh: Shape[] = [S(ellipse(x, -7.6, 10.4, 2.4), tone(tw, "deep"))];
  const egg = (ex: number, ey: number) => [S(ellipse(ex, ey, 1.7, 2.3), ec), F(ellipse(ex + 0.5, ey + 0.6, 1.1, 1.5), tone(ec, "shade"), 0.4), ...[[-0.6, -0.7], [0.5, -0.1], [-0.2, 0.9]].map(([a, b]) => F(ellipse(ex + a, ey + b, 0.22), tone(ec, "deep"), 0.55)), F(ellipse(ex - 0.6, ey - 1.1, 0.4, 0.25), "#FFFFFF", 0.6)];
  const front = Math.min(ne, 3), back = ne - front, sp = (m: number) => Math.min(3.9, 11 / Math.max(1, m - 1));
  for (let k = 0; k < back; k++) sh.push(...egg(x + (k - (back - 1) / 2) * sp(back) + 1.2, -10.4 + r.range(-0.2, 0.2)));
  for (let k = 0; k < front; k++) sh.push(...egg(x + (k - (front - 1) / 2) * sp(front) + r.range(-0.4, 0.4), -8 + (k % 2) * 0.5));
  sh.push(S(bowl, tw));
  const segs: number[][] = [];
  for (let k = 0; k < 18; k++) { const a = r.range(-0.7, 0.7), l = r.range(5, 9), sx = x + r.range(-10, 6), sy = r.range(-7, -0.5); segs.push([sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l]); }
  sh.push(ln(segs.slice(0, 9), tone(tw, "light"), 0.6, 0.85, bowl), ln(segs.slice(9), tone(tw, "deep"), 0.6, 0.8, bowl), R([[x - 10, -7.4], [x - 5, -5.6], [x, -5.1], [x + 5, -5.6], [x + 10, -7.4]], tone(tw, "light"), 1));
  return sh;
};
/** A branch 90 cm long, a stub, a knot and a cut end, upright at the origin. */
const stick = (c: string): Shape[] => [R([[0.6, -52], [4.8, -61]], tone(c, "shade"), 1.4), R([[-0.3, -40], [-4, -45]], tone(c, "shade"), 1.1), S(band([[0, 0], [0.5, -22], [-0.4, -45], [0.7, -68], [0.9, -88]], [3.6, 3.2, 3, 2.7, 2.3]), c), L([[-0.9, -3], [-1, -30], [-1.7, -52], [-0.7, -80]], tone(c, "light"), 0.5, 0.6), L([[1, -4], [0.9, -30], [0.2, -60]], tone(c, "shade"), 0.6, 0.45), F(ellipse(0.2, -34, 0.9, 1.5), tone(c, "deep"), 0.6), F(ellipse(0.9, -88.2, 1.2, 0.5), "#DDC08E")];
/** An acorn lying on its side at (x, 0): cap, hatching, nut. */
const acorn = (x: number, a: number): Shape[] => {
  const cap = smooth([[-1.55, -3.1], [-1.6, -4.3], [-0.7, -5.1], [0.7, -5.1], [1.6, -4.3], [1.55, -3.1], [0, -2.8]], true, 1);
  return T([R([[0, -5], [0.3, -5.9]], "#6B4A35", 0.35), S(smooth([[0, 0, 0], [1.1, -1.2], [1.3, -2.6], [0.8, -3.5], [-0.8, -3.5], [-1.3, -2.6], [-1.1, -1.2]], true, 1), "#B98A4E"), F(ellipse(-0.45, -2, 0.3, 0.8), "#E3C08A", 0.7), S(cap, "#7A5434"), ln([[-1.6, -4.8, 0.6, -2.8], [-0.8, -5.2, 1.6, -3.4], [-1.6, -3.6, -0.3, -2.8], [1.6, -4.8, -0.6, -2.8], [0.8, -5.2, -1.6, -3.4], [1.6, -3.6, 0.3, -2.8]], tone("#7A5434", "deep"), 0.18, 0.6, cap)], mul(translate(x, -1.6), mul(scale(0.7), mul(rotate(a), translate(0, 2.8)))));
};
const conker = (x: number, y: number, r: number): Shape[] => { const o = ellipse(x, y, r, r * 0.92); return [S(o, "#7A3416"), F(ellipse(x + r * 0.4, y + r * 0.4, r * 0.85, r * 0.75), tone("#7A3416", "deep"), 0.45, o), F(ellipse(x + r * 0.05, y - r * 0.62, r * 0.55, r * 0.38), "#E8D3A5", 0.95, o), ln([[x - r * 0.6, y - r * 0.1, x - r * 0.3, y + r * 0.6], [x + r * 0.3, y + r * 0.05, x + r * 0.45, y + r * 0.6]], tone("#7A3416", "light"), r * 0.12, 0.6, o), F(ellipse(x - r * 0.45, y - r * 0.15, r * 0.2, r * 0.3), "#E39A5E", 0.6)]; };
/** An open spiky husk of radius r at (x, y) with its conker showing. */
const husk = (x: number, y: number, r: number): Shape[] => [S(poly(Array.from({ length: 28 }, (_, k) => [x + Math.cos(k * PI / 14) * r * (k % 2 ? 0.84 : 1.12), y + Math.sin(k * PI / 14) * r * (k % 2 ? 0.84 : 1.12)] as Vec2)), "#7F9F45"), F(ellipse(x + r * 0.1, y - r * 0.1, r * 0.62, r * 0.68), "#EFE8CF"), ...conker(x + r * 0.1, y - r * 0.05, r * 0.52)];
/** A snowman 110 cm tall, faceless: twig arms, three balls, a scarf, coal buttons and a carrot. */
const snowman = (x: number, sc: string): Shape[] => {
  const W = "#F2F6FA", br = "#6B4A35", sh: Shape[] = [R([[x - 18, -68], [x - 31, -76], [x - 42, -88]], br, 2.4), R([[x - 31, -76], [x - 40, -74]], br, 1.4), R([[x + 18, -68], [x + 32, -73], [x + 44, -82]], br, 2.4), R([[x + 34, -73], [x + 41, -66]], br, 1.4)];
  sh.push(...ball(x, -24, 25, 24, W), ...ball(x, -65, 19, 18.5, W));
  for (const y of [-72, -63, -54]) sh.push(S(ellipse(x + 1, y, 2.2), "#26272C"), F(ellipse(x + 0.4, y - 0.8, 0.7, 0.45), "#FFFFFF", 0.5));
  sh.push(...ball(x, -95, 14, 13.5, W), S(poly([[x + 4, -80], [x + 11.5, -80], [x + 12.5, -62], [x + 5, -63]]), sc), F(rect(x + 4, -69, 9, 1.2), tone(sc, "light"), 0.55), S(rrect(x - 14.5, -86, 29, 7, 3), sc), F(rect(x - 14, -83.8, 28, 1.2), tone(sc, "light"), 0.55),
    S(poly([[x + 2, -98], [x + 17, -94.2], [x + 2, -92.6]]), "#E8832A"), L([[x + 4, -96], [x + 13, -94.4]], tone("#E8832A", "deep"), 0.4, 0.6));
  return sh;
};
/** `n` things heaped in a pyramid, `sx` apart along a row and `sy` between rows; `f(x, y)` draws one centred at (x, y). */
const heap = (n: number, sx: number, sy: number, f: (x: number, y: number) => Shape[]): Shape[] => { let m = 1; while (m * (m + 1) / 2 < n) m++; const sh: Shape[] = []; for (let j = 0, k = 0; j < m && k < n; j++) for (let i = 0; i < m - j && k < n; i++, k++) sh.push(...f((i - (m - j - 1) / 2) * sx, -sy / 2 - j * sy * 0.88)); return sh; };
/** A firewood log lying side on, `w` long, its sawn end (rings, a crack) to the right. */
const log = (x: number, y: number, w: number, h: number, bark: string, wood: string): Shape[] => [S(rrect(x - w / 2, y - h / 2, w, h, h * 0.42), bark), F(rect(x - w / 2 + 2, y - h / 2 + 0.7, w - 6, 1.4), tone(bark, "light"), 0.5), ln([[x - w * 0.3, y + 1.4, x - w * 0.18, y + 2.4], [x - w * 0.02, y - 1, x + w * 0.1, y + 0.2], [x + w * 0.2, y + 2, x + w * 0.3, y + 3.2]], tone(bark, "deep"), 0.4, 0.6), S(ellipse(x + w / 2 - 1, y, 2.8, h / 2 - 0.3), wood), { path: ellipse(x + w / 2 - 1, y, 1.5, h / 2 - 2.6), stroke: { color: tone(wood, "deep"), width: 0.3 }, flat: true, opacity: 0.6 }, F(ellipse(x + w / 2 - 1, y, 0.5), tone(wood, "deep"), 0.7)];
/** A tuft of grass: sixteen curved blades. */
const tuft = (r: Rng, x: number, cs: string[]): Shape[] => Array.from({ length: 16 }, (_, k) => { const h = r.range(9, 20), bx = x + (k - 7.5) * 0.7, bend = r.range(-5, 5) + (k - 7.5) * 0.5; return S(band([[bx, 0], [bx + bend * 0.4, -h * 0.55], [bx + bend, -h]], [1.7, 1.2, 0.15]), cs[k % cs.length]); });
/** A toadstool (red, white-spotted) or a brown-capped mushroom, `s` times 9 cm high, at (x, 0). */
const shroom = (x: number, k: number, s: number): Shape[] => {
  const red = !(k % 2), c = red ? "#C8283A" : "#9A6B43", st = red ? "#F3EBD8" : "#E6D6B0", a = (red ? 4.6 : 5.2) * s, t = (red ? 1.5 : 1.9) * s;
  const cap = smooth([[x - a, -4.4 * s, 0], [x - a * 0.87, -7 * s], [x - 1.7 * s, -9 * s], [x + 1.7 * s, -9 * s], [x + a * 0.87, -7 * s], [x + a, -4.4 * s, 0], [x, -3.8 * s]], true, 1);
  return [P([[x - t, 0, 0], [x + t, 0, 0], [x + 1.15 * s, -5 * s], [x - 1.15 * s, -5 * s]], st), S(cap, c), cres(cap, x, -6.6 * s, a, 2.6 * s, c, 0.4), F(ellipse(x - 2.2 * s, -7.8 * s, 1.5 * s, 0.6 * s), tone(c, "light"), 0.6, cap), ...(red ? [[-2.4, -6], [0.6, -7.8], [2.8, -6.2], [-0.6, -5.2], [1.6, -5.2]].map(([u, v]) => F(ellipse(x + u * s, v * s, 0.55 * s, 0.4 * s), "#FFFFFF", 0.95, cap)) : [])];
};
const NB: Record<string, Kind> = {
  leaves: { w: 36, ppcm: 8, hp: 16, h: sh => mv(T(sh, scale(0.45)), 0, LIFT), d: (x, c) => { const sh: Shape[] = []; for (let k = 0; k < 9; k++) { const back = k < 4, l = c.r.range(11, 14), a = c.r.range(-0.9, 0.9) + (c.r.chance(0.5) ? PI : 0), px = x + (back ? -9 + k * 6 : -14 + (k - 4) * 7) + c.r.range(-1.5, 1.5), py = -2.5 - Math.abs(Math.sin(a)) * l / 2 - (back ? 5.5 : 0) + c.r.range(-1, 1); sh.push(...(k % 3 ? (X: number, Y: number, Lq: number, A: number, C: string) => lf(X, Y, Lq, A, C, 0.62) : oak)(px - Math.cos(a) * l / 2, py - Math.sin(a) * l / 2, l, a, pc(c, AUTUMN[(k + c.i * 2) % 6]))); } return sh; } },
  stones: { w: 14, gap: 1, ppcm: 10, hn: 2, d: (x, c) => { const w = c.r.range(9, 15), h = w * c.r.range(0.55, 0.75), col = pc(c, ROCKS), o = blob(c.r, x, -h / 2, w / 2, h / 2, 0.09, 8); return [S(o, col), cres(o, x, -h / 2, w / 2, h / 2, col, 0.45), F(ellipse(x - w * 0.22, -h * 0.72, w * 0.16, h * 0.1), tone(col, "light"), 0.6)]; } },
  shells: { w: 10, gap: 1, ppcm: 14, edge: 0.2, hn: 2, d: (x, c) => c.i % 2 ? whorl(x, 2.1, pc(c, SHELLS)) : scallop(x, 4.2, pc(c, SHELLS)) },
  pine_cone: { w: 8.5, gap: 1.5, ppcm: 12, edge: 0.3, hn: 2, d: (x, c) => cone(x, pc(c, ["#8A5A2E", "#7A5030", "#94673A"])) },
  feather: { w: 20, gap: -6, ppcm: 10, edge: 0.3, d: (x, c) => T(feather(0, pc(c, FEATHERS)), mul(translate(x, -c.i * 0.6), rotate((c.i % 3 - 1) * 0.1))), h: sh => T(sh, mul(rotate(-1.3), translate(9.6, 0.8))) },
  nest: { w: 22, ppcm: 10, edge: 0.3, d: (x, c) => nest(c.r, x, Math.round(num(c.p.eggs, 3)), pc(c, ["#A9D4D6", "#A9D4D6", "#F0E8D8", "#C9DDB8"])) },
  stick: { w: 8, ppcm: 6, h: 40, all: (n, c) => Array.from({ length: n }, (_, i) => T(stick(pc(c, ["#8C6A47", "#7A5C40", "#9A7A52"])), mul(translate((i - (n - 1) / 2) * 5, 0), rotate((i - (n - 1) / 2) * 0.16 + (n < 2 ? 0.05 : 0))))).flat() },
  acorns: { w: 4, gap: 0.4, ppcm: 16, edge: 0.15, hn: 3, d: (x, c) => acorn(x, (c.i % 2 ? 1.15 : -1) + c.r.range(-0.15, 0.15)) },
  sand: { w: 62, gap: 4, ppcm: 6, hp: 16, h: sh => mv(T(sh, scale(0.3)), 0, LIFT), d: (x, c) => {
    const col = pc(c, "#E3C98F"), back = P([[x - 14, 0, 0], [x - 6, -8], [x + 4, -13], [x + 15, -6], [x + 22, 0, 0]], tone(col, "light")), o = P([[x - 31, 0, 0], [x - 20, -5], [x - 9, -13], [x, -17], [x + 10, -12], [x + 21, -5], [x + 31, 0, 0]], col);
    return [back, o, F(rect(x + 8, -18, 24, 19), tone(col, "shade"), 0.3, o.path), L([[x - 22, -4], [x - 13, -7.5], [x - 3, -9.5]], tone(col, "shade"), 0.4, 0.5), L([[x + 2, -9], [x + 11, -7.5], [x + 20, -3.8]], tone(col, "shade"), 0.4, 0.5), L([[x - 14, -11], [x - 7, -14]], tone(col, "light"), 0.6, 0.7)];
  } },
  conkers: { w: 5, gap: 1, ppcm: 16, edge: 0.15, hn: 3, d: (x, c) => c.i === 0 && !c.held ? mv(husk(0, -3.6, 3), x, 0) : conker(x, -1.8, 1.8) },
  snowman: { w: 70, gap: 4, ppcm: 6, hp: 16, h: sh => mv(T(sh, scale(0.2)), 0, LIFT), d: (x, c) => snowman(x, pc(c, "#C8283A")) },
  snowballs: { w: 9, ppcm: 10, edge: 0.3, hn: 3, all: (n, c) => heap(n, 8.6, 8.6, (x, y) => { const r = 4.4 + c.r.range(-0.3, 0.3); return ball(x, y, r, r, "#F2F6FA"); }) },
  logs: { w: 36, ppcm: 6, hn: 1, all: (n, c) => heap(n, 34, 11.4, (x, y) => log(x, y, 34 + c.r.range(-2, 2), 11, pc(c, ["#6B4A35", "#7A5A40", "#5E4030"]), c.r.pick(["#D8B27A", "#E0BE8A"]))) },
  grass: { w: 22, ppcm: 10, d: (x, c) => tuft(c.r, x, c.p.color ? [pc(c, "#5E9A3A")] : ["#5E9A3A", "#4E8A32", "#6BAA45"]) },
  mushrooms: { w: 12, gap: 1, ppcm: 12, edge: 0.3, hn: 2, d: (x, c) => shroom(x, c.i, c.r.range(0.85, 1.2)) },
};
const nature_bits: PieceDef = { draw: make("nature_bits", NB), variants: vs(NB),
  meta: {
    about: "Bits of nature: a pile of autumn leaves, stones, shells, a pine cone, a feather, a nest with eggs, a stick, acorns, a sand pile, conkers, a faceless snowman (coal buttons and a carrot), snowballs, a stack of firewood logs, a tuft of grass or mushrooms.",
    params: {
      kind: { type: "enum", values: Object.keys(NB), default: "leaves" },
      n: { ...N, about: "how many side by side (snowballs heaped, sticks fanned); held, what a hand takes" },
      color: { type: "color", about: "the leaves', stones', shells', cone's, feather's, stick's, sand's, logs' bark or grass colour, or the snowman's scarf; default seeded or fixed" },
      eggs: { type: "int", min: 0, max: 6, default: 3, about: "nest: eggs in each" },
    },
    terms: ["a2-w-yaprak", "a2-w-tas", "a1-w-tuy", "a2-w-yuva", "a2-w-sopa", "a2-w-kum", "a1-w-kar", "a1-w-odun", "a2-w-cim", "a2-w-cimen"],
    tags: ["nature"],
  } };

// ---- potted plants -------------------------------------------------------------------------------------

/** Tiny printed dots (spines, seeds). */
const dots = (pts: number[][], color: string, w = 0.5, op = 0.8) => ln(pts.map(([a, b]) => [a, b, a, b + 0.01]), color, w, op);
/** A flowerpot `w` wide at the rim and `h` tall, its foot at (x, 0), the rim's top at y = -h, soil showing. */
const pot = (x: number, w: number, h: number, c: string): Shape[] => {
  const body = smooth([[x - w / 2, -h * 0.8, 0], [x + w / 2, -h * 0.8, 0], [x + w * 0.34, 0, 0], [x - w * 0.34, 0, 0]], true, 1), rim = rrect(x - w * 0.56, -h, w * 1.12, h * 0.24, h * 0.05);
  return [S(body, c), ...lit(body, c, x - w / 2, x + w / 2, -h * 0.8, 0, 0.28), S(rim, c), ...lit(rim, c, x - w * 0.56, x + w * 0.56, -h, -h * 0.76, 0.2), F(rect(x - w / 2, -h * 0.76, w, h * 0.06), tone(c, "deep"), 0.35, body), F(ellipse(x, -h + 0.3, w * 0.5, 0.6), SOIL, 0.9)];
};
/** A heart-shaped leaf `s` long at (x, y), its tip at angle a, a pale patch on it. */
const hrt = (x: number, y: number, s: number, a: number, c: string): Shape[] => T([P([[0, 0, 0], [s * 0.1, -s * 0.5], [s * 0.5, -s * 0.55], [s, 0, 0], [s * 0.5, s * 0.55], [s * 0.1, s * 0.5]], c), L([[s * 0.05, 0], [s * 0.8, 0]], tone(c, "light"), s * 0.05, 0.6), F(ellipse(s * 0.45, -s * 0.18, s * 0.2, s * 0.12), "#C8DC78", 0.7)], mul(translate(x, y), rotate(a)));
/** A chrysanthemum head of radius r: a scalloped disc under three printed rings of petals, darkest outside. */
const mum = (x: number, y: number, r: number, c: string): Shape[] => {
  const o = smooth(Array.from({ length: 18 }, (_, k) => [x + Math.cos(k * PI / 9) * r * (k % 2 ? 0.88 : 1), y + Math.sin(k * PI / 9) * r * (k % 2 ? 0.88 : 1) * 0.92] as Vec2), true, 1);
  const ring = (m: number, d: number, a: number, b: number, col: string, rot = 0) => Array.from({ length: m }, (_, k) => { const t = k / m * PI * 2 + rot; return T([F(ellipse(0, 0, r * a, r * b), col)], mul(translate(x + Math.cos(t) * r * d, y + Math.sin(t) * r * d * 0.92), rotate(t))); }).flat();
  return [S(o, c), cres(o, x, y, r, r, c, 0.4), ...ring(12, 0.7, 0.3, 0.16, tone(c, "shade")), ...ring(9, 0.46, 0.28, 0.15, c, 0.3), ...ring(6, 0.2, 0.22, 0.13, tone(c, "light"), 0.1)];
};
/** A printed arc of an ellipse about (x, y), from angle a0 to a1. */
const arc = (x: number, y: number, rx: number, ry: number, a0: number, a1: number, c: string, w = 0.3, op = 0.55): Shape => L(Array.from({ length: 8 }, (_, k) => { const a = a0 + (a1 - a0) * k / 7; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Vec2; }), c, w, op);
/** A ruffled carnation head of radius r: three scalloped frills laid one on the other, each smaller and paler. */
const frill = (x: number, y: number, r: number, c: string): Shape[] => [[1, c, 0], [0.7, tone(c, "light"), 0.5], [0.42, c, 1]].flatMap(([k, col, ph], j) => { const q = r * (k as number), o = smooth(Array.from({ length: 10 }, (_, i) => [x - j * r * 0.05 + Math.cos(i * PI / 5 + (ph as number)) * q * (i % 2 ? 0.86 : 1), y - j * r * 0.1 + Math.sin(i * PI / 5 + (ph as number)) * q * (i % 2 ? 0.86 : 1) * 0.9] as Vec2), true, 1); return [S(o, col as string), ...(j ? [] : [cres(o, x, y, r, r, c, 0.4)])]; });
/** Shapes scaled down about the origin for a held look. */
const small = (k: number) => (sh: Shape[]) => mv(T(sh, scale(k)), 0, LIFT);

/** A tulip head of size s at (x, y), cup shaped. */
const tulip = (x: number, y: number, s: number, c: string): Shape[] => [P([[x - s * 0.42, y - s * 0.1], [x - s * 0.5, y - s * 0.78, 0], [x - s * 0.2, y - s * 0.55], [x, y - s * 0.9, 0], [x + s * 0.2, y - s * 0.55], [x + s * 0.5, y - s * 0.78, 0], [x + s * 0.42, y - s * 0.1], [x, y + s * 0.14]], c), F(smooth([[x - s * 0.1, y - s * 0.62], [x, y - s * 0.9], [x + s * 0.12, y - s * 0.6], [x, y + s * 0.05]], true, 1), tone(c, "light"), 0.5), L([[x + s * 0.25, y - s * 0.45], [x + s * 0.3, y]], tone(c, "shade"), s * 0.06, 0.6)];
/** An open rose of radius r at (x, y): petals folded in, lines printed. */
const rose = (x: number, y: number, r: number, c: string): Shape[] => { const o = ellipse(x, y, r, r * 0.92), d = tone(c, "deep"); return [S(o, c), cres(o, x, y, r, r * 0.92, c, 0.4), L(Array.from({ length: 14 }, (_, k) => { const a = -1.2 + k * 0.55, q = r * (0.08 + 0.55 * k / 13); return [x + Math.cos(a) * q, y + Math.sin(a) * q * 0.92] as Vec2; }), d, r * 0.13, 0.65), arc(x, y, r * 0.82, r * 0.76, 0.1, PI * 0.9, d, r * 0.12, 0.55), arc(x, y, r * 0.78, r * 0.72, PI * 1.1, PI * 1.55, d, r * 0.12, 0.55), F(ellipse(x - r * 0.4, y - r * 0.48, r * 0.26, r * 0.14), tone(c, "light"), 0.6)]; };

const PL: Record<string, Kind> = {
  cactus: { w: 15, ppcm: 12, d: (x, c) => { const g = "#5C8F62", y = -9; return [R([[x - 2.5, y - 8], [x - 7, y - 8], [x - 7, y - 15]], g, 3.4), R([[x + 2.5, y - 11], [x + 7, y - 11], [x + 7, y - 17]], g, 3.4), R([[x, y + 1], [x, y - 19]], g, 7), ln([[x - 1.6, y - 1, x - 1.6, y - 18], [x + 1.6, y - 1, x + 1.6, y - 18], [x - 7, y - 10, x - 7, y - 15], [x + 7, y - 13, x + 7, y - 17]], tone(g, "deep"), 0.3, 0.5), dots([-3, -7, -11, -15].flatMap(v => [[x - 1.6, y + v], [x + 1.6, y + v - 2]]), "#F2E6C0"), ...ball(x, y - 20, 1.7, 1.2, "#E8799A"), F(ellipse(x, y - 20.4, 0.5), "#F2C230"), ...pot(x, 10, 9, pc(c, TERRA))]; } },
  basil: { w: 15, ppcm: 12, d: (x, c) => {
    const tc = pc(c, "#B8BEC4"), tin = rrect(x - 5.5, -12, 11, 12, 0.8), sh: Shape[] = [];
    for (let k = 0; k < 6; k++) { const a = -PI / 2 + (k - 2.5) * 0.26, len = c.r.range(9, 15), bx = x + (k - 2.5) * 0.9, tx = x + Math.cos(a) * len, ty = -12 + Math.sin(a) * len; sh.push(R([[bx, -11], [tx, ty]], "#6BA24A", 0.5)); for (const [t, s] of [[0.55, 4.4], [1, 5.4]]) { const px = bx + (tx - bx) * t, py = -11 + (ty + 11) * t; sh.push(...lf(px, py, s, a - 0.9, "#4FA03F", 0.62), ...lf(px, py, s, a + 0.9, "#5BAE48", 0.62)); } }
    return [...sh, S(tin, tc), ...lit(tin, tc, x - 5.5, x + 5.5, -12, 0, 0.25), F(rect(x - 5.5, -9, 11, 5.5), "#C8283A", 0.9, tin), F(rect(x - 5.5, -6.8, 11, 1), "#F4F1EA", 0.8, tin), ln([[x - 5.5, -11, x + 5.5, -11], [x - 5.5, -1.6, x + 5.5, -1.6]], tone(tc, "deep"), 0.3, 0.5), S(rrect(x - 6, -12.8, 12, 1.4, 0.6), tone(tc, "light")), F(ellipse(x, -12.2, 5, 0.5), SOIL, 0.9)];
  } },
  money_plant: { w: 30, ppcm: 10, d: (x, c) => {
    const g = ["#3F8A3A", "#4E9A46", "#5BAE48"], up: Shape[] = [], vines: Shape[] = [], an = [-2.4, 3, 2, 1.7];
    ([[-3, -25, -1.9], [1.5, -27, -1.5], [4.5, -22, -1.0]] as number[][]).forEach(([dx, dy, a], k) => up.push(R([[x + dx * 0.3, -11], [x + dx, dy]], "#5E8A4A", 0.6), ...hrt(x + dx, dy, 6 - k * 0.3, a, g[k % 3]), ...hrt(x + dx * 0.6, dy * 0.6 - 4, 4.6, a + (k - 1) * 0.7, g[(k + 1) % 3])));
    for (const dir of [-1, 1]) {
      const pts: Vec2[] = [[5, -11], [9, -15], [12.5, -12], [13, -5], [12, -1]].map(([a, b]) => [x + dir * a, b]);
      vines.push(R(pts, "#5E8A4A", 0.6));
      pts.slice(1).forEach(([px, py], k) => { const a = dir < 0 ? an[k] : PI - an[k]; vines.push(...hrt(px, py, 5.6 - k * 0.3, a, g[(k + (dir > 0 ? 1 : 0)) % 3])); if (k % 2) vines.push(...hrt(px, py, 4.6, a - dir * 1.1, g[(k + 2) % 3])); });
    }
    return [...up, ...pot(x, 12, 11, pc(c, "#E9E4DA")), ...vines];
  } },
  olive: { w: 50, ppcm: 8, hp: 12, h: small(0.5), d: (x, c) => {
    const y = -20, bark = "#8A7A68", gc = ["#8DA37A", "#6F8D62", "#A9BC95"], tips: Vec2[] = [[-15, -38], [-7, -50], [4, -58], [14, -46], [19, -33], [-19, -26], [9, -28]], sh: Shape[] = [R([[x, y + 1], [x + 1.5, y - 16], [x - 1, y - 32], [x + 1, y - 44]], bark, 2.6)];
    tips.forEach(([tx, ty], k) => {
      const a: Vec2 = [x, y - 14 - (k % 3) * 9], m: Vec2 = [x + tx * 0.6, y + ty * 0.7 + 4], b: Vec2 = [x + tx, y + ty];
      sh.push(R([a, m, b], bark, 1.1));
      // narrow leaves in pairs along the outer half of the twig, angled outward, one at its tip
      const at = (u: number) => { const [p, q] = u < 0.5 ? [a, m] : [m, b], t = u < 0.5 ? u * 2 : u * 2 - 1; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Math.atan2(q[1] - p[1], q[0] - p[0])]; };
      [0.42, 0.58, 0.74, 0.9].forEach((u, j) => { const [px, py, an] = at(u); sh.push(...lf(px, py, 7, an + 0.72, gc[(k + j) % 3], 0.2), ...lf(px, py, 7, an - 0.72, gc[(k + j + 1) % 3], 0.2)); });
      sh.push(...lf(b[0], b[1], 7.5, at(0.99)[2], gc[k % 3], 0.2));
    });
    for (const [ox, oy, k] of [[-10, -34, 0], [8, -40, 1], [14, -28, 0], [-3, -46, 1]]) sh.push(...ball(x + ox, y + oy, 1.4, 1.9, k ? "#4A3A55" : "#5A6B38"));
    return [...sh, ...pot(x, 22, 20, pc(c, TERRA))];
  } },
  aloe: { w: 28, ppcm: 10, d: (x, c) => {
    const y = -12, sh: Shape[] = [], g = ["#4E8A6A", "#5E9A6A", "#6BA77A"];
    [-1.25, 1.25, -0.9, 0.9, -0.55, 0.55, -0.2, 0.2, 0].forEach((q, k) => { const l = 20 + c.r.range(0, 8), a = -PI / 2 + q, bx = x + q * 2; sh.push(...lf(bx, y + 1, l, a, g[k % 3], 0.2), dots([0.3, 0.5, 0.7].map(t => [bx + Math.cos(a) * l * t, y + 1 + Math.sin(a) * l * t]), "#D9ECD8", 0.7, 0.8)); });
    return [...sh, ...pot(x, 14, 12, pc(c, TERRA))];
  } },
  bonsai: { w: 30, ppcm: 12, d: (x, c) => {
    const y = -6.5, g = "#4E7A48", g2 = "#5E9A55", bark = "#6B4A35";
    return [R([[x - 3, y - 7], [x - 8, y - 10], [x - 10, y - 13]], bark, 1.4), R([[x + 1, y - 14], [x + 7, y - 17], [x + 10, y - 20]], bark, 1.2), S(band([[x - 2, y + 1], [x - 4, y - 6], [x + 1, y - 13], [x + 3, y - 21]], [4.4, 3.4, 2.6, 2]), bark), ...ball(x - 10, y - 14, 8, 3.2, g), ...ball(x + 10, y - 21, 9, 3.4, g2), ...ball(x + 3, y - 27, 7.5, 3.3, g), ...pot(x, 24, 6.5, pc(c, "#3F5A73")), F(ellipse(x, y + 0.2, 8, 0.9), g2)];
  } },
  bamboo: { w: 24, ppcm: 7, hp: 12, h: small(0.5), d: (x, c) => {
    const y = -17, sh: Shape[] = [], nodes: number[][] = [];
    ([[-5, 62, -1.2], [-2.5, 82, -0.6], [0, 92, 0.2], [2.5, 74, 0.7], [5, 56, 1.4]] as number[][]).forEach(([dx, h, lean], k) => {
      const tx = x + dx + lean * 3.5, col = k % 2 ? "#7BA84A" : "#6E9E42";
      sh.push(R([[x + dx, y + 1], [(x + dx + tx) / 2, y - h / 2], [tx, y - h]], col, 1.7));
      for (let t = 14; t < h - 4; t += 14) { const px = x + dx + (tx - x - dx) * t / h; nodes.push([px - 0.9, y - t, px + 0.9, y - t]); }
      for (const [a, l] of [[-0.9, 11], [-0.2, 12], [0.6, 11]]) sh.push(...lf(tx, y - h + 1, l, -PI / 2 + a, "#5E9A3A", 0.2));
      sh.push(...lf(tx, y - h + 14, 9, -PI / 2 + lean + 1.1, "#5E9A3A", 0.2), ...lf(tx, y - h + 14, 9, -PI / 2 + lean - 1.1, "#4E8A3A", 0.2));
    });
    return [...sh, ln(nodes, tone("#7BA84A", "deep"), 0.4, 0.7), ...pot(x, 16, 17, pc(c, "#D7CDBB"))];
  } },
  carnation: { w: 18, ppcm: 10, d: (x, c) => {
    const bc = hex(c.p.bloom, "#E8799A"), y = -12, sh: Shape[] = [], heads: Shape[] = [], lc = "#7FA394";
    for (let k = 0; k < 5; k++) sh.push(...lf(x + (k - 2) * 1.5, y + 1, 14, -PI / 2 + (k - 2) * 0.3, lc, 0.08));
    ([[-5, 26], [-2.5, 36], [0, 42], [3, 32], [5.5, 24]] as number[][]).forEach(([dx, h], k) => {
      const bx = x + dx * 0.3, tx = x + dx * 1.6, ty = y - h;
      sh.push(R([[bx, y + 1], [(bx + tx) / 2, y - h * 0.5], [tx, ty]], "#6E9A8A", 0.5), ...lf((bx + tx) / 2, y - h * 0.45, 8, -PI / 2 - 1, lc, 0.1), ...lf((bx + tx) / 2, y - h * 0.6, 8, -PI / 2 + 1, lc, 0.1));
      heads.push(...(k % 4 === 0 ? [...ball(tx, ty - 1, 1.2, 1.7, bc), S(poly([[tx - 1.2, ty + 0.4], [tx + 1.2, ty + 0.4], [tx, ty + 2.6]]), "#6E9A8A")] : [S(poly([[tx - 2, ty + 0.4], [tx + 2, ty + 0.4], [tx, ty + 3.4]]), "#6E9A8A"), ...frill(tx, ty - 1, 3.3, bc)]));
    });
    return [...sh, ...heads, ...pot(x, 14, 12, pc(c, TERRA))];
  } },
  chrysanthemum: { w: 22, ppcm: 10, d: (x, c) => {
    const bc = hex(c.p.bloom, "#E8A12A"), y = -13, sh: Shape[] = [], fl: number[][] = [[-9, -15], [-3, -21], [4, -22], [10, -16], [-6, -9], [2, -13], [8, -10]];
    for (let k = 0; k < 9; k++) sh.push(...oak(x + (k - 4) * 2.8, y - 1, 9, -PI / 2 + (k - 4) * 0.32, k % 2 ? "#3F6B3E" : GRN));
    for (const [fx, fy] of fl) sh.push(R([[x + fx * 0.3, y + 1], [x + fx, y + fy + 2]], GRN, 0.6));
    fl.forEach(([fx, fy], k) => sh.push(...mum(x + fx, y + fy, 3.9 + (k % 3) * 0.3, k % 3 ? bc : tone(bc, "light"))));
    return [...sh, ...pot(x, 16, 13, pc(c, TERRA))];
  } },
  herbs: { w: 40, ppcm: 12, d: (x, c) => {
    const y = -8, pc3 = pc(c, TERRA), sh: Shape[] = [], nd: number[][] = [];
    for (let k = 0; k < 7; k++) sh.push(S(ellipse(x - 12.5 + (k - 3) * 1.3, y - 2.6 - (k % 3) * 1.6 - (k === 3 ? 1 : 0), 2.3, 1.9), k % 2 ? "#3F8A3A" : "#4E9A46"), F(ellipse(x - 13 + (k - 3) * 1.3, y - 3.2 - (k % 3) * 1.6, 0.8, 0.5), "#7CC05A", 0.7));
    for (let k = 0; k < 4; k++) { const a = -PI / 2 + (k - 1.5) * 0.35, ex = x + Math.cos(a) * 14, ey = y + Math.sin(a) * 14; sh.push(R([[x + (k - 1.5), y + 1], [ex, ey]], "#5E8A4A", 0.4)); for (const t of [0.5, 0.8, 1]) sh.push(...lf(x + (ex - x) * t, y + (ey - y) * t, 4.4, a - 0.9, "#5CA64C", 0.66), ...lf(x + (ex - x) * t, y + (ey - y) * t, 4.4, a + 0.9, "#4E9A46", 0.66)); }
    for (let k = 0; k < 8; k++) { const a = -PI / 2 + (k - 3.5) * 0.2, l = 13 + (k % 3) * 2, bx = x + 12.5 + (k - 3.5) * 0.6; sh.push(R([[bx, y + 1], [bx + Math.cos(a) * l, y + Math.sin(a) * l]], "#6C8F5A", 0.9)); for (let t = 3; t < l; t += 1.7) { const px = bx + Math.cos(a) * t, py = y + Math.sin(a) * t; nd.push([px, py, px - 1.6, py - 0.8], [px, py, px + 1.6, py - 0.8]); } }
    return [...sh, ln(nd, tone("#6C8F5A", "deep"), 0.3, 0.8), ...[-12.5, 0, 12.5].flatMap(dx => pot(x + dx, 9, 8, pc3))];
  } },
  lemon_tree: { w: 46, ppcm: 8, hp: 12, h: small(0.5), d: (x, c) => {
    const y = -20, cy = y - 44, sh: Shape[] = [R([[x, y + 1], [x + 0.5, y - 14], [x - 0.5, y - 28]], "#7A5C40", 2.6), S(ellipse(x, cy, 19, 16), "#3A6B3A")];
    for (let k = 0; k < 36; k++) { const a = c.r.range(0, PI * 2), q = Math.sqrt(c.r()); sh.push(...lf(x + Math.cos(a) * 18 * q, cy + Math.sin(a) * 15 * q, 7.5, a + c.r.range(-0.6, 0.6), k % 2 ? "#3F7A3E" : "#4E8A48", 0.5)); }
    for (const [lx, ly] of [[-10, -38], [6, -36], [13, -46], [-2, -52]]) sh.push(...ball(x + lx, y + ly, 4.2, 3.4, "#F2D230"), S(ellipse(x + lx + 4.2, y + ly - 0.2, 1.1, 0.8), "#F2D230"));
    for (const [bx, by] of [[-6, -62], [11, -52]]) sh.push(...[0, 1, 2, 3, 4].map(k => F(ellipse(x + bx + Math.cos(k * 1.257) * 1.1, y + by + Math.sin(k * 1.257) * 1.1, 0.8), "#FFFFFF", 0.95)), F(ellipse(x + bx, y + by, 0.5), "#F2C230"));
    return [...sh, ...pot(x, 22, 20, pc(c, TERRA))];
  } },
  seedlings: { w: 40, ppcm: 12, d: (x, c) => {
    const tc = pc(c, "#3A3D45"), sh: Shape[] = [], tray = smooth([[x - 19, -6, 0], [x + 19, -6, 0], [x + 17.5, 0, 0], [x - 17.5, 0, 0]], true, 1);
    for (let k = 0; k < 8; k++) { const sx = x - 16.6 + k * 4.75, h = c.r.range(2.5, 9), tp = -7.6 - h; sh.push(R([[sx, -6], [sx + c.r.range(-0.3, 0.3), tp]], "#7CC05A", 0.5), ...lf(sx, tp, 2.6 + h * 0.3, -PI / 2 - 1, "#6BB34A", 0.55), ...lf(sx, tp, 2.6 + h * 0.3, -PI / 2 + 1, "#5BA33F", 0.55)); if (h > 5.5) sh.push(...lf(sx, tp + h * 0.4, 3.4, -PI / 2 - 0.5, "#5BA33F", 0.55), ...lf(sx, tp + h * 0.4, 3.4, -PI / 2 + 0.5, "#6BB34A", 0.55)); }
    return [...sh, S(rect(x - 18.4, -7.6, 36.8, 1.8), SOIL), S(tray, tc), ...lit(tray, tc, x - 19, x + 19, -6, 0, 0.2), ln([0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => [x - 19 + k * 4.75, -5.4, x - 19 + k * 4.75, -0.8]), tone(tc, "light"), 0.3, 0.3)];
  } },
  pots: { w: 20, ppcm: 10, hn: 3, all: (n, c) => {
    const col = pc(c, TERRA), sh: Shape[] = [], ns = Math.ceil(n / 6);
    for (let s = 0; s < ns; s++) { const m = Math.min(6, n - s * 6), x = (s - (ns - 1) / 2) * 22; for (let k = m - 1; k >= 0; k--) sh.push(...mv(pot(x + (k % 2 ? 0.4 : -0.4), 18, 15, col).slice(0, -1), 0, -k * 4.6)); }
    return sh;
  } },
  soil: { w: 40, ppcm: 8, h: 42, d: (x, c) => {
    const bc = pc(c, "#3E5A3A"), say = str(c.p.label, "TOPRAK").trim(), o = smooth([[x - 13, -43, 0], [x + 13, -43, 0], [x + 15, -31], [x + 16, -12], [x + 14, 0, 0], [x - 14, 0, 0], [x - 16, -12], [x - 15, -31]], true, 1);
    if (say) c.tx.push({ text: say, x: x - 9, y: -31.5, w: 18, h: 6.5, size: 3, font: "print", weight: 700, color: tone(bc, "deep") });
    return [...(c.held ? [] : mv([P([[-8, 0, 0], [-5, -3], [0, -4.6], [6, -2.4], [11, 0, 0]], SOIL)], x + 17, 0)), S(o, bc), ...lit(o, bc, x - 16, x + 16, -43, 0, 0.25), F(rect(x - 13, -43, 26, 3.5), tone(bc, "deep"), 0.6, o), ln(Array.from({ length: 12 }, (_, k) => [x - 12 + k * 2.1, -42.6, x - 11 + k * 2.1, -40.6]), tone(bc, "light"), 0.3, 0.6), S(rrect(x - 10, -33, 20, 19, 1.5), "#F3EBD8"), F(ellipse(x - 2.2, -17.6, 2.2, 1), "#5E9A55"), F(ellipse(x + 2.4, -18.4, 2.2, 1), "#4E8A48"), ln([[x, -15, x, -18.4]], "#5E8A4A", 0.4, 0.9)];
  } },
  tulips: { w: 18, ppcm: 10, d: (x, c) => {
    const bc = hex(c.p.bloom, "#D9342B"), y = -12, sh: Shape[] = [], heads: Shape[] = [];
    for (let k = 0; k < 3; k++) sh.push(...lf(x + (k - 1) * 2, y + 1, 17, -PI / 2 + (k - 1) * 0.4, k % 2 ? "#4E8A48" : "#5E9A55", 0.3));
    ([[-5, 21], [-2.5, 27], [0, 24], [2.5, 29], [5, 20]] as number[][]).forEach(([dx, h], k) => { sh.push(R([[x + dx * 0.3, y + 1], [x + dx, y - h]], "#5E9A55", 0.9)); heads.push(...tulip(x + dx, y - h + 4.5, 6, k % 2 ? tone(bc, "light") : bc)); });
    return [...sh, ...heads, ...pot(x, 14, 12, pc(c, TERRA))];
  } },
  rose: { w: 20, ppcm: 10, d: (x, c) => {
    const bc = hex(c.p.bloom, "#E04A6E"), y = -14, sh: Shape[] = [], gc = ["#2F6B3A", "#3F7A3E"];
    ([[-6, 24], [-2, 31], [3, 27], [7, 21], [0, 18]] as number[][]).forEach(([dx, h], k) => { const tx = x + dx * 1.2, ty = y - h; sh.push(R([[x + dx * 0.25, y + 1], [tx, ty]], "#4E7A48", 0.7)); for (const t of [0.35, 0.62]) sh.push(...lf(x + dx * 0.25 + (tx - x - dx * 0.25) * t, y - h * t, 6, -PI / 2 - 1, gc[k % 2], 0.55), ...lf(x + dx * 0.25 + (tx - x - dx * 0.25) * t, y - h * t, 6, -PI / 2 + 1, gc[(k + 1) % 2], 0.55)); });
    return [...sh, ...[[-6, 24, 3.6], [-2, 31, 3.2], [3, 27, 3.8], [7, 21, 3]].flatMap(([dx, h, r], k) => rose(x + dx * 1.2, y - h, r, k % 2 ? tone(bc, "light") : bc)), ...ball(x, y - 18, 1.5, 2, tone(bc, "shade")), ...pot(x, 16, 14, pc(c, TERRA))];
  } },
};
const potted: PieceDef = { draw: make("potted", PL), variants: vs(PL),
  meta: {
    about: "Potted plants: a cactus, basil in a tin, a trailing money plant, an olive sapling, an aloe, a bonsai, bamboo, carnations, chrysanthemums, three herb pots, a lemon tree, a seed tray, stacked empty terracotta pots, a bag of soil, tulips or a rose bush.",
    params: {
      kind: { type: "enum", values: Object.keys(PL), default: "cactus" },
      n: { ...N, about: "how many side by side (pots: stacked, six to a stack); held, what a hand takes" },
      color: { type: "color", about: "the pot's (basil: the tin's, seedlings: the tray's, soil: the bag's); default terracotta or its own" },
      bloom: { type: "color", about: "carnation, chrysanthemum, tulips and rose: the flowers'; default pink, golden, red and rose" },
      label: { type: "text", about: "soil: the words on the bag; default TOPRAK" },
    },
    terms: ["a2-w-bambu", "b1-w-karanfil", "b1-w-krizantem", "a2-w-bitki", "a1-w-cicek", "a1-w-zeytin", "a1-w-limon", "a1-w-lale", "a1-w-gul"],
    tags: ["plant"],
  } };

// ---- garden kit ----------------------------------------------------------------------------------------

const WOOD = "#C9A06A", STEEL = "#B8BEC4", BRASS = "#D9A72E", DARK = "#26272C", PAPER = "#F4EBD6";
/** A watering can 54 cm long with its rose, body at x. */
const can = (x: number, c: string): Shape[] => {
  const o = rrect(x - 12, -22, 20, 22, 1.8), dk = tone(c, "deep"), sd = tone(c, "shade"), m = mul(translate(x + 30, -30), rotate(-0.86));
  return [R([[x - 11, -22], [x - 6, -33], [x + 3, -33.5], [x + 7, -24]], sd, 1.6), R([[x - 12, -19], [x - 20, -18], [x - 21, -6], [x - 12, -3]], sd, 1.8), S(band([[x + 7, -4], [x + 15, -12], [x + 24, -23], [x + 30, -30]], [3.6, 2.8, 2.2, 1.8]), sd),
    ...T([P([[-0.5, -1.2, 0], [4, -3.8], [5, 0], [4, 3.8], [-0.5, 1.2, 0]], c), dots([-2.4, -1.2, 0, 1.2, 2.4].map(v => [4.5, v]), dk, 0.5, 0.8)], m),
    S(o, c), ...lit(o, c, x - 12, x + 8, -22, 0, 0.25), S(rrect(x - 12.8, -23.4, 21.6, 2.2, 1), tone(c, "light")), ln([[x - 12, -14, x + 8, -14], [x - 12, -6, x + 8, -6]], dk, 0.35, 0.5)];
};
/** A coiled hose: four loops seen from above and in front, its brass end trailing. */
const hose = (x: number, c: string): Shape[] => {
  const sh: Shape[] = [];
  for (let i = 0; i < 4; i++) { const e = ellipse(x, -4 - i * 5.2, 22 - i * 1.4, 7); sh.push({ path: e, stroke: { color: c, width: 3.6, cap: "round" } }, { path: e.move(0, -0.8), stroke: { color: tone(c, "light"), width: 0.9 }, flat: true, opacity: 0.5 }); }
  return [...sh, R([[x + 14, -1.2], [x + 26, -1.8], [x + 32, -1.5]], c, 3.6), S(rrect(x + 31.5, -3.6, 4, 4.2, 0.8), BRASS), S(poly([[x + 35.5, -3.4], [x + 41, -4.6], [x + 41, -0.4], [x + 35.5, -0.7]]), STEEL), ln([[x + 37.5, -3.6, x + 37.5, -1], [x + 39.5, -4, x + 39.5, -0.8]], tone(STEEL, "deep"), 0.3, 0.6)];
};
/** The coil carried on the forearm: loops hanging from the grip. */
const hoseHang = (c: string): Shape[] => [0, 1, 2, 3].flatMap(i => [{ path: ellipse(i * 3 - 4.5, 17, 7, 17), stroke: { color: c, width: 3.6 } } as Shape, { path: ellipse(i * 3 - 5, 17, 7, 17), stroke: { color: tone(c, "light"), width: 0.9 }, flat: true, opacity: 0.5 } as Shape]).concat([R([[1, 32], [3, 38], [-1, 42]], c, 3.6)]);
/** A spade 112 cm tall, its blade sunk in a heap of soil. */
const spade = (x: number, held = false): Shape[] => {
  const o = smooth([[x - 8.5, -26, 0], [x + 8.5, -26, 0], [x + 9, -16], [x + 5, -6], [x, 0, 0], [x - 5, -6], [x - 9, -16]], true, 1);
  return [R([[x, -30], [x, -102]], WOOD, 3), { ...S(holed(rrect(x - 7, -112, 14, 10, 3.5), [rrect(x - 4.6, -109.6, 9.2, 5.2, 2)]), WOOD), evenodd: true }, S(rect(x - 2.6, -33, 5.2, 8), tone(STEEL, "deep")), S(o, STEEL), ...lit(o, STEEL, x - 9, x + 9, -26, 0, 0.3), S(rrect(x - 8.5, -27, 17, 2.4, 1), tone(STEEL, "shade")), ...(held ? [] : [P([[x - 12, 0, 0], [x - 7, -4], [x, -6], [x + 7, -3.5], [x + 13, 0, 0]], SOIL)])];
};
/** A garden rake 138 cm tall, standing on its tines. */
const rake = (x: number): Shape[] => [R([[x, -42], [x, -138]], WOOD, 2.8), R([[x, -40], [x - 15, -11]], STEEL, 1.3), R([[x, -40], [x + 15, -11]], STEEL, 1.3), ...Array.from({ length: 9 }, (_, k) => S(poly([[x - 17 + k * 4 - 1.1, -9], [x - 17 + k * 4 + 1.1, -9], [x - 17 + k * 4, 0]]), tone(STEEL, "shade"))), S(rrect(x - 19, -12.5, 38, 4, 1.2), STEEL), F(rect(x - 18, -12, 36, 1), tone(STEEL, "light"), 0.7), S(rect(x - 1.8, -47, 3.6, 8), tone(STEEL, "deep"))];
/** A wheelbarrow 136 cm long facing right, its handles to the left. */
const barrow = (x: number, c: string, held = false): Shape[] => {
  const tray = smooth([[x - 28, -58, 0], [x + 44, -54, 0], [x + 33, -34, 0], [x + 16, -29, 0], [x - 10, -31, 0]], true, 1), hub = [x + 52, -18] as Vec2;
  return [R([[x - 6, -34], [x - 36, -50], [x - 68, -72]], WOOD, 3.2), R([[x - 63, -69.5], [x - 69, -72.5]], DARK, 4), ...(held ? [] : [R([[x - 34, -49], [x - 38, 0]], WOOD, 3), R([[x - 44, -0.8], [x - 33, -0.8]], STEEL, 2)]), R([[x + 30, -32], hub], STEEL, 2.4),
    S(ellipse(hub[0], hub[1], 18), DARK), S(ellipse(hub[0], hub[1], 11), "#9CA3A8"), S(ellipse(hub[0], hub[1], 3.2), "#4B5058"), ln(rays(hub[0], hub[1], 3, 10.5, 0, PI * 2, 8), tone("#9CA3A8", "deep"), 0.5, 0.7),
    S(tray, c), ...lit(tray, c, x - 28, x + 44, -58, -29, 0.2), R([[x - 28, -58], [x + 44, -54]], tone(c, "light"), 2.2), ln([[x - 10, -50, x - 6, -33], [x + 14, -50, x + 14, -31], [x + 36, -52, x + 28, -36]], tone(c, "deep"), 0.5, 0.4)];
};
const SEEDS: [string, string][] = [["domates", "#C8283A"], ["havuç", "#E8832A"], ["fesleğen", "#4E8A3A"], ["papatya", "#E0A83A"]];
/** A seed packet 9 × 14.5 cm: a coloured band, a printed picture, its name. */
const packet = (x: number, k: number, col: string): Shape[] => {
  const o = poly([...Array.from({ length: 9 }, (_, i) => [x - 4.5 + i * 1.125, -14.5 + (i % 2 ? 0 : 0.5)] as Vec2), [x + 4.5, 0], [x - 4.5, 0]]), g = "#3E8E4E";
  const pl = (a: number, c: string) => T([{ ...P([[0, 0, 0], [1.9, -1.1], [3.9, 0, 0], [1.9, 1.1]], c), flat: true }], mul(translate(x, -6.1), rotate(a)));
  const pic = [[F(ellipse(x, -8.1, 2.1, 1.9), "#C8283A"), F(ellipse(x - 0.8, -8.9, 0.6, 0.35), "#E8626E", 0.9), F(ellipse(x, -9.9, 1.1, 0.4), g)],
    T([F(poly([[-1.5, -1.1], [0.8, -1], [3, 0.1], [0.8, 1], [-1.5, 1.1]]), "#E8832A"), ln([[-0.5, -0.5, 0.5, -0.4], [0.4, 0.4, 1.4, 0.3]], "#B8581A", 0.25, 0.7), ln([[-1.5, 0, -3.2, -0.8], [-1.5, 0, -3.4, 0.1], [-1.5, 0, -3, 1]], g, 0.5, 1)], mul(translate(x - 0.2, -8.2), mul(rotate(0.5), scale(0.85)))),
    [...pl(-PI / 2 - 0.75, "#3E8E4E"), ...pl(-PI / 2, "#5BAE48"), ...pl(-PI / 2 + 0.75, "#3E8E4E"), ln([[x, -5.6, x, -6.3]], g, 0.4, 1)],
    [F(ellipse(x, -8, 2.7), "#CFE3B8"), ...Array.from({ length: 8 }, (_, i) => T([F(ellipse(0, 0, 0.95, 0.5), "#FFFFFF")], mul(translate(x + Math.cos(i * 0.785) * 1.55, -8 + Math.sin(i * 0.785) * 1.55), rotate(i * 0.785)))).flat(), F(ellipse(x, -8, 0.95), "#F2C230")]][k % 4];
  return [S(o, PAPER), F(rect(x - 4.5, -15, 9, 4.2), col, 1, o), F(rect(x + 3.4, -14.5, 1.1, 14.5), tone(PAPER, "shade"), 0.5, o), ...pic];
};
/** Secateurs 21 cm long lying open, handles to the left, jaws to the right. */
const secateurs = (c: string): Shape[] => {
  const hd = tone(c, "deep");
  return T([R([[-15, -1.8], [-2, -2.6], [6, -4.4]], c, 2.8), R([[-15, -1.8], [-10, -2.1]], hd, 3), S(smooth([[4, -5.5, 0], [11, -3], [16.5, -2.4], [16, -1.2], [9, -1.4], [4, -2.5, 0]], true, 1), STEEL),
    R([[-13, -11.5], [-2, -8.4], [6, -4.4]], c, 2.8), R([[-13, -11.5], [-8, -10.5]], hd, 3), S(smooth([[4, -3.5, 0], [6, -7.2], [12, -9.2], [17.5, -8.2], [13, -6.2], [7, -3.2, 0]], true, 1), tone(STEEL, "light")),
    ln([[-6, -3.4, -5, -6.6], [-5, -6.6, -4, -3.6]], tone(STEEL, "deep"), 0.35, 0.8), S(ellipse(6, -4.4, 1.3), tone(STEEL, "deep")), F(ellipse(5.6, -4.8, 0.45), "#FFFFFF", 0.6)], scale(0.65));
};
/** A right-hand gardening glove, back up, fingers up, its cuff at the origin: fabric `c`, dipped fingertips. */
const glove = (c: string): Shape[] => {
  const dp = tone(c, "deep"), fs: number[][] = [[-3.7, -24.5], [-1.25, -26.4], [1.2, -25], [3.6, -21.8]], sh: Shape[] = [R([[-4.6, -12], [-8.5, -15.5], [-11, -19.4]], c, 2.5), R([[-9.8, -17.8], [-11, -19.4]], dp, 2.5, { flat: true })];
  for (const [fx, tip] of fs) sh.push(R([[fx, -16.5], [fx, tip]], c, 2.3), R([[fx, tip + 3], [fx, tip]], dp, 2.3, { flat: true }));
  return [...sh, S(smooth([[-5, -9.5, 0], [5, -9.5, 0], [5.3, -13], [5, -17.5], [-5, -18], [-5.4, -13]], true, 1), c), ln([[-2.5, -17, -2.5, -11], [0, -17, 0, -11], [2.5, -17, 2.5, -11]], dp, 0.25, 0.5), S(rrect(-5.4, -10.5, 10.8, 5, 1.2), tone(c, "shade")), ln([-4, -2, 0, 2, 4].map(v => [v, -10, v, -5.8]), dp, 0.25, 0.5)];
};
const TAGS = ["domates", "biber", "fesleğen", "nane", "maydanoz", "marul"], TAGC = ["#F4F1EA", "#F2C230", "#8BC34A", "#E8799A"];
/** A hand trowel 30 cm long lying with its blade to the right: a painted handle, a steel scoop. */
const trowel = (c: string): Shape[] => { const bl = smooth([[1.5, -5.4, 0], [6, -8.2], [13, -6.8], [21, -3.2, 0], [13, -0.4], [6, -0.3], [1.5, -1.8, 0]], true, 1); return T([S(rrect(-17, -4.8, 13.5, 4.4, 2), c), F(rect(-15.5, -4.3, 10, 0.9), tone(c, "light"), 0.6), S(rect(-4, -4.4, 3.4, 3.8), tone(STEEL, "deep")), R([[-1, -2.4], [3, -2.4]], STEEL, 1.2), S(bl, STEEL), F(ellipse(8, -6.2, 4.6, 0.8), "#FFFFFF", 0.5, bl), F(rect(6, -2.4, 16, 3), tone(STEEL, "shade"), 0.4, bl), L([[3, -3.6], [17, -3.4]], tone(STEEL, "deep"), 0.3, 0.5)], scale(0.85)) };
/** A bucket 28 cm across with its wire handle up, body at x. */
const bucket = (x: number, c: string): Shape[] => {
  const o = smooth([[x - 14, -26, 0], [x + 14, -26, 0], [x + 11, 0, 0], [x - 11, 0, 0]], true, 1);
  return [R([[x - 13, -26], [x - 12, -36], [x, -39], [x + 12, -36], [x + 13, -26]], tone(STEEL, "deep"), 1.1), S(o, c), ...lit(o, c, x - 14, x + 14, -26, 0, 0.25), S(rrect(x - 14.8, -27.6, 29.6, 2.6, 1.2), tone(c, "light")), ln([[x - 13, -17, x + 13, -17], [x - 12, -9, x + 12, -9]], tone(c, "deep"), 0.35, 0.5), F(rect(x - 11, -3, 22, 3), tone(c, "deep"), 0.4, o)];
};
const GK: Record<string, Kind> = {
  watering_can: { w: 56, ppcm: 8, h: sh => mv(sh, 2, 32.5), d: (x, c) => can(x - 4, pc(c, "#4E8F63")) },
  hose: { w: 58, ppcm: 8, h: (_, c) => hoseHang(pc(c, "#3E8E4E")), d: (x, c) => hose(x - 8, pc(c, "#3E8E4E")) },
  spade: { w: 22, ppcm: 6, h: sh => tilt(sh, [0, -62]), d: (x, c) => spade(x, c.held) },
  rake: { w: 42, ppcm: 5, h: sh => tilt(sh, [0, -80]), d: x => rake(x) },
  wheelbarrow: { w: 140, ppcm: 4, h: sh => tilt(sh, [-68, -72]), d: (x, c) => barrow(x, pc(c, "#B33A2A"), c.held) },
  seeds: { w: 10, gap: 1.5, ppcm: 14, edge: 0.2, d: (x, c) => { const [nm, bc] = SEEDS[c.i % 4], say = (c.i === 0 && typeof c.p.label === "string" ? c.p.label : nm).trim(); if (say) c.tx.push({ text: say, x: x - 4.2, y: -5.4, w: 8.4, h: 2.8, size: 1.5, font: "print", weight: 700, color: INK, align: "center" }); return packet(x, c.i, typeof c.p.color === "string" ? pc(c, bc) : bc); }, h: -4 },
  secateurs: { w: 24, ppcm: 14, edge: 0.25, h: sh => T(sh, mul(rotate(-1.3), translate(5.2, 3.9))), d: (x, c) => mv(secateurs(pc(c, "#D2531E")), x, 0) },
  gloves: { w: 46, gap: 3, ppcm: 12, edge: 0.3, h: sh => T(sh, mul(rotate(PI), translate(0, 8))), d: (x, c) => { const col = pc(c, "#D98E2E"); return c.held ? glove(col) : [...T(flip(glove(col), -1), mul(translate(x - 13, 0), rotate(-0.1))), ...T(glove(col), mul(translate(x + 13, 0), rotate(0.1)))]; } },
  labels: { w: 8, gap: 0.4, ppcm: 14, edge: 0.2, h: 7, d: (x, c) => {
    const say = (c.i === 0 && typeof c.p.label === "string" ? c.p.label : TAGS[c.i % 6]).trim(), col = typeof c.p.color === "string" ? pc(c, "#F4F1EA") : TAGC[c.i % 4], h = 14 + (c.i * 7) % 3 * 1.5;
    if (say) c.tx.push({ text: say, x: x - 2.6, y: -h + 1.2, w: 5.2, h: 4, size: 1.2, font: "hand", color: INK, align: "center" });
    return [S(poly([[x - 2.8, -h], [x + 2.8, -h], [x + 2.8, -6], [x, 0], [x - 2.8, -6]]), col), F(rect(x + 1.5, -h, 1.3, h - 5), tone(col, "shade"), 0.45), ...(c.held ? [] : [P([[x - 4.2, 0, 0], [x - 2.4, -1.5], [x + 0.5, -2.1], [x + 3, -1.3], [x + 4.4, 0, 0]], SOIL)])];
  } },
  trowel: { w: 34, ppcm: 12, edge: 0.3, h: sh => T(sh, mul(rotate(1.3), translate(8.7, 2.2))), d: (x, c) => mv(trowel(pc(c, "#D2531E")), x, 0) },
  bucket: { w: 32, gap: 3, ppcm: 8, h: 37, d: (x, c) => bucket(x, pc(c, "#B8BEC4")) },
};
const garden_kit: PieceDef = { draw: make("garden_kit", GK), variants: vs(GK),
  meta: {
    about: "Garden tools: a watering can, a coiled hose, a spade, a rake, a wheelbarrow, seed packets with their names, secateurs, gardening gloves, plant labels, a hand trowel or a bucket.",
    params: {
      kind: { type: "enum", values: Object.keys(GK), default: "watering_can" },
      n: { ...N, about: "how many side by side (gloves: pairs)" },
      color: { type: "color", about: "the can's, hose's, barrow's tray's, secateur handles', trowel handle's, bucket's, gloves' or seed packets' band colour, or the tags'; default fixed per kind" },
      label: { type: "text", about: "seeds and labels: the first one's words; the rest are named in Turkish (domates, havuç…)" },
    },
    terms: ["a2-w-kurek", "seed-w06", "a2-w-hortum", "a2-w-eldiven", "a2-w-sulamak"],
    tags: ["garden", "tool"],
  } };

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { nature_bits, potted, garden_kit };
