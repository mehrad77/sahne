// Props of the misc family, following STYLE.md: the things the stories carry, give,
// count and show (bags, boxes, cloth, yarn, flowers, machines, keys, toys…). Units cm; each flat's origin
// is its bottom centre. Held (`held`), a prop is drawn as people carry it, its origin at the grip: a
// hanging hand grips about GRIP cm above the floor, so a thing that rolls or leans on the floor (a
// suitcase, a trolley, a closed umbrella) tilts until it reaches it. Words (a till's total, tags, a
// bucket's colour) are `text` on the first flat, never letters in the art.

import { smooth, ellipse, rect, rrect, poly, tone, mix, mul, rotate, translate, groupBounds, type Affine, type Kit, type PieceDef, type PieceOut, type FlatSpec, type Shape, type Path, type TextSpec, type Tile, type Vec2, type Rng } from "sahne";
import { S, P, L, num, str, type Pt } from "./draw.ts";

/** How high a hanging hand grips above the floor, less the stage's drop to the held art (an adult's, cm). */
const GRIP = 46;
const DARK = "#2E2F35", STEEL = "#B8BEC4", BRASS = "#D9A72E", CREAM = "#F3EBD8", KRAFT = "#C79A63", LEAF = "#4E7A48";
const BAGS = ["#C4553A", "#2E3A59", "#E0A83A", "#2F8C88", "#7A3E6E", "#6F7A45", "#B98A57", "#4F6E9E", "#9A2D62"];
const LEATHER = ["#6B4A35", "#8A5A3C", "#B98A57", "#2E3A59", "#3A3D45", "#6F7A45", "#7A3E6E", "#A23F28"];
const BRIGHT = ["#D9534A", "#2F8C88", "#E0A83A", "#7A3E6E", "#E58FA0", "#1F5FC0", "#2E5237", "#F0745F"];
const WOOL = ["#A78BA8", "#E8892E", "#D9534A", "#2F8C88", "#E0A83A", "#4F6E9E", "#F0E2C8", "#7A3E6E", "#9CD3C0", "#6F7A45"];
/** Colours a story names in Turkish (a bucket's label says the colour of its flowers). */
const TR: Record<string, string> = { kırmızı: "#C8283A", pembe: "#E8799A", beyaz: "#F6F1E4", sarı: "#F2C230", turuncu: "#EE8A2E", mor: "#7B4FB3", mavi: "#3F74C4", yeşil: "#3E8E4E", siyah: "#232326", bordo: "#7A1F35" };

// ---- helpers (no params read here: SET.md lists the `p.` each generator reads) ---------------------

/** A colour param: a Turkish colour name, a palette id or a hex; else `d`. */
const col = (kit: Kit, v: unknown, d: string) => typeof v === "string" ? TR[v] ?? kit.color(v, d) : d;
/** A count param, 1…24. */
const cnt = (v: unknown, d: number) => Math.max(1, Math.min(24, Math.round(num(v, d))));
/** Shapes moved by an affine (their clips too). */
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a strap, a string, a stem, a rod. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** A printed tile over an outline (a weave, a tartan, dots). */
const tiled = (path: Path, tile: Tile, op = 1): Shape => ({ path, tile, flat: true, opacity: op });
/** Light from the upper left on an outline spanning x0…x1, y0…y1: shade down the right, a sheen down the left. */
const lit = (o: Path, c: string, x0: number, x1: number, y0: number, y1: number, k = 0.2): Shape[] =>
  [F(rect(x1 - (x1 - x0) * k, y0 - 1, (x1 - x0) * k + 1, y1 - y0 + 2), tone(c, "shade"), 0.5, o), F(rect(x0 - 1, y0 - 1, (x1 - x0) * 0.08 + 1, y1 - y0 + 2), tone(c, "light"), 0.4, o)];
/** `n` things `w` wide side by side, `gap` apart, centred; `f(x, i)` draws each. */
const row = (n: number, w: number, gap: number, f: (x: number, i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => f(-(n * w + (n - 1) * gap) / 2 + w / 2 + i * (w + gap), i)).flat();
/** A prop of one flat (`id`), its ppcm kept inside an atlas layer; a drop shadow unless held. */
function one(id: string, shapes: Shape[], ppcm: number, held: boolean, o: Partial<FlatSpec> = {}, edge = 0.45): PieceOut {
  const [x0, y0, x1, y1] = groupBounds({ shapes, edge });
  return { flats: [{ group: { shapes, edge }, ppcm: Math.min(ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(held ? {} : { shadow: "drop" as const }), ...o }] };
}
/** Turn shapes about the grip `g` until the point `f` (where they meet the floor, or a wheel's hub) lies `drop` (GRIP) below it, out to the side `dir`; the grip becomes the origin. */
function tilt(sh: Shape[], g: Vec2, f: Vec2, dir: number, drop = GRIP): Shape[] {
  const dx = f[0] - g[0], dy = f[1] - g[1], d = Math.hypot(dx, dy), y = Math.min(drop, d);
  return T(sh, mul(rotate(Math.atan2(y, dir * Math.sqrt(d * d - y * y)) - Math.atan2(dy, dx)), translate(-g[0], -g[1])));
}
/** `n` things hanging from one hand (each drawn hanging from the origin), fanned a little so they stay countable. */
const fan = (n: number, f: (i: number) => Shape[]): Shape[] => Array.from({ length: n }, (_, i) => T(f(i), rotate((i - (n - 1) / 2) * Math.min(0.3, 0.9 / n)))).flat();
/** A fringe: short strands hanging from a hem at y from x0 to x1. */
const fringe = (x0: number, x1: number, y: number, len: number, c: string): Shape[] => { const m = Math.max(2, Math.round((x1 - x0) / 1.6)); return Array.from({ length: m }, (_, i) => R([[x0 + (x1 - x0) * i / (m - 1), y - 0.3], [x0 + (x1 - x0) * i / (m - 1) + 0.3, y + len]], c, 0.55)); };
/** Knitted stitches: rows of small V's, printed. */
const knit = (o: Path, c: string, s = 1.6): Shape => tiled(o, { w: s, h: s * 0.8, shapes: [{ path: poly([[0.15 * s, 0.1 * s], [0.5 * s, 0.65 * s], [0.85 * s, 0.1 * s]], false), stroke: { color: tone(c, "deep"), width: 0.09 * s } }] }, 0.35);

/** Cloth folded over a forearm, hanging `h` from the grip at the origin, `w` wide at its hem: the back fold longer, soft folds, a wavy hem; `deco(o)` prints on the front fold. */
function drape(w: number, h: number, c: string, deco: (o: Path) => Shape[] = () => []): Shape[] {
  const back = smooth([[-w * 0.36, 0], [0, -3], [w * 0.36, 0], [w * 0.5, h * 0.92], [w * 0.28, h + 1, 0], [-w * 0.12, h - 1], [-w * 0.48, h * 0.96, 0]], true, 1);
  const front = smooth([[-w * 0.38, 0.6], [0, -2.4], [w * 0.38, 0.6], [w * 0.47, h * 0.62, 0], [w * 0.22, h * 0.7], [-w * 0.12, h * 0.66], [-w * 0.45, h * 0.74, 0]], true, 1);
  return [S(back, tone(c, "shade")), S(front, c), ...deco(front), ...lit(front, c, -w / 2, w / 2, -3, h, 0.16), L([[-w * 0.12, 1], [-w * 0.2, h * 0.64]], tone(c, "shade"), 0.7, 0.5), L([[w * 0.14, 1], [w * 0.2, h * 0.66]], tone(c, "shade"), 0.7, 0.45), L([[w * 0.05, h * 0.7], [w * 0.1, h * 0.98]], tone(c, "deep"), 0.6, 0.4)];
}

// ---- bags ----------------------------------------------------------------------------------------------

/** A hard-shell suitcase w × h seen from the front, standing at (x, 0) on spinner wheels: ribs, corner guards, the carry handle and the telescopic handle's bar. */
function caseFront(x: number, w: number, h: number, c: string, tag: boolean): Shape[] {
  const top = -h, x0 = x - w / 2, o = rrect(x0, top, w, h - 4, 5), sh: Shape[] = [R([[x - 6, top + 1], [x - 5, top - 4], [x + 5, top - 4], [x + 6, top + 1]], DARK, 1.7), S(rrect(x - w * 0.3, top - 1.8, w * 0.6, 2.6, 1.2), DARK)];
  for (const d of [-1, 1]) sh.push(S(rrect(x + d * (w / 2 - 7) - 2.6, -6, 5.2, 3, 1), DARK), S(ellipse(x + d * (w / 2 - 7), -2.5, 2.5), "#3B3B40"), F(ellipse(x + d * (w / 2 - 7) - 0.6, -3.1, 0.8), "#8E959C"));
  sh.push(S(o, c), ...lit(o, c, x0, x0 + w, top, -4));
  for (const k of [-0.24, 0, 0.24]) sh.push(L([[x + k * w - 0.9, top + 7], [x + k * w - 0.9, -11]], tone(c, "light"), 1, 0.55), L([[x + k * w + 0.5, top + 7], [x + k * w + 0.5, -11]], tone(c, "shade"), 1.1, 0.6));
  for (const [gx, gy] of [[x0 - 0.4, top - 0.4], [x0 + w - 5.6, top - 0.4], [x0 - 0.4, -10.6], [x0 + w - 5.6, -10.6]]) sh.push(S(rrect(gx, gy, 6, 6, 2), DARK));
  if (tag) sh.push(R([[x + 4, top - 3], [x + 7, top + 3]], "#8E959C", 0.3), S(rrect(x + 5.5, top + 2.5, 5, 8, 1), CREAM), F(ellipse(x + 8, top + 4.2, 0.6), DARK, 0.7));
  return sh;
}

/** A suitcase lying on its back on top of others (at (x, y)), w long and d deep: its side with the handle, a zip and the wheels at one end. */
const caseFlat = (x: number, y: number, w: number, d: number, c: string): Shape[] => {
  const o = rrect(x - w / 2, y - d, w, d, 4);
  return [S(o, c), ...lit(o, c, x - w / 2, x + w / 2, y - d, y), L([[x - w / 2 + 2, y - d / 2], [x + w / 2 - 2, y - d / 2]], tone(c, "deep"), 0.9, 0.6), S(rrect(x - 7, y - d + 3, 14, 3, 1.5), DARK), S(ellipse(x + w / 2 - 3, y - 4, 2.4), DARK), S(ellipse(x + w / 2 - 3, y - d + 4, 2.4), DARK)];
};

/** A suitcase seen side on (d deep, h tall, back to the right), its handle pulled up `ext` cm: for pulling along. */
function caseSide(d: number, h: number, c: string, ext: number): Shape[] {
  const o = rrect(-d / 2, -h, d, h - 4, 4), hx = d / 2 - 3;
  return [
    R([[hx, -h + 2], [hx, -h - ext]], "#8E959C", 1.8), S(rrect(hx - 2.2, -h - ext - 2.5, 4.4, 3.2, 1.5), DARK),
    S(ellipse(hx, -3.2, 3.2), "#3B3B40"), F(ellipse(hx - 0.7, -3.8, 1.1), "#8E959C"), S(rrect(-d / 2 + 2, -5, 4, 5, 1), DARK),
    S(o, c), ...lit(o, c, -d / 2, d / 2, -h, -4, 0.25), L([[0, -h + 1], [0, -5]], tone(c, "deep"), 0.9, 0.6),
    S(rrect(-5, -h * 0.55, 10, 2.6, 1.3), DARK), S(rrect(-4, -h - 2.4, 8, 2.8, 1.2), DARK),
    S(rrect(-d / 2 - 0.4, -h - 0.4, 5, 5, 2), DARK), S(rrect(d / 2 - 4.6, -h - 0.4, 5, 5, 2), DARK),
  ];
}

/** A leather shoulder bag at (x, 0): flap, buckle, stitching; its strap looped up, or (`hang`) rising to the grip 40 cm above its foot. */
function shoulderBag(x: number, c: string, hang: boolean): Shape[] {
  const body = tone(c, "shade"), o = smooth([[x - 16, -24, 0], [x + 16, -24, 0], [x + 17, -4], [x + 13, 0, 0], [x - 13, 0, 0], [x - 17, -4]], true, 1);
  const flap = smooth([[x - 16.6, -24.6, 0], [x + 16.6, -24.6, 0], [x + 16.2, -12], [x + 3, -8.6], [x - 3, -8.6], [x - 16.2, -12]], true, 1);
  const strap: Vec2[] = hang ? [[x - 15, -23], [x - 6, -36], [x, -40], [x + 6, -36], [x + 15, -23]] : [[x - 15, -23], [x - 13, -38], [x, -44], [x + 13, -38], [x + 15, -23]];
  return [
    R(strap, tone(c, "deep"), 2.6), S(o, body), ...lit(o, body, x - 17, x + 17, -24, 0),
    F(rect(x - 17, -10, 34, 2), tone(c, "deep"), 0.3, o), S(flap, c), ...lit(flap, c, x - 17, x + 17, -25, -8),
    { path: smooth([[x - 14.6, -23], [x - 14.4, -12.6], [x - 3, -10], [x + 3, -10], [x + 14.4, -12.6], [x + 14.6, -23]], false, 1), stroke: { color: tone(c, "light"), width: 0.3, dash: [1, 0.8] }, flat: true, opacity: 0.8 },
    S(rrect(x - 2.6, -12, 5.2, 4.2, 1), BRASS), F(rrect(x - 1.5, -11, 3, 2.2, 0.6), tone(BRASS, "deep"), 0.7),
    ...[-1, 1].map(d => S(ellipse(x + d * 15, -23, 1.2), BRASS)),
  ];
}

/** A gift bag at (x, 0), w × h in `c`: tissue paper in `t` out of the top, rope handles (up to the grip when `hang`), dots or stripes. */
function giftBag(x: number, w: number, h: number, c: string, t: string, dots: boolean, hang: boolean): Shape[] {
  const o = rect(x - w / 2, -h, w, h), top = hang ? -h - 9 : -h - 8, hd = tone(c, "deep");
  return [
    R([[x - 5, -h + 2], [x - 4, top + 1], [x + 4, top + 1], [x + 5, -h + 2]], tone(hd, "shade"), 0.8),
    P([[x - w * 0.36, -h + 2, 0], [x - w * 0.33, -h - 9, 0], [x - w * 0.12, -h - 4], [x + w * 0.04, -h - 12, 0], [x + w * 0.18, -h - 4.5], [x + w * 0.37, -h - 10, 0], [x + w * 0.4, -h + 2, 0]], t, { opacity: 0.96 }),
    L([[x + w * 0.04, -h - 11], [x + w * 0.02, -h - 2]], tone(t, "shade"), 0.4, 0.6),
    S(o, c), tiled(o, dots ? { w: 5, h: 5, shapes: [S(ellipse(1.25, 1.25, 0.8), tone(c, "light")), S(ellipse(3.75, 3.75, 0.8), tone(c, "light"))] } : { w: 5, h: 5, shapes: [S(rect(0, 0, 1.6, 5), tone(c, "light"))] }, 0.7),
    F(rect(x + w / 2 - w * 0.2, -h, w * 0.2, h), tone(c, "shade"), 0.55, o), L([[x + w / 2 - w * 0.2, -4], [x + w / 2 - w * 0.1, 0]], tone(c, "deep"), 0.5, 0.5),
    F(rect(x - w / 2, -h, w, 2.6), tone(c, "light"), 0.45),
    R([[x - 5, -h + 3], [x - 4.5, top], [x + 4.5, top], [x + 5, -h + 3]], hd, 0.9), F(ellipse(x - 5, -h + 3, 0.7), CREAM), F(ellipse(x + 5, -h + 3, 0.7), CREAM),
  ];
}

/** A brown paper bag at (x, 0), w × h, its top rolled down. */
function paperBag(x: number, w: number, h: number, c: string): Shape[] {
  const o = rect(x - w / 2, -h + 5, w, h - 5), roll = rrect(x - w / 2 - 0.8, -h, w + 1.6, 6.2, 2.6);
  return [
    S(o, c), ...lit(o, c, x - w / 2, x + w / 2, -h + 5, 0, 0.16),
    L([[x - w / 2 + 3, -h + 6], [x - w / 2 + 3, -3], [x - w / 2 + 0.5, 0]], tone(c, "shade"), 0.6, 0.6), L([[x + w / 2 - 3, -h + 6], [x + w / 2 - 3, -3], [x + w / 2 - 0.5, 0]], tone(c, "shade"), 0.6, 0.6),
    L([[x - w * 0.2, -h * 0.55], [x + w * 0.1, -h * 0.4]], tone(c, "light"), 0.5, 0.5), L([[x - w / 2 + 3, -3], [x + w / 2 - 3, -3]], tone(c, "shade"), 0.5, 0.45),
    S(roll, tone(c, "light")), L([[x - w / 2, -h + 3.2], [x + w / 2, -h + 3.2]], tone(c, "shade"), 0.5, 0.6),
  ];
}

/** Groceries showing out of a bag's mouth at (x, y): a leek, a loaf's end, an orange, a bottle. */
function groceries(x: number, y: number, r: Rng): Shape[] {
  const out: Shape[] = [];
  for (const k of [r.int(0, 3), r.int(0, 3)]) {
    const gx = x + r.range(-7, 7);
    if (k === 0) out.push(R([[gx, y + 4], [gx + 2, y - 16]], "#E9EDD9", 2.4), R([[gx + 2, y - 12], [gx + 4, y - 24]], "#5E9A55", 2.6), R([[gx + 1, y - 12], [gx - 3, y - 22]], "#4E7A48", 2));
    else if (k === 1) out.push(S(ellipse(gx, y - 2, 8, 5), "#C8863F"), F(ellipse(gx - 2, y - 4, 4, 1.2), tone("#C8863F", "light"), 0.6));
    else if (k === 2) out.push(S(ellipse(gx, y - 2, 4.2), "#EE8A2E"), F(ellipse(gx - 1.4, y - 3.4, 1.2), "#FFFFFF", 0.4));
    else out.push(S(rrect(gx - 2.5, y - 10, 5, 12, 2), "#BFDDE6"), S(rect(gx - 1.3, y - 14, 2.6, 4.5), "#3E8E4E"));
  }
  return out;
}

/** A plastic shopping bag (poşet) at (x, 0), full: groceries out of the top, the handles tied up, or (`hang`) gathered to the grip 42 cm above its foot. */
function poset(x: number, c: string, r: Rng, hang: boolean): Shape[] {
  const o = smooth([[x - 14, 0, 0], [x + 14, 0, 0], [x + 16, -11], [x + 14, -25], [x + 12, -31, 0], [x - 12, -31, 0], [x - 14, -25], [x - 16, -11]], true, 1), ink = r.pick(["#C8283A", "#2F8C88", "#1F5FC0", "#E0A83A"]);
  const hs: Vec2[][] = hang ? [[[x - 12, -30], [x - 6, -38], [x - 1, -42]], [[x + 12, -30], [x + 6, -38], [x + 1, -42]]] : [[[x - 13, -30], [x - 12.5, -40], [x - 7, -41], [x - 5, -30]], [[x + 13, -30], [x + 12.5, -40], [x + 7, -41], [x + 5, -30]]];
  return [
    ...groceries(x, -30, r), ...hs.map(h => R(h, c, 2.4)), S(o, c), ...lit(o, c, x - 16, x + 16, -31, 0, 0.18),
    L([[x - 9, -26], [x - 5, -12], [x - 7, -3]], tone(c, "shade"), 0.6, 0.5), L([[x + 6, -27], [x + 9, -8]], tone(c, "shade"), 0.6, 0.45),
    F(rrect(x - 6, -19, 12, 6, 1), ink, 0.85), F(ellipse(x, -16, 1.8), c, 0.9),
  ];
}

/**
 * A bag, `kind`: `suitcase` (a hard-shell case on wheels, 46 × 70 cm: `n` stand in a row of three and more
 * lie stacked on top; held, one is pulled along tilted on its wheels by the telescopic handle), `shoulder`
 * (a leather shoulder bag, the default), `gift` (a gift bag, tissue paper out of the top), `paper` (a brown
 * paper bag, its top rolled down) or `shopping` (full plastic shopping bags, poşet). `n` side by side;
 * held, they hang from the hand by their handles (the suitcase rolls). `color` is the first one's; the rest
 * are seeded.
 */
const bag: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "shoulder"), held = !!p.held, n = cnt(p.n, 1), c0 = typeof p.color === "string" ? col(kit, p.color, "#888888") : null;
  const pick = (i: number, list: string[]) => { const c = r.pick(list); return i === 0 && c0 ? c0 : c; };
  if (kind === "suitcase") {
    if (held) return one("bag", tilt(caseSide(26, 70, pick(0, BAGS), 10), [10, -81.5], [10, -3.2], -1, GRIP - 3.6), 3, true);
    const sh: Shape[] = [];
    for (let i = 0; i < n; i++) {
      const c = pick(i, BAGS), tag = r.chance(0.5), lv = Math.floor(i / 3), inRow = Math.min(3, n - lv * 3), x = (i % 3 - (inRow - 1) / 2) * 49 + (lv % 2 ? 8 : 0);
      sh.push(...(lv ? caseFlat(x, -70 - (lv - 1) * 28, 37, 26, c) : caseFront(x, 46, 70, c, tag)));
    }
    return one("bag", sh, 3, false, {}, 0.6);
  }
  if (kind === "gift") {
    const draw = (x: number, i: number, hang: boolean) => { const w = r.range(22, 27), h = w * r.range(1.15, 1.3); return giftBag(x, w, h, pick(i, BRIGHT), r.pick(["#F7F3EA", "#F0C6CC", "#F2E6B3", "#CFE3D3"]), r.chance(0.5), hang).map(s => hang ? { ...s, path: s.path.move(0, h + 9) } : s); };
    if (held) return one("bag", fan(n, i => draw(0, i, true)), 4, true);
    return one("bag", row(n, 28, 3, (x, i) => draw(x, i, false)), 4, false);
  }
  if (kind === "paper") {
    if (held) return one("bag", fan(n, i => mv(paperBag(0, 22, 30, mix(KRAFT, pick(i, [KRAFT, "#B9875A", "#D2AA78"]), 0.5)), 0, 27)), 5, true);
    return one("bag", row(n, 22, 3, (x, i) => paperBag(x, 22, 30, mix(KRAFT, pick(i, [KRAFT, "#B9875A", "#D2AA78"]), 0.5))), 5, false);
  }
  if (kind === "shopping") {
    const POS = ["#F2EFE6", "#F2EFE6", "#E9E4DA", "#BFD9E8", "#3A3D45", "#F0C6CC", "#DCE8C8"];
    if (held) return one("bag", fan(n, i => mv(poset(0, pick(i, POS), r, true), 0, 42)), 4, true);
    return one("bag", row(n, 30, -3, (x, i) => poset(x, pick(i, POS), r, false)), 4, false);
  }
  if (held) return one("bag", fan(n, i => mv(shoulderBag(0, pick(i, LEATHER), true), 0, 40)), 4, true);
  return one("bag", row(n, 34, 4, (x, i) => shoulderBag(x, pick(i, LEATHER), false)), 4, false);
}, variants: { suitcase: { kind: "suitcase" }, shoulder: { kind: "shoulder" }, gift: { kind: "gift" }, paper: { kind: "paper" }, shopping: { kind: "shopping" } },
  meta: {
    about: "A bag: a leather shoulder bag, a wheeled suitcase, a gift bag, a brown paper bag or a full plastic shopping bag.",
    params: {
      kind: { type: "enum", values: ["shoulder", "suitcase", "gift", "paper", "shopping"], default: "shoulder" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (suitcases: rows of three, more stacked on top)" },
      color: { type: "color", about: "the first one's (a Turkish colour name, a palette id or a hex); the rest seeded" },
    },
    terms: ["a1-w-canta", "a1-w-bavul", "a1-w-hediye"],
    tags: ["bag"],
  } };

// ---- boxes ---------------------------------------------------------------------------------------------

/** A box w × h standing at (x, y), seen a little from the right: its front, then its side and top going back `d`. */
function carton(x: number, y: number, w: number, h: number, c: string, d = 5, top = true): Shape[] {
  const x0 = x - w / 2, x1 = x + w / 2, t = y - h, k = d * 0.6;
  return [S(poly([[x1 - 0.3, t], [x1 + d, t - k], [x1 + d, y - k], [x1 - 0.3, y]]), mix(c, "#4A3A30", 0.28)), ...(top ? [S(poly([[x0, t + 0.3], [x0 + d, t - k], [x1 + d, t - k], [x1, t + 0.3]]), tone(c, "light"))] : []), S(rect(x0, t, w, h), c)];
}

/** A taped cardboard moving box at (x, y): tape over the top and down the front, a hand hole, printed arrows, a crease (`dent`). */
function moving(x: number, y: number, w: number, h: number, c: string, dent: number): Shape[] {
  const t = y - h, x0 = x - w / 2, tape = "#B5874C", ax = x0 + w - 7;
  const sh = [...carton(x, y, w, h, c, 6), L([[x0 + 0.5, t + 0.7], [x0 + w - 0.5, t + 0.7]], tone(c, "shade"), 0.5, 0.6)];
  sh.push(F(poly([[x - 3, t], [x + 3, t], [x + 9, t - 3.6], [x + 3, t - 3.6]]), tape, 0.85), F(rect(x - 3, t, 6, 6), tape, 0.85), F(rect(x - 3, t + 5.6, 6, 0.6), tone(tape, "shade"), 0.6));
  sh.push(S(rrect(x - 5, t + 9, 10, 3, 1.5), tone(c, "deep"), { flat: true, opacity: 0.85 }));
  for (const k of [0, 3.8]) sh.push(F(poly([[ax + k, t + 4], [ax + k + 1.5, t + 6.6], [ax + k + 0.55, t + 6.6], [ax + k + 0.55, t + 9.5], [ax + k - 0.55, t + 9.5], [ax + k - 0.55, t + 6.6], [ax + k - 1.5, t + 6.6]]), "#3B3B40", 0.55));
  if (dent > 0.4) sh.push(L([[x0 + w * 0.15, y - h * dent], [x0 + w * 0.35, y - h * dent + 3], [x0 + w * 0.3, y - 2]], tone(c, "shade"), 0.6, 0.45));
  return sh;
}

/** A box with a lid at (x, y), tied with string (`tie`) in a bow on top. */
function lidded(x: number, y: number, w: number, h: number, c: string, lc: string, tie: string | null): Shape[] {
  const t = y - h, lh = Math.max(2.4, h * 0.26), d = w * 0.14, k = d * 0.6;
  const sh = [...carton(x, y, w, h, c, d, false), F(rect(x - w / 2, t + lh, w, 1), tone(c, "deep"), 0.35), ...carton(x, t + lh, w + 1.2, lh + 0.4, lc, d)];
  if (tie) sh.push(L([[x, t - 0.2], [x, y]], tie, 0.5, 0.95), L([[x - 0.1, t + 0.2], [x + d, t - k]], tie, 0.5, 0.95), L([[x - w / 2 - 0.6, t + lh * 0.55], [x + w / 2 + 0.6, t + lh * 0.55]], tie, 0.5, 0.9),
    { path: smooth([[x + d / 2, t - k / 2], [x + d / 2 - 3, t - k / 2 - 2.4], [x + d / 2 - 3.4, t - k / 2 + 0.4]], true, 1), fill: tie }, { path: smooth([[x + d / 2, t - k / 2], [x + d / 2 + 3, t - k / 2 - 2.4], [x + d / 2 + 3.4, t - k / 2 + 0.4]], true, 1), fill: tie });
  return sh;
}

/** A pomegranate of radius `rr` centred at (x, y), its crown up; `cut`, a half lying open, seeds showing. */
function pom(x: number, y: number, rr: number, c: string, cut = false): Shape[] {
  if (cut) {
    const o = ellipse(x, y, rr, rr * 0.82), seeds: Shape[] = [];
    for (let i = 0; i < 14; i++) { const a = i * 2.4, q = Math.sqrt((i + 0.5) / 14) * rr * 0.68; seeds.push(F(ellipse(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.8, rr * 0.13, rr * 0.11), i % 3 ? "#C21E3A" : "#E0465E")); }
    return [S(o, c), F(ellipse(x, y, rr * 0.84, rr * 0.68), "#F2D8C0"), ...seeds, F(ellipse(x - rr * 0.3, y - rr * 0.35, rr * 0.25, rr * 0.12), "#FFFFFF", 0.4)];
  }
  const o = ellipse(x, y, rr, rr * 0.95);
  return [
    P([[x - rr * 0.3, y - rr * 0.8], [x - rr * 0.38, y - rr * 1.25, 0], [x - rr * 0.13, y - rr * 1.02], [x, y - rr * 1.3, 0], [x + rr * 0.13, y - rr * 1.02], [x + rr * 0.38, y - rr * 1.25, 0], [x + rr * 0.3, y - rr * 0.8]], tone(c, "deep")),
    S(o, c), F(ellipse(x + rr * 0.45, y + rr * 0.4, rr * 0.75, rr * 0.7), tone(c, "shade"), 0.45, o), F(ellipse(x - rr * 0.35, y - rr * 0.35, rr * 0.3, rr * 0.2), tone(c, "light"), 0.7),
  ];
}

/** An open box of pomegranates at (x, y): the flaps up behind and out at the sides, the fruit heaped in it, one cut open. */
function pomBox(x: number, y: number, w: number, h: number, c: string, r: Rng): Shape[] {
  const t = y - h, x0 = x - w / 2, sh: Shape[] = [S(poly([[x0 + 4, t - 3], [x0 + w + 5, t - 4], [x0 + w + 3, t - 13], [x0 + 5, t - 11]]), tone(c, "shade"))];
  const fruit = ["#A8203A", "#B5263C", "#982034", "#C0392B"];
  for (let i = 0; i < 5; i++) sh.push(...pom(x0 + w * (0.14 + i * 0.19) + r.range(-1, 1), t - 4 - r.range(0, 1.5), r.range(4.6, 5.6), r.pick(fruit)));
  for (let i = 0; i < 4; i++) sh.push(...pom(x0 + w * (0.22 + i * 0.19) + r.range(-1, 1), t + 0.5, r.range(4.8, 5.8), r.pick(fruit), i === 2));
  sh.push(...carton(x, y, w, h, c, 6, false), S(poly([[x0 + 0.5, t], [x0 - 6, t - 7], [x0 - 4, t - 8.6], [x0 + 2.5, t - 0.5]]), tone(c, "light")), S(poly([[x0 + w + 5.5, t - 3.4], [x0 + w + 12, t - 9], [x0 + w + 11, t - 10.6], [x0 + w + 4, t - 4.5]]), tone(c, "shade")));
  sh.push(F(rect(x0, t, w, 1.2), tone(c, "deep"), 0.4), F(rrect(x0 + w * 0.3, t + h * 0.38, w * 0.4, h * 0.36, 1), "#A8203A", 0.75), F(ellipse(x, t + h * 0.56, h * 0.11), "#F2D8C0", 0.9));
  return sh;
}

/**
 * A box, `kind`: `plain` (a lidded box tied with string, the default: a box of food), `small` (a small
 * blue box with a lid), `moving` (a taped cardboard moving box, seeded from smallish to big, × `size`:
 * `n` stack three high, then side by side; `label` written on the first in marker) or `pomegranates` (an
 * open box heaped with pomegranates, one cut open). `n` side by side; `color` the box's colour. Held, a
 * moving box hangs from the hand by its hand hole; the others are held up on the hand.
 */
const box: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "plain"), held = !!p.held, n = cnt(p.n, 1), k = Math.max(0.2, Math.min(3, num(p.size, 1))), cc = typeof p.color === "string" ? col(kit, p.color, "#C69C6D") : null;
  if (kind === "moving") {
    const spec = Array.from({ length: n }, () => ({ w: r.range(38, 60) * k, h: r.range(28, 44) * k, c: cc ?? r.pick(["#C69C6D", "#BE925F", "#CFA676"]), dent: r() }));
    const label = str(p.label, "").trim(), text: TextSpec[] = [];
    if (held) { const b = spec[0]; return one("box", mv(moving(0, 0, b.w, b.h, b.c, b.dent), 0, b.h - 10.5), 3, true); }
    const cols = Math.ceil(n / 3), cw = Array.from({ length: cols }, (_, j) => spec[j * 3].w + 6), sh: Shape[] = [];
    let x = -(cw.reduce((a, b) => a + b, 0) + (cols - 1) * 3) / 2;
    for (let j = 0; j < cols; j++) {
      let y = 0, below = Infinity;
      for (let i = j * 3; i < Math.min(n, j * 3 + 3); i++) {
        const b = spec[i], w = Math.min(b.w, below - 2), bx = x + 3 + (j * 3 === i ? 0 : (b.dent - 0.5) * 4);
        sh.push(...moving(bx + spec[j * 3].w / 2 - 3, y, w, b.h, b.c, b.dent));
        if (i === 0 && label) text.push({ text: label, x: bx + spec[0].w / 2 - 3 - w / 2 + 3, y: y - b.h + 13, w: w - 6, h: Math.min(10 * k, b.h - 16), size: 5 * k, font: "hand" });
        y -= b.h; below = w;
      }
      x += cw[j] + 3;
    }
    return one("box", sh, 3, false, text.length ? { text } : {});
  }
  if (kind === "pomegranates") return one("box", row(n, 44, 12, x => pomBox(x, 0, 40 * k, 14 * k, cc ?? "#C69C6D", r)), 4, held);
  if (kind === "small") return one("box", row(n, 13 * k, 3, x => lidded(x, 0, 12 * k, 8 * k, cc ?? "#2F5FA8", tone(cc ?? "#2F5FA8", "light"), null)), 10, held, {}, 0.25);
  return one("box", row(n, 40 * k, 5, x => { const c = cc ?? r.pick(["#F4EFE6", "#E8D7B8", "#C9A06A", "#BFD9E8", "#F0C6CC"]); return lidded(x, 0, 36 * k, 22 * k, c, r.chance(0.5) ? c : tone(c, "light"), r.pick(["#C8283A", "#F7F3EA", "#6B4A35"])); }), 4, held);
}, variants: { moving: { kind: "moving" }, small: { kind: "small" }, pomegranates: { kind: "pomegranates" } },
  meta: {
    about: "A box: a lidded box tied with string, a small blue box, a taped cardboard moving box, or an open box of pomegranates.",
    params: {
      kind: { type: "enum", values: ["plain", "small", "moving", "pomegranates"], default: "plain" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side (moving boxes stack three high)" },
      size: { type: "num", min: 0.2, max: 3, default: 1, about: "scale" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
      label: { type: "text", about: "moving: written on the first box in marker" },
    },
    terms: ["a1-w-kutu"],
    tags: ["box"],
  } };

// ---- trolleys --------------------------------------------------------------------------------------------

/** A tartan in `c`: dark bands, a yellow and a white line each way. */
const tartan = (c: string): Tile => { const a = tone(c, "deep"), b = mix(c, "#F2C230", 0.65); return { w: 12, h: 12, shapes: [S(rect(0, 0, 4.5, 12), a, { opacity: 0.55 }), S(rect(0, 0, 12, 4.5), a, { opacity: 0.55 }), S(rect(7.5, 0, 0.8, 12), b, { opacity: 0.75 }), S(rect(0, 7.5, 12, 0.8), b, { opacity: 0.75 }), S(rect(10, 0, 0.45, 12), "#F7F3EA", { opacity: 0.55 }), S(rect(0, 10, 12, 0.45), "#F7F3EA", { opacity: 0.55 })] }; };
/** A wheel of radius `rr` at (x, y): tyre, rim and spokes. */
const wheel = (x: number, y: number, rr: number, spokes = 5): Shape[] => [S(ellipse(x, y, rr), "#26272C"), S(ellipse(x, y, rr * 0.72), "#4B5058"), ...Array.from({ length: spokes }, (_, i) => L([[x, y], [x + Math.cos(i * 6.283 / spokes) * rr * 0.7, y + Math.sin(i * 6.283 / spokes) * rr * 0.7]], STEEL, 0.5, 0.8)), S(ellipse(x, y, rr * 0.22), STEEL)];

/** A two-wheeled shopping trolley side on, its frame to the left: a tartan bag with a flap and a pocket, the grip at 98 cm. */
function shopTrolley(c: string): Shape[] {
  const o = rrect(-11, -64, 31, 54, 5), flap = smooth([[-12, -66, 0], [20, -66], [22, -60], [21, -54, 0], [-12, -54, 0]], true, 1), pocket = rrect(-5, -42, 22, 15, 2), FR = "#3A3D45";
  return [
    ...wheel(-8, -8.5, 8.2).map(s => ({ ...s, path: s.path.move(3, 0), fill: s.fill && tone(s.fill, "deep") })),
    R([[-13, -9], [-14, -66], [-17, -92], [-23, -96]], FR, 2.2), S(rrect(-29, -99, 10, 4.6, 2.3), DARK), R([[-13, -9.5], [23, -9.5]], FR, 2), R([[20, -9.5], [22, -1]], FR, 1.8), S(rrect(19.5, -1.8, 5, 1.8, 0.8), DARK),
    S(o, c), tiled(o, tartan(c)), ...lit(o, c, -11, 20, -64, -10),
    S(pocket, c), tiled(pocket, tartan(c)), F(rect(-5, -42, 22, 4), tone(c, "deep"), 0.5, pocket),
    S(flap, tone(c, "shade")), tiled(flap, tartan(tone(c, "shade"))), R([[-12, -66], [-14, -70], [-10, -71]], "#F7F3EA", 0.5),
    ...wheel(-11, -8.5, 8.5),
  ];
}

/** A child's pushchair side on, facing right: frame, a padded seat and hood in `c`, a basket underneath, the handle at 96 cm. */
function pushchair(c: string): Shape[] {
  const FR = "#3A3D45", bk = rrect(-9, -28, 23, 10, 2), seat = smooth([[-26, -80], [-19, -84, 0], [-7, -52], [14, -50], [20, -31, 0], [13, -28, 0], [9, -40], [-11, -40, 0], [-26, -72]], true, 1);
  const hood = smooth([[-30, -76, 0], [-29, -94], [-17, -104], [-1, -100], [9, -87], [11, -78, 0]], true, 1);
  return [
    S(ellipse(-11, -9, 8.5), "#1F2024"), S(ellipse(24, -6, 6), "#1F2024"),
    R([[-14, -9], [-8, -50]], FR, 1.8), R([[20, -9], [-8, -50]], FR, 1.8), R([[-8, -50], [-24, -96]], FR, 1.8), S(rrect(-30, -99, 10, 4.4, 2.2), DARK),
    S(bk, "#3B3B40"), tiled(bk, { w: 2.4, h: 2.4, shapes: [S(rect(0, 0, 2.4, 0.4), STEEL), S(rect(0, 0, 0.4, 2.4), STEEL)] }, 0.5),
    S(seat, c), ...lit(seat, c, -26, 20, -84, -28), L([[-8, -45], [11, -44]], tone(c, "light"), 0.7, 0.5), L([[-16, -76], [-5, -49]], tone(c, "deep"), 0.6, 0.4),
    S(hood, tone(c, "shade")), F(smooth([[-4, -79], [6, -88], [11, -78]], true, 1), tone(c, "deep"), 0.6), L([[-25, -92], [-14, -100], [0, -96]], tone(c, "deep"), 0.6, 0.55), L([[-27, -84], [-12, -95], [5, -88]], tone(c, "deep"), 0.6, 0.55), F(rect(-31, -80, 43, 2.2), tone(c, "deep"), 0.5, hood),
    R([[6, -52], [16, -47]], DARK, 2.2), ...wheel(-14, -9, 8.5), ...wheel(20, -6.5, 6, 4),
  ];
}

/** A pushchair folded up and carried by its hooked handles: the frame, the fabric strapped tight, the wheels together at the foot. */
function pushchairFolded(c: string): Shape[] {
  const FR = "#3A3D45", o = smooth([[-4.5, -78], [4.5, -78], [6.5, -44], [4, -14], [-4, -14], [-6.5, -44]], true, 1);
  return [
    R([[-3, -4], [-2.5, -84]], FR, 1.8), R([[3, -4], [2.5, -84]], FR, 1.8), R([[-2.5, -84], [-2.5, -89], [-5.5, -91], [-7.5, -88]], DARK, 2.4), R([[2.5, -84], [2.5, -89], [5.5, -91], [7.5, -88]], DARK, 2.4),
    S(o, c), ...lit(o, c, -6.5, 6.5, -78, -14), S(ellipse(0, -76, 6, 4), tone(c, "shade")), F(rect(-7, -50, 14, 2.6), DARK, 0.85, o),
    ...wheel(-3.5, -5, 5, 4), ...wheel(4, -5, 5, 4),
  ];
}

/**
 * A trolley, `kind`: `shopping` (a two-wheeled shopping trolley with a tartan bag in `color`, the
 * default; held, pulled along tilted on its wheels) or `pushchair` (a child's pushchair in `color`;
 * held, folded and carried by its handles, its wheels on the floor). `n` side by side.
 */
const trolley: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "shopping"), held = !!p.held, n = cnt(p.n, 1), c = col(kit, p.color, r.pick(kind === "pushchair" ? ["#2E3A59", "#2F8C88", "#C4553A", "#6F7A45", "#3A3D45", "#7A3E6E"] : ["#A23F28", "#2E5237", "#2E3A59", "#7A3E6E"]));
  if (kind === "pushchair") return held ? one("trolley", tilt(pushchairFolded(c), [-6, -89], [0, -5], 1, GRIP - 8.5), 3, true) : one("trolley", row(n, 60, 4, x => mv(pushchair(c), x, 0)), 3, false);
  return held ? one("trolley", tilt(shopTrolley(c), [-24, -96.5], [-11, -8.5], 1, GRIP - 9), 3, true) : one("trolley", row(n, 52, 4, x => mv(shopTrolley(c), x, 0)), 3, false);
}, variants: { shopping: { kind: "shopping" }, pushchair: { kind: "pushchair" } },
  meta: {
    about: "A two-wheeled shopping trolley with a tartan bag, or a child's pushchair (folded when held).",
    params: {
      kind: { type: "enum", values: ["shopping", "pushchair"], default: "shopping" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
    },
    tags: ["vehicle"],
  } };

// ---- cloth ---------------------------------------------------------------------------------------------

/** Lace w × h hanging over an edge (its top at -h): a scalloped hem with eyelets, rosettes and a lattice of holes (even-odd). */
function lacePath(w: number, h: number): Path {
  const m = Math.max(3, Math.round(w / 5)), sw = w / m, s = 3.4, pts: Pt[] = [[-w / 2, -h, 0], [w / 2, -h, 0], [w / 2, -s, 0]];
  for (let i = 0; i < m; i++) pts.push([w / 2 - i * sw - sw / 2, 0], [w / 2 - (i + 1) * sw, -s, 0]);
  const o = smooth(pts, true, 1), ros: Vec2[] = [];
  for (let x = -w / 2 + 8; x < w / 2 - 5; x += 11) ros.push([x, -s - (h - s) * 0.42]);
  for (const [x, y] of ros) { o.add(ellipse(x, y, 1)); for (let k = 0; k < 6; k++) o.add(ellipse(x + Math.cos(k * 1.047) * 2.9, y + Math.sin(k * 1.047) * 2.9, 1.15, 1.15)); }
  for (let i = 0; i < m; i++) o.add(ellipse(w / 2 - (i + 0.5) * sw, -s * 0.55, 1));
  for (let j = 0, y = -h + 2.4; y < -s - 1.2; j++, y += 2.4) for (let x = -w / 2 + 1.6 + (j % 2) * 1.2; x < w / 2 - 1.2; x += 2.4) if (ros.every(([a, b]) => Math.hypot(x - a, y - b) > 5.2)) o.add(ellipse(x, y, 0.55));
  return o;
}

/** A strand of cloth from x0 to x1 hanging from yt to yb (a scarf's end), a little uneven. */
const strip = (x0: number, x1: number, yt: number, yb: number): Path => smooth([[x0, yt, 0], [x1, yt, 0], [x1 + 0.6, (yt + yb) / 2], [x1, yb, 0], [x0, yb, 0], [x0 - 0.5, (yt + yb) / 2]], true, 1);
/** A coat hanging from a hook at (0, -h): shoulders, collar, sleeves, pockets and buttons; `hook` false leaves the hook off. */
function coatShapes(c: string, h: number, hook: boolean): Shape[] {
  const o = smooth([[-7, -h + 3], [-21, -h + 10], [-24, -h + 22], [-26, -12], [-28, 0, 0], [28, 0, 0], [26, -12], [24, -h + 22], [21, -h + 10], [7, -h + 3], [0, -h + 6]], true, 1);
  const sleeve = (d: number) => smooth([[d * 21, -h + 11], [d * 25, -h + 20], [d * 26, -h + 64, 0], [d * 17, -h + 66, 0], [d * 17, -h + 24]], true, 1);
  const sh: Shape[] = hook ? [R([[0, -h + 4], [0, -h - 3], [3, -h - 5], [5, -h - 3]], BRASS, 1.2), S(ellipse(0, -h - 6.5, 2.2, 1.4), tone(BRASS, "shade"))] : [];
  sh.push(S(o, c), ...lit(o, c, -28, 28, -h, 0, 0.18), S(smooth([[-7, -h + 3], [0, -h + 32, 0], [7, -h + 3], [3.5, -h + 1], [-3.5, -h + 1]], true, 1), tone(c, "deep")));
  sh.push(S(smooth([[-7.5, -h + 3], [-12, -h + 6, 0], [-4, -h + 36, 0], [0, -h + 32, 0]], true, 1), tone(c, "light")), S(smooth([[7.5, -h + 3], [12, -h + 6, 0], [4, -h + 36, 0], [0, -h + 32, 0]], true, 1), tone(c, "light")));
  sh.push(L([[0.5, -h + 34], [0.5, -1]], tone(c, "deep"), 0.7, 0.7), ...[0, 1, 2, 3].map(i => S(ellipse(3, -h + 40 + i * 13, 1.4), tone(c, "deep"))));
  for (const d of [-1, 1]) sh.push(F(rect(d > 0 ? 7 : -19, -30, 12, 2.2), tone(c, "deep"), 0.55), S(sleeve(d), tone(c, "shade")), F(rect(d > 0 ? 17 : -26, -h + 59, 9, 2), tone(c, "deep"), 0.5, sleeve(d)));
  return sh;
}

/**
 * Cloth, `kind`: `folded` (folded cloths stacked `n` high, the default), `lace` (a lace cloth `w` × `h`
 * hanging over the edge of a table or an armchair), `blanket` (a folded wool blanket, or `worn` round
 * the shoulders), `shawl` (a knitted shawl, mauve, over a chair back: `stripes` long, else `n`, so it
 * grows stripe by stripe, its newest stripe in `last`; `worn` round the shoulders), `scarf` (a knitted
 * scarf hanging from a hook, `worn` round the neck, or `draped` along a ledge `w` long with both ends over its edge;
 * `colors` stripes it `stripes` times) or `coat` (a
 * coat hanging on a hook; `hook` false leaves the hook off). `color` is the cloth's. Held, it hangs folded
 * over the forearm (a scarf by its fold).
 */
const cloth: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "folded"), held = !!p.held, worn = !!p.worn, n = cnt(p.n, 1);
  if (kind === "lace") {
    const w = num(p.w, 50), h = num(p.h, 18), c = col(kit, p.color, "#F6F0E1"), sh = [{ path: lacePath(w, h), fill: c, evenodd: true }, F(rect(-w / 2, -h, w, 2.4), tone(c, "shade"), 0.4)];
    return one("cloth", held ? mv(sh, 0, h) : sh, 6, held, {}, 0.2);
  }
  if (kind === "coat") {
    const c = col(kit, p.color, r.pick(["#B98A57", "#2E3A59", "#3A3D45", "#6F7A45", "#6A1E32", "#6B4A35"]));
    if (held) return one("cloth", drape(40, 43, c, o => [F(rect(-20, -3, 40, 6), tone(c, "deep"), 0.5, o), ...[0, 1, 2].map(i => S(ellipse(6, 9 + i * 8, 1.3), tone(c, "deep")))]), 4, true);
    return one("cloth", row(n, 58, 4, x => mv(coatShapes(c, 100, p.hook !== false), x, 0)), 3, false);
  }
  if (kind === "shawl") {
    const c = col(kit, p.color, "#A78BA8"), m = Math.max(1, Math.min(30, Math.round(num(p.stripes, num(p.n, 9))))), last = typeof p.last === "string" ? col(kit, p.last, c) : null;
    const cols = [c, mix(c, "#FFFFFF", 0.45), tone(c, "shade"), mix(c, "#FFFFFF", 0.2)], sc = (i: number) => i === m - 1 && last ? last : cols[i % 4];
    const striped = (o: Path, x0: number, w: number, y0: number, k: number) => [...Array.from({ length: m }, (_, i) => F(rect(x0, y0 + i * k, w, k + 0.05), sc(i), 1, o)), knit(o, c)];
    if (held) return one("cloth", drape(46, m * 2.6 + 12, c, o => striped(o, -24, 48, -3, (m * 2.6 + 12) / m)), 4, true);
    if (worn) {
      const o = smooth([[-30, -58], [-17, -66], [0, -63], [17, -66], [30, -58], [31, -30], [24, -3, 0], [11, -3, 0], [12, -32], [7, -51], [0, -54], [-7, -51], [-12, -32], [-11, -3, 0], [-24, -3, 0], [-31, -30]], true, 1);
      return one("cloth", [S(o, c), ...striped(o, -32, 64, -67, 64 / m), ...lit(o, c, -31, 31, -66, -3), ...fringe(-23, -12, -3, 3, sc(m - 1)), ...fringe(12, 23, -3, 3, sc(m - 1))], 4, false);
    }
    const L0 = m * 5 + 4, o = smooth([[-28, -L0 + 1], [0, -L0 - 2.5], [28, -L0 + 1], [28.6, -3, 0], [-28.6, -3, 0]], true, 1);
    return one("cloth", [S(rrect(-29, -L0 - 1, 58, 8, 3), tone(c, "deep")), S(o, c), ...striped(o, -29, 58, -L0 - 2.5, (L0 - 0.5) / m), ...lit(o, c, -29, 29, -L0 - 3, -3, 0.12), ...fringe(-27, 27, -3, 3, sc(m - 1))], 4, false);
  }
  if (kind === "scarf") {
    const cs = Array.isArray(p.colors) && p.colors.length ? p.colors.map(v => col(kit, v, "#888888")) : [col(kit, p.color, r.pick(["#C8283A", "#2E3A59", "#E0A83A", "#2F8C88", "#6A1E32", "#6F7A45"]))], c = cs[0], k = Math.max(0, Math.round(num(p.stripes, 0)));
    const paint = (o: Path, x0: number, yt: number, yb: number): Shape[] => cs.length > 1 && k ? Array.from({ length: k }, (_, i) => F(rect(x0 - 1, yt + (yb - yt) * i / k, 12, (yb - yt) / k + 0.05), cs[i % cs.length], 1, o)) : [F(rect(x0 - 1, yb - 7, 12, 1.4), tone(c, "light"), 0.9, o), F(rect(x0 - 1, yb - 4.4, 12, 1.4), tone(c, "light"), 0.9, o)];
    const end = (x0: number, yt: number, yb: number, sh = false): Shape[] => { const o = strip(x0, x0 + 9, yt, yb), base = sh ? tone(c, "shade") : c; return [S(o, base), ...paint(o, x0, yt, yb).map(s => sh ? { ...s, fill: tone(s.fill!, "shade") } : s), knit(o, c), ...fringe(x0 + 0.6, x0 + 8.4, yb, 3, sh ? tone(cs[cs.length - 1], "shade") : cs[(k - 1 + cs.length) % cs.length])]; };
    if (p.draped && !held) {
      // laid along a ledge (a car's parcel shelf, a sofa's back): the length lying flat, its stripes across it, both ends
      // hanging over the front edge with their fringe; `w` its length along the ledge
      const W = num(p.w, 90), band = smooth([[-W / 2, -5], [-W / 4, -6.4], [W / 4, -5.8], [W / 2, -5.2], [W / 2 + 1, 0, 0], [-W / 2 - 1, 0, 0]], true, 1), m = Math.max(4, k || 6);
      const across = cs.length > 1 ? Array.from({ length: m }, (_, i) => F(rect(-W / 2 - 1 + i * (W + 2) / m, -7, (W + 2) / m + 0.05, 8), cs[i % cs.length], 1, band)) : [F(rect(-W / 2, -2.4, W, 1.2), tone(c, "light"), 0.9, band)];
      return one("cloth", [S(band, c), ...across, knit(band, c), F(rect(-W / 2, -1.4, W, 1.4), tone(c, "deep"), 0.35, band), ...end(-W / 2 + 4, -1.5, 16, true), ...end(W / 2 - 15, -1.5, 19)], 4, false);
    }
    if (worn) {
      const ring = ellipse(0, -58, 16, 6.5).add(ellipse(0, -59.6, 10.5, 3.4));
      return one("cloth", [...end(-1, -56, -30, true), ...end(-8, -56, -22), { path: ring, fill: c, evenodd: true }, knit(ring, c), F(ellipse(5, -55, 10, 3), tone(c, "shade"), 0.45, ring)], 4, false);
    }
    const H = held ? 40 : 58, top = smooth([[-9.6, -H + 4, 0], [-8.6, -H], [0, -H - 1.6], [8.6, -H], [9.6, -H + 4, 0], [0, -H + 3.4]], true, 1);
    const sh = [...(held ? [] : [R([[0, -H - 1], [0, -H - 5], [2.6, -H - 6.4], [4.4, -H - 5]], BRASS, 1)]), ...end(0.4, -H + 2, -15, true), ...end(-9.4, -H + 2, -6), S(top, c), knit(top, c)];
    return one("cloth", held ? mv(sh, 0, H + 1.6) : sh, 4, held, {}, 0.35);
  }
  if (kind === "blanket") {
    const c = col(kit, p.color, r.pick(["#A23F28", "#2E5237", "#B98A57", "#4F6E9E", "#7A3E6E", "#D8C3A0"])), plaid = (o: Path) => tiled(o, { w: 14, h: 14, shapes: [S(rect(0, 0, 5, 14), tone(c, "deep"), { opacity: 0.45 }), S(rect(0, 0, 14, 5), tone(c, "deep"), { opacity: 0.45 }), S(rect(9, 0, 1, 14), "#F7F3EA", { opacity: 0.55 }), S(rect(0, 9, 14, 1), "#F7F3EA", { opacity: 0.55 })] });
    if (held) return one("cloth", drape(44, 42, c, o => [plaid(o)]), 4, true);
    if (worn) {
      const o = smooth([[-24, -62], [-12, -65], [0, -59], [12, -65], [24, -62], [33, -32], [37, -3, 0], [-37, -3, 0], [-33, -32]], true, 1);
      return one("cloth", [S(o, c), plaid(o), ...lit(o, c, -37, 37, -65, -3, 0.15), L([[1, -59], [6, -3]], tone(c, "deep"), 0.9, 0.6), ...fringe(-36, 36, -3, 3, tone(c, "light"))], 4, false);
    }
    const sh: Shape[] = [];
    for (let i = 0; i < n * 3; i++) { const o = rrect(-26 + r.range(-1.2, 1.2), -7 * (i + 1), 52, 7.2, 3.4); sh.push(S(o, c), plaid(o), F(rect(-30, -7 * (i + 1) + 5, 60, 2.2), tone(c, "deep"), 0.3, o)); }
    return one("cloth", sh, 4, false);
  }
  // folded cloths
  const pick = () => r.pick(["#F7F3EA", "#F0E2C8", "#C8283A", "#2F8C88", "#E0A83A", "#BFD9E8"]), c0 = col(kit, p.color, pick());
  if (held) return one("cloth", drape(30, 36, c0, o => [F(rect(-16, 22, 32, 1.6), tone(c0, "deep"), 0.6, o), F(rect(-16, 24.5, 32, 0.8), tone(c0, "deep"), 0.6, o)]), 4, true);
  const sh: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const c = i ? pick() : c0, x = r.range(-1.5, 1.5), y = -i * 5.7, o = smooth([[x - 15, y - 5.6], [x + 16, y - 5.6, 0], [x + 16, y, 0], [x - 15, y], [x - 16.6, y - 2.8]], true, 1);
    sh.push(S(o, c), ...(r.chance(0.35) ? [tiled(o, { w: 2.4, h: 2.4, shapes: [S(rect(0, 0, 1.2, 2.4), tone(c, "deep"), { opacity: 0.3 }), S(rect(0, 0, 2.4, 1.2), tone(c, "deep"), { opacity: 0.3 })] })] : []), F(rect(x + 9, y - 6, 1.8, 7), tone(c, "deep"), 0.5, o), F(rect(x + 12, y - 6, 0.8, 7), tone(c, "deep"), 0.5, o), L([[x - 14, y - 1.2], [x + 15, y - 1.2]], tone(c, "shade"), 0.5, 0.5));
  }
  return one("cloth", sh, 5, false);
}, variants: { lace: { kind: "lace" }, blanket: { kind: "blanket" }, shawl: { kind: "shawl" }, scarf: { kind: "scarf" }, scarf_bjk: { kind: "scarf", colors: ["#1C1C1E", "#F4F1EA"], stripes: 9 }, coat: { kind: "coat" } },
  meta: {
    about: "Cloth: folded cloths, a lace cloth, a wool blanket, a knitted shawl or scarf, or a coat on a hook.",
    params: {
      kind: { type: "enum", values: ["folded", "lace", "blanket", "shawl", "scarf", "coat"], default: "folded" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "folded cloths stacked, blankets (× 3), coats side by side; a shawl's stripes when stripes is not given" },
      worn: { type: "bool", default: false, about: "blanket, shawl, scarf: worn round the shoulders or neck" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
      w: { type: "num", default: 50, about: "lace: width; a draped scarf: its length along the ledge (90), cm" },
      draped: { type: "bool", default: false, about: "scarf: laid along a ledge, both ends hanging over its front edge" },
      h: { type: "num", default: 18, about: "lace: height, cm" },
      hook: { type: "bool", default: true, about: "coat: hangs on a hook" },
      stripes: { type: "int", min: 0, max: 30, about: "shawl: its stripes (1…30, default n or 9); scarf: stripes of colors (default 0)" },
      last: { type: "color", about: "shawl: the newest stripe's colour" },
      colors: { type: "list", about: "scarf: its stripes' colours" },
    },
    terms: ["a1-w-palto"],
    tags: ["cloth"],
  } };

// ---- yarn ----------------------------------------------------------------------------------------------

/** A ball of yarn of radius `rr` sitting at (x, y): wound strands across it, shade low on the right, and a loose end (`tail`). */
function yball(x: number, y: number, rr: number, c: string, tail = true): Shape[] {
  const cy = y - rr, o = ellipse(x, cy, rr, rr), sh: Shape[] = tail ? [R([[x + rr * 0.5, cy + rr * 0.8], [x + rr * 1.2, y - 0.3], [x + rr * 2, y - 0.9], [x + rr * 2.7, y - 0.3]], c, 0.5)] : [];
  sh.push(S(o, c));
  for (let k = 0; k < 7; k++) sh.push({ path: ellipse(0, 0, rr * 0.97, rr * (0.28 + (k % 3) * 0.12)).transform(mul(translate(x, cy), rotate(-1.1 + k * 0.42))), stroke: { color: k % 2 ? tone(c, "shade") : tone(c, "light"), width: Math.max(0.2, rr * 0.05) }, flat: true, opacity: 0.8, clip: o });
  sh.push(F(ellipse(x + rr * 0.45, cy + rr * 0.45, rr * 0.8, rr * 0.75), tone(c, "shade"), 0.35, o));
  return sh;
}
/** A knitting needle from a to b (the knob at a), `c` its colour. */
const needle = (a: Vec2, b: Vec2, c: string): Shape[] => [R([a, b], c, 0.8), S(ellipse(a[0], a[1], 1.2), tone(c, "shade"))];
/** A knitted piece w wide hanging `h` from a needle at (x, y), in stripes of `cs`. */
function knitted(x: number, y: number, w: number, h: number, cs: string[]): Shape[] {
  const o = smooth([[x - w / 2, y, 0], [x + w / 2, y, 0], [x + w / 2 + 0.6, y + h * 0.5], [x + w / 2, y + h, 0], [x - w / 2, y + h, 0], [x - w / 2 - 0.6, y + h * 0.5]], true, 1), k = Math.max(1, Math.round(h / 3.2));
  return [S(o, cs[0]), ...(cs.length > 1 ? Array.from({ length: k }, (_, i) => F(rect(x - w / 2 - 1, y + i * h / k, w + 2, h / k + 0.05), cs[i % cs.length], 1, o)) : []), knit(o, cs[0], 1.4), ...lit(o, cs[0], x - w / 2, x + w / 2, y, y + h), ...Array.from({ length: Math.round(w / 1.4) }, (_, i) => S(ellipse(x - w / 2 + 0.7 + i * 1.4, y + 0.2, 0.7, 0.9), cs[0]))];
}

/**
 * Yarn, `kind`: `pile` (a skein and balls of yarn with a loose strand, the default), `ball` (a ball of
 * yarn in `color` with its loose end, that a script may roll; `n` side by side), `basket` (a wicker
 * basket heaped with balls and a pair of needles, `n` side by side), `strand` (a loose wavy strand on the
 * floor, `len` cm), `knitting` (a piece on the needles, `rows` long in `colors` stripes, its yarn running to
 * a ball) or `needles` (a pair of knitting needles, crossed). `color` is the yarn's. Held: balls and needles
 * held up in the hand, a basket by its handle, knitting from its needle, a strand dangling.
 */
const yarn: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "pile"), held = !!p.held, n = cnt(p.n, 1), c = col(kit, p.color, kind === "strand" || kind === "knitting" ? WOOL[0] : r.pick(WOOL));
  const wool = (i: number) => i ? r.pick(WOOL) : c;
  if (kind === "ball") return one("yarn", row(n, 14, 2, (x, i) => yball(x, 0, 6.5, wool(i), !held)), 6, held, {}, 0.3);
  if (kind === "strand") {
    const len = num(p.len, 70), ph = r.range(0, 6.28), pts: Vec2[] = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = 6.283 * 3 * t + ph; pts.push(held ? [3.5 * Math.sin(a) + 2 * Math.cos(a * 0.5), t * 40] : [-len / 2 + len * t + 5 * Math.cos(a), -(4.2 + 3.4 * Math.sin(a))]); }
    return one("yarn", [R(pts, c, 0.7)], 6, held, {}, 0.2);
  }
  if (kind === "needles") {
    const nc = col(kit, p.needles, r.pick([STEEL, "#D9B27A", "#E58FA0", "#8DB8DA"]));
    return one("yarn", [...needle([-9, -33], [8, 0], nc), ...needle([9, -33], [-8, 0], nc)], 8, held, {}, 0.25);
  }
  if (kind === "knitting") {
    const rows = Math.max(1, Math.min(60, num(p.rows, 10))), h = rows * 2.4, cs = Array.isArray(p.colors) && p.colors.length ? p.colors.map(v => col(kit, v, c)) : [c], nc = r.pick([STEEL, "#D9B27A", "#E58FA0"]);
    const sh = [...needle([-16, -h - 3], [17, -h - 1.4], nc), ...knitted(0, -h - 2, 24, h, cs), ...needle([-11, -h + 6], [15, -h - 15], nc)];
    if (held) return one("yarn", mv([...sh, R([[12, -h - 1], [16, -h + 8], [13, -h + 20], [17, -h + 28]], cs[0], 0.5)], 0, h + 2), 6, true, {}, 0.3);
    return one("yarn", [R([[12, -h - 1], [17, -h + 8], [18, -6], [24, -5]], cs[0], 0.5), ...sh, ...yball(26, 0, 6, cs[0], false)], 6, false, {}, 0.3);
  }
  if (kind === "basket") {
    const one1 = (x: number): Shape[] => {
      const o = smooth([[x - 18, -17, 0], [x + 18, -17, 0], [x + 15, 0, 0], [x - 15, 0, 0]], true, 1), wk = "#C49A5E", sh: Shape[] = [R([[x - 15, -17], [x - 12, -33], [x, -39], [x + 12, -33], [x + 15, -17]], tone(wk, "shade"), 1.8)];
      for (const [bx, by, br] of [[-10, -14, 6.2], [1, -15, 6.6], [11, -14, 6], [-5, -22, 5.6], [6, -23, 5.8]]) sh.push(...yball(x + bx + r.range(-1, 1), by, br, r.pick(WOOL), false));
      sh.push(...needle([x + 2, -36], [x + 7, -20], STEEL), ...needle([x + 8, -37], [x + 6, -20], STEEL));
      sh.push(S(o, wk), tiled(o, { w: 4, h: 3, shapes: [S(rect(0, 0, 2, 1.5), tone(wk, "shade")), S(rect(2, 1.5, 2, 1.5), tone(wk, "shade"))] }, 0.55), ...lit(o, wk, x - 18, x + 18, -17, 0), S(rrect(x - 19, -19, 38, 3.4, 1.7), tone(wk, "light")));
      return sh;
    };
    return held ? one("yarn", mv(one1(0), 0, 39), 4, true) : one("yarn", row(n, 40, 5, one1), 4, false);
  }
  const sh = [...yball(-14, 0, 6, wool(1)), ...yball(15, 0, 4.8, wool(2), false)], sk = smooth([[-8, -1.5, 0], [-7, -6], [0, -8], [9, -6.5], [12, -1.5, 0], [2, -0.3]], true, 1);
  sh.push(S(sk, c), ...[0, 1, 2, 3].map(k => L([[-7, -2 - k * 1.3], [0, -3.5 - k * 1.2], [11, -2 - k * 1.1]], k % 2 ? tone(c, "shade") : tone(c, "light"), 0.35, 0.8)), S(ellipse(2, -4.2, 1.6, 4.2), tone(c, "shade")));
  return one("yarn", held ? sh.map(s => ({ ...s, path: s.path })) : sh, 6, held, {}, 0.3);
}, variants: { ball: { kind: "ball" }, basket: { kind: "basket" }, strand: { kind: "strand" }, knitting: { kind: "knitting" }, needles: { kind: "needles" } },
  meta: {
    about: "Yarn: a skein and balls, a ball, a basket of balls and needles, a loose strand, knitting on the needles, or needles.",
    params: {
      kind: { type: "enum", values: ["pile", "ball", "basket", "strand", "knitting", "needles"], default: "pile" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "balls or baskets side by side" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
      len: { type: "num", default: 70, about: "strand: length, cm" },
      rows: { type: "int", min: 1, max: 60, default: 10, about: "knitting: how long the piece is" },
      colors: { type: "list", about: "knitting: its stripes' colours" },
      needles: { type: "color", about: "needles: their colour; default seeded" },
    },
    terms: ["b1-w-yun", "a2-w-orgu"],
    tags: ["cloth"],
  } };

// ---- flowers -------------------------------------------------------------------------------------------

/** A flower head of size `s` at (x, y), `kind` rose, tulip, geranium or daisy, in `c`. */
function bloom(kind: string, x: number, y: number, s: number, c: string): Shape[] {
  if (kind === "tulip") return [P([[x - s * 0.42, y - s * 0.1], [x - s * 0.5, y - s * 0.78, 0], [x - s * 0.2, y - s * 0.55], [x, y - s * 0.9, 0], [x + s * 0.2, y - s * 0.55], [x + s * 0.5, y - s * 0.78, 0], [x + s * 0.42, y - s * 0.1], [x, y + s * 0.14]], c), F(smooth([[x - s * 0.1, y - s * 0.62], [x, y - s * 0.9], [x + s * 0.12, y - s * 0.6], [x, y + s * 0.05]], true, 1), tone(c, "light"), 0.5), L([[x + s * 0.25, y - s * 0.45], [x + s * 0.3, y]], tone(c, "shade"), s * 0.06, 0.6)];
  if (kind === "geranium") return [[-0.42, 0], [0.42, 0.02], [0, -0.06], [-0.24, -0.36], [0.26, -0.34], [0.02, -0.56], [-0.5, -0.3], [0.5, -0.28]].flatMap(([dx, dy], i) => [S(ellipse(x + dx * s, y + dy * s, s * 0.25), i % 3 ? c : tone(c, "light")), F(ellipse(x + dx * s, y + dy * s, s * 0.06), tone(c, "deep"), 0.7)]);
  if (kind === "daisy") return [...Array.from({ length: 8 }, (_, i) => S(ellipse(0, -s * 0.3, s * 0.12, s * 0.28).transform(mul(translate(x, y), rotate(i * 0.785))), "#F7F3EA")), S(ellipse(x, y, s * 0.17), "#F2C230")];
  return [S(ellipse(x - s * 0.26, y + s * 0.08, s * 0.3, s * 0.24), tone(c, "shade")), S(ellipse(x + s * 0.26, y + s * 0.08, s * 0.3, s * 0.24), tone(c, "shade")), S(ellipse(x, y, s * 0.42, s * 0.38), c),
    L([[x - s * 0.18, y + s * 0.05], [x - s * 0.1, y - s * 0.2], [x + s * 0.12, y - s * 0.18], [x + s * 0.14, y + s * 0.04]], tone(c, "deep"), s * 0.06, 0.6), L([[x - s * 0.04, y + s * 0.14], [x + s * 0.06, y - s * 0.05]], tone(c, "deep"), s * 0.05, 0.5), F(ellipse(x - s * 0.12, y - s * 0.22, s * 0.16, s * 0.08), tone(c, "light"), 0.6)];
}
/** A pointed leaf `l` long from (x, y) at angle `a`; a round geranium leaf when `round`. */
const leaf = (x: number, y: number, l: number, a: number, c = LEAF, round = false): Shape[] => round
  ? [S(ellipse(x, y, l, l * 0.82), c), { path: ellipse(x, y, l * 0.62, l * 0.5).add(ellipse(x, y, l * 0.42, l * 0.33)), fill: tone(c, "deep"), flat: true, opacity: 0.35, evenodd: true }]
  : T([P([[0, 0, 0], [l * 0.5, -l * 0.2], [l, 0, 0], [l * 0.5, l * 0.16]], c), L([[l * 0.1, 0], [l * 0.85, -0.05]], tone(c, "light"), l * 0.04, 0.5)], mul(translate(x, y), rotate(a)));
/** A bunch: `m` flowers of `kind` on stems from (x, y0), heads spread `w` wide between y1 and y1 − `h`, with leaves. */
function bunch(r: Rng, kind: string, m: number, x: number, y0: number, y1: number, w: number, h: number, c: string, s: number, mixed = false): Shape[] {
  const stems: Shape[] = [], heads: Shape[] = [], round = kind === "geranium";
  for (let i = 0; i < m; i++) {
    const t = m > 1 ? i / (m - 1) : 0.5, hx = x + (t - 0.5) * w + r.range(-1.5, 1.5), hy = y1 - h * (1 - Math.abs(t - 0.5) * 1.4) * r.range(0.7, 1), k = mixed ? r.pick(["rose", "tulip", "daisy", "rose"]) : kind;
    stems.push(R([[x + (t - 0.5) * w * 0.25, y0], [hx, hy + s * 0.3]], LEAF, Math.max(0.5, s * 0.08)));
    if (r.chance(round ? 0.9 : 0.5)) stems.push(...leaf(hx + (round ? r.range(-s, s) : 0), round ? y1 + r.range(-2, 4) : hy + s * 1.2, round ? s * r.range(0.6, 0.85) : s * 1.2, t < 0.5 ? -2.3 : -0.8, round ? "#5E9A55" : LEAF, round));
    heads.push(...bloom(k, hx, hy, s, mixed && k !== "daisy" ? r.pick([c, "#E8799A", "#F2C230", "#F6F1E4", "#C8283A"]) : c));
  }
  return [...stems, ...heads];
}

/**
 * Flowers, `kind`: `vase` (mixed flowers in a glass vase, the default), `bouquet` (wrapped in paper with a
 * ribbon; held by its wrap), `pot` (a terracotta pot of red geraniums; `n` side by side), `bucket` (a
 * florist's zinc bucket of `flower` roses or tulips in `color`, `n` side by side, each with a card saying
 * its colour: `labels`, else the colour's Turkish name when `color` is one) or `window_box` (a box of
 * geraniums `w` cm long on a stone sill: a perch). `color` is the flowers': a Turkish colour name
 * (kırmızı, sarı, pembe, beyaz, mor, turuncu…), a palette id or a hex.
 */
const flowers: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "vase"), held = !!p.held, n = cnt(p.n, 1), cname = typeof p.color === "string" ? p.color : "", c = col(kit, p.color, kind === "vase" || kind === "bouquet" ? "#E8799A" : "#C8283A");
  if (kind === "bucket") {
    const fl = str(p.flower, "rose"), names = Object.keys(TR).filter(k => k !== "siyah" && k !== "mavi" && k !== "yeşil"), labels = Array.isArray(p.labels) ? p.labels : [], text: TextSpec[] = [], sh: Shape[] = [];
    row(n, 34, 4, (x, i) => {
      const nm = i === 0 ? cname : names[(names.indexOf(cname) + 1 + i * 2 + names.length) % names.length], fc = i === 0 ? c : TR[nm], o = smooth([[x - 15, -30, 0], [x + 15, -30, 0], [x + 12, 0, 0], [x - 12, 0, 0]], true, 1);
      sh.push(...bunch(r, fl, 11, x, -24, -42, 30, 18, fc, fl === "tulip" ? 6 : 6.5), ...[-1, 1].map(d => R([[x + d * 14.5, -26], [x + d * 17.5, -24], [x + d * 13.6, -20]], "#8E979E", 1)));
      sh.push(S(o, "#AEB8C0"), ...lit(o, "#AEB8C0", x - 15, x + 15, -30, 0, 0.18), S(rrect(x - 15.6, -31, 31.2, 2.6, 1.2), "#C3CBD1"), F(rect(x - 14, -12, 28, 1.6), "#8E979E", 0.6, o), F(rect(x - 14, -23, 28, 1.6), "#8E979E", 0.6, o), S(rrect(x - 7, -20, 14, 8.5, 0.8), "#FBF7EE"), F(rect(x - 1.5, -21, 3, 2), "#C9A06A", 0.9));
      const t = typeof labels[i] === "string" ? labels[i] as string : i === 0 ? (TR[cname] ? cname : "") : nm;
      if (t.trim()) text.push({ text: t, x: x - 6.3, y: -18.8, w: 12.6, h: 6.2, size: 3, font: "hand" });
      return [];
    });
    return one("flowers", sh, held ? 5 : 3, held, text.length ? { text } : {});
  }
  if (kind === "window_box") {
    const w = num(p.w, 90), o = rrect(-w / 2, -24, w, 18, 1.5), bc = r.pick(["#4E7A68", "#B8562F", "#6B4A35", "#3E6B8A"]), sh: Shape[] = [];
    for (let i = 0; i < w / 8; i++) sh.push(...leaf(-w / 2 + 5 + i * 8 + r.range(-2, 2), -27 + r.range(-4, 2), r.range(4.5, 6), 0, i % 2 ? "#5E9A55" : "#4E8A48", true));
    sh.push(...bunch(r, "geranium", Math.round(w / 10), 0, -22, -34, w - 12, 14, c, 8));
    sh.push(S(o, bc), ...lit(o, bc, -w / 2, w / 2, -24, -6, 0.12), S(rect(-w / 2 - 1, -25, w + 2, 2.6), tone(bc, "light")), F(rect(-w / 2, -10, w, 1.4), tone(bc, "deep"), 0.4));
    for (let i = 0; i < 4; i++) sh.push(...leaf(-w * 0.36 + i * w * 0.24 + r.range(-4, 4), -24.5, 4.2, 0, "#4E8A48", true));
    sh.push(S(rect(-w / 2 - 7, -6, w + 14, 6), "#D8CFBF"), F(rect(-w / 2 - 7, -1.6, w + 14, 1.6), "#A99F8E", 0.7));
    return one("flowers", sh, 3, held);
  }
  if (kind === "pot") {
    const pot1 = (x: number): Shape[] => { const o = smooth([[x - 10, -16, 0], [x + 10, -16, 0], [x + 7.5, 0, 0], [x - 7.5, 0, 0]], true, 1); return [...bunch(r, "geranium", 4, x, -16, -28, 18, 12, c, 6.5), ...leaf(x - 8, -18, 5, 0, "#5E9A55", true), ...leaf(x + 7, -19, 5.4, 0, "#5E9A55", true), ...leaf(x - 1, -20, 5, 0, "#4E8A48", true), S(o, "#B8562F"), ...lit(o, "#B8562F", x - 10, x + 10, -16, 0), S(rrect(x - 11, -20, 22, 5, 1), "#C4683E")]; };
    return one("flowers", row(n, 24, 3, pot1), held ? 5 : 3, held);
  }
  if (kind === "bouquet") {
    const wrap = r.pick(["#E9D9B8", "#F4E4E8", "#DCE8DE"]), back = smooth([[-3, -6, 0], [3, -6, 0], [17, -34, 0], [10, -38], [-10, -38], [-17, -34, 0]], true, 1), front = smooth([[-3.5, 0, 0], [3.5, 0, 0], [14, -26, 0], [5, -22], [-5, -24], [-14, -27, 0]], true, 1);
    const sh = [S(back, tone(wrap, "shade")), ...bunch(r, "rose", 7, 0, -10, -36, 20, 14, c, 7, true), ...leaf(-12, -34, 9, -2.6), ...leaf(11, -35, 9, -0.6), S(front, wrap), ...lit(front, wrap, -14, 14, -27, 0), L([[-2, -1], [-9, -25]], tone(wrap, "shade"), 0.5, 0.6), S(rrect(-5, -11, 10, 3, 1.5), "#C8283A"), S(smooth([[0, -9.5], [-5, -13], [-6, -8]], true, 1), "#C8283A"), S(smooth([[0, -9.5], [5, -13], [6, -8]], true, 1), "#C8283A")];
    return one("flowers", held ? mv(sh, 0, 9.5) : sh, held ? 5 : 3, held);
  }
  const o = smooth([[-5, 0, 0], [5, 0, 0], [6.5, -10], [4, -19], [5, -23, 0], [-5, -23, 0], [-4, -19], [-6.5, -10]], true, 1);
  return one("flowers", [...bunch(r, "rose", 6, 0, -14, -40, 22, 14, c, 7, true), ...leaf(-6, -26, 8, -2.5), ...leaf(5, -27, 8, -0.7), S(o, "#CFE6EE", { opacity: 0.55 }), F(rect(-7, -15, 14, 15), "#9CC8D8", 0.35, o), L([[-3, -4], [-3.5, -18]], "#FFFFFF", 0.8, 0.6)], held ? 5 : 3, held);
}, variants: { bouquet: { kind: "bouquet" }, pot: { kind: "pot", color: "kırmızı" }, bucket: { kind: "bucket", flower: "rose", color: "kırmızı" }, window_box: { kind: "window_box", color: "kırmızı" } },
  meta: {
    about: "Flowers: a vase, a wrapped bouquet, a pot of geraniums, a florist's bucket of roses or tulips, or a window box.",
    params: {
      kind: { type: "enum", values: ["vase", "bouquet", "pot", "bucket", "window_box"], default: "vase" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "pots or buckets side by side" },
      color: { type: "color", about: "the flowers': a Turkish colour name (kırmızı, sarı…), a palette id or a hex" },
      flower: { type: "enum", values: ["rose", "tulip", "daisy", "geranium"], default: "rose", about: "bucket: which flowers" },
      labels: { type: "list", about: "bucket: each card's words; default the colour's Turkish name" },
      w: { type: "num", default: 90, about: "window_box: length, cm" },
    },
    terms: ["a1-w-cicek"],
    tags: ["plant"],
  } };

// ---- machines -----------------------------------------------------------------------------------------------

/** A screen's words: `screen`, else `label`. */
const words = (a: unknown, b: unknown) => (typeof a === "string" ? a : typeof b === "string" ? b : "").trim();
/** A display's words laid over the box x, y, w, h. */
const disp = (t: string, x: number, y: number, w: number, h: number, color: string, size?: number): TextSpec[] => t ? [{ text: t, x, y, w, h, font: "screen", color, lit: 0, ...(size ? { size } : {}) }] : [];

/** A desk phone's handset lying in its cradle, centred at (0, y). */
const handset = (c: string, y: number): Shape => P([[-11, y + 2], [-10.4, y - 1.6], [-7, y - 2.2, 0], [7, y - 2.2, 0], [10.4, y - 1.6], [11, y + 2], [8, y + 1.6, 0], [6.5, y], [-6.5, y], [-8, y + 1.6, 0]], c);
/** A coiled cord from (x, y) down `h` cm. */
const coil = (x: number, y: number, h: number, c: string): Shape => R(Array.from({ length: 49 }, (_, i) => [x + 1.1 * Math.cos(i * 0.785) - (i / 48) * 1.5, y + (i / 48) * h + 0.7 * Math.sin(i * 0.785)] as Vec2), c, 0.35);

/**
 * A machine, `kind`: `tv` (a flat-screen TV on its stand, `on` shows a picture that glows at night), `computer`
 * (a desktop monitor, its keyboard and mouse in front, the screen on), `desk_phone` (an office phone, its
 * handset on the cradle; `ringing` rattles the handset and draws ring marks; held, the handset alone, its cord
 * hanging), `radio` (a car radio in its slot in the dashboard), `taxi_meter` (a taxi meter, red digits) or
 * `till` (a shop till with a customer display). The words on a screen or display are `screen` (else `label`;
 * the till defaults to "385 TL", the meter to "48,50"); screens and displays glow at night. `color` is the
 * body's (phone, till).
 */
const device: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "tv"), held = !!p.held, say = words(p.screen, p.label);
  if (kind === "computer") {
    const sc = rect(-24, -42, 48, 27), sh: Shape[] = [S(rrect(-8, -2, 16, 2, 1), "#3A3D45"), S(rect(-2, -12, 4, 10), "#4B5058"), S(rrect(-26, -44, 52, 31, 1.4), "#26272C"), S(sc, "#2C6E8E")];
    sh.push(F(poly([[-24, -15], [24, -32], [24, -15]]), "#3E8DAE", 0.8, sc), F(rect(-24, -17, 48, 2), "#1E2B4A", 0.7), F(rrect(-18, -38, 20, 13, 0.6), "#F4F1EA", 0.9), F(rect(-18, -38, 20, 2), "#4F6E9E", 0.9), F(rrect(-2, -32, 18, 11, 0.6), "#F4F1EA", 0.85), F(rect(-2, -32, 18, 2), "#C4553A", 0.9), S(ellipse(0, -14, 0.5), "#7FE3C0"));
    const kb: Shape[] = [P([[-23, 0, 0], [23, 0, 0], [21, -4, 0], [-21, -4, 0]], "#D8D4CC"), ...[0, 1, 2].flatMap(j => Array.from({ length: 13 - j }, (_, i) => F(rrect(-19.5 + j * 0.8 + i * 3.1, -3.4 + j * 1.1, 2.6, 0.8, 0.2), "#9AA0A6", 0.9))), S(ellipse(29, -1.4, 2.4, 1.5), "#D8D4CC")];
    return { flats: [{ group: { shapes: sh, edge: 0.35 }, ppcm: 4, id: "device", emissive: { shapes: [F(sc, "#BFE3F2", 0.45)], edge: 0 }, ...(held ? {} : { shadow: "drop" as const }), ...(say ? { text: disp(say, -22, -40, 44, 21, "#F4F1EA") } : {}) }, { group: { shapes: kb, edge: 0.3 }, ppcm: 4, z: 14 }] };
  }
  if (kind === "desk_phone") {
    const c = col(kit, p.color, r.pick(["#E9E1CF", "#2A2B30", "#3A3D45"])), dk = mix(c, "#1E1F23", 0.6), kp: Shape[] = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) kp.push(F(rrect(0.6 + i * 2.6, -7.4 + j * 1.6, 2, 1.1, 0.3), mix(c, "#FFFFFF", 0.5), 0.95));
    if (held) return one("device", [coil(0, 10, 16, dk), ...T([handset(dk, 0)], rotate(Math.PI / 2))], 8, true, {}, 0.3);
    const base = [coil(-11.5, -10, 7.5, dk), P([[-12.5, 0, 0], [12.5, 0, 0], [10.5, -9.6, 0], [-10.5, -9.6, 0]], c), F(rect(-12.5, -9.6, 26, 2), tone(c, "shade"), 0.5, poly([[-12.5, 0], [12.5, 0], [10.5, -9.6], [-10.5, -9.6]])), S(rrect(0, -8, 8.6, 7, 0.8), dk), ...kp, S(rrect(-9.4, -7.4, 7.6, 2.8, 0.5), "#A9C4A0"), ...[0, 1, 2].map(i => S(rrect(-9.2 + i * 2.6, -3.6, 2, 1, 0.3), dk))];
    if (!p.ringing) return one("device", [...base, handset(dk, -10.6)], 8, false, {}, 0.3);
    const marks = [-1, 1].flatMap(d => [R([[d * 13.5, -11], [d * 15, -13.5], [d * 13.8, -16]], "#3B3B40", 0.4), R([[d * 16, -10.5], [d * 17.8, -13.6], [d * 16.4, -17]], "#3B3B40", 0.4)]);
    return { flats: [{ group: { shapes: base, edge: 0.3 }, ppcm: 8, id: "device", shadow: "drop" }, { group: { shapes: [handset(dk, -2.2)], edge: 0.3 }, ppcm: 8, y: 8.4, z: 0.3, move: { sway: { rot: 0.07, dy: 0.5, ms: 320 } } }, { group: { shapes: marks, edge: 0 }, ppcm: 8, z: 0.4, move: { blink: { ms: 640, on: 0.55 } } }] };
  }
  if (kind === "radio") {
    const win = rrect(-6, -10, 12, 3.4, 0.6), sh: Shape[] = [S(rrect(-18, -16, 36, 16, 2), "#3A3D45"), ...[0, 1, 2].map(i => F(rect(-15, -14.6 + i * 1.1, 30, 0.45), "#26272C", 0.8)), S(rrect(-14, -11, 28, 8.6, 1), "#1E1F23"), S(win, "#123029")];
    for (const d of [-1, 1]) sh.push(S(ellipse(d * 10.5, -6.8, 2.2), "#4B5058"), F(rect(d * 10.5 - 0.15, -8.8, 0.3, 1.4), "#D8D4CC", 0.9));
    for (let i = 0; i < 6; i++) sh.push(S(rrect(-6 + i * 2.05, -5.6, 1.6, 1.3, 0.3), "#8E959C"));
    return one("device", sh, 10, held, { emissive: { shapes: [F(win, "#7FE3C0", 0.8)], edge: 0 }, ...(say ? { text: disp(say, -5.6, -9.8, 11.2, 3, "#9FF0C8") } : {}) }, 0.25);
  }
  if (kind === "taxi_meter") {
    const win = rrect(-7.5, -8.6, 11, 3.8, 0.5), t = say || "48,50", sh: Shape[] = [S(rect(-2, -1.6, 4, 1.6), "#3B3B40"), S(rrect(-9, -10, 18, 8.6, 1.2), "#1E1F23"), S(win, "#2A0A0A"), F(rect(-8, -3.6, 16, 0.8), "#3A3D45")];
    ["#C8283A", "#3E8E4E", "#8E959C"].forEach((bc, i) => sh.push(S(ellipse(5.6, -8 + i * 2.1, 0.8), bc)));
    return one("device", sh, 12, held, { emissive: { shapes: [F(win, "#FF4A3A", 0.75)], edge: 0 }, text: disp(t, -7.2, -8.3, 10.4, 3.2, "#FF3B30") }, 0.2);
  }
  if (kind === "till") {
    const c = col(kit, p.color, r.pick(["#E9E4DA", "#3A3D45"])), win = rrect(7.4, -42.4, 15.2, 5.4, 0.6), t = say || "385 TL", keys: Shape[] = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) keys.push(F(rrect(-13 + i * 3.8 + j * 0.6, -22.4 + j * 2.6, 3, 1.8, 0.4), j === 2 && i > 3 ? (i === 4 ? "#C8283A" : "#3E8E4E") : mix(c, "#9AA0A6", 0.6), 0.95));
    const sh: Shape[] = [
      S(rrect(-18, -29, 12, 6, 1), mix(c, "#26272C", 0.4)), P([[-16, -28.6], [-15, -34], [-11, -36], [-9, -33], [-9.5, -28.6, 0]], "#FBF8F2"),
      S(rect(13.2, -36, 2.2, 14), "#4B5058"), S(rrect(6, -44, 18, 8.4, 1), "#1F2A2A"), S(win, "#0E2A22"),
      S(rrect(-21, -14, 42, 14, 1.5), c), ...lit(rrect(-21, -14, 42, 14, 1.5), c, -21, 21, -14, 0), S(rect(-19, -8, 38, 6.4), tone(c, "shade")), S(rrect(-3, -5.6, 6, 1.4, 0.7), mix(c, "#26272C", 0.6)), S(ellipse(14, -4.9, 0.7), BRASS),
      P([[-20, -14, 0], [19, -14, 0], [15, -25, 0], [-16, -25, 0]], tone(c, "light")), ...keys,
    ];
    return one("device", sh, 6, held, { emissive: { shapes: [F(win, "#7FF5C8", 0.75)], edge: 0 }, text: disp(t, 8, -42, 14, 4.6, "#9FF5D0") }, 0.3);
  }
  // tv
  const on = !!p.on, sc = rect(-46, -62, 92, 49), sh: Shape[] = [S(rrect(-18, -2.6, 36, 2.6, 1.2), "#26272C"), S(rect(-3, -10, 6, 8), "#3A3D45"), S(rrect(-48, -64, 96, 55, 1.5), "#1E1F23"), S(sc, on ? "#7FB2D9" : "#2A3038"), S(ellipse(40, -11, 0.5), on ? "#7FE3C0" : "#C8283A")];
  if (on) sh.push(F(poly([[-46, -30], [-10, -44], [20, -36], [46, -46], [46, -13], [-46, -13]]), "#5E9A55", 1, sc), F(rect(-46, -24, 92, 11), "#3F74C4", 1, sc), F(ellipse(26, -50, 5), "#FFF1C2", 1, sc));
  sh.push(F(poly([[-30, -62], [-14, -62], [-40, -13], [-46, -13], [-46, -40]]), "#FFFFFF", on ? 0.1 : 0.07, sc));
  return one("device", sh, 3, held, { ...(on ? { emissive: { shapes: [F(sc, "#CFE6F7", 0.5)], edge: 0 } } : {}), ...(say ? { text: disp(say, -44, -60, 88, 45, "#F4F1EA") } : {}) }, 0.5);
}, variants: { tv: { kind: "tv" }, computer: { kind: "computer" }, desk_phone: { kind: "desk_phone" }, radio: { kind: "radio" }, taxi_meter: { kind: "taxi_meter" }, till: { kind: "till" } },
  meta: {
    about: "A machine: a TV, a desktop computer, an office phone, a car radio, a taxi meter or a shop till, their screens glowing.",
    params: {
      kind: { type: "enum", values: ["tv", "computer", "desk_phone", "radio", "taxi_meter", "till"], default: "tv" },
      screen: { type: "text", about: "the words on its screen or display (till default \"385 TL\", meter \"48,50\")" },
      label: { type: "text", about: "the same as screen, when screen is not given" },
      on: { type: "bool", default: false, about: "tv: shows a picture" },
      ringing: { type: "bool", default: false, about: "desk_phone: the handset rattles" },
      color: { type: "color", about: "the body's (desk_phone, till); default seeded" },
    },
    terms: ["a1-w-televizyon", "a1-w-bilgisayar", "a1-w-telefon", "a1-w-radyo"],
    tags: ["machine"],
  } };

// ---- small things ---------------------------------------------------------------------------------------

/** A key `l` long hanging from its bow at (x, y) (blade down), turned by `a`: the bow and its hole, the blade, its bit and a groove. */
function keyAt(x: number, y: number, l: number, c: string, a = 0): Shape[] {
  const b = l * 0.2, bit: Vec2[] = [[l * 0.06, l], [-l * 0.06, l], [-l * 0.06, b * 0.8], [l * 0.06, b * 0.8], [l * 0.06, l * 0.55], [l * 0.17, l * 0.6], [l * 0.13, l * 0.68], [l * 0.17, l * 0.76], [l * 0.12, l * 0.84], [l * 0.17, l * 0.92], [l * 0.06, l * 0.96]];
  return T([{ path: ellipse(0, 0, b, b * 0.92).add(ellipse(0, -b * 0.3, b * 0.32)), fill: c, evenodd: true }, S(poly(bit), c), F(rect(-l * 0.015, b * 1.1, l * 0.03, l * 0.8), tone(c, "shade"), 0.6), F(ellipse(-b * 0.4, b * 0.2, b * 0.25, b * 0.15), tone(c, "light"), 0.6)], mul(translate(x, y), rotate(a)));
}
/** A paper tag hanging on a string from (x, y): its words go in its box. */
const tagAt = (x: number, y: number): Shape[] => [R([[x, y], [x + 1.2, y + 2.6]], "#8E959C", 0.15), S(rrect(x - 0.6, y + 2.2, 3.8, 5.8, 0.5), "#F3E7C9"), F(ellipse(x + 1.3, y + 3.1, 0.45), "#C9A06A", 0.9)];

/**
 * A key, `kind`: `key` (one key lying on its side, the default; `n` side by side), `keys` (`n` keys, default
 * three, each with a paper tag on a string: `labels` are the tags' words) or `ring` (a key ring with `n` keys,
 * default five, and a leather fob). Held, they hang from the hand by their bows or the ring; one key is held
 * up, its blade out of the fist.
 */
const key: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "key"), held = !!p.held, metal = () => r.pick([BRASS, "#C3C8CE", "#C9A23A", "#AEB6BC"]);
  if (kind === "ring") {
    const n = cnt(p.n, 5), fob = r.pick(["#6B4A35", "#A23F28", "#26272C", "#2E3A59"]), sh: Shape[] = [{ path: ellipse(0, -2.4, 2.4).add(ellipse(0, -2.4, 1.9)), fill: "#AEB6BC", evenodd: true }];
    const ks = Array.from({ length: n }, (_, i) => ({ c: metal(), l: r.range(5.5, 7.5), a: held ? (i - (n - 1) / 2) * 0.32 : -1.3 + (i / Math.max(1, n - 1)) * 2.6 }));
    sh.unshift(...T([S(rrect(-1.6, 1.8, 3.2, 6, 1.2), fob), F(rect(-1.2, 2.6, 2.4, 0.3), tone(fob, "light"), 0.6), S(ellipse(0, 1.6, 0.9), "#AEB6BC")], rotate(held ? 0.9 : 2.2)).map(s => ({ ...s, path: s.path.move(0, -2.4) })));
    for (const k of ks) sh.push(...keyAt(Math.sin(-k.a) * 2.4, -2.4 + Math.cos(k.a) * 2.4, k.l, k.c, -k.a));
    return one("key", held ? mv(sh, 0, 2.4 - 2.4) : mv(sh, 0, -6), 12, held, {}, 0.12);
  }
  if (kind === "keys") {
    const n = cnt(p.n, 3), labels = Array.isArray(p.labels) ? p.labels : [], sh: Shape[] = [], text: TextSpec[] = [];
    for (let i = 0; i < n; i++) {
      const x = held ? (i - (n - 1) / 2) * 2.2 : (i - (n - 1) / 2) * 7, a = held ? (i - (n - 1) / 2) * 0.25 : 0, k = keyAt(x, held ? 1 : -14, 6.5, metal(), -a), tx = x + 1.6 + (held ? Math.sin(a) * -1 : 0), ty = held ? 3 : -13.5;
      sh.push(...tagAt(tx, ty), ...k);
      const t = labels[i];
      if (typeof t === "string" && t.trim()) text.push({ text: t, x: tx - 0.4, y: ty + 3.9, w: 3.4, h: 3.8, size: 0.9, font: "hand" });
    }
    return one("key", sh, 12, held, text.length ? { text } : {}, 0.12);
  }
  const n = cnt(p.n, 1);
  if (held) return one("key", keyAt(0, 0, 7, metal(), Math.PI), 12, true, {}, 0.12);
  return one("key", row(n, 7.5, 1, x => keyAt(x - 3.4, -1.6, 7, metal(), -Math.PI / 2)), 12, false, {}, 0.12);
}, variants: { keys: { kind: "keys" }, ring: { kind: "ring" } },
  meta: {
    about: "Keys: one lying on its side, keys with paper tags on strings, or a key ring with a leather fob.",
    params: {
      kind: { type: "enum", values: ["key", "keys", "ring"], default: "key" },
      n: { type: "int", min: 1, max: 24, about: "how many keys (key 1, keys 3, ring 5 by default)" },
      labels: { type: "list", about: "keys: the tags' words" },
    },
    terms: ["a1-w-anahtar"],
  } };

/** A wristwatch lying face up (its strap up and down) showing `time` ("hh:mm", default "10:10") with real hands; `color` is the strap's. Held, it is shown face out. */
const watch: PieceDef = { draw(p, r, kit) {
  const [hh, mm] = str(p.time, "10:10").split(":").map(Number), c = col(kit, p.color, r.pick(["#6B4A35", "#2A2B30", "#8A5A3C", "#2E3A59"])), m = r.pick([BRASS, "#C3C8CE"]), cy = -9.4, R0 = 2;
  const ang = (v: number) => -Math.PI / 2 + v * Math.PI * 2, hand = (a: number, len: number, w: number): Shape => ({ path: poly([[Math.cos(a - 1.5708) * w, cy + Math.sin(a - 1.5708) * w], [Math.cos(a) * len, cy + Math.sin(a) * len], [Math.cos(a + 1.5708) * w, cy + Math.sin(a + 1.5708) * w]]), fill: "#2B2420", flat: true });
  const sh: Shape[] = [S(rrect(-0.95, -18.4, 1.9, 8, 0.6), c), S(rrect(-0.95, cy + 1, 1.9, 8.4, 0.6), c), ...[0, 1, 2].map(i => F(ellipse(0, -16.4 + i * 1.3, 0.2), tone(c, "deep"))), S(rrect(-1.25, -1.6, 2.5, 1.6, 0.4), m), F(rect(-0.8, -1.2, 1.6, 0.7), c), S(rect(R0 - 0.1, cy - 0.35, 0.6, 0.7), m), S(ellipse(0, cy, R0 + 0.3), m), S(ellipse(0, cy, R0), "#FBF7EE")];
  for (let i = 0; i < 12; i++) { const t = ang(i / 12); sh.push(L([[Math.cos(t) * R0 * 0.78, cy + Math.sin(t) * R0 * 0.78], [Math.cos(t) * R0 * 0.92, cy + Math.sin(t) * R0 * 0.92]], "#2B2420", i % 3 ? 0.06 : 0.14, 1)); }
  sh.push(hand(ang((((hh || 0) % 12) + (mm || 0) / 60) / 12), R0 * 0.5, 0.12), hand(ang((mm || 0) / 60), R0 * 0.8, 0.08), S(ellipse(0, cy, 0.15), "#B3261E"), F(ellipse(-0.7, cy - 0.9, 0.7, 0.35), "#FFFFFF", 0.35));
  return one("watch", sh, 16, !!p.held, {}, 0.08);
}, meta: {
  about: "A wristwatch lying face up with real hands showing a time.",
  params: {
    time: { type: "text", default: "10:10", about: "\"hh:mm\"" },
    color: { type: "color", about: "the strap's; default seeded" },
  },
  terms: ["a1-w-saat"],
} };

/** Florist's scissors standing tips up at (x, 0): short stout blades, the pivot, rubber handles in `c`. */
function scissors(x: number, c: string): Shape[] {
  const half = (d: number, hc: string): Shape[] => [{ path: smooth([[x + d * 0.4, -10.4], [x + d * 4.6, -6.4], [x + d * 5.6, -1.6], [x + d * 3.8, 0, 0], [x + d * 2.2, -2.4], [x + d * 1.2, -7.6]], true, 1).add(ellipse(x + d * 3.7, -2.6, 1.15)), fill: hc, evenodd: true }, P([[x - d * 0.8, -10.6, 0], [x + d * 0.4, -11.8], [x + d * 2.3, -16.2], [x + d * 1.3, -20.6, 0], [x - d * 0.6, -15]], d > 0 ? "#C3C8CE" : "#AEB6BC")];
  return [...half(-1, tone(c, "shade")), ...half(1, c), S(ellipse(x, -11.4, 0.75), "#4B5058"), L([[x - 0.3, -13], [x + 0.6, -19]], "#FFFFFF", 0.25, 0.6)];
}
/** A metal toolbox at (x, 0): the lid with its ridge, a handle on top, two catches, scratches. */
function toolbox(x: number, c: string, r: Rng): Shape[] {
  const o = rect(x - 23, -20, 46, 20), lid = rrect(x - 24, -27, 48, 8, 2);
  const sh = [R([[x - 10, -26], [x - 10, -33], [x + 10, -33], [x + 10, -26]], "#4B5058", 1.4), S(rrect(x - 7, -34.6, 14, 3, 1.4), "#26272C"), S(o, c), ...lit(o, c, x - 23, x + 23, -20, 0), S(lid, tone(c, "light")), F(rect(x - 24, -22.5, 48, 1.2), tone(c, "shade"), 0.6, lid), F(rect(x - 23, -3, 46, 3), tone(c, "deep"), 0.4, o)];
  for (const d of [-1, 1]) sh.push(S(rrect(x + d * 15 - 2, -22, 4, 6, 0.6), STEEL), F(rect(x + d * 15 - 1, -20.4, 2, 1), "#4B5058", 0.8));
  for (let i = 0; i < 3; i++) { const sx = x + r.range(-20, 18), sy = r.range(-17, -5); sh.push(L([[sx, sy], [sx + r.range(2, 5), sy + r.range(-1, 1)]], tone(c, "light"), 0.3, 0.6)); }
  return sh;
}

/** A tool, `kind`: `toolbox` (a painted metal toolbox in `color`, the default; held by its handle) or `scissors` (a florist's stout scissors, handles in `color`; held, tips up out of the fist). `n` side by side. */
const tool: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "toolbox"), held = !!p.held, n = cnt(p.n, 1);
  if (kind === "scissors") { const c = col(kit, p.color, r.pick(["#2F8C88", "#E8892E", "#C8283A", "#3E8E4E"])); return one("tool", held ? scissors(0, c).map(s => ({ ...s, path: s.path.move(0, 4) })) : row(n, 12, 2, x => scissors(x, c)), 12, held, {}, 0.15); }
  const c = col(kit, p.color, r.pick(["#B3261E", "#1F5FC0", "#2E5237", "#D18A1C"]));
  return held ? one("tool", mv(toolbox(0, c, r), 0, 33), 4, true) : one("tool", row(n, 48, 4, x => toolbox(x, c, r)), 4, false);
}, variants: { scissors: { kind: "scissors" }, toolbox: { kind: "toolbox" } },
  meta: {
    about: "A tool: a painted metal toolbox or a florist's stout scissors.",
    params: {
      kind: { type: "enum", values: ["toolbox", "scissors"], default: "toolbox" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
    },
    terms: ["a1-w-makas"],
  } };

/** A toy, `kind`: `ball` (a child's red ball with a white and a yellow band, the default; `color`) or `cat` (a small toy cat, sitting, a ribbon bow, no face; `color`). `n` side by side; held, on the hand. */
const toy: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "ball"), held = !!p.held, n = cnt(p.n, 1);
  if (kind === "cat") {
    const c = col(kit, p.color, r.pick(["#9AA0A6", "#E8A060", "#F4EFE6", "#3A3D45"])), bow = r.pick(["#C8283A", "#2F8C88", "#E58FA0"]);
    return one("toy", row(n, 13, 2, x => [R([[x + 3.5, -1.5], [x + 7.5, -3], [x + 7, -8], [x + 5, -9]], tone(c, "shade"), 1.8), S(ellipse(x, -5.4, 5, 5.4), c), ...[-2.2, 2.2].map(d => S(ellipse(x + d, -0.8, 1.8, 1), tone(c, "light"))), P([[x - 3.6, -14], [x - 3.4, -18.6, 0], [x - 1, -16]], c), P([[x + 3.6, -14], [x + 3.4, -18.6, 0], [x + 1, -16]], c), S(ellipse(x, -12.8, 4.3, 3.9), c), { path: smooth([[x, -9.5], [x, -1.5]], false, 1), stroke: { color: tone(c, "deep"), width: 0.2, dash: [0.6, 0.5] }, flat: true, opacity: 0.8 }, S(smooth([[x, -9], [x - 2.4, -10.6], [x - 2.6, -8]], true, 1), bow), S(smooth([[x, -9], [x + 2.4, -10.6], [x + 2.6, -8]], true, 1), bow)]), 10, held, {}, 0.2);
  }
  const c = col(kit, p.color, "#D9342B");
  return one("toy", row(n, 20, 3, x => { const o = ellipse(x, -10, 10), m = mul(translate(x, -10), rotate(-0.4)); return [S(o, c), F(ellipse(x + 4, -6, 7.5, 7), tone(c, "shade"), 0.35, o), F(rect(-11, -2.4, 22, 4.2).transform(m), "#F7F3EA", 1, o), F(rect(-11, 2.6, 22, 1.2).transform(m), "#F2C230", 1, o), F(ellipse(x - 4.2, -15, 2.4, 1.5), "#FFFFFF", 0.55)]; }), 6, held);
}, variants: { ball: { kind: "ball" }, cat: { kind: "cat" } },
  meta: {
    about: "A toy: a child's banded ball or a small faceless toy cat with a ribbon bow.",
    params: {
      kind: { type: "enum", values: ["ball", "cat"], default: "ball" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
      color: { type: "color", about: "a Turkish colour name, a palette id or a hex; the ball's default red, the cat's seeded" },
    },
    terms: ["a1-w-top", "a2-w-oyuncak"],
    tags: ["toy"],
  } };

/**
 * Balloons on strings, `n` (default 3), in seeded party colours or `colors`, their strings gathered into a
 * knot at the origin; `tied` (default) they sway gently, each on its own beat. Held, the strings come out of the fist.
 */
const balloon: PieceDef = { draw(p, r, kit) {
  const n = cnt(p.n, 3), held = !!p.held, cs = Array.isArray(p.colors) ? p.colors : [], flats: FlatSpec[] = [], all: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const c = col(kit, cs[i % Math.max(1, cs.length)], r.pick(["#D9342B", "#F2C230", "#2F8C88", "#E58FA0", "#1F5FC0", "#7B4FB3", "#EE8A2E", "#3E8E4E"])), t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const x = t * Math.min(70, n * 12) + r.range(-3, 3), y = -96 - (1 - Math.abs(t) * 2) * 18 - r.range(0, 12), o = smooth([[x, y + 16], [x + 11, y + 4], [x + 12, y - 6], [x, y - 17], [x - 12, y - 6], [x - 11, y + 4]], true, 1);
    const sh = [R([[0, 0], [x * 0.4, y * 0.5], [x, y + 17]], "#8E959C", 0.25), P([[x - 1.6, y + 19, 0], [x + 1.6, y + 19, 0], [x, y + 15.6]], tone(c, "shade")), S(o, c), F(ellipse(x + 3.5, y + 3, 8, 11), tone(c, "shade"), 0.3, o), F(ellipse(x - 5, y - 7, 2.2, 3.6), "#FFFFFF", 0.55)];
    all.push(...sh);
    if (!held) flats.push({ group: { shapes: sh, edge: 0.4 }, ppcm: 3, id: "balloon", ...(p.tied !== false ? { move: { sway: { rot: r.range(0.03, 0.07), ms: r.range(2600, 4200) }, phase: r() } } : {}) });
  }
  if (held) return one("balloon", all, 3, true, {}, 0.4);
  flats.push({ group: { shapes: [S(ellipse(0, -0.8, 1.6, 1), "#8E959C"), R([[-1.4, -0.6], [-2.6, 1.4]], "#8E959C", 0.3), R([[1.4, -0.6], [2.4, 1.6]], "#8E959C", 0.3)], edge: 0.2 }, ppcm: 3, z: 0.2 });
  return { flats };
}, meta: {
  about: "Balloons on strings gathered into a knot, swaying gently each on its own beat.",
  params: {
    n: { type: "int", min: 1, max: 24, default: 3, about: "how many" },
    colors: { type: "list", about: "their colours, repeated; default seeded" },
    tied: { type: "bool", default: true, about: "they sway" },
  },
  tags: ["party"],
} };

/** A round desk bell (zil), `kind` desk: a chrome dome on a dark base, the plunger on top. `n` side by side; held, on the palm. */
const bell: PieceDef = { draw(p, r) {
  const n = cnt(p.n, 1), base = r.pick(["#2A2B30", "#6B4A35", "#7A1F35"]);
  return one("bell", row(n, 11, 1.5, x => [S(rect(x - 0.35, -7.6, 0.7, 1.6), "#8E959C"), S(ellipse(x, -7.6, 0.95, 0.55), "#2A2B30"), S(rrect(x - 5.3, -1.3, 10.6, 1.3, 0.6), base), S(smooth([[x - 4.5, -1.2, 0], [x - 4.2, -3.6], [x, -6.3], [x + 4.2, -3.6], [x + 4.5, -1.2, 0]], true, 1), "#C9CED3"), F(ellipse(x + 2.2, -3, 2.6, 2.4), "#8E979E", 0.4, smooth([[x - 4.5, -1.2, 0], [x - 4.2, -3.6], [x, -6.3], [x + 4.2, -3.6], [x + 4.5, -1.2, 0]], true, 1)), F(ellipse(x - 2, -4.4, 1.1, 0.7), "#FFFFFF", 0.8), F(rect(x - 4.4, -1.9, 8.8, 0.5), "#8E979E", 0.6)]), 14, !!p.held, {}, 0.12);
}, variants: { desk: {} },
  meta: {
    about: "A round desk bell (zil): a chrome dome on a dark base, the plunger on top (`desk`, its only look, is a name the briefs use).",
    params: {
      n: { type: "int", min: 1, max: 24, default: 1, about: "how many side by side" },
    },
  } };

/** A Turkish 1 lira coin, bimetallic (a brass ring round a silver middle), seen face on; `n` in a row, a little overlapped. Held, one is shown between the fingers. */
const coin: PieceDef = { draw(p) {
  const n = p.held ? 1 : cnt(p.n, 1);
  return one("coin", row(n, 2.6, -0.5, x => [S(ellipse(x, -1.3, 1.3), "#C9A23A"), S(ellipse(x, -1.3, 0.86), "#C3C8CE"), ...Array.from({ length: 16 }, (_, i) => F(ellipse(x + Math.cos(i * 0.393) * 1.08, -1.3 + Math.sin(i * 0.393) * 1.08, 0.06), tone("#C9A23A", "deep"), 0.7)), { path: ellipse(x, -1.3, 0.62), stroke: { color: "#8E959C", width: 0.05 }, flat: true }, F(ellipse(x - 0.3, -1.65, 0.3, 0.15), "#FFFFFF", 0.5)]), 16, !!p.held, {}, 0.06);
}, meta: {
  about: "Turkish one-lira coins, bimetallic, face on, in a row a little overlapped.",
  params: {
    n: { type: "int", min: 1, max: 24, default: 1, about: "how many in a row (held: one)" },
  },
  terms: ["a1-w-para"],
  tags: ["money"],
} };

/**
 * A big umbrella, `w` cm across (default 130: room for two), in `color` (seeded; some with a second colour
 * in alternate panels). `open` (default) stands it on its hooked handle, the canopy 140 cm above it; closed,
 * it is furled and stands on its tip. Held: open, the canopy over the head; closed, carried by the handle, its tip on the floor.
 */
const umbrella: PieceDef = { draw(p, r, kit) {
  const held = !!p.held, c = col(kit, p.color, r.pick(["#2E3A59", "#C8283A", "#2F8C88", "#3A3D45", "#7B4FB3", "#E0A83A"])), c2 = r.chance(0.35) ? tone(c, "deep") : c, wood = "#7A5034";
  if (p.open === false) {
    const o = smooth([[0, -4, 0], [3.4, -60], [2.2, -80, 0], [-2.2, -80, 0], [-3.4, -60]], true, 1);
    const sh = [R([[0, -80], [0, -88], [-1, -93], [-4.5, -94.5], [-7, -92]], wood, 2.4), S(o, c), ...lit(o, c, -3.4, 3.4, -80, -4, 0.3), L([[-1, -10], [-2, -70]], tone(c, "deep"), 0.4, 0.6), S(rrect(-3.6, -58, 7.2, 2.4, 1), tone(c, "deep")), S(rect(-0.4, -4, 0.8, 4), "#8E959C")];
    return held ? one("umbrella", tilt(sh, [-3, -94], [0, 0], 1), 4, true) : one("umbrella", sh, 4, false);
  }
  const w = Math.max(60, num(p.w, 130)), top = -140 - w * 0.4, rim = -140, m = 6, sh: Shape[] = [R([[0, -2], [0, rim + 4]], "#4B5058", 1.2), R([[0, -10], [0, -1], [-1.4, 2.4], [-4.6, 3], [-6.6, 0.6]], wood, 2.6)];
  const pts: Pt[] = [[-w / 2, rim, 0]];
  for (let i = 0; i < m; i++) { const x = -w / 2 + (i + 0.5) * w / m; pts.push([x, rim - 5], [-w / 2 + (i + 1) * w / m, rim, 0]); }
  pts.push([w * 0.45, rim - w * 0.2], [w * 0.25, top + w * 0.06], [0, top, 0], [-w * 0.25, top + w * 0.06], [-w * 0.45, rim - w * 0.2]);
  const o = smooth(pts, true, 1);
  sh.push(S(o, c));
  for (let i = 0; i < m; i++) {
    const x0 = -w / 2 + i * w / m, x1 = x0 + w / m;
    if (i % 2) sh.push(F(poly([[0, top], [x0, rim + 1], [x1, rim + 1]]), c2 === c ? tone(c, "light") : c2, c2 === c ? 0.3 : 0.6, o));
    if (i < m - 1) sh.push(L([[0, top + 1], [x1 * 0.75, rim - w * 0.17], [x1, rim]], tone(c, "deep"), 0.5, 0.5));
  }
  sh.push(F(rect(w * 0.2, top - 2, w * 0.32, w * 0.36), tone(c, "shade"), 0.4, o), R([[0, top + 1], [0, top - 7]], "#4B5058", 1), S(ellipse(0, top - 7.5, 1), "#4B5058"));
  return one("umbrella", sh, Math.min(3, 1900 / 180), held, {}, 0.5);
}, meta: {
  about: "A big umbrella, open on its hooked handle or furled and standing on its tip.",
  params: {
    open: { type: "bool", default: true },
    w: { type: "num", min: 60, default: 130, about: "across, cm (open)" },
    color: { type: "color", about: "a Turkish colour name, a palette id or a hex; default seeded" },
  },
  terms: ["a1-w-semsiye"],
} };

/** A lanyard: a printed neck strap in `color` hanging in a loop above a clear holder with a card; `label` is the card's words. Held, it hangs from the hand by its strap. */
const lanyard: PieceDef = { draw(p, r, kit) {
  const c = col(kit, p.color, r.pick(["#C8283A", "#1F5FC0", "#2F8C88", "#26272C", "#E0A83A"])), hc = r.pick(["#2F8C88", "#E8892E", "#7B4FB3", "#C8283A"]), label = str(p.label, "").trim(), held = !!p.held;
  const sh = [R([[-0.7, -9.6], [-5.6, -28], [-4, -44], [0, -46.5], [4, -44], [5.6, -28], [0.7, -9.6]], c, 1.5), { path: smooth([[-0.7, -10.6], [-5.4, -28], [-3.9, -43.4], [0, -45.8], [3.9, -43.4], [5.4, -28], [0.7, -10.6]], false, 1), stroke: { color: "#F4F1EA", width: 0.35, dash: [0.6, 1.2] }, flat: true, opacity: 0.8 } as Shape,
    S(rrect(-0.9, -11.6, 1.8, 2.6, 0.5), "#8E959C"), S(rrect(-3.2, -9.4, 6.4, 9.4, 0.6), "#DCEFF5", { opacity: 0.75 }), S(rrect(-2.7, -8.9, 5.4, 8.4, 0.4), "#FBF8F2"), S(rect(-2.7, -8.9, 5.4, 1.8), hc), S(rect(-2.1, -6.6, 2, 2.4), mix(hc, "#FFFFFF", 0.6)), F(rect(-2.6, -8.8, 1.2, 8.2), "#FFFFFF", 0.35)];
  const text: TextSpec[] = label ? [{ text: label, x: -2.4, y: -4, w: 4.8, h: 3.2, size: 0.9, font: "print" }] : [];
  return one("lanyard", held ? mv(sh, 0, 46.5) : sh, 8, held, text.length ? { text: held ? text.map(t => ({ ...t, y: t.y + 46.5 })) : text } : {}, 0.15);
}, meta: {
  about: "A lanyard: a printed neck strap hanging in a loop above a clear holder with a card.",
  params: {
    color: { type: "color", about: "a Turkish colour name, a palette id or a hex; the strap's; default seeded" },
    label: { type: "text", about: "the card's words" },
  },
} };

/** One job's hat at (x, 0): doctor (a head mirror on a band), chef (a pleated toque), police (a peaked cap with a badge), driver (a plain flat cap) or builder (a yellow hard hat). */
function hat(kind: string, x: number): Shape[] {
  if (kind === "chef") return [S(rrect(x - 9, -6, 18, 6, 1), "#F4F1EA"), S(smooth([[x - 9, -5], [x - 12, -14], [x - 7, -22], [x, -24], [x + 7, -22], [x + 12, -14], [x + 9, -5]], true, 1), "#FBF8F2"), ...[-5, 0, 5].map(d => L([[x + d, -7], [x + d * 1.2, -20]], "#D8D4CC", 0.6, 0.9)), F(rect(x + 3, -24, 9, 24), "#D8D4CC", 0.35, rrect(x - 12, -24, 24, 24, 4))];
  if (kind === "police") return [S(smooth([[x - 11, -6, 0], [x - 13, -12], [x - 4, -16], [x + 10, -15], [x + 13, -11], [x + 11, -6, 0]], true, 1), "#1E2B4A"), S(rect(x - 11, -6.6, 22, 4.6), "#26272C"), F(rect(x - 11, -5.3, 22, 0.7), "#C9CED3", 0.9), S(smooth([[x - 10, -2.4, 0], [x + 10, -2.4, 0], [x + 7, 0], [x - 7, 0]], true, 1), "#111214"), F(ellipse(x - 4, -1.6, 4, 0.5), "#FFFFFF", 0.3), S(ellipse(x, -10.6, 2.2, 2.6), BRASS), F(ellipse(x, -10.6, 1, 1.3), tone(BRASS, "deep"), 0.7)];
  if (kind === "driver") return [S(smooth([[x - 10, -3, 0], [x - 11, -8], [x - 3, -11.5], [x + 8, -10], [x + 11, -5, 0]], true, 1), "#6B6F75"), S(smooth([[x + 1, -4, 0], [x + 14, -3.4, 0], [x + 12, -1.6], [x + 2, -1.6]], true, 1), "#55595F"), F(rect(x - 10, -4.4, 12, 1), "#4B5058", 0.6), S(ellipse(x - 2, -11, 1, 0.6), "#55595F")];
  if (kind === "builder") return [S(smooth([[x - 10, -5, 0], [x - 9.5, -12], [x, -16.5], [x + 9.5, -12], [x + 10, -5, 0]], true, 1), "#F2C230"), S(rrect(x - 14, -5.4, 28, 2.6, 1.3), "#E0A83A"), S(rrect(x - 1.6, -16.4, 3.2, 11, 1.4), "#E9B92A"), F(ellipse(x - 4.6, -11.6, 2, 3), "#FFFFFF", 0.35)];
  return [{ path: ellipse(x, -3, 10, 3).add(ellipse(x, -3.2, 8.6, 2.1)), fill: "#3B3B40", evenodd: true }, S(ellipse(x, -9.5, 5.4), "#C9CED3"), S(ellipse(x, -9.5, 4.3), "#E4E8EC"), S(ellipse(x, -9.5, 0.9), "#3B3B40"), F(ellipse(x - 1.8, -11.2, 1.3, 0.8), "#FFFFFF", 0.7), S(rect(x - 0.6, -4.6, 1.2, 1.6), "#8E959C")];
}

/** Hats for the jobs lesson, side by side: `kinds` (doctor, chef, police, driver, builder; default the first four), or the first `n` of them. Held, the first one, on the hand. */
const hats: PieceDef = { draw(p) {
  const all = ["doctor", "chef", "police", "driver", "builder"], given = Array.isArray(p.kinds) ? p.kinds.filter((k): k is string => typeof k === "string") : typeof p.kinds === "string" ? p.kinds.split(",").map(k => k.trim()) : [], ks = given.length ? given : all;
  const list = Array.from({ length: p.held ? 1 : typeof p.n === "number" ? cnt(p.n, 4) : given.length || 4 }, (_, i) => ks[i % ks.length]);
  return one("hats", row(list.length, 28, 4, (x, i) => hat(list[i], x)), 5, !!p.held, {}, 0.3);
}, meta: {
  about: "Job hats side by side for the jobs lesson: a doctor's head mirror, a chef's toque, a police cap, a driver's cap, a hard hat.",
  params: {
    kinds: { type: ["list", "text"], about: "which: doctor, chef, police, driver, builder (a list or a comma-separated string); default the first four" },
    n: { type: "int", min: 1, max: 24, about: "how many, cycling through kinds; default as many as kinds, or 4" },
  },
  terms: ["a1-w-sapka"],
} };

/** The family's set pieces and props (`index.ts`). */
export const set: Record<string, PieceDef> = { flowers };
export const props: Record<string, PieceDef> = { bag, box, trolley, cloth, yarn, flowers, device, key, watch, tool, toy, balloon, bell, coin, umbrella, lanyard, hats };
