// The gallery's content kit (data.mjs `kit`): a content root's kit items checked against the whole kit one at a time, as
// backstage checks them, so one bad file (a variant naming a param its generator does not have) leaves out only itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HERE = resolve(import.meta.dirname, "..");

test("one bad kit file leaves out only itself", () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "sahne-gallery-kit-"));
  mkdirSync(join(root, "kit/pieces"), { recursive: true });
  mkdirSync(join(root, "kit/variants"), { recursive: true });
  copyFileSync(join(HERE, "../sahne-story/samples/kit/pieces/x_cafe_chalkboard.json"), join(root, "kit/pieces/x_cafe_chalkboard.json"));
  writeFileSync(join(root, "kit/variants/chair.x_tall.json"), JSON.stringify({ of: "chair", name: "x_tall", params: { heightish: 3 } }));
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `const { DATA } = await import(${JSON.stringify(new URL("../data.mjs", import.meta.url).href)}); console.log(JSON.stringify((await DATA.kit()).map(d => d.id ?? d.of + "." + d.name)));`], { cwd: HERE, encoding: "utf8", env: { ...process.env, SAHNE_CONTENT: root } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim().split("\n").pop()!), ["x_cafe_chalkboard"]);
});
