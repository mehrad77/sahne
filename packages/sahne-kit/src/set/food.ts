// Props of the food family, following STYLE.md: food and shop goods, tea and its
// things, plates, a cake and its candles, cutlery, a jar, a cat's bowl. Units cm; each flat's origin is
// its bottom centre. Held (`held`), the origin is the grip and the fist covers about 8 cm above it: a
// thing that sits on the hand is lifted clear of it, a thing that hangs (a tray by its ring, a fish by
// its tail, a market bag by its handles) hangs below it. Words (a jar's label, a price) are `text`.

import { ellipse, rect, rrect, smooth, poly, tone, mix, mul, rotate, rotateAbout, translate, apply, groupBounds, type Affine, type EmitSpec, type FlatSpec, type Path, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, type Pt } from "./draw.ts";

const W = "#FBF7EE", WHITE = "#FFFFFF", GLASS = "#E2EEF0", TEA = "#A8361B", STEEL = "#C3C8CE", GOLD = "#D4AF4A", BLACK = "#26272C", CRUST = "#B5652A", INK = "#2B2420", LEAF = "#4E8A3A";
const PI = Math.PI, ID: Affine = [1, 0, 0, 1, 0, 0], LIFT = translate(0, -7.5);
type Prm = Record<string, unknown>;

// ---- Helpers --------------------------------------------------------------------------------

/** Shapes moved by an affine, their clips (and a tile's origin) with them. */
const mv = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({
  ...s, path: s.path.transform(m),
  ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}),
  ...(s.tile ? { tile: { ...s.tile, x: (s.tile.x ?? 0) + m[4], y: (s.tile.y ?? 0) + m[5] } } : {}),
}));
const at = (sh: Shape[], x: number, y = 0) => mv(sh, translate(x, y));
/** `n` places `step` apart, centred on 0. */
const xs = (n: number, step: number) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
/** The count `p.n` (default `d`), `lo` … `hi`. */
const cnt = (p: Prm, d: number, hi = 40, lo = 1) => Math.max(lo, Math.min(hi, Math.round(num(p.n, d))));
/** A closed outline, symmetric about x = 0, from its right side given bottom to top. */
const sym = (pts: Pt[]) => smooth([...pts, ...pts.slice().reverse().map(q => (q.length === 3 ? [-q[0], q[1], 0] : [-q[0], q[1]]) as Pt)], true, 1);
const clipsOf = (s: Shape) => s.clip ? (Array.isArray(s.clip) ? s.clip : [s.clip]) : [];
/** A flat copy of a shape inside the strip `x0` … `x0 + w` (a highlight down the left, a shade down the right). */
const strip = (s: Shape, x0: number, w: number, c: string, op: number): Shape => ({ path: s.path, fill: c, flat: true, opacity: op, clip: [...clipsOf(s), rect(x0, -500, w, 1000)] });
/** The usual light on a shape spanning `x0` … `x1`: a highlight on the left, a shade on the right. */
const lit = (s: Shape, x0: number, x1: number, k = 1): Shape[] => { const w = x1 - x0; return [strip(s, x0 + w * 0.1, w * 0.12, WHITE, 0.4 * k), strip(s, x0 + w * 0.68, w, tone(s.fill!, "shade"), 0.5 * k)]; };
/** One shape made of many small paths (specks, cubes, grains). */
const many = (pts: Vec2[], f: (x: number, y: number) => Path, c: string, o: Partial<Shape> = {}): Shape[] => {
  if (!pts.length) return [];
  const path = f(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) path.add(f(x, y));
  return [{ path, fill: c, ...o }];
};
const specks = (pts: Vec2[], rx: number, ry: number, c: string, op = 1) => many(pts, (x, y) => ellipse(x, y, rx, ry), c, { flat: true, opacity: op });
/** Printed strokes (stripes, seams, grain) as one flat shape. */
const lines = (segs: Vec2[][], c: string, w: number, op = 0.7, clip?: Path): Shape[] => {
  if (!segs.length) return [];
  const path = poly(segs[0], false);
  for (const s of segs.slice(1)) path.add(poly(s, false));
  return [{ path, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }];
};
/** A rod (a handle, an arm of a tray) along a smooth line. */
const rod = (pts: Vec2[], c: string, w: number): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w, cap: "round" } });
/** Random points under a mound of half width `a` and height `h` over (0, 0). */
const mound = (r: Rng, k: number, a: number, h: number, lo = 0.3): Vec2[] => Array.from({ length: k }, () => { const x = r.range(-a * 0.85, a * 0.85); return [x, -r.range(lo, Math.max(lo, h * (1 - (x / a) ** 2) - 0.4))] as Vec2; });

/** A prop's one flat: its `ppcm` lowered for a long row so it fits an atlas layer; lying, it casts a drop shadow. */
function out(id: string, shapes: Shape[], ppcm: number, p: Prm, edge = 0.3, o: Partial<FlatSpec> = {}, emitters: EmitSpec[] = []): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  const f: FlatSpec = { group: { shapes, edge }, ppcm: Math.min(ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(p.held ? {} : { shadow: "drop" as const }), ...o };
  return emitters.length ? { flats: [f], emitters } : { flats: [f] };
}
/** Steam rising from (x, y) of the art, moved as the art is by `m`. */
const steam = (m: Affine, x: number, y: number, w: number): EmitSpec => { const [a, b] = apply(m, x, y); return { kind: "steam", x: a, y: -b, w }; };
/** A text box in the art, moved as the art is by `m`. */
const word = (m: Affine, t: TextSpec): TextSpec => { const [x, y] = apply(m, t.x, t.y); return { ...t, x, y }; };

// ---- Tea ------------------------------------------------------------------------------------

/** The ince belli glass's right side, foot to rim. */
const GL: Vec2[] = [[2.2, 0], [2.6, -0.5], [2.95, -2.4], [2.5, -4.4], [2.05, -5.7], [2.3, -7.1], [2.95, -9], [3.35, -10.6]];
/** Its outline, `k` in from the glass (the inside, above a thick foot). */
const glassPath = (k: number) => sym([[(k ? 2.4 : 2.2) - k, k ? -0.9 : 0, 0], ...GL.slice(k ? 2 : 1, -1).map(([x, y]) => [x - k, y] as Pt), [3.35 - k, -10.6, 0]]);
/** The glass's half width at height y. */
const gw = (y: number) => { for (let i = 1; i < GL.length; i++) if (y >= GL[i][1]) { const [a, b] = GL[i - 1], [c, d] = GL[i]; return a + (c - a) * (y - b) / (d - b); } return 3.35; };

/** An ince belli tea glass, 10.6 cm, its foot at the origin: `fill` (0…1) of tea, a teaspoon standing in it. */
function glass(fill: number, spoon: boolean): Shape[] {
  const lvl = -0.9 - Math.max(0, Math.min(1, fill)) * 8.9, tea = S(glassPath(0.4), TEA, { flat: true, opacity: 0.94, clip: rect(-5, lvl, 10, 12) });
  const handle = (o: Partial<Shape>): Shape => ({ path: smooth([[0.6, -1.6], [4, -14.4]], false), stroke: { color: "#A9AFB5", width: 0.42, cap: "round" }, flat: true, ...o });
  const sh: Shape[] = [S(glassPath(0), GLASS, { opacity: 0.55 })];
  if (spoon) sh.push(handle({ opacity: 0.5 }));
  if (fill > 0) sh.push(tea, strip(tea, 0.9, 5, tone(TEA, "deep"), 0.5), strip(tea, -3, 0.9, "#E58A4A", 0.45), S(ellipse(0, lvl, gw(lvl) - 0.4, 0.3), "#C4562A", { flat: true }));
  if (spoon) sh.push(handle({ clip: rect(-5, -20, 12, 9.4) }), S(ellipse(4.05, -14.6, 0.42, 0.62), STEEL));
  sh.push(L([[-2.45, -8.7], [-1.95, -6.9]], WHITE, 0.45, 0.85), L([[-2.55, -3.5], [-2.25, -1.4]], WHITE, 0.4, 0.7),
    { path: ellipse(0, -10.6, 3.35, 0.4), stroke: { color: WHITE, width: 0.22 }, flat: true, opacity: 0.85 }, S(ellipse(0, -0.45, 2.2, 0.38), WHITE, { flat: true, opacity: 0.4 }));
  return sh;
}

/** A tea saucer 11.6 cm across: red with a white rim and dots, or white with red; by chance a sugar cube or two on it. */
function saucer(r: Rng): Shape[] {
  const red = r.chance(0.7), c = red ? "#B8322A" : W, b = red ? W : "#B8322A";
  const s = P([[-5.8, -1.3, 0], [5.8, -1.3, 0], [4.4, -0.45], [2.6, 0, 0], [-2.6, 0, 0], [-4.4, -0.45]], c);
  const sh = [s, strip(s, 2.2, 5, tone(c, "shade"), 0.45), ...lines([[[-5.6, -1.18], [5.6, -1.18]]], b, 0.28, 0.95), ...specks(xs(7, 1.15).map(x => [x, -0.72]), 0.2, 0.17, b, 0.9)];
  if (r.chance(0.35)) sh.push(S(rrect(3.2, -2.45, 1.1, 1.1, 0.2), W), ...(r.chance(0.5) ? [S(rrect(-4.5, -2.4, 1.05, 1.05, 0.2), W)] : []));
  return sh;
}
const teaGlass = (r: Rng, fill: number, spoon: boolean) => [...saucer(r), ...at(glass(fill, spoon), 0, -1.25)];

/** A çaycı's hanging tray (askılı tepsi), `n` glasses on it, standing on y = 0: its shapes, its ring's height and where the glasses stand. */
function tray(r: Rng, n: number, fill: number): [Shape[], number, Vec2[]] {
  const c = r.chance(0.3) ? "#C9A24A" : STEEL, rows = n > 3 ? 2 : 1, front = Math.ceil(n / rows), back = n - front;
  const even = back > 0 && back === front, R = Math.max(16, front * 6 + (even ? 6 : 3)), ry = R * 0.2, yc = -1.8 - ry, ring = -(24 + R * 0.4), arm = tone(c, "shade");
  const sh: Shape[] = [rod([[0, yc - ry + 0.4], [0, ring + 1.8]], arm, 0.8), S(ellipse(0, yc + 1.6, R - 0.8, ry), arm), S(ellipse(0, yc, R, ry), c), S(ellipse(0, yc - 0.15, R - 1.5, ry - 0.55), tone(c, "light"), { flat: true, opacity: 0.6 })];
  const spots: Vec2[] = [];
  for (const [k, y, dx] of [[back, yc - ry * 0.35, even ? -2.95 : 0], [front, yc + ry * 0.38, even ? 2.95 : 0]]) for (const x of xs(k, 11.8)) { sh.push(...at(teaGlass(r, fill, false), x + dx, y)); spots.push([x + dx, y]); }
  sh.push(S(ellipse(0, yc, R, ry).add(ellipse(0, yc - 0.15, R - 1.5, ry - 0.55)), c, { evenodd: true, clip: rect(-R - 1, yc, 2 * R + 2, ry + 2) }),
    L([[-R * 0.8, yc + ry * 0.5], [-R * 0.3, yc + ry * 0.92]], WHITE, 0.35, 0.6));
  for (const s of [-1, 1]) sh.push(rod([[s * R * 0.84, yc + ry * 0.55], [s * R * 0.92, yc - 9], [s * R * 0.5, ring + 7], [s * 1.1, ring + 1.9]], c, 0.95));
  sh.push({ path: ellipse(0, ring, 2.1, 2.1), stroke: { color: c, width: 0.9 } }, S(ellipse(0, ring + 2.2, 0.95, 0.75), c));
  return [sh, ring, spots];
}

const ENAMEL = ["#B3261E", "#2E5C9E", "#3E7A5A", "#F2E4C4", "#E0A83A"];
/** A decal flower (enamel ware): five petals round a yellow heart. */
const flower = (x: number, y: number, s: number, c: string) => [...specks([0, 1, 2, 3, 4].map(k => [x + Math.cos(k * 1.2566) * s, y + Math.sin(k * 1.2566) * s] as Vec2), s * 0.75, s * 0.75, c), ...specks([[x, y]], s * 0.5, s * 0.5, "#E0A83A")];

/** The çaydanlık: the big kettle with the small teapot in its mouth, black side handles; steel, or enamel in `color` with flowers. */
function caydanlik(r: Rng, p: Prm, color: (id: string) => string): Shape[] {
  const enamel = str(p.finish, r.chance(0.3) ? "enamel" : "steel") === "enamel";
  const c = enamel ? (typeof p.color === "string" ? color(p.color) : r.pick(ENAMEL)) : STEEL, dark = enamel ? "#232838" : tone(STEEL, "deep");
  const pot = S(sym([[12, 0, 0], [13.2, -4.5], [12.6, -10.5], [9.6, -15.6], [8, -16.8, 0]]), c), top = S(sym([[7, -16.2, 0], [8.7, -21], [8.1, -26], [5.6, -29, 0]]), c);
  const spout = P([[11.5, -4.5], [16.5, -8.5], [20, -15.5], [22.6, -19.2, 0], [20.4, -19.8, 0], [17.4, -14.2], [12, -10.8]], c), spout2 = P([[7.8, -19.8], [11, -22.8], [13.4, -27.6], [14.9, -29.8, 0], [13.4, -30.5, 0], [11.4, -26.8], [8.2, -24.4]], c);
  const sh: Shape[] = [
    spout, strip(spout, 17, 8, tone(c, "shade"), 0.4), rod([[-12.4, -14], [-17.6, -13.4], [-18.4, -8.5], [-13, -4.8]], BLACK, 2.2),
    pot, ...lit(pot, -13.2, 13.2), S(rect(-14, -1.4, 28, 1.4), dark, { flat: true, clip: pot.path }), S(ellipse(0, -16.7, 8.2, 0.9), dark),
    spout2, rod([[-8.2, -27], [-12.2, -26.4], [-12.8, -21.6], [-8.6, -19.6]], BLACK, 1.7), top, ...lit(top, -8.7, 8.7),
    P([[-5.9, -28.8, 0], [5.9, -28.8, 0], [4.6, -30.5], [0, -31.3], [-4.6, -30.5]], enamel ? c : tone(STEEL, "light")), S(ellipse(0, -31.9, 1.5, 1), BLACK),
    L([[-8, -16.5], [0, -15.8], [8, -16.5]], dark, 0.8, 1), L([[-5.8, -28.9], [5.8, -28.9]], dark, 0.5, 0.8),
  ];
  if (enamel) {
    const petal = c === ENAMEL[3] ? "#B3261E" : W;
    sh.push(...specks([[22.4, -19.6], [14.8, -30.2]], 0.9, 0.5, dark), ...specks([[-4.6, -6.6], [-1.4, -9.4], [4.6, -7.4], [-2.6, -22.4]], 1.1, 0.5, "#5E8C4A", 0.9),
      ...flower(-2.6, -7.6, 1.3, petal), ...flower(3, -6.2, 1, petal), ...flower(0.8, -22.8, 0.9, petal));
  } else sh.push(...lines([[[-12.8, -4.8], [12.8, -4.8]], [[-8.6, -20.8], [8.6, -20.8]]], tone(STEEL, "shade"), 0.35, 0.6), L([[-10.6, -13], [-7.6, -15.6]], WHITE, 0.5, 0.6));
  return sh;
}

const CAPS = ["#B3261E", "#2E5C9E", "#3E7A5A", BLACK, "#E0A83A"];
/** A tall steel tea thermos with a cup for a cap and a grip band in the cap's colour. */
function thermos(r: Rng): Shape[] {
  const cap = r.pick(CAPS), body = S(rrect(-4.6, -26, 9.2, 26, [2.6, 2.6, 1.4, 1.4]), STEEL), lid = P([[-3.9, -27.2, 0], [3.9, -27.2, 0], [3.8, -33.4], [3.1, -34.6, 0], [-3.1, -34.6, 0], [-3.8, -33.4]], cap);
  return [body, ...lit(body, -4.6, 4.6), S(rect(-5, -17.5, 10, 5.5), cap, { flat: true, clip: body.path }), ...lines(xs(5, 1.5).map(x => [[x, -17], [x, -12.5]]), tone(cap, "deep"), 0.3, 0.5),
    S(rrect(-3.5, -28, 7, 2.2, 0.6), "#5B6168"), lid, ...lit(lid, -3.9, 3.9), ...lines(xs(6, 1.15).map(x => [[x, -33.2], [x, -28.6]]), tone(cap, "shade"), 0.3, 0.6),
    S(rrect(-4.3, -1.3, 8.6, 1.3, 0.6), tone(STEEL, "deep"), { flat: true }), L([[-3.2, -24.6], [-3.2, -19]], WHITE, 0.5, 0.6)];
}

/**
 * Tea, `kind`: a `glass` (an ince belli glass on its red-and-white saucer, a teaspoon in it unless
 * `spoon: false`; `n` side by side, in two rows past six; `fill` 0…1 of tea, default 0.85), a `tray` (a
 * çaycı's hanging tray, steel or brass, with `n` glasses on it, default 4; held, it hangs from its ring
 * in the fist), the `caydanlik` (the double teapot, steel or enamel by seed or `finish`, `color` for the
 * enamel; held by the kettle's handle) or a `thermos` (`n`). `hot` sends steam up from each glass, or the
 * teapot's spout and lid. Held, glasses sit on the hand.
 */
const tea: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "glass"), fill = num(p.fill, 0.85), sh: Shape[] = [], vents: [number, number, number][] = [];
  let m = ID, ppcm = 5, edge = 0.35;
  if (kind === "tray") {
    const [t, ring, spots] = tray(r, cnt(p, 4, 12, 0), fill);
    sh.push(...t); m = p.held ? translate(0, -4 - ring) : ID;
    for (const [x, y] of spots) vents.push([x, y - 13, 2]);
  } else if (kind === "caydanlik") {
    for (const x of xs(cnt(p, 1, 4), 46)) { sh.push(...at(caydanlik(r, p, id => kit.color(id)), x)); vents.push([x + 22, -20.5, 3], [x, -33, 3.5]); }
    m = p.held ? translate(18, 5) : ID;
  } else if (kind === "thermos") {
    for (const x of xs(cnt(p, 1, 6), 11)) sh.push(...at(thermos(r), x));
    m = p.held ? translate(0, 9) : ID;
  } else {
    const n = cnt(p, 1, 24), spoon = p.spoon !== false;
    ppcm = 8; edge = 0.25;
    const put = (k: number, step: number, y: number, dx = 0) => xs(k, step).forEach(x => { sh.push(...at(teaGlass(r, fill, spoon), x + dx, y)); vents.push([x + dx, y - 12.5, 2]); });
    if (p.held) for (const x of xs(Math.min(n, 3), 8)) { sh.push(...at(glass(fill, spoon), x, 5)); vents.push([x, -6.5, 2]); } // the fingers close on the glass's waist, no saucer
    else if (n > 6) { const b = Math.floor(n / 2); put(b, 12.6, -2.8, b === n - b ? 6.3 : 0); put(n - b, 12.6, 0); }
    else put(n, 12.6, 0);
  }
  return out("tea", mv(sh, m), ppcm, p, edge, {}, p.hot ? vents.map(([x, y, w]) => steam(m, x, y, w)) : []);
}, variants: { glass: { kind: "glass" }, tray: { kind: "tray" }, caydanlik: { kind: "caydanlik", hot: true }, thermos: { kind: "thermos" } },
  meta: {
    about: "Tea: ince belli glasses on saucers, a çaycı's hanging tray of them, the double çaydanlık or a steel thermos.",
    params: {
      kind: { type: "enum", values: ["glass", "tray", "caydanlik", "thermos"], default: "glass" },
      n: { type: "int", min: 0, max: 24, about: "how many: glasses (1…24, default 1), on a tray (0…12, default 4), teapots (≤ 4), thermoses (≤ 6)" },
      fill: { type: "num", min: 0, max: 1, default: 0.85, about: "how full of tea the glasses are" },
      spoon: { type: "bool", default: true, about: "a teaspoon in each glass (not on a tray)" },
      hot: { type: "bool", default: false, about: "steam rises from the glasses or the teapot" },
      finish: { type: "enum", values: ["steel", "enamel"], about: "the çaydanlık's; default seeded" },
      color: { type: "color", about: "the enamel çaydanlık's colour; default seeded" },
    },
    terms: ["a1-w-cay", "a1-w-bardak", "a1-w-caydanlik"],
    tags: ["food", "drink"],
  } };

// ---- Plates, cake, candles ------------------------------------------------------------------

/** Food on a plate, standing on (0, 0). */
const DISH: Record<string, (r: Rng) => Shape[]> = {
  rice: r => {
    const c = "#F2EAD3", m = P([[-8.4, 0, 0], [8.4, 0, 0], [7.4, -2.8], [4.4, -6], [0, -7.2], [-4.4, -6], [-7.4, -2.8]], c);
    return [m, { path: m.path, fill: tone(c, "shade"), flat: true, opacity: 0.45, clip: ellipse(7, 0.5, 9, 8.4) }, ...specks(mound(r, 52, 8.4, 7.2), 0.42, 0.2, WHITE, 0.9), ...specks(mound(r, 22, 8.4, 7.2), 0.4, 0.18, "#D9C99E", 0.8),
      ...lines(mound(r, 12, 8.4, 6.8).map(([x, y]) => [[x - 0.5, y + 0.15], [x + 0.5, y - 0.15]]), "#B07A3A", 0.35, 0.85), ...specks([[-0.9, -7], [0.3, -7.4], [1.2, -6.9]], 0.6, 0.42, LEAF)];
  },
  chicken: r => {
    const c = "#C98238", body = P([[-8.6, 0, 0], [8.2, 0, 0], [9.3, -2.8], [7.6, -6.6], [2, -8.6], [-4.6, -8.3], [-8.9, -5.5], [-9.7, -2.4]], c);
    const leg = (dx: number, k: string): Shape[] => [P([[2.6 + dx, -3], [7.4 + dx, -5.6], [9.6 + dx, -8.2], [8.6 + dx, -9.9], [6.4 + dx, -9], [2.4 + dx, -6]], k), S(rrect(-0.55, -2.3, 1.1, 2.5, 0.5).transform(mul(translate(9.4 + dx, -9.5), rotate(0.7))), W)];
    return [...specks([[-10.6, -0.9], [10.4, -0.9], [-7.6, 0.2], [7, 0.3]], 1.7, 1.15, "#E0B050"), ...specks([[-11.2, -1.8], [11.4, -2.1]], 0.8, 0.5, LEAF),
      ...leg(-1.6, "#A9652A"), body, S(ellipse(-2, -5.6, 4.6, 2.1), "#E2A458", { flat: true, opacity: 0.75 }), strip(body, 3.4, 9, tone(c, "deep"), 0.35),
      P([[-8.8, -4.2], [-6, -5.6], [-4.6, -3.4], [-7.6, -2.2]], "#B9702E"), ...specks(mound(r, 7, 8, 7, 1.5), 0.5, 0.32, "#8E4E1E", 0.5), ...leg(0, "#BB7232"),
      L([[-5.6, -6.8], [-2, -7.6], [1.6, -7.6]], WHITE, 0.4, 0.5)];
  },
  salad: r => {
    const base = P([[-8.6, 0, 0], [8.6, 0, 0], [6.2, -2.6], [2, -4.1], [-2.6, -4], [-6.6, -2.4]], "#B9473A"), sh: Shape[] = [base];
    for (const [x, y] of mound(r, 12, 8.6, 4.4)) sh.push(S(rrect(x - 0.7, y - 0.6, 1.4, 1.2, 0.3), r.pick(["#D8402E", "#E2553A", "#C9352A"])));
    for (const [x, y] of mound(r, 8, 8.6, 4.2)) sh.push(S(ellipse(x, y, 0.95, 0.7), "#4E8A3A"), S(ellipse(x, y, 0.65, 0.45), "#D6E6A8", { flat: true }));
    return [...sh, ...lines(mound(r, 5, 8.6, 4).map(([x, y]) => [[x - 0.8, y], [x, y - 0.5], [x + 0.8, y]]), "#E9DCEB", 0.35, 0.95), ...many(mound(r, 4, 8.6, 4), (x, y) => rrect(x - 0.5, y - 0.4, 1.1, 0.8, 0.2), "#8DBA4A"),
      ...specks(mound(r, 18, 8.6, 4.4), 0.28, 0.22, "#3F7A32"), P([[8.2, -0.2, 0], [11.4, -0.4, 0], [10.6, -2.2], [9, -2.4]], "#F2D06B")];
  },
  biscuits: r => {
    // round kurabiye leaning in a heap, faces to the viewer: a jam heart, sugar, an almond or chocolate stripes
    const sh: Shape[] = [];
    for (let k = 0; k < 3; k++) for (const x0 of xs(4 - k, 4.6)) {
      const x = x0 + r.range(-0.3, 0.3), y = -1.9 - k * 2.9 + r.range(-0.2, 0.2), c = r.pick(["#E6BC78", "#E9C88E", "#D9A660"]), d = r.int(0, 3), f = S(ellipse(x, y, 2.5, 2.1), c);
      sh.push(S(ellipse(x + 0.35, y + 0.35, 2.5, 2.1), tone(c, "shade")), f, strip(f, x + 1.2, 2, tone(c, "shade"), 0.3));
      if (d === 0) sh.push(S(ellipse(x, y, 0.85, 0.75), "#B8322A"), S(ellipse(x - 0.25, y - 0.25, 0.25, 0.2), WHITE, { flat: true, opacity: 0.6 }));
      else if (d === 1) sh.push(...specks(Array.from({ length: 9 }, () => [x + r.range(-1.6, 1.6), y + r.range(-1.3, 1.3)] as Vec2), 0.2, 0.16, WHITE, 0.95));
      else if (d === 2) sh.push(S(ellipse(x, y, 1, 0.55), "#F3E3C3"));
      else sh.push(...lines([-1, 0, 1].map(u => [[x - 1.7, y + u * 0.7 + 0.4], [x + 1.7, y + u * 0.7 - 0.4]] as Vec2[]), "#5A3422", 0.3, 0.85));
    }
    return sh;
  },
};
const RIMS = ["#2E5C9E", "#C9A24A", "#B8322A", "#3E7A5A"];
/** A plate `w` across seen from a little above, on y = 0, with its rim line in `rim` and `kind` of food on it. */
function plate(r: Rng, w: number, kind: string, rim: string): Shape[] {
  const ry = w * 0.16, yc = -1 - ry;
  return [P([[-w * 0.26, 0, 0], [w * 0.26, 0, 0], [w * 0.32, -1.2, 0], [-w * 0.32, -1.2, 0]], tone(W, "shade")), S(ellipse(0, yc + 0.6, w / 2 - 0.3, ry), tone(W, "shade")), S(ellipse(0, yc, w / 2, ry), W),
    S(ellipse(0, yc + 0.15, w * 0.33, ry * 0.6), tone(W, "shade"), { flat: true, opacity: 0.35 }), { path: ellipse(0, yc, w * 0.45, ry * 0.86), stroke: { color: rim, width: 0.35 }, flat: true, opacity: 0.85 },
    ...at(DISH[kind]?.(r) ?? [], 0, yc + ry * 0.25)];
}

/**
 * Plates seen from a little above, `n` side by side, with `kind` of food on them: `empty` (default),
 * `biscuits` (Maria Teyze's homemade kurabiye in a heap), `chicken` (a roast chicken with potatoes),
 * `rice` (pilav with şehriye) or `salad` (çoban salatası). Held, they are stacked on the hand, the food on the top one.
 */
const plateP: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "empty"), n = cnt(p, 1, 12), w = kind === "biscuits" ? 22 : 25, rim = r.pick(RIMS), sh: Shape[] = [];
  if (p.held) for (let i = 0; i < n; i++) sh.push(...at(plate(r, w, i === n - 1 ? kind : "empty", rim), 0, -i * 0.9));
  else for (const x of xs(n, w + 3)) sh.push(...at(plate(r, w, kind, rim), x));
  return out("plate", p.held ? mv(sh, LIFT) : sh, 5, p, 0.35);
}, variants: { biscuits: { kind: "biscuits" }, chicken: { kind: "chicken" }, rice: { kind: "rice" }, salad: { kind: "salad" } },
  meta: {
    about: "Plates seen from a little above, empty or with food on them: biscuits, a roast chicken, pilav or çoban salatası.",
    params: {
      kind: { type: "enum", values: ["empty", "biscuits", "chicken", "rice", "salad"], default: "empty", about: "the food on them" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "how many side by side (held: stacked)" },
    },
    terms: ["a1-w-tabak", "a2-w-kurabiye", "a1-w-tavuk", "a1-w-pilav", "a1-w-salata"],
    tags: ["food"],
  } };

const CANDLES = ["#F2A7B4", "#8DB8DA", "#F2D06B", "#9CD3C0", "#B9A6DC", W];
/**
 * Flames of fire on their wicks (at `pts`, art cm): the stage's flame particles, flickering and lighting
 * themselves. Up to 16; more, or a candle in a hand, keep the flame drawn in the art (`candle` without `flames`).
 */
const fires = (pts: Vec2[]): EmitSpec[] => pts.map(([x, y]) => ({ kind: "flame", x, y: -y, z: 0.5, w: 1.2 }));

/** A birthday candle 6.5 cm tall standing at (x, y) in a little holder: a flame (its glow into `glow`) when lit, a curl of smoke when just blown out. With `flames`, the wick's top goes there and the stage burns it (`fires`). */
function candle(x: number, y: number, c: string, flame: boolean, glow: Shape[], flames?: Vec2[]): Shape[] {
  const stick = rrect(x - 0.38, y - 6.5, 0.76, 6.5, 0.2);
  const sh: Shape[] = [S(stick, c), ...lines([0, 1, 2, 3, 4].map(k => [[x - 0.5, y - 0.6 - k * 1.3], [x + 0.5, y - 1.3 - k * 1.3]]), c === W ? "#E58FA0" : W, 0.32, 0.9, stick),
    S(ellipse(x, y - 0.15, 0.95, 0.38), "#F2B705"), ...lines([[[x, y - 6.5], [x, y - 7.2]]], INK, 0.16, 1)];
  if (!flame) return [...sh, L([[x, y - 7.3], [x + 0.5, y - 8.6], [x - 0.3, y - 10], [x + 0.35, y - 11.4]], "#9AA0A6", 0.22, 0.5)];
  if (flames) { flames.push([x, y - 6.95]); return sh; }
  glow.push(S(ellipse(x, y - 8.2, 1.1, 1.8), "#FFC864", { flat: true, opacity: 0.9 }), S(ellipse(x, y - 8, 2.4, 3), "#FF9A3C", { flat: true, opacity: 0.3 }));
  return [...sh, P([[x, y - 9.8], [x + 0.6, y - 8.2], [x + 0.45, y - 7.25], [x, y - 6.95], [x - 0.45, y - 7.25], [x - 0.6, y - 8.2]], "#FFC23C"), P([[x, y - 8.8], [x + 0.3, y - 7.8], [x, y - 7.2], [x - 0.3, y - 7.8]], "#FFF2B8", { flat: true })];
}

/** A whole round cake on its board, from a little above: strawberry (cream and strawberries) or chocolate (ganache, cream and cherries); `candles` on top. */
function cake(r: Rng, choc: boolean, candles: number, flame: boolean, glow: Shape[], flames?: Vec2[]): Shape[] {
  const R = 13, ry = 3.6, yb = -4.4, yt = yb - 10, side = choc ? "#6B3F27" : "#FBF1E1", topC = choc ? "#5A3422" : "#FFF7EA", cream = choc ? "#F6E6CF" : "#FFFDF6";
  const body = S(rect(-R, yt, 2 * R, 10).add(ellipse(0, yb, R, ry)), side);
  const sh: Shape[] = [S(ellipse(0, yb + 0.7, R + 2.6, ry + 0.8), "#B9BEC4"), S(ellipse(0, yb, R + 2.6, ry + 0.8), "#E3E6E9"), body, ...lit(body, -R, R, 0.8), S(ellipse(0, yt, R, ry), topC)];
  if (choc) sh.push(S(ellipse(-3, yt - 0.6, 6, 1.2), WHITE, { flat: true, opacity: 0.18 }));
  else sh.push(...lines(xs(9, 2.7).map(x => [[x, yt + ry * Math.sqrt(1 - (x / R) ** 2)], [x + 0.5, yt + ry * Math.sqrt(1 - (x / R) ** 2) + 2.4]]), "#E58FA0", 0.5, 0.75));
  sh.push(...many(Array.from({ length: 13 }, (_, k) => [R * Math.cos(PI * (k + 0.5) / 13), yb + ry * Math.sin(PI * (k + 0.5) / 13) - 0.3] as Vec2), (x, y) => ellipse(x, y, 1, 0.75), cream));
  // what stands on top, back to front: cream dollops round the rim, strawberries or cherries, candles
  const items: [number, () => Shape[]][] = [];
  for (let k = 0; k < 16; k++) { const a = 2 * PI * k / 16, x = R * 0.86 * Math.cos(a), y = yt + ry * 0.86 * Math.sin(a); items.push([y, () => [S(ellipse(x, y - 0.6, 1.25, 0.95), cream), S(ellipse(x - 0.35, y - 0.95, 0.4, 0.3), WHITE, { flat: true, opacity: 0.8 })]]); }
  for (let k = 0; k < 6; k++) {
    const a = 2 * PI * k / 6 + 0.3, x = R * 0.55 * Math.cos(a), y = yt + ry * 0.55 * Math.sin(a);
    items.push([y, () => choc ? [L([[x, y - 1.4], [x + 0.6, y - 3]], "#4E7A2E", 0.25, 1), S(ellipse(x, y - 1.1, 1.05, 1), "#A8141E"), S(ellipse(x - 0.35, y - 1.4, 0.3, 0.25), WHITE, { flat: true, opacity: 0.7 })]
      : [P([[x - 1.3, y - 0.3], [x + 1.3, y - 0.3], [x + 1.1, y - 1.7], [x, y - 3], [x - 1.1, y - 1.7]], "#D63A3A"), ...specks([[x - 0.5, y - 1.2], [x + 0.4, y - 1.6], [x, y - 2.3], [x + 0.6, y - 0.7]], 0.12, 0.12, "#F6D7A0"), ...specks([[x - 0.8, y - 0.2], [x + 0.8, y - 0.2], [x, y - 0.1]], 0.7, 0.3, LEAF)]]);
  }
  for (let k = 0; k < candles; k++) {
    const a = candles === 1 ? PI / 2 : 2 * PI * k / candles + 0.2, rr = candles === 1 ? 0 : 0.36, x = R * rr * Math.cos(a), y = yt + ry * rr * Math.sin(a);
    items.push([y + 0.01, () => candle(x, y, CANDLES[k % CANDLES.length], flame, glow, flames)]);
  }
  for (const [, f] of items.sort((a, b) => a[0] - b[0])) sh.push(...f());
  if (choc) sh.push(...lines(mound(r, 10, R * 0.5, 0.01, 0).map(([x]) => [[x, yt + r.range(-1.6, 1.4)], [x + 0.7, yt + r.range(-1.6, 1.4)]]), "#3A2014", 0.3, 0.8));
  return sh;
}

/** A slice of cake on a small plate, its cut face showing the layers. */
function slice(r: Rng, choc: boolean): Shape[] {
  const sp = choc ? "#6B4128" : "#EFCB84", fil = choc ? "#3E2216" : "#F2A7B4", top = choc ? "#5A3422" : "#FFF7EA", y0 = -3.3, yt = y0 - 7.2;
  const face: Shape[] = [[0, 2.4, sp], [2.4, 1.1, fil], [3.5, 2.4, sp], [5.9, 1.3, top]].map(([a, h, c]) => S(rect(-5.5, y0 - (a as number) - (h as number), 9, h as number), c as string));
  return [...plate(r, 16, "empty", r.pick(RIMS)), P([[3.5, y0, 0], [6, y0 - 2, 0], [6, yt - 2.1, 0], [3.5, yt, 0]], tone(top, "shade")), ...face,
    ...specks(xs(5, 1.7).map(x => [x - 1, y0 - 2.95]), 0.35, 0.25, choc ? "#F6E6CF" : "#C2273A"), P([[-5.5, yt, 0], [3.5, yt, 0], [6, yt - 2.1, 0]], top),
    S(ellipse(3.4, yt - 1, 1.4, 1), choc ? "#F6E6CF" : WHITE), ...(choc ? [S(ellipse(3.4, yt - 2.2, 1, 0.95), "#A8141E")] : [P([[2.2, yt - 1.4], [4.6, yt - 1.4], [4.4, yt - 2.6], [3.4, yt - 3.8], [2.4, yt - 2.6]], "#D63A3A")]),
    strip(face[0], -5.5, 0.9, WHITE, 0.25)];
}

/**
 * A cake: whole on its board (`flavor` strawberry or chocolate, by seed; `candles` standing on top,
 * lit unless `lit: false`, their flames glowing at night on no switch), or a `slice` on a small plate
 * (`kind: "slice"`); `n` of them side by side. Held, it sits on the hand.
 */
const cakeP: PieceDef = { draw(p, r) {
  const choc = str(p.flavor, r.chance(0.5) ? "chocolate" : "strawberry") === "chocolate", glow: Shape[] = [], sh: Shape[] = [], slices = str(p.kind, "whole") === "slice";
  const candles = Math.round(Math.max(0, Math.min(12, num(p.candles, 0)))), n = cnt(p, 1, 8), flames: Vec2[] = [];
  // the flames are fire (particles), held too (the stage burns them in the hand), unless too many
  const fl = n * candles <= 16 ? flames : undefined;
  for (const x of xs(n, slices ? 19 : 34)) { const k = flames.length; sh.push(...at(slices ? slice(r, choc) : cake(r, choc, candles, p.lit !== false, glow, fl), x)); for (let i = k; i < flames.length; i++) flames[i] = [flames[i][0] + x, flames[i][1]]; }
  const m = p.held ? LIFT : ID;
  return out("cake", mv(sh, m), 5, p, 0.35, glow.length ? { emissive: { shapes: mv(glow, m), edge: 0 }, switch: false } : {}, fires(flames.map(([x, y]) => apply(m, x, y))));
}, variants: { slice: { kind: "slice" } },
  meta: {
    about: "A round cake on its board with candles on top, or a slice of cake on a small plate; strawberry or chocolate.",
    params: {
      kind: { type: "enum", values: ["whole", "slice"], default: "whole" },
      flavor: { type: "enum", values: ["strawberry", "chocolate"], about: "default seeded" },
      candles: { type: "int", min: 0, max: 12, default: 0, about: "candles on a whole cake" },
      lit: { type: "bool", default: true, about: "the candles burn" },
      n: { type: "int", min: 1, max: 8, default: 1, about: "how many side by side" },
    },
    terms: ["a1-w-pasta", "b1-w-kek", "a1-w-dogum-gunu"],
    tags: ["food"],
  } };

/**
 * Birthday candles, `n` in a row (default 1), pastel and striped in their little holders: lit (a flame
 * of fire on its wick, flickering, glowing at night on no switch) unless `lit: false`; `out` of them, from the right, just blown out
 * (a curl of smoke). Held, a bunch of them fans out of the fist.
 */
const candleP: PieceDef = { draw(p, r) {
  const n = cnt(p, 1, 80), off = p.lit === false ? n : Math.max(0, Math.min(n, Math.round(num(p.out, 0)))), glow: Shape[] = [], start = r.int(0, 5), flames: Vec2[] = [];
  // the flames are fire (particles), held too (fanned out of the fist with their candles), unless too many
  const fl = n - off <= 16 ? flames : undefined;
  let sh: Shape[] = [];
  xs(n, 1.7).forEach((x, i) => {
    const k = flames.length, one = candle(p.held ? 0 : x, p.held ? -5 : 0, CANDLES[(start + i) % CANDLES.length], i < n - off, glow, fl), a = Math.max(-0.6, Math.min(0.6, (i - (n - 1) / 2) * 0.13));
    if (p.held) for (let j = k; j < flames.length; j++) flames[j] = apply(rotateAbout(a, 0, -4), flames[j][0], flames[j][1]);
    sh.push(...(p.held ? mv(one, rotateAbout(a, 0, -4)) : one));
    if (p.held && i < n - off) glow.splice(-2, 2, ...mv(glow.slice(-2), rotateAbout(a, 0, -4)));
  });
  return out("candle", sh, 10, p, 0.15, glow.length ? { emissive: { shapes: glow, edge: 0 }, switch: false } : {}, fires(flames));
}, meta: {
  about: "Birthday candles in a row, pastel and striped in their holders: lit, or some just blown out with a curl of smoke.",
  params: {
    n: { type: "int", min: 1, max: 80, default: 1, about: "how many in a row" },
    lit: { type: "bool", default: true, about: "false: all of them out" },
    out: { type: "int", min: 0, max: 80, default: 0, about: "how many, from the right, just blown out" },
  },
  terms: ["b1-w-mum"],
  tags: ["light"],
} };

// ---- Cutlery, jar, bowl ---------------------------------------------------------------------

/** A cake knife lying on its side: a long serrated blade, a handle with two rivets. */
function knife(r: Rng): Shape[] {
  const handle = S(rrect(-15, -2.3, 10.4, 2.3, 1.1), r.pick(["#F4F1EA", "#7A5034", BLACK])), blade = P([[-4.4, -2.5, 0], [11.5, -2.9], [15, -1.9], [15.5, -0.5, 0], [-4.4, -0.2, 0]], STEEL);
  return [handle, { path: handle.path, fill: tone(handle.fill!, "shade"), flat: true, opacity: 0.45, clip: rect(-16, -1.1, 12, 2) }, ...specks([[-12.6, -1.15], [-7.6, -1.15]], 0.38, 0.38, STEEL), S(rect(-5, -2.6, 1.1, 2.6), tone(STEEL, "shade")),
    blade, ...lines([Array.from({ length: 37 }, (_, i) => [-3.6 + i * 0.5, -0.32 - (i % 2) * 0.38] as Vec2)], tone(STEEL, "deep"), 0.2, 0.8), L([[-3.6, -2.2], [11, -2.5]], WHITE, 0.35, 0.7)];
}
/** A teaspoon lying on its side. */
function teaspoon(): Shape[] {
  return [S(ellipse(-4.8, -1.15, 2.3, 1.15), STEEL), S(ellipse(-4.9, -1.3, 1.7, 0.7), tone(STEEL, "light"), { flat: true }),
    P([[-2.8, -1.45], [6, -1.45], [8.3, -1.95], [8.9, -1.2], [8.3, -0.5], [6, -0.95], [-2.8, -0.85]], STEEL), L([[-1.5, -1.3], [7.5, -1.5]], WHITE, 0.2, 0.6)];
}

/** Cutlery lying on its side, `n` one above the other: a `teaspoon` (default) or a `knife` (a cake knife). Held, it stands up out of the fist, the blade or the bowl up. */
const cutlery: PieceDef = { draw(p, r) {
  const k = str(p.kind, "teaspoon") === "knife", n = cnt(p, 1, 12), sh: Shape[] = [];
  for (let i = 0; i < n; i++) sh.push(...at(k ? knife(r) : teaspoon(), r.range(-0.8, 0.8) + (p.held ? i * 1.6 : 0), p.held ? 0 : -i * 2.4));
  const m = !p.held ? ID : k ? mul(translate(1.6, -13.8), rotate(-PI / 2)) : mul(translate(-1.2, -8), rotate(PI / 2));
  return out("cutlery", mv(sh, m), 7, p, 0.2);
}, variants: { knife: { kind: "knife" }, teaspoon: { kind: "teaspoon" } },
  meta: {
    about: "Cutlery lying on its side, one above the other: teaspoons or a serrated cake knife.",
    params: {
      kind: { type: "enum", values: ["teaspoon", "knife"], default: "teaspoon" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "how many" },
    },
    terms: ["a1-w-kasik", "a2-w-bicak"],
    tags: ["food"],
  } };

/** A glass jar's right side, `w` × `h`: a round foot, straight sides, shoulders and a neck. */
const jarSide = (w: number, h: number, s = Math.min(1.5, w * 0.16)): Pt[] => [[w / 2 - 0.7, 0, 0], [w / 2, -1], [w / 2, -h + s * 1.75], [w / 2 - s * 0.93, -h + 0.7], [w / 2 - s, -h, 0]];
/**
 * A glass jar `w` × `h` with a screw lid in `lid`: `inside` drawn within the glass (given its inside),
 * `front` on the glass (a label), then the glass's glints.
 */
function jar(w: number, h: number, lid: string, inside: (inner: Path) => Shape[], front: Shape[] = []): Shape[] {
  const glassS = S(sym(jarSide(w, h)), GLASS, { opacity: 0.45 }), inner = sym(jarSide(w - 0.8, h - 0.5)).move(0, -0.4), lw = w - 2 * Math.min(1.5, w * 0.16) + 0.4, lh = Math.min(2.2, h * 0.28);
  return [glassS, ...inside(inner).map(s => ({ ...s, clip: [...clipsOf(s), inner] })), ...front, strip(glassS, -w / 2 + 0.5, w * 0.1, WHITE, 0.55), strip(glassS, w / 2 - w * 0.2, w * 0.07, WHITE, 0.3),
    L([[-w / 2 + 1.2, -h + 2.2], [-w / 2 + 2.4, -h + 1]], WHITE, 0.4, 0.7), S(rrect(-lw / 2, -h - lh, lw, lh + 0.3, 0.5), lid), ...lines(xs(Math.round(lw / 0.9), 0.9).map(x => [[x, -h - lh + 0.5], [x, -h]]), tone(lid, "shade"), 0.25, 0.6),
    S(ellipse(0, -h - lh, lw / 2, 0.55), tone(lid, "light"))];
}
/** A paper label taped on a jar: its shapes and its text box. */
function label(w: number, y: number, h: number, text: string): [Shape[], TextSpec] {
  const tape = (x: number, a: number): Shape => ({ path: rect(-0.9, -0.3, 1.8, 0.6).transform(mul(translate(x, y + 0.15), rotate(a))), fill: "#F0E2C8", flat: true, opacity: 0.85 });
  return [[S(rrect(-w / 2, y, w, h, 0.25), "#FBF3DF"), S(rect(w / 2 - 1, y, 1, h), tone("#FBF3DF", "shade"), { flat: true, opacity: 0.4 }), tape(-w / 2 + 0.8, -0.4), tape(w / 2 - 0.8, 0.4)],
    { text, x: -w / 2 + 0.3, y: y + 0.4, w: w - 0.6, h: h - 0.6, size: 1.2, font: "hand" }];
}

/**
 * A glass jar with a screw lid, `w` × `h` (default 11 × 14): empty, or a money jar (`kind: "coins"`, the
 * Farsça kumbarası) with `n` one-lira coins heaped inside (default 1, full at about 100) and a coin slot
 * in its lid. A paper `label` is taped on (the money jar's default "FARSÇA: 1 LİRA"). Held, it sits on the hand.
 */
const jarP: PieceDef = { draw(p, r) {
  const coins = str(p.kind, "plain") === "coins", w = num(p.w, 11), h = num(p.h, 14), n = cnt(p, 1, 110, 0), text = str(p.label, coins ? "FARSÇA: 1 LİRA" : "").trim(), per = Math.max(3, Math.floor((w - 2) / 1.2));
  const [lab, spec] = label(w - 1.8, -h + 2.6, 4.4, text);
  const pile = (): Shape[] => {
    const sh: Shape[] = [];
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / per), x = (i % per - (per - 1) / 2) * 1.2 + (layer % 2 ? 0.5 : -0.2) + r.range(-0.25, 0.25), y = -1.1 - layer * 0.62 - r.range(0, 0.25);
      if (n === 1 || r.chance(0.25)) sh.push(S(ellipse(x, y - 0.8, 1.2, 1.2), GOLD), S(ellipse(x, y - 0.8, 0.62, 0.62), "#B9BFC6", { flat: true }), S(ellipse(x - 0.35, y - 1.15, 0.3, 0.22), WHITE, { flat: true, opacity: 0.6 }));
      else sh.push(S(ellipse(x, y + 0.15, 1.25, 0.46), tone(GOLD, "shade")), S(ellipse(x, y, 1.25, 0.46), GOLD), S(ellipse(x, y - 0.03, 0.62, 0.22), "#B9BFC6", { flat: true }));
    }
    return sh;
  };
  const sh = jar(w, h, coins ? "#B3261E" : r.pick([GOLD, "#B3261E", W]), coins ? pile : () => [], text ? lab : []);
  if (coins) sh.push(S(rrect(-1.5, -h - 2.4, 3, 0.36, 0.15), INK));
  const m = p.held ? LIFT : ID;
  return out("jar", mv(sh, m), 7, p, 0.25, text ? { text: [word(m, spec)] } : {});
}, variants: { coins: { kind: "coins" } },
  meta: {
    about: "A glass jar with a screw lid and a taped paper label: empty, or a money jar heaped with one-lira coins.",
    params: {
      kind: { type: "enum", values: ["plain", "coins"], default: "plain" },
      w: { type: "num", default: 11, about: "width, cm" },
      h: { type: "num", default: 14, about: "height, cm" },
      n: { type: "int", min: 0, max: 110, default: 1, about: "coins in a money jar (full at about 100)" },
      label: { type: "text", about: "the label's words; the money jar's default \"FARSÇA: 1 LİRA\"" },
    },
    tags: ["food"],
  } };

const BOWLS = [STEEL, "#C4553A", "#2F8C88", "#E58FA0", "#4F6E9E", "#E0A83A"];
/** A cat's food bowl, 15 cm across, with `what` in it: dry food, milk, wet food or nothing; a paw print on a plastic one, by chance. */
function catBowl(r: Rng, what: string): Shape[] {
  const c = r.pick(BOWLS), body = P([[-7.6, -5, 0], [7.6, -5, 0], [6.4, -1], [5.3, 0, 0], [-5.3, 0, 0], [-6.4, -1]], c);
  const sh: Shape[] = [body, ...lit(body, -7.6, 7.6), S(ellipse(0, -5, 7.6, 1.5), tone(c, "light")), S(ellipse(0, -5, 6.5, 1.05), tone(c, "deep"))];
  if (what === "milk") sh.push(S(ellipse(0, -5.05, 6.2, 0.9), W, { flat: true }), S(ellipse(-2, -5.2, 1.6, 0.25), WHITE, { flat: true }));
  else if (what === "wet") sh.push(P([[-5, -4.8], [5, -4.8], [3, -6.4], [-2.4, -6.6]], "#8C5A3F"), ...specks([[-1.6, -5.6], [1.4, -5.8], [3, -5.2]], 0.7, 0.45, "#B07A5A"));
  else if (what !== "empty") for (const k of ["#6E4628", "#8A5A35", "#A86F42"]) sh.push(...many(mound(r, 10, 6.2, 2.2, 0).map(([x, y]) => [x, y - 4.8] as Vec2), (x, y) => ellipse(x, y, 0.62, 0.46), k, { flat: true }));
  if (c !== STEEL && r.chance(0.5)) sh.push(...specks([[2.6, -2.2]], 0.9, 0.7, tone(c, "light"), 0.8), ...specks([[1.6, -3.3], [2.2, -3.65], [3, -3.65], [3.6, -3.3]], 0.32, 0.32, tone(c, "light"), 0.8));
  return sh;
}

/** A cat's food bowl, `n` side by side, each its own colour, with `food` in it: `dry`, `milk`, `wet` or `empty` (by seed when left out). Held, it sits on the hand. */
const bowl: PieceDef = { draw(p, r) {
  const sh: Shape[] = [];
  for (const x of xs(cnt(p, 1, 8), 18)) sh.push(...at(catBowl(r, str(p.food, r.pick(["dry", "dry", "milk", "wet"]))), x));
  return out("bowl", p.held ? mv(sh, LIFT) : sh, 6, p, 0.3);
}, meta: {
  about: "A cat's food bowl, each its own colour, with dry food, milk, wet food or nothing in it.",
  params: {
    food: { type: "enum", values: ["dry", "milk", "wet", "empty"], about: "what is in it; default seeded" },
    n: { type: "int", min: 1, max: 8, default: 1, about: "how many side by side" },
  },
  terms: ["a2-w-kase"],
  tags: ["food", "animal"],
} };

// ---- Food and goods -------------------------------------------------------------------------

/** An egg tray (viyol) of `tray` 10 (5 × 2) or 30 (6 × 5), seen from the front and above, with `n` eggs in it, the front cups first. */
function eggs(r: Rng, tray: number, n: number): Shape[] {
  const cols = tray > 10 ? 6 : 5, rows = tray > 10 ? 5 : 2, pulp = r.pick(["#CFC6B3", "#D9CBA6", "#C2C7C9"]), wd = cols * 4.6, sh: Shape[] = [S(rect(-wd / 2, -2.4 - rows * 2.3, wd, rows * 2.3), mix(pulp, tone(pulp, "shade"), 0.5))];
  for (let j = rows - 1; j >= 0; j--) {
    const y = -1.8 - j * 2.3;
    xs(cols, 4.6).forEach((x, i) => {
      if (j * cols + i >= n) { sh.push(S(ellipse(x, y - 0.7, 1.7, 0.75), tone(pulp, "deep"), { flat: true, opacity: 0.6 })); return; }
      const c = mix("#E2B88C", "#F4E6D2", r()), e = P([[x, y + 0.2], [x + 1.95, y - 1.5], [x + 1.45, y - 3.8], [x, y - 4.75], [x - 1.45, y - 3.8], [x - 1.95, y - 1.5]], c);
      sh.push(e, strip(e, x + 0.7, 2, tone(c, "shade"), 0.4), S(ellipse(x - 0.7, y - 3.2, 0.45, 0.7), WHITE, { flat: true, opacity: 0.45 }));
    });
    sh.push(S(rect(-wd / 2, y - 0.3, wd, j ? 1.2 : 2.1).add(many(xs(cols, 4.6).map(x => [x, y]), (x, yy) => ellipse(x, yy - 0.2, 2.3, 1.2), pulp)[0].path), pulp), ...lines(xs(cols - 1, 4.6).map(x => [[x, y - 0.4], [x, y + 0.7]]), tone(pulp, "deep"), 0.3, 0.5));
  }
  return sh;
}

/** An olive: black or green, a glint on it. */
const olive = (r: Rng, x: number, y: number, black: boolean): Shape[] => [S(ellipse(x, y, 1.05, 1.3), black ? mix("#2F2628", "#45333A", r()) : mix("#8C9A3C", "#6E7E2E", r())), S(ellipse(x - 0.35, y - 0.45, 0.3, 0.4), black ? "#7A6472" : "#D2DA86", { flat: true, opacity: 0.75 })];
/** Olives: a jar of them in brine with a printed band, or `loose`, heaped in a glazed bowl. */
function olives(r: Rng, black: boolean, loose: boolean): Shape[] {
  if (loose) {
    const c = r.pick(["#C4553A", "#2E5C9E", "#E9DCC0"]), b = P([[-7.4, -4, 0], [7.4, -4, 0], [5.8, -0.9], [3.8, 0, 0], [-3.8, 0, 0], [-5.8, -0.9]], c), sh: Shape[] = [S(ellipse(0, -4, 7.4, 1.4), tone(c, "deep"))];
    for (let k = 0; k < 4; k++) for (const x of xs(6 - k, 2.1)) sh.push(...olive(r, x + r.range(-0.3, 0.3), -4.4 - k * 1.5, black));
    return [...sh, b, ...lit(b, -7.4, 7.4), ...lines([[[-7, -3.2], [7, -3.2]]], tone(c, "light"), 0.5, 0.6)];
  }
  const w = 9, h = 12, band = r.pick(["#F2E4C4", "#E9DCC0", "#F7F3EA"]);
  return jar(w, h, r.pick([GOLD, "#B3261E", "#3E7A5A"]), () => {
    const sh: Shape[] = [S(rect(-5, -h + 2.2, 10, h), black ? "#5C3F48" : "#C8C27A", { flat: true, opacity: 0.6 })];
    for (let j = 0; j < 5; j++) for (const x of xs(j % 2 ? 3 : 4, 2.2)) sh.push(...olive(r, x, -1.6 - j * 2.1, black));
    return sh;
  }, [S(rect(-w / 2, -h * 0.62, w, 3.6), band, { flat: true, clip: sym(jarSide(w, h)) }), S(rect(-w / 2, -h * 0.62 + 2.6, w, 0.5), black ? "#3E2A33" : "#6E7E2E", { flat: true, clip: sym(jarSide(w, h)) })]);
}

/** Honeycomb cells: a tile of hexagons. */
const hx = (cx: number, cy: number, R = 0.55) => poly(Array.from({ length: 6 }, (_, k) => [cx + R * Math.cos(PI / 6 + k * PI / 3), cy + R * Math.sin(PI / 6 + k * PI / 3)] as Vec2));
const COMB = { w: 0.953, h: 1.65, shapes: [{ path: hx(0.476, 0.55, 0.45).add(hx(0, 1.375, 0.45)).add(hx(0.953, 1.375, 0.45)), fill: "#E09A30" }] };
/** A jar of honey with a piece of comb in it, under a lid or a gingham cloth tied with string. */
function honey(r: Rng): Shape[] {
  const w = 9.5, h = 12, sh = jar(w, h, GOLD, () => {
    const comb = S(rrect(-2.4, -h + 3.4, 5, 7.8, 0.6), "#F3D98A");
    return [S(rect(-5, -h + 2.6, 10, h), "#D98F2B", { flat: true, opacity: 0.9 }), comb, { path: comb.path, tile: COMB }, strip(comb, 1.2, 2, "#B57A22", 0.35), strip(S(rect(-5, -h + 2.6, 10, h), "#D98F2B"), -4.4, 1.4, "#F3B95A", 0.6)];
  });
  if (r.chance(0.5)) {
    const cloth = P([[-3.4, -h - 2.6], [3.4, -h - 2.6], [4.8, -h - 1], [5.4, -h + 1.4, 0], [4.2, -h + 0.8, 0], [3, -h + 1.6, 0], [1.6, -h + 0.9, 0], [0, -h + 1.7, 0], [-1.6, -h + 0.9, 0], [-3, -h + 1.6, 0], [-4.2, -h + 0.8, 0], [-5.4, -h + 1.4, 0], [-4.8, -h - 1]], W);
    sh.push(cloth, { path: cloth.path, tile: { w: 1.2, h: 1.2, shapes: [S(rect(0, 0, 0.6, 1.2), "#C0392B", { opacity: 0.55 }), S(rect(0, 0, 1.2, 0.6), "#C0392B", { opacity: 0.55 })] } }, strip(cloth, 1.5, 5, INK, 0.12), L([[-4.4, -h + 0.1], [0, -h + 0.5], [4.4, -h + 0.1]], "#8E6A44", 0.3, 1));
  }
  return sh;
}

/** White peynir (a block, crumbly, wet) or kaşar (a wheel with a yellow rind and a paper seal). */
function cheese(r: Rng, kasar: boolean): Shape[] {
  if (!kasar) {
    const c = "#F7F4EC", b = P([[-6, 0, 0], [6, 0, 0], [6, -5.4, 0], [3.4, -5.7], [0.6, -5.3], [-2.6, -5.7], [-6, -5.5, 0]], c);
    return [P([[6, 0, 0], [7.3, -1.5, 0], [7.3, -6.9, 0], [6, -5.4, 0]], tone(c, "shade")), b, P([[-6, -5.5, 0], [-2.6, -5.7], [0.6, -5.3], [3.4, -5.7], [6, -5.4, 0], [7.3, -6.9, 0], [-4.7, -7, 0]], WHITE),
      ...specks(Array.from({ length: 10 }, () => [r.range(-5.2, 5.2), r.range(-5, -0.8)] as Vec2), 0.24, 0.17, "#D9D2C0"), L([[-5, -4.2], [-1.4, -4.6]], WHITE, 0.5, 0.8), strip(b, 4.4, 2, tone(c, "shade"), 0.3)];
  }
  // a wheel of kaşar with a wedge cut out of its front
  const rind = "#E2B44A", R = 8, ry = 1.9, yt = -7.6, yb = -1.9, a1 = 0.3 * PI, a2 = 0.62 * PI, inner = "#F7E3A2";
  const pt = (a: number, y: number): Vec2 => [R * Math.cos(a), y + ry * Math.sin(a)], arc = (s: number, e: number, y: number) => Array.from({ length: 13 }, (_, i) => pt(s + (e - s) * i / 12, y));
  const band = (s: number, e: number) => S(poly([...arc(s, e, yt), ...arc(e, s, yb)]), rind);
  return [band(0, a1), band(a2, PI), strip(band(0, a1), 3, 6, tone(rind, "shade"), 0.5), S(poly([[0, yt], pt(a1, yt), pt(a1, yb), [0, yb]]), inner), S(poly([[0, yt], pt(a2, yt), pt(a2, yb), [0, yb]]), tone(inner, "shade")),
    S(poly([[0, yt], ...arc(a2, a1 + 2 * PI, yt)]), "#F3D47E"), S(ellipse(-2.6, yt - 0.7, 3, 0.55), WHITE, { flat: true, opacity: 0.35 }),
    ...lines([[pt(a2, yt + 0.25), pt(PI, yt + 0.25)], [pt(0, yt + 0.25), pt(a1, yt + 0.25)]], tone(rind, "deep"), 0.25, 0.4), S(ellipse(-5.6, -4.6, 1.1, 1.3), "#C0392B", { flat: true })];
}

/** One tomato standing on (x, y): red to orange by chance, a glint, the green star of its calyx. */
function tomato(r: Rng, x: number, y: number): Shape[] {
  const c = r.pick(["#D8402E", "#E2553A", "#C9352A", "#DB4A30"]), t = S(ellipse(x, y - 3, 3.5, 3.05), c), cy = y - 5.85;
  const star: Pt[] = Array.from({ length: 10 }, (_, k) => { const a = k * PI / 5 - PI / 2, rr = k % 2 ? 0.45 : 1.7; return [x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.45, 0]; });
  return [t, strip(t, x + 1.2, 3, tone(c, "shade"), 0.45), S(ellipse(x - 1.4, y - 4.2, 0.9, 0.55), WHITE, { flat: true, opacity: 0.35 }), P(star, "#4E7A2E"), L([[x, cy], [x + 0.3, cy - 0.9]], "#3E6A26", 0.45, 1)];
}
/** Tomatoes in a heap (`n`), the top rows drawn first; returns the shapes and the heap's height. */
function heap(r: Rng, n: number): [Shape[], number] {
  let k = 1; while (k * (k + 1) / 2 < n) k++;
  const rows: Shape[][] = [];
  for (let j = 0, left = n; j < k && left > 0; j++) { const c = Math.min(left, k - j); rows.push(xs(c, 6.4).flatMap(x => tomato(r, x + r.range(-0.4, 0.4), -j * 4.6))); left -= c; }
  return [rows.reverse().flat(), rows.length * 4.6 + 2];
}
/** A market crate (wooden slats or green plastic) heaped with `n` tomatoes. */
function crate(r: Rng, n: number): [Shape[], number] {
  const per = Math.max(4, Math.min(8, Math.ceil(n / 2))), wd = per * 6.4 + 4, wood = r.chance(0.6), c = wood ? "#C99A68" : "#3E7A5A";
  const rows: Shape[][] = [];
  for (let j = 0, left = n; left > 0 && j < 4; j++) { const k = Math.min(left, per - j); rows.push(xs(k, 6.4).flatMap(x => tomato(r, x + r.range(-0.4, 0.4), -12.6 - j * 3.6 + Math.abs(x) * 0.08))); left -= k; }
  const sh: Shape[] = [S(rect(-wd / 2, -15, wd, 15), tone(c, "deep")), ...rows.reverse().flat()];
  if (wood) for (let k = 0; k < 3; k++) { const s = S(rect(-wd / 2, -14.6 + k * 4.9, wd, 3.9), c); sh.push(s, ...lines([[[-wd / 2 + 2, -13 + k * 4.9], [wd / 2 - 3, -13.4 + k * 4.9]]], tone(c, "shade"), 0.3, 0.5), strip(s, wd / 2 - 3, 3, tone(c, "shade"), 0.4)); }
  else sh.push(S(holedRect(wd, per), c, { evenodd: true }), ...lit(S(rect(-wd / 2, -15, wd, 15), c), -wd / 2, wd / 2, 0.6));
  sh.push(S(rect(-wd / 2 - 0.6, -15.4, 2.2, 15.4), tone(c, "shade")), S(rect(wd / 2 - 1.6, -15.4, 2.2, 15.4), tone(c, "shade")));
  return [sh, 17.6 + rows.length * 3.6];
}
/** A plastic crate's front: a panel with a row of slots. */
function holedRect(wd: number, per: number): Path {
  const p = rect(-wd / 2, -15, wd, 15);
  for (const x of xs(per, 6.4)) { p.add(rrect(x - 1.8, -12.6, 3.6, 4.4, 1.2)); p.add(rrect(x - 1.8, -6.4, 3.6, 4.4, 1.2)); }
  return p;
}
/** A thin market bag (poşet) of `n` tomatoes hanging from its tied handles, the knot at (0, -4). */
function bag(r: Rng, n: number): Shape[] {
  const c = r.pick(["#F4F1EA", "#F2C6CF", "#CFE3D3"]), body = P([[-7.4, 5], [7.4, 5], [9.6, 13], [9.2, 23], [6.4, 27.6, 0], [-6.4, 27.6, 0], [-9.2, 23], [-9.6, 13]], c, { opacity: 0.55 });
  const inside: Shape[] = [];
  for (let j = 0, left = Math.min(n, 9); left > 0; j++) { const k = Math.min(left, 3 - (j % 2)); inside.push(...xs(k, 6.2).flatMap(x => tomato(r, x, 27.4 - j * 5.2))); left -= k; }
  return [rod([[-6.4, 6], [-3.6, -1.4], [-0.6, -4.2]], c, 1.4), rod([[6.4, 6], [3.6, -1.4], [0.6, -4.2]], c, 1.4), ...inside, body, strip(body, 3.6, 8, tone(c, "shade"), 0.3),
    L([[-5, 8], [-6.4, 16], [-5.4, 24]], WHITE, 0.4, 0.6), S(ellipse(0, -4, 1.5, 1.1), c)];
}

const FISH: [string, string, boolean][] = [["#7D8B96", "#E7EBEC", false], ["#3E5F7A", "#D9DFE3", true], ["#4F7F86", "#DCE5E2", false]];
/** A fish lying on its side, head to the right, 35 cm: levrek, palamut (with its stripes) or lüfer, by seed. No eye: nothing in the kit has a face. */
function fish(r: Rng): Shape[] {
  const [back, belly, stripes] = r.pick(FISH), fin = tone(back, "shade");
  const body = P([[-12, -3], [-6, -5.4], [2, -6.6], [9, -6.2], [14, -4.6], [17.5, -3, 0], [15, -1.6], [8, -0.2], [0, -0.1], [-7, -1.2], [-12, -2.4]], back);
  return [P([[-4, -5.6], [-1.6, -8.4], [2.4, -7.9], [5, -6.4]], fin), P([[6, -0.5], [8.2, 1.2], [9.4, -0.4]], fin), P([[-11.6, -3.6], [-16, -6.8], [-17.6, -6.4, 0], [-15.4, -2.8], [-17.6, 0.6, 0], [-16, 0.8], [-11.6, -2]], fin),
    body, S(body.path, belly, { flat: true, clip: rect(-20, -2.7, 40, 5) }), { path: body.path, flat: true, opacity: 0.16, tile: { w: 1.4, h: 1, shapes: [P([[0, 0, 0], [0.7, 0.6], [1.4, 0, 0], [0.7, 0.4]], INK)] } },
    ...(stripes ? lines(xs(6, 2.6).map(x => [[x - 1.2, -6], [x - 2.6, -4]]), tone(back, "deep"), 0.35, 0.5) : []), L([[-11, -3], [0, -3.7], [12, -3.6]], tone(back, "deep"), 0.3, 0.45),
    L([[11.4, -5.6], [10.6, -3.6], [11.4, -1.2]], tone(back, "deep"), 0.35, 0.6), P([[9.6, -3.4], [6.4, -2.4], [7, -4]], tone(belly, "shade"), { flat: true, opacity: 0.7 }), L([[17.3, -3], [15.4, -2.7]], tone(back, "deep"), 0.3, 0.8), L([[-6, -4.6], [6, -5.6]], WHITE, 0.45, 0.4)];
}

/** A simit lying flat (seen from a little above), on y = 0. */
function simitFlat(r: Rng): Shape[] {
  const c = mix(CRUST, "#C47A3A", r()), hole = () => ellipse(0, -1.75, 3.7, 1.2), y = -1.5;
  return [S(ellipse(0, y + 0.9, 6.8, 2.5).add(ellipse(0, y + 0.65, 3.7, 1.2)), tone(c, "shade"), { evenodd: true }), S(ellipse(0, y, 6.8, 2.5).add(hole()), c, { evenodd: true }), S(hole(), tone(c, "deep"), { flat: true, clip: ellipse(0, -2.45, 3.7, 1.2) }),
    ...lines(Array.from({ length: 14 }, (_, k) => { const a = 2 * PI * k / 14, x = 5.2 * Math.cos(a), yy = y + 1.85 * Math.sin(a); return [[x - 0.45, yy - 0.5], [x + 0.45, yy + 0.5]] as Vec2[]; }), tone(c, "deep"), 0.35, 0.45),
    ...specks(Array.from({ length: 30 }, () => { const a = r.range(0, 2 * PI), t = r.range(0.6, 0.94); return [6.8 * t * Math.cos(a), y + 2.5 * t * Math.sin(a)] as Vec2; }), 0.26, 0.15, "#F2E1B8")];
}
/** A simit seen face on (a ring 13 cm across), centred at (0, 0). */
function simitFace(r: Rng): Shape[] {
  const c = mix(CRUST, "#C47A3A", r());
  return [S(ellipse(0, 0, 6.6, 6.6).add(ellipse(0, 0, 2.5, 2.5)), c, { evenodd: true }), strip(S(ellipse(0, 0, 6.6, 6.6).add(ellipse(0, 0, 2.5, 2.5)), c, { evenodd: true }), 2, 5, tone(c, "shade"), 0.4),
    ...lines(Array.from({ length: 16 }, (_, k) => { const a = 2 * PI * k / 16; return [[3 * Math.cos(a), 3 * Math.sin(a)], [6.2 * Math.cos(a + 0.35), 6.2 * Math.sin(a + 0.35)]] as Vec2[]; }), tone(c, "deep"), 0.4, 0.45),
    ...specks(Array.from({ length: 26 }, () => { const a = r.range(0, 2 * PI), d = r.range(3.1, 6.1); return [d * Math.cos(a), d * Math.sin(a)] as Vec2; }), 0.3, 0.18, "#F2E1B8")];
}

const PACKS = ["#2E7D4F", "#B3261E", "#E0A83A", "#2E3A59"];
/** A packet of Rize tea 10 × 17 cm, from a little to the left: a coloured box, a gold band, a cream panel with a tea glass and two leaves on it. */
function teaPacket(r: Rng, hills: boolean): Shape[] {
  const c = r.pick(PACKS), front = S(rect(-5, -17, 10, 17), c);
  return [P([[5, 0, 0], [7.2, -1.4, 0], [7.2, -18.4, 0], [5, -17, 0]], tone(c, "shade")), P([[-5, -17, 0], [5, -17, 0], [7.2, -18.4, 0], [-2.8, -18.4, 0]], tone(c, "light")), front, S(rect(-5, -16.4, 10, 1.6), GOLD, { flat: true }), S(rect(-5, -2.2, 10, 2.2), tone(c, "deep"), { flat: true }),
    S(rrect(-3.9, -13.6, 7.8, 10.6, 0.8), "#F6EBD0", { flat: true }), ...mv([...saucer(r), ...at(glass(0.9, false), 0, -1.25)], mul(translate(1, -3.6), [0.42, 0, 0, 0.42, 0, 0])),
    ...(hills ? [P([[-3.9, -9.4, 0], [3.9, -9.4, 0], [3.9, -11.6], [1.4, -12.7], [-1.4, -11.7], [-3.9, -12.5, 0]], "#7DAA5E", { flat: true }), ...lines([0, 1, 2].map(k => [[-3.6, -10 - k * 0.8], [-1.2, -10.4 - k * 0.8], [1.4, -10.2 - k * 0.8], [3.6, -10.6 - k * 0.8]] as Vec2[]), "#4E7A3A", 0.3, 0.8)] : []),
    P([[-3.2, -4.2, 0], [-2.6, -6.6], [-1.2, -7.8, 0], [-1.6, -5.6]], LEAF, { flat: true }), P([[-3.2, -4.2, 0], [-3.6, -6.4], [-2.8, -8.4, 0], [-2.4, -6]], "#3E7A32", { flat: true }), strip(front, -5, 1.2, WHITE, 0.25)];
}
/** A 0.5 l bottle of water: clear plastic, ribbed, a blue cap and a blue label with a wave. */
function water(): Shape[] {
  const b = S(sym([[3.2, 0, 0], [3.4, -1], [3.3, -14], [2.2, -18], [1.4, -19.6, 0]]), "#DCEEF5", { opacity: 0.75 }), lab = S(rect(-3.4, -12.6, 6.8, 5), "#2E6FB6", { flat: true, clip: b.path });
  return [b, S(b.path, "#A9D3EA", { flat: true, opacity: 0.45, clip: rect(-4, -16.8, 8, 17) }), ...lines([[[-3, -2.6], [3, -2.6]], [[-3, -4.1], [3, -4.1]], [[-2.4, -15.6], [2.4, -15.6]]], WHITE, 0.35, 0.6), lab,
    ...lines([[[-3.4, -9.6], [-1.8, -10.4], [0, -9.6], [1.8, -10.4], [3.4, -9.6]]], WHITE, 0.6, 0.9, b.path), strip(b, -2.6, 0.9, WHITE, 0.55), S(rrect(-1.6, -21.4, 3.2, 1.9, 0.4), "#2E6FB6"), S(rect(-1.75, -19.8, 3.5, 0.5), "#1F5FC0")];
}
/** A small jar of saffron (4.6 × 5.4 cm): red threads behind the glass, a gold cap, a printed band. */
function saffron(r: Rng): Shape[] {
  return jar(5.2, 4.6, GOLD, () => [S(rect(-3, -4.6, 6, 5), "#E7A13A", { flat: true, opacity: 0.25 }), ...lines(Array.from({ length: 44 }, () => { const x = r.range(-2.2, 2.2), y = r.range(-3.4, -0.5), a = r.range(0, PI); return [[x, y], [x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.45]] as Vec2[]; }), r.pick(["#C2361B", "#B02A14"]), 0.2, 1)],
    [S(rect(-2.6, -2.1, 5.2, 1.1), "#B3261E", { flat: true, opacity: 0.9, clip: sym(jarSide(5.2, 4.6)) }), ...lines([[[-2.6, -1.95], [2.6, -1.95]], [[-2.6, -1.15], [2.6, -1.15]]], GOLD, 0.12, 0.9)]);
}
/** `n` crumbs scattered on the ground (y = 0), for a bird. */
function crumbs(r: Rng, n: number): Shape[] {
  const a = 3 + n * 0.9, sh: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const x = r.range(-a, a), y = -r.range(0, 1.2), s = r.range(0.3, 0.75);
    sh.push(P(Array.from({ length: 5 }, (_, k) => [x + Math.cos(k * 1.2566 + s) * s * r.range(0.7, 1.2), y - s * 0.5 + Math.sin(k * 1.2566 + s) * s * 0.6 * r.range(0.7, 1.2)] as Vec2), r.pick(["#D9A55B", "#EED9AE", CRUST])));
  }
  return [...sh, ...specks(Array.from({ length: Math.ceil(n / 3) }, () => [r.range(-a, a), -r.range(0.1, 1)] as Vec2), 0.22, 0.12, "#F2E1B8")];
}

/**
 * Food and shop goods, `kind`: `eggs` (an egg tray of `tray` 10 or 30 with `n` eggs in it, default all),
 * `olives` (`n` jars, default 2, black then green, or `loose` in glazed bowls; `color` black or green for
 * all), `honey` (`n` jars of honey with comb), `cheese` (`n` pieces, default 2: a block of white peynir,
 * then a wheel of kaşar; `cheese` white or kasar for all), `tomatoes` (`n`, default 6, in a heap, or in a
 * market crate when `crate` or past 9; a `price` card stuck in them), `fish` (`n`, lying), `simit` (`n`,
 * default 3, in piles), `tea_packet` (`n` packets of Rize tea; a `label` if given), `water` (`n` bottles),
 * `saffron` (`n` little jars) or `crumbs` (`n`, default 14, on the ground for a bird). Held, each is carried
 * as people do: jars, eggs and cheese on the hand, tomatoes in a thin market bag hanging from its handles,
 * fish hanging by the tail, simits hanging on a finger, a crust of simit for the crumbs.
 */
const food: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "eggs"), held = !!p.held, sh: Shape[] = [], text: TextSpec[] = [];
  let m = held ? LIFT : ID, ppcm = 6, edge = 0.2;
  const row = (n: number, step: number, f: (i: number) => Shape[]) => xs(n, step).forEach((x, i) => sh.push(...at(f(i), x)));
  if (kind === "eggs") { const t = num(p.tray, 10) > 10 ? 30 : 10; sh.push(...eggs(r, t, cnt(p, t, t, 0))); }
  else if (kind === "olives") { const c = str(p.color, ""), loose = !!p.loose; row(cnt(p, 2, 8), loose ? 17 : 11, i => olives(r, c ? c === "black" : i % 2 === 0, loose)); ppcm = 7; }
  else if (kind === "honey") { row(cnt(p, 1, 8), 11.5, () => honey(r)); ppcm = 7; }
  else if (kind === "cheese") { const c = str(p.cheese, ""); row(cnt(p, 2, 8), 18, i => cheese(r, c ? c === "kasar" : i % 2 === 1)); }
  else if (kind === "tomatoes") {
    const n = cnt(p, 6, 40), price = str(p.price, "").trim();
    if (held) { sh.push(...bag(r, n)); m = ID; }
    else {
      const [t, hgt] = p.crate === true || (p.crate !== false && n > 9) ? crate(r, n) : heap(r, n), [, , x1] = groupBounds({ shapes: t });
      sh.push(...t);
      if (price) { const x = x1 - 4; sh.push(rod([[x, -hgt + 6], [x + 0.6, -hgt - 3]], "#C99A68", 0.5), S(rrect(x - 3.6, -hgt - 8, 8, 5.4, 0.3), "#F6E35A"), S(rect(x + 3.4, -hgt - 8, 1, 5.4), tone("#F6E35A", "shade"), { flat: true, opacity: 0.4 })); text.push({ text: price, x: x - 3.3, y: -hgt - 7.6, w: 7.4, h: 4.6, size: 2, font: "hand" }); }
    }
    ppcm = 5;
  } else if (kind === "fish") {
    const n = cnt(p, 1, 6);
    if (held) { for (let i = 0; i < Math.min(n, 3); i++) sh.push(...mv(fish(r), mul(rotateAbout((i - (Math.min(n, 3) - 1) / 2) * 0.22, 0, -4), mul(translate(-3, 12), rotate(PI / 2))))); m = ID; }
    else for (let i = 0; i < n; i++) sh.push(...at(fish(r), i * 3.6 - (n - 1) * 1.8, -i * 3.2));
    ppcm = 5;
  } else if (kind === "simit") {
    const n = cnt(p, 3, 20);
    if (held) { for (let i = 0; i < Math.min(n, 4); i++) sh.push(...mv(simitFace(r), mul(rotateAbout((i - (Math.min(n, 4) - 1) / 2) * 0.5, 0, -4), translate(0, 1)))); m = ID; }
    else { const piles = Math.ceil(n / 5); xs(piles, 15).forEach((x, j) => { for (let i = 0; i < Math.min(5, n - j * 5); i++) sh.push(...at(simitFlat(r), x + r.range(-0.8, 0.8), -i * 2.1)); }); }
  } else if (kind === "tea_packet") {
    const lab = str(p.label, "").trim();
    row(cnt(p, 1, 12), 11.4, () => teaPacket(r, !lab)); ppcm = 7;
    if (lab) xs(cnt(p, 1, 12), 11.4).forEach(x => text.push({ text: lab, x: x - 3.6, y: -13.3, w: 7.2, h: 3.4, size: 1.3, font: "print", color: "#2B2420" }));
  } else if (kind === "water") { row(cnt(p, 1, 24), 7.4, () => water()); m = ID; }
  else if (kind === "saffron") { row(cnt(p, 1, 8), 6, () => saffron(r)); ppcm = 12; edge = 0.15; }
  else if (kind === "crumbs") {
    if (held) { sh.push(...mv(simitFace(r), translate(0, -9)).map(s => ({ ...s, clip: [...clipsOf(s), rect(-8, -20, 16, 11.5)] }))); m = ID; }
    else sh.push(...crumbs(r, cnt(p, 14, 80)));
    ppcm = 10; edge = 0.15;
  }
  return out("food", mv(sh, m), ppcm, p, edge, text.length ? { text: text.map(t => word(m, t)) } : {});
}, variants: Object.fromEntries(["cheese", "crumbs", "eggs", "fish", "honey", "olives", "saffron", "simit", "tea_packet", "tomatoes", "water"].map(k => [k, { kind: k }])),
  meta: {
    about: "Food and shop goods: eggs, olives, honey, cheese, tomatoes, fish, simit, tea packets, water, saffron or crumbs.",
    params: {
      kind: { type: "enum", values: ["eggs", "olives", "honey", "cheese", "tomatoes", "fish", "simit", "tea_packet", "water", "saffron", "crumbs"], default: "eggs" },
      n: { type: "int", min: 0, max: 80, about: "how many; the range and default depend on the kind (eggs: the tray full; tomatoes 6; crumbs 14)" },
      tray: { type: "int", min: 10, max: 30, default: 10, about: "eggs: a tray of 10, or 30 past 10" },
      color: { type: "enum", values: ["black", "green"], about: "olives, for all; default black and green in turn" },
      loose: { type: "bool", default: false, about: "olives heaped in glazed bowls, not in jars" },
      cheese: { type: "enum", values: ["white", "kasar"], about: "for all; default white and kaşar in turn" },
      crate: { type: "bool", about: "tomatoes in a market crate; default past 9" },
      price: { type: "text", about: "tomatoes: a price card stuck in them" },
      label: { type: "text", about: "tea packets: the words on the packet" },
    },
    terms: ["a1-w-yumurta", "a1-w-zeytin", "a1-w-bal", "a1-w-peynir", "a1-w-domates", "a1-w-balik", "a2-w-simit", "a1-w-su"],
    tags: ["food"],
  } };

export const PROPS: Record<string, PieceDef> = { food, tea, plate: plateP, cake: cakeP, candle: candleP, cutlery, jar: jarP, bowl };

/** The family's set pieces and props (`index.ts`). */
export const set: Record<string, PieceDef> = {};
export const props = PROPS;
