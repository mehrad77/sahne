// server/call.ts: any MCP tool from the shell. kit_render and draft_kit_item (one item and a list of them) write a PNG and
// print its path, an error is exit code 1, and a --session keeps one server process across calls, starts a new one when a
// watched source changed, and stops on request. On a temp copy of the samples.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CALL = fileURLToPath(new URL("../server/call.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-call-")), out = mkdtempSync(join(tmpdir(), "backstage-call-out-")), watch = mkdtempSync(join(tmpdir(), "backstage-call-watch-"));
cpSync(SAMPLES, root, { recursive: true });
writeFileSync(join(watch, "gen.ts"), "export {};\n");
const NAME = `test-${process.pid}`;
const ENV = { ...process.env, SAHNE_CALL_WATCH: watch } as Record<string, string>;
delete ENV.SAHNE_CONTENT;

const call = (...args: string[]) => spawnSync(process.execPath, [CALL, ...args, "--content", root, "--out", out], { encoding: "utf8", env: ENV });
const pngs = (stdout: string) => [...stdout.matchAll(/^image: (.+)$/gm)].map(m => m[1]);
const isPng = (file: string) => existsSync(file) && readFileSync(file).subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
const doc = (id: string, label: string) => ({
  id, as: "prop", about: "A small board.", tags: ["cafe"], terms: [], params: { label: { type: "text", default: label } },
  kinds: { default: { size: [40, 30], ppcm: 8, grip: [0, -15], flats: [{ shapes: [{ d: "M-20 0V-30H20V0Z", fill: "#2F3B35" }], text: [{ text: "$label", x: -18, y: -26, w: 36, h: 22, lang: "fr" }] }] } },
  repeat: { gap: 4 }, variants: {}, solid: null,
});
const status = () => /pid (\d+)/.exec(spawnSync(process.execPath, [CALL, "--session", NAME, "--status"], { encoding: "utf8", env: ENV }).stdout)?.[1];

after(() => { spawnSync(process.execPath, [CALL, "--session", NAME, "--stop"], { env: ENV }); for (const d of [root, out, watch]) rmSync(d, { recursive: true, force: true }); });

test("kit_render of one item saves its sheet as a PNG and prints the path", () => {
  const r = call("kit_render", JSON.stringify({ id: "chair" }));
  assert.equal(r.status, 0, r.stderr);
  const files = pngs(r.stdout);
  assert.equal(files.length, 1);
  assert.ok(isPng(files[0]), "the file is a PNG");
});

test("kit_render of a list of items draws one sheet, with the problems of each", () => {
  const r = call("kit_render", JSON.stringify({ items: [{ id: "chair" }, { id: "frontage", variant: "firin" }, { doc: doc("x_board_a", "Menu") }] }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(pngs(r.stdout).length, 1, "one picture for three items");
  assert.match(r.stdout, /3 items on one sheet/);
  for (const id of ["chair", "frontage", "x_board_a"]) assert.match(r.stdout, new RegExp(`^${id}: 0 errors`, "m"));
});

test("draft_kit_item takes one drawing or a list, from the argument, a file or stdin", () => {
  const one = call("draft_kit_item", JSON.stringify({ doc: doc("x_board_a", "Menu") }));
  assert.equal(one.status, 0, one.stderr);
  assert.ok(isPng(pngs(one.stdout)[0]));
  const file = join(watch, "docs.json");
  writeFileSync(file, JSON.stringify({ docs: [doc("x_board_a", "Menu"), doc("x_board_b", "Café")] }));
  const two = call("draft_kit_item", `@${file}`);
  assert.equal(two.status, 0, two.stderr);
  assert.equal(pngs(two.stdout).length, 1);
  assert.match(two.stdout, /2 items on one sheet/);
  const piped = spawnSync(process.execPath, [CALL, "draft_kit_item", "-", "--content", root, "--out", out], { encoding: "utf8", env: ENV, input: JSON.stringify({ doc: doc("x_board_c", "Oui") }) });
  assert.equal(piped.status, 0, piped.stderr);
  assert.match(piped.stdout, /^x_board_c: 0 errors/m);
});

test("a tool error is exit code 1 with the answer on stderr; list and read work", () => {
  const bad = call("kit_render", JSON.stringify({ id: "no_such_thing" }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no set piece or prop no_such_thing/);
  const notJson = call("kit_render", "{nope");
  assert.equal(notJson.status, 1);
  assert.match(notJson.stderr, /not JSON/);
  const list = call("list");
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /^kit_render\n/m);
  assert.match(list.stdout, /input: \{/);
  assert.match(call("list", "kit_render").stdout, /^kit_render/);
  assert.match(call("read", "sahne://kit-guide").stdout, /\S/);
  assert.equal(call("kit_save_nothing").status, 1);
});

test("a write tool needs --write; with it a saved drawing is seen by the next call", () => {
  const args = JSON.stringify({ doc: doc("x_saved_board", "Oui") });
  const no = call("save_kit_item", args);
  assert.equal(no.status, 1);
  assert.match(no.stderr, /read-only/);
  const yes = call("save_kit_item", args, "--write");
  assert.equal(yes.status, 0, yes.stderr);
  assert.ok(existsSync(join(root, "kit", "pieces", "x_saved_board.json")));
  assert.equal(call("kit_render", JSON.stringify({ id: "x_saved_board" })).status, 0);
});

test("--session keeps one server process, restarts it when a watched source changed, and stops on request", () => {
  const args = JSON.stringify({ id: "chair" });
  assert.equal(status(), undefined, "not running yet");
  const a = call("kit_render", args, "--session", NAME);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(isPng(pngs(a.stdout)[0]));
  const pid = status();
  assert.ok(pid, "running after the first call");
  assert.equal(call("kit_render", args, "--session", NAME).status, 0);
  assert.equal(status(), pid, "the same process served the second call");
  // a session serves one setup: asking for --write of a read-only one is refused, not served wrongly
  const wrong = call("save_kit_item", JSON.stringify({ doc: doc("x_late_board", "Oui") }), "--session", NAME, "--write");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /--stop/);
  // an edit to a watched TypeScript source starts a new process
  const later = new Date(Date.now() + 5000);
  utimesSync(join(watch, "gen.ts"), later, later);
  assert.match(spawnSync(process.execPath, [CALL, "--session", NAME, "--status"], { encoding: "utf8", env: ENV }).stdout, /source changed/);
  const b = call("kit_render", args, "--session", NAME);
  assert.equal(b.status, 0, b.stderr);
  assert.notEqual(status(), pid, "a new process drew it");
  assert.match(spawnSync(process.execPath, [CALL, "--session", NAME, "--stop"], { encoding: "utf8", env: ENV }).stdout, /stopped/);
  assert.equal(status(), undefined);
});

test("a running --write session reads the content root's kit fresh on every call", () => {
  const w = `${NAME}-w`, stop = () => spawnSync(process.execPath, [CALL, "--session", w, "--stop"], { env: ENV });
  try {
    assert.equal(call("kit_render", JSON.stringify({ id: "x_fresh_board" }), "--session", w, "--write").status, 1, "not there yet");
    const saved = call("save_kit_item", JSON.stringify({ doc: doc("x_fresh_board", "Oui") }), "--session", w, "--write");
    assert.equal(saved.status, 0, saved.stderr);
    const r = call("kit_render", JSON.stringify({ id: "x_fresh_board" }), "--session", w, "--write");
    assert.equal(r.status, 0, r.stderr);
    assert.ok(isPng(pngs(r.stdout)[0]));
  } finally { stop(); }
});
