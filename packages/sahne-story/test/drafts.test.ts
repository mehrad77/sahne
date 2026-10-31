// Every story (storyIds in paths.ts) is checked, with no test of its own to write: the folder is
// listed the way the gallery's dev server lists it, and each draft goes through the whole story check
// (schema, calendar, ref, cast, counts, flags, quiz, text, the stage lints, the places it visits).

import { test } from "node:test";
import assert from "node:assert/strict";
import { placeSolids } from "sahne";
import kit from "../../sahne-kit/src/full.ts";
import { loadCards, loadNeeds } from "../load.ts";
import { checkAll } from "../check/rules.ts";
import { loadWorld } from "../check/world.ts";

const world = loadWorld();
const needs = loadNeeds();
const solids = Object.fromEntries(world.drafts.map(d => [d.story.id, Object.fromEntries(Object.entries(world.places).map(([id, p]) => [id, placeSolids(p, kit)]))]));

test("there are drafts", () => {
  assert.ok(world.drafts.length >= 1);
});

test("every draft, character and place passes the story check with no errors", () => {
  const errors = checkAll(world, { kit, cards: loadCards(), needs, solids }).filter(p => p.level === "error");
  assert.deepEqual(errors.map(p => `${p.story}${p.step !== undefined ? ` step ${p.step}` : ""} [${p.rule}] ${p.message}`), []);
});

