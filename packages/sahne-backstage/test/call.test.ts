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
import { ask, callDir, pngName, privateDir, sockOf, timeoutOf } from "../server/call.ts";

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
