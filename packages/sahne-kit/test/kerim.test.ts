// Kerim's stage art (src/kerim/art.gen.ts): current with her one drawing (src/kerim/art.ts), every part
// converted, arcs kept on their curves, every coordinate finite.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Cmd } from "sahne";
import { build, check, parsePath, arcToCubics } from "../kerim/build.ts";
import { KERIM_PARTS, KERIM_PIVOTS, KERIM_FLIGHT, KERIM_MOODS } from "../src/kerim/art.gen.ts";
import { K_MOODS } from "../src/kerim/art.ts";

test("Kerim's stage art is current (node packages/sahne-kit/kerim/build.ts)", async () => {
  assert.deepEqual(await check(), []);
});

test("the converter names her art when it is missing", async () => {
  const missing = new URL("../src/kerim/no-such-art.ts", import.meta.url);
  const p = await check({ art: missing });
  assert.equal(p.length, 1);
  assert.match(p[0], /no-such-art\.ts/);
  await assert.rejects(build({ art: missing }), /no-such-art\.ts/);
});

test("every part of K_BIRD is converted, in drawing order; the ledge and the celebration marks are left out", () => {
  const ids = KERIM_PARTS.map(p => p.id);
  for (const id of ["tail", "wingFar", "legs", "body", "wing.fold", "wing.spread", "head", "head.blush", "head.eye", "head.eye.pupil", "head.eye.wet", "head.eye.calm", "head.eye.lid",
    "head.eye2", "head.eye2.pupil", "head.eye2.lid", "head.beak-lo", "head.smile", "head.brow", "head.brow2", "head.joy", "head.joy2", "head.tear", "tail@fan", "head.eye@big", "head.smile@sad"]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.some(id => /fx|spark|note|ledge|\bz\b|\bq\b/.test(id)), ids.join(" "));
  // drawing order: the tail behind the body, the body behind the wing, the head on top
  assert.ok(ids.indexOf("tail") < ids.indexOf("body") && ids.indexOf("body") < ids.indexOf("wing.fold") && ids.indexOf("wing.fold") < ids.indexOf("head"));
  // what shows by default: folded wing, legs, calm eyes; the spread wing, the far wing and the lids wait for a pose
  const hidden = new Set(KERIM_PARTS.filter(p => p.hidden).map(p => p.id));
  for (const id of ["wing.spread", "wingFar", "head.eye.lid", "head.tear", "head.joy"]) assert.ok(hidden.has(id), id);
  for (const id of ["wing.fold", "legs", "head.eye.calm", "body"]) assert.ok(!hidden.has(id), id);
  // the rims the app paints under each fill come along
  assert.ok(KERIM_PARTS.find(p => p.id === "body")!.shapes[0].under);
  assert.deepEqual(KERIM_MOODS, K_MOODS);
});

test("arcs become cubics on the ellipse, and the ends meet exactly", () => {
  const on = (cx: number, cy: number, rx: number, ry: number, x: number, y: number) => Math.abs(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 - 1);
  const cubic = (p: number[], c: Cmd, t: number) => { const u = 1 - t, q = c as number[]; return [0, 1].map(i => u * u * u * p[i] + 3 * u * u * t * q[1 + i] + 3 * u * t * t * q[3 + i] + t * t * t * q[5 + i]); };
  // the lid's lower edge: a half ellipse 6.4 × 3.8 from (61.8, 35.2) to (49, 35.2), centre (55.4, 35.2)
  const cmds = arcToCubics(61.8, 35.2, 6.4, 3.8, 0, false, true, 49, 35.2);
  assert.equal(cmds.length, 2);
  let p = [61.8, 35.2];
  for (const c of cmds) {
    for (const t of [0.25, 0.5, 0.75]) { const [x, y] = cubic(p, c, t); assert.ok(on(55.4, 35.2, 6.4, 3.8, x, y) < 0.01, `${x},${y}`); }
    p = (c as number[]).slice(5, 7);
  }
  assert.deepEqual(p, [49, 35.2]);
  // relative arcs and implicit repeats parse to the same absolute points
  assert.deepEqual(parsePath("M75.8 34.6a3.9 2.6 0 0 1 -7.8 0V26.4h7.8Z").at(-2), ["L", 75.8, 26.4]);
  assert.deepEqual(parsePath("M1 2q2 3 4 5 1 1 2 2"), [["M", 1, 2], ["Q", 3, 5, 5, 7], ["Q", 6, 8, 7, 9]]);
});

test("every coordinate is finite and the perched figure fills her box", () => {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of KERIM_PARTS) for (const s of p.shapes) for (const c of s.d) for (let i = 1; i < c.length; i++) assert.ok(Number.isFinite(c[i] as number), p.id);
  for (const p of KERIM_PARTS.filter(p => !p.hidden)) for (const s of p.shapes) for (const c of s.d) for (let i = 2; i < c.length; i += 2) { y0 = Math.min(y0, c[i] as number); y1 = Math.max(y1, c[i] as number); }
  assert.ok(y0 > 10 && y0 < 16 && y1 > 88 && y1 <= 93, `${y0}…${y1}`);
  assert.deepEqual(KERIM_PIVOTS.bird, [55, 87]);
  assert.deepEqual(KERIM_FLIGHT.flap, [14, -62]);
});

// ---- her puppet (src/kerim/index.ts, gestures.ts): moods, gestures, size and art switches ----

import { apply, jointOf, renderSvg, restPose, solve, type GestureDef, type GestureRun, type Item, type PoseInput } from "sahne";
import kit, { EMOTIONS } from "../src/index.ts";
import { kerim, puppets, MOODS, EMO, BIRD_GESTURES, RIG } from "../src/kerim/index.ts";

const K = kerim(kit);
const input = (o: Partial<PoseInput> = {}): PoseInput => ({ bones: K.bones, body: K.body, defs: K.gestures, gestures: [], idle: { t: 0, seed: "kerim", amount: 0 }, ...o });
const run = (id: string, t: number, o: Partial<GestureRun> = {}): GestureRun => ({ id, t, side: "l", ...o });
/** The items drawn for these switches, as the stage picks them (a key the pose leaves out takes the item marked default). */
function shown(alt: Record<string, string>): Item[] {
  const dflt: Record<string, string> = {};
  for (const it of K.views.front) if (it.alt?.default) dflt[it.alt.key] = it.alt.value;
  return K.views.front.filter(it => !it.alt || (alt[it.alt.key] ?? dflt[it.alt.key]) === it.alt.value);
}

test("every kit emotion maps to one of her moods", () => {
  assert.deepEqual(Object.keys(EMO).sort(), Object.keys(EMOTIONS).sort());
  for (const [e, m] of Object.entries(EMO)) assert.ok(MOODS[m], `${e} → ${m}`);
  assert.deepEqual(Object.keys(MOODS), ["idle", "happy", "cheer", "sad", "think", "sleepy", "hunch"]);
  assert.equal(puppets.bird, kerim);
  assert.equal(K.kind, "bird");
  assert.equal(K.views.back, K.views.front);
});

test("bird gesture ids are exactly her vocabulary; keys finite; point aims the wing; count beats n times", () => {
  assert.deepEqual(Object.keys(BIRD_GESTURES).sort(), "count flap hop look nod point point_far wave welcome".split(" "));
  assert.equal(K.gestures, BIRD_GESTURES);
  const ANGLES = ["arm", "forearm", "hand", "arm2", "forearm2", "hand2", "spine", "neck", "head", "dy", "headDy"] as const;
  for (const [id, g] of Object.entries(BIRD_GESTURES) as [string, GestureDef][]) {
    assert.ok(g.dur > 0 && g.stroke >= 0 && g.stroke <= g.dur && g.keys[0].t === 0 && g.keys.at(-1)!.t === g.dur, id);
    for (let i = 1; i < g.keys.length; i++) assert.ok(g.keys[i].t > g.keys[i - 1].t, `${id}: key ${i} in order`);
    for (const key of g.keys) {
      for (const c of ANGLES) assert.ok(Number.isFinite(key[c] ?? 0), `${id} ${c}`);
      for (const s of [key.shape, key.shape2]) assert.ok(s == null || s === "spread" || s === "fold", `${id}: shape ${s}`);
      for (const r of [key.reach, key.reach2]) assert.ok(!r || (r.to === "target" && g.needs?.includes("target")), `${id}: a reach goes to the target`);
    }
    assert.ok(ANGLES.every(c => !g.keys.at(-1)![c]), `${id}: ends at rest`);
    if (g.loop) {
      const pose = (t: number) => { const { t: _, ease: __, ...p } = g.keys.find(k => k.t === t)!; return p; };
      assert.deepEqual(pose(g.loop[0]), pose(g.loop[1]), `${id}: the loop's ends are one pose`);
    }
    // every key poses her with finite bones
    for (const key of g.keys) {
      const out = K.pose(input({ gestures: [run(id, key.t, { target: [40, -30] })] }));
      for (const [, m] of solve(K.bones, out.pose)) assert.ok(m.every(Number.isFinite), `${id} at ${key.t}`);
    }
  }
  // point and point_far: the spread wing's tip is aimed at the target, in front or behind, high or low
  const tipLocal: [number, number] = [(RIG.pivots.wingTip[0] - RIG.pivots.wing[0]) * RIG.scale, (RIG.pivots.wingTip[1] - RIG.pivots.wing[1]) * RIG.scale];
  for (const [id, t] of [["point", 800], ["point_far", 1000]] as const) for (const target of [[60, -30], [20, -80], [-50, -10]] as [number, number][]) {
    const out = K.pose(input({ gestures: [run(id, t, { target })] })), w = solve(K.bones, out.pose);
    const P = jointOf(w, "wing"), T = apply(w.get("wing")!, ...tipLocal);
    const d = Math.atan2(T[1] - P[1], T[0] - P[0]) - Math.atan2(target[1] - P[1], target[0] - P[0]);
    assert.ok(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 1e-6, `${id} at ${target}`);
    assert.equal(out.alt.wing, "spread");
    assert.equal(out.alt.wing_far, "on");
  }
  // count: n wingbeats down, the loop range played n times
  const g = BIRD_GESTURES.count, len = g.loop![1] - g.loop![0];
  for (const n of [1, 2, 3, 5]) {
    let beats = 0, prev = 0, falling = false;
    for (let t = 0; t <= g.dur + (n - 1) * len; t += 10) {
      const a = K.pose(input({ gestures: [run("count", t, { n })] })).pose.bones.wing ?? 0;
      if (falling && a > prev && prev < -0.15) beats++;
      falling = a < prev; prev = a;
    }
    assert.equal(beats, n, `count ${n}`);
  }
});

test("the still backend draws her at rest, in every mood and in flight", () => {
  for (const it of K.views.front) {
    assert.ok(it.group && it.group.shapes.length && it.group.shapes.every(s => s.path.finite()), it.bone);
    assert.ok(K.bones.some(b => b.name === it.bone), it.bone);
  }
  // renderSvg's framing asks for a neck bone even for a full figure (render.ts frameBox): she gets one at her head's pivot here
  const fig = { ...K, bones: [...K.bones, { name: "neck", parent: "head", x: 0, y: 0, rot: 0 }] };
  for (const emo of Object.keys(EMO)) for (const air of [false, true]) {
    const out = K.pose(input({ emo, air }));
    const svg = renderSvg(fig, kit, { framing: "full", pose: out.pose, alt: out.alt, size: 160 });
    assert.match(svg, /^<svg[^>]*viewBox="[-\d. ]+"/, `${emo} ${air}`);
    assert.ok(!/NaN|Infinity/.test(svg) && (svg.match(/<path/g) ?? []).length > 20, `${emo} ${air}`);
  }
});

test("feet at the origin, H about 45 cm", () => {
  const w = solve(K.bones, K.pose(input()).pose);
  assert.deepEqual(jointOf(w, "root"), [0, 0]);
  let top = Infinity, low = -Infinity, toes = -Infinity;
  for (const it of shown({})) for (const s of it.group!.shapes) {
    const [x0, y0, x1, y1] = s.path.bounds(), r = (s.stroke?.width ?? 0) / 2, m = w.get(it.bone)!;
    const ys = [apply(m, x0, y0 - r)[1], apply(m, x1, y1 + r)[1]];
    top = Math.min(top, ...ys); low = Math.max(low, ...ys);
    if (it.bone === "legs") toes = Math.max(toes, ...ys);
  }
  assert.ok(Math.abs(toes) < 0.05, `toes at ${toes}`);
  assert.ok(Math.abs(top + 45) < 0.1, `crown at ${top}`);
  // only the tail's tip hangs past her toes (it hangs over the app's ledge)
  assert.ok(low > 0 && low < 1.5, `lowest ${low}`);
  assert.equal(K.body.H, 45);
  assert.deepEqual(solve(K.bones, restPose()).get("root"), w.get("root"));
});

test("the alt switches cover every pose key", () => {
  // every switch birdPose emits, perched and flying, in every mood, with each gesture, has art (or is an absence: legs tucked, the far wing folded away)
  const seen = new Map<string, Set<string>>(), note = (alt: Record<string, string>) => { for (const [k, v] of Object.entries(alt)) { if (!seen.has(k)) seen.set(k, new Set()); seen.get(k)!.add(v); } };
  for (const emo of Object.keys(EMO)) for (const o of [{}, { air: true }, { walk: { phase: 0.3, amount: 1, dir: 1, how: "fly" as const } }]) {
    note(K.pose(input({ emo, ...o })).alt);
    for (const id of Object.keys(BIRD_GESTURES)) note(K.pose(input({ emo, ...o, gestures: [run(id, BIRD_GESTURES[id].stroke, { target: [40, -30], n: 2 })] })).alt);
  }
  // a blink shuts calm or big eyes
  for (let t = 0; t < 20000; t += 50) note(K.pose(input({ idle: { t, seed: "kerim", amount: 1 } })).alt);
  assert.ok(seen.get("eyes")?.has("shut"));
  const EMPTY = new Set(["wing_far=off", "legs=up"]);
  const art = new Set(K.views.front.filter(it => it.alt).map(it => `${it.alt!.key}=${it.alt!.value}`));
  for (const [k, vs] of seen) for (const v of vs) assert.ok(art.has(`${k}=${v}`) || EMPTY.has(`${k}=${v}`), `${k}=${v} has no art`);
  // and no art waits for a switch nothing sets (but the defaults)
  for (const a of art) { const [k, v] = a.split("="); assert.ok(seen.get(k)?.has(v) || K.views.front.some(it => it.alt?.key === k && it.alt.value === v && it.alt.default), `${a} is never shown`); }
  // one default per key, and the defaults are the perched look
  const keys = K.views.front.filter(it => it.alt?.default).map(it => it.alt!.key);
  assert.equal(new Set(keys).size, new Set(K.views.front.filter(it => it.alt?.default).map(it => it.alt!.key + it.alt!.value)).size);
  assert.deepEqual(shown(K.pose(input()).alt), shown({}));
  assert.deepEqual(K.pose(input()).alt, { wing: "fold", wing_far: "off", legs: "down", tail: "rest", eyes: "calm" });
});

test("flying along (pace): wings spread, beats and drift on the place's clock, never far from her mark; idle time alone moves nothing", () => {
  const at = (life: number, idle = 0) => K.pose(input({ air: true, pace: true, life, idle: { t: idle, seed: "kerim", amount: 0 } }));
  assert.equal(at(0).alt.wing, "spread");
  const wing = (life: number) => at(life).pose.bones.wing ?? 0;
  assert.notEqual(wing(0), wing(130), "the wings beat with the place's clock");
  assert.equal(wing(130), K.pose(input({ air: true, pace: true, life: 130, idle: { t: 9999, seed: "kerim", amount: 0 } })).pose.bones.wing ?? 0, "idle time does not move them");
  let dx = 0, dy = 0;
  for (let t = 0; t < 20000; t += 37) { const p = at(t).pose; dx = Math.max(dx, Math.abs(p.dx)); dy = Math.max(dy, Math.abs(p.dy - at(0).pose.dy)); }
  assert.ok(dx > 0.5 && dx <= 6 && dy <= 12, `drifts a little (${dx.toFixed(1)} across, ${dy.toFixed(1)} up)`);
  // a hover with no idle life holds its wings still
  const hover = (t: number) => K.pose(input({ air: true, idle: { t, seed: "kerim", amount: 0 } })).pose.bones.wing ?? 0;
  assert.equal(hover(0), hover(130));
});
