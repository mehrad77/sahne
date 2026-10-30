// The server (server/http.ts) on a temp copy of the samples, as an app runs it: it lists the series, its seasons and
// episodes; a save writes only what changed; an edit that brings an error is refused (422) and writes nothing; a file
// changed on disk is not overwritten (409); new ids are checked and old ones never change; it answers this machine only;
// a read-only backstage writes nothing; a root still in the old language shape is shown upgraded but never saved; the
// guides are the two READMEs and nothing else; and the agents' page sees an MCP client's calls.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CLI = fileURLToPath(new URL("../server/cli.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-"));
cpSync(SAMPLES, root, { recursive: true });
// the person's settings, for the servers this file starts: a folder of its own, never the real one
const config = mkdtempSync(join(tmpdir(), "backstage-config-"));
process.env.SAHNE_BACKSTAGE_CONFIG = config;

function start(args: string[]): Promise<{ url: string; p: ChildProcess }> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [CLI, "--port", "0", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const onData = (d: Buffer) => { out += d; const m = /sahne-backstage on (http:\/\/localhost:\d+\/)/.exec(out); if (m) res({ url: m[1], p }); };
    p.stdout!.on("data", onData); p.stderr!.on("data", onData);
    p.on("exit", c => rej(new Error(`exited ${c}: ${out}`)));
    // a server that never says where it listens fails the file in a minute, rather than hanging the gate
    setTimeout(() => { p.kill(); rej(new Error(`no "sahne-backstage on" line in 60 s: ${out}`)); }, 60_000).unref();
  });
}

let rw: { url: string; p: ChildProcess }, ro: { url: string; p: ChildProcess };
before(async () => { [rw, ro] = await Promise.all([start(["--content", root, "--write"]), start([])]); });
/** End a spawned backstage and let go of its pipes, so nothing it started (its esbuild) keeps this test's process alive. */
const stop = (p?: ChildProcess) => new Promise<void>(r => {
  if (!p || p.exitCode !== null || p.signalCode !== null) { p?.stdout?.destroy(); p?.stderr?.destroy(); return r(); }
  p.once("exit", () => r());
  p.kill("SIGKILL");
  p.stdout?.destroy(); p.stderr?.destroy();
});
after(async () => { await Promise.all([stop(rw?.p), stop(ro?.p)]); rmSync(root, { recursive: true, force: true }); rmSync(config, { recursive: true, force: true }); });

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

test("an edit that breaks another document is refused: two stories on one date", async () => {
  const { skeleton } = await import("../src/model/skeleton.ts");
  const w = (await call(rw.url, "GET", "world")).body;
  const se = w.seasons.s1, arcId = Object.keys(se.arcs)[0];
  const s0 = (await call(rw.url, "GET", "doc/story/s1e00")).body.doc;
  const doc = skeleton({ id: "s1e02", season: 1, releaseDate: s0.releaseDate, kind: "episode", week: 0, arc: { ...se.arcs[arcId], id: arcId }, place: "bakkal", cast: ["ismail"],
    words: ["a1-w-a", "a1-w-b", "a1-w-c", "a1-w-d", "a1-w-e"], lessons: ["g_a1_2_var_yok"], title: { tr: "İkinci" }, level: "A1" }, { narrator: "kerim", standin: "nima", places: w.places });
  const r = await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e02", doc, create: true }] });
  assert.equal(r.status, 422);
  assert.ok(r.body.problems.some((p: { new?: boolean; message: string }) => p.new && /is also .*release date/.test(p.message)));
});

test("a file changed on disk since it was opened is not overwritten", async () => {
  const { body: { doc, mtime } } = await call(rw.url, "GET", "doc/story/s1e00");
  const t = new Date(Date.now() + 5000);
  utimesSync(file, t, t);
  doc.title.en = "Changed";
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
  const r = await call(ro.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc: { ...doc, title: { ...doc.title, en: "x" } }, mtime }] });
  assert.equal(r.status, 403);
});

test("review notes go to the sidecar, cleaned, never into a story", async () => {
  const story = readFileSync(file, "utf8");
  const r = await call(rw.url, "POST", "review", { id: "s1e00", review: { status: "reviewed", ai: true, reviewer: "Ada", steps: { "4": { reviewed: true, persian: true }, "5.1": { checked: ["fa", "en", "en", "x y"] }, "x": { reviewed: true } }, comments: [{ id: "c1", at: "4", by: "Ada", text: "Persian first", date: "2026-10-29 10:00" }, { text: "  " }], junk: 1 } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.episodes.s1e00, { status: "reviewed", ai: true, reviewer: "Ada", steps: { "4": { reviewed: true, persian: true }, "5.1": { checked: ["en", "fa"] } }, comments: [{ id: "c1", at: "4", by: "Ada", text: "Persian first", date: "2026-10-29 10:00" }] });
  assert.deepEqual(JSON.parse(readFileSync(join(root, ".backstage", "review.json"), "utf8")).episodes.s1e00.status, "reviewed");
  assert.equal(readFileSync(file, "utf8"), story);
  assert.equal((await call(rw.url, "POST", "review", { id: "../x", review: {} })).status, 400);
  assert.equal((await call(ro.url, "POST", "review", { id: "s1e00", review: {} })).status, 403);
  const all = await call(rw.url, "GET", "problems");
  assert.equal(all.status, 200);
  assert.ok(Array.isArray(all.body.problems));
});

test("a new episode's skeleton, with its calendar row, passes the story check and is created", async () => {
  const { skeleton } = await import("../src/model/skeleton.ts");
  const w = (await call(rw.url, "GET", "world")).body;
  const se = w.seasons.s1;
  const arcId = Object.keys(se.arcs)[0];
  const doc = skeleton({ id: "s1e01", season: 1, releaseDate: "2026-09-15", kind: "episode", week: 0, arc: { ...se.arcs[arcId], id: arcId }, place: "bakkal", cast: ["ismail"],
    words: ["a1-w-ekmek", "a1-w-su", "a1-w-cay", "a1-w-peynir", "a1-w-zeytin"], lessons: ["g_a1_2_var_yok"], title: { tr: "Ekmek var mı?" }, level: "A1" }, { narrator: "kerim", standin: "nima", places: w.places });
  const c = await call(rw.url, "POST", "check", { edits: [{ kind: "story", id: "s1e01", doc, create: true }] });
  assert.deepEqual(c.body.problems.filter((p: { level: string }) => p.level === "error"), []);
  const r = await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e01", doc, create: true }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(readFileSync(join(root, "stories", "s1e01.json"), "utf8").endsWith("}\n"));
  assert.equal((await call(rw.url, "POST", "save", { edits: [{ kind: "story", id: "s1e01", doc, create: true }] })).status, 400, "an id is created once");
});

test("a series started on a root with stories writes its seasons with it", async () => {
  const { startSeries } = await import("../src/model/series.ts");
  const bare = mkdtempSync(join(tmpdir(), "backstage-bare-"));
  cpSync(SAMPLES, bare, { recursive: true });
  rmSync(join(bare, "series.json")); rmSync(join(bare, "seasons"), { recursive: true });
  const b = await start(["--content", bare, "--write"]);
  try {
    const story = (await call(b.url, "GET", "doc/story/s1e00")).body.doc;
    const { series, seasons } = startSeries("demo", [story], { narrator: "kerim", standin: "nima" });
    assert.equal(seasons.length, 1);
    assert.deepEqual(Object.keys(seasons[0].arcs ?? {}), [story.arc.id]);
    const alone = await call(b.url, "POST", "save", { edits: [{ kind: "series", id: "series", doc: series, create: true }] });
    assert.equal(alone.status, 422, "a series alone leaves the stories without a season");
    const r = await call(b.url, "POST", "save", { edits: [{ kind: "series", id: "series", doc: series, create: true }, ...seasons.map(se => ({ kind: "season", id: se.id, doc: se, create: true }))] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(JSON.parse(readFileSync(join(bare, "seasons", "s1.json"), "utf8")).id, "s1");
  } finally { b.p.kill(); rmSync(bare, { recursive: true, force: true }); }
});

test("the page and its bundle are served", async () => {
  const page = await fetch(rw.url);
  assert.match(await page.text(), /dist\/app\/index\.js/);
  const js = await fetch(rw.url + "dist/app/index.js");
  assert.equal(js.status, 200);
  assert.ok((await js.text()).length > 10000);
});

test("a root in the old language shape opens upgraded and read-only, even with --write", async () => {
  const old = mkdtempSync(join(tmpdir(), "backstage-old-"));
  cpSync(SAMPLES, old, { recursive: true });
  const f = join(old, "series.json"), sr = JSON.parse(readFileSync(f, "utf8"));
  const { title, ...rest } = sr;
  writeFileSync(f, JSON.stringify({ ...rest, title: title.tr, titleEn: title.en, titleFa: title.fa }, null, 2) + "\n");
  const b = await start(["--content", old, "--write"]);
  try {
    const w = await call(b.url, "GET", "world");
    assert.equal(w.body.writable, false);
    assert.equal(w.body.oldShape, 1);
    assert.deepEqual((await call(b.url, "GET", "doc/series/series")).body.doc.title, title, "the browser gets the new shape");
    const { body: { doc, mtime } } = await call(b.url, "GET", "doc/story/s1e00");
    const r = await call(b.url, "POST", "save", { edits: [{ kind: "story", id: "s1e00", doc, mtime }] });
    assert.equal(r.status, 403);
    assert.match(r.body.message, /old language shape/);
  } finally { b.p.kill(); rmSync(old, { recursive: true, force: true }); }
});

test("the guides: backstage's README and the story format's, and no other file", async () => {
  const list = await call(ro.url, "GET", "docs");
  assert.deepEqual(list.body.docs.map((d: { id: string }) => d.id), ["backstage", "format"]);
  const f = await call(ro.url, "GET", "docs/format");
  assert.equal(f.status, 200);
  assert.equal(f.body.markdown, readFileSync(new URL("../../sahne-story/README.md", import.meta.url), "utf8"));
  for (const bad of ["x", "..%2F..%2Fpackage.json", "toString", "__proto__"]) assert.equal((await call(ro.url, "GET", `docs/${bad}`)).status, 404, bad);
});

test("the agents: an MCP client's session and its calls, and how their edits land", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const empty = await call(rw.url, "GET", "agents");
  assert.equal(empty.status, 200);
  assert.equal(empty.body.mcpUrl, `${rw.url}mcp`);
  assert.equal(empty.body.agentEdits, "proposals");
  assert.ok(empty.body.tools.some((t: { name: string; readOnly: boolean }) => t.name === "read_episode" && t.readOnly));
  assert.ok(empty.body.tools.some((t: { name: string; readOnly: boolean }) => t.name === "edit_step" && !t.readOnly));
  const c = new Client({ name: "test-agent", version: "9.9" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${rw.url}mcp`)));
  try {
    await c.callTool({ name: "list_episodes", arguments: {} });
    await c.callTool({ name: "read_step", arguments: { id: "s1e00", path: "steps/999" } });
    const v = (await call(rw.url, "GET", "agents")).body;
    const s = v.sessions.find((x: { client: string }) => x.client === "test-agent");
    assert.ok(s, "the session, by the client's name");
    assert.equal(s.calls, 2);
    assert.deepEqual(v.activity.slice(0, 2).map((x: { tool: string; ok: boolean; by: string }) => [x.by, x.tool, x.ok]), [["test-agent", "read_step", false], ["test-agent", "list_episodes", true]]);
  } finally { await c.close(); }
  // a stdio agent's call, forwarded by its process
  assert.equal((await call(rw.url, "POST", "events", { event: "activity", data: { by: "stdio-agent", tool: "show", ok: true, ms: 3, summary: "shown" } })).status, 200);
  assert.equal((await call(rw.url, "GET", "agents")).body.activity[0].by, "stdio-agent");
  assert.equal((await call(rw.url, "POST", "events", { event: "activity", data: { nope: 1 } })).status, 400);
  assert.equal((await call(rw.url, "POST", "agents", { agentEdits: "sometimes" })).status, 400);
  // switched for the agents that connect next, and kept in the person's settings
  const d = await call(rw.url, "POST", "agents", { agentEdits: "direct" });
  assert.equal(d.body.agentEdits, "direct");
  assert.equal((await call(rw.url, "GET", "world")).body.agentEdits, "direct");
  assert.equal(JSON.parse(readFileSync(join(config, "settings.json"), "utf8")).agentEdits, "direct");
  await call(rw.url, "POST", "agents", { agentEdits: "proposals" });
});

test("the root's own kit items: served, saved as documents, checked against the kit, ids permanent", async () => {
  const tin = { id: "x_tin", as: "prop", about: "A small tin box with a lid, for tests.", tags: ["box"],
    kinds: { tin: { size: [10, 8], ppcm: 8, grip: [0, -4], flats: [{ shapes: [{ d: "M-5 0V-8H5V0Z", fill: "#B9B4A8" }] }] } } };
  const save = (edits: unknown[]) => call(rw.url, "POST", "save", { edits });
  assert.deepEqual((await call(rw.url, "GET", "kit")).body, { docs: [], problems: [] });
  assert.equal((await save([{ kind: "kit_piece", id: "x_tin", doc: tin, create: true }])).status, 200);
  assert.deepEqual((await call(rw.url, "GET", "kit")).body.docs.map((d: { id: string }) => d.id), ["x_tin"]);
  assert.equal(JSON.parse(readFileSync(join(root, "kit/pieces/x_tin.json"), "utf8")).id, "x_tin");
  assert.equal((await call(rw.url, "GET", "doc/kit_piece/x_tin")).body.doc.about, tin.about);
  assert.equal((await save([{ kind: "kit_piece", id: "x_tin", doc: tin, create: true }])).status, 400, "an id is taken once");
  assert.equal((await save([{ kind: "kit_piece", id: "x_tin", doc: { ...tin, id: "x_renamed" } }])).status, 400, "an id never changes");
  assert.equal((await save([{ kind: "kit_piece", id: "tin", doc: { ...tin, id: "tin" }, create: true }])).status, 400, "a content id starts with x_");
  const bad = await save([{ kind: "kit_piece", id: "x_empty", doc: { ...tin, id: "x_empty", kinds: {} }, create: true }]);
  assert.equal(bad.status, 422); assert.ok(bad.body.problems.some((p: { rule: string; new?: boolean }) => p.rule === "kit" && p.new));
  const v = { of: "x_tin", name: "x_pair", params: { n: 2 } };
  assert.equal((await save([{ kind: "kit_variant", id: "x_tin.x_pair", doc: v, create: true }])).status, 200);
  assert.equal((await save([{ kind: "kit_variant", id: "x_tin.x_nope", doc: { ...v, name: "x_nope", params: { nope: 1 } }, create: true }])).status, 422, "a param the generator does not declare");
  assert.equal((await save([{ kind: "kit_variant", id: "x_tin.x_pair", doc: { ...v, name: "x_other" } }])).status, 400);
  assert.equal((await call(ro.url, "POST", "save", { edits: [{ kind: "kit_piece", id: "x_ro", doc: { ...tin, id: "x_ro" }, create: true }] })).status, 403);
});
