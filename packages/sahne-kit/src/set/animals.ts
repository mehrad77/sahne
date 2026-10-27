// Props of the animals family (STYLE.md): dogs, pets, farm, zoo and small animals, wild birds. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { apply, band, ellipse, groupBounds, mix, mul, Path, rect, rotate, rrect, smooth, tone, translate, type Affine, type FlatMotion, type FlatReact, type FlatSpec, type PieceDef, type Rng, type Shape, type Vec2 } from "sahne";
import { S, P, L, num, str, goes, hex } from "./draw.ts";

// ---- helpers -----------------------------------------------------------------------------------------

/** Paint printed on a shape (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand (a whisker, a leg of a bird, a stem). */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** Shapes through an affine, their clips and stroke widths with them. */
function T(sh: Shape[], m: Affine): Shape[] {
  const k = Math.hypot(m[0], m[1]), done = new Map<Path, Path>(), t = (q: Path) => done.get(q) ?? done.set(q, q.transform(m)).get(q)!;
  return sh.map(s => ({ ...s, path: t(s.path), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * k, ...(s.stroke.dash ? { dash: s.stroke.dash.map(d => d * k) } : {}) } } : {}), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(t) : t(s.clip) } : {}) }));
}
const mv = (sh: Shape[], x: number, y: number) => T(sh, translate(x, y));
/** Shapes placed at (x, y), turned by `a` and scaled by `s`. */
const put = (sh: Shape[], x: number, y: number, a = 0, s = 1) => T(sh, mul(translate(x, y), mul(rotate(a), [s, 0, 0, s, 0, 0])));
/** A paper part: the shape in shade, the same shape in its colour moved up and left over it (the light is from the upper left), `marks` printed inside it. */
const part = (q: Path, c: string, marks: Shape[] = [], d = 0.8): Shape[] => [S(q, tone(c, "shade")), S(q.move(-d * 0.8, -d), c, { flat: true, clip: q }), ...marks.map(s => ({ ...s, clip: q }))];
/** An almond eye (or, shut, a curved line) at (x, y), `s` big. */
const eye = (x: number, y: number, s = 1, shut = false, c = "#2A2220"): Shape[] => shut ? [R([[x - s, y - 0.1 * s], [x, y + 0.4 * s], [x + s, y - 0.15 * s]], c, 0.4 * s, { flat: true, opacity: 0.85 })]
  : [P([[x - s, y + 0.1 * s, 0], [x - 0.1 * s, y - 0.75 * s], [x + s, y - 0.3 * s, 0], [x + 0.1 * s, y + 0.65 * s]], c, { flat: true }), S(ellipse(x + 0.2 * s, y - 0.25 * s, 0.22 * s), "#FFFFFF", { flat: true, opacity: 0.8 })];
/** A count param. */
const cnt = (v: unknown, d: number, max: number) => Math.max(1, Math.min(max, Math.round(num(v, d))));
/** A param of a list of values (an enum), else `d`. */
const pickOf = (v: unknown, all: readonly string[], d: string) => typeof v === "string" && all.includes(v) ? v : d;
/** A flat for an animal about `size` cm big: its resolution and paper rim follow its size, kept inside an atlas layer. */
function fl(shapes: Shape[], size: number, o: Partial<FlatSpec> = {}): FlatSpec {
  const e = Math.max(0.07, Math.min(0.45, size * 0.012)), [x0, y0, x1, y1] = groupBounds({ shapes, edge: e });
  return { ppcm: Math.min(size < 6 ? 16 : 14, 450 / size, 1900 / Math.max(1, x1 - x0, y1 - y0)), ...o, group: { shapes, edge: e } };
}
type PieceOutLike = { flats: FlatSpec[] };
/** Held: all the flats' art in one, scaled to fit `m` cm, `f` of its height above the grip (the hand holds it about there). */
function held(flats: FlatSpec[], id: string, size: number, m = 40, f = 0.45): PieceOutLike {
  const sh = flats.flatMap(q => mv(q.group.shapes, q.x ?? 0, -(q.y ?? 0))), [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge: 0 }), k = Math.min(1, m / Math.max(x1 - x0, y1 - y0));
  return { flats: [fl(T(sh, mul(translate(-(x0 + x1) / 2 * k, (y1 - y0) * k * f - y1 * k), [k, 0, 0, k, 0, 0])), size * k, { id })] };
}
/** Turned to face left (`d` −1): the shapes mirrored, their clips too. */
const face = (sh: Shape[], d: number) => d < 0 ? T(sh, [-1, 0, 0, 1, 0, 0]) : sh;
/** `n` of one animal (`make(i)` draws each, facing right) side by side, one flat each, facing `dir`; held, the first alone. */
function herd(p: Record<string, unknown>, id: string, make: (i: number) => Shape[], max: number, hm = 40, hf = 0.45, gap = 1.12): PieceOutLike {
  const hold = !!p.held, n = hold ? 1 : cnt(p.n, 1, max), d = num(p.dir, 1) < 0 ? -1 : 1, all = Array.from({ length: n }, (_, i) => face(make(i), d));
  const [x0, y0, x1, y1] = groupBounds({ shapes: all[0], edge: 0 }), size = Math.max(x1 - x0, y1 - y0), pitch = (x1 - x0) * gap;
  const flats = all.map((sh, i) => fl(sh, size, { id, shadow: "drop", x: (i - (n - 1) / 2) * pitch - (x0 + x1) / 2 }));
  return hold ? held(flats, id, size, hm, hf) : { flats };
}

// ---- dogs --------------------------------------------------------------------------------------------

/** Coats: fur, its marks, the light of muzzle, chest and paws (a patched dog's second patch last). */
const DOGS: Record<string, string[]> = {
  sandy: ["#CFA76F", "#7E5A33", "#F2E3C6"], black: ["#34302F", "#1E1C1C", "#B79F7E"], white: ["#F4F0E8", "#D9CEBB", "#FFFFFF"],
  brown: ["#8F5E3B", "#58361F", "#DDBF93"], grey: ["#8F959C", "#5C6269", "#DFE2E4"], patched: ["#F4F0E8", "#A0663A", "#F4F0E8", "#302D2D"],
};
/** Size per kind: the scale of the body, and of the head (a puppy's is big). */
const SIZES: Record<string, [number, number]> = { street: [1, 0.9], small: [0.5, 1], puppy: [0.31, 1.25] };
/** How a resting dog answers (`FlatReact`): its head turns up to anyone within 2.4 m; a tap makes it look up and bark, every flat of it answering. */
const DOG_TAP = { do: "look" as const, sound: "bark" }, DOG_LOOK = { r: 2.4, turn: -0.4, pivot: [27, -60] as [number, number] };
const TAPPED = { react: { tap: DOG_TAP } };
/** A reaction turned to face left: its pivot and turn mirror. */
const mirrorReact = (rc: FlatReact): FlatReact => rc.look ? { ...rc, look: { ...rc.look, turn: -rc.look.turn, pivot: [-rc.look.pivot[0], rc.look.pivot[1]] } } : rc;

/** One dog facing right, as a street dog (size 1): its flats in paint order. `hs` scales the head (a puppy's is big). */
function oneDog(r: Rng, pose: string, k: string, tag: boolean, step: number, go: FlatMotion | undefined, reacts: boolean, hs: number): FlatSpec[] {
  const [c, m, l, m2] = DOGS[k], sh = mix(c, "#463C38", 0.28), patched = k === "patched", mask = k === "sandy", ear = patched || k !== "white" ? m : tone(c, "shade");
  const bib = k !== "white" && !patched && r.chance(0.7), nose = k === "black" || k === "brown" ? "#16130F" : "#3A2D2A";
  const blob = (x: number, y: number, rad: number, col: string) => F(smooth(Array.from({ length: 7 }, (_, i) => [x + Math.cos(i * 0.9) * rad * r.range(0.7, 1.15), y + Math.sin(i * 0.9) * rad * r.range(0.7, 1.15)] as Vec2)), col);
  const spots = (a: [number, number, number][]) => patched ? a.map(([x, y, s], i) => blob(x, y, s, i % 2 ? m2 : m)) : [];
  const light = (q: Path) => bib ? [F(q, l)] : [];
  const flat = (shapes: Shape[], o: Partial<FlatSpec> = {}): FlatSpec => ({ group: { shapes }, ...o });
  const breathe = (ms: number) => ({ move: { sway: { dy: 0.4, ms }, phase: r() } });
  const hd = (shut: boolean) => hs > 1 ? T(head(shut), [0.82, 0, 0, 1, 0, 0]) : head(shut);

  // the head, centred on the skull: muzzle, ear (with the municipal ear tag on a street dog), nose, an almond eye
  const head = (shut: boolean): Shape[] => {
    const q = smooth([[-7.5, -2], [-6.5, -7.5], [-1, -10], [5, -8.8], [8.8, -5.2], [14, -4.4], [20, -3.6], [22.3, -2.4, 0], [22.6, 0.4], [20.4, 2.2], [14, 2.9], [10.5, 3.8], [7, 8.2], [1, 10], [-5, 8], [-8, 3]]);
    const muz = smooth([[12, -5], [20, -4.2], [23.4, -2], [23, 1], [19, 3.2], [11.5, 3.6]]);
    return [...part(q, c, [...(mask ? [F(muz, m, 0.85)] : bib ? [F(muz, l, 0.9)] : []), ...spots([[-2, -6, 4.6]]),
      F(ellipse(21.6, -2.2, 1.7, 1.4), nose), R([[21, 1], [16, 1.9], [13.4, 1.5]], tone(m, "deep"), 0.35, { flat: true, opacity: 0.8 }), ...eye(8.4, -3.6, 1.05, shut, shut ? "#2A2220" : "#4A2E1A")]),
      ...part(hs > 1 ? smooth([[-6.4, -8], [0, -10.2], [3.4, -3], [0.4, 5.4], [-6.6, 4.4], [-8.4, -3]]) : smooth([[-5.6, -7.2], [-7.4, -15.8, 0], [-1.4, -14], [3, -8.4]]), ear, [], 0.6),
      ...(tag ? [S(rrect(-5.6, -12.6, 2.8, 4, 0.8), "#F2C230"), F(ellipse(-4.2, -11.6, 0.4), "#7A5A12", 0.7)] : [])];
  };
  // a leg: a band down a spine, a paw; far legs in shade
  const leg = (sp: Vec2[], w: number[], near: boolean, spot = false): Shape[] => {
    const [px, py] = sp[sp.length - 1], col = near ? c : sh;
    return [...part(band(sp, w), col, [...light(ellipse(px, py - 1, 4.2, 5)), ...(spot ? spots([[sp[1][0], sp[1][1], 3.6]]) : [])]), ...part(ellipse(px + 1.6, py + 0.1, 4.6, 2), bib ? l : col, [], 0.4)];
  };
  const tailOf = (sp: Vec2[]) => part(band(sp, sp.map((_, i) => 7 - i * 1.1)), c, [...spots([[sp[sp.length - 1][0], sp[sp.length - 1][1], 3]])], 0.6);
  // chest, back and neck in one outline (the head overlaps its end)
  const trunk = smooth([[-31, -46], [-31, -54], [-22, -60], [-4, -59], [12, -60], [21, -65], [28, -74], [35, -72], [38, -62], [33, -52], [30, -44], [20, -36], [2, -35.5], [-13, -37], [-26, -38]]);
  const bibQ = smooth([[27, -66], [36, -62], [33, -50], [28, -40], [21, -39], [26, -52]]);

  if (pose === "walk") {
    const L1 = (x: number, a: number, hind: boolean, near: boolean): Shape[] => leg(hind ? [[x, -46], [x + 4 + a * 0.4, -30], [x - 6 + a * 0.8, -15], [x - 5 + a, -2.5]] : [[x, -46], [x + a * 0.5, -24], [x + a, -2.5]], hind ? [16, 10, 5.6, 5] : [11, 6.6, 5.2], near);
    const frame = (s: number, near: boolean) => flat([...L1(near ? -22 : -14, near ? -6 * s : 5 * s, true, near), ...L1(near ? 19 : 24, near ? 6 * s : -5 * s, false, near)], { z: near ? 0.3 : -0.5, move: { ...go, blink: { ms: step, on: 0.5, at: s > 0 ? 0 : 0.5 } } });
    const body = [...part(trunk, c, [...light(bibQ), ...spots([[-12, -52, 8], [10, -45, 6]])]), ...put(hd(false), 35, -71, 0.14, hs)];
    return [frame(1, false), frame(-1, false), flat(tailOf([[0, 0], [-5, -3], [-9, -9], [-8, -16]]), { x: -30, y: 50, z: -0.3, move: go ? { ...go, sway: { rot: 0.12, ms: step * 4 } } : { sway: { rot: 0.12, ms: step * 4 }, phase: r() } }), flat(body, { id: "dog", ...(go ? { move: go } : {}) }), frame(1, true), frame(-1, true)];
  }
  if (pose === "sleep") {
    const torso = smooth([[-31, -1], [-34, -12], [-25, -24], [-6, -29], [14, -25], [25, -15], [29, -5], [26, -0.4, 0], [-27, -0.4, 0]]);
    const thigh = smooth([[-30, -2], [-30, -13], [-20, -22], [-9, -14], [-8, -5], [-14, -1]]);
    const body = [...part(torso, c, [...light(smooth([[14, -26], [27, -14], [28, -3], [16, -6]])), ...spots([[-8, -22, 8], [8, -12, 6]])]), ...part(thigh, c, spots([[-20, -12, 5]]), 0.6),
      ...part(rrect(10, -6.4, 24, 6.4, 3.2), bib ? l : c, [], 0.4), ...part(rrect(6, -4.2, 22, 4.2, 2.1), c, [], 0.3),
      ...part(band([[-31, -4], [-24, -0.8], [-6, -1.2], [10, -3.4]], [6, 5.6, 5, 4.2]), c, spots([[-20, -2, 3]]), 0.4)];
    const head1 = (shut: boolean) => put(hd(shut), 25, -12.5, 0.38, hs);
    if (!reacts) return [flat([...body, ...head1(true)], { id: "dog", ...breathe(3600) })];
    // a tap wakes it: its eyes open as its head comes up off its paws, and shut again as it goes down; passers-by leave it asleep
    const wake = (shut: boolean) => flat(head1(shut), { id: "dog", z: 0.05, react: { look: { r: 0, turn: -0.5, pivot: [18, -14] }, tap: DOG_TAP, show: shut ? "asleep" as const : "awake" as const } });
    return [flat(body, { id: "dog", ...breathe(3600), ...TAPPED }), wake(true), wake(false)];
  }
  if (pose === "lie") {
    const torso = smooth([[-30, -1], [-32, -11], [-24, -24], [-6, -30], [8, -33], [16, -38], [22, -46], [28, -50], [34, -45], [33, -34], [29, -24], [25, -12], [19, -0.4, 0], [-26, -0.4, 0]]);
    const haunch = smooth([[-29, -2], [-30, -14], [-20, -24], [-9, -17], [-9, -6], [-15, -1]]);
    const body = [...part(torso, c, [...light(smooth([[26, -40], [33, -34], [28, -20], [22, -14], [21, -28]])), ...spots([[-6, -24, 8]])]), ...part(haunch, c, spots([[-19, -14, 5]]), 0.6),
      ...part(band([[-30, -5], [-22, -1.4], [-8, -1.2]], [6, 5, 4.4]), c, [], 0.4), ...part(band([[16, -9], [30, -5], [44, -3.4]], [11, 7.6, 6.6]), c, [], 0.5), ...part(ellipse(45, -2.8, 4.8, 3), bib ? l : c, [], 0.4)];
    const head1 = put(hd(false), 33, -56, 0.05, hs);
    return reacts ? [flat(body, { id: "dog", ...breathe(3800), ...TAPPED }), flat(head1, { id: "dog", z: 0.05, react: { look: { ...DOG_LOOK, pivot: [26, -44] }, tap: DOG_TAP } })] : [flat([...body, ...head1], { id: "dog", ...breathe(3800) })];
  }
  // standing and sitting: the sitting dog's chest rises straight, its haunch on the ground, its tail along the floor
  const sit = pose === "sit", hx = sit ? 28 : 35, hy = sit ? -63 : -71, ha = sit ? 0.06 : 0.14;
  let body: Shape[];
  if (sit) {
    const torso = smooth([[-30, -6], [-31, -20], [-25, -34], [-15, -44], [-5, -51], [8, -56], [17, -59], [24, -66], [31, -64], [33, -55], [29, -42], [26, -24], [24, -8], [20, -0.3, 0], [-25, -0.3, 0]]);
    const hip = smooth([[-31, -4], [-30, -24], [-18, -36], [-6, -26], [-4, -8], [-12, -0.4, 0], [-26, -0.4, 0]]);
    const front = (x: number, near: boolean) => part(band([[x, -40], [x + 0.8, -22], [x + 1, -3]], [11, 7, 5.6]), near ? c : sh, near ? light(ellipse(x + 1, -3, 4, 9)) : []);
    body = [...front(13, false), ...part(torso, c, [...light(smooth([[26, -62], [33, -56], [29, -40], [25, -22], [20, -30], [23, -46]])), ...spots([[-12, -42, 9]])]), ...part(hip, c, spots([[-18, -22, 6]]), 0.6), ...front(21, true),
      ...part(rrect(-8, -3, 22, 3, 1.5), bib ? l : c, [], 0.3), ...part(ellipse(14, -1.2, 4.8, 1.5), bib ? l : c, [], 0.3), ...part(ellipse(22, -1.2, 4.8, 1.5), bib ? l : c, [], 0.3)];
  } else {
    body = [...leg([[-14, -46], [-8, -30], [-15, -15], [-14, -2.5]], [14, 9, 5.4, 5], false), ...leg([[13, -46], [13.4, -24], [13, -2.5]], [11, 6.4, 5.2], false),
      ...part(trunk, c, [...light(bibQ), ...spots([[-12, -52, 8], [10, -45, 6]])]),
      ...leg([[-22, -46], [-15, -30], [-23, -15], [-21.5, -2.5]], [16, 10, 5.6, 5], true, true), ...leg([[20, -46], [20.6, -24], [20, -2.5]], [11, 6.6, 5.2], true)];
  }
  const tail = flat(sit ? tailOf([[0, 0], [-9, 1], [-20, -0.5], [-30, -1.5]]) : tailOf([[0, 0], [-6, -4], [-9, -12], [-6, -20]]), { x: -30, y: sit ? 4 : 52, z: -0.3, move: { sway: { rot: 0.1, ms: r.range(1500, 2300) }, phase: r() } });
  const headFlat = put(hd(false), hx, hy, ha, hs);
  if (!reacts) return [flat([...body, ...headFlat], { id: "dog" }), tail];
  return [flat(body, { id: "dog", ...TAPPED }), flat(headFlat, { id: "dog", z: 0.05, react: { look: { ...DOG_LOOK, pivot: [hx - 6, hy + 10] }, tap: DOG_TAP } }), { ...tail, ...TAPPED }];
}

/**
 * A street dog in cut paper, standing at 62 cm at the back (`kind` street, with the yellow ear tag of Istanbul's
 * municipal dogs), a `small` dog or a `puppy`. `pose`: sit, walk (along `go`, a stride every `step` ms), sleep (curled up,
 * breathing), lie (head up, paws forward) or stand. `coat`: sandy, black, white, brown, grey or patched (seeded when
 * left out). `dir` −1 faces left; `n` dogs side by side; `held` one in the arms. A dog that is not walking reacts (`react`,
 * default on): sitting, standing or lying, it turns its head up to anyone within 2.4 m; a tap in explore makes it look up
 * and bark ("hav hav"), and wakes a sleeping one, which opens its eyes, lifts its head, barks and settles again.
 */
const dog: PieceDef = { draw(p, r) {
  const hold = !!p.held, d = num(p.dir, 1) < 0 ? -1 : 1, n = hold ? 1 : cnt(p.n, 1, 6), kind = pickOf(p.kind, Object.keys(SIZES), "street"), pose = pickOf(p.pose, ["sit", "walk", "sleep", "lie", "stand"], "sit");
  const [s, hs] = SIZES[kind], step = Math.max(334, num(p.step, 420)), reacts = pose !== "walk" && !hold && p.react !== false, out: FlatSpec[] = [];
  for (let i = 0; i < n; i++) {
    const coat = i === 0 && DOGS[str(p.coat, "")] ? str(p.coat, "") : r.pick(Object.keys(DOGS)), x = (i - (n - 1) / 2) * 95 * s;
    let shadowed = false;
    for (const f of oneDog(r, hold ? (kind === "puppy" ? "sleep" : "lie") : pose, coat, kind === "street", step, goes(p), reacts, hs)) {
      const rc = f.react && (d < 0 ? mirrorReact(f.react) : f.react), sd = f.id && !shadowed ? { shadow: "drop" as const } : {};
      shadowed ||= !!f.id;
      out.push({ ...f, ...sd, x: (f.x ?? 0) * s * d + x, ...(f.y !== undefined ? { y: f.y * s } : {}), group: { shapes: T(f.group.shapes, [d * s, 0, 0, s, 0, 0]) },
        ...(rc ? { react: { ...rc, ...(rc.look ? { look: { ...rc.look, pivot: rc.look.pivot.map(v => v * s) as [number, number] } } : {}), home: [x, 0] as [number, number] } } : {}) });
    }
  }
  const size = 90 * s, flats = out.map(f => fl(f.group.shapes, size, f));
  return hold ? held(flats, "dog", size, 46, 0.4) : { flats };
}, variants: { street: { kind: "street" }, small: { kind: "small" }, puppy: { kind: "puppy" }, sit: { pose: "sit" }, walk: { pose: "walk" }, sleep: { pose: "sleep" }, lie: { pose: "lie" }, stand: { pose: "stand" } },
  meta: {
    about: "A dog in cut paper: a big ear-tagged street dog, a small dog or a puppy (yavru); sitting, walking, sleeping curled up, lying or standing; sandy, black, white, brown, grey or patched.",
    params: {
      kind: { type: "enum", values: ["street", "small", "puppy"], default: "street", about: "the size: a street dog (62 cm at the back, yellow ear tag), a small dog, a puppy" },
      pose: { type: "enum", values: ["sit", "walk", "sleep", "lie", "stand"], default: "sit" },
      coat: { type: "enum", values: ["sandy", "black", "white", "brown", "grey", "patched"], about: "the first dog's coat; seeded when left out" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 6, default: 1, about: "dogs side by side" },
      step: { type: "num", min: 334, default: 420, about: "a stride's length when walking, ms" },
      go: { type: "list", about: "the walk's path: [x, y, z] points, cm" },
      ms: { type: "num", min: 500, default: 20000, about: "the path's duration, ms" },
      wait: { type: "num", min: 0, default: 0, about: "pause before each pass, ms" },
      phase: { type: "num", default: 0, about: "where along the path it starts (0…1)" },
      hide: { type: "bool", default: true, about: "hidden between passes" },
      react: { type: "bool", default: true, about: "sitting, standing or lying, it turns its head to a passer-by; a tap makes it look up and bark (a sleeping one wakes)" },
    },
    terms: ["a1-w-kopek", "b1-w-sokak-kopegi", "a2-w-yavru", "a2-w-sokak-hayvani", "a2-w-hayvan"],
    tags: ["animal"],
  } };

// ---- birds -------------------------------------------------------------------------------------------

/**
 * A bird facing right, from its numbers (cm, up is negative): `b` the body (centre, half length and depth, tilt with the head end up),
 * `h` the head (centre, radius), `k` the beak (length, depth, hook), `t` the tail (length, drop, width), `g` the legs (x, toe, width),
 * `c` the colours (body, belly, wing, head, beak, legs, tail), `n` the neck's widths (at the body, at the head) through its bends `nk`
 * in colour `nc`, `w` the folded wing's length (1 = the body's); `x` prints the marks over it all.
 */
interface Bd {
  b: number[]; h: number[]; k: number[]; t: number[]; g: number[]; c: string[]; n?: number[]; nk?: Vec2[]; nc?: string; w?: number; ww?: number; wo?: number;
  x?: (m: { lc: (u: number, v: number) => Vec2; b: number[]; h: number[]; d: number; hc: Path }) => Shape[]; s?: number;
}
function bird(o: Bd): Shape[] {
  const [bx, by, rx, ry, ta] = o.b, [hx, hy, hr] = o.h, [kl, kd, kh] = o.k, [tl, td, tw] = o.t, [gx, toe, gw] = o.g, [cb, cl, cw, ch, ck, cg, ct = cw] = o.c;
  const M = mul(translate(bx, by), rotate(-ta)), lc = (u: number, v: number) => apply(M, u, v), E = (u: number, v: number, a: number, b = a) => ellipse(u, v, a, b).transform(M);
  const d = Math.max(0.12, Math.min(0.8, hr * 0.13)), sh: Shape[] = [];
  // legs, the far one in shade, each with toes
  for (const [x, c] of [[gx - gw * 3, tone(cg, "shade")], [gx, cg]] as [number, string][]) sh.push(R([[x, by + ry * 0.4], [x, -gw]], c, gw), R([[x - gw * 0.4, -gw * 0.6], [x + toe, -gw * 0.6]], c, gw * 0.9), R([[x, -gw * 0.6], [x - toe * 0.5, -gw * 0.4]], c, gw * 0.8));
  sh.push(...part(band([lc(-rx * 0.7, 0), lc(-rx * 0.7 - tl * 0.5, td * 0.35), lc(-rx * 0.75 - tl, td)], [tw * 0.8, tw, tw * 0.7]), ct, [], d));
  sh.push(...part(E(0, 0, rx, ry), cb, cl !== cb ? [F(E(rx * 0.15, ry * 0.62, rx * 0.95, ry * 0.7), cl)] : [], d));
  if (o.n) sh.push(...part(band([lc(rx * 0.6, -ry * 0.1), ...(o.nk ?? []), [hx, hy]], [o.n[0], ...(o.nk ?? []).map((_, i, a) => o.n![0] + (o.n![1] - o.n![0]) * (i + 1) / (a.length + 1)), o.n[1]]), o.nc ?? ch, [], d));
  sh.push(...part(ellipse(hx, hy, hr), ch, [], d));
  const bx0 = hx + hr * 0.6, tip: Vec2 = [bx0 + kl, hy + kd * 0.15 + kh * kd * 0.5];
  sh.push(P([[bx0 - 0.4, hy - kd * 0.5, 0], [bx0 + kl * 0.55, hy - kd * (kh ? 0.4 : 0.25)], [...tip, 0], [bx0 + kl * 0.55, hy + kd * (kh ? 0.0 : 0.12)], [bx0 - 0.4, hy + kd * 0.5, 0]], ck));
  const w = o.w ?? 1, wy = ry * (o.ww ?? 1), wl = (u: number, v: number) => lc(u, v + ry * (o.wo ?? 0)), wp = smooth([wl(rx * 0.5, -wy * 0.25), wl(rx * 0.1, -wy * 0.85), wl(-rx * 0.6, -wy * 0.75), wl(-rx * (0.95 + 0.35 * w), wy * 0.1 + (w - 1) * wy * 0.4), wl(-rx * 0.5, wy * 0.5), wl(rx * 0.2, wy * 0.5)]);
  sh.push(...part(wp, cw, [0, 1, 2].map(i => L([wl(rx * (0.2 + i * 0.05), wy * (-0.2 + i * 0.25)), wl(-rx * (0.6 + i * 0.05), wy * (0.05 + i * 0.22))], tone(cw, "deep"), Math.max(0.2, hr * 0.12), 0.5)), d));
  if (o.x) sh.push(...o.x({ lc, b: o.b, h: o.h, d, hc: ellipse(hx, hy, hr) }));
  sh.push(...eye(hx + hr * 0.32, hy - hr * 0.12, Math.max(0.35, hr * 0.2), false, "#1C1816"));
  return o.s ? T(sh, [o.s, 0, 0, o.s, 0, 0]) : sh;
}
/** A chick at (x, 0), `s` big, its head down when it pecks. */
const chick = (x: number, s: number, peck = false): Shape[] => [R([[x - 0.3 * s, -2 * s], [x - 0.3 * s, 0]], "#E2A83A", 0.4 * s), R([[x + 0.8 * s, -2 * s], [x + 0.8 * s, 0]], "#E2A83A", 0.4 * s), ...part(ellipse(x, -4 * s, 3.4 * s, 3 * s), "#F2D14A", [], 0.4 * s),
  ...part(ellipse(x + (peck ? 3.2 : 2.4) * s, (peck ? -2.6 : -7) * s, 2.1 * s), "#F2D14A", [], 0.3 * s), P([[x + (peck ? 4.7 : 3.9) * s, (peck ? -2.9 : -7.3) * s, 0], [x + (peck ? 6.2 : 5.4) * s, (peck ? -1.9 : -6.7) * s, 0], [x + (peck ? 4.6 : 3.8) * s, (peck ? -1.6 : -6.5) * s, 0]], "#E58A2E"), ...eye(x + (peck ? 3.7 : 2.9) * s, (peck ? -3.3 : -7.7) * s, 0.5 * s)];

const WH = "#F4F2EC";
/** The birds' numbers. */
const BIRDS: Record<string, Bd> = {
  sparrow: { s: 0.78, b: [0, -7.6, 6.2, 3.8, 0.3], h: [5.4, -11.8, 2.8], k: [1.9, 2, 0], t: [5.6, 1.5, 3.2], g: [0.6, 1.4, 0.45], c: ["#8F6742", "#D9CDBA", "#74492B", "#8E8B86", "#4B4743", "#B58E78", "#7A5A3C"],
    x: ({ h, lc, hc }) => [F(ellipse(h[0] - 0.1, h[1] + 0.8, 1.6, 1.1), "#EFE8DA", 1, hc), F(ellipse(h[0] + 0.7, h[1] + 2.1, 1.3, 1.1), "#2C2623", 1, hc), F(ellipse(h[0] - 1.9, h[1] + 0.3, 0.9, 1.9), "#8A4A26", 1, hc), L([lc(2, -2), lc(-2.6, -1.5)], "#EDE3D0", 0.5, 0.9)] },
  crow: { s: 0.85, b: [0, -27, 15, 8.5, 0.32], h: [16, -36, 6], k: [8.5, 4.8, 0.2], t: [17, 3, 8.5], g: [1, 4, 1.1], n: [11, 9], c: ["#2D2F36", "#383A42", "#22242A", "#2A2C33", "#1B1C1F", "#1B1C1F", "#25272D"],
    x: ({ lc }) => [L([lc(4, -4), lc(-9, -1)], "#5A6C86", 0.8, 0.6), L([lc(2, -1), lc(-10, 2)], "#4F5F78", 0.6, 0.5)] },
  nightingale: { s: 0.72, b: [0, -9.5, 6.5, 3.6, 0.4], h: [5.4, -13.6, 2.8], k: [2.3, 1.5, 0], t: [7.5, 3, 3.4], g: [0.6, 1.6, 0.45], c: ["#8B6B4B", "#D6C7AA", "#7C5C3D", "#8B6B4B", "#5A4A3B", "#A58A78", "#A4552F"],
    x: ({ h, hc }) => [F(ellipse(h[0] + 1.1, h[1] - 0.2, 0.95), "#EADFC8", 0.9), F(ellipse(h[0] + 0.3, h[1] + 1.5, 1.8, 1), "#D6C7AA", 0.8, hc)] },
  eagle: { b: [0, -41, 25, 15, 0.85], h: [17, -66, 8], k: [9.5, 7.5, 0.85], t: [26, 10, 14], g: [3, 6, 2.6], n: [20, 15], w: 1.1, c: ["#4A3626", "#58402B", "#3B2B1D", "#5A4128", "#D8B445", "#E1B73B", "#33261A"],
    x: ({ h, hc }) => [F(ellipse(h[0] - 4.6, h[1] + 1.4, 5, 4.4), "#B9894A", 0.9, hc), ...part(smooth([[-2, -24], [7, -23], [8, -15], [2, -11], [-4, -16]]), "#6A4E33", [], 0.8), F(ellipse(h[0] + 3, h[1] - 2.8, 4, 1.1), "#2A1D12", 0.6, hc)] },
  heron: { b: [0, -58, 19, 9, 0.5], h: [28, -95, 3.8], k: [18, 3.4, 0], t: [10, 4, 7], g: [-1, 7, 1.5], n: [7, 4.6], nk: [[22, -72], [21, -83], [26, -90]], nc: "#E6EAEC", c: ["#8D98A5", "#D8DCE0", "#7A8695", "#EEF0F0", "#E5AC3A", "#9B8A62", "#7A8695"],
    x: ({ h, lc }) => [R([[h[0] - 1.5, h[1] - 1], [h[0] - 9, h[1] - 2.5], [h[0] - 16, h[1] + 1.5]], "#2A2D33", 0.6, { flat: true }), F(smooth([[h[0] + 1, h[1] - 1.2], [h[0] - 4, h[1] - 2.6], [h[0] - 1, h[1] - 0.2]]), "#2A2D33", 0.9),
      L([[23, -73], [22, -83], [26, -90]], "#5A6068", 0.5, 0.7), ...[0, 1, 2].map(i => R([lc(15 - i * 2, 1 + i), lc(14 - i * 2, 10 + i * 2)], "#E8ECEE", 0.5, { flat: true }))] },
  cormorant: { b: [0, -34, 21, 11, 0.85], h: [15, -63, 5], k: [11, 3.4, 1], t: [18, 6, 10], g: [2, 5, 2.2], n: [9, 5.5], nk: [[14, -52]], w: 1.05, c: ["#272A2E", "#2C2F34", "#3A3F3A", "#272A2E", "#8E9396", "#2A2A2D", "#222428"],
    x: ({ h, lc }) => [F(ellipse(h[0] + 4, h[1] + 3.6, 3.4, 2.3), "#F0F0EA"), F(smooth([[h[0] + 3.4, h[1] - 1.6], [h[0] + 7.6, h[1] - 0.4], [h[0] + 6, h[1] + 1.8], [h[0] + 2.8, h[1] + 0.8]]), "#E4A83A"), ...[0, 1, 2, 3, 4].map(i => F(ellipse(lc(-1 - i * 4.4, -3 + (i % 2) * 4.4)[0], lc(-1 - i * 4.4, -3 + (i % 2) * 4.4)[1], 1.6, 1), "#6A6F55", 0.7))] },
  magpie: { s: 0.9, b: [0, -17, 10, 6, 0.35], h: [10, -24.5, 4.4], k: [4.6, 3.2, 0.1], t: [26, 3, 6.5], g: [1, 3, 0.9], n: [7, 6.5], c: ["#1F2227", WH, "#1F2227", "#1F2227", "#1A1A1C", "#1A1A1C", "#27323C"],
    x: ({ lc }) => [F(smooth([lc(6, -4), lc(1, -5.4), lc(-1, -3), lc(4, -1.5)]), WH), L([lc(-2, -2), lc(-8, 0)], "#3E7C8A", 0.9, 0.7), L([lc(-10, 1), lc(-24, 3)], "#2F6F5A", 1.2, 0.55)] },
  stork: { b: [0, -74, 19, 10, 0.5], h: [27, -103, 4.3], k: [20, 3.2, 0], t: [8, 4, 8], g: [3, 8, 1.6], n: [8, 5.6], nk: [[22, -84], [25, -94]], c: [WH, WH, WH, WH, "#D2452F", "#D2452F", WH],
    x: ({ lc }) => [F(smooth([lc(8, 4), lc(2, 0.4), lc(-10, 1), lc(-27, 1.2), lc(-12, 5.6)]), "#2A2A2E")] },
  hen: { b: [0, -22, 13, 10.5, 0.12], h: [14.5, -34.5, 4.2], k: [3.4, 2.8, 0.2], t: [10, -10, 8], g: [0.5, 3.4, 1], n: [9, 6], c: ["#B5763F", "#C98B4E", "#9B5E2C", "#B5763F", "#E2A83A", "#E2A83A", "#7D4A25"],
    x: ({ h }) => [P([[h[0] - 2.2, h[1] - 3.4], [h[0] - 1.6, h[1] - 6.8, 0], [h[0] - 0.4, h[1] - 3.8], [h[0] + 0.4, h[1] - 7.6, 0], [h[0] + 1.4, h[1] - 3.6], [h[0] + 2.2, h[1] - 6, 0], [h[0] + 2.6, h[1] - 3]], "#D8342B"), P([[h[0] + 3.2, h[1] + 2.2], [h[0] + 4.3, h[1] + 5.2, 0], [h[0] + 2.4, h[1] + 4.8]], "#D8342B"), F(ellipse(h[0] - 0.5, h[1] + 1.1, 0.9, 0.7), WH)] },
  rooster: { b: [0, -33, 15, 11.5, 0.45], h: [18, -53, 4.6], k: [4, 3.2, 0.2], t: [14, -12, 9], g: [0.5, 4.5, 1.2], n: [10, 6], nc: "#E0A83A", c: ["#B9502B", "#8A3A22", "#8F3B1D", "#D9902E", "#E2A83A", "#E2A83A", "#2F5A4B"],
    x: ({ h, lc }) => [P([[h[0] - 3, h[1] - 3.6], [h[0] - 2.6, h[1] - 8.2, 0], [h[0] - 1.2, h[1] - 4.6], [h[0] - 0.4, h[1] - 9.4, 0], [h[0] + 0.8, h[1] - 4.4], [h[0] + 1.8, h[1] - 8.2, 0], [h[0] + 2.8, h[1] - 3.8], [h[0] + 3.4, h[1] - 6, 0], [h[0] + 3.6, h[1] - 3]], "#D8342B"), P([[h[0] + 3.4, h[1] + 2.4], [h[0] + 4.6, h[1] + 6.4, 0], [h[0] + 2.4, h[1] + 5.4]], "#D8342B"),
      ...([["#2F5A4B", 0], ["#3C7A5E", 1], ["#C98A2E", 2]] as [string, number][]).flatMap(([c, i]) => part(band([lc(-12, -5), [-17 - i * 2.4, -46 - i * 3.4], [-26 - i * 2, -49 - i * 3], [-30 - i, -40 - i * 2.6]], [3, 3.6, 2.8, 0.8]), c, [], 0.4))] },
  duck: { b: [0, -14, 14, 7.5, 0.1], h: [17.5, -26, 4.3], k: [7, 2.4, 0], t: [5, -2, 5], g: [1, 4, 1], n: [7, 5.5], c: ["#B8B6B0", "#CFCDC6", "#8E8C85", "#2F6B4F", "#E5C037", "#E7852B", "#2A2A2E"],
    x: ({ lc }) => [F(ellipse(lc(10, 0)[0], lc(10, 0)[1], 5, 7.6), "#7A4B35"), L([lc(14, -4), lc(15.4, 5)], WH, 1, 0.95), F(smooth([lc(-2, -1), lc(-8, -2), lc(-8, 1), lc(-2, 2)]), "#2F4F9A", 0.9)] },
  penguin: { b: [0, -34, 29, 14, 1.5], h: [2.5, -66, 6.2], k: [8, 3.4, 0.1], t: [7, 6, 7], g: [0, 5, 1.8], w: 0.9, ww: 0.5, wo: -0.5, c: ["#2A2D33", WH, "#23262B", "#2A2D33", "#33302E", "#E8A27A", "#2A2D33"],
    x: ({ h }) => [F(smooth([[h[0] + 4.8, h[1] + 0.6], [h[0] + 7.4, h[1] + 1.4], [h[0] + 5.6, h[1] + 2.4]]), "#E8A27A"), L([[h[0] - 4.4, h[1] + 2], [h[0] + 0.5, h[1] + 7.2], [h[0] + 2.6, h[1] + 14]], WH, 1.3, 0.95)] },
  budgie: { b: [0, -9.5, 5.5, 3.6, 0.9], h: [3.4, -14.2, 2.6], k: [1.5, 1.8, 0.2], t: [8, 2, 2.4], g: [0.5, 1.2, 0.45], c: ["#6FBF4A", "#8ED05E", "#5BA33A", "#F4D84A", "#E8B04A", "#C7A58E", "#2E7FBF"],
    x: ({ h, lc }) => [F(ellipse(h[0] - 0.2, h[1] + 1.1, 0.8, 0.6), "#4A5AB8"), ...[0, 1, 2].map(i => F(ellipse(h[0] + 1.3 - i * 0.2, h[1] + 2.7 + i * 0.4, 0.28), "#22262B", 0.8)), ...[0, 1, 2, 3].map(i => L([lc(2 - i * 2, -2.6), lc(1.2 - i * 2, -1.4)], "#2A2D33", 0.35, 0.8))] },
};

const WILD = ["sparrow", "crow", "nightingale", "eagle", "heron", "cormorant", "magpie", "stork"];
/** Wild birds perched side on, at their real size: a sparrow (15 cm), crow, nightingale (bülbül), eagle (kartal, 75 cm), grey heron, the Bosphorus cormorant (karabatak), magpie or stork (leylek, 1 m); `dir` −1 faces left; `n` side by side. */
const wildBird: PieceDef = { draw: p => { const k = pickOf(p.kind, WILD, "sparrow"); return herd(p, "wild_bird", () => bird(BIRDS[k]), 12, 46, { eagle: 0.12, heron: 0.6, stork: 0.66 }[k as "eagle"] ?? 0.5); },
  variants: Object.fromEntries(WILD.map(k => [k, { kind: k }])),
  meta: {
    about: "A wild bird perched and still, side on, at its real size: a sparrow, crow, nightingale (bülbül), eagle (kartal), grey heron, cormorant (karabatak), magpie or white stork (leylek).",
    params: {
      kind: { type: "enum", values: WILD, default: "sparrow" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "birds side by side" },
    },
    terms: ["a2-w-bulbul", "a2-w-kartal", "a1-w-kus"],
    tags: ["animal", "bird"],
  } };

// ---- pets --------------------------------------------------------------------------------------------

const GLASS = "#DDEFF5", WATER = "#8EC9E0", LEAF = "#4E8F4A";
/** A fish at (x, y) facing right, `s` times 8 cm long, in `c` with a lighter belly. */
const fish = (x: number, y: number, s: number, c: string): Shape[] => {
  const o = ellipse(x, y, 4.4 * s, 2.9 * s);
  return [P([[x - 3.2 * s, y, 0], [x - 7.6 * s, y - 3.4 * s, 0], [x - 6.4 * s, y], [x - 7.6 * s, y + 3.4 * s, 0]], tone(c, "shade")), P([[x - 2 * s, y - 2.4 * s, 0], [x, y - 5 * s], [x + 2 * s, y - 2.6 * s, 0]], tone(c, "shade")),
    S(o, c), F(ellipse(x + 0.4 * s, y + 1.4 * s, 3.8 * s, 1.5 * s), tone(c, "light"), 0.8, o), P([[x - 0.4 * s, y + 0.6 * s, 0], [x - 2.6 * s, y + 3.4 * s, 0], [x + 0.4 * s, y + 1.4 * s]], tone(c, "shade")), L([[x + 2 * s, y - 2 * s], [x + 2.6 * s, y + 1.6 * s]], tone(c, "deep"), 0.3 * s, 0.6), ...eye(x + 2.9 * s, y - 0.6 * s, 0.6 * s)];
};
/** A water plant at (x, 0), `h` tall, in a few strands. */
const weed = (x: number, h: number): Shape[] => [-1, 0, 1].map(i => R([[x + i * 1.6, 0], [x + i * 2.6 + 1.2, -h * 0.5], [x + i * 2 - 1, -h * (0.85 - Math.abs(i) * 0.12)]], i ? tone(LEAF, "light") : LEAF, 0.9));
const bubbles = (pts: [number, number, number][]): Shape[] => pts.map(([x, y, r]) => F(ellipse(x, y, r), "#FFFFFF", 0.6));

/** The pets, each drawn facing right with its colour `c`. */
const PETS: Record<string, [string, (c: string) => Shape[], number]> = {
  goldfish: ["#EE7B2D", c => {
    const bowl = smooth([[-6.4, -25, 0], [-9.8, -22.4], [-12.4, -17], [-12.8, -11], [-10.6, -5], [-6, -1.4], [0, -0.5], [6, -1.4], [10.6, -5], [12.8, -11], [12.4, -17], [9.8, -22.4], [6.4, -25, 0]]);
    return [S(bowl, GLASS, { opacity: 0.4 }), F(rect(-14, -20.6, 28, 22), WATER, 0.55, bowl), ...[-7, -3, 1, 5, 8.4].map((x, i) => F(ellipse(x, -2.2 + (i % 2) * 0.6, 2.2, 1.4), ["#E6D7B8", "#C9B98E", "#E8A9B5", "#9FC6D9", "#D9C79A"][i], 1, bowl)), ...weed(-5.4, 11), ...weed(7.4, 8),
      ...fish(-1, -12.6, 1, c), ...fish(5, -17, 0.55, tone(c, "light")), ...bubbles([[2.6, -16.6, 0.5], [3.2, -19, 0.35]]),
      L([[-10.4, -9], [-10.2, -16], [-8, -20.4]], "#FFFFFF", 0.9, 0.7), L([[9.8, -9], [8.4, -14]], "#FFFFFF", 0.5, 0.5), S(ellipse(0, -25, 6.5, 0.9), GLASS, { opacity: 0.6, flat: true })];
  }, 0.5],
  aquarium: ["#E8A33A", c => {
    const tank = rrect(-30, -34, 60, 34, 1.6);
    return [S(tank, GLASS, { opacity: 0.32 }), F(rect(-30, -29, 60, 30), WATER, 0.5, tank), F(rect(-30, -4.4, 60, 5), "#D9C79A", 1, tank), ...[[-18, -5.4, 4, 2.4], [14, -5, 5, 2.8]].map(([x, y, a, b]) => F(ellipse(x, y, a, b), "#8E8F8A", 1, tank)),
      ...weed(-23, 20), ...weed(-9, 14), ...weed(22, 22), ...fish(-4, -17, 1.5, c), ...fish(11, -22, 1.1, "#3F82C8"), ...fish(-14, -26, 0.7, "#E8584F"), ...bubbles([[20, -9, 0.7], [19.6, -14, 0.5], [20.4, -19, 0.8], [24, -12, 0.4]]),
      S(rrect(-31.4, -2.4, 62.8, 2.4, 0.6), "#2A2C31"), S(rrect(-31.4, -36.4, 62.8, 2.6, 0.6), "#2A2C31"), F(rect(-26, -35.6, 52, 0.8), "#F4F0DC", 0.8), L([[-27.6, -7], [-27.6, -29]], "#FFFFFF", 1, 0.6)];
  }, 0.5],
  budgie: ["#6FBF4A", c => {
    const dome = smooth([[-15, -28, 0], [-14.4, -34.5], [-9, -40.5], [0, -43], [9, -40.5], [14.4, -34.5], [15, -28, 0]], false), bars = [-12, -8, -4, 0, 4, 8, 12].map(x => R([[x, -3], [x, -28], [x * 0.96, -34], [x * 0.5, -40.5], [0, -43]], "#B8BEC4", 0.35, { flat: true, opacity: 0.95 }));
    const b = T(bird({ ...BIRDS.budgie, c: [c, tone(c, "light"), tone(c, "shade"), ...BIRDS.budgie.c.slice(3)], b: [0, -9.5, 5.5, 3.6, 0.9] }), translate(0, -9.8));
    return [S(rrect(-16, -3.4, 32, 3.4, 1.2), "#D9D3C6"), ...b, ...bars, { path: dome, stroke: { color: "#B8BEC4", width: 0.5 }, flat: true }, R([[-15, -28], [15, -28]], "#B8BEC4", 0.6), R([[-14.6, -9.6], [14.6, -9.6]], "#8A5A3C", 1.2), R([[0, -43], [0, -49]], "#B8BEC4", 0.5), { path: ellipse(0, -50, 2.4, 2.6), stroke: { color: "#B8BEC4", width: 0.6 }, flat: true },
      S(rrect(8, -7.6, 6, 4.2, 1.2), "#E0A83A"), ...[0, 1, 2].map(i => F(ellipse(9.6 + i * 1.4, -7.8, 0.6, 0.4), "#8A6A2E"))];
  }, 1],
  rabbit: ["#A89886", c => {
    const wh = "#F4F0E8", ear = (x: number, a: number, h: number, col: string) => [...part(band([[x, -27], [x + a * 0.5, -27 - h * 0.55], [x + a, -27 - h]], [4.2, 4.2, 1.6]), col, [F(band([[x, -28], [x + a * 0.5, -27 - h * 0.55], [x + a * 0.96, -27 - h * 0.9]], [2, 2.2, 0.8]), "#E8A9B5", 0.8)], 0.5)];
    return [...ear(8, 4, 15, tone(c, "shade")), ...part(ellipse(-13.2, -8.4, 3.2), wh, [], 0.4), ...part(smooth([[-14, -8], [-12, -16], [-4, -22], [5, -22], [10, -16], [10, -8], [6, -2], [-8, -1]]), c, [F(ellipse(7, -7, 4, 7), wh, 0.85)]),
      ...part(ellipse(-3, -9, 10, 9), c, [], 0.6), ...part(ellipse(4, -2.2, 9, 2.2), c, [F(ellipse(6, -2, 5, 1.6), wh, 0.7)], 0.4), ...part(band([[8, -14], [9, -8], [9.4, -2.4]], [5, 3.6, 3]), c, [], 0.4), ...part(ellipse(10.4, -2, 3, 1.4), wh, [], 0.3),
      ...part(smooth([[2, -24], [5, -29.4], [11, -28.6], [16, -23.4], [16.8, -20.6, 0], [13, -17.6], [7, -18], [3, -20]]), c, [F(ellipse(13.6, -20.4, 3.8, 2.6), wh, 0.9)], 0.5), ...ear(5.6, -3, 16, c),
      F(ellipse(16.7, -21.4, 0.9, 0.7), "#D98483"), ...eye(11.2, -23.6, 1.1, false, "#2A1F1A"), ...[[-1.6, 0.4], [-1.8, 1.6]].map(([dy, dx]) => L([[15, -20.4], [19.4, -20.4 + dy * 1.6 + dx]], "#FFFFFF", 0.25, 0.8))];
  }, 0.4],
  turtle: ["#7A6A3C", c => {
    const skin = "#A8A56B", shell = smooth([[-10.2, -1.6, 0], [-11.2, -5.4], [-8, -9.6], [0, -11.8], [8, -9.6], [11.2, -5.4], [10.4, -1.6, 0]]);
    const leg = (x: number, col: string) => [...part(band([[x, -4.6], [x + 0.2, -2], [x + 0.4, -1]], [3.8, 3.5, 3.3]), col, [], 0.3), ...part(ellipse(x + 1.1, -0.8, 2.6, 0.9), col, [], 0.2)];
    return [...part(band([[-9, -4.4], [-12, -3.6], [-13.4, -2.4]], [3, 2, 1]), skin, [], 0.4), ...leg(-3.6, tone(skin, "shade")), ...leg(10.2, tone(skin, "shade")),
      ...part(band([[9, -6.2], [13.6, -6.4], [16, -7]], [3.8, 3.2, 2.6]), skin, [], 0.4), ...part(ellipse(17.2, -7, 3, 2.4), skin, [F(ellipse(19, -5.8, 1.6, 0.8), tone(skin, "light"), 0.7)], 0.4), ...eye(18.2, -7.7, 0.6),
      ...mv(part(shell, c, [F(smooth([[-4, -10], [0, -11.2], [4, -10], [4.6, -6], [0, -4.6], [-4.6, -6]]), tone(c, "light"), 0.45), ...[[-8.4, -8.4, -6.4, -3], [-4.2, -10, -4.8, -4.6], [4.2, -10, 4.8, -4.6], [8.4, -8.4, 6.4, -3], [0, -4.6, 0, -2]].map(([a, b, x, y]) => L([[a, b], [x, y]], tone(c, "deep"), 0.4, 0.7)), L([[-5, -6.2], [0, -4.6], [5, -6.2]], tone(c, "deep"), 0.4, 0.7)], 0.6), 0, -1.8),
      ...part(rrect(-10.4, -3.9, 20.8, 1.4, 0.7), tone(c, "deep"), [], 0.2), ...leg(-8.2, skin), ...leg(6.6, skin)];
  }, 0.15],
  hamster: ["#D9A25E", c => {
    const wh = "#F6EBD8";
    return [...part(ellipse(0.4, -1, 2.6, 1), tone(c, "light"), [], 0.3), ...part(ellipse(4, -0.8, 2.4, 1), tone(c, "light"), [], 0.3), ...part(smooth([[-4.6, -2], [-5.6, -7], [-3, -11], [2, -12.4], [5, -9], [5.4, -4], [3, -0.6], [-2, -0.4]]), c, [F(ellipse(3.2, -5.2, 2.4, 4.2), wh, 0.9)], 0.5),
      ...part(ellipse(0.2, -14.6, 1.6, 1.8), tone(c, "shade"), [F(ellipse(0.4, -14.5, 0.8, 1), "#E8A9B5", 0.9)], 0.3), ...part(ellipse(3.6, -11.4, 3.7, 3.2), c, [F(ellipse(5.2, -10.6, 2.5, 1.8), wh, 0.9)], 0.5),
      F(ellipse(7.1, -11.8, 0.7, 0.55), "#D98483"), ...eye(5.2, -12.6, 0.55, false, "#2A1F1A"), ...[0, 1].map(i => L([[6.4, -11 + i * 0.4], [9.6, -11.8 + i * 1.5]], "#FFFFFF", 0.2, 0.8)), ...part(ellipse(5.6, -8.4, 1.4, 1), wh, [], 0.2), ...part(smooth([[6.2, -8.6, 0], [8.8, -9.8], [9.6, -8.8, 0], [7.2, -7.4]]), "#6A5A44", [], 0.2), L([[6.8, -8.5], [9, -9.3]], "#D8D0C0", 0.3, 0.9)];
  }, 0.15],
  mouse: ["#9A9AA0", c => [R([[-4.2, -2], [-8.4, -3.4], [-10.8, -1.4], [-12.6, -3.6]], "#E8A9B5", 0.5), ...part(ellipse(-2.4, -0.7, 1.4, 0.7), tone(c, "shade"), [], 0.2), ...part(ellipse(3, -0.7, 1.1, 0.7), tone(c, "shade"), [], 0.2),
    ...part(smooth([[-4.8, -3.4], [-1.4, -5.2], [3, -4.4], [6.2, -2.7, 0], [3.4, -0.7], [-1, -0.4], [-4.4, -1.2]]), c, [F(ellipse(1.4, -1.4, 4.6, 1), tone(c, "light"), 0.8)], 0.4), ...part(ellipse(2, -5.4, 1.9, 2.1), c, [F(ellipse(2.1, -5.3, 1.1, 1.3), "#E8A9B5", 0.9)], 0.3),
    F(ellipse(6.2, -2.7, 0.6, 0.5), "#D98483"), ...eye(4.1, -3.7, 0.5, false, "#1C1816"), ...[0, 1].map(i => L([[5.4, -2.6 + i * 0.3], [8.6, -3.4 + i * 1.8]], "#FFFFFF", 0.15, 0.9))], 0.15],
  carrier: ["#3E6FB3", c => {
    const dk = tone(c, "shade"), door = rrect(-14, -25, 28, 19, 2);
    return [R([[-8, -33], [-6, -38.4], [6, -38.4], [8, -33]], dk, 2.2), ...part(rrect(-19, -28, 38, 28, 4), c, [], 0.7), ...part(rrect(-19.6, -33.4, 39.2, 9, 3), dk, [...[-8, 0, 8].map(x => L([[x - 3, -29], [x + 3, -29]], tone(dk, "deep"), 0.7, 0.7))], 0.5),
      S(door, "#2B2F36"), ...[-12, -8.4, -4.8, -1.2, 2.4, 6, 9.6, 12.4].map(x => R([[x, -24.4], [x, -6.6]], "#C9CED3", 0.6)), R([[-14, -24.6], [14, -24.6]], "#C9CED3", 0.7), R([[-14, -6.4], [14, -6.4]], "#C9CED3", 0.7),
      S(rrect(15.2, -17, 2.6, 5, 1), "#E0A83A"), ...[-21, -10].map(y => S(rrect(-19.4, y - 2.5, 2.6, 3.6, 0.8), tone(c, "deep")))];
  }, 1],
};
const PET_KEYS = Object.keys(PETS);
/** Pets: a goldfish in its bowl, an aquarium, a budgie in its cage, a rabbit, a tortoise, a hamster, a mouse or a pet carrier; `color` the animal's (or the carrier's) own; held, a bowl is cupped, the cage hangs by its ring, a small pet sits on the palm. */
const pet: PieceDef = { draw: p => {
  const k = pickOf(p.kind, PET_KEYS, "goldfish"), [dc, make, grip] = PETS[k], c = hex(p.color, dc);
  const sz = { rabbit: 0.9, turtle: 0.75, hamster: 0.62 }[k as "rabbit"];
  return herd(p, "pet", () => sz ? T(make(c), [sz, 0, 0, sz, 0, 0]) : make(c), 12, k === "aquarium" ? 36 : 44, grip, 1.08);
}, variants: Object.fromEntries(PET_KEYS.map(k => [k, { kind: k }])),
  meta: {
    about: "A pet in cut paper: a goldfish in its bowl, an aquarium with fish, a budgie in its cage, a rabbit (tavşan), a tortoise (kaplumbağa), a hamster, a mouse (fare) or a pet carrier.",
    params: {
      kind: { type: "enum", values: PET_KEYS, default: "goldfish" },
      color: { type: "color", about: "the animal's own colour (the fish, the budgie's body, the fur, the shell) or the carrier's; each kind has its own default" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "side by side" },
    },
    terms: ["a2-w-tavsan", "a2-w-kaplumbaga", "a1-w-fare", "a2-w-hayvan", "a1-w-balik"],
    tags: ["animal", "pet"],
  } };

// ---- four-legged animals -----------------------------------------------------------------------------

/**
 * A four-legged animal facing right from its numbers (cm, up is negative): `c` coat, `c2` light parts, `c3` dark (hooves, tufts); `bl` torso length,
 * `H` back height, `D` torso depth, `lw` leg width, `rd` how much lower the rump is; `nk` the neck (head centre forward and up from the chest's top,
 * widths at the body and the head, arch), `hd` the head (skull radius, snout length, snout half-depth, tilt), `hk` the hind legs' bend, `lg` the
 * legs' colour, `ft` hoof or paw, `tl` the tail (hang, flow, up or bush; length, width), `wool` a cloud for a torso; `hx` draws the head's own
 * parts (ears, horns, muzzle), in the head's own coordinates; `x` and `xb` the rest in front of and behind the neck; `pat` marks on the torso and the neck.
 */
interface Qd {
  c: string; c2: string; c3: string; bl: number; H: number; D: number; lw: number; rd?: number; hm?: number; nk?: number[]; hd?: number[]; hk?: number; lg?: string; ft?: "hoof" | "paw" | "foot"; tl?: [string, number, number]; wool?: boolean; nc?: string; hc?: string; wh?: number; bel?: string; lm?: (x: number) => Shape[]; pc?: string;  hx?: (r: number, s: number, t: number) => Shape[]; x?: (m: Qm) => Shape[]; xb?: (m: Qm) => Shape[]; pat?: () => [Shape[], Shape[]]; nohead?: boolean;
}
/** What the extras of a four-legged animal get: its head's place, its neck's points, its torso. */
interface Qm { hp: (u: number, v: number) => Vec2; nk: (t: number, k: number) => Vec2; torso: Path; bl: number; H: number; D: number }
function quad(o: Qd): Shape[] {
  const { c, c2, c3, bl, H, D, lw } = o, rd = o.rd ?? 0, wh = o.wh ?? 0, hk = o.hk ?? 1, lg = o.lg ?? c, f = bl / 2, [hr, hs, ht, ha] = o.hd ?? [10, 28, 6, 0.4], nk = o.nk ?? [20, -20, 30, 20], ft = o.ft ?? "hoof";
  const far = (col: string) => mix(col, "#463C38", 0.28), d = Math.max(0.3, Math.min(0.9, D * 0.025)), ll = H - D;
  const tp: (Vec2 | [number, number, number])[] = o.wool ? Array.from({ length: 24 }, (_, i): Vec2 | [number, number, number] => { const a = i / 24 * Math.PI * 2, k = i % 2 ? 1.1 : 0.93, x = Math.cos(a) * bl * 0.52 * k, y = -H + D * 0.5 + Math.sin(a) * D * 0.54 * k; return i % 2 ? [x, y] : [x, y, 0]; })
    : [[-f + bl * 0.04, -H + D * 0.12 + rd], [-bl * 0.32, -H - D * 0.02 + rd * 0.6], ...(o.hm ? [[-bl * 0.2, -H - o.hm * 0.15], [-bl * 0.12, -H - o.hm * 0.75], [-bl * 0.02, -H - o.hm], [bl * 0.08, -H - o.hm * 0.8], [bl * 0.17, -H - o.hm * 0.15]] as Vec2[] : [[0, -H + D * 0.03 + rd * 0.25 - wh * 0.5] as Vec2]), [bl * 0.3, -H - D * 0.03 - wh], [f - bl * 0.02, -H + D * 0.2 - wh * 0.6], [f + bl * 0.02, -H + D * 0.55], [f - bl * 0.1, -H + D * 0.98], [bl * 0.1, -H + D * 1.02], [-bl * 0.25, -H + D * 0.88], [-f + bl * 0.02, -H + D * 0.6 + rd * 0.5]];
  const torso = smooth(tp), sh: Shape[] = [];
  const [tm, nm] = o.pat ? o.pat() : [[], []];
  // a leg: its hip in the torso, a bend at the hock, a hoof or a paw
  const leg = (x: number, hind: boolean, near: boolean): Shape[] => {
    const col = near ? lg : far(lg), w = lw, y0 = o.wool ? -H + D * 0.75 : hind ? -H + D * 0.4 + rd * 0.5 : -H + D * 0.45, sp: Vec2[] = hind ? [[x, y0], [x + w * 1.4 * hk, -ll * 0.62], [x - w * 0.5 * hk, -ll * 0.3], [x, -w * 0.7]] : [[x, y0], [x + w * 0.1, -ll * 0.5], [x, -w * 0.7]];
    const hoof = ft === "hoof" ? part(rrect(x - w * 0.5, -w * 0.78, w * 1.1, w * 0.78, 1), near ? o.pc ?? c3 : far(o.pc ?? c3), [], d * 0.5) : ft === "paw" ? [...part(ellipse(x + w * 0.35, -w * 0.5, w * 0.95, w * 0.5), o.pc ? (near ? o.pc : far(o.pc)) : col, [], d * 0.5), ...[0, 1, 2].map(i => L([[x + w * (0.9 + i * 0.1), -w * 0.9 + i * w * 0.4], [x + w * (1.3 + i * 0.1), -w * 0.8 + i * w * 0.4]], "#E8DFCF", w * 0.12, 0.8))]
      : [...part(ellipse(x + w * 0.1, -w * 0.45, w * 0.78, w * 0.5), near ? tone(col, "shade") : col, [], d * 0.5), ...[-0.4, 0, 0.4].map(i => F(ellipse(x + w * (0.6 + i * 0.1), -w * 0.4 + i * w * 0.15, w * 0.1, w * 0.14), "#D8CFC0"))];
    return [...part(band(sp, hind ? [w * 2.3, w * 1.5, w * 0.95, w * 0.85] : [w * 1.6, w * 1.05, w * 0.85]), col, o.lm ? o.lm(x) : [], d), ...hoof];
  };
  sh.push(...leg(-f + bl * 0.21, true, false), ...leg(f - bl * 0.17, false, false));
  const nearLegs = () => [...leg(-f + bl * 0.14, true, true), ...leg(f - bl * 0.1, false, true)];
  if (o.wool) sh.push(...nearLegs());
  const [tk, tl, tw] = o.tl ?? ["h", 80, 4], t0: Vec2 = [-f + 1, -H + D * 0.14 + rd];
  const tails: Record<string, Shape[]> = {
    h: [...part(band([t0, [t0[0] - 3, t0[1] + tl * 0.5], [t0[0] - 2, t0[1] + tl * 0.92]], [tw, tw * 0.8, tw * 0.7]), c, [], d * 0.6), ...part(ellipse(t0[0] - 2, t0[1] + tl * 0.94, tw * 1.5, tl * 0.1), c3, [], d * 0.6)],
    f: part(band([t0, [t0[0] - tl * 0.22, t0[1] + tl * 0.12], [t0[0] - tl * 0.22, t0[1] + tl * 0.55], [t0[0] - tl * 0.16, t0[1] + tl * 0.95]], [tw * 0.5, tw, tw * 0.9, tw * 0.3]), c3, [], d),
    u: part(smooth([[t0[0] + 1, t0[1] + 2], [t0[0] - tl * 0.5, t0[1] - tl * 0.7, 0], [t0[0] - tl * 0.1, t0[1] + tl * 0.1]]), c, [], d * 0.6),
    b: part(band([t0, [t0[0] - tl * 0.45, t0[1] + tl * 0.05], [t0[0] - tl * 0.8, t0[1] + tl * 0.25], [t0[0] - tl, t0[1] + tl * 0.5]], [tw * 0.4, tw, tw * 0.9, tw * 0.25]), c, [F(ellipse(t0[0] - tl * 0.92, t0[1] + tl * 0.42, tl * 0.14, tl * 0.18), c3, 0.95)], d),
  };
  sh.push(...tails[tk] ?? []);
  sh.push(...part(torso, c, [...(o.bel ? [F(smooth([[-f, -H + D * 0.8 + rd * 0.5], [-bl * 0.2, -H + D * 0.8], [bl * 0.2, -H + D * 0.84], [f, -H + D * 0.78], [f, -H + D * 1.1], [-f, -H + D * 1.1]]), o.bel, 0.85)] : []), ...tm], d * 1.2));
  // the neck from the chest's top to the head, arched by `cv`
  const hx = f + nk[0], hy = -H + nk[1], a: Vec2 = [f - bl * 0.12, -H + D * 0.3], len = Math.hypot(hx - a[0], hy - a[1]), cv = nk[4] ?? 0.1, mid: Vec2 = [(a[0] + hx) / 2 + (hy - a[1]) / len * cv * len, (a[1] + hy) / 2 - (hx - a[0]) / len * cv * len];
  const neck = [a, mid, [hx, hy] as Vec2];
  sh.push(...part(band(neck, [nk[2], (nk[2] + nk[3]) / 2, nk[3]]), o.nc ?? c, nm, d * 1.1));
  const HT = mul(translate(hx, hy), rotate(ha)), q1: Vec2 = [2 * mid[0] - (a[0] + hx) / 2, 2 * mid[1] - (a[1] + hy) / 2];
  // a point on the neck at `t` (0 body, 1 head), `k` cm off its spine towards the back
  const along = (t: number, k: number): Vec2 => { const u = 1 - t, x = u * u * a[0] + 2 * u * t * q1[0] + t * t * hx, y = u * u * a[1] + 2 * u * t * q1[1] + t * t * hy, tx = 2 * u * (q1[0] - a[0]) + 2 * t * (hx - q1[0]), ty = 2 * u * (q1[1] - a[1]) + 2 * t * (hy - q1[1]), l = Math.hypot(tx, ty) || 1; return [x + ty / l * k, y - tx / l * k]; };
  const m: Qm = { hp: (u, v) => apply(HT, u, v), nk: (t, k) => along(t, k * (nk[2] + (nk[3] - nk[2]) * t)), torso, bl, H, D };
  if (o.xb) sh.push(...o.xb(m));
  if (!o.nohead) {
    const hp = smooth([[-hr * 0.9, -hr * 0.35], [-hr * 0.35, -hr * 0.95], [hr * 0.45, -hr * 0.88], [hs * 0.62, -ht * 1.05], [hs * 0.95, -ht * 0.9], [hs * 1.04, -ht * 0.2], [hs * 0.98, ht * 0.65], [hs * 0.62, ht * 0.95], [hr * 0.45, hr * 0.62], [-hr * 0.35, hr * 0.95], [-hr * 0.95, hr * 0.4]]);
    sh.push(...T([...part(hp, o.hc ?? c, c2 !== c ? [F(ellipse(hs * 0.86, ht * 0.15, hs * 0.2, ht * 1.1), c2, 0.9)] : [], d), ...(o.hx ? o.hx(hr, hs, ht) : []), F(ellipse(hs * 0.99, -ht * 0.35, ht * 0.18, ht * 0.14), "#2A1F1C", 0.85), R([[hs * 0.98, ht * 0.4], [hs * 0.72, ht * 0.32]], "#2A1F1C", Math.max(0.2, ht * 0.07), { flat: true, opacity: 0.6 }), ...eye(hr * 0.4, -hr * 0.18, Math.max(0.5, hr * 0.14), false, "#241915")], HT));
  }
  if (!o.wool) sh.push(...nearLegs());
  if (o.x) sh.push(...o.x(m));
  return sh;
}
/** A wobbly blob at (x, y), radius `r0`. */
const blob = (r: Rng, x: number, y: number, r0: number, c: string): Shape => F(smooth(Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * 0.785) * r0 * r.range(0.65, 1.2), y + Math.sin(i * 0.785) * r0 * r.range(0.65, 1.2)] as Vec2)), c);
/** A leaf-shaped ear, from (x, y) pointing at angle `a` for `len`, `w` wide. */
const leaf = (x: number, y: number, a: number, len: number, w: number, c: string, inner?: string): Shape[] => {
  const q = smooth([[0, 0, 0], [len * 0.45, -w / 2], [len, 0, 0], [len * 0.45, w / 2]]).transform(mul(translate(x, y), rotate(a)));
  return [...part(q, c, inner ? [F(smooth([[len * 0.1, 0, 0], [len * 0.45, -w * 0.28], [len * 0.85, 0, 0], [len * 0.45, w * 0.28]]).transform(mul(translate(x, y), rotate(a))), inner, 0.85)] : [], 0.4)];
};
/** A horn from (x, y), rising `len` and curving back by `bend`, `w` thick at its root. */
const horn = (x: number, y: number, len: number, bend: number, w: number, c: string): Shape[] => part(band([[x, y], [x + bend * 0.05, y - len * 0.5], [x + bend * 0.45, y - len * 0.85], [x + bend, y - len * 0.9]], [w, w * 0.8, w * 0.5, w * 0.12]), c, [], 0.3);

// ---- farm animals ------------------------------------------------------------------------------------

const SOOT = "#2B2523", HORN = "#E8DEC4";
/** The hoofed and clawed animals' numbers (a function of the colour param and a random stream). */
const QUADS: Record<string, (col: string, r: Rng) => Qd> = {
  cow: (col, r) => ({ c: "#F3EFE6", c2: "#F4D3CB", c3: "#3A332F", bl: 148, H: 128, D: 70, lw: 12.5, hk: 0.5, nk: [30, 8, 48, 32, 0.04], hd: [15.5, 32, 11.5, 0.95], tl: ["h", 104, 5.5],
    pat: () => [[blob(r, -40, -100, 22, col), blob(r, 8, -106, 17, col), blob(r, -10, -80, 16, col), blob(r, 44, -92, 13, col)], [blob(r, 56, -110, 13, col)]],
    hx: (hr, hs, ht) => [...leaf(-hr * 0.4, -hr * 0.3, 2.7, 15, 7, "#F3EFE6", "#F4D3CB"), ...horn(-hr * 0.1, -hr * 0.8, 10, -3, 3.8, HORN), F(ellipse(hr * 0.1, -hr * 0.35, hr * 0.7, hr * 0.5), col, 0.9)],
    x: () => [...part(smooth([[-34, -60], [-14, -60], [-12, -52], [-20, -47], [-32, -50]]), "#F4D3CB", [], 0.5), ...[0, 1, 2, 3].map(i => F(ellipse(-29 + i * 4.8, -45.4, 1.2, 1.7), "#E8A9B5"))] }),
  sheep: col => ({ c: col, c2: col, c3: col, pc: SOOT, hc: "#4A3E36", lg: "#3A302A", bl: 62, H: 72, D: 40, lw: 3.4, wool: true, hk: 0.5, nk: [16, -2, 26, 14, 0.05], hd: [7, 16, 4.6, 0.55], tl: ["h", 12, 6], nc: col,
    hx: hr => [...leaf(-hr * 0.2, -hr * 0.35, 2.7, 11, 5.4, "#4A3E36", "#7A6A5C"), ...part(smooth([[-hr * 0.5, -hr * 0.7], [0, -hr * 1.5], [hr * 0.8, -hr * 0.95], [hr * 0.5, -hr * 0.3]]), col, [], 0.3)] }),
  lamb: col => ({ c: col, c2: col, c3: col, pc: SOOT, hc: "#5E5046", lg: "#4A3E36", bl: 36, H: 46, D: 25, lw: 3, wool: true, hk: 0.5, nk: [10, -1, 16, 10, 0.05], hd: [5.4, 12, 3.6, 0.55], tl: ["h", 8, 4], nc: col,
    hx: hr => [...leaf(-hr * 0.2, -hr * 0.3, 2.7, 9, 4.4, "#5E5046", "#9A8A7C"), ...part(smooth([[-hr * 0.5, -hr * 0.7], [0, -hr * 1.4], [hr * 0.8, -hr * 0.95], [hr * 0.5, -hr * 0.3]]), col, [], 0.2)] }),
  goat: col => ({ c: col, c2: "#EFE6D3", c3: "#3A2E26", bel: "#EFE6D3", hk: 0.6, bl: 70, H: 72, D: 38, lw: 5.8, nk: [16, -13, 21, 11, 0.12], hd: [7.4, 18, 4.6, 0.45], tl: ["u", 12, 4],
    hx: (hr, hs, ht) => [...horn(-hr * 0.2, -hr * 0.75, 20, -15, 3, "#CFC3A8"), ...leaf(-hr * 0.3, -hr * 0.2, 2.6, 10, 4.6, col), ...part(band([[hs * 0.72, ht * 0.8], [hs * 0.66, ht * 2.4], [hs * 0.7, ht * 3.2]], [3, 2.2, 0.6]), "#EFE6D3", [], 0.3)] }),
  kid: col => ({ c: col, c2: "#EFE6D3", c3: "#3A2E26", bel: "#EFE6D3", hk: 0.6, bl: 36, H: 42, D: 22, lw: 3.3, nk: [9, -7, 10, 6.5, 0.1], hd: [5.2, 11, 3.4, 0.45], tl: ["u", 6, 2.6],
    hx: hr => [...part(ellipse(-hr * 0.2, -hr * 0.8, 1.1, 1.3), "#7A6A52", [], 0.2), ...leaf(-hr * 0.3, -hr * 0.2, 2.5, 7.6, 4.2, col, "#E6B8A8")] }),
  horse: col => ({ c: col, c2: col, c3: "#2B1E19", bl: 150, H: 152, D: 68, lw: 12.5, rd: 4, hk: 0.7, nk: [42, -50, 42, 22, 0.14], hd: [12.5, 44, 7.8, 0.4], tl: ["f", 92, 13],
    xb: m => part(band([m.nk(0.9, 0.5), m.nk(0.6, 0.5), m.nk(0.3, 0.5), m.nk(0.02, 0.4)], [5, 8, 9, 6]), "#2B1E19", [], 0.5),
    hx: (hr, hs, ht) => [...leaf(-hr * 0.5, -hr * 0.7, -2.1, 13, 5.8, col), F(smooth([[hr * 0.3, -hr * 0.8], [hs * 0.9, -ht * 0.5], [hs * 0.96, ht * 0.1], [hs * 0.6, -ht * 0.55]]), "#F4EFE6", 0.85), F(smooth([[-hr * 0.4, -hr * 0.95], [hr * 0.6, -hr * 1.05], [hr * 0.9, -hr * 0.3], [-hr * 0.1, -hr * 0.6]]), "#2B1E19", 0.95)] }),
  donkey: col => ({ c: col, c2: "#D9D0C4", c3: "#2E2926", bel: "#D9D0C4", hk: 0.6, bl: 100, H: 112, D: 48, lw: 8.5, nk: [24, -22, 28, 18, 0.1], hd: [10, 30, 7, 0.35], tl: ["h", 62, 4],
    xb: m => part(band([m.nk(0.9, 0.4), m.nk(0.5, 0.4), m.nk(0.05, 0.3)], [3, 4, 3]), "#2E2926", [], 0.3),
    pat: () => [[F(smooth([[-50, -112], [50, -110], [50, -107], [-50, -109.5]]), "#4A423D", 0.9), F(smooth([[22, -112], [28, -108], [25, -78], [20, -82]]), "#4A423D", 0.7)], []],
    hx: (hr, hs, ht) => [...leaf(-hr * 0.4, -hr * 0.6, -2.2, 26, 8, col, "#CBBFB2")] }),
  camel: col => ({ c: col, c2: "#E0C79A", c3: "#8A6A3C", bel: "#E0C79A", hk: 0.7, ft: "foot", bl: 190, H: 172, D: 72, lw: 12.5, hm: 40, nk: [74, -64, 40, 21, -0.22], hd: [14.5, 42, 9.6, 0.58], tl: ["h", 70, 4.4],
    hx: (hr, hs, ht) => [...leaf(-hr * 0.2, -hr * 0.6, -2.0, 7, 4, col), R([[hs * 0.99, -ht * 0.1], [hs * 0.97, ht * 0.5]], "#2A1F1C", 0.4, { flat: true, opacity: 0.7 })] }),
};
const FARM = ["cow", "sheep", "lamb", "goat", "kid", "horse", "donkey", "hen", "rooster", "duck", "camel"];

/** A bird of the table with its body colour changed to `col` (a hen's or a duck's whole body, a rooster's coat). */
const tinted = (b: Bd, col: string, head = false): Bd => col ? { ...b, c: [col, tone(col, "light"), tone(col, "shade"), head ? col : b.c[3], ...b.c.slice(4)] } : b;
/** A farm animal's shapes, facing right; `col` its colour param (empty: its own). */
function farmShapes(k: string, col: string, r: Rng): Shape[] {
  if (k === "hen") return [...bird(tinted(BIRDS.hen, col, true)), ...chick(27, 1.1), ...chick(36, 0.9, true), ...chick(-27, 0.8)];
  if (k === "rooster") return bird(tinted(BIRDS.rooster, col));
  if (k === "duck") return bird(tinted(BIRDS.duck, col));
  return quad(QUADS[k](hex(col, k === "cow" ? "#2B2B2E" : k === "sheep" || k === "lamb" ? "#F1ECDD" : k === "goat" || k === "kid" ? "#C7AE86" : k === "horse" ? "#8A4B2A" : k === "donkey" ? "#8B8079" : "#C9A26B"), r));
}
/** Farm animals side on, at their real size, facing `dir`: a cow (inek), sheep (koyun), lamb (kuzu), goat (keçi), kid (oğlak), horse, donkey, hen with her chicks (tavuk), rooster, duck (ördek) or camel (deve). `color` is the coat (a cow's patches, a sheep's wool). Held, a big animal is a toy-sized one, a lamb or a hen is cradled. */
const farm: PieceDef = { draw: (p, r) => herd(p, "farm_animal", () => farmShapes(pickOf(p.kind, FARM, "cow"), hex(p.color, ""), r), 8, 44, 0.45, 1.06),
  variants: Object.fromEntries(FARM.map(k => [k, { kind: k }])),
  meta: {
    about: "A farm animal side on at its real size: a cow, sheep, lamb, goat, kid, horse, donkey, a hen with chicks, a rooster, a duck or a camel; facing left or right.",
    params: {
      kind: { type: "enum", values: FARM, default: "cow" },
      color: { type: "color", about: "its coat: a cow's patches, a sheep's wool, a goat's, horse's, donkey's or camel's coat, a bird's body; each kind has its own default" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 8, default: 1, about: "animals side by side" },
    },
    terms: ["a1-w-inek", "a2-w-koyun", "a2-w-kuzu", "b1-w-keci", "b1-w-oglak", "a1-w-tavuk", "a1-w-ordek", "a2-w-deve", "a1-w-ciftlik"],
    tags: ["animal", "farm"],
  } };

// ---- small life --------------------------------------------------------------------------------------

const INK = "#2B2420";
/** The shapes and the same mirrored about x = 0. */
const sym = (sh: Shape[]): Shape[] => [...sh, ...T(sh, [-1, 0, 0, 1, 0, 0])];
/** A butterfly seen from the front, wings spread, 8 cm across, in `c`. */
function butterfly(c: string): Shape[] {
  const up = smooth([[0.5, -2.6, 0], [1.5, -4.6], [3.9, -5.8], [4.7, -4.3], [4.2, -2.4], [2.2, -1.7, 0]]), lo = smooth([[0.5, -1.9, 0], [2.6, -2], [3.6, -0.9], [2.5, 0.3], [0.9, 0.1, 0]]);
  const wing = (q: Path, dots: [number, number][]): Shape[] => [S(q, c), { path: q, stroke: { color: INK, width: 0.7 }, flat: true, clip: q }, ...[0.3, 0.55, 0.8].map(k => L([[0.6, -2.2], [0.6 + (q === up ? 3.9 : 2.7) * k, q === up ? -2.2 - 3 * k : -0.6 + k]], INK, 0.2, 0.7)), ...dots.map(([x, y]) => F(ellipse(x, y, 0.28), "#FFFFFF", 0.9))];
  return [...sym(wing(lo, [[2.6, -0.2], [1.6, 0], [3.1, -1.1]])), ...sym(wing(up, [[4.3, -3.6], [3.8, -5.1], [4.5, -4.6], [2.2, -2]])), S(ellipse(0, -1.9, 0.4, 1.7), INK), S(ellipse(0, -3.8, 0.48), INK), ...sym([R([[0.1, -4.1], [0.8, -5.3], [1.4, -5.7]], INK, 0.14, { flat: true })])];
}
/** A bee in profile, 2 cm long. */
const bee = (): Shape[] => [...[0, 1].map(i => S(ellipse(0.1 + i * 0.4, -1.5, 0.9, 0.38).transform(mul(translate(0, 0), rotate(-0.5 + i * 0.35))), "#EAF3F8", { opacity: 0.65 })), ...[-0.2, 0.3, 0.8].map(x => R([[x, -0.5], [x + 0.2, 0]], INK, 0.12)),
  ...part(ellipse(-0.45, -0.85, 0.85, 0.52), "#F2C230", [-0.1, -0.5, -0.9].map(x => F(rect(x - 0.1, -1.6, 0.18, 1.5), INK, 0.85)), 0.15), ...part(ellipse(0.62, -0.95, 0.5, 0.46), "#D9A23A", [], 0.12), ...part(ellipse(1.18, -0.9, 0.34), INK, [], 0.1), R([[1.35, -1.15], [1.7, -1.6]], INK, 0.1), P([[-1.3, -0.85, 0], [-1.7, -0.8, 0], [-1.3, -0.75, 0]], INK), ...eye(1.28, -0.95, 0.12, false, "#FFFFFF")];
/** A snail, 12 cm long, its shell `c`. */
function snail(c: string): Shape[] {
  const sp = Array.from({ length: 16 }, (_, i): Vec2 => { const a = i * 0.8, r = 0.5 + i * 0.19; return [-1 + Math.cos(a) * r, -4 + Math.sin(a) * r]; });
  return [...part(band([[-7, -0.6], [-2, -0.9], [3, -1], [6.4, -1.4]], [0.8, 2.2, 2.2, 1.8]), "#CDBB90", [], 0.3), ...part(band([[3.4, -1.6], [5.6, -2.8], [6.6, -5]], [2.6, 2.1, 1.8]), "#CDBB90", [], 0.3), ...[0, 1].map(i => R([[6.4 + i * 0.7, -5.6], [7 + i * 1.6, -8.2 + i * 0.6]], "#B9A87A", 0.3)), ...[0, 1].map(i => S(ellipse(7 + i * 1.6, -8.4 + i * 0.6, 0.4), INK, { flat: true })),
    ...part(ellipse(-1, -4, 3.9, 3.7), c, [{ path: smooth(sp, false, 1), stroke: { color: tone(c, "deep"), width: 0.4 }, flat: true, opacity: 0.8 }], 0.4)];
}
/** A line of `n` ants walking right, each 1 cm. */
function ants(n: number, c: string): Shape[] {
  return Array.from({ length: n }, (_, i) => { const x = i * 2, ph = i % 2 ? 1 : -1;
    return [...[-0.2, 0.05, 0.3].map((k, j) => R([[x + k, -0.45], [x + k + 0.25 * ph * (j - 1), 0]], c, 0.07)), S(ellipse(x - 0.55, -0.55, 0.4, 0.3), c), S(ellipse(x, -0.6, 0.2, 0.18), c), S(ellipse(x + 0.32, -0.64, 0.22, 0.2), c), R([[x + 0.45, -0.75], [x + 0.75, -1]], c, 0.05)]; }).flat();
}
/** A ladybird from above, 1 cm. */
const ladybird = (c: string): Shape[] => [...[-1, 0, 1].flatMap(i => sym([R([[0.35, -0.3 - i * 0.22], [0.75, -0.2 - i * 0.3 + (i === 0 ? 0 : 0)], [0.8, -0.05 - i * 0.2]], INK, 0.07)])), ...sym([R([[0.1, -1.2], [0.3, -1.5]], INK, 0.05)]),
  S(ellipse(0, -0.55, 0.5, 0.56), c), L([[0, -1.1], [0, -0.02]], INK, 0.07, 0.8), ...[[-0.25, -0.35], [0.25, -0.35], [-0.27, -0.75], [0.27, -0.75], [-0.38, -0.55], [0.38, -0.55]].map(([x, y]) => F(ellipse(x, y, 0.1), INK)), S(ellipse(0, -1.12, 0.25, 0.17), INK), F(ellipse(-0.12, -1.18, 0.06), "#FFFFFF"), F(ellipse(0.12, -1.18, 0.06), "#FFFFFF")];
/** A squirrel sitting up with an acorn, 22 cm tall, its tail curling over. */
function squirrel(c: string): Shape[] {
  const lt = "#EFE0C8";
  return [...part(band([[-3, -4], [-10, -7], [-14, -17], [-10, -29], [-3, -33]], [5, 10, 14, 12, 7]), c, [L([[-9, -9], [-12.4, -18], [-9, -28]], tone(c, "light"), 1, 0.5)], 0.5), ...part(ellipse(3, -1.2, 5.6, 2), c, [], 0.3),
    ...part(smooth([[-4, -1], [-6, -8], [-4, -15], [0, -18], [5, -15], [6.4, -8], [4, -1]]), c, [F(ellipse(3.6, -9, 3, 7), lt, 0.9)], 0.5), ...part(ellipse(3.8, -20, 4.2, 3.7), c, [F(ellipse(6.4, -19, 2.4, 1.6), lt, 0.8)], 0.4),
    ...part(smooth([[1.4, -22.6, 0], [0.8, -27, 0], [3.4, -24]]), c, [], 0.2), F(ellipse(7.8, -20.2, 0.6, 0.5), INK), ...eye(5.6, -21, 0.7, false, "#1C1816"),
    ...part(band([[4, -14], [6.6, -11.6], [8, -12.4]], [2.6, 2.2, 1.8]), tone(c, "light"), [], 0.2), ...part(ellipse(8.8, -11.4, 1.8, 2.2), "#9A6B3A", [F(ellipse(8.8, -13, 2, 1), "#6A4A2A")], 0.2)];
}
/** A hedgehog, 22 cm long, spines swept back. */
function hedgehog(c: string): Shape[] {
  const dome = smooth(Array.from({ length: 29 }, (_, i): [number, number, number] | Vec2 => { const a = Math.PI * 1.04 + i / 28 * Math.PI * 0.96, k = i % 2 ? 1.16 : 1; return i % 2 ? [-1 + Math.cos(a) * 10.5 * k, -1.4 + Math.sin(a) * 9 * k] : [-1 + Math.cos(a) * 10.5 * k, -1.4 + Math.sin(a) * 9 * k, 0]; }));
  return [...part(ellipse(-5, -1, 2.6, 1.2), "#C9B48A", [], 0.2), ...part(dome, c, [...Array.from({ length: 12 }, (_, i) => L([[-9 + i * 1.6, -2], [-10 + i * 1.5, -11 + Math.sin(i * 0.8) * 3]], tone(c, "light"), 0.5, 0.45))], 0.6),
    ...part(smooth([[6, -6.4], [9.6, -5.2], [13.6, -2.6, 0], [11.6, -0.8], [6, -0.8]]), "#E0CFB5", [], 0.4), S(ellipse(13.6, -2.7, 0.8, 0.7), INK), ...eye(9.2, -4, 0.7, false, "#1C1816"), ...part(ellipse(6, -1, 2.4, 1.2), "#C9B48A", [], 0.2)];
}
/** A frog sitting, 9 cm long, in `c`. */
function frog(c: string): Shape[] {
  return [...part(band([[6, -3.6], [6.6, -1.8], [8.6, -0.5]], [2, 1.5, 1.2]), c, [], 0.2),
    ...part(smooth([[-6, -1.2], [-6.8, -4.2], [-4, -6.6], [1, -7.2], [5, -7.4], [8.4, -5.6], [9.6, -3.8], [8.8, -1.8, 0], [4, -0.5, 0], [-3, -0.5, 0]]), c, [F(ellipse(3.6, -1.4, 4.4, 1.6), tone(c, "light"), 0.8), ...[[-2, -5.6], [1, -6.4], [-4.4, -3.8]].map(([x, y]) => F(ellipse(x, y, 0.7, 0.55), tone(c, "deep"), 0.6))], 0.4),
    ...part(band([[-4.6, -1.3], [-1.6, -0.9], [1.8, -0.6]], [1.5, 1.3, 1]), c, [], 0.2), ...part(band([[2.4, -3.6], [-1, -2.6], [-4.6, -1.5]], [2.8, 2.2, 1.6]), c, [], 0.3), ...part(ellipse(-3.2, -3.5, 2.8, 2.2), c, [], 0.4),
    ...part(ellipse(5.4, -7.5, 1.55), "#E8D46A", [], 0.2), ...eye(5.7, -7.7, 0.95, false, "#1C1816"), L([[9.4, -3.9], [4, -3.7]], tone(c, "deep"), 0.25, 0.8)];
}
/** A lizard on all fours, 43 cm long with its tail (drawn at 0.62), in `c`. */
function lizard(c: string): Shape[] {
  const leg = (x: number, near: boolean, dx: number): Shape[] => [R([[x, -2.8], [x + dx, -1.6], [x + dx + 1.6, -0.3]], near ? c : tone(c, "shade"), 1.1), R([[x + dx + 0.6, -0.4], [x + dx + 2.4, -0.3]], near ? c : tone(c, "shade"), 0.6)];
  return [...leg(-8.4, false, -1.2), ...leg(5.6, false, 1), ...part(band([[-24, -0.9], [-17, -1.4], [-10, -2.6], [-3, -3.4], [4, -3.8], [10, -4.4], [14, -5.2]], [0.3, 1, 2.2, 3.8, 4.4, 3.6, 2.8]), c, [F(band([[-12, -2.4], [-3, -2.2], [8, -2.6]], [1, 1.2, 1]), "#E0DDB0", 0.7), ...[-8, -3, 3, 8].map(x => F(ellipse(x, -4.6, 0.8, 0.6), tone(c, "deep"), 0.6))], 0.4),
    ...part(smooth([[13, -6.4], [17, -5.2], [19.4, -4.2, 0], [17, -3.2], [13, -3.2]]), c, [], 0.3), ...eye(15.8, -5, 0.5, false, "#1C1816"), ...leg(-9.2, true, 1), ...leg(5.2, true, -1.2)];
}
const FOX = (): Qd => ({ c: "#D9742E", c2: "#F4EBDD", c3: "#F6EFE2", pc: "#2B2523", lm: x => [F(rect(x - 9, -13, 18, 13), "#2B2523")], bel: "#F4EBDD", ft: "paw", bl: 52, H: 36, D: 17, lw: 3.6, nk: [12, -5, 13, 8, 0.1], hd: [6, 15, 3.8, 0.25], tl: ["b", 38, 9],
  hx: hr => [...part(smooth([[-hr * 0.5, -hr * 0.6], [-hr * 0.4, -hr * 2], [hr * 0.5, -hr * 0.9]]), "#D9742E", [F(smooth([[-hr * 0.4, -hr * 0.75], [-hr * 0.35, -hr * 1.6], [hr * 0.25, -hr * 0.95]]), "#2B2523", 0.9)], 0.3)] });
const SMALL = ["butterfly", "bee", "snail", "ants", "ladybird", "squirrel", "hedgehog", "frog", "lizard", "fox"], SMALL_COLOR: Record<string, string> = { butterfly: "#E8832E", snail: "#B8844A", ants: INK, ladybird: "#D9342B", squirrel: "#B5683A", hedgehog: "#8B7355", frog: "#5E9A3E", lizard: "#7FA050" };
/** Small animals at their real size, side on (the butterfly and ladybird face us): a butterfly, bee, snail (salyangoz), a line of ants (karınca, at least five), ladybird, squirrel, hedgehog, frog, lizard or fox (tilki). Held, the small ones sit on the palm. */
const small: PieceDef = { draw: p => {
  const k = pickOf(p.kind, SMALL, "butterfly"), c = hex(p.color, SMALL_COLOR[k] ?? "#888888"), n = cnt(p.n, 1, 24);
  const sz = (sh: Shape[], k: number) => T(sh, [k, 0, 0, k, 0, 0]);
  const make = (): Shape[] => k === "butterfly" ? sz(butterfly(c), 0.85) : k === "bee" ? sz(bee(), 0.6) : k === "snail" ? sz(snail(c), 0.62) : k === "ants" ? sz(ants(Math.max(5, n), c), 0.8) : k === "ladybird" ? ladybird(c) : k === "squirrel" ? squirrel(c) : k === "hedgehog" ? hedgehog(c) : k === "frog" ? sz(frog(c), 0.78) : k === "lizard" ? sz(lizard(c), 0.62) : quad(FOX());
  return herd(k === "ants" ? { ...p, n: 1 } : p, "small_life", make, 24, 34, k === "squirrel" || k === "fox" ? 0.4 : 0.15, 1.15);
}, variants: Object.fromEntries(SMALL.map(k => [k, { kind: k }])),
  meta: {
    about: "A small animal at its real size: a butterfly, bee, snail (salyangoz), a line of ants (karınca), ladybird, squirrel, hedgehog, frog, lizard or fox (tilki).",
    params: {
      kind: { type: "enum", values: SMALL, default: "butterfly" },
      color: { type: "color", about: "the butterfly's wings, the snail's shell, the ants, the ladybird's wing cases, the squirrel's, hedgehog's, frog's or lizard's coat; each has its own default" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 24, default: 1, about: "animals side by side; for the ants, the length of the line (at least 5)" },
    },
    terms: ["a2-w-salyangoz", "a2-w-karinca", "a2-w-tilki"],
    tags: ["animal", "insect"],
  } };

// ---- zoo animals -------------------------------------------------------------------------------------

/** Spots on a jittered grid, `rad` big, coloured `col` (a giraffe's coat). */
const grid = (r: Rng, x0: number, x1: number, y0: number, y1: number, sx: number, sy: number, rad: number, col: string): Shape[] => {
  const out: Shape[] = [];
  for (let y = y0; y <= y1; y += sy) for (let x = x0 + ((y - y0) / sy % 2) * sx / 2; x <= x1; x += sx) out.push(blob(r, x + r.range(-3, 3), y + r.range(-3, 3), rad * r.range(0.8, 1.15), col));
  return out;
};
/** A sitting monkey facing right, 55 cm tall: coat `c`, a pale face, hands and feet, a long tail curling up behind. */
function monkey(c: string): Shape[] {
  const pale = "#D9B79A", dk = mix(c, "#2A1D14", 0.45), arm = (x: number, y: number, col: string) => [...part(band([[x, y], [x + 4, y + 12], [x + 9, y + 21]], [6, 4.6, 3.6]), col, [], 0.4), ...part(ellipse(x + 10, y + 22.4, 3, 2.2), pale, [], 0.3)];
  return [...part(band([[-9, -4], [-24, -4.6], [-29, -18], [-22, -32], [-15, -33]], [4.4, 3.8, 3.6, 3.2, 2.4]), c, [], 0.5),
    ...arm(5, -33, dk), ...part(ellipse(4, -7, 9, 6.6), dk, [], 0.5), ...part(ellipse(13, -2.2, 6, 2.2), pale, [], 0.3),
    ...part(smooth([[-10, -5], [-13, -18], [-8, -32], [0, -39], [8, -35], [10, -23], [8, -8], [3, -1], [-6, -1]]), c, [F(ellipse(5.4, -20, 4.6, 12), mix(pale, c, 0.5), 0.9)], 0.7),
    ...part(ellipse(4, -9, 9.4, 7), c, [], 0.5), ...part(ellipse(14, -2.4, 6.4, 2.4), pale, [], 0.3), ...arm(6, -35, c),
    ...part(ellipse(4.4, -47, 8.4, 8), c, [F(ellipse(6, -53, 7, 3.4), dk, 0.8)], 0.6), ...part(ellipse(-2.4, -46.4, 2.6, 3.4), pale, [], 0.3),
    ...part(smooth([[5, -51], [10, -52], [15.6, -47.4], [16.2, -43.4], [12, -40.6], [6, -41.6]]), pale, [], 0.4), ...eye(9.6, -47.4, 0.9, false, "#2A1D14"), F(ellipse(15, -46.4, 0.4), "#7A5A4A"), R([[15.4, -42.6], [11.4, -42.2]], "#7A5A4A", 0.3, { flat: true })];
}
const ZQ: Record<string, (col: string, r: Rng) => Qd> = {
  giraffe: (col, r) => ({ c: "#E0B050", c2: "#E0B050", c3: "#3A2A1C", bl: 125, H: 290, D: 86, lw: 11.5, rd: 26, wh: 14, hk: 0.5, nk: [64, -200, 46, 22, 0], hd: [9, 24, 5.4, 0.3], tl: ["h", 120, 3.4],
    pat: () => [grid(r, -62, 62, -282, -214, 24, 22, 11, col), [0.1, 0.28, 0.46, 0.64, 0.82].map(t => blob(r, 47 + 80 * t + r.range(-6, 6), -264 - 226 * t + r.range(-6, 6), 10 - t * 3, col))],
    xb: m => part(band([m.nk(0.95, 0.5), m.nk(0.6, 0.5), m.nk(0.25, 0.5)], [3, 4, 4]), "#7A4A22", [], 0.3),
    hx: (hr, hs, ht) => [...part(band([[-hr * 0.1, -hr * 0.8], [-hr * 0.25, -hr * 2.2]], [2.4, 2]), "#E0B050", [], 0.2), ...part(ellipse(-hr * 0.26, -hr * 2.4, 2.2, 1.8), "#3A2A1C", [], 0.2), ...leaf(-hr * 0.5, -hr * 0.3, -2.6, 12, 5, "#E0B050", "#B8845A"), F(ellipse(hs * 0.5, 0, hs * 0.5, ht * 0.8), "#C99A4A", 0.4)] }),
  elephant: col => ({ c: col, c2: col, c3: tone(col, "shade"), bl: 230, H: 238, D: 128, lw: 38, hk: 0.2, ft: "foot", nohead: true, nk: [40, 4, 100, 106, 0], hd: [10, 28, 6, 0], tl: ["h", 150, 6],
    xb: m => { const h = m.hp(0, 0); return [...part(ellipse(h[0], h[1], 54, 52), col, [], 1), ...part(ellipse(h[0] - 6, h[1] - 40, 30, 22), col, [], 0.8)]; },
    x: m => [...part(band([m.hp(32, 16), m.hp(54, 72), m.hp(50, 140), m.hp(64, 190)], [36, 28, 22, 15]), col, [0, 1, 2, 3, 4, 5].map(i => L([m.hp(34 + i * 2.6, 40 + i * 24), m.hp(60 + i * 1.4, 40 + i * 24 + 3)], tone(col, "deep"), 1.2, 0.5)), 1.4),
      ...part(band([m.hp(30, 34), m.hp(58, 68), m.hp(88, 62)], [10, 6.4, 1.6]), "#F1E9D6", [], 0.8), ...part(ellipse(m.hp(-22, -2)[0], m.hp(-22, -2)[1], 34, 50), tone(col, "shade"), [F(ellipse(m.hp(-30, 4)[0], m.hp(-30, 4)[1], 22, 38), "#B49A9A", 0.7)], 1.2), ...eye(m.hp(22, -16)[0], m.hp(22, -16)[1], 3, false, "#1C1816")] }),
  lion: col => ({ c: col, c2: "#E5C791", c3: "#4A2E16", bel: "#E5C791", bl: 122, H: 98, D: 48, lw: 12, hk: 0.8, ft: "paw", nk: [26, 6, 42, 34, 0], hd: [13, 17, 9.4, 0.3], tl: ["h", 92, 5.4],
    xb: m => [...part(ellipse(m.hp(-6, 6)[0], m.hp(-6, 6)[1], 31, 34), "#7A4A25", [F(ellipse(m.hp(-14, 10)[0], m.hp(-14, 10)[1], 20, 24), "#5E3818", 0.5)], 1), ...part(ellipse(m.hp(-10, 34)[0], m.hp(-10, 34)[1], 22, 17), "#7A4A25", [], 0.8)],
    hx: hr => [...part(ellipse(-hr * 0.1, -hr * 0.95, 4.2, 4.4), col, [F(ellipse(-hr * 0.1, -hr * 0.9, 2.2, 2.4), "#E5C791", 0.9)], 0.3), F(smooth([[hr * 1.2, -hr * 0.4], [hr * 1.7, -hr * 0.3], [hr * 1.5, hr * 0.1]]), "#5A3A2A")] }),
  zebra: col => ({ c: "#F3F0E8", c2: "#4A403A", c3: "#1E1E22", bl: 138, H: 132, D: 62, lw: 10, rd: 3, hk: 0.7, nk: [32, -38, 30, 18, 0.1], hd: [10, 32, 6.8, 0.4], tl: ["f", 72, 6.5],
    xb: m => part(band([m.nk(0.95, 0.5), m.nk(0.6, 0.5), m.nk(0.2, 0.5)], [4, 5, 5]), "#1E1E22", [], 0.3),
    pat: () => [Array.from({ length: 16 }, (_, i) => R([[-64 + i * 8.6, -132 - 8], [-60 + i * 8.6, -132 + 28], [-64 + i * 8.6, -132 + 70]], "#1E1E22", 3.6, { flat: true })),
      Array.from({ length: 10 }, (_, i) => R([[35 + 5.4 * i, -128 - 6.4 * i], [69 + 5.4 * i, -99 - 6.4 * i]], "#1E1E22", 3.4, { flat: true }))],
    lm: x => Array.from({ length: 8 }, (_, i) => R([[x - 16, -66 + i * 8.2], [x + 16, -64.4 + i * 8.2]], "#1E1E22", 3, { flat: true })),
    hx: (hr, hs, ht) => [...leaf(-hr * 0.5, -hr * 0.7, -2.1, 11, 6, "#F3F0E8", "#1E1E22"), ...[0, 1, 2, 3].map(i => R([[hr * 0.1 + i * 6, -hr * 0.9], [hr * 0.3 + i * 6, hr * 0.5]], "#1E1E22", 2.4, { flat: true }))] }),
  bear: col => ({ c: col, c2: tone(col, "light"), c3: "#2C2018", bl: 138, H: 118, D: 74, lw: 25, wh: 16, hk: 0.4, ft: "paw", nk: [22, 8, 64, 44, 0], hd: [17, 22, 11, 0.5], tl: ["u", 9, 6],
    hx: hr => [...part(ellipse(-hr * 0.1, -hr * 0.95, 5.4), col, [F(ellipse(-hr * 0.1, -hr * 0.9, 2.8), "#3A281C", 0.7)], 0.4)] }),
};
const ZOO = ["giraffe", "elephant", "lion", "monkey", "penguin", "zebra", "bear"];
/** Zoo animals side on at their real size, facing `dir`: a giraffe (zürafa, 5 m: drawn at a low resolution), elephant, lion, monkey, penguin, zebra or brown bear. `color` is the coat. */
const zoo: PieceDef = { draw: (p, r) => herd(p, "zoo_animal", () => {
  const k = pickOf(p.kind, ZOO, "giraffe"), col = hex(p.color, "");
  if (k === "monkey") return monkey(hex(p.color, "#7B5A3A"));
  if (k === "penguin") return bird(tinted(BIRDS.penguin, col));
  return quad(ZQ[k](hex(col, k === "giraffe" ? "#8A5524" : k === "elephant" ? "#8F949B" : k === "lion" ? "#C99A55" : k === "bear" ? "#6A4A32" : "#F3F0E8"), r));
}, 4, 44, 0.45, 1.06),
  variants: Object.fromEntries(ZOO.map(k => [k, { kind: k }])),
  meta: {
    about: "A zoo animal side on at its real size: a giraffe, elephant, lion with a mane, sitting monkey, penguin, zebra or brown bear.",
    params: {
      kind: { type: "enum", values: ZOO, default: "giraffe" },
      color: { type: "color", about: "its coat: a giraffe's patches, an elephant's skin, a lion's, a monkey's or a bear's fur; a penguin's back; each kind has its own default" },
      dir: { type: "num", min: -1, max: 1, default: 1, about: "below 0 faces left" },
      n: { type: "int", min: 1, max: 4, default: 1, about: "animals side by side" },
    },
    terms: ["a1-w-zurafa", "a1-w-hayvanat-bahcesi"],
    tags: ["animal", "zoo"],
  } };

export const set: Record<string, PieceDef> = { dog };
export const props: Record<string, PieceDef> = { dog, wild_bird: wildBird, pet, farm_animal: farm, small_life: small, zoo_animal: zoo };
