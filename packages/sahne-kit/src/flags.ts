// The flags of Europe as cut paper: one compact design per country, a grid (width, height), the colour of the
// cloth and a list of ops in grid units (y down). `flagCloth` draws any of them rippling like the Turkish one
// always did. Ids are ISO 3166 lowercase (and gb_eng, gb_sct, gb_wls, eu) and permanent. The arms on a flag are
// stylised from description, never traced; they are drawn to read at a glance, not to be heraldry.
//
// Ops (colours are rrggbb): h/v "c1 c2*2 c3" stripes by weight; r x y w h c; + c t cx cy (a cross the whole
// flag long, bars t thick); x c t off (a saltire; off counterchanges it); p c x y x y…; o c cx cy r; k c cx cy R r
// (a ring); * c cx cy R rot n (a star); A c cx cy R a0 a1 n r (stars on an arc, degrees); L c x0 y0 x1 y1 n r
// (stars on a line); c c cx cy size t (a small cross); D c cx cy r (a diamond); S c cx cy w edge (a shield);
// q c x y s n (a chequer); E c cx cy s heads (an eagle); C c cx baseY w (a crown); Y c cx cy r (sun rays).

import { poly, rect, ellipse, smooth, tone, type Shape, type Vec2 } from "sahne";
import { S, type Pt } from "./set/draw.ts";

type Op = (string | number)[];
type Def = [number, number, string, ...Op[]];

/** The Turkish flag's red (the flag law's). */
const TR = "#E30A17";

const F: Record<string, Def> = {
  al: [7, 5, "E41E20", ["E", "000000", 3.5, 2.5, 3.4, 2]],
  ad: [10, 7, "0018A8", ["v", "0018A8*8 FEDF00*9 D0103A*8"], ["S", "FEDF00", 5, 3.5, 1.9, "8A6A2A"], ["r", 4.45, 2.75, 0.22, 1.3, "D0103A"], ["r", 5.0, 2.75, 0.22, 1.3, "D0103A"], ["r", 5.55, 2.75, 0.22, 1.3, "D0103A"]],
  am: [6, 3, "D90012", ["h", "D90012 0033A0 F2A800"]],
  at: [3, 2, "ED2939", ["h", "ED2939 FFFFFF ED2939"]],
  az: [6, 3, "00B5E2", ["h", "00B5E2 EF3340 509E2F"], ["o", "FFFFFF", 2.85, 1.5, 0.5], ["o", "EF3340", 3.0, 1.5, 0.4], ["*", "FFFFFF", 3.5, 1.5, 0.22, 0, 8]],
  by: [18, 9, "C8313E", ["r", 0, 6, 18, 3, "4CA64C"], ["r", 0, 0, 2, 9, "FFFFFF"], ["D", "C8313E", 1, 1.5, 0.6], ["D", "C8313E", 1, 4.5, 0.6], ["D", "C8313E", 1, 7.5, 0.6]],
  be: [15, 13, "000000", ["v", "000000 FAE042 ED2939"]],
  ba: [8, 4, "002395", ["p", "FECB00", 2.2, 0, 6.4, 0, 6.4, 4], ["L", "FFFFFF", 2.9, 0.35, 6.1, 3.4, 7, 0.28]],
  bg: [5, 3, "FFFFFF", ["h", "FFFFFF 00966E D62612"]],
  hr: [6, 3, "FF0000", ["h", "FF0000 FFFFFF 171796"], ["S", "FFFFFF", 3, 1.5, 1.05, "FF0000"], ["q", "FF0000", 2.65, 1.2, 0.7, 5], ["C", "171796", 3, 0.9, 0.95]],
  cy: [5, 3, "FFFFFF", ["p", "D57800", 1.35, 1.55, 1.6, 1.35, 1.95, 1.38, 2.3, 1.2, 2.8, 1.15, 3.2, 1.0, 3.55, 0.85, 3.95, 0.8, 3.7, 0.95, 3.5, 1.15, 3.3, 1.35, 3.0, 1.55, 2.6, 1.7, 2.2, 1.75, 1.8, 1.7, 1.5, 1.7], ["p", "4E9A2F", 1.6, 2.05, 2.0, 2.3, 2.5, 2.4, 3.0, 2.3, 3.4, 2.05, 3.3, 2.35, 3.0, 2.55, 2.5, 2.65, 2.0, 2.55, 1.7, 2.35]],
  cz: [3, 2, "FFFFFF", ["r", 0, 1, 3, 1, "D7141A"], ["p", "11457E", 0, 0, 1.5, 1, 0, 2]],
  dk: [37, 28, "C8102E", ["+", "FFFFFF", 4, 14, 14]],
  ee: [11, 7, "0072CE", ["h", "0072CE 000000 FFFFFF"]],
  fi: [18, 11, "FFFFFF", ["+", "003580", 3, 6.5, 5.5]],
  fr: [3, 2, "0055A4", ["v", "0055A4 FFFFFF EF4135"]],
  ge: [15, 10, "FFFFFF", ["+", "FF0000", 2, 7.5, 5], ["c", "FF0000", 3.75, 2.5, 1.5, 0.45], ["c", "FF0000", 11.25, 2.5, 1.5, 0.45], ["c", "FF0000", 3.75, 7.5, 1.5, 0.45], ["c", "FF0000", 11.25, 7.5, 1.5, 0.45]],
  de: [5, 3, "000000", ["h", "000000 DD0000 FFCE00"]],
  gr: [27, 18, "0D5EAF", ["h", "0D5EAF FFFFFF 0D5EAF FFFFFF 0D5EAF FFFFFF 0D5EAF FFFFFF 0D5EAF"], ["r", 0, 0, 10, 10, "0D5EAF"], ["r", 4, 0, 2, 10, "FFFFFF"], ["r", 0, 4, 10, 2, "FFFFFF"]],
  hu: [6, 3, "CD2A3E", ["h", "CD2A3E FFFFFF 436F4D"]],
  is: [25, 18, "02529C", ["+", "FFFFFF", 4, 9, 9], ["+", "DC1E35", 2, 9, 9]],
  ie: [6, 3, "169B62", ["v", "169B62 FFFFFF FF883E"]],
  it: [3, 2, "008C45", ["v", "008C45 FFFFFF CD212A"]],
  xk: [15, 10, "244AA5", ["p", "D0A650", 5.9, 4.3, 6.4, 3.3, 7.3, 3.0, 8.0, 2.9, 8.8, 3.4, 9.4, 4.2, 9.1, 5.0, 9.4, 5.7, 8.6, 6.3, 7.8, 6.6, 7.0, 6.3, 6.4, 5.7, 5.8, 5.1], ["A", "FFFFFF", 7.5, 5.2, 4.1, -145, -35, 6, 0.55]],
  lv: [10, 5, "9E3039", ["r", 0, 2, 10, 1, "FFFFFF"]],
  li: [5, 3, "002B7F", ["h", "002B7F CE1126"], ["C", "FFCE00", 1.1, 1.05, 0.75]],
  lt: [5, 3, "FDB913", ["h", "FDB913 006A44 C1272D"]],
  lu: [5, 3, "ED2939", ["h", "ED2939 FFFFFF 00A3E0"]],
  mt: [6, 4, "FFFFFF", ["r", 3, 0, 3, 4, "CF142B"], ["c", "9AA0A6", 1.0, 1.0, 0.95, 0.36]],
  md: [6, 3, "0046AE", ["v", "0046AE FFD200 CC092F"], ["E", "8E5B2A", 3, 1.45, 1.4, 1], ["S", "CC092F", 3, 1.7, 0.5, "8E5B2A"]],
  mc: [5, 4, "CE1126", ["h", "CE1126 FFFFFF"]],
  me: [6, 3, "D4AF37", ["r", 0.2, 0.2, 5.6, 2.6, "D3273E"], ["E", "D4AF37", 3, 1.5, 1.7, 2], ["S", "D3273E", 3, 1.65, 0.6, "D4AF37"]],
  nl: [3, 2, "AE1C28", ["h", "AE1C28 FFFFFF 21468B"]],
  mk: [8, 4, "D20000", ["Y", "F8E92E", 4, 2, 0.6], ["o", "F8E92E", 4, 2, 0.62], ["o", "D20000", 4, 2, 0.5], ["o", "F8E92E", 4, 2, 0.4]],
  no: [22, 16, "BA0C2F", ["+", "FFFFFF", 4, 8, 8], ["+", "00205B", 2, 8, 8]],
  pl: [8, 5, "FFFFFF", ["h", "FFFFFF DC143C"]],
  pt: [15, 10, "006600", ["v", "006600*2 FF0000*3"], ["o", "FFE000", 6, 5, 2.1], ["S", "FFFFFF", 6, 5, 1.7, "E10000"], ["o", "003399", 6, 4.3, 0.2], ["o", "003399", 6, 5.1, 0.2], ["o", "003399", 6, 5.9, 0.2], ["o", "003399", 5.4, 5.1, 0.2], ["o", "003399", 6.6, 5.1, 0.2]],
  ro: [3, 2, "002B7F", ["v", "002B7F FCD116 CE1126"]],
  ru: [3, 2, "FFFFFF", ["h", "FFFFFF 0039A6 D52B1E"]],
  sm: [4, 3, "FFFFFF", ["h", "FFFFFF 5EB6E4"], ["k", "4E9A2F", 2, 1.55, 0.62, 0.5], ["S", "FFFFFF", 2, 1.5, 0.75, "0F6FC6"], ["C", "D4AF37", 2, 0.95, 0.6]],
  rs: [9, 6, "C6363C", ["h", "C6363C 0C4076 FFFFFF"], ["E", "F4F4F4", 3, 3, 2.8, 2], ["S", "C6363C", 3, 3.35, 1.3, "FFFFFF"], ["c", "FFFFFF", 3, 3.25, 0.7, 0.17], ["C", "D4AF37", 3, 1.75, 1.0]],
  sk: [9, 6, "FFFFFF", ["h", "FFFFFF 0B4EA2 EE1C25"], ["S", "EE1C25", 3, 3, 2.3, "FFFFFF"], ["p", "0B4EA2", 2.5, 4.0, 2.8, 3.5, 3.0, 3.8, 3.2, 3.5, 3.5, 4.0], ["r", 2.9, 2.2, 0.2, 1.6, "FFFFFF"], ["r", 2.5, 2.55, 1.0, 0.17, "FFFFFF"], ["r", 2.6, 2.95, 0.8, 0.17, "FFFFFF"]],
  si: [6, 3, "FFFFFF", ["h", "FFFFFF 005DA4 ED1C24"], ["S", "005DA4", 1.15, 1.0, 1.0, "ED1C24"], ["p", "FFFFFF", 0.8, 1.45, 1.0, 1.1, 1.15, 1.25, 1.3, 1.0, 1.5, 1.45], ["*", "FFD700", 0.9, 0.75, 0.1, 0, 5], ["*", "FFD700", 1.4, 0.75, 0.1, 0, 5], ["*", "FFD700", 1.15, 0.58, 0.1, 0, 5]],
  es: [12, 8, "C60B1E", ["h", "C60B1E FFC400*2 C60B1E"], ["r", 3.2, 3.3, 0.3, 1.7, "E8E8E8"], ["r", 5.5, 3.3, 0.3, 1.7, "E8E8E8"], ["S", "C60B1E", 4.5, 4.1, 1.7, "D4A017"], ["r", 4.43, 3.2, 0.14, 1.6, "D4A017"], ["r", 3.85, 3.95, 1.3, 0.14, "D4A017"], ["C", "D4A017", 4.5, 3.15, 0.9]],
  se: [16, 10, "006AA7", ["+", "FECC00", 2, 6, 5]],
  ch: [32, 32, "DA291C", ["r", 13, 6, 6, 20, "FFFFFF"], ["r", 6, 13, 20, 6, "FFFFFF"]],
  ua: [3, 2, "0057B7", ["h", "0057B7 FFD700"]],
  gb: [60, 30, "012169", ["x", "FFFFFF", 6, 0], ["x", "C8102E", 2, 1.2], ["+", "FFFFFF", 10, 30, 15], ["+", "C8102E", 6, 30, 15]],
  va: [8, 8, "FFE000", ["r", 4, 0, 4, 8, "FFFFFF"], ["p", "D4AF37", 5.16, 2.67, 5.44, 2.53, 7.24, 6.33, 6.96, 6.47], ["p", "B9BEC4", 6.84, 2.67, 6.56, 2.53, 4.76, 6.33, 5.04, 6.47], ["k", "D4AF37", 5.3, 2.5, 0.6, 0.3], ["k", "B9BEC4", 6.7, 2.5, 0.6, 0.3], ["r", 7.0, 5.6, 0.55, 0.3, "D4AF37"], ["r", 4.45, 5.6, 0.55, 0.3, "B9BEC4"], ["C", "B9BEC4", 6, 2.0, 1.6], ["r", 5.2, 2.0, 1.6, 0.22, "D4AF37"]],
  eu: [18, 12, "003399", ["A", "FFCC00", 9, 6, 4, -90, 270, 12, 0.9]],
  gb_eng: [5, 3, "FFFFFF", ["+", "CE1124", 0.6, 2.5, 1.5]],
  gb_sct: [5, 3, "0065BD", ["x", "FFFFFF", 0.6, 0]],
  gb_wls: [5, 3, "FFFFFF", ["r", 0, 1.5, 5, 1.5, "00B140"], ["p", "D30731", 1.7, 1.05, 1.75, 0.85, 1.95, 0.8, 2.15, 0.95, 2.25, 1.2, 2.5, 1.35, 3.0, 1.35, 3.35, 1.5, 3.7, 1.75, 4.1, 1.75, 4.4, 1.6, 4.3, 1.9, 3.9, 2.1, 3.4, 2.05, 3.0, 1.9, 2.6, 1.95, 2.35, 1.75, 2.1, 1.45, 1.95, 1.15], ["p", "D30731", 2.5, 1.3, 2.35, 0.6, 2.7, 0.8, 2.95, 0.45, 3.1, 0.9, 3.45, 0.7, 3.3, 1.35], ["p", "D30731", 2.4, 1.8, 2.2, 2.35, 2.5, 2.35, 2.7, 1.9], ["p", "D30731", 3.0, 1.9, 3.0, 2.4, 3.3, 2.4, 3.35, 1.85]],
};

/** Every flag id, Turkey first: the values of a `country` param. */
export const COUNTRIES: string[] = ["tr", ...Object.keys(F)];
/** A country id from a param, else Turkey. */
export const countryOf = (c: unknown): string => typeof c === "string" && (c === "tr" || F[c]) ? c : "tr";
/** The cloth's length for a height `h`: Turkey's 1.5 h, a Swiss flag's h. */
export const flagWidth = (h: number, country = "tr"): number => { const c = countryOf(country); return c === "tr" ? h * 1.5 : h * F[c][0] / F[c][1]; };

const deg = Math.PI / 180;
const arc = (cx: number, cy: number, r: number, n = 18): Vec2[] => Array.from({ length: n }, (_, i): Vec2 => [cx + Math.cos(i / n * 2 * Math.PI) * r, cy + Math.sin(i / n * 2 * Math.PI) * r]);
const starAt = (cx: number, cy: number, R: number, rot: number, n: number): Vec2[] => Array.from({ length: n * 2 }, (_, i): Vec2 => { const a = (-90 + rot) * deg + i * Math.PI / n, q = i % 2 ? R * (n === 5 ? 0.382 : 0.62) : R; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; });
const SHIELD: Vec2[] = [[-0.5, -0.55], [0.5, -0.55], [0.5, 0.05], [0.42, 0.3], [0.25, 0.48], [0, 0.6], [-0.25, 0.48], [-0.42, 0.3], [-0.5, 0.05]];
const WING: Vec2[] = [[0, -0.45], [0.22, -0.5], [0.5, -0.58], [0.95, -0.66], [0.88, -0.42], [1, -0.34], [0.86, -0.22], [0.95, -0.05], [0.74, 0.08], [0.78, 0.28], [0.5, 0.28], [0.34, 0.4], [0.38, 0.75], [0.18, 0.98], [0, 0.82]];
const mirror = (right: Vec2[]): Vec2[] => [...right, ...right.slice(1, -1).reverse().map(([x, y]): Vec2 => [-x, y])];

function build(d: Def, h: number, amp: number, ph: number): Shape[] {
  const [W, H, bg] = d, k = h / H, Lf = W * k, wv = (x: number) => amp * h * Math.sin(x / Lf * 5 + ph) * x / Lf;
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const x = Lf * i / 10, e = i % 10 !== 0; top.push(e ? [x, wv(x)] : [x, wv(x), 0]); bot.unshift(e ? [x, h + wv(x)] : [x, h + wv(x), 0]); }
  const cloth = smooth([...top, ...bot], true, 1), step = W / 12;
  const warp = (pts: Vec2[]): Vec2[] => {
    const out: Vec2[] = [], m = (x: number, y: number): Vec2 => [x * k, y * k + wv(x * k)];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      out.push(m(a[0], a[1]));
      if (amp) { const s = Math.ceil(Math.abs(b[0] - a[0]) / step); for (let j = 1; j < s; j++) out.push(m(a[0] + (b[0] - a[0]) * j / s, a[1] + (b[1] - a[1]) * j / s)); }
    });
    return out;
  };
  const pg = (pts: Vec2[], c: string, o: Partial<Shape> = {}): Shape => S(poly(warp(pts)), "#" + c, { flat: true, ...o });
  const out: Shape[] = [S(cloth, "#" + bg)], pairs = (a: number[]): Vec2[] => a.flatMap((_, i): Vec2[] => i % 2 ? [] : [[a[i], a[i + 1]]]);
  const rc = (x: number, y: number, w: number, hh: number): Vec2[] => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  for (const o of d.slice(3) as Op[]) {
    const c = String(o[1]), a = (i: number) => Number(o[i]);
    switch (o[0]) {
      case "h": case "v": {
        const st = c.split(" ").map(t => { const [col, wt] = t.split("*"); return [col, +(wt ?? 1)] as [string, number]; }), tot = st.reduce((s, t) => s + t[1], 0), len = o[0] === "h" ? H : W;
        let at = 0;
        for (const [col, wt] of st) { const l = len * wt / tot; if (col !== bg) out.push(pg(o[0] === "h" ? rc(0, at, W, l) : rc(at, 0, l, H), col)); at += l; }
        break;
      }
      case "r": out.push(pg(rc(a(1), a(2), a(3), a(4)), String(o[5]))); break;
      case "+": out.push(pg(rc(0, a(4) - a(2) / 2, W, a(2)), c), pg(rc(a(3) - a(2) / 2, 0, a(2), H), c)); break;
      case "c": { const t = a(5); out.push(pg(rc(a(2) - a(4) / 2, a(3) - t / 2, a(4), t), c), pg(rc(a(2) - t / 2, a(3) - a(4) / 2, t, a(4)), c)); break; }
      case "x": {
        const t = a(2), cx = W / 2, cy = H / 2;
        for (const [sx, sy, off] of [[0, 0, 1], [W, 0, -1], [0, H, 1], [W, H, -1]] as const) {
          const x0 = sx + (sx - cx) * 0.2, y0 = sy + (sy - cy) * 0.2, o2 = off * a(3);
          out.push(pg([[x0, y0 + o2 - t / 2], [cx, cy + o2 - t / 2], [cx, cy + o2 + t / 2], [x0, y0 + o2 + t / 2]], c, { clip: cloth }));
        }
        break;
      }
      case "p": out.push(pg(pairs(o.slice(2) as number[]), c)); break;
      case "D": out.push(pg([[a(2), a(3) - a(4)], [a(2) + a(4) * 0.6, a(3)], [a(2), a(3) + a(4)], [a(2) - a(4) * 0.6, a(3)]], c)); break;
      case "o": out.push(pg(arc(a(2), a(3), a(4)), c)); break;
      case "k": out.push({ ...pg(arc(a(2), a(3), a(4), 24), c), path: poly(warp(arc(a(2), a(3), a(4), 24))).add(poly(warp(arc(a(2), a(3), a(5), 24)))), evenodd: true }); break;
      case "*": out.push(pg(starAt(a(2), a(3), a(4), a(5), a(6)), c)); break;
      case "A": { const n = a(7), full = a(6) - a(5) >= 360; for (let i = 0; i < n; i++) { const an = (a(5) + (a(6) - a(5)) * i / (full ? n : n - 1)) * deg; out.push(pg(starAt(a(2) + Math.cos(an) * a(4), a(3) + Math.sin(an) * a(4), a(8), 0, 5), c)); } break; }
      case "L": { const n = a(6); for (let i = 0; i < n; i++) out.push(pg(starAt(a(2) + (a(4) - a(2)) * i / (n - 1), a(3) + (a(5) - a(3)) * i / (n - 1), a(7), 0, 5), c)); break; }
      case "S": { const cx = a(2), cy = a(3), w = a(4), sh = (s: number) => SHIELD.map(([x, y]): Vec2 => [cx + x * w * s, cy + y * w * s]); if (o[5]) out.push(pg(sh(1), String(o[5]))); out.push(pg(sh(o[5] ? 0.82 : 1), c)); break; }
      case "q": { const n = a(5), cs = a(4) / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) out.push(pg(rc(a(2) + i * cs, a(3) + j * cs, cs, cs), c)); break; }
      case "C": { const cx = a(2), by = a(3), w = a(4); out.push(pg(([[-0.5, 0], [-0.5, -0.5], [-0.25, -0.3], [0, -0.62], [0.25, -0.3], [0.5, -0.5], [0.5, 0]] as Vec2[]).map(([x, y]): Vec2 => [cx + x * w, by + y * w]), c)); break; }
      case "E": {
        const cx = a(2), cy = a(3), s = a(4) / 2, P = (pts: Vec2[]) => pg(pts.map(([x, y]): Vec2 => [cx + x * s, cy + y * s]), c), two = a(5) === 2;
        out.push(P(mirror(WING)));
        if (two) for (const sg of [-1, 1]) out.push(P(([[0.1, -0.45], [0.42, -0.5], [0.46, -0.85], [0.3, -0.85]] as Vec2[]).map(([x, y]): Vec2 => [x * sg, y])), P(arc(0.38 * sg, -0.88, 0.17, 10)), P(([[0.5, -0.95], [0.72, -0.85], [0.5, -0.8]] as Vec2[]).map(([x, y]): Vec2 => [x * sg, y])));
        else out.push(P([[-0.12, -0.45], [0.12, -0.45], [0.1, -0.65], [-0.1, -0.65]]), P(arc(0, -0.7, 0.18, 10)), P([[0.12, -0.76], [0.36, -0.66], [0.12, -0.6]]));
        break;
      }
      case "Y": {
        const cx = a(2), cy = a(3), r0 = a(4);
        for (const [fx, fy] of [[cx, 0], [W, 0], [W, cy], [W, H], [cx, H], [0, H], [0, cy], [0, 0]]) { const an = Math.atan2(fy - cy, fx - cx), nx = -Math.sin(an) * r0 * 0.5, ny = Math.cos(an) * r0 * 0.5; out.push(pg([[fx, fy], [cx + nx, cy + ny], [cx - nx, cy - ny]], c)); }
        break;
      }
    }
  }
  // the ripple's troughs in shade, its crests catching the light (the fly moves most)
  if (amp) for (let i = 0; i < 10; i++) { const cs = Math.cos((i + 0.5) / 2 + ph); out.push(S(rect(Lf * i / 10, -h, Lf / 10 + 0.3, h * 3), cs < 0 ? "#1B222B" : "#FFFFFF", { flat: true, opacity: Math.abs(cs) * 0.3 * (i + 2) / 11, clip: cloth })); }
  return out;
}

/**
 * A flag's cloth `h` cm high, its hoist at x = 0 from y = 0 down to `h`, rippling by `amp` (of h) from phase `ph`.
 * Turkey's (the default) by the flag law's measures: 1.5 h to the fly, the crescent's outer circle h/2 across, centred
 * h/2 from the hoist; the inner one 0.4 h across, h/16 further; the star in a circle h/4 across, h/3 beyond the inner
 * circle's near edge (its centre 0.82 h from the hoist), one point towards the hoist. Any other `country` is its
 * design in the table above, `flagWidth` long.
 */
export function flagCloth(h: number, amp = 0, ph = 0, country = "tr"): Shape[] {
  const cc = countryOf(country);
  if (cc !== "tr") return build(F[cc], h, amp, ph);
  const Lf = h * 1.5, wv = (x: number) => amp * h * Math.sin(x / Lf * 5 + ph) * x / Lf, top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const x = Lf * i / 10, e = i % 10 !== 0; top.push(e ? [x, wv(x)] : [x, wv(x), 0]); bot.unshift(e ? [x, h + wv(x)] : [x, h + wv(x), 0]); }
  const cloth = smooth([...top, ...bot], true, 1), at = (k: number): Vec2 => [h * k, h / 2 + wv(h * k)], [sx, sy] = at(0.8208);
  const star: Pt[] = Array.from({ length: 10 }, (_, i) => { const a = Math.PI + i * Math.PI / 5, q = h / 8 * (i % 2 ? 0.382 : 1); return [sx + Math.cos(a) * q, sy + Math.sin(a) * q, 0]; });
  const out: Shape[] = [S(cloth, TR), S(ellipse(...at(0.5), h / 4), "#FFFFFF", { flat: true }), S(ellipse(...at(0.5625), h * 0.2), TR, { flat: true }), S(smooth(star, true, 1), "#FFFFFF", { flat: true })];
  if (amp) for (let i = 0; i < 10; i++) { const c = Math.cos((i + 0.5) / 2 + ph); out.push(S(rect(Lf * i / 10, -h, Lf / 10 + 0.3, h * 3), tone(TR, c < 0 ? "deep" : "light"), { flat: true, opacity: Math.abs(c) * 0.3 * (i + 2) / 11, clip: cloth })); }
  return out;
}

/** Shapes moved by (`dx`, `dy`), their clips with them. */
export const shifted = (sh: Shape[], dx: number, dy: number): Shape[] => sh.map(s => ({ ...s, path: s.path.move(dx, dy), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(c => c.move(dx, dy)) : s.clip.move(dx, dy) } : {}) }));
