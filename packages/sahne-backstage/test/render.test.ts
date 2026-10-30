import assert from "node:assert/strict";
import { test } from "node:test";
import kit from "sahne-kit/full";
import { FAMILY_MODULES } from "sahne-kit/set/all";
import { kitSheetSvg, pieceSvg } from "sahne-kit/set-svg";
import { MAX_WIDTH, renderPng } from "../server/render.ts";

const png = (b: Buffer) => ({ sig: b.subarray(0, 8).toString("hex"), w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const frontage = FAMILY_MODULES.street.set.frontage, tea = FAMILY_MODULES.food.props.tea;

test("pieceSvg writes a sign's words as text, and dims the day at night", () => {
  assert.doesNotMatch(pieceSvg(kit, frontage, {}, "a", 300), /<text/);
  assert.match(pieceSvg(kit, frontage, {}, "a", 300, { text: true }), /<text[^>]*>.*BAKKAL/s);
  assert.match(pieceSvg(kit, frontage, {}, "a", 300, { night: true }), /feColorMatrix/);
});

test("a kit sheet renders to a PNG no wider than the cap", () => {
  const svg = kitSheetSvg(kit, [{ id: "frontage", def: frontage, kind: "set" }, { id: "tea", def: tea, kind: "props" }]);
  assert.match(svg, /tea · held · night/);
  assert.match(svg, /tea · n 3/);
  const p = png(renderPng(svg));
  assert.equal(p.sig, "89504e470d0a1a0a");
  assert.ok(p.w <= MAX_WIDTH && p.w > 800 && p.h > 400);
});
