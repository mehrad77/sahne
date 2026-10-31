// Set pieces for the airport, following STYLE.md. Units are centimetres;
// each flat's origin is its bottom centre. Pieces that move on their own carry `move` (FlatMotion).
// The outside is a forced-perspective diorama behind the glass (DESIGN.md §6.9): sky, far skyline,
// apron and runways, planes and a baggage train at a model scale, so it reads from the hall's camera.
// Words (the board, the signs) are text boxes the page draws (TextSpec), never letters in the art.

import { smooth, ellipse, rect, rrect, tone, mix, type PieceDef, type Shape, type Vec2, type FlatSpec, type TextSpec } from "sahne";
import { hex, S, P, L, num, str, flip, goes, type Pt } from "./draw.ts";

const STEEL = "#AEB6BC", STEEL_D = "#8E979E", BEAM = "#D9DDE0", GLASS = "#CFE6EE", SLATE = "#55657A", LIT = "#FFE2A6";
const WAY = "#2B3640", WAY_Y = "#F2C14E";
const BAGS = ["#C4553A", "#2E3A59", "#E0A83A", "#2F8C88", "#7A3E6E", "#6F7A45"];

/** The params `goes` reads: a piece moving along a path. */
const GOES_PARAMS = {
  go: { type: "list", about: "[x, y, z] points of its path, cm" },
  ms: { type: "num", min: 500, default: 20000, about: "one run along the path, ms" },
  wait: { type: "num", min: 0, default: 0, about: "hidden between runs, ms" },
  phase: { type: "num", min: 0, max: 1, default: 0, about: "where in its run it starts" },
  hide: { type: "bool", default: true, about: "hidden while it waits" },
} as const;

// ---- The sky and the far side ----------------------------------------------------------------

/** Clouds drifting left behind everything: `n` cut-paper clouds, each on its own slow path over `span` cm, deeper ones slower (parallax). */
const skyClouds: PieceDef = { draw(p, r) {
  const n = Math.max(1, Math.round(num(p.n, 5))), span = num(p.span, 4600), ms = num(p.ms, 240000), y0 = num(p.y0, 380), y1 = num(p.y1, 900), flats: FlatSpec[] = [];
  for (let i = 0; i < n; i++) {
    const w = r.range(420, 860), h = w * r.range(0.2, 0.28), y = -r.range(y0, y1), sh: Shape[] = [], k = r.int(3, 5);
    for (let j = 0; j < k; j++) { const t = (j + 0.5) / k, pr = h * (0.42 + Math.sin(t * Math.PI) * 0.55) * r.range(0.85, 1.1); sh.push(S(ellipse(-w / 2 + t * w, y - pr * 0.5, pr * 0.95, pr * 0.72), "#FFFFFF")); }
    sh.push(S(rrect(-w / 2, y - h * 0.32, w, h * 0.32, h * 0.16), "#FFFFFF"), S(rrect(-w * 0.44, y - h * 0.16, w * 0.88, h * 0.13, h * 0.06), "#B4C4D6", { flat: true, opacity: 0.7 }));
    const d = i / n; // 0 nearest … deeper and slower
    flats.push({ group: { shapes: sh, edge: 5 }, z: -d * 500, ppcm: 0.22, lit: 0.9, move: { path: { pts: [[span / 2, 0, 0], [-span / 2, 0, 0]], ms: ms * (1 + d * 0.6) }, phase: (i + r.range(0.15, 0.75)) / n } });
  }
  return { flats };
},
  meta: {
    about: "Cut-paper clouds drifting left behind everything, each on its own slow path, deeper ones slower.",
    params: {
      n: { type: "int", min: 0, default: 5, about: "how many clouds" },
      span: { type: "num", default: 4600, about: "width of their path, cm" },
      ms: { type: "num", default: 240000, about: "one crossing of the nearest, ms" },
      y0: { type: "num", default: 380, about: "lowest height, cm" },
      y1: { type: "num", default: 900, about: "highest height, cm" },
    },
    tags: ["sky"],
  } };

/** The far side of the airfield: hills, a tree line, the far terminal with tails over its roof, a control tower with a tulip cab (`tower` x), hangars, mast lights; lit windows at night and a red light blinking on the tower. */
const airportFar: PieceDef = { draw(p, r) {
  const w = num(p.w, 3600), tx = num(p.tower, -250), sh: Shape[] = [], lit: Shape[] = [];
  const hills = (h0: number, amp: number, col: string, step: number) => {
    const pts: Pt[] = [[-w / 2, 0, 0]];
    for (let x = -w / 2; x <= w / 2 + 1; x += step) pts.push([x, -h0 - amp * (0.5 + 0.5 * Math.sin(x / step * 1.7 + h0)) * r.range(0.7, 1)]);
    pts.push([w / 2, 0, 0]);
    sh.push(P(pts, col));
  };
  hills(170, 140, "#AFC0B0", 420); hills(90, 90, "#97AE93", 300);
  // tails of parked planes over the far terminal's roof, then the terminal: a long wave of a roof over a glass band
  for (let i = 0; i < 5; i++) { const x = -640 + i * 150 + r.range(-30, 30), fh = r.range(70, 100); sh.push(P([[x, -120, 0], [x + 10, -120 - fh, 0], [x + 34, -120 - fh, 0], [x + 52, -120, 0]], r.pick(["#2F8C88", "#C4553A", "#2E3A59", "#E0A83A", "#F4F2EE"]))); }
  const t0 = -700, t1 = 1400;
  sh.push(S(rect(t0, -128, t1 - t0, 128), "#C3CBD1"), S(rect(t0 + 20, -96, t1 - t0 - 40, 34), SLATE, { flat: true }));
  for (let x = t0 + 24; x < t1 - 60; x += 70) if (r.chance(0.7)) lit.push(S(rect(x, -94, 58, 30), LIT, { flat: true, opacity: 0.7 }));
  const roof: Pt[] = [[t0 - 30, -120, 0]];
  for (let x = t0; x <= t1; x += 180) roof.push([x, -150 - 18 * Math.sin((x - t0) / 290)]);
  roof.push([t1 + 30, -120, 0]);
  sh.push(P(roof, BEAM));
  for (let x = t0 + 60; x < t1; x += 120) sh.push(S(rect(x, -62, 6, 62), "#AEB8BE", { flat: true }));
  // hangars: arched roofs, big doors
  for (const [hx, hw] of [[-1450, 420], [-980, 360]] as const) {
    sh.push(S(rect(hx - hw / 2, -150, hw, 150), "#C9C3B8"), P([[hx - hw / 2 - 6, -148, 0], [hx - hw * 0.25, -205], [hx + hw * 0.25, -205], [hx + hw / 2 + 6, -148, 0]], "#B9C2C9"));
    sh.push(S(rect(hx - hw * 0.4, -120, hw * 0.8, 120), "#A9A397"));
    for (let x = hx - hw * 0.4 + 40; x < hx + hw * 0.4; x += 40) sh.push(L([[x, -118], [x, -2]], "#8E887C", 3, 0.6));
    lit.push(S(rect(hx - hw * 0.4, -126, hw * 0.8, 5), LIT, { flat: true }));
  }
  // a tree line along the field
  const trees: Pt[] = [[-w / 2, 0, 0]];
  for (let x = -w / 2; x <= w / 2; x += 70) trees.push([x, -22 - r.range(0, 22)]);
  trees.push([w / 2, 0, 0]);
  sh.push(P(trees, "#7F9A78"));
  // floodlight masts
  for (const mx of [-1750, -560, 700]) { sh.push(S(rect(mx - 3, -330, 6, 330), STEEL_D), S(rrect(mx - 18, -346, 36, 14, 3), "#6B737A")); lit.push(S(ellipse(mx, -334, 22, 8), "#FFF1C2", { flat: true })); }
  // the control tower: a slim shaft, a tulip cab, an aerial
  const top = -400;
  sh.push(S(rect(tx - 18, top, 36, -top), "#D6D9D6"), S(rect(tx + 6, top, 12, -top), tone("#D6D9D6", "shade"), { flat: true, opacity: 0.6 }));
  sh.push(P([[tx - 18, top, 0], [tx - 44, top - 42], [tx - 50, top - 82], [tx - 30, top - 108], [tx, top - 116], [tx + 30, top - 108], [tx + 50, top - 82], [tx + 44, top - 42], [tx + 18, top, 0]], "#E4E6E2"));
  sh.push(S(rrect(tx - 44, top - 84, 88, 24, 8), SLATE, { flat: true }), S(rect(tx - 2, top - 150, 4, 36), STEEL_D));
  lit.push(S(rrect(tx - 44, top - 84, 88, 24, 8), "#BFE3F2", { flat: true }));
  const red: Shape[] = [S(ellipse(tx, top - 152, 6, 6), "#E5483C")];
  return { flats: [
    { group: { shapes: sh, edge: 2 }, switch: false, emissive: { shapes: lit, edge: 0 }, ppcm: 0.15 },
    { group: { shapes: red, edge: 0 }, switch: false, emissive: { shapes: [S(ellipse(tx, top - 152, 16, 16), "#FF6A5A", { flat: true })], edge: 0 }, ppcm: 0.6, lit: 0, z: 2, move: { blink: { ms: 2400, on: 0.5 } } },
  ] };
},
  meta: {
    about: "The airfield's far side: hills, trees, the far terminal, hangars, mast lights and a control tower with a blinking red light.",
    params: {
      w: { type: "num", default: 3600, about: "cm" },
      tower: { type: "num", default: -250, about: "the control tower's x, cm" },
    },
    tags: ["airport", "building", "light"],
  } };

/**
 * The apron, laid on the ground from the far side (its origin, `d` cm behind the glass) to the glass: the field, a second
 * runway far off, the main runway (`rw` cm from the glass), the taxiway (`tw`), the concrete with its service road. Runway
 * and taxiway edge lights glow at night; the approach lights (`ax` cm, its left end) run towards the runway, one after another.
 */
const apron: PieceDef = { draw(p) {
  const w = num(p.w, 4000), d = num(p.d, 1970), rw = num(p.rw, 720), tw = num(p.tw, 450), ax = num(p.ax, -690), sh: Shape[] = [], lit: Shape[] = [];
  const y = (g: number) => d - g; // cm behind the glass → the art's y (towards the glass)
  const band = (g0: number, g1: number, c: string, o: Partial<Shape> = {}) => sh.push(S(rect(-w / 2, y(g1), w, g1 - g0), c, o));
  band(0, d, "#9DB08A");
  for (let g = 1450; g < d; g += 120) band(g, g + 50, "#A8BA94", { flat: true });
  band(1300, 1400, "#868A8F"); // the far runway
  band(rw - 100, rw + 100, "#7C8085"); band(380, 520, "#868A8F"); band(0, 380, "#BDBAB2"); band(170, 230, "#8C8F93");
  // the main runway: edge lines, centre dashes, threshold bars, touchdown bars
  for (const g of [rw - 94, rw + 86]) band(g, g + 8, "#F4F1EA", { flat: true });
  for (let x = -w / 2 + 40; x < w / 2; x += 260) sh.push(S(rect(x, y(rw + 5), 150, 10), "#F4F1EA", { flat: true }));
  for (let k = 0; k < 6; k++) sh.push(S(rect(ax + 100, y(rw + 80 - k * 30), 160, 10), "#F4F1EA", { flat: true }));
  for (const g of [rw - 50, rw + 40]) sh.push(S(rect(ax + 560, y(g + 10), 220, 10), "#F4F1EA", { flat: true }));
  // the taxiway's yellow centre line and lead-in lines curving to the stands; slab joints and the service road's dashes
  band(tw - 5, tw + 5, "#E8C24A", { flat: true });
  for (const x of [-900, 300]) sh.push(L([[x - 400, y(tw)], [x, y(tw - 40)], [x + 150, y(240)]], "#E8C24A", 7, 0.9));
  for (let x = -w / 2; x < w / 2; x += 500) sh.push(L([[x, y(380)], [x, y(240)]], "#A9A69E", 3, 0.6));
  band(300, 303, "#A9A69E", { flat: true });
  for (let x = -w / 2; x < w / 2; x += 240) sh.push(S(rect(x, y(202), 120, 5), "#F4F1EA", { flat: true }));
  // edge lights: white on the runway, blue on the taxiway (dots drawn long, since they are seen at a slant)
  for (let x = -w / 2 + 60; x < w / 2; x += 200) for (const g of [rw - 100, rw + 100]) { sh.push(S(ellipse(x, y(g), 8, 16), "#F7F3EA")); lit.push(S(ellipse(x, y(g), 30, 70), "#FFF4D6", { flat: true })); }
  for (let x = -w / 2 + 160; x < w / 2; x += 250) for (const g of [380, 520]) { sh.push(S(ellipse(x, y(g), 7, 14), "#5C7FB8")); lit.push(S(ellipse(x, y(g), 26, 60), "#6E9BFF", { flat: true })); }
  const flats: FlatSpec[] = [{ group: { shapes: sh, edge: 1.5 }, switch: false, emissive: { shapes: lit, edge: 0 }, pitch: -Math.PI / 2, ppcm: 0.1, lit: 1 }];
  // the approach lights: a flash running towards the runway's end, upright dots on low posts
  for (let i = 0; i < 6; i++) flats.push({
    group: { shapes: [S(rect(-1.5, -12, 3, 12), STEEL_D), S(ellipse(0, -14, 7, 5), "#FFFFFF")], edge: 0.5 }, switch: false, emissive: { shapes: [S(ellipse(0, -14, 26, 16), "#FFFFFF", { flat: true })], edge: 0 },
    x: ax - 170 + i * 34, z: y(rw), ppcm: 1, lit: 0, move: { blink: { ms: 2000, on: 0.07 }, phase: (1 - i * 0.075) % 1 },
  });
  return { flats };
},
  meta: {
    about: "The apron laid on the ground: field, runways, taxiway and concrete, edge lights at night and approach lights flashing in turn.",
    params: {
      w: { type: "num", default: 4000, about: "cm" },
      d: { type: "num", default: 1970, about: "depth from the far side to the glass, cm" },
      rw: { type: "num", default: 720, about: "the main runway's distance from the glass, cm" },
      tw: { type: "num", default: 450, about: "the taxiway's distance from the glass, cm" },
      ax: { type: "num", default: -690, about: "the approach lights' left end, x cm" },
    },
    tags: ["airport", "ground", "light"],
  } };

// ---- Things that move outside --------------------------------------------------------------

/** A plane side-on, `w` cm long (a model's size: it is far away), facing right; `dir` -1 faces left. Gear down unless `air`. */
function planeArt(L: number, tail: string, body: string, air: boolean) {
  const g = air ? L * 0.02 : L * 0.06, h = L * 0.12, Y = (k: number) => -g - h * k;
  const fus = smooth([[-L * 0.5, Y(0.98), 0], [-L * 0.3, Y(1)], [L * 0.3, Y(1)], [L * 0.44, Y(0.86)], [L * 0.5, Y(0.4)], [L * 0.47, Y(0.08)], [L * 0.36, Y(0)], [-L * 0.22, Y(0)], [-L * 0.42, Y(0.55)], [-L * 0.5, Y(0.8), 0]], true, 1);
  const sh: Shape[] = [];
  if (!air) for (const gx of [L * 0.37, -L * 0.03]) sh.push(S(rect(gx - L * 0.004, Y(0.1), L * 0.008, g + h * 0.1 - g * 0.4), "#6B737A"), S(ellipse(gx, -g * 0.36, g * 0.36), "#2E3338"));
  sh.push(P([[-L * 0.47, Y(0.95), 0], [-L * 0.49, Y(2.3), 0], [-L * 0.415, Y(2.3), 0], [-L * 0.3, Y(0.98), 0]], tail));
  sh.push(S(fus, body), S(rect(-L * 0.5, Y(0.3), L, h * 0.3), tone(body, "shade"), { flat: true, opacity: 0.4, clip: fus }));
  sh.push(S(rect(-L * 0.44, Y(0.44), L * 0.82, h * 0.08), tail, { flat: true, clip: fus }));
  for (let x = -L * 0.3; x < L * 0.35; x += L * 0.028) sh.push(S(ellipse(x, Y(0.64), h * 0.065, h * 0.085), SLATE, { flat: true }));
  sh.push(P([[L * 0.425, Y(0.8), 0], [L * 0.462, Y(0.72), 0], [L * 0.458, Y(0.6), 0], [L * 0.418, Y(0.62), 0]], "#3E4C5C", { flat: true }));
  sh.push({ path: rrect(L * 0.352, Y(0.86), L * 0.03, h * 0.62, L * 0.006), stroke: { color: tone(body, "shade"), width: L * 0.003 }, flat: true, opacity: 0.8 });
  sh.push(P([[-L * 0.46, Y(0.78), 0], [-L * 0.535, Y(0.6), 0], [-L * 0.45, Y(0.6), 0], [-L * 0.36, Y(0.74), 0]], tone(body, "shade")));
  sh.push(P([[L * 0.13, Y(0.34), 0], [-L * 0.05, Y(0.38), 0], [-L * 0.21, Y(0.1), 0], [-L * 0.17, Y(0.05), 0]], tone(body, "shade")));
  sh.push(S(rrect(L * 0.0, Y(0.3), L * 0.16, h * 0.44, h * 0.2), "#C9CDD1"), S(ellipse(L * 0.16, Y(0.08), h * 0.07, h * 0.19), SLATE, { flat: true }));
  const glow = [S(ellipse(-L * 0.02, Y(1) - 2, 5, 3), "#FF5A4A", { flat: true }), S(ellipse(-L * 0.19, Y(0.08), 6, 4), "#5CFF8A", { flat: true }), S(ellipse(L * 0.47, Y(0.1), 9, 6), "#FFF6DC", { flat: true })];
  return { sh, glow, strobe: [S(ellipse(-L * 0.5, Y(0.86), 4, 4), "#FFFFFF")], strobeAt: [-L * 0.5, Y(0.86)] as Vec2 };
}

/** A plane: `w` cm long, `dir` (1 right, -1 left), `tail` and `body` colours, `air` for gear up; moving along `go` (cm) in `ms`, waiting `wait` hidden, from `phase`. Its tail strobe flashes. */
const airportPlane: PieceDef = { draw(p) {
  const L = num(p.w, 380), dir = num(p.dir, 1) < 0 ? -1 : 1, a = planeArt(L, hex(p.tail, "#2F8C88"), hex(p.body, "#F4F2EE"), !!p.air), move = goes(p);
  return { flats: [
    { group: { shapes: flip(a.sh, dir), edge: 1 }, switch: false, emissive: { shapes: flip(a.glow, dir), edge: 0 }, ppcm: 0.6, ...(move ? { move } : {}) },
    { group: { shapes: flip(a.strobe, dir), edge: 0 }, switch: false, emissive: { shapes: flip([S(ellipse(a.strobeAt[0], a.strobeAt[1], 14, 14), "#FFFFFF", { flat: true })], dir), edge: 0 }, z: 1, ppcm: 1, lit: 0, move: { ...move, blink: { ms: 1300, on: 0.12 } } },
  ] };
},
  meta: {
    about: "A model-scale plane side-on, its tail strobe flashing, parked or moving along a path.",
    params: {
      w: { type: "num", default: 380, about: "length, cm" },
      dir: { type: "int", min: -1, max: 1, default: 1, about: "1 faces right, -1 left" },
      tail: { type: "color", default: "#2F8C88", about: "a palette id or a hex" },
      body: { type: "color", default: "#F4F2EE", about: "a palette id or a hex" },
      air: { type: "bool", about: "gear up, in flight" },
      ...GOES_PARAMS,
    },
    tags: ["airport", "vehicle"],
  } };

/** A baggage train: a tug and three carts piled with bags (one under a canvas hood), `dir` 1 going right; moves like a plane (`go`, `ms`, `wait`, `phase`). Its orange beacon turns. */
const baggageTug: PieceDef = { draw(p) {
  const dir = num(p.dir, 1) < 0 ? -1 : 1, move = goes(p), sh: Shape[] = [], wheel = (x: number, r: number) => sh.push(S(ellipse(x, -r, r), "#2E3338"), S(ellipse(x, -r, r * 0.4), STEEL_D, { flat: true }));
  // carts behind the tug (to its left)
  for (let i = 0; i < 3; i++) {
    const cx = -40 - i * 31;
    sh.push(L([[cx + 13, -7], [cx + 19, -7]], "#3B3B40", 1.4, 1), S(rect(cx - 13, -10, 26, 3.5), STEEL_D));
    if (i === 1) sh.push(P([[cx - 13, -10, 0], [cx - 13, -26], [cx, -30], [cx + 13, -26], [cx + 13, -10, 0]], "#4F6E9E"), S(rect(cx - 13, -24, 26, 3), "#6F8DC2", { flat: true }));
    else for (let k = 0; k < 3; k++) { const bw = 8 + (k % 2) * 2, bh = 7 + ((k + i) % 3) * 2; sh.push(S(rrect(cx - 12 + k * 8.5, -10 - bh, bw, bh, 1.4), BAGS[(i * 3 + k) % BAGS.length])); }
    wheel(cx - 8, 3.4); wheel(cx + 8, 3.4);
  }
  // the tug: a low body, an open cab with a roof
  sh.push(S(rect(-10, -30, 2, 18), "#3B3B40"), S(rect(6, -30, 2, 14), "#3B3B40"), S(rrect(-12, -32, 22, 3, 1), "#3B3B40"));
  sh.push(S(rrect(-16, -16, 34, 11, 3), "#E0A83A"), S(rect(-16, -9, 34, 2), tone("#E0A83A", "shade"), { flat: true }), S(rrect(-6, -20, 9, 5, 1.5), "#3B3B40"));
  wheel(-9, 4.6); wheel(11, 4.6);
  const beacon = [S(rrect(-3, -35.5, 4, 3.5, 1), "#FF9A2E")];
  return { flats: [
    { group: { shapes: flip(sh, dir), edge: 0.6 }, ppcm: 1.4, ...(move ? { move } : {}) },
    { group: { shapes: flip(beacon, dir), edge: 0 }, switch: false, emissive: { shapes: flip([S(ellipse(-1, -34, 9, 7), "#FFB35C", { flat: true })], dir), edge: 0 }, z: 1, ppcm: 2, lit: 0, move: { ...move, blink: { ms: 800, on: 0.5 } } },
  ] };
},
  meta: {
    about: "A baggage train: a tug and three carts of bags, its orange beacon turning, parked or moving along a path.",
    params: {
      dir: { type: "int", min: -1, max: 1, default: 1, about: "1 goes right, -1 left" },
      ...GOES_PARAMS,
    },
    tags: ["airport", "vehicle"],
  } };

// ---- The terminal ------------------------------------------------------------------------------

/** The hall's floor, `w` × `d` from its origin towards the viewer: big light stone tiles (`tile` cm) in two tones with thin joints; low resolution, since it is seen at a slant. */
const terminalFloor: PieceDef = { draw(p) {
  const w = num(p.w, 1000), d = num(p.d, 480), t = num(p.tile, 80), a = hex(p.a, "#DCD9D2"), b = hex(p.b, "#D0CCC4");
  const sh: Shape[] = [S(rect(-w / 2, 0, w, d), a)];
  for (let y = 0, j = 0; y < d; y += t, j++) for (let x = -w / 2, i = 0; x < w / 2; x += t, i++) if ((i + j) % 2) sh.push(S(rect(x, y, t, t), b, { flat: true }));
  for (let y = t; y < d; y += t) sh.push(S(rect(-w / 2, y - 1, w, 2), "#BDB8AE", { flat: true, opacity: 0.6 }));
  return { flats: [{ group: { shapes: sh, edge: 0 }, pitch: -Math.PI / 2, ppcm: 0.4, lit: 1 }] };
},
  meta: {
    about: "The terminal hall's floor laid flat: big light stone tiles in two tones with thin joints.",
    params: {
      w: { type: "num", default: 1000, about: "cm" },
      d: { type: "num", default: 480, about: "depth, cm" },
      tile: { type: "num", default: 80, about: "tile size, cm" },
      a: { type: "color", default: "#DCD9D2", about: "a palette id or a hex" },
      b: { type: "color", default: "#D0CCC4", about: "a palette id or a hex" },
    },
    tags: ["airport", "floor"],
  } };

/** A glass curtain wall `w` × `h`: mullions every `bay` cm, a kick plate, a transom at 210, a deep ledge at `ledge` (a perch), a top beam; tinted glass with glints behind the frame. */
const glassWall: PieceDef = { draw(p) {
  const w = num(p.w, 600), h = num(p.h, 460), bay = num(p.bay, 150), ledge = num(p.ledge, 300), n = Math.max(1, Math.round(w / bay)), b = w / n;
  // each band and mullion is its own strip: a frame's box is mostly air, and strips keep the atlas small
  const strip = (shapes: Shape[]): FlatSpec => ({ group: { shapes, edge: 1 }, ppcm: 0.9 });
  const flats: FlatSpec[] = [
    strip([S(rect(-w / 2, -30, w, 30), "#7D868D"), S(rect(-w / 2, -32, w, 5), STEEL)]), strip([S(rect(-w / 2, -212, w, 5), STEEL_D)]),
    strip([S(rect(-w / 2, -ledge - 4, w, 12), BEAM), S(rect(-w / 2, -ledge - 4, w, 3), "#F2F4F5", { flat: true }), S(rect(-w / 2, -ledge + 4, w, 4), tone(BEAM, "shade"), { flat: true, opacity: 0.6 })]),
    strip([S(rect(-w / 2, -h, w, 42), BEAM), S(rect(-w / 2, -h + 36, w, 6), tone(BEAM, "shade"), { flat: true, opacity: 0.7 })]),
  ];
  for (let k = 0; k <= n; k++) {
    const x = -w / 2 + k * b;
    flats.push({ ...strip([S(rect(x - 4.5, -h + 40, 9, h - 70), STEEL_D), S(rect(x - 4.5, -h + 40, 2.5, h - 70), "#C2C9CE", { flat: true }), ...[-212, -ledge + 2].map(jy => S(ellipse(x, jy, 4.5, 4.5), "#6B737A", { flat: true }))]), z: 0.5 });
  }
  const glass: Shape[] = [S(rect(-w / 2, -h + 40, w, h - 70), GLASS, { flat: true, opacity: 0.13 })];
  for (let k = 0; k < n; k++) { const x = -w / 2 + k * b; glass.push(L([[x + b * 0.18, -60], [x + b * 0.48, -190]], "#FFFFFF", 7, 0.22), L([[x + b * 0.5, -70], [x + b * 0.66, -140]], "#FFFFFF", 4, 0.16), L([[x + b * 0.3, -240], [x + b * 0.55, -320]], "#FFFFFF", 5, 0.14)); }
  return { flats: [{ group: { shapes: glass, edge: 0 }, z: -2, ppcm: 0.25 }, ...flats] };
},
  meta: {
    about: "A glass curtain wall: mullions, a kick plate, a transom, a deep ledge to perch on and a top beam, tinted glass with glints.",
    params: {
      w: { type: "num", default: 600, about: "cm" },
      h: { type: "num", default: 460, about: "cm" },
      bay: { type: "num", default: 150, about: "about this far between mullions, cm" },
      ledge: { type: "num", default: 300, about: "the ledge's height, cm" },
    },
    tags: ["airport", "wall", "window"],
  } };

/** A clad terminal wall `w` × `h` with an opening `gate` ({x, w, h}) for the arrivals doors: big panels, a steel skirting, the top beam of the glass wall. */
const terminalWall: PieceDef = { draw(p) {
  const w = num(p.w, 520), h = num(p.h, 460), c = hex(p.color, "#E7E4DD"), g = (p.gate ?? {}) as { x?: number; w?: number; h?: number };
  const gx = num(g.x, 0), gw = num(g.w, 0), gh = num(g.h, 0), a = gx - gw / 2 - 10, z = gx + gw / 2 + 10;
  let path = rect(-w / 2, -h, w, h);
  if (gw > 0) path = path.add(rect(gx - gw / 2, -gh, gw, gh));
  const sh: Shape[] = [S(path, c, { evenodd: true })];
  const span = (x0: number, x1: number, yy: number, hh: number, col: string, o: Partial<Shape> = {}) => {
    for (const [u, v] of gw > 0 && yy + hh > -gh ? [[x0, Math.min(x1, a)], [Math.max(x0, z), x1]] : [[x0, x1]]) if (v - u > 0.5) sh.push(S(rect(u, yy, v - u, hh), col, o));
  };
  for (let x = -w / 2 + 130; x < w / 2; x += 130) { if (gw > 0 && x > a && x < z) { sh.push(L([[x, -h + 42], [x, -gh - 10]], tone(c, "shade"), 1.6, 0.8)); continue; } sh.push(L([[x, -h + 42], [x, -10]], tone(c, "shade"), 1.6, 0.8)); }
  for (let yy = -125; yy > -h + 50; yy -= 115) span(-w / 2, w / 2, yy, 1.6, tone(c, "shade"), { flat: true, opacity: 0.8 });
  span(-w / 2, w / 2, -10, 10, STEEL);
  sh.push(S(rect(-w / 2, -h, 14, h), tone(c, "shade"), { flat: true, opacity: 0.5 }), S(rect(-w / 2, -h, w, 42), BEAM), S(rect(-w / 2, -h + 38, w, 6), tone(BEAM, "shade"), { flat: true, opacity: 0.7 }));
  return { flats: [{ group: { shapes: sh, edge: 1 }, ppcm: 0.5 }] };
},
  meta: {
    about: "A clad terminal wall of big panels with a steel skirting and an opening for the arrivals doors.",
    params: {
      w: { type: "num", default: 520, about: "cm" },
      h: { type: "num", default: 460, about: "cm" },
      color: { type: "color", default: "#E7E4DD", about: "a palette id or a hex" },
      gate: { type: "object", about: "{x, w, h} the opening, cm; none by default" },
    },
    tags: ["airport", "wall"],
  } };

/** The arrivals doors (`w` × `h`): a steel surround, two frosted leaves that swing out into the hall, and the bright corridor behind. */
const arrivalsDoor: PieceDef = { draw(p) {
  const w = num(p.w, 170), h = num(p.h, 230), f = 10, lw = w / 2 - 1;
  const jamb = (x: number): FlatSpec => ({ group: { shapes: [S(rect(x, -h, f, h), STEEL), S(rect(x, -h, 2.5, h), "#D3D8DB", { flat: true })], edge: 1 }, ppcm: 1 });
  const frame: FlatSpec[] = [jamb(-w / 2 - f), jamb(w / 2), { group: { shapes: [S(rect(-w / 2 - f, -h - f, w + 2 * f, f), STEEL), S(rect(-w / 2 - f, -h - f, w + 2 * f, 3), "#D3D8DB", { flat: true })], edge: 1 }, ppcm: 1 }];
  const leaf = (x0: number): Shape[] => [
    S(rect(x0, -h + 1, lw, h - 2), STEEL_D), S(rect(x0 + 5, -h + 6, lw - 10, h - 14), "#DCE6EA", { opacity: 0.92 }),
    S(rect(x0 + 5, -h * 0.58, lw - 10, 4), "#BFCBD1", { flat: true }), ...[0, 1, 2, 3, 4].map(k => S(ellipse(x0 + 12 + k * (lw - 24) / 4, -h * 0.66, 2.2, 2.2), "#9FB0B8", { flat: true })),
    S(rrect(x0 + (x0 < 0 ? lw - 14 : 8), -h * 0.52, 6, 30, 3), "#E9ECEE"),
  ];
  const back: Shape[] = [S(rect(-w / 2 - 70, -h - 30, w + 140, h + 30), "#D9D5CC"), S(rect(-w / 2 - 70, -h - 30, w + 140, 26), "#C9C4BA"), S(rect(-30, -205, 60, 205), "#BFC7CC"), S(rect(-w / 2 - 70, -14, w + 140, 14), STEEL)];
  return { flats: [
    { group: { shapes: [S(rect(-w / 2 - 70, 0, w + 140, 92), "#D2CEC6")], edge: 0 }, z: -92, pitch: -Math.PI / 2, ppcm: 0.4 },
    { group: { shapes: back, edge: 0.8 }, emissive: { shapes: [S(rect(-w / 2 - 50, -h - 22, w + 100, 10), "#FFF1D0", { flat: true })], edge: 0 }, z: -90, ppcm: 0.35 },
    ...frame,
    { group: { shapes: leaf(-w / 2 + 1), edge: 0.8 }, z: 1, ppcm: 1, id: "leaf_l", hinge: -w / 2 + 1, swing: -1.3 },
    { group: { shapes: leaf(1), edge: 0.8 }, z: 1, ppcm: 1, id: "leaf_r", hinge: w / 2 - 1, swing: 1.3 },
  ] };
},
  meta: {
    about: "The arrivals doors: a steel surround, two frosted leaves that swing out into the hall, the bright corridor behind.",
    params: {
      w: { type: "num", default: 170, about: "cm" },
      h: { type: "num", default: 230, about: "cm" },
    },
    tags: ["airport", "door"],
  } };

const BOARD_ROWS: [string, string, string][] = [["TAHRAN", "10:05", "İNDİ"], ["ANKARA", "10:15", "İNDİ"], ["İZMİR", "10:30", "ZAMANINDA"], ["BAKÜ", "10:45", "RÖTARLI"]];
const STATUS = (s: string) => s === "İNDİ" ? "#86D99A" : s === "RÖTARLI" ? "#FFB35C" : "#F4F1EA";

/** The arrivals board: `title` and `rows` ([city, time, status]) as screen text, a landing-plane pictogram, the hanging rods; the first row's status blinks (just landed). */
const arrivalsBoard: PieceDef = { draw(p) {
  const rows = Array.isArray(p.rows) ? (p.rows as unknown[]).filter((r): r is [string, string, string] => Array.isArray(r) && r.length === 3 && r.every(v => typeof v === "string")).slice(0, 6) : BOARD_ROWS;
  const w = num(p.w, 200), rh = 17, hd = 26, h = hd + rh * rows.length + 10, top = -h, title = str(p.title, "GELİŞ");
  const rods: FlatSpec[] = [-1, 1].map(k => ({ group: { shapes: [S(rect(k * w * 0.32 - 1.5, top - 60, 3, 62), STEEL_D)], edge: 0.4 }, z: -1, ppcm: 1.6 }));
  const sh: Shape[] = [S(rrect(-w / 2, top, w, h, 4), "#26303C"), S(rect(-w / 2 + 5, top + hd, w - 10, h - hd - 5), "#141C26"), S(rect(-w / 2 + 5, top + 5, w - 10, hd - 7), "#1F4E6E")];
  for (let i = 1; i < rows.length; i++) sh.push(L([[-w / 2 + 8, top + hd + i * rh], [w / 2 - 8, top + hd + i * rh]], "#33414F", 0.8, 1));
  // the pictogram: a plane coming down to a line
  const ix = -w / 2 + 14, iy = top + 17;
  sh.push(P([[ix - 6, iy - 9, 0], [ix + 7, iy - 3, 0], [ix + 9, iy - 1.5, 0], [ix + 7, iy - 0.5, 0], [ix - 6, iy - 6, 0]], WAY_Y, { flat: true }), S(rect(ix - 8, iy + 1.5, 20, 1.6), WAY_Y, { flat: true }));
  const cx = [-w / 2 + 9, -w * 0.1, w * 0.1], cw = [w * 0.36, w * 0.2, w * 0.36];
  const text: TextSpec[] = [{ text: title, x: -w / 2 + 28, y: top + 6, w: w * 0.5, h: hd - 9, size: 12, color: WAY_Y, align: "left", weight: 700, font: "screen", lit: 0 }];
  rows.forEach((r, i) => { for (let k = 0; k < 3; k++) if (i || k < 2) text.push({ text: r[k], x: cx[k], y: top + hd + i * rh + 2, w: cw[k], h: rh - 4, size: 9, color: k === 0 ? "#F4F1EA" : k === 1 ? "#FFD27A" : STATUS(r[2]), align: k === 2 ? "right" : "left", weight: 600, font: "screen", lit: 0 }); });
  const flats: FlatSpec[] = [...rods, { group: { shapes: sh, edge: 0.6 }, ppcm: 1.6, shadow: "drop", text }];
  if (rows.length) flats.push({ group: { shapes: [S(rect(cx[2] + cw[2] - 2, top + hd + 2, 1, 1), "#141C26", { flat: true, opacity: 0.02 })], edge: 0 }, z: 0.5, ppcm: 1.6, move: { blink: { ms: 1600, on: 0.62 } },
    text: [{ text: rows[0][2], x: cx[2], y: top + hd + 2, w: cw[2], h: rh - 4, size: 9, color: STATUS(rows[0][2]), align: "right", weight: 600, font: "screen", lit: 0 }] });
  return { flats };
},
  meta: {
    about: "The hanging arrivals board: a title, rows of city, time and status as screen text, the first row's status blinking.",
    params: {
      rows: { type: "list", about: "up to 6 [city, time, status]; default four sample flights" },
      title: { type: "text", default: "GELİŞ" },
      w: { type: "num", default: 200, about: "cm" },
    },
    tags: ["airport", "sign"],
  } };

/** A hanging wayfinding sign: `l` with an arrow left and a train pictogram (default "Metro"), `r` with an arrow right (default "Çıkış"), on cables `drop` cm long. */
const hangSign: PieceDef = { draw(p) {
  const w = num(p.w, 220), h = 30, drop = num(p.drop, 140), l = str(p.l, "Metro"), r = str(p.r, "Çıkış");
  const arrow = (x: number, d: number) => P([[x, -h / 2, 0], [x + d * 9, -h / 2 - 8, 0], [x + d * 9, -h / 2 - 3, 0], [x + d * 19, -h / 2 - 3, 0], [x + d * 19, -h / 2 + 3, 0], [x + d * 9, -h / 2 + 3, 0], [x + d * 9, -h / 2 + 8, 0]], WAY_Y, { flat: true });
  const sh: Shape[] = [S(rrect(-w / 2, -h, w, h, 3), WAY), S(rect(-1, -h + 5, 2, h - 10), "#4A5866", { flat: true })];
  sh.push(arrow(-w / 2 + 8, 1), S(rrect(-w / 2 + 32, -h + 8, 16, 18, 3), WAY_Y, { flat: true }), S(rect(-w / 2 + 35, -h + 11, 10, 6), WAY, { flat: true }), S(ellipse(-w / 2 + 36, -h + 22, 1.5, 1.5), WAY, { flat: true }), S(ellipse(-w / 2 + 44, -h + 22, 1.5, 1.5), WAY, { flat: true }));
  sh.push(arrow(w / 2 - 8, -1));
  const t = (text: string, x: number, align: "left" | "right"): TextSpec => ({ text, x, y: -h + 6, w: w / 2 - 54, h: h - 12, size: 13, color: WAY_Y, align, weight: 700, font: "print", lit: 0 });
  return { flats: [-1, 1].map(k => ({ group: { shapes: [S(rect(k * w * 0.35 - 1, -h - drop, 2, drop + 2), "#3B3B40")], edge: 0.3 }, z: -0.5, ppcm: 1.2 } as FlatSpec))
    .concat({ group: { shapes: sh, edge: 0.6 }, ppcm: 1.8, text: [t(l, -w / 2 + 50, "left"), t(r, 8, "right")] }) };
},
  meta: {
    about: "A hanging wayfinding sign: an arrow left with a train pictogram, an arrow right, a word by each.",
    params: {
      w: { type: "num", default: 220, about: "cm" },
      drop: { type: "num", default: 140, about: "its cables, cm" },
      l: { type: "text", default: "Metro", about: "the left word" },
      r: { type: "text", default: "Çıkış", about: "the right word" },
    },
    tags: ["airport", "sign"],
  } };

/** A long pendant light `w` cm on two cables `drop` long: a slim body with a glowing diffuser, and two warm lights for the night. */
const ceilingLight: PieceDef = { draw(p) {
  const w = num(p.w, 260), drop = num(p.drop, 60);
  const sh: Shape[] = [S(rrect(-w / 2, -12, w, 12, 4), "#E9ECEE"), S(rect(-w / 2 + 6, -4, w - 12, 3), "#FFF6DC", { flat: true })];
  return { flats: [-1, 1].map(k => ({ group: { shapes: [S(rect(k * w * 0.38 - 0.75, -12 - drop, 1.5, drop), "#3B3B40")], edge: 0.3 }, z: -0.5, ppcm: 1.2 } as FlatSpec)).concat({ group: { shapes: sh, edge: 0.6 }, emissive: { shapes: [S(rrect(-w / 2 + 4, -6, w - 8, 7, 3), LIT, { flat: true })], edge: 0 }, ppcm: 1.2 }),
    lights: [-1, 1].map(k => ({ x: k * w / 4, y: -20, z: 30, color: "#FFE2B0", radius: 6, intensity: 0.55 })) };
},
  meta: {
    about: "A long pendant light on two cables, a slim body with a glowing diffuser and warm light at night.",
    params: {
      w: { type: "num", default: 260, about: "cm" },
      drop: { type: "num", default: 60, about: "its cables, cm" },
    },
    tags: ["airport", "light"],
  } };

/** A white tree column `h` tall, branching into two struts under the roof. */
const column: PieceDef = { draw(p) {
  const h = num(p.h, 460), w = num(p.w, 40), c = "#E9ECEE", bh = h - 110;
  const arms: Shape[] = [P([[-w * 0.1, -bh, 0], [-w * 2.2, -h + 40, 0], [-w * 2.2 + 12, -h + 40, 0], [w * 0.1, -bh + 18, 0]], tone(c, "shade")), P([[w * 0.1, -bh, 0], [w * 2.2, -h + 40, 0], [w * 2.2 - 12, -h + 40, 0], [-w * 0.1, -bh + 18, 0]], tone(c, "shade"))];
  const sh: Shape[] = [
    P([[-w / 2, 0, 0], [-w / 2, -bh + 30], [-w * 0.2, -bh - 20, 0], [w * 0.2, -bh - 20, 0], [w / 2, -bh + 30], [w / 2, 0, 0]], c),
    S(rect(w * 0.12, -bh + 20, w * 0.3, bh - 22), tone(c, "shade"), { flat: true, opacity: 0.55 }), S(rect(-w * 0.36, -bh + 20, w * 0.14, bh - 22), "#FFFFFF", { flat: true, opacity: 0.6 }),
    S(rrect(-w / 2 - 4, -16, w + 8, 16, 3), STEEL),
  ];
  return { flats: [{ group: { shapes: arms, edge: 1 }, z: -1, ppcm: 0.9 }, { group: { shapes: sh, edge: 1 }, ppcm: 1 }] };
},
  meta: {
    about: "A white tree column branching into two struts under the roof.",
    params: {
      h: { type: "num", default: 460, about: "cm" },
      w: { type: "num", default: 40, about: "the shaft, cm" },
    },
    tags: ["airport", "building"],
  } };

/** The barrier at arrivals, `w` × `h`: steel posts about every metre, a top rail, frosted glass panels between. */
const rail: PieceDef = { draw(p) {
  const w = num(p.w, 320), h = num(p.h, 92), n = Math.max(1, Math.round(w / 105)), g = w / n, sh: Shape[] = [];
  for (let k = 0; k < n; k++) sh.push(S(rect(-w / 2 + k * g + 5, -h + 14, g - 10, h - 34), "#D6E8EE", { flat: true, opacity: 0.32 }), L([[-w / 2 + k * g + g * 0.3, -h + 30], [-w / 2 + k * g + g * 0.5, -h + 60]], "#FFFFFF", 2, 0.4));
  for (let k = 0; k <= n; k++) { const x = -w / 2 + k * g; sh.push(S(rect(x - 2.5, -h, 5, h), STEEL_D), S(rrect(x - 10, -3, 20, 3, 1.5), STEEL_D)); }
  sh.push(S(rrect(-w / 2 - 4, -h - 4, w + 8, 6, 3), STEEL), S(rect(-w / 2, -h - 3, w, 1.4), "#FFFFFF", { flat: true, opacity: 0.6 }), S(rect(-w / 2, -22, w, 3), STEEL));
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, ppcm: 1.1 }] };
},
  meta: {
    about: "The barrier at arrivals: steel posts about every metre, a top rail and frosted glass panels between.",
    params: {
      w: { type: "num", default: 320, about: "cm" },
      h: { type: "num", default: 92, about: "cm" },
    },
    tags: ["airport", "barrier"],
  } };

/** A row of `n` linked airport seats on a steel beam, in `color`. */
const benchRow: PieceDef = { draw(p) {
  const n = Math.max(1, Math.round(num(p.n, 3))), c = hex(p.color, "#3E6E86"), sw = 52, w = n * sw, sh: Shape[] = [];
  for (const x of [-w / 2 + 14, w / 2 - 14]) sh.push(P([[x - 16, 0, 0], [x - 4, -32, 0], [x + 4, -32, 0], [x + 16, 0, 0], [x + 10, 0, 0], [x, -24, 0], [x - 10, 0, 0]], STEEL_D));
  sh.push(S(rect(-w / 2 + 4, -36, w - 8, 6), STEEL_D));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + i * sw;
    sh.push(S(rrect(x + 4, -84, sw - 8, 38, 6), c), S(rect(x + sw - 12, -80, 5, 30), tone(c, "shade"), { flat: true, opacity: 0.5 }), S(rrect(x + 3, -46, sw - 6, 9, 3), tone(c, "light")));
    for (let k = 0; k < 3; k++) sh.push(S(rect(x + 12, -76 + k * 8, sw - 24, 2), tone(c, "shade"), { flat: true, opacity: 0.6 }));
    if (i) sh.push(S(rrect(x - 3, -58, 6, 22, 2), STEEL));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, ppcm: 1.2 }] };
},
  meta: {
    about: "A row of linked airport seats on a steel beam.",
    params: {
      n: { type: "int", min: 1, default: 3, about: "how many seats" },
      color: { type: "color", default: "#3E6E86", about: "a palette id or a hex" },
    },
    tags: ["airport", "seating"],
  } };

/** `n` luggage trolleys nested in a row, side-on, with `grip` handles. */
const trolleys: PieceDef = { draw(p) {
  const n = Math.max(1, Math.round(num(p.n, 4))), grip = hex(p.grip, "#C4553A"), step = 17, w = 62 + step * (n - 1), sh: Shape[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = -w / 2 + i * step;
    sh.push(S(ellipse(x + 8, -5, 5), "#2E3338"), S(ellipse(x + 52, -5, 5), "#2E3338"));
    sh.push(S(rect(x + 4, -14, 54, 3.5), STEEL), P([[x + 2, -14, 0], [x, -40, 0], [x + 4, -40, 0], [x + 6, -14, 0]], STEEL_D), S(rect(x + 8, -42, 46, 3), STEEL));
    sh.push(P([[x + 52, -12, 0], [x + 60, -100, 0], [x + 63.5, -100, 0], [x + 56, -12, 0]], STEEL), S(rrect(x + 52, -106, 20, 7, 3), grip), S(rect(x + 20, -42, 2.5, 28), STEEL_D, { flat: true }), S(rect(x + 36, -42, 2.5, 28), STEEL_D, { flat: true }));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.5 }, ppcm: 1.2 }] };
},
  meta: {
    about: "Luggage trolleys nested in a row, side-on.",
    params: {
      n: { type: "int", min: 1, default: 4, about: "how many trolleys" },
      grip: { type: "color", default: "#C4553A", about: "the handles, a palette id or a hex" },
    },
    tags: ["airport"],
  } };

/** A tall leafy plant `h` in a steel planter. */
const plant: PieceDef = { draw(p) {
  const h = num(p.h, 160), pot = 58, sh: Shape[] = [];
  const greens = ["#4E7A48", "#5E8F55", "#3F6B3E", "#6E9E5E"];
  for (let i = 0; i < 9; i++) {
    const a = -1.05 + i * 0.26 + (i % 2 ? 0.05 : -0.05), len = (h - pot) * (0.62 + 0.38 * Math.sin((i + 0.5) / 9 * Math.PI)), bx = (i - 4) * 2.5, by = -pot + 4;
    const tx = bx + Math.sin(a) * len, ty = by - Math.cos(a) * len, mx = (bx + tx) / 2 + Math.cos(a) * 5, my = (by + ty) / 2 + Math.sin(a) * 5, nx = Math.cos(a), ny = Math.sin(a), lw = 9 + (i % 3) * 2;
    sh.push(P([[bx, by, 0], [mx - nx * lw, my - ny * lw], [tx, ty, 0], [mx + nx * lw, my + ny * lw]], greens[i % 4]), L([[bx, by], [mx, my], [tx, ty]], "#9CC48A", 1, 0.55));
  }
  sh.push(S(rrect(-26, -pot, 52, pot, 4), STEEL_D), S(rect(-29, -pot - 4, 58, 7), STEEL), S(rect(8, -pot + 4, 12, pot - 8), tone(STEEL_D, "shade"), { flat: true, opacity: 0.5 }));
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: 1.1 }] };
},
  meta: {
    about: "A tall leafy plant in a steel planter.",
    params: { h: { type: "num", default: 160, about: "cm" } },
    tags: ["airport", "plant"],
  } };

/** A passer-by in the background: a plain paper silhouette (no face), muted, pulling a `case`, with a `pack` or pushing a `cart`, in colour `c`; walks along `go` (`dir` -1 left) with a bob, hidden while it waits. */
const traveller: PieceDef = { draw(p) {
  const dir = num(p.dir, -1) < 0 ? -1 : 1, kind = str(p.kind, "case"), mute = (c: string) => mix(c, "#A3ACB5", 0.42);
  const c = mute(hex(p.c, "#4F6E9E")), skin = mute(hex(p.skin, "#C99A7A")), hair = mute(hex(p.hair, "#3B2A22")), legs = mute("#3E4650"), sh: Shape[] = [];
  if (kind === "case") sh.push(S(rect(-26, -78, 2, 34), "#5A626A"), S(rrect(-40, -46, 26, 42, 4), mute(hex(p.bag, "#2E3A59"))), S(ellipse(-35, -3, 3), "#3B3B40"), S(ellipse(-19, -3, 3), "#3B3B40"));
  if (kind === "cart") sh.push(S(rect(16, -12, 50, 3), STEEL), S(ellipse(22, -4, 4), "#3B3B40"), S(ellipse(60, -4, 4), "#3B3B40"), P([[12, -78, 0], [20, -12, 0], [23, -12, 0], [15, -78, 0]], STEEL), S(rrect(26, -44, 34, 32, 3), mute("#C4553A")), S(rrect(30, -62, 26, 18, 3), mute("#E0A83A")));
  // legs mid-stride, the body, the head with its hair
  sh.push(P([[-4, -86, 0], [-14, -2, 0], [-6, -2, 0], [4, -80, 0]], legs), P([[-2, -86, 0], [12, -2, 0], [20, -2, 0], [8, -84, 0]], tone(legs, "shade")));
  sh.push(S(rrect(-15, -142, 30, 62, 10), c), S(ellipse(0, -156, 12, 13), skin), P([[-12, -158, 0], [-10, -169], [3, -172], [12, -164], [10, -156, 0], [0, -162]], hair));
  if (kind === "pack") sh.push(S(rrect(-27, -136, 15, 40, 5), mute("#C4553A")));
  sh.push(P([[-4, -136, 0], [kind === "cart" ? 16 : -20, kind === "cart" ? -78 : -82, 0], [kind === "cart" ? 20 : -14, kind === "cart" ? -80 : -80, 0], [4, -130, 0]], tone(c, "shade")));
  const path = goes(p);
  return { flats: [{ group: { shapes: flip(sh, dir), edge: 0.6 }, ppcm: 1.2, ...(path ? { move: { ...path, sway: { dy: 1.6, rot: 0.012, ms: num(p.step, 560) } } } : {}) }] };
},
  meta: {
    about: "A faceless, muted paper passer-by pulling a case, with a pack or pushing a cart, walking a path with a bob.",
    params: {
      kind: { type: "enum", values: ["case", "pack", "cart"], default: "case", about: "what they carry" },
      dir: { type: "int", min: -1, max: 1, default: -1, about: "-1 faces left, 1 right" },
      c: { type: "color", default: "#4F6E9E", about: "clothes, a palette id or a hex" },
      skin: { type: "color", default: "#C99A7A", about: "a palette id or a hex" },
      hair: { type: "color", default: "#3B2A22", about: "a palette id or a hex" },
      bag: { type: "color", default: "#2E3A59", about: "case: its colour, a palette id or a hex" },
      step: { type: "num", default: 560, about: "one bob of the walk, ms" },
      ...GOES_PARAMS,
    },
    tags: ["airport", "people"],
  } };

export const AIRPORT_PIECES: Record<string, PieceDef> = {
  sky_clouds: skyClouds, airport_far: airportFar, apron, airport_plane: airportPlane, baggage_tug: baggageTug,
  terminal_floor: terminalFloor, glass_wall: glassWall, terminal_wall: terminalWall, arrivals_door: arrivalsDoor, arrivals_board: arrivalsBoard, hang_sign: hangSign,
  ceiling_light: ceilingLight, column, rail, bench_row: benchRow, trolleys, plant, traveller,
};

/** The family's set pieces and props (`index.ts`). */
export const set = AIRPORT_PIECES;
export const props: Record<string, PieceDef> = { airport_plane: airportPlane };
