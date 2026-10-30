// Set pieces (and the bike, a prop too) of the transit family, following STYLE.md: the vehicles of Europe's streets,
// rails and canals, each side on and facing right (`dir` -1 left), its wheels or waterline on y = 0, in cm. A bus, a
// train, a cab or a scooter drives along `go` (`ms`, `wait`, `phase`) like `car` and `tram`; a boat floats along it,
// rocking on the water. Windows are solid glass with faceless riders and light up at night. Words (a bus's destination,
// a train's line, a cab's roof sign and plate, a boat's name) are text boxes the page draws, never letters in the art.
// A bike is drawn standing, or held: its origin at the grip, as it is pushed by the bar.

import { ellipse, rect, rrect, poly, smooth, tone, type FlatMotion, type FlatSpec, type ParamSpec, type PieceDef, type PieceOut, type Path, type Rng, type Shape, type TextSpec } from "sahne";
import { hex, S, P, L, num, str, holed, goes, fit, fitText, rider, type Pt } from "./draw.ts";

type Prm = Record<string, unknown>;
const DARK = "#2B2F33", TYRE = "#232629", GLASS = "#4E6072", STEEL = "#B9BFC4", CREAM = "#F3EBD8", WHITE = "#F4F2EE";
const GO: Record<string, ParamSpec> = {
  go: { type: "list", about: "a path of [x, y, z] points (cm) it travels along" },
  ms: { type: "num", min: 500, default: 20000, about: "the time along go, ms" },
  wait: { type: "num", min: 0, default: 0, about: "ms between trips" },
  hide: { type: "bool", default: true, about: "hidden while it waits" },
  phase: { type: "num", default: 0, about: "where along go it starts, 0…1" },
};
const DIR: ParamSpec = { type: "int", min: -1, max: 1, default: 1, about: "-1 faces left" };

/** Flat paint on a shape. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a tube, a pole, a rod. */
const R = (pts: [number, number][], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Straight strokes as one flat shape. */
const lines = (segs: [number, number][][], c: string, w = 0.6, op = 0.7): Shape => { const q = poly(segs[0], false); for (const s of segs.slice(1)) q.add(poly(s, false)); return { path: q, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op }; };
/** A rubber ring of outer radius `r` and thickness `w` about (x, y). */
const ring = (x: number, y: number, r: number, w: number, c: string): Shape => S(holed(ellipse(x, y, r), [ellipse(x, y, r - w)]), c, { evenodd: true });
/** A vehicle's wheel under its arch: tyre, steel hub, lugs. */
function tyre(x: number, r: number): Shape[] {
  return [S(ellipse(x, -r, r * 1.16), "#1E2124", { flat: true, clip: rect(x - 2 * r, -3 * r, 4 * r, 3 * r) }), S(ellipse(x, -r, r), TYRE), S(ellipse(x, -r, r * 0.6), STEEL), F(ellipse(x, -r, r * 0.34), "#8E979E"), F(ellipse(x, -r, r * 0.12), DARK, 0.8), F(ellipse(x - r * 0.3, -r - r * 0.62, r * 0.14), "#FFFFFF", 0.3)];
}
/** A pane of glass with riders in it (some of the time), lit at night. */
function pane(sh: Shape[], glow: Shape[], r: Rng, x: number, y: number, w: number, h: number, ride = 0.55, k = 1.15, rad: number | [number, number, number, number] = 6): void {
  const o = rrect(x, y, w, h, rad);
  sh.push(S(o, GLASS), F(poly([[x + w * 0.12, y + h], [x + w * 0.3, y], [x + w * 0.42, y], [x + w * 0.24, y + h]]), "#FFFFFF", 0.18, o));
  if (r.chance(ride)) sh.push(...rider(r, x + w / 2 + r.range(-w * 0.2, w * 0.2), y + h + 2, k).map(s => ({ ...s, clip: o })));
  glow.push(S(o, "#FFE6B0", { flat: true, opacity: 0.8 }));
}

/** The flat, the vehicle drawn facing right, `dir` and `move` applied. */
function flatOf(p: Prm, id: string, sh: Shape[], glow: Shape[], text: TextSpec[], ppcm: number, sway?: FlatMotion["sway"], o: Partial<FlatSpec> = {}): PieceOut {
  const dir = num(p.dir, 1) < 0 ? -1 : 1, g = goes(p), move: FlatMotion | undefined = g || sway ? { ...(g ?? {}), ...(sway ? { sway } : {}) } : undefined;
  return { flats: [{ group: { shapes: fit(sh, 1, dir), edge: 0.9 }, ...(glow.length ? { emissive: { shapes: fit(glow, 1, dir), edge: 0 } } : {}), switch: false, ppcm, id, ...(text.length ? { text: fitText(text, 1, dir) } : {}), ...(move ? { move } : {}), ...o }] };
}
const RUMBLE = { rot: 0.0008, dy: 0.5, ms: 900 }, ROCK = { rot: 0.012, dy: 1.6, ms: 3400 };

// ---- double decker ---------------------------------------------------------------------------------

/**
 * A London double-decker, a Routemaster, 1000 cm long, side on: red with a cream band between the decks, two rows of
 * windows with faceless riders (lit at night), the open rear platform with its yellow pole, the driver's cab, the
 * destination box at the front (`route` and `dest`, text) and the headlamps.
 */
const double_decker: PieceDef = { draw(p, r) {
  const red = hex(p.color, "#C8202F"), sh: Shape[] = [], glow: Shape[] = [];
  const body = P([[-500, -30, 0], [-502, -426, 0], [-490, -438, 0], [470, -438, 0], [492, -430, 0], [499, -406, 0], [499, -60], [494, -30, 0]], red);
  sh.push(body, F(rect(-510, -70, 1010, 40), tone(red, "shade"), 0.35, body.path), L([[-480, -436], [470, -436]], tone(red, "light"), 2.4, 0.55));
  sh.push(S(rect(-510, -48, 1010, 18), DARK, { clip: body.path }), F(rect(-510, -238, 1010, 12), CREAM, 1, body.path), F(rect(-510, -226, 1010, 3), tone(red, "deep"), 0.7, body.path));
  // the open rear platform, its pole and the step
  sh.push(S(rect(-498, -222, 84, 186), "#3A2E2C"), F(rect(-498, -222, 14, 186), "#000000", 0.25), R([[-452, -222], [-452, -36]], "#E6B52E", 3.4), R([[-500, -150], [-414, -150]], "#E6B52E", 2.4, { opacity: 0.9 }), S(rect(-502, -36, 90, 8), STEEL));
  // lower windows and the driver's cab, upper windows
  for (let i = 0; i < 7; i++) pane(sh, glow, r, -392 + i * 118, -214, 108, 88, 0.5, 1.2);
  pane(sh, glow, r, 442, -214, 46, 90, 0.9, 1.1, [4, 12, 3, 3]);
  for (let i = 0; i < 8; i++) pane(sh, glow, r, -472 + i * 115, -386, 105, 92, 0.5, 1.3, [6, 6, 3, 3]);
  pane(sh, glow, r, 448, -386, 42, 92, 0.2, 1.2, [6, 14, 3, 3]);
  // the advert panel under the windows, mudguards, lights, the mirror
  sh.push(S(rrect(-384, -114, 690, 44, 3), "#E8D7B0"), F(rect(-384, -92, 690, 14), tone("#E8D7B0", "shade"), 0.5), F(rect(-368, -108, 120, 32), red, 0.85), F(rect(-232, -108, 60, 32), "#2E5E8C", 0.8), F(rect(-150, -108, 440, 8), tone(red, "deep"), 0.45));
  sh.push(S(rrect(-470, -438, 16, 8, 3), DARK), S(ellipse(494, -76, 14, 18), "#F4F1E0"), S(ellipse(494, -76, 8, 10), "#FFFFFF", { flat: true }), P([[-500, -110, 0], [-508, -110, 0], [-508, -78, 0], [-500, -78, 0]], "#B3261E"), R([[492, -190], [512, -214], [512, -240]], DARK, 2.4));
  glow.push(S(ellipse(496, -76, 17, 22), "#FFF3C4", { flat: true }), S(ellipse(-502, -94, 9, 18), "#FF4A3A", { flat: true }));
  for (const x of [-300, 290]) sh.push(...tyre(x, 48));
  // the destination box
  sh.push(S(rrect(300, -430, 186, 34, 3), "#15171A"));
  const text: TextSpec[] = [{ text: `${str(p.route, "73")}  ${str(p.dest, "Oxford Circus")}`, x: 306, y: -427, w: 174, h: 26, size: 19, color: "#FFC84A", font: "print", weight: 700, lang: "en", lit: 0 }];
  return flatOf(p, "double_decker", sh, glow, text, 1.8, RUMBLE);
}, meta: {
  about: "A London double-decker bus (a Routemaster), side on: red, two decks of windows with riders lit at night, the open rear platform, the destination box; it can drive along a path.",
  params: {
    dir: DIR,
    color: { type: "color", about: "its paint (a palette id or a hex); default London red" },
    route: { type: "text", default: "73", about: "the route number on the destination box" },
    dest: { type: "text", default: "Oxford Circus", about: "the destination on the box" },
    ...GO,
  },
  terms: ["a1-w-otobus"],
  tags: ["vehicle", "bus", "city"],
} };

// ---- city bus ------------------------------------------------------------------------------------

const BUS_COLORS = ["#2E6DA4", "#D4A017", "#B3261E", "#3E7A3A", "#7A3E6E"];
/**
 * A city bus, 1150 cm long, side on: a painted body with a white roof and a stripe, a band of windows with faceless
 * riders (lit at night), a front door and a middle door of glass, the windscreen and the destination sign at the
 * front (`route`, `dest`, text), headlamps and a mirror. In `color` (default a seeded city colour).
 */
const city_bus: PieceDef = { draw(p, r) {
  const c = hex(p.color, r.pick(BUS_COLORS)), sh: Shape[] = [], glow: Shape[] = [];
  const body = P([[-575, -30, 0], [-575, -318, 0], [-565, -328, 0], [540, -328, 0], [566, -310, 0], [575, -240, 0], [575, -30, 0]], c);
  sh.push(body, F(rect(-580, -70, 1160, 40), tone(c, "shade"), 0.35, body.path), F(rect(-580, -330, 1160, 36), WHITE, 1, body.path), F(rect(-580, -296, 1160, 3), tone(c, "deep"), 0.6, body.path), F(rect(-580, -112, 1160, 20), WHITE, 0.92, body.path), F(rect(-580, -92, 1160, 4), tone(c, "deep"), 0.5, body.path));
  sh.push(S(rect(-580, -46, 1160, 16), DARK, { clip: body.path }));
  // windows, and the two doors
  for (const x of [-545, -437, -329, -105, 3, 111, 219]) pane(sh, glow, r, x, -268, 100, 96, 0.55, 1.25, 5);
  for (const [x, w] of [[-212, 84], [326, 84]] as const) {
    sh.push(S(rrect(x - 4, -272, w + 8, 244, 3), DARK), S(rrect(x, -268, w / 2 - 2, 234, 2), GLASS), S(rrect(x + w / 2 + 2, -268, w / 2 - 2, 234, 2), GLASS), F(poly([[x + 6, -40], [x + 16, -268], [x + 26, -268], [x + 16, -40]]), "#FFFFFF", 0.16));
    glow.push(S(rrect(x, -268, w, 234, 2), "#FFE6B0", { flat: true, opacity: 0.7 }));
  }
  pane(sh, glow, r, 424, -268, 142, 112, 0.9, 1.3, [4, 20, 3, 3]);
  sh.push(S(rrect(-20, -80, 44, 6, 2), DARK, { opacity: 0.0 }));
  // the destination sign, lights, mirror
  sh.push(S(rrect(404, -322, 160, 24, 3), "#15171A"), S(ellipse(570, -76, 12, 15), "#F4F1E0"), P([[-575, -128, 0], [-582, -128, 0], [-582, -86, 0], [-575, -86, 0]], "#B3261E"), R([[566, -222], [590, -246], [590, -272]], DARK, 2.6));
  glow.push(S(ellipse(572, -76, 15, 19), "#FFF3C4", { flat: true }), S(ellipse(-578, -108, 8, 18), "#FF4A3A", { flat: true }), S(rrect(404, -322, 160, 24, 3), "#FFB020", { flat: true, opacity: 0.5 }));
  for (const x of [-350, 380]) sh.push(...tyre(x, 52));
  const text: TextSpec[] = [{ text: `${str(p.route, "42")}  ${str(p.dest, "City Centre")}`, x: 410, y: -320, w: 148, h: 20, size: 15, color: "#FFC84A", font: "print", weight: 700, lang: "en", lit: 0 }];
  return flatOf(p, "city_bus", sh, glow, text, 1.6, RUMBLE);
}, meta: {
  about: "A city bus, side on: painted body, white roof, windows with riders lit at night, a front and a middle door, the destination sign; it can drive along a path.",
  params: {
    dir: DIR,
    color: { type: "color", about: "its paint (a palette id or a hex); default a seeded city colour" },
    route: { type: "text", default: "42", about: "the route number on the sign" },
    dest: { type: "text", default: "City Centre", about: "the destination on the sign" },
    ...GO,
  },
  terms: ["a1-w-otobus", "a1-w-durak"],
  tags: ["vehicle", "bus", "city"],
} };

// ---- train -------------------------------------------------------------------------------------

/**
 * A train side on, `cars` coupled cars with the head car at the front (right): `regional`, a white train with a painted
 * band, passenger doors and a blunt cab; or `high_speed`, a long streamlined nose, a dark window strip with a stripe
 * and a pantograph on the roof. The head car carries its line (`line`, text). Faceless riders in the windows, lit at night.
 */
const train: PieceDef = { draw(p, r) {
  const hs = str(p.kind, "regional") === "high_speed", cars = Math.max(1, Math.min(4, Math.round(num(p.cars, 2)))), CL = hs ? 1000 : 900, gap = 16;
  const c = hex(p.color, hs ? "#B3261E" : "#2E5E8C"), tot = cars * CL + (cars - 1) * gap, sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  for (let i = 0; i < cars; i++) {
    const x0 = -tot / 2 + i * (CL + gap), x1 = x0 + CL, head = i === cars - 1;
    const nose: Pt[] = hs
      ? [[x0, -64, 0], [x0, -360, 0], [x0 + 12, -372, 0], [x1 - 400, -372, 0], [x1 - 260, -354], [x1 - 120, -302], [x1 - 34, -222], [x1, -150], [x1, -104], [x1 - 36, -78], [x1 - 100, -64, 0]]
      : [[x0, -64, 0], [x0, -358, 0], [x0 + 12, -370, 0], [x1 - 70, -370, 0], [x1 - 18, -330], [x1, -240], [x1, -90], [x1 - 10, -64, 0]];
    const body = head ? P(nose, hs ? WHITE : WHITE) : P([[x0, -64, 0], [x0, -358, 0], [x0 + 12, -370, 0], [x1 - 12, -370, 0], [x1, -358, 0], [x1, -64, 0]], WHITE);
    const cut = body.path;
    sh.push(S(rect(x0 - 4, -62, CL + 8, 16), DARK), body);
    if (hs) sh.push(F(rect(x0 - 2, -140, CL + 4, 8), c, 1, cut), F(rect(x0 - 2, -132, CL + 4, 3), tone(c, "deep"), 0.7, cut), F(rect(x0 - 2, -70, CL + 4, 28), tone(WHITE, "shade"), 0.55, cut), F(rect(x0 - 2, -372, CL + 4, 22), tone(WHITE, "shade"), 0.5, cut));
    else sh.push(F(rect(x0 - 2, -190, CL + 4, 118), c, 1, cut), F(rect(x0 - 2, -190, CL + 4, 4), tone(c, "deep"), 0.7, cut), F(rect(x0 - 2, -372, CL + 4, 20), tone(WHITE, "shade"), 0.5, cut), F(rect(x0 - 2, -340, CL + 4, 4), c, 0.8, cut));
    // doors, then the windows between them
    const doors = (head && hs ? [x0 + CL * 0.1, x0 + CL * 0.4] : [x0 + CL * 0.2, x0 + CL * 0.8 - 80]).map(x => x - 4);
    for (const d of doors) {
      sh.push(S(rrect(d - 3, -342, 90, 276, 4), DARK), S(rrect(d, -338, 38, 270, 3), c), S(rrect(d + 44, -338, 38, 270, 3), c), S(rrect(d + 5, -326, 28, 118, 3), GLASS), S(rrect(d + 49, -326, 28, 118, 3), GLASS), F(rect(d + 40, -338, 4, 270), DARK, 0.7));
      glow.push(S(rrect(d + 5, -326, 28, 118, 3), "#FFE6B0", { flat: true, opacity: 0.8 }), S(rrect(d + 49, -326, 28, 118, 3), "#FFE6B0", { flat: true, opacity: 0.8 }));
    }
    const cab = head ? (hs ? 330 : 90) : 0;
    for (let x = x0 + 34; x + 88 < x1 - 24 - cab; x += 104) {
      if (doors.some(d => x + 88 > d - 14 && x < d + 104)) continue;
      if (hs) { sh.push(S(rrect(x, -306, 88, 62, 8), GLASS)); if (r.chance(0.6)) sh.push(...rider(r, x + 44 + r.range(-18, 18), -242, 1.0).map(s => ({ ...s, clip: rrect(x, -306, 88, 62, 8) }))); glow.push(S(rrect(x, -306, 88, 62, 8), "#FFE6B0", { flat: true, opacity: 0.8 })); }
      else pane(sh, glow, r, x, -320, 88, 96, 0.55, 1.2, [8, 8, 3, 3]);
    }
    if (head) {
      const sc = hs ? poly([[x1 - 330, -358], [x1 - 250, -346], [x1 - 130, -296], [x1 - 74, -236], [x1 - 330, -236]]) : rrect(x1 - 74, -320, 52, 108, [6, 18, 3, 3]);
      sh.push(S(sc, GLASS), F(poly([[x1 - 270, -250], [x1 - 250, -336], [x1 - 232, -336], [x1 - 252, -250]]), "#FFFFFF", 0.14, sc));
      sh.push(S(ellipse(x1 - (hs ? 12 : 12), hs ? -128 : -110, 9, 11), "#F4F1E0"), F(rect(x1 - (hs ? 30 : 20), hs ? -96 : -84, 28, 6), "#8E979E", 0.8));
      glow.push(S(ellipse(x1 - 8, hs ? -128 : -110, 14, 16), "#FFF3C4", { flat: true }));
      text.push({ text: str(p.line, hs ? "HS 9" : "RE 7"), x: x0 + 180, y: hs ? -366 : -362, w: 160, h: hs ? 26 : 22, size: 18, color: "#2B2420", font: "print", weight: 800, lang: "en" });
    } else if (i === 0) {
      sh.push(P([[x0 - 3, -130, 0], [x0 - 10, -130, 0], [x0 - 10, -100, 0], [x0 - 3, -100, 0]], "#B3261E"));
      glow.push(S(ellipse(x0 - 4, -115, 8, 16), "#FF4A3A", { flat: true }));
    }
    // the roof gear, the gangway, the bogies
    sh.push(S(rrect(x0 + 80, -386, CL - (head ? hs ? 520 : 200 : 160), 16, 6), "#9AA2A8"));
    if (hs && i === Math.max(0, cars - 2)) sh.push(S(rect(x0 + 360, -392, 90, 8), DARK), L([[x0 + 380, -392], [x0 + 420, -440], [x0 + 400, -480]], "#3B3F45", 3.4, 1), L([[x0 + 430, -392], [x0 + 420, -440]], "#3B3F45", 2.4, 1), S(rect(x0 + 372, -484, 60, 5), "#3B3F45"));
    if (i < cars - 1) sh.push(S(rect(x1 - 2, -330, gap + 4, 262), "#20242A"), S(rect(x1 - 2, -352, gap + 4, 22), "#3A3F45"));
    for (const b of [x0 + 160, x1 - 160]) sh.push(S(rect(b - 72, -66, 144, 14), "#3B3F45"), ...[-44, 44].flatMap(d => [S(ellipse(b + d, -38, 38), TYRE), S(ellipse(b + d, -38, 26), "#6E757B"), F(ellipse(b + d, -38, 7), DARK, 0.7)]));
  }
  return flatOf(p, "train", sh, glow, text, Math.min(1.6, 1900 / (tot + 60)), { rot: 0.0006, dy: 0.5, ms: 700 });
}, variants: { regional: { kind: "regional" }, high_speed: { kind: "high_speed" } },
  meta: {
    about: "A train side on: a regional (white with a painted band, doors and a blunt cab) or a high-speed one (a long streamlined nose, a window strip, a pantograph), coupled cars, riders lit at night; it can run along a path.",
    params: {
      kind: { type: "enum", values: ["regional", "high_speed"], default: "regional" },
      cars: { type: "int", min: 1, max: 4, default: 2, about: "coupled cars, the head car at the front" },
      dir: DIR,
      color: { type: "color", about: "the band or stripe (a palette id or a hex); default blue for a regional, red for a high-speed" },
      line: { type: "text", about: "the line on the head car; default RE 7 or HS 9" },
      ...GO,
    },
    terms: ["a1-w-tren", "a1-w-istasyon"],
    tags: ["train", "vehicle", "rail", "station"],
  } };

// ---- black cab -----------------------------------------------------------------------------------

/**
 * A London black cab, 440 cm long, side on: tall rounded black body, the big passenger window with a faceless rider, a
 * driver's window, the lit roof sign (`sign`, default "TAXI") and the plate (`plate`, text). Lamps glow at night.
 */
const black_cab: PieceDef = { draw(p, r) {
  const c = hex(p.color, "#1E2023"), sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  const body = P([[-215, -26, 0], [-219, -90], [-206, -146], [-164, -178], [-100, -183], [56, -183], [80, -170], [112, -112, 0], [170, -100], [206, -84], [215, -54], [211, -26, 0]], c);
  sh.push(body, F(rect(-230, -60, 460, 34), tone(c, "shade"), 0.5, body.path), L([[-190, -150], [-120, -172], [50, -176]], tone(c, "light"), 2.4, 0.55), S(rect(-224, -46, 22, 12), STEEL, { clip: body.path }), S(rect(194, -46, 30, 12), STEEL, { clip: body.path }));
  const rear = rrect(-176, -168, 168, 66, [10, 3, 3, 3]), front = P([[10, -168, 0], [52, -168], [64, -162], [92, -114, 0], [10, -114, 0]], GLASS);
  sh.push(S(rear, GLASS), front, F(poly([[-150, -102], [-132, -168], [-114, -168], [-132, -102]]), "#FFFFFF", 0.16, rear));
  sh.push(...rider(r, -92, -100, 1.15).map(s => ({ ...s, clip: rear })), S(rect(-8, -170, 16, 70), c), L([[-30, -92], [-30, -30]], tone(c, "deep"), 1.2, 0.7), L([[100, -100], [100, -30]], tone(c, "deep"), 1.2, 0.7));
  sh.push(S(rrect(-152, -86, 22, 5, 2), STEEL), S(rrect(20, -86, 22, 5, 2), STEEL), S(ellipse(198, -66, 11, 12), "#F4F1E0"), P([[-217, -74, 0], [-206, -77, 0], [-206, -58, 0], [-217, -56, 0]], "#B3261E"), lines([[[170, -80], [196, -78]], [[168, -72], [196, -70]], [[168, -64], [196, -62]]], STEEL, 1.4, 0.9));
  sh.push(S(rrect(-224, -56, 40, 11, 1), "#F2C230"));
  sh.push(S(rrect(-34, -203, 68, 22, 4), CREAM), S(rect(-24, -184, 48, 3), DARK));
  glow.push(S(rrect(-38, -207, 76, 30, 8), "#FFF3C4", { flat: true, opacity: 0.8 }), S(ellipse(202, -66, 16, 14), "#FFF3C4", { flat: true }), S(ellipse(-214, -66, 9, 12), "#FF4A3A", { flat: true }));
  for (const x of [-135, 142]) sh.push(...tyre(x, 30));
  text.push({ text: str(p.sign, "TAXI"), x: -30, y: -201, w: 60, h: 17, size: 12, color: "#2B2420", font: "print", weight: 800, lang: "en", lit: 0 });
  const plate = str(p.plate, `${r.pick(["LK", "BX", "MN", "YT"])}${r.int(10, 69)} ${r.pick(["KXT", "HRC", "WDB"])}`);
  text.push({ text: plate, x: -222, y: -54.5, w: 36, h: 8, size: 6, color: "#1E1E20", font: "print", weight: 700, lang: "en" });
  return flatOf(p, "black_cab", sh, glow, text, 2.4, RUMBLE);
}, meta: {
  about: "A London black cab side on: tall black body, the passenger window with a rider, the lit TAXI sign, the plate as text; it can drive along a path.",
  params: {
    dir: DIR,
    color: { type: "color", about: "its paint (a palette id or a hex); default black" },
    sign: { type: "text", default: "TAXI", about: "the roof sign" },
    plate: { type: "text", about: "default a seeded British plate" },
    ...GO,
  },
  terms: ["a1-w-taksi"],
  tags: ["vehicle", "city", "taxi"],
} };

// ---- boats -------------------------------------------------------------------------------------

/** A faceless gondolier standing at the stern, `x` cm, in a striped shirt and a straw hat, with the oar. */
function gondolier(x: number, y: number): Shape[] {
  const body = rrect(x - 11, y - 108, 22, 56, [8, 8, 2, 2]), shirt = rect(x - 12, y - 110, 24, 60);
  const stripes = Array.from({ length: 6 }, (_, i) => F(rect(x - 12, y - 106 + i * 9, 24, 4), "#D8DFE6", 1, body));
  return [
    R([[x - 4, y - 52], [x - 5, y]], "#1F2A44", 6.5), R([[x + 5, y - 52], [x + 6, y]], "#1F2A44", 6.5),
    S(body, "#2E4A8A"), ...stripes, F(shirt, tone("#2E4A8A", "shade"), 0.22, body),
    S(ellipse(x, y - 123, 9, 10.5), "#E8B98F"), S(ellipse(x, y - 134, 15, 3.4), "#E8D49A"), S(rrect(x - 8, y - 141, 16, 8, [6, 6, 0, 0]), "#E8D49A"), F(rect(x - 8, y - 136, 16, 2.4), "#B3261E"),
    R([[x + 8, y - 96], [x - 16, y - 70]], "#E8B98F", 5), R([[x + 8, y - 96], [x + 26, y - 80]], "#E8B98F", 5),
  ];
}
/**
 * A Venetian gondola, 1100 cm long, side on, black and low with its stern and prow curling up: the steel ferro at the prow,
 * the carved oarlock, a red velvet seat with gold trim and, by default, the gondolier at the stern with his oar. It floats
 * on y = 0 and rocks on the water (the water itself is a piece of the place); it can glide along `go`.
 */
const gondola: PieceDef = { draw(p, r) {
  const c = hex(p.color, "#1B1C20"), sh: Shape[] = [], velvet = "#8E1B2A", gold = "#D9B25A";
  const hull = P([[-548, -66, 0], [-510, -40], [-380, -30], [0, -27], [380, -30], [496, -44], [558, -94, 0], [546, -88, 0], [520, -50], [470, -14], [300, -2], [0, 0], [-300, -2], [-476, -12], [-536, -44]], c);
  sh.push(hull, F(rect(-560, -30, 1120, 4), gold, 0.7, hull.path), F(rect(-560, -18, 1120, 18), tone(c, "shade"), 0.5, hull.path), L([[-490, -42], [-300, -30], [0, -27], [300, -30], [440, -42]], tone(c, "light"), 1.6, 0.5));
  // the ferro, the comb on the prow
  const f: Pt[] = [[544, -88, 0], [548, -140], [560, -170], [566, -160], [562, -150], [568, -140], [563, -130], [569, -120], [563, -110], [568, -100], [558, -90, 0]];
  sh.push(P(f, "#C3C9CE"), F(poly([[549, -100], [553, -150], [557, -150], [553, -100]]), "#FFFFFF", 0.35));
  // the oarlock at the stern, the seat
  sh.push(R([[-430, -34], [-432, -70], [-420, -86], [-410, -78], [-418, -66], [-414, -34]], "#7A4B2A", 4.2));
  sh.push(S(rrect(-110, -54, 150, 24, 4), velvet), S(rrect(-122, -86, 24, 56, [8, 8, 2, 2]), velvet), F(ellipse(-110, -76, 3, 11), tone(velvet, "light"), 0.45), L([[-118, -62], [-118, -36]], gold, 1.2, 0.9), F(rect(-110, -54, 150, 3), gold, 0.9), ...[0, 1].map(i => S(ellipse(-60 + i * 56, -62, 17, 9), tone(velvet, "light"))));
  sh.push(R([[-60, -30], [-60, -22]], gold, 1), R([[40, -34], [40, -27]], gold, 1));
  if (p.gondolier !== false) sh.push(...gondolier(-384, -32), R([[-396, -96], [-440, -66], [-500, -14], [-532, 14]], "#7A4B2A", 3.2), P([[-544, 18, 0], [-526, 12, 0], [-518, 6], [-532, 22]], "#7A4B2A"));
  sh.push(lines([[[-540, -3], [-360, -4]], [[-250, -3], [-80, -4]], [[120, -3], [330, -4]], [[430, -3], [520, -5]]], "#CFE6EE", 1.2, 0.55));
  return flatOf(p, "gondola", sh, [], [], 1.7, ROCK);
}, meta: {
  about: "A Venetian gondola side on: black, low, the steel ferro at the prow, a red velvet seat, the gondolier at the stern with his oar; it rocks on the water and can glide along a path.",
  params: {
    dir: DIR,
    color: { type: "color", about: "the hull (a palette id or a hex); default black" },
    gondolier: { type: "bool", default: true, about: "the gondolier standing at the stern" },
    ...GO,
  },
  terms: ["a2-w-gondol", "a2-w-nehir"],
  tags: ["vehicle", "boat", "water", "canal"],
} };

/**
 * A boat on a canal, side on, afloat on y = 0, rocking on the water: `tour`, an Amsterdam canal tour boat 1200 cm long
 * with a glass roof, rows of faceless passengers (lit at night) and its `name` on the hull; or `narrow`, a British
 * narrowboat, 900 cm, painted, with a chimney, round-topped windows, pots of flowers on the roof and a tiller.
 * It can glide along `go`.
 */
const canal_boat: PieceDef = { draw(p, r) {
  const narrow = str(p.kind, "tour") === "narrow", sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  if (!narrow) {
    const c = hex(p.color, "#D6E1E6"), hull = P([[-600, -46, 0], [-596, -6], [-540, 0], [440, 0], [540, -14], [604, -52, 0], [590, -56, 0], [-590, -56, 0]], c);
    sh.push(hull, F(rect(-610, -40, 1220, 8), "#1F3A5F", 1, hull.path), F(rect(-610, -12, 1220, 12), "#1F3A5F", 1, hull.path), F(rect(-610, -56, 1220, 6), "#1F3A5F", 1, hull.path));
    // the glass roof with its ribs, the benches and riders under it
    const roof = P([[-560, -58, 0], [-556, -150], [-500, -176], [380, -176], [470, -150], [520, -58, 0]], "#9FB8C6", { opacity: 0.3 });
    sh.push(S(roof.path, "#566873", { opacity: 0.55 }), roof, F(rect(-560, -62, 1080, 10), tone(c, "shade"), 0.8));
    for (let i = 0; i < 9; i++) { const x = -520 + i * 118; sh.push(S(rrect(x, -108, 74, 50, 6), "#5B3A29", { clip: roof.path, opacity: 0.0 })); if (r.chance(0.7)) sh.push(...rider(r, x + 36, -62, 1.05).map(s => ({ ...s, clip: roof.path }))); }
    glow.push(S(poly([[-550, -62], [-546, -146], [-496, -170], [370, -170], [460, -146], [512, -62]]), "#FFE6B0", { flat: true, opacity: 0.55 }));
    sh.push(F(poly([[-420, -62], [-380, -172], [-350, -172], [-390, -62]]), "#FFFFFF", 0.14), F(poly([[60, -62], [100, -172], [130, -172], [90, -62]]), "#FFFFFF", 0.12));
    for (let i = 0; i < 11; i++) sh.push(L([[-540 + i * 100, -60], [-540 + i * 100 + 8, -172 + Math.abs(i - 5) * 3]], c, 2.4, 0.9));
    sh.push(R([[-560, -176], [440, -176]], c, 4), S(rect(500, -86, 5, 30), STEEL), S(ellipse(502, -90, 6, 4), "#C8283A"), R([[-600, -56], [-600, -120]], STEEL, 2.4), F(poly([[-600, -118], [-568, -110], [-600, -102]]), "#E8A33A"));
    text.push({ text: str(p.name, "Prinsengracht"), x: -420, y: -34, w: 460, h: 18, size: 14, color: "#F4F2EE", font: "print", weight: 700, lang: "en" });
    return flatOf(p, "canal_boat", sh, glow, text, 1.6, ROCK);
  }
  const c = hex(p.color, "#2F5D50"), acc = "#C8283A", hull = P([[-450, -52, 0], [-446, -8], [-400, 0], [380, 0], [430, -10], [462, -52, 0]], c);
  sh.push(hull, F(rect(-460, -34, 920, 5), "#E6B52E", 1, hull.path), F(rect(-460, -14, 920, 14), tone(c, "shade"), 0.5, hull.path), S(rrect(-466, -54, 936, 8, 3), "#3A2E2C"));
  const cab = rrect(-330, -118, 600, 66, [6, 6, 2, 2]);
  sh.push(S(cab, tone(c, "light")), F(rect(-330, -80, 600, 4), acc, 1, cab), F(rect(-330, -58, 600, 6), tone(c, "deep"), 0.6, cab));
  for (let i = 0; i < 5; i++) { const x = -300 + i * 112, o = rrect(x, -108, 74, 34, [14, 14, 2, 2]); sh.push(S(o, GLASS), F(poly([[x + 12, -76], [x + 22, -108], [x + 32, -108], [x + 22, -76]]), "#FFFFFF", 0.2, o)); if (r.chance(0.4)) sh.push(...rider(r, x + 37, -74, 0.8).map(s => ({ ...s, clip: o }))); glow.push(S(o, "#FFE6B0", { flat: true, opacity: 0.85 })); }
  sh.push(S(rrect(-336, -124, 612, 8, 3), "#3A2E2C"), S(rect(150, -156, 16, 34), "#3A2E2C"), S(rrect(144, -164, 28, 10, 3), "#2B2F33"), R([[-210, -124], [-210, -128]], STEEL, 1));
  for (const [x, col] of [[-250, "#C8283A"], [-170, "#E0A83A"], [-90, "#7A3E6E"]] as const) sh.push(S(rrect(x - 16, -144, 32, 20, 3), "#B8704A"), ...[-8, 0, 8].map((d, j) => S(ellipse(x + d, -154 - (j % 2) * 4, 8), col)), ...[-8, 0, 8].map(d => F(ellipse(x + d, -154, 2.6), "#F2C230", 0.9)));
  sh.push(R([[-440, -60], [-460, -92], [-440, -112]], "#3A2E2C", 4.4), S(rrect(-336, -122, 614, 4, 2), acc, { opacity: 0.0 }));
  text.push({ text: str(p.name, "Blue Heron"), x: -300, y: -50, w: 440, h: 22, size: 17, color: "#F4E6B8", font: "hand", weight: 700, lang: "en" });
  return flatOf(p, "canal_boat", sh, glow, text, 1.9, ROCK);
}, variants: { tour: { kind: "tour" }, narrow: { kind: "narrow" } },
  meta: {
    about: "A canal boat side on: an Amsterdam glass-roofed tour boat with passengers, or a British narrowboat with a chimney and flower pots; it rocks on the water and can glide along a path.",
    params: {
      kind: { type: "enum", values: ["tour", "narrow"], default: "tour" },
      dir: DIR,
      color: { type: "color", about: "the hull (a palette id or a hex); default cream for a tour boat, green for a narrowboat" },
      name: { type: "text", about: "the boat's name on its side; default Prinsengracht or Blue Heron" },
      ...GO,
    },
    terms: ["a2-w-kanal", "a1-w-tekne"],
    tags: ["vehicle", "boat", "water", "canal"],
  } };

// ---- bike --------------------------------------------------------------------------------------

/** What a kind of bike is: the wheel size and wheelbase, the head tube, the grip and the saddle, and its default colour. */
interface Geo { rear: number; front: number; r: number; bb: [number, number]; seat: [number, number]; ht: [number, number]; grip: [number, number]; c: string }
const BIKES: Record<string, Geo> = {
  dutch: { rear: -57, front: 57, r: 34, bb: [-6, -28], seat: [-24, -96], ht: [46, -88], grip: [34, -108], c: "#27323A" },
  cargo: { rear: -85, front: 113, r: 31, bb: [-30, -27], seat: [-48, -92], ht: [58, -84], grip: [48, -102], c: "#3E7A5C" },
  city: { rear: -56, front: 56, r: 34, bb: [-6, -28], seat: [-22, -98], ht: [44, -90], grip: [48, -104], c: "#2F7FB5" },
};
/** A wheel at (x, r above the ground): tyre, rim, spokes, hub. */
function bikeWheel(x: number, r: number): Shape[] {
  const cy = -r, sp: [number, number][][] = Array.from({ length: 12 }, (_, i) => [[x, cy], [x + Math.cos(i * 0.5236) * (r - 3.4), cy + Math.sin(i * 0.5236) * (r - 3.4)]]);
  return [ring(x, cy, r, 3.4, TYRE), { path: ellipse(x, cy, r - 3.8), stroke: { color: STEEL, width: 1 }, flat: true, opacity: 0.95 }, lines(sp, "#D5DADE", 0.3, 0.7), F(ellipse(x, cy, 2.8), "#8E979E"), F(ellipse(x, cy, 1.2), DARK, 0.8)];
}
function bikeArt(kind: string, c: string, basket: boolean, r: Rng, stand: boolean): Shape[] {
  const g = BIKES[kind], cargo = kind === "cargo", dutch = kind === "dutch", [bx, by] = g.bb, [sx, sy] = g.seat, [hx, hy] = g.ht, [gx, gy] = g.grip, rw = g.rear, fw = g.front, cy = -g.r;
  const sh: Shape[] = [];
  if (stand) sh.push(R([[rw + 10, -26], [rw + 22, 0]], DARK, 1.8));
  sh.push(...bikeWheel(rw, g.r), ...bikeWheel(fw, g.r));
  // mudguards on the dutch and the cargo bike
  if (dutch || cargo) for (const w of [rw, fw]) sh.push({ path: smooth([[w - g.r - 3, cy + 6], [w - g.r * 0.7, cy - g.r * 0.9], [w, cy - g.r - 3.4], [w + g.r * 0.7, cy - g.r * 0.9], [w + g.r + 2, cy + 4]], false, 1), stroke: { color: c, width: 2.2, cap: "round" } });
  const tube = 3.2;
  // the frame
  if (cargo) sh.push(R([[rw, cy], [bx, by], [bx + 40, by + 4], [bx + 90, cy + 8]], c, tube), R([[bx + 90, cy + 8], [hx, hy + 10]], c, tube), R([[rw, cy], [sx, sy]], c, 2.4), R([[bx, by], [sx, sy]], c, tube));
  else if (dutch) sh.push(R([[rw, cy], [bx, by]], c, 2.6), R([[rw, cy], [sx, sy + 4]], c, 2.4), R([[bx, by], [sx, sy]], c, tube), R([[hx, hy], [hx - 10, hy + 32], [bx + 8, by + 6], [bx, by]], c, tube + 0.6));
  else sh.push(R([[rw, cy], [bx, by]], c, 2.6), R([[rw, cy], [sx, sy + 4]], c, 2.4), R([[bx, by], [sx, sy]], c, tube), R([[sx, sy + 3], [hx, hy]], c, tube), R([[bx, by], [hx - 4, hy + 8]], c, tube + 0.4));
  // the fork, steerer, stem and handlebar
  sh.push(R([[fw, cy], [hx + 5, hy + 12], [hx + 2, hy]], c, 2.8), R([[hx + 2, hy], [hx - 1, hy - 8], [gx - (dutch ? 5 : 0), gy + 6]], STEEL, 2), R([[gx - (dutch ? 12 : 0), gy + (dutch ? 3 : 4)], [gx, gy - 1], [gx + (dutch ? -3 : 8), gy - (dutch ? 0 : 1)]], dutch ? STEEL : DARK, 2.2), R([[gx + (dutch ? -3 : 6), gy], [gx + (dutch ? 6 : 10), gy + (dutch ? 4 : 2)]], "#4A3B2E", 3.4));
  sh.push(S(ellipse(gx - 1, gy + 6.4, 2.4), STEEL), S(ellipse(hx + 12, hy + 6, 3.4, 3), "#F4F1E0"));
  // the saddle and post, the cranks and chain
  sh.push(R([[sx, sy], [sx - 2, sy - 7]], STEEL, 2.4), S(rrect(sx - 12, sy - 11, 24, 6, [3, 5, 3, 3]), dutch ? "#7A4B2A" : "#2B2420"), R([[bx, by], [bx + 9, by + 11]], DARK, 2), S(rrect(bx + 4, by + 10, 10, 3, 1.4), DARK));
  sh.push({ path: ellipse(bx, by, 9), stroke: { color: "#8E979E", width: 1.4 }, flat: true });
  if (dutch) sh.push(S(rrect(bx - 20, by - 9, 40, 14, 7), tone(c, "light"), { opacity: 0.9 }), F(ellipse(bx - 8, by - 4, 5), "#FFFFFF", 0.2));
  else sh.push(L([[rw, cy], [bx, by + 9], [bx, by - 9], [rw, cy - 3]], DARK, 1.2, 0.9));
  // rack, basket, box
  if (dutch) sh.push(S(rrect(rw - 22, cy - g.r - 12, 36, 4, 1.6), DARK), R([[rw - 4, cy - g.r - 8], [sx - 4, sy + 8]], DARK, 1.6), S(rrect(rw + 20, cy - g.r + 2, 6, 14, 2), "#B3261E", { opacity: 0.0 }), S(rrect(rw - 15, cy - g.r - 1, 6, 5, 1.4), "#B3261E"));
  if (basket && !cargo) {
    const bw = 30, bk = P([[hx + 2, hy + 12, 0], [hx + 2 + bw, hy + 12, 0], [hx + 6 + bw, hy - 8, 0], [hx - 2, hy - 8, 0]], "#B58A52");
    sh.push(R([[hx + 2, hy + 14], [fw - 2, cy - 6]], DARK, 1.2), bk, lines([[[hx, hy - 2], [hx + bw + 4, hy - 2]], [[hx + 3, hy + 5], [hx + bw + 1, hy + 5]]], "#7A5A33", 0.9, 0.9), lines(Array.from({ length: 6 }, (_, i) => [[hx + 3 + i * 5.4, hy - 8], [hx + 3 + i * 5.4, hy + 12]] as [number, number][]), "#7A5A33", 0.7, 0.7), S(ellipse(hx + 12, hy - 10, 6, 4), "#4E7A48"), S(ellipse(hx + 21, hy - 11, 5, 5), "#E8B14A"));
  }
  if (cargo) {
    const x0 = bx + 56, x1 = fw + 4, box = P([[x0, -78, 0], [x1, -78, 0], [x1 - 6, -34, 0], [x0 + 4, -34, 0]], "#B58A52");
    sh.push(box, F(rect(x0, -44, x1 - x0, 2), tone("#B58A52", "shade"), 0.7, box.path), F(rect(x0, -78, x1 - x0, 3), tone("#B58A52", "light"), 0.6, box.path), lines([[[x0 + 4, -60], [x1 - 2, -60]]], "#7A5A33", 0.7, 0.6), S(rect(x0 + 14, -34, 6, 8), DARK), S(rect(x1 - 24, -34, 6, 8), DARK));
    for (const [i, kc] of [["a", "#E0A83A"], ["b", "#2E5E8C"]] as const) { const kx = x0 + 26 + (i === "a" ? 0 : 40); sh.push(S(rrect(kx - 12, -98, 24, 22, [8, 8, 0, 0]), kc), S(ellipse(kx, -108, 8.6, 9.2), r.pick(["#E8B98F", "#C98E62", "#8D5A3B"])), S(ellipse(kx, -113, 9.4, 6.4), kc), F(rect(kx - 9, -113, 18, 2), tone(kc, "deep"), 0.8)); }
    sh.push(S(rrect(x0 - 2, -80, x1 - x0 + 4, 5, 2), "#8F6A3B"));
  }
  return sh;
}
/**
 * A bike side on, facing right, wheels on the ground, 175 cm long (a cargo bike's longer): `dutch`, upright with a swept-back
 * handlebar, a chain guard, mudguards, a rack, an optional front basket and a bell; `cargo`, a bakfiets with a wooden box
 * between the handlebar and the front wheel and two small riders; or `city`, a diamond frame with flat bars. Held, its origin is
 * the grip and it is pushed by the bar, its wheels a hand's reach below. `n` in a row, like a rack.
 */
const bike: PieceDef = { draw(p, r) {
  const kind = Object.hasOwn(BIKES, str(p.kind, "")) ? str(p.kind, "") : "dutch", g = BIKES[kind], held = !!p.held, dir = num(p.dir, 1) < 0 ? -1 : 1, n = held ? 1 : Math.max(1, Math.min(8, Math.round(num(p.n, 1))));
  const c = hex(p.color, g.c), basket = p.basket === undefined ? kind === "dutch" : !!p.basket, sh: Shape[] = [], gap = kind === "cargo" ? 300 : 200;
  for (let i = 0; i < n; i++) sh.push(...fit(bikeArt(kind, c, basket, r, !held), 1, 1, (i - (n - 1) / 2) * gap - (held ? g.grip[0] : 0), held ? -g.grip[1] : 0));
  const ppcm = held ? 5 : Math.min(3, 1900 / (n * gap + 60)), mv = !held ? goes(p) : undefined;
  return { flats: [{ group: { shapes: fit(sh, 1, dir), edge: 0.5 }, ppcm, ...(held ? {} : { shadow: "drop" as const }), id: "bike", ...(mv ? { move: mv } : {}) }] };
}, variants: { dutch: { kind: "dutch" }, cargo: { kind: "cargo" }, city: { kind: "city" } },
  meta: {
    about: "A bike side on: a Dutch upright, a cargo bike (a bakfiets with a box and two small riders) or a city bike; standing in a row, or held and pushed by the bar.",
    params: {
      kind: { type: "enum", values: ["dutch", "cargo", "city"], default: "dutch" },
      dir: DIR,
      color: { type: "color", about: "the frame (a palette id or a hex); each kind has its own" },
      basket: { type: "bool", about: "a front basket; default on for a Dutch bike" },
      n: { type: "int", min: 1, max: 8, default: 1, about: "how many in a row, like a rack" },
      ...GO,
    },
    terms: ["a1-w-bisiklet"],
    tags: ["vehicle", "bike", "street", "city"],
  } };

// ---- vespa -------------------------------------------------------------------------------------

const VESPA = ["#8FBFA8", "#E9E1D2", "#C4553A", "#9CC3D5", "#E0B84A", "#D9A0A0"];
/**
 * A Vespa scooter, 175 cm long, side on: the rounded pastel body with its leg shield and flat floor, the engine cowl under a
 * long seat, the round headlamp on the handlebar, the front mudguard, chrome trim and the plate (`plate`, text). It
 * drives along `go`; its headlamp and tail lamp glow at night.
 */
const vespa: PieceDef = { draw(p, r) {
  const c = hex(p.color, r.pick(VESPA)), sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  const cowl = P([[-88, -26, 0], [-92, -50], [-84, -76], [-58, -86], [-24, -82], [-6, -64], [4, -38, 0], [-6, -26, 0]], c);
  const shield = P([[28, -24, 0], [36, -58], [46, -92], [54, -106, 0], [64, -102], [62, -84], [58, -50], [66, -24, 0]], c);
  const floor = P([[-6, -24, 0], [4, -32, 0], [34, -32, 0], [36, -24, 0]], tone(c, "shade"));
  sh.push(S(rrect(-12, -28, 48, 6, 2), DARK), floor, cowl, shield, F(rect(-100, -40, 110, 14), tone(c, "shade"), 0.4, cowl.path), F(ellipse(-48, -64, 22, 10), tone(c, "light"), 0.4, cowl.path), L([[-70, -60], [-20, -70]], tone(c, "deep"), 0.9, 0.5), F(rect(30, -60, 30, 32), tone(c, "shade"), 0.3, shield.path), L([[28, -30], [-4, -30]], STEEL, 1.6, 0.9));
  // seat, handlebar and headset, the mudguard, the exhaust, the stand
  sh.push(S(rrect(-82, -92, 66, 11, [6, 6, 3, 3]), "#3A2E2C"), F(rect(-76, -90, 50, 3), "#FFFFFF", 0.18), R([[58, -100], [44, -112], [26, -110]], STEEL, 2.2), S(rrect(20, -114, 12, 6, 3), "#2B2420"), S(rrect(52, -112, 18, 14, 5), tone(c, "deep")), S(ellipse(72, -102, 8, 9.5), "#F4F1E0"), F(ellipse(72, -102, 5, 6), "#FFFFFF", 0.7), R([[44, -112], [38, -130], [30, -134]], STEEL, 1.4), S(ellipse(29, -134, 4.4, 3), STEEL));
  const fen = P([[34, -46, 0], [48, -58], [78, -50], [96, -34, 0], [90, -30, 0], [60, -40], [36, -36]], c);
  sh.push(fen, L([[48, -57], [80, -49], [94, -34]], tone(c, "light"), 1.2, 0.6), S(rrect(-96, -34, 38, 8, 3), "#8E979E"), R([[-46, -30], [-20, -22]], DARK, 3));
  for (const [x, rr] of [[-52, 20], [64, 20]] as const) sh.push(S(ellipse(x, -rr, rr * 1.0), TYRE), S(ellipse(x, -rr, rr * 0.62), STEEL), F(ellipse(x, -rr, rr * 0.2), "#8E979E"), F(ellipse(x - 3, -rr - 8, 2.4), "#FFFFFF", 0.3));
  sh.push(R([[64, -20], [58, -44]], STEEL, 2.4), P([[-92, -52, 0], [-97, -52, 0], [-97, -42, 0], [-92, -42, 0]], "#B3261E"));
  sh.push(S(rrect(-96, -70, 22, 10, 1.4), "#F7F7F2"));
  glow.push(S(ellipse(74, -102, 13, 15), "#FFF3C4", { flat: true }), S(ellipse(-95, -47, 8, 9), "#FF4A3A", { flat: true }));
  text.push({ text: str(p.plate, `${r.pick(["RM", "MI", "TO", "NA"])} ${r.int(10000, 99999)}`), x: -96, y: -69.4, w: 22, h: 8, size: 5, color: "#1E1E20", font: "print", weight: 700, lang: "en" });
  return flatOf(p, "vespa", sh, glow, text, 3, { rot: 0.001, dy: 0.4, ms: 800 });
}, meta: {
  about: "A Vespa scooter side on: rounded pastel body, leg shield, long seat, round headlamp, chrome trim, the plate as text; it can drive along a path.",
  params: {
    dir: DIR,
    color: { type: "color", about: "its paint (a palette id or a hex); default a seeded pastel" },
    plate: { type: "text", about: "default a seeded Italian plate" },
    ...GO,
  },
  terms: ["a1-w-motosiklet"],
  tags: ["vehicle", "street", "city"],
} };

/** The family's set pieces and props (`index.ts`). The bike is a prop too, so a story can have someone push it. */
export const set: Record<string, PieceDef> = { double_decker, city_bus, train, black_cab, gondola, canal_boat, bike, vespa };
export const props: Record<string, PieceDef> = { bike };
