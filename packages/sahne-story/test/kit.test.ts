// A content root's own kit items (paths.ts kit/, load.ts `loadContentKit`): pieces/<id>.json and variants/<of>.<name>.json are
// read and checked; a file that is not good (not JSON, off the schema, named for another id, taken, naming a generator the kit
// lacks) is left out and named, and the rest still join the kit through `withDrawings`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import full from "../../sahne-kit/src/full.ts";
import { withDrawings, type DrawingDoc } from "../../sahne-kit/src/drawing.ts";
import { loadContentKit } from "../load.ts";
import { kitPieceFile, kitPieceIds, kitVariantFile, kitVariantIds } from "../paths.ts";

const piece = (id: string): DrawingDoc => ({
  id, as: "prop", about: "A small tin box with a lid, for tests.", tags: ["box"],
  kinds: { tin: { size: [10, 8], ppcm: 8, grip: [0, -4], flats: [{ shapes: [{ d: "M-5 0V-8H5V0Z", fill: "#B9B4A8" }] }] } },
});

test("kit/ paths name the files and list the ids", () => {
  assert.ok(kitPieceFile("x_tin").pathname.endsWith("/kit/pieces/x_tin.json"));
  assert.ok(kitVariantFile("flag", "x_blue").pathname.endsWith("/kit/variants/flag.x_blue.json"));
  assert.deepEqual(kitPieceIds(new URL("nope/", import.meta.url)), []);
  assert.deepEqual(kitVariantIds(new URL("nope/", import.meta.url)), []);
});

test("loadContentKit keeps the good items and names each bad file", () => {
  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  try {
    mkdirSync(join(dir, "kit/pieces"), { recursive: true }); mkdirSync(join(dir, "kit/variants"), { recursive: true });
    const w = (f: string, v: unknown) => writeFileSync(join(dir, "kit", f), typeof v === "string" ? v : JSON.stringify(v));
    w("pieces/x_tin.json", piece("x_tin"));
    w("pieces/x_other.json", piece("x_named_otherwise"));
    w("pieces/x_broken.json", "{ not json");
    w("pieces/x_nobody.json", { ...piece("x_nobody"), kinds: {} });
    w("pieces/x_twin.json", piece("x_twin"));
    w("variants/x_tin.x_taller.json", { of: "x_tin", name: "x_taller", params: { nope: 1 } });
    w("variants/flag.x_wrong.json", { of: "flag", name: "x_named_otherwise", params: { nope: 1 } });
    const root = pathToFileURL(dir + "/");
    const bare = loadContentKit({ root });
    assert.deepEqual(bare.docs.map(d => "of" in d ? `${d.of}.${d.name}` : d.id), ["x_tin", "x_twin", "x_tin.x_taller"], "alone, each good file is kept");
    const problems = bare.problems.join("\n");
    assert.match(problems, /flag\.x_wrong\.json: the file is named for flag\.x_wrong but holds flag\.x_named_otherwise/);
    assert.match(problems, /x_broken\.json/); assert.match(problems, /x_other\.json: the file is named for x_other but holds x_named_otherwise/); assert.match(problems, /x_nobody\.json/);
    const against = loadContentKit({ root, kit: full });
    const names = against.docs.map(d => "of" in d ? `${d.of}.${d.name}` : d.id);
    assert.ok(names.includes("x_tin") && names.includes("x_twin"));
    assert.ok(!names.includes("x_tin.x_taller"), "a variant naming a param the generator does not declare is left out");
    assert.match(against.problems.join("\n"), /x_taller/);
    const kit = withDrawings(full, against.docs);
    assert.ok(kit.props.x_tin && kit.props.x_twin && !full.props.x_tin, "the kit gets the items and the original is untouched");
    assert.deepEqual(loadContentKit({ root: pathToFileURL(join(dir, "none") + "/") }), { docs: [], problems: [] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a variant with an illegal value, or a piece the kit checks refuse, is left out and named", () => {
  const dir = mkdtempSync(join(tmpdir(), "kit-"));
  try {
    mkdirSync(join(dir, "kit/pieces"), { recursive: true }); mkdirSync(join(dir, "kit/variants"), { recursive: true });
    const withN = { ...piece("x_tin"), params: { shade: { type: "enum", values: ["a", "b"], default: "a" } } };
    writeFileSync(join(dir, "kit/pieces/x_tin.json"), JSON.stringify(withN));
    writeFileSync(join(dir, "kit/variants/x_tin.x_bad.json"), JSON.stringify({ of: "x_tin", name: "x_bad", params: { shade: "zzz" } }));
    writeFileSync(join(dir, "kit/variants/x_tin.x_good.json"), JSON.stringify({ of: "x_tin", name: "x_good", params: { shade: "b" } }));
    const r = loadContentKit({ root: pathToFileURL(dir + "/"), kit: full });
    const names = r.docs.map(d => "of" in d ? `${d.of}.${d.name}` : d.id);
    assert.ok(names.includes("x_tin.x_good") && !names.includes("x_tin.x_bad"));
    assert.match(r.problems.join("\n"), /x_bad\.json: shade: "zzz"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
