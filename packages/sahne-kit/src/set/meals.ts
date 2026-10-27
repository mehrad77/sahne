// Props of the meals family (STYLE.md): prepared Turkish food: dishes, sweets and snacks. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art. Each generator is a table: kind -> how wide, how drawn, where it steams.

import { ellipse, rect, rrect, smooth, poly, tone, mul, rotate, translate, apply, groupBounds, type Affine, type EmitSpec, type Kit, type Path, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, holed } from "./draw.ts";

const PI = Math.PI, ID: Affine = [1, 0, 0, 1, 0, 0], LIFT = translate(0, -7.5);
const W = "#FBF7EE", WHITE = "#FFFFFF", LEAF = "#4E8A3A", STEEL = "#C3C8CE", RIMS = ["#2E5C9E", "#C9A24A", "#B8322A", "#3E7A5A"];
type Prm = Record<string, unknown>;

// ---- helpers ---------------------------------------------------------------------------------------

const cnt = (v: unknown, d: number, hi = 24) => Math.max(1, Math.min(hi, Math.round(num(v, d))));
const mv = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}) }));
const at = (sh: Shape[], x: number, y = 0) => mv(sh, translate(x, y));
/** Printed paint (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
const E = (x: number, y: number, rx: number, ry: number, c: string, o: Partial<Shape> = {}) => S(ellipse(x, y, rx, ry), c, o);
/** An ellipse turned by `a` about its centre. */
const ell = (x: number, y: number, rx: number, ry: number, a = 0) => ellipse(0, 0, rx, ry).transform(mul(translate(x, y), rotate(a)));
const Ef = (x: number, y: number, rx: number, ry: number, c: string, op = 1, a = 0, clip?: Path) => F(ell(x, y, rx, ry, a), c, op, clip);
/** A cut strand: a stem, a pepper, a string. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Many small paths as one shape (specks, grains). */
const many = (pts: Vec2[], f: (x: number, y: number, i: number) => Path, c: string, o: Partial<Shape> = {}): Shape[] => {
  if (!pts.length) return [];
  const path = f(pts[0][0], pts[0][1], 0);
  pts.slice(1).forEach(([x, y], i) => path.add(f(x, y, i + 1)));
  return [{ path, fill: c, ...o }];
};
const dots = (pts: Vec2[], rx: number, ry: number, c: string, op = 1) => many(pts, (x, y) => ellipse(x, y, rx, ry), c, { flat: true, opacity: op });
/** Printed strokes as one flat shape. */
const lines = (segs: Vec2[][], c: string, w: number, op = 0.7, clip?: Path): Shape[] => {
  if (!segs.length) return [];
  const path = poly(segs[0], false);
  segs.slice(1).forEach(s => path.add(poly(s, false)));
  return [{ path, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }];
};
/** `k` random points in an ellipse. */
const scat = (r: Rng, k: number, cx: number, cy: number, rx: number, ry: number): Vec2[] => Array.from({ length: k }, () => { const a = r() * 2 * PI, d = Math.sqrt(r()); return [cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry] as Vec2; });
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.22): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.1 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** A plate `w` across seen from a little above, on y = 0. */
function plate(w: number, rim: string): Shape[] {
  const ry = w * 0.16, yc = -1 - ry;
  return [P([[-w * 0.26, 0, 0], [w * 0.26, 0, 0], [w * 0.32, -1.2, 0], [-w * 0.32, -1.2, 0]], tone(W, "shade")), E(0, yc + 0.6, w / 2 - 0.3, ry, tone(W, "shade")), E(0, yc, w / 2, ry, W),
    Ef(0, yc + 0.15, w * 0.33, ry * 0.6, tone(W, "shade"), 0.35), { path: ellipse(0, yc, w * 0.45, ry * 0.86), stroke: { color: rim, width: 0.35 }, flat: true, opacity: 0.85 }];
}
/** Food drawn on the plate's surface (its origin a little in front of the centre). */
const plated = (w: number, r: Rng, food: Shape[]) => [...plate(w, r.pick(RIMS)), ...at(food, 0, -1 - w * 0.12)];
/** A bowl `w` across and `h` tall on y = 0, a surface of colour `sc` that `top` dresses (centre and radii given). */
function bowl(w: number, h: number, c: string, sc: string, top: (cx: number, cy: number, rx: number, ry: number) => Shape[] = () => []): Shape[] {
  const ry = w * 0.16, cy = -h + ry * 0.3, body = P([[-w / 2, -h, 0], [w / 2, -h, 0], [w * 0.47, -h * 0.5], [w * 0.36, -h * 0.17], [w * 0.2, 0, 0], [-w * 0.2, 0, 0], [-w * 0.36, -h * 0.17], [-w * 0.47, -h * 0.5]], c);
  return [body, F(body.path, tone(c, "shade"), 0.55, ellipse(w * 0.66, -h * 0.35, w * 0.4, h * 1.1)), F(body.path, tone(c, "light"), 0.35, ellipse(-w * 0.62, -h * 0.4, w * 0.12, h * 0.5)), E(0, -h, w / 2, ry, c), E(0, -h + 0.3, w / 2 - 0.55, ry - 0.3, tone(c, "shade")), E(0, cy, w / 2 - 0.9, ry * 0.76, sc), ...top(0, cy, w / 2 - 0.9, ry * 0.76)];
}
/** A lemon wedge standing at (x, y), `s` times 5 cm wide. */
const lemon = (x: number, y: number, s = 1): Shape[] => at([P([[-2.5 * s, 0, 0], [2.5 * s, 0, 0], [2.1 * s, -1.6 * s], [0, -2.8 * s], [-2.1 * s, -1.6 * s]], "#E8C93A"), P([[-2 * s, -0.3, 0], [2 * s, -0.3, 0], [1.7 * s, -1.4 * s], [0, -2.3 * s], [-1.7 * s, -1.4 * s]], "#F7EC9A"),
  ...lines([[[0, -0.5], [0, -2]], [[-1 * s, -0.6], [-1.2 * s, -1.6 * s]], [[1 * s, -0.6], [1.2 * s, -1.6 * s]]], WHITE, 0.25, 0.8)], x, y);
/** A parsley sprig (a few leaves) at (x, y). */
const parsley = (x: number, y: number, s = 1): Shape[] => [R([[x, y], [x + 0.3 * s, y - 1.6 * s]], "#3E7A32", 0.25 * s), ...[[-1, -1.8], [0.3, -2.6], [1.2, -1.6], [0, -1.2]].map(([a, b], i) => Ef(x + a * s, y + b * s, 0.9 * s, 0.6 * s, i % 2 ? LEAF : "#5E9A45", 1, a * 0.5))];

interface K {
  /** How wide one is, cm (the row's pitch). */
  w: number;
  /** One, standing on (0, 0); `h` when held. */
  d: (r: Rng, h: boolean, p: Prm, kit: Kit) => Shape[];
  /** Where it steams (in the item's cm). A dish without any steams from above its middle unless `nv` (served cold); in the other tables only `hv` kinds do. */
  v?: Vec2[];
  nv?: boolean;
  hv?: boolean;
  /** The held look's move (default: lifted clear of the fist). */
  m?: Affine;
  /** Words, in the item's own cm; only for kinds whose move is a plain shift. */
  t?: (p: Prm) => TextSpec[];
  /** `d` reads `n` itself: pieces in one serving, not servings. */
  c?: boolean;
}

/** A generator's draw: `n` of the kind in a row (two past eight), or held one. */
function drawKind(id: string, T: Record<string, K>, p: Prm, r: Rng, kit: Kit, ppcm: number, edge = 0.3, auto = false): PieceOut {
  const k = T[str(p.kind, "")] ?? Object.values(T)[0], held = !!p.held, n = held || k.c ? 1 : cnt(p.n, 1);
  const m = held ? k.m ?? LIFT : ID, rows = n > 8 ? [Math.floor(n / 2), n - Math.floor(n / 2)] : [n], pitch = k.w + 3;
  const sh: Shape[] = [], em: EmitSpec[] = [], tx: TextSpec[] = [];
  let i = 0;
  rows.forEach((cn, ri) => {
    for (let j = 0; j < cn; j++, i++) {
      const x = (j - (cn - 1) / 2) * pitch + (rows.length > 1 && ri === 0 && rows[0] === rows[1] ? pitch / 2 : 0), art = k.d(r, held, p, kit), bw = held ? groupBounds({ shapes: art, edge }) : [0, 0, 0, 0], s = bw[2] - bw[0] > 32 ? Math.max(0.5, 32 / (bw[2] - bw[0])) : 1;
      const M = mul(mul(translate(x, rows.length > 1 && ri === 0 ? -5 : 0), m), [s, 0, 0, s, 0, 0] as Affine);
      const put = mv(art, M);
      sh.push(...put);
      if (p.hot) {
        for (const [vx, vy] of k.v ?? []) { const [a, b] = apply(M, vx, vy); em.push({ kind: "steam", x: a, y: -b, w: 2.5 }); }
        if (!k.v && (auto ? !k.nv : k.hv)) { const [a0, b0, a1, b1] = groupBounds({ shapes: put, edge: 0 }); for (const f of n > 8 ? [0] : [-0.2, 0.2]) em.push({ kind: "steam", x: (a0 + a1) / 2 + (a1 - a0) * f, y: -(b0 + (b1 - b0) * 0.12), w: 2.5 }); }
      }
      for (const t of k.t?.(p) ?? []) { const [a, b] = apply(M, t.x, t.y); tx.push({ ...t, x: a, y: b }); }
    }
  });
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge });
  const flat = { group: { shapes: sh, edge }, ppcm: Math.min(ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...(tx.length ? { text: tx } : {}) };
  return em.length ? { flats: [flat], emitters: em } : { flats: [flat] };
}
const variants = (T: Record<string, K>, hot: string[] = []) => Object.fromEntries(Object.keys(T).map(k => [k, hot.includes(k) ? { kind: k, hot: true } : { kind: k }]));

// ---- dish -------------------------------------------------------------------------------------------

/** Paper round a roll, lying along x from -len/2 to len/2 on y = 0 (diameter `d`): the wrapped left, `fill` bursting from the open right end. */
function wrap(len: number, d: number, paper: string, stripe: string, fill: Shape[]): Shape[] {
  const o = rrect(-len / 2, -d, len, d, d / 2), pw = len * 0.66, pp = rrect(-len / 2 - 0.3, -d - 0.4, pw, d + 0.8, d * 0.42);
  return [...fill, S(o, "#E6C98E"), ...lit(o, "#E6C98E", -len / 2, len / 2, -d, 0, 0.12), S(pp, paper), ...[0.18, 0.5, 0.82].map(k => F(rect(-len / 2 + pw * k, -d - 0.5, 1.2, d + 1), stripe, 0.75, pp)), ...lit(pp, paper, -len / 2, -len / 2 + pw, -d, 0, 0.16)];
}

/** A wrap stood on its end, its bottom on y = 0. */
const up = (sh: Shape[], len: number, d: number) => mv(sh, mul(translate(d / 2, -len / 2), rotate(-PI / 2)));
const heap = (x0: number, x1: number, y: number, hh: number, c: string) => P([[x0, y, 0], [x1, y, 0], [x1 - 1, y - hh * 0.6], [(x0 + x1) / 2 + 2, y - hh], [(x0 + x1) / 2 - 2, y - hh * 0.9], [x0 + 1, y - hh * 0.6]], c);
/** A split loaf `len` long and `h` tall seen from the side on y = 0: the lid tipped up behind, `fill(x0, x1, y)` heaped on the bottom half (y its cut face). */
function sub(len: number, h: number, c: string, fill: (x0: number, x1: number, y: number) => Shape[]): Shape[] {
  const L = len / 2, y = -h * 0.5, lid = P([[-L, 0, 0], [L, 0, 0], [L * 0.96, -h * 0.4], [L * 0.7, -h * 0.8], [0, -h * 0.95], [-L * 0.7, -h * 0.8], [-L * 0.96, -h * 0.4]], c);
  const bot = P([[-L, y, 0], [L, y, 0], [L * 0.97, y + h * 0.28], [L * 0.8, 0, 0], [-L * 0.8, 0, 0], [-L * 0.97, y + h * 0.28]], c);
  return [...at([lid, ...lit(lid.path, c, -L, L, -h, 0, 0.16), Ef(-L * 0.3, -h * 0.7, L * 0.5, h * 0.08, tone(c, "light"), 0.5)], 0, y - h * 0.34), bot, ...lit(bot.path, c, -L, L, y, 0, 0.16), ...fill(-L, L, y)];
}

const DISH: Record<string, K> = {
  soup: { w: 24, v: [[0, -12]], d: r => plated(24, r, [
    ...bowl(15, 6.5, "#F6F1E6", "#E0842A", (cx, cy, rx, ry) => [Ef(cx - rx * 0.25, cy - ry * 0.1, rx * 0.5, ry * 0.4, "#EBA04A", 0.8), ...dots(scat(r, 14, cx, cy, rx * 0.8, ry * 0.7), 0.3, 0.16, "#9E2E1C", 0.8), ...dots(scat(r, 6, cx, cy, rx * 0.7, ry * 0.6), 0.34, 0.2, LEAF, 0.9),
      ...lines([[[cx - rx * 0.5, cy + ry * 0.2], [cx, cy - ry * 0.3], [cx + rx * 0.5, cy + ry * 0.1]]], "#F7D9A0", 0.4, 0.7)]),
    ...lemon(9.2, 0.6)]) },
  doner: { w: 30, d: r => plated(30, r, [
    ...at([P([[-6.5, 0, 0], [6.5, 0, 0], [5.8, -2.4], [3, -4.8], [0, -5.4], [-3, -4.8], [-5.8, -2.4]], "#EFE3BB")], -8, -1), ...dots(scat(r, 30, -8, -3.5, 5, 2), 0.4, 0.2, WHITE, 0.9), ...dots(scat(r, 10, -8, -3.5, 5, 2), 0.38, 0.18, "#D9C99E", 0.8),
    R([[-14, 3], [-9, 1.6], [-4, 2.4]], "#5E8A36", 1.8), ...[3, 2, 1, 0].map(i => S(ell(5 - i * 0.6, -0.6 - i * 1.5, 8.6, 1.5, -0.1 + i * 0.03), ["#A0602F", "#B87444", "#8C4F28", "#B06A3A"][i])),
    ...lines([[[-2, -5.4], [4, -5.8], [9, -5]], [[-1, -3.6], [5, -4], [10, -3.4]], [[0, -2], [6, -2.4], [11, -1.8]]], "#E2B27C", 0.4, 0.6), ...dots(scat(r, 8, 6, -3, 7, 3), 0.5, 0.25, "#6E3A1C", 0.6), E(12, 2, 2.2, 1.8, "#D63A28"), Ef(11.2, 1.4, 0.8, 0.5, WHITE, 0.45)]) },
  durum: { w: 25, m: mul(translate(2, -3), rotate(-PI / 2 + 0.1)), d: (r, h) => mv(wrap(22, 6.4, W, "#C23B2A", [Ef(11.2, -4.6, 2.5, 2.1, "#C9E3A8", 1, 0.4), Ef(12.4, -2.8, 2, 1.7, "#D63A28"), Ef(11, -2.2, 2.3, 1.5, "#9A5B34"), Ef(12.8, -5.4, 1.4, 1, "#EFEAD8")]), h ? ID : translate(0, -0.5)) },
  kebab: { w: 32, d: r => plated(32, r, [
    R([[-14, -1.5], [-9, -3.6], [-3, -3], [1, -1]], "#5E8A36", 2.2), ...dots([[-11, -3.1], [-6.5, -3.4], [-2.6, -2.7]], 0.5, 0.35, "#2B3A1C", 0.8), R([[1, -1.2], [2.4, -0.4]], "#3E5A24", 1.1),
    E(11.6, -1.6, 3, 2.5, "#D63A28"), Ef(10.6, -2.5, 1.1, 0.7, WHITE, 0.45), Ef(13, -0.8, 1.2, 0.9, "#5A2318", 0.65), E(11.6, -4, 1.1, 0.5, LEAF),
    ...[-1, 1].flatMap(i => mv([E(0, 0, 11.5, 2.3, "#B5532A"), Ef(-1.5, -1, 9, 0.6, tone("#B5532A", "light"), 0.55), ...lines(Array.from({ length: 7 }, (_, k) => [[-9.5 + k * 3.1, -1.9], [-8.6 + k * 3.1, 1.9]] as Vec2[]), tone("#B5532A", "deep"), 0.45, 0.55), ...dots(scat(r, 6, 0, 0, 10, 1.4), 0.35, 0.25, "#3A1D12", 0.7)], mul(translate(i * 1.2, i * 2.4 - 1.4), rotate(i * 0.05))))]) },
  iskender: { w: 32, v: [[0, -9]], d: r => plated(32, r, [
    E(0, -1.4, 12.6, 4.2, "#D9A55A"), ...lines([[-9, -3], [-3, -1], [3, -3], [9, -1]].map(([x, y]) => [[x - 2, y - 1.2], [x + 2, y + 1.2]] as Vec2[]), "#B07A32", 0.3, 0.5), ...lines([-9, -4.5, 0, 4.5, 9].map(x => [[x, -4.6], [x + 0.6, 1.8]] as Vec2[]), "#B07A32", 0.3, 0.5),
    ...[-9.5, -6, -2.5, 1, 4.5, 8].map((x, i) => S(ell(x, -1.4 + (i % 2) * 0.5, 2.6, 4, 0.25), ["#9C5A30", "#B06E40", "#8A4C28"][i % 3])), ...[-9.5, -6, -2.5, 1, 4.5, 8].map((x, i) => Ef(x - 1, -2.6 + (i % 2) * 0.5, 0.9, 2.2, "#D9A06A", 0.55, 0.25)),
    R([[-12, -3], [-6, -1.2], [0, -2.6], [6, -1], [11, -2.6]], "#C0392B", 1.7, { flat: true, opacity: 0.92 }), ...lines([[[-10, -3.6], [-5, -2], [0, -3.4]]], "#E8765E", 0.5, 0.6), R([[-11, -0.8], [-4, 0.6], [4, -0.2]], "#E7A03A", 0.9, { flat: true, opacity: 0.8 }),
    E(12, 0.8, 3.4, 2.1, WHITE), Ef(13.4, 1.6, 2.4, 1.2, tone(WHITE, "shade"), 0.4, 0, ellipse(12, 0.8, 3.4, 2.1)), ...dots([[10.8, 0.2], [12.2, -0.2], [13, 0.8]], 0.3, 0.18, "#C0392B", 0.9), E(-11.4, 0.6, 2.2, 1.7, "#D63A28"), ...parsley(10, -3.2, 0.9)]) },
  lahmacun: { w: 34, d: r => plated(34, r, [
    E(0, -0.2, 14.2, 4.7, tone("#D9A55A", "shade")), E(0, -1, 14, 4.6, "#E0B070"), E(0, -1.1, 12.4, 3.9, "#B94A2A"), ...dots(scat(r, 55, 0, -1.1, 12, 3.6), 0.5, 0.3, "#7E2B18", 0.7), ...dots(scat(r, 40, 0, -1.1, 12, 3.6), 0.45, 0.28, "#DA7A3C", 0.7), ...dots(scat(r, 14, 0, -1.1, 12, 3.6), 0.4, 0.25, LEAF, 0.85), Ef(-5, -3.4, 5, 0.5, WHITE, 0.25),
    ...[[-1.5, -2.4], [1.5, -2.8], [0.2, -3.6], [-0.8, -1.4], [2.4, -1.8], [3.4, -3.2]].map(([x, y], i) => Ef(x, y, 1.5, 0.9, i % 2 ? LEAF : "#5E9A45", 1, x * 0.3)), ...lemon(16.2, 3)]) },
  pide: { w: 44, d: r => [E(0, -3, 22, 6.2, tone(W, "shade")), E(0, -3.4, 21, 5.6, W), ...at([P([[-18, -2.4, 0], [-9, -6.4], [9, -6.4], [18, -2.4, 0], [9, 1.6], [-9, 1.6]], "#C98238"), P([[-16, -2.4, 0], [-8.5, -5, 0], [8.5, -5, 0], [16, -2.4, 0], [8.5, 0.2, 0], [-8.5, 0.2, 0]], "#EFC672"),
      ...dots(scat(r, 22, 0, -2.4, 13, 2.2), 0.7, 0.4, "#D98E3A", 0.8), ...dots(scat(r, 12, 0, -2.4, 13, 2.2), 0.6, 0.35, "#8A4A2A", 0.75), Ef(0, -2.4, 15, 0.45, WHITE, 0.3),
      P([[-4.4, -2.4], [-2, -4.6], [2.4, -4.6], [4.8, -2.6], [2.6, -0.6], [-2, -0.4]], WHITE), E(0.2, -2.5, 1.7, 1.3, "#F2A22A"), Ef(-0.4, -3, 0.6, 0.4, WHITE, 0.6)], 0, -0.6)] },
  borek: { w: 28, d: r => plated(28, r, [
    ...[[0, -1.6], [-4.6, 2], [4.6, 2]].flatMap(([x, y], i) => [P([[x - 4.2, y, 0], [x + 4.2, y, 0], [x + 4.2, y - 3.6, 0], [x - 4.2, y - 3.6, 0]], "#F0D49A"), ...lines([-0.8, -1.8, -2.8].map(d => [[x - 4, y + d], [x + 4, y + d]] as Vec2[]), "#D9A850", 0.35, 0.8), F(rect(x - 4.2, y - 2.2, 8.4, 0.9), i === 0 ? "#E8F0C0" : "#9CC27A", 0.9),
      P([[x - 4.2, y - 3.6, 0], [x + 4.2, y - 3.6, 0], [x + 5.6, y - 5.4, 0], [x - 2.8, y - 5.4, 0]], "#D49A3A"), ...dots(scat(r, 7, x + 0.6, y - 4.5, 3.6, 0.6), 0.28, 0.18, "#F7EAC0", 0.95), ...dots(scat(r, 4, x + 0.6, y - 4.5, 3.6, 0.6), 0.25, 0.16, "#3A2A1C", 0.9)])]) },
  gozleme: { w: 32, d: r => { const cuts = [-8, -2.7, 2.7, 8].map(x => [[x, 2.3], [x, 1.2], [x * 1.04, 1.2 - 7.4 * Math.sqrt(1 - (x / 13.8) ** 2)]] as Vec2[]); return plated(32, r, [
    S(rrect(-13.5, 1, 27, 1.4, 0.5), "#EFD9A0"), F(rect(-13.2, 1.5, 26.4, 0.55), "#7DA04A", 0.95), ...dots(scat(r, 12, 0, 1.78, 12.4, 0.2), 0.5, 0.2, WHITE, 0.95),
    P([[-13.5, 1.2, 0], [13.5, 1.2, 0], [12, -2.4], [6.5, -5.4], [0, -6.4], [-6.5, -5.4], [-12, -2.4]], "#E9C887"), Ef(-5, -3.8, 6, 0.5, tone("#E9C887", "light"), 0.7),
    ...dots(scat(r, 9, 0, -2.4, 10, 2.8), 1.5, 0.9, "#B9772F", 0.55), ...dots(scat(r, 10, 0, -2.4, 11, 3), 0.7, 0.45, "#8A5524", 0.6), ...lines(cuts, "#9A6228", 0.4, 0.65), ...parsley(13.4, 2.4, 0.9)]); } },
  kofte: { w: 28, d: r => plated(28, r, [
    ...[[-8, -2.4], [-1, -3.6], [6, -2.6], [-4.4, 1], [3, 0.8]].map(([x, y]) => [x, y] as Vec2).flatMap(([x, y], i) => [S(ell(x, y, 4.4, 2.6, (i - 2) * 0.16), "#A5602F"), Ef(x - 1, y - 1, 2.8, 0.7, "#D79A62", 0.55, (i - 2) * 0.16), ...lines([-1.8, 0, 1.8].map(d => [[x + d - 0.8, y - 1.8], [x + d + 0.8, y + 1.8]] as Vec2[]), "#4A2A16", 0.4, 0.6)]),
    ...[[10.4, 1.8], [11.6, -1.8]].map(([x, y]) => E(x, y, 3, 2.2, "#D63A28")), Ef(10, 1, 1, 0.5, WHITE, 0.4), Ef(11.2, -1.6, 0.7, 0.3, "#F7D0C8", 0.8), R([[-13, 3], [-9, 3.4], [-4, 3]], "#5E8A36", 1.6), ...parsley(-12, -1.4)]) },
  menemen: { w: 25, v: [[-2, -8], [3, -7]], d: r => [E(0, 0, 12, 3.4, tone("#A06C42", "shade")), E(0, -0.9, 11.4, 2.8, "#A06C42"), ...[-1, 1].map(i => S(rrect(i * 9.6 - 1.8, -5.8, 3.6, 1.8, 0.9), STEEL)),
    P([[-8.7, 0, 0], [8.7, 0, 0], [9.2, -3.4, 0], [-9.2, -3.4, 0]], STEEL), F(rect(3, -3.4, 7, 3.4), tone(STEEL, "shade"), 0.5, poly([[-8.7, 0], [8.7, 0], [9.2, -3.4], [-9.2, -3.4]])), E(0, -3.4, 9.2, 2.9, STEEL), E(0, -3.3, 8.3, 2.4, tone(STEEL, "shade")),
    E(0, -3.8, 7.6, 2.1, "#F2C94C"), ...scat(r, 9, 0, -4.1, 6.2, 1.2).map(([x, y]) => E(x, y, r.range(1, 1.7), r.range(0.6, 0.9), r.pick(["#F2C94C", "#F7DA70", "#E9B93A"]))), ...scat(r, 6, 0, -4, 6, 1.3).map(([x, y]) => S(rrect(x - 0.9, y - 0.6, 1.8, 1.2, 0.5), "#D63A28")),
    ...dots(scat(r, 6, 0, -4, 6.4, 1.4), 0.6, 0.4, "#5E9A45", 0.95), ...dots(scat(r, 4, 0, -4, 6, 1.3), 0.7, 0.4, "#FFF3C2", 0.9), Ef(-3, -5, 2.4, 0.3, WHITE, 0.5)] },
  manti: { w: 28, v: [[0, -7]], d: r => { const dm = ([x, y]: Vec2) => P([[x - 1.5, y + 0.6, 0], [x + 1.5, y + 0.6, 0], [x + 0.9, y - 0.8], [x, y - 1.7, 0], [x - 0.9, y - 0.8]], r.pick(["#C89A4E", "#BF8E42", "#D4A85A"])); return plated(28, r, [
    E(0, -1.4, 11.4, 4.3, "#EDE6D6"), ...scat(r, 16, 0, -1.4, 10, 3.2).map(dm),
    E(0, -2.4, 6.6, 2.4, WHITE), Ef(-2, -3.2, 3.6, 0.55, "#EFE9DB", 0.9), ...scat(r, 8, 0, 0.8, 9.6, 1).map(dm), R([[-6, -1.6], [-3, -3], [0, -1.2], [3, -3], [6, -1.6]], "#D8461F", 1.1, { flat: true, opacity: 0.9 }), ...lines([[[-5, -1.2], [-2, -2.6], [1, -1], [4, -2.4]]], "#F08A2E", 0.5, 0.8), ...dots(scat(r, 12, 0, -2, 6.4, 2), 0.3, 0.18, "#9E2E1C", 0.9), ...dots(scat(r, 8, 0, -2, 6, 1.9), 0.3, 0.18, LEAF, 0.95)]); } },
  makarna: { w: 28, v: [[0, -9]], d: r => plated(28, r, [
    ...at([P([[-8, 0, 0], [8, 0, 0], [7, -3], [3.6, -5.8], [0, -6.4], [-3.6, -5.8], [-7, -3]], "#EFCB6A")], 0, -0.6), ...lines(Array.from({ length: 9 }, (_, i) => [[-7 + i * 1.7, -0.4 - (i % 3)], [-2 + i * 1.2, -4.4], [1 + i * 0.7 - 2, -2 - (i % 2)]] as Vec2[]), "#D9A93A", 0.5, 0.7), ...lines(Array.from({ length: 7 }, (_, i) => [[7 - i * 1.9, -0.8], [3 - i * 1, -4], [-3 + i * 0.9, -2.6]] as Vec2[]), "#FBE29A", 0.4, 0.75),
    E(0.4, -5.7, 4.6, 1.5, "#C23B2A"), Ef(-1.2, -6.1, 2, 0.45, "#E8765E", 0.7), ...dots(scat(r, 8, 0.4, -5.6, 4, 1.1), 0.4, 0.2, "#F6EBC8", 0.95), ...[-1, 1].map(i => Ef(1.6 + i * 1.5, -7.2, 1.5, 0.8, LEAF, 1, i * 0.7)), R([[7.6, -1], [10, 0.6], [12.4, 0.2]], "#EFCB6A", 0.5), R([[-7.6, -1], [-10.4, 1], [-12, 0.6]], "#EFCB6A", 0.5)]) },
  pizza: { w: 40, d: r => {
    const o = ellipse(0, -5.2, 16, 5.4), rad = (a: number, k = 1): Vec2 => [Math.cos(a) * 15.4 * k, -5.2 + Math.sin(a) * 5 * k];
    return [E(0, -2.4, 19.4, 6.4, tone("#C79A63", "shade")), E(0, -3.2, 19.4, 6.4, "#C79A63"), S(o, "#D9A24A"), E(0, -5.5, 14.4, 4.4, "#F2CE6C"), ...scat(r, 6, 0, -5.4, 12, 3.4).map(([x, y]) => Ef(x, y, 3, 1, "#C9402A", 0.8)), Ef(-7, -7.4, 6, 0.6, "#F7E7A0", 0.7),
      ...scat(r, 9, 0, -5.4, 12, 3.4).flatMap(([x, y]) => [E(x, y, 1.9, 0.75, "#B6301F"), Ef(x - 0.4, y - 0.15, 0.4, 0.2, "#7A1F12", 0.7), Ef(x + 0.5, y + 0.1, 0.3, 0.15, "#7A1F12", 0.7)]), ...scat(r, 6, 0, -5.4, 12, 3.4).map(([x, y]) => E(x, y, 0.8, 0.4, "#2B2420")),
      ...[0.6, 1.5, 2.3, 3.8, 4.6, 5.4].map((a, i) => Ef(Math.cos(a * 1.1) * 8, -5.2 + Math.sin(a * 1.1) * 2.4, 1.2, 0.55, LEAF, 1, i)), ...lines([0.5, 1.6, 2.6, 3.9, 5].map(a => [rad(a, 0.15), rad(a)]), "#8A5A22", 0.35, 0.55)];
  } },
  hamburger: { w: 16, m: translate(0, -3.5), d: (r, h) => {
    const burger = [S(rrect(-5.6, -2.2, 11.2, 2.4, 1.2), "#D49A4A"), S(rrect(-5.9, -4.6, 11.8, 2.6, 1.3), "#6B3A22"), ...lines([[[-4, -4], [-1, -3.4]], [[1, -3.6], [4.4, -4.2]]], "#A0622F", 0.4, 0.7), P([[-6.4, -4.9, 0], [6.4, -4.9, 0], [5.2, -5.7], [2.4, -5.3], [1.4, -4.2], [-1, -5.6], [-4, -5.4]], "#F2C230"),
      S(rrect(-5.4, -6.7, 10.8, 1.5, 0.7), "#D63A28"), P([[-6.2, -6.5, 0], [-4, -7.7], [-2, -6.7], [0, -7.9], [2, -6.8], [4, -7.7], [6.2, -6.5, 0], [4, -5.8], [-4, -5.8]], "#7DB84A"),
      P([[-6, -7.6, 0], [6, -7.6, 0], [5.8, -10.2], [3.2, -12], [0, -12.6], [-3.2, -12], [-5.8, -10.2]], "#D9A04A"), F(ellipse(-2.2, -11, 2.6, 0.9), "#F2D08A", 0.6), ...dots(scat(r, 9, 0, -10.2, 4.2, 1.5), 0.35, 0.2, "#F7EAC0", 0.95)];
    return h ? burger : plated(18, r, burger);
  } },
  tost: { w: 30, d: r => plated(30, r, [
    ...[-1, 1].flatMap(i => [P([[i * 6.8 - 6, 2.6, 0], [i * 6.8 + 6, 2.6, 0], [i * 6.8 + 6, 5, 0], [i * 6.8 - 6, 5, 0]], "#F4E3B8"), F(rect(i * 6.8 - 6, 3.7, 12, 0.8), "#F2C230", 0.95), F(rect(i * 6.8 - 6, 3.2, 12, 0.5), "#E8A0A0", 0.95),
      P([[i * 6.8 - 6, 2.6, 0], [i * 6.8 + 6, 2.6, 0], [i * 6.8, -4.2, 0]], "#D49A3A"), ...lines([-1.5, -0.5, 0.5, 1.5].map(k => [[i * 6.8 + k * 2.4 - 2.2, 1.2], [i * 6.8 + k * 2.4 + 1.6, -1.6]] as Vec2[]), "#7A4A1C", 0.5, 0.65), ...dots([[i * 6.8 - 2, 3.2], [i * 6.8 + 3, 3.4]], 0.5, 0.3, "#F2C230")]),
    ...[[12.4, 1.4], [13.4, -1.4]].map(([x, y]) => E(x, y, 2.6, 0.9, "#7DA03A")), ...lines([[[10.8, 1.4], [14, 1.4]]], "#C8E080", 0.3, 0.7)]) },
  kumpir: { w: 24, d: r => {
    const fill = scat(r, 70, 0, -12.5, 7.6, 2.8), pk = (i: number) => fill.filter((_, j) => j % 6 === i);
    return [P([[-10.6, -0.4, 0], [10.6, -0.4, 0], [12.8, -4.2], [10, -6.4, 0], [-10, -6.4, 0], [-12.8, -4.2]], "#CBD0D6"), ...lines(Array.from({ length: 9 }, (_, i) => [[-9 + i * 2.25, -0.6], [-9.6 + i * 2.25, -5.8]] as Vec2[]), "#8E959C", 0.35, 0.7),
      P([[-11.4, -4.6], [-8.6, -9.6], [0, -11.4], [8.6, -9.6], [11.4, -4.6], [8, -2.6], [0, -2], [-8, -2.6]], "#B07A45"), F(ellipse(-4, -7, 5, 1.2), "#D9A670", 0.5), ...dots(scat(r, 10, 0, -6.4, 9, 2.4), 0.4, 0.25, "#6E4624", 0.7),
      E(0, -10.4, 8, 2.9, tone("#B07A45", "deep")), E(0, -10.9, 7.2, 2.4, "#F6DB7A"), P([[-6.8, -10.4, 0], [6.8, -10.4, 0], [5.6, -12.8], [2, -14.4], [-2.4, -14.2], [-5.6, -12.6]], "#F6D868"), Ef(-2.4, -13.2, 2.8, 0.7, "#FFF1B0", 0.7),
      ...dots(pk(0), 0.5, 0.45, "#F2B31E"), ...dots(pk(1), 0.45, 0.4, "#5E9A45"), ...many(pk(2), (x, y) => rrect(x - 0.7, y - 0.4, 1.4, 0.8, 0.3), "#8E3F7A"), ...pk(3).slice(0, 4).map(([x, y]) => E(x, y - 0.6, 1.2, 0.8, "#D9857A")), ...pk(4).slice(0, 4).flatMap(([x, y]) => [E(x, y - 0.4, 0.9, 0.6, "#2B2420"), Ef(x, y - 0.4, 0.3, 0.2, "#F2E6C8")]),
      R([[-6, -13.2], [-3, -14.6], [0, -12.8], [3, -14.6], [6, -13.2]], "#C23B2A", 0.9, { flat: true, opacity: 0.95 }), ...parsley(3, -13.6, 0.8)];
  } },
  kokorec: { w: 22, m: translate(0, -3), d: r => sub(22, 7, "#D9A04A", (x0, x1, y) => [heap(x0 + 1, x1 - 1, y, 5, "#6B3A22"), ...scat(r, 30, 0, y - 2, x1 - 2, 1.8).map(([x, yy]) => E(x, yy, r.range(0.8, 1.4), r.range(0.6, 0.9), r.pick(["#8A4B2A", "#A8643A", "#6E3A1E", "#B07A4A"]))),
    ...scat(r, 6, 0, y - 2.4, x1 - 3, 1.6).map(([x, yy]) => E(x, yy, 1, 0.7, "#D63A28")), ...dots(scat(r, 8, 0, y - 2.4, x1 - 3, 1.6), 0.7, 0.5, "#5E9A45", 0.95), ...dots(scat(r, 12, 0, y - 2.4, x1 - 3, 1.8), 0.25, 0.15, "#3E5A24", 0.9)]) },
  tantuni: { w: 14, m: translate(0, 4), d: (r, h) => { const L = 15, f = [Ef(L / 2 + 0.4, -5.6, 2.2, 1.6, "#8A4B2A", 1, 0.3), Ef(L / 2 + 1, -3.4, 1.9, 1.5, "#A8643A"), Ef(L / 2 + 0.2, -2, 2, 1.2, "#D63A28"), Ef(L / 2 + 1.6, -5, 1.2, 1.1, LEAF), Ef(L / 2 + 0.6, -6.8, 1.4, 1, "#5E9A45")];
    return [...up(wrap(L, 7, "#C79A63", "#F3EBD8", f), L, 7), ...(h ? [] : [R([[6, 0], [8.4, -1], [11.4, 0.4]], "#5E8A36", 1.6), E(-8.2, -0.8, 2.4, 1.1, "#D63A28")])]; } },
  cig_kofte: { w: 30, nv: true, d: r => plated(30, r, [
    ...[-8.5, 0, 8.5].flatMap((x, i) => { const y = i === 1 ? -1.8 : 0.4; return [P([[x - 4.6, y, 0], [x + 4.6, y, 0], [x + 5.8, y - 3.2], [x + 4.2, y - 6.4], [x + 1.6, y - 5.6], [x, y - 6.8], [x - 1.6, y - 5.6], [x - 4.2, y - 6.4], [x - 5.8, y - 3.2]], r.pick(["#8DBB5A", "#7DB04A", "#9CC868"])), ...lines([[[x, y - 0.4], [x, y - 5]], [[x - 1, y - 0.6], [x - 3.4, y - 4]], [[x + 1, y - 0.6], [x + 3.4, y - 4]]], "#C6E39A", 0.35, 0.8),
      Ef(x - 1.3, y - 2.8, 2.4, 1.3, "#A5482A", 1, -0.2), Ef(x + 1.5, y - 2.3, 2.2, 1.2, "#B5542E", 1, 0.2), ...lines([[[x - 2.4, y - 2.8], [x - 0.8, y - 2.6]], [[x + 0.6, y - 2.4], [x + 2.4, y - 2.2]]], "#6E2A14", 0.3, 0.7)]; }),
    ...lemon(12.8, 3.6), ...parsley(-13, 2.8, 0.9)]) },
  kisir: { w: 28, nv: true, d: r => plated(28, r, [
    ...[-8, 8].map(x => P([[x - 4.4, -2.4, 0], [x + 4.4, -2.4, 0], [x + 5.4, -5.4], [x + 3, -8.4], [x, -7.4], [x - 3, -8.4], [x - 5.4, -5.4]], "#8DBB5A")),
    ...at([P([[-8.4, 0, 0], [8.4, 0, 0], [7.4, -2.8], [4.2, -5.6], [0, -6.4], [-4.2, -5.6], [-7.4, -2.8]], "#D97A3A")], 0, -0.6), ...dots(scat(r, 40, 0, -3.6, 7, 2.6), 0.4, 0.28, "#E8A060", 0.85), ...dots(scat(r, 24, 0, -3.6, 7, 2.6), 0.4, 0.28, "#B8502A", 0.8), ...dots(scat(r, 18, 0, -3.6, 7, 2.6), 0.5, 0.3, LEAF, 0.9), ...dots(scat(r, 10, 0, -3.6, 6.6, 2.4), 0.35, 0.3, "#C21E3A", 0.95), Ef(-2.6, -5.8, 2.2, 0.5, "#F0B070", 0.6), ...lemon(10, 3.4)]) },
  etli_ekmek: { w: 48, d: r => [E(0, -2.6, 24.4, 5.6, tone("#B07A45", "shade")), E(0, -3.2, 24, 5.4, "#B07A45"), ...at([P([[-21, -2.4, 0], [-12, -5.8], [12, -5.8], [21, -2.4, 0], [12, 1], [-12, 1]], "#D9A55A"), P([[-19.4, -2.4, 0], [-11.6, -4.8], [11.6, -4.8], [19.4, -2.4, 0], [11.6, 0], [-11.6, 0]], "#B94A2A"),
      ...dots(scat(r, 60, 0, -2.4, 17.6, 2), 0.55, 0.3, "#7E2B18", 0.7), ...dots(scat(r, 40, 0, -2.4, 17.6, 2), 0.5, 0.3, "#DA7A3C", 0.65), ...dots(scat(r, 22, 0, -2.4, 17.6, 2), 0.45, 0.26, LEAF, 0.85), ...lines([-12, -4, 4, 12].map(x => [[x, -4.8], [x + 0.6, 0.2]] as Vec2[]), "#7A4A1C", 0.5, 0.75), Ef(-6, -4, 8, 0.4, WHITE, 0.25)], 0, -0.2), ...lemon(-17, 1, 0.8), ...parsley(17, 0.6)] },
  balik_ekmek: { w: 30, m: translate(0, -3), d: (r, h) => sub(24, 7, "#D9A04A", (x0, x1, y) => [P([[x0 + 0.5, y, 0], [x1 - 0.5, y, 0], [x1 - 1, y - 2], [x1 - 3, y - 3.2], [x0 + 3, y - 3.2], [x0 + 1, y - 2]], "#7DB84A"), ...[-9, -6, 5].map(x => E(x, y - 2.6, 1.7, 0.8, "#E8D5E3")),
      P([[x0 + 1, y - 1, 0], [x0 + 5, y - 3.8], [0, y - 4.2], [x1 + 1, y - 2.6], [x1 + 3.4, y - 2, 0], [x1 + 6, y - 4.6], [x1 + 5.6, y - 2.4], [x1 + 6.2, y - 0.4], [x1 + 3.4, y - 1.6, 0], [x1 - 2, y - 0.4], [0, y - 0.6]], "#6F8FA0"), ...lines([-7, -3.5, 0, 3.5, 7].map(x => [[x, y - 4], [x + 0.6, y - 1.2]] as Vec2[]), "#2E3A44", 0.7, 0.8), Ef(-2, y - 3.4, 8, 0.4, WHITE, 0.4),
      E(-5.5, y - 1.4, 1.5, 0.7, "#D63A28"), E(-10, y - 1.2, 1.3, 0.6, "#D63A28")]) },
  midye: { w: 32, nv: true, d: r => plated(32, r, [
    ...[[-10.5, -2], [-3.5, -3], [3.5, -2.6], [10.5, -2], [-8, 1.6], [0, 0.8], [8, 1.4], [-13, 1]].map(([x, y], i) => { const a = (i % 3 - 1) * 0.14; return [S(ell(x, y, 3.4, 1.9, a), "#232A3A"), Ef(x - 0.6, y - 0.5, 2.2, 0.4, "#5E6B84", 0.55, a), S(ell(x + 0.2, y + 0.1, 2.6, 1.3, a), "#9FB4C8"), S(ell(x + 0.2, y, 2.3, 1.1, a), "#F0E6C8"), ...dots(scat(r, 4, x + 0.2, y, 1.8, 0.7), 0.25, 0.15, "#BBA97A", 0.8)]; }).flat(),
    ...lemon(-13.8, 3.8, 0.8), ...lemon(14, 3.6, 0.8)]) },
  kuru_fasulye: { w: 22, v: [[0, -9]], d: r => bowl(18, 7.5, "#F6F1E6", "#C0502A", (cx, cy, rx, ry) => [Ef(cx - rx * 0.2, cy, rx * 0.6, ry * 0.5, "#D9703A", 0.6),
    ...scat(r, 44, cx, cy, rx * 0.9, ry * 0.82).flatMap(([x, y]) => [Ef(x, y, 0.85, 0.55, "#F2E6CC", 1, r.range(-1, 1)), Ef(x - 0.2, y - 0.15, 0.3, 0.13, WHITE, 0.75)]), ...scat(r, 4, cx, cy, rx * 0.7, ry * 0.6).map(([x, y]) => Ef(x, y, 1.1, 0.7, "#8A2E24")), ...dots(scat(r, 8, cx, cy, rx * 0.8, ry * 0.7), 0.35, 0.22, LEAF, 0.95)]) },
  sarma: { w: 30, d: r => plated(30, r, [
    ...[[-10.2, 1.4], [-3.4, 1.6], [3.4, 1.6], [10.2, 1.4], [-6.8, -0.8], [0, -0.6], [6.8, -0.8], [-3.4, -3], [3.4, -3]].flatMap(([x, y], i) => { const c = r.pick(["#5A7A35", "#4E6E2E", "#66883C"]), a = (i % 3 - 1) * 0.05;
      return [S(ell(x, y, 3.5, 1.5, a), c), E(x + 3.2, y + 0.1, 0.5, 1.1, tone(c, "deep"), { flat: true }), ...lines([[[x - 3, y - 0.1], [x, y + 0.2], [x + 3, y]], [[x - 2.4, y + 0.7], [x + 2.2, y + 0.7]]], tone(c, "deep"), 0.25, 0.55), Ef(x - 0.6, y - 0.7, 2.2, 0.25, tone(c, "light"), 0.6, a)]; }),
    ...lemon(13, 3.2), ...parsley(-13, 3, 0.9)]) },
  karniyarik: { w: 36, d: r => plated(36, r, [
    P([[-14, -1, 0], [-8, -4.6], [6, -5], [14, -2.4], [8, 1.8], [-6, 2.4]], "#3A2A4A"), Ef(-6, -3.4, 8, 0.5, WHITE, 0.3), P([[-12, -1.2, 0], [-7, -3.6], [6, -3.8], [12.4, -2.2, 0], [7, 0.6], [-6, 1]], "#B5683A"),
    ...dots(scat(r, 40, 0, -1.4, 10, 1.9), 0.5, 0.3, "#7A3A1E", 0.8), ...dots(scat(r, 22, 0, -1.4, 10, 1.9), 0.4, 0.26, "#D98A4A", 0.7), ...[-6.4, -1.6, 3.2].map(x => E(x, -2.6, 2, 1, "#D63A28")), R([[-10, -0.4], [-3, 0.4], [6, 0], [11, -1]], "#5E9A45", 1.2), P([[-15.6, -1.4, 0], [-13, -3, 0], [-12.6, 0.4, 0]], "#4E8A3A"), ...parsley(13.4, 3, 0.9)]) },
  balik_izgara: { w: 38, d: r => plated(38, r, [
    P([[-14, -1, 0], [-9, -4, 0], [3, -4.6], [10, -2.6], [14.5, -1], [10, 0.8], [2, 2.4], [-8, 2.2]], "#7E9AAA"), P([[14, -1, 0], [18.4, -3.8, 0], [17.4, -1.2], [18.4, 1.6, 0]], "#5E7A8A"), P([[-8, 2.2, 0], [2, 2.4], [10, 0.8], [8, 1.6], [-4, 2.8]], "#E9D9B8"), ...lines(Array.from({ length: 6 }, (_, i) => [[-5 + i * 3, -4.2], [-4 + i * 3, 1.6]] as Vec2[]), "#2E3A44", 0.7, 0.75), ...lines([[[-10, -1.4], [-9.4, 1.2]]], "#4A5E6A", 0.5, 0.8), Ef(-2, -3.4, 9, 0.45, WHITE, 0.4), E(-11.4, -1.4, 0.55, 0.55, "#1E2A33"),
    ...lemon(-2, 3.4, 0.9), ...lemon(3.4, 3.6, 0.9), ...[-13, -11].map((x, i) => Ef(x, 3.4 + i, 1.8, 0.8, "#4E8A3A", 1, -0.4 + i)), ...parsley(15, 3.4, 0.9)]) },
  // <dish>
};

const dish: PieceDef = { draw: (p, r, kit) => drawKind("dish", DISH, p, r, kit, 9, 0.3, true), variants: variants(DISH, ["soup", "menemen", "kuru_fasulye", "manti"]),
  meta: {
    about: "A plated dish seen from a little above: soup (lentil, with a lemon wedge), doner, a wrapped durum, kebab, iskender, lahmacun, pide, borek, gozleme, kofte, menemen in its pan, manti, makarna, pizza, hamburger, tost, a loaded kumpir, kokorec, tantuni, cig kofte in lettuce, kisir, etli ekmek, balik ekmek, stuffed mussels or a bowl of kuru fasulye; then sarma (stuffed vine leaves), karniyarik (stuffed aubergine) and a grilled whole fish, balik_izgara.",
    params: {
      kind: { type: "enum", values: Object.keys(DISH), default: "soup" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (two rows past eight); held, one" },
      hot: { type: "bool", default: false, about: "steam rises from it (not from the cold cig_kofte, kisir and midye)" },
    },
    terms: ["a1-w-corba", "a1-w-mercimek-corbasi", "a1-w-doner", "a2-w-durum-2", "a1-w-kebap", "a2-w-iskender-kebabi", "a2-w-lahmacun", "a2-w-pide", "a2-w-borek", "a2-w-gozleme", "a2-w-kofte", "a2-w-makarna", "a2-w-pizza", "a1-w-hamburger", "a2-w-tost", "a2-w-kumpir", "a2-w-kokorec", "a2-w-tantuni", "a2-w-cig-kofte", "a2-w-kisir", "a2-w-etli-ekmek", "b1-w-kuru-fasulye", "a1-w-yemek", "a2-w-ana-yemek", "a1-w-balik", "a1-w-patates"],
    tags: ["food", "dish"],
  } };

// ---- sweet ------------------------------------------------------------------------------------------

/** A block seen a little from the right: its front x - w/2 … x + w/2 and y - h … y, its top and right side going back `d`. */
const box = (x: number, y: number, w: number, h: number, d: number, c: string, top = tone(c, "light"), side = tone(c, "shade")): Shape[] => {
  const x0 = x - w / 2, x1 = x + w / 2, k = d * 0.6;
  return [S(poly([[x1 - 0.2, y - h], [x1 + d, y - h - k], [x1 + d, y - k], [x1 - 0.2, y]]), side), S(poly([[x0, y - h + 0.2], [x0 + d, y - h - k], [x1 + d, y - h - k], [x1, y - h + 0.2]]), top), S(rect(x0, y - h, w, h), c)];
};
/** `n` things heaped, the base row first: where each goes, `p` apart across and `s` up. */
function pile(n: number, p: number, s: number): Vec2[] {
  const base = Math.ceil(Math.sqrt(1.6 * n) + 0.5), out: Vec2[] = [];
  for (let row = 0, left = n; left > 0; row++) { const k = Math.min(left, Math.max(1, base - row)); for (let j = 0; j < k; j++) out.push([(j - (k - 1) / 2) * p, -row * s]); left -= k; }
  return out;
}
/** An ice-cream scoop of radius `rr` at (x, y). */
const scoop = (x: number, y: number, rr: number, c: string): Shape[] => at([...[-0.7, -0.25, 0.25, 0.7].map(k => E(k * rr, rr * 0.62, rr * 0.3, rr * 0.25, c)), E(0, 0, rr, rr * 0.95, c), F(ellipse(rr * 0.55, rr * 0.25, rr * 0.7, rr * 0.7), tone(c, "shade"), 0.4, ellipse(0, 0, rr, rr * 0.95)), Ef(-rr * 0.35, -rr * 0.4, rr * 0.35, rr * 0.2, WHITE, 0.5)], x, y);
const SWEETS = ["#E8799A", "#F2A7B4", "#9CD3C0", "#F2D06B", "#E58F4A", "#B9A6DC"];

const SWEET: Record<string, K> = {
  baklava: { w: 36, c: true, d: (r, h, p) => {
    const n = cnt(p.n, 12), cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(n * 1.2)))), rows = Math.ceil(n / cols), rx = cols * 3.2 + 5.4, ry = rows * 1.3 + 3.4, sh: Shape[] = [E(0, -1, rx, ry, tone(STEEL, "shade")), E(0, -1.8, rx, ry, STEEL), E(0, -1.9, rx - 1, ry - 0.9, tone(STEEL, "light"))];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), x = (i % cols - (cols - 1) / 2 + Math.floor((cols - inRow) / 2)) * 6.4 + (row % 2 ? 3.2 : 0) - (rows > 1 ? 1.6 : 0), y = -0.9 - (rows - 1) * 0.85 + row * 1.7, yt = y - 1.9;
      sh.push(S(poly([[x - 3.2, yt], [x, yt + 1.7], [x, y + 1.7], [x - 3.2, y]]), "#EDC878"), S(poly([[x, yt + 1.7], [x + 3.2, yt], [x + 3.2, y], [x, y + 1.7]]), "#D6A850"), S(poly([[x - 3.2, yt], [x, yt - 1.7], [x + 3.2, yt], [x, yt + 1.7]]), "#D9953A"), Ef(x, yt, 1.1, 0.55, "#7DA03A"), Ef(x - 0.3, yt - 0.1, 0.4, 0.2, "#B8D870", 0.9), Ef(x - 1, yt - 0.7, 1, 0.25, WHITE, 0.4));
      sh.push(...lines([[[x - 3, yt + 0.6], [x, yt + 2.2], [x + 3, yt + 0.6]], [[x - 3, yt + 1.2], [x, yt + 2.8], [x + 3, yt + 1.2]]], "#9A6A22", 0.3, 0.6));
    }
    return sh;
  } },
  lokum: { w: 22, c: true, d: (r, h, p) => {
    const n = cnt(p.n, 9), c0 = typeof p.color === "string" ? hex(p.color, SWEETS[0]) : "", ps = pile(n, 2.7, 2.5), cw = Math.max(...ps.map(q => Math.abs(q[0]))) * 2 + 8, dust: Vec2[] = [], sh: Shape[] = [];
    ps.forEach(([x, y0], i) => { const c = c0 || SWEETS[i % 5], y = y0 - 0.5 + r.range(-0.2, 0.2), cx = x + r.range(-0.3, 0.3);
      sh.push(S(poly([[cx + 1.4, y - 2.6], [cx + 2.5, y - 3.4], [cx + 2.5, y - 0.8], [cx + 1.4, y]]), tone(c, "shade")), S(poly([[cx - 1.4, y - 2.6], [cx - 0.3, y - 3.4], [cx + 2.5, y - 3.4], [cx + 1.4, y - 2.6]]), tone(c, "light")), S(rect(cx - 1.4, y - 2.6, 2.8, 2.6), c), Ef(cx - 0.4, y - 1.3, 1.1, 0.9, WHITE, 0.25));
      dust.push(...scat(r, 6, cx, y - 1.3, 1.2, 1.1), ...scat(r, 3, cx + 0.6, y - 3, 1.5, 0.3)); });
    return [E(0, -1.2, cw / 2, 2.4, tone("#C79A63", "shade")), E(0, -2, cw / 2, 2.4, "#C79A63"), ...at([...sh, ...dots(dust, 0.16, 0.11, WHITE, 0.85)], 0, -1.5)];
  } },
  kunefe: { w: 22, v: [[0, -9]], d: r => {
    const cx = 0, cy = -3.8, rx = 8.6, ry = 2.9, pt = (a: number, k = 1): Vec2 => [Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    return [...[-1, 1].map(i => S(rrect(i * 9.6 - 1.6, -4.6, 3.2, 1.8, 0.9), tone("#B8693A", "deep"))), P([[-8.8, -1, 0], [8.8, -1, 0], [9.4, -3.8, 0], [-9.4, -3.8, 0]], "#B8693A"), F(rect(3, -3.8, 7, 3.8), tone("#B8693A", "shade"), 0.55, poly([[-8.8, -1], [8.8, -1], [9.4, -3.8], [-9.4, -3.8]])), E(0, -1.2, 8.8, 1.5, tone("#B8693A", "deep")), E(cx, cy, 9.4, 3.1, "#D58A4A"), E(cx, cy, 8.4, 2.6, "#B8693A"),
      E(cx, cy - 0.2, rx, ry, "#E08A2E"), ...lines(Array.from({ length: 16 }, (_, i) => [pt(i * 0.4, 0.5), pt(i * 0.4 + 0.1, 0.98)]), "#B8601E", 0.35, 0.55), ...lines(Array.from({ length: 10 }, (_, i) => [pt(i * 0.63 + 0.2, 0.3), pt(i * 0.63 + 0.25, 0.8)]), "#F6C060", 0.3, 0.7), Ef(-3, cy - 1.2, 4, 0.4, WHITE, 0.4),
      S(poly([[0, cy], pt(0.5, 1.02), pt(0.9, 1.02), pt(1.3, 1.02)]), "#F7E7B0"), ...lines([[[1.5, cy + 0.6], [3.4, cy + 2.2]], [[3, cy + 0.2], [5.4, cy + 1.8]]], "#EBD58A", 0.35, 0.8), ...dots(scat(r, 20, 0, cy - 0.2, 6.4, 1.9), 0.5, 0.3, "#6E9A36", 0.95), ...dots(scat(r, 10, 0, cy - 0.2, 5, 1.5), 0.4, 0.25, "#B8D870", 0.9)];
  } },
  dondurma_cone: { w: 10, m: translate(0, 2), d: (r, h, p) => {
    const c = "#D9A860", cone = P([[-3.3, -9.2, 0], [3.3, -9.2, 0], [0.5, -0.2], [0, 0, 0], [-0.5, -0.2]], c);
    return [cone, ...lines([...Array.from({ length: 6 }, (_, i) => [[-4, -9.2 + i * 1.8], [4, -5.2 + i * 1.8]] as Vec2[]), ...Array.from({ length: 6 }, (_, i) => [[4, -9.2 + i * 1.8], [-4, -5.2 + i * 1.8]] as Vec2[])], tone(c, "deep"), 0.3, 0.55, cone.path), F(rect(-4, -9.2, 8, 1), tone(c, "light"), 0.7, cone.path), F(rect(1.2, -10, 4, 12), tone(c, "shade"), 0.4, cone.path),
      ...scoop(0, -11.2, 3.5, "#F3E3B8"), ...scoop(0.1, -14.4, 3.1, hex(p.color, "#E8799A"))];
  } },
  dondurma_cup: { w: 12, m: translate(0, -2), d: (r, h, p) => {
    const k = cnt(p.scoops, 3, 3), cols = [hex(p.color, "#E8799A"), "#F3E3B8", "#7A4A2E"], at3: Vec2[][] = [[[0, -8.2]], [[-2.1, -8.2], [2.1, -8.5]], [[-2.2, -8], [2.2, -8.2], [0, -10.4]]];
    const cup = P([[-4.3, -7, 0], [4.3, -7, 0], [3, 0, 0], [-3, 0, 0]], "#F6F1E6");
    return [R([[3, -8.5], [4.8, -12.6]], "#D9B87A", 1.1), S(ell(5, -13.2, 1, 1.5, 0.3), "#D9B87A"), cup, F(rect(-5, -6.1, 10, 1.6), "#C8283A", 0.9, cup.path), F(rect(-5, -2.6, 10, 0.7), "#C8283A", 0.7, cup.path), F(rect(1.4, -7, 4, 7.2), tone("#F6F1E6", "shade"), 0.55, cup.path), E(0, -7, 4.3, 1.2, "#FFFFFF"), E(0, -6.9, 3.7, 0.8, tone("#F6F1E6", "shade")),
      ...at3[k - 1].flatMap(([x, y], i) => scoop(x, y, 2.8, cols[i % 3]))];
  } },
  sutlac: { w: 17, d: r => { const top = ellipse(0, -3.7, 5.3, 1.4); return [P([[-6.6, -3.4, 0], [6.6, -3.4, 0], [5.8, -1.2], [3.6, 0, 0], [-3.6, 0, 0], [-5.8, -1.2]], "#B5683B"), F(rect(2, -3.4, 6, 3.4), tone("#B5683B", "shade"), 0.55, poly([[-6.6, -3.4], [6.6, -3.4], [5.8, -1.2], [3.6, 0], [-3.6, 0], [-5.8, -1.2]])), E(0, -3.4, 6.6, 2, "#C4794A"), E(0, -3.3, 5.8, 1.6, tone("#B5683B", "deep")), E(0, -3.7, 5.3, 1.4, "#EBD39A"),
    ...scat(r, 15, 0, -3.7, 4.8, 1).flatMap(([x, y]) => [Ef(x, y, r.range(1.3, 2.4), r.range(0.4, 0.7), "#B96F2C", 0.92, r.range(-0.4, 0.4), top), Ef(x + 0.3, y, r.range(0.5, 1.1), r.range(0.18, 0.34), "#6E3A1A", 0.85, 0, top)]), Ef(-2.4, -4.5, 2, 0.25, WHITE, 0.45, 0, top)]; } },
  kadayif: { w: 24, d: r => plated(24, r, [
    ...[[-4.8, 1.2], [4.6, -1.4]].flatMap(([x, y]) => [...box(x, y, 8.2, 3.4, 4, "#C98A3A", "#D99A44"), ...lines(Array.from({ length: 9 }, (_, i) => [[x - 3.8 + i * 0.95, y - 3.1], [x - 3.5 + i * 0.95, y - 1.6], [x - 3.8 + i * 0.95, y - 0.2]] as Vec2[]), "#E6B060", 0.3, 0.8), ...lines(Array.from({ length: 8 }, (_, i) => [[x - 3.4 + i * 1, y - 3], [x - 3.2 + i * 1, y - 0.4]] as Vec2[]), "#7A4A1C", 0.25, 0.5),
      ...lines(Array.from({ length: 7 }, (_, i) => [[x - 3.6 + i * 1.1, y - 3.6], [x - 0.4 + i * 1.1, y - 5.6]] as Vec2[]), "#E6B060", 0.28, 0.75), ...dots(scat(r, 7, x + 2, y - 4.7, 3, 0.9), 0.4, 0.25, "#6E9A36", 0.95), Ef(x + 1, y - 4.5, 2.6, 0.3, WHITE, 0.4)])]) },
  chocolate: { w: 10, m: translate(0, -2), t: p => [{ text: str(p.label, "ÇİKOLATA"), x: -3, y: -9.4, w: 6, h: 3, font: "print", color: "#FFF4E0", size: 1.4 }], d: (r, h, p) => {
    const c = hex(p.color, "#B8322A"), bar = rrect(-3.4, -15.2, 6.8, 15.2, 0.7), pp = rect(-3.7, -9.8, 7.4, 9.8);
    return [S(bar, "#5A3A28"), ...[0, 1].flatMap(i => [0, 1].flatMap(j => [S(rrect(-3 + i * 3.1, -14.8 + j * 2.2, 2.9, 2, 0.4), "#6B4430"), F(rect(-3 + i * 3.1, -14.8 + j * 2.2, 2.9, 0.35), tone("#6B4430", "light"), 0.7), F(rect(-3 + i * 3.1 + 2.5, -14.8 + j * 2.2, 0.4, 2), tone("#6B4430", "deep"), 0.6)])), S(pp, c), ...lit(pp, c, -3.7, 3.7, -9.8, 0, 0.2), F(rect(-3.7, -3.4, 7.4, 0.7), tone(c, "light"), 0.6), F(rect(-3.7, -2.2, 7.4, 0.35), tone(c, "deep"), 0.5),
      S(poly([[-3.9, -9.8], [3.9, -9.8], [3.5, -11], [-3.5, -11]]), STEEL), ...lines([[[-2, -10.8], [-1.4, -9.9]], [[0.4, -10.8], [1.2, -9.9]], [[2.4, -10.8], [2.9, -9.9]]], tone(STEEL, "shade"), 0.3, 0.8)];
  } },
  pismaniye: { w: 18, t: p => [{ text: str(p.label, "PİŞMANİYE"), x: -6, y: -5, w: 12, h: 3, font: "print", color: "#FFF4E0", size: 1.8 }], d: r => {
    const c = "#C23B2A", fc = "#F5EBD2", pf: Vec2[] = [[-5.6, -8.2], [-2.6, -9.8], [1.2, -10.8], [4.8, -9.4], [6.4, -7.6], [-6.6, -7], [0, -7.8], [3.4, -7.4], [-3.4, -7.2]], pr = [2.5, 3, 3.2, 2.8, 2.2, 2, 3.4, 2.6, 2.6];
    const fl = S(pf.slice(1).reduce((pa, [x, y], k) => pa.add(ellipse(x, y, pr[k + 1])), ellipse(pf[0][0], pf[0][1], pr[0])), fc);
    const arc = (x: number, y: number, q: number, a: number, sw: number, col: string, w = 0.16) => L([0, 1, 2, 3, 4].map(k => [x + Math.cos(a + sw * k / 4) * q, y + Math.sin(a + sw * k / 4) * q * 0.9] as Vec2), col, w, 0.9);
    return [fl, F(rect(4.4, -15, 6, 12), tone(fc, "shade"), 0.4, fl.path), ...pf.flatMap(([x, y], k) => [arc(x, y, pr[k] * 0.72, r.range(3.3, 5), 2.2, "#FFF9EA"), arc(x, y, pr[k] * 0.45, r.range(3.3, 5.5), 2, "#E3D3A8"), arc(x, y, pr[k] * 0.9, r.range(2.2, 4), 1.8, "#E3D3A8", 0.12)]),
      ...[[[-8.8, -9.2], [-9.6, -10.6], [-9.2, -11.6]], [[-1, -13], [-0.4, -14.2], [1, -14.6]], [[3, -12.4], [4, -13.4], [5.4, -13.6]], [[7.2, -10.4], [8.4, -11], [9.2, -12.2]]].map(w => R(w as Vec2[], fc, 0.22)),
      S(rect(-7.6, -6.4, 15.2, 6.4), c), ...lit(rect(-7.6, -6.4, 15.2, 6.4), c, -7.6, 7.6, -6.4, 0, 0.18), F(rect(-7.6, -6.4, 15.2, 0.8), tone(c, "light"), 0.6), F(rect(-7.6, -5.8, 15.2, 0.5), "#F2D06B", 0.9), F(rect(-7.6, -1.2, 15.2, 0.5), "#F2D06B", 0.9)];
  } },
  candy: { w: 14, c: true, d: (r, h, p) => {
    const n = cnt(p.n, 7), c0 = typeof p.color === "string" ? hex(p.color, "") : "", sh: Shape[] = [];
    pile(n, 3.4, 2).forEach(([x, y], i) => { const c = c0 || ["#D9534A", "#2F8C88", "#E0A83A", "#7A3E6E", "#E58FA0", "#1F5FC0", "#F0745F"][i % 7], a = r.range(-0.7, 0.7);
      sh.push(...mv([P([[-2, 0, 0], [-4.3, -1.5, 0], [-4.3, 1.5, 0]], tone(c, "light")), P([[2, 0, 0], [4.3, -1.5, 0], [4.3, 1.5, 0]], tone(c, "light")), E(0, 0, 2.3, 1.5, c), ...lines([[[-0.9, -1.4], [-0.5, 1.4]], [[0.4, -1.4], [0.8, 1.4]]], tone(c, "light"), 0.4, 0.7), Ef(-0.7, -0.6, 1, 0.3, WHITE, 0.5)], mul(translate(x, y - 1.3), mul(rotate(a), [0.78, 0, 0, 0.78, 0, 0])))); });
    return sh;
  } },
  helva: { w: 30, d: r => plated(28, r, [
    ...box(-3.4, 0.6, 13.6, 6.6, 4.4, "#D8BC82", "#E6CF9C"), ...lines(Array.from({ length: 10 }, (_, i) => [[-9.8 + i * 1.4, -6], [-9.5 + i * 1.4, 0.3]] as Vec2[]), "#EAD5A0", 0.25, 0.4),
    ...[[-4.9, 0], [-3.2, 1.5], [-1.5, 0.6]].map(([y, o]) => L([-9.4, -6.4, -3.4, -0.4, 2.6].map((x, k) => [x, y + (k % 2 ? -0.7 : 0.6) * (o > 1 ? -1 : 1)] as Vec2), "#8A5A2B", 0.45, 0.4)), ...[[-6.7, -2], [-4.4, 1.6]].map(([x, y]) => L([[x, -4.2 + y * 0.2], [x + 1.6, -3.4 + y * 0.2], [x + 3.4, -4.2 + y * 0.2]], "#F2E2B8", 0.4, 0.55)),
    ...[[[-6.4, -6.6], [-2, -7.1], [2.2, -6.7]], [[-5.8, -7.7], [-1.4, -8], [3.6, -7.6], [5.6, -7.9]]].map(w => L(w as Vec2[], "#8A5A2B", 0.4, 0.4)), ...dots(scat(r, 8, -2, -7.3, 6.4, 0.7), 0.45, 0.28, "#6E9A36", 0.95), ...box(9.6, 3.4, 5.6, 1.5, 3, "#D8BC82", "#E6CF9C"), ...dots(scat(r, 4, 11, 0.8, 2, 0.4), 0.25, 0.15, "#8A5A2B", 0.6)]) },
  asure: { w: 18, hv: true, d: r => bowl(15, 6.4, "#F6F1E6", "#C9A98A", (cx, cy, rx, ry) => [Ef(cx - rx * 0.2, cy, rx * 0.7, ry * 0.5, "#DCC2A4", 0.7), ...dots(scat(r, 34, cx, cy, rx * 0.86, ry * 0.8), 0.4, 0.28, "#C21E3A", 0.95), ...dots(scat(r, 10, cx, cy, rx * 0.8, ry * 0.7), 0.25, 0.18, "#E86A7E", 0.9),
    ...scat(r, 4, cx, cy, rx * 0.7, ry * 0.6).flatMap(([x, y]) => [Ef(x, y, 1.1, 0.75, "#B07A4A", 1, r.range(-1, 1)), Ef(x, y, 0.6, 0.15, "#6E4624", 0.7)]), ...scat(r, 4, cx, cy, rx * 0.7, ry * 0.6).map(([x, y]) => Ef(x, y, 1, 0.45, "#F0E2C0", 1, r.range(-1, 1))), ...scat(r, 3, cx, cy, rx * 0.7, ry * 0.6).map(([x, y]) => Ef(x, y, 0.9, 0.5, "#E58F2A")), ...dots(scat(r, 10, cx, cy, rx * 0.8, ry * 0.7), 0.3, 0.18, "#4A2A18", 0.9)]) },
  revani: { w: 24, c: true, d: (r, h, p) => {
    const n = cnt(p.n, 6), cols = Math.min(n, 3), rows = Math.ceil(n / cols), rx = cols * 3.4 + 3.6, dp = rows * 3 + 3.6, sh: Shape[] = [S(rrect(-rx, -dp - 2, rx * 2, dp + 2, 1), STEEL), S(rrect(-rx + 0.8, -dp - 1.4, rx * 2 - 1.6, dp, 0.6), tone(STEEL, "shade"))];
    for (let i = 0; i < n; i++) { const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), x = (i % cols - (inRow - 1) / 2) * 6.8 - 1.4, y = -2.6 - (rows - 1 - row) * 3;
      sh.push(...box(x, y, 5.6, 3.2, 2.4, "#F0CD6C", "#E0A33A"), ...dots(scat(r, 6, x, y - 1.6, 2.4, 1.2), 0.25, 0.18, "#C99A3A", 0.7), ...dots(scat(r, 6, x + 1.2, y - 4.2, 2, 0.5), 0.25, 0.15, WHITE, 0.9), Ef(x + 1.2, y - 4.2, 0.8, 0.4, "#6E9A36")); }
    return [...sh, S(rrect(-rx, -2.2, rx * 2, 2.2, 0.6), STEEL), F(rect(-rx, -2.2, rx * 2, 0.5), WHITE, 0.4)];
  } },
  lokma: { w: 30, c: true, hv: true, d: (r, h, p) => {
    const n = cnt(p.n, 9), ps = pile(n, 3.6, 3), pw = Math.max(22, Math.max(...ps.map(q => Math.abs(q[0]))) * 2 + 12);
    return plated(pw, r, [...ps.flatMap(([x, y]) => { const c = r.pick(["#C98238", "#B8702A", "#D4903F"]); return [E(x, y - 2, 2, 1.9, c), Ef(x - 0.6, y - 2.6, 0.8, 0.5, "#EEC27E", 0.8), Ef(x + 0.7, y - 1.2, 1, 0.8, tone(c, "shade"), 0.4)]; }),
      ...lines([[[-4, -2], [-1, -4], [2, -3]], [[0, -1], [3, -2.4], [5, -1.6]]], "#E8A03A", 0.5, 0.75)]);
  } },
  tulumba: { w: 30, c: true, hv: true, d: (r, h, p) => {
    const n = cnt(p.n, 8), ps = pile(n, 7.4, 2.2), pw = Math.max(26, Math.max(...ps.map(q => Math.abs(q[0]))) * 2 + 16);
    return plated(pw, r, ps.flatMap(([x, y]) => { const c = r.pick(["#D9772E", "#CE6E26", "#E08A3A"]), a = r.range(-0.12, 0.12);
      return [S(rrect(x - 4, y - 3.6, 8, 2.4, 1.2).transform(rotate(a)), c), ...lines(Array.from({ length: 6 }, (_, i) => [[x - 3 + i * 1.2, y - 3.5], [x - 2.5 + i * 1.2, y - 1.3]] as Vec2[]), tone(c, "deep"), 0.35, 0.6), Ef(x - 1, y - 3.1, 2.6, 0.3, "#F6C58A", 0.8, a)]; }));
  } },
  kazandibi: { w: 22, d: r => plated(22, r, [
    ...[[-3.4, 1.6], [4, -1.4]].flatMap(([x, y]) => [...box(x, y, 8, 3.6, 4, "#F4E8CC", "#8A4A22"), ...dots(scat(r, 12, x + 2, y - 4.5, 3.4, 0.9), 0.5, 0.25, "#4A2410", 0.8), Ef(x + 1, y - 4.8, 2.4, 0.25, "#D98A4A", 0.7), ...lines([[[x - 3.6, y - 3.4], [x + 3.6, y - 3.4]]], "#C9A870", 0.3, 0.6), ...dots(scat(r, 5, x + 2, y - 4.5, 3, 0.7), 0.3, 0.2, "#B8702A", 0.8)]), ...dots(scat(r, 8, 0, -1, 9, 3), 0.25, 0.15, "#8A4A22", 0.5)]) },
  // <sweet>
};

const sweet: PieceDef = { draw: (p, r, kit) => drawKind("sweet", SWEET, p, r, kit, 10), variants: variants(SWEET, ["kunefe"]),
  meta: {
    about: "A Turkish sweet: baklava diamonds on a tray, lokum cubes dusted white, kunefe in its copper dish, an ice-cream cone or cup, sutlac in a clay pot, kadayif, a half-unwrapped chocolate bar, pismaniye floss in a box, wrapped candy, a block of tahini helva, asure in a bowl or revani squares; then lokma, tulumba and kazandibi.",
    params: {
      kind: { type: "enum", values: Object.keys(SWEET), default: "baklava" },
      n: { type: "int", min: 1, max: 24, about: "how many side by side; for baklava, lokum, candy and revani the pieces on the tray or in the heap (default: a plateful)" },
      scoops: { type: "int", min: 1, max: 3, default: 3, about: "dondurma_cup: how many scoops in the cup" },
      color: { type: "color", about: "lokum, candy: every piece this colour; chocolate: the wrapper; dondurma_cone and dondurma_cup: the top or first scoop; default the usual mix" },
      label: { type: "text", about: "chocolate: the word on the wrapper (default ÇİKOLATA); pismaniye: on the box (default PİŞMANİYE)" },
      hot: { type: "bool", default: false, about: "kunefe, asure, lokma, tulumba: steam rises from it" },
    },
    terms: ["a1-w-baklava", "a2-w-lokum", "a2-w-kunefe", "a1-w-dondurma", "a2-w-kadayif", "a2-w-cikolata", "a2-w-pismaniye", "a2-w-sekerleme", "a1-w-tatli", "a2-w-kadayif-dolmasi", "b1-w-lokma"],
    tags: ["food", "sweet"],
  } };

// ---- snack ------------------------------------------------------------------------------------------

const SEEDS = "#2E2C31";

const SNACK: Record<string, K> = {
  cips: { w: 17, m: translate(0, 4), t: p => [{ text: str(p.label, "CİPS"), x: -5.4, y: -18.8, w: 10.8, h: 4.4, font: "print", color: "#3A2418", weight: 800 }], d: (r, h, p) => {
    const c = hex(p.color, "#D9534A"), body = P([[-6.6, -21, 0], [6.6, -21, 0], [7.3, -14], [7, -6], [6.6, -1.2, 0], [-6.6, -1.2, 0], [-7, -6], [-7.3, -14]], c), zig = (y: number, k: number): Vec2[] => Array.from({ length: 15 }, (_, i) => [-7 + i, y + (i % 2) * k]);
    return [S(poly([...zig(-22.8, 0.8), [7, -20], [-7, -20]]), tone(c, "shade")), S(poly([[-7, -2.4], [7, -2.4], ...zig(-0.4, -0.8).reverse()]), tone(c, "shade")), body, ...lit(body.path, c, -7.3, 7.3, -21, -1, 0.22), F(rect(-7.6, -19.4, 15.2, 8.2), "#F6E9C2", 0.95, body.path), Ef(3.4, -12.6, 2.6, 1.6, "#E8B93A", 1, 0.5), Ef(3.4, -12.6, 2.6, 1.6, "#C9902A", 0.5, 0.5), ...lines([[[1.6, -13.4], [3.4, -11.2]], [[3, -14], [4.8, -11.8]]], "#C9902A", 0.3, 0.8),
      F(rect(-7.6, -10.4, 15.2, 0.5), tone(c, "light"), 0.7, body.path), F(rect(-7.6, -2.4, 15.2, 0.5), tone(c, "deep"), 0.4, body.path), F(rect(-7.3, -21, 1.5, 20), WHITE, 0.3, body.path)];
  } },
  cekirdek: { w: 14, m: translate(0, 3), d: (r, h) => {
    const cone = P([[-5, -11, 0], [5, -11, 0], [0.8, -0.3], [0, 0, 0], [-0.8, -0.3]], "#EBDDBE"), sd = scat(r, 30, 0, -13, 4, 2.4).sort((a, b) => a[1] - b[1]);
    return [cone, ...lines(Array.from({ length: 9 }, (_, i) => [[-4.6 + (i % 2) * 0.4, -10.4 + i * 1.1], [4.4, -10.4 + i * 1.1]] as Vec2[]), "#8A8478", 0.3, 0.5, cone.path), F(rect(1, -11, 6, 12), tone("#EBDDBE", "shade"), 0.55, cone.path), ...lines([[[-4.8, -10.6], [-0.4, -1]]], tone("#EBDDBE", "deep"), 0.3, 0.7, cone.path),
      P([[-4.8, -10.8, 0], [4.8, -10.8, 0], [4.2, -13.2], [2, -15.4], [-1.4, -15.6], [-3.8, -14], [-4.6, -12.2]], "#3A3A40"), ...sd.flatMap(([x, y]) => { const a = r.range(-1.2, 1.2); return [S(ell(x, y, 1.15, 0.6, a), SEEDS), Ef(x - 0.1, y, 0.8, 0.14, "#D9D4C7", 0.9, a)]; }),
      ...(h ? [] : scat(r, 6, 7.4, 0.4, 3, 0.9).flatMap(([x, y]) => [S(ell(x, y - 0.4, 1, 0.5, r.range(-0.6, 0.6)), "#D9D4C7"), Ef(x, y - 0.4, 0.8, 0.12, "#A8A296", 0.8)]))];
  } },
  kuruyemis: { w: 20, d: r => {
    const nuts = scat(r, 32, 0, -8.2, 6.6, 2.8).sort((a, b) => a[1] - b[1]).flatMap(([x, y], i) => { const a = r.range(-1.2, 1.2);
      return [[S(ell(x, y, 1.15, 0.78, a), "#B07A4A"), Ef(x - 0.3, y - 0.2, 0.5, 0.2, "#D9B07A", 0.9, a)], [S(ell(x, y, 0.9, 0.85, a), "#9A5B2E"), Ef(x - 0.2, y - 0.4, 0.6, 0.3, "#C9985A", 0.9, a)], [S(ell(x, y, 1, 0.7, a), "#D5D3A0"), Ef(x, y, 0.7, 0.1, "#6E6A3A", 0.8, a)], [S(ell(x, y, 1.1, 0.6, a), "#F0DDB0"), Ef(x - 0.4, y - 0.1, 0.4, 0.2, WHITE, 0.6, a)], [S(ell(x, y, 1, 0.85, a), "#B5936A"), ...lines([[[x - 0.6, y], [x, y - 0.3], [x + 0.6, y + 0.1]]], "#7A5A3A", 0.25, 0.8)]][i % 5]; });
    return [...bowl(16, 6.5, "#8A5A35", "#8A5A35"), ...nuts];
  } },
  popcorn: { w: 15, m: translate(0, 2), d: (r, h, p) => {
    const c = hex(p.color, "#C8283A"), cup = P([[-5.6, -11, 0], [5.6, -11, 0], [4.2, 0, 0], [-4.2, 0, 0]], WHITE), puffs = scat(r, 26, 0, -12.2, 5.2, 3.2).sort((a, b) => a[1] - b[1]);
    return [...puffs.map(([x, y], i) => S(ellipse(x, y, 1.1).add(ellipse(x + 0.9, y + 0.4, 0.9)).add(ellipse(x - 0.8, y + 0.5, 0.85)).add(ellipse(x + 0.1, y - 0.7, 0.8)), i % 3 ? "#FBF1CF" : "#F6E4A8")), ...dots(puffs.filter((_, i) => i % 4 === 0).map(([x, y]) => [x + 0.4, y + 0.5] as Vec2), 0.28, 0.2, "#C98238", 0.9),
      cup, ...[-4.6, -1.6, 1.4, 4.4].map(x => F(poly([[x, -11], [x + 1.5, -11], [x * 0.75 + 1.1, 0], [x * 0.75, 0]]), c, 0.95, cup.path)), F(rect(1.4, -11, 6, 11), tone(WHITE, "shade"), 0.35, cup.path), E(0, -11, 5.6, 1.2, "#F6F1E6"), E(0, -10.9, 5, 0.8, "#EFE3BB"), ...(h ? [] : puffs.slice(0, 4).map(([x, y], i) => S(ellipse(7.4 + i * 1.8, -0.8 - (i % 2) * 0.4, 0.9).add(ellipse(8 + i * 1.8, -0.4, 0.7)), "#FBF1CF")))];
  } },
  pogaca: { w: 30, c: true, v: [[0, -10]], d: (r, h, p) => {
    const n = cnt(p.n, 4), ps = pile(n, 8, 3.4), pw = Math.max(26, Math.max(...ps.map(q => Math.abs(q[0]))) * 2 + 12), buns = ps.flatMap(([x, y]) => { const c = r.pick(["#C98238", "#D4903F", "#BE7430"]);
      return at([P([[-4.6, 0, 0], [4.6, 0, 0], [4.5, -2.4], [2.6, -4.6], [-0.4, -5.2], [-3, -4.4], [-4.4, -2.4]], c), F(ellipse(-1.2, -3.6, 2.4, 0.9), "#E8B06A", 0.7), L([[3.6, -0.6], [3.2, -2.4], [1.6, -4.2]], tone(c, "deep"), 0.35, 0.5), ...dots(scat(r, 6, 0, -3.2, 3, 1.2), 0.2, 0.14, "#2B2420", 0.9), ...dots(scat(r, 6, 0, -3.2, 3, 1.2), 0.22, 0.14, "#F7EAC0", 0.95)], x, y); });
    return plated(pw, r, buns);
  } },
  acma: { w: 26, c: true, v: [[0, -6]], d: (r, h, p) => {
    const n = cnt(p.n, 3);
    return pile(n, 11, 2.6).flatMap(([x, y]) => { const c = r.pick(["#D9A04A", "#D49A42", "#DDA856"]);
      return at([S(ellipse(0, 1.4, 6.2, 3.2), tone(c, "shade")), { path: holed(ellipse(0, 0, 6.2, 3.2), [ellipse(0, 0.2, 2.2, 1)]), fill: c, evenodd: true }, F(ellipse(0, 0.2, 2.2, 1), tone(c, "deep"), 0.8), Ef(-2.4, -1.6, 2.4, 0.5, "#F2D08A", 0.7, -0.15), ...lines([[[-5, 0.4], [-3.6, -1.8], [-1.6, -2.6]], [[2.4, -2.4], [4.2, -1.4], [4.8, 0.2]], [[-4.4, 1.4], [-2.6, 2.4], [0, 2.7]]], tone(c, "deep"), 0.35, 0.6)], x + r.range(-0.4, 0.4), y - 3); });
  } },
  katmer: { w: 30, v: [[0, -8]], d: r => plated(28, r, [
    ...box(-1, 1.2, 14.4, 2.8, 8, "#D9A04A", "#E2AE5A"), ...scat(r, 9, 6.2, -3.1, 7, 1.4).map(([x, y]) => Ef(x, y, r.range(1, 2), r.range(0.3, 0.6), r.pick(["#EFC878", "#B8802E"]), 0.65, r.range(-0.4, 0.4))), ...dots(scat(r, 24, 6.2, -3.1, 7, 1.4), 0.35, 0.22, "#6E9A36", 0.95), ...dots(scat(r, 20, 6.2, -3.1, 7.4, 1.5), 0.2, 0.14, WHITE, 0.9),
    ...lines([[[-8, 0.5], [-7.6, -1.4]], [[-3, 0.6], [-2.8, -1.5]]], "#B8802E", 0.3, 0.6), ...box(10.4, 4, 6.4, 2.6, 4, "#F0D9A0", "#E2AE5A"), F(rect(7.2, 1.8, 6.4, 0.7), "#8DB04A", 0.95), F(rect(7.2, 2.5, 6.4, 0.6), "#F6EBD2", 0.95), F(rect(7.2, 3.1, 6.4, 0.5), "#8DB04A", 0.95), ...dots(scat(r, 7, 12.6, -0.4, 3, 0.6), 0.35, 0.22, "#6E9A36")]) },
  catal: { w: 24, c: true, d: (r, h, p) => {
    const n = cnt(p.n, 5);
    return pile(n, 9, 2.4).flatMap(([x, y]) => { const c = r.pick(["#D9A04A", "#CE9440", "#DDAA58"]), a = r.range(-0.12, 0.12);
      return at([E(0, 1, 4.6, 2.3, tone(c, "shade")), E(0, 0, 4.6, 2.3, c), ...lines([-2.4, -1.2, 0, 1.2, 2.4].map(k => [[k - 1.2, -1.5 + Math.abs(k) * 0.12], [k - 0.9, 1.5 - Math.abs(k) * 0.12]] as Vec2[]), tone(c, "deep"), 0.5, 0.7), ...lines([[[-3.8, 0.6], [3.6, -0.6]]], tone(c, "deep"), 0.35, 0.5), Ef(-2.2, -1.1, 1.6, 0.3, "#F2D08A", 0.7, -0.2)].map(s => ({ ...s, path: s.path.transform(rotate(a)) })), x, y - 2.4); });
  } },
  kumru: { w: 28, v: [[0, -13]], m: translate(0, -3), d: (r, h) => sub(26, 7, "#D9A04A", (x0, x1, y) => [heap(x0 + 1, x1 - 1, y, 3, "#E8C47A"), ...[-8, -3.6, 0.8, 5.2].map((x, i) => E(x + r.range(-0.4, 0.4), y - 2.2 + (i % 2) * 0.5, 1.9, 1.1, "#8A2E24")), ...dots(scat(r, 10, 0, y - 2, 9, 1), 0.3, 0.2, "#E8C8B8", 0.9), P([[x0 + 2, y - 2.6, 0], [x1 - 2, y - 2.6, 0], [x1 - 3, y - 3.4], [x1 - 5, y - 3], [x1 - 7, y - 3.6], [x0 + 3, y - 3.2]], "#F2C230"), ...[-6, 2, 8].map(x => E(x, y - 1.4, 1.5, 0.8, "#D63A28")), ...[-1.5, 4.6].map(x => E(x, y - 1.2, 0.9, 0.8, "#7DA03A")),
    ...dots(scat(r, 22, 0, y - 7.4, 6.4, 1.2), 0.22, 0.14, "#F7EAC0", 0.95)]) },
  sandwich: { w: 20, m: translate(0, -3), d: (r, h) => {
    const bread = (y: number) => [S(rrect(-6.4, y - 1.9, 12.8, 1.9, 0.8), "#B5732A"), F(rrect(-5.8, y - 1.5, 11.6, 1.1, 0.5), "#F2DDA8"), F(rect(2.4, y - 1.9, 4, 1.9), tone("#B5732A", "shade"), 0.35)];
    const s = [...bread(0), S(rrect(-5.6, -3.2, 11.2, 1.4, 0.5), "#F0A8A0"), P([[-6, -3.2, 0], [6, -3.2, 0], [6.4, -4.2], [4.4, -4.9], [2, -4.2], [-0.4, -5], [-3.2, -4.2], [-5.6, -4.9], [-6.4, -4.2]], "#7DB84A"), S(rect(-5.8, -5.6, 11.6, 1.2), "#F2C230"), ...[-3.6, 0, 3.6].map(x => E(x, -6.5, 1.8, 0.7, "#D63A28")), ...bread(-6.4), R([[1.8, -8.4], [2.2, -13]], "#D9B87A", 0.35), E(2.2, -13.4, 0.9, 0.9, "#2B2420"), E(2.2, -13.4, 0.35, 0.35, "#C23B2A")];
    return h ? s : plated(20, r, s);
  } },
  kestane: { w: 14, m: translate(0, 3), v: [[0, -15]], d: (r, h) => {
    const cone = P([[-5.4, -10, 0], [5.4, -10, 0], [0.8, -0.3], [0, 0, 0], [-0.8, -0.3]], "#C79A63");
    return [cone, F(rect(1, -10, 6, 11), tone("#C79A63", "shade"), 0.55, cone.path), ...lines([[[-4.8, -9.6], [-0.4, -1]]], tone("#C79A63", "deep"), 0.3, 0.7, cone.path), ...scat(r, 9, 0, -11.4, 4.2, 2.2).sort((a, b) => a[1] - b[1]).flatMap(([x, y], i) => [E(x, y, 1.9, 1.7, "#6E3A1E"), Ef(x - 0.6, y - 0.6, 0.8, 0.5, "#A8643A", 0.9), ...(i % 3 === 0 ? [Ef(x + 0.3, y + 0.5, 1, 0.3, "#E8D08A", 1, 0.2)] : [])]),
      ...(h ? [] : [E(7.4, -1.2, 1.9, 1.7, "#6E3A1E"), Ef(6.8, -1.8, 0.8, 0.5, "#A8643A", 0.9), E(10, -0.9, 1.9, 1.7, "#E8D08A"), Ef(10, -1.2, 1.3, 1, "#F2E4B0", 0.9)])];
  } },
  misir: { w: 28, hv: true, m: mul(translate(2.3, -6), rotate(-PI / 2)), d: (r, h) => {
    const cob = rrect(-8, -4.6, 18, 4.6, 2.3), ks: Vec2[] = Array.from({ length: 6 * 14 }, (_, i) => [-7.4 + (i % 14) * 1.25, -4.2 + Math.floor(i / 14) * 0.72] as Vec2), cob2 = [R([[-12, -2.4], [-8, -2.4]], "#B0A070", 2.2), P([[-9, -2.4, 0], [-3, -6.6], [3, -6.2, 0], [0, -2.4], [-3, -0.2]], "#7DA03A"), P([[-9, -2.4, 0], [-3, 2], [3, 1.8, 0], [0, -2.4], [-4, -4.6]], "#5E8A32"), ...lines([[[-8, -2.8], [-2, -5.2]], [[-8, -2.2], [-3, 0.8]]], "#B4D070", 0.3, 0.7)];
    const sh = [...cob2, S(cob, "#F2C230"), ...many(ks, (x, y) => rrect(x, y, 1, 0.6, 0.25), "#F7D45A", { flat: true, opacity: 0.9 }), ...dots(scat(r, 14, 3, -2.3, 5.4, 1.8), 0.4, 0.3, "#6E3A1E", 0.8), Ef(0, -3.8, 8, 0.4, WHITE, 0.45), ...dots(scat(r, 10, 2, -2.4, 6, 1.8), 0.14, 0.1, WHITE, 0.9)];
    return h ? sh : plated(26, r, sh);
  } },
  // <snack>
};

const snack: PieceDef = { draw: (p, r, kit) => drawKind("snack", SNACK, p, r, kit, 9), variants: variants(SNACK),
  meta: {
    about: "A snack: a crisp packet, sunflower seeds in a paper cone, mixed nuts in a bowl, popcorn in a striped carton, pogaca buns, acma rings, katmer, crunchy catal pastries, a kumru or a sandwich; then roasted chestnuts (kestane) and a corn on the cob (misir).",
    params: {
      kind: { type: "enum", values: Object.keys(SNACK), default: "cips" },
      n: { type: "int", min: 1, max: 24, about: "how many side by side; for pogaca, acma and catal the pieces in the heap (default: a few)" },
      color: { type: "color", about: "cips: the packet; popcorn: the carton's stripes; default red" },
      label: { type: "text", about: "cips: the word on the packet (default CİPS)" },
      hot: { type: "bool", default: false, about: "pogaca, acma, katmer, kumru, kestane, misir: steam rises, fresh from the oven or the coals" },
    },
    terms: ["a1-w-cips", "a2-w-cekirdek", "a2-w-kuruyemis", "a2-w-patlamis-misir", "a2-w-pogaca", "a2-w-acma", "a2-w-katmer", "a2-w-catal-yiyecek", "a2-w-kumru", "a2-w-kestane", "a2-w-misir"],
    tags: ["food", "snack"],
  } };

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { dish, sweet, snack };
