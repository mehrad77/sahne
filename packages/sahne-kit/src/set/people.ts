// Faceless paper people for crowds (DESIGN.md §6.9): passers-by, groups, a queue,
// people sitting. They are set dressing, not cast: no face, no rig, never tapped (`pick: false`); the
// extras who act are M3's. Seen side on, facing right (`flip` turns them), or sitting facing us on a bench
// along a wall (`sit_front`, the metro's benches). Units cm, origin at the feet, y down. A walker is drawn as a body and two strides (legs, and the near arm) that alternate.

import { ellipse, rect, rrect, smooth, tone, mix, type FlatMotion, type FlatSpec, type FlatWhen, type Rng, type Shape, type Vec2 } from "sahne";
import { S, P, flip } from "./draw.ts";
import { CROWD_FABRIC, FABRIC, HAIR, SKIN } from "../palette.ts";

export type Build = "adult" | "elder" | "child";
export type Carry = "none" | "bag" | "pack" | "phone" | "shopping" | "case" | "cane";

/** One passer-by: what they look like and carry. */
export interface Person {
  build: Build;
  /** Height, cm, and a width factor (0.85 slim … 1.25 broad). */
  h: number; w: number;
  skin: string; hair: string;
  hairStyle: "short" | "long" | "bun" | "curly" | "bald";
  head: "none" | "scarf" | "cap" | "beanie";
  top: string; topKind: "short" | "jacket" | "coat";
  bottom: string; skirt: boolean; shoes: string;
  carry: Carry; bag: string;
  /** Holds an umbrella when it rains, a little flag on a holiday. */
  umbrella: boolean; umbrellaColor: string; flag: boolean;
}

const NATURAL_HAIR = ["hair_01", "hair_02", "hair_03", "hair_04", "hair_05", "hair_06", "hair_07", "hair_10", "hair_11", "hair_15"];
const OLD_HAIR = ["hair_08", "hair_09", "hair_18"];
const TROUSERS = ["fab_03", "fab_04", "fab_22", "fab_24", "fab_18", "fab_19", "fab_08", "fab_21", "fab_20"];
const SHOES = ["#3B3B40", "#5A4030", "#2A2B30", "#E9E6DF", "#7A5034"];
const UMBRELLAS = ["#26272C", "#2E3A59", "#B3261E", "#2F8C88", "#7A3E6E", "#E0A83A"];

/** A seeded passer-by. `cold` dresses them for winter; `build` forces a build. */
export function person(r: Rng, o: { cold?: boolean; build?: Build; flags?: number; umbrellas?: number } = {}): Person {
  const build: Build = o.build ?? (r.chance(0.14) ? "child" : r.chance(0.14) ? "elder" : "adult");
  const h = build === "child" ? r.range(105, 135) : build === "elder" ? r.range(152, 176) : r.range(158, 188);
  const fab = CROWD_FABRIC.map(id => FABRIC[id]);
  const head = o.cold && r.chance(0.35) ? "beanie" : r.chance(build === "child" ? 0.05 : 0.18) ? "scarf" : r.chance(0.1) ? "cap" : "none";
  const carry: Carry = build === "elder" && r.chance(0.4) ? "cane" : r.pick(["none", "none", "none", "bag", "bag", "pack", "pack", "phone", "shopping", "shopping", "case"] as Carry[]);
  return {
    build, h, w: r.range(0.85, 1.25),
    skin: r.pick(Object.values(SKIN)), hair: HAIR[r.pick(build === "elder" ? OLD_HAIR : NATURAL_HAIR)],
    hairStyle: build === "elder" && r.chance(0.35) ? "bald" : r.pick(["short", "short", "long", "bun", "curly"] as const),
    head, top: r.pick(fab), topKind: o.cold ? r.pick(["jacket", "coat"] as const) : r.pick(["short", "short", "jacket", "jacket", "coat"] as const),
    bottom: FABRIC[r.pick(TROUSERS)], skirt: r.chance(0.2), shoes: r.pick(SHOES),
    carry, bag: r.pick(fab),
    umbrella: r.chance(o.umbrellas ?? 0.7), umbrellaColor: r.pick(UMBRELLAS),
    flag: r.chance((o.flags ?? 0.5) * (build === "child" ? 1.6 : 1)),
  };
}

/** A limb: a round-capped band through points, `w` cm wide. */
const limb = (pts: Vec2[], color: string, w: number): Shape => ({ path: smooth(pts, false, 1), stroke: { color, width: w, cap: "round", join: "round" } });

/** The parts of a drawn person: the body, two strides (legs, then the near arm), and what is held up high (the umbrella or the flag), each its own flat. */
export interface Drawn { body: Shape[]; legs: [Shape[], Shape[]]; arm: [Shape[], Shape[]]; umbrella: Shape[]; flag: Shape[] }

/** The Turkish flag on a little stick held at (`x`, `y`), the flag `w` cm wide at the top, flying right. */
export function handFlag(x: number, y: number, w: number): Shape[] {
  const h = w * 2 / 3, top = y - h * 2.4, cx = x + h * 0.5, cy = top + h / 2;
  // the flag law: the crescent's circles 0.5 h and 0.5625 h from the hoist, the star's centre at 0.82 h, a point towards the hoist
  const star: [number, number, number][] = Array.from({ length: 10 }, (_, i) => { const a = Math.PI + i * Math.PI / 5, rr = i % 2 ? h * 0.05 : h * 0.125; return [x + h * 0.82 + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0]; });
  return [
    { path: smooth([[x, y + 2], [x, top]], false, 1), stroke: { color: "#8A6A48", width: 1.2, cap: "round" } },
    S(rect(x, top, w, h), "#E30A17"), S(ellipse(cx, cy, h * 0.25), "#FFFFFF", { flat: true }), S(ellipse(cx + h * 0.0625, cy, h * 0.2), "#E30A17", { flat: true }), { path: smooth(star, true, 1), fill: "#FFFFFF", flat: true },
  ];
}

export type Pose = "walk" | "stand" | "sit" | "sit_front";

/**
 * A person in a pose, facing right (`sit_front`: facing us): `walk` gives two strides (contact and passing), `stand` and `sit`
 * one (in `legs[0]`, `arm[0]`). Colours are muted towards the haze by `mute` (0…1).
 */
export function drawPerson(p: Person, pose: Pose, mute = 0.35, seat = 45): Drawn {
  if (pose === "sit_front") return seatedFront(p, mute, seat);
  const m = (c: string) => mix(c, "#A3ACB5", mute), H = p.h, child = p.build === "child";
  const skin = m(p.skin), hair = m(p.hair), top = m(p.top), bottom = m(p.bottom), shoes = m(p.shoes);
  const hr = H * (child ? 0.095 : 0.075), stoop = p.build === "elder" ? H * 0.03 : 0, lean = pose === "walk" ? H * 0.015 : 0;
  // heights above the ground (positive), then y = −height; sitting lowers everything above the hips to the seat
  const hipH = H * (child ? 0.48 : 0.5), drop = pose === "sit" ? hipH - seat : 0;
  const Y = (k: number) => -(H * k - drop), hip = -(hipH - drop), sh = Y(child ? 0.78 : 0.81);
  const T = H * 0.14 * p.w, lw = H * (child ? 0.075 : 0.065) * Math.sqrt(p.w), sx = lean + stoop;
  const body: Shape[] = [], umbrella: Shape[] = [], flag: Shape[] = [];

  // the back things first: a backpack, the case being pulled
  if (p.carry === "pack") body.push(S(rrect(-T / 2 - H * 0.07 + sx * 0.6, sh + H * 0.02, H * 0.09, H * 0.2, H * 0.03), m(p.bag)), S(rect(-T / 2 - H * 0.07 + sx * 0.6, sh + H * 0.1, H * 0.09, H * 0.015), tone(m(p.bag), "shade"), { flat: true }));
  if (p.carry === "case" && pose === "walk") body.push(S(rrect(-H * 0.36, -H * 0.27, H * 0.15, H * 0.24, H * 0.02), m(p.bag)), S(ellipse(-H * 0.33, -H * 0.015, H * 0.015), "#3B3B40"), S(ellipse(-H * 0.24, -H * 0.015, H * 0.015), "#3B3B40"), limb([[-H * 0.28, -H * 0.27], [-H * 0.2, -H * 0.42]], "#5A626A", 1.4));
  // the torso, leaning into a walk; a jacket or a coat reaches lower
  const hem = p.topKind === "coat" ? Y(0.27) : p.topKind === "jacket" ? Y(0.43) : hip + H * 0.01;
  const torso = smooth([[sx + T / 2 * 0.8, sh, 0], [sx + T / 2, sh + H * 0.06], [T / 2 * 0.95, hip - H * 0.02], [T / 2 * (p.topKind === "coat" ? 1.08 : 0.95), Math.min(hem, -1), 0], [-T / 2 * (p.topKind === "coat" ? 1.08 : 0.95), Math.min(hem, -1), 0], [-T / 2 * 0.95, hip - H * 0.02], [sx - T / 2, sh + H * 0.05], [sx - T / 2 * 0.7, sh, 0]], true, 1);
  if (p.skirt && pose !== "sit") body.push(P([[-T / 2 * 0.9, hip - H * 0.01, 0], [T / 2 * 0.9, hip - H * 0.01, 0], [T / 2 + H * 0.05, Y(0.27), 0], [-T / 2 - H * 0.05, Y(0.27), 0]], bottom));
  body.push(S(torso, top), S(rect(-T, hip - H * 0.02, T * 2, H * 0.015), tone(top, "shade"), { flat: true, opacity: 0.5, clip: torso }));
  if (p.topKind !== "short") body.push({ path: smooth([[sx + T * 0.15, sh + H * 0.02], [T * 0.12, Math.min(hem, -1) - 2]], false, 1), stroke: { color: tone(top, "shade"), width: 0.8 }, flat: true, opacity: 0.7 });
  // the neck and head, a little forward when stooped; hair or a headscarf, a cap or a beanie
  const hx = sx + H * 0.012 + stoop * 0.6, hy = Y(1) + hr;
  body.push(S(rect(hx - H * 0.02, hy + hr * 0.7, H * 0.04, sh - hy - hr * 0.6), skin));
  if (p.head === "scarf") {
    const sc = m(p.bag);
    body.push(P([[hx - hr * 1.15, hy - hr * 0.2], [hx - hr * 0.6, hy - hr * 1.18], [hx + hr * 0.7, hy - hr * 1.1], [hx + hr * 1.08, hy - hr * 0.1], [hx + hr * 0.9, hy + hr * 1.1], [hx + T * 0.4, sh + H * 0.03, 0], [hx - T * 0.6, sh + H * 0.04, 0], [hx - hr * 1.2, hy + hr * 0.9]], sc));
    body.push(S(ellipse(hx + hr * 0.42, hy + hr * 0.1, hr * 0.5, hr * 0.68), skin), { path: smooth([[hx - hr * 0.7, hy - hr * 0.6], [hx - hr * 0.2, hy + hr * 0.9]], false, 1), stroke: { color: tone(sc, "shade"), width: 0.8 }, flat: true, opacity: 0.6 });
  } else {
    if (p.hairStyle === "long") body.push(P([[hx - hr * 1.05, hy - hr * 0.3], [hx - hr * 0.2, hy - hr * 1.12], [hx + hr * 0.6, hy - hr * 0.9], [hx - hr * 0.1, hy + hr * 0.2], [hx - hr * 0.4, sh + H * 0.04, 0], [hx - hr * 1.3, sh + H * 0.02, 0]], hair));
    body.push(S(ellipse(hx, hy, hr * 0.98, hr), skin));
    if (p.hairStyle !== "bald") body.push(P([[hx - hr * 1.03, hy + hr * 0.3], [hx - hr * 0.95, hy - hr * 0.62], [hx - hr * 0.1, hy - hr * (p.hairStyle === "curly" ? 1.28 : 1.12)], [hx + hr * 0.75, hy - hr * 0.75], [hx + hr * 0.45, hy - hr * 0.42], [hx - hr * 0.35, hy - hr * 0.35], [hx - hr * 0.55, hy + hr * 0.3]], hair));
    else body.push(P([[hx - hr * 1.0, hy + hr * 0.25], [hx - hr * 0.98, hy - hr * 0.2], [hx - hr * 0.5, hy + hr * 0.05], [hx - hr * 0.55, hy + hr * 0.4]], hair));
    if (p.hairStyle === "bun") body.push(S(ellipse(hx - hr * 0.95, hy - hr * 0.7, hr * 0.38), hair));
    if (p.hairStyle === "curly") for (let i = 0; i < 5; i++) body.push(S(ellipse(hx - hr * 0.95 + i * hr * 0.36, hy - hr * (0.9 + (i % 2) * 0.18), hr * 0.3), hair));
    if (p.head === "cap") body.push(S(ellipse(hx - hr * 0.05, hy - hr * 0.45, hr * 1.02, hr * 0.62), m(p.bag)), S(rrect(hx + hr * 0.4, hy - hr * 0.5, hr * 0.95, hr * 0.2, hr * 0.1), tone(m(p.bag), "shade")));
    if (p.head === "beanie") body.push(S(ellipse(hx - hr * 0.05, hy - hr * 0.4, hr * 1.06, hr * 0.78), m(p.bag)), S(rect(hx - hr * 1.08, hy - hr * 0.2, hr * 2.1, hr * 0.28), tone(m(p.bag), "shade")));
  }
  // what goes with the body, not the stride: a bag's strap, the phone at the ear, the shopping, a cane
  const arm0: Vec2 = [sx + H * 0.01, sh + H * 0.03];
  if (p.carry === "bag") body.push({ path: smooth([[sx + T * 0.3, sh + 1], [-T * 0.3, hip - H * 0.02]], false, 1), stroke: { color: tone(m(p.bag), "deep"), width: 1.4 } }, S(rrect(-T / 2 - H * 0.04, hip - H * 0.06, H * 0.09, H * 0.08, 2), m(p.bag)));
  const still = (pts: Vec2[], hand: Vec2): Shape[] => [limb(pts, top, lw * 0.75), S(ellipse(hand[0], hand[1], lw * 0.42), skin)];
  let armFixed: Shape[] | null = null;
  if (p.carry === "phone") armFixed = [...still([arm0, [sx + H * 0.06, sh + H * 0.14], [hx + hr * 0.6, hy + hr * 0.5]], [hx + hr * 0.6, hy + hr * 0.5]), S(rrect(hx + hr * 0.45, hy - hr * 0.2, hr * 0.32, hr * 0.85, 1), "#2A2B30")];
  else if (p.carry === "shopping") { const hand: Vec2 = [sx + H * 0.02, Y(0.46)]; armFixed = [...still([arm0, [sx + H * 0.02, Y(0.62)], hand], hand), S(rrect(hand[0] - H * 0.05, hand[1], H * 0.1, H * 0.12, 2), "#F2EFE6"), S(rect(hand[0] - H * 0.05, hand[1] + H * 0.03, H * 0.1, H * 0.02), m(p.bag), { flat: true })]; }
  else if (p.carry === "cane") { const hand: Vec2 = [sx + H * 0.12, Y(0.48)]; armFixed = [limb([[hand[0], hand[1]], [hand[0] + H * 0.04, -1]], "#5A4030", 1.6), ...still([arm0, [sx + H * 0.07, Y(0.62)], hand], hand)]; }
  else if (p.carry === "case" && pose === "walk") { const hand: Vec2 = [-H * 0.2, -H * 0.42]; armFixed = still([arm0, [-H * 0.08, Y(0.62)], hand], hand); }
  // the high hand: an umbrella (the far arm, behind the body) or a little flag
  if (p.umbrella) {
    const hand: Vec2 = [sx + H * 0.08, Y(0.98)], top0: Vec2 = [hand[0] - H * 0.02, Y(1.17)], R = H * 0.34, uc = m(p.umbrellaColor);
    umbrella.push(limb([[sx, sh + H * 0.03], [sx + H * 0.1, Y(0.86)], hand], tone(top, "shade"), lw * 0.7), S(ellipse(hand[0], hand[1], lw * 0.42), tone(skin, "shade")));
    umbrella.push({ path: smooth([hand, top0], false, 1), stroke: { color: "#3B3B40", width: 1.2 } });
    umbrella.push(P([[top0[0] - R, top0[1] + R * 0.42, 0], [top0[0] - R * 0.7, top0[1] + R * 0.05], [top0[0], top0[1] - R * 0.12], [top0[0] + R * 0.7, top0[1] + R * 0.05], [top0[0] + R, top0[1] + R * 0.42, 0], [top0[0] + R * 0.5, top0[1] + R * 0.34, 0], [top0[0], top0[1] + R * 0.42, 0], [top0[0] - R * 0.5, top0[1] + R * 0.34, 0]], uc));
    for (const k of [-0.5, 0, 0.5]) umbrella.push({ path: smooth([[top0[0], top0[1] - R * 0.1], [top0[0] + R * k, top0[1] + R * (k ? 0.34 : 0.42)]], false, 1), stroke: { color: tone(uc, "shade"), width: 0.9 }, flat: true, opacity: 0.8 });
  }
  if (p.flag) {
    const hand: Vec2 = [sx + H * 0.1, Y(child ? 0.95 : 0.9)];
    flag.push(limb([[sx, sh + H * 0.03], [sx + H * 0.12, Y(0.8)], hand], tone(top, "shade"), lw * 0.7), S(ellipse(hand[0], hand[1], lw * 0.42), tone(skin, "shade")), ...handFlag(hand[0], hand[1], child ? 16 : 20));
  }

  // legs: the near one in the trousers' colour, the far one in shade; shoes; a stride or a stance
  const leg = (h0: Vec2, k: Vec2, a: Vec2, near: boolean): Shape[] => {
    const c = near ? bottom : tone(bottom, "shade"), sc = near ? shoes : tone(shoes, "shade");
    const bare = p.skirt && pose !== "sit";
    return [limb([h0, k, a], bare ? (near ? skin : tone(skin, "shade")) : c, lw), S(rrect(a[0] - lw * 0.45, a[1] - lw * 0.55, H * 0.12, lw * 0.75, lw * 0.35), sc)];
  };
  const hipPt = (dx: number): Vec2 => [dx, hip + H * 0.02];
  const at = (x: number, k: number): Vec2 => [H * x, -H * k];
  let legs: [Shape[], Shape[]], arm: [Shape[], Shape[]];
  const swing = (elbow: Vec2, hand: Vec2): Shape[] => armFixed ? [] : [...(p.topKind === "short" ? [limb([arm0, elbow], top, lw * 0.8), limb([elbow, hand], skin, lw * 0.62)] : [limb([arm0, elbow, hand], top, lw * 0.75)]), S(ellipse(hand[0], hand[1], lw * 0.42), skin)];
  if (pose === "walk") {
    legs = [
      [...leg(hipPt(-H * 0.01), at(-0.05, 0.27), at(-0.15, 0.06), false), ...leg(hipPt(H * 0.01), at(0.09, 0.27), at(0.16, 0.035), true)],
      [...leg(hipPt(-H * 0.01), at(0.06, 0.3), at(-0.03, 0.12), false), ...leg(hipPt(H * 0.01), at(0.02, 0.27), at(0.005, 0.035), true)],
    ];
    arm = [swing([sx - H * 0.06, Y(0.63)], [sx - H * 0.1, Y(0.48)]), swing([sx + H * 0.01, Y(0.63)], [sx + H * 0.04, Y(0.47)])];
  } else if (pose === "sit") {
    const knee: Vec2 = [H * 0.24, hip - H * 0.01];
    legs = [[...leg(hipPt(0), [knee[0] - 3, knee[1]], [knee[0] - 3, -H * 0.035], false), ...leg(hipPt(H * 0.02), knee, [knee[0] + 2, -H * 0.035], true)], []];
    arm = [swing([sx + H * 0.06, Y(0.6)], [H * 0.17, hip - H * 0.04]), []];
  } else {
    legs = [[...leg(hipPt(-H * 0.01), at(-0.015, 0.27), at(-0.03, 0.035), false), ...leg(hipPt(H * 0.01), at(0.02, 0.27), at(0.02, 0.035), true)], []];
    arm = [swing([sx + H * 0.005, Y(0.63)], [sx + H * 0.01, Y(0.47)]), []];
  }
  if (armFixed) arm = [armFixed, []];
  return { body, legs, arm, umbrella, flag };
}

/** A person sitting facing us, the seat's top `seat` cm up: the thighs coming towards us as a lap, the shins down to the floor, the hands on the lap. All in `body` but the arms (in front). */
function seatedFront(p: Person, mute: number, seat: number): Drawn {
  const m = (c: string) => mix(c, "#A3ACB5", mute), H = p.h, child = p.build === "child";
  const skin = m(p.skin), hair = m(p.hair), top = m(p.top), bottom = m(p.bottom), shoes = m(p.shoes);
  const hr = H * (child ? 0.095 : 0.075), lw = H * (child ? 0.075 : 0.065) * Math.sqrt(p.w);
  // heights: the seat, the shoulders and the head's top above it as when standing (the hips at half the height)
  const hip = -seat, sh = -(seat + H * (child ? 0.28 : 0.31)), headTop = -(seat + H * 0.5), hy = headTop + hr;
  const S2 = H * 0.115 * p.w, W2 = H * 0.09 * p.w, body: Shape[] = [];
  const legsBare = p.skirt, legC = legsBare ? skin : bottom;
  // long hair falls behind the shoulders
  if (p.head === "none" && p.hairStyle === "long") body.push(S(rrect(-hr * 1.1, hy - hr * 0.6, hr * 2.2, sh - hy + hr * 1.1, hr * 0.8), hair));
  // the shins down to the floor, the shoes turned a little out
  for (const k of [-1, 1]) {
    const x = k * W2 * 0.55;
    body.push(limb([[x, hip + 4], [x + k * 1.5, -H * 0.04]], legC, lw), S(ellipse(x + k * 3, -H * 0.02, lw * 0.75, lw * 0.45), shoes));
  }
  // the torso: shoulders to the hips; a coat or jacket closes over the lap
  const hem = p.topKind === "coat" ? hip + 8 : p.topKind === "jacket" ? hip + 2 : hip - 2;
  const torso = smooth([[-S2 * 0.85, sh, 0], [S2 * 0.85, sh, 0], [S2, sh + H * 0.05], [W2 * 1.05, hip - H * 0.06], [W2 * 1.1, hem, 0], [-W2 * 1.1, hem, 0], [-W2 * 1.05, hip - H * 0.06], [-S2, sh + H * 0.05]], true, 1);
  // the lap: both thighs coming towards us, foreshortened, the knees a little apart (a skirt or a dress over them)
  const lap = rrect(-W2 * 1.1, hip - H * 0.035, W2 * 2.2, H * 0.07, H * 0.03);
  body.push(S(lap, p.skirt ? bottom : bottom), { path: smooth([[0, hip - H * 0.03], [0, hip + H * 0.03]], false, 1), stroke: { color: tone(bottom, "shade"), width: 0.8 }, flat: true, opacity: 0.7 });
  body.push(S(torso, top));
  if (p.topKind !== "short") body.push({ path: smooth([[0, sh + H * 0.03], [0, hem - 1]], false, 1), stroke: { color: tone(top, "shade"), width: 0.8 }, flat: true, opacity: 0.7 });
  // a bag stands on the floor by the feet
  if (p.carry === "bag" || p.carry === "pack" || p.carry === "shopping") {
    const bx = W2 * 1.15, bh = H * (p.carry === "pack" ? 0.17 : 0.13), bc = m(p.bag);
    body.push(S(rrect(bx, -bh, H * 0.11, bh, 3), bc), S(rect(bx, -bh * 0.62, H * 0.11, 1.5), tone(bc, "shade"), { flat: true }), { path: smooth([[bx + H * 0.02, -bh], [bx + H * 0.055, -bh - H * 0.035], [bx + H * 0.09, -bh]], false, 1), stroke: { color: tone(bc, "deep"), width: 1.2 } });
  }
  // the neck and head; hair, a headscarf, a cap or a beanie
  body.push(S(rect(-H * 0.02, hy + hr * 0.7, H * 0.04, sh - hy - hr * 0.6), skin));
  if (p.head === "scarf") {
    const sc = m(p.bag);
    body.push(P([[-hr * 1.15, hy - hr * 0.3], [-hr * 0.5, hy - hr * 1.2], [hr * 0.5, hy - hr * 1.2], [hr * 1.15, hy - hr * 0.3], [hr * 1.1, hy + hr * 0.9], [S2 * 0.7, sh + H * 0.04, 0], [-S2 * 0.7, sh + H * 0.04, 0], [-hr * 1.1, hy + hr * 0.9]], sc));
    body.push(S(ellipse(0, hy + hr * 0.1, hr * 0.62, hr * 0.74), skin));
  } else {
    body.push(S(ellipse(0, hy, hr * 0.92, hr), skin));
    if (p.hairStyle !== "bald") body.push(P([[-hr * 0.98, hy + hr * 0.15], [-hr * 0.9, hy - hr * 0.7], [0, hy - hr * (p.hairStyle === "curly" ? 1.26 : 1.12)], [hr * 0.9, hy - hr * 0.7], [hr * 0.98, hy + hr * 0.15], [hr * 0.7, hy - hr * 0.45], [-hr * 0.2, hy - hr * 0.55], [-hr * 0.7, hy - hr * 0.4]], hair));
    else body.push(S(ellipse(-hr * 0.92, hy + hr * 0.1, hr * 0.12, hr * 0.3), hair), S(ellipse(hr * 0.92, hy + hr * 0.1, hr * 0.12, hr * 0.3), hair));
    if (p.hairStyle === "bun") body.push(S(ellipse(0, hy - hr * 1.15, hr * 0.38), hair));
    if (p.hairStyle === "curly") for (let i = 0; i < 5; i++) body.push(S(ellipse(-hr * 0.8 + i * hr * 0.4, hy - hr * (0.92 + (i % 2) * 0.16), hr * 0.3), hair));
    if (p.head === "cap") body.push(S(ellipse(0, hy - hr * 0.5, hr * 1.0, hr * 0.6), m(p.bag)), S(rrect(-hr * 0.7, hy - hr * 0.3, hr * 1.4, hr * 0.18, hr * 0.09), tone(m(p.bag), "shade")));
    if (p.head === "beanie") body.push(S(ellipse(0, hy - hr * 0.45, hr * 1.04, hr * 0.78), m(p.bag)), S(rect(-hr * 1.06, hy - hr * 0.22, hr * 2.12, hr * 0.28), tone(m(p.bag), "shade")));
  }
  // the arms down the sides, the hands on the lap (or holding a phone there)
  const arm: Shape[] = [];
  for (const k of [-1, 1]) {
    const elbow: Vec2 = [k * (S2 + lw * 0.1), hip - H * 0.13], hand: Vec2 = [k * W2 * 0.45, hip - H * 0.025];
    arm.push(limb([[k * (S2 - lw * 0.35), sh + H * 0.03], elbow, hand], top, lw * 0.75), S(ellipse(hand[0], hand[1], lw * 0.42), skin));
  }
  if (p.carry === "phone") arm.push(S(rrect(-H * 0.022, hip - H * 0.06, H * 0.044, H * 0.05, 1), "#2A2B30"));
  return { body, legs: [[], []], arm: [arm, []], umbrella: [], flag: [] };
}

/** A person's flats: the body; the strides (legs behind the body, the near arm in front); the umbrella (in the rain) and the flag (in the flag state). */
export function personFlats(p: Person, pose: Pose, o: { dir: number; at: [number, number]; mute: number; move?: FlatMotion; step?: number; when?: FlatWhen; flagState: string; seat?: number }): FlatSpec[] {
  const d = drawPerson(p, pose, o.mute, o.seat), f = (sh: Shape[]) => flip(sh, o.dir);
  const base = { x: o.at[0], z: o.at[1], ppcm: 1.2, pick: false as const, shadow: "none" as const, ...(o.when ? { when: o.when } : {}) };
  const mv = (extra: Partial<FlatMotion> = {}) => o.move || Object.keys(extra).length ? { move: { ...o.move, ...extra } as FlatMotion } : {};
  const both = (k: 0 | 1) => pose === "walk" && o.step ? { blink: { ms: o.step, on: 0.5, at: k * 0.5 } } : {};
  const out: FlatSpec[] = [];
  for (const k of [0, 1] as const) if (d.legs[k].length) out.push({ ...base, group: { shapes: f(d.legs[k]), edge: 0.5 }, z: o.at[1] - 1, ...mv(both(k)) });
  out.push({ ...base, group: { shapes: f(d.body), edge: 0.6 }, ...mv() });
  for (const k of [0, 1] as const) if (d.arm[k].length) out.push({ ...base, group: { shapes: f(d.arm[k]), edge: 0.5 }, z: o.at[1] + 1, ...mv(both(k)) });
  if (d.umbrella.length) out.push({ ...base, group: { shapes: f(d.umbrella), edge: 0.6 }, z: o.at[1] - 2, when: { ...o.when, weather: ["rain"] }, ...mv() });
  if (d.flag.length) out.push({ ...base, group: { shapes: f(d.flag), edge: 0.5 }, z: o.at[1] - 2, when: { ...o.when, state: [o.flagState] }, ...mv() });
  return out;
}
