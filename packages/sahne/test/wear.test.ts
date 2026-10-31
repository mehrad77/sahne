// The B4 additions to the avatar model and the art, on a small fake kit: the slots for hats,
// hairwear, hearing aids, hands and held things; parts made for some builds; one-sided parts;
// prints with their inks and locks; clips per view; parts that close a hand; identity marks that
// do not count; repeating prints (`Shape.tile`) on a canvas and in SVG; the still back view.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rect } from "../src/art/path.ts";
import { drawGroup, groupSvg, tileOffsets, type Group, type Tile } from "../src/art/shape.ts";
import type { Item, Kit, PartCtx, PartDef } from "../src/core/kit.ts";
import type { AvatarDoc, AvatarNote, BodyDims } from "../src/core/types.ts";
import { normalize, serialize, manifestOf, AVATAR_MAX_BYTES } from "../src/avatar/normalize.ts";
import { compose } from "../src/avatar/compose.ts";
import { createBuilder } from "../src/avatar/builder.ts";
import { GARMENT_FIELDS } from "../src/avatar/rules.ts";
import { renderSvg } from "../src/render/still/render.ts";
import { humanoid } from "../src/rig/skeleton.ts";

const DIMS: BodyDims = {
  build: "adult", H: 172, headW: 44, headH: 50, neckL: 5, neckW: 11, torsoL: 43, shoulderW: 42, chestW: 38, waistW: 32, hipW: 35,
  upperArmL: 29, foreArmL: 25, handL: 13, armW: [10.8, 9, 7.2], thighL: 36.57, shinL: 32.43, footH: 5, footW: 10.5, legW: [15, 12, 10], legLen: 74,
};
const PAL = { skin: { s1: "#F7DCC9" }, hair: { h1: "#1C1614", h2: "#EDE5CB" }, fabric: { f1: "#F7F3EA", f2: "#4F6E9E", f3: "#C4553A" }, metal: { m1: "#C3C8CE" }, eyes: { e1: "#4A2E1E" } };
const seen: Record<string, PartCtx> = {};
const piece = (layer: string, bone: string, fill = "#888888"): Item => ({ layer, bone, group: { shapes: [{ path: rect(0, 0, 2, 2), fill }] } });
const part = (id: string, slot: string, o: Partial<PartDef> = {}, layer = slot, bone = "head"): PartDef => ({
  slot, ...o, draw: ctx => { seen[id] = ctx; return { front: [piece(layer, bone)], back: [piece(layer, bone)] }; },
});
const HANDS: Item[] = ["relaxed", "hold"].flatMap(v => (["l", "r"] as const).map(s => ({ ...piece("hand", `hand_${s}`), alt: { key: `hand_${s}`, value: v, default: v === "relaxed" } })));
const choice = (values: string[], def: string | null = values[0], extra: object = {}) => ({ values, default: def, ...extra });

function makeKit(): Kit {
  const parts: Record<string, PartDef> = {
    hair_a: part("hair_a", "hair"), top_a: part("top_a", "top", { colors: 1, defaults: ["f1"], patterns: ["pat_a", "pat_b"] }, "top", "spine"),
    bottom_a: part("bottom_a", "bottom", { colors: 1, defaults: ["f2"] }), shoes_a: part("shoes_a", "shoes", { colors: 1, defaults: ["f1"] }),
    scarf_a: part("scarf_a", "head", { colors: 1, defaults: ["f2"], hides: ["hair"] }, "headwear"),
    hat_a: part("hat_a", "hat", { colors: 1, defaults: ["f3"], clips: { slots: ["hair"], keep: (ctx, view) => rect(-30, -ctx.body.headH * (view === "back" ? 0.5 : 0.7), 60, 80) } }, "headwear"),
    band_a: part("band_a", "hairwear", {}, "hair"),
    kip_a: part("kip_a", "head", { clips: { slots: ["hair"], keep: ctx => rect(-30, -ctx.body.headH * 0.95, 60, 90) } }, "headwear"),
    aid_a: part("aid_a", "aid", { colors: 1, palettes: ["metal"], defaults: ["m1"], sides: { allowed: ["l", "r", "b"], default: "l" } }, "headwear"),
    ring_a: part("ring_a", "hands", { colors: 1, palettes: ["metal"], defaults: ["m1"], builds: ["adult", "elder"], sides: { allowed: ["l", "r"], default: "r" } }, "hand", "hand_r"),
    bow_a: part("bow_a", "hairwear", { builds: ["child", "toddler"] }, "hair"),
    cane_a: { slot: "hold", sides: { allowed: ["l", "r"], default: "r" }, draw: ctx => { seen.cane_a = ctx; const h = ctx.side === "l" ? "l" : "r"; return { front: [{ ...piece("held", `hand_${h}`), hold: h }], back: [], alt: { [`hand_${h}`]: "hold" } }; } },
    top_kid: part("top_kid", "top", { colors: 1, defaults: ["f3"], builds: ["toddler"] }, "top", "spine"),
  };
  return {
    id: "w@1", palettes: PAL, body: () => DIMS, parts, set: {}, props: {}, gestures: {},
    base: { slot: "body", draw: () => ({ front: [piece("body", "spine"), ...HANDS], back: [piece("body", "spine"), ...HANDS] }) },
    layers: { front: ["body", "hair", "top", "bottom", "shoes", "headwear", "hand", "held"], back: ["body", "hair", "top", "bottom", "shoes", "headwear", "hand", "held"] },
    color: (id, fb = "#888888") => { for (const p of Object.values(PAL)) if (typeof id === "string" && Object.hasOwn(p, id)) return (p as Record<string, string>)[id]; return typeof id === "string" && /^#[0-9A-F]{6}$/i.test(id) ? id : fb; },
    features: {
      "body.build": choice(["adult", "elder", "child", "toddler"]), "body.shape": choice(["slim", "average"], "average"), "face.shape": choice(["oval"]), "face.eyes": choice(["round"]), "face.eyeColor": choice(["e1"]),
      "face.brows": choice(["soft"]), "face.nose": choice(["button"]), "face.mouth": choice(["wide"]), "face.ears": choice(["round"]),
      "face.marks": choice(["freckles", "mole", "dimples", "lines", "vitiligo", "scar"], null, { max: 2, free: ["vitiligo", "scar"] }), facialHair: choice(["stubble"], null),
    },
    patterns: { pat_a: { names: { en: "A", tr: "a" }, inks: 1 }, pat_b: { names: { en: "B", tr: "b" }, inks: 2, unlock: "bundle:b" } },
    paletteUnlocks: { h2: "bundle:dye" }, colorNames: { f1: { en: "white", tr: "beyaz" } },
    defaultDoc: { v: 1, kit: "w@1", body: { build: "adult", height: 0.5, shape: "average" }, skin: "s1", face: {}, hair: { style: "hair_a", color: "h1" }, outfit: { top: { id: "top_a" }, bottom: { id: "bottom_a" }, shoes: { id: "shoes_a" } } },
    face: { style: a => ({ skin: a.skin }) as never, region: () => [-1, -1, 1, 1], draw: () => {}, emotions: {}, visemes: {} },
  };
}
const kit = makeKit();
const doc = (o: object = {}): AvatarDoc => ({ ...structuredClone(kit.defaultDoc), ...o });

test("the new slots: fields in table order, canonical keys, each takes only its slot's parts", () => {
  const fields = GARMENT_FIELDS.map(g => g.field);
  for (const f of ["wear.hat", "wear.hair", "wear.aid", "wear.hands", "hold"]) assert.ok(fields.includes(f), f);
  assert.ok(fields.indexOf("wear.head") < fields.indexOf("wear.hat") && fields.indexOf("carry") < fields.indexOf("hold"), "a hat after the covering, held things last");
  const n = normalize(doc({ hold: "cane_a", wear: { hands: "ring_a", aid: "aid_a", hair: "band_a", hat: "hat_a", head: "scarf_a" } }), kit)!;
  assert.deepEqual(Object.keys(n), ["v", "kit", "body", "skin", "face", "hair", "outfit", "wear", "hold"]);
  assert.deepEqual(Object.keys(n.wear!), ["head", "hat", "hair", "aid", "hands"]);
  const notes: AvatarNote[] = [];
  assert.equal(normalize(doc({ wear: { hat: "scarf_a", aid: "ring_a" }, hold: "top_a" }), kit, { notes })!.wear, undefined);
  assert.deepEqual(notes.map(x => [x.field, x.why]), [["wear.hat", "slot"], ["wear.aid", "slot"], ["hold", "slot"]]);
  // a scarf hides the hair but never the aid; the hat clips; the hat lies over the scarf
  const p = compose(n, kit);
  assert.ok(!p.views.front.some(i => i.layer === "hair" && i.bone === "head" && seen.hair_a));
  assert.deepEqual(p.notes.map(x => [x.field, x.why]), [["hair.style", "hidden"]]);
  const hw = p.views.front.filter(i => i.layer === "headwear").length;
  assert.equal(hw, 3, "scarf, hat and aid");
});

test("parts made for some builds: dropped from other builds with a note, never offered there, and back when the build allows", () => {
  const notes: AvatarNote[] = [];
  const kid = normalize(doc({ body: { build: "child", height: 0.5, shape: "average" }, wear: { hands: "ring_a", hair: "bow_a" } }), kit, { notes })!;
  assert.deepEqual(kid.wear, { hair: { id: "bow_a" } });
  assert.deepEqual(notes.map(x => [x.field, x.id, x.why]), [["wear.hands", "ring_a", "build"]]);
  // a required slot whose part does not fit gets the default's part, which is made for everyone
  const n = normalize(doc({ outfit: { top: "top_kid", bottom: "bottom_a", shoes: "shoes_a" } }), kit)!;
  assert.equal(n.outfit.top?.id, "top_a");
  assert.equal(normalize(doc({ body: { build: "toddler", height: 0.5, shape: "average" }, outfit: { top: "top_kid", bottom: "bottom_a", shoes: "shoes_a" } }), kit)!.outfit.top?.id, "top_kid");
  const b = createBuilder(kit, null);
  assert.ok(b.options("wear.hands").some(o => o.value === "ring_a") && !b.options("wear.hair").some(o => o.value === "bow_a"));
  assert.ok(b.set("wear.hands", "ring_a") && b.set("body.build", "child"));
  assert.equal(b.doc.wear, undefined, "the ring comes off a child");
  assert.equal(b.set("wear.hands", "ring_a"), false, "and is not offered");
  assert.ok(b.set("body.build", "adult")); assert.deepEqual(b.doc.wear, { hands: { id: "ring_a" } }, "and comes back");
  for (let seed = 0; seed < 200; seed++) { b.randomize(seed); const d = b.doc; if (d.body.build === "child" || d.body.build === "toddler") assert.ok(!d.wear?.hands); else assert.ok(!d.wear?.hair || d.wear.hair.id !== "bow_a"); }
});

test("one-sided parts: a side the part allows is kept (its default left out), and reaches the part as ctx.side", () => {
  const side = (s: unknown) => normalize(doc({ wear: { aid: { id: "aid_a", side: s } } }), kit)!.wear!.aid;
  assert.deepEqual(side("b"), { id: "aid_a", side: "b" });
  assert.deepEqual(side("l"), { id: "aid_a" }, "the default");
  for (const bad of ["x", 1, null, "__proto__", ["b"]]) assert.deepEqual(side(bad), { id: "aid_a" });
  assert.deepEqual(normalize(doc({ hold: { id: "cane_a", side: "b" } }), kit)!.hold, { id: "cane_a" }, "b is not a hand");
  compose(doc({ wear: { aid: { id: "aid_a", side: "r" } } }), kit); assert.equal(seen.aid_a.side, "r");
  compose(doc({ wear: { aid: "aid_a" } }), kit); assert.equal(seen.aid_a.side, "l");
  compose(doc(), kit); assert.equal(seen.top_a.side, null, "no sides, no side");
  const b = createBuilder(kit, null);
  assert.ok(b.set("wear.aid", "aid_a")); assert.equal(b.getSide("wear.aid"), "l"); assert.deepEqual(b.field("wear.aid")!.sides, ["l", "r", "b"]);
  assert.ok(b.setSide("wear.aid", "b")); assert.deepEqual(b.doc.wear?.aid, { id: "aid_a", side: "b" });
  assert.equal(b.setSide("wear.aid", "x" as never), false); assert.equal(b.setSide("outfit.top", "l"), false);
});

test("a part that holds something closes that hand; the stage can leave its pieces out for a prop", () => {
  const p = compose(doc({ hold: { id: "cane_a", side: "l" } }), kit);
  const defaults = (v: "front" | "back") => Object.fromEntries(p.views[v].filter(i => i.alt?.default).map(i => [i.alt!.key, i.alt!.value]));
  assert.deepEqual(defaults("front"), { hand_l: "hold", hand_r: "relaxed" });
  assert.deepEqual(defaults("back"), { hand_l: "hold", hand_r: "relaxed" });
  assert.equal(p.views.front.find(i => i.layer === "held")?.hold, "l");
  assert.deepEqual(Object.fromEntries(compose(doc(), kit).views.front.filter(i => i.alt?.default).map(i => [i.alt!.key, i.alt!.value])), { hand_l: "relaxed", hand_r: "relaxed" }, "without it, both hands rest");
});

test("prints: a pattern the part lists, with up to its number of inks from the fabrics (hex when trusted); a manifest knows the counts", () => {
  const top = (g: object, trusted = false) => normalize(doc({ outfit: { top: g, bottom: "bottom_a", shoes: "shoes_a" } }), kit, { trusted })!.outfit.top;
  assert.deepEqual(top({ id: "top_a", pattern: "pat_a", inks: ["f3", "f2"] }), { id: "top_a", pattern: "pat_a", inks: ["f3"] }, "one ink for pat_a");
  assert.deepEqual(top({ id: "top_a", pattern: "pat_b", inks: ["f3", "f2", "f1"] }), { id: "top_a", pattern: "pat_b", inks: ["f3", "f2"] });
  assert.deepEqual(top({ id: "top_a", pattern: "pat_b", inks: ["m1", "f2"] }), { id: "top_a", pattern: "pat_b" }, "inks are fabrics; the list stops at a bad one");
  assert.deepEqual(top({ id: "top_a", inks: ["f3"] }), { id: "top_a" }, "no pattern, no inks");
  assert.deepEqual(top({ id: "top_a", pattern: "pat_c" }), { id: "top_a" }, "a pattern the kit lacks");
  assert.deepEqual(top({ id: "top_a", pattern: "pat_b", inks: ["#AABBCC"] }, true), { id: "top_a", pattern: "pat_b", inks: ["#AABBCC"] });
  assert.deepEqual(top({ id: "top_a", pattern: "pat_b", inks: ["#AABBCC"] }), { id: "top_a", pattern: "pat_b" });
  const d = doc({ outfit: { top: { id: "top_a", pattern: "pat_b", inks: ["f3", "f2"] }, bottom: "bottom_a", shoes: "shoes_a" } });
  assert.deepEqual(normalize(d, manifestOf(kit)), normalize(d, kit));
  compose(d, kit);
  assert.deepEqual([seen.top_a.pattern, seen.top_a.inks], ["pat_b", ["#C4553A", "#4F6E9E"]]);
  assert.deepEqual(seen.top_a.garment, { id: "top_a", colors: [], pattern: "pat_b", inks: ["f3", "f2"] });
});

test("the builder: patterns and their inks, locked prints and colours, colour names", () => {
  const b = createBuilder(kit, null);
  assert.deepEqual(b.patternOptions("outfit.top").map(o => [o.value, o.locked]), [[null, false], ["pat_a", false], ["pat_b", true]]);
  assert.deepEqual(b.patternOptions("outfit.bottom"), [], "no patterns on the bottom");
  assert.equal(b.field("outfit.top")!.patterns, true); assert.equal(b.field("outfit.top")!.inks, undefined);
  assert.equal(b.setPattern("outfit.top", "pat_b"), false, "locked");
  assert.ok(b.setPattern("outfit.top", "pat_a"));
  assert.equal(b.field("outfit.top")!.inks, 1); assert.equal(b.getPattern("outfit.top"), "pat_a");
  assert.deepEqual(b.colorOptions("outfit.top", 1).map(c => c.id), ["f1", "f2", "f3"], "the ink is a fabric");
  assert.deepEqual(b.colorOptions("outfit.top", 2), [], "pat_a has one ink");
  assert.equal(b.getColor("outfit.top", 1), null, "left to the kit");
  assert.ok(b.setColor("outfit.top", 1, "f3")); assert.deepEqual(b.doc.outfit.top, { id: "top_a", pattern: "pat_a", inks: ["f3"] });
  assert.equal(b.getColor("outfit.top", 1), "f3");
  const open = createBuilder(kit, b.doc, { unlocked: ["bundle:b"] });
  assert.ok(open.setPattern("outfit.top", "pat_b") && open.setColor("outfit.top", 2, "f2"));
  assert.equal(open.setColor("outfit.top", 3, "f2"), false);
  assert.deepEqual(open.doc.outfit.top, { id: "top_a", pattern: "pat_b", inks: ["f3", "f2"] });
  assert.ok(open.setPattern("outfit.top", null)); assert.deepEqual(open.doc.outfit.top, { id: "top_a" });
  // colours: a locked hair colour is listed, named and refused; the randomiser never picks it
  assert.deepEqual(b.colorOptions("hair.style")[1], { id: "h2", hex: "#EDE5CB", label: "Colour 2", locked: true, unlock: "bundle:dye" });
  assert.deepEqual(b.colorOptions("outfit.top")[0], { id: "f1", hex: "#F7F3EA", label: "white" });
  assert.equal(b.setColor("hair.style", 0, "h2"), false);
  for (let seed = 0; seed < 100; seed++) { b.randomize(seed); assert.equal(b.doc.hair.color, "h1"); }
  assert.ok(createBuilder(kit, null, { unlocked: ["bundle:dye"] }).setColor("hair.style", 0, "h2"));
  // a document from a friend keeps what the learner could not pick
  assert.equal(normalize(doc({ hair: { style: "hair_a", color: "h2" } }), kit)!.hair.color, "h2");
});

test("clips per view: the clipped part gets the front and the back region", () => {
  const p = compose(doc({ wear: { hat: "hat_a" } }), kit);
  assert.deepEqual(seen.hair_a.clip?.bounds(), [-30, -35, 30, 45]);
  assert.deepEqual(seen.hair_a.clipBack?.bounds(), [-30, -25, 30, 55]);
  const f = p.views.front.find(i => i.layer === "hair")!, b = p.views.back.find(i => i.layer === "hair")!;
  assert.deepEqual([f.group!.shapes[0].clip?.bounds()[1], b.group!.shapes[0].clip?.bounds()[1]], [-35, -25]);
  assert.deepEqual(p.notes.map(n => n.why), ["clipped"]);
});

test("two parts that clip a slot: it is cut to the region inside both, and reads the hat's", () => {
  const p = compose(doc({ wear: { head: "kip_a", hat: "hat_a" } }), kit);
  const f = p.views.front.find(i => i.layer === "hair")!, b = p.views.back.find(i => i.layer === "hair")!;
  const tops = (it: Item) => (Array.isArray(it.group!.shapes[0].clip) ? it.group!.shapes[0].clip : []).map(c => c.bounds()[1]);
  assert.deepEqual(tops(f), [-47.5, -35], "the kippah's region, then the hat's");
  assert.deepEqual(tops(b), [-47.5, -25]);
  assert.deepEqual(seen.hair_a.clip?.bounds()[1], -35, "ctx.clip is the hat's (the last in table order)");
  assert.deepEqual(p.notes.filter(n => n.why === "clipped").map(n => n.by), ["kip_a", "hat_a"]);
  // the still backend draws the hair inside both: two nested clip paths
  const svg = renderSvg(p, kit, { framing: "head", size: 120 });
  assert.equal((svg.match(/<clipPath/g) ?? []).length, 2);
});

test("marks: up to the cap count, identity marks come on top", () => {
  const marks = (m: string[]) => normalize(doc({ face: { marks: m } }), kit)!.face.marks;
  assert.deepEqual(marks(["freckles", "mole", "dimples", "lines"]), ["freckles", "mole"]);
  assert.deepEqual(marks(["vitiligo", "freckles", "scar", "mole", "dimples"]), ["freckles", "mole", "vitiligo", "scar"]);
  const b = createBuilder(kit, null);
  assert.ok(b.set("face.marks", ["freckles", "mole", "vitiligo", "scar"]));
  assert.equal(b.set("face.marks", "dimples"), false, "two that count are the cap");
});

test("the document stays under the limit with every new slot filled, and drops them first when it must", () => {
  const n = normalize(doc({ hold: { id: "cane_a", side: "l" }, wear: { hands: "ring_a", aid: { id: "aid_a", side: "b" }, hair: "band_a", hat: "hat_a", head: "scarf_a" } }), kit)!;
  assert.ok(new TextEncoder().encode(serialize(n)).length < AVATAR_MAX_BYTES / 4);
  const notes: AvatarNote[] = [];
  const small = normalize(n, kit, { notes, maxBytes: 300 })!;
  assert.ok(small && new TextEncoder().encode(serialize(small)).length <= 300);
  const order = notes.filter(x => x.why === "size").map(x => x.field);
  assert.deepEqual(order.slice(0, 2), ["wear.hands", "wear.hair"], "hands and hairwear go before the covering and the aid");
  assert.ok(!order.includes("wear.aid") || order.indexOf("wear.aid") > order.indexOf("wear.head"));
  // a held cane goes after the hat and the covering, just before the aid
  const tiny: AvatarNote[] = [];
  normalize(n, kit, { notes: tiny, maxBytes: 200 });
  const all = tiny.filter(x => x.why === "size").map(x => x.field);
  assert.ok(all.indexOf("hold") > all.indexOf("wear.head") && all.indexOf("wear.head") > all.indexOf("wear.hat"), all.join(" "));
});

test("the randomiser: per-build weights for marks, and parts that avoid each other's tags are never picked together", () => {
  const k: Kit = {
    ...kit,
    features: { ...kit.features, "face.marks": { ...kit.features["face.marks"], weights: { mole: 0, lines: { adult: 1, elder: 6, child: 0, toddler: 0 } } } },
    parts: { ...kit.parts, shades_a: part("shades_a", "eyes", { tags: ["dark"] }, "headwear"), cane_a: { ...kit.parts.cane_a, avoid: ["dark"] } },
  };
  const b = createBuilder(k, null), seenMarks: Record<string, Record<string, number>> = {};
  let both = 0, shades = 0, canes = 0;
  for (let seed = 0; seed < 1500; seed++) {
    b.randomize(seed);
    const d = b.doc, by = (seenMarks[d.body.build] ??= {});
    for (const m of d.face.marks ?? []) by[m] = (by[m] ?? 0) + 1;
    const s = d.wear?.eyes !== undefined, c = d.hold !== undefined;
    shades += +s; canes += +c; both += +(s && c);
  }
  for (const build of ["child", "toddler"]) assert.equal(seenMarks[build]?.lines ?? 0, 0, `${build}: no lines`);
  for (const by of Object.values(seenMarks)) assert.equal(by.mole ?? 0, 0, "weight 0: never");
  assert.ok((seenMarks.elder?.lines ?? 0) > (seenMarks.elder?.freckles ?? 0) * 2, "elders get lines far more often");
  assert.ok(shades > 100 && canes > 40 && both === 0, `shades ${shades}, canes ${canes}, both ${both}`);
});

// ---- prints in the art ----------------------------------------------------------------------------

const TILE: Tile = { w: 2, h: 2, x: 0.5, y: 0, shapes: [{ path: rect(0, 0, 1, 1), fill: "#AA0000" }, { path: rect(0, 1, 2, 0.5), fill: "#0000AA", evenodd: true }] };

test("a tile repeats over its shape: offsets cover the box, and too small a tile draws nothing", () => {
  const at = tileOffsets(TILE, [0, 0, 10, 6]);
  assert.ok(at.some(([x, y]) => x <= 0 && y <= 0) && at.some(([x, y]) => x + 2 >= 10 && y + 2 >= 6));
  assert.ok(at.every(([x]) => (x - 0.5) % 2 === 0));
  assert.deepEqual(tileOffsets({ ...TILE, w: 0.01 }, [0, 0, 10, 10]), []);
  assert.deepEqual(tileOffsets(TILE, [0, 0, 1e6, 1e6]), [], "a hundred billion repeats are refused");
  assert.deepEqual(tileOffsets(TILE, [0, 0, NaN, 1]), []);
});

test("a printed shape: one fill per tile shape on a canvas, one <pattern> in SVG, shared across a picture", () => {
  const g: Group = { shapes: [{ path: rect(0, 0, 10, 6), fill: "#EEEEEE" }, { path: rect(0, 0, 10, 6), tile: TILE, flat: true }] };
  const calls: string[] = [];
  const ctx = new Proxy({}, { get: (_, k) => (typeof k === "string" ? (...a: unknown[]) => { calls.push(k === "fill" ? `fill(${a[0] ?? ""})` : k); } : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
  drawGroup(ctx, g, 5);
  assert.deepEqual(calls.filter(c => c.startsWith("fill")), ["fill(nonzero)", "fill(nonzero)", "fill(evenodd)"], "the ground, then each tile shape once");
  assert.ok(calls.filter(c => c === "translate").length > 20, "every repeat is traced into the same path");
  const tiles = new Map<Tile, string>();
  const svg = groupSvg(g, { id: "q", tiles }) + groupSvg({ shapes: [{ path: rect(20, 0, 5, 5), tile: TILE }] }, { id: "r", tiles });
  assert.equal([...svg.matchAll(/<pattern /g)].length, 1, "one definition");
  assert.equal([...svg.matchAll(/fill="url\(#q1t\)"/g)].length, 2, "used twice");
  assert.match(svg, /<pattern id="q1t" patternUnits="userSpaceOnUse" x=".5" y="0" width="2" height="2"><path d="[^"]+" fill="#AA0000"\/><path d="[^"]+" fill="#0000AA" fill-rule="evenodd"\/><\/pattern>/);
  // hostile tile colours and sizes write nothing
  const bad = groupSvg({ shapes: [{ path: rect(0, 0, 4, 4), tile: { w: NaN, h: 2, shapes: TILE.shapes } }, { path: rect(0, 0, 4, 4), tile: { w: 2, h: 2, shapes: [{ path: rect(0, 0, 1, 1), fill: "red\" onload=\"x" }] } }] });
  assert.ok(!bad.includes("onload") && !bad.includes("NaN"));
});

test("the still back view is the paper seen from behind: mirrored, like the stage's turn", () => {
  const b = DIMS, bones = humanoid(b);
  const left: Item = { layer: "body", bone: "hand_l", group: { shapes: [{ path: rect(-1, 0, 2, 2), fill: "#AA0000" }] } };
  const fig = { body: b, bones, views: { front: [left], back: [left] } };
  const front = renderSvg(fig, kit, { framing: "full" }), back = renderSvg(fig, kit, { framing: "full", view: "back" });
  const vb = (s: string) => /viewBox="([^"]+)"/.exec(s)![1].split(" ").map(Number);
  assert.ok(vb(front)[0] > 0, "the wearer's left hand is on the viewer's right in front");
  assert.ok(vb(back)[0] + vb(back)[2] < 0, "and on the viewer's left from behind");
  assert.match(back, /<g transform="matrix\(-1 0 0 1 0 0\)">/);
});
