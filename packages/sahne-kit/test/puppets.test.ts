// The animal puppets (src/puppets/): Pisi on the cat rig and a gull on the bird rig build, pose every posture, gait and
// gesture with finite bones, have art for every switch their pose sets, stand on the floor, and fit their budget.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { apply, jointOf, renderSvg, solve, type GestureRun, type Item, type KitPuppet, type PoseInput } from "sahne";
import kit, { EMOTIONS } from "../src/index.ts";
import { puppets, cat, gull, CAT_EMO, CAT_MOODS, CAT_RIG, CAT_GESTURES, GULL_EMO, GULL_MOODS, GULL_GESTURES } from "../src/puppets/index.ts";

const C = cat(kit), G = gull(kit);
const input = (K: KitPuppet, o: Partial<PoseInput> = {}): PoseInput => ({ bones: K.bones, body: K.body, defs: K.gestures, gestures: [], idle: { t: 0, seed: "pisi", amount: 0 }, ...o });
const run = (id: string, t: number, o: Partial<GestureRun> = {}): GestureRun => ({ id, t, side: "l", ...o });
const finite = (K: KitPuppet, o: Partial<PoseInput>, what: string) => {
  const out = K.pose(input(K, o));
  for (const [, m] of solve(K.bones, out.pose)) assert.ok(m.every(Number.isFinite), what);
  return out;
};
/** The items drawn for these switches, as the stage picks them. */
function shown(K: KitPuppet, alt: Record<string, string>): Item[] {
  const dflt: Record<string, string> = {};
  for (const it of K.views.front) if (it.alt?.default) dflt[it.alt.key] = it.alt.value;
  return K.views.front.filter(it => !it.alt || (alt[it.alt.key] ?? dflt[it.alt.key]) === it.alt.value);
}
/** The lowest and highest point drawn (cm, y down). */
function extent(K: KitPuppet, o: Partial<PoseInput> = {}) {
  const out = K.pose(input(K, o)), w = solve(K.bones, out.pose);
  let top = Infinity, low = -Infinity;
  for (const it of shown(K, out.alt)) for (const s of it.group!.shapes) {
    const [x0, y0, x1, y1] = s.path.bounds(), m = w.get(it.bone)!;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { const p = apply(m, x, y); top = Math.min(top, p[1]); low = Math.max(low, p[1]); }
  }
  return { top, low };
}

test("the puppets: a cat and a gull, side-on kinds the director knows", () => {
  assert.deepEqual(Object.keys(puppets).sort(), ["cat", "gull"]);
  assert.equal(C.kind, "cat");
  assert.equal(G.kind, "bird");
  for (const K of [C, G]) {
    assert.equal(K.views.back, K.views.front);
    for (const it of K.views.front) {
      assert.ok(it.group && it.group.shapes.length && it.group.shapes.every(s => s.path.finite()), it.bone);
      assert.ok(K.bones.some(b => b.name === it.bone), it.bone);
    }
  }
});

test("every kit emotion is one of their moods; every mood's posture exists", () => {
  for (const [emo, moods] of [[CAT_EMO, CAT_MOODS], [GULL_EMO, GULL_MOODS]] as const) {
    assert.deepEqual(Object.keys(emo).sort(), Object.keys(EMOTIONS).sort());
    for (const [e, m] of Object.entries(emo)) assert.ok((moods as Record<string, unknown>)[m], `${e} → ${m}`);
  }
  for (const [m, d] of Object.entries(CAT_MOODS)) assert.ok(CAT_RIG.postures[d.posture], m);
});

test("the cat poses every posture, a walk, a run and every gesture with finite numbers", () => {
  const alts = new Map<string, Set<string>>(), note = (a: Record<string, string>) => { for (const [k, v] of Object.entries(a)) { if (!alts.has(k)) alts.set(k, new Set()); alts.get(k)!.add(v); } };
  for (const emo of Object.keys(CAT_EMO)) for (const t of [0, 1300, 5200]) note(finite(C, { emo, idle: { t, seed: "pisi", amount: 1 } }, `${emo} at ${t}`).alt);
  for (const how of ["walk", "run", "hop"] as const) for (let ph = 0; ph < 4; ph += 0.125) for (const amount of [0.2, 1]) note(finite(C, { walk: { phase: ph, amount, dir: 1, how } }, `${how} ${ph}`).alt);
  for (const [id, g] of Object.entries(CAT_GESTURES)) for (const emo of ["neutral", "tired", "surprised"]) for (const key of g.keys) note(finite(C, { emo, gestures: [run(id, key.t, { target: [30, -60] })] }, `${id} at ${key.t}`).alt);
  for (let t = 0; t < 20000; t += 50) note(C.pose(input(C, { idle: { t, seed: "pisi", amount: 1 } })).alt);
  // walking it stands with its legs; at rest each mood takes its posture
  assert.equal(C.pose(input(C, { walk: { phase: 0.3, amount: 1, dir: 1 } })).alt.body, "stand");
  assert.deepEqual(["neutral", "happy", "tired", "surprised"].map(emo => C.pose(input(C, { emo })).alt.body), ["sit", "loaf", "sleep", "stand"]);
  assert.equal(C.pose(input(C, { emo: "tired" })).alt.eyes, "shut");
  assert.equal(C.pose(input(C, { gestures: [run("meow", 500)] })).alt.mouth, "open");
  assert.equal(C.pose(input(C, { gestures: [run("eat", 800)] })).alt.body, "stand", "it gets up to eat");
  assert.ok(alts.get("eyes")!.has("shut") && alts.get("eyes")!.has("open"), "it blinks");
  // every switch has art, but the absences (no legs while sitting, the mouth shut)
  const EMPTY = new Set(["legs=off", "mouth=shut"]), art = new Set(C.views.front.filter(it => it.alt).map(it => `${it.alt!.key}=${it.alt!.value}`));
  for (const [k, vs] of alts) for (const v of vs) assert.ok(art.has(`${k}=${v}`) || EMPTY.has(`${k}=${v}`), `${k}=${v} has no art`);
  for (const a of art) { const [k, v] = a.split("="); assert.ok(alts.get(k)?.has(v), `${a} is never shown`); }
});

test("a walk is a stride: the legs swing in a four-beat gait, a cycle every two steps", () => {
  const legs = (phase: number) => C.pose(input(C, { walk: { phase, amount: 1, dir: 1 } })).pose.bones;
  for (const l of ["leg_nb", "leg_nf", "leg_fb", "leg_ff"]) {
    assert.ok(Math.abs((legs(0.4)[l] ?? 0) - (legs(2.4)[l] ?? 0)) < 1e-9, `${l} repeats over two steps`);
    assert.ok(Math.abs((legs(0.4)[l] ?? 0) - (legs(1.4)[l] ?? 0)) > 0.1, `${l} is elsewhere a step later`);
  }
  // the near hind and far hind are half a cycle apart
  assert.ok(Math.abs((legs(0.3).leg_nb ?? 0) + (legs(0.3).leg_fb ?? 0)) < 1e-9);
  const held = C.pose({ ...input(C, { walk: { phase: 0.7, amount: 1, dir: 1 } }) }).pose.bones, still = cat(kit, "still").pose(input(C, { walk: { phase: 0.7, amount: 1, dir: 1 } })).pose.bones;
  assert.notDeepEqual(held, still, "reduced motion holds the stride");
});

test("a look turns the head to the target, up or down, never past its reach", () => {
  const head = (target: [number, number]) => C.pose(input(C, { emo: "surprised", gestures: [run("look", 700, { target })] })).pose.bones.head ?? 0;
  const rest = C.pose(input(C, { emo: "surprised" })).pose.bones.head ?? 0;
  assert.ok(head([40, -90]) < rest - 0.2, "up");
  assert.ok(head([40, 0]) > rest + 0.1, "down");
  assert.ok(head([40, -2000]) >= -0.75 - 1e-9, "within its reach");
  // pointing at a target ahead of it
  const out = C.pose(input(C, { emo: "surprised", gestures: [run("look", 700, { target: [60, -40] })] })), w = solve(C.bones, out.pose);
  const P = jointOf(w, "head"), T = apply(w.get("head")!, 1, 0);
  const d = Math.atan2(-40 - P[1], 60 - P[0]) - Math.atan2(T[1] - P[1], T[0] - P[0]);
  assert.ok(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 1e-6);
});

test("both stand on the floor; the cat is about 37 cm to its ears sitting, the gull 40 to its crown", () => {
  const c = extent(C, { emo: "surprised" }), s = extent(C), g = extent(G);
  assert.ok(Math.abs(c.low) < 1 && Math.abs(s.low) < 1 && Math.abs(g.low) < 1, `${c.low} ${s.low} ${g.low}`);
  // sitting, its ears are its top; standing, its tail is up past them
  assert.ok(s.top < -34 && s.top > -40, `cat ${s.top}`);
  assert.ok(Math.abs(C.body.H + s.top) < 1.5, `${C.body.H}`);
  assert.ok(c.top < s.top, "the tail up");
  assert.ok(Math.abs(g.top + 40) < 1 && G.body.H === 40, `gull ${g.top}`);
  for (const K of [C, G]) assert.deepEqual(jointOf(solve(K.bones, K.pose(input(K)).pose), "root"), [0, 0]);
});

test("the gull: perched, flying and in every mood and gesture, every switch has art", () => {
  const seen = new Map<string, Set<string>>(), note = (a: Record<string, string>) => { for (const [k, v] of Object.entries(a)) { if (!seen.has(k)) seen.set(k, new Set()); seen.get(k)!.add(v); } };
  for (const emo of Object.keys(GULL_EMO)) for (const o of [{}, { air: true }, { walk: { phase: 0.3, amount: 1, dir: 1, how: "fly" as const } }]) {
    note(finite(G, { emo, ...o }, emo).alt);
    for (const [id, g] of Object.entries(GULL_GESTURES)) for (const key of g.keys) note(finite(G, { emo, ...o, gestures: [run(id, key.t, { target: [40, -30], n: 2 })] }, `${id} ${key.t}`).alt);
  }
  for (let t = 0; t < 20000; t += 50) note(G.pose(input(G, { idle: { t, seed: "gull", amount: 1 } })).alt);
  const EMPTY = new Set(["wing_far=off", "legs=up"]), art = new Set(G.views.front.filter(it => it.alt).map(it => `${it.alt!.key}=${it.alt!.value}`));
  for (const [k, vs] of seen) for (const v of vs) assert.ok(art.has(`${k}=${v}`) || EMPTY.has(`${k}=${v}`), `${k}=${v} has no art`);
  for (const a of art) { const [k, v] = a.split("="); assert.ok(seen.get(k)?.has(v), `${a} is never shown`); }
  assert.deepEqual(Object.keys(GULL_GESTURES).sort(), ["flap", "look"]);
});

test("the still backend draws them in every mood", () => {
  for (const [K, emo] of [[C, CAT_EMO], [G, GULL_EMO]] as const) {
    const fig = { ...K, bones: [...K.bones, { name: "neck", parent: "head", x: 0, y: 0, rot: 0 }] };
    for (const e of Object.keys(emo)) {
      const out = K.pose(input(K, { emo: e }));
      const svg = renderSvg(fig, kit, { framing: "full", pose: out.pose, alt: out.alt, size: 120 });
      assert.ok(!/NaN|Infinity/.test(svg) && (svg.match(/<path/g) ?? []).length > 8, `${K.kind} ${e}`);
    }
  }
});

test("the bundle is within its 8 KB (DESIGN.md §12), without the engine", async () => {
  // esbuild is the gallery's (size.mjs measures the same way)
  const { build } = createRequire(new URL("../../sahne-gallery/package.json", import.meta.url))("esbuild") as typeof import("esbuild");
  const r = await build({ entryPoints: [new URL("../src/puppets/index.ts", import.meta.url).pathname], bundle: true, minify: true, format: "esm", write: false, external: ["sahne"], logLevel: "error" });
  const gz = gzipSync(r.outputFiles[0].contents, { level: 9 }).length;
  assert.ok(gz <= 8 * 1024, `${(gz / 1024).toFixed(1)} KB`);
});
