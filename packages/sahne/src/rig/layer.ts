// Small helpers the pose layers share: adding onto a pose, and what a side means on screen.
//
// Sign conventions (checked in test/rig.test.ts): `rotate(r)` turns a bone that points down,
// (0, 1), to (−sin r, cos r), so a positive engine angle swings a hanging bone towards screen
// left (−x), and tilts the top of an upward bone (the spine) towards screen right (+x). The
// character's left side is screen right, so a gesture's "outwards" (+) on the left side is a
// negative engine angle, and on the right side a positive one.

import type { Side } from "../core/kit.ts";
import type { PoseState } from "./skeleton.ts";

export const SIDES: readonly Side[] = ["l", "r"];
export const other = (s: Side): Side => s === "l" ? "r" : "l";
/** Screen direction of a side: +1 for the character's left (screen right), −1 for the right. */
export const sideX = (s: Side) => s === "l" ? 1 : -1;
/** Engine sign of a gesture's limb angle on a side ("outwards and up" is +). */
export const limbSign = (s: Side) => s === "l" ? -1 : 1;

export function addRot(p: PoseState, bone: string, v: number) {
  if (v) p.bones[bone] = (p.bones[bone] ?? 0) + v;
}

export function addOff(p: PoseState, bone: string, x: number, y: number) {
  if (!x && !y) return;
  const off = p.off ??= {}, o = off[bone];
  off[bone] = o ? [o[0] + x, o[1] + y] : [x, y];
}

/** Adds to a bone's length scale (1 at rest). */
export function addLen(p: PoseState, bone: string, d: number) {
  if (!d) return;
  const len = p.len ??= {};
  len[bone] = (len[bone] ?? 1) + d;
}
