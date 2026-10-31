// One generator alone on a stage: a place made for it, with the camera fitted to what it draws, a floor
// under it, and a 170 cm paper figure beside it for scale (or holding it, for a prop). The piece
// inspector and the thumbnail baker both stage pieces this way, so a piece looks the same in both.

import { groupBounds, moveAt, rng, withVariant, type Cue, type FlatSpec, type PlaceDoc, type AvatarDoc } from "sahne";
import { KIT } from "../shell/kit.ts";
import type { Gen } from "./catalog.ts";

export interface SoloOptions {
  /** Draw it as a set piece or as a prop (a generator that is both can be either). */
  as: "piece" | "prop";
  params: Record<string, unknown>;
  seed: string;
  /** The 170 cm figure beside it. */
  figure?: boolean;
  /** A prop in the figure's hand. */
  held?: boolean;
  /** What is behind: a floor, a floor and a wall, or nothing (the sky's colour). */
  ground?: "floor" | "room" | "none";
}

/** What a piece draws, in metres: x across, y up (from its floor) and z towards the viewer, with each flat where its motion starts. */
export function extent(gen: Gen, params: Record<string, unknown>, seed: string) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const out = gen.def.draw(withVariant(gen.def, params), rng(seed), KIT);
  for (const f of out.flats as FlatSpec[]) {
    const b = groupBounds(f.group);
    if (!b.every(Number.isFinite)) continue;
    const m = f.move ? moveAt(f.move, 0) : null;
    const ox = (f.x ?? 0) / 100 + (m?.at[0] ?? 0), oy = (f.y ?? 0) / 100 + (m?.at[1] ?? 0), oz = (f.z ?? 0) / 100 + (m?.at[2] ?? 0);
    const pitch = f.pitch ?? 0, yaw = f.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    // the art's x runs along the flat (turned by yaw); its y (down in the art) runs up, or into the floor when laid flat
    for (const ax of [b[0], b[2]]) for (const ay of [b[1], b[3]]) {
      const u = ax / 100, v = -ay / 100, up = Math.abs(pitch) > 0.8 ? 0 : v, back = Math.abs(pitch) > 0.8 ? v : 0;
      const x = ox + u * c, z = oz - u * s - back, y = oy + up;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  if (!Number.isFinite(x0)) return { x0: -0.5, x1: 0.5, y0: 0, y1: 1, z0: 0, z1: 0 };
  return { x0, x1, y0, y1, z0, z1 };
}

export const FIGURE: AvatarDoc = { ...KIT.defaultDoc, body: { ...KIT.defaultDoc.body, height: 0.4 } };

/** The place, the cues and the cast that show a generator alone. */
export function solo(gen: Gen, o: SoloOptions): { place: PlaceDoc; cues: Cue[]; cast: Record<string, AvatarDoc> } {
  // a thing hung on a wall (the `hung` tag: a clock, a picture) is shown there, at eye height
  const hung = gen.meta?.tags?.includes("hung") ? 1.45 : 0;
  const e0 = extent(gen, o.params, o.seed), e = { ...e0, y0: e0.y0 + hung, y1: e0.y1 + hung };
  const ground0 = hung && o.ground !== "none" ? "room" : o.ground;
  // a piece built in depth (a road ahead, a carriage) is seen as from a seat: a 4 m view at its front, not fitted to all it draws
  const deep = gen.features.has("depth") && e.z1 - e.z0 > 3;
  if (deep) Object.assign(e, { x0: -2.1, x1: 2.1, y0: -0.1, y1: 2.3, z1: 0 });
  // (it brings its own ground: no floor under it)
  const ground = deep ? "none" : ground0;
  const w = Math.max(e.x1 - e.x0, 0.2), big = e.y1 - e.y0 > 0.4 || w > 0.6;
  const figure = o.held || (o.figure ?? big);
  // the figure stands to the right of what it is shown with, a little in front
  const fx = deep ? 1.5 : e.x1 + 0.45, zFront = Math.min(Math.max(e.z1, -2), 1);
  const pieces: PlaceDoc["pieces"] = [];
  // a floor (and a wall) wide enough, but not wider than an atlas layer takes
  const span = Math.min(2400, Math.max(600, (w + 4) * 100));
  if (ground !== "none") pieces.push({ kit: "floor", x: (e.x0 + e.x1) / 2, z: 0, w: span, d: 600 });
  if (ground === "room") pieces.push({ kit: "wall", x: (e.x0 + e.x1) / 2, z: Math.min(e.z0, 0) - (hung ? 0.02 : 0.4), w: span, h: 320 });
  const props: NonNullable<PlaceDoc["props"]> = {};
  const id = `it_${o.seed.replace(/\W/g, "_")}`;
  if (o.as === "piece") pieces.push({ kit: gen.id, id: "it", x: 0, y: hung, z: 0, seed: o.seed, ...o.params });
  else props[id] = { kit: gen.id, at: o.held ? "me" : { x: 0, y: hung, z: 0 }, ...o.params };
  // the wide shot: what it draws, and the figure when it shows; held, the figure's upper body
  let box = { x0: e.x0, x1: e.x1, y0: Math.min(e.y0, 0), y1: e.y1 };
  if (figure && !o.held && !deep) box = { x0: Math.min(box.x0, fx - 0.35), x1: Math.max(box.x1, fx + 0.35), y0: box.y0, y1: Math.max(box.y1, 1.8) };
  if (o.held) box = { x0: fx - 0.6, x1: fx + 0.6, y0: 0.7, y1: 1.85 };
  const pad = Math.max(0.08, (box.x1 - box.x0) * 0.08);
  const place: PlaceDoc = {
    v: 1, id: "solo", name: { tr: gen.id, en: gen.id }, size: { w: Math.max(6, box.x1 - box.x0 + 2), d: 6 },
    pieces, props, marks: { me: { x: fx, z: o.held ? 0.2 : zFront + 0.3, facing: "l" } },
    times: ["day", "golden", "dusk", "night"],
    states: Object.fromEntries((gen.meta?.states ?? []).map(s => [s, {}])),
    camera: { wide: { x: (box.x0 + box.x1) / 2, w: box.x1 - box.x0 + pad * 2, z: o.held ? 0.2 : zFront, y0: box.y0 - pad / 2, y1: box.y1 + pad / 2 } },
  };
  const cues: Cue[] = [{ scene: { place: "solo", at: figure ? { me: "me" } : {} } }];
  if (o.held) cues.push({ beat: { who: "me", obj: [{ id, op: "take" }] } });
  return { place, cues, cast: figure ? { me: FIGURE } : {} };
}
