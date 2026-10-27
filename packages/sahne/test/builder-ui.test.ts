// Tests of the builder screen's pure decisions (ui/builder-plan.ts), and that the screen's module
// loads in Node without a DOM (it touches the document only when mounted).
import { test } from "node:test";
import assert from "node:assert/strict";
import { uiWords, fill, fieldFraming, sectionFraming, emotionStrip, tapGestures, tagFilters, passes, colourSlots, withMark, roving, WORDS, LONG } from "../src/ui/builder-plan.ts";
import type { Option } from "../src/avatar/builder.ts";

test("the screen's module imports without a DOM", async () => {
  assert.equal(typeof (globalThis as { document?: unknown }).document, "undefined");
  const m = await import("../src/ui/builder.ts");
  assert.equal(typeof m.mountBuilder, "function");
  const css = await import("../src/ui/builder-css.ts");
  assert.ok(css.BUILDER_CSS.includes(".sahne-bld"));
  const all = await import("../src/index.ts");
  assert.equal(all.mountBuilder, m.mountBuilder);
});

test("words: English and Turkish say the same things, other languages fall back to English, a host's words win", () => {
  const keys = (o: object) => Object.keys(o).sort();
  assert.deepEqual(keys(WORDS.tr), keys(WORDS.en));
  assert.deepEqual(keys(WORDS.tr.emotions), keys(WORDS.en.emotions));
  assert.deepEqual(keys(WORDS.tr.sides), keys(WORDS.en.sides));
  assert.equal(uiWords("tr").done, "Tamam");
  assert.equal(uiWords("fa").done, "Done");
  const w = uiWords("en", { done: "Save", emotions: { happy: "Glad" } });
  assert.equal(w.done, "Save"); assert.equal(w.emotions.happy, "Glad"); assert.equal(w.emotions.sad, "Sad", "the other emotions stay");
  assert.equal(fill(WORDS.en.max, 3), "At most 3");
});

test("framing: the face and what sits on the head close up, the upper body as a bust, the rest whole", () => {
  for (const f of ["face.eyes", "face.marks", "facialHair", "hair.style", "wear.eyes", "wear.head", "wear.aid"]) assert.equal(fieldFraming(f), "head", f);
  for (const f of ["outfit.top", "outfit.outer", "wear.neck"]) assert.equal(fieldFraming(f), "bust", f);
  for (const f of ["body.build", "body.height", "outfit.bottom", "outfit.dress", "outfit.shoes", "carry", "hold", "wear.waist"]) assert.equal(fieldFraming(f), "full", f);
  assert.deepEqual(["body", "face", "hair", "clothes", "extras"].map(sectionFraming), ["full", "head", "head", "full", "bust"]);
});

test("the emotion strip and the taps keep their order and only what the kit has", () => {
  assert.deepEqual(emotionStrip(["sad", "happy", "neutral", "angry"]), ["neutral", "happy", "sad"]);
  assert.deepEqual(emotionStrip(["neutral", "happy", "laugh", "surprised", "shy", "sad", "proud"], 4), ["neutral", "happy", "laugh", "surprised"]);
  assert.deepEqual(tapGestures(["nod", "wave", "point"]), ["wave", "nod"]);
});

const opt = (value: string | null, tags: string[] = [], reserved?: "cast"): Option => ({ value, label: value ?? "None", locked: false, tags, ...(reserved ? { reserved } : {}) });

test("tag filters: only for a long list, tags that split it, most common first", () => {
  const few = [opt(null), opt("a", ["x"]), opt("b", ["x"])];
  assert.deepEqual(tagFilters(few), [], "a short list has none");
  const many = [opt(null), ...Array.from({ length: LONG }, (_, i) => opt(`p${i}`, ["all", ...(i % 2 ? ["odd"] : []), ...(i % 4 === 0 ? ["four"] : []), ...(i === 3 ? ["one"] : [])]))];
  assert.deepEqual(tagFilters(many), ["odd", "four"], "on every option or on one: not a filter");
  assert.equal(passes(opt(null), "odd"), true, "none always shows");
  assert.equal(passes(opt("p0", ["four"]), "odd"), false);
  assert.equal(passes(opt("c", [], "cast"), "cast"), true, "the cast's own under its filter");
});

test("colour slots: one colour unnamed, several numbered, then the pattern's inks", () => {
  const w = { colour: "Colour", colourN: "Colour {n}", ink: "Pattern colour {n}" };
  assert.deepEqual(colourSlots({ colors: 1 }, w), [{ index: 0, label: "Colour" }]);
  assert.deepEqual(colourSlots({ colors: 2, inks: 1 }, w).map(s => s.label), ["Colour 1", "Colour 2", "Pattern colour 1"]);
  assert.deepEqual(colourSlots({ colors: 2, inks: 1 }, w).map(s => s.index), [0, 1, 2]);
});

test("a mark's thumbnail adds it to the marks there are, or shows it alone when the list is full", () => {
  assert.deepEqual(withMark(["mole"], "freckles", 3), ["mole", "freckles"]);
  assert.deepEqual(withMark(["mole"], "mole", 3), ["mole"]);
  assert.deepEqual(withMark(["a", "b", "c"], "d", 3), ["d"]);
});

test("roving focus: arrows wrap, Home and End jump, other keys do nothing", () => {
  assert.equal(roving("ArrowRight", 2, 3), 0);
  assert.equal(roving("ArrowLeft", 0, 3), 2);
  assert.equal(roving("ArrowDown", 0, 3), 1);
  assert.equal(roving("End", 0, 5), 4);
  assert.equal(roving("Home", 3, 5), 0);
  assert.equal(roving("a", 0, 3), -1);
  assert.equal(roving("ArrowRight", 0, 0), -1);
});
