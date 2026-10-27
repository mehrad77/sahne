// Props of the cookware family (STYLE.md): pots and pans, cutlery beyond the teaspoon and knife, cups, bottles, condiments, small kitchen machines and stoves. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip (the fist covers about 8 cm above it: a thing that sits on the hand is lifted clear, a thing that hangs hangs below).
// Words are `text` on the first flat, never letters in the art. Every generator is a table of kinds: `Kind.f` draws one, `gen` lays out `n` of them.

import { apply, band, ellipse, groupBounds, mix, mul, poly, rect, rotate, rrect, scale, smooth, tone, translate, type Affine, type EmitSpec, type FlatSpec, type Path, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, L, num, str, hex, holed, type Pt } from "./draw.ts";

const ID: Affine = [1, 0, 0, 1, 0, 0], WHITE = "#FFFFFF", GLASS = "#DCEBEE", STEEL = "#C3C8CE", COPPER = "#C7733B", BLACK = "#2E2F35", WOOD = "#C28E57", CREAM = "#F6F0E2", INK = "#2B2420", PI = Math.PI;
type Prm = Record<string, unknown>;
type Em = [EmitSpec["kind"], number, number, number?];
/** One thing drawn: its shapes, its footprint width, its held transform, light, particles from (x, y) of the art and words. */
interface Art { sh: Shape[]; w: number; fire?: boolean; cx?: number; m?: Affine; glow?: Shape[]; ems?: Em[]; text?: TextSpec[] }
interface Kind { c: string; ppcm: number; f: (c: string, p: Prm, r: Rng) => Art; edge?: number; gap?: number; stack?: number; hs?: number }

// ---- helpers --------------------------------------------------------------------------------

const A = (sh: Shape[], w: number, o: Partial<Art> = {}): Art => ({ sh, w, ...o });
const mv = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({
  ...s, path: s.path.transform(m),
  ...(s.clip ? { clip: (Array.isArray(s.clip) ? s.clip : [s.clip]).map(c => c.transform(m)) } : {}),
}));
const at = (sh: Shape[], x: number, y = 0) => x || y ? mv(sh, translate(x, y)) : sh;
const sym = (pts: Pt[]) => smooth([...pts, ...pts.slice().reverse().map(q => (q.length === 3 ? [-q[0], q[1], 0] : [-q[0], q[1]]) as Pt)], true, 1);
const clipsOf = (s: Shape) => s.clip ? (Array.isArray(s.clip) ? s.clip : [s.clip]) : [];
const strip = (s: Shape, x0: number, w: number, c: string, op: number): Shape => ({ path: s.path, fill: c, flat: true, opacity: op, clip: [...clipsOf(s), rect(x0, -500, w, 1000)] });
const lit = (s: Shape, x0: number, x1: number, k = 1): Shape[] => { const w = x1 - x0; return [strip(s, x0 + w * 0.1, w * 0.12, WHITE, 0.4 * k), strip(s, x0 + w * 0.68, w, tone(s.fill!, "shade"), 0.5 * k)]; };
/** A body of revolution from its right side (bottom to top), lit from the left. */
const lathe = (pts: Pt[], c: string, o: Partial<Shape> = {}, k = 1): Shape[] => { const s = S(sym(pts), c, o), b = s.path.bounds(); return [s, ...lit(s, b[0], b[2], k)]; };
/** A lit copy of any shape. */
const shade = (s: Shape, k = 1): Shape[] => { const b = s.path.bounds(); return lit(s, b[0], b[2], k); };
/** Printed paint (flat), optionally cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a handle, a wire, a rim. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
const many = (pts: Vec2[], f: (x: number, y: number) => Path, c: string, o: Partial<Shape> = {}): Shape[] => {
  if (!pts.length) return [];
  const path = f(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) path.add(f(x, y));
  return [{ path, fill: c, ...o }];
};
const specks = (pts: Vec2[], rx: number, ry: number, c: string, op = 1, clip?: Path) => many(pts, (x, y) => ellipse(x, y, rx, ry), c, { flat: true, opacity: op, ...(clip ? { clip } : {}) });
const lines = (segs: Vec2[][], c: string, w: number, op = 0.7, clip?: Path): Shape[] => {
  if (!segs.length) return [];
  const path = poly(segs[0], false);
  for (const s of segs.slice(1)) path.add(poly(s, false));
  return [{ path, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...(clip ? { clip } : {}) }];
};
const xs = (n: number, step: number) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
/** Half width of a right-side profile at height y. */
const hw = (pts: Pt[], y: number) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (y >= b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] || 1); } return pts[pts.length - 1][0]; };
const cnt = (v: unknown, hi = 24) => Math.max(1, Math.min(hi, Math.round(num(v, 1))));
const txt = (t: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec[] => t.trim() ? [{ text: t, x, y, w, h, font: "print", ...o }] : [];
/** A glass vessel from its right-side profile: the glass, `liquid` to `fill` (0…1) of its inside, glints. */
function vessel(pts: Pt[], liquid: string | null, fill: number, o: { k?: number; base?: number; gap?: number; tint?: string; op?: number } = {}): Shape[] {
  const k = o.k ?? 0.35, base = o.base ?? 0.8, outer = S(sym(pts), o.tint ?? GLASS, { opacity: o.op ?? 0.5 }), b = outer.path.bounds(), sh = [outer];
  if (liquid && fill > 0) {
    const inner = sym(pts.map(q => (q.length === 3 ? [q[0] - k, q[1] === 0 ? -base : q[1], 0] : [q[0] - k, q[1] === 0 ? -base : q[1]]) as Pt));
    const lvl = -base + Math.max(0, Math.min(1, fill)) * (b[1] + base + (o.gap ?? 0.8)), liq = S(inner, liquid, { flat: true, opacity: 0.93, clip: rect(b[0] - 1, lvl, b[2] - b[0] + 2, 80) });
    sh.push(liq, strip(liq, b[0] + (b[2] - b[0]) * 0.12, (b[2] - b[0]) * 0.1, WHITE, 0.3), strip(liq, b[0] + (b[2] - b[0]) * 0.68, 20, tone(liquid, "shade"), 0.45), F(ellipse(0, lvl, Math.max(0.5, hw(pts, lvl) - k - 0.1), 0.3), tone(liquid, "light"), 0.85));
  }
  sh.push(strip(outer, b[0] + (b[2] - b[0]) * 0.08, (b[2] - b[0]) * 0.1, WHITE, 0.45), L([[b[0] + 0.5, b[1] * 0.2 - 0.4], [b[0] + 0.7, b[1] * 0.6]], WHITE, 0.4, 0.8));
  return sh;
}
/** A paper label on a round vessel: a band `w` wide at y…y+h. */
const label = (w: number, y: number, h: number, c = CREAM): Shape[] => { const s = S(rect(-w / 2, y, w, h), c); return [s, F(rect(w * 0.2, y, w, h), tone(c, "shade"), 0.5, s.path)]; };

/** The usual generator of a table of kinds: `n` of them in a row (or a stack), held: the first, upright in the hand. */
function gen(id: string, tab: Record<string, Kind>, def: string): PieceDef["draw"] {
  return (p, r) => {
    const k = tab[str(p.kind, def)] ?? tab[def], held = !!p.held, n = held ? Math.min(cnt(p.n, 6), k.hs ? 6 : 1) : cnt(p.n, 24), c = hex(p.color, k.c);
    const arts = Array.from({ length: n }, () => k.f(c, p, r)), gap = k.gap ?? 2, tot = arts.reduce((s, a) => s + a.w, 0) + gap * (n - 1), put: Art[] = [];
    let x = -tot / 2;
    arts.forEach((a, i) => {
      const dx = held ? (i - (n - 1) / 2) * (k.hs ?? 0) : (k.stack ? r.range(-1, 1) : x + a.w / 2) - (a.cx ?? 0), dy = held || !k.stack ? 0 : -i * k.stack;
      put.push({ ...a, sh: at(a.sh, dx, dy), glow: a.glow && at(a.glow, dx, dy), ems: a.ems?.map(([kk, ex, ey, w]) => [kk, ex + dx, ey + dy, w] as Em), text: a.text?.map(t => ({ ...t, x: t.x + dx, y: t.y + dy })) });
      x += a.w + gap;
    });
    return out(id, put, k.ppcm, k.edge ?? 0.3, p);
  };
}
function out(id: string, arts: Art[], ppcm: number, edge: number, p: Prm, o: Partial<FlatSpec> = {}): PieceOut {
  const m = p.held ? arts[0].m ?? ID : ID, J = (sh: Shape[]) => m === ID ? sh : mv(sh, m), sh = J(arts.flatMap(a => a.sh)), glow = J(arts.flatMap(a => a.glow ?? []));
  const [x0, y0, x1, y1] = groupBounds({ shapes: sh, edge }), text = arts.flatMap(a => a.text ?? []).map(t => ({ ...t, x: t.x + m[4], y: t.y + m[5] }));
  const ems = arts.flatMap(a => a.ems ?? []).map(([kind, x, y, w]) => { const [a, b] = apply(m, x, y); return { kind, x: a, y: -b, w: (w ?? 2) * Math.hypot(m[0], m[1]), ...(kind === "flame" ? { z: 0.5 } : {}) } as EmitSpec; });
  const f: FlatSpec = { group: { shapes: sh, edge }, ppcm: Math.min(ppcm, 1900 / Math.max(1, x1 - x0, y1 - y0)), id, ...(p.held ? {} : { shadow: "drop" as const }), ...(glow.length ? { emissive: { shapes: glow, edge: 0 }, ...(arts.some(a => a.fire) ? { switch: false as const } : {}) } : {}), ...(text.length ? { text } : {}), ...o };
  return ems.length ? { flats: [f], emitters: ems } : { flats: [f] };
}
/** Meta params shared by every generator: the kind, how many, a colour. */
const KIND = (values: string[], about = "which one"): { type: "enum"; values: string[]; default: string; about: string } => ({ type: "enum", values, default: values[0], about });
const N = (max: number, about = "how many, side by side") => ({ type: "int" as const, min: 1, max, default: 1, about });
const COLOR = (about: string) => ({ type: "color" as const, about });
const variants = (ks: string[]) => Object.fromEntries(ks.map(k => [k, { kind: k }]));

// ---- pan: pots, pans and their kin ------------------------------------------------------------

const PAN: Record<string, Kind> = {
  pot: { c: STEEL, ppcm: 8, f: c => {
    const body = lathe([[10.8, 0, 0], [11.8, -1.5], [12, -12.8, 0]], c), ear = (x: number) => S(rrect(x, -11.8, 6, 2.4, 1.2), BLACK);
    return A([ear(11.4), ear(-17.4), ...body, F(rect(-12, -1.8, 24, 1.8), tone(c, "deep"), 0.35, body[0].path), S(rrect(-12.5, -14, 25, 1.6, 0.7), tone(c, "light")),
      ...lathe([[12.7, -14, 0], [12.5, -14.8], [10.4, -17], [5.4, -18.6], [0, -19, 0]], c), S(rrect(-0.8, -21.6, 1.6, 3, 0.4), BLACK), S(ellipse(0, -22, 2.1, 1.5), BLACK), L([[-9, -15.8], [-4, -17.6]], WHITE, 0.5, 0.6)], 35, { m: translate(-14.4, 10.6) });
  } },
  frying_pan: { c: "#3B3D44", ppcm: 8, f: c => {
    const body = P([[-13, -4.6, 0], [13, -4.6, 0], [11.8, -1], [9.4, 0, 0], [-9.4, 0, 0], [-11.8, -1]], c);
    return A([S(band([[11, -4.6], [21, -4.9], [31, -4.5]], [2.4, 1.8, 2.2]), BLACK), body, ...shade(body, 0.45), S(ellipse(0, -4.6, 13, 3.4), tone(c, "light")), S(ellipse(0, -4.4, 11.6, 2.8), tone(c, "deep")), F(ellipse(-3.4, -4.8, 5.5, 1), WHITE, 0.14),
      ...specks([[15, -4.8], [18, -4.9]], 0.5, 0.5, STEEL), F(ellipse(29, -4.6, 0.9, 0.55), "#8A8D93")], 44, { cx: 9, m: translate(-26, 4.6) });
  } },
  cezve: { c: COPPER, ppcm: 12, f: c => {
    const body = lathe([[4.2, 0, 0], [5, -1.8], [4.5, -5.6], [3.2, -9.2], [3.6, -10.6, 0]], c);
    return A([R([[3.8, -8], [8, -8.8], [12, -9.6]], tone(c, "shade"), 0.9), R([[11, -9.4], [21, -11.2]], "#6B4A35", 2), P([[-3.6, -10.6, 0], [-6.2, -12.2], [-5.2, -10], [-3.4, -8.4, 0]], c), ...body,
      S(ellipse(0, -10.6, 3.7, 0.65), "#D6D2C8"), S(ellipse(0, -10.5, 3.1, 0.42), "#5B4636"), L([[-4.8, -5.2], [0, -4.7], [4.8, -5.2]], tone(c, "deep"), 0.5, 0.6)], 27, { cx: 7.4, m: translate(-16, 10.3) });
  } },
  baking_tray: { c: "#868C94", ppcm: 7, f: c => {
    const rim = S(rrect(-19, -8, 38, 6.4, 1.4), tone(c, "light"));
    return A([S(rrect(-22, -6.6, 44, 1.7, 0.8), tone(c, "shade")), S(rrect(-19, -2.8, 38, 2.8, [0, 0, 1.2, 1.2]), tone(c, "shade")), rim, S(rrect(-17.4, -7, 34.8, 3.9, 0.9), c), F(rect(-17.4, -7, 34.8, 1.1), tone(c, "deep"), 0.45), F(rect(11, -7, 7, 4), tone(c, "shade"), 0.35, rim.path), L([[-16, -4.1], [-5, -4.1]], WHITE, 0.4, 0.4)], 44, { m: translate(0, -7.5) });
  } },
  colander: { c: STEEL, ppcm: 8, f: c => {
    const pts: Pt[] = [[5, 0, 0], [6.4, -0.8], [10.2, -6], [13.6, -12.2], [14.4, -13.4, 0]], body = lathe(pts, c), h: Vec2[] = [];
    for (let y = -2.8; y > -12; y -= 2.1) for (const x of xs(Math.floor((hw(pts, y) - 1.2) / 1.05) + 1, 2.1)) h.push([x, y]);
    return A([S(rrect(-18.8, -13.6, 5.6, 2, 1), tone(c, "shade")), S(rrect(13.2, -13.6, 5.6, 2, 1), tone(c, "shade")), ...body, ...specks(h, 0.38, 0.32, tone(c, "deep"), 0.75, body[0].path), S(rrect(-6, -1.5, 12, 1.5, 0.5), tone(c, "deep")),
      S(ellipse(0, -13.4, 14.4, 2.4), tone(c, "light")), S(ellipse(0, -13.2, 13.2, 1.8), tone(c, "deep"))], 38.4, { m: translate(-16, 12.6) });
  } },
  lid: { c: STEEL, ppcm: 10, f: c => A([...lathe([[12.4, 0, 0], [12.4, -1.2], [10.6, -3.6], [6, -5.2], [0, -5.6, 0]], c), S(rrect(-12.8, -1.7, 25.6, 1.7, 0.7), tone(c, "light")), S(rrect(-0.9, -7.6, 1.8, 2.2, 0.3), BLACK), S(ellipse(0, -8.6, 2, 1.5), BLACK),
    F(ellipse(3.6, -4.3, 0.36, 0.25), tone(c, "deep")), L([[-8.4, -3.4], [-4.6, -4.7]], WHITE, 0.5, 0.6)], 25.6, { m: translate(0, 8.6) }) },
  serving_tray: { c: COPPER, ppcm: 6, f: c => {
    const body = P([[-20, -4.6, 0], [20, -4.6, 0], [19.2, -1.2], [16.8, 0, 0], [-16.8, 0, 0], [-19.2, -1.2]], c), d: Vec2[] = [];
    for (let k = 0; k < 14; k++) d.push([Math.cos(k * PI / 7) * 14.6, -4.3 + Math.sin(k * PI / 7) * 3.3]);
    return A([S(rrect(-24.6, -5.8, 5.4, 2.2, 1.1), tone(c, "shade")), S(rrect(19.2, -5.8, 5.4, 2.2, 1.1), tone(c, "shade")), body, ...shade(body), S(ellipse(0, -4.6, 20, 5.2), tone(c, "light")), S(ellipse(0, -4.3, 17.6, 4.1), mix(c, tone(c, "light"), 0.4)),
      { path: ellipse(0, -4.3, 9, 2.1), stroke: { color: tone(c, "deep"), width: 0.3 }, flat: true, opacity: 0.35 }, ...specks(d, 0.4, 0.28, tone(c, "deep"), 0.45), L([[-16, -2.4], [-6, -1.6]], WHITE, 0.4, 0.5)], 49, { m: translate(0, -7.5) });
  } },
  cutting_board: { c: "#C9955A", ppcm: 7, f: c => {
    const b = S(rrect(-13, -33, 26, 33, 2.6), c), h = S(holed(rrect(-4.2, -41, 8.4, 9, 3.6), [ellipse(0, -37.4, 1.6, 1.6)]), c, { evenodd: true });
    return A([h, b, F(rect(10.6, -33, 2.4, 33), tone(c, "shade"), 0.55, b.path), ...lit(b, -13, 13, 0.7), { path: rrect(-10.2, -30.4, 20.4, 28.2, 1.8), stroke: { color: tone(c, "deep"), width: 0.35 }, flat: true, opacity: 0.3 }], 26, { m: translate(0, 34.4) });
  } },
  rolling_pin: { c: "#D2A56A", ppcm: 9, stack: 3, f: c => {
    const b = S(rrect(-35, -2.4, 70, 2.4, 1.2), c);
    return A([b, ...lit(b, -35, 35, 0.9), F(rrect(-33, -2.1, 66, 0.5, 0.25), WHITE, 0.3), ...lines([[[-32.4, -2.2], [-32.4, -0.2]], [[32.4, -2.2], [32.4, -0.2]]], tone(c, "deep"), 0.35, 0.5)], 70, { m: mul(translate(1.2, -31), rotate(-PI / 2)) });
  } },
  grater: { c: STEEL, ppcm: 10, f: c => {
    const front = P([[-5.8, 0, 0], [5.8, 0, 0], [4.4, -23, 0], [-4.4, -23, 0]], c), g: Vec2[] = [];
    for (let y = -3.4; y > -21; y -= 2.3) g.push(...xs(3, 2.9).map(x => [x, y] as Vec2));
    return A([S(poly([[5.8, 0], [9.4, -2], [8, -23.2], [4.4, -23]]), tone(c, "shade")), front, ...lit(front, -5.8, 5.8), ...specks(g, 0.85, 0.38, tone(c, "deep"), 0.7, front.path), ...specks(g.map(([x, y]) => [x, y + 0.5] as Vec2), 0.8, 0.2, WHITE, 0.4, front.path),
      R([[-3.2, -22.6], [-2.4, -27.4], [2.4, -27.4], [3.2, -22.6]], BLACK, 1.4), S(rrect(-6, -1.4, 12, 1.4, 0.4), tone(c, "deep"))], 16, { cx: 1.7, m: translate(0, 25.5) });
  } },
  guvec: { c: "#A8582E", ppcm: 10, f: c => {
    const body = lathe([[7.4, 0, 0], [9.6, -1.4], [11, -8], [11.2, -9.6, 0]], c);
    return A([S(rrect(10.6, -8.6, 3.8, 1.9, 0.95), c), S(rrect(-14.4, -8.6, 3.8, 1.9, 0.95), c), ...body, F(rect(-11.4, -6.4, 22.8, 0.8), "#F2E4C4", 0.75, body[0].path), ...specks(xs(7, 3).map(x => [x, -4.4] as Vec2), 0.3, 0.3, "#F2E4C4", 0.7, body[0].path),
      S(rrect(-11.8, -10.6, 23.6, 1.4, 0.7), tone(c, "light")), ...lathe([[11.4, -10, 0], [10.6, -11.4], [6, -13.6], [0, -14.2, 0]], tone(c, "light")), S(ellipse(0, -15.2, 1.8, 1.4), tone(c, "deep")), L([[-8, -12], [-4, -13.2]], WHITE, 0.5, 0.5)], 29, { m: translate(-12.5, 7.7) });
  } },
  pressure_cooker: { c: STEEL, ppcm: 8, f: c => {
    const body = lathe([[10.6, 0, 0], [11.4, -1.2], [11.6, -12.4, 0]], c);
    return A([S(band([[11, -10.4], [19, -10.2], [26, -10]], [2.6, 2.2, 2.4]), BLACK), S(rrect(-16.8, -11.4, 5.6, 2.4, 1.2), BLACK), ...body, F(rect(-12, -2, 24, 2), tone(c, "deep"), 0.35, body[0].path), S(rrect(-12.2, -13.4, 24.4, 1.6, 0.7), tone(c, "light")), ...lathe([[11.8, -13, 0], [11.6, -14.2], [8, -16.4], [0, -17, 0]], c),
      S(rrect(-6, -18.8, 12, 2, 1), BLACK), S(rrect(-0.7, -19.2, 1.4, 1.8, 0.3), STEEL), S(rrect(-1.7, -21.8, 3.4, 2.8, 0.9), BLACK), S(ellipse(5, -16.6, 0.8, 0.5), BLACK), L([[-9, -15], [-4, -16.2]], WHITE, 0.5, 0.6)], 43, { cx: 4.8, m: translate(-22, 10.2) });
  } },
};
const pan: PieceDef = { draw: gen("pan", PAN, "pot"), variants: variants(Object.keys(PAN)),
  meta: {
    about: "Cookware: a lidded pot, a frying pan, a copper cezve, a baking tray, a colander, a lid, a round copper tray, a cutting board, an oklava rolling pin, a box grater, a clay güveç casserole or a pressure cooker.",
    params: { kind: KIND(Object.keys(PAN)), n: N(24, "how many, side by side (rolling pins stack)"), color: COLOR("the metal, enamel or wood (a palette id or a hex); default by kind") },
    terms: ["a2-w-tava", "a2-w-kap", "a2-w-kapak"], tags: ["kitchen", "cookware"],
  } };

// ---- utensil: lying on their side, handle left; held, upright out of the fist -------------------

/** A utensil `len` long and `h` high, lying: `f` draws it from x = 0 (the handle's end); held it stands, the handle in the fist. */
const util = (len: number, h: number, stack: number, f: (c: string) => Shape[], c = STEEL): Kind => ({ c, ppcm: 10, edge: 0.2, stack, hs: 2.6, f: cc => A(f(cc), len, { cx: len / 2, m: mul(translate(h / 2, 2), rotate(-PI / 2)) }) });
const WIRE = "#8E959C";
const loop = (pts: Pt[], color: string, w: number): Shape => ({ path: smooth(pts, true, 1), stroke: { color, width: w, cap: "round", join: "round" } });
const UT: Record<string, Kind> = {
  fork: util(19.6, 2.8, 2.6, c => [S(band([[0, -1.4], [0.6, -1.4], [5, -1.4], [10, -1.4], [13.4, -1.4]], [0.9, 1.9, 1.3, 0.9, 1.1]), c), P([[12.4, -1.4, 0], [13.6, -2.8, 0], [15.6, -2.8, 0], [15.6, 0, 0], [13.6, 0, 0]], c),
    ...many(xs(4, 0.76).map(y => [15.2, y - 1.4 - 0.26] as Vec2), (x, y) => rrect(x, y, 4.4, 0.52, 0.26), c), L([[1.6, -1.9], [11, -1.9]], WHITE, 0.3, 0.6)]),
  spoon: util(20.4, 5, 3.4, c => [S(band([[0, -2.5], [0.6, -2.5], [6, -2.5], [12.4, -2.5]], [1, 2.1, 1.1, 1]), c), S(ellipse(16.6, -2.5, 3.8, 2.5), c), F(ellipse(16.8, -2.5, 3.1, 1.8), tone(c, "shade"), 0.7), F(ellipse(15.6, -3.2, 1.6, 0.5), WHITE, 0.6), L([[1.6, -3.1], [11, -3.1]], WHITE, 0.3, 0.6)]),
  ladle: util(34, 12.4, 7, c => [R([[0.2, -9.6], [0.8, -12], [2.8, -12.4]], c, 0.9), S(band([[0, -9.6], [9, -8.9], [18, -7.8], [24, -6.6]], [1.2, 1, 1.1, 1.6]), c), ...(() => { const b = P([[23.2, -6.6, 0], [33.8, -6.6, 0], [33, -3.2], [28.5, 0], [24, -3.2]], c); return [b, ...shade(b)]; })(), S(ellipse(28.5, -6.6, 5.3, 1), tone(c, "light")), F(ellipse(28.5, -6.5, 4.5, 0.65), tone(c, "deep")), L([[2, -10.2], [16, -9.2]], WHITE, 0.3, 0.6)]),
  wooden_spoon: util(31, 6, 3.8, c => [S(band([[0, -2.9], [0.7, -2.9], [8, -2.9], [16, -2.9], [21, -2.9]], [1, 2.1, 1.5, 1.2, 1.8]), c), S(ellipse(26, -3, 5.1, 3), c), F(ellipse(26.6, -3, 4, 2.2), tone(c, "shade"), 0.75), F(ellipse(24.6, -3.8, 1.8, 0.5), tone(c, "light"), 0.7), L([[1.6, -3.7], [18, -3.5]], tone(c, "light"), 0.35, 0.6)], WOOD),
  spatula: util(32.4, 8, 5.2, c => [S(band([[0, -4], [0.7, -4], [10, -4], [19, -4]], [1, 2.3, 1.6, 1.4]), WOOD), R([[18.4, -4], [22.2, -4]], STEEL, 1), S(rrect(21.6, -8, 10.8, 7.8, 1.3), c),
    ...many(xs(4, 1.5).map(y => [24.4, y - 4.27] as Vec2), (x, y) => rrect(x, y, 5.8, 0.55, 0.27), tone(c, "deep"), { flat: true, opacity: 0.75 }), F(rect(21.8, -8, 2, 7.8), WHITE, 0.2)], "#3B3D44"),
  whisk: util(28, 7.4, 5.2, c => [S(band([[0, -3.7], [0.7, -3.7], [6, -3.7], [11.4, -3.7]], [1, 2.3, 1.9, 1.4]), c), S(rrect(10.6, -4.8, 2.4, 2.2, 0.6), tone(c, "deep")), ...[3.6, 2.5, 1.3].map(a => loop([[11.8, -3.7, 0], [14.6, -3.7 - a], [21, -3.7 - a * 1.08], [27.8, -3.7, 0], [21, -3.7 + a * 1.08], [14.6, -3.7 + a]], WIRE, 0.32)), L([[11.8, -3.7], [27.4, -3.7]], WIRE, 0.3, 0.9)]),
  tongs: util(28.8, 7, 4.6, c => {
    const arm = (s: number) => S(band([[2, -3.5 + s * 0.4], [10, -3.5 + s * 1.1], [19, -3.5 + s * 2], [27.4, -3.5 + s * 2.9]], [1.1, 1, 1.1, 1.7]), c);
    return [arm(1), arm(-1), S(ellipse(27.4, -6.4, 1.6, 0.9), tone(c, "light")), S(ellipse(27.4, -0.6, 1.6, 0.9), tone(c, "light")), S(rrect(-0.2, -4.8, 3.4, 2.6, 1.3), tone(c, "deep")), L([[4, -4.7], [17, -5.7]], WHITE, 0.3, 0.6)];
  }),
  skewer: util(41.4, 4.4, 2.6, c => [{ path: ellipse(2.2, -2.2, 2.1, 1.8), stroke: { color: c, width: 0.6 } }, R([[4.2, -2.2], [7.4, -2.2]], c, 0.9), P([[7, -3.2, 0], [38.6, -3.2, 0], [41.4, -2.2, 0], [38.6, -1.2, 0], [7, -1.2, 0]], c), L([[8, -2.2], [35, -2.2]], tone(c, "deep"), 0.25, 0.5), L([[8, -3], [34, -3]], WHITE, 0.3, 0.6)]),
  knife: util(33.4, 5.8, 5.6, c => [S(rrect(0, -3.8, 12.8, 3.4, 1.6), "#3B3D44"), ...specks([[3, -2.1], [6.4, -2.1], [9.8, -2.1]], 0.4, 0.4, STEEL), P([[12.4, -5.8, 0], [26, -5.4], [33.2, -1.2, 0], [28.4, -0.2, 0], [12.4, -0.4, 0]], c), L([[14, -4.4], [28, -3.6]], WHITE, 0.4, 0.6), L([[14, -0.9], [29, -0.8]], tone(c, "shade"), 0.3, 0.7), L([[2, -3.4], [11, -3.4]], WHITE, 0.3, 0.3)]),
};
const utensil: PieceDef = { draw: gen("utensil", UT, "fork"), variants: variants(Object.keys(UT)),
  meta: {
    about: "A kitchen utensil lying on its side, or upright out of the fist: a fork, a tablespoon, a ladle, a wooden spoon, a spatula, a whisk, tongs, a flat kebab skewer (şiş) or a chef's knife.",
    params: { kind: KIND(Object.keys(UT)), n: N(24, "how many, one above the other (held: side by side, up to 6)"), color: COLOR("the metal, wood or the spatula's head; default by kind") },
    terms: ["a1-w-catal", "a1-w-kasik", "a2-w-sis", "a2-w-bicak"], tags: ["kitchen", "cutlery"],
  } };

// ---- cup: things to drink from ----------------------------------------------------------------

const GOLD = "#D4AF4A", COFFEE = "#4A2F20", fillOf = (p: Prm) => Math.max(0, Math.min(1, num(p.fill, 0.85)));
/** A Turkish coffee cup on its saucer, 11.2 cm across, `fill` of coffee. */
function fincanSh(c: string, fill: number): Shape[] {
  const cup = lathe([[1.9, 0, 0], [2.6, -0.5], [3, -3], [3.15, -5, 0]], c), open = ellipse(0, -5, 2.95, 0.52), sa = P([[-5.6, -1.4, 0], [5.6, -1.4, 0], [4, -0.4], [2.4, 0, 0], [-2.4, 0, 0], [-4, -0.4]], c);
  return [sa, ...shade(sa), L([[-5, -1.05], [5, -1.05]], GOLD, 0.25, 0.9), ...at([R([[3, -4.2], [4.7, -4], [4.6, -1.9], [2.9, -1.4]], c, 0.85), ...cup, F(rect(-3.3, -1.9, 6.6, 0.45), GOLD, 0.9, cup[0].path), ...specks(xs(5, 1.15).map(x => [x, -3.3] as Vec2), 0.2, 0.2, "#3F74C4", 0.9, cup[0].path),
    S(ellipse(0, -5, 3.15, 0.6), tone(c, "light")), S(open, tone(c, "deep"), { flat: true }), ...(fill > 0.05 ? [F(ellipse(0, -5 + (1 - fill) * 0.4, 2.8, 0.42), COFFEE, 0.97, open), F(ellipse(-0.7, -5 + (1 - fill) * 0.4, 1.1, 0.14), "#9C6A44", 0.7, open)] : [])], 0, -1.1)];
}
const waterGlass = (fill: number, w = 2.9, h = 9.2): Shape[] => [...vessel([[w, 0, 0], [w + 0.2, -1], [w + 0.6, -h, 0]], "#BFE0EE", fill, { base: 1 }), F(ellipse(0, -0.5, w - 0.4, 0.35), WHITE, 0.4)];
const CUPS: Record<string, Kind> = {
  fincan: { c: "#F7F4EC", ppcm: 14, f: (c, p) => A(fincanSh(c, fillOf(p)), 11.4, { m: translate(0, -7.5), ems: p.hot ? [["steam", 0, -6.6, 1.8]] : [] }) },
  mug: { c: "#4F6E9E", ppcm: 12, f: (c, p) => {
    const body = lathe([[3.7, 0, 0], [4, -0.6], [4.1, -9.2, 0]], c), open = ellipse(0, -9.2, 3.5, 0.7), fill = fillOf(p);
    return A([R([[4, -7.8], [7.3, -7.4], [7.4, -2.8], [3.9, -2.4]], c, 1.2), ...body, F(rect(-4.2, -5, 8.4, 1.3), tone(c, "light"), 0.5, body[0].path), S(ellipse(0, -9.2, 4.1, 0.9), tone(c, "light")), S(open, tone(c, "deep"), { flat: true }),
      ...(fill > 0.05 ? [F(ellipse(0, -9.2 + (1 - fill) * 1.1, 3.4, 0.55), COFFEE, 0.97, open)] : [])], 12.2, { cx: 1.7, m: translate(-6.2, 5), ems: p.hot ? [["steam", 0, -10.2, 2.4]] : [] });
  } },
  paper_cup: { c: "#F4F1EA", ppcm: 12, f: (c, p) => {
    const body = lathe([[2.9, 0, 0], [4.2, -11.6, 0]], c), lid = P([[-4.4, -13.2, 0], [4.4, -13.2, 0], [4, -14.6], [2, -15.2], [-2, -15.2], [-4, -14.6]], "#3B3D44");
    return A([...body, S(rrect(-4.9, -13.4, 9.8, 1.9, 0.8), "#3B3D44"), lid, F(rrect(0.9, -14.7, 2, 0.55, 0.27), "#16171A", 0.8), S(poly([[-3.55, -3.4], [3.55, -3.4], [3.95, -8.3], [-3.95, -8.3]]), "#B88A57"), ...shade(S(poly([[-3.55, -3.4], [3.55, -3.4], [3.95, -8.3], [-3.95, -8.3]]), "#B88A57"), 0.8),
      F(ellipse(0, -5.9, 1.1, 1.1), "#F4F1EA", 0.85), L([[-3.4, -12.2], [-3.1, -9.6]], WHITE, 0.4, 0.6)], 9.8, { m: translate(0, -7.5), ems: p.hot ? [["steam", 1.9, -15.4, 1.6]] : [] });
  } },
  water_glass: { c: GLASS, ppcm: 14, f: (_, p) => A(waterGlass(fillOf(p)), 7.4, { m: translate(0, -7.5) }) },
  ayran: { c: "#F4F0E2", ppcm: 12, f: (c, p) => {
    const fill = fillOf(p), lvl = -0.8 - fill * 8.8;
    return A([...vessel([[2.7, 0, 0], [2.9, -0.6], [3.9, -10.4, 0]], c, fill, { base: 0.8 }), ...(fill > 0.05 ? many([...xs(5, 1.35).map(x => [x, lvl - 0.2] as Vec2), [-0.6, lvl - 0.8], [0.9, lvl - 0.7]], (x, y) => ellipse(x, y, 0.8, 0.55), WHITE, { flat: true, opacity: 0.95 }) : []),
      ...specks([[-1.8, lvl - 0.3], [1.9, lvl - 0.2]], 0.3, 0.25, "#E4DCC4", 0.8)], 8.6, { m: translate(0, -7.5) });
  } },
  juice_glass: { c: "#F29A2E", ppcm: 12, f: (c, p) => {
    const sl = [0, 1, 2, 3, 4].map(k => [[3.7, -11.5], [3.7 + Math.cos(k * 1.2566 + 0.6) * 1.8, -11.5 + Math.sin(k * 1.2566 + 0.6) * 1.8]] as Vec2[]);
    return A([...vessel([[2.9, 0, 0], [3.1, -0.8], [3.5, -11.2, 0]], c, fillOf(p), { base: 1 }), R([[1.2, -1.6], [0.2, -9], [-0.6, -14.6]], "#D9534A", 0.6), L([[0.9, -3], [0.3, -8]], WHITE, 0.25, 0.7), S(ellipse(3.8, -11.4, 2.1), "#F08A2A"), F(ellipse(3.8, -11.4, 1.7), "#F8C06A"), ...lines(sl, "#F08A2A", 0.25, 0.9)], 8.4, { cx: 0.6, m: translate(0, -7.5) });
  } },
  coffee_set: { c: "#C9A24A", ppcm: 10, f: (c, p) => {
    const tray = P([[-14, -2.2, 0], [14, -2.2, 0], [13, 0, 0], [-13, 0, 0]], c), loc = (x: number) => [...many([[x - 1.3, -2.4], [x + 1.3, -2.4]], (a, b) => rrect(a - 1.2, b, 2.4, 2.4, 0.35), "#E9A7B0"), ...many([[x - 1.3, -2.4], [x + 1.3, -2.4]], (a, b) => poly([[a - 1.2, b], [a - 0.5, b - 0.8], [a + 1.9, b - 0.8], [a + 1.2, b]]), "#F6CBD3"),
      ...specks([[x - 2, -1.2], [x - 0.6, -1.7], [x + 0.8, -1], [x + 1.8, -1.6], [x - 1.3, -0.5], [x + 1.5, -0.4]], 0.18, 0.15, WHITE, 0.9)];
    return A([tray, ...shade(tray, 0.7), S(ellipse(0, -2.2, 14, 3.2), tone(c, "light")), S(ellipse(0, -2.1, 12.4, 2.5), c), ...at(fincanSh("#F7F4EC", fillOf(p)), -6.4, -2), ...at(loc(2.6), 0, -1.6), ...at(waterGlass(0.8, 2.3, 6.4), 9.3, -2)], 28, { m: translate(0, -7.5), ems: p.hot ? [["steam", -6.4, -8.8, 1.8]] : [] });
  } },
};
const cup: PieceDef = { draw: gen("cup", CUPS, "fincan"), variants: variants(Object.keys(CUPS)),
  meta: {
    about: "Something to drink from: a Turkish coffee fincan on its saucer, a mug, a takeaway paper cup, a water glass (bardak), an ayran cup with froth, an orange juice glass, or a coffee set (fincan, lokum and a glass of water on a tray).",
    params: { kind: KIND(Object.keys(CUPS)), n: N(24), fill: { type: "num", min: 0, max: 1, default: 0.85, about: "how full of drink (not the paper cup, which has its lid on)" }, hot: { type: "bool", default: false, about: "steam rises (fincan, mug, paper cup, coffee set)" }, color: COLOR("the cup's porcelain, glass or drink; default by kind") },
    terms: ["a1-w-fincan", "a1-w-bardak", "a2-w-ayran", "a1-w-kahve", "a1-w-meyve-suyu"], tags: ["kitchen", "drink"],
  } };

// ---- bottle: bottles, cartons and jugs; the label is words on the paper label -----------------------

const cap = (x: number, y: number, w: number, h: number, c: string): Shape[] => { const s = S(rrect(x, y, w, h, Math.min(0.7, h / 3)), c); return [s, ...lit(s, x, x + w, 0.8)]; };
/** A bottle's words: its `label` param, else `d`; the paper label `w` wide from y, `h` tall, and the text box in it. */
const lab = (p: Prm, d: string, w: number, y: number, h: number, c: string, ty: number, th: number, color = INK, size?: number): [Shape[], TextSpec[]] => {
  const t = str(p.label, d);
  return [label(w, y, h, c), txt(t, -w / 2 + 0.3, ty, w - 0.6, th, { color, weight: 700, ...(size ? { size } : {}) })];
};
/** A held bottle hangs from the fist by its neck at `hy`. */
const byNeck = (hy: number) => translate(0, -4 - hy);
const BOTTLES: Record<string, Kind> = {
  glass: { c: "#4E8A4A", ppcm: 8, f: (c, p) => {
    const [l, t] = lab(p, "", 6.6, -15, 8, CREAM, -12, 3.4);
    return A([...lathe([[3, 0, 0], [3.7, -0.8], [3.7, -15.6], [3.3, -18.5], [2.1, -21.5], [1.6, -23.6], [1.7, -26.2, 0]], c, { opacity: 0.93 }), S(rrect(-2.3, -27.4, 4.6, 1.5, 0.6), tone(c, "light")), ...(str(p.label, "") ? l : []), F(ellipse(-2.5, -11, 0.45, 3.2), WHITE, 0.3), F(ellipse(-1.1, -21, 0.3, 1.2), WHITE, 0.35)], 7.4, { m: byNeck(-23), text: t });
  } },
  oil: { c: "#E8C13A", ppcm: 8, f: (c, p) => {
    const [l, t] = lab(p, "YAĞ", 9.2, -15, 9.4, CREAM, -10.6, 3.8);
    return A([{ path: ellipse(3.9, -20.6, 2, 2.3), stroke: { color: c, width: 0.55 } }, ...lathe([[4.3, 0, 0], [4.6, -1], [4.6, -15.4], [4, -19], [2.2, -21.4], [1.9, -23.4, 0]], c, { opacity: 0.94 }), ...cap(-2.3, -26.2, 4.6, 2.9, "#C8283A"), ...l, F(ellipse(0, -12.9, 1.7, 1.7), "#F2C230"), F(ellipse(0, -12.9, 0.8, 0.8), "#6B4A35")], 11.6, { m: byNeck(-22.5), text: t });
  } },
  cologne: { c: "#E6DE7E", ppcm: 9, f: (c, p) => {
    const [l, t] = lab(p, "KOLONYA", 6.8, -14, 8.6, "#FBF3DF", -9.2, 3, "#8A6A1E");
    return A([...vessel([[3.2, 0, 0], [3.4, -0.7], [3.4, -14.6], [3, -17.4], [1.8, -19.6], [1.7, -21.4, 0]], c, 0.8, { base: 1 }), ...cap(-2.4, -24.8, 4.8, 4, GOLD), ...l, F(ellipse(0, -11.8, 2, 1.4), "#F2D230"), F(ellipse(1.8, -12.9, 0.9, 0.45), "#5E9A3E")], 8, { m: byNeck(-22), text: t });
  } },
  ayran: { c: "#2E5FA8", ppcm: 8, f: (c, p) => {
    const [l, t] = lab(p, "AYRAN", 8.6, -14.6, 8, c, -11.6, 4, WHITE);
    return A([...lathe([[3.9, 0, 0], [4.2, -0.8], [4.2, -16.4], [3.6, -19.6], [2.1, -21.5], [1.9, -22.9, 0]], "#F4F2EA"), S(rrect(-2.3, -23.6, 4.6, 0.8, 0.3), tone("#F4F2EA", "shade")), ...cap(-2.2, -25.8, 4.4, 2.8, c), ...l, F(ellipse(-1.2, -8.4, 2.2, 0.5), WHITE, 0.55), F(ellipse(1.8, -9.2, 1.6, 0.4), WHITE, 0.4)], 8.6, { m: byNeck(-22), text: t });
  } },
  soda: { c: "#9BD3C6", ppcm: 12, f: (c, p) => {
    const [l, t] = lab(p, "SODA", 4.8, -11, 5.4, CREAM, -9.4, 2.4);
    return A([...vessel([[2.9, 0, 0], [3, -0.5], [3, -12.4], [2.6, -14.6], [1.5, -16.8], [1.4, -19.4, 0]], "#DDF1F3", 0.85, { base: 0.7, tint: c, op: 0.7 }), ...specks([[-0.8, -5], [0.9, -7.6], [-0.3, -10.4], [0.7, -13.2], [-0.5, -3]], 0.22, 0.22, WHITE, 0.8), ...cap(-1.9, -20.7, 3.8, 1.2, "#9AA0A6"), ...l], 6.2, { m: byNeck(-18), text: t });
  } },
  juice_carton: { c: "#F0872B", ppcm: 10, f: (c, p) => {
    const front = S(rect(-3.5, -19, 7, 19), c);
    return A([S(poly([[3.5, 0], [6.2, -2], [6.2, -17.2], [3.5, -19]]), tone(c, "shade")), front, ...lit(front, -3.5, 3.5, 0.6), S(poly([[3.5, -19], [1.9, -22.2], [4.6, -20.4], [6.2, -17.2]]), tone(c, "deep")), S(poly([[-3.5, -19], [-1.9, -22.2], [1.9, -22.2], [3.5, -19]]), tone(c, "light")), S(rect(-2, -23.5, 4, 1.4), tone(c, "deep")),
      S(rrect(-2.9, -14.2, 5.8, 10.4, 0.7), "#FFF6E0"), F(ellipse(0, -9.8, 2.2, 2.2), "#F08A2A"), F(ellipse(-0.7, -10.6, 0.7, 0.45), WHITE, 0.5), F(ellipse(0.8, -12.4, 1.1, 0.5), "#5E9A3E")], 11, { m: translate(0, 8), text: txt(str(p.label, "MEYVE SUYU"), -3.2, -18.4, 6.4, 3.4, { color: WHITE, weight: 700 }) });
  } },
  vinegar: { c: "#7B2D26", ppcm: 9, f: (c, p) => {
    const [l, t] = lab(p, "SİRKE", 6.8, -13.4, 7.4, CREAM, -10.2, 3);
    return A([...vessel([[3.2, 0, 0], [3.4, -0.7], [3.4, -14], [3, -16.8], [1.7, -19], [1.6, -20.4, 0]], c, 0.8, { base: 1, op: 0.55 }), P([[-1.8, -20.2, 0], [1.8, -20.2, 0], [1.2, -22.6], [-1.2, -22.6]], "#F4F1EA"), S(rrect(-2, -21, 4, 0.9, 0.3), "#E4E0D6"), ...l, F(ellipse(0, -11.2, 1.1, 0.5), "#C8283A", 0.8)], 7.6, { m: byNeck(-20), text: t });
  } },
  water_jug: { c: "#BFE0EE", ppcm: 8, f: (c, p) => A([R([[5.9, -17], [10.6, -15.4], [10.8, -6], [6.1, -3.8]], GLASS, 1.4, { opacity: 0.7 }), P([[-5.6, -18.4, 0], [-9.6, -20.4, 0], [-9, -18.8, 0], [-6.1, -15.2, 0]], GLASS, { opacity: 0.6 }), ...vessel([[4.9, 0, 0], [5.8, -0.8], [6.1, -18, 0]], c, fillOf(p), { base: 1.2, gap: 1.2 }),
    F(ellipse(0, -18, 6.1, 0.7), WHITE, 0.5), L([[10, -14], [10.3, -8]], WHITE, 0.4, 0.7)], 19.4, { cx: 1.1, m: translate(-10.6, 9.6) }) },
  serbet_jug: { c: "#C4263A", ppcm: 8, f: (c, p) => A([R([[5.2, -13], [9.6, -11.6], [9.8, -5], [5.7, -3.8]], GLASS, 1.4, { opacity: 0.7 }), ...vessel([[4.6, 0, 0], [5.6, -1.2], [5.9, -8], [5, -13.6], [3, -17.6], [2.8, -20.4, 0]], c, fillOf(p), { base: 1.2, gap: 1.6 }),
    ...many([[-1.4, -13.4], [1.2, -12.6], [-0.2, -11], [2, -14.6]], (x, y) => rrect(x - 0.8, y - 0.8, 1.6, 1.6, 0.3), WHITE, { flat: true, opacity: 0.45 }), ...lathe([[2.5, -20, 0], [2.7, -21.4], [1.4, -23.2], [0, -23.6, 0]], GLASS, { opacity: 0.8 }), L([[9.2, -10.4], [9.4, -6]], WHITE, 0.4, 0.7)], 17.6, { cx: 1.9, m: translate(-9.8, 8.4) }) },
  water_bottle: { c: "#3F74C4", ppcm: 10, f: (c, p) => {
    const [l, t] = lab(p, "SU", 6.8, -12.4, 5.6, c, -11.2, 3.2, WHITE);
    return A([...vessel([[3, 0, 0], [3.4, -0.6], [3.4, -13.8], [3, -15.8], [1.6, -17.4], [1.5, -18.6, 0]], "#BFE0EE", fillOf(p), { base: 0.8, tint: "#CFE9F3", op: 0.6 }), S(rrect(-2.3, -20.6, 4.6, 0.7, 0.3), "#CFE9F3"), ...cap(-1.9, -22.2, 3.8, 2.3, c), ...l, F(ellipse(0, -9.6, 1.5, 0.35), WHITE, 0.55), L([[-2.6, -3.4], [-2.6, -1.4]], tone(c, "light"), 0.4, 0.4)], 7.2, { m: byNeck(-19.6), text: t });
  } },
};
const bottle: PieceDef = { draw: gen("bottle", BOTTLES, "glass"), variants: variants(Object.keys(BOTTLES)),
  meta: {
    about: "A bottle, carton or jug: a plain green glass bottle (şişe), an oil bottle (yağ), lemon cologne (kolonya), an ayran bottle, a small soda bottle, a fruit juice carton, vinegar, a glass water jug (sürahi), a jug of red şerbet or a plastic water bottle (su).",
    params: { kind: KIND(Object.keys(BOTTLES)), n: N(24), fill: { type: "num", min: 0, max: 1, default: 0.85, about: "how full of water or şerbet (the jugs, the water bottle)" }, color: COLOR("the glass, plastic, carton or drink; default by kind"), label: { type: "text", about: "the words on the label; default by kind (YAĞ, KOLONYA, AYRAN, SODA, MEYVE SUYU, SİRKE, SU), none on the green bottle" } },
    terms: ["a1-w-sise", "a2-w-yag", "b1-w-kolonya", "a2-w-ayran", "a2-w-soda", "a1-w-meyve-suyu", "a2-w-serbet", "seed-w19"], tags: ["kitchen", "drink", "bottle"],
  } };

// ---- condiment: shakers, jars, a dish of flakes, butter, yoghurt ---------------------------------

/** A glass shaker with `stuff` in it and a perforated cap. */
const shaker = (stuff: string, c: string): Shape[] => [...vessel([[2.5, 0, 0], [2.8, -0.5], [2.8, -6.6, 0]], stuff, 0.85, { base: 0.6, k: 0.3, op: 0.5 }), ...lathe([[2.7, -6.4, 0], [2.8, -8], [1.9, -9.3], [0, -9.7, 0]], c), ...specks([[-1, -8.2], [1, -8.2], [0, -8.7], [-0.6, -7.4], [0.7, -7.4]], 0.2, 0.2, tone(c, "deep"), 0.9)];
const cube = (x: number, y: number, s = 1.9): Shape[] => [S(poly([[x, y - s], [x + 0.5, y - s - 0.7], [x + s + 0.5, y - s - 0.7], [x + s, y - s]]), WHITE), S(rect(x, y - s, s, s), "#F4F2EC"), S(poly([[x + s, y - s], [x + s + 0.5, y - s - 0.7], [x + s + 0.5, y - 0.7], [x + s, y]]), "#DAD6CC")];
/** A jar with a label of words: glass of height h, a lid, a paper label. */
const CON: Record<string, Kind> = {
  salt: { c: STEEL, ppcm: 14, f: c => A(shaker("#FBFAF5", c), 6, { m: translate(0, -7.5) }) },
  pepper: { c: "#3B3D44", ppcm: 14, f: c => A(shaker("#3A2E28", c), 6, { m: translate(0, -7.5) }) },
  pul_biber: { c: "#F4F1EA", ppcm: 12, f: c => {
    const dish = lathe([[2.8, 0, 0], [3.6, -0.8], [4.9, -3.4], [5, -3.8, 0]], c), flakes = [[-2.8, -4.4], [-1.4, -5.4], [0.2, -6], [1.8, -5.5], [3, -4.5], [-0.4, -4.6], [1, -4.2], [2.4, -4.1], [-2, -4]] as Vec2[];
    return A([...dish, F(rect(-5, -3.1, 10, 0.4), "#3F74C4", 0.8, dish[0].path), S(ellipse(0, -3.8, 5, 1.2), tone(c, "light")), S(ellipse(0, -3.7, 4.2, 0.9), tone(c, "shade")), P([[-3.8, -3.7, 0], [-2.4, -5.2], [0, -6.1], [2.2, -5.5], [3.8, -3.7, 0]], "#B3261E"),
      ...specks(flakes, 0.45, 0.3, "#D8452E", 0.9), ...specks(flakes.map(([x, y]) => [x + 0.7, y + 0.5] as Vec2), 0.35, 0.25, "#6E1810", 0.8), F(ellipse(-0.6, -5.2, 1.2, 0.3), "#F07A5A", 0.5)], 10.4, { m: translate(0, -7.5) });
  } },
  sugar: { c: "#F4F1EA", ppcm: 12, f: c => {
    const bowl = lathe([[1.6, -2.2, 0], [3.8, -3.6], [4.8, -6.2, 0]], c);
    return A([S(ellipse(0, -6.1, 4.2, 0.9), tone(c, "deep"), { flat: true }), ...[[[-0.9, -9.7], [0.9, -9.6]], [[-2, -7.9], [-0.2, -8], [1.7, -7.9]], [[-3.2, -6.2], [-1.3, -6.3], [0.6, -6.2], [2.5, -6.3]]].flatMap(row => row.flatMap(([x, y]) => cube(x, y))),
      S(rrect(-1.1, -2.4, 2.2, 1.7, 0.3), tone(c, "shade")), S(rrect(-2.8, -1, 5.6, 1, 0.4), c), ...bowl, S(rrect(-4.9, -6.6, 9.8, 0.8, 0.4), tone(c, "light")), F(rect(-4.4, -4.6, 8.8, 0.4), "#3F74C4", 0.7, bowl[0].path)], 10.4, { m: translate(0, -7.5) });
  } },
  jam: { c: "#9E1F3A", ppcm: 12, f: (c, p) => {
    const cloth = P([[-3.4, -11, 0], [3.4, -11, 0], [4.8, -9.4], [5.4, -7, 0], [4.2, -7.8, 0], [3, -7, 0], [1.6, -7.8, 0], [0, -7, 0], [-1.6, -7.8, 0], [-3, -7, 0], [-4.2, -7.8, 0], [-5.4, -7, 0], [-4.8, -9.4]], "#F7F1E4"), [l, t] = lab(p, "REÇEL", 7.4, -5.8, 4.2, CREAM, -4.9, 2.2);
    return A([...vessel([[3.8, 0, 0], [4, -0.6], [4, -8.2], [3.4, -9.2, 0]], c, 0.9, { base: 0.7, op: 0.6 }), ...l, cloth, ...lines(xs(8, 1.4).map(x => [[x, -11], [x, -7]] as Vec2[]), "#C0392B", 0.5, 0.5, cloth.path), ...lines([-10.4, -9.2, -8].map(y => [[-5.6, y], [5.6, y]] as Vec2[]), "#C0392B", 0.5, 0.5, cloth.path), L([[-4.9, -8.6], [0, -8.2], [4.9, -8.6]], "#8E6A44", 0.4, 0.95)], 11, { m: translate(0, -7.5), text: t });
  } },
  salca: { c: "#C8372A", ppcm: 12, f: (c, p) => {
    const [l, t] = lab(p, "SALÇA", 7.8, -7.6, 5.6, CREAM, -4, 2);
    return A([...vessel([[4.2, 0, 0], [4.5, -0.8], [4.5, -9.2], [3.8, -10.2, 0]], c, 0.95, { base: 0.8, op: 0.6 }), ...cap(-3.8, -12.6, 7.6, 2.6, STEEL), ...l, F(ellipse(0, -5.9, 1.3, 1.1), "#D8402E"), F(ellipse(0, -7, 0.8, 0.3), "#4E8A3A")], 9.2, { m: translate(0, -7.5), text: t });
  } },
  thyme: { c: "#7A8A3C", ppcm: 14, f: (c, p) => {
    const [l, t] = lab(p, "KEKİK", 3.8, -4.6, 2.8, CREAM, -4.2, 2);
    return A([...vessel([[2.6, 0, 0], [2.8, -0.5], [2.8, -6.6], [2.4, -7.4, 0]], c, 0.97, { base: 0.6, k: 0.3, op: 0.6 }), ...specks([[-1.6, -6.2], [0.2, -5.6], [1.5, -6.3], [-1.9, -3], [1.8, -2.8], [-1.5, -1.2], [0.4, -1.1], [1.7, -1.6], [-0.4, -6.4]], 0.24, 0.17, tone(c, "light"), 0.85), ...specks([[-0.7, -5.9], [1, -5.2], [-2, -4.8], [2, -4.2], [-0.3, -0.8]], 0.2, 0.15, tone(c, "deep"), 0.7), ...cap(-2.5, -9.6, 5, 2.4, "#2E2F35"), ...l], 5.8, { m: translate(0, -7.5), text: t });
  } },
  butter: { c: "#F4D766", ppcm: 12, f: c => {
    const plate = P([[-8.4, -1.2, 0], [8.4, -1.2, 0], [6.6, -0.3], [4, 0, 0], [-4, 0, 0], [-6.6, -0.3]], "#F4F1EA"), foil = S(rect(1.2, -5.2, 3.2, 3.8), STEEL);
    return A([plate, ...shade(plate, 0.6), S(ellipse(0, -1.2, 8.4, 1.3), "#FBF8F0"), S(ellipse(0, -1.1, 7, 0.9), "#EDE7D8"), S(poly([[4.4, -5.2], [6, -6.6], [6, -2.8], [4.4, -1.4]]), tone(c, "shade")), S(poly([[-4.4, -5.2], [-2.8, -6.6], [6, -6.6], [4.4, -5.2]]), tone(c, "light")), S(rect(-4.4, -5.2, 8.8, 3.8), c),
      S(poly([[1.2, -5.2], [2.8, -6.6], [6, -6.6], [4.4, -5.2]]), tone(STEEL, "light")), S(poly([[4.4, -5.2], [6, -6.6], [6, -2.8], [4.4, -1.4]]), tone(STEEL, "shade")), foil, ...lines([[[1.2, -4], [4.4, -4.6]], [[1.6, -2.6], [4.4, -3.2]]], tone(STEEL, "deep"), 0.3, 0.6), F(rect(1.4, -5, 0.6, 3.4), WHITE, 0.45),
      S(rect(-7.8, -3.5, 1.7, 2.4), c), S(poly([[-7.8, -3.5], [-7.2, -4.1], [-5.5, -4.1], [-6.1, -3.5]]), tone(c, "light")), F(rect(-4.2, -5, 0.5, 3.4), WHITE, 0.4)], 17, { m: translate(0, -7.5) });
  } },
  yoghurt: { c: "#B96A3C", ppcm: 12, f: c => {
    const pot = lathe([[3.4, 0, 0], [4.4, -0.8], [5.2, -6.4], [5.4, -7.2, 0]], c);
    return A([R([[1.8, -8.8], [4.6, -14.2]], STEEL, 0.9), S(ellipse(4.7, -14.4, 0.8, 0.6), tone(STEEL, "light")), ...pot, S(ellipse(0, -7.2, 5.4, 1.3), tone(c, "light")), S(ellipse(0, -7.1, 4.6, 1), tone(c, "deep")), ...(() => { const m = P([[-4.6, -7.1, 0], [-3.6, -8.6], [-1.2, -9.6], [1.6, -9.5], [3.8, -8.4], [4.6, -7.1, 0]], "#FBF8F0"); return [m, ...shade(m, 0.7)]; })(),
      F(ellipse(-0.6, -8.6, 2.4, 0.4), "#EDE6D4", 0.8), F(rect(-5, -5.2, 10, 0.5), "#F4F1EA", 0.8, pot[0].path)], 11, { m: translate(0, -7.5) });
  } },
  sauce: { c: "#C8283A", ppcm: 12, f: (c, p) => {
    const [l, t] = lab(p, "SOS", 5.6, -10.8, 5.4, CREAM, -9, 2.8);
    return A([...lathe([[2.6, 0, 0], [3.3, -1.2], [3.4, -12], [3.1, -14.6], [1.6, -16.2], [1.3, -17.2, 0]], c), ...l, S(rrect(-1.9, -18, 3.8, 1.4, 0.5), "#F4F1EA"), P([[-1.7, -17.8, 0], [1.7, -17.8, 0], [0.8, -21.2], [0, -21.7], [-0.8, -21.2]], "#F4F1EA"), L([[-2.4, -3], [-2.5, -10]], WHITE, 0.4, 0.5)], 7, { m: byNeck(-17.4), text: t });
  } },
  lemon: { c: "#F2D230", ppcm: 14, f: c => {
    const body = P([[0, -0.6, 0], [2.6, -1.2], [4, -3.6], [3.8, -6], [2.2, -8], [0.9, -8.8, 0], [-0.9, -8.8, 0], [-2.2, -8], [-3.8, -6], [-4, -3.6], [-2.6, -1.2]], c);
    return A([body, ...shade(body, 0.9), P([[-1.5, -8.8, 0], [1.5, -8.8, 0], [0.8, -11], [-0.8, -11]], "#4E8A3A"), S(rrect(-0.9, -12, 1.8, 1.4, 0.5), "#3B6A2E"), F(ellipse(-1.8, -5.6, 0.5, 1.5), WHITE, 0.45), ...specks([[1.4, -3.2], [-0.6, -2.4], [2.4, -5.4], [0.4, -6.6]], 0.2, 0.2, tone(c, "deep"), 0.5, body.path)], 8.6, { m: translate(0, -7.5) });
  } },
};
const condiment: PieceDef = { draw: gen("condiment", CON, "salt"), variants: variants(Object.keys(CON)),
  meta: {
    about: "Table and pantry seasonings: a salt shaker, a pepper shaker, red pepper flakes (pul biber) in a dish, a sugar bowl with cubes, a jar of jam with a cloth lid, tomato paste, thyme in a small jar, a block of butter on a dish, yoghurt in a pot, a squeeze bottle of sauce or a lemon-shaped bottle of lemon juice (limon sosu).",
    params: { kind: KIND(Object.keys(CON)), n: N(24), color: COLOR("the cap, dish, jam, paste, herb, butter, pot or bottle; default by kind"), label: { type: "text", about: "the words on a jar's or the bottle's label (REÇEL, SALÇA, KEKİK, SOS by kind)" } },
    terms: ["a1-w-tuz", "a2-w-karabiber", "a1-w-biber", "a1-w-seker", "a1-w-recel", "a2-w-salca", "a2-w-kekik", "a1-w-tereyagi", "a2-w-yogurt", "a2-w-sos", "a1-w-limon"], tags: ["kitchen", "food"],
  } };

// ---- appliance: small kitchen machines; `on` lights a lamp or display -----------------------------

/** A lamp (x, y, r): dim, or lit and with its glow. */
const lamp = (x: number, y: number, r: number, on: boolean, lit: string, off = "#4A3A36"): [Shape, Shape[]] => [F(ellipse(x, y, r), on ? lit : off, 0.95), on ? [F(ellipse(x, y, r * 2.6), lit, 0.7)] : []];
const SMALL = (k: number, y = -8) => mul(translate(0, y), scale(k));
const APP: Record<string, Kind> = {
  toaster: { c: STEEL, ppcm: 8, f: (c, p) => {
    const on = !!p.on, body = S(rrect(-14, -15.2, 28, 15.2, 3.6), c), [lp, gl] = lamp(5.6, -5.4, 0.7, on, "#FF8A3A"), slice = (x: number, y: number) => [S(rrect(x, y - 6.6, 8.2, 6.8, [3.2, 3.2, 0, 0]), "#B8782E"), F(rrect(x + 0.8, y - 5.8, 6.6, 6, [2.6, 2.6, 0, 0]), "#EBC585")];
    return A([S(rrect(14, -10.4, 3, 2, 1), BLACK), S(rrect(-12.4, -1.2, 4, 1.2, 0.5), BLACK), S(rrect(8.4, -1.2, 4, 1.2, 0.5), BLACK), body, ...shade(body), S(rrect(-13.4, -17.8, 26.8, 5.2, 2.6), tone(c, "light")), S(rrect(-10.8, -16.8, 9.8, 2, 1), BLACK), S(rrect(1, -16.8, 9.8, 2, 1), BLACK), ...slice(-9.8, -15.8), ...slice(1.6, -15.2),
      S(ellipse(-8, -6.4, 2), BLACK), F(ellipse(-8, -6.4, 1.2), "#4B5058"), L([[-8, -6.4], [-8, -7.8]], WHITE, 0.3, 0.9), lp, S(rrect(-2.6, -4.7, 8.4, 0.5, 0.25), tone(c, "deep"))], 31, { cx: 1.5, glow: gl, m: translate(0, -7.5) });
  } },
  blender: { c: BLACK, ppcm: 8, f: (c, p) => {
    const on = !!p.on, base = S(rrect(-7.6, -10, 15.2, 10, [3, 3, 1.6, 1.6]), c), [lp, gl] = lamp(4.8, -3, 0.55, on, "#7FFF9A", "#2E4A36");
    return A([R([[6.3, -29], [9.8, -28], [9.8, -18], [5.8, -14.6]], c, 1.8), ...at(vessel([[4.6, 0, 0], [5, -1], [6.3, -20, 0]], "#E8587A", 0.65, { base: 1.2 }), 0, -10), F(rrect(-2.8, -11.8, 5.6, 0.7, 0.35), STEEL, 0.95), S(rrect(-6.4, -32.4, 12.8, 2.2, 0.8), c), S(rrect(-1.6, -35, 3.2, 2.6, 1), c), base, ...shade(base, 0.8), S(rrect(-7, -1.2, 14, 1.2, 0.5), tone(c, "shade")),
      S(ellipse(-1.2, -5.6, 2), STEEL), L([[-1.2, -5.6], [-1.2, -7.4]], BLACK, 0.4, 0.9), lp], 18.6, { cx: 1.5, glow: gl, m: translate(-9.8, 23) });
  } },
  kettle: { c: STEEL, ppcm: 9, f: (c, p) => {
    const on = !!p.on, [lp, gl] = lamp(0, -1.2, 0.9, on, "#4FB6FF", "#3A4A60");
    return A([R([[6.4, -21], [10.8, -18], [11, -8], [7.8, -6]], BLACK, 2.4), P([[-7.6, -12, 0], [-10.8, -17.6], [-9, -18.6], [-6.4, -15.8, 0]], c), ...lathe([[6.6, -2.4, 0], [7.8, -4], [8.2, -14], [6.6, -20], [4.4, -22.6, 0]], c), F(rrect(-5.6, -17.2, 1.3, 10.6, 0.6), "#8EC3D8", 0.85), ...lathe([[4.4, -22.6, 0], [3.8, -23.8], [0, -24.6, 0]], c), S(rrect(-1.1, -26.2, 2.2, 2.1, 0.8), BLACK), S(rrect(-6.8, -2.6, 13.6, 2.6, 1.2), BLACK), lp],
      24, { cx: 0.6, glow: gl, m: translate(-10.8, 13), ems: on ? [["steam", -10.6, -19.4, 1.6]] : [] });
  } },
  microwave: { c: "#E8E4DA", ppcm: 5, f: (c, p) => {
    const on = !!p.on, body = S(rrect(-22.5, -27, 45, 26, 2.6), c), win = rrect(-18.4, -23, 25, 18, 1.4), dial = ellipse(15.8, -7.2, 2.4);
    return A([S(rrect(-19, -1.4, 4.4, 1.4, 0.5), BLACK), S(rrect(14.6, -1.4, 4.4, 1.4, 0.5), BLACK), body, ...shade(body, 0.7), S(rrect(-20.4, -25, 29, 22, 1.8), tone(c, "shade")), S(win, on ? "#6B5A3A" : "#2B3036"), F(poly([[-18, -23], [-8, -23], [-14, -5], [-18, -5]]), WHITE, 0.12, win), F(poly([[-4, -23], [0, -23], [-6, -5], [-10, -5]]), WHITE, 0.07, win),
      S(rrect(11.4, -24.6, 9.8, 21.6, 1.2), tone(c, "shade")), S(rrect(12.4, -23.2, 7.8, 3.8, 0.6), "#16211B"), F(rrect(12.8, -22.8, 7, 3, 0.5), on ? "#7FE3C0" : "#24362D", 0.9), ...specks([14.2, 18.4].flatMap(x => [-17.6, -14.8, -12].map(y => [x, y] as Vec2)), 0.8, 0.8, STEEL, 0.95),
      S(dial, STEEL), F(ellipse(15.8, -7.2, 1.6), tone(STEEL, "deep"), 0.3), L([[15.8, -7.2], [15.8, -9.4]], BLACK, 0.4, 0.9), S(rrect(9.2, -21, 1.8, 12, 0.9), STEEL)], 45, { glow: on ? [F(win, "#FFD98A", 0.5), F(rrect(12.8, -22.8, 7, 3, 0.5), "#7FE3C0", 0.6)] : [], m: SMALL(0.5) });
  } },
  mixer: { c: "#C8283A", ppcm: 10, f: (c, p) => {
    const on = !!p.on, [lp, gl] = lamp(8.6, -10.2, 0.5, on, "#7FFF9A", "#2E4A36"), body = S(rrect(-10.6, -14, 21.6, 7.6, 3.6), c), bt = (dx: number) => [R([[dx, -6.6], [dx, -3.4]], WIRE, 0.8), loop([[dx, -4.8, 0], [dx - 2.4, -2.4], [dx, 0, 0], [dx + 2.4, -2.4]], WIRE, 0.4)];
    return A([S(holed(rrect(-5.4, -22, 13.2, 9.6, 4), [rrect(-2.8, -19.4, 8, 4.4, 2)]), c, { evenodd: true }), ...bt(-7.6), ...bt(-4.6), S(rrect(7.4, -6.6, 3.6, 6.6, 1.2), BLACK), body, ...shade(body, 0.8), S(rrect(-10.2, -7.6, 8.8, 1.4, 0.7), tone(c, "deep")), S(rrect(-9.4, -15.2, 3, 1.3, 0.6), tone(c, "light")), S(ellipse(5, -10.2, 1.3), WHITE), L([[5, -10.2], [5, -11.3]], INK, 0.3, 0.8), lp], 21.6, { glow: gl, m: translate(-1.2, 17.2) });
  } },
  tea_machine: { c: STEEL, ppcm: 5, f: (c, p) => {
    const on = !!p.on, [lp, gl] = lamp(8.6, -3.8, 0.9, on, "#FF5A3A", "#5A2A24"), base = S(rrect(-13.6, -8, 27.2, 8, 2.4), BLACK), up = lathe([[7.8, -29, 0], [8.8, -31], [8.8, -45, 0]], c);
    return A([R([[11.6, -23], [17, -21], [17.2, -11], [11.8, -9.4]], BLACK, 2), R([[8.6, -43], [13.6, -41.6], [13.8, -33], [8.8, -31.4]], BLACK, 1.8), P([[-11.4, -21, 0], [-15.2, -25.4], [-13.6, -26.6], [-10.8, -24.4, 0]], c), P([[-8.4, -40, 0], [-12, -44.4], [-10.4, -45.6], [-8, -43.4, 0]], c),
      base, ...shade(base, 0.8), ...lathe([[11, -7, 0], [12, -9], [12, -25, 0]], c), F(rrect(-0.9, -23.4, 1.8, 13, 0.9), "#8EC3D8", 0.85), ...lathe([[11.2, -25, 0], [11, -26.4], [6, -28.6], [0, -29.2, 0]], c), ...up, F(rect(-9, -37, 18, 3.2), "#C8283A", 0.85, up[0].path), ...lathe([[8, -45, 0], [7.4, -46.4], [3.6, -48], [0, -48.4, 0]], c),
      S(rrect(-0.9, -50.8, 1.8, 2.6, 0.7), BLACK), S(ellipse(-7, -4, 1.6), STEEL), L([[-7, -4], [-7, -5.4]], BLACK, 0.35, 0.9), lp], 32, { cx: 2.6, glow: gl, m: translate(-17, 16), ems: on ? [["steam", -15, -26.4, 2], ["steam", -11.4, -45.8, 2]] : [] });
  } },
  grinder: { c: "#C49A3C", ppcm: 11, f: c => {
    const body = lathe([[3.2, 0, 0], [3.4, -0.8], [3.2, -2.6], [3.2, -13.4], [3.9, -14.4], [3.9, -16.2, 0]], c), dk = tone(c, "deep");
    return A([...body, F(rect(-4, -2.9, 8, 0.5), dk, 0.5, body[0].path), F(rect(-4, -13.2, 8, 0.5), dk, 0.5, body[0].path), S(rrect(-2.5, -9.2, 5, 5.4, 0.6), tone(c, "shade")), S(ellipse(0, -6.5, 0.85), WOOD), ...lathe([[3.9, -16.2, 0], [3.3, -17.4], [1, -18.4], [0, -18.6, 0]], tone(c, "light")), S(rrect(-0.5, -21.4, 1, 3.2, 0.4), dk), R([[0, -21.8], [7, -21.8]], c, 1.3), S(rrect(6.2, -26.6, 1.7, 6.2, 0.85), WOOD), F(rect(6.4, -26, 0.4, 5), WHITE, 0.3)], 12, { cx: 2, m: translate(0, 9) });
  } },
  juicer: { c: "#5FA8A0", ppcm: 9, f: (c, p) => {
    const on = !!p.on, [lp, gl] = lamp(0, -3.6, 0.9, on, "#7FFF9A", "#2E4A36"), cone = P([[-3.8, -11, 0], [3.8, -11, 0], [2, -15.6], [0, -16.6], [-2, -15.6]], "#F4F1EA");
    return A([P([[-8.2, -7.8, 0], [-11.4, -6.4], [-10.6, -5.2], [-7.8, -5.6, 0]], c), ...lathe([[8, 0, 0], [9, -1.2], [8.4, -8], [6.6, -10.6, 0]], c), S(ellipse(0, -10.6, 6.6, 1.4), tone(c, "light")), S(ellipse(0, -10.7, 5.4, 1), tone(c, "deep")), cone, ...lines([-2.4, -1.2, 0, 1.2, 2.4].map(x => [[x, -11], [x * 0.5, -16.2]] as Vec2[]), tone("#F4F1EA", "deep"), 0.3, 0.5),
      P([[-5.2, -12.2, 0], [5.2, -12.2, 0], [4.4, -15.4], [2, -17.6], [-2, -17.6], [-4.4, -15.4]], "#F08A2A"), F(rect(-5.2, -12.6, 10.4, 0.8), "#F6E3B0", 0.9), F(ellipse(-2, -15.6, 1.6, 0.8), "#F8B85A", 0.7), S(rrect(7.6, -9.4, 1.6, 7, 0.8), tone(c, "shade")), lp], 22, { cx: -1, glow: gl, m: translate(0, -8) });
  } },
  water_heater: { c: "#EFEDE6", ppcm: 5, f: (c, p) => {
    const on = !!p.on, body = S(rrect(-15, -60, 30, 51, 4.5), c), win = rrect(-9.4, -54, 18.8, 13, 1.4), [lp, gl] = lamp(8.6, -12.6, 0.8, on, "#FF8A3A", "#6A5A52"), pipe = (x: number, k: string) => [S(rrect(x - 1.1, -9.4, 2.2, 9.4, 0.5), k), S(rrect(x - 1.8, -10.2, 3.6, 1.8, 0.6), tone(k, "deep"))], knob = (x: number) => [S(ellipse(x, -29, 3.6), tone(c, "shade")), F(ellipse(x, -29, 2.3), tone(c, "deep"), 0.25), L([[x, -29], [x, -32]], INK, 0.5, 0.8)];
    return A([S(rrect(-5.2, -69.6, 10.4, 10, 1.2), STEEL), S(rrect(-7, -62.4, 14, 2.6, 0.9), tone(STEEL, "light")), ...pipe(-8, "#3F74C4"), ...pipe(0, "#C8283A"), ...pipe(8, "#D9B53A"), body, ...shade(body, 0.8), S(rrect(-15.6, -60.8, 31.2, 3.4, 1.5), tone(c, "light")), S(win, on ? "#5A2E14" : "#1E2024"),
      ...(on ? [F(P([[-4.4, -42, 0], [-3.2, -47.4], [-1.2, -45], [0.6, -50.6], [3, -45.6], [5, -48], [5.4, -42, 0]], "#FFC24A").path, "#FFC24A", 0.95, win)] : []), F(poly([[-9, -54], [-2, -54], [-6.6, -41], [-9.4, -41]]), WHITE, 0.14, win), ...knob(-7.6), ...knob(7.6), S(rrect(-3.6, -37.6, 7.2, 1.6, 0.8), tone(c, "shade")), lp], 31, { glow: on ? [...gl, F(win, "#FFB066", 0.4)] : [], m: SMALL(0.35) });
  } },
  mini_oven: { c: "#3A3D45", ppcm: 8, f: (c, p) => {
    const on = !!p.on, body = S(rrect(-22.5, -27, 45, 25.4, 2.6), c), win = rrect(-18, -22.6, 25.6, 15.4, 1.4), [lp, gl] = lamp(16.2, -7, 0.7, on, "#FF8A3A"), knob = (y: number) => [S(ellipse(16.2, y, 2.6), STEEL), F(ellipse(16.2, y, 1.6), tone(STEEL, "deep"), 0.3), L([[16.2, y], [16.2, y - 2.1]], BLACK, 0.45, 0.9)];
    return A([S(rrect(-19, -1.8, 4.6, 1.8, 0.6), BLACK), S(rrect(14.4, -1.8, 4.6, 1.8, 0.6), BLACK), body, ...shade(body, 0.7), S(rrect(-20.4, -25, 30.4, 21, 1.8), tone(c, "shade")), S(win, on ? "#6B4222" : "#23262B"), ...lines([-9.4, -13.6].map(y => [[-18, y], [7.6, y]] as Vec2[]), on ? "#FF8A3A" : STEEL, 0.5, on ? 0.95 : 0.6, win),
      F(poly([[-17.6, -22.6], [-8, -22.6], [-13.6, -7.2], [-17.6, -7.2]]), WHITE, 0.12, win), S(rrect(-13, -5.4, 18, 1.5, 0.75), STEEL), S(rrect(11.6, -24.6, 9.2, 21.6, 1.2), tone(c, "light")), ...knob(-19.6), ...knob(-12.4), lp], 45, { glow: on ? [F(win, "#FFB066", 0.45), ...gl] : [], m: SMALL(0.55) });
  } },
};
const appliance: PieceDef = { draw: gen("appliance", APP, "toaster"), variants: variants(Object.keys(APP)),
  meta: {
    about: "A small kitchen machine: a toaster with toast, a blender, an electric kettle, a microwave, a hand mixer, an electric çay machine (two stacked pots), a brass hand coffee grinder, a citrus juicer, a gas water heater (şofben) or a countertop mini oven. `on` lights its lamp or display (not the grinder's).",
    params: { kind: KIND(Object.keys(APP)), n: N(24), on: { type: "bool", default: false, about: "its lamp or display is lit (and glows at night); the kettle and the çay machine steam; the heater and the oven glow in their windows" }, color: COLOR("the body's colour (a palette id or a hex); default by kind") },
    terms: ["a1-w-cay", "a1-w-kahve", "a1-w-caydanlik", "b1-w-sofben", "a1-w-firin"], tags: ["kitchen", "appliance"],
  } };

// ---- stove: things that burn; `lit` (default true) adds glow, flame, smoke and steam ----------------

/** The affine that turns a held thing about its grip `g` until its foot `f` hangs `drop` cm below it (a hanging hand grips about 46 cm above the floor), out to the side `dir`; the grip becomes the origin. */
const tiltM = (g: Vec2, f: Vec2, dir = -1, drop = 46): Affine => { const dx = f[0] - g[0], dy = f[1] - g[1], d = Math.hypot(dx, dy), y = Math.min(drop, d); return mul(rotate(Math.atan2(y, dir * Math.sqrt(d * d - y * y)) - Math.atan2(dy, dx)), translate(-g[0], -g[1])); };
const EMBER = "#FF7A2A", BLUE = "#6FA8FF";
/** The çaydanlık: a kettle with a teapot on it, its foot at (0, 0), 19 cm across, 25 cm high. */
const caydanlik = (c: string): Shape[] => [R([[8.8, -8], [12.6, -6], [12.8, -2.4], [9.6, -1.6]], BLACK, 1.4), R([[5.8, -19], [9, -18], [9, -14], [6.2, -13]], BLACK, 1.1), P([[-9.2, -5.4, 0], [-13, -9.6], [-11.6, -10.6], [-8.8, -8.4, 0]], c), P([[-5.6, -16, 0], [-8.8, -20.6], [-7.4, -21.6], [-5, -19, 0]], c),
  ...lathe([[8.6, 0, 0], [9.6, -1.4], [9.2, -9, 0]], c), ...lathe([[9, -9, 0], [7.2, -11], [0, -12, 0]], c), ...at(lathe([[5.4, 0, 0], [6.2, -1], [6, -8, 0]], c), 0, -12), ...at(lathe([[5.6, -8, 0], [4.8, -9.6], [0, -10.4, 0]], c), 0, -12), S(rrect(-0.9, -24.8, 1.8, 2.4, 0.6), BLACK)];
/** A split log lying on its side, `len` × `t`, its foot at (x, y): bark or a cut face, its ends pale with a growth ring. */
function logSide(x: number, y: number, len: number, t: number, col: string, bark: boolean): Shape[] {
  const body = S(rrect(x - len / 2, y - t, len, t, t * 0.4), bark ? "#7A5636" : col), cy = y - t / 2, e = (dx: number, c: string) => [S(ellipse(x + dx, cy, t * 0.2, t * 0.47), c), { path: ellipse(x + dx, cy, t * 0.1, t * 0.24), stroke: { color: tone(col, "deep"), width: 0.22 }, flat: true, opacity: 0.55 } as Shape];
  return [body, ...lit(body, x - len / 2, x + len / 2, 0.8), ...(bark ? lines([[[x - len * 0.3, y - t * 0.7], [x - len * 0.27, y - t * 0.3]], [[x - len * 0.05, y - t * 0.8], [x - len * 0.02, y - t * 0.4]], [[x + len * 0.2, y - t * 0.7], [x + len * 0.23, y - t * 0.35]]], tone("#7A5636", "deep"), 0.4, 0.6) : [F(rrect(x - len / 2 + t * 0.3, y - t + 0.8, len - t * 0.6, t * 0.18, t * 0.09), WHITE, 0.25)]), ...e(-len / 2 + t * 0.14, tone(col, "light")), ...e(len / 2 - t * 0.14, col)];
}
const STV: Record<string, Kind> = {
  mangal: { c: "#3A3D45", ppcm: 5, f: (c, p) => {
    const lit = p.lit !== false, dark = tone(c, "deep"), front = P([[-30, -30, 0], [30, -30, 0], [28, -17, 0], [-28, -17, 0]], c), coal = rrect(-27.2, -36.4, 54.4, 4.8, 0.8), kofte = xs(6, 9.2), dots = Array.from({ length: 30 }, (_, i) => [-26 + (i * 1.83) % 52, -35.6 + ((i * 7) % 5) * 0.8] as Vec2);
    return A([R([[-21, -20], [-23, -2]], dark, 1.4), R([[21, -20], [23, -2]], dark, 1.4), front, ...shade(front, 0.8), S(rrect(-30.4, -38, 60.8, 8.2, 1.4), tone(c, "light")), S(rrect(-28.6, -37.2, 57.2, 6.4, 1), "#1E1F23"), F(coal, lit ? "#E8571E" : "#34353B", 0.96),
      ...specks(dots, 0.9, 0.45, lit ? "#FFB347" : "#6B6D72", 0.9), ...lines(xs(22, 2.55).map(x => [[x, -37.4], [x, -31]] as Vec2[]), "#A9AFB5", 0.45, 0.95),
      ...kofte.flatMap(x => [S(ellipse(x, -35, 4.5, 1.7), "#8A4B2B"), F(ellipse(x - 1.2, -35.6, 2.4, 0.5), "#B9794A", 0.7), ...lines([[[x - 2, -36], [x - 1.6, -34]], [[x + 0.4, -36.2], [x + 0.8, -34]], [[x + 2.6, -36], [x + 3, -34.2]]], "#4A2614", 0.4, 0.6)]),
      R([[-24, -17], [-27.4, 0]], dark, 1.9), R([[24, -17], [27.4, 0]], dark, 1.9), F(rrect(-6, -25, 12, 3, 1.2), BLACK, 0.8), S(rrect(30, -28.6, 5, 2, 1), STEEL), S(rrect(-35, -28.6, 5, 2, 1), STEEL)], 70, { fire: true, glow: lit ? [F(rrect(-27, -33.2, 54, 1.8, 0.8), EMBER, 0.9), ...specks(kofte.map(x => [x + 4.6, -33.8] as Vec2), 1.4, 0.8, "#FFB347", 0.8)] : [], ems: lit ? kofte.filter((_, i) => i % 2).map(x => ["smoke", x, -37, 3] as Em) : [], m: SMALL(0.4) });
  } },
  semaver: { c: "#C9A24A", ppcm: 5.5, f: (c, p) => {
    const lit = p.lit !== false, body = lathe([[7.5, -3, 0], [9, -4.5], [13.4, -12], [14.4, -22], [12.6, -31], [9.4, -35], [8.4, -37, 0]], c), pot = tone(c, "light"), vent = rrect(-5, -2.6, 10, 1.4, 0.6);
    return A([R([[12.8, -31], [17.8, -30.6], [18, -26], [14, -23.6]], BLACK, 1.3), R([[-12.8, -31], [-17.8, -30.6], [-18, -26], [-14, -23.6]], BLACK, 1.3), P([[-5, -47, 0], [-8.6, -51.6], [-7, -52.4], [-4.6, -50, 0]], pot), R([[4.8, -49.6], [8.6, -48.4], [8.8, -45], [5.2, -44.4]], BLACK, 1.1),
      S(rrect(-10.4, -3.2, 20.8, 3.2, 1), tone(c, "deep")), ...body, F(rrect(-14.5, -23.4, 29, 2.6, 0.8), tone(c, "deep"), 0.4, body[0].path), ...lathe([[8.4, -37, 0], [7, -38.4], [6.6, -40.2, 0]], c), ...lathe([[7.6, -40, 0], [7.2, -41.2], [3, -43.2], [0, -43.6, 0]], c),
      ...at(lathe([[4, 0, 0], [5.4, -1.2], [5.6, -6.6, 0]], pot), 0, -43.4), ...lathe([[4.8, -50, 0], [4.4, -51.2], [2, -52.8], [0, -53.1, 0]], pot), S(rrect(-0.8, -55.2, 1.6, 2.4, 0.6), BLACK),
      R([[13.6, -12], [17.6, -11.8]], c, 1.4), S(rrect(16.6, -14.6, 2.4, 5.6, 0.8), c), R([[17.8, -14.4], [20.8, -16.4]], BLACK, 1), F(vent, lit ? EMBER : "#2E2F35", 0.95)], 42, { cx: 1.2, fire: true, glow: lit ? [F(vent, EMBER, 0.9)] : [], ems: lit ? [["steam", 0, -55.6, 3], ["steam", -8.2, -52.8, 2]] : [], m: SMALL(0.45) });
  } },
  soba: { c: "#2B2C31", ppcm: 4, f: (c, p) => {
    const lit = p.lit !== false, body = S(rrect(-19, -52, 38, 46, [4, 4, 2, 2]), c), win = rrect(-8, -39, 16, 12, 1.6), pipe = S(rect(2.8, -96, 10.4, 44), "#3A3D45"), slots = xs(5, 3).map(x => rrect(x - 0.5, -13.4, 1, 4.4, 0.4));
    const kt = at([P([[-7.4, -6, 0], [-11.8, -11.4], [-10, -12.4], [-6.4, -9, 0]], STEEL), R([[-4, -12.4], [-1, -17.6], [5, -17.6], [8, -11]], BLACK, 1.1), ...lathe([[7.4, 0, 0], [8.6, -1.4], [8.4, -9], [5, -12.4], [0, -13.2, 0]], STEEL), S(ellipse(0, -14, 1.3, 1), BLACK)], -6, -54);
    return A([S(rrect(-15, -6.4, 4, 6.4, 0.6), BLACK), S(rrect(11, -6.4, 4, 6.4, 0.6), BLACK), pipe, ...shade(pipe, 0.8), S(rrect(2, -72, 12, 2.2, 0.8), tone(c, "light")), S(ellipse(8, -96, 5.2, 1.2), "#1E1F23"), body, ...shade(body, 0.8), S(rrect(-20.4, -54.8, 40.8, 3.4, 1.4), tone(c, "light")), S(rrect(-13.6, -46.4, 27.2, 30, 2), tone(c, "light")),
      S(win, lit ? "#7A3A12" : "#16171A"), ...(lit ? [F(P([[-5, -27.6, 0], [-3.4, -33], [-1.2, -30.4], [0.6, -36], [3, -31], [5.2, -33.6], [5.6, -27.6, 0]], "#FFC24A").path, "#FFC24A", 0.9, win)] : []), S(rrect(11.6, -37, 3.4, 8, 1.4), STEEL), S(rrect(-9, -14.4, 18, 6.4, 1.4), tone(c, "light")), ...many(xs(5, 3).map(x => [x - 0.5, -13.4] as Vec2), (x, y) => rrect(x, y, 1, 4.4, 0.4), lit ? EMBER : "#16171A", { flat: true, opacity: 0.9 }), ...kt],
    40, { fire: true, glow: lit ? [F(win, EMBER, 0.85), ...slots.map(s => F(s, EMBER, 0.9))] : [], ems: lit ? [["smoke", 8, -97, 4], ["steam", -17.8, -65.4, 2]] : [], m: SMALL(0.3) });
  } },
  tup: { c: "#2D6DB5", ppcm: 6, f: c => {
    const body = lathe([[13.4, -2.4, 0], [15, -4], [15.2, -40], [14.6, -46], [11, -51.6], [7, -54.2], [5.6, -55, 0]], c);
    return A([S(rrect(-13.6, -3.2, 27.2, 3.2, 0.8), tone(c, "deep")), ...body, F(rect(-15.4, -36, 30.8, 12), "#F4F1EA", 0.92, body[0].path), F(rect(-15.4, -24, 30.8, 1.4), "#F2C230", 0.9, body[0].path), F(poly([[0, -35], [3, -30], [0, -25], [-3, -30]]), "#E2553A", 0.9), S(rrect(-8.6, -60, 2.2, 6.6, 0.8), tone(c, "deep")), S(rrect(6.4, -60, 2.2, 6.6, 0.8), tone(c, "deep")), S(rrect(-9, -61.6, 18, 2.4, 1.2), tone(c, "deep")),
      S(rrect(-2.4, -60, 4.8, 5.6, 1), GOLD), S(rrect(2.4, -58.6, 3.4, 1.8, 0.6), GOLD), L([[-12, -42], [-12, -30]], WHITE, 0.6, 0.35)], 31, { m: tiltM([0, -57], [0, -1], -1, 29) });
  } },
  camp_stove: { c: "#C8283A", ppcm: 10, f: (c, p) => {
    const lit = p.lit !== false, body = S(rrect(-14, -8.6, 28, 8.6, 2.4), c);
    return A([body, ...shade(body), L([[-14, -6.4], [14, -6.4]], tone(c, "deep"), 0.5, 0.6), S(ellipse(10, -4.4, 1.5), BLACK), R([[-3.6, -12], [-9.2, -14.2]], tone(STEEL, "shade"), 1.1), R([[3.6, -12], [9.2, -14.2]], tone(STEEL, "shade"), 1.1), S(rrect(-11.4, -15.2, 4, 1, 0.4), STEEL), S(rrect(7.4, -15.2, 4, 1, 0.4), STEEL),
      S(rrect(-2.2, -11.4, 4.4, 3.2, 0.8), STEEL), S(ellipse(0, -11.8, 4.6, 1.15), "#8E959C"), S(ellipse(0, -11.9, 3.2, 0.7), "#4B5058"), ...(lit ? [F(ellipse(0, -12.1, 3.6, 0.75), BLUE, 0.95), F(ellipse(0, -12.2, 2.4, 0.45), "#CFE6FF", 0.9)] : []),
      ...at([...lathe([[3.8, 0, 0], [3.8, -9.6], [2.6, -11.6], [1.2, -12.2, 0]], "#4C8F5A"), F(rect(-3.8, -6.4, 7.6, 2.4), "#F2C230", 0.9), S(rrect(-0.9, -14.2, 1.8, 2.2, 0.4), STEEL)], 19.4, 0)], 37.4, { cx: 4.6, fire: true, glow: lit ? [F(ellipse(0, -12.4, 5, 1.5), BLUE, 0.8)] : [], ems: lit ? [["flame", 0, -12.8, 2.6]] : [], m: translate(0, -8) });
  } },
  ocak: { c: "#C9CFD4", ppcm: 6, f: (c, p) => {
    const lit = p.lit !== false, body = S(rrect(-28, -12, 56, 12, 2), c), burner = (x: number) => [S(ellipse(x, -13.4, 5.2, 1.1), "#8E959C"), S(ellipse(x, -13.5, 3.6, 0.7), "#4B5058"), ...(lit ? [F(ellipse(x, -13.7, 4, 0.8), BLUE, 0.95), F(ellipse(x, -13.8, 2.6, 0.5), "#CFE6FF", 0.9)] : [])], grate = (x: number) => [R([[x - 8, -13.4], [x - 8, -16]], BLACK, 0.8), R([[x + 8, -13.4], [x + 8, -16]], BLACK, 0.8), S(rrect(x - 9, -17, 18, 1.2, 0.5), BLACK)];
    return A([S(rrect(-25, -1.2, 5, 1.2, 0.5), BLACK), S(rrect(20, -1.2, 5, 1.2, 0.5), BLACK), body, ...shade(body, 0.7), S(rrect(-28.4, -15, 56.8, 3.2, 1.2), tone(c, "light")), F(rrect(-18, -9.6, 36, 7.2, 1), tone(c, "shade"), 0.5), ...burner(-14), ...burner(14), ...grate(-14), ...grate(14), ...at(caydanlik(STEEL), -14, -17.8),
      S(ellipse(-14, -5.6, 2.4), BLACK), S(ellipse(14, -5.6, 2.4), BLACK), L([[-14, -5.6], [-14, -7.6]], WHITE, 0.4, 0.9), L([[14, -5.6], [14, -7.6]], WHITE, 0.4, 0.9)], 58, { fire: true, glow: lit ? [F(ellipse(14, -14, 5.5, 1.6), BLUE, 0.8), F(ellipse(-14, -14, 5.5, 1.6), BLUE, 0.8)] : [], ems: lit ? [["flame", 14, -14.2, 2.8], ["steam", -14, -43, 2.4], ["steam", -22.4, -39.4, 1.6]] : [], m: SMALL(0.45) });
  } },
  firewood: { c: "#C8935B", ppcm: 7, f: (c, p, r) => {
    const total = p.held ? 3 : Math.max(3, Math.min(24, Math.round(num(p.logs, 9)))), b = Math.ceil((Math.sqrt(8 * total + 1) - 1) / 2), pal = [c, tone(c, "shade"), mix(c, "#E3BE86", 0.5), mix(c, "#8A5A33", 0.4)], sh: Shape[] = [];
    for (let j = 0, left = total; left > 0; j++) { const m = Math.min(b - j, left); for (let i = 0; i < m; i++) sh.push(...logSide((i - (m - 1) / 2) * 24.6 + r.range(-1.2, 1.2), -j * 8, r.range(21, 24.4), r.range(7.2, 8.6), r.pick(pal), r.chance(0.55))); left -= m; }
    return A(sh, b * 24.6 + 2, { m: translate(0, -8) });
  } },
  campfire: { c: "#7A5636", ppcm: 8, f: (c, p) => {
    const lit = p.lit !== false, st = Array.from({ length: 9 }, (_, i) => [Math.cos(i * 0.698) * 14, Math.sin(i * 0.698) * 3.4 - 2.6, 3.6 + (i % 3) * 0.5] as [number, number, number]).sort((a, b) => a[1] - b[1]), grey = ["#8E959C", "#7C838A", "#A3A9AF"];
    const stone = (q: [number, number, number], i: number) => S(ellipse(q[0], q[1], q[2] * 1.15, q[2] * 0.8), grey[i % 3]), bar = (x: number, y: number, len: number, a: number) => mv(logSide(x, y + 2.2, len, 4.4, c, true), mul(translate(x, y), mul(rotate(a), translate(-x, -y))));
    return A([...st.filter(q => q[1] < -2.6).map(stone), F(ellipse(0, -3.4, 9, 2), lit ? "#E8571E" : "#34353B", 0.95), ...bar(-4.2, -7.6, 22, -0.62), ...bar(4.2, -7.6, 22, 0.62), ...bar(0, -4.8, 19, 0.06), ...st.filter(q => q[1] >= -2.6).map((q, i) => stone(q, i + 1))], 34, { fire: true, glow: lit ? [F(ellipse(0, -5, 10, 5), EMBER, 0.7)] : [], ems: lit ? [["flame", 0, -7.4, 5], ["flame", -5, -6, 3.4], ["flame", 5, -6, 3.4], ["smoke", 0, -20, 4]] : [], m: SMALL(0.3) });
  } },
};
const stove: PieceDef = { draw: gen("stove", STV, "mangal"), variants: variants(Object.keys(STV)),
  meta: {
    about: "Things that cook or heat: a charcoal mangal with köfte and smoke, a tall semaver with its teapot, a black wood stove (soba) with its flue and kettle, a gas cylinder (tüp), a one-burner camp stove, a two-burner çay ocağı with a kettle, a pile of split firewood (odun) or a campfire in a ring of stones.",
    params: { kind: KIND(Object.keys(STV)), n: N(24, "how many, side by side (firewood: piles)"), lit: { type: "bool", default: true, about: "it burns: glow, flame, smoke or steam (not the cylinder or the firewood)" }, logs: { type: "int", min: 3, max: 24, default: 9, about: "firewood: logs in a pile" }, color: COLOR("the body's colour (a palette id or a hex); default by kind") },
    terms: ["a1-w-izgara", "a1-w-odun", "b1-w-dogal-gaz", "a1-w-cay", "a1-w-ates", "a2-w-kamp-atesi"], tags: ["kitchen", "fire", "stove"],
  } };

export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { pan, utensil, cup, bottle, condiment, appliance, stove };
