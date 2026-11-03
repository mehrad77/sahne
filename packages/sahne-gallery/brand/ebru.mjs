// Ebru, the Turkish marbled paper, from a seed: the window of the Sahne mark. The same seed always makes the
// same ebru. A seed is hashed into a random stream that picks the pattern and every stroke; the colours come
// from a palette (a package's own, brand/build.mjs), or from the seed when none is given.
//
// The strokes are the marbling maths, applied to ink polygons on the water:
// - a drop of ink at c with radius r pushes every earlier point p out to c + (p − c)·√(1 + r²/|p − c|²);
// - a comb (a tine drawn along a line, direction m) moves p by m·α·λ/(d + λ), d its distance to the line;
// - a swirl turns p about c by θ·e^(−|p − c|/λ).
// Each stroke moves every point on its own, so the ink of a later seed dropped over an earlier one ends exactly
// where it would on clean water: that is the morph (run's `start`).
// Coordinates are the mark's 100 × 100 box; the window is x 30–70, y 29–88.

/** Palettes a seed picks from when it has none of its own: [water, ink, ink, ink, ink]. */
export const PALETTES = [
  ["#F6E3BE", "#1C2246", "#2F8C88", "#C8463A", "#FBF3E2"],
  ["#1C2246", "#FBE6BC", "#2F8C88", "#D8A440", "#5D72B4"],
  ["#F2B36E", "#C4643A", "#FFE6B8", "#7A3A4A", "#1C2246"],
  ["#E7EFE2", "#3E9A7E", "#2F6F5E", "#C8463A", "#FBE6BC"],
  ["#E9D6B0", "#B98A5A", "#D8A440", "#8E6640", "#1C2246"],
  ["#F4D4CC", "#C8463A", "#1C2246", "#FBE6BC", "#9C5F7C"],
];
/** The four patterns: scattered stones, combed back and forth, combed both ways, the nightingale's nest. */
export const STYLES = ["battal", "gelgit", "şal", "bülbül yuvası"];

export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function rngFrom(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed becomes a recipe: its palette (`palette`, or one the seed picks), its pattern and its strokes. */
export function recipe(seed, palette) {
  const r = rngFrom(hashSeed(seed));
  const picked = PALETTES[Math.floor(r() * PALETTES.length)];
  const c = palette ?? picked;
  const style = Math.floor(r() * STYLES.length);
  const ops = [];
  if (style === 0) {
    const n = 16 + Math.floor(r() * 10);
    for (let i = 0; i < n; i++) ops.push({ k: "drop", x: 28 + r() * 44, y: 26 + r() * 62, r: 3 + r() * 5, c: c[1 + (i % 4)] });
  } else {
    const n = 8 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) ops.push({ k: "drop", x: 50 + (r() - 0.5) * 16, y: 58 + (r() - 0.5) * 24, r: 4 + r() * 5, c: c[1 + (i % 4)] });
    const a = 7 + r() * 6, step = 5 + Math.floor(r() * 3);
    let dir = 1;
    for (let x = 24; x <= 76; x += step) { ops.push({ k: "tine", bx: x, by: 0, mx: 0, my: dir, a, l: 2.5 }); dir = -dir; }
    if (style === 2) {
      dir = 1;
      for (let y = 26; y <= 90; y += 7) { ops.push({ k: "tine", bx: 0, by: y, mx: dir, my: 0, a: a * 0.6, l: 2 }); dir = -dir; }
    }
    if (style === 3) {
      let turn = 1;
      for (let vy = 40; vy <= 82; vy += 13) for (let vx = 36; vx <= 64; vx += 10) {
        ops.push({ k: "swirl", x: vx + (r() - 0.5) * 3, y: vy + (r() - 0.5) * 3, a: turn * (1.6 + r()), l: 3.5 });
        turn = -turn;
      }
    }
  }
  return { water: c[0], palette: c, style: STYLES[style], ops };
}

function circle(x, y, r) {
  const pts = [], n = 72;
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push(x + Math.cos(t) * r, y + Math.sin(t) * r); }
  return pts;
}
const inView = (x, y) => x > 14 && x < 86 && y > 14 && y < 100;
/** Adds points where ink has been stretched near the window, so its curves stay smooth. */
function refine(pts) {
  const out = [], n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x1 = pts[2 * i], y1 = pts[2 * i + 1], x2 = pts[2 * j], y2 = pts[2 * j + 1];
    out.push(x1, y1);
    const dx = x2 - x1, dy = y2 - y1;
    if (out.length < 1800 && dx * dx + dy * dy > 2.25 && (inView(x1, y1) || inView(x2, y2))) out.push((x1 + x2) / 2, (y1 + y2) / 2);
  }
  return out;
}
function apply(polys, op, s) {
  for (const poly of polys) {
    const pts = poly.pts;
    for (let i = 0; i < pts.length; i += 2) {
      let x = pts[i], y = pts[i + 1];
      if (op.k === "drop") {
        const dx = x - op.x, dy = y - op.y, d2 = dx * dx + dy * dy, rr = op.r * s;
        if (d2 > 1e-9) { const f = Math.sqrt(1 + (rr * rr) / d2); x = op.x + dx * f; y = op.y + dy * f; }
      } else if (op.k === "tine") {
        const d = Math.abs((x - op.bx) * -op.my + (y - op.by) * op.mx);
        const m = (op.a * s * op.l) / (d + op.l);
        x += m * op.mx; y += m * op.my;
      } else {
        const ex = x - op.x, ey = y - op.y, th = op.a * s * Math.exp(-Math.sqrt(ex * ex + ey * ey) / op.l);
        const co = Math.cos(th), si = Math.sin(th);
        x = op.x + ex * co - ey * si; y = op.y + ex * si + ey * co;
      }
      pts[i] = x; pts[i + 1] = y;
    }
    poly.pts = refine(pts);
  }
  if (op.k === "drop" && op.r * s > 0.05) polys.push({ pts: circle(op.x, op.y, op.r * s), fill: op.c });
}

/** Runs a recipe's strokes up to `upto` (fractional: the last one part done, for the "make it" animation), on
 * top of the ink already in `start` (another seed's, for a morph; it is changed). Returns the ink polygons. */
export function run(ops, upto = ops.length, start = []) {
  const polys = start, whole = Math.floor(upto);
  for (let i = 0; i < ops.length && i <= whole; i++) {
    const s = i < whole ? 1 : upto - whole;
    if (s <= 0) break;
    apply(polys, ops[i], i < whole ? 1 : s * s * (3 - 2 * s));
  }
  return polys;
}

/** The ink as SVG path data, one `{ d, fill }` per polygon, back to front. */
export function inkPaths(polys) {
  return polys.map(({ pts, fill }) => {
    let d = "";
    for (let i = 0; i < pts.length; i += 2) d += (i ? "L" : "M") + pts[i].toFixed(1) + " " + pts[i + 1].toFixed(1);
    return { d: d + "Z", fill };
  });
}
