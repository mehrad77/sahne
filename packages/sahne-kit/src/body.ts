// Proportions and the base body: head, ears, neck, hands and the skin of the limbs.
// Big heads, so faces read at phone size (STYLE.md): adults about 1:3.4, children 1:2.8, toddlers 1:2.4.

import { smooth, ellipse, tone, lerp, type BodyDims, type AvatarDoc, type Choice, type PartDef, type Item, type Group, type Path } from "sahne";
import { handShapes } from "./hands.ts";
import { headPath, headHalfWidth } from "./draw/head.ts";
import { earGroup, facialHairItems, faceStyle } from "./face.ts";
import { nm } from "./palette.ts";

type Spec = AvatarDoc["body"];

const SHAPES = {
  slim: { sh: 38, waist: 28, hip: 32, arm: [9.5, 8, 6.6], leg: [13.5, 10.8, 9], head: 0.97 },
  average: { sh: 42, waist: 32, hip: 35, arm: [10.8, 9, 7.2], leg: [15, 12, 10], head: 1 },
  broad: { sh: 48, waist: 37, hip: 38, arm: [12.5, 10.5, 8.2], leg: [16.5, 13.5, 11], head: 1.03 },
  round: { sh: 45, waist: 44, hip: 44, arm: [13, 10.6, 8.2], leg: [18, 14, 11], head: 1.05 },
} as const;

export function body(spec: Spec): BodyDims {
  const s = SHAPES[spec.shape] ?? SHAPES.average, h = Math.min(1, Math.max(0, spec.height ?? 0.5));
  if (spec.build === "child" || spec.build === "toddler") {
    const t = spec.build === "toddler";
    const H = t ? lerp(88, 98, h) : lerp(106, 122, h);
    const headH = t ? 37 : 40, headW = (t ? 35 : 36) * s.head, neckL = t ? 2 : 3, torsoL = t ? 21 : 27;
    const legLen = H - headH - neckL - torsoL, footH = t ? 3.5 : 4;
    const k = t ? 0.56 : 0.66;
    return {
      build: spec.build, H, headW, headH, neckL, neckW: t ? 8 : 9, torsoL,
      shoulderW: s.sh * k, chestW: (s.sh - 3) * k, waistW: s.waist * k * 1.08, hipW: s.hip * k * 1.02,
      upperArmL: t ? 12 : 16, foreArmL: t ? 10.5 : 14, handL: t ? 6.5 : 8,
      armW: s.arm.map(v => v * (t ? 0.72 : 0.78)) as [number, number, number],
      thighL: (legLen - footH) * 0.53, shinL: (legLen - footH) * 0.47, footH, footW: t ? 6.5 : 7.5,
      legW: s.leg.map(v => v * (t ? 0.66 : 0.72)) as [number, number, number], legLen,
    };
  }
  const elder = spec.build === "elder";
  const H = elder ? lerp(152, 172, h) : lerp(160, 186, h);
  const headH = elder ? 48 : 50, headW = 44 * s.head, neckL = 5, torsoL = lerp(40, 46, h) - (elder ? 2 : 0);
  const legLen = H - headH - neckL - torsoL, footH = 5;
  const ak = H / 172;
  return {
    build: spec.build, H, headW, headH, neckL, neckW: spec.shape === "slim" ? 10 : 11.5, torsoL,
    shoulderW: s.sh, chestW: s.sh - 4, waistW: s.waist, hipW: s.hip,
    upperArmL: 29 * ak, foreArmL: 25 * ak, handL: 13,
    armW: [...s.arm] as [number, number, number],
    thighL: (legLen - footH) * 0.53, shinL: (legLen - footH) * 0.47, footH, footW: 10.5,
    legW: [...s.leg] as [number, number, number], legLen,
  };
}

/** The body vocabularies the builder offers (`kit.features`); the ids are the ones `body()` knows. The face's are in face.ts. */
export const BODY_CHOICES: Record<"body.build" | "body.shape", Choice> = {
  "body.build": {
    values: ["adult", "elder", "child", "toddler"], default: "adult", weights: { adult: 6, elder: 2, child: 2, toddler: 1 },
    names: { adult: nm("Adult", "yetişkin"), elder: nm("Elder", "yaşlı"), child: nm("Child", "çocuk"), toddler: nm("Toddler", "küçük çocuk") },
  },
  "body.shape": {
    values: Object.keys(SHAPES), default: "average",
    names: { slim: nm("Slim", "zayıf"), average: nm("Average", "orta"), broad: nm("Broad", "güçlü"), round: nm("Round", "tombul") },
  },
};

const S = (path: Path, fill: string, o: Partial<{ flat: boolean; opacity: number; evenodd: boolean }> = {}) => ({ path, fill, ...o });

export const base: PartDef = {
  slot: "body",
  draw({ body: b, skin, avatar, kit }) {
    const W = b.headW, H = b.headH, shade = tone(skin, "shade"), shape = avatar.face?.shape;
    const head = headPath(shape, W, H);
    const ear = (side: 1 | -1): Group => earGroup(b, skin, side, avatar.face?.ears);
    const neck: Group = {
      shapes: [
        S(smooth([[-b.neckW / 2, -b.neckL - 6], [b.neckW / 2, -b.neckL - 6], [b.neckW / 2 + 0.4, 5, 0], [-b.neckW / 2 - 0.4, 5, 0]], true, 0.4), skin),
        S(ellipse(0, -b.neckL - 1.5, b.neckW * 0.55, 3.2), shade, { flat: true, opacity: 0.7 }),
      ],
    };
    const headG: Group = {
      shapes: [
        S(head, skin),
        // a soft shade on the side away from the light and under the jaw
        // (kept inside the outline, so a narrow forehead or jaw does not show it)
        S(smooth(([[0.18, 0.86], [0.46, 0.62], [0.44, 0.3], [0.26, 0.08], [0.38, 0.24], [0.43, 0.55]] as const).map(([x, y]): [number, number] => [Math.min(W * x, headHalfWidth(shape, W, H, -H * y) - 0.6), -H * y]), true, 1), shade, { flat: true, opacity: 0.32 }),
        // a full face: a faint soft arc under the chin (not on toddlers, nor under a beard)
        ...(shape === "full" && b.build !== "toddler" && !avatar.facialHair?.style.startsWith("beard") ? [S(smooth([[-W * 0.2, -H * 0.05], [0, -H * 0.012], [W * 0.2, -H * 0.05], [0, -H * 0.03]], true, 1), shade, { flat: true, opacity: 0.25 })] : []),
      ],
    };
    const armSkin = (chain: "arm_l" | "arm_r"): Item => ({ layer: "arm", bone: "spine", strip: { chain, widths: b.armW, color: skin } });
    const legSkin = (chain: "leg_l" | "leg_r"): Item => ({ layer: "leg", bone: "hips", strip: { chain, widths: b.legW, color: skin } });
    const back: Group = { shapes: [S(head, skin)] };
    // every hand shape is an alternative item; the rig names one per hand (Item.alt), relaxed by default
    const hands = (backView: boolean): Item[] => (["l", "r"] as const).flatMap(s =>
      Object.entries(handShapes(b, skin, s === "l" ? 1 : -1, backView)).map(([shape, group]): Item =>
        ({ layer: "hand", bone: `hand_${s}`, group, alt: { key: `hand_${s}`, value: shape, default: shape === "relaxed" } })));
    return {
      front: [
        { layer: "neck", bone: "neck", group: neck },
        { layer: "ear", bone: "head", group: ear(1) }, { layer: "ear", bone: "head", group: ear(-1) },
        { layer: "head", bone: "head", group: headG },
        { layer: "face", bone: "head", face: true },
        ...facialHairItems(b, faceStyle(avatar, kit).facialHair),
        armSkin("arm_l"), armSkin("arm_r"), legSkin("leg_l"), legSkin("leg_r"),
        ...hands(false),
      ],
      back: [
        { layer: "neck", bone: "neck", group: neck },
        { layer: "head", bone: "head", group: back },
        { layer: "ear", bone: "head", group: ear(1) }, { layer: "ear", bone: "head", group: ear(-1) },
        armSkin("arm_l"), armSkin("arm_r"), legSkin("leg_l"), legSkin("leg_r"),
        ...hands(true),
      ],
    };
  },
};

/**
 * Back-to-front layer order per view. What each layer is for (the art files put their pieces on these):
 * - `hair_back` hair behind the head (front: behind the whole body); `hair_front` hair over the head
 * - `body_back` what is behind the body in front and on top of the back in back view (a backpack)
 * - `leg`, `arm` the skin of the limbs (the base); `hand` the hands and what is drawn over them (a ring)
 * - `trouser` trouser legs, under the shoe; `shaft` a tall boot's shaft over the trouser; `shoe` shoes;
 *   `trouser_hem` a wide hem that falls over the shoe
 * - `hips` bottoms and skirts; `neck` the neck; `torso` tops and dresses; `torso_over` what lies on a
 *   top (a vest, a bib); `outer` coats and jackets; `chest_over` what lies over a coat: scarves,
 *   lanyards, necklaces, aprons, bag straps
 * - `hair_lock` hair hanging over the chest (plaits, locs), front view only, under the arms
 * - `sleeve` a top's sleeves; `outer_sleeve` a coat's; `over_sleeve` on the wrist over every sleeve
 *   (a watch, a bangle) and held things the hand closes round (a cane, a bag's body)
 * - `ear` the ears (the base); `ear_wear` earrings, studs, earbuds: under the hair that covers the ear
 * - `head`, `face` the base; `glasses` glasses; `headwear` scarves, hats, hearing devices (over the hair)
 * - `held` props in hand (the stage's)
 */
export const LAYERS = {
  front: ["hair_back", "body_back", "leg", "trouser", "shaft", "shoe", "trouser_hem", "hips", "neck", "torso", "torso_over", "outer", "chest_over", "hair_lock", "arm", "sleeve", "outer_sleeve", "over_sleeve", "hand",
    "ear", "head", "face", "glasses", "ear_wear", "hair_front", "headwear", "held"],
  back: ["leg", "trouser", "shaft", "shoe", "trouser_hem", "hips", "neck", "torso", "torso_over", "outer", "chest_over", "head", "ear", "ear_wear", "hair_back", "hair_front", "headwear", "body_back",
    "arm", "sleeve", "outer_sleeve", "over_sleeve", "hand", "held"],
};
