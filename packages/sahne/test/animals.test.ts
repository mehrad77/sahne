// A cat on stage (director/direct.ts): side-on like a bird (it turns by mirroring, never three-quarters), never on a
// seat, a cat's stride, silent paws; and it neither perches nor flies as the bird narrator does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import { directAll, fold, type DirectCtx } from "../src/director/direct.ts";
import { evaluate } from "../src/anim/timeline.ts";
import type { GestureDef } from "../src/core/kit.ts";
import type { PlaceDoc } from "../src/core/types.ts";
import type { Cue } from "../src/script/types.ts";

const g = (dur: number, stroke: number): GestureDef => ({ dur, stroke, keys: [{ t: 0 }, { t: stroke, head: -0.3 }, { t: dur }] });
const STEPS: PlaceDoc = {
  v: 1, id: "steps", size: { w: 8, d: 4 }, pieces: [], perch: "ledge",
  marks: {
    door: { x: -2, z: -1, facing: "r" }, bowl: { x: 2, z: 0, facing: "r" }, step: { x: 0, y: 0.2, z: 0.4, seat: 0.45, facing: "r" },
    far: { x: 0.5, z: -1.8 }, ledge: { x: 3, y: 2, z: -1.5 },
  },
};
const ctx: DirectCtx = {
  places: { steps: STEPS }, gestures: { look: g(900, 300) }, lang: { id: "x", speech: speechFallback, match: matchFallback }, narrator: "kerim",
  heights: { pisi: 0.37 }, puppets: { pisi: { kind: "cat", gestures: { meow: g(1000, 380) } } },
};
const CAST = ["nima", "pisi"];
const walk = (to: string): Cue => ({ beat: { move: { who: "pisi", to } } });

test("a cat walks side-on: towards −x it is mirrored, towards +x it is 0, never three-quarters", () => {
  const ps = directAll([{ scene: { place: "steps", at: { nima: "door", pisi: "door" } } }, walk("bowl"), walk("door"), walk("far")], CAST, ctx);
  assert.equal(ps[0].after.actors.pisi.yaw, 0, "on a mark facing r it faces right");
  const right = ps[1].tracks.pisi.turns.map(t => t.yaw), left = ps[2].tracks.pisi.turns.map(t => t.yaw);
  assert.ok(right.every(y => y === 0), `${right}`);
  assert.ok(left.length && left.every(y => Math.abs(y - Math.PI) < 1e-9), `${left}`);
  // walking into depth (mostly −z, a little +x) it stays side-on, not its back
  for (const t of ps[3].tracks.pisi.turns) assert.ok(t.yaw === 0 || Math.abs(t.yaw - Math.PI) < 1e-9, `${t.yaw}`);
  // a person going the same way turns three-quarters
  const nima = directAll([{ scene: { place: "steps", at: { nima: "door" } } }, { beat: { move: { who: "nima", to: "bowl" } } }], CAST, ctx)[1].tracks.nima.turns;
  assert.ok(nima.some(t => t.yaw !== 0 && Math.abs(t.yaw) < Math.PI / 2));
});

test("a cat refuses a seat: placed on one or walking to one, it stands (or sits as a cat) on the mark", () => {
  const placed = fold([{ scene: { place: "steps", at: { pisi: "step" } } }], 0, CAST, ctx).actors.pisi;
  assert.equal(placed.seat, undefined);
  const ps = directAll([{ scene: { place: "steps", at: { pisi: "door" } } }, walk("step")], CAST, ctx);
  assert.deepEqual(ps[1].tracks.pisi.seats, []);
  assert.equal(ps[1].after.actors.pisi.seat, undefined);
  assert.deepEqual(ps[1].after.actors.pisi.pos, [0, 0.2, 0.4]);
  // the mark's facing does not turn it three-quarters as it arrives
  assert.ok(ps[1].tracks.pisi.turns.every(t => t.yaw === 0 || Math.abs(t.yaw - Math.PI) < 1e-9));
  // a person sits there
  const nima = directAll([{ scene: { place: "steps", at: { nima: "door" } } }, { beat: { move: { who: "nima", to: "step" } } }], CAST, ctx)[1];
  assert.equal(nima.after.actors.nima.seat, 0.45);
});

test("a cat's stride is its own, its paws are silent, and it neither perches nor flies off", () => {
  const ps = directAll([{ scene: { place: "steps", at: { pisi: "door" } } }, walk("bowl")], CAST, ctx), seg = ps[1].tracks.pisi.walks[0];
  assert.equal(seg.how, "walk");
  assert.ok(Math.abs(seg.stride - 0.28) < 1e-9, `${seg.stride}`);
  const mid = evaluate(ps[1], (seg.t0 + seg.t1) / 2).actors.pisi;
  assert.ok(mid.walk && mid.walk.phase > 2 && mid.walk.phase < 12, `${mid.walk?.phase}`);
  assert.equal(ps[1].sounds.filter(s => s.id === "step").length, 0, "no footsteps");
  // a cat in the cast does not take the narrator's perch, and its own gestures are its
  const c = fold([{ scene: { place: "steps", at: { nima: "door" } } }], 0, ["nima", "pisi", "kerim"], { ...ctx, narrator: "pisi" }).actors.pisi;
  assert.equal(c.on, false, "only a bird perches");
  const meow = directAll([{ scene: { place: "steps", at: { pisi: "bowl" } } }, { beat: { who: "pisi", do: "meow", sfx: { id: "meow", at: "ch:pisi" } } }], CAST, ctx)[1];
  assert.equal(meow.tracks.pisi.gestures[0]?.id, "meow");
  assert.ok(meow.sounds.some(s => s.id === "meow"));
});
