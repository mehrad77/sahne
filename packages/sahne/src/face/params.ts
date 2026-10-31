// The face model (DESIGN.md §6.4). Every backend reads the same parameters; the kit draws them.

export interface FaceParams {
  /** 0 closed … 1 open; up to 1.2 for wide eyes. [left, right] as the character sees them. */
  eyeOpen: [number, number];
  /** Upper-lid tilt: positive lowers the inner corner (cross), negative raises it (worried, sad). */
  lidTilt: [number, number];
  /** Lower-lid raise, the squint of a real smile: 0 … 1. */
  lower: [number, number];
  /** Gaze: -1 … 1 across (screen right is +) and down (+). */
  pupil: [number, number];
  pupilSize: number;
  /** Brow heights, -1 (down) … 1 (up), for the inner and outer ends. */
  brows: { l: [number, number]; r: [number, number] };
  /** The mouth: open 0…1, wide 0…1 (0.5 is rest), round 0…1, smile -1…1, teeth 0…1. */
  mouth: { open: number; wide: number; round: number; smile: number; teeth: number };
  blush: number;
  sweat: number;
  tears: number;
}

export const NEUTRAL_FACE: FaceParams = {
  eyeOpen: [1, 1], lidTilt: [0, 0], lower: [0, 0], pupil: [0, 0], pupilSize: 1,
  brows: { l: [0, 0], r: [0, 0] },
  mouth: { open: 0, wide: 0.5, round: 0, smile: 0.15, teeth: 0 },
  blush: 0, sweat: 0, tears: 0,
};

/** A preset changes only what it names; the rest stays neutral. */
export type FacePreset = Partial<Omit<FaceParams, "brows" | "mouth">> & {
  brows?: Partial<FaceParams["brows"]>;
  mouth?: Partial<FaceParams["mouth"]>;
  /** Head tilt in radians and how much the torso slumps (-1) or lifts (1). */
  headTilt?: number;
  posture?: number;
};

export function faceFrom(p: FacePreset | undefined, base: FaceParams = NEUTRAL_FACE): FaceParams {
  if (!p) return clone(base);
  return {
    eyeOpen: p.eyeOpen ?? [...base.eyeOpen], lidTilt: p.lidTilt ?? [...base.lidTilt], lower: p.lower ?? [...base.lower],
    pupil: p.pupil ?? [...base.pupil], pupilSize: p.pupilSize ?? base.pupilSize,
    brows: { l: p.brows?.l ?? [...base.brows.l], r: p.brows?.r ?? [...base.brows.r] },
    mouth: { ...base.mouth, ...p.mouth },
    blush: p.blush ?? base.blush, sweat: p.sweat ?? base.sweat, tears: p.tears ?? base.tears,
  };
}

const l2 = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const l1 = (a: number, b: number, t: number) => a + (b - a) * t;

export function blendFace(a: FaceParams, b: FaceParams, t: number): FaceParams {
  return {
    eyeOpen: l2(a.eyeOpen, b.eyeOpen, t), lidTilt: l2(a.lidTilt, b.lidTilt, t), lower: l2(a.lower, b.lower, t),
    pupil: l2(a.pupil, b.pupil, t), pupilSize: l1(a.pupilSize, b.pupilSize, t),
    brows: { l: l2(a.brows.l, b.brows.l, t), r: l2(a.brows.r, b.brows.r, t) },
    mouth: {
      open: l1(a.mouth.open, b.mouth.open, t), wide: l1(a.mouth.wide, b.mouth.wide, t), round: l1(a.mouth.round, b.mouth.round, t),
      smile: l1(a.mouth.smile, b.mouth.smile, t), teeth: l1(a.mouth.teeth, b.mouth.teeth, t),
    },
    blush: l1(a.blush, b.blush, t), sweat: l1(a.sweat, b.sweat, t), tears: l1(a.tears, b.tears, t),
  };
}

export const clone = (f: FaceParams): FaceParams => blendFace(f, f, 0);

/** A stable key, so the face texture is redrawn only when something visible changed. */
export function faceKey(f: FaceParams): string {
  const r = (n: number) => Math.round(n * 50);
  return [f.eyeOpen, f.lidTilt, f.lower, f.pupil, f.brows.l, f.brows.r].flat().map(r).join(",") + "|" +
    [f.pupilSize, f.mouth.open, f.mouth.wide, f.mouth.round, f.mouth.smile, f.mouth.teeth, f.blush, f.sweat, f.tears].map(r).join(",");
}
