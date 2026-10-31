// Writes packages/sahne-kit/src/kerim/art.gen.ts: Kerim's paper art for the stage, converted from her one
// drawing (src/kerim/art.ts, which Kumru imports too) and the pivots and flight values of the CSS that
// poses her (src/kerim/kerim.css, exported as sahne-kit/kerim.css, read only). A faithful copy in the art's own 100-unit
// box, which the kit's puppet scales. The SVG reading stays here: the bundle gets only data.
//
//   node packages/sahne-kit/kerim/build.ts           write src/kerim/art.gen.ts
//   node packages/sahne-kit/kerim/build.ts --check   fail when it is stale or her art or CSS has moved (the kit's tests run this)
//
// What it reads of the markup: <g>, <path>, <circle>, <ellipse>; fill, stroke, stroke-width, stroke-linecap,
// stroke-dasharray, paint-order (inherited from groups), opacity, display and the lid's scale(1 0). Path data:
// M L H V C S Q T A Z, absolute and relative, implicit repeats; arcs become cubics of at most a quarter turn.
// Parts are named by their `k-` classes, dotted under their named ancestors ("head.eye.lid"); a run of
// unnamed shapes is its parent's (the first run) or `<parent>#n`. Left out: the ledge and k-fx (sparks,
// notes, z and ?: no celebration on the stage, Kumru's STORIES_STAGE.md §2).

import { readFileSync, writeFileSync } from "node:fs";
import type { Cmd } from "sahne";

const DIR = new URL(".", import.meta.url);
const ART = new URL("../src/kerim/art.ts", DIR), CSS = new URL("../src/kerim/kerim.css", DIR);
const OUT = new URL("../src/kerim/art.gen.ts", DIR);

type Vec = [number, number];
type M = [number, number, number, number, number, number];

/** One shape of a part: the path in art units, its fill, and its stroke (painted under the fill when `under`). */
export interface KShape { d: Cmd[]; fill?: string; stroke?: string; width?: number; under?: true; cap?: "round"; dash?: number[]; opacity?: number }
export interface KPart { id: string; shapes: KShape[]; hidden?: true }

// ---- path data ------------------------------------------------------------------------------------

const r3 = (v: number) => Math.round(v * 1000) / 1000 || 0;

/** A circular or elliptical arc in SVG's endpoint form, as cubics of at most a quarter turn (SVG 1.1 F.6.5–F.6.6). */
export function arcToCubics(x1: number, y1: number, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, x2: number, y2: number): Cmd[] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [["L", x2, y2]];
  const phi = phiDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), st = dt / n, k = 4 / 3 * Math.tan(st / 4);
  const at = (t: number): Vec => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const dv = (t: number): Vec => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  const out: Cmd[] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + st * i, b = a + st, [ax, ay] = at(a), [bx, by] = at(b), [adx, ady] = dv(a), [bdx, bdy] = dv(b);
    const end: Vec = i === n - 1 ? [x2, y2] : [bx, by];
    out.push(["C", ax + k * adx, ay + k * ady, bx - k * bdx, by - k * bdy, end[0], end[1]]);
  }
  return out;
}

/** SVG path data as absolute M, L, C, Q and Z commands (H, V become lines; S, T reflect; A becomes cubics). */
export function parsePath(d: string): Cmd[] {
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: Cmd[] = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = "", lastC: Vec | null = null, lastQ: Vec | null = null;
  const n = () => { const v = Number(toks[i++]); if (!Number.isFinite(v)) throw new Error(`a number expected in "${d}"`); return v; };
  const flag = () => {
    // arc flags may be written together ("a6 3 0 01 5 5"): take one digit
    const t = toks[i];
    if (t === "0" || t === "1") { i++; return t === "1"; }
    if (/^[01]/.test(t ?? "")) { toks[i] = t.slice(1); return t[0] === "1"; }
    throw new Error(`an arc flag expected in "${d}"`);
  };
  while (i < toks.length) {
    if (/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) throw new Error(`a command expected in "${d}"`);
    const rel = cmd !== cmd.toUpperCase(), c = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    let nextC: Vec | null = null, nextQ: Vec | null = null;
    switch (c) {
      case "Z": out.push(["Z"]); x = sx; y = sy; break;
      case "M": x = n() + ox; y = n() + oy; sx = x; sy = y; out.push(["M", x, y]); cmd = rel ? "l" : "L"; break;
      case "L": x = n() + ox; y = n() + oy; out.push(["L", x, y]); break;
      case "H": x = n() + ox; out.push(["L", x, y]); break;
      case "V": y = n() + oy; out.push(["L", x, y]); break;
      case "C": { const a = n() + ox, b = n() + oy, p = n() + ox, q = n() + oy; x = n() + ox; y = n() + oy; out.push(["C", a, b, p, q, x, y]); nextC = [p, q]; break; }
      case "S": { const a = lastC ? 2 * x - lastC[0] : x, b = lastC ? 2 * y - lastC[1] : y, p = n() + ox, q = n() + oy; x = n() + ox; y = n() + oy; out.push(["C", a, b, p, q, x, y]); nextC = [p, q]; break; }
      case "Q": { const a = n() + ox, b = n() + oy; x = n() + ox; y = n() + oy; out.push(["Q", a, b, x, y]); nextQ = [a, b]; break; }
      case "T": { const a = lastQ ? 2 * x - lastQ[0] : x, b = lastQ ? 2 * y - lastQ[1] : y; x = n() + ox; y = n() + oy; out.push(["Q", a, b, x, y]); nextQ = [a, b]; break; }
      case "A": {
        const rx = n(), ry = n(), phi = n(), large = flag(), sweep = flag(), ex = n() + ox, ey = n() + oy;
        out.push(...arcToCubics(x, y, rx, ry, phi, large, sweep, ex, ey)); x = ex; y = ey; break;
      }
      default: throw new Error(`unknown path command ${cmd} in "${d}"`);
    }
    lastC = nextC; lastQ = nextQ;
  }
  return out;
}

/** An ellipse as four cubics, from its rightmost point, clockwise on screen (as SVG draws one). */
function ellipseCmds(cx: number, cy: number, rx: number, ry: number): Cmd[] {
  const k = 0.5522847498;
  return [["M", cx + rx, cy], ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
    ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ["Z"]];
}

// ---- affine transforms (CSS transforms about a pivot) ---------------------------------------------

const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const at = (m: M, x: number, y: number): Vec => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** A CSS transform list (translate, translateX/Y, rotate, scale, scaleX/Y; px and deg) as an affine about the origin `o`. */
export function cssMatrix(t: string, o: Vec = [0, 0]): M {
  let m: M = [1, 0, 0, 1, o[0], o[1]];
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.split(/[\s,]+/).filter(Boolean).map(s => parseFloat(s));
    let f: M;
    switch (fn) {
      case "translate": f = [1, 0, 0, 1, v[0], v[1] ?? 0]; break;
      case "translateX": f = [1, 0, 0, 1, v[0], 0]; break;
      case "translateY": f = [1, 0, 0, 1, 0, v[0]]; break;
      case "rotate": { const a = v[0] * Math.PI / 180; f = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]; break; }
      case "scale": f = [v[0], 0, 0, v[1] ?? v[0], 0, 0]; break;
      case "scaleX": f = [v[0], 0, 0, 1, 0, 0]; break;
      case "scaleY": f = [1, 0, 0, v[0], 0, 0]; break;
      default: throw new Error(`unknown CSS transform ${fn}`);
    }
    m = mul(m, f);
  }
  return mul(m, [1, 0, 0, 1, -o[0], -o[1]]);
}

const mapCmds = (cmds: Cmd[], m: M): Cmd[] => cmds.map(c => {
  if (c[0] === "Z") return c;
  const out: (string | number)[] = [c[0]];
  for (let i = 1; i < c.length; i += 2) out.push(...at(m, c[i] as number, c[i + 1] as number));
  return out as Cmd;
});

/** The box of a part's points and control points (a CSS fill-box, near enough for a pivot at its centre). */
function boxOf(shapes: KShape[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const c of s.d) for (let i = 1; i < c.length; i += 2) {
    const x = c[i] as number, y = c[i + 1] as number;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

// ---- the markup ------------------------------------------------------------------------------------

interface Node { tag: string; attrs: Record<string, string>; kids: Node[] }

/** The app's simple, well-formed SVG markup as a tree (no text, no comments, no entities). */
export function parseSvg(src: string): Node {
  const root: Node = { tag: "root", attrs: {}, kids: [] }, stack = [root];
  for (const [, close, tag, rest, self] of src.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    if (close) { const top = stack.pop(); if (!top || top.tag !== tag) throw new Error(`</${tag}> does not close <${top?.tag}>`); continue; }
    const attrs: Record<string, string> = {};
    for (const [, k, v] of rest.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[k] = v;
    const node: Node = { tag, attrs, kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!self) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].tag}> is not closed`);
  return root;
}

const INHERITED = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-dasharray", "paint-order"] as const;
type Style = Partial<Record<(typeof INHERITED)[number], string>>;
const nameOf = (n: Node) => (n.attrs.class ?? "").split(/\s+/).filter(c => c.startsWith("k-")).pop()?.slice(2);
const isHidden = (n: Node) => n.attrs.display === "none" || n.attrs.opacity === "0" || /scale\(\s*1[\s,]+0\s*\)/.test(n.attrs.transform ?? "");
const LEFT_OUT = new Set(["fx", "ledge"]);

/** One drawn element as a shape, its style resolved. */
function shapeOf(n: Node, st: Style): KShape {
  const num = (k: string) => parseFloat(n.attrs[k] ?? "0");
  const d = n.tag === "path" ? parsePath(n.attrs.d ?? "") : n.tag === "circle" ? ellipseCmds(num("cx"), num("cy"), num("r"), num("r")) : ellipseCmds(num("cx"), num("cy"), num("rx"), num("ry"));
  const s: KShape = { d: d.map(c => c.map(v => (typeof v === "number" ? r3(v) : v)) as Cmd) };
  const fill = st.fill ?? "#000";
  if (fill !== "none") s.fill = fill;
  if (st.stroke && st.stroke !== "none") {
    s.stroke = st.stroke; s.width = parseFloat(st["stroke-width"] ?? "1");
    if (s.fill && st["paint-order"] === "stroke") s.under = true;
    if (st["stroke-linecap"] === "round") s.cap = "round";
    if (st["stroke-dasharray"]) s.dash = st["stroke-dasharray"].split(/[\s,]+/).map(Number);
  }
  const op = n.attrs.opacity;
  if (op !== undefined && op !== "0" && Number(op) !== 1) s.opacity = Number(op);
  return s;
}

/** The parts of a figure in drawing order: named elements, and runs of unnamed shapes under their parent. */
export function partsOf(root: Node): KPart[] {
  const parts: KPart[] = [];
  const walk = (n: Node, st: Style, owner: string, hidden: boolean, runs: Map<string, number>, cur: { part: KPart | null }) => {
    for (const k of n.kids) {
      const style: Style = { ...st };
      for (const a of INHERITED) if (k.attrs[a] !== undefined) style[a] = k.attrs[a];
      const name = nameOf(k), hid = hidden || isHidden(k);
      if (name && LEFT_OUT.has(name)) continue;
      if (name) {
        const id = owner && owner !== "bird" ? `${owner}.${name}` : name;
        cur.part = null;
        if (k.tag === "g") {
          const sub = { part: null as KPart | null }, subRuns = new Map<string, number>();
          walk(k, style, id, hid, subRuns, sub);
        } else parts.push({ id, shapes: [shapeOf(k, style)], ...(hid ? { hidden: true as const } : {}) });
        cur.part = null;
        continue;
      }
      if (k.tag === "g") { walk(k, style, owner, hid, runs, cur); continue; }
      if (!["path", "circle", "ellipse"].includes(k.tag)) throw new Error(`unexpected <${k.tag}>`);
      if (!cur.part || !!cur.part.hidden !== hid) {
        const nth = (runs.get(owner) ?? 0) + 1;
        runs.set(owner, nth);
        cur.part = { id: nth === 1 ? owner : `${owner}#${nth}`, shapes: [], ...(hid ? { hidden: true as const } : {}) };
        parts.push(cur.part);
      }
      cur.part.shapes.push(shapeOf(k, style));
    }
  };
  walk(root, {}, "", false, new Map(), { part: null });
  // named shapes that are a group's only content keep their own id; a group's first unnamed run is the group itself
  return parts;
}

// ---- the CSS ----------------------------------------------------------------------------------------

/** One value from the CSS, or an error naming what was not found (the app's CSS changed shape). */
function grab(css: string, re: RegExp, what: string): RegExpMatchArray {
  const m = css.match(re);
  if (!m) throw new Error(`kerim.css: ${what} not found (${re})`);
  return m;
}

const PIVOTS = ["bird", "head", "eye", "eye2", "wing", "wingFar", "tail", "body", "legs", "beak-lo"] as const;

function cssData(css: string) {
  const pivots: Record<string, Vec> = {};
  for (const p of PIVOTS) {
    const m = grab(css, new RegExp(`\\.kerim \\.k-${p}(?:,[^{]*)?\\{transform-origin:([\\d.]+)px ([\\d.]+)px\\}`), `the ${p} pivot`);
    pivots[p] = [Number(m[1]), Number(m[2])];
  }
  const deg = (s: string) => Number(grab(s, /rotate\((-?[\d.]+)deg\)/, "a rotation")[1]);
  const flap = grab(css, /@keyframes k-flap\{from\{transform:([^}]*)\}to\{transform:([^}]*)\}\}/, "k-flap");
  const flapFar = grab(css, /@keyframes k-flapfar\{from\{transform:([^}]*)\}to\{transform:([^}]*)\}\}/, "k-flapfar");
  const flapMs = Number(grab(css, /\.kerim\.pose-flying \.k-wing\{animation:k-flap ([\d.]+)s/, "the flap's length")[1]) * 1000;
  const glide = grab(css, /@keyframes k-glide\{from\{transform:translateY\((-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)\}to\{transform:translateY\((-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)\}\}/, "k-glide");
  const glideMs = Number(grab(css, /\.kerim\.pose-flying \.k-bird\{animation:k-glide ([\d.]+)s/, "the glide's length")[1]) * 1000;
  const lift = grab(css, /\.kerim\.pose-flying \.k-bird\{transform:translateY\((-?[\d.]+)px\) rotate\((-?[\d.]+)deg\)\}/, "the flying lift");
  const head = grab(css, /\.kerim\.pose-flying \.k-head\{transform:rotate\((-?[\d.]+)deg\)\}/, "the head in flight");
  const fan = grab(css, /\.kerim\.pose-flying \.k-tail\{transform:([^}]*)\}/, "the tail's fan")[1];
  const big = Number(grab(css, /\.kerim\.happy \.k-eye,\.kerim\.happy \.k-eye2(?:,[^{]*)?\{transform:scale\(([\d.]+)\)\}/, "the happy eyes' scale")[1]);
  return {
    pivots, fan, big,
    flight: { flap: [deg(flap[1]), deg(flap[2])] as Vec, flapFar: [deg(flapFar[1]), deg(flapFar[2])] as Vec, flapMs,
      glide: { dy: [Number(glide[1]), Number(glide[3])] as Vec, rot: [Number(glide[2]), Number(glide[4])] as Vec, ms: glideMs },
      lift: { dy: Number(lift[1]), rot: Number(lift[2]) }, head: Number(head[1]) },
  };
}

// ---- the file ----------------------------------------------------------------------------------------

/** The generated module's text, from the app's art and CSS (overridable for the tests). */
export async function build(o: { art?: URL; css?: URL } = {}): Promise<string> {
  const artUrl = o.art ?? ART, cssUrl = o.css ?? CSS;
  let mod: Record<string, unknown>;
  try { mod = await import(artUrl.href); } catch (e) { throw new Error(`Kerim's art is not at ${artUrl.pathname}: ${(e as Error).message}`); }
  const bird = mod.K_BIRD, moods = mod.K_MOODS;
  if (typeof bird !== "string" || !Array.isArray(moods)) throw new Error(`${artUrl.pathname} has no K_BIRD or K_MOODS`);
  const css = readFileSync(cssUrl, "utf8"), c = cssData(css);
  const parts = partsOf(parseSvg(bird));
  const byId = (id: string) => { const p = parts.find(x => x.id === id); if (!p) throw new Error(`no part ${id} in K_BIRD`); return p; };
  // the variants CSS makes by transform: the fanned tail, the eyes opened wide, the smile turned over, the moods' brows
  const variant = (id: string, m: M, as: string): KPart => ({ id: as, shapes: byId(id).shapes.map(s => ({ ...s, d: mapCmds(s.d, m).map(cmd => cmd.map(v => (typeof v === "number" ? r3(v) : v)) as Cmd) })), hidden: true });
  const extra: KPart[] = [variant("tail", cssMatrix(c.fan, c.pivots.tail), "tail@fan")];
  for (const eye of ["eye", "eye2"] as const) for (const p of parts.filter(x => x.id === `head.${eye}` || x.id.startsWith(`head.${eye}.`)))
    extra.push(variant(p.id, cssMatrix(`scale(${c.big})`, c.pivots[eye]), `${p.id}@big`));
  const mid = (id: string): Vec => { const b = boxOf(byId(id).shapes); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
  extra.push(variant("head.smile", cssMatrix("scaleY(-1)", mid("head.smile")), "head.smile@sad"));
  // the brows each mood moves (on their own box): raised when happy, worried when sad, the far one up when thinking; brow2 is a .k-brow too
  const brow = (mood: string, cls: string) => grab(css, new RegExp(`\\.kerim\\.${mood} \\.k-${cls}\\{[^}]*?transform:([^;}]+)`), `the ${mood} ${cls}`)[1];
  for (const [mood, b2] of [["happy", "brow"], ["sad", "brow2"], ["think", "brow2"]]) for (const id of mood === "think" ? ["brow2"] : ["brow", "brow2"])
    extra.push(variant(`head.${id}`, cssMatrix(brow(mood, id === "brow" ? "brow" : b2), mid(`head.${id}`)), `head.${id}@${mood}`));
  const all = [...parts, ...extra];
  const json = (v: unknown) => JSON.stringify(v);
  return [
    "// Generated by `node packages/sahne-kit/kerim/build.ts` from src/kerim/art.ts and src/kerim/kerim.css; do not edit.",
    "// Kerim's parts in drawing order, in the art's own 100-unit box (y down; her feet at about 55, 87).",
    "",
    'import type { Cmd } from "sahne";',
    "",
    "/** One shape of a part: the path in art units, its fill, and its stroke (painted under the fill when `under`). */",
    "export interface KShape { d: Cmd[]; fill?: string; stroke?: string; width?: number; under?: true; cap?: \"round\"; dash?: number[]; opacity?: number }",
    "/** A part: hidden ones are shown only by a pose or a mood (the spread wing, the lids, a variant). */",
    "export interface KPart { id: string; shapes: KShape[]; hidden?: true }",
    "",
    "export const KERIM_PARTS: KPart[] = [",
    ...all.map(p => `  ${json(p)},`),
    "];",
    "",
    "/** The pivots of kerim.css, in art units. */",
    `export const KERIM_PIVOTS: Record<string, [number, number]> = ${json(c.pivots)};`,
    "",
    "/** Flight from kerim.css: the wings' flap (degrees, from → to, `flapMs` each way), the glide and the lift (art units, degrees), the head's turn. */",
    `export const KERIM_FLIGHT = ${json(c.flight)};`,
    "",
    "/** The app's mood names (art.ts K_MOODS). */",
    `export const KERIM_MOODS: string[] = ${json(moods)};`,
    "",
  ].join("\n");
}

/** The problems, none when the generated file is current. */
export async function check(o: { art?: URL; css?: URL } = {}): Promise<string[]> {
  let want: string;
  try { want = await build(o); } catch (e) { return [(e as Error).message]; }
  let have = "";
  try { have = readFileSync(OUT, "utf8"); } catch { return ["src/kerim/art.gen.ts is missing: run node packages/sahne-kit/kerim/build.ts"]; }
  return have === want ? [] : ["src/kerim/art.gen.ts is stale (her art or the app's CSS changed): run node packages/sahne-kit/kerim/build.ts"];
}

if (import.meta.filename !== process.argv[1]) { /* imported (the kit's tests): nothing to run */ }
else if (process.argv.includes("--check")) {
  const p = await check();
  for (const m of p) console.error(m);
  process.exit(p.length ? 1 : 0);
} else {
  writeFileSync(OUT, await build());
  console.log(`wrote ${OUT.pathname}`);
}
