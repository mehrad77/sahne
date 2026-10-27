// Patterns: prints a garment can wear (`Garment.pattern` and its `inks`). A print is flat (no rim,
// no shadow), lies straight on the garment's ground shape and inside its outline, so it never
// changes a silhouette; the folds, shade, collars and buttons a part draws after it lie on top.
// All-over prints are a `Tile` (one `<pattern>` in SVG, one fill per ink on a canvas); a border or
// a placed print is a few shapes clipped to the outline (`Shape.clip`).
//
// THE API FOR A PART (see `printed` and `stripPrint`): after the ground shape of a piece, add
//   ...printed(ctx, groundPath, { hem })
// where `hem` is the y of the garment's bottom edge in the piece's space (the print counts its
// rows up from it); x = 0 is the centre line (the spine on the back), so front and back match at
// the side seams. Sleeves and trouser legs are strips: spread `stripPrint(ctx)` into their
// `StripSpec` (only crosswise stripes reach a strip; other prints leave limbs plain). List the
// patterns a part takes in `PartDef.patterns` (ids of `PATTERNS` whose `slots` include its slot).
//
// Sizes are centimetres of the real cloth: children's prints are smaller (`printScale`), and
// nothing is stretched with the body: a wider body shows more repeats. Inks: the document's, else
// derived from the ground (`inksOf`), so a print always reads at 48 px.

import { mix, luma, rect, ellipse, smooth, poly, Path, type Box, type Build, type Group, type PartCtx, type PatternDef, type Shape, type StripSpec, type Tile, type Vec2 } from "sahne";
import { nm } from "./palette.ts";
import { unlocksOf } from "./curation.ts";

/** A pattern as the kit knows it: the engine's metadata plus where it goes and how it reaches limbs. */
export interface Pattern extends PatternDef {
  /** The slots whose parts may offer it. */
  slots: string[];
  /** A repeat over the whole garment, a band along its edge, or fades placed on it. */
  layout: "all-over" | "border" | "placed";
  /** Sleeves and legs: crosswise stripes (`stripPrint`), or the plain ground. */
  strips: "stripes" | "ground";
  /** Suggested colour sets: [ground, ink A, ink B]. */
  presets: string[][];
}

const ALL_SLOTS = ["top", "dress", "bottom", "outer", "neck", "head", "waist", "carry", "shoes", "hat"];
const LOCK = unlocksOf("pattern");
const def = (id: string, en: string, tr: string, p: Omit<Pattern, "names" | "unlock">): Pattern => ({ names: nm(en, tr), ...p, ...(LOCK[id] ? { unlock: LOCK[id] } : {}) });

export const PATTERNS: Record<string, Pattern> = {
  pat_stripe_h: def("pat_stripe_h", "Horizontal stripes", "yatay çizgili", { inks: 1, slots: ALL_SLOTS, layout: "all-over", strips: "stripes", presets: [["fab_02", "fab_03"], ["fab_01", "fab_12"], ["fab_10", "fab_04"]] }),
  pat_check: def("pat_check", "Checks", "kareli", { inks: 1, slots: ALL_SLOTS, layout: "all-over", strips: "ground", presets: [["fab_01", "fab_14"], ["fab_02", "fab_08"], ["fab_01", "fab_04"]] }),
  pat_gingham: def("pat_gingham", "Gingham", "pötikare", { inks: 1, slots: ["top", "dress", "bottom", "waist", "neck", "head", "carry", "hat"], layout: "all-over", strips: "ground", presets: [["fab_01", "fab_23"], ["fab_01", "fab_03"], ["fab_02", "fab_09"]] }),
  pat_dots: def("pat_dots", "Polka dots", "puantiyeli", { inks: 1, slots: ALL_SLOTS, layout: "all-over", strips: "ground", presets: [["fab_01", "fab_04"], ["fab_14", "fab_01"], ["fab_02", "fab_20"]] }),
  pat_floral: def("pat_floral", "Floral print", "çiçekli", { inks: 2, slots: ["top", "dress", "bottom", "outer", "neck", "head", "waist", "carry", "hat"], layout: "all-over", strips: "ground", presets: [["fab_01", "fab_14", "fab_09"], ["fab_04", "fab_15", "fab_07"], ["fab_02", "fab_12", "fab_08"]] }),
  pat_denim: def("pat_denim", "Washed denim", "yıkamalı kot", { inks: 1, slots: ["bottom", "top", "outer", "dress"], layout: "placed", strips: "ground", presets: [["fab_03"], ["fab_05"], ["fab_04"], ["fab_22"]] }),
  pat_kilim_band: def("pat_kilim_band", "Kilim band", "kilim şeridi", { inks: 2, slots: ["bottom", "dress", "outer", "neck", "waist", "carry"], layout: "border", strips: "ground", presets: [["fab_20", "fab_12", "fab_02"], ["fab_04", "fab_14", "fab_10"], ["fab_09", "fab_02", "fab_12"]] }),
  pat_iznik_tulip: def("pat_iznik_tulip", "İznik tulips", "İznik lalesi", { inks: 2, slots: ["top", "dress", "neck", "head", "waist", "bottom", "carry", "hat"], layout: "all-over", strips: "ground", presets: [["fab_01", "fab_14", "fab_33"], ["fab_02", "fab_49", "fab_38"], ["fab_33", "fab_01", "fab_14"]] }),
};

/** The patterns that may go on a slot: what a part of that slot lists in `patterns` (the kit tests check it). */
export const patternsFor = (slot: string): string[] => Object.keys(PATTERNS).filter(id => PATTERNS[id].slots.includes(slot));

/** How big a print is drawn on a build: children's prints are smaller. */
export const printScale = (build: Build): number => (build === "toddler" ? 0.65 : build === "child" ? 0.8 : 1);

// a light and a dark cloth to derive inks from (fab_01, fab_22)
const LIGHT = "#F7F3EA", DARK = "#26272C";

/**
 * A pattern's two inks as hex: the document's where it gives them, else derived from the ground by
 * one rule (ink A contrasts with the ground, ink B sits between them), with a few prints keeping
 * their own defaults (green leaves, İznik red and cobalt, the faded denim).
 */
export function inksOf(id: string, ground: string, given: string[] = []): [string, string] {
  const light = luma(ground) > 0.5;
  let a = mix(ground, light ? DARK : LIGHT, 0.6), b = mix(ground, a, 0.5);
  if (id === "pat_floral") b = light ? "#4E7A68" : "#9CD3C0";
  else if (id === "pat_denim") a = mix(ground, LIGHT, 0.3);
  else if (id === "pat_iznik_tulip") [a, b] = luma(ground) > 0.45 ? ["#D9534A", "#1F5FC0"] : [LIGHT, "#D9534A"];
  else if (id === "pat_kilim_band") [a, b] = light ? ["#C4553A", "#2E3A59"] : ["#E0A83A", "#F0E2C8"];
  return [given[0] ?? a, given[1] ?? (given[0] && id !== "pat_floral" && id !== "pat_iznik_tulip" && id !== "pat_kilim_band" ? mix(ground, given[0], 0.5) : b)];
}

export interface PrintOptions {
  /** The ground colour (hex): the garment's colour under the print. */
  ground: string;
  /** The inks (hex) the document gives; missing ones are derived from the ground. */
  inks?: string[];
  /** Size of the print: 1 for adults, `printScale(build)`. */
  scale?: number;
  /** The y of the garment's bottom edge in the piece's space: rows count up from it, a border runs along it. Default: the bottom of the outline. */
  hem?: number;
  /** The x of the centre line (default 0). */
  cx?: number;
  /** Placed prints (denim): where the fades go, in the piece's space. Default: two spots on the lower half. */
  spots?: Vec2[];
}

/** What a print function gets: the outline it is cut to, its box, the scale, origin and the colours. */
interface Lay { outline: Path; box: Box; k: number; hem: number; cx: number; ground: string; a: string; b: string; spots?: Vec2[] }

/** The flat shapes of a pattern on a garment piece, to add right after the piece's ground shape. Unknown or no pattern: none. */
export function patternShapes(id: string | null | undefined, outline: Path, o: PrintOptions): Shape[] {
  if (!id || !Object.hasOwn(PRINTS, id)) return [];
  const box = outline.bounds(), [a, b] = inksOf(id, o.ground, o.inks);
  if (!box.every(Number.isFinite)) return [];
  return PRINTS[id]({ outline, box, k: Math.max(0.3, o.scale ?? 1), hem: o.hem ?? box[3], cx: o.cx ?? 0, ground: o.ground, a, b, spots: o.spots });
}

/** The print of a part's own pattern on one of its pieces (the ground is its first colour, the scale its build's). */
export function printed(ctx: Pick<PartCtx, "pattern" | "inks" | "colors" | "body">, outline: Path, o: Partial<PrintOptions> = {}): Shape[] {
  if (!ctx.pattern) return [];
  return patternShapes(ctx.pattern, outline, { ground: ctx.colors[0] ?? "#888888", inks: ctx.inks, scale: printScale(ctx.body.build), ...o });
}

/**
 * The stripes a part's pattern puts on its sleeves and legs, to spread into a `StripSpec`
 * (`{ ...spec, ...stripPrint(ctx) }`); nothing for other prints. A strip's stripes start where it
 * starts, so the band is the ink and the stripes are the ground: the round shoulder stays the
 * garment's colour and the first ink band comes after a gap, as on the torso above the hem.
 */
export function stripPrint(ctx: Pick<PartCtx, "pattern" | "inks" | "colors" | "body">): Partial<Pick<StripSpec, "stripes" | "color">> {
  const id = ctx.pattern;
  if (!id || PATTERNS[id]?.strips !== "stripes") return {};
  const ground = ctx.colors[0] ?? "#888888", k = printScale(ctx.body.build), [a] = inksOf(id, ground, ctx.inks);
  return { color: a, stripes: [ground, 2.6 * k, 1.5 / 2.6] };
}

/** A swatch of a pattern for a builder or a sheet: a rounded square of the ground with the print, `w` × `h` cm. */
export function patternSwatch(id: string, ground: string, inks: string[] = [], w = 12, h = 12, scale = 1): Group {
  const base = rect(-w / 2, -h, w, h);
  return { shapes: [{ path: base, fill: ground }, ...patternShapes(id, base, { ground, inks, scale, hem: 0 })], edge: 0.3 };
}

// ---- the prints ------------------------------------------------------------------------------------

/** A repeat over the whole outline. */
const tiled = (outline: Path, tile: Tile): Shape[] => [{ path: outline, tile, flat: true }];
/** Shapes cut to the outline, flat. */
const cutTo = (outline: Path, parts: [Path, string][]): Shape[] => parts.filter(([p]) => p.cmds.length).map(([path, fill]) => ({ path, fill, flat: true, clip: outline }));

/**
 * The shapes of a tile whose motifs sit on a lattice: each motif is placed at every lattice point
 * near the tile, so one cut by the tile's edge is still whole (an SVG pattern clips at its edge).
 * `motif(x, y)` returns its paths per ink, in drawing order.
 */
function motifTile(w: number, h: number, lattice: Vec2[], reach: number, motif: (x: number, y: number) => Path[], fills: string[]): Shape[] {
  const inks = fills.map(() => new Path());
  for (const [lx, ly] of lattice) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const x = lx + i * w, y = ly + j * h;
    if (x + reach < 0 || x - reach > w || y + reach < 0 || y - reach > h) continue;
    motif(x, y).forEach((p, n) => inks[n].add(p));
  }
  return inks.map((path, n) => ({ path, fill: fills[n], flat: true }));
}

/** A stepped diamond (a kilim's lozenge) as one staircase outline on a module `m`, `n` steps from the middle to a tip. */
function stepDiamond(cx: number, cy: number, n: number, m: number): Path {
  const right: Vec2[] = [];
  for (let r = -n; r < n; r++) { const half = (r < 0 ? n + r + 1 : n - r) * m; right.push([cx + half, cy + r * m], [cx + half, cy + (r + 1) * m]); }
  return poly([...right, ...[...right].reverse().map(([x, y]): Vec2 => [2 * cx - x, y])]);
}

/** A stepped triangle of `n` rows of module `m`, its base on y = `y0`, pointing up (`dir` -1) or down (1). */
function stepTriangle(cx: number, y0: number, n: number, m: number, dir: 1 | -1): Path {
  const right: Vec2[] = [];
  for (let r = 0; r < n; r++) { const half = (n - r) * m * 0.5; right.push([cx + half, y0 + dir * r * m], [cx + half, y0 + dir * (r + 1) * m]); }
  return poly([...right, ...[...right].reverse().map(([x, y]): Vec2 => [2 * cx - x, y])]);
}

/** A teardrop leaf from (x, y) along the angle `a` (radians, 0 = right, y down): `len` long, `wid` wide. */
function leaf(x: number, y: number, a: number, len: number, wid: number, teeth = 0): Path {
  const c = Math.cos(a), s = Math.sin(a), P = (u: number, v: number): Vec2 => [x + c * u - s * v, y + s * u + c * v];
  const side: Vec2[] = [];
  // one edge serrated (a saz leaf) when `teeth` > 0
  for (let i = 1; i < 5; i++) { const u = len * i / 5, v = wid / 2 * Math.sin(Math.PI * i / 5); side.push(P(u, v + (teeth && i % 2 ? teeth : 0))); }
  return smooth([P(0, 0), ...side, [...P(len, 0), 0] as [number, number, number], ...[1, 2, 3, 4].map(i => P(len * (5 - i) / 5, -wid / 2 * Math.sin(Math.PI * (5 - i) / 5)))], true, 1);
}

const PRINTS: Record<string, (l: Lay) => Shape[]> = {
  // 1.1 cm bands every 2.6 cm, a gap at the hem, front and back in one phase
  pat_stripe_h: ({ outline, k, hem, a }) => {
    const h = 2.6 * k, w = 24;
    return tiled(outline, { w, h, x: 0, y: hem, shapes: [{ path: rect(-0.05, 0, w + 0.1, 1.1 * k), fill: a, flat: true }] });
  },
  // a woven check of opaque bands: single bands half-way to the ink, the crossings the ink
  pat_check: ({ outline, k, hem, cx, ground, a }) => {
    const t = 3.2 * k, band = 1.6 * k, half = mix(ground, a, 0.5);
    return tiled(outline, { w: t, h: t, x: cx - band / 2, y: hem - band / 2, shapes: [
      { path: rect(-0.02, 0, t + 0.04, band), fill: half, flat: true }, { path: rect(0, -0.02, band, t + 0.04), fill: half, flat: true }, { path: rect(0, 0, band, band), fill: a, flat: true },
    ] });
  },
  pat_gingham: ({ outline, k, hem, cx, ground, a }) => {
    const t = 1.4 * k, band = 0.7 * k, half = mix(ground, a, 0.5);
    return tiled(outline, { w: t, h: t, x: cx - band / 2, y: hem - band / 2, shapes: [
      { path: rect(-0.02, 0, t + 0.04, band), fill: half, flat: true }, { path: rect(0, -0.02, band, t + 0.04), fill: half, flat: true }, { path: rect(0, 0, band, band), fill: a, flat: true },
    ] });
  },
  // half-drop dots, a column on the centre line
  pat_dots: ({ outline, k, hem, cx, a }) => {
    const t = 3.2 * k, r = 0.55 * k, q = t / 4;
    const dots = new Path().add(ellipse(q, q, r)).add(ellipse(3 * q, 3 * q, r));
    return tiled(outline, { w: t, h: t, x: cx - q, y: hem - q, shapes: [{ path: dots, fill: a, flat: true }] });
  },
  // two five-petal flowers per tile, leaves in ink B, never a flower cut on the centre line
  pat_floral: ({ outline, k, hem, cx, ground, a, b }) => {
    const t = 5.6 * k, q = t / 4;
    const shapes = motifTile(t, t, [[q, q], [3 * q, 3 * q]], 2.6 * k, (x, y) => {
      const petals = new Path();
      for (let i = 0; i < 5; i++) { const ang = -Math.PI / 2 + i * Math.PI * 2 / 5; petals.add(ellipse(x + Math.cos(ang) * 0.85 * k, y + Math.sin(ang) * 0.85 * k, 0.75 * k)); }
      const leaves = new Path().add(leaf(x + 1.1 * k, y + 0.9 * k, 0.7, 2 * k, 0.8 * k)).add(leaf(x - 1.1 * k, y + 0.9 * k, Math.PI - 0.7, 2 * k, 0.8 * k));
      return [leaves, petals, ellipse(x, y, 0.35 * k)];
    }, [b, a, ground]);
    return tiled(outline, { w: t, h: t, x: cx + q * 0.5, y: hem - q, shapes });
  },
  // fades placed on the garment: nested flat ovals (a mid and a lighter tone) at the given spots
  pat_denim: ({ outline, box, k, hem, cx, ground, a, spots }) => {
    const w = box[2] - box[0], top = box[1], h = hem - top;
    const at: Vec2[] = spots ?? [[cx - w * 0.22, top + h * 0.62], [cx + w * 0.22, top + h * 0.62]];
    const mid = new Path(), lite = new Path(), rx = Math.min(w * 0.16, 6 * k), ry = Math.min(h * 0.3, 9 * k);
    for (const [x, y] of at) { mid.add(ellipse(x, y, rx, ry)); lite.add(ellipse(x - rx * 0.1, y - ry * 0.08, rx * 0.6, ry * 0.62)); }
    return cutTo(outline, [[mid, mix(ground, a, 0.5)], [lite, a]]);
  },
  // a woven band along the hem: lines, stepped lozenges, triangles between them and a wolf-mouth
  // edge; a tile one band tall that repeats across (and once in a metre down, so only one band shows)
  pat_kilim_band: ({ outline, k, hem, cx, ground, a, b }) => {
    const tw = 4.8 * k, bh = 5 * k, m = 0.4 * k, H = 1000, bottom = H / 2, top = bottom - bh, mid = (top + bottom) / 2, x = tw / 2, line = 0.35 * k;
    const inkA = new Path(), inkB = new Path();
    inkB.add(rect(-0.02, top, tw + 0.04, line)).add(rect(-0.02, bottom - line, tw + 0.04, line));
    inkA.add(stepDiamond(x, mid, 5, m));
    // stepped triangles between the lozenges (on the tile's edges, whole in each neighbour), hanging from the top line and standing on the bottom one
    for (const ex of [0, tw]) inkA.add(stepTriangle(ex, top + line, 3, m, 1)).add(stepTriangle(ex, bottom - line, 3, m, -1));
    inkB.add(stepDiamond(x, mid, 3, m));
    // the kurtağzı: a row of teeth under the lower line
    const tooth = tw / 6, teeth: Vec2[] = [[0, bottom]];
    for (let j = 0; j < 6; j++) teeth.push([(j + 0.5) * tooth, bottom + tooth * 0.8], [(j + 1) * tooth, bottom]);
    inkB.add(poly(teeth));
    const shapes: Shape[] = [{ path: inkA, fill: a, flat: true }, { path: inkB, fill: b, flat: true }, { path: stepDiamond(x, mid, 1, m), fill: ground, flat: true }];
    return tiled(outline, { w: tw, h: H, x: cx - tw / 2, y: hem - 1.2 * k - bottom, shapes });
  },
  // an upright tulip with saz leaves and a carnation, half-drop on an 8 cm tile
  pat_iznik_tulip: ({ outline, k, hem, cx, a, b }) => {
    const t = 8 * k, q = t / 4;
    const shapes = motifTile(t, t, [[q, 3 * q], [3 * q, q]], 3.6 * k, (x, y) => {
      const stem = new Path().add(rect(x - 0.15 * k, y - 1.6 * k, 0.3 * k, 2.6 * k))
        .add(leaf(x, y + 0.6 * k, -2.3, 4 * k, 0.9 * k, 0.25 * k)).add(leaf(x, y + 0.6 * k, -0.84, 4 * k, 0.9 * k, 0.25 * k));
      const tulip = new Path()
        .add(smooth([[x, y - 3.4 * k, 0], [x + 0.5 * k, y - 2.4 * k], [x + 0.45 * k, y - 1.3 * k], [x, y - 1.0 * k], [x - 0.45 * k, y - 1.3 * k], [x - 0.5 * k, y - 2.4 * k]], true, 1))
        .add(smooth([[x - 1.1 * k, y - 3.0 * k, 0], [x - 0.3 * k, y - 2.0 * k], [x - 0.2 * k, y - 1.1 * k], [x - 0.9 * k, y - 1.3 * k], [x - 1.2 * k, y - 2.2 * k]], true, 1))
        .add(smooth([[x + 1.1 * k, y - 3.0 * k, 0], [x + 1.2 * k, y - 2.2 * k], [x + 0.9 * k, y - 1.3 * k], [x + 0.2 * k, y - 1.1 * k], [x + 0.3 * k, y - 2.0 * k]], true, 1))
        .add(ellipse(x + 1.7 * k, y - 0.5 * k, 0.5 * k));
      return [stem, tulip];
    }, [b, a]);
    return tiled(outline, { w: t, h: t, x: cx - q, y: hem - t, shapes });
  },
};
