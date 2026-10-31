// The kit page's shelves (src/model/kitgroups.ts): on the full kit, every tag a prop or set piece carries belongs to a
// shelf (a new tag gets one, or its items fall to "Other" unseen), and every emotion and sound has a shelf of its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import full from "sahne-kit/full";
import { EMOTION_SHELVES, OTHER, PROP_SHELVES, SET_SHELVES, SOUND_SHELVES, gestureShelf, shelfOf, shelvesWith } from "../src/model/kitgroups.ts";

test("every prop and set piece tag is on a shelf", () => {
  for (const [which, shelves] of [["props", PROP_SHELVES], ["set", SET_SHELVES]] as const) {
    const loose = new Set<string>();
    for (const def of Object.values(full[which])) for (const t of def.meta?.tags ?? []) if (shelfOf(shelves, [t]) === OTHER) loose.add(t);
    assert.deepEqual([...loose], [], `${which}: tags on no shelf`);
  }
});

test("an item goes on the shelf of its first tag that has one; untagged ones on Other", () => {
  assert.equal(shelfOf(PROP_SHELVES, ["nope", "metro", "food"]).id, "transport");
  assert.equal(shelfOf(PROP_SHELVES, undefined), OTHER);
});

test("emotions, sounds and gestures all have shelves", () => {
  for (const e of Object.keys(full.face.emotions)) assert.notEqual(shelfOf(EMOTION_SHELVES, [e]), OTHER, e);
  for (const s of Object.values(full.sounds ?? {})) assert.notEqual(shelfOf(SOUND_SHELVES, [s.bus]), OTHER);
  assert.equal(gestureShelf(["target", "prop"]).id, "prop");
  assert.equal(gestureShelf(undefined).id, "alone");
});

test("shelvesWith counts and keeps the order, Other last, empty shelves out", () => {
  const got = shelvesWith(SOUND_SHELVES, ["ambience", "other", "ambience"], x => x);
  assert.deepEqual(got.map(g => [g.shelf.id, g.n]), [["ambience", 2], ["other", 1]]);
});

test("every transit piece lands on the Transport shelf", () => {
  for (const id of ["double_decker", "city_bus", "train", "black_cab", "gondola", "canal_boat", "bike", "vespa"])
    assert.equal(shelfOf(SET_SHELVES, full.set[id]?.meta?.tags).id, "transport", id);
});
