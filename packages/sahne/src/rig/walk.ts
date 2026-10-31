// The paper walk (DESIGN.md §6.3): the stepping knee comes towards the viewer (its thigh
// foreshortens) and leads into the direction while the foot lifts, the legs alternate each step,
// the body bobs, the free arms swing against the legs and the spine leans into the direction with
// the head counter-leaning. Children hop and toddlers bounce: their body leaves the floor at the
// passing position; anyone told to `hop` hops: both feet leave the floor each step, the knees bend
// on landing and the arms lift. The planted foot is kept on the floor by the floor pass in pose.ts.

import { clamp } from "../core/math.ts";
import type { BodyDims } from "../core/types.ts";
import type { Side } from "../core/kit.ts";
import type { MoveHow } from "../script/types.ts";
import type { PoseState } from "./skeleton.ts";
import { SIDES, addLen, addRot } from "./layer.ts";

export interface WalkInput { phase: number; amount: number; dir: number; how?: MoveHow; /** On a stair: +1 up, −1 down (times the walk's amount). */ climb?: number }

export function walkLayer(pose: PoseState, body: BodyDims, w: WalkInput, hold: Record<Side, number>): void {
  const A = clamp(w.amount, 0, 1), dir = w.dir < 0 ? -1 : 1, k = body.legLen / 74;
  if (A <= 0) return;
  const n = Math.floor(w.phase), u = w.phase - n, lift = Math.sin(Math.PI * u) * A;
  const step: Side = (n & 1) === 0 ? "l" : "r";
  // on a stair the stepping knee comes up higher (going up most), and the body leans into the climb
  const c = clamp(w.climb ?? 0, -1, 1), knee = 1 + 1.8 * Math.abs(c) * (c > 0 ? 1 : 0.6);
  addLen(pose, `thigh_${step}`, -0.2 * lift * knee);
  addRot(pose, `thigh_${step}`, -dir * 0.1 * lift * knee);
  addRot(pose, `shin_${step}`, dir * 0.24 * lift * knee);
  if (c) addRot(pose, "spine", dir * 0.06 * c);
  // lowest at contact (both feet down), back at full height when the legs pass
  const hopping = w.how === "hop", hop = hopping ? 7 : body.build === "child" ? 2.2 : body.build === "toddler" ? 1.4 : 0;
  pose.dy += k * A * ((hopping ? 2.6 : 1.6) * Math.cos(Math.PI * u) ** 2 - hop * Math.sin(Math.PI * u));
  if (hopping) {
    // both knees give on landing (the thighs foreshorten towards the viewer), and the arms lift in the air
    const land = Math.cos(Math.PI * u) ** 2 * A;
    for (const s of SIDES) { addLen(pose, `thigh_${s}`, -0.18 * land); addRot(pose, `arm_${s}`, (s === "r" ? -1 : 1) * 0.16 * lift * (1 - clamp(hold[s], 0, 1))); }
  }
  addRot(pose, "spine", dir * 0.035 * A);
  addRot(pose, "neck", -dir * 0.015 * A);
  addRot(pose, "head", -dir * 0.015 * A);
  // the arm opposite the stepping leg swings into the direction; the forearm follows a little later
  const sw = Math.sin(Math.PI * w.phase) * A, late = Math.sin(Math.PI * (w.phase - 0.15)) * A;
  for (const s of SIDES) {
    const free = 1 - clamp(hold[s], 0, 1), sg = s === "r" ? -dir : dir;
    addRot(pose, `arm_${s}`, sg * 0.12 * sw * free);
    addRot(pose, `forearm_${s}`, sg * 0.07 * late * free);
  }
}
