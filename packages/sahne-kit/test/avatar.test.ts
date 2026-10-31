// The first kit's avatar contract: its parts and vocabularies are described, the lists match
// what the drawing code knows, the default and the gallery's characters are good documents, and
// the builder works on the real parts (and on a kit that has every slot filled). The kit grows by
// artists adding parts in parallel, so what is checked here holds for any number of parts: lists
// of the first kit's parts are subsets, counts come from the palettes, odds from the tags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compose, groupBounds, rect, rng, NEUTRAL_FACE, type AvatarDoc, type Build, type BodyShape, type Item, type Kit, type PartDef } from "sahne";
import kit, { FAMILIES, PART_FILES } from "../src/index.ts";
import { headPath } from "../src/draw/head.ts";
import { faceStyle, draw as drawFace } from "../src/face.ts";
import { color, PALETTES, LENS_ALPHA, HAIR_BROW } from "../src/palette.ts";
import { normalize, serialize, docHash, manifestOf, AVATAR_MAX_BYTES } from "../../sahne/src/avatar/normalize.ts";
import { createBuilder, type Builder } from "../../sahne/src/avatar/builder.ts";
import { GARMENT_FIELDS } from "../../sahne/src/avatar/rules.ts";
import { NIMA, ISMAIL } from "../../sahne-gallery/src/bakkal.ts";

const BUILDS: Build[] = ["adult", "elder", "child", "toddler"];
const SHAPES: BodyShape[] = ["slim", "average", "broad", "round"];
const SLOTS = new Set(GARMENT_FIELDS.map(g => g.slot));
const bytes = (d: AvatarDoc) => new TextEncoder().encode(serialize(d)).length;
const all = () => true;
const CAST = { trusted: true };

// ---- the parts describe themselves ----------------------------------------------------------------

test("part ids are unique across the kit's files", () => {
  const seen = new Map<string, string>();
  for (const [file, parts] of Object.entries(PART_FILES)) for (const id of Object.keys(parts)) {
    assert.ok(!seen.has(id), `${id} is in ${seen.get(id)} and ${file}`);
    seen.set(id, file);
  }
  assert.equal(Object.keys(kit.parts).length, seen.size);
});

test("every part has English and Turkish names, a known slot, and colours that agree with their palettes and defaults", () => {
  for (const [id, p] of Object.entries(kit.parts)) {
    assert.ok(p.names?.en && p.names?.tr, `${id}: names in en and tr`);
    assert.equal(p.name, p.names!.en, `${id}: name is the English name`);
    assert.ok(SLOTS.has(p.slot), `${id}: slot ${p.slot} is one of the engine's`);
    assert.match(id, /^[a-z]+_[a-z_]+$/, `${id}: <kind>_<variant>, which need not start with the slot's name (glasses_round is in eyes)`);
    const n = p.colors ?? 0, d = p.defaults ?? [];
    assert.ok(d.length <= n, `${id}: no more defaults than colours`);
    if (n) assert.ok(d.length >= 1, `${id}: the first colour has a default`);
    assert.ok((p.palettes ?? []).length <= n);
    d.forEach((c, i) => assert.ok(Object.hasOwn(kit.palettes[p.palettes?.[i] ?? "fabric"], c), `${id}: default ${c} is in its palette`));
    for (const t of p.tags ?? []) assert.match(t, /^[a-z]+$/);
    for (const s of [...(p.hides ?? []), ...(p.replaces ?? []), ...(p.over ?? []), ...(p.clips?.slots ?? [])]) assert.ok(SLOTS.has(s), `${id}: rule names slot ${s}`);
  }
  const replacers = new Set(Object.values(kit.parts).filter(p => p.replaces).map(p => p.slot));
  for (const p of Object.values(kit.parts)) for (const s of p.replaces ?? []) assert.ok(!replacers.has(s), "replaces goes one level deep");
});

test("the A1 words for the first kit's parts", () => {
  const tr = Object.fromEntries(Object.entries(kit.parts).map(([id, p]) => [id, p.names!.tr]));
  const first = {
    hair_short: "kısa", hair_classic: "klasik", hair_buzz: "çok kısa", hair_bob: "bob", hair_long: "uzun", hair_bun: "topuz", hair_curly: "kıvırcık", hair_bald: "kel",
    top_tee: "tişört", top_shirt: "gömlek", top_shirt_rolled: "kıvrık kollu gömlek", top_sweater: "kazak", top_blouse: "bluz",
    bottom_trousers: "pantolon", bottom_jeans: "kot pantolon", bottom_skirt_long: "uzun etek",
    shoes_sneakers: "spor ayakkabı", shoes_leather: "ayakkabı", shoes_flats: "babet",
    glasses_round: "gözlük", apron_shop: "önlük", headscarf_wrap: "başörtüsü",
  };
  // the course word, or the course word after a qualifier that tells similar parts apart ("yuvarlak gözlük")
  for (const [id, word] of Object.entries(first)) assert.ok(tr[id] === word || tr[id].endsWith(" " + word), `${id} keeps its course word: ${tr[id]}`);
  for (const id of ["bottom_skirt_long", "headscarf_wrap", "top_shirt", "top_sweater"]) assert.ok(kit.parts[id].tags?.includes("modest"), `${id} stays modest`);
});

test("palettes: strict colours, own ids only, a family for every fabric", () => {
  assert.equal(color("skin_04"), "#DCA27A"); assert.equal(color("#a1b2c3"), "#a1b2c3");
  for (const bad of ["constructor", "__proto__", "toString", "hasOwnProperty", "#FFF", "#12345G", "#123456789", "#000\" onload=\"x", "", "nope"]) assert.equal(color(bad, "#010203"), "#010203", bad);
  assert.equal(color(undefined, "#010203"), "#010203"); assert.equal(color(5 as unknown as string, "#010203"), "#010203");
  assert.deepEqual(Object.keys(FAMILIES).sort(), Object.keys(PALETTES.fabric).sort());
  assert.ok(new Set(Object.values(FAMILIES)).size >= 10, "enough families to tell outfits apart");
  assert.deepEqual(PALETTES.fabmetal, { ...PALETTES.fabric, ...PALETTES.metal }, "the unions hold whole palettes, so a stored id stays valid");
  assert.deepEqual(PALETTES.skinfab, { ...PALETTES.skin, ...PALETTES.fabric });
  for (const name of ["skin", "hair", "fabric", "eyes", "metal", "lens"] as const) for (const id of Object.keys(PALETTES[name])) assert.ok(kit.colorNames?.[id]?.en && kit.colorNames[id].tr, `${id}: names`);
  for (const id of Object.keys(PALETTES.lens)) assert.ok(LENS_ALPHA[id] > 0 && LENS_ALPHA[id] <= 1, `${id}: alpha`);
  for (const id of Object.keys(HAIR_BROW)) assert.ok(Object.hasOwn(PALETTES.hair, id) && Object.hasOwn(PALETTES.hair, HAIR_BROW[id]), `${id}: brows`);
  for (const [id, token] of Object.entries(kit.paletteUnlocks ?? {})) { assert.notEqual(color(id, ""), "", `${id}: a colour`); assert.match(token, /^[a-z]+:[a-z0-9_]+$/); }
  // an alias key `x_…` is a content drawing a promoted set piece or prop replaced (drawing/promote.ts), never a part
  assert.deepEqual(Object.keys(kit.aliases ?? {}).filter(k => !k.startsWith("x_")), [], "no part has been retired yet");
});

// ---- the vocabularies match the drawing ---------------------------------------------------------------

test("every feature has values with a default, names in two languages, and weights for values it has", () => {
  const fields = ["body.build", "body.shape", "face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears", "face.marks", "facialHair"];
  assert.deepEqual(Object.keys(kit.features).sort(), [...fields].sort());
  for (const [f, c] of Object.entries(kit.features)) {
    assert.equal(new Set(c.values).size, c.values.length, `${f}: values are unique`);
    assert.ok(c.default === null ? ["face.marks", "facialHair"].includes(f) : c.values.includes(c.default), `${f}: default`);
    for (const w of Object.keys(c.weights ?? {})) assert.ok(c.values.includes(w), `${f}: weight for ${w}`);
    for (const v of c.values) if (f !== "face.eyeColor") assert.ok(c.names?.[v]?.en && c.names[v].tr, `${f}.${v}: names`);
  }
  assert.deepEqual(kit.features["face.eyeColor"].values, Object.keys(PALETTES.eyes));
  assert.equal(kit.features["face.marks"].max, 4);
  for (const v of kit.features["face.marks"].free ?? []) assert.ok(kit.features["face.marks"].values.includes(v), `free mark ${v} is a mark`);
  assert.deepEqual(kit.features["body.build"].values, BUILDS);
  assert.deepEqual(kit.features["body.shape"].values, SHAPES);
  assert.equal(kit.features["body.build"].default, "adult");
});

test("bodies and heads differ for every build, shape and face shape the lists name", () => {
  const dims = (build: Build, shape: BodyShape) => JSON.stringify(kit.body({ build, height: 0.5, shape }));
  assert.equal(new Set(BUILDS.map(b => dims(b, "average"))).size, 4);
  assert.equal(new Set(SHAPES.map(s => dims("adult", s))).size, 4);
  const heads = kit.features["face.shape"].values.map(v => headPath(v, 44, 50).toD());
  assert.equal(new Set(heads).size, heads.length, "each face shape is its own outline");
  assert.notEqual(headPath("triangle", 44, 50).toD(), headPath("round", 44, 50).toD());
});

/** What the face drawing does for a document, as a string. */
function faceLog(face: AvatarDoc["face"], facialHair?: AvatarDoc["facialHair"]): string {
  const log: string[] = [];
  const ctx = new Proxy({}, {
    get: (_, k) => (typeof k === "string" ? (...a: unknown[]) => { log.push(`${k}(${a.map(x => (typeof x === "number" ? x.toFixed(2) : String(x))).join(",")})`); } : undefined),
    set: (_, k, v) => { log.push(`${String(k)}=${v}`); return true; },
  }) as unknown as CanvasRenderingContext2D;
  const doc: AvatarDoc = { ...kit.defaultDoc, face, ...(facialHair ? { facialHair } : {}) };
  drawFace(ctx, faceStyle(doc, kit), NEUTRAL_FACE);
  return log.join("\n");
}

test("every face value the lists offer changes the face the kit draws", () => {
  const base = faceLog({});
  assert.ok(base.length > 500, "the stub sees the face being drawn");
  assert.equal(faceLog({ eyes: "round", brows: "soft", nose: "button", mouth: "wide", eyeColor: "eye_brown", shape: "oval" }), base, "a default written out is the default");
  for (const [f, c] of Object.entries(kit.features)) {
    const key = f.replace("face.", "") as "eyes" | "brows" | "nose" | "mouth" | "eyeColor";
    if (["body.build", "body.shape", "face.shape", "face.ears", "face.marks", "facialHair"].includes(f)) continue;
    for (const v of c.values.filter(x => x !== c.default)) assert.notEqual(faceLog({ [key]: v }), base, `${f} = ${v} is drawn`);
    // (an unknown eye colour is grey in a document nobody normalized; compose always does)
    if (key !== "eyeColor") assert.equal(faceLog({ [key]: "no_such_value" }), base, `${f}: an unknown value draws as the default`);
  }
  for (const v of kit.features["face.marks"].values) assert.notEqual(faceLog({ marks: [v] }), base, `mark ${v}`);
  assert.notEqual(faceLog({ marks: ["freckles", "mole"] }), faceLog({ marks: ["freckles"] }));
  const styles = kit.features.facialHair.values.map(style => faceLog({}, { style }));
  assert.equal(new Set([base, ...styles]).size, styles.length + 1, "every facial hair style is its own look");
});

// ---- default and gallery documents ----------------------------------------------------------------------

test("the default character is a canonical document and the other characters fit the size limit", () => {
  const d = kit.defaultDoc;
  assert.equal(serialize(normalize(d, kit)!), serialize(d), "it is already in canonical form");
  assert.ok(bytes(d) < 400);
  const p = compose(d, kit);
  assert.deepEqual(p.notes, []);
  for (const [name, c] of [["NIMA", NIMA], ["ISMAIL", ISMAIL]] as const) {
    const n = normalize(c, kit, { trusted: true })!;
    assert.ok(n && bytes(n) < 520, `${name}: ${bytes(n)} bytes`);
    assert.deepEqual(compose(c, kit, CAST).notes, [], name);
  }
  for (const c of [NIMA, ISMAIL, d]) for (const trusted of [false, true]) assert.deepEqual(normalize(c, manifestOf(kit), { trusted }), normalize(c, kit, { trusted }), "the manifest of the kit normalizes the same");
  const parts = Object.keys(kit.parts).length, size = JSON.stringify(manifestOf(kit)).length;
  // batch 1 (2026-10-10) grew the palettes (dyed hair, more fabrics) and gave most garments a list of
  // patterns: about 6 KB fixed and 120 characters a part, still a few KB gzipped for the Worker
  assert.ok(size < 6500 + 125 * parts, `and is small enough to ship to a Worker (${size} characters for ${parts} parts)`);
  assert.ok(compose(NIMA, kit, CAST).views.front.length > 40 && compose(ISMAIL, kit, CAST).views.front.length > 40);
  assert.equal(normalize(ISMAIL, kit)!.facialHair?.color, undefined, "İsmail's grey moustache is a cast colour: a learner's copy follows the hair");
  assert.equal(compose(ISMAIL, kit, CAST).avatar.facialHair?.color, "#4A4440", "while the stage, which trusts cast documents, keeps it");
  assert.equal(compose(ISMAIL, kit).avatar.facialHair?.color, undefined, "compose, asked nothing, treats a document as a learner's");
  // the fully loaded learner's document of the map was 1,060 bytes; with defaults left out it is smaller
  const full: AvatarDoc = {
    ...kit.defaultDoc, face: { shape: "heart", eyes: "almond", eyeColor: "eye_blue", brows: "arched", nose: "long", mouth: "full", marks: ["freckles", "mole"] }, facialHair: { style: "beard_full", color: "hair_09" },
    hair: { style: "hair_curly", color: "hair_05" },
    outfit: { top: { id: "top_sweater", colors: ["fab_17"] }, bottom: { id: "bottom_skirt_long", colors: ["fab_09"] }, shoes: { id: "shoes_sneakers", colors: ["fab_12", "fab_22"] } },
    wear: { head: { id: "headscarf_wrap", colors: ["fab_13", "fab_11"] }, eyes: { id: "glasses_round", colors: ["fab_15"] }, waist: { id: "apron_shop", colors: ["fab_10"] } },
  };
  assert.ok(bytes(normalize(full, kit)!) < AVATAR_MAX_BYTES - 250, "a loaded document of the first kit leaves room");
});

// ---- the parts compose ----------------------------------------------------------------------------------

function finite(items: Item[], label: string) {
  for (const it of items) {
    assert.ok(kit.layers.front.includes(it.layer) || kit.layers.back.includes(it.layer), `${label}: layer ${it.layer}`);
    if (it.group) for (const n of groupBounds(it.group)) assert.ok(Number.isFinite(n), `${label}: bounds`);
  }
}

test("every part, in its default colours, composes into both views at every build and shape it is made for", () => {
  const b = createBuilder(kit, null, { unlocked: all });
  for (const g of GARMENT_FIELDS) for (const o of b.options(g.field).filter(x => x.value)) {
    for (const build of BUILDS) for (const shape of SHAPES) {
      if (kit.parts[o.value!].builds && !kit.parts[o.value!].builds!.includes(build)) continue;
      const c = createBuilder(kit, null, { unlocked: all });
      assert.ok(c.set("body.build", build) && c.set(g.field, o.value) && c.set("body.shape", shape));
      const p = compose(c.doc, kit, { trusted: false });
      const label = `${o.value} ${build} ${shape}`;
      assert.deepEqual(p.notes.filter(n => n.why !== "hidden" && n.why !== "clipped"), [], label);
      assert.equal(p.views.front.filter(i => i.face).length, 1, label);
      assert.ok(p.views.front.length > 20 && p.views.back.length > 20, label);
      finite(p.views.front, label); finite(p.views.back, label);
      if (kit.parts[o.value!].hides?.length === 0 || !kit.parts[o.value!].hides) assert.ok(p.views.front.length > 20);
    }
  }
});

test("a headscarf hides the hair in the picture but not in the document", () => {
  const p = compose({ ...kit.defaultDoc, wear: { head: { id: "headscarf_wrap" } } }, kit);
  assert.ok(!p.views.front.some(i => i.layer === "hair_front"));
  assert.equal(p.avatar.hair.style, "hair_short");
  assert.deepEqual(p.notes, [{ field: "hair.style", id: "hair_short", why: "hidden", by: "headscarf_wrap" }]);
});

test("an unknown part draws the slot's default part", () => {
  const p = compose({ ...kit.defaultDoc, hair: { style: "hair_from_the_future", color: "hair_01" }, outfit: { top: { id: "top_gone" }, bottom: { id: "bottom_jeans" }, shoes: { id: "shoes_sneakers" } } }, kit);
  assert.equal(p.avatar.hair.style, "hair_short"); assert.equal(p.avatar.outfit.top?.id, "top_tee");
  assert.ok(p.views.front.some(i => i.layer === "hair_front") && p.views.front.some(i => i.layer === "torso"));
  assert.deepEqual(p.notes.map(n => [n.field, n.why]), [["hair.style", "unknown"], ["outfit.top", "unknown"]]);
});

// ---- the builder on the real kit --------------------------------------------------------------------------

test("the builder's sections on the first kit, in Turkish", () => {
  const b = createBuilder(kit, null, { lang: "tr" });
  assert.deepEqual(b.sections().map(s => s.label), ["Vücut", "Yüz", "Saç", "Giysiler", "Aksesuar"]);
  const ids = (s: string) => b.fields(s).map(f => f.id);
  /** The labels of a field's options include these, in this order (the artists add more). */
  const has = (field: string, labels: string[]) => { const got = b.options(field).map(o => o.label); assert.deepEqual(got.filter(l => labels.includes(l)), labels, field); };
  assert.deepEqual(ids("body"), ["body.build", "body.height", "body.shape", "skin"]);
  assert.deepEqual(ids("face"), ["face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears", "face.marks", "facialHair"]);
  assert.deepEqual(ids("hair"), ["hair.style"]);
  for (const f of ["outfit.top", "outfit.bottom", "outfit.shoes"]) assert.ok(ids("clothes").includes(f), f);
  for (const f of ["wear.head", "wear.eyes", "wear.waist"]) assert.ok(ids("extras").includes(f), f);
  has("hair.style", ["kısa", "klasik", "çok kısa", "bob", "uzun", "topuz", "kel", "kıvırcık"]);
  has("outfit.bottom", ["pantolon", "kot pantolon", "uzun etek"]);
  assert.equal(b.options("wear.head")[0].label, "yok"); has("wear.head", ["başörtüsü"]);
  has("face.eyes", ["yuvarlak", "badem", "uykulu"]);
  has("facialHair", ["yok", "kirli sakal", "bıyık", "gür bıyık", "kısa sakal", "gür sakal", "uzun sakal"]);
  assert.deepEqual(b.options("face.ears").map(o => o.label), ["yuvarlak", "küçük kulak", "büyük kulak", "yana açık kulak"]);
  assert.deepEqual(b.options("body.build").map(o => o.label), ["yetişkin", "yaşlı", "çocuk", "küçük çocuk"]);
  assert.equal(b.field("wear.eyes")!.label, "Gözlük");
  assert.equal(b.colorOptions("skin")[0].label, "porselen, pembemsi", "colours have names");
  b.lang = "en"; has("outfit.top", ["T-shirt", "Shirt", "Shirt, sleeves rolled", "Sweater", "Blouse"]);
  assert.equal(b.colorOptions("skin")[0].label, "porcelain, rosy");
  const n = (p: keyof typeof PALETTES) => Object.keys(PALETTES[p]).length;
  assert.equal(b.colorOptions("outfit.top").length, n("fabric")); assert.equal(b.colorOptions("skin").length, n("skin")); assert.equal(b.colorOptions("hair.style").length, n("hair")); assert.equal(b.colorOptions("face.eyeColor").length, n("eyes"));
  assert.equal(b.colorOptions("outfit.shoes", 1).length, n("fabric")); assert.equal(b.colorOptions("wear.head", 0).length, 0, "no scarf, no colours");
  // dyed hair waits for its bundle; a skin tone never waits
  assert.deepEqual(b.colorOptions("hair.style").find(c => c.id === "hair_21"), { id: "hair_21", hex: PALETTES.hair.hair_21, label: "pastel pink", locked: true, unlock: "bundle:dye_pastel" });
  assert.ok(b.colorOptions("skin").every(c => !c.locked));
  assert.equal(b.setColor("hair.style", 0, "hair_21"), false);
  assert.ok(createBuilder(kit, null, { unlocked: ["bundle:dye_pastel"] }).setColor("hair.style", 0, "hair_21"));
});

test("a headscarf keeps the hair so taking it off brings it back; shoes keep their second colour", () => {
  const b = createBuilder(kit, null);
  assert.ok(b.set("hair.style", "hair_bob") && b.setColor("hair.style", 0, "hair_05"));
  assert.ok(b.set("wear.head", "headscarf_wrap") && b.setColor("wear.head", 0, "fab_13") && b.setColor("wear.head", 1, "fab_11"));
  assert.deepEqual(b.doc.wear, { head: { id: "headscarf_wrap", colors: ["fab_13", "fab_11"] } });
  assert.deepEqual(b.doc.hair, { style: "hair_bob", color: "hair_05" });
  assert.equal(b.field("hair.style")!.hidden, true);
  assert.ok(b.set("wear.head", null));
  assert.equal(b.field("hair.style")!.hidden, false); assert.equal(b.get("hair.style"), "hair_bob");
  assert.ok(b.set("outfit.shoes", "shoes_leather") && b.setColor("outfit.shoes", 0, "fab_19"));
  assert.ok(b.set("outfit.shoes", "shoes_sneakers")); assert.deepEqual(b.doc.outfit.shoes, { id: "shoes_sneakers", colors: ["fab_19"] }, "the colour goes with the learner to the next pair");
});

// ---- a kit with every slot ----------------------------------------------------------------------------------

/** The first kit plus a part for each slot it lacks, following the contract in sahne's core/kit.ts. */
function fullKit(): Kit {
  const quad = (layer: string, bone: string, fill: string): Item => ({ layer, bone, group: { shapes: [{ path: rect(-3, -3, 6, 6), fill }] } });
  const simple = (slot: string, id: string, layer: string, bone: string, o: Partial<PartDef> = {}): PartDef => ({
    slot, name: id, names: { en: id, tr: id }, colors: 1, defaults: ["fab_12"], ...o,
    draw: ({ colors }) => ({ front: [quad(layer, bone, colors[0] ?? "#C4553A")], back: [quad(layer, bone, colors[0] ?? "#C4553A")] }),
  });
  const parts: Record<string, PartDef> = {
    ...kit.parts,
    dress_long: { ...kit.parts.bottom_skirt_long, slot: "dress", name: "Dress", names: { en: "Dress", tr: "elbise" }, replaces: ["top", "bottom"], defaults: ["fab_13"], tags: ["modest"] },
    dress_short: { ...kit.parts.bottom_skirt_long, slot: "dress", name: "Short dress", names: { en: "Short dress", tr: "kısa elbise" }, replaces: ["top", "bottom"], defaults: ["fab_15"], tags: [] },
    coat_long: simple("outer", "Coat", "outer", "spine", { over: ["top"], defaults: ["fab_04"], tags: ["modest"] }),
    hat_cap: simple("head", "Cap", "headwear", "head", { clips: { slots: ["hair"], keep: ({ body: b }) => rect(-60, -b.headH * 0.55, 120, 70) } }),
    earrings_drop: simple("ears", "Earrings", "ear", "head"), scarf_neck: simple("neck", "Scarf", "torso_over", "neck", { tags: ["modest"] }),
    watch_classic: simple("wrist", "Watch", "hand", "hand_l", { colors: 2, palettes: ["fabric", "skin"], defaults: ["fab_21", "skin_03"] }), bag_shoulder: simple("carry", "Bag", "held", "hand_r"),
    cast_beard: simple("custom", "Cast", "headwear", "head", { tags: ["cast"] }),
  };
  return { ...kit, parts };
}

test("on a kit with a dress, a cap, a coat and the rest: builder rules and 500 random characters", () => {
  const k = fullKit(), b = createBuilder(k, null, { unlocked: all });
  const inOrder = (got: string[], want: string[]) => assert.deepEqual(got.filter(f => want.includes(f)), want);
  inOrder(b.fields("clothes").map(f => f.id), ["outfit.top", "outfit.bottom", "outfit.dress", "outfit.outer", "outfit.shoes"]);
  inOrder(b.fields("extras").map(f => f.id), ["wear.head", "wear.eyes", "wear.ears", "wear.neck", "wear.wrist", "wear.waist", "carry"]);
  assert.ok(!b.options("wear.head").some(o => o.value === "cast_beard") && !b.options("hair.style").some(o => o.value === "cast_beard"));
  assert.ok(b.set("outfit.dress", "dress_long"));
  assert.deepEqual(b.doc.outfit, { dress: { id: "dress_long" }, shoes: { id: "shoes_sneakers" } });
  assert.ok(b.set("wear.head", "hat_cap") && b.set("outfit.outer", "coat_long") && b.set("wear.wrist", "watch_classic") && b.setColor("wear.wrist", 1, "skin_09"));
  const p = compose(b.doc, k, { trusted: false });
  assert.deepEqual(p.notes.map(n => n.why).sort(), ["clipped"]);
  assert.ok(p.views.front.filter(i => i.layer === "hair_front").every(i => i.group!.shapes.every(s => s.clip)), "the cap cuts the hair");
  assert.ok(!p.views.front.some(i => i.layer === "torso"), "the dress replaced the top");

  const stat = { dress: 0, cap: 0, coat: 0, bag: 0, modestDress: 0, hashes: new Set<string>(), builds: new Set<string>(), bad: 0, ms: 0 };
  const clips = (d: AvatarDoc) => [...Object.values(d.wear ?? {}), d.carry, d.hold].some(g => g && k.parts[g.id]?.clips);
  for (let seed = 0; seed < 500; seed++) {
    const t0 = performance.now();
    b.randomize(seed);
    const d = b.doc;
    stat.ms += performance.now() - t0;
    assert.deepEqual(normalize(d, k), d, `seed ${seed}`);
    assert.ok(bytes(d) <= AVATAR_MAX_BYTES);
    const q = compose(d, k, { trusted: false });
    assert.deepEqual(q.notes.filter(n => n.why !== "hidden" && n.why !== "clipped"), [], `seed ${seed}`);
    finite(q.views.front, `seed ${seed}`); finite(q.views.back, `seed ${seed}`);
    assert.equal(q.views.front.filter(i => i.face).length, 1);
    if (d.outfit.dress) { stat.dress++; assert.ok(!d.outfit.top && !d.outfit.bottom); if (k.parts[d.outfit.dress.id].tags?.includes("modest")) stat.modestDress++; } else assert.ok(d.outfit.top && d.outfit.bottom);
    // the kit has many hats now: count every head part that clips the hair, and check the test's own cap
    if ([d.wear?.head, d.wear?.hat, d.wear?.hairwear].some(g => g && k.parts[g.id].clips)) stat.cap++;
    if (d.wear?.head?.id === "hat_cap") { assert.ok(q.notes.some(n => n.why === "clipped"), `seed ${seed}: a cap clips the hair`); }
    else if (!clips(d)) assert.ok(!q.notes.some(n => n.why === "clipped"), "and nothing that does not clip does");
    if (d.outfit.outer) stat.coat++;
    if (d.carry) stat.bag++;
    stat.hashes.add(docHash(d)); stat.builds.add(d.body.build);
    const fams = (["dress", "top", "bottom", "outer"] as const).map(f => { const g = d.outfit[f]; return g && FAMILIES[g.colors?.[0] ?? k.parts[g.id].defaults![0]]; }).filter(Boolean);
    if (new Set(fams).size !== fams.length) stat.bad++;
  }
  assert.equal(stat.bad, 0, "dominant colours of different families");
  assert.ok(stat.hashes.size >= 498);
  assert.equal(stat.builds.size, 4);
  assert.ok(stat.dress > 60 && stat.dress < 150, `dresses ${stat.dress}`);
  assert.ok(stat.modestDress > 20, `modest dresses get their share (${stat.modestDress} of ${stat.dress})`);
  assert.ok(stat.cap > 15 && stat.coat > 70 && stat.bag > 20, `${stat.cap} caps, ${stat.coat} coats, ${stat.bag} bags`);
  assert.ok(stat.ms / 500 < 5, `randomize takes ${(stat.ms / 500).toFixed(2)} ms`);
});

test("500 random characters of the first kit: valid, varied, apart in colour, with modest options and nothing locked", () => {
  const b = createBuilder(kit, null), locked = createBuilder({ ...kit, parts: { ...kit.parts, glasses_round: { ...kit.parts.glasses_round, unlock: "specs" } } }, null);
  const modest = (id: string | undefined) => !!id && !!kit.parts[id]?.tags?.includes("modest");
  const stat = { scarf: 0, modestBottom: 0, modestTop: 0, tops: 0, beard: 0, kids: 0, glasses: 0, bad: 0, kidBald: 0, kidGrey: 0, adults: 0, adultBald: 0, adultGrey: 0, elders: 0, elderGrey: 0, dyed: 0,
    hashes: new Set<string>(), builds: new Set<string>(), skins: new Set<string>() };
  const GREY = ["hair_08", "hair_09", "hair_18"];
  for (let seed = 0; seed < 500; seed++) {
    b.randomize(seed); locked.randomize(seed);
    const d = b.doc;
    assert.deepEqual(normalize(d, kit), d); assert.ok(bytes(d) <= AVATAR_MAX_BYTES);
    const p = compose(d, kit, { trusted: false });
    assert.deepEqual(p.notes.filter(n => n.why !== "hidden" && n.why !== "clipped"), []);
    finite(p.views.front, `seed ${seed}`); finite(p.views.back, `seed ${seed}`);
    assert.notEqual(locked.doc.wear?.eyes?.id, "glasses_round", "a locked part is never picked");
    for (const g of [...Object.values(d.outfit), ...Object.values(d.wear ?? {}), d.carry, d.hold, d.hair.style].filter(Boolean)) {
      const id = typeof g === "string" ? g : g!.id;
      assert.ok(!kit.parts[id]?.unlock && !kit.parts[id]?.tags?.includes("cast") && !kit.parts[id]?.tags?.includes("hidden"), `seed ${seed}: ${id} is open`);
    }
    if (kit.paletteUnlocks?.[d.hair.color]) stat.dyed++;
    stat.hashes.add(docHash(d)); stat.builds.add(d.body.build); stat.skins.add(d.skin);
    if (d.wear?.head) stat.scarf++;
    if (d.outfit.top) { stat.tops++; if (modest(d.outfit.top.id)) stat.modestTop++; }
    if (modest(d.outfit.bottom?.id)) stat.modestBottom++;
    if (d.facialHair) { stat.beard++; assert.ok(d.body.build === "adult" || d.body.build === "elder"); }
    const grey = GREY.includes(d.hair.color), bald = d.hair.style === "hair_bald";
    if (d.body.build === "child" || d.body.build === "toddler") { stat.kids++; if (bald) stat.kidBald++; if (grey) stat.kidGrey++; }
    else if (d.body.build === "elder") { stat.elders++; if (grey) stat.elderGrey++; }
    else { stat.adults++; if (bald) stat.adultBald++; if (grey) stat.adultGrey++; }
    if (d.wear?.eyes) stat.glasses++;
    const fam = (g: { id: string; colors?: string[] }) => FAMILIES[g.colors?.[0] ?? kit.parts[g.id].defaults![0]];
    const worn = [d.outfit.dress, d.outfit.top, d.outfit.bottom, d.outfit.outer].filter(Boolean) as { id: string; colors?: string[] }[];
    if (new Set(worn.map(fam)).size !== worn.length) stat.bad++;
  }
  assert.equal(stat.bad, 0, "the dominant garments are never the same colour family");
  assert.ok(stat.hashes.size >= 498);
  assert.equal(stat.builds.size, 4); assert.equal(stat.skins.size, Object.keys(PALETTES.skin).length, "every skin tone turns up");
  assert.equal(stat.dyed, 0, "dyed hair waits for its bundle");
  // modest parts keep at least the slot's 30% (or their natural share): head coverings in 15% of characters, tops and bottoms
  assert.ok(stat.scarf > 50 && stat.modestTop > stat.tops * 0.25 && stat.modestBottom > 100, `modest options: ${stat.scarf} head coverings, ${stat.modestTop} of ${stat.tops} tops, ${stat.modestBottom} bottoms of 500`);
  // odds: no bald or grey-haired children; adults are rarely bald or grey, elders often grey
  assert.ok(stat.kids > 80 && stat.adults > 150 && stat.elders > 30, `${stat.adults} adults, ${stat.elders} elders`);
  assert.equal(stat.kidBald + stat.kidGrey, 0, "no bald or grey-haired children");
  assert.ok(stat.adultBald / stat.adults < 0.12, `bald adults ${stat.adultBald} of ${stat.adults}`);
  assert.ok(stat.adultGrey / stat.adults < 0.09, `grey adults ${stat.adultGrey} of ${stat.adults}`);
  assert.ok(stat.elderGrey / stat.elders > 0.25, `grey elders ${stat.elderGrey} of ${stat.elders}`);
  assert.ok(stat.kids > 80 && stat.kids < 250 && stat.beard > 30 && stat.glasses > 50, `${stat.kids} children, ${stat.beard} with facial hair, ${stat.glasses} with glasses`);
});

test("a builder on a kit starts from a document of its own and survives a hostile one", () => {
  const b: Builder = createBuilder(kit, ISMAIL, { trusted: true });
  assert.equal(b.doc.facialHair?.color, "#4A4440"); assert.equal(b.get("wear.waist"), "apron_shop");
  assert.ok(b.set("wear.waist", null)); assert.equal(b.doc.wear, undefined);
  assert.ok(b.undo()); assert.equal(b.get("wear.waist"), "apron_shop");
  const evil = createBuilder(kit, { v: 1, kit: kit.id, body: { build: "__proto__" }, skin: "#000\" onload=\"alert(1)", hair: { style: "constructor", color: "toString" }, outfit: { top: { id: "top_tee", colors: [{ toString() { throw new Error("no"); } }] } } });
  assert.equal(evil.doc.skin, kit.defaultDoc.skin);
  assert.deepEqual(evil.doc.hair, kit.defaultDoc.hair);
  const r = rng(1);
  for (let i = 0; i < 100; i++) { const f = r.pick(GARMENT_FIELDS).field; evil.set(f, r.pick([null, "__proto__", "constructor", 5, {}, "top_tee", "hair_bob"])); assert.deepEqual(normalize(evil.doc, kit), evil.doc); }
});

test("the seated side view: every random character has one, finite, with exactly one face, its hair and clothes in their colours", () => {
  const b = createBuilder(kit, null);
  for (let seed = 0; seed < 300; seed++) {
    b.randomize(seed);
    const p = compose(b.doc, kit, { trusted: false });
    assert.ok(p.side, `seed ${seed}: a side view`);
    assert.equal(p.side!.items.filter(it => it.face).length, 1, `seed ${seed}: one face`);
    for (const it of p.side!.items) if (it.group) for (const n of groupBounds(it.group)) assert.ok(Number.isFinite(n), `seed ${seed} side: bounds`);
    const [x0, y0, x1, y1] = p.side!.faceRegion;
    assert.ok(x1 > x0 && y1 > y0, "a face box");
    // the near limbs are drawn after the far ones
    const at = (chain: string) => p.side!.items.findIndex(it => it.strip?.chain === chain);
    assert.ok(at("leg_l") < at("leg_r") && at("arm_l") < at("arm_r"), `seed ${seed}: far limbs first`);
  }
  // the profile face draws on any canvas-like context without throwing, rest and talking
  const calls: string[] = [], ctx = new Proxy({}, { get: (_, k) => k === "canvas" ? {} : typeof k === "string" && /^[a-z]/.test(k) && !["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "globalAlpha"].includes(k) ? (..._a: unknown[]) => { calls.push(k); } : undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  const st = faceStyle({ ...kit.defaultDoc, facialHair: { style: "beard_full" } }, kit);
  kit.face.drawSide!(ctx, st, NEUTRAL_FACE, kit.face.regionSide!(kit.body(kit.defaultDoc.body)));
  kit.face.drawSide!(ctx, st, { ...NEUTRAL_FACE, mouth: { ...NEUTRAL_FACE.mouth, open: 0.8 }, eyeOpen: [0, 0] }, [0, 0, 1, 1]);
  assert.ok(calls.includes("fill") && calls.includes("stroke"));
});
