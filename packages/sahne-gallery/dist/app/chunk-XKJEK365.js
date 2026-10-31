import {
  Path,
  tone,
  translate
} from "./chunk-BLASJ6YA.js";

// ../sahne-kit/src/drawing.ts
var DRAWING_LIMITS = { bytes: 64 * 1024, shapes: 400, commands: 2e4, copies: 12, flats: 12, reach: 1e3 };
var CONTENT_ID = /^x_[a-z0-9_]+$/;
var KIT_ID = /^(?!x_)[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
var PARAM_TYPES = ["enum", "int", "num", "bool", "text", "color"];
var TONES = ["base", "shade", "deep", "light", "edge"];
var ref = (s) => typeof s === "string" && /^\$[A-Za-z_]\w*$/.test(s) ? s.slice(1) : null;
function compileDrawing(doc, official = false) {
  const problems = [], bad = (m) => {
    if (problems.length < 20) problems.push(m);
  };
  const params = doc && typeof doc.params === "object" && doc.params ? doc.params : {}, kinds = {};
  let shapes = 0, commands = 0;
  try {
    if (!doc || typeof doc !== "object") throw new Error("a drawing is an object");
    if (official ? !KIT_ID.test(doc.id ?? "") : !CONTENT_ID.test(doc.id ?? "")) bad(official ? `id ${JSON.stringify(doc.id)}: a kit id is lowercase letters and digits in snake_case, never x_\u2026` : `id ${JSON.stringify(doc.id)}: a content id is x_ then lowercase letters, digits and _`);
    if (!["prop", "set", "both"].includes(doc.as)) bad(`as ${JSON.stringify(doc.as)}: prop, set or both`);
    if (typeof doc.about !== "string" || doc.about.trim().length <= 8) bad("about: a line on what it draws");
    if (JSON.stringify(doc).length > DRAWING_LIMITS.bytes) bad(`over ${DRAWING_LIMITS.bytes / 1024} KB`);
    for (const [k, s] of Object.entries(params)) {
      if (!PARAM_TYPES.includes(s?.type)) bad(`param ${k}: type ${JSON.stringify(s?.type)} is not one of ${PARAM_TYPES.join(", ")}`);
      if (k === "n" || k === "held" || k === "variant") bad(`param ${k}: the engine gives it`);
      if (s?.type === "enum" && !s.values?.length) bad(`param ${k}: an enum with no values`);
    }
    const colour = (f, where) => {
      const r = ref(typeof f === "object" && f ? f.tone : f);
      if (r !== null && params[r]?.type !== "color") bad(`${where}: $${r} is not a colour param`);
      if (typeof f === "object" && f && !TONES.includes(f.step)) bad(`${where}: tone step ${JSON.stringify(f.step)}`);
    };
    const words = (t, where) => {
      for (const m of t.matchAll(/\$([A-Za-z_]\w*)/g)) if (!Object.hasOwn(params, m[1])) bad(`${where}: $${m[1]} is not a declared param`);
    };
    const shape = (s, where) => {
      shapes++;
      let path;
      try {
        path = Path.fromSvg(s.d);
      } catch (e) {
        bad(`${where}: ${e.message}`);
        path = new Path().moveTo(0, 0);
      }
      commands += path.cmds.length;
      if (!path.finite()) bad(`${where}: a coordinate is not finite`);
      else if (path.cmds.some((c) => c.some((v, i) => i > 0 && Math.abs(v) > DRAWING_LIMITS.reach))) bad(`${where}: a coordinate is beyond ${DRAWING_LIMITS.reach} cm from the origin`);
      colour(s.fill, `${where} fill`);
      if (s.stroke) colour(s.stroke.color, `${where} stroke`);
      return { path, src: s };
    };
    if (!doc.kinds || !Object.keys(doc.kinds).length) bad("kinds: at least one");
    for (const [kn, k] of Object.entries(doc.kinds ?? {})) {
      const at = `kind ${kn}`;
      if (!(k.size?.length === 2 && k.size.every((v) => v > 0 && v <= DRAWING_LIMITS.reach))) bad(`${at}: size is [width, height] in cm, each over 0 and at most ${DRAWING_LIMITS.reach}`);
      if (k.ppcm !== void 0 && !(k.ppcm > 0 && k.ppcm <= 16)) bad(`${at}: ppcm over 0 and at most 16`);
      if (!k.flats?.length) bad(`${at}: no flats`);
      else if (k.flats.length > DRAWING_LIMITS.flats) bad(`${at}: ${k.flats.length} flats: at most ${DRAWING_LIMITS.flats}`);
      kinds[kn] = { src: k, flats: (k.flats ?? []).map((f, i) => {
        for (const t of f.text ?? []) {
          words(t.text, `${at} flat ${i} text`);
          colour(t.color, `${at} flat ${i} text color`);
          if (!t.lang) bad(`${at} flat ${i}: text "${t.text}" has no lang`);
        }
        return { src: f, shapes: (f.shapes ?? []).map((s, j) => shape(s, `${at} flat ${i} shape ${j}`)), glow: (f.glow ?? []).map((s, j) => shape(s, `${at} flat ${i} glow ${j}`)) };
      }) };
    }
    const kp = params.kind;
    if (kp) {
      if (kp.type !== "enum" || [...kp.values ?? []].sort().join() !== Object.keys(kinds).sort().join()) bad("param kind: an enum whose values are the kinds");
    } else if (Object.keys(kinds).length > 1) bad("several kinds need an enum param kind that picks one");
    for (const [v, ps] of Object.entries(doc.variants ?? {})) for (const k of Object.keys(ps)) if (!Object.hasOwn(params, k)) bad(`variant ${v}: ${k} is not a declared param`);
    if (shapes > DRAWING_LIMITS.shapes) bad(`${shapes} shapes: at most ${DRAWING_LIMITS.shapes}`);
    if (commands > DRAWING_LIMITS.commands) bad(`${commands} path commands: at most ${DRAWING_LIMITS.commands}`);
  } catch (e) {
    bad(e.message);
  }
  const prop = doc?.as !== "set", pnames = Object.keys(params);
  const meta = {
    about: String(doc?.about ?? ""),
    params: {
      ...Object.fromEntries(pnames.map((k) => [k, { ...params[k], type: params[k].type }])),
      ...prop ? { n: { type: "int", min: 1, max: DRAWING_LIMITS.copies, default: 1, about: "how many, side by side" } } : {}
    },
    ...doc?.tags ? { tags: doc.tags } : {},
    ...doc?.terms ? { terms: doc.terms } : {}
  };
  const def = {
    meta,
    ...doc?.variants ? { variants: doc.variants } : {},
    ...doc?.solid?.length ? { solid: () => doc.solid } : {},
    draw(given, _rng, kit) {
      const p = {};
      for (const k2 of pnames) p[k2] = given[k2] ?? params[k2].default ?? (params[k2].type === "enum" ? params[k2].values?.[0] : void 0);
      const held = given.held === true, n = prop ? Math.max(1, Math.min(DRAWING_LIMITS.copies, Math.floor(Number(given.n) || 1))) : 1;
      const k = kinds[typeof p.kind === "string" && Object.hasOwn(kinds, p.kind) ? p.kind : Object.keys(kinds)[0]], kind = k.src;
      const colour = (f, d) => {
        const r = ref(typeof f === "object" ? f?.tone : f);
        const base = r !== null ? kit.color(String(p[r] ?? ""), d) : typeof f === "object" ? kit.color(f.tone, d) : kit.color(f, d);
        return typeof f === "object" ? tone(base, f.step) : base;
      };
      const [w] = kind.size, gap = doc.repeat?.gap ?? 4, gx = held ? -(kind.grip?.[0] ?? 0) : 0, gy = held ? -(kind.grip?.[1] ?? 0) : 0;
      const at = (i) => (i - (n - 1) / 2) * (w + gap) + gx;
      const cut = (list) => {
        const out = [];
        for (let i = 0; i < n; i++) for (const { path, src: s } of list) {
          const sh = { path: at(i) || gy ? path.transform(translate(at(i), gy)) : path };
          if (s.fill !== void 0) sh.fill = colour(s.fill, "#888888");
          if (s.stroke) sh.stroke = { color: colour(s.stroke.color, "#444444"), width: s.stroke.width, ...s.stroke.cap ? { cap: s.stroke.cap } : {} };
          if (s.opacity !== void 0) sh.opacity = s.opacity;
          if (s.flat) sh.flat = true;
          if (s.evenodd) sh.evenodd = true;
          out.push(sh);
        }
        return out;
      };
      const flats = (held ? k.flats.slice(0, 1) : k.flats).map(({ src: f, shapes: shapes2, glow }) => {
        const text = [];
        for (let i = 0; i < n; i++) for (const t of f.text ?? []) {
          const o = { ...t, text: t.text.replace(/\$([A-Za-z_]\w*)/g, (m, name) => Object.hasOwn(p, name) ? String(p[name] ?? "") : m), x: t.x + at(i), y: t.y + gy, color: void 0 };
          if (t.color) o.color = colour(t.color, "#2B2420");
          else delete o.color;
          text.push(o);
        }
        const move = { ...f.sway ? { sway: f.sway } : {}, ...f.blink ? { blink: f.blink } : {} };
        const out = { group: { shapes: cut(shapes2) }, ppcm: kind.ppcm ?? (doc.as === "set" ? 1.6 : 5), id: doc.id };
        if (!held) out.shadow = f.shadow ?? "drop";
        for (const key of ["x", "y", "z", "lit"]) if (f[key] !== void 0) out[key] = f[key];
        if (f.front) out.front = true;
        if (glow.length) out.emissive = { shapes: cut(glow), edge: 0 };
        if (text.length) out.text = text;
        if (Object.keys(move).length) out.move = move;
        return out;
      });
      return { flats, ...!held && kind.lights?.length ? { lights: kind.lights } : {}, ...!held && kind.emitters?.length ? { emitters: kind.emitters } : {} };
    }
  };
  return { def, problems };
}
var checkDrawing = (doc) => compileDrawing(doc).problems;
function fromDrawing(doc) {
  const { def, problems } = compileDrawing(doc);
  if (problems.length) throw new Error(`drawing ${doc?.id}: ${problems.join("; ")}`);
  return def;
}
function drawnFamily(docs) {
  const set = {}, props = {};
  for (const doc of docs) {
    const { def, problems } = compileDrawing(doc, true);
    if (problems.length) throw new Error(`drawing ${doc.id}: ${problems.join("; ")}`);
    if (doc.as !== "prop") set[doc.id] = def;
    if (doc.as !== "set") props[doc.id] = def;
  }
  return { set, props };
}
function withDrawings(kit, docs) {
  const set = { ...kit.set }, props = { ...kit.props }, errors = [];
  const drawn = docs.filter((d) => !("of" in d)), variants = docs.filter((d) => "of" in d);
  for (const doc of drawn) {
    const { def, problems } = compileDrawing(doc);
    if (problems.length) {
      errors.push(`drawing ${doc.id}: ${problems.join("; ")}`);
      continue;
    }
    if (Object.hasOwn(set, doc.id) || Object.hasOwn(props, doc.id)) {
      errors.push(`drawing ${doc.id}: the id is taken`);
      continue;
    }
    if (doc.as !== "prop") set[doc.id] = def;
    if (doc.as !== "set") props[doc.id] = def;
  }
  for (const v of variants) {
    const where = `variant ${v.of}.${v.name}`, homes = [set, props].filter((m) => Object.hasOwn(m, v.of));
    if (!CONTENT_ID.test(v.name ?? "")) errors.push(`${where}: a content variant's name is x_ then lowercase letters, digits and _`);
    else if (!homes.length) errors.push(`${where}: the kit has no set piece or prop ${v.of}`);
    else for (const m of homes) {
      const def = m[v.of], declared = def.meta?.params ?? {};
      if (def.variants && Object.hasOwn(def.variants, v.name)) {
        errors.push(`${where}: the name is taken`);
        continue;
      }
      const stray = Object.keys(v.params ?? {}).filter((k) => !Object.hasOwn(declared, k));
      if (stray.length) {
        errors.push(`${where}: ${stray.join(", ")} not declared by ${v.of}`);
        continue;
      }
      m[v.of] = { ...def, variants: { ...def.variants, [v.name]: v.params } };
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  return { ...kit, set, props };
}

export {
  DRAWING_LIMITS,
  CONTENT_ID,
  KIT_ID,
  compileDrawing,
  checkDrawing,
  fromDrawing,
  drawnFamily,
  withDrawings
};
//# sourceMappingURL=chunk-XKJEK365.js.map
