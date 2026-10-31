// Tests of the avatar model on a small fake kit: normalize (the security boundary), compose's
// slot rules and the headless builder. The first kit's own parts are checked in sahne-kit/test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rect } from "../src/art/path.ts";
import { clipsOf } from "../src/art/shape.ts";
import { rng, type Rng } from "../src/core/rng.ts";
import type { Item, Kit, PartCtx, PartDef } from "../src/core/kit.ts";
import type { AvatarDoc, AvatarNote, BodyDims, Build } from "../src/core/types.ts";
import { normalize, serialize, docHash, isAvatarDoc, isLegacyChar, manifestOf, AVATAR_MAX_BYTES } from "../src/avatar/normalize.ts";
import { compose } from "../src/avatar/compose.ts";
import { createBuilder } from "../src/avatar/builder.ts";
import { applyLook, lookFields, CLOTHING_FIELDS } from "../src/avatar/look.ts";
import { GARMENT_FIELDS } from "../src/avatar/rules.ts";

// ---- a fake kit ----------------------------------------------------------------------------------

const DIMS: BodyDims = {
  build: "adult", H: 172, headW: 44, headH: 50, neckL: 5, neckW: 11, torsoL: 43, shoulderW: 42, chestW: 38, waistW: 32, hipW: 35,
  upperArmL: 29, foreArmL: 25, handL: 13, armW: [10.8, 9, 7.2], thighL: 36.57, shinL: 32.43, footH: 5, footW: 10.5, legW: [15, 12, 10], legLen: 74,
};
const PAL: Record<string, Record<string, string>> = {
  skin: { s1: "#F7DCC9", s2: "#A86A43", s3: "#402517" }, hair: { h1: "#1C1614", h2: "#8C3F1E", h3: "#D8D4CC" },
  fabric: { f1: "#F7F3EA", f2: "#4F6E9E", f3: "#C4553A", f4: "#2F8C88", f5: "#E0A83A", f6: "#7A3E6E" }, eyes: { e1: "#4A2E1E", e2: "#4D6F9A" },
};
const FAMILY: Record<string, string> = { f1: "white", f2: "blue", f3: "red", f4: "teal", f5: "yellow", f6: "purple" };
const LAYERS = ["body", "bottom", "top", "dress", "outer", "shoes", "hair", "head", "eyes", "ears", "neck", "wrist", "waist", "carry", "custom"];

const seen: Record<string, PartCtx> = {};
const item = (layer: string, bone: string): Item => ({ layer, bone, group: { shapes: [{ path: rect(0, 0, 2, 2), fill: "#888888" }] } });
/** A part that draws one piece per view on a layer named after its slot, and records its context. */
const part = (id: string, slot: string, o: Partial<PartDef> = {}, bone = "head"): PartDef => ({
  slot, ...o,
  draw: ctx => { seen[id] = ctx; return { front: [item(slot, bone)], back: [item(slot, bone)] }; },
});
const choice = (values: string[], def: string | null = values[0], extra: object = {}) => ({ values, default: def, ...extra });

function makeKit(): Kit {
  const parts: Record<string, PartDef> = {};
  const add = (id: string, slot: string, o?: Partial<PartDef>, bone?: string) => { parts[id] = part(id, slot, o, bone); };
  add("hair_a", "hair", { names: { en: "Hair A", tr: "saç a" } }); add("hair_b", "hair"); add("hair_cast", "hair", { tags: ["cast"] });
  add("top_a", "top", { colors: 1, defaults: ["f1"], names: { en: "Top A", tr: "üst a" } }, "spine"); add("top_b", "top", { colors: 1, defaults: ["f2"], tags: ["modest"] }, "spine");
  add("bottom_a", "bottom", { colors: 1, defaults: ["f2"] }, "hips"); add("bottom_b", "bottom", { colors: 1, defaults: ["f6"], tags: ["modest"] }, "hips");
  add("shoes_a", "shoes", { colors: 2, defaults: ["f1", "f2"] }); add("shoes_b", "shoes", { colors: 1, defaults: ["f6"] });
  add("dress_a", "dress", { colors: 1, defaults: ["f3"], replaces: ["top", "bottom"] }, "spine");
  add("coat_a", "outer", { colors: 1, defaults: ["f4"], over: ["top"] }, "spine");
  add("scarf_a", "head", { colors: 2, defaults: ["f4"], hides: ["hair"], tags: ["modest"] });
  add("cap_a", "head", { colors: 1, defaults: ["f3"], clips: { slots: ["hair"], keep: ctx => rect(-30, -ctx.body.headH * 0.6, 60, 60) } });
  add("glasses_a", "eyes", { colors: 1, defaults: ["f1"], unlock: "specs" });
  add("watch_a", "wrist", { colors: 2, palettes: ["fabric", "skin"], defaults: ["f1", "s1"] }, "hand_l");
  add("apron_a", "waist", { colors: 1, defaults: ["f1"], patterns: ["stripes"] }, "spine");
  add("moustache_a", "custom", { tags: ["cast"] });
  const mark = ["freckles", "mole"];
  return {
    id: "test@1", palettes: PAL, body: () => DIMS, base: part("base", "body"), parts, layers: { front: LAYERS, back: LAYERS }, set: {}, props: {}, gestures: {}, families: FAMILY,
    color: (id, fb = "#888888") => {
      if (typeof id !== "string") return fb;
      for (const p of Object.values(PAL)) if (Object.hasOwn(p, id)) return p[id];
      return /^#[0-9A-Fa-f]{6}$/.test(id) ? id : fb;
    },
    features: {
      "body.build": choice(["adult", "elder", "child", "toddler"], "adult", { weights: { adult: 4, elder: 1, child: 1, toddler: 1 } }), "body.shape": choice(["slim", "average", "broad", "round"], "average"),
      "face.shape": choice(["oval", "round"]), "face.eyes": choice(["round", "almond"]), "face.eyeColor": choice(["e1", "e2"]), "face.brows": choice(["soft", "thick"]),
      "face.nose": choice(["button", "long"]), "face.mouth": choice(["wide", "small"]), "face.ears": choice(["round"]), "face.marks": choice(mark, null, { max: 2 }),
      facialHair: choice(["stubble", "beard_full"], null),
    },
    labels: { none: { en: "None", tr: "yok" }, "outfit.top": { en: "Top", tr: "Üst" } },
    defaultDoc: {
      v: 1, kit: "test@1", body: { build: "adult", height: 0.5, shape: "average" }, skin: "s1", face: {}, hair: { style: "hair_a", color: "h1" },
      outfit: { top: { id: "top_a" }, bottom: { id: "bottom_a" }, shoes: { id: "shoes_a" } },
    },
    face: { style: a => ({ skin: a.skin }) as never, region: () => [-1, -1, 1, 1], draw: () => {}, emotions: {}, visemes: {} },
  };
}
const kit = makeKit();
const doc = (o: object = {}): AvatarDoc => ({ ...structuredClone(kit.defaultDoc), ...o });
const slotsOf = (items: Item[]) => items.map(i => i.layer);
const hasLayer = (p: ReturnType<typeof compose>, layer: string) => p.views.front.some(i => i.layer === layer);

// ---- normalize: what is a document ---------------------------------------------------------------

test("anything that is not a v:1 document for this kit family is null, Kumru's old char included", () => {
  const old = { skin: 0, hair: 3, hairC: 1, beard: 0, top: 2, wear: 0, acc: 0, shirt: 4 };
  assert.equal(normalize(old, kit), null);
  assert.ok(isLegacyChar(old) && isLegacyChar({ skin: 1 }) && isLegacyChar({ beard: 0, top: 6 }));
  assert.ok(!isLegacyChar({ skin: "s1" }) && !isLegacyChar({}) && !isLegacyChar({ skin: 0, extra: 1 }) && !isLegacyChar({ v: 1, skin: 0 }) && !isLegacyChar(null) && !isLegacyChar([0]));
  for (const x of [undefined, null, 0, 1, true, "", "x", [], [1], {}, { v: 2 }, { v: "1" }, { v: 1 }, { v: 1, kit: "test@1" }, { v: 1, kit: 5, body: {} }, { v: 1, kit: "test@1", body: [] },
    { v: 1, kit: "other@1", body: {} }, { v: 1, kit: "x".repeat(41), body: {} }, Symbol("x"), () => 1]) assert.equal(normalize(x, kit), null, String(typeof x));
  assert.ok(!isAvatarDoc(old) && isAvatarDoc(doc()) && !isAvatarDoc({ v: 1, kit: "test@1" }));
  assert.ok(normalize({ v: 1, kit: "test@7", body: {} }, kit), "another version of the kit is read, its unknown ids falling back");
  assert.equal(normalize({ v: 1, kit: "test@7", body: {} }, kit)?.kit, "test@1");
});

test("a minimal document becomes the default character; a full one comes out canonical and complete", () => {
  assert.deepEqual(normalize({ v: 1, kit: "test@1", body: {} }, kit), doc());
  const n = normalize({
    v: 1, kit: "test@1", junk: 1, voice: "x", motion: {}, body: { shape: "round", height: 0.4567, build: "elder" }, skin: "s3",
    face: { marks: ["mole", "freckles", "mole"], shape: "round", eyeColor: "e2", ears: "round" }, hair: { color: "h3", style: "hair_b" }, facialHair: { style: "beard_full", color: "h2" },
    outfit: { shoes: "shoes_a", top: { id: "top_b", colors: ["f5"] }, bottom: "bottom_b", outer: { id: "coat_a", colors: ["f4"] } },
    wear: { waist: { id: "apron_a", pattern: "stripes" }, eyes: "glasses_a" }, carry: null,
  }, kit)!;
  assert.deepEqual(n, {
    v: 1, kit: "test@1", body: { build: "elder", height: 0.46, shape: "round" }, skin: "s3",
    face: { shape: "round", eyeColor: "e2", marks: ["freckles", "mole"] }, hair: { style: "hair_b", color: "h3" }, facialHair: { style: "beard_full", color: "h2" },
    outfit: { bottom: { id: "bottom_b" }, top: { id: "top_b", colors: ["f5"] }, outer: { id: "coat_a" }, shoes: { id: "shoes_a" } },
    wear: { eyes: { id: "glasses_a" }, waist: { id: "apron_a", pattern: "stripes" } },
  });
  assert.deepEqual(Object.keys(n), ["v", "kit", "body", "skin", "face", "hair", "facialHair", "outfit", "wear"]);
  assert.deepEqual(Object.keys(n.outfit), ["top", "bottom", "outer", "shoes"]);
  assert.deepEqual(normalize(n, kit), n, "normalizing again changes nothing");
  assert.equal(serialize(normalize(JSON.parse(JSON.stringify({ ...n, hair: { color: n.hair.color, style: n.hair.style } })), kit)!), serialize(n), "key order of the input does not matter");
});

test("defaults are left out: features, colours equal to the part's, and a trailing default", () => {
  const n = normalize(doc({ face: { shape: "oval", eyes: "round", brows: "soft", ears: "round", eyeColor: "e1", marks: [] }, outfit: { top: { id: "top_a", colors: ["f1"] }, bottom: "bottom_a", shoes: { id: "shoes_a", colors: ["f3", "f2"] } } }), kit)!;
  assert.deepEqual(n.face, {});
  assert.deepEqual(n.outfit.top, { id: "top_a" });
  assert.deepEqual(n.outfit.shoes, { id: "shoes_a", colors: ["f3"] }, "the second colour is the part's default, so it goes");
  assert.deepEqual(normalize(doc({ outfit: { shoes: { id: "shoes_a", colors: ["f1", "f3"] } } }), kit)!.outfit.shoes, { id: "shoes_a", colors: ["f1", "f3"] });
});

// ---- normalize: ids, slots, aliases --------------------------------------------------------------

test("an id must be an own part of the field's slot; a required slot falls back to the kit default, an optional one is dropped", () => {
  const notes: never[] = [];
  const n = normalize(doc({
    hair: { style: "top_a", color: "h1" }, outfit: { top: "hair_a", bottom: { id: "nope" }, outer: "top_b", shoes: 7 }, wear: { head: "glasses_a", eyes: { id: ["glasses_a"] }, neck: "hair_a" }, carry: "x",
  }), kit, { notes })!;
  assert.deepEqual(n.hair, { style: "hair_a", color: "h1" });
  assert.deepEqual(n.outfit, doc().outfit);
  assert.equal(n.wear, undefined);
  assert.equal(n.carry, undefined);
  const why = (field: string) => (notes as { field: string; why: string }[]).find(x => x.field === field)?.why;
  assert.equal(why("hair.style"), "slot"); assert.equal(why("outfit.top"), "slot"); assert.equal(why("outfit.bottom"), "unknown"); assert.equal(why("wear.head"), "slot");
});

test("prototype names are never ids, colours, values or keys", () => {
  const bad = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf", "__defineGetter__"];
  for (const b of bad) {
    const n = normalize({
      v: 1, kit: "test@1", body: { build: b, shape: b, height: b }, skin: b, face: { shape: b, eyes: b, eyeColor: b, marks: [b, b] }, hair: { style: b, color: b },
      facialHair: { style: b, color: b }, outfit: { top: b, bottom: { id: b, colors: [b] }, dress: { id: b }, shoes: { id: b, colors: [b, b] } }, wear: { head: b, eyes: { id: b } }, carry: b, custom: [b],
    }, kit, { trusted: true });
    assert.deepEqual(n, doc(), b);
  }
  // an own "__proto__" key, as JSON.parse makes it
  const parsed = JSON.parse('{"v":1,"kit":"test@1","__proto__":{"polluted":true},"body":{"__proto__":{"polluted":true},"build":"child"},"outfit":{"__proto__":{"id":"top_b"},"top":{"__proto__":{"id":"top_b"},"id":"top_a"}}}');
  const n = normalize(parsed, kit)!;
  assert.equal(n.body.build, "child");
  assert.deepEqual(n.outfit.top, { id: "top_a" });
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(Object.getPrototypeOf(n), Object.prototype);
  // the doc whose parts are looked up in a kit that has inherited keys too
  assert.equal(normalize(doc({ hair: { style: "__proto__", color: "h1" } }), kit)!.hair.style, "hair_a");
});

test("aliases map retired ids of parts and colours; loops and long chains end", () => {
  const k: Kit = { ...kit, aliases: { top_old: "top_b", top_older: "top_old", f_old: "f5", loop_a: "loop_b", loop_b: "loop_a", c1: "c2", c2: "c3", c3: "c4", c4: "c5", c5: "shoes_b", "constructor": "top_b" } };
  const n = normalize(doc({ outfit: { top: { id: "top_older", colors: ["f_old"] }, bottom: "loop_a", shoes: "c1" } }), k)!;
  assert.deepEqual(n.outfit.top, { id: "top_b", colors: ["f5"] });
  assert.deepEqual(n.outfit.bottom, { id: "bottom_a" }, "a loop is unknown, so the default");
  assert.deepEqual(n.outfit.shoes, { id: "shoes_a" }, "a chain of 5 hops is not followed (c5 would be shoes_b)");
  assert.equal(normalize(doc({ outfit: { shoes: "c2" } }), k)!.outfit.shoes?.id, "shoes_b", "a chain of 4 is");
  assert.equal(normalize(doc({ outfit: { top: "constructor" } }), k)!.outfit.top?.id, "top_b", "only an own alias counts, and this one is");
  assert.equal(normalize(doc({ outfit: { top: "toString" } }), k)!.outfit.top?.id, "top_a");
});

test("parts reserved for the cast are refused in a learner's document and accepted in a trusted one", () => {
  const d = doc({ hair: { style: "hair_cast", color: "h1" }, custom: [{ id: "moustache_a" }, "top_b", { id: "nope" }, { id: "hair_b" }] });
  const learner = normalize(d, kit)!;
  assert.equal(learner.hair.style, "hair_a"); assert.equal(learner.custom, undefined);
  const cast = normalize(d, kit, { trusted: true })!;
  assert.equal(cast.hair.style, "hair_cast");
  assert.deepEqual(cast.custom, [{ id: "moustache_a" }, { id: "top_b" }], "at most two custom parts");
  assert.equal(normalize(doc({ custom: "moustache_a" }), kit, { trusted: true })!.custom, undefined);
});

// ---- normalize: colours -------------------------------------------------------------------------

test("colours are ids of the field's palette; hex only in trusted documents, strictly", () => {
  const d = doc({ skin: "#a86a43", hair: { style: "hair_a", color: "f1" }, face: { eyeColor: "#112233" }, outfit: { top: { id: "top_a", colors: ["#aabbcc"] }, bottom: "bottom_a", shoes: { id: "shoes_a", colors: ["s2", "#00ff00"] } } });
  const learner = normalize(d, kit)!;
  assert.equal(learner.skin, "s1"); assert.equal(learner.hair.color, "h1"); assert.equal(learner.face.eyeColor, undefined);
  assert.equal(learner.outfit.top?.colors, undefined); assert.equal(learner.outfit.shoes?.colors, undefined);
  const cast = normalize(d, kit, { trusted: true })!;
  assert.equal(cast.skin, "#A86A43"); assert.equal(cast.hair.color, "h1", "a fabric id is not a hair colour"); assert.equal(cast.face.eyeColor, "#112233");
  assert.deepEqual(cast.outfit.top?.colors, ["#AABBCC"]);
  assert.deepEqual(cast.outfit.shoes?.colors, ["f1", "#00FF00"], "s2 is no fabric colour, so the first is the default, and the hex of a cast document stays");
  for (const hex of ["#FFF", "#GGGGGG", "#FF00FF80", "#12345", " #123456", "#123456 ", "#12 456", "#000\" onload=\"alert(1)", "#000'><script>", "rgb(1,2,3)", "#１２３４５６", "url(#x)", "#123456\n"])
    assert.equal(normalize(doc({ skin: hex }), kit, { trusted: true })!.skin, "s1", JSON.stringify(hex));
  // a part's colour comes from the palette that part names
  const watch = normalize(doc({ wear: { wrist: { id: "watch_a", colors: ["f5", "s3"] } } }), kit)!.wear?.wrist;
  assert.deepEqual(watch, { id: "watch_a", colors: ["f5", "s3"] });
  assert.deepEqual(normalize(doc({ wear: { wrist: { id: "watch_a", colors: ["f5", "f3"] } } }), kit)!.wear?.wrist, { id: "watch_a", colors: ["f5"] }, "f3 is not a skin colour: the default (s1) goes, and with it the trailing colour");
});

test("colours are cut to the part's count, patterns need the part's say-so, bad entries stop the list", () => {
  const top = (g: object) => normalize(doc({ outfit: { top: g } }), kit)!.outfit.top;
  assert.deepEqual(top({ id: "top_a", colors: ["f3", "f4", "f5"] }), { id: "top_a", colors: ["f3"] });
  assert.deepEqual(top({ id: "top_a", colors: "f3" }), { id: "top_a" });
  assert.deepEqual(top({ id: "top_a", colors: [{}] }), { id: "top_a" });
  assert.deepEqual(top({ id: "top_a", colors: [["f3"]] }), { id: "top_a" });
  assert.deepEqual(top({ id: "top_a", colors: [null, "f3"] }), { id: "top_a" }, "the first is the default f1");
  assert.deepEqual(top({ id: "top_a", pattern: "stripes" }), { id: "top_a" }, "top_a has no patterns");
  const apron = (p: unknown) => normalize(doc({ wear: { waist: { id: "apron_a", pattern: p } } }), kit)!.wear?.waist;
  assert.deepEqual(apron("stripes"), { id: "apron_a", pattern: "stripes" });
  for (const p of ["dots", 5, null, {}, "__proto__"]) assert.deepEqual(apron(p), { id: "apron_a" });
  // a colour with no default cannot leave a gap
  const kk: Kit = { ...kit, parts: { ...kit.parts, three_a: part("three_a", "carry", { colors: 3, defaults: ["f1"] }) } };
  assert.deepEqual(normalize(doc({ carry: { id: "three_a", colors: ["f1", "f2", "f3"] } }), kk)!.carry, { id: "three_a", colors: ["f1", "f2", "f3"] });
  assert.deepEqual(normalize(doc({ carry: { id: "three_a", colors: ["f2", "nope", "f3"] } }), kk)!.carry, { id: "three_a", colors: ["f2"] });
});

// ---- normalize: features, body --------------------------------------------------------------------

test("unknown feature values become the default, marks are unique, ordered and capped, numbers are numbers", () => {
  const n = (o: object) => normalize(doc(o), kit)!;
  assert.deepEqual(n({ face: { shape: "triangle", eyes: 5, nose: ["long"], mouth: { x: 1 } } }).face, {});
  assert.deepEqual(n({ face: { marks: ["mole", "freckles", "beard", "mole"] } }).face.marks, ["freckles", "mole"]);
  assert.equal(n({ face: { marks: "freckles" } }).face.marks, undefined);
  assert.deepEqual(n({ face: { marks: Array.from({ length: 1e6 }, () => "mole") } }).face.marks, ["mole"]);
  assert.equal(n({ facialHair: { style: "ponytail" } }).facialHair, undefined);
  assert.deepEqual(n({ facialHair: { style: "stubble", color: "f1" } }).facialHair, { style: "stubble" });
  assert.deepEqual(n({ facialHair: "stubble" }).facialHair, undefined);
  const body = (b: object) => n({ body: b }).body;
  assert.deepEqual(body({ build: "giant", shape: "triangle", height: 7 }), { build: "adult", height: 1, shape: "average" });
  for (const h of [NaN, Infinity, -Infinity, "0.2", null, {}, [0.2], undefined, 1e999]) assert.equal(body({ height: h }).height, 0.5, String(h));
  assert.equal(body({ height: -3 }).height, 0); assert.equal(body({ height: 1 / 3 }).height, 0.33); assert.equal(body({ height: -0 }).height, 0);
});

test("normalize reads its input and never changes it", () => {
  const deepFreeze = <T>(x: T): T => { if (x && typeof x === "object") { Object.values(x).forEach(deepFreeze); Object.freeze(x); } return x; };
  const input = deepFreeze(structuredClone(doc({ face: { marks: ["mole"], shape: "round" }, outfit: { top: { id: "top_b", colors: ["f5", "f6"] }, dress: "dress_a" }, custom: [{ id: "moustache_a" }], facialHair: { style: "stubble" } })));
  const before = JSON.stringify(input);
  const n = normalize(input, kit, { trusted: true })!;
  assert.ok(n && JSON.stringify(input) === before);
  assert.notEqual(n.face, input.face); assert.notEqual(n.face.marks, input.face.marks); assert.ok(!Object.isFrozen(n), "the result is the caller's to change");
  n.face.shape = "oval"; assert.equal(input.face.shape, "round");
  compose(input, kit); createBuilder(kit, input).set("skin", "s2");
  assert.equal(JSON.stringify(input), before);
});

test("sparse, huge, deep and cyclic input is cheap and safe", () => {
  const big = "x".repeat(2e6), a: Record<string, unknown> = { v: 1, kit: "test@1", body: {} };
  a.self = a; a.hair = a; a.face = { marks: new Array(2e9), shape: a, self: a }; a.outfit = { top: a, bottom: { id: big, colors: new Array(1e9) }, shoes: { id: "shoes_a", colors: big } };
  a.skin = big; a.custom = new Array(1e9); a.wear = a; a.facialHair = a;
  let t = Date.now();
  assert.deepEqual(normalize(a, kit, { trusted: true }), doc());
  assert.ok(Date.now() - t < 200, "no work in proportion to the size of the input");
  let deep: unknown = "end";
  for (let i = 0; i < 100000; i++) deep = { x: deep, id: deep, colors: [deep] };
  t = Date.now();
  assert.deepEqual(normalize({ v: 1, kit: "test@1", body: deep, face: deep, outfit: { top: deep }, hair: deep }, kit), doc());
  assert.ok(Date.now() - t < 200);
  const thrower = new Proxy({}, { get() { throw new Error("no"); }, has() { throw new Error("no"); }, ownKeys() { throw new Error("no"); }, getOwnPropertyDescriptor() { throw new Error("no"); } });
  assert.equal(normalize(thrower, kit), null);
  assert.equal(normalize({ v: 1, kit: "test@1", body: thrower }, kit)?.body ?? null, null);
  const getter = { v: 1, kit: "test@1", body: {}, get skin(): string { throw new Error("no"); } };
  assert.equal(normalize(getter, kit), null);
  assert.equal(isLegacyChar(thrower), false);
});

// ---- normalize: replaces and size -----------------------------------------------------------------

test("a dress replaces top and bottom: they are dropped, and the requirement is met", () => {
  const notes: AvatarNote[] = [];
  const n = normalize(doc({ outfit: { dress: { id: "dress_a", colors: ["f5"] }, top: "top_b", bottom: "bottom_b", shoes: "shoes_a" } }), kit, { notes })!;
  assert.deepEqual(n.outfit, { dress: { id: "dress_a", colors: ["f5"] }, shoes: { id: "shoes_a" } });
  assert.deepEqual(notes.filter(x => x.why === "replaced").map(x => [x.field, x.by]), [["outfit.top", "dress_a"], ["outfit.bottom", "dress_a"]]);
  assert.deepEqual(normalize(doc({ outfit: { dress: "dress_a" } }), kit)!.outfit, { dress: { id: "dress_a" }, shoes: { id: "shoes_a" } }, "no top or bottom is made up");
  assert.deepEqual(normalize(doc({ outfit: { dress: "nope", top: "top_b" } }), kit)!.outfit, { bottom: { id: "bottom_a" }, top: { id: "top_b" }, shoes: { id: "shoes_a" } }, "an unknown dress replaces nothing");
  // a custom part may replace too, and it wins over the table
  const k: Kit = { ...kit, parts: { ...kit.parts, robe_a: part("robe_a", "outer", { replaces: ["top", "dress"], tags: ["cast"] }) } };
  const robed = normalize(doc({ outfit: { dress: "dress_a" }, custom: ["robe_a"] }), k, { trusted: true })!;
  assert.deepEqual(robed.outfit, { bottom: { id: "bottom_a" }, shoes: { id: "shoes_a" } }, "the robe took the dress's place, so the dress replaced nothing; the top is the robe's, the bottom is the default's");
  assert.deepEqual(robed.custom, [{ id: "robe_a" }]);
});

/** A kit whose parts have long ids, so that a full document is over a 1 KB limit (a host's stricter `maxBytes`). */
function longKit(): { kit: Kit; full: AvatarDoc } {
  const parts: Record<string, PartDef> = { ...kit.parts }, ids: Record<string, string> = {};
  for (const slot of ["hair", "top", "bottom", "dress", "outer", "shoes", "head", "eyes", "ears", "neck", "wrist", "waist", "carry", "custom"]) {
    const id = `${slot}_${"a".repeat(40 - slot.length - 1)}`;
    ids[slot] = id;
    parts[id] = part(id, slot, { colors: 2, defaults: ["f1", "f2"], tags: slot === "custom" ? ["cast"] : [] });
  }
  const g = (slot: string) => ({ id: ids[slot], colors: ["f5", "f3"] });
  const full = doc({
    hair: { style: ids.hair, color: "h2" }, outfit: { top: g("top"), bottom: g("bottom"), outer: g("outer"), shoes: g("shoes") },
    wear: { head: g("head"), eyes: g("eyes"), ears: g("ears"), neck: g("neck"), wrist: g("wrist"), waist: g("waist") }, carry: g("carry"), custom: [g("custom"), g("custom")],
    facialHair: { style: "beard_full", color: "h2" }, face: { marks: ["freckles", "mole"], shape: "round" },
  });
  return { kit: { ...kit, parts }, full };
}

test("a document over the limit loses optional parts in a fixed order, never required ones, and never comes out too big", () => {
  const { kit: k, full } = longKit(), LIMIT = 1024;
  assert.ok(new TextEncoder().encode(JSON.stringify(full)).length > LIMIT + 100, "the fixture is over the limit");
  const notes: AvatarNote[] = [];
  const n = normalize(full, k, { trusted: true, notes, maxBytes: LIMIT })!;
  assert.ok(new TextEncoder().encode(serialize(n)).length <= LIMIT);
  const dropped = notes.filter(x => x.why === "size").map(x => x.field);
  const ORDER = ["carry", "wear.wrist", "wear.neck", "wear.ears", "wear.waist", "outfit.outer", "face.marks", "wear.eyes", "facialHair", "wear.head", "custom"];
  assert.ok(dropped.length >= 1 && dropped[0] === "carry", "the carried item goes first");
  assert.deepEqual(dropped, ORDER.slice(0, dropped.length), "dropped in the documented order, and only as many as needed");
  assert.ok(n.outfit.top && n.outfit.bottom && n.outfit.shoes && n.hair.style, "required parts stay");
  assert.deepEqual(n.custom?.length, 2, "a cast member's custom parts stay while anything else can go instead");
  assert.deepEqual(normalize(n, k, { trusted: true, maxBytes: LIMIT }), n, "and the result is stable");
  // untrusted: custom is gone before the size is looked at
  const m = normalize(full, k, { maxBytes: LIMIT })!;
  assert.ok(new TextEncoder().encode(serialize(m)).length <= LIMIT && m.custom === undefined);
  // custom parts are the last to go: only a document that is over the limit with nothing else left loses them
  const huge = { ...full, custom: [{ id: full.custom![0].id, colors: ["#AABBCC", "#DDEEFF"] }, { id: full.custom![1].id, colors: ["#AABBCC", "#DDEEFF"] }], hair: { style: full.hair.style, color: "#112233" } };
  const notes2: AvatarNote[] = [];
  const h = normalize({ ...huge, outfit: { ...huge.outfit, top: { id: huge.outfit.top!.id, colors: ["#AABBCC"] } } }, k, { trusted: true, notes: notes2, maxBytes: LIMIT })!;
  const lost = notes2.filter(x => x.why === "size").map(x => x.field);
  assert.ok(lost.length >= 3 && lost.length < ORDER.length, `some optional parts went (${lost.length})`);
  assert.deepEqual(lost, ORDER.slice(0, lost.length));
  assert.ok(h.custom, "the custom parts survived the hex colours that made the document big");
});

test("the size limit is 2 KB and a host may only make it stricter", () => {
  const { kit: k, full } = longKit();
  assert.equal(AVATAR_MAX_BYTES, 2048);
  const n = normalize(full, k, { trusted: true })!;
  assert.ok(n.carry && new TextEncoder().encode(serialize(n)).length <= AVATAR_MAX_BYTES, "this document fits 2 KB whole");
  assert.deepEqual(normalize(full, k, { trusted: true, maxBytes: 1e6 }), n, "maxBytes never raises the limit");
});

test("the id in a note is the document's text made safe to show", () => {
  const notes: AvatarNote[] = [];
  normalize(doc({ hair: { style: "<img src=x onerror=alert(1)>", color: "h1" }, outfit: { top: { id: "\"><script>alert(1)</script>".repeat(5) }, bottom: "bottom_a", shoes: "shoes_a" }, wear: { head: { id: "a&b'c" } } }), kit, { notes });
  const unknown = notes.filter(x => x.why === "unknown");
  assert.equal(unknown.length, 3);
  for (const x of unknown) assert.match(x.id, /^[\w.@-]{1,48}$/, x.id);
  assert.equal(unknown[0].id, "_img_src_x_onerror_alert_1__");
});

// ---- normalize: fuzz ------------------------------------------------------------------------------

const PROTO = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "prototype"];
function junk(r: Rng, depth = 0): unknown {
  switch (r.int(0, 11)) {
    case 0: return null;
    case 1: return r.pick([NaN, Infinity, -Infinity, -1, 0, 0.5, 1, 2, 1e308, -0, 2 ** 53]);
    case 2: return r.pick([...PROTO, "", "x".repeat(70), "#FFFFFF", "#000\" onload=\"alert(1)", "top_a", "top_b", "hair_a", "hair_b", "f1", "f2", "h1", "s2", "e1", "adult", "stubble", "freckles", "dress_a", "cap_a", "scarf_a", "coat_a", "glasses_a"]);
    case 3: return depth < 3 ? Array.from({ length: r.int(0, 4) }, () => junk(r, depth + 1)) : [];
    case 4: return depth < 3 ? Object.fromEntries(Array.from({ length: r.int(0, 4) }, () => [r.pick(["id", "colors", "pattern", "style", "color", "shape", "marks", ...PROTO]), junk(r, depth + 1)])) : {};
    case 5: return r.chance(0.5);
    case 6: return { id: r.pick(["top_a", "top_b", "dress_a", "bottom_a", "cap_a", "scarf_a", "glasses_a", "shoes_a", "watch_a", "moustache_a", "hair_b"]), colors: junk(r, depth + 1), pattern: junk(r, depth + 1) };
    default: return undefined;
  }
}
/** A valid document with some of its parts swapped for junk. */
function mutated(r: Rng): unknown {
  const d = structuredClone(doc({
    face: { shape: "round", marks: ["mole"] }, facialHair: { style: "stubble", color: "h2" }, outfit: { top: { id: "top_b", colors: ["f3"] }, bottom: "bottom_b", outer: "coat_a", shoes: { id: "shoes_a", colors: ["f4", "f5"] } },
    wear: { head: "scarf_a", eyes: "glasses_a", wrist: "watch_a", waist: "apron_a" }, carry: "x", custom: ["moustache_a"],
  })) as Record<string, any>;
  const paths = ["v", "kit", "body", "body.build", "body.height", "body.shape", "skin", "face", "face.shape", "face.marks", "hair", "hair.style", "hair.color", "facialHair", "facialHair.style",
    "outfit", "outfit.top", "outfit.top.id", "outfit.top.colors", "outfit.bottom", "outfit.shoes.colors", "outfit.dress", "wear", "wear.head", "wear.eyes", "wear.wrist.colors", "carry", "custom", "custom.0"];
  for (let i = r.int(1, 6); i > 0; i--) {
    const ks = r.pick(paths).split("."), last = ks.pop() as string;
    let c: any = d;
    for (const k of ks) c = c && typeof c === "object" ? c[k] : undefined;
    if (c && typeof c === "object") { const v = junk(r); if (v === undefined) delete c[last]; else c[last] = v; }
  }
  return d;
}
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x); else if (Array.isArray(x)) x.forEach(v => strings(v, out)); else if (x && typeof x === "object") Object.values(x).forEach(v => strings(v, out));
  return out;
}

test("fuzz: every input is null or a stable, small document made only of the kit's own words", () => {
  const allowed = new Set<string>([kit.id, ...Object.keys(kit.parts), ...Object.values(PAL).flatMap(p => Object.keys(p)), ...Object.values(kit.features).flatMap(f => f.values), "stripes"]);
  const r = rng("fuzz"), pol = Object.keys(Object.prototype).length;
  let docs = 0;
  for (let i = 0; i < 4000; i++) {
    const input = i % 3 ? mutated(r) : junk(r);
    for (const trusted of [false, true]) {
      const n = normalize(input, kit, { trusted });
      if (n === null) continue;
      docs++;
      assert.ok(new TextEncoder().encode(serialize(n)).length <= AVATAR_MAX_BYTES);
      assert.deepEqual(normalize(n, kit, { trusted }), n, `stable (${i})`);
      assert.deepEqual(normalize(JSON.parse(serialize(n)), kit, { trusted }), n, "and the same after a JSON round trip");
      for (const s of strings(n)) assert.ok(allowed.has(s) || (trusted && /^#[0-9A-F]{6}$/.test(s)), `unexpected string ${JSON.stringify(s)}`);
      assert.ok(compose(n, kit, { trusted }).views.front.some(it => it.layer === "body"));
    }
  }
  assert.ok(docs > 1000, `most mutated documents are still documents (${docs})`);
  assert.equal(Object.keys(Object.prototype).length, pol);
  assert.equal(({} as Record<string, unknown>).id, undefined);
});

test("a manifest, the kit as plain JSON without its drawing, normalizes exactly as the kit does", () => {
  const m = manifestOf(kit);
  assert.deepEqual(JSON.parse(JSON.stringify(m)), m, "it is JSON");
  assert.ok(!JSON.stringify(m).includes("draw"));
  assert.deepEqual(Object.keys(m.parts.cap_a), ["slot", "colors", "palettes", "defaults", "patterns", "tags", "hides", "replaces"].filter(k => k in m.parts.cap_a) as string[]);
  const r = rng("manifest");
  for (let i = 0; i < 1500; i++) {
    const x = i % 3 ? mutated(r) : junk(r);
    for (const trusted of [false, true]) assert.deepEqual(normalize(x, m, { trusted }), normalize(x, kit, { trusted }), `input ${i}`);
  }
  assert.deepEqual(normalize(doc({ outfit: { dress: "dress_a", top: "top_b" } }), m)!.outfit, { dress: { id: "dress_a" }, shoes: { id: "shoes_a" } }, "a manifest knows what replaces what");
});

test("serialize keeps the canonical order, docHash is short, stable and tells documents apart", () => {
  const a = normalize(doc(), kit)!, b = normalize(doc({ skin: "s2" }), kit)!;
  assert.equal(serialize(a), JSON.stringify(a));
  assert.equal(docHash(a), docHash(structuredClone(a)));
  assert.notEqual(docHash(a), docHash(b));
  assert.match(docHash(a), /^[0-9a-z]{8,12}$/);
  const seenHashes = new Set<string>(), r = rng(7);
  for (let i = 0; i < 3000; i++) seenHashes.add(docHash(normalize(doc({ body: { build: "adult", height: Math.round(r() * 1000) / 1000, shape: "round" }, skin: r.pick(["s1", "s2", "s3"]), hair: { style: "hair_a", color: r.pick(["h1", "h2", "h3"]) } }), kit)!));
  assert.ok(seenHashes.size > 250, "distinct documents get distinct hashes");
});

// ---- compose --------------------------------------------------------------------------------------

test("compose never throws and draws the kit's default character for a document it cannot use", () => {
  const dflt = compose(kit.defaultDoc, kit);
  for (const x of [null, undefined, 5, "x", [], {}, { skin: 0, hair: 3 }, { v: 1, kit: "test@1" }, { v: 1, kit: "other@2", body: {} }, JSON.parse('{"__proto__":{"v":1}}')]) {
    const p = compose(x as AvatarDoc, kit);
    assert.deepEqual(p.avatar, kit.defaultDoc);
    assert.deepEqual(slotsOf(p.views.front), slotsOf(dflt.views.front));
    assert.ok(p.notes.some(n => n.field === "doc"));
  }
  const r = rng("compose");
  for (let i = 0; i < 300; i++) assert.ok(compose(mutated(r) as AvatarDoc, kit).views.front.length > 3);
});

test("compose draws the normalized document: unknown parts give the default part, colours come from the document, then the part's defaults", () => {
  const p = compose(doc({ hair: { style: "hair_from_the_future", color: "h2" }, outfit: { top: { id: "top_b", colors: ["f5"] }, bottom: "bottom_a", shoes: { id: "shoes_a", colors: ["f3"] } } }), kit);
  assert.equal(p.avatar.hair.style, "hair_a");
  assert.equal(seen.hair_a.hair, PAL.hair.h2);
  assert.deepEqual(seen.top_b.colors, [PAL.fabric.f5]);
  assert.deepEqual(seen.shoes_a.colors, [PAL.fabric.f3, PAL.fabric.f2]);
  assert.deepEqual(seen.bottom_a.colors, [PAL.fabric.f2], "the part's default");
  assert.equal(seen.top_b.garment?.id, "top_b"); assert.equal(seen.base.garment, null); assert.equal(seen.base.clip, null);
  assert.deepEqual(p.avatar, normalize(p.avatar, kit), "Puppet.avatar is the normalized document");
  // hex and custom parts only through trusted documents, and compose trusts nothing unless told to
  assert.deepEqual(compose(doc({ skin: "#112233" }), kit, { trusted: true }).avatar.skin, "#112233");
  assert.deepEqual(compose(doc({ skin: "#112233" }), kit).avatar.skin, "s1", "untrusted by default");
  assert.deepEqual(compose(doc({ skin: "#112233" }), kit, { trusted: false }).avatar.skin, "s1");
  assert.deepEqual(compose(doc({ custom: [{ id: "moustache_a" }] }), kit).avatar.custom, undefined);
  assert.deepEqual(compose(doc({ hair: { style: "hair_cast", color: "h1" } }), kit).avatar.hair.style, "hair_a", "and parts of the cast are refused");
  assert.ok(!hasLayer(compose(doc({ custom: [{ id: "moustache_a" }] }), kit), "custom"));
  assert.ok(hasLayer(compose(doc({ custom: [{ id: "moustache_a" }] }), kit, { trusted: true }), "custom"));
});

test("replaces: a dress is drawn without a top or bottom", () => {
  const p = compose(doc({ outfit: { dress: "dress_a", top: "top_b", bottom: "bottom_b", shoes: "shoes_a" } }), kit);
  assert.ok(hasLayer(p, "dress") && !hasLayer(p, "top") && !hasLayer(p, "bottom") && hasLayer(p, "shoes"));
  assert.ok(p.notes.some(n => n.why === "replaced" && n.field === "outfit.top" && n.by === "dress_a"));
  const q = compose(doc(), kit);
  assert.ok(hasLayer(q, "top") && hasLayer(q, "bottom") && !hasLayer(q, "dress"));
});

test("hides: a scarf hides the hair but not from the document; the hider may itself be hidden", () => {
  const p = compose(doc({ wear: { head: "scarf_a" } }), kit);
  assert.ok(!hasLayer(p, "hair") && hasLayer(p, "head"));
  assert.equal(p.avatar.hair.style, "hair_a");
  assert.deepEqual(p.notes.filter(n => n.why === "hidden"), [{ field: "hair.style", id: "hair_a", why: "hidden", by: "scarf_a" }]);
  const k: Kit = { ...kit, parts: { ...kit.parts, hood_a: part("hood_a", "carry", { hides: ["head"] }), scarf_a: kit.parts.scarf_a } };
  const q = compose(doc({ wear: { head: "scarf_a" }, carry: "hood_a" }), k);
  assert.ok(!hasLayer(q, "head") && !hasLayer(q, "hair"), "a hidden scarf still hides the hair");
  assert.ok(hasLayer(q, "body"), "the base is never hidden");
});

test("clips: the clipping part's region reaches the clipped part in ctx.clip and as Shape.clip on its head pieces", () => {
  const withHair = (id: string, own?: boolean) => {
    const hair = part(id, "hair", {}, "head");
    const k: Kit = { ...kit, parts: { ...kit.parts, [id]: own ? { ...hair, draw: ctx => { const o = hair.draw(ctx); o.front![0].group!.shapes[0].clip = rect(1, 1, 1, 1); return o; } } : hair } };
    return compose(doc({ hair: { style: id, color: "h1" }, wear: { head: "cap_a" } }), k);
  };
  const p = withHair("hair_clipped");
  const hairItems = p.views.front.filter(i => i.layer === "hair");
  assert.equal(hairItems.length, 1);
  const region = seen.hair_clipped.clip;
  assert.ok(region, "the part saw ctx.clip");
  assert.deepEqual(hairItems[0].group!.shapes[0].clip?.bounds(), region!.bounds());
  assert.deepEqual(region!.bounds(), [-30, -30, 30, 30], "from cap_a.clips.keep(ctx), in head-bone cm (headH 50 × 0.6)");
  assert.deepEqual(p.notes.find(n => n.why === "clipped"), { field: "hair.style", id: "hair_clipped", why: "clipped", by: "cap_a" });
  assert.equal(seen.cap_a.clip, null, "the cap itself is not clipped");
  // a part's own clip is kept, and the region cuts it too
  assert.deepEqual(clipsOf(withHair("hair_own", true).views.front.find(i => i.layer === "hair")!.group!.shapes[0]).map(c => c.bounds()), [[1, 1, 2, 2], [-30, -30, 30, 30]]);
  // not on a body without the cap, and not on pieces of other bones
  assert.equal(compose(doc(), kit).views.front.find(i => i.layer === "hair")!.group!.shapes[0].clip, undefined);
  const k: Kit = { ...kit, parts: { ...kit.parts, hair_tail: part("hair_tail", "hair", {}, "spine") } };
  assert.equal(compose(doc({ hair: { style: "hair_tail", color: "h1" }, wear: { head: "cap_a" } }), k).views.front.find(i => i.layer === "hair")!.group!.shapes[0].clip, undefined);
  // the source shape was not changed
  const again = compose(doc({ hair: { style: "hair_a", color: "h1" } }), kit);
  assert.equal(again.views.front.find(i => i.layer === "hair")!.group!.shapes[0].clip, undefined);
});

test("layers sort the pieces, the order of equal layers is the order of the parts", () => {
  const p = compose(doc({ wear: { head: "cap_a", eyes: "glasses_a" }, outfit: { dress: "dress_a", shoes: "shoes_a" } }), kit);
  const ranks = p.views.front.map(i => LAYERS.indexOf(i.layer));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(p.views.back.length, p.views.front.length);
});

// ---- the builder ----------------------------------------------------------------------------------

const build = (start: unknown = null, o: Parameters<typeof createBuilder>[2] = {}) => createBuilder(kit, start, { unlocked: ["specs"], ...o });

test("sections and fields: five sections, labels with an English fallback, fields without a real choice are left out", () => {
  const b = build();
  assert.deepEqual(b.sections().map(s => s.id), ["body", "face", "hair", "clothes", "extras"]);
  assert.equal(b.sections()[0].label, "Body");
  const ids = (s: string) => b.fields(s).map(f => f.id);
  assert.deepEqual(ids("body"), ["body.build", "body.height", "body.shape", "skin"]);
  assert.deepEqual(ids("face"), ["face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.marks", "facialHair"], "ears have one value, so no field");
  assert.deepEqual(ids("hair"), ["hair.style"]);
  assert.deepEqual(ids("clothes"), ["outfit.top", "outfit.bottom", "outfit.dress", "outfit.outer", "outfit.shoes"]);
  assert.deepEqual(ids("extras"), ["wear.head", "wear.eyes", "wear.wrist", "wear.waist"], "no ears, neck or carry parts in this kit");
  assert.deepEqual(b.field("outfit.top"), { id: "outfit.top", section: "clothes", kind: "part", label: "Top", optional: false, colors: 1, hidden: false });
  assert.equal(b.field("face.eyes")!.label, "Eyes", "a label the kit does not give is made from the id");
  assert.equal(b.field("nope"), null); assert.deepEqual(b.fields("nope"), []);
  b.lang = "tr"; assert.equal(b.field("outfit.top")!.label, "Üst"); assert.equal(b.options("outfit.top")[0].label, "üst a"); assert.equal(b.options("outfit.top")[1].label, "top_b", "no name: the id");
  b.lang = "fa"; assert.equal(b.options("outfit.top")[0].label, "Top A", "English is the fallback");
});

test("options are the parts of the slot, none first when optional, cast parts left out, locked ones listed and refused", () => {
  const b = build(null, { unlocked: [] });
  assert.deepEqual(b.options("hair.style").map(o => o.value), ["hair_a", "hair_b"], "hair_cast is reserved");
  assert.deepEqual(b.options("wear.head").map(o => o.value), [null, "scarf_a", "cap_a"]);
  assert.equal(b.options("wear.head")[0].label, "None");
  assert.deepEqual(b.options("wear.eyes"), [{ value: null, label: "None", locked: false }, { value: "glasses_a", label: "glasses_a", locked: true, unlock: "specs" }]);
  assert.equal(b.set("wear.eyes", "glasses_a"), false); assert.equal(b.doc.wear, undefined);
  assert.deepEqual(b.options("outfit.top")[1], { value: "top_b", label: "top_b", locked: false, tags: ["modest"] });
  assert.equal(b.options("outfit.shoes").some(o => o.value === null), false, "a required slot has no none");
  assert.deepEqual(b.options("face.marks").map(o => o.value), ["freckles", "mole"]);
  assert.deepEqual(b.options("facialHair").map(o => o.value), [null, "stubble", "beard_full"]);
  assert.deepEqual(b.options("body.height"), []);
  const open = build(null, { unlocked: id => id === "specs" });
  assert.equal(open.set("wear.eyes", "glasses_a"), true); assert.deepEqual(open.doc.wear, { eyes: { id: "glasses_a" } });
  assert.equal(build(null).set("wear.eyes", "glasses_a"), true, "unlocked as an iterable");
  assert.equal(createBuilder(kit, null).set("wear.eyes", "glasses_a"), false, "nothing is unlocked by default");
  const only = build(null, { builds: ["adult", "child"] });
  assert.deepEqual(only.options("body.build").map(o => o.value), ["adult", "child"]);
  assert.equal(only.set("body.build", "elder"), false); assert.equal(only.set("body.build", "child"), true);
});

test("set refuses what does not fit and changes nothing", () => {
  const b = build();
  const before = serialize(b.doc);
  for (const [f, v] of [["nope", 1], ["body.build", "giant"], ["body.build", null], ["body.height", "tall"], ["body.height", NaN], ["skin", "f1"], ["skin", "#FFFFFF"], ["face.eyes", "x"], ["face.eyes", null], ["face.marks", ["beard"]], ["face.marks", "beard"], ["face.marks", ["mole", "freckles", "mole", "mole", "x"]], ["face.marks", 5], ["face.marks", {}],
    ["hair.style", null], ["hair.style", "top_a"], ["hair.style", "hair_cast"], ["outfit.top", "bottom_a"], ["outfit.top", null], ["outfit.shoes", "__proto__"], ["wear.head", "constructor"], ["facialHair", "afro"]] as const)
    assert.equal(b.set(f, v), false, `${f} ${String(v)}`);
  assert.equal(serialize(b.doc), before);
  assert.equal(b.canUndo, false);
  assert.equal(b.setColor("outfit.top", 0, "s1"), false); assert.equal(b.setColor("outfit.top", 1, "f1"), false); assert.equal(b.setColor("wear.head", 0, "f1"), false, "no part there");
  assert.equal(b.setColor("skin", 0, "f1"), false); assert.equal(b.setColor("facialHair", 0, "h1"), false, "no facial hair");
});

test("set and get: choices, numbers, colours, marks, parts", () => {
  const b = build();
  assert.deepEqual([b.get("body.build"), b.get("body.height"), b.get("face.eyes"), b.get("face.marks"), b.get("facialHair"), b.get("outfit.top"), b.get("hair.style"), b.get("wear.head"), b.get("skin"), b.get("face.eyeColor")],
    ["adult", 0.5, "round", [], null, "top_a", "hair_a", null, "s1", "e1"]);
  assert.ok(b.set("body.build", "child") && b.set("body.shape", "round") && b.set("body.height", 0.123456) && b.set("skin", "s3") && b.set("face.eyes", "almond") && b.set("face.eyeColor", "e2") && b.set("face.marks", ["mole", "freckles"]) && b.set("hair.style", "hair_b"));
  assert.deepEqual(b.doc.body, { build: "child", height: 0.12, shape: "round" });
  assert.equal(b.get("skin"), "s3"); assert.equal(b.get("face.eyeColor"), "e2"); assert.deepEqual(b.get("face.marks"), ["freckles", "mole"]); assert.equal(b.doc.face.eyes, "almond");
  assert.ok(b.set("face.eyes", "round")); assert.equal(b.doc.face.eyes, undefined, "a default is left out of the document");
  assert.ok(b.set("outfit.top", "top_b")); assert.deepEqual(b.doc.outfit.top, { id: "top_b" });
  assert.ok(b.set("wear.head", "cap_a") && b.set("wear.head", null)); assert.equal(b.doc.wear, undefined);
  assert.equal(b.set("facialHair", "stubble"), false, "not for a child");
  assert.ok(b.set("body.build", "elder") && b.set("facialHair", "stubble") && b.setColor("facialHair", 0, "h2")); assert.deepEqual(b.doc.facialHair, { style: "stubble", color: "h2" });
  assert.ok(b.set("facialHair", "beard_full")); assert.deepEqual(b.doc.facialHair, { style: "beard_full", color: "h2" }, "the colour stays");
  assert.ok(b.set("facialHair", null)); assert.equal(b.doc.facialHair, undefined);
  assert.ok(Object.isFrozen(b.doc) && Object.isFrozen(b.doc.outfit));
  assert.equal(new TextEncoder().encode(serialize(b.doc)).length <= AVATAR_MAX_BYTES, true);
});

test("a child cannot have facial hair", () => {
  const b = build();
  assert.ok(b.set("facialHair", "stubble"));
  assert.ok(b.fields("face").some(f => f.id === "facialHair"));
  assert.ok(b.set("body.build", "toddler")); assert.equal(b.doc.facialHair, undefined);
  assert.ok(!b.fields("face").some(f => f.id === "facialHair"));
  assert.equal(b.set("facialHair", "stubble"), false);
  assert.ok(b.set("body.build", "elder") && b.set("facialHair", "stubble"));
});

test("colours: options come from the part's palette, a change keeps the earlier defaults, a new part keeps the colours it can", () => {
  const b = build();
  assert.deepEqual(b.colorOptions("skin").map(c => c.id), ["s1", "s2", "s3"]);
  assert.deepEqual(b.colorOptions("skin")[0], { id: "s1", hex: "#F7DCC9", label: "Colour 1" });
  assert.deepEqual(b.colorOptions("hair.style").map(c => c.id), ["h1", "h2", "h3"]);
  assert.deepEqual(b.colorOptions("outfit.top").map(c => c.id), Object.keys(PAL.fabric));
  assert.deepEqual(b.colorOptions("outfit.top", 1), []); assert.deepEqual(b.colorOptions("outfit.shoes", 1).length, 6); assert.deepEqual(b.colorOptions("wear.head", 0), []);
  assert.equal(b.getColor("outfit.top"), "f1", "the part's default"); assert.equal(b.getColor("hair.style"), "h1"); assert.equal(b.getColor("facialHair"), null); assert.equal(b.getColor("skin"), "s1");
  assert.ok(b.setColor("outfit.shoes", 1, "f5")); assert.deepEqual(b.doc.outfit.shoes, { id: "shoes_a", colors: ["f1", "f5"] }, "the first colour is written out as the default it was");
  assert.ok(b.setColor("outfit.top", 0, "f3")); assert.equal(b.getColor("outfit.top"), "f3");
  assert.ok(b.setColor("hair.style", 0, "h3")); assert.equal(b.doc.hair.color, "h3");
  assert.ok(b.setColor("skin", 0, "s2")); assert.equal(b.doc.skin, "s2");
  assert.ok(b.set("outfit.top", "top_b")); assert.deepEqual(b.doc.outfit.top, { id: "top_b", colors: ["f3"] }, "the colour the learner chose goes with them to the next top");
  assert.ok(b.setColor("wear.wrist", 0, "f5") === false);
  assert.ok(b.set("wear.wrist", "watch_a")); assert.ok(b.setColor("wear.wrist", 1, "s3")); assert.deepEqual(b.doc.wear?.wrist, { id: "watch_a", colors: ["f1", "s3"] });
  assert.equal(b.setColor("wear.wrist", 1, "f3"), false, "a fabric colour is not a skin colour");
  b.set("wear.wrist", null); b.set("wear.wrist", "watch_a"); assert.deepEqual(b.doc.wear?.wrist, { id: "watch_a" }, "colours of a removed part are forgotten");
});

test("a dress clears top and bottom, a top clears the dress, and what was cleared comes back", () => {
  const b = build(doc({ outfit: { top: { id: "top_b", colors: ["f3"] }, bottom: { id: "bottom_b" }, shoes: "shoes_a" } }));
  assert.ok(b.set("outfit.dress", "dress_a"));
  assert.deepEqual(b.doc.outfit, { dress: { id: "dress_a" }, shoes: { id: "shoes_a" } });
  assert.equal(b.get("outfit.top"), null, "nothing is worn in the top slot");
  assert.deepEqual(b.options("outfit.top").map(o => o.value), ["top_a", "top_b"], "tops are still offered");
  assert.ok(b.set("outfit.dress", null));
  assert.deepEqual(b.doc.outfit, { bottom: { id: "bottom_b" }, top: { id: "top_b", colors: ["f3"] }, shoes: { id: "shoes_a" } }, "taking the dress off brings the old clothes back");
  assert.ok(b.set("outfit.dress", "dress_a") && b.set("outfit.top", "top_a"));
  assert.deepEqual(b.doc.outfit, { bottom: { id: "bottom_b" }, top: { id: "top_a" }, shoes: { id: "shoes_a" } }, "a top clears the dress, and the old bottom returns");
  assert.ok(b.set("outfit.dress", "dress_a") && b.set("outfit.bottom", "bottom_a"));
  assert.deepEqual(b.doc.outfit, { bottom: { id: "bottom_a" }, top: { id: "top_a" }, shoes: { id: "shoes_a" } }, "a bottom clears the dress too; the top that was worn before it returns");
  assert.ok(b.set("outfit.dress", "dress_a") && b.set("outfit.dress", null) && b.set("outfit.dress", null));
  const fresh = build(); b.reset(); assert.deepEqual(b.doc, doc({ outfit: { top: { id: "top_b", colors: ["f3"] }, bottom: { id: "bottom_b" }, shoes: { id: "shoes_a" } } }));
  assert.ok(fresh.set("outfit.dress", "dress_a") && fresh.set("outfit.dress", null));
  assert.deepEqual(fresh.doc, kit.defaultDoc, "from the default, back to the default");
  assert.equal(fresh.set("outfit.top", null), false);
});

test("a headscarf keeps the hair in the document, and says the hair is hidden", () => {
  const b = build(doc({ hair: { style: "hair_b", color: "h2" } }));
  assert.ok(b.set("wear.head", "scarf_a"));
  assert.deepEqual(b.doc.hair, { style: "hair_b", color: "h2" });
  assert.equal(b.field("hair.style")!.hidden, true); assert.equal(b.field("wear.head")!.hidden, false);
  assert.ok(b.set("hair.style", "hair_a")); assert.equal(b.field("hair.style")!.hidden, true);
  assert.ok(b.set("wear.head", null)); assert.equal(b.field("hair.style")!.hidden, false);
  assert.equal(b.get("hair.style"), "hair_a");
  assert.ok(b.set("wear.head", "cap_a")); assert.equal(b.field("hair.style")!.hidden, false, "a cap clips, it does not hide");
});

test("undo, redo, reset and subscribe", () => {
  const b = build(), seenDocs: AvatarDoc[] = [];
  const off = b.subscribe(d => seenDocs.push(d));
  assert.equal(b.canUndo, false); assert.equal(b.undo(), false); assert.equal(b.redo(), false);
  b.set("skin", "s2"); b.set("skin", "s2"); b.set("hair.style", "hair_b");
  assert.equal(seenDocs.length, 2, "a change that changes nothing is not a step");
  assert.ok(b.canUndo && !b.canRedo);
  assert.ok(b.undo()); assert.equal(b.doc.hair.style, "hair_a"); assert.equal(b.doc.skin, "s2"); assert.ok(b.canRedo);
  assert.ok(b.undo()); assert.equal(b.doc.skin, "s1");
  assert.ok(b.redo() && b.redo()); assert.equal(b.doc.hair.style, "hair_b"); assert.equal(b.redo(), false);
  b.undo(); b.set("skin", "s3");
  assert.equal(b.canRedo, false, "a new change ends the redo line");
  assert.equal(seenDocs.length, 8, "two changes, two undos, two redos, an undo and a change");
  b.reset(); assert.deepEqual(b.doc, kit.defaultDoc); assert.ok(b.undo()); assert.equal(b.doc.skin, "s3", "reset can be undone");
  const calls = seenDocs.length;
  off(); b.set("skin", "s1"); assert.equal(seenDocs.length, calls, "no more calls after unsubscribing");
  const many = build();
  for (let i = 0; i < 150; i++) many.set("body.height", (i % 99) / 100);
  let n = 0; while (many.undo()) n++;
  assert.ok(n <= 100, `the history is capped (${n})`);
});

test("the builder starts from a document, the default, or whatever is left of a bad one", () => {
  assert.deepEqual(build().doc, kit.defaultDoc);
  assert.deepEqual(build({ skin: 0, hair: 3 }).doc, kit.defaultDoc, "an old char starts a new character");
  assert.deepEqual(build(doc({ skin: "s3", wear: { head: "nope" }, outfit: { top: "top_b" } })).doc, doc({ skin: "s3", outfit: { top: { id: "top_b" }, bottom: { id: "bottom_a" }, shoes: { id: "shoes_a" } } }));
  assert.equal(build(doc({ skin: "#112233" })).doc.skin, "s1"); assert.equal(build(doc({ skin: "#112233" }), { trusted: true }).doc.skin, "#112233");
});

// ---- randomize --------------------------------------------------------------------------------------

/** The colour family of the first colour of the part in a field. */
const family = (d: AvatarDoc, field: "top" | "bottom" | "dress" | "outer") => {
  const g = d.outfit[field];
  return g ? FAMILY[g.colors?.[0] ?? kit.parts[g.id].defaults![0]] : undefined;
};

test("randomize: 500 seeds give valid, varied documents that respect builds, distinct colours and modest options", () => {
  const b = build(null, { builds: ["adult", "elder", "child"], unlocked: [] });
  const stat = { dress: 0, scarf: 0, longSkirt: 0, modestTop: 0, beard: 0, kidBeard: 0, locked: 0, builds: new Set<string>(), hashes: new Set<string>(), dupe: 0 };
  for (let seed = 0; seed < 500; seed++) {
    b.randomize(seed);
    const d = b.doc;
    assert.deepEqual(normalize(d, kit), d, `seed ${seed}: a document that normalizes to itself`);
    assert.ok(new TextEncoder().encode(serialize(d)).length <= AVATAR_MAX_BYTES);
    const p = compose(d, kit, { trusted: false });
    assert.equal(p.notes.filter(n => n.why === "unknown" || n.why === "slot").length, 0);
    assert.ok(p.views.front.length >= 3);
    stat.builds.add(d.body.build); stat.hashes.add(docHash(d));
    if (d.outfit.dress) stat.dress++;
    if (d.wear?.eyes) stat.locked++;
    if (d.wear?.head?.id === "scarf_a") stat.scarf++;
    if (d.outfit.bottom?.id === "bottom_b") stat.longSkirt++;
    if (d.outfit.top?.id === "top_b") stat.modestTop++;
    if (d.facialHair) { stat.beard++; if (d.body.build === "child") stat.kidBeard++; }
    const fams = (["dress", "top", "bottom", "outer"] as const).map(f => family(d, f)).filter(Boolean);
    if (new Set(fams).size !== fams.length) stat.dupe++;
  }
  assert.deepEqual([...stat.builds].sort(), ["adult", "child", "elder"], "builds are respected: no toddlers when they are not offered");
  assert.ok(stat.hashes.size > 495, `varied (${stat.hashes.size})`);
  assert.equal(stat.dupe, 0, "an outfit's dominant colours are of different families");
  assert.equal(stat.kidBeard, 0, "no children with beards");
  assert.ok(stat.beard > 40 && stat.beard < 160, `facial hair now and then (${stat.beard})`);
  assert.ok(stat.dress > 40 && stat.dress < 160, `dresses about one in five (${stat.dress})`);
  assert.ok(stat.scarf > 25, `modest options have fair odds: scarves ${stat.scarf}, long skirts ${stat.longSkirt}, modest tops ${stat.modestTop}`);
  assert.ok(stat.longSkirt > 100 && stat.modestTop > 100);
  assert.equal(stat.locked, 0, "locked items never appear: glasses are locked without the unlock");
  const open = build(), glasses = Array.from({ length: 200 }, (_, i) => (open.randomize(i), open.doc.wear?.eyes?.id)).filter(Boolean).length;
  assert.ok(glasses > 20, `and they do once unlocked (${glasses})`);
});

test("randomize is deterministic per seed, undoable, notifies once, and keeps what it is told to", () => {
  const a = build(), b = build();
  a.randomize("same"); b.randomize("same");
  assert.deepEqual(a.doc, b.doc);
  const c = build(); c.randomize("other"); assert.notDeepEqual(a.doc, c.doc);
  let calls = 0; a.subscribe(() => calls++);
  const before = a.doc;
  a.randomize(5); assert.equal(calls, 1); assert.ok(a.undo()); assert.deepEqual(a.doc, before);
  const k = build(doc({ skin: "s3", body: { build: "elder", height: 0.9, shape: "slim" }, hair: { style: "hair_b", color: "h3" }, outfit: { top: { id: "top_b", colors: ["f4"] }, bottom: "bottom_b", shoes: "shoes_a" }, facialHair: { style: "stubble" } }));
  const kept = structuredClone(k.doc);
  for (let seed = 0; seed < 60; seed++) {
    k.randomize(seed, { keep: ["body", "hair.style", "outfit.top", "facialHair"] });
    assert.deepEqual([k.doc.body, k.doc.skin, k.doc.hair, k.doc.outfit.top, k.doc.facialHair], [kept.body, kept.skin, kept.hair, kept.outfit.top, kept.facialHair]);
    assert.ok(!k.doc.outfit.dress, "a kept top is not replaced by a random dress");
  }
  const j = build(doc({ face: { eyes: "almond", marks: ["mole"] } }));
  j.randomize(3, { keep: ["face"] }); assert.deepEqual([j.doc.face.eyes, j.doc.face.marks], ["almond", ["mole"]]);
  const dressed = build(doc({ outfit: { dress: "dress_a", shoes: "shoes_a" } }));
  for (let seed = 0; seed < 30; seed++) { dressed.randomize(seed, { keep: ["outfit.dress"] }); assert.deepEqual(dressed.doc.outfit.dress, { id: "dress_a" }); assert.equal(dressed.doc.outfit.top, undefined); }
  // a kept coat's colour family is avoided by the new top and bottom
  const coated = build(doc({ outfit: { top: "top_a", bottom: "bottom_a", outer: { id: "coat_a", colors: ["f3"] }, shoes: "shoes_a" } }));
  for (let seed = 0; seed < 50; seed++) { coated.randomize(seed, { keep: ["outfit.outer"] }); assert.notEqual(family(coated.doc, "top"), "red"); assert.notEqual(family(coated.doc, "bottom"), "red"); }
});

test("randomize respects a builder with every part locked or missing", () => {
  const bare: Kit = { ...kit, parts: Object.fromEntries(Object.entries(kit.parts).filter(([, p]) => ["hair", "top", "bottom", "shoes"].includes(p.slot) && !p.tags?.includes("cast"))) };
  const b = createBuilder(bare, null, { builds: [] as Build[] });
  for (let i = 0; i < 50; i++) { b.randomize(i); assert.deepEqual(normalize(b.doc, bare), b.doc); assert.equal(b.doc.wear, undefined); assert.equal(b.doc.outfit.dress, undefined); }
});

// ---- the builder: history, previews, lists ---------------------------------------------------------

test("what a dress cleared comes back after undo, redo, randomize and reset too", () => {
  const worn = { top: { id: "top_b", colors: ["f3"] }, bottom: { id: "bottom_b" }, shoes: { id: "shoes_a" } };
  const fresh = () => build(doc({ outfit: structuredClone(worn) }));
  const back = (b: ReturnType<typeof build>, extra: object = {}) => { assert.ok(b.set("outfit.dress", null)); assert.deepEqual(b.doc.outfit, { ...worn, ...extra }); };
  // a coat is added over the dress, then taken back by undo: the dress still remembers the clothes
  let b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a") && b.set("outfit.outer", "coat_a") && b.undo());
  assert.ok(b.set("outfit.top", "top_a"));
  assert.deepEqual(b.doc.outfit, { top: { id: "top_a" }, bottom: { id: "bottom_b" }, shoes: { id: "shoes_a" } }, "the old bottom returns after an undo");
  b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a") && b.undo() && b.redo()); back(b);
  b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a")); b.randomize(1); assert.ok(b.undo()); back(b);
  b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a")); b.reset(); assert.ok(b.undo()); back(b);
  // undo all the way and redo all the way
  b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a") && b.set("outfit.outer", "coat_a") && b.set("skin", "s3"));
  while (b.undo());
  assert.deepEqual(b.doc.outfit, worn);
  while (b.redo());
  assert.equal(b.doc.skin, "s3"); back(b, { outer: { id: "coat_a" } });
  // a refused change and a preview leave the memory alone
  b = fresh();
  assert.ok(b.set("outfit.dress", "dress_a"));
  assert.equal(b.set("outfit.top", "nope"), false); assert.ok(b.preview("outfit.top", "top_a")); back(b);
});

test("preview is the document set would make, and nothing else changes", () => {
  const starts = [null, doc({ outfit: { dress: "dress_a", shoes: "shoes_a" }, wear: { head: "scarf_a" } }), doc({ body: { build: "child", height: 0.2, shape: "slim" } }), doc({ body: { build: "elder", height: 0.9, shape: "round" }, facialHair: { style: "stubble" }, face: { marks: ["mole"] } })];
  const fields = ["body.build", "body.height", "body.shape", "skin", "face.shape", "face.eyes", "face.eyeColor", "face.marks", "facialHair", "hair.style", "outfit.top", "outfit.bottom", "outfit.dress", "outfit.outer", "outfit.shoes", "wear.head", "wear.eyes", "wear.wrist", "wear.waist"];
  const values = [null, 0.3, "child", "elder", "round", "almond", "s2", "e2", "mole", "freckles", ["mole"], "stubble", "hair_b", "top_a", "top_b", "bottom_b", "dress_a", "coat_a", "shoes_b", "scarf_a", "cap_a", "glasses_a", "watch_a", "apron_a", "nope", 7];
  let accepted = 0, refused = 0;
  for (const start of starts) for (const f of fields) for (const v of values) {
    const b = build(start), c = build(start), calls: unknown[] = [];
    b.subscribe(d => calls.push(d));
    const before = serialize(b.doc), p = b.preview(f, v), ok = c.set(f, v);
    assert.equal(p !== null, ok, `${f} ${JSON.stringify(v)}`);
    if (p) { assert.deepEqual(p, c.doc); accepted++; } else refused++;
    assert.equal(serialize(b.doc), before); assert.equal(calls.length, 0); assert.equal(b.canUndo, false);
  }
  assert.ok(accepted > 100 && refused > 1000, `${accepted} accepted, ${refused} refused`);
  const b = build();
  assert.deepEqual(b.preview("outfit.dress", "dress_a")!.outfit, { dress: { id: "dress_a" }, shoes: { id: "shoes_a" } });
  assert.equal(b.preview("wear.eyes", "glasses_a")!.wear?.eyes?.id, "glasses_a");
  assert.equal(createBuilder(kit, null).preview("wear.eyes", "glasses_a"), null, "a locked option previews as refused");
});

test("every option a field lists is a value set accepts; a list field toggles one value or takes a whole list", () => {
  const starts = [null, doc({ body: { build: "elder", height: 0.5, shape: "average" } })];
  for (const start of starts) {
    const b = build(start);
    for (const sec of b.sections()) for (const f of b.fields(sec.id)) for (const o of b.options(f.id)) {
      assert.equal(build(start).set(f.id, o.value), true, `${f.id} = ${o.value}`);
    }
  }
  const k3: Kit = { ...kit, features: { ...kit.features, "face.marks": choice(["freckles", "mole", "scar"], null, { max: 2 }) } };
  const b = createBuilder(k3, null);
  assert.equal(b.field("face.marks")!.kind, "multi"); assert.equal(b.field("face.marks")!.max, 2);
  assert.ok(b.set("face.marks", "scar") && b.set("face.marks", "freckles"));
  assert.deepEqual(b.get("face.marks"), ["freckles", "scar"], "in the kit's order");
  assert.equal(b.set("face.marks", "mole"), false, "full"); assert.deepEqual(b.get("face.marks"), ["freckles", "scar"]);
  assert.ok(b.set("face.marks", "freckles")); assert.deepEqual(b.get("face.marks"), ["scar"], "the same value again takes it off");
  assert.ok(b.set("face.marks", ["mole", "scar"])); assert.deepEqual(b.get("face.marks"), ["mole", "scar"]);
  assert.equal(b.set("face.marks", ["mole", "scar", "freckles"]), false);
  assert.ok(b.set("face.marks", [])); assert.equal(b.doc.face.marks, undefined);
  assert.ok(b.set("face.marks", ["mole"]) && b.set("face.marks", null)); assert.equal(b.doc.face.marks, undefined);
  assert.equal(b.set("face.marks", null), true, "emptying an empty list is accepted and changes nothing"); assert.equal(b.canRedo, false);
  assert.equal(createBuilder(kit, null).field("face.marks")!.max, 2, "the default cap is the kit's");
});

test("changing the language notifies subscribers once, and only when it changes", () => {
  const b = build(), seenDocs: AvatarDoc[] = [];
  b.subscribe(d => seenDocs.push(d));
  b.lang = "tr"; assert.equal(seenDocs.length, 1); assert.equal(seenDocs[0], b.doc);
  b.lang = "tr"; assert.equal(seenDocs.length, 1);
  assert.equal(b.canUndo, false, "and it is not a step of the history");
});

test("randomize: modest parts get 30% of a slot's picks, or their natural share when that is more", () => {
  const share = (modest: number, plain: number) => {
    const parts: Record<string, PartDef> = { ...kit.parts };
    for (const id of Object.keys(parts)) if (parts[id].slot === "top") delete parts[id];
    for (let i = 0; i < modest + plain; i++) { const id = `top_${i < modest ? "m" : "p"}${i}`; parts[id] = part(id, "top", { colors: 1, defaults: ["f1"], tags: i < modest ? ["modest"] : [] }, "spine"); }
    const k: Kit = { ...kit, parts, defaultDoc: { ...kit.defaultDoc, outfit: { ...kit.defaultDoc.outfit, top: { id: "top_p" + modest } } } };
    const b = createBuilder(k, null);
    let n = 0, m = 0;
    for (let seed = 0; seed < 2500; seed++) { b.randomize(seed); const t = b.doc.outfit.top?.id; if (t) { n++; if (t.startsWith("top_m")) m++; } }
    return m / n;
  };
  const rare = share(1, 9), many = share(9, 1), even = share(2, 3);
  assert.ok(rare > 0.25 && rare < 0.35, `one modest top in ten gets about 30% (${rare.toFixed(3)}), not 37%`);
  assert.ok(many > 0.84 && many < 0.92, `nine in ten stay about nine in ten (${many.toFixed(3)}), not 93%`);
  assert.ok(even > 0.35 && even < 0.45, `two in five get their share of 40% (${even.toFixed(3)})`);
});

test("randomize: parts and colours have odds, per build; zero means never; all zero still picks", () => {
  const k: Kit = {
    ...kit, parts: { ...kit.parts, hair_b: { ...kit.parts.hair_b, odds: { child: 0, toddler: 0, adult: 3 } } },
    odds: { h3: { child: 0, toddler: 0 }, h2: 0.5, h1: -1 },
  };
  const b = createBuilder(k, null), c: Record<string, number> = {};
  const inc = (key: string) => { c[key] = (c[key] ?? 0) + 1; };
  for (let seed = 0; seed < 1500; seed++) {
    b.randomize(seed);
    const d = b.doc, kid = d.body.build === "child" || d.body.build === "toddler";
    inc(`${d.body.build === "adult" ? "adult" : kid ? "kid" : "elder"}`);
    if (kid) { assert.notEqual(d.hair.style, "hair_b", `seed ${seed}`); assert.notEqual(d.hair.color, "h3", `seed ${seed}`); }
    if (d.body.build === "adult") inc(`adult ${d.hair.style}`);
    if (d.body.build === "elder") inc(`elder ${d.hair.style}`);
    if (!kid) inc(`color ${d.hair.color}`);
    assert.notEqual(d.hair.color, "h1", "a negative odds is zero");
  }
  assert.ok(c["adult hair_b"] / c.adult > 0.7 && c["adult hair_b"] / c.adult < 0.8, `three to one among adults (${c["adult hair_b"]} of ${c.adult})`);
  assert.ok(c["elder hair_b"] / c.elder > 0.4 && c["elder hair_b"] / c.elder < 0.6, `even among elders (${c["elder hair_b"]} of ${c.elder})`);
  assert.ok(c["color h2"] > 100 && c["color h3"] > 1.6 * c["color h2"] && c["color h3"] < 2.5 * c["color h2"], `among grown-ups the half-odds colour turns up half as often (${c["color h2"]} to ${c["color h3"]})`);
  // a learner can still pick what the randomiser avoids
  const kidB = createBuilder(k, doc({ body: { build: "child", height: 0.3, shape: "slim" } }));
  assert.ok(kidB.set("hair.style", "hair_b") && kidB.setColor("hair.style", 0, "h3"));
  // every part at zero odds for a build: an even pick, not a crash
  const zero: Kit = { ...kit, parts: Object.fromEntries(Object.entries(kit.parts).map(([id, p]) => [id, p.slot === "hair" ? { ...p, odds: 0 } : p])) };
  const z = createBuilder(zero, null);
  for (let seed = 0; seed < 50; seed++) { z.randomize(seed); assert.deepEqual(normalize(z.doc, zero), z.doc); }
  assert.ok(new Set(Array.from({ length: 80 }, (_, i) => (z.randomize(i), z.doc.hair.style))).size === 2, "both hair parts turn up");
});

test("randomize keeps the build it is told to keep, and decides on facial hair and odds by it", () => {
  const b = build(doc({ body: { build: "elder", height: 0.5, shape: "average" } }));
  let beards = 0;
  for (let seed = 0; seed < 300; seed++) { b.randomize(seed, { keep: ["body.build"] }); assert.equal(b.doc.body.build, "elder"); if (b.doc.facialHair) beards++; }
  assert.ok(beards > 45 && beards < 90, `an elder gets facial hair 22% of the time (${beards} of 300)`);
  const kid = build(doc({ body: { build: "child", height: 0.3, shape: "slim" } }));
  for (let seed = 0; seed < 100; seed++) { kid.randomize(seed, { keep: ["body"] }); assert.equal(kid.doc.body.build, "child"); assert.equal(kid.doc.facialHair, undefined); }
});

// ---- what a host offers: a starter set, "more", and the author's cast parts ----------------------------

test("offer: a host's starter set narrows options, colours and set, keeps the current value, and more() widens one field", () => {
  const offer = (field: string, v: string, kind: string) => (kind === "color" ? v !== "f3" : field === "outfit.top" ? v === "top_b" : field === "hair.style" ? v === "hair_b" : true);
  const b = build(null, { offer });
  assert.deepEqual(b.options("outfit.top").map(o => o.value), ["top_a", "top_b"], "top_a is the current value, so it is listed");
  assert.deepEqual(b.options("hair.style").map(o => o.value), ["hair_a", "hair_b"]);
  assert.equal(b.colorOptions("outfit.top").some(c => c.id === "f3"), false, "a colour not offered is absent");
  assert.equal(b.colorOptions("outfit.top").find(c => c.id === "f4")?.label, "Colour 4", "fallback names keep the palette's numbering");
  assert.equal(b.setColor("outfit.top", 0, "f3"), false, "and refused");
  assert.equal(b.set("outfit.top", "top_b"), true);
  assert.deepEqual(b.options("outfit.top").map(o => o.value), ["top_b"], "the old value goes once it is not current");
  assert.equal(b.set("outfit.top", "top_a"), false, "a part not offered is refused");
  assert.equal(b.hasMore("outfit.top"), true);
  let n = 0; b.subscribe(() => n++);
  b.more("outfit.top");
  assert.equal(n, 1, "more() notifies");
  assert.deepEqual(b.options("outfit.top").map(o => o.value), ["top_a", "top_b"]);
  assert.equal(b.hasMore("outfit.top"), false);
  assert.equal(b.hasMore("hair.style"), false, "hair_a is current, so nothing is held back yet");
  assert.equal(build(null).hasMore("outfit.top"), false, "without an offer nothing is held back");
});

test("offer: the randomiser picks only what is offered", () => {
  const b = build(null, { offer: (f, v, kind) => (kind === "color" ? ["f2", "f4", "s2", "h2", "e2"].includes(v) : f === "outfit.top" ? v === "top_b" : f === "outfit.dress" ? false : f === "face.shape" ? v === "round" : true) });
  for (let i = 0; i < 40; i++) {
    b.randomize(i);
    const d = b.doc;
    assert.equal(d.outfit.dress, undefined);
    assert.equal(d.outfit.top?.id, "top_b");
    assert.ok(["f2", "f4", undefined].includes(d.outfit.top?.colors?.[0]), String(d.outfit.top?.colors));
    assert.equal(d.skin, "s2"); assert.equal(d.hair.color, "h2"); assert.equal(d.face.shape, "round");
  }
});

test("cast: an author is offered the cast's parts, marked reserved, which the randomiser leaves out", () => {
  const b = build(null, { cast: true, trusted: true });
  const cast = b.options("hair.style").find(o => o.value === "hair_cast");
  assert.deepEqual(cast?.reserved, "cast");
  assert.equal(b.options("hair.style").find(o => o.value === "hair_a")?.reserved, undefined);
  assert.equal(b.set("hair.style", "hair_cast"), true);
  assert.equal(b.doc.hair.style, "hair_cast", "a trusted document keeps it");
  for (let i = 0; i < 30; i++) { b.randomize(i); assert.notEqual(b.doc.hair.style, "hair_cast"); }
  assert.equal(build(null).set("hair.style", "hair_cast"), false, "a learner cannot pick it");
});

// ---- looks: clothes change, the body stays (DESIGN.md §5.2)

test("applyLook changes only the slots it names; null takes one off; the body is never touched", () => {
  const base: AvatarDoc = { ...doc(), outfit: { top: { id: "top_a", colors: ["f2"] }, bottom: { id: "bot_a" }, outer: { id: "coat" }, shoes: { id: "shoe" } }, wear: { eyes: { id: "glasses" } } };
  assert.equal(applyLook(base, {}), base, "an empty look is the document itself");
  assert.equal(applyLook(base, undefined), base);
  const coatOff = applyLook(base, { outfit: { outer: null } });
  assert.equal(coatOff.outfit.outer, undefined);
  assert.deepEqual(coatOff.outfit.top, base.outfit.top);
  assert.deepEqual(base.outfit.outer, { id: "coat" }, "pure: the base keeps its coat");
  const hat = applyLook(base, { wear: { hat: "cap", eyes: null }, carry: "tote" });
  assert.deepEqual([hat.wear, hat.carry], [{ hat: { id: "cap" } }, { id: "tote" }]);
  assert.equal(applyLook(base, { wear: { eyes: null } }).wear, undefined, "an emptied wear goes");
  // anything that is not clothing is ignored: hair, body, skin
  const sneaky = applyLook(base, { hair: { style: "bald" }, body: { height: 3 }, skin: "s3", outfit: { top: "top_b" } } as never);
  assert.deepEqual([sneaky.hair, sneaky.body, sneaky.skin, sneaky.outfit.top], [base.hair, base.body, base.skin, { id: "top_b" }]);
  assert.deepEqual(lookFields({ hair: 1, outfit: { outer: null, cape: "x" }, wear: { hat: "cap" } }), { clothing: { "outfit.outer": null, "wear.hat": "cap" }, other: ["hair", "outfit.cape"] });
});

test("CLOTHING_FIELDS are the garment fields but the hair", () => {
  assert.deepEqual([...CLOTHING_FIELDS].sort(), GARMENT_FIELDS.map(g => g.field).filter(f => f !== "hair.style").sort());
});
