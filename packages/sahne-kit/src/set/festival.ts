// Festival pieces and props (STYLE.md): a wooden Christmas-market hut, a Christmas tree, a maypole, a fairground carousel, and
// the small things of the year's feasts (an Advent wreath, a gingerbread heart, Easter eggs, masks, a flower crown, a St Martin's
// lantern, a paper crown, a nutcracker, a bauble). Units cm; a piece's origin is its bottom centre, a prop's likewise and, held,
// the grip. Everything that shines at night is in `emissive`, the strings of bulbs by turns (`litByTurns`). Words are `text`
// on the art, with their `lang` (the feasts here are European: they default to German). No drink is drawn: the stories are
// for learners of every age.

import { Path, arcPoints, ellipse, rect, rrect, poly, smooth, tone, mul, translate, groupBounds, type Affine, type EmitSpec, type FlatSpec, type LightSpec, type ParamSpec, type PieceDef, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, num, str, hex, litByTurns, solidLine, type Pt } from "./draw.ts";

const DARK = "#2E2F35", GOLD = "#E2B33C", CREAM = "#F3EBD8", WOOD = "#8A5A3C", PINE = "#2F6B44", RED = "#B3262E", SNOW = "#F5F8FB", BULB = "#FFE6A6", WHITE = "#FBF8F2", INK = "#2B2420", GLASS = "#CFE6EE";
type Prm = Record<string, unknown>;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- helpers -------------------------------------------------------------------------------------

/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a rod, a ribbon, a string. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(), w = x1 - x0; return [F(rect(x1 - w * k, y0 - 1, w * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, w * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)]; };
/** A cut outline with its light. */
const O = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...lit(o, c, k)];
/** Many small round marks in one shape. */
const dots = (pts: Vec2[], r: number, c: string, op = 1, o: Partial<Shape> = {}): Shape => { const p = new Path(); for (const [x, y] of pts) p.add(ellipse(x, y, r)); return { path: p, fill: c, flat: true, opacity: op, ...o }; };
/** Printed strokes as one flat shape. */
const lines = (segs: Vec2[][], c: string, w = 0.5, op = 0.7, clip?: Path): Shape => { const p = new Path(); for (const s of segs) p.add(poly(s, false)); return { path: p, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }; };
/** A glass ball (r cm) with its gold cap and highlight. */
const ball = (x: number, y: number, r: number, c: string): Shape[] => [S(rrect(x - r * 0.28, y - r * 1.32, r * 0.56, r * 0.46, 0.3), GOLD), S(ellipse(x, y, r), c), F(ellipse(x + r * 0.28, y + r * 0.34, r * 0.62), tone(c, "shade"), 0.4, ellipse(x, y, r)), F(ellipse(x - r * 0.34, y - r * 0.38, r * 0.26, r * 0.18), "#FFFFFF", 0.7)];
/** A five-pointed star of outer radius r. */
const star = (x: number, y: number, r: number, k = 0.45): Path => poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * k : r; return [x + Math.cos(a) * q, y + Math.sin(a) * q] as Vec2; }));
/** A heart about (x, y), its tip at the bottom, `s` times 18 cm wide. */
const heart = (x: number, y: number, s: number): Path => smooth([[0, 0, 0], [-8.4, -6.4], [-9.6, -11.8], [-6.8, -16], [-2.9, -15.2], [0, -12.4, 0], [2.9, -15.2], [6.8, -16], [9.6, -11.8], [8.4, -6.4]].map(([a, b, c]) => (c === 0 ? [x + a * s, y + b * s, 0] : [x + a * s, y + b * s]) as Pt), true, 1);
/** A glow: a warm halo with a bright core. */
const halo = (x: number, y: number, r: number, c = "#FFC66B", o = 0.28): Shape[] => [S(ellipse(x, y, r), c, { opacity: o }), S(ellipse(x, y, r * 0.42), "#FFF1C4", { opacity: 0.9 })];
const tx = (t: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec[] => t.trim() ? [{ text: t.trim(), x, y, w, h, font: "print", ...o }] : [];

/** A scalloped shape of `n` equal bites along the bottom of x0 … x1, hanging from y. */
const scallops = (x0: number, x1: number, y: number, n: number, d: number): Vec2[] => { const w = (x1 - x0) / n, out: Vec2[] = []; for (let i = n - 1; i >= 0; i--) out.push(...arcPoints(x0 + (i + 0.5) * w, y, w / 2, d, 0, Math.PI, 6)); return out; };

// ---- the market hut ------------------------------------------------------------------------------

const GOODS = ["ornaments", "gingerbread", "candles", "woodcraft", "sweets"];
const BALLS = ["#C8283A", GOLD, "#3B7DC4", CREAM, "#2F8F5B"];

/** What a hut sells: `hi` hangs from the fascia, `shelf` stands on the shelf (y -152), `top` on the counter (y -102). */
function goods(kind: string, a: number, r: Rng): { hi: Shape[]; shelf: Shape[]; top: Shape[] } {
  const hi: Shape[] = [], shelf: Shape[] = [], top: Shape[] = [], xs = (n: number, m = 26) => Array.from({ length: n }, (_, i) => -a + m + i * (2 * a - 2 * m) / Math.max(1, n - 1));
  const n = Math.max(4, Math.round(a / 20));
  if (kind === "ornaments") {
    for (const [i, x] of xs(n, 18).entries()) { const y = -222 + 14 + (i % 3) * 14 + r.range(0, 8), c = BALLS[(i + r.int(0, 2)) % BALLS.length]; hi.push(R([[x, -222], [x, y - 8]], CREAM, 0.5, { flat: true, opacity: 0.8 }), ...ball(x, y, 7, c)); }
    for (const [i, x] of xs(n + 1, 14).entries()) shelf.push(...ball(x, -152 - 6.4, 6.4, BALLS[(i * 2) % BALLS.length]));
    for (const x of [-a * 0.55, a * 0.1, a * 0.6]) { const c = BALLS[r.int(0, 4)]; top.push(...O(rrect(x - 11, -102 - 18, 22, 18, 1.5), c), F(rect(x - 1.8, -102 - 18, 3.6, 18), GOLD, 0.9), F(rect(x - 11, -102 - 10, 22, 3.6), GOLD, 0.9)); }
  } else if (kind === "gingerbread") {
    for (const [i, x] of xs(Math.max(3, n - 1), 22).entries()) { const y = -222 + 28 + (i % 2) * 14, h = heart(x, y, 1.05); hi.push(R([[x - 5, -222], [x, y - 15]], RED, 0.9), R([[x + 5, -222], [x, y - 15]], RED, 0.9), ...O(h, "#9A5B2C", 0.18), F(heart(x, y - 1.4, 0.8), WHITE, 0.0), lines([[[x - 5, y - 9], [x + 5, y - 9]]], WHITE, 0.9, 0.95)); }
    for (const x of [-a * 0.5, 0, a * 0.5]) shelf.push(...O(heart(x, -152, 1.5), "#A9622F", 0.18), { path: heart(x, -153.5, 1.2), stroke: { color: WHITE, width: 0.9, dash: [1.2, 1.4] }, flat: true, opacity: 0.95 });
    for (const [i, x] of [-a * 0.6, -a * 0.2, a * 0.25, a * 0.65].entries()) for (let k = 0; k < 3; k++) top.push(...O(ellipse(x, -102 - 3 - k * 5, 11, 3), "#B57A3C", 0.2), dots([[x - 4, -102 - 3.4 - k * 5], [x + 2, -102 - 2.6 - k * 5]], 0.8, WHITE, 0.9), ...(i === 9 ? [] : []));
  } else if (kind === "candles") {
    for (const [i, x] of xs(n + 3, 14).entries()) { const h = 20 + (i * 7) % 16, c = [CREAM, RED, "#2F6B44", "#E8B53A"][i % 4]; shelf.push(...O(rect(x - 2.6, -152 - h, 5.2, h), c, 0.25), S(ellipse(x, -152 - h - 2.2, 1.2, 2.2), "#F6A23A")); }
    for (const x of [-a * 0.6, -a * 0.25, a * 0.2, a * 0.6]) top.push(...O(rrect(x - 7, -102 - 28, 14, 28, 1.5), x < 0 ? CREAM : "#D8C089", 0.25), F(ellipse(x, -102 - 28, 6, 1.4), tone(CREAM, "shade"), 0.7), S(ellipse(x, -102 - 31, 1.3, 2.6), "#F6A23A"));
    for (const [i, x] of xs(Math.max(3, n - 2), 28).entries()) hi.push(...O(rect(x - 2, -222, 4, 14 + (i % 3) * 8), i % 2 ? CREAM : RED, 0.25));
  } else if (kind === "woodcraft") {
    for (const [i, x] of xs(Math.max(3, n - 1), 24).entries()) { const y = -222 + 22 + (i % 2) * 16, s = star(x, y, 11); hi.push(R([[x, -222], [x, y - 11]], CREAM, 0.5, { flat: true, opacity: 0.8 }), ...O(s, i % 2 ? "#D9A86A" : "#C48A4A", 0.18)); }
    for (const [i, x] of [-a * 0.55, -a * 0.2, a * 0.2, a * 0.55].entries()) shelf.push(...O(rrect(x - 6, -152 - 28, 12, 20, 1.2), i % 2 ? RED : "#2F6B44", 0.22), S(ellipse(x, -152 - 33, 5, 5), "#E8C9A0"), ...O(rect(x - 5, -152 - 54 + 14, 10, 17), DARK, 0.25), S(rect(x - 6, -152 - 8, 12, 8), DARK));
    for (const x of [-a * 0.5, a * 0.05, a * 0.55]) top.push(...O(rect(x - 12, -102 - 8, 24, 8), "#C48A4A", 0.2), ...O(rect(x - 8, -102 - 16, 16, 8), "#D9A86A", 0.2), ...O(star(x, -102 - 25, 9), "#E2B070", 0.18));
  } else {
    for (const [i, x] of xs(Math.max(3, n - 1), 24).entries()) { const y = -222 + 4 + (i % 2) * 14; hi.push({ path: smooth([[x, -222], [x, y + 20], [x + 8, y + 30], [x + 12, y + 22]], false, 1), stroke: { color: WHITE, width: 3.6, cap: "round" } }, { path: smooth([[x, -222], [x, y + 20], [x + 8, y + 30], [x + 12, y + 22]], false, 1), stroke: { color: RED, width: 3.6, cap: "round", dash: [3.2, 3.2] }, flat: true }); }
    for (const [i, x] of xs(Math.max(3, n - 1), 24).entries()) { const c = ["#E8453C", "#F2B632", "#8CC152", "#B65CA8"][i % 4]; shelf.push(S(rrect(x - 8, -152 - 24, 16, 24, 3), GLASS, { opacity: 0.9 }), dots(Array.from({ length: 9 }, (_, k) => [x - 4 + (k % 3) * 4, -152 - 5 - Math.floor(k / 3) * 5.4] as Vec2), 1.7, c, 1), F(rect(x - 7, -152 - 24, 14, 3.4), tone(c, "deep"), 0.9), F(rect(x - 6.4, -152 - 22, 1.4, 18), WHITE, 0.55)); }
    for (const x of [-a * 0.55, -a * 0.1, a * 0.4]) top.push(P([[x - 9, -102, 0], [x + 9, -102, 0], [x + 5, -102 - 22, 0], [x - 5, -102 - 22, 0]], "#C9A06A"), dots([[x - 3, -102 - 22], [x + 2, -102 - 24], [x + 5, -102 - 21]], 2.4, "#B5651D", 1, { flat: false }), F(rect(x - 9, -102 - 10, 18, 3), RED, 0.8));
  }
  return { hi, shelf, top };
}

/**
 * A wooden Christmas-market hut seen from the front: planked counter and posts, a pitched roof (with `snow`), a sign over a
 * swag of green garland hung with bulbs that light by turns at night (`lit`), and what it sells by `kind`. `w` cm wide (240).
 */
const marketHut: PieceDef = { draw(p, r) {
  const kind = GOODS.includes(str(p.kind, "")) ? str(p.kind, "") : GOODS[0], w = clamp(num(p.w, 240), 160, 400), a = w / 2, snow = p.snow !== false, on = p.lit !== false;
  const wood = hex(p.color, WOOD), roof = hex(p.roof, "#9C3B2E"), sign = str(p.sign, "Weihnachtsmarkt"), lang = str(p.lang, "de");
  const back: Shape[] = [], front: Shape[] = [], bulbsA: Shape[] = [], glow: Shape[] = [], inGlow: Shape[] = [];
  // behind the counter: the dark inside, its shelf and wares, two hanging lamps
  const inner = rect(-a + 6, -222, w - 12, 126);
  back.push(S(inner, "#3A2A22"), lines(Array.from({ length: Math.floor((w - 12) / 22) }, (_, i) => [[-a + 6 + (i + 1) * 22, -222], [-a + 6 + (i + 1) * 22, -96]] as Vec2[]), "#241915", 0.7, 0.8, inner));
  const g = goods(kind, a, r);
  back.push(...g.hi, S(rect(-a + 6, -152, w - 12, 5), tone(wood, "light")), F(rect(-a + 6, -147, w - 12, 2), "#000000", 0.25), ...g.shelf);
  for (const x of [-a * 0.42, a * 0.42]) { back.push(R([[x, -222], [x, -203]], DARK, 0.7), ...O(poly([[x - 8, -190], [x + 8, -190], [x + 5, -203], [x - 5, -203]]), "#E8D8A8", 0.2)); inGlow.push(...halo(x, -194, 30, "#FFC66B", 0.16), S(ellipse(x, -194, 7), "#FFE6A8", { opacity: 0.9 })); }
  // the counter, its top and the goods on it
  front.push(...O(rect(-a, -96, w, 96), wood, 0.12), lines(Array.from({ length: Math.floor(w / 18) }, (_, i) => [[-a + (i + 1) * 18, -92], [-a + (i + 1) * 18, -2]] as Vec2[]), tone(wood, "deep"), 0.6, 0.55), F(rrect(-a + 10, -84, w - 20, 66, 2), tone(wood, "shade"), 0.18), { path: rrect(-a + 10, -84, w - 20, 66, 2), stroke: { color: tone(wood, "deep"), width: 0.7 }, flat: true, opacity: 0.7 });
  front.push(...g.top, ...O(rrect(-a - 5, -104, w + 10, 8, 1.2), tone(wood, "light"), 0.12));
  // the posts, the fascia and the roof
  for (const s of [-1, 1]) front.push(...O(rect(s * a - (s < 0 ? 9 : 1), -252, 10, 252), tone(wood, "deep"), 0.3));
  front.push(...O(rect(-a - 9, -252, w + 18, 32), wood, 0.1), F(rect(-a - 9, -226, w + 18, 4), tone(wood, "deep"), 0.4));
  const hw = a + 32, rise = 78, ry = (x: number) => -250 - rise * (1 - Math.abs(x) / hw), tri = poly([[-hw, -250], [0, -250 - rise], [hw, -250]]);
  front.push(S(tri, roof), ...lit(tri, roof, 0.22), lines([0.3, 0.55, 0.78].map(f => [[-hw * (1 - f), -250 - rise * f], [hw * (1 - f), -250 - rise * f]] as Vec2[]), tone(roof, "deep"), 0.9, 0.6, tri), F(rect(-hw, -253, hw * 2, 4), tone(roof, "deep"), 0.8));
  if (snow) {
    const xs: number[] = []; for (let x = -hw + 4; x <= hw - 4; x += 8) xs.push(x);
    const phase = r.range(0, 6), top = xs.map(x => [x, ry(x) - 2.6] as Vec2), bot = [...xs].reverse().map(x => [x, ry(x) + Math.max(1.5, Math.min(7 + 3 * Math.sin(x * 0.11 + phase), (-250 - ry(x)) + 3))] as Vec2);
    front.push(S(poly([...top, ...bot]), SNOW), F(rect(-hw, -330, hw * 2, 90), tone(SNOW, "shade"), 0.0));
    for (const [x, y] of bot.filter((_, i) => i % 3 === 0)) front.push(F(ellipse(x, y - 2.5, 3.4, 2), tone(SNOW, "shade"), 0.35));
  }
  // the sign on the fascia
  const sw = Math.min(w * 0.62, 190);
  front.push(...O(rrect(-sw / 2, -249, sw, 25, 3), CREAM, 0.14), { path: rrect(-sw / 2 + 1.6, -247.4, sw - 3.2, 21.8, 2), stroke: { color: tone(wood, "deep"), width: 0.6 }, flat: true, opacity: 0.8 });
  // the garland: green swags between the posts, berries, and a string of bulbs under each
  const arcs = Math.max(2, Math.round(w / 90)), sag = 15, y0 = -222, xAt = (i: number) => -a + 2 + (i * (w - 4)) / arcs;
  for (let i = 0; i < arcs; i++) {
    const x0 = xAt(i), x1 = xAt(i + 1), pts: Vec2[] = Array.from({ length: 9 }, (_, k) => { const t = k / 8; return [x0 + (x1 - x0) * t, y0 + 4 * sag * t * (1 - t)] as Vec2; });
    front.push(R(pts, tone(PINE, "deep"), 8.4), R(pts, PINE, 6.4), R(pts, tone(PINE, "light"), 2, { flat: true, opacity: 0.45 }));
    front.push(dots(pts.filter((_, k) => k % 2 === 1).map(([x, y]) => [x, y + 1] as Vec2), 1.5, RED, 1, { flat: false }));
    const nb = Math.max(3, Math.round((x1 - x0) / 17));
    for (let k = 1; k < nb; k++) { const t = k / nb, x = x0 + (x1 - x0) * t, y = y0 + 4 * sag * t * (1 - t) + 7; bulbsA.push(R([[x, y - 5], [x, y - 1]], tone(PINE, "deep"), 0.5), S(ellipse(x, y, 2.6, 3.2), BULB)); glow.push(...halo(x, y, 6.4, "#FFC66B", 0.3)); }
  }
  front.push(...[0, arcs].map(i => S(ellipse(xAt(i), y0, 4), RED)), ...Array.from({ length: arcs - 1 }, (_, i) => S(ellipse(xAt(i + 1), y0 + 1, 4), RED)));
  const ppcm = Math.min(2.4, 1900 / (w + 100), 1900 / 340), lights: LightSpec[] = on ? [{ x: 0, y: 170, z: 50, color: "#FFC878", radius: 3.4, intensity: 0.8, switch: false, at: ["dawn", "dusk", "night"] }] : [];
  const text = tx(sign, -sw / 2 + 4, -248, sw - 8, 23, { color: INK, weight: 800, lang });
  return { flats: [
    { group: { shapes: back, edge: 0.5 }, z: -34, ppcm, ...(on ? { emissive: { shapes: inGlow, edge: 0 }, switch: false as const, glowAt: 0.05 } : {}) },
    { group: { shapes: [...front, ...bulbsA], edge: 0.6 }, ppcm, id: "market_hut", ...(text.length ? { text } : {}) },
    ...(on ? litByTurns(glow, { ppcm, z: 0.5 }, 5, 0.1, 0.7) : []),
  ], lights };
},
  variants: Object.fromEntries(GOODS.map(k => [k, { kind: k }])),
  solid(p) { const a = clamp(num(p.w, 240), 160, 400) / 2; return solidLine(-a, a); },
  meta: {
    about: "A wooden Christmas-market hut: a planked counter, a pitched roof (snowy), a sign over a garland of bulbs that light by turns at night, and its wares: ornaments, gingerbread, candles, wood crafts or sweets.",
    params: {
      kind: { type: "enum", values: GOODS, default: "ornaments", about: "what it sells" },
      w: { type: "num", min: 160, max: 400, default: 240, about: "width, cm" },
      color: { type: "color", about: "its wood; default brown" },
      roof: { type: "color", about: "its roof; default dark red" },
      snow: { type: "bool", default: true, about: "snow on the roof" },
      lit: { type: "bool", default: true, about: "the garland's bulbs and the lamps inside glow at night" },
      sign: { type: "text", default: "Weihnachtsmarkt", about: "the words on the sign" },
      lang: { type: "text", default: "de", about: "the sign's language (a BCP-47 tag)" },
    },
    terms: [], tags: ["festival", "christmas", "market", "light"],
  } };

// ---- the Christmas tree --------------------------------------------------------------------------

const TREE_LIGHTS = ["#FFE6A6", "#FF8A5C", "#7FD0FF", "#9BE38A", "#FF7AA8"];

/**
 * A Christmas tree: tiers of dark branches with a tinsel swag on each, baubles, a star on top, a string of lights that come on
 * by turns at night, in a wooden tub with presents beside it. `h` cm tall (340), up to 6 `tiers`.
 */
const christmasTree: PieceDef = { draw(p, r) {
  const h = clamp(num(p.h, 340), 150, 600), tiers = Math.round(clamp(num(p.tiers, 5), 3, 6)), W = h * 0.34, k = h / 340, g = hex(p.color, PINE);
  const withLights = p.lights !== false, multi = !!p.multi, withStar = p.star !== false, snow = !!p.snow, gifts = Math.round(clamp(num(p.gifts, 3), 0, 5)), nb = Math.round(clamp(num(p.baubles, 0.7), 0, 1) * tiers * 5);
  const sh: Shape[] = [], top: Shape[] = [], bulbs: Shape[] = [], glow: Shape[] = [], yBot = -h * 0.09, yTop = -h * 0.88, s = (yBot - yTop) / (0.8 * (tiers - 1) + 1.5);
  const info: { ap: number; bs: number; hw: number }[] = Array.from({ length: tiers }, (_, i) => ({ ap: yTop + i * 0.8 * s, bs: yTop + i * 0.8 * s + 1.5 * s, hw: W * (i + 1) / tiers }));
  sh.push(...O(rect(-4 * k, yBot - 4, 8 * k, -yBot), "#6B4A35", 0.3));
  for (let i = tiers - 1; i >= 0; i--) {
    const { ap, bs, hw } = info[i], c = i % 2 ? tone(g, "deep") : g, pts: Vec2[] = [[0, ap]];
    const side = 4; for (let j = 1; j <= side; j++) { const t = j / side; pts.push([hw * t + (j % 2 ? 2.4 : -0.6) * k, ap + (bs - ap) * t]); }
    const teeth = Math.max(4, Math.round(hw / (9 * k)));
    for (let j = 1; j <= teeth; j++) { const x = hw - (2 * hw * j) / teeth, up = (bs - ap) * 0.07; pts.push([x + hw / teeth, bs - up * 0.2], [x + hw / (2 * teeth), bs - up * 1.1 - 2 * k]); }
    const left = pts.slice(1, side + 1).map(([x, y]) => [-x + (4.8 * k * 0), y] as Vec2).reverse();
    const o = poly([...pts, ...left]);
    sh.push(S(o, c), ...lit(o, c, 0.2), lines([0.3, 0.55, 0.8].map(f => { const y = ap + (bs - ap) * f, x = hw * f * 0.85; return [[-x, y + 3], [-x * 0.4, y + 1.2 - 3 * k], [x * 0.4, y + 1.2 - 3 * k], [x, y + 3]] as Vec2[]; }), tone(c, "deep"), 0.7, 0.6, o));
    // the tinsel swag across the tier
    const f = 0.62, y = ap + (bs - ap) * f, x = hw * f * 0.92;
    sh.push(R([[-x, y - 4], [-x * 0.4, y + 3.5 * k], [x * 0.4, y + 5 * k], [x, y - 3]], i % 2 ? GOLD : "#D8DDE3", 2.6 * k, { flat: true, opacity: 0.95 }));
    if (snow) for (const sgn of [-1, 1]) sh.push(F(ellipse(sgn * hw * 0.32, ap + (bs - ap) * 0.36, hw * 0.16, 2.6 * k), SNOW, 0.95, o), F(ellipse(sgn * hw * 0.62, ap + (bs - ap) * 0.7, hw * 0.12, 2.2 * k), SNOW, 0.95, o));
    // a string of lights near the tier's lower edge
    if (withLights) {
      const n = Math.max(3, Math.round(hw / (11 * k))), fy = 0.82;
      for (let j = 0; j < n; j++) {
        const t = n === 1 ? 0 : j / (n - 1) * 2 - 1, bx = t * hw * fy * 0.88, by = ap + (bs - ap) * fy - 3 * k + Math.abs(Math.sin(j * 1.7 + i)) * 4 * k, lc = multi ? TREE_LIGHTS[(j + i) % TREE_LIGHTS.length] : BULB;
        bulbs.push(S(ellipse(bx, by, 1.9 * k, 2.4 * k), lc, { flat: true })); glow.push(...halo(bx, by, 7 * k, multi ? lc : "#FFC66B", 0.3));
      }
    }
  }
  // baubles, scattered on the tiers
  for (let j = 0; j < nb; j++) { const { ap, bs, hw } = info[r.int(0, tiers - 1)], f = r.range(0.35, 0.85), bx = r.range(-1, 1) * hw * f * 0.8, by = ap + (bs - ap) * f; top.push(...ball(bx, by + 4 * k, r.range(3.4, 5) * k, BALLS[j % BALLS.length])); }
  // the star
  const sr = Math.max(9, 11 * k), sy = yTop - sr * 0.5, starP = star(0, sy, sr);
  if (withStar) top.push(...O(starP, GOLD, 0.2), F(star(0, sy, sr * 0.5), "#FFF1C4", 0.6));
  // the tub and the presents
  const tw = W * 0.2, tub = rrect(-tw, -h * 0.085, tw * 2, h * 0.085, 3);
  top.push(...O(tub, "#7A4A2E", 0.2), lines([-0.5, 0, 0.5].map(f => [[tw * f, -h * 0.083], [tw * f, -2]] as Vec2[]), tone("#7A4A2E", "deep"), 0.7, 0.55, tub), F(rect(-tw, -h * 0.05, tw * 2, 3), GOLD, 0.85, tub), F(rect(-tw, -h * 0.025, tw * 2, 3), GOLD, 0.85, tub));
  const cols = [RED, "#3B7DC4", "#2F8F5B", GOLD, "#B65CA8"], gx = [-0.9, 0.95, -0.55, 0.55, 1.35];
  for (let i = 0; i < gifts; i++) { const gw = (24 + (i * 7) % 12) * Math.max(1, k), gh = gw * (0.7 + (i % 2) * 0.3), gx0 = gx[i] * W * 0.5 - gw / 2, c = cols[i % cols.length], rib = i % 2 ? CREAM : GOLD; top.push(...O(rrect(gx0, -gh, gw, gh, 1.2), c, 0.2), F(rect(gx0 + gw / 2 - 1.5, -gh, 3, gh), rib, 0.95), F(rect(gx0, -gh * 0.55, gw, 3), rib, 0.95), S(ellipse(gx0 + gw / 2 - 2.4, -gh - 1.8, 2.6, 2), rib), S(ellipse(gx0 + gw / 2 + 2.4, -gh - 1.8, 2.6, 2), rib)); }
  const ppcm = Math.min(2.4, 1900 / (h + 40)), lights: LightSpec[] = withLights ? [{ x: 0, y: h * 0.5, z: 60, color: "#FFD9A0", radius: 3.4, intensity: 0.7, switch: false, at: ["dawn", "dusk", "night"] }] : [];
  const starGlow = withStar ? { emissive: { shapes: [...halo(0, sy, sr * 1.7, "#FFD27A", 0.3), S(starP, "#FFF1C4", { opacity: 0.95 })], edge: 0 }, glowAt: 0.05, switch: false as const } : {};
  return { flats: [{ group: { shapes: [...sh, ...top, ...bulbs], edge: 0.6 }, ppcm, id: "christmas_tree", ...starGlow }, ...(withLights ? litByTurns(glow, { ppcm, z: 0.5 }, 6, 0.1, 0.7) : [])], lights };
},
  variants: { lit: {}, multi: { multi: true }, snowy: { snow: true } },
  solid(p) { const W = clamp(num(p.h, 340), 150, 600) * 0.34; return solidLine(-W * 0.3, W * 0.3); },
  meta: {
    about: "A Christmas tree of dark tiers with tinsel, baubles, a star on top and a string of lights that come on by turns at night, in a wooden tub with presents.",
    params: {
      h: { type: "num", min: 150, max: 600, default: 340, about: "height, cm" },
      tiers: { type: "int", min: 3, max: 6, default: 5, about: "how many layers of branches" },
      color: { type: "color", about: "the branches' green" },
      baubles: { type: "num", min: 0, max: 1, default: 0.7, about: "how thickly it is hung with baubles" },
      lights: { type: "bool", default: true, about: "a string of lights that glow at night" },
      multi: { type: "bool", default: false, about: "coloured lights instead of warm white" },
      star: { type: "bool", default: true, about: "a star on top (it glows at night)" },
      snow: { type: "bool", default: false, about: "snow on the branches" },
      gifts: { type: "int", min: 0, max: 5, default: 3, about: "presents under the tree" },
    },
    terms: [], tags: ["festival", "christmas", "tree", "light"],
  } };

// ---- the maypole ---------------------------------------------------------------------------------

const RIBBONS = ["#C8283A", "#3B7DC4", "#F2C230", "#FFFFFF", "#2F8F5B", "#E8788C"];

/**
 * A maypole: a tall spiral-striped pole on a small mound, a green wreath with flowers at its crown, carved trade signs on a
 * crosspiece and, if asked, coloured dance ribbons hanging down beside it, swaying a little. `h` cm (520); `color` and `color2` its stripes.
 */
const maypole: PieceDef = { draw(p, r) {
  const h = clamp(num(p.h, 520), 300, 700), c1 = hex(p.color, "#3B7DC4"), c2 = hex(p.color2, WHITE), pw = 8, n = Math.round(clamp(num(p.ribbons, 0), 0, 12));
  const sh: Shape[] = [], front: Shape[] = [], pole = rect(-pw, -h, pw * 2, h);
  sh.push(S(ellipse(0, 0, 38, 11), "#7A9A4E"), F(ellipse(8, 2, 26, 6), tone("#7A9A4E", "shade"), 0.5), S(pole, c2));
  for (let y = 0; y < h + 60; y += 44) sh.push(F(poly([[-pw - 1, -y], [pw + 1, -y - 22], [pw + 1, -y - 44], [-pw - 1, -y - 22]]), c1, 1, pole));
  sh.push(...lit(pole, c2, 0.28), F(rect(-pw, -h * 0.04, pw * 2, 5), GOLD, 0.9, pole));
  // the crosspiece with carved trade signs
  const cy = -h * 0.82, bar = rect(-58, cy - 3.5, 116, 7);
  front.push(...O(bar, WOOD, 0.2));
  const signs: [number, (x: number, y: number) => Shape[]][] = [
    [-42, (x, y) => [S(ellipse(x, y, 7, 6.4).add(ellipse(x, y, 3, 2.6)), "#C98A35", { evenodd: true }), F(ellipse(x - 3, y - 3.4, 1.6, 1), "#F3DDA0", 0.8)]],
    [0, (x, y) => [S(heart(x, y + 7, 0.78), RED)]],
    [42, (x, y) => [S(star(x, y, 7.6), GOLD), S(ellipse(x, y, 2.6), "#FFF1C4")]],
  ];
  for (const [x, f] of signs) front.push(R([[x - 6, cy + 3], [x - 6, cy + 11]], CREAM, 0.5), R([[x + 6, cy + 3], [x + 6, cy + 11]], CREAM, 0.5), ...O(rrect(x - 16, cy + 10, 32, 28, 2), "#F2E2BC", 0.18), ...f(x, cy + 24));
  // the crown: a wreath of green with flowers, a finial
  const wy = -h - 4, wreath = ellipse(0, wy, 30, 27).add(ellipse(0, wy, 15, 12));
  sh.push(S(wreath, PINE, { evenodd: true }), ...lit(wreath, PINE, 0.2), dots(Array.from({ length: 10 }, (_, i) => [Math.cos(i * 0.628) * 18, wy + Math.sin(i * 0.628) * 16] as Vec2), 3, "#E8788C", 1, { flat: false }), dots(Array.from({ length: 10 }, (_, i) => [Math.cos(i * 0.628 + 0.3) * 18, wy + Math.sin(i * 0.628 + 0.3) * 16] as Vec2), 2, "#F2C230", 1, { flat: false }));
  sh.push(R([[0, wy - 22], [0, wy - 38]], WOOD, 3), ...O(poly([[0, wy - 56], [18, wy - 48], [0, wy - 40]]), RED, 0.2), S(ellipse(0, wy - 38, 4), GOLD));
  // the ribbons hang from the crown (a flat of their own that sways about the pole's top)
  const rib: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, ex = t * h * 0.04 + Math.sin(i * 1.7) * 3 + r.range(-1.5, 1.5), c = RIBBONS[i % RIBBONS.length], len = h * 0.97, pts: Vec2[] = [[t * 9, 6], [t * 12 + Math.sin(i * 2.3) * 5, len * 0.3], [ex * 0.8 - Math.sin(i * 1.3) * 4, len * 0.7], [ex, len]];
    rib.push(R(pts, tone(c, "shade"), 7.4, { flat: false }), R(pts, c, 6.2));
  }
  const ppcm = Math.min(2.4, 1900 / (h + 90)), tall = h + 70;
  return { flats: [
    { group: { shapes: sh, edge: 0.5 }, ppcm: Math.min(ppcm, 1900 / tall), id: "maypole" },
    ...(n ? [{ group: { shapes: rib, edge: 0.4 }, y: h, z: 5, ppcm: Math.min(2, 1900 / (h + 20)), move: { sway: { rot: 0.012, ms: 5400 }, phase: r() } } as FlatSpec] : []),
    { group: { shapes: front, edge: 0.5 }, ppcm: Math.min(ppcm, 1900 / tall), z: 6 },
  ] };
},
  variants: { bavarian: {}, red: { color: "#C8283A", color2: "#F3EBD8", ribbons: 6 }, green: { color: "#2F8F5B", color2: "#F3EBD8", ribbons: 6 } },
  solid() { return solidLine(-8, 8); },
  meta: {
    about: "A maypole: a spiral-striped pole on a mound, a flowered wreath at its crown, carved trade signs on a crosspiece, and (red, green) dance ribbons hanging beside it, swaying.",
    params: {
      h: { type: "num", min: 300, max: 700, default: 520, about: "height, cm" },
      color: { type: "color", about: "the stripe's colour; default blue" },
      color2: { type: "color", about: "the pole's ground colour; default white" },
      ribbons: { type: "int", min: 0, max: 12, default: 0, about: "dance ribbons hanging beside the pole from the crown (the Bavarian pole has none; the red and green variants have six)" },
    },
    terms: [], tags: ["festival", "spring", "folk"],
  } };

// ---- the carousel --------------------------------------------------------------------------------

const HORSES = ["#F3EBD8", "#8A5A3C", "#9AA0A8", "#3A3330", "#C9904A", "#D9B08C"];

/** A prancing carousel horse facing right, 110 cm tall from hoof to poll, its origin under its middle. */
function horse(c: string, saddle: string): Shape[] {
  const mane = tone(c, "deep"), body = smooth([[-44, -64], [-30, -76], [-8, -76], [8, -72], [20, -92], [28, -106], [34, -110, 0], [40, -105], [52, -100], [60, -86], [63, -79, 0], [56, -74], [46, -78], [36, -70], [31, -58], [30, -46], [14, -34], [-20, -34], [-40, -42], [-48, -54]], true, 1);
  return [
    R([[-44, -64], [-58, -54], [-62, -34], [-56, -18]], mane, 7, { flat: false }), R([[-44, -64], [-58, -54], [-62, -34], [-56, -18]], tone(mane, "light"), 2.4, { flat: true, opacity: 0.5 }),
    R([[-36, -48], [-42, -30], [-35, -15], [-40, -3]], tone(c, "shade"), 7), S(ellipse(-40, -2, 4, 2.4), GOLD),
    R([[24, -44], [36, -32], [50, -33]], tone(c, "shade"), 6.4), S(ellipse(52, -33, 3, 2.6), GOLD),
    S(body, c), ...lit(body, c, 0.18),
    R([[8, -74], [18, -92], [27, -106], [33, -108]], mane, 6.6, { flat: false }),
    R([[-34, -42], [-38, -26], [-30, -10], [-32, 0]], c, 7), S(ellipse(-32, 0, 4, 2.4), GOLD),
    R([[28, -48], [36, -34], [46, -22], [44, -10]], c, 6.4), S(ellipse(44, -9, 3, 2.4), GOLD),
    S(rrect(-22, -82, 30, 12, 4), saddle), F(rect(-22, -73, 30, 2), GOLD, 0.95), S(ellipse(-3, -85, 3), GOLD),
    R([[46, -98], [56, -84], [60, -80]], saddle, 1.4), R([[34, -102], [47, -97]], saddle, 1.2),
    S(ellipse(46, -92, 2.1), DARK), F(ellipse(45.4, -92.8, 0.7), "#FFFFFF", 0.8), S(ellipse(61, -80, 1.4), tone(c, "shade")),
  ];
}

/** The shapes mirrored left to right (strokes keep their width). */
const flip = (sh: Shape[], on: boolean): Shape[] => !on ? sh : sh.map(s => ({ ...s, path: s.path.transform([-1, 0, 0, 1, 0, 0]), ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform([-1, 0, 0, 1, 0, 0])) } : {}) }));

/**
 * A fairground carousel: a striped tent roof over a scalloped valance, a mirrored column, brass poles and `horses`
 * prancing up and down, on a painted platform. Bulbs under the roof and along the scallops light by turns at night (`lit`).
 * `w` cm across (420); `color` its roof stripes.
 */
const carousel: PieceDef = { draw(p, r) {
  const w = clamp(num(p.w, 420), 300, 600), a = w / 2, hn = Math.min(Math.round(clamp(num(p.horses, 4), 2, 6)), Math.floor(clamp(num(p.w, 420), 300, 600) / 90)), on = p.lit !== false, c1 = hex(p.color, "#C8283A"), c2 = hex(p.color2, CREAM);
  const eave = -w * 0.72, peak = eave - w * 0.2, sh: Shape[] = [], bulbs: Shape[] = [], glow: Shape[] = [];
  // the platform and its painted panels
  sh.push(...O(rect(-a, -22, w, 22), tone(c1, "deep"), 0.12), S(rect(-a - 4, -26, w + 8, 6), GOLD));
  const np = Math.round(w / 34); for (let i = 0; i < np; i++) { const x = -a + 4 + i * (w - 8) / np, pw = (w - 8) / np - 3; sh.push(F(rrect(x, -19, pw, 14, 2), i % 2 ? c2 : GOLD, 0.9), F(ellipse(x + pw / 2, -12, 2.6), i % 2 ? c1 : tone(c1, "deep"), 0.9)); }
  // the central column, mirrored
  const cw = w * 0.17, col = rect(-cw / 2, eave, cw, -eave - 26);
  sh.push(S(col, c2), ...lit(col, c2, 0.22));
  for (const f of [-0.7, 0, 0.7]) { const mw = cw * 0.26; sh.push(S(rect(f * cw * 0.34 - mw / 2, eave + 24, mw, -eave - 60), GLASS), F(poly([[f * cw * 0.34 - mw / 2, eave + 24], [f * cw * 0.34 - mw / 2 + mw * 0.5, eave + 24], [f * cw * 0.34 - mw / 2 + 2, eave + 80]]), WHITE, 0.4)); }
  sh.push(S(rect(-cw / 2 - 3, -50, cw + 6, 8), GOLD), S(rect(-cw / 2 - 3, eave + 18, cw + 6, 8), GOLD));
  // brass poles for the horses, stout posts at the sides
  const hx = Array.from({ length: hn }, (_, i) => (hn === 1 ? 0 : (i / (hn - 1)) * 2 - 1) * Math.min(a * 0.8, a - 62));
  for (const x of hx) sh.push(S(rect(x - 1.8, eave + 24, 3.6, -eave - 50), GOLD), F(rect(x - 1.8, eave + 24, 1.2, -eave - 50), "#FFF1C4", 0.6));
  for (const s of [-1, 1]) sh.push(...O(rect(s * (a - 6) - 4, eave + 24, 8, -eave - 50), c2, 0.3), lines(Array.from({ length: Math.floor(-eave / 14) }, (_, i) => [[s * (a - 6) - 4, eave + 30 + i * 14], [s * (a - 6) + 4, eave + 22 + i * 14]] as Vec2[]), GOLD, 1.4, 0.95));
  // the roof: striped wedges from the apex over a gold cornice, a valance of scallops beneath
  const hw = a + 16, wedges = 10, apex: Vec2 = [0, peak], edge = (i: number): Vec2 => [-hw + (2 * hw * i) / wedges, eave], roofP = poly([apex, [hw, eave], [-hw, eave]]);
  for (let i = 0; i < wedges; i++) sh.push(S(poly([apex, edge(i), edge(i + 1)]), i % 2 ? c2 : c1));
  sh.push(F(poly([[0, peak], [hw, eave], [hw * 0.2, eave]]), "#000000", 0.16, roofP), F(poly([[0, peak], [-hw, eave], [-hw * 0.7, eave]]), "#FFFFFF", 0.12, roofP));
  sh.push(...O(rect(-hw - 4, eave, 2 * hw + 8, 26), GOLD, 0.12), lines([[[-hw - 4, eave + 5], [hw + 4, eave + 5]], [[-hw - 4, eave + 21], [hw + 4, eave + 21]]], tone(GOLD, "deep"), 0.7, 0.8));
  const nv = Math.round((2 * hw) / 17); for (let i = 0; i <= nv; i++) { const x = -hw + (2 * hw * i) / nv; bulbs.push(S(ellipse(x, eave + 13, 3.4, 3.8), BULB)); glow.push(...halo(x, eave + 13, 8.4)); }
  const ns = Math.max(6, Math.round((2 * hw) / 36)), val = poly([[-hw, eave + 26], [hw, eave + 26], ...scallops(-hw, hw, eave + 26, ns, 15)]);
  sh.push(S(val, c2), ...Array.from({ length: Math.ceil(ns / 2) }, (_, j) => F(rect(-hw + 2 * j * ((2 * hw) / ns), eave + 25, (2 * hw) / ns, 22), c1, 1, val)), ...lit(val, c2, 0.1));
  for (let i = 0; i <= ns; i++) { const x = -hw + (2 * hw * i) / ns; if (i === 0 || i === ns) continue; bulbs.push(S(ellipse(x, eave + 26 + 12, 3.2, 3.6), BULB)); glow.push(...halo(x, eave + 38, 7.6)); }
  sh.push(R([[0, peak], [0, peak - 26]], GOLD, 2.6), S(ellipse(0, peak - 4, 8, 6), GOLD), S(ellipse(0, peak - 28, 4.4), GOLD), ...O(poly([[1, peak - 26], [26, peak - 20], [1, peak - 14]]), c1, 0.2));
  const ppcm = Math.min(2.4, 1900 / (w + 60), 1900 / (-peak + 50)), lights: LightSpec[] = on ? [{ x: -a * 0.4, y: -eave * 0.6, z: 60, color: "#FFC878", radius: 4, intensity: 0.7, switch: false, at: ["dawn", "dusk", "night"] }, { x: a * 0.4, y: -eave * 0.6, z: 60, color: "#FFC878", radius: 4, intensity: 0.7, switch: false, at: ["dawn", "dusk", "night"] }] : [];
  // the horses: each a flat of its own, rising and falling about its pole
  const flats: FlatSpec[] = [{ group: { shapes: [...sh, ...bulbs], edge: 0.6 }, ppcm, id: "carousel" }];
  hx.forEach((x, i) => flats.push({ group: { shapes: flip(horse(HORSES[(i * 2 + r.int(0, 1)) % HORSES.length], i % 2 ? c1 : "#3B7DC4"), i % 2 === 1), edge: 0.5 }, x: x + 8, y: 34 + (i % 2) * 22, z: 4 + (i % 2) * 0.5, ppcm: Math.min(3, 1900 / 130), move: { sway: { dy: 4.5, ms: 3800 }, phase: (i / hn + (i % 2) * 0.5) % 1 } }));
  if (on) flats.push(...litByTurns(glow, { ppcm, z: 0.5 }, 5, 0.1, 0.7));
  return { flats, lights };
},
  variants: { classic: {}, blue: { color: "#3B7DC4" }, green: { color: "#2F8F5B" } },
  solid(p) { const a = clamp(num(p.w, 420), 300, 600) / 2; return solidLine(-a, a); },
  meta: {
    about: "A fairground carousel: a striped tent roof over a scalloped valance, a mirrored column and brass poles with horses rising and falling, on a painted platform; bulbs light by turns at night.",
    params: {
      w: { type: "num", min: 300, max: 600, default: 420, about: "width across, cm" },
      horses: { type: "int", min: 2, max: 6, default: 4, about: "how many horses (at most one per 90 cm of width: 3 at the narrowest, 6 at the widest; alternate ones face the other way)" },
      color: { type: "color", about: "the roof's stripes; default red" },
      color2: { type: "color", about: "the roof's other stripes and the column; default cream" },
      lit: { type: "bool", default: true, about: "the bulbs under the roof glow at night" },
    },
    terms: [], tags: ["festival", "fair", "light"],
  } };

// ---- festival kit (props) ------------------------------------------------------------------------

interface B { sh: Shape[]; tx?: TextSpec[]; gl?: Shape[]; em?: [EmitSpec["kind"], number, number, number][] }
interface Cx { p: Prm; r: Rng; c: string; i: number; t: string; lang: string; lit: number }
/** One kind: its slot `w`, art resolution, default colour and words, how it is drawn and where it is held (`g`, in the art; else it sits on the hand). */
interface Kd { w: number; ppcm: number; c: string; t?: string; edge?: number; g?: Vec2; d(c: Cx): B }

const FEL: Record<string, Kd> = {
  advent_wreath: { w: 36, ppcm: 14, c: PINE, g: [0, -8], d: ({ c, lit: n }) => {
    const cx = 0, cy = -7, rx = 15, ry = 5.6, ring = ellipse(cx, cy, rx, ry).add(ellipse(cx, cy, rx - 5.6, ry - 2.4)), cand = (a: number) => ({ x: Math.cos(a) * (rx - 2.8), y: cy + Math.sin(a) * (ry - 1.2), a });
    const cs = [cand(-2.0), cand(-1.14), cand(0.62), cand(2.52)].map((q, i) => ({ ...q, i })).sort((u, v) => u.y - v.y);
    const sh: Shape[] = [], gl: Shape[] = [], em: B["em"] = [];
    const candle = (q: { x: number; y: number; i: number }) => { const h = 10, on = q.i < n; sh.push(...O(rect(q.x - 1.1, q.y - h, 2.2, h), q.i === 2 ? "#E8788C" : RED, 0.3), R([[q.x, q.y - h], [q.x, q.y - h - 1.2]], DARK, 0.3)); if (on) { sh.push(S(ellipse(q.x, q.y - h - 2.4, 0.8, 1.4), "#F6A23A")); gl.push(...halo(q.x, q.y - h - 2.4, 4.4)); em.push(["flame", q.x, q.y - h - 1, 1.2]); } };
    cs.filter(q => q.y < cy).forEach(candle);
    sh.push(S(ring, c, { evenodd: true }), ...lit(ring, c, 0.2), dots(Array.from({ length: 16 }, (_, i) => [Math.cos(i * 0.4 + 0.2) * (rx - 2.8), cy + Math.sin(i * 0.4 + 0.2) * (ry - 1.2)] as Vec2), 0.9, tone(c, "deep"), 0.7), dots([[-9, cy + 3.6], [6, cy + 4.6], [11, cy + 1.6]], 0.8, RED, 1, { flat: false }));
    cs.filter(q => q.y >= cy).forEach(candle);
    sh.push(S(poly([[-0.6, cy + ry - 1], [-5, cy + ry + 2.6], [-3, cy + ry - 2.4]]), RED), S(poly([[0.6, cy + ry - 1], [5, cy + ry + 2.6], [3, cy + ry - 2.4]]), RED), S(ellipse(0, cy + ry - 1, 1.5), tone(RED, "deep")));
    return { sh, gl, em }; } },
  gingerbread_heart: { w: 22, ppcm: 16, c: "#9A5B2C", t: "Für dich", g: [0, -22], d: ({ c, t, lang }) => {
    const h = heart(0, 0, 1), inner = [[0, 0], [-8.4, -6.4], [-9.6, -11.8], [-6.8, -16], [-2.9, -15.2], [0, -12.4], [2.9, -15.2], [6.8, -16], [9.6, -11.8], [8.4, -6.4]].map(([x, y]) => [x * 0.84, -8 + (y + 8) * 0.84] as Vec2);
    return { sh: [R([[-4, -14.4], [-1.4, -22], [1.4, -22], [4, -14.4]], RED, 1.1), ...O(h, c, 0.2), dots(inner.flatMap((q, i) => [q, [(q[0] + inner[(i + 1) % inner.length][0]) / 2, (q[1] + inner[(i + 1) % inner.length][1]) / 2] as Vec2]), 0.55, WHITE, 0.95), F(star(-6.4, -11.8, 1.2), WHITE, 0.9), F(star(6.4, -11.8, 1.2), WHITE, 0.9)], tx: tx(t, -6.2, -12.4, 12.4, 6, { color: WHITE, weight: 800, font: "hand", lang }) }; } },
  easter_eggs: { w: 26, ppcm: 14, c: "#C9A06A", g: [0, -22], d: ({ c }) => {
    const egg = (x: number, y: number, k: number, col: string): Shape[] => { const o = ellipse(x, y, 3.4, 4.4); return [S(o, col), F(ellipse(x + 1.2, y + 1.4, 2.8, 3.2), tone(col, "shade"), 0.4, o), ...[0, 1, 2].map(j => k === 0 ? F(rect(x - 4, y - 2.4 + j * 2.4, 8, 1), j % 2 ? WHITE : tone(col, "deep"), 0.8, o) : k === 1 ? dots([[x - 1.6, y - 1.6 + j], [x + 1.4, y + 0.4 - j * 0.6]], 0.7, WHITE, 0.9, { clip: o }) : lines([[[x - 3.4, y - 2 + j * 2], [x - 1.6, y - 3 + j * 2], [x, y - 2 + j * 2], [x + 1.6, y - 3 + j * 2], [x + 3.4, y - 2 + j * 2]]], WHITE, 0.5, 0.9, o)).slice(0, k === 1 ? 1 : 3), F(ellipse(x - 1.2, y - 1.8, 0.8, 1.4), "#FFFFFF", 0.55)]; };
    const grass = lines(Array.from({ length: 9 }, (_, i) => [[-9 + i * 2.3, -9], [-10 + i * 2.5 + (i % 2 ? 2 : -2), -14.6]] as Vec2[]), "#5DA14E", 1.1, 1), body = rrect(-11, -11, 22, 11, [1.4, 1.4, 4.6, 4.6]);
    return { sh: [R([[-10, -9], [-9, -23], [9, -23], [10, -9]], tone(c, "shade"), 1.6), grass, ...egg(-5.8, -12.8, 0, "#E8788C"), ...egg(0.4, -13.8, 1, "#7FC4E8"), ...egg(6.2, -12.6, 2, "#F2C230"), ...O(body, c, 0.2), lines([[[-11, -7.2], [11, -7.2]], [[-11, -3.6], [11, -3.6]]], tone(c, "deep"), 0.6, 0.7, body), lines(Array.from({ length: 6 }, (_, i) => [[-8.4 + i * 3.4, -11], [-8.4 + i * 3.4, 0]] as Vec2[]), tone(c, "deep"), 0.5, 0.5, body), S(rect(-11.6, -11.6, 23.2, 1.8), tone(c, "light"))] }; } },
  venetian_mask: { w: 24, ppcm: 16, c: "#F6F1E6", g: [0, -8], d: ({ c }) => {
    const m = smooth([[-11, -52], [-9, -57], [-4, -58.4], [0, -57], [4, -58.4], [9, -57], [11, -52], [9.4, -46.6], [5, -44.6], [2, -48], [0, -50.4, 0], [-2, -48], [-5, -44.6], [-9.4, -46.6]], true, 1), eye = (x: number) => ellipse(x, -52.4, 3.2, 1.9);
    const mask = new Path().add(m).add(eye(-5.4)).add(eye(5.4));
    return { sh: [R([[0, 0], [0, -45]], WOOD, 1.2), R([[7, -57], [13, -66], [17, -72]], "#3B7DC4", 1.8), R([[8, -57], [16, -63], [22, -66]], GOLD, 1.6), R([[6, -57], [10, -68], [12, -75]], "#C8283A", 1.4), S(mask, c, { evenodd: true }), ...lit(m, c, 0.2), F(rect(-11, -58.6, 22, 3.4), "#3B7DC4", 0.9, m), { path: m, stroke: { color: GOLD, width: 1.2 }, flat: true, opacity: 0.95 }, lines([[[-9.6, -49.8], [-8, -46.8], [-6, -46.6]], [[9.6, -49.8], [8, -46.8], [6, -46.6]]], GOLD, 0.8, 0.95), dots([[-9, -55], [0, -55.6], [9, -55]], 0.8, GOLD, 1)] }; } },
  carnival_mask: { w: 28, ppcm: 16, c: "#6A3C9E", g: [0, -3], d: ({ c }) => {
    const m = smooth([[-13, -9], [-10.6, -12.4], [-4, -12.4], [0, -10.6], [4, -12.4], [10.6, -12.4], [13, -9], [8, -3.6], [4, -4.6], [0, -5.6], [-4, -4.6], [-8, -3.6]], true, 1), mask = new Path().add(m).add(ellipse(-5.6, -8, 2.9, 1.9)).add(ellipse(5.6, -8, 2.9, 1.9));
    return { sh: [R([[-12, -10], [-18, -13], [-20, -17]], "#2F8F5B", 2.2), R([[12, -10], [18, -13], [20, -17]], "#2F8F5B", 2.2), R([[11, -11], [16, -18], [15, -24]], "#F2C230", 2), R([[-11, -11], [-16, -18], [-15, -24]], "#F2C230", 2), R([[9, -11.4], [10, -19], [7, -26]], "#E8788C", 1.8), S(mask, c, { evenodd: true }), ...lit(m, c, 0.2), F(ellipse(-9.4, -6.8, 1.9, 1.3), GOLD, 0.95), F(ellipse(9.4, -6.8, 1.9, 1.3), GOLD, 0.95), { path: m, stroke: { color: GOLD, width: 0.9 }, flat: true, opacity: 0.95 }, F(star(0, -9.6, 1.5), GOLD, 1), dots([[-3, -11], [3, -11], [-11, -9], [11, -9], [-1, -6], [1.6, -6.2]], 0.55, "#FFF1C4", 0.95)] }; } },
  flower_crown: { w: 26, ppcm: 16, c: "#5DA14E", g: [0, -3], d: ({ c }) => {
    // a closed ring seen a little from above: leaves all round, the flowers along its front, two ribbons tied at the back
    const cy = -8, rx = 11, ry = 5, at = (t: number): Vec2 => [Math.cos(t) * rx, cy + Math.sin(t) * ry];
    const flower = (x: number, y: number, pc: string, k: number): Shape[] => [dots(Array.from({ length: 5 }, (_, i) => [x + Math.cos(i * 1.2566) * 1.7 * k, y + Math.sin(i * 1.2566) * 1.7 * k] as Vec2), 1.35 * k, pc, 1, { flat: false }), S(ellipse(x, y, 0.95 * k), "#F2C230")];
    const leaf = (t: number): Shape => { const [x, y] = at(t); return S(ellipse(x, y, 2.3, 1.1), tone(c, Math.sin(t) < 0 ? "deep" : "base")); };
    const nL = 14, back = Array.from({ length: nL }, (_, i) => (i + 0.5) / nL * 2 * Math.PI).filter(t => Math.sin(t) < 0), frontL = Array.from({ length: nL }, (_, i) => (i + 0.5) / nL * 2 * Math.PI).filter(t => Math.sin(t) >= 0);
    const sh: Shape[] = [...back.map(leaf),
      R([[3, cy - ry + 0.6], [9, cy - 1], [12.4, cy + 3], [11.6, cy + 8]], "#E8788C", 1.5), R([[4, cy - ry + 0.6], [11, cy - 2], [14.6, cy + 1], [15.4, cy + 5]], "#7FC4E8", 1.4),
      { path: ellipse(0, cy, rx, ry), stroke: { color: tone(c, "deep"), width: 1.8 }, flat: false }, ...frontL.map(leaf)];
    const cols = ["#E8788C", "#FFFFFF", "#F2B632", "#B65CA8", "#7FC4E8", "#FFFFFF", "#E8788C"];
    cols.forEach((pc, i) => { const t = Math.PI * (0.1 + 0.8 * i / (cols.length - 1)), [x, y] = at(t); sh.push(...flower(x, y - 0.4, pc, 0.8 + (i % 2) * 0.12)); });
    sh.push(S(ellipse(0, cy - ry, 1.4, 1), "#E8788C"));
    return { sh }; } },
  st_martin_lantern: { w: 24, ppcm: 12, c: "#D9532E", g: [0, -20], d: ({ c }) => {
    const cy = -54, body = ellipse(0, cy, 9, 9.6), cut = star(-2.4, cy - 2, 3.4), moon = poly(arcPoints(3.4, cy + 3.6, 3, 3, -1.6, 2.6, 8).concat(arcPoints(4.6, cy + 3.2, 2.4, 2.4, 2.4, -1.6, 8)));
    const win = [F(cut, "#FFE08A", 1), F(moon, "#FFE08A", 1), F(ellipse(-4.8, cy + 4.6, 1.1), "#FFE08A", 1), F(ellipse(5.4, cy - 3, 1), "#FFE08A", 1)];
    return { sh: [R([[0, 0], [0, -64], [6, -69], [10, -64]], WOOD, 1.2), R([[-3, -62], [0, -66], [3, -62]], DARK, 0.4), ...O(body, c, 0.24), lines([-6, -3, 0, 3, 6].map(x => [[x * 0.4, cy - 9.6], [x, cy], [x * 0.4, cy + 9.6]] as Vec2[]), tone(c, "deep"), 0.5, 0.7, body), ...win, S(rrect(-3.6, cy - 12.2, 7.2, 3, 0.8), DARK), S(rrect(-3.2, cy + 9, 6.4, 2.2, 0.8), DARK)],
      gl: [...halo(0, cy, 17, "#FFC66B", 0.22), F(cut, "#FFF1C4", 1), F(moon, "#FFF1C4", 1), F(ellipse(-4.8, cy + 4.6, 1.2), "#FFF1C4", 1), F(ellipse(5.4, cy - 3, 1.1), "#FFF1C4", 1)] }; } },
  paper_crown: { w: 22, ppcm: 16, c: GOLD, g: [0, -3], d: ({ c }) => {
    const o = poly([[-9.6, 0], [-9.6, -9], [-10.4, -17.4], [-5, -11.4], [0, -19.4], [5, -11.4], [10.4, -17.4], [9.6, -9], [9.6, 0]]);
    return { sh: [...O(o, c, 0.22), F(rect(-9.6, -6.4, 19.2, 1), tone(c, "deep"), 0.7, o), dots(Array.from({ length: 6 }, (_, i) => [-7.4 + i * 3, -3.2] as Vec2), 0.8, tone(c, "deep"), 0.8), S(ellipse(-10.4, -17.4, 1.4), RED), S(ellipse(0, -19.4, 1.5), "#3B7DC4"), S(ellipse(10.4, -17.4, 1.4), RED), S(ellipse(0, -10.4, 1.7), "#2F8F5B"), S(ellipse(-5.6, -9, 1), RED), S(ellipse(5.6, -9, 1), RED)] }; } },
  nutcracker: { w: 18, ppcm: 14, c: RED, g: [0, -14], d: ({ c }) => {
    const coat = smooth([[-6.4, -13], [-6.8, -24], [-5, -29], [5, -29], [6.8, -24], [6.4, -13]], true, 1), hat = rrect(-4.6, -49, 9.2, 15, [1.6, 1.6, 0.4, 0.4]), face = ellipse(0, -32.6, 4.2, 4.4);
    return { sh: [S(rect(-7.4, -1.4, 14.8, 1.4), "#7A4A2E"), ...O(rrect(-5.2, -14, 4.6, 12.6, 0.8), WHITE, 0.2), ...O(rrect(0.6, -14, 4.6, 12.6, 0.8), WHITE, 0.2), S(rrect(-5.8, -4.4, 5.4, 3.4, 1), DARK), S(rrect(0.4, -4.4, 5.4, 3.4, 1), DARK),
      ...O(rrect(-10.6, -27.6, 4.2, 13, 1.4), c, 0.3), ...O(rrect(6.4, -27.6, 4.2, 13, 1.4), c, 0.3), S(ellipse(-8.5, -14.4, 2.1), WHITE), S(ellipse(8.5, -14.4, 2.1), WHITE),
      ...O(coat, c, 0.24), S(rect(-6.6, -17, 13.2, 2.8), DARK), S(rect(-1.4, -17.2, 2.8, 3.2), GOLD), S(ellipse(-3.6, -21.4, 0.8), GOLD), S(ellipse(3.6, -21.4, 0.8), GOLD), S(ellipse(0, -21.4, 0.8), GOLD), S(ellipse(0, -25.4, 0.8), GOLD), F(poly([[-6.4, -28.4], [-2, -26], [-6.8, -23.4]]), GOLD, 0.95), F(poly([[6.4, -28.4], [2, -26], [6.8, -23.4]]), GOLD, 0.95),
      S(face, "#EBC9A2"), S(ellipse(0, -28.6, 4.8, 3.2), WHITE), F(ellipse(0, -35.2, 3, 1.4), "#FFFFFF", 0.0), S(rect(-4.6, -34.6, 9.2, 1.6), WHITE), ...O(hat, "#2E2F35", 0.3), S(rect(-4.8, -37.4, 9.6, 2.2), GOLD), S(ellipse(0, -49, 4.6, 1.2), tone(DARK, "light")), F(poly([[-1.4, -45.6], [1.4, -45.6], [0, -42], [0, -42]]), GOLD, 0.0), S(star(0, -43.6, 2.2), GOLD), S(rect(-0.6, -53.4, 1.2, 4.6), RED), S(ellipse(0, -54, 1.6, 1.2), WHITE)] }; } },
  bauble: { w: 10, ppcm: 16, c: "#C8283A", g: [0, -11.6], d: ({ c }) => {
    const o = ellipse(0, -4.4, 4.3);
    return { sh: [R([[0, -11.4], [0, -9.6]], GOLD, 0.6), { path: ellipse(0, -11.4, 1, 1.2), stroke: { color: GOLD, width: 0.4 } }, S(rrect(-1.3, -9.8, 2.6, 2, 0.4), GOLD), S(o, c), F(ellipse(1.2, -3, 3.2), tone(c, "shade"), 0.4, o), F(rect(-4.4, -5.4, 8.8, 2), GOLD, 0.9, o), lines([[[-4, -2.6], [-2, -1.2], [0, -2.6], [2, -1.2], [4, -2.6]]], WHITE, 0.4, 0.9, o), F(ellipse(-1.8, -6.4, 1.2, 0.8), "#FFFFFF", 0.8)] }; } },
};

const KINDS = Object.keys(FEL);

/** Festival kit: an Advent wreath (its candles lit by `lit`), a gingerbread heart with words, Easter eggs in a basket, a Venetian mask, a carnival mask, a flower crown, a St Martin's lantern, a paper crown, a nutcracker or a bauble. */
const festivalKit: PieceDef = {
  draw(p, r) {
    const k = FEL[str(p.kind, str(p.variant, KINDS[0]))] ?? FEL[KINDS[0]], held = !!p.held, nmax = 12, n = held ? 1 : Math.max(1, Math.min(nmax, Math.round(num(p.n, 1))));
    const cx = { p, r, c: hex(p.color, k.c), t: str(p.label, k.t ?? ""), lang: str(p.lang, "de"), lit: Math.max(0, Math.min(4, Math.round(num(p.lit, 2)))) };
    const a0: Affine = held ? (k.g ? translate(-k.g[0], -k.g[1]) : translate(0, -7.5)) : [1, 0, 0, 1, 0, 0];
    const sh: Shape[] = [], txt: TextSpec[] = [], gl: Shape[] = [], em: EmitSpec[] = [];
    for (let i = 0; i < n; i++) {
      const b = k.d({ ...cx, i }), a = mul(a0, translate((i - (n - 1) / 2) * (k.w + 4), 0));
      sh.push(...mv(b.sh, a)); gl.push(...mv(b.gl ?? [], a));
      for (const t of b.tx ?? []) txt.push({ ...t, x: t.x + a[4], y: t.y + a[5] });
      if (!held) for (const [kind, x, y, w] of b.em ?? []) em.push({ kind, x: x + a[4], y: -(y + a[5]), w });
    }
    const edge = k.edge ?? 0.4, [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge });
    return { flats: [{ group: { shapes: sh, edge }, ppcm: Math.min(k.ppcm, 16, 1900 / Math.max(1, x1 - x0, y1 - y0)), ...(held ? {} : { shadow: "drop" as const }), ...(txt.length ? { text: txt } : {}), ...(gl.length ? { emissive: { shapes: gl, edge: 0 } } : {}) }], ...(em.length ? { emitters: em } : {}) };
  },
  variants: Object.fromEntries(KINDS.map(v => [v, { kind: v }])),
  meta: {
    about: "Festival kit: an Advent wreath with its candles, a gingerbread heart with words, an Easter basket of eggs, a Venetian mask on a stick, a feathered carnival mask, a flower crown, a St Martin's lantern with a glowing cut-out, a paper crown, a (faceless) nutcracker or a bauble. No drink.",
    terms: [], tags: ["festival", "christmas", "easter", "carnival"],
    params: {
      kind: { type: "enum", values: KINDS, default: KINDS[0] },
      n: { type: "int", min: 1, max: 12, default: 1, about: "how many, side by side" },
      color: { type: "color", about: "the main colour (a palette id or a hex); each kind has its own default" },
      label: { type: "text", about: "the words on the gingerbread heart (default Für dich)" },
      lang: { type: "text", default: "de", about: "the language of the words on it (a BCP-47 tag)" },
      lit: { type: "int", min: 0, max: 4, default: 2, about: "the Advent wreath: how many of its four candles are lit" },
    } satisfies Record<string, ParamSpec>,
  },
};

/** Shapes moved by a uniform affine. */
function mv(sh: Shape[], m: Affine): Shape[] { const k = m[0]; return sh.map(s => ({
  ...s, path: s.path.transform(m),
  ...(s.stroke && k !== 1 ? { stroke: { ...s.stroke, width: s.stroke.width * k } } : {}),
  ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}),
})); }

export const set: Record<string, PieceDef> = { market_hut: marketHut, christmas_tree: christmasTree, maypole, carousel };
export const props: Record<string, PieceDef> = { festival_kit: festivalKit };
