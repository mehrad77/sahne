// Set pieces of the houses family (STYLE.md): a town house in seven European kinds, a café terrace, a cobbled
// pavement laid flat, and a canal with its quay. Units cm; each flat's origin is its bottom centre, up is −y in the
// art. Words (a house number, a café's name) are `text` on a flat with their `lang`, never drawn into the art.
// Lit windows come on by turns (`litByTurns`).

import { arcPoints, ellipse, poly, rect, rrect, smooth, tone, type FlatSpec, type Path, type PieceDef, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, glowOnly, litByTurns, solidLine } from "./draw.ts";

// ---- bits --------------------------------------------------------------------------------------------

const R = (x: number, y: number, w: number, h: number, c: string, o: Partial<Shape> = {}): Shape => S(rect(x, y, w, h), c, o);
/** Printed on the paper (no rim, no shadow) at an opacity. */
const pr = (opacity = 1): Partial<Shape> => ({ flat: true, opacity });
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Rectangles [x, y, w, h] as one path (bars, slats, joints): one fill for them all. */
const many = (rs: number[][]): Path => { const o = rect(rs[0][0], rs[0][1], rs[0][2], rs[0][3]); for (const q of rs.slice(1)) o.add(rect(q[0], q[1], q[2], q[3])); return o; };
/** A running bond printed over a wall: bricks, stone blocks. */
const bond = (c: string, w: number, h: number, op = 0.8, j = 1.3): Partial<Shape> => ({ tile: { w, h: 2 * h, shapes: [R(0, 0, w, j, c, pr(op)), R(0, h, w, j, c, pr(op)), R(0, 0, j, h, c, pr(op)), R(w / 2, h, j, h, c, pr(op))] } });
/** Vertical boards or horizontal clapboard printed over a wall. */
const boards = (c: string, w: number, h: number, op = 0.5, across = false): Partial<Shape> => ({ tile: { w, h, shapes: [across ? R(0, h - 2, w, 2, c, pr(op)) : R(0, 0, 1.8, h, c, pr(op))] } });
/** A shape filled with a printed tile over its base colour (a tile replaces the fill, so the colour is its own shape under). */
const T = (path: Path, c: string, t: Partial<Shape>): Shape[] => [S(path, c), { path, flat: true, ...t }];
/** A straight run of strand through points. */
const line = (pts: Vec2[], c: string, width: number): Shape => ({ path: poly(pts, false), stroke: { color: c, width, cap: "round", join: "round" } });
/** A window opening, `arch`ed (a round head) or square. */
const opening = (x: number, y: number, w: number, h: number, arch: boolean): Path => arch ? poly([[x, y + h], [x + w, y + h], ...arcPoints(x + w / 2, y + w / 2, w / 2, w / 2, 0, -Math.PI, 12)]) : rect(x, y, w, h);
/** Small triangles (railing spears, pinnacles) in one path. */
const tips = (xs: number[], y: number, w = 7, h = 10): Path => { const o = poly([[xs[0] - w / 2, y], [xs[0] + w / 2, y], [xs[0], y - h]]); for (const x of xs.slice(1)) o.add(poly([[x - w / 2, y], [x + w / 2, y], [x, y - h]])); return o; };
/** A cut strand: a rod, a rope. */
const rod = (pts: Vec2[], c: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width, cap: "round", join: "round" }, ...o });
const span = (a: number, b: number, d: number) => { const o: number[] = []; for (let x = a; x <= b + 0.01; x += d) o.push(x); return o; };

const GLASS = "#4F6175", WARM = "#FFD27A", IRON = "#2F3237", WHITE = "#F4F1EA", STONE = "#CFC6B4", WOODD = "#5A3A22", PAINT = "#2D6AA3";
const GREENS = ["#4E7A48", "#5E8F52", "#3F6B3E", "#6E9E5C"], DRAPES = ["#C4553A", "#E9D8B4", "#7A3E6E", "#2F8C88", "#D9B98C", "#8DB8DA"];

// ---- a house -------------------------------------------------------------------------------------------

interface Cx {
  r: Rng; W: number; bay: number; pad: number; bays: number; F: number; gh: number; fh: number; door: number;
  wall: string; roof: string; shut: boolean; flowers: boolean; share: number; gable: string; acc: string; number: string;
  main: Shape[]; fr: Shape[]; gl: Shape[]; tx: TextSpec[]; ov: number;
  /** The y of the floor f's bottom (0 the ground), negative up. */
  yb(f: number): number;
  /** A bay's centre x. */
  bx(i: number): number;
}

interface Wo { arch?: boolean; bars?: [number, number]; frame?: string; sill?: string; shut?: string; box?: boolean }
/** A glazed window `w` × `h` with its top-left at (x, y): frame, glass, now and then a curtain, glints, bars, a sill, shutters, a flower box; its glass lights at night by chance. */
function win(c: Cx, x: number, y: number, w: number, h: number, o: Wo = {}) {
  const arch = !!o.arch, fm = o.frame ?? WHITE, g = opening(x, y, w, h, arch), k = c.r.int(0, 4), dr = c.r.pick(DRAPES), lit = c.r.chance(c.share);
  c.main.push(S(opening(x - 4, y - 4, w + 8, h + 8, arch), fm), S(g, GLASS), R(x, y, w, h * 0.16, "#1F2832", { ...pr(0.35), clip: g }));
  if (k === 1) c.main.push(R(x, y + h * 0.4, w, h, WHITE, { ...pr(0.5), clip: g }));
  else if (k === 2) c.main.push(R(x, y, w * 0.26, h, dr, { ...pr(0.9), clip: g }), R(x + w * 0.74, y, w * 0.26, h, dr, { ...pr(0.9), clip: g }));
  c.main.push(L([[x + w * 0.2, y + h * 0.8], [x + w * 0.62, y + h * 0.22]], "#FFFFFF", Math.max(3, w * 0.07), 0.13));
  const [cols, rows] = o.bars ?? [2, 2], bs: number[][] = [];
  for (let i = 1; i < cols; i++) bs.push([x + w * i / cols - 1.5, y, 3, h]);
  for (let j = 1; j < rows; j++) bs.push([x, y + h * j / rows - 1.5, w, 3]);
  if (bs.length) c.main.push(S(many(bs), fm));
  if (o.sill) c.main.push(R(x - 8, y + h + 4, w + 16, 7, o.sill), R(x - 8, y + h + 4, w + 16, 2, "#FFFFFF", pr(0.35)));
  if (lit) c.gl.push(S(g, WARM, pr()));
  if (o.shut) shutters(c, x, y, w, h, o.shut);
  if (o.box) flowerBox(c, x - 6, y + h + 14, w + 12);
}

/** Louvred shutters folded back each side of a window. */
function shutters(c: Cx, x: number, y: number, w: number, h: number, col: string) {
  const sw = Math.max(8, Math.min(w / 2 - 2, (c.bay - w) / 2 - 9)), lv = { tile: { w: 20, h: 7, shapes: [R(0, 4.5, 20, 2.2, tone(col, "deep"), pr(0.55))] } };
  for (const sx of [x - sw - 7, x + w + 7]) c.fr.push(R(sx, y - 2, sw, h + 4, col), ...T(rect(sx + 3, y + 4, sw - 6, h - 8), col, lv), R(sx + sw - 3, y - 2, 3, h + 4, tone(col, "shade"), pr(0.5)));
}

/** A window box whose bottom is at y: leaves, and geraniums or mixed flowers. */
function flowerBox(c: Cx, x: number, y: number, w: number) {
  const r = c.r, fl = r.pick([["#D9343A", "#E8506A", "#C22A3A", "#EE8AA0"], ["#F4F1EA", "#F2B705", "#8A6AB0", "#E8506A"]]);
  c.fr.push(R(x, y - 12, w, 12, r.pick(["#B8562F", "#4E6B4A", "#E9E4D8"])));
  for (let i = 0; i < w / 9; i++) c.fr.push(S(ellipse(x + 4 + i * 9 + r.range(-2, 2), y - 17 - r.range(0, 6), r.range(6, 9), r.range(4, 6)), r.pick(GREENS)));
  for (let i = 0; i < w / 13; i++) { const fx = x + 6 + i * 13 + r.range(-3, 3), fy = y - 24 - r.range(0, 8), fc = r.pick(fl); for (let j = 0; j < 3; j++) c.fr.push(S(ellipse(fx + Math.cos(j * 2.1) * 3.2, fy + Math.sin(j * 2.1) * 2.8, 2.8), fc)); }
}

/** An iron balcony from x0 to x1 whose slab is at y: its rails and balusters `h` high. */
function balcony(c: Cx, x0: number, x1: number, y: number, h = 90, col = IRON) {
  const bal = span(x0 + 4, x1 - 2, 10).map(x => [x, y - h, 2.2, h]);
  c.fr.push(R(x0 - 8, y, x1 - x0 + 16, 9, STONE), R(x0 - 8, y, x1 - x0 + 16, 2.2, "#FFFFFF", pr(0.35)), S(many(bal), col), R(x0, y - h, x1 - x0, 4.5, col), R(x0, y - 9, x1 - x0, 3.5, col), R(x0, y - h * 0.5, x1 - x0, 2.2, col));
}

/** A small enamel plate with the house number as words. */
function plate(c: Cx, x: number, y: number, bg = "#2B4B8C", ink = "#FFFFFF") {
  if (!c.number.trim()) return;
  c.main.push(S(rrect(x, y, 34, 24, 3), bg));
  c.tx.push({ text: c.number.trim(), x: x + 2, y: y + 2, w: 30, h: 20, font: "print", color: ink, weight: 700, align: "center" });
}

/** Chimney stacks standing on a roof line: x centres, the stack's foot y and height. */
function stacks(c: Cx, xs: number[], y: number, h: number, col: string, cap: string) {
  for (const x of xs) c.main.push(R(x - 28, y - h, 56, h + 24, col), R(x - 33, y - h - 10, 66, 12, cap), ...[-17, 0, 17].map(d => S(rrect(x + d - 5.5, y - h - 36, 11, 28, 2), "#B8562F")));
}

// ---- the kinds: each draws its front from the ground up and says how tall it stands ------------------------

/** Paris: cream limestone, a rusticated ground floor with arched openings, long iron balconies, a zinc mansard with dormers. */
function haussmann(c: Cx): number {
  const { W } = c, x0 = -W / 2, H = -c.yb(c.F), trim = tone(c.wall, "light"), dk = tone(c.wall, "shade"), door = Math.min(c.door, c.bays - 1);
  c.main.push(R(x0, -H, W, H, c.wall), R(x0 + W - 14, -H, 14, H, dk, pr(0.18)), S(many(span(55, c.gh - 10, 55).map(y => [x0, -y, W, 1.8])), dk, pr(0.35)));
  for (let f = 1; f <= c.F; f++) c.main.push(R(x0 - 6, c.yb(f) - (f === 1 || f === c.F ? 14 : 5), W + 12, f === 1 || f === c.F ? 18 : 8, trim));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) {
      c.main.push(S(opening(bx - 78, -292, 156, 292, true), trim), S(opening(bx - 66, -280, 132, 280, true), "#2E4A3E"), S(opening(bx - 52, -266, 104, 130, true), GLASS), S(many([[bx - 1.5, -266, 3, 130], [bx - 52, -200, 104, 3]]), IRON));
      c.main.push(R(bx - 52, -118, 48, 92, tone("#2E4A3E", "shade"), pr(0.6)), R(bx + 4, -118, 48, 92, tone("#2E4A3E", "shade"), pr(0.6)), S(ellipse(bx - 10, -70, 3), "#D9A72E"), S(ellipse(bx + 10, -70, 3), "#D9A72E"));
      c.gl.push(S(opening(bx - 52, -266, 104, 130, true), WARM, pr(0.7)));
      plate(c, bx + 88, -190);
    } else win(c, bx - 50, -250, 100, 180, { arch: true, bars: [2, 3], frame: trim });
    for (let f = 1; f < c.F; f++) {
      const yt = c.yb(f) - 14 - 215;
      win(c, bx - 52, yt, 104, 215, { bars: [2, 4], frame: WHITE, shut: c.shut ? c.acc : undefined });
      if (f === 1) c.fr.push(S(poly([[bx - 62, yt - 6], [bx + 62, yt - 6], [bx, yt - 36]]), trim));
      if (f > 1 && f < c.F - 1) balcony(c, bx - 60, bx + 60, c.yb(f) - 8, 56);
    }
  }
  for (const f of [1, c.F - 1]) if (f >= 1) balcony(c, x0 + 14, x0 + W - 14, c.yb(f) - 8, 92);
  const rh = 230, ins = 78;
  stacks(c, [-W * 0.28, W * 0.28], -H - rh, 70, "#D9CDB4", trim);
  const rf = poly([[x0 - 6, -H], [-x0 + 6, -H], [-x0 - ins, -H - rh], [x0 + ins, -H - rh]]);
  c.main.push(...T(rf, c.roof, { tile: { w: 18, h: 14, shapes: [R(0, 12.5, 18, 1.5, tone(c.roof, "deep"), pr(0.45)), R(8.5, 0, 1.2, 12.5, tone(c.roof, "deep"), pr(0.3))] } }), R(x0 + ins - 4, -H - rh - 6, W - 2 * ins + 8, 10, tone(c.roof, "light")));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i), top = -H - 40 - 90;
    c.main.push(R(bx - 44, top - 12, 88, 118, trim), S(poly([[bx - 50, top - 12], [bx + 50, top - 12], [bx, top - 48]]), tone(c.roof, "light")));
    win(c, bx - 30, top, 60, 90, { frame: WHITE });
  }
  return H + rh + 80;
}

/** Amsterdam: dark brick, white sash windows shrinking up the front, a stoop, and a bell, stepped or steep gable with a hoist. */
function canalHouse(c: Cx): number {
  const { W, r } = c, x0 = -W / 2, H = -c.yb(c.F), trim = "#EFE8D8", door = Math.min(c.door, c.bays - 1), gh = c.gable === "stepped" ? 210 : c.gable === "steep" ? 190 : 270;
  c.main.push(...T(rect(x0, -H, W, H), c.wall, bond(tone(c.wall, "deep"), 15, 5.5, 0.35)));
  for (let i = 0; i < 7; i++) c.main.push(R(x0 + r.range(0, W - 60), -r.range(30, H - 60), r.range(40, 90), r.range(30, 60), r.pick([tone(c.wall, "light"), tone(c.wall, "shade")]), pr(0.12)));
  for (let f = 1; f <= c.F; f++) c.main.push(R(x0 - 3, c.yb(f) - 4, W + 6, 6, trim));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) {
      c.main.push(S(opening(bx - 54, -272, 108, 248, true), trim), S(opening(bx - 46, -264, 92, 240, true), "#2F5D4A"), S(opening(bx - 38, -256, 76, 70, true), GLASS), S(many([[bx - 1.5, -256, 3, 70]]), trim), R(bx - 36, -176, 72, 120, tone("#2F5D4A", "shade"), pr(0.6)), S(ellipse(bx + 28, -100, 3.4), "#D9A72E"));
      c.gl.push(S(opening(bx - 38, -256, 76, 70, true), WARM, pr(0.7)));
      c.fr.push(R(bx - 66, -12, 132, 12, STONE), R(bx - 56, -24, 112, 12, STONE), R(bx - 56, -24, 112, 2.5, "#FFFFFF", pr(0.35)));
      plate(c, bx + 58, -130, "#F4F1EA", INKC);
    } else win(c, bx - 45, -80 - 190, 90, 190, { bars: [2, 5], sill: trim });
    for (let f = 1; f < c.F; f++) {
      const h = Math.max(120, 205 - 24 * (f - 1)), yt = c.yb(f) - 60 - h;
      c.main.push(R(bx - 56, yt - 18, 112, 10, tone(c.wall, "light"), pr(0.9)));
      win(c, bx - 45, yt, 90, h, { bars: [2, h > 170 ? 5 : 4], sill: trim, shut: c.shut ? c.acc : undefined });
    }
  }
  const hw = W / 2 + 3, top = -H, pts: (Vec2 | [number, number, number])[] = [];
  if (c.gable === "stepped") {
    const N = 4, s = gh / N, dx = (hw - 26) / N, L2: Vec2[] = [];
    for (let k = 0; k < N; k++) L2.push([-(hw - k * dx), top - k * s], [-(hw - k * dx), top - (k + 1) * s]);
    L2.push([-26, top - N * s]);
    pts.push(...L2, ...[...L2].reverse().map(([x, y]) => [-x, y] as Vec2));
  } else if (c.gable === "steep") pts.push([-hw, top], [0, top - gh], [hw, top]);
  else {
    const half: Vec2[] = [[1, 0.08], [0.94, 0.16], [0.74, 0.24], [0.5, 0.3], [0.37, 0.38], [0.3, 0.5], [0.3, 0.62], [0.34, 0.72], [0.28, 0.84], [0.15, 0.94]].map(([a, b]) => [-a * hw, top - b * gh]);
    pts.push([-hw, top, 0], ...half, [0, top - gh], ...half.map(([x, y]) => [-x, y] as Vec2).reverse(), [hw, top, 0]);
  }
  const outline = c.gable === "bell" ? smooth(pts as Vec2[], true, 1) : poly(pts as Vec2[]);
  c.main.push(...T(outline, c.wall, bond(tone(c.wall, "deep"), 15, 5.5, 0.35)), { path: outline, stroke: { color: trim, width: 7, join: "round" } });
  win(c, -24, top - gh * 0.42, 48, 80, { frame: trim, bars: [2, 3] });
  c.main.push(S(ellipse(0, top - gh + 18, 7), IRON), rod([[0, top - gh + 22], [3, top - gh + 80]], "#6B5A44", 1.2), rod([[3, top - gh + 80], [3, top - gh + 90], [-3, top - gh + 94]], IRON, 1.6));
  return H + gh + 20;
}
const INKC = "#2B2420";

/** London: yellow-stock brick over a stucco ground floor, a portico with a fanlight, sash windows, area railings, chimney stacks. */
function terrace(c: Cx): number {
  const { W } = c, x0 = -W / 2, H = -c.yb(c.F), stucco = "#EFE9DA", door = Math.min(c.door, c.bays - 1);
  stacks(c, [x0 + 30, -x0 - 30], -H - 76, 90, tone(c.wall, "shade"), "#C9BFA8");
  c.main.push(S(poly([[x0 + 8, -H - 14], [-x0 - 8, -H - 14], [-x0 - 56, -H - 82], [x0 + 56, -H - 82]]), c.roof));
  c.main.push(...T(rect(x0, -H, W, H), c.wall, bond(tone(c.wall, "deep"), 12, 5, 0.35)), R(x0, -c.gh, W, c.gh, stucco), S(many(span(48, c.gh - 10, 48).map(y => [x0, -y, W, 1.6])), tone(stucco, "deep"), pr(0.28)), R(x0, -c.gh - 5, W, 7, WHITE), R(x0 - 4, -H - 14, W + 8, 14, "#E6DFCE"));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) {
      const fan = opening(bx - 30, -262, 60, 44, true);
      c.main.push(R(bx - 76, -282, 152, 20, WHITE), R(bx - 82, -290, 164, 9, WHITE), R(bx - 70, -262, 14, 262, WHITE), R(bx + 56, -262, 14, 262, WHITE), S(opening(bx - 38, -272, 76, 252, true), WHITE), S(fan, GLASS), R(bx - 30, -220, 60, 188, "#22262B"));
      c.main.push(S(many([[bx - 1, -262, 2, 44], [bx - 30, -226, 60, 2]]), WHITE), R(bx - 24, -210, 22, 74, tone("#22262B", "light"), pr(0.5)), R(bx + 2, -210, 22, 74, tone("#22262B", "light"), pr(0.5)), R(bx - 24, -120, 22, 74, tone("#22262B", "light"), pr(0.5)), R(bx + 2, -120, 22, 74, tone("#22262B", "light"), pr(0.5)), S(ellipse(bx, -150, 3, 5), "#D9A72E"), R(bx - 9, -105, 18, 5, "#D9A72E"));
      c.gl.push(S(fan, WARM, pr(0.75)));
      if (c.number.trim()) c.tx.push({ text: c.number.trim(), x: bx - 14, y: -256, w: 28, h: 24, font: "print", color: "#FFFFFF", weight: 700, align: "center" });
      c.fr.push(R(bx - 54, -10, 108, 10, STONE), R(bx - 46, -20, 92, 10, STONE), R(bx - 40, -30, 80, 10, STONE));
    } else win(c, bx - 41, -70 - 150, 82, 150, { bars: [2, 6], sill: WHITE });
    for (let f = 1; f < c.F; f++) {
      const h = f === 1 ? 190 : f === 2 ? 160 : 130, yt = c.yb(f) - 40 - h;
      c.main.push(R(bx - 47, yt - 16, 94, 12, tone(c.wall, "light")));
      win(c, bx - 41, yt, 82, h, { bars: [2, 6], sill: WHITE, shut: c.shut ? c.acc : undefined });
      if (f === 1) balcony(c, bx - 46, bx + 46, c.yb(1) - 42, 52);
    }
  }
  const dx = c.bx(door), post = span(x0 + 8, -x0 - 8, 12).filter(x => Math.abs(x - dx) > 60);
  c.fr.push(S(many(post.map(x => [x, -80, 2.4, 80])), IRON), S(tips(post, -80), IRON), R(x0, -80, dx - 60 - x0, 4, IRON), R(dx + 60, -80, -x0 - dx - 60, 4, IRON), R(x0, -12, W, 4, IRON));
  return H + 110;
}

/** The Mediterranean: whitewash, small shuttered windows in a painted blue (or green, or terracotta), pots and a bougainvillea, a flat roof. */
function whitewash(c: Cx): number {
  const { W, r } = c, x0 = -W / 2, H = -c.yb(c.F), door = Math.min(c.door, c.bays - 1);
  c.main.push(S(rrect(x0, -H, W, H, [10, 10, 0, 0]), c.wall), R(x0 + W - 16, -H + 10, 16, H - 10, tone(c.wall, "shade"), pr(0.16)), R(x0 - 3, -H - 12, W + 6, 12, tone(c.wall, "light")), R(x0, -H + 4, W, 2, tone(c.wall, "shade"), pr(0.3)));
  c.main.push(R(x0 + W * 0.66, -H - 46, 40, 46, c.wall), R(x0 + W * 0.66 - 4, -H - 52, 48, 8, tone(c.wall, "light")));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) {
      c.main.push(S(opening(bx - 46, -200, 92, 200, true), c.acc), S(many(span(bx - 38, bx + 36, 15).map(x => [x, -190, 1.6, 190])), tone(c.acc, "deep"), pr(0.5)), S(ellipse(bx + 32, -95, 3.4), "#D9A72E"));
      c.fr.push(R(bx - 60, -8, 120, 8, STONE), S(opening(bx - 46, -200, 92, 200, true), tone(c.wall, "shade"), { ...pr(0.2) }));
      for (const d of [-1, 1]) { const px = bx + d * 78; c.fr.push(P([[px - 14, -34, 0], [px + 14, -34, 0], [px + 10, 0, 0], [px - 10, 0, 0]], "#C0653A"), S(ellipse(px, -42, 15, 11), r.pick(GREENS)), ...[-6, 4, 9].map(dx => S(ellipse(px + dx, -48 - (dx % 3), 3.6), "#D9343A"))); }
      c.gl.push(S(ellipse(bx + 70, -190, 7), WARM, pr(0.9)));
      c.fr.push(R(bx + 66, -186, 8, 22, IRON));
    } else win(c, bx - 29, -110 - 92, 58, 92, { frame: tone(c.wall, "shade"), shut: c.shut ? c.acc : undefined, box: c.flowers, arch: r.chance(0.3) });
    for (let f = 1; f < c.F; f++) win(c, bx - 30, c.yb(f) - 70 - 100, 60, 100, { frame: tone(c.wall, "shade"), shut: c.shut ? c.acc : undefined, box: c.flowers && f === 1, arch: r.chance(0.3) });
  }
  const side = r.chance(0.5) ? -1 : 1, cx = side * (W / 2 - 22);
  for (let k = 0; k < 22; k++) { const y = -H + 4 + k * H * 0.025, x = cx + r.range(-26, 26); c.fr.push(S(ellipse(x, y, r.range(12, 22), r.range(10, 16)), r.pick(GREENS))); }
  for (let k = 0; k < 46; k++) c.fr.push(S(ellipse(cx + r.range(-34, 34), -H + r.range(0, H * 0.55), r.range(3.4, 6)), r.pick(["#C2185B", "#D63384", "#E04F9A", "#A81250"])));
  return H + 60;
}

/** The Alps: a stone base, plain plaster, dark timber above under a wide low gable, a carved wooden balcony with window boxes. */
function chalet(c: Cx): number {
  const { W, r } = c, x0 = -W / 2, H = -c.yb(c.F), tim = c.wall, dk = tone(tim, "deep"), door = Math.min(c.door, c.bays - 1), rh = 150, ov = 100, slope = rh / (W / 2);
  c.main.push(R(x0, -c.gh, W, c.gh, "#EDE6D3"), ...T(rect(x0, -H, W, H - c.gh), tim, boards(dk, 16, 40, 0.4)), ...T(rect(x0, -62, W, 62), "#8C8578", bond("#5E584E", 34, 14, 0.6)), R(x0 + W - 14, -c.gh, 14, c.gh, "#B5AB96", pr(0.25)));
  c.main.push(R(x0 - 8, c.yb(1) - 16, W + 16, 18, dk), R(x0, -H, W, 6, dk, pr(0.6)));
  const gp = poly([[x0, -H], [0, -H - rh], [-x0, -H]]);
  c.main.push(...T(gp, tim, boards(dk, 16, 40, 0.4)));
  for (const y of [0.22, 0.45, 0.68]) { const hw = (W / 2) * (1 - y); c.main.push(R(-hw - 18, -H - rh * y, 24, 7, dk), R(hw - 6, -H - rh * y, 24, 7, dk)); }
  const gwin = ellipse(0, -H - rh * 0.34, 20);
  c.main.push(S(ellipse(0, -H - rh * 0.34, 25), WHITE), S(gwin, GLASS), S(many([[-1.5, -H - rh * 0.34 - 20, 3, 40], [-20, -H - rh * 0.34 - 1.5, 40, 3]]), WHITE));
  if (r.chance(c.share)) c.gl.push(S(gwin, WARM, pr()));
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) { c.main.push(S(opening(bx - 46, -196, 92, 196, true), WHITE), S(opening(bx - 38, -188, 76, 188, true), WOODD), S(many(span(bx - 30, bx + 28, 14).map(x => [x, -184, 1.8, 184])), tone(WOODD, "deep"), pr(0.5)), S(ellipse(bx + 28, -95, 3.4), "#D9A72E")); c.fr.push(R(bx - 52, -8, 104, 8, STONE)); }
    else win(c, bx - 30, -105 - 85, 60, 85, { arch: false, frame: WHITE, sill: WHITE, shut: c.shut ? c.acc : undefined });
    for (let f = 1; f < c.F; f++) win(c, bx - 35, c.yb(f) - 58 - 105, 70, 105, { frame: "#E9DFC8", shut: c.shut ? c.acc : undefined });
  }
  const by = c.yb(1) - 16, slats = span(x0 - 20, -x0 + 20, 13).map(x => [x, by - 92, 6, 92]);
  c.fr.push(R(x0 - 30, by, W + 60, 14, dk), R(x0 - 30, by, W + 60, 2.5, "#FFFFFF", pr(0.25)), S(many(slats), tone(tim, "light")), R(x0 - 26, by - 98, W + 52, 8, dk), R(x0 - 26, by - 30, W + 52, 5, dk), S(many(slats.map(([x, y]) => [x + 1.5, y + 22, 3, 28])), tone(tim, "deep"), pr(0.8)));
  if (c.flowers) for (let i = 0; i < c.bays; i++) flowerBox(c, c.bx(i) - 70, by - 82, 140);
  const e1: Vec2 = [x0 - ov, -H + ov * slope], e2: Vec2 = [-x0 + ov, -H + ov * slope];
  c.main.push(line([e1, [0, -H - rh], e2], c.roof, 22), line([[e1[0] + 3, e1[1] + 12], [0, -H - rh + 12], [e2[0] - 3, e2[1] + 12]], tone(tim, "light"), 6));
  for (const s of [-1, 1]) c.main.push(rod([[s * (W / 2 + 4), -H + 8], [s * (W / 2 + ov * 0.7), -H + ov * 0.7 * slope + 6]], dk, 7));
  return H + rh + 20;
}

/** Scandinavia: clapboard in falu red (or any paint), white corner boards and frames, a small porch, a gable with its attic window. */
function paintedWood(c: Cx): number {
  const { W, r } = c, x0 = -W / 2, H = -c.yb(c.F), board = "#F1ECE0", door = Math.min(c.door, c.bays - 1), rh = W * 0.36, slope = rh / (W / 2);
  const cx = W * 0.2, ys = -H - rh * (1 - cx / (W / 2));
  c.main.push(...T(rect(cx - 14, ys - 62, 28, 82), "#7A3B2E", bond("#4A2018", 10, 4, 0.5)), R(cx - 18, ys - 68, 36, 8, "#3B3B3F"));
  c.main.push(...T(rect(x0, -H, W, H), c.wall, boards(tone(c.wall, "deep"), 40, 18, 0.3, true)), R(x0, -28, W, 28, "#5E5A55"), R(x0, c.yb(1) - 5, W, 8, board));
  const gp = poly([[x0, -H], [0, -H - rh], [-x0, -H]]);
  c.main.push(...T(gp, c.wall, boards(tone(c.wall, "deep"), 40, 18, 0.3, true)), R(x0, -H, 14, H, board), R(-x0 - 14, -H, 14, H, board), R(x0, -H - 4, W, 8, board));
  const e1: Vec2 = [x0 - 22, -H + 22 * slope], e2: Vec2 = [-x0 + 22, -H + 22 * slope];
  c.main.push(line([e1, [0, -H - rh], e2], c.roof, 20), line([[e1[0] + 2, e1[1] + 11], [0, -H - rh + 11], [e2[0] - 2, e2[1] + 11]], board, 6));
  win(c, -20, -H - rh * 0.4, 40, 48, { frame: board, bars: [2, 2], arch: true });
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) {
      c.main.push(R(bx - 40, -192, 80, 192, board), R(bx - 33, -184, 66, 184, "#F7F3EA"), R(bx - 27, -178, 54, 80, GLASS), S(many([[bx - 1.5, -178, 3, 80], [bx - 27, -140, 54, 3]]), board), R(bx - 27, -88, 54, 80, tone("#F7F3EA", "shade"), pr(0.7)), S(ellipse(bx + 22, -90, 3), "#D9A72E"));
      c.gl.push(S(rect(bx - 27, -178, 54, 80), WARM, pr(0.7)));
      c.fr.push(R(bx - 54, -12, 108, 12, STONE), R(bx - 46, -24, 92, 12, STONE), R(bx - 62, -218, 6, 194, board), R(bx + 56, -218, 6, 194, board), S(poly([[bx - 74, -214], [bx + 74, -214], [bx, -254]]), c.roof), line([[bx - 74, -214], [bx, -254], [bx + 74, -214]], board, 4));
      c.gl.push(S(ellipse(bx + 80, -150, 6), WARM, pr(0.9)));
      plate(c, bx - 80, -170, "#FFFFFF", "#2B2420");
    } else win(c, bx - 33, -100 - 118, 66, 118, { frame: board, sill: board, bars: [2, 3], box: c.flowers, shut: c.shut ? c.acc : undefined });
    for (let f = 1; f < c.F; f++) win(c, bx - 33, c.yb(f) - 56 - 118, 66, 118, { frame: board, sill: board, bars: [2, 3], shut: c.shut ? c.acc : undefined });
  }
  void r;
  return H + rh + 40;
}

/** Germany and Belgium: a stone ground floor, half-timbered floors that lean out over each other, shutters, and a steep (or stepped) gable. */
function gabledHouse(c: Cx): number {
  const { W } = c, x0 = -W / 2, H = -c.yb(c.F), tim = "#4A3325", ext = (f: number) => Math.min(f, 3) * 7, door = Math.min(c.door, c.bays - 1), top = -H, hw = W / 2 + ext(c.F - 1) + 3;
  const gh = c.gable === "stepped" ? 230 : hw * 1.5;
  c.main.push(...T(rect(x0, -c.gh, W, c.gh), "#B9B1A0", bond("#8E8676", 40, 18, 0.55)));
  for (let f = 1; f < c.F; f++) {
    const e = ext(f), yt = c.yb(f + 1), yb = c.yb(f), w = W + 2 * e, xl = -w / 2;
    c.main.push(R(xl, yt, w, yb - yt, c.wall), R(xl, yb - 16, w, 18, tim), R(xl, yt, w, 9, tim), R(xl + w - 12, yt, 12, yb - yt, tone(c.wall, "shade"), pr(0.2)));
    for (let j = 0; j <= c.bays; j++) { const xj = -W / 2 + c.pad + j * c.bay; c.main.push(R(xj - 5, yt, 10, yb - yt, tim)); }
    for (let i = 0; i < c.bays; i++) {
      const bx = c.bx(i), a = bx - c.bay / 2 + 5, b = bx + c.bay / 2 - 5;
      c.main.push(R(a, yb - 66, b - a, 7, tim), rod([[a, yb - 59], [b, yb - 16]], tim, 5), rod([[b, yb - 59], [a, yb - 16]], tim, 5));
      win(c, bx - 30, yb - 70 - 96, 60, 96, { frame: "#3A2A20", bars: [2, 3], shut: c.shut ? c.acc : undefined, box: c.flowers && f === 1 });
    }
    for (const s of [-1, 1]) c.fr.push(rod([[s * (w / 2 - 4), yb + 2], [s * (w / 2 - 4 - 6), yb + 16]], tim, 5));
  }
  for (let i = 0; i < c.bays; i++) {
    const bx = c.bx(i);
    if (i === door) { c.main.push(S(opening(bx - 56, -236, 112, 236, true), "#D8D0BE"), S(opening(bx - 46, -226, 92, 226, true), WOODD), S(many(span(bx - 40, bx + 38, 13).map(x => [x, -218, 1.8, 218])), tone(WOODD, "deep"), pr(0.5)), S(many([[bx - 46, -150, 92, 5], [bx - 46, -60, 92, 5]]), IRON), S(ellipse(bx + 32, -108, 3.6), "#D9A72E")); c.fr.push(R(bx - 62, -8, 124, 8, STONE)); }
    else win(c, bx - 28, -105 - 80, 56, 80, { frame: "#D8D0BE", bars: [2, 3], sill: "#D8D0BE", shut: c.shut ? c.acc : undefined });
  }
  plate(c, c.bx(door) - 100, -150, "#F4F1EA", INKC);
  let pts: Vec2[];
  if (c.gable === "stepped") {
    const N = 4, s = gh / N, dx = (hw - 24) / N, L2: Vec2[] = [];
    for (let k = 0; k < N; k++) L2.push([-(hw - k * dx), top - k * s], [-(hw - k * dx), top - (k + 1) * s]);
    L2.push([-24, top - N * s]);
    pts = [...L2, ...[...L2].reverse().map(([x, y]) => [-x, y] as Vec2)];
  } else pts = [[-hw, top], [0, top - gh], [hw, top]];
  const gp = poly(pts);
  c.main.push(S(gp, c.wall), { path: gp, stroke: { color: c.gable === "stepped" ? "#D8D0BE" : tim, width: c.gable === "stepped" ? 7 : 10, join: "round" } });
  if (c.gable === "steep") {
    c.main.push(R(-4, top - gh * 0.86, 8, gh * 0.86, tim), R(-hw * 0.55, top - gh * 0.3, hw * 1.1, 8, tim), rod([[-hw * 0.55, top - gh * 0.3], [-4, top - gh * 0.62]], tim, 5), rod([[hw * 0.55, top - gh * 0.3], [4, top - gh * 0.62]], tim, 5));
    const sl = gh / hw, o = 16, e1: Vec2 = [-hw - o, top + o * sl], e2: Vec2 = [hw + o, top + o * sl];
    c.main.push(line([e1, [0, top - gh], e2], c.roof, 26), S(ellipse(0, top - gh - 14, 8), tone(c.roof, "deep")));
  }
  win(c, -26, top - gh * 0.32 - 70, 52, 70, { frame: tim, bars: [2, 3], shut: c.shut ? c.acc : undefined });
  return H + gh + 30;
}

interface Kd { bay: number; bays: number; floors: number; maxFloors: number; pad: number; gap: number; gh: number; fh: number; wall: string; roof: string; accents: string[]; shut: boolean; flowers: boolean; gable?: string; ov?: number; draw(c: Cx): number }
const KINDS: Record<string, Kd> = {
  haussmann: { bay: 190, bays: 4, floors: 5, maxFloors: 7, pad: 50, gap: 0, gh: 340, fh: 300, wall: "#E8DFC9", roof: "#6F7782", accents: ["#7E8F9C", "#8A8F7C"], shut: false, flowers: false, draw: haussmann },
  canal_house: { bay: 125, bays: 3, floors: 4, maxFloors: 6, pad: 28, gap: 0, gh: 300, fh: 270, wall: "#A04D34", roof: "#4A4A50", accents: ["#2F5D4A", "#F4F1EA", "#9C3B2B"], shut: false, flowers: false, gable: "bell", draw: canalHouse },
  terrace: { bay: 120, bays: 2, floors: 4, maxFloors: 6, pad: 34, gap: 0, gh: 290, fh: 250, wall: "#B79E6A", roof: "#3F4650", accents: ["#2F3B36"], shut: false, flowers: false, draw: terrace },
  whitewash: { bay: 150, bays: 2, floors: 2, maxFloors: 4, pad: 40, gap: 30, gh: 290, fh: 260, wall: "#F5F1E7", roof: "#C0653A", accents: [PAINT, "#3A7D5D", "#C65D3B"], shut: true, flowers: true, draw: whitewash },
  chalet: { bay: 190, bays: 2, floors: 2, maxFloors: 3, pad: 60, gap: 130, gh: 270, fh: 245, wall: "#7B4A2C", roof: "#4A3B33", accents: ["#3F6B3E", "#9C3B2B"], shut: true, flowers: true, ov: 100, draw: chalet },
  painted_wood: { bay: 115, bays: 2, floors: 2, maxFloors: 3, pad: 36, gap: 50, gh: 245, fh: 235, wall: "#9D3A2B", roof: "#3A3D44", accents: ["#F1ECE0"], shut: false, flowers: false, ov: 24, draw: paintedWood },
  gabled: { bay: 120, bays: 3, floors: 4, maxFloors: 6, pad: 30, gap: 14, gh: 270, fh: 230, wall: "#E7D9B5", roof: "#B5482E", accents: ["#9C3B2B", "#3F6B3E"], shut: true, flowers: false, gable: "steep", draw: gabledHouse },
};
const KIND_IDS = Object.keys(KINDS);

/**
 * A town house's front, one of seven European kinds (`kind`): `haussmann` (Paris: limestone, iron balconies, a zinc mansard),
 * `canal_house` (Amsterdam: dark brick, white sashes, a bell, stepped or steep `gable` with a hoist), `terrace` (London: brick, a
 * portico with a fanlight, area railings, chimney stacks), `whitewash` (the Mediterranean: shutters, pots, bougainvillea), `chalet`
 * (the Alps: timber and a carved balcony under a low wide gable), `painted_wood` (Scandinavia: clapboard, white corners, a porch) and
 * `gabled` (Germany and Belgium: half-timber, a steep or stepped gable). `floors` counts the ground floor, `bays` the window columns;
 * `n` houses stand side by side, each its own (the place's `seed` fixes every choice). Its windows light by turns at night, `lit` of them.
 */
const townhouse: PieceDef = { draw(p, r) {
  const kind = Object.hasOwn(KINDS, str(p.kind, "")) ? str(p.kind, "") : "haussmann", k = KINDS[kind];
  const n = Math.round(cl(num(p.n, 1), 1, 6)), F = Math.round(cl(num(p.floors, k.floors), 1, k.maxFloors)), bays = Math.round(cl(num(p.bays, k.bays), 1, 8));
  const W = bays * k.bay + 2 * k.pad, gable = ["bell", "stepped", "steep"].includes(str(p.gable, "")) ? str(p.gable, "") : k.gable ?? "steep";
  const houses: { c: Cx; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    
    const c: Cx = {
      r, W, bay: k.bay, pad: k.pad, bays, F, gh: k.gh, fh: k.fh, door: Math.round(cl(num(p.door, kind === "canal_house" || kind === "terrace" ? (r.chance(0.5) ? 0 : bays - 1) : Math.floor((bays - 1) / 2)), 0, bays - 1)),
      wall: hex(p.color, k.wall), roof: hex(p.roof, k.roof), shut: typeof p.shutters === "boolean" ? p.shutters : k.shut, flowers: typeof p.flowers === "boolean" ? p.flowers : k.flowers,
      share: cl(num(p.lit, 0.5), 0, 1), gable, acc: r.pick(k.accents), number: str(p.number, ""), main: [], fr: [], gl: [], tx: [], ov: k.ov ?? 0,
      yb: f => f <= 0 ? 0 : -(k.gh + (f - 1) * k.fh), bx: i2 => -W / 2 + k.pad + (i2 + 0.5) * k.bay,
    };
    houses.push({ c, h: k.draw(c) });
  }
  const stride = W + k.gap, tw = n * W + (n - 1) * k.gap + 2 * (k.ov ?? 0) + 60, th = Math.max(...houses.map(x => x.h)) + 30, ppcm = Math.min(1.6, 1900 / tw, 1900 / th);
  const flats: FlatSpec[] = [];
  houses.forEach(({ c }, i) => {
    const x = (i - (n - 1) / 2) * stride;
    flats.push({ group: { shapes: c.main, edge: 0.8 }, x, ppcm, ...(c.tx.length ? { text: c.tx } : {}) });
    if (c.fr.length) flats.push({ group: { shapes: c.fr, edge: 0.7 }, x, z: 14, ppcm, shadow: "drop" });
    flats.push(...litByTurns(c.gl, { x, z: 0.4, ppcm }));
  });
  return { flats };
}, variants: Object.fromEntries(KIND_IDS.map(v => [v, { kind: v }])),
  meta: {
    about: "A town house's front in one of seven European kinds (Paris, Amsterdam, London, the Mediterranean, the Alps, Scandinavia, Germany and Belgium): floors, bays, lit windows, shutters and window boxes, all seeded by the place's `seed`.",
    params: {
      kind: { type: "enum", values: KIND_IDS, default: "haussmann" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "houses side by side, each its own" },
      floors: { type: "int", min: 1, max: 7, about: "floors counting the ground floor (haussmann 5, canal_house 4, terrace 4, whitewash 2, chalet 2, painted_wood 2, gabled 4)" },
      bays: { type: "int", min: 1, max: 8, about: "window columns (haussmann 4, canal_house 3, terrace 2, whitewash 2, chalet 2, painted_wood 2, gabled 3)" },
      door: { type: "int", min: 0, max: 7, about: "the street door's bay; the middle one, or a side one on a canal house or terrace (seeded)" },
      color: { type: "color", about: "the wall's colour (a palette id or a hex); each kind has its own" },
      roof: { type: "color", about: "the roof's colour (a palette id or a hex); each kind has its own" },
      gable: { type: "enum", values: ["bell", "stepped", "steep"], about: "a canal_house or gabled house's gable (canal_house bell, gabled steep)" },
      shutters: { type: "bool", about: "shutters at the windows (whitewash, chalet and gabled yes, the rest no)" },
      flowers: { type: "bool", about: "window boxes (whitewash and chalet yes, the rest no)" },
      lit: { type: "num", min: 0, max: 1, default: 0.5, about: "the share of windows that light at night" },
      number: { type: "text", about: "the house number on its plate or fanlight; none when left out" },
    },
    terms: ["house", "townhouse", "evler"],
    tags: ["house", "building", "city"],
  } };

// ---- a café terrace --------------------------------------------------------------------------------------

/** A bistro chair in profile, facing +x, its origin at the foot's centre. */
const chair = (dir: 1 | -1, dx: number): Shape[] => {
  const m = (pts: Vec2[]) => pts.map(([x, y]) => [x * dir + dx, y] as Vec2), fm = "#3E2A1E";
  return [
    rod(m([[13, -45], [16, 0]]), fm, 2.4), rod(m([[-12, -45], [-17, 0]]), fm, 2.4), rod(m([[-12, -45], [-16, -66], [-15, -82], [-7, -90], [1, -86]]), fm, 3.2),
    S(rrect(Math.min(-17 * dir + dx, 16 * dir + dx), -49, 33, 5, 2.4), "#D9B26A"), P(m([[-12.5, -52], [-15.5, -66], [-14.5, -82], [-8, -87], [-3, -82], [-5, -66], [-5, -52]]), "#D9B26A", { opacity: 0.85 }),
  ];
};
/** A round bistro table with a cup and saucer on it, centred at x. */
const table = (x: number): Shape[] => [
  S(ellipse(x, -2, 17, 3.2), "#2F3237"), R(x - 2, -72, 4, 70, "#2F3237"), S(ellipse(x, -73, 35, 5.4), "#1F2A26"), S(ellipse(x, -75.6, 34, 5), "#2F5A4A"), S(ellipse(x - 10, -76, 7, 1.8), WHITE), S(rrect(x - 13.5, -86, 7, 9, 2), WHITE), S(rect(x - 12, -84, 4, 1.4), "#6B4A35", pr(0.9)),
  S(ellipse(x + 12, -76, 7, 1.8), WHITE), S(rrect(x + 8.5, -86, 7, 9, 2), WHITE), S(rect(x + 10, -84, 4, 1.4), "#6B4A35", pr(0.9)),
];

/**
 * A café terrace: `n` round bistro tables each with two chairs facing it, under a striped `awning` (with the café's `name` as words
 * in `lang`, a string of bulbs that light at night) or a `parasol` over each table, or `none`; `plants` stands a clipped bay tree at
 * each end.
 */
const cafeTerrace: PieceDef = { draw(p, r) {
  const n = Math.round(cl(num(p.n, 3), 1, 6)), cover = ["awning", "parasol", "none"].includes(str(p.cover, "")) ? str(p.cover, "") : "parasol", c1 = hex(p.color, "#B3261E"), c2 = "#F4F1EA";
  const step = 135, W = n * step, x0 = -W / 2, name = str(p.name, "Café").trim(), lang = str(p.lang, "fr").trim() || "fr";
  const furn: Shape[] = [], top: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * step;
    furn.push(...chair(1, x - 50), ...chair(-1, x + 50), ...table(x));
  }
  if (cover === "parasol") for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * step, base = -212, k = 6, w = 76;
    furn.push(R(x - 1.5, -250, 3, 176, "#6B5A44"));
    for (let j = 0; j < k; j++) {
      const a = x - w + (2 * w * j) / k, b = x - w + (2 * w * (j + 1)) / k, cap = arcPoints((a + b) / 2, base, (b - a) / 2, 11, 0, Math.PI, 5);
      top.push(S(poly([[x, -252], [a, base], ...cap, [b, base]]), j % 2 ? c2 : c1));
    }
    top.push(S(ellipse(x, -254, 3.4), "#6B5A44"));
  } else if (cover === "awning") {
    const y0 = -318, y1 = -228, ns = Math.max(6, Math.round(W / 40) * 2), sw = (W + 40) / ns, ax = x0 - 20;
    const cloth = poly([[ax + 16, y0], [ax + W + 40 - 16, y0], [ax + W + 40, y1], [ax, y1]]);
    top.push(S(cloth, c2));
    for (let j = 0; j < ns; j += 2) top.push(S(poly([[ax + 16 + (sw - 0.3) * j * (W + 8) / (W + 40), y0], [ax + 16 + sw * (j + 1) * (W + 8) / (W + 40), y0], [ax + sw * (j + 1), y1], [ax + sw * j, y1]]), c1, { clip: cloth }));
    const val: Vec2[] = [[ax, y1], [ax + W + 40, y1]];
    for (let j = ns - 1; j >= 0; j--) val.push(...arcPoints(ax + (j + 0.5) * sw, y1 + 22, sw / 2, 12, 0, Math.PI, 5));
    top.push(S(poly(val), c1), R(ax, y1, W + 40, 22, c1), R(ax, y1 - 2, W + 40, 3, tone(c1, "shade"), pr(0.6)));
    for (let j = 0; j < ns; j += 2) top.push(R(ax + sw * j, y1, sw, 22, c2));
    for (const s of [x0 - 14, x0 + W + 14]) top.push(R(s - 2, y1 + 20, 4, -y1 - 20, IRON));
    for (const bx of span(x0 + 10, x0 + W - 10, 28)) { top.push(S(ellipse(bx, y1 + 38, 4), "#6B5A44")); glow.push(S(ellipse(bx, y1 + 38, 7), WARM, pr(0.9))); }
    if (name) text.push({ text: name, x: ax + 20, y: y1 + 1, w: W, h: 21, size: 15, font: "print", color: "#FFFFFF", weight: 700, align: "center", lang });
  }
  if (p.plants !== false) for (const s of [-1, 1]) {
    const x = s * (W / 2 + 30);
    furn.push(P([[x - 22, -46, 0], [x + 22, -46, 0], [x + 18, 0, 0], [x - 18, 0, 0]], "#3E4A45"), R(x - 25, -52, 50, 8, "#4E5B55"), R(x - 2, -100, 4, 52, "#4A3325"), ...[0, 1].map(j => S(ellipse(x, -128 - j * 44, 34 - j * 8), r.pick(GREENS))), S(ellipse(x - 11, -142, 10), "#7FAE6A", { flat: true, opacity: 0.35 }));
  }
  const ppcm = Math.min(2.4, 1900 / (W + 140)), flats: FlatSpec[] = [{ group: { shapes: furn, edge: 0.7 }, ppcm, shadow: "drop" }];
  if (top.length) flats.push({ group: { shapes: top, edge: 0.7 }, ppcm, z: 6, shadow: "drop", ...(text.length ? { text } : {}) });
  if (glow.length) flats.push(glowOnly(glow, { z: 7, ppcm, glowAt: 0.1, switch: false }));
  return { flats };
}, variants: { parasol: { cover: "parasol" }, awning: { cover: "awning" }, open: { cover: "none" } },
  meta: {
    about: "A café terrace: round bistro tables with two chairs each, under a striped awning with the café's name and a string of bulbs, or a parasol over every table, or open; bay trees at the ends.",
    params: {
      n: { type: "int", min: 1, max: 6, default: 3, about: "tables in a row, a metre and a third apart" },
      cover: { type: "enum", values: ["awning", "parasol", "none"], default: "parasol" },
      color: { type: "color", about: "the cloth's colour, with cream (a palette id or a hex; default a bistro red)" },
      name: { type: "text", default: "Café", about: "the café's name on the awning's valance" },
      lang: { type: "text", default: "fr", about: "the language of the name (a language tag)" },
      plants: { type: "bool", default: true, about: "a clipped bay tree in a tub at each end" },
    },
    terms: ["cafe", "terrace", "bistro"],
    tags: ["cafe", "street", "seating"],
  } };

// ---- cobbles ---------------------------------------------------------------------------------------------

/** The stones of one pavement: round-topped cobbles, granite setts in a running bond, or a Portuguese black-and-white wave. */
function cobbled(kind: string, w: number, d: number, base: string, r: Rng): Shape[] {
  const box = rect(-w / 2, 0, w, d), out: Shape[] = [S(box, kind === "calcada" ? "#EAE6DB" : tone(base, "deep"))], pr2 = { flat: true, clip: box };
  if (kind === "calcada") {
    const t = 8, ns = 1.1;
    let bp: Path | null = null;
    for (let y = 0; y < d; y += t) for (let x = -w / 2; x < w / 2; x += t) {
      const phase = ((y / 56) + 0.55 * Math.sin(x / 38 * Math.PI / 2 * 1.3) + 10) % 1;
      if (phase < 0.5) { const cell = rrect(x + ns / 2, y + ns / 2, t - ns, t - ns, 1.6); bp = bp ? bp.add(cell) : cell; }
    }
    if (bp) out.push(S(bp, "#2C2F34", pr2));
    return out;
  }
  const sw = kind === "sett" ? 24 : 17, sh = kind === "sett" ? 12 : 14, pal = [tone(base, "shade"), base, base, tone(base, "light")], cells: (Path | null)[] = [null, null, null, null];
  for (let y = 0, j = 0; y < d; y += sh, j++) for (let x = -w / 2 - (j % 2 ? sw / 2 : 0); x < w / 2; x += sw) {
    const g = r.int(0, 3), q = kind === "sett" ? 0.6 : 1.6, cell = rrect(x + 0.9 + r.range(0, q), y + 0.8 + r.range(0, q), sw - 1.8 - r.range(0, q * 2), sh - 1.6 - r.range(0, q * 2), kind === "sett" ? 1.2 : 5.5);
    cells[g] = cells[g] ? cells[g]!.add(cell) : cell;
  }
  cells.forEach((cp, g) => { if (cp) out.push(S(cp, pal[g], pr2)); });
  return out;
}

/** A pavement laid flat, `w` × `d` cm: `cobble` (round-topped stones, laid in staggered rows), `sett` (granite blocks in a running bond) or `calcada` (a Portuguese black-and-white wave of small tesserae). */
const cobbles: PieceDef = { draw(p, r) {
  const kind = ["cobble", "sett", "calcada"].includes(str(p.kind, "")) ? str(p.kind, "") : "cobble", w = cl(num(p.w, 1000), 40, 4000), d = cl(num(p.d, 450), 40, 2000);
  const base = hex(p.color, kind === "sett" ? "#8D9298" : "#9A9288");
  return { flats: [{ group: { shapes: cobbled(kind, w, d, base, r), edge: 0 }, pitch: -Math.PI / 2, ppcm: Math.min(0.7, 1900 / Math.max(w, d)), lit: 1 }] };
}, variants: { cobble: { kind: "cobble" }, sett: { kind: "sett" }, calcada: { kind: "calcada" } },
  meta: {
    about: "A street paved with stone, laid flat: round-topped cobbles in staggered rows, granite setts in a running bond, or a Portuguese black-and-white wave (calçada).",
    params: {
      kind: { type: "enum", values: ["cobble", "sett", "calcada"], default: "cobble" },
      w: { type: "num", min: 40, max: 4000, default: 1000, about: "cm" },
      d: { type: "num", min: 40, max: 2000, default: 450, about: "depth, cm" },
      color: { type: "color", about: "the stones' colour (a palette id or a hex; default a warm grey, granite grey for setts); calcada is always black and white" },
    },
    terms: ["cobbles", "pavement", "calcada"],
    tags: ["floor", "street", "pavement"],
  } };

// ---- a canal --------------------------------------------------------------------------------------------

/**
 * A canal seen from the walkway: the quay's coping at the front (z 0) with a railing and iron bollards, the water lying `drop`
 * cm below it for `d` cm, and the far bank's quay wall (brick, with mooring rings, a ladder and a waterline) rising to the
 * far walkway. The railing is a solid line; `far` false leaves the far bank out.
 */
const canal: PieceDef = { draw(p, r) {
  const w = cl(num(p.w, 1200), 200, 4000), d = cl(num(p.d, 600), 120, 2000), drop = cl(num(p.drop, 110), 40, 300), water = hex(p.color, "#3F7F8F"), bank = hex(p.bank, "#8E5A44");
  const nb = Math.round(cl(num(p.bollards, 3), 0, 8)), railing = p.railing !== false, far = p.far !== false;
  const flats: FlatSpec[] = [];
  // the water, lying flat from the far wall to the quay
  const wsh: Shape[] = [S(rect(-w / 2, 0, w, d), water), S(rect(-w / 2, 0, w, d * 0.22), tone(water, "deep"), { flat: true, opacity: 0.35 })];
  const rip: Path[] = [];
  for (let i = 0; i < Math.round(w * d / 2600); i++) { const x = r.range(-w / 2 + 20, w / 2 - 20), y = r.range(8, d - 8), l = r.range(14, 40); rip.push(poly([[x, y], [x + l, y + 0.4], [x + l, y + 2], [x, y + 1.6]])); }
  if (rip.length) wsh.push(S(rip.reduce((a, b) => a.add(b)), tone(water, "edge"), { flat: true, opacity: 0.5 }));
  wsh.push(S(many(span(-w / 2 + 60, w / 2 - 60, 190).map(x => [x + r.range(-40, 40), d * 0.04, r.range(18, 44), d * 0.18])), tone(bank, "shade"), { flat: true, opacity: 0.12 }));
  flats.push({ group: { shapes: wsh, edge: 0 }, y: -drop, z: -d, pitch: -Math.PI / 2, ppcm: Math.min(0.5, 1900 / Math.max(w, d)), lit: 1, id: "water" });
  // the far quay wall
  if (far) {
    const wl: Shape[] = [...T(rect(-w / 2, -drop, w, drop), bank, bond(tone(bank, "deep"), 22, 8, 0.4)), R(-w / 2, -drop, w, 14, "#B9B1A0"), R(-w / 2, -drop + 14, w, 3, "#000000", pr(0.2)), R(-w / 2, -26, w, 26, tone(bank, "deep"), pr(0.35)), R(-w / 2, -28, w, 2.5, "#9DC3CE", pr(0.5))];
    for (let x = -w / 2 + 120; x < w / 2 - 60; x += 260 + r.range(0, 160)) wl.push(S(ellipse(x, -drop + 44, 7), IRON), S(ellipse(x, -drop + 44, 3.4), tone(bank, "deep")));
    const lx = r.range(-w / 4, w / 4);
    wl.push(S(many([[lx - 14, -drop + 6, 4, drop - 6], [lx + 10, -drop + 6, 4, drop - 6], ...span(-drop + 26, -34, 22).map(y => [lx - 14, y, 28, 3.4])]), IRON));
    flats.push({ group: { shapes: wl, edge: 0.6 }, y: -drop, z: -d - 2, ppcm: Math.min(1, 1900 / (w + 20)), shadow: "none" });
  }
  // the near quay: coping lying flat, then the railing and the bollards standing on it
  flats.push({ group: { shapes: [R(-w / 2, 0, w, 20, "#C9C2B2"), R(-w / 2, 0, w, 3, "#FFFFFF", pr(0.35)), R(-w / 2, 17, w, 3, "#6E6A60", pr(0.5)), S(many(span(-w / 2 + 70, w / 2, 140).map(x => [x, 0, 1.6, 20])), "#6E6A60", pr(0.5))], edge: 0 }, z: -20, pitch: -Math.PI / 2, ppcm: Math.min(0.6, 1900 / w), lit: 1 });
  const sh: Shape[] = [];
  if (railing) {
    const posts = span(-w / 2 + 6, w / 2 - 6, 120), bal = span(-w / 2 + 6, w / 2 - 6, 11).filter(x => !posts.some(q => Math.abs(q - x) < 7)).map(x => [x, -86, 2.2, 80]);
    sh.push(S(many(bal), IRON), R(-w / 2, -92, w, 5, IRON), R(-w / 2, -10, w, 4, IRON), S(many(posts.map(x => [x - 3.4, -100, 6.8, 100])), IRON), S(tips(posts, -100, 11, 11), IRON), S(many(posts.map(x => [x - 5, -96, 10, 3])), tone(IRON, "light"), pr(0.6)));
  }
  for (let i = 0; i < nb; i++) {
    const x = (nb === 1 ? 0 : (i / (nb - 1) - 0.5) * (w - 400)) + 60;
    sh.push(P([[x - 8, -38, 0], [x + 8, -38, 0], [x + 7, -26], [x + 10, -8], [x + 13, 0, 0], [x - 13, 0, 0], [x - 10, -8], [x - 7, -26]], "#25282C"), S(ellipse(x, -38, 11, 4), "#3A3D44"), R(x - 8, -30, 5, 20, "#FFFFFF", pr(0.12)));
  }
  if (sh.length) flats.push({ group: { shapes: sh, edge: 0.6 }, ppcm: Math.min(1.2, 1900 / (w + 30)), shadow: "drop", z: 4 });
  return { flats };
}, variants: { canal: {}, quay: { far: false } },
  solid(p) { const w = cl(num(p.w, 1200), 200, 4000); return p.railing === false ? [] : solidLine(-w / 2, w / 2); },
  meta: {
    about: "A canal seen from its walkway: the near quay's coping, a black iron railing and bollards, the water lying below, and the far bank's brick quay wall with mooring rings and a ladder.",
    params: {
      w: { type: "num", min: 200, max: 4000, default: 1200, about: "length along the water, cm" },
      d: { type: "num", min: 120, max: 2000, default: 600, about: "the water's width from quay to far wall, cm" },
      drop: { type: "num", min: 40, max: 300, default: 110, about: "how far the water lies below the walkway, cm" },
      color: { type: "color", default: "#3F7F8F", about: "the water (a palette id or a hex)" },
      bank: { type: "color", default: "#8E5A44", about: "the far wall's brick (a palette id or a hex)" },
      bollards: { type: "int", min: 0, max: 8, default: 3, about: "iron bollards along the near edge" },
      railing: { type: "bool", default: true, about: "the near edge's railing, which is a solid line" },
      far: { type: "bool", default: true, about: "the far bank's quay wall" },
    },
    terms: ["canal", "quay"],
    tags: ["canal", "water", "street"],
  } };

export const set: Record<string, PieceDef> = { townhouse, cafe_terrace: cafeTerrace, cobbles, canal };
export const props: Record<string, PieceDef> = {};
