// The cast check: every avatar of the cast roster (characters/<id>.json), each outfit applied, and
// every extra, frames without clipping and stays under the 2 KB cap.
// (a) On stage: with the composed puppet at rest, `figureBox` (the stage's lone-figure framing) at full
//     holds every piece. (At head and bust the stage frames a figure by its own head pieces, so only the
//     still below can clip hair or a hat.)
// (b) As a still: `renderSvg` at head and bust holds the hair and headwear inside its top and sides. The
//     still clamps what rises above the head at 1.5 head heights and what reaches sideways at 0.8 head
//     widths, so a failure here is hair or a hat taller or wider than that clamp.
// (c) The raw document, before `normalize` trims it, is within AVATAR_MAX_BYTES.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLook, apply, compose, figureBox, figureDims, groupBounds, renderSvg, restPose, serialize, solve, stripGeometry, stripJoints, stripOutline,
  AVATAR_MAX_BYTES, type AvatarDoc, type FigureDims, type Item, type Puppet, type Vec2,
} from "sahne";
import kit from "../../sahne-kit/src/full.ts";
import { loadWorld } from "../check/world.ts";

const world = loadWorld();
const CAST = { trusted: true };
/** Half a centimetre, in metres for the stage box and in centimetres for the still. */
const EPS_M = 0.005, EPS_CM = 0.5;
const STILL_LAYERS = new Set(["hair_front", "hair_back", "headwear"]);

/** Every avatar to check: each roster avatar, each of its outfits applied, and each extra that is or holds an avatar. */
function docs(): [string, AvatarDoc][] {
  const out: [string, AvatarDoc][] = [];
  for (const [id, c] of Object.entries(world.cast)) {
    if (!c.avatar) continue;
    out.push([id, c.avatar]);
    for (const [name, look] of Object.entries(c.outfits ?? {})) out.push([`${id} outfit ${name}`, applyLook(c.avatar, look)]);
  }
  for (const [id, x] of Object.entries(world.extras)) {
    if (!x || typeof x !== "object") continue;
    const c = x as { avatar?: AvatarDoc; outfits?: Record<string, Parameters<typeof applyLook>[1]> };
    const doc = c.avatar ?? (x as AvatarDoc);
    if (!("v" in doc && "body" in doc)) continue;
    out.push([`extra ${id}`, doc]);
    for (const [name, look] of Object.entries(c.outfits ?? {})) out.push([`extra ${id} outfit ${name}`, applyLook(doc, look)]);
  }
  return out;
}

/** An item's corners in paper centimetres (y down) at rest: a group through its bone, a strip through its outline. */
function corners(it: Item, world: Map<string, Parameters<typeof apply>[0]>): Vec2[] {
  if (it.group) {
    const m = world.get(it.bone);
    if (!m) return [];
    const [x0, y0, x1, y1] = groupBounds(it.group);
    return [apply(m, x0, y0), apply(m, x1, y0), apply(m, x1, y1), apply(m, x0, y1)];
  }
  if (it.strip) {
    const j = stripJoints(world, it.strip.chain);
    return j ? stripOutline(stripGeometry(j, it.strip, it.layer)) : [];
  }
  return [];
}

/**
 * What clips: (a) and (b) above, as messages ([] when nothing does). `dims` defaults to the puppet's own;
 * to see it fail, add a piece to a puppet and pass the clean puppet's dims, as the stage would have framed it.
 */
function clipProblems(name: string, p: Puppet, dims: FigureDims = figureDims(p)): string[] {
  const out: string[] = [];
  const bones = solve(p.bones, restPose());
  // (a) the stage framing: the box is in metres, y up; the pieces are in centimetres, y down
  for (const framing of ["full"] as const) {
    const box = figureBox(framing, dims);
    for (const view of ["front", "back"] as const) for (const it of p.views[view]) {
      const pts = corners(it, bones);
      if (!pts.length) continue;
      const xs = pts.map(q => q[0] / 100), ys = pts.map(q => -q[1] / 100);
      const where = `${name} ${framing} ${view} ${it.layer} on ${it.bone}`;
      if (Math.max(...ys) > box.y1 + EPS_M) out.push(`stage: ${where} rises ${((Math.max(...ys) - box.y1) * 100).toFixed(1)} cm above the frame`);
      if (Math.min(...xs) < box.x0 - EPS_M || Math.max(...xs) > box.x1 + EPS_M) out.push(`stage: ${where} reaches past the frame's side (${(Math.min(...xs) * 100).toFixed(1)}..${(Math.max(...xs) * 100).toFixed(1)} cm, frame ${(box.x0 * 100).toFixed(1)}..${(box.x1 * 100).toFixed(1)})`);
      if (Math.min(...ys) < box.y0 - EPS_M) out.push(`stage: ${where} hangs below the frame`);
    }
  }
  // (b) the still: its view box is in the pieces' own paper centimetres
  const head = bones.get("head");
  for (const framing of ["head", "bust"] as const) {
    const vb = /viewBox="([^"]+)"/.exec(renderSvg(p, kit, { framing }))![1].split(" ").map(Number);
    const [x0, y0, x1] = [vb[0], vb[1], vb[0] + vb[2]];
    for (const it of p.views.front) {
      if (it.bone !== "head" || !it.group || !STILL_LAYERS.has(it.layer) || !head) continue;
      const pts = corners(it, bones), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const where = `${name} ${framing} ${it.layer}`;
      if (Math.min(...ys) < y0 - EPS_CM) out.push(`still: ${where} is ${(y0 - Math.min(...ys)).toFixed(1)} cm above the picture: taller than the still's clamp (1.5 head heights, ${(p.body.headH * 1.5).toFixed(1)} cm)`);
      if (Math.min(...xs) < x0 - EPS_CM || Math.max(...xs) > x1 + EPS_CM) out.push(`still: ${where} reaches past the picture's side: wider than the still's clamp (0.8 head widths, ${(p.body.headW * 0.8).toFixed(1)} cm)`);
    }
  }
  return out;
}

test("there is a roster to check", () => {
  assert.ok(docs().length >= 2, "the roster has avatars");
});

test("every cast avatar and outfit frames at head, bust and full without clipping, on stage and as a still", () => {
  const problems = docs().flatMap(([name, doc]) => clipProblems(name, compose(doc, kit, CAST)));
  assert.deepEqual(problems, []);
});

test("every cast avatar and outfit is within the 2 KB cap as written, before normalize", () => {
  for (const [name, doc] of docs()) {
    const n = new TextEncoder().encode(serialize(doc)).length;
    assert.ok(n <= AVATAR_MAX_BYTES, `${name} is ${n} bytes`);
  }
});
