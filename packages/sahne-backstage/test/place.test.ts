// The place page's pure model (src/model/place.ts): the stage's copy keeps every piece's art, a hit selects its thing,
// moves pin a piece's seed, and the heights things sit at are named after their piece. On the sample bakkal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pieceSeed, type PlaceDoc } from "sahne";
import { PLACES } from "../../sahne-story/paths.ts";
import { duplicate, heightOn, heights, move, nextId, nudge, posOf, remove, selOfTarget, shownDoc, targetOf } from "../src/model/place.ts";

const BAKKAL: PlaceDoc = JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8"));

test("the stage's copy names every piece and keeps its art", () => {
  const shown = shownDoc(BAKKAL);
  assert.equal(shown.pieces.length, BAKKAL.pieces.length);
  shown.pieces.forEach((p, i) => {
    assert.ok(p.id, `piece ${i} has an id`);
    assert.equal(pieceSeed(shown, p), pieceSeed(BAKKAL, BAKKAL.pieces[i]), `piece ${i} keeps its seed`);
    assert.deepEqual(selOfTarget(BAKKAL, `piece:${p.id}`), { kind: "piece", i }, `a hit on piece ${i} selects it`);
  });
  assert.equal(BAKKAL.pieces.some(p => p.id?.startsWith("@")), false, "the document itself is untouched");
});

test("a hit selects its thing, and a selection names its target", () => {
  const counter = BAKKAL.pieces.findIndex(p => p.kit === "counter");
  assert.deepEqual(selOfTarget(BAKKAL, `piece:@${counter}`), { kind: "piece", i: counter });
  assert.deepEqual(selOfTarget(BAKKAL, "obj:ekmek#1"), { kind: "prop", id: "ekmek" });
  assert.equal(selOfTarget(BAKKAL, "obj:nothing"), null);
  assert.equal(selOfTarget(BAKKAL, "ch:nima.head"), null);
  assert.equal(targetOf(BAKKAL, { kind: "piece", i: counter }), `piece:@${counter}`);
  assert.equal(targetOf(BAKKAL, { kind: "piece", i: BAKKAL.pieces.findIndex(p => p.id === "door") }), "piece:door");
});

test("moving a piece pins its seed; a prop on a mark moves free at the mark's height", () => {
  const i = BAKKAL.pieces.findIndex(p => p.kit === "counter");
  const before = pieceSeed(BAKKAL, BAKKAL.pieces[i]);
  const out = move(BAKKAL, { kind: "piece", i }, 1.234, -0.5);
  assert.deepEqual([out.pieces[i].x, out.pieces[i].z], [1.23, -0.5]);
  assert.equal(pieceSeed(out, out.pieces[i]), before);
  const withProp = { ...BAKKAL, props: { ...BAKKAL.props, cup: { kit: "tea", at: "fridge" } } };
  const moved = nudge(withProp, { kind: "prop", id: "cup" }, 0.1, 0);
  assert.deepEqual(moved.props!.cup.at, { x: BAKKAL.marks.fridge.x + 0.1, y: BAKKAL.marks.fridge.y, z: BAKKAL.marks.fridge.z });
  assert.deepEqual(posOf(move(BAKKAL, { kind: "mark", id: "front" }, 0, 0), { kind: "mark", id: "front" }), { x: 0, y: 0, z: 0 });
});

test("remove and duplicate", () => {
  assert.equal(remove(BAKKAL, { kind: "piece", i: 0 }).pieces.length, BAKKAL.pieces.length - 1);
  assert.equal(remove(BAKKAL, { kind: "mark", id: "front" }).marks.front, undefined);
  const i = BAKKAL.pieces.findIndex(p => p.id === "door");
  const d = duplicate(BAKKAL, { kind: "piece", i });
  const copy = d.doc.pieces[d.doc.pieces.length - 1];
  assert.equal(copy.id, undefined, "a copy drops the id: ids are unique");
  assert.equal(copy.seed, pieceSeed(BAKKAL, BAKKAL.pieces[i]), "and keeps the art");
  const p = duplicate(BAKKAL, { kind: "prop", id: "ekmek" });
  assert.deepEqual(p.sel, { kind: "prop", id: "ekmek2" });
});

test("new ids, and the heights things sit at", () => {
  assert.equal(nextId(["a"], "mark"), "mark1");
  assert.equal(nextId(["mark1"], "mark"), "mark2");
  assert.equal(nextId(["ekmek"], "ekmek"), "ekmek2");
  assert.equal(nextId([], "ekmek"), "ekmek");
  const h = heights(BAKKAL);
  assert.deepEqual(h[0], { y: 0, label: "0 · floor", n: 0 });
  assert.equal(heightOn(BAKKAL, "counter"), 0.9, "the height most things on the counter use");
  assert.equal(heightOn(BAKKAL, "flowers"), 0);
  assert.ok(h.some(x => x.label === "0.9 · counter" && x.kit === "counter"), JSON.stringify(h));
  assert.ok(h.some(x => x.label === "1.4 · shelf"), JSON.stringify(h));
});
