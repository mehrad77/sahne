// Every draft plays to the end with every choice: each option of each
// choice is performed with the other picks at their defaults, once without flags and once with every
// flag the story reads, and the option picked is the one that is said.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlaceDoc } from "sahne";
import { adaptStory, isChoice, type Step } from "../src/index.ts";
import { loadWorld } from "../check/world.ts";

const world = loadWorld();
const places = world.places as unknown as Record<string, PlaceDoc>;

/** Every flag a story's steps, options and replies test with `if` or `unless`. */
function flagsRead(steps: Step[]): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const k of ["if", "unless"]) if (typeof o[k] === "string") out.add(o[k] as string);
    Object.values(o).forEach(walk);
  };
  walk(steps);
  return [...out];
}

for (const d of world.drafts) {
  test(`${d.id}: every option of every choice plays to the end`, () => {
    const read = flagsRead(d.story.steps);
    for (const flags of read.length ? [[], read] : [[]]) {
      const a = adaptStory(structuredClone(d.story), { places, characters: d.characters, flags });
      assert.ok(a.perform().script.cues.length > 0, `${d.id}: the default picks play`);
      for (const s of d.story.steps) {
        if (!isChoice(s)) continue;
        s.choice.options.forEach((_, k) => {
          const { script, info } = a.perform({ [s.choice.id]: k });
          assert.ok(script.cues.length > 0, `${d.id} ${s.choice.id} option ${k}`);
          assert.equal(script.cues.length, info.length);
          const said = info.filter(i => i.option !== undefined && i.kind === "say");
          if (said.length) assert.ok(said.some(i => i.option === k), `${d.id} ${s.choice.id}: option ${k} is the one said`);
        });
      }
    }
  });
}
