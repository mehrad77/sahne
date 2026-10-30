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

test("auto zoom: a small item fills its cell with its scale printed and a scale bar, not a 170 cm adult; a large one keeps the adult", () => {
  const cup = FAMILY_MODULES.cookware.props.cup;
  const svg = kitSheetSvg(kit, [{ id: "cup", def: cup, kind: "props" }], { views: ["day"] });
  const scales = [...svg.matchAll(/1 cm = ([\d.]+) px · grid (\d+) cm/g)].map(m => Number(m[1]));
  assert.equal(scales.length, (svg.match(/<text x="125"/g) ?? []).length, "each cell (default, variants, n 3, held) prints its scale");
  assert.ok(scales[0] >= 8, `a cup is drawn at ${scales[0]} px per cm`);
  assert.ok(scales.every(k => k <= 40));
  assert.doesNotMatch(svg, /#59607A/, "no adult beside a cup");
  assert.match(svg, />\d+ cm<\/text>/, "a scale bar instead");
  assert.match(svg, /\+ grip/, "the held cell marks the grip");
  assert.match(kitSheetSvg(kit, [{ id: "frontage", def: frontage, kind: "set" }], { views: ["day"] }), /#59607A/, "a frontage stands beside the adult");
});

test("scene zoom: every cell at one scale, each with the adult, to compare sizes; a list fits the PNG cap unscaled", () => {
  const items = [{ id: "frontage", def: frontage, kind: "set" as const }, { id: "tea", def: tea, kind: "props" as const }];
  const svg = kitSheetSvg(kit, items, { zoom: "scene", flow: true });
  const scales = new Set([...svg.matchAll(/1 cm = ([\d.]+) px/g)].map(m => m[1]));
  assert.equal(scales.size, 1, `one scale, not ${[...scales].join(", ")}`);
  assert.equal(svg.match(/#59607A/g)?.length, svg.match(/1 cm = /g)?.length, "an adult in every cell");
  // the printed px per cm is the picture's own: a sheet is never scaled down to the cap
  const auto = kitSheetSvg(kit, items, { flow: true });
  assert.ok(Number(/width="(\d+)"/.exec(auto)![1]) <= MAX_WIDTH);
  assert.ok(new Set([...auto.matchAll(/1 cm = ([\d.]+) px/g)].map(m => m[1])).size > 1, "auto: each item its own scale");
});
