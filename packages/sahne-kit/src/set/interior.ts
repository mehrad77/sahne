// Set pieces and props of the interior family, following STYLE.md: doors, the
// stairwell, the school corridor, balconies, the roof (water tank, ladder, chimney) and heaters. Units cm;
// each flat's origin is its bottom centre (up is negative y in the art).

import { Path, ellipse, rect, rrect, poly, smooth, tone, mix, type FlatSpec, type LightSpec, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, holed, glowOnly, litByTurns, solidLine } from "./draw.ts";
import { SET } from "../palette.ts";

const IRON = "#2E3135", BRASS = "#C9A25A", STEEL = "#C3C9CE", GLASS = "#CFE6EE", WARM = "#FFD9A0", CONCRETE = "#B9B2A6", RUST = "#9A5530";
const FACADES = ["#E9CF9E", "#F0DDBF", "#CFE0CF", "#E8B9A3", "#D9C7DA", "#F2E4C4", "#BFD3DC"];

/** A colour param: a `SET` name or `#RRGGBB`, else `d`. */
const col = (v: unknown, d: string) => typeof v === "string" ? SET[v] ?? (/^#[0-9A-Fa-f]{6}$/.test(v) ? v : d) : d;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Shapes and words moved by (dx, dy). */
const sh = (ss: Shape[], dx: number, dy = 0): Shape[] => dx || dy ? ss.map(s => ({ ...s, path: s.path.move(dx, dy) })) : ss;
const tx = (ts: TextSpec[], dx: number, dy = 0): TextSpec[] => ts.map(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
/** Many printed straight lines as one shape: [x0, y0, x1, y1] each. */
function lines(segs: number[][], c: string, w = 0.8, op = 0.5): Shape {
  const path = new Path();
  for (const [a, b, x, y] of segs) path.moveTo(a, b).lineTo(x, y);
  return { path, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op };
}
/** Many small dots as one flat shape. */
function dots(pts: number[][], c: string, rad = 0.8, op = 0.6): Shape {
  const path = new Path();
  for (const [x, y, k = 1] of pts) path.add(ellipse(x, y, rad * k, rad * k));
  return { path, fill: c, flat: true, opacity: op };
}
const glint = (x0: number, y0: number, x1: number, y1: number, w = 3, op = 0.3) => L([[x0, y0], [x1, y1]], "#FFFFFF", w, op);
/** A door frame: jambs and a head of width `f` round a `w` × `h` doorway, open at the floor. */
const jambs = (w: number, h: number, f: number, c: string) => S(holed(rect(-w / 2 - f, -h - f, w + 2 * f, h + f), [rect(-w / 2, -h, w, h)]), c, { evenodd: true });
/** A raised panel: the recess, the face (cut, so it has a rim and a shadow) and a lit top-left edge. */
const panel = (x: number, y: number, w: number, h: number, c: string): Shape[] => [
  S(rect(x, y, w, h), tone(c, "shade"), { flat: true }), S(rect(x + 2.5, y + 2.5, w - 5, h - 5), c),
  lines([[x + 2.5, y + h - 3, x + 2.5, y + 2.5], [x + 2.5, y + 2.5, x + w - 3, y + 2.5]], tone(c, "light"), 0.8, 0.55),
];
/** A lever handle on its backplate at (x, y), the lever pointing to the hinge (left). */
const lever = (x: number, y: number, c: string): Shape[] => [S(rrect(x - 2.2, y - 12, 4.4, 24, 2), c), S(rrect(x - 13, y - 7, 14, 3, 1.5), tone(c, "light")), S(ellipse(x, y + 7, 1.1, 1.5), tone(c, "deep"), { flat: true })];
/** A pair of shoes or slippers left by a flat door, side on. */
function shoes(x: number, r: Rng): Shape[] {
  const c = r.pick(["#3A2E28", "#6B4A35", "#2E3A59", "#B3261E", "#E9E4DA", "#4F6E9E"]), slip = r.chance(0.45), out: Shape[] = [];
  for (const [dx, dy] of [[-5, -0.6], [5, 0]]) {
    const X = x + dx;
    if (slip) out.push(S(rrect(X - 12, dy - 2.2, 24, 2.2, 1), tone(c, "deep")), P([[X - 3, dy - 2, 0], [X + 10, dy - 2, 0], [X + 8, dy - 6], [X, dy - 7]], c));
    else out.push(P([[X - 12, dy, 0], [X + 12, dy, 0], [X + 12, dy - 3.5], [X + 8, dy - 7], [X - 1, dy - 8], [X - 5, dy - 10.5, 0], [X - 12, dy - 10.5, 0]], c), S(rect(X - 12, dy - 1.6, 24, 1.6), tone(c, "deep"), { flat: true }));
  }
  return out;
}

// ---- Doors ------------------------------------------------------------------------------------

/** One door's art, centred on x = 0: the frame (and what is on the wall round it), the leaf, what lies in front, the words, what glows. */
interface DoorArt { frame: Shape[]; leaf: Shape[]; front: Shape[]; text: TextSpec[]; leafText: TextSpec[]; glow: Shape[]; leafGlow: Shape[]; lamp?: Vec2; swing: boolean }
type DoorFn = (w: number, h: number, c: string, r: Rng, no: string, p: Record<string, unknown>) => DoorArt;
const art = (o: Partial<DoorArt>): DoorArt => ({ frame: [], leaf: [], front: [], text: [], leafText: [], glow: [], leafGlow: [], swing: true, ...o });

/** A flat's door: a steel door in wood-look laminate, panelled, a spy-hole, the number plate, two locks, a doormat and often shoes. */
const flatDoor: DoorFn = (w, h, c, r, no) => {
  const f = 7, lx = -w / 2 + 1, lw = w - 2, fr = mix(tone(c, "deep"), "#3A2A20", 0.25), metal = r.pick([BRASS, STEEL]), hx = lx + lw - 9;
  const frame: Shape[] = [jambs(w, h, f, fr), lines([[-w / 2 - f + 1.5, 0, -w / 2 - f + 1.5, -h - f + 1.5], [-w / 2 - f + 1.5, -h - f + 1.5, w / 2 + f - 1.5, -h - f + 1.5]], tone(fr, "light"), 0.8, 0.5)];
  for (const y of [-h + 24, -h / 2, -26]) frame.push(S(rrect(-w / 2 - 1.8, y - 5, 3.2, 10, 1.2), metal));
  const leaf: Shape[] = [S(rect(lx, -h + 1, lw, h - 1), c), S(rect(lx + lw - 5, -h + 1, 5, h - 1), tone(c, "shade"), { flat: true, opacity: 0.45 })];
  const m = 9, cw = (lw - 2 * m - 6) / 2, style = r.int(0, 2);
  const rows = style === 0 ? [[-h + 10, 40], [-h + 58, h - 58 - 112], [-94, 80]] : [[-h + 10, h - 10 - 118], [-94, 80]];
  if (style === 2) {
    leaf.push(...panel(lx + m, -h + 12, lw - 2 * m, h - 26, c));
    leaf.push(lines([1, 2, 3, 4].map(k => [lx + m + 5, -h + 12 + k * (h - 26) / 5, lx + lw - m - 5, -h + 12 + k * (h - 26) / 5]), tone(c, "deep"), 1.2, 0.45));
  } else for (const [y, ph] of rows) for (const k of [0, 1]) leaf.push(...panel(lx + m + k * (cw + 6), y, cw, ph, c));
  leaf.push(S(rrect(-7, -h + 25, 14, 8.5, 1.5), metal), S(ellipse(0, -150, 1.9), metal), S(ellipse(0, -150, 0.8), "#1E1E22", { flat: true }));
  leaf.push(...lever(hx, -100, metal), S(ellipse(hx, -126, 1.7), metal), S(ellipse(hx, -126, 0.6, 1), "#1E1E22", { flat: true }));
  const leafText: TextSpec[] = no ? [{ text: no, x: -6, y: -h + 25.8, w: 12, h: 7, size: 5.2, font: "print", weight: 700 }] : [];
  const mat = r.pick(["#B08A55", "#6E6A66", "#8E3B30", "#4E6B5A"]);
  const front: Shape[] = [P([[-w / 2 + 4, 0, 0], [w / 2 - 4, 0, 0], [w / 2 - 8, -3.5, 0], [-w / 2 + 8, -3.5, 0]], mat), L([[-w / 2 + 10, -1.8], [w / 2 - 10, -1.8]], tone(mat, "light"), 0.8, 0.5)];
  if (r.chance(0.55)) front.push(...shoes(w / 2 + f + 20, r));
  return art({ frame, leaf, front, leafText });
};

/** A classroom door: painted, a narrow wired-glass window, a kick plate, a closer; its number on a sign beside it on the wall. */
const classDoor: DoorFn = (w, h, c, _r, no) => {
  const f = 6, lx = -w / 2 + 1, lw = w - 2, fr = mix(tone(c, "deep"), "#7C8288", 0.5), vx = lx + lw - 33, vy = -h + 24, sx = w / 2 + f + 26, sy = -h + 28;
  const frame: Shape[] = [jambs(w, h, f, fr), S(rrect(sx - 18, sy - 10, 36, 21, 2), "#F7F3EA"), S(rect(sx - 18, sy - 10, 36, 5), "#2F6E9E", { flat: true })];
  const text: TextSpec[] = no ? [{ text: no, x: sx - 15, y: sy - 4, w: 30, h: 13, size: 10, font: "print", weight: 700 }] : [];
  const leaf: Shape[] = [S(rect(lx, -h + 1, lw, h - 1), c), S(rect(lx + lw - 5, -h + 1, 5, h - 1), tone(c, "shade"), { flat: true, opacity: 0.4 })];
  leaf.push(S(rrect(vx - 3, vy - 3, 24, 74, 1.5), tone(c, "shade")), S(rect(vx, vy, 18, 68), GLASS, { flat: true, opacity: 0.35 }));
  leaf.push(lines([0, 1, 2, 3, 4, 5].map(k => [vx, vy + k * 12, vx + 18, vy + k * 12 + 8]), "#8A9499", 0.5, 0.4), glint(vx + 4, vy + 50, vx + 12, vy + 12, 2.5, 0.35));
  leaf.push(S(rect(lx + 2, -26, lw - 4, 24), STEEL), lines([[lx + 4, -18, lx + lw - 4, -18], [lx + 4, -10, lx + lw - 4, -10]], "#FFFFFF", 0.6, 0.35));
  leaf.push(S(rrect(lx + lw - 44, -h + 4, 32, 6.5, 2), "#9AA0A6"), ...lever(lx + lw - 8, -102, STEEL));
  return art({ frame, leaf, text });
};

/** A glazed entrance door in an aluminium frame: a glass leaf with a pull bar and a frosted band, a sidelight, a transom with `label` on it. */
const glassDoor: DoorFn = (w, h, c, _r, label) => {
  const f = 6, side = 44, tr = 46, xL = -w / 2 - 2 * f - side, xR = w / 2 + f, top = -h - 2 * f - tr, lx = -w / 2 + 1, lw = w - 2;
  const sideP = rect(xL + f, -h, side, h - 14), trP = rect(xL + f, top + f, xR - xL - 2 * f, tr);
  const frame: Shape[] = [S(holed(rect(xL, top, xR - xL, -top), [rect(-w / 2, -h, w, h), sideP, trP]), c, { evenodd: true })];
  frame.push(S(sideP, GLASS, { flat: true, opacity: 0.28 }), S(trP, GLASS, { flat: true, opacity: 0.28 }), S(rect(xL + f, -150, side, 7), "#FFFFFF", { flat: true, opacity: 0.45 }));
  frame.push(glint(xL + f + 8, -40, xL + f + 30, -120), glint(xL + 30, top + tr, xL + 60, top + f + 6, 2.5, 0.28));
  const text: TextSpec[] = label ? [{ text: label, x: xL + f + 8, y: top + f + 9, w: xR - xL - 2 * f - 16, h: tr - 18, size: 15, font: "print", weight: 700 }] : [];
  const glass = rect(lx + 7, -h + 8, lw - 14, h - 30), px = lx + lw - 16;
  const leaf: Shape[] = [S(holed(rect(lx, -h + 1, lw, h - 1), [glass]), c, { evenodd: true }), S(glass, GLASS, { flat: true, opacity: 0.25 }), S(rect(lx + 7, -150, lw - 14, 7), "#FFFFFF", { flat: true, opacity: 0.45 })];
  leaf.push(glint(lx + 18, -40, lx + 44, -150), glint(lx + 30, -60, lx + 50, -120, 2, 0.22), S(rect(lx, -h + 1, lw, 2), tone(c, "light"), { flat: true, opacity: 0.6 }));
  leaf.push(S(rect(px - 4, -142, 8, 2.4), tone(c, "shade")), S(rect(px - 4, -78, 8, 2.4), tone(c, "shade")), S(rrect(px - 1.8, -150, 3.6, 80, 1.8), "#DDE1E4"), S(rrect(lx + lw / 2 - 5, -13, 10, 4, 1), tone(c, "deep")));
  return art({ frame, leaf, text });
};

/** An apartment building's street door in a stone surround with a keystone: an iron-and-glass leaf (`style` iron) or a panelled wooden one (wood), a fanlight with a sunburst grille, the blue number plate (`number`), the bell panel, a lantern. */
const streetDoor: DoorFn = (w, h, c, r, no, p) => {
  const s = 16, tr = 52, stone = r.pick(["#D6CDBB", "#CFC4AE", "#C8C2B6"]), iron = str(p.style, r.chance(0.55) ? "iron" : "wood") === "iron";
  const lx = -w / 2 + 1, lw = w - 2, ty = -h - tr, frame: Shape[] = [];
  // the surround, its cornice, keystone and plinths
  frame.push(S(holed(rect(-w / 2 - s, ty - s, w + 2 * s, h + tr + s), [rect(-w / 2, ty, w, h + tr)]), stone, { evenodd: true }));
  frame.push(S(rect(-w / 2 - s - 9, ty - s - 13, w + 2 * s + 18, 13), tone(stone, "light")), S(rect(-w / 2 - s - 5, ty - s - 2, w + 2 * s + 10, 2.5), tone(stone, "shade"), { flat: true, opacity: 0.6 }));
  frame.push(P([[-9, ty - s - 1, 0], [9, ty - s - 1, 0], [6, ty + 5, 0], [-6, ty + 5, 0]], tone(stone, "light")));
  for (const k of [-1, 1]) frame.push(S(rect(k < 0 ? -w / 2 - s - 3 : w / 2, -32, s + 3, 32), tone(stone, "shade")));
  frame.push(lines([[-w / 2 - s, -h * 0.4, -w / 2, -h * 0.4], [w / 2, -h * 0.4, w / 2 + s, -h * 0.4], [-w / 2 - s, -h * 0.75, -w / 2, -h * 0.75], [w / 2, -h * 0.75, w / 2 + s, -h * 0.75]], tone(stone, "deep"), 0.6, 0.35));
  // the fanlight: glass behind a sunburst grille, and the door's head
  const fan = rect(-w / 2, ty, w, tr - 6), hub: Vec2 = [0, -h - 6], rays: number[][] = [];
  for (let k = 1; k < 8; k++) { const a = k * Math.PI / 8, cx = Math.cos(a), sy = Math.sin(a), l = Math.min(Math.abs(cx) > 1e-6 ? (w / 2) / Math.abs(cx) : 1e9, (tr - 6) / sy); rays.push([0, hub[1], cx * l, hub[1] - sy * l]); }
  frame.push(S(fan, GLASS, { flat: true, opacity: 0.35 }), lines(rays, IRON, 1.6, 1), S(smooth([[-14, hub[1], 0], [-10, hub[1] - 9], [0, hub[1] - 13], [10, hub[1] - 9], [14, hub[1], 0]], true), IRON), S(rect(-w / 2, -h - 6, w, 6), iron ? IRON : c));
  // the blue number plate, the bell panel and the lantern
  const nx = w / 2 + s + 18, ny = ty + 8, bx = w / 2 + s + 16;
  frame.push(S(rrect(nx - 12, ny - 9, 24, 18, 2), "#F7F3EA"), S(rrect(nx - 10.5, ny - 7.5, 21, 15, 1.5), "#21508F"));
  const text: TextSpec[] = no ? [{ text: no, x: nx - 9.5, y: ny - 6.5, w: 19, h: 13, size: 10, font: "print", weight: 700, color: "#F7F3EA" }] : [];
  frame.push(S(rrect(bx - 8, -168, 16, 50, 1.5), STEEL), dots([0, 1, 2, 3, 4, 5].flatMap(i => [[bx - 3 + (i % 3) * 3, -162 + Math.floor(i / 3) * 3]]), "#5B6770", 0.7, 0.8));
  for (let i = 0; i < 10; i++) { const x = bx - 4 + (i % 2) * 8, y = -152 + Math.floor(i / 2) * 6.5; frame.push(S(ellipse(x - 1.8, y, 1.4), "#E9E4DA"), S(rect(x, y - 1.4, 3, 2.8), "#FBF7EE", { flat: true, opacity: 0.9 })); }
  const lx0 = -w / 2 - s - 22, ly = -h + 4;
  frame.push(lines([[-w / 2 - s, ly + 4, lx0, ly + 4], [lx0, ly + 4, lx0, ly - 2]], IRON, 2, 1), S(rect(lx0 - 6, ly - 24, 12, 22), IRON), P([[lx0 - 9, ly - 24, 0], [lx0 + 9, ly - 24, 0], [lx0, ly - 33, 0]], IRON));
  const glow = [S(rect(lx0 - 4, ly - 22, 8, 18), WARM, { flat: true }), S(fan, WARM, { flat: true, opacity: 0.4 })];
  frame.push(S(rect(lx0 - 4, ly - 22, 8, 18), "#E9E1C8", { flat: true }));
  // the leaf
  const leaf: Shape[] = [], leafGlow: Shape[] = [];
  if (iron) {
    const gh = h * 0.6, g = rect(lx + 6, -h + 7, lw - 12, gh);
    leaf.push(S(holed(rect(lx, -h + 1, lw, h - 1), [g]), c, { evenodd: true }), S(g, GLASS, { flat: true, opacity: 0.3 }));
    const bars: number[][] = [];
    for (let x = lx + 6 + (lw - 12) / 8; x < lx + lw - 7; x += (lw - 12) / 8) bars.push([x, -h + 7, x, -h + 7 + gh]);
    bars.push([lx + 6, -h + 7 + gh * 0.5, lx + lw - 6, -h + 7 + gh * 0.5], [lx + 6, -h + 7 + gh * 0.2, lx + lw - 6, -h + 7 + gh * 0.2]);
    leaf.push(lines(bars, c, 1.5, 1));
    for (let i = 0; i < 7; i++) leaf.push({ path: ellipse(lx + 6 + (i + 0.5) * (lw - 12) / 7, -h + 7 + gh * 0.35, 3.4, 4.2), stroke: { color: c, width: 1.2 }, flat: true });
    leaf.push(...panel(lx + 8, -h + 14 + gh, lw - 16, h - 22 - gh, c), S(rrect(lx + lw - 12, -128, 3.4, 34, 1.7), BRASS), S(ellipse(lx + lw - 10, -88, 1.6), BRASS));
    leafGlow.push(S(g, WARM, { flat: true, opacity: 0.45 }));
  } else {
    const gw = lw / 2 - 14, gy = -h + 12;
    leaf.push(S(rect(lx, -h + 1, lw, h - 1), c));
    for (const gx of [lx + 10, lx + lw / 2 + 4]) {
      leaf.push(S(rect(gx - 2, gy - 2, gw + 4, 74), tone(c, "shade")), S(rect(gx, gy, gw, 70), GLASS, { flat: true, opacity: 0.32 }), lines([1, 2, 3].map(k => [gx + k * gw / 4, gy, gx + k * gw / 4, gy + 70]), IRON, 1.5, 1));
      leaf.push(...panel(gx - 2, -h + 92, gw + 4, h - 92 - 18, c));
      leafGlow.push(S(rect(gx, gy, gw, 70), WARM, { flat: true, opacity: 0.45 }));
    }
    leaf.push(S(ellipse(0, -112, 3.8), BRASS), S(ellipse(-1, -113, 1.5), tone(BRASS, "light"), { flat: true }), S(rrect(-11, -84, 22, 4.5, 1), BRASS), S(rect(lx + 2, -14, lw - 4, 12), BRASS, { opacity: 0.85 }));
  }
  leaf.push(S(rect(lx + lw - 5, -h + 1, 5, h - 1), tone(c, "shade"), { flat: true, opacity: 0.4 }));
  return art({ frame, leaf, text, glow, leafGlow, lamp: [lx0, -ly + 14] });
};

/** The steel door at the stair-head onto the roof: painted, rusting, a louvre, a hasp and padlock; with `hut` (default) the plastered stair-head round it, its slab roof, a vent and a pipe. */
const roofDoor: DoorFn = (w, h, c, r, _no, p) => {
  const lx = -w / 2 + 1, lw = w - 2, hx = lx + lw - 9, frame: Shape[] = [];
  if (p.hut !== false) {
    const hc = r.pick(["#E6DFD2", "#DCCFB8", "#D9D6CC"]), x0 = -w / 2 - 55, x1 = w / 2 + 80, top = -h - 58;
    frame.push(S(holed(rect(x0, top, x1 - x0, -top), [rect(-w / 2, -h, w, h)]), hc, { evenodd: true }));
    frame.push(S(rect(x0, top, x1 - x0, 12), "#6E6658", { flat: true, opacity: 0.16 }), lines([0, 1, 2, 3, 4, 5].map(() => { const x = r.range(x0 + 6, x1 - 6); return [x, top + 10, x + r.range(-1, 1), top + r.range(22, 50)]; }), "#6E6658", 1.4, 0.16));
    frame.push(S(rect(x0 - 10, top - 14, x1 - x0 + 20, 14), CONCRETE), S(rect(x0 - 10, top - 2, x1 - x0 + 20, 2), tone(CONCRETE, "deep"), { flat: true, opacity: 0.5 }));
    frame.push(P([[x0 + 4, -2], [x0 + 26, -10], [x0 + 48, -4], [x0 + 52, 0, 0], [x0 + 2, 0, 0]], "#6E6658", { flat: true, opacity: 0.18 }));
    frame.push(S(rect(x1 - 52, top + 24, 24, 15), tone(hc, "deep")), lines([0, 1, 2, 3].map(k => [x1 - 50, top + 27 + k * 3.4, x1 - 30, top + 27 + k * 3.4]), tone(hc, "light"), 1.2, 0.7));
    frame.push(S(rect(x1 - 16, top - 4, 6, -top + 4), "#9AA0A6"), ...[0.3, 0.7].map(k => S(rect(x1 - 18, top * k - 2, 10, 3), "#7C8288")));
    frame.push(L([[x0 + 12, top + 30], [x0 + 20, top + 50], [x0 + 15, top + 72]], tone(hc, "deep"), 0.6, 0.5));
  }
  frame.push(jambs(w, h, 5, tone(c, "deep")));
  const leaf: Shape[] = [S(rect(lx, -h + 1, lw, h - 1), c), S(rect(lx + 5, -h + 6, lw - 10, h - 11), tone(c, "light"), { flat: true, opacity: 0.18 })];
  leaf.push(S(rect(lx + 5, -h * 0.66, lw - 10, 3), tone(c, "shade"), { flat: true, opacity: 0.5 }), S(rect(lx + 5, -h * 0.36, lw - 10, 3), tone(c, "shade"), { flat: true, opacity: 0.5 }));
  leaf.push(S(rect(lx + 12, -46, lw - 24, 26), tone(c, "deep")), lines([0, 1, 2, 3, 4].map(k => [lx + 14, -43 + k * 5, lx + lw - 14, -43 + k * 5]), tone(c, "light"), 1.4, 0.7));
  leaf.push(...lever(hx, -100, "#3B3B40"), S(rrect(hx - 7, -131, 9, 4, 1), IRON), { path: smooth([[hx - 4.5, -125], [hx - 4.5, -131], [hx - 0.5, -131], [hx - 0.5, -125]], false), stroke: { color: STEEL, width: 1.3 } }, S(rrect(hx - 6, -126, 7, 7, 1.5), BRASS));
  // rust: the bottom edge, streaks from the hinges and bolts, spots
  const rust: Shape[] = [P([[lx, 0, 0], [lx + lw, 0, 0], [lx + lw, -r.range(6, 12)], [lx + lw * 0.7, -r.range(3, 9)], [lx + lw * 0.4, -r.range(5, 12)], [lx, -r.range(4, 10)]], RUST, { flat: true, opacity: 0.4 })];
  for (const y of [-h + 26, -h / 2, -30]) rust.push(P([[lx + 1, y, 0], [lx + 4, y, 0], [lx + 3, y + r.range(18, 34)], [lx + 1.5, y + r.range(16, 30)]], RUST, { flat: true, opacity: 0.35 }));
  rust.push(dots([0, 1, 2, 3, 4, 5].map(() => [r.range(lx + 6, lx + lw - 6), r.range(-h + 10, -60), r.range(0.6, 1.4)]), RUST, 1.6, 0.35));
  leaf.push(...rust);
  return art({ frame, leaf });
};

/** A lift's closed doors in a stone surround: two brushed-steel panels, the floor indicator, the call button. The doors do not swing; hidden, its cut shapes leave the dashed outline of a lift that is not there. */
const liftDoor: DoorFn = (w, h, c, r) => {
  const sur = r.pick(["#D8D2C6", "#CFC9BD", "#B9B4AC"]), cx = w / 2 + 28;
  const frame: Shape[] = [S(holed(rect(-w / 2 - 12, -h - 12, w + 24, h + 12), [rect(-w / 2, -h, w, h)]), sur, { evenodd: true }), lines([[-w / 2 - 10, -h * 0.7, -w / 2 - 3, -h * 0.55], [w / 2 + 3, -h * 0.3, w / 2 + 11, -h * 0.4], [-20, -h - 9, 10, -h - 4]], tone(sur, "deep"), 0.7, 0.3)];
  frame.push(S(rrect(-15, -h - 30, 30, 15, 2), "#2B2E33"), P([[-9, -h - 19, 0], [-5, -h - 26, 0], [-1, -h - 19, 0]], "#6C7680", { flat: true }), P([[1, -h - 26, 0], [9, -h - 26, 0], [5, -h - 19, 0]], "#6C7680", { flat: true }));
  frame.push(S(rrect(cx - 5, -124, 10, 24, 1.5), STEEL), S(ellipse(cx, -112, 2.8), "#E9E4DA"), P([[cx - 1.6, -111, 0], [cx, -113.5, 0], [cx + 1.6, -111, 0]], "#6C7680", { flat: true }));
  const glow = [S(ellipse(12, -h - 22.5, 1.6), "#FF9A4A", { flat: true }), { path: ellipse(cx, -112, 3.2), stroke: { color: "#FFB35C", width: 0.8 }, flat: true } as Shape];
  const leaf: Shape[] = [S(rect(-w / 2 + 0.5, -h + 0.5, w / 2 - 0.8, h - 0.5), c), S(rect(0.3, -h + 0.5, w / 2 - 0.8, h - 0.5), c)];
  const brush: number[][] = [];
  for (let x = -w / 2 + 3; x < w / 2 - 2; x += 2.6) brush.push([x, -h + 2, x, -2]);
  leaf.push(lines(brush, tone(c, "shade"), 0.5, 0.18), S(rect(w / 2 - 6, -h + 0.5, 5.7, h - 0.5), tone(c, "shade"), { flat: true, opacity: 0.4 }), L([[0, -h + 1], [0, -1]], tone(c, "deep"), 0.8, 0.8));
  leaf.push(glint(-w * 0.32, -40, -w * 0.12, -150), glint(w * 0.1, -50, w * 0.25, -120, 2, 0.22), S(rect(-w / 2, -2, w, 2), "#9AA0A6", { flat: true }));
  return art({ frame, leaf, glow, swing: false });
};

const DOOR: Record<string, { fn: DoorFn; w: number; h: number; c: string[]; away: boolean; beyond?: string; no?: string }> = {
  flat: { fn: flatDoor, w: 90, h: 205, c: ["#6B4A35", "#7A5034", "#4E3B30", "#8A5A3A", "#5B6770", "#6A2E28"], away: true, beyond: "#C9A97A" },
  class: { fn: classDoor, w: 95, h: 210, c: ["#C9B79A", "#8FA9B8", "#A8754A", "#DCD5C5", "#7F9A86"], away: false, beyond: "#E8E1D0", no: "504" },
  glass: { fn: glassDoor, w: 110, h: 225, c: ["#B8BEC4", "#4B4A48", "#8C9298"], away: true, beyond: "#D9D4C8" },
  street: { fn: streetDoor, w: 110, h: 230, c: ["#2E3135", "#3E4A3F", "#5A3A28", "#6B4A35"], away: true, beyond: "#8E8172", no: "12" },
  roof: { fn: roofDoor, w: 80, h: 195, c: ["#7D868C", "#5E7A62", "#8E4B3A", "#4F6E8E"], away: false, beyond: "#3E3A36" },
  lift: { fn: liftDoor, w: 80, h: 205, c: ["#B8BEC4", "#C2B8A3"], away: false },
};

/** What is seen through an open door, a metre behind it: a lit hall (flat), a classroom, a lobby, a building's entrance hall and its first steps (street), the dark stair-head (roof). */
function beyond(kind: string, w: number, h: number, c: string): { shapes: Shape[]; glow: Shape[] } {
  const m = kind === "glass" ? 110 : 45, x0 = -w / 2 - m, W = w + 2 * m, H = h + m + 10, shapes: Shape[] = [S(rect(x0, -H, W, H), c), S(rect(x0, -24, W, 24), tone(c, "shade")), S(rect(x0, -26, W, 3), tone(c, "deep"), { flat: true, opacity: 0.5 })];
  if (kind === "flat") shapes.push(S(rect(x0 + 10, -178, 40, 4), "#7A5034"), P([[x0 + 16, -176, 0], [x0 + 34, -176, 0], [x0 + 38, -100], [x0 + 12, -100]], "#4F6E9E"), S(rect(-w / 2 + 6, -6, w - 12, 6), "#9A3B32", { flat: true }));
  if (kind === "class") shapes.push(S(rect(x0 + 6, -180, 50, 90), "#F7F7F2"), S(rect(x0 + W - 46, -190, 40, 120), "#F4F6F2", { flat: true }), S(rect(x0 + W - 28, -190, 3, 120), tone(c, "shade"), { flat: true }));
  if (kind === "glass") shapes.push(S(rect(x0 + 20, -120, 70, 96), tone(c, "deep")), S(rect(x0 + 16, -124, 78, 6), tone(c, "light")), S(rect(x0 + W - 40, -H, 22, H - 24), tone(c, "light")));
  if (kind === "street") {
    const st: Vec2[] = [[-10, -24]];
    let i = 0;
    for (; -10 + (i + 1) * 24 < x0 + W; i++) st.push([-10 + i * 24, -24 - (i + 1) * 17], [-10 + (i + 1) * 24, -24 - (i + 1) * 17]);
    shapes.push(S(poly([...st, [x0 + W, -24 - i * 17], [x0 + W, -24]]), "#B5AA98"), S(rect(x0 + 8, -150, 40, 30), "#7C6A58"), lines([0, 1, 2].map(k => [x0 + 8, -140 + k * 10, x0 + 48, -140 + k * 10]), "#4A3E34", 0.8, 0.6));
  }
  if (kind === "roof") shapes.push(S(rect(x0, -H, W, H), "#1E1C1A", { flat: true, opacity: 0.45 }), L([[x0 + 10, -70], [x0 + W - 10, -130]], "#6B6058", 3, 0.6));
  const glow = kind === "roof" ? [] : [S(rect(x0, -H, W, H), WARM, { flat: true, opacity: kind === "street" ? 0.25 : 0.4 })];
  return { shapes, glow };
}

/**
 * A door whose leaf swings open (the leaf is its own flat, `id: "leaf"`, with `hinge` on its left edge, like
 * `door_shop`), `kind`: `flat` (a flat's door: panelled, `number` on the plate, a spy-hole, a doormat, shoes),
 * `class` (a classroom door, a wired-glass window; `number` on the sign beside it, default "504"), `glass` (a
 * glazed campus entrance in an aluminium frame, a sidelight and a transom; `label` on the transom), `street`
 * (an apartment building's street door, `style` iron or wood, the bell panel and lantern; `number` on the
 * blue plate, default "12"), `roof` (the steel stair-head door onto the roof; `hut` false leaves out the
 * stair-head round it) or `lift` (a lift's closed doors: they never open, and hidden they leave a dashed
 * outline: *asansör yok*). `w` × `h` is the doorway, `color` the leaf (seeded). The leaf swings toward the
 * viewer, or `away` (the default for flat, glass and street doors, seen from outside); behind it a lit
 * `beyond` (a colour, or false for none) shows when it opens; in the place state `openState` it stands open. `n` doors
 * stand `gap` cm apart (numbers count up).
 */
const door: PieceDef = { draw(p, r) {
  const kind = Object.hasOwn(DOOR, str(p.kind, "flat")) ? str(p.kind, "flat") : "flat", d = DOOR[kind];
  const w = num(p.w, d.w), h = num(p.h, d.h), c = col(p.color, r.pick(d.c)), held = !!p.held;
  const n = held ? 1 : cl(Math.round(num(p.n, 1)), 1, 6), gap = num(p.gap, w + 130), sw = (p.away === undefined ? d.away : !!p.away) ? 1.25 : -1.25;
  // the words on the door: a glass door's transom (`label`), any other door's number plate (`number`)
  const words = kind === "glass" ? p.label ?? p.number : p.number;
  const no0 = typeof words === "number" ? String(words) : str(words, d.no ?? (kind === "flat" ? String(r.int(1, 12)) : ""));
  const by = kind !== "lift" && p.beyond !== false ? col(p.beyond, d.beyond ?? "#C9A97A") : "";
  const openState = str(p.openState, "");
  const frame: Shape[] = [], front: Shape[] = [], text: TextSpec[] = [], glow: Shape[] = [], leaves: FlatSpec[] = [], back: Shape[] = [], backGlow: Shape[] = [], lights: LightSpec[] = [];
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * gap, no = /^\d+$/.test(no0) ? String(+no0 + i) : no0, a = d.fn(w, h, c, r, no, p);
    frame.push(...sh(a.frame, dx)); front.push(...sh(a.front, dx)); text.push(...tx(a.text, dx)); glow.push(...sh(a.glow, dx));
    if (held) { frame.push(...a.leaf); text.push(...a.leafText); continue; }
    leaves.push({ group: { shapes: sh(a.leaf, dx), edge: 0.7 }, ppcm: 1.8, z: 1, id: "leaf", ...(a.swing ? { hinge: dx - w / 2 + 1, swing: sw, ...(openState ? { openIn: [openState] } : {}) } : {}),
      ...(a.leafText.length ? { text: tx(a.leafText, dx) } : {}), ...(a.leafGlow.length ? { emissive: { shapes: sh(a.leafGlow, dx), edge: 0 } } : {}) });
    if (by) { const b = beyond(kind, w, h, by); back.push(...sh(b.shapes, dx)); backGlow.push(...sh(b.glow, dx)); }
    if (a.lamp) lights.push({ x: a.lamp[0] + dx, y: a.lamp[1], z: 30, color: "#FFD59A", radius: 2.2, intensity: 0.5, switch: false });
  }
  const first: FlatSpec = { group: { shapes: frame, edge: 0.8 }, ppcm: held ? 1.4 : 1.8, id: "door", ...(held ? {} : { shadow: "drop" as const }), ...(text.length ? { text } : {}) };
  if (held) return { flats: [first] };
  // back to front (the stage sorts by depth; a contact sheet draws in order): what is beyond, the frame, the leaves, the mat
  const flats: FlatSpec[] = back.length ? [{ group: { shapes: back, edge: 0 }, emissive: { shapes: backGlow, edge: 0 }, ppcm: 0.8, z: -100 }] : [];
  flats.push(first, ...leaves);
  if (glow.length) flats.push(glowOnly(glow, { ppcm: 1.8, z: 0.5 }));
  if (front.length) flats.push({ group: { shapes: front, edge: 0.5 }, ppcm: 1.8, z: 3 });
  return { flats, ...(lights.length ? { lights: lights.slice(0, 2) } : {}) };
}, variants: { flat: { kind: "flat" }, class: { kind: "class" }, glass: { kind: "glass" }, street: { kind: "street" }, roof: { kind: "roof" }, lift: { kind: "lift" } },
  meta: {
    about: "A door whose leaf swings open: a flat's, a classroom's, a glazed entrance, a building's street door, the roof door or a lift's.",
    params: {
      kind: { type: "enum", values: ["flat", "class", "glass", "street", "roof", "lift"], default: "flat", about: "which door" },
      w: { type: "num", about: "the doorway's width, cm; default by kind" },
      h: { type: "num", about: "the doorway's height, cm; default by kind" },
      color: { type: "color", about: "the leaf; a set palette id or a hex; default seeded" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "how many side by side" },
      gap: { type: "num", about: "cm between doors; default w + 130" },
      away: { type: "bool", about: "the leaf swings away from the viewer; default by kind" },
      number: { type: "text", about: "on the plate or sign (counts up over n); flat seeded, class 504, street 12" },
      label: { type: "text", about: "a glass door's transom words (on any other door, `number` is its plate)" },
      beyond: { type: ["color", "bool"], about: "what shows through the open door, or false for none; default by kind" },
      style: { type: "enum", values: ["iron", "wood"], about: "a street door's leaf; default seeded" },
      hut: { type: "bool", default: true, about: "a roof door's stair-head round it" },
      openState: { type: "text", about: "a place state in which the leaf stands open (a neighbour's door left open, the warm hall beyond)" },
    },
    terms: ["a1-w-kapi"],
  } };

// ---- Shared bits: radiators, railings, the view outside ---------------------------------------

/** A radiator centred on `x`, standing on the floor: a steel panel with its channels and top grille, or (`column`) cast-iron sections; the valve on the left, the lockshield on the right. */
function radiator(x: number, w: number, h: number, column: boolean, c: string): Shape[] {
  const y0 = -12 - h, l = x - w / 2, out: Shape[] = [];
  out.push(S(rect(l - 9, -24, 3.6, 24), STEEL), S(rect(l - 9, -27, 10, 3.6), STEEL), S(rrect(l - 13, -42, 11, 15, 3), "#F4F1EA"), lines([0, 1, 2].map(k => [l - 10.5 + k * 3, -40, l - 10.5 + k * 3, -30]), "#9AA0A6", 0.6, 0.7));
  out.push(S(rect(x + w / 2 + 5, -24, 3.6, 24), STEEL), S(rect(x + w / 2 - 1, -27, 10, 3.6), STEEL), S(rrect(x + w / 2 + 3, -33, 7.6, 6, 1.5), STEEL));
  if (column) {
    const k = Math.max(3, Math.round(w / 6.2)), sw = w / k;
    for (const i of [1, k - 2]) out.push(S(rect(l + i * sw, -12, sw, 12), tone(c, "shade")));
    for (let i = 0; i < k; i++) out.push(S(rrect(l + i * sw + 0.3, y0, sw - 0.6, h + 4, sw / 2), c));
    out.push(lines(Array.from({ length: k }, (_, i) => [l + i * sw + sw * 0.66, y0 + 5, l + i * sw + sw * 0.66, -14]), tone(c, "shade"), 1, 0.5));
    out.push(S(rect(l, y0 + 7, w, 2.5), tone(c, "shade"), { flat: true, opacity: 0.45 }), S(rect(l, -20, w, 2.5), tone(c, "shade"), { flat: true, opacity: 0.45 }));
  } else {
    out.push(S(rect(l + 7, -13, 3, 13), "#9AA0A6"), S(rect(x + w / 2 - 10, -13, 3, 13), "#9AA0A6"), S(rrect(l, y0, w, h, 2), c), S(rect(l + 2, y0, w - 4, 5), tone(c, "shade")));
    const ch: number[][] = [], sl: number[][] = [];
    for (let xx = l + 4; xx < x + w / 2 - 3; xx += 4.5) { ch.push([xx, y0 + 9, xx, -16]); sl.push([xx, y0 + 1.5, xx + 2, y0 + 1.5]); }
    out.push(lines(ch, tone(c, "shade"), 1.1, 0.4), lines(sl, tone(c, "deep"), 1.6, 0.6), S(rect(x + w / 2 - 4, y0, 4, h), tone(c, "shade"), { flat: true, opacity: 0.4 }), S(ellipse(x + w / 2 - 5, y0 + 9, 1.2), STEEL));
  }
  return out;
}

/** An iron railing from `x0` to `x1` on a base at `y` (art), `h` tall: end posts, a top rail (`cap` thick), a bottom rail, bars every 11 cm and a band of rings. */
function railing(x0: number, x1: number, y: number, h: number, c: string, cap = 4.5, capC = c): Shape[] {
  const t = y - h, bars: number[][] = [], out: Shape[] = [];
  const k = Math.max(2, Math.round((x1 - x0) / 11));
  for (let i = 1; i < k; i++) bars.push([x0 + i * (x1 - x0) / k, t + cap, x0 + i * (x1 - x0) / k, y]);
  out.push(lines(bars, c, 1.6, 1), S(rect(x0, y - 7, x1 - x0, 3), c), S(rect(x0, t + 14, x1 - x0, 2.4), c));
  for (let i = 0; i < k; i++) out.push({ path: ellipse(x0 + (i + 0.5) * (x1 - x0) / k, t + 9.5, 3.2, 3.6), stroke: { color: c, width: 1.1 }, flat: true });
  out.push(S(rect(x0 - 2, t, 4.5, h), c), S(rect(x1 - 2.5, t, 4.5, h), c), S(rect(x0 - 2, t - 1, x1 - x0 + 4, cap), capC), L([[x0, t], [x1, t]], tone(capC, "light"), 0.8, 0.5));
  return out;
}

/** Geraniums in a terracotta pot standing at (x, y), about 30 cm tall. */
function pot(x: number, y: number, r: Rng): Shape[] {
  const f = r.pick(["#D9363E", "#E4528C", "#C4302B", "#F0745F"]), out: Shape[] = [P([[x - 9, y - 16, 0], [x + 9, y - 16, 0], [x + 7, y, 0], [x - 7, y, 0]], "#B8562F"), S(rect(x - 10, y - 18, 20, 3.5), tone("#B8562F", "light"))];
  out.push(S(ellipse(x, y - 26, 13, 9), "#4E7A48"), S(ellipse(x - 5, y - 30, 7, 5), "#5E8C50", { flat: true }));
  out.push(dots(Array.from({ length: 6 }, () => [x + r.range(-10, 10), y - r.range(26, 36), r.range(0.8, 1.3)]), f, 2.6, 1));
  return out;
}

/** What is outside a window: sky, and the buildings across the street with their windows (the lit ones go to `lit`). */
function outside(r: Rng, x0: number, y0: number, W: number, H: number, lit: Shape[]): Shape[] {
  const out: Shape[] = [S(rect(x0, y0, W, H), "#C9DFEA"), S(rect(x0, y0 + H * 0.45, W, H * 0.55), "#DCE9EE", { flat: true })];
  for (let x = x0 - r.range(0, 40); x < x0 + W;) {
    const bw = r.range(80, 140), bt = y0 + H * r.range(0.12, 0.42), c = mix(r.pick(FACADES), "#A9B4BE", 0.25);
    out.push(S(rect(x, bt, bw, y0 + H - bt), c), S(rect(x - 3, bt - 7, bw + 6, 8), tone(c, "shade")));
    for (let wy = bt + 16; wy < y0 + H - 24; wy += 44) for (let wx = x + 12; wx < x + bw - 22; wx += 30) {
      out.push(S(rect(wx, wy, 14, 24), "#55657A", { flat: true }));
      if (r.chance(0.4)) lit.push(S(rect(wx, wy, 14, 24), "#FFD27A", { flat: true }));
    }
    x += bw + r.range(0, 12);
  }
  return out;
}

/** A piece mirrored left to right (a stairwell that climbs to the left). */
function mirrored(o: PieceOut): PieceOut {
  const m = (ss: Shape[]) => ss.map(s => ({ ...s, path: s.path.mirrorX() }));
  return {
    flats: o.flats.map(f => ({ ...f, group: { ...f.group, shapes: m(f.group.shapes) }, ...(f.emissive ? { emissive: { ...f.emissive, shapes: m(f.emissive.shapes) } } : {}),
      ...(f.text ? { text: f.text.map(t => ({ ...t, x: -t.x - t.w })) } : {}), ...(f.x ? { x: -f.x } : {}), ...(f.hinge !== undefined ? { hinge: -f.hinge, swing: -(f.swing ?? 0) } : {}) })),
    ...(o.lights ? { lights: o.lights.map(l => ({ ...l, x: -l.x })) } : {}), ...(o.emitters ? { emitters: o.emitters.map(e => ({ ...e, x: -e.x })) } : {}),
  };
}

// ---- The stairwell ------------------------------------------------------------------------------

const RISE = 18, GOING = 28;

/**
 * A building's stairwell seen side on, for walking up: `flights` flights (default 2) of `n` risers (8)
 * of 18 cm with 28 cm treads, each ending on a landing `land` cm long (110); every `perFloor`-th landing
 * (2) and the last are floor landings (a lamp that lights, a timer switch, with `doors` a flat's door with its number
 * from `numbers`), the others half-landings with the frosted stair window. The ground hall reaches `hall`
 * cm left of the foot (150: mailboxes, a lamp). The wall behind (z −40) is `color` with an oil-painted
 * `dado` that follows the stair, `head` cm (270) above the top landing; the stair is `stone` (mozaik) on a
 * plastered slab; the banister (iron bars, a wooden rail 92 cm over the nosings) stands at `railZ` (−3:
 * just behind the stair's profile; 45 puts it in front of the walkers). `dir` −1 climbs to the left.
 * Geometry (cm from the origin, the foot of the first riser; y up): flight k starts at x = k·((n−1)·28 + land),
 * y = k·n·18; its riser i is at x + i·28; its last riser lands at x + (n−1)·28 on landing k, which runs `land`
 * cm at y = (k+1)·n·18. Walk marks: a flight's foot half a tread before its first riser (x − 14), its top
 * half a tread onto the landing (x + (n−0.5)·28), so each of the n steps meets a riser; the landing's
 * middle at x + (n−1)·28 + land/2. With the defaults: foot (−14, 0), top (210, 144), landing (251, 144),
 * foot 2 (292, 144), top 2 (516, 288), landing 2 (557, 288). Marks stand in front of the stair (z ≈ +15).
 * `openings` cuts holes through the wall and its dado ({x, y, w, h}, x the middle, y the bottom): door pieces stand in
 * them (what is beyond shows when one opens) and a window piece in one shows the street behind.
 */
const stairwell: PieceDef = { draw(p, r) {
  const F = cl(Math.round(num(p.flights, 2)), 1, 12), n = cl(Math.round(num(p.n, 8)), 2, 20), land = Math.max(60, num(p.land, 110)), per = Math.max(1, Math.round(num(p.perFloor, 2)));
  const run = (n - 1) * GOING, seg = run + land, hall = Math.max(0, num(p.hall, 150)), head = num(p.head, 270), SL = 30, railZ = num(p.railZ, -3);
  const wallC = col(p.color, r.pick(["#D7E3CF", "#EFE2C6", "#D3DEE4", "#E8D6B4"])), dadoC = col(p.dado, r.pick(["#6F8A72", "#8A6F55", "#5F7A8C", "#9A6B58"]));
  const stone = col(p.stone, r.pick(["#CFC6B6", "#BDB6A8", "#D6CCB8"])), sideC = tone(mix(wallC, "#A39A8C", 0.6), "shade"), ironC = r.pick([IRON, "#3E4A3F", "#4A3A30"]), wood = r.pick(["#6B4A35", "#4E3B30", "#7A5034"]);
  const doorC = r.pick(DOOR.flat.c), nums = Array.isArray(p.numbers) ? p.numbers.map(String) : [];
  // holes through the wall (and its dado) for door pieces and clear windows: {x, y, w, h} cm, x the middle, y the bottom
  const holes = (Array.isArray(p.openings) ? p.openings : []).filter((o): o is Record<string, number> => !!o && typeof o === "object")
    .map(o => { const w = num(o.w, 90), h = num(o.h, 205), x0 = num(o.x, 0) - w / 2, y1 = -num(o.y, 0); return [x0, y1 - h, x0 + w, y1]; });
  const inHole = (x: number, y: number) => holes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && -y >= y0 && -y <= y1);
  /** A clip that keeps a wall's art out of its holes: the wall's box, each hole traced the other way round (nonzero). */
  const outside = (a: number, b: number, H: number) => { const hs = holes.filter(([x0, , x1]) => x1 > a && x0 < b); if (!hs.length) return undefined; const c = rect(a - 1, -H - 1, b - a + 2, H + 2); for (const [x0, y0, x1, y1] of hs) c.add(poly([[x0, y0], [x0, y1], [x1, y1], [x1, y0]])); return c; };
  const X = (k: number) => k * seg, Y = (k: number) => k * n * RISE, H = Y(F) + head;
  /** Heights above the origin (cm, up): the nosing line (the banister is 92 over it) and the stair's surface. */
  const nose = (x: number) => { if (x < -GOING) return 0; const k = cl(Math.floor((x + GOING) / seg), 0, F - 1), xx = x + GOING - k * seg; return xx < n * GOING ? Y(k) + xx * RISE / GOING : Y(k + 1); };
  const surf = (x: number) => { if (x < 0) return 0; const k = Math.min(F - 1, Math.floor(x / seg)), xx = x - X(k); return xx < run ? Y(k) + (Math.floor(xx / GOING) + 1) * RISE : Y(k + 1); };
  const breaks = (a: number, b: number) => [a, b, ...Array.from({ length: F }, (_, k) => [X(k) - GOING, X(k) + run]).flat()].filter(x => x >= a && x <= b).sort((u, v) => u - v);
  /** A band between two heights over the nosing line, from a to b. */
  const band = (a: number, b: number, lo: number, hi: number, floor0 = false) => { const xs = breaks(a, b); return poly([...xs.map(x => [x, -(nose(x) + hi)] as Vec2), ...xs.reverse().map(x => [x, -Math.max(floor0 ? 0 : -1e9, nose(x) + lo)] as Vec2)]); };
  const walls: FlatSpec[] = [], stairs: FlatSpec[] = [], rails: FlatSpec[] = [], lights: LightSpec[] = [];
  const lamp = (x: number, y: number, wall: Shape[], glow: Shape[]) => {
    wall.push(S(rect(x - 1.5, -y - 4, 3, 10), "#7C8288"), S(ellipse(x, -y + 10, 8, 9), "#F4EFE2"), S(rect(x - 5, -y + 1, 10, 3), "#9AA0A6"), S(ellipse(x - 2.5, -y + 7, 2.5, 3), "#FFFFFF", { flat: true, opacity: 0.6 }));
    glow.push(S(ellipse(x, -y + 10, 10, 11), WARM, { flat: true }));
    lights.push({ x, y: y - 12, z: -10, color: "#FFE2A8", radius: 3.2, intensity: 0.6 });
  };
  for (let k = 0; k < F; k++) {
    // the wall behind: paint, the dado following the stair, a shade under the flight, and what is on each landing
    // each flight's wall overlaps the next by a centimetre, so no seam shows between them
    const a = k ? X(k) : -hall, b = X(k + 1), wall: Shape[] = [S(rect(a - 1, -H, b - a + 2, H), wallC, { flat: true })], glow: Shape[] = [], text: TextSpec[] = [];
    wall.push(S(band(a - 1, b + 1, -20, 115, true), dadoC, { flat: true }), S(band(a - 1, b + 1, 113, 115.5), tone(dadoC, "deep"), { flat: true, opacity: 0.8 }));
    wall.push(S(band(Math.max(a, 12), b, -52, -SL, true), tone(wallC, "deep"), { flat: true, opacity: 0.12 }));
    if (!k) {
      wall.push(S(rect(a, -10, Math.min(6, b) - a, 10), tone(dadoC, "deep")));
      if (hall >= 80) lamp(-hall / 2, 232, wall, glow);
      if (hall >= 110) for (let i = 0; i < 8; i++) { const mx = -hall + 14 + (i % 4) * 16, my = -150 + Math.floor(i / 4) * 15; wall.push(S(rect(mx, my, 15, 14), "#8C7A5E"), S(rect(mx + 3, my + 3, 9, 1.6), "#2B2420", { flat: true }), S(rect(mx + 4, my + 8, 7, 3), "#FBF7EE", { flat: true })); }
    }
    const xm = X(k) + run + land / 2, ly = Y(k + 1), floorL = (k + 1) % per === 0 || k === F - 1;
    if (floorL) {
      lamp(xm, ly + (p.doors ? 242 : 232), wall, glow);
      const sx = xm + (p.doors ? 60 : 32);
      if (!inHole(sx, ly + 126)) {
        wall.push(S(rrect(sx - 3.5, -ly - 130, 7, 9, 1), "#F4F1EA"), S(ellipse(sx, -ly - 125.5, 1.4), "#E07A3A"));
        glow.push(S(ellipse(sx, -ly - 125.5, 1.6), "#FFB35C", { flat: true }));
      }
      if (p.doors) {
        const fl = Math.round((k + 1) / per), no = nums[fl - 1] ?? String(fl * 2), d = flatDoor(90, 205, doorC, r, no, p);
        wall.push(...sh([...d.frame, ...d.leaf, ...d.front.slice(0, 2)], xm, -ly));
        text.push(...tx(d.leafText, xm, -ly));
      }
    } else {
      const wy = -ly - 95;
      wall.push(S(rect(xm - 38, wy - 128, 76, 128), "#F1EEE6"), S(rect(xm - 32, wy - 122, 64, 116), "#DCE7EA"), S(rect(xm - 2, wy - 122, 4, 116), "#F1EEE6"));
      wall.push(lines(Array.from({ length: 12 }, (_, i) => [xm - 30, wy - 116 + i * 9.5, xm + 30, wy - 113 + i * 9.5]), "#FFFFFF", 1.2, 0.45), S(rect(xm - 44, wy, 88, 6), CONCRETE));
    }
    const clip = outside(a, b, H);
    walls.push({ group: { shapes: clip ? wall.map(x => ({ ...x, clip })) : wall, edge: 0.9 }, z: -40, ppcm: Math.min(1.2, 1900 / Math.max(b - a, H)), ...(glow.length ? { emissive: { shapes: glow, edge: 0 } } : {}), ...(text.length ? { text } : {}) });
    // the stair: the plastered slab, the step ends in stone, the treads and the landing
    const st: Vec2[] = k ? [[X(k), -Y(k) + SL - RISE], [X(k), -Y(k)]] : [[0, 0]], saw: Vec2[] = [], foot = -GOING + SL * GOING / RISE;
    for (let i = 0; i < n; i++) saw.push([X(k) + i * GOING, -(Y(k) + i * RISE)], [X(k) + i * GOING, -(Y(k) + (i + 1) * RISE)]);
    const slab: Vec2[] = [...st, ...saw.slice(1), [X(k + 1), -Y(k + 1)], [X(k + 1), -Y(k + 1) + SL], [X(k) + run, -Y(k + 1) + SL], ...(k ? [] : [[foot, 0]] as Vec2[])];
    const stair: Shape[] = [S(poly(slab), sideC), S(poly([...saw, [X(k) + run, -(Y(k + 1) - 14)], [X(k), -(Y(k) + 4)]]), tone(stone, "shade"))];
    const chips: number[][] = [];
    for (let i = 0; i < n - 1; i++) {
      const tx0 = X(k) + i * GOING, ty = -(Y(k) + (i + 1) * RISE);
      stair.push(S(rect(tx0 - 2.5, ty, GOING + 2.5, 4.5), stone), L([[tx0 - 2, ty + 0.6], [tx0 + GOING, ty + 0.6]], tone(stone, "light"), 0.8, 0.7));
      for (let j = 0; j < 4; j++) chips.push([tx0 + r.range(2, GOING - 2), ty + r.range(6, 15), r.range(0.6, 1.2)]);
    }
    stair.push(S(rect(X(k) + run - 2.5, -Y(k + 1), land + 2.5, 5), stone), L([[X(k) + run - 2, -Y(k + 1) + 0.6], [X(k + 1), -Y(k + 1) + 0.6]], tone(stone, "light"), 0.8, 0.7));
    stair.push(lines(Array.from({ length: Math.floor(land / 30) }, (_, i) => [X(k) + run + (i + 1) * 30, -Y(k + 1), X(k) + run + (i + 1) * 30, -Y(k + 1) + 5]), tone(stone, "deep"), 0.6, 0.4));
    stair.push(dots(chips, tone(stone, "deep"), 0.9, 0.5), dots(chips.map(([x, y, s]) => [x + 3, y - 2, s]), "#FFFFFF", 0.7, 0.4), L([[X(k) + run, -Y(k + 1) + SL], [k ? X(k) : foot, k ? -Y(k) + SL - RISE : 0]], tone(sideC, "deep"), 2, 0.3));
    stairs.push({ group: { shapes: stair, edge: 0.8 }, ppcm: 1.6, shadow: "drop" });
    // the banister: bars standing on the treads, a lower rail, the wooden handrail; a newel at the foot, a post at the top
    const ra = k ? X(k) - GOING : -24, rb = k < F - 1 ? X(k + 1) - GOING : X(F) - 3, xs: number[] = k ? [X(k) - 21, X(k) - 7] : [-7];
    for (let i = 0; i < n - 1; i++) xs.push(X(k) + i * GOING + 7, X(k) + i * GOING + 21);
    const le = X(k) + run + 7, re = k < F - 1 ? X(k + 1) - GOING - 6 : X(F) - 10, m = Math.max(1, Math.round((re - le) / 13));
    for (let i = 0; i <= m; i++) xs.push(le + (re - le) * i / m);
    const bars = new Path(), collars: number[][] = [];
    xs.forEach((x, i) => { const t = nose(x) + 89, s0 = surf(x); bars.add(rect(x - 0.8, -t, 1.6, t - s0 + 1)); if (i % 4 === 1) collars.push([x, -(s0 + t) / 2], [x, -(s0 + t) / 2 - 8]); });
    const rail: Shape[] = [{ path: bars, fill: ironC }, dots(collars, ironC, 1.7, 1), S(band(ra, rb, 10, 13), ironC), S(band(ra, rb, 89, 96), wood), S(band(ra, rb, 95, 96), tone(wood, "light"), { flat: true, opacity: 0.7 })];
    if (!k) rail.push(S(rect(-27, -104, 7, 104), wood), S(ellipse(-23.5, -106, 5, 4.5), wood), S(rect(-29, -12, 11, 12), tone(wood, "shade")));
    if (k === F - 1) rail.push(S(rect(X(F) - 6, -(Y(F) + 100), 5, 100), wood));
    rails.push({ group: { shapes: rail, edge: 0.5 }, z: railZ, ppcm: 1.6 });
  }
  // back to front, for a contact sheet (the stage sorts by depth)
  // every landing's lamp lights (the stage lights a shot with the four nearest what it shows)
  const out: PieceOut = { flats: railZ < 0 ? [...walls, ...rails, ...stairs] : [...walls, ...stairs, ...rails], lights };
  return num(p.dir, 1) < 0 ? mirrored(out) : out;
}, meta: {
  about: "A building's stairwell side on, for walking up: flights of stone steps, landings with lamps and flat doors, a banister.",
  params: {
    flights: { type: "int", min: 1, max: 12, default: 2 },
    n: { type: "int", min: 2, max: 20, default: 8, about: "risers per flight" },
    land: { type: "num", min: 60, default: 110, about: "landing length, cm" },
    perFloor: { type: "int", min: 1, default: 2, about: "every this many landings is a floor landing" },
    hall: { type: "num", min: 0, default: 150, about: "the ground hall left of the foot, cm" },
    head: { type: "num", default: 270, about: "wall above the top landing, cm" },
    railZ: { type: "num", default: -3, about: "the banister's depth, cm (45: in front of the walkers)" },
    color: { type: "color", about: "the wall; default seeded" },
    dado: { type: "color", about: "the oil-painted dado; default seeded" },
    stone: { type: "color", about: "the steps; default seeded" },
    doors: { type: "bool", about: "a flat's door on each floor landing" },
    numbers: { type: "list", about: "the floor doors' numbers; default 2, 4, …" },
    openings: { type: "list", about: "{x, y, w, h} holes cut through the wall (cm from the foot, x the middle, y the bottom): for door pieces that open onto a flat, or a clear window onto the street" },
    dir: { type: "int", min: -1, max: 1, default: 1, about: "-1 climbs to the left" },
  },
  terms: ["a1-w-merdiven"],
} };

// ---- The school corridor ------------------------------------------------------------------------

type Spot = { x: number; y: number; w: number; h: number; cut?: boolean };
const spots = (v: unknown, d: Spot[]): Spot[] => Array.isArray(v) ? v.filter(o => o && typeof o === "object").map(o => ({ x: num(o.x, 0), y: num(o.y, 125), w: num(o.w, 160), h: num(o.h, 130), cut: !!o.cut })) : d;

/**
 * A school corridor's back wall `w` × `h` (1000 × 320) in `color` with an oil-painted `dado` to 120 cm, a
 * bumper rail, skirting and the ceiling's edge with its fluorescent lights (two lights). `doors`: classroom
 * doors (`{x, number}`; default 503 and 504) with their number signs, or with `cut: true` a 95 × 210 doorway through
 * the wall for a place's own `door` piece of kind `class` (one that swings open on a door mark, the class beyond);
 * a window with `cut: true` is the hole and its radiator only, for a place's own `window` piece to frame; `windows` (`{x, y, w, h}`) cut through,
 * framed, with a radiator under each and the building across seen through them (`view` false: none);
 * `board` (`{x, w}`, false for none) is the notice board's place, kept clear of dressing. A fire
 * extinguisher, an exit sign over the first door and a switch by each door.
 */
/** A corridor's doorway for a class door piece, cm (`DOOR.class`). */
const CUT = { w: 95, h: 210 };
/** A corridor's doors from its params: `{x, number, cut}` or a number each. */
function corridorDoors(p: Record<string, unknown>, w: number): { x: number; no: string; cut: boolean }[] {
  const dl = Array.isArray(p.doors) ? p.doors : [{ x: -w * 0.36, number: "503" }, { x: w * 0.32, number: "504" }];
  return dl.map((o, i) => typeof o === "object" && o ? { x: num((o as Record<string, unknown>).x, -w / 2 + 150 + i * 300), no: String((o as Record<string, unknown>).number ?? ""), cut: !!(o as Record<string, unknown>).cut } : { x: -w / 2 + 150 + i * 300, no: String(o), cut: false });
}
const corridor: PieceDef = { draw(p, r) {
  const w = num(p.w, 1000), h = num(p.h, 320), wallC = col(p.color, r.pick(["#EFE6D2", "#E4E8DC", "#EDE3CF"])), dadoC = col(p.dado, r.pick(["#9DB2A2", "#B7A58A", "#8FA3B5", "#C79A84"]));
  const doors = corridorDoors(p, w);
  const wins = spots(p.windows, [{ x: w * 0.06, y: 125, w: 160, h: 130 }]);
  const bo = p.board === false ? null : { x: num((p.board as Record<string, unknown> | undefined)?.x, -w * 0.1), w: num((p.board as Record<string, unknown> | undefined)?.w, 170) };
  // a cut door is a doorway through the wall, its dado and skirting, for a `door` piece to stand in
  const cuts = doors.filter(d => d.cut).map(d => [d.x - CUT.w / 2, d.x + CUT.w / 2]);
  /** A band of the wall from y0 up h cm, less the doorways. */
  const band = (y0: number, bh: number) => holed(rect(-w / 2, y0, w, bh), cuts.filter(() => y0 + bh > -CUT.h).map(([a, b]) => rect(a, Math.max(y0, -CUT.h), b - a, Math.min(y0 + bh, 0) - Math.max(y0, -CUT.h))));
  const holes = [...wins.map(o => rect(o.x - o.w / 2, -o.y - o.h, o.w, o.h)), ...cuts.map(([a, b]) => rect(a, -CUT.h, b - a, CUT.h))], shapes: Shape[] = [S(holed(rect(-w / 2, -h, w, h), holes), wallC, { evenodd: true })];
  const glow: Shape[] = [], lit: Shape[] = [], view: Shape[] = [], text: TextSpec[] = [];
  shapes.push(S(band(-120, 120), dadoC, { evenodd: true }), S(band(-124, 7), tone(dadoC, "deep"), { evenodd: true }), S(band(-10, 10), "#5A4A3E", { evenodd: true }), S(rect(-w / 2, -h, w, 16), tone(wallC, "light")), S(rect(-w / 2, -h + 16, w, 2), tone(wallC, "shade"), { flat: true, opacity: 0.5 }));
  shapes.push(S(rect(-w / 2, -h + 18, w, 60), tone(wallC, "shade"), { flat: true, opacity: 0.18 }));
  const doorC = r.pick(DOOR.class.c), taken: [number, number][] = [];
  for (const [i, d] of doors.entries()) {
    shapes.push(S(rrect(d.x - 64, -116, 7, 11, 1), "#F4F1EA"));
    if (!d.cut) { const a = classDoor(95, 210, doorC, r, d.no, p); shapes.push(...sh([...a.frame, ...a.leaf], d.x)); text.push(...tx(a.text, d.x)); }
    taken.push([d.x - 70, d.x + 100]);
    if (!i) { shapes.push(S(rrect(d.x - 18, -250, 36, 16, 2), "#1F8F5E"), P([[d.x - 10, -242, 0], [d.x + 4, -242, 0], [d.x + 4, -246, 0], [d.x + 11, -241.5, 0], [d.x + 4, -237, 0], [d.x + 4, -240, 0], [d.x - 10, -240, 0]], "#F7F3EA", { flat: true })); glow.push(S(rect(d.x - 16, -248, 32, 12), "#86D99A", { flat: true, opacity: 0.8 })); }
  }
  for (const o of wins) {
    const x0 = o.x - o.w / 2, y0 = -o.y - o.h;
    if (!o.cut) {
      shapes.push(S(holed(rect(x0 - 7, y0 - 7, o.w + 14, o.h + 14), [rect(x0, y0, o.w, o.h)]), "#F1EFEA", { evenodd: true }), S(rect(o.x - 2.5, y0, 5, o.h), "#F1EFEA"), S(rect(x0, y0 + o.h * 0.3, o.w, 4), "#F1EFEA"));
      shapes.push(S(rect(x0, y0, o.w, o.h), GLASS, { flat: true, opacity: 0.12 }), glint(x0 + 12, y0 + o.h - 10, x0 + 40, y0 + 40), S(rect(x0 - 12, -o.y, o.w + 24, 7), "#E2DCD0"));
    }
    shapes.push(...radiator(o.x, Math.min(o.w * 0.8, 140), 55, false, "#F1EFEA"));
    if (p.view !== false) view.push(...outside(r, x0 - 40, y0 - 30, o.w + 80, o.h + 60, lit));
    taken.push([x0 - 20, x0 + o.w + 20]);
  }
  if (bo) taken.push([bo.x - bo.w / 2 - 10, bo.x + bo.w / 2 + 10]);
  // a fire extinguisher where the wall is free
  for (let t = 0; t < 12; t++) {
    const ex = r.range(-w / 2 + 40, w / 2 - 40);
    if (taken.some(([a, b]) => ex > a - 20 && ex < b + 20)) continue;
    shapes.push(S(rect(ex - 9, -152, 18, 4), "#5B6770"), S(rrect(ex - 7, -150, 14, 46, 6), "#C4302B"), S(rrect(ex - 3, -156, 6, 7, 1), IRON), L([[ex + 2, -152], [ex + 11, -140], [ex + 9, -116]], IRON, 1.6, 1), S(rect(ex - 6, -136, 12, 10), "#F7F3EA", { flat: true }));
    shapes.push(S(rrect(ex - 9, -186, 18, 18, 1.5), "#C4302B"), P([[ex - 3, -172, 0], [ex + 3, -172, 0], [ex + 4, -177], [ex, -183, 0], [ex - 4, -177]], "#F7F3EA", { flat: true }));
    break;
  }
  // the ceiling's lights
  const nl = Math.max(1, Math.round(w / 330)), lights: LightSpec[] = [];
  for (let i = 0; i < nl; i++) {
    const x = -w / 2 + (i + 0.5) * w / nl;
    shapes.push(S(rrect(x - 62, -h + 18, 124, 9, 2), "#F4F2EE"), S(rect(x - 58, -h + 25, 116, 4), "#FFFDF0"));
    glow.push(S(rect(x - 60, -h + 24, 120, 6), "#FFFDF0", { flat: true }));
    if (i === Math.floor(nl / 4) || i === Math.floor(3 * nl / 4)) lights.push({ x, y: h - 40, z: 70, color: "#F2F5FF", radius: 4.5, intensity: 0.5 });
  }
  const ppcm = Math.min(0.9, 1900 / w), flats: FlatSpec[] = [];
  if (view.length) flats.push({ group: { shapes: view, edge: 0.6 }, z: -60, ppcm: 0.8 }, ...litByTurns(lit, { z: -60, ppcm: 0.8 }));
  flats.push({ group: { shapes, edge: 1 }, ppcm, emissive: { shapes: glow, edge: 0 }, ...(text.length ? { text } : {}) });
  return { flats, lights: [...new Set(lights)].slice(0, 2) };
}, meta: {
  about: "A school corridor's back wall: a painted dado, classroom doors, windows with radiators, a notice board's place, ceiling lights.",
  params: {
    w: { type: "num", default: 1000, about: "cm" },
    h: { type: "num", default: 320, about: "cm" },
    color: { type: "color", about: "the wall; default seeded" },
    dado: { type: "color", about: "the dado; default seeded" },
    doors: { type: "list", about: "classroom doors, {x, number, cut} or a number each; default 503 and 504; cut: a doorway for a door piece" },
    windows: { type: "list", about: "{x, y, w, h, cut} each; default one; cut: the hole only, for a window piece to frame" },
    view: { type: "bool", default: true, about: "the building across, seen through the windows" },
    board: { type: ["object", "bool"], about: "{x, w}: the notice board's place kept clear, or false for none" },
  },
  terms: ["a1-w-koridor"],
} };

// ---- Balconies ----------------------------------------------------------------------------------

/** A Turkish flag hanging from its top edge at (0, 0) over a rail, `w` wide. */
function flag(w: number): Shape[] {
  const h = w * 2 / 3, cy = h / 2, R = h / 4, star: Vec2[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.2 : R * 0.5; star.push([-w / 2 + h * 0.9 + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return [S(rect(-w / 2, 1, w, h), "#E30A17"), S(ellipse(-w / 2 + h * 0.5, cy, R, R), "#FFFFFF", { flat: true }), S(ellipse(-w / 2 + h * 0.5 + R * 0.25, cy, R * 0.8, R * 0.8), "#E30A17", { flat: true }),
    { path: poly(star), fill: "#FFFFFF", flat: true }, S(rect(w / 2 - 6, 1, 6, h), "#B8000F", { flat: true, opacity: 0.35 }), lines([[-w / 2 + 2, 1, -w / 2, -4], [w / 2 - 2, 1, w / 2, -4]], "#F7F3EA", 1.4, 1)];
}

/**
 * A balcony, `kind`: `facade` (a small balcony on a building front: the slab, an iron rail, pots, now and
 * then laundry, the balcony door behind it (`behind` false: none); a Turkish `flag` hung over the rail,
 * shown only in the place state `flagState` when one is given); `door` (a balcony door seen from inside:
 * a glazed double door `w` × `h` (150 × 225) whose two leaves swing in, curtains, the balcony rail and the street beyond);
 * `rail` (the rail from the balcony itself, `w` × `h` 300 × 100, a flat cap Kerim perches on at h + 4, pots,
 * and the city behind unless `view` is false). `color` is the iron. Origin: the balcony's (or the room's)
 * floor. `n` balconies stand in rows of three, `gap` × 300 cm apart.
 */
const balcony: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "facade"), ironC = col(p.color, r.pick([IRON, "#2F4A3A", "#ECE8DF", "#3E3A4A"])), held = !!p.held;
  if (kind === "door") {
    const w = num(p.w, 150), h = num(p.h, 225), fc = r.pick(["#F1EFEA", "#E8E2D4", "#8A5A3A"]), lit: Shape[] = [];
    const view = [...outside(r, -w / 2 - 90, -h - 100, w + 180, h + 100, lit), S(rect(-w / 2 - 90, -16, w + 180, 16), "#C9B9A0"), ...railing(-w / 2 - 90, w / 2 + 90, -10, 100, ironC), ...pot(-w / 4, -10, r)];
    const cc = r.pick(["#B3473A", "#2F6E6A", "#C9A25A", "#7A3E6E", "#4F6E9E"]), frame: Shape[] = [jambs(w, h, 9, "#F1EFEA"), S(holed(rect(-w / 2, -h, w, h), [rect(-w / 2 + 5, -h + 5, w - 10, h - 5)]), fc, { evenodd: true }), S(rect(-w / 2 - 12, -5, w + 24, 5), "#D8D0C0")];
    const curtains: Shape[] = [S(rect(-w / 2 - 60, -h - 34, w + 120, 3.5), "#8A6A4A"), S(ellipse(-w / 2 - 62, -h - 32.2, 3.5), "#8A6A4A"), S(ellipse(w / 2 + 62, -h - 32.2, 3.5), "#8A6A4A")];
    for (const d of [-1, 1]) {
      const o = d * (w / 2 + 6), i = d * (w / 2 - 14), e = d * (w / 2 + 52);
      curtains.push(P([[o - d * 20, -h - 31, 0], [i + d * 6, -h - 31, 0], [i + d * 2, -h * 0.55], [o + d * 18, -h * 0.45], [i + d * 4, -40], [i, 0, 0], [o - d * 28, 0, 0], [o - d * 24, -h * 0.5]], "#F7F3EA", { opacity: 0.55 }));
      curtains.push(P([[e, -h - 31, 0], [o + d * 2, -h - 31, 0], [o - d * 4, -h * 0.6], [o + d * 8, -h * 0.47], [o, -h * 0.2], [o - d * 2, 0, 0], [e + d * 4, 0, 0], [e + d * 8, -h * 0.5]], cc));
      curtains.push(lines([0.3, 0.55, 0.8].map(t => [e + (o - e) * t, -h - 28, e + (o - e) * t + d * 3, -4]), tone(cc, "shade"), 1.4, 0.5), S(rrect(Math.min(o, e + d * 6) - 1, -h * 0.5 - 3, Math.abs(o - e) - 4, 5, 2.5), tone(cc, "deep")));
    }
    const lw = (w - 10) / 2, leaf = (x0: number, d: number): Shape[] => {
      const g = rect(x0 + 7, -h + 12, lw - 14, h - 62), hx = d < 0 ? x0 + lw - 5 : x0 + 5;
      return [S(holed(rect(x0, -h + 5, lw, h - 5), [g]), fc, { evenodd: true }), S(g, GLASS, { flat: true, opacity: 0.18 }), ...panel(x0 + 7, -44, lw - 14, 38, fc), glint(x0 + 14, -70, x0 + lw * 0.6, -h + 40, 3, 0.25), S(rrect(hx - 1.6, -h * 0.5 - 12, 3.2, 20, 1.6), STEEL)];
    };
    if (held) return { flats: [{ group: { shapes: [...frame, ...leaf(-w / 2 + 5, -1), ...leaf(0, 1)], edge: 0.7 }, ppcm: 1.2, id: "balcony" }] };
    return { flats: [
      { group: { shapes: view, edge: 0.5 }, z: -130, ppcm: 0.9 }, ...litByTurns(lit, { z: -130, ppcm: 0.9 }),
      { group: { shapes: frame, edge: 0.8 }, ppcm: 1.6, id: "balcony", shadow: "drop" },
      { group: { shapes: leaf(-w / 2 + 5, -1), edge: 0.7 }, z: 1, ppcm: 1.6, id: "leaf", hinge: -w / 2 + 5, swing: -1.25 },
      { group: { shapes: leaf(0, 1), edge: 0.7 }, z: 1, ppcm: 1.6, id: "leaf", hinge: w / 2 - 5, swing: 1.25 },
      { group: { shapes: curtains, edge: 0.5 }, z: 6, ppcm: 1.4 },
    ] };
  }
  if (kind === "rail") {
    const w = num(p.w, 300), h = num(p.h, 100), cap = r.pick(["#6B4A35", ironC, "#8A8178"]), lit: Shape[] = [], flats: FlatSpec[] = [];
    if (p.view !== false && !held) {
      const W = w * 2.2 + 600, city: Shape[] = [S(rect(-W / 2, -150, W, 70), "#7FA3B8"), S(rect(-W / 2, -150, W, 3), "#B9D0DC", { flat: true })], far: Shape[] = [];
      for (let x = -W / 2; x < W / 2;) {
        const bw = r.range(50, 110), bh = r.range(40, 120), c = mix(r.pick(FACADES), "#A9B4BE", 0.45), y = -80;
        far.push(S(rect(x, y - bh, bw, bh + 80), c), r.chance(0.5) ? P([[x - 4, y - bh, 0], [x + bw + 4, y - bh, 0], [x + bw / 2, y - bh - 22, 0]], mix("#B8562F", "#A9B4BE", 0.4)) : S(rect(x - 3, y - bh - 5, bw + 6, 6), tone(c, "shade")));
        for (let wy = y - bh + 12; wy < y + 60; wy += 30) for (let wx = x + 8; wx < x + bw - 12; wx += 22) { far.push(S(rect(wx, wy, 9, 14), "#6A7888", { flat: true, opacity: 0.8 })); if (r.chance(0.35)) lit.push(S(rect(wx, wy, 9, 14), "#FFD27A", { flat: true })); }
        x += bw + r.range(-6, 6);
      }
      const mx = r.range(-W / 4, W / 4), mc = "#C9C3B6";
      city.push(S(smooth([[mx - 70, -150, 0], [mx - 62, -205], [mx, -232], [mx + 62, -205], [mx + 70, -150, 0]], true), mc), S(rect(mx - 3, -248, 6, 18), mc));
      for (const d of [-1, 1]) city.push(S(rect(mx + d * 95 - 4, -330, 8, 180), mc), S(rect(mx + d * 95 - 7, -290, 14, 5), tone(mc, "shade")), P([[mx + d * 95 - 5, -330, 0], [mx + d * 95 + 5, -330, 0], [mx + d * 95, -368, 0]], "#8E96A0"));
      flats.push({ group: { shapes: [...city, ...far], edge: 0.6 }, z: -600, y: -120, ppcm: Math.min(0.6, 1900 / W), switch: false }, ...litByTurns(lit, { z: -600, y: -120, ppcm: Math.min(0.6, 1900 / W) }, 5, 0.2, 0.8));
    }
    const front: Shape[] = [S(rect(-w / 2, -12, w, 14), CONCRETE), S(rect(-w / 2, -12, w, 2.5), tone(CONCRETE, "light"), { flat: true }), ...railing(-w / 2, w / 2, -12, h - 12, ironC, 7, cap)];
    for (let x = -w / 2 + 60; x < w / 2; x += 100) front.push(S(rect(x - 2.5, -h, 5, h - 12), ironC));
    flats.unshift({ group: { shapes: front, edge: 0.6 }, ppcm: 1.6, id: "balcony" });
    if (!held) { const pots: Shape[] = []; for (let i = r.int(1, 3); i > 0; i--) pots.push(...pot(r.range(-w / 2 + 25, w / 2 - 25), 0, r)); flats.push({ group: { shapes: pots, edge: 0.5 }, z: 18, ppcm: 2 }); }
    return { flats: held ? flats.slice(0, 1) : [...flats.slice(1, -1), flats[0], flats[flats.length - 1]] };
  }
  // a balcony on a façade
  const w = num(p.w, 160), n = held ? 1 : cl(Math.round(num(p.n, 1)), 1, 12), cols = Math.min(n, 3), gap = num(p.gap, w + 120);
  const flagOn = !!p.flag, fs = str(p.flagState, "");
  const main: Shape[] = [], behind: Shape[] = [], flats: FlatSpec[] = [];
  for (let i = 0; i < n; i++) {
    const dx = ((i % cols) - (cols - 1) / 2) * gap, dy = -Math.floor(i / cols) * 300, b: Shape[] = [], m: Shape[] = [];
    if (p.behind !== false) {
      const dw = Math.min(w - 40, 90);
      b.push(S(rect(-dw / 2 - 6, -216, dw + 12, 216), "#ECE8DF"), S(rect(-dw / 2, -210, dw, 210), "#3A4450"), S(rect(-1.5, -210, 3, 210), "#ECE8DF"), S(rect(-dw / 2, -210, dw * 0.45, 170), "#F7F3EA", { flat: true, opacity: 0.3 }), glint(-dw / 2 + 10, -60, -dw / 2 + 30, -180));
    }
    m.push(S(rect(-w / 2 - 4, 0, w + 8, 15), "#CFC8BA"), S(rect(-w / 2 - 4, 11, w + 8, 4), tone("#CFC8BA", "shade"), { flat: true }), S(rect(-w / 2 + 2, 15, w - 4, 6), "#6E6658", { flat: true, opacity: 0.18 }));
    for (const d of [-1, 1]) { const o = d * (w / 2 - 8); m.push(P([[o, 14, 0], [o - d * 18, 14, 0], [o - d * 6, 22], [o - d, 34, 0], [o, 34, 0]], "#C2BBAD")); }
    for (let k = r.int(0, 2); k > 0; k--) m.push(...pot(r.range(-w / 2 + 20, w / 2 - 20), 0, r));
    if (r.chance(0.3)) { m.push(L([[-w / 2 + 8, -150], [w / 2 - 8, -150]], "#5B6067", 0.8, 0.9)); for (let x = -w / 2 + 16; x < w / 2 - 30; x += r.range(26, 40)) m.push(S(rect(x, -150, r.range(16, 26), r.range(24, 50)), r.pick(["#F7F3EA", "#8DB8DA", "#E58FA0", "#E0A83A", "#9AA0A6"]))); }
    m.push(...railing(-w / 2 + 2, w / 2 - 2, 0, 95, ironC));
    behind.push(...sh(b, dx, dy)); main.push(...sh(m, dx, dy));
    if (flagOn && !held) flats.push({ group: { shapes: flag(Math.min(80, w * 0.5)), edge: 0.4 }, x: dx + r.range(-w * 0.15, w * 0.15), y: 92 - dy, z: 3, ppcm: 2, move: { sway: { rot: 0.025, ms: r.range(2600, 3600) }, phase: r() }, ...(fs ? { when: { state: [fs] } } : {}) });
  }
  if (held) return { flats: [{ group: { shapes: main, edge: 0.6 }, ppcm: 1.4, id: "balcony" }] };
  return { flats: [...(behind.length ? [{ group: { shapes: behind, edge: 0.6 }, z: -12, ppcm: 1.4 }] : []), { group: { shapes: main, edge: 0.6 }, ppcm: Math.min(1.6, 1900 / (cols * gap)), id: "balcony", shadow: "drop" as const }, ...flats] };
}, variants: { facade: { kind: "facade", flag: true }, door: { kind: "door" }, rail: { kind: "rail" } },
  meta: {
    about: "A balcony: one on a building front (pots, laundry, a flag), a balcony door seen from inside, or the rail from the balcony itself.",
    params: {
      kind: { type: "enum", values: ["facade", "door", "rail"], default: "facade" },
      color: { type: "color", about: "the iron; default seeded" },
      w: { type: "num", about: "cm; facade 160, door 150, rail 300" },
      h: { type: "num", about: "cm; door 225, rail 100" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "facade balconies, in rows of three" },
      gap: { type: "num", about: "cm between facade balconies; default w + 120" },
      behind: { type: "bool", default: true, about: "the balcony door behind a facade balcony" },
      flag: { type: "bool", about: "a Turkish flag over a facade balcony's rail" },
      flagState: { type: "text", about: "the place state the flag shows in; none: always" },
      view: { type: "bool", default: true, about: "the rail's city behind" },
    },
    states: ["flags"],
    terms: ["a1-w-balkon", "a1-w-bayrak"],
  } };

// ---- The roof -----------------------------------------------------------------------------------

/**
 * The old water tank on a roof: a horizontal steel cylinder `w` × `d` (200 × 110) in `color` on a stand
 * `stand` cm high (90) of steel angle with cross-bracing, on concrete pads; seams and rivets, the manhole,
 * the inlet and outlet pipes with a valve, rust streaks (`rust` 0…1). A perch: its top is at stand + d.
 */
const waterTank: PieceDef = { draw(p, r) {
  const L0 = num(p.w, 200), D = num(p.d, 110), H = num(p.stand, 90), c = col(p.color, r.pick(["#A9B0B3", "#9FA9A8", "#7F98A8", "#B7AE9C"])), rust = cl(num(p.rust, r.range(0.4, 0.8)), 0, 1), st = "#5B6067";
  const top = -H - D, out: Shape[] = [], lx = [-L0 / 2 + 22, L0 / 2 - 22];
  out.push(...lx.map(x => S(rect(x - 6 + 12, -H, 5, H), tone(st, "shade"))), lines([[lx[0] + 3, -H + 4, lx[1] - 3, -6], [lx[0] + 3, -6, lx[1] - 3, -H + 4]], st, 2.4, 1));
  for (const x of lx) out.push(S(rect(x - 3, -H, 6, H), st), S(rect(x - 11, -6, 22, 6), CONCRETE));
  out.push(S(rect(-L0 / 2 + 10, -H - 6, L0 - 20, 7), st));
  for (const x of lx) out.push(P([[x - 16, -H, 0], [x + 16, -H, 0], [x + 16, -H - 14], [x - 16, -H - 14]], tone(st, "light")));
  // the cylinder: its round end, the body, light along the top, shade below
  out.push(S(ellipse(-L0 / 2 + 4, top + D / 2, 13, D / 2), tone(c, "light")), S(rrect(-L0 / 2, top, L0, D, 9), c));
  out.push(S(rect(-L0 / 2 + 4, top + D * 0.12, L0 - 8, D * 0.18), tone(c, "light"), { flat: true, opacity: 0.45 }), S(rect(-L0 / 2 + 4, top + D * 0.7, L0 - 8, D * 0.26), tone(c, "shade"), { flat: true, opacity: 0.45 }));
  const seams: number[][] = [], rivets: number[][] = [];
  for (let k = 1; k < 4; k++) { const x = -L0 / 2 + k * L0 / 4; seams.push([x, top + 2, x, top + D - 2]); for (let y = top + 8; y < top + D - 4; y += 9) rivets.push([x + 2, y]); }
  out.push(lines(seams, tone(c, "deep"), 1.2, 0.5), dots(rivets, tone(c, "deep"), 0.9, 0.7));
  // rust: streaks down from the seams, a patch at the bottom
  const streaks = new Path();
  for (let i = 0; i < 9; i++) { const x = r.range(-L0 / 2 + 10, L0 / 2 - 10), y = top + r.range(6, D * 0.5), l = r.range(18, D * 0.6), ww = r.range(1.5, 4); streaks.add(smooth([[x - ww / 2, y, 0], [x + ww / 2, y, 0], [x + ww * 0.2, y + l, 0]], true)); }
  out.push({ path: streaks, fill: RUST, flat: true, opacity: 0.25 + 0.3 * rust }, P([[-L0 / 2 + 20, top + D - 2], [-L0 * 0.1, top + D - 12], [L0 * 0.2, top + D - 6], [L0 / 2 - 14, top + D - 14], [L0 / 2 - 10, top + D - 1, 0], [-L0 / 2 + 16, top + D - 1, 0]], "#8A4A2A", { flat: true, opacity: 0.2 + 0.3 * rust }));
  out.push(S(rrect(-L0 * 0.15 - 15, top - 7, 30, 9, 2), tone(c, "shade")), { path: smooth([[-L0 * 0.15 - 5, top - 7], [-L0 * 0.15, top - 13], [-L0 * 0.15 + 5, top - 7]], false), stroke: { color: st, width: 1.4 } });
  // the pipes and a red valve wheel
  out.push(lines([[L0 / 2 - 6, top + 12, L0 / 2 + 14, top + 12], [L0 / 2 + 14, top + 12, L0 / 2 + 14, 0], [-L0 / 2 + 34, -H, -L0 / 2 + 34, -H + 30], [-L0 / 2 + 34, -H + 30, -L0 / 2 - 12, -H + 30], [-L0 / 2 - 12, -H + 30, -L0 / 2 - 12, 0]], "#8C9298", 4, 1));
  out.push({ path: ellipse(-L0 / 2 + 12, -H + 30, 5, 5), stroke: { color: "#B3261E", width: 1.6 }, flat: true }, S(ellipse(-L0 / 2 + 12, -H + 30, 1.4), "#B3261E"));
  return { flats: [{ group: { shapes: out, edge: 0.7 }, ppcm: Math.min(1.8, 1900 / (L0 + 60)), shadow: "drop" }] };
}, meta: {
  about: "The old water tank on a roof: a riveted steel cylinder on a braced stand, pipes and a valve, rust streaks.",
  params: {
    w: { type: "num", default: 200, about: "length, cm" },
    d: { type: "num", default: 110, about: "diameter, cm" },
    stand: { type: "num", default: 90, about: "the stand's height, cm" },
    color: { type: "color", about: "default seeded" },
    rust: { type: "num", min: 0, max: 1, about: "how rusty; default seeded" },
  },
} };

/** A short iron ladder `h` × `w` (200 × 42) in `color`: two flat-bar stiles curling over at the top (`hooks` false: straight), round rungs every 28 cm (the first at 28), rust. */
const ladder: PieceDef = { draw(p, r) {
  const h = num(p.h, 200), w = num(p.w, 42), c = col(p.color, r.pick([IRON, "#4A4F55", "#5E4A3A"])), out: Shape[] = [];
  for (let y = 28; y < h - 6; y += 28) out.push(S(rrect(-w / 2, -y - 1.7, w, 3.4, 1.7), tone(c, "light")), S(rect(-w / 2, -y + 0.8, w, 1), tone(c, "deep"), { flat: true, opacity: 0.6 }));
  for (const d of [-1, 1]) {
    out.push(S(rect(d * w / 2 - 2.5, -h, 5, h), c), S(rect(d * w / 2 - 5, -3, 10, 3), tone(c, "shade")));
    if (p.hooks !== false) out.push({ path: smooth([[d * w / 2, -h + 1], [d * w / 2, -h - 8], [d * w / 2 + d * 5, -h - 13], [d * w / 2 + d * 10, -h - 8]], false), stroke: { color: c, width: 4.5, cap: "round" } });
  }
  out.push(dots(Array.from({ length: 7 }, () => [r.pick([-1, 1]) * w / 2 + r.range(-1.5, 1.5), -r.range(10, h - 10), r.range(0.6, 1.3)]), RUST, 1.5, 0.6));
  return { flats: [{ group: { shapes: out, edge: 0.5 }, ppcm: 2.5, shadow: "drop" }] };
}, meta: {
  about: "A short iron ladder: flat-bar stiles curling over at the top, round rungs every 28 cm, rust.",
  params: {
    h: { type: "num", default: 200, about: "cm" },
    w: { type: "num", default: 42, about: "cm" },
    color: { type: "color", about: "default seeded" },
    hooks: { type: "bool", default: true, about: "the stiles curl over at the top" },
  },
  terms: ["a1-w-merdiven"],
} };

/**
 * Roof chimneys, `n` (1) of them `gap` cm apart, each `w` × `h` above the roof (seeded about 45 × 115),
 * plastered or `brick` (`kind`), with a slab cap on posts, a cowl or two clay pots; sometimes a stove flue
 * beside it, and an `aerial` (true, false or seeded) strapped to it. `smoke` makes them smoke. A perch:
 * the top of its cap.
 */
const chimney: PieceDef = { draw(p, r) {
  const n = cl(Math.round(num(p.n, 1)), 1, 4), gap = num(p.gap, 120), out: Shape[] = [], emitters: { kind: "smoke"; x: number; y: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap + (n > 1 ? r.range(-12, 12) : 0), w = num(p.w, r.range(38, 55)), h = num(p.h, r.range(90, 140));
    const brick = p.kind === "brick" || (p.kind === undefined && r.chance(0.45)), c = brick ? r.pick(["#A5553A", "#9A4E36", "#B0644A"]) : r.pick(["#D9D0BF", "#CFC4B0", "#E2D6C0"]), l = x - w / 2;
    out.push(S(rect(l, -h, w, h), c), S(rect(x + w / 2 - 7, -h, 7, h), tone(c, "shade"), { flat: true, opacity: 0.5 }));
    if (brick) {
      const seg: number[][] = [];
      for (let y = -7.5, k = 0; y > -h; y -= 7.5, k++) { seg.push([l, y, l + w, y]); for (let xx = l + (k % 2 ? 11 : 0) + 11; xx < l + w; xx += 22) seg.push([xx, y, xx, y - 7.5]); }
      out.push(lines(seg, tone(c, "light"), 0.7, 0.45));
    } else out.push(S(rect(l, -h, w, 24), "#3A3330", { flat: true, opacity: 0.22 }), L([[l + 8, -h * 0.4], [l + 14, -h * 0.55], [l + 11, -h * 0.7]], tone(c, "deep"), 0.6, 0.5));
    out.push(S(rect(l - 4, -h - 6, w + 8, 7), tone(c, "light")));
    const capK = r.int(0, 2);
    let capTop: number;
    if (capK === 0) { out.push(S(rect(l + 1, -h - 20, w - 2, 14), "#2B2420"), S(rect(l + 1, -h - 20, 6, 14), c), S(rect(x + w / 2 - 7, -h - 20, 6, 14), c), S(rect(l - 7, -h - 28, w + 14, 8), CONCRETE)); capTop = h + 28; }
    else if (capK === 1) { out.push(S(rect(x - 7, -h - 24, 14, 18), "#9AA0A6"), P([[x - 20, -h - 24, 0], [x + 20, -h - 24, 0], [x, -h - 42, 0]], "#7C8288")); capTop = h + 42; }
    else { for (const d of [-1, 1]) out.push(P([[x + d * w / 4 - 8, -h - 6, 0], [x + d * w / 4 + 8, -h - 6, 0], [x + d * w / 4 + 6, -h - 30, 0], [x + d * w / 4 - 6, -h - 30, 0]], "#B8562F"), S(rect(x + d * w / 4 - 7.5, -h - 33, 15, 4), tone("#B8562F", "light"))); capTop = h + 33; }
    if (r.chance(0.4)) { const fx = x + w / 2 + 12; out.push(S(rect(fx - 3, -h * 0.85, 6, h * 0.85), "#8C9298"), P([[fx - 9, -h * 0.85, 0], [fx + 9, -h * 0.85, 0], [fx, -h * 0.85 - 10, 0]], "#6C7680")); }
    if (p.aerial === true || (p.aerial === undefined && r.chance(0.5))) {
      const ax = l + 6, at = -h - r.range(110, 150), bw = r.range(70, 100), el: number[][] = [];
      for (let k = 0; k < 7; k++) { const ex = ax - bw / 2 + k * bw / 6, eh = 18 - k * 1.6; el.push([ex, at - eh / 2, ex, at + eh / 2]); }
      out.push(lines([[ax, -h * 0.4, ax, at - 4], [ax - bw / 2, at, ax + bw / 2, at], ...el], "#5B6067", 1.6, 1), lines([[ax, at + 24, ax - 55, -h * 0.5], [ax, at + 24, ax + w + 30, -h * 0.6]], "#5B6067", 0.5, 0.6), S(rect(ax - 3, -h * 0.55, 6, 3), "#5B6067"), S(rect(ax - 3, -h * 0.8, 6, 3), "#5B6067"));
    }
    if (p.smoke) emitters.push({ kind: "smoke", x, y: capTop, w: w * 0.5 });
  }
  return { flats: [{ group: { shapes: out, edge: 0.6 }, ppcm: 2, id: "chimney" }], ...(emitters.length ? { emitters } : {}) };
}, meta: {
  about: "Roof chimneys, plastered or brick, with a slab cap, a cowl or clay pots; sometimes a flue and a TV aerial; smoking if asked.",
  params: {
    n: { type: "int", min: 1, max: 4, default: 1 },
    gap: { type: "num", default: 120, about: "cm" },
    w: { type: "num", about: "cm; default seeded, about 45" },
    h: { type: "num", about: "cm above the roof; default seeded, about 115" },
    kind: { type: "enum", values: ["plaster", "brick"], about: "default seeded" },
    aerial: { type: "bool", about: "a TV aerial strapped to it; default seeded" },
    smoke: { type: "bool" },
  },
} };

// ---- Heaters ------------------------------------------------------------------------------------

/**
 * A heater, `kind`: `radiator` (`w` × `h` 100 × 60 on its brackets 12 cm off the floor, a steel panel, or
 * `style` column for cast-iron sections, `color`; a valve and pipes) or `boiler` (the wall-hung kombi, its
 * origin the foot of its pipes: a white case 42 × 72 above 26 cm of pipes with coloured valve levers, a
 * pressure gauge, two knobs and a lit display saying `display` (default "E-01"), blinking when `blink`
 * (default: when it shows an error code); in the place state `faultState` the code `fault` blinks over it instead). `n` side by side.
 */
const heater: PieceDef = { draw(p, r) {
  const boiler = str(p.kind, "radiator") === "boiler", held = !!p.held, n = held ? 1 : cl(Math.round(num(p.n, 1)), 1, 6);
  const out: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [], flats: FlatSpec[] = [];
  if (!boiler) {
    const w = num(p.w, 100), h = num(p.h, 60), column = str(p.style, "panel") === "column", c = col(p.color, column ? r.pick(["#C9CCCF", "#E8DFC8", "#D9D2C2"]) : "#F1EFEA");
    for (let i = 0; i < n; i++) out.push(...radiator((i - (n - 1) / 2) * (w + 40), w, h, column, c));
    return { flats: [{ group: { shapes: out, edge: 0.6 }, ppcm: 2.4, id: "heater", ...(held ? {} : { shadow: "drop" as const }) }] };
  }
  const faultState = str(p.faultState, ""), say = str(p.display, "E-01"), blink = !held && (p.blink === undefined ? /^E/.test(say) : !!p.blink);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 70, pipes = [["#B87333", "#D9534A"], [STEEL, ""], ["#E0B23A", "#E0B23A"], [STEEL, "#4F6E9E"], ["#B87333", ""]];
    pipes.forEach(([pc, lv], k) => { const px = x - 14 + k * 7; out.push(S(rect(px - 1.6, -27, 3.2, 27), pc)); if (lv) out.push(S(rrect(px - 2.6, -15, 5.2, 6, 1), BRASS), S(rrect(px - 1, -14, 9, 2.4, 1.2), lv)); });
    out.push(S(rrect(x - 21, -98, 42, 72, 3), "#F4F2EE"), S(rect(x + 15, -98, 6, 72), tone("#F4F2EE", "shade"), { flat: true, opacity: 0.5 }), lines([0, 1, 2, 3].map(k => [x - 12, -94 + k * 2, x + 12, -94 + k * 2]), "#B9BDC0", 0.7, 0.7));
    out.push(S(rrect(x - 8, -88, 16, 3, 1), "#C3C9CE", { flat: true }), S(ellipse(x, -66, 6), "#9AA0A6"), S(ellipse(x, -66, 5), "#FBF7EE"), P([[x + 1, -66, 0], [x + 4.5, -63, 0], [x + 0.8, -67, 0]], "#2B2420", { flat: true }), { path: smooth([[x + 2.5, -70], [x + 4, -67], [x + 4, -64]], false), stroke: { color: "#D9534A", width: 0.9 }, flat: true });
    out.push(S(rrect(x - 19, -48, 38, 19, 2), "#DCDCD8"), S(rrect(x - 8, -45, 16, 9, 1), "#1F3A36"));
    for (const d of [-1, 1]) out.push(S(ellipse(x + d * 13.5, -38.5, 3.2), "#B8BEC4"), L([[x + d * 13.5, -38.5], [x + d * 13.5 + 1.5, -41]], "#5B6067", 0.7, 1));
    out.push(P([[x - 2, -31, 0], [x + 2, -31, 0], [x + 1.6, -33.5], [x, -35.5, 0], [x - 1.6, -33.5]], "#E0A83A", { flat: true, opacity: 0.3 }));
    const lcd = S(rect(x - 7, -44, 14, 7), "#86E0CF", { flat: true }), t: TextSpec = { text: say, x: x - 7, y: -44, w: 14, h: 7, size: 4.6, font: "screen", weight: 700, color: "#10302A", lit: 0 };
    if (blink) flats.push({ group: { shapes: [lcd], edge: 0 }, emissive: { shapes: [lcd], edge: 0 }, z: 0.3, ppcm: 4, lit: 0, move: { blink: { ms: 1100, on: 0.55 } }, ...(say ? { text: [t] } : {}) });
    else { out.push(lcd); glow.push(lcd); if (say) text.push(t); }
    // in its fault state, the error code blinks over the display
    if (faultState && !held) flats.push({ group: { shapes: [lcd], edge: 0 }, emissive: { shapes: [lcd], edge: 0 }, z: 0.35, ppcm: 4, lit: 0, move: { blink: { ms: 1100, on: 0.55 } }, when: { state: [faultState] }, text: [{ ...t, text: str(p.fault, "E-01") }] });
  }
  return { flats: [{ group: { shapes: out, edge: 0.5 }, ppcm: held ? 4 : 3, id: "heater", ...(held ? {} : { shadow: "drop" as const }), ...(glow.length ? { emissive: { shapes: glow, edge: 0 } } : {}), ...(text.length ? { text } : {}) }, ...flats] };
}, variants: { radiator: { kind: "radiator" }, boiler: { kind: "boiler" } },
  meta: {
    about: "A heater: a panel or cast-iron radiator under a window, or the wall-hung kombi boiler with its lit display.",
    params: {
      kind: { type: "enum", values: ["radiator", "boiler"], default: "radiator" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "side by side" },
      w: { type: "num", default: 100, about: "a radiator's width, cm" },
      h: { type: "num", default: 60, about: "a radiator's height, cm" },
      style: { type: "enum", values: ["panel", "column"], default: "panel", about: "a radiator's steel panel or cast-iron sections" },
      color: { type: "color", about: "a radiator's colour; default white, or seeded for column" },
      display: { type: "text", default: "E-01", about: "a boiler's display" },
      blink: { type: "bool", about: "the display blinks; default when it shows an error code" },
      faultState: { type: "text", about: "a place state in which the boiler has failed: its fault code blinks over the display" },
      fault: { type: "text", default: "E-01", about: "the fault code shown in faultState" },
    },
    terms: ["b1-w-kombi"],
  } };

/** The family's set pieces and props (`index.ts`). */
// a door (or a row of them) is a leaf: solid but to its own door mark's entrances and exits (DESIGN.md §7)
door.solid = p => {
  const kind = Object.hasOwn(DOOR, str(p.kind, "flat")) ? str(p.kind, "flat") : "flat", w = num(p.w, DOOR[kind].w), n = cl(Math.round(num(p.n, 1)), 1, 6), gap = num(p.gap, w + 130);
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap).flatMap(dx => solidLine(dx - w / 2, dx + w / 2, [], true));
};

// a corridor's back wall: its cut doorways are ways through
corridor.solid = p => { const w = num(p.w, 1000); return solidLine(-w / 2, w / 2, corridorDoors(p, w).filter(d => d.cut).map(d => [d.x - CUT.w / 2, d.x + CUT.w / 2])); };

export const set: Record<string, PieceDef> = { door, stairwell, corridor, balcony, water_tank: waterTank, ladder, chimney, heater };
export const props: Record<string, PieceDef> = { door, balcony, heater };
