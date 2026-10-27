// Props of the tech family (STYLE.md): gadgets, household machines and hardware. Units cm; each flat's origin is its bottom
// centre; held (`held`), a prop is drawn as people carry it, its origin at the grip. Words are `text` on
// the first flat, never letters in the art.

import { smooth, ellipse, rect, rrect, poly, tone, mix, mul, rotate, translate, scale, apply, groupBounds, arcPoints, type Affine, type EmitSpec, type FlatSpec, type ParamSpec, type PieceDef, type Shape, type Path, type TextSpec, type Vec2, type Rng } from "sahne";
import { S, P, L, num, str, hex, holed } from "./draw.ts";

type Rec = Record<string, unknown>;
/** What a kind is drawn with: its colour, whether it is on, held, the params, the stream. */
interface Ctx { c: string; on: boolean; held: boolean; p: Rec; r: Rng }
/** A kind's drawing: shapes, what glows, words, particles (y down like the art), its grip and how it is held (scaled, turned). */
interface Dr { sh: Shape[]; glow?: Shape[]; text?: TextSpec[]; emit?: EmitSpec[]; g?: Vec2; hs?: number; hr?: number; e?: number; k?: number | Vec2; live?: { sh: Shape[]; at: Vec2; rot: number; ms: number }[] }
type Kd = (x: Ctx) => Dr;

const DARK = "#2E2F35", INK = "#1E1F23", STEEL = "#B8BEC4", GREY = "#8E959C", WHITE = "#F2F0EA", RED = "#C8283A", BRASS = "#D9A72E", GLASS = "#BFD9E8";

// ---- helpers ------------------------------------------------------------------------------------------

/** Paint printed on the paper (flat), cut to `clip`. */
const F = (path: Path, fill: string, op = 1, clip?: Path): Shape => ({ path, fill, flat: true, opacity: op, ...(clip ? { clip } : {}) });
/** A cut strand: a cable, a stem, a rod. */
const R = (pts: Vec2[], color: string, width: number, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width, cap: "round", join: "round" }, ...o });
/** A rounded box, a circle (`rx`, else `ry`), and the same printed. */
const B = (x: number, y: number, w: number, h: number, r: number, c: string, o: Partial<Shape> = {}) => S(rrect(x, y, w, h, r), c, o);
const E = (x: number, y: number, rx: number, c: string, ry = rx, o: Partial<Shape> = {}) => S(ellipse(x, y, rx, ry), c, o);
const Fb = (x: number, y: number, w: number, h: number, r: number, c: string, op = 1) => F(rrect(x, y, w, h, r), c, op);
const Fe = (x: number, y: number, rx: number, c: string, op = 1, ry = rx) => F(ellipse(x, y, rx, ry), c, op);
const Fl = (x: number, y: number, w: number, h: number, c: string, op = 1) => F(rect(x, y, w, h), c, op);
/** Light from the upper left on an outline: shade down the right, a sheen down the left. */
const sd = (o: Path, c: string, k = 0.2): Shape[] => { const [x0, y0, x1, y1] = o.bounds(), w = x1 - x0; return [F(rect(x1 - w * k, y0 - 0.05, w * k + 0.05, y1 - y0 + 0.1), tone(c, "shade"), 0.5, o), F(rect(x0 - 0.05, y0 - 0.05, w * 0.09 + 0.05, y1 - y0 + 0.1), tone(c, "light"), 0.4, o)]; };
/** A lit body: the outline, then its shading. */
const K = (o: Path, c: string, k = 0.2): Shape[] => [S(o, c), ...sd(o, c, k)];
const Kb = (x: number, y: number, w: number, h: number, r: number, c: string, k = 0.2) => K(rrect(x, y, w, h, r), c, k);
const Ke = (x: number, y: number, rx: number, c: string, ry = rx, k = 0.2) => K(ellipse(x, y, rx, ry), c, k);
/** A printed repeat over `o`. */
const tiled = (o: Path, w: number, h: number, shapes: Shape[], op = 1): Shape => ({ path: o, tile: { w, h, shapes }, flat: true, opacity: op });
const T = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
const cnt = (v: unknown) => Math.max(1, Math.min(24, Math.round(num(v, 1))));
/** A drawing moved by an affine of scale `s` (words and particles keep their square). */
const mvDr = (d: Dr, m: Affine, s: number): Dr => ({
  sh: T(d.sh, m), glow: d.glow && T(d.glow, m),
  text: d.text?.map(t => { const [x, y] = apply(m, t.x, t.y); return { ...t, x, y, w: t.w * s, h: t.h * s, ...(t.size ? { size: t.size * s } : {}) }; }),
  emit: d.emit?.map(e => { const [x, y] = apply(m, e.x, e.y); return { ...e, x, y, ...(e.w ? { w: e.w * s } : {}) }; }),
});
/** A drawing at its real size: shapes, words and its grip scaled by `k` (strokes keep their width). */
const sized = (d: Dr): Dr => { if (!d.k) return d; const [a, b] = typeof d.k === "number" ? [d.k, d.k] : d.k; return { ...mvDr(d, scale(a, b), a), g: d.g && [d.g[0] * a, d.g[1] * b], hs: d.hs, hr: d.hr, e: d.e, live: d.live }; };
/** The longer side of shapes' bounds (cm). */
const span = (sh: Shape[]) => { if (!sh.length) return 0; const [a, b, c, e] = groupBounds({ shapes: sh, edge: 0.3 }); return Math.max(c - a, e - b); };

/**
 * A generator of kinds: `kinds` maps each kind to its drawing and default colour. `n` of them side by side (a row
 * the width of the first one); held, one, moved so its grip is the origin (scaled and turned if the kind says).
 */
function mk(id: string, kinds: Record<string, [Kd, string]>, on0: boolean, m: { about: string; on: string; terms: string[]; tags: string[]; params?: Record<string, ParamSpec> }): PieceDef {
  const names = Object.keys(kinds);
  return {
    draw(p, r) {
      const k = typeof p.kind === "string" && Object.hasOwn(kinds, p.kind) ? p.kind : names[0], [kd, cd] = kinds[k], held = !!p.held, n = held ? 1 : cnt(p.n);
      const x: Ctx = { c: hex(p.color, cd), on: p.on === undefined ? on0 : !!p.on, held, p, r }, ds = Array.from({ length: n }, () => sized(kd(x)));
      const [x0, , x1] = groupBounds({ shapes: ds[0].sh, edge: 0.3 }), step = (x1 - x0) * 1.08 + 0.2, sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [], emit: EmitSpec[] = [];
      let one = 1;
      const dxs = ds.map((_, i) => (i - (n - 1) / 2) * step - (n > 1 ? (x0 + x1) / 2 : 0));
      ds.forEach((d, i) => {
        const g = d.g ?? [0, 0], s = held ? d.hs ?? 1 : 1, t = mvDr(d, held ? mul(scale(s), mul(rotate(d.hr ?? 0), translate(-g[0], -g[1]))) : translate(dxs[i], 0), s);
        if (!i) one = Math.max(1, span(t.sh));
        sh.push(...t.sh); glow.push(...(t.glow ?? [])); text.push(...(t.text ?? [])); emit.push(...(t.emit ?? []));
      });
      const edge = ds[0].e ?? Math.min(0.4, Math.max(0.08, one / 80)), ppcm = Math.min(14, 400 / one, 1900 / Math.max(1, span(sh), span(glow)));
      return {
        flats: [{ group: { shapes: sh, edge }, ppcm, id, ...(held ? {} : { shadow: "drop" as const }), ...(glow.length ? { emissive: { shapes: glow, edge: 0 } } : {}), ...(text.length ? { text } : {}) },
          ...(held ? [] : ds.flatMap((d, i) => (d.live ?? []).map((l): FlatSpec => ({ group: { shapes: T(l.sh, translate(-l.at[0], -l.at[1])), edge }, ppcm, id, x: dxs[i] + l.at[0], y: -l.at[1], z: 0.3, move: { sway: { rot: l.rot, ms: l.ms }, phase: r() } }))))],
        ...(emit.length ? { emitters: emit.map(q => ({ ...q, y: -q.y })) } : {}),
      };
    },
    variants: Object.fromEntries(names.map(k => [k, { kind: k, ...(k === "torch" || k === "bulb" ? { on: true } : {}) }])),
    meta: {
      about: m.about,
      params: {
        kind: { type: "enum", values: names, default: names[0] },
        n: { type: "int", min: 1, max: 24, default: 1, about: "how many, side by side" },
        color: { type: "color", about: "its main colour (a palette id or a hex); the default depends on the kind" },
        on: { type: "bool", default: on0, about: m.on },
        ...m.params,
      },
      terms: m.terms, tags: m.tags,
    },
  };
}

// ---- gadgets ----------------------------------------------------------------------------------------------

const APPS = ["#F2C230", "#D9534A", "#3E8E4E", "#F4F1EA", "#7B4FB3", "#3F74C4"];
/** Words on a screen: a box in the art. */
const scrText = (t: string, x: number, y: number, w: number, h: number, size: number): TextSpec[] => t ? [{ text: t, x, y, w, h, size, font: "screen", color: "#F4F1EA", lit: 0, align: "left" }] : [];

const GADGET: Record<string, [Kd, string]> = {
  laptop: [({ c, on, held, p }) => {
    if (held) { const o = rrect(-16.5, -23, 33, 23, 1.6); return { sh: [S(o, c), ...sd(o, c), F(rect(-16.6, -2.2, 33.2, 2.4), "#23262C", 0.85, o), F(rect(-16.6, -3.2, 33.2, 0.5), tone(c, "shade"), 0.5, o), Fe(0, -12, 2.2, tone(c, "light"), 0.7), Fe(0, -12, 1.2, c, 0.8)], g: [0, -2] }; }
    const say = str(p.screen, "").trim(), sc = rect(-15, -24.6, 30, 19.4), sh = [B(-16.5, -26.4, 33, 23, 1.4, "#23262C"), S(sc, on ? "#2C6E8E" : "#1C1F25"), E(0, -25.5, 0.4, "#3A3D45")];
    if (on && !say) sh.push(F(poly([[-15, -5.2], [-15, -17], [8, -24.6], [15, -24.6], [15, -5.2]]), "#3E8DAE", 0.8, sc), Fb(-11, -21, 12, 8, 0.5, "#F4F1EA", 0.9), Fl(-11, -21, 12, 1.6, "#4F6E9E", 0.9), Fb(2.5, -18, 9, 6, 0.5, "#F4F1EA", 0.85), Fl(-15, -7, 30, 1.8, "#1E2B4A", 0.75));
    sh.push(S(poly([[-18, 0], [18, 0], [16, -4.4], [-16, -4.4]]), c), Fl(-18, -0.9, 36, 0.9, tone(c, "shade"), 0.6), tiled(rect(-14.5, -3.8, 29, 2.2), 2.2, 1.1, [S(rrect(0.15, 0.15, 1.9, 0.75, 0.25), tone(c, "shade"))], 0.8), Fb(-3, -2.3, 6, 1.3, 0.3, tone(c, "light"), 0.8));
    return { sh, glow: on ? [F(sc, "#BFE3F2", 0.45)] : [], text: on ? scrText(say, -14.2, -23.8, 28.4, 17.6, 1.7) : [] };
  }, "#C3C8CE"],
  tablet: [({ c, on, held, p }) => {
    const say = str(p.screen, "").trim(), sc = rrect(-7.4, -22.4, 14.8, 19.8, 0.6), sh = [...(held ? [] : [R([[2.5, -8], [5.8, -0.4]], tone(c, "shade"), 1.1)]), ...Kb(-8.6, -24.6, 17.2, 24.6, 1.6, c), S(sc, on ? "#3E7FA6" : "#1C1F25"), E(0, -23.6, 0.35, "#3A3D45"), Fe(0, -1.3, 0.6, tone(c, "light"), 0.5)];
    if (on && !say) for (let i = 0; i < 12; i++) sh.push(Fb(-6 + (i % 3) * 4.2, -20.6 + Math.floor(i / 3) * 4.4, 3.2, 3.2, 0.8, APPS[(i * 5) % 6], 0.95));
    return { sh, glow: on ? [F(sc, "#CFE6F7", 0.45)] : [], text: on ? scrText(say, -6.8, -21.8, 13.6, 18.4, 1.5) : [], g: [0, -3] };
  }, "#3A3D45"],
  headphones: [({ c }) => {
    const sd2 = (d: number) => [B(d * 6.1 - 1.2, -10, 2.4, 9, 1.2, INK), ...Kb(d * 8.6 - 2.4, -11, 4.8, 11, 2.2, c, 0.3), Fe(d * 8.8, -5.5, 1.3, tone(c, "light"), 0.5, 2.3)];
    return { sh: [R([[-8.6, -14], [-8.3, -18], [-4.5, -20.8], [0, -21.4], [4.5, -20.8], [8.3, -18], [8.6, -14]], c, 1.9), R([[-8.6, -14], [-8.6, -10.5]], tone(c, "deep"), 1.2), R([[8.6, -14], [8.6, -10.5]], tone(c, "deep"), 1.2), ...sd2(-1), ...sd2(1), R([[-6.4, -16.5], [-3.5, -19], [0, -19.8], [3.5, -19], [6.4, -16.5]], INK, 1.4)], g: [0, -14], k: 0.85 };
  }, "#C4553A"],
  earbuds: [({ c, on }) => {
    const bud = (d: number, h: number) => [...Kb(d - 0.34, h, 0.68, -4.6 - h, 0.34, "#F4F1EA", 0.3), E(d, -5, 1.1, "#F4F1EA", 1.3), Fl(d - 1.1, -5.4, 2.2, 0.2, tone(c, "shade"), 0.5)];
    return { sh: [S(poly([[-0.8, -4.4], [3.3, -4.4], [5.4, -9.6], [2, -10.6]]), mix(c, STEEL, 0.3)), F(poly([[0.2, -5.4], [2.8, -5.4], [4.6, -9.8], [2.4, -10.4]]), tone(c, "deep"), 0.25), ...bud(-1.5, -8.4), ...bud(0.9, -9.3), ...Kb(-3.3, -4.4, 6.6, 4.4, 1.6, c), Fl(-3.3, -4.4, 6.6, 0.25, tone(c, "shade"), 0.7), E(0, -1.7, 0.28, on ? "#7FE3C0" : GREY)], glow: on ? [Fe(0, -1.7, 0.9, "#7FE3C0", 0.6)] : [], g: [0, 7.5] };
  }, WHITE],
  charger: [({ c, held }) => {
    const pin = (x: number, y: number) => S(rect(x, y, 2.5, 0.8), STEEL);
    if (held) return { sh: [R([[0, 0], [0.2, 3], [1.8, 6.5], [0.3, 10], [-0.8, 12.5]], c, 0.5), ...Kb(-1.2, 12, 2.4, 3.4, 0.6, STEEL), Fl(-0.5, 14.6, 1, 0.8, INK, 0.8), S(rect(-1.3, -8, 0.8, 2.6), STEEL), S(rect(0.5, -8, 0.8, 2.6), STEEL), ...Kb(-2.4, -5.2, 4.8, 5.2, 0.9, c)], g: [0, 5] };
    return { sh: [pin(-14, -4.2), pin(-14, -2), ...Kb(-11.5, -5.2, 4.8, 5.2, 0.9, c), Fe(-9.1, -2.6, 0.7, tone(c, "shade"), 0.5), R([[-6.8, -2.6], [-3, -2.6], [0, -0.9], [4, -2.4], [7.5, -1.4]], c, 0.5), ...Kb(7.2, -2.4, 3.6, 1.9, 0.5, STEEL), Fl(10.3, -1.9, 0.8, 1, INK, 0.8)] };
  }, WHITE],
  battery: [({ c }) => {
    const o = rrect(-0.7, -5, 1.4, 5, 0.3);
    return { sh: [S(rect(-0.28, -5.5, 0.56, 0.7), STEEL), S(o, DARK), F(rect(-0.8, -5.1, 1.6, 2.7), c, 1, o), ...sd(o, DARK, 0.3), L([[-0.28, -4.3], [0.28, -4.3]], WHITE, 0.14, 0.9), L([[0, -4.58], [0, -4.02]], WHITE, 0.14, 0.9)], g: [0, 4.5] };
  }, "#C98A2B"],
  remote: [({ c }) => {
    const sh = [...Kb(-2.7, -19, 5.4, 19, 2.2, c, 0.25), B(-1.5, -19.3, 3, 0.9, 0.4, INK), Fe(-1.1, -16.9, 0.65, RED), Fe(1.2, -16.9, 0.45, GREY), Fe(0, -12.6, 2.1, "#4B5058"), Fe(0, -12.6, 1, tone(c, "light"), 0.9)];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) sh.push(Fb(-2.1 + i * 1.45, -9 + j * 1.6, 1.15, 1, 0.35, j === 0 && i === 1 ? "#3E8E4E" : GREY, 0.9));
    return { sh };
  }, "#2E2F35"],
  usb: [({ c }) => {
    return { sh: [S(holed(rrect(-1.6, -2, 4.8, 2, 0.8), [ellipse(2.1, -1, 0.34)]), c, { evenodd: true }), ...sd(rrect(-1.6, -2, 4.8, 2, 0.8), c), Fl(-1.7, -1.9, 0.5, 1.8, tone(c, "deep"), 0.6), ...Kb(-3.2, -1.6, 1.7, 1.2, 0.2, STEEL), Fl(-3, -1.1, 1.3, 0.5, INK, 0.8)], g: [0.8, 8.2], hr: -0.2 };
  }, "#1F5FC0"],
  camera: [({ c }) => {
    const sh = [...Kb(4.4, -7.2, 3.5, 6.6, 1.2, c, 0.3), ...Kb(-6.5, -7.8, 13.4, 7.8, 1.2, c), B(-6.6, -8.2, 13.2, 2.8, 1, "#C3C8CE"), S(poly([[-2.3, -8], [-1.4, -10.2], [1.4, -10.2], [2.3, -8]]), c), B(3.6, -9.2, 1.8, 1.1, 0.3, RED), Fb(-5.3, -7.2, 2.2, 1.2, 0.3, "#F3EBD8"), Fb(-5.2, -4.4, 1.6, 1.1, 0.3, GREY, 0.8)];
    return { sh: [...sh, E(0, -3.6, 3.7, INK), E(0, -3.6, 3, STEEL), E(0, -3.6, 2.5, "#3A3D45"), E(0, -3.6, 1.7, "#3C3F6B"), Fe(-0.6, -4.2, 0.6, "#FFFFFF", 0.7)], g: [6.6, -1] };
  }, "#2E2F35"],
  gamepad: [({ c }) => {
    const o = smooth([[-3.5, -9.6], [3.5, -9.6], [6.5, -9.4], [8.8, -6.5], [8.2, -2.5], [6.8, -0.6], [4.8, -1.2], [3.2, -4], [-3.2, -4], [-4.8, -1.2], [-6.8, -0.6], [-8.2, -2.5], [-8.8, -6.5], [-6.5, -9.4]], true, 1), stick = (x: number, y: number) => [E(x, y, 1.6, INK), Fe(x, y, 1.1, "#4B5058"), Fe(x - 0.3, y - 0.3, 0.5, "#6B717A", 0.8)];
    return { sh: [B(-7.8, -10.4, 3.9, 1.4, 0.6, tone(c, "shade")), B(3.9, -10.4, 3.9, 1.4, 0.6, tone(c, "shade")), ...K(o, c, 0.18), ...stick(-5.3, -6.8), ...stick(2.4, -3.2), Fb(-3.4, -4.4, 1, 3.6, 0.3, INK), Fb(-4.7, -3.1, 3.6, 1, 0.3, INK), ...[[5.3, -8.4, "#F2C230"], [6.9, -6.8, "#D9534A"], [5.3, -5.2, "#3E8E4E"], [3.7, -6.8, "#3F74C4"]].map(([x, y, q]) => E(x as number, y as number, 0.8, q as string)), Fe(0, -7.2, 0.8, tone(c, "light")), Fe(-1.6, -7.8, 0.3, GREY), Fe(1.6, -7.8, 0.3, GREY)], g: [-6.4, -1.5] };
  }, "#3A3D45"],
  speaker: [({ c }) => {
    const o = rrect(-3.8, -17, 7.6, 17, 2.4);
    return { sh: [R([[-1.6, -16.5], [-1.9, -19.4], [1.9, -19.4], [1.6, -16.5]], DARK, 0.5), ...K(o, c, 0.3), tiled(rect(-3.8, -14, 7.6, 11), 0.6, 0.6, [S(ellipse(0.3, 0.3, 0.15), tone(c, "deep"))], 0.7), F(rect(-3.8, -14.1, 7.6, 0.4), tone(c, "deep"), 0.5), B(-3.8, -17, 7.6, 3, 2, DARK), B(-3.8, -2.9, 7.6, 2.9, 1.4, DARK), ...[-2, 0, 2].map(x => Fe(x, -15.5, 0.55, x ? GREY : "#7FE3C0")), Fl(-3.8, -16.5, 7.6, 0.3, "#FFFFFF", 0.12)], g: [0, -17.5] };
  }, "#2F8C88"],
  mouse: [({ c }) => {
    const o = smooth([[0, -10.8], [2.5, -10], [3.1, -6.5], [3.1, -3], [2, -0.6], [0, 0], [-2, -0.6], [-3.1, -3], [-3.1, -6.5], [-2.5, -10]], true, 1);
    return { sh: [...K(o, c, 0.25), F(smooth([[0, -10.5], [2.3, -9.8], [2.9, -6.6], [0, -6.4], [-2.9, -6.6], [-2.3, -9.8]], true, 1), tone(c, "light"), 0.35, o), L([[0, -10.8], [0, -6.4]], tone(c, "deep"), 0.2, 0.7), L([[-2.9, -6.4], [2.9, -6.4]], tone(c, "deep"), 0.2, 0.7), B(-0.4, -9.4, 0.8, 2.4, 0.4, INK), Fe(0, -2.3, 0.7, tone(c, "deep"), 0.35)], g: [0, -1] };
  }, "#D8D4CC"],
  keyboard: [({ c }) => {
    const keys = (x: number, y: number, w: number, h: number, cw: number, ch: number) => tiled(rect(x, y, w, h), cw, ch, [S(rrect(0.14, 0.14, cw - 0.28, ch - 0.28, 0.4), WHITE)]);
    return { sh: [...Kb(-21.5, -15, 43, 15, 1.4, c, 0.1), keys(-20, -13.8, 31, 10.4, 2.58, 2.6), keys(13.2, -13.8, 7.4, 12.4, 2.47, 2.48), Fb(-9, -3.1, 15, 2.1, 0.4, WHITE), ...[-20, -17.3, -14.6, 8.2, 10.9].map(x => Fb(x, -3.1, 2.5, 2.1, 0.4, WHITE)), ...[0, 1, 2].map(i => Fe(14 + i * 2, -14.4, 0.25, i ? GREY : "#7FE3C0", 1))], g: [0, -2] };
  }, "#9AA0A6"],
  smartwatch: [({ c, on, p }) => {
    const say = str(p.screen, "").trim(), sc = rrect(-1.85, -10.85, 3.7, 3.7, 0.9), ring = (rr: number, a: number, q: string) => R(arcPoints(0, -9, rr, rr, -1.57, -1.57 + a, 14), q, 0.32);
    const sh = [...Kb(-1.15, -18.6, 2.3, 8, 0.6, c), ...Kb(-1.15, -7.4, 2.3, 7.4, 0.6, c), ...[0, 1, 2].map(i => Fe(0, -4.6 + i * 1.5, 0.2, tone(c, "deep"), 0.7)), B(2.1, -9.7, 0.5, 1.5, 0.25, STEEL), ...Kb(-2.4, -11.4, 4.8, 4.8, 1.3, "#B8BEC4", 0.25), S(sc, on ? "#101820" : "#1C1F25")];
    if (on && !say) sh.push(ring(1.3, 4.7, "#FF4A5C"), ring(0.85, 3.6, "#7FE3C0"), ring(0.4, 5.2, "#4FC3F7"));
    return { sh, glow: on ? [F(sc, "#9FD8F2", 0.35)] : [], text: on ? scrText(say, -1.6, -10.6, 3.2, 3.2, 1.1) : [], g: [0, 2] };
  }, "#2E3A59"],
  power_bank: [({ c, on }) => {
    const leds = [-1.8, -0.6, 0.6, 1.8];
    return { sh: [...Kb(-3.5, -13.5, 7, 13.5, 1.6, c, 0.25), B(-1.3, -14, 2.6, 0.7, 0.3, STEEL), Fb(-2.8, -12.4, 5.6, 7, 0.8, tone(c, "deep"), 0.35), ...leds.map(x => Fe(x, -11.2, 0.38, on ? "#7FE3C0" : GREY)), F(poly([[0.5, -8.2], [-1.3, -5.4], [0, -5.4], [-0.5, -3.2], [1.4, -6.2], [0, -6.2]]), tone(c, "light"), 0.6), ...[0, 1, 2].map(i => L([[-2.6, -1.7 + i * 0.5], [2.6, -1.7 + i * 0.5]], tone(c, "deep"), 0.12, 0.5))], glow: on ? leds.map(x => Fe(x, -11.2, 1, "#7FE3C0", 0.5)) : [], g: [0, -1] };
  }, "#3F74C4"],
  telescope: [({ c, held }) => {
    const tube = (): Shape[] => [B(-31, -2.1, 3.2, 4.2, 0.8, INK), ...Kb(-29, -1.7, 9, 3.4, 1, STEEL), ...Kb(-22, -2.7, 8, 5.4, 1, DARK), B(4, -9.4, 1.4, 5, 0.4, GREY), B(14, -9.4, 1.4, 5, 0.4, GREY), ...Kb(1, -13, 17, 4, 1.2, DARK), ...Kb(-14, -4.6, 48, 9.2, 2, c), ...Kb(32, -5.8, 16, 11.6, 1.5, mix(c, GREY, 0.5)), Fl(32, -5.8, 0.9, 11.6, DARK, 0.6), Fl(46.8, -5.8, 1.2, 11.6, DARK, 0.7)];
    if (held) return { sh: T(tube(), rotate(-0.5)), g: [0, 0], hs: 0.6 };
    const leg = (x: number, y: number, q = GREY) => [R([[0, -82], [x, y]], q, 2.4), B(x - 1.5, y - 1.6, 3, 1.8, 0.6, DARK)];
    return { sh: [...leg(3, -1.2, "#6B717A"), ...leg(-26, -1.2), ...leg(26, -1.2), S(poly([[-15.5, -31], [15.5, -31], [13, -28.6], [-13, -28.6]]), DARK), ...Kb(-3.8, -89, 7.6, 10, 1.6, DARK), ...T(tube(), mul(translate(0, -84), rotate(-0.7))), ...Ke(0, -84, 2.3, STEEL)] };
  }, "#EDEBE4"],
  microscope: [({ c, held }) => {
    const sh = [...Kb(-11, -3.6, 22, 3.6, 1.6, c, 0.3), R([[6, -3], [8, -12], [8.4, -22], [6, -31], [1, -35.5]], c, 3.4), ...Kb(-5.6, -37, 8.6, 8, 1.6, c, 0.3), ...Kb(-4.6, -30, 5.2, 12, 0.6, INK, 0.3), ...Kb(-4.2, -45, 3.8, 9, 0.9, STEEL, 0.3), B(-4.6, -45.6, 4.6, 1.6, 0.6, INK), ...Kb(-6.6, -19.2, 8, 2.2, 0.9, STEEL), S(poly([[-6, -17], [-4.4, -17], [-4.8, -12.6], [-5.6, -12.6]]), STEEL), S(poly([[-2.6, -17], [-1, -17], [-1.4, -13.6], [-2.2, -13.6]]), STEEL), ...Kb(-12, -11.4, 17, 1.8, 0.5, c, 0.3), Fb(-8, -13.1, 8, 1.4, 0.3, "#DCEAF0", 0.95), Fe(-4, -13.4, 0.5, "#A23F6E", 0.9), ...Ke(-3.5, -6.6, 2.1, STEEL), ...Ke(8.4, -18, 2.9, STEEL), E(8.4, -18, 1.2, DARK)];
    return { sh, g: held ? [8, -19] : [0, 0], k: 0.8 };
  }, "#3A3F4A"],
  robot: [({ c }) => {
    const arm = (d: number) => [R([[d * 4.6, -16], [d * 8, -12.5], [d * 8.4, -8.6]], STEEL, 1.5), S(poly([[d * 8.6, -9], [d * 7.2, -7], [d * 8.2, -6.2], [d * 9.6, -7.4]]), GREY), ...Ke(d * 4.6, -16, 1.3, STEEL)];
    return { sh: [...arm(-1), ...arm(1), ...Kb(-4.8, -2.2, 4.2, 2.2, 0.8, DARK), ...Kb(0.6, -2.2, 4.2, 2.2, 0.8, DARK), ...Kb(-3.8, -7.2, 2.4, 5.4, 0.3, STEEL), ...Kb(1.4, -7.2, 2.4, 5.4, 0.3, STEEL), ...Kb(-4.6, -17.6, 9.2, 10.8, 1.2, c, 0.25), Fb(-3, -15.6, 6, 4.6, 0.6, INK, 0.75), Fe(-1.6, -14.5, 0.55, "#F2C230"), Fe(0, -14.5, 0.55, "#7FE3C0"), Fe(1.6, -14.5, 0.55, "#4FC3F7"), Fe(2, -9.6, 1, STEEL), Fe(-2, -9.6, 0.5, "#F2C230"), S(rect(-1.2, -19.2, 2.4, 1.8), STEEL), ...Kb(-3.9, -24.2, 7.8, 5.2, 1.3, c, 0.25), Fb(-3.1, -22.9, 6.2, 2.3, 0.9, INK, 0.9), E(-4.3, -21.6, 0.8, STEEL), E(4.3, -21.6, 0.8, STEEL), R([[0, -24.2], [0, -27.6]], GREY, 0.4), E(0, -28, 0.9, "#F2C230")], g: [0, -6] };
  }, "#C4553A"],
};

const gadget = mk("gadget", GADGET, true, {
  about: "A gadget: a laptop (open, screen glowing), a tablet, headphones, earbuds in their case, a charger with its cable, an AA battery, a TV remote, a USB stick, a camera, a gamepad, a bluetooth speaker, a mouse, a keyboard, a smartwatch, a power bank, a telescope on its tripod, a microscope or a small faceless toy robot.",
  on: "laptop, tablet, smartwatch and power bank: the screen or lights are on and glow; earbuds' lamp",
  terms: ["a1-w-bilgisayar", "a1-w-kulaklik", "b1-w-sarj-cihazi", "a1-w-pil", "a2-w-kumanda", "b1-w-usb-bellek", "a2-w-makine", "a2-w-tus", "b1-w-tablet", "a2-w-teleskop", "b1-w-mikroskop", "a2-w-robot", "b1-w-elektronik-cihaz"],
  tags: ["tech", "gadget"],
  params: { screen: { type: "text", about: "laptop, tablet, smartwatch: the words on the screen (none shows a sample desktop, an app grid or activity rings)" } },
});

// ---- machines ---------------------------------------------------------------------------------------------

/** Printed strokes (spokes, slits, ridges) as one flat shape. */
const lines = (segs: Vec2[][], c: string, w: number, op = 0.7, o: Partial<Shape> = {}): Shape => {
  const path = poly(segs[0], false);
  for (const s of segs.slice(1)) path.add(poly(s, false));
  return { path, stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op, ...o };
};
/** A display's words laid over a window: self-lit. */
const disp = (t: string, x: number, y: number, w: number, h: number, color: string, size?: number): TextSpec[] => t ? [{ text: t, x, y, w, h, font: "screen", color, lit: 0, align: "center", ...(size ? { size } : {}) }] : [];

const MACHINE: Record<string, [Kd, string]> = {
  washing_machine: [({ c, on, held, p }) => {
    const say = str(p.screen, "").trim(), win = rect(3, -81, 11, 6), door = ellipse(0, -37, 14.5), tumble = on && !held, clothes = [F(ellipse(-4, -31, 7, 6), "#C4553A", 0.85, door), F(ellipse(5, -36, 6, 5), "#F2C230", 0.85, door), F(ellipse(-1, -26, 8, 3.5), "#2F8C88", 0.85, door)];
    return {
      sh: [B(-27.5, -1.6, 6, 1.6, 0.5, DARK), B(21.5, -1.6, 6, 1.6, 0.5, DARK), ...Kb(-30, -85, 60, 83.5, 2.5, c, 0.14), Fl(-30, -72, 60, 0.5, tone(c, "shade"), 0.7), Fb(-26, -81.5, 17, 7.5, 1, tone(c, "shade"), 0.55), Fb(-24, -76.2, 13, 1.4, 0.7, tone(c, "deep"), 0.6),
        S(win, "#1B2A33"), ...(on && !say ? [Fb(4.5, -79.4, 5, 1.2, 0.4, "#7FE3C0"), Fe(11.5, -79.8, 0.5, "#7FE3C0")] : []), ...Ke(21, -77.5, 4, STEEL), L([[21, -77.5], [22.8, -80.4]], DARK, 0.5, 0.9),
        ...Ke(0, -37, 19.5, STEEL), E(0, -37, 16.5, GREY), S(door, "#5E88A0"), F(ellipse(5, -34, 14.5), INK, 0.3, door), ...(tumble ? [] : clothes), F(ellipse(-7, -44, 5.5, 2.2), "#FFFFFF", 0.45, door), B(18.4, -39.5, 3, 5, 1, DARK)],
      glow: on ? [F(win, "#7FE3C0", 0.55)] : [], text: on ? disp(say, 3.4, -80.6, 10.2, 5, "#9FF0C8", 3) : [], g: [0, -8], hs: 0.3, ...(tumble ? { live: [{ sh: clothes, at: [0, -37] as Vec2, rot: 0.28, ms: 1700 }] } : {}),
    };
  }, WHITE],
  vacuum: [({ c, on }) => {
    const wheel = (x: number) => [E(x, -5.5, 5.5, DARK), E(x, -5.5, 2.4, GREY)];
    return {
      sh: [...wheel(-27), ...wheel(-8), ...Kb(-34, -26, 34, 20, 10, c, 0.25), ...Kb(-30, -30, 26, 5, 2.5, tone(c, "light")), R([[-24, -30], [-22, -35], [-12, -35], [-10, -30]], DARK, 2), ...Kb(-2, -18, 5, 8, 1.5, DARK), Fe(-17, -16, 1, on ? "#7FE3C0" : GREY), Fe(-21, -16, 1, tone(c, "deep")),
        R([[3, -14], [12, -13], [17, -24], [14, -40], [18, -60], [26, -76]], "#3A3D45", 3.4), { path: smooth([[3, -14], [12, -13], [17, -24], [14, -40], [18, -60], [26, -76]], false, 1), stroke: { color: "#8E959C", width: 3.4, dash: [0.4, 0.8] }, flat: true, opacity: 0.45 },
        R([[27, -76], [49, -9]], STEEL, 2.2), R([[26, -76], [30, -84], [38, -85]], c, 2.8), B(23.5, -80, 5, 4, 1.4, tone(c, "deep")), E(49, -8, 2.6, DARK), ...Kb(38, -6, 26, 5.4, 2.2, c, 0.15), Fl(40, -1.6, 22, 1, DARK)],
      g: [30, -84], hs: 0.45,
    };
  }, "#C4553A"],
  fan: [({ c, on }) => {
    const blade = (a: number) => smooth([[0, 0], [6, -2.8], [15, -4.6], [17.5, 0], [14, 4.4], [5, 3.2]], true, 1).transform(mul(translate(0, -100), rotate(a))), spokes = Array.from({ length: 14 }, (_, i): Vec2[] => { const a = i * Math.PI / 7; return [[Math.cos(a) * 5, -100 + Math.sin(a) * 5], [Math.cos(a) * 20, -100 + Math.sin(a) * 20]]; });
    return {
      sh: [...Ke(0, -2.2, 16, c, 2.4), ...Kb(-1.7, -85, 3.4, 83, 0.8, STEEL, 0.35), ...Ke(0, -48, 2.8, STEEL), ...Ke(0, -83, 3.4, c), E(0, -100, 20.5, GLASS, 20.5, { opacity: 0.22, flat: true }), ...Array.from({ length: on ? 8 : 4 }, (_, i) => S(blade(i * Math.PI / (on ? 4 : 2) + 0.35), "#9CC8D8", { opacity: on ? 0.55 : 0.92 })), ...Ke(0, -100, 5, c), Fe(0, -100, 2, tone(c, "deep"), 0.7),
        lines(spokes, STEEL, 0.35, 0.9), { path: ellipse(0, -100, 20), stroke: { color: STEEL, width: 0.8 }, flat: true }, { path: ellipse(0, -100, 12.5), stroke: { color: STEEL, width: 0.5 }, flat: true, opacity: 0.8 }],
      g: [0, -38], hs: 0.4,
    };
  }, WHITE],
  air_con: [({ c, on }) => ({
    sh: [...Kb(-45, -29, 90, 24, 8, c, 0.1), ...Kb(-43, -7, 86, 7, 3, tone(c, "shade"), 0.1), ...(on ? [Fl(-41, -6.2, 82, 2.4, INK, 0.75)] : []), S(poly([[-41, -4], [41, -4], [40, -0.4], [-40, -0.4]]), tone(c, "light")),
      lines([-26.6, -25, -23.4].map((y): Vec2[] => [[-30, y], [30, y]]), tone(c, "shade"), 0.3, 0.6), Fb(28, -17, 11, 4.6, 1, "#1B2A33"), Fb(29.6, -15.6, 4.6, 1.8, 0.5, on ? "#7FE3C0" : GREY, on ? 0.95 : 0.5), Fe(36.6, -14.7, 0.7, on ? "#F2C230" : GREY), Fb(-36, -17.6, 14, 2.2, 1, tone(c, "shade"), 0.6)],
    glow: on ? [Fb(29.6, -15.6, 4.6, 1.8, 0.5, "#7FE3C0", 0.6), Fe(36.6, -14.7, 1.8, "#F2C230", 0.5)] : [], g: [0, -3], hs: 0.3,
  }), WHITE],
  iron: [({ c, on, held }) => {
    const body = smooth([[-16, 0, 0], [14, 0, 0], [15, -3.5], [12, -8.5], [2, -12.5], [-7, -10], [-13, -4.5]], true, 1), iron = [...(held ? [R([[14.5, -3], [17.5, -2], [18.6, 2], [16.5, 6], [17.8, 10], [16.2, 14]], DARK, 0.55)] : []), R([[-5, -11], [-2, -19], [8, -19], [11, -10]], tone(c, "deep"), 2.8), ...K(body, c, 0.25), S(poly([[-16.4, 0], [14.8, 0], [14.4, -2], [-14.8, -2]]), STEEL), Fe(-7, -9, 1, tone(c, "light")), L([[-11, -4.8], [-5, -8.6]], tone(c, "light"), 0.4, 0.4)];
    if (held) return { sh: iron, g: [3, -17], ...(on ? { emit: [{ kind: "steam", x: -14, y: -3, w: 4 }] } : {}) };
    const top = smooth([[-62, -86], [-30, -91], [40, -91], [60, -88], [63, -85], [40, -82], [-30, -81]], true, 1), at = (sh: Shape[]) => T(sh, translate(-8, -86));
    return { sh: [lines([[[-26, -81], [26, -3]], [[26, -81], [-26, -3]]], STEEL, 2, 1, { flat: false }), R([[-18, -35], [18, -35]], GREY, 1.4), B(-30, -2, 8, 2, 0.8, DARK), B(22, -2, 8, 2, 0.8, DARK), S(top, "#5B8FB9"), F(poly([[-61, -85], [-30, -81], [40, -82], [62, -85], [58, -83.4], [-30, -79.6]]), INK, 0.3), ...sd(top, "#5B8FB9", 0.12), L([[-50, -87], [38, -88]], "#FFFFFF", 0.4, 0.35), ...at(iron)], ...(on ? { emit: [{ kind: "steam", x: -21, y: -89, w: 4 }] } : {}) };
  }, "#2F8C88"],
  hair_dryer: [({ c }) => {
    const barrel = rrect(-12, -21, 23, 10, 4);
    return { sh: [...Kb(0, -12, 7, 12, 3, tone(c, "shade"), 0.3), B(2.4, -9, 2, 1, 0.4, GREY), ...K(barrel, c, 0.22), S(poly([[-12, -20], [-15.5, -19], [-15.5, -13], [-12, -12]]), DARK), ...Kb(8.5, -20.4, 5, 9, 1.6, DARK), lines([-18, -16, -14].map((y): Vec2[] => [[9.4, y], [12.6, y]]), GREY, 0.25, 0.8), Fl(-9, -21, 0.7, 10, tone(c, "deep"), 0.5), Fl(-4, -21, 0.4, 10, tone(c, "light"), 0.5)], g: [3.5, -6], k: 0.85 };
  }, "#E58FA0"],
  printer: [({ c, on, p }) => {
    const say = str(p.print, "").trim(), led = rect(7, -16.9, 1.6, 0.9);
    return {
      sh: [S(poly([[-9, -17], [9, -17], [11, -28], [-7.5, -27]]), "#F7F4EC"), S(poly([[-8, -17], [8, -17], [9.5, -27], [-6.5, -26.2]]), WHITE), ...Kb(-20, -13, 40, 13, 2.5, c, 0.1), ...Kb(-19, -19, 38, 6.4, 2.2, tone(c, "light"), 0.1), B(-14, -12.4, 28, 1.8, 0.8, INK), Fb(5.5, -17.8, 11, 3.2, 0.8, "#26272C"), S(led, on ? "#7FE3C0" : GREY), Fe(14.5, -16.2, 0.5, on ? "#F2C230" : GREY),
        S(poly([[-12, -12], [12, -12], [13.5, -1], [-13.5, -1]]), "#FBF8F2"), F(poly([[-12, -12], [12, -12], [12.6, -9.4], [-12.6, -9.4]]), INK, 0.12), ...(say ? [] : [lines([-8.5, -7, -5.5, -4].map((y): Vec2[] => [[-8.5, y], [8.5 - (y > -5 ? 3 : 0), y]]), GREY, 0.4, 0.8), Fb(3.4, -9, 5, 3.4, 0.4, "#7FB2D9", 0.9)])],
      glow: on ? [F(led, "#7FE3C0", 0.7)] : [], text: say ? [{ text: say, x: -10.5, y: -9.6, w: 21, h: 8, size: 1.4, font: "print", align: "left" }] : [], g: [0, -3],
    };
  }, "#D8D4CC"],
  projector: [({ c, on }) => {
    const slots = Array.from({ length: 7 }, (_, i): Vec2[] => [[-8.5 + i * 2.9, -25.5], [-8.5 + i * 2.9, -17.5]]);
    return {
      sh: [B(-13, -1.6, 4, 1.6, 0.5, DARK), B(9, -1.6, 4, 1.6, 0.5, DARK), ...Kb(-14, -16, 29, 14.6, 3, c, 0.22), ...Kb(-22, -12.5, 10, 7, 1.5, DARK), E(-22.2, -9, 2.6, GLASS, 3.2, { opacity: 0.9 }), Fl(-17, -12.5, 0.5, 7, GREY, 0.7), Fl(-14.5, -12.5, 0.5, 7, GREY, 0.7), ...Kb(-11, -26.5, 22, 10.5, 2.5, "#E9E4DA", 0.2), lines(slots, tone("#E9E4DA", "deep"), 0.3, 0.7), Fb(-11, -17.8, 22, 1.6, 0.5, DARK, 0.5), ...Ke(4, -9, 2.2, STEEL), lines([-12, -10, -8].map((y): Vec2[] => [[9, y], [14, y]]), tone(c, "deep"), 0.3, 0.7), Fe(-6, -5, 0.7, on ? "#F2C230" : GREY)],
      glow: on ? [F(poly([[-22, -12], [-90, -48], [-90, -3], [-22, -6]]), "#FFF3C4", 0.28), F(poly([[-22, -10.5], [-80, -36], [-80, -10], [-22, -7.5]]), "#FFFFFF", 0.25), Fe(-22, -9, 4, "#FFF3C4", 0.6)] : [], g: [0, -2],
    };
  }, "#8E959C"],
  photocopier: [({ c, on, p }) => {
    const say = str(p.screen, "").trim(), win = rect(10, -77.5, 13, 7), lid = mix(c, WHITE, 0.55);
    return {
      sh: [...Kb(-35, -52, 70, 49, 2, c, 0.12), ...[0, 1, 2].flatMap(i => [Fb(-33, -50 + i * 15.5, 66, 14, 1, tone(c, "shade"), 0.45), Fb(-6, -45 + i * 15.5, 12, 2.2, 1, "#4B5058")]), B(-34, -3.5, 68, 3.5, 1, DARK),
        ...Kb(-36, -85, 72, 33, 3, c, 0.1), Fb(-34, -66, 20, 5, 1, INK, 0.85), Fb(-30, -65.4, 16, 1.8, 0.4, WHITE), Fb(6, -82, 27, 13, 1.8, "#26272C"), S(win, "#1B2A33"), ...[0, 1, 2, 3].map(i => Fe(26 + (i % 2) * 3, -77 + Math.floor(i / 2) * 3, 0.9, i === 3 ? "#7FE3C0" : GREY)),
        S(poly([[-24, -98], [-2, -98], [-6, -106], [-28, -106]]), "#F7F4EC"), ...Kb(-36, -98, 72, 13, 3, lid, 0.12), Fl(-35, -86.5, 70, 0.6, tone(c, "deep"), 0.5)],
      glow: on ? [F(win, "#7FE3C0", 0.55)] : [], text: on ? disp(say, 10.4, -77.2, 12.2, 6.4, "#9FF0C8", 3) : [], g: [0, -4], hs: 0.3,
    };
  }, "#D8D4CC"],
  water_heater: [({ c, on, p }) => {
    const say = str(p.screen, "").trim(), win = rrect(-8, -60, 16, 13, 2), dsp = rect(-9.5, -42.5, 10.5, 5), pipe = (x: number, q: string) => [...Kb(x - 1.2, -8, 2.4, 8, 0.6, q, 0.3), B(x - 1.8, -9.4, 3.6, 2, 0.6, STEEL)];
    return {
      sh: [...pipe(-9, BRASS), ...pipe(0, "#3F74C4"), ...pipe(9, RED), ...Kb(-3.6, -94, 7.2, 24, 0.6, STEEL, 0.3), ...Kb(-4.8, -77, 9.6, 8, 1, STEEL), ...Kb(-15.5, -70, 31, 61, 5, c, 0.14), S(win, "#26272C"), Fb(-7, -59, 14, 11, 1.6, on ? "#1B3A5A" : "#1B2A33"),
        ...(on ? [P([[-5.5, -49], [-4.5, -53], [-3.5, -49]], "#4FC3F7"), P([[-1.5, -49], [0, -54.5], [1.5, -49]], "#7FDBFF"), P([[3.5, -49], [4.5, -53], [5.5, -49]], "#4FC3F7")] : []), ...Ke(7.4, -40, 3.6, WHITE), L([[7.4, -40], [9.2, -42.4]], DARK, 0.5, 0.9),
        S(dsp, "#1B2A33"), ...(on && !say ? [Fb(-8, -41.1, 4, 2.2, 0.4, "#7FE3C0")] : []), Fe(7.4, -31, 1.6, RED), lines([-17, -15, -13].map((y): Vec2[] => [[-8, y], [8, y]]), tone(c, "shade"), 0.3, 0.6)],
      glow: on ? [F(dsp, "#7FE3C0", 0.55), F(win, "#7FDBFF", 0.35)] : [], text: on ? disp(say, -9.5, -42.5, 10.5, 5, "#9FF0C8", 2.6) : [], g: [0, -6], hs: 0.4,
    };
  }, WHITE],
};

const machine = mk("machine", MACHINE, false, {
  about: "A household or office machine: a front-loading washing machine, a canister vacuum cleaner, a standing fan, a wall split air conditioner, an iron on its ironing board, a hair dryer, a printer with a printout coming out, a slide projector, an office photocopier or a wall gas water heater (şofben).",
  on: "display lamps glow; the iron steams, the projector throws its beam, the heater's flame burns",
  terms: ["a2-w-camasir-makinesi", "a2-w-klima", "a1-w-utu", "a2-w-sac-kurutma-makinesi", "b1-w-cikti", "b1-w-slayt", "b1-w-fotokopi", "b1-w-sofben", "a2-w-makine"],
  tags: ["tech", "machine", "appliance"],
  params: {
    screen: { type: "text", about: "washing machine, photocopier, water heater: the words on the display (lit when on)" },
    print: { type: "text", about: "printer: the words on the printout coming out (none shows grey lines and a picture)" },
  },
});

// ---- hardware ---------------------------------------------------------------------------------------------

const BEAM = "#FFF3C4";
/** A cone of light from (x, y) opening up to a width `w` at `len` cm along `a` (radians, 0 up), for the glow group. */
const cone = (x: number, y: number, w0: number, w1: number, len: number, a = 0): Shape[] => {
  const m = mul(translate(x, y), rotate(a));
  return [F(poly([[-w0, 0], [w0, 0], [w1, -len], [-w1, -len]]).transform(m), BEAM, 0.22), F(poly([[-w0 * 0.6, 0], [w0 * 0.6, 0], [w1 * 0.5, -len * 0.8], [-w1 * 0.5, -len * 0.8]]).transform(m), "#FFFFFF", 0.2)];
};

const HARDWARE: Record<string, [Kd, string]> = {
  hammer: [({ c }) => {
    const head = smooth([[-12.5, -28.8, 0], [-8, -31], [-3.2, -34], [-1, -35.6], [5.5, -35.6], [7.6, -35.2], [8.2, -34, 0], [8.2, -30.4, 0], [7.6, -29.4], [5.5, -29], [-1, -29.4], [-4.6, -29.2], [-9, -28.2]], true, 1).transform(scale(0.72, 1));
    return { sh: [...Kb(-1.5, -31, 3, 31, 1.2, c, 0.3), lines([-3, -5, -7].map((y): Vec2[] => [[-1.5, y], [1.5, y]]), tone(c, "deep"), 0.3, 0.6), ...K(head, STEEL, 0.2), L([[-8.8, -29.2], [-4.3, -31.4]], DARK, 0.3, 0.7), Fl(4.6, -35.4, 0.4, 6.2, tone(STEEL, "shade"), 0.6)], e: 0.2, g: [0, -12] };
  }, "#B98A57"],
  screwdriver: [({ c }) => ({
    sh: [R([[0, -10], [0, -19]], STEEL, 0.55), S(poly([[-0.7, -18.6], [0.7, -18.6], [0.55, -22], [-0.55, -22]]), STEEL), ...Kb(-1, -11.2, 2, 1.7, 0.4, GREY), ...Kb(-1.9, -9.6, 3.8, 9.6, 1.7, c, 0.3), lines([-1.1, 0, 1.1].map((x): Vec2[] => [[x, -8], [x, -2.5]]), tone(c, "deep"), 0.25, 0.6), Fb(-1.9, -1.8, 3.8, 1.8, 0.9, DARK, 0.9)], e: 0.1, g: [0, -4],
  }), "#C8283A"],
  wrench: [({ c }) => {
    const out = () => smooth([[-1.4, -1.2, 0], [1.4, -1.2, 0], [1.4, -17], [3.4, -19.5], [4.6, -23.5], [3.8, -26.5], [2.4, -27.6, 0], [1.5, -27.4, 0], [1.5, -23.8, 0], [-1.5, -23.8, 0], [-1.5, -27.4, 0], [-2.4, -27.6, 0], [-3.8, -26.5], [-4.6, -23.5], [-3.4, -19.5], [-1.4, -17]], true, 1);
    return { sh: [S(holed(out(), [ellipse(0, -4, 0.8)]), c, { evenodd: true }), ...sd(out(), c, 0.25), L([[0, -7], [0, -15]], tone(c, "deep"), 0.3, 0.5)], e: 0.15, g: [0, -9] };
  }, STEEL],
  pliers: [({ c }) => {
    const jaw = (d: number) => P([[d * 0.4, -11.5], [d * 2.8, -14.2], [d * 3.4, -20], [d * 1.8, -20.6, 0], [d * 0.9, -16.4], [d * 0.2, -14]], STEEL);
    return { sh: [...[-1, 1].map(d => R([[d * 3.6, 0], [d * 1.9, -9.5]], c, 2.9)), R([[-1.9, -9.5], [0.2, -13]], GREY, 1.6), R([[1.9, -9.5], [-0.2, -13]], GREY, 1.6), jaw(-1), jaw(1), ...Ke(0, -10.8, 1.1, GREY), Fe(0, -10.8, 0.4, DARK), L([[-3, -19.5], [-1.7, -20]], WHITE, 0.2, 0.7), L([[3, -19.5], [1.7, -20]], WHITE, 0.2, 0.7)], e: 0.15, g: [0, -4] };
  }, "#C8283A"],
  drill: [({ c }) => ({
    sh: [...Kb(-1.5, -6, 12.5, 6, 1.4, DARK), Fb(1, -4.4, 7, 1.2, 0.5, c, 0.9), Fe(9.6, -3, 0.5, "#7FE3C0"), ...Kb(0.5, -14.5, 7, 9.5, 2.2, tone(DARK, "light")), B(-1.4, -12, 2.4, 3.4, 0.8, INK), ...Kb(-9, -22.5, 19.5, 9.4, 3.2, c, 0.22), B(-1, -24, 4, 1.6, 0.5, GREY), ...Kb(-12.4, -20.6, 3.6, 6, 0.8, tone(DARK, "light")), ...Kb(-15, -21.2, 3.2, 7.2, 1, STEEL), R([[-15, -17.6], [-21.5, -17.6]], STEEL, 0.7), lines([-21, -19, -17].map((y): Vec2[] => [[0, y], [8, y]]), tone(c, "deep"), 0.3, 0.5, { clip: rrect(-9, -22.5, 19.5, 9.4, 3.2) })],
    e: 0.25, g: [4, -8],
  }), "#1F5FC0"],
  paint: [({ c, p }) => {
    const label = str(p.label, "").trim(), drip = (x: number, l: number, w: number) => P([[x - w, -17, 0], [x - w, -17 + l - w], [x, -17 + l], [x + w, -17 + l - w], [x + w, -17, 0]], c);
    return {
      sh: [R([[-8.2, -18], [-7, -26], [0, -28.4], [7, -26], [8.2, -18]], GREY, 0.5), ...Kb(-8, -17, 16, 17, 0.8, "#C3C8CE", 0.2), lines([-15.6, -2.2].map((y): Vec2[] => [[-8, y], [8, y]]), tone("#C3C8CE", "shade"), 0.4, 0.7), E(0, -17.4, 8.4, STEEL, 2.2), E(0, -17.4, 7.4, c, 1.6), F(ellipse(-2.5, -17.8, 2.6, 0.5), WHITE, 0.4),
        Fb(-8, -10.2, 16, 7.6, 0.4, WHITE, 0.92), Fb(-6.6, -9.4, 13.2, 2.4, 0.6, c), drip(-5.4, 6.4, 0.9), drip(1.4, 8.6, 1), drip(5.8, 4, 0.8), ...[-8.4, 8.4].map(x => E(x, -17.4, 0.5, GREY))],
      text: label ? [{ text: label, x: -7, y: -6.6, w: 14, h: 3.4, size: 1.6, font: "print", align: "center" }] : [], e: 0.25, g: [0, -25],
    };
  }, "#C8283A"],
  brush: [({ c }) => {
    const handle = smooth([[-1.1, 0, 0], [1.1, 0, 0], [1.2, -4], [0.9, -9], [0.8, -12, 0], [-0.8, -12, 0], [-0.9, -9], [-1.2, -4]], true, 1);
    return { sh: [...K(handle, "#C79A63", 0.3), Fe(0, -1.8, 0.3, tone("#C79A63", "deep"), 0.7), ...Kb(-2.4, -22.4, 4.8, 7, 0.5, "#E9DDC0", 0.25), lines([-1, 0.4, 1.4].map((x): Vec2[] => [[x, -21], [x, -16.4]]), tone("#E9DDC0", "shade"), 0.2, 0.7), P([[-2.5, -19.6, 0], [2.5, -19.6, 0], [2.5, -22], [1.4, -22.8], [0, -22.2], [-1.4, -22.9], [-2.5, -22]], c), ...Kb(-1.8, -15.6, 3.6, 4.4, 0.5, STEEL), lines([-14.2, -13].map((y): Vec2[] => [[-1.8, y], [1.8, y]]), tone(STEEL, "shade"), 0.2, 0.8)], e: 0.15, g: [0, -8] };
  }, "#C8283A"],
  padlock: [({ c }) => ({
    sh: [R([[-1.9, -4.4], ...arcPoints(0, -5, 1.9, 3.4, Math.PI, 2 * Math.PI, 10), [1.9, -4.4]], STEEL, 1), ...Kb(-2.9, -4.8, 5.8, 4.8, 0.9, c, 0.25), Fb(-2.3, -4.2, 4.6, 3.6, 0.6, tone(c, "light"), 0.45), Fe(0, -3.3, 0.55, INK), F(poly([[-0.2, -3.2], [0.2, -3.2], [0.45, -1.4], [-0.45, -1.4]]), INK), ...[-1, 1].map(d => Fe(d * 2.2, -4.1, 0.2, tone(c, "deep"), 0.8))], e: 0.1, g: [0, -6.2],
  }), BRASS],
  tape_measure: [({ c }) => ({
    sh: [S(rect(-4, -2.5, 22.5, 1.5), "#F7EFC8"), tiled(rect(-4, -2.5, 22.5, 1.5), 1, 1.5, [S(rect(0.45, 0.7, 0.1, 0.8), DARK)]), tiled(rect(-4, -2.5, 22.5, 1.5), 5, 1.5, [S(rect(0, 0.2, 0.14, 1.3), DARK)]), S(rect(17.7, -4.2, 0.9, 4.2), STEEL), S(rect(16.4, -4.2, 2.2, 0.8), STEEL), ...Kb(-12, -8.4, 8, 8.4, 2.2, c, 0.25), Fe(-8, -4.2, 2.4, tone(c, "deep"), 0.4), B(-9.2, -9.5, 2.4, 1.3, 0.5, DARK), Fe(-8, -4.2, 0.7, DARK, 0.7)], e: 0.15, g: [-8, -4],
  }), "#F2C230"],
  nails: [({ c, r, held }) => {
    const a = held ? 0 : r.range(-0.15, 0.15);
    return { sh: T([S(poly([[-0.22, -5.4], [0.22, -5.4], [0.22, -0.7], [0, 0], [-0.22, -0.7]]), c), E(0, -5.6, 0.78, tone(c, "light"), 0.2), F(rect(-0.18, -5.1, 0.07, 4.2), WHITE, 0.55), F(rect(0.1, -5.1, 0.1, 4.2), tone(c, "shade"), 0.5)], rotate(a)), e: 0.06, g: [0, 5] };
  }, STEEL],
  pipe: [({ c }) => {
    const path: Vec2[] = [[-18, -2.2], [0, -2.2], [3.5, -2.9], [5.6, -5.6], [6, -8.6], [6, -24]];
    return { sh: [R(path, c, 3.2, { stroke: { color: c, width: 3.2, cap: "butt", join: "round" } }), { path: smooth(path.map(([x, y]): Vec2 => [x - 0.5, y - 0.5]), false, 1), stroke: { color: tone(c, "light"), width: 0.9 }, flat: true, opacity: 0.55 }, { path: smooth(path.map(([x, y]): Vec2 => [x + 0.8, y + 0.8]), false, 1), stroke: { color: tone(c, "shade"), width: 0.8 }, flat: true, opacity: 0.5 }, ...Kb(-11.6, -4.4, 2.4, 4.4, 0.5, c), ...Kb(4.4, -19, 3.2, 2.2, 0.4, c, 0.3), ...[[6, -24, 1.6, 0.55], [-18, -2.2, 0.5, 1.6]].map(([x, y, rx, ry]) => E(x, y, rx, tone(c, "deep"), ry))], e: 0.15, g: [-6, -2.2] };
  }, "#C97B4A"],
  valve: [({ c }) => ({
    sh: [...Kb(-9, -7.5, 18, 5, 0.4, BRASS), ...[-1, 1].map(d => B(d * 7.4 - 1.1, -8.5, 2.2, 7, 0.6, tone(BRASS, "shade"))), ...Ke(0, -5, 4.8, BRASS, 5), ...Kb(-2.4, -13.6, 4.8, 5, 0.6, BRASS), ...Kb(-2.8, -15, 5.6, 2, 0.5, tone(BRASS, "light")), R([[0, -15], [0, -20]], STEEL, 0.9), { path: ellipse(0, -21, 6.4, 2.4), stroke: { color: c, width: 0.8 }, opacity: 1 }, lines([[[-6, -21], [6, -21]], [[0, -23.2], [0, -18.8]]], c, 0.4, 0.9, { flat: false }), ...Ke(0, -21, 1.3, STEEL)], e: 0.12, g: [-6, -3.5], k: 0.55,
  }), RED],
  torch: [({ c, on }) => {
    const lens = on ? "#FFF6C8" : "#9CB3C0";
    return { sh: [...Kb(-2.2, -12.4, 4.4, 12.4, 1.2, c, 0.3), lines([-3, -4.6, -6.2, -7.8].map((y): Vec2[] => [[-2.2, y], [2.2, y]]), tone(c, "deep"), 0.25, 0.6), B(-0.8, -11.2, 1.6, 2.6, 0.8, INK), ...K(poly([[-2.6, -12.4], [2.6, -12.4], [3.8, -17], [-3.8, -17]]), tone(c, "deep"), 0.25), E(0, -17, 3.9, STEEL, 1.2), E(0, -17.1, 3.1, lens, 0.9), ...(on ? [] : [Fe(-1, -17.2, 1, WHITE, 0.5, 0.3)])], glow: on ? [...cone(0, -17, 3.2, 17, 54), Fe(0, -17.2, 4, BEAM, 0.7, 2)] : [], e: 0.15, g: [0, -6] };
  }, "#2F8C88"],
  bulb: [({ c, on }) => {
    const glass = smooth([[-1.9, -6], [-2.6, -8], [-3.2, -10.5], [-3, -13.5], [-1.8, -15.4], [0, -16], [1.8, -15.4], [3, -13.5], [3.2, -10.5], [2.6, -8], [1.9, -6]], true, 1);
    return { sh: [S(glass, on ? c : mix(c, WHITE, 0.75), { opacity: 0.95 }), F(ellipse(-1.6, -11.8, 0.5, 1.6), WHITE, 0.6), R([[0, -6.4], [0, -9]], GREY, 0.25), R([[-1.2, -9], ...arcPoints(0, -10.4, 1.2, 1.6, Math.PI, 2 * Math.PI, 6), [1.2, -9]], on ? "#FFFBE0" : GREY, 0.25), ...Kb(-1.9, -5.4, 3.8, 4.6, 0.5, STEEL, 0.3), lines([-4.2, -3, -1.8].map((y): Vec2[] => [[-1.9, y], [1.9, y]]), tone(STEEL, "shade"), 0.25, 0.8), B(-0.9, -0.9, 1.8, 0.9, 0.4, DARK)], glow: on ? [Fe(0, -11, 6, c, 0.4, 8.7), Fe(0, -11, 10, c, 0.22, 14.5), Fe(0, -11, 15, c, 0.12, 21.7)] : [], e: 0.12, g: [0, 4], k: [0.95, 0.69] };
  }, "#FFE9A8"],
  socket: [({ c, held }) => {
    if (held) return { sh: [R([[0, 0], [0.5, 3], [-0.5, 7], [0.4, 11]], DARK, 1.1), S(rect(-1.7, -8.8, 0.7, 3.4), STEEL), S(rect(1, -8.8, 0.7, 3.4), STEEL), ...Kb(-2.6, -5.8, 5.2, 5.8, 1.6, DARK)], e: 0.12, g: [0, -3] };
    return { sh: [...Kb(-4.3, -24, 8.6, 8.6, 1, c, 0.12), E(0, -19.7, 3.6, tone(c, "shade")), ...[-1, 1].map(d => B(d * 3.6 - 0.3, -20.7, 0.6, 2, 0.2, STEEL)), R([[0, -17], [0, -12], [0.8, -6], [-1.6, -2], [-3.6, -0.8]], DARK, 1.1), ...Ke(0, -19.7, 2.9, DARK), Fe(-1.1, -20.9, 1.1, WHITE, 0.14, 0.7), ...Kb(-1, -17.6, 2, 1.8, 0.6, DARK)], e: 0.15, g: [0, -3] };
  }, "#F2F0EA"],
  extension: [({ c }) => ({
    sh: [R([[-2, -3], [3, -3], [7, -1.4], [11, -4.6], [15, -1.4], [19, -3]], mix(c, GREY, 0.45), 1), ...Kb(-30, -6.2, 28, 6.2, 1.6, c, 0.14), ...[-26, -20, -14, -8].flatMap(x => [E(x, -3.1, 2.1, tone(c, "shade")), E(x, -3.1, 1.5, tone(c, "deep")), B(x - 2.2, -3.9, 0.6, 1.6, 0.2, STEEL), B(x + 1.6, -3.9, 0.6, 1.6, 0.2, STEEL), Fe(x - 0.7, -3.1, 0.3, INK, 0.85), Fe(x + 0.7, -3.1, 0.3, INK, 0.85)]), ...Kb(-4.8, -5.4, 2.8, 4.6, 0.6, RED, 0.2), Fe(-3.4, -4.4, 0.35, "#FFD2C8", 0.9), ...Kb(18.5, -4.4, 5, 4.2, 1, c, 0.2), S(rect(23.5, -3.7, 2, 0.6), STEEL), S(rect(23.5, -2.1, 2, 0.6), STEEL)], e: 0.18, g: [-16, -3],
  }), "#F2F0EA"],
};

const hardware = mk("hardware", HARDWARE, false, {
  about: "Hardware: a hammer, a screwdriver, a wrench, pliers, a cordless drill, a paint can with drips, a paint brush, a padlock, a tape measure, nails (one nail for each n), a length of pipe with an elbow, a red-handled valve, a torch (beam when on), a light bulb (glows when on), a wall socket with a plug in it or an extension cord.",
  on: "torch: its beam shines; bulb: it glows (their variants are on)",
  terms: ["a1-w-boya", "a1-w-firca", "b1-w-asma-kilit", "b1-w-boru", "b1-w-vana", "b1-w-el-lambasi", "a2-w-ampul", "b1-w-priz", "a1-w-isik"],
  tags: ["tech", "hardware", "tool"],
  params: { label: { type: "text", about: "paint: the words on the can's label" } },
});

export const set: Record<string, PieceDef> = { machine };
export const props: Record<string, PieceDef> = { gadget, machine, hardware };
