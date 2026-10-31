// ../sahne/src/core/math.ts
var IDENTITY = [1, 0, 0, 1, 0, 0];
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
var lerp = (a, b, t) => a + (b - a) * t;
var polyLength = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
function polyAt(pts, k) {
  const lens = pts.slice(1).map((p, i2) => Math.hypot(p[0] - pts[i2][0], p[1] - pts[i2][1], p[2] - pts[i2][2])), total = lens.reduce((a2, b2) => a2 + b2, 0);
  let d = clamp(k, 0, 1) * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
  const a = pts[i], b = pts[i + 1] ?? a, f = lens[i] ? d / lens[i] : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
var smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
var apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
var translate = (x, y) => [1, 0, 0, 1, x, y];
var scale = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
var rotate = (r) => {
  const c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
};
var rotateAbout = (r, px, py) => mul(translate(px, py), mul(rotate(r), translate(-px, -py)));
function boxUnion(a, b) {
  return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b];
}
var boxPad = (b, p) => [b[0] - p, b[1] - p, b[2] + p, b[3] + p];
function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far), m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}
function lookAt(eye, target, up = [0, 1, 0]) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz) || 1;
  zx /= l;
  zy /= l;
  zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1;
  xx /= l;
  xy /= l;
  xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx;
  m[1] = yx;
  m[2] = zx;
  m[4] = xy;
  m[5] = yy;
  m[6] = zy;
  m[8] = xz;
  m[9] = yz;
  m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}
function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function project(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w, w];
}
var ease = {
  linear: (t) => t,
  inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  /** A damped spring from 0 to 1; zeta < 1 overshoots a little. */
  spring: (t, zeta = 0.62, omega = 11) => {
    if (t >= 1) return 1;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
  }
};

// ../sahne/src/core/color.ts
function hexToRgb(hex) {
  let h2 = hex.replace("#", "");
  if (h2.length === 3) h2 = h2.split("").map((c) => c + c).join("");
  const n = parseInt(h2.slice(0, 6), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function rgbToHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h2 = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h2 / 6, s, l];
}
function hslToRgb([h2, s, l]) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t % 1 + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h2 + 1 / 3), f(h2), f(h2 - 1 / 3)];
}
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function hueToward(h2, target, amt) {
  let d = target - h2;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return h2 + d * amt;
}
function tone(hex, t) {
  if (t === "base") return hex;
  const [h2, s, l] = rgbToHsl(hexToRgb(hex));
  switch (t) {
    case "shade":
      return rgbToHex(hslToRgb([hueToward(h2, 0.68, 0.08), Math.min(1, s * 1.05 + 0.03), l * 0.8]));
    case "deep":
      return rgbToHex(hslToRgb([hueToward(h2, 0.7, 0.12), Math.min(1, s * 1.1 + 0.05), l * 0.6]));
    case "light":
      return rgbToHex(hslToRgb([hueToward(h2, 0.11, 0.06), s * 0.95, l + (1 - l) * 0.22]));
    case "edge":
      return rgbToHex(hslToRgb([hueToward(h2, 0.11, 0.05), s * 0.45, l + (1 - l) * 0.62]));
  }
}
var luma = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// ../sahne/src/core/rng.ts
function hashString(s) {
  let h2 = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h2 ^= s.charCodeAt(i);
    h2 = Math.imul(h2, 16777619);
  }
  return h2 >>> 0;
}
function rng(seed) {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  const next = (() => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  });
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

// ../sahne/src/core/kit.ts
var TIMETABLE = { ms: 18e3, run: 11e3, ease: 2500, hold: 4500 };
var EMIT_KINDS = ["steam", "smoke", "flame"];
var MOTION_KINDS = ["scroll", "path", "sway", "blink"];
function withVariant(def, params) {
  const v = typeof params.variant === "string" && def.variants && Object.hasOwn(def.variants, params.variant) ? def.variants[params.variant] : void 0;
  return v ? { ...v, ...params } : params;
}
function pieceOf(kit, slot, id) {
  const table2 = kit[slot];
  if (!table2) return void 0;
  let k = id;
  for (let i = 0; i < 4 && !Object.hasOwn(table2, k) && kit.aliases && Object.hasOwn(kit.aliases, k); i++) k = kit.aliases[k];
  return Object.hasOwn(table2, k) ? table2[k] : void 0;
}

// ../sahne/src/core/lang.ts
var matchFallback = (word, token) => word.toLowerCase().startsWith(token.toLowerCase());
var VOWEL = { a: "A", e: "E", i: "I", o: "O", u: "U", y: "I" };
function speechFallback(text, o = {}) {
  const k = 1 / (o.rate ?? 1), keys = [], words = [];
  let t = 0;
  const re = /[\p{L}\p{N}'’]+|[.,!?;:…]/gu;
  for (const m of text.matchAll(re)) {
    const w = m[0];
    if (/^[.,!?;:…]$/.test(w)) {
      keys.push({ t, v: "rest" });
      t += (w === "," ? 250 : 400) * k;
      continue;
    }
    const t0 = t;
    for (const ch2 of w.toLowerCase().normalize("NFD")) {
      if (/[mbp]/.test(ch2)) {
        keys.push({ t, v: "MBP" });
        t += 60 * k;
      } else if (/[fv]/.test(ch2)) {
        keys.push({ t, v: "FV" });
        t += 60 * k;
      } else if (VOWEL[ch2]) {
        keys.push({ t, v: VOWEL[ch2] });
        t += 140 * k;
      }
    }
    if (t === t0) t += 120 * k;
    words.push({ i: m.index ?? 0, text: w, t0, t1: t });
    t += 40 * k;
  }
  keys.push({ t, v: "rest" });
  return { dur: t, keys, words };
}

// ../sahne/src/core/linematch.ts
var SLIP = 0.25;
var NAME = "\0";
var EXTRA = 0.5;
var MAX_WORDS = 40;
var MAX_CHARS = 600;
var MAX_ALTS = 10;
function lineMatcher(lang) {
  const near = lang.near ?? {}, soft = /* @__PURE__ */ new Set([...lang.soft ?? ""]);
  const fold2 = (c) => near[c] ?? c;
  const cheap = (c) => soft.has(c) ? SLIP : 1;
  function sayWords(said) {
    const out = [];
    for (const w of lang.normalise(said)) {
      if (!w || lang.fillers?.test(w)) continue;
      out.push(...(lang.spellings?.[w] ?? w).split(" "));
    }
    return out;
  }
  function letters(a, b) {
    const A = [...a], B = [...b];
    let prev = Array.from({ length: B.length + 1 }, (_, j) => B.slice(0, j).reduce((s, c) => s + cheap(c), 0));
    const rows2 = [prev];
    for (let i = 1; i <= A.length; i++) {
      const cur = [prev[0] + cheap(A[i - 1])];
      for (let j = 1; j <= B.length; j++) {
        const x = A[i - 1], y = B[j - 1];
        const sub3 = x === y ? 0 : fold2(x) === fold2(y) ? SLIP : 1;
        cur[j] = Math.min(prev[j - 1] + sub3, prev[j] + cheap(x), cur[j - 1] + cheap(y));
      }
      rows2.push(cur);
      for (let j = 0; j <= B.length; j++) {
        const x = A[i - 1], fx = [...fold2(x)];
        if (fx.length > 1 && j >= fx.length && fx.every((c, k) => B[j - fx.length + k] === c)) {
          const from = rows2[i - 1][j - fx.length] + SLIP;
          if (from < cur[j]) cur[j] = from;
        }
        const y = B[j - 1], fy = y === void 0 ? [] : [...fold2(y)];
        if (fy.length > 1 && i >= fy.length && fy.every((c, k) => A[i - fy.length + k] === c)) {
          const from = rows2[i - fy.length][j - 1] + SLIP;
          if (from < cur[j]) cur[j] = from;
        }
      }
      prev = cur;
    }
    return prev[B.length];
  }
  function cost(E, H) {
    const n = E.length, m = H.length, INF = 1e9;
    const len = (w) => w === NAME ? 1 : [...w].length;
    const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
    d[0][0] = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const here = d[i][j];
      if (here >= INF) continue;
      const set = (a, b, c) => {
        if (here + c < d[a][b]) d[a][b] = here + c;
      };
      if (i < n) set(i + 1, j, len(E[i]));
      if (j < m) set(i, j + 1, EXTRA * len(H[j]));
      if (i < n && j < m) set(i + 1, j + 1, E[i] === NAME ? 0 : letters(E[i], H[j]));
      if (i + 1 < n && j < m && E[i] !== NAME && E[i + 1] !== NAME) set(i + 2, j + 1, letters(E[i] + E[i + 1], H[j]));
      if (i < n && j + 1 < m) set(i + 1, j + 2, E[i] === NAME ? 0 : letters(E[i], H[j] + H[j + 1]));
    }
    return d[n][m];
  }
  function allowance(chars2, tolerance) {
    if (tolerance !== void 0) return chars2 * tolerance;
    return chars2 <= 3 ? SLIP * 2 : Math.max(1, chars2 * 0.17);
  }
  function matchLine(heard, expected, o = {}) {
    const names = new Set((o.names ?? []).flatMap(sayWords));
    const alts = [heard].flat().filter((h2) => h2 && h2.trim()).map((h2) => h2.slice(0, 4 * MAX_CHARS)).slice(0, MAX_ALTS);
    let best = { matched: false, best: -1, heard: alts[0] ?? "", score: 0 };
    let bestErr = Infinity;
    expected.forEach((line, k) => {
      const E = sayWords(line).map((w) => names.has(w) ? NAME : w);
      const chars2 = E.reduce((s, w) => s + (w === NAME ? 0 : [...w].length), 0);
      if (!chars2 || E.length > MAX_WORDS) return;
      for (const h2 of alts) {
        const H = sayWords(h2);
        if (!H.length || H.length > MAX_WORDS || H.reduce((n, w) => n + w.length, 0) > MAX_CHARS) continue;
        const c = cost(E, H), err = c / chars2;
        if (err < bestErr) {
          bestErr = err;
          best = { matched: c <= allowance(chars2, o.tolerance) + 1e-9, best: k, heard: h2, score: Math.max(0, 1 - err) };
        }
      }
    });
    return best.matched ? best : { ...best, best: -1 };
  }
  return { sayWords, normalise: (said) => sayWords(said).join(" "), letters, allowance, matchLine };
}

// ../sahne/src/art/path.ts
var Path = class _Path {
  cmds = [];
  moveTo(x, y) {
    this.cmds.push(["M", x, y]);
    return this;
  }
  lineTo(x, y) {
    this.cmds.push(["L", x, y]);
    return this;
  }
  cubicTo(x1, y1, x2, y2, x, y) {
    this.cmds.push(["C", x1, y1, x2, y2, x, y]);
    return this;
  }
  quadTo(x1, y1, x, y) {
    this.cmds.push(["Q", x1, y1, x, y]);
    return this;
  }
  close() {
    this.cmds.push(["Z"]);
    return this;
  }
  /**
   * A path from SVG path data (`d`): M L H V C S Q T A Z, absolute and relative, with the implicit repeats and the
   * run-together numbers SVG allows (`M0 0L-5-5`, an arc's flags as `011`). H, V, S and T become L, C and Q, an arc
   * becomes cubics, so the result holds only the commands of `Cmd`. Throws an `Error` that says where the data is wrong.
   */
  static fromSvg(d) {
    return parseSvgPath(d);
  }
  /** Append another path's commands (for compound shapes and holes). */
  add(p) {
    this.cmds.push(...p.cmds.map((c) => [...c]));
    return this;
  }
  /** Bounds of every point and control point: a box that always contains the shape. */
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cmds) for (let i = 1; i < c.length; i += 2) {
      const x = c[i], y = c[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x0 === Infinity ? [0, 0, 0, 0] : [x0, y0, x1, y1];
  }
  transform(m) {
    const p = new _Path();
    for (const c of this.cmds) {
      if (c[0] === "Z") {
        p.cmds.push(["Z"]);
        continue;
      }
      const out = [c[0]];
      for (let i = 1; i < c.length; i += 2) out.push(...apply(m, c[i], c[i + 1]));
      p.cmds.push(out);
    }
    return p;
  }
  mirrorX(about = 0) {
    return this.transform([-1, 0, 0, 1, 2 * about, 0]);
  }
  move(dx, dy) {
    return this.transform([1, 0, 0, 1, dx, dy]);
  }
  scaled(sx, sy = sx, ox = 0, oy = 0) {
    return this.transform([sx, 0, 0, sy, ox - ox * sx, oy - oy * sy]);
  }
  toD(digits = 2) {
    const f = (n) => +n.toFixed(digits);
    return this.cmds.map((c) => c[0] + (c.length > 1 ? c.slice(1).map((v) => f(v)).join(" ") : "")).join("");
  }
  /** The `d` attribute in its shortest form (see `cmdsToD`): what the SVG output uses. */
  toCompactD(digits = 2) {
    return cmdsToD(this.cmds, digits);
  }
  /** Whether every coordinate is a finite number (a path that is not must never reach the output). */
  finite() {
    return this.cmds.every((c) => c.every((v, i) => i === 0 || Number.isFinite(v)));
  }
  /** Trace into a Canvas 2D context (cheaper than building a Path2D from a string). */
  trace(ctx) {
    for (const c of this.cmds) {
      switch (c[0]) {
        case "M":
          ctx.moveTo(c[1], c[2]);
          break;
        case "L":
          ctx.lineTo(c[1], c[2]);
          break;
        case "C":
          ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
          break;
        case "Q":
          ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
          break;
        case "Z":
          ctx.closePath();
          break;
      }
    }
  }
};
var NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
var ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
function parseSvgPath(d) {
  const p = new Path(), n = d.length;
  let i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0, kx = 0, ky = 0, prev = "";
  const ws = () => {
    while (i < n && /[\s,]/.test(d[i])) i++;
  };
  const bad = (what) => {
    throw new Error(`path data: ${what} at ${i} in "${d.length > 40 ? d.slice(0, 40) + "\u2026" : d}"`);
  };
  const num2 = () => {
    ws();
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) bad("a number was expected");
    i += m[0].length;
    return +m[0];
  };
  const flag = () => {
    ws();
    const c = d[i];
    if (c !== "0" && c !== "1") bad("an arc flag (0 or 1) was expected");
    i++;
    return c === "1";
  };
  for (ws(); i < n; ws()) {
    if (/[A-Za-z]/.test(d[i])) {
      cmd = d[i++];
      if (!Object.hasOwn(ARGS, cmd.toLowerCase())) {
        i--;
        bad(`unknown command ${cmd}`);
      }
      if (!p.cmds.length && cmd !== "M" && cmd !== "m") bad("a path starts with M");
    } else if (!cmd || /z/i.test(cmd)) bad("a number with no command");
    const rel = cmd === cmd.toLowerCase(), c = cmd.toLowerCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (c === "z") {
      p.close();
      cx = sx;
      cy = sy;
      prev = "z";
      continue;
    }
    let x, y;
    switch (c) {
      case "m":
        x = ox + num2();
        y = oy + num2();
        p.moveTo(x, y);
        sx = x;
        sy = y;
        cmd = rel ? "l" : "L";
        break;
      case "l":
        x = ox + num2();
        y = oy + num2();
        p.lineTo(x, y);
        break;
      case "h":
        x = ox + num2();
        y = cy;
        p.lineTo(x, y);
        break;
      case "v":
        x = cx;
        y = oy + num2();
        p.lineTo(x, y);
        break;
      case "c":
      case "s": {
        let x1, y1;
        if (c === "c") {
          x1 = ox + num2();
          y1 = oy + num2();
        } else {
          x1 = prev === "c" ? 2 * cx - kx : cx;
          y1 = prev === "c" ? 2 * cy - ky : cy;
        }
        const x2 = ox + num2(), y2 = oy + num2();
        x = ox + num2();
        y = oy + num2();
        p.cubicTo(x1, y1, x2, y2, x, y);
        kx = x2;
        ky = y2;
        break;
      }
      case "q":
      case "t": {
        let x1, y1;
        if (c === "q") {
          x1 = ox + num2();
          y1 = oy + num2();
        } else {
          x1 = prev === "q" ? 2 * cx - kx : cx;
          y1 = prev === "q" ? 2 * cy - ky : cy;
        }
        x = ox + num2();
        y = oy + num2();
        p.quadTo(x1, y1, x, y);
        kx = x1;
        ky = y1;
        break;
      }
      default: {
        const rx = num2(), ry = num2(), rot = num2(), large = flag(), sweep = flag();
        x = ox + num2();
        y = oy + num2();
        arcTo(p, cx, cy, rx, ry, rot, large, sweep, x, y);
      }
    }
    prev = c;
    cx = x;
    cy = y;
  }
  if (!p.cmds.length) bad("no path");
  return p;
}
function arcTo(p, x1, y1, rx, ry, deg, large, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (!rx || !ry) {
    p.lineTo(x2, y2);
    return;
  }
  const phi = deg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = cp * dx + sp * dy, yp = -sp * dx + cp * dy;
  const lam = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rx *= s;
    ry *= s;
  }
  const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den)), cxp = k * rx * yp / ry, cyp = -k * ry * xp / rx;
  const ccx = cp * cxp - sp * cyp + (x1 + x2) / 2, ccy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), step = dt / segs, h2 = 4 / 3 * Math.tan(step / 4);
  const pt = (t) => {
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    return [ccx + cp * ex - sp * ey, ccy + sp * ex + cp * ey];
  };
  const tan = (t) => {
    const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
    return [cp * ex - sp * ey, sp * ex + cp * ey];
  };
  for (let i = 0; i < segs; i++) {
    const a = t1 + i * step, b = a + step, [ax, ay] = i ? pt(a) : [x1, y1], [bx, by] = i === segs - 1 ? [x2, y2] : pt(b), ta = tan(a), tb = tan(b);
    p.cubicTo(ax + h2 * ta[0], ay + h2 * ta[1], bx - h2 * tb[0], by - h2 * tb[1], bx, by);
  }
}
function svgNums(v, digits = 2) {
  let out = "", prev = "";
  for (const n of v) {
    const s = (Number.isFinite(n) ? (+n.toFixed(digits)).toString() : "0").replace(/^(-?)0\./, "$1.");
    out += !prev || s[0] === "-" || s[0] === "." && prev.includes(".") ? s : " " + s;
    prev = s;
  }
  return out;
}
var svgList = (v, digits = 2) => v.map((n) => svgNums([n], digits)).join(" ");
function cmdsToD(cmds, digits = 2) {
  const u = 10 ** digits, r = (n) => Math.round(n * u) / u;
  let out = "", last = "", cx = 0, cy = 0, sx = 0, sy = 0, rx = NaN, ry = NaN;
  const put2 = (letter, v) => {
    const n = svgNums(v, digits);
    out += letter === last && letter !== "z" ? (n[0] === "-" ? "" : " ") + n : letter + n;
    last = letter;
  };
  const line = (x, y) => {
    const dx = x - cx, dy = y - cy;
    if (!dy) put2("h", [dx]);
    else if (!dx) put2("v", [dy]);
    else put2("l", [dx, dy]);
    cx = x;
    cy = y;
    rx = NaN;
  };
  for (const c of cmds) {
    if (c[0] === "Z") {
      put2("z", []);
      cx = sx;
      cy = sy;
      rx = NaN;
      continue;
    }
    const q = c.slice(1).map(r);
    if (c[0] === "M") {
      out += "M" + svgNums(q, digits);
      last = "M";
      cx = sx = q[0];
      cy = sy = q[1];
      rx = NaN;
    } else if (c[0] === "L") line(q[0], q[1]);
    else if (c[0] === "Q") {
      put2("q", [q[0] - cx, q[1] - cy, q[2] - cx, q[3] - cy]);
      cx = q[2];
      cy = q[3];
      rx = NaN;
    } else if (q[0] === cx && q[1] === cy && q[2] === q[4] && q[3] === q[5]) line(q[4], q[5]);
    else {
      if (Math.abs(q[0] - (2 * cx - rx)) <= 1 / u + 1e-9 && Math.abs(q[1] - (2 * cy - ry)) <= 1 / u + 1e-9) put2("s", [q[2] - cx, q[3] - cy, q[4] - cx, q[5] - cy]);
      else put2("c", [q[0] - cx, q[1] - cy, q[2] - cx, q[3] - cy, q[4] - cx, q[5] - cy]);
      rx = q[2];
      ry = q[3];
      cx = q[4];
      cy = q[5];
    }
  }
  return out;
}
function asEllipse(p) {
  const c = p.cmds;
  if (c.length !== 6 || c[0][0] !== "M" || c[1][0] !== "C") return null;
  const cx = c[1][5], cy = c[0][2], rx = cx - c[0][1], ry = cy - c[1][6];
  if (!(rx > 0) || !(ry > 0)) return null;
  const e = ellipse(cx, cy, rx, ry).cmds, tol = 1e-6 * Math.max(rx, ry);
  return c.every((m, i) => m[0] === e[i][0] && m.every((v, k) => k === 0 || Math.abs(v - e[i][k]) <= tol)) ? [cx, cy, rx, ry] : null;
}
function svgGeom(p, digits = 2) {
  const e = asEllipse(p), n = (v) => svgNums([v], digits);
  if (!e) return { tag: "path", attrs: ` d="${cmdsToD(p.cmds, digits)}"` };
  return Math.abs(e[2] - e[3]) < 1e-6 * e[2] ? { tag: "circle", attrs: ` cx="${n(e[0])}" cy="${n(e[1])}" r="${n(e[2])}"` } : { tag: "ellipse", attrs: ` cx="${n(e[0])}" cy="${n(e[1])}" rx="${n(e[2])}" ry="${n(e[3])}"` };
}
var K = 0.5522847498;
function ellipse(cx, cy, rx, ry = rx) {
  const ox = rx * K, oy = ry * K;
  return new Path().moveTo(cx - rx, cy).cubicTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry).cubicTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy).cubicTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry).cubicTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy).close();
}
var circle = (cx, cy, r) => ellipse(cx, cy, r, r);
function rect(x, y, w, h2) {
  return new Path().moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h2).lineTo(x, y + h2).close();
}
function rrect(x, y, w, h2, r) {
  const [tl, tr, br, bl] = (typeof r === "number" ? [r, r, r, r] : r).map((v) => Math.min(v, w / 2, h2 / 2));
  const p = new Path().moveTo(x + tl, y).lineTo(x + w - tr, y);
  if (tr) p.cubicTo(x + w - tr * (1 - K), y, x + w, y + tr * (1 - K), x + w, y + tr);
  p.lineTo(x + w, y + h2 - br);
  if (br) p.cubicTo(x + w, y + h2 - br * (1 - K), x + w - br * (1 - K), y + h2, x + w - br, y + h2);
  p.lineTo(x + bl, y + h2);
  if (bl) p.cubicTo(x + bl * (1 - K), y + h2, x, y + h2 - bl * (1 - K), x, y + h2 - bl);
  p.lineTo(x, y + tl);
  if (tl) p.cubicTo(x, y + tl * (1 - K), x + tl * (1 - K), y, x + tl, y);
  return p.close();
}
function poly(points, closed = true) {
  const p = new Path().moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) p.lineTo(points[i][0], points[i][1]);
  return closed ? p.close() : p;
}
function smooth(points, closed = true, tension = 1) {
  const n = points.length, p = new Path();
  const at4 = (i) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(points[0][0], points[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at4(i - 1), p1 = at4(i), p2 = at4(i + 1), p3 = at4(i + 2);
    const k1 = p1[2] === 0 ? 0 : tension / 6, k2 = p2[2] === 0 ? 0 : tension / 6;
    p.cubicTo(
      p1[0] + (p2[0] - p0[0]) * k1,
      p1[1] + (p2[1] - p0[1]) * k1,
      p2[0] - (p3[0] - p1[0]) * k2,
      p2[1] - (p3[1] - p1[1]) * k2,
      p2[0],
      p2[1]
    );
  }
  return closed ? p.close() : p;
}
function band(spine, widths, tension = 1) {
  const n = spine.length, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const w = (widths[i] ?? widths[widths.length - 1]) / 2;
    left.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
    right.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  return smooth([...left, ...right.reverse()], true, tension);
}
function arcPoints(cx, cy, rx, ry, a0, a1, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// ../sahne/src/art/shape.ts
var MAX_REPEATS = 8e3;
function tileOffsets(t, b) {
  const out = [];
  if (!(t.w > 0.05) || !(t.h > 0.05) || !b.every(Number.isFinite)) return out;
  const x = t.x ?? 0, y = t.y ?? 0, i0 = Math.floor((b[0] - x) / t.w) - 1, i1 = Math.ceil((b[2] - x) / t.w), j0 = Math.floor((b[1] - y) / t.h) - 1, j1 = Math.ceil((b[3] - y) / t.h);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_REPEATS) return out;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push([x + i * t.w, y + j * t.h]);
  return out;
}
var DEFAULT_EDGE = 0.45;
var LIFT = { dx: 0.18, dy: 0.32, blur: 0.55, alpha: 0.22 };
var clipsOf = (s) => !s.clip ? [] : Array.isArray(s.clip) ? s.clip : [s.clip];
function shapeBounds(s, edge) {
  const pad = Math.max(s.stroke ? s.stroke.width / 2 : 0, s.flat ? 0 : edge, s.flat ? 0 : LIFT.blur + LIFT.dy);
  const b = boxPad(s.path.bounds(), pad + 0.1);
  let r = b;
  for (const p of clipsOf(s)) {
    const c = boxPad(p.bounds(), 0.1);
    r = [Math.max(r[0], c[0]), Math.max(r[1], c[1]), Math.min(r[2], c[2]), Math.min(r[3], c[3])];
  }
  return r[2] > r[0] && r[3] > r[1] ? r : b;
}
function groupBounds(g) {
  const edge = g.edge ?? DEFAULT_EDGE;
  let b = null;
  for (const s of g.shapes) b = boxUnion(b, shapeBounds(s, edge));
  for (const t of g.text ?? []) b = boxUnion(b, [t.x, t.y, t.x + t.w, t.y + t.h]);
  return b ?? [0, 0, 1, 1];
}
function drawGroup(ctx, g, pxPerCm) {
  const edge = g.edge ?? DEFAULT_EDGE;
  g.shapes.forEach((s, i) => {
    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    const rule = s.evenodd ? "evenodd" : "nonzero";
    for (const c of clipsOf(s)) {
      ctx.beginPath();
      c.trace(ctx);
      ctx.clip();
    }
    if (s.tile) {
      ctx.beginPath();
      s.path.trace(ctx);
      ctx.clip(rule);
      const at4 = tileOffsets(s.tile, s.path.bounds());
      for (const t of s.tile.shapes) {
        if (!t.fill) continue;
        ctx.beginPath();
        for (const [dx, dy] of at4) {
          ctx.translate(dx, dy);
          t.path.trace(ctx);
          ctx.translate(-dx, -dy);
        }
        ctx.globalAlpha = (s.opacity ?? 1) * (t.opacity ?? 1);
        ctx.fillStyle = t.fill;
        ctx.fill(t.evenodd ? "evenodd" : "nonzero");
      }
      ctx.restore();
      return;
    }
    ctx.beginPath();
    s.path.trace(ctx);
    if (s.fill) {
      if (!s.flat && i > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(40,24,16,${LIFT.alpha})`;
        ctx.shadowBlur = LIFT.blur * pxPerCm;
        ctx.shadowOffsetX = LIFT.dx * pxPerCm;
        ctx.shadowOffsetY = LIFT.dy * pxPerCm;
        ctx.fillStyle = s.fill;
        ctx.fill(rule);
        ctx.restore();
      }
      if (!s.flat && edge > 0) {
        ctx.lineJoin = "round";
        ctx.lineWidth = edge * 2;
        ctx.strokeStyle = tone(s.fill.slice(0, 7), "edge");
        ctx.stroke();
      }
      ctx.fillStyle = s.fill;
      ctx.fill(rule);
    }
    if (s.stroke) {
      ctx.lineWidth = s.stroke.width;
      ctx.lineCap = s.stroke.cap ?? "round";
      ctx.lineJoin = s.stroke.join ?? "round";
      ctx.strokeStyle = s.stroke.color;
      if (s.stroke.dash) ctx.setLineDash(s.stroke.dash);
      ctx.stroke();
    }
    ctx.restore();
  });
  for (const t of g.text ?? []) paintText(ctx, t, pxPerCm);
}
function paintText(ctx, t, pxPerCm) {
  const words = t.text.trim();
  if (!words) return;
  ctx.save();
  ctx.scale(1 / pxPerCm, 1 / pxPerCm);
  const W2 = t.w * pxPerCm, H = t.h * pxPerCm, size0 = (t.size ?? t.h * 0.45) * pxPerCm, family2 = t.family || "system-ui, sans-serif";
  const lay = (px2) => {
    ctx.font = `${t.weight ?? 400} ${px2}px ${family2}`;
    const out = [];
    for (const para of words.split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + " " + w : w;
        if (line && ctx.measureText(next).width > W2) {
          out.push(line);
          line = w;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  let fit = 1, lines = lay(size0);
  for (; fit > 0.35; fit = Math.max(0.35, fit * 0.88)) {
    lines = lay(size0 * fit);
    if (lines.length * size0 * fit * 1.15 <= H + 0.5 && lines.every((l) => ctx.measureText(l).width <= W2 + 0.5)) break;
  }
  const px = size0 * fit, lh = px * 1.15, top = t.y * pxPerCm + (H - lines.length * lh) / 2 + lh / 2, align = t.align ?? "center";
  const x = align === "left" ? t.x * pxPerCm : align === "right" ? (t.x + t.w) * pxPerCm : (t.x + t.w / 2) * pxPerCm;
  ctx.fillStyle = t.color ?? "#2B2420";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
  ctx.restore();
}
var HEX = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;
function svgColor(c) {
  return typeof c === "string" && (HEX.test(c) || c === "none" || c === "transparent") ? c : null;
}
function svgPaint(c) {
  const s = svgColor(c);
  return s && s[0] === "#" ? s : null;
}
var svgId = (s) => String(s).replace(/[^\w-]/g, "");
var RIM_TAIL = ` stroke-linejoin="round" paint-order="stroke"`;
var SVG_BASE = ` stroke="none" stroke-width="${svgNums([DEFAULT_EDGE * 2])}"` + RIM_TAIL;
function shadowFilter(id) {
  const rgb = [40, 24, 16].map((v) => v / 255);
  return `<filter id="${svgId(id)}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${svgNums([LIFT.blur / 2], 3)}"/><feOffset dx="${svgNums([LIFT.dx])}" dy="${svgNums([LIFT.dy])}"/><feColorMatrix values="0 0 0 0 ${svgNums([rgb[0]], 3)} 0 0 0 0 ${svgNums([rgb[1]], 3)} 0 0 0 0 ${svgNums([rgb[2]], 3)} 0 0 0 ${svgNums([LIFT.alpha])} 0"/></filter>`;
}
var CAPS = ["butt", "round", "square"];
var JOINS = ["miter", "round", "bevel"];
function groupSvg(g, o = {}) {
  const edge = Math.max(0, Number(g.edge ?? DEFAULT_EDGE) || 0), id = svgId(o.id ?? "c"), dg = o.digits ?? 2;
  let out = "", run2 = null;
  const flush = () => {
    if (run2) out += clipSvg(run2.clips, run2.body, run2.id, dg, o);
    run2 = null;
  };
  const emit = (s, body, sid) => {
    const clips = clipsOf(s);
    if (!clips.length) {
      flush();
      out += body;
      return;
    }
    if (run2 && run2.clips.length === clips.length && run2.clips.every((c, k) => c === clips[k])) {
      run2.body += body;
      return;
    }
    flush();
    run2 = { clips, body, id: sid };
  };
  g.shapes.forEach((s, i) => {
    if (!s.path.finite() || clipsOf(s).some((c) => !c.finite())) return;
    if (o.minDetail && (s.flat || !svgPaint(s.fill)) && !s.tile) {
      const [x0, y0, x1, y1] = s.path.bounds(), w = Math.max(x1 - x0, y1 - y0) + (s.stroke?.width ?? 0);
      if (w < o.minDetail) return;
    }
    if (s.tile) {
      const t = tileSvg(s, `${id}${i}`, dg, o);
      if (t) {
        out += t.def;
        emit(s, t.body, `${id}${i}c`);
      }
      return;
    }
    const geo = svgGeom(s.path, dg), fill2 = svgPaint(s.fill), st = s.stroke, ink = st && st.width > 0 && Number.isFinite(st.width) ? svgPaint(st.color) : null;
    const op = Number.isFinite(s.opacity) ? Math.min(1, s.opacity) : 1;
    const parts = [];
    if (fill2) {
      if (o.shadow && !s.flat && i > 0) parts.push(` fill="#000" filter="url(#${svgId(o.shadow)})"`);
      const rim = !s.flat && edge > 0 ? ` stroke="${tone(fill2.slice(0, 7), "edge")}"` + (o.base && edge === DEFAULT_EDGE ? "" : ` stroke-width="${svgNums([edge * 2])}"`) + (o.base ? "" : RIM_TAIL) : "";
      parts.push(` fill="${fill2}"${rim}${s.evenodd ? ` fill-rule="evenodd"` : ""}`);
    }
    if (ink) {
      const cap = CAPS.includes(st.cap) ? st.cap : "round", join = JOINS.includes(st.join) ? st.join : "round";
      const dash = st.dash?.length && st.dash.every((n) => n >= 0 && Number.isFinite(n)) && st.dash.some((n) => n > 0) ? ` stroke-dasharray="${svgList(st.dash)}"` : "";
      parts.push(` fill="none" stroke="${ink}" stroke-width="${svgNums([st.width])}"${cap === "butt" ? "" : ` stroke-linecap="${cap}"`}${join === (o.base ? "round" : "miter") ? "" : ` stroke-linejoin="${join}"`}${dash}`);
    }
    if (!parts.length || op <= 0) return;
    const alpha = op < 1 ? ` opacity="${svgNums([op])}"` : "", el = (a) => `<${geo.tag}${geo.attrs}${a}/>`;
    let body = parts.length === 1 ? el(parts[0] + alpha) : (alpha ? `<g${alpha}>` : "") + parts.map(el).join("") + (alpha ? "</g>" : "");
    emit(s, body, `${id}${i}`);
  });
  flush();
  return out;
}
function tileSvg(s, id, dg, o) {
  const t = s.tile, n = (v) => svgNums([v], dg);
  if (!(t.w > 0.05) || !(t.h > 0.05) || ![t.w, t.h, t.x ?? 0, t.y ?? 0].every(Number.isFinite)) return null;
  let pid = o.tiles?.get(t), def = "";
  if (!pid) {
    pid = `${id}t`;
    o.tiles?.set(t, pid);
    const inner = t.shapes.map((ts) => {
      const f = svgPaint(ts.fill);
      if (!f || !ts.path.finite()) return "";
      const g = svgGeom(ts.path, dg);
      return `<${g.tag}${g.attrs} fill="${f}"${ts.evenodd ? ` fill-rule="evenodd"` : ""}/>`;
    }).join("");
    def = `<pattern id="${pid}" patternUnits="userSpaceOnUse" x="${n(t.x ?? 0)}" y="${n(t.y ?? 0)}" width="${n(t.w)}" height="${n(t.h)}">${inner}</pattern>`;
  }
  const geo = svgGeom(s.path, dg), op = Number.isFinite(s.opacity) ? Math.min(1, s.opacity) : 1;
  if (op <= 0) return { def, body: "" };
  return { def, body: `<${geo.tag}${geo.attrs} fill="url(#${pid})"${s.evenodd ? ` fill-rule="evenodd"` : ""}${op < 1 ? ` opacity="${svgNums([op])}"` : ""}/>` };
}
function clipSvg(clips, body, id, dg, o) {
  if (!body) return "";
  let defs = "";
  clips.forEach((c, k) => {
    let cid = o.clips?.get(c);
    if (!cid) {
      const cg = svgGeom(c, dg);
      cid = k ? `${id}k${k}` : id;
      o.clips?.set(c, cid);
      defs += `<clipPath id="${cid}"><${cg.tag}${cg.attrs}/></clipPath>`;
    }
    body = `<g clip-path="url(#${cid})">${body}</g>`;
  });
  return defs + body;
}

// ../sahne/src/rig/skeleton.ts
var BONES = [
  "root",
  "hips",
  "spine",
  "neck",
  "head",
  "arm_l",
  "forearm_l",
  "hand_l",
  "arm_r",
  "forearm_r",
  "hand_r",
  "thigh_l",
  "shin_l",
  "foot_l",
  "thigh_r",
  "shin_r",
  "foot_r"
];
var CHAINS = {
  arm_l: ["arm_l", "forearm_l", "hand_l"],
  arm_r: ["arm_r", "forearm_r", "hand_r"],
  leg_l: ["thigh_l", "shin_l", "foot_l"],
  leg_r: ["thigh_r", "shin_r", "foot_r"]
};
var ARM_BONE = /^(?:arm|forearm|hand)_([lr])$/;
function humanoid(b) {
  const sx = b.shoulderW / 2 - b.armW[0] * 0.5, sy = -b.torsoL + b.armW[0] * 0.72, hx = b.hipW / 2 - b.legW[0] * 0.5;
  return [
    { name: "root", parent: null, x: 0, y: 0, rot: 0 },
    { name: "hips", parent: "root", x: 0, y: -b.legLen, rot: 0 },
    { name: "spine", parent: "hips", x: 0, y: 0, rot: 0 },
    { name: "neck", parent: "spine", x: 0, y: -b.torsoL, rot: 0 },
    { name: "head", parent: "neck", x: 0, y: -b.neckL, rot: 0 },
    { name: "arm_l", parent: "spine", x: sx, y: sy, rot: -0.13 },
    { name: "forearm_l", parent: "arm_l", x: 0, y: b.upperArmL, rot: 0.1 },
    { name: "hand_l", parent: "forearm_l", x: 0, y: b.foreArmL, rot: 0.02 },
    { name: "arm_r", parent: "spine", x: -sx, y: sy, rot: 0.13 },
    { name: "forearm_r", parent: "arm_r", x: 0, y: b.upperArmL, rot: -0.1 },
    { name: "hand_r", parent: "forearm_r", x: 0, y: b.foreArmL, rot: -0.02 },
    { name: "thigh_l", parent: "hips", x: hx, y: 0, rot: -0.015 },
    { name: "shin_l", parent: "thigh_l", x: 0, y: b.thighL, rot: 0.015 },
    { name: "foot_l", parent: "shin_l", x: 0, y: b.shinL, rot: 0 },
    { name: "thigh_r", parent: "hips", x: -hx, y: 0, rot: 0.015 },
    { name: "shin_r", parent: "thigh_r", x: 0, y: b.thighL, rot: -0.015 },
    { name: "foot_r", parent: "shin_r", x: 0, y: b.shinL, rot: 0 }
  ];
}
function seatedSide(b, seat) {
  const lean = 0.06, sy = -b.torsoL + b.armW[0] * 0.72;
  const drop2 = Math.max(1, seat - b.footH), c = Math.min(1, drop2 / b.shinL), shin = -Math.acos(c);
  const arm = -0.32, fore = -1.28;
  const out = [
    { name: "root", parent: null, x: 0, y: 0, rot: 0 },
    { name: "hips", parent: "root", x: 0, y: -seat, rot: 0 },
    { name: "spine", parent: "hips", x: 0, y: 0, rot: lean },
    { name: "neck", parent: "spine", x: 0, y: -b.torsoL, rot: -lean },
    { name: "head", parent: "neck", x: 0, y: -b.neckL, rot: 0 }
  ];
  for (const [s, dx] of [["l", -1.5], ["r", 1.5]]) out.push(
    { name: `arm_${s}`, parent: "spine", x: dx, y: sy, rot: arm - lean },
    { name: `forearm_${s}`, parent: `arm_${s}`, x: 0, y: b.upperArmL, rot: fore - arm },
    { name: `hand_${s}`, parent: `forearm_${s}`, x: 0, y: b.foreArmL, rot: 0.25 }
  );
  for (const [s, dx] of [["l", -1], ["r", 1]]) out.push(
    { name: `thigh_${s}`, parent: "hips", x: dx, y: 0, rot: -Math.PI / 2 },
    { name: `shin_${s}`, parent: `thigh_${s}`, x: 0, y: b.thighL, rot: shin + Math.PI / 2 },
    { name: `foot_${s}`, parent: `shin_${s}`, x: 0, y: b.shinL, rot: -shin }
  );
  return out;
}
function solve(bones, pose) {
  const out = /* @__PURE__ */ new Map();
  const base = pose ? translate(pose.dx, pose.dy) : IDENTITY;
  for (const b of bones) {
    const parent = b.parent ? out.get(b.parent) : base;
    const r = b.rot + (pose?.bones[b.name] ?? 0);
    const k = (b.parent ? pose?.len?.[b.parent] : void 0) ?? 1, o = pose?.off?.[b.name];
    out.set(b.name, mul(parent, mul(translate(b.x * k + (o?.[0] ?? 0), b.y * k + (o?.[1] ?? 0)), rotate(r))));
  }
  return out;
}
var jointOf = (world, name) => apply(world.get(name), 0, 0);
var restPose = () => ({ bones: {}, dx: 0, dy: 0 });

// ../sahne/src/face/params.ts
var NEUTRAL_FACE = {
  eyeOpen: [1, 1],
  lidTilt: [0, 0],
  lower: [0, 0],
  pupil: [0, 0],
  pupilSize: 1,
  brows: { l: [0, 0], r: [0, 0] },
  mouth: { open: 0, wide: 0.5, round: 0, smile: 0.15, teeth: 0 },
  blush: 0,
  sweat: 0,
  tears: 0
};
function faceFrom(p, base = NEUTRAL_FACE) {
  if (!p) return clone(base);
  return {
    eyeOpen: p.eyeOpen ?? [...base.eyeOpen],
    lidTilt: p.lidTilt ?? [...base.lidTilt],
    lower: p.lower ?? [...base.lower],
    pupil: p.pupil ?? [...base.pupil],
    pupilSize: p.pupilSize ?? base.pupilSize,
    brows: { l: p.brows?.l ?? [...base.brows.l], r: p.brows?.r ?? [...base.brows.r] },
    mouth: { ...base.mouth, ...p.mouth },
    blush: p.blush ?? base.blush,
    sweat: p.sweat ?? base.sweat,
    tears: p.tears ?? base.tears
  };
}
var l2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
var l1 = (a, b, t) => a + (b - a) * t;
function blendFace(a, b, t) {
  return {
    eyeOpen: l2(a.eyeOpen, b.eyeOpen, t),
    lidTilt: l2(a.lidTilt, b.lidTilt, t),
    lower: l2(a.lower, b.lower, t),
    pupil: l2(a.pupil, b.pupil, t),
    pupilSize: l1(a.pupilSize, b.pupilSize, t),
    brows: { l: l2(a.brows.l, b.brows.l, t), r: l2(a.brows.r, b.brows.r, t) },
    mouth: {
      open: l1(a.mouth.open, b.mouth.open, t),
      wide: l1(a.mouth.wide, b.mouth.wide, t),
      round: l1(a.mouth.round, b.mouth.round, t),
      smile: l1(a.mouth.smile, b.mouth.smile, t),
      teeth: l1(a.mouth.teeth, b.mouth.teeth, t)
    },
    blush: l1(a.blush, b.blush, t),
    sweat: l1(a.sweat, b.sweat, t),
    tears: l1(a.tears, b.tears, t)
  };
}
var clone = (f) => blendFace(f, f, 0);
function faceKey(f) {
  const r = (n) => Math.round(n * 50);
  return [f.eyeOpen, f.lidTilt, f.lower, f.pupil, f.brows.l, f.brows.r].flat().map(r).join(",") + "|" + [f.pupilSize, f.mouth.open, f.mouth.wide, f.mouth.round, f.mouth.smile, f.mouth.teeth, f.blush, f.sweat, f.tears].map(r).join(",");
}

// ../sahne/src/avatar/rules.ts
var GARMENT_FIELDS = [
  { field: "hair.style", slot: "hair", req: true },
  { field: "outfit.top", slot: "top", req: true },
  { field: "outfit.bottom", slot: "bottom", req: true },
  { field: "outfit.dress", slot: "dress" },
  { field: "outfit.outer", slot: "outer" },
  { field: "outfit.shoes", slot: "shoes", req: true },
  { field: "wear.head", slot: "head" },
  { field: "wear.hat", slot: "hat" },
  { field: "wear.hair", slot: "hairwear" },
  { field: "wear.eyes", slot: "eyes" },
  { field: "wear.ears", slot: "ears" },
  { field: "wear.aid", slot: "aid" },
  { field: "wear.neck", slot: "neck" },
  { field: "wear.wrist", slot: "wrist" },
  { field: "wear.hands", slot: "hands" },
  { field: "wear.waist", slot: "waist" },
  { field: "carry", slot: "carry" },
  { field: "hold", slot: "hold" }
];
var fitsBuild = (part, build) => !part.builds || part.builds.includes(build);
function sideOf(part, raw) {
  const s = part.sides;
  if (!s) return null;
  return typeof raw === "string" && s.allowed.includes(raw) ? raw : s.default;
}
var isObj = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
var own = (o, k) => isObj(o) && Object.hasOwn(o, k) ? o[k] : void 0;
var at = (o, path) => path.split(".").reduce(own, o);
function unalias(kit, id) {
  if (typeof id !== "string" || id.length > 48) return null;
  let k = id;
  for (let i = 0; i < 4 && kit.aliases && Object.hasOwn(kit.aliases, k); i++) k = kit.aliases[k];
  return k;
}
function partOf(kit, id) {
  const k = unalias(kit, id);
  return k !== null && Object.hasOwn(kit.parts, k) ? [k, kit.parts[k]] : null;
}
function usesOf(doc, kit) {
  const out = [];
  const add = (field, raw) => {
    const g = typeof raw === "string" ? { id: raw } : isObj(raw) ? raw : null;
    if (!g) return;
    const hit = partOf(kit, g.id);
    if (hit) out.push({
      field,
      id: hit[0],
      part: hit[1],
      colors: Array.isArray(g.colors) ? g.colors : [],
      pattern: typeof g.pattern === "string" ? g.pattern : null,
      inks: Array.isArray(g.inks) ? g.inks : [],
      side: sideOf(hit[1], g.side)
    });
  };
  for (const f of GARMENT_FIELDS) add(f.field, at(doc, f.field));
  if (Array.isArray(doc.custom)) doc.custom.forEach((c, i) => add(`custom.${i}`, c));
  return out;
}
function applyReplaces(uses) {
  const by = /* @__PURE__ */ new Map(), gone = [];
  for (const u of [...uses].sort((a, b) => (b.part.replaces ? 1 : 0) - (a.part.replaces ? 1 : 0))) {
    const r = by.get(u.part.slot);
    if (r) {
      gone.push({ use: u, by: r });
      continue;
    }
    for (const s of u.part.replaces ?? []) if (!by.has(s)) by.set(s, u);
  }
  return { gone, slots: new Set(by.keys()) };
}
function hiddenSlots(uses) {
  const m = /* @__PURE__ */ new Map();
  for (const u of uses) for (const s of u.part.hides ?? []) if (!m.has(s)) m.set(s, u.id);
  return m;
}

// ../sahne/src/avatar/normalize.ts
var AVATAR_MAX_BYTES = 2048;
var HEX2 = /^#[0-9A-Fa-f]{6}$/;
var FACE_KEYS = ["shape", "eyes", "eyeColor", "brows", "nose", "mouth", "ears"];
var DROP = ["carry", "wear.hands", "wear.wrist", "wear.neck", "wear.ears", "wear.hair", "wear.waist", "outfit.outer", "wear.hat", "face.marks", "wear.eyes", "facialHair", "wear.head", "hold", "wear.aid", "custom"];
var LEGACY = ["skin", "hair", "hairC", "beard", "top", "wear", "acc", "shirt"];
var family = (id) => id.split("@")[0];
function isAvatarDoc(x) {
  const k = own(x, "kit");
  return own(x, "v") === 1 && typeof k === "string" && k.length <= 40 && isObj(own(x, "body"));
}
function isLegacyChar(x) {
  try {
    if (!isObj(x) || Object.hasOwn(x, "v")) return false;
    const ks = Object.keys(x);
    return ks.length > 0 && ks.every((k) => LEGACY.includes(k) && Number.isInteger(x[k]));
  } catch {
    return false;
  }
}
var serialize = (doc) => JSON.stringify(doc);
var bytes = (s) => new TextEncoder().encode(s).length;
function docHash(doc) {
  const s = serialize(doc);
  let h1 = 3735928559, h2 = 1103547991;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function normalize(input, kit, o = {}) {
  try {
    return run(input, kit, !!o.trusted, o.notes ?? [], Math.min(o.maxBytes ?? AVATAR_MAX_BYTES, AVATAR_MAX_BYTES));
  } catch {
    return null;
  }
}
function run(input, kit, trusted, notes, max) {
  if (!isAvatarDoc(input) || family(own(input, "kit")) !== family(kit.id)) return null;
  const F = kit.features, D = kit.defaultDoc;
  const note = (field, id, why, by2) => {
    notes.push({ field, id: typeof id === "string" ? id.slice(0, 48).replace(/[^\w.@-]/g, "_") : "", why, ...by2 ? { by: by2 } : {} });
  };
  const colorOf = (v, palette, def, tr = trusted) => {
    const id = unalias(kit, v);
    if (id === null) return def;
    if (own(own(kit.palettes, palette), id) !== void 0) return id;
    return tr && HEX2.test(id) ? id.toUpperCase() : def;
  };
  const pick = (v, key) => {
    const c = F[key];
    return typeof v === "string" && c.values.includes(v) ? v : c.default ?? c.values[0];
  };
  const bodyIn = own(input, "body"), h2 = own(bodyIn, "height");
  const body = {
    build: pick(own(bodyIn, "build"), "body.build"),
    height: typeof h2 === "number" && Number.isFinite(h2) ? Math.round(Math.min(1, Math.max(0, h2)) * 100) / 100 : D.body.height,
    shape: pick(own(bodyIn, "shape"), "body.shape")
  };
  const skin = colorOf(own(input, "skin"), "skin", D.skin) ?? D.skin;
  const faceIn = own(input, "face"), face = {};
  for (const key of FACE_KEYS) {
    const f = `face.${key}`, def = F[f].default ?? void 0;
    const v = key === "eyeColor" ? colorOf(own(faceIn, key), "eyes", def) : pick(own(faceIn, key), f);
    if (v !== void 0 && v !== def) face[key] = v;
  }
  const mk = F["face.marks"], rawMarks = own(faceIn, "marks"), seen = /* @__PURE__ */ new Set();
  if (Array.isArray(rawMarks)) for (let i = 0; i < Math.min(rawMarks.length, 12); i++) seen.add(rawMarks[i]);
  const marks = capMarks(mk.values.filter((v) => seen.has(v)), mk.max ?? 3, mk.free);
  if (marks.length) face.marks = marks;
  const hairIn = own(input, "hair"), fhIn = own(input, "facialHair"), fhStyle = own(fhIn, "style");
  const hairColor = colorOf(own(hairIn, "color"), "hair", D.hair.color) ?? D.hair.color;
  const fhColor = colorOf(own(fhIn, "color"), "hair", void 0);
  const facialHair = typeof fhStyle === "string" && F.facialHair.values.includes(fhStyle) ? { style: fhStyle, ...fhColor ? { color: fhColor } : {} } : null;
  const take = (field, raw, slot, tr = trusted, anyBuild = false) => {
    const id = typeof raw === "string" ? raw : own(raw, "id"), hit = partOf(kit, id);
    if (!hit) {
      if (id !== void 0 && id !== null) note(field, id, "unknown");
      return null;
    }
    const [pid, part] = hit;
    if (!tr && part.tags?.includes("cast")) {
      note(field, pid, "unknown");
      return null;
    }
    if (slot !== null && part.slot !== slot) {
      note(field, pid, "slot");
      return null;
    }
    if (!anyBuild && !fitsBuild(part, body.build)) {
      note(field, pid, "build");
      return null;
    }
    const garment = { id: pid }, rawC = own(raw, "colors"), cols = [];
    if (Array.isArray(rawC)) for (let i = 0; i < (part.colors ?? 0); i++) {
      const c = colorOf(rawC[i], part.palettes?.[i] ?? "fabric", part.defaults?.[i], tr);
      if (c === void 0) break;
      cols.push(c);
    }
    while (cols.length && cols[cols.length - 1] === part.defaults?.[cols.length - 1]) cols.pop();
    if (cols.length) garment.colors = cols;
    const pat = own(raw, "pattern");
    if (typeof pat === "string" && part.patterns?.includes(pat) && (!kit.patterns || Object.hasOwn(kit.patterns, pat))) {
      garment.pattern = pat;
      const n = Math.min(2, Number(own(own(kit.patterns, pat), "inks") ?? 2) || 0), rawI = own(raw, "inks"), inks = [];
      if (Array.isArray(rawI)) for (let i = 0; i < n; i++) {
        const c = colorOf(rawI[i], "fabric", void 0, tr);
        if (c === void 0) break;
        inks.push(c);
      }
      if (inks.length) garment.inks = inks;
    }
    const side = own(raw, "side"), sides = part.sides;
    if (sides && typeof side === "string" && side !== sides.default && sides.allowed.includes(side)) garment.side = side;
    return { field, id: pid, part, garment };
  };
  const found = [], custom = own(input, "custom");
  if (trusted && Array.isArray(custom)) for (let i = 0; i < Math.min(custom.length, 2); i++) {
    const u = take(`custom.${i}`, custom[i], null);
    if (u) found.push(u);
  }
  for (const g of GARMENT_FIELDS) {
    const u = take(g.field, g.field === "hair.style" ? own(hairIn, "style") : at(input, g.field), g.slot);
    if (u) found.push(u);
  }
  const { gone, slots } = applyReplaces(found);
  for (const { use, by: by2 } of gone) note(use.field, use.id, "replaced", by2.id);
  const kept = found.filter((u) => !gone.some((x) => x.use === u)), have = new Set(kept.map((u) => u.field));
  for (const g of GARMENT_FIELDS) if (g.req && !have.has(g.field) && !slots.has(g.slot)) {
    const u = take(g.field, at(D, g.field), g.slot, true, true);
    if (u) kept.push(u);
  }
  const by = new Map(kept.map((u) => [u.field, u]));
  const group = (name) => {
    const r = {};
    for (const g of GARMENT_FIELDS) {
      const u = by.get(g.field);
      if (u && g.field.startsWith(name + ".")) r[g.field.slice(name.length + 1)] = u.garment;
    }
    return r;
  };
  const wear = group("wear"), carry2 = by.get("carry"), hold = by.get("hold"), cast = kept.filter((u) => u.field.startsWith("custom."));
  const doc = {
    v: 1,
    kit: kit.id,
    body,
    skin,
    face,
    hair: { style: by.get("hair.style")?.id ?? D.hair.style, color: hairColor },
    ...facialHair ? { facialHair } : {},
    outfit: group("outfit"),
    ...Object.keys(wear).length ? { wear } : {},
    ...carry2 ? { carry: carry2.garment } : {},
    ...hold ? { hold: hold.garment } : {},
    ...cast.length ? { custom: cast.map((u) => u.garment) } : {}
  };
  for (const p of DROP) {
    if (bytes(serialize(doc)) <= max) break;
    if (drop(doc, p)) note(p, "", "size");
  }
  return bytes(serialize(doc)) <= max ? doc : null;
}
function capMarks(marks, max, free = []) {
  let n = 0;
  return marks.filter((m) => free.includes(m) || n++ < max);
}
function manifestOf(kit) {
  const parts = {};
  for (const [id, p] of Object.entries(kit.parts)) parts[id] = { slot: p.slot, colors: p.colors, palettes: p.palettes, defaults: p.defaults, patterns: p.patterns, tags: p.tags?.includes("cast") ? ["cast"] : void 0, hides: p.hides, replaces: p.replaces, builds: p.builds, sides: p.sides };
  const patterns = kit.patterns && Object.fromEntries(Object.entries(kit.patterns).map(([id, p]) => [id, { inks: p.inks }]));
  const features = Object.fromEntries(Object.entries(kit.features).map(([f, c]) => [f, { values: c.values, default: c.default, max: c.max, free: c.free }]));
  return JSON.parse(JSON.stringify({ id: kit.id, palettes: kit.palettes, aliases: kit.aliases, features, defaultDoc: kit.defaultDoc, parts, patterns }));
}
function drop(doc, path) {
  const r = doc, [a, b] = path.split(".");
  if (b === void 0) {
    const had2 = a in r;
    delete r[a];
    return had2;
  }
  const o = r[a], had = !!o && b in o;
  if (o) {
    delete o[b];
    if (a === "wear" && !Object.keys(o).length) delete r.wear;
  }
  return had;
}

// ../sahne/src/avatar/compose.ts
var cut = (it, regions) => {
  if (it.bone !== "head" || !it.group) return it;
  const clip2 = (s) => {
    const all = [...clipsOf(s), ...regions];
    return all.length === 1 ? all[0] : all;
  };
  return { ...it, group: { ...it.group, shapes: it.group.shapes.map((s) => ({ ...s, clip: clip2(s) })) } };
};
function compose(avatar, kit, o = {}) {
  const notes = [];
  let doc = normalize(avatar, kit, { trusted: o.trusted ?? false, notes });
  if (!doc) {
    notes.push({ field: "doc", id: "", why: "unknown" });
    doc = normalize(kit.defaultDoc, kit, { trusted: true }) ?? kit.defaultDoc;
  }
  const body = kit.body(doc.body);
  const skin = kit.color(doc.skin, "#D9A47A"), hair = kit.color(doc.hair.color, "#2A1B12");
  const uses = usesOf(doc, kit), hidden = hiddenSlots(uses);
  const active = [{ field: "body", id: "", part: kit.base, colors: [], pattern: null, inks: [], side: null }];
  for (const u of uses) {
    const by = hidden.get(u.part.slot);
    if (by === void 0) active.push(u);
    else notes.push({ field: u.field, id: u.id, why: "hidden", by });
  }
  const ctxOf = (u, clips) => {
    const clip2 = clips.length ? clips[clips.length - 1] : null;
    const n = Math.max(u.colors.length, u.part.defaults?.length ?? 0), inks = (u.inks ?? []).map((c) => kit.color(c));
    return {
      avatar: doc,
      body,
      skin,
      hair,
      colors: Array.from({ length: n }, (_, i) => kit.color(u.colors[i] ?? u.part.defaults?.[i])),
      pattern: u.pattern,
      inks,
      side: u.side ?? null,
      garment: u.id ? { id: u.id, colors: u.colors, pattern: u.pattern, ...u.inks?.length ? { inks: u.inks } : {}, ...u.side ? { side: u.side } : {} } : null,
      kit,
      clip: clip2?.front ?? null,
      clipBack: clip2?.back ?? null
    };
  };
  const clipAt = /* @__PURE__ */ new Map();
  for (const u of active) if (u.part.clips) {
    const c = ctxOf(u, []), cl = { front: u.part.clips.keep(c, "front"), back: u.part.clips.keep(c, "back"), by: u.id };
    for (const s of new Set(u.part.clips.slots)) clipAt.set(s, [...clipAt.get(s) ?? [], cl]);
  }
  const views = { front: [], back: [] }, rest = {};
  for (const u of active) {
    const cs = clipAt.get(u.part.slot) ?? [];
    const out = u.part.draw(ctxOf(u, cs));
    for (const c of cs) notes.push({ field: u.field, id: u.id, why: "clipped", by: c.by });
    for (const v of ["front", "back"]) for (const it of out[v] ?? []) views[v].push(cs.length ? cut(it, cs.map((c) => c[v])) : it);
    for (const [k, val] of Object.entries(out.alt ?? {})) if (!(k in rest) && typeof val === "string") rest[k] = val;
  }
  for (const v of ["front", "back"]) {
    const order = kit.layers[v];
    const rank = (it) => {
      const i = order.indexOf(it.layer);
      return i < 0 ? order.length : i;
    };
    views[v] = views[v].map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i).map((x) => x.it);
    for (const [k, val] of Object.entries(rest)) {
      if (!views[v].some((it) => it.alt?.key === k && it.alt.value === val)) continue;
      views[v] = views[v].map((it) => it.alt?.key === k && (it.alt.default || it.alt.value === val) ? { ...it, alt: { ...it.alt, default: it.alt.value === val } } : it);
    }
  }
  let side;
  if (kit.side && kit.face.regionSide) {
    const worn = active.filter((u) => u.id).map((u) => ({ slot: u.part.slot, id: u.id, part: u.part, colors: ctxOf(u, []).colors }));
    try {
      side = { items: kit.side({ avatar: doc, body, skin, hair, kit, worn }), faceRegion: kit.face.regionSide(body) };
    } catch (e) {
      console.warn("sahne: no side view", e);
    }
  }
  return { avatar: doc, body, bones: humanoid(body), views, ...side ? { side } : {}, faceStyle: kit.face.style(doc, kit), faceRegion: kit.face.region(body), notes };
}

// ../sahne/src/avatar/builder.ts
var SECTIONS = ["body", "face", "hair", "clothes", "extras"];
var ORDER = [
  "body.build",
  "body.height",
  "body.shape",
  "skin",
  "face.shape",
  "face.eyes",
  "face.eyeColor",
  "face.brows",
  "face.nose",
  "face.mouth",
  "face.ears",
  "face.marks",
  "facialHair",
  "hair.style",
  "outfit.top",
  "outfit.bottom",
  "outfit.dress",
  "outfit.outer",
  "outfit.shoes",
  "wear.head",
  "wear.hat",
  "wear.hair",
  "wear.eyes",
  "wear.ears",
  "wear.aid",
  "wear.neck",
  "wear.wrist",
  "wear.hands",
  "wear.waist",
  "carry",
  "hold"
];
var KIND = { "body.height": "number", skin: "color", "face.eyeColor": "color", "face.marks": "multi" };
var PALETTE = { skin: "skin", "face.eyeColor": "eyes", "hair.style": "hair", facialHair: "hair" };
var KIDS = ["child", "toddler"];
var MAX_MULTI = 3;
var UNDO = 100;
var MODEST = 0.3;
var ODDS = {
  "outfit.dress": 0.2,
  "outfit.outer": 0.25,
  "wear.head": 0.15,
  "wear.hat": 0.1,
  "wear.hair": 0.08,
  "wear.eyes": 0.22,
  "wear.ears": 0.12,
  "wear.aid": 0.03,
  "wear.neck": 0.12,
  "wear.wrist": 0.12,
  "wear.hands": 0.05,
  "wear.waist": 0.08,
  carry: 0.1,
  hold: 0.08
};
var PATTERN_ODDS = 0.15;
var MULTI_ODDS = 0.18;
var SLOT = new Map(GARMENT_FIELDS.map((g) => [g.field, g]));
var DEFS = ORDER.map((id) => {
  const g = SLOT.get(id);
  return {
    id,
    slot: g?.slot,
    kind: KIND[id] ?? (g ? "part" : "choice"),
    optional: id === "facialHair" || !!g && !g.req,
    section: id.startsWith("body") || id === "skin" ? "body" : id.startsWith("face") || id === "facialHair" ? "face" : id === "hair.style" ? "hair" : id.startsWith("outfit") ? "clothes" : "extras"
  };
});
var DEF = new Map(DEFS.map((d) => [d.id, d]));
function put(o, path, v) {
  const ks = path.split("."), last = ks.pop();
  let c = o;
  for (const k of ks) c = c[k] ??= {};
  if (v == null) delete c[last];
  else c[last] = v;
}
var freeze = (x) => {
  if (x && typeof x === "object") {
    Object.values(x).forEach(freeze);
    Object.freeze(x);
  }
  return x;
};
var humanize = (id) => id.split(".").pop().replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
var wpick = (r, vals, w) => {
  const ws = vals.map(w), sum = ws.reduce((a, b) => a + b, 0);
  let t = r() * (sum > 0 ? sum : vals.length);
  for (let i = 0; i < vals.length; i++) if ((t -= sum > 0 ? ws[i] : 1) < 0) return vals[i];
  return vals[vals.length - 1];
};
var oddsOf = (o, build) => {
  const n = typeof o === "number" ? o : o && Object.hasOwn(o, build) ? o[build] : 1;
  return typeof n === "number" && n > 0 ? n : 0;
};
function createBuilder(kit, start, o = {}) {
  const norm2 = (d) => normalize(d, kit, { trusted: !!o.trusted });
  const initial = norm2(start) ?? normalize(kit.defaultDoc, kit, { trusted: true }) ?? kit.defaultDoc;
  const ids = new Set(typeof o.unlocked === "function" ? void 0 : o.unlocked);
  const open = (id) => typeof o.unlocked === "function" ? o.unlocked(id) : ids.has(id);
  let lang = o.lang ?? "en", cur = freeze(initial);
  const past = [], future = [], subs = /* @__PURE__ */ new Set();
  let mem = {};
  const text = (names, fb) => names?.[lang] ?? names?.en ?? fb;
  const word = (k, fb) => text(kit.labels?.[k], fb);
  const clone2 = () => JSON.parse(serialize(cur));
  const pal = (name) => isObj(own(kit.palettes, name)) ? kit.palettes[name] : {};
  const inPal = (name, id) => typeof id === "string" && Object.hasOwn(pal(name), id);
  const kid = () => KIDS.includes(cur.body.build);
  const nameOf2 = (p, id) => text(p.names, p.name ?? id);
  const colorLock = (id) => {
    const t = typeof id === "string" ? own(kit.paletteUnlocks, id) : void 0;
    return typeof t === "string" && !open(t) ? t : null;
  };
  const patternLock = (id) => {
    const t = own(own(kit.patterns, id), "unlock");
    return typeof t === "string" && !open(t) ? t : null;
  };
  const patternsOf = (p) => (p?.patterns ?? []).filter((id) => !kit.patterns || Object.hasOwn(kit.patterns, id));
  const inksOf = (pat) => typeof pat === "string" ? Math.min(2, Number(own(own(kit.patterns, pat), "inks") ?? 2) || 0) : 0;
  const emit = () => subs.forEach((f) => f(cur));
  const commit = (next, nextMem) => {
    if (!next || serialize(next) === serialize(cur)) return;
    past.push({ doc: cur, mem });
    if (past.length > UNDO) past.shift();
    future.length = 0;
    cur = freeze(next);
    mem = nextMem;
    emit();
  };
  const jump = (from, to) => {
    const s = from.pop();
    if (!s) return false;
    to.push({ doc: cur, mem });
    cur = s.doc;
    mem = s.mem;
    emit();
    return true;
  };
  const wide = /* @__PURE__ */ new Set();
  const offered = (field, value, kind, current) => !o.offer || value === null || wide.has(field) || value === current || Array.isArray(current) && current.includes(value) || o.offer(field, value, kind);
  const reserved = (p) => p.tags?.includes("cast") ? "cast" : p.tags?.includes("hidden") ? "hidden" : void 0;
  const allFor = (field, build) => {
    const d = DEF.get(field);
    if (!d || d.kind === "number" || d.kind === "color") return [];
    const none = d.optional ? [{ value: null, label: word("none", "None"), locked: false }] : [];
    if (d.kind === "part") {
      return [...none, ...Object.entries(kit.parts).filter(([, p]) => p.slot === d.slot && (o.cast || !reserved(p)) && fitsBuild(p, build)).map(([id, p]) => {
        const rs = reserved(p);
        return {
          value: id,
          label: nameOf2(p, id),
          locked: !!p.unlock && !open(p.unlock),
          ...p.unlock ? { unlock: p.unlock } : {},
          ...p.tags ? { tags: [...p.tags] } : {},
          ...rs ? { reserved: rs } : {}
        };
      })];
    }
    const c = kit.features[field];
    const values = field === "body.build" && o.builds ? c.values.filter((v) => o.builds?.includes(v)) : c.values;
    return [...none, ...values.map((v) => ({ value: v, label: text(c.names?.[v], v), locked: false }))];
  };
  const optionsFor = (field, build) => {
    const all = allFor(field, build), now = get(field);
    return o.offer ? all.filter((x) => offered(field, x.value, "option", now)) : all;
  };
  const options = (field) => optionsFor(field, cur.body.build);
  const get = (field) => {
    const d = DEF.get(field), v = at(cur, field);
    if (!d) return null;
    if (d.kind === "number") return typeof v === "number" ? v : kit.defaultDoc.body.height;
    if (d.kind === "multi") return Array.isArray(v) ? [...v] : [];
    if (d.kind === "part") return typeof v === "string" ? v : isObj(v) ? v.id : null;
    if (field === "facialHair") return cur.facialHair?.style ?? null;
    return typeof v === "string" ? v : kit.features[field].default;
  };
  const partAt = (doc, field) => {
    const v = at(doc, field), hit = partOf(kit, typeof v === "string" ? v : own(v, "id"));
    return hit?.[1];
  };
  const palOf = (field, index) => {
    const d = DEF.get(field);
    if (d?.kind === "color" || field === "hair.style" || field === "facialHair") return index === 0 ? PALETTE[field] : null;
    const p = d?.kind === "part" ? partAt(cur, field) : void 0, n = p?.colors ?? 0;
    if (!p || !(index >= 0)) return null;
    return index < n ? p.palettes?.[index] ?? "fabric" : index < n + inksOf(own(at(cur, field), "pattern")) ? "fabric" : null;
  };
  const getColor = (field, index = 0) => {
    const d = DEF.get(field);
    if (d?.kind === "color") return index === 0 ? get(field) : null;
    if (field === "hair.style") return index === 0 ? cur.hair.color : null;
    if (field === "facialHair") return index === 0 && cur.facialHair ? cur.facialHair.color ?? cur.hair.color : null;
    const g = at(cur, field), p = partAt(cur, field), c = own(g, "colors"), inks = own(g, "inks"), n = p?.colors ?? 0;
    if (!p || !palOf(field, index)) return null;
    if (index >= n) return (Array.isArray(inks) ? inks[index - n] : void 0) ?? null;
    return (Array.isArray(c) ? c[index] : void 0) ?? p.defaults?.[index] ?? null;
  };
  const info = (d) => {
    const p = d.kind === "part" ? partAt(cur, d.id) : void 0;
    const colors = d.id === "hair.style" ? 1 : d.id === "facialHair" ? cur.facialHair ? 1 : 0 : p?.colors ?? 0;
    const inks = p ? inksOf(own(at(cur, d.id), "pattern")) : 0;
    return {
      id: d.id,
      section: d.section,
      kind: d.kind,
      label: text(kit.labels?.[d.id], humanize(d.id)),
      optional: d.optional,
      colors,
      hidden: !!p && hiddenSlots(usesOf(cur, kit)).has(p.slot),
      ...d.kind === "multi" ? { max: kit.features[d.id].max ?? MAX_MULTI } : {},
      ...patternsOf(p).length ? { patterns: true } : {},
      ...inks ? { inks } : {},
      ...p?.sides ? { sides: [...p.sides.allowed] } : {}
    };
  };
  const visible = (d) => d.id === "facialHair" && kid() ? false : d.kind === "number" || d.kind === "color" || d.kind === "multi" ? true : options(d.id).length >= 2;
  const restore = (draft, m) => {
    const uses = usesOf(draft, kit), gone = applyReplaces(uses).slots, worn = new Set(uses.map((u) => u.part.slot));
    for (const f of Object.keys(m)) {
      const p = partOf(kit, typeof m[f] === "string" ? m[f] : own(m[f], "id"))?.[1];
      if (at(draft, f) != null) delete m[f];
      else if (!gone.has(SLOT.get(f)?.slot ?? "") && !p?.replaces?.some((s) => worn.has(s)) && (!p || fitsBuild(p, draft.body?.build))) {
        put(draft, f, m[f]);
        delete m[f];
      }
    }
  };
  const carry2 = (old, np) => {
    const op = partOf(kit, own(old, "id"))?.[1], oc = own(old, "colors"), r = [];
    if (!op || !Array.isArray(oc)) return void 0;
    for (let i = 0; i < Math.min(oc.length, np.colors ?? 0) && (op.palettes?.[i] ?? "fabric") === (np.palettes?.[i] ?? "fabric"); i++) r.push(oc[i]);
    return r.length ? r : void 0;
  };
  const plan = (field, value) => {
    const d = DEF.get(field);
    if (!d) return null;
    const draft = clone2(), m = { ...mem };
    if (d.kind === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      draft.body.height = value;
    } else if (d.kind === "color") {
      if (!inPal(PALETTE[field], value) || colorLock(value) || !offered(field, value, "color", get(field))) return null;
      put(draft, field, value);
    } else if (d.kind === "multi") {
      const c = kit.features[field], have = get(field);
      const next = typeof value === "string" ? have.includes(value) ? have.filter((x) => x !== value) : [...have, value] : value === null ? [] : value;
      if (!Array.isArray(next) || !next.every((v) => c.values.includes(v) && offered(field, v, "option", have)) || new Set(next.filter((v) => !c.free?.includes(v))).size > (c.max ?? MAX_MULTI)) return null;
      put(draft, field, next.length ? next : null);
    } else {
      const op = options(field).find((x) => x.value === value);
      if (!op || op.locked || field === "facialHair" && kid()) return null;
      if (field === "facialHair") put(draft, field, value && { style: value, ...cur.facialHair?.color ? { color: cur.facialHair.color } : {} });
      else if (d.kind === "choice") {
        put(draft, field, value);
        if (field === "body.build") {
          if (KIDS.includes(value)) delete draft.facialHair;
          for (const u of usesOf(draft, kit)) if (!u.field.startsWith("custom") && !fitsBuild(u.part, value)) {
            m[u.field] = at(draft, u.field);
            put(draft, u.field, null);
          }
          restore(draft, m);
        }
      } else if (field === "hair.style") put(draft, field, value);
      else {
        const part = typeof value === "string" ? kit.parts[value] : void 0, slot = d.slot, old = at(draft, field);
        const colors = part && carry2(old, part), pat = own(old, "pattern"), inks = own(old, "inks"), side = own(old, "side");
        const keepPat = typeof pat === "string" && patternsOf(part).includes(pat);
        delete m[field];
        put(draft, field, part && { id: value, ...colors ? { colors } : {}, ...keepPat ? { pattern: pat, ...Array.isArray(inks) ? { inks } : {} } : {}, ...typeof side === "string" ? { side } : {} });
        for (const u of usesOf(draft, kit)) {
          if (u.field !== field && !u.field.startsWith("custom") && (u.part.replaces?.includes(slot) || part?.replaces?.includes(u.part.slot))) {
            m[u.field] = at(draft, u.field);
            put(draft, u.field, null);
          }
        }
        restore(draft, m);
      }
    }
    return { doc: norm2(draft), mem: m };
  };
  const set = (field, value) => {
    const p = plan(field, value);
    if (!p?.doc) return false;
    commit(p.doc, p.mem);
    return true;
  };
  const setColor = (field, index, id) => {
    const name = palOf(field, index), d = DEF.get(field);
    if (!d || name === null || !inPal(name, id) || colorLock(id) || !offered(field, id, "color", getColor(field, index))) return false;
    if (d.kind === "color") return set(field, id);
    const draft = clone2();
    if (field === "hair.style") draft.hair.color = id;
    else if (field === "facialHair") {
      if (!draft.facialHair) return false;
      draft.facialHair.color = id;
    } else {
      const g = at(draft, field), p = partAt(draft, field), n = p?.colors ?? 0;
      if (!isObj(g) || !p) return false;
      if (index >= n) {
        const inks = Array.isArray(g.inks) ? [...g.inks] : [];
        if (index - n > inks.length) return false;
        inks[index - n] = id;
        g.inks = inks;
      } else {
        const cols = Array.isArray(g.colors) ? [...g.colors] : [];
        for (let i = cols.length; i < index; i++) {
          const def = p.defaults?.[i];
          if (def === void 0) return false;
          cols[i] = def;
        }
        cols[index] = id;
        g.colors = cols;
      }
    }
    commit(norm2(draft), mem);
    return true;
  };
  const patternOptions = (field) => {
    const now = getPattern(field), ids2 = patternsOf(DEF.get(field)?.kind === "part" ? partAt(cur, field) : void 0).filter((id) => offered(field, id, "pattern", now));
    if (!ids2.length) return [];
    return [{ value: null, label: word("none", "None"), locked: false }, ...ids2.map((id) => {
      const lock = patternLock(id), unlock = own(own(kit.patterns, id), "unlock");
      return { value: id, label: text(own(kit.patterns, id) ? kit.patterns[id].names : void 0, id), locked: !!lock, ...typeof unlock === "string" ? { unlock } : {} };
    })];
  };
  const getPattern = (field) => {
    const p = own(at(cur, field), "pattern");
    return typeof p === "string" ? p : null;
  };
  const setPattern = (field, id) => {
    const draft = clone2(), g = at(draft, field);
    if (!isObj(g) || !patternOptions(field).some((x) => x.value === id && !x.locked)) return false;
    if (id === null) {
      delete g.pattern;
      delete g.inks;
    } else g.pattern = id;
    commit(norm2(draft), mem);
    return true;
  };
  const getSide = (field) => {
    const p = partAt(cur, field), s = own(at(cur, field), "side");
    return p?.sides ? typeof s === "string" ? s : p.sides.default : null;
  };
  const setSide = (field, side) => {
    const draft = clone2(), g = at(draft, field), p = partAt(draft, field);
    if (!isObj(g) || !p?.sides || !p.sides.allowed.includes(side)) return false;
    g.side = side;
    commit(norm2(draft), mem);
    return true;
  };
  const randomize = (seed, ro = {}) => {
    const r = rng(seed), F = kit.features, keep = /* @__PURE__ */ new Set(), fam = (id) => kit.families?.[id] ?? id;
    for (const k of ro.keep ?? []) for (const d of DEFS) if (d.id === k || d.section === k) keep.add(d.id);
    const may = (field, v, kind = "option") => !o.offer || wide.has(field) || o.offer(field, v, kind);
    const builds = F["body.build"].values.filter((v) => (!o.builds || o.builds.includes(v)) && may("body.build", v));
    const build = keep.has("body.build") ? cur.body.build : wpick(r, builds.length ? builds : F["body.build"].values, (v) => oddsOf(own(F["body.build"].weights, v), ""));
    const pickColor = (name, field, avoid2) => {
      const every = Object.keys(pal(name)), mine = every.filter((i) => may(field, i, "color")), all = mine.length ? mine : every, free = all.filter((i) => !colorLock(i)), ids2 = free.length ? free : all, ok = avoid2 ? ids2.filter((i) => !avoid2.has(fam(i))) : ids2;
      return wpick(r, ok.length ? ok : ids2, (id) => oddsOf(own(kit.odds, id), build));
    };
    const weight = (key, v) => oddsOf(own(F[key].weights, v), build);
    const choose = (key) => {
      const vs = F[key].values.filter((v) => may(key, v, KIND[key] === "color" ? "color" : "option"));
      return wpick(r, vs.length ? vs : F[key].values, (v) => weight(key, v));
    };
    const avoid = /* @__PURE__ */ new Set();
    for (const f of ["outfit.dress", "outfit.top", "outfit.bottom", "outfit.outer"]) {
      const c = keep.has(f) && at(cur, f) ? getColor(f, 0) : null;
      if (c) avoid.add(fam(c));
    }
    const chosen = [];
    for (const f of keep) {
      const v = at(cur, f), p = DEF.get(f)?.kind === "part" ? partOf(kit, typeof v === "string" ? v : own(v, "id"))?.[1] : void 0;
      if (p) chosen.push(p);
    }
    const clash = (p) => chosen.some((q) => !!p.avoid?.some((t) => q.tags?.includes(t)) || !!q.avoid?.some((t) => p.tags?.includes(t)));
    const garment = (field, dominant) => {
      const all = optionsFor(field, build).filter((x) => x.value !== null && !x.locked && !x.reserved && !clash(kit.parts[x.value]) && may(field, x.value));
      if (!all.length) return null;
      const w = (x) => oddsOf(kit.parts[x.value].odds, build), sum = (xs) => xs.reduce((n, x) => n + w(x), 0);
      const modest = all.filter((x) => x.tags?.includes("modest")), rest = all.filter((x) => !x.tags?.includes("modest"));
      const pool = modest.length && (!rest.length || r.chance(Math.max(sum(modest) / (sum(all) || 1), MODEST))) ? modest : rest;
      const id = wpick(r, pool, w).value, part = kit.parts[id], colors = [];
      chosen.push(part);
      for (let i = 0; i < (part.colors ?? 0); i++) {
        const name = part.palettes?.[i] ?? "fabric", def = part.defaults?.[i];
        if (i === 0 || def === void 0 || r.chance(0.25)) colors[i] = pickColor(name, field, i === 0 && dominant ? avoid : void 0);
        else colors[i] = def;
      }
      if (dominant && colors[0]) avoid.add(fam(colors[0]));
      const pats = patternsOf(part).filter((p) => !patternLock(p) && may(field, p, "pattern")), pattern = pats.length && r.chance(PATTERN_ODDS) ? r.pick(pats) : null;
      return { id, ...colors.length ? { colors } : {}, ...pattern ? { pattern } : {} };
    };
    const doc = { v: 1, kit: kit.id, body: { build, height: Math.round(r() * 100) / 100, shape: choose("body.shape") }, skin: pickColor("skin", "skin"), face: {}, hair: {}, outfit: {} };
    for (const k of ["shape", "eyes", "brows", "nose", "mouth", "ears"]) doc.face[k] = choose(`face.${k}`);
    doc.face.eyeColor = choose("face.eyeColor");
    doc.face.marks = F["face.marks"].values.filter((v) => may("face.marks", v) && r.chance(Math.min(1, MULTI_ODDS * weight("face.marks", v))));
    doc.hair = { style: garment("hair.style", false)?.id ?? cur.hair.style, color: pickColor("hair", "hair.style") };
    if (!KIDS.includes(build) && r.chance(0.22)) doc.facialHair = { style: choose("facialHair"), ...r.chance(0.25) ? { color: pickColor("hair", "facialHair") } : {} };
    const dress = !["outfit.top", "outfit.bottom", "outfit.dress"].some((f) => keep.has(f)) && r.chance(ODDS["outfit.dress"]) ? garment("outfit.dress", true) : null;
    if (dress) doc.outfit.dress = dress;
    else {
      doc.outfit.top = garment("outfit.top", true);
      doc.outfit.bottom = garment("outfit.bottom", true);
    }
    for (const f of ["outfit.outer", "wear.head", "wear.eyes", "wear.ears", "wear.neck", "wear.wrist", "wear.waist", "carry", "wear.hat", "wear.hair", "wear.aid", "wear.hands", "hold"]) if (r.chance(ODDS[f])) put(doc, f, garment(f, f === "outfit.outer"));
    doc.outfit.shoes = garment("outfit.shoes", false);
    for (const f of keep) {
      const v = at(cur, f), p = DEF.get(f)?.kind === "part" ? partOf(kit, typeof v === "string" ? v : own(v, "id"))?.[1] : void 0;
      if (p && !fitsBuild(p, doc.body.build)) continue;
      put(doc, f, v);
      if (f === "hair.style") doc.hair.color = cur.hair.color;
    }
    if (KIDS.includes(doc.body.build)) delete doc.facialHair;
    commit(norm2(doc), {});
  };
  const colorOptions = (field, index = 0) => {
    const name = palOf(field, index);
    const now = name === null ? null : getColor(field, index);
    return name === null ? [] : Object.entries(pal(name)).map(([id, hex], i) => {
      if (!offered(field, id, "color", now)) return null;
      const lock = colorLock(id);
      return { id, hex, label: text(own(kit.colorNames, id) ? kit.colorNames[id] : void 0, `${word("colour", "Colour")} ${i + 1}`), ...lock ? { locked: true, unlock: lock } : {} };
    }).filter((c) => c !== null);
  };
  return {
    get doc() {
      return cur;
    },
    get lang() {
      return lang;
    },
    set lang(v) {
      if (v !== lang) {
        lang = v;
        emit();
      }
    },
    sections: () => SECTIONS.map((id) => ({ id, label: word(id, id[0].toUpperCase() + id.slice(1)) })),
    fields: (section) => DEFS.filter((d) => d.section === section && visible(d)).map(info),
    field: (id) => {
      const d = DEF.get(id);
      return d ? info(d) : null;
    },
    options,
    colorOptions,
    get,
    getColor,
    set,
    setColor,
    randomize,
    patternOptions,
    getPattern,
    setPattern,
    getSide,
    setSide,
    preview: (field, value) => plan(field, value)?.doc ?? null,
    hasMore(field) {
      if (!o.offer || wide.has(field) || !DEF.has(field)) return false;
      const d = DEF.get(field), n = (xs, all) => xs.length < all.length;
      if (d.kind !== "number" && d.kind !== "color" && n(options(field), allFor(field, cur.body.build))) return true;
      const f = info(d), pats = patternsOf(partAt(cur, field));
      for (let i = 0; i < Math.max(1, f.colors + (f.inks ?? 0)); i++) {
        const name = palOf(field, i);
        if (name && n(colorOptions(field, i), Object.keys(pal(name)))) return true;
      }
      return pats.length > 0 && patternOptions(field).length < pats.length + 1;
    },
    more(field) {
      if (o.offer && !wide.has(field)) {
        wide.add(field);
        emit();
      }
    },
    undo: () => jump(past, future),
    redo: () => jump(future, past),
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    reset() {
      commit(initial, {});
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    }
  };
}

// ../sahne/src/avatar/look.ts
var CLOTHING_FIELDS = [
  "outfit.top",
  "outfit.bottom",
  "outfit.dress",
  "outfit.outer",
  "outfit.shoes",
  "wear.head",
  "wear.hat",
  "wear.hair",
  "wear.eyes",
  "wear.ears",
  "wear.aid",
  "wear.neck",
  "wear.wrist",
  "wear.hands",
  "wear.waist",
  "carry",
  "hold"
];
var CLOTHING = new Set(CLOTHING_FIELDS);
var isObj2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function lookFields(look) {
  const clothing = {}, other2 = [];
  if (!isObj2(look)) return { clothing, other: look === void 0 ? [] : ["look"] };
  for (const [k, v] of Object.entries(look)) {
    if (k === "outfit" || k === "wear") {
      if (!isObj2(v)) {
        other2.push(k);
        continue;
      }
      for (const [s, g] of Object.entries(v)) CLOTHING.has(`${k}.${s}`) ? clothing[`${k}.${s}`] = g : other2.push(`${k}.${s}`);
    } else if (CLOTHING.has(k)) clothing[k] = v;
    else other2.push(k);
  }
  return { clothing, other: other2 };
}
function applyLook(doc, look) {
  const { clothing } = lookFields(look ?? {});
  const fields = Object.entries(clothing);
  if (!fields.length) return doc;
  const out = structuredClone(doc);
  for (const [f, v] of fields) {
    const g = typeof v === "string" ? { id: v } : v === null ? null : structuredClone(v);
    const [a, b] = f.split(".");
    if (!b) {
      if (g) out[a] = g;
      else delete out[a];
      continue;
    }
    const box = out[a] ??= {};
    if (g) box[b] = g;
    else delete box[b];
  }
  if (out.wear && !Object.keys(out.wear).length) delete out.wear;
  return out;
}

// ../sahne/src/rig/strip.ts
var STRIP_SEGMENTS = 12;
var STRIP_CAP_SEGMENTS = 8;
function stripJoints(world, chain) {
  const m = CHAINS[chain]?.map((n) => world.get(n));
  return m && m.every(Boolean) ? m.map((a) => apply(a, 0, 0)) : null;
}
var ROUND_END = ["arm", "leg"];
function stripCaps(s, layer) {
  if (s.caps) return { from: s.caps === "both" || s.caps === "from", to: s.caps === "both" || s.caps === "to" };
  return { from: (s.from ?? 0) <= 0.01, to: ROUND_END.includes(layer) };
}
function stripGeometry(j, s, layer, o = {}) {
  const N = o.seg ?? STRIP_SEGMENTS, M2 = o.capSeg ?? STRIP_CAP_SEGMENTS, k = o.scale ?? 1;
  const C = [2 * j[1][0] - (j[0][0] + j[2][0]) / 2, 2 * j[1][1] - (j[0][1] + j[2][1]) / 2];
  const B = (t) => {
    const u = 1 - t;
    return [u * u * j[0][0] + 2 * u * t * C[0] + t * t * j[2][0], u * u * j[0][1] + 2 * u * t * C[1] + t * t * j[2][1]];
  };
  const dB = (t) => [2 * (1 - t) * (C[0] - j[0][0]) + 2 * t * (j[2][0] - C[0]), 2 * (1 - t) * (C[1] - j[0][1]) + 2 * t * (j[2][1] - C[1])];
  const width = (t) => k * (t < 0.5 ? s.widths[0] + (s.widths[1] - s.widths[0]) * t * 2 : s.widths[1] + (s.widths[2] - s.widths[1]) * (t - 0.5) * 2);
  const from = s.from ?? 0, to = s.to ?? 1;
  const left = [], right = [], along = [];
  let len = 0, prev = null;
  for (let i = 0; i <= N; i++) {
    const t = from + (to - from) * (i / N), p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const n = [-d[1] / l, d[0] / l];
    if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    along.push(len);
    left.push([p[0] + n[0] * w, p[1] + n[1] * w]);
    right.push([p[0] - n[0] * w, p[1] - n[1] * w]);
  }
  const cap = (t, sAt, dir) => {
    const p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const tx = d[0] / l * dir, ty = d[1] / l * dir, nx = -ty, ny = tx, pts = [];
    for (let i = 0; i <= M2; i++) {
      const a = Math.PI * i / M2;
      pts.push([p[0] + (nx * Math.cos(a) + tx * Math.sin(a)) * w, p[1] + (ny * Math.cos(a) + ty * Math.sin(a)) * w]);
    }
    return { center: p, pts, along: sAt };
  };
  const caps = stripCaps(s, layer);
  return { left, right, along, length: len, capFrom: caps.from ? cap(from, 0, -1) : null, capTo: caps.to ? cap(to, len, 1) : null };
}
function stripOutline(g) {
  const mid = (c) => c ? c.pts.slice(1, -1) : [];
  return [...g.left, ...mid(g.capTo), ...[...g.right].reverse(), ...mid(g.capFrom)];
}
function stripSlice(g, a, b) {
  const lo = Math.max(0, a), hi = Math.min(g.length, b), L2 = [], R3 = [];
  if (!(hi > lo)) return [];
  const at4 = (s) => {
    let i = 0;
    while (i < g.along.length - 2 && g.along[i + 1] < s) i++;
    const f = (s - g.along[i]) / (g.along[i + 1] - g.along[i] || 1), mix3 = (p) => [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f];
    L2.push(mix3(g.left));
    R3.push(mix3(g.right));
  };
  at4(lo);
  for (const s of g.along) if (s > lo && s < hi) at4(s);
  at4(hi);
  return [...L2, ...R3.reverse()];
}
var stripeDuty = (d) => typeof d === "number" && d > 0 && d < 1 ? d : 0.5;
function stripeSpans(length, period, duty = 0.5) {
  const out = [], d = stripeDuty(duty);
  if (!(period > 0) || !(length > 0) || length / period > 200) return out;
  for (let a = 0; a < length; a += period) out.push([a, Math.min(length, a + period * d)]);
  return out;
}

// ../sahne/src/render/still/recorder.ts
var CAPS2 = ["round", "square"];
var JOINS2 = ["round", "bevel"];
var SvgContext = class {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  dash = [];
  prefix;
  digits;
  out = [];
  path = new Path();
  stack = [];
  open = 0;
  clips = 0;
  /** `prefix` starts every clip path id (the caller keeps it unique within the document); `digits` is the precision of the coordinates. */
  constructor(prefix, digits = 2) {
    this.prefix = svgId(prefix);
    this.digits = digits;
    Object.seal(this);
  }
  beginPath() {
    this.path = new Path();
  }
  moveTo(x, y) {
    this.path.moveTo(x, y);
  }
  lineTo(x, y) {
    this.path.lineTo(x, y);
  }
  bezierCurveTo(a, b, c, d, x, y) {
    this.path.cubicTo(a, b, c, d, x, y);
  }
  quadraticCurveTo(a, b, x, y) {
    this.path.quadTo(a, b, x, y);
  }
  closePath() {
    this.path.close();
  }
  rect(x, y, w, h2) {
    this.path.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h2).lineTo(x, y + h2).close();
  }
  setLineDash(d) {
    this.dash = Array.isArray(d) ? d.slice() : [];
  }
  /** A circular arc (angles in radians, clockwise unless `ccw`) as cubic curves of at most a quarter turn, joined to the path so far by a line. */
  arc(x, y, r, a0, a1, ccw = false) {
    const T = Math.PI * 2;
    let d = a1 - a0;
    d = ccw ? d <= -T ? -T : -((-d % T + T) % T) : d >= T ? T : (d % T + T) % T;
    const n = Math.max(1, Math.ceil(Math.abs(d) / (T / 4) - 1e-9)), st = d / n, k = 4 / 3 * Math.tan(st / 4), p = this.path;
    const sx = x + r * Math.cos(a0), sy = y + r * Math.sin(a0);
    if (p.cmds.length) p.lineTo(sx, sy);
    else p.moveTo(sx, sy);
    for (let i = 0; i < n; i++) {
      const a = a0 + st * i, b = a + st, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      p.cubicTo(x + r * (ca - k * sa), y + r * (sa + k * ca), x + r * (cb + k * sb), y + r * (sb - k * cb), x + r * cb, y + r * sb);
    }
  }
  save() {
    this.stack.push({ s: this.snap(), open: this.open });
  }
  restore() {
    const top = this.stack.pop();
    if (!top) return;
    this.out.push("</g>".repeat(this.open - top.open));
    this.open = top.open;
    Object.assign(this, top.s);
  }
  /** The current path becomes the clip of everything drawn until the matching restore. */
  clip(rule) {
    if (!this.path.finite()) return;
    const id = `${this.prefix}${this.clips++}`;
    this.out.push(`<clipPath id="${id}">${this.el(rule === "evenodd" ? ` clip-rule="evenodd"` : "")}</clipPath><g clip-path="url(#${id})">`);
    this.open++;
  }
  fill(rule) {
    const c = svgPaint(this.fillStyle);
    if (c && this.path.finite() && this.path.cmds.length) this.out.push(this.el(` fill="${c}"${rule === "evenodd" ? ` fill-rule="evenodd"` : ""}${this.alpha("fill-opacity")}`));
  }
  stroke() {
    const c = svgPaint(this.strokeStyle), w = this.lineWidth;
    if (!c || !(w > 0) || !Number.isFinite(w) || !this.path.finite() || !this.path.cmds.length) return;
    const cap = CAPS2.includes(this.lineCap) ? ` stroke-linecap="${this.lineCap}"` : "", join = JOINS2.includes(this.lineJoin) ? ` stroke-linejoin="${this.lineJoin}"` : "";
    const d = this.dash, dash = d.length && d.every((n) => n >= 0 && Number.isFinite(n)) && d.some((n) => n > 0) ? ` stroke-dasharray="${svgList(d)}"` : "";
    this.out.push(this.el(` fill="none" stroke="${c}" stroke-width="${svgNums([w])}"${cap}${join}${dash}${this.alpha("stroke-opacity")}`));
  }
  fillRect(x, y, w, h2) {
    const c = svgPaint(this.fillStyle);
    if (c && [x, y, w, h2].every(Number.isFinite)) this.out.push(`<rect x="${svgNums([x], this.digits)}" y="${svgNums([y], this.digits)}" width="${svgNums([w], this.digits)}" height="${svgNums([h2], this.digits)}" fill="${c}"${this.alpha("fill-opacity")}/>`);
  }
  /** Close what is still open and return the markup. */
  done() {
    this.out.push("</g>".repeat(this.open));
    this.open = 0;
    return this.out.join("");
  }
  /** The current path as an element with the given attributes. */
  el(attrs) {
    const g = svgGeom(this.path, this.digits);
    return `<${g.tag}${g.attrs}${attrs}/>`;
  }
  /** The opacity attribute; a value outside 0…1 is ignored, as the canvas ignores it. */
  alpha(attr) {
    const a = this.globalAlpha;
    return a >= 0 && a < 1 ? ` ${attr}="${svgNums([a])}"` : "";
  }
  snap() {
    const { fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, dash } = this;
    return { fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, dash };
  }
};

// ../sahne/src/render/still/render.ts
var RIM = 0.8;
var CREAM = "#FFF7EB";
var SEG = 8;
var CAP = 6;
var pixels = (n) => typeof n === "number" && n > 0 && n <= 4096 ? n : void 0;
function detailOf(o) {
  const px = pixels(o.detail) ?? pixels(o.size) ?? 96;
  return { digits: Number.isFinite(o.digits) ? Math.min(3, Math.max(0, Math.round(o.digits))) : px <= 160 ? 1 : 2, rim: o.rim ?? px >= 100, shadow: o.shadow ?? px >= 160, small: o.small ?? px <= 160 };
}
function finishSvg(svg, o) {
  const px = pixels(o.size), pre = o.idPrefix ? svgId(o.idPrefix) : "", at4 = svg.indexOf(">");
  if (pre) svg = svg.replace(/( id="|\(#)/g, "$1" + pre);
  const vb = /viewBox="([^"]+)"/.exec(svg.slice(0, at4 + 1))?.[1].split(" ").map(Number);
  let extra = "";
  if (px && vb) {
    const k = px / Math.max(vb[2], vb[3]);
    extra += ` width="${Math.round(vb[2] * k)}" height="${Math.round(vb[3] * k)}"`;
  }
  if (typeof o.label === "string" && o.label) extra += ` role="img" aria-label="${o.label.slice(0, 120).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"`;
  return extra ? svg.slice(0, at4) + extra + svg.slice(at4) : svg;
}
function boxApply(m, b) {
  const p = [apply(m, b[0], b[1]), apply(m, b[2], b[1]), apply(m, b[2], b[3]), apply(m, b[0], b[3])];
  return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];
}
var finite = (b) => b.every(Number.isFinite);
var meet = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
var area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
var union = (a, b) => a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b;
function square(b, margin) {
  const s = Math.max(b[2] - b[0], b[3] - b[1]) * (1 + 2 * margin) / 2, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return [cx - s, cy - s, cx + s, cy + s];
}
function frameBox(framing, b, world, items) {
  const head = world.get("head"), neck = world.get("neck");
  if (framing !== "full" && (!head || !neck)) throw new Error("sahne: the skeleton has no head or neck");
  const W2 = b.headW, H = b.headH;
  let x0 = -W2 / 2 - 3.6, x1 = W2 / 2 + 3.6, top = -H * 1.04;
  for (const { it } of items) if (it.bone === "head" && it.group && (it.layer === "hair_front" || it.layer === "hair_back" || it.layer === "headwear")) {
    const g = groupBounds(it.group);
    x0 = Math.min(x0, Math.max(g[0], -W2 * 0.8));
    x1 = Math.max(x1, Math.min(g[2], W2 * 0.8));
    top = Math.min(top, Math.max(g[1], -H * 1.5));
  }
  const hb = head ? boxApply(head, [x0, top, x1, H * 0.1]) : null;
  if (framing === "head") {
    const q = square(hb, 0.05), dy = hb[3] + (q[3] - q[1]) * 0.02 - q[3];
    return [q[0], q[1] + dy, q[2], q[3] + dy];
  }
  if (framing === "bust") {
    const n = apply(neck, 0, 0), half = Math.max((hb[2] - hb[0]) / 2, b.shoulderW / 2 + b.armW[0] * 0.6 + 1);
    return square([n[0] - half, hb[1], n[0] + half, Math.max(n[1] + b.torsoL * 0.5, hb[3])], 0.04);
  }
  let all = null;
  for (const { box } of items) all = union(all, box);
  const u = all ?? hb;
  if (!u) throw new Error("sahne: nothing to frame");
  const m = Math.max(u[2] - u[0], u[3] - u[1]) * 0.03;
  return [u[0] - m, u[1] - m, u[2] + m, u[3] + m];
}
function transform(m, digits) {
  const [a, b, c, d, e, f] = m;
  if (Math.abs(a - 1) + Math.abs(b) + Math.abs(c) + Math.abs(d - 1) < 1e-4) return e || f ? ` transform="translate(${svgList([e, f], digits)})"` : "";
  return ` transform="matrix(${svgList([a, b, c, d], 4)} ${svgList([e, f], digits)})"`;
}
function stripSvg(full, core, color, stripes, digits) {
  const P = (pts, fill2) => pts.length > 2 ? `<path d="${poly(pts).toCompactD(digits)}" fill="${fill2}"/>` : "";
  const ink = stripes && svgPaint(stripes[0]) || null, duty = stripeDuty(stripes?.[2]);
  const layer = (g, base, stripe) => {
    let out = P(stripOutline(g), base);
    if (stripe) {
      for (const [a, b] of stripeSpans(g.length, stripes[1], duty)) out += P(stripSlice(g, a, b), stripe);
      for (const c of [g.capFrom, g.capTo]) if (c && c.along / stripes[1] % 1 <= duty) out += P(c.pts, stripe);
    }
    return out;
  };
  const rim = (c) => mix(c, CREAM, 0.5);
  return core ? layer(full, rim(color), ink ? rim(ink) : null) + layer(core, color, ink) : layer(full, color, ink);
}
function renderSvg(puppet, kit, o) {
  const view = o.view === "back" ? "back" : "front", pre = svgId(o.idPrefix ?? "s"), b = puppet.body, { digits, rim, shadow, small } = detailOf(o);
  const world = solve(puppet.bones, o.pose ?? restPose());
  const raised = /* @__PURE__ */ new Set();
  const head = world.get("head");
  if (view === "front" && head) for (const s of ["l", "r"]) {
    const h3 = world.get("hand_" + s);
    if (h3 && apply(h3, 0, b.handL * 0.5)[1] < apply(head, 0, 0)[1] + 6) raised.add(s);
  }
  const armSide = (it) => it.strip?.chain.startsWith("arm_") ? it.strip.chain.slice(4) : ARM_BONE.exec(it.bone)?.[1] ?? "";
  const nodes = [], later = [], items = puppet.views[view], dflt = {};
  for (const it of items) if (it.alt?.default) dflt[it.alt.key] = it.alt.value;
  for (const it of items) {
    if (it.alt && (Object.hasOwn(o.alt ?? {}, it.alt.key) ? o.alt[it.alt.key] : dflt[it.alt.key]) !== it.alt.value) continue;
    const m = world.get(it.bone);
    let n = null;
    if (it.strip) {
      const j = stripJoints(world, it.strip.chain), color = svgPaint(it.strip.color);
      if (j && color) {
        const full = stripGeometry(j, it.strip, it.layer, { seg: SEG, capSeg: CAP });
        const pts = stripOutline(full);
        n = {
          it,
          box: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))],
          full,
          color,
          core: rim ? stripGeometry(j, it.strip, it.layer, { seg: SEG, capSeg: CAP, scale: RIM }) : null
        };
      }
    } else if (m && it.face && puppet.faceRegion) n = { it, m, box: boxApply(m, puppet.faceRegion) };
    else if (m && it.group) n = { it, m, box: boxApply(m, groupBounds(it.group)) };
    if (n && finite(n.box)) (raised.has(armSide(it)) ? later : nodes).push(n);
  }
  nodes.push(...later);
  const vb = frameBox(o.framing, b, world, nodes);
  if (!finite(vb) || !(vb[2] > vb[0]) || !(vb[3] > vb[1])) throw new Error("sahne: nothing to draw");
  const minDetail = small ? Math.max(vb[2] - vb[0], vb[3] - vb[1]) / 96 * 1.2 : 0;
  const fp = typeof o.face === "string" ? faceFrom(Object.hasOwn(kit.face.emotions, o.face) ? kit.face.emotions[o.face] : void 0) : o.face ?? faceFrom(void 0);
  let body = "", bone = null;
  const clips = /* @__PURE__ */ new Map(), clipsOf2 = (bone2) => {
    let m = clips.get(bone2);
    if (!m) clips.set(bone2, m = /* @__PURE__ */ new Map());
    return m;
  };
  const tiles = /* @__PURE__ */ new Map();
  const close = () => {
    if (bone !== null) body += "</g>";
    bone = null;
  };
  nodes.forEach((n, i) => {
    const m = meet(n.box, vb);
    if (m < area(vb) * (o.framing === "head" ? 0.06 : 0.01) && m < area(n.box) * 0.5) return;
    if (n.full) {
      close();
      body += stripSvg(n.full, n.core ?? null, n.color, n.it.strip.stripes, digits);
      return;
    }
    if (n.it.bone !== bone) {
      close();
      body += `<g${transform(n.m, digits)}>`;
      bone = n.it.bone;
    }
    if (n.it.face) {
      const ctx = new SvgContext(`${pre}f`, digits);
      kit.face.draw(ctx, puppet.faceStyle, fp, puppet.faceRegion);
      body += `<g stroke-linejoin="miter">${ctx.done()}</g>`;
    } else body += groupSvg(n.it.group, { id: `${pre}${i}_`, shadow: shadow ? `${pre}s` : void 0, digits, base: true, clips: clipsOf2(n.it.bone), tiles, minDetail });
  });
  close();
  const w = vb[2] - vb[0], h2 = vb[3] - vb[1], bg = svgPaint(o.background), x0 = view === "back" ? -vb[2] : vb[0];
  if (view === "back") body = `<g transform="matrix(-1 0 0 1 0 0)">${body}</g>`;
  return finishSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgList([x0, vb[1], w, h2], digits)}">` + (body.includes(`(#${pre}s)`) ? `<defs>${shadowFilter(`${pre}s`)}</defs>` : "") + (bg ? `<rect x="${svgNums([x0])}" y="${svgNums([vb[1]])}" width="${svgNums([w])}" height="${svgNums([h2])}" fill="${bg}"/>` : "") + `<g${SVG_BASE}>${body}</g></svg>`, { size: o.size, label: o.label });
}

// ../sahne/src/render/still/portrait.ts
var LIMIT = 6e6;
var limit = LIMIT;
var chars = 0;
var cache = /* @__PURE__ */ new Map();
function memo(key, make) {
  const hit = cache.get(key);
  if (hit !== void 0) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const v = make();
  cache.set(key, v);
  chars += key.length + v.length;
  for (const [k, old] of cache) {
    if (chars <= limit || k === key) break;
    cache.delete(k);
    chars -= k.length + old.length;
  }
  return v;
}
function clearPortraits(max = LIMIT) {
  cache.clear();
  chars = 0;
  limit = max;
}
var portraitCacheSize = () => ({ entries: cache.size, chars });
var report = null;
function onPortraitError(fn) {
  report = fn;
}
var fail = (e) => {
  try {
    report?.(e);
  } catch {
  }
};
var tag = (key) => (4294967296 * (2097151 & hashString("~" + key)) + hashString(key)).toString(36);
var framingOf = (o) => o.framing === "bust" || o.framing === "full" ? o.framing : "head";
function portrait(doc, kit, o = {}) {
  const framing = framingOf(o), trusted = o.trusted === true, d = detailOf(o), nd = normalize(doc, kit, { trusted });
  if (!nd) return silhouette(kit, o);
  const bg = svgPaint(o.background) ?? "", emotion = typeof o.emotion === "string" && Object.hasOwn(kit.face.emotions, o.emotion) ? o.emotion : "", view = o.view === "back" ? "back" : "front";
  const key = [kit.id, framing, emotion, view, bg, d.digits, d.rim, d.shadow, d.small, serialize(nd)].join("|");
  return finishSvg(memo(key, () => {
    try {
      return renderSvg(compose(nd, kit, { trusted }), kit, { framing, face: emotion, view, background: bg, ...d, idPrefix: "p" + tag(key) });
    } catch (e) {
      fail(e);
      return plain(kit, framing, bg, d);
    }
  }), o);
}
var PAPER = "#C9BFAF";
function silhouette(kit, o = {}) {
  return finishSvg(plain(kit, framingOf(o), svgPaint(o.background) ?? "", detailOf(o)), o);
}
function plain(kit, framing, bg, d) {
  const key = ["sil", kit.id, framing, bg, d.digits, d.rim, d.shadow].join("|");
  return memo(key, () => {
    try {
      return draw(kit, framing, bg, d, "z" + tag(key));
    } catch (e) {
      fail(e);
      return bare(framing, bg);
    }
  });
}
function bare(framing, bg) {
  const tall = framing === "full", w = tall ? 50 : 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 100">` + (bg ? `<rect width="${w}" height="100" fill="${bg}"/>` : "") + (tall ? `<circle cx="25" cy="14" r="10" fill="${PAPER}"/><path d="M8 100V36q0-8 8-8h18q8 0 8 8v64z" fill="${PAPER}"/>` : `<circle cx="50" cy="40" r="22" fill="${PAPER}"/><path d="M12 100c0-26 16-36 38-36s38 10 38 36z" fill="${PAPER}"/>`) + "</svg>";
}
function draw(kit, framing, bg, d, idPrefix) {
  const doc = normalize({ ...kit.defaultDoc, body: { build: "adult", height: 0.5, shape: "average" } }, kit, { trusted: true }) ?? kit.defaultDoc;
  const b = kit.body(doc.body), T = b.torsoL, sw = b.shoulderW / 2, ww = b.waistW / 2 + 1, hw = b.hipW / 2 + 1, nw = b.neckW / 2 + 1;
  const ctx = { avatar: doc, body: b, skin: PAPER, hair: PAPER, colors: [], pattern: null, garment: null, kit, clip: null };
  const torso = smooth([[-nw, -T - 0.5, 0], [-(sw - 1), -T + 1.5], [-(sw + 0.5), -T + 6, 0], [-ww - 1, -T * 0.35], [-hw, 6, 0], [0, 9], [hw, 6, 0], [ww + 1, -T * 0.35], [sw + 0.5, -T + 6, 0], [sw - 1, -T + 1.5], [nw, -T - 0.5, 0]], true, 1);
  const mine = (layer, bone) => ({ layer, bone, group: { shapes: [{ path: torso, fill: PAPER }] } });
  const rank = (it) => {
    const i = kit.layers.front.indexOf(it.layer);
    return i < 0 ? kit.layers.front.length : i;
  };
  const w = b.headW / 2, H = b.headH, egg = smooth([
    [0, -H],
    [w * 0.55, -H * 0.97],
    [w * 0.88, -H * 0.8],
    [w, -H * 0.55],
    [w * 0.9, -H * 0.28],
    [w * 0.62, -H * 0.08],
    [w * 0.3, -H * 0.01],
    [0, 0],
    [-w * 0.3, -H * 0.01],
    [-w * 0.62, -H * 0.08],
    [-w * 0.9, -H * 0.28],
    [-w, -H * 0.55],
    [-w * 0.88, -H * 0.8],
    [-w * 0.55, -H * 0.97]
  ], true, 1);
  const flat = (it) => it.layer === "head" ? { ...it, group: { shapes: [{ path: egg, fill: PAPER }] } } : it.group ? { ...it, group: { ...it.group, shapes: it.group.shapes.filter((s) => !s.flat) } } : it;
  const front = [...(kit.base.draw(ctx).front ?? []).filter((it) => !it.face).map(flat), mine("torso", "spine")].map((it, i) => ({ it, i })).sort((x, y) => rank(x.it) - rank(y.it) || x.i - y.i).map((x) => x.it);
  return renderSvg({ body: b, bones: humanoid(b), views: { front, back: front } }, kit, { framing, background: bg, ...d, idPrefix });
}

// ../sahne/src/anim/timeline.ts
var EMO_MS = 320;
var LOOK_MS = 220;
var CAM_MS = 450;
var HOLD_MS = 380;
var DOOR_OPEN_MS = 380;
var DOOR_CLOSE_MS = 520;
var TIME_MS = 900;
var SOUND_MS = 1300;
var STATE_FADE_MS = 400;
var STATE_ROLL_MS = 1400;
var WEATHER_MS = 1500;
var FLASH_RISE_MS = 60;
var FLASH_MS = 400;
var LIGHTS_MS = 600;
var SIT_MS = 700;
var RISER = 0.18;
var STAIR_MIN = 0.1;
var stairSteps = (dy) => Math.abs(dy) > STAIR_MIN ? Math.max(1, Math.round(Math.abs(dy) / RISER)) : 0;
function legLengths(pts, fly, steps) {
  return pts.slice(1).map((p, i) => {
    const dy = p[1] - pts[i][1];
    return fly ? Math.hypot(p[0] - pts[i][0], dy, p[2] - pts[i][2]) : Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2]) + (steps?.[i] ? Math.abs(dy) * 1.2 : 0);
  });
}
var emptyTrack = () => ({ walks: [], turns: [], emos: [], looks: [], gestures: [], speech: [], holds: [], on: [], costumes: [], seats: [] });
function lastAt(list, t) {
  let cur, prev;
  for (const e of list) {
    if (e.t > t) break;
    prev = cur;
    cur = e;
  }
  return [cur, prev];
}
function walkAt(seg2, t) {
  const fly = seg2.how === "fly", lens = legLengths(seg2.pts, fly, seg2.steps);
  const total = lens.reduce((a2, b2) => a2 + b2, 0) || 1e-6, T = seg2.t1 - seg2.t0;
  const a = Math.min(0.22, 260 / T), b = Math.min(0.25, 320 / T), u = clamp((t - seg2.t0) / T, 0, 1);
  const v = 1 / (1 - a / 2 - b / 2);
  const s = u < a ? v * u * u / (2 * a) : u > 1 - b ? 1 - v * (1 - u) * (1 - u) / (2 * b) : v * (u - a / 2);
  let d = clamp(s, 0, 1) * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) {
    d -= lens[i];
    i++;
  }
  const p0 = seg2.pts[i], p1 = seg2.pts[i + 1] ?? p0, k = lens[i] ? clamp(d / lens[i], 0, 1) : 1, n = seg2.steps?.[i] ?? 0;
  const q = k * n, y = n ? p0[1] + (p1[1] - p0[1]) * Math.min(1, (Math.floor(q) + smoothstep(0, 0.4, q - Math.floor(q))) / n) : lerp(p0[1], p1[1], k);
  const pos = [lerp(p0[0], p1[0], k), y + (seg2.lift ?? 0) * Math.sin(Math.PI * clamp(s, 0, 1)), lerp(p0[2], p1[2], k)];
  const l = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) || 1, dir = [(p1[0] - p0[0]) / l, 0, (p1[2] - p0[2]) / l];
  const amount = Math.min(clamp((t - seg2.t0) / 200, 0, 1), clamp((seg2.t1 - t) / 260, 0, 1));
  let phase = 0;
  for (let j = 0; j < i; j++) phase += seg2.steps?.[j] || lens[j] / seg2.stride;
  phase += n ? k * n : k * lens[i] / seg2.stride;
  return { pos, phase, amount, dir, climb: n ? Math.sign(p1[1] - p0[1]) * amount : 0 };
}
function chained(start, keys, t, e = ease.inOut) {
  let from = start, cur;
  const at4 = (time) => cur ? from + (cur.to - from) * e(clamp((time - cur.t) / Math.max(1, cur.dur), 0, 1)) : start;
  for (const k of keys) {
    if (k.t > t) break;
    const f = at4(k.t);
    cur = k;
    from = f;
  }
  return at4(t);
}
function visemeAt(keys, t) {
  if (!keys.length) return { v0: "rest", v1: "rest", k: 1 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const cur = keys[i], prev = keys[i - 1], next = keys[i + 1];
  const len = next ? next.t - cur.t : 200, ramp = Math.min(70, len / 2);
  return { v0: prev?.v ?? "rest", v1: cur.v, k: clamp((t - cur.t) / ramp, 0, 1) };
}
function evaluate(perf, t) {
  const B = perf.before, actors = {};
  for (const [id, a0] of Object.entries(B.actors)) {
    const tr = perf.tracks[id];
    const af = {
      id,
      on: a0.on,
      pos: [...a0.pos],
      yaw: a0.yaw,
      walk: null,
      emo: { from: a0.emo, to: a0.emo, k: 1 },
      look: { from: a0.look, to: a0.look, k: 1 },
      gestures: [],
      mouth: null,
      hold: {},
      turning: null,
      costume: a0.costume ?? "",
      air: !!a0.air,
      pace: !!a0.pace,
      seat: a0.seat !== void 0 ? { h: a0.seat, k: 1, ...a0.seatSide ? { side: a0.seatSide } : {} } : null
    };
    for (const side of ["l", "r"]) if (a0.hold[side]) af.hold[side] = { prop: a0.hold[side], w: 1 };
    actors[id] = af;
    if (!tr) continue;
    const [on] = lastAt(tr.on, t);
    if (on) af.on = on.on;
    const [c] = lastAt(tr.costumes ?? [], t);
    if (c) af.costume = c.key;
    const [st2, stPrev2] = lastAt(tr.seats ?? [], t);
    if (st2) {
      const k = ease.inOut(clamp((t - st2.t) / SIT_MS, 0, 1)), was = stPrev2 ? stPrev2.h : a0.seat ?? null, wasSide = stPrev2 ? stPrev2.side : a0.seatSide;
      af.seat = st2.h !== null ? { h: st2.h, k, ...st2.side ? { side: st2.side } : {} } : was !== null && k < 1 ? { h: was, k: 1 - k, ...wasSide ? { side: wasSide } : {} } : null;
    }
    for (const w of tr.walks) {
      if (w.t0 > t) break;
      const s = walkAt(w, t);
      af.pos = s.pos;
      af.air = !!w.air && t >= w.t1;
      af.pace = !!w.pace && af.air;
      if (t < w.t1) af.walk = { phase: s.phase, amount: s.amount, dir: s.dir, how: w.how, climb: s.climb };
    }
    af.yaw = chained(a0.yaw, tr.turns.map((k) => ({ t: k.t, to: k.yaw, dur: k.dur })), t);
    let prevYaw = a0.yaw;
    for (const k of tr.turns) {
      if (k.t > t) break;
      if (t < k.t + k.dur && Math.abs(k.yaw - prevYaw) > 0.18 && k.dur > 1) af.turning = (t - k.t) / k.dur;
      prevYaw = k.yaw;
    }
    const [e, ePrev] = lastAt(tr.emos, t);
    if (e) af.emo = { from: ePrev?.emo ?? a0.emo, to: e.emo, k: ease.out(clamp((t - e.t) / EMO_MS, 0, 1)) };
    const [l, lPrev] = lastAt(tr.looks, t);
    if (l) af.look = { from: lPrev ? lPrev.at : a0.look, to: l.at, k: ease.out(clamp((t - l.t) / LOOK_MS, 0, 1)) };
    for (const g of tr.gestures) {
      if (g.t0 > t || !g.loop && t > g.t0 + g.len) continue;
      af.gestures.push({ id: g.id, t: (t - g.t0) * g.tempo, side: g.side, at: g.at, n: g.n, loop: g.loop });
    }
    for (const s of tr.speech) {
      if (t < s.t0 || t > s.t1 + 120) continue;
      const v = visemeAt(s.keys, t - s.t0);
      const amount = Math.min(clamp((t - s.t0) / 60, 0, 1), clamp((s.t1 + 120 - t) / 120, 0, 1));
      af.mouth = { ...v, amount, voice: s.voice };
    }
    for (const side of ["l", "r"]) {
      const keys = tr.holds.filter((h3) => h3.side === side);
      const [h2] = lastAt(keys, t);
      if (!h2) continue;
      const k = clamp((t - h2.t) / HOLD_MS, 0, 1);
      af.hold[side] = h2.prop ? { prop: h2.prop, w: ease.inOut(k) } : { prop: null, w: 1 - ease.inOut(k) };
    }
  }
  const props = { ...B.props };
  for (const ev of perf.props) {
    if (ev.t > t) break;
    if (ev.state) props[ev.id] = ev.state;
    else delete props[ev.id];
  }
  for (const pa of perf.paths ?? []) {
    const p = props[pa.id];
    if (pa.t0 > t || !p || p.holder) continue;
    props[pa.id] = { ...p, at: polyAt(pa.pts, ease.inOut(clamp((t - pa.t0) / Math.max(1, pa.t1 - pa.t0), 0, 1))) };
  }
  const [cam, camPrev] = lastAt(perf.cams, t);
  const shot = cam ? { from: camPrev?.shot ?? B.shot, to: cam.shot, k: cam.cut ? 1 : ease.inOut(clamp((t - cam.t) / CAM_MS, 0, 1)), cut: !!cam.cut } : { from: B.shot, to: B.shot, k: 1, cut: false };
  const [tm, tmPrev] = lastAt(perf.times, t);
  const time = tm ? { from: tmPrev?.time ?? B.time, to: tm.time, k: ease.inOut(clamp((t - tm.t) / (tm.ms ?? TIME_MS), 0, 1)) } : { from: B.time, to: B.time, k: 1 };
  const [st, stPrev] = lastAt(perf.states ?? [], t), s0 = B.state ?? [];
  const state = st ? { from: stPrev?.on ?? s0, to: st.on, k: st.fade ? ease.inOut(clamp((t - st.t) / (st.ms ?? STATE_FADE_MS), 0, 1)) : 1 } : { from: s0, to: s0, k: 1 };
  const [wt, wtPrev] = lastAt(perf.weathers ?? [], t), w0 = B.weather ?? "clear";
  const weather = wt ? { from: wtPrev?.weather ?? w0, to: wt.weather, k: ease.inOut(clamp((t - wt.t) / WEATHER_MS, 0, 1)) } : { from: w0, to: w0, k: 1 };
  let flash = 0;
  for (const fl of perf.flashes ?? []) {
    if (fl.t > t) break;
    const u = t - fl.t;
    flash = Math.max(flash, u < FLASH_RISE_MS ? u / FLASH_RISE_MS : Math.max(0, 1 - (u - FLASH_RISE_MS) / FLASH_MS));
  }
  const [li, liPrev] = lastAt(perf.lights ?? [], t), l0 = B.lights === false ? 0 : 1;
  const lights = li ? (liPrev ? liPrev.on ? 1 : 0 : l0) + ((li.on ? 1 : 0) - (liPrev ? liPrev.on ? 1 : 0 : l0)) * ease.inOut(clamp((t - li.t) / LIGHTS_MS, 0, 1)) : l0;
  const [so] = lastAt(perf.stops ?? [], t), sb = B.stops;
  const stops = so ? { at: so.at, arrive: !!so.arrive, go: !!so.go } : sb ? { at: sb.at, arrive: false, go: !!sb.go } : null;
  const doors = {};
  for (const d of perf.doors) {
    const open = ease.inOut(clamp((t - d.t0) / DOOR_OPEN_MS, 0, 1)) * (1 - ease.inOut(clamp((t - d.t1) / DOOR_CLOSE_MS, 0, 1)));
    doors[d.piece] = Math.max(doors[d.piece] ?? 0, open);
  }
  return {
    t,
    done: t >= perf.dur,
    actors,
    props,
    shot,
    time,
    state,
    weather,
    flash,
    lights,
    stops,
    doors,
    bubbles: perf.bubbles.filter((b) => b.t0 <= t && t < b.t1)
  };
}

// ../sahne/src/anim/react.ts
var STEP = 60;
function peopleSamples(perfs, skip) {
  const out = [];
  let off = 0;
  for (let k = perfs.length - 1; k >= 0; k--) {
    const p = perfs[k];
    if (k < perfs.length - 1) off -= p.dur;
    for (const [id, a] of Object.entries(p.before.actors)) if (!skip(id) && a.on && !a.air) out.push({ t: off, id, x: a.pos[0], z: a.pos[2] });
    for (const [id, tr] of Object.entries(p.tracks)) {
      if (skip(id)) continue;
      for (const w of tr.walks) {
        if (w.how === "fly") continue;
        for (let t = w.t0; ; t = Math.min(w.t1, t + STEP)) {
          const q = walkAt(w, t).pos;
          out.push({ t: off + t, id, x: q[0], z: q[2] });
          if (t >= w.t1) break;
        }
      }
    }
  }
  return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function flights(home, flee, samples, until) {
  const out = [], last = /* @__PURE__ */ new Map(), ms = Math.max(350, flee.away / (flee.speed ?? 2.4) * 1e3);
  let at4 = [...home], busy = -Infinity;
  const go = (t, s) => {
    const dir = at4[0] >= s.x ? 1 : -1, to = [at4[0] + dir * flee.away, at4[1]];
    out.push({ t0: t, t1: t + ms, from: at4, to });
    at4 = to;
    busy = t + ms;
  };
  const near = (s) => Math.hypot(s.x - at4[0], s.z - at4[1]) < flee.r;
  for (const s of samples) {
    if (s.t > until) break;
    while (busy > -Infinity && s.t >= busy && out.length < 64) {
      const end = busy;
      busy = -Infinity;
      const c = [...last.values()].find(near);
      if (c) go(end, c);
    }
    last.set(s.id, s);
    if (s.t < busy) continue;
    if (near(s)) go(s.t, s);
  }
  return out;
}
function fleeAt(home, fl, t) {
  let pos = home, u = 0, dir = 1;
  for (const f of fl) {
    if (t < f.t0) break;
    dir = f.to[0] >= f.from[0] ? 1 : -1;
    if (t >= f.t1) {
      pos = f.to;
      continue;
    }
    u = (t - f.t0) / (f.t1 - f.t0);
    const e = u * u * (3 - 2 * u);
    pos = [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e];
    break;
  }
  return { dx: pos[0] - home[0], dz: pos[1] - home[1], u, dir };
}
function lookToward(r, d) {
  if (!(r > 0)) return 0;
  const x = Math.max(0, Math.min(1, (r - d) / (r * 0.4)));
  return x * x * (3 - 2 * x);
}
function reactShows(rc, re) {
  switch (rc.show) {
    case "rest":
      return !re.moving;
    case "away":
      return re.moving && (rc.face === void 0 || rc.face === re.dir);
    case "asleep":
      return !(re.look > 0);
    case "awake":
      return re.look > 0;
    default:
      return true;
  }
}

// ../sahne/src/director/route.ts
var CLEAR = 0.25;
var ROUND = CLEAR * 1.3;
function placeSolids(place, kit) {
  const out = [];
  for (const p of place.pieces ?? []) {
    const def = pieceOf(kit, "set", p.kit);
    if (!def?.solid || p.solid === false || typeof p.x !== "number" || typeof p.z !== "number") continue;
    for (const s of def.solid(withVariant(def, p))) {
      out.push({
        a: [round(p.x + s.a[0] / 100), round(p.z + s.a[1] / 100)],
        b: [round(p.x + s.b[0] / 100), round(p.z + s.b[1] / 100)],
        ...p.id ? { piece: p.id } : {},
        ...s.door && p.id ? { door: p.id } : {},
        ...p.in?.length ? { in: [...p.in] } : {}
      });
    }
  }
  return out;
}
var round = (v) => Math.round(v * 1e3) / 1e3;
var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
var cross = (a, b) => a[0] * b[1] - a[1] * b[0];
var dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function crosses(p, q, a, b) {
  const len = dist(a, b);
  if (len < 1e-6) return false;
  const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const A = [a[0] - d[0] * CLEAR, a[1] - d[1] * CLEAR], B = [b[0] + d[0] * CLEAR, b[1] + d[1] * CLEAR];
  const r = sub(q, p), s = sub(B, A), den = cross(r, s);
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(A, p), s) / den, u = cross(sub(A, p), r) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
}
function route(from, to, solids, o = {}) {
  const on = new Set(o.state ?? []);
  const lines = solids.filter((s) => (!s.in || s.in.some((x) => on.has(x))) && !(s.door && s.door === o.door));
  const P = [from[0], from[2]], Q = [to[0], to[2]];
  const free = (p, q) => !lines.some((l) => crosses(p, q, l.a, l.b));
  if (free(P, Q)) return [];
  const w = o.size ? o.size.w / 2 + 1 : Infinity, back = o.size ? -o.size.d - 1 : -Infinity, front = o.size ? 2 : Infinity;
  const nodes = [P];
  for (const l of lines) {
    const len = dist(l.a, l.b);
    if (len < 1e-6) continue;
    const d = [(l.b[0] - l.a[0]) / len, (l.b[1] - l.a[1]) / len], n = [-d[1], d[0]];
    for (const [e, k] of [[l.a, -1], [l.b, 1]]) for (const side of [-1, 1]) {
      const v = [round(e[0] + k * d[0] * ROUND + side * n[0] * ROUND), round(e[1] + k * d[1] * ROUND + side * n[1] * ROUND)];
      if (Math.abs(v[0]) <= w && v[1] >= back && v[1] <= front) nodes.push(v);
    }
  }
  nodes.push(Q);
  const N = nodes.length, best = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  best[0] = 0;
  for (; ; ) {
    let i = -1;
    for (let k = 0; k < N; k++) if (!done[k] && best[k] < Infinity && (i < 0 || best[k] < best[i] - 1e-9)) i = k;
    if (i < 0 || i === N - 1) break;
    done[i] = true;
    for (let k = 1; k < N; k++) {
      if (done[k] || k === i) continue;
      const c = best[i] + dist(nodes[i], nodes[k]);
      if (c < best[k] - 1e-9 && free(nodes[i], nodes[k])) {
        best[k] = c;
        prev[k] = i;
      }
    }
  }
  if (best[N - 1] === Infinity) return null;
  const way = [];
  for (let k = prev[N - 1]; k > 0; k = prev[k]) way.unshift(nodes[k]);
  const total = best[N - 1];
  let acc = 0, last = P;
  return way.map((v) => {
    acc += dist(last, v);
    last = v;
    const f = acc / total;
    return [v[0], round(from[1] + (to[1] - from[1]) * f), v[1]];
  });
}
function detour(from, to, way) {
  const pts = [from, ...way, to];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return len - Math.hypot(to[0] - from[0], to[2] - from[2]);
}

// ../sahne/src/render/paper/particles.ts
var MAX_SPRITES = 400;
function table(seed, n, k) {
  const r = rng(seed);
  return Array.from({ length: n }, () => Array.from({ length: k }, () => r()));
}
var cache2 = /* @__PURE__ */ new Map();
var rows = (seed, n, k) => {
  const key = `${seed}|${n}|${k}`;
  let t = cache2.get(key);
  if (!t) {
    t = table(seed, n, k);
    cache2.set(key, t);
    if (cache2.size > 64) cache2.delete(cache2.keys().next().value);
  }
  return t;
};
var frac = (x) => x - Math.floor(x);
function rainAt(seed, box, t, n, out) {
  const H = box.y1 - box.y0, fall = 7, period = H / fall * 1e3;
  for (const [a, b, c, d] of rows(seed, 260, 4).slice(0, Math.min(n, 260))) {
    const u = frac(t / (period * (0.85 + 0.3 * d)) + a);
    const y = box.y1 - u * H;
    out.push({ pos: [box.x0 + b * (box.x1 - box.x0) - u * 0.25, y, box.z0 + c * (box.z1 - box.z0)], w: 0.022, h: 0.32, color: [0.86, 0.91, 0.98, 0.42], shape: 1, lit: 0.4, slant: 0.05 });
  }
}
function puffAt(kind, seed, at4, t, out, w = 0.06) {
  const steam = kind === "steam", life2 = steam ? 2200 : 3600, n = steam ? 6 : 8, rise = steam ? 0.45 : 1.1;
  for (const [a, b] of rows(seed, n, 2)) {
    const u = frac(t / life2 + a);
    const s = (steam ? 0.05 : 0.08) + u * (steam ? 0.2 : 0.35);
    const alpha = Math.sin(Math.PI * u) * (steam ? 0.55 : 0.32);
    const g = steam ? 0.97 : 0.62;
    out.push({ pos: [at4[0] + (b - 0.5) * w + Math.sin(u * 5 + b * 6) * 0.04 * u, at4[1] + u * rise, at4[2]], w: s, h: s, color: [g, g, g + 0.01, alpha], shape: 0, lit: 0.5 });
  }
}
function flameAt(seed, at4, t, out, w = 0.012) {
  const [[ph]] = rows(seed, 1, 1), f = 0.5 * Math.sin(t / 90 + ph * 6) + 0.5 * Math.sin(t / 37 + ph * 11);
  const lean = (0.6 * Math.sin(t / 420 + ph * 9) + 0.25 * f) * w * 0.35;
  out.push({ pos: [at4[0] + lean, at4[1] + w * 1.2, at4[2]], w: w * 4.2, h: w * 5, color: [1, 0.72, 0.35, 0.16 + 0.04 * f], shape: 0, additive: true, lit: 0 });
  for (const [a, b] of rows(seed + "|f", 6, 2)) {
    const u = frac(t / 380 + a), s = w * (1 - u * 0.7) * (0.85 + b * 0.3);
    out.push({ pos: [at4[0] + lean * u * 2 + (b - 0.5) * w * 0.15, at4[1] + w * 0.55 + u * w * 1.7 * (1 + f * 0.1), at4[2]], w: s, h: s * 1.5, color: [1, 0.86 - u * 0.36, 0.42 - u * 0.3, 0.8 * (1 - u * u)], shape: 0, lit: 0 });
  }
  out.push({ pos: [at4[0] + lean * 0.4, at4[1] + w * 0.75, at4[2]], w: w * 0.7, h: w * 1.2, color: [1, 0.97, 0.78, 0.95], shape: 0, lit: 0 });
}
var BREATH_MS = 1300;
function breathAt(at4, age, dir, out) {
  if (age < 0 || age > BREATH_MS) return;
  const u = age / BREATH_MS, s = 0.06 + u * 0.2, a = 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.4));
  for (const [dx, dy, k] of [[0, 0, 1], [0.05, 0.03, 0.75], [-0.03, 0.05, 0.6]]) out.push({ pos: [at4[0] + dir * (0.06 + u * 0.22) + dx * s * 3, at4[1] + u * 0.08 + dy * s * 3, at4[2] + 0.06], w: s * k, h: s * 0.8 * k, color: [0.97, 0.98, 1, a], shape: 0, lit: 0.4 });
}
var BURST = [[1, 0.32, 0.3], [1, 0.97, 0.92], [1, 0.8, 0.35]];
var BURST_MS = 1800;
var BURST_RISE_MS = 120;
function burstAt(seed, at4, age, out, scale2 = 1) {
  if (age < 0 || age > BURST_MS) return;
  const k = age / 1e3, glow = Math.min(1, age / BURST_RISE_MS) * (age < 600 ? 1 : Math.max(0, 1 - (age - 600) / (BURST_MS - 600)));
  const col = BURST[Math.floor(rows(seed, 1, 1)[0][0] * BURST.length)];
  for (const [a, b] of rows(seed + "|s", 36, 2)) {
    const ang = a * Math.PI * 2, v = (1.6 + b * 1.4) * scale2;
    const r = v * (1 - Math.exp(-2.6 * k)) / 1.2;
    out.push({ pos: [at4[0] + Math.cos(ang) * r, at4[1] + Math.sin(ang) * r - 0.6 * scale2 * k * k, at4[2]], w: 0.22 * scale2, h: 0.22 * scale2, color: [...col, glow], shape: 0, additive: true, lit: 0, sky: true });
  }
}

// ../sahne/src/rig/layer.ts
var SIDES = ["l", "r"];
var other = (s) => s === "l" ? "r" : "l";
var sideX = (s) => s === "l" ? 1 : -1;
var limbSign = (s) => s === "l" ? -1 : 1;
function addRot(p, bone, v) {
  if (v) p.bones[bone] = (p.bones[bone] ?? 0) + v;
}
function addOff(p, bone, x, y) {
  if (!x && !y) return;
  const off = p.off ??= {}, o = off[bone];
  off[bone] = o ? [o[0] + x, o[1] + y] : [x, y];
}
function addLen(p, bone, d) {
  if (!d) return;
  const len = p.len ??= {};
  len[bone] = (len[bone] ?? 1) + d;
}

// ../sahne/src/rig/gesture.ts
var LAG = { head: -40, forearm: 30, hand: 60 };
var EASE = {
  inOut: ease.inOut,
  out: ease.out,
  in: ease.in,
  linear: ease.linear,
  spring: (t) => ease.spring(t)
};
var SORTED = /* @__PURE__ */ new WeakMap();
function keysOf(def) {
  let k = SORTED.get(def);
  if (!k) {
    k = def.keys.slice().sort((x, y) => x.t - y.t);
    SORTED.set(def, k);
  }
  return k;
}
var easeOf = (k, s) => (EASE[k.ease ?? "inOut"] ?? ease.inOut)(s);
function seg(keys, t) {
  const n = keys.length;
  if (!n) return { a: null, b: null, e: 0, i: -1 };
  if (t < keys[0].t) {
    const b2 = keys[0];
    return { a: null, b: b2, e: b2.t > 0 ? easeOf(b2, clamp(t / b2.t, 0, 1)) : 1, i: -1 };
  }
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const m = lo + hi + 1 >> 1;
    if (keys[m].t <= t) lo = m;
    else hi = m - 1;
  }
  if (lo === n - 1) return { a: keys[lo], b: null, e: 0, i: lo };
  const a = keys[lo], b = keys[lo + 1], span = b.t - a.t;
  return { a, b, e: span > 0 ? easeOf(b, (t - a.t) / span) : 1, i: lo };
}
function ch(s, c) {
  const va = s.a?.[c] ?? 0, vb = s.b ? s.b[c] ?? 0 : va;
  return va + (vb - va) * s.e;
}
function lenCh(s, c) {
  const va = s.a ? (s.a[c] ?? 1) - 1 : 0, vb = s.b ? (s.b[c] ?? 1) - 1 : va;
  return va + (vb - va) * s.e;
}
function latest(keys, i, has) {
  for (; i >= 0; i--) if (has(keys[i])) return keys[i];
  return void 0;
}
var loops = (def, run2) => !!(run2.loop && def.loop && def.loop[1] > def.loop[0]);
function localTime(def, t, loop) {
  if (loop) {
    const [a, b] = def.loop;
    if (t >= b) return a + (t - a) % (b - a);
  }
  return Math.max(0, t);
}
var newAcc = () => ({ reaches: [], shapes: {}, faces: [], faceOff: [0, 0] });
var LIMBS = [
  ["arm", "arm", false, 0],
  ["forearm", "forearm", false, 1],
  ["hand", "hand", false, 2],
  ["arm2", "arm", true, 0],
  ["forearm2", "forearm", true, 1],
  ["hand2", "hand", true, 2],
  ["thigh", "thigh", false, 0],
  ["shin", "shin", false, 0],
  ["foot", "foot", false, 0],
  ["thigh2", "thigh", true, 0],
  ["shin2", "shin", true, 0],
  ["foot2", "foot", true, 0]
];
function addFace(acc, preset, w) {
  if (w <= 1e-4) return;
  const f = acc.faces.find((x) => x.preset === preset);
  if (f) f.w += w;
  else acc.faces.push({ preset, w });
}
function applyGesture(pose, def, run2, acc, size = { legs: 1, head: 1 }) {
  const loop = loops(def, run2), w = clamp(run2.weight ?? 1, 0, 1);
  if (w <= 0 || run2.t < 0 || !loop && run2.t > def.dur) return;
  const keys = keysOf(def), at4 = (lag) => seg(keys, localTime(def, run2.t - lag, loop));
  const arm = at4(0), segs = [arm, at4(LAG.forearm), at4(LAG.hand)], head = at4(LAG.head);
  const s = run2.side, o = other(s), tx = sideX(s);
  for (const [c, bone, two, timing] of LIMBS) {
    const side = two ? o : s;
    addRot(pose, `${bone}_${side}`, limbSign(side) * w * ch(segs[timing], c));
  }
  addRot(pose, "spine", tx * w * ch(arm, "spine"));
  addRot(pose, "neck", tx * w * ch(head, "neck"));
  addRot(pose, "head", tx * w * ch(head, "head"));
  pose.dy += w * ch(arm, "dy") * size.legs;
  addOff(pose, "head", 0, w * ch(head, "headDy") * size.head);
  addLen(pose, `thigh_${s}`, w * lenCh(arm, "thighLen"));
  addLen(pose, `thigh_${o}`, w * lenCh(arm, "thighLen2"));
  acc.faceOff[0] += tx * w * ch(head, "faceX");
  acc.faceOff[1] += w * ch(head, "faceY");
  for (const [f, side] of [["reach", s], ["reach2", o]]) {
    const ra = arm.a?.[f], rb = arm.b ? arm.b[f] : void 0;
    const wa = ra ? ra.w ?? 1 : 0, wb = arm.b ? rb ? rb.w ?? 1 : 0 : wa;
    const wi = w * (wa + (wb - wa) * arm.e);
    if (wi > 1e-4) acc.reaches.push({ arm: side, a: ra, b: rb, e: arm.e, w: wi, target: run2.target });
  }
  if (w >= 0.5) for (const [f, side] of [["shape", s], ["shape2", o]]) {
    const k = latest(keys, segs[2].i, (k2) => k2[f] !== void 0);
    if (!k || w < (acc.shapes[side]?.w ?? 0)) continue;
    const shape = k[f];
    acc.shapes[side] = { shape: shape === "count" ? `count${clamp(Math.round(run2.n ?? 1), 1, 5)}` : shape, w };
  }
  const fa = head.a?.face, fb = head.b?.face;
  if (fa && fa === fb) addFace(acc, fa, w);
  else {
    if (fa) addFace(acc, fa, w * (1 - head.e));
    if (fb) addFace(acc, fb, w * head.e);
  }
  const lk = latest(keys, arm.i, (k) => k.look !== void 0);
  if (lk && w >= (acc.look?.w ?? 0)) acc.look = { v: lk.look, w };
}

// ../sahne/src/rig/ik.ts
var TAU = 2 * Math.PI;
var wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
var ARM_LO = -2.2;
var normArm = (a) => a - TAU * Math.floor((a - ARM_LO) / TAU);
var INDEX = /* @__PURE__ */ new WeakMap();
function boneIndex(bones) {
  let ix = INDEX.get(bones);
  if (!ix) {
    ix = new Map(bones.map((b) => [b.name, b]));
    INDEX.set(bones, ix);
  }
  return ix;
}
function twoBone(qx, qy, L1, L2, o, up = false) {
  let d = Math.hypot(qx, qy);
  if (d < 1e-6) {
    qx = 0;
    qy = 1;
    d = 1;
  }
  const ux = qx / d, uy = qy / d, r = clamp(d, Math.abs(L1 - L2), L1 + L2);
  const c = clamp((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r || 1), -1, 1), s = Math.sqrt(1 - c * c);
  const e1x = ux * c - uy * s, e1y = ux * s + uy * c, e2x = ux * c + uy * s, e2y = -ux * s + uy * c;
  const one = up ? o * e1x - e1y >= o * e2x - e2y : o * e1x + e1y >= o * e2x + e2y;
  const ex = one ? e1x : e2x, ey = one ? e1y : e2y, fx = ux * r - ex * L1, fy = uy * r - ey * L1;
  return [Math.atan2(-ex, ey), Math.atan2(-fx, fy)];
}
function selfPoint(to, world, ix, body, side, faceOff) {
  const o = sideX(side), W2 = body.headW, H = body.headH, fx = faceOff[0] * W2, fy = faceOff[1] * H;
  const head = world.get("head"), spine = world.get("spine");
  if (!head || !spine) return null;
  switch (to) {
    case "mouth":
      return apply(head, fx, -H * 0.19 + fy);
    case "chin":
      return apply(head, fx, -H * 0.04 + fy);
    case "nose":
      return apply(head, fx, -H * 0.305 + fy);
    case "eye":
      return apply(head, o * W2 * 0.205 + fx, -H * 0.43 + fy);
    case "ear":
      return apply(head, o * (W2 * 0.5 - 0.6), -H * 0.42);
    case "forehead":
      return apply(head, fx, -H * 0.7 + fy);
    case "head_top":
      return apply(head, 0, -H);
    case "chest":
      return apply(spine, 0, -body.torsoL * 0.7);
    case "belly":
      return apply(spine, 0, -body.torsoL * 0.25);
    case "hip":
      return apply(spine, o * body.hipW * 0.5, -body.torsoL * 0.1);
    case "shoulder2":
      return world.has(`arm_${other(side)}`) ? jointOf(world, `arm_${other(side)}`) : null;
    case "front": {
      const a = ix.get(`arm_${side}`);
      return a ? apply(spine, o * Math.abs(a.x) * 0.45, a.y + body.upperArmL * 0.95) : null;
    }
    default:
      return null;
  }
}
function acrossLimit(qx, qy, o) {
  const th = Math.atan2(o * qx, qy), lo = -2.75, hi = -1.95;
  if (th <= lo || th >= hi) return [qx, qy];
  const t = th > (lo + hi) / 2 ? hi : lo, d = Math.hypot(qx, qy);
  return [o * d * Math.sin(t), d * Math.cos(t)];
}
function solveReach(pose, ix, body, world, side, r, target, faceOff) {
  const arm = ix.get(`arm_${side}`), fore = ix.get(`forearm_${side}`), hand = ix.get(`hand_${side}`);
  const parent = arm?.parent ? world.get(arm.parent) : void 0;
  if (!arm || !fore || !hand || !parent) return null;
  let T = r.to === "target" ? target : selfPoint(r.to, world, ix, body, side, faceOff);
  if (!T) return null;
  const o = sideX(side), T0 = T;
  const S = jointOf(world, arm.name);
  const L1 = Math.hypot(fore.x, fore.y) * (pose.len?.[arm.name] ?? 1), L2 = Math.hypot(hand.x, hand.y) * (pose.len?.[fore.name] ?? 1), L3 = L1 + L2;
  if (r.off) {
    const k = (body.upperArmL + body.foreArmL) / 54;
    T = [T[0] + o * r.off[0] * k, T[1] + r.off[1] * k];
  }
  let qx = T[0] - S[0], qy = T[1] - S[1], near = false;
  if (r.aim === "dir") {
    const d = Math.hypot(qx, qy) || 1, want = clamp(r.ext ?? 0.95, 0, 1) * L3;
    if (d < want + body.handL) {
      near = true;
      const k = body.handL * 1.15 / Math.hypot(0.5, 1);
      qx += o * 0.5 * k;
      qy -= k;
    } else {
      qx *= want / d;
      qy *= want / d;
    }
  } else {
    const lim = 2 * Math.abs(arm.x) + 0.25 * L3;
    if (o * qx < -lim) qx = -o * lim;
  }
  if (r.aim === "dir" && !near || Math.hypot(qx, qy) >= L3) [qx, qy] = acrossLimit(qx, qy, o);
  const [p1, p2] = twoBone(qx, qy, L1, L2, o, near && qy > -0.25 * L3);
  const r1 = p1 - Math.atan2(-fore.x, fore.y), r2 = p2 - Math.atan2(-hand.x, hand.y);
  const off1 = r1 - Math.atan2(parent[1], parent[0]) - arm.rot;
  let H = null;
  if (r.aim === "dir") {
    const wx = S[0] + L1 * -Math.sin(p1) + L2 * -Math.sin(p2), wy = S[1] + L1 * Math.cos(p1) + L2 * Math.cos(p2);
    const want = Math.atan2(-(T0[0] - wx), T0[1] - wy);
    H = clamp(wrapPi(want - r2 - hand.rot), -1.1, 1.1);
  }
  return { A: normArm(limbSign(side) * (arm.rot + off1)), F: wrapPi(r2 - r1 - fore.rot), H };
}
function applyReach(pose, bones, body, world, q, faceOff) {
  const ix = boneIndex(bones);
  const a = q.a ? solveReach(pose, ix, body, world, q.arm, q.a, q.target, faceOff) : null;
  const b = q.b ? solveReach(pose, ix, body, world, q.arm, q.b, q.target, faceOff) : null;
  const mixH = (x, y) => x.H !== null && y.H !== null ? x.H + (y.H - x.H) * q.e : y.H ?? x.H;
  const sol = a && b ? { A: a.A + (b.A - a.A) * q.e, F: a.F + wrapPi(b.F - a.F) * q.e, H: mixH(a, b) } : a ?? b;
  const arm = ix.get(`arm_${q.arm}`), fore = ix.get(`forearm_${q.arm}`);
  if (!sol || !arm || !fore) return;
  const m = limbSign(q.arm), w = clamp(q.w, 0, 1);
  const A0 = normArm(m * (arm.rot + (pose.bones[arm.name] ?? 0))), F0 = pose.bones[fore.name] ?? 0;
  pose.bones[arm.name] = m * (A0 + (sol.A - A0) * w) - arm.rot;
  pose.bones[fore.name] = F0 + wrapPi(sol.F - F0) * w;
  const hand = `hand_${q.arm}`;
  if (sol.H !== null) {
    const H0 = pose.bones[hand] ?? 0;
    pose.bones[hand] = H0 + (sol.H - H0) * w;
  }
}

// ../sahne/src/rig/walk.ts
function walkLayer(pose, body, w, hold) {
  const A = clamp(w.amount, 0, 1), dir = w.dir < 0 ? -1 : 1, k = body.legLen / 74;
  if (A <= 0) return;
  const n = Math.floor(w.phase), u = w.phase - n, lift = Math.sin(Math.PI * u) * A;
  const step = (n & 1) === 0 ? "l" : "r";
  const c = clamp(w.climb ?? 0, -1, 1), knee = 1 + 1.8 * Math.abs(c) * (c > 0 ? 1 : 0.6);
  addLen(pose, `thigh_${step}`, -0.2 * lift * knee);
  addRot(pose, `thigh_${step}`, -dir * 0.1 * lift * knee);
  addRot(pose, `shin_${step}`, dir * 0.24 * lift * knee);
  if (c) addRot(pose, "spine", dir * 0.06 * c);
  const hopping = w.how === "hop", hop = hopping ? 7 : body.build === "child" ? 2.2 : body.build === "toddler" ? 1.4 : 0;
  pose.dy += k * A * ((hopping ? 2.6 : 1.6) * Math.cos(Math.PI * u) ** 2 - hop * Math.sin(Math.PI * u));
  if (hopping) {
    const land = Math.cos(Math.PI * u) ** 2 * A;
    for (const s of SIDES) {
      addLen(pose, `thigh_${s}`, -0.18 * land);
      addRot(pose, `arm_${s}`, (s === "r" ? -1 : 1) * 0.16 * lift * (1 - clamp(hold[s], 0, 1)));
    }
  }
  addRot(pose, "spine", dir * 0.035 * A);
  addRot(pose, "neck", -dir * 0.015 * A);
  addRot(pose, "head", -dir * 0.015 * A);
  const sw = Math.sin(Math.PI * w.phase) * A, late = Math.sin(Math.PI * (w.phase - 0.15)) * A;
  for (const s of SIDES) {
    const free = 1 - clamp(hold[s], 0, 1), sg = s === "r" ? -dir : dir;
    addRot(pose, `arm_${s}`, sg * 0.12 * sw * free);
    addRot(pose, `forearm_${s}`, sg * 0.07 * late * free);
  }
}

// ../sahne/src/rig/idle.ts
var SPAN = 24e4;
var NONE = new Float64Array(0);
var LIVES = /* @__PURE__ */ new Map();
function track(r, gap, at4, extra) {
  const t = [], x = [], y = [];
  let now = 0;
  while (now < SPAN) {
    const p = at4(r);
    t.push(now);
    if (p) {
      x.push(p[0]);
      y.push(p[1]);
    }
    const d = extra?.();
    if (d != null) t.push(now + d);
    now += gap();
  }
  return { t: Float64Array.from(t), x: x.length ? Float64Array.from(x) : NONE, y: y.length ? Float64Array.from(y) : NONE, cycle: now, start: 0 };
}
function life(seed) {
  let l = LIVES.get(seed);
  if (l) return l;
  if (LIVES.size >= 256) LIVES.clear();
  const r = rng(`idle:${seed}`);
  const breath = r.range(3800, 4600), sway = r.range(6400, 7800);
  const blinks = track(r, () => r.range(2200, 5500), () => null, () => r.chance(0.12) ? 240 : null);
  blinks.start = r.range(400, 3e3);
  const looks = track(r, () => r.range(800, 2600), (r2) => r2.chance(0.3) ? [0, 0] : [r2.range(-0.06, 0.06), r2.range(-0.04, 0.04)]);
  looks.start = r.range(0, 800);
  l = { breath, breathAt: r() * breath, sway, swayAt: r() * sway, blinks, looks };
  LIVES.set(seed, l);
  return l;
}
function find(k, t) {
  const tau = ((t - k.start) % k.cycle + k.cycle) % k.cycle;
  let lo = 0, hi = k.t.length - 1;
  while (lo < hi) {
    const m = lo + hi + 1 >> 1;
    if (k.t[m] <= tau) lo = m;
    else hi = m - 1;
  }
  return [lo, tau - k.t[lo]];
}
var blinkAt = (dt) => dt < 45 ? dt / 45 : dt < 70 ? 1 : dt < 150 ? 1 - ease.inOut((dt - 70) / 80) : 0;
var breathAt2 = (u) => u < 0.4 ? smoothstep(0, 0.4, u) : 1 - smoothstep(0.4, 1, u);
function idleAt(t, seed) {
  const l = life(seed);
  const [, db] = find(l.blinks, t);
  const [i, dl] = find(l.looks, t), n = l.looks.t.length, j = i > 0 ? i - 1 : n - 1;
  const s = Math.min(1, dl / 30), sx = l.looks.x[j] + (l.looks.x[i] - l.looks.x[j]) * s, sy = l.looks.y[j] + (l.looks.y[i] - l.looks.y[j]) * s;
  const breath = breathAt2(((t + l.breathAt) % l.breath + l.breath) % l.breath / l.breath);
  return { breath, sway: Math.sin(2 * Math.PI * (t + l.swayAt) / l.sway), blink: blinkAt(db), saccade: [sx, sy] };
}

// ../sahne/src/rig/pose.ts
function composePose(input) {
  const { bones, body } = input;
  const pose = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const hold = { l: clamp(input.hold?.l ?? 0, 0, 1), r: clamp(input.hold?.r ?? 0, 0, 1) };
  const busy = armsBusy(input.defs, input.gestures);
  for (const s of SIDES) if (hold[s] > 0) carry(pose, s, hold[s] * (1 - busy[s]));
  if (input.walk) walkLayer(pose, body, input.walk, hold);
  if (input.seat && input.seat.k > 0) seated(pose, body, input.seat, hold);
  if (input.emotion) posture(pose, body, input.emotion);
  let blink = 0, saccade = [0, 0];
  const idle2 = input.idle;
  if (idle2 && idle2.amount > 0) {
    const a = clamp(idle2.amount, 0, 1), life2 = idleAt(idle2.t, idle2.seed), k = body.torsoL / 43;
    addOff(pose, "spine", 0, -0.35 * k * a * life2.breath);
    addOff(pose, "arm_l", 0, -0.1 * k * a * life2.breath);
    addOff(pose, "arm_r", 0, -0.1 * k * a * life2.breath);
    const sway = 6e-3 * a * life2.sway;
    addRot(pose, "hips", sway);
    addRot(pose, "thigh_l", -sway);
    addRot(pose, "thigh_r", -sway);
    blink = a * life2.blink;
    saccade = [a * life2.saccade[0], a * life2.saccade[1]];
  }
  const acc = newAcc();
  const size = { legs: body.legLen / 74, head: body.headH / 50 };
  for (const run2 of input.gestures) {
    const def = input.defs[run2.id];
    if (def) applyGesture(pose, def, run2, acc, size);
  }
  if (acc.reaches.length) {
    const world = solve(bones, pose);
    for (const q of acc.reaches) applyReach(pose, bones, body, world, q, acc.faceOff);
  }
  keepFeetUp(pose, bones);
  const alt = {};
  for (const s of SIDES) {
    const shape = acc.shapes[s]?.shape ?? (hold[s] > 0 ? "hold" : void 0);
    if (shape) alt[`hand_${s}`] = shape;
  }
  const out = { pose, alt, faces: acc.faces, faceOff: acc.faceOff, blink, saccade };
  if (acc.look) out.look = acc.look.v;
  return out;
}
var ARMS = /* @__PURE__ */ new WeakMap();
function armsOf(def) {
  let r = ARMS.get(def);
  if (!r) {
    r = {
      a: def.keys.some((k) => !!(k.arm || k.forearm || k.hand || k.reach)),
      b: def.keys.some((k) => !!(k.arm2 || k.forearm2 || k.hand2 || k.reach2))
    };
    ARMS.set(def, r);
  }
  return r;
}
function armsBusy(defs, runs) {
  const out = { l: 0, r: 0 }, RAMP = 250;
  for (const run2 of runs) {
    const def = defs[run2.id];
    if (!def || run2.t < 0) continue;
    const looping = !!(run2.loop && def.loop);
    if (!looping && run2.t > def.dur) continue;
    const env = clamp(run2.t / RAMP, 0, 1) * (looping ? 1 : clamp((def.dur - run2.t) / RAMP, 0, 1)) * clamp(run2.weight ?? 1, 0, 1);
    const arms = armsOf(def), other2 = run2.side === "l" ? "r" : "l";
    if (arms.a) out[run2.side] = Math.max(out[run2.side], env);
    if (arms.b) out[other2] = Math.max(out[other2], env);
  }
  return out;
}
var CARRY = { arm: 0.24, forearm: -1.62, hand: 0.15 };
function carry(pose, s, h2) {
  const m = limbSign(s) * h2;
  addRot(pose, `arm_${s}`, m * CARRY.arm);
  addRot(pose, `forearm_${s}`, m * CARRY.forearm);
  addRot(pose, `hand_${s}`, m * CARRY.hand);
}
function posture(pose, body, e) {
  const tilt2 = e.headTilt || 0, p = clamp(e.posture || 0, -1, 1), k = body.torsoL / 43;
  addRot(pose, "head", 0.8 * tilt2);
  addRot(pose, "neck", 0.2 * tilt2);
  if (p < 0) {
    const s = -p;
    addLen(pose, "spine", -0.03 * s);
    addOff(pose, "neck", 0, 0.8 * s * k);
    addOff(pose, "arm_l", -0.4 * s * k, 0.5 * s * k);
    addOff(pose, "arm_r", 0.4 * s * k, 0.5 * s * k);
    addRot(pose, "arm_l", 0.04 * s);
    addRot(pose, "arm_r", -0.04 * s);
  } else if (p > 0) {
    addOff(pose, "spine", 0, -0.4 * p * k);
    addOff(pose, "neck", 0, -0.5 * p * k);
    addOff(pose, "arm_l", 0.5 * p * k, -0.3 * p * k);
    addOff(pose, "arm_r", -0.5 * p * k, -0.3 * p * k);
    addRot(pose, "arm_l", -0.03 * p);
    addRot(pose, "arm_r", 0.03 * p);
  }
}
var REST_ANKLES = /* @__PURE__ */ new WeakMap();
function seated(pose, body, s, hold) {
  const k = clamp(s.k, 0, 1), drop2 = Math.max(0, body.legLen - s.h * 100 - 2) * k;
  pose.dy += drop2;
  for (const side of SIDES) {
    addLen(pose, `thigh_${side}`, -0.5 * k);
    const free = 1 - clamp(hold[side], 0, 1), sg = side === "r" ? 1 : -1;
    addRot(pose, `arm_${side}`, -sg * 0.06 * k * free);
    addRot(pose, `forearm_${side}`, -sg * 0.24 * k * free);
  }
  addRot(pose, "spine", 0.01 * k);
}
function keepFeetUp(pose, bones) {
  let rest = REST_ANKLES.get(bones);
  if (!rest) {
    const w = solve(bones, restPose());
    rest = {};
    for (const s of SIDES) if (w.has(`foot_${s}`)) rest[s] = jointOf(w, `foot_${s}`)[1];
    REST_ANKLES.set(bones, rest);
  }
  if (rest.l === void 0 && rest.r === void 0) return;
  const world = solve(bones, pose);
  for (const s of SIDES) {
    const r0 = rest[s], thigh = `thigh_${s}`;
    if (r0 === void 0 || !world.has(thigh) || !world.has(`shin_${s}`)) continue;
    const sink = jointOf(world, `foot_${s}`)[1] - r0;
    if (sink <= 1e-9) continue;
    const len = pose.len?.[thigh] ?? 1, per = (jointOf(world, `shin_${s}`)[1] - jointOf(world, thigh)[1]) / len;
    if (per > 1) addLen(pose, thigh, -Math.max(0, Math.min(len - 0.2, sink / per)));
  }
}

// ../sahne/src/render/paper/atlas.ts
function makeCanvas(w, h2) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h2);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h2;
  return c;
}
var ctx2d = (c) => c.getContext("2d", { willReadFrequently: true });
var PAD = 6;
var ATLAS_MAX = 2048;
function cellSize(g, ppcm) {
  const box = groupBounds(g), px = (cm) => Math.max(1, Math.ceil(cm * ppcm) || 1);
  return { w: px(box[2] - box[0]), h: px(box[3] - box[1]) };
}
var fitsAtlas = (w, h2, size = ATLAS_MAX) => w + 2 * PAD <= size && h2 + 2 * PAD <= size;
function packShelves(cells, size, pad = PAD) {
  const slots = new Array(cells.length);
  const order = cells.map((_, i) => i).sort((a, b) => cells[b].h - cells[a].h || cells[b].w - cells[a].w || a - b);
  let layer = 0, x = pad, y = pad, row = 0;
  for (const i of order) {
    const { w, h: h2 } = cells[i];
    if (w + 2 * pad > size || h2 + 2 * pad > size) throw new Error(`piece too large for the atlas: ${w}\xD7${h2}px`);
    if (x + w + pad > size) {
      x = pad;
      y += row + pad;
      row = 0;
    }
    if (y + h2 + pad > size) {
      layer++;
      x = pad;
      y = pad;
      row = 0;
    }
    slots[i] = { layer, x, y };
    x += w + pad;
    row = Math.max(row, h2);
  }
  return { slots, layers: cells.length ? layer + 1 : 0 };
}
var textureBytes = (size, layers) => Math.round(size * size * 4 * layers * 4 / 3);
var Atlas = class {
  size;
  texture = null;
  /** The layers of the uploaded texture. */
  layers = 0;
  gl;
  items = [];
  scratch = null;
  /** Packed, being painted (`pack` → `paint` → `send`). */
  job = null;
  /** Pieces were drawn since the mips were made (`ensure`). */
  stale = false;
  /** Told about the pixels as they are made (the hit tests' alpha masks). */
  hook = null;
  constructor(gl, size = 2048) {
    this.gl = gl;
    this.size = size;
  }
  /**
   * Rasterise a group at `ppcm` pixels per centimetre. Cells are placed (`pack`) and pixels drawn
   * (`paint`) later; until then the rect holds only its box. A `lazy` piece (a hand shape the pose
   * does not use yet, the back of a figure that faces the viewer) gets its cell then but is drawn
   * when first needed (`ensure`), which keeps a rebuild cheap.
   */
  add(g, ppcm, lazy = false) {
    const box = groupBounds(g), { w, h: h2 } = cellSize(g, ppcm);
    const rect2 = { layer: 0, u0: 0, v0: 0, u1: 0, v1: 0, box: [box[0], box[1], box[0] + w / ppcm, box[1] + h2 / ppcm] };
    this.items.push({ rect: rect2, g, ppcm, w, h: h2, lazy });
    return rect2;
  }
  draw(ctx, g, ppcm, box, x, y, w, h2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h2);
    ctx.clip();
    ctx.setTransform(ppcm, 0, 0, ppcm, x - box[0] * ppcm, y - box[1] * ppcm);
    drawGroup(ctx, g, ppcm);
    ctx.restore();
  }
  /** Place every cell (a piece too large throws here) and make the layers' canvases: then `paint`, then `send`. */
  pack() {
    const S = this.size, { slots, layers } = packShelves(this.items, S);
    this.job = { slots, layers, i: 0, big: 0, cv: Array.from({ length: layers }, () => {
      const canvas = makeCanvas(S, S);
      return { canvas, ctx: ctx2d(canvas) };
    }) };
  }
  /** Draw the pieces that are not lazy until `until` (`performance.now()`) is past, so a scene to come is drawn in idle time; whether all are drawn. */
  paint(until = Infinity) {
    const j = this.job, S = this.size, items = this.items;
    while (j.i < items.length && performance.now() <= until) {
      const it = items[j.i], s = j.slots[j.i++], r = it.rect;
      r.layer = s.layer;
      r.u0 = s.x / S;
      r.v0 = s.y / S;
      r.u1 = (s.x + it.w) / S;
      r.v1 = (s.y + it.h) / S;
      if (it.lazy) {
        r.lazy = { g: it.g, ppcm: it.ppcm, x: s.x, y: s.y, w: it.w, h: it.h };
        j.big = Math.max(j.big, it.w, it.h);
      } else {
        const c = j.cv[s.layer].ctx;
        this.draw(c, it.g, it.ppcm, r.box, s.x, s.y, it.w, it.h);
        if (until < Infinity) c.getImageData(s.x, s.y, 1, 1);
      }
    }
    return j.i >= items.length;
  }
  /** Send the painted layers to the GPU. */
  send() {
    const gl = this.gl, S = this.size, { layers, cv, big } = this.job, n = Math.max(1, layers);
    if (this.texture) gl.deleteTexture(this.texture);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(S)) + 1, gl.RGBA8, S, S, n);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    cv.forEach((L2, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, L2.canvas));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension("EXT_texture_filter_anisotropic");
    if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    this.texture = t;
    this.layers = n;
    this.items = [];
    this.job = null;
    this.hook?.layers((k) => cv[k].ctx.getImageData(0, 0, S, S), layers, S);
    if (big) {
      const canvas = makeCanvas(big, big);
      this.scratch = { canvas, ctx: ctx2d(canvas) };
    }
  }
  /** Draw a lazy piece into its cell now (a no-op for any other). Call before a quad uses the rect; `settle` before drawing. */
  ensure(r) {
    const z = r.lazy, sc = this.scratch;
    if (!z || !sc || !this.texture) return;
    r.lazy = void 0;
    const gl = this.gl, ctx = sc.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, z.w, z.h);
    this.draw(ctx, z.g, z.ppcm, r.box, 0, 0, z.w, z.h);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, z.x, z.y, r.layer, z.w, z.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, sc.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.stale = true;
    this.hook?.piece(r.layer, z.x, z.y, () => ctx.getImageData(0, 0, z.w, z.h));
  }
  /** Make the mips of pieces drawn by `ensure`: once, however many there were. */
  settle() {
    if (!this.stale || !this.texture) return;
    this.stale = false;
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.texture);
    this.gl.generateMipmap(this.gl.TEXTURE_2D_ARRAY);
  }
  /** GPU memory of the uploaded texture, in bytes. */
  get bytes() {
    return this.texture ? textureBytes(this.size, this.layers) : 0;
  }
  dispose() {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.texture = null;
    this.scratch = null;
    this.items = [];
    this.job = null;
  }
};
var MAX_FACES = 12;
var faceSlots = (actors) => Math.max(1, Math.min(MAX_FACES, Math.floor(actors) || 1));
var FaceAtlas = class {
  slot = 512;
  texture;
  gl;
  canvas;
  ctx;
  count;
  constructor(gl, count = 1) {
    this.gl = gl;
    this.count = faceSlots(count);
    this.canvas = makeCanvas(this.slot, this.slot);
    this.ctx = ctx2d(this.canvas);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(this.slot) + 1, gl.RGBA8, this.slot, this.slot, this.count);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  /** Redraw one slot: `draw` paints into a context mapped to the region box (cm). */
  update(slot, region, draw2) {
    const ctx = this.ctx, s = this.slot, w = region[2] - region[0], h2 = region[3] - region[1];
    const k = s / Math.max(w, h2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.setTransform(k, 0, 0, k, -region[0] * k + (s - w * k) / 2, -region[1] * k + (s - h2 * k) / 2);
    draw2(ctx);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slot, s, s, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }
  /** The square box (cm) a slot covers for a region, matching update()'s mapping. */
  static squareBox(region) {
    const w = region[2] - region[0], h2 = region[3] - region[1], m = Math.max(w, h2);
    const cx = (region[0] + region[2]) / 2, cy = (region[1] + region[3]) / 2;
    return [cx - m / 2, cy - m / 2, cx + m / 2, cy + m / 2];
  }
  /** GPU memory, in bytes. */
  get bytes() {
    return textureBytes(this.slot, this.count);
  }
  dispose() {
    this.gl.deleteTexture(this.texture);
  }
};

// ../sahne/src/render/paper/shaders.ts
var VERT = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aUVL;      // texture: u, v, layer \xB7 strip: stripe colour
layout(location=2) in vec4 aColor;    // tint, or the strip / sky / shadow colour (premultiplied)
layout(location=3) in vec4 aParams;   // mode, lit, dof (strip: stripe duty), strip stripe period (cm)
layout(location=4) in vec2 aLocal;    // strip: along (cm), across (-1..1) \xB7 blob: -1..1
uniform mat4 uVP;
out vec3 vUVL; out vec4 vColor; out vec4 vParams; out vec2 vLocal; out vec3 vWorld;
void main() {
  vUVL = aUVL; vColor = aColor; vParams = aParams; vLocal = aLocal; vWorld = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
var FRAG = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vUVL; in vec4 vColor; in vec4 vParams; in vec2 vLocal; in vec3 vWorld;
uniform sampler2DArray uAtlas;
uniform sampler2DArray uFaces;
uniform vec3 uCam;
uniform vec3 uAmb;
uniform vec3 uKey;
uniform vec4 uLightPos[4];   // xyz, radius (0 = off)
uniform vec4 uLightCol[4];   // rgb, intensity
uniform vec4 uHaze;          // rgb, density per metre
uniform vec2 uFocus;         // focus distance (m), mip bias per metre away from it
uniform float uGrain;
uniform float uGlow;
uniform float uDim;
out vec4 frag;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 lightAt(vec3 albedo, float lit) {
  vec3 l = uAmb + uKey;
  for (int i = 0; i < 4; i++) {
    float r = uLightPos[i].w;
    if (r <= 0.0) continue;
    float d = distance(vWorld, uLightPos[i].xyz);
    float f = clamp(1.0 - d / r, 0.0, 1.0);
    l += uLightCol[i].rgb * uLightCol[i].a * f * f;
  }
  return albedo * mix(vec3(1.0), l, lit);
}

void main() {
  int mode = int(vParams.x + 0.5);
  float lit = vParams.y, dof = vParams.z;
  float depth = distance(vWorld, uCam);
  float bias = dof * clamp(abs(depth - uFocus.x) * uFocus.y, 0.0, 2.4);
  if (mode == 7) { // a particle: rain, steam, breath, a spark
    float a = vParams.w > 0.5
      ? (1.0 - smoothstep(0.3, 1.0, abs(vLocal.x))) * (1.0 - smoothstep(0.5, 1.0, abs(vLocal.y)))
      : 1.0 - smoothstep(0.15, 1.0, length(vLocal));
    a *= vColor.a;
    if (a <= 0.002) discard;
    if (vParams.z > 0.5) { frag = vec4(vColor.rgb * a * uDim, 0.0); return; }
    vec3 rgb = lightAt(vColor.rgb, lit);
    rgb = mix(rgb, uHaze.rgb, (1.0 - exp(-depth * uHaze.w)) * lit);
    frag = vec4(rgb * a * uDim, a); return;
  }
  if (mode == 2) { // a soft drop shadow: the piece's alpha from a small mip
    float a = texture(uAtlas, vUVL, 3.0 + bias).a * vColor.a;
    frag = vec4(vColor.rgb * a * uDim, a); return;
  }
  if (mode == 4) {
    float a = (1.0 - smoothstep(0.25, 1.0, length(vLocal))) * vColor.a;
    frag = vec4(vColor.rgb * a * uDim, a); return;
  }
  vec4 c; vec2 grainAt;
  if (mode == 0 || mode == 5) { c = texture(uAtlas, vUVL, bias) * vColor; grainAt = vUVL.xy * 1100.0; }
  else if (mode == 6) { c = texture(uFaces, vUVL, bias * 0.5) * vColor; grainAt = vUVL.xy * 260.0; }
  else if (mode == 1) {
    float t = abs(vLocal.y), aa = max(fwidth(vLocal.y) * 1.2, 0.003);
    float a = 1.0 - smoothstep(1.0 - aa, 1.0, t);
    vec3 col = vColor.rgb;
    if (vParams.w > 0.0) col = mix(col, vUVL, step(fract(vLocal.x / vParams.w), vParams.z));
    float rim = smoothstep(0.80 - aa, 0.80, t);
    col = mix(col, mix(col, vec3(1.0, 0.97, 0.92), 0.5), rim);
    col *= 1.0 - 0.07 * smoothstep(-0.2, 0.9, vLocal.y);   // the band turns from the light
    c = vec4(col * a, a); grainAt = vLocal * vec2(4.0, 30.0);
  }
  else { c = vColor; grainAt = gl_FragCoord.xy; }
  if (c.a <= 0.002) discard;
  if (mode == 5) { frag = vec4(c.rgb * uGlow * uDim, 0.0); return; }
  vec3 rgb = lightAt(c.rgb / c.a, lit);
  rgb = mix(rgb, uHaze.rgb, (1.0 - exp(-depth * uHaze.w)) * lit);
  rgb *= 1.0 + (hash(floor(grainAt)) - 0.5) * uGrain;
  frag = vec4(rgb * c.a * uDim, c.a);
}`;

// ../sahne/src/render/paper/camera.ts
var NEAR = 0.1;
var FAR = 600;
function wideBox(place) {
  const wide = place?.camera?.wide, w = wide?.w ?? (place ? place.size.w * 0.86 : 6), x = wide?.x ?? 0;
  return { x0: x - w / 2, x1: x + w / 2, y0: wide?.y0 ?? 0.15, y1: wide?.y1 ?? 2.45, z: wide?.z ?? -(place?.size.d ?? 4) / 2 };
}
function frameBoxes(boxes, o) {
  const fov = o.fov ?? 0.52, m = 1 + (o.margin ?? 0.12), tilt2 = o.tilt ?? 0.1;
  const tanV = Math.tan(fov / 2) / m, tanH = tanV * o.aspect;
  const pts = boxes.flatMap((b) => [[b.x0, b.y0, b.z], [b.x1, b.y0, b.z], [b.x0, b.y1, b.z], [b.x1, b.y1, b.z]]);
  let tx = (Math.min(...boxes.map((b) => b.x0)) + Math.max(...boxes.map((b) => b.x1))) / 2;
  let ty = (Math.min(...boxes.map((b) => b.y0)) + Math.max(...boxes.map((b) => b.y1))) / 2;
  const tz = boxes.reduce((s, b) => s + b.z, 0) / boxes.length;
  const fl = Math.hypot(1, tilt2), fwd = [0, -tilt2 / fl, -1 / fl], up = [0, 1 / fl, -tilt2 / fl];
  const view = (eye, p) => {
    const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    return { x: d[0], y: d[0] * 0 + d[1] * up[1] + d[2] * up[2], z: d[1] * fwd[1] + d[2] * fwd[2] };
  };
  let dist3 = o.minDist ?? 0.9;
  for (let pass = 0; pass < 3; pass++) {
    const eyeAt = (d) => [tx - fwd[0] * d, ty - fwd[1] * d, tz - fwd[2] * d];
    const fits = (d) => pts.every((p) => {
      const v = view(eyeAt(d), p);
      return v.z > 0.1 && Math.abs(v.x) <= v.z * tanH && Math.abs(v.y) <= v.z * tanV;
    });
    let lo = o.minDist ?? 0.9, hi = 60;
    if (fits(lo)) hi = lo;
    else for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    dist3 = hi;
    const eye = eyeAt(dist3);
    const sx = pts.map((p) => {
      const v = view(eye, p);
      return v.x / v.z;
    }), sy = pts.map((p) => {
      const v = view(eye, p);
      return v.y / v.z;
    });
    const cx = (Math.min(...sx) + Math.max(...sx)) / 2, cy = (Math.min(...sy) + Math.max(...sy)) / 2;
    const zt = dist3;
    tx += cx * zt;
    ty += cy * zt * up[1] - (o.lift ?? 0) * tanV * zt;
  }
  return { fov, target: [tx, ty, tz], eye: [tx - fwd[0] * dist3, ty - fwd[1] * dist3, tz - fwd[2] * dist3] };
}
function blendCam(a, b, t) {
  const l = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  return { eye: l(a.eye, b.eye), target: l(a.target, b.target), fov: a.fov + (b.fov - a.fov) * t };
}
var FALLBACK = { H: 172, headH: 50, headW: 44, shoulderW: 42 };
var bodyDims = (b) => ({ H: b.H, headH: b.headH, headW: b.headW, shoulderW: b.shoulderW, armL: b.upperArmL + b.foreArmL + b.handL });
function figureDims(p) {
  const head = solve(p.bones, restPose()).get("head");
  let crown = 0, headHalf = 0;
  if (head) for (const v of [p.views.front, p.views.back]) for (const it of v) {
    if (it.bone !== "head" || !it.group) continue;
    const [x0, y0, x1, y1] = groupBounds(it.group);
    for (const q of [apply(head, x0, y0), apply(head, x1, y0), apply(head, x1, y1), apply(head, x0, y1)]) {
      crown = Math.max(crown, -q[1]);
      headHalf = Math.max(headHalf, Math.abs(q[0]));
    }
  }
  return { ...bodyDims(p.body), crown, headHalf };
}
function measures(d) {
  const fin = (v, def) => v !== void 0 && Number.isFinite(v) && v > 0 ? v : def;
  const H = fin(d.H, FALLBACK.H), headH = fin(d.headH, FALLBACK.headH), headW = fin(d.headW, FALLBACK.headW), sh = fin(d.shoulderW, FALLBACK.shoulderW);
  return { H, headH, headW, sh, reach: sh / 2 + fin(d.armL, sh * 1.6), up: Math.max(0, fin(d.crown, H + headH * 0.14) - H), hw: Math.max(headW * 0.55, fin(d.headHalf, headW * 0.58)) };
}
function figureBox(f, d, ref) {
  const b = measures(d), m = (cm) => cm / 100, z = 0;
  if (f === "full") {
    const r = ref ? measures(ref) : b, R3 = Math.max(b.H, r.H), pad = Math.max(R3 * 0.04, r.headH * 0.2, b.up + 1.5), half = Math.max(r.sh * 1.15, r.headW * 0.9, r.reach);
    return { x0: -m(half), x1: m(half), y0: -m(pad), y1: m(R3 + pad), z };
  }
  const top = m(b.H + b.up + 1 + b.headH * (f === "head" ? 0.22 : 0.12));
  if (f === "bust") {
    const half = m(Math.max(b.sh * 0.68, b.hw));
    return { x0: -half, x1: half, y0: m(b.H - b.headH * 2.05), y1: top, z };
  }
  return { x0: -m(b.hw), x1: m(b.hw), y0: m(b.H - b.headH * 1.2), y1: top, z };
}
function figureCam(f, dims, aspect, ref) {
  return frameBoxes([figureBox(f, dims, ref)], { aspect, margin: f === "full" ? 0.03 : f === "bust" ? 0.06 : 0.1, tilt: 0.04, minDist: 1 });
}
var sameCam = (a, b, tol = 1e-5) => Math.abs(a.fov - b.fov) < tol && a.eye.every((v, i) => Math.abs(v - b.eye[i]) < tol) && a.target.every((v, i) => Math.abs(v - b.target[i]) < tol);
function stepCam(shown, target, dt, ms) {
  if (ms <= 0 || dt >= ms) return target;
  const c = blendCam(shown, target, 1 - Math.exp(-5 * Math.max(0, dt) / ms));
  return sameCam(c, target, 2e-3) ? target : c;
}

// ../sahne/src/render/paper/renderer.ts
var FLOATS = 16;
var MODE = { piece: 0, strip: 1, shadow: 2, flat: 3, blob: 4, glow: 5, face: 6, particle: 7 };
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("sahne shader: " + gl.getShaderInfoLog(s));
  return s;
}
var PaperRenderer = class {
  gl;
  canvas;
  alpha;
  atlas;
  faces;
  /** Draw nothing behind the actors and clear to transparent (needs `alpha`). */
  transparent = false;
  /** The context is lost: nothing can be drawn until `onRestore` runs. */
  lost = false;
  /** The context was lost / came back. After a restore the atlases are empty: the stage fills them again. */
  onLost = null;
  onRestore = null;
  prog;
  vao;
  buf;
  data = new Float32Array(FLOATS * 6 * 2048);
  n = 0;
  u = {};
  gone = false;
  /** Throws when WebGL2 or the shaders are not available: the stage catches it and runs without a renderer. */
  constructor(canvas, o = {}) {
    this.canvas = canvas;
    this.alpha = !!o.alpha;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: this.alpha, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) throw new Error("sahne: WebGL2 is not available");
    this.gl = gl;
    this.init();
    this.atlas = new Atlas(gl);
    this.faces = new FaceAtlas(gl, 1);
    canvas.addEventListener("webglcontextlost", this.onLoss);
    canvas.addEventListener("webglcontextrestored", this.onBack);
  }
  /** The program and buffers: made again after a lost context comes back. */
  init() {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("sahne program: " + gl.getProgramInfoLog(p));
    this.prog = p;
    for (const name of ["uVP", "uAtlas", "uFaces", "uCam", "uAmb", "uKey", "uLightPos", "uLightCol", "uHaze", "uFocus", "uGrain", "uGlow", "uDim"]) this.u[name] = gl.getUniformLocation(p, name);
    this.vao = gl.createVertexArray();
    this.buf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const stride = FLOATS * 4;
    const attr = (loc, size, off) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
    };
    attr(0, 3, 0);
    attr(1, 3, 3);
    attr(2, 4, 6);
    attr(3, 4, 10);
    attr(4, 2, 14);
    gl.bindVertexArray(null);
  }
  // the browser may bring a lost context back only if the loss event is cancelled
  onLoss = (e) => {
    e.preventDefault();
    this.lost = true;
    this.onLost?.();
  };
  onBack = () => {
    if (this.gone) return;
    this.lost = false;
    try {
      this.init();
    } catch (err) {
      console.warn("sahne: could not restore the renderer", err);
      this.lost = true;
      return;
    }
    this.atlas = new Atlas(this.gl, this.atlas.size);
    this.faces = new FaceAtlas(this.gl, this.faces.count);
    this.onRestore?.();
  };
  /** Draw from `a` (packed and painted) from now on: the old atlas is freed first, then `a` is sent to the GPU, so the two are never there at once. */
  use(a) {
    this.atlas.dispose();
    this.atlas = a;
    a.send();
  }
  /** Face slots for `count` actors, kept if there are enough already. */
  newFaces(count) {
    if (count === this.faces.count) return this.faces;
    this.faces.dispose();
    this.faces = new FaceAtlas(this.gl, count);
    return this.faces;
  }
  /** GPU memory of the atlas and the faces, in bytes (an estimate: layers × size² × 4, a third more for mips). */
  get textureBytes() {
    return this.atlas.bytes + this.faces.bytes;
  }
  begin() {
    this.n = 0;
  }
  grow() {
    const d = new Float32Array(this.data.length * 2);
    d.set(this.data);
    this.data = d;
  }
  vert(p, uvl, c, params, local) {
    if ((this.n + 1) * FLOATS > this.data.length) this.grow();
    const d = this.data, o = this.n * FLOATS;
    d[o] = p[0];
    d[o + 1] = p[1];
    d[o + 2] = p[2];
    d[o + 3] = uvl[0];
    d[o + 4] = uvl[1];
    d[o + 5] = uvl[2];
    d[o + 6] = c[0];
    d[o + 7] = c[1];
    d[o + 8] = c[2];
    d[o + 9] = c[3];
    d[o + 10] = params[0];
    d[o + 11] = params[1];
    d[o + 12] = params[2];
    d[o + 13] = params[3];
    d[o + 14] = local[0];
    d[o + 15] = local[1];
    this.n++;
  }
  /** A textured quad: corners in world space in the order (x0,y0) (x1,y0) (x1,y1) (x0,y1) of the rect. */
  quad(c, r, mode, lit, dof, tint = [1, 1, 1, 1]) {
    const uv = [[r.u0, r.v0, r.layer], [r.u1, r.v0, r.layer], [r.u1, r.v1, r.layer], [r.u0, r.v1, r.layer]];
    const P = [mode, lit, dof, 0];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(c[i], uv[i], tint, P, [0, 0]);
  }
  /** A flat-coloured quad with per-corner colours (the sky) or a blob (mode 4, local -1..1). */
  colorQuad(c, cols, mode, lit = 0) {
    const loc = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(c[i], [0, 0, 0], cols[i] ?? cols[0], [mode, lit, 0, 0], loc[i]);
  }
  /** A particle (particles.ts): a quad in the plane facing the camera's axis, `right` and `up` its half-extents in world metres. */
  sprite(at4, right, up, color, shape, additive, lit, slant = 0) {
    const c = (sx, sy) => [at4[0] + right[0] * sx + up[0] * sy + (sy > 0 ? slant / 2 : -slant / 2), at4[1] + right[1] * sx + up[1] * sy, at4[2] + right[2] * sx + up[2] * sy];
    const q = [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)], loc = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const P = [MODE.particle, lit, additive ? 1 : 0, shape];
    for (const i of [0, 1, 2, 0, 2, 3]) this.vert(q[i], [0, 0, 0], color, P, loc[i]);
  }
  draw(cam, light, lights, dim = 1) {
    const gl = this.gl, cv = this.canvas;
    gl.viewport(0, 0, cv.width, cv.height);
    if (this.alpha && this.transparent) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(light.skyBottom[0] * dim, light.skyBottom[1] * dim, light.skyBottom[2] * dim, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    const aspect = cv.width / Math.max(1, cv.height);
    const vp = mat4Mul(perspective(cam.fov, aspect, NEAR, FAR), lookAt(cam.eye, cam.target));
    gl.uniformMatrix4fv(this.u.uVP, false, vp);
    gl.uniform3fv(this.u.uCam, cam.eye);
    gl.uniform3fv(this.u.uAmb, light.amb);
    gl.uniform3fv(this.u.uKey, light.key);
    const lp = new Float32Array(16), lc = new Float32Array(16);
    lights.slice(0, 4).forEach((l, i) => {
      lp.set([...l.pos, l.radius], i * 4);
      lc.set([...l.color, l.intensity], i * 4);
    });
    gl.uniform4fv(this.u.uLightPos, lp);
    gl.uniform4fv(this.u.uLightCol, lc);
    gl.uniform4f(this.u.uHaze, light.haze[0], light.haze[1], light.haze[2], light.hazeDensity);
    const focus = Math.hypot(cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]);
    gl.uniform2f(this.u.uFocus, focus, 0.55);
    gl.uniform1f(this.u.uGrain, light.grain);
    gl.uniform1f(this.u.uGlow, light.glow);
    gl.uniform1f(this.u.uDim, dim);
    this.atlas.settle();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas.texture);
    gl.uniform1i(this.u.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.faces.texture);
    gl.uniform1i(this.u.uFaces, 1);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * FLOATS), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    gl.bindVertexArray(null);
    return { vertices: this.n, viewProj: vp };
  }
  /** Free every GPU resource and give the context back to the browser (a page keeps only a few). */
  dispose() {
    if (this.gone) return;
    this.gone = true;
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLoss);
    this.canvas.removeEventListener("webglcontextrestored", this.onBack);
    this.atlas.dispose();
    this.faces.dispose();
    gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
};

// ../sahne/src/render/paper/light.ts
var L = (s) => ({
  skyTop: hexToRgb(s.skyTop),
  skyBottom: hexToRgb(s.skyBottom),
  amb: hexToRgb(s.amb).map((v) => v * s.ambK),
  key: hexToRgb(s.key).map((v) => v * s.keyK),
  haze: hexToRgb(s.haze),
  hazeDensity: s.hazeDensity,
  glow: s.glow,
  practical: s.practical,
  shadow: s.shadow,
  grain: s.grain ?? 0.07
});
var TIMES = {
  // before sunrise: a cool sky warming at the horizon, a low key, the lamps and windows still lit
  dawn: L({ skyTop: "#6E76A8", skyBottom: "#F0B9B4", amb: "#9C9CC0", ambK: 0.6, key: "#FFC9B0", keyK: 0.25, haze: "#C8B4C4", hazeDensity: 0.028, glow: 0.55, practical: 0.8, shadow: 0.7 }),
  day: L({ skyTop: "#8CC8EE", skyBottom: "#E4F1F4", amb: "#D7DEE8", ambK: 0.6, key: "#FFF3DF", keyK: 0.46, haze: "#DCE8EE", hazeDensity: 0.012, glow: 0, practical: 0.12, shadow: 1, grain: 0.06 }),
  golden: L({ skyTop: "#E99B6A", skyBottom: "#FBD7A2", amb: "#B79FB4", ambK: 0.58, key: "#FFC889", keyK: 0.6, haze: "#F2C59B", hazeDensity: 0.02, glow: 0.25, practical: 0.45, shadow: 0.95 }),
  dusk: L({ skyTop: "#33406E", skyBottom: "#E2876C", amb: "#7177A6", ambK: 0.62, key: "#FF9C7C", keyK: 0.22, haze: "#8B7EA3", hazeDensity: 0.03, glow: 0.75, practical: 0.9, shadow: 0.75 }),
  night: L({ skyTop: "#0D1430", skyBottom: "#26325C", amb: "#4C5A8E", ambK: 0.62, key: "#7E92D0", keyK: 0.1, haze: "#1D2646", hazeDensity: 0.035, glow: 1, practical: 1.25, shadow: 0.6, grain: 0.08 }),
  overcast: L({ skyTop: "#AAB4BE", skyBottom: "#D9DEE2", amb: "#D3D8DE", ambK: 0.78, key: "#F2F2F0", keyK: 0.2, haze: "#C9D0D6", hazeDensity: 0.02, glow: 0.05, practical: 0.3, shadow: 0.55 })
};
var mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
var mixN = (a, b, t) => a + (b - a) * t;
function blendLight(a, b, t) {
  return {
    skyTop: mixRgb(a.skyTop, b.skyTop, t),
    skyBottom: mixRgb(a.skyBottom, b.skyBottom, t),
    amb: mixRgb(a.amb, b.amb, t),
    key: mixRgb(a.key, b.key, t),
    haze: mixRgb(a.haze, b.haze, t),
    hazeDensity: mixN(a.hazeDensity, b.hazeDensity, t),
    glow: mixN(a.glow, b.glow, t),
    practical: mixN(a.practical, b.practical, t),
    shadow: mixN(a.shadow, b.shadow, t),
    grain: mixN(a.grain, b.grain, t)
  };
}
var W = (s) => ({ ...s, sky: hexToRgb(s.sky), haze: hexToRgb(s.haze), glow: s.glow ?? 0, practical: s.practical ?? 0, cloud: s.cloud ?? 0 });
var WEATHER = {
  clear: W({ sky: "#FFFFFF", skyK: 0, key: 1, amb: 1, haze: "#FFFFFF", hazeAdd: 0, shadow: 1 }),
  grey: W({ sky: "#A9B2BC", skyK: 0.7, key: 0.45, amb: 1.05, haze: "#C6CDD3", hazeAdd: 0.012, shadow: 0.55, glow: 0.05, cloud: 0.9 }),
  rain: W({ sky: "#7F8A96", skyK: 0.85, key: 0.3, amb: 0.85, haze: "#8C97A3", hazeAdd: 0.03, shadow: 0.4, glow: 0.15, practical: 0.2, cloud: 1, bed: "rain" })
};
function cloudAt(w) {
  const c = (x) => (WEATHER[x] ?? WEATHER.clear).cloud;
  return c(w.from) + (c(w.to) - c(w.from)) * w.k;
}
function glowWeight(glowAt, glow) {
  if (glowAt === void 0) return 1;
  const u = Math.min(1, Math.max(0, (glow - glowAt) / 0.12));
  return u * u * (3 - 2 * u);
}
function withWeather(l, w) {
  const m = WEATHER[w ?? "clear"] ?? WEATHER.clear;
  return {
    ...l,
    skyTop: mixRgb(l.skyTop, m.sky, m.skyK),
    skyBottom: mixRgb(l.skyBottom, m.sky, m.skyK),
    key: l.key.map((v) => v * m.key),
    amb: l.amb.map((v) => v * m.amb),
    haze: mixRgb(l.haze, m.haze, m.skyK),
    hazeDensity: l.hazeDensity + m.hazeAdd,
    shadow: l.shadow * m.shadow,
    glow: Math.min(1, l.glow + m.glow),
    practical: l.practical + m.practical
  };
}
function withFlash(l, k) {
  if (k <= 0) return l;
  const up = (c, a) => c.map((v) => v + (1 - v) * a * k);
  return { ...l, skyTop: up(l.skyTop, 0.3), skyBottom: up(l.skyBottom, 0.3), amb: up(l.amb, 0.25) };
}

// ../sahne/src/anim/move.ts
function moveAt(m, t) {
  const ph = m.phase ?? 0, uAt = (tt, ms) => ((tt / ms + ph) % 1 + 1) % 1;
  if (m.blink && ((uAt(t, m.blink.ms) - (m.blink.at ?? 0)) % 1 + 1) % 1 >= m.blink.on) return null;
  const tm = m.stops ? stopsTime(m.stops, t) : t, u = (ms) => uAt(tm, ms);
  let at4 = [0, 0, 0], dx = 0, dy = 0, rot = 0;
  if (m.scroll) {
    const k = u(m.scroll.ms);
    dx = m.scroll.dx * k;
    dy = (m.scroll.dy ?? 0) * k;
  }
  if (m.sway) {
    const s = Math.sin(u(m.sway.ms) * 2 * Math.PI);
    rot = (m.sway.rot ?? 0) * s;
    dy += (m.sway.dy ?? 0) * Math.sin(u(m.sway.ms) * 4 * Math.PI);
  }
  if (m.path && m.path.pts.length) {
    const { pts, ms, wait = 0 } = m.path, k = u(ms + wait) * (ms + wait) / ms;
    if (k >= 1 && m.path.hide) return null;
    if (m.path.show && !m.path.show.some(([a2, b2]) => k >= a2 && k < b2)) return null;
    if (m.path.at) return { at: timedAt(pts, m.path.at, k), dx, dy, rot };
    const lens = pts.slice(1).map((p, i2) => Math.hypot(p[0] - pts[i2][0], p[1] - pts[i2][1], p[2] - pts[i2][2])), total = lens.reduce((a2, b2) => a2 + b2, 0);
    let d = Math.min(k, 1) * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const a = pts[i], b = pts[i + 1] ?? a, f = lens[i] ? d / lens[i] : 0;
    at4 = [(a[0] + (b[0] - a[0]) * f) / 100, (a[1] + (b[1] - a[1]) * f) / 100, (a[2] + (b[2] - a[2]) * f) / 100];
  }
  return { at: at4, dx, dy, rot };
}
function timedAt(pts, ts, k) {
  let i = 0;
  while (i < pts.length - 1 && k >= (ts[i + 1] ?? 1)) i++;
  const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], t0 = ts[i] ?? 0, t1 = ts[i + 1] ?? 1;
  const f = k <= t0 || t1 <= t0 ? 0 : Math.min(1, (k - t0) / (t1 - t0)), e = f * f * (3 - 2 * f);
  return [(a[0] + (b[0] - a[0]) * e) / 100, (a[1] + (b[1] - a[1]) * e) / 100, (a[2] + (b[2] - a[2]) * e) / 100];
}
function stopsTime(s, t) {
  const run2 = Math.min(s.run, s.ms), e = Math.min(s.ease ?? 2500, run2 / 2), v = run2 / (run2 - e), n = Math.floor(t / s.ms), x = Math.min(t - n * s.ms, run2);
  const d = x < e ? v * x * x / (2 * e) : x <= run2 - e ? v * (x - e / 2) : run2 - v * (run2 - x) ** 2 / (2 * e);
  return n * run2 + d;
}

// ../sahne/src/script/world.ts
var propKey = (p) => p.kit + "|" + (p.n ?? "") + "|" + JSON.stringify(Object.keys(p.params).sort().map((k) => [k, p.params[k]]));
var KEPT = ["n", "shown", "params"];
function markPos(place, mark) {
  const m = place.marks[mark];
  return m ? [m.x, m.y ?? 0, m.z] : null;
}
function placeProps(place) {
  const out = {};
  for (const [id, ref] of Object.entries(place.props ?? {})) {
    const { kit, at: at4, n, terms: _t, shown, keep, in: states, ...params } = ref;
    const p = typeof at4 === "string" ? markPos(place, at4) : [at4.x, at4.y, at4.z];
    out[id] = { id, of: id, kit, n: typeof n === "number" ? n : void 0, params, shown: shown !== false, ghost: false, at: p, ...keep ? { keep: true } : {}, ...states ? { in: states } : {} };
  }
  return out;
}
function enterPlace(w, place, on, site) {
  const next = placeProps(place), holds = {};
  const away = Object.fromEntries(Object.entries(w.away ?? {}).filter(([, p]) => !p.site || p.site === site));
  const old = Object.fromEntries(Object.entries(w.props).filter(([, p]) => p.keep || site).map(([k, p]) => [k, { ...p, params: { ...p.params } }]));
  for (const p of Object.values(old)) {
    if (p.holder && on.has(p.holder.actor)) {
      next[p.id] = p;
      (holds[p.holder.actor] ??= {})[p.holder.side] = p.id;
    } else if (p.id !== p.of) {
      const whole = away[p.of] ?? old[p.of];
      if (whole && typeof whole.n === "number") whole.n += p.n ?? 1;
    } else away[p.id] = { ...p, holder: void 0, ...p.keep ? {} : { site } };
  }
  for (const [id, p] of Object.entries(next)) {
    const was = away[id];
    if (!(p.keep || was?.site) || !was || p.holder) continue;
    next[id] = { ...p, n: was.n, shown: was.shown, params: was.params, ghost: false };
    delete away[id];
  }
  w.props = next;
  w.away = away;
  return holds;
}
var siteOf = (places, id) => id ? places[id]?.site ?? id : null;
function placeState(place, cur, ask) {
  const defs = place.states ?? {}, on = new Set(cur ?? Object.keys(defs).filter((k) => defs[k].default));
  for (const a of [ask ?? []].flat()) {
    const off = a.startsWith("-"), s = off ? a.slice(1) : a;
    if (!Object.hasOwn(defs, s)) {
      console.warn("sahne: no state", s, "in", place.id);
      continue;
    }
    if (off) {
      on.delete(s);
      continue;
    }
    const g = defs[s].group;
    if (g) {
      for (const k of [...on]) if (defs[k]?.group === g) on.delete(k);
    }
    on.add(s);
  }
  return [...on].sort();
}
var inState = (list, on) => !list || list.some((s) => !!on?.includes(s));
function whenWeight(when, f) {
  const blend = (a, b, k) => (a ? 1 : 0) + ((b ? 1 : 0) - (a ? 1 : 0)) * k;
  let w = 1;
  if (when.weather) w *= blend(when.weather.includes(f.weather.from || "clear"), when.weather.includes(f.weather.to || "clear"), f.weather.k);
  if (when.time) w *= blend(when.time.includes(f.time.from), when.time.includes(f.time.to), f.time.k);
  if (when.state) w *= blend(inState(when.state, f.state.from), inState(when.state, f.state.to), f.state.k);
  return w;
}
var emptyWorld = (cast) => ({
  i: -1,
  place: null,
  time: "day",
  props: {},
  shot: { kind: "wide", ids: [], objs: [] },
  actors: Object.fromEntries(cast.map((id) => [id, { id, on: false, pos: [0, 0, 0], yaw: 0, emo: "neutral", emoAt: -9, look: null, hold: {} }]))
});
function cloneWorld(w) {
  return {
    ...w,
    shot: { ...w.shot, ids: [...w.shot.ids], objs: [...w.shot.objs] },
    actors: Object.fromEntries(Object.entries(w.actors).map(([k, a]) => [k, { ...a, pos: [...a.pos], hold: { ...a.hold } }])),
    props: Object.fromEntries(Object.entries(w.props).map(([k, p]) => [k, { ...p, params: { ...p.params }, at: p.at ? [...p.at] : null, holder: p.holder ? { ...p.holder } : void 0 }])),
    last: w.last ? { ...w.last } : void 0,
    ...w.state ? { state: [...w.state] } : {},
    ...w.stops ? { stops: { ...w.stops } } : {},
    ...w.away ? { away: Object.fromEntries(Object.entries(w.away).map(([k, p]) => [k, { ...p, params: { ...p.params } }])) } : {}
  };
}

// ../sahne/src/director/direct.ts
var seatSideOf = (m) => m?.facing === "side_r" ? 1 : m?.facing === "side_l" ? -1 : void 0;
var TALK_YAW = 0.32;
var CAT_STRIDE = 0.28;
var WALK_YAW = 0.55;
var BACK_YAW = Math.PI - 0.5;
var TURN_MS = 420;
var WALK_SPEED = 1.15;
var RUN_SPEED = 2.4;
var HOP_SPEED = 0.85;
var FLY_SPEED = 2.6;
var FLAP_S = 0.92;
var sameShot = (a, b) => a.kind === b.kind && a.ids.join() === b.ids.join() && a.objs.join() === b.objs.join();
function travelYaw(d) {
  const dx = d[0], dz = d[2], s = dx >= 0 ? 1 : -1;
  if (dz < -Math.abs(dx) * 0.6) return s * BACK_YAW;
  if (Math.abs(dx) < 0.3 * Math.abs(dz)) return 0;
  return s * WALK_YAW;
}
function faceYaw(from, to) {
  const dx = to[0] - from[0];
  return Math.abs(dx) < 0.15 ? 0 : Math.sign(dx) * TALK_YAW;
}
function sideOf2(a, p) {
  if (!p) return "r";
  const px = (p[0] - a.pos[0]) * Math.cos(a.yaw) - (p[2] - a.pos[2]) * Math.sin(a.yaw);
  return px > 0.02 ? "l" : "r";
}
var Direction = class {
  w;
  perf;
  ctx;
  place;
  constructor(w0, i, ctx) {
    this.ctx = ctx;
    this.w = cloneWorld(w0);
    this.w.i = i;
    this.place = w0.place ? ctx.places[w0.place] ?? null : null;
    this.perf = { cue: i, dur: 0, before: w0, after: this.w, tracks: {}, props: [], cams: [], bubbles: [], doors: [], times: [], sounds: [], lines: [] };
  }
  track(id) {
    return this.perf.tracks[id] ??= emptyTrack();
  }
  end(t) {
    if (Number.isFinite(t)) this.perf.dur = Math.max(this.perf.dur, t);
  }
  /** A change of clothes at `t`: at once, in every motion setting. */
  dress(id, key, t) {
    const a = this.w.actors[id];
    if (!a || (a.costume ?? "") === key) return;
    this.track(id).costumes.push({ t, key });
    a.costume = key;
    this.end(t + 300);
  }
  actor(id) {
    return id ? this.w.actors[id] : void 0;
  }
  tempo(id, st) {
    return (st?.tempo ?? 1) * (id ? this.ctx.tempo?.[id] ?? 1 : 1);
  }
  height(id) {
    return this.ctx.heights?.[id] ?? 1.7;
  }
  /** An actor's gestures: a kit puppet has its own. */
  defs(id) {
    return id && this.ctx.puppets?.[id]?.gestures || this.ctx.gestures;
  }
  bird(id) {
    return !!id && this.ctx.puppets?.[id]?.kind === "bird";
  }
  cat(id) {
    return !!id && this.ctx.puppets?.[id]?.kind === "cat";
  }
  /** An animal drawn side-on (a bird, a cat): it turns by mirroring, never three-quarters, and takes no seat. */
  sideOn(id) {
    return this.bird(id) || this.cat(id);
  }
  /** Side-on: towards −x it mirrors (π), towards +x it is 0, and with no clear side it keeps its yaw. */
  side(id, dx, eps = 0.15) {
    return Math.abs(dx) < eps ? this.w.actors[id].yaw : dx < 0 ? Math.PI : 0;
  }
  /** The yaw to face `q` from `p`: a person three-quarters, an animal side-on. */
  faceTo(id, p, q) {
    return this.sideOn(id) ? this.side(id, q[0] - p[0]) : this.yawTo(id, p, q);
  }
  /** A person facing someone: a turn of TALK_YAW towards them; seated with the back to the camera (a car's front seats seen from the back seat), over the shoulder, still from behind. */
  yawTo(id, p, q) {
    const a = this.w.actors[id], f = faceYaw(p, q);
    return a && a.seat !== void 0 && Math.abs(a.yaw) > Math.PI / 2 ? Math.PI - f : f;
  }
  /** A rough world point for a target: enough to pick an arm and to frame a shot. */
  point(t) {
    if (!t) return null;
    const [kind, rest] = [t.slice(0, t.indexOf(":")), t.slice(t.indexOf(":") + 1)];
    if (t === "viewer") return null;
    if (kind === "obj") {
      const p = this.w.props[rest];
      if (!p) return null;
      if (p.holder) {
        const h2 = this.w.actors[p.holder.actor];
        return h2 ? [h2.pos[0], h2.pos[1] + this.height(h2.id) * 0.6, h2.pos[2]] : null;
      }
      return p.at;
    }
    if (kind === "ch") {
      const [id] = rest.split(".");
      const a = this.w.actors[id];
      return a ? [a.pos[0], a.pos[1] + this.height(id) * 0.7, a.pos[2]] : null;
    }
    if (kind === "mark") return this.place ? markPos(this.place, rest) : null;
    if (kind === "pass") {
      const [a, b] = rest.split(":").map((id) => this.w.actors[id]);
      return a && b ? [(a.pos[0] + b.pos[0]) / 2, 1 + (a.pos[1] + b.pos[1]) / 2, (a.pos[2] + b.pos[2]) / 2] : null;
    }
    return null;
  }
  setEmo(id, emo, t) {
    const a = this.w.actors[id];
    if (!a) return;
    this.track(id).emos.push({ t, emo });
    a.emo = emo;
    a.emoAt = this.w.i;
  }
  look(id, at4, t) {
    const a = this.w.actors[id];
    if (!a || a.look === at4 && !this.track(id).looks.length) return;
    this.track(id).looks.push({ t, at: at4 });
    a.look = at4;
  }
  turn(id, yaw, t, dur = TURN_MS) {
    const a = this.w.actors[id];
    if (!a || Math.abs(a.yaw - yaw) < 0.03) return;
    this.track(id).turns.push({ t, yaw, dur });
    a.yaw = yaw;
    this.end(t + dur);
  }
  /** Perform a gesture so that its stroke lands at `stroke` (ms); returns its start and end. */
  gesture(id, g, o) {
    const def = this.defs(id)[g], a = this.w.actors[id];
    if (!def || !a) {
      if (!def) console.warn("sahne: no gesture", g);
      return null;
    }
    const k = o.tempo;
    const t0 = Math.max(0, o.start ?? (o.stroke ?? 0) - def.stroke / k);
    const side = o.side ?? sideOf2(a, this.point(o.at) ?? this.point(a.look ?? void 0));
    const len = (def.dur + (this.ctx.puppets?.[id] && def.loop && o.n && !o.loop ? (o.n - 1) * (def.loop[1] - def.loop[0]) : 0)) / k;
    const tr = this.track(id);
    tr.gestures.push({ t0, id: g, side, at: o.at, n: o.n, loop: !!o.loop && !!def.loop, tempo: k, len });
    tr.gestures.sort((x, y) => x.t0 - y.t0);
    this.end(t0 + len);
    return { t0, stroke: t0 + def.stroke / k, t1: t0 + len };
  }
  /** When the word a gesture or a prop change belongs to is said (ms into the speech). */
  wordTime(sp, word, link, target, last = false) {
    if (!sp || !sp.words.length) return null;
    const match = this.ctx.lang.match ?? matchFallback;
    if (word) {
      const w = sp.words.find((x) => match(x.text, word) || x.text.toLowerCase() === word.toLowerCase());
      if (w) return w.t0;
    }
    if (target && link) {
      const tokens = Object.entries(link).filter(([, v]) => v === target).map(([k]) => k);
      const hits = sp.words.filter((x) => tokens.some((tok) => match(x.text, tok)));
      if (hits.length) return hits[hits.length - 1].t0;
    }
    return last ? sp.words[sp.words.length - 1].t0 : sp.words[0].t0;
  }
  // ---- Cues ------------------------------------------------------------------------------
  scene(s) {
    const place = this.ctx.places[s.place];
    if (!place) throw new Error(`sahne: no place ${s.place}`);
    const w = this.w, changed = w.place !== s.place, from = w.place;
    const site = changed && from ? siteOf(this.ctx.places, s.place) : null, sibling = !!site && site === siteOf(this.ctx.places, from);
    w.place = s.place;
    this.place = place;
    if (s.time) w.time = s.time;
    if (s.weather) w.weather = s.weather === "clear" ? void 0 : s.weather;
    if (changed && !sibling) w.lights = void 0;
    w.state = placeState(place, changed ? void 0 : w.state, s.state);
    const j = s.stop ? place.stops?.stations.indexOf(s.stop) ?? -1 : -1;
    if (s.stop && j < 1) console.warn("sahne: no station", s.stop);
    w.stops = j >= 1 ? { at: j } : changed ? void 0 : w.stops;
    const at4 = { ...s.at }, nar = this.ctx.narrator, perch = s.perch ?? place.perch;
    if (nar && w.actors[nar] && !at4[nar] && perch && inState(place.marks[perch]?.in, w.state) && this.bird(nar)) at4[nar] = perch;
    const holds = changed ? enterPlace(w, place, new Set(Object.keys(at4).filter((id) => place.marks[at4[id]])), sibling ? site : void 0) : {};
    for (const a of Object.values(w.actors)) {
      const mark = at4[a.id], m = mark ? place.marks[mark] : void 0;
      const hold = changed ? holds[a.id] ?? {} : a.hold;
      if (!m && !changed) {
        for (const id of Object.values(a.hold)) if (id && w.props[id]) w.props[id] = { ...w.props[id], shown: false };
      }
      if (!m) {
        a.on = false;
        a.hold = {};
        continue;
      }
      const yaw = this.sideOn(a.id) ? m.facing === "l" || !m.facing && m.x > (place.camera?.wide?.x ?? 0) ? Math.PI : 0 : m.facing === "l" ? -TALK_YAW : m.facing === "r" ? TALK_YAW : m.facing === "back" ? Math.PI : 0;
      const seat = m.seat !== void 0 && !this.sideOn(a.id) ? m.seat : void 0;
      Object.assign(a, { on: true, pos: [m.x, m.y ?? 0, m.z], yaw, emo: this.ctx.rest?.[a.id] ?? "neutral", emoAt: -9, look: null, hold, air: !!m.air, pace: !!m.air && !!m.pace, seat, seatSide: seat !== void 0 ? seatSideOf(m) : void 0 });
    }
    for (const [id, key] of Object.entries(s.costume ?? {})) if (w.actors[id]) w.actors[id].costume = key;
    w.shot = { kind: s.cam ?? "wide", ids: [], objs: [] };
    w.last = void 0;
    this.perf.before = cloneWorld(w);
    this.end(300);
    if (changed && from && !sibling && place.motif) this.perf.sounds.push({ t: 0, id: place.motif, music: true });
  }
  /** A change of the place's surroundings: `time:<t>[:<ms>]` (over `ms`, default 900: a slow nightfall is longer, up to a minute), `state:<s>` (`state:-<s>` off; `:fade` fades instead of cutting; `:roll` takes 1.4 s, for a roller shutter whose flats `reveal`), `weather:<w>`, `thunder`, `lights_on`/`lights_off` (at `at`, ms), `stop:<station>` and `depart` (a vehicle that stops comes in to the station and holds there, doors open, or goes on; neither waits for the train), and a bare `stop` (it slows to a halt where it is, a jam, until `depart`). */
  env(e, at4 = 0) {
    const w = this.w;
    if (e.startsWith("time:")) {
      const [time, ms] = e.slice(5).split(":"), d = ms ? Math.max(0, Math.min(6e4, Number(ms) || 900)) : void 0;
      this.perf.times.push({ t: 0, time, ...d !== void 0 ? { ms: d } : {} });
      w.time = time;
      this.end(d ?? 900);
    } else if (e.startsWith("state:") && this.place) {
      const [s, how] = e.slice(6).split(":"), on = placeState(this.place, w.state, s), roll = how === "roll", fade = how === "fade" || roll, ms = roll ? STATE_ROLL_MS : STATE_FADE_MS;
      const list = this.perf.states ??= [], last = list[list.length - 1];
      let len = fade ? ms : 0;
      if (last?.t === 0) {
        last.on = on;
        last.fade ||= fade;
        if (fade) last.ms = len = Math.max(last.ms ?? 0, ms);
        else len = last.fade ? last.ms ?? STATE_FADE_MS : 0;
      } else list.push({ t: 0, on, fade, ...roll ? { ms } : {} });
      w.state = on;
      this.end(len);
    } else if (e.startsWith("weather:")) {
      const weather = e.slice(8);
      (this.perf.weathers ??= []).push({ t: 0, weather });
      w.weather = weather === "clear" ? void 0 : weather;
      this.end(1500);
    } else if (e === "lights_on" || e === "lights_off") {
      const on = e === "lights_on";
      (this.perf.lights ??= []).push({ t: at4, on });
      w.lights = on ? void 0 : false;
      this.end(at4 + 600);
    } else if (e === "stop") {
      if (this.place?.stops) {
        (this.perf.stops ??= []).push({ t: at4, at: -1, arrive: true });
        w.stops = { at: -1 };
      }
      this.end(at4);
    } else if (e.startsWith("stop:")) {
      const j = this.place?.stops?.stations.indexOf(e.slice(5)) ?? -1;
      if (j < 1) console.warn("sahne: no station", e.slice(5));
      else {
        (this.perf.stops ??= []).push({ t: at4, at: j, arrive: true });
        w.stops = { at: j };
        this.end(at4);
      }
    } else if (e === "depart") {
      if (w.stops && !w.stops.go) {
        (this.perf.stops ??= []).push({ t: at4, at: w.stops.at, go: true });
        w.stops = { at: w.stops.at, go: true };
      }
      this.end(at4);
    } else if (e.startsWith("fireworks")) {
      const n = Math.max(1, Math.min(6, Number(e.split(":")[1]) || 3)), P = this.place, b = wideBox(P), R3 = rng(`${P?.id}|${w.i}|fireworks`);
      const list = this.perf.bursts ??= [];
      for (let k = 0; k < n; k++) {
        const t = at4 + k * 700, x = b.x0 + (b.x1 - b.x0) * (0.2 + 0.6 * R3()), y = b.y1 - 0.2 + R3() * 0.8;
        list.push({ t, at: [x * 1.4, y, b.z - 10], seed: `${P?.id}|${w.i}|${k}` });
        this.perf.sounds.push({ t, id: "fireworks" });
      }
      this.perf.sounds.sort((a, b2) => a.t - b2.t);
      this.end(at4 + (n - 1) * 700 + 1800);
    } else if (e === "thunder") {
      const fl = this.perf.flashes ??= [];
      if (!fl.length) fl.push({ t: 0 });
      this.perf.sounds.push({ t: 0, id: "thunder" });
      this.perf.sounds.sort((a, b) => a.t - b.t);
      this.end(1e3);
    } else console.warn("sahne: no env", e);
  }
  move(m, t0, tempo) {
    const a = this.w.actors[m.who], place = this.place;
    if (!a || !place) return { t1: t0, inside: t0 };
    const to = markPos(place, m.to), fly = m.how === "fly";
    if (!to) {
      console.warn("sahne: no mark", m.to);
      return { t1: t0, inside: t0 };
    }
    if (a.seat !== void 0 && a.on) {
      this.track(m.who).seats.push({ t: t0, h: null });
      a.seat = void 0;
      a.seatSide = void 0;
      t0 += SIT_MS;
    }
    const cx = place.camera?.wide?.x ?? 0, hw = (place.camera?.wide?.w ?? place.size.w * 0.86) / 2;
    const flyIn = fly && !a.on, enter = m.how === "enter" || flyIn;
    const doorName = m.from ?? Object.keys(place.marks).find((k) => place.marks[k].door && inState(place.marks[k].in, this.w.state));
    const door = doorName ? place.marks[doorName] : void 0;
    const via = (m.via ?? []).map((v) => markPos(place, v)).filter((p) => {
      if (!p) console.warn("sahne: no mark to pass", m.via);
      return !!p;
    });
    let pts, doorLeg = 0;
    const through = (m.how === "enter" || m.how === "exit") && door?.out;
    const dy = door?.y ?? 0;
    if (m.how === "enter" && door?.out) pts = [[door.out.x, dy, door.out.z], [door.x, dy, door.z], ...via, to];
    else if (m.how === "exit" && door?.out) {
      pts = [[...a.pos], ...via, [door.x, dy, door.z], [door.out.x, dy, door.out.z]];
      doorLeg = via.length;
    } else pts = [flyIn ? [cx + (to[0] < cx ? -1 : 1) * (hw + 0.8), Math.max(to[1], 1.6) + 0.6, to[2]] : [...a.pos], ...via, to];
    const solids = fly ? void 0 : this.ctx.solids?.[this.w.place ?? ""];
    if (solids?.length) {
      const doorPt = through ? m.how === "enter" ? 1 : pts.length - 2 : -1, way = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const leaf = through && (m.how === "enter" ? i === 1 : i === pts.length - 1) ? door?.door : void 0;
        way.push(...route(pts[i - 1], pts[i], solids, { state: this.w.state, door: leaf, size: place.size }) ?? [], pts[i]);
        if (i === doorPt) doorLeg = way.length - 2;
      }
      pts = way;
    }
    const tr = this.track(m.who);
    const yawOf = (d) => this.sideOn(m.who) ? this.side(m.who, d[0], 0.05) : travelYaw(d);
    if (enter) {
      tr.on.push({ t: t0, on: true });
      a.on = true;
      a.pos = [...pts[0]];
      tr.turns.push({ t: t0, yaw: yawOf([pts[1][0] - pts[0][0], 0, pts[1][2] - pts[0][2]]), dur: 1 });
      if (flyIn) a.yaw = tr.turns[tr.turns.length - 1].yaw;
    }
    const speed = (fly ? FLY_SPEED : m.how === "run" ? RUN_SPEED : m.how === "hop" ? HOP_SPEED : WALK_SPEED) * tempo;
    const steps = fly || m.how === "hop" ? [] : pts.slice(1).map((p, i) => stairSteps(p[1] - pts[i][1]));
    const stair = steps.some((n) => n > 0) ? steps : void 0;
    const lens = legLengths(pts, fly, stair);
    const total = lens.reduce((x, y) => x + y, 0);
    const dur = total / speed * 1e3 + 300, t1 = t0 + dur, air = fly && !!place.marks[m.to].air, pace = air && !!place.marks[m.to].pace;
    tr.walks.push({ t0, t1, pts, how: m.how ?? "walk", stride: fly ? FLY_SPEED * FLAP_S : this.cat(m.who) ? CAT_STRIDE : (m.how === "hop" && !this.bird(m.who) ? 0.42 : 0.62) * this.height(m.who) / 1.7, ...fly ? { lift: Math.min(0.8, 0.12 * total), air, ...pace ? { pace } : {} } : {}, ...stair ? { steps: stair } : {} });
    if (fly || a.air) {
      a.air = air;
      a.pace = pace;
    }
    let acc = 0, inside2 = t0;
    lens.forEach((l, i) => {
      const t = t0 + acc / total * (dur - 300) + (i ? 0 : -120);
      const d = [pts[i + 1][0] - pts[i][0], 0, pts[i + 1][2] - pts[i][2]];
      if (l > 0.05 && !(i === 0 && enter)) this.turn(m.who, yawOf(d), Math.max(t0, t), i ? 380 : 260);
      acc += l;
      if (i === doorLeg && door?.out && (m.how === "enter" || m.how === "exit")) inside2 = t0 + acc / total * (dur - 300);
    });
    if ((m.how === "enter" || m.how === "exit") && door?.door) {
      const tDoor = m.how === "enter" ? t0 : inside2;
      const pass = m.how === "enter" ? inside2 : t1;
      this.perf.doors.push({ piece: door.door, t0: Math.max(0, tDoor - 150), t1: pass - 250, mark: doorName });
      this.end(pass + DOOR_CLOSE_MS);
    }
    if (m.how === "exit") {
      tr.on.push({ t: t1, on: false });
      a.on = false;
    }
    a.pos = [...pts[pts.length - 1]];
    this.end(t1);
    const mk = place.marks[m.to];
    if (mk && m.how !== "exit" && !this.sideOn(m.who) && (mk.seat !== void 0 || mk.facing)) this.turn(m.who, mk.facing === "l" ? -TALK_YAW : mk.facing === "r" ? TALK_YAW : mk.facing === "back" ? Math.PI : 0, t1 - 200, 380);
    const seat = place.marks[m.to]?.seat;
    if (seat !== void 0 && m.how !== "exit" && !this.sideOn(m.who)) {
      const side = seatSideOf(place.marks[m.to]);
      tr.seats.push({ t: t1, h: seat, ...side ? { side } : {} });
      a.seat = seat;
      a.seatSide = side;
      this.end(t1 + SIT_MS);
    }
    return { t1, inside: inside2 };
  }
  /** A line (with speech) or a beat (without). */
  line(st) {
    const w = this.w, ctx = this.ctx, who = st.who, speaker = this.actor(who);
    const tempo = this.tempo(who, st);
    const voice = st.voice ?? "normal";
    for (const a of Object.values(w.actors)) {
      const rest = ctx.rest?.[a.id] ?? "neutral";
      if (a.emo !== rest && w.i - a.emoAt >= 2 && !(a.id === who && st.emo)) {
        this.track(a.id).emos.push({ t: 0, emo: rest });
        a.emo = rest;
      }
    }
    const narrator = !!who && who === ctx.narrator && !!st.text;
    if (narrator) {
      const sp2 = ctx.lang.speech(st.text, { rate: tempo });
      this.perf.bubbles.push({ t0: 150, t1: Infinity, id: `c${w.i}:${who}`, kind: "narrator", text: st.text, who, voice });
      const coo = ctx.narratorSound && w.narr !== w.i - 1 ? ctx.narratorSound : null;
      if (coo) this.perf.sounds.push({ t: 150, id: coo.id });
      const t0 = 150 + (coo ? coo.ms + 80 : 0);
      if (voice !== "silent" && voice !== "mouthing" && sp2.words.length) this.perf.lines.push({ t0, t1: t0 + sp2.dur, who, text: st.text, whisper: voice === "whisper", rate: tempo, words: sp2.words });
      if (speaker && voice !== "silent") this.track(who).speech.push({ t0, t1: t0 + sp2.dur, keys: sp2.keys, voice });
      this.end(t0 + sp2.dur + 300);
      w.narr = w.i;
    }
    const onStage = Object.values(w.actors).filter((a) => a.on);
    let to = st.to ?? (narrator && speaker ? "viewer" : void 0);
    const lead = narrator ? void 0 : speaker;
    if (!to && speaker) {
      if (w.last && w.last.who !== who && w.actors[w.last.who]?.on) to = w.last.who;
      else {
        const others = onStage.filter((a) => a.id !== who && a.id !== ctx.narrator);
        if (others.length) to = others.sort((x, y) => Math.abs(x.pos[0] - speaker.pos[0]) - Math.abs(y.pos[0] - speaker.pos[0]))[0].id;
      }
    }
    const addressee = to && to !== "all" && to !== "viewer" ? this.actor(to) : void 0;
    const moves = st.move ? Array.isArray(st.move) ? st.move : [st.move] : [];
    const arrive = {};
    let entered, entering = false;
    for (const m of moves) {
      const r = this.move(m, arrive[m.who] ?? 0, this.tempo(m.who));
      arrive[m.who] = r.t1;
      if (m.how === "enter") {
        entering = true;
        entered = Math.min(entered ?? Infinity, r.inside);
      }
      if (m.how === "exit") entering = true;
    }
    for (const [id, key] of Object.entries(st.costume ?? {})) this.dress(id, key, arrive[id] ?? 0);
    const isLine = st.text !== void 0 && !narrator, text = isLine ? st.text : "";
    const silent = isLine && (voice === "silent" || /^[\s.…]*$/.test(text));
    const sp = isLine && !silent ? ctx.lang.speech(text, { rate: tempo, voice: voice === "whisper" || voice === "mouthing" ? voice : void 0 }) : null;
    let tSpeak = who && arrive[who] !== void 0 ? arrive[who] + 120 : entered !== void 0 ? entered + 150 : 260;
    const ops = st.obj ?? [];
    const give = ops.find((o) => o.op === "give" && who);
    let giveAt;
    if (give && who) giveAt = this.planGive(who, give, tempo, sp, tSpeak, (v) => {
      tSpeak = v;
    }, Math.max(120, arrive[who] ?? 0, give.to ? arrive[give.to] ?? 0 : 0));
    const tEnd = sp ? tSpeak + sp.dur : silent && speaker ? tSpeak + 1100 : tSpeak;
    const tFace = who && arrive[who] !== void 0 ? arrive[who] - 150 : 0;
    if (speaker && addressee && !give) this.turn(speaker.id, this.faceTo(speaker.id, speaker.pos, addressee.pos), Math.max(0, tFace));
    if (speaker && to) this.look(speaker.id, to === "viewer" ? "viewer" : addressee ? "ch:" + addressee.id : null, Math.max(0, tFace));
    let k = 0;
    const heard = !!lead && (lead.on || arrive[lead.id] !== void 0);
    for (const a of onStage) {
      if (!lead || !heard || a.id === who || arrive[a.id] !== void 0) continue;
      const tl = 80 + 70 * k++;
      this.look(a.id, "ch:" + lead.id, tl);
      if (!give) this.turn(a.id, this.faceTo(a.id, a.pos, lead.pos), tl + 60);
    }
    for (const [id, t1] of Object.entries(arrive)) {
      const a = w.actors[id];
      const face = id === who ? addressee : lead ?? addressee;
      if (a?.on && face && face.id !== id) {
        this.turn(id, this.faceTo(id, a.pos, face.pos), t1 - 200);
        this.look(id, "ch:" + face.id, t1 - 200);
      }
    }
    if (st.emo && who) this.setEmo(who, st.emo, Math.max(0, tSpeak - 220));
    let stroke, strokeAt;
    if (st.do === "breath" && who) {
      const wt = this.wordTime(sp, st.on, st.link, void 0);
      (this.perf.puffs ??= []).push({ t: wt !== null ? tSpeak + wt : tSpeak, who });
      this.end(tSpeak + 1300);
    } else if (st.do && who && !(give && st.do === "give")) {
      const at4 = st.at ?? (this.defs(who)[st.do]?.needs?.includes("target") && to ? to === "viewer" ? "viewer" : "ch:" + to : void 0);
      const wt = this.wordTime(sp, st.on, st.link, at4);
      const r = this.gesture(who, st.do, { stroke: wt !== null ? tSpeak + wt : silent ? tSpeak + 300 : tSpeak, at: at4, n: st.n, loop: st.loop, tempo });
      if (r) {
        stroke = r.stroke;
        strokeAt = at4;
        if (st.do === "look" && at4) this.look(who, at4, r.t0 + 120);
        if (at4?.startsWith("obj:") && addressee && !st.react?.[addressee.id]) this.look(addressee.id, at4, r.stroke + 250);
      }
    }
    for (const op of ops) {
      if (op === give) continue;
      const tOp = this.opTime(op, sp, tSpeak, st, stroke);
      this.applyOp(who, op, tOp, tempo);
      if ((op.op === "hide" || op.op === "show") && addressee && !st.react?.[addressee.id]) this.look(addressee.id, "obj:" + op.id, tOp + 200);
    }
    if (who && speaker && isLine) {
      if (sp) {
        this.track(who).speech.push({ t0: tSpeak, t1: tSpeak + sp.dur, keys: sp.keys, voice });
        if (voice !== "mouthing" && sp.words.length) this.perf.lines.push({ t0: tSpeak, t1: tSpeak + sp.dur, who, text, whisper: voice === "whisper", rate: tempo, words: sp.words });
      }
      this.perf.bubbles.push({ t0: tSpeak, t1: Infinity, id: `c${w.i}:${who}`, kind: "speech", text: silent ? "\u2026" : text, who, voice, actor: who });
    }
    const tLine = Math.max(tEnd + 150, (giveAt ?? 0) + 300);
    for (const [id, r0] of Object.entries(st.react ?? {}).slice(0, 2)) {
      const r = typeof r0 === "string" ? this.defs(id)[r0] ? { do: r0 } : { emo: r0 } : r0;
      if (!w.actors[id]) continue;
      const tReact = r.at && r.at === strokeAt && stroke !== void 0 ? stroke + 250 : tLine;
      if (r.emo) this.setEmo(id, r.emo, tReact);
      if (r.at) this.look(id, r.at, tReact - 100);
      if (r.do) {
        const g = this.gesture(id, r.do, { start: tReact, at: r.at ?? (who ? "ch:" + who : void 0), tempo: this.tempo(id) });
        if (g && r.do === "look" && r.at) this.look(id, r.at, g.t0 + 120);
      }
      this.end(tReact + 600);
    }
    for (const s of st.sfx ? Array.isArray(st.sfx) ? st.sfx : [st.sfx] : []) this.sound(s, entering ? 0 : silent ? tSpeak + 350 : 0, moves);
    for (const e of [st.env ?? []].flat()) this.env(e, stroke ?? 0);
    this.camera(st, narrator && !["follow", "single", "close"].includes(st.cam ?? "") ? void 0 : who, addressee?.id, entering, silent, ops, isLine);
    this.end(tEnd + 250);
    if (st.wait) this.end(st.wait);
    if (who && speaker && isLine) w.last = { who, to };
  }
  /** Hand a prop over: pick it up first if it is lying somewhere, then pass it on the line's first word. */
  planGive(who, op, tempo, sp, tSpeak, setSpeak, start = 120) {
    const w = this.w, giver = w.actors[who], recv = op.to ? w.actors[op.to] : void 0;
    let src = Object.values(w.props).find((p) => (p.id === op.id || p.of === op.id) && p.holder?.actor === who) ?? w.props[op.id];
    if (!giver || !recv || !src || src.holder && src.holder.actor !== who) {
      console.warn("sahne: cannot give", op);
      return;
    }
    this.turn(who, this.yawTo(who, giver.pos, recv.pos), start - 120);
    this.turn(recv.id, this.yawTo(recv.id, recv.pos, giver.pos), start - 60);
    const side = src.holder ? src.holder.side : sideOf2(giver, recv.pos), rside = sideOf2(recv, giver.pos);
    this.look(recv.id, "ch:" + who, start - 60);
    let t = start;
    let inst = src.id;
    if (!src.holder) {
      const pick = this.gesture(who, "take", { start: t, at: "obj:" + src.id, tempo, side });
      const tPick = pick?.stroke ?? t;
      this.look(who, "obj:" + src.id, t);
      if (op.n && src.n && op.n < src.n) {
        let k = 1;
        while (w.props[`${src.id}#${k}`]) k++;
        inst = `${src.id}#${k}`;
        const rest = { ...src, n: src.n - op.n };
        w.props[src.id] = rest;
        this.perf.props.push({ t: tPick, id: src.id, state: rest });
        src = { ...src, id: inst, n: op.n };
      }
      const held = { ...src, id: inst, at: null, holder: { actor: who, side } };
      w.props[inst] = held;
      this.perf.props.push({ t: tPick, id: inst, state: { ...held } });
      this.track(who).holds.push({ t: tPick, side, prop: inst });
      t = pick ? pick.stroke + (pick.t1 - pick.stroke) * 0.3 : t;
    }
    const pass = `pass:${who}:${recv.id}`;
    const g = this.gesture(who, "give", { start: t, at: pass, tempo, side });
    const tGive = g?.stroke ?? t + 400;
    this.look(who, "ch:" + recv.id, t);
    const takeDef = this.defs(recv.id).take;
    if (takeDef) this.gesture(recv.id, "take", { start: Math.max(0, tGive - takeDef.stroke / this.tempo(recv.id)), at: pass, tempo: this.tempo(recv.id), side: rside });
    const now = { ...w.props[inst], at: null, holder: { actor: recv.id, side: rside } };
    w.props[inst] = now;
    this.perf.props.push({ t: tGive, id: inst, state: { ...now } });
    this.track(who).holds.push({ t: tGive, side, prop: null });
    this.track(recv.id).holds.push({ t: tGive, side: rside, prop: inst });
    delete giver.hold[side];
    recv.hold[rside] = inst;
    this.perf.props.sort((a, b) => a.t - b.t);
    if (sp) setSpeak(Math.max(tSpeak, tGive - 260));
    this.end(tGive + 800);
    return tGive;
  }
  /** *Yok*: the thing goes as the gesture lands (or on the last word); *var*: it appears as it is named. */
  opTime(op, sp, tSpeak, st, stroke) {
    if (!sp || !sp.words.length) return stroke ?? tSpeak;
    const linked = st.link && Object.values(st.link).includes("obj:" + op.id) ? this.wordTime(sp, void 0, st.link, "obj:" + op.id) : null;
    const last = tSpeak + sp.words[sp.words.length - 1].t0;
    if (op.op === "hide") return stroke ?? last;
    return linked !== null ? tSpeak + linked : stroke ?? last;
  }
  applyOp(who, op, t, tempo) {
    const w = this.w, p = w.props[op.id];
    if (!p) {
      console.warn("sahne: no prop", op.id);
      return;
    }
    let next = { ...p, params: { ...p.params } };
    if (op.op === "hide") next = { ...next, shown: false, ghost: true };
    else if (op.op === "show") next = { ...next, shown: true, ghost: false };
    else if (op.op === "add") next = { ...next, n: (p.n ?? 1) + (op.n ?? 1) };
    else if (op.op === "set") {
      const { n, ...rest } = op.set ?? {};
      const { still, ...params } = rest;
      next = { ...next, ...typeof n === "number" ? { n } : {}, ...typeof still === "boolean" ? { still } : {}, params: { ...next.params, ...params } };
    } else if (op.op === "go") {
      const P = this.place, marks = [...op.via ?? [], op.to ?? ""];
      const pts = P ? marks.map((m) => markPos(P, m.startsWith("mark:") ? m.slice(5) : m)) : [];
      if (p.holder || !p.at || !pts.length || pts.some((x) => !x)) {
        console.warn("sahne: prop cannot go", op.id, p.holder ? "(held)" : "", op.to);
        return;
      }
      const path = [p.at, ...pts], ms = op.ms ?? polyLength(path) / 0.9 * 1e3;
      (this.perf.paths ??= []).push({ id: op.id, t0: t, t1: t + ms, pts: path });
      next = { ...next, at: path[path.length - 1] };
      this.end(t + ms);
    } else if (op.op === "take" && who) {
      const a = w.actors[who];
      if (!a) return;
      const side = sideOf2(a, p.at ?? (p.holder ? w.actors[p.holder.actor]?.pos ?? null : null));
      const g = this.gesture(who, "take", { stroke: t, at: "obj:" + op.id, tempo, side });
      t = g?.stroke ?? t;
      if (op.n && p.n && op.n < p.n && !p.holder) {
        let k = 1;
        while (w.props[`${p.id}#${k}`]) k++;
        const inst = `${p.id}#${k}`, rest = { ...p, n: p.n - op.n }, held = { ...next, id: inst, n: op.n, at: null, holder: { actor: who, side } };
        w.props[p.id] = rest;
        w.props[inst] = held;
        a.hold[side] = inst;
        this.track(who).holds.push({ t, side, prop: inst });
        this.perf.props.push({ t, id: p.id, state: rest }, { t, id: inst, state: { ...held } });
        this.perf.props.sort((x, y) => x.t - y.t);
        this.end(t + 300);
        return;
      }
      if (p.holder && p.holder.actor !== who) {
        const from = w.actors[p.holder.actor];
        if (from) {
          delete from.hold[p.holder.side];
          this.track(from.id).holds.push({ t, side: p.holder.side, prop: null });
        }
      }
      next = { ...next, at: null, holder: { actor: who, side } };
      a.hold[side] = op.id;
      this.track(who).holds.push({ t, side, prop: op.id });
    } else if (op.op === "place") {
      const m = op.at ?? op.to, pos = m && this.place ? markPos(this.place, m.startsWith("mark:") ? m.slice(5) : m) : null;
      if (!pos) {
        console.warn("sahne: no mark to place on", op);
        return;
      }
      if (p.holder) {
        const from = w.actors[p.holder.actor];
        if (from) {
          delete from.hold[p.holder.side];
          this.track(from.id).holds.push({ t, side: p.holder.side, prop: null });
        }
      }
      next = { ...next, at: pos, holder: void 0 };
    } else {
      console.warn("sahne: obj op not built yet", op.op);
      return;
    }
    w.props[op.id] = next;
    this.perf.props.push({ t, id: op.id, state: next });
    this.perf.props.sort((a, b) => a.t - b.t);
    this.end(t + 300);
  }
  /** A sound and its written word, where it comes from: an entrance's sound comes from its door. */
  sound(s, t, moves) {
    let at4 = s.at;
    const door = moves.find((m) => m.how === "enter" || m.how === "exit");
    if (!at4 && door && this.place) {
      const mark = door.from ?? Object.keys(this.place.marks).find((k) => this.place.marks[k].door);
      if (mark) at4 = "mark:" + mark;
    }
    this.perf.sounds.push({ t, id: s.id, at: at4, params: s.params });
    const word = s.word ?? this.ctx.soundWord?.(s.id);
    if (word) this.perf.bubbles.push({ t0: t, t1: t + SOUND_MS, id: `c${this.w.i}:sfx:${s.id}:${t}`, kind: "sound", text: word, at: at4 });
    this.end(t + SOUND_MS);
  }
  /** The sounds the staging makes by itself: footsteps, a door opening and shutting, a paper flip. */
  autoSounds() {
    const p = this.perf, surface = this.place?.surface;
    for (const [id, tr] of Object.entries(p.tracks)) {
      for (const seg2 of tr.walks) {
        if (seg2.how === "fly" || this.cat(id)) continue;
        let last = Math.floor(walkAt(seg2, seg2.t0).phase);
        for (let t = seg2.t0 + 10; t <= seg2.t1; t += 10) {
          const ph = Math.floor(walkAt(seg2, t).phase);
          if (ph > last) p.sounds.push({ t, id: "step", at: "ch:" + id, params: surface ? { surface } : void 0, auto: true });
          last = ph;
        }
      }
      let yaw = p.before.actors[id]?.yaw ?? 0, on = p.before.actors[id]?.on ?? false;
      const ons = [...tr.on];
      for (const k of [...tr.turns].sort((a, b) => a.t - b.t)) {
        while (ons.length && ons[0].t <= k.t) on = ons.shift().on;
        if (on && k.dur > 1 && Math.sign(Math.cos(yaw) || 1) !== Math.sign(Math.cos(k.yaw) || 1)) p.sounds.push({ t: k.t + k.dur * 0.45, id: "paper_flip", at: "ch:" + id, auto: true });
        yaw = k.yaw;
      }
    }
    for (const d of p.doors) {
      const at4 = d.mark ? "mark:" + d.mark : void 0;
      p.sounds.push({ t: d.t0, id: "door_open", at: at4, auto: true }, { t: d.t1 + DOOR_CLOSE_MS * 0.8, id: "door_close", at: at4, auto: true });
    }
  }
  /**
   * An act (DESIGN.md §9): the camera frames what the learner acts on (wide unless `cam` says
   * otherwise); the answer (the learner's `result`, else `expect`) then changes the world. A tap or
   * a choice: the learner's actor looks and points at it, and whoever asked looks too. A drag: the
   * prop goes to the person (out of the hand that held it, or taken from where it lies) or onto the
   * mark. A go: the learner's actor walks to the mark and turns to whoever asked.
   */
  act(a) {
    const w = this.w, on = (id) => id && w.actors[id]?.on ? id : void 0;
    const who = on(a.who), by = on(a.by), kind = a.cam ?? "wide";
    const shot = kind === "wide" ? { kind, ids: [], objs: [] } : { kind, ids: [who, by].filter((x) => !!x), objs: a.targets.filter((t) => t.startsWith("obj:")).map((t) => t.slice(4)).filter((id) => w.props[id] && !w.props[id].holder) };
    if (!sameShot(shot, w.shot)) {
      this.perf.cams.push({ t: 0, shot });
      w.shot = shot;
    }
    this.end(CAM_MS);
    const res = a.result ?? a.expect;
    if (!res) return;
    const tempo = this.tempo(who);
    if (a.kind === "go") {
      if (!who || !res.startsWith("mark:")) return;
      const r = this.move({ who, to: res.slice(5), how: "walk" }, 0, tempo), me = w.actors[who];
      if (by) {
        this.turn(who, this.yawTo(who, me.pos, w.actors[by].pos), r.t1 - 200);
        this.look(who, "ch:" + by, r.t1 - 200);
      }
      return;
    }
    if (a.kind === "drag") {
      const id = a.obj ?? a.targets.find((t) => t.startsWith("obj:"))?.slice(4), p = id ? w.props[id] ?? Object.values(w.props).find((q) => q.of === id) : void 0;
      if (!p) {
        console.warn("sahne: nothing to drag", a);
        return;
      }
      if (res.startsWith("ch:")) {
        const to = on(res.slice(3).split(".")[0]);
        if (!to) return;
        if (p.holder && p.holder.actor !== to) this.planGive(p.holder.actor, { id: p.id, op: "give", to }, this.tempo(p.holder.actor), null, 0, () => {
        }, 120);
        else if (!p.holder) this.applyOp(to, { id: p.id, op: "take" }, 300, this.tempo(to));
        if (who && to !== who) this.look(who, "ch:" + to, 0);
      } else if (res.startsWith("mark:")) this.applyOp(who, { id: p.id, op: "place", at: res }, 200, tempo);
      return;
    }
    if (who && !res.startsWith("ch:" + who)) {
      this.look(who, res, 0);
      this.gesture(who, "point", { start: 80, at: res, tempo });
    }
    if (by && by !== who) this.look(by, res, 200);
  }
  camera(st, who, to, entering, silent, ops, isLine) {
    const w = this.w;
    let shot = null;
    const objs = ops.filter((o) => ["hide", "show", "give", "take"].includes(o.op)).map((o) => o.id).filter((id) => w.props[id] && !w.props[id].holder);
    if (st.cam === "wide" || !st.cam && entering) shot = { kind: "wide", ids: [], objs: [] };
    else if (st.cam) shot = { kind: st.cam, ids: [who, to].filter((x) => !!x && !!w.actors[x]?.on), objs: st.at?.startsWith("obj:") ? [st.at.slice(4)] : objs };
    else if (who && w.actors[who]?.on && (isLine || objs.length)) {
      if (silent) shot = { kind: "close", ids: [who], objs: [] };
      else {
        const ids = [who, to].filter((x) => !!x && !!w.actors[x]?.on);
        shot = { kind: ids.length > 1 ? "two" : "single", ids, objs };
      }
    }
    if (shot && !sameShot(shot, w.shot)) {
      this.perf.cams.push({ t: 0, shot });
      w.shot = shot;
      this.end(CAM_MS);
    }
  }
};
function direct(w0, cue, i, ctx) {
  const d = new Direction(w0, i, ctx);
  if ("scene" in cue) d.scene(cue.scene);
  else if ("line" in cue) d.line(cue.line);
  else if ("beat" in cue) d.line({ ...cue.beat, text: void 0 });
  else if ("act" in cue) d.act(cue.act);
  else d.end(0);
  return settle(d);
}
function glance(w0, i, ctx, ids, at4, point) {
  const d = new Direction(w0, i, ctx);
  ids.forEach((id, k) => {
    if (d.w.actors[id]?.on) d.look(id, at4, 60 * k);
  });
  if (point && d.w.actors[point]?.on) d.gesture(point, "point", { start: 100, at: at4, tempo: d.tempo(point) });
  d.end(600);
  return settle(d);
}
function settle(d) {
  d.autoSounds();
  const byT = (a, b) => a.t - b.t;
  for (const tr of Object.values(d.perf.tracks)) {
    tr.turns.sort(byT);
    tr.emos.sort(byT);
    tr.looks.sort(byT);
    tr.holds.sort(byT);
    tr.on.sort(byT);
    tr.costumes.sort(byT);
    tr.walks.sort((a, b) => a.t0 - b.t0);
    tr.gestures.sort((a, b) => a.t0 - b.t0);
    tr.speech.sort((a, b) => a.t0 - b.t0);
  }
  d.perf.props.sort(byT);
  d.perf.cams.sort(byT);
  d.perf.times.sort(byT);
  d.perf.sounds.sort(byT);
  d.perf.lines.sort((a, b) => a.t0 - b.t0);
  return d.perf;
}
function directAll(cues, cast, ctx) {
  const out = [];
  let w = emptyWorld(cast);
  cues.forEach((c, i) => {
    const p = direct(w, c, i, ctx);
    out.push(p);
    w = p.after;
  });
  return out;
}
function fold(cues, i, cast, ctx) {
  return i < 0 ? emptyWorld(cast) : directAll(cues.slice(0, i + 1), cast, ctx)[i].after;
}

// ../sahne/src/interact/hit.ts
var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function rayAt(cam, aspect, nx, ny) {
  const f = norm(sub2(cam.target, cam.eye)), r = norm(cross2(f, [0, 1, 0])), u = cross2(r, f), k = Math.tan(cam.fov / 2);
  return { o: [...cam.eye], d: norm([f[0] + (r[0] * nx * aspect + u[0] * ny) * k, f[1] + (r[1] * nx * aspect + u[1] * ny) * k, f[2] + (r[2] * nx * aspect + u[2] * ny) * k]) };
}
function rayQuad(ray, c) {
  const e1 = sub2(c[1], c[0]), e2 = sub2(c[3], c[0]), n = cross2(e1, e2), dn = dot(ray.d, n);
  if (Math.abs(dn) < 1e-12) return null;
  const t = dot(sub2(c[0], ray.o), n) / dn;
  if (t <= 0) return null;
  const q = sub2([ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t], c[0]);
  const a = dot(e1, e1), b = dot(e1, e2), d = dot(e2, e2), p1 = dot(q, e1), p2 = dot(q, e2), det = a * d - b * b;
  if (Math.abs(det) < 1e-18) return null;
  const s = (p1 * d - p2 * b) / det, v = (p2 * a - p1 * b) / det;
  return s >= 0 && s <= 1 && v >= 0 && v <= 1 ? { t, s, v } : null;
}
function rayFloor(ray, y = 0) {
  if (Math.abs(ray.d[1]) < 1e-12) return null;
  const t = (y - ray.o[1]) / ray.d[1];
  return t > 0 ? [ray.o[0] + ray.d[0] * t, y, ray.o[2] + ray.d[2] * t] : null;
}
function rayTri(ray, a, b, c) {
  const e1 = sub2(b, a), e2 = sub2(c, a), p = cross2(ray.d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = sub2(ray.o, a), u = dot(s, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross2(s, e1), v = dot(ray.d, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv;
  return t > 0 ? t : null;
}
var MASK_SCALE = 4;
var MASK_MIN = 140;
function poolAlpha(rgba2, w, h2, f, out, ow, ox = 0, oy = 0) {
  const pw = Math.ceil(w / f), ph = Math.ceil(h2 / f), W2 = ow ?? pw;
  const a = out ?? new Uint8Array(pw * ph);
  for (let y = 0; y < h2; y++) {
    const row = (oy + (y / f | 0)) * W2 + ox, src = y * w * 4 + 3;
    for (let x = 0; x < w; x++) {
      const v = rgba2[src + x * 4], k = row + (x / f | 0);
      if (v > a[k]) a[k] = v;
    }
  }
  return { w: pw, h: ph, a };
}
function maskHit(masks, size, r, s, v, min = MASK_MIN) {
  const m = masks[r.layer];
  if (!m || r.lazy) return true;
  const x = Math.min(size - 1, Math.max(0, Math.floor((r.u0 + (r.u1 - r.u0) * s) * size)));
  const y = Math.min(size - 1, Math.max(0, Math.floor((r.v0 + (r.v1 - r.v0) * v) * size)));
  return m[y * size + x] >= min;
}
var AlphaMasks = class {
  masks = [];
  /** The side of a layer's mask, in cells. */
  size = 0;
  reads = [];
  next = 0;
  later = [];
  t;
  layers(read, n, size) {
    clearTimeout(this.t);
    this.size = Math.ceil(size / MASK_SCALE);
    this.masks = new Array(n).fill(null);
    this.later = [];
    this.reads = [read];
    this.next = 0;
    const step = () => {
      if (this.step()) this.t = setTimeout(step, 0);
    };
    this.t = setTimeout(step, 0);
  }
  /** Make the next layer's mask; whether there are more. */
  step() {
    const read = this.reads[0], k = this.next;
    if (!read || k >= this.masks.length) return false;
    const img = read(k);
    this.masks[k] = poolAlpha(img.data, img.width, img.height, MASK_SCALE).a;
    for (const c of this.later) if (c.layer === k) this.stamp(c);
    this.later = this.later.filter((c) => c.layer !== k);
    this.next++;
    if (this.next >= this.masks.length) {
      this.reads = [];
      return false;
    }
    return true;
  }
  /** Make every mask still to come now. */
  flush() {
    clearTimeout(this.t);
    while (this.step()) ;
  }
  piece(layer, x, y, read) {
    const img = read(), m = poolAlpha(img.data, img.width, img.height, MASK_SCALE);
    const c = { layer, x: Math.floor(x / MASK_SCALE), y: Math.floor(y / MASK_SCALE), w: m.w, a: m.a };
    if (this.masks[layer]) this.stamp(c);
    else this.later.push(c);
  }
  /** Copy a piece's cells into its layer's mask, keeping the more opaque of the two. */
  stamp(c) {
    const m = this.masks[c.layer], M2 = this.size, h2 = c.a.length / c.w;
    if (!m) return;
    for (let j = 0; j < h2 && c.y + j < M2; j++) for (let i = 0; i < c.w && c.x + i < M2; i++) {
      const v = c.a[j * c.w + i], k = (c.y + j) * M2 + c.x + i;
      if (v > m[k]) m[k] = v;
    }
  }
  /** Whether a point of a rect is paper (`maskHit`). */
  paper(r, s, v) {
    return maskHit(this.masks, this.size, r, s, v);
  }
  dispose() {
    clearTimeout(this.t);
    this.masks = [];
    this.reads = [];
    this.later = [];
  }
};
function pickTop(picks, ray, paper = () => true, skip) {
  for (let i = picks.length - 1; i >= 0; i--) {
    const p = picks[i];
    if (skip?.(p)) continue;
    const target = p.bone ? p.target + "." + partOf2(p.bone) : p.target;
    if (p.tri) {
      const t = rayTri(ray, p.c[0], p.c[1], p.c[2]) ?? rayTri(ray, p.c[0], p.c[2], p.c[3]);
      if (t !== null) return { target, t, p: at2(ray, t), ...p.poke ? { poke: p.poke } : {} };
      continue;
    }
    const h2 = rayQuad(ray, p.c);
    if (h2 && (!p.rect || paper(p, h2.s, h2.v))) return { target, t: h2.t, p: at2(ray, h2.t), ...p.poke ? { poke: p.poke } : {} };
  }
  return null;
}
var at2 = (r, t) => [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t];
function rayZ(ray, z) {
  if (Math.abs(ray.d[2]) < 1e-9) return null;
  const t = (z - ray.o[2]) / ray.d[2];
  return t > 0 ? at2(ray, t) : null;
}
function partOf2(bone) {
  if (/^(head|neck|face|hair|ear|eye|brow|nose|mouth)/.test(bone)) return "head";
  if (/^hand_/.test(bone)) return "hand";
  if (/^(arm|forearm|shoulder)_/.test(bone)) return "arm";
  if (/^(thigh|shin|leg)_/.test(bone)) return "leg";
  if (/^foot_/.test(bone)) return "foot";
  return "body";
}
function isTarget(asked, hit) {
  if (asked === hit) return true;
  if (asked.startsWith("ch:") && !asked.includes(".")) return hit.startsWith(asked + ".");
  if (asked.startsWith("obj:")) return hit.startsWith(asked + "#");
  return false;
}
function parseTarget(t) {
  const i = t.indexOf(":"), kind = i < 0 ? t : t.slice(0, i), rest = i < 0 ? "" : t.slice(i + 1);
  if (kind === "ch") {
    const [id, part] = rest.split(".");
    return { kind, id, part };
  }
  return { kind, id: rest };
}

// ../sahne/src/ui/overlay-css.ts
var OVERLAY_CSS = `
.sahne-ov {
  --sahne-paper: #FFFCF5;
  --sahne-ink: #2B2420;
  --sahne-mute: #74675D;
  --sahne-edge: rgba(112, 90, 72, .62);
  --sahne-sound: #E0622C;
  --sahne-sky: radial-gradient(circle at 36% 30%, #EAF5F2 0%, #C5E2E1 52%, #A5CDCF 100%);
  position: absolute; inset: 0; overflow: hidden; contain: strict; pointer-events: none;
  color: var(--sahne-ink); color-scheme: light;
  font-size: var(--sahne-fs, 16px); line-height: 1.3; font-weight: 400; letter-spacing: 0;
  text-align: left; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent;
}
.sahne-ov > * { position: absolute; left: 0; top: 0; will-change: transform; }
.sahne-ov > div { pointer-events: auto; }
.sahne-ov > [hidden] { display: none; }
.sahne-ov > .sahne-wait, .sahne-ov > .sahne-off { visibility: hidden; }
.sahne-ov > .sahne-wait, .sahne-ov > .sahne-wait * { animation: none !important; }
.sahne-ov > .sahne-out { pointer-events: none; }
/* layers: the window, every tail, sound words, speech, the narrator */
.sahne-ov > .sahne-inset { z-index: 0; }
.sahne-ov > .sahne-tail { z-index: 1; }
.sahne-ov > .sahne-snd { z-index: 2; }
.sahne-ov > .sahne-b { z-index: 3; }
.sahne-ov > .sahne-b.sahne-narr { z-index: 4; }
.sahne-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* speech and narrator bubbles: a warm paper card, a soft shadow cast down-right (the light is
   upper left), no outline; the tail sits behind the card and points at the anchor */
.sahne-b-in {
  position: relative;
  filter: drop-shadow(.5px 1px 0 rgba(96, 66, 40, .10)) drop-shadow(1.5px 4px 6px rgba(72, 48, 26, .17));
  animation: sahne-pop 160ms cubic-bezier(.3, .9, .4, 1.25) backwards;
}
.sahne-b-body {
  position: relative; box-sizing: border-box; width: max-content; max-width: var(--sahne-maxw, 300px);
  padding: .42em .78em .48em; border-radius: 1.1em;
  background: linear-gradient(170deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 60%), var(--sahne-paper);
  box-shadow: inset 0 -1px 0 rgba(150, 112, 80, .08);
  text-align: center; text-wrap: balance; overflow-wrap: break-word; white-space: normal;
}
/* a speaker heard on a phone: the name, with a phone mark, above the line */
.sahne-b-who { display: block; font-size: .78em; font-weight: 600; opacity: .72; line-height: 1.2; margin-bottom: .1em; }
.sahne-b-who::before { content: "\\1F4DE\\FE0E\\00A0" / ""; }
.sahne-tail {
  width: var(--sahne-tailw, 20px); height: 20px; overflow: visible; pointer-events: none;
  transform-origin: 50% 0; transform: scale(0);
  filter: drop-shadow(0 1px 1.2px rgba(72, 48, 26, .16));
  animation: sahne-in 160ms ease-out backwards;
}
.sahne-tail .sahne-t-fill { fill: var(--sahne-paper); }
.sahne-tail .sahne-t-edge { fill: none; stroke: none; }

/* the narrator: a warmer cream, beside the round window */
.sahne-narr { --sahne-paper: #FFF4DA; }
.sahne-narr .sahne-b-body { max-width: var(--sahne-maxn, 260px); }

/* a line with no words: only "\u2026" */
.sahne-v-silent .sahne-b-body {
  padding: .02em .62em .3em; font-size: 1.25em; line-height: 1; letter-spacing: .1em;
  color: var(--sahne-mute); font-weight: 600;
}

/* whispered and mouthed lines: quieter, with a broken edge */
.sahne-v-whisper .sahne-b-body, .sahne-v-mouthing .sahne-b-body {
  font-size: .9em; color: var(--sahne-mute); border: 1.5px dashed var(--sahne-edge);
  background: var(--sahne-paper); box-shadow: none;
}
.sahne-v-mouthing .sahne-b-body { border-style: dotted; border-width: 2px; font-style: italic; }
.sahne-v-whisper > .sahne-b-in, .sahne-v-mouthing > .sahne-b-in { filter: drop-shadow(1px 2.5px 3px rgba(72, 48, 26, .10)); }
.sahne-v-whisper .sahne-t-edge, .sahne-v-mouthing .sahne-t-edge {
  stroke: var(--sahne-edge); stroke-width: 1.5px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke;
}
.sahne-v-mouthing .sahne-t-edge { stroke-width: 2px; stroke-dasharray: .1 4; stroke-linecap: round; }

/* sound words: bold rounded letters cut from warm paper, tilted, no box */
.sahne-snd-in {
  display: block; white-space: nowrap; padding: .1em .15em;
  font: 800 var(--sahne-snd-fs, 20px)/1 var(--sahne-sound-font, ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Varela Round", "Nunito", system-ui, sans-serif);
  letter-spacing: .02em; word-spacing: .14em; color: var(--sahne-sound);
  transform: rotate(var(--sahne-rot, -6deg));
  text-shadow:
    2px 0 0 var(--sahne-paper), -2px 0 0 var(--sahne-paper), 0 2px 0 var(--sahne-paper), 0 -2px 0 var(--sahne-paper),
    1.5px 1.5px 0 var(--sahne-paper), -1.5px 1.5px 0 var(--sahne-paper), 1.5px -1.5px 0 var(--sahne-paper), -1.5px -1.5px 0 var(--sahne-paper),
    2px 3.5px 3px rgba(72, 48, 26, .28);
  animation: sahne-stamp 200ms cubic-bezier(.3, 1.3, .5, 1) backwards;
}

/* the narrator's round window, cut in the paper: a paper rim, a shadow inside under its top edge */
.sahne-inset-in {
  position: relative; width: var(--sahne-inset, 80px); height: var(--sahne-inset, 80px);
  border-radius: 50%; overflow: hidden; background: var(--sahne-sky);
  box-shadow: 0 0 0 4px var(--sahne-paper), .5px 1.5px 0 4px rgba(96, 66, 40, .12), 1.5px 5px 9px 3px rgba(72, 48, 26, .2);
  animation: sahne-pop 200ms cubic-bezier(.3, .9, .4, 1.2) backwards;
}
.sahne-inset-in::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  box-shadow: inset 2px 3px 4px rgba(34, 52, 52, .32), inset 0 0 0 1px rgba(70, 50, 36, .14);
}
.sahne-inset-art { position: absolute; inset: 0; display: grid; }
.sahne-inset-art > * { width: 100%; height: 100%; }

.sahne-out > .sahne-b-in, .sahne-out > .sahne-inset-in { animation: sahne-out 120ms ease-in forwards; }
.sahne-out > .sahne-snd-in, .sahne-ov > .sahne-tail.sahne-out { animation: sahne-fade 120ms ease-in forwards; }

/* still: no movement, only fades */
.sahne-ov.sahne-still .sahne-b-in, .sahne-ov.sahne-still .sahne-snd-in, .sahne-ov.sahne-still .sahne-inset-in { animation-name: sahne-in; }
.sahne-ov.sahne-still .sahne-out > * { animation-name: sahne-fade; }
@media (prefers-reduced-motion: reduce) {
  .sahne-ov .sahne-b-in, .sahne-ov .sahne-snd-in, .sahne-ov .sahne-inset-in { animation-name: sahne-in; }
  .sahne-ov .sahne-out > * { animation-name: sahne-fade; }
}

@keyframes sahne-pop { from { opacity: 0; transform: scale(.55); } 70% { transform: scale(1.03); } }
@keyframes sahne-stamp { from { opacity: 0; transform: scale(1.5) rotate(calc(var(--sahne-rot, -6deg) * 2.5)); } }
@keyframes sahne-in { from { opacity: 0; } }
@keyframes sahne-out { to { opacity: 0; transform: scale(.9); } }
@keyframes sahne-fade { to { opacity: 0; } }
`;

// ../sahne/src/ui/gloss.ts
var WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
function glossInto(el, text, o, ctx) {
  el.replaceChildren();
  if (!o) {
    el.textContent = text;
    return 0;
  }
  const doc = el.ownerDocument;
  popup(doc);
  let at4 = 0, n = 0;
  for (const m of text.matchAll(WORD)) {
    const i = m.index ?? 0, word = m[0], g = o.lookup(word, ctx);
    if (!g) continue;
    if (i > at4) el.append(text.slice(at4, i));
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "sahne-gw" + (g.known ? " sahne-known" : "");
    b.textContent = word;
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      popup(doc).toggle(b, word, g, o, ctx.lang);
    });
    el.append(b);
    at4 = i + word.length;
    n++;
  }
  if (at4 < text.length) el.append(text.slice(at4));
  return n;
}
var CSS2 = `
.sahne-gw { display: inline; font: inherit; line-height: inherit; vertical-align: baseline; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer;
  text-decoration: underline dotted; text-decoration-thickness: 1.5px; text-underline-offset: .2em;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); border-radius: 3px; -webkit-tap-highlight-color: transparent; }
.sahne-gw.sahne-known { text-decoration-color: #2F8C88; }
.sahne-gw:hover, .sahne-gw.sahne-on { background: rgba(47, 140, 136, .14); }
.sahne-gw:focus-visible { outline: 2px solid #2F8C88; outline-offset: 1px; }
.sahne-gpop { position: fixed; z-index: 2147483000; box-sizing: border-box; max-width: min(280px, calc(100vw - 24px)); min-width: 140px;
  padding: 10px 12px 11px; border-radius: 12px; background: #FFFCF5; color: #2B2420; color-scheme: light;
  box-shadow: 0 1px 0 rgba(96, 66, 40, .1), 0 10px 28px -8px rgba(60, 40, 24, .38); font: 16px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  display: grid; gap: 3px; animation: sahne-gpop-in 140ms ease-out; }
.sahne-gpop:focus { outline: none; }
.sahne-gpop:focus-visible { outline: 2px solid #2F8C88; outline-offset: 2px; }
.sahne-gpop-h { display: flex; align-items: center; gap: 8px; }
.sahne-gpop-w { font-weight: 700; font-size: 18px; }
.sahne-gpop-head { color: #74675D; }
.sahne-gpop-say { margin-left: auto; font: inherit; border: 1px solid #DDD3C4; background: #fff; border-radius: 999px; padding: 1px 9px; cursor: pointer; color: inherit; }
.sahne-gpop-note { color: #74675D; font-size: 14px; }
.sahne-gpop [dir="rtl"] { font-size: 17px; }
@keyframes sahne-gpop-in { from { opacity: 0; transform: translateY(3px); } }
@media (prefers-reduced-motion: reduce) { .sahne-gpop { animation: none; } }
`;
var Popup = class {
  doc;
  el = null;
  anchor = null;
  onDown = (e) => {
    const t = e.target;
    if (!this.el?.contains(t) && !this.anchor?.contains(t)) this.close();
  };
  onKey = (e) => {
    if (!this.el) return;
    if (e.key === "Escape") {
      const a = this.anchor;
      this.close();
      a?.focus();
      return;
    }
    if (e.key === "Tab" && this.el.contains(e.target)) {
      const stops = [this.el, ...this.el.querySelectorAll("button")], i = stops.indexOf(e.target);
      if (e.shiftKey && i <= 0 || !e.shiftKey && i === stops.length - 1) {
        e.preventDefault();
        const a = this.anchor;
        this.close();
        a?.focus();
      }
    }
  };
  /** Focus going somewhere else than the popup and its word closes it. */
  onFocusOut = (e) => {
    const to = e.relatedTarget;
    if (to && !this.el?.contains(to) && !this.anchor?.contains(to)) this.close();
  };
  onMove = () => this.close();
  constructor(doc) {
    this.doc = doc;
    if (!doc.getElementById("sahne-gloss-css")) {
      const s = doc.createElement("style");
      s.id = "sahne-gloss-css";
      s.textContent = CSS2;
      doc.head.append(s);
    }
  }
  toggle(anchor, word, g, o, lang) {
    if (this.anchor === anchor) {
      this.close();
      return;
    }
    this.close();
    if (o.open) {
      o.open(word, g, anchor);
      return;
    }
    const d = this.doc, el = this.el = d.createElement("div");
    el.className = "sahne-gpop";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", word);
    el.tabIndex = -1;
    const h2 = d.createElement("div");
    h2.className = "sahne-gpop-h";
    const w = d.createElement("span");
    w.className = "sahne-gpop-w";
    w.lang = lang;
    w.textContent = word;
    h2.append(w);
    if (g.head && g.head.toLocaleLowerCase(lang) !== word.toLocaleLowerCase(lang)) {
      const hd = d.createElement("span");
      hd.className = "sahne-gpop-head";
      hd.lang = lang;
      hd.textContent = "\u2190 " + g.head;
      h2.append(hd);
    }
    if (o.speak) {
      const say = d.createElement("button");
      say.type = "button";
      say.className = "sahne-gpop-say";
      say.textContent = "\u{1F50A}";
      say.setAttribute("aria-label", "Say " + word);
      say.addEventListener("click", () => o.speak(word, lang));
      h2.append(say);
    }
    el.append(h2);
    for (const l of g.lines) {
      const p = d.createElement("div");
      p.textContent = l.text;
      if (l.lang) p.lang = l.lang;
      if (l.dir) p.dir = l.dir;
      el.append(p);
    }
    if (g.note) {
      const p = d.createElement("div");
      p.className = "sahne-gpop-note";
      p.textContent = g.note;
      el.append(p);
    }
    d.body.append(el);
    this.anchor = anchor;
    anchor.classList.add("sahne-on");
    anchor.setAttribute("aria-expanded", "true");
    this.place();
    el.focus({ preventScroll: true });
    el.addEventListener("focusout", this.onFocusOut);
    d.addEventListener("pointerdown", this.onDown, true);
    d.addEventListener("keydown", this.onKey);
    d.defaultView?.addEventListener("scroll", this.onMove, { passive: true, capture: true });
    d.defaultView?.addEventListener("resize", this.onMove);
  }
  /** Below the word if it fits, else above; always inside the window. */
  place() {
    const el = this.el, a = this.anchor, win = this.doc.defaultView;
    if (!el || !a || !win) return;
    if (!a.isConnected) {
      this.close();
      return;
    }
    const r = a.getBoundingClientRect(), W2 = win.innerWidth, H = win.innerHeight, w = el.offsetWidth, h2 = el.offsetHeight, m = 12;
    const x = Math.max(m, Math.min(W2 - w - m, r.left + r.width / 2 - w / 2));
    const y = r.bottom + 8 + h2 <= H - m ? r.bottom + 8 : Math.max(m, r.top - 8 - h2);
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
  }
  close() {
    const d = this.doc;
    d.removeEventListener("pointerdown", this.onDown, true);
    d.removeEventListener("keydown", this.onKey);
    d.defaultView?.removeEventListener("scroll", this.onMove, { capture: true });
    d.defaultView?.removeEventListener("resize", this.onMove);
    this.el?.removeEventListener("focusout", this.onFocusOut);
    this.el?.remove();
    this.el = null;
    if (this.anchor) {
      this.anchor.classList.remove("sahne-on");
      this.anchor.setAttribute("aria-expanded", "false");
    }
    this.anchor = null;
  }
  get open() {
    return !!this.el;
  }
};
var POPUPS = /* @__PURE__ */ new WeakMap();
function popup(doc = document) {
  let p = POPUPS.get(doc);
  if (!p) {
    p = new Popup(doc);
    POPUPS.set(doc, p);
  }
  return p;
}

// ../sahne/src/ui/place.ts
var clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function inside(r, room) {
  const { W: W2, H, m } = room;
  return { x: clamp2(r.x, m, Math.max(m, W2 - m - r.w)), y: clamp2(r.y, m, Math.max(m, H - m - r.h)), w: r.w, h: r.h };
}
function placements(a, w, h2, room, prefer) {
  const { W: W2, H, m, T } = room;
  if (!a) return [{ r: inside({ x: (W2 - w) / 2, y: m, w, h: h2 }, room), side: "free", gap: 0 }];
  const [ax, ay] = a, tmin = Math.max(6, T / 2);
  const space = { above: ay - h2 - m, below: H - m - h2 - ay, right: W2 - m - w - ax, left: ax - w - m };
  const at4 = (s, g) => s === "above" ? { x: ax - w / 2, y: ay - g - h2, w, h: h2 } : s === "below" ? { x: ax - w / 2, y: ay + g, w, h: h2 } : s === "right" ? { x: ax + g, y: ay - h2 * 0.6, w, h: h2 } : { x: ax - g - w, y: ay - h2 * 0.6, w, h: h2 };
  const sides = W2 - ax >= ax ? ["above", "right", "left", "below"] : ["above", "left", "right", "below"];
  if (prefer && prefer !== "free" && prefer !== "above" && space[prefer] >= tmin && space.above < tmin) sides.unshift(prefer);
  const out = [];
  for (const s of new Set(sides)) if (space[s] >= tmin) {
    const g = Math.min(T, space[s]);
    out.push({ r: inside(at4(s, g), room), side: s, gap: g });
  }
  return out.length ? out : [{ r: inside(at4("above", T), room), side: "above", gap: tmin }];
}
function crowding(bodies) {
  let sum = 0;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i].r, b = bodies[j].r;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 0 && oy > 0) sum += ox * oy;
  }
  return sum;
}
function keepSide(side, a, w, h2, gap) {
  if (!a) return void 0;
  const I = Infinity;
  switch (side) {
    case "above":
      return { x0: -I, x1: I, y0: -I, y1: a[1] - gap - h2 };
    case "below":
      return { x0: -I, x1: I, y0: a[1] + gap, y1: I };
    case "left":
      return { x0: -I, x1: a[0] - gap - w, y0: -I, y1: I };
    case "right":
      return { x0: a[0] + gap, x1: I, y0: -I, y1: I };
    default:
      return void 0;
  }
}
function separate(bodies, room, gap = 6, rounds = 6) {
  const size = (ax) => ax === "x" ? "w" : "h";
  const over = (a, b, ax) => Math.min(a[ax] + a[size(ax)], b[ax] + b[size(ax)]) - Math.max(a[ax], b[ax]) + gap;
  const move = (B, ax, d) => {
    if (!B.mob || !d) return 0;
    const r = B.r, l = B.lim, v = r[ax] + d;
    const lo = l ? ax === "x" ? l.x0 : l.y0 : -Infinity, hi = l ? ax === "x" ? l.x1 : l.y1 : Infinity;
    const lim = hi < lo ? lo : clamp2(v, lo, hi);
    B.r = inside({ ...r, [ax]: lim }, room);
    return B.r[ax] - r[ax];
  };
  const push = (A, B, ax) => {
    const d = over(A.r, B.r, ax), k = A.mob + B.mob;
    const s = Math.sign(A.r[ax] + A.r[size(ax)] / 2 - (B.r[ax] + B.r[size(ax)] / 2)) || -1;
    const ma = Math.abs(move(A, ax, s * d * A.mob / k));
    const mb = Math.abs(move(B, ax, -s * (d - ma)));
    if (d - ma - mb > 0.5) move(A, ax, s * (d - ma - mb));
  };
  for (let k = 0; k < rounds; k++) {
    let moved = false;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const A = bodies[i], B = bodies[j];
      if (!A.mob && !B.mob) continue;
      const ox = over(A.r, B.r, "x"), oy = over(A.r, B.r, "y");
      if (ox <= 0 || oy <= 0) continue;
      const first = ox < oy ? "x" : "y", other2 = first === "x" ? "y" : "x";
      push(A, B, first);
      if (over(A.r, B.r, first) > 1 && over(A.r, B.r, other2) > 0) push(A, B, other2);
      moved = true;
    }
    if (!moved) break;
  }
}
function tailAim(r, mouth, head, o) {
  const t = tailTo(r, mouth, o);
  if (!t) return null;
  const dx = mouth[0] - t.x, dy = mouth[1] - t.y, L2 = Math.hypot(dx, dy) || 1;
  const px = (t.x - head.c[0]) / head.rx, py = (t.y - head.c[1]) / head.ry, vx = dx / L2 / head.rx, vy = dy / L2 / head.ry;
  const A = vx * vx + vy * vy, B = 2 * (px * vx + py * vy), C = px * px + py * py - 1, D = B * B - 4 * A * C;
  let s = L2;
  if (C > 0 && D >= 0) {
    const s0 = (-B - Math.sqrt(D)) / (2 * A);
    if (s0 > 0) s = Math.min(L2, s0);
  }
  return { x: t.x, y: t.y, angle: Math.atan2(dy, dx) - Math.PI / 2, len: clamp2(s - o.gap, o.inset + o.min, o.inset + o.max) };
}
function tailTo(r, a, o) {
  const [ax, ay] = a;
  const dx = ax < r.x ? r.x - ax : ax > r.x + r.w ? ax - (r.x + r.w) : 0;
  const dy = ay < r.y ? r.y - ay : ay > r.y + r.h ? ay - (r.y + r.h) : 0;
  if (!dx && !dy) return null;
  const rad = Math.min(o.radius, r.w / 2, r.h / 2);
  let x, y;
  if (dy >= dx) {
    const lo = r.x + rad + o.base / 2, hi = r.x + r.w - rad - o.base / 2;
    x = lo <= hi ? clamp2(ax, lo, hi) : r.x + r.w / 2;
    y = ay > r.y + r.h ? r.y + r.h - o.inset : r.y + o.inset;
  } else {
    const lo = r.y + rad + o.base / 2, hi = r.y + r.h - rad - o.base / 2;
    y = lo <= hi ? clamp2(ay, lo, hi) : r.y + r.h / 2;
    x = ax > r.x + r.w ? r.x + r.w - o.inset : r.x + o.inset;
  }
  const vx = ax - x, vy = ay - y;
  const len = clamp2(Math.hypot(vx, vy), o.inset + o.min, o.inset + o.max);
  return { x, y, angle: Math.atan2(vy, vx) - Math.PI / 2, len };
}

// ../sahne/src/ui/overlay.ts
var STYLE_ID = "sahne-overlay-css";
var SVG = "http://www.w3.org/2000/svg";
var M = 8;
var RIM2 = 4;
var OUT = 120;
var TAIL_FILL = "M0 0C4 5.5 7.6 12.6 10 20 12.4 12.6 16 5.5 20 0Z";
var TAIL_EDGE = "M0 0C4 5.5 7.6 12.6 10 20 12.4 12.6 16 5.5 20 0";
var VOICES = ["normal", "whisper", "silent", "mouthing"];
var FLAGS = ["sahne-wait", "sahne-out", "sahne-off"];
var clamp3 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function tilt(id) {
  let h2 = 2166136261;
  for (let i = 0; i < id.length; i++) h2 = Math.imul(h2 ^ id.charCodeAt(i), 16777619);
  const u = (h2 >>> 0) / 4294967296;
  return (u < 0.5 ? -1 : 1) * (4 + u * 2 % 1 * 6);
}
var Overlay = class {
  el;
  o;
  /** Tap-to-translate on the lines' words, when on. */
  gloss = null;
  /** The position of the bubble an open gloss belongs to, when it was last placed. */
  popAt = "";
  doc;
  items = /* @__PURE__ */ new Map();
  byEl = /* @__PURE__ */ new Map();
  ro;
  W = 0;
  H = 0;
  /** Text size, tail length and the window's diameter for the current host size. */
  fs = 16;
  T = 14;
  D = 80;
  // the narrator's window
  win = null;
  art = null;
  insetO = null;
  winShown = false;
  winPlaced = false;
  winTf = "";
  winTimer;
  talking = null;
  constructor(host, o) {
    this.o = o;
    this.doc = host.ownerDocument;
    if (!this.doc.getElementById(STYLE_ID)) {
      const s = this.doc.createElement("style");
      s.id = STYLE_ID;
      s.textContent = OVERLAY_CSS;
      this.doc.head.append(s);
    }
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    this.el = this.doc.createElement("div");
    this.el.className = "sahne-ov" + (o.still ? " sahne-still" : "");
    host.append(this.el);
    this.ro = new ResizeObserver((es) => this.observed(es));
    this.ro.observe(this.el);
    this.resize(this.el.clientWidth, this.el.clientHeight);
    this.doc.fonts?.addEventListener("loadingdone", this.refit);
  }
  /** Show exactly these bubbles (add, update, remove the rest), positioned for the current camera. */
  set(bubbles) {
    const seen = /* @__PURE__ */ new Set(), dirty = [];
    for (const b of bubbles) {
      seen.add(b.id);
      let it = this.items.get(b.id);
      if (it && it.b.kind !== b.kind) {
        this.drop(it);
        it = void 0;
      }
      if (!it) {
        it = this.make(b);
        dirty.push(it);
        continue;
      }
      if (it.leaving) this.revive(it);
      if (this.update(it, b)) dirty.push(it);
    }
    for (const it of [...this.items.values()]) if (!seen.has(it.b.id) && !it.leaving) this.leave(it);
    if (dirty.length) this.fit(dirty);
    this.syncNarrator();
    this.layout();
  }
  /** Re-position after the camera moved. */
  layout() {
    const { W: W2, H } = this;
    if (!W2 || !H || !this.items.size && !this.winShown) return;
    const room = { W: W2, H, m: M, T: this.T };
    const dpr = window.devicePixelRatio || 1, snap = (v) => Math.round(v * dpr) / dpr;
    const D = this.D, left = (this.insetO?.side ?? "left") === "left";
    const wx = left ? M + RIM2 : W2 - M - RIM2 - D, wy = H - M - RIM2 - D;
    const centre = [wx + D / 2, wy + D / 2];
    let bodies = [];
    const alts = [];
    const gapOf = (p) => Math.min(p.gap, Math.max(8, this.T * 0.6));
    if (this.win && this.winShown) {
      const tf = `translate3d(${snap(wx)}px,${snap(wy)}px,0)`;
      if (tf !== this.winTf) {
        this.win.style.transform = tf;
        this.winTf = tf;
      }
      if (!this.winPlaced) {
        this.winPlaced = true;
        this.win.classList.remove("sahne-wait");
      }
      bodies.push({ r: { x: wx - RIM2, y: wy - RIM2, w: D + 2 * RIM2, h: D + 2 * RIM2 }, mob: 0 });
    }
    for (const it of this.items.values()) {
      if (it.leaving || !it.w) continue;
      const b = it.b, { w, h: h2 } = it;
      if (b.kind === "narrator") {
        const gap = RIM2 + this.T + 2;
        const x = left ? wx + D + gap : wx - gap - w;
        bodies.push({ r: inside({ x, y: centre[1] - D * 0.12 - h2 / 2, w, h: h2 }, room), mob: 0, it, a: centre });
        continue;
      }
      const a = b.anchor ? this.o.project(b.anchor) : null;
      if (b.kind === "sound") {
        this.hide(it, !a);
        if (a) bodies.push({ r: inside({ x: a[0] - w * 0.3, y: a[1] - h2 - 2, w, h: h2 }, room), mob: 4, it });
        continue;
      }
      const ps = placements(a, w, h2, room, it.side), p = ps[0];
      it.side = p.side;
      if (ps.length > 1) alts.push({ i: bodies.length, ps, a, it });
      bodies.push({ r: p.r, mob: 1, it, a, lim: keepSide(p.side, a, w, h2, gapOf(p)) });
    }
    separate(bodies, room);
    let crowd = alts.length ? crowding(bodies) : 0;
    for (const alt of alts) {
      const { w, h: h2 } = alt.it;
      if (crowd < w * h2 * 0.05) continue;
      let best = null, bestC = crowd * 0.5, side = alt.it.side;
      for (const p of alt.ps.slice(1)) {
        const trial = bodies.map((B) => ({ ...B }));
        trial[alt.i] = { ...trial[alt.i], r: p.r, lim: keepSide(p.side, alt.a, w, h2, gapOf(p)) };
        separate(trial, room);
        const c = crowding(trial);
        if (c < bestC && crowd - c > w * h2 * 0.1) {
          best = trial;
          bestC = c;
          side = p.side;
        }
      }
      if (best) {
        bodies = best;
        crowd = bestC;
        alt.it.side = side;
      }
    }
    for (const B of bodies) if (B.it) this.put(B.it, B.r, B.a ?? null, snap, centre);
    const pop = popup(this.doc);
    if (pop.anchor && !pop.anchor.isConnected) pop.close();
    else if (pop.anchor && this.el.contains(pop.anchor)) {
      const moved = [...this.items.values()].find((it) => it.root.contains(pop.anchor))?.tf ?? "";
      if (moved !== this.popAt) {
        this.popAt = moved;
        pop.place();
      }
    }
  }
  /** The narrator's round window in a corner, with an element the app draws (Kerim). null hides it. */
  inset(o) {
    const prev = this.insetO;
    this.insetO = o;
    if (this.talking !== null && prev?.onTalk !== o?.onTalk) {
      prev?.onTalk?.(false, "");
      o?.onTalk?.(true, this.talking);
    }
    if (o) {
      const win = this.window();
      if (this.art.firstChild !== o.el || this.art.childNodes.length !== 1) this.art.replaceChildren(o.el);
      win.dataset.side = o.side ?? "left";
      win.dataset.who = o.who;
    } else if (this.talking !== null) this.art?.replaceChildren();
    this.syncWindow();
    this.layout();
  }
  /** Reduced motion on or off (the `still` option, changed later). */
  setStill(still) {
    this.el.classList.toggle("sahne-still", still);
  }
  /** Words with a gloss get a dotted underline and open a translation on one tap; null turns it off. */
  setGloss(o) {
    if (o === this.gloss) return;
    this.gloss = o;
    const pop = popup(this.doc);
    if (pop.anchor && this.el.contains(pop.anchor)) pop.close();
    const live = [...this.items.values()].filter((it) => !it.leaving);
    for (const it of live) this.fillText(it);
    if (live.length) {
      this.fit(live);
      this.layout();
    }
  }
  /** The bubble's words, plain or glossable. */
  fillText(it) {
    const b = it.b, silent = b.kind !== "sound" && b.voice === "silent", pop = popup(this.doc);
    if (pop.anchor && it.text.contains(pop.anchor)) pop.close();
    glossInto(it.text, silent ? "\u2026" : b.text, silent ? null : this.gloss, { text: b.text, who: b.who, lang: b.lang ?? this.o.lang ?? "tr" });
  }
  destroy() {
    const pop = popup(this.doc);
    if (pop.anchor && this.el.contains(pop.anchor)) pop.close();
    this.ro.disconnect();
    this.doc.fonts?.removeEventListener("loadingdone", this.refit);
    for (const it of this.items.values()) clearTimeout(it.timer);
    clearTimeout(this.winTimer);
    this.items.clear();
    this.byEl.clear();
    this.el.remove();
  }
  // ---- Bubbles ------------------------------------------------------------------
  make(b) {
    const d = this.doc, root = d.createElement("div");
    let inner, body = null, text, sr = null, tail = null;
    if (b.kind === "sound") {
      inner = text = d.createElement("span");
      inner.className = "sahne-snd-in";
      inner.style.setProperty("--sahne-rot", tilt(b.id).toFixed(1) + "deg");
    } else {
      inner = d.createElement("div");
      inner.className = "sahne-b-in";
      body = d.createElement("div");
      body.className = "sahne-b-body";
      sr = d.createElement("span");
      sr.className = "sahne-sr";
      text = d.createElement("span");
      text.dir = "auto";
      body.append(sr, text);
      inner.append(body);
      tail = d.createElementNS(SVG, "svg");
      tail.setAttribute("viewBox", "0 0 20 20");
      tail.setAttribute("preserveAspectRatio", "none");
      tail.setAttribute("aria-hidden", "true");
      for (const [cls, dd] of [["sahne-t-fill", TAIL_FILL], ["sahne-t-edge", TAIL_EDGE]]) {
        const p = d.createElementNS(SVG, "path");
        p.setAttribute("class", cls);
        p.setAttribute("d", dd);
        tail.append(p);
      }
    }
    root.append(inner);
    root.setAttribute("role", "note");
    const it = {
      b,
      root,
      inner,
      body,
      text,
      sr,
      tail,
      w: 0,
      h: 0,
      fitted: false,
      placed: false,
      off: false,
      side: "above",
      leaving: false,
      timer: void 0,
      tf: "",
      ttf: ""
    };
    this.paint(it, null);
    if (tail) this.el.append(tail);
    this.el.append(root);
    this.items.set(b.id, it);
    const measured = body ?? inner;
    this.byEl.set(measured, it);
    this.ro.observe(measured);
    return it;
  }
  /** Write what changed between two versions of a bubble; true when its size may have changed. */
  update(it, b) {
    const old = it.b;
    it.b = b;
    if (old.text === b.text && old.voice === b.voice && old.lang === b.lang && old.name === b.name && old.who === b.who && !old.remote === !b.remote) return false;
    return this.paint(it, old);
  }
  paint(it, old) {
    const b = it.b, voice = VOICES.includes(b.voice ?? "normal") ? b.voice ?? "normal" : "normal";
    let resized = false;
    if (!old || (old.voice ?? "normal") !== voice) {
      const kind = b.kind === "sound" ? "sahne-snd" : b.kind === "narrator" ? "sahne-narr" : "sahne-speech";
      const v = b.kind === "sound" ? "" : "sahne-v-" + voice;
      const keep = (e) => old ? FLAGS.filter((f) => e.classList.contains(f)) : ["sahne-wait"];
      it.root.className = [b.kind === "sound" ? "" : "sahne-b", kind, v, ...keep(it.root)].filter(Boolean).join(" ");
      if (it.tail) it.tail.setAttribute("class", ["sahne-tail", kind, v, ...keep(it.tail)].join(" "));
      resized = true;
    }
    const shown = b.kind !== "sound" && voice === "silent" ? "\u2026" : b.text;
    if (it.text.textContent !== shown || old?.lang !== b.lang) {
      this.fillText(it);
      resized = true;
    }
    const lang = b.lang ?? this.o.lang ?? "tr", dir = b.lang ? "" : this.o.dir ?? "";
    if (it.text.lang !== lang) it.text.lang = lang;
    if (it.text.dir !== dir) it.text.dir = dir;
    if (b.kind === "sound") it.root.setAttribute("aria-label", (this.o.soundLabel ?? ((t) => "sound: " + t))(b.text));
    if (it.sr) {
      const remote = !!b.remote && !!b.name, name = b.name ? b.name + (remote ? "" : ": ") : "";
      const cls = remote ? "sahne-b-who" : "sahne-sr";
      if (it.sr.className !== cls) {
        it.sr.className = cls;
        resized = true;
      }
      if (it.sr.textContent !== name) {
        it.sr.textContent = name;
        resized = true;
      }
    }
    it.root.dataset.id = b.id;
    if (b.who) it.root.dataset.who = b.who;
    else delete it.root.dataset.who;
    if (resized) it.fitted = false;
    return resized;
  }
  /** Add or remove a state class on a bubble and its tail. */
  flag(it, f, on) {
    it.root.classList.toggle(f, on);
    it.tail?.classList.toggle(f, on);
  }
  leave(it) {
    const pop = popup(this.doc);
    if (pop.anchor && it.root.contains(pop.anchor)) pop.close();
    if (!it.placed) {
      this.drop(it);
      return;
    }
    it.leaving = true;
    this.flag(it, "sahne-out", true);
    it.timer = setTimeout(() => this.drop(it), OUT + 40);
  }
  revive(it) {
    clearTimeout(it.timer);
    it.leaving = false;
    this.flag(it, "sahne-out", false);
  }
  drop(it) {
    clearTimeout(it.timer);
    const measured = it.body ?? it.inner;
    this.ro.unobserve(measured);
    this.byEl.delete(measured);
    it.root.remove();
    it.tail?.remove();
    if (this.items.get(it.b.id) === it) this.items.delete(it.b.id);
  }
  hide(it, off) {
    if (off !== it.off) {
      it.off = off;
      this.flag(it, "sahne-off", off);
    }
  }
  /**
   * Measure bubbles after their text changed, and shrink each card to its longest line (CSS
   * keeps a wrapped box at its max width, which leaves a wide empty margin). Writes, then reads,
   * then writes, then reads: two layouts for the whole batch, never one per bubble.
   */
  fit(list) {
    const cards = list.filter((it) => it.body && !it.leaving);
    for (const it of cards) it.body.style.width = "";
    const range = this.doc.createRange(), want = [];
    for (const it of cards) {
      const body = it.body, ow = body.offsetWidth;
      if (!ow || it.b.voice === "silent") {
        want.push(0);
        continue;
      }
      const k = body.getBoundingClientRect().width / ow || 1;
      range.selectNodeContents(it.text);
      const lines = [];
      for (const r of range.getClientRects()) {
        if (!r.width) continue;
        const mid = (r.top + r.bottom) / 2, L2 = lines.find((x) => Math.abs(x.mid - mid) < r.height / 2);
        if (L2) {
          L2.l = Math.min(L2.l, r.left);
          L2.r = Math.max(L2.r, r.right);
        } else lines.push({ mid, l: r.left, r: r.right });
      }
      let line = 0;
      for (const L2 of lines) line = Math.max(line, (L2.r - L2.l) / k);
      const cs = getComputedStyle(body);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const w = Math.ceil(line + pad + 1);
      want.push(line && w < ow - 1 ? w : 0);
    }
    cards.forEach((it, i) => {
      if (want[i]) it.body.style.width = want[i] + "px";
    });
    for (const it of list) {
      const e = it.body ?? it.inner;
      it.w = e.offsetWidth;
      it.h = e.offsetHeight;
      it.fitted = it.w > 0;
    }
  }
  refit = () => {
    const live = [...this.items.values()].filter((it) => !it.leaving);
    if (live.length) {
      this.fit(live);
      this.layout();
    }
  };
  observed(es) {
    const refit = [];
    let moved = false;
    for (const e of es) {
      if (e.target === this.el) {
        this.resize(e.contentRect.width, e.contentRect.height);
        continue;
      }
      const it = this.byEl.get(e.target);
      if (!it || it.leaving) continue;
      const s = e.borderBoxSize?.[0], w = s ? s.inlineSize : e.contentRect.width, h2 = s ? s.blockSize : e.contentRect.height;
      if (!it.fitted && w) refit.push(it);
      else if (Math.abs(w - it.w) > 0.5 || Math.abs(h2 - it.h) > 0.5) {
        it.w = w;
        it.h = h2;
        moved = true;
      }
    }
    if (refit.length) requestAnimationFrame(() => {
      const live = refit.filter((it) => !it.leaving && this.items.get(it.b.id) === it);
      if (live.length) {
        this.fit(live);
        this.layout();
      }
    });
    if (moved) this.layout();
  }
  /** Sizes that follow the stage: text 16–19 px, bubbles at most 60% wide (≤ 320 px), the window. */
  resize(W2, H) {
    if (W2 === this.W && H === this.H) return;
    const wider = W2 !== this.W;
    this.W = W2;
    this.H = H;
    this.fs = +clamp3(14.6 + W2 * 5e-3, 16, 19).toFixed(2);
    this.T = Math.round(clamp3(H * 0.035, 11, 18));
    this.D = Math.round(clamp3(Math.min(W2 * 0.085 + 26, H * 0.42), 40, 100));
    const maxw = Math.round(Math.min(W2 * 0.6, 320));
    const maxn = Math.round(Math.max(120, Math.min(maxw, W2 - 2 * M - this.D - 2 * RIM2 - this.T - 4)));
    const s = this.el.style;
    s.setProperty("--sahne-fs", this.fs + "px");
    s.setProperty("--sahne-snd-fs", Math.round(this.fs * 1.25) + "px");
    s.setProperty("--sahne-maxw", maxw + "px");
    s.setProperty("--sahne-maxn", maxn + "px");
    s.setProperty("--sahne-inset", this.D + "px");
    s.setProperty("--sahne-tailw", Math.round(this.fs * 1.25) + "px");
    if (wider) this.refit();
    this.layout();
  }
  /** Write a bubble's position and its tail; the first time, let it pop from the tail's base. */
  put(it, r, a, snap, centre) {
    const x = snap(r.x), y = snap(r.y);
    const tf = `translate3d(${x}px,${y}px,0)`;
    if (tf !== it.tf) {
      it.root.style.transform = tf;
      it.tf = tf;
    }
    let t = null;
    if (it.tail) {
      const fs = this.fs, base = Math.round(fs * 1.25);
      const opts = { radius: fs * 1.1, base, inset: 7, min: 5, max: Math.max(this.T * 3, 44) };
      const m = a && it.b.mouth ? this.o.project(it.b.mouth) : null, hd = m && it.b.head ? it.b.head.map((p) => this.o.project(p)) : null;
      if (m && hd && hd[0] && hd[1] && hd[2]) {
        const c = hd[0], rx = Math.hypot(hd[1][0] - c[0], hd[1][1] - c[1]), ry = Math.hypot(hd[2][0] - c[0], hd[2][1] - c[1]);
        t = tailAim({ x, y, w: it.w, h: it.h }, m, { c, rx: Math.max(rx, 1), ry: Math.max(ry, 1) }, { ...opts, gap: 3 });
      } else t = a ? tailTo({ x, y, w: it.w, h: it.h }, a, opts) : null;
      if (t && it.b.kind === "narrator") {
        t.len = Math.max(12, Math.hypot(centre[0] - t.x, centre[1] - t.y) - (this.D / 2 + RIM2) + 2);
      }
      const ttf = t ? `translate3d(${(t.x - base / 2).toFixed(2)}px,${t.y.toFixed(2)}px,0) rotate(${t.angle.toFixed(4)}rad) scale(1,${(t.len / 20).toFixed(3)})` : "scale(0)";
      if (ttf !== it.ttf) {
        it.tail.style.transform = ttf;
        it.ttf = ttf;
      }
    }
    if (!it.placed) {
      it.placed = true;
      if (it.tail) it.inner.style.transformOrigin = t ? `${(t.x - x).toFixed(1)}px ${(t.y - y).toFixed(1)}px` : "50% 100%";
      this.flag(it, "sahne-wait", false);
    }
  }
  // ---- The narrator ---------------------------------------------------------------
  /** Tell the window (and the app) whether the narrator is speaking, and show or hide the window. */
  syncNarrator() {
    let text = null;
    for (const it of this.items.values()) if (it.b.kind === "narrator" && !it.leaving) {
      text = it.b.text;
      break;
    }
    if (text !== this.talking) {
      const was = this.talking;
      this.talking = text;
      if (this.win) {
        if (text !== null) this.win.dataset.talking = "";
        else delete this.win.dataset.talking;
      }
      if (text !== null || was !== null) this.insetO?.onTalk?.(text !== null, text ?? "");
    }
    this.syncWindow();
  }
  window() {
    if (this.win) return this.win;
    const win = this.win = this.doc.createElement("div");
    win.className = "sahne-inset";
    win.hidden = true;
    const ring = this.doc.createElement("div");
    ring.className = "sahne-inset-in";
    this.art = this.doc.createElement("div");
    this.art.className = "sahne-inset-art";
    ring.append(this.art);
    win.append(ring);
    this.el.prepend(win);
    return win;
  }
  /** The window shows while it has content or a narrator bubble is up. */
  syncWindow() {
    const want = !!this.insetO || this.talking !== null;
    if (!want && !this.win) return;
    const win = this.window();
    if (want) {
      clearTimeout(this.winTimer);
      if (this.talking !== null && win.dataset.talking === void 0) win.dataset.talking = "";
      if (!this.winShown) {
        this.winShown = true;
        win.classList.remove("sahne-out");
        if (win.hidden) {
          win.hidden = false;
          win.classList.add("sahne-wait");
          this.winPlaced = false;
        }
      }
    } else if (this.winShown) {
      this.winShown = false;
      win.classList.add("sahne-out");
      this.winTimer = setTimeout(() => {
        win.hidden = true;
        win.classList.remove("sahne-out");
        if (!this.insetO) this.art?.replaceChildren();
      }, OUT + 40);
    }
  }
};

// ../sahne/src/audio/dsp.ts
var LN1000 = Math.log(1e3);
function curveAt(c, t) {
  if (typeof c === "number") return c;
  const k = c.time > 0 ? Math.min(1, Math.max(0, t / c.time)) : 1;
  const exp = c.curve ? c.curve === "exp" : c.from > 0 && c.to > 0;
  return exp ? c.from * Math.pow(c.to / c.from, k) : c.from + (c.to - c.from) * k;
}
var constant = (c) => typeof c === "number";
function envTimes(v, dur) {
  const e = v.env ?? {}, a = e.a ?? 5e-3, d = e.d ?? 0, s = e.s ?? (d > 0 ? 0 : 1), r = e.r ?? 0.05;
  const natural = "pluck" in v.src ? v.src.decay ?? 1.5 : "partials" in v.src ? Math.max(...v.src.partials.map((p) => p[2])) : 0;
  const hold = e.hold ?? (s > 0 ? Math.max(a + d, natural, dur - (v.at ?? 0) - r) : a + d);
  return { a, d, s, r, hold, len: hold + r };
}
var voiceLength = (v, dur) => envTimes(v, dur).len;
function envAt(e, t) {
  if (t < 0 || t > e.len) return 0;
  let v;
  if (t < e.a) v = t / e.a;
  else if (e.d > 0) v = e.s + (1 - e.s) * Math.exp(-LN1000 * (t - e.a) / e.d);
  else v = e.s > 0 ? e.s : 1;
  if (t > e.hold) v *= Math.exp(-LN1000 * (t - e.hold) / Math.max(1e-4, e.r));
  return v;
}
function wander(R3, rate, n, fs) {
  const out = new Float32Array(n), per = Math.max(1, Math.round(fs / Math.max(0.01, rate)));
  let a = R3() * 2 - 1, b = R3() * 2 - 1;
  for (let i = 0; i < n; i++) {
    const k = i % per / per;
    if (i > 0 && i % per === 0) {
      a = b;
      b = R3() * 2 - 1;
    }
    out[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  }
  return out;
}
function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
function source(v, n, fs, R3, pitchMod) {
  const out = new Float32Array(n), src = v.src;
  const pm = (i) => pitchMod ? Math.pow(2, pitchMod[i] / 1200) : 1;
  if ("osc" in src) {
    const detune = src.detune?.length ? src.detune : [0];
    const fixed = constant(src.f) && !pitchMod;
    for (const cents of detune) {
      const ratio = Math.pow(2, cents / 1200);
      let ph = R3();
      const f0 = fixed ? curveAt(src.f, 0) * ratio : 0;
      for (let i = 0; i < n; i++) {
        const f = fixed ? f0 : curveAt(src.f, i / fs) * ratio * pm(i), dt = Math.min(0.49, f / fs);
        let y;
        switch (src.osc) {
          case "sine":
            y = Math.sin(2 * Math.PI * ph);
            break;
          case "triangle":
            y = 1 - 4 * Math.abs(Math.round(ph - 0.25) - (ph - 0.25));
            break;
          case "saw":
            y = 2 * ph - 1 - blep(ph, dt);
            break;
          default:
            y = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt);
        }
        out[i] += y / detune.length;
        ph += dt;
        if (ph >= 1) ph -= 1;
      }
    }
  } else if ("noise" in src) {
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = R3() * 2 - 1;
      if (src.noise === "white") out[i] = w;
      else if (src.noise === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
      } else {
        last = (last + 0.02 * w) / 1.02;
        out[i] = last * 3.5;
      }
    }
  } else if ("pluck" in src) {
    const f = src.pluck, N = Math.max(1, fs / f - 0.5), len = Math.ceil(N) + 2, line = new Float32Array(len);
    const bright = src.bright ?? 0.6, decay = src.decay ?? 1.5;
    const loss = Math.pow(1e-3, 1 / (f * decay));
    let lp = 0;
    const coef = 0.15 + 0.8 * bright;
    for (let i = 0; i < len; i++) {
      lp += coef * (R3() * 2 - 1 - lp);
      line[i] = lp;
    }
    let w = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const rd = (w - N + len * 2) % len, i0 = Math.floor(rd), fr = rd - i0;
      const y = line[i0 % len] * (1 - fr) + line[(i0 + 1) % len] * fr;
      const next = (y + prev) * 0.5 * loss;
      prev = y;
      line[w] = next;
      w = (w + 1) % len;
      out[i] = y;
    }
  } else if ("fm" in src) {
    let pc = 0, pmod = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fs, fc = curveAt(src.fm, t) * pm(i), I = curveAt(src.index, t);
      out[i] = Math.sin(2 * Math.PI * pc + I * Math.sin(2 * Math.PI * pmod));
      pc += fc / fs;
      pmod += fc * src.ratio / fs;
      if (pc > 1) pc -= Math.floor(pc);
      if (pmod > 1) pmod -= Math.floor(pmod);
    }
  } else {
    for (const [ratio, amp, decay] of src.partials) {
      const f = src.f * ratio;
      if (f >= fs * 0.48) continue;
      const k = -LN1000 / (decay * fs);
      let ph = R3(), g = amp;
      const step = Math.exp(k), dph = f / fs;
      for (let i = 0; i < n; i++) {
        out[i] += Math.sin(2 * Math.PI * ph) * g;
        ph += dph * pm(i);
        if (ph >= 1) ph -= 1;
        g *= step;
      }
    }
  }
  return out;
}
function filter(x, fl, fs, cutMod) {
  const q = Math.max(0.3, fl.q ?? 0.707), k = 1 / q;
  let ic1 = 0, ic2 = 0, g = 0, a1 = 0, a2 = 0, a3 = 0;
  const fixed = constant(fl.f) && !cutMod;
  const coef = (fc) => {
    g = Math.tan(Math.PI * Math.min(fs * 0.45, Math.max(10, fc)) / fs);
    a1 = 1 / (1 + g * (g + k));
    a2 = g * a1;
    a3 = g * a2;
  };
  coef(curveAt(fl.f, 0));
  for (let i = 0; i < x.length; i++) {
    if (!fixed && (i & 15) === 0) coef(curveAt(fl.f, i / fs) * (cutMod ? Math.pow(2, cutMod[i]) : 1));
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    x[i] = fl.type === "lp" ? v2 : fl.type === "bp" ? v1 * k : v0 - k * v1 - v2;
  }
}
function lfoWave(l, n, fs, R3) {
  const out = l.shape === "noise" ? wander(R3, l.rate, n, fs) : new Float32Array(n);
  if (l.shape !== "noise") {
    const ph = R3();
    for (let i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * (ph + l.rate * i / fs));
  }
  if (l.delay) for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / (l.delay * fs));
  return out;
}
function renderVoice(v, out, fs, R3, dur) {
  const start = Math.round((v.at ?? 0) * fs), times = envTimes(v, dur);
  const n = Math.min(out.length - start, Math.ceil(times.len * fs));
  if (n <= 0) return;
  const lfos = v.lfo ? Array.isArray(v.lfo) ? v.lfo : [v.lfo] : [];
  const mod = (to) => {
    const ls = lfos.filter((l) => l.to === to);
    if (!ls.length) return null;
    const sum = new Float32Array(n);
    for (const l of ls) {
      const w = lfoWave(l, n, fs, R3);
      for (let i = 0; i < n; i++) sum[i] += w[i] * l.depth;
    }
    return sum;
  };
  const pitch = mod("pitch"), cut2 = mod("cut");
  let amp = null;
  for (const l of lfos.filter((l3) => l3.to === "amp")) {
    amp ??= new Float32Array(n).fill(1);
    const w = lfoWave(l, n, fs, R3), d = Math.min(1, l.depth);
    for (let i = 0; i < n; i++) amp[i] *= 1 - d * (0.5 + 0.5 * w[i]);
  }
  const x = source(v, n, fs, R3, pitch);
  for (const fl of v.filter ? Array.isArray(v.filter) ? v.filter : [v.filter] : []) filter(x, fl, fs, cut2);
  const gain = v.gain ?? 1;
  for (let i = 0; i < n; i++) {
    const y = x[i] * envAt(times, i / fs) * gain;
    out[start + i] += amp ? y * amp[i] : y;
  }
}
function finish(job) {
  for (; ; ) {
    const r = job.next();
    if (r.done) return r.value;
  }
}
function* patchJob(p, seed = 1) {
  const fs = p.rate ?? 32e3, R3 = rng(seed);
  const dur = p.dur ?? Math.max(0.01, ...p.voices.map((v) => (v.at ?? 0) + voiceLength(v, 0)));
  const out = new Float32Array(Math.ceil(dur * fs));
  for (const v of p.voices) {
    renderVoice(v, out, fs, R3, dur);
    yield;
  }
  const k = 1 - 2 * Math.PI * 10 / fs;
  for (let i = 0, px = 0, py = 0; i < out.length; i++) {
    py = out[i] - px + k * py;
    px = out[i];
    out[i] = py;
  }
  level(out, p.peak ?? 0.7, false);
  return { rate: fs, data: out };
}
var renderPatch = (p, seed = 1) => finish(patchJob(p, seed));
function* loopJob(p, seed = 1, xfade = 0.5) {
  const fs = p.rate ?? 22050, dur = p.dur ?? 6, X = Math.round(xfade * fs), N = Math.round(dur * fs);
  const long = (yield* patchJob({ ...p, rate: fs, dur: dur + xfade + 0.1, peak: 1 }, seed)).data;
  const out = long.slice(0, N);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < X; i++) {
    ab += long[N + i] * long[i];
    aa += long[N + i] ** 2;
    bb += long[i] ** 2;
  }
  const rho = Math.max(0, Math.min(1, ab / Math.sqrt(aa * bb || 1)));
  for (let i = 0; i < X; i++) {
    const k = i / X, c = Math.cos(k * Math.PI / 2), s = Math.sin(k * Math.PI / 2);
    out[i] = (long[N + i] * c + long[i] * s) / Math.sqrt(1 + 2 * rho * c * s);
  }
  level(out, p.peak ?? 0.7);
  return { rate: fs, data: out };
}
var renderLoop = (p, seed = 1, xfade = 0.5) => finish(loopJob(p, seed, xfade));
function level(x, peak, dc = true) {
  let mean = 0;
  if (dc) for (let i = 0; i < x.length; i++) mean += x[i];
  mean /= x.length || 1;
  let max = 0;
  for (let i = 0; i < x.length; i++) {
    x[i] -= mean;
    const a = Math.abs(x[i]);
    if (a > max) max = a;
  }
  if (max > 1e-9) {
    const g = peak / max;
    for (let i = 0; i < x.length; i++) x[i] *= g;
  }
}
function rms(x, from = 0, to = x.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
}
function spectrum(x, at4, size, bins) {
  const out = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const w = Math.PI * (b + 0.5) / bins;
    let re = 0, im = 0;
    for (let i = 0; i < size; i++) {
      const s = (x[at4 + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size));
      re += s * Math.cos(w * i);
      im -= s * Math.sin(w * i);
    }
    out[b] = Math.hypot(re, im) / size;
  }
  return out;
}
function pitchOf(x, fs, at4, size, lo = 60, hi = 2e3) {
  const l0 = Math.floor(fs / hi), l12 = Math.ceil(fs / lo), c = new Float64Array(l12 + 2);
  let best = 0;
  for (let lag = l0; lag <= l12 + 1; lag++) {
    let s = 0;
    for (let i = 0; i < size; i++) s += (x[at4 + i] ?? 0) * (x[at4 + i + lag] ?? 0);
    c[lag] = s;
    best = Math.max(best, s);
  }
  for (let lag = l0 + 1; lag <= l12; lag++) if (c[lag] >= best * 0.9 && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) return fs / lag;
  return 0;
}

// ../sahne/src/audio/motif.ts
var NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(name) {
  const m = /^([A-G])(#|b)?(~)?(-?\d)?$/.exec(name);
  if (!m) throw new Error(`sahne: not a note: ${name}`);
  const semis = NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) - (m[3] ? 0.5 : 0);
  const midi = 12 * ((m[4] ? +m[4] : 4) + 1) + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function parseTrack(notes, oct = 0) {
  const out = [];
  let i = 0;
  for (const tok of notes.split(/\s+/).filter((t) => t && t !== "|")) {
    if (tok === ".") {
      i++;
      continue;
    }
    if (tok === "-") {
      if (out.length) out[out.length - 1].len++;
      i++;
      continue;
    }
    const m = /^([^!:]+)(!)?(?::(\d+))?$/.exec(tok);
    if (!m) throw new Error(`sahne: bad step: ${tok}`);
    const len = m[3] ? +m[3] : 1, vel = m[2] ? 1 : 0.72;
    if (/^[a-z]+$/.test(m[1])) out.push({ step: i, len, f: 0, vel, hit: m[1] });
    else out.push({ step: i, len, f: noteFreq(m[1]) * Math.pow(2, oct), vel });
    i += len;
  }
  return out;
}
function motifSteps(def) {
  return Math.max(0, ...def.tracks.map((t) => parseTrack(t.notes).reduce((n, s) => Math.max(n, s.step + s.len), 0)));
}
function motifVoices(def, instruments, seed = 1) {
  const R3 = rng(seed), stepS = 60 / def.bpm / (def.steps ?? 2), swing2 = def.swing ?? 0;
  const voices = [];
  for (const tr of def.tracks) {
    const inst = instruments[tr.inst];
    if (!inst) throw new Error(`sahne: no instrument ${tr.inst}`);
    for (const s of parseTrack(tr.notes, tr.oct ?? 0)) {
      const at4 = (s.step + (s.step % 2 === 1 ? swing2 : 0)) * stepS;
      for (const v of inst({ f: s.f, len: s.len * stepS, vel: s.vel, hit: s.hit }, R3)) {
        voices.push({ ...v, at: (v.at ?? 0) + at4, gain: (v.gain ?? 1) * (tr.gain ?? 1) });
      }
    }
  }
  return { voices, dur: motifSteps(def) * stepS + (def.tail ?? 1.2) };
}
function motifJob(def, instruments, seed = 1, rate = 32e3) {
  const { voices, dur } = motifVoices(def, instruments, seed);
  return patchJob({ voices, dur, rate, peak: def.peak ?? 0.7 }, seed);
}
var renderMotif = (def, instruments, seed = 1, rate = 32e3) => finish(motifJob(def, instruments, seed, rate));

// ../sahne/src/audio/engine.ts
var DEFAULT_VOLUMES = { voice: 1, fx: 0.8, ambience: 0.3, music: 0.5 };
var DUCK = { music: 0, ambience: 0.45 };
var idle = (cb) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(cb, { timeout: 400 });
  else setTimeout(() => cb(), 16);
};
var AudioEngine = class {
  kit;
  ctx = null;
  enabled = false;
  volumes;
  master = null;
  buses = {};
  ducks = {};
  rendered = /* @__PURE__ */ new Map();
  /** Renders under way, and the ones waiting for an idle moment. */
  jobs = /* @__PURE__ */ new Map();
  /** Renders waiting for idle moments, and what to do once the ones before it are done. */
  queue = [];
  buffers = /* @__PURE__ */ new Map();
  counts = /* @__PURE__ */ new Map();
  live = /* @__PURE__ */ new Set();
  loops = /* @__PURE__ */ new Map();
  ambient = [];
  ducked = false;
  destroyed = false;
  unlock = () => {
    if (this.enabled && this.ctx && this.ctx.state !== "running" && !document.hidden) void this.ctx.resume().catch(() => {
    });
  };
  onVis = () => {
    if (!this.ctx || !this.enabled) return;
    if (document.hidden) void this.ctx.suspend().catch(() => {
    });
    else this.unlock();
  };
  /** Where the kit's recordings are served from (a URL ending in "/"); without it, only patches play. */
  soundsUrl;
  session;
  recs = /* @__PURE__ */ new Map();
  loading = /* @__PURE__ */ new Map();
  decoder = null;
  constructor(kit, o = {}) {
    this.kit = kit;
    this.volumes = { ...DEFAULT_VOLUMES, ...o.volumes };
    this.soundsUrl = o.sounds ?? null;
    this.session = o.session ?? "ambient";
  }
  /** Whether a sound plays a recording here. */
  recorded(id) {
    return !!this.kit.sounds?.[id]?.recording && !!this.soundsUrl;
  }
  /** A sound's recording, fetched and decoded once; null where it has none or it fails to load (the patch plays instead). */
  recording(id) {
    const rec = this.kit.sounds?.[id]?.recording;
    if (!rec || !this.soundsUrl) return Promise.resolve(null);
    let p = this.loading.get(id);
    if (!p) {
      const url = this.soundsUrl + rec.file;
      p = (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          const dec = this.ctx ?? (this.decoder ??= new OfflineAudioContext(1, 1, 48e3));
          return await dec.decodeAudioData(data);
        } catch (e) {
          console.warn("sahne: the recording did not load, so the patch plays instead:", url, e);
          return null;
        }
      })();
      void p.then((b) => this.recs.set(id, b));
      this.loading.set(id, p);
    }
    return p;
  }
  /** Turn sound on (call it from a tap) or off. */
  setEnabled(on) {
    if (this.destroyed || on === this.enabled) return;
    this.enabled = on;
    if (on) {
      if (!this.ctx) this.open();
      this.unlock();
      this.ambience(this.ambient, true);
    } else if (this.ctx) {
      this.stopAll();
      for (const id of [...this.loops.keys()]) this.stopLoop(id, 0.05);
      void this.ctx.suspend().catch(() => {
      });
    }
  }
  open() {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    try {
      const session = navigator.audioSession;
      if (session) session.type = this.session;
    } catch {
    }
    const ctx = this.ctx = new AC({ latencyHint: "interactive" });
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    for (const bus of ["voice", "fx", "ambience", "music"]) {
      const duck = this.ducks[bus] = ctx.createGain(), g = this.buses[bus] = ctx.createGain();
      g.gain.value = this.volumes[bus];
      g.connect(duck);
      duck.connect(this.master);
    }
    for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, this.unlock, true);
    document.addEventListener("visibilitychange", this.onVis);
  }
  setVolume(bus, v) {
    this.volumes[bus] = Math.min(1, Math.max(0, v));
    const g = this.buses[bus];
    if (g && this.ctx) g.gain.setTargetAtTime(this.volumes[bus], this.ctx.currentTime, 0.03);
  }
  /**
   * The voice bus's input, for a voice provider that plays recordings (it takes the context from
   * `voiceOut.context`): its volume is the voice volume, so the provider adds none. Null before sound
   * is first turned on, or where there is no Web Audio.
   */
  get voiceOut() {
    return this.buses.voice ?? null;
  }
  /** The context's clock (s), or 0 before sound is on. */
  get time() {
    return this.ctx?.currentTime ?? 0;
  }
  get running() {
    return this.enabled && this.ctx?.state === "running";
  }
  // ---- Rendering ------------------------------------------------------------------------------
  key(id, take, params) {
    return `${id}|${take}|${JSON.stringify(params, Object.keys(params).sort())}`;
  }
  /** A render of a sound's take or a motif, not yet run. */
  job(id, take = 0, params = {}) {
    const def = this.kit.sounds?.[id];
    if (def) {
      const key = this.key(id, take, params), seed = `${id}:${take}:${key}`;
      return { key, make: () => {
        const patch = def.patch({ rng: rng(seed), take, params });
        return def.loop ? loopJob(patch, seed) : patchJob(patch, seed);
      } };
    }
    const m = this.kit.motifs?.[id];
    if (m && this.kit.instruments) {
      const inst = this.kit.instruments;
      return { key: "motif|" + id, make: () => motifJob(m, inst, id) };
    }
    return null;
  }
  run(j) {
    let r = this.rendered.get(j.key);
    if (!r) {
      const job = this.jobs.get(j.key) ?? j.make();
      this.jobs.delete(j.key);
      r = finish(job);
      this.rendered.set(j.key, r);
    }
    return r;
  }
  /** The samples of one take of a kit sound, rendered once. For playing, and for the gallery's pictures. */
  render(id, take = 0, params = {}) {
    const j = this.kit.sounds?.[id] ? this.job(id, take, params) : null;
    return j ? this.run(j) : null;
  }
  renderMotif(id) {
    const j = this.kit.motifs?.[id] ? this.job(id) : null;
    return j ? this.run(j) : null;
  }
  isRendered(id, take = 0, params = {}) {
    return this.rendered.has(this.kit.sounds?.[id] ? this.key(id, take, params) : "motif|" + id);
  }
  /** How long a sound (or a motif) lasts, ms. */
  length(id) {
    const r = this.kit.sounds?.[id] ? this.render(id) : this.renderMotif(id);
    return r ? r.data.length / r.rate * 1e3 : 0;
  }
  /**
   * Render sounds ahead of time in idle moments, a voice at a time, so neither preparing nor
   * playing them stalls a frame. Every take of each; `params` for a sound that needs them (a step's surface).
   */
  prepare(list, then) {
    for (const it of list) {
      const id = typeof it === "string" ? it : it.id, params = typeof it === "string" ? {} : it.params ?? {};
      if (this.recorded(id)) {
        void this.recording(id).then((b) => {
          if (!b) this.prepare([it]);
        });
        continue;
      }
      const takes = this.kit.sounds?.[id]?.takes ?? 1;
      for (let k = 0; k < takes; k++) {
        const j = this.job(id, k, params);
        if (j && !this.rendered.has(j.key) && !this.queue.some((q) => q.key === j.key)) this.queue.push(j);
      }
    }
    if (then) this.queue.push({ key: "", then });
    this.work();
  }
  working = false;
  work() {
    if (this.working || this.destroyed) return;
    this.working = true;
    idle((deadline) => {
      this.working = false;
      const until = performance.now() + Math.min(12, deadline ? deadline.timeRemaining() : 8);
      while (this.queue.length && performance.now() < until) {
        const j = this.queue[0];
        if (j.then || !j.make) {
          this.queue.shift();
          j.then?.();
          continue;
        }
        if (this.rendered.has(j.key)) {
          this.queue.shift();
          continue;
        }
        let job = this.jobs.get(j.key);
        if (!job) {
          job = j.make();
          this.jobs.set(j.key, job);
        }
        const r = job.next();
        if (r.done) {
          this.rendered.set(j.key, r.value);
          this.jobs.delete(j.key);
          this.queue.shift();
        }
      }
      if (this.queue.length) this.work();
    });
  }
  buffer(key, r) {
    const ctx = this.ctx;
    if (!ctx) return null;
    let b = this.buffers.get(key);
    if (!b) {
      b = ctx.createBuffer(1, r.data.length, r.rate);
      b.copyToChannel(r.data, 0);
      this.buffers.set(key, b);
    }
    return b;
  }
  // ---- Playing --------------------------------------------------------------------------------
  /** Play a kit sound on its bus. Nothing happens while sound is off or the kit has no such sound. */
  play(id, o = {}) {
    const def = this.kit.sounds?.[id];
    if (!def || def.loop || !this.running) return null;
    const takes = def.takes ?? 1;
    const n = this.counts.get(id) ?? hashString(id) % takes;
    this.counts.set(id, n + 1);
    const rec = this.recs.get(id);
    if (rec) return this.start(rec, def.bus, o);
    if (this.recorded(id) && !this.recs.has(id)) void this.recording(id);
    const take = o.take ?? n % takes, params = o.params ?? {};
    const r = this.render(id, take, params);
    if (!r) return null;
    return this.start(this.buffer(this.key(id, take, params), r), def.bus, o);
  }
  /** Play a motif on the music bus. */
  motif(id, o = {}) {
    if (!this.running) return null;
    const r = this.renderMotif(id);
    return r ? this.start(this.buffer("motif|" + id, r), "music", o) : null;
  }
  start(buf, bus, o) {
    const ctx = this.ctx;
    if (!buf || !ctx) return null;
    const node = ctx.createBufferSource();
    node.buffer = buf;
    let out = node;
    if (o.gain !== void 0 && o.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = o.gain;
      out.connect(g);
      out = g;
    }
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      out.connect(p);
      out = p;
    }
    out.connect(this.buses[bus]);
    const when = Math.max(ctx.currentTime, o.when ?? 0);
    const src = { node, when, bus };
    this.live.add(src);
    node.onended = () => this.live.delete(src);
    node.start(when);
    return { when, stop: () => {
      try {
        node.stop();
      } catch {
      }
      this.live.delete(src);
    } };
  }
  /** Stop the sounds scheduled for later (a skipped performance); the ones already sounding ring on. */
  stopPending() {
    const now = this.time;
    for (const s of [...this.live]) if (s.when > now + 5e-3 && s.bus !== "ambience") {
      try {
        s.node.stop();
      } catch {
      }
      this.live.delete(s);
    }
  }
  /** Stop every one-shot now. */
  stopAll() {
    for (const s of [...this.live]) {
      try {
        s.node.stop();
      } catch {
      }
    }
    this.live.clear();
  }
  /** Crossfade the ambience to these loops (a scene's place). */
  ambience(ids, force = false) {
    const want = ids.filter((id) => this.kit.sounds?.[id]?.loop);
    if (!force && want.join() === this.ambient.join() && (!this.enabled || want.every((id) => this.loops.has(id)))) return;
    this.ambient = want;
    if (!this.enabled || !this.ctx) return;
    for (const id of [...this.loops.keys()]) if (!want.includes(id)) this.stopLoop(id, 1.2);
    for (const id of want) {
      if (this.loops.has(id)) continue;
      const again = () => {
        if (this.ambient.includes(id)) this.ambience(this.ambient, true);
      };
      if (this.recorded(id) && !this.recs.has(id)) {
        void this.recording(id).then(again);
        continue;
      }
      const rec = this.recs.get(id) ?? null, span = rec ? this.kit.sounds[id].recording.loop : void 0;
      if (!rec && !this.isRendered(id)) {
        this.prepare([id], again);
        continue;
      }
      const r = rec ? null : this.render(id), ctx = this.ctx;
      const buf = rec ?? (r && this.buffer(this.key(id, 0, {}), r));
      if (!buf) continue;
      const node = ctx.createBufferSource(), gain = ctx.createGain();
      node.buffer = buf;
      node.loop = true;
      const [a, b] = span ?? [0, buf.duration];
      if (span) {
        node.loopStart = a;
        node.loopEnd = b;
      }
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      node.connect(gain);
      gain.connect(this.buses.ambience);
      node.start(ctx.currentTime, a + hashString(id) % 1e3 / 1e3 * (b - a));
      this.loops.set(id, { node, gain });
    }
  }
  stopLoop(id, fade) {
    const l = this.loops.get(id), ctx = this.ctx;
    if (!l || !ctx) return;
    this.loops.delete(id);
    l.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    try {
      l.node.stop(ctx.currentTime + fade);
    } catch {
    }
  }
  /** A voice is speaking: music goes away and ambience goes down, and they come back after. */
  duck(on) {
    if (on === this.ducked) return;
    this.ducked = on;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [bus, level2] of Object.entries(DUCK)) {
      this.ducks[bus].gain.setTargetAtTime(on ? level2 : 1, ctx.currentTime, on ? 0.06 : 0.35);
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAll();
    for (const ev of ["pointerdown", "keydown", "touchend"]) document.removeEventListener(ev, this.unlock, true);
    document.removeEventListener("visibilitychange", this.onVis);
    void this.ctx?.close().catch(() => {
    });
    this.ctx = null;
  }
};

// ../sahne/src/audio/clock.ts
var SpeechClock = class {
  /** Performance time of the line's start. */
  t0;
  words;
  /** The estimate's length of the line. */
  dur;
  started = null;
  aReal = 0;
  aEst = 0;
  cap;
  speed = 1;
  lastMark = null;
  ended = false;
  constructor(t0, words, dur) {
    this.t0 = t0;
    this.words = words;
    this.dur = dur;
    this.cap = dur;
  }
  /** Ms into the line's estimate at real time `real`. */
  est(real) {
    if (this.started === null) return 0;
    if (this.ended) return Math.max(this.aEst, this.dur);
    return Math.min(this.aEst + (real - this.aReal) * this.speed, Math.max(this.cap, this.aEst));
  }
  /** The voice started at `real`. */
  start(real) {
    if (this.started !== null) return;
    this.started = real;
    this.aReal = real;
    this.aEst = 0;
  }
  /** The voice reached the word at `charIndex` of the text at `real`. */
  word(charIndex, real) {
    if (this.started === null) this.start(real);
    let k = -1;
    for (let i = 0; i < this.words.length; i++) if (this.words[i].i <= charIndex) k = i;
    if (k < 0) return;
    const now = this.est(real), e = this.words[k].t0;
    if (this.lastMark && k > this.lastMark.k && real > this.lastMark.real) {
      const pace = (e - this.words[this.lastMark.k].t0) / (real - this.lastMark.real);
      this.speed = Math.min(1.6, Math.max(0.6, this.speed * 0.5 + pace * 0.5));
    }
    this.lastMark = { k, real };
    this.aEst = Math.max(now, e);
    this.aReal = real;
    this.cap = k + 1 < this.words.length ? this.words[k + 1].t0 : this.dur;
  }
  /** The voice finished (or failed) at `real`. */
  end(real) {
    if (this.started === null) this.start(real);
    this.aEst = Math.max(this.est(real), this.dur);
    this.aReal = real;
    this.ended = true;
  }
  get waiting() {
    return this.started === null;
  }
  /** Performance time at real time `real`. */
  at(real) {
    return this.t0 + this.est(real);
  }
};

// ../sahne/src/stage.ts
var STUDIO_ID = "me";
var HALT_MS = 2e3;
function axes(yaw = 0, pitch = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const d0 = [0, -cp, -sp];
  return { R: [cy / 100, 0, -sy / 100], D: [(d0[0] * cy + d0[2] * sy) / 100, d0[1] / 100, (-d0[0] * sy + d0[2] * cy) / 100] };
}
var at3 = (O, R3, D, x, y) => [O[0] + R3[0] * x + D[0] * y, O[1] + R3[1] * x + D[1] * y, O[2] + R3[2] * x + D[2] * y];
var TEXT_PX = 28;
var reactKey = (rc, O) => `${O[0].toFixed(3)},${O[2].toFixed(3)},${rc.flee?.r ?? ""},${rc.flee?.away ?? ""},${rc.flee?.speed ?? ""}`;
var homeOf = (fl, rc) => rc.home ? [fl.O[0] + (rc.home[0] - (fl.spec.x ?? 0)) / 100, fl.O[1] - (fl.spec.y ?? 0) / 100, fl.O[2] + (rc.home[1] - (fl.spec.z ?? 0)) / 100] : fl.O;
var TAP_MS = 1400;
var dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
var rgba = (hex, a = 1) => {
  const c = hexToRgb(hex);
  return [c[0] * a, c[1] * a, c[2] * a, a];
};
var NO_RECT = { layer: 0, u0: 0, v0: 0, u1: 0, v1: 0, box: [0, 0, 0, 0] };
var heldKey = (s) => s.holder ? "h:" + s.holder.actor : "a:" + (s.at?.join() ?? "");
var artKey = (s) => propKey(s) + (s.holder ? "|held" : "");
function ghostOf(g) {
  const outline = g.shapes.filter((s) => !s.flat && s.fill);
  return { edge: 0, shapes: [
    ...outline.map((s) => ({ path: s.path, fill: "#FFFFFF", flat: true, opacity: 0.16 })),
    ...outline.map((s) => ({ path: s.path, stroke: { color: "#3A302B", width: 1, cap: "round" }, flat: true, opacity: 0.55 })),
    ...outline.map((s) => ({ path: s.path, stroke: { color: "#FFF8EC", width: 0.7, dash: [2, 1.5], cap: "round" }, flat: true }))
  ] };
}
var studioPlace = (backdrop) => ({
  v: 1,
  id: "studio",
  size: { w: 4, d: 3 },
  marks: { here: { x: 0, z: 0 }, aside: { x: 0.9, y: 1.7, z: 0 } },
  pieces: backdrop === "wall" ? [{ kit: "floor", x: 0, z: -1.4, w: 1e3, d: 900 }, { kit: "wall", x: 0, z: -1.35, w: 1e3, h: 380, tiles: 0 }] : []
});
var Latest = class {
  m = /* @__PURE__ */ new Map();
  put(k, v, wait = true) {
    return new Promise((res) => {
      const e = this.m.get(k), w = wait ? [res] : [];
      if (e) {
        e.v = v;
        e.waiting.push(...w);
      } else this.m.set(k, { v, waiting: w });
      if (!wait) res();
    });
  }
  get size() {
    return this.m.size;
  }
  /** Drop everything queued, releasing the waiters. */
  clear() {
    for (const e of this.m.values()) for (const w of e.waiting) w();
    this.m.clear();
  }
  /** Hand every queued value to `apply`, oldest key first, and release its waiters whatever `apply` does; the first error is thrown after the rest are done. */
  drain(apply2) {
    const all = [...this.m];
    this.m.clear();
    let err, failed = false;
    for (const [k, e] of all) {
      try {
        apply2(k, e.v);
      } catch (x) {
        if (!failed) {
          failed = true;
          err = x;
        }
      } finally {
        for (const w of e.waiting) w();
      }
    }
    if (failed) throw err;
  }
};
function scriptPlaces(script, extra = []) {
  const out = /* @__PURE__ */ new Set();
  for (const c of [...script.cues, ...extra.flatMap((b) => b.cues)]) if ("scene" in c) out.add(c.scene.place);
  return out;
}
var NO_RUN = { cue: -1, dur: 0, t: 0, finish() {
}, seek() {
}, pause() {
}, resume() {
}, done: Promise.resolve() };
var Stage = class {
  el;
  canvas;
  kit;
  /** The paper renderer; null when the device has no WebGL2 (see `webgl`). */
  r;
  /**
   * Whether the stage can draw. Without WebGL2 the constructor still succeeds, but the stage stays
   * inert: no canvas is added to `el`, `load`, `studio`, `show` and the like do nothing and
   * `act`, `play`, `turnTo`, `mood`, `gesture` and `flip` return performances that are over, so the
   * app can put an SVG still (`render/still`) in `el` instead.
   */
  webgl;
  lang;
  overlay;
  /** Whether lines show as bubbles (theatre mode); off in log mode, where the host shows them. `setBubbles` switches it. */
  lines;
  audio;
  motion;
  /** Sound is on; captions show sound words while it is. */
  soundOn = false;
  captions = false;
  dim;
  /** `atlasMs`: the last scene load; `swapMs`: the last `setAvatar` (`swaps` counts them); `texKB`: GPU memory of atlas and faces. */
  stats = {
    vertices: 0,
    frameMs: 0,
    atlasMs: 0,
    layers: 0,
    poseMs: 0,
    swapMs: 0,
    swaps: 0,
    texKB: 0,
    /** The places whose art the atlas holds now (the one on stage and the next, §6.2). */
    places: []
  };
  script = { v: 1, cues: [] };
  perfs = [];
  /** The performance on stage and its frame. */
  perf = null;
  frame = null;
  /** This place's performances since its scene began, the last the one on stage: what reacting flats remember (`FlatReact`). */
  history = [];
  /** Where people walked in `history` (`peopleSamples`), and each reacting flat's flights from it, by its home: made when first needed. */
  reactMemo = { samples: null, flights: /* @__PURE__ */ new Map() };
  /** What each tappable reacting flat does when tapped, by its key (filled as they are drawn), and the taps playing now. */
  tapSpecs = /* @__PURE__ */ new Map();
  taps = /* @__PURE__ */ new Map();
  cam = { eye: [0, 1.4, 6], target: [0, 1.1, 0], fov: 0.52 };
  light = TIMES.day;
  places = {};
  sets = /* @__PURE__ */ new Map();
  propArt = /* @__PURE__ */ new Map();
  actors = /* @__PURE__ */ new Map();
  ctx;
  inset = null;
  camFrom = null;
  /** Framings per performance (they depend on where its actors end up) and per shot. */
  camCache = /* @__PURE__ */ new WeakMap();
  /** A number per performance, so a bubble of one is never mistaken for one of another. */
  serials = /* @__PURE__ */ new WeakMap();
  nextSerial = 1;
  /** Which actor's face is in each face slot now. */
  slotOwner = [];
  cssW = 1;
  cssH = 1;
  destroyed = false;
  onDown = () => this.poke();
  t0 = 0;
  pausedAt = null;
  resolveDone = null;
  raf = 0;
  lastInput = 0;
  idleTimeout;
  gloss;
  maxDpr;
  vp = null;
  visible = true;
  bubbleIds = "";
  bubbles = /* @__PURE__ */ new Map();
  ro = null;
  io = null;
  onVis = () => {
    if (document.hidden) this.stop();
    else this.kick();
  };
  voice;
  voices = {};
  ar = null;
  speech = null;
  pumpTimer = 0;
  ambientPlace = void 0;
  atlasSize = 2048;
  /** The places whose art the atlas holds; a change of place to come is drawn in idle time (`plan`, timer `preT`), as `job`. */
  res = [];
  job = "";
  preT = 0;
  /** The studio's setup while `studio()` is showing (null on a story stage). */
  studioCfg = null;
  /** When the studio's camera last stepped, and whether it is still on its way. */
  camT = 0;
  camBusy = false;
  snapCam = false;
  /** A look was built last frame and is not drawn yet. */
  built = false;
  swaps = new Latest();
  /** The art could not be drawn again after the context came back. */
  broken = false;
  looping = false;
  lastDraw = 0;
  idleGap = 0;
  /** Idle settings from the options: a studio changes them and a later `load` puts them back. */
  idleTimeout0;
  idleGap0;
  warmT = 0;
  lifeT = 0;
  /** The stops clock (`FlatMotion.clock`, `PlaceDoc.stops`): the life clock until a story holds the vehicle at a station or starts it again; `a` is where it was last set (life time `L`, stops time `S`), `H` the station it holds at. */
  stopsA = null;
  lifeAt = 0;
  /** The interaction layer (`interact(stage)`): plays act cues and hit-tests taps. Without one, an act cue performs its expected answer. */
  interaction = null;
  /** Record what each frame draws (`picks`), for hit tests. Set by the interaction layer, which also sets `atlasHook` (the alpha masks) before `load`. */
  pickable = false;
  atlasHook = null;
  /** The quads of the last frame, in drawing order (while `pickable`). */
  picks = [];
  /** The flats with text the last frame drew (`FlatSpec.text`): where, in world space (`O` its origin, `R`/`D` metres per cm right and down), for `propText`. */
  texts = [];
  /** A prop the learner is dragging, drawn at `at` (world) instead of where it is, until its state changes from `from`. */
  held = null;
  /** Display names (actor ids, or targets such as `obj:sut`), and the cast's terms (`LoadOptions`). */
  names = {};
  terms = {};
  frameFns = /* @__PURE__ */ new Set();
  pickAs = null;
  constructor(el, o) {
    this.el = el;
    this.kit = o.kit;
    this.maxDpr = o.maxDpr ?? 2;
    this.dim = o.dim ?? 1;
    this.lang = o.lang ?? { id: "und", speech: speechFallback, match: matchFallback };
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.motion = o.motion ?? (reduced ? "still" : "full");
    this.idleTimeout = this.idleTimeout0 = o.idleTimeout ?? 2e4;
    this.idleGap = this.idleGap0 = o.idleFps ? Math.max(0, 1e3 / o.idleFps - 4) : 0;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:manipulation";
    this.canvas.setAttribute("role", "img");
    let r = null;
    try {
      r = new PaperRenderer(this.canvas, { alpha: o.alpha });
    } catch (e) {
      console.warn("sahne: the paper stage needs WebGL2", e);
    }
    this.r = r;
    this.webgl = !!r;
    this.lines = o.bubbles !== false && o.bubbles !== "log";
    this.overlay = o.bubbles === false || !r ? null : new Overlay(el, { project: (p) => this.project(p), still: this.motion === "still", ...this.lang.id !== "und" ? { lang: this.lang.id } : {}, ...this.lang.dir ? { dir: this.lang.dir } : {} });
    this.gloss = o.gloss ?? null;
    if (o.glosses && this.gloss) this.overlay?.setGloss(this.gloss);
    this.audio = new AudioEngine(this.kit, { volumes: o.volumes, sounds: o.sounds, session: o.audioSession });
    this.voice = o.voice ?? null;
    this.captions = !!o.captions;
    if (o.sound) this.setSound(true);
    if (!r) return;
    el.append(this.canvas);
    r.onLost = () => {
      this.stop();
      o.onContext?.(true);
    };
    r.onRestore = () => {
      this.restoreArt();
      o.onContext?.(this.lost);
    };
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    if (typeof IntersectionObserver === "function") {
      this.io = new IntersectionObserver((es) => {
        this.visible = es.some((e) => e.isIntersecting);
        if (this.visible) this.kick();
        else this.stop();
      });
      this.io.observe(el);
    }
    document.addEventListener("visibilitychange", this.onVis);
    document.fonts?.addEventListener("loadingdone", this.onFonts);
    el.addEventListener("pointerdown", this.onDown);
    this.resize();
  }
  get aspect() {
    return this.canvas.width / Math.max(1, this.canvas.height);
  }
  /** The GPU took the drawing context away and it has not come back (see `StageOptions.onContext`): nothing shows, and a page can put an SVG still up meanwhile. */
  get lost() {
    return !!this.r && (this.r.lost || this.broken);
  }
  /** Whether the canvas can have a transparent background (`StageOptions.alpha`). */
  get alpha() {
    return !!this.r?.alpha;
  }
  /** Whether the stage is on screen now: a hidden tab or an element out of view draws nothing, and `setAvatar` waits for it. */
  get shown() {
    return this.visible && !document.hidden && !this.destroyed;
  }
  resize() {
    if (!this.r) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.cssW = Math.max(1, this.el.clientWidth);
    this.cssH = Math.max(1, this.el.clientHeight);
    const w = Math.max(1, Math.round(this.cssW * dpr)), h2 = Math.max(1, Math.round(this.cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h2) {
      this.canvas.width = w;
      this.canvas.height = h2;
      this.camCache = /* @__PURE__ */ new WeakMap();
      this.snapCam = true;
      this.render();
    }
  }
  // ---- Loading ----------------------------------------------------------------
  /** Build every place, actor and prop the script (and `extra`) can show, once; the atlas holds the cast and the place on stage and the next (`plan`). */
  load(script, o) {
    this.build(script, o, null, true);
  }
  build(script, o, studio, trusted) {
    const r = this.r;
    if (!r) return;
    const t0 = performance.now();
    this.script = script;
    this.places = o.places;
    this.atlasSize = o.atlas ?? 2048;
    this.studioCfg = studio;
    this.camBusy = false;
    this.snapCam = !!studio;
    this.idleTimeout = this.idleTimeout0;
    this.idleGap = this.idleGap0;
    this.sets.clear();
    this.propArt.clear();
    this.actors.clear();
    this.camCache = /* @__PURE__ */ new WeakMap();
    this.slotOwner = [];
    this.swaps.clear();
    this.perf = null;
    this.history = [];
    this.reactMemo = { samples: null, flights: /* @__PURE__ */ new Map() };
    this.ctx = {
      places: o.places,
      gestures: this.kit.gestures,
      lang: this.lang,
      narrator: o.narrator,
      tempo: o.tempo,
      rest: o.rest ? { ...o.rest } : {},
      heights: {},
      solids: Object.fromEntries(Object.entries(o.places).map(([id, pl]) => [id, placeSolids(pl, this.kit)])),
      soundWord: (id) => {
        const w = this.kit.sounds?.[id]?.word;
        return w ? w[this.lang.id] ?? w.en : void 0;
      },
      narratorSound: o.narratorSound && this.kit.sounds?.[o.narratorSound] ? { id: o.narratorSound, ms: Math.round(this.audio.length(o.narratorSound)) } : void 0
    };
    this.voices = o.voices ?? {};
    this.ar = null;
    this.ambientPlace = void 0;
    this.inset = o.narratorEl ? { el: o.narratorEl, who: o.narrator ?? "", onTalk: o.onNarratorTalk } : null;
    this.names = o.names ?? {};
    this.terms = o.terms ?? {};
    this.held = null;
    this.picks = [];
    for (const [id, doc] of Object.entries(o.cast)) {
      const a = this.makeActor(id, doc, trusted, o.wardrobe?.[id]);
      if (a) this.actors.set(id, a);
    }
    if (studio) studio.ref = this.refBody(this.actors.get(studio.id).puppet.avatar);
    for (const pid of scriptPlaces(script, o.extra)) {
      const place = o.places[pid];
      if (!place) {
        console.warn("sahne: no place", pid);
        continue;
      }
      this.sets.set(pid, this.makeSet(place));
    }
    this.perfs = directAll(script.cues, [...this.actors.keys()], this.ctx);
    const states = [];
    const scan = (perfs) => {
      for (const p of perfs) for (const s of [...Object.values(p.before.props), ...Object.values(p.after.props), ...p.props.map((e) => e.state)]) if (s) states.push([s, p.after.place ?? ""]);
    };
    scan(this.perfs);
    for (const b of o.extra ?? []) {
      const w = b.at > 0 ? this.perfs[b.at - 1]?.after : void 0;
      scan(w ? this.directFrom(w, b.cues, b.at) : directAll([...script.cues.slice(0, b.at), ...b.cues], [...this.actors.keys()], this.ctx));
    }
    const drags = new Set([...script.cues, ...(o.extra ?? []).flatMap((b) => b.cues)].flatMap((c) => "act" in c && c.act.kind === "drag" ? [c.act.obj ?? c.act.targets.find((t) => t.startsWith("obj:"))?.slice(4) ?? ""] : []));
    for (const [s0, pl] of [...states]) if (drags.has(s0.of)) states.push([{ ...s0, holder: void 0 }, pl], [{ ...s0, holder: { actor: "", side: "r" } }, pl]);
    for (const [s0, pl] of [...states]) if (typeof s0.n === "number") for (let n = 1; n < s0.n; n++) for (const holder of [void 0, { actor: "", side: "r" }]) states.push([{ ...s0, n, holder }, pl]);
    for (const [s, pl] of states) this.propLook(s, pl);
    r.newFaces(faceSlots([...this.actors.values()].filter((a) => a.puppet.faceRegion).length));
    this.rasterise();
    this.stats.atlasMs = Math.round(performance.now() - t0);
    if (this.soundOn) this.prepareAudio();
    if (this.perfs.length) this.show(0);
  }
  /** A place's set: its pieces drawn into flats (no pixels yet) and its lamps, each piece on its own seed (`pieceSeed`). */
  makeSet(place) {
    const set = { flats: [], lamps: [], emitters: [] };
    for (const { p, out } of drawPieces(place, this.kit)) {
      for (const s of out.flats) {
        const lift = s.move?.path ? Math.max(...s.move.path.pts.map((q) => q[1])) / 100 : 0;
        const under = !s.pitch && !s.sky && (p.y ?? 0) + lift + ((s.y ?? 0) - groupBounds(s.group)[1]) / 100 < -0.05;
        const fl = { ...this.makeFlat(s, [p.x, p.y ?? 0, p.z], p.id), ...p.in ? { in: p.in } : {}, ...under ? { under } : {}, sw: p.switch !== false && s.switch !== false };
        set.flats.push(fl);
        const ts = this.textFlat(s);
        if (ts) set.flats.push({ ...this.makeFlat(ts, [p.x, p.y ?? 0, p.z], p.id), ...p.in ? { in: p.in } : {}, ...under ? { under } : {}, sw: fl.sw, base: fl });
      }
      for (const l of out.lights ?? []) set.lamps.push({ pos: [p.x + l.x / 100, (p.y ?? 0) + l.y / 100, p.z + l.z / 100], spec: l, ...p.in ? { in: p.in } : {}, sw: p.switch !== false && l.switch !== false });
      for (const [k, e] of (out.emitters ?? []).entries()) set.emitters.push({ pos: [p.x + e.x / 100, (p.y ?? 0) + e.y / 100, p.z + (e.z ?? 5) / 100], spec: e, ...p.in ? { in: p.in } : {}, seed: `${pieceSeed(place, p)}|e${k}` });
    }
    return set;
  }
  /**
   * An actor from its document: the puppet and what its drawing needs, with no pixels yet (`rasterise`). `compose` never throws: a document it cannot use draws the kit's default character.
   * Each of its `wardrobe` is composed with the cast document's body, skin, face, hair, facial hair and custom parts, so the bones, height and face are the actor's own.
   * A `{ puppet }` is built by the kit (`Kit.puppets`); an unknown one is a warning and null (the actor is left out, the story plays).
   */
  makeActor(id, doc, trusted, wardrobe = {}) {
    const dress = (puppet) => {
      const altDefault = {};
      for (const it of [...puppet.views.front, ...puppet.views.back, ...puppet.side?.items ?? []]) if (it.alt?.default) altDefault[it.alt.key] = it.alt.value;
      return { puppet, rects: /* @__PURE__ */ new Map(), altDefault };
    };
    const kp = "puppet" in doc ? this.kit.puppets?.[doc.puppet]?.(this.kit) : void 0, costumes = /* @__PURE__ */ new Map();
    let me;
    if (kp) {
      me = dress(kp);
      (this.ctx.puppets ??= {})[id] = { kind: kp.kind, gestures: kp.gestures };
    } else if ("puppet" in doc) {
      console.warn("sahne: no puppet", doc.puppet, id);
      return null;
    } else {
      me = dress(compose(doc, this.kit, { trusted }));
      const { body, skin, face, hair, facialHair, custom } = me.puppet.avatar;
      for (const [k, w] of Object.entries(wardrobe)) {
        try {
          costumes.set(k, dress(compose({ ...w, body, skin, face, hair, facialHair, custom }, this.kit, { trusted })));
        } catch (e) {
          console.warn("sahne: costume not applied", id, k, e);
        }
      }
    }
    this.ctx.heights[id] = me.puppet.body.H / 100;
    return { id, ...me, kit: kp, costumes, slot: -1, drawnFace: "", face: faceFrom(void 0), grips: {}, key: JSON.stringify(kp ? doc : me.puppet.avatar), ver: 0 };
  }
  /**
   * Draw the art into a new atlas: the actors' (the hand shapes the pose does not use and the back
   * view wait until they are needed), and the sets and props of the places `want` names (the one on
   * stage and the next, `want()`). Everything that holds a rect is pointed at the new ones in one go
   * once the atlas is sent, so a frame never sees half of the old atlas and half of the new. The art
   * itself stays in memory, which is how a lost context is restored (`restoreArt`). A piece too large
   * for a small atlas (`LoadOptions.atlas`) makes it a 2048 one, once and for good. With `bg` nothing
   * is drawn yet: the step returned paints until a time, and swaps the atlas in once all is painted and `go`.
   */
  rasterise(want = this.want(), bg = false) {
    if (!bg) {
      clearTimeout(this.preT);
      this.job = "";
    }
    try {
      return this.rasteriseAt(this.atlasSize, want, bg);
    } catch (e) {
      if (this.atlasSize >= 2048) throw e;
      this.atlasSize = 2048;
      return this.rasteriseAt(2048, want, bg);
    }
  }
  rasteriseAt(size, want, bg) {
    const r = this.r, atlas = new Atlas(r.gl, size), bind = [];
    atlas.hook = this.studioCfg ? null : this.atlasHook;
    for (const a of this.actors.values()) {
      const seen = /* @__PURE__ */ new Map();
      for (const c of [a, ...a.costumes.values()]) {
        const rects = /* @__PURE__ */ new Map();
        bind.push(() => c.rects = rects);
        for (const [v, items] of [["front", c.puppet.views.front], ["back", c.puppet.views.back], ["side", c.puppet.side?.items ?? []]]) for (const it of items) {
          if (!it.group) continue;
          const k = a.costumes.size ? JSON.stringify([it.group, it.ppcm]) : it;
          let rect2 = seen.get(k);
          if (!rect2) seen.set(k, rect2 = atlas.add(it.group, it.ppcm ?? 5, c !== a || v !== "front" || !!it.alt && !it.alt.default));
          rects.set(it, rect2);
        }
      }
    }
    for (const pid of want) for (const fl of this.sets.get(pid).flats) {
      const s = fl.spec, rect2 = atlas.add(s.group, s.ppcm ?? 1.6), glow = s.emissive && atlas.add(s.emissive, s.glowPpcm ?? s.ppcm ?? 1.6), b = rect2.box;
      bind.push(() => {
        fl.rect = rect2;
        fl.glow = glow;
        fl.center = at3(fl.O, fl.R, fl.D, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
      });
    }
    for (const art of this.propArt.values()) {
      const cells = (g, glow = false) => want.some((p) => art.at.has(p)) ? art.specs.map((f) => {
        const x = g(f);
        return x && atlas.add(x, (glow ? f.glowPpcm : void 0) ?? f.ppcm ?? 1.6);
      }) : [];
      const rects = cells((f) => f.group), glows = cells((f) => f.emissive, true), ghosts = cells((f) => ghostOf(f.group));
      bind.push(() => Object.assign(art, { rects, glows, ghosts }));
    }
    atlas.pack();
    const swap = () => {
      this.res = [];
      r.use(atlas);
      for (const f of bind) f();
      this.res = want;
      this.stats.layers = atlas.layers;
      this.stats.places = [...want];
      this.stats.texKB = Math.round(r.textureBytes / 1024);
      this.warm();
    };
    if (!bg) {
      atlas.paint();
      swap();
      return;
    }
    return (until, go) => atlas.paint(until) && go && (swap(), true);
  }
  /** The places whose art the atlas holds: the one on stage (or first) and the next the script goes to. */
  want() {
    const p = this.perf ?? this.perfs[0], here = p?.after.place;
    return [here, p && this.perfs.slice(p.cue + 1).find((q) => q.after.place !== here)?.after.place].filter((x) => x && this.sets.has(x));
  }
  /** Keep the atlas to `want()` after a cue or a jump: a change is drawn in idle time, a few ms a task, and swapped in when done; the old place goes with it (DESIGN.md §6.2). */
  plan() {
    const w = this.want(), key = w.join();
    if (!this.r || key === this.res.join() || key === this.job) return;
    clearTimeout(this.preT);
    this.job = key;
    let step;
    const run2 = () => {
      const p = this.perf;
      if (this.job !== key || this.r.lost || this.destroyed) return;
      try {
        if (!(step ??= this.rasterise(w, true))(performance.now() + 8, !p || this.pausedAt !== null || this.now() >= p.dur)) {
          this.preT = setTimeout(run2, 16);
          return;
        }
        this.render();
      } catch (e) {
        console.warn("sahne: could not draw the next place", e);
      }
      this.job = "";
    };
    this.preT = setTimeout(run2, 80);
  }
  /** Draw the backs and the costumes soon after a rebuild, in tasks of their own (a few ms each): the rebuild stays short, and a flip does not stall. */
  warm() {
    clearTimeout(this.warmT);
    const step = () => {
      this.warmT = 0;
      const r = this.r;
      if (!r || r.lost || this.destroyed) return;
      const until = performance.now() + 8;
      for (const a of this.actors.values()) for (const c of [a, ...a.costumes.values()]) for (const [it, rect2] of c.rects) {
        if (!rect2.lazy || it.alt) continue;
        r.atlas.ensure(rect2);
        if (performance.now() > until) {
          this.warmT = setTimeout(step, 16);
          return;
        }
      }
    };
    this.warmT = setTimeout(step, 80);
  }
  /** The flats that are a flat's words (`textFlat`). */
  texted = /* @__PURE__ */ new WeakSet();
  /**
   * A flat's words (`FlatSpec.text`) as a flat of their own (DESIGN.md §6.8): painted into the atlas at a resolution that keeps
   * the smallest of them about `TEXT_PX` pixels tall, in the page's `--sahne-text-<font>`, and drawn just over the flat, so
   * whatever stands nearer covers them and they take the scene's light as the paper does. Untappable: the flat under it is the target.
   */
  textFlat(s) {
    if (!s.text?.length) return null;
    const css = typeof getComputedStyle === "function" && this.el.isConnected ? getComputedStyle(this.el) : null;
    const family2 = (f) => f && css?.getPropertyValue(`--sahne-text-${f}`).trim() || css?.fontFamily || "system-ui, sans-serif";
    const small = Math.min(...s.text.map((t2) => t2.size ?? t2.h * 0.45));
    const span = Math.max(Math.max(...s.text.map((t2) => t2.x + t2.w)) - Math.min(...s.text.map((t2) => t2.x)), Math.max(...s.text.map((t2) => t2.y + t2.h)) - Math.min(...s.text.map((t2) => t2.y)));
    const ppcm = Math.max(s.ppcm ?? 1.6, Math.min(TEXT_PX / Math.max(0.1, small), 24, 1800 / Math.max(1, span)));
    const t = {
      ...s,
      group: { shapes: [], edge: 0, text: s.text.map((x) => ({ text: x.text, x: x.x, y: x.y, w: x.w, h: x.h, size: x.size, color: x.color, align: x.align, weight: x.weight, family: family2(x.font) })) },
      ppcm,
      emissive: void 0,
      glowPpcm: void 0,
      shadow: "none",
      text: void 0,
      pick: false,
      lit: s.text[0].lit ?? s.lit
    };
    this.texted.add(t);
    this.hasText = true;
    return t;
  }
  /** Some flat has words: the art is painted again once the page's fonts have loaded (`onFonts`). */
  hasText = false;
  onFonts = () => {
    if (!this.hasText || !this.r || this.r.lost || this.destroyed || !this.res.length) return;
    try {
      this.rasterise(this.res);
      this.poke();
    } catch (e) {
      console.warn("sahne: could not repaint the words", e);
    }
  };
  makeFlat(s, origin, piece) {
    const yaw = s.yaw ?? 0, pitch = s.pitch ?? 0, { R: R3, D } = axes(yaw, pitch);
    const O = [origin[0] + (s.x ?? 0) / 100, origin[1] + (s.y ?? 0) / 100, origin[2] + (s.z ?? 0) / 100];
    return {
      spec: s,
      rect: NO_RECT,
      O,
      R: R3,
      D,
      yaw,
      pitch,
      lit: s.lit ?? 1,
      shadow: s.shadow === "drop",
      floor: Math.abs(pitch + Math.PI / 2) < 0.01,
      center: O,
      piece,
      hinge: s.hinge,
      swing: s.swing
    };
  }
  /** The context came back after a loss: the atlases are empty, so draw them again. */
  restoreArt() {
    if (this.destroyed || !this.r) return;
    this.broken = false;
    try {
      this.rasterise();
    } catch (e) {
      console.warn("sahne: could not restore the art", e);
      this.broken = true;
      return;
    }
    for (const a of this.actors.values()) a.drawnFace = "";
    this.render();
    this.kick();
  }
  // ---- Studio: one actor alone, for the avatar builder's preview (DESIGN.md §10) -------------------
  /**
   * Show `doc` alone in a studio instead of a script: framed head to toe, as a bust or as a head
   * (`setFraming`), in the light of a time of day, over the sky, a plain wall or nothing at all (a
   * transparent canvas, with `StageOptions.alpha`). Idle life runs for as long as the stage is
   * visible. Returns the actor's id, which the other calls below take. Replaces whatever was loaded.
   */
  studio(doc, o = {}) {
    const id = o.id ?? STUDIO_ID;
    if (!this.r || this.notDoc(doc)) return id;
    const backdrop = this.backdropFor(o.backdrop ?? "sky");
    if (o.label) this.canvas.setAttribute("aria-label", o.label);
    const script = { v: 1, cues: [{ scene: { place: "studio", time: o.time ?? "day", at: { [id]: "here" }, cam: "wide" } }] };
    const cfg = { id, framing: o.framing ?? "full", backdrop };
    this.build(script, { cast: { [id]: doc }, places: { studio: studioPlace(backdrop) }, atlas: 1024 }, cfg, !!o.trusted);
    this.idleTimeout = o.idle ?? Infinity;
    if (!this.idleGap) this.idleGap = 1e3 / 30 - 4;
    this.poke();
    return id;
  }
  /** "none" is a transparent canvas, which only a stage made with `alpha` has; any other draws the sky. */
  backdropFor(b) {
    if (b !== "none" || this.r?.alpha) return b;
    console.warn('sahne: backdrop "none" needs a stage made with alpha: true; drawing the sky');
    return "sky";
  }
  /** The tallest body of the document's build: the studio frames full-length views for it, so a taller body fills more of the frame. Pass a normalized document. */
  refBody(doc) {
    return bodyDims(this.kit.body({ ...doc.body, height: 1 }));
  }
  /** Change how much of the actor shows; the camera eases there. */
  setFraming(f) {
    if (!this.studioCfg || this.studioCfg.framing === f) return;
    this.studioCfg.framing = f;
    this.poke();
    this.render();
  }
  /** Change what shows behind the actor. The wall and floor are set pieces, so the art is drawn again; the performance (mood, turn, idle life) goes on. */
  setBackdrop(b) {
    const c = this.studioCfg, was = c?.backdrop;
    if (!c || !this.r) return;
    b = this.backdropFor(b);
    if (was === b) return;
    c.backdrop = b;
    if (b === "wall" || was === "wall") {
      const put2 = (bd) => {
        const place = studioPlace(bd);
        this.places.studio = place;
        this.sets.set("studio", this.makeSet(place));
        this.rasterise();
      };
      try {
        put2(b);
      } catch (e) {
        console.warn("sahne: backdrop not applied", e);
        c.backdrop = was;
        try {
          put2(was);
        } catch (e2) {
          console.warn("sahne: could not restore the backdrop", e2);
        }
      }
    }
    this.poke();
    this.render();
  }
  /**
   * Swap an actor's look live, without a restart: whatever the actor is doing (a gesture, a mood,
   * a turn, idle life) goes on. Calls are queued for the next frame and the last one wins, so a
   * learner scrubbing through options costs one rebuild per frame at most; each rebuild draws the
   * actor's art again in a few ms (the back and the hand shapes the pose does not use are drawn when
   * needed). The document goes through `compose`, which never throws: one it cannot use draws the
   * kit's default character. `trusted` is false unless said otherwise, whatever the actor wore
   * before: pass `true` only for the app's own cast. The promise resolves when the look (or a later
   * one) is built, and the next frame draws it; it never rejects. A stage that cannot draw now (a
   * hidden tab, a panel scrolled out of view, a lost context; see `shown` and `lost`) takes the
   * look at once: the promise resolves, and the look is built and drawn when the stage can draw
   * again. On a story stage the whole scene's art is drawn again, so this is for a lone actor, not
   * a crowd.
   */
  setAvatar(id, doc, o = {}) {
    if (!this.r || this.destroyed || this.notDoc(doc, this.actors.get(id)?.kit)) return Promise.resolve();
    const done = this.swaps.put(id, { doc, trusted: !!o.trusted }, this.shown && !this.r.lost);
    this.poke();
    return done;
  }
  /** A kit puppet is not an avatar: neither swapped in nor out, nor shown in the studio (a warning). */
  notDoc(doc, kp) {
    const no = !!kp || "puppet" in doc;
    if (no) console.warn("sahne: a kit puppet has no avatar");
    return no;
  }
  /** Apply the queued swaps (once per frame); the ms it took, 0 if there were none. */
  applySwaps() {
    const r = this.r;
    if (!r || r.lost || !this.swaps.size) return 0;
    const t0 = performance.now();
    this.swaps.drain((id, q) => this.swap(id, q.doc, q.trusted));
    return Math.max(performance.now() - t0, 1e-3);
  }
  swap(id, doc, trusted) {
    const old = this.actors.get(id);
    if (!old) {
      console.warn("sahne: no actor", id);
      return;
    }
    const t0 = performance.now(), wasH = this.ctx.heights[id];
    let next;
    try {
      next = this.makeActor(id, doc, trusted);
    } catch (e) {
      console.warn("sahne: avatar not applied", e);
      return;
    }
    if (!next || next.key === old.key) {
      this.ctx.heights[id] = wasH;
      return;
    }
    const was = { puppet: old.puppet, altDefault: old.altDefault, rects: old.rects, costumes: old.costumes, key: old.key, drawnFace: old.drawnFace, ver: old.ver, dims: old.dims };
    const cfg = this.studioCfg, wasRef = cfg?.ref;
    Object.assign(old, { puppet: next.puppet, altDefault: next.altDefault, rects: next.rects, costumes: next.costumes, key: next.key, drawnFace: "", ver: old.ver + 1, dims: void 0 });
    this.camCache = /* @__PURE__ */ new WeakMap();
    if (cfg?.id === id) cfg.ref = this.refBody(next.puppet.avatar);
    try {
      this.rasterise();
    } catch (e) {
      console.warn("sahne: avatar not applied", e);
      Object.assign(old, was);
      this.ctx.heights[id] = wasH;
      if (cfg && wasRef) cfg.ref = wasRef;
      try {
        this.rasterise();
      } catch (e2) {
        console.warn("sahne: could not restore the old look", e2);
      }
      return;
    }
    this.stats.swapMs = +(performance.now() - t0).toFixed(2);
    this.stats.swaps++;
  }
  /** Make an actor feel `emo` and stay that way (the builder's emotion strip); "neutral" returns to rest. */
  mood(id, emo = "neutral") {
    if (!this.r) return NO_RUN;
    this.ctx.rest[id] = emo;
    return this.act({ beat: { who: id, emo } });
  }
  /** Play a gesture by name. One that points at something aims at the studio's `aside` mark (up and to the side, clear of the face), or at the viewer on a story stage, unless `at` says otherwise. */
  gesture(id, name, o = {}) {
    if (!this.r) return NO_RUN;
    const aim3 = (this.actors.get(id)?.kit ?? this.kit).gestures[name]?.needs?.includes("target") ? this.studioCfg ? "mark:aside" : "viewer" : void 0;
    return this.act({ beat: { who: id, do: name, at: o.at ?? aim3, n: o.n, loop: o.loop } });
  }
  /** Show the actor's back, or turn to the front again if it is showing the back (the builder's turn button). */
  flip(id) {
    if (!this.r) return NO_RUN;
    const a = this.world().actors[id];
    if (!a) {
      console.warn("sahne: no actor", id);
      return NO_RUN;
    }
    return this.turnTo(id, Math.cos(a.yaw) >= 0 ? Math.PI : 0);
  }
  // ---- Playing ----------------------------------------------------------------
  /** The world after cue `i`, with no performance. */
  show(i) {
    const p = this.perfs[i];
    if (!p || !this.r) return;
    this.finishRun();
    this.quiet();
    this.ar = null;
    this.perf = p;
    this.camFrom = null;
    this.onStage(p);
    this.t0 = performance.now() - p.dur;
    this.pausedAt = null;
    this.placeSound();
    this.plan();
    this.poke();
    this.render();
  }
  /** Perform cue `i` from the world cue `i − 1` left. */
  play(i) {
    if (!this.r) return NO_RUN;
    const p = this.perfs[i];
    if (!p) throw new Error(`sahne: no cue ${i}`);
    const c = this.script.cues[i];
    if (this.interaction && c && "act" in c && !c.act.result) return this.interaction.play(i);
    return this.start(p);
  }
  /** Perform a performance made off the script (`direct`, `glance`). */
  perform(p) {
    if (!this.r) return NO_RUN;
    this.adopt(p);
    return this.start(p);
  }
  /** Direct a cue from a world (default: the one on stage now) without performing it. */
  direct(cue, w = this.world(), i = w.i + 1) {
    return direct(w, cue, i, this.ctx);
  }
  /** Actors glance at a target, and `point` points at it, from the world on stage (an act's hint); nothing else changes. */
  glance(ids, at4, point) {
    if (!this.r) return NO_RUN;
    const w = this.world();
    return this.start(glance(w, w.i, this.ctx, ids, at4, point));
  }
  /** The place on stage now. */
  get place() {
    const id = this.perf?.after.place;
    return id ? this.places[id] ?? null : null;
  }
  /** Call `fn` after every frame drawn (the interaction layer follows the camera); returns a function that stops it. */
  onFrame(fn) {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }
  /** The size of the stage in CSS pixels (for a ray through a point of it). */
  get cssSize() {
    return [this.cssW, this.cssH];
  }
  /**
   * Perform a cue that is not in the script (a gallery button, a reaction), from the world on stage now.
   * A place or a prop's look it reaches that the script never does is drawn first (once, at once).
   */
  act(cue) {
    if (!this.r) return NO_RUN;
    const w = this.world();
    const p = direct(w, cue, w.i + 1, this.ctx);
    this.adopt(p);
    return this.start(p);
  }
  /** Whatever a performance shows that the atlas has no art for (a place, a prop's look): made and drawn now. */
  adopt(p) {
    let more = false;
    for (const pid of [p.before.place, p.after.place]) {
      if (!pid || this.sets.has(pid)) continue;
      const place = this.places[pid];
      if (!place) {
        console.warn("sahne: no place", pid);
        continue;
      }
      this.sets.set(pid, this.makeSet(place));
      more = true;
    }
    const pl = p.after.place ?? "";
    for (const s of [...Object.values(p.before.props), ...Object.values(p.after.props), ...p.props.map((e) => e.state)]) if (s && this.propLook(s, pl)) more = true;
    if (!more) return;
    try {
      this.rasterise();
    } catch (e) {
      console.warn("sahne: could not draw what the cue shows", e);
    }
  }
  /** A prop's look (its kit, params, count and whether it is held) in a place: drawn into flats once; true when it is new there. */
  propLook(s, pl) {
    const key = artKey(s), had = this.propArt.get(key);
    if (had) {
      if (had.at.has(pl)) return false;
      had.at.add(pl);
      return true;
    }
    const def = pieceOf(this.kit, "props", s.kit);
    if (!def) {
      console.warn("sahne: no prop", s.kit);
      return false;
    }
    const out = def.draw(withVariant(def, { ...s.params, n: s.n, held: !!s.holder }), rng(s.of), this.kit);
    this.propArt.set(key, { specs: out.flats.flatMap((f) => {
      const t = this.textFlat(f);
      return t ? [f, t] : [f];
    }), rects: [], glows: [], ghosts: [], at: /* @__PURE__ */ new Set([pl]), ...out.emitters?.length ? { emitters: out.emitters } : {} });
    return true;
  }
  /** Turn an actor to `yaw` (a paper flip past ±π/2): a gallery control, not a script field. */
  turnTo(id, yaw) {
    if (!this.r) return NO_RUN;
    const w = this.world(), after = cloneWorld(w);
    if (!after.actors[id]) throw new Error(`sahne: no actor ${id}`);
    after.actors[id].yaw = yaw;
    const tr = emptyTrack();
    tr.turns.push({ t: 0, yaw, dur: 520 });
    return this.start({ cue: w.i, dur: 600, before: w, after, tracks: { [id]: tr }, props: [], cams: [], bubbles: [], doors: [], times: [], sounds: [{ t: 260, id: "paper_flip", at: "ch:" + id, auto: true }], lines: [] });
  }
  /** Replace the cues from `i` on (a choice picked its branch). Their art must be loaded (`extra`). */
  setCues(i, cues) {
    this.script = { ...this.script, cues: [...this.script.cues.slice(0, i), ...cues] };
    const before = i > 0 ? this.perfs[i - 1].after : null;
    const rest = before ? this.directFrom(before, cues, i) : directAll(this.script.cues, [...this.actors.keys()], this.ctx);
    this.perfs = before ? [...this.perfs.slice(0, i), ...rest] : rest;
    this.plan();
  }
  directFrom(w, cues, i) {
    const out = [];
    cues.forEach((c, k) => {
      const p = direct(w, c, i + k, this.ctx);
      out.push(p);
      w = p.after;
    });
    return out;
  }
  /** The world as it stands (or will stand, when the running cue ends). */
  world() {
    return this.perf ? cloneWorld(this.perf.after) : cloneWorld(this.perfs[0]?.before ?? { i: -1, place: null, time: "day", actors: {}, props: {}, shot: { kind: "wide", ids: [], objs: [] } });
  }
  start(p) {
    this.finishRun();
    this.quiet();
    this.camFrom = this.perf && this.perf.after.place === p.before.place ? { ...this.cam } : null;
    this.perf = p;
    this.onStage(p);
    this.t0 = performance.now();
    this.pausedAt = null;
    this.ar = { perf: p, fired: p.sounds.map(() => false), said: p.lines.map(() => false), real0: this.t0 };
    this.poke();
    let resolve;
    const done = new Promise((r) => {
      resolve = r;
    });
    this.resolveDone = resolve;
    if (this.motion === "still") this.t0 -= p.dur;
    this.placeSound();
    this.plan();
    this.pump();
    this.kick();
    const stage = this;
    return {
      cue: p.cue,
      dur: p.dur,
      done,
      get t() {
        return stage.now();
      },
      finish: () => {
        if (stage.perf === p) {
          stage.skipTo(p.dur);
          stage.t0 = performance.now() - p.dur;
          stage.pausedAt = null;
          stage.kick();
        }
      },
      seek: (t) => {
        if (stage.perf === p) {
          stage.skipTo(t);
          stage.t0 = performance.now() - t;
          if (stage.pausedAt !== null) stage.pausedAt = performance.now();
          stage.render();
        }
      },
      pause: () => {
        if (stage.perf === p && stage.pausedAt === null) {
          stage.endSpeech();
          stage.pausedAt = performance.now();
          stage.skipTo(stage.now());
        }
      },
      resume: () => {
        if (stage.perf === p && stage.pausedAt !== null) {
          stage.t0 += performance.now() - stage.pausedAt;
          stage.pausedAt = null;
          stage.pump();
          stage.kick();
        }
      }
    };
  }
  // ---- Sound --------------------------------------------------------------------------------
  /** Turn sound on (from a tap: browsers start audio only after one) or off. */
  setSound(on) {
    if (on === this.soundOn) return;
    this.soundOn = on;
    this.audio.setEnabled(on);
    if (on) {
      this.prepareAudio();
      if (this.ar) this.skipTo(this.now());
      this.ambientPlace = void 0;
      this.placeSound();
      this.pump();
    } else {
      this.quiet();
      this.voice?.cancel();
    }
    this.render();
  }
  /** Sound words as bubbles while sound is on. */
  setCaptions(on) {
    this.captions = on;
    this.render();
  }
  setVolume(bus, v) {
    this.audio.setVolume(bus, v);
  }
  /** Render the sounds the loaded script uses, a little at a time. */
  prepareAudio() {
    const list = [];
    for (const p of this.perfs) for (const s of p.sounds) list.push(s.music ? s.id : { id: s.id, params: s.params });
    for (const pl of Object.values(this.places)) {
      list.push(...pl.ambience ?? [], { id: "step", params: pl.surface ? { surface: pl.surface } : void 0 });
      for (const { out } of drawPieces(pl, this.kit)) for (const fs of out.flats) if (fs.react?.tap?.sound) list.push(fs.react.tap.sound);
      if (pl.motif) list.push(pl.motif);
    }
    list.push("door_open", "door_close", "paper_flip");
    this.audio.prepare(list);
  }
  /** The ambience of the place on stage. */
  placeSound() {
    const place = this.perf?.after.place ?? null, weather = this.perf?.after.weather, key = `${place}|${weather ?? ""}`;
    if (key === this.ambientPlace) return;
    this.ambientPlace = key;
    const bed = WEATHER[weather ?? ""]?.bed, beds = place ? this.places[place]?.ambience ?? [] : [];
    this.audio.ambience(bed && this.kit.sounds?.[bed] && !beds.includes(bed) ? [...beds, bed] : beds);
  }
  /** Stop the voice and whatever is scheduled for later: the performance is being replaced or skipped. */
  quiet() {
    this.endSpeech();
    this.audio.stopPending();
  }
  /** Jump the sound to `t`: what lies before it is skipped, not played late. */
  skipTo(t) {
    this.quiet();
    const ar = this.ar;
    if (!ar) return;
    ar.perf.sounds.forEach((s, k) => {
      ar.fired[k] = s.t < t;
    });
    ar.perf.lines.forEach((l, k) => {
      ar.said[k] = l.t0 < t;
    });
  }
  /** The sound's own time: the stage's, except in Still, where the picture is the end pose and the sound runs from the start. */
  audioNow() {
    return this.motion === "still" && this.ar ? performance.now() - this.ar.real0 : this.now();
  }
  /** Play what is due: sounds a little ahead on the audio clock, lines as their time comes. */
  pump() {
    const p = this.perf, ar = this.ar;
    if (!p || !ar || ar.perf !== p || !this.soundOn || this.pausedAt !== null) {
      if (this.pumpTimer) clearInterval(this.pumpTimer);
      this.pumpTimer = 0;
      return;
    }
    const t = this.audioNow(), still = this.motion === "still";
    p.lines.forEach((line, k) => {
      if (ar.said[k] || line.t0 > t + 15 || this.speech) return;
      ar.said[k] = true;
      if (t < line.t0 + 800) this.speakLine(line);
    });
    const LOOK2 = 150, next = p.lines.find((l, k) => !ar.said[k])?.t0 ?? Infinity;
    for (let k = 0; k < p.sounds.length; k++) {
      const s = p.sounds[k];
      if (ar.fired[k]) continue;
      if (s.t > t + LOOK2) break;
      if ((this.speech || s.t > next) && s.t > t) continue;
      ar.fired[k] = true;
      if (s.t < t - 250 || still && s.auto) continue;
      const when = this.audio.time + Math.max(0, s.t - t) / 1e3;
      if (s.music) this.audio.motif(s.id, { when });
      else this.audio.play(s.id, { when, pan: this.panOf(s.at), params: s.params });
    }
    if (this.resolveDone && this.now() >= p.dur) this.finishRun();
    const busy = !!this.speech || !!this.resolveDone || ar.said.some((x) => !x) || ar.fired.some((x) => !x);
    if (busy && !this.pumpTimer) this.pumpTimer = setInterval(() => this.pump(), 40);
    if (!busy && this.pumpTimer) {
      clearInterval(this.pumpTimer);
      this.pumpTimer = 0;
    }
  }
  /** Left or right in the frame, for a sound from a target. */
  panOf(at4) {
    const f = this.frame, p = at4 && f ? this.point(at4, f) : null, q = p ? this.project(p) : null;
    return q ? clamp(q[0] / this.cssW * 2 - 1, -1, 1) * 0.6 : 0;
  }
  speakLine(line) {
    const v = this.voice;
    if (!v || !v.available(this.lang.id) || this.audio.volumes.voice <= 0) return;
    const clock = this.motion === "still" ? null : new SpeechClock(line.t0, line.words, line.t1 - line.t0);
    const s = { line, clock, handle: null };
    this.speech = s;
    this.audio.duck(true);
    let guard = 0;
    const done = () => {
      clearTimeout(guard);
      if (this.speech !== s) return;
      clock?.end(performance.now());
      this.releaseSpeech();
      this.pump();
    };
    guard = setTimeout(done, 2500);
    const handle = v.speak(line.text, {
      lang: this.lang.id,
      who: line.who,
      spec: this.voices[line.who],
      rate: line.rate,
      whisper: line.whisper,
      volume: this.audio.volumes.voice,
      out: this.audio.voiceOut,
      onStart: () => {
        clock?.start(performance.now());
        clearTimeout(guard);
        guard = setTimeout(done, (line.t1 - line.t0) * 2.5 + 3e3);
        this.kick();
      },
      onWord: (i) => {
        clock?.word(i, performance.now());
        this.kick();
      },
      onEnd: done
    });
    if (!handle) {
      clearTimeout(guard);
      if (this.speech === s) {
        this.speech = null;
        this.audio.duck(false);
      }
      return;
    }
    s.handle = handle;
  }
  /** The voice let go of the clock: time runs on from where the voice left it. */
  releaseSpeech() {
    const s = this.speech;
    if (!s) return;
    this.speech = null;
    if (s.clock) {
      const real = this.pausedAt ?? performance.now();
      this.t0 = real - s.clock.at(real);
    }
    this.audio.duck(false);
    this.kick();
  }
  /** Cut the voice off, leaving the clock where it is. */
  endSpeech() {
    const s = this.speech;
    if (!s) return;
    this.releaseSpeech();
    s.handle?.cancel();
  }
  finishRun() {
    if (this.resolveDone) {
      const r = this.resolveDone;
      this.resolveDone = null;
      r();
    }
  }
  /** Ms into the current performance (while a line is voiced, the voice's clock). */
  now() {
    const real = this.pausedAt ?? performance.now();
    return this.speech?.clock ? this.speech.clock.at(real) : real - this.t0;
  }
  /** Lines as bubbles (theatre mode) or not (log mode), without rebuilding the stage; the next cue frames for it. A stage made
   * with `bubbles: false` has no overlay, and this does nothing. */
  // bubbleIds becomes one no list makes ("" is the empty list's), so the next frame sets the overlay even when it is left empty
  setBubbles(on) {
    if (this.lines === on) return;
    this.lines = on;
    this.bubbleIds = "\0";
    this.poke();
  }
  /** Turn tap-to-translate on the bubbles on or off (it needs `gloss` in the options). */
  setGlosses(on) {
    this.overlay?.setGloss(on ? this.gloss : null);
  }
  setMotion(m) {
    this.motion = m;
    this.overlay?.setStill(m === "still");
    this.poke();
  }
  /** Input happened: idle life wakes up again. */
  poke() {
    this.lastInput = performance.now();
    this.kick();
  }
  kick() {
    if (!this.raf && this.r && !this.destroyed && this.visible && !document.hidden) this.raf = requestAnimationFrame(() => this.tick());
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  idleAmount() {
    if (this.motion === "still") return 0;
    const since = performance.now() - this.lastInput;
    return since > this.idleTimeout ? 0 : this.motion === "calm" ? 0.5 : 1;
  }
  /** A place whose life never pauses on stage (`life: "run"`, a vehicle). */
  running() {
    const id = this.perf?.after.place;
    return !!id && this.places[id]?.life === "run";
  }
  /**
   * How fast the place's own clock runs (DESIGN.md §6.9): held in Still; else at the motion's pace while
   * a cue plays, a line is voiced or the place runs (a vehicle's view keeps moving), and otherwise with
   * idle life, which stops a while after the last input.
   */
  lifeRate() {
    if (this.motion === "still") return 0;
    const p = this.perf;
    if (this.running() || this.speech || p && this.now() < p.dur) return this.motion === "calm" ? 0.5 : 1;
    return this.idleAmount();
  }
  tick() {
    this.raf = 0;
    const p = this.perf, now = performance.now();
    const gap = this.idleGap || (this.running() ? 1e3 / 30 - 4 : 0);
    if (gap && p && !this.swaps.size && !this.camBusy && !this.looping && !this.speech && this.now() >= p.dur + 50 && now - this.lastDraw < gap) {
      this.kick();
      return;
    }
    this.lastDraw = now;
    this.pump();
    if (!this.built && this.applySwaps() > 20) {
      this.built = true;
      this.lastDraw = 0;
      this.kick();
      return;
    }
    this.built = false;
    this.render();
    if (!p) return;
    const t = this.now();
    if (t >= p.dur && this.resolveDone) this.finishRun();
    this.looping = this.motion !== "still" && Object.values(this.frame?.actors ?? {}).some((a) => a.gestures.some((g) => g.loop));
    if (this.pausedAt === null && (t < p.dur + 50 || this.looping || this.lifeRate() > 0 || this.camBusy || this.swaps.size && !this.r?.lost)) this.kick();
  }
  // ---- Targets ----------------------------------------------------------------
  propPoint(s) {
    if (this.held?.id === s.id) return this.held.at;
    if (s.holder) return this.actors.get(s.holder.actor)?.grips[s.holder.side] ?? null;
    if (!s.at) return null;
    const art = this.propArt.get(artKey(s)), b = art?.rects[0]?.box;
    return b ? [s.at[0] + (b[0] + b[2]) / 200, s.at[1] - (b[1] + b[3]) / 200, s.at[2]] : s.at;
  }
  /** A target as a world point, for gestures, gaze and sound words. */
  point(t, f) {
    if (!t) return null;
    if (t === "viewer") return [...this.cam.eye];
    const i = t.indexOf(":"), kind = t.slice(0, i), rest = t.slice(i + 1);
    if (kind === "obj") {
      const s = f.props[rest] ?? Object.values(f.props).find((p) => p.of === rest);
      return s ? this.propPoint(s) : null;
    }
    if (kind === "ch") {
      const [id, part] = rest.split("."), a = this.actors.get(id), af = f.actors[id];
      if (!a || !af) return null;
      const b = a.puppet.body, y = part === "head" ? b.H - b.headH * 0.5 : part === "hand" ? b.legLen + 5 : b.H - b.headH - b.torsoL * 0.4;
      return [af.pos[0], af.pos[1] + y / 100, af.pos[2]];
    }
    if (kind === "mark") {
      const pl = f && this.perf?.after.place ? this.places[this.perf.after.place] : null, m = pl?.marks[rest];
      return m ? [m.x, m.y ?? 1.3, m.z] : null;
    }
    if (kind === "pass") {
      const [x, y] = rest.split(":").map((id) => f.actors[id]);
      const hx = rest.split(":").map((id) => this.actors.get(id)?.puppet.body);
      if (!x || !y || !hx[0] || !hx[1]) return null;
      const h2 = Math.min(hx[0].legLen + hx[0].torsoL * 0.45, hx[1].legLen + hx[1].torsoL * 0.45) / 100;
      return [(x.pos[0] + y.pos[0]) / 2, Math.max(h2, 1.08), (x.pos[2] + y.pos[2]) / 2];
    }
    return null;
  }
  /** A world point in an actor's paper space (cm, y down). */
  paperOf(af, p) {
    const c = Math.cos(af.yaw), s = Math.sin(af.yaw);
    return [((p[0] - af.pos[0]) * c - (p[2] - af.pos[2]) * s) * 100, -(p[1] - af.pos[1]) * 100];
  }
  // ---- Camera ------------------------------------------------------------------
  /** The studio's camera: the actor framed for the canvas (cached until the framing, the canvas or the look changes). */
  studioCam() {
    const c = this.studioCfg, a = this.actors.get(c.id);
    const key = `${c.framing}|${this.aspect.toFixed(3)}|${a.ver}`;
    if (c.cam?.key !== key) c.cam = { key, cam: figureCam(c.framing, a.dims ??= figureDims(a.puppet), this.aspect, c.ref) };
    return c.cam.cam;
  }
  shotCam(shot, f) {
    const p = this.perf;
    if (!p) return this.framing(shot, f);
    let m = this.camCache.get(p);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      this.camCache.set(p, m);
    }
    const key = JSON.stringify(shot) + "|" + this.aspect.toFixed(3);
    let cam = m.get(key);
    if (!cam) {
      cam = this.framing(shot, f);
      m.set(key, cam);
    }
    return cam;
  }
  /** Framings from where the actors will stand when the cue ends (so the camera does not drift). */
  framing(shot, f) {
    const aspect = this.aspect, place = this.perf?.after.place ? this.places[this.perf.after.place] : null;
    const end = this.perf?.after;
    const ids = shot.ids.filter((id) => this.actors.has(id) && end?.actors[id]?.on);
    const objBoxes = (pad) => shot.objs.flatMap((o) => {
      const p = (end?.props[o] ?? f.props[o])?.at;
      return p ? [{ x0: p[0] - 0.12 - pad, x1: p[0] + 0.12 + pad, y0: p[1] - 0.05 - pad / 2, y1: p[1] + 0.3 + pad / 2, z: p[2] }] : [];
    });
    if (shot.kind === "obj" && !ids.length && shot.objs.length) {
      const boxes2 = objBoxes(0.35);
      if (boxes2.length) return frameBoxes(boxes2, { aspect, margin: 0.12, tilt: 0.08 });
    }
    if (shot.kind === "wide" || !ids.length) {
      return frameBoxes([wideBox(place)], { aspect, margin: 0, tilt: 0.1, minDist: 3, lift: 0.04 });
    }
    const room = this.overlay && this.lines ? shot.kind === "close" ? 0.2 : 0.38 : 0.04;
    const box = (id, part) => {
      const a = this.actors.get(id), b = a.puppet.body, H = b.H / 100, w = b.shoulderW / 100, p = end.actors[id].pos;
      if (a.kit) {
        const r = part === "head" ? 0.22 : part === "bust" ? 0.32 : 0.45;
        return { x0: p[0] - r - w / 2, x1: p[0] + r + w / 2, y0: p[1] - r * 0.4, y1: p[1] + H + r, z: p[2] };
      }
      const y0 = part === "upper" ? H * 0.42 : part === "bust" ? H - b.headH / 100 * 1.9 : H - b.headH / 100 * 1.25;
      const half = part === "head" ? b.headW / 100 * 0.9 : w * 0.9;
      const seat = end.actors[id].seat, down = seat !== void 0 ? Math.max(0, b.legLen / 100 - seat - 0.02) : 0;
      return { x0: p[0] - half, x1: p[0] + half, y0: p[1] + y0 - down, y1: p[1] + H + room - down, z: p[2] };
    };
    const boxes = shot.kind === "two" ? ids.map((id) => box(id, "upper")) : shot.kind === "single" ? [box(ids[0], "upper")] : [box(ids[0], shot.kind === "close" ? "head" : "bust")];
    boxes.push(...objBoxes(0));
    return frameBoxes(boxes, { aspect, margin: shot.kind === "close" ? 0.22 : 0.1, tilt: shot.kind === "close" ? 0.04 : 0.08 });
  }
  /** `follow`: a box round the actor where she is now (a walk, a flight), framed afresh every frame; null for any other shot. */
  follow(f) {
    const s = f.shot.to, id = s.kind === "follow" ? s.ids.find((i) => this.actors.has(i) && f.actors[i]?.on) : void 0;
    if (!id) return null;
    const p = f.actors[id].pos, y = p[1] + this.actors.get(id).puppet.body.H / 200;
    return frameBoxes([{ x0: p[0] - 0.9, x1: p[0] + 0.9, y0: y - 0.9, y1: y + 0.9, z: p[2] }], { aspect: this.aspect, minDist: 2, tilt: 0.08 });
  }
  // ---- Drawing ----------------------------------------------------------------
  render() {
    const p = this.perf, r = this.r;
    if (!p || !r || r.lost || this.destroyed) return;
    const now = performance.now();
    this.lifeT += Math.min(100, now - (this.lifeAt || now)) * this.lifeRate();
    this.lifeAt = now;
    const place = p.after.place, set = place ? this.sets.get(place) : null;
    if (!set) return;
    if (!this.res.includes(place)) try {
      this.rasterise();
    } catch (e) {
      console.warn("sahne: could not draw the place", e);
      this.broken = true;
      return;
    }
    const t0 = performance.now();
    const f = this.frame = evaluate(p, this.motion === "still" ? p.dur : Math.max(0, this.now()));
    this.stopsClock(f, place);
    const day = blendLight(TIMES[f.time.from] ?? TIMES.day, TIMES[f.time.to] ?? TIMES.day, f.time.k);
    this.light = withFlash(f.weather.k < 1 ? blendLight(withWeather(day, f.weather.from), withWeather(day, f.weather.to), f.weather.k) : withWeather(day, f.weather.to), this.motion === "still" ? 0 : f.flash);
    const target = this.studioCfg ? this.studioCam() : this.follow(f);
    if (target) {
      this.cam = this.snapCam ? target : stepCam(this.cam, target, t0 - this.camT, this.motion === "still" ? 0 : CAM_MS);
      this.camBusy = this.cam !== target;
    } else {
      this.camBusy = false;
      const toCam = this.shotCam(f.shot.to, f);
      if (this.motion === "still") this.cam = toCam;
      else if (f.shot.k < 1) this.cam = blendCam(this.camFrom ?? this.shotCam(f.shot.from, f), toCam, f.shot.k);
      else if (this.camFrom && f.t < CAM_MS && p.cams.every((c) => c.t === 0)) this.cam = blendCam(this.camFrom, toCam, ease.inOut(f.t / CAM_MS));
      else this.cam = toCam;
    }
    this.snapCam = false;
    this.camT = t0;
    const pl = this.places[place];
    if (f.lights < 1 && !pl?.outdoor) {
      const k = 1 - 0.35 * (1 - f.lights) * this.light.glow;
      this.light = { ...this.light, amb: this.light.amb.map((v) => v * k) };
    }
    const L2 = this.light;
    r.begin();
    r.transparent = r.alpha && this.studioCfg?.backdrop === "none";
    if (!r.transparent) {
      const top = [...L2.skyTop, 1], bot = [...L2.skyBottom, 1];
      r.colorQuad([[-80, 45, -45], [80, 45, -45], [80, -5, -45], [-80, -5, -45]], [top, top, bot, bot], MODE.flat, 0);
    }
    const eye = this.cam.eye, tg = this.cam.target, fl = dist2(eye, tg) || 1;
    const fwd = [(tg[0] - eye[0]) / fl, (tg[1] - eye[1]) / fl, (tg[2] - eye[2]) / fl];
    const depth = (q) => (q[0] - eye[0]) * fwd[0] + (q[1] - eye[1]) * fwd[1] + (q[2] - eye[2]) * fwd[2];
    const objs = [];
    if (this.pickable) this.picks = [];
    this.texts.length = 0;
    const shows = (list) => {
      const a = inState(list, f.state.from) ? 1 : 0, b = inState(list, f.state.to) ? 1 : 0;
      return a + (b - a) * f.state.k;
    };
    const clear = 1 - cloudAt(f.weather);
    for (const fl0 of set.flats) {
      const rv = fl0.spec.reveal && fl0.in ? shows(fl0.in) : void 0;
      const a = (rv !== void 0 ? 1 : fl0.in ? shows(fl0.in) : 1) * (fl0.spec.when ? whenWeight(fl0.spec.when, f) : 1) * (fl0.spec.sky ? clear : 1);
      const mv = fl0.spec.move?.path ? moveAt(fl0.spec.move, this.clockFor(fl0.spec.move, fl0.still)) : null;
      const c0 = fl0.base?.center ?? fl0.center, d0 = depth([c0[0] + (mv?.at[0] ?? 0), 0, c0[2] + (mv?.at[2] ?? 0)]) - (fl0.base ? 1e-4 : 0);
      if (a > 1e-3 && (rv === void 0 || rv > 1e-3)) objs.push({ d: fl0.spec.sky ? 2e9 + 1 : fl0.under ? 1e9 + 1 + d0 : fl0.floor ? 1e9 : d0, draw: () => {
        this.pickAs = fl0.floor || a < 0.5 || fl0.spec.pick === false ? null : "piece:" + (fl0.piece ?? "");
        this.drawFlat(fl0, f, a, rv);
      } });
    }
    const hd = this.held, hs = hd ? f.props[hd.id] : void 0;
    if (hd && (!hs || heldKey(hs) !== hd.from)) this.held = null;
    for (const s0 of Object.values(f.props)) {
      const s = this.held?.id === s0.id ? { ...s0, holder: void 0, at: this.held.at, shown: true } : s0;
      if (s.holder || !s.at || !s.shown && !s.ghost) continue;
      const pa = s.in ? shows(s.in) : 1;
      if (pa <= 1e-3) continue;
      const art = this.propArt.get(artKey(s));
      if (!art) continue;
      art.specs.forEach((spec, k) => {
        const { R: R3, D } = axes(spec.yaw, spec.pitch);
        const O = [s.at[0] + (spec.x ?? 0) / 100, s.at[1] + (spec.y ?? 0) / 100, s.at[2] + (spec.z ?? 0) / 100];
        const rect2 = s.shown ? art.rects[k] : art.ghosts[k];
        const flat = { spec, rect: rect2, glow: s.shown ? art.glows[k] : void 0, O, R: R3, D, yaw: spec.yaw ?? 0, pitch: spec.pitch ?? 0, lit: spec.lit ?? 1, shadow: s.shown && spec.shadow === "drop", floor: false, center: O, still: s.still };
        objs.push({ d: (this.held?.id === s.id ? -1e9 : depth([O[0], 0, O[2]])) - (this.texted.has(spec) ? 1e-4 : 0), draw: () => {
          this.pickAs = s.shown && pa >= 0.5 ? "obj:" + s.id : null;
          this.drawFlat(flat, f, pa);
        } });
      });
    }
    this.assignSlots(f);
    const tp = performance.now();
    const posed = [], held = [];
    for (const af of Object.values(f.actors)) {
      const a = this.actors.get(af.id);
      if (!a || !af.on) continue;
      const pz = this.pose(a, af, f), up = af.pos[1] > 0.01;
      if (!up) posed.push({ a, af, ...pz });
      objs.push({ d: depth([af.pos[0], 0, af.pos[2]]), draw: () => {
        if (up) this.drawBlob(af, a);
        this.drawActor(a, af, f, pz.world, pz.alt, pz.faceOff);
      } });
      for (const side of ["l", "r"]) {
        const h2 = af.hold[side], s = h2?.prop ? f.props[h2.prop] : void 0, art = s && this.propArt.get(artKey(s)), hb = pz.world.get("hand_" + side);
        if (!s || !art?.emitters?.length || !hb || s.holder?.actor !== a.id || this.held?.id === s.id) continue;
        const b = a.puppet.body, g = apply(hb, 0, b.handL * 0.45), ox = g[0], oy = g[1] + b.handL * 0.3, { R: R3, D } = axes(af.yaw);
        for (const [k, e] of art.emitters.entries()) held.push({ e, seed: `${s.id}|e${k}`, at: at3(af.pos, R3, D, ox + e.x, oy - e.y) });
      }
    }
    this.stats.poseMs = +(performance.now() - tp).toFixed(2);
    this.particles(f, set, objs, depth, shows, held);
    objs.sort((x, y) => y.d - x.d);
    const floorEnd = objs.findIndex((o) => o.d < 1e9);
    objs.splice(floorEnd < 0 ? objs.length : floorEnd, 0, { d: 0, draw: () => {
      for (const q of posed) this.drawBlob(q.af, q.a);
    } });
    for (const o of objs) o.draw();
    const lights = set.lamps.filter((l) => !l.spec.at || l.spec.at.includes(f.time.k < 0.5 ? f.time.from : f.time.to)).map((l) => ({ pos: l.pos, color: hexToRgb(l.spec.color), intensity: (l.spec.intensity ?? 1) * L2.practical * (l.in ? shows(l.in) : 1) * (l.sw ? f.lights : 1), radius: l.spec.radius })).filter((l) => l.intensity > 1e-3);
    if (lights.length > 4) {
      const T = this.cam.target;
      lights.sort((a, b) => dist2(a.pos, T) - dist2(b.pos, T));
    }
    const out = r.draw(this.cam, L2, lights, this.dim);
    this.vp = out.viewProj;
    this.stats.vertices = out.vertices;
    this.stats.frameMs = +(performance.now() - t0).toFixed(2);
    this.updateBubbles(f);
    this.pickAs = null;
    for (const fn of this.frameFns) fn();
  }
  /**
   * The frame's particles (DESIGN.md §6.7), each sorted in with the rest by its depth: rain from the
   * weather (outdoors through the whole set; indoors only behind the back wall, so it shows through
   * the windows), steam and smoke from pieces and props, breath in a cold state, fireworks. Rain, steam
   * and breath run on the place's clock (still in reduced motion); fireworks on the cue's, and in reduced
   * motion each is a still burst.
   */
  particles(f, set, objs, depth, shows, held = []) {
    const out = [], place = this.places[this.perf.after.place], life2 = this.lifeT, still = this.motion === "still";
    const rain = (f.weather.from === "rain" ? 1 - f.weather.k : 0) + (f.weather.to === "rain" ? f.weather.k : 0);
    if (rain > 0.01 && place) {
      const b = wideBox(place), outdoor = !!place.outdoor, span = (b.x1 - b.x0) / 2 + 1.5, cx = (b.x0 + b.x1) / 2;
      rainAt(`${place.id}|rain`, { x0: cx - span, x1: cx + span, y0: -0.1, y1: b.y1 + 1.6, z0: outdoor ? b.z - 1.5 : b.z - 3.5, z1: outdoor ? 1.2 : b.z - 0.15 }, life2, Math.round((outdoor ? 220 : 150) * rain), out);
    }
    const emit = (e2, seed, at4) => e2.kind === "flame" ? flameAt(seed, at4, life2, out, (e2.w ?? 1.2) / 100) : puffAt(e2.kind, seed, at4, life2, out, (e2.w ?? 6) / 100);
    for (const e2 of set.emitters) if (!e2.in || shows(e2.in) > 0.5) emit(e2.spec, e2.seed, e2.pos);
    for (const s of Object.values(f.props)) {
      const art = s.at && !s.holder && s.shown ? this.propArt.get(artKey(s)) : void 0;
      for (const [k, e2] of (art?.emitters ?? []).entries()) emit(e2, `${s.id}|e${k}`, [s.at[0] + e2.x / 100, s.at[1] + e2.y / 100, s.at[2] + (e2.z ?? 5) / 100]);
    }
    for (const h2 of held) emit(h2.e, h2.seed, h2.at);
    const cold = !!place?.states && f.state.to.some((s) => place.states[s]?.cold);
    for (const af of Object.values(f.actors)) {
      const mouth = af.on ? this.actors.get(af.id)?.talk?.mouth : void 0;
      if (!mouth) continue;
      const dir = Math.sin(af.yaw) > 0.2 ? 1 : Math.sin(af.yaw) < -0.2 ? -1 : 0;
      if (cold) breathAt(mouth, (life2 + hashString(af.id) % 3500) % 3500, dir, out);
      for (const pf of this.perf.puffs ?? []) if (pf.who === af.id) breathAt(mouth, f.t - pf.t, dir, out);
    }
    for (const bu of this.perf.bursts ?? []) if (bu.t <= f.t) burstAt(bu.seed, bu.at, still ? 700 : f.t - bu.t, out, 2.2);
    if (!out.length) return;
    const e = this.cam.eye, tg = this.cam.target, fw = [tg[0] - e[0], tg[1] - e[1], tg[2] - e[2]], fl = Math.hypot(fw[0], fw[1], fw[2]) || 1;
    const fwd = fw.map((v) => v / fl), rl = Math.hypot(fwd[2], fwd[0]) || 1, right = [-fwd[2] / rl, 0, fwd[0] / rl];
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    for (const s of out.slice(0, MAX_SPRITES)) {
      const R3 = [right[0] * s.w / 2, right[1] * s.w / 2, right[2] * s.w / 2], U = [up[0] * s.h / 2, up[1] * s.h / 2, up[2] * s.h / 2];
      objs.push({ d: s.sky ? 2e9 : depth([s.pos[0], 0, s.pos[2]]), draw: () => this.r.sprite(s.pos, R3, U, s.color, s.shape, !!s.additive, s.lit ?? 0, s.slant ?? 0) });
    }
  }
  /** The face texture's slots go to the actors on stage (up to the slot count); a new owner redraws. */
  assignSlots(f) {
    const n = this.r?.faces.count ?? 0, on = new Set(Object.values(f.actors).filter((a) => a.on).map((a) => a.id));
    for (let i = 0; i < n; i++) if (this.slotOwner[i] && !on.has(this.slotOwner[i])) this.slotOwner[i] = null;
    for (const id of on) {
      const a = this.actors.get(id);
      if (!a?.puppet.faceRegion || a.slot >= 0 && this.slotOwner[a.slot] === id) continue;
      const free = Array.from({ length: n }, (_, i) => i).find((i) => !this.slotOwner[i]);
      if (free === void 0) {
        a.slot = -1;
        continue;
      }
      this.slotOwner[free] = id;
      a.slot = free;
      a.drawnFace = "";
    }
  }
  /** Pose an actor for this frame and bring its face texture up to date. */
  pose(a, af, f) {
    const E = this.kit.face.emotions, pa = E[af.emo.from] ?? {}, pb = E[af.emo.to] ?? {}, k = af.emo.k;
    const gestures = af.gestures.map((g) => {
      const p = this.point(g.at, f);
      return { id: g.id, t: g.t, side: g.side, n: g.n, loop: g.loop, target: p ? this.paperOf(af, p) : void 0 };
    });
    const cy = Math.cos(af.yaw), sy = Math.sin(af.yaw);
    const walkDir = af.walk ? Math.sign(af.walk.dir[0] * cy - af.walk.dir[2] * sy) || 1 : 1;
    const V = this.kit.face.visemes, m = af.mouth, op = (v) => V[v]?.open ?? 0;
    const out = (a.kit?.pose ?? composePose)({
      bones: a.puppet.bones,
      body: a.puppet.body,
      defs: (a.kit ?? this.kit).gestures,
      gestures,
      hold: { l: af.hold.l?.w ?? 0, r: af.hold.r?.w ?? 0 },
      walk: af.walk ? { phase: af.walk.phase, amount: af.walk.amount, dir: walkDir, how: af.walk.how, climb: af.walk.climb } : void 0,
      seat: af.seat,
      emo: af.emo.to,
      talk: m ? clamp((op(m.v0) + (op(m.v1) - op(m.v0)) * m.k) * m.amount, 0, 1) : 0,
      air: af.air,
      pace: af.pace,
      life: this.lifeT,
      emotion: { headTilt: (pa.headTilt ?? 0) + ((pb.headTilt ?? 0) - (pa.headTilt ?? 0)) * k, posture: (pa.posture ?? 0) + ((pb.posture ?? 0) - (pa.posture ?? 0)) * k },
      idle: { t: performance.now(), seed: a.id, amount: this.idleAmount() }
    });
    const side = this.sideOf(a, af);
    const world = side ? solve(seatedSide(a.puppet.body, af.seat.h * 100)) : solve(a.puppet.bones, out.pose);
    if (a.kit) return { world, alt: out.alt, faceOff: out.faceOff };
    let face = k >= 1 ? faceFrom(pb) : blendFace(faceFrom(pa), faceFrom(pb), k);
    for (const x of out.faces) if (x.w > 1e-3) face = blendFace(face, faceFrom(x.preset, face), clamp(x.w, 0, 1));
    const b = a.puppet.body, eyeY = -(b.H - b.headH * 0.57);
    const gaze = (t) => {
      if (!t) return [0, 0];
      const p = this.point(t, f);
      if (!p) return [0, 0];
      const q = this.paperOf(af, p);
      return [clamp(q[0] / 70, -0.85, 0.85), clamp((q[1] - eyeY) / 140, -0.55, 0.6)];
    };
    let pupil;
    const gt = af.gestures.find((g) => g.at)?.at;
    if (out.look === "target" && gt) pupil = gaze(gt);
    else if (out.look === "up") pupil = [0.25, -0.6];
    else if (out.look === "down") pupil = [0, 0.55];
    else if (out.look === "away") pupil = [-0.6, 0.1];
    else {
      const p0 = gaze(af.look.from), p1 = gaze(af.look.to);
      pupil = [p0[0] + (p1[0] - p0[0]) * af.look.k, p0[1] + (p1[1] - p0[1]) * af.look.k];
    }
    face.pupil = [clamp(pupil[0] + out.saccade[0], -0.95, 0.95), clamp(pupil[1] + out.saccade[1], -0.8, 0.8)];
    const blink = Math.max(out.blink, af.turning !== null && af.turning < 0.45 ? Math.sin(Math.PI * af.turning / 0.45) : 0);
    if (blink > 0) face.eyeOpen = [face.eyeOpen[0] * (1 - blink), face.eyeOpen[1] * (1 - blink)];
    if (af.mouth) {
      const v0 = V[af.mouth.v0] ?? {}, v1 = V[af.mouth.v1] ?? {}, m2 = face.mouth, q = af.mouth.k;
      const scale2 = af.mouth.voice === "whisper" ? 0.6 : 1;
      const ch2 = (key2, def) => (v0[key2] ?? def) + ((v1[key2] ?? def) - (v0[key2] ?? def)) * q;
      const wide = (v0.wide ?? m2.wide) + ((v1.wide ?? m2.wide) - (v0.wide ?? m2.wide)) * q;
      const speak = { open: Math.max(m2.open * 0.3, ch2("open", 0) * scale2), wide: m2.wide + (wide - m2.wide) * 0.75, round: ch2("round", 0), smile: m2.smile * 0.65, teeth: Math.max(ch2("teeth", 0), m2.teeth * 0.3) };
      const w = af.mouth.amount;
      face.mouth = { open: m2.open + (speak.open - m2.open) * w, wide: m2.wide + (speak.wide - m2.wide) * w, round: m2.round + (speak.round - m2.round) * w, smile: m2.smile + (speak.smile - m2.smile) * w, teeth: m2.teeth + (speak.teeth - m2.teeth) * w };
    }
    a.face = face;
    const key = faceKey(face) + (side ? "|side" : "");
    if (a.slot >= 0 && key !== a.drawnFace) {
      a.drawnFace = key;
      const { faceStyle } = a.puppet, region = side ? a.puppet.side.faceRegion : a.puppet.faceRegion;
      this.r.faces.update(a.slot, region, (c) => side ? this.kit.face.drawSide(c, faceStyle, face, region) : this.kit.face.draw(c, faceStyle, face, region));
    }
    const alt = { ...out.alt };
    for (const side2 of ["l", "r"]) if (!alt["hand_" + side2] && (af.hold[side2]?.w ?? 0) > 0.3 && af.hold[side2]?.prop) alt["hand_" + side2] = "hold";
    return { world, alt, faceOff: side ? [0, 0] : out.faceOff };
  }
  /** Seated side on (a seat mark facing side_l or side_r, `Kit.side`): which way the actor faces, once they are mostly down; else 0. */
  sideOf(a, af) {
    return !a.kit && af.seat?.side && af.seat.k > 0.5 && a.puppet.side && this.kit.face.drawSide ? af.seat.side : 0;
  }
  /** One flat: its shadow, its art and its glow, faded by `a` (a place's state coming or going). */
  /** Where the sky is seen from as drawn: the eye of the place's wide shot (the sky moves with the camera from there). */
  skyEye = null;
  skyRef(f) {
    const place = this.perf?.after.place ?? "";
    if (this.skyEye?.place !== place) this.skyEye = { place, eye: this.shotCam({ kind: "wide", ids: [], objs: [] }, f).eye };
    return this.skyEye.eye;
  }
  /**
   * Sets the stops clock for this frame. On its own it is the life clock. When the script holds the vehicle at a station, it
   * runs on to that station's held moment and stays there: from where it is, if it is already on its way there (no jump); else
   * from the start of the leg to it (`arrive`: pulling out of the station before) or right at it (a scene that opens there). `go`
   * runs it on from where it stood.
   */
  stopsClock(f, place) {
    const doc = this.places[place], tt = { ...TIMETABLE, ...doc?.stops }, sc = doc?.stops ? f.stops : null, L2 = this.lifeT;
    const key = `${place}|${sc?.at ?? "-"}|${sc?.go ? 1 : 0}`, a = this.stopsA;
    if (a?.key === key) return;
    const S0 = a && a.key.split("|")[0] === place ? this.stopsNow() : L2;
    let S = S0, H;
    if (sc && sc.at < 0 && doc?.stops) {
      this.stopsA = sc.go ? { key, L: L2, S: S0, ease: true } : { key, L: L2, S: S0, halt: true };
      return;
    }
    if (sc && !sc.go && doc?.stops) {
      const loop = Math.max(1, doc.stops.stations.length - 1) * tt.ms, h0 = (sc.at - 1) * tt.ms + tt.run + tt.hold;
      H = h0 + Math.max(0, Math.ceil((S0 - h0) / loop)) * loop;
      if (H - S0 > tt.ms) S = H - (sc.arrive ? tt.run + tt.hold : 0);
    }
    this.stopsA = { key, L: L2, S, H };
  }
  stopsNow() {
    const a = this.stopsA;
    if (!a) return this.lifeT;
    const e = this.lifeT - a.L, T = HALT_MS;
    if (a.halt) return a.S + (e < T ? e - e * e / (2 * T) : T / 2);
    if (a.ease) return a.S + (e < T ? e * e / (2 * T) : e - T / 2);
    const s = a.S + e;
    return a.H !== void 0 ? Math.min(a.H, s) : s;
  }
  /** The clock a moving flat reads: the stops clock or the life clock; a still flat holds at the start (a held vehicle at its station). */
  clockFor(m, still) {
    return m.clock === "stops" ? still ? this.stopsA?.H ?? 0 : this.stopsNow() : still ? 0 : this.lifeT;
  }
  drawFlat(fl, f, a = 1, reveal = 1) {
    const r = this.r;
    if (reveal < 0.999) {
      const [x0, y0, x1, y1] = fl.rect.box, k = Math.max(0, reveal);
      fl = { ...fl, rect: { ...fl.rect, box: [x0, y0, x1, y0 + (y1 - y0) * k], v1: fl.rect.v0 + (fl.rect.v1 - fl.rect.v0) * k }, glow: void 0 };
    }
    let { O, R: R3, D } = fl;
    const rc = fl.spec.react, home = rc ? homeOf(fl, rc) : fl.O, re = rc ? this.reaction(rc, home, f) : null;
    if (rc?.tap) this.tapSpecs.set(reactKey(rc, home), rc.tap);
    if (rc && re && !reactShows(rc, re)) return;
    if (fl.spec.move) {
      const m = moveAt(fl.spec.move, this.clockFor(fl.spec.move, fl.still));
      if (!m) return;
      if (m.rot) {
        const c2 = Math.cos(m.rot), s = Math.sin(m.rot);
        [R3, D] = [[R3[0] * c2 + D[0] * s, R3[1] * c2 + D[1] * s, R3[2] * c2 + D[2] * s], [D[0] * c2 - R3[0] * s, D[1] * c2 - R3[1] * s, D[2] * c2 - R3[2] * s]];
      }
      O = at3([O[0] + m.at[0], O[1] + m.at[1], O[2] + m.at[2]], R3, D, m.dx, -m.dy);
    }
    if (rc && re) {
      if (re.dx || re.dz || re.up) O = [O[0] + re.dx, O[1] + (rc.flee?.lift ?? 0) / 100 * re.up, O[2] + re.dz];
      if (rc.look && re.look > 0) {
        const [px, py] = rc.look.pivot, P = at3(O, R3, D, px, py), a2 = rc.look.turn * re.look, c2 = Math.cos(a2), s = Math.sin(a2);
        [R3, D] = [[R3[0] * c2 + D[0] * s, R3[1] * c2 + D[1] * s, R3[2] * c2 + D[2] * s], [D[0] * c2 - R3[0] * s, D[1] * c2 - R3[1] * s, D[2] * c2 - R3[2] * s]];
        O = at3(P, R3, D, -px, -py);
      }
    }
    if (fl.spec.slide && fl.piece && f.doors[fl.piece]) O = at3(O, R3, D, fl.spec.slide * f.doors[fl.piece], 0);
    const ajar = fl.swing && fl.spec.openIn ? whenWeight({ state: fl.spec.openIn }, f) : 0;
    if (fl.swing && fl.piece && (f.doors[fl.piece] || ajar)) {
      const open = Math.max(f.doors[fl.piece] ?? 0, ajar), hx = fl.hinge ?? 0, H = at3(O, R3, D, hx, 0);
      ({ R: R3, D } = axes(fl.yaw + fl.swing * open, fl.pitch));
      O = [H[0] - R3[0] * hx, H[1] - R3[1] * hx, H[2] - R3[2] * hx];
    }
    const corners = (o, b = fl.rect.box) => [at3(o, R3, D, b[0], b[1]), at3(o, R3, D, b[2], b[1]), at3(o, R3, D, b[2], b[3]), at3(o, R3, D, b[0], b[3])];
    if (fl.shadow && this.light.shadow > 0) {
      const off = at3(O, R3, D, 2.2, 3.4);
      r.quad(corners([off[0], off[1], off[2] - 0.012]), fl.rect, MODE.shadow, 0, 0, [0.16, 0.1, 0.12, 0.42 * this.light.shadow * a]);
    }
    if (fl.spec.sky) {
      const e = this.cam.eye, k = this.skyRef(f);
      O = [O[0] + (e[0] - k[0]) * 0.97, O[1] + (e[1] - k[1]) * 0.97, O[2] + (e[2] - k[2]) * 0.97];
    }
    const c = corners(O), tint = [a, a, a, a];
    r.quad(c, fl.rect, MODE.piece, fl.lit, fl.spec.sky ? 0 : 1, tint);
    if (this.pickable && this.pickAs !== null) this.picks.push({ target: this.pickAs, c, rect: fl.rect, ...rc?.tap ? { poke: reactKey(rc, home) } : {} });
    if (fl.spec.text && this.pickAs) this.texts.push({ target: this.pickAs, spec: fl.spec, O, R: R3, D });
    const g = (fl.sw ? a * f.lights : a) * glowWeight(fl.spec.glowAt, this.light.glow);
    if (fl.glow && this.light.glow > 0.01 && g > 1e-3) r.quad(corners(O, fl.glow.box), fl.glow, MODE.glow, 0, fl.spec.sky ? 0 : 1, [g, g, g, g]);
  }
  /**
   * How a reacting flat whose home is `O` stands now (`FlatReact`): `dx`, `dz`, where its flights from people have taken
   * it (metres; it stays where it lands, `flights` in `anim/react.ts`), `up` (0…1, the arc of a flight now), whether it is
   * `moving` and which way (`dir`); `look` (0…1) for a head turned to the nearest person within its `r`. Kit puppets
   * (Kerim) and anyone off stage do not count; reduced motion keeps it at home, at rest.
   */
  reaction(rc, O, f) {
    const rest = { dx: 0, dz: 0, up: 0, moving: false, dir: 1, look: 0 };
    if (this.motion === "still") return rest;
    const puppet = (id) => !!this.actors.get(id)?.kit;
    let at4 = rest;
    if (rc.flee) {
      const key = reactKey(rc, O);
      let fl = this.reactMemo.flights.get(key);
      if (!fl) {
        this.reactMemo.samples ??= peopleSamples(this.history, puppet);
        fl = flights([O[0], O[2]], rc.flee, this.reactMemo.samples, Infinity);
        this.reactMemo.flights.set(key, fl);
      }
      const q = fleeAt([O[0], O[2]], fl, f.t);
      at4 = { ...rest, dx: q.dx, dz: q.dz, up: Math.sin(Math.PI * q.u), moving: q.u > 0, dir: q.dir };
    }
    const tap = rc.tap ? this.taps.get(reactKey(rc, O)) : void 0, tu = tap ? (performance.now() - tap.t) / TAP_MS : 1;
    const hu = tu * TAP_MS / 900;
    if (tap && hu < 1 && tap.do === "hop" && !at4.moving) at4 = { ...at4, up: 0.45 * Math.sin(Math.PI * hu), moving: true };
    if (rc.look) {
      let d = Infinity;
      for (const af of Object.values(f.actors)) if (af.on && !puppet(af.id)) d = Math.min(d, Math.hypot(af.pos[0] - O[0] - at4.dx, af.pos[2] - O[2] - at4.dz));
      at4 = { ...at4, look: at4.moving ? 0 : lookToward(rc.look.r, d) };
      if (tap && tu < 1 && tap.do === "look" && !at4.moving) {
        const k = Math.max(0, Math.min(1, tu * 5, (1 - tu) * 4));
        at4 = { ...at4, look: Math.max(at4.look, k * k * (3 - 2 * k)) };
      }
    }
    return at4;
  }
  /**
   * A learner tapped a flat that answers taps (`Pick.poke`, `FlatReact.tap`): it hops or looks up for a moment, with its
   * sound panned where it is. Not part of the performance: it plays on the wall clock and leaves the story as it was.
   */
  tapFlat(key, at4) {
    const sp = this.tapSpecs.get(key);
    if (!sp || this.motion === "still") return;
    this.taps.set(key, { t: performance.now(), do: sp.do });
    if (sp.sound && this.soundOn) {
      const q = at4 ? this.project(at4) : null;
      this.audio.play(sp.sound, { pan: q ? clamp(q[0] / this.cssW * 2 - 1, -1, 1) * 0.6 : 0 });
    }
    this.poke();
  }
  /** The performance on stage now is `p`: this place's history since its scene began (a script's cues, or what was acted), for reacting flats. */
  onStage(p) {
    const k = this.perfs.indexOf(p);
    if (k >= 0) {
      let j = k;
      while (j > 0 && this.perfs[j - 1].after.place === p.before.place && this.perfs[j].before.place === p.before.place && p.before.place) j--;
      this.history = this.perfs.slice(j, k + 1);
    } else this.history = this.history.length && this.history[this.history.length - 1].after.place === p.before.place ? [...this.history, p] : [p];
    this.reactMemo = { samples: null, flights: /* @__PURE__ */ new Map() };
  }
  /** The soft shadow under an actor, where she stands (a ledge too); none while she is in the air or flying. */
  drawBlob(af, a) {
    if (af.air || af.walk?.how === "fly") return;
    const lift = af.walk ? af.walk.amount * 0.15 : 0;
    const w = a.puppet.body.shoulderW / 100 * (0.85 - lift), d = 0.2, p = af.pos, y = p[1] + 4e-3;
    const c = [0.14, 0.09, 0.16, 0.38 * this.light.shadow];
    this.r.colorQuad([[p[0] - w, y, p[2] - d], [p[0] + w, y, p[2] - d], [p[0] + w, y, p[2] + d], [p[0] - w, y, p[2] + d]], [c], MODE.blob);
  }
  drawActor(a, af, f, world, alt, faceOff) {
    const r = this.r, sideDir = this.sideOf(a, af), view = sideDir ? "side" : Math.cos(af.yaw) >= 0 ? "front" : "back";
    const ax = axes(sideDir ? 0 : af.yaw), R3 = sideDir < 0 ? [-ax.R[0], -ax.R[1], -ax.R[2]] : ax.R, D = ax.D;
    const toW = (p) => at3(af.pos, R3, D, p[0], p[1]);
    const b = a.puppet.body;
    const hand = (side) => world.get("hand_" + side);
    for (const side of ["l", "r"]) {
      const h2 = hand(side);
      if (h2) a.grips[side] = toW(apply(h2, 0, b.handL * 0.45));
    }
    const hd = world.get("head"), hp = (x, y) => toW(apply(hd, x, y)), W2 = b.headW, H = b.headH;
    if (hd) a.talk = {
      top: hp(0, -H * 1.12),
      mouth: view === "front" ? hp(faceOff[0] * W2, -H * 0.19 + faceOff[1] * H) : view === "side" ? hp(W2 * 0.42, -H * 0.22) : hp(0, -H * 0.5),
      head: [hp(0, -H * 0.5), hp(W2 * 0.5, -H * 0.5), hp(0, -H * 1.04)]
    };
    const chinY = hd ? apply(hd, 0, 0)[1] : -1e9;
    const raised = /* @__PURE__ */ new Set();
    if (view === "front") for (const side of ["l", "r"]) {
      const h2 = hand(side);
      if (h2 && apply(h2, 0, b.handL * 0.5)[1] < chinY + 6) raised.add(side);
    }
    const armSide = (it) => it.strip?.chain.startsWith("arm_") ? it.strip.chain.slice(4) : ARM_BONE.exec(it.bone)?.[1] ?? null;
    const later = [];
    const heldDone = /* @__PURE__ */ new Set();
    const drawHeld = (side, last) => {
      const h2 = af.hold[side], s = h2?.prop ? f.props[h2.prop] : void 0, hb = hand(side), art = s && this.propArt.get(artKey(s)), rect2 = art?.rects[0];
      if (art?.specs[0].front && !last) return;
      heldDone.add(side);
      if (!s || !hb || s.holder?.actor !== a.id || this.held?.id === s.id || !rect2) return;
      const g = apply(hb, 0, b.handL * 0.45), bx = rect2.box, ox = g[0], oy = g[1] + b.handL * 0.3;
      const c = [[bx[0], bx[1]], [bx[2], bx[1]], [bx[2], bx[3]], [bx[0], bx[3]]].map(([x, y]) => toW([x + ox, y + oy]));
      r.quad(c, rect2, MODE.piece, 1, 1);
      const wr = this.texted.has(art.specs[1]) ? art.rects[1] : void 0;
      if (wr) {
        const wb = wr.box;
        r.quad([[wb[0], wb[1]], [wb[2], wb[1]], [wb[2], wb[3]], [wb[0], wb[3]]].map(([x, y]) => toW([x + ox, y + oy])), wr, MODE.piece, art.specs[1].lit ?? 1, 1);
      }
      if (art.specs[0].text) this.texts.push({ target: "obj:" + s.id, spec: art.specs[0], O: toW([ox, oy]), R: R3, D });
      if (this.pickable) this.picks.push({ target: "obj:" + s.id, c, rect: rect2 });
      return last;
    };
    const armOf = (it) => it.strip?.chain === "arm_l" || it.bone === "hand_l" ? "l" : it.strip?.chain === "arm_r" || it.bone === "hand_r" ? "r" : null;
    const cos = af.costume && a.costumes.get(af.costume) || a, items = view === "side" ? cos.puppet.side?.items ?? [] : cos.puppet.views[view];
    for (let i = 0; ; i++) {
      if (i >= items.length + later.length) {
        const sd = ["l", "r"].find((x) => !heldDone.has(x));
        if (!sd) break;
        if (drawHeld(sd, true)) later.push(...items.filter((it2) => it2.bone === "hand_" + sd && !it2.strip));
        i--;
        continue;
      }
      const it = i < items.length ? items[i] : later[i - items.length];
      if (it.alt && (alt[it.alt.key] ?? cos.altDefault[it.alt.key]) !== it.alt.value) continue;
      if (it.hold && af.hold[it.hold]?.prop && (af.hold[it.hold]?.w ?? 0) > 0.3) continue;
      if (i < items.length && raised.size) {
        const s = armSide(it);
        if (s && raised.has(s)) {
          later.push(it);
          continue;
        }
      }
      {
        const sd = armOf(it);
        if (sd && !heldDone.has(sd)) drawHeld(sd);
      }
      if (it.strip) {
        this.drawStrip(it, world, toW, this.pickable ? a.id : null);
        continue;
      }
      const A = world.get(it.bone);
      if (!A) continue;
      if (it.face) {
        if (a.slot < 0) continue;
        const fb = FaceAtlas.squareBox(view === "side" ? a.puppet.side.faceRegion : a.puppet.faceRegion), dx = faceOff[0] * b.headW, dy = faceOff[1] * b.headH;
        const c2 = [apply(A, fb[0] + dx, fb[1] + dy), apply(A, fb[2] + dx, fb[1] + dy), apply(A, fb[2] + dx, fb[3] + dy), apply(A, fb[0] + dx, fb[3] + dy)].map(toW);
        r.quad(c2, { layer: a.slot, u0: 0, v0: 0, u1: 1, v1: 1 }, MODE.face, 1, 1);
        if (this.pickable) this.picks.push({ target: "ch:" + a.id, bone: "head", c: c2 });
        continue;
      }
      const rect2 = cos.rects.get(it);
      if (!rect2) continue;
      if (rect2.lazy) r.atlas.ensure(rect2);
      const bx = rect2.box;
      const c = [apply(A, bx[0], bx[1]), apply(A, bx[2], bx[1]), apply(A, bx[2], bx[3]), apply(A, bx[0], bx[3])].map(toW);
      r.quad(c, rect2, MODE.piece, 1, 1);
      if (this.pickable) this.picks.push({ target: "ch:" + a.id, bone: it.bone, c, rect: rect2 });
    }
  }
  /** A limb strip: the band (rig/strip.ts, the geometry the still backend shares) as triangles, then round caps for shoulders, hips and wrists. */
  drawStrip(it, world, toW, pick) {
    const s = it.strip, j = stripJoints(world, s.chain);
    if (!j) return;
    const G = stripGeometry(j, s, it.layer), r = this.r;
    const col = rgba(s.color);
    const stripe = s.stripes ? hexToRgb(s.stripes[0]) : [0, 0, 0];
    const P = [MODE.strip, 1, stripeDuty(s.stripes?.[2]), s.stripes ? s.stripes[1] : 0];
    for (let i = 0; i < G.left.length - 1; i++) {
      const a = toW(G.left[i]), b = toW(G.right[i]), c = toW(G.right[i + 1]), d = toW(G.left[i + 1]), s0 = G.along[i], s1 = G.along[i + 1];
      r.vert(a, stripe, col, P, [s0, 1]);
      r.vert(b, stripe, col, P, [s0, -1]);
      r.vert(c, stripe, col, P, [s1, -1]);
      r.vert(a, stripe, col, P, [s0, 1]);
      r.vert(c, stripe, col, P, [s1, -1]);
      r.vert(d, stripe, col, P, [s1, 1]);
      if (pick) this.picks.push({ target: "ch:" + pick, bone: s.chain, c: [a, b, c, d], tri: true });
    }
    for (const cap of [G.capFrom, G.capTo]) {
      if (!cap) continue;
      const center = toW(cap.center);
      for (let k = 0; k < cap.pts.length - 1; k++) {
        r.vert(center, stripe, col, P, [cap.along, 0]);
        r.vert(toW(cap.pts[k]), stripe, col, P, [cap.along, 1]);
        r.vert(toW(cap.pts[k + 1]), stripe, col, P, [cap.along, 1]);
      }
    }
  }
  // ---- Overlay ----------------------------------------------------------------
  /**
   * Where a target was drawn in the last frame, in CSS pixels inside the stage element: the box of its
   * quads (`ch:nima` takes every part of Nima, `ch:nima.head` one). Null when it was not drawn. Needs
   * `pickable` (the interaction layer sets it; the gallery's camera check sets it alone).
   */
  bounds(target) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pk of this.picks) {
      if (pk.target !== target && !(pk.bone && `${pk.target}.${pk.bone}` === target)) continue;
      for (const c of pk.c) {
        const q = this.project(c);
        if (!q) continue;
        x0 = Math.min(x0, q[0]);
        y0 = Math.min(y0, q[1]);
        x1 = Math.max(x1, q[0]);
        y1 = Math.max(y1, q[1]);
      }
    }
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
  }
  /**
   * The point of the floor (or of the level plane at `height`) under CSS pixel (x, y) inside the stage element,
   * in the last frame's camera: where an editor drops a mark. Null off the floor (above the horizon).
   */
  floorAt(x, y, height = 0) {
    if (!this.cssW || !this.cssH) return null;
    return rayFloor(rayAt(this.cam, this.aspect, x / this.cssW * 2 - 1, 1 - y / this.cssH * 2), height);
  }
  /** A world point in CSS pixels inside the stage element. */
  project(p) {
    if (!this.vp) return null;
    const q = project(this.vp, p);
    if (q[3] <= 0) return null;
    return [(q[0] + 1) / 2 * this.cssW, (1 - q[1]) / 2 * this.cssH];
  }
  updateBubbles(f) {
    const ov = this.overlay;
    if (!ov) return;
    const list = [], perf = this.perf;
    let sid = this.serials.get(perf);
    if (!sid) {
      sid = this.nextSerial++;
      this.serials.set(perf, sid);
    }
    for (const tb of f.bubbles) {
      if (tb.kind === "sound" && this.soundOn && !this.captions) continue;
      if (tb.kind === "speech" && !this.lines) continue;
      const id = `p${sid}:${tb.id}`;
      let b = this.bubbles.get(id);
      if (!b) {
        const remote = tb.kind === "speech" && !!tb.actor && !f.actors[tb.actor]?.on;
        b = { id, kind: tb.kind, text: tb.text, who: tb.who, voice: tb.voice, name: tb.who ? this.names[tb.who] : void 0, ...remote ? { remote } : {} };
        this.bubbles.set(id, b);
      }
      if (tb.actor && !b.remote) {
        const af = f.actors[tb.actor], a = this.actors.get(tb.actor);
        if (af?.on && a?.talk) {
          b.anchor = a.talk.top;
          b.mouth = a.talk.mouth;
          b.head = a.talk.head;
        } else if (af && a) {
          b.anchor = [af.pos[0], af.pos[1] + (a.puppet.body.H + 10) / 100, af.pos[2]];
          b.mouth = void 0;
          b.head = void 0;
        }
      } else if (tb.at) {
        const p = this.point(tb.at, f);
        const mark = tb.at.startsWith("mark:");
        if (p) b.anchor = mark ? [p[0], Math.max(p[1], 2), p[2]] : p;
      }
      list.push(b);
    }
    const ids = list.map((b) => b.id).join("|");
    if (ids !== this.bubbleIds) {
      this.bubbleIds = ids;
      for (const id of [...this.bubbles.keys()]) if (!list.some((b) => b.id === id)) this.bubbles.delete(id);
      ov.inset(list.some((b) => b.kind === "narrator") ? this.inset : null);
      ov.set(list);
    } else ov.layout();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.endSpeech();
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    this.audio.destroy();
    document.removeEventListener("visibilitychange", this.onVis);
    document.fonts?.removeEventListener("loadingdone", this.onFonts);
    this.el.removeEventListener("pointerdown", this.onDown);
    clearTimeout(this.warmT);
    clearTimeout(this.preT);
    this.finishRun();
    this.swaps.clear();
    this.interaction?.destroy();
    this.interaction = null;
    this.frameFns.clear();
    this.overlay?.destroy();
    this.r?.dispose();
    this.canvas.width = this.canvas.height = 1;
    this.canvas.remove();
  }
};
function pieceSeed(place, p) {
  return p.seed ?? `${place.site ?? place.id}|${p.id ?? `${p.kit}@${p.x},${p.y ?? 0},${p.z}`}`;
}
function drawPieces(place, kit) {
  return place.pieces.flatMap((p) => {
    const def = pieceOf(kit, "set", p.kit);
    if (!def) {
      console.warn("sahne: no set piece", p.kit);
      return [];
    }
    return [{ p, out: def.draw(withVariant(def, p), rng(pieceSeed(place, p)), kit) }];
  });
}
function mountStage(el, o) {
  return new Stage(el, o);
}

// ../sahne/src/script/types.ts
var CAM_KINDS = ["wide", "two", "single", "close", "obj", "ots", "follow", "split", "photo"];
var MOVE_HOWS = ["walk", "run", "hop", "enter", "exit", "fly"];
var VOICES2 = ["normal", "whisper", "silent", "mouthing"];
var OBJ_OPS = ["show", "hide", "give", "take", "add", "own", "place", "set", "go"];
var ACT_KINDS = ["tap", "drag", "go", "choose"];
var ENV_VERBS = ["time", "state", "weather", "fireworks", "thunder", "lights_on", "lights_off", "stop", "depart"];
var CUE_KINDS = ["scene", "line", "beat", "act", "overlay"];
var STAGING_FIELDS = ["to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "costume"];

// ../sahne/src/rig/bird.ts
var BIRD = [
  ["root", null, "bird"],
  ["legs", "root", "legs"],
  ["body", "root", "body"],
  ["tail", "body", "tail"],
  ["wing_far", "body", "wingFar"],
  ["wing", "body", "wing"],
  ["head", "body", "head"],
  ["beak", "head", "beak-lo"]
];
var pivot = (r, k) => {
  const p = r.pivots[k];
  if (!p) throw new Error(`sahne: bird pivot "${k}" missing`);
  return p;
};
function birdBones(r) {
  const pv = new Map(BIRD.map(([n, , k]) => [n, pivot(r, k)]));
  return BIRD.map(([name, parent, k]) => {
    const p = pivot(r, k), q = parent ? pv.get(parent) : p;
    return { name, parent, x: (p[0] - q[0]) * r.scale, y: (p[1] - q[1]) * r.scale, rot: 0 };
  });
}
var R = 0.017453292519943295;
var BEAK = 22;
var HOP = 5;
var PECK = 2;
var PACE_DRIFT = [4, 3];
var swing = (u) => ease.inOut(1 - Math.abs(1 - 2 * (u - Math.floor(u))));
var mix2 = (ab, k) => ab[0] + (ab[1] - ab[0]) * k;
var wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function birdPose(input, o) {
  const { rig } = o, F = rig.flight, s = rig.scale;
  const pose = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const idle2 = input.idle, still = o.motion === "still", a = still || !idle2 ? 0 : clamp(idle2.amount, 0, 1);
  const w = input.walk, fly = w?.how === "fly", flying = fly || !!input.air;
  const mood = o.moods[o.emo[input.emo ?? ""] ?? "idle"] ?? o.moods.idle ?? {};
  const alt = flying ? { wing: "spread", wing_far: "on", legs: "up", tail: "fan", eyes: "big" } : { wing: "fold", wing_far: "off", legs: "down", tail: "rest", eyes: "calm" };
  for (const [k, v] of Object.entries(mood.alt ?? {})) if (!flying || !/^(wing|wing_far|legs|tail)$/.test(k)) alt[k] = v;
  addRot(pose, "head", R * ((mood.head ?? 0) + (flying ? F.head ?? 0 : 0)));
  addOff(pose, "head", 0, s * (mood.headDy ?? 0));
  if (!flying) {
    addRot(pose, "tail", R * (mood.tail ?? 0));
    addRot(pose, "wing", R * (mood.wing ?? 0));
    addRot(pose, "wing_far", -R * (mood.wing ?? 0));
    pose.dy += s * (mood.dy ?? 0);
  }
  if (flying) {
    const beat = 2 * F.flapMs, pace = !fly && !!input.pace, hover = !fly && !pace;
    const ph = pace ? (input.life ?? 0) / beat : hover ? (idle2?.t ?? 0) / beat : w.phase, k = still ? 0 : hover ? a : 1;
    const g = swing(ph * beat / (2 * F.glide.ms)), lift = input.air ? 1 : clamp(w?.amount ?? 1, 0, 1);
    addRot(pose, "wing", R * k * mix2(F.flap, swing(ph)));
    addRot(pose, "wing_far", R * k * mix2(F.flapFar, swing(ph)));
    pose.dy += lift * s * (F.lift.dy + k * (mix2(F.glide.dy, g) - F.lift.dy));
    addRot(pose, "root", lift * R * (F.lift.rot + k * (mix2(F.glide.rot, g) - F.lift.rot)));
    if (pace && !still) {
      const L2 = input.life ?? 0;
      pose.dx += s * PACE_DRIFT[0] * Math.sin(L2 / 1900);
      pose.dy += s * PACE_DRIFT[1] * Math.sin(L2 / 1300 + 1);
    }
  } else if (w) {
    const A = clamp(w.amount, 0, 1), up = Math.sin(Math.PI * (w.phase - Math.floor(w.phase))) * A;
    pose.dy -= s * HOP * up;
    addOff(pose, "head", s * PECK * up, 0);
    addRot(pose, "tail", R * 6 * up);
  }
  if (a > 0 && idle2) {
    const life2 = idleAt(idle2.t, idle2.seed);
    addLen(pose, "body", 0.015 * a * life2.breath);
    if (!flying) addRot(pose, "head", R * 2.5 * a * life2.sway);
    if (life2.blink >= 0.5 && (alt.eyes === "calm" || alt.eyes === "big")) alt.eyes = "shut";
  }
  const talk = clamp(input.talk ?? 0, 0, 1), mb = mood.beak ?? 0;
  addRot(pose, "beak", R * (mb + (BEAK - mb) * talk));
  const acc = newAcc();
  for (const run2 of input.gestures) {
    const def = input.defs[run2.id];
    if (def) gesture(pose, def, run2, acc);
  }
  const sh = acc.shapes.l?.shape, sh2 = acc.shapes.r?.shape;
  if (sh) {
    alt.wing = sh;
    if (sh === "spread") alt.wing_far = "on";
  }
  if (sh2) alt.wing_far = sh2 === "fold" || sh2 === "off" ? "off" : "on";
  if (acc.reaches.length) aim(pose, input.bones, rig, acc);
  const out = { pose, alt, faces: [], faceOff: [0, 0], blink: 0, saccade: [0, 0] };
  if (acc.look) out.look = acc.look.v;
  return out;
}
function gesture(pose, def, run2, acc) {
  const g = { bones: {}, dx: 0, dy: 0 }, b = g.bones;
  applyGesture(g, def, beats(def, run2), acc, { legs: 1, head: 1 });
  addRot(pose, "wing", -(b.arm_l ?? 0));
  addRot(pose, "wing_far", -(b.arm_r ?? 0));
  addRot(pose, "body", b.spine ?? 0);
  addRot(pose, "head", (b.head ?? 0) + (b.neck ?? 0));
  pose.dy += g.dy;
  const hd = g.off?.head;
  if (hd) addOff(pose, "head", hd[0], hd[1]);
}
function beats(def, run2) {
  const n = Math.round(run2.n ?? 0), L2 = def.loop;
  if (run2.loop || !L2 || L2[1] <= L2[0] || n < 1) return { ...run2, side: "l" };
  const [lo, hi] = L2, len = hi - lo, t = run2.t;
  return { ...run2, side: "l", loop: false, t: t < lo ? t : t < lo + n * len ? lo + (t - lo) % len : t - (n - 1) * len };
}
function aim(pose, bones, rig, acc) {
  const world = solve(bones, pose);
  for (const q of acc.reaches) {
    const to = (q.e < 0.5 ? q.a ?? q.b : q.b ?? q.a)?.to, bone = q.arm === "l" ? "wing" : "wing_far";
    if (to !== "target" || !q.target || !world.has(bone)) continue;
    const pk = q.arm === "l" ? "wing" : "wingFar", tip = rig.pivots[pk + "Tip"], p0 = pivot(rig, pk);
    const local = tip ? [(tip[0] - p0[0]) * rig.scale, (tip[1] - p0[1]) * rig.scale] : [0, -1];
    const P = jointOf(world, bone), T = apply(world.get(bone), local[0], local[1]);
    const d = Math.atan2(q.target[1] - P[1], q.target[0] - P[0]) - Math.atan2(T[1] - P[1], T[0] - P[0]);
    addRot(pose, bone, clamp(q.w, 0, 1) * wrap(d));
  }
}

// ../sahne/src/rig/cat.ts
var CAT = [
  ["root", null, "cat"],
  ["body", "root", "body"],
  ["leg_fb", "body", "legFB"],
  ["leg_ff", "body", "legFF"],
  ["tail", "body", "tail"],
  ["leg_nb", "body", "legNB"],
  ["leg_nf", "body", "legNF"],
  ["head", "body", "head"]
];
var pivot2 = (r, k) => {
  const p = r.pivots[k];
  if (!p) throw new Error(`sahne: cat pivot "${k}" missing`);
  return p;
};
function catBones(r) {
  const pv = new Map(CAT.map(([n, , k]) => [n, pivot2(r, k)]));
  return CAT.map(([name, parent, k]) => {
    const p = pivot2(r, k), q = parent ? pv.get(parent) : p;
    return { name, parent, x: (p[0] - q[0]) * r.scale, y: (p[1] - q[1]) * r.scale, rot: 0 };
  });
}
var R2 = 0.017453292519943295;
var SWING = 0.32;
var LIFT2 = 1.4;
var RUN_SWING = 0.5;
var RUN_LIFT = 2.6;
var GAIT = [["leg_nb", 0], ["leg_nf", 0.25], ["leg_fb", 0.5], ["leg_ff", 0.75]];
var LOOK = [-0.75, 0.5];
var wrap2 = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function catPose(input, o) {
  const { rig } = o, s = rig.scale;
  const pose = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const still = o.motion === "still", idle2 = input.idle, a = still || !idle2 ? 0 : clamp(idle2.amount, 0, 1);
  const w = input.walk && input.walk.how !== "fly" ? input.walk : void 0, A = w ? clamp(w.amount, 0, 1) : 0;
  const mood = o.moods[o.emo[input.emo ?? ""] ?? "idle"] ?? o.moods.idle ?? { posture: "sit" };
  const acc = newAcc(), g = { bones: {}, dx: 0, dy: 0, off: {} };
  for (const run2 of input.gestures) {
    const def = input.defs[run2.id];
    if (def) gesture2(g, def, run2, acc);
  }
  const sh = acc.shapes.l?.shape, sh2 = acc.shapes.r?.shape;
  const own2 = A <= 0.4 && !(sh2 && rig.postures[sh2]) && !!rig.postures[mood.posture], m = own2 ? mood : { posture: "stand" };
  const name = A > 0.4 ? "stand" : sh2 && rig.postures[sh2] ? sh2 : own2 ? mood.posture : "stand", P = rig.postures[name];
  const alt = { body: name, tail: name, legs: P.legs ? "on" : "off", eyes: m.eyes ?? (P.shut ? "shut" : "open"), mouth: "shut" };
  const hp = pivot2(rig, "head"), tp = pivot2(rig, "tail");
  addOff(pose, "head", s * (P.head[0] - hp[0]), s * (P.head[1] - hp[1]));
  addOff(pose, "tail", s * (P.tail[0] - tp[0]), s * (P.tail[1] - tp[1]));
  addRot(pose, "head", R2 * ((P.headRot ?? 0) + (m.head ?? 0)));
  addRot(pose, "tail", R2 * ((P.tailRot ?? 0) + (m.tail ?? 0)));
  addOff(pose, "head", 0, s * (m.headDy ?? 0));
  pose.dy += s * (m.dy ?? 0);
  if (w && P.legs) {
    const run2 = w.how === "run", sw = (run2 ? RUN_SWING : SWING) * A, lift = (run2 ? RUN_LIFT : LIFT2) * A * s, c = still ? 0 : w.phase / 2;
    for (const [bone, off] of GAIT) {
      const th = 2 * Math.PI * (c + off);
      addRot(pose, bone, sw * Math.sin(th));
      addOff(pose, bone, 0, -lift * Math.max(0, -Math.cos(th)));
    }
    const bob = (1 - Math.cos(4 * Math.PI * c)) / 2;
    pose.dy -= s * (run2 ? 1.2 : 0.5) * A * bob;
    addRot(pose, "head", 0.035 * A * Math.sin(4 * Math.PI * c));
    addRot(pose, "tail", 0.12 * A * Math.sin(2 * Math.PI * c));
  }
  if (a > 0 && idle2) {
    const life2 = idleAt(idle2.t, idle2.seed);
    addLen(pose, "body", 0.012 * a * life2.breath);
    addRot(pose, "tail", R2 * (P.sway ?? 0) * a * Math.sin(2 * Math.PI * idle2.t / (P.swayMs ?? 2800)));
    if (!w) addRot(pose, "head", R2 * 2 * a * life2.sway);
    if (life2.blink >= 0.5 && alt.eyes === "open") alt.eyes = "shut";
  }
  if ((input.talk ?? 0) > 0.3) alt.mouth = "open";
  for (const [b, v] of Object.entries(g.bones)) addRot(pose, b, v);
  for (const [b, v] of Object.entries(g.off ?? {})) if (v) addOff(pose, b, v[0], v[1]);
  pose.dy += g.dy;
  if (sh === "open" || sh === "shut") alt.mouth = sh;
  if (sh2 === "open" || sh2 === "shut") alt.eyes = sh2;
  if (acc.reaches.length) aim2(pose, input.bones, acc);
  const out = { pose, alt, faces: [], faceOff: [0, 0], blink: 0, saccade: [0, 0] };
  if (acc.look) out.look = acc.look.v;
  return out;
}
function gesture2(pose, def, run2, acc) {
  const g = { bones: {}, dx: 0, dy: 0 }, b = g.bones;
  applyGesture(g, def, { ...run2, side: "l" }, acc, { legs: 1, head: 1 });
  addRot(pose, "head", (b.head ?? 0) + (b.neck ?? 0));
  addRot(pose, "body", b.spine ?? 0);
  for (const l of ["leg_nf", "leg_ff", "leg_nb", "leg_fb"]) addRot(pose, l, -(b.spine ?? 0));
  addRot(pose, "leg_nf", b.arm_l ?? 0);
  addRot(pose, "leg_ff", -(b.arm_r ?? 0));
  pose.dy += g.dy;
  const hd = g.off?.head;
  if (hd) addOff(pose, "head", hd[0], hd[1]);
}
function aim2(pose, bones, acc) {
  const world = solve(bones, pose);
  for (const q of acc.reaches) {
    const to = (q.e < 0.5 ? q.a ?? q.b : q.b ?? q.a)?.to;
    if (to !== "target" || !q.target || q.arm !== "l") continue;
    const P = jointOf(world, "head"), T = apply(world.get("head"), 1, 0);
    const d = wrap2(Math.atan2(q.target[1] - P[1], Math.abs(q.target[0] - P[0])) - Math.atan2(T[1] - P[1], T[0] - P[0]));
    const now = pose.bones.head ?? 0, want = clamp(now + d, LOOK[0], LOOK[1]) - now;
    addRot(pose, "head", clamp(q.w, 0, 1) * want);
  }
}

// ../sahne/src/audio/voice.ts
function browserVoice(o = {}) {
  const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  let voices = synth?.getVoices() ?? [];
  synth?.addEventListener?.("voiceschanged", () => {
    voices = synth.getVoices();
  });
  const pick = (lang) => {
    const all = voices.length ? voices : voices = synth?.getVoices() ?? [];
    const mine = all.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang.toLowerCase()));
    for (const name of o.prefer ?? []) {
      const v = mine.find((x) => x.name === name);
      if (v) return v;
    }
    return mine.find((v) => v.localService) ?? mine[0] ?? null;
  };
  let current = null;
  const clamp4 = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  return {
    id: "browser",
    available: (lang) => !!synth && !!pick(lang),
    speak(text, so) {
      let done = false;
      const end = () => {
        if (!done) {
          done = true;
          so.onEnd?.();
        }
      };
      const voice = synth ? pick(so.lang) : null;
      const said = text.replace(/^[\s.…]+/, "");
      if (!synth || !voice || !said) {
        queueMicrotask(end);
        return { cancel: end };
      }
      const offset = text.length - said.length;
      const u = new SpeechSynthesisUtterance(said);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = clamp4((o.base ?? 0.85) * (so.spec?.rate ?? 1) * (so.rate ?? 1), 0.5, 1.8);
      u.pitch = clamp4(so.spec?.pitch ?? 1, 0, 2);
      u.volume = clamp4((so.volume ?? 1) * (so.whisper ? 0.45 : 1), 0, 1);
      u.onstart = () => {
        if (!done) so.onStart?.();
      };
      u.onboundary = (e) => {
        if (!done && e.name === "word") so.onWord?.(e.charIndex + offset);
      };
      u.onend = end;
      u.onerror = end;
      if (current) synth.cancel();
      current = u;
      synth.speak(u);
      return { cancel: () => {
        if (done) return;
        end();
        if (current === u) {
          current = null;
          synth.cancel();
        }
      } };
    },
    cancel() {
      current = null;
      synth?.cancel();
    }
  };
}

// ../sahne/src/ui/builder-css.ts
var BUILDER_CSS = `
.sahne-bld {
  --sb-bg: #F5EEE2;
  --sb-card: #FFFCF5;
  --sb-sunk: #EDE3D3;
  --sb-ink: #2B2420;
  --sb-mute: #74675D;
  --sb-line: rgba(112, 90, 72, .2);
  --sb-accent: #2F7F7A;
  --sb-accent-ink: #FFFFFF;
  --sb-warm: #E0622C;
  --sb-focus: #E0622C;
  --sb-lift: .5px 1px 0 rgba(96, 66, 40, .10), 1.5px 3px 7px rgba(72, 48, 26, .13);
  --sb-rim: inset 0 1px 0 rgba(255, 255, 255, .7);
  --sb-radius: 14px;
  --sb-tile: 76px;
  --sb-thumb: 64px;
  container: sahne-bld / inline-size;
  height: 100%; min-height: 0; box-sizing: border-box; color: var(--sb-ink); background: var(--sb-bg);
  font-size: 15px; line-height: 1.35; color-scheme: light; -webkit-tap-highlight-color: transparent; text-align: start;
}
.sahne-bld[data-theme="dark"] {
  --sb-bg: #1F1B18; --sb-card: #2A2521; --sb-sunk: #171412; --sb-ink: #F1E8DC; --sb-mute: #A99C8F;
  --sb-line: rgba(255, 240, 220, .13); --sb-accent: #62B9B1; --sb-accent-ink: #10201F; --sb-warm: #F0874F; --sb-focus: #F0A060;
  --sb-lift: 0 1px 0 rgba(0, 0, 0, .3), 1.5px 3px 8px rgba(0, 0, 0, .35); --sb-rim: inset 0 1px 0 rgba(255, 245, 230, .06);
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  .sahne-bld:not([data-theme="light"]) {
    --sb-bg: #1F1B18; --sb-card: #2A2521; --sb-sunk: #171412; --sb-ink: #F1E8DC; --sb-mute: #A99C8F;
    --sb-line: rgba(255, 240, 220, .13); --sb-accent: #62B9B1; --sb-accent-ink: #10201F; --sb-warm: #F0874F; --sb-focus: #F0A060;
    --sb-lift: 0 1px 0 rgba(0, 0, 0, .3), 1.5px 3px 8px rgba(0, 0, 0, .35); --sb-rim: inset 0 1px 0 rgba(255, 245, 230, .06);
    color-scheme: dark;
  }
}
.sahne-bld *, .sahne-bld *::before, .sahne-bld *::after { box-sizing: border-box; }
.sahne-bld [hidden] { display: none !important; }
.sahne-bld button { font: inherit; color: inherit; margin: 0; cursor: pointer; -webkit-user-select: none; user-select: none; }
.sahne-bld :focus { outline: none; }
.sahne-bld :focus-visible { outline: 3px solid var(--sb-focus); outline-offset: 2px; }
.sahne-bld .sahne-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---- layout: the preview on top, the panel under it; side by side when wide ---- */
.sahne-bld-in { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.sahne-bld-view { flex: 0 0 auto; height: clamp(250px, 46vh, 440px); display: flex; flex-direction: column; overflow: hidden; background: var(--sb-bg); }
.sahne-bld-pic { position: relative; flex: 1 1 auto; min-height: 0; background: var(--sb-sunk); }
.sahne-bld-side { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
@container sahne-bld (min-width: 720px) {
  .sahne-bld-in { display: grid; grid-template-columns: minmax(300px, 5fr) 7fr; }
  .sahne-bld-view { height: auto; min-height: 420px; border-radius: 0; }
  .sahne-bld-side { border-inline-start: 1px solid var(--sb-line); }
}

/* ---- the preview ---- */
.sahne-bld-stage, .sahne-bld-still { position: absolute; inset: 0; }
.sahne-bld-stage { touch-action: manipulation; cursor: pointer; }
.sahne-bld-stage:focus-visible { outline-offset: -4px; }
.sahne-bld-still { display: grid; place-items: center; padding: 10px;
  background: radial-gradient(ellipse at 40% 30%, #FFF8EA 0%, #F3E7D3 60%, #E9DAC2 100%); }
.sahne-bld-still > svg { width: 100%; height: 100%; max-height: 100%; }
.sahne-bld[data-dark] .sahne-bld-still { filter: brightness(.92); }
/* round paper buttons over the preview */
.sahne-bld-tools { position: absolute; inset: 10px 10px auto 10px; display: flex; justify-content: space-between; gap: 8px; pointer-events: none; }
.sahne-bld-tools > div { display: flex; gap: 6px; pointer-events: auto; }
.sahne-bld-round {
  width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; display: grid; place-items: center;
  background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-rim), var(--sb-lift);
  transition: transform .12s ease, opacity .12s ease;
}
.sahne-bld-round svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sahne-bld-round:active { transform: translateY(1px) scale(.96); }
.sahne-bld-round[aria-disabled="true"] { opacity: .45; cursor: default; }
.sahne-bld-round[aria-pressed="true"] { background: var(--sb-accent); color: var(--sb-accent-ink); }
.sahne-bld-turn { position: absolute; inset-inline-end: 10px; bottom: 10px; }
/* the emotion strip: the learner's own face, acting */
.sahne-bld-moods {
  flex: none; display: flex; gap: 3px; justify-content: safe center;
  padding: 6px 6px 4px; overflow-x: auto; scrollbar-width: none; background: var(--sb-bg);
}
.sahne-bld-moods::-webkit-scrollbar { display: none; }
.sahne-bld-mood {
  flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; overflow: hidden;
  background: var(--sb-card); box-shadow: var(--sb-rim), var(--sb-lift); display: grid; place-items: center;
}
.sahne-bld-mood svg { width: 40px; height: 40px; display: block; }
.sahne-bld-mood[aria-checked="true"] { box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); }
/* a narrow builder shows six faces, so the strip never scrolls */
@container sahne-bld (max-width: 345px) { .sahne-bld-mood:nth-child(n+7) { display: none; } }

/* ---- tabs ---- */
.sahne-bld-tabs { flex: none; display: flex; gap: 2px; padding: 8px 8px 0; overflow-x: auto; scrollbar-width: none; background: var(--sb-bg); }
.sahne-bld-tabs::-webkit-scrollbar { display: none; }
.sahne-bld-tab {
  flex: 1 0 auto; min-height: 44px; padding: 8px 12px; border: 0; border-radius: 12px 12px 0 0; background: transparent;
  color: var(--sb-mute); font-weight: 600; font-size: 14px; white-space: nowrap; position: relative;
}
.sahne-bld-tab[aria-selected="true"] { background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-rim), 0 -1px 4px rgba(72, 48, 26, .06); }
.sahne-bld-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 30%; right: 30%; bottom: 6px; height: 3px; border-radius: 3px; background: var(--sb-accent); }
.sahne-bld-tab:focus-visible { outline-offset: -3px; }

/* ---- the panel ---- */
.sahne-bld-panel { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--sb-card); padding: 4px 14px 18px; }
.sahne-bld-field { padding: 12px 0 6px; border-top: 1px dashed var(--sb-line); }
.sahne-bld-field:first-child { border-top: 0; }
.sahne-bld-fh { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
.sahne-bld-fh h3 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--sb-mute); }
.sahne-bld-note { font-size: 12.5px; color: var(--sb-mute); }
.sahne-bld-note.sahne-bld-warn { color: var(--sb-warm); font-weight: 600; }
.sahne-bld-sub { margin: 10px 0 6px; font-size: 12.5px; color: var(--sb-mute); font-weight: 600; }

/* option tiles: a thumbnail of the character wearing it, on a sunk paper card */
.sahne-bld-opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--sb-tile), 1fr)); gap: 8px; }
.sahne-bld-opts[data-few] { grid-template-columns: repeat(auto-fill, minmax(var(--sb-tile), 84px)); }
.sahne-bld-opt {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; min-height: 44px;
  padding: 5px 4px 6px; border: 0; border-radius: 12px; background: transparent; text-align: center;
}
.sahne-bld-thumb {
  width: var(--sb-thumb); height: var(--sb-thumb); border-radius: 12px; background: var(--sb-sunk); display: grid; place-items: center; overflow: hidden;
  transition: transform .14s ease, box-shadow .14s ease;
}
.sahne-bld-thumb > svg { width: 100%; height: 100%; display: block; }
.sahne-bld-thumb:empty::before { content: ""; width: 40%; height: 40%; border-radius: 50%; background: var(--sb-line); }
.sahne-bld-lab { font-size: 12px; line-height: 1.2; color: var(--sb-mute); max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.sahne-bld-opt[aria-checked="true"] .sahne-bld-thumb { background: var(--sb-bg); box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); transform: translateY(-1px); }
.sahne-bld-opt[aria-checked="true"] .sahne-bld-lab { color: var(--sb-ink); font-weight: 600; }
.sahne-bld-opt:hover .sahne-bld-thumb { box-shadow: 0 0 0 1.5px var(--sb-line), var(--sb-lift); }
.sahne-bld-opt[aria-checked="true"]:hover .sahne-bld-thumb { box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); }
.sahne-bld-opt[aria-disabled="true"] { cursor: default; }
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb { position: relative; }
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb > svg { filter: grayscale(.7); }
/* a locked option is veiled in its own card's paper, so it reads in both themes */
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb::after { content: ""; position: absolute; inset: 0; background: var(--sb-sunk); opacity: .5; }
.sahne-bld-lock {
  position: absolute; top: 2px; inset-inline-end: 2px; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-lift);
}
.sahne-bld-lock svg { width: 13px; height: 13px; fill: currentColor; }
.sahne-bld-badge {
  position: absolute; top: 3px; inset-inline-start: 3px; padding: 1px 6px; border-radius: 99px; font-size: 10.5px; font-weight: 700;
  background: var(--sb-warm); color: #fff; letter-spacing: .02em;
}
.sahne-bld-none { font-size: 22px; color: var(--sb-mute); }
.sahne-bld-hidden .sahne-bld-opts { opacity: .6; }

/* colour swatches: paper discs */
.sahne-bld-sws { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 2px; }
.sahne-bld-sw { position: relative; width: 44px; height: 44px; border: 0; padding: 0; background: transparent; border-radius: 50%; display: grid; place-items: center; justify-self: center; }
.sahne-bld-sw > span { width: 32px; height: 32px; border-radius: 50%; background: var(--c); box-shadow: inset 1px 1.5px 0 rgba(255, 255, 255, .35), inset -1px -2px 0 rgba(0, 0, 0, .12), .5px 1px 2px rgba(72, 48, 26, .25); transition: transform .12s ease; }
.sahne-bld-sw[aria-checked="true"] > span { transform: scale(1.06); box-shadow: 0 0 0 3px var(--sb-card), 0 0 0 5.5px var(--sb-accent); }
.sahne-bld-sw[aria-disabled="true"] > span { opacity: .45; }
.sahne-bld-sw .sahne-bld-lock { top: 0; inset-inline-end: 0; width: 18px; height: 18px; }
.sahne-bld-sw .sahne-bld-lock svg { width: 10px; height: 10px; }

/* small choices: which colour, the side, a tag filter, "more" */
.sahne-bld-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.sahne-bld-chip {
  min-height: 36px; padding: 6px 12px; border: 0; border-radius: 99px; display: inline-flex; align-items: center; gap: 7px;
  background: var(--sb-sunk); color: var(--sb-ink); font-size: 13.5px; position: relative;
}
.sahne-bld-chip::before { content: ""; position: absolute; inset: -4px 0; }
.sahne-bld-chip[aria-checked="true"], .sahne-bld-chip[aria-pressed="true"] { background: var(--sb-accent); color: var(--sb-accent-ink); font-weight: 600; }
.sahne-bld-chip i { width: 16px; height: 16px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1.5px var(--sb-card); }
.sahne-bld-more { margin-top: 8px; background: transparent; box-shadow: inset 0 0 0 1.5px var(--sb-line); color: var(--sb-accent); font-weight: 600; min-height: 44px; }

/* the height slider */
.sahne-bld-range { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; font-size: 13px; color: var(--sb-mute); }
.sahne-bld-range input { width: 100%; min-height: 44px; margin: 0; accent-color: var(--sb-accent); background: transparent; }

/* ---- the foot: Cancel and Done ---- */
.sahne-bld-foot { flex: none; display: flex; justify-content: flex-end; gap: 10px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: var(--sb-card); border-top: 1px solid var(--sb-line); }
.sahne-bld-btn { min-height: 46px; min-width: 104px; padding: 10px 20px; border: 0; border-radius: 99px; font-weight: 700; background: var(--sb-sunk); }
.sahne-bld-btn.sahne-bld-primary { background: var(--sb-accent); color: var(--sb-accent-ink); box-shadow: var(--sb-rim), var(--sb-lift); }
.sahne-bld-btn:active { transform: translateY(1px); }

@media (prefers-reduced-motion: reduce) {
  .sahne-bld *, .sahne-bld *::before, .sahne-bld *::after { transition: none !important; animation: none !important; }
}
.sahne-bld[data-still] *, .sahne-bld[data-still] *::before { transition: none !important; }
@media (forced-colors: active) {
  .sahne-bld-opt[aria-checked="true"] .sahne-bld-thumb, .sahne-bld-sw[aria-checked="true"] > span, .sahne-bld-mood[aria-checked="true"] { outline: 3px solid Highlight; }
  .sahne-bld-tab[aria-selected="true"] { outline: 2px solid Highlight; }
}
`;

// ../sahne/src/ui/builder-plan.ts
var WORDS = {
  en: {
    builder: "Character builder",
    preview: "Your character",
    wave: "Your character: tap to wave",
    undo: "Undo",
    redo: "Redo",
    randomize: "Surprise me",
    reset: "Start over",
    done: "Done",
    cancel: "Cancel",
    turn: "Turn around",
    front: "Turn to the front",
    moods: "Expressions",
    changed: "Changed",
    random: "A new character",
    undone: "Undone",
    redone: "Redone",
    resetDone: "Back to the start",
    locked: "Locked",
    lockedHow: "Not unlocked yet",
    hiddenBy: "Covered by another item",
    max: "At most {n}",
    more: "More",
    all: "All",
    colour: "Colour",
    colourN: "Colour {n}",
    ink: "Pattern colour {n}",
    pattern: "Pattern",
    side: "Side",
    sides: { l: "Left", r: "Right", b: "Both" },
    shorter: "Shorter",
    taller: "Taller",
    cast: "cast",
    hidden: "hidden",
    emotions: { neutral: "Calm", happy: "Happy", laugh: "Laughing", surprised: "Surprised", curious: "Curious", shy: "Shy", sad: "Sad", proud: "Proud", tired: "Tired", confused: "Confused" }
  },
  tr: {
    builder: "Karakter olu\u015Fturucu",
    preview: "Karakterin",
    wave: "Karakterin: dokun, el sallas\u0131n",
    undo: "Geri al",
    redo: "Yinele",
    randomize: "\u015Ea\u015F\u0131rt beni",
    reset: "Ba\u015Ftan ba\u015Fla",
    done: "Tamam",
    cancel: "Vazge\xE7",
    turn: "Arkas\u0131n\u0131 d\xF6n",
    front: "\xD6n\xFCn\xFC d\xF6n",
    moods: "\u0130fadeler",
    changed: "De\u011Fi\u015Fti",
    random: "Yeni bir karakter",
    undone: "Geri al\u0131nd\u0131",
    redone: "Yinelendi",
    resetDone: "Ba\u015Fa d\xF6n\xFCld\xFC",
    locked: "Kilitli",
    lockedHow: "Hen\xFCz a\xE7\u0131lmad\u0131",
    hiddenBy: "Ba\u015Fka bir par\xE7a \xF6rt\xFCyor",
    max: "En \xE7ok {n}",
    more: "Daha fazla",
    all: "T\xFCm\xFC",
    colour: "Renk",
    colourN: "Renk {n}",
    ink: "Desen rengi {n}",
    pattern: "Desen",
    side: "Taraf",
    sides: { l: "Sol", r: "Sa\u011F", b: "\u0130ki yanda" },
    shorter: "K\u0131sa",
    taller: "Uzun",
    cast: "kadro",
    hidden: "gizli",
    emotions: { neutral: "Sakin", happy: "Mutlu", laugh: "G\xFCl\xFCyor", surprised: "\u015Ea\u015Fk\u0131n", curious: "Merakl\u0131", shy: "Utanga\xE7", sad: "\xDCzg\xFCn", proud: "Gururlu", tired: "Yorgun", confused: "Kafas\u0131 kar\u0131\u015F\u0131k" }
  }
};
function uiWords(lang, over = {}) {
  const base = WORDS[lang === "tr" ? "tr" : "en"];
  return { ...base, ...over, sides: { ...base.sides, ...over.sides }, emotions: { ...base.emotions, ...over.emotions } };
}
var fill = (s, n) => s.replace("{n}", String(n));
function fieldFraming(field) {
  if (field.startsWith("face.") || field === "facialHair" || field === "hair.style" || ["wear.head", "wear.hat", "wear.hair", "wear.eyes", "wear.ears", "wear.aid"].includes(field)) return "head";
  if (["outfit.top", "outfit.outer", "wear.neck", "skin"].includes(field)) return "bust";
  return "full";
}
function sectionFraming(section) {
  return section === "face" || section === "hair" ? "head" : section === "extras" ? "bust" : "full";
}
var STRIP = ["neutral", "happy", "laugh", "surprised", "shy", "sad", "proud"];
var emotionStrip = (have, max = 7) => {
  const s = new Set(have);
  return STRIP.filter((e) => s.has(e)).slice(0, max);
};
var TAPS = ["wave", "nod", "cheer", "hand_heart", "shrug", "think", "welcome"];
var tapGestures = (have) => {
  const s = new Set(have);
  return TAPS.filter((g) => s.has(g));
};
var LONG = 16;
function tagFilters(options, max = 8) {
  const parts = options.filter((o) => o.value !== null);
  if (parts.length < LONG) return [];
  const n = /* @__PURE__ */ new Map();
  for (const o of parts) for (const t of new Set(o.tags ?? [])) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].filter(([, c]) => c >= 2 && c < parts.length).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([t]) => t);
}
var passes = (o, tag2) => tag2 === null || o.value === null || !!o.tags?.includes(tag2) || tag2 === "cast" && !!o.reserved;
function colourSlots(f, w) {
  const out = [];
  for (let i = 0; i < f.colors; i++) out.push({ index: i, label: f.colors === 1 ? w.colour : fill(w.colourN, i + 1) });
  for (let k = 0; k < (f.inks ?? 0); k++) out.push({ index: f.colors + k, label: fill(w.ink, k + 1) });
  return out;
}
function withMark(have, v, max) {
  if (have.includes(v)) return have;
  return have.length < max ? [...have, v] : [v];
}
function roving(key, i, n) {
  if (n <= 0) return -1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % n;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + n) % n;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return -1;
  }
}

// ../sahne/src/ui/builder.ts
var STYLE_ID2 = "sahne-builder-css";
var SVG2 = "http://www.w3.org/2000/svg";
var SLICE = 10;
var ICONS = {
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3",
  redo: "m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h3",
  dice: "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  turn: "M7 7.5C4.6 8.4 3 9.6 3 11c0 2.8 4 5 9 5s9-2.2 9-5c0-1.4-1.6-2.6-4-3.5M12 16l-2.5-2.5M12 16l-2.5 2.5M12 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
};
var LOCK = "M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z";
var serial = 0;
function h(tag2, attrs = {}, ...kids) {
  const el = document.createElement(tag2);
  for (const [k, v] of Object.entries(attrs)) if (v !== void 0 && v !== false) el.setAttribute(k === "cls" ? "class" : k, v === true ? "" : v);
  for (const c of kids) if (c !== null) el.append(c);
  return el;
}
function icon(d) {
  const s = document.createElementNS(SVG2, "svg"), p = document.createElementNS(SVG2, "path");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  p.setAttribute("d", d);
  s.append(p);
  return s;
}
var lockIcon = () => {
  const s = icon(LOCK);
  s.style.stroke = "none";
  return h("span", { cls: "sahne-bld-lock", "aria-hidden": "true" }, s);
};
function mountBuilder(host, o) {
  const { kit } = o, author = o.mode === "author", uid = `sb${++serial}`;
  const doc0 = host.ownerDocument;
  if (!doc0.getElementById(STYLE_ID2)) doc0.head.append(Object.assign(doc0.createElement("style"), { id: STYLE_ID2, textContent: BUILDER_CSS }));
  let unlocked = new Set(o.unlocked ?? []), lang = o.lang ?? "en", words = uiWords(lang, o.words);
  const builder = createBuilder(kit, o.doc, {
    unlocked: (t) => unlocked.has(t),
    builds: o.builds,
    lang,
    trusted: author,
    cast: author,
    offer: author ? void 0 : o.offer
  });
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motion = o.motion ?? (reduced ? "still" : "full"), theme = o.theme ?? "auto";
  let section = builder.sections().some((s) => s.id === o.section) ? o.section : "body";
  let framing = sectionFraming(section), mood = "neutral", back = false, taps = 0, sid = "me";
  const slotOf = /* @__PURE__ */ new Map(), tagOf = /* @__PURE__ */ new Map(), notes = /* @__PURE__ */ new Map();
  const kw = (k, fb) => kit.labels?.[k]?.[lang] ?? fb;
  const unlockText = (t) => t && o.unlockLabel?.(t) || words.lockedHow;
  const opts = { trusted: author };
  const root = h("div", { cls: "sahne-bld", role: "group", lang });
  const live = h("div", { cls: "sahne-sr", "aria-live": "polite" });
  const stageHost = h("div", { cls: "sahne-bld-stage" });
  const stillEl = h("div", { cls: "sahne-bld-still", hidden: true });
  const btn = (name, cls = "sahne-bld-round") => {
    const b = h("button", { type: "button", cls, "data-act": name });
    b.append(icon(ICONS[name]));
    return b;
  };
  const undoB = btn("undo"), redoB = btn("redo"), diceB = btn("dice"), resetB = btn("reset"), turnB = btn("turn", "sahne-bld-round sahne-bld-turn");
  const moodsEl = h("div", { cls: "sahne-bld-moods", role: "radiogroup" });
  const view = h("div", { cls: "sahne-bld-view" }, h(
    "div",
    { cls: "sahne-bld-pic" },
    stageHost,
    stillEl,
    h("div", { cls: "sahne-bld-tools" }, h("div", {}, undoB, redoB), h("div", {}, diceB, resetB)),
    turnB
  ), moodsEl);
  const tabsEl = h("div", { cls: "sahne-bld-tabs", role: "tablist" });
  const panel = h("div", { cls: "sahne-bld-panel", role: "tabpanel", id: `${uid}-panel`, tabindex: "0" });
  const doneB = h("button", { type: "button", cls: "sahne-bld-btn sahne-bld-primary", "data-act": "done" });
  const cancelB = h("button", { type: "button", cls: "sahne-bld-btn", "data-act": "cancel" });
  const foot = h("div", { cls: "sahne-bld-foot" }, o.onCancel ? cancelB : null, o.onDone ? doneB : null);
  if (!o.onCancel && !o.onDone) foot.hidden = true;
  root.append(h("div", { cls: "sahne-bld-in" }, view, h("div", { cls: "sahne-bld-side" }, tabsEl, panel, foot)), live);
  host.append(root);
  const say = (t) => {
    live.textContent = "";
    requestAnimationFrame(() => {
      live.textContent = t;
    });
  };
  let queue = [], posted = false;
  const ch2 = new MessageChannel();
  ch2.port1.onmessage = () => {
    posted = false;
    const t = performance.now();
    while (queue.length && performance.now() - t < SLICE) queue.shift()();
    if (queue.length) {
      posted = true;
      ch2.port2.postMessage(0);
    }
  };
  const runJobs = (jobs) => {
    queue = jobs;
    if (!posted && jobs.length) {
      posted = true;
      ch2.port2.postMessage(0);
    }
  };
  const pic = (el, make, po) => () => {
    if (!el.isConnected) return;
    const d = make();
    if (!d) return;
    const key = `${po?.framing}|${po?.emotion ?? ""}|${po?.view ?? ""}|${serialize(d)}`;
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    el.innerHTML = portrait(d, kit, { ...opts, ...po });
  };
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  function dark() {
    return theme === "dark" || theme === "auto" && !!mq?.matches;
  }
  function paintTheme() {
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    root.toggleAttribute("data-dark", dark());
    root.toggleAttribute("data-still", motion === "still");
    if (stage) {
      stage.dim = dark() ? 0.92 : 1;
      stage.setMotion(motion);
    }
  }
  const onScheme = () => paintTheme();
  mq?.addEventListener("change", onScheme);
  let stage = null;
  if (o.preview !== "still") {
    const s = mountStage(stageHost, { kit, bubbles: false, motion, dim: dark() ? 0.92 : 1, onContext: () => showPreview() });
    if (s.webgl) {
      stage = s;
      sid = s.studio(builder.doc, { framing, backdrop: o.backdrop ?? "wall", label: words.preview, trusted: author });
    } else s.destroy();
  }
  const usingStill = () => !stage || stage.lost;
  const gestures = tapGestures(Object.keys(kit.gestures ?? {}));
  let stillDoc = null, stillRaf = 0;
  function drawStill() {
    if (!usingStill() || stillRaf) return;
    stillRaf = requestAnimationFrame(() => {
      stillRaf = 0;
      stillEl.innerHTML = portrait(stillDoc ?? builder.doc, kit, { ...opts, framing, view: back ? "back" : "front", emotion: mood, detail: 400, idPrefix: `${uid}p`, label: words.preview });
    });
  }
  function showPreview() {
    const still = usingStill();
    stillEl.hidden = !still;
    stageHost.hidden = still;
    if (still) {
      stageHost.removeAttribute("role");
      stageHost.removeAttribute("tabindex");
      drawStill();
    } else {
      stageHost.setAttribute("role", "button");
      stageHost.tabIndex = 0;
      stageHost.setAttribute("aria-label", words.wave);
    }
  }
  function look(d) {
    if (stage && !stage.lost) void stage.setAvatar(sid, d, opts);
    stillDoc = d;
    drawStill();
  }
  function frame(f) {
    if (f === framing) return;
    framing = f;
    stage?.setFraming(f);
    drawStill();
  }
  function wave() {
    if (!stage || stage.lost || !gestures.length || motion === "still") return;
    stage.gesture(sid, gestures[taps++ % gestures.length]);
  }
  stageHost.addEventListener("click", wave);
  stageHost.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      wave();
    }
  });
  const emos = emotionStrip(Object.keys(kit.face?.emotions ?? {}));
  function labelStatic() {
    root.setAttribute("lang", lang);
    root.setAttribute("aria-label", words.builder);
    const lab = (b, t) => {
      b.setAttribute("aria-label", t);
      b.title = t;
    };
    lab(undoB, words.undo);
    lab(redoB, words.redo);
    lab(diceB, words.randomize);
    lab(resetB, words.reset);
    lab(turnB, back ? words.front : words.turn);
    doneB.textContent = words.done;
    cancelB.textContent = words.cancel;
    moodsEl.setAttribute("aria-label", words.moods);
    tabsEl.setAttribute("aria-label", words.builder);
    const secs = builder.sections();
    if (tabsEl.children.length !== secs.length) tabsEl.replaceChildren(...secs.map((s) => h("button", { type: "button", cls: "sahne-bld-tab", role: "tab", id: `${uid}-tab-${s.id}`, "aria-controls": panel.id, "data-sec": s.id })));
    secs.forEach((s, i) => {
      const b = tabsEl.children[i], on = s.id === section;
      b.textContent = s.label;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `${uid}-tab-${section}`);
    if (moodsEl.children.length !== emos.length) moodsEl.replaceChildren(...emos.map((e) => h("button", { type: "button", cls: "sahne-bld-mood", role: "radio", "data-emo": e })));
    emos.forEach((e, i) => {
      const b = moodsEl.children[i], t = words.emotions[e] ?? e;
      b.setAttribute("aria-label", t);
      b.title = t;
    });
    showPreview();
  }
  function syncTools() {
    undoB.setAttribute("aria-disabled", String(!builder.canUndo));
    redoB.setAttribute("aria-disabled", String(!builder.canRedo));
    turnB.setAttribute("aria-pressed", String(back));
  }
  const enc = (v) => v === null || v === void 0 ? "" : String(v);
  const fieldsNow = () => builder.fields(section);
  function slotsOf(f) {
    if (f.kind === "color") return [{ index: 0, label: f.label }];
    return colourSlots(f, { colour: kw("colour", words.colour), colourN: words.colourN, ink: words.ink }).filter((s) => s.index <= f.colors || builder.getColor(f.id, s.index - 1) !== null);
  }
  function activeSlot(f) {
    const slots = slotsOf(f), want = slotOf.get(f.id) ?? 0;
    return slots.some((s) => s.index === want) ? want : slots[0]?.index ?? 0;
  }
  function signature() {
    return JSON.stringify([lang, section, [...unlocked].sort(), fieldsNow().map((f) => {
      const slot = activeSlot(f);
      return [
        f,
        builder.options(f.id).map((x) => [x.value, x.label, x.locked, x.reserved]),
        slotsOf(f).map((s) => s.label),
        slot,
        f.colors || f.kind === "color" ? builder.colorOptions(f.id, slot).map((c) => [c.id, c.locked]) : 0,
        f.patterns ? builder.patternOptions(f.id).map((x) => [x.value, x.locked]) : 0,
        o.more && builder.hasMore(f.id),
        tagOf.get(f.id) ?? null,
        notes.get(f.id)
      ];
    })]);
  }
  function optionTile(f, x, what, role) {
    const v = enc(x.value), thumb = h("span", { cls: "sahne-bld-thumb", "aria-hidden": "true" });
    const lockId = x.locked ? `${uid}-l-${f.id}-${what}-${v}` : void 0;
    const b = h("button", {
      type: "button",
      cls: "sahne-bld-opt",
      role,
      "aria-checked": "false",
      tabindex: "-1",
      "data-v": v,
      "aria-disabled": x.locked ? "true" : void 0,
      "aria-describedby": lockId,
      title: x.locked ? `${x.label} \xB7 ${words.locked}: ${unlockText(x.unlock)}` : x.label
    }, thumb, h("span", { cls: "sahne-bld-lab" }, x.label));
    if (x.locked) b.append(lockIcon(), h("span", { cls: "sahne-sr", id: lockId }, `${words.locked}: ${unlockText(x.unlock)}`));
    if (x.reserved) b.append(h("span", { cls: "sahne-bld-badge", "aria-hidden": "true" }, x.reserved === "cast" ? words.cast : words.hidden));
    if (x.reserved) b.setAttribute("aria-label", `${x.label} (${x.reserved === "cast" ? words.cast : words.hidden})`);
    return b;
  }
  function group(f, what, role, label, kids, cls) {
    const g = h("div", { cls, role, "aria-label": label, "data-field": f.id, "data-what": what });
    g.append(...kids);
    return g;
  }
  function fieldEl(f) {
    const hid = `${uid}-f-${f.id}`, sec = h("section", { cls: "sahne-bld-field" + (f.hidden ? " sahne-bld-hidden" : ""), "aria-labelledby": hid, "data-field": f.id });
    const head = h("div", { cls: "sahne-bld-fh" }, h("h3", { id: hid }, f.label));
    const note2 = notes.get(f.id);
    if (note2) head.append(h("span", { cls: "sahne-bld-note" + (note2.warn ? " sahne-bld-warn" : "") }, note2.text));
    else if (f.hidden) head.append(h("span", { cls: "sahne-bld-note" }, words.hiddenBy));
    sec.append(head);
    if (f.kind === "number") {
      const r = h("input", { type: "range", min: "0", max: "1", step: "0.01", "aria-labelledby": hid, "data-field": f.id, "data-what": "range" });
      r.value = String(builder.get(f.id));
      sec.append(h("div", { cls: "sahne-bld-range" }, h("span", { "aria-hidden": "true" }, words.shorter), r, h("span", { "aria-hidden": "true" }, words.taller)));
      return sec;
    }
    if (f.kind !== "color") {
      const all = builder.options(f.id), tags = tagFilters(all), tag2 = tags.includes(tagOf.get(f.id) ?? "") ? tagOf.get(f.id) : null;
      const reserved = tags.length > 0 && all.some((x) => x.reserved);
      if (tags.length) {
        const chips = [null, ...reserved ? ["cast"] : [], ...tags.filter((t) => t !== "cast")].map((t) => h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": String(t === tag2), tabindex: t === tag2 ? "0" : "-1", "data-v": enc(t) }, t === null ? words.all : t === "cast" && reserved ? words.cast : t));
        sec.append(group(f, "tag", "radiogroup", `${f.label}: ${words.all}`, chips, "sahne-bld-chips"));
      }
      const multi = f.kind === "multi", shown = all.filter((x) => passes(x, tag2));
      const g = group(f, "opt", multi ? "group" : "radiogroup", f.label, shown.map((x) => optionTile(f, x, "opt", multi ? "checkbox" : "radio")), "sahne-bld-opts");
      g.setAttribute("aria-labelledby", hid);
      g.removeAttribute("aria-label");
      if (shown.length <= 6) g.setAttribute("data-few", "");
      sec.append(g);
      if (o.more && !author && builder.hasMore(f.id)) sec.append(h("button", { type: "button", cls: "sahne-bld-chip sahne-bld-more", "data-act": "more", "data-field": f.id }, words.more));
    }
    const slots = f.kind === "color" ? [{ index: 0, label: f.label }] : f.colors ? slotsOf(f) : [];
    if (slots.length) {
      const slot = activeSlot(f);
      if (f.kind !== "color") sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, kw("colour", words.colour)));
      if (slots.length > 1) {
        sec.append(group(f, "slot", "radiogroup", kw("colour", words.colour), slots.map((s) => {
          const c = builder.getColor(f.id, s.index), dot2 = h("i", { "aria-hidden": "true" });
          dot2.style.setProperty("--c", c ? kit.color(c) : "transparent");
          return h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": String(s.index === slot), tabindex: "-1", "data-v": String(s.index) }, dot2, s.label);
        }), "sahne-bld-chips"));
      }
      const label = f.kind === "color" ? f.label : `${f.label}: ${slots.find((s) => s.index === slot)?.label ?? ""}`;
      sec.append(group(f, "sw", "radiogroup", label, builder.colorOptions(f.id, slot).map((c) => {
        const b = h("button", { type: "button", cls: "sahne-bld-sw", role: "radio", "aria-checked": "false", tabindex: "-1", "data-v": c.id, "aria-label": c.locked ? `${c.label} (${words.locked}: ${unlockText(c.unlock)})` : c.label, title: c.label, "aria-disabled": c.locked ? "true" : void 0 }, h("span", {}));
        b.style.setProperty("--c", c.hex);
        if (c.locked) b.append(lockIcon());
        return b;
      }), "sahne-bld-sws"));
    }
    if (f.patterns) {
      const pl = kw("pattern", words.pattern);
      sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, pl));
      const g = group(f, "pat", "radiogroup", `${f.label}: ${pl}`, builder.patternOptions(f.id).map((x) => optionTile(f, x, "pat", "radio")), "sahne-bld-opts");
      g.setAttribute("data-few", "");
      sec.append(g);
    }
    if (f.sides && f.sides.length > 1) {
      const sl = kw("side", words.side);
      sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, sl), group(f, "side", "radiogroup", `${f.label}: ${sl}`, f.sides.map((s) => h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": "false", tabindex: "-1", "data-v": s }, words.sides[s] ?? s)), "sahne-bld-chips"));
    }
    return sec;
  }
  function valueOf(field, what) {
    switch (what) {
      case "opt": {
        const v = builder.get(field);
        return Array.isArray(v) ? v : enc(v);
      }
      case "sw": {
        const f = builder.field(field);
        return enc(f ? builder.getColor(field, f.kind === "color" ? 0 : activeSlot(f)) : null);
      }
      case "pat":
        return enc(builder.getPattern(field));
      case "side":
        return enc(builder.getSide(field));
      case "slot": {
        const f = builder.field(field);
        return f ? String(activeSlot(f)) : "0";
      }
      case "tag":
        return enc(tagOf.get(field) ?? null);
      default:
        return "";
    }
  }
  function sync() {
    const vis = [], rest = [], thumbs = [];
    for (const g of panel.querySelectorAll("[data-what]")) {
      const field = g.dataset.field, what = g.dataset.what;
      if (what === "range") {
        const r = g;
        if (!dragging) r.value = String(builder.get(field));
        continue;
      }
      const cur = valueOf(field, what), items = [...g.querySelectorAll(":scope > button[data-v]")];
      let stop = null;
      for (const b of items) {
        const on = Array.isArray(cur) ? cur.includes(b.dataset.v) : cur === b.dataset.v;
        b.setAttribute("aria-checked", String(on));
        if (on && !stop) stop = b;
      }
      const focus = g.contains(document.activeElement) ? document.activeElement : null;
      for (const b of items) b.tabIndex = b === (focus ?? stop ?? items[0]) ? 0 : -1;
      if (what !== "opt" && what !== "pat") continue;
      const f = builder.field(field);
      if (!f) continue;
      const fr = fieldFraming(field), detail = 96;
      for (const b of items) {
        const el = b.querySelector(".sahne-bld-thumb"), v = b.dataset.v === "" ? null : b.dataset.v;
        const make = what === "pat" ? () => withPattern(field, v) : f.kind === "multi" ? () => builder.preview(field, withMark(cur, v, f.max ?? 3)) ?? builder.preview(field, [v]) : () => builder.preview(field, v) ?? lockedDoc(field, v);
        thumbs.push([b, pic(el, make, { framing: fr, detail, idPrefix: `${uid}t` })]);
      }
    }
    const pr = panel.getBoundingClientRect();
    for (const [b, job] of thumbs) {
      const r = b.getBoundingClientRect();
      (r.bottom > pr.top && r.top < pr.bottom ? vis : rest).push(job);
    }
    for (const b of moodsEl.querySelectorAll("button[data-emo]")) {
      const on = b.dataset.emo === mood;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
      vis.push(pic(b, () => builder.doc, { framing: "head", emotion: b.dataset.emo, detail: 48, idPrefix: `${uid}m` }));
    }
    syncTools();
    runJobs([...vis, ...rest]);
  }
  function lockedDoc(field, v) {
    const d = JSON.parse(serialize(builder.doc)), ks = field.split("."), last2 = ks.pop();
    let c = d;
    for (const k of ks) c = c[k] ??= {};
    c[last2] = v === null ? void 0 : { id: v };
    return d;
  }
  function withPattern(field, id) {
    const d = JSON.parse(serialize(builder.doc)), g = at(d, field);
    if (!isObj(g)) return null;
    if (id === null) {
      delete g.pattern;
      delete g.inks;
    } else g.pattern = id;
    return d;
  }
  let sig = "", dragging = false;
  function render(force = false) {
    const next = signature();
    if (force || next !== sig) {
      sig = next;
      const a = document.activeElement, inside2 = !!a && panel.contains(a);
      const g = a?.closest("[data-what]"), key = inside2 && g ? [g.dataset.field, g.dataset.what, a?.dataset.v] : null;
      const top = panel.scrollTop;
      panel.replaceChildren(...fieldsNow().map(fieldEl));
      panel.scrollTop = top;
      if (key) {
        const g2 = panel.querySelector(`[data-field="${CSS.escape(key[0])}"][data-what="${key[1]}"]`);
        const t = key[1] === "range" ? g2 : g2?.querySelector(`button[data-v="${CSS.escape(key[2] ?? "")}"]`) ?? g2?.querySelector('button[aria-checked="true"]') ?? g2?.querySelector("button");
        (t ?? panel).focus({ preventScroll: true });
      } else if (inside2) panel.focus({ preventScroll: true });
    }
    sync();
  }
  function note(field, text, warn = true) {
    notes.set(field, { text, warn });
    say(text);
    render();
  }
  function choose(g, b) {
    const field = g.dataset.field, what = g.dataset.what, v = b.dataset.v === "" ? null : b.dataset.v;
    const f = builder.field(field);
    notes.delete(field);
    if (b.getAttribute("aria-disabled") === "true") {
      const text = b.querySelector(".sahne-sr")?.textContent ?? (b.getAttribute("aria-label") ?? words.locked);
      return note(field, text);
    }
    if (what !== "tag" && what !== "slot") frame(fieldFraming(field));
    let ok = true;
    switch (what) {
      case "opt":
        ok = builder.set(field, v);
        if (!ok && f?.kind === "multi") return note(field, fill(words.max, f.max ?? 3));
        break;
      case "sw":
        ok = f ? builder.setColor(field, f.kind === "color" ? 0 : activeSlot(f), v) : false;
        break;
      case "pat":
        ok = builder.setPattern(field, v);
        break;
      case "side":
        ok = builder.setSide(field, v);
        break;
      case "slot":
        slotOf.set(field, Number(v));
        break;
      case "tag":
        tagOf.set(field, v);
        break;
    }
    render();
    if (!ok) say(words.lockedHow);
  }
  panel.addEventListener("click", (e) => {
    const t = e.target, b = t.closest("button");
    if (!b) return;
    if (b.dataset.act === "more") {
      builder.more(b.dataset.field);
      return;
    }
    const g = b.parentElement;
    if (g?.dataset.what) choose(g, b);
  });
  panel.addEventListener("keydown", (e) => {
    const b = e.target.closest("button[data-v]"), g = b?.parentElement;
    if (!b || !g?.dataset.what) return;
    const items = [...g.querySelectorAll(":scope > button[data-v]")], i = roving(e.key, items.indexOf(b), items.length);
    if (i < 0) return;
    e.preventDefault();
    const n = items[i];
    for (const x of items) x.tabIndex = x === n ? 0 : -1;
    n.focus();
    if (g.getAttribute("role") === "radiogroup") {
      if (n.getAttribute("aria-disabled") === "true") say(n.getAttribute("aria-label") ?? n.querySelector(".sahne-sr")?.textContent ?? words.locked);
      else choose(g, n);
    }
  });
  panel.addEventListener("input", (e) => {
    const r = e.target;
    if (r.dataset.what !== "range") return;
    dragging = true;
    frame("full");
    const d = builder.preview(r.dataset.field, Number(r.value));
    if (d) look(d);
  });
  panel.addEventListener("change", (e) => {
    const r = e.target;
    if (r.dataset.what !== "range") return;
    dragging = false;
    stillDoc = null;
    builder.set(r.dataset.field, Number(r.value));
  });
  panel.addEventListener("focusin", (e) => {
    const f = e.target.closest("[data-field]")?.dataset.field;
    if (f && e.target.matches("button[data-v], input")) frame(fieldFraming(f));
  });
  function setSection(id, focus = false) {
    if (!builder.sections().some((s) => s.id === id)) return;
    section = id;
    frame(sectionFraming(id));
    labelStatic();
    panel.scrollTop = 0;
    render(true);
    if (focus) tabsEl.querySelector(`[data-sec="${id}"]`)?.focus();
  }
  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]");
    if (b) setSection(b.dataset.sec);
  });
  tabsEl.addEventListener("keydown", (e) => {
    const tabs = [...tabsEl.querySelectorAll("[data-sec]")], i = roving(e.key, tabs.findIndex((t) => t.dataset.sec === section), tabs.length);
    if (i < 0) return;
    e.preventDefault();
    setSection(tabs[i].dataset.sec, true);
  });
  function setMood(e) {
    mood = e;
    if (stage && !stage.lost) stage.mood(sid, e);
    drawStill();
    sync();
  }
  moodsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-emo]");
    if (b) setMood(b.dataset.emo);
  });
  moodsEl.addEventListener("keydown", (e) => {
    const shown = [...moodsEl.querySelectorAll("[data-emo]")].filter((b) => b.offsetParent !== null), i = roving(e.key, shown.findIndex((b) => b.dataset.emo === mood), shown.length);
    if (i < 0) return;
    e.preventDefault();
    setMood(shown[i].dataset.emo);
    shown[i].focus();
  });
  let dice = 0;
  const started = serialize(builder.doc);
  const ask = async (a) => !o.confirm || serialize(builder.doc) === started || await o.confirm(a, builder.doc);
  async function act(name) {
    switch (name) {
      case "undo":
        if (builder.undo()) say(words.undone);
        break;
      case "redo":
        if (builder.redo()) say(words.redone);
        break;
      case "dice":
        builder.randomize(o.seed?.() ?? `${Date.now()}:${++dice}:${Math.random()}`);
        say(words.random);
        break;
      case "reset":
        if (await ask("reset")) {
          builder.reset();
          say(words.resetDone);
        }
        break;
      case "turn":
        back = !back;
        if (stage && !stage.lost) stage.flip(sid);
        labelStatic();
        syncTools();
        drawStill();
        break;
      case "done":
        o.onDone?.(builder.doc);
        break;
      case "cancel":
        if (await ask("cancel")) o.onCancel?.();
        break;
    }
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (b && !panel.contains(b) && b.getAttribute("aria-disabled") !== "true") void act(b.dataset.act);
  });
  root.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z" || k === "y") {
      e.preventDefault();
      void act(k === "y" || e.shiftKey ? "redo" : "undo");
    }
  });
  let last = builder.doc;
  const unsub = builder.subscribe((d) => {
    if (d !== last) {
      last = d;
      stillDoc = null;
      if (stage && !stage.lost) void stage.setAvatar(sid, d, opts);
      drawStill();
      o.onChange?.(d);
    }
    render();
  });
  paintTheme();
  labelStatic();
  render(true);
  return {
    el: root,
    builder,
    get doc() {
      return builder.doc;
    },
    get stage() {
      return usingStill() ? null : stage;
    },
    get section() {
      return section;
    },
    setSection: (id) => setSection(id),
    setLang(l) {
      if (l === lang) return;
      lang = l;
      words = uiWords(l, o.words);
      labelStatic();
      builder.lang = l;
    },
    setUnlocked(ids) {
      unlocked = new Set(ids);
      render();
    },
    setTheme(t) {
      theme = t;
      paintTheme();
    },
    setMotion(m) {
      motion = m;
      paintTheme();
    },
    destroy() {
      unsub();
      queue = [];
      ch2.port1.close();
      cancelAnimationFrame(stillRaf);
      mq?.removeEventListener("change", onScheme);
      stage?.destroy();
      root.remove();
    }
  };
}

// ../sahne/src/interact/act.ts
var HINT_AT = 2;
var SHOW_AT = 3;
var startAct = () => ({ misses: 0, hinted: false, shown: false, result: null, tries: [] });
function targetOf(a, hit) {
  return a.targets.find((t) => isTarget(t, hit)) ?? null;
}
function tryAct(a, s, hit) {
  if (s.result) return { s, out: "ignore" };
  const t = targetOf(a, hit);
  if (!t) return { s, out: "ignore" };
  const tries = [...s.tries, t];
  if (!a.expect || t === a.expect) return { s: { ...s, tries, result: t }, out: "hit" };
  const misses = s.misses + 1;
  if (misses >= SHOW_AT) return { s: { ...s, tries, misses, shown: true, result: a.expect }, out: "show" };
  if (misses >= HINT_AT && !s.hinted) return { s: { ...s, tries, misses, hinted: true }, out: "hint" };
  return { s: { ...s, tries, misses }, out: "miss" };
}
function skipAct(a, s) {
  return s.result ? s : { ...s, shown: true, result: a.expect ?? a.targets[0] ?? null };
}
var resolvedCue = (c, result) => ({ act: { ...c.act, ...result ? { result } : {} } });
var dragged = (a) => a.obj ?? a.targets.find((t) => t.startsWith("obj:"))?.slice(4);
var propOf = (props, id) => props[id] ?? Object.values(props).find((p) => p.of === id);
function nameOf(t, c) {
  const n = c.names, { kind, id } = parseTarget(t);
  if (n[t]) return n[t];
  if (kind === "ch") return n[id] ?? id;
  if (kind === "obj") {
    const of = propOf(c.props, id)?.of ?? id.split("#")[0], ref = c.place?.props?.[of];
    return n["obj:" + of] ?? (typeof ref?.name === "string" ? ref.name : of);
  }
  return id;
}
function inspectOf(t, c, via, x, y) {
  const { kind, id, part } = parseTarget(t), at4 = x === void 0 ? {} : { x, y };
  if (kind === "ch") return { target: t, kind: "actor", id, ...part ? { part } : {}, terms: c.terms[id] ?? [], name: nameOf("ch:" + id, c), via, ...at4 };
  if (kind === "obj") {
    const of = propOf(c.props, id)?.of ?? id.split("#")[0];
    return { target: t, kind: "prop", id, of, terms: c.place?.props?.[of]?.terms ?? [], name: nameOf(t, c), via, ...at4 };
  }
  if (kind === "piece" && id) {
    const ref = c.place?.pieces.find((q) => q.id === id), terms = Array.isArray(ref?.terms) ? ref.terms : [];
    return terms.length ? { target: t, kind: "piece", id, terms, name: c.names[t] ?? id, via, ...at4 } : null;
  }
  return null;
}

// ../sahne/src/ui/interact-css.ts
var INTERACT_CSS = `
.sahne-ix { --sahne-ix-glow: 255, 236, 170; --sahne-ix-focus: #2F8C88;
  position: absolute; inset: 0; pointer-events: none; z-index: 5; font: inherit; -webkit-tap-highlight-color: transparent; }
.sahne-ix-ring { position: absolute; left: 0; top: 0; border-radius: 50%; box-sizing: border-box; pointer-events: none;
  border: 2px solid rgba(var(--sahne-ix-glow), .9); box-shadow: 0 0 0 3px rgba(var(--sahne-ix-glow), .28), 0 0 18px 6px rgba(var(--sahne-ix-glow), .45);
  opacity: 0; transition: opacity .25s; will-change: translate; }
.sahne-ix-ring.on { opacity: 1; }
.sahne-ix-ring.ack { border-width: 2px; animation: sahne-ix-ack .7s ease-out forwards; }
.sahne-ix-ring.pick { border-style: dashed; box-shadow: none; border-color: rgba(255, 252, 240, .85); }
.sahne-ix-ring.hint { animation: sahne-ix-breathe 1.6s ease-in-out infinite; }
.sahne-ix-ring.show { border-width: 3px; box-shadow: 0 0 0 4px rgba(var(--sahne-ix-glow), .5), 0 0 26px 10px rgba(var(--sahne-ix-glow), .6); }
.sahne-ix-ring.drop { border-style: solid; box-shadow: 0 0 0 3px rgba(var(--sahne-ix-glow), .4); }
.sahne-ix-ring.spot { pointer-events: auto; cursor: pointer; background: rgba(var(--sahne-ix-glow), .22); border-style: dashed; box-shadow: none; padding: 0; margin: 0; }
.sahne-ix-ring.spot:hover { background: rgba(var(--sahne-ix-glow), .4); }
@keyframes sahne-ix-ack { 0% { opacity: .95; scale: .82; } 100% { opacity: 0; scale: 1.18; } }
@keyframes sahne-ix-breathe { 0%, 100% { scale: .94; opacity: .7; } 50% { scale: 1.06; opacity: 1; } }
.sahne-still .sahne-ix-ring { transition: none; animation: none !important; }
.sahne-still .sahne-ix-ring.ack { opacity: .8; }
.sahne-ix-list { position: absolute; left: 8px; right: 8px; bottom: 8px; pointer-events: auto; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px; border-radius: 12px; background: rgba(255, 252, 245, .94); color: #2B2420; box-shadow: 0 2px 10px rgba(60, 40, 20, .2); }
.sahne-ix-list:empty { display: none; }
.sahne-ix-list.sahne-ix-auto:not(:focus-within) { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.sahne-ix-q { margin: 0 6px 0 2px; font-weight: 600; }
.sahne-ix-list button { font: inherit; color: inherit; min-height: 44px; min-width: 44px; padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(112, 90, 72, .45); background: #FFFDF8; cursor: pointer; }
.sahne-ix-list button:focus-visible, .sahne-ix-ring.spot:focus-visible { outline: 3px solid var(--sahne-ix-focus); outline-offset: 2px; }
.sahne-ix-list button[disabled] { opacity: .55; cursor: default; }
.sahne-ix-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

// ../sahne/src/interact/index.ts
var INTERACT_WORDS = {
  explore: "On stage",
  act: "Your turn",
  hint: (n) => `Look: ${n}`,
  shown: (n) => `It is ${n}`,
  drag: (w, t) => `${w} \u2192 ${t}`
};
var SLACK = { touch: 26, pen: 14, mouse: 8 };
var MOVE = 8;
var SHOW_MS = 1100;
var Interaction = class {
  stage;
  el;
  explore;
  o;
  words;
  list;
  live;
  rings = [];
  fns = { inspect: /* @__PURE__ */ new Set(), act: /* @__PURE__ */ new Set() };
  cur = null;
  ptr = null;
  listKey = "";
  offFrame;
  canvas;
  /** The alpha masks of the stage's atlas, made as it is drawn. */
  masks = new AlphaMasks();
  constructor(stage, o = {}) {
    this.stage = stage;
    this.o = o;
    this.explore = !!o.explore;
    this.words = { ...INTERACT_WORDS, ...o.words };
    const doc = stage.el.ownerDocument;
    if (!doc.getElementById("sahne-ix-css")) doc.head.append(Object.assign(doc.createElement("style"), { id: "sahne-ix-css", textContent: INTERACT_CSS }));
    if (getComputedStyle(stage.el).position === "static") stage.el.style.position = "relative";
    this.el = doc.createElement("div");
    this.el.className = "sahne-ix";
    this.list = doc.createElement("div");
    this.list.className = "sahne-ix-list" + (o.list === "always" ? "" : " sahne-ix-auto");
    this.list.setAttribute("role", "group");
    this.list.tabIndex = -1;
    this.live = doc.createElement("div");
    this.live.className = "sahne-ix-sr";
    this.live.setAttribute("aria-live", "polite");
    this.el.append(this.list, this.live);
    stage.el.append(this.el);
    stage.pickable = true;
    stage.atlasHook = this.masks;
    stage.interaction = this;
    this.canvas = stage.canvas;
    this.canvas.addEventListener("pointerdown", this.down);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("pointercancel", this.cancel);
    this.offFrame = stage.onFrame(() => this.layout());
  }
  on(type, fn) {
    this.fns[type].add(fn);
    return () => this.fns[type].delete(fn);
  }
  emit(type, e) {
    for (const fn of this.fns[type]) fn(e);
  }
  /** Turn explore on or off (a week's mechanics). */
  setExplore(on) {
    this.explore = on;
    this.listKey = "";
    this.syncList();
  }
  /** Show the accessible list always, or only when the keyboard reaches it. */
  setList(mode) {
    this.o.list = mode;
    this.list.classList.toggle("sahne-ix-auto", mode !== "always");
  }
  /** Move focus into the list (its first button). */
  focus() {
    (this.list.querySelector("button:not([disabled])") ?? this.list).focus();
  }
  /** The act waiting for the learner, if any. */
  get active() {
    return this.cur?.run ?? null;
  }
  // ---- Acts ----------------------------------------------------------------------------------
  /** Play act cue `i` of the stage's script (Stage.play calls this for an act with no answer yet). */
  play(i) {
    const c = this.stage.script.cues[i];
    if (!c || !("act" in c)) throw new Error(`sahne: cue ${i} is not an act`);
    return this.begin(c, i, true);
  }
  /** An act that is not in the script, from the world on stage now: its answer is performed but not written into the script. */
  request(act) {
    return this.begin({ act }, -1, false);
  }
  begin(cue, i, scripted) {
    if (this.cur) this.close(this.cur, skipAct(this.cur.cue.act, this.cur.s), "skip");
    const st = this.stage;
    const w = scripted && i > 0 ? st.perfs[i - 1]?.after ?? st.world() : st.world();
    const ask = st.direct({ act: { ...cue.act, expect: void 0, result: void 0 } }, w, scripted ? i : w.i + 1);
    let resolve, done;
    const result = new Promise((r) => {
      resolve = r;
    });
    const finished = new Promise((r) => {
      done = r;
    });
    const self = this;
    const cur = {
      cue,
      i,
      scripted,
      w,
      s: startAct(),
      inner: st.perform(ask),
      resolve,
      done,
      prev: st.el.ownerDocument.activeElement,
      closing: false,
      run: {
        cue: i,
        act: cue.act,
        result,
        done: finished,
        get dur() {
          return cur.inner.dur;
        },
        get t() {
          return cur.inner.t;
        },
        get options() {
          return self.options(cue.act);
        },
        finish: () => cur.inner.finish(),
        seek: (t) => cur.inner.seek(t),
        pause: () => cur.inner.pause(),
        resume: () => cur.inner.resume(),
        answer: (t) => {
          if (self.cur === cur) self.attempt(t, "list");
        },
        skip: () => {
          if (self.cur === cur && !cur.s.result) self.close(cur, skipAct(cue.act, cur.s), "skip");
        }
      }
    };
    this.cur = cur;
    this.canvas.style.touchAction = cue.act.kind === "drag" ? "none" : "manipulation";
    this.clearRings();
    const a = cue.act;
    if (a.kind === "go") for (const t of a.targets) this.ring(t, "spot");
    if (a.kind === "choose") for (const t of a.targets) this.ring(t, "pick");
    if (a.kind === "drag") {
      const id = dragged(a);
      if (id) this.ring("obj:" + id, "pick");
    }
    this.listKey = "";
    this.syncList();
    this.say(a.prompt ?? "");
    const f = this.o.focus ?? "auto";
    if (f === "always" || f === "auto" && st.el.contains(cur.prev)) this.focus();
    this.emit("act", { phase: "ask", cue: i, act: a, misses: 0 });
    return cur.run;
  }
  /** A try at the act waiting: a hit on stage or a button of the list. */
  attempt(t, via) {
    const cur = this.cur;
    if (!cur || cur.closing) return "ignore";
    const a = cur.cue.act, { s, out } = tryAct(a, cur.s, t);
    cur.s = s;
    if (out === "ignore") return out;
    const tried = targetOf(a, t);
    if (out === "hit") {
      this.close(cur, s, via);
      return out;
    }
    const expect = a.expect;
    const others = a.by ? [a.by] : Object.values(this.stage.world().actors).filter((x) => x.on && x.id !== a.who).map((x) => x.id);
    if (out === "miss") this.ack(tried);
    if (out === "hint") {
      this.ack(tried);
      this.ring(expect, "hint");
      this.whenIdle(() => this.stage.glance(others, expect));
      this.say(this.words.hint(this.name(expect)));
    }
    if (out === "show") {
      cur.closing = true;
      this.clearRings("hint");
      this.ring(expect, "show");
      this.whenIdle(() => this.stage.glance(others, expect, a.by));
      this.say(this.words.shown(this.name(expect)));
      this.syncList();
      setTimeout(() => {
        if (this.cur === cur) this.close(cur, s, via);
      }, SHOW_MS);
    }
    this.emit("act", { phase: out, cue: cur.i, act: a, target: tried, misses: s.misses });
    return out;
  }
  /** The act is answered: write the answer in, perform it, and let the app know. */
  close(cur, s, via) {
    const st = this.stage, a = cur.cue.act;
    cur.s = s;
    if (this.cur === cur) this.cur = null;
    const res = { cue: cur.i, kind: a.kind, target: s.result, expect: a.expect, misses: s.misses, hinted: s.hinted, shown: s.shown, tries: s.tries, via };
    const cue = resolvedCue(cur.cue, s.result);
    if (cur.scripted) {
      st.setCues(cur.i, [cue, ...st.script.cues.slice(cur.i + 1)]);
      cur.inner = st.perform(st.perfs[cur.i]);
    } else cur.inner = st.perform(st.direct(cue, cur.w, cur.w.i + 1));
    cur.inner.done.then(cur.done);
    this.clearRings();
    this.canvas.style.touchAction = "manipulation";
    const doc = st.el.ownerDocument, inList = this.list.contains(doc.activeElement);
    this.listKey = "";
    this.syncList();
    if (inList) {
      const p = cur.prev;
      if (p && p.isConnected && !this.list.contains(p) && p !== doc.body) p.focus();
      else if (this.list.querySelector("button")) this.focus();
      else {
        if (!st.el.hasAttribute("tabindex")) st.el.tabIndex = -1;
        st.el.focus();
      }
    }
    cur.resolve(res);
    this.emit("act", { phase: "done", cue: cur.i, act: a, target: s.result, misses: s.misses, result: res });
  }
  /** Run `fn` once the stage is not performing (a hint never cuts a line short). */
  whenIdle(fn) {
    const st = this.stage, go = () => {
      if (!st.perf || st.now() >= st.perf.dur) fn();
      else setTimeout(go, 120);
    };
    go();
  }
  /** The act's targets with their names. */
  options(a) {
    const id = a.kind === "drag" ? dragged(a) : void 0;
    return a.targets.filter((t) => !(id && t === "obj:" + id)).map((t) => ({ target: t, label: id ? this.words.drag(this.name("obj:" + id), this.name(t)) : this.name(t) }));
  }
  // ---- Names and explore ---------------------------------------------------------------------
  /** A target's name: the app's (`LoadOptions.names`, by actor id or by target), else the place's, else its id. */
  name(t) {
    return nameOf(t, this.scene());
  }
  scene() {
    const st = this.stage;
    return { names: st.names, terms: st.terms, place: st.place, props: st.frame?.props ?? st.world().props };
  }
  prop(id) {
    return propOf(this.scene().props, id);
  }
  /** What `inspect` says about a target. */
  inspectOf(t, via, x, y) {
    return inspectOf(t, this.scene(), via, x, y);
  }
  inspect(t, via, x, y) {
    const e = this.inspectOf(t, via, x, y);
    if (!e) return;
    this.ack(e.kind === "actor" ? "ch:" + e.id : t);
    this.say(e.name ?? "");
    this.emit("inspect", e);
  }
  // ---- Hit tests -----------------------------------------------------------------------------
  /** The ray from the camera through a point of the stage, in CSS pixels. */
  ray(x, y) {
    const st = this.stage, [w, h2] = st.cssSize;
    return rayAt(st.cam, st.aspect, x / w * 2 - 1, 1 - y / h2 * 2);
  }
  /** The topmost person, prop or piece drawn at a point of the stage (CSS pixels) in the last frame; transparent corners pass through. */
  hitAt(x, y, skip) {
    return pickTop(this.stage.picks, this.ray(x, y), (p, s, v) => !p.rect || this.masks.paper(p.rect, s, v), skip);
  }
  // ---- Pointer -------------------------------------------------------------------------------
  xy(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  down = (e) => {
    if (!e.isPrimary || e.button > 0) return;
    const [x, y] = this.xy(e), a = this.cur?.cue.act;
    this.ptr = { id: e.pointerId, x0: x, y0: y, type: e.pointerType, drag: null, moved: false };
    if (!a || a.kind !== "drag" || this.cur.closing) return;
    const id = dragged(a), want = "obj:" + id, p = id ? this.prop(id) : void 0;
    if (!p || !this.near(x, y, [want], e.pointerType)) return;
    const st = this.stage, f = st.frame;
    const c = f ? st.point("obj:" + p.id, f) : null, ray = this.ray(x, y);
    const z = (p.at ?? c)?.[2] ?? 0, q = rayZ(ray, z);
    if (!q) return;
    const at0 = p.at ?? (c ? [c[0], c[1] - 0.1, c[2]] : q);
    this.ptr.drag = { id: p.id, z, off: [q[0] - at0[0], q[1] - at0[1], 0] };
    st.held = { id: p.id, at: at0, from: heldKey(p) };
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  move = (e) => {
    const P = this.ptr;
    if (!P || P.id !== e.pointerId) return;
    const [x, y] = this.xy(e);
    if (Math.hypot(x - P.x0, y - P.y0) > MOVE) P.moved = true;
    if (!P.drag) return;
    const q = rayZ(this.ray(x, y), P.drag.z), st = this.stage;
    if (q && st.held) {
      st.held = { ...st.held, at: [q[0] - P.drag.off[0], q[1] - P.drag.off[1], P.drag.z] };
      st.poke();
    }
    const a = this.cur?.cue.act, t = a ? this.dropAt(x, y, P.type) : null;
    this.clearRings("drop");
    if (t) this.ring(t, "drop");
  };
  up = (e) => {
    const P = this.ptr;
    if (!P || P.id !== e.pointerId) return;
    this.ptr = null;
    const [x, y] = this.xy(e), cur = this.cur, a = cur?.cue.act;
    if (P.drag) {
      this.clearRings("drop");
      const t = P.moved && a ? this.dropAt(x, y, P.type) : null;
      const out = t ? this.attempt(t, "pointer") : "ignore";
      if (out !== "hit") {
        this.stage.held = null;
        this.stage.poke();
      }
      return;
    }
    if (P.moved) return;
    if (a && !cur.closing && a.kind !== "drag") {
      const t = this.near(x, y, a.targets, P.type);
      if (t) {
        this.attempt(t, "pointer");
        return;
      }
    }
    if (this.explore) {
      const hit = this.hitAt(x, y), f = this.stage.frame;
      const things = f ? [...Object.values(f.actors).filter((a2) => a2.on).map((a2) => "ch:" + a2.id), ...Object.values(f.props).filter((p) => p.shown && inState(p.in, f.state.to)).map((p) => "obj:" + p.id)] : [];
      const t = hit && !hit.target.startsWith("piece:") ? hit.target : this.near(x, y, things, P.type) ?? hit?.target;
      if (hit?.poke) this.stage.tapFlat(hit.poke, hit.p);
      if (t) this.inspect(t, "pointer", x, y);
    }
  };
  cancel = (e) => {
    if (this.ptr?.id !== e.pointerId) return;
    if (this.ptr.drag) {
      this.stage.held = null;
      this.stage.poke();
      this.clearRings("drop");
    }
    this.ptr = null;
  };
  /** Where a dragged thing would land: one of the act's targets other than itself. */
  dropAt(x, y, type) {
    const a = this.cur?.cue.act;
    if (!a) return null;
    const id = dragged(a), held = this.stage.held?.id;
    return this.near(x, y, a.targets.filter((t) => t !== "obj:" + id), type, (p) => !!held && p.target === "obj:" + held, true);
  }
  /**
   * Which of `targets` is at a point: the topmost thing drawn there if it is one of them, else the
   * nearest that shows within a finger's slack (`SLACK`; less of it over another person or thing).
   * Marks are found by their ring on the floor. A drop (`loose`) takes the nearest box whatever is
   * drawn over it, so the milk lands on İsmail even over the bread on his counter.
   */
  near(x, y, targets, type, skip, loose = false) {
    const slack = SLACK[type] ?? SLACK.mouse;
    const hit = this.hitAt(x, y, skip), things = targets.filter((t) => !t.startsWith("mark:"));
    const direct2 = hit ? things.find((t) => isTarget(t, hit.target)) : void 0;
    if (direct2) return direct2;
    let best = null, bd = Infinity;
    if (loose) {
      for (const t of things) {
        const b = this.box(t, skip);
        const d = b ? boxDist(b, x, y) : Infinity;
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (bd > slack) {
        best = null;
        bd = Infinity;
      }
    } else {
      search: for (const k of !hit || hit.target.startsWith("piece:") ? [0.35, 0.7, 1] : [0.35, 0.7]) for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4, h2 = this.hitAt(x + Math.cos(a) * slack * k, y + Math.sin(a) * slack * k, skip);
        const t = h2 ? things.find((t2) => isTarget(t2, h2.target)) : void 0;
        if (t) {
          best = t;
          bd = slack * k;
          break search;
        }
      }
    }
    for (const t of targets.filter((t2) => t2.startsWith("mark:"))) {
      const b = this.box(t);
      if (b && boxDist(b, x, y) <= slack && boxDist(b, x, y) < (best ? bd : Infinity)) {
        best = t;
        bd = boxDist(b, x, y);
      }
    }
    return best;
  }
  /** A target's box on screen (CSS pixels): the quads drawn for it in the last frame, or a mark's ring on the floor. */
  box(t, skip) {
    const st = this.stage;
    if (t.startsWith("mark:")) {
      const m = st.place?.marks[t.slice(5)];
      const c = m ? st.project([m.x, 0, m.z]) : null, e = m ? st.project([m.x + 0.38, 0, m.z]) : null;
      if (!c || !e) return null;
      const rx = Math.max(22, Math.abs(e[0] - c[0])), ry = Math.max(14, rx * 0.4);
      return [c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry];
    }
    let b = null;
    for (const p of st.picks) {
      if (!isTarget(t, p.bone ? p.target + "." + partOf2(p.bone) : p.target) || skip?.(p)) continue;
      for (const v of p.c) {
        const q = st.project(v);
        if (!q) continue;
        b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])] : [q[0], q[1], q[0], q[1]];
      }
    }
    return b;
  }
  // ---- Rings, the list, the live region ---------------------------------------------------------
  ring(t, kind) {
    const doc = this.stage.el.ownerDocument;
    const el = doc.createElement(kind === "spot" ? "button" : "div");
    el.className = `sahne-ix-ring ${kind}`;
    if (kind === "spot") {
      el.type = "button";
      el.tabIndex = -1;
      el.setAttribute("aria-label", this.name(t));
      el.addEventListener("click", () => this.attempt(t, "pointer"));
    }
    const r = { el, target: t, kind };
    this.rings.push(r);
    this.el.prepend(el);
    this.place(r);
    requestAnimationFrame(() => el.classList.add("on"));
    if (kind === "ack") setTimeout(() => this.drop(r), 750);
  }
  /** A gentle sign that a tap landed: a ring that opens and fades. */
  ack(t) {
    this.ring(t.startsWith("ch:") ? t.split(".")[0] : t, "ack");
  }
  drop(r) {
    r.el.remove();
    this.rings = this.rings.filter((x) => x !== r);
  }
  clearRings(kind) {
    for (const r of [...this.rings]) if (!kind || r.kind === kind) this.drop(r);
  }
  place(r) {
    const b = this.box(r.target);
    if (!b) {
      r.el.style.visibility = "hidden";
      return;
    }
    const pad = r.target.startsWith("mark:") ? 0 : 8, w = b[2] - b[0] + pad * 2, h2 = b[3] - b[1] + pad * 2;
    r.el.style.visibility = "";
    r.el.style.width = w + "px";
    r.el.style.height = h2 + "px";
    r.el.style.translate = `${b[0] - pad}px ${b[1] - pad}px`;
  }
  /** After each frame: rings follow the camera and the actors; the explore list follows who and what is on stage. */
  layout() {
    this.el.classList.toggle("sahne-still", this.stage.motion === "still");
    for (const r of this.rings) this.place(r);
    this.syncList();
  }
  syncList() {
    const cur = this.cur, a = cur?.cue.act;
    let items = [], label = "";
    if (a) {
      items = this.options(a);
      label = a.prompt ?? this.words.act;
    } else if (this.explore) {
      const f = this.stage.frame;
      if (f) {
        for (const x of Object.values(f.actors)) if (x.on) items.push({ target: "ch:" + x.id, label: this.name("ch:" + x.id) });
        for (const p of Object.values(f.props)) if (p.shown && (p.at || p.holder) && (p.holder || inState(p.in, f.state.to))) items.push({ target: "obj:" + p.id, label: this.name("obj:" + p.id) });
      }
      label = this.words.explore;
    }
    const key = label + "|" + (cur?.closing ? "x" : "") + items.map((i) => i.target + "=" + i.label).join(",");
    if (key === this.listKey) return;
    const had = this.list.contains(this.stage.el.ownerDocument.activeElement), idx = [...this.list.querySelectorAll("button")].indexOf(this.stage.el.ownerDocument.activeElement);
    this.listKey = key;
    const doc = this.stage.el.ownerDocument;
    this.list.replaceChildren();
    this.list.setAttribute("aria-label", label);
    if (!items.length) return;
    this.list.append(Object.assign(doc.createElement("p"), { className: "sahne-ix-q", textContent: label }));
    for (const it of items) {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = it.label;
      b.dataset.target = it.target;
      if (a) {
        b.disabled = !!cur.closing;
        b.onclick = () => this.attempt(it.target, "list");
      } else b.onclick = () => this.inspect(it.target, "list");
      this.list.append(b);
    }
    if (had) (this.list.querySelectorAll("button")[Math.max(0, idx)] ?? this.list).focus();
  }
  say(text) {
    this.live.textContent = "";
    if (text) setTimeout(() => {
      this.live.textContent = text;
    }, 30);
  }
  destroy() {
    const cur = this.cur;
    if (cur) {
      this.cur = null;
      const s = skipAct(cur.cue.act, cur.s), a = cur.cue.act;
      cur.resolve({ cue: cur.i, kind: a.kind, target: s.result, expect: a.expect, misses: s.misses, hinted: s.hinted, shown: s.shown, tries: s.tries, via: "skip" });
      cur.done();
    }
    this.offFrame();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.el.remove();
    if (this.stage.interaction === this) this.stage.interaction = null;
    this.stage.pickable = false;
    this.stage.picks = [];
    this.stage.held = null;
    if (this.stage.atlasHook === this.masks) this.stage.atlasHook = null;
    this.masks.dispose();
  }
};
var boxDist = (b, x, y) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
function interact(stage, o = {}) {
  return new Interaction(stage, o);
}

// ../sahne/src/ui/prop-text-css.ts
var PROP_TEXT_CSS = `
.sahne-pt { position: absolute; inset: 0; overflow: hidden; contain: strict; pointer-events: none; color-scheme: light; }
.sahne-pt[hidden] { display: none; }
.sahne-pt > div { position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; padding: 0; border: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center; transform-origin: 0 0; pointer-events: none; user-select: none;
  line-height: 1.15; letter-spacing: 0; word-spacing: normal; text-transform: none; font-style: normal; font-variant: normal; text-indent: 0;
  text-shadow: none; direction: ltr; white-space: pre-line; overflow-wrap: break-word; text-wrap: balance; hyphens: manual;
  -webkit-font-smoothing: antialiased; transition: opacity .12s; color: transparent; }
.sahne-pt > div[hidden] { display: none; }
.sahne-pt > div.sahne-pt-off { opacity: 0; }
.sahne-pt.sahne-still > div { transition: none; }
.sahne-pt-t { flex: none; }
.sahne-pt-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

// ../sahne/src/ui/prop-text.ts
var clip = (vp, v, w) => [0, 1, 2, 3].map((r) => vp[r] * v[0] + vp[4 + r] * v[1] + vp[8 + r] * v[2] + vp[12 + r] * w);
function textQuad(vp, css, f, t) {
  const { O, R: R3, D } = f, Q = [O[0] + R3[0] * t.x + D[0] * t.y, O[1] + R3[1] * t.x + D[1] * t.y, O[2] + R3[2] * t.x + D[2] * t.y];
  const U = clip(vp, R3, 0), V = clip(vp, D, 0), T = clip(vp, Q, 1), hw = css[0] / 2, hh = css[1] / 2, pts = [];
  for (const [x, y] of [[0, 0], [t.w, 0], [t.w, t.h], [0, t.h]]) {
    const w = T[3] + U[3] * x + V[3] * y;
    if (!(w >= NEAR)) return null;
    pts.push([hw * ((T[0] + U[0] * x + V[0] * y) / w + 1), hh * (1 - (T[1] + U[1] * x + V[1] * y) / w)]);
  }
  const [p0, p1, , p3] = pts;
  return (p1[0] - p0[0]) * (p3[1] - p0[1]) - (p1[1] - p0[1]) * (p3[0] - p0[0]) > 0 ? { U, V, T, pts } : null;
}
var num = (v) => +v.toPrecision(9);
function matrixOf(q, css, k) {
  const { U, V, T } = q, hw = css[0] / 2, hh = css[1] / 2, s = 1 / (k * T[3]), t = 1 / T[3];
  return `matrix3d(${[hw * (U[0] + U[3]) * s, hh * (U[3] - U[1]) * s, 0, U[3] * s, hw * (V[0] + V[3]) * s, hh * (V[3] - V[1]) * s, 0, V[3] * s, 0, 0, 1, 0, hw * (T[0] + T[3]) * t, hh * (T[3] - T[1]) * t, 0, 1].map(num).join()})`;
}
function flatMatrix(vp, css, f, t, k) {
  const q = textQuad(vp, css, f, t);
  return q && matrixOf(q, css, k);
}
var quantise = (raw) => Math.min(40, Math.max(2, 2 ** (Math.round(Math.log2(Math.max(raw, 1e-6)) * 2) / 2)));
var Layer = class {
  el;
  stage;
  boxes = /* @__PURE__ */ new Map();
  offFrame;
  onLost = () => {
    this.el.hidden = true;
  };
  onFonts = () => {
    for (const b of this.boxes.values()) {
      b.fitted = false;
      if (!b.el.hidden) this.fit(b);
    }
  };
  constructor(stage) {
    this.stage = stage;
    const doc = stage.el.ownerDocument;
    if (!doc.getElementById("sahne-pt-css")) doc.head.append(Object.assign(doc.createElement("style"), { id: "sahne-pt-css", textContent: PROP_TEXT_CSS }));
    this.place();
    this.el = doc.createElement("div");
    this.el.className = "sahne-pt";
    stage.el.prepend(this.el);
    stage.canvas.addEventListener("webglcontextlost", this.onLost);
    doc.fonts?.addEventListener("loadingdone", this.onFonts);
    this.offFrame = stage.onFrame(() => this.frame());
  }
  /** The layer is laid over the stage, so the stage must be its containing block. A stage not yet in the page has no computed style: it is asked again on its frames until it is. */
  placed = false;
  place() {
    if (this.placed || !this.stage.el.isConnected) return;
    if (getComputedStyle(this.stage.el).position === "static") this.stage.el.style.position = "relative";
    this.placed = true;
  }
  make(key) {
    const doc = this.el.ownerDocument, el = doc.createElement("div"), sr = doc.createElement("span"), txt = doc.createElement("div");
    sr.className = "sahne-pt-sr";
    txt.className = "sahne-pt-t";
    el.append(sr, txt);
    this.el.append(el);
    const b = { el, sr, txt, m: "", lay: "", name: "", z: -1, W: 0, H: 0, px: 0, fitted: false };
    this.boxes.set(key, b);
    return b;
  }
  /** Shrink the font (×0.88, down to 0.35) until the text fits its box, words unbroken where they can be. */
  fit(b) {
    b.txt.style.overflowWrap = "normal";
    for (let fit = 1; ; fit = Math.max(0.35, fit * 0.88)) {
      b.el.style.fontSize = b.px * fit + "px";
      if (fit <= 0.35 || b.txt.scrollHeight <= b.H + 0.5 && b.txt.scrollWidth <= b.W + 0.5) break;
    }
    b.txt.style.overflowWrap = "";
    b.fitted = true;
  }
  frame() {
    const st = this.stage, f = st.frame;
    if (!f) return;
    this.place();
    this.el.hidden = false;
    this.el.classList.toggle("sahne-still", st.motion === "still");
    const css = st.cssSize, cam = st.cam, vp = mat4Mul(perspective(cam.fov, st.aspect, NEAR, FAR), lookAt(cam.eye, cam.target));
    const seen = /* @__PURE__ */ new Set(), scene = { names: st.names, terms: st.terms, place: st.place, props: f.props };
    st.texts.forEach((r, i) => {
      for (const t of r.spec.text ?? []) {
        const key = `${r.target}|${t.x}|${t.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const b = this.boxes.get(key) ?? this.make(key), q = textQuad(vp, css, r, t);
        const xs = q?.pts.map((p) => p[0]) ?? [], ys = q?.pts.map((p) => p[1]) ?? [];
        if (!q || Math.max(...xs) < 0 || Math.min(...xs) > css[0] || Math.max(...ys) < 0 || Math.min(...ys) > css[1]) {
          b.el.hidden = true;
          continue;
        }
        b.el.hidden = false;
        const k = quantise(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) / t.w);
        const lay = [t.text, t.w, t.h, k, t.size, t.font, t.weight, t.align, t.lang].join("|");
        if (b.lay !== lay) {
          b.lay = lay;
          b.W = t.w * k;
          b.H = t.h * k;
          b.px = (t.size ?? t.h * 0.45) * k;
          b.fitted = false;
          const s = b.el.style;
          s.width = b.W + "px";
          s.height = b.H + "px";
          s.fontFamily = t.font ? `var(--sahne-text-${t.font})` : "";
          s.fontWeight = t.weight ? String(t.weight) : "";
          s.textAlign = t.align ?? "center";
          b.txt.lang = t.lang ?? "tr";
          b.txt.textContent = t.text;
        }
        if (!b.fitted) this.fit(b);
        const m = matrixOf(q, css, k);
        if (b.m !== m) b.el.style.transform = b.m = m;
        const name = nameOf(r.target, scene);
        if (b.name !== name) b.sr.textContent = (b.name = name) ? name + ": " : "";
        if (b.z !== i) b.el.style.zIndex = String(b.z = i);
      }
    });
    for (const [key, b] of this.boxes) if (!seen.has(key)) {
      b.el.remove();
      this.boxes.delete(key);
    }
  }
  destroy() {
    this.offFrame();
    this.stage.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.el.ownerDocument.fonts?.removeEventListener("loadingdone", this.onFonts);
    this.el.remove();
    this.boxes.clear();
  }
};
function propText(stage) {
  return new Layer(stage);
}

export {
  IDENTITY,
  clamp,
  lerp,
  polyLength,
  polyAt,
  smoothstep,
  mul,
  apply,
  translate,
  scale,
  rotate,
  rotateAbout,
  boxUnion,
  boxPad,
  perspective,
  lookAt,
  mat4Mul,
  project,
  ease,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  mix,
  tone,
  luma,
  hashString,
  rng,
  TIMETABLE,
  EMIT_KINDS,
  MOTION_KINDS,
  withVariant,
  pieceOf,
  matchFallback,
  speechFallback,
  lineMatcher,
  Path,
  svgNums,
  svgList,
  cmdsToD,
  asEllipse,
  svgGeom,
  ellipse,
  circle,
  rect,
  rrect,
  poly,
  smooth,
  band,
  arcPoints,
  tileOffsets,
  DEFAULT_EDGE,
  clipsOf,
  shapeBounds,
  groupBounds,
  drawGroup,
  paintText,
  svgColor,
  svgPaint,
  svgId,
  SVG_BASE,
  shadowFilter,
  groupSvg,
  BONES,
  CHAINS,
  ARM_BONE,
  humanoid,
  seatedSide,
  solve,
  jointOf,
  restPose,
  NEUTRAL_FACE,
  faceFrom,
  blendFace,
  clone,
  faceKey,
  GARMENT_FIELDS,
  fitsBuild,
  sideOf,
  partOf,
  usesOf,
  AVATAR_MAX_BYTES,
  isAvatarDoc,
  isLegacyChar,
  serialize,
  docHash,
  normalize,
  manifestOf,
  compose,
  createBuilder,
  CLOTHING_FIELDS,
  lookFields,
  applyLook,
  STRIP_SEGMENTS,
  STRIP_CAP_SEGMENTS,
  stripJoints,
  stripCaps,
  stripGeometry,
  stripOutline,
  stripSlice,
  stripeDuty,
  stripeSpans,
  SvgContext,
  renderSvg,
  clearPortraits,
  portraitCacheSize,
  onPortraitError,
  portrait,
  silhouette,
  EMO_MS,
  LOOK_MS,
  CAM_MS,
  HOLD_MS,
  DOOR_OPEN_MS,
  DOOR_CLOSE_MS,
  TIME_MS,
  SOUND_MS,
  STATE_FADE_MS,
  STATE_ROLL_MS,
  WEATHER_MS,
  FLASH_RISE_MS,
  FLASH_MS,
  LIGHTS_MS,
  SIT_MS,
  RISER,
  STAIR_MIN,
  stairSteps,
  legLengths,
  emptyTrack,
  walkAt,
  evaluate,
  peopleSamples,
  flights,
  fleeAt,
  lookToward,
  reactShows,
  CLEAR,
  placeSolids,
  route,
  detour,
  composePose,
  ATLAS_MAX,
  cellSize,
  fitsAtlas,
  wideBox,
  bodyDims,
  figureDims,
  figureBox,
  figureCam,
  TIMES,
  blendLight,
  WEATHER,
  withWeather,
  withFlash,
  moveAt,
  stopsTime,
  propKey,
  KEPT,
  markPos,
  placeProps,
  enterPlace,
  siteOf,
  placeState,
  inState,
  whenWeight,
  emptyWorld,
  cloneWorld,
  TALK_YAW,
  travelYaw,
  faceYaw,
  direct,
  glance,
  directAll,
  fold,
  rayAt,
  rayQuad,
  rayFloor,
  rayTri,
  MASK_SCALE,
  poolAlpha,
  maskHit,
  AlphaMasks,
  pickTop,
  rayZ,
  partOf2,
  isTarget,
  parseTarget,
  glossInto,
  popup,
  Overlay,
  curveAt,
  voiceLength,
  finish,
  patchJob,
  renderPatch,
  loopJob,
  renderLoop,
  level,
  rms,
  spectrum,
  pitchOf,
  noteFreq,
  parseTrack,
  motifSteps,
  motifVoices,
  motifJob,
  renderMotif,
  DEFAULT_VOLUMES,
  AudioEngine,
  SpeechClock,
  STUDIO_ID,
  heldKey,
  Stage,
  pieceSeed,
  drawPieces,
  mountStage,
  CAM_KINDS,
  MOVE_HOWS,
  VOICES2 as VOICES,
  OBJ_OPS,
  ACT_KINDS,
  ENV_VERBS,
  CUE_KINDS,
  STAGING_FIELDS,
  birdBones,
  birdPose,
  catBones,
  catPose,
  browserVoice,
  WORDS,
  uiWords,
  fieldFraming,
  sectionFraming,
  mountBuilder,
  HINT_AT,
  SHOW_AT,
  startAct,
  targetOf,
  tryAct,
  skipAct,
  resolvedCue,
  nameOf,
  inspectOf,
  INTERACT_WORDS,
  Interaction,
  interact,
  flatMatrix,
  propText
};
//# sourceMappingURL=chunk-BLASJ6YA.js.map
