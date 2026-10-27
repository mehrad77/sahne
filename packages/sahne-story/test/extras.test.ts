// The generic extras (cast/extras.ts): the generator is deterministic, its files
// among the characters are current, every extra passes the cast check, and the check catches a broken extra.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import kit from "../../sahne-kit/src/full.ts";
import { buildExtras, staleExtras, SPECS, ORDER_FROM } from "../cast/extras.ts";
import { checkCast, type CheckProblem } from "../check/rules.ts";
import { loadWorld, type World } from "../check/world.ts";
import { EXTRAS, repoPath } from "../paths.ts";

const world = loadWorld();
const extraErrors = (w: World): CheckProblem[] => checkCast(w, { kit }).filter(p => p.level === "error" && p.story.startsWith("extra:"));

test("the generator is deterministic: two runs write the same files", () => {
  assert.deepEqual([...buildExtras()], [...buildExtras()]);
});

test("the extras' files are current (node packages/sahne-story/cast/extras.ts --check)", () => {
  assert.deepEqual(staleExtras(), []);
  assert.equal(Object.keys(world.extras).length, SPECS.length);
});

test("every extra is a character document of kind extra that passes the cast check", () => {
  assert.deepEqual(extraErrors(world), []);
  for (const [id, x] of Object.entries(world.extras)) {
    const c = x as { kind: string; order: number; avatar?: unknown };
    assert.equal(c.kind, "extra", id);
    assert.ok(c.order >= ORDER_FROM, id);
    assert.ok(c.avatar, id);
    assert.equal(world.cast[id], undefined, `${id} is not a roster id`);
  }
});

test("the check catches a broken extra", () => {
  const with_ = (edit: (x: Record<string, any>) => void): CheckProblem[] => {
    const extras = structuredClone(world.extras) as Record<string, Record<string, any>>;
    edit(extras.clerk_goc);
    return extraErrors({ ...world, extras });
  };
  const has = (ps: CheckProblem[], re: RegExp) => assert.ok(ps.some(p => re.test(p.message)), JSON.stringify(ps.map(p => p.message)));
  has(with_(x => { x.id = "clerk"; }), /characters\/clerk_goc\.json but the id is clerk/);
  has(with_(x => { x.kind = "cast"; }), /kind is cast; an extra's is extra/);
  has(with_(x => { x.order = 50; }), /order 50; an extra's is 100 or more/);
  has(with_(x => { x.avatar.outfit.top.colors = ["fab_99"]; }), /normalize changes outfit\.top\.colors/);
  has(with_(x => { x.avatar.wear.neck = { id: "neck_nope" }; }), /wear\.neck neck_nope unknown/);
  // a stale file is found
  const want = buildExtras(), f = [...want.keys()][0];
  want.set(f, want.get(f)!.replace('"kind": "extra"', '"kind": "extra" '));
  assert.deepEqual(staleExtras(undefined, want), [`stale: ${repoPath(new URL(f, EXTRAS))}`]);
});

test("the extras share the characters' folder: only kind extra is theirs", () => {
  const tmp = mkdtempSync(join(tmpdir(), "extras-")), dir = pathToFileURL(`${tmp}/`), want = buildExtras(), [f, g] = [...want.keys()];
  for (const [name, text] of want) writeFileSync(new URL(name, dir), text);
  writeFileSync(new URL("farzad.json", dir), JSON.stringify({ id: "farzad", kind: "cast" }));
  assert.deepEqual(staleExtras(dir, want), [], "a roster character beside the extras is not theirs");
  writeFileSync(new URL("someone.json", dir), JSON.stringify({ id: "someone", kind: "extra" }));
  writeFileSync(new URL(f, dir), JSON.stringify({ id: f.slice(0, -5), kind: "cast" }));
  rmSync(new URL(g, dir));
  const bad = staleExtras(dir, want);
  assert.ok(bad.some(b => b.startsWith("taken: ") && b.includes(f)), bad.join("\n"));
  assert.ok(bad.some(b => b.startsWith("missing: ") && b.includes(g)), bad.join("\n"));
  assert.ok(bad.some(b => b.startsWith("not one of the extras: ") && b.includes("someone.json")), bad.join("\n"));
  assert.equal(bad.length, 3, bad.join("\n"));
  rmSync(tmp, { recursive: true });
});
