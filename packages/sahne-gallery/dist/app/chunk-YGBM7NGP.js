import {
  KIT
} from "./chunk-CMLP3XCI.js";
import {
  groupBounds,
  moveAt,
  rng,
  withVariant
} from "./chunk-BLASJ6YA.js";

// src/kit/solo.ts
function extent(gen, params, seed) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const out = gen.def.draw(withVariant(gen.def, params), rng(seed), KIT);
  for (const f of out.flats) {
    const b = groupBounds(f.group);
    if (!b.every(Number.isFinite)) continue;
    const m = f.move ? moveAt(f.move, 0) : null;
    const ox = (f.x ?? 0) / 100 + (m?.at[0] ?? 0), oy = (f.y ?? 0) / 100 + (m?.at[1] ?? 0), oz = (f.z ?? 0) / 100 + (m?.at[2] ?? 0);
    const pitch = f.pitch ?? 0, yaw = f.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const ax of [b[0], b[2]]) for (const ay of [b[1], b[3]]) {
      const u = ax / 100, v = -ay / 100, up = Math.abs(pitch) > 0.8 ? 0 : v, back = Math.abs(pitch) > 0.8 ? v : 0;
      const x = ox + u * c, z = oz - u * s - back, y = oy + up;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  }
  if (!Number.isFinite(x0)) return { x0: -0.5, x1: 0.5, y0: 0, y1: 1, z0: 0, z1: 0 };
  return { x0, x1, y0, y1, z0, z1 };
}
var FIGURE = { ...KIT.defaultDoc, body: { ...KIT.defaultDoc.body, height: 0.4 } };
function solo(gen, o) {
  const hung = gen.meta?.tags?.includes("hung") ? 1.45 : 0;
  const e0 = extent(gen, o.params, o.seed), e = { ...e0, y0: e0.y0 + hung, y1: e0.y1 + hung };
  const ground0 = hung && o.ground !== "none" ? "room" : o.ground;
  const deep = gen.features.has("depth") && e.z1 - e.z0 > 3;
  if (deep) Object.assign(e, { x0: -2.1, x1: 2.1, y0: -0.1, y1: 2.3, z1: 0 });
  const ground = deep ? "none" : ground0;
  const w = Math.max(e.x1 - e.x0, 0.2), big = e.y1 - e.y0 > 0.4 || w > 0.6;
  const figure = o.held || (o.figure ?? big);
  const fx = deep ? 1.5 : e.x1 + 0.45, zFront = Math.min(Math.max(e.z1, -2), 1);
  const pieces = [];
  const span = Math.min(2400, Math.max(600, (w + 4) * 100));
  if (ground !== "none") pieces.push({ kit: "floor", x: (e.x0 + e.x1) / 2, z: 0, w: span, d: 600 });
  if (ground === "room") pieces.push({ kit: "wall", x: (e.x0 + e.x1) / 2, z: Math.min(e.z0, 0) - (hung ? 0.02 : 0.4), w: span, h: 320 });
  const props = {};
  const id = `it_${o.seed.replace(/\W/g, "_")}`;
  if (o.as === "piece") pieces.push({ kit: gen.id, id: "it", x: 0, y: hung, z: 0, seed: o.seed, ...o.params });
  else props[id] = { kit: gen.id, at: o.held ? "me" : { x: 0, y: hung, z: 0 }, ...o.params };
  let box = { x0: e.x0, x1: e.x1, y0: Math.min(e.y0, 0), y1: e.y1 };
  if (figure && !o.held && !deep) box = { x0: Math.min(box.x0, fx - 0.35), x1: Math.max(box.x1, fx + 0.35), y0: box.y0, y1: Math.max(box.y1, 1.8) };
  if (o.held) box = { x0: fx - 0.6, x1: fx + 0.6, y0: 0.7, y1: 1.85 };
  const pad = Math.max(0.08, (box.x1 - box.x0) * 0.08);
  const place = {
    v: 1,
    id: "solo",
    name: { tr: gen.id, en: gen.id },
    size: { w: Math.max(6, box.x1 - box.x0 + 2), d: 6 },
    pieces,
    props,
    marks: { me: { x: fx, z: o.held ? 0.2 : zFront + 0.3, facing: "l" } },
    times: ["day", "golden", "dusk", "night"],
    states: Object.fromEntries((gen.meta?.states ?? []).map((s) => [s, {}])),
    camera: { wide: { x: (box.x0 + box.x1) / 2, w: box.x1 - box.x0 + pad * 2, z: o.held ? 0.2 : zFront, y0: box.y0 - pad / 2, y1: box.y1 + pad / 2 } }
  };
  const cues = [{ scene: { place: "solo", at: figure ? { me: "me" } : {} } }];
  if (o.held) cues.push({ beat: { who: "me", obj: [{ id, op: "take" }] } });
  return { place, cues, cast: figure ? { me: FIGURE } : {} };
}

export {
  FIGURE,
  solo
};
//# sourceMappingURL=chunk-YGBM7NGP.js.map
