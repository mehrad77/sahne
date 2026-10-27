// Props of the clothes family (STYLE.md): garments, footwear, jewellery and what is in a pocket. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { Path, smooth, ellipse, rect, rrect, poly, band, tone, mix, mul, rotate, scale, translate, groupBounds, type Affine, type FlatSpec, type Kit, type PieceDef, type PieceOut, type Shape, type TextSpec, type Tile, type Vec2 } from "sahne";
import { S, L, num, str, holed, type Pt } from "./draw.ts";

const DARK = "#2E2F35", STEEL = "#B8BEC4", GOLD = "#E0B03C", WOOD = "#B98A57", CREAM = "#F3EBD8", WHITE = "#F7F3EA";
/** Colours a story names in Turkish. */
const TR: Record<string, string> = { kırmızı: "#C8283A", pembe: "#E8799A", beyaz: "#F6F1E4", sarı: "#F2C230", turuncu: "#EE8A2E", mor: "#7B4FB3", mavi: "#3F74C4", yeşil: "#3E8E4E", siyah: "#232326", bordo: "#7A1F35", lacivert: "#2E3A59", gri: "#9AA0A6", kahverengi: "#6B4A35", bej: "#D8C3A0" };

// ---- helpers --------------------------------------------------------------------------------------------

const col = (kit: Kit, v: unknown, d: string) => typeof v === "string" ? TR[v] ?? kit.color(v, d) : d;
const cnt = (v: unknown, d: number) => Math.max(1, Math.min(24, Math.round(num(v, d))));
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Paint printed on the paper (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a strap, a chain, a wire. */
const R = (pts: Pt[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Stitching: a dashed printed line. */
const stitch = (pts: Pt[], color: string, w = 0.3): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width: w, dash: [0.9, 0.7] }, flat: true, opacity: 0.9 });
const tiled = (path: Path, tile: Tile, op = 1): Shape => ({ path, tile, flat: true, opacity: op });
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(); return [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** `n` things `w` wide side by side, `gap` apart, centred; `f(x, i)` draws each. */
const row = (n: number, w: number, gap: number, f: (x: number, i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => f(-(n * w + (n - 1) * gap) / 2 + w / 2 + i * (w + gap), i)).flat();
/** `n` things in rows of up to `per`, the back rows drawn first and raised by `lift`. */
const grid = (n: number, w: number, gap: number, per: number, lift: number, f: (x: number, i: number) => Shape[]): Shape[] => {
  const out: Shape[] = [];
  for (let r = Math.ceil(n / per) - 1; r >= 0; r--) out.push(...mv(row(Math.min(per, n - r * per), w, gap, (x, i) => f(x, r * per + i)), 0, -r * lift));
  return out;
};
/** `n` things hanging from one hand, each drawn from the origin, fanned a little so they stay countable. */
const fan = (n: number, f: (i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => T(f(i), rotate((i - (n - 1) / 2) * Math.min(0.3, 0.9 / n)))).flat();
/** A prop of one flat (`id`), its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.45): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(ppcm, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}
/** A closed smooth outline. */
const sm = (pts: Pt[], k = 1) => smooth(pts, true, k);
/** An outline from its left half (x < 0, top to bottom), mirrored. */
const sym = (h: Pt[]): Pt[] => [...h, ...[...h].reverse().map(q => ((q as number[])[2] === 0 ? [-q[0], q[1], 0] : [-q[0], q[1]]) as Pt)];
/** Diagonal stripes, a tile. */
const diag = (c: string): Tile => ({ w: 5, h: 5, shapes: [S(poly([[0, 2], [2, 0], [3.4, 0], [0, 3.4]]), c), S(poly([[2, 5], [5, 2], [5, 3.6], [3.6, 5]]), c)] });
/** Ribbing, a tile. */
const ribs = (c: string): Tile => ({ w: 1.5, h: 1.5, shapes: [S(rect(0, 0, 0.5, 1.5), tone(c, "deep"))] });
/** Knitted stitches: rows of small V's, printed. */
const knit = (o: Path, c: string): Shape => tiled(o, { w: 1.6, h: 1.3, shapes: [S(poly([[0.2, 0], [0.8, 0.95], [1.4, 0], [1.4, 0.3], [0.8, 1.25], [0.2, 0.3]]), tone(c, "deep"))] }, 0.35);
/** The grip: a hook's top, cm above the hook's foot. */
const HOOK = 9.4;
/** A hook over a hanging thing whose top is at y = t: the foot at t − 1, the curl to the left. */
const hook = (t: number): Shape => R([[0, t - 1], [0, t - 4.5], [-0.8, t - 8], [-3.6, t - HOOK], [-5.8, t - 7.6]], STEEL, 0.9);
/** A wooden hanger whose shoulder line is at y = t, `w` cm to each arm's end. */
const hanger = (t: number, w: number): Shape[] => [hook(t), R([[-w, t + 5.5], [-w * 0.5, t + 1.4], [0, t - 1.6], [w * 0.5, t + 1.4], [w, t + 5.5]], WOOD, 1.5)];
/** A clip hanger holding things by their top edges at y = t, clips at x = ±cx. */
const clips = (t: number, cx: number): Shape[] => [hook(t - 2.6), R([[-cx - 2, t - 2.6], [cx + 2, t - 2.6]], STEEL, 1.1), ...[-cx, cx].map(x => S(rrect(x - 2, t - 3.4, 4, 7, 1), DARK))];

// ---- garments --------------------------------------------------------------------------------------------

/** A top: half width W, length H from the shoulder, sleeve length sl; `neck`; the rest are details. */
interface TK { W: number; H: number; sl: number; neck: string; rib?: number; knit?: 1; x?: 1; bt?: number; pk?: number; stripes?: 1; tie?: string; cuff?: 1; f?: number; yoke?: 1; crest?: 1; dbl?: 1; belt?: 1 }
const TOPS: Record<string, TK> = {
  shirt: { W: 26, H: 72, sl: 60, neck: "collar", bt: 7, pk: 1, cuff: 1 },
  tshirt: { W: 26, H: 68, sl: 22, neck: "crew" },
  sweater: { W: 28, H: 64, sl: 58, neck: "crew", rib: 6, knit: 1, x: 1, yoke: 1 },
  cardigan: { W: 28, H: 66, sl: 58, neck: "vee", rib: 6, knit: 1, x: 1, bt: 5, pk: 2 },
  jacket: { W: 28, H: 72, sl: 62, neck: "lapel", pk: 3, bt: 2, f: 1 },
  uniform: { W: 27, H: 70, sl: 60, neck: "lapel", pk: 4, bt: 2, tie: "#C8283A", crest: 1, f: 1 },
  coat: { W: 30, H: 108, sl: 66, neck: "coat", bt: 4, pk: 3, f: 5, dbl: 1, belt: 1 },
  suit: { W: 28, H: 72, sl: 62, neck: "lapel", pk: 3, bt: 2, tie: "#7A1F35", f: 1 },
  pyjamas: { W: 26, H: 66, sl: 56, neck: "collar", bt: 5, pk: 1, stripes: 1, cuff: 1 },
  raincoat: { W: 29, H: 94, sl: 62, neck: "hood", bt: 6, pk: 3, f: 4 },
};

/** The neck of a top whose shoulder line is at y = t. */
function neck(c: string, k: TK, t: number): Shape[] {
  const sd = tone(c, "shade"), dp = tone(c, "deep"), lg = tone(c, "light");
  const crew = (rim: string): Shape[] => [S(ellipse(0, t + 0.2, 6.8, 3.8), dp), S(holed(ellipse(0, t + 1.2, 8.2, 5.6), [ellipse(0, t + 0.2, 6.4, 3.6)]), rim, { evenodd: true })];
  if (k.neck === "crew") return crew(sd);
  if (k.neck === "vee") return [S(poly([[-8.4, t - 0.4], [8.4, t - 0.4], [0, t + 13]]), dp), R([[-8.4, t - 0.2, 0], [0, t + 13, 0], [8.4, t - 0.2, 0]], sd, 1.4)];
  if (k.neck === "collar") return [S(sm([[-7.6, t + 0.6, 0], [-8.2, t - 2.6], [0, t - 4], [8.2, t - 2.6], [7.6, t + 0.6, 0]]), sd), S(poly([[-6.5, t], [6.5, t], [0, t + 9]]), dp), S(poly([[-0.6, t + 2.6], [-7.4, t - 2.6], [-10, t + 8.6], [-2, t + 9.4]]), lg), S(poly([[0.6, t + 2.6], [7.4, t - 2.6], [10, t + 8.6], [2, t + 9.4]]), lg)];
  if (k.neck === "coat") { const lf: Vec2[] = [[-0.4, t + 9], [-9.2, t - 4], [-15.5, t + 10], [-12.4, t + 22], [-3.4, t + 20]]; return [S(sm([[-9, t + 1, 0], [-9.5, t - 3.5], [0, t - 5], [9.5, t - 3.5], [9, t + 1, 0]]), sd), S(poly([[-6.5, t], [6.5, t], [0, t + 16]]), dp), S(poly(lf), lg), S(poly(lf.map(q => [-q[0], q[1]] as Vec2)), lg), L([[-4, t + 12], [-12, t + 2]], sd, 0.5, 0.5), L([[4, t + 12], [12, t + 2]], sd, 0.5, 0.5)]; }
  if (k.neck === "lapel") {
    const lp: Vec2[] = [[-7.4, t - 0.5], [-13.5, t + 6], [-11.6, t + 10], [-14, t + 16.5], [-7.5, t + 26], [-0.5, t + 29]], tc = k.tie ?? "";
    return [S(poly([[-7.6, t - 0.4], [7.6, t - 0.4], [0, t + 27]]), CREAM), ...(tc ? [S(poly([[-2.2, t + 1], [2.2, t + 1], [1.8, t + 6], [-1.8, t + 6]]), tc), S(poly([[-1.7, t + 6], [1.7, t + 6], [3.2, t + 22], [0, t + 26], [-3.2, t + 22]]), tc), F(rect(-3, t + 11, 6, 1.4), CREAM, 0.7)] : []), S(poly(lp), lg), S(poly(lp.map(q => [-q[0], q[1]] as Vec2)), lg)];
  }
  return [S(sm([[-12.5, t + 3, 0], [-14, t - 5], [-8, t - 11.5], [0, t - 12.5], [8, t - 11.5], [14, t - 5], [12.5, t + 3, 0]]), sd), ...crew(lg), R([[-4.4, t + 5], [-4.8, t + 11]], dp, 0.5), R([[4.4, t + 5], [4.8, t + 11]], dp, 0.5), S(ellipse(-4.8, t + 11.6, 0.9), STEEL), S(ellipse(4.8, t + 11.6, 0.9), STEEL)];
}

/** A top, folded (lying as in a shop) or hung on a hanger; the hem at y = 0. */
function top(c: string, k: TK, hung: boolean): Shape[] {
  const { W, H } = k, sd = tone(c, "shade"), dp = tone(c, "deep"), lg = tone(c, "light"), sh = W - 3, t = hung ? -H : -Math.round(H * 0.58), hw = hung ? W : Math.round(W * 1.18) / 2, f = k.f ?? 0;
  const body = hung ? smooth(sym([[-7.5, t, 0], [-sh, t + 4.5, 0], [-W, t + 22, 0], [-W - f, 0, 0]]), true, 1) : rrect(-hw, t, hw * 2, -t, 1.2);
  const out: Shape[] = hung ? hanger(t, 20) : [];
  const print = (p: Path, st = 1): Shape[] => [...(k.stripes ? [tiled(p, { w: 6, h: 6, shapes: [S(rect(0, 0, 2.4, 6), mix(c, WHITE, 0.75))] }, 0.9)] : []), ...(k.knit && st ? [knit(p, c)] : [])];
  if (!hung && k.sl < 30) for (const d of [-1, 1]) out.push(S(rrect(d * hw - 3, t + 2, 6, 11, 2.5), c));
  out.push(S(body, c), ...lit(body, c), ...print(body));
  if (k.rib) { const rb = rect(-hw, -k.rib, hw * 2, k.rib); out.push(F(rb, sd, 0.9, body), tiled(rb, ribs(c), 0.7)); }
  if (k.yoke) out.push(tiled(rect(-hw + 2, t + 16, hw * 2 - 4, 7.5), { w: 2.6, h: 2.6, shapes: [S(poly([[1.3, 0.2], [2.4, 1.3], [1.3, 2.4], [0.2, 1.3]]), CREAM)] }, 0.85), F(rect(-hw + 2, t + 15.4, hw * 2 - 4, 0.6), CREAM, 0.8), F(rect(-hw + 2, t + 23.4, hw * 2 - 4, 0.6), CREAM, 0.8));
  out.push(...neck(c, k, t));
  const bt = k.bt ?? 0, ys = k.neck === "lapel" ? [t + 29, t + 40] : k.dbl ? Array.from({ length: bt }, (_, i) => t + 26 + i * Math.min(14, (-t - 36) / (bt - 1))) : Array.from({ length: bt }, (_, i) => t + (k.neck === "vee" ? 15 : 12) + i * (-t - (k.rib ?? 0) - (k.neck === "vee" ? 22 : 18)) / Math.max(1, bt - 1));
  if (bt) {
    if (k.neck === "lapel" || k.dbl) out.push(L([[0, t + 28], [0, -f]], sd, 0.7, 0.5));
    else out.push(k.neck === "vee" ? F(rect(-2, t + 11, 4, -t - 11 - (k.rib ?? 0)), sd, 0.85, body) : L([[0, t + 9], [0, 0]], sd, 0.7, 0.5));
    for (const y of ys) for (const x of k.dbl ? [-4.5, 4.5] : [0]) out.push(F(ellipse(x, y, 0.95), CREAM), F(ellipse(x, y, 0.35), tone(CREAM, "deep"), 0.8));
  }
  if (hung && k.belt) out.push(S(rrect(-W - 1.5, t + 56, W * 2 + 3, 5, 0.6), dp), S(rrect(-2.6, t + 55.6, 5.2, 5.8, 0.7), GOLD), S(rrect(-1.6, t + 56.8, 3.2, 3.4, 0.4), dp));
  if (hung && k.pk) {
    const pw = poly([[8.2, t + 20], [16.8, t + 20], [16.8, t + 28.5], [12.5, t + 30.5], [8.2, t + 28.5]]);
    if (k.pk === 1 || k.pk === 4) out.push(S(pw, c), L([[8.2, t + 21.4], [16.8, t + 21.4]], sd, 0.5, 0.6));
    if (k.pk === 4) out.push(S(ellipse(12.5, t + 25, 3.1), GOLD), S(ellipse(12.5, t + 25, 2.2), "#8E1F2D"), F(ellipse(12.5, t + 25, 0.9), GOLD));
    if (k.pk === 2) for (const d of [-1, 1]) out.push(S(rrect(d * (W - 11) - 6, -23, 12, 13, 1.5), c), knit(rect(d * (W - 11) - 6, -23, 12, 13), c));
    if (k.pk === 3) for (const d of [-1, 1]) out.push(L([[d * 7, -24], [d * 17, -24]], dp, 0.8, 0.7), S(rrect(d * 12 - 6.5, -25.6, 13, 3.4, 0.7), lg));
    if (k.pk === 3 && k.neck === "lapel") out.push(S(rrect(8, t + 25, 8.6, 1.8, 0.5), lg), S(poly([[9, t + 24.6], [14, t + 22.4], [15.6, t + 24.6]]), CREAM));
  }
  if (!hung && k.crest) out.push(S(ellipse(hw - 7, t + 25, 3.1), GOLD), S(ellipse(hw - 7, t + 25, 2.2), "#8E1F2D"));
  if (!hung && k.x) { const y = t + (-t) * 0.5, sl = rrect(-hw + 1, y, hw * 2 - 2, 9.5, 4.4); out.push(S(sl, c), ...lit(sl, c), knit(sl, c), S(rrect(hw - 8, y, 7, 9.5, 3), sd), tiled(rect(hw - 8, y, 7, 9.5), ribs(c), 0.7)); }
  if (hung) for (const d of [-1, 1]) {
    const e = W + 4.5, a: Vec2 = [d * (sh + 1), t + 6], b: Vec2 = [d * e, t + k.sl], long = k.sl > 30, cw = 8.2;
    const sp = band(long ? [a, [d * ((sh + 1 + e) / 2 + 0.5), (a[1] + b[1]) / 2], b] : [a, b], long ? [13, 10.4, cw] : [13, 11.4]);
    out.push(S(sp, c), ...lit(sp, c, 0.25), ...print(sp), L([a, b], sd, 0.6, 0.4));
    if (long && (k.cuff || k.rib)) {
      const len = k.rib ?? 5.2, u = Math.hypot(b[0] - a[0], b[1] - a[1]), p0: Vec2 = [b[0] - (b[0] - a[0]) / u * len, b[1] - (b[1] - a[1]) / u * len], cf = band([p0, b], [cw, cw]);
      out.push(S(cf, sd), ...(k.rib ? [tiled(cf, ribs(c), 0.7)] : [F(ellipse(b[0] - d * 1.2, b[1] - len / 2 - 0.5, 0.7), CREAM)]));
    }
  }
  return out;
}

/** Trousers (`j`: jeans) from the waist; half waist W, length L, leg width hw at the hem. */
interface BK { W: number; L: number; hw: number; j?: 1 }
const BOTS: Record<string, BK> = { trousers: { W: 19, L: 100, hw: 17 }, jeans: { W: 19, L: 100, hw: 15, j: 1 } };
function legs(c: string, k: BK, hung: boolean): Shape[] {
  const { W } = k, len = hung ? k.L : 34, t = -len, sd = tone(c, "shade"), dp = tone(c, "deep"), lg = tone(c, "light"), st = k.j ? "#E8B04A" : dp, out: Shape[] = [];
  const hw = hung ? W : W * 0.66, wb = rect(-hw - 0.3, t - 0.3, hw * 2 + 0.6, 4.4);
  const detail = (d: number, px: number, ph: number): Shape[] => k.j
    ? [stitch([[d * (px - 6), t + 4.4], [d * (px - 6.8), t + 10], [d * (px - 2), t + 14], [d * (px + 0.5), t + 14.4]], st), S(ellipse(d * (px - 6), t + 4.8, 0.75), GOLD), S(ellipse(d * (px + 0.2), t + 14, 0.75), GOLD), stitch([[d * (px - 1.5), t + 4.4], [d * (px - 1.5), t + 8]], st)]
    : [L([[d * (px - 5), t + 4.4], [d * (px + 0.4), t + ph]], dp, 0.7, 0.6), L([[d * (px - 2), t + 4.4], [d * (px + 1.6), t + ph]], lg, 0.5, 0.4)];
  if (hung) {
    for (const d of [-1, 1]) {
      const o = smooth([[d * W, t, 0], [0, t, 0], [0, t + 27, 0], [d * 1, 0, 0], [d * (1 + k.hw), 0, 0], [d * (W + 0.8), t + 14]], true, 1);
      out.push(S(o, c), ...lit(o, c, 0.3), ...detail(d, W - 0.6, 12), L([[d * (W / 2 + 0.5), t + 6], [d * (1 + k.hw / 2), -1]], k.j ? sd : lg, 0.5, 0.45));
      if (k.j) out.push(F(ellipse(d * (W * 0.45), t + 24, 4.5, 9), lg, 0.3, o), F(ellipse(d * (1 + k.hw / 2), -20, 4, 8), lg, 0.25, o), stitch([[d * (1 + k.hw), -3.2], [d * 1.2, -3.2]], st));
    }
    out.push(S(wb, sd), ...clips(t, 8.5));
  } else {
    const o = rrect(-hw, t, hw * 2, len, 1);
    out.push(S(o, c), ...lit(o, c, 0.2), F(rect(-hw, -4, hw * 2, 4), sd, 0.55, o), L([[-hw * 0.44, t + 5], [-hw * 0.44, -4]], k.j ? sd : lg, 0.5, 0.45), L([[hw * 0.44, t + 5], [hw * 0.44, -4]], k.j ? sd : lg, 0.5, 0.45), ...detail(-1, hw - 0.6, 11), ...detail(1, hw - 0.6, 11), S(wb, sd));
  }
  for (const x of [-0.95, -0.45, 0.45, 0.95]) out.push(S(rect(x * hw - 0.6, t - 0.9, 1.2, 5.2), sd));
  out.push(S(ellipse(0, t + 2.1, 1.2), k.j ? GOLD : tone(c, "light")), k.j ? stitch([[0.4, t + 4.4], [0.4, t + 15], [-1.8, t + 18]], st) : L([[0, t + 4.4], [0, t + 15]], dp, 0.6, 0.5));
  return out;
}

/** A dress, folded or hung; `bridal`: the strapless gown, hung. */
function dress(c: string, hung: boolean, bridal: boolean): Shape[] {
  const H = hung ? (bridal ? 140 : 100) : 44, t = -H, sd = tone(c, "shade"), dp = tone(c, "deep"), lg = tone(c, "light"), out: Shape[] = [], ws = hung ? (bridal ? 34 : 33) : 20;
  if (!hung) {
    const o = rrect(-17, t, 34, H, 1.2);
    out.push(S(o, c), ...lit(o, c), ...(bridal ? [tiled(rect(-17, t, 34, ws), { w: 4, h: 4, shapes: [S(ellipse(1, 1, 0.7), lg), S(ellipse(3, 3, 0.7), lg), S(ellipse(1, 3, 0.25), sd), S(ellipse(3, 1, 0.25), sd)] }, 0.9)] : [tiled(o, { w: 5.5, h: 5.5, shapes: [S(ellipse(1.4, 1.4, 0.75), lg), S(ellipse(4.15, 4.15, 0.75), lg)] }, 0.8)]), S(rect(-16.6, t + ws, 33.2, 3.8), bridal ? mix(c, "#C9A66B", 0.6) : dp), S(sm([[-7, t - 0.5, 0], [-6.5, t + 5], [0, t + 8], [6.5, t + 5], [7, t - 0.5, 0]]), bridal ? lg : dp));
    for (const x of [-9, 0, 9]) out.push(L([[x, t + ws + 4], [x * 1.1, -1]], sd, 0.7, 0.45));
    return out;
  }
  if (bridal) {
    const ring = (x: number, y: number) => F(ellipse(x, y, 0.8), CREAM);
    out.push(...hanger(t - 9, 17), R([[-10.5, t + 3], [-8, t - 4]], CREAM, 0.7), R([[10.5, t + 3], [8, t - 4]], CREAM, 0.7));
    const sk = smooth(sym([[-10.5, t + 30, 0], [-40, 0, 0]]), true, 1), bo = smooth(sym([[-11.6, t + 3, 0], [-12.2, t + 11], [-10.6, t + 24], [-10.4, t + 34, 0]]), true, 1);
    out.push(S(sm([[-11, t + 30, 0], [-50, -1, 0], [50, -1, 0], [11, t + 30, 0]], 1), sd), S(sk, c), ...lit(sk, c, 0.18));
    for (const x of [-26, -14, 0, 14, 26]) out.push(L([[x * 0.3, t + 36], [x, -2]], sd, 0.8, 0.4));
    out.push(S(bo, c), ...lit(bo, c, 0.2), tiled(bo, { w: 4, h: 4, shapes: [S(ellipse(1, 1, 0.7), lg), S(ellipse(3, 3, 0.7), lg), S(ellipse(1, 3, 0.25), sd), S(ellipse(3, 1, 0.25), sd)] }, 0.9));
    out.push(S(sm([[-11.8, t + 4, 0], [-9, t - 0.4], [-5.8, t - 1.4], [-2.5, t + 0.5], [0, t + 3.6, 0], [2.5, t + 0.5], [5.8, t - 1.4], [9, t - 0.4], [11.8, t + 4, 0], [11.8, t + 9, 0], [-11.8, t + 9, 0]]), lg), ring(-8, t + 4), ring(-4, t + 3), ring(4, t + 3), ring(8, t + 4));
    out.push(S(rect(-10.6, t + 32, 21.2, 4.4), mix(c, "#C9A66B", 0.6)), S(sm([[0, t + 34], [-7.5, t + 29.5], [-8.2, t + 38]], 1), mix(c, "#C9A66B", 0.6)), S(sm([[0, t + 34], [7.5, t + 29.5], [8.2, t + 38]], 1), mix(c, "#C9A66B", 0.6)), S(ellipse(0, t + 34, 1.6), mix(c, "#C9A66B", 0.3)));
    return out;
  }
  const body = smooth(sym([[-7, t, 0], [-17, t + 4, 0], [-20.5, t + 14, 0], [-15.5, t + 17, 0], [-14.5, t + ws, 0], [-34, 0, 0]]), true, 1);
  out.push(...hanger(t, 18), S(body, c), ...lit(body, c, 0.22), tiled(body, { w: 5.5, h: 5.5, shapes: [S(ellipse(1.4, 1.4, 0.75), lg), S(ellipse(4.15, 4.15, 0.75), lg)] }, 0.8));
  for (const x of [-22, -12, 0, 12, 22]) out.push(L([[x * 0.4, t + ws + 4], [x, -2]], sd, 0.8, 0.4));
  out.push(F(rect(-34, -3.2, 68, 3.2), sd, 0.55, body), S(rect(-14.7, t + ws - 1, 29.4, 4), dp), S(sm([[0, t + ws + 1], [-5.8, t + ws - 3], [-6.4, t + ws + 4]], 1), dp), S(sm([[0, t + ws + 1], [5.8, t + ws - 3], [6.4, t + ws + 4]], 1), dp), S(sm([[-7, t - 0.5, 0], [-6.5, t + 5], [0, t + 8], [6.5, t + 5], [7, t - 0.5, 0]]), dp));
  return out;
}

/** A headscarf: a patterned square folded in a rectangle, a corner turned; hung, folded over a hanger. */
function scarf(c: string, hung: boolean): Shape[] {
  const w = 24, h = hung ? 44 : 30, o = poly([[-w / 2, -h], [w / 2 - 9, -h], [w / 2, -h + 9], [w / 2, 0], [-w / 2, 0]]), b = tone(c, "deep");
  return [...(hung ? hanger(-h, 11) : []), S(o, c), ...lit(o, c, 0.14),
    tiled(o, { w: 6, h: 6.4, shapes: [S(ellipse(1.5, 2, 1.1, 1.8), tone(c, "light")), S(ellipse(4.6, 5.2, 1, 1.6), mix(c, WHITE, 0.55)), S(ellipse(4.6, 1.2, 0.5), b)] }, 0.9),
    { path: rect(-w / 2 + 1.6, -h + 1.6, w - 3.2, h - 3.2), stroke: { color: b, width: 0.5 }, flat: true, opacity: 0.7, clip: o },
    S(poly([[w / 2 - 9, -h], [w / 2, -h + 9], [w / 2 - 9, -h + 9]]), mix(c, WHITE, 0.4)), L([[w / 2 - 9, -h], [w / 2, -h + 9]], b, 0.6, 0.5),
    ...Array.from({ length: 13 }, (_, i) => L([[-w / 2 + 1 + i * 1.9, -2.6], [-w / 2 + 1 + i * 1.9, 0]], b, 0.3, 0.7))];
}

/** A necktie, knot to tip 56 cm as worn; hung from a hook. */
function tie(c: string, hung: boolean): Shape[] {
  const bl = smooth([[-3.2, -49.5, 0], [3.2, -49.5, 0], [4.8, -14, 0], [0, 0, 0], [-4.8, -14, 0]], true, 1), sd = tone(c, "shade");
  return [...(hung ? [hook(-56)] : []), S(bl, c), ...lit(bl, c, 0.3), tiled(bl, diag(mix(c, WHITE, 0.6)), 0.9), L([[0, -48], [0, -4]], sd, 0.5, 0.3), S(sm([[-2.7, -56, 0], [2.7, -56, 0], [3.9, -49.2], [0, -48.2], [-3.9, -49.2]]), sd), L([[0, -55], [0, -50]], tone(c, "deep"), 0.5, 0.5)];
}

/** A leather belt: coiled on its side, or hung doubled over a hook. */
function belt(c: string, hung: boolean): Shape[] {
  const dp = tone(c, "deep"), buckle = (x: number, y: number): Shape[] => [S(holed(rrect(x - 3.6, y - 3.3, 7.2, 6.6, 1.2), [rrect(x - 2.3, y - 2, 4.6, 4, 0.6)]), STEEL, { evenodd: true }), R([[x, y - 2], [x, y + 1.7]], tone(STEEL, "deep"), 0.6)];
  if (!hung) {
    const r = 13.4, ring = holed(ellipse(0, -r, r), [ellipse(0, -r, 2.6)]);
    return [S(ring, c, { evenodd: true }), ...lit(ring, c, 0.2), ...[10.6, 8, 5.4].map((q): Shape => ({ path: ellipse(0, -r, q), stroke: { color: dp, width: 0.7 }, flat: true, opacity: 0.5 })), { path: ellipse(0, -r, 12.3), stroke: { color: mix(c, CREAM, 0.5), width: 0.3, dash: [0.8, 0.6] }, flat: true, opacity: 0.8 }, ...buckle(9, -4.6)];
  }
  const o = band([[-2.6, -3], [-2.6, -30], [-2.6, -44], [-1.4, -47.4], [0, -48.6], [1.4, -47.4], [2.6, -44], [2.6, -30], [2.6, -3]], Array(9).fill(3.7));
  return [hook(-50.4), S(o, c), ...lit(o, c, 0.2), ...[10, 15, 20, 25].map(y => F(ellipse(2.6, -y, 0.45), dp, 0.8)), stitch([[-4, -3], [-4, -44]], mix(c, CREAM, 0.5)), ...buckle(-2.6, -2.6)];
}

/** One knitted glove, palm to the viewer, the thumb to side `d`. */
function glove(x: number, d: number, c: string): Shape[] {
  const fing = ([[-3.15, -21], [-1.05, -22.6], [1.05, -21.3], [3.15, -18.5]] as Vec2[]).map(([fx, ft]) => rrect(x + fx - 1.05, ft, 2.1, -12 - ft, 1.05));
  const p = fing.reduce((a, f) => a.add(f), rrect(x - 4.2, -17, 8.4, 12.6, 2)).add(rrect(-1.15, -8.4, 2.3, 8.4, 1.15).transform(mul(translate(x + d * 3.9, -8.5), rotate(d * 0.8)))), cf = rrect(x - 4.5, -5.6, 9, 5.6, 1.2);
  return [S(p, c), ...lit(p, c, 0.22), knit(p, c), ...[-2.1, 0, 2.1].map(q => L([[x + q, -13], [x + q, -17.5]], tone(c, "deep"), 0.35, 0.5)), S(cf, tone(c, "shade")), tiled(cf, ribs(c), 0.7)];
}
/** A pair of gloves, fingers up; hung by the cuffs from a clip hanger. */
function gloves(c: string, hung: boolean): Shape[] {
  const sh = [...glove(-5.6, -1, c), ...glove(5.6, 1, c)];
  return hung ? [...clips(-22.6, 5.5), ...T(sh, mul(translate(0, -22.6), rotate(Math.PI)))] : sh;
}

/** One sock, toe to the left, in `c` with `c2` at cuff, heel and toe. */
function sock(c: string, c2: string): Shape[] {
  const o = smooth([[0, -26, 0], [8.6, -26, 0], [9, -12], [10, -4], [8, -0.2, 0], [-10, -0.2, 0], [-12.2, -1.8], [-12.2, -5.2], [-9.8, -7.2], [-4, -7.4], [-1.2, -9.6], [0, -14]], true, 1);
  return [S(o, c), ...lit(o, c, 0.2), F(rect(-1, -26.5, 11, 5.6), c2, 1, o), tiled(rect(0, -26, 8.6, 5), ribs(c2), 0.6), F(rect(-1, -17, 11, 1.4), c2, 1, o), F(ellipse(8.4, -3.4, 3, 3.4), c2, 1, o), F(ellipse(-10.4, -3.6, 3, 3.6), c2, 1, o)];
}
/** A pair of socks; hung by the cuffs from a clip hanger. */
function socks(c: string, hung: boolean): Shape[] {
  const c2 = mix(c, WHITE, 0.7);
  return hung ? [...clips(-26, 4.6), ...mv(sock(tone(c, "shade"), c2), 0.3, 0), ...mv(sock(c, c2), -8.9, 0)] : [...mv(sock(tone(c, "shade"), c2), 3.4, -2), ...sock(c, c2)];
}

/** A baseball cap, side on, the visor to the left. */
function cap(c: string, hung: boolean): Shape[] {
  const dome = smooth([[-9, -1.2, 0], [-10, -6], [-6, -11.2], [0, -12.6], [6, -11.4], [10, -6.5], [10.8, -1.2, 0]], true, 1), sd = tone(c, "shade");
  const visor = smooth([[-8.4, -3.4, 0], [-14, -3.8], [-19.6, -2.2], [-20.2, -0.8, 0], [-12, 0.2], [-8, -0.2, 0]], true, 1);
  return [...(hung ? [hook(-13.6)] : []), S(visor, sd), L([[-10, -1.6], [-19, -1.4]], tone(c, "deep"), 0.4, 0.6), S(rrect(9.4, -3.4, 4.2, 2.6, 0.6), sd), S(dome, c), ...lit(dome, c, 0.25), F(rect(-10.6, -2.5, 22, 2.5), sd, 0.8, dome), L([[0.4, -12.4], [-7, -2.6]], sd, 0.45, 0.7), L([[0.4, -12.4], [8, -2.6]], sd, 0.45, 0.7), S(ellipse(0.4, -12.8, 0.9), sd), F(ellipse(-4.4, -8.6, 0.4), DARK, 0.6), F(ellipse(5.4, -8.6, 0.4), DARK, 0.6)];
}

/** A knitted beanie with a turned cuff and a pompom. */
function beanie(c: string, hung: boolean): Shape[] {
  const dome = sm([[-10.5, -1, 0], [-11, -8], [-7, -15], [0, -17.2], [7, -15], [11, -8], [10.5, -1, 0]]), cf = rrect(-11.6, -8, 23.2, 8, 2.4);
  return [...(hung ? [hook(-23.8)] : []), S(dome, c), ...lit(dome, c, 0.25), knit(dome, c), S(cf, c), ...lit(cf, c, 0.2), tiled(cf, ribs(c), 0.7), F(rect(-11.6, -5.2, 23.2, 1.5), CREAM, 0.9, cf), S(ellipse(0, -19.4, 4.4), tone(c, "light")), F(ellipse(1.4, -18.2, 3, 2.6), tone(c, "shade"), 0.35), ...[-2.4, -0.4, 1.6].map(x => L([[x, -22], [x + 0.4, -18]], tone(c, "shade"), 0.3, 0.5))];
}

/** A wide-brimmed straw sun hat with a ribbon. */
function sunHat(c: string, hung: boolean): Shape[] {
  const brim = ellipse(0, -5.6, 21, 6.3), crown = sm([[-9.2, -6, 0], [-9.6, -11.5], [-6, -16], [0, -17.4], [6, -16], [9.6, -11.5], [9.2, -6, 0]]), sd = tone(c, "shade"), rb = "#C8283A", weave = (p: Path) => tiled(p, { w: 1.5, h: 1.5, shapes: [S(rect(0, 0, 1.1, 0.4), sd)] }, 0.5);
  return [...(hung ? [hook(-17.4)] : []), S(brim, c), F(ellipse(0, -4.4, 20.4, 5.4), sd, 0.4, brim), weave(brim), S(crown, c), ...lit(crown, c, 0.25), weave(crown), S(rect(-10, -10.8, 20, 3.6), rb, { clip: crown }), F(rect(-10, -9.1, 20, 0.5), tone(rb, "deep"), 0.5, crown), S(sm([[5.6, -9], [9.4, -12.6], [10.6, -9], [9.4, -5.8]], 1), rb), S(sm([[5.6, -9], [2, -12.4], [1.6, -9], [2.4, -5.8]], 1), rb), S(ellipse(5.6, -9, 1.2), tone(rb, "deep"))];
}

/** Trouser legs hanging `h` cm below a top (a suit's, a pyjama's), or (`fold`) a folded pair behind it. */
const LEGS = (c: string, h: number, stripes: boolean, fold = false): Shape[] => (fold ? [0] : [-1, 1]).flatMap(d => {
  const o = fold ? rrect(-13.3, -h, 26.6, h, 1) : poly([[d * 1, -h], [d * 17.5, -h], [d * 17, 0], [d * 2, 0]]);
  return [S(o, c), ...lit(o, c, 0.3), ...(stripes ? [tiled(o, { w: 6, h: 6, shapes: [S(rect(0, 0, 2.4, 6), mix(c, WHITE, 0.75))] }, 0.9)] : [L([[d * 9.5, 2 - h], [d * 9.5, -1]], tone(c, "light"), 0.5, 0.45)])];
});

/** A pleated skirt: hung by clips from the waistband, or folded. */
function skirt(c: string, hung: boolean): Shape[] {
  const len = hung ? 54 : 34, t = -len, hw = hung ? 15 : 12, hh = hung ? 27 : 13, sd = tone(c, "shade"), o = hung ? poly([[-hw, t], [hw, t], [hh, 0], [-hh, 0]]) : rrect(-hh, t, hh * 2, len, 1);
  return [S(o, c), ...lit(o, c, 0.2), ...Array.from({ length: 11 }, (_, i) => { const u = (i - 5) / 5; return L([[u * hw * 0.9, t + 4], [u * hh * 0.96, -1]], i % 2 ? tone(c, "light") : sd, 0.6, 0.55); }), F(rect(-hh, -2.6, hh * 2, 2.6), sd, 0.5, o), S(rect(-hw - 0.2, t - 0.3, hw * 2 + 0.4, 4.2), sd), S(ellipse(0, t + 1.8, 1), GOLD), ...(hung ? clips(t, 8.5) : [])];
}
/** A knitted scarf with stripes and fringe: folded in a block, or hung doubled over a hook. */
function wool(c: string, hung: boolean): Shape[] {
  const c2 = mix(c, WHITE, 0.7), st: Tile = { w: 4, h: 8, shapes: [S(rect(0, 0, 4, 2.4), c2), S(rect(0, 4, 4, 1.2), c2)] }, fr = (x0: number, x1: number): Shape[] => Array.from({ length: Math.round((x1 - x0) / 1.4) }, (_, i) => R([[x0 + 0.7 + i * 1.4, -0.4], [x0 + 0.9 + i * 1.4, 3.4]], c, 0.5));
  if (!hung) { const o = rrect(-11, -30, 22, 30, 1.5); return [...fr(-11, 11), S(o, c), ...lit(o, c, 0.18), tiled(o, st, 0.9), knit(o, c), F(rect(-11, -2.4, 22, 2.4), tone(c, "shade"), 0.4, o)]; }
  const o = band([[-4.5, -2], [-4.5, -48], [-3, -52], [0, -53.4], [3, -52], [4.5, -48], [4.5, -2]], Array(7).fill(8.8));
  return [hook(-54.4), ...mv(fr(-9, 9), 0, 1.4), S(o, c), ...lit(o, c, 0.2), tiled(o, st, 0.9), knit(o, c), L([[0, -50], [0, -1]], tone(c, "deep"), 0.5, 0.4)];
}

const ACC: Record<string, (c: string, hung: boolean) => Shape[]> = { headscarf: scarf, tie, belt, gloves, socks, cap, beanie, sun_hat: sunHat, skirt, scarf: wool };
function build(kind: string, c: string, hang: boolean): Shape[] {
  if (kind === "trousers" || kind === "jeans") return legs(c, BOTS[kind], hang);
  if (kind === "dress" || kind === "wedding_dress") return dress(c, hang, kind === "wedding_dress");
  if (kind === "suit") return hang ? [...LEGS(c, 38, false), ...mv(top(c, TOPS.suit, true), 0, -36)] : top(c, TOPS.suit, false);
  if (kind === "pyjamas") return hang ? [...LEGS(c, 34, true), ...mv(top(c, TOPS.pyjamas, true), 0, -32)] : [...LEGS(c, 34, true, true), ...mv(top(c, TOPS.pyjamas, false), 0, -6)];
  return TOPS[kind] ? top(c, TOPS[kind], hang) : ACC[kind](c, hang);
}

/** Things a hand pinches at the top (no hanger): a tie, a belt, a hat. */
const PINCH = ["tie", "belt", "cap", "beanie", "sun_hat"];
/** How far below the hand a held thing may reach: about the floor (GRIP, as in misc.ts, less a margin). */
const DROP = 50;
/** A thing folded over the forearm: its folded look hangs from the grip, a darker back fold showing below. */
const draped = (sh: Shape[], c: string): Shape[] => {
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: 0 }), w = x1 - x0, h = y1 - y0;
  return [S(rrect(-w / 2 + 2.5, -1, w - 5, h + 3.5, 2), tone(c, "shade")), ...mv(sh, -(x0 + x1) / 2, -2 - y0)];
};
/** A garment as people carry it, its origin at the grip: folded over the forearm; pinched at the top (tie, belt, hats); gloves and socks by their clip hanger's hook. Shrunk if it would reach the floor. */
function heldLook(kind: string, c: string): Shape[] {
  const pinch = PINCH.includes(kind), hung = pinch || kind === "gloves" || kind === "socks";
  let sh = hung ? build(kind, c, true) : draped(build(kind, c, false), c);
  if (hung) {
    const hk = sh.filter(q => q.stroke?.color === STEEL && q.stroke.width === 0.9), [x0, y0, x1] = groupBounds({ shapes: pinch ? sh.filter(q => !hk.includes(q)) : sh, edge: 0 }), hb = hk[0].path.bounds();
    sh = mv(pinch ? sh.filter(q => !hk.includes(q)) : sh, pinch ? -(x0 + x1) / 2 : 3.6 - hb[2], pinch ? -y0 - 0.4 : -hb[1] - 0.2);
  }
  const d = groupBounds({ shapes: sh, edge: 0 })[3];
  return d > DROP ? T(sh, scale(DROP / d)) : sh;
}

const GK = ["shirt", "sweater", "dress", "jacket", "trousers", "jeans", "tshirt", "pyjamas", "uniform", "raincoat", "headscarf", "tie", "belt", "gloves", "socks", "cap", "beanie", "sun_hat", "cardigan", "suit", "wedding_dress", "coat", "skirt", "scarf"];
const GC: Record<string, string> = { shirt: "#8DB8DA", sweater: "#A23F28", dress: "#2F8C88", jacket: "#3A3D45", trousers: "#5A4A3F", jeans: "#4F6E9E", tshirt: "#E0A83A", pyjamas: "#4F6E9E", uniform: "#2E3A59", raincoat: "#F2C230", headscarf: "#7A3E6E", tie: "#A23F28", belt: "#6B4A35", gloves: "#B3261E", socks: "#2F8C88", cap: "#2E3A59", beanie: "#E8892E", sun_hat: "#E0C07A", cardigan: "#B98A57", suit: "#3A3D45", wedding_dress: "#F7F3EA", coat: "#B98A57", skirt: "#7A3E6E", scarf: "#B3261E" };

/**
 * A garment, `kind`: a shirt, sweater, dress, jacket, trousers, jeans, tshirt, pyjamas (a striped top over striped trousers), uniform (a school blazer
 * with a crest and a tie), raincoat (hooded), headscarf (a folded patterned square), tie, belt (coiled), gloves, socks, cap, beanie, sun_hat,
 * cardigan, suit (a jacket with trousers below), wedding_dress (a strapless gown), then coat (a long wool coat), skirt (pleated) and scarf (knitted);
 * lying folded, or `hang`ing on a hanger or hook (the suit and the gown always hang). `n` side by side in rows; held, folded over the forearm
 * (a tie, belt or hat is pinched at its top, gloves and socks hang by their clip hanger's hook).
 */
const garment: PieceDef = { draw(p, _r, kit) {
  const kind = GK.includes(str(p.kind, "")) ? str(p.kind, "") : "shirt", held = !!p.held, n = cnt(p.n, 1), hang = held || !!p.hang || kind === "suit" || kind === "wedding_dress", c = col(kit, p.color, GC[kind]);
  const sh = held ? heldLook(kind, c) : build(kind, c, hang), [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: 0 }), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, ppcm = Math.max(5, Math.min(14, 640 / Math.max(w, h)));
  const edge = h > 45 ? 0.45 : 0.3;
  if (held) return one("garment", fan(n, () => sh), ppcm, true, {}, edge);
  return one("garment", grid(n, w, 3, hang ? 8 : 6, h * 0.42, x => mv(sh, x - cx, 0)), ppcm, false, {}, edge);
}, variants: Object.fromEntries(GK.map(k => [k, { kind: k }])),
  meta: {
    about: "A garment: a shirt, sweater, dress, jacket, trousers, jeans, tshirt, pyjamas, school uniform, raincoat, headscarf, tie, belt, gloves, socks, cap, beanie, sun hat, cardigan, suit, wedding dress, long coat, pleated skirt or knitted scarf, folded or on a hanger.",
    params: {
      kind: { type: "enum", values: GK, default: "shirt" },
      hang: { type: "bool", default: false, about: "on a hanger (or a hook) instead of lying folded; the suit and the wedding dress always hang" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (in rows of six, or eight hung)" },
      color: { type: "color", about: "the cloth: a Turkish colour name, a palette id or a hex; the default depends on the kind" },
    },
    terms: ["a1-w-gomlek", "a1-w-kazak", "a1-w-elbise", "a1-w-ceket", "a1-w-pantolon", "a2-w-kot-pantolon", "a1-w-pijama", "b1-w-uniforma", "a2-w-yagmurluk", "b1-w-esarp", "a2-w-kravat", "a2-w-kemer", "a2-w-eldiven", "a1-w-corap", "a2-w-hirka", "a2-w-takim-elbise", "a2-w-gelinlik", "a1-w-kiyafet", "a1-w-sapka", "a1-w-mont", "a1-w-palto", "a2-w-kaban"],
    tags: ["clothes"],
  } };

// ---- footwear --------------------------------------------------------------------------------------------

/** One shoe, toe to the left, centred on x = 0 with its sole on y = 0; `hp` is where a hand pinches it by the heel, `toe` its tip, `sw` how far from straight down the heel-to-toe line swings when it dangles. */
interface Shoe { L: number; hp: Vec2; toe: Vec2; sw: number; f: (c: string) => Shape[] }
const SHOES: Record<string, Shoe> = {
  shoes: { L: 30, hp: [13.6, -9.2], toe: [-15, -2.5], sw: 0.5, f: c => {
    const o = sm([[-14.6, -1.6, 0], [-15.2, -3.8], [-13.2, -6.2], [-8, -7.4], [-3, -8.4], [-0.5, -10.6], [4.5, -10.2], [8, -8.6], [13.6, -9.2], [14.2, -5], [13.4, -1.6, 0]]), so = tone(c, "deep");
    return [S(rrect(-15.2, -1.8, 30, 1.8, 0.9), so), S(rect(6.5, -3.6, 7.4, 2), so), S(o, c), ...lit(o, c, 0.25), S(poly([[-4.2, -8.2], [-0.6, -10.9], [2.4, -10.4], [-0.2, -7.4]]), tone(c, "light")),
      ...[0, 1, 2, 3].map(i => L([[-5.4 + i * 2.2, -9.4 - i * 0.1], [-4.6 + i * 2.2, -6.6 - i * 0.2]], CREAM, 0.5, 0.9)), stitch([[-9.4, -2], [-8.2, -5.4], [-10.6, -7]], tone(c, "light")), stitch([[-14, -2.6], [13, -2.6]], tone(c, "light")), F(ellipse(11, -6, 2.6, 3.4), tone(c, "shade"), 0.35, o)];
  } },
  slippers: { L: 28, hp: [13.4, -2.6], toe: [-14.2, -2.6], sw: 0.45, f: c => {
    const o = sm([[-13.2, -1.8, 0], [-14.2, -3.6], [-12, -6], [-6, -7.8], [0, -7.6], [3.8, -5.2], [4.2, -1.8, 0]]);
    return [S(rrect(-13.8, -2, 28, 2, 1), tone("#D8C3A0", "shade")), S(sm([[3, -2, 0], [5.4, -3.6], [10, -3.4], [13.8, -4.6], [14.2, -2, 0]]), CREAM), S(o, c), ...lit(o, c, 0.22), tiled(o, { w: 1.4, h: 1.4, shapes: [S(ellipse(0.7, 0.7, 0.32), tone(c, "light"))] }, 0.7), S(sm([[3.6, -5.4, 0], [5.6, -4.4], [5.2, -1.9, 0], [3.4, -2, 0]]), tone(c, "light"))];
  } },
  trainers: { L: 31, hp: [13.3, -11.8], toe: [-15.4, -4.6], sw: 0.5, f: c => {
    const o = sm([[-14.4, -3.2, 0], [-15.4, -6.4], [-12, -9], [-6.5, -10.2], [-2.5, -12.6], [3.8, -12.4], [7.5, -11], [13.3, -11.8], [14, -6], [14, -3.2, 0]]);
    return [S(rrect(-15.6, -3.6, 31, 3.6, 1.7), WHITE), L([[-14.6, -1.8], [15, -1.8]], "#B8BEC4", 0.5, 0.9), S(o, c), ...lit(o, c, 0.25), S(sm([[-14.4, -3.4, 0], [-15.4, -6.4], [-12, -9], [-9, -9.6], [-8.8, -3.4, 0]]), WHITE), S(ellipse(0.4, -13.2, 3.2, 1.3), tone(c, "light")), L([[-3, -4.4], [1.4, -9.2], [7, -11.2]], WHITE, 1.4, 0.95),
      ...[0, 1, 2].map(i => L([[-6 + i * 2.2, -9.2 - i * 0.7], [-4.6 + i * 2.2, -11.4 - i * 0.7]], WHITE, 0.55, 0.95)), S(rrect(12.2, -13.6, 2.2, 3.2, 0.6), tone(c, "deep"))];
  } },
  boots: { L: 29, hp: [8, -26], toe: [-14.8, -3.4], sw: 0.5, f: c => {
    const o = sm([[-14.6, -1.8, 0], [-15.2, -4.6], [-12.4, -8], [-7, -9.6], [-3, -11.5], [-2.8, -25, 0], [8, -25.6, 0], [8.8, -14], [13.8, -9], [14.4, -4.4], [13.6, -1.8, 0]]), so = tone(c, "deep");
    return [S(rrect(-15.2, -2, 30, 2, 1), so), S(rect(7.8, -4.4, 6.6, 2.4), so), S(o, c), ...lit(o, c, 0.25), F(ellipse(-11.4, -4, 4.6, 3.4), tone(c, "shade"), 0.55, o), F(rect(-3.4, -26, 12, 3.2), tone(c, "shade"), 0.7, o), S(rrect(7, -27.6, 1.8, 3.4, 0.7), tone(c, "deep")),
      ...[0, 1, 2, 3, 4, 5].map(i => L([[-4.4, -22.6 + i * 2.1], [-1.6, -21 + i * 2.1]], CREAM, 0.5, 0.9)), ...[0, 1, 2, 3, 4, 5].map(i => F(ellipse(-3, -22 + i * 2.1, 0.45), STEEL)), stitch([[-14, -2.6], [13, -2.6]], tone(c, "light"))];
  } },
  sandals: { L: 28, hp: [10.8, -13.2], toe: [-13.6, -2.6], sw: 0.5, f: c => {
    const arc = (x0: number, x1: number, h: number, w: number) => S(band(Array.from({ length: 5 }, (_, i): Vec2 => [x0 + (x1 - x0) * i / 4, -3.6 - h * Math.sin(Math.PI * i / 4)]), Array(5).fill(w)), c), sd = tone("#D8C3A0", "deep");
    return [S(rrect(-13.8, -2.4, 27.6, 2.4, 1.1), sd), S(rrect(-13.4, -3.9, 26.8, 1.9, 0.8), tone("#D8C3A0", "light")), R([[12.4, -3.4], [12.8, -9], [11, -13], [7.6, -13.6]], c, 2), S(rrect(9.6, -12.6, 2.8, 3.4, 0.5), STEEL), arc(-11.6, -4, 5, 2.4), arc(-2, 7, 8.4, 2.4), ...[-7.8, 2.6].map(x => L([[x - 1.4, -3.9], [x + 1.4, -3.9]], tone(c, "deep"), 0.5, 0.6))];
  } },
  heels: { L: 25, hp: [7.6, -11], toe: [-12.6, -1.4], sw: 0.4, f: c => {
    const o = sm([[-12.4, -0.7, 0], [-12.6, -2.4], [-9, -3.8], [-3.5, -5.4], [0.5, -7.6], [3.6, -6.2], [7, -10.6], [9.8, -9.4], [9.4, -7.6, 0], [3, -5.2], [-4, -2.2], [-9, -0.7]]);
    return [S(poly([[7.4, -7.8], [9.8, -8.4], [9.5, 0], [8.5, 0]]), tone(c, "deep")), S(ellipse(9, 0, 0.7, 0.4), DARK), S(o, c), ...lit(o, c, 0.25), F(ellipse(-7.4, -2.6, 2.2, 0.8), WHITE, 0.55, o), F(ellipse(6.8, -8.4, 0.9, 1.6), tone(c, "shade"), 0.4, o)];
  } },
  child_shoes: { L: 17, hp: [7.7, -7.5], toe: [-8.5, -3.2], sw: 0.5, f: c => {
    const o = sm([[-8.6, -2.4, 0], [-9.6, -4.6], [-7.4, -7], [-3, -8.2], [0, -9.2], [4, -9], [8, -8.2], [8.8, -4], [8.4, -2.4, 0]]);
    return T([S(rrect(-9.2, -2.6, 18.6, 2.6, 1.3), WHITE), F(rect(-9.2, -1.4, 18.6, 0.5), c, 0.8), S(o, c), ...lit(o, c, 0.25), S(ellipse(-6.6, -4.4, 3.4, 2.7), mix(c, WHITE, 0.55), { clip: o }), S(poly([[-3.4, -8.6], [0.6, -9.4], [2.2, -3.4], [-1.8, -3]]), tone(c, "light")), stitch([[-2.6, -7], [0.6, -7.6]], c), stitch([[-2, -4.8], [1.2, -5.2]], c), S(rrect(7.4, -10, 1.8, 2.4, 0.5), tone(c, "deep"))], scale(0.9));
  } },
};
const SK = ["shoes", "slippers", "trainers", "boots", "sandals", "heels", "child_shoes"];
const SC: Record<string, string> = { shoes: "#6B4A35", slippers: "#8DB8DA", trainers: "#1F5FC0", boots: "#8A5A3C", sandals: "#B98A57", heels: "#C8283A", child_shoes: "#F0745F" };

/** A pair of shoes: the far shoe a little behind and to the side, both toe to the left. */
const pairOf = (k: Shoe, c: string): Shape[] => [...mv(k.f(c), k.L * 0.52, -2.4), ...k.f(c)];
/** A pair hanging by the heels from one hand, the toes down and apart, the heels at the origin. */
function dangle(k: Shoe, c: string): Shape[] {
  const [hx, hy] = k.hp, a = Math.atan2(k.toe[1] - hy, k.toe[0] - hx), sh = T(k.f(c), mul(rotate(Math.PI / 2 + k.sw - a), translate(-hx, -hy)));
  return [...mv(T(sh, rotate(0.4)), 2, 1), ...sh];
}

/** Shoes, `kind`: leather `shoes` (the default), house `slippers` (terlik), `trainers`, `boots`, `sandals`, high `heels` or a child's `child_shoes`; one pair, `n` pairs side by side in rows. Held, a pair dangles by the heels from the hand. */
const footwear: PieceDef = { draw(p, _r, kit) {
  const kind = SK.includes(str(p.kind, "")) ? str(p.kind, "") : "shoes", k = SHOES[kind], held = !!p.held, n = cnt(p.n, 1), c = col(kit, p.color, SC[kind]);
  if (held) return one("footwear", fan(n, () => dangle(k, c)), 10, true, {}, 0.3);
  return one("footwear", grid(n, k.L * 1.52, 4, 6, 12, x => mv(pairOf(k, c), x - k.L * 0.26, 0)), 10, false, {}, 0.3);
}, variants: Object.fromEntries(SK.map(k => [k, { kind: k }])),
  meta: {
    about: "A pair of shoes: leather shoes, house slippers, trainers, boots, sandals, high heels or a child's shoes; held, dangling by the heels from the hand.",
    params: {
      kind: { type: "enum", values: SK, default: "shoes" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many pairs side by side (in rows of six)" },
      color: { type: "color", about: "the upper: a Turkish colour name, a palette id or a hex; the default depends on the kind" },
    },
    terms: ["a1-w-ayakkabi", "a1-w-terlik", "a2-w-spor-ayakkabi", "b1-w-ayakkabi-topugu"],
    tags: ["clothes", "shoes"],
  } };

// ---- jewellery -------------------------------------------------------------------------------------------

const GEM = (c: string, x: number, y: number, s: number): Shape[] => [S(poly([[x - 0.85 * s, y], [x + 0.85 * s, y], [x + 1.1 * s, y - 0.55 * s], [x + 0.45 * s, y - 1.2 * s], [x - 0.45 * s, y - 1.2 * s], [x - 1.1 * s, y - 0.55 * s]]), c), F(poly([[x - 0.45 * s, y - 1.2 * s], [x - 0.1 * s, y], [x - 0.85 * s, y], [x - 1.1 * s, y - 0.55 * s]]), WHITE, 0.4), F(poly([[x + 0.1 * s, y], [x + 0.45 * s, y - 1.2 * s], [x + 1.1 * s, y - 0.55 * s], [x + 0.85 * s, y]]), tone(c, "shade"), 0.5)];
/** A pear-shaped drop of height `h` hanging from (x, y - h), in a gold bezel. */
const drop = (c: string, x: number, y: number, h: number): Shape[] => {
  const t = (s: number): Path => sm([[x, y - h * s, 0], [x + 0.28 * h * s, y - h * 0.55], [x + 0.32 * h * s, y - h * 0.28], [x, y, 0], [x - 0.32 * h * s, y - h * 0.28], [x - 0.28 * h * s, y - h * 0.55]]);
  return [S(t(1), GOLD), S(sm([[x, y - h * 0.84, 0], [x + 0.2 * h, y - h * 0.5], [x + 0.24 * h, y - h * 0.28], [x, y - h * 0.08], [x - 0.24 * h, y - h * 0.28], [x - 0.2 * h, y - h * 0.5]]), c), F(ellipse(x - 0.08 * h, y - h * 0.4, 0.07 * h, 0.14 * h), WHITE, 0.55)];
};
const GOLDLINE = (pts: Pt[], w: number, closed = false): Shape[] => [{ path: smooth(pts, closed, 1), stroke: { color: GOLD, width: w, cap: "round", join: "round" } }, { path: smooth(pts, closed, 1), stroke: { color: tone(GOLD, "light"), width: w * 0.45, dash: [w * 0.8, w * 1.3] }, flat: true, opacity: 0.9 }];

const ring = (c: string, x: number): Shape[] => [S(holed(ellipse(x, -1.2, 1.2), [ellipse(x, -1.2, 0.88)]), GOLD, { evenodd: true }), F(ellipse(x - 0.82, -1.5, 0.14, 0.4), WHITE, 0.6), S(rrect(x - 0.7, -2.9, 1.4, 0.9, 0.25), GOLD), ...GEM(c, x, -2.9, 1)];
const earring = (c: string, x: number): Shape[] => [R([[x, -2.9], [x, -3.7], [x + 0.4, -4.5], [x + 1.1, -4.2], [x + 1.2, -3.5]], GOLD, 0.16), S(ellipse(x, -3.1, 0.28), GOLD), ...drop(c, x, 0, 3)];

/** A necklace: a chain loop with a pendant (laid out, or from a clasp at the top when held); `c` the pendant's stone. */
function necklace(c: string, held: boolean): Shape[] {
  const pts: Pt[] = held ? [[0, 0], [-2.6, 5], [-3.6, 12], [-2.2, 19], [0, 22], [2.2, 19], [3.6, 12], [2.6, 5]] : Array.from({ length: 14 }, (_, i): Pt => { const a = (i / 14) * Math.PI * 2 - Math.PI / 2; return [8.5 * Math.cos(a), -16.5 + 9 * Math.sin(a)]; }), by = held ? 22 : -7.5, top = held ? 0 : -25.5;
  return [...GOLDLINE(pts, 0.42, true), S(holed(ellipse(0, top + 0.4, 0.65), [ellipse(0, top + 0.4, 0.3)]), GOLD, { evenodd: true }), S(holed(ellipse(0, by + 0.5, 0.6), [ellipse(0, by + 0.5, 0.32)]), GOLD, { evenodd: true }), ...drop(c, 0, by + 6.4, 5.4)];
}

/** A beaded bracelet closed in a ring (standing on its edge) with a nazar charm; `c` the beads. */
function bracelet(c: string, held: boolean): Shape[] {
  const cy = -5.6, r = 3.2, N = 16, out: Shape[] = [{ path: ellipse(0, cy, r), stroke: { color: GOLD, width: 0.14 } }];
  for (let i = 1; i < N; i++) { const a = (i / N) * Math.PI * 2 - Math.PI / 2, x = r * Math.cos(a), y = cy + r * Math.sin(a); out.push(S(ellipse(x, y, i % 2 ? 0.52 : 0.32), i % 2 ? c : GOLD), ...(i % 2 ? [F(ellipse(x - 0.15, y - 0.17, 0.14), WHITE, 0.6)] : [])); }
  const ny = cy + r + 1.3;
  out.push(S(rrect(-0.7, cy - r - 0.45, 1.4, 0.9, 0.3), GOLD), R([[0, cy + r], [0, ny - 0.6]], GOLD, 0.14), S(ellipse(0, ny, 0.95), "#2A5DB0"), S(ellipse(0, ny, 0.66), WHITE), S(ellipse(0, ny, 0.4), "#3F74C4"), S(ellipse(0, ny, 0.17), DARK));
  return held ? mv(out, 0, -(cy - r - 0.9)) : out;
}

/** An open jewellery box, `c` its shell: the lid up with a mirror, rings in a roll, earrings, a necklace over the front. */
function jewelBox(c: string): Shape[] {
  const vd = "#8E1F2D", vl = "#A8344A";
  return [
    S(rrect(-7.4, -18.6, 14.8, 9.6, 1.6), c), ...lit(rrect(-7.4, -18.6, 14.8, 9.6, 1.6), c), S(rrect(-6.5, -17.8, 13, 8, 1.1), vd), S(rrect(-4.6, -17.2, 9.2, 5.4, 0.7), "#CFE3EA"), F(poly([[-3.8, -16.8], [-1.6, -16.8], [-3.4, -12.6], [-4.4, -12.6]]), WHITE, 0.5), L([[-6.5, -9.4], [6.5, -9.4]], tone(c, "light"), 0.4, 0.6),
    S(poly([[-7, -6.4], [7, -6.4], [6.3, -9.4], [-6.3, -9.4]]), vd), S(rrect(-5, -9.1, 5.8, 2.3, 1.15), vl), ...[-3.6, -2.2, -0.8].map(x => S(holed(ellipse(x, -9.2, 0.55, 0.55), [ellipse(x, -9.2, 0.35, 0.35)]), GOLD, { evenodd: true })), ...[3, 4.6].flatMap(x => [R([[x, -8.6], [x, -8]], GOLD, 0.2), S(ellipse(x, -7.5, 0.4), "#2BB4B0")]),
    S(rrect(-7.5, -6.4, 15, 6.4, 0.9), c), ...lit(rrect(-7.5, -6.4, 15, 6.4, 0.9), c, 0.18), F(rect(-7.5, -6.4, 15, 0.9), tone(c, "light"), 0.5), stitch([[-6.6, -1], [6.6, -1]], tone(c, "light")), S(rrect(-0.9, -6.6, 1.8, 2.2, 0.4), GOLD), S(ellipse(0, -4.8, 0.3), tone(GOLD, "deep")),
    ...GOLDLINE([[2, -8.2], [4.4, -6.6], [5.2, -3.6], [4.6, -2]], 0.24), ...drop("#C8283A", 4.6, -0.6, 2.4),
  ];
}

/** A gold bangle seen on its edge, plain or dotted. */
function bangle(c: string, i: number): Shape[] {
  const o = holed(ellipse(0, -3.5, 3.5), [ellipse(0, -3.5, 2.8)]);
  return [S(o, c, { evenodd: true }), { path: ellipse(0, -3.5, 3.15), stroke: { color: tone(c, "deep"), width: 0.12, dash: i % 2 ? [0.1, 0.5] : [1.2, 0.5] }, flat: true, opacity: 0.7 } as Shape, F(ellipse(-2.4, -4.9, 0.2, 0.9), WHITE, 0.55), { ...F(holed(ellipse(0, -3.5, 3.5), [ellipse(0, -3.5, 2.8)]).transform(translate(0.2, 0.3)), tone(c, "shade"), 0.25), evenodd: true }];
}

/** A gold flower brooch with a stone in its heart. */
function brooch(c: string): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push(S(ellipse(0, -1.45, 0.6, 1.1).transform(mul(translate(0, -2.5), rotate(a))), GOLD)); }
  return [...out, S(ellipse(0, -2.5, 1.15), tone(GOLD, "light")), S(ellipse(0, -2.5, 0.8), c), F(ellipse(-0.25, -2.8, 0.25, 0.18), WHITE, 0.7), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => F(ellipse(Math.cos(i * 0.785) * 1.0, -2.5 + Math.sin(i * 0.785) * 1.0, 0.1), tone(GOLD, "deep"), 0.6))];
}

/** `n` points spread evenly along a closed polyline. */
const along = (pts: Vec2[], n: number): Vec2[] => {
  const m = pts.length, cum = [0];
  for (let i = 1; i <= m; i++) cum.push(cum[i - 1] + Math.hypot(pts[i % m][0] - pts[i - 1][0], pts[i % m][1] - pts[i - 1][1]));
  return Array.from({ length: n }, (_, k) => { const d = cum[m] * k / n; let i = 1; while (cum[i] < d) i++; const u = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = pts[i - 1], b = pts[i % m]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; });
};

/** A nazar amulet: a glass drop in rings of blue, white and sky blue round a dark centre, a gold ring at the top. */
function nazar(c: string): Shape[] {
  const tear = (k: number): Path => sm(([[0, -8.2, 0], [2.6, -5.4], [3.6, -2.6], [3.4, -0.9], [0, 0], [-3.4, -0.9], [-3.6, -2.6], [-2.6, -5.4]] as Pt[]).map(q => (q[2] === 0 ? [q[0] * k, -3.8 + (q[1] + 3.8) * k, 0] : [q[0] * k, -3.8 + (q[1] + 3.8) * k]) as Pt));
  return [S(holed(ellipse(0, -9.4, 1.2), [ellipse(0, -9.4, 0.72)]), GOLD, { evenodd: true }), S(tear(1), c), S(tear(0.74), WHITE), S(tear(0.5), "#5FA8E8"), S(ellipse(0, -3.6, 0.8), DARK), F(ellipse(-0.6, -4.3, 0.28, 0.2), WHITE, 0.6), F(ellipse(-1.9, -5.6, 0.4, 1.1), WHITE, 0.25)];
}

/** Prayer beads (tespih), 33 beads on a thread with an elongated head bead and a tassel: a loop laid out, or hung from the grip. */
function tespih(c: string, held: boolean): Shape[] {
  const cy = held ? 12 : -17, rx = held ? 4.2 : 7.5, ry = held ? 12 : 8.6, loop = Array.from({ length: 160 }, (_, j): Vec2 => { const a = Math.PI / 2 + (j / 160) * Math.PI * 2; return [rx * Math.cos(a), cy + ry * Math.sin(a)]; }), by = cy + ry, sd = tone(c, "deep");
  return [{ path: smooth(loop, true, 1), stroke: { color: DARK, width: 0.12 } }, ...Array.from({ length: 8 }, (_, i) => R([[(i - 3.5) * 0.14, by + 1.8], [(i - 3.5) * 0.45, by + 8]], sd, 0.3)),
    ...along(loop, 33).slice(1).flatMap(([x, y]) => [S(ellipse(x, y, 0.62), c), F(ellipse(x - 0.2, y - 0.22, 0.17), WHITE, 0.55)]), S(ellipse(0, by + 1.2, 0.5), sd), S(ellipse(0, by, 0.8, 1.15), tone(c, "light")), F(ellipse(-0.25, by - 0.4, 0.2, 0.45), WHITE, 0.5)];
}

const JK = ["ring", "earrings", "necklace", "bracelet", "box", "bangle", "brooch", "nazar", "tespih"];
const JC: Record<string, string> = { ring: "#3F74C4", earrings: "#2BB4B0", necklace: "#C8283A", bracelet: "#2F8C88", box: "#6B4A35", bangle: "#E0B03C", brooch: "#C8283A", nazar: "#1F4FA0", tespih: "#A8741F" };

/**
 * Jewellery, `kind`: a gold `ring` with a stone (yüzük), `earrings` (küpe, a pair with drops), a `necklace` with a pendant, a beaded
 * `bracelet` (bileklik) with a nazar charm, an open jewellery `box` (takı), a gold `bangle`, a flower `brooch`, a `nazar` amulet or prayer beads (`tespih`). `n` of them side by side
 * (a bangle's `n` is a stack); `color` the stone, the beads or the box's shell, the bangle's metal. Held, pinched, or hung from the fingers (a
 * necklace, a bracelet).
 */
const jewel: PieceDef = { draw(p, _r, kit) {
  const kind = JK.includes(str(p.kind, "")) ? str(p.kind, "") : "ring", held = !!p.held, n = cnt(p.n, 1), c = col(kit, p.color, JC[kind]);
  const edge = kind === "box" ? 0.3 : 0.14;
  if (kind === "necklace") return one("jewel", held ? fan(n, () => necklace(c, true)) : row(n, 18, 2, x => mv(necklace(c, false), x, 0)), 10, held, {}, edge);
  if (kind === "nazar") return one("jewel", row(n, 8, 2, x => mv(nazar(c), x, 0)), 14, held, {}, edge);
  if (kind === "tespih") return one("jewel", held ? fan(n, () => tespih(c, true)) : row(n, 16, 2, x => mv(tespih(c, false), x, 0)), 12, held, {}, edge);
  if (kind === "bracelet") return one("jewel", held ? fan(n, () => bracelet(c, true)) : row(n, 8, 1.5, x => mv(bracelet(c, false), x, 0)), 14, held, {}, edge);
  if (kind === "box") return one("jewel", row(n, 16, 3, x => mv(jewelBox(c), x, 0)), 10, held, {}, edge);
  if (kind === "bangle") return one("jewel", row(n, 6.6, 0.8, (x, i) => mv(bangle(c, i), x, 0)), 14, held, {}, edge);
  if (kind === "brooch") return one("jewel", row(n, 5.6, 1.6, x => mv(brooch(c), x, 0)), 16, held, {}, edge);
  if (kind === "earrings") return one("jewel", row(n, 5.6, 2.4, x => [...earring(c, x - 1.6), ...earring(c, x + 1.6)]), 16, held, {}, edge);
  return one("jewel", row(n, 2.9, 1.6, x => ring(c, x)), 16, held, {}, edge);
}, variants: Object.fromEntries(JK.map(k => [k, { kind: k }])),
  meta: {
    about: "Jewellery: a gold ring with a stone, a pair of earrings, a necklace with a pendant, a beaded bracelet with a nazar charm, an open jewellery box, a gold bangle, a flower brooch, a nazar amulet or tespih prayer beads.",
    params: {
      kind: { type: "enum", values: JK, default: "ring" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (earrings: pairs; bangles: a stack)" },
      color: { type: "color", about: "the stone, the beads, the box's shell or the amulet's blue (the bangle's metal): a Turkish colour name, a palette id or a hex; the default depends on the kind" },
    },
    terms: ["a1-w-yuzuk", "a2-w-kupe", "a2-w-bileklik", "a1-w-taki", "a2-w-altin"],
    tags: ["clothes", "jewellery"],
  } };

// ---- what is in a pocket ---------------------------------------------------------------------------------

/** What a pocket thing draws: its shapes and the words laid on them. */
type Item = [Shape[], TextSpec[]];
/** Banknotes by value: the colour of the note peeking from the wallet. */
const NOTES: Record<string, string> = { "5": "#C9A06A", "10": "#D9534A", "20": "#7FBF8E", "50": "#EE8A2E", "100": "#6F9BDB", "200": "#9B7BC4" };

/** A bifold leather wallet with a snap strap, a card and a banknote showing; `note` is the banknote's value. */
function wallet(c: string, note: string): Item {
  const nc = NOTES[note] ?? NOTES["20"], b = rrect(-5.8, -9.5, 11.6, 9.5, 0.9);
  return [[
    S(rrect(-5.4, -11.7, 5.4, 2.6, 0.5), "#3F74C4"), F(rect(-5.4, -10.6, 5.4, 0.7), tone("#3F74C4", "deep"), 0.7), S(rrect(-1, -12.8, 6.4, 3.8, 0.4), nc), F(ellipse(4, -11, 0.7), tone(nc, "deep"), 0.4), { path: rect(-0.6, -12.4, 5.6, 3), stroke: { color: tone(nc, "deep"), width: 0.12 }, flat: true, opacity: 0.6 },
    S(b, c), ...lit(b, c, 0.2), { path: rrect(-5.1, -8.8, 10.2, 8.1, 0.6), stroke: { color: tone(c, "light"), width: 0.25, dash: [0.8, 0.6] }, flat: true, opacity: 0.8 }, S(rrect(2.4, -9.7, 3, 4.6, 0.5), tone(c, "light")), S(ellipse(3.9, -5.6, 0.55), GOLD), F(ellipse(-3.6, -7.4, 0.9, 0.5), WHITE, 0.2),
  ], note ? [{ text: note, x: -0.6, y: -12.5, w: 5.2, h: 3, size: 1.9, align: "center", font: "print", color: "#2B2420" }] : []];
}

/** A small coin purse with a kiss-lock frame, quilted, on a gilt chain. */
function purse(c: string, held: boolean): Item {
  const o = sm([[-5.8, -9, 0], [5.8, -9, 0], [6.2, -4], [4.4, -0.8], [0, 0], [-4.4, -0.8], [-6.2, -4]]), q = tone(c, "deep");
  const sh = [...GOLDLINE([[-5.2, -10.4], [-4, -15], [0, -17], [4, -15], [5.2, -10.4]], 0.3), S(o, c), ...lit(o, c, 0.2), tiled(o, { w: 2.2, h: 2.2, shapes: [S(poly([[0, 0], [0.25, 0], [2.2, 1.95], [2.2, 2.2], [1.95, 2.2], [0, 0.25]]), q), S(poly([[2.2, 0], [2.2, 0.25], [0.25, 2.2], [0, 2.2], [0, 1.95], [1.95, 0]]), q)] }, 0.35), S(rrect(-5.8, -10.9, 11.6, 2.3, 1.1), GOLD), F(rect(-5.2, -10.5, 10.4, 0.5), WHITE, 0.45), S(ellipse(-0.75, -11.1, 0.62), tone(GOLD, "light")), S(ellipse(0.75, -11.1, 0.62), tone(GOLD, "light"))];
  return [held ? mv(sh, 0, 17.2) : sh, []];
}

/** Sunglasses seen from the front, in a frame `c`. */
function sunglasses(c: string, held: boolean): Item {
  const L1 = sm([[-7.3, -4.8, 0], [-0.9, -4.6, 0], [-0.7, -2.6], [-1.5, -0.9], [-3.2, -0.2], [-5.6, -0.4], [-7, -1.6]]), I1 = sm([[-6.5, -4, 0], [-1.7, -3.9, 0], [-1.6, -2.5], [-2.2, -1.4], [-3.4, -1], [-5.4, -1.2], [-6.4, -2.3]]), lens = "#3B3F46", dp = tone(c, "deep");
  const half = (d: number): Shape[] => [S(d < 0 ? L1 : L1.mirrorX(), c), S(d < 0 ? I1 : I1.mirrorX(), lens), F(poly([[-6, -3.7], [-4.8, -3.7], [-6.1, -1.9]]).transform(d < 0 ? translate(0, 0) : [-1, 0, 0, 1, 0, 0]), WHITE, 0.3), S(rrect(d * 7.3 - 0.5, -4.9, 1, 1.7, 0.3), dp), R([[d * 7.8, -4.4], [d * 8.8, -4.1]], dp, 0.5)];
  const sh = T([...half(-1), ...half(1), S(rrect(-1.3, -4.6, 2.6, 0.9, 0.4), c), F(rect(-7, -4.3, 5.6, 0.4), WHITE, 0.18)], scale(0.84));
  return [held ? mv(sh, 0, 3.9) : sh, []];
}

/** Eyeglasses folded: round lenses, the two arms crossed over them. */
function glasses(c: string, held: boolean): Item {
  const lens = (x: number): Shape[] => [S(ellipse(x, -2.6, 2.35), "#DCEFF5", { opacity: 0.45 }), S(holed(ellipse(x, -2.6, 2.5), [ellipse(x, -2.6, 2.15)]), c, { evenodd: true }), F(ellipse(x - 0.9, -3.4, 0.5, 0.9), WHITE, 0.55)];
  const sh = [...lens(-3.4), ...lens(3.4), R([[-0.8, -3.2], [0, -3.7], [0.8, -3.2]], c, 0.3), S(rrect(-6.3, -4.1, 0.9, 0.8, 0.2), tone(c, "deep")), S(rrect(5.4, -4.1, 0.9, 0.8, 0.2), tone(c, "deep")), R([[-5.9, -4.2], [-2, -2.9], [2.4, -1]], c, 0.42), R([[5.9, -4.2], [2, -2.9], [-2.4, -1.1]], tone(c, "light"), 0.42)];
  return [held ? mv(sh, 0, 3.8) : sh, []];
}

/** A glasses case, open: the lid up behind, a pair of glasses lying in the velvet. */
function glassesCase(c: string): Item {
  const vd = mix(c, "#8E1F2D", 0.7), vl = tone(vd, "light"), bo = rrect(-8.2, -4.8, 16.4, 4.8, 1.8), lid = rrect(-8.2, -11.8, 16.4, 6.4, 1.8);
  return [[S(lid, c), ...lit(lid, c, 0.15), S(rrect(-7.4, -11, 14.8, 4.8, 1.2), vd), S(bo, c), ...lit(bo, c, 0.15), S(rrect(-7.4, -4.3, 14.8, 3.2, 1.3), vl),
    S(holed(ellipse(-3.4, -2.6, 2.1, 1.2), [ellipse(-3.4, -2.6, 1.8, 0.9)]), DARK, { evenodd: true }), S(holed(ellipse(3.4, -2.6, 2.1, 1.2), [ellipse(3.4, -2.6, 1.8, 0.9)]), DARK, { evenodd: true }), R([[-1.3, -2.8], [0, -3.2], [1.3, -2.8]], DARK, 0.3), R([[-5.4, -3], [5.6, -2.4]], DARK, 0.35),
    S(rrect(-1.1, -5.2, 2.2, 1.8, 0.4), GOLD), stitch([[-7, -0.8], [7, -0.8]], tone(c, "light"))], []];
}

/** A handkerchief (mendil), folded square, a crocheted oya edge in `c` and a corner turned over. */
function hanky(c: string): Item {
  const w = 13, o = rrect(-w / 2, -w, w, w, 0.5), edge = new Path();
  for (let i = 0; i < 13; i++) for (const [x, y] of [[-w / 2 + 0.5 + i * 1, -w], [-w / 2 + 0.5 + i * 1, 0], [-w / 2, -w + 0.5 + i * 1], [w / 2, -w + 0.5 + i * 1]]) edge.add(ellipse(x, y, 0.42));
  return [[S(o, WHITE), F(rect(w / 2 - 1.8, -w, 1.8, w), tone(WHITE, "shade"), 0.4, o), F(edge, c, 0.95), { path: rect(-w / 2 + 1.5, -w + 1.5, w - 3, w - 3), stroke: { color: c, width: 0.3 }, flat: true, opacity: 0.8 }, ...[[-3.4, -3.4], [3.4, -3.4], [-3.4, -9.6], [3.4, -9.6]].map(([x, y]) => F(ellipse(x, y, 0.55), mix(c, WHITE, 0.4), 0.9)),
    S(poly([[w / 2 - 4.5, -w], [w / 2, -w + 4.5], [w / 2 - 4.5, -w + 4.5]]), mix(c, WHITE, 0.82)), L([[w / 2 - 4.5, -w], [w / 2, -w + 4.5]], tone(WHITE, "shade"), 0.5, 0.8)], []];
}

/** An ID card (kimlik kartı, 85.6 × 54 mm): a band with its title, a photo, lines and the holder's `name`. */
function idCard(c: string, name: string): Item {
  const o = rrect(-4.28, -5.4, 8.56, 5.4, 0.4), ph = rrect(-3.7, -4.1, 2.4, 3, 0.2), g = "#8FA0AE";
  return [[S(o, mix(c, WHITE, 0.88)), F(rect(-4.28, -5.4, 8.56, 1.1), c, 1, o), S(ph, "#C5D0D8"), F(ellipse(-2.5, -2.9, 0.55), g, 1, ph), F(ellipse(-2.5, -1.1, 1.05, 0.95), g, 1, ph), F(rect(-0.8, -4, 3.9, 0.3), g, 0.8), F(rect(-0.8, -3.3, name ? 0.1 : 2.6, 0.3), g, 0.8), F(rect(-0.8, -1.9, 3.9, 0.28), g, 0.7), F(rect(-0.8, -1.3, 2.2, 0.28), g, 0.7), F(ellipse(3.3, -0.8, 0.5), GOLD, 0.7)],
    [{ text: "KİMLİK KARTI", x: -4, y: -5.35, w: 8, h: 1, size: 0.75, align: "left", font: "print", color: WHITE }, ...(name ? [{ text: name, x: -0.8, y: -3.45, w: 4.1, h: 0.8, size: 0.6, align: "left", font: "print", color: "#2B2420" } as TextSpec] : [])]];
}
/** A bank card with a chip, a contactless mark and a row of digits (dots). */
function bankCard(c: string): Item {
  const o = rrect(-4.28, -5.4, 8.56, 5.4, 0.45);
  return [[S(o, c), F(ellipse(3.2, -5.6, 6, 4.4), tone(c, "light"), 0.35, o), F(ellipse(-4, 0, 5, 3), tone(c, "shade"), 0.4, o), S(rrect(-3.5, -4, 1.7, 1.3, 0.28), GOLD), L([[-3.5, -3.35], [-1.8, -3.35]], tone(GOLD, "deep"), 0.12, 0.7), L([[-2.65, -4], [-2.65, -2.7]], tone(GOLD, "deep"), 0.12, 0.7),
    ...[0, 1, 2, 3].flatMap(g => [0, 1, 2, 3].map(d => F(ellipse(-3.4 + g * 2.1 + d * 0.38, -1.7, 0.13), WHITE, 0.85))), F(rect(-3.4, -0.9, 3, 0.25), WHITE, 0.6), ...[0.5, 0.95, 1.4].map(r => ({ path: smooth([[2.6 + r * 0.35, -3.9 - r * 0.5], [2.6 + r * 0.5, -3.4], [2.6 + r * 0.35, -2.9 + r * 0.5]], false, 1), stroke: { color: WHITE, width: 0.14 }, flat: true, opacity: 0.8 } as Shape))], []];
}
/** A pack of paper tissues (kağıt mendil) with a tissue pulled up. */
function tissues(c: string): Item {
  const o = rrect(-3.9, -6.8, 7.8, 6.8, 0.9);
  return [[S(sm([[-2.2, -6.7, 0], [-1.6, -9.4], [0, -10.4], [1.7, -9], [2.5, -6.7, 0]]), WHITE), L([[0, -10], [0.2, -7]], tone(WHITE, "shade"), 0.3, 0.7), S(o, "#EEF1F3"), ...lit(o, "#EEF1F3", 0.16), F(rect(-3.9, -4.3, 7.8, 4.3), c, 0.92, o), tiled(rect(-3.9, -4.3, 7.8, 4.3), { w: 2, h: 2, shapes: [S(ellipse(0.5, 0.5, 0.28), WHITE), S(ellipse(1.5, 1.5, 0.28), WHITE)] }, 0.7), L([[-3.9, -4.3], [3.9, -4.3]], tone(c, "deep"), 0.3, 0.6), F(ellipse(0, -5.7, 1.5, 0.35), "#CFD6DB", 0.8)], []];
}

const PK = ["wallet", "purse", "sunglasses", "glasses", "glasses_case", "handkerchief", "id_card", "bank_card", "tissues"];
const PC: Record<string, string> = { wallet: "#6B4A35", purse: "#A23F28", sunglasses: "#26272C", glasses: "#6B4A35", glasses_case: "#3A3D45", handkerchief: "#2F8C88", id_card: "#3F74C4", bank_card: "#2E3A59", tissues: "#E58FA0" };

/**
 * A pocket thing, `kind`: a leather `wallet` (cüzdan, a banknote of value `note` showing), a quilted coin `purse` on a chain, `sunglasses`,
 * folded `glasses` (gözlük), a `glasses_case` (open), a folded `handkerchief` (mendil, an oya edge in `color`), an `id_card` (kimlik kartı, the holder's `name`), a `bank_card` or a pack of paper `tissues`. `n` side by side; held,
 * on the palm, or (purse, glasses, sunglasses, handkerchief) pinched or hung by the fingers.
 */
const pocket: PieceDef = { draw(p, _r, kit) {
  const kind = PK.includes(str(p.kind, "")) ? str(p.kind, "") : "wallet", held = !!p.held, n = cnt(p.n, 1), c = col(kit, p.color, PC[kind]), note = str(p.note, "").trim(), name = str(p.name, "").trim();
  const f = (): Item => kind === "wallet" ? wallet(c, note) : kind === "purse" ? purse(c, held) : kind === "sunglasses" ? sunglasses(c, held) : kind === "glasses" ? glasses(c, held) : kind === "glasses_case" ? glassesCase(c) : kind === "id_card" ? idCard(c, name) : kind === "bank_card" ? bankCard(c) : kind === "tissues" ? tissues(c) : hanky(c);
  const w = { wallet: 12.5, purse: 13, sunglasses: 17, glasses: 13.5, glasses_case: 17, handkerchief: 14, id_card: 10, bank_card: 10, tissues: 9 }[kind] ?? 14, dy = held && kind === "handkerchief" ? 13 : 0, xs = Array.from({ length: n }, (_, i) => -(n * w + (n - 1) * 2) / 2 + w / 2 + i * (w + 2));
  const parts = xs.map((x): Item => { const [sh, tx] = f(); return [mv(sh, x, dy), tx.map(t => ({ ...t, x: t.x + x, y: t.y + dy }))]; }), text = parts.flatMap(q => q[1]);
  return one("pocket", parts.flatMap(q => q[0]), kind === "glasses_case" || kind === "wallet" ? 12 : kind === "id_card" || kind === "bank_card" ? 16 : 14, held, text.length ? { text } : {}, 0.2);
}, variants: Object.fromEntries(PK.map(k => [k, { kind: k }])),
  meta: {
    about: "A pocket thing: a leather wallet with a banknote showing, a quilted coin purse on a chain, sunglasses, folded eyeglasses, an open glasses case, a folded handkerchief with a crocheted edge, an ID card, a bank card or a pack of tissues.",
    params: {
      kind: { type: "enum", values: PK, default: "wallet" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      color: { type: "color", about: "the leather, frame or oya edge: a Turkish colour name, a palette id or a hex; the default depends on the kind" },
      note: { type: "text", about: "the wallet's banknote value (5, 10, 20, 50, 100 or 200 sets its colour); none, no number" },
      name: { type: "text", about: "the holder's name on the ID card; none, a grey line" },
    },
    terms: ["a1-w-cuzdan", "a1-w-gozluk", "a1-w-mendil", "b1-w-kimlik-karti", "a1-w-kredi-karti", "a2-w-banka-karti", "b1-w-kagit-mendil"],
    tags: ["clothes", "pocket"],
  } };

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { garment, footwear, jewel, pocket };
