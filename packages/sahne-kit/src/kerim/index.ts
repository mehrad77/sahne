// Kerim's puppet (DESIGN.md §5.4): her one drawing (art.gen.ts, converted from the app's art by kerim/build.ts) on
// sahne's bird rig (rig/bird.ts), wearing the app's moods (kerim.css) and her own gestures (gestures.ts). Not in the
// kit's index, so a page that never casts her never loads her: it imports `sahne-kit/kerim` and adds `puppets` to its
// kit ({ ...kit, puppets }), and a cast entry `{ puppet: "bird" }` is her. She is about 45 cm from her toes to her crown.

import { Path, birdBones, birdPose, type Affine, type BirdFlight, type BirdMood, type BirdPoseOptions, type BirdRig, type BodyDims, type Item, type Kit, type KitPuppet, type Shape } from "sahne";
import { KERIM_PARTS, KERIM_PIVOTS, KERIM_FLIGHT, type KShape } from "./art.gen.ts";
import { BIRD_GESTURES } from "./gestures.ts";

export { BIRD_GESTURES };

/** Her moods: the app's (kerim.css :18–31; degrees, art units + down) and `hunch`, which is new. No sparks, notes or z's: the stage has no celebration marks. */
export const MOODS: Record<string, BirdMood> = {
  idle: {},
  happy: { head: -6, beak: 16, tail: 6, alt: { eyes: "big", brow: "happy", brow2: "happy" } },
  // as the app: wings out (the spread wing up 8°), ^ ^ eyes; the app's 3 px lift is left out so she keeps her feet
  cheer: { head: -6, beak: 24, wing: 8, alt: { eyes: "joy", wing: "spread", wing_far: "on" } },
  sad: { head: 16, headDy: 1.5, tail: -7, wing: -4, alt: { eyes: "big", wet: "on", tear: "on", brow: "sad", brow2: "sad", smile_sad: "on" } },
  think: { head: -11, alt: { brow2: "think" } },
  sleepy: { head: 10, headDy: 1, alt: { eyes: "shut" } },
  hunch: { head: 8, headDy: 2, wing: -6 },
};

/** The kit's 14 emotions (face.ts EMOTIONS), each worn as one of her moods. */
export const EMO: Record<string, string> = {
  neutral: "idle", annoyed: "idle", happy: "happy", proud: "happy", surprised: "happy", laugh: "cheer",
  sad: "sad", sorry: "sad", moved: "sad", curious: "think", confused: "think", shy: "think", tired: "sleepy", nervous: "hunch",
};

const PART = new Map(KERIM_PARTS.map(p => [p.id, p]));
const part = (id: string) => { const p = PART.get(id); if (!p) throw new Error(`sahne-kit: Kerim has no part ${id} (run node packages/sahne-kit/kerim/build.ts)`); return p; };
/** A part's box in art units, its strokes' half widths included. */
function boxOf(id: string): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of part(id).shapes) for (const c of s.d) for (let i = 1, w = (s.width ?? 0) / 2; i < c.length; i += 2) {
    const x = c[i] as number, y = c[i + 1] as number;
    b[0] = Math.min(b[0], x - w); b[1] = Math.min(b[1], y - w); b[2] = Math.max(b[2], x + w); b[3] = Math.max(b[3], y + w);
  }
  return b;
}

/** Her height, toes to crown, cm (D-kerim-size). */
const H = 45;
// she stands on her toes (the legs' lowest point), not on the app's ledge line (y 87, where the art's feet grip its edge)
const FLOOR = boxOf("legs")[3], TOP = boxOf("head")[1], S = H / (FLOOR - TOP);

/** Her rig: the app's pivots, the root moved down to her toes, the spread wings' tips (the outermost points of wing.spread and wingFar) for aiming. */
export const RIG: BirdRig = {
  pivots: { ...KERIM_PIVOTS, bird: [KERIM_PIVOTS.bird[0], FLOOR], wingTip: [4, 23], wingFarTip: [96, 25] },
  scale: S,
  flight: KERIM_FLIGHT as BirdFlight,
};

// the bird rig's bones and the pivot each turns on (rig/bird.ts)
const PIVOT: Record<string, string> = { root: "bird", legs: "legs", body: "body", tail: "tail", wing_far: "wingFar", wing: "wing", head: "head", beak: "beak-lo" };

// Her pieces in the art's drawing order: bone, the art switch it waits for (`key=value`, `*` the default; `-` always drawn) and
// its parts. Shut eyes are drawn under the tear line and their lids over it; `wet` uses the opened eyes' shine, as sad opens them.
const ITEMS = `tail tail=rest* tail
tail tail=fan tail@fan
wing_far wing_far=on wingFar
legs legs=down* legs
body - body
wing wing=fold* wing.fold
wing wing=spread wing.spread
head - head head.blush
head eyes=calm* head.eye head.eye.pupil head.eye.calm head.eye2 head.eye2.pupil head.eye2.calm
head eyes=big head.eye@big head.eye.pupil@big head.eye2@big head.eye2.pupil@big
head eyes=shut head.eye head.eye.pupil head.eye2 head.eye2.pupil
head wet=on head.eye.wet@big head.eye2.wet@big
head eyes=shut head.eye.lid head.eye2.lid
head - head#2
beak - head.beak-lo
head - head#3
head smile_sad=off* head.smile
head smile_sad=on head.smile@sad
head brow=happy head.brow@happy
head brow2=happy head.brow2@happy
head brow=sad head.brow@sad
head brow2=sad head.brow2@sad
head brow2=think head.brow2@think
head eyes=joy head.joy head.joy2
head tear=on head.tear`;

/** A converted shape as kit shapes in a bone's frame (`m`, cm): the app's rim under the fill (paint-order stroke), or a line. Flat: the rims are the art's own. */
function shapes(s: KShape, m: Affine): Shape[] {
  const path = Object.assign(new Path(), { cmds: s.d }).transform(m), k = m[0], op = s.opacity === undefined ? {} : { opacity: s.opacity };
  const fill: Shape[] = s.fill ? [{ path, fill: s.fill, flat: true, ...op }] : [];
  const line: Shape[] = s.stroke ? [{ path, stroke: { color: s.stroke, width: (s.width ?? 1) * k, ...(s.cap ? { cap: s.cap } : {}), ...(s.dash ? { dash: s.dash.map(v => v * k) } : {}) }, flat: true, ...op }] : [];
  return s.under ? [...line, ...fill] : [...fill, ...line];
}

/** Her pieces, each art part moved into its bone's frame: (p − the bone's pivot) × scale. */
function items(): Item[] {
  return ITEMS.split("\n").map(line => {
    const [bone, sw, ...ids] = line.split(" "), o = RIG.pivots[PIVOT[bone]], m: Affine = [S, 0, 0, S, -o[0] * S, -o[1] * S];
    const [key, v] = sw.split("="), value = v?.replace("*", "");
    return { layer: bone, bone, ppcm: 10, group: { edge: 0, shapes: ids.flatMap(id => part(id).shapes.flatMap(s => shapes(s, m))) },
      ...(value ? { alt: { key, value, ...(v.endsWith("*") ? { default: true } : {}) } } : {}) };
  });
}

const cm = (u: number) => u * S;

/** Kerim as a kit puppet; `motion: "still"` holds a flight's pose without wingbeats (rig/bird.ts). Her colours are her own: the kit's palettes are not used. */
export function kerim(_kit?: Kit, motion?: BirdPoseOptions["motion"]): KitPuppet {
  const head = boxOf("head"), trunk = boxOf("body"), P = RIG.pivots, sh = cm(trunk[2] - trunk[0]);
  // the wing reaches from her middle to the spread tip: framing keeps room for it; legs end at the floor
  const arm = cm(P.bird[0] - P.wingTip[0]) - sh / 2, leg = cm(FLOOR - P.legs[1]);
  // sized for framing, bubbles, targets and the shadow; she has no arms, neck or hips to measure
  const body: BodyDims = {
    build: "adult", H, headW: cm(head[2] - head[0]), headH: cm(head[3] - head[1]), neckL: 0, neckW: cm(12),
    torsoL: cm(FLOOR - P.head[1]), shoulderW: sh, chestW: sh, waistW: sh, hipW: sh * 0.9,
    upperArmL: arm * 0.45, foreArmL: arm * 0.45, handL: arm * 0.1, armW: [cm(10), cm(8), cm(4)],
    thighL: leg / 2, shinL: leg / 2, footH: cm(2), footW: cm(7), legW: [cm(2.3), cm(2.3), cm(2.3)], legLen: leg,
  };
  const front = items();
  return {
    kind: "bird", body, bones: birdBones(RIG), views: { front, back: front }, gestures: BIRD_GESTURES,
    pose: input => birdPose(input, { rig: RIG, moods: MOODS, emo: EMO, ...(motion ? { motion } : {}) }),
  };
}

/** For a kit's `puppets`: a cast entry `{ puppet: "bird" }` is Kerim. */
export const puppets = { bird: kerim };
