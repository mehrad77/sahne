import {
  KIT
} from "./chunk-Y35JX3JV.js";
import {
  FAMILY_MODULES
} from "./chunk-TYXGNTJ5.js";
import {
  SVG_BASE,
  groupBounds,
  groupSvg,
  moveAt,
  rng,
  whenWeight,
  withVariant
} from "./chunk-BLASJ6YA.js";

// ../sahne-kit/src/set-svg.ts
var PLAIN = { time: { from: "day", to: "day", k: 1 }, weather: { from: "clear", to: "clear", k: 1 }, state: { from: [], to: [], k: 1 } };
var TEXT_FONT = "'Comic Neue', 'Helvetica Neue', Arial, sans-serif";
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function textSvg(t) {
  const lines = String(t.text).split("\n"), longest = Math.max(1, ...lines.map((l) => l.length));
  const size = Math.min(t.size ?? t.h * 0.45, t.h / lines.length / 1.15, t.w / longest / 0.52);
  const anchor = t.align === "right" ? "end" : t.align === "left" ? "start" : "middle";
  const x = t.align === "right" ? t.x + t.w : t.align === "left" ? t.x : t.x + t.w / 2;
  const top = t.y + (t.h - size * 1.15 * lines.length) / 2;
  const spans = lines.map((l, i) => `<tspan x="${x}" y="${+(top + size * (0.9 + 1.15 * i)).toFixed(2)}">${esc(l)}</tspan>`).join("");
  return `<text font-family="${TEXT_FONT.replace(/'/g, "&apos;")}" font-size="${+size.toFixed(2)}" font-weight="${t.weight ?? 400}" fill="${esc(t.color ?? "#2B2420")}" text-anchor="${anchor}">${spans}</text>`;
}
function pieceBody(kit, def, params, seed, ids = seed, opts = {}) {
  const night = !!opts.night, glow = night || !!opts.glow;
  const out = def.draw(withVariant(def, params), rng(seed), kit);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, day = "", lit = "";
  const t = opts.t;
  const shown = out.flats.map((f, i) => {
    const m = f.move ? moveAt(f.move, t ?? 0) : { at: [0, 0, 0], dx: 0, dy: 0, rot: 0 };
    if (!m || f.when && whenWeight(f.when, PLAIN) < 0.5) return null;
    return { f, i, dx: (f.x ?? 0) + m.at[0] * 100 + m.dx, dy: -(f.y ?? 0) - m.at[1] * 100 - m.dy, z: (f.z ?? 0) + m.at[2] * 100, rot: t === void 0 ? 0 : m.rot };
  }).filter((v) => v !== null).sort((a, b) => a.z - b.z);
  let r0 = Infinity, r1 = Infinity, r2 = -Infinity, r3 = -Infinity;
  const placed = (b, dx, dy, rot) => {
    if (!rot) return [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];
    const c = Math.cos(rot), s = Math.sin(rot), xs = [], ys = [];
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) {
      xs.push(x * c - y * s + dx);
      ys.push(x * s + y * c + dy);
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  for (const { f, i, dx, dy, rot } of shown) {
    const gb = groupBounds(f.group);
    if (!gb.every(Number.isFinite)) continue;
    const [bx0, by0, bx1, by1] = placed(gb, dx, dy, rot);
    x0 = Math.min(x0, bx0);
    y0 = Math.min(y0, by0);
    x1 = Math.max(x1, bx1);
    y1 = Math.max(y1, by1);
    const eb = f.emissive ? groupBounds(f.emissive) : null, [e0, e1, e2, e3] = eb && eb.every(Number.isFinite) ? placed(eb, dx, dy, rot) : [bx0, by0, bx1, by1];
    r0 = Math.min(r0, bx0, e0);
    r1 = Math.min(r1, by0, e1);
    r2 = Math.max(r2, bx1, e2);
    r3 = Math.max(r3, by1, e3);
    const tf = `translate(${dx} ${dy})${rot ? ` rotate(${+(rot * 180 / Math.PI).toFixed(3)})` : ""}`;
    day += `<g transform="${tf}">${groupSvg(f.group, { id: `${ids}-${i}-` })}${opts.text ? (f.text ?? []).map(textSvg).join("") : ""}</g>`;
    if (glow && f.emissive) lit += `<g transform="${tf}">${groupSvg(f.emissive, { id: `${ids}-${i}-g-` })}</g>`;
  }
  for (const e of out.emitters ?? []) {
    if (e.kind !== "flame") continue;
    const k = (e.w ?? 1.2) / 1.2, x = e.x, y = -e.y;
    x0 = Math.min(x0, x - 0.7 * k);
    x1 = Math.max(x1, x + 0.7 * k);
    y0 = Math.min(y0, y - 2.9 * k);
    y1 = Math.max(y1, y);
    lit += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0-2.85C.5-1.9.65-1.2.5-.4.35 0-.35 0-.5-.4-.65-1.2-.5-1.9 0-2.85Z" fill="#FFC23C"/><path d="M0-1.85C.3-1.2.35-.7.2-.3S-.35-.15-.35-.7-.3-1.2 0-1.85Z" fill="#FFF2B8"/></g>`;
  }
  if (!day && !lit) return null;
  r0 = Math.min(r0, x0);
  r1 = Math.min(r1, y0);
  r2 = Math.max(r2, x1);
  r3 = Math.max(r3, y1);
  const dimmed = night ? `<g filter="url(#${ids}-night)">${day}</g>` : day;
  const defs = night ? `<defs><filter id="${ids}-night" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".34 0 0 0 0  0 .38 0 0 .01  0 0 .62 0 .06  0 0 0 1 0"/></filter></defs>` : "";
  return { body: defs + dimmed + lit, bounds: [x0, y0, x1, y1], reach: [r0, r1, r2, r3] };
}
function pieceSvg(kit, def, params, seed, px, opts = false, ids = seed) {
  const a = pieceBody(kit, def, params, seed, ids, typeof opts === "boolean" ? { glow: opts } : opts);
  if (!a) return "";
  const [x0, y0, x1, y1] = a.bounds, w = x1 - x0, h = y1 - y0, k = px / Math.max(w, h);
  return `<svg viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" role="img"><g${SVG_BASE}>${a.body}</g></svg>`;
}
var FONT = TEXT_FONT.replace(/'/g, "&apos;");

// ../sahne-kit/src/set/drawn/CREDITS.json
var CREDITS_default = [
  {
    id: "apple_strudel",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "the bakery family",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_apple_strudel"
  },
  {
    id: "bread_basket",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "samples boulangerie",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_bread_basket"
  },
  {
    id: "doughnut",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "the bakery family",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_doughnut"
  },
  {
    id: "eclair",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "the bakery family",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_eclair"
  },
  {
    id: "iced_latte",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "the bakery family",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_iced_latte"
  },
  {
    id: "salami",
    family: "bakery",
    kind: "prop",
    by: "Sahne kit (drawn by its agents)",
    contact: "github:mehrad77",
    story: "the bakery family",
    date: "2026-10-31",
    licence: "CC-BY-4.0",
    consent: "project",
    from: "x_salami"
  }
];

// src/kit/catalog.ts
var FEATURES = {
  glow: "glows at night",
  emits: "steam, smoke or flame",
  moves: "moves on its own",
  words: "carries words (HTML text)",
  lights: "lights the place",
  depth: "built in depth (pitched or turned flats)",
  when: "shows by weather, time or state"
};
var CREDITS = new Map(CREDITS_default.map((c) => [c.id, c]));
function probe(def, id) {
  const features = /* @__PURE__ */ new Set(), emit = /* @__PURE__ */ new Set(), motion = /* @__PURE__ */ new Set();
  for (const p of [{}, ...Object.keys(def.variants ?? {}).map((v) => ({ variant: v }))]) {
    let out;
    try {
      out = def.draw(withVariant(def, p), rng(id), KIT);
    } catch {
      continue;
    }
    const zs = out.flats.map((f) => f.z ?? 0);
    for (const f of out.flats) {
      if (f.emissive) features.add("glow");
      if (f.text?.length) features.add("words");
      if (f.when) features.add("when");
      if (f.pitch || f.yaw) features.add("depth");
      for (const k of ["scroll", "path", "sway", "blink"]) if (f.move?.[k]) {
        motion.add(k);
        features.add("moves");
      }
      if (f.move?.path?.pts.some((q) => q[2] !== f.move.path.pts[0][2])) features.add("depth");
    }
    if (zs.length && Math.max(...zs) - Math.min(...zs) > 60) features.add("depth");
    for (const e of out.emitters ?? []) {
      emit.add(e.kind);
      features.add("emits");
    }
    if (out.lights?.length) features.add("lights");
  }
  return { features, emit, motion };
}
var all = null;
function generators() {
  if (all) return all;
  const out = [];
  for (const [family, mod] of Object.entries(FAMILY_MODULES)) {
    const ids = [.../* @__PURE__ */ new Set([...Object.keys(mod.set), ...Object.keys(mod.props)])].sort();
    for (const id of ids) {
      const def = mod.set[id] ?? mod.props[id];
      out.push({ id, family, ...CREDITS.has(id) ? { credit: CREDITS.get(id) } : {}, kind: mod.set[id] && mod.props[id] ? "both" : mod.set[id] ? "piece" : "prop", def, meta: def.meta, variants: Object.keys(def.variants ?? {}), ...probe(def, id) });
    }
  }
  return all = out;
}
var generator = (id) => generators().find((g) => g.id === id);
function usage(places) {
  const m = /* @__PURE__ */ new Map();
  const add = (id, v) => {
    const l = m.get(id) ?? [];
    l.push(v);
    m.set(id, l);
  };
  for (const p of places) {
    for (const r of p.pieces) add(r.kit, { place: p.id, as: "piece", variant: r.variant });
    for (const r of Object.values(p.props ?? {})) add(r.kit, { place: p.id, as: "prop", variant: r.variant });
  }
  return m;
}
function asked(needs) {
  const m = /* @__PURE__ */ new Map();
  for (const site of Object.values(needs)) for (const [place, n] of Object.entries(site.places)) {
    for (const [story, list] of [[false, n.props], [true, n.storyProps]]) for (const [name, p] of Object.entries(list ?? {})) {
      const l = m.get(p.kit) ?? [];
      l.push({ place, name, variant: p.variant, terms: p.terms, story });
      m.set(p.kit, l);
    }
  }
  return m;
}

export {
  pieceSvg,
  FEATURES,
  generators,
  generator,
  usage,
  asked
};
//# sourceMappingURL=chunk-BUTTWWF3.js.map
