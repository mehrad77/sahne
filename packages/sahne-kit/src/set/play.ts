// Props of the play family (STYLE.md): sport, outings and toys. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { smooth, ellipse, rect, rrect, poly, tone, mul, rotate, translate, apply, arcPoints, groupBounds, Path, type Kit, type PieceDef, type PieceOut, type FlatSpec, type EmitSpec, type Shape, type TextSpec, type Tile, type Vec2, type Rng } from "sahne";
import { S, P, num, str } from "./draw.ts";

/** How high a hanging hand grips above the floor (cm, puppet scale). */
const GRIP = 46;
const DARK = "#2E2F35", STEEL = "#B8BEC4", GOLD = "#E0B030", CREAM = "#F3EBD8", WHITE = "#F7F3EA", RED = "#D9342B", BLUE = "#2F6FB8", WOOD = "#C79A63";

type Prm = Record<string, unknown>;
const col = (kit: Kit, v: unknown, d: string) => typeof v === "string" ? kit.color(v, d) : d;
const cnt = (v: unknown, d = 1, mx = 24) => Math.max(1, Math.min(mx, Math.round(num(v, d))));
const T = (sh: Shape[], m: [number, number, number, number, number, number]): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Shapes turned by `a` about the point `g`, which becomes the origin (the grip). */
const turn = (sh: Shape[], g: Vec2, a: number) => T(sh, mul(rotate(a), translate(-g[0], -g[1])));
/** Shapes scaled by `k` about the origin: strokes, dashes and tiles too. */
const zoom = (sh: Shape[], k: number): Shape[] => sh.map(s => ({ ...s, path: s.path.scaled(k), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.scaled(k)) : s.clip.scaled(k) } : {}), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * k, ...(s.stroke.dash ? { dash: s.stroke.dash.map(d => d * k) } : {}) } } : {}), ...(s.tile ? { tile: { ...s.tile, w: s.tile.w * k, h: s.tile.h * k, x: (s.tile.x ?? 0) * k, y: (s.tile.y ?? 0) * k, shapes: zoom(s.tile.shapes, k) } } : {}) }));
/** `sh` turned by `a` about the grip `g`, then scaled until its lowest point is `drop` below the grip: a thing too big for a puppet hand. */
const fit = (sh: Shape[], g: Vec2, a: number, drop = GRIP): Shape[] => { const t = turn(sh, g, a), y1 = groupBounds({ shapes: t, edge: 0 })[3]; return y1 > drop ? zoom(t, drop / y1) : t; };
/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a strap, a string, a rod. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** A printed line (flat), cut to `clip`. */
const ln = (pts: Vec2[], color: string, width: number, clip?: Path, op = 1): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A ring, printed or cut. */
const ring = (x: number, y: number, rx: number, ry: number, color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: ellipse(x, y, rx, ry), stroke: { color, width }, ...o });
const tiled = (path: Path, tile: Tile, op = 1): Shape => ({ path, tile, flat: true, opacity: op });
/** Light from the upper left on an outline spanning x0…x1, y0…y1: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.2): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** Shade down the underside of a horizontal outline spanning y0…y1, a sheen along its top. */
const litH = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.28): Shape[] =>
  [F(rect(x0 - 1, y1 - (y1 - y0) * k, x1 - x0 + 2, (y1 - y0) * k + 1), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, x1 - x0 + 2, (y1 - y0) * 0.1 + 1), tone(c, "light"), 0.4, o)];
/** A lit ball of radius `r` at (x, y) in `c`, `deco` printed on it, shade on its lower right and a glint. */
function ball(x: number, y: number, r: number, c: string, deco: (o: Path) => Shape[] = () => []): Shape[] {
  const o = ellipse(x, y, r);
  return [S(o, c), ...deco(o), { path: ellipse(x, y, r).add(ellipse(x - r * 0.15, y - r * 0.18, r)), fill: tone(c, "shade"), flat: true, evenodd: true, opacity: 0.32, clip: o }, F(ellipse(x - r * 0.4, y - r * 0.48, r * 0.17, r * 0.1), "#FFFFFF", 0.55)];
}
const pent = (x: number, y: number, r: number, a: number): Path => poly(Array.from({ length: 5 }, (_, i) => [x + r * Math.sin(a + i * 1.2566), y - r * Math.cos(a + i * 1.2566)] as Vec2));
/** A wheel of radius `r` at (x, y): a tyre ring, a rim, a hub. */
const wheel = (x: number, y: number, r: number, tyre: string, hub: string): Shape[] => [S(ellipse(x, y, r), tyre), S(ellipse(x, y, r * 0.62), hub), S(ellipse(x, y, r * 0.2), tone(hub, "deep"), { flat: true })];
/** A rolled mat or bag lying `len` × `d`, its spiral end at the left, straps at `at` (0…1 along). */
function roll(len: number, d: number, c: string, at: number[], sc: string): Shape[] {
  const o = rrect(-len / 2, -d, len, d, d * 0.2), e = d * 0.2;
  return [S(o, c), ...litH(o, c, -len / 2, len / 2, -d, 0, 0.3), ...at.flatMap(a => { const x = -len / 2 + a * len; return [S(rect(x - d * 0.09, -d, d * 0.18, d), sc), S(rrect(x - d * 0.12, -d * 0.62, d * 0.24, d * 0.2, d * 0.04), STEEL)]; }),
    S(ellipse(-len / 2, -d / 2, e, d / 2), tone(c, "light")), ring(-len / 2, -d / 2, e * 0.62, d * 0.34, tone(c, "deep"), d * 0.035, { flat: true }), ring(-len / 2, -d / 2, e * 0.26, d * 0.14, tone(c, "deep"), d * 0.035, { flat: true })];
}

// ---- finishing -------------------------------------------------------------------------------------------

/** What a kind draws: `s` its shapes standing at x = 0 (origin the bottom centre), `w` the room one takes in a row, `pp` its ppcm; `g` where a hand grips it (default the origin), `hs` other shapes for the held look (standing coordinates) or `h` its held shapes (grip at the origin, no words); `t` its words; `solo` it counts `n` itself. */
interface Look { s: Shape[]; w: number; pp: number; g?: Vec2; h?: Shape[]; hs?: Shape[]; e?: number; t?: TextSpec[]; gap?: number; solo?: boolean; o?: Partial<FlatSpec>; x?: EmitSpec[]; more?: FlatSpec[] }
interface Ctx { C: (d: string) => string; r: Rng; p: Prm; n: number; kit: Kit }
/** A prop of one flat (`id`), its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.35): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(16, ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}
function fin(id: string, held: boolean, n: number, d: Look): PieceOut {
  const e = d.e ?? 0.35, [gx, gy] = d.g ?? [0, 0], x = d.x?.length && !held ? { emitters: d.x } : {};
  if (held) { const { emissive: _e, switch: _s, ...ho } = d.o ?? {}; return one(id, d.h ?? mv(d.hs ?? d.s, -gx, -gy), d.pp, true, d.h ? ho : { ...ho, ...(d.t ? { text: d.t.map(t => ({ ...t, x: t.x - gx, y: t.y - gy })) } : {}) }, e); }
  const sh: Shape[] = [], txt: TextSpec[] = [], k = d.solo ? 1 : n, gap = d.gap ?? 3, x0 = -(k * d.w + (k - 1) * gap) / 2 + d.w / 2;
  for (let i = 0; i < k; i++) { const dx = d.solo ? 0 : x0 + i * (d.w + gap); sh.push(...mv(d.s, dx, 0)); for (const t of d.t ?? []) txt.push({ ...t, x: t.x + dx }); }
  const out = one(id, sh, d.pp, false, { ...d.o, ...(txt.length ? { text: txt } : {}) }, e);
  return { flats: [...out.flats, ...(d.more ?? [])], ...x };
}
const gen = (id: string, tab: Record<string, (c: Ctx) => Look>, dk: string, mx = 24) => (p: Prm, r: Rng, kit: Kit): PieceOut => {
  const f = tab[str(p.kind, dk)] ?? tab[dk], n = cnt(p.n, 1, mx);
  return fin(id, !!p.held, n, f({ C: d => col(kit, p.color, d), r, p, n, kit }));
};
const enumOf = (v: string[]) => ({ type: "enum" as const, values: v, default: v[0] });
const variantsOf = (v: string[]) => Object.fromEntries(v.map(k => [k, { kind: k }]));
const NP = (mx: number, about = "how many side by side") => ({ type: "int" as const, min: 1, max: mx, default: 1, about });
const lab = (p: Prm) => str(p.label, "");

// ---- sport -----------------------------------------------------------------------------------------------

/** A tennis racket, handle end at the floor, 68 cm tall. */
const racket = (c: string): Shape[] => {
  const head = ellipse(0, -50, 13.5, 16), str_: Tile = { w: 2, h: 2, shapes: [F(rect(0, 0, 2, 0.14), "#F3EFE6"), F(rect(0, 0, 0.14, 2), "#F3EFE6")] };
  return [S(rrect(-1.8, -23, 3.6, 23, 1), DARK), ...[0, 1, 2, 3, 4].map(i => F(rect(-1.8, -4 - i * 4, 3.6, 0.5), "#5B6168", 0.9)), S(rrect(-2.2, -23.6, 4.4, 1.6, 0.6), tone(c, "deep")),
    P([[-5.4, -35, 0], [5.4, -35, 0], [1.4, -24, 0], [-1.4, -24, 0]], c), F(ellipse(0, -50, 12.2, 14.6), "#FFFFFF", 0.16), tiled(head, str_, 0.85), { path: head, stroke: { color: c, width: 1.9 } }, ...lit(rrect(-1.8, -23, 3.6, 23, 1), DARK, -1.8, 1.8, -23, 0)];
};
const fuzz = (x: number, y: number, r: number, c = "#CFE03A") => ball(x, y, r, c, o => [ln([[x - r, y - r * 0.2], [x - r * 0.3, y - r * 0.5], [x + r * 0.3, y + r * 0.4], [x + r, y + r * 0.1]], "#F7F3EA", r * 0.14, o)]);
const SPORT: Record<string, (c: Ctx) => Look> = {
  football: () => ({ pp: 12, w: 22, e: 0.3, s: ball(0, -11, 11, WHITE, o => {
    const a = (i: number) => i * 1.2566, sh: Shape[] = [F(pent(0, -11, 4.2, 0), DARK, 1, o)];
    for (let i = 0; i < 5; i++) sh.push(F(pent(9.6 * Math.sin(a(i)), -11 - 9.6 * Math.cos(a(i)), 4.4, a(i) + Math.PI), DARK, 1, o), ln([[4.2 * Math.sin(a(i)), -11 - 4.2 * Math.cos(a(i))], [5.6 * Math.sin(a(i)), -11 - 5.6 * Math.cos(a(i))]], "#8E959C", 0.3, o, 0.9));
    return sh; }) }),
  basketball: () => { const c = "#D9702A", k = "#2E2118"; return { pp: 12, w: 24, e: 0.3, s: ball(0, -12, 12, c, o => [ln([[0, -25], [0, 1]], k, 0.5, o), ln([[-13, -12], [13, -12]], k, 0.5, o), ln([[-8.4, -23], [-5.4, -17], [-4.4, -12], [-5.4, -7], [-8.4, -1]], k, 0.5, o), ln([[8.4, -23], [5.4, -17], [4.4, -12], [5.4, -7], [8.4, -1]], k, 0.5, o)]) }; },
  volleyball: () => ({ pp: 12, w: 21, e: 0.3, s: ball(0, -10.5, 10.5, "#F4EFE2", o => [-1, 0, 1].flatMap(i => [ln([[-12, -12 + i * 9], [-4, -13.5 + i * 9], [4, -9.5 + i * 9], [12, -5 + i * 9]], i === 0 ? "#F2C230" : "#2E5FA8", 3.4, o, 0.95), ln([[-12, -10.2 + i * 9], [-4, -11.7 + i * 9], [4, -7.7 + i * 9], [12, -3.2 + i * 9]], "#B8B2A2", 0.25, o, 0.8)])) }),
  tennis: c => { const k = c.C("#C8283A"), r = racket(k); return { pp: 9, w: 44, s: [...r, ...fuzz(17, -3.35, 3.35)], g: [0, -11], h: mv(r, 0, 11) }; },
  table_tennis: c => {
    const k = c.C("#C8283A"), o = ellipse(0, -18, 7.6);
    const bat = [S(rrect(-1.5, -11, 3, 11, 1), "#C9A06A"), F(rect(-1.5, -9, 3, 0.4), "#A67C45"), S(o, "#C9A06A"), S(ellipse(0, -18, 7), k), F(ellipse(2.4, -16, 6.6), tone(k, "shade"), 0.4, ellipse(0, -18, 7)), { path: ellipse(0, -18, 7), stroke: { color: DARK, width: 0.5 }, flat: true }, S(rrect(-2.2, -11.6, 4.4, 1.8, 0.8), DARK), F(ellipse(-2.6, -21, 1.8, 1), "#FFFFFF", 0.4)];
    return { pp: 14, w: 26, s: [...bat, ...ball(10.5, -2, 2, WHITE)], g: [0, -5], h: mv(bat, 0, 5) };
  },
  skipping_rope: c => {
    const k = c.C(RED), hd = (x: number, a: number) => T([S(rrect(-1.6, -13, 3.2, 13, 1.4), k), S(rrect(-1.6, -13, 3.2, 3.4, 1.4), tone(k, "deep")), F(rect(-1.6, -8, 3.2, 1), "#F7F3EA", 0.9), ...lit(rrect(-1.6, -13, 3.2, 13, 1.4), k, -1.6, 1.6, -13, 0, 0.3)], mul(translate(x, 0), rotate(a)));
    return { pp: 14, w: 34, s: [R([[-13, -12.4], [-16, -5], [-9, -0.8], [0, -1.2], [10, -0.6], [16, -6], [13.4, -12.4]], "#F3EBD8", 0.8), R([[-13, -12.4], [-8, -7], [0, -4.5], [8, -6.5], [13.4, -12.4]], "#E0D3B4", 0.7), ...hd(-13, -0.12), ...hd(13.4, 0.12)],
      g: [0, -6], h: [R([[0, 6], [3, 18], [-4, 28], [6, 36], [10, 34]], "#F3EBD8", 0.8), ...T([...hd(0, 0)], translate(0, 6)), ...T(hd(0, 0.9), translate(11, 38))] };
  },
  dumbbell: c => {
    const k = c.C("#3A3D45"), head = (x: number) => { const o = rrect(x - 4, -12.4, 8, 12.4, 1.8); return [S(o, k), ...lit(o, k, x - 4, x + 4, -12.4, 0, 0.3), S(rrect(x + (x < 0 ? 3 : -5.4), -9.6, 2.4, 6.8, 0.8), tone(k, "light"), { flat: true })]; };
    const bar = rrect(-10, -7.3, 20, 2.6, 1.2);
    return { pp: 12, w: 34, s: [S(bar, STEEL), F(rect(-10, -5.9, 20, 0.9), tone(STEEL, "shade"), 0.6, bar), ...[-1, 0, 1].map(i => F(rect(i * 2.4 - 0.4, -7.3, 0.8, 2.6), "#8E959C", 0.7, bar)), ...head(-14), ...head(14)], g: [0, -6] };
  },
  yoga_mat: c => { const k = c.C("#7A3E8C"), s = roll(61, 11, k, [0.3, 0.7], tone(k, "deep")); return { pp: 10, w: 64, s, g: [0, -5.5], h: turn(s, [-8, -5.5], -1.2) }; },
  helmet: c => {
    const k = c.C("#1F5FC0"), o = smooth([[-12.4, -4, 0], [-12, -10], [-8, -15.4], [0, -17.2], [8, -15.4], [12, -10], [13, -5], [11.4, -3.6, 0], [-11.4, -3.6, 0]], true, 1);
    return { pp: 14, w: 27, e: 0.3, s: [R([[-4.6, -3.6], [-4.6, 1.4], [0, 3.2], [4.6, 1.4], [4.6, -3.6]], DARK, 0.9), S(o, k), ...lit(o, k, -12.4, 13, -17.2, -3.6, 0.3),
      ...[-6, -1, 4].map((x, i) => F(poly([[x, -16 + i * 0.6], [x + 2, -16 + i * 0.6], [x + 2.6, -5.6], [x + 0.6, -5.6]]), tone(k, "deep"), 0.85, o)), S(rect(-12.6, -5.2, 26, 1.8), CREAM, { clip: o }), S(smooth([[10, -9], [14.6, -7.4], [14, -6], [10, -6.4]], true, 1), tone(k, "deep")), S(rrect(-1, -2.4, 2.6, 3.2, 0.5), STEEL)], g: [0, -8] };
  },
  trophy: c => {
    const k = c.C(GOLD), cup = smooth([[-10, -30, 0], [10, -30, 0], [9, -23], [5.6, -17.6], [2.4, -15.4], [-2.4, -15.4], [-5.6, -17.6], [-9, -23]], true, 1), t = lab(c.p);
    return { pp: 12, w: 26, e: 0.3, t: t ? [{ text: t, x: -4.6, y: -4.6, w: 9.2, h: 3.4, font: "print", color: "#4A3A12", size: 2.4 }] : undefined, s: [S(rrect(-8, -5.4, 16, 5.4, 1), "#3A2A22"), S(rrect(-5.4, -4.8, 10.8, 3.6, 0.5), tone(GOLD, "light")), S(rrect(-2, -15.6, 4, 10.4, 1.2), tone(k, "shade")), S(ellipse(0, -11, 3.4, 1.8), k), S(rrect(-5.4, -7.4, 10.8, 2.2, 1), k),
      ring(-11.2, -24, 3.2, 4.4, k, 1.5), ring(11.2, -24, 3.2, 4.4, k, 1.5), S(cup, k), ...lit(cup, k, -10, 10, -30, -15.4, 0.3), F(ellipse(-4.6, -24, 1.1, 4.4), "#FFFFFF", 0.45, cup), S(ellipse(0, -30, 10, 1.6), tone(k, "light")), F(ellipse(0, -30, 8.2, 1.1), tone(k, "deep"), 0.7)], g: [0, -3] };
  },
  medal: c => {
    const k = c.C(GOLD), rb = col(c.kit, c.p.ribbon, "#C8283A"), t = lab(c.p), star = poly(Array.from({ length: 10 }, (_, i) => [(i % 2 ? 1.1 : 2.4) * Math.sin(i * 0.6283), -3.6 - (i % 2 ? 1.1 : 2.4) * Math.cos(i * 0.6283)] as Vec2));
    /** The ribbon's two arms, their tops `sp` either side of the middle (negative: pinched together in a hand). */
    const rib = (sp: number): Shape[] => [P([[-sp - 5, -37, 0], [-sp, -37, 0], [3.4, -7, 0], [-1.8, -6, 0]], rb), P([[sp + 5, -37, 0], [sp, -37, 0], [-3.4, -7, 0], [1.8, -6, 0]], tone(rb, "shade")), F(poly([[-sp - 2.5, -37], [-sp - 1.2, -37], [0.5, -6.5], [-0.8, -6.7]]), "#FFFFFF", 0.55), F(poly([[sp + 2.5, -37], [sp + 1.2, -37], [-0.5, -6.5], [0.8, -6.7]]), "#FFFFFF", 0.4)];
    const disc = [S(rrect(-2, -8.4, 4, 3, 1), tone(k, "shade")), S(ellipse(0, -3.6, 3.6), k), ring(0, -3.6, 2.8, 2.8, tone(k, "deep"), 0.25, { flat: true }), ...(t ? [] : [F(star, tone(k, "light"), 0.9)]), F(ellipse(-1.6, -5.2, 1, 0.6), "#FFFFFF", 0.5)];
    return { pp: 14, w: 20, e: 0.3, t: t ? [{ text: t, x: -2.2, y: -6.2, w: 4.4, h: 5, font: "print", color: "#4A3A12", size: 3.2 }] : undefined, s: [...rib(4), ...disc], hs: [...rib(-1), ...disc], g: [0, -36] };
  },
  skateboard: c => {
    const k = c.C("#C4553A"), o = rrect(-10, -80, 20, 80, 10), tk = (y: number) => [S(rect(-11.4, y - 1.4, 22.8, 2.8), STEEL), ...[-1, 1].map(d => S(rrect(d > 0 ? 10.4 : -14.6, y - 3, 4.2, 6, 1.8), "#F2C230")), ...[-1, 1].map(d => F(ellipse(d * 6, y + 5, 0.8), DARK, 0.6)), ...[-1, 1].map(d => F(ellipse(d * 6, y - 5, 0.8), DARK, 0.6))];
    const s = [...tk(-16), ...tk(-64), S(o, k), ...lit(o, k, -10, 10, -80, 0, 0.3), F(rect(-10, -48, 20, 4), CREAM, 0.9, o), F(rect(-10, -42, 20, 1.6), tone(k, "deep"), 0.7, o), F(ellipse(0, -30, 4.6), CREAM, 0.9, o), F(ellipse(0, -30, 2.4), tone(k, "deep"), 0.7, o), F(poly([[0, -76], [3.6, -68], [-3.6, -68]]), CREAM, 0.9, o)];
    return { pp: 10, w: 28, s, g: [0, -46], h: turn(s, [0, -46], 1.1) };
  },
  bicycle: c => {
    const k = c.C("#D9342B"), Rw: Vec2 = [-52, -33], Fw: Vec2 = [52, -33], BB: Vec2 = [0, -27], ST: Vec2 = [-13, -78], HT: Vec2 = [41, -79], HB: Vec2 = [45, -66], dk = tone(k, "deep");
    const wh = ([x, y]: Vec2): Shape[] => { const sp = new Path(); for (let i = 0; i < 16; i++) sp.moveTo(x, y).lineTo(x + 29.4 * Math.cos(i * 0.3927), y + 29.4 * Math.sin(i * 0.3927)); return [ring(x, y, 31.4, 31.4, DARK, 3.4), ring(x, y, 29.2, 29.2, STEEL, 0.8, { flat: true }), { path: sp, stroke: { color: STEEL, width: 0.14 }, flat: true, opacity: 0.8 }, S(ellipse(x, y, 2.4), STEEL), S(ellipse(x, y, 1), "#6B7178")]; };
    const s = [...wh(Rw), ...wh(Fw), R([Rw, BB], dk, 1.5), R([ST, Rw], dk, 1.3), R([HB, Fw], "#6B7178", 1.8), R([Rw, [-50, -31]], DARK, 0.5), ln([[-1, -34.6], [-50, -36]], DARK, 0.3), ln([[-1, -19.6], [-50, -30.6]], DARK, 0.3), S(ellipse(Rw[0], Rw[1], 3.4), STEEL),
      R([BB, HB], k, 2.6), R([ST, HT], k, 2), R([BB, ST], k, 2), R([HT, HB], tone(k, "shade"), 3), R([ST, [-14.4, -85]], STEEL, 1.5), S(smooth([[-25, -87.6], [-12, -88.4], [-5, -87.2], [-12, -84.6], [-24, -85.4]], true, 1), DARK),
      R([HT, [39, -92]], STEEL, 1.8), R([[37, -92.4], [47, -93], [55, -89], [57.4, -81]], DARK, 1.6), R([[55, -89], [57.6, -80.6]], "#5B6168", 2.6), S(ellipse(0, -27, 7.6), STEEL), S(ellipse(0, -27, 5.4), tone(STEEL, "shade")), R([BB, [6, -15]], DARK, 1.6), S(rrect(2, -15.4, 9, 2.2, 0.8), DARK)];
    return { pp: 8, w: 168, gap: 8, s, g: [55, -86], h: fit(s, [55, -86], 0.12) };
  },
  roller_skates: c => {
    const k = c.C("#F1ECE0"), ac = "#E8799A", b = smooth([[-11, -6, 0], [-11.6, -15], [-10, -21, 0], [-3.4, -21.6, 0], [-3, -14], [1, -11.6], [8, -10.6], [12.6, -9.2], [13.8, -7.4], [12.6, -6, 0]], true, 1);
    const skate = (x: number): Shape[] => mv([...[-8, -3, 5, 10].flatMap(wx => wheel(wx, -2.6, 2.6, ac, tone(ac, "light"))), S(rrect(-11, -6.8, 24, 1.4, 0.6), STEEL), S(rect(-8.6, -6.2, 3.4, 1.6), "#6B7178"), S(rect(5.4, -6.2, 3.4, 1.6), "#6B7178"), S(rrect(12, -9.4, 2.6, 4.4, 1.2), ac), S(b, k), ...lit(b, k, -11.6, 13.8, -21.6, -6, 0.26), F(rect(-12, -8.4, 27, 2), ac, 0.95, b), F(ellipse(10, -8.8, 4, 2.2), tone(k, "shade"), 0.4, b), S(rrect(-10.6, -22.6, 7.8, 2.2, 1), tone(k, "shade")), ...[0, 1, 2].map(i => ln([[-2.4 + i * 2.8, -14.4 + i * 0.9], [-0.2 + i * 2.8, -12.2 + i * 0.9]], tone(k, "deep"), 0.4, b, 0.9))], x, 0);
    return { pp: 12, w: 52, s: [...skate(-13), ...skate(13)], g: [0, -22], h: [R([[0, 0], [-5, 7]], CREAM, 0.6), R([[0, 0], [5, 7]], CREAM, 0.6), ...mv(skate(0), 11.7, 28), ...T(mv(skate(0), 11.7, 28), [-1, 0, 0, 1, 0, 0])] };
  },
  goggles: c => {
    const k = c.C(BLUE), cup = (x: number) => [S(ellipse(x, -4.6, 3.8, 2.8), k), S(ellipse(x, -4.6, 2.9, 2.1), "#9ED0E6"), F(ellipse(x - 0.9, -5.4, 1.2, 0.7), "#FFFFFF", 0.7), F(ellipse(x + 1, -3.6, 2.6, 1.4), tone("#9ED0E6", "shade"), 0.4, ellipse(x, -4.6, 2.9, 2.1))];
    const s = [ring(0, -7.5, 10.4, 5.4, tone(k, "shade"), 0.9), R([[-4, -4.4], [0, -5.4], [4, -4.4]], tone(k, "deep"), 0.7), ...cup(-4.3), ...cup(4.3), S(rect(-0.8, -5.8, 1.6, 1.2), WHITE, { flat: true }), S(rrect(9.4, -9, 2.4, 3.2, 0.6), STEEL)];
    return { pp: 14, w: 23, s, g: [0, -13], e: 0.3 };
  },
  skis: c => {
    const k = c.C("#D9342B"), ski = (x: number) => { const o = smooth([[x - 4, 0, 0], [x - 3.2, -90], [x - 3.8, -150], [x - 3.2, -162], [x + 1, -166, 0], [x + 4, -160], [x + 3.6, -150], [x + 3.2, -90], [x + 4, 0, 0]], true, 1); return [S(o, k), F(rect(x - 0.5, -160, 1, 160), "#F7F3EA", 0.8, o), ...lit(o, k, x - 4, x + 4, -166, 0, 0.3), S(rrect(x - 3, -62, 6, 16, 1.4), DARK), S(rrect(x - 2, -60, 4, 5, 0.8), "#6B7178"), S(rrect(x - 2, -52, 4, 4, 0.8), "#6B7178"), S(rrect(x - 2.4, -112, 4.8, 3, 0.8), DARK)]; };
    const pole = (x: number, a: number) => T([R([[0, 0], [0, -122]], "#6B7178", 1), S(rrect(-1.6, -128, 3.2, 12, 1.4), DARK), ring(0, -9, 3.6, 1.2, DARK, 0.8), R([[-2.6, -120], [-5, -112], [-2, -104]], "#C8283A", 0.4, { flat: true })], mul(translate(x, 0), rotate(a)));
    return { pp: 6, w: 66, s: [...pole(-21, -0.07), ...pole(22, 0.07), ...ski(-6), ...ski(6)], g: [0, -46], e: 0.4 };
  },
  surfboard: c => {
    const k = c.C("#2F8C88"), o = smooth([[0, -186], [9, -176], [19, -146], [24, -110], [25, -70], [21, -34], [12, -8], [0, -2], [-12, -8], [-21, -34], [-25, -70], [-24, -110], [-19, -146], [-9, -176]], true, 1);
    return { pp: 7, w: 50, e: 0.45, s: [S(o, "#F4EFE6"), F(poly([[-25, -118], [25, -126], [25, -96], [-25, -88]]), k, 0.95, o), F(poly([[-25, -80], [25, -88], [25, -74], [-25, -66]]), tone(k, "light"), 0.95, o), ...lit(o, "#F4EFE6", -25, 25, -186, 0, 0.22), ln([[0, -184], [0, -4]], "#B8B2A2", 0.5, o, 0.7), F(ellipse(0, -52, 11, 17), "#FFFFFF", 0.4, o), S(poly([[-12, -3], [-14, -12], [-9, -4]]), tone(k, "shade"), { flat: true })], g: [-24, -64] };
  },
  badminton: c => {
    const k = c.C("#2F8C88"), head = ellipse(0, -48, 10.2, 14.4), net: Tile = { w: 1.5, h: 1.5, shapes: [F(rect(0, 0, 1.5, 0.1), "#F3EFE6"), F(rect(0, 0, 0.1, 1.5), "#F3EFE6")] };
    const rk = [S(rrect(-1.5, -23, 3, 23, 1), DARK), F(rect(-1.5, -9, 3, 0.5), "#5B6168", 0.9), R([[0, -23], [0, -34]], STEEL, 0.9), P([[-4, -36, 0], [4, -36, 0], [0.8, -33, 0], [-0.8, -33, 0]], k), tiled(head, net, 0.8), { path: head, stroke: { color: k, width: 1.3 } }];
    const sk = poly([[13.6, -3.2], [16.4, -3.2], [19.6, -13], [10.4, -13]]);
    return { pp: 10, w: 40, s: [...rk, S(sk, WHITE), ...[-1, 0, 1].map(i => ln([[15 + i * 0.8, -3.4], [15 + i * 2.8, -12.6]], "#B8B2A2", 0.25, sk)), F(rect(10, -13.4, 10, 1), tone(k, "light"), 0.9, sk), S(ellipse(15, -2, 2, 1.7), "#F2D7A6")], g: [0, -11], h: mv(rk, 0, 11) };
  },
  boxing_gloves: c => {
    const k = c.C(RED), glove = (): Shape[] => { const o = smooth([[-9, -14, 0], [-10.8, -22], [-6, -29], [2, -31], [9, -27], [10.6, -19], [9, -14, 0]], true, 1), cuff = rrect(-7.4, -14.4, 14.8, 14.4, 1.6);
      return [S(cuff, CREAM), F(rect(-7.4, -10.4, 14.8, 4.2), k, 0.95, cuff), F(rect(-7.4, -9.2, 14.8, 0.5), "#FFFFFF", 0.7, cuff), S(o, k), ...lit(o, k, -10.8, 10.6, -31, -14, 0.26), S(ellipse(-9.6, -17.4, 3.2, 5.2), tone(k, "shade")), ln([[-5, -26], [0, -27.6], [5, -25]], tone(k, "deep"), 0.4, o, 0.8), ln([[-6.4, -14.4], [-7, -21]], tone(k, "deep"), 0.4, o, 0.8), F(ellipse(-3.6, -26, 2.8, 1.4), "#FFFFFF", 0.35, o)]; };
    return { pp: 12, w: 42, s: [...mv(glove(), -10.6, 0), ...T(mv(glove(), -10.6, 0), [-1, 0, 0, 1, 0, 0])], g: [0, -10] };
  },
};
const SPORT_KINDS = ["football", "basketball", "volleyball", "tennis", "table_tennis", "skipping_rope", "dumbbell", "yoga_mat", "helmet", "trophy", "medal", "skateboard", "bicycle", "roller_skates", "goggles", "skis", "surfboard", "badminton", "boxing_gloves"];
const sport: PieceDef = {
  draw: gen("sport", SPORT, "football"), variants: variantsOf(SPORT_KINDS),
  meta: {
    about: "Sport kit: a football, basketball or volleyball, a tennis racket with its ball, a table-tennis bat, a skipping rope, a dumbbell, a rolled yoga mat, a bike helmet, a trophy, a gold medal on its ribbon, a skateboard, a bicycle (170 cm, side on), roller skates, swimming goggles, skis with poles, a surfboard, a badminton racket with its shuttlecock or a pair of boxing gloves.",
    params: {
      kind: enumOf(SPORT_KINDS), n: NP(24),
      color: { type: "color", about: "the main colour (racket, bat, rope handles, dumbbell, mat, helmet, trophy and medal metal, deck, frame, skates' boot, goggles' strap, skis, board's stripe, gloves); default fixed per kind" },
      ribbon: { type: "color", default: "#C8283A", about: "medal: the ribbon" },
      label: { type: "text", about: "trophy: the plaque's words; medal: the number on it (none by default)" },
    },
    terms: ["a1-w-futbol", "a1-w-basketbol", "a1-w-tenis", "b1-w-kask", "a2-w-kupa", "a2-w-madalya", "b1-w-altin-madalya", "a1-w-bisiklet", "a2-w-kayak", "a2-w-sorf", "a1-w-spor-yapmak", "a1-w-top", "b1-w-yoga", "a1-w-havuz"],
    tags: ["sport"],
  },
};

// ---- outing ----------------------------------------------------------------------------------------------

const LOG = "#7A5232", SAND = "#E8C98A";
/** A pail `h` tall, `w` wide at the rim, in `c`, a bail up to `up` above the rim. */
const pail = (w: number, h: number, c: string, up: number, wire: string): Shape[] => {
  const o = smooth([[-w / 2, -h, 0], [w / 2, -h, 0], [w * 0.4, 0, 0], [-w * 0.4, 0, 0]], true, 1);
  return [R([[-w / 2 + 0.6, -h + 1], [-w * 0.46, -h - up * 0.7], [0, -h - up], [w * 0.46, -h - up * 0.7], [w / 2 - 0.6, -h + 1]], wire, 0.9), S(o, c), ...lit(o, c, -w / 2, w / 2, -h, 0, 0.26), S(ellipse(0, -h, w / 2, w * 0.07), tone(c, "deep")), S(ellipse(0, -h + 0.3, w * 0.44, w * 0.05), "#2A3A44", { flat: true }), F(rect(-w / 2, -h + 2, w, 1.4), tone(c, "light"), 0.7, o)];
};
const OUTING: Record<string, (c: Ctx) => Look> = {
  kite: c => {
    const k = c.C(RED), top: Vec2 = [0, -156], rt: Vec2 = [26, -132], bt: Vec2 = [0, -96], lf: Vec2 = [-26, -132], o = poly([top, rt, bt, lf]);
    const bow = (x: number, y: number, a: string, b: string): Shape[] => [P([[x, y, 0], [x - 5, y - 2.4, 0], [x - 5, y + 2.4, 0]], a), P([[x, y, 0], [x + 5, y - 2.4, 0], [x + 5, y + 2.4, 0]], b)];
    const s = [R([[0, -8], [10, -44], [8, -90], [0, -118]], "#8E959C", 0.25), S(rrect(-3, -9, 6, 9, 1.4), WOOD), R([bt, [-8, -78], [3, -62], [-6, -46], [2, -34]], "#8E959C", 0.4),
      ...bow(-8, -78, k, "#F2C230"), ...bow(3, -62, "#F2C230", k), ...bow(-6, -46, k, WHITE), ...bow(2, -34, "#F2C230", k),
      S(o, k), F(poly([top, rt, [0, -132]]), "#F2C230", 1, o), F(poly([bt, lf, [0, -132]]), "#F2C230", 1, o), F(poly([top, lf, [0, -132]]), tone(k, "light"), 0.45, o), ...lit(o, k, -26, 26, -156, -96, 0.22), ln([top, bt], tone(k, "deep"), 0.6, o, 0.7), ln([lf, rt], tone(k, "deep"), 0.6, o, 0.7)];
    return { pp: 6, w: 60, gap: 14, s, g: [0, -8], o: { move: { sway: { rot: 0.05, ms: 3600 } } } };
  },
  fishing_rod: c => {
    const k = c.C("#3A3D45"), P0: Vec2[] = [[0, 0], [3, -60], [10, -120], [22, -172], [38, -204]];
    const rod = [R(P0.slice(0, 2), WOOD, 3.2), R(P0.slice(1, 3), k, 1.6), R(P0.slice(2, 4), k, 1.1), R(P0.slice(3), k, 0.7), ...[30, 70, 130, 170, 200].map(v => ring(Math.min(40, v * 0.19) - 0.2, -v, 0.9, 0.9, STEEL, 0.25, { flat: true })),
      S(rrect(-2.4, -48, 4.8, 8, 1), DARK), S(ellipse(4.6, -44, 4.2), STEEL), S(ellipse(4.6, -44, 2.6), tone(STEEL, "shade")), R([[4.6, -44], [8.6, -41]], DARK, 0.6)];
    const line = (x: number, y: number, h: number): Shape[] => [R([[x, y], [x + 4, y + h * 0.3], [x + 3, y + h * 0.75], [x + 2, y + h - 2]], "#B8BEC4", 0.2, { flat: true }), S(ellipse(x + 2, y + h, 1.4, 3), RED), F(rect(x + 0.6, y + h - 2, 2.8, 1.6), WHITE, 1)];
    const m = mul(rotate(0.6), translate(0, 30)), [tx, ty] = apply(m, 38, -204);
    return { pp: 5, w: 56, s: [...rod, ...line(38, -204, 198)], g: [0, -30], h: [...T(rod, m), ...line(tx, ty, GRIP - 4 - ty)] };
  },
  bait_bucket: c => {
    const k = c.C("#3E8E8A"), t = lab(c.p), fn = (x: number) => [S(rrect(x - 1, -23.4, 2, 5, 0.9), "#9FB0BA"), P([[x - 0.9, -23, 0], [x + 0.9, -23, 0], [x + 3, -28, 0], [x, -26.4], [x - 3, -28, 0]], "#B8C4CC"), F(poly([[x - 0.2, -23.4], [x + 0.6, -23.4], [x + 1.6, -26.6], [x + 0.8, -26]]), tone("#B8C4CC", "shade"), 0.5)];
    return { pp: 12, w: 28, t: t ? [{ text: t, x: -6.6, y: -15, w: 13.2, h: 7, font: "hand", color: "#1E2B2A", size: 4 }] : undefined, s: [...pail(22, 22, k, 14, STEEL), ...fn(-4), ...fn(3.4), ...(t ? [F(rrect(-7.4, -16, 14.8, 8.4, 1), CREAM, 0.9)] : [])], g: [0, -36] };
  },
  tent: c => {
    const k = c.C("#E0A83A"), o = smooth([[0, -124, 0], [58, -66], [104, -3, 0], [-104, -3, 0], [-58, -66]], true, 1), door = poly([[0, -104], [30, -2], [-30, -2]]), sk = roll(62, 24, k, [0.28, 0.72], tone(k, "deep"));
    return { pp: 6, w: 232, gap: 20, s: [R([[-48, -84], [-134, -3]], "#C9BFA6", 0.6), R([[48, -84], [134, -3]], "#C9BFA6", 0.6), S(ellipse(-134, -1.6, 3.4, 1.6), RED), S(ellipse(134, -1.6, 3.4, 1.6), RED),
      S(o, k), ...lit(o, k, -104, 104, -124, 0, 0.22), F(poly([[-104, -3], [104, -3], [100, -14], [-100, -14]]), tone(k, "deep"), 0.6, o), F(poly([[0, -124], [14, -100], [-14, -100]]), tone(k, "light"), 0.6, o), S(door, "#26272C"), F(poly([[0, -104], [30, -2], [14, -2]]), "#4B4F57", 0.9, door), S(smooth([[0, -106, 0], [34, -4, 0], [10, -4, 0], [0, -56]], true, 1), tone(k, "shade")), ln([[0, -104], [0, -40]], tone(k, "deep"), 0.5, undefined, 0.9)], g: [0, -12], h: turn(sk, [0, -12], -1.4) };
  },
  sleeping_bag: c => { const k = c.C("#4F6E9E"), s = roll(66, 26, k, [0.2, 0.78], tone(k, "deep")); return { pp: 8, w: 70, s, g: [0, -13], h: turn(s, [0, -13], -1.3) }; },
  campfire: c => {
    const n = Math.min(4, c.n), logs = (): Shape[] => [R([[-22, -3], [10, -21]], tone(LOG, "shade"), 6), R([[22, -3], [-10, -21]], LOG, 6), R([[-20, -4], [20, -4]], tone(LOG, "light"), 6), ...[-1, 1].flatMap(d => [S(ellipse(d * 20.4, -4, 2.8, 3), "#D9B380"), ring(d * 20.4, -4, 1.6, 1.8, LOG, 0.3, { flat: true })])];
    const stones = [-30, -22, -13, 13, 22, 30].map((x, i) => S(ellipse(x, -3 - (i % 2) * 0.6, 5, 3.4), ["#8E959C", "#A9A39A", "#7B8087"][i % 3]));
    const one_ = [...stones.slice(0, 3), ...logs(), ...stones.slice(3), F(ellipse(0, -7, 8, 3), "#E85D2A", 0.8), F(ellipse(0, -7, 4, 1.6), "#FFC864", 0.9)], glow = [F(ellipse(0, -14, 30, 18), "#FF9A3C", 0.28), F(ellipse(0, -10, 14, 9), "#FFC864", 0.5)];
    const x0 = (i: number) => (i - (n - 1) / 2) * 76, em: EmitSpec[] = [];
    for (let i = 0; i < n; i++) em.push({ kind: "flame", x: x0(i) - 5, y: 9, z: 0.5, w: 4.2 }, { kind: "flame", x: x0(i) + 5, y: 10, z: 0.5, w: 3.6 }, { kind: "flame", x: x0(i), y: 13, z: 0.5, w: 5 }, { kind: "smoke", x: x0(i), y: 34, w: 5 });
    const all = (sh: Shape[]) => Array.from({ length: n }, (_, i) => mv(sh, x0(i), 0)).flat();
    return { pp: 8, w: 76, solo: true, s: all(one_), x: em, o: { emissive: { shapes: all(glow), edge: 0 }, switch: false }, g: [0, -10], h: zoom(mv(logs(), 0, 4), 0.55) };
  },
  picnic_basket: c => {
    const k = c.C("#C9954F"), body = smooth([[-21, -16, 0], [21, -16, 0], [18, 0, 0], [-18, 0, 0]], true, 1), lid = smooth([[-22, -16, 0], [22, -16, 0], [20, -22], [0, -24.4], [-20, -22]], true, 1), arch: Vec2[] = [[-17, -21], [-12, -33], [0, -37], [12, -33], [17, -21]];
    const weave: Tile = { w: 2.4, h: 2.4, shapes: [S(rect(0, 0, 1.2, 1.2), tone(k, "light")), S(rect(1.2, 1.2, 1.2, 1.2), tone(k, "light")), S(rect(1.2, 0, 1.2, 1.2), tone(k, "shade")), S(rect(0, 1.2, 1.2, 1.2), tone(k, "shade"))] }, gz: Tile = { w: 3, h: 3, shapes: [S(rect(0, 0, 1.5, 3), "#C8283A"), S(rect(0, 0, 3, 1.5), "#C8283A")] }, cl = poly([[-7, -15.6], [10, -15.6], [11, -9], [4, -6.4], [-3, -9.4]]);
    return { pp: 12, w: 46, s: [R(arch, tone(k, "deep"), 2.6), R(arch, tone(k, "light"), 0.7, { flat: true }), S(body, k), tiled(body, weave, 0.7), ...lit(body, k, -21, 21, -16, 0, 0.22), S(lid, tone(k, "light")), tiled(lid, weave, 0.5), F(rect(-22, -17, 44, 1.6), tone(k, "deep"), 0.7, lid), S(cl, "#F7F3EA"), tiled(cl, gz, 0.8), S(rrect(-1.6, -17.6, 3.2, 3.6, 0.8), STEEL)], g: [0, -37] };
  },
  beach_ball: c => {
    const k = c.C(RED), cs = [k, WHITE, "#F2C230", WHITE, "#2F7DC4", WHITE], r = 20;
    const gore = (a: number, b: number) => { const pts: Vec2[] = []; for (const q of [a, b]) for (let i = 0; i <= 10; i++) { const t = -Math.PI / 2 + (q === a ? i : 10 - i) * Math.PI / 10; pts.push([r * Math.sin(q) * Math.cos(t), -r - r * Math.sin(t)]); } return poly(pts); };
    return { pp: 10, w: 40, e: 0.4, s: ball(0, -r, r, WHITE, o => cs.map((cc, i) => F(gore(-1.5708 + i * 0.5236, -1.5708 + (i + 1) * 0.5236), cc, 1, o))) };
  },
  bucket_spade: c => {
    const k = c.C("#E8892E"), bl = "#2F7DC4", spade = (m: [number, number, number, number, number, number]) => T([R([[0, -9], [0, -24]], tone(bl, "shade"), 1.8), ring(0, -26, 3.2, 2, bl, 1.1), P([[-4.4, 0, 0], [4.4, 0, 0], [5.4, -9], [0, -13], [-5.4, -9]], bl), F(ellipse(-1.8, -6, 1, 3.4), "#FFFFFF", 0.35)], m);
    const b = [...pail(15, 14, k, 9, STEEL), ...[-4.6, 0, 4.6].map(x => F(rect(x - 1.1, -14, 2.2, 3), tone(k, "shade"), 0.7)), F(rect(-7.6, -14, 15.2, 2.2), tone(k, "light"), 0.6)];
    return { pp: 14, w: 36, s: [S(smooth([[-17, 0, 0], [-6, -3.6], [3, -4], [14, -2], [17, 0, 0]], true, 1), SAND), ...mv(b, -4, 0), ...spade(mul(translate(14, 0), rotate(0.3)))], g: [0, -23], h: mv([...spade(mul(translate(2, -8), rotate(0.4))), ...b], 0, 23) };
  },
  life_ring: c => {
    const k = c.C(RED), cy = -35, seg = (a0: number, a1: number, r0: number, r1: number) => poly([...arcPoints(0, cy, r1, r1, a0, a1, 8), ...arcPoints(0, cy, r0, r0, a1, a0, 8)]), t = lab(c.p);
    const rope = Array.from({ length: 33 }, (_, i) => { const a = i * Math.PI / 16, r = 30.4 + 2.2 * Math.cos(4 * a); return [r * Math.cos(a), cy + r * Math.sin(a)] as Vec2; });
    const s = [{ path: ellipse(0, cy, 35).add(ellipse(0, cy, 21)), fill: WHITE, evenodd: true }, ...[0.7854, 2.356, 3.927, 5.498].map(a => F(seg(a - 0.5, a + 0.5, 21, 35), k)), ring(0, cy, 21.2, 21.2, tone(WHITE, "shade"), 0.5, { flat: true }), R(rope, "#E2D5B0", 1), ...[0.3926, 1.9634, 3.5342, 5.105].map(a => S(ellipse(31.5 * Math.cos(a), cy + 31.5 * Math.sin(a), 1.5, 1), "#6B4A35"))];
    return { pp: 8, w: 72, t: t ? [{ text: t, x: -6.5, y: -65, w: 13, h: 5.4, font: "print", color: "#8E1F28", size: 4.2 }] : undefined, s, g: [0, -69], h: fit(s, [0, -69], 0) };
  },
  binoculars: c => {
    const k = c.C("#2E2F35"), tube = (x: number): Shape[] => [S(rrect(x - 3.2, -13, 6.4, 11, 1.6), k), S(rrect(x - 4, -16.4, 8, 5, 1.6), tone(k, "light")), S(ellipse(x, -16.4, 3.6, 1.2), "#7FA8C0"), F(ellipse(x - 1, -16.6, 1.2, 0.4), "#FFFFFF", 0.7), S(rrect(x - 2.4, -3.4, 4.8, 3.4, 1), "#5B6168"), F(rect(x - 3.2, -9, 0.9, 6), "#FFFFFF", 0.15)];
    return { pp: 14, w: 22, e: 0.3, s: [R([[-7, -11], [-12.4, -6], [-12, -1], [-8, -0.6]], "#6B4A35", 0.8), R([[7, -11], [12.4, -6], [12, -1], [8, -0.6]], "#6B4A35", 0.8), ...tube(-4.6), ...tube(4.6), S(rrect(-2.6, -11, 5.2, 3.4, 0.8), tone(k, "light")), S(ellipse(0, -9.4, 1.6, 2.2), STEEL), F(ellipse(-0.5, -10, 0.5, 0.8), "#FFFFFF", 0.5)], g: [0, -8] };
  },
  cool_box: c => {
    const k = c.C("#2F7DC4"), body = rrect(-26, -28, 52, 28, 3), lid = rrect(-27.4, -36, 54.8, 9.6, 3), t = lab(c.p);
    return { pp: 10, w: 58, t: t ? [{ text: t, x: -12, y: -22.4, w: 24, h: 10, font: "print", color: "#1E3A5A", size: 6 }] : undefined, s: [R([[-12, -36], [-9, -43], [9, -43], [12, -36]], "#6B7178", 2.2), S(body, k), ...lit(body, k, -26, 26, -28, 0, 0.2), S(rrect(-12, -23, 24, 12, 1.6), WHITE), F(rect(-26, -4, 52, 1.6), tone(k, "deep"), 0.6, body), S(lid, WHITE), ...lit(lid, WHITE, -27.4, 27.4, -36, -26.4, 0.2), ...[-1, 1].map(d => S(rrect(d * 22 - 2.4, -29.4, 4.8, 6.4, 1), STEEL)), S(rrect(-5, -33, 10, 3, 1.4), tone(WHITE, "shade"))], g: [0, -43] };
  },
  beach_umbrella: c => {
    const k = c.C("#2F8C88"), xs = Array.from({ length: 7 }, (_, j) => -96 + 32 * j);
    const can = poly([[-96, -168], [-70, -196], [0, -212], [70, -196], [96, -168], ...Array.from({ length: 6 }, (_, i) => [[80 - 32 * i, -164], [64 - 32 * i, -171]] as Vec2[]).flat()]);
    const s = [S(ellipse(0, -2, 14, 3.4), SAND), R([[0, -2], [0, -208]], tone(WOOD, "shade"), 2.6), R([[0, -2], [0, -208]], "#E0C79A", 0.6, { flat: true }), S(can, WHITE), ...[0, 2, 4].map(j => F(poly([[0, -214], [xs[j], -166], [xs[j + 1], -166]]), k, 1, can)), ...lit(can, WHITE, -96, 96, -212, -164, 0.1), S(ellipse(0, -213, 2.4), tone(WOOD, "light"))];
    return { pp: 8, w: 200, gap: 20, e: 0.5, s, g: [0, -46], h: fit(zoom(s, 0.42), [0, -40], 0.4) };
  },
  sandcastle: c => {
    const k = c.C(SAND), dk = tone(k, "shade"), tw = (x: number, w: number, h: number): Shape[] => [S(rect(x - w / 2, -h, w, h), k), ...[0, 1, 2].map(i => S(rect(x - w / 2 + i * w * 0.36, -h - 2.4, w * 0.28, 2.6), k)), F(rect(x + w * 0.16, -h, w * 0.34, h), dk, 0.45), S(rrect(x - 0.7, -h + 4, 1.4, 3.4, 0.6), DARK, { flat: true })];
    const s = [S(smooth([[-27, 0, 0], [-18, -4], [0, -5], [18, -4], [27, 0, 0]], true, 1), tone(k, "light")), ...tw(-19, 8, 22), ...tw(19, 8, 18), S(rect(-15, -12, 30, 12), k), ...[-12, -6, 0, 6, 12].map(x => S(rect(x - 1.7, -14.4, 3.4, 2.6), k)), ...tw(0, 14, 24), F(rect(-15, -12, 30, 12), dk, 0.18), S(rrect(-2.6, -9.4, 5.2, 9.4, [2.6, 2.6, 0, 0]), "#5B4636"), ...[-1, 1].map(d => F(rect(d * 8.6 - 0.4, -9, 0.8, 2.4), DARK, 0.7)), R([[0, -26.4], [0, -36]], WOOD, 0.5), P([[0.2, -36, 0], [6, -34.2], [0.2, -32.4, 0]], RED)];
    return { pp: 12, w: 56, e: 0.3, s, g: [0, 0], h: zoom(s, 0.5) };
  },
};
const OUTING_KINDS = ["kite", "fishing_rod", "bait_bucket", "tent", "sleeping_bag", "campfire", "picnic_basket", "beach_ball", "bucket_spade", "life_ring", "binoculars", "cool_box", "beach_umbrella", "sandcastle"];
const outing: PieceDef = {
  draw: gen("outing", OUTING, "kite"), variants: variantsOf(OUTING_KINDS),
  meta: {
    about: "Outing kit: a kite on its line with a bow tail (it sways), a fishing rod with its line, a bait bucket, a tent, a rolled sleeping bag, a campfire of logs with flames and glow, a wicker picnic basket, a beach ball, a sand bucket and spade, a red and white ferry life ring, binoculars, a cool box, a striped beach umbrella or a sandcastle with a flag.",
    params: {
      kind: enumOf(OUTING_KINDS), n: NP(24, "how many side by side (a campfire: up to 4)"),
      color: { type: "color", about: "the main colour (kite, rod, bait bucket, tent, sleeping bag, picnic basket, beach ball's first stripe, sand bucket, life ring's red, binocular body, cool box, umbrella stripes, sand); default fixed per kind" },
      label: { type: "text", about: "words printed on a bait bucket, a life ring (the ferry's name) or a cool box; none by default" },
    },
    terms: ["a1-w-ucurtma", "a2-w-cadir", "a2-w-kamp-atesi", "a2-w-kamp", "a2-w-piknik", "a2-w-kum", "a1-w-plaj", "a2-w-balik-tutmak"],
    tags: ["outing"],
  },
};

// ---- plaything (faceless) --------------------------------------------------------------------------------

const TOYC = ["#D9342B", "#F2C230", "#2F7DC4", "#3E8E4E", "#E8892E", "#7B4FB3"], MARBLE = ["#2F7DC4", "#3E8E4E", "#D9342B", "#E8A33A", "#7B4FB3", "#2F8C88", "#E58FA0"];
const PLAY: Record<string, (c: Ctx) => Look> = {
  teddy: c => {
    const k = c.C("#B98A57"), lt = tone(k, "light"), bw = c.r.pick(["#C8283A", "#2F8C88", "#E58FA0", "#2F6FB8"]), body = ellipse(0, -9, 8.4, 9), head = ellipse(0, -22.6, 7.2, 6.6);
    const arm = (d: number) => T([S(ellipse(0, 0, 2.6, 5.2), k)], mul(translate(d * 9.2, -12.4), rotate(-d * 0.45)));
    return { pp: 14, w: 26, e: 0.3, g: [0, -8], s: [S(ellipse(-5.6, -2.6, 4.2, 3), k), S(ellipse(5.6, -2.6, 4.2, 3), k), F(ellipse(-5.8, -2.2, 2, 1.4), lt, 0.8), F(ellipse(5.8, -2.2, 2, 1.4), lt, 0.8), S(body, k), F(ellipse(0, -8.6, 5, 6), lt, 0.85), ...lit(body, k, -8.4, 8.4, -18, 0, 0.2), ...arm(-1), ...arm(1),
      S(ellipse(-5.8, -28, 2.8), k), S(ellipse(5.8, -28, 2.8), k), F(ellipse(-5.8, -28, 1.5), lt, 0.9), F(ellipse(5.8, -28, 1.5), lt, 0.9), S(head, k), ...lit(head, k, -7.2, 7.2, -29.2, -16, 0.2), P([[0, -15.6, 0], [-4.4, -17.6, 0], [-4.4, -13.6, 0]], bw), P([[0, -15.6, 0], [4.4, -17.6, 0], [4.4, -13.6, 0]], bw), S(ellipse(0, -15.6, 1.1), tone(bw, "deep"))] };
  },
  doll: c => {
    const k = c.C("#2F8C88"), skin = c.r.pick(["#F1C9A5", "#D9A47A", "#A8744F", "#6F4A33"]), hair = c.r.pick(["#3A2A20", "#7A4A2A", "#D9A441", "#1E1E22"]), rb = c.r.pick(["#E58FA0", "#F2C230", "#C8283A"]), dress = smooth([[-3.2, -22, 0], [3.2, -22, 0], [7.4, -10.8, 0], [0, -9.4], [-7.4, -10.8, 0]], true, 1);
    return { pp: 14, w: 20, e: 0.3, g: [5, -16], s: [R([[-2.6, -10], [-2.6, -3]], skin, 2.2), R([[2.6, -10], [2.6, -3]], skin, 2.2), R([[-2.6, -6.4], [-2.6, -3]], WHITE, 2.4), R([[2.6, -6.4], [2.6, -3]], WHITE, 2.4), S(ellipse(-3.4, -1.4, 3, 1.5), DARK), S(ellipse(3.4, -1.4, 3, 1.5), DARK),
      R([[-3, -21], [-8.4, -13.6]], skin, 1.9), R([[3, -21], [8.4, -13.6]], skin, 1.9), S(dress, k), ...lit(dress, k, -7.4, 7.4, -22, -9.4, 0.25), F(rect(-7.4, -12.6, 14.8, 1.2), tone(k, "light"), 0.7, dress), R([[-3, -21.4], [-5.6, -18.4]], k, 2.2), R([[3, -21.4], [5.6, -18.4]], k, 2.2),
      R([[-4.2, -29.6], [-6.6, -25], [-6.2, -20.6]], hair, 2.4), R([[4.2, -29.6], [6.6, -25], [6.2, -20.6]], hair, 2.4), S(ellipse(-6.4, -27.6, 1.1), rb), S(ellipse(6.4, -27.6, 1.1), rb), S(rect(-1.4, -23.4, 2.8, 2.4), skin), S(ellipse(0, -28, 5.4), skin), P([[-5.6, -27, 0], [-5.2, -31.6], [0, -33.4], [5.2, -31.6], [5.6, -27, 0], [3.2, -29.6], [0, -30.6], [-3.2, -29.6]], hair)] };
  },
  toy_car: c => {
    const k = c.C(RED), cab = smooth([[-4.8, -7.2, 0], [-3.6, -11.4], [1.6, -12.2], [4.4, -9.8], [6, -7.2, 0]], true, 1), low = rrect(-8.8, -7.6, 17.6, 4.6, 1.8);
    return { pp: 14, w: 20, e: 0.3, g: [0, -4], s: [S(cab, k), S(poly([[-3.2, -8.2], [-2.6, -10.8], [0.4, -11.2], [0.4, -8.2]]), "#BFE3F2", { flat: true }), S(poly([[1.4, -8.2], [1.4, -11.2], [3.4, -9.6], [4.4, -8.2]]), "#BFE3F2", { flat: true }), S(low, k), ...lit(low, k, -8.8, 8.8, -7.6, -3, 0.2), F(rect(-8.8, -5.6, 17.6, 1, ), WHITE, 0.85, low), S(ellipse(8.2, -5.8, 0.9), "#F2C230"), S(rrect(7.6, -4.2, 2, 1.4, 0.5), STEEL), ...wheel(-5, -2.6, 2.7, DARK, STEEL), ...wheel(5, -2.6, 2.7, DARK, STEEL)] };
  },
  blocks: c => {
    const n = cnt(c.p.n, 6), b = (() => { let m = 1; while (m * (m + 1) / 2 < n) m++; return m; })(), sh: Shape[] = [];
    const sym = (i: number, x: number, y: number): Shape => [F(ellipse(x, y - 3, 1.7), CREAM, 0.95), F(poly([[x, y - 5.2], [x + 2, y - 1.6], [x - 2, y - 1.6]]), CREAM, 0.95), F(poly([[x, y - 5.4], [x + 1.9, y - 3], [x, y - 0.6], [x - 1.9, y - 3]]), CREAM, 0.95), ring(x, y - 3, 1.7, 1.7, CREAM, 0.6, { flat: true }), F(rect(x - 2.2, y - 3.8, 4.4, 1.6), CREAM, 0.95), F(ellipse(x, y - 3, 0.8), CREAM, 0.95)][i % 6];
    const blk = (i: number, x: number, y: number): Shape[] => { const k = TOYC[i % 6]; return [S(rect(x - 3, y - 6, 6, 6), k), S(poly([[x - 3, y - 6], [x + 3, y - 6], [x + 4.2, y - 7.2], [x - 1.8, y - 7.2]]), tone(k, "light")), S(poly([[x + 3, y - 6], [x + 4.2, y - 7.2], [x + 4.2, y - 1.2], [x + 3, y]]), tone(k, "shade")), sym(i, x, y)]; };
    let i = 0;
    for (let row = 0; row < b && i < n; row++) for (let j = 0; j < b - row && i < n; j++, i++) sh.push(...blk(i, (j - (b - row - 1) / 2) * 7.4, -row * 6.2));
    return { pp: 14, w: b * 7.4, solo: true, e: 0.25, s: sh, g: [0, 0], h: mv(zoom(blk(1, 0, 0), 1.6), -4.4, 4.8) };
  },
  toy_robot: c => {
    const k = c.C("#9AA5B1"), dk = tone(k, "shade"), bd = rrect(-6, -21, 12, 11.4, 1.2), hd = rrect(-4.8, -28, 9.6, 6.6, 1.2), arm = (d: number) => T([S(rrect(-1.1, 0, 2.2, 6.4, 1.1), dk), S(rrect(-1.8, 5.4, 3.6, 2.2, 1), RED)], mul(translate(d * 7.4, -19.8), rotate(d * 0.5)));
    return { pp: 14, w: 20, e: 0.3, g: [0, -10], s: [S(rrect(-5.2, -10.6, 4.2, 8, 0.8), dk), S(rrect(1, -10.6, 4.2, 8, 0.8), dk), S(rrect(-6.2, -3.4, 5.6, 3.4, 1.2), DARK), S(rrect(0.6, -3.4, 5.6, 3.4, 1.2), DARK), ...arm(-1), ...arm(1), S(bd, k), ...lit(bd, k, -6, 6, -21, -9.6, 0.22), S(rrect(-4, -19, 8, 5, 0.8), DARK), ...[-2.4, 0, 2.4].map(x => S(ellipse(x, -16.4, 0.8), [RED, "#F2C230", "#3E8E4E"][Math.round(x / 2.4) + 1], { flat: true })), S(ellipse(-3.2, -12.2, 1.2), "#F2C230"), S(ellipse(3.2, -12.2, 1.2), RED), R([[0, -28], [0, -32]], STEEL, 0.5), S(ellipse(0, -32.6, 1.1), RED), S(rrect(-6.4, -26.6, 1.6, 3.6, 0.6), dk), S(rrect(4.8, -26.6, 1.6, 3.6, 0.6), dk), S(hd, k), ...lit(hd, k, -4.8, 4.8, -28, -21.4, 0.25), S(rrect(-3.6, -26, 7.2, 3.6, 0.8), "#26272C"), ...[0, 1, 2].map(i => F(rect(-3.2, -25.2 + i * 1.1, 6.4, 0.45), "#7FA8C0", 0.8))] };
  },
  top: c => {
    const k = c.C("#C8283A"), o = P([[0, 0, 0], [3.4, -4], [4.8, -8], [4, -11], [1.4, -12.6], [-1.4, -12.6], [-4, -11], [-4.8, -8], [-3.4, -4]], k);
    return { pp: 16, w: 12, e: 0.25, g: [0, -15], o: c.p.spin !== false ? { move: { sway: { rot: 0.07, ms: 900 } } } : undefined, s: [S(rrect(-0.9, -16.4, 1.8, 4.2, 0.6), WOOD), S(ellipse(0, -16.6, 1.6, 1), WOOD), o, ...lit(o.path, k, -4.8, 4.8, -12.6, 0, 0.28), F(rect(-6, -9.4, 12, 2.2), "#F2C230", 1, o.path), F(rect(-6, -5.8, 12, 1.4), CREAM, 1, o.path), F(rect(-6, -12.6, 12, 1), CREAM, 1, o.path), S(poly([[-0.5, 0], [0.5, 0], [0, 1.2]]), DARK, { flat: true })] };
  },
  marbles: c => {
    const n = c.n, r = 0.85, sh: Shape[] = [], b = Math.max(1, Math.ceil(Math.sqrt(2 * n))), col0 = (i: number) => typeof c.p.color === "string" ? c.C(MARBLE[0]) : MARBLE[(i * 3 + 1) % 7];
    const mb = (x: number, y: number, r: number, k: string): Shape[] => ball(x, y, r, k, o => [F(ellipse(x + r * 0.1, y + r * 0.1, r * 0.8, r * 0.3), tone(k, "light"), 0.7, o), F(ellipse(x - r * 0.2, y - r * 0.1, r * 0.5, r * 0.2), WHITE, 0.55, o)]);
    let i = 0;
    for (let row = 0; row < b && i < n; row++) for (let j = 0; j < b - row && i < n; j++, i++) sh.push(...mb((j - (b - row - 1) / 2) * 2 * r, -r - row * 1.55 * r, r, col0(i)));
    return { pp: 16, w: b * 2 * r, solo: true, e: 0.12, s: sh, h: mb(0, -9.6, 2.5, col0(0)) };
  },
  yoyo: c => {
    const k = c.C(RED), str_ = "#D8CDB0", yo = ball(0, -3.3, 3.2, k, o => [ring(0, -3.3, 2.3, 2.3, tone(k, "light"), 0.35, { flat: true, clip: o }), F(ellipse(0, -3.3, 0.9), DARK, 0.9)]);
    return { pp: 14, w: 34, e: 0.25, g: [0, -42], s: mv([R([[0, -3.3], [6, -0.9], [12, -2.6], [19, -0.9], [25, -2.2]], str_, 0.3), ring(27.4, -2.2, 2.6, 1.5, str_, 0.35), ...yo], -13, 0), hs: [R([[0, -3.3], [3, -13], [-2.4, -23], [2.4, -33], [0, -40]], str_, 0.3), ring(0, -42, 1.6, 2.2, str_, 0.35), ...yo] };
  },
  rubber_duck: c => {
    const k = c.C("#F2C230");
    return { pp: 16, w: 8, e: 0.2, g: [0, -1.8], s: zoom([P([[-5, -5], [-8.2, -8.4, 0], [-4.4, -7.4]], k), S(ellipse(0, -3.6, 5.4, 3.6), k), S(ellipse(3.4, -8.6, 2.7), k), S(ellipse(6.6, -8, 2, 0.9), "#EE8A2E"), F(ellipse(-0.8, -3.8, 3, 1.8), tone(k, "shade"), 0.55), F(ellipse(-1.6, -5, 1.6, 0.8), tone(k, "light"), 0.8), F(ellipse(4.2, -9.2, 0.4), DARK, 0.9), F(ellipse(2.2, -10.4, 1.1, 0.5), "#FFFFFF", 0.5)], 0.6) };
  },
  toy_train: c => {
    const m = Math.min(c.n, 12), k = c.C(BLUE), eng = (): Shape[] => [S(rrect(-9.8, -5.6, 21.6, 2.2, 0.8), DARK), S(rrect(-2, -11.6, 12.6, 7.6, 3.2), k), F(rect(-2, -9.4, 12.6, 1), WHITE, 0.8, rrect(-2, -11.6, 12.6, 7.6, 3.2)), S(ellipse(3, -11.8, 2, 1.4), tone(k, "shade")), S(rrect(6.6, -17, 3, 5.6, 0.8), DARK), S(rrect(6, -17.8, 4.2, 1.4, 0.7), DARK), S(rrect(-9.4, -16.4, 8.2, 12.6, 1), tone(k, "shade")), S(rrect(-10.4, -18, 10.2, 2, 0.8), RED), S(rrect(-7.8, -13.6, 3.6, 4.6, 0.8), "#BFE3F2", { flat: true }), S(ellipse(10.8, -8.4, 1), "#F2C230"), S(poly([[11, -5.4], [14, -3], [11, -3]]), RED), ...wheel(-5, -3, 3, DARK, RED), ...wheel(3, -2.6, 2.4, DARK, "#F2C230"), ...wheel(8.6, -2.6, 2.4, DARK, "#F2C230")];
    const wag = (x: number, i: number): Shape[] => { const w = TOYC[(i + 1) % 6]; return [R([[x + 6.5, -3.4], [x + 9, -3.4]], DARK, 0.5), S(rrect(x - 6.4, -9.4, 12.8, 5.6, 0.8), w), ...lit(rrect(x - 6.4, -9.4, 12.8, 5.6, 0.8), w, x - 6.4, x + 6.4, -9.4, -3.8, 0.25), ...[-3.6, 0, 3.6].map(d => F(rect(x + d - 0.2, -9.4, 0.4, 5.6), tone(w, "deep"), 0.6)), ...wheel(x - 3.6, -2.4, 2.4, DARK, CREAM), ...wheel(x + 3.6, -2.4, 2.4, DARK, CREAM)]; };
    const sh = [...eng(), ...Array.from({ length: m - 1 }, (_, i) => wag(-19.6 - 15 * i, i)).flat()], left = m > 1 ? -26 - 15 * (m - 2) : -10.4;
    return { pp: 14, w: 14 - left, solo: true, e: 0.25, s: mv(sh, -(left + 14) / 2, 0), g: [0, -6], h: mv(eng(), 0, 6) };
  },
  rattle: c => {
    const k = c.C("#E58FA0");
    return { pp: 16, w: 11, e: 0.25, g: [0, -9], s: [ring(0, -3.4, 3.2, 3.2, WHITE, 1.2), ring(0, -3.4, 3.2, 3.2, tone(WHITE, "shade"), 0.3, { flat: true }), S(rrect(-1, -10, 2, 5, 0.8), WHITE), S(ellipse(0, -9.4, 2.2, 1), k), ...ball(0, -13.4, 4.2, k, o => [F(rect(-5, -14.4, 10, 1.6), "#F2C230", 0.95, o), F(rect(-5, -11.4, 10, 1.1), WHITE, 0.95, o)]), S(ellipse(0, -9.4, 2, 0.9), tone(k, "deep"))] };
  },
  pinwheel: c => {
    const n = Math.min(c.n, 8), cs = [c.C(RED), "#F2C230", "#2F7DC4", WHITE], x0 = (i: number) => (i - (n - 1) / 2) * 24;
    const head = (): Shape[] => [0, 1, 2, 3].flatMap(i => T([S(poly([[0, 0], [9, 0], [9, -9]]), cs[i]), F(poly([[0, 0], [9, -9], [4.2, -2.2]]), tone(cs[i], "shade"), 0.5)], rotate(i * Math.PI / 2))).concat(S(ellipse(0, 0, 1.2), "#F7F3EA"));
    const stick = (x: number): Shape[] => [R([[x, 0], [x, -42]], WOOD, 1), S(ellipse(x, -0.6, 1.4, 0.6), tone(WOOD, "shade"), { flat: true })];
    return { pp: 14, w: 24, solo: true, g: [0, -14], s: Array.from({ length: n }, (_, i) => stick(x0(i))).flat(), h: mv([...stick(0), ...mv(head(), 0, -42)], 0, 14),
      more: Array.from({ length: n }, (_, i): FlatSpec => ({ group: { shapes: head(), edge: 0.3 }, ppcm: 14, id: "plaything", x: x0(i), y: 42, z: 0.5, move: { sway: { rot: 0.3, ms: 1800 }, phase: i / n } })) };
  },
  bubbles: c => {
    const k = c.C("#2F8C88"), bub = (x: number, y: number, r: number): Shape[] => [F(ellipse(x, y, r), "#DFF3FB", 0.22), ring(x, y, r, r, "#9ED0E6", 0.3, { flat: true }), ln([[x - r * 0.6, y - r * 0.2], [x - r * 0.4, y - r * 0.6], [x, y - r * 0.8]], "#FFFFFF", 0.3, undefined, 0.9), ln([[x + r * 0.5, y + r * 0.5], [x + r * 0.2, y + r * 0.75]], "#FFFFFF", 0.25, undefined, 0.6)];
    const body = rrect(-3.4, -10, 6.8, 10, 1.6);
    return { pp: 12, w: 22, e: 0.3, g: [0, -5], s: [R([[1, -12], [4, -22], [5.6, -27]], "#6B7178", 0.6), ring(5.8, -29.4, 2.8, 2.8, "#6B7178", 0.6), F(ellipse(5.8, -29.4, 2.4), "#DFF3FB", 0.3), S(body, k), ...lit(body, k, -3.4, 3.4, -10, 0, 0.26), S(rrect(-2.4, -13.2, 4.8, 3.4, 0.8), "#F2C230"), F(rect(-3.4, -7.6, 6.8, 3.6), WHITE, 0.9, body), F(ellipse(0, -5.8, 1.1), "#9ED0E6", 0.9), ...bub(10, -36, 3.4), ...bub(-6.4, -41, 2.4), ...bub(3.6, -47, 1.8), ...bub(-9.4, -31, 1.5), ...bub(13.6, -25, 1.2)] };
  },
  paper_plane: c => {
    const k = c.C("#BFD9EC"), A: Vec2 = [13, -10], B: Vec2 = [-12, -13], C: Vec2 = [-8, -4], D: Vec2 = [-3, -1.2], E: Vec2 = [-2, -7];
    return { pp: 14, w: 28, e: 0.3, g: [0, -5], s: T([S(poly([A, B, E]), tone(k, "light")), S(poly([A, E, D]), k), S(poly([E, D, C]), tone(k, "shade")), ln([A, E, B], tone(k, "deep"), 0.35), ln([E, D], tone(k, "deep"), 0.35), ln([[0, -9], [6, -8.4]], "#6B9AC4", 0.4, undefined, 0.8)], rotate(-0.3)) };
  },
  toy_boat: c => {
    const k = c.C("#2F6FB8"), hull = P([[-11.4, -8.6, 0], [11.4, -8.6, 0], [8.4, -3, 0], [-8.4, -3, 0]], k);
    return { pp: 14, w: 26, e: 0.3, g: [0, -5], s: [S(rrect(-6.4, -3.2, 12.8, 3.2, 1), WOOD), R([[0, -8], [0, -28]], tone(WOOD, "shade"), 0.7), P([[1, -27, 0], [1, -10], [9.4, -10, 0]], WHITE), P([[-1, -25, 0], [-1, -10], [-8, -10, 0]], RED), P([[0, -28.4, 0], [4.4, -27.2], [0, -26, 0]], "#F2C230"), hull, ...lit(hull.path, k, -11.4, 11.4, -8.6, -3, 0.24), F(rect(-11.4, -8.6, 22.8, 1.2), CREAM, 0.95, hull.path), ...[-5, 0, 5].map(x => S(ellipse(x, -5.8, 0.9), "#BFE3F2", { flat: true }))] };
  },
};
const PLAY_KINDS = ["teddy", "doll", "toy_car", "blocks", "toy_robot", "top", "marbles", "yoyo", "rubber_duck", "toy_train", "rattle", "pinwheel", "bubbles", "paper_plane", "toy_boat"];
const plaything: PieceDef = {
  draw: gen("plaything", PLAY, "teddy"), variants: variantsOf(PLAY_KINDS),
  meta: {
    about: "Toys, all faceless: a teddy bear, a rag doll, a toy car, a pyramid of wooden blocks (no letters), a tin robot, a spinning top (topaç), a heap of marbles (misket), a yo-yo on its string, a rubber duck, a wooden toy train, a baby rattle, a pinwheel on its stick (the head sways), a bubble bottle with its wand and bubbles, a folded paper plane or a toy sailing boat.",
    params: {
      kind: enumOf(PLAY_KINDS), n: { type: "int", min: 1, max: 24, about: "how many: side by side; blocks (default 6) stack as a pyramid; marbles heap up; a train's cars (engine first, up to 12); pinwheels (up to 8)" },
      color: { type: "color", about: "the main colour (bear's fur, doll's dress, car, robot, top, marbles, yo-yo, duck, train's engine, rattle, pinwheel's first vane, bubble bottle, paper, boat's hull); default fixed per kind, the doll's skin and hair and the bear's bow seeded" },
      spin: { type: "bool", default: true, about: "top: it wobbles on its tip" },
    },
    terms: ["a2-w-oyuncak", "a2-w-robot"],
    tags: ["toy"],
  },
};

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { sport, outing, plaything };
