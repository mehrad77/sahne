import assert from "node:assert/strict";
import { test } from "node:test";
import kit from "sahne-kit/full";
import { FAMILY_MODULES } from "sahne-kit/set/all";
import { fromDrawing } from "sahne-kit/drawing";
import { cellSheetSvg, kitSheetSvg, pieceBody, pieceSvg } from "sahne-kit/set-svg";
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
  assert.match(svg, />tea · held</);
  assert.match(svg, />tea · n 3</);
  assert.match(svg, />night · 1 cm = /, "the view and the scale on the line under the caption");
  const p = png(renderPng(svg));
  assert.equal(p.sig, "89504e470d0a1a0a");
  assert.ok(p.w <= MAX_WIDTH && p.w > 800 && p.h > 400);
});

test("auto zoom: a small item fills its cell with its scale printed and a scale bar, not a 170 cm adult; a large one keeps the adult", () => {
  const cup = FAMILY_MODULES.cookware.props.cup;
  const svg = kitSheetSvg(kit, [{ id: "cup", def: cup, kind: "props" }], { views: ["day"] });
  const scales = [...svg.matchAll(/1 cm = ([\d.]+) px · grid (\d+) cm/g)].map(m => Number(m[1]));
  assert.equal(scales.length, (svg.match(/<rect width="250" height="270"/g) ?? []).length, "each cell (default, variants, n 3, held) prints its scale");
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

test("a cell's caption and scale go under the art, never over it; a long caption is cut with an ellipsis, a number first", () => {
  const svg = cellSheetSvg(kit, [{ item: { id: "frontage", def: frontage, kind: "set" }, label: "a look with a very long list of params, more than fits", params: {}, num: 7 }]);
  const ys = [...svg.matchAll(/<text x="\d+(?:\.\d+)?" y="([\d.]+)"[^>]*font-size="1[02]" text-anchor="middle"/g)].map(m => Number(m[1]));
  const art = Number(/<svg x="0" y="0" width="\d+" height="(\d+)"/.exec(svg)![1]);
  assert.ok(ys.length === 2 && ys.every(y => y > art), `the two caption lines are below the art (${ys} > ${art})`);
  assert.match(svg, />7 {2}frontage · a look with .*…</);
  assert.match(svg, />day · 1 cm = [\d.]+ px · grid \d+ cm</);
});

test("t draws a moving flat mid-motion, turned about its origin; without t the drawing is as it was", () => {
  const flag = (kit.set.flag ?? kit.props.flag)!;
  const rest = pieceBody(kit, flag, {}, "a")!, still = pieceBody(kit, flag, {}, "a", "a", {})!;
  assert.equal(rest.body, still.body);
  assert.doesNotMatch(rest.body, /rotate\(/, "at rest, nothing is turned");
  const swaying = Array.from({ length: 8 }, (_, i) => pieceBody(kit, flag, {}, "a", "a", { t: i * 300 })!.body);
  assert.ok(swaying.some(b => /rotate\(-?\d/.test(b)), "some time turns the cloth");
  assert.ok(new Set(swaying).size > 1, "different times, different pictures");
});

test("a sheet frames the glow with the art, so a halo above a piece is not cut", () => {
  const lamp = fromDrawing({ id: "x_halo", as: "set", about: "A lamp with a wide halo.", tags: [], terms: [], params: {},
    kinds: { default: { size: [20, 100], ppcm: 2, grip: [0, -50], flats: [{ shapes: [{ d: "M-5 0V-100H5V0Z", fill: "#333333" }], glow: [{ d: "M-60 -100A60 60 0 1 1 60 -100A60 60 0 1 1 -60 -100Z", fill: "#FFE9A8" }], text: [], sway: null, shadow: "drop" }] } },
    repeat: { gap: 4 }, variants: {}, solid: null } as never);
  const b = pieceBody(kit, lamp, {}, "a", "a", { night: true })!;
  assert.ok(b.reach[1] < b.bounds[1] - 50 && b.reach[0] < b.bounds[0] - 50, `the reach (${b.reach}) holds the halo beyond the art (${b.bounds})`);
});

test("fit fills each cell with its item, however large; focus crops a cell to a box of cm, magnified", () => {
  const fit = cellSheetSvg(kit, [{ item: { id: "frontage", def: frontage, kind: "set" }, label: "default", params: {} }], { zoom: "fit" });
  assert.doesNotMatch(fit, /#59607A/, "no adult");
  assert.match(fit, />\d+ cm<\/text>/, "a scale bar");
  const k = (svg: string) => Number(/1 cm = ([\d.]+) px/.exec(svg)![1]);
  const auto = cellSheetSvg(kit, [{ item: { id: "frontage", def: frontage, kind: "set" }, label: "default", params: {} }]);
  assert.ok(k(fit) >= k(auto), `fit draws no smaller (${k(fit)} >= ${k(auto)})`);
  const crop = cellSheetSvg(kit, [{ item: { id: "frontage", def: frontage, kind: "set" }, label: "sign", params: {}, focus: [-60, -360, 60, -330] }], { scale: 2 });
  assert.ok(k(crop) > 4 * k(fit), `a 120 cm box is drawn at ${k(crop)} px per cm`);
  assert.match(crop, /width="516"/, "scale 2: cells twice as large");
});
