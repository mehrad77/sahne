// The humanoid skeleton of a paper puppet. Paper space: centimetres, y down, origin between the
// feet on the floor, the character facing the viewer (their left is screen right, +x).
// Limb bones point down (+y) at rest; a positive angle turns a bone clockwise on screen.

import { mul, rotate, translate, apply, IDENTITY, type Affine, type Vec2 } from "../core/math.ts";
import type { BodyDims } from "../core/types.ts";

export interface BoneDef { name: string; parent: string | null; x: number; y: number; rot: number }
export type Pose = Record<string, number>;
export interface PoseState {
  bones: Pose;
  /** Whole-body offset in cm (bob, hop). */
  dx: number; dy: number;
  /** Length scale of a bone: its children sit closer (0.8 = foreshortened towards the viewer). */
  len?: Partial<Record<string, number>>;
  /** Extra offset of a bone's pivot in its parent's frame, cm (breath lifts the chest, a nod drops the head). */
  off?: Partial<Record<string, Vec2>>;
}

export const BONES = [
  "root", "hips", "spine", "neck", "head",
  "arm_l", "forearm_l", "hand_l", "arm_r", "forearm_r", "hand_r",
  "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r",
] as const;
export type BoneName = typeof BONES[number];

/** Arm and leg chains for the strip renderer: [root joint, middle joint, end joint]. */
export const CHAINS: Record<string, [BoneName, BoneName, BoneName]> = {
  arm_l: ["arm_l", "forearm_l", "hand_l"],
  arm_r: ["arm_r", "forearm_r", "hand_r"],
  leg_l: ["thigh_l", "shin_l", "foot_l"],
  leg_r: ["thigh_r", "shin_r", "foot_r"],
};

/** A bone of an arm (`arm_l`, `forearm_r`, `hand_l`): the match's group 1 is its side. */
export const ARM_BONE = /^(?:arm|forearm|hand)_([lr])$/;

export function humanoid(b: BodyDims): BoneDef[] {
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
    { name: "foot_r", parent: "shin_r", x: 0, y: b.shinL, rot: 0 },
  ];
}

/**
 * The bones of a person seated side on, facing screen right (DESIGN.md §6.3, `Kit.side`): the same names as `humanoid`, the
 * hips `seat` cm above the floor, both shoulders and both hips on the body's middle line (the far limbs behind the near ones),
 * the spine leaning a little forwards, the thighs level and pointing forwards, the shins down to the floor (leaning forwards
 * when they are longer than the seat is high; hanging when the seat is high), the feet flat and forwards, the upper arms
 * hanging a little forwards and the forearms on the thighs (`_l` the far limbs, `_r` the near ones).
 */
export function seatedSide(b: BodyDims, seat: number): BoneDef[] {
  const lean = 0.06, sy = -b.torsoL + b.armW[0] * 0.72;
  const drop = Math.max(1, seat - b.footH), c = Math.min(1, drop / b.shinL), shin = -Math.acos(c);
  const arm = -0.32, fore = -1.28;
  const out: BoneDef[] = [
    { name: "root", parent: null, x: 0, y: 0, rot: 0 },
    { name: "hips", parent: "root", x: 0, y: -seat, rot: 0 },
    { name: "spine", parent: "hips", x: 0, y: 0, rot: lean },
    { name: "neck", parent: "spine", x: 0, y: -b.torsoL, rot: -lean },
    { name: "head", parent: "neck", x: 0, y: -b.neckL, rot: 0 },
  ];
  for (const [s, dx] of [["l", -1.5], ["r", 1.5]] as const) out.push(
    { name: `arm_${s}`, parent: "spine", x: dx, y: sy, rot: arm - lean },
    { name: `forearm_${s}`, parent: `arm_${s}`, x: 0, y: b.upperArmL, rot: fore - arm },
    { name: `hand_${s}`, parent: `forearm_${s}`, x: 0, y: b.foreArmL, rot: 0.25 },
  );
  for (const [s, dx] of [["l", -1], ["r", 1]] as const) out.push(
    { name: `thigh_${s}`, parent: "hips", x: dx, y: 0, rot: -Math.PI / 2 },
    { name: `shin_${s}`, parent: `thigh_${s}`, x: 0, y: b.thighL, rot: shin + Math.PI / 2 },
    { name: `foot_${s}`, parent: `shin_${s}`, x: 0, y: b.shinL, rot: -shin },
  );
  return out;
}

/** Forward kinematics: every bone's transform from its own frame to paper space. */
export function solve(bones: BoneDef[], pose?: PoseState): Map<string, Affine> {
  const out = new Map<string, Affine>();
  const base: Affine = pose ? translate(pose.dx, pose.dy) : IDENTITY;
  for (const b of bones) {
    const parent = b.parent ? out.get(b.parent)! : base;
    const r = b.rot + (pose?.bones[b.name] ?? 0);
    const k = (b.parent ? pose?.len?.[b.parent] : undefined) ?? 1, o = pose?.off?.[b.name];
    out.set(b.name, mul(parent, mul(translate(b.x * k + (o?.[0] ?? 0), b.y * k + (o?.[1] ?? 0)), rotate(r))));
  }
  return out;
}

/** The pivot of a bone in paper space. */
export const jointOf = (world: Map<string, Affine>, name: string): Vec2 => apply(world.get(name)!, 0, 0);

export const restPose = (): PoseState => ({ bones: {}, dx: 0, dy: 0 });
