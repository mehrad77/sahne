// promote.ts --check holds the drawings already in src/set/drawn/ to the official checks a promotion runs (`officialStale`), so a
// drawing added by hand in a pull request cannot take the id of its family's own generator (the family spreads its drawings
// last, which would silently replace it) or skip the rules on tags and `about`. Runs on a throwaway copy of the packages.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ownGenerators } from "../drawing/promote.ts";

const REPO = resolve(import.meta.dirname, "../../..");

function copyRepo(): string {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "sahne-official-test-"));
  cpSync(join(REPO, "packages"), join(dir, "packages"), { recursive: true, verbatimSymlinks: true, filter: s => !/sahne-gallery\/golden|promote-out|\/\.cache/.test(s) });
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"));
  return dir;
}
const official = (root: string) => spawnSync(process.execPath, [join(root, "packages/sahne-kit/drawing/promote.ts"), "--official"], { cwd: root, encoding: "utf8" });

test("a family's own generators are what its file defines without its drawings", () => {
  const own = ownGenerators("bakery");
  assert.ok(own.props.includes("deli") && own.props.includes("pastry"));
  assert.ok(!own.props.includes("salami"), "a promoted drawing is not the family's own generator");
});

test("the drawings in the kit pass the official checks; one added by hand under a generator's id, or with a bare about, does not", () => {
  const root = copyRepo(), drawn = join(root, "packages/sahne-kit/src/set/drawn/bakery");
  assert.equal(official(root).status, 0, official(root).stdout);
  const salami = JSON.parse(readFileSync(join(drawn, "salami.json"), "utf8"));
  writeFileSync(join(drawn, "deli.json"), JSON.stringify({ ...salami, id: "deli", credit: { ...salami.credit, from: "x_deli_copy" } }));
  writeFileSync(join(drawn, "cake.json"), JSON.stringify({ ...salami, id: "cake", about: "a cake", credit: { ...salami.credit, from: "x_cake" } }));
  const r = official(root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /bakery\/deli\.json: id deli is taken/);
  assert.match(r.stdout, /bakery\/cake\.json: about/);
  assert.doesNotMatch(r.stdout, /salami\.json/, "the item already in the kit is not its own clash");
});
