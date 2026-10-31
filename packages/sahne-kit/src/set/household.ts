// Props of the household family (STYLE.md): cleaning, laundry, linen, rugs, sewing and charms. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art. Each generator is a table of kinds: `gen` draws `n` of the
// chosen kind side by side (or its own count), or its held look.

import { smooth, band, arcPoints, ellipse, rect, rrect, poly, tone, mix, mul, rotate, translate, scale, groupBounds, Path, type Affine, type ParamSpec, type PieceDef, type PieceOut, type FlatSpec, type Shape, type TextSpec, type Vec2, type Rng } from "sahne";
import { S, P, L, num, str, hex, holed, type Pt } from "./draw.ts";

/** How high a hanging hand grips above the floor (an adult's, cm). */
const GRIP = 46;
const DARK = "#2E2F35", STEEL = "#B8BEC4", GREY = "#8E959C", CREAM = "#F3EBD8", WOOD = "#B98A57", RED = "#C4553A", GOLD = "#D9A72E";
const MIXC = ["#C4553A", "#2F8C88", "#E0A83A", "#4F6E9E", "#7A3E6E", "#6F7A45", "#E58FA0", "#F0745F", "#F4EFE6"];

const cnt = (v: unknown, d: number, hi = 24) => Math.max(1, Math.min(hi, Math.round(num(v, d))));
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
const mirror = (sh: Shape[]) => T(sh, [-1, 0, 0, 1, 0, 0]);
/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a strap, a string, a rod. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Straight strands, one path: each pair of points a segment. */
const W = (segs: Vec2[][], color: string, width: number, o: Partial<Shape> = {}): Shape => { const p = new Path(); for (const [a, b] of segs) p.moveTo(a[0], a[1]).lineTo(b[0], b[1]); return { path: p, stroke: { color, width, cap: "round" }, ...o }; };
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(); return [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** A cut piece with its light. */
const body = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...lit(o, c, k)];
/** `n` things `w` wide side by side, `gap` apart, centred; `f(x, i)` draws each. */
const row = (n: number, w: number, gap: number, f: (x: number, i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => f(-(n * w + (n - 1) * gap) / 2 + w / 2 + i * (w + gap), i)).flat();
/** Turn shapes about the grip `g` until the point `f` lies `drop` below it, out to the side `dir`; the grip becomes the origin. */
function tilt(sh: Shape[], g: Vec2, f: Vec2, dir: number, drop = GRIP): Shape[] {
  const dx = f[0] - g[0], dy = f[1] - g[1], d = Math.hypot(dx, dy), y = Math.min(drop, d);
  return T(sh, mul(rotate(Math.atan2(y, dir * Math.sqrt(d * d - y * y)) - Math.atan2(dy, dx)), translate(-g[0], -g[1])));
}
/** A prop of one flat (`id`), its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.4): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(ppcm, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}
/** A smooth closed outline through points (a corner where the third value is 0). */
const O = (pts: Pt[]): Path => smooth(pts, true, 1);
/** A soft blob of `n` points about (cx, cy), wobbled by the seed. */
const blob = (cx: number, cy: number, rx: number, ry: number, r: Rng, n = 9, wob = 0.14): Path => O(Array.from({ length: n }, (_, i) => { const a = i * 6.283 / n, k = 1 + r.range(-wob, wob); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as Vec2; }));

/** What a kind draws: `sh` its art (foot at y = 0, x = 0 centre), `w` its width for rows, `g` the grip and `f` where it meets the floor (held: turned until it does), `h` its held art (already at the grip). */
interface It { sh: Shape[]; w: number; ppcm?: number; edge?: number; g?: Vec2; f?: Vec2; dir?: number; drop?: number; h?: Shape[]; own?: boolean; text?: TextSpec[]; gap?: number; more?: FlatSpec[] }
interface Ctx { p: Record<string, unknown>; r: Rng; i: number; n: number; held: boolean; c(d: string): string; t(d?: string): string }
type B = (k: Ctx) => It;

/** The generator of a table of kinds: kind (the first the default), `n` of them, `color`; held, the kind's own held art or the art turned/moved to its grip. */
function gen(id: string, kinds: Record<string, B>, about: string, extra: Record<string, ParamSpec>, terms: string[], tags: string[], nd = 1, cap = 24): PieceDef {
  const ks = Object.keys(kinds);
  return {
    draw(p, r) {
      const kind = str(p.kind, ks[0]), b = kinds[kind] ?? kinds[ks[0]], n = cnt(p.n, nd, cap), held = !!p.held;
      const ctx = (i: number): Ctx => ({ p, r, i, n, held, c: d => hex(p.color, d), t: (d = "") => str(p.label, d).trim() });
      const it = b(ctx(0));
      if (held) {
        const g = it.g ?? [0, 0], sh = it.h ?? (it.f ? tilt(it.sh, g, it.f, it.dir ?? 1, it.drop) : mv(it.sh, -g[0], -g[1]));
        return one(id, sh, it.ppcm ?? 8, true, it.text && !it.f && !it.h ? { text: it.text.map(t => ({ ...t, x: t.x - g[0], y: t.y - g[1] })) } : {}, it.edge);
      }
      if (it.own) { const o = one(id, it.sh, it.ppcm ?? 8, false, it.text ? { text: it.text } : {}, it.edge); return it.more ? { flats: [...o.flats, ...it.more] } : o; }
      const its = Array.from({ length: n }, (_, i) => i ? b(ctx(i)) : it), gap = it.gap ?? it.w * 0.12, x0 = -(n * it.w + (n - 1) * gap) / 2 + it.w / 2;
      return one(id, row(n, it.w, gap, (x, i) => mv(its[i].sh, x, 0)), it.ppcm ?? 8, false, it.text ? { text: it.text.map(t => ({ ...t, x: t.x + x0 })) } : {}, it.edge);
    },
    variants: Object.fromEntries(ks.map(k => [k, { kind: k }])),
    meta: {
      about,
      params: {
        kind: { type: "enum", values: ks, default: ks[0] },
        n: { type: "int", min: 1, max: cap, ...(nd > 1 ? {} : { default: 1 }), about: "how many, side by side" },
        color: { type: "color", about: "the main colour of the thing (a palette id or a hex); each kind has its own default" },
        ...extra,
      },
      terms, tags,
    },
  };
}
const LABEL: Record<string, ParamSpec> = { label: { type: "text", about: "the words on its label" } };
const lab = (k: Ctx, x: number, y: number, w: number, h: number, size: number, color = "#2B2420"): TextSpec[] => { const t = k.t(); return t ? [{ text: t, x, y, w, h, size, font: "print", color, weight: 700 }] : []; };


// ---- charms ------------------------------------------------------------------------------------------------

/** A nazar eye, its centre at (x, y): rings of dark blue, white, light blue and a dark pupil. */
const eye = (x: number, y: number, r: number, c = "#1F4FA3"): Shape[] => [S(ellipse(x, y, r), c), F(ellipse(x, y, r * 0.76), "#F6F1E4"), F(ellipse(x, y, r * 0.52), "#4FA3E0"), F(ellipse(x, y, r * 0.26), "#0E2A5E"), F(ellipse(x - r * 0.3, y - r * 0.34, r * 0.13), "#FFFFFF", 0.8)];
/** Many circles of one radius as one path. */
const dots = (pts: Vec2[], r: number): Path => pts.reduce((p, [x, y]) => p.add(ellipse(x, y, r)), new Path());
const ringPts = (cx: number, cy: number, rx: number, ry: number, n: number): Vec2[] => Array.from({ length: n }, (_, i) => [cx + Math.cos(i * 6.2832 / n) * rx, cy + Math.sin(i * 6.2832 / n) * ry]);
const TWIG = "#6B4A35";

const CHARM: Record<string, B> = {
  nazar: k => {
    const c = k.c("#1F4FA3");
    return { w: 12, ppcm: 14, edge: 0.2, g: [0, -31], sh: [
      R([[0, -31], [0.3, -24], [0, -17.4]], "#8E6A4A", 0.6), S(ellipse(0, -31.4, 1.2, 0.7), GOLD), S(ellipse(0, -21, 0.9), "#2F8C88"), S(ellipse(0, -18.6, 0.9), "#7FC4E4"), S(rrect(-1, -15.8, 2, 2.8, 0.8), GOLD),
      ...eye(0, -9, 5, c),
    ] };
  },
  tespih: k => {
    const c = k.c("#C98A2B");
    const bead = (pts: Vec2[], rr: number): Shape[] => [S(dots(pts, rr), c), F(dots(pts.map(([x, y]) => [x - rr * 0.35, y - rr * 0.35] as Vec2), rr * 0.3), tone(c, "light"), 0.85)];
    const hang = bead(ringPts(0, 9.4, 3.6, 8.6, 33), 0.62);
    return { w: 20, ppcm: 14, edge: 0.15, g: [0, -4],
      sh: [...bead(ringPts(0, -4.2, 7.2, 3.4, 33), 0.62), S(ellipse(8.6, -2.6, 1.3, 0.8), tone(c, "shade")), S(ellipse(10.2, -2.3, 0.8, 0.6), c), ...[0, 1, 2, 3, 4].map(i => R([[10.8, -2.2], [13.4 + i * 0.3, -2.6 + i * 0.9], [15.4 + i * 0.4, -2.2 + i * 1.1 - 0.2]], tone(c, "deep"), 0.45))],
      h: [...hang, S(ellipse(0, 19.2, 0.8, 1.5), tone(c, "shade")), S(ellipse(0, 21.4, 0.9, 0.7), c), ...[-1.6, -0.8, 0, 0.8, 1.6].map(x => R([[0, 22], [x * 1.2, 26.4 + Math.abs(x) * -0.6], [x * 1.4, 30]], tone(c, "deep"), 0.5)), S(rrect(-1, -0.4, 2, 0.8, 0.4), tone(c, "deep"))] };
  },
  horseshoe: k => {
    const c = k.c("#6F767D"), sp = arcPoints(0, -7.4, 5.6, 7.4, -0.2 * Math.PI, 1.2 * Math.PI, 16), o = band(sp, sp.map(() => 2));
    return { w: 15, ppcm: 14, edge: 0.2, g: [5.6, -3.5], sh: [
      ...body(o, c, 0.15), L(sp.slice(1, -1).map(([x, y]) => [x * 1.06, y - 0.4] as Vec2), tone(c, "light"), 0.35, 0.7),
      ...[2, 5, 11, 14].map(i => F(ellipse(sp[i][0], sp[i][1], 0.5, 0.45), DARK, 0.9)), ...[0, 16].map(i => F(ellipse(sp[i][0], sp[i][1] - 0.2, 1, 0.5), tone(c, "deep"), 0.7)),
    ] };
  },
  magnet: k => {
    const c = k.c("#F4F1EA"), pic = rrect(-2.9, -6.4, 5.8, 5.8, 0.4), dk = "#2E3A59";
    return { w: 8, ppcm: 16, edge: 0.18, g: [0, -3.4], text: lab(k, -2.7, -2.5, 5.4, 1.6, 1.2, "#FFFFFF"), sh: [
      ...body(rrect(-3.4, -6.9, 6.8, 6.8, 0.8), c, 0.14), F(pic, "#79B8E3", 1), F(ellipse(-1.8, -5.1, 0.55), "#F2C230", 1), F(rect(-2.9, -2.1, 5.8, 1.5), "#2F6E8F", 1, pic),
      F(ellipse(0, -3.9, 1.6, 1.5), dk), F(rect(-1.8, -3.9, 3.6, 1.8), dk), F(rect(-2.7, -5.8, 0.55, 3.7), dk), F(poly([[-2.8, -5.8], [-2.42, -6.5], [-2.05, -5.8]]), dk), F(rect(2.15, -5.8, 0.55, 3.7), dk), F(poly([[2.05, -5.8], [2.42, -6.5], [2.8, -5.8]]), dk), F(ellipse(0, -5.5, 0.12, 0.5), dk),
    ] };
  },
  souvenir: k => {
    const c = k.c("#D8C7A0"), roof = "#5F6B7A", sd = tone(c, "shade");
    return { w: 16, ppcm: 12, edge: 0.2, g: [0, -3], sh: [
      S(rrect(-6.5, -2.4, 13, 2.4, 0.8), tone(WOOD, "deep")), S(rrect(-5.4, -3.6, 10.8, 1.4, 0.5), GOLD), ...body(poly([[-3.2, -3.6], [3.2, -3.6], [2.7, -12], [-2.7, -12]]), c, 0.25), ...[0, 1].map(i => F(rect(-0.4 + i * 0.1, -9.6 + i * -3.4, 0.8, 1.8), DARK, 0.8)),
      S(rrect(-4.3, -13, 8.6, 1.4, 0.5), sd), ...body(rrect(-3.6, -19.4, 7.2, 6.6, 0.8), c, 0.25), ...[-2.2, 0, 2.2].map(x => F(O([[x - 0.55, -14.4, 0], [x - 0.55, -16.4], [x, -17.4], [x + 0.55, -16.4], [x + 0.55, -14.4, 0]]), DARK, 0.85)),
      S(rrect(-4.3, -20.6, 8.6, 1.4, 0.5), sd), S(poly([[-3.9, -20.6], [3.9, -20.6], [0.5, -27.4], [-0.5, -27.4]]), roof), F(poly([[1, -20.6], [3.9, -20.6], [0.5, -27.4]]), tone(roof, "shade"), 0.6), R([[0, -27.4], [0, -29.4]], GOLD, 0.4), S(ellipse(0, -28, 0.6), GOLD),
    ] };
  },
  fal: k => {
    const c = k.c("#F6F1E4"), BL = "#2F5FA8", cup = O([[-3.4, -2, 0], [3.4, -2, 0], [2.6, -5.6], [1.6, -7.4, 0], [-1.6, -7.4, 0], [-2.6, -5.6]]);
    return { w: 15, ppcm: 14, edge: 0.15, g: [0, -1], sh: [
      S(O([[-6.8, -1.7, 0], [-5, -0.3, 0], [5, -0.3, 0], [6.8, -1.7, 0], [0, -2.3]]), c), F(ellipse(0, -1.8, 6.2, 0.8), tone(c, "shade"), 0.6), F(rect(-6.6, -1.9, 13.2, 0.3), BL, 0.8), F(O([[1.6, -2.1], [4.8, -2.3], [5.6, -1.8], [3, -1.4], [1.2, -1.6]]), "#5B3A2A", 0.9),
      { path: holed(ellipse(4.2, -4.4, 1.6, 1.9), [ellipse(4.2, -4.4, 0.75, 1)]), fill: c, evenodd: true }, ...body(cup, c, 0.2), F(rect(-3.4, -3.6, 6.8, 0.5), GOLD, 1, cup), F(rect(-3.4, -4.4, 6.8, 0.25), BL, 0.8, cup), ...[-1.8, 0, 1.8].map(x => F(ellipse(x, -3, 0.35), BL, 0.9)),
      S(rrect(-1.9, -8.2, 3.8, 1, 0.4), tone(c, "shade")), F(O([[-0.9, -7.6], [-0.2, -7.6], [-0.2, -4.4], [-0.5, -3.4], [-1, -4.8]]), "#5B3A2A", 0.9), F(O([[0.8, -7.6], [1.4, -7.4], [1.2, -5], [0.9, -4.2]]), "#5B3A2A", 0.9), S(ellipse(0, -8.9, 1.4, 0.45), "#C9A23A"),
    ] };
  },
  rags: k => {
    const n = cnt(k.p.n, 6, 10), r = k.r, first = k.c(""), tie: Vec2[] = [[-15, -45], [11, -51], [-10, -36], [13, -60], [-6, -30], [6, -47], [2, -56], [-3, -40], [0.5, -28], [8.5, -42]];
    const sh: Shape[] = [S(O([[-8, 0, 0], [8, 0, 0], [5, -3], [0, -4], [-5, -3]]), "#8A6A4A"), S(ellipse(-5, -1.4, 1.8, 1.3), GREY), R([[0, -2], [-1, -20], [1, -40], [3, -62]], TWIG, 2.4), R([[0, -24], [-10, -36], [-17, -48]], TWIG, 1.5), R([[1.5, -44], [10, -52], [14, -64]], TWIG, 1.4), R([[-1, -34], [-6, -42]], TWIG, 1), R([[2, -50], [-3, -58]], TWIG, 1)];
    const strip = (x: number, y: number, len: number, lean: number) => poly([[x - 1.2, y], [x + 1.2, y], [x + 1.2 + lean, y + len], [x + lean * 1.1, y + len - 1.8], [x - 1.2 + lean, y + len]]);
    for (let i = 0; i < n; i++) { const [x, y] = tie[i], len = r.range(12, 20), col = i === 0 && first ? first : r.pick(["#C8283A", "#3E8E4E", "#2F5FA8", "#E0A83A", "#E58FA0", "#7A3E6E", "#F0745F", "#F4EFE6"]), ls = r.pick([-1, 1]) * r.range(0.5, 1.6); sh.push(S(strip(x, y, len * 0.62, -ls * 1.3), tone(col, "shade")), S(strip(x, y, len, ls), col), L([[x + ls * 0.3, y + 2], [x + ls * 0.8, y + len - 3]], tone(col, "shade"), 0.35, 0.5), S(ellipse(x, y, 1.5, 1.1), tone(col, "shade"))); }
    return { w: 46, own: true, ppcm: 6, g: [0, -20], f: [0, 0], sh };
  },
  snow_globe: k => {
    const c = k.c("#2E3A59"), sp = ellipse(0, -11.6, 5.6), W0 = "#F6F1E4";
    return { w: 14, ppcm: 14, edge: 0.2, g: [0, -2], sh: [
      S(sp, "#CFE7F2"), F(ellipse(0, -6.6, 5, 1.7), W0, 1, sp), F(rect(-3.8, -9.2, 1.7, 2.8), "#E8A060", 1, sp), F(poly([[-4, -9.2], [-2.95, -10.4], [-1.9, -9.2]]), "#C4553A", 1, sp), F(rect(-1.9, -9.8, 1.5, 3.4), "#C4553A", 1, sp), F(ellipse(0.2, -9.6, 1.1, 1), "#B9A98A", 1, sp),
      F(rect(1.6, -13, 1.2, 6.6), "#B9A98A", 1, sp), F(poly([[1.3, -13], [3.1, -13], [2.2, -15.2]]), "#5F6B7A", 1, sp), F(rect(3.2, -9.6, 1.6, 3.2), "#D9B27A", 1, sp),
      ...[[-3.6, -13.6], [-1, -15.8], [3.8, -11.4], [-4.2, -10.6], [0.6, -12.8], [2, -16.8], [-2.4, -12.2], [4.4, -14.8], [-0.6, -9.4], [1, -14.4]].map(([x, y]) => F(ellipse(x, y, 0.28), "#FFFFFF", 0.95, sp)),
      F(ellipse(-2.4, -14.6, 1.2, 2.4), "#FFFFFF", 0.4, sp), { path: ellipse(0, -11.6, 5.5), stroke: { color: "#FFFFFF", width: 0.35 }, flat: true, opacity: 0.6 },
      S(O([[-6, 0, 0], [6, 0, 0], [5.4, -3.2], [-5.4, -3.2]]), c), ...lit(O([[-6, 0, 0], [6, 0, 0], [5.4, -3.2], [-5.4, -3.2]]), c, 0.2), S(rrect(-5.6, -4.4, 11.2, 1.3, 0.5), GOLD),
    ] };
  },
  hamsa: k => {
    const c = k.c("#2F6FB5");
    return { w: 18, ppcm: 14, edge: 0.2, g: [0, -23], sh: [
      R([[0, -23], [0, -20]], GOLD, 0.5), S(ellipse(0, -23.4, 1.1, 0.7), GOLD),
      ...[-1, 1].map(d => R([[d * 4.4, -3], [d * 7.2, -7.4], [d * 7.2, -12.4]], c, 2.7)),
      ...[[-3.9, -16.6], [-1.3, -18.8], [1.3, -18.8], [3.9, -16.6]].map(([x, y]) => R([[x, -8], [x, y]], c, 2.3)),
      ...body(O([[-4.8, -1, 0], [4.8, -1, 0], [5, -8, 0], [-5, -8, 0]]), c, 0.2), ...eye(0, -5.4, 2.2, tone(c, "deep")),
    ] };
  },
};

const charm = gen("charm", CHARM, "A lucky charm or keepsake: a nazar boncuğu (blue glass eye bead) on a string, a tespih (prayer beads with a tassel), a horseshoe, a fridge magnet with an Istanbul picture, a small Galata Tower souvenir, a Turkish coffee cup turned over on its saucer for fortune-telling, wishing rags tied on a twig, a snow globe with a tiny city, or a hamsa hand.",
  { ...LABEL, n: { type: "int", min: 1, max: 24, about: "how many, side by side; rags: strips on the twig (default 6, at most 10)" } },
  ["a2-w-at-nali", "a2-w-magnet", "a2-w-hediyelik-esya", "a2-w-fal", "b1-w-caput", "a1-w-fincan"], ["charm", "souvenir", "turkey"]);

// ---- cleaning ----------------------------------------------------------------------------------------------

/** A mop's head: strands fanned out from a collar at (0, y). */
const mopHead = (y: number): Shape[] => [...[-9, -6, -3, 0, 3, 6, 9].map((d, i) => R([[d * 0.2, y], [d * 1.1, y + 7], [d * 1.7, y + 14 + (i % 2) * 2]], i % 2 ? tone(CREAM, "shade") : CREAM, 1.9)), S(rrect(-2.6, y - 5, 5.2, 5.5, 1), STEEL)];
/** A hand brush (the dustpan's): bristles at the foot, the handle up. */
const handBrush = (hc: string): Shape[] => [S(rrect(-3.6, -8, 7.2, 8, 1), "#3A3D45"), W([[[-2.4, -7], [-2.4, -1]], [[0, -7], [0, -1]], [[2.4, -7], [2.4, -1]]], "#5B606A", 0.5, { flat: true }), S(rrect(-3.6, -11, 7.2, 4, 1.4), hc), R([[0, -11], [0.4, -25]], tone(hc, "light"), 3)];
/** A mop or broom handle from (x0, y0) up to (x1, y1), a dark cap on its end. */
const handle = (x0: number, y0: number, x1: number, y1: number): Shape[] => [R([[x0, y0], [x1, y1]], WOOD, 2.4), L([[x0 - 0.6, y0 - 2], [x1 - 0.6, y1 + 3]], tone(WOOD, "light"), 0.5, 0.8), S(rrect(x1 - 1.8, y1 - 1, 3.6, 5, 1.4), DARK)];
/** A yellow rubber glove, fingers up, its cuff on y = 0, thumb to the right. */
function glove(c: string): Shape[] {
  const palm = rrect(-5, -17, 10, 12.5, 3);
  return [
    ...[[-3.7, 13.5], [-1.2, 15.5], [1.3, 14], [3.8, 11]].map(([x, l]) => R([[x, -14], [x, -14 - l]], c, 2.5)), R([[4.4, -9], [7.8, -11.4], [9.2, -15.6]], c, 3),
    ...body(palm, c, 0.24), S(O([[-5.8, 0, 0], [5.8, 0, 0], [5.3, -5.5, 0], [-5.3, -5.5, 0]]), tone(c, "shade")), S(rrect(-6.3, -6.6, 12.6, 2.4, 1.2), tone(c, "light")), L([[-3.7, -16], [-3.6, -26]], "#FFFFFF", 0.6, 0.5), L([[-2.6, -8], [-2.8, -4.4]], tone(c, "deep"), 0.5, 0.4),
  ];
}

const CLEAN: Record<string, B> = {
  broom: k => {
    const c = k.c("#D9B35A"), o = poly([[-4.5, -34], [4.5, -34], [10, -24], [15, -6], ...Array.from({ length: 13 }, (_, i) => [15 - i * 2.5, i % 2 ? -1.4 : 0] as Vec2), [-15, -6], [-10, -24]]);
    return { w: 32, ppcm: 6, g: [0, -56], f: [0, 0], sh: [
      ...handle(0, -30, 0, -132), ...body(o, c, 0.3), ...[-9, -4.5, 0, 4.5, 9].map(x => L([[x * 0.3, -33], [x, -3]], tone(c, "shade"), 0.5, 0.6)),
      S(rrect(-6, -38, 12, 3.4, 1.2), RED), S(rrect(-9.6, -24, 19.2, 3, 1.2), RED),
    ] };
  },
  mop: k => {
    const c = k.c("#3E7CC4"), bk = O([[-15, -27, 0], [15, -27, 0], [11, 0, 0], [-11, 0, 0]]);
    if (k.held) return { w: 30, ppcm: 6, g: [0, -60], f: [0, 0], sh: [...handle(0, -17, 0, -128), ...mopHead(-6)] };
    return { w: 36, ppcm: 6, sh: [
      R([[-13, -25], [-12, -40], [0, -45], [12, -40], [13, -25]], STEEL, 1), ...handle(4, -26, 13, -126),
      ...body(bk, c, 0.25), S(rrect(-16, -30, 32, 3.6, 1.4), tone(c, "light")), F(poly([[-8, -19], [8, -19], [7, -10], [-7, -10]]), "#FFFFFF", 0.8), F(ellipse(0, -14.5, 1.6, 2.4), c, 0.9),
      ...[0, 1, 2, 3, 4].map(i => R([[-1 - i * 1.7, -31], [-8 - i * 1.7, -34], [-17.4 + i * 0.5, -28], [-17 + i * 1.5, -13 - (i % 3) * 3.5]], i % 2 ? tone(CREAM, "shade") : CREAM, 2.4)),
    ] };
  },
  dustpan: k => {
    const c = k.c("#D9534A"), tray = O([[-14, 0, 0], [14, 0, 0], [12, -15, 0], [-12, -15, 0]]);
    const pan = [
      R([[2, -13], [3, -36]], tone(c, "shade"), 3.2), ...body(tray, c, 0.25), F(O([[-11.4, -2.6, 0], [11.4, -2.6, 0], [9.8, -12.6, 0], [-9.8, -12.6, 0]]), tone(c, "light"), 0.55), F(rect(-10, -14.6, 20, 2.6), tone(c, "deep"), 0.35, tray), L([[-12.6, -1], [12.6, -1]], tone(c, "light"), 0.8, 0.7),
      { path: holed(ellipse(3, -40.5, 4.6, 3.6), [ellipse(3, -40.5, 2.4, 1.6)]), fill: c, evenodd: true },
    ];
    return { w: 46, ppcm: 8, sh: mv([...pan, ...T(handBrush(tone(c, "light")), mul(translate(24, 0), rotate(0.1)))], -7, 0), h: mv(pan, -2.9, 34) };
  },
  sponge: k => {
    const c = k.c("#EFD25A"), o = rrect(-5.5, -6.2, 11, 6.2, 1.6);
    return { w: 14, ppcm: 16, g: [0, -3], sh: [
      S(poly([[-5, -6], [-3.8, -7.6], [4.6, -7.6], [5.2, -6]]), tone(c, "light")), ...body(o, c, 0.18), S(rrect(-5.5, -2.6, 11, 2.6, [0, 0, 1.6, 1.6]), "#4E9A5A"), F(rect(-5.5, -2.6, 11, 0.5), tone("#4E9A5A", "deep"), 0.5, o),
      ...[[-3.4, -4.6, 0.7], [-0.6, -5.2, 0.5], [2.2, -4.2, 0.8], [4, -5.4, 0.45], [0.8, -3.6, 0.4]].map(([x, y, r]) => F(ellipse(x, y, r, r * 0.75), tone(c, "deep"), 0.55)),
    ] };
  },
  dish_soap: k => {
    const c = k.c("#E8C93A"), o = O([[-3.8, 0, 0], [3.8, 0, 0], [4.4, -2], [4.6, -12], [3.4, -17.5], [1.8, -19.8, 0], [-1.8, -19.8, 0], [-3.4, -17.5], [-4.6, -12], [-4.4, -2]]), cap = tone(c, "deep");
    return { w: 11, ppcm: 14, g: [0, -20.5], text: lab(k, -3.4, -13.8, 6.8, 3, 1.6), sh: [
      S(rrect(-1.7, -24.8, 3.4, 3.6, 0.8), cap), S(rrect(0.4, -25.8, 3.8, 1.7, 0.6), cap), S(rrect(-2.1, -21.6, 4.2, 2, 0.6), tone(cap, "shade")), ...body(o, c, 0.22),
      S(rrect(-3.8, -15, 7.6, 10.6, 1.2), "#FBF8F2"), F(O([[0, -10.2, 0], [1.5, -7.6], [0, -5.2], [-1.5, -7.6]]), "#3E8E4E"), F(ellipse(2.2, -9.4, 0.6), "#7FC4E4"), F(ellipse(-2.3, -6, 0.45), "#7FC4E4"),
    ] };
  },
  detergent: k => {
    const c = k.c("#3F8FD0"), o = O([[-7.2, 0, 0], [7.2, 0, 0], [8, -3], [8, -16], [6.4, -20.4], [3, -23.6, 0], [-3.6, -23.6, 0], [-6.4, -20.4], [-8, -16], [-8, -3]]);
    return { w: 20, ppcm: 11, g: [6.5, -19.5], text: lab(k, -6, -16.8, 12, 3.4, 2.4, "#1F3D6B"), sh: [
      S(rrect(-6.4, -27.4, 6.4, 3.6, 0.9), "#7FC4E4"), S(rrect(-5.8, -26, 5, 1, 0.4), "#5FA6C8"),
      { path: holed(rrect(2.4, -27.8, 8.2, 8.6, 3.2), [rrect(4.4, -25.8, 4.2, 4.2, 1.6)]), fill: tone(c, "shade"), evenodd: true }, ...body(o, c, 0.2),
      S(rrect(-7.4, -17.6, 14.8, 14.6, 1.4), "#FBF8F2"), F(O([[-7.4, -6.6], [-3.4, -8.8], [0.6, -6.4], [4.6, -8.8], [7.4, -6.8], [7.4, -3], [-7.4, -3]]), c, 0.9), F(ellipse(-4, -10.6, 0.7), "#7FC4E4"), F(ellipse(5, -10, 0.55), "#7FC4E4"),
    ] };
  },
  rag: k => {
    const c = k.c("#7FA7C9"), W0 = "#F4EFE6", chk = { w: 1.8, h: 1.8, shapes: [S(rect(0, 0, 0.9, 1.8), c, { opacity: 0.6 }), S(rect(0, 0, 1.8, 0.9), c, { opacity: 0.6 })] };
    const dr = (o: Path): Shape[] => [S(o, W0), { path: o, tile: chk, flat: true, opacity: 0.9 }, ...lit(o, W0, 0.14)];
    const cr = (pts: Vec2[]) => L(pts, tone(c, "shade"), 0.4, 0.5), th = (segs: Vec2[][]) => W(segs, CREAM, 0.5);
    return { w: 30, ppcm: 12,
      sh: [...dr(O([[-11, 0, 0], [12, 0, 0], [14, -2.6], [12.6, -5.6], [8.4, -6.8], [5, -9.2], [0.4, -8], [-3.6, -9.6], [-8.6, -7.2], [-12.6, -5.6], [-13.6, -2.4]])), cr([[-9, -5.4], [-6.4, -3], [-2.4, -4.4]]), cr([[2, -7.6], [3.6, -4], [7.4, -2.4]]), cr([[-0.5, -3.6], [0.6, -1.2]]), th([[[13.4, -1], [16.4, -0.2]], [[13.9, -2.2], [16.8, -1.8]], [[13.2, -3.6], [16, -3.8]]])],
      h: [...dr(O([[0, 0, 0], [7, 4], [10.6, 12], [10, 22], [5, 25], [0, 22.6], [-4.6, 25.4], [-10, 22], [-10.6, 12], [-7, 4]])), cr([[-5, 6], [0, 11], [-3, 18]]), cr([[4, 9], [2.6, 16]]), th([[[-6, 25], [-6.6, 27.6]], [[-2, 24.6], [-2.2, 27.4]], [[2.4, 24.2], [2.6, 27]], [[6, 24.6], [6.6, 27.4]]])] };
  },
  bin: k => {
    const c = k.c("#C9CED3"), o = rrect(-12.5, -37, 25, 37, [1, 1, 4, 4]), lid = mix(c, "#26272C", 0.55);
    return { w: 30, ppcm: 8, g: [0, -44], sh: [
      ...body(o, c, 0.2), F(rect(-13, -4, 26, 4), tone(c, "deep"), 0.7, o), S(rrect(-6, -3.4, 12, 3.8, 1.4), "#3B3B40"),
      S(O([[-13.8, -36, 0], [13.8, -36, 0], [13.2, -39.5], [8, -43], [-8, -43], [-13.2, -39.5]]), lid), S(rrect(-3.6, -45.8, 7.2, 3.4, 1.4), tone(lid, "shade")), L([[-9, -41], [-3, -42.2]], tone(lid, "light"), 0.8, 0.6),
    ] };
  },
  bin_bag: k => {
    const c = k.c("#2E3036"), o = O([[-9, 0, 0], [9, 0, 0], [17, -7], [19, -19], [14, -33], [6, -41], [3.5, -44, 0], [-3.5, -44, 0], [-6, -41], [-14, -33], [-19, -19], [-17, -7]]);
    return { w: 40, ppcm: 7, g: [0, -47], sh: [
      P([[-3, -48], [-8.4, -53.4], [-5, -55.4, 0], [-1, -49]], tone(c, "shade")), P([[3, -48], [8, -52], [6, -55.6, 0], [1, -49]], tone(c, "shade")), ...body(o, c, 0.3), S(O([[-3.8, -43, 0], [3.8, -43, 0], [3, -48.4, 0], [-3, -48.4, 0]]), tone(c, "light")),
      L([[-12, -30], [-15, -18], [-12, -8]], tone(c, "light"), 1.2, 0.6), F(ellipse(-9, -27, 1.8, 5), "#FFFFFF", 0.25), L([[-3, -42], [-8, -31]], tone(c, "deep"), 0.7, 0.6), L([[3, -42], [6, -32], [10, -22]], tone(c, "deep"), 0.7, 0.5),
    ] };
  },
  dishes: k => {
    const n = cnt(k.p.n, 5), rim = k.c("#3F74C4"), sh: Shape[] = [], pw = 22, th = 1.7, W0 = "#F4F1EA";
    for (let i = 0; i < n; i++) { const y = -(i + 1) * th, dx = ((i * 7) % 5 - 2) * 0.3; sh.push(S(rrect(-pw / 2 + dx, y, pw, th * 1.2, 0.8), i % 3 ? W0 : tone(W0, "shade")), F(rect(-pw / 2 + 1 + dx, y + 0.35, pw - 2, 0.35), rim, 0.85)); }
    const top = -n * th - 0.6;
    sh.push(F(ellipse(0, top, 10.6, 2.4), rim), F(ellipse(0, top, 9.4, 1.9), W0), F(O([[-7, top + 0.2], [-3, top - 1], [-1, top + 0.3], [-4, top + 1.1]]), "#8A5A3C", 0.8), F(ellipse(3, top - 0.1, 2.4, 0.8), RED, 0.75), F(ellipse(6.4, top + 0.5, 0.5), "#8A5A3C", 0.8), F(ellipse(5.4, top - 0.9, 0.35), "#8A5A3C", 0.8));
    const bw = rrect(-8, top - 6.4, 16, 6.4, [0.6, 0.6, 6, 6]);
    sh.push(...body(bw, W0, 0.2), F(rect(-8, top - 5.2, 16, 0.5), rim, 0.85, bw), F(ellipse(0, top - 6.4, 7.8, 1.5), "#8A5A3C"), F(ellipse(0, top - 6.5, 6.2, 1), "#A8733F", 0.8), R([[3, top - 6.4], [8, top - 12], [9, top - 14]], STEEL, 1));
    const stack = [...sh], mg = rrect(14, -8.2, 7.4, 8.2, [1, 1, 2, 2]);
    sh.push({ path: holed(ellipse(22.2, -4.2, 2.8, 3), [ellipse(22.2, -4.2, 1.3, 1.6)]), fill: RED, evenodd: true }, ...body(mg, RED, 0.2), F(ellipse(17.7, -8.2, 3.4, 0.9), "#5B3A2A"));
    return { w: 46, own: true, ppcm: 8, sh, h: mv(stack, -10.5, 4) };
  },
  dish_rack: k => {
    const n = cnt(k.p.n, 4, 8), step = n > 1 ? Math.min(5.4, 34 / (n - 1)) : 0, x0 = -(n - 1) * step / 2 - 2, W0 = "#F4F1EA", rim = k.c("#3F74C4"), sh: Shape[] = [S(rrect(-23, -3.6, 46, 3.6, 1.4), "#A9B0B6"), F(rect(-22, -3, 44, 0.7), tone("#A9B0B6", "light"), 0.7)];
    for (let i = 0; i < n; i++) { const x = x0 + i * step; sh.push(S(ellipse(x, -17.6, 3.8, 11), W0), F(holed(ellipse(x, -17.6, 3.8, 11), [ellipse(x, -17.6, 3.3, 10.4)]), rim, 0.9), F(ellipse(x + 0.4, -17.6, 2.6, 8.2), tone(W0, "shade"), 0.5)); }
    const cd = rrect(17.5, -15, 6.4, 11.4, 1.2);
    sh.push(...[0, 1, 2].map(i => R([[19.4 + i * 1.8, -14], [18.4 + i * 2.6, -23 - (i % 2) * 2]], STEEL, 0.9)), ...body(cd, "#7FA7C9", 0.25), W([...Array.from({ length: 15 }, (_, i) => [[-21 + i * 3, -6.4], [-21 + i * 3, -12.6]] as Vec2[]), [[-21, -12.6], [15, -12.6]], [[-21, -6.4], [15, -6.4]]], STEEL, 0.55));
    return { w: 52, own: true, ppcm: 8, g: [0, -8], sh };
  },
  spray: k => {
    const c = k.c("#69B7E0"), o = O([[-4.2, 0, 0], [4.2, 0, 0], [4.4, -1.5], [4.4, -15], [3.6, -19.5], [2.2, -21.5, 0], [-2.2, -21.5, 0], [-3.6, -19.5], [-4.4, -15], [-4.4, -1.5]]);
    return { w: 17, ppcm: 14, g: [1.2, -23.4], sh: [
      ...body(o, c, 0.25), F(rect(-4.4, -21.5, 8.8, 4), "#FFFFFF", 0.3, o), L([[-0.8, -22], [-1.4, -1.5]], "#FFFFFF", 0.5, 0.6), S(rrect(-3.6, -15, 7.2, 8.4, 1.2), "#FBF8F2"), F(O([[0, -13.4, 0], [1.6, -10.4], [0, -8], [-1.6, -10.4]]), "#3E8E4E"),
      S(rrect(-2.8, -23.6, 5.6, 2.4, 0.8), "#F4F1EA"), P([[-3.4, -31, 0], [5.4, -31, 0], [5.8, -24, 0], [-3, -23.6, 0]], "#F4F1EA"), S(rrect(-9, -29.6, 6.4, 2.8, 1), "#F4F1EA"), S(rrect(-10, -29.2, 1.8, 2, 0.6), GREY),
      S(O([[-2.2, -23.4], [-5.2, -24.6], [-6.2, -19], [-4.4, -15.6], [-3, -17.6]]), STEEL),
    ] };
  },
  gloves: k => {
    const c = k.c("#F2C230"), pr = (d: number) => [...mv(mirror(glove(c)), -d, 0), ...mv(glove(c), d, 0)];
    return { w: 37, ppcm: 12, h: T(mv(pr(4.4), 0, 4), rotate(Math.PI)), sh: pr(8.2) };
  },
  bucket: k => {
    const c = k.c("#E0A83A"), bk = O([[-15, -26, 0], [15, -26, 0], [11.5, 0, 0], [-11.5, 0, 0]]);
    return { w: 36, ppcm: 10, g: [0, -37], sh: [
      R([[-14, -24], [-12, -40], [0, -44], [12, -40], [14, -24]], STEEL, 1.1), ...body(bk, c, 0.25), S(rrect(-16, -29, 32, 3.4, 1.4), tone(c, "light")), F(rect(-13, -19, 26, 1), tone(c, "deep"), 0.4, bk), F(rect(-12, -9, 24, 1), tone(c, "deep"), 0.4, bk), S(rrect(-5, -14, 10, 5, 1), tone(c, "shade")),
    ] };
  },
  soap: k => {
    const c = k.c("#9DB872"), o = rrect(-5, -3.8, 10, 3.8, 1.4);
    return { w: 12, ppcm: 16, edge: 0.2, g: [0, -2], sh: [
      S(poly([[-4.6, -3.7], [-3.4, -5.1], [5.6, -5.1], [4.6, -3.7]]), tone(c, "light")), ...body(o, c, 0.2), F(rrect(-3.2, -3, 6.4, 2.2, 0.6), tone(c, "deep"), 0.35),
      ...[[6.4, -6, 1.4], [8.2, -9, 0.9], [4.6, -9.4, 0.7]].map(([x, y, r]) => ({ path: ellipse(x, y, r), fill: "#DDF0F7", stroke: { color: "#FFFFFF", width: 0.2 }, flat: true, opacity: 0.6 } as Shape)),
    ] };
  },
  brush: k => {
    const c = k.c("#D2A672"), o = O([[-9.5, -3.6, 0], [9.5, -3.6, 0], [10, -6], [7.5, -8.8], [-7.5, -8.8], [-10, -6]]);
    return { w: 22, ppcm: 16, g: [0, -5], sh: [
      S(rect(-9.2, -3.7, 18.4, 3.7), "#C9B079"), W(Array.from({ length: 12 }, (_, i) => [[-8.4 + i * 1.53, -3.4], [-8.4 + i * 1.53, -0.2]] as Vec2[]), tone("#C9B079", "deep"), 0.35, { flat: true }), ...body(o, c, 0.2), L([[-6, -6.6], [4, -6.6]], tone(c, "deep"), 0.4, 0.5), F(ellipse(5.5, -6.2, 0.6, 0.5), tone(c, "deep"), 0.6),
    ] };
  },
};

const cleaning = gen("cleaning", CLEAN, "A cleaning thing: a straw broom, a mop in its bucket, a dustpan with its brush, a sponge, a bottle of washing-up liquid, a detergent bottle, a checked rag, a pedal bin, a tied black bin bag, a stack of dirty dishes, a dish-drying rack with plates, a spray bottle, a pair of yellow rubber gloves, a scrubbing brush, a plain bucket or a bar of soap.",
  { ...LABEL, n: { type: "int", min: 1, max: 24, about: "how many, side by side; dishes: plates in the stack (default 5); dish_rack: plates (default 4, at most 8)" } },
  ["a2-w-bulasik-deterjani", "a2-w-deterjan", "a2-w-bez", "a1-w-cop-kutusu", "a2-w-cop", "a1-w-bulasik", "a1-w-temizlik", "a1-w-firca", "a2-w-eldiven", "a1-w-temizlik-yapmak", "a2-w-silmek"], ["cleaning", "home"]);

// ---- laundry -----------------------------------------------------------------------------------------------

const PEG = "#D9B27A";
/** A clothes peg standing on its jaws at (x, y). */
const peg = (x: number, y: number, c = PEG): Shape[] => [S(rrect(x - 1.4, y - 7.6, 1.4, 7.6, 0.5), c), S(rrect(x, y - 7.6, 1.4, 7.6, 0.5), tone(c, "shade")), S(ellipse(x, y - 3.6, 1.6, 0.8), STEEL), F(rect(x - 1.3, y - 7.6, 0.4, 7.6), tone(c, "light"), 0.5)];
/** A peg clipped over the line at x (the line at y = 0). */
const clip = (x: number): Shape[] => [S(rrect(x - 1.2, -3.4, 2.4, 6.6, 0.8), PEG), F(rect(x - 1.2, 0.2, 2.4, 0.5), STEEL, 0.9)];
/** Four things that hang from a line (a tee, trousers, a towel, a pair of socks), from y = 0 down, pegged. */
const GARM: ((c: string) => Shape[])[] = [
  c => { const o = O([[-6, 0, 0], [6, 0, 0], [19, 6, 0], [16, 12, 0], [13, 10, 0], [13, 44, 0], [-13, 44, 0], [-13, 10, 0], [-16, 12, 0], [-19, 6, 0]]); return [...body(o, c, 0.2), F(ellipse(0, 1.4, 4.4, 2.6), tone(c, "deep"), 0.8), L([[-13, 40], [13, 40]], tone(c, "shade"), 0.5, 0.6), L([[-4, 6], [-6, 38]], tone(c, "shade"), 0.5, 0.35), ...clip(-8), ...clip(8)]; },
  c => { const o = O([[-11, 0, 0], [11, 0, 0], [12, 62, 0], [1.8, 62, 0], [0, 18, 0], [-1.8, 62, 0], [-12, 62, 0]]); return [...body(o, c, 0.2), F(rect(-11, 0, 22, 3.4), tone(c, "shade"), 0.6, o), L([[0, 3.4], [0, 18]], tone(c, "deep"), 0.5, 0.6), L([[-9, 4], [-6.5, 12]], tone(c, "deep"), 0.5, 0.5), ...clip(-8), ...clip(8)]; },
  c => { const o = rrect(-17, 0, 34, 66, 1.4); return [...body(o, c, 0.14), F(rect(-17, 52, 34, 2.6), tone(c, "light"), 0.85, o), F(rect(-17, 56, 34, 1.2), tone(c, "light"), 0.85, o), W(Array.from({ length: 12 }, (_, i) => [[-16 + i * 2.9, 66], [-16 + i * 2.9, 69]] as Vec2[]), tone(c, "shade"), 0.5, { flat: true }), ...clip(-12), ...clip(12)]; },
  c => [-6, 6].flatMap((x, i) => { const s = i ? mix(c, "#FFFFFF", 0.6) : c, o = O([[-3, 0, 0], [3, 0, 0], [3.2, 15], [10, 20], [10.6, 26], [7, 28], [-3.4, 26], [-3.2, 15]]); return [...mv([...body(o, s, 0.25), F(rect(-3, 0, 6, 3.4), tone(s, "shade"), 0.6, o), F(ellipse(-0.4, 21, 2, 3), tone(s, "light"), 0.5)], x, 0), ...clip(x)]; }),
];

const LAUNDRY: Record<string, B> = {
  basket: k => {
    const c = k.c("#5FA8D3"), r = k.r, o = O([[-24, -35, 0], [24, -35, 0], [20.5, -3], [18, 0, 0], [-18, 0, 0], [-20.5, -3]]), cl = [0, 1, 2, 3].map(() => r.pick(MIXC));
    return { w: 56, ppcm: 6, g: [-24, -33], sh: [
      S(blob(-11, -37, 12, 7.5, r), cl[0]), S(blob(7, -40, 12, 8, r), cl[1]), S(blob(17, -36, 8, 6, r), cl[2]), L([[-17, -39], [-10, -36], [-4, -40]], tone(cl[0], "shade"), 0.6, 0.6), L([[1, -43], [8, -40], [14, -43]], tone(cl[1], "shade"), 0.6, 0.6),
      R([[-19, -38], [-27, -34], [-28, -24]], cl[3], 5.4), R([[19, -38], [25, -32], [24, -22]], "#F4F1EA", 3.6), ...body(o, c, 0.2),
      ...[-27, -19, -11].flatMap((y, j) => Array.from({ length: 5 }, (_, i) => F(rrect(-20 + i * 8 + (j % 2) * 3.5, y, 6, 2.4, 1.2), tone(c, "deep"), 0.7, o))),
      S(rrect(-25.6, -37.4, 51.2, 4.4, 1.8), tone(c, "light")), F(ellipse(-22, -35.2, 2.6, 1), tone(c, "deep"), 0.8), F(ellipse(22, -35.2, 2.6, 1), tone(c, "deep"), 0.8),
    ] };
  },
  line: k => {
    const n = cnt(k.p.n, 4, 10), r = k.r, gw = 38, W0 = n * gw + 30, H = 150, rope = "#D9D2C0", first = k.c("");
    const cols = Array.from({ length: n }, (_, i) => i === 0 && first ? first : r.pick(MIXC.slice(0, 8)));
    if (k.held) return { w: 80, ppcm: 5, g: [0, 0], sh: [R([[-38, 0], [0, 3], [38, 0]], rope, 0.9), ...mv(GARM[0](cols[0]), -17, 1), ...mv(GARM[1](cols[1 % n]), 20, 1)] };
    const sag = (x: number) => 4 * (1 - (2 * x / W0) ** 2), post = (x: number): Shape[] => [S(rrect(x - 1.3, -H - 8, 2.6, H + 8, 1), STEEL), S(ellipse(x, -H - 8, 2.2), tone(STEEL, "shade")), S(rrect(x - 7, -3, 14, 3, 1.2), tone(STEEL, "shade")), R([[x, -H], [x - 5 * Math.sign(x), -H + 5]], STEEL, 1)];
    const more: FlatSpec[] = cols.map((c, i) => ({ group: { shapes: GARM[i % 4](c), edge: 0.35 }, ppcm: 5, id: "laundry", x: (i - (n - 1) / 2) * gw, y: H - sag((i - (n - 1) / 2) * gw), z: 1, move: { sway: { rot: r.range(0.03, 0.055), ms: r.range(2600, 3800) }, phase: r() } }));
    return { w: W0 + 14, ppcm: 4, own: true, more, sh: [...post(-W0 / 2), ...post(W0 / 2), R([[-W0 / 2, -H], [0, -H + 4], [W0 / 2, -H]], rope, 0.8)] };
  },
  drying_rack: k => {
    const c = k.c("#C9CED3"), r = k.r, n = cnt(k.p.n, 3, 12), rails = [-96, -84, -72, -60, -48], post = (x: number, s: number) => S(O([[x - 2, -102, 0], [x + 2, -102, 0], [x + 3 * s, 0, 0], [x - 3 * s, 0, 0]]), c);
    if (k.held) return { w: 14, ppcm: 6, g: [0, -60], f: [0, 0], sh: [R([[-4, -100], [-4, -2]], c, 1.8), R([[4, -100], [4, -2]], c, 1.8), W([...rails, -36, -24, -12].map(y => [[-4, y], [4, y]] as Vec2[]), tone(c, "shade"), 1.1)] };
    const hang = (x: number, y: number, w: number, h: number, col: string): Shape[] => [S(rrect(x - w / 2, y - 1.4, w, h, [1.2, 1.2, 2.4, 2.4]), col), F(rect(x + w * 0.3, y, w * 0.2, h - 2), tone(col, "shade"), 0.5), L([[x - w * 0.2, y + 3], [x - w * 0.25, y + h - 3]], tone(col, "shade"), 0.5, 0.5), S(rrect(x - w / 2 - 0.6, y - 2.4, w + 1.2, 2.6, 1.2), tone(col, "light"))];
    return { w: 112, own: true, ppcm: 6, sh: [
      S(rrect(-53, -2.4, 12, 2.4, 1), DARK), S(rrect(41, -2.4, 12, 2.4, 1), DARK), post(-48, 1), post(48, -1), W([[[-46, -22], [46, -22]]], c, 1.4),
      ...Array.from({ length: n }, (_, i) => hang(r.range(-34, 34), rails[i % 4] + 0.5, r.range(20, 32), r.range(22, 36), r.pick(MIXC))).flat(),
      W(rails.map(y => [[-47, y], [47, y]] as Vec2[]), tone(c, "light"), 1.5),
    ] };
  },
  pegs: k => {
    const c = k.c(PEG), n = cnt(k.p.n, 6);
    return { w: n * 3.7, own: true, ppcm: 16, edge: 0.12, g: [0, -3], sh: row(n, 3.2, 0.7, (x, i) => mv(T(peg(0, 0, c), rotate((i - (n - 1) / 2) * 0.05)), x, 0)) };
  },
  powder: k => {
    const c = k.c("#3F74C4"), x0 = -10, W0 = "#FBF8F2", t = lab(k, -8, -23, 16, 5, 3.6, "#1F3D6B");
    return { w: 27, ppcm: 10, g: [0, -6], text: t, sh: [
      S(poly([[10, -28], [14, -30.4], [14, -2.4], [10, 0]]), tone(c, "shade")), S(poly([[x0, -28], [x0 + 4, -30.4], [14, -30.4], [10, -28]]), tone(c, "light")),
      S(rect(x0, -28, 20, 28), c), F(rect(x0, -25.4, 20, 0.6), tone(c, "deep"), 0.5), S(rrect(-8.8, -24, 17.6, 7, 1.2), W0), ...(t.length ? [] : [F(ellipse(-3, -20.5, 1.6), c, 0.9), F(ellipse(1, -19.6, 1.1), "#7FC4E4"), F(ellipse(4, -21.2, 1.4), c, 0.7)]),
      F(smooth([[x0 - 1, -9], [-5, -12.6], [0, -9], [5, -12.6], [11, -9.4], [11, -3.4], [x0 - 1, -3.4]], true, 1), W0, 0.9, rect(x0, -28, 20, 28)), F(ellipse(-4, -15, 1.1), "#7FC4E4", 0.9), F(ellipse(2, -14.4, 0.8), "#7FC4E4", 0.9), F(ellipse(6.4, -16, 1.3), "#7FC4E4", 0.9),
    ] };
  },
  hanger: k => {
    const wire = !!k.p.wire, c = k.c(wire ? "#B8BEC4" : "#C79A63"), w = wire ? 0.7 : 1.9, hk = wire ? c : GOLD;
    return { w: 46, gap: 2, ppcm: 12, g: [2.4, -15.4], sh: [
      R([[-21, -1], [21, -1]], c, w), R([[-21, -1], [-10, -7], [0, -9], [10, -7], [21, -1]], c, w), R([[0, -9], [0, -12.6], [2.4, -15.4], [4.2, -13.5], [3, -11.8]], hk, wire ? 0.7 : 1),
      ...(wire ? [] : [L([[-19, -2.4], [-9, -7.4]], tone(c, "light"), 0.5, 0.8), L([[-18, -1.8], [18, -1.8]], tone(c, "shade"), 0.4, 0.5)]),
    ] };
  },
  coat_stand: k => {
    const c = k.c("#6B4A35"), r = k.r, n = cnt(k.p.n, 2, 5), cl = Array.from({ length: n }, () => r.pick(MIXC.slice(0, 8)));
    const arm = (x: number, y: number, d: number): Shape[] => [R([[0, y + 6], [d * 9, y + 1], [d * 13, y - 6]], c, 2.2), S(ellipse(d * 13, y - 7, 1.9), tone(c, "light"))];
    const coat = (x: number, y: number, h: number, col: string): Shape[] => { const o = O([[x - 5, y, 0], [x + 5, y, 0], [x + 16, y + 6, 0], [x + 17, y + h, 0], [x - 17, y + h, 0], [x - 16, y + 6, 0]]); return [...body(o, col, 0.2), L([[x, y + 3], [x - 2, y + 18], [x, y + h]], tone(col, "deep"), 0.6, 0.6), ...[0, 1, 2].map(i => F(ellipse(x + 3, y + 14 + i * 9, 0.9), tone(col, "deep"), 0.8))]; };
    const things: ((i: number) => Shape[])[] = [
      i => coat(-15, -130, 78, cl[i]), i => [R([[15, -130], [14, -98]], cl[i], 5), R([[19, -130], [20, -92]], tone(cl[i], "shade"), 4.6), F(rect(12, -112, 8, 1.6), "#F4F1EA", 0.8), F(rect(17, -108, 8, 1.6), "#F4F1EA", 0.8)],
      i => [S(ellipse(0, -182, 10.6, 2.4), tone(cl[i], "shade")), S(rrect(-6.4, -193, 12.8, 11, [4, 4, 1, 1]), cl[i]), F(rect(-6.4, -186.6, 12.8, 2.2), tone(cl[i], "deep"), 0.7)],
      i => [R([[-7, -158], [-13, -146]], DARK, 0.8), ...body(rrect(-24, -148, 22, 18, 3), cl[i], 0.2), F(rect(-24, -143, 22, 1), tone(cl[i], "deep"), 0.6)],
      i => coat(15, -160, 52, cl[i]),
    ];
    const sh = [R([[0, -176], [0, -12]], c, 3.4), R([[0, -8], [-14, -4], [-22, 0]], c, 3), R([[0, -8], [14, -4], [22, 0]], c, 3), S(ellipse(0, -2.5, 8, 3.2), tone(c, "shade")), S(ellipse(0, -179, 3.4), tone(c, "light")), ...arm(0, -160, -1), ...arm(0, -160, 1), ...arm(0, -124, -1), ...arm(0, -124, 1), L([[-0.8, -172], [-0.8, -16]], tone(c, "light"), 0.5, 0.6)];
    const hungs = things.slice(0, n).flatMap((f, i) => f(i));
    return { w: 56, own: true, ppcm: 4, g: [0, -100], f: [0, 0], sh: [...sh, ...hungs] };
  },
  ironing: k => {
    const n = cnt(k.p.n, 4, 10), r = k.r, sh: Shape[] = []; let y = 0;
    for (let i = 0; i < n; i++) { const w = r.range(36, 46), h = r.range(6, 9), dx = r.range(-3, 3), c = r.pick(MIXC); sh.push(...body(rrect(dx - w / 2, y - h, w, h, 3), c, 0.14), L([[dx - w * 0.3, y - h * 0.5], [dx + w * 0.1, y - h * 0.5 + 0.8]], tone(c, "shade"), 0.5, 0.5), ...(i % 2 ? [S(rrect(dx + w / 2 - 5, y - h * 0.8, 9, h * 0.6, 2.4), tone(c, "light"))] : [])); y -= h - 0.4; }
    return { w: 56, own: true, ppcm: 7, g: [0, 0], sh: [...sh, ...mv(IRON(k.c("#4F6E9E")), 4, y + 0.4)] };
  },
  iron: k => ({ w: 36, ppcm: 12, g: [-1.9, -9], sh: IRON(k.c("#4F6E9E")) }),
};
/** A steam iron on its sole, toe to the right. */
const IRON = (c: string): Shape[] => [S(poly([[-12, 0], [12, 0], [17, -2.6], [-12, -2.6]]), STEEL), { path: holed(rrect(-10.4, -16.6, 17, 9.4, 3.8), [rrect(-7.4, -13.8, 11, 4.4, 2)]), fill: tone(c, "shade"), evenodd: true }, ...body(O([[-11, -2.4, 0], [12.4, -2.4, 0], [11, -8], [3, -10.4], [-8, -9.6], [-11.2, -6]]), c, 0.22), F(ellipse(6, -6, 1.6, 1.1), "#F4F1EA", 0.9), ...[0, 1, 2].map(i => F(ellipse(-6 + i * 3, -4.6, 0.5), tone(c, "deep"), 0.7))];

const laundry = gen("laundry", LAUNDRY, "A laundry thing: a basket of clothes, a washing line with pegs and a few garments swaying, a clothes horse with clothes over it, clothes pegs, a box of washing powder, a coat hanger (wire or wood), a standing coat stand with coats, a pile of clothes waiting to be ironed under an iron, or the iron.",
  { ...LABEL, wire: { type: "bool", default: false, about: "hanger: a thin wire one, not wooden" }, n: { type: "int", min: 1, max: 24, about: "how many, side by side; line: garments (default 4, at most 10); drying_rack: garments (default 3, at most 12); pegs: pegs (default 6); coat_stand: things hung (default 2, at most 5); ironing: clothes in the pile (default 4, at most 10)" } },
  ["a1-w-camasir", "a1-w-aski", "a1-w-utu", "a2-w-utulemek"], ["laundry", "home"]);

// ---- linen -------------------------------------------------------------------------------------------------

/** A printed tile over an outline (a check, flowers, stitching). */
const tiled = (path: Path, tile: { w: number; h: number; shapes: Shape[] }, op = 1): Shape => ({ path, tile, flat: true, opacity: op });
/** A folded cloth lying on y = `y` at x, `w` × `h`: its fold, its light, the layers of its loose edge. */
const slab = (x: number, y: number, w: number, h: number, c: string, r = 3): Shape[] => {
  const o = rrect(x - w / 2, y - h, w, h, r);
  return [...body(o, c, 0.14), F(rect(x - w / 2, y - h, w, h * 0.2), tone(c, "light"), 0.45, o), ...[0.7, 0.45, 0.2].map(k => L([[x + w / 2 - 8, y - h * k], [x + w / 2 - 0.4, y - h * k]], tone(c, "deep"), 0.45, 0.7))];
};
const TOWELS = ["#3FA0A0", "#E8D5B0", "#C4553A", "#F4EFE6", "#6E8FB5", "#E0A83A"];

const LINEN: Record<string, B> = {
  pillow: k => {
    const c = k.c("#F4EFE6"), o = O([[-24, -3, 0], [-12, -1], [0, -0.4], [12, -1], [24, -3, 0], [26, -15], [24, -27, 0], [12, -29.2], [0, -29.8], [-12, -29.2], [-24, -27, 0], [-26, -15]]);
    return { w: 50, ppcm: 8, g: [0, -10], sh: T([
      ...body(o, c, 0.18), { path: O([[-21, -6, 0], [0, -4.6], [21, -6, 0], [20, -15], [21, -24, 0], [0, -25.6], [-21, -24, 0], [-20, -15]]), stroke: { color: tone(c, "shade"), width: 0.3, dash: [1, 0.8] }, flat: true, opacity: 0.7 },
      L([[-24, -4], [-18, -9]], tone(c, "shade"), 0.5, 0.5), L([[24, -4], [18, -9]], tone(c, "shade"), 0.5, 0.5), L([[-24, -26], [-17, -21]], tone(c, "shade"), 0.5, 0.45), L([[24, -26], [17, -21]], tone(c, "shade"), 0.5, 0.45), F(ellipse(-9, -20, 9, 2.4), tone(c, "light"), 0.5),
    ], scale(0.93, 1.32)) };
  },
  quilt: k => {
    const c = k.c("#C6657A"), o = rrect(-40, -24, 80, 24, 7), q = { w: 8, h: 8, shapes: [S(poly([[0, 0], [0.5, 0], [8, 7.5], [8, 8], [7.5, 8], [0, 0.5]]), tone(c, "deep")), S(poly([[8, 0], [8, 0.5], [0.5, 8], [0, 8], [0, 7.5], [7.5, 0]]), tone(c, "deep"))] };
    return { w: 84, ppcm: 6, g: [0, -8], sh: [
      ...body(o, c, 0.16), tiled(o, q, 0.6), { path: rrect(-37, -21, 74, 18, 5), stroke: { color: tone(c, "light"), width: 0.5, dash: [1.4, 1] }, flat: true, opacity: 0.8 }, F(rect(-40, -24, 80, 5), tone(c, "light"), 0.35, o), F(rect(31, -24, 9, 24), tone(c, "deep"), 0.3, o), L([[-36, -12], [-30, -13]], tone(c, "deep"), 0.4, 0.4),
    ] };
  },
  towel: k => {
    const c = k.c("#3FA0A0"), b = tone(c, "light");
    return { w: 44, ppcm: 10, g: [0, -4], sh: [...slab(0, 0, 40, 10, c, 1.6), F(rect(-14, -10, 1.6, 10), b, 0.9), F(rect(-11.6, -10, 0.7, 10), b, 0.9), F(rect(12.4, -10, 1.6, 10), b, 0.9), F(rect(10.7, -10, 0.7, 10), b, 0.9)] };
  },
  towels: k => {
    const n = cnt(k.p.n, 4, 12), first = k.c(""), sh: Shape[] = [];
    for (let i = 0; i < n; i++) { const c = first ? mix(first, "#FFFFFF", (i % 3) * 0.22) : TOWELS[i % 6]; sh.push(...slab(((i * 5) % 7 - 3) * 0.5, -i * 8, 40, 8.6, c, 1.8), F(rect(-13 + ((i * 5) % 7 - 3) * 0.5, -i * 8 - 8.6, 1.4, 8.6), tone(c, "light"), 0.8), F(rect(11.6 + ((i * 5) % 7 - 3) * 0.5, -i * 8 - 8.6, 1.4, 8.6), tone(c, "light"), 0.8)); }
    return { w: 44, own: true, ppcm: 10, g: [0, 0], sh };
  },
  cushion: k => {
    const c = k.c("#B5483E"), cr = "#F2E6B3", o = O([[-20, -9, 0], [-8, -10.4], [8, -10.4], [20, -9, 0], [22, -24], [20, -49, 0], [8, -47.6], [-8, -47.6], [-20, -49, 0], [-22, -24]]);
    const tas = (x: number): Shape[] => [R([[x, -9], [x, -6]], GOLD, 0.9), S(ellipse(x, -5.6, 1.6), GOLD), S(O([[x - 2.4, -4.6, 0], [x + 2.4, -4.6, 0], [x + 3.4, 0, 0], [x - 3.4, 0, 0]]), mix(GOLD, c, 0.3)), L([[x - 1, -4], [x - 1.4, -0.6]], tone(GOLD, "light"), 0.4, 0.7), L([[x + 1, -4], [x + 1.4, -0.6]], tone(GOLD, "deep"), 0.4, 0.7)];
    return { w: 48, ppcm: 8, g: [0, -16], sh: [
      ...tas(-19), ...tas(19), ...body(o, c, 0.2), F(poly([[0, -43], [11, -28.5], [0, -14], [-11, -28.5]]), cr, 0.95), F(poly([[0, -38], [6.6, -28.5], [0, -19], [-6.6, -28.5]]), "#2F8C88", 0.95), F(ellipse(0, -28.5, 1.8), cr),
      ...[[-14, -42], [14, -42], [-14, -15], [14, -15]].map(([x, y]) => F(poly([[x, y - 2.6], [x + 2.2, y], [x, y + 2.6], [x - 2.2, y]]), cr, 0.9)), { path: O([[-17, -14, 0], [17, -14, 0], [18.4, -28.5], [17, -43, 0], [-17, -43, 0], [-18.4, -28.5]]), stroke: { color: cr, width: 0.35, dash: [1.2, 0.8] }, flat: true, opacity: 0.8 },
    ] };
  },
  sheet: k => {
    const c = k.c("#9CC5DB"), o = rrect(-23, -12, 46, 12, 3), fl = { w: 5, h: 5, shapes: [S(ellipse(1.2, 1.2, 0.55), tone(c, "light")), S(ellipse(3.7, 3.7, 0.55), tone(c, "light")), S(ellipse(1.2, 1.2, 0.2), tone(c, "deep")), S(ellipse(3.7, 3.7, 0.2), tone(c, "deep"))] };
    return { w: 50, ppcm: 9, g: [0, -4], sh: [...slab(0, 0, 46, 12, c, 3), tiled(o, fl, 0.75), F(rect(-23, -9.6, 46, 0.5), tone(c, "shade"), 0.7, o), F(rect(-23, -8.6, 46, 0.3), tone(c, "shade"), 0.5, o)] };
  },
  tablecloth: k => {
    const c = k.c("#C8283A"), o = rrect(-22, -14, 44, 14, 3), gh = { w: 5, h: 5, shapes: [S(rect(0, 0, 2.5, 5), c, { opacity: 0.55 }), S(rect(0, 0, 5, 2.5), c, { opacity: 0.55 })] };
    return { w: 48, ppcm: 9, g: [0, -5], sh: [...slab(0, 0, 44, 14, "#F6F1E4", 3), tiled(o, gh, 0.95), F(rect(-22, -14, 44, 2.6), c, 0.85, o), F(rect(-22, -1.8, 44, 1.8), c, 0.85, o)] };
  },
  blanket: k => {
    const c = k.c("#6E8FB5"), o = rrect(-31, -16, 62, 16, 4);
    return { w: 66, ppcm: 8, g: [0, -6], sh: [
      ...slab(0, 0, 62, 16, c, 4), ...[-27, -24.6, 23, 25.4].map((x, i) => F(rect(x, -16, i % 2 ? 0.8 : 1.6, 16), i < 2 ? "#F4EFE6" : "#F4EFE6", 0.9, o)), F(rect(-21, -16, 1.2, 16), "#E0A83A", 0.9, o), F(rect(19.8, -16, 1.2, 16), "#E0A83A", 0.9, o),
      W(Array.from({ length: 8 }, (_, i) => [[31, -14.5 + i * 2], [34, -14.2 + i * 2]] as Vec2[]), tone(c, "light"), 0.45, { flat: true }),
    ] };
  },
};

const linen = gen("linen", LINEN, "Linen: a pillow, a folded quilt (yorgan), a folded towel, a stack of towels, a kırlent cushion with tassels, a folded bed sheet with a flower print, a folded gingham tablecloth or a folded striped blanket.",
  { n: { type: "int", min: 1, max: 24, about: "how many, side by side; towels: towels in the stack (default 4, at most 12)" } },
  ["a1-w-yastik", "a2-w-yorgan", "b1-w-havlu", "a2-w-ortu"], ["linen", "bed", "home"]);

// ---- rugs --------------------------------------------------------------------------------------------------

const RCR = "#EADFC4", RNV = "#2E3A59", RGD = "#C79A4B";
/** The rug's rectangle (x from -w/2, y from 0 down the floor), inset by t. */
const inset = (w: number, d: number, t: number) => rect(-w / 2 + t, t, w - 2 * t, d - 2 * t);
const diamond = (cx: number, cy: number, hx: number, hy: number) => poly([[cx - hx, cy], [cx, cy - hy], [cx + hx, cy], [cx, cy + hy]]);
/** Fringe strands out of the short ends. */
function fringe(w: number, d: number, c: string): Shape {
  const segs: Vec2[][] = [], g = 2;
  if (w >= d) for (let y = 1; y < d; y += g) for (const s of [-1, 1]) segs.push([[s * w / 2, y], [s * (w / 2 + 5), y + 0.7]]);
  else for (let x = -w / 2 + 1; x < w / 2; x += g) for (const s of [0, 1]) segs.push([[x, s * d], [x + 0.7, s * d + (s ? 5 : -5)]]);
  return W(segs, c, 0.6, { flat: true });
}
const lobed = (rx: number, ry: number, s: number): Path => O([[0, -ry * s, 0], [rx * 0.4 * s, -ry * 0.55 * s], [rx * s, 0, 0], [rx * 0.4 * s, ry * 0.55 * s], [0, ry * s, 0], [-rx * 0.4 * s, ry * 0.55 * s], [-rx * s, 0, 0], [-rx * 0.4 * s, -ry * 0.55 * s]]);
/** A pointed prayer arch, its feet on `base`, rising to `apex`. */
const arch = (r: number, base: number, spring: number, apex: number): Path => O([[-r, base, 0], [-r, spring, 0], [-r * 0.86, spring - (spring - apex) * 0.42], [-r * 0.45, spring - (spring - apex) * 0.8], [0, apex, 0], [r * 0.45, spring - (spring - apex) * 0.8], [r * 0.86, spring - (spring - apex) * 0.42], [r, spring, 0], [r, base, 0]]);

interface Rug { w: number; d: number; c: string; draw(w: number, d: number, c: string, label: string): { sh: Shape[]; text?: TextSpec[] } }
/** A flat-woven kilim or a runner: border, stripes at the ends, rows of triangles, a chain of nested diamonds. */
function weave(w: number, d: number, c: string) {
  const bt = Math.max(2, Math.min(w, d) * 0.09), dark = tone(c, "deep"), fx = -w / 2 + bt, fy = bt, fw = w - 2 * bt, fh = d - 2 * bt, sb = Math.min(fw * 0.07, fh * 0.2), ts = fh * 0.1, zx = fx + sb * 1.5, zw = fw - sb * 3;
  const m = Math.max(1, Math.round(zw / (fh * 1.25))), pitch = zw / m, cy = d / 2, hy = (fh / 2 - ts * 1.3) * 0.96, hx = pitch * 0.46, tri = { w: ts * 1.5, h: ts, shapes: [S(poly([[0, ts], [ts * 0.75, 0], [ts * 1.5, ts]]), RCR)] };
  const sh: Shape[] = [S(rect(-w / 2, 0, w, d), dark), F(inset(w, d, bt * 0.75), RCR, 0.9), F(inset(w, d, bt), c)];
  for (const s of [-1, 1]) sh.push(F(rect(s < 0 ? fx : fx + fw - sb, fy, sb, fh), RNV), F(rect(s < 0 ? fx + sb : fx + fw - sb * 1.4, fy, sb * 0.4, fh), RCR));
  sh.push(tiled(rect(zx, fy, zw, ts), tri), tiled(rect(zx, fy + fh - ts, zw, ts), tri));
  for (let i = 0; i < m; i++) { const x = zx + (i + 0.5) * pitch; for (const [s, col] of [[1, RCR], [0.78, dark], [0.58, RCR], [0.4, RNV], [0.18, RCR]] as const) sh.push(F(diamond(x, cy, hx * s, hy * s), col)); if (i) sh.push(F(diamond(x - pitch / 2, cy, pitch * 0.08, hy * 0.4), RCR)); }
  sh.push(F(poly([[zx, fy + ts * 1.1], [zx + pitch * 0.12, cy], [zx, fy + fh - ts * 1.1]]), RNV, 0.8), F(poly([[zx + zw, fy + ts * 1.1], [zx + zw - pitch * 0.12, cy], [zx + zw, fy + fh - ts * 1.1]]), RNV, 0.8), fringe(w, d, RCR));
  return { sh };
}

const RUGS: Record<string, Rug> = {
  kilim: { w: 200, d: 130, c: "#A8402F", draw: weave },
  carpet: { w: 240, d: 160, c: "#8E2F3A", draw(w, d, c) {
    const bandC = RGD, t = [0, d * 0.03, d * 0.04, d * 0.055, d * 0.15, d * 0.162, d * 0.172], s = d * 0.045, dm = { w: s, h: s, shapes: [S(poly([[0, s / 2], [s / 2, 0], [s, s / 2], [s / 2, s]]), RCR)] };
    const sh: Shape[] = [S(rect(-w / 2, 0, w, d), RNV), F(inset(w, d, t[1]), RCR), F(inset(w, d, t[2]), RNV), F(inset(w, d, t[3]), tone(bandC, "shade")), F(inset(w, d, t[4]), RNV), F(inset(w, d, t[5]), RCR), F(inset(w, d, t[6]), c)];
    const b0 = t[3] + (t[4] - t[3] - s) / 2, bw = w - 2 * b0;
    sh.push(tiled(rect(-w / 2 + b0, b0, bw, s), dm, 0.9), tiled(rect(-w / 2 + b0, d - b0 - s, bw, s), dm, 0.9), tiled(rect(-w / 2 + b0, b0 + s, s, d - 2 * b0 - 2 * s), dm, 0.9), tiled(rect(w / 2 - b0 - s, b0 + s, s, d - 2 * b0 - 2 * s), dm, 0.9));
    const fw = w - 2 * t[6], fh = d - 2 * t[6], cy = d / 2, ry = fh * 0.46, rx = Math.min(ry * 1.5, fw * 0.4), L1 = fh * 0.36;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = sx * fw / 2, y = cy + sy * fh / 2; for (const [k, col] of [[1, RNV], [0.62, RGD]] as const) sh.push(F(O([[x, y, 0], [x - sx * L1 * 1.5 * k, y, 0], [x - sx * L1 * 0.6 * k, y - sy * L1 * 0.5 * k], [x, y - sy * L1 * k, 0]]), col, 0.92)); }
    for (const [k, col] of [[1, RNV], [0.9, RGD], [0.78, tone(c, "shade")], [0.58, RCR], [0.42, RNV], [0.22, RGD]] as const) sh.push(F(lobed(rx, ry, k).move(0, cy), col));
    sh.push(F(ellipse(0, cy, ry * 0.07), RCR), fringe(w, d, RCR));
    return { sh };
  } },
  doormat: { w: 70, d: 45, c: "#B58B5A", draw(w, d, c, label) {
    const k = Math.min(w, d) / 45;
    return { sh: [S(rect(-w / 2, 0, w, d), c), { path: holed(rect(-w / 2, 0, w, d), [inset(w, d, 3 * k)]), fill: tone(c, "deep"), flat: true, evenodd: true, opacity: 0.85 }, { path: inset(w, d, 4.4 * k), stroke: { color: tone(c, "light"), width: 0.5 * k }, flat: true, opacity: 0.8 }, ...(label ? [] : [tiled(rect(-w / 2 + 7 * k, d / 2 - 3 * k, w - 14 * k, 6 * k), { w: 4 * k, h: 3 * k, shapes: [S(poly([[0, 0], [k, 0], [2 * k, 1.6 * k], [3 * k, 0], [4 * k, 0], [2 * k, 3 * k]]), tone(c, "deep"))] })])],
      ...(label ? { text: [{ text: label, x: -w / 2 + 6 * k, y: d / 2 - 6 * k, w: w - 12 * k, h: 12 * k, size: 7 * k, font: "print" as const, weight: 700, color: "#3B2A1E" }] } : {}) };
  } },
  prayer_rug: { w: 70, d: 110, c: "#2E6B55", draw(w, d, c) {
    const t = [0, w * 0.05, w * 0.07, w * 0.17, w * 0.185], fx = t[4], fw = w - 2 * fx, fh = d - 2 * fx, r = fw * 0.43, base = fx + fh * 0.88, spring = fx + fh * 0.42, apex = fx + fh * 0.1, niche = mix(c, "#FFFFFF", 0.16);
    const sh: Shape[] = [S(rect(-w / 2, 0, w, d), tone(c, "deep")), F(inset(w, d, t[1]), RCR), F(inset(w, d, t[2]), RGD), F(inset(w, d, t[3]), RCR), F(inset(w, d, t[4]), c), F(arch(r, base, spring, apex), RCR), F(arch(r * 0.88, base, spring + 1, apex + fw * 0.07), RGD), F(arch(r * 0.74, base, spring + 2, apex + fw * 0.15), niche)];
    sh.push(W([[[0, apex + fw * 0.15], [0, apex + fw * 0.27]]], RGD, 0.5, { flat: true }), F(diamond(0, apex + fw * 0.33, fw * 0.035, fw * 0.06), RGD), F(ellipse(0, apex + fw * 0.4, fw * 0.025), RCR));
    for (const x of [-r * 0.45, 0, r * 0.45]) sh.push(W([[[x, base], [x, base - fw * 0.1]]], tone("#3E8E4E", "shade"), 0.5, { flat: true }), F(O([[x - fw * 0.03, base - fw * 0.09, 0], [x, base - fw * 0.17], [x + fw * 0.03, base - fw * 0.09, 0], [x, base - fw * 0.1]]), x ? "#E8799A" : "#C8283A"));
    for (let i = 0; i < 5; i++) sh.push(F(diamond(-fw * 0.36 + i * fw * 0.18, fx + fh * 0.95, fw * 0.05, fh * 0.025), RCR, 0.85));
    sh.push(fringe(w, d, RCR));
    return { sh };
  } },
  runner: { w: 240, d: 70, c: "#2F4A7A", draw: weave },
};

/** A rug rolled up, its end showing the turns, a cord round it: `L` long, `dm` thick. */
function roll(L: number, dm: number, c: string): Shape[] {
  const o = rrect(-L / 2, -dm / 2, L, dm, dm * 0.3), rp = "#6B4A35";
  return [
    ...body(o, c, 0.12), ...[0.22, 0.5, 0.78].map(k => F(rect(-L / 2 + L * k, -dm / 2, L * 0.07, dm), k === 0.5 ? RCR : tone(c, "deep"), 0.85, o)),
    ...[0.12, 0.62].map(k => F(rect(-L / 2 + L * k, -dm / 2, 1.6, dm), rp, 0.9, o)), S(ellipse(L / 2, 0, dm * 0.3, dm / 2), tone(c, "deep")), F(ellipse(L / 2, 0, dm * 0.21, dm * 0.38), c, 0.9), F(ellipse(L / 2, 0, dm * 0.13, dm * 0.25), RCR, 0.8), F(ellipse(L / 2, 0, dm * 0.06, dm * 0.12), tone(c, "deep"), 0.9),
  ];
}

const rug: PieceDef = { draw(p) {
  const kind = str(p.kind, "kilim"), q = RUGS[kind] ?? RUGS.kilim, w = Math.max(10, Math.min(600, num(p.w, q.w))), d = Math.max(10, Math.min(600, num(p.d, q.d))), c = hex(p.color, q.c);
  if (p.held) return one("rug", T(roll(Math.max(30, Math.min(Math.min(w, d) + 10, 120)), Math.max(7, Math.min(18, Math.sqrt(w * d) / 12)), c), rotate(-0.32)), 6, true);
  const n = Math.max(1, Math.min(8, Math.round(num(p.n, 1)))), step = w + 14, xs = (i: number) => (i - (n - 1) / 2) * step, one1 = q.draw(w, d, c, str(p.label, "").trim());
  const sh = n > 1 ? Array.from({ length: n }, (_, i) => mv(one1.sh, xs(i), 0)).flat() : one1.sh, text = n > 1 && one1.text ? Array.from({ length: n }, (_, i) => one1.text!.map(t => ({ ...t, x: t.x + xs(i) }))).flat() : one1.text;
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: 0.3 });
  return { flats: [{ group: { shapes: sh, edge: 0.3 }, pitch: -Math.PI / 2, ppcm: Math.min(3, 1900 / Math.max(x1 - x0, y1 - y0)), lit: 1, id: "rug", ...(text ? { text } : {}) }] };
}, variants: Object.fromEntries(Object.keys(RUGS).map(k => [k, { kind: k }])),
  meta: {
    about: "A rug laid flat on the floor, seen from above: a flat-woven kilim with a diamond, a pile carpet with border and medallion, a doormat (with words if given), a small prayer rug with its arch, or a long narrow runner; held, rolled up under the arm.",
    params: {
      kind: { type: "enum", values: Object.keys(RUGS), default: "kilim" },
      w: { type: "num", min: 10, max: 600, about: "width, cm (kilim 200, carpet 240, doormat 70, prayer_rug 70, runner 240)" },
      d: { type: "num", min: 10, max: 600, about: "depth, cm (kilim 130, carpet 160, doormat 45, prayer_rug 110, runner 70)" },
      n: { type: "int", min: 1, max: 8, default: 1, about: "how many, side by side, a hand's width apart" },
      color: { type: "color", about: "the field's colour (a palette id or a hex); each kind has its own" },
      label: { type: "text", about: "doormat: the words on it" },
    },
    terms: ["a1-w-hali"], tags: ["rug", "floor", "home"],
  } };

// ---- sewing ------------------------------------------------------------------------------------------------

const SEW = ["#C8283A", "#2F5FA8", "#E0A83A", "#3E8E4E", "#F0745F", "#7A3E6E", "#F4EFE6", "#2F8C88", "#E58FA0"];

const SEWING: Record<string, B> = {
  machine: k => {
    const c = k.c("#B9D3CC"), tl = "#3E8E9A", o = poly([[-18, -29], [-16, -31], [17, -31], [20.5, -28.5], [21, -24], [21, -1.6], [19.4, 0], [-19.4, 0], [-21, -1.6], [-21, -5.2], [-19.6, -6.4], [9, -6.4], [9, -19], [-8, -19], [-8, -10], [-10, -8.6], [-16, -8.6], [-18, -10]]);
    return { w: 56, ppcm: 8, g: [4, -32], sh: mv([
      S(poly([[-29, -6.4], [-8, -6.4], [-8, -8.2], [-29, -8.2]]), "#F6F1E4"), W([[[-28, -7.3], [-9, -7.3]]], tone("#F6F1E4", "deep"), 0.3, { flat: true }),
      R([[-4, -31], [-4, -34.4], [6, -34.4], [6, -31]], DARK, 1.7), R([[12, -31], [12, -36]], GREY, 0.6), S(rrect(9.4, -41, 5.2, 4.6, 0.7), SEW[0]), S(rrect(8.8, -41.6, 6.4, 1, 0.4), WOOD), S(rrect(8.8, -37, 6.4, 1, 0.4), WOOD),
      S(rrect(21, -26, 3, 12, 1.2), DARK), S(ellipse(24.4, -20, 1.3), GREY),
      ...body(o, c, 0.14), F(rect(-18, -25, 39, 2.4), tl, 0.95, o), F(rect(9, -19, 12, 12), tone(c, "shade"), 0.35, o), S(ellipse(13, -12, 2.3), tl), F(ellipse(12.4, -12.6, 0.8), "#FFFFFF", 0.5), ...[0, 1, 2].map(i => F(ellipse(-3 + i * 4, -22, 0.8), tone(c, "deep"), 0.8)),
      L([[11.4, -40.2], [3, -37.4], [-3, -33.4], [-13, -28], [-13, -20.5], [-13, -9.4]], SEW[0], 0.35, 0.9), R([[-13, -9], [-13, -4.4]], STEEL, 0.7), S(rrect(-15.6, -8.4, 5, 1.8, 0.5), STEEL), S(rrect(-17, -6.9, 8, 0.8, 0.3), STEEL),
    ], 3, 0) };
  },
  threads: k => {
    const n = cnt(k.p.n, 3), r = k.r, first = k.c("");
    const spool = (x: number, c: string): Shape[] => [S(rrect(x - 2.6, -5.8, 5.2, 0.9, 0.4), "#D9B27A"), S(rrect(x - 2.6, -0.9, 5.2, 0.9, 0.4), "#D9B27A"), ...mv(body(rrect(-2.2, -4.9, 4.4, 4, 0.6), c, 0.25), x, 0), W([-3.9, -2.9, -1.9].map(y => [[x - 2.1, y], [x + 2.1, y]] as Vec2[]), tone(c, "shade"), 0.25, { flat: true }), R([[x + 1.6, -4.9], [x + 2.6, -6.8], [x + 4, -7]], c, 0.3)];
    return { w: n * 6.2, own: true, ppcm: 16, edge: 0.12, g: [0, -3], sh: row(n, 5.4, 0.8, (x, i) => spool(x, first || r.pick(SEW))) };
  },
  pins: k => {
    const n = cnt(k.p.n, 9), r = k.r, c = k.c("#C8283A"), o = ellipse(0, -4.4, 6, 4.4), sh: Shape[] = [];
    for (let i = 0; i < n; i++) { const a = (n > 1 ? i / (n - 1) - 0.5 : 0) * 2.4, x = Math.sin(a) * 4.2, y = -8.2 + (1 - Math.cos(a)) * 2, dx = Math.sin(a * 1.15), dy = -Math.cos(a * 1.15); sh.push(W([[[x, y], [x + dx * 5.4, y + dy * 5.4]]], STEEL, 0.28), S(ellipse(x + dx * 5.6, y + dy * 5.6, 0.62), r.pick(SEW))); }
    return { w: 18, ppcm: 16, edge: 0.15, g: [0, -3], sh: [
      ...sh, S(o, c), F(ellipse(2.4, -2.6, 4.4, 3.4), tone(c, "shade"), 0.5, o), F(ellipse(-2.6, -6.2, 1.6, 1), tone(c, "light"), 0.7), ...[-3.6, -1.4, 1.4, 3.6].map(x => L([[x * 0.3, -8.6], [x * 1.5, -4.4], [x * 0.5, -0.4]], tone(c, "light"), 0.25, 0.6)),
      S(poly(Array.from({ length: 10 }, (_, i) => [Math.sin(i * 0.628) * (i % 2 ? 1.2 : 2.6), -8.4 - Math.cos(i * 0.628) * (i % 2 ? 0.5 : 1.1)] as Vec2)), "#3E8E4E"),
      W([[[-5, -3.4], [-12, -7.4]]], STEEL, 0.3), R([[-11.6, -7.2], [-14, -4.4], [-12, -1.6]], SEW[2], 0.3),
    ] };
  },
  buttons: k => {
    const c = k.c("#3F74C4"), r = k.r, tin = rrect(-8, -6.4, 16, 6.4, 1.2), bt = (x: number, y: number, rr: number): Shape[] => { const col = r.pick(SEW); return [S(ellipse(x, y, rr), col), F(holed(ellipse(x, y, rr * 0.72), [ellipse(x, y, rr * 0.6)]), tone(col, "light"), 0.7), ...(rr > 0.9 ? [[-0.3, -0.3], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3]].map(([a, b]) => F(ellipse(x + a * rr, y + b * rr, rr * 0.13), DARK, 0.85)) : [])]; };
    const heap = [[-6, -7.3], [-3.6, -7.3], [-1.2, -7.3], [1.2, -7.3], [3.6, -7.3], [6, -7.3], [-4.8, -9.4], [-2.4, -9.4], [0, -9.4], [2.4, -9.4], [4.8, -9.4], [-2.2, -11.5], [0.4, -11.5], [2.6, -11.5], [-0.8, -13.4]];
    return { w: 36, ppcm: 12, edge: 0.2, g: [0, -4], sh: [
      ...heap.flatMap(([x, y], i) => bt(x, y, 1.15 + (i % 3) * 0.1)), ...body(tin, c, 0.2), S(rrect(-8.4, -6.8, 16.8, 1.4, 0.6), tone(c, "light")), F(rect(-8, -4.6, 16, 1.6), "#F4EFE6", 0.85, tin), ...[-5, -2.5, 0, 2.5, 5].map(x => F(ellipse(x, -3.8, 0.45), c, 0.9)),
      ...bt(12.4, -1.1, 1.1), ...bt(15.8, -1.2, 1.2), ...bt(13.6, -3.2, 1),
    ] };
  },
  tape: k => {
    const c = k.c("#F2C230"), sp: Vec2[] = [[2.6, -2.6], [5.4, -0.9], [9, -0.8], [13, -1.5], [17, -1.2], [21, -0.7]], yAt = (x: number) => { for (let i = 1; i < sp.length; i++) if (x <= sp[i][0]) return sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * (x - sp[i - 1][0]) / (sp[i][0] - sp[i - 1][0]); return sp[5][1]; };
    return { w: 22, ppcm: 16, edge: 0.12, g: [-6.3, -3.5], sh: T(mv([
      S(band(sp, [1.6, 1.6, 1.6, 1.6, 1.6, 1.6]), c), W(Array.from({ length: 15 }, (_, i) => { const x = 6 + i * 1.1, y = yAt(x), h = i % 5 ? 0.35 : 0.65; return [[x, y - h], [x, y + h]] as Vec2[]; }), DARK, 0.15, { flat: true }), S(rrect(20.8, -1.5, 1.8, 1.6, 0.3), STEEL),
      S(ellipse(0, -5, 4.8), c), ...[3.8, 2.6, 1.4].map(r => ({ path: ellipse(0, -5, r), stroke: { color: tone(c, "shade"), width: 0.3 }, flat: true, opacity: 0.8 })), F(ellipse(0, -5, 0.8), DARK), F(ellipse(-1.8, -6.8, 1.2, 0.7), "#FFFFFF", 0.5),
    ], -9, 0), scale(0.7)) };
  },
  hoop: k => {
    const c = k.c("#E8799A"), cy = -9.6, cx = 0, petal = (a: number) => ellipse(0, -2.4, 1.5, 2.6).transform(mul(translate(cx, cy - 2), rotate(a))), lf = (a: number) => ellipse(0, -2, 0.9, 2).transform(mul(translate(0, -4.6), rotate(a)));
    return { w: 22, ppcm: 14, edge: 0.2, g: [0, -2], sh: [
      S(ellipse(0, cy, 8.4, 8.6), "#F6F1E4"), F(ellipse(0, cy, 8.4, 8.6), "#FFFFFF", 0.2),
      ...Array.from({ length: 6 }, (_, i) => F(petal(i * 1.047), i % 2 ? c : tone(c, "light"))), ...Array.from({ length: 6 }, (_, i) => ({ path: poly([[0, -1.2], [0, -4.2]], false).transform(mul(translate(cx, cy - 2), rotate(i * 1.047))), stroke: { color: tone(c, "deep"), width: 0.25 }, flat: true, opacity: 0.6 } as Shape)),
      F(ellipse(0, cy - 2, 1.3), "#E0A83A"), ...[[-0.5, -0.4], [0.5, 0.3], [0.2, -0.7]].map(([x, y]) => F(ellipse(x, cy - 2 + y, 0.28), tone("#E0A83A", "deep"))), L([[0, cy + 1.2], [0.4, -3.6]], "#3E8E4E", 0.5, 0.95), F(lf(0.9).move(0.4, 0), "#3E8E4E"), F(lf(-0.9).move(0, 0.4), "#4E9A5A"),
      { path: holed(ellipse(0, cy, 9.4, 9.6), [ellipse(0, cy, 8, 8.2)]), fill: "#D9B27A", evenodd: true }, 
      S(rrect(-2, -21.8, 4, 2.8, 0.6), tone("#D9B27A", "shade")), R([[0, -22], [0, -24.4]], STEEL, 1), S(ellipse(0, -24.6, 2.2, 1), STEEL),
    ] };
  },
  fabric: k => {
    const r = k.r, c = k.c(r.pick(["#4F8FA8", "#C4553A", "#7A3E6E", "#6F7A45", "#E0A83A"])), o = rrect(-9, -110, 18, 110, 3), pat = k.i % 2 ? { w: 4.4, h: 4.4, shapes: [S(rect(0, 0, 4.4, 1.4), RCR)] } : { w: 5, h: 5, shapes: [S(ellipse(1.2, 1.2, 0.8), RCR), S(ellipse(3.7, 3.7, 0.8), RCR)] };
    const tail = O([[-5.6, -110, 0], [6.8, -110, 0], [7, -80], [3.6, -76.6], [0, -79.4], [-3.2, -77], [-6, -80.4]]);
    return { w: 20, gap: 2, ppcm: 8, g: [0, -58], f: [0, 0], sh: [
      ...body(o, c, 0.25), tiled(o, pat, 0.8), S(ellipse(0, -110, 9, 2.6), tone(c, "shade")), ...[6.8, 4.6, 2.4].map(rx => ({ path: ellipse(0, -110, rx, rx * 0.29), stroke: { color: tone(c, "deep"), width: 0.3 }, flat: true, opacity: 0.6 } as Shape)),
      F(tail.move(1.5, 1.7), tone(c, "deep"), 0.4, o), F(tail, mix(c, "#FFFFFF", 0.16)), tiled(tail, pat, 0.8), F(rect(4.8, -110, 2.2, 32), tone(c, "deep"), 0.45, tail), L([[-6, -80.4], [-3.2, -77], [0, -79.4], [3.6, -76.6], [7, -80]], tone(c, "light"), 0.6, 0.7),
    ] };
  },
  thimble: k => {
    const c = k.c("#C3C8CE"), o = O([[-3.6, 0, 0], [3.6, 0, 0], [3.2, -3.4], [3, -5.2], [1.6, -6.4], [-1.6, -6.4], [-3, -5.2], [-3.2, -3.4]]);
    return { w: 3.4, ppcm: 16, edge: 0.1, g: [0, -1], sh: T([...body(o, c, 0.25), S(rrect(-3.9, -1.5, 7.8, 1.5, 0.6), tone(c, "light")), ...[[-1.8, -4.8], [0, -5.6], [1.8, -4.8], [-1.8, -3], [0, -3.4], [1.8, -3], [-0.9, -1.4], [0.9, -1.4]].map(([x, y]) => F(ellipse(x, y - 0.1, 0.35), tone(c, "deep"), 0.7))], scale(0.35)) };
  },
};

const sewing = gen("sewing", SEWING, "Sewing: a sewing machine with a cloth under its needle, thread spools in a row, a tomato pin cushion bristling with pins and a needle, a tin of buttons with some spilled, a yellow tape measure, an embroidery hoop with a flower stitched, a bolt of printed fabric with its loose end, or a thimble.",
  { n: { type: "int", min: 1, max: 24, about: "how many, side by side; threads: spools (default 3); pins: pins (default 9)" } },
  ["a2-w-dikis", "b1-w-kumas", "b1-w-igne", "a2-w-dikis-dikmek"], ["sewing", "home"]);

export const set: Record<string, PieceDef> = { rug };
export const props: Record<string, PieceDef> = { cleaning, laundry, linen, rug, sewing, charm };
