// The server (server/http.ts) on a temp copy of the samples, as an app runs it: it lists the series, its seasons and
// episodes; a save writes only what changed; an edit that brings an error is refused (422) and writes nothing; a file
// changed on disk is not overwritten (409); new ids are checked and old ones never change; it answers this machine only;
// and a read-only backstage writes nothing.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CLI = fileURLToPath(new URL("../server/cli.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-"));
cpSync(SAMPLES, root, { recursive: true });

function start(args: string[]): Promise<{ url: string; p: ChildProcess }> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [CLI, "--port", "0", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const onData = (d: Buffer) => { out += d; const m = /sahne-backstage on (http:\/\/localhost:\d+\/)/.exec(out); if (m) res({ url: m[1], p }); };
    p.stdout!.on("data", onData); p.stderr!.on("data", onData);
    p.on("exit", c => rej(new Error(`exited ${c}: ${out}`)));
  });
}

let rw: { url: string; p: ChildProcess }, ro: { url: string; p: ChildProcess };
before(async () => { [rw, ro] = await Promise.all([start(["--content", root, "--write"]), start([])]); });
after(() => { rw?.p.kill(); ro?.p.kill(); rmSync(root, { recursive: true, force: true }); });

const call = async (base: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(base + "api/" + path, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
};
const file = join(root, "stories", "s1e00.json");

test("the world: the series, its seasons, the episodes, the cast and the places", async () => {
  const r = await call(rw.url, "GET", "world");
  assert.equal(r.status, 200);
  assert.equal(r.body.series.id, "samples");
  assert.ok(r.body.seasons.s1);
  assert.deepEqual(r.body.episodes.map((e: { id: string }) => e.id), ["s1e00"]);
  assert.ok(r.body.characters.ismail && r.body.places.bakkal);
  assert.equal(r.body.writable, true);
  assert.equal(r.body.samples, false);
});

test("a save writes the edit and nothing else", async () => {
  const before = readFileSync(file, "utf8");
  const { body: { doc, mtime } } = await call(rw.url, "GET", "doc/story/s1e00");
  const i = doc.steps.findIndex((s: { who?: string }) => s.who === "ismail");
  const old = doc.steps[i].en;
  doc.steps[i].en = "Good evening! What would you like?";
  const r = await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc, mtime }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const now = readFileSync(file, "utf8");
  const a = before.split("\n"), b = now.split("\n");
  assert.equal(a.length, b.length);
  const changed = b.filter((l, k) => l !== a[k]);
  assert.equal(changed.length, 1);
  assert.ok(changed[0].includes("What would you like?") && a.some(l => l.includes(JSON.stringify(old))));
});

test("an edit that brings an error is refused and writes nothing; one the file had does not block", async () => {
  const { body: { doc, mtime } } = await call(rw.url, "GET", "doc/story/s1e00");
  const before = readFileSync(file, "utf8");
  delete doc.quiz;
  const r = await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc, mtime }] });
  assert.equal(r.status, 422);
  assert.ok(r.body.problems.some((p: { new?: boolean; level: string; message: string }) => p.new && p.level === "error" && /quiz/.test(p.message)));
  assert.equal(readFileSync(file, "utf8"), before);
  const c = await call(rw.url, "POST", "check", { edits: [{ kind: "story", id: "s1e00", doc }] });
  assert.ok(c.body.problems.some((p: { new?: boolean }) => p.new));
});

test("a file changed on disk since it was opened is not overwritten", async () => {
  const { body: { doc, mtime } } = await call(rw.url, "GET", "doc/story/s1e00");
  const t = new Date(Date.now() + 5000);
  utimesSync(file, t, t);
  doc.titleEn = "Changed";
  const r = await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc, mtime }] });
  assert.equal(r.status, 409);
});

test("ids: never renamed, new ones checked, none outside the root", async () => {
  const { body: { doc, mtime } } = await call(rw.url, "GET", "doc/story/s1e00");
  assert.equal((await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc: { ...doc, id: "s1e01" }, mtime }] })).status, 400);
  assert.equal((await call(rw.url, "GET", "doc/story/..%2F..%2Fpackage")).status, 404);
  assert.equal((await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "../x", doc }] })).status, 400);
  assert.equal((await call(rw.url, "POST", "save", { edits: [{ kind: "character", id: "ada", doc: { id: "ada" }, create: true }] })).body.message, "ada is a retired character id");
  assert.match((await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc, create: true }] })).body.message, /exists already/);
});

test("it answers this machine only, and a write is JSON", async () => {
  assert.equal((await call(rw.url, "GET", "world", undefined, { origin: "https://example.com" })).status, 403);
  const r = await fetch(rw.url + "api/save", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(r.status, 415);
});

test("a read-only backstage on the samples writes nothing", async () => {
  const w = await call(ro.url, "GET", "world");
  assert.equal(w.body.samples, true);
  assert.equal(w.body.writable, false);
  const { body: { doc, mtime } } = await call(ro.url, "GET", "doc/story/s1e00");
  const r = await call(ro.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc: { ...doc, titleEn: "x" }, mtime }] });
  assert.equal(r.status, 403);
});

test("the page and its bundle are served", async () => {
  const page = await fetch(rw.url);
  assert.match(await page.text(), /dist\/app\/index\.js/);
  const js = await fetch(rw.url + "dist/app/index.js");
  assert.equal(js.status, 200);
  assert.ok((await js.text()).length > 10000);
});
