// Pieces drawn as data (src/drawing.ts, DRAWING.md): a document becomes a generator that passes the kit's own checks, repeats and
// holds like a prop, reads its colours and words from its params, and is held to the caps; a variant doc adds a look to a
// generator; and no id of the kit starts with `x_`, the content's prefix.

import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBounds, rng } from "sahne";
import kit from "../src/full.ts";
import { checkPiece } from "../src/check.ts";
import { fromDrawing, withDrawings, checkDrawing, DRAWING_LIMITS, type DrawingDoc, type VariantDoc } from "../src/drawing.ts";
import { pieceSvg } from "../src/set-svg.ts";
import { validateDoc } from "../../sahne-story/check/schema.ts";
import { paramProblems } from "../../sahne-story/src/lint-place.ts";

const chalkboard = (): DrawingDoc => ({
  id: "x_cafe_chalkboard", as: "prop", about: "A chalkboard menu, on an easel or hung on the wall.", tags: ["cafe"], terms: [],
  params: {
    color: { type: "color", default: "#2F3B35", about: "the board" }, label: { type: "text", default: "Menu" },
    kind: { type: "enum", values: ["easel", "wall"], default: "easel" },
  },
  kinds: {
    easel: { size: [60, 110], ppcm: 8, grip: [0, -60], flats: [{
      shapes: [
        { d: "M-30 0L-24 -110H24L30 0Z", fill: "$color" },
        { d: "M-20 -20H20V-90H-20Z", fill: { tone: "$color", step: "shade" }, flat: true },
        { d: "M-26 -102a4 4 0 0 1 4 -4h44a4 4 0 0 1 4 4", stroke: { color: "#C9B58A", width: 1 } },
      ],
      text: [{ text: "$label", x: -18, y: -86, w: 36, h: 60, font: "hand", lang: "fr" }],
      glow: [{ d: "M-4 -60h8v4h-8Z", fill: "#FFD27A" }], sway: null, shadow: "drop",
    }] },
    wall: { size: [80, 60], ppcm: 6, grip: [0, -30], flats: [{ shapes: [{ d: "M-40 0V-60H40V0Z", fill: "$color" }], text: [{ text: "$label", x: -36, y: -56, w: 72, h: 50, lang: "tr" }] }] },
  },
  repeat: { gap: 6 }, variants: { wall: { kind: "wall" } }, solid: null,
});

const bounds = (def: ReturnType<typeof fromDrawing>, p: Record<string, unknown> = {}, id = "t") => def.draw(p, rng(id), kit).flats.map(f => groupBounds(f.group));

test("a drawing is a generator that passes the kit's own checks, as a prop, a set piece or both", () => {
  for (const as of ["prop", "set", "both"] as const) {
    const doc = { ...chalkboard(), as }, def = fromDrawing(doc);
    const problems = checkPiece(def, { ids: [doc.id], set: as !== "prop", prop: as !== "set" }, kit).filter(p => p.level === "error");
    assert.deepEqual(problems, [], as);
  }
  assert.deepEqual(validateDoc("kit_piece", chalkboard()), []);
  assert.deepEqual(checkDrawing(chalkboard()), []);
});

test("params pick the kind, the colours and the words", () => {
  const def = fromDrawing(chalkboard());
  const easel = def.draw({}, rng("a"), kit).flats[0], wall = def.draw({ kind: "wall", label: "Soup" }, rng("a"), kit).flats[0];
  assert.equal(easel.group.shapes[0].fill, "#2F3B35");
  assert.notEqual(easel.group.shapes[1].fill, "#2F3B35", "the tone step shades the board");
  assert.equal(easel.text![0].text, "Menu");
  assert.equal(wall.text![0].text, "Soup");
  assert.equal(wall.text![0].lang, "tr");
  assert.equal(def.draw({ color: "#B03030" }, rng("a"), kit).flats[0].group.shapes[0].fill, "#B03030");
  assert.ok(easel.emissive && easel.emissive.shapes.length === 1 && easel.emissive.edge === 0);
  assert.equal(easel.shadow, "drop");
  assert.deepEqual(def.meta!.params.n, { type: "int", min: 1, max: 12, default: 1, about: "how many, side by side" });
  assert.equal(fromDrawing({ ...chalkboard(), as: "set" }).meta!.params.n, undefined, "a set piece is not counted");
});

test("n repeats side by side, gap apart; held moves the origin to the grip and drops the shadow", () => {
  const def = fromDrawing(chalkboard()), one = bounds(def)[0], three = bounds(def, { n: 3 })[0];
  assert.ok(Math.abs((three[2] - three[0]) - ((one[2] - one[0]) + 2 * (60 + 6))) < 1e-6);
  assert.ok(Math.abs(three[0] + three[2]) < 1e-6, "centred");
  assert.equal(def.draw({ n: 3 }, rng("a"), kit).flats[0].text!.length, 3);
  const held = def.draw({ held: true }, rng("a"), kit), still = def.draw({}, rng("a"), kit);
  assert.equal(held.flats.length, 1);
  assert.equal(held.flats[0].shadow, undefined);
  assert.ok(Math.abs(groupBounds(held.flats[0].group)[3] - groupBounds(still.flats[0].group)[3] - 60) < 1e-6, "the grip (0, -60) is now the origin");
  assert.equal(held.flats[0].text![0].y, -86 + 60);
});

test("it draws to SVG, glow and all", () => assert.match(pieceSvg(kit, fromDrawing(chalkboard()), {}, "a", 200, true), /<svg[^>]*viewBox/));

test("sway and blink follow FlatMotion", () => {
  const doc = chalkboard(); doc.kinds.easel.flats[0].sway = { rot: 0.05, ms: 3000 }; doc.kinds.easel.flats[0].blink = { ms: 2000, on: 0.5 };
  assert.deepEqual(fromDrawing(doc).draw({}, rng("a"), kit).flats[0].move, { sway: { rot: 0.05, ms: 3000 }, blink: { ms: 2000, on: 0.5 } });
  assert.deepEqual(validateDoc("kit_piece", doc), []);
});

test("a bad document says what is wrong: ids, references, path data and the caps", () => {
  const says = (f: (d: DrawingDoc) => void, re: RegExp) => { const d = chalkboard(); f(d); assert.match(checkDrawing(d).join("\n"), re); assert.throws(() => fromDrawing(d), re); };
  says(d => { d.id = "cafe_chalkboard"; }, /x_/);
  says(d => { d.kinds.easel.flats[0].shapes[0].fill = "$nope"; }, /\$nope is not a colour param/);
  says(d => { d.kinds.easel.flats[0].shapes[0].fill = "$label"; }, /\$label is not a colour param/);
  says(d => { d.kinds.easel.flats[0].text![0].text = "$prce"; }, /\$prce is not a declared param/);
  says(d => { d.kinds.easel.flats[0].shapes[0].d = "M0 0Q"; }, /path data/);
  says(d => { delete d.kinds.wall; }, /enum whose values are the kinds/);
  says(d => { d.params!.n = { type: "int" }; }, /the engine gives it/);
  says(d => { d.variants!.wall = { colour: "x" }; }, /colour is not a declared param/);
  says(d => { d.kinds.easel.flats[0].text![0].lang = ""; }, /no lang/);
  says(d => { d.kinds.easel.flats[0].shapes = Array.from({ length: DRAWING_LIMITS.shapes + 1 }, () => ({ d: "M0 0L1 0L1 -1Z", fill: "#fff" })); }, /shapes: at most 400/);
  says(d => { d.kinds.easel.flats[0].shapes = [{ d: "M0 0" + "L1 0L1 -1".repeat(DRAWING_LIMITS.commands / 2) + "Z", fill: "#fff" }]; }, /path commands|KB/);
  says(d => { d.kinds.easel.flats[0].text![0].text = "x".repeat(DRAWING_LIMITS.bytes); }, /KB/);
  says(d => { const f = d.kinds.easel.flats[0]; d.kinds.easel.flats = Array.from({ length: DRAWING_LIMITS.flats + 1 }, () => f); }, /flats: at most 12/);
  assert.ok(validateDoc("kit_piece", { ...chalkboard(), id: "cafe" }).length, "the schema refuses a bare id too");
  assert.ok(validateDoc("kit_piece", { ...chalkboard(), extra: 1 }).length);
});

test("a content root's pieces and variants are added to a kit, never over its ids", () => {
  const flag: VariantDoc = { of: "flag", name: "x_club_colours", params: { kind: "bunting", w: 400 } };
  assert.ok(kit.set.flag || kit.props.flag, "the kit has a flag to give a variant");
  const k = withDrawings(kit, [chalkboard(), flag]);
  assert.ok(k.props.x_cafe_chalkboard && !k.set.x_cafe_chalkboard);
  assert.ok(Object.keys(k.set.flag?.variants ?? k.props.flag.variants!).includes("x_club_colours"));
  assert.equal(kit.props.x_cafe_chalkboard, undefined, "the kit it was given is untouched");
  assert.deepEqual(paramProblems((k.set.flag ?? k.props.flag), { variant: "x_club_colours" }, ["variant"]), []);
  assert.deepEqual(validateDoc("kit_variant", flag), []);
  assert.throws(() => withDrawings(kit, [{ of: "flag", name: "club", params: {} }]), /x_/);
  assert.throws(() => withDrawings(kit, [{ of: "nonesuch", name: "x_a", params: {} }]), /no set piece or prop nonesuch/);
  assert.throws(() => withDrawings(kit, [{ of: "flag", name: "x_a", params: { nope: 1 } }]), /nope not declared by flag/);
  assert.throws(() => withDrawings(kit, [chalkboard(), chalkboard()]), /id is taken/);
  assert.throws(() => withDrawings(k, [chalkboard()]), /id is taken/);
  assert.ok(validateDoc("kit_variant", { ...flag, name: "club" }).length);
  // a drawn piece takes a variant doc too, and its param is held to the generator's declaration
  const v = withDrawings(kit, [chalkboard(), { of: "x_cafe_chalkboard", name: "x_green", params: { color: "#2E6B3F" } }]);
  assert.equal(v.props.x_cafe_chalkboard.variants!.x_green.color, "#2E6B3F");
});

test("no id of the kit starts with x_: that prefix is the content's", () => {
  const ids: string[] = [...Object.keys(kit.set), ...Object.keys(kit.props), ...Object.keys(kit.parts), ...Object.keys(kit.aliases ?? {}), ...Object.values(kit.aliases ?? {})];
  for (const d of [...Object.values(kit.set), ...Object.values(kit.props)]) ids.push(...Object.keys(d.variants ?? {}));
  assert.deepEqual(ids.filter(i => i.startsWith("x_")), []);
});
