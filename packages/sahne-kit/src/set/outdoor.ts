// Set pieces for outdoors, following STYLE.md: crowds, birds and cats;
// then flags, railings, a park's edge, a church gate, the market, the pier, the sea, landmarks and skylines.
// Units cm, each flat's origin its bottom centre; moving flats carry `move` (FlatMotion). Crowds are faceless
// and never tapped (`pick: false`); everything reads frozen in reduced motion. Landmarks are stylised paper
// silhouettes drawn from description, never traced. Outdoor glow (windows, lamps, floodlights) is off the switch.

import { arcPoints, band, ellipse, groupBounds, mul, Path, poly, rect, rotate, rrect, rng, smooth, tone, translate, mix, type Affine, type FlatMotion, type FlatReact, type FlatSpec, type LightSpec, type PieceDef, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { hex, S, P, L, num, str, flip, holed, copies, ridge, goes, glowOnly, litByTurns, solidLine, type Pt, timetable, stopsParam } from "./draw.ts";
import { person, personFlats, type Pose } from "./people.ts";

/** Most people one crowd piece draws near the camera (DESIGN.md §12: atlas memory). */
export const CROWD_MAX = 24;
/** The times of day someone who is home by night is out. */
const NOT_NIGHT = ["dawn", "day", "golden", "overcast", "dusk"];

/** A strip of small far-off people, one period long, repeated from `lo` to `hi` (cm): heads and coats, muted. */
function farStrip(r: Rng, per: number, lo: number, hi: number, mute: number): Shape[] {
  const people: Shape[] = [], m = (c: string) => mix(c, "#A3ACB5", mute);
  for (let x = r.range(0, 30); x < per - 20; x += r.range(42, 80)) {
    const p = person(r), h = p.h * 0.95, t = m(p.top), hr = h * 0.075;
    people.push(S(rrect(x - h * 0.08, -h * 0.82, h * 0.16, h * 0.5, h * 0.05), t), S(ellipse(x, -h + hr, hr), m(p.skin)), S(ellipse(x - hr * 0.1, -h + hr * 0.7, hr * 1.02, hr * 0.7), p.head === "scarf" ? m(p.bag) : m(p.hair)));
    people.push({ path: smooth([[x - h * 0.03, -h * 0.34], [x - h * 0.05, -2]], false, 1), stroke: { color: tone(m(p.bottom), "shade"), width: h * 0.055, cap: "round" } }, { path: smooth([[x + h * 0.03, -h * 0.34], [x + h * 0.04, -2]], false, 1), stroke: { color: m(p.bottom), width: h * 0.055, cap: "round" } });
  }
  return people.map(s => ({ ...s, path: copies(s.path, per, lo, hi) }));
}

/**
 * A crowd, `kind`:
 * - `walk`: `n` people walking a lane from `x0` to `x1` (cm from the piece), both ways (`dir` 0) or one,
 *   at a stroll, each on their own seeded pace and start; the lane should reach past the frame, so they
 *   come and go;
 * - `stand`: `n` people in groups of two or three between `x0` and `x1`, turned to each other, shifting their weight;
 * - `queue`: `n` people in a line from `x0`, facing `dir`, waiting;
 * - `sit`: `n` people on a bench or chairs (seat `seat` cm high) from `x0`;
 * - `far`: a dense strip of small people far off, drifting both ways (`dir` 0) or one; cheap, for a far band.
 * `cold` dresses them for winter; `umbrellas` and `flags` are the share who carry one (seen in the rain, and in
 * the place's `flagState` state, default `flags`); `night` is the share still out at night; `mute` greys them.
 */
const crowd: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "walk"), n = Math.max(0, Math.min(CROWD_MAX, Math.round(num(p.n, 8)))), x0 = num(p.x0, -500), x1 = num(p.x1, 500), dir0 = Math.sign(num(p.dir, 0));
  const mute = num(p.mute, 0.3), night = num(p.night, 0.4), flagState = str(p.flagState, "flags");
  const who = () => person(r, { cold: !!p.cold, flags: num(p.flags, 0.5), umbrellas: num(p.umbrellas, 0.7) });
  const late = () => r.chance(night) ? undefined : { time: NOT_NIGHT };
  const flats: FlatSpec[] = [];
  if (kind === "far") {
    const per = 900, dirs = dir0 ? [dir0] : [1, -1];
    // it slides by a period and starts over, so it reaches a period past the lane on the side it comes from; long ones are drawn coarser to fit the atlas
    for (const [k, d] of dirs.entries()) {
      const lo = Math.min(x0, x1) - (d > 0 ? per : 0), hi = Math.max(x0, x1) + (d < 0 ? per : 0);
      const group = { shapes: farStrip(r, per, lo, hi, Math.min(0.8, mute + 0.25)), edge: 0.4 }, [bx0, , bx1] = groupBounds(group);
      flats.push({ group, z: -k * 30, y: k * 4, ppcm: Math.min(0.5, 1900 / (bx1 - bx0 + 10)), pick: false, shadow: "none", move: { scroll: { dx: d * per, ms: per / 0.9 * 1000 * (1 + k * 0.25) } } });
    }
    return { flats };
  }
  if (kind === "walk") {
    const len = Math.abs(x1 - x0);
    for (let i = 0; i < n; i++) {
      const d = dir0 || (i % 2 ? -1 : 1), v = r.range(85, 135), step = r.range(470, 600), dz = r.range(-35, 35);
      const ms = len / v * 1000, from = d > 0 ? Math.min(x0, x1) : Math.max(x0, x1), to = d > 0 ? Math.max(x0, x1) : Math.min(x0, x1);
      const move: FlatMotion = { path: { pts: [[from, 0, 0], [to, 0, 0]], ms, wait: r.range(0, ms * 0.35), hide: true }, sway: { dy: 1.4, rot: 0.01, ms: step * 2 }, phase: (i + r.range(0, 0.7)) / n };
      const pp = who(), w = late();
      flats.push(...personFlats(pp, "walk", { dir: d, at: [0, dz], mute, move, step, when: w, flagState }));
      // now and then a child walks beside a grown-up
      if (pp.build !== "child" && r.chance(0.12) && i < n - 1) {
        flats.push(...personFlats(person(r, { build: "child", flags: num(p.flags, 0.5), umbrellas: 0.2 }), "walk", { dir: d, at: [0, dz + 18], mute, move: { ...move, path: { ...move.path!, pts: move.path!.pts.map(([a, b, c]) => [a + d * 34, b, c] as [number, number, number]) } }, step: step * 0.85, when: w, flagState }));
        i++;
      }
    }
    return { flats };
  }
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  // a group of two or three: who is left in it, and where the next one stands
  let left = 0, x = lo;
  for (let i = 0; i < n; i++) {
    const pp = who(), w = late();
    let d: number, at: [number, number], pose: Pose = "stand";
    if (kind === "stand") {
      if (!left) { if (i) x += r.range(110, 180); left = r.chance(0.55) ? 2 : 3; }
      d = left % 2 ? 1 : -1; at = [x, r.range(-15, 15)]; x += r.range(42, 58); left--;
    } else if (kind === "sit") { d = dir0 || 1; at = [lo + i * (p.gap !== undefined ? num(p.gap, 60) : r.range(56, 64)), 0]; pose = p.front ? "sit_front" : "sit"; }
    else { d = dir0 || 1; at = [(d > 0 ? hi : lo) - d * i * r.range(64, 76), r.range(-6, 6)]; }
    const move: FlatMotion = { sway: { rot: 0.008, dy: 0.5, ms: r.range(2600, 4200) }, phase: r() };
    flats.push(...personFlats(pp, pose, { dir: d, at, mute, move, when: w, flagState, seat: num(p.seat, 45) }));
  }
  return { flats };
}, variants: { walk: { kind: "walk" }, stand: { kind: "stand" }, queue: { kind: "queue" }, sit: { kind: "sit" }, far: { kind: "far" } },
  meta: {
    about: "A faceless crowd: passers-by walking a lane, groups standing, a queue, people sitting, or a far strip of small people.",
    params: {
      kind: { type: "enum", values: ["walk", "stand", "queue", "sit", "far"], default: "walk", about: "what the crowd does" },
      front: { type: "bool", default: false, about: "sit: facing us (a bench along a wall, the metro's), not side on" },
      gap: { type: "num", min: 0, about: "sit: cm from one to the next (a seat's width); default about 60" },
      n: { type: "int", min: 0, max: 24, default: 8, about: "how many people (not for far)" },
      x0: { type: "num", default: -500, about: "lane start, cm from the piece" },
      x1: { type: "num", default: 500, about: "lane end, cm from the piece" },
      dir: { type: "num", min: -1, max: 1, default: 0, about: "facing or going: 1 right, -1 left, 0 both ways" },
      mute: { type: "num", min: 0, max: 1, default: 0.3, about: "how far they are greyed towards the haze" },
      night: { type: "num", min: 0, max: 1, default: 0.4, about: "share still out at night" },
      cold: { type: "bool", default: false, about: "dressed for winter" },
      umbrellas: { type: "num", min: 0, max: 1, default: 0.7, about: "share with an umbrella in the rain" },
      flags: { type: "num", min: 0, max: 1, default: 0.5, about: "share carrying a little flag in the flag state" },
      flagState: { type: "text", default: "flags", about: "the place state their flags show in" },
      seat: { type: "num", default: 45, about: "seat height for sit, cm" },
    },
    states: ["flags"],
    tags: ["people"],
  } };

// ---- Birds and cats -----------------------------------------------------------------------------

/** A gull side on, facing right, wings up or down, `L` cm long. */
function gull(L: number, up: boolean): Shape[] {
  const k = (pts: number[][]) => pts.map(([x, y, c]) => (c === 0 ? [x * L, y * L, 0] : [x * L, y * L]) as Pt);
  const GREY = "#B4BCC4", INK = "#2B2F33";
  // a wing from the shoulder: raised (up) or swept down, its leading edge crooked at the wrist, its hand black-tipped with a white mirror
  const wing = (dx: number, dy: number, sc: number, c: string) => {
    const pts = up
      ? [[0.1, -0.23, 0], [0.06, -0.5], [0.0, -0.68, 0], [-0.4, -1.0, 0], [-0.3, -0.8], [-0.17, -0.6], [-0.16, -0.24, 0]]
      : [[0.1, -0.2, 0], [0.07, -0.02], [0.02, 0.14, 0], [-0.34, 0.42, 0], [-0.25, 0.22], [-0.15, 0.06], [-0.16, -0.18, 0]];
    const q = P(k(pts.map(([x, y, c]) => [dx + x * sc, dy + (y + 0.2) * sc - 0.2, c])), c), tip = up ? [[-0.08, -0.84], [-0.5, -1.1], [-0.3, -0.66]] : [[-0.1, 0.24], [-0.46, 0.5], [-0.2, 0.08]];
    const mirror = up ? [-0.33, -0.93] : [-0.27, 0.36];
    return [q, P(k(tip.map(([x, y]) => [dx + x * sc, dy + (y + 0.2) * sc - 0.2, 0])), INK, { flat: true, clip: q.path }),
      S(ellipse((dx + mirror[0] * sc) * L, (dy + (mirror[1] + 0.2) * sc - 0.2) * L, L * 0.025, L * 0.018), "#F4F3EF", { flat: true, clip: q.path })];
  };
  const body = P(k([[-0.52, -0.16, 0], [-0.3, -0.22], [-0.05, -0.26], [0.22, -0.27], [0.33, -0.34], [0.43, -0.35], [0.5, -0.3, 0], [0.45, -0.24], [0.3, -0.16], [0.05, -0.08], [-0.25, -0.09], [-0.45, -0.12, 0]]), "#F4F3EF");
  return [
    ...(up ? wing(-0.05, 0.02, 0.85, tone(GREY, "shade")) : []),
    P(k([[-0.12, -0.08, 0], [-0.22, -0.04, 0], [-0.2, -0.1, 0]]), "#E3A08E"),
    body, S(ellipse(-0.08 * L, -0.24 * L, 0.36 * L, 0.06 * L), GREY, { flat: true, clip: body.path }),
    P(k([[-0.52, -0.16, 0], [-0.44, -0.2, 0], [-0.4, -0.14, 0]]), INK, { flat: true, clip: body.path }),
    P(k([[0.49, -0.315, 0], [0.63, -0.29, 0], [0.61, -0.275], [0.49, -0.265, 0]]), "#E7B53A"), S(ellipse(0.585 * L, -0.276 * L, L * 0.012), "#D2462F", { flat: true }),
    S(ellipse(0.41 * L, -0.31 * L, L * 0.017), INK, { flat: true }),
    ...wing(0, 0, 1, GREY),
  ];
}

/** A pigeon side on, facing right, pecking about its feet. */
function pigeon(L: number, c: string): Shape[] {
  return [
    S(rect(-L * 0.04, -L * 0.14, L * 0.03, L * 0.14), "#C9767A"), S(rect(L * 0.06, -L * 0.14, L * 0.03, L * 0.14), "#C9767A"),
    P([[-L * 0.55, -L * 0.42, 0], [-L * 0.2, -L * 0.48], [L * 0.2, -L * 0.5], [L * 0.32, -L * 0.62], [L * 0.38, -L * 0.75], [L * 0.5, -L * 0.72, 0], [L * 0.44, -L * 0.5], [L * 0.3, -L * 0.22], [-L * 0.1, -L * 0.14], [-L * 0.4, -L * 0.3]], c),
    S(ellipse(L * 0.3, -L * 0.48, L * 0.11, L * 0.12), "#6E8E7A", { flat: true, opacity: 0.8 }), S(ellipse(L * 0.27, -L * 0.42, L * 0.09, L * 0.08), "#8A6A9A", { flat: true, opacity: 0.6 }),
    { path: smooth([[-L * 0.25, -L * 0.36], [L * 0.05, -L * 0.34]], false, 1), stroke: { color: tone(c, "deep"), width: L * 0.04 }, flat: true },
    { path: smooth([[-L * 0.22, -L * 0.3], [L * 0.08, -L * 0.28]], false, 1), stroke: { color: tone(c, "deep"), width: L * 0.04 }, flat: true },
    P([[L * 0.49, -L * 0.74, 0], [L * 0.58, -L * 0.71, 0], [L * 0.49, -L * 0.68, 0]], "#3B3B40"), S(ellipse(L * 0.43, -L * 0.73, L * 0.02), "#D9A72E", { flat: true }),
  ];
}

/** A pigeon in flight side on, facing right, its wings `up` or down, its body at about half its length above the origin. */
function pigeonFlying(L: number, c: string, up: boolean): Shape[] {
  const w = tone(c, "shade");
  return [
    P([[-L * 0.38, -L * 0.52, 0], [-L * 0.62, -L * 0.6], [-L * 0.6, -L * 0.42], [-L * 0.36, -L * 0.46, 0]], tone(c, "deep")),
    S(ellipse(0, -L * 0.5, L * 0.42, L * 0.13), c), S(ellipse(L * 0.4, -L * 0.6, L * 0.11, L * 0.1), c),
    S(ellipse(L * 0.28, -L * 0.54, L * 0.08, L * 0.07), "#6E8E7A", { flat: true, opacity: 0.8 }),
    P([[L * 0.5, -L * 0.62, 0], [L * 0.59, -L * 0.59, 0], [L * 0.5, -L * 0.56, 0]], "#3B3B40"), S(ellipse(L * 0.43, -L * 0.62, L * 0.02), "#D9A72E", { flat: true }),
    up ? P([[-L * 0.12, -L * 0.56, 0], [-L * 0.42, -L * 1.2], [-L * 0.08, -L * 1.12], [L * 0.16, -L * 0.6, 0]], w)
      : P([[-L * 0.12, -L * 0.48, 0], [-L * 0.36, -L * 0.06], [L * 0.04, -L * 0.14], [L * 0.16, -L * 0.46, 0]], w),
  ];
}

/** How pigeons keep from a passer-by (`FlatReact.flee`): within 1.3 m they fly up and off to the side and land there, until someone comes near them again. */
const PIGEON_FLEE = { r: 1.3, away: 1.4, lift: 70 };
/** A tapped pigeon flutters up where it is, wings beating ("pır pır"). */
const PIGEON_TAP = { do: "hop" as const, sound: "wing_flap" };

/**
 * Birds, `kind`: `gulls` crossing over in a slow glide from `x0` to `x1` at `alt` cm (wings beating now
 * and then), or `pigeons` on the ground between `x0` and `x1`, pecking, that flutter up and away from a passer-by
 * and land a little further off, where they stay (`FlatReact`: a standing flat at rest, two wingbeat flats each way while flying);
 * a tap in explore makes one flutter where it is. `n` of them.
 */
const birds: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "gulls"), n = Math.max(1, Math.min(12, Math.round(num(p.n, 4)))), x0 = num(p.x0, -400), x1 = num(p.x1, 400), flats: FlatSpec[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === "pigeons") {
      const c = r.pick(["#8A94A3", "#7D8794", "#9AA3AF", "#6F6A68"]), d = r.chance(0.5) ? 1 : -1, x = r.range(x0, x1);
      const L = r.range(30, 34), z = r.range(-20, 20), ms = r.range(900, 1600), phase = r();
      // one pigeon: its flats share a home, and a tap makes it flutter
      const react = { flee: PIGEON_FLEE, home: [x, z] as [number, number], tap: PIGEON_TAP };
      flats.push({ group: { shapes: flip(pigeon(L, c), d), edge: 0.4 }, x, z, ppcm: 2.4, move: { sway: { rot: 0.22, ms }, phase }, react: { ...react, show: "rest" } });
      for (const face of [1, -1] as const) for (const up of [true, false]) flats.push({ group: { shapes: flip(pigeonFlying(L, c, up), face), edge: 0.4 }, x, z, ppcm: 2.4, shadow: "none",
        move: { blink: { ms: 240, on: 0.5, at: up ? 0 : 0.5 }, phase }, react: { ...react, show: "away", face } });
      continue;
    }
    const L = r.range(46, 58), y = num(p.alt, 380) + r.range(-60, 60), d = r.chance(0.7) ? 1 : -1, dz = r.range(-60, 60), ms = r.range(9000, 14000);
    const from = d > 0 ? x0 : x1, to = d > 0 ? x1 : x0, mid = (from + to) / 2;
    const move: FlatMotion = { path: { pts: [[from, y, dz], [mid, y + r.range(-40, 40), dz], [to, y + r.range(-30, 50), dz]], ms, wait: r.range(1000, 5000), hide: true }, phase: (i + r()) / n };
    const beat = r.range(380, 480);
    flats.push({ group: { shapes: flip(gull(L, true), d), edge: 0.4 }, ppcm: 1.6, pick: false, shadow: "none", move: { ...move, blink: { ms: beat, on: 0.5, at: 0 } } });
    flats.push({ group: { shapes: flip(gull(L, false), d), edge: 0.4 }, ppcm: 1.6, pick: false, shadow: "none", move: { ...move, blink: { ms: beat, on: 0.5, at: 0.5 } } });
  }
  return { flats };
}, variants: { gulls: { kind: "gulls" }, pigeons: { kind: "pigeons" } },
  meta: {
    about: "Birds: gulls gliding across overhead, or pigeons pecking on the ground.",
    params: {
      kind: { type: "enum", values: ["gulls", "pigeons"], default: "gulls" },
      n: { type: "int", min: 1, max: 12, default: 4, about: "how many" },
      x0: { type: "num", default: -400, about: "from, cm" },
      x1: { type: "num", default: 400, about: "to, cm" },
      alt: { type: "num", default: 380, about: "gulls' flying height, cm (not `y`, which is where the piece stands, in metres)" },
    },
    terms: ["kuş", "martı", "güvercin"],
    tags: ["animal"],
  } };

/** A street cat's coats: fur, its markings, the light of muzzle, chest and paws (a calico's dark patches last). */
const CATS: Record<string, string[]> = {
  ginger: ["#E2984D", "#B8652B", "#F7E6CC"], tabby: ["#A1907B", "#4C4137", "#ECE3D3"], grey: ["#9097A0", "#6E7680", "#E2E5E8"],
  black: ["#2F2C2C", "#1B1919", "#F2EEE7"], white: ["#F5F1E9", "#D8CFC1", "#FFFFFF"], calico: ["#F5F0E7", "#DE8C42", "#F5F0E7", "#3A3232"],
};
/** Shapes through an affine, their clips with them (a clip shared by several shapes stays one path). */
function catTf(sh: Shape[], m: Affine): Shape[] {
  const done = new Map<Path, Path>(), t = (q: Path) => done.get(q) ?? done.set(q, q.transform(m)).get(q)!;
  return sh.map(s => ({ ...s, path: t(s.path), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(t) : t(s.clip) } : {}) }));
}
/** A tapering band along a spine with a round end: a tail, a leg. */
const limb = (pts: Vec2[], w0: number, w1: number) => band(pts, pts.map((_, i) => w0 + (w1 - w0) * i / (pts.length - 1)));

/** How a sitting cat answers a passer-by (`FlatReact`): it turns its head up to anyone within 2.5 m, and from one within 0.9 m walks off and sits there. */
const CAT_TAP = { do: "look" as const, sound: "meow" };
const CAT_FLEE = { r: 0.9, away: 1.1, speed: 0.8 }, CAT_LOOK = { r: 2.5, turn: -0.45, pivot: [4.2, -22] as [number, number] };

/** One cat facing right, its flats in paint order: `pose`, coat `k` (a CATS name), `eyes` on; a sitting one that `reacts` has its head as a flat of its own. */
function oneCat(r: Rng, pose: string, k: string, held: boolean, step: number, go: FlatMotion | undefined, reacts = false): FlatSpec[] {
  const [c, m, l, m2] = CATS[k], sh = mix(c, "#463C38", 0.3), striped = k === "tabby" || k === "ginger";
  const bib = k === "white" || k === "calico" ? false : r.chance(k === "black" ? 0.4 : k === "grey" ? 0.5 : 0.75);
  const pink = k === "black" ? "#8A5D5A" : "#E2A39B", nose = k === "black" ? "#4A3A3A" : "#D98483", eye = r.pick(k === "white" ? ["#86AFD6", "#C9B23C"] : ["#C9B23C", "#A3B84A", "#D59B30"]);
  // a paper part: the fur with a shade along its lower right (the light is from the upper left), its marks clipped inside it
  const part = (q: Path, col = c, marks: Shape[] = []): Shape[] => [S(q, mix(col, "#463C38", 0.22)), S(q.move(-0.45, -0.55), col, { flat: true, clip: q }), ...marks.map(s => ({ ...s, clip: q }))];
  const mark = (q: Path, col: string, opacity = 1): Shape => ({ path: q, fill: col, flat: true, opacity });
  // tabby or ginger stripes across a spine, every `gap` cm, `len` long from the spine to its `off` side
  const stripes = (sp: Vec2[], gap: number, len: number, w: number, off = 0): Shape[] => {
    if (!striped) return [];
    const out: Shape[] = [];
    for (let i = 0; i < sp.length - 1; i++) {
      const [ax, ay] = sp[i], [bx, by] = sp[i + 1], L0 = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / L0, ty = (by - ay) / L0;
      for (let s = gap * 0.5; s < L0; s += gap) {
        const x = ax + tx * s, y = ay + ty * s, a = -len * off, b = len * (1 - off), j = r.range(-0.5, 0.5);
        out.push(mark(band([[x - ty * a, y + tx * a], [x - ty * (a + b) / 2 + tx * j, y + tx * (a + b) / 2 + ty * j], [x - ty * b, y + tx * b]], [w, w * 0.85, w * 0.35]), m, k === "ginger" ? 0.55 : 0.8));
      }
    }
    return out;
  };
  // stripes wrapping round a haunch, in from its back
  const swirl = (x: number, y: number, R: number) => stripes(arcPoints(x, y, R * 1.05, R * 1.05, 2.2, 4.9, 4), R * 1.2, R * 0.7, 1.3);
  const blob = (x: number, y: number, rad: number, col: string) => mark(smooth(Array.from({ length: 7 }, (_, i) => [x + Math.cos(i * 0.9) * rad * r.range(0.7, 1.15), y + Math.sin(i * 0.9) * rad * r.range(0.7, 1.15)] as Vec2)), col);
  const patches = (spots: [number, number, number][]) => k === "calico" ? spots.map(([x, y, s], i) => blob(x, y, s, i % 2 ? m2 : m)) : [];
  const light = (q: Path) => bib ? [mark(q, l)] : [];
  const tailMarks = (sp: Vec2[], w: number) => [...stripes(sp, 2.6, w * 2, 1.3, 0.5), ...patches([[sp[sp.length - 1][0], sp[sp.length - 1][1], 3.2]])];

  // the head, centred at 0: skull and ears in one outline, pink inside the ears, the muzzle's bump, the nose; eyes open or shut
  const head = (shut: boolean): Shape[] => {
    const q = smooth([[-4.4, 3.4], [-5.2, -0.4], [-4.6, -3.7], [-4.3, -8.8, 0], [-1.2, -5.3], [0.6, -5.6], [2.9, -9.6, 0], [4.8, -4.2], [6.0, -2.2], [6.7, -0.4], [7.3, 0.6], [7.0, 1.9], [5.2, 3.1], [1.5, 4.1], [-1.8, 4.3]]);
    const eyeAt = (x: number, y: number, s: number): Shape[] => shut
      ? [L([[x - 0.9 * s, y - 0.1], [x, y + 0.45], [x + 0.9 * s, y - 0.15]], k === "black" ? "#8A807A" : "#2A2422", 0.38, 0.85)]
      : [P([[x - 0.95 * s, y + 0.1, 0], [x - 0.1, y - 0.7], [x + 0.95 * s, y - 0.35, 0], [x + 0.1, y + 0.55]], eye, { flat: true }), S(ellipse(x + 0.1, y - 0.05, 0.28 * s, 0.6), "#1E1A18", { flat: true })];
    return part(q, c, [
      mark(smooth([[1.3, -5.7], [2.8, -8.3, 0], [4.1, -4.6]]), pink), mark(smooth([[-3.4, -5.2], [-3.9, -7.7, 0], [-1.8, -5.3]]), tone(pink, "shade")),
      ...stripes([[-0.4, -5.6], [2.6, -4.8]], 1.1, 2.6, 0.55), ...stripes([[0.6, 0.3], [-3.4, 0.4]], 1.6, 1.4, 0.5, 0.5),
      ...patches([[-3.2, -4.4, 3.4]]),
      ...(bib || k === "ginger" ? [mark(smooth([[2.8, 0.8], [5.2, 0.4], [7.6, 1.0], [6.8, 3.4], [2.6, 4.6], [0.4, 3.2]]), l)] : []),
      ...eyeAt(2.7, -1.2, 1), ...eyeAt(5.6, -1.4, 0.6),
      mark(smooth([[6.4, -0.2], [7.4, 0.1], [6.9, 1.0]]), nose),
    ]);
  };
  const put = (sh: Shape[], x: number, y: number, a = 0, s = 1) => catTf(sh, mul(translate(x, y), mul(rotate(a), [s, 0, 0, s, 0, 0])));
  const flat = (shapes: Shape[], o: Partial<FlatSpec> = {}): FlatSpec => ({ group: { shapes, edge: 0.4 }, ppcm: 4, ...o });
  const breathe = (ms: number) => ({ move: { sway: { dy: 0.3, ms }, phase: r() } });

  if (pose === "walk" && !held) {
    // a stride: legs behind the body (far, in shade) or before it (near), front legs straight, hind legs bent at the hock
    const leg = (x: number, a: number, hind: boolean, near: boolean): Shape[] => {
      const sp: Vec2[] = hind ? [[x, -16], [x + 1 + a * 0.4, -9], [x - 1.4 + a * 0.8, -4.6], [x - 0.6 + a, -1.2]] : [[x, near ? -19 : -16], [x + a * 0.5, -7.5], [x + a, -1.2]];
      const [px, py] = sp[sp.length - 1], col = near ? c : sh;
      return [...part(band(sp, hind ? [5, 3.6, 2.8, 2.6] : [near ? 5.4 : 4.4, 3, 2.6]), col, [...stripes(sp.slice(1), 2.4, 6, 1.1, 0.5), ...light(ellipse(px, py, 3.5, 3))]), ...part(ellipse(px + 0.7, py + 0.1, 1.9, 1.1), bib ? l : col)];
    };
    const frame = (s: number, near: boolean) => [...(near ? part(ellipse(-9, -17, 5.6, 6), c, [...swirl(-9, -17, 5.2), ...patches([[-8, -18, 3.4]])]) : []),
      ...leg(near ? -9 : -7.5, near ? -3 * s : 2.6 * s, true, near), ...leg(near ? 9 : 10.5, near ? 3 * s : -2.6 * s, false, near)];
    const torso = smooth([[-14.5, -15], [-13.5, -20.5], [-9, -23.2], [0, -22], [8, -23.4], [12.5, -26.5], [15.8, -20], [13.5, -14], [9.5, -12.2], [0, -11.8], [-8, -12.4], [-12.5, -12.8]]);
    const tailSp: Vec2[] = [[0, 0], [-3.4, -4], [-5, -10], [-3.6, -16], [-0.6, -19.2], [2, -18.6]];
    const body = [...part(torso, c, [...stripes([[-12, -21], [-1, -22], [9, -23]], 3, 10, 1.6), ...light(smooth([[12, -24], [16, -21], [13.5, -13], [10, -15]])), ...patches([[-4, -20, 5], [5, -17, 3.6]])]), ...put(head(false), 15.6, -27)];
    const tail = part(limb(tailSp, 3.8, 2.4), c, tailMarks(tailSp, 3));
    const walk = (s: number, near: boolean, z: number) => flat(frame(s, near), { z, move: { ...go, blink: { ms: step, on: 0.5, at: s > 0 ? 0 : 0.5 } } });
    // a phase is the whole motion's: on its way, the tail keeps the path's (one of its own would put it elsewhere on the path than the body)
    return [walk(1, false, -0.5), walk(-1, false, -0.5), flat(tail, { x: -13, y: 20, z: -0.3, move: go ? { ...go, sway: { rot: 0.12, ms: step * 4 } } : { sway: { rot: 0.12, ms: step * 4 }, phase: r() } }), flat(body, { id: "cat", ...(go ? { move: go } : {}) }), walk(1, true, 0.3), walk(-1, true, 0.3)];
  }
  if (pose === "sleep" && !held) {
    // curled up: the back's curve, the haunch, the head tucked down on the front paws, eyes shut; the tail round the front, still
    const torso = smooth([[-15.5, -1], [-17, -7.5], [-12, -14], [-3, -16.5], [6, -15], [12, -10.5], [14.5, -4.5], [12.5, -0.4, 0], [-13.5, -0.4, 0]]);
    const haunch = smooth([[-15, -2], [-15.2, -9], [-9.5, -14], [-3, -11.5], [-2, -5], [-5.5, -1]]);
    const body = [...part(torso, c, [...stripes([[-16, -6], [-12, -13.5], [-2, -16.2], [8, -15]], 2.8, 6.5, 1.5), ...patches([[2, -12, 5], [-12, -10, 3.5]])]),
      ...part(haunch, c, [...swirl(-8.5, -7.5, 5.6), ...patches([[-8, -6, 3]])]),
      ...part(ellipse(14, -2.2, 3.4, 1.9), bib ? l : c), ...put(head(true), 11.5, -8.6, 0.42)];
    const tailSp: Vec2[] = [[-15.5, -3], [-11, -1], [0, -0.9], [9, -1.3], [14, -3.4], [16.6, -6.6]];
    return [flat(body, { id: "cat", ...breathe(3400) }), flat(part(limb(tailSp, 3.4, 2.4), c, tailMarks(tailSp, 3)), { z: 0.3 })];
  }
  if (pose === "loaf" || held) {
    // a loaf: paws tucked under the chest, the tail along the side, eyes shut, breathing
    const torso = smooth([[-15, -1], [-16.2, -8], [-12.5, -15], [-3, -17.6], [6, -16.6], [11, -12.6], [12.2, -4], [10.6, -0.4, 0], [-13.5, -0.4, 0]]);
    const haunch = smooth([[-14.5, -2], [-15, -9], [-10, -14], [-4.5, -11], [-4, -4], [-7, -1]]);
    const tailSp: Vec2[] = [[-15.5, -3], [-11, -1.1], [-1, -0.9], [6, -1.2], [9.5, -2.6]];
    const body = [...part(torso, c, [...stripes([[-15, -9], [-11, -15], [-1, -17.6], [7, -17]], 2.8, 6.5, 1.5), ...light(smooth([[8, -14], [12.5, -11], [12.5, -1], [8, -3]])), ...patches([[0, -14, 5], [-11, -8, 3.5]])]),
      ...part(haunch, c, swirl(-9.5, -7.5, 5.4)), ...part(ellipse(10.5, -1.6, 2.6, 1.4), bib ? l : c),
      ...put(head(true), 10.4, -19.2)];
    const tail = part(limb(tailSp, 3.2, 2.4), c, tailMarks(tailSp, 3));
    return held ? [flat(catTf([...body, ...tail], translate(0, 9)), { id: "cat" })] : [flat(body, { id: "cat", ...breathe(3800) }), flat(tail, { z: 0.3 })];
  }
  // sitting up: chest and haunch, the front legs straight down, the tail round the feet with its tip curling up and flicking
  const torso = smooth([[-2, -27], [-6, -21.5], [-10, -14], [-12.2, -7], [-11.5, -2], [-9, -0.3, 0], [0, -0.3, 0], [1.6, -5], [3.4, -10.6], [6.6, -14.2], [8, -18.5], [4.6, -25]]);
  const haunch = smooth([[-12, -4.5], [-10.8, -11.5], [-5.6, -15], [-1.2, -11], [-0.8, -4], [-3.2, -0.4, 0], [-10.6, -0.4, 0]]);
  const leg = (x: number, near: boolean) => {
    const sp: Vec2[] = [[x, -15], [x + 0.3, -7], [x + 0.5, -1.2]];
    return part(limb(sp, near ? 4.8 : 4.2, 3.1), near ? c : sh, [...stripes(sp, 2.4, 6, 1.1, 0.5), ...light(ellipse(x + 0.5, -1, 3.5, 6))]);
  }, paw = (x: number, near: boolean) => part(ellipse(x + 1.3, -1.3, 2.3, 1.3), bib ? l : near ? c : sh);
  const baseSp: Vec2[] = [[-11.5, -2.6], [-7, -1.2], [2, -1.1], [9.5, -1.6]], tipSp: Vec2[] = [[0, 0], [2.2, -1.2], [3.4, -3.6], [2.9, -6]];
  const body = [...leg(7.6, false), ...leg(5.2, true), ...part(torso, c, [...stripes([[-1, -26], [-6, -20.5], [-10, -13], [-12, -6]], 2.6, 9, 1.6), ...light(smooth([[0.5, -24], [6.5, -22.5], [8, -14], [5.5, -6], [2.2, -13]])), ...patches([[-6, -17, 5], [-1, -7, 3.6]])]),
    ...part(haunch, c, [...swirl(-6, -7.5, 5.6), ...patches([[-6, -8, 3.4]])]),
    ...part(rrect(-3.6, -2.5, 7.4, 2.5, 1.25), bib ? l : c), ...part(limb(baseSp, 3.4, 3), c, stripes(baseSp, 2.6, 6, 1.3, 0.5)),
    ...paw(7.6, false), ...paw(5.2, true), ...(reacts ? [] : put(head(false), 4.2, -26.4))];
  // reacting, it rests while no one is near: the head its own flat, turning about the neck
  const rest: Partial<FlatSpec> = reacts ? { react: { flee: CAT_FLEE, show: "rest" } } : {};
  if (reacts) return [flat(body, { id: "cat", ...rest }), flat(put(head(false), 4.2, -26.4), { id: "cat", z: 0.05, react: { flee: CAT_FLEE, look: CAT_LOOK, show: "rest" } }),
    flat(part(limb(tipSp, 3, 2.3), c, tailMarks(tipSp, 3)), { x: 9.5, y: 1.6, z: 0.3, move: { sway: { rot: 0.16, ms: r.range(2200, 3200) }, phase: r() }, ...rest })];
  return [flat(body, { id: "cat" }), flat(part(limb(tipSp, 3, 2.3), c, tailMarks(tipSp, 3)), { x: 9.5, y: 1.6, z: 0.3, move: { sway: { rot: 0.16, ms: r.range(2200, 3200) }, phase: r() } })];
}

/**
 * A street cat, about 45 cm nose to tail, in cut paper: `pose` `sit` (upright, its tail round its feet and the
 * tip flicking), `walk` (along `go`, a stride every `step` ms, the tail up), `sleep` (curled up, breathing) or
 * `loaf` (paws tucked, eyes shut). `coat`: ginger, tabby, grey, black, white or calico (seeded when left out);
 * a seeded light chest, muzzle and socks. `dir` −1 faces left; `n` cats side by side; `held` one in the arms. A sitting cat
 * reacts (`react`, default on; `FlatReact`): it turns its head up to anyone within 2.5 m, and from one who comes within
 * 0.9 m it gets up, walks off the other way and sits there; a tap in explore makes it look up and miaow.
 */
/** A reaction turned to face `f` (−1: mirrored): its pivot and turn mirror, and which way it shows. */
const mirrorReact = (rc: FlatReact, f: number): FlatReact => f > 0 ? rc : {
  ...rc, ...(rc.look ? { look: { ...rc.look, turn: -rc.look.turn, pivot: [-rc.look.pivot[0], rc.look.pivot[1]] } } : {}),
};

const cat: PieceDef = { draw(p, r) {
  const held = !!p.held, d = num(p.dir, 1) < 0 ? -1 : 1, n = held ? 1 : Math.max(1, Math.min(6, Math.round(num(p.n, 1)))), flats: FlatSpec[] = [];
  const pose = str(p.pose, "sit"), step = Math.max(334, num(p.step, 420)), reacts = pose === "sit" && !held && p.react !== false;
  // a flat turned to face `f` (−1 left): its shapes, its place and how it reacts, mirrored
  const facing = (fl: FlatSpec, f: number, x: number): FlatSpec => ({ ...fl, x: (fl.x ?? 0) * f + x, group: { ...fl.group, shapes: catTf(fl.group.shapes, [f, 0, 0, 1, 0, 0]) },
    ...(fl.react ? { react: mirrorReact(fl.react, f) } : {}) });
  for (let i = 0; i < n; i++) {
    const coat = CATS[str(p.coat, "")] && i === 0 ? str(p.coat, "") : r.pick(Object.keys(CATS)), x = (i - (n - 1) / 2) * 48;
    if (!reacts) { for (const f of oneCat(r, pose, coat, held, step, goes(p))) flats.push(facing(f, d, x)); continue; }
    // sitting, it reacts: its own seed for the sitting cat and the walking one, so both have the same eyes and markings
    const seed = Math.floor(r() * 2 ** 31);
    // one cat: all its flats share its home, and a tap makes it look up and miaow
    const one = (f: FlatSpec): FlatSpec => f.react ? { ...f, react: { ...f.react, home: [x, 0], tap: CAT_TAP } } : f;
    for (const f of oneCat(rng(seed), "sit", coat, false, step, undefined, true)) flats.push(one(facing(f, d, x)));
    // slinking off from a passer-by: the walk, each way, shown only while it is away
    for (const way of [1, -1] as const) for (const f of oneCat(rng(seed), "walk", coat, false, step, undefined)) flats.push(one(facing({ ...f, react: { flee: CAT_FLEE, show: "away", face: way } }, way, x)));
  }
  return { flats };
}, variants: { sit: { pose: "sit" }, walk: { pose: "walk" }, sleep: { pose: "sleep" }, loaf: { pose: "loaf" } },
  meta: {
    about: "A street cat in cut paper, sitting, walking, sleeping curled up or loafing; ginger, tabby, grey, black, white or calico.",
    params: {
      pose: { type: "enum", values: ["sit", "walk", "sleep", "loaf"], default: "sit" },
      coat: { type: "enum", values: ["ginger", "tabby", "grey", "black", "white", "calico"], about: "the first cat's coat; seeded when left out" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "cats side by side" },
      step: { type: "num", min: 334, default: 420, about: "a stride's length when walking, ms" },
      go: { type: "list", about: "the walk's path: [x, y, z] points, cm" },
      ms: { type: "num", min: 500, default: 20000, about: "the path's duration, ms" },
      wait: { type: "num", min: 0, default: 0, about: "pause before each pass, ms" },
      phase: { type: "num", default: 0, about: "where along the path it starts (0…1)" },
      hide: { type: "bool", default: true, about: "hidden between passes" },
      react: { type: "bool", default: true, about: "sitting, it turns its head to a passer-by and slinks off from one who comes close" },
    },
    terms: ["kedi"],
    tags: ["animal"],
  } };

// ---- The night sky ------------------------------------------------------------------------------


/** The moon's lit part at `phase` (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), radius `R`, centred at (`x`, `y`). */
function moonLit(x: number, y: number, R: number, phase: number): Shape[] {
  const ph = ((phase % 1) + 1) % 1;
  if (ph < 0.02 || ph > 0.98) return [];
  // the bright limb on one side, the terminator an ellipse across: from the top down the limb and back up the terminator
  const waxing = ph <= 0.5, side = waxing ? 1 : -1, t = Math.cos(2 * Math.PI * ph), n = 24, pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; pts.push([x + side * R * Math.cos(a), y + R * Math.sin(a)]); }
  for (let i = n - 1; i > 0; i--) { const a = -Math.PI / 2 + Math.PI * i / n; pts.push([x + side * R * Math.cos(a) * t, y + R * Math.sin(a)]); }
  return [S(poly(pts), "#FFF4D6", { flat: true })];
}

/**
 * The night sky, `w` × `h` cm above its origin (the horizon), far behind the set (`FlatSpec.sky`: it stays
 * put while the camera moves, and cloud hides it): seeded stars, few by the horizon where the city's light
 * washes them out and more overhead, in three sizes and a few tints, some twinkling slowly; the moon
 * (`moon`: its `phase` 0 new … 0.5 full … 1, at `mx`, `my` of the way across and up (default 0.7, 0.3); `moon: false` for none);
 * the city's orange glow along the horizon (`glow`, default on); thin clouds (`clouds`, default 3) lit from
 * below. They come out as the evening deepens: the city's glow first, then the moon, then the stars (they wait for night).
 */
const nightSky: PieceDef = { draw(p, r) {
  const w = num(p.w, 6000), h = num(p.h, 2600), density = num(p.stars, 1), ppcm = Math.min(0.32, 1900 / w);
  const steady: Shape[] = [], tw: [Shape[], Shape[]] = [[], []], flats: FlatSpec[] = [];
  const n = Math.round(density * w * h / 40000);
  for (let i = 0; i < n; i++) {
    const x = r.range(-w / 2, w / 2), y = r.range(0, h), u = y / h;
    // the city's light washes out the low sky: a star there is rarer
    if (!r.chance(0.15 + 0.85 * u * u)) continue;
    const big = r.chance(0.05), mid = !big && r.chance(0.25), R = w * (big ? 0.0026 : mid ? 0.0017 : 0.0011);
    const c = r.chance(0.15) ? "#DCE8FF" : r.chance(0.1) ? "#FFE2B8" : "#FFF8EC";
    const star: Shape[] = [S(ellipse(x, -y, R), c, { flat: true })];
    if (big) star.push({ path: smooth([[x - R * 3, -y], [x + R * 3, -y]], false, 1), stroke: { color: c, width: R * 0.5 }, flat: true, opacity: 0.6 }, { path: smooth([[x, -y - R * 3], [x, -y + R * 3]], false, 1), stroke: { color: c, width: R * 0.5 }, flat: true, opacity: 0.6 });
    // a few twinkle, all in the upper sky (a twinkling layer spread over the whole sky would cost a whole atlas layer of dark)
    const twinkle = r.chance(0.18), k = twinkle ? r.int(0, 1) : 0;
    (twinkle && u > 0.5 ? tw[k] : steady).push(...star);
  }
  const base: Partial<FlatSpec> = { ppcm, lit: 0, sky: true, pick: false, shadow: "none" };
  // the city's glow along the horizon: bands fading upwards (no gradients in paper: steps)
  if (p.glow !== false) {
    const gc = str(p.glowColor, "#FF9E5C"), bands: Shape[] = [];
    for (let k = 0; k < 6; k++) bands.push(S(rect(-w * 1.5, -h * 0.022 * (k + 1), w * 3, h * 0.022), gc, { flat: true, opacity: 0.2 - k * 0.03 }));
    flats.push(glowOnly(bands, { ...base, ppcm: Math.min(ppcm, 1900 / (w * 3)), glowAt: 0.25 }));
  }
  // thin clouds, pale by day, lit from below by the city at night
  for (let k = 0, nc = Math.round(num(p.clouds, 3)); k < nc; k++) {
    // a wisp: long thin puffs overlapping, faint, its underside lit by the city at night
    const cx = r.range(-w * 0.4, w * 0.4), cy = r.range(h * 0.2, h * 0.55), cw = r.range(w * 0.1, w * 0.2), puffs: Shape[] = [], lit: Shape[] = [];
    for (let j = 0, m = r.int(4, 6); j < m; j++) {
      const px = cx - cw / 2 + cw * (j + 0.5) / m + r.range(-cw * 0.04, cw * 0.04), pw = cw / m * r.range(0.9, 1.5), ph = pw * r.range(0.12, 0.2), py = -cy - r.range(0, ph * 0.6);
      puffs.push(S(ellipse(px, py, pw, ph), "#EEF1F5", { flat: true, opacity: 0.22 }));
      lit.push(S(ellipse(px, py + ph * 0.45, pw * 0.9, ph * 0.4), "#E8936A", { flat: true, opacity: 0.22 }));
    }
    flats.push({ ...base, group: { shapes: puffs, edge: 0 }, emissive: { shapes: lit, edge: 0 }, glowAt: 0.35, switch: false });
  }
  if (p.moon !== false) {
    const R = num(p.moonR, w * 0.011), mx = (num(p.mx, 0.7) - 0.5) * w, my = -num(p.my, 0.3) * h, phase = num(p.phase, 0.5);
    flats.push(glowOnly([S(ellipse(mx, my, R * 2.4), "#FFF4D6", { flat: true, opacity: 0.08 }), S(ellipse(mx, my, R * 1.5), "#FFF4D6", { flat: true, opacity: 0.12 }), S(ellipse(mx, my, R), "#4A5070", { flat: true, opacity: 0.55 }), ...moonLit(mx, my, R, phase)], { ...base, glowAt: 0.6 }));
  }
  flats.push(glowOnly(steady, { ...base, glowAt: 0.8 }));
  for (const [k, sh] of tw.entries()) if (sh.length) flats.push(glowOnly(sh, { ...base, glowAt: 0.8, move: { blink: { ms: 2600 + k * 700, on: 0.86, at: k * 0.4 } } }));
  return { flats };
}, variants: { full_moon: { phase: 0.5 }, crescent: { phase: 0.15 }, no_moon: { moon: false } },
  meta: {
    about: "The night sky far behind the set: seeded stars, the moon in its phase, the city's orange glow and thin clouds.",
    params: {
      w: { type: "num", default: 6000, about: "width, cm" },
      h: { type: "num", default: 2600, about: "height above the horizon, cm" },
      stars: { type: "num", min: 0, default: 1, about: "star density" },
      glow: { type: "bool", default: true, about: "the city's glow along the horizon" },
      glowColor: { type: "color", default: "#FF9E5C" },
      clouds: { type: "int", min: 0, default: 3, about: "how many thin clouds" },
      moon: { type: "bool", default: true },
      phase: { type: "num", min: 0, max: 1, default: 0.5, about: "the moon's phase: 0 new, 0.5 full" },
      moonR: { type: "num", min: 0, about: "the moon's radius, cm; default 1.1% of w" },
      mx: { type: "num", min: 0, max: 1, default: 0.7, about: "the moon's place across" },
      my: { type: "num", min: 0, max: 1, default: 0.3, about: "the moon's place up" },
    },
    tags: ["sky", "light"],
  } };

// ---- Shared bits for the outdoor pieces (2c.6) ----------------------------------------------------

const STONE = "#CFC6B4", IRON = "#2F3A36", ROOF = "#B5583A", WOOD = "#A8754A", LAMP = "#FFE6A8";
const PLASTER = ["#E9DCC2", "#E3CFAE", "#D9D2C2", "#E6D3C3", "#DCD6C8"];
/** Shapes moved by an affine, their clips too. */
const tf = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.transform(m)) : s.clip.transform(m) } : {}) }));
/** Many straight printed lines (mortar, joints, grain, cables) as one stroke: segments [x0, y0, x1, y1]. */
const lines = (segs: number[][], c: string, w = 0.6, op = 0.6): Shape => ({ path: segs.reduce((pa, [a, b, x, y]) => pa.moveTo(a, b).lineTo(x, y), new Path()), stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op });
/** Bars from x0 to x1 every `step` cm, `bw` wide, from y `ya` up to `yb` below it: one path. */
function bars(x0: number, x1: number, step: number, bw: number, ya: number, yb: number): Path {
  const out = rect(x0 - bw / 2, ya, bw, yb - ya);
  for (let x = x0 + step; x <= x1 + 0.01; x += step) out.add(rect(x - bw / 2, ya, bw, yb - ya));
  return out;
}
/** Spear tips on bars from x0 to x1 every `step`, their feet at `y`. */
function spears(x0: number, x1: number, step: number, s: number, y: number): Path {
  const out = new Path();
  for (let x = x0; x <= x1 + 0.01; x += step) out.add(poly([[x - s, y], [x, y - s * 2.6], [x + s, y]]));
  return out;
}
/** A round-headed opening `w` wide springing at `spring` cm (its foot at y = 0). */
const archPath = (x: number, w: number, spring: number) => poly([[x - w / 2, 0], ...arcPoints(x, -spring, w / 2, w / 2, Math.PI, Math.PI * 2, 18), [x + w / 2, 0]]);

// ---- Flags ---------------------------------------------------------------------------------------

/** The Turkish flag's red (the flag law's). */
const TR = "#E30A17";

/**
 * A Turkish flag's cloth `h` cm high, its hoist at x = 0 from y = 0 down to `h`, 1.5 h to the fly, rippling by
 * `amp` (of h) from phase `ph`. The flag law's measures: the crescent's outer circle h/2 across, centred h/2 from
 * the hoist; the inner one 0.4 h across, h/16 further; the star in a circle h/4 across, h/3 beyond the inner
 * circle's near edge (its centre 0.82 h from the hoist), one point towards the hoist.
 */
export function flagCloth(h: number, amp = 0, ph = 0): Shape[] {
  const Lf = h * 1.5, wv = (x: number) => amp * h * Math.sin(x / Lf * 5 + ph) * x / Lf, top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const x = Lf * i / 10, e = i % 10 !== 0; top.push(e ? [x, wv(x)] : [x, wv(x), 0]); bot.unshift(e ? [x, h + wv(x)] : [x, h + wv(x), 0]); }
  const cloth = smooth([...top, ...bot], true, 1), at = (k: number): Vec2 => [h * k, h / 2 + wv(h * k)], [sx, sy] = at(0.8208);
  const star: Pt[] = Array.from({ length: 10 }, (_, i) => { const a = Math.PI + i * Math.PI / 5, q = h / 8 * (i % 2 ? 0.382 : 1); return [sx + Math.cos(a) * q, sy + Math.sin(a) * q, 0]; });
  const out: Shape[] = [S(cloth, TR), S(ellipse(...at(0.5), h / 4), "#FFFFFF", { flat: true }), S(ellipse(...at(0.5625), h * 0.2), TR, { flat: true }), S(smooth(star, true, 1), "#FFFFFF", { flat: true })];
  // the ripple's troughs in shade, its crests catching the light (the fly moves most)
  if (amp) for (let i = 0; i < 10; i++) { const c = Math.cos((i + 0.5) / 2 + ph); out.push(S(rect(Lf * i / 10, -h, Lf / 10 + 0.3, h * 3), tone(TR, c < 0 ? "deep" : "light"), { flat: true, opacity: Math.abs(c) * 0.3 * (i + 2) / 11, clip: cloth })); }
  return out;
}

/** A string of small flags from (`xa`, `ya`) to (`xb`, `yb`) sagging `sag` cm, each `fh` high, about every `gap` cm, hung by the top edge. */
function garland(r: Rng, xa: number, ya: number, xb: number, yb: number, sag: number, fh: number, gap: number): Shape[] {
  const y = (t: number) => ya + (yb - ya) * t + sag * 4 * t * (1 - t), n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya) / gap));
  const out: Shape[] = [L(Array.from({ length: 17 }, (_, i): Vec2 => [xa + (xb - xa) * i / 16, y(i / 16)]), "#EDE6D6", Math.max(0.5, fh * 0.05), 0.95)];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, a = Math.atan2(y(t + 0.01) - y(t - 0.01), (xb - xa) * 0.02) * 0.7 + r.range(-0.05, 0.05);
    out.push(...tf(flagCloth(fh, 0.05, r.range(0, 6)), mul(translate(xa + (xb - xa) * t, y(t)), mul(rotate(a), translate(-fh * 0.75, 0)))));
  }
  return out;
}

/** A small flag on a stick `len` cm above its grip (the stick goes on 8 cm below it), the cloth `fh` high. */
const stickFlag = (r: Rng, fh: number, len: number, wd: number): Shape[] => [
  { path: smooth([[0, 8], [0, -len]], false, 1), stroke: { color: "#B98A57", width: wd, cap: "round" } }, S(ellipse(0, -len - wd * 0.4, wd * 0.8), "#E0B03C"),
  ...tf(flagCloth(fh, 0.07, r.range(0, 6)), translate(wd * 0.4, -len + wd * 0.3)),
];

/**
 * A Turkish flag (red #E30A17, the crescent and the star by the flag law's measures), `kind`:
 * - `pole`: on a flagpole `h` cm tall (default 600) with a gilt ball, on a stone foot; the flag a fifth of the
 *   pole, swaying gently from its hoist; `n` poles in a row;
 * - `hand`: a small flag on a stick (20 × 30 cm), `n` of them fanned; held, the stick stands up out of the fist;
 * - `bunting`: a string of small flags across `w` cm (default 600), hung `h` cm up (default 300), sagging `sag`
 *   cm, swaying; `n` strings one above the other.
 * Held, a pole flag is one carried on a 2 m pole, and bunting a short string hanging from the hand.
 */
const flag: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "pole"), n = Math.max(1, Math.min(8, Math.round(num(p.n, 1)))), flats: FlatSpec[] = [];
  if (p.held || kind === "hand") {
    let sh: Shape[];
    if (kind === "pole" && p.held) sh = stickFlag(r, 60, 130, 3.2).map(s => s.stroke ? { ...s, path: smooth([[0, 60], [0, -130]], false, 1) } : s);
    else if (kind === "bunting" && p.held) sh = garland(r, 0, 0, 70, -6, 18, 10, 17);
    else {
      sh = [];
      for (let i = 0; i < n; i++) sh.push(...tf(stickFlag(r, 20, 46, 1.3), mul(translate((i - (n - 1) / 2) * (p.held ? 3 : 26), p.held ? 0 : -8), rotate(p.held ? (i - (n - 1) / 2) * 0.22 : r.range(-0.04, 0.04)))));
    }
    return { flats: [{ group: { shapes: sh, edge: 0.4 }, ppcm: 5, id: "flag", ...(p.held ? {} : { move: { sway: { rot: 0.05, ms: r.range(1800, 2600) }, phase: r() } }) }] };
  }
  if (kind === "bunting") {
    const w = num(p.w, 600), h = num(p.h, 300), sag = num(p.sag, w * 0.06);
    for (let k = 0; k < n; k++) flats.push({ group: { shapes: garland(r, -w / 2, -h - k * 40, w / 2, -h - k * 40 + r.range(-15, 15), sag * (1 + k * 0.35), 22, 46), edge: 0.4 }, z: -k * 20, ppcm: Math.min(3, 1900 / (w + 40)), pick: k ? false : undefined, ...(k ? {} : { id: "flag" }), move: { sway: { rot: 0.004, dy: 2.5, ms: r.range(2600, 3400) }, phase: r() } });
    return { flats };
  }
  const h = num(p.h, 600), fh = h * 0.2, pole = "#DADDDE";
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 260;
    flats.push({ group: { shapes: [
      S(rrect(x - 26, -20, 52, 20, 3), STONE), S(rect(x - 30, -24, 60, 6), tone(STONE, "light")), lines([[x - 26, -10, x + 26, -10]], tone(STONE, "deep"), 0.8, 0.5),
      P([[x - 4.5, -24, 0], [x + 4.5, -24, 0], [x + 2.4, -h, 0], [x - 2.4, -h, 0]], pole), S(rect(x + 0.6, -h, 1.8, h - 26), tone(pole, "shade"), { flat: true, opacity: 0.6 }),
      L([[x + 3.4, -h + 4], [x + 4, -40]], "#8E8A84", 0.5, 0.7), S(rect(x - 3, -42, 9, 3), "#8E8A84"), S(ellipse(x, -h - 6, 6.5), "#D9A72E"), S(ellipse(x - 2, -h - 8, 2.2), "#F6DB8A", { flat: true }),
    ], edge: 0.6 }, ppcm: Math.min(1.6, 1900 / h), ...(i ? {} : { id: "flag" }) });
    flats.push({ group: { shapes: flagCloth(fh, 0.09, r.range(0, 6)), edge: 0.6 }, x: x + 3, y: h - 6, z: 1, ppcm: Math.min(3, 1900 / (fh * 1.6)), move: { sway: { rot: 0.05, dy: 0.8, ms: r.range(2200, 3000) }, phase: r() } });
  }
  return { flats };
}, variants: { pole: { kind: "pole" }, hand: { kind: "hand" }, bunting: { kind: "bunting" } },
  meta: {
    about: "A Turkish flag by the flag law's measures: on a flagpole, a small one on a stick, or bunting strung across.",
    params: {
      kind: { type: "enum", values: ["pole", "hand", "bunting"], default: "pole" },
      n: { type: "int", min: 1, max: 8, default: 1, about: "poles, hand flags fanned, or strings of bunting" },
      h: { type: "num", min: 0, about: "pole height, or bunting's hanging height, cm (600 or 300)" },
      w: { type: "num", min: 0, default: 600, about: "bunting's span, cm" },
      sag: { type: "num", min: 0, about: "bunting's sag, cm; default 6% of w" },
    },
    terms: ["bayrak"],
    tags: ["flag"],
  } };

// ---- Railings -------------------------------------------------------------------------------------

/**
 * A railing `w` cm long (default 800), facing us, `kind`:
 * - `parapet`: a roof's low wall, `h` cm (default 95), rendered and weathered (rain streaks, a patch of bare brick,
 *   a drain hole), under a stone coping;
 * - `roof` (the default): a lower parapet (`h` 45) with an iron railing on it to about 105 cm, rusting a little;
 * - `shore`: the seaside promenade's cast-iron railing, about 100 cm, dark green, with a row of rings, ball-topped
 *   posts every 2 m, on a stone kerb;
 * - `deck`: a ferry's deck rail, painted white over a riveted bulwark, a varnished wooden handrail and life rings.
 * `color` overrides the plaster (parapet, roof) or the paint (shore, deck).
 */
const railing: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "roof"), w = num(p.w, 800), x0 = -w / 2, x1 = w / 2, sh: Shape[] = [];
  const rails = (ys: number[], th: number, c: string) => ys.forEach(y => sh.push(S(rrect(x0, y, w, th, th / 2), c), L([[x0 + 2, y + th * 0.3], [x1 - 2, y + th * 0.3]], tone(c, "light"), th * 0.25, 0.5)));
  if (kind === "parapet" || kind === "roof") {
    const h = num(p.h, kind === "roof" ? 45 : 95), c = hex(p.color, r.pick(PLASTER));
    sh.push(S(rect(x0, -h, w, h), c), S(rect(x0, -h, w, 7), tone(c, "deep"), { flat: true, opacity: 0.25 }), S(rect(x0, -9, w, 9), tone(c, "deep"), { flat: true, opacity: 0.22 }));
    for (let i = 0; i < w / 70; i++) sh.push(S(rrect(r.range(x0 + 6, x1 - 24), -h + 6, r.range(5, 16), r.range(h * 0.25, h * 0.75), 4), tone(c, "deep"), { flat: true, opacity: r.range(0.06, 0.14) }));
    if (h > 60) {
      const bx = r.range(x0 + 30, x1 - 110), by = -h * r.range(0.45, 0.7), segs: number[][] = [];
      for (let k = 1; k < 4; k++) segs.push([bx + 2, by + k * 8.5, bx + 74, by + k * 8.5]);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) segs.push([bx + 8 + j * 18 + (k % 2) * 9, by + k * 8.5, bx + 8 + j * 18 + (k % 2) * 9, by + k * 8.5 + 8.5]);
      sh.push(P([[bx, by + 6], [bx + 20, by - 2], [bx + 60, by + 1], [bx + 78, by + 10], [bx + 70, by + 32], [bx + 30, by + 36], [bx + 4, by + 28]], "#B88468"), lines(segs, "#E3D6C0", 1.2, 0.6));
      const dx = r.range(x0 + 40, x1 - 60);
      sh.push(S(rrect(dx, -16, 26, 12, 2), "#4A4440"), S(rrect(dx + 6, -4, 14, 4, 2), "#6E8E6A", { flat: true, opacity: 0.5 }));
    }
    for (let i = 0; i < w / 50; i++) sh.push(S(ellipse(r.range(x0, x1), -2, r.range(6, 18), r.range(2, 4)), "#6E8E6A", { flat: true, opacity: 0.35 }));
    // the coping: stone slabs with joints
    const segs: number[][] = [];
    for (let x = x0 + r.range(30, 70); x < x1; x += r.range(60, 80)) segs.push([x, -h - 9, x, -h + 1]);
    sh.push(S(rect(x0 - 4, -h - 9, w + 8, 10), STONE), S(rect(x0 - 4, -h - 9, w + 8, 2.5), tone(STONE, "light"), { flat: true }), S(rect(x0 - 4, -h - 1, w + 8, 2), tone(STONE, "deep"), { flat: true, opacity: 0.5 }), lines(segs, tone(STONE, "deep"), 0.8, 0.6));
    if (kind === "roof") {
      const iron = "#3B4247", top = h + 62, n = Math.max(2, Math.round(w / 150));
      for (let i = 0; i <= n; i++) { const x = x0 + 4 + i * (w - 8) / n; sh.push(S(rect(x - 2.6, -top, 5.2, top - h - 8), iron), S(rect(x - 4, -h - 12, 8, 4), iron)); }
      sh.push(S(bars(x0 + 10, x1 - 10, 12, 1.8, -top + 2, -h - 9), iron));
      rails([-top - 3, -h - 22], 4.5, iron);
      for (let i = 0; i < w / 60; i++) sh.push(S(ellipse(r.range(x0, x1), r.pick([-top - 1, -h - 20]), r.range(1.5, 4), 1.4), "#9A5B38", { flat: true, opacity: 0.6 }));
    }
  } else if (kind === "shore") {
    const c = hex(p.color, "#2F4A3E"), top = 100, segs: number[][] = [];
    for (let x = x0 + 45; x < x1; x += 90) segs.push([x, -22, x, 0]);
    sh.push(S(rect(x0 - 6, -22, w + 12, 22), STONE), S(rect(x0 - 6, -22, w + 12, 3), tone(STONE, "light"), { flat: true }), lines(segs, tone(STONE, "deep"), 0.8, 0.55));
    sh.push(S(bars(x0 + 6, x1 - 6, 11, 1.7, -top + 2, -30), c));
    const rings = new Path();
    for (let x = x0 + 11.5; x < x1 - 6; x += 11) rings.add(ellipse(x, -top + 11, 4.6)).add(ellipse(x, -top + 11, 3.2));
    sh.push(S(rings, c, { evenodd: true }));
    rails([-top - 2, -top + 18, -34], 4, c);
    for (let x = x0 + 6; x <= x1 - 5; x += Math.max(150, (w - 12) / Math.round((w - 12) / 200))) {
      sh.push(S(rect(x - 4, -top, 8, top - 22), c), S(rect(x - 7, -36, 14, 14), tone(c, "light")), S(rect(x - 5.5, -top - 2, 11, 4), tone(c, "light")), S(ellipse(x, -top - 8, 6), c), S(ellipse(x - 2, -top - 10, 2), tone(c, "light"), { flat: true }));
    }
  } else {
    const c = hex(p.color, "#F4F2EC"), top = 100, dots = new Path();
    for (let x = x0 + 7; x < x1; x += 14) dots.add(ellipse(x, -44, 0.9)).add(ellipse(x, -5, 0.9));
    sh.push(S(rect(x0, -48, w, 48), c), S(dots, tone(c, "shade"), { flat: true }), S(rect(x0, -10, w, 10), tone(c, "shade"), { flat: true, opacity: 0.3 }), S(rect(x0 - 2, -52, w + 4, 5), tone(c, "shade")));
    for (let x = x0 + 4; x <= x1 - 3; x += Math.max(120, (w - 8) / Math.round((w - 8) / 150))) sh.push(S(rrect(x - 2.2, -top, 4.4, top - 50, 2), c), S(rect(x + 0.4, -top, 1.4, top - 52), tone(c, "shade"), { flat: true, opacity: 0.5 }));
    rails([-66, -83], 3.4, c);
    sh.push(S(rrect(x0 - 4, -top - 6, w + 8, 8, 3), WOOD), S(rect(x0 - 2, -top - 5, w + 4, 2), tone(WOOD, "light"), { flat: true, opacity: 0.7 }));
    // life rings, orange with white bands, here and there on the bulwark
    for (let x = x0 + r.range(60, 160); x < x1 - 40; x += r.range(320, 520)) {
      const ring = ellipse(x, -26, 21).add(ellipse(x, -26, 12)), band = (a: number) => S(rect(-3.5, -24, 7, 48).transform(mul(translate(x, -26), rotate(a))), "#FFFFFF", { flat: true, clip: ring });
      sh.push(S(ring, "#E8662C", { evenodd: true }), band(0.6), band(0.6 + Math.PI / 2), L([[x - 22, -43], [x, -49], [x + 22, -43]], "#D9CDB0", 1, 0.9));
    }
  }
  return { flats: [{ group: { shapes: sh, edge: 0.6 }, ppcm: Math.min(1.6, 1900 / (w + 40)) }] };
}, variants: { parapet: { kind: "parapet" }, roof: { kind: "roof" }, shore: { kind: "shore" }, deck: { kind: "deck" } },
  meta: {
    about: "A railing facing us: a roof parapet, a parapet with an iron rail, the seaside promenade's, or a ferry's deck rail.",
    params: {
      kind: { type: "enum", values: ["parapet", "roof", "shore", "deck"], default: "roof" },
      w: { type: "num", min: 0, default: 800, about: "length, cm" },
      h: { type: "num", min: 0, about: "parapet height, cm (45 roof, 95 parapet)" },
      color: { type: "color", about: "the plaster or paint; default seeded or by kind" },
    },
    tags: ["rail"],
  } };

// ---- A park, a church gate ------------------------------------------------------------------------

const LEAVES: Record<string, string[]> = { summer: ["#5F8F55", "#6E9C5C", "#4E7A48", "#7FA35F"], autumn: ["#C98A3A", "#D9A441", "#B5652A", "#9AA04A"], bare: [] };

/** A tree: its trunk (bark patches, the first branches) from the ground to `th`, and its crown as a flat of its own that stirs. */
function tree(r: Rng, x: number, z: number, th: number, cw: number, season: string): FlatSpec[] {
  const bark = r.pick(["#8C7B6A", "#9A8C7A", "#7E6E60"]), lv = LEAVES[season] ?? LEAVES.summer, br: number[][] = [];
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + r.range(-0.9, 0.9), l = cw * r.range(0.25, 0.45); br.push([x, -th + 10, x + Math.cos(a) * l, -th + 10 + Math.sin(a) * l * 0.8]); }
  const trunk: Shape[] = [P([[x - 16, 0, 0], [x - 10, -th * 0.55], [x - 7, -th - 4, 0], [x + 7, -th - 4, 0], [x + 11, -th * 0.55], [x + 19, 0, 0]], bark), lines(br, bark, lv.length ? 6 : 5, 1)];
  for (let k = 0; k < 6; k++) trunk.push(S(ellipse(x + r.range(-6, 6), -r.range(20, th), r.range(3, 6), r.range(5, 10)), tone(bark, r.chance(0.5) ? "light" : "shade"), { flat: true, opacity: 0.6 }));
  const out: FlatSpec[] = [{ group: { shapes: trunk, edge: 0.8 }, z, ppcm: 0.8 }];
  if (!lv.length) return out;
  // the crown: overlapping clumps, lit from the upper left
  const crown: Shape[] = [], m = r.int(7, 10);
  for (let k = 0; k < m; k++) {
    const a = k / m * Math.PI * 2, rr = cw * r.range(0.18, 0.26), cx = Math.cos(a) * cw * 0.28, cy = -cw * 0.42 + Math.sin(a) * cw * 0.22, c = r.pick(lv);
    crown.push(S(ellipse(cx, cy, rr, rr * 0.85), c), S(ellipse(cx - rr * 0.3, cy - rr * 0.3, rr * 0.45, rr * 0.35), tone(c, "light"), { flat: true, opacity: 0.45 }));
  }
  crown.push(S(ellipse(0, -cw * 0.45, cw * 0.3, cw * 0.26), r.pick(lv)), S(ellipse(cw * 0.12, -cw * 0.3, cw * 0.28, cw * 0.12), tone(lv[0], "deep"), { flat: true, opacity: 0.3 }));
  out.push({ group: { shapes: crown, edge: 1 }, x, y: th - cw * 0.06, z: z + 1, ppcm: 0.8, move: { sway: { rot: 0.008, dy: 1, ms: r.range(3600, 5200) }, phase: r() } });
  return out;
}

/** A two-leaf iron gate in an opening `w` wide and `h` high at x = 0: frame, spear-topped bars, a band of rings; each leaf swings on its hinge. */
function gateLeaves(w: number, h: number, c: string, z: number, ppcm: number): FlatSpec[] {
  const leaf = (xa: number): Shape[] => {
    const lw = w / 2 - 1, rings = new Path();
    for (let x = xa + 6; x < xa + lw - 4; x += 11) rings.add(ellipse(x + 5.5, -h * 0.55, 4.4)).add(ellipse(x + 5.5, -h * 0.55, 3));
    return [S(bars(xa + 6, xa + lw - 5, 11, 1.8, -h + 4, -4), c), S(spears(xa + 6, xa + lw - 5, 11, 1.8, -h + 4), c), S(rings, c, { evenodd: true }),
      S(holed(rect(xa, -h + 4, lw, h - 6), [rect(xa + 4, -h + 8, lw - 8, h - 14)]), c, { evenodd: true }), S(rect(xa, -h * 0.55 - 7, lw, 3), c), S(rect(xa, -h * 0.55 + 5, lw, 3), c)];
  };
  return [
    { group: { shapes: leaf(-w / 2 + 1), edge: 0.5 }, z, ppcm, id: "leaf_l", hinge: -w / 2 + 1, swing: -1.2 },
    { group: { shapes: leaf(1), edge: 0.5 }, z, ppcm, id: "leaf_r", hinge: w / 2 - 1, swing: 1.2 },
  ];
}

/**
 * A park seen from the street, `w` cm long (default 1200): a low stone wall with a coping, iron railings with spear
 * tips on it between square piers with caps, a clipped hedge behind them, and trees (`trees`, default one per 3 m)
 * whose crowns stir; a double iron gate at `gate` cm from the centre (default 0; `gate: false` for none) whose
 * leaves swing open, with a lantern on each gate pier that lights at dusk. `season`: `summer` (default), `autumn`, `bare`.
 * `kind: "campus"` is a university's railings: no hedge, no trees by default, dressed piers with flat caps (a perch).
 */
const parkEdge: PieceDef = { draw(p, r) {
  const campus = p.kind === "campus", w = num(p.w, 1200), x0 = -w / 2, x1 = w / 2, season = str(p.season, "summer"), gx = p.gate === false ? null : num(p.gate, 0), gw = 220, wh = 55, top = 150;
  const flats: FlatSpec[] = [], sh: Shape[] = [], glow: Shape[] = [], nt = Math.max(0, Math.round(num(p.trees, campus ? 0 : w / 300)));
  for (let i = 0; i < nt; i++) flats.push(...tree(r, x0 + (i + r.range(0.25, 0.75)) * w / nt, -r.range(160, 300), r.range(230, 300), r.range(300, 420), season));
  // the hedge behind the railings (a campus has none)
  if (!campus) {
    const hedge: Pt[] = [[x0, 0, 0]];
    for (let x = x0; x <= x1; x += 40) hedge.push([x, -r.range(95, 120)]);
    hedge.push([x1, 0, 0]);
    const hc = season === "autumn" ? "#6E7F45" : "#4E7048", hl: Shape[] = [P(hedge, hc)];
    for (let x = x0 + 20; x < x1; x += 50) hl.push(S(ellipse(x + r.range(-10, 10), -r.range(85, 100), r.range(14, 22), r.range(8, 12)), tone(hc, "light"), { flat: true, opacity: 0.5 }));
    flats.push({ group: { shapes: hl, edge: 0.8 }, z: -40, ppcm: Math.min(1.2, 1900 / w) });
  }
  // the wall, the railings, the piers (and the gate's two, a gap between them)
  const gap = (a: number, b: number): [number, number][] => gx === null || b < gx - gw / 2 || a > gx + gw / 2 ? [[a, b]] : [[a, gx - gw / 2], [gx + gw / 2, b]].filter(([u, v]) => v - u > 5) as [number, number][];
  const segs: number[][] = [];
  for (const [a, b] of gap(x0, x1)) {
    sh.push(S(rect(a, -wh, b - a, wh), STONE), S(rect(a, -wh - 6, b - a, 7), tone(STONE, "light")), S(rect(a, -8, b - a, 8), tone(STONE, "deep"), { flat: true, opacity: 0.3 }));
    for (let y = -wh + 16; y < 0; y += 16) for (let x = a + (y % 32 ? 0 : 20); x < b; x += 40) segs.push([x, y, x + 40, y], [x, y, x, y + 16]);
    sh.push(S(bars(a + 8, b - 8, 12, 2, -top + 6, -wh - 6), IRON), S(spears(a + 8, b - 8, 12, 2, -top + 6), IRON), S(rect(a, -top + 18, b - a, 3), IRON), S(rect(a, -wh - 16, b - a, 3), IRON));
  }
  sh.push(lines(segs, tone(STONE, "deep"), 0.7, 0.4));
  const piers = [x0 + 12, x1 - 12];
  for (let x = x0 + 300; x < x1 - 150; x += 300) if (gx === null || Math.abs(x - gx) > gw / 2 + 60) piers.push(x);
  if (gx !== null) piers.push(gx - gw / 2 - 20, gx + gw / 2 + 20);
  for (const x of piers) {
    const tall = gx !== null && Math.abs(Math.abs(x - gx) - gw / 2 - 20) < 1, ph = tall ? top + 50 : top + 10;
    // a campus's piers are dressed stone with flat caps, wide enough to perch on
    sh.push(S(rect(x - 20, -ph, 40, ph), tone(STONE, "light")), S(rect(x + 8, -ph, 12, ph), tone(STONE, "shade"), { flat: true, opacity: 0.5 }), S(rect(x - 25, -ph - 8, 50, 9), STONE), campus ? S(rect(x - 27, -ph - 14, 54, 7), tone(STONE, "light")) : P([[x - 22, -ph - 8, 0], [x, -ph - 26, 0], [x + 22, -ph - 8, 0]], tone(STONE, "shade")));
    if (campus) for (let y = -ph + 30; y < -10; y += 30) sh.push(L([[x - 20, y], [x + 20, y]], tone(STONE, "deep"), 0.7, 0.4));
    if (tall) { sh.push(S(rect(x - 2, -ph - 34, 4, 10), IRON), P([[x - 9, -ph - 34, 0], [x - 7, -ph - 58, 0], [x + 7, -ph - 58, 0], [x + 9, -ph - 34, 0]], IRON), P([[x - 10, -ph - 58, 0], [x, -ph - 68, 0], [x + 10, -ph - 58, 0]], IRON)); glow.push(S(rect(x - 6, -ph - 55, 12, 18), LAMP, { flat: true }), S(ellipse(x, -ph - 46, 26), LAMP, { flat: true, opacity: 0.15 })); }
  }
  flats.push({ group: { shapes: sh, edge: 0.6 }, ppcm: Math.min(1.4, 1900 / (w + 60)), emissive: glow.length ? { shapes: glow, edge: 0 } : undefined, switch: false });
  if (gx !== null) flats.push(...gateLeaves(gw, top + 20, IRON, 1, 1.4).map(f => ({ ...f, x: gx })));
  return { flats, lights: gx === null ? undefined : [{ x: gx, y: top + 60, z: 30, color: "#FFE2B0", radius: 3, intensity: 0.5, at: ["dusk", "night"], switch: false }] };
}, variants: { autumn: { season: "autumn" }, bare: { season: "bare", trees: 3 }, campus: { kind: "campus", w: 600 } },
  meta: {
    about: "A park seen from the street: a low wall with iron railings, piers, a hedge, trees, and an iron gate that swings open. Or a campus's railings: no hedge or trees, dressed piers with flat caps to perch on.",
    params: {
      kind: { type: "enum", values: ["park", "campus"], default: "park", about: "a park's edge, or a campus's railings and gate" },
      w: { type: "num", min: 0, default: 1200, about: "length, cm" },
      season: { type: "enum", values: ["summer", "autumn", "bare"], default: "summer" },
      trees: { type: "int", min: 0, about: "how many trees; default one per 3 m" },
      gate: { type: ["num", "bool"], default: 0, about: "the gate's place, cm from the centre; false for none" },
    },
    terms: ["park"],
    tags: ["park", "tree"],
  } };

/**
 * A church's gate in a stone wall (Feriköy has several): `w` cm of coursed stone wall (default 520), `h` high
 * (default 260), under a coping; a round-arched gateway `gw` wide (default 170) in a raised portal with a keystone,
 * a small gable and a small cross over it; a two-leaf iron gate with spear-topped bars under a fixed iron fanlight
 * (the leaves swing open); a lantern over the arch that lights at dusk; ivy over the wall (`ivy`, default on); a
 * small plaque `label` (none by default); and behind the wall a cypress and the church's belfry (`tower`, default on).
 */
const churchGate: PieceDef = { draw(p, r) {
  const w = num(p.w, 520), h = num(p.h, 260), gw = num(p.gw, 170), ar = gw / 2, spring = 185, c = hex(p.color, r.pick(["#D8CDB8", "#CFC3A8", "#DDD3C0"]));
  const pt = -(spring + ar + 36), px = ar + 32, hole = archPath(0, gw, spring), flats: FlatSpec[] = [], glow: Shape[] = [];
  // behind: a cypress and the belfry over the churchyard
  if (p.tower !== false) {
    const bx = r.pick([-1, 1]) * r.range(w * 0.15, w * 0.3), bc = tone(c, "light"), bt = 470;
    flats.push({ group: { shapes: [
      S(rect(bx - 45, -bt, 90, bt), bc), S(rect(bx + 22, -bt, 23, bt), tone(bc, "shade"), { flat: true, opacity: 0.45 }), S(archPath(bx, 40, bt - 70).move(0, -50), "#3A3530"),
      S(ellipse(bx, -bt + 64, 12, 14), "#B08A3A"), S(rect(bx - 52, -bt - 8, 104, 10), tone(bc, "shade")), P([[bx - 50, -bt - 8, 0], [bx, -bt - 64, 0], [bx + 50, -bt - 8, 0]], "#6E7B80"),
      S(rect(bx - 2, -bt - 92, 4, 30), "#3B3B40"), S(rect(bx - 10, -bt - 84, 20, 4), "#3B3B40"),
    ], edge: 0.8 }, z: -260, ppcm: 1 });
    const cx = -Math.sign(bx) * r.range(w * 0.2, w * 0.4);
    flats.push({ group: { shapes: [S(rect(cx - 4, -40, 8, 40), "#6B5444"), P([[cx, -r.range(420, 520), 0], [cx + 30, -260], [cx + 26, -80], [cx, -30, 0], [cx - 26, -80], [cx - 30, -260]], "#3F6B45"), L([[cx - 4, -400], [cx - 12, -120]], "#5E8E62", 3, 0.5)], edge: 0.8 }, z: -150, ppcm: 1 });
  }
  // the wall and the portal, cut by the arch; coursed stone, the coping, a keystone, the gable and its cross
  const segs: number[][] = [];
  for (let y = -h + 30, k = 0; y < 0; y += 30, k++) {
    segs.push([-w / 2, y, -px, y], [px, y, w / 2, y]);
    for (let x = -w / 2 + (k % 2) * 25; x < w / 2; x += 50) if (Math.abs(x) > px) segs.push([x, y, x, y + 30]);
  }
  const sh: Shape[] = [S(holed(rect(-w / 2, -h, w, h), [hole]), c, { evenodd: true }), lines(segs, tone(c, "deep"), 0.8, 0.4), S(rect(-w / 2 - 4, -h - 10, w + 8, 11), STONE), S(rect(-w / 2 - 4, -h - 10, w + 8, 3), tone(STONE, "light"), { flat: true })];
  const pc = tone(c, "light"), ring = holed(archPath(0, gw + 34, spring), [hole]);
  sh.push(S(holed(rect(-px, pt, px * 2, -pt), [hole]), pc, { evenodd: true }), S(ring, tone(STONE, "light"), { evenodd: true }));
  const vs: number[][] = [];
  for (let k = 1; k < 9; k++) { const a = Math.PI + k * Math.PI / 9; vs.push([Math.cos(a) * ar, -spring + Math.sin(a) * ar, Math.cos(a) * (ar + 17), -spring + Math.sin(a) * (ar + 17)]); }
  sh.push(lines(vs, tone(STONE, "deep"), 0.8, 0.6), P([[-10, -spring - ar + 3, 0], [10, -spring - ar + 3, 0], [13, -spring - ar - 22, 0], [-13, -spring - ar - 22, 0]], STONE));
  sh.push(S(rect(-px - 8, pt - 10, px * 2 + 16, 12), STONE), P([[-px - 4, pt - 10, 0], [0, pt - 52, 0], [px + 4, pt - 10, 0]], pc), S(rect(-px - 2, -spring - 2, 24, 8), STONE), S(rect(px - 22, -spring - 2, 24, 8), STONE));
  sh.push(S(rect(-2.5, pt - 92, 5, 42), "#3B3B40"), S(rect(-11, pt - 82, 22, 5), "#3B3B40"));
  if (p.label) sh.push(S(rect(px + 18, -150, 66, 34), "#B9A27A"), S(rect(px + 20, -148, 62, 30), "#E9E2D2"));
  // the lantern over the arch on a bracket
  const ly = pt + 6;
  sh.push(L([[0, ly - 8], [0, ly + 4]], "#3B3B40", 1.6, 1), P([[-8, ly + 4, 0], [-6, ly + 24, 0], [6, ly + 24, 0], [8, ly + 4, 0]], "#3B3B40"), S(rect(-9, ly + 1, 18, 4), "#3B3B40"));
  glow.push(S(rect(-5, ly + 7, 10, 15), LAMP, { flat: true }), S(ellipse(0, ly + 14, 30), LAMP, { flat: true, opacity: 0.14 }));
  // ivy spilling over the wall on one side
  if (p.ivy !== false) {
    const side = r.pick([-1, 1]), iv = ["#4E7A48", "#5F8F55", "#3F6B45"];
    for (let k = 0; k < 40; k++) { const x = side * r.range(px + 20, w / 2 - 6), y = -h - 4 + Math.abs(r() * r()) * h * 0.9; sh.push(S(ellipse(x, y, r.range(5, 10), r.range(4, 7)), r.pick(iv))); }
  }
  flats.push({ group: { shapes: sh, edge: 0.7 }, ppcm: Math.min(1.6, 1900 / (w + 40)), shadow: "drop", emissive: { shapes: glow, edge: 0 }, switch: false, text: p.label ? [{ text: String(p.label), x: px + 21, y: -147, w: 60, h: 28, font: "print", color: "#2B2420" }] : undefined });
  // the fanlight: radiating iron bars in the arch, and the leaves under it
  const fan: number[][] = [];
  for (let k = 1; k < 8; k++) { const a = Math.PI + k * Math.PI / 8; fan.push([0, -spring, Math.cos(a) * ar, -spring + Math.sin(a) * ar]); }
  flats.push({ group: { shapes: [lines(fan, IRON, 1.6, 1), S(holed(ellipse(0, -spring, ar * 0.42), [ellipse(0, -spring, ar * 0.32)]), IRON, { evenodd: true, clip: rect(-ar, -spring - ar, gw, ar) }), S(rect(-ar, -spring - 2, gw, 3), IRON)], edge: 0.4 }, z: 0.5, ppcm: 1.6 });
  flats.push(...gateLeaves(gw, spring - 2, IRON, 1, 1.6));
  return { flats, lights: [{ x: 0, y: -ly - 14, z: 25, color: "#FFE2B0", radius: 3, intensity: 0.5, at: ["dusk", "night"], switch: false } satisfies LightSpec] };
}, variants: { plain: { tower: false, ivy: false } },
  meta: {
    about: "A church's arched gate in a stone wall, with iron gate leaves, a lantern, ivy, and the belfry and a cypress behind.",
    params: {
      w: { type: "num", min: 0, default: 520, about: "wall length, cm" },
      h: { type: "num", min: 0, default: 260, about: "wall height, cm" },
      gw: { type: "num", min: 0, default: 170, about: "gateway width, cm" },
      color: { type: "color", about: "the wall's stone; default seeded" },
      ivy: { type: "bool", default: true },
      tower: { type: "bool", default: true, about: "the belfry and cypress behind" },
      label: { type: "text", about: "a small plaque's words" },
    },
    terms: ["kilise"],
    tags: ["gate", "building"],
  } };

// ---- The market ------------------------------------------------------------------------------------

const PRODUCE = ["tomatoes", "peppers", "fruit", "greens", "cheese"];

/** A heap of `kind` in a crate `cw` wide whose top edge is at (`x`, `y`): three rows, the back one highest. */
function heap(r: Rng, kind: string, x: number, y: number, cw: number): Shape[] {
  const out: Shape[] = [];
  if (kind === "cheese") {
    // a white block with a wedge cut, a yellow kaşar wheel beside it
    out.push(S(rrect(x - cw / 2 + 2, y - 3, cw - 4, 3, 1), "#C9CED2"), S(rrect(x - cw * 0.45, y - 16, cw * 0.5, 13, 2), "#F6F1DE"), P([[x - cw * 0.45 + cw * 0.5, y - 16, 0], [x + cw * 0.12, y - 16, 0], [x + cw * 0.05, y - 3, 0]], "#ECE3C2"));
    out.push(S(ellipse(x + cw * 0.24, y - 9, cw * 0.2, 8), "#E9B949"), S(ellipse(x + cw * 0.24, y - 11, cw * 0.15, 4), tone("#E9B949", "light"), { flat: true, opacity: 0.6 }), S(ellipse(x - cw * 0.3, y - 13, 3, 1.5), "#FFFFFF", { flat: true, opacity: 0.7 }));
    return out;
  }
  for (let j = 0; j < 3; j++) {
    const yy = y - 4 - (2 - j) * 5 - (j === 0 ? 3 : 0), n = Math.round(cw / (kind === "greens" ? 11 : 8)) - j % 2;
    for (let i = 0; i < n; i++) {
      const xx = x - cw / 2 + 5 + (i + (j % 2) * 0.5) * (cw - 10) / Math.max(1, n - 0.5) + r.range(-1, 1), bump = -Math.sin((i + 0.5) / n * Math.PI) * 4;
      if (kind === "tomatoes" || kind === "fruit") {
        const c = kind === "tomatoes" ? r.pick(["#D9382B", "#E0472F", "#C9302A"]) : r.pick(["#F29A2E", "#F29A2E", "#C8322E", "#9BC24A", "#F2CF3A"]), rr = r.range(3.8, 4.6);
        out.push(S(ellipse(xx, yy + bump, rr, rr * 0.92), c), S(ellipse(xx - rr * 0.35, yy + bump - rr * 0.35, rr * 0.3, rr * 0.22), "#FFFFFF", { flat: true, opacity: 0.45 }));
        if (kind === "tomatoes") out.push(S(ellipse(xx + 0.4, yy + bump - rr * 0.8, 1.6, 0.8), "#4E7A48", { flat: true }));
      } else if (kind === "peppers") {
        const c = r.pick(["#4E9A3A", "#5FA845", "#3F7F33", "#D9382B", "#F2B705"]), a = r.range(-0.5, 0.5);
        out.push(S(ellipse(0, 0, 2.6, 7).transform(mul(translate(xx, yy + bump), rotate(a))), c), S(rect(-0.6, -9, 1.2, 3).transform(mul(translate(xx, yy + bump), rotate(a))), "#3F6B35"));
      } else {
        const c = r.pick(["#3F7F3A", "#4E9A3A", "#5E8E3A"]);
        out.push(L([[xx, yy + bump + 4], [xx, yy + bump - 6]], "#8DB86A", 1.4, 1), S(ellipse(xx - 2, yy + bump - 9, 5, 4), c), S(ellipse(xx + 2.5, yy + bump - 11, 4.5, 3.6), tone(c, "light")), S(rect(xx - 2, yy + bump - 2, 4, 1.4), "#C9302A", { flat: true }));
      }
    }
  }
  return out;
}

/**
 * The Saturday market, `kind`:
 * - `gate`: its gate, two painted steel posts `w` apart (default 520) with a bar between them `h` up (default 380),
 *   a banner hung from it with `label` on it (default "FERİKÖY PAZARI"), a string of pennants over it and two lamps;
 * - `stall` (the default): a stall `w` wide (default 260): a striped awning (`color`) on poles with bags hung from
 *   one, a trestle table at counter height (86 cm) under a cloth, crates of mixed produce tilted towards the buyer,
 *   a price tag on a stick in each (`prices`, a list, default "80 TL", "60 TL"…), a scale, crates and sacks behind;
 * - `tomatoes`, `peppers`, `fruit`, `greens`, `cheese`: a stall of that alone.
 */
const market: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "stall");
  if (kind === "gate") {
    const w = num(p.w, 520), h = num(p.h, 380), c = hex(p.color, "#3E7A5A"), bw = w - 70, glow: Shape[] = [];
    const sh: Shape[] = [];
    for (const x of [-w / 2, w / 2]) sh.push(S(rrect(x - 18, -24, 36, 24, 3), STONE), S(rect(x - 6, -h - 50, 12, h + 30), c), S(rect(x - 3, -h - 50, 3, h + 30), tone(c, "light"), { flat: true, opacity: 0.6 }), S(ellipse(x, -h - 54, 8), c));
    sh.push(S(rect(-w / 2, -h - 6, w, 10), c), S(rect(-w / 2, -h - 6, w, 2.5), tone(c, "light"), { flat: true }));
    sh.push(L(Array.from({ length: 17 }, (_, i): Vec2 => [-w / 2 + w * i / 16, -h - 44 + 104 * i / 16 * (1 - i / 16)]), "#EDE6D6", 0.9, 0.95));
    for (let i = 0, n = Math.round(w / 26); i < n; i++) { const t = (i + 0.5) / n, x = -w / 2 + w * t, y = -h - 44 + 26 * 4 * t * (1 - t); sh.push(P([[x - 9, y, 0], [x + 9, y, 0], [x, y + 16, 0]], ["#E30A17", "#F2B705", "#2F6DB5", "#3E9A5A", "#FFFFFF"][i % 5])); }
    // the banner on its ties: cream, green bands, a red rule
    const by = -h + 14;
    sh.push(lines([-0.45, -0.15, 0.15, 0.45].map(k => [k * bw, -h + 4, k * bw, by + 2]), "#5B5048", 1, 0.9));
    sh.push(S(rrect(-bw / 2, by, bw, 92, 2), "#F7F3EA"), S(rect(-bw / 2, by, bw, 12), "#3E8A4E", { flat: true }), S(rect(-bw / 2, by + 80, bw, 12), "#3E8A4E", { flat: true }), S(rect(-bw / 2, by + 14, bw, 2.5), "#D9382B", { flat: true }), S(rect(-bw / 2, by + 75.5, bw, 2.5), "#D9382B", { flat: true }));
    for (const k of [-0.5, 0.5]) sh.push(S(ellipse(k * bw + (k < 0 ? 8 : -8), by + 4, 1.6), "#9AA0A6"));
    sh.push(S(rect(-bw / 2, by, bw, 92), tone("#F7F3EA", "deep"), { flat: true, opacity: 0.08, clip: rect(-bw / 2, by + 60, bw, 32) }));
    for (const k of [-0.3, 0.3]) { const x = k * w; sh.push(S(rrect(x - 10, -h - 2, 20, 9, 2), "#3B3B40"), P([[x - 9, -h + 7, 0], [x + 9, -h + 7, 0], [x + 12, -h + 14, 0], [x - 12, -h + 14, 0]], "#2E3338")); glow.push(S(rect(x - 11, -h + 10, 22, 4), LAMP, { flat: true }), S(ellipse(x, -h + 30, 40, 24), LAMP, { flat: true, opacity: 0.12 })); }
    const label = str(p.label, "FERİKÖY PAZARI");
    return { flats: [{ group: { shapes: sh, edge: 0.6 }, ppcm: Math.min(1.6, 1900 / (w + 60)), emissive: { shapes: glow, edge: 0 }, switch: false, text: label ? [{ text: label, x: -bw / 2 + 10, y: by + 19, w: bw - 20, h: 54, font: "print", weight: 700, color: "#2E5E3E" } satisfies TextSpec] : undefined }] };
  }
  const w = num(p.w, 260), T = 86, flats: FlatSpec[] = [], sh: Shape[] = [], text: TextSpec[] = [];
  const cloth = r.pick(["#3E6E8E", "#4E7A48", "#7A5034"]), c = hex(p.color, ["#2F6DB5", "#D9534A", "#2F8C88", "#E0A83A"][r.int(0, 3)]), n = Math.max(1, Math.floor((w - 50) / 58)), cw = (w - 50) / n - 6;
  const prices = Array.isArray(p.prices) ? p.prices.map(String) : typeof p.prices === "string" ? [p.prices] : ["80 TL", "60 TL", "45 TL", "30 TL", "120 TL"];
  // behind: crates stacked on the ground and a sack
  const back: Shape[] = [];
  for (const sx of [-w * 0.32, w * 0.3]) for (let k = 0; k < r.int(2, 3); k++) { const cc = r.pick(["#C99A68", "#3E7AB5", "#4E9A5A"]); back.push(S(rect(sx - 28, -24 - k * 24, 56, 23), cc), lines([[sx - 26, -12 - k * 24, sx + 26, -12 - k * 24]], tone(cc, "deep"), 1, 0.5)); }
  back.push(P([[-w * 0.05 - 24, 0, 0], [-w * 0.05 + 24, 0, 0], [-w * 0.05 + 20, -46], [-w * 0.05, -56], [-w * 0.05 - 20, -46]], "#C9B48A"), lines([[-w * 0.05 - 14, -44, -w * 0.05 + 14, -44]], "#8E7A52", 1.4, 0.8));
  flats.push({ group: { shapes: back, edge: 0.5 }, z: -70, ppcm: 2 });
  // poles, the awning and its valance
  for (const x of [-w / 2 + 4, w / 2 - 4]) sh.push(S(rect(x - 2.5, -236, 5, 236), "#9AA0A6"));
  const aw = rect(-w / 2 - 14, -258, w + 28, 30), stripes = new Path();
  for (let x = -w / 2 - 14; x < w / 2 + 14; x += 36) stripes.add(rect(x, -284, 18, 70));
  const val = new Path();
  for (let x = -w / 2 - 14; x < w / 2 + 14; x += 18) val.add(ellipse(x + 9, -228, 9, 8));
  sh.push(P([[-w / 2 - 14, -258, 0], [w / 2 + 14, -258, 0], [w / 2, -282, 0], [-w / 2, -282, 0]], tone(c, "shade")), S(aw, "#F7F3EA"), S(stripes, c, { flat: true, clip: aw }), S(val, c, { clip: rect(-w / 2 - 14, -228, w + 28, 9) }), S(rect(-w / 2 - 14, -230, w + 28, 3), tone(c, "deep"), { flat: true, opacity: 0.3 }));
  for (let k = 0; k < 4; k++) sh.push(P([[-w / 2 + 6 + k * 3, -200 + k * 4], [-w / 2 + 14 + k * 3, -200 + k * 4], [-w / 2 + 16 + k * 3, -168 + k * 4], [-w / 2 + 4 + k * 3, -168 + k * 4]], k % 2 ? "#F4F1EA" : "#7DA6D8", { opacity: 0.92 }));
  // the table and its cloth, the crates, their heaps and tags
  sh.push(S(rect(-w / 2 + 8, -T, w - 16, 6), WOOD), S(rect(-w / 2 + 10, -T + 5, w - 20, T - 6), cloth), S(rect(-w / 2 + 10, -T + 5, w - 20, 6), tone(cloth, "deep"), { flat: true, opacity: 0.35 }));
  for (let x = -w / 2 + 30; x < w / 2 - 20; x += 30) sh.push(L([[x, -T + 12], [x + r.range(-4, 4), -6]], tone(cloth, "shade"), 2, 0.4));
  const kinds = PRODUCE.includes(kind) ? [kind] : PRODUCE.slice(0, 4);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 16 + cw / 2 + i * (cw + 6), k = kinds.length > 1 ? r.pick(kinds) : kinds[0], crate = k === "cheese" ? "#C9CED2" : r.pick(["#C99A68", "#B98A57", "#3E7AB5"]), y = -T - 18;
    sh.push(P([[x - cw / 2, -T, 0], [x + cw / 2, -T, 0], [x + cw / 2 + 2, y, 0], [x - cw / 2 - 2, y, 0]], crate), lines([[x - cw / 2, -T - 9, x + cw / 2, -T - 9]], tone(crate, "deep"), 1, 0.5), ...heap(r, k, x, y, cw));
    const tx = x + cw * 0.18, ty = y - 34;
    sh.push(L([[tx, y - 4], [tx, ty + 10]], "#B98A57", 0.9, 1), S(rect(tx - 9, ty, 18, 11), "#FBF7EE"), S(rect(tx - 9, ty, 18, 2), "#D9382B", { flat: true }));
    text.push({ text: prices[i % prices.length], x: tx - 8.5, y: ty + 2.2, w: 17, h: 8.4, font: "hand", weight: 700 });
  }
  // a scale at the end of the table
  const sx = w / 2 - 22;
  sh.push(S(rrect(sx - 12, -T - 9, 24, 9, 2), "#E9E6DE"), S(rect(sx - 7, -T - 7, 9, 4), "#2E3338", { flat: true }), S(ellipse(sx, -T - 12, 13, 2.6), "#C3C9CE"));
  flats.push({ group: { shapes: sh, edge: 0.6 }, ppcm: Math.min(2.5, 1900 / (w + 40)), text });
  return { flats };
}, variants: { gate: { kind: "gate" }, stall: { kind: "stall" }, tomatoes: { kind: "tomatoes" }, cheese: { kind: "cheese" } },
  meta: {
    about: "The Saturday market: its gate with a banner, or a stall of mixed produce or of one kind, with price tags.",
    params: {
      kind: { type: "enum", values: ["stall", "gate", "tomatoes", "peppers", "fruit", "greens", "cheese"], default: "stall" },
      w: { type: "num", min: 0, about: "width, cm (520 gate, 260 stall)" },
      h: { type: "num", min: 0, default: 380, about: "the gate's bar height, cm" },
      color: { type: "color", about: "the gate's posts or the stall's awning stripes" },
      label: { type: "text", default: "FERİKÖY PAZARI", about: "the gate's banner" },
      prices: { type: ["list", "text"], default: ["80 TL", "60 TL", "45 TL", "30 TL", "120 TL"], about: "price tags, one per crate (a single string too)" },
    },
    terms: ["pazar"],
    tags: ["food", "market"],
  } };

// ---- The pier and the sea --------------------------------------------------------------------------

/** A clock face of radius `R` at (`x`, `y`) showing ten past ten. */
const clock = (x: number, y: number, R: number): Shape[] => [S(ellipse(x, y, R + 3), "#3B3B40"), S(ellipse(x, y, R), "#FBF7EE"), lines([[x, y, x - R * 0.45, y - R * 0.2], [x, y, x + R * 0.3, y - R * 0.68]], "#2B2420", R * 0.12, 1)];

/**
 * A ferry pier (iskele), `w` cm along the water (default 1400). At the front its edge at deck level (y = 0), its face
 * going down to the water (concrete, a timber rubbing strip, rubber fenders, a ladder, the wet line), iron bollards
 * on it and one with a mooring rope, a yellow safety line; the gangway at `ramp` cm (default 0.3 w) hung by chains from
 * its gantry. Behind, the pier house: a canopy on posts with lamps over the ticket windows, the doors and the
 * turnstiles; an upper floor of tall windows lit at dusk; a hipped tiled roof with wide eaves; a dark blue board
 * with `name` on it (default "BEŞİKTAŞ") and a clock; `tower` raises a clock tower over the roof (Kadıköy's).
 * `color`: the walls. `house` is the house's width (default 0.82 w, at most 1300) and `hx` moves it along the pier (cm), so a
 * long quay can have its house at one end.
 */
const pier: PieceDef = { draw(p, r) {
  const w = num(p.w, 1400), bw = num(p.house, Math.min(w * 0.82, 1300)), hx = num(p.hx, 0), c = hex(p.color, r.pick(["#EFE3C8", "#E9DCC2", "#F0E6D2"])), trim = "#3E6E5E", flats: FlatSpec[] = [], lit: Shape[] = [], glow: Shape[] = [];
  const hs: Shape[] = [], b0 = -bw / 2, b1 = bw / 2, name = str(p.name, "BEŞİKTAŞ");
  // the house: two storeys, a cornice, upper windows, a hipped roof with eaves, the name board and the clock
  hs.push(S(rect(b0, -560, bw, 560), c), S(rect(b0, -300, bw, 14), tone(c, "shade")), S(rect(b1 - 30, -560, 30, 560), tone(c, "shade"), { flat: true, opacity: 0.35 }));
  for (let x = b0 + 60; x < b1 - 70; x += 110) {
    if (Math.abs(x + 35 - 0) < 190) continue;
    const win = archPath(x + 35, 60, 120).move(0, -330);
    hs.push(S(rect(x + 1, -464, 68, 136), tone(c, "light")), S(win, "#55657A"), lines([[x + 35, -450, x + 35, -332], [x + 6, -400, x + 64, -400]], tone(c, "light"), 2.4, 1));
    lit.push(S(win, "#FFD98A", { flat: true, opacity: 0.85 }));
  }
  hs.push(S(rect(b0 - 14, -578, bw + 28, 20), tone(c, "light")), S(rect(b0 - 14, -560, bw + 28, 4), tone(c, "deep"), { flat: true, opacity: 0.4 }));
  hs.push(P([[b0 - 60, -578, 0], [b1 + 60, -578, 0], [b1 - 120, -680, 0], [b0 + 120, -680, 0]], ROOF), S(rect(b0 - 60, -584, bw + 120, 8), tone(ROOF, "deep")));
  const tiles: number[][] = [];
  for (let y = -590; y > -676; y -= 12) { const k = (y + 578) / -102, xa = b0 - 60 + k * 180, xb = b1 + 60 - k * 180; tiles.push([xa, y, xb, y]); }
  hs.push(lines(tiles, tone(ROOF, "deep"), 1.2, 0.45), S(rect(b0 + 100, -700, 26, 40), "#B9A27A"), S(rect(b1 - 160, -696, 22, 36), "#B9A27A"));
  hs.push(S(rect(-180, -540, 360, 72), "#C8B88F"), S(rect(-170, -534, 340, 60), "#1F3A6E"));
  const text: TextSpec[] = name ? [{ text: name, x: -164, y: -530, w: 328, h: 52, font: "print", weight: 700, color: "#FFFFFF" }] : [];
  if (p.tower) {
    const t = -1000;
    hs.push(S(rect(-70, t + 120, 140, -t - 120 - 560), c), S(rect(30, t + 120, 40, -t - 680), tone(c, "shade"), { flat: true, opacity: 0.35 }), S(rect(-80, t + 110, 160, 16), tone(c, "light")), P([[-84, t + 112, 0], [0, t - 10, 0], [84, t + 112, 0]], ROOF), S(rect(-3, t - 40, 6, 32), "#3B3B40"));
    hs.push(...clock(0, t + 190, 40), S(archPath(0, 44, 70).move(0, t + 340), "#55657A"));
    lit.push(S(ellipse(0, t + 190, 40), "#FFF1C2", { flat: true }));
  } else hs.push(P([[-70, -578, 0], [0, -640, 0], [70, -578, 0]], tone(c, "light")), ...clock(0, -604, 20));
  flats.push({ group: { shapes: hs, edge: 1 }, x: hx, z: -520, ppcm: Math.min(1, 1900 / (bw + 140)), switch: false, text }, ...litByTurns(lit, { x: hx, z: -519, ppcm: 1 }, 3, 0.1, 0.5));
  // the canopy over the ground floor: ticket windows, doors, turnstiles, lamps
  const cs: Shape[] = [];
  for (let k = 0; k < 3; k++) { const x = b0 + 90 + k * 110; cs.push(S(rect(x, -220, 80, 100), "#55657A"), S(rect(x, -128, 80, 10), trim), lines(Array.from({ length: 6 }, (_, i) => [x + 8 + i * 13, -218, x + 8 + i * 13, -122]), "#C3C9CE", 1.2, 0.8), S(rect(x - 6, -232, 92, 10), trim)); lit.push(S(rect(x + 2, -218, 76, 96), "#FFE2A6", { flat: true })); }
  cs.push(S(rect(-110, -250, 220, 250), trim), S(rect(-100, -240, 96, 240), "#7E93A8"), S(rect(4, -240, 96, 240), "#7E93A8"), L([[-30, -200], [-60, -60]], "#FFFFFF", 4, 0.25));
  glow.push(S(rect(-100, -240, 200, 240), "#FFE2A6", { flat: true, opacity: 0.7 }));
  for (let k = 0; k < 4; k++) { const x = 170 + k * 70; cs.push(S(rrect(x, -100, 26, 100, 3), "#9AA0A6"), S(rect(x + 3, -96, 20, 10), "#F2B705"), S(rect(x + 26, -70, 40, 5), "#C3C9CE")); }
  cs.push(S(rect(b0 - 30, -300, bw + 60, 22), tone(c, "light")), S(rect(b0 - 30, -282, bw + 60, 5), trim));
  for (let x = b0; x <= b1 + 1; x += bw / Math.round(bw / 260)) cs.push(S(rect(x - 4, -280, 8, 280), trim));
  for (let x = b0 + 130; x < b1; x += 260) { cs.push(S(ellipse(x, -272, 10, 5), "#3B3B40")); glow.push(S(ellipse(x, -268, 8, 4), LAMP, { flat: true }), S(ellipse(x, -250, 50, 26), LAMP, { flat: true, opacity: 0.12 })); }
  flats.push({ group: { shapes: cs, edge: 0.8 }, x: hx, z: -380, ppcm: Math.min(1.2, 1900 / (bw + 80)), emissive: { shapes: glow, edge: 0 }, switch: false }, ...litByTurns(lit.slice(-3), { x: hx, z: -379, ppcm: 1.2 }, 2, 0.05, 0.3));
  // the edge: its face down to the water, fenders, a ladder, bollards, the rope
  const es: Shape[] = [S(rect(-w / 2, 0, w, 140), "#A9A59C"), S(rect(-w / 2, 0, w, 6), "#D8D4CB"), S(rect(-w / 2, 8, w, 14), "#6B4A35"), S(rect(-w / 2, 100, w, 40), "#5F6A63", { flat: true, opacity: 0.45 }), S(rect(-w / 2, 2, w, 3), "#F2C14E", { flat: true })];
  for (let x = -w / 2 + 90; x < w / 2; x += 180) es.push(S(rrect(x - 9, 22, 18, 84, 6), "#2B2B2E"));
  const lx = -w * 0.38;
  es.push(S(bars(lx - 18, lx + 18, 36, 3, 6, 130), "#5B656D"), lines(Array.from({ length: 5 }, (_, i) => [lx - 18, 28 + i * 22, lx + 18, 28 + i * 22]), "#5B656D", 2.4, 1));
  for (let x = -w / 2 + 120, i = 0; x < w / 2; x += 340, i++) {
    es.push(P([[x - 12, 0, 0], [x + 12, 0, 0], [x + 8, -26], [x + 15, -32], [x + 12, -38, 0], [x - 12, -38, 0], [x - 15, -32], [x - 8, -26]], "#2B2B2E"), S(ellipse(x - 4, -34, 4, 1.6), "#6E747B", { flat: true }));
    if (i === 1) es.push(L([[x - 10, -24], [x - 40, -14], [x - 90, 4], [x - 130, 30]], "#D8C9A3", 3.2, 1), S(ellipse(x, -24, 14, 4), "#D8C9A3"));
  }
  flats.push({ group: { shapes: es, edge: 0.8 }, ppcm: Math.min(1.2, 1900 / (w + 40)) });
  // the gangway, hung from its gantry by chains
  const gx = num(p.ramp, w * 0.3), gs: Shape[] = [S(rect(gx - 120, -300, 12, 300), "#5B656D"), S(rect(gx + 108, -300, 12, 300), "#5B656D"), S(rect(gx - 126, -310, 252, 16), "#5B656D"), S(rrect(gx - 30, -330, 60, 24, 4), "#46515A")];
  gs.push(lines([[gx - 90, -294, gx - 90, -52], [gx + 90, -294, gx + 90, -52]], "#3B3B40", 2, 1), S(rect(gx - 100, -52, 200, 14), "#8E979E"), S(rect(gx - 100, -40, 200, 4), tone("#8E979E", "deep")));
  gs.push(...[gx - 96, gx + 96].flatMap(x => [S(rect(x - 2.5, -140, 5, 90), "#C3C9CE"), S(rrect(x - 3, -144, 6, 8, 2), "#C3C9CE")]), S(rect(gx - 98, -100, 196, 3), "#C3C9CE"));
  flats.push({ group: { shapes: gs, edge: 0.6 }, z: 12, ppcm: 1.2, id: "gangway" });
  return { flats, lights: [{ x: hx, y: 250, z: -330, color: "#FFE2B0", radius: 5, intensity: 0.6, at: ["dusk", "night"], switch: false }] };
}, variants: { besiktas: { name: "BEŞİKTAŞ" }, kadikoy: { name: "KADIKÖY", tower: true, color: "#F0E6D2" } },
  meta: {
    about: "A ferry pier (iskele): its edge, bollards and gangway, and the pier house behind with its name board and clock.",
    params: {
      w: { type: "num", min: 0, default: 1400, about: "length along the water, cm" },
      house: { type: "num", min: 0, about: "the pier house's width, cm; default 0.82 w, at most 1300" },
      hx: { type: "num", default: 0, about: "the pier house's place along the pier, cm from its centre" },
      color: { type: "color", about: "the walls; default seeded" },
      name: { type: "text", default: "BEŞİKTAŞ", about: "the name board" },
      tower: { type: "bool", default: false, about: "a clock tower over the roof" },
      ramp: { type: "num", about: "the gangway's place, cm; default 0.3 w" },
    },
    terms: ["iskele"],
    tags: ["water", "building"],
  } };

/**
 * The water, seen from its shore: `w` cm across (default 3000) and `d` deep (default 2400), as rows of paper waves
 * standing one behind another (a toy theatre's sea), each farther row paler and wider, the rows sliding slowly
 * both ways and bobbing. `path` lays a path of light on it under the sun (`sun`: flat bright glints) or the moon
 * (`moon`: glints that glow at night), or none (`none`, the default), at `px` cm across; at night `lights`
 * reflections of the shore's lights (default 10) shimmer on it in `lightColors`. `shore` stands a stone quay edge
 * `shore` cm high (default 80 when true) in front; `color` is the near water's colour.
 */
const sea: PieceDef = { draw(p, r) {
  const w = num(p.w, 3000), d = num(p.d, 2400), nr = Math.max(3, Math.min(8, Math.round(d / 400) + 1)), c = hex(p.color, "#2F6F86"), far = "#9DC1CF", path = str(p.path, "none"), px = num(p.px, w * 0.12);
  const nl = Math.round(num(p.lights, 10)), cols = Array.isArray(p.lightColors) ? p.lightColors.map(String) : ["#FFD27A", "#FFB65C", "#FFF1C2", "#FFE6A8"], flats: FlatSpec[] = [];
  const lx = Array.from({ length: nl }, () => r.range(-w * 0.45, w * 0.45)), lc = lx.map(() => r.pick(cols));
  for (let k = 0; k < nr; k++) {
    const t = k / (nr - 1), z = -d * t, W = w * (1 + d * t / 1400), H = 42 - t * 18, col = mix(c, far, t * 0.85), per = r.range(500, 800) * (1 + t);
    const dx = (k % 2 ? -1 : 1) * per, lo = -W / 2 - Math.max(0, dx), hi = W / 2 + Math.max(0, -dx), box = rect(lo, -H - 20, hi - lo, H + (k ? 80 : 260));
    const crest = ridge(r, per, lo, hi, H, 4 + (1 - t) * 4), rep = (s: Shape) => ({ ...s, path: copies(s.path, per, lo, hi) });
    const sh: Shape[] = [S(crest, tone(col, "light")), S(crest.move(0, 4 + (1 - t) * 2), col), S(rect(lo, -2, hi - lo, k ? 60 : 240), col, { flat: true })];
    const foam = new Path(), dark = new Path();
    for (let i = 0; i < 6; i++) { foam.add(ellipse(r.range(0, per), -H * r.range(0.3, 0.8), r.range(8, 22) * (1 + t), 1.2)); dark.add(ellipse(r.range(0, per), -H * r.range(0.05, 0.6), r.range(20, 50) * (1 + t), 1.6)); }
    sh.push(rep(S(dark, tone(col, "shade"), { flat: true, opacity: 0.5 })), rep(S(foam, "#FFFFFF", { flat: true, opacity: 0.4 })));
    flats.push({ group: { shapes: sh.map(s => ({ ...s, clip: box })), edge: 0.8 }, z, y: k ? 0 : -10, ppcm: Math.min(0.7, 1900 / (hi - lo + 20)), pick: k ? false : undefined, ...(k ? {} : { id: "sea" }), move: { scroll: { dx, ms: per / (6 + t * 4) * 1000 }, sway: { dy: 1.5 - t, ms: r.range(2800, 3800) }, phase: r() } });
    // the path of light under the sun or the moon, and the shore's lights, in two sets that shimmer by turns
    const sets: [Shape[], Shape[]][] = [[[], []], [[], []]], spread = 90 * (1 + d * t / 900);
    if (path !== "none") for (let i = 0; i < 22; i++) {
      const gx = px * (1 + t * 0.5) + (r() + r() - 1) * spread, g = S(ellipse(gx, -H * r.range(0.1, 0.9), r.range(8, 26) * (1 + t * 0.6), r.range(1.4, 2.6)), path === "sun" ? "#FFF6D8" : "#FFF4D6", { flat: true, opacity: r.range(0.6, 0.95) });
      sets[i % 2][path === "sun" ? 0 : 1].push(g);
    }
    if (t > 0.2) lx.forEach((x, i) => { for (let j = 0; j < 4; j++) sets[(i + j + k) % 2][1].push(S(ellipse(x * (1 + d * t / 1400) + r.range(-3, 3), -H * (0.15 + j * 0.22), r.range(3, 7) * (1 + t), 1.4), lc[i], { flat: true, opacity: 0.85 })); });
    sets.forEach(([day, night], s) => { if (day.length || night.length) flats.push({ group: { shapes: day.length ? day : [S(rect(0, -1, 1, 1), "#000000", { opacity: 0 })], edge: 0 }, emissive: night.length ? { shapes: night, edge: 0 } : undefined, switch: false, glowAt: 0.3, lit: 0.6, z: z + 1, ppcm: Math.min(0.7, 1900 / (W + 20)), pick: false, move: { blink: { ms: 1300 + k * 90, on: 0.6, at: s * 0.5 } } }); });
  }
  if (p.shore) {
    const sh = num(p.shore, 80) > 1 ? num(p.shore, 80) : 80, segs: number[][] = [];
    for (let y = -sh + 40; y < 0; y += 34) for (let x = -w / 2 + (y % 68 ? 0 : 35); x < w / 2; x += 70) segs.push([-w / 2, y, w / 2, y], [x, y, x, y + 34]);
    flats.push({ group: { shapes: [S(rect(-w / 2, -sh, w, sh + 20), STONE), lines(segs, tone(STONE, "shade"), 1, 0.5), S(rect(-w / 2 - 6, -sh - 8, w + 12, 12), tone(STONE, "light")), S(rect(-w / 2, -22, w, 30), "#56625B", { flat: true, opacity: 0.5 })], edge: 0.8 }, z: 60, ppcm: Math.min(0.8, 1900 / (w + 20)) });
  }
  return { flats };
}, variants: { sun: { path: "sun" }, moon: { path: "moon", lights: 14 }, quay: { shore: true } },
  meta: {
    about: "The sea as rows of sliding paper waves, a path of sun or moon light, shore lights shimmering at night, a quay edge.",
    params: {
      w: { type: "num", min: 0, default: 3000, about: "width, cm" },
      d: { type: "num", min: 0, default: 2400, about: "depth, cm" },
      color: { type: "color", default: "#2F6F86", about: "the near water" },
      path: { type: "enum", values: ["none", "sun", "moon"], default: "none", about: "a path of light on the water" },
      px: { type: "num", about: "the path's place across, cm; default 0.12 w" },
      lights: { type: "int", min: 0, default: 10, about: "reflections of the shore's lights at night" },
      lightColors: { type: "list", about: "their colours (hex)" },
      shore: { type: ["bool", "num"], default: false, about: "a stone quay edge in front (a number over 1 is its height, cm; default 80)" },
    },
    terms: ["deniz"],
    tags: ["water"],
  } };

// ---- Landmarks: stylised paper silhouettes drawn from description (owner's decision D-landmarks) ------------

const LEAD = "#7E8A90";
/** A round-headed window `w` wide and `h` tall, its sill at (`x`, `y`). */
const archWin = (x: number, y: number, w: number, h: number) => archPath(x, w, h - w / 2).move(0, y);
/** A dome on its drum: the drum `w` wide from `y` up `dh`, the dome `w/2` across rising `rise`, a finial; returns the shapes. */
function dome(x: number, y: number, w: number, dh: number, rise: number, c: string, cap = LEAD): Shape[] {
  const top = y - dh;
  return [S(rect(x - w / 2, top, w, dh + 1), c), S(rect(x + w * 0.2, top, w * 0.3, dh), tone(c, "shade"), { flat: true, opacity: 0.4 }), S(rect(x - w / 2 - 3, top - 3, w + 6, 5), tone(c, "light")),
    P([[x - w / 2, top, 0], ...arcPoints(x, top, w / 2, rise, Math.PI * 1.06, Math.PI * 1.94, 8), [x + w / 2, top, 0]], cap), S(ellipse(x - w * 0.18, top - rise * 0.55, w * 0.1, rise * 0.25), tone(cap, "light"), { flat: true, opacity: 0.4 }),
    S(rect(x - w * 0.012 - 1, top - rise - w * 0.12, w * 0.024 + 2, w * 0.13), "#C9A43A")];
}
/** A minaret from `y` up `h`, `wd` thick, a balcony (şerefe) per `n`, a pointed lead cap; its balconies light at night. */
function minaret(x: number, y: number, h: number, wd: number, c: string, n: number, lit: Shape[]): Shape[] {
  const out: Shape[] = [S(rect(x - wd / 2, y - h, wd, h), c), S(rect(x + wd * 0.1, y - h, wd * 0.4, h), tone(c, "shade"), { flat: true, opacity: 0.35 }), P([[x - wd * 0.6, y - h, 0], [x, y - h - wd * 4.2, 0], [x + wd * 0.6, y - h, 0]], LEAD), S(rect(x - 0.5, y - h - wd * 5.2, 1, wd), "#C9A43A")];
  for (let k = 0; k < n; k++) { const by = y - h * (0.62 + k * 0.17); out.push(S(rect(x - wd * 0.95, by, wd * 1.9, wd * 0.5), tone(c, "light")), S(rect(x - wd * 0.8, by + wd * 0.5, wd * 1.6, wd * 0.35), tone(c, "deep"), { flat: true, opacity: 0.4 })); lit.push(S(rect(x - wd * 0.95, by - wd * 0.2, wd * 1.9, wd * 0.6), LAMP, { flat: true })); }
  return out;
}
/** A classical Ottoman mosque at scale `s` (about 130 s across, its dome 70 s up) on the line `y`: the great dome, half-domes, small domes, `mins` minarets. */
function mosque(x: number, y: number, s: number, mins: number, c: string, lit: Shape[]): Shape[] {
  const out: Shape[] = [S(rect(x - 62 * s, y - 26 * s, 124 * s, 26 * s), c), S(rect(x + 30 * s, y - 26 * s, 32 * s, 26 * s), tone(c, "shade"), { flat: true, opacity: 0.35 })];
  for (const k of [-1, 1]) out.push(P([[x + k * 22 * s, y - 26 * s, 0], ...arcPoints(x + k * 40 * s, y - 26 * s, 18 * s, 14 * s, Math.PI, Math.PI * 2, 6), [x + k * 58 * s, y - 26 * s, 0]], LEAD), S(ellipse(x + k * 52 * s, y - 27 * s, 7 * s, 6 * s), LEAD));
  out.push(P([[x - 34 * s, y - 34 * s, 0], ...arcPoints(x, y - 34 * s, 34 * s, 20 * s, Math.PI, Math.PI * 2, 6), [x + 34 * s, y - 34 * s, 0]], LEAD), ...dome(x, y - 26 * s, 40 * s, 12 * s, 26 * s, c));
  const xs = mins >= 6 ? [-96, -80, -64, 64, 80, 96] : mins >= 4 ? [-76, -64, 64, 76] : mins ? [-70, 70] : [];
  for (const m of xs) out.push(...minaret(x + m * s, y, (Math.abs(m) > 70 ? 92 : 104) * s, 4 * s, c, 2, lit));
  return out;
}
/** A bronze figure standing, faceless, `h` tall, feet at (`x`, `y`), an arm out by `arm` (0 down). */
function figure(x: number, y: number, h: number, arm: number, c: string): Shape[] {
  const u = h / 10;
  return [S(rect(x - 1.3 * u, y - 4.2 * u, 1.1 * u, 4.2 * u), c), S(rect(x + 0.2 * u, y - 4.2 * u, 1.1 * u, 4.2 * u), tone(c, "shade")),
    P([[x - 1.9 * u, y - 3.6 * u, 0], [x - 1.7 * u, y - 7.6 * u], [x, y - 8.3 * u], [x + 1.7 * u, y - 7.6 * u], [x + 1.9 * u, y - 3.6 * u, 0]], c), S(ellipse(x, y - 9.1 * u, 0.85 * u, 0.95 * u), c),
    { path: smooth([[x + 1.5 * u, y - 7.5 * u], [x + 1.5 * u + Math.sin(arm) * 2.8 * u, y - 7.5 * u + Math.cos(arm) * 2.8 * u]], false, 1), stroke: { color: c, width: 0.9 * u, cap: "round" } },
    S(rect(x - 1.6 * u, y - 7.6 * u, 0.6 * u, 3.8 * u), tone(c, "light"), { flat: true, opacity: 0.5 })];
}
/** The 15 Temmuz Şehitler (Bosphorus) Bridge side on, main span `S`, at the water line: towers, cables, the zig-zag hangers, the deck on its side spans' piers, the shores. Its lamps go in `deck`; the cable's light points (one every S/40) in `cable`. */
function bridge(S0: number, c: string, deck: Shape[], cable: Vec2[]): Shape[] {
  const Ht = S0 * 0.154, Hd = S0 * 0.06, Sd = S0 * 0.24, cy = (x: number) => -Ht + (Ht - Hd - S0 * 0.008) * (1 - (2 * x / S0) ** 2), out: Shape[] = [];
  for (const k of [-1, 1]) out.push(P([[k * (S0 / 2 + S0 * 0.03), 0, 0], [k * (S0 / 2 + Sd * 0.6), -Hd * 0.55], [k * (S0 / 2 + Sd * 1.3), -Hd * 0.8], [k * (S0 / 2 + Sd * 1.6), -Hd * 0.85, 0], [k * (S0 / 2 + Sd * 1.6), 0, 0]], k < 0 ? "#8FA58A" : "#9AAE92"));
  const hang: number[][] = [], segs: number[][] = [];
  for (let i = 0; i <= 40; i++) { const x = -S0 / 2 + S0 * i / 40; cable.push([x, cy(x)]); if (i < 40) { const xn = x + S0 / 40; hang.push(i % 2 ? [x, cy(x), xn, -Hd] : [x, -Hd, xn, cy(xn)]); } }
  for (const k of [-1, 1]) { segs.push([k * S0 / 2, -Ht, k * (S0 / 2 + Sd * 1.05), -Hd * 0.62]); for (let i = 1; i < 5; i++) out.push(S(rect(k * (S0 / 2 + Sd * i / 5) - S0 * 0.003, -Hd, S0 * 0.006, Hd * (0.5 + 0.5 * (1 - i / 5))), tone(c, "shade"))); }
  out.push(lines(hang, c, S0 * 0.0012, 0.75), { path: smooth(cable, false, 1), stroke: { color: c, width: S0 * 0.0035 } }, lines(segs, c, S0 * 0.0035, 1));
  out.push(S(rect(-S0 / 2 - Sd * 1.3, -Hd - S0 * 0.004, S0 + Sd * 2.6, S0 * 0.009), c), S(rect(-S0 / 2 - Sd * 1.3, -Hd + S0 * 0.002, S0 + Sd * 2.6, S0 * 0.003), tone(c, "deep"), { flat: true, opacity: 0.5 }));
  for (const k of [-1, 1]) {
    const x = k * S0 / 2, tw = S0 * 0.011;
    out.push(P([[x - tw, 0, 0], [x - tw * 0.6, -Ht - S0 * 0.004, 0], [x + tw * 0.6, -Ht - S0 * 0.004, 0], [x + tw, 0, 0]], c), S(rect(x + tw * 0.1, -Ht, tw * 0.5, Ht), tone(c, "shade"), { flat: true, opacity: 0.4 }));
    for (const f of [0.35, 0.68, 0.97]) out.push(S(rect(x - tw * 1.05, -Ht * f - S0 * 0.002, tw * 2.1, S0 * 0.004), tone(c, "light")));
    out.push(S(rect(x - tw * 1.6, -S0 * 0.012, tw * 3.2, S0 * 0.012), STONE));
  }
  for (let x = -S0 / 2 - Sd * 1.2; x <= S0 / 2 + Sd * 1.2; x += S0 / 30) deck.push(S(ellipse(x, -Hd - S0 * 0.006, S0 * 0.002), LAMP, { flat: true }));
  return out;
}

/** Each landmark's default height (cm, its art's own scale: set `h` to scale it). */
const LANDMARK_H: Record<string, number> = { republic_monument: 1100, bosphorus_bridge: 620, kiz_kulesi: 600, galata: 1000, ortakoy_mosque: 860, aya_triada: 1010, kadikoy_pier: 840, haydarpasa: 900 };

/**
 * A landmark as a stylised paper silhouette, drawn from description (never traced), `which`:
 * - `republic_monument`: Taksim's Republic Monument: a stone arch on a stepped granite platform, bronze figures
 *   (faceless) in its niche and before its piers, two tall flags swaying on either side;
 * - `bosphorus_bridge`: the 15 Temmuz Şehitler Köprüsü side on: two slender towers, the main cable, its zig-zag
 *   hangers, the deck over the water and on its piers ashore; at night its deck lamps and its cables light,
 *   cool white, or red and white with `red_white` (true, or the name of the place's state it is red and white in;
 *   `plain` names the state its plain lights show in);
 * - `kiz_kulesi`: the Maiden's Tower on its rocky islet: the low walls, the tower, its gallery, the lantern and its flag;
 * - `galata`: the Galata Tower: a round stone tower, its arcaded gallery and its conical lead cap;
 * - `ortakoy_mosque`: the Ortaköy Mosque by the water: a tall baroque hall of big arched windows, its dome on a
 *   windowed drum, two slender minarets at the front, the sultan's pavilion beside it;
 * - `aya_triada`: the Aya Triada church near Taksim: its great dome and lantern over a pedimented front between two belfries;
 * - `kadikoy_pier`: the Kadıköy pier building: long and low on the water, eaves, a tiled roof, arched gates, its clock tower;
 * - `haydarpasa`: Haydarpaşa station across the bay: a long sandstone block under steep slate roofs, two round corner towers.
 * `h` scales it (each has its own default height, about its real look at a far layer's model scale). Lit at night
 * where it really is (floodlit stone, lit windows, the bridge's lamps; none on its place's light switch).
 */
const landmark: PieceDef = { draw(p, r) {
  const which = Object.hasOwn(LANDMARK_H, str(p.which, "")) ? str(p.which, "") : "galata", H0 = LANDMARK_H[which], k = num(p.h, H0) / H0;
  const sh: Shape[] = [], lit: Shape[] = [], flats: FlatSpec[] = [];
  const wins = (x0: number, x1: number, step: number, y: number, ww: number, wh: number, c: string, share = 0.5) => { for (let x = x0; x <= x1 + 0.1; x += step) { const s = archWin(x, y, ww, wh); sh.push(S(s, c)); if (r.chance(share)) lit.push(S(s, LAMP, { flat: true, opacity: 0.9 })); } };
  if (which === "republic_monument") {
    const g = "#B9B2A6", bz = "#4D5B4F";
    sh.push(S(rect(-720, -40, 1440, 40), tone(g, "shade")), S(rect(-600, -80, 1200, 42), g), S(rect(-600, -80, 1200, 5), tone(g, "light"), { flat: true }));
    const mon = holed(rect(-340, -1000, 680, 920), [archWin(0, -230, 300, 560)]);
    sh.push(S(mon, "#DCD3C2", { evenodd: true }), S(archWin(0, -230, 300, 560), "#B4AC9C"), S(rect(200, -1000, 140, 920), tone("#DCD3C2", "shade"), { flat: true, opacity: 0.35 }), S(rect(-370, -1050, 740, 60), "#E6DECF"), S(rect(-370, -995, 740, 8), tone(g, "deep"), { flat: true, opacity: 0.4 }));
    sh.push(lines([[-340, -880, 340, -880], [-340, -700, -150, -700], [150, -700, 340, -700]], tone(g, "deep"), 3, 0.35), S(rect(-150, -230, 300, 150), g), S(rect(-330, -170, 180, 90), g), S(rect(150, -170, 180, 90), g));
    sh.push(...figure(0, -230, 360, 0.2, bz), ...[[-290, 0.1], [-200, 1.2], [200, -0.3], [290, 0.5]].flatMap(([x, a]) => figure(x, -170, 270, a, bz)), ...figure(-80, -230, 250, 0.4, bz), ...figure(80, -230, 250, 0.1, bz));
    for (let x = -700; x <= 700; x += 100) sh.push(S(rect(x - 3, -90, 6, 50), "#3B3B40"));
    sh.push(lines(Array.from({ length: 14 }, (_, i) => [-700 + i * 100, -80, -600 + i * 100, -80]), "#3B3B40", 2, 0.7));
    for (const x of [-620, 620]) {
      sh.push(S(rect(x - 5, -1300, 10, 1260), "#DADDDE"), S(ellipse(x, -1307, 9), "#D9A72E"));
      flats.push({ group: { shapes: flagCloth(170, 0.1, r.range(0, 6)), edge: 1 }, x: (x + 6) * k, y: 1292 * k, z: 2, ppcm: Math.min(2, 1900 / (280 * k)), move: { sway: { rot: 0.05, dy: 2, ms: r.range(2400, 3200) }, phase: r() } });
    }
    flats.forEach(f => f.group.shapes = tf(f.group.shapes, [k, 0, 0, k, 0, 0]));
  } else if (which === "bosphorus_bridge") {
    const deck: Shape[] = [], cable: Vec2[] = [], S0 = 4030, rw = p.red_white;
    sh.push(...bridge(S0, "#C9CFD3", deck, cable));
    const dots = (sel: (i: number) => boolean, col: string) => cable.filter((_, i) => sel(i)).map(([x, y]) => S(ellipse(x, y, 10), col, { flat: true }));
    const plain = typeof p.plain === "string" ? { when: { state: [p.plain] } } : {};
    const base = { switch: false as const, glowAt: 0.2, ppcm: Math.min(1, 1900 / (S0 * 1.8)) };
    flats.push(glowOnly(deck, { ...base, glowAt: 0.1 }));
    if (rw) {
      // red and white by turns along the cable, swapping slowly
      const st = typeof rw === "string" ? { when: { state: [rw] } } : {};
      for (const s of [0, 1]) flats.push(glowOnly([...dots(i => (i >> 2) % 2 === s, TR), ...dots(i => (i >> 2) % 2 !== s, "#FFFFFF")], { ...base, ...st, move: { blink: { ms: 4000, on: 0.5, at: s * 0.5 } } }));
    }
    if (!rw || typeof rw === "string") flats.push(glowOnly(dots(() => true, "#CFE0FF"), { ...base, ...plain }));
  } else if (which === "kiz_kulesi") {
    const c = "#ECE6D8";
    sh.push(P([[-400, 0, 0], [-360, -30], [-250, -52], [0, -58], [260, -50], [380, -26], [410, 0, 0]], "#8E8577"), S(ellipse(-200, -30, 60, 10), tone("#8E8577", "light"), { flat: true, opacity: 0.5 }));
    sh.push(S(rect(-300, -150, 600, 100), c), S(rect(-300, -58, 600, 10), tone(c, "deep"), { flat: true, opacity: 0.3 }), S(rect(-310, -160, 620, 12), tone(c, "light")), ...dome(220, -160, 70, 18, 34, c));
    wins(-260, -120, 46, -78, 18, 40, "#55657A", 0.6); wins(110, 260, 50, -78, 18, 40, "#55657A", 0.6);
    sh.push(S(rect(-72, -420, 144, 270), c), S(rect(20, -420, 52, 270), tone(c, "shade"), { flat: true, opacity: 0.35 }), S(rect(-96, -470, 192, 52), "#F4F0E6"), S(rect(-102, -476, 204, 10), LEAD));
    wins(-60, 60, 30, -428, 18, 36, "#55657A", 0.9); wins(-36, 36, 72, -220, 20, 50, "#55657A", 0.5);
    sh.push(...dome(0, -476, 96, 50, 64, c), S(rect(-2, -680, 4, 90), "#9AA0A6"));
    sh.push(...flagCloth(46, 0.08, r.range(0, 6)).map(s => ({ ...s, path: s.path.move(2, -678) })));
  } else if (which === "galata") {
    const c = "#C9B79A", segs: number[][] = [];
    sh.push(S(rect(-150, -60, 300, 60), tone(c, "shade")), P([[-135, -60, 0], [-112, -700, 0], [112, -700, 0], [135, -60, 0]], c), S(rect(40, -700, 70, 640), tone(c, "shade"), { flat: true, opacity: 0.35 }), S(rect(-120, -700, 50, 640), tone(c, "light"), { flat: true, opacity: 0.25 }));
    for (let y = -90; y > -700; y -= 30) segs.push([-130 + (-y) * 0.033, y, 130 - (-y) * 0.033, y]);
    sh.push(lines(segs, tone(c, "deep"), 1.4, 0.25));
    wins(-40, 40, 80, -260, 18, 46, "#4A4440", 0.4); wins(0, 0, 1, -480, 18, 46, "#4A4440", 0.4); wins(-50, 50, 50, -620, 16, 40, "#4A4440", 0.5);
    sh.push(S(rect(-124, -712, 248, 14), tone(c, "light")), S(rect(-118, -790, 236, 80), "#D8C9AE"), S(rect(-126, -800, 252, 12), tone(c, "light")));
    wins(-96, 96, 32, -718, 18, 62, "#3A3530", 1);
    sh.push(P([[-128, -800, 0], [-40, -940], [0, -1000, 0], [40, -940], [128, -800, 0]], "#6E7A80"), S(ellipse(-40, -880, 14, 50), tone("#6E7A80", "light"), { flat: true, opacity: 0.35 }), S(rect(-2, -1040, 4, 44), "#C9A43A"));
  } else if (which === "ortakoy_mosque") {
    const c = "#EEE8DC";
    sh.push(S(rect(-560, -40, 1120, 40), STONE), S(rect(-560, -42, 1120, 5), tone(STONE, "light")));
    sh.push(S(rect(-540, -200, 250, 160), c), S(rect(-550, -210, 270, 12), tone(c, "light")), ...[-500, -440, -380, -330].map(x => S(archWin(x, -60, 26, 110), "#55657A")));
    sh.push(S(rect(-260, -500, 520, 460), c), S(rect(150, -500, 110, 460), tone(c, "shade"), { flat: true, opacity: 0.3 }));
    for (const x of [-260, -90, 90, 260]) sh.push(S(rect(x - 14, -500, 28, 460), tone(c, "light")));
    wins(-175, 175, 175, -70, 110, 190, "#55657A", 0.7); wins(-175, 175, 175, -290, 110, 170, "#55657A", 0.7);
    sh.push(S(rect(-276, -516, 552, 22), tone(c, "light")), S(rect(-276, -496, 552, 4), tone(c, "deep"), { flat: true, opacity: 0.4 }), ...[-180, 180].map(x => P([[x - 40, -516, 0], [x, -560, 0], [x + 40, -516, 0]], c)));
    sh.push(...dome(0, -516, 300, 80, 150, c));
    wins(-100, 100, 50, -530, 26, 50, "#55657A", 1);
    for (const x of [-330, 330]) sh.push(...minaret(x, -40, 760, 24, c, 1, lit));
  } else if (which === "aya_triada") {
    const c = "#D9C7A8", cap = "#6F7F86";
    sh.push(...dome(0, -600, 360, 120, 160, c, cap), S(rect(-24, -950, 48, 70), c), P([[-30, -950, 0], [0, -985, 0], [30, -950, 0]], cap));
    sh.push(S(rect(-3, -1010, 6, 30), "#C9A43A"), S(rect(-12, -1000, 24, 5), "#C9A43A"));
    wins(-130, 130, 52, -612, 22, 70, "#4A4E58", 0.6);
    sh.push(S(rect(-260, -600, 520, 600), c), S(rect(140, -600, 120, 600), tone(c, "shade"), { flat: true, opacity: 0.3 }), P([[-270, -600, 0], [0, -700, 0], [270, -600, 0]], tone(c, "light")), S(rect(-270, -606, 540, 10), tone(c, "light")));
    sh.push(S(archWin(0, 0, 120, 260), "#5A3E2E")); wins(-160, 160, 320, -300, 70, 170, "#4A4E58", 0.5); wins(0, 0, 1, -360, 90, 190, "#4A4E58", 0.6);
    for (const x of [-330, 330]) {
      sh.push(S(rect(x - 70, -760, 140, 760), c), S(rect(x + 25, -760, 45, 760), tone(c, "shade"), { flat: true, opacity: 0.3 }), S(archWin(x, -640, 50, 100), "#3A3530"), S(rect(x - 78, -770, 156, 14), tone(c, "light")));
      sh.push(P([[x - 66, -770, 0], ...arcPoints(x, -770, 66, 60, Math.PI * 1.05, Math.PI * 1.95, 6), [x + 66, -770, 0]], cap), S(rect(x - 2, -880, 4, 50), "#C9A43A"), S(rect(x - 9, -868, 18, 4), "#C9A43A"));
      wins(x, x, 1, -280, 36, 90, "#4A4E58", 0.4);
    }
  } else if (which === "kadikoy_pier") {
    const c = "#F0E6D2";
    sh.push(lines(Array.from({ length: 14 }, (_, i) => [-650 + i * 100, 0, -650 + i * 100, -40]), "#5B5048", 10, 1), S(rect(-680, -60, 1360, 22), "#A9A59C"));
    sh.push(S(rect(-640, -500, 1280, 440), c), S(rect(-640, -290, 1280, 14), tone(c, "shade")));
    for (const x of [-420, 0, 420]) sh.push(S(archWin(x, -60, 150, 200), "#4A5560"));
    wins(-560, 560, 80, -320, 36, 110, "#55657A", 0.6);
    sh.push(P([[-700, -500, 0], [700, -500, 0], [560, -600, 0], [-560, -600, 0]], ROOF), S(rect(-700, -506, 1400, 10), tone(ROOF, "deep")));
    sh.push(S(rect(-80, -800, 160, 300), c), ...clock(0, -720, 40), P([[-96, -800, 0], [0, -900, 0], [96, -800, 0]], ROOF), S(rect(-100, -806, 200, 12), tone(c, "light")));
    lit.push(S(ellipse(0, -720, 40), "#FFF1C2", { flat: true }));
  } else {
    const c = "#C8A57A", roof = "#5F6E7A";
    sh.push(S(rect(-700, -30, 1400, 30), "#A9A59C"), S(rect(-520, -500, 1040, 470), c), S(rect(-520, -500, 1040, 470), tone(c, "deep"), { flat: true, opacity: 0.12, clip: rect(-520, -140, 1040, 110) }));
    for (let y = -130; y >= -450; y -= 110) wins(-440, 440, 55, y, 26, 70, "#4A4E58", 0.4);
    sh.push(P([[-540, -500, 0], [540, -500, 0], [470, -690, 0], [-470, -690, 0]], roof), ...[-300, -100, 100, 300].map(x => P([[x - 30, -560, 0], [x, -610, 0], [x + 30, -560, 0]], tone(c, "light"))), P([[-120, -500, 0], [0, -760, 0], [120, -500, 0]], c));
    for (const x of [-560, 560]) {
      sh.push(S(rect(x - 90, -620, 180, 590), c), S(rect(x + 30, -620, 60, 590), tone(c, "shade"), { flat: true, opacity: 0.35 }), S(rect(x - 96, -630, 192, 14), tone(c, "light")));
      sh.push(P([[x - 96, -630, 0], [x, -880, 0], [x + 96, -630, 0]], roof), S(rect(x - 2, -920, 4, 44), "#9AA0A6"));
      for (let y = -130; y >= -560; y -= 110) wins(x, x, 1, y, 30, 70, "#4A4E58", 0.4);
    }
  }
  // floodlit at night: partly self-lit, so its stone stays pale against the dark (a glow over a whole wall would blur into a box)
  const floodlit = which !== "bosphorus_bridge";
  const K: Affine = [k, 0, 0, k, 0, 0], [x0, y0, x1, y1] = groupBounds({ shapes: tf(sh, K) }), ppcm = Math.min(1.2, 1900 / Math.max(x1 - x0, y1 - y0, 1));
  const out: FlatSpec[] = [{ group: { shapes: tf(sh, K), edge: 1.2 * k }, ppcm, id: "landmark", switch: false, ...(floodlit ? { lit: 0.7 } : {}) }];
  if (lit.length) out.push(...litByTurns(tf(lit, K), { ppcm }, 4, 0.1, 0.6));
  return { flats: [...out, ...flats.map(f => which === "bosphorus_bridge" ? { ...f, emissive: f.emissive && { ...f.emissive, shapes: tf(f.emissive.shapes, K) }, ppcm: Math.min(1.2, 1900 / (6000 * k)) } : f)] };
}, variants: Object.fromEntries(Object.keys(LANDMARK_H).map(w => [w, { which: w }])),
  meta: {
    about: "An Istanbul landmark as a stylised paper silhouette, floodlit at night: Galata, the bridge, Kız Kulesi and others.",
    params: {
      which: { type: "enum", values: Object.keys(LANDMARK_H), default: "galata" },
      h: { type: "num", min: 0, about: "height, cm; each has its own default" },
      red_white: { type: ["bool", "text"], about: "bridge: red and white lights; true, or the place state they show in" },
      plain: { type: "text", about: "bridge: the place state its plain lights show in" },
    },
    tags: ["landmark", "building"],
  } };

// ---- The skyline -------------------------------------------------------------------------------------

const HAZE = "#C9D3DC", FACADE = ["#E9CF9E", "#F0DDBF", "#CFE0CF", "#E8B9A3", "#D9C7DA", "#F2E4C4", "#BFD3DC", "#E6D3C3"];
const GLASS = ["#8FA6B8", "#7F97AA", "#A3B6C4", "#6E8799", "#9DB0A8"], CONCRETE = ["#D8CDB8", "#C9C2B5", "#E2DACB", "#BDB5A6"];
/** What a skyline layer collects besides its art: lit windows, flags (shown in the flag state), aircraft beacons. */
interface Sky { lit: Shape[]; flags: Shape[]; red: Shape[] }
/** A periodic ridge height: y (negative, up) at x, repeating every `per`. */
function hill(r: Rng, per: number, base: number, amp: number) {
  const ws = [1, 2, 3, 5].map(k => [k, amp * r.range(0.3, 1) / Math.sqrt(k), r.range(0, 6.28)]);
  return (x: number) => -base - ws.reduce((s, [k, a, f]) => s + a * Math.sin(2 * Math.PI * k * x / per + f), 0);
}
/** The land under a ridge `f` from x0 to x1 (a little past both), down to `foot`. */
const land = (f: (x: number) => number, x0: number, x1: number, c: string, foot = 0) => S(poly([[x0 - 20, foot], ...Array.from({ length: 81 }, (_, i): Vec2 => { const x = x0 - 20 + (x1 - x0 + 40) * i / 80; return [x, f(x)]; }), [x1 + 20, foot]]), c);
/** A grid of windows over a façade (one path), some lit. */
function grid(r: Rng, x: number, y0: number, w: number, y1: number, cw: number, ch: number, sx: number, sy: number, c: string, share: number, lit: Shape[]): Shape {
  const pa = new Path();
  for (let y = y0; y + ch <= y1; y += sy) for (let xx = x; xx + cw <= x + w + 0.1; xx += sx) { pa.add(rect(xx, y, cw, ch)); if (r.chance(share)) lit.push(S(rect(xx, y, cw, ch), LAMP, { flat: true, opacity: 0.9 })); }
  return S(pa, c, { flat: true, opacity: 0.85 });
}
/** Şişli's towers between x0 and x1, up to `h`: glass with mullions and lit office floors, or concrete with window grids; slanted, crowned or spired tops; red beacons on the tall ones. */
function towers(r: Rng, x0: number, x1: number, h: number, n: number, o: Sky, share: number): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const tw = h * r.range(0.07, 0.13), th = h * r.range(0.42, 1), x = x0 + (x1 - x0 - tw) * (i + r.range(0.1, 0.9)) / n, glass = r.chance(0.6), c = r.pick(glass ? GLASS : CONCRETE), top = -th;
    out.push(S(rect(x, top, tw, th), c), S(rect(x + tw * 0.68, top, tw * 0.32, th), tone(c, "shade"), { flat: true, opacity: 0.45 }));
    const kind = r.int(0, 3);
    if (kind === 1) out.push(P([[x, top, 0], [x, top - tw * 0.5, 0], [x + tw, top, 0]], c));
    else if (kind === 2) out.push(S(rect(x + tw * 0.15, top - th * 0.06, tw * 0.7, th * 0.06), tone(c, "light")), S(rect(x + tw * 0.48, top - th * 0.06 - tw * 0.9, tw * 0.04, tw * 0.9), "#9AA0A6"));
    else if (kind === 3) out.push(S(rect(x + tw * 0.25, top - tw * 0.35, tw * 0.5, tw * 0.35), tone(c, "light")));
    if (glass) {
      out.push(lines(Array.from({ length: 5 }, (_, k) => [x + tw * (k + 1) / 6, top + 2, x + tw * (k + 1) / 6, -2]), tone(c, "light"), tw * 0.012, 0.5), P([[x, top + th * 0.25, 0], [x + tw, top + th * 0.1, 0], [x + tw, top + th * 0.22, 0], [x, top + th * 0.37, 0]], "#FFFFFF", { flat: true, opacity: 0.12 }));
      for (let y = top + h * 0.03; y < -h * 0.02; y += h * 0.032) if (r.chance(share)) o.lit.push(S(rect(x + tw * 0.06, y, tw * 0.88, h * 0.012), "#FFF1C2", { flat: true, opacity: 0.8 }));
    } else out.push(grid(r, x + tw * 0.1, top + h * 0.03, tw * 0.8, -h * 0.02, tw * 0.1, h * 0.014, tw * 0.17, h * 0.03, tone(c, "deep"), share, o.lit));
    if (th > h * 0.7) o.red.push(S(ellipse(x + tw / 2, top - (kind === 2 ? th * 0.06 + tw * 0.9 : kind === 1 ? tw * 0.5 : 0) - 4, h * 0.006), "#FF4A3A", { flat: true }));
  }
  return out;
}
/** Feriköy's roofs: apartment blocks five or six floors high, tiled hip roofs or flat ones with water tanks, chimneys, aerials and dishes, now and then a dome and its minaret or a belfry; flags on poles and balconies. */
function roofs(r: Rng, x0: number, x1: number, h: number, o: Sky, share: number, slope?: (x: number) => number, past = false): Shape[] {
  const out: Shape[] = [], u = h / 1000;
  for (let x = x0 + r.range(0, 30 * u); x < x1 - 60 * u;) {
    const bw = Math.min(x1 - x, u * r.range(110, 220)), bh = u * r.range(170, 300), c = r.pick(FACADE), b = slope ? slope(x + bw / 2) : 0, top = b - bh;
    // the land dips to the water here: leave a gap
    if (b > h * 0.02) { x += bw; continue; }
    out.push(S(rect(x, top, bw, bh - b + 1), c), S(rect(x + bw - 8 * u, top, 8 * u, bh - b), tone(c, "shade"), { flat: true, opacity: 0.4 }), grid(r, x + 10 * u, top + 14 * u, bw - 26 * u, b - 8 * u, 9 * u, 13 * u, 22 * u, 30 * u, "#6E7F92", share, o.lit));
    if (r.chance(0.5)) {
      out.push(P([[x - 5 * u, top, 0], [x + bw * 0.22, top - 34 * u, 0], [x + bw * 0.78, top - 34 * u, 0], [x + bw + 5 * u, top, 0]], ROOF), lines([[x + bw * 0.1, top - 11 * u, x + bw * 0.9, top - 11 * u], [x + bw * 0.16, top - 22 * u, x + bw * 0.84, top - 22 * u]], tone(ROOF, "deep"), 1.2 * u, 0.5));
      if (r.chance(0.6)) { const cx = x + bw * r.range(0.25, 0.7); out.push(S(rect(cx, top - 46 * u, 9 * u, 24 * u), "#B9A27A"), S(rect(cx - 2 * u, top - 49 * u, 13 * u, 4 * u), tone("#B9A27A", "deep"))); }
    } else {
      out.push(S(rect(x - 2 * u, top - 6 * u, bw + 4 * u, 7 * u), tone(c, "light")));
      if (r.chance(0.7)) { const tx = x + bw * r.range(0.15, 0.6); if (!past) out.push(lines([[tx + 3 * u, top, tx + 3 * u, top - 12 * u], [tx + 25 * u, top, tx + 25 * u, top - 12 * u]], "#5B656D", 2 * u, 1), S(rrect(tx, top - 34 * u, 28 * u, 22 * u, 3 * u), r.pick(["#D9DDE0", "#C3C9CE", "#E9E6DE"])), S(ellipse(tx + 14 * u, top - 34 * u, 14 * u, 3 * u), "#EEF0F1")); }
      if (r.chance(0.5) && !past) out.push(S(ellipse(x + bw * 0.8, top - 12 * u, 7 * u, 8 * u), "#E9E6DE"), lines([[x + bw * 0.8, top - 6 * u, x + bw * 0.8, top]], "#5B656D", 1.5 * u, 1));
    }
    if (r.chance(0.5)) { const ax = x + bw * r.range(0.2, 0.8); if (!past) out.push(lines([[ax, top - 2, ax, top - 50 * u], [ax - 12 * u, top - 40 * u, ax + 12 * u, top - 40 * u], [ax - 8 * u, top - 46 * u, ax + 8 * u, top - 46 * u]], "#4A4E58", 1.2 * u, 0.9)); }
    if (r.chance(0.35)) o.flags.push(...tf(flagCloth(30 * u, 0.06, r.range(0, 6)), translate(x + bw * r.range(0.15, 0.6), top + r.range(20, 120) * u)));
    if (r.chance(0.2)) { const fx = x + bw * 0.5; o.flags.push(S(rect(fx - 1, top - 90 * u, 2, 90 * u), "#DADDDE"), ...tf(flagCloth(26 * u, 0.08, r.range(0, 6)), translate(fx + 1, top - 88 * u))); }
    x += bw + r.range(-6, 14) * u;
    if (r.chance(0.08)) { out.push(...mosque(x + 40 * u, b, 1.1 * u, 2, "#E6DCC8", o.lit)); x += 150 * u; }
    else if (r.chance(0.05)) { out.push(S(rect(x, b - 330 * u, 50 * u, 330 * u - b), "#D9C7A8"), S(archWin(x + 25 * u, b - 270 * u, 20 * u, 40 * u), "#3A3530"), P([[x - 4 * u, b - 330 * u, 0], [x + 25 * u, b - 380 * u, 0], [x + 54 * u, b - 330 * u, 0]], LEAD), lines([[x + 25 * u, b - 380 * u, x + 25 * u, b - 405 * u], [x + 17 * u, b - 397 * u, x + 33 * u, b - 397 * u]], "#3B3B40", 2 * u, 1)); x += 60 * u; }
  }
  return out;
}
/** A street of the city at real size, for a car's window: blocks with shopfronts, balconies and lit windows, trees, lamps, flags on balconies. */
function street(r: Rng, x0: number, x1: number, h: number, o: Sky, share: number): Shape[] {
  const out: Shape[] = [], u = h / 2000;
  for (let x = x0 + r.range(0, 40); x < x1 - 200 * u;) {
    const bw = Math.min(x1 - x, u * r.range(500, 900)), bh = u * r.range(1300, 2000), c = r.pick(FACADE);
    out.push(S(rect(x, -bh, bw, bh), c), S(rect(x - 10 * u, -bh - 20 * u, bw + 20 * u, 24 * u), tone(c, "shade")), grid(r, x + 40 * u, -bh + 80 * u, bw - 80 * u, -420 * u, 90 * u, 140 * u, 170 * u, 290 * u, "#55657A", share, o.lit));
    for (let y = -bh + 250 * u; y < -450 * u; y += 290 * u) if (r.chance(0.5)) { out.push(S(rect(x + 20 * u, y, bw - 40 * u, 10 * u), tone(c, "deep")), lines(Array.from({ length: Math.round(bw / (30 * u)) }, (_, k) => [x + 24 * u + k * 30 * u, y, x + 24 * u + k * 30 * u, y - 70 * u]), "#3B3B40", 3 * u, 0.8)); if (r.chance(0.4)) o.flags.push(...tf(flagCloth(90 * u, 0.06, r.range(0, 6)), translate(x + r.range(0.2, 0.6) * bw, y - 66 * u))); }
    out.push(S(rect(x + 20 * u, -380 * u, bw - 40 * u, 340 * u), "#4C5A63"), S(rect(x + 30 * u, -370 * u, bw - 60 * u, 320 * u), "#90A7B2", { flat: true }), S(rect(x + 10 * u, -420 * u, bw - 20 * u, 46 * u), r.pick(["#B3261E", "#2F8C88", "#2E3A59", "#E0A83A", "#6F7A45"])));
    o.lit.push(S(rect(x + 30 * u, -370 * u, bw - 60 * u, 320 * u), "#FFE2A6", { flat: true, opacity: 0.8 }));
    x += bw + r.range(0, 20) * u;
    if (r.chance(0.5)) { const tx = x + r.range(-60, 60) * u, g = r.pick(LEAVES.summer); out.push(S(rect(tx - 12 * u, -500 * u, 24 * u, 500 * u), "#7E6E60"), S(ellipse(tx, -620 * u, 200 * u, 170 * u), g), S(ellipse(tx - 60 * u, -680 * u, 90 * u, 70 * u), tone(g, "light"), { flat: true, opacity: 0.5 })); }
  }
  for (let x = x0 + 150 * u; x < x1; x += 1200 * u) { out.push(lines([[x, 0, x, -800 * u], [x, -800 * u, x + 80 * u, -830 * u]], "#3B3B40", 12 * u, 1), S(ellipse(x + 90 * u, -826 * u, 30 * u, 13 * u), "#3B3B40")); o.lit.push(S(ellipse(x + 90 * u, -818 * u, 24 * u, 10 * u), LAMP, { flat: true })); }
  out.push(S(rect(x0 - 20, -40 * u, x1 - x0 + 40, 40 * u), "#B9B2A6"));
  return out;
}
/** Water from y = −`top` down to the strip's foot, with a lighter line along its far shore and a few glints. */
const water = (r: Rng, x0: number, x1: number, top: number, c = "#6F9DB0"): Shape[] => [S(rect(x0 - 20, -top, x1 - x0 + 40, top), c), S(rect(x0 - 20, -top, x1 - x0 + 40, top * 0.08), tone(c, "light"), { flat: true, opacity: 0.6 }),
  lines(Array.from({ length: 10 }, () => { const x = r.range(x0, x1), y = -top * r.range(0.15, 0.8); return [x, y, x + r.range(20, 80), y]; }), "#FFFFFF", 2, 0.3)];
/** Houses dotted over land below the ridge `f` (each a small block and roof, a window lit at night). */
function dots(r: Rng, f: (x: number) => number, x0: number, x1: number, n: number, s: number, low: number, o: Sky): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) { const x = r.range(x0, x1), y = f(x) + r.range(0.15, 1) * (low - f(x)), c = r.pick(FACADE); out.push(S(rect(x, y - s, s * 1.5, s), c), S(rect(x - s * 0.1, y - s * 1.25, s * 1.7, s * 0.3), r.chance(0.6) ? ROOF : tone(c, "shade"))); if (r.chance(0.5)) o.lit.push(S(rect(x + s * 0.4, y - s * 0.7, s * 0.4, s * 0.35), LAMP, { flat: true })); }
  return out;
}

interface SkyLayer { z: number; y?: number; haze: number; slow: number; /** a layer of towers, left out in the past */ towers?: true; draw(r: Rng, x0: number, x1: number, h: number, o: Sky, share: number, galata: boolean, past: boolean): Shape[] }
/** Each skyline's layers, far to near. */
const SKYLINES: Record<string, SkyLayer[]> = {
  city: [
    { z: -1200, haze: 0.45, slow: 4, towers: true, draw: (r, x0, x1, h, o, s) => towers(r, x0, x1, h * 1.6, Math.round((x1 - x0) / 900), o, s) },
    { z: 0, haze: 0, slow: 1, draw: street },
  ],
  sisli: [
    { z: -900, haze: 0.55, slow: 6, draw: (r, x0, x1, h) => [land(hill(r, x1 - x0, h * 0.13, h * 0.04), x0, x1, "#A9B8B0")] },
    { z: -450, haze: 0.25, slow: 2.5, towers: true, draw: (r, x0, x1, h, o, s) => towers(r, x0, x1, h, Math.round((x1 - x0) / 260), o, s) },
    { z: 0, haze: 0.05, slow: 1, draw: (r, x0, x1, h, o, s, _g, past) => roofs(r, x0, x1, h * 0.7, o, s, undefined, past) },
  ],
  ferikoy: [
    { z: -1200, y: 0.22, haze: 0.55, slow: 6, draw(r, x0, x1, h, o, _s, _g, past) {
      const f = hill(r, x1 - x0, h * 0.14, h * 0.04), wl = h * 0.06, out = [land(f, x0, x1, "#A9B8A6"), ...dots(r, f, x0, x1, (x1 - x0) / 60, h * 0.012, -wl, o), ...water(r, x0, x1, wl)];
      // the bridge (1973) is not there in the past
      if (past) return out;
      const deck: Shape[] = [], S0 = (x1 - x0) * 0.2;
      out.push(...tf(bridge(S0, "#C9CFD3", deck, []), translate(x0 + (x1 - x0) * 0.8, -wl * 0.4)));
      o.lit.push(...tf(deck, translate(x0 + (x1 - x0) * 0.8, -wl * 0.4)));
      return out;
    } },
    { z: -500, y: 0.1, haze: 0.3, slow: 2.5, towers: true, draw: (r, x0, x1, h, o, s) => towers(r, x0 + (x1 - x0) * 0.15, x0 + (x1 - x0) * 0.6, h * 0.85, Math.round((x1 - x0) / 700), o, s) },
    { z: 0, haze: 0, slow: 1, draw: (r, x0, x1, h, o, s, _g, past) => roofs(r, x0, x1, h, o, s, undefined, past) },
  ],
  old_city: [
    { z: -1200, y: 0.14, haze: 0.45, slow: 6, draw(r, x0, x1, h, o) {
      const W = x1 - x0, f = hill(r, W, h * 0.1, h * 0.025), wl = h * 0.05, c = "#E2D6C2", out = [land(f, x0, x1, "#B8AE9C"), ...dots(r, f, x0, x1, W / 25, h * 0.014, -wl, o)];
      out.push(S(rect(x0 + W * 0.46, f(x0 + W * 0.46) - h * 0.2, h * 0.012, h * 0.2), c), P([[x0 + W * 0.46 - h * 0.004, f(x0 + W * 0.46) - h * 0.2, 0], [x0 + W * 0.46 + h * 0.006, f(x0 + W * 0.46) - h * 0.23, 0], [x0 + W * 0.46 + h * 0.016, f(x0 + W * 0.46) - h * 0.2, 0]], LEAD));
      for (const [t, s, m] of [[0.33, 0.0048, 4], [0.58, 0.0032, 2], [0.76, 0.0036, 4], [0.88, 0.0036, 6]]) out.push(...mosque(x0 + W * t, f(x0 + W * t) + h * 0.01, s * h, m, c, o.lit));
      return [...out, ...water(r, x0, x1, wl)];
    } },
    { z: -500, haze: 0.2, slow: 2.5, draw(r, x0, x1, h, o, s, galata) {
      const W = x1 - x0, f = hill(r, W, h * 0.05, h * 0.03), out = roofs(r, x0, x1, h * 0.55, o, s, (x) => f(x) + h * 0.03);
      if (galata) { const gx = x0 + W * 0.18, k = h * 0.45 / 1000, g = landmark.draw({ which: "galata", h: 1000 * k }, r, undefined as never).flats[0].group.shapes; out.push(...tf(g, translate(gx, f(gx) + h * 0.02))); }
      return out;
    } },
  ],
  asian_shore: [
    { z: -1200, y: 0.05, haze: 0.5, slow: 6, draw(r, x0, x1, h, o) {
      const W = x1 - x0, f = hill(r, W, h * 0.2, h * 0.08), tx = x0 + W * 0.62, ty = f(tx), out = [land(f, x0, x1, "#9FB39A"), ...dots(r, f, x0, x1, W / 32, h * 0.016, 0, o)];
      out.push(S(rect(tx - h * 0.008, ty - h * 0.33, h * 0.016, h * 0.33), "#D9DDE0"), S(ellipse(tx, ty - h * 0.3, h * 0.03, h * 0.018), "#C3C9CE"), S(rect(tx - 1.5, ty - h * 0.42, 3, h * 0.1), "#9AA0A6"), ...mosque(tx - W * 0.08, f(tx - W * 0.08) + h * 0.01, h * 0.0034, 6, "#ECE6D8", o.lit));
      o.red.push(S(ellipse(tx, ty - h * 0.42, h * 0.006), "#FF4A3A", { flat: true }));
      return out;
    } },
    { z: -500, y: 0.025, haze: 0.25, slow: 2.5, draw(r, x0, x1, h, o) { const f = hill(r, x1 - x0, h * 0.07, h * 0.03); return [land(f, x0, x1, "#A9BCA0"), ...dots(r, f, x0, x1, (x1 - x0) / 26, h * 0.024, 0, o)]; } },
    { z: 0, haze: 0, slow: 1, draw: (r, x0, x1, h) => water(r, x0, x1, h * 0.04) },
  ],
  golden_horn: [
    { z: -1200, y: 0.12, haze: 0.45, slow: 6, draw(r, x0, x1, h, o) {
      const W = x1 - x0, f = hill(r, W, h * 0.12, h * 0.04), out = [land(f, x0, x1, "#B3AE9C"), ...dots(r, f, x0, x1, W / 20, h * 0.016, 0, o), ...mosque(x0 + W * 0.3, f(x0 + W * 0.3) + h * 0.01, h * 0.0034, 2, "#E2D6C2", o.lit)];
      const sx = x0 + W * 0.66, sy = f(sx) + h * 0.02, red = "#A8473A";
      out.push(S(rect(sx - h * 0.06, sy - h * 0.09, h * 0.12, h * 0.09), red), ...dome(sx, sy - h * 0.09, h * 0.05, h * 0.02, h * 0.03, red, "#6F7F86"));
      return out;
    } },
    { z: -500, y: 0.06, haze: 0.15, slow: 2.5, draw: (r, x0, x1, h) => water(r, x0, x1, h * 0.08) },
    { z: 0, haze: 0, slow: 1, draw(r, x0, x1, h, o, s) { const W = x1 - x0, f = hill(r, W, h * 0.06, h * 0.1); return roofs(r, x0, x1, h * 0.8, o, s, (x) => f(x) + h * 0.06); } },
  ],
};

/**
 * A far city in layers for a far band (z −20 … −150 m), `which`:
 * - `ferikoy` (the default; the rooftop's view): Feriköy's roofs near (tiled hips and flat roofs with water tanks,
 *   chimneys, aerials, dishes, a dome and its minaret, a belfry), Şişli's towers behind, and far off the Asian
 *   hills with a sliver of the Bosphorus and its bridge;
 * - `sisli`: Şişli's towers, glass and concrete, crowned and spired, red beacons on the tall ones, lower blocks before them;
 * - `old_city`: the historic peninsula across the Golden Horn: Süleymaniye on its hill and the other mosques' domes and
 *   minarets, the Beyazıt tower, the water at its foot; Beyoğlu's roofs on this side, with Galata (`galata: false` without);
 * - `asian_shore`: low hills across the water dotted with houses, the Çamlıca tower and mosque on the highest;
 * - `golden_horn`: roofs sloping to the water, the far shore with a mosque and the red school's dome;
 * - `city`: a street at real size, for a car's window (blocks, shopfronts, balconies, trees, lamps), towers behind.
 * `near` draws only the nearest layer, the roofs (set below the stage's floor, the roofs dropping away beyond a roof's parapet).
 * `past`: the city seventy years ago (a flashback): no towers, no bridge, nothing on the roofs but chimneys.
 * `w` × `h` cm (default 6000 wide; `h` the tallest towers, default 1000, 2000 for `city`). Windows light by turns at
 * dusk (`windows`: the share lit, default 0.45), beacons blink, none of it on the light switch; flags hang on poles
 * and balconies in the place's `flagState` state (default `flags`). `scroll` makes each layer a seamless strip
 * sliding by, nearer layers faster (parallax): `dir` −1 goes the other way, `ms` the near layer's period
 * (default 12000 for `city`, else 120000), `phase`.
 */
const skyline: PieceDef = { draw(p, r) {
  const which = Object.hasOwn(SKYLINES, str(p.which, "")) ? str(p.which, "") : "ferikoy", w = num(p.w, 6000), h = num(p.h, which === "city" ? 2000 : 1000), scroll = !!p.scroll;
  const share = num(p.windows, 0.45), dir = num(p.dir, 1) < 0 ? -1 : 1, ms = num(p.ms, which === "city" ? 12000 : 120000), flagState = str(p.flagState, "flags"), past = !!p.past, near = !!p.near, flats: FlatSpec[] = [];
  for (const L of SKYLINES[which]) {
    if ((past && L.towers) || (near && L.z)) continue;
    const o: Sky = { lit: [], flags: [], red: [] }, per = which === "city" ? 3000 : 5000, dx = -dir * per;
    const lo = scroll ? -w / 2 - Math.max(0, dx) : -w / 2, hi = scroll ? w / 2 + Math.max(0, -dx) : w / 2, box = rect(lo, -h * 2, hi - lo, h * 2 + 10);
    const art = L.draw(r, scroll ? 0 : lo, scroll ? per : hi, h, o, share, p.galata !== false, past);
    const rep = (ss: Shape[]) => scroll ? ss.map(s => ({ ...s, path: copies(s.path, per, lo, hi), clip: s.clip && !Array.isArray(s.clip) ? [box, copies(s.clip, per, lo, hi)] : box })) : ss;
    const hz = (s: Shape): Shape => L.haze ? { ...s, ...(s.fill ? { fill: mix(s.fill, HAZE, L.haze) } : {}), ...(s.stroke ? { stroke: { ...s.stroke, color: mix(s.stroke.color, HAZE, L.haze) } } : {}) } : s;
    const ppcm = Math.min(0.45, 1900 / (hi - lo + 60)), mv: FlatMotion | undefined = scroll ? { scroll: { dx, ms: ms * L.slow }, phase: num(p.phase, 0), ...(timetable(p.stops) ? { stops: timetable(p.stops)!, clock: "stops" as const } : {}) } : undefined, move = mv ? { move: mv } : {};
    flats.push({ group: { shapes: rep(art.map(hz)), edge: 2 }, z: L.z, y: (L.y ?? 0) * h, ppcm, switch: false, lit: 0.9, pick: L.z ? false : undefined, ...move });
    flats.push(...litByTurns(rep(o.lit), { z: L.z + 1, y: (L.y ?? 0) * h, ppcm, ...move }));
    if (o.flags.length) flats.push({ group: { shapes: rep(o.flags.map(hz)), edge: 1 }, z: L.z + 2, y: (L.y ?? 0) * h, ppcm, pick: false, when: { state: [flagState] }, ...move });
    if (o.red.length) flats.push(glowOnly(rep(o.red), { z: L.z + 2, y: (L.y ?? 0) * h, ppcm, glowAt: 0.3, move: { ...mv, blink: { ms: 1800, on: 0.5 } } }));
  }
  return { flats };
}, variants: { ferikoy: { which: "ferikoy" }, sisli: { which: "sisli" }, old_city: { which: "old_city" }, asian_shore: { which: "asian_shore" }, golden_horn: { which: "golden_horn" }, parallax: { which: "city", scroll: true } },
  meta: {
    about: "A far city in layers for a far band: Feriköy's roofs, Şişli's towers, the old city, the Asian shore, or a street to scroll by.",
    params: {
      which: { type: "enum", values: ["ferikoy", "sisli", "old_city", "asian_shore", "golden_horn", "city"], default: "ferikoy" },
      w: { type: "num", min: 0, default: 6000, about: "width, cm" },
      h: { type: "num", min: 0, about: "the tallest towers, cm (1000; 2000 for city)" },
      windows: { type: "num", min: 0, max: 1, default: 0.45, about: "share of windows lit at night" },
      galata: { type: "bool", default: true, about: "old_city: the Galata Tower on this side" },
      near: { type: "bool", default: false, about: "only the nearest layer (the roofs): the roofs dropping away between a roof and the city" },
      past: { type: "bool", default: false, about: "the city seventy years ago: no towers, no bridge, no aerials, tanks or dishes on the roofs" },
      flagState: { type: "text", default: "flags", about: "the place state its flags show in" },
      scroll: { type: "bool", default: false, about: "each layer a strip sliding by (parallax)" },
      stops: { ...stopsParam, about: "scrolling on a vehicle's timetable (true or {ms, run, ease}): it slows to a stop with the vehicle at each stop" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 scrolls the other way" },
      ms: { type: "num", min: 0, about: "the near layer's scroll period, ms (12000 for city, else 120000)" },
      phase: { type: "num", default: 0, about: "scroll phase" },
    },
    states: ["flags"],
    tags: ["sky", "city"],
  } };

// ---- Solid lines: what people walk round (DESIGN.md §7); a gate's leaves are solid but to its own door mark ----
railing.solid = p => { const w = num(p.w, 800); return solidLine(-w / 2, w / 2); };
parkEdge.solid = p => {
  const w = num(p.w, 1200), gx = p.gate === false ? null : num(p.gate, 0), gw = 220;
  return gx === null ? solidLine(-w / 2, w / 2) : [...solidLine(-w / 2, w / 2, [[gx - gw / 2, gx + gw / 2]]), ...solidLine(gx - gw / 2, gx + gw / 2, [], true)];
};
churchGate.solid = p => { const w = num(p.w, 520), gw = num(p.gw, 170); return [...solidLine(-w / 2, w / 2, [[-gw / 2, gw / 2]]), ...solidLine(-gw / 2, gw / 2, [], true)]; };

export const OUTDOOR_PIECES: Record<string, PieceDef> = { crowd, birds, cat, night_sky: nightSky, flag, railing, park_edge: parkEdge, church_gate: churchGate, market, pier, sea, landmark, skyline };

/** The family's set pieces and props (`index.ts`). Birds and cats are props too: a story can point at one. */
export const set = OUTDOOR_PIECES;
export const props: Record<string, PieceDef> = { birds, cat, flag };

