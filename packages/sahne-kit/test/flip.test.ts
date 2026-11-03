// flip mirrors a shape's clip with its path, so a clipped shape (a flag's saltire) still shows facing left.

import { test } from "node:test";
import assert from "node:assert/strict";
import { rect, rng } from "sahne";
import { flip } from "../src/set/draw.ts";
import { person, personFlats } from "../src/set/people.ts";

const overlap = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const clipsOf = (s: { clip?: unknown }) => (s.clip ? (Array.isArray(s.clip) ? s.clip : [s.clip]) : []) as { bounds(): number[] }[];

test("flip mirrors a single clip and a list of clips", () => {
  const [s, t] = flip([{ path: rect(10, 0, 5, 5), fill: "#000000", clip: rect(9, -1, 7, 7) }, { path: rect(10, 0, 5, 5), fill: "#000000", clip: [rect(9, -1, 7, 7)] }], -1);
  for (const x of [s, t]) for (const c of clipsOf(x)) assert.ok(overlap(x.path.bounds(), c.bounds()), "clip follows the path");
});

test("a Scottish or UK hand flag keeps its saltire when its carrier walks left", () => {
  for (const country of ["gb", "gb_sct"]) {
    const r = rng("flag");
    let pp = person(r, { flags: 1, umbrellas: 0 });
    for (let i = 0; i < 200 && !pp.flag; i++) pp = person(r, { flags: 1, umbrellas: 0 });
    assert.ok(pp.flag);
    const flats = personFlats(pp, "walk", { dir: -1, at: [0, 0], mute: 0.3, flagState: "flags", flagCountry: country });
    let clipped = 0;
    for (const f of flats) for (const s of f.group.shapes) for (const c of clipsOf(s)) { clipped++; assert.ok(overlap(s.path.bounds(), c.bounds()), `${country}: a shape clipped away`); }
    assert.ok(clipped > 1, country);
  }
});
