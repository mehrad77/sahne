// Set pieces and props of the street family, following STYLE.md: one building's front seen
// up close (the kit's `street` is a whole row of them), shopfronts with their awnings and roller shutters, lamp
// posts, front steps, garden walls, benches and trees. Units cm; each flat's origin is its bottom centre, up is −y in
// the art. Words (a shop's sign, a door's number, a menu) are `text` on a flat, never drawn.

import { arcPoints, band, ellipse, luma, poly, rect, rrect, smooth, tone, type EmitSpec, type FlatSpec, type LightSpec, type Path, type PieceDef, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, holed, glowOnly, litByTurns, solidLine, type Pt } from "./draw.ts";
import { SET } from "../palette.ts";
import { COUNTRIES, countryOf, flagCloth, flagWidth, shifted } from "../flags.ts";

// ---- Shared bits ------------------------------------------------------------------------------------

/** A rectangle. */
const R = (x: number, y: number, w: number, h: number, c: string, o: Partial<Shape> = {}): Shape => S(rect(x, y, w, h), c, o);
/** Printed on the paper (no rim, no shadow) at an opacity. */
const pr = (opacity = 1): Partial<Shape> => ({ flat: true, opacity });
const cl = (v: number) => Math.max(0, Math.min(1, v));
/** A colour param: a name in `named`, a hex, else `d`. */
const hue = (v: unknown, named: Record<string, string>, d: string) => typeof v !== "string" ? d : Object.hasOwn(named, v) ? named[v] : /^#[0-9a-f]{6}$/i.test(v) ? v : d;
/** From a to b in steps of d. */
const span = (a: number, b: number, d: number) => { const o: number[] = []; for (let x = a; x <= b + 0.01; x += d) o.push(x); return o; };
/** Rectangles [x, y, w, h] as one path (bars, slats, rungs): one fill for them all. */
const many = (rs: number[][]): Path => { const o = rs.length ? rect(rs[0][0], rs[0][1], rs[0][2], rs[0][3]) : rect(0, -0.1, 0.1, 0.1); for (const q of rs.slice(1)) o.add(rect(q[0], q[1], q[2], q[3])); return o; };
/** A printed ring (a grille, an iron scroll, a handle). */
const ring = (x: number, y: number, rad: number, c: string, w = 1.2): Shape => ({ path: ellipse(x, y, rad), stroke: { color: c, width: w }, flat: true });
/** A lumpy round outline: a leaf clump, a bush, a patch of peeled plaster. */
const blob = (x: number, y: number, rx: number, ry: number, r: Rng, n = 7): Pt[] => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, q = r.range(0.8, 1.12); return [x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q] as Pt; });
/** A five-pointed star's points, its first point at angle `a0`. */
const star = (x: number, y: number, rad: number, k = 0.4, a0 = -Math.PI / 2): Vec2[] => Array.from({ length: 10 }, (_, i) => { const a = a0 + i * Math.PI / 5, q = i % 2 ? rad * k : rad; return [x + Math.cos(a) * q, y + Math.sin(a) * q]; });
/** A running bond printed over a wall: bricks, stone blocks, cladding panels. */
const bond = (c: string, w: number, h: number, op = 0.8, j = 1.3): Partial<Shape> => ({ tile: { w, h: 2 * h, shapes: [R(0, 0, w, j, c, pr(op)), R(0, h, w, j, c, pr(op)), R(0, 0, j, h, c, pr(op)), R(w / 2, h, j, h, c, pr(op))] } });

const GLASS = "#4F6175", WARM = "#FFD27A", IRON = "#34373C", STONE = "#CFC6B4", INK = "#2B2420";
const PLASTER: Record<string, string> = { cream: "#EFDDB8", sand: "#E6CC9C", ochre: "#DDB57A", rose: "#E3B4A0", terracotta: "#CF8E72", mint: "#CBDDC8", sage: "#B7C6AC", sky: "#BCD0D9", lilac: "#D3C3D6", white: "#EEE9DF", grey: "#C8C3B8" };
const DRAPES = ["#C4553A", "#E9D8B4", "#7A3E6E", "#2F8C88", "#D9B98C", "#8DB8DA"];
const CLOTH = ["#C4553A", "#E0A83A", "#2F8C88", "#F7F3EA", "#4F6E9E", "#D9534A", "#8DB8DA", "#F2B705", "#7A3E6E", "#E9E4DA", "#6F7A45", "#EE8AA0", "#2E3A59"];
const GOODS = ["#C4553A", "#E0A83A", "#2F8C88", "#4E7A68", "#2E3A59", "#D9534A", "#F2B705", "#7A3E6E", "#8DB8DA", "#B98A57", "#F7F3EA", "#6F7A45"];
const PILLS = ["#F7F5F0", "#EAF1F4", "#DDEBE3", "#F3E7EA", "#E9EEF7", "#FFFFFF", "#F6EFD9"];
const CREAMS = ["#F4E9DA", "#F2C9D0", "#6B3E2E", "#F7E3A1", "#E8A0A8", "#FFFFFF"];
const SHUTTERS = ["#A9B0B5", "#9AA3A8", "#B4B9B5", "#8E979C"];
const AWNINGS: [string, string][] = [["#C4302B", "#F4F1EA"], ["#2F8C88", "#F4F1EA"], ["#2F6B4A", "#F4F1EA"], ["#E0A83A", "#B3261E"], ["#2E3A59", "#F4F1EA"], ["#B3261E", "#B3261E"], ["#2F6B4A", "#2F6B4A"]];
const GREENS = ["#4E7A48", "#5E8F52", "#3F6B3E", "#6E9E5C"];

/** The Turkish flag (or the `country`'s), its hoist's top at (x, y), `w` wide, the fly rippling by `wave` cm. */
function flag(x: number, y: number, w: number, wave = 0, country = "tr"): Shape[] {
  if (country !== "tr") { const h = Math.min(w / 1.5, w / flagWidth(1, country)); return shifted(flagCloth(h, wave / h, 0.8, country), x, y); }
  const h = w / 1.5, cy = y + h / 2;
  return [
    P([[x, y, 0], [x + w * 0.35, y - wave], [x + w * 0.7, y + wave * 0.6], [x + w, y + wave * 0.2, 0], [x + w, y + h + wave * 0.2, 0], [x + w * 0.7, y + h + wave * 0.6], [x + w * 0.35, y + h - wave], [x, y + h, 0]], "#E30A17"),
    L([[x + w * 0.6, y + 2], [x + w * 0.62, y + h - 2]], "#A80510", w * 0.05, 0.25),
    S(ellipse(x + h * 0.5, cy, h * 0.25), "#FFFFFF", pr()), S(ellipse(x + h * 0.5625, cy, h * 0.2), "#E30A17", pr()), S(poly(star(x + h * 0.82, cy, h * 0.125, 0.4, Math.PI)), "#FFFFFF", pr()),
  ];
}

/** A window opening, `arch`ed (a round head) or square. */
const opening = (x: number, y: number, w: number, h: number, arch: boolean): Path => arch ? poly([[x, y + h], [x + w, y + h], ...arcPoints(x + w / 2, y + w / 2, w / 2, w / 2, 0, -Math.PI, 12)]) : rect(x, y, w, h);

/** A glazed window or door: frame, glass, by chance a lace curtain, drapes or a blind, glints and `bars` panes across; its glass also goes into `glow` when it lights at night. */
function glazing(out: Shape[], glow: Shape[] | null, x: number, y: number, w: number, h: number, arch: boolean, frame: string, r: Rng, bars = 2) {
  const g = opening(x + 5, y + 5, w - 10, h - 10, arch), k = r.int(0, 5), c = r.pick(DRAPES);
  out.push(S(opening(x, y, w, h, arch), frame), S(g, GLASS), R(x, y, w, h * 0.14, "#1F2832", { ...pr(0.35), clip: g }));
  if (k === 1) out.push(R(x, y + h * 0.3, w, h, "#F4F1EA", { ...pr(0.5), clip: g }));
  else if (k === 2) out.push(R(x, y, w * 0.27, h, c, { ...pr(0.9), clip: g }), R(x + w * 0.73, y, w * 0.27, h, c, { ...pr(0.9), clip: g }));
  else if (k === 3) out.push(R(x, y, w, h * 0.4, "#E6D9BC", { ...pr(0.92), clip: g }));
  out.push(L([[x + w * 0.2, y + h * 0.8], [x + w * 0.62, y + h * 0.22]], "#FFFFFF", Math.max(3, w * 0.07), 0.13));
  for (let i = 1; i < bars; i++) out.push(R(x + w * i / bars - 2, y, 4, h, frame, { clip: g }));
  if (h > w * 1.2) out.push(R(x, y + (arch ? w / 2 : h * 0.3) - 2, w, 4, frame, { clip: g }));
  if (glow) glow.push(S(g, WARM, pr()));
}

/** Louvred shutters (panjur) folded back each side of a window. */
function panjur(out: Shape[], x: number, y: number, w: number, h: number, c: string) {
  const sw = w / 2 - 2, lv = { tile: { w: 20, h: 7, shapes: [R(0, 4.5, 20, 2.2, tone(c, "deep"), pr(0.55))] } };
  for (const sx of [x - sw - 7, x + w + 7]) out.push(R(sx, y - 2, sw, h + 4, c), S(rect(sx + 3, y + 4, sw - 6, h - 8), c, lv), R(sx, y + h * 0.48, sw, 4, tone(c, "light"), pr(0.7)), R(sx + sw - 3, y - 2, 3, h + 4, tone(c, "shade"), pr(0.5)));
}

/** A stone sill under a window (a ledge: a perch). */
const sill = (out: Shape[], x: number, y: number, w: number, c: string) => out.push(R(x - 12, y, w + 24, 9, c), R(x - 12, y, w + 24, 2.5, "#FFFFFF", pr(0.35)), R(x - 10, y + 9, w + 20, 5, INK, pr(0.18)));

/** A window box on a sill at y: leaves, and geraniums (`ger`) or mixed flowers. */
function flowerBox(out: Shape[], x: number, y: number, w: number, r: Rng, ger: boolean) {
  const c = r.pick(["#B8562F", "#4E6B4A", "#E9E4D8"]), fl = ger ? ["#D9343A", "#E8506A", "#C22A3A", "#EE8AA0"] : ["#F4F1EA", "#F2B705", "#8A6AB0", "#E8506A"];
  for (let i = 0; i < w / 9; i++) out.push(S(ellipse(x + 4 + i * 9 + r.range(-2, 2), y - 18 - r.range(0, 8), r.range(7, 10), r.range(5, 7)), r.pick(GREENS)));
  for (let i = 0; i < w / 14; i++) {
    const fx = x + 6 + i * 14 + r.range(-3, 3), fy = y - 27 - r.range(0, 10), fc = r.pick(fl);
    for (let j = 0; j < 4; j++) out.push(S(ellipse(fx + Math.cos(j * 1.6) * 3.4, fy + Math.sin(j * 1.6) * 3, 3), fc));
  }
  out.push(R(x - 4, y - 14, w + 8, 16, c), R(x - 4, y - 14, w + 8, 3, tone(c, "light"), pr(0.7)));
}

/** An air conditioner's outdoor unit on brackets, its top left at (x, y), and the drip stain under it. */
const acUnit = (out: Shape[], x: number, y: number) => out.push(
  R(x + 52, y + 46, 3, 70, INK, pr(0.1)), R(x + 6, y + 44, 3, 12, IRON), R(x + 59, y + 44, 3, 12, IRON),
  S(rrect(x, y, 68, 46, 3), "#ECEBE6"), R(x + 63, y, 5, 46, "#C9C9C2", pr(0.6)), S(ellipse(x + 44, y + 23, 17), "#D3D6D4"),
  ring(x + 44, y + 23, 13, "#9EA3A3"), ring(x + 44, y + 23, 8, "#9EA3A3"), S(ellipse(x + 44, y + 23, 3), "#9EA3A3", pr()),
  S(many(span(y + 8, y + 36, 7).map(v => [x + 6, v, 17, 2])), "#B9BCBB", pr()),
);

/** A satellite dish on a short arm, its centre at (x, y). */
const dish = (x: number, y: number): Shape[] => [
  L([[x + 6, y + 30], [x + 6, y + 4]], "#8E9396", 2.5, 1), S(ellipse(x, y, 22, 26), "#E8E8E2"), S(ellipse(x + 3, y + 1, 17, 21), "#C9CACA", pr(0.35)),
  L([[x - 2, y + 12], [x - 28, y - 6]], "#8E9396", 2, 1), S(rrect(x - 35, y - 12, 10, 8, 2), "#3B3B40"),
];

/** A line of washing between x0 and x1 at y, sagging: shirts, towels, trousers and socks, pegged. */
function washing(x0: number, x1: number, y: number, r: Rng): Shape[] {
  const out: Shape[] = [L([[x0, y], [(x0 + x1) / 2, y + 5], [x1, y]], "#5A5550", 0.8, 0.9), R(x0 - 2, y - 6, 3, 12, IRON), R(x1 - 1, y - 6, 3, 12, IRON)];
  for (let x = x0 + 6; x < x1 - 24;) {
    const c = r.pick(CLOTH), k = r.int(0, 3), t = y + 5 * (1 - ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2), x2 = x;
    if (k === 0) { out.push(P([[x, t + 2, 0], [x + 9, t, 0], [x + 21, t, 0], [x + 30, t + 2, 0], [x + 33, t + 13, 0], [x + 26, t + 14, 0], [x + 26, t + 40, 0], [x + 4, t + 40, 0], [x + 4, t + 14, 0], [x - 3, t + 13, 0]], c)); x += 36; }
    else if (k === 1) { out.push(R(x, t, 28, 46, c), R(x, t + 38, 28, 3, tone(c, "light"), pr(0.8))); x += 32; }
    else if (k === 2) { out.push(P([[x, t, 0], [x + 26, t, 0], [x + 27, t + 54, 0], [x + 16, t + 54, 0], [x + 13, t + 16, 0], [x + 10, t + 54, 0], [x - 1, t + 54, 0]], c)); x += 32; }
    else { for (let i = 0; i < 2; i++) out.push(P([[x + i * 9, t, 0], [x + i * 9 + 6, t, 0], [x + i * 9 + 6, t + 14, 0], [x + i * 9 + 10, t + 18], [x + i * 9 + 3, t + 19, 0], [x + i * 9, t + 15]], c)); x += 21; }
    out.push(R(x2 + 2, t - 3, 2.5, 6, "#D9A72E"));
  }
  return out;
}

/** Paper cut-outs children stuck on a classroom window: suns, flowers, stars. */
function cutouts(out: Shape[], x: number, y: number, w: number, h: number, r: Rng) {
  for (let i = r.int(1, 3); i > 0; i--) {
    const cx = x + r.range(16, w - 16), cy = y + r.range(20, h * 0.55), c = r.pick(["#F2B705", "#E8506A", "#2F8C88", "#E0A83A", "#8DB8DA"]), k = r.int(0, 2);
    if (k === 0) out.push(S(ellipse(cx, cy, 6), c, pr()), ...span(0, 7, 1).map(j => L([[cx + Math.cos(j * 0.785) * 8, cy + Math.sin(j * 0.785) * 8], [cx + Math.cos(j * 0.785) * 12, cy + Math.sin(j * 0.785) * 12]], c, 1.6, 1)));
    else if (k === 1) out.push(...span(0, 4, 1).map(j => S(ellipse(cx + Math.cos(j * 1.257) * 5, cy + Math.sin(j * 1.257) * 5, 4), c, pr())), S(ellipse(cx, cy, 2.8), "#F2B705", pr()));
    else out.push(S(poly(star(cx, cy, 9, 0.45)), c, pr()));
  }
}

/** A roller shutter (kepenk) over x0…x1: its box from `top`, the guides, the slatted curtain down to the ground y0 by `open` (0 down, padlocked … 1 up). Takes the same randomness at any `open`. */
function kepenk(x0: number, x1: number, top: number, y0: number, open: number, c: string, r: Rng): Shape[] {
  const w = x1 - x0, box = 26, run = y0 - top - box, down = (1 - cl(open)) * run, out: Shape[] = [];
  const tag = r() < 0.35, tc = r.pick(["#C4302B", "#2E6FB6", "#2F8C88", "#E0A83A"]), marks = [0, 1, 2].map(() => [r(), r()]), rust = [r(), r()];
  out.push(R(x0 - 6, top + box, 6, run, tone(c, "shade")), R(x1, top + box, 6, run, tone(c, "shade")));
  if (down > 3) {
    const cur = rect(x0, top + box, w, down), yb = top + box + down;
    out.push(S(cur, c), S(cur, c, { tile: { w: 50, h: 7.5, shapes: [R(0, 5.6, 50, 1.6, tone(c, "deep"), pr(0.45)), R(0, 0, 50, 1.4, "#FFFFFF", pr(0.3))] } }));
    if (tag) for (const [u, v] of marks) { const tx = x0 + 20 + u * (w - 80), ty = top + box + 10 + v * Math.max(0, down - 50); out.push({ path: smooth([[tx, ty + 20], [tx + 12, ty], [tx + 20, ty + 22], [tx + 32, ty + 2], [tx + 44, ty + 18]], false), stroke: { color: tc, width: 3, cap: "round" }, flat: true, opacity: 0.6, clip: cur }); }
    else out.push(R(x0 + rust[0] * (w - 30), top + box, 8 + rust[1] * 22, down, "#8A5A3C", { ...pr(0.12), clip: cur }));
    out.push(R(x0, yb - 9, w, 9, tone(c, "deep")), R(x0 + w * 0.25 - 6, yb - 7, 12, 4, "#3B3B40"), R(x0 + w * 0.75 - 6, yb - 7, 12, 4, "#3B3B40"));
    if (open <= 0.02) for (const f of [0.25, 0.75]) out.push({ path: smooth([[x0 + w * f - 3, yb - 3], [x0 + w * f, yb - 9], [x0 + w * f + 3, yb - 3]], false), stroke: { color: "#8E969C", width: 1.5 }, flat: true }, S(rrect(x0 + w * f - 5, yb - 4, 10, 9, 2), "#C9A24A"));
  }
  out.push(R(x0 - 9, top, w + 18, box, tone(c, "light")), R(x0 - 9, top + box - 5, w + 18, 5, tone(c, "shade"), pr(0.6)), R(x0 - 9, top, w + 18, 3, "#FFFFFF", pr(0.3)));
  return out;
}

/** A shop's awning from x0 to x1 hung at y: the cloth sloping `drop` cm out to a scalloped valance, striped `a` and `b` or plain `a`. */
function tente(x0: number, x1: number, y: number, drop: number, a: string, b: string | null): Shape[] {
  const w = x1 - x0, i = Math.min(10, w * 0.04), vy = y + drop, n = Math.max(3, Math.round(w / 24)), sw = w / n;
  const slope = poly([[x0 + i, y], [x1 - i, y], [x1, vy], [x0, vy]]), pts: Pt[] = [[x0, vy, 0], [x1, vy, 0]];
  for (let k = n; k > 0; k--) pts.push([x0 + k * sw, vy + 15, 0], [x0 + (k - 0.5) * sw, vy + 24]);
  pts.push([x0, vy + 15, 0]);
  const val = smooth(pts, true), out: Shape[] = [R(x0 + i - 3, y - 4, w - 2 * i + 6, 6, "#5A5A5A"), S(slope, a), S(val, a)];
  if (b && b !== a) {
    const at = (u: number) => x0 + i + u * (w - 2 * i) / w;
    let sp: Path | null = null, vp: Path | null = null;
    for (let u = sw / 2; u < w - 0.1; u += sw) {
      const q = poly([[at(u), y], [at(u + sw / 2), y], [x0 + u + sw / 2, vy], [x0 + u, vy]]), v = rect(x0 + u, vy, sw / 2, 26);
      sp = sp ? sp.add(q) : q; vp = vp ? vp.add(v) : v;
    }
    out.push(S(sp!, b), S(vp!, b, { clip: val }));
  }
  out.push(R(x0, y, w, drop * 0.4, "#FFFFFF", { ...pr(0.13), clip: slope }), R(x0, vy - 4, w, 4, INK, { ...pr(0.15), clip: slope }), R(x0, vy + 13, w, 14, INK, { ...pr(0.12), clip: val }));
  return out;
}

// what a shop window holds

/** A row of packed goods standing on y from x0 to x1, at most `mh` tall: boxes, tins, bottles and jars (`boxes` only boxes). */
function goodsRow(out: Shape[], x0: number, x1: number, y: number, mh: number, r: Rng, cols = GOODS, boxes = false) {
  for (let x = x0; x < x1 - 10;) {
    const c = r.pick(cols), k = boxes ? 0 : r.int(0, 3), h = Math.min(mh, r.range(boxes ? 8 : 12, boxes ? 16 : 26)), bw = r.range(boxes ? 7 : 9, boxes ? 13 : 16);
    if (k === 0) { out.push(S(rrect(x, y - h, bw, h, 1), c), R(x, y - h * 0.6, bw, h * 0.25, boxes ? "#3F8FC0" : "#FFFFFF", pr(0.4))); x += bw + 1.2; }
    else if (k === 1) { out.push(S(rrect(x, y - 12, 8, 12, 1.5), c), R(x, y - 8, 8, 4, "#F7F3EA", pr())); x += 9.5; }
    else if (k === 2) { out.push(P([[x + 1, y, 0], [x + 8, y, 0], [x + 8, y - h * 0.6], [x + 6, y - h, 0], [x + 3, y - h, 0], [x + 1, y - h * 0.6]], c)); x += 10; }
    else { out.push(S(rrect(x, y - 13, 11, 13, 3), c), R(x + 0.5, y - 15, 10, 3, "#D9A72E")); x += 12.5; }
  }
}
/** A loaf (somun) lying on y, centred on x. */
const loaf = (x: number, y: number): Shape[] => [P([[x - 12, y, 0], [x + 12, y, 0], [x + 11, y - 6], [x + 7, y - 10], [x - 7, y - 10], [x - 11, y - 6]], "#C8863F"), L([[x - 6, y - 7], [x - 1, y - 9]], "#E2B070", 1.3, 0.9), L([[x + 1, y - 7], [x + 6, y - 9]], "#E2B070", 1.3, 0.9)];
/** A simit seen from the front, centred at (x, y). */
const simit = (x: number, y: number): Shape[] => [{ path: ellipse(x, y, 7, 4).add(ellipse(x, y - 0.3, 3, 1.4)), fill: "#B5652A", evenodd: true }, S(ellipse(x - 2, y - 2.4, 3, 1), "#F2E1B8", pr(0.6))];
/** A round cake on a plate standing on y, `w` across, its cream `c`. */
const cake = (x: number, y: number, w: number, c: string): Shape[] => [R(x - w / 2 - 3, y - 2, w + 6, 2, "#F4F1EA"), S(rrect(x - w / 2, y - w * 0.5, w, w * 0.48, 3), "#E8C08A"), R(x - w / 2, y - w * 0.32, w, w * 0.06, c, pr(0.9)), S(rrect(x - w / 2 - 1, y - w * 0.58, w + 2, w * 0.15, 4), c), S(ellipse(x, y - w * 0.62, w * 0.06), "#C22A3A")];
/** A tea glass on its saucer standing on y. */
const tea = (x: number, y: number): Shape[] => [S(ellipse(x, y, 5, 1.2), "#F4F1EA"), P([[x - 2.6, y - 1, 0], [x + 2.6, y - 1, 0], [x + 2, y - 5], [x + 3.2, y - 10, 0], [x - 3.2, y - 10, 0], [x - 2, y - 5]], "#B5402A", { opacity: 0.9 })];
/** A pot of leaves (and a few flowers) standing on y. */
const potted = (x: number, y: number, r: Rng): Shape[] => [P(blob(x, y - 22, r.range(10, 14), r.range(10, 16), r), r.pick(GREENS)), ...(r.chance(0.5) ? span(0, 3, 1).map(() => S(ellipse(x + r.range(-8, 8), y - 22 + r.range(-10, 6), 2.6), r.pick(["#D9343A", "#F4F1EA", "#E8506A", "#F2B705"]))) : []), P([[x - 7, y, 0], [x + 7, y, 0], [x + 9, y - 13, 0], [x - 9, y - 13, 0]], "#B8562F")];

/**
 * What a shop window of `kind` holds, in x0…x1 between `top` and the sill `bot`: a bakkal's goods and simits, a fırın's
 * loaves on racks, an eczane's boxes, a café's lamps, counter and table, a pastane's cakes, an emlak's listings (with
 * their words in `text`), a florist's plants, or a shop's `goods` (clothes, shoes, bags, books). Lamps glow into `lamps`.
 */
function wares(out: Shape[], lamps: Shape[], text: TextSpec[], kind: string, goods: string, x0: number, x1: number, top: number, bot: number, r: Rng) {
  const w = x1 - x0, shelves = (n: number, wood: string, fill: (y: number, h: number) => void) => {
    const gap = (bot - top - 16) / n;
    for (let i = 0; i < n; i++) { const y = bot - 4 - i * gap; fill(y, gap - 10); out.push(R(x0, y, w, 4, wood), R(x0, y + 4, w, 2, INK, pr(0.25))); }
  };
  if (kind === "bakkal") {
    shelves(3, SET.wood_light, (y, h) => goodsRow(out, x0 + 4, x1 - 4, y, h, r));
    out.push(S(ellipse(x0 + 30, bot - 3, 26, 3), "#B8BEC4"));
    for (const [dx, dy] of [[-12, 0], [0, 0], [12, 0], [-6, -6], [6, -6], [0, -12]]) out.push(...simit(x0 + 30 + dx, bot - 8 + dy));
  } else if (kind === "firin") {
    shelves(3, SET.wood, y => { for (let x = x0 + 16; x < x1 - 12; x += 26) out.push(...loaf(x, y)); });
    out.push(S(ellipse(x1 - 30, bot - 5, 24, 6), "#B98A57"));
    for (const dx of [-10, 0, 10]) out.push(...simit(x1 - 30 + dx, bot - 9));
  } else if (kind === "eczane") shelves(4, "#F4F1EA", (y, h) => goodsRow(out, x0 + 4, x1 - 4, y, h, r, PILLS, true));
  else if (kind === "pastane") {
    shelves(3, "#F4F1EA", y => { for (let x = x0 + 20; x < x1 - 18; x += r.range(32, 38)) out.push(...cake(x, y, r.range(26, 32), r.pick(CREAMS))); });
    const sx = (x0 + x1) / 2;
    out.push(R(sx - 1.2, bot - 62, 2.4, 58, "#C9A24A"));
    for (let j = 0; j < 3; j++) { const pw = 46 - j * 13, py = bot - 8 - j * 24; out.push(R(sx - pw / 2, py, pw, 2.5, "#E9E4DA")); for (let x = sx - pw / 2 + 5; x < sx + pw / 2 - 3; x += 7) out.push(S(rrect(x - 3, py - 6, 6, 6, 2), r.pick(CREAMS))); }
  } else if (kind === "cafe") {
    for (const f of [0.28, 0.72]) { const lx = x0 + w * f; out.push(L([[lx, top], [lx, top + 34]], INK, 0.8, 1), P([[lx - 4, top + 32, 0], [lx + 4, top + 32, 0], [lx + 15, top + 46, 0], [lx - 15, top + 46, 0]], "#C9A24A")); out.push(S(ellipse(lx, top + 46, 15, 2.4), tone("#C9A24A", "deep"))); lamps.push(S(ellipse(lx, top + 46, 14, 2), "#FFE6A8", pr())); }
    const cx = x0 + w * 0.5;
    out.push(R(cx, top + 74, w * 0.5, 4, SET.wood)); goodsRow(out, cx + 4, x1 - 4, top + 74, 20, r);
    out.push(R(cx, bot - 44, w * 0.5, 48, tone(SET.wood, "shade")), R(cx - 3, bot - 48, w * 0.5 + 3, 6, SET.wood_light));
    out.push(S(rrect(cx + 14, bot - 68, 22, 20, 5), SET.steel), S(rrect(cx + 18, bot - 82, 14, 14, 4), SET.steel), S(ellipse(cx + 25, bot - 83, 4, 2), "#3B3B40"));
    for (let j = 0; j < 3; j++) out.push(...tea(cx + 48 + j * 10, bot - 48));
    const tx = x0 + w * 0.25;
    out.push(S(rrect(tx - 54, bot - 56, 20, 30, 4), "#3B3B40"), S(rrect(tx + 34, bot - 56, 20, 30, 4), "#3B3B40"), S(rrect(tx - 30, bot - 32, 60, 5, 2), SET.wood), R(tx - 2, bot - 27, 4, 27, "#3B3B40"), ...tea(tx - 10, bot - 32), ...tea(tx + 12, bot - 32));
  } else if (kind === "emlak") {
    const cw = 34, ch = 46, cols = Math.max(1, Math.floor((w + 6) / (cw + 8))), rows = Math.max(1, Math.min(3, Math.floor((bot - top - 8) / (ch + 12)))), ox = x0 + (w - cols * (cw + 8) + 8) / 2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cx = ox + i * (cw + 8), cy = top + 10 + j * (ch + 12), sale = r.chance(0.5), hc = r.pick(Object.values(PLASTER));
      out.push(R(cx, cy, cw, ch, "#FBF8F2"), R(cx + 3, cy + 5, cw - 6, 18, "#BFE0EE"), R(cx + 9, cy + 12, cw - 18, 11, hc), P([[cx + 6, cy + 12, 0], [cx + cw / 2, cy + 5, 0], [cx + cw - 6, cy + 12, 0]], "#B5583A"), R(cx, cy, cw, 3, sale ? "#B3261E" : "#2F8C88"));
      text.push({ text: `${sale ? "SATILIK" : "KİRALIK"}\n${r.pick(["1+1", "2+1", "3+1"])}`, x: cx + 2, y: cy + 25, w: cw - 4, h: 19, size: 5, font: "print", color: INK });
    }
  } else if (kind === "cicekci") shelves(2, SET.wood, y => { for (let x = x0 + 14; x < x1 - 10; x += r.range(22, 30)) out.push(...potted(x, y, r)); });
  else if (goods === "shoes") shelves(4, SET.wood_light, y => { for (let x = x0 + 4; x < x1 - 26; x += 26) { const c = r.pick(CLOTH); for (const d of [4, 0]) out.push(P([[x + d, y, 0], [x + d + 17, y, 0], [x + d + 17, y - 3], [x + d + 10, y - 5], [x + d + 5, y - 11, 0], [x + d, y - 11, 0]], d ? tone(c, "shade") : c)); } });
  else if (goods === "books") shelves(4, SET.wood, (y, h) => { for (let x = x0 + 2; x < x1 - 6;) { const bw = r.range(3, 6), bh = Math.min(h, r.range(16, 26)), c = r.pick(CLOTH); out.push(R(x, y - bh, bw, bh, c), R(x, y - bh * 0.7, bw, 2, "#FFFFFF", pr(0.35))); x += bw + 0.6; } });
  else if (goods === "bags") for (const y of [top + 24, top + 100]) {
    out.push(R(x0, y - 4, w, 3, SET.steel));
    for (let x = x0 + 18; x < x1 - 14; x += r.range(30, 38)) { const c = r.pick(CLOTH); out.push({ path: smooth([[x - 6, y + 8], [x, y - 3], [x + 6, y + 8]], false), stroke: { color: tone(c, "deep"), width: 1.8 }, flat: true }, P([[x - 13, y + 34, 0], [x + 13, y + 34, 0], [x + 10, y + 8, 0], [x - 10, y + 8, 0]], c), R(x - 10, y + 14, 20, 3, tone(c, "shade"), pr(0.6))); }
  } else {
    out.push(L([[x0 + 6, top + 22], [x1 - 6, top + 22]], SET.steel, 2.5, 1));
    for (let x = x0 + 22; x < x1 - 20; x += r.range(24, 30)) { const c = r.pick(CLOTH); out.push(L([[x - 10, top + 30], [x, top + 25], [x + 10, top + 30]], SET.steel, 1.2, 1), P([[x - 12, top + 29, 0], [x + 12, top + 29, 0], [x + 15, top + 38], [x + 13, top + 84, 0], [x - 13, top + 84, 0], [x - 15, top + 38]], c)); }
    const mx = (x0 + x1) / 2 + r.range(-20, 20), c = r.pick(CLOTH), ty = bot - 124;
    out.push(R(mx - 1.5, ty + 70, 3, bot - ty - 72, "#3B3B40"), S(ellipse(mx, bot - 2, 14, 3), "#3B3B40"), R(mx - 4, ty - 8, 8, 10, "#E9DCCB"), P([[mx - 19, ty + 4], [mx - 14, ty, 0], [mx + 14, ty, 0], [mx + 19, ty + 4], [mx + 12, ty + 40], [mx + 18, ty + 74, 0], [mx - 18, ty + 74, 0], [mx - 12, ty + 40]], c));
  }
}

/** A bakkal's stand of fruit and vegetable crates on the pavement, x0…x1, with blank price tags. */
function crates(out: Shape[], x0: number, x1: number, r: Rng) {
  const fruit: [string, number][] = [["#E8892B", 3.4], ["#D9343A", 3.4], ["#9CC255", 3.2], ["#F2D13A", 3], ["#4E8A3A", 2.6], ["#C4302B", 3.2]];
  out.push(R(x0 + 4, -74, 4, 74, SET.wood_dark), R(x1 - 8, -74, 4, 74, SET.wood_dark));
  for (const [y, inset] of [[-70, 10], [-36, 0]]) {
    out.push(R(x0, y, x1 - x0, 5, SET.wood));
    for (let x = x0 + inset; x < x1 - 36; x += 40) {
      const [c, s] = r.pick(fruit);
      for (let j = 0; j < 9; j++) out.push(S(ellipse(x + 5 + (j % 5) * 6.5 + (j > 4 ? 3 : 0), y - 17 - (j > 4 ? 5 : 0), s), c));
      out.push(R(x, y - 16, 36, 16, SET.wood_light), R(x, y - 10, 36, 2, tone(SET.wood_light, "deep"), pr(0.5)), L([[x + 31, y - 16], [x + 31, y - 26]], INK, 0.6, 0.8), R(x + 26, y - 32, 11, 7, "#FBF8F2"));
    }
  }
}

/** A florist's buckets of cut flowers on the pavement, x0…x1: roses, sunflowers, white, lavender, pink. */
function buckets(out: Shape[], x0: number, x1: number, r: Rng) {
  for (let x = x0 + 20; x < x1 - 16; x += r.range(34, 42)) {
    const k = r.int(0, 4), c = ["#D9343A", "#F2B705", "#F4F1EA", "#8A6AB0", "#E8506A"][k], heads: Shape[] = [];
    for (let j = 0; j < 7; j++) {
      const a = (j - 3) * 0.13, hx = x + Math.sin(a) * 40, hy = -34 - Math.cos(a) * r.range(26, 44);
      out.push(L([[x + (j - 3) * 2, -30], [hx, hy]], "#4E7A48", 1.4, 1));
      heads.push(...(k === 1 ? [S(ellipse(hx, hy, 6.5), c), S(ellipse(hx, hy, 2.8), "#6B4A2A")] : k === 3 ? [S(rrect(hx - 1.6, hy - 7, 3.2, 12, 1.6), c)] : [S(ellipse(hx, hy, 4.4), c), ring(hx, hy, 2, tone(c, "deep"), 0.8)]));
    }
    out.push(P([[x - 13, 0, 0], [x + 13, 0, 0], [x + 16, -32, 0], [x - 16, -32, 0]], "#B8BEC4"), R(x - 15, -26, 30, 2, "#8E969C", pr(0.6)), R(x - 14, -9, 28, 2, "#8E969C", pr(0.6)), ...heads);
  }
}

/** A bench at x, `w` long: a park bench (slats on cast-iron ends) or a ferry's `deck` bench (a painted frame, varnished slats, the life-jacket locker marked `label`). */
function benchArt(out: Shape[], text: TextSpec[], deck: boolean, x: number, w: number, r: Rng, label: string) {
  const x0 = x - w / 2;
  if (!deck) {
    const wood = r.pick(["#A8754A", "#8C5A3C", "#3E6B4A", "#B98A57"]), iron = r.pick(["#2A2C2E", "#2F4038"]), ends = w > 220 ? [x0 + 8, x, x0 + w - 8] : [x0 + 8, x0 + w - 8];
    for (const ex of ends) out.push(R(ex - 3.5, -96, 7, 96, iron), P([[ex - 13, 0, 0], [ex + 13, 0, 0], [ex + 6, -9], [ex - 6, -9]], iron), ring(ex, -22, 5, iron, 2));
    for (const y of [-94, -81, -68]) out.push(R(x0, y, w, 10, wood), R(x0, y, w, 2, tone(wood, "light"), pr(0.6)), L([[x0 + 10, y + 6], [x0 + w * 0.4, y + 5.4], [x0 + w - 10, y + 6.6]], tone(wood, "deep"), 0.6, 0.35));
    out.push(R(x0 - 6, -52, w + 12, 7, tone(wood, "light")), R(x0 - 6, -45, w + 12, 9, wood), R(x0 - 6, -36, w + 12, 2.5, INK, pr(0.25)));
    for (const ex of [ends[0], ends[ends.length - 1]]) out.push(S(rrect(ex - 9, -70, 18, 6, 3), iron));
    return;
  }
  const fc = r.pick(["#E9E6DC", "#DCD8CC", "#3F6E9E", "#E2D6B8"]), wood = "#B5804E", lw = Math.min(90, w * 0.4);
  out.push(R(x0, -106, w, 60, fc), R(x0, -106, w, 3, "#FFFFFF", pr(0.35)));
  for (const y of [-100, -88, -76, -64]) out.push(R(x0 + 6, y, w - 12, 9, wood), R(x0 + 6, y, w - 12, 2, tone(wood, "light"), pr(0.6)));
  out.push(R(x0 + 4, -42, w - 8, 36, fc), R(x0 + 4, -42, w - 8, 3, "#FFFFFF", pr(0.3)), R(x0 + 4, -9, w - 8, 3, INK, pr(0.2)));
  for (const lx of span(x0 + 10, x0 + w - 10, (w - 20) / Math.max(1, Math.round(w / 140)))) out.push(R(lx - 4, -46, 8, 46, tone(fc, "shade")), R(lx - 10, -3, 20, 3, "#6E7377"));
  out.push(R(x0 - 4, -52, w + 8, 7, tone(wood, "light")), R(x0 - 4, -45, w + 8, 8, wood), R(x - lw / 2, -34, lw, 18, "#F7F3EA"), R(x - lw / 2, -34, lw, 3, "#E8732A"));
  if (label.trim()) text.push({ text: label, x: x - lw / 2 + 2, y: -30, w: lw - 4, h: 13, size: 7, font: "print", color: "#C4302B", weight: 700 });
}

// ---- One building's front -----------------------------------------------------------------------------

/**
 * One building's front seen up close (the kit's `street` is a whole row of them), `kind` `apartment`, `school` or `public`:
 * `floors` upper floors over the ground floor (floor 0, the zemin kat), `bays` windows across `w` cm. Its plaster `color` (cream,
 * sand, ochre, rose, terracotta, mint, sage, sky, lilac, white, grey or a hex) or `material` `brick` or `stone`; `base` dresses
 * the ground floor in stone; `windows` `sash`, `arched` or `mixed` (round heads on the ground and top floors). `shutters`,
 * `balconies` and `boxes` are the share of windows with louvred shutters, of bays with a balcony up the front (iron rails, a
 * plant, a chair, a drying rack) and of windows with a window box; `ac` the share with an air conditioner under it; `geraniums`
 * floors whose windows all have boxes of geraniums; `laundry` and `dishes` how many washing lines and satellite dishes; `cumba`
 * a bay window up the door's bay; `cornice` the old moulded cornice and roof rail (the older look: hoods over the windows,
 * a wooden door); `tank` the old water tank up a ladder on the roof, and `chimneys` how many (`smoke` from the first); `age`
 * (0…1) damp, peeled plaster, cracks and stains. `ground` `flats` (barred windows) or `shops` (shopfronts, shutters part up);
 * `door` the bay of the street door (steps, a canopy, the blue number plate with `number`, the bells, a lamp); `doorArt` false leaves
 * the bay to a `door` piece of kind street (only the steps drawn);
 * `street` a street-name plate; `sign` the name over a school's or a public building's entrance, which has a flag pole
 * (`pole`). At night the windows light by turns; `lit` (floor numbers) light first, only in the place state `litState` when
 * one is given. `flags` is the share of balconies (and fewer windows) hung with a flag in the place state `flagState`
 * (default `flags`). The sills, the course over the ground floor, the door canopy, the cornice and the tank are perches.
 */
const facade: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "apartment"), school = kind === "school", apt = !school && kind !== "public", old = !!p.cornice;
  const floors = Math.round(Math.max(0, Math.min(8, num(p.floors, apt ? 5 : 2)))), bays = Math.round(Math.max(1, Math.min(12, num(p.bays, apt ? 3 : 6))));
  const w = num(p.w, bays * (apt ? 140 : 150)), bw = w / bays, G = old ? 400 : apt ? 360 : 420, F = apt ? 290 : 340, H = G + floors * F;
  const mat = str(p.material, apt ? "plaster" : school ? "brick" : "stone"), wins = str(p.windows, "sash"), col = hue(p.color, PLASTER, r.pick(Object.values(PLASTER)));
  const wall = mat === "brick" ? "#A9553C" : mat === "stone" ? "#DAD2C2" : col, trim = mat === "plaster" ? tone(col, "light") : "#EEE9DF", ledge = mat === "plaster" ? trim : STONE;
  const frame = !apt ? (school ? "#F2F0EA" : "#5C6670") : r.pick(old ? ["#7A5638", "#E9E4D8", "#56684E"] : ["#F2F0EA", "#F2F0EA", "#E9E4D8", "#7A5638"]);
  const shut = r.pick(["#4E7A5A", "#6B4A35", "#3F6A7A", "#7A8F6A", "#8C5A3C"]), ww = Math.min(bw * (apt ? 0.56 : 0.6), apt ? 105 : 130), wh = apt ? 170 : school ? 210 : 180, bars = school ? 3 : 2;
  const shutters = cl(num(p.shutters, apt ? 0.3 : 0)), balconies = cl(num(p.balconies, apt ? 0.45 : 0)), boxes = cl(num(p.boxes, apt ? 0.15 : 0));
  const acs = cl(num(p.ac, apt ? 0.2 : school ? 0 : 0.15)), flags = cl(num(p.flags, apt ? 0.5 : 0)), age = cl(num(p.age, apt ? 0.3 : 0.1));
  const floorsIn = (v: unknown) => new Set(Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
  const litF = floorsIn(p.lit), ger = floorsIn(p.geraniums), litState = str(p.litState, ""), flagState = str(p.flagState, "flags"), fc = countryOf(p.country);
  let laundry = Math.round(num(p.laundry, apt ? 1 : 0)), dishes = Math.round(num(p.dishes, apt ? 1 : 0));
  const db = Math.max(0, Math.min(bays - 1, Math.round(num(p.door, Math.floor(bays / 2))))), cb = p.cumba && floors > 0 ? db : -1, k1 = floors > 2 ? floors - 1 : floors;
  const bal = Array.from({ length: bays }, (_, i) => r() < balconies && i !== cb);
  const up: Shape[] = [], cum: Shape[] = [], front: Shape[] = [], roof: Shape[] = [], gr: Shape[] = [], leaf: Shape[] = [], wash: Shape[] = [], flagB: Shape[] = [], flagW: Shape[] = [], lamp: Shape[] = [];
  const text: TextSpec[] = [], lights: LightSpec[] = [], emitters: EmitSpec[] = [], flats: FlatSpec[] = [], pole: FlatSpec[] = [];
  const lit = { up: [] as Shape[], cum: [] as Shape[], gr: [] as Shape[] }, early = { up: [] as Shape[], cum: [] as Shape[], gr: [] as Shape[] };
  // a window lights by turns at night, or early on a `lit` floor
  const glowOf = (k: number, at: keyof typeof lit) => { const on = r() < 0.42; return litF.has(k) ? early[at] : on ? lit[at] : null; };

  // the upper floors' wall, worn
  const wallR = rect(-w / 2, -H, w, H - G);
  up.push(S(wallR, wall));
  if (mat === "brick") up.push(S(wallR, wall, bond("#D8CBB8", 26, 7.5)));
  else if (mat === "stone") up.push(S(wallR, wall, bond(tone(wall, "shade"), 120, 60, 0.5)));
  for (let i = Math.round(age * w * (H - G) / 40000); i > 0; i--) {
    const x = r.range(-w / 2 + 20, w / 2 - 20), y = r.range(-H + 30, -G - 20), k = r.int(0, 2);
    if (k === 0) up.push(P(blob(x, y, r.range(16, 44), r.range(12, 30), r), tone(wall, "shade"), pr(0.2)));
    else if (k === 1) up.push(P(blob(x, y, r.range(10, 24), r.range(7, 15), r), mat === "plaster" ? "#B98A6A" : tone(wall, "deep"), pr(0.55)));
    else up.push(L([[x, y], [x + r.range(-10, 10), y + 22], [x + r.range(-16, 16), y + 48]], tone(wall, "deep"), 0.9, 0.45));
  }
  if (school) for (const y of span(-H + 10, -G - 30, 44)) for (const s of [-1, 1]) up.push(R(s < 0 ? -w / 2 : w / 2 - (y % 88 ? 40 : 26), y, y % 88 ? 40 : 26, 22, trim));
  const dpx = r.chance(0.5) ? -w / 2 + 9 : w / 2 - 9;
  if (apt) up.push(R(dpx - 5, -H - 6, 10, H - G + 6, "#8E8A84"), R(dpx - 5, -H - 6, 3, H - G + 6, "#FFFFFF", pr(0.25)), S(many(span(-H + 60, -G - 40, 150).map(y => [dpx - 7, y, 14, 4])), "#6E6A64"));

  // a balcony across x0…x1 on floor level y0: things behind the rail, the slab, the rail, a flag, a dish
  const railKind = old ? 2 : r.int(0, 1), panel = r.pick(["#E9E4D8", "#B9C7C9", "#C9B79C", "#8FA3A8"]), slab = mat === "plaster" ? tone(col, "light") : STONE;
  const balcony = (x0: number, x1: number, y0: number) => {
    const bwid = x1 - x0, xm = r.range(x0 + 26, x1 - 26), it = r.int(0, 3), top = y0 - 98;
    if (it === 0) front.push(R(xm - 12, top + 54, 24, 30, "#B8562F"), P(blob(xm, top + 20, 26, 44, r), "#4E7A48"), P(blob(xm - 8, top + 6, 15, 24, r), "#6E9E5C"));
    else if (it === 1) front.push(S(rrect(xm - 22, top - 26, 44, 56, 8), "#F2F1EC"), R(xm - 15, top - 18, 30, 3, "#D8D6CE", pr()), R(xm - 15, top - 10, 30, 3, "#D8D6CE", pr()));
    else if (it === 2) front.push(...washing(x0 + 12, x1 - 12, top - 34, r));
    front.push(R(x0 - 4, y0 - 4, bwid + 8, 16, slab), R(x0 - 4, y0 - 4, bwid + 8, 3, "#FFFFFF", pr(0.3)), R(x0 - 2, y0 + 12, bwid + 4, 5, INK, pr(0.22)));
    if (railKind === 1) front.push(R(x0, top + 6, bwid, 78, panel), R(x0, top + 6, bwid, 3, tone(panel, "light"), pr(0.6)));
    else front.push(S(many(span(x0 + 5, x1 - 7, railKind ? 13 : 10.5).map(x => [x, top + 6, 2.2, 78])), IRON));
    if (railKind === 2) for (const x of span(x0 + 11.6, x1 - 12, 13)) front.push(ring(x, top + 16, 5.2, IRON, 1.5), ring(x, top + 72, 5.2, IRON, 1.5));
    front.push(R(x0 - 3, top, bwid + 6, 6, IRON), R(x0, y0 - 14, bwid, 4, IRON));
    if (r() < flags) flagB.push(...flag(xm - 42, top + 3, 84, 3, fc));
    if (dishes > 0 && r() < 0.5) { dishes--; front.push(...dish(x1 - 22, top - 22)); }
  };

  // the upper floors' windows, balconies and what hangs under the windows
  for (let k = 1; k <= floors; k++) {
    const y0 = -(G + (k - 1) * F), arch = wins === "arched" || (wins === "mixed" && k === floors);
    if ((old || school) && k > 1) up.push(R(-w / 2 - 4, y0 - 12, w + 8, 12, trim), R(-w / 2 - 4, y0, w + 8, 3, INK, pr(0.15)));
    for (let i = 0; i < bays; i++) {
      if (i === cb && k <= k1) continue;
      const x = -w / 2 + (i + 0.5) * bw - ww / 2, glow = glowOf(k, "up"), tall = bal[i], h = tall ? 226 : wh, y = tall ? y0 - 8 - h : y0 - 90 - h, ah = arch ? ww / 2 : 0;
      if (old || school) up.push(S(opening(x - 11, y - 11, ww + 22, h + 13, arch), trim));
      if (old) up.push(...(arch ? [R(x + ww / 2 - 7, y - 17, 14, 20, tone(trim, "light"))] : [R(x - 18, y - 26, ww + 36, 10, trim), R(x - 18, y - 16, ww + 36, 3, INK, pr(0.18))]));
      if (r() < shutters) panjur(up, x, y + ah, ww, h - ah, shut);
      glazing(up, glow, x, y, ww, h, arch, frame, r, bars);
      if (tall) { balcony(x - 30, x + ww + 30, y0); continue; }
      sill(up, x, y + h, ww, ledge);
      if (r() < boxes || ger.has(k)) flowerBox(up, x, y + h, ww, r, ger.has(k) || r.chance(0.6));
      if (school && k === 1 && r() < 0.5) cutouts(up, x, y, ww, h, r);
      const u = r();
      if (u < acs) acUnit(up, x + ww / 2 - 34 + r.range(-12, 12), y + h + 24);
      else if (laundry > 0 && i !== cb && u < acs + 0.3) { laundry--; wash.push(...washing(x - 28, x + ww + 28, y + h + 30, r)); }
      else if (u < acs + 0.3 + age * 0.6) up.push(R(x + ww * r.range(0.2, 0.8), y + h + 14, 3.5, r.range(30, 80), INK, pr(0.09)));
      if (r() < flags * 0.4) flagW.push(...flag(x + ww / 2 - 33, y + h + 12, 66, 2, fc));
    }
  }

  // the cumba: a bay window up the door's bay, on corbels
  if (cb >= 0) {
    const x0 = -w / 2 + cb * bw + bw * 0.02, cw = bw * 0.96, top = -(G + k1 * F) - 8, c2 = mat === "plaster" ? tone(col, "light") : trim, n = cw > 160 ? 3 : 2, w2 = (cw - 14 * (n + 1)) / n;
    cum.push(R(x0, top, cw, -G - top, c2), R(x0 + cw - 10, top, 10, -G - top, tone(c2, "shade"), pr(0.55)), R(x0 - 6, -G - 6, cw + 12, 14, trim));
    for (let k = 1; k <= k1; k++) {
      const y0 = -(G + (k - 1) * F), y = y0 - 90 - wh;
      if (k > 1) cum.push(R(x0 - 5, y0 - 14, cw + 10, 14, trim));
      for (let j = 0; j < n; j++) {
        const x = x0 + 14 + j * (w2 + 14);
        cum.push(R(x + 3, y0 - 74, w2 - 6, 52, tone(c2, "shade"), pr(0.3)), R(x + 7, y0 - 70, w2 - 14, 44, tone(c2, "light"), pr(0.35)));
        glazing(cum, glowOf(k, "cum"), x, y, w2, wh, false, frame, r, 1);
        sill(cum, x + 8, y + wh, w2 - 16, trim);
        if (ger.has(k)) flowerBox(cum, x, y + wh, w2, r, true);
      }
    }
    cum.push(R(x0 - 10, top - 16, cw + 20, 18, trim), R(x0 - 6, top - 25, cw + 12, 10, tone(trim, "light")), R(x0 - 10, top + 2, cw + 20, 4, INK, pr(0.2)));
    for (const f of [0.12, 0.5, 0.88]) { const x = x0 + cw * f; cum.push(P([[x - 9, -G + 8, 0], [x + 9, -G + 8, 0], [x + 7, -G + 20], [x + 2, -G + 48, 0], [x - 3, -G + 34], [x - 9, -G + 18]], trim), R(x + 3, -G + 10, 4, 30, INK, pr(0.12))); }
  }

  // the roofline: the old cornice and roof rail, a school's tiled roof, or a parapet
  if (old) {
    up.push(R(-w / 2 - 4, -H - 20, w + 8, 20, trim), S(many(span(-w / 2 + 2, w / 2 - 9, 13).map(x => [x, -H - 31, 7, 11])), trim));
    up.push(R(-w / 2 - 16, -H - 54, w + 32, 24, trim), R(-w / 2 - 16, -H - 31, w + 32, 4, INK, pr(0.2)), R(-w / 2 - 20, -H - 62, w + 40, 9, tone(trim, "light")));
    for (const x of span(-w / 2 + 12, w / 2 - 12, bw / 2)) up.push(P([[x - 8, -H - 31, 0], [x + 8, -H - 31, 0], [x + 6, -H - 22], [x + 1, -H - 6, 0], [x - 4, -H - 14]], trim), R(x + 3, -H - 30, 3, 22, INK, pr(0.15)));
    up.push(S(many(span(-w / 2 + 4, w / 2 - 6, 15).map(x => [x, -H - 138, 2.2, 76])), IRON), R(-w / 2, -H - 142, w, 5, IRON), R(-w / 2, -H - 70, w, 4, IRON));
  } else if (school) {
    const ro = "#B5583A", roofP = poly([[-w / 2 - 36, -H - 16], [w / 2 + 36, -H - 16], [w / 2 - 130, -H - 190], [-w / 2 + 130, -H - 190]]);
    up.push(S(roofP, ro), S(roofP, ro, { tile: { w: 20, h: 15, shapes: [R(0, 12, 20, 3, tone(ro, "deep"), pr(0.4)), R(0, 0, 1.5, 12, tone(ro, "deep"), pr(0.18))] } }), R(-w / 2 - 12, -H - 18, w + 24, 20, trim), R(-w / 2 - 12, -H + 2, w + 24, 4, INK, pr(0.2)));
  } else up.push(R(-w / 2 - 6, -H - 14, w + 12, 14, trim), R(-w / 2, -H - 76, w, 62, wall), R(-w / 2 - 8, -H - 86, w + 16, 11, trim), R(-w / 2 - 8, -H - 75, w + 16, 3, INK, pr(0.2)), R(-w / 2 - 6, -H, w + 12, 4, INK, pr(0.2)));
  while (dishes-- > 0) up.push(...dish(r.range(-w / 2 + 40, w / 2 - 40), -H - (old ? 168 : 112)));
  if (apt) for (let i = r.int(1, 2); i > 0; i--) { const y = -G - r.range(30, 150); up.push(L([[-w / 2, y], [r.range(-w / 4, w / 4), y + r.range(10, 22)], [w / 2, y + r.range(-6, 6)]], "#2B2B2B", 1.3, 0.85)); }

  // on the roof, set back: the old water tank on its legs with a ladder, chimneys, an aerial
  if (p.tank) {
    const tx = r.range(-w * 0.18, w * 0.18), tc = r.pick(["#9AA1A4", "#A8896E", "#C9C4B6"]), yb = -H - 150;
    roof.push(R(tx - 70, yb, 6, 150, IRON), R(tx + 64, yb, 6, 150, IRON), R(tx - 36, yb, 5, 150, tone(IRON, "light")), R(tx + 31, yb, 5, 150, tone(IRON, "light")));
    roof.push(L([[tx - 67, yb + 10], [tx + 67, yb + 70]], IRON, 2.5, 1), L([[tx + 67, yb + 10], [tx - 67, yb + 70]], IRON, 2.5, 1), R(tx - 74, yb - 4, 148, 6, IRON));
    roof.push(S(rrect(tx - 85, yb - 112, 170, 110, 34), tc), R(tx - 46, yb - 112, 5, 110, tone(tc, "shade"), pr(0.5)), R(tx + 41, yb - 112, 5, 110, tone(tc, "shade"), pr(0.5)), R(tx - 70, yb - 104, 140, 14, "#FFFFFF", pr(0.25)), R(tx - 16, yb - 122, 32, 12, tone(tc, "shade")));
    for (let j = 0; j < 3; j++) roof.push(R(tx + r.range(-70, 60), yb - r.range(70, 100), 4, r.range(30, 70), "#7A4A30", pr(0.3)));
    roof.push(R(tx + 92, yb - 112, 3, 262, IRON), R(tx + 118, yb - 112, 3, 262, IRON), S(many(span(yb - 100, -H - 10, 24).map(y => [tx + 92, y, 29, 2.5])), IRON));
  }
  const chim = Math.round(num(p.chimneys, 0));
  for (let c = 0; c < chim; c++) {
    const x = -w / 2 + w * (c + 0.5) / chim + r.range(-30, 30), h2 = r.range(130, 180), cc = old ? r.pick(["#B86A4E", wall]) : wall;
    roof.push(R(x - 20, -H - h2, 40, h2, cc), R(x + 10, -H - h2, 10, h2, tone(cc, "shade"), pr(0.5)), R(x - 25, -H - h2 - 10, 50, 12, tone(cc, "light")), R(x - 8, -H - h2 - 26, 16, 18, "#8A5A3C"));
    if (c === 0 && p.smoke) emitters.push({ kind: "smoke", x, y: H + h2 + 26, z: -50, w: 10 });
  }
  if (apt && !old && r.chance(0.5)) { const ax = r.range(-w * 0.35, w * 0.35); roof.push(L([[ax, -H], [ax, -H - 230]], "#6E7377", 2.2, 1), ...[0, 1, 2].map(j => L([[ax - 36 + j * 6, -H - 210 + j * 14], [ax + 36 - j * 6, -H - 210 + j * 14]], "#6E7377", 1.6, 1))); }

  // the ground floor: the wall (stone or the façade's), a plinth, the course over it (a ledge), the downpipe's foot
  const base = !!p.base, gw = base ? STONE : wall, gR = rect(-w / 2, -G, w, G), shops = str(p.ground, "flats") === "shops";
  gr.push(S(gR, gw));
  if (base) gr.push(S(gR, gw, bond(tone(STONE, "deep"), 90, 45, 0.35, 2.5)));
  else if (mat === "brick") gr.push(S(gR, gw, bond("#D8CBB8", 26, 7.5)));
  else if (mat === "stone") gr.push(S(gR, gw, bond(tone(gw, "shade"), 120, 60, 0.5)));
  gr.push(R(-w / 2, -50, w, 50, base ? tone(STONE, "shade") : STONE), R(-w / 2, -50, w, 3, "#FFFFFF", pr(0.3)));
  gr.push(R(-w / 2 - 8, -G - 14, w + 16, 18, trim), R(-w / 2 - 8, -G - 14, w + 16, 3, "#FFFFFF", pr(0.3)), R(-w / 2 - 6, -G + 4, w + 12, 4, INK, pr(0.2)));
  if (apt) gr.push(R(dpx - 5, -G - 14, 10, G - 4, "#8E8A84"), R(dpx - 7, -20, 14, 20, "#6E6A64"));
  for (let i = 0; i < bays; i++) {
    if (i === db) continue;
    const cx = -w / 2 + (i + 0.5) * bw, arch = wins !== "sash";
    if (shops) {
      const sw = bw * 0.84, oy = -290, open = r.pick([0.3, 0.7, 1]), cbot = oy + 26 + (1 - open) * (-oy - 26);
      gr.push(R(cx - sw / 2 - 6, oy - 46, sw + 12, 40, r.pick(["#B3261E", "#2E3A59", "#2F6B4A", "#3B3B40"])), R(cx - sw / 2, oy, sw, -oy, "#5A4A3E"));
      goodsRow(gr, cx - sw / 2 + 8, cx + sw / 2 - 8, -40, 26, r);
      gr.push(R(cx - sw / 2, oy + 30, sw, -oy - 40, "#CFE6EE", pr(0.16)), ...kepenk(cx - sw / 2, cx + sw / 2, oy, 0, open, r.pick(SHUTTERS), r));
      if (-10 - cbot > 4) lamp.push(R(cx - sw / 2, cbot, sw, -10 - cbot, "#FFE2A6", pr(0.7)));
      continue;
    }
    const gh = apt ? 150 : wh, y = -110 - gh, ah = arch ? ww / 2 : 0, g = opening(cx - ww / 2, y, ww, gh, arch);
    if (old || school) gr.push(S(opening(cx - ww / 2 - 11, y - 11, ww + 22, gh + 13, arch), trim));
    glazing(gr, glowOf(0, "gr"), cx - ww / 2, y, ww, gh, arch, frame, r, bars);
    if (school && r() < 0.6) cutouts(gr, cx - ww / 2, y, ww, gh, r);
    if (apt) gr.push(S(many([...span(cx - ww / 2 + 8, cx + ww / 2 - 10, 11).map(x => [x, y + ah * 0.3, 2.2, gh - ah * 0.3]), [cx - ww / 2, y + gh * 0.35, ww, 3], [cx - ww / 2, y + gh - 14, ww, 3]]), IRON, { clip: g }));
    sill(gr, cx - ww / 2, y + gh, ww, base ? tone(STONE, "light") : ledge);
  }

  // the street door: its surround and fanlight, steps, a canopy over it (a perch), the number plate, the bells, a lamp
  const dx = -w / 2 + (db + 0.5) * bw;
  let hinge = 0;
  if (apt && p.doorArt === false) {
    // the bay left for a `door` piece (kind street) with its own surround: only the two steps up to it
    const dw = 104, st = 32;
    gr.push(R(dx - dw / 2 - 26, -st, dw + 52, 16, STONE), R(dx - dw / 2 - 26, -st, dw + 52, 3, "#FFFFFF", pr(0.35)), R(dx - dw / 2 - 46, -16, dw + 92, 16, STONE), R(dx - dw / 2 - 46, -16, dw + 92, 3, "#FFFFFF", pr(0.35)));
  } else if (apt) {
    const dw = 104, dh = old ? 236 : 226, fan = old ? 52 : 38, st = 32, top = -st - dh - fan, side = dx > 0 ? -1 : 1;
    const dc = r.pick(old ? ["#4A5E46", "#5A3A2A", "#2F4A5A", "#6B2A2A"] : ["#6E5A48", "#8A8F94", "#4A4E52"]), fl = opening(dx - dw / 2 + 4, top + 4, dw - 8, fan - 4, old);
    gr.push(S(opening(dx - dw / 2 - 16, top - 16, dw + 32, dh + fan + 16, old), old ? tone(STONE, "light") : trim), R(dx - dw / 2, -st - dh, dw, dh, "#2E2A27"), S(opening(dx - dw / 2, top, dw, fan, old), frame), S(fl, GLASS));
    for (let j = 1; j < 6; j++) { const a = Math.PI + j * Math.PI / 6; gr.push(L([[dx, -st - dh], [dx + Math.cos(a) * dw / 2, -st - dh + Math.sin(a) * fan]], frame, 2.5, 1)); }
    gr.push(R(dx - dw / 2, -st - dh - 4, dw, 6, frame));
    if (r() < 0.6) lit.gr.push(S(fl, WARM, pr()));
    gr.push(R(dx - dw / 2 - 26, -st, dw + 52, 16, STONE), R(dx - dw / 2 - 26, -st, dw + 52, 3, "#FFFFFF", pr(0.35)), R(dx - dw / 2 - 46, -16, dw + 92, 16, STONE), R(dx - dw / 2 - 46, -16, dw + 92, 3, "#FFFFFF", pr(0.35)), R(dx - 30, -st + 4, 60, 4, INK, pr(0.1)));
    const cy = top - 22;
    if (old) gr.push(R(dx - dw / 2 - 32, cy - 12, dw + 64, 12, trim), R(dx - dw / 2 - 32, cy, dw + 64, 3, INK, pr(0.2)), ...[-1, 1].map(s => P([[dx + s * (dw / 2 + 22) - 6, cy, 0], [dx + s * (dw / 2 + 22) + 6, cy, 0], [dx + s * (dw / 2 + 22) + 3, cy + 24, 0], [dx + s * (dw / 2 + 22) - 2, cy + 10]], trim)));
    else gr.push(R(dx - dw / 2 - 44, cy - 16, dw + 88, 16, tone(wall, "light")), R(dx - dw / 2 - 44, cy - 16, dw + 88, 3, "#FFFFFF", pr(0.3)), R(dx - dw / 2 - 44, cy, dw + 88, 5, INK, pr(0.25)));
    const px = dx + side * (dw / 2 + 38) - (side < 0 ? 32 : 0), py = -st - 196;
    gr.push(R(px, py, 32, 24, "#F4F1EA"), R(px + 2, py + 2, 28, 20, "#1F3F7A"), S(rrect(px + 7, py + 40, 18, 34, 2), SET.steel), S(many(span(0, 7, 1).map(j => [px + 10 + (j % 2) * 8, py + 45 + Math.floor(j / 2) * 7, 4, 3])), "#5C6166", pr()));
    text.push({ text: str(p.number, String(r.int(2, 48))), x: px + 3, y: py + 3, w: 26, h: 18, size: 11, font: "print", color: "#FFFFFF" });
    const lx = px + 16, ly = py - 40;
    gr.push(R(lx - 1.5, ly + 18, 3, 8, IRON), S(rrect(lx - 7, ly, 14, 20, 2), IRON), R(lx - 5, ly + 3, 10, 14, "#F3E6C4"), P([[lx - 9, ly, 0], [lx + 9, ly, 0], [lx, ly - 7, 0]], IRON));
    lamp.push(R(lx - 5, ly + 3, 10, 14, "#FFE6A8", pr()), S(ellipse(lx, ly + 10, 20, 18), "#FFD98A", pr(0.25)));
    lights.push({ x: lx, y: -(ly + 10), z: 25, color: "#FFD59A", radius: 2.2, intensity: 0.5, switch: false, at: ["dusk", "night"] });
    const x0 = dx - dw / 2;
    hinge = x0;
    leaf.push(R(x0, -st - dh, dw, dh, dc), R(x0, -st - dh, 4, dh, tone(dc, "light"), pr(0.5)));
    if (old) leaf.push(R(x0 + 12, -st - dh + 14, dw - 24, dh * 0.42, GLASS), ...span(0, 5, 1).map(j => ring(x0 + 24 + (j % 3) * 28, -st - dh + 34 + Math.floor(j / 3) * 46, 11, IRON, 2)), R(x0 + 12, -st - dh * 0.46, dw - 24, dh * 0.36, tone(dc, "shade")), R(x0 + 18, -st - dh * 0.46 + 6, dw - 36, dh * 0.36 - 12, tone(dc, "light"), pr(0.3)), S(ellipse(x0 + dw - 14, -st - dh * 0.5, 4), "#C9A24A"));
    else leaf.push(R(x0 + 10, -st - dh + 10, dw - 20, dh - 54, GLASS), S(many(span(-st - dh + 34, -st - 54, 24).map(y => [x0 + 10, y, dw - 20, 3])), tone(dc, "shade")), R(x0, -st - 40, dw, 40, tone(dc, "shade")), R(x0 + dw - 16, -st - dh * 0.55, 5, 32, SET.steel));
    leaf.push(L([[x0 + 22, -st - dh * 0.55], [x0 + 46, -st - dh * 0.9]], "#FFFFFF", 4, 0.18));
  } else {
    // a school's or a public building's entrance: glazed double doors, wide steps, a canopy and the sign over it
    const ew = Math.min(bw * 0.9, 200), eh = 250, st = 48, top = -st - eh, sw = Math.min(w - 40, ew + 220), sign = str(p.sign, school ? "Feriköy İlkokulu" : "Göç İdaresi");
    gr.push(R(dx - ew / 2 - 14, top - 14, ew + 28, eh + 14, "#4A5058"), R(dx - ew / 2, top, ew, eh, "#2E2A27"), R(dx - ew / 2 + 6, top + 6, ew - 12, 40, GLASS), R(dx - ew / 2, top + 46, ew, 6, "#4A5058"));
    gr.push(R(dx, top + 52, ew / 2, eh - 52, "#4A5058"), R(dx + 7, top + 60, ew / 2 - 14, eh - 96, GLASS), R(dx + 10, top + eh * 0.55, 4, 30, SET.steel));
    lit.gr.push(R(dx - ew / 2 + 6, top + 6, ew - 12, 40, WARM, pr()));
    for (let j = 0; j < 3; j++) gr.push(R(dx - ew / 2 - 40 - j * 22, -st + j * 16, ew + 80 + j * 44, 16, STONE), R(dx - ew / 2 - 40 - j * 22, -st + j * 16, ew + 80 + j * 44, 3, "#FFFFFF", pr(0.35)));
    gr.push(R(dx - ew / 2 - 70, top - 52, ew + 140, 22, "#E9E4DA"), R(dx - ew / 2 - 70, top - 30, ew + 140, 5, INK, pr(0.25)));
    const sc = school ? "#F4F1EA" : "#1F3F7A", sy = top - 116;
    gr.push(R(dx - sw / 2 - 4, sy - 4, sw + 8, 62, school ? "#B3261E" : "#E9E4DA"), R(dx - sw / 2, sy, sw, 54, sc));
    if (!school) gr.push(...flag(dx - sw / 2 + 8, sy + 12, 46, 0, fc));
    if (sign.trim()) text.push({ text: sign, x: dx - sw / 2 + (school ? 10 : 62), y: sy + 6, w: sw - (school ? 20 : 72), h: 42, size: 22, font: "print", color: school ? "#B3261E" : "#FFFFFF", weight: 700 });
    hinge = dx - ew / 2;
    leaf.push(R(dx - ew / 2, top + 52, ew / 2, eh - 52, "#4A5058"), R(dx - ew / 2 + 7, top + 60, ew / 2 - 14, eh - 96, GLASS), R(dx - 14, top + eh * 0.55, 4, 30, SET.steel), L([[dx - ew / 2 + 20, top + eh * 0.8], [dx - ew / 2 + 50, top + eh * 0.35]], "#FFFFFF", 4, 0.18));
    // the flag pole before the building, its flag stirring
    if (p.pole !== false) {
      const fx = -w / 2 + bw * 0.5, hp = school ? 760 : 900;
      pole.push({ group: { shapes: [R(fx - 22, -18, 44, 18, STONE), R(fx - 14, -30, 28, 14, tone(STONE, "light")), R(fx - 3.5, -hp, 7, hp - 30, "#C9CCCB"), R(fx - 3.5, -hp, 2, hp - 30, "#FFFFFF", pr(0.4)), S(ellipse(fx, -hp - 6, 7), "#C9A24A")], edge: 0.6 }, z: 150, ppcm: Math.min(2, 1900 / hp) });
      pole.push({ group: { shapes: flag(0, 0, 150, 6, fc), edge: 0.5 }, x: fx + 3.5, y: hp - 12, z: 150.5, ppcm: 2, pick: false, move: { sway: { rot: 0.035, dy: 1, ms: 2400 }, phase: r() } });
    }
  }
  if (typeof p.street === "string" && p.street.trim()) {
    const sx = dx > 0 ? -w / 2 + 20 : w / 2 - 120;
    gr.push(R(sx, -G + 40, 100, 30, "#F4F1EA"), R(sx + 2, -G + 42, 96, 26, "#1F3F7A"));
    text.push({ text: p.street.trim(), x: sx + 5, y: -G + 45, w: 90, h: 20, size: 9, font: "print", color: "#FFFFFF" });
  }

  const pu = Math.min(1.3, 1900 / Math.max(w + 80, H - G + 260)), pg = Math.min(2.2, 1900 / (w + 100)), when = litState ? { when: { state: [litState] } } : {};
  if (roof.length) flats.push({ group: { shapes: roof, edge: 1 }, z: -50, ppcm: Math.min(1.6, 1900 / (w + 60)) });
  flats.push({ group: { shapes: up, edge: 1.1 }, ppcm: pu }, { group: { shapes: gr, edge: 0.9 }, z: 1, ppcm: pg, ...(text.length ? { text } : {}) });
  if (leaf.length) flats.push({ group: { shapes: leaf, edge: 0.8 }, z: 1.6, ppcm: pg, id: "leaf", hinge, swing: -1.2 });
  if (wash.length) flats.push({ group: { shapes: wash, edge: 0.5 }, z: 8, ppcm: pu });
  if (cum.length) flats.push({ group: { shapes: cum, edge: 1 }, z: 34, ppcm: pu, shadow: "drop" });
  if (front.length) flats.push({ group: { shapes: front, edge: 0.9 }, z: 40, ppcm: pu, shadow: "drop" });
  if (flagW.length) flats.push({ group: { shapes: flagW, edge: 0.5 }, z: 4, ppcm: pu, when: { state: [flagState] } });
  if (flagB.length) flats.push({ group: { shapes: flagB, edge: 0.5 }, z: 41, ppcm: pu, when: { state: [flagState] } });
  flats.push(...litByTurns(lit.up, { ppcm: pu, z: 0.2 }), ...litByTurns(lit.cum, { ppcm: pu, z: 34.2 }), ...litByTurns(lit.gr, { ppcm: pg, z: 1.2 }));
  for (const [sh, z, pp] of [[early.up, 0.2, pu], [early.cum, 34.2, pu], [early.gr, 1.2, pg]] as const) if (sh.length) flats.push(glowOnly(sh, { ppcm: pp, z, glowAt: 0.02, ...when }));
  if (lamp.length) flats.push(glowOnly(lamp, { ppcm: pg, z: 1.8, glowAt: 0.06 }));
  return { flats: [...flats, ...pole], lights, emitters };
}, variants: {
  apartment: { kind: "apartment", floors: 5, bays: 3 },
  apartment_old: { kind: "apartment", floors: 5, bays: 3, cornice: true, cumba: true, windows: "mixed", base: true, shutters: 0.7, balconies: 0.5, boxes: 0.1, ac: 0.12, geraniums: [5], tank: true, chimneys: 2, age: 0.75 },
  school: { kind: "school", floors: 2, bays: 7 },
  public: { kind: "public", floors: 3, bays: 6, ac: 0.25 },
},
  meta: {
    about: "One building's front up close: an apartment block, a school or a public building, its floors, windows, balconies and door.",
    params: {
      kind: { type: "enum", values: ["apartment", "school", "public"], default: "apartment" },
      floors: { type: "int", min: 0, max: 8, about: "upper floors over the ground floor (5 apartment, else 2)" },
      bays: { type: "int", min: 1, max: 12, about: "windows across (3 apartment, else 6)" },
      w: { type: "num", min: 0, about: "width, cm; default 140 or 150 per bay" },
      color: { type: "color", about: "the plaster: cream, sand, ochre, rose, terracotta, mint, sage, sky, lilac, white, grey or a hex; seeded" },
      material: { type: "enum", values: ["plaster", "brick", "stone"], about: "plaster (apartment), brick (school), stone (public)" },
      base: { type: "bool", default: false, about: "the ground floor dressed in stone" },
      windows: { type: "enum", values: ["sash", "arched", "mixed"], default: "sash", about: "mixed: round heads on the ground and top floors" },
      shutters: { type: "num", min: 0, max: 1, about: "share of windows with louvred shutters (0.3 apartment, else 0)" },
      balconies: { type: "num", min: 0, max: 1, about: "share of bays with balconies (0.45 apartment, else 0)" },
      boxes: { type: "num", min: 0, max: 1, about: "share of windows with a window box (0.15 apartment, else 0)" },
      ac: { type: "num", min: 0, max: 1, about: "share of windows with an air conditioner" },
      geraniums: { type: "list", about: "floor numbers whose windows all have geraniums" },
      laundry: { type: "int", min: 0, about: "washing lines (1 apartment, else 0)" },
      dishes: { type: "int", min: 0, about: "satellite dishes (1 apartment, else 0)" },
      cumba: { type: "bool", default: false, about: "a bay window up the door's bay" },
      cornice: { type: "bool", default: false, about: "the old moulded cornice and roof rail (the older look)" },
      tank: { type: "bool", default: false, about: "the old water tank on the roof" },
      chimneys: { type: "int", min: 0, default: 0 },
      smoke: { type: "bool", default: false, about: "smoke from the first chimney" },
      age: { type: "num", min: 0, max: 1, about: "damp, peeled plaster, cracks (0.3 apartment, else 0.1)" },
      ground: { type: "enum", values: ["flats", "shops"], default: "flats", about: "the ground floor: barred windows or shopfronts" },
      door: { type: "int", min: 0, max: 11, about: "the street door's bay; default the middle one" },
      doorArt: { type: "bool", default: true, about: "off: an apartment's door bay is left for a door piece (kind street) standing in it, the façade drawing only the steps" },
      number: { type: "text", about: "the door's number plate; seeded" },
      street: { type: "text", about: "a street-name plate's words" },
      sign: { type: "text", about: "the name over a school's or public building's entrance" },
      pole: { type: "bool", default: true, about: "a school's or public building's flag pole" },
      lit: { type: "list", about: "floor numbers lit first at night" },
      litState: { type: "text", about: "the place state the lit floors light in" },
      flags: { type: "num", min: 0, max: 1, about: "share of balconies (and fewer windows) hung with a flag (0.5 apartment, else 0)" },
      flagState: { type: "text", default: "flags", about: "the place state the flags show in" },
      country: { type: "enum", values: COUNTRIES, default: "tr", about: "whose flags hang on the balconies and the school's pole" },
    },
    states: ["flags"],
    terms: ["bina", "apartman", "okul"],
    tags: ["building"],
  } };

// ---- Shops -----------------------------------------------------------------------------------------

/** Each kind of shop: its sign, its fascia colours, the chance of an awning. */
const SHOPS: Record<string, [string, string[], number]> = {
  bakkal: ["BAKKAL", ["#B3261E", "#2E3A59", "#2F6B4A"], 1], firin: ["FIRIN", ["#7A3B1E", "#2E3A59", "#C8863F"], 0.4], eczane: ["ECZANE", ["#F7F5F0"], 0],
  cafe: ["Berfin'in Kafesi", ["#2F8C88", "#3F5A6E", "#C4553A"], 1], pastane: ["PASTANE", ["#2F4A3A", "#6B2A33"], 1], emlak: ["EMLAK", ["#1F3F7A", "#2B2B2B"], 0],
  cicekci: ["ÇİÇEKÇİ", ["#4E7A48", "#F7F3EA"], 1], shop: ["BUTİK", ["#2B2B2B", "#7A3E6E", "#F7F3EA", "#2E3A59"], 0.5],
};
/** A shop's goods and the sign it has. */
const WARES: Record<string, string> = { clothes: "BUTİK", shoes: "AYAKKABI", bags: "ÇANTA", books: "KİTAPÇI" };

/**
 * A shopfront at street level, `w` × `h` cm opening: piers, the fascia with the shop's `sign` as words (by `kind`: BAKKAL,
 * FIRIN, ECZANE, Berfin'in Kafesi, PASTANE, EMLAK, ÇİÇEKÇİ, or by a `shop`'s `goods`: clothes, shoes, bags, books), the display
 * window by `kind` (a bakkal's goods and simits with fruit crates outside; a fırın's loaves on racks, its flue above with smoke;
 * an eczane's shelves of boxes under a green cross that glows; a café's lamps, counter and table, a `menu` board and a table
 * outside unless `table` is false; a pastane's cakes; an emlak's listings; a çiçekçi's plants with buckets of flowers outside),
 * the glazed door (`door` `left` or `right`) that swings open, an `awning` (by seed, in `color`'s scheme), and the roller shutter
 * rolled to `open` (0 down … 1 up, the default). `n` shopfronts stand side by side, each its own (their signs from `signs`).
 * The fascia colour is `color`; the windows glow early at night.
 */
const frontage: PieceDef = { draw(p, r) {
  const kind = Object.hasOwn(SHOPS, str(p.kind, "")) ? str(p.kind, "") : "bakkal", [sign0, fascias, awn] = SHOPS[kind];
  const n = Math.round(Math.max(1, Math.min(6, num(p.n, 1)))), W = num(p.w, 300), H0 = num(p.h, 270), open = cl(num(p.open, 1)), signs = Array.isArray(p.signs) ? p.signs : [];
  const ppcm = Math.min(2.2, 1900 / (W + 20)), out = { flats: [] as FlatSpec[], lights: [] as LightSpec[], emitters: [] as EmitSpec[] };
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * (W + 6), goods = str(p.goods, r.pick(Object.keys(WARES)));
    const sign = typeof signs[i] === "string" ? signs[i] as string : i === 0 && typeof p.sign === "string" ? p.sign : kind === "shop" ? WARES[goods] ?? sign0 : i && kind === "cafe" ? "KAFE" : sign0;
    const fc = hue(i === 0 ? p.color : undefined, {}, r.pick(fascias)), ink = luma(fc) > 0.6 ? (kind === "eczane" ? "#D2232A" : INK) : kind === "pastane" ? "#E8C66A" : "#FFFFFF";
    const pier = r.pick(["#CFC6B4", "#E6D9BF", "#B9B2A6", "#D9C7A8"]), fr = r.pick(["#3E4A52", "#5B6770", "#6E5A48", "#2F3B36"]), riser = r.pick(["#7A8A8C", "#8C6A54", "#3E4A52", "#B9B2A6"]);
    const left = p.door === "left" || (p.door !== "right" && r.chance(0.5)), awning = typeof p.awning === "boolean" ? p.awning : r() < awn, [aa, ab] = r.pick(AWNINGS), sc = r.pick(SHUTTERS);
    const x0 = -W / 2 + 18, x1 = W / 2 - 18, gt = -H0 + 33, dW = 92, dx = left ? x0 : x1 - dW, wx0 = left ? x0 + dW + 8 : x0, wx1 = left ? x1 : x1 - dW - 8, sill = -46;
    const main: Shape[] = [], text: TextSpec[] = [], glow: Shape[] = [], lf: Shape[] = [], yard: Shape[] = [], menu: TextSpec[] = [];
    const back = kind === "eczane" ? "#D5DDDA" : kind === "pastane" ? "#E3CDBB" : kind === "cafe" ? "#8A6A50" : kind === "firin" ? "#C9B08E" : kind === "emlak" ? "#E6E1D6" : "#9C8B7A";
    main.push(R(-W / 2, -H0 - 82, W, H0 + 82, pier), R(-W / 2 - 4, -H0 - 86, W + 8, 10, tone(pier, "light")), R(-W / 2, -H0 - 76, W, 3, INK, pr(0.15)), R(x0, -H0, x1 - x0, H0, back), R(x0, -H0, x1 - x0, 50, INK, pr(0.2)));
    wares(main, glow, text, kind, goods, wx0 + 4, wx1 - 4, gt, sill, r);
    main.push(R(wx0 - 4, sill, wx1 - wx0 + 8, -sill, riser), R(wx0 + 6, sill + 8, wx1 - wx0 - 12, -sill - 16, tone(riser, "shade"), pr(0.5)), R(wx0 + 6, sill + 8, wx1 - wx0 - 12, 2, "#FFFFFF", pr(0.25)));
    main.push(R(wx0, gt, wx1 - wx0, sill - gt, "#CFE6EE", pr(0.12)), L([[wx0 + 20, sill - 20], [wx0 + 70, gt + 30]], "#FFFFFF", 5, 0.2), L([[wx0 + 50, sill - 12], [wx0 + 84, gt + 70]], "#FFFFFF", 2.5, 0.16));
    main.push(S(holed(rect(wx0 - 5, gt - 5, wx1 - wx0 + 10, sill - gt + 9), [rect(wx0 + 2, gt + 2, wx1 - wx0 - 4, sill - gt - 4)]), fr, { evenodd: true }));
    if (wx1 - wx0 > 160 && kind !== "emlak") main.push(R((wx0 + wx1) / 2 - 2.5, gt, 5, sill - gt, fr));
    main.push(R(x0 - 2, -H0 + 26, x1 - x0 + 4, 7, fr), R(dx, gt, dW, -gt, tone(back, "deep")));
    // the fascia and its sign
    main.push(R(x0 - 4, -H0 - 68, x1 - x0 + 8, 64, fc), R(x0 - 4, -H0 - 68, x1 - x0 + 8, 4, tone(fc, "light"), pr(0.7)), R(x0 - 4, -H0 - 8, x1 - x0 + 8, 4, tone(fc, "deep"), pr(0.6)));
    if (sign.trim()) text.push({ text: sign, x: x0 + 8, y: -H0 - 62, w: x1 - x0 - 16, h: 52, size: 28, font: "print", color: ink, weight: 700 });
    // the door's leaf, glazed, with a blank card hanging inside
    const dh = -gt;
    lf.push(S(holed(rect(dx, gt, dW, dh), [rect(dx + 9, gt + 9, dW - 18, dh - 44)]), fr, { evenodd: true }), R(dx + 9, gt + 9, dW - 18, dh - 44, "#CFE6EE", pr(0.2)), R(left ? dx + dW - 17 : dx + 12, gt + dh * 0.45, 5, 32, SET.steel), L([[dx + 18, gt + dh * 0.7], [dx + 40, gt + dh * 0.3]], "#FFFFFF", 3, 0.25));
    lf.push(L([[dx + dW / 2 - 9, gt + 26], [dx + dW / 2, gt + 15], [dx + dW / 2 + 9, gt + 26]], "#3B3B40", 0.8, 1), S(rrect(dx + dW / 2 - 14, gt + 26, 28, 15, 2), "#F7F3EA"), R(dx + dW / 2 - 11, gt + 29, 22, 9, kind === "eczane" ? "#3FA05A" : "#2F8C88", pr()));
    // inside lights up where the shutter is not down
    const cb = -H0 + 26 + (1 - open) * (H0 - 26), gy = Math.max(gt, cb), dy = Math.max(gt + 9, cb);
    if (sill - gy > 4) glow.push(R(wx0, gy, wx1 - wx0, sill - gy, "#FFE2A6", pr(0.5)));
    if (-35 - dy > 4) glow.push(R(dx + 9, dy, dW - 18, -35 - dy, "#FFE2A6", pr(0.5)));
    if (kind === "firin") {
      const fx = left ? x1 - 26 : x0 + 26;
      main.push(R(fx - 8, -H0 - 300, 16, 220, "#4A4A4E"), R(fx - 8, -H0 - 300, 4, 220, "#FFFFFF", pr(0.2)), S(many([[fx - 10, -H0 - 160, 20, 5], [fx - 10, -H0 - 240, 20, 5]]), "#3B3B40"), P([[fx - 18, -H0 - 300, 0], [fx + 18, -H0 - 300, 0], [fx, -H0 - 318, 0]], "#3B3B40"));
      out.emitters.push({ kind: "smoke", x: ox + fx, y: H0 + 312, w: 10 });
    } else if (kind === "eczane") {
      const ex = left ? x0 + 30 : x1 - 30, ey = -H0 - 124, plus = (c: string, o: Partial<Shape> = {}) => [R(ex - 7, ey - 20, 14, 40, c, o), R(ex - 20, ey - 7, 40, 14, c, o)];
      main.push(R(ex - 30, ey - 30, 60, 60, "#F4F1EA"), R(ex - 30, ey + 26, 60, 4, INK, pr(0.15)), R(ex - 3, ey + 30, 6, 12, IRON), ...plus("#2E9E4A"));
      glow.push(...plus("#5CE07A", pr()), S(ellipse(ex, ey, 40), "#5CE07A", pr(0.2)));
    }
    // out on the pavement: crates, buckets, a menu board and a table
    if (kind === "bakkal") crates(yard, wx0 + 4, Math.min(wx1 - 4, wx0 + 180), r);
    else if (kind === "cicekci") buckets(yard, wx0, wx1, r);
    else if (kind === "cafe") {
      const mx = left ? x1 - 40 : x0 + 40;
      yard.push(L([[mx - 24, 0], [mx - 18, -96]], SET.wood_dark, 3, 1), L([[mx + 24, 0], [mx + 18, -96]], SET.wood_dark, 3, 1), S(rrect(mx - 27, -102, 54, 72, 2), SET.wood), R(mx - 23, -98, 46, 64, "#2F3B36"));
      menu.push({ text: str(p.menu, "Çay\nKahve\nTost"), x: mx - 20, y: -95, w: 40, h: 58, size: 7, font: "hand", color: "#F4F1EA" });
      if (p.table !== false) {
        const tx = left ? x0 + dW + 70 : x1 - dW - 70;
        yard.push(S(rrect(tx - 58, -48, 26, 6, 2), "#3B3B40"), R(tx - 47, -42, 4, 42, "#3B3B40"), S(rrect(tx + 32, -48, 26, 6, 2), "#3B3B40"), R(tx + 43, -42, 4, 42, "#3B3B40"));
        yard.push(S(ellipse(tx, -74, 34, 4), SET.wood_light), R(tx - 2, -72, 4, 70, "#3B3B40"), S(ellipse(tx, -2, 16, 3), "#3B3B40"), ...tea(tx - 12, -76), ...tea(tx + 12, -76));
      }
    }
    out.flats.push({ group: { shapes: main, edge: 0.8 }, x: ox, ppcm, ...(text.length ? { text } : {}) }, { group: { shapes: lf, edge: 0.7 }, x: ox, z: 0.6, ppcm, id: "leaf", hinge: left ? dx : dx + dW, swing: left ? -1.2 : 1.2 });
    if (glow.length) out.flats.push(glowOnly(glow, { x: ox, z: 0.8, ppcm, glowAt: 0.1 }));
    out.flats.push({ group: { shapes: kepenk(x0, x1, -H0, 0, open, sc, r), edge: 0.6 }, x: ox, z: 1.5, ppcm });
    if (awning) out.flats.push({ group: { shapes: tente(x0 - 8, x1 + 8, -H0 + 4, 44, aa, ab), edge: 0.7 }, x: ox, z: 30, ppcm, shadow: "drop" });
    if (yard.length) out.flats.push({ group: { shapes: yard, edge: 0.6 }, x: ox, z: 50, ppcm: 2.4, ...(menu.length ? { text: menu } : {}) });
    if (open > 0.2) out.lights.push({ x: ox, y: H0 * 0.5, z: 80, color: "#FFE2A6", radius: 2.6, intensity: 0.5, switch: false, at: ["dusk", "night"] });
  }
  return out;
}, variants: {
  shop: { kind: "shop" }, firin: { kind: "firin" }, eczane: { kind: "eczane" }, cafe: { kind: "cafe" }, pastane: { kind: "pastane" },
  bakkal: { kind: "bakkal" }, cicekci: { kind: "cicekci" }, emlak: { kind: "emlak" },
},
  meta: {
    about: "A shopfront at street level: a bakkal, fırın, eczane, café, pastane, emlak, çiçekçi or a shop, its window, door and shutter.",
    params: {
      kind: { type: "enum", values: ["bakkal", "firin", "eczane", "cafe", "pastane", "emlak", "cicekci", "shop"], default: "bakkal" },
      goods: { type: "enum", values: ["clothes", "shoes", "bags", "books"], about: "a shop's goods; seeded" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "shopfronts side by side" },
      w: { type: "num", min: 0, default: 300, about: "opening width, cm" },
      h: { type: "num", min: 0, default: 270, about: "opening height, cm" },
      open: { type: "num", min: 0, max: 1, default: 1, about: "the roller shutter: 0 down … 1 up" },
      sign: { type: "text", about: "the first shop's sign; default by kind" },
      signs: { type: "list", about: "each shopfront's sign" },
      color: { type: "color", about: "the first fascia's colour; seeded" },
      door: { type: "enum", values: ["left", "right"], about: "the door's side; seeded" },
      awning: { type: "bool", about: "an awning; seeded by kind" },
      menu: { type: "text", default: "Çay\nKahve\nTost", about: "a café's menu board" },
      table: { type: "bool", default: true, about: "a café's table outside" },
    },
    terms: ["dükkan", "bakkal", "fırın", "eczane", "kafe", "pastane", "emlakçı", "çiçekçi"],
    tags: ["shop", "food"],
  } };

/**
 * A shop's awning `w` cm wide: its cloth sloping `drop` cm out from the wall to a scalloped valance, striped in `color` and
 * `color2` (`striped`, by seed) or plain `color`. Its front edge is a perch. As a prop, `n` hang side by side.
 */
const awning: PieceDef = { draw(p, r) {
  const w = num(p.w, 240), drop = num(p.drop, 55), n = Math.round(Math.max(1, Math.min(6, num(p.n, 1)))), sh: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = r.pick(AWNINGS), striped = typeof p.striped === "boolean" ? p.striped : r.chance(0.65), x = (i - (n - 1) / 2) * (w + 20);
    sh.push(...tente(x - w / 2, x + w / 2, -drop - 24, drop, hue(p.color, {}, a), striped ? hue(p.color2, {}, b === a ? "#F4F1EA" : b) : null));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: Math.min(3, 1900 / (n * (w + 20))), id: "awning", shadow: "drop" }] };
},
  meta: {
    about: "A shop's awning sloping out from the wall to a scalloped valance, striped or plain.",
    params: {
      w: { type: "num", min: 0, default: 240, about: "width, cm" },
      drop: { type: "num", min: 0, default: 55, about: "how far it slopes down, cm" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "awnings side by side" },
      striped: { type: "bool", about: "striped or plain; seeded" },
      color: { type: "color", about: "a hex; seeded" },
      color2: { type: "color", about: "the stripes' second colour, a hex; seeded" },
    },
    tags: ["shop"],
  } };

/** A roller shutter (kepenk) over an opening `w` × `h`: its box on top, the guides, the slatted curtain rolled to `open` (0 down and padlocked, the default … 0.5 half … 1 up, only the box), in `color` (galvanised by seed), now and then tagged or rust-streaked. */
const shutter: PieceDef = { draw(p, r) {
  const w = num(p.w, 300), h = num(p.h, 260);
  return { flats: [{ group: { shapes: kepenk(-w / 2, w / 2, -h - 26, 0, num(p.open, 0), hue(p.color, {}, r.pick(SHUTTERS)), r), edge: 0.6 }, ppcm: Math.min(2.4, 1900 / (w + 30)), reveal: "down" }] };
},
  meta: {
    about: "A roller shutter (kepenk) over an opening, rolled down and padlocked, part way, or up.",
    params: {
      w: { type: "num", min: 0, default: 300, about: "width, cm" },
      h: { type: "num", min: 0, default: 260, about: "opening height, cm" },
      open: { type: "num", min: 0, max: 1, default: 0, about: "0 down … 1 up" },
      color: { type: "color", about: "a hex; galvanised grey by seed" },
    },
    terms: ["kepenk"],
    tags: ["shop"],
  } };

// ---- Street furniture -------------------------------------------------------------------------------

/**
 * A cast-iron lamp post `h` cm tall in `color` (dark green or black by seed), `kind` `street` (the classic Istanbul post: a
 * fluted shaft on a flared foot, a ladder bar, a four-sided lantern on a scrolled neck) or `pier` (a double lamp: two lanterns
 * on a scrolled cross arm). Its lanterns glow early in the evening, never on the place's switch, and cast a warm light.
 * The ladder bar, the arm and the lantern caps are perches.
 */
const lampPost: PieceDef = { draw(p, r) {
  const pier = str(p.kind, "street") === "pier", h = num(p.h, pier ? 400 : 430), c = hue(p.color, {}, pier ? "#2E3B35" : r.pick(["#2F4038", "#2A2C2E", "#2E3A4A"])), gold = "#C9A24A";
  const sh: Shape[] = [], glow: Shape[] = [], lights: LightSpec[] = [], top = -h + (pier ? 74 : 96);
  sh.push(P([[-22, 0, 0], [22, 0, 0], [18, -12, 0], [12, -22], [10, -64, 0], [-10, -64, 0], [-12, -22], [-18, -12, 0]], c), R(-24, -6, 48, 6, tone(c, "light")), R(-13, -72, 26, 9, c), R(-13, -72, 26, 2, gold, pr(0.8)));
  sh.push(P([[-8, -64, 0], [8, -64, 0], [5, top, 0], [-5, top, 0]], c), L([[-3, -70], [-2, top + 4]], tone(c, "light"), 1.2, 0.5), L([[3, -70], [2, top + 4]], tone(c, "deep"), 1.2, 0.5));
  sh.push(R(-9, -h * 0.45, 18, 8, c), R(-9, -h * 0.45, 18, 2, gold, pr(0.7)));
  const lantern = (x: number, y: number, s: number) => {
    const glass = poly([[x - 8 * s, y - 9 * s], [x + 8 * s, y - 9 * s], [x + 11 * s, y - 37 * s], [x - 11 * s, y - 37 * s]]);
    sh.push(R(x - 9 * s, y - 6 * s, 18 * s, 6 * s, c), P([[x - 11 * s, y - 6 * s, 0], [x + 11 * s, y - 6 * s, 0], [x + 15 * s, y - 40 * s, 0], [x - 15 * s, y - 40 * s, 0]], c), S(glass, "#F3E6C4"), L([[x, y - 9 * s], [x, y - 37 * s]], c, 1.6, 1));
    sh.push(P([[x - 19 * s, y - 40 * s, 0], [x + 19 * s, y - 40 * s, 0], [x + 6 * s, y - 55 * s], [x, y - 61 * s, 0], [x - 6 * s, y - 55 * s]], c), R(x - 19 * s, y - 42 * s, 38 * s, 2.5, gold, pr(0.7)), S(ellipse(x, y - 63 * s, 3 * s), gold));
    glow.push(S(glass, "#FFE6A8", pr()), S(ellipse(x, y - 23 * s, 36 * s, 32 * s), "#FFD98A", pr(0.22)));
    lights.push({ x, y: -(y - 23 * s), z: 20, color: "#FFD59A", radius: pier ? 3.5 : 4.2, intensity: 0.85, switch: false, at: ["dawn", "dusk", "night"] });
  };
  if (!pier) {
    sh.push(R(-30, top + 26, 60, 5, c), S(ellipse(-30, top + 28.5, 3.5), gold), S(ellipse(30, top + 28.5, 3.5), gold));
    for (const s of [-1, 1]) sh.push({ path: smooth([[s * 4, top + 4], [s * 15, top - 2], [s * 13, top - 12], [s * 6, top - 9]], false), stroke: { color: c, width: 2.6, cap: "round" } });
    sh.push(R(-6, top - 6, 12, 10, c));
    lantern(0, top - 4, 1.4);
  } else {
    const ax = 54;
    sh.push(S(band([[-ax, top - 2], [-ax * 0.5, top + 10], [0, top + 3], [ax * 0.5, top + 10], [ax, top - 2]], [5, 5, 6, 5, 5]), c), R(-6, top - 14, 12, 18, c), P([[-6, top - 14, 0], [6, top - 14, 0], [0, top - 34, 0]], c), S(ellipse(0, top - 36, 3.5), gold));
    for (const s of [-1, 1]) sh.push(ring(s * ax * 0.45, top + 18, 6, c, 2.2), ring(s * ax * 0.78, top + 14, 4.5, c, 2));
    lantern(-ax, top - 2, 1.1); lantern(ax, top - 2, 1.1);
  }
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, emissive: { shapes: glow, edge: 0 }, switch: false, glowAt: 0.05, ppcm: Math.min(2.4, 1900 / (h + 80)) }], lights };
}, variants: { street: { kind: "street" }, pier: { kind: "pier" } },
  meta: {
    about: "A cast-iron lamp post, the classic Istanbul street lamp or a pier's double lamp, glowing in the evening.",
    params: {
      kind: { type: "enum", values: ["street", "pier"], default: "street" },
      h: { type: "num", min: 0, about: "height, cm (430 street, 400 pier)" },
      color: { type: "color", about: "a hex; dark green or black by seed" },
    },
    terms: ["lamba"],
    tags: ["light", "street"],
  } };

/**
 * Front steps of a building or a campus: `n` stone steps (`rise` cm each) `w` cm wide, a little narrower going up, between
 * two cheeks; worn in the middle, chipped at the nosings, a slab joint here and there; `rail` (by seed) a handrail up each side.
 * People sit on them.
 */
const steps: PieceDef = { draw(p, r) {
  const n = Math.round(Math.max(1, Math.min(12, num(p.n, 3)))), w = num(p.w, 240), rise = num(p.rise, 16), c = hue(p.color, {}, r.pick([STONE, "#D6CEBE", "#BDB5A6", "#C9BFA9"])), H = n * rise, k = 3;
  const sh: Shape[] = [], rail = typeof p.rail === "boolean" ? p.rail : r.chance(0.5);
  for (const s of [-1, 1]) sh.push(P([[s * (w / 2 + 30), 0, 0], [s * w / 2, 0, 0], [s * (w / 2 - k * (n - 1)), -H - 10, 0], [s * (w / 2 - k * (n - 1) + 30), -H - 10, 0]], tone(c, "shade")), P([[s * (w / 2 + 34), -10, 0], [s * (w / 2 - 4), -10, 0], [s * (w / 2 - k * (n - 1) - 4), -H - 18, 0], [s * (w / 2 - k * (n - 1) + 34), -H - 18, 0], [s * (w / 2 - k * (n - 1) + 34), -H - 10, 0], [s * (w / 2 + 34), -2, 0]], c));
  for (let j = n - 1; j >= 0; j--) {
    const y = -(j + 1) * rise, hw = w / 2 - k * j;
    sh.push(R(-hw, y, 2 * hw, rise, c), R(-hw, y, 2 * hw, 4, tone(c, "light")), R(-hw, y + rise - 3, 2 * hw, 3, tone(c, "shade"), pr(0.5)), P(blob(r.range(-w * 0.12, w * 0.12), y + 2.5, w * 0.16, 1.8, r), tone(c, "deep"), pr(0.16)));
    for (let i = r.int(0, 2); i > 0; i--) sh.push(R(r.range(-hw, hw - 8), y, r.range(3, 8), 2.5, tone(c, "deep"), pr(0.35)));
    for (const x of span(-hw + r.range(40, 90), hw - 30, r.range(70, 120))) sh.push(L([[x, y + 4], [x, y + rise]], tone(c, "deep"), 0.8, 0.4));
  }
  if (rail) for (const s of [-1, 1]) {
    const xb = s * (w / 2 - 12), xt = s * (w / 2 - 12 - k * (n - 1));
    sh.push(L([[xb, -10], [xb, -100]], IRON, 3, 1), L([[xt, -H], [xt, -H - 90]], IRON, 3, 1), L([[xb, -100], [xt, -H - 90]], IRON, 4, 1), S(ellipse(xb, -101, 3.5), IRON));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, ppcm: Math.min(2.4, 1900 / (w + 80)) }] };
},
  meta: {
    about: "Worn stone front steps between two cheeks, with a handrail up each side by seed.",
    params: {
      n: { type: "int", min: 1, max: 12, default: 3, about: "how many steps" },
      w: { type: "num", min: 0, default: 240, about: "width, cm" },
      rise: { type: "num", min: 0, default: 16, about: "each step's height, cm" },
      color: { type: "color", about: "a hex; seeded stone" },
      rail: { type: "bool", about: "handrails; seeded" },
    },
    terms: ["merdiven"],
    tags: ["street"],
  } };

/**
 * A low garden wall `w` × `h` in `color` (a plaster name or a hex): a stone coping where cats sleep, piers at its ends
 * (`piers`, default on), the plaster peeled here and there to the bricks, rain stains, sometimes ivy over the front; behind
 * it the garden's bushes show over the top (`green`, default on).
 */
const gardenWall: PieceDef = { draw(p, r) {
  const w = num(p.w, 400), h = num(p.h, 110), c = hue(p.color, PLASTER, r.pick([PLASTER.cream, PLASTER.ochre, PLASTER.white, PLASTER.rose, PLASTER.sand])), cap = r.pick([STONE, "#BDB5A6", "#D9D2C2"]);
  const sh: Shape[] = [], back: Shape[] = [], ends = p.piers === false ? [] : [-w / 2, w / 2];
  if (p.green !== false) for (let x = -w / 2 + r.range(10, 50); x < w / 2 - 10; x += r.range(55, 120)) back.push(P(blob(x, -h - r.range(20, 50), r.range(32, 60), r.range(26, 50), r, 8), r.pick(GREENS)), P(blob(x - 10, -h - r.range(40, 60), r.range(14, 24), r.range(12, 20), r), "#7FAE68"));
  sh.push(R(-w / 2, -h, w, h, c));
  for (let i = Math.round(w / 170); i > 0; i--) {
    const pt = smooth(blob(r.range(-w / 2 + 24, w / 2 - 24), r.range(-h + 26, -24), r.range(12, 30), r.range(8, 16), r), true);
    sh.push(S(pt, "#B07A60", pr()), S(pt, "#B07A60", bond("#E2D6C4", 24, 7, 0.7)), { path: pt, stroke: { color: tone(c, "shade"), width: 1.6 }, flat: true, opacity: 0.7 });
  }
  for (let i = Math.round(w / 70); i > 0; i--) sh.push(R(r.range(-w / 2, w / 2 - 10), -h + 6, r.range(3, 10), r.range(20, h * 0.7), INK, pr(0.07)));
  sh.push(R(-w / 2, -18, w, 18, tone(c, "shade"), pr(0.35)), R(-w / 2 - 6, -h - 12, w + 12, 12, cap), R(-w / 2 - 6, -h - 12, w + 12, 3, tone(cap, "light")), R(-w / 2 - 4, -h, w + 8, 4, INK, pr(0.2)));
  for (const x of span(-w / 2 + 60, w / 2 - 20, 60)) sh.push(L([[x, -h - 11], [x, -h]], tone(cap, "deep"), 0.8, 0.5));
  for (const x of ends) sh.push(R(x - 22, -h - 36, 44, h + 36, tone(c, "light")), R(x + 10, -h - 36, 12, h + 36, tone(c, "shade"), pr(0.4)), R(x - 27, -h - 46, 54, 12, cap), R(x - 27, -h - 46, 54, 3, tone(cap, "light")));
  if (r.chance(0.5)) { const ix = r.range(-w / 3, w / 3); for (let j = 0; j < 26; j++) sh.push(S(ellipse(ix + r.range(-18, 18) * (1 - j / 34), -h - 8 + j * 3, r.range(4, 6.5), r.range(3, 4.5)), r.pick(GREENS))); }
  return { flats: [...(back.length ? [{ group: { shapes: back, edge: 0.8 }, z: -20, ppcm: Math.min(1.6, 1900 / (w + 120)) }] : []), { group: { shapes: sh, edge: 0.9 }, ppcm: Math.min(2.2, 1900 / (w + 60)) }] };
},
  meta: {
    about: "A low plastered garden wall under a stone coping, with piers, peeled plaster, and the garden's bushes behind.",
    params: {
      w: { type: "num", min: 0, default: 400, about: "length, cm" },
      h: { type: "num", min: 0, default: 110, about: "height, cm" },
      color: { type: "color", about: "a plaster name or a hex; seeded" },
      piers: { type: "bool", default: true, about: "piers at its ends" },
      green: { type: "bool", default: true, about: "bushes showing over the top" },
    },
    terms: ["duvar", "bahçe"],
    tags: ["wall"],
  } };

/**
 * A bench, `kind` `street` (a park bench: wooden slats on cast-iron ends, `w` 180 cm) or `deck` (a ferry's long deck bench, `w`
 * 320: a painted frame, varnished slats, the life-jacket locker under the seat marked `label`, default "CAN YELEĞİ"). The seat
 * is 45 cm up. As a prop, `n` benches stand side by side.
 */
const bench: PieceDef = { draw(p, r) {
  const deck = str(p.kind, "street") === "deck", n = Math.round(Math.max(1, Math.min(6, num(p.n, 1)))), w = num(p.w, deck ? 320 : 180), sh: Shape[] = [], text: TextSpec[] = [];
  for (let i = 0; i < n; i++) benchArt(sh, text, deck, (i - (n - 1) / 2) * (w + 40), w, r, str(p.label, "CAN YELEĞİ"));
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: Math.min(2.6, 1900 / (n * (w + 40))), id: "bench", ...(text.length ? { text } : {}) }] };
}, variants: { street: { kind: "street" }, deck: { kind: "deck" } },
  meta: {
    about: "A bench: a park bench of slats on cast-iron ends, or a ferry's long deck bench over a life-jacket locker.",
    params: {
      kind: { type: "enum", values: ["street", "deck"], default: "street" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "benches side by side" },
      w: { type: "num", min: 0, about: "length, cm (180 street, 320 deck)" },
      label: { type: "text", default: "CAN YELEĞİ", about: "the deck locker's words" },
    },
    terms: ["bank"],
    tags: ["seating"],
  } };

/**
 * A street or park tree `h` cm tall: a trunk forking into limbs, a canopy of layered leaf clumps by `season` (`summer`;
 * `autumn`, oranges and yellows, a few leaves falling and some on the ground; `bare`, only branches and twigs), its foot
 * whitewashed (`whitewash`, by seed). One long branch reaches out of the canopy on the `side` (`left`, `right`, by seed)
 * at `perch` cm up: a perch. The canopy stirs a little.
 */
const tree: PieceDef = { draw(p, r) {
  const h = num(p.h, 520), season = str(p.season, "summer"), bare = season === "bare", autumn = season === "autumn", side = p.side === "left" ? -1 : p.side === "right" ? 1 : r.chance(0.5) ? 1 : -1;
  const bark = r.pick(["#6B5444", "#5E5248", "#7A6656"]), fork = -h * 0.42, cr = h * 0.32, cy = -h + cr * 0.95, py = -num(p.perch, h * 0.6);
  const leaves = autumn ? r.pick([["#B5652A", "#D98A2B", "#EDB54A"], ["#A84A2A", "#D0702E", "#E8A13A"], ["#9A7A2A", "#C9A23A", "#E8C85A"]]) : r.pick([["#3F6B3E", "#5E8F52", "#86B56A"], ["#355E45", "#4E7A58", "#7FA86E"]]);
  const trunk: Shape[] = [], crown: Shape[] = [], flats: FlatSpec[] = [];
  const tp = band([[0, 0], [r.range(-4, 4), fork * 0.5], [r.range(-6, 6), fork]], [h * 0.075, h * 0.06, h * 0.045]);
  trunk.push(S(ellipse(0, -2, h * 0.13, 5), "#5A4A3C", pr(0.45)), P([[-h * 0.065, 0, 0], [h * 0.065, 0, 0], [h * 0.04, -16], [-h * 0.04, -16]], bark), S(tp, bark), S(tp, tone(bark, "shade"), { flat: true, opacity: 0.5, clip: rect(h * 0.005, fork - 10, h * 0.06, -fork + 10) }));
  for (let i = 0; i < 4; i++) { const x = r.range(-h * 0.03, h * 0.02); trunk.push(L([[x, -r.range(10, 40)], [x + r.range(-3, 3), fork * r.range(0.4, 0.8)]], tone(bark, "deep"), 1.1, 0.5)); }
  if (typeof p.whitewash === "boolean" ? p.whitewash : r.chance(0.5)) trunk.push(R(-h * 0.08, -100, h * 0.16, 100, "#F2EFE6", { flat: true, clip: tp }));
  // limbs up into the crown, and their twigs (all there is in winter)
  const limb = (pts: Vec2[], wd: number) => crown.push(S(band(pts, [wd, wd * 0.7, wd * 0.3]), bark));
  const twig = (x: number, y: number, a: number, len: number, d: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    crown.push(L([[x, y], [x2, y2]], bark, Math.max(0.8, d * 1.6), 1));
    if (d > 0) for (const da of [-0.45, 0.4]) twig(x2, y2, a + da + r.range(-0.15, 0.15), len * 0.68, d - 1);
  };
  const clumps = (n: number, c: string, rr: number, bias: number) => { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n - 0.5) * Math.PI * 1.7 + r.range(-0.2, 0.2) - bias, d = cr * r.range(0.3, 0.72); crown.push(P(blob(Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.85 + cr * 0.1, cr * rr * r.range(0.8, 1.15), cr * rr * r.range(0.7, 1), r, 8), c)); } };
  if (!bare) clumps(7, leaves[0], 0.5, 0);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.48 + r.range(-0.12, 0.12), l = cr * r.range(0.75, 1);
    limb([[0, fork], [Math.cos(a) * l * 0.5, fork + Math.sin(a) * l * 0.5], [Math.cos(a) * l, fork + Math.sin(a) * l]], h * 0.035);
    if (bare) twig(Math.cos(a) * l, fork + Math.sin(a) * l, a, cr * 0.35, 3);
  }
  if (!bare) clumps(7, leaves[1], 0.42, 0);
  limb([[0, py + 34], [side * cr * 0.6, py + 6], [side * cr * 1.3, py]], h * 0.03);
  if (bare) twig(side * cr * 1.3, py, side > 0 ? -0.3 : Math.PI + 0.3, cr * 0.2, 2);
  else {
    clumps(6, leaves[2], 0.2, 0.4);
    crown.push(P(blob(side * cr * 1.32, py - 8, 18, 12, r), leaves[1]));
    for (let i = 0; i < 14; i++) crown.push(S(ellipse(r.range(-cr, cr * 0.6), cy + r.range(-cr * 0.8, cr * 0.2), 3, 2.2), leaves[2], pr(0.7)));
  }
  if (autumn) {
    for (let i = 0; i < 16; i++) trunk.push(S(ellipse(r.range(-cr, cr), -r.range(0, 4), 3, 1.6), r.pick(leaves), pr(0.85)));
    for (let i = 0; i < 3; i++) {
      const lx = r.range(-cr * 0.8, cr * 0.8), ly = -cy - r.range(-cr * 0.3, cr * 0.3);
      flats.push({ group: { shapes: [S(ellipse(0, -2.5, 4, 2.4), r.pick(leaves))], edge: 0.3 }, x: lx, y: ly, z: 3, ppcm: 4, pick: false, move: { path: { pts: [[0, 0, 0], [side * 24, -ly * 0.5, 0], [-12, -ly + 3, 0]], ms: r.range(5000, 8000), wait: r.range(2000, 6000), hide: true }, phase: r() } });
    }
  }
  const ppcm = Math.min(2, 1900 / (Math.max(cr * 2.9, h) + 40));
  return { flats: [{ group: { shapes: trunk, edge: 0.7 }, ppcm }, { group: { shapes: crown, edge: 0.7 }, z: 0.5, ppcm, move: { sway: { rot: 0.004, dy: 0.6, ms: r.range(3800, 5200) }, phase: r() } }, ...flats] };
}, variants: { autumn: { season: "autumn" }, bare: { season: "bare" } },
  meta: {
    about: "A street or park tree in summer, autumn or bare, its foot whitewashed by seed, with one long branch for a perch.",
    params: {
      h: { type: "num", min: 0, default: 520, about: "height, cm" },
      season: { type: "enum", values: ["summer", "autumn", "bare"], default: "summer" },
      side: { type: "enum", values: ["left", "right"], about: "the long branch's side; seeded" },
      perch: { type: "num", min: 0, about: "the long branch's height, cm; default 0.6 h" },
      whitewash: { type: "bool", about: "its foot whitewashed; seeded" },
    },
    terms: ["ağaç"],
    tags: ["tree"],
  } };

/** The family's set pieces and props (`index.ts`). */
// ---- Solid lines: what people walk round (DESIGN.md §7) ----------------------------------------------------
// a building's front: its street door's bay is a way in (a place puts its own door piece there when it opens on stage)
facade.solid = p => {
  const kind = str(p.kind, "apartment"), apt = kind !== "school" && kind !== "public", bays = Math.round(Math.max(1, Math.min(12, num(p.bays, apt ? 3 : 6))));
  const w = num(p.w, bays * (apt ? 140 : 150)), bw = w / bays, db = Math.max(0, Math.min(bays - 1, Math.round(num(p.door, Math.floor(bays / 2))))), dx = -w / 2 + (db + 0.5) * bw;
  const dw = apt ? Math.min(bw * 0.7, 120) : Math.min(bw * 0.9, 200);
  return solidLine(-w / 2, w / 2, [[dx - dw / 2, dx + dw / 2]]);
};
gardenWall.solid = p => { const w = num(p.w, 400); return solidLine(-w / 2, w / 2); };

/**
 * A simitçi's cart, broadside on: a red body on two spoked wheels with a pair of push handles, and on it a glass case of
 * stacked simits under a red roof, `fill` (0…1) of it full. `w` cm long (140), `color` its paint; `label` (none by default)
 * goes in white on the body's front.
 */
const simitCart: PieceDef = { draw(p, r) {
  const w = num(p.w, 140), a = w / 2, c = hue(p.color, SET, "#C4302B"), fill = cl(num(p.fill, 0.85)), sh: Shape[] = [], text: TextSpec[] = [];
  const steel = "#9AA0A6", dark = "#2E2B2B", glassC = "#CFE3EA", crust = ["#B5652A", "#C47A3A", "#A85A24"];
  // the push handles behind, then the wheels
  for (const y of [-84, -70]) sh.push(P([[a - 4, y, 0], [a + 36, y - 6, 0], [a + 36, y - 3.6, 0], [a - 4, y + 2.4, 0]], steel), S(rrect(a + 30, y - 7.5, 12, 4.6, 2), dark));
  for (const x of [-a + 26, a - 26]) {
    sh.push(S(ellipse(x, -27, 27, 27).add(ellipse(x, -27, 22, 22)), dark, { evenodd: true }));
    for (let k = 0; k < 8; k++) { const t = k * Math.PI / 8; sh.push(L([[x - Math.cos(t) * 22, -27 - Math.sin(t) * 22], [x + Math.cos(t) * 22, -27 + Math.sin(t) * 22]], "#55504C", 1.4, 1)); }
    sh.push(S(ellipse(x, -27, 4.5, 4.5), steel), S(ellipse(x, -27, 1.8, 1.8), dark, pr()));
  }
  // the body: a red box with a lighter band and panels
  sh.push(S(rrect(-a, -98, w, 50, 3), c), R(-a, -98, w, 6, tone(c, "light")), R(-a, -52, w, 4, tone(c, "deep")));
  for (const x of span(-a + 8, a - 30, (w - 38) / 3)) sh.push(S(rrect(x, -88, (w - 38) / 3 - 6, 32, 2), tone(c, "shade"), pr(0.55)));
  // the case: simits stacked on two shelves behind glass, a steel frame, a red roof with a brass knob
  const top = -158, shelf = (y: number, n: number, k: number) => { for (let i = 0; i < n; i++) { const x = -a + 14 + i * ((w - 28) / Math.max(1, n - 1)), cc = r.pick(crust); sh.push(S(ellipse(x, y - k * 7, 7.4, 6.6).add(ellipse(x, y - k * 7, 2.6, 2.4)), cc, { evenodd: true }), L([[x - 4, y - k * 7 - 3.6], [x + 3, y - k * 7 - 4.6]], "#F2E1B8", 0.8, 0.8)); } };
  sh.push(R(-a + 4, top + 4, w - 8, 56, "#F4EFE4"));
  const rows = Math.round(fill * 6), per = Math.max(3, Math.round((w - 28) / 15));
  for (let k = 0; k < Math.min(3, rows); k++) shelf(-104, per - k, k);
  for (let k = 0; k < Math.max(0, rows - 3); k++) shelf(-133, per - k, k);
  sh.push(R(-a + 4, -128, w - 8, 2.2, steel));
  sh.push(R(-a + 4, top + 4, w - 8, 56, glassC, pr(0.28)), L([[-a + 14, top + 10], [-a + 34, top + 40]], "#FFFFFF", 1.4, 0.6), L([[a - 40, top + 10], [a - 24, top + 34]], "#FFFFFF", 1.2, 0.5));
  for (const x of [-a + 1, -1.5, a - 4]) sh.push(R(x, top + 2, 3, 58, steel));
  sh.push(P([[-a - 6, top + 4, 0], [a + 6, top + 4, 0], [a - 4, top - 8, 0], [-a + 4, top - 8, 0]], c), R(-a - 6, top + 2, w + 12, 3, tone(c, "deep")), S(ellipse(0, top - 11, 4, 4), "#D9A441"));
  const label = str(p.label, "").trim();
  if (label) text.push({ text: label, x: -a + 6, y: -95, w: w - 12, h: 14, size: 9, font: "print", color: "#FFFFFF", weight: 700 });
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: 2.4, id: "simit_cart", ...(text.length ? { text } : {}) }] };
},
  meta: {
    about: "A simitçi's red cart: a glass case of stacked simits on a red body, two spoked wheels and push handles.",
    params: {
      w: { type: "num", min: 0, default: 140, about: "length, cm" },
      color: { type: "color", about: "its paint (a set palette id or hex); default red" },
      fill: { type: "num", min: 0, max: 1, default: 0.85, about: "how full of simits the case is" },
      label: { type: "text", about: "words on the body's front; none by default" },
    },
    terms: ["simit"],
    tags: ["street", "food"],
  } };

export const set: Record<string, PieceDef> = { facade, frontage, awning, shutter, lamp_post: lampPost, steps, garden_wall: gardenWall, bench, tree, simit_cart: simitCart };
export const props: Record<string, PieceDef> = { awning, bench, facade };
