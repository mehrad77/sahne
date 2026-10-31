// server/call.ts: any MCP tool from the shell. kit_render and draft_kit_item (one item and a list of them) write a PNG and
// print its path, an error is exit code 1, and a --session keeps one server process across calls, starts a new one when a
// watched source changed, and stops on request. Its socket, log and default --out are in a private folder, a call that gets
// no answer gives up with a clear error, and two calls at once never write one PNG. On a temp copy of the samples.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, callDir, notStarted, pngName, privateDir, sockOf, timeoutOf } from "../server/call.ts";

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

test("kit_render of one item saves its sheet as a PNG and prints the path first, also as latest.png; the JSON only with --json", () => {
  const r = call("kit_render", JSON.stringify({ id: "chair" }));
  assert.equal(r.status, 0, r.stderr);
  const files = pngs(r.stdout);
  assert.equal(files.length, 1);
  assert.ok(isPng(files[0]), "the file is a PNG");
  assert.match(r.stdout, /^image: /, "the picture's path is the first line");
  assert.deepEqual(readFileSync(join(out, "latest.png")), readFileSync(files[0]), "latest.png is the newest picture");
  assert.doesNotMatch(r.stdout, /^\{/m, "no JSON block by default");
  assert.match(r.stdout, /^data: \{"id":"chair",.*\}$/m, "the data on one line");
  assert.match(call("kit_render", JSON.stringify({ id: "chair" }), "--json").stdout, /^\{\n "id": "chair"/m);
  assert.match(call("kit_search", JSON.stringify({ query: "cup" })).stdout, /"id": "cup"/, "an answer with no picture still prints its data");
});

test("kit_render of a list of items draws one sheet, with the problems of each", () => {
  const r = call("kit_render", JSON.stringify({ items: [{ id: "chair" }, { id: "frontage", variant: "firin" }, { doc: doc("x_board_a", "Menu") }] }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(pngs(r.stdout).length, 1, "one picture for three items");
  assert.match(r.stdout, /^3 items, 6 cells on one sheet: 0 errors, 0 warnings$/m);
  for (const [n, id] of [["1-2", "chair"], ["3-4", "frontage · firin"], ["5-6", "x_board_a"]]) assert.match(r.stdout, new RegExp(`^  ${n}  ${id}`, "m"), "each cell's number says what it shows");
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
  assert.match(two.stdout, /^2 items, 4 cells on one sheet/m);
  const piped = spawnSync(process.execPath, [CALL, "draft_kit_item", "-", "--content", root, "--out", out], { encoding: "utf8", env: ENV, input: JSON.stringify({ doc: doc("x_board_c", "Oui") }) });
  assert.equal(piped.status, 0, piped.stderr);
  assert.match(piped.stdout, /^x_board_c: 0 errors/m);
});

test("a tool error is exit code 1 with the answer on stderr; list and read work", () => {
  const bad = call("kit_render", JSON.stringify({ id: "no_such_thing" }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no set piece or prop no_such_thing/);
  const some = call("kit_render", JSON.stringify({ items: ["chair", "chiar"] }));
  assert.equal(some.status, 1);
  assert.equal(pngs(some.stdout).length, 1, "the sheet's path on stdout, though the call failed");
  assert.match(some.stderr, /^error: item 2: there is no set piece or prop chiar/m);
  const notJson = call("kit_render", "{nope");
  assert.equal(notJson.status, 1);
  assert.match(notJson.stderr, /not JSON/);
  const list = call("list");
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /^usage: call\.ts <tool>/, "list starts with the usage");
  assert.match(list.stdout, /^kit_render +A sheet of numbered cells/m, "a line a tool");
  assert.doesNotMatch(list.stdout, /input: \{/, "no schemas in the list");
  assert.ok(list.stdout.split("\n").length < 60, "the list is short");
  assert.match(call("list", "kit_render").stdout, /^kit_render\n.*\n  input: \{/);
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
  assert.match(call("kit_read", JSON.stringify({ id: "x_saved_board" })).stdout, /^data: .*"doc":\{"id":"x_saved_board"/m, "a saved drawing's document, without --json");
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

test("a session that did not start says why: the last lines of its log", () => {
  const log = join(watch, "fail.log");
  writeFileSync(log, "starting\nTypeError: x is not defined\n    at gen.ts:3\n");
  assert.match(notStarted("kit", log), /did not start:\n[^]*TypeError: x is not defined[^]*the whole log: /);
  assert.match(notStarted("kit", join(watch, "none.log")), /did not start \(the whole log/);
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

test("the session's folder is private: made 0700, a group-readable one is closed, a link refused", () => {
  const base = mkdtempSync(join(tmpdir(), "backstage-call-priv-"));
  try {
    const d = privateDir(join(base, "a"));
    assert.equal(statSync(d).mode & 0o777, 0o700);
    mkdirSync(join(base, "open"), { mode: 0o755 });
    chmodSync(join(base, "open"), 0o777);
    assert.equal(statSync(privateDir(join(base, "open"))).mode & 0o777, 0o700, "an open folder of ours is closed");
    symlinkSync(d, join(base, "link"));
    assert.throws(() => privateDir(join(base, "link")), /not a folder of its own/);
    writeFileSync(join(base, "file"), "");
    assert.throws(() => privateDir(join(base, "file")));
    // the socket is in the user's own folder under the temp dir, never a shared /tmp
    const dir = callDir(base);
    assert.equal(dirname(sockOf("x", dir)), dir);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
    assert.notEqual(sockOf("x", dir), sockOf("y", dir));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("with a temp dir too long for a socket, the folder is <cache>/sahne-call (0700), not /tmp", () => {
  const base = mkdtempSync(join(tmpdir(), "c")), long = join(base, "x".repeat(120)), cache = join(base, "h");
  try {
    const dir = callDir(long, cache);
    assert.equal(dir, join(cache, "sahne-call"));
    assert.equal(statSync(dir).mode & 0o777, 0o700);
    assert.ok(Buffer.byteLength(sockOf("a long session name", dir)) <= 103);
    assert.throws(() => callDir(long, long), /too long/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("a session that never answers is given up on after the timeout, with a clear error", async () => {
  const dir = privateDir(mkdtempSync(join(tmpdir(), "backstage-call-mute-"))), path = join(dir, "mute.sock");
  const mute = createServer(() => {}); // accepts, never answers
  await new Promise<void>(r => mute.listen(path, () => r()));
  try {
    const t0 = Date.now();
    await assert.rejects(ask(path, { op: "status" }, 300, "mute"), /session mute did not answer within 0\.3 s.*--timeout.*--session mute --stop/s);
    assert.ok(Date.now() - t0 < 3000);
    assert.equal(await ask(join(dir, "none.sock"), { op: "status" }, 300), null, "nothing listening is null, at once");
    assert.equal(timeoutOf("2.5"), 2500);
    assert.throws(() => timeoutOf("soon"), /--timeout/);
  } finally { mute.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("the default --out is a private folder, and two calls at once into one --out write two PNGs", async () => {
  const one = spawnSync(process.execPath, [CALL, "kit_render", JSON.stringify({ id: "chair" }), "--content", root], { encoding: "utf8", env: ENV });
  assert.equal(one.status, 0, one.stderr);
  const file = pngs(one.stdout)[0];
  assert.equal(statSync(dirname(file)).mode & 0o777, 0o700);
  rmSync(dirname(file), { recursive: true, force: true });
  assert.notEqual(pngName("kit_render", 1), pngName("kit_render", 1));
  const shared = mkdtempSync(join(tmpdir(), "backstage-call-both-"));
  try {
    const run = () => new Promise<string>((res, rej) => {
      const p = spawn(process.execPath, [CALL, "kit_render", JSON.stringify({ id: "chair" }), "--content", root, "--out", shared], { env: ENV });
      let o = "";
      p.stdout.on("data", d => { o += d; });
      p.on("exit", code => (code === 0 ? res(o) : rej(new Error(`exit ${code}`))));
    });
    const [a, b] = await Promise.all([run(), run()]);
    const files = [...pngs(a), ...pngs(b)];
    assert.equal(new Set(files).size, 2, "two names");
    for (const f of files) assert.ok(isPng(f));
  } finally { rmSync(shared, { recursive: true, force: true }); }
});

test("a drawing the schema refuses is answered with a hint at the usual mistake", () => {
  const bad = doc("x_board_bad", "Menu");
  (bad.kinds.default.flats[0].shapes as unknown[]).push({ d: "M0 0H5", fill: "none", stroke: "#2F3B35", strokeWidth: 0.6 });
  const r = call("draft_kit_item", JSON.stringify({ doc: bad }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /strokeWidth/);
  assert.match(r.stderr, /^hint: a shape is \{ d, fill\?, stroke\?: \{ color, width, cap\? \}/m);
  assert.match(r.stderr, /^hint: a colour is "#RRGGBB"/m);
  assert.equal(r.stderr.match(/^hint: a shape/gm)?.length, 1, "each hint once");
});
