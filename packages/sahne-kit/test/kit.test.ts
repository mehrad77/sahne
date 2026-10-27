// The kit's own check: every part draws for every build and shape, ids are well formed,
// and the slot rules hold when a puppet is composed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compose, groupBounds, luma, rng, type AvatarDoc, type Build, type BodyShape, type Item, type PartCtx, type PartDef } from "sahne";
import kit from "../src/full.ts";
import { moveAt } from "../../sahne/src/anim/move.ts";

const BUILDS: Build[] = ["adult", "elder", "child", "toddler"];
const SHAPES: BodyShape[] = ["slim", "average", "broad", "round"];

const doc = (over: Partial<AvatarDoc> = {}): AvatarDoc => ({
  v: 1, kit: kit.id, body: { build: "adult", height: 0.5, shape: "average" }, skin: "skin_05", face: {},
  hair: { style: "hair_short", color: "hair_02" },
  outfit: { top: { id: "top_tee", colors: ["fab_12"] }, bottom: { id: "bottom_jeans" }, shoes: { id: "shoes_sneakers" } }, ...over,
});

/** The colour ids a part is drawn in: its defaults, and another colour of each colour's palette. */
function colorVariants(part: PartDef): string[][] {
  const n = part.colors ?? 0, base = Array.from({ length: n }, (_, i) => part.defaults?.[i]).filter((c): c is string => !!c);
  const other = Array.from({ length: n }, (_, i) => {
    const ids = Object.keys(kit.palettes[part.palettes?.[i] ?? "fabric"] ?? {});
    return ids.find((c, k) => k >= ids.length / 2 && c !== part.defaults?.[i]) ?? ids[0];
  });
  return n ? [base, other] : [[]];
}

/** Every number a piece holds is finite: group bounds, each shape's path, clip and tile, a strip's widths. */
function finitePiece(it: Item, label: string) {
  if (it.group) {
    for (const n of groupBounds(it.group)) assert.ok(Number.isFinite(n), `${label}: bounds`);
    for (const s of it.group.shapes) {
      assert.ok(s.path.finite() && (!s.clip || s.clip.finite()), `${label}: a shape's path`);
      if (s.tile) assert.ok(s.tile.w > 0.05 && s.tile.h > 0.05 && s.tile.shapes.every(t => t.path.finite()), `${label}: a tile`);
    }
  }
  if (it.strip) assert.ok(it.strip.widths.every(w => Number.isFinite(w) && w > 0) && [it.strip.from ?? 0, it.strip.to ?? 1].every(Number.isFinite), `${label}: a strip`);
}

test("every part draws finite pieces on every build, shape and view: in its default colours and another, with each pattern and on each side", () => {
  for (const [id, part] of Object.entries(kit.parts)) {
    const draws: Partial<PartCtx>[] = colorVariants(part).map(c => ({ colors: c.map(x => kit.color(x)) }));
    for (const pattern of part.patterns ?? []) draws.push({ pattern, inks: [] }, { pattern, inks: [kit.color("fab_14"), kit.color("fab_33")] });
    for (const side of part.sides?.allowed ?? []) draws.push({ side });
    for (const build of BUILDS) for (const shape of SHAPES) {
      const avatar = doc({ body: { build, height: 0.5, shape } }), body = kit.body(avatar.body);
      // colours on every body; prints and sides on the average one of each build
      for (const [k, d] of draws.entries()) {
        if (k >= 2 && shape !== "average") continue;
        const ctx: PartCtx = { avatar, body, skin: "#DCA27A", hair: "#2E2019", colors: (part.defaults ?? []).map(c => kit.color(c)), pattern: null, inks: [], side: part.sides?.default ?? null, garment: { id }, kit, clip: null, clipBack: null, ...d };
        const out = part.draw(ctx), label = `${id} (${build}, ${shape}, ${JSON.stringify(d)})`;
        assert.ok((out.front?.length ?? 0) > 0 && (out.back?.length ?? 0) >= 0, `${label}: draws something in front`);
        for (const v of ["front", "back"] as const) for (const it of out[v] ?? []) {
          assert.ok(kit.layers[v].includes(it.layer), `${id}: unknown layer ${it.layer} in the ${v} view`);
          finitePiece(it, label);
        }
        for (const [key, val] of Object.entries(out.alt ?? {})) assert.ok(["hand_l", "hand_r"].includes(key) && HAND_SHAPES.includes(val), `${id}: closes ${key} as ${val}`);
      }
    }
  }
});

test("part ids follow the slot_name pattern and every colour id resolves", () => {
  for (const id of Object.keys(kit.parts)) assert.match(id, /^[a-z]+_[a-z_]+$/);
  for (const [name, pal] of Object.entries(kit.palettes)) for (const [id, hex] of Object.entries(pal)) {
    assert.match(hex, /^#[0-9A-F]{6}$/i, `${name}.${id}`);
    assert.equal(kit.color(id), hex);
  }
});

test("a headscarf hides the hair, and layers come out in order", () => {
  const p = compose(doc({ wear: { head: { id: "headscarf_wrap" } } }), kit);
  assert.ok(!p.views.front.some(i => i.layer === "hair_front"), "no hair in front");
  assert.ok(p.views.front.some(i => i.layer === "headwear"));
  const order = kit.layers.front, ranks = p.views.front.map(i => order.indexOf(i.layer));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(p.views.front.filter(i => i.face).length, 1);
});

test("an unknown part is not fatal: the slot's default part is drawn (the avatar tests have the rest)", () => {
  const p = compose(doc({ hair: { style: "hair_from_the_future", color: "hair_01" } }), kit);
  assert.ok(p.views.front.length > 5);
  assert.ok(p.views.front.some(i => i.layer === "hair_front"), "the default hair, not none");
  assert.equal(p.avatar.hair.style, kit.defaultDoc.hair.style);
});

// ---- Hands and gestures (B2) ---------------------------------------------------------------------

import { solve, humanoid, apply, type GestureDef, type GestureKey, type PoseState, type Affine } from "sahne";
import { HAND_SHAPES, handShape } from "../src/hands.ts";
import { GESTURES } from "../src/gestures.ts";

const GESTURE_IDS = "point point_far hold_up touch look wave welcome hand_heart nod cik shake_head shrug bow_head me you count beckon stop think explain give take eat drink write read phone type knit sit stand clap hug photo shush shiver cheer knock sleep thumb_up".split(" ");
const REACH_TO = new Set(["target", "mouth", "chin", "nose", "eye", "ear", "forehead", "head_top", "chest", "belly", "hip", "shoulder2", "front"]);
const ANGLES = ["arm", "forearm", "hand", "arm2", "forearm2", "hand2", "thigh", "shin", "foot", "thigh2", "shin2", "foot2", "spine", "neck", "head", "dy", "headDy", "faceX", "faceY"] as const;
const SECOND = ["arm2", "forearm2", "hand2"] as const;

/** The pose channels of a key (no time, easing, look or face), for comparing loop ends. */
const poseOf = (k: GestureKey) => JSON.stringify({ ...k, t: undefined, ease: undefined });
const atRest = (k: GestureKey) =>
  ANGLES.every(c => (k[c] ?? 0) === 0) && (k.thighLen ?? 1) === 1 && (k.thighLen2 ?? 1) === 1 && !k.reach && !k.reach2;

function numbers(v: unknown, path: string, out: [string, number][] = []): [string, number][] {
  if (typeof v === "number") out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => numbers(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [key, x] of Object.entries(v)) numbers(x, `${path}.${key}`, out);
  return out;
}

test("the kit registers the gesture vocabulary of DESIGN.md §5.6 (fly comes with the bird)", () => {
  assert.equal(kit.gestures, GESTURES);
  assert.deepEqual(Object.keys(GESTURES).sort(), [...GESTURE_IDS].sort());
});

test("every gesture is well formed", () => {
  for (const [id, g] of Object.entries(GESTURES) as [string, GestureDef][]) {
    assert.ok(g.keys.length >= 2, `${id}: at least two keys`);
    assert.ok(g.dur > 0 && g.stroke >= 0 && g.stroke <= g.dur, `${id}: stroke inside [0, dur]`);
    assert.equal(g.keys[0].t, 0, `${id}: starts at 0`);
    assert.equal(g.keys[g.keys.length - 1].t, g.dur, `${id}: the last key is at dur`);
    for (let i = 1; i < g.keys.length; i++) assert.ok(g.keys[i].t > g.keys[i - 1].t, `${id}: keys sorted by t (key ${i})`);
    for (const [p, n] of numbers(g, id)) assert.ok(Number.isFinite(n), `${p} is ${n}`);
    if (g.loop) {
      const [a, b] = g.loop;
      assert.ok(a >= 0 && a < b && b <= g.dur, `${id}: loop inside [0, dur]`);
      const ka = g.keys.find(k => k.t === a), kb = g.keys.find(k => k.t === b);
      assert.ok(ka && kb, `${id}: the loop starts and ends on keys`);
      assert.equal(poseOf(ka!), poseOf(kb!), `${id}: the loop's ends are the same pose, so it repeats seamlessly`);
    } else {
      assert.ok(atRest(g.keys[g.keys.length - 1]), `${id}: ends at rest`);
    }
    const uses = new Set<string>();
    for (const k of g.keys) {
      for (const s of [k.shape, k.shape2]) if (s != null) assert.ok(s === "count" || HAND_SHAPES.includes(s), `${id}: unknown hand shape ${s}`);
      for (const r of [k.reach, k.reach2]) if (r) {
        assert.ok(REACH_TO.has(r.to), `${id}: unknown reach target ${r.to}`);
        assert.ok(r.aim == null || r.aim === "pos" || r.aim === "dir", `${id}: aim`);
        assert.ok(r.ext == null || (r.ext > 0 && r.ext <= 1), `${id}: ext in (0, 1]`);
        assert.ok(r.w == null || (r.w >= 0 && r.w <= 1), `${id}: w in [0, 1]`);
        uses.add(r.to);
      }
      if (k.look === "target") uses.add("target");
      if (k.thighLen != null) assert.ok(k.thighLen > 0 && k.thighLen <= 1, `${id}: thighLen in (0, 1]`);
      if (SECOND.some(c => (k[c] ?? 0) !== 0) || k.reach2 || (k.shape2 && k.shape2 !== "relaxed")) assert.equal(g.hands, 2, `${id}: moves the other hand, so hands: 2`);
    }
    if (uses.has("target")) assert.ok(g.needs?.includes("target"), `${id}: aims at the target, so needs it`);
    if (g.hold) assert.ok(g.needs?.includes("target"), `${id}: a hand-over needs a target`);
  }
  assert.equal(GESTURES.give.hold, "give");
  assert.equal(GESTURES.take.hold, "take");
});

// The sign conventions of core/kit.ts, without IK: limb angles swing outwards and up on their own
// side, the trunk leans towards the acting side. Enough to check the shapes of a few key poses.
function pose(k: GestureKey, side: "l" | "r"): PoseState {
  const other = side === "l" ? "r" : "l", sg = side === "l" ? 1 : -1;
  const limb = (bone: string, own: "l" | "r", v = 0): [string, number] => [`${bone}_${own}`, -(own === "l" ? 1 : -1) * v];
  return {
    bones: Object.fromEntries([
      limb("arm", side, k.arm), limb("forearm", side, k.forearm), limb("hand", side, k.hand),
      limb("arm", other, k.arm2), limb("forearm", other, k.forearm2), limb("hand", other, k.hand2),
      limb("thigh", side, k.thigh), limb("shin", side, k.shin), limb("foot", side, k.foot),
      limb("thigh", other, k.thigh2), limb("shin", other, k.shin2), limb("foot", other, k.foot2),
      ["spine", sg * (k.spine ?? 0)], ["neck", sg * (k.neck ?? 0)], ["head", sg * (k.head ?? 0)],
    ]),
    dx: 0, dy: k.dy ?? 0,
    len: { [`thigh_${side}`]: k.thighLen ?? 1, [`thigh_${other}`]: k.thighLen2 ?? 1 },
    off: { head: [0, k.headDy ?? 0] },
  };
}

test("key poses have the intended shapes, on either side", () => {
  const b = kit.body({ build: "adult", height: 0.5, shape: "average" }), bones = humanoid(b);
  const at = (id: string, t: number) => GESTURES[id].keys.find(k => k.t === t)!;
  for (const side of ["l", "r"] as const) {
    const o = side === "l" ? "r" : "l", out = side === "l" ? 1 : -1;
    const W = (k: GestureKey) => solve(bones, pose(k, side));
    const p = (w: Map<string, Affine>, bone: string, x = 0, y = 0) => apply(w.get(bone)!, x, y);
    const tip = (w: Map<string, Affine>, s: string) => p(w, `hand_${s}`, 0, b.handL);

    // wave: the hand is up beside the head, fingers above the wrist, out on the acting side
    let w = W(at("wave", GESTURES.wave.stroke));
    assert.ok(p(w, `hand_${side}`)[1] < p(w, `arm_${side}`)[1] - 10, `${side}: wave's wrist is above the shoulder`);
    assert.ok(tip(w, side)[1] < p(w, `hand_${side}`)[1], `${side}: wave's fingers point up`);
    assert.ok(p(w, `hand_${side}`)[0] * out > b.shoulderW / 2, `${side}: wave's hand is out on its side`);
    // cheer: both fists above the head's chin
    w = W(at("cheer", GESTURES.cheer.stroke));
    for (const s of [side, o]) assert.ok(tip(w, s)[1] < p(w, "head")[1], `${side}: cheer's ${s} hand is up`);
    // count: the counting fingers stand above the shoulder, clear of the head
    w = W(at("count", GESTURES.count.stroke));
    assert.ok(tip(w, side)[1] < p(w, `arm_${side}`)[1], `${side}: count's fingers are above the shoulder`);
    assert.ok(Math.abs(p(w, `hand_${side}`)[0]) > b.headW / 2, `${side}: count's hand is clear of the head`);
    // welcome and shrug: both hands out beside the body, palms up (forearms about level for the shrug)
    for (const id of ["welcome", "shrug"]) {
      w = W(at(id, GESTURES[id].stroke));
      for (const s of [side, o]) assert.ok(Math.abs(p(w, `hand_${s}`)[0]) > b.shoulderW / 2 + 5, `${side}: ${id}'s ${s} hand is out`);
    }
    w = W(at("shrug", GESTURES.shrug.stroke));
    assert.ok(Math.abs(p(w, `hand_${side}`)[1] - p(w, `forearm_${side}`)[1]) < 8, `${side}: shrug's forearm is about level`);
    // beckon: palm down, the fingers scoop below the wrist at the stroke and are level before it
    w = W(at("beckon", GESTURES.beckon.stroke));
    assert.ok(tip(w, side)[1] - p(w, `hand_${side}`)[1] > b.handL * 0.6, `${side}: beckon scoops down`);
    w = W(at("beckon", 450));
    assert.ok(Math.abs(tip(w, side)[1] - p(w, `hand_${side}`)[1]) < b.handL * 0.35, `${side}: beckon's hand starts level`);
    // nod goes down, the cık goes up
    assert.ok((at("nod", GESTURES.nod.stroke).headDy ?? 0) > 0 && (at("cik", GESTURES.cik.stroke).headDy ?? 0) < 0);
    assert.ok((at("cik", GESTURES.cik.stroke).face?.brows?.l?.[0] ?? 0) > 0.5, "the cık raises the brows");
  }

  // sitting keeps the feet on the floor and brings the hips down; stand starts from sit's pose
  const seated = GESTURES.sit.keys[GESTURES.sit.keys.length - 1];
  const w0 = solve(bones, pose({ t: 0 }, "l")), ws = solve(bones, pose(seated, "l"));
  for (const s of ["l", "r"]) assert.ok(Math.abs(apply(ws.get(`foot_${s}`)!, 0, 0)[1] - apply(w0.get(`foot_${s}`)!, 0, 0)[1]) < 3, `sit: the ${s} foot stays on the floor`);
  assert.ok(apply(ws.get("hips")!, 0, 0)[1] - apply(w0.get("hips")!, 0, 0)[1] > 15, "sit: the hips come down");
  assert.equal(poseOf(GESTURES.stand.keys[0]), poseOf(seated), "stand starts where sit ends");
});

test("every hand shape draws for every build, side and view", () => {
  for (const build of ["adult", "elder", "child", "toddler"] as Build[]) {
    const b = kit.body({ build, height: 0.5, shape: "average" }), w = b.armW[2] * 1.12;
    for (const shape of HAND_SHAPES) for (const side of [1, -1] as const) for (const back of [false, true]) {
      const g = handShape(b, "#DCA27A", side, shape, back);
      const [x0, y0, x1, y1] = groupBounds(g);
      for (const n of [x0, y0, x1, y1]) assert.ok(Number.isFinite(n), `${shape} (${build}): finite bounds`);
      assert.ok(x1 - x0 > w * 0.8 && y1 - y0 > b.handL * 0.5, `${shape} (${build}): not empty`);
      assert.ok(x1 - x0 < w * 2.6 && y0 > -4 && y1 < b.handL * 1.3 + 2, `${shape} (${build}): stays a hand's size from the wrist`);
    }
  }
});

test("a composed puppet has every hand shape as an alternative, one default per hand and view", () => {
  for (const build of BUILDS) {
    const p = compose(doc({ body: { build, height: 0.5, shape: "round" } }), kit);
    for (const v of ["front", "back"] as const) for (const key of ["hand_l", "hand_r"]) {
      const alts = p.views[v].filter(i => i.alt?.key === key);
      assert.deepEqual(alts.map(i => i.alt!.value).sort(), [...HAND_SHAPES].sort(), `${build} ${v} ${key}: every shape once`);
      assert.equal(alts.filter(i => i.alt!.default).length, 1, `${build} ${v} ${key}: one default`);
      assert.equal(alts.find(i => i.alt!.default)!.alt!.value, "relaxed");
      assert.ok(alts.every(i => i.layer === "hand" && i.bone === key && i.group));
    }
  }
});

test("sign_board and phone put their text inside their art, lying and held", () => {
  const draw = (id: string, p: Record<string, unknown>) => kit.props[id].draw(p, rng(id), kit).flats;
  const inside = (a: number[], b: number[]) => a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
  for (const [id, p] of [["sign_board", { label: "Hoş geldin, Ali!" }], ["phone", { screen: "Neredesin?" }], ["phone", { screen: { title: "Farzad", lines: ["Geldim!"] } }]] as const) for (const held of [false, true]) {
    const [f] = draw(id, { ...p, held }), t = f.text?.[0], label = `${id} ${held ? "held" : "lying"}`;
    assert.ok(t && t.text && f.text!.length === 1, `${label}: one text`);
    const box = [t.x, t.y, t.x + t.w, t.y + t.h];
    assert.ok(inside(box, groupBounds(f.group)), `${label}: inside the flat`);
    // and on one light surface (the card, the screen), never across the board's edge or the case
    assert.ok(f.group.shapes.some(s => !s.flat && s.fill && luma(s.fill) > 0.6 && inside(box, s.path.bounds())), `${label}: on the card or the screen`);
  }
  // held, the hand grips the sign's stick just under the board: it shows at the chest, not before the face; standing, it is on its stick
  const sb = (held: boolean) => groupBounds(draw("sign_board", { label: "x", held })[0].group);
  assert.ok(sb(true)[1] > -45 && sb(true)[3] > 8, "held: the board within 45 cm above the hand, the stick below the fist");
  assert.ok(sb(false)[1] < -65 && Math.abs(sb(false)[3]) < 1, "standing: the board on top of its stick, the foot at the origin");
  assert.equal(draw("phone", { screen: { title: "Farzad", lines: ["Geldim!", "Neredesin?"] } })[0].text![0].text, "Farzad\nGeldim!\nNeredesin?");
  assert.equal(draw("phone", { screen: "Neredesin?" })[0].text![0].font, "screen");
  assert.equal(draw("phone", { screen: "Neredesin?" })[0].text![0].lit, 0);
  for (const [id, p] of [["sign_board", {}], ["sign_board", { label: "" }], ["phone", {}], ["phone", { screen: "" }], ["phone", { screen: { lines: [] } }]] as const)
    assert.equal(draw(id, p)[0].text, undefined, `${id} ${JSON.stringify(p)}: no text`);
});

test("phone and phone_held share one drawing: the case, screen, status bar, bubbles and glare", () => {
  const body = kit.body({ build: "adult", height: 0.5, shape: "average" });
  const ctx = { avatar: doc(), body, skin: "#DCA27A", hair: "#2E2019", colors: [kit.color("fab_22")], pattern: null, inks: [], side: null, garment: { id: "phone_held" }, kit, clip: null, clipBack: null } as PartCtx;
  const held = kit.parts.phone_held.draw(ctx).front![0].group!.shapes, prop = kit.props.phone.draw({}, rng("phone"), kit).flats[0].group.shapes;
  const look = (ss: typeof held) => ss.map(s => [s.fill, !!s.flat, s.opacity ?? 1]);
  assert.deepEqual(look(prop), look(held));
  // with words on the screen the prop drops the painted bubbles, and keeps the rest
  const said = kit.props.phone.draw({ screen: "Neredesin?" }, rng("phone"), kit).flats[0].group.shapes;
  assert.deepEqual(look(said), [...look(held).slice(0, 3), look(held).at(-1)]);
});

// ---- every set piece and prop ------------------------------------------------
// Each generator of kit.set and kit.props, with its defaults and three seeds (props also counted and
// held): it draws finite flats that fit an atlas layer, its lights sit at finite places with a
// radius, its motions loop sanely and rest where they start, its words lie inside its art, and a flat
// that travels keeps its depth (the stage sorts flats by where they start).
{
  const SEEDS = ["a", "b", "c"];
  const finiteBox = (b: number[]) => b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];
  const cases = [
    ...Object.keys(kit.set).flatMap(id => SEEDS.map(s => ({ id, kind: "set", seed: s, p: {} as Record<string, unknown>, def: kit.set[id] }))),
    ...Object.keys(kit.props).flatMap(id => [{}, { n: 3 }, { held: true }].flatMap(p => SEEDS.map(s => ({ id, kind: "prop", seed: s, p: p as Record<string, unknown>, def: kit.props[id] })))),
  ];
  const drawn = cases.map(c => ({ ...c, out: c.def.draw(c.p, rng(`${c.id}/${c.seed}`), kit) }));

  test("every set piece and prop draws finite flats that fit the atlas", () => {
    for (const { id, kind, out, p } of drawn) {
      const tag = `${kind} ${id} ${JSON.stringify(p)}`;
      assert.ok(out.flats.length > 0, `${tag}: no flats`);
      for (const f of out.flats) {
        assert.ok(finiteBox(groupBounds(f.group)) || f.emissive, `${tag}: a flat with no finite art`);
        if (f.emissive) assert.ok(groupBounds(f.emissive).every(Number.isFinite), `${tag}: emissive art`);
        for (const k of ["x", "y", "z", "ppcm", "lit", "yaw", "pitch"] as const) if (f[k] !== undefined) assert.ok(Number.isFinite(f[k]), `${tag}.${k}`);
        // small things raster finely (a phone at 12 px/cm, for its screen); nothing outgrows an atlas layer (2048 px)
        const ppcm = f.ppcm ?? 1.6;
        assert.ok(ppcm > 0 && ppcm <= 16, `${tag}: ppcm ${ppcm}`);
        // the glow is rasterised at its own ppcm (glowPpcm, at most the art's), else the flat's
        if (f.glowPpcm !== undefined) assert.ok(f.glowPpcm > 0 && f.glowPpcm <= ppcm, `${tag}: glowPpcm ${f.glowPpcm}`);
        for (const [g, k] of [[f.group, ppcm], [f.emissive, f.glowPpcm ?? ppcm]] as const) {
          if (!g?.shapes.length) continue;
          const [x0, y0, x1, y1] = groupBounds(g);
          assert.ok((x1 - x0) * k <= 2040 && (y1 - y0) * k <= 2040, `${tag}: ${Math.round((x1 - x0) * k)} × ${Math.round((y1 - y0) * k)} px, more than an atlas layer`);
        }
      }
      for (const l of out.lights ?? []) assert.ok([l.x, l.y, l.z, l.radius, l.intensity ?? 1].every(Number.isFinite) && l.radius > 0, `${tag}: a light`);
    }
  });

  test("every moving flat loops sanely and rests where it starts", () => {
    for (const { id, kind, out } of drawn) for (const f of out.flats) {
      const m = f.move, tag = `${kind} ${id}`;
      if (!m) continue;
      if (m.phase !== undefined) assert.ok(m.phase >= 0 && m.phase < 1, `${tag}: phase ${m.phase}`);
      if (m.path) {
        assert.ok(m.path.pts.length >= 2 && m.path.pts.every(q => q.length === 3 && q.every(Number.isFinite)) && m.path.ms >= 500, `${tag}: path`);
        // a path shown only in parts of its period (a passenger between stops) may be hidden at rest
        const r0 = moveAt(m, 0);
        if (!m.phase && (r0 || !m.path.show)) assert.deepEqual(r0!.at, m.path.pts[0].map(v => v / 100), `${tag}: rests at its first point`);
      }
      if (m.blink) assert.ok(m.blink.ms >= 334 && m.blink.on > 0 && m.blink.on < 1, `${tag}: blink at most three times a second`);
      // a big flat sways gently; a small creature may swish its tail or peck (at most 0.3 rad under 60 cm)
      const [bx0, by0, bx1, by1] = groupBounds(f.group), small = Math.max(bx1 - bx0, by1 - by0) <= 60;
      if (m.sway) assert.ok(Math.abs(m.sway.rot ?? 0) <= (small ? 0.3 : 0.1) && Math.abs(m.sway.dy ?? 0) <= 5 && m.sway.ms >= 300, `${tag}: gentle sway`);
      if (m.scroll) assert.ok(Number.isFinite(m.scroll.dx) && m.scroll.ms > 0, `${tag}: scroll`);
      for (const t of [0, 1234, 9876, 123456]) { const at = moveAt(m, t); if (at) assert.ok([...at.at, at.dx, at.dy, at.rot].every(Number.isFinite), `${tag} at ${t}`); }
    }
  });

  test("every word on a set piece or prop lies inside its art, in Turkish", () => {
    for (const { id, kind, out, p } of drawn) {
      // a blinking cell carries only a speck of art: its words lie inside its board's (the still flat with words)
      const board = out.flats.find(g => g.text?.length && !g.move);
      for (const f of out.flats) for (const t of f.text ?? []) {
        const b = groupBounds(f.move?.blink && board ? board.group : f.group);
        assert.ok(t.x >= b[0] - 0.5 && t.y >= b[1] - 0.5 && t.x + t.w <= b[2] + 0.5 && t.y + t.h <= b[3] + 0.5, `${kind} ${id} ${JSON.stringify(p)}: "${t.text}" outside its art`);
        assert.ok(t.text.trim().length > 0 && (t.lang ?? "tr") === "tr", `${kind} ${id}: text`);
      }
    }
  });
}

test("a prop keeps its steam and flames in a hand: a hot tea glass, a bunch of candles, a cake carried in lit", () => {
  const em = (id: string, p: Record<string, unknown>) => kit.props[id].draw(p, rng(id), kit).emitters ?? [];
  assert.deepEqual(em("tea", { kind: "glass", hot: true, held: true }).map(e => e.kind), ["steam"]);
  assert.equal(em("candle", { n: 3, held: true }).filter(e => e.kind === "flame").length, 3);
  assert.equal(em("candle", { n: 3, held: true, out: 1 }).filter(e => e.kind === "flame").length, 2);
  const cake = em("cake", { candles: 5, held: true }), flat = em("cake", { candles: 5 });
  assert.equal(cake.length, 5);
  // held, the cake sits on the hand: its flames move with it
  assert.notDeepEqual(cake.map(e => [e.x, e.y]), flat.map(e => [e.x, e.y]));
});
