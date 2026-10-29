// The MCP server (server/mcp.ts) on temp copies of the samples. In memory: every read tool and resource; proposals mode
// queues a checked document and never writes (the file's bytes stay), an agent's proposals compose and a rejected one
// takes those built on it; direct mode writes, and refuses a stale read (409) and a new error (422); a read-only
// backstage refuses every edit. Over HTTP (/mcp of a spawned backstage): a proposal reaches GET /api/proposals and the
// event stream, under the client's name, and a person resolves it; the localhost guard holds; search_words gives a
// card's word only with --share-cards. Over stdio (`cli.ts mcp --backstage`): proposals reach the running backstage.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CLI = fileURLToPath(new URL("../server/cli.ts", import.meta.url));
const copy = (tag: string) => { const r = mkdtempSync(join(tmpdir(), `backstage-mcp-${tag}-`)); cpSync(SAMPLES, r, { recursive: true }); return r; };

const root = copy("mem"), http1 = copy("http"), cards = copy("cards"), config = mkdtempSync(join(tmpdir(), "backstage-mcp-config-"));
mkdirSync(join(cards, "cards"));
for (const [id, tr, en] of [["a1-w-elma", "elma", "apple"], ["a1-w-portakal", "portakal", "orange"]]) writeFileSync(join(cards, "cards", `${id}.json`), JSON.stringify({ id, tr, en, fa: "میوه", level: "A1", note: "a private note" }));
process.env.SAHNE_CONTENT = root;
process.env.SAHNE_BACKSTAGE_CONFIG = config;
const ENV = { ...process.env, SAHNE_CONTENT: "", SAHNE_BACKSTAGE_CONFIG: config } as Record<string, string>;
delete ENV.SAHNE_CONTENT;

const { createMcp } = await import("../server/mcp.ts");
const { Events } = await import("../server/events.ts");
const { proposalsOf } = await import("../server/proposals.ts");
const { forget } = await import("../server/content.ts");

type Mode = "proposals" | "direct";
async function connect(o: { write: boolean; agentEdits: Mode; shareCards?: boolean }, events = new Events()) {
  const server = createMcp({ write: o.write, agentEdits: o.agentEdits, shareCards: o.shareCards ?? false, events });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, events, close: () => client.close() };
}
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = await c.callTool({ name, arguments: args }) as { content: { type: string; text: string }[]; isError?: boolean };
  return { text: r.content.map(x => x.text).join("\n\n"), last: r.content.at(-1)!.text, isError: !!r.isError };
};
const json = (r: string | { last: string }) => JSON.parse(typeof r === "string" ? r : r.last);
const story = join(root, "stories", "s1e00.json");

function start(args: string[]): Promise<{ url: string; p: ChildProcess }> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [CLI, "--port", "0", ...args], { stdio: ["ignore", "pipe", "pipe"], env: ENV });
    let out = "";
    const onData = (d: Buffer) => { out += d; const m = /sahne-backstage on (http:\/\/localhost:\d+\/)/.exec(out); if (m) res({ url: m[1], p }); };
    p.stdout!.on("data", onData); p.stderr!.on("data", onData);
    p.on("exit", c => rej(new Error(`exited ${c}: ${out}`)));
  });
}
/** End a spawned backstage and let go of its pipes, so nothing it started keeps this test's process alive. */
const stop = (p?: ChildProcess) => new Promise<void>(r => {
  if (!p || p.exitCode !== null || p.signalCode !== null) { p?.stdout?.destroy(); p?.stderr?.destroy(); return r(); }
  p.once("exit", () => r());
  p.kill("SIGKILL");
  p.stdout?.destroy(); p.stderr?.destroy();
});
let web: { url: string; p: ChildProcess }, plain: { url: string; p: ChildProcess }, shared: { url: string; p: ChildProcess };
before(async () => { [web, plain, shared] = await Promise.all([start(["--content", http1, "--write"]), start(["--content", cards]), start(["--content", cards, "--share-cards"])]); });
after(async () => { await Promise.all([web, plain, shared].map(s => stop(s?.p))); for (const d of [root, http1, cards, config]) rmSync(d, { recursive: true, force: true }); });

const httpClient = async (url: string, name = "http-agent") => {
  const client = new Client({ name, version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("mcp", url)));
  return client;
};
const api = async (base: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(base + "api/" + path, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
};

test("the read tools: the series, the episodes, a script with paths, a step, the kit, the check, the notes", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "proposals" });
  try {
    const tools = (await client.listTools()).tools.map(t => t.name).sort();
    for (const t of ["series_overview", "list_episodes", "read_episode", "read_step", "kit_search", "search_words", "check_episode", "read_notes", "edit_step", "insert_step", "delete_step", "move_step", "set_staging", "set_texts", "create_episode", "set_calendar", "comment", "set_review", "show"]) assert.ok(tools.includes(t), t);
    const ov = json(await call(client, "series_overview"));
    assert.deepEqual(ov.languages, { main: "tr", translations: ["en", "fa"] });
    assert.equal(ov.narrator.id, "kerim");
    assert.equal(ov.standin.id, "nima");
    assert.equal(ov.seasons[0].id, "s1");
    assert.equal(ov.seasons[0].episodes[0].id, "s1e00");
    assert.equal(ov.writable, false);
    assert.deepEqual(json(await call(client, "list_episodes", { season: 1 })).map((e: { id: string }) => e.id), ["s1e00"]);
    assert.deepEqual(json(await call(client, "list_episodes", { season: "s2" })), []);
    const ep = await call(client, "read_episode", { id: "s1e00" });
    assert.match(ep.text, /^s1e00: Portakal var mı\?/);
    assert.match(ep.text, /steps\/1 {2}kerim \(narrates\): "Akşam\. Nima metroda\." \| en: Evening\. Nima is on the metro\. \| fa: /);
    assert.match(ep.text, /steps\/12\/choice\/options\/0 /);
    assert.match(ep.text, /quiz\/0 /);
    assert.match(ep.text, /mtime \d+/);
    assert.equal(json(await call(client, "read_episode", { id: "s1e00", raw: true })).id, "s1e00");
    assert.equal(json(await call(client, "read_step", { id: "s1e00", path: "steps/4" })).who, "ismail");
    assert.equal(json(await call(client, "read_step", { id: "s1e00", path: 4 })).who, "ismail");
    assert.ok((await call(client, "read_step", { id: "s1e00", path: "steps/99" })).isError);
    assert.ok((await call(client, "read_episode", { id: "s9e99" })).isError);
    const kit = async (kind: string, query = "") => json(await call(client, "kit_search", { kind, query })) as { id: string; about: string }[];
    assert.ok((await kit("gestures", "wave")).some(g => g.id === "wave"));
    assert.ok((await kit("emotions")).some(g => g.id === "happy"));
    assert.ok((await kit("sounds", "knock")).some(g => g.id === "knock"));
    assert.ok((await kit("props")).length > 0);
    assert.ok((await kit("characters", "ismail"))[0].about.includes("İsmail"));
    assert.match((await kit("places", "bakkal"))[0].about, /marks .*counter/);
    const chk = await call(client, "check_episode", { id: "s1e00" });
    assert.match(chk.text, /s1e00: 0 errors, 0 warnings/);
    assert.deepEqual(json(await call(client, "read_notes", { id: "s1e00" })), {});
    const res = (await client.listResources()).resources.map(r => r.uri).sort();
    assert.deepEqual(res, ["sahne://format", "sahne://languages", "sahne://selection"]);
    assert.match(((await client.readResource({ uri: "sahne://format" })).contents[0] as { text: string }).text, /## Languages/);
    assert.deepEqual(JSON.parse(((await client.readResource({ uri: "sahne://languages" })).contents[0] as { text: string }).text).main, "tr");
  } finally { await close(); }
});

test("read-only: every edit is refused, and says why", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "direct" });
  try {
    const before = readFileSync(story, "utf8");
    for (const [name, args] of [["edit_step", { id: "s1e00", path: "steps/4", patch: { en: "x" } }], ["insert_step", { id: "s1e00", at: 2, step: { who: "nima", tr: "a", en: "a", fa: "a" } }], ["delete_step", { id: "s1e00", path: 2 }], ["comment", { id: "s1e00", text: "hi" }], ["set_texts", { id: "s1e00", path: 4, texts: { en: "x" } }]] as const) {
      const r = await call(client, name, args);
      assert.ok(r.isError, name);
      assert.match(r.text, /read-only/, name);
    }
    assert.equal(readFileSync(story, "utf8"), before);
    assert.ok(!existsSync(join(root, ".backstage", "review.json")));
  } finally { await close(); }
});

test("proposals mode: a checked proposal is queued, the file is untouched, and an agent's proposals compose", async () => {
  const events = new Events();
  const seen: string[] = [];
  events.on((name, data) => { if (name === "proposal") seen.push(`${(data as { action: string }).action}:${(data as { proposal: { id: string } }).proposal.id}`); });
  const { client, close } = await connect({ write: true, agentEdits: "proposals" }, events);
  try {
    const before = readFileSync(story, "utf8");
    const r1 = await call(client, "set_texts", { id: "s1e00", path: "steps/4", texts: { en: "Good evening! Do come in." } });
    assert.ok(!r1.isError, r1.text);
    const q = proposalsOf(events);
    const [p1] = q.all();
    assert.equal(json(r1).proposal, p1.id);
    assert.equal(p1.kind, "story");
    assert.equal(p1.doc, "s1e00");
    assert.equal(p1.by, "test-agent");
    assert.deepEqual(p1.paths, [["steps", 4]]);
    assert.equal((p1.next as any).steps[4].en, "Good evening! Do come in.");
    assert.equal((p1.next as any).steps[4].tr, JSON.parse(before).steps[4].tr);
    assert.equal(typeof p1.base, "number");
    const r2 = await call(client, "set_staging", { id: "s1e00", path: 4, staging: { emo: "curious" } });
    assert.ok(!r2.isError, r2.text);
    const p2 = q.all()[1];
    assert.equal(p2.after, p1.id);
    assert.equal((p2.next as any).steps[4].en, "Good evening! Do come in.", "built on the first");
    assert.equal((p2.next as any).steps[4].emo, "curious");
    assert.equal(readFileSync(story, "utf8"), before, "nothing is written");
    // an edit that brings an error is not proposed
    const bad = await call(client, "edit_step", { id: "s1e00", path: "steps/2", patch: { who: "nobody_at_all" } });
    assert.ok(bad.isError);
    assert.match(bad.text, /not proposed: the edit brings/);
    assert.equal(q.all().length, 2);
    // set_staging takes no texts
    assert.match((await call(client, "set_staging", { id: "s1e00", path: 4, staging: { tr: "x" } })).text, /set_texts/);
    // rejecting the first drops the second, built on it
    assert.deepEqual(q.resolve(p1.id, false)?.map(p => p.id), [p1.id, p2.id]);
    assert.equal(q.all().length, 0);
    // accepting a later one takes the earlier with it
    const ins = await call(client, "insert_step", { id: "s1e00", at: 3, step: { who: "kerim", narr: true, tr: "Sonra bakkal.", en: "Then the shop.", fa: "بعد بقالی." } });
    assert.ok(!ins.isError, ins.text);
    const mv = await call(client, "move_step", { id: "s1e00", from: 3, to: 2 });
    assert.ok(!mv.isError, mv.text);
    const [a, b] = q.all();
    assert.equal((b.next as any).steps[2].tr, "Sonra bakkal.");
    assert.deepEqual(q.resolve(b.id, true)?.map(p => p.id), [b.id, a.id]);
    assert.deepEqual(seen, [`added:${p1.id}`, `added:${p2.id}`, `resolved:${p1.id}`, `resolved:${p2.id}`, `added:${a.id}`, `added:${b.id}`, `resolved:${b.id}`, `resolved:${a.id}`]);
    // a new episode and a calendar row: documents that change together
    const ce = await call(client, "create_episode", { season: 1, releaseDate: "2026-09-15", kind: "episode", week: 0, place: "bakkal", cast: ["ismail", "nima"], words: ["a1-w-ekmek", "a1-w-su", "a1-w-cay", "a1-w-peynir", "a1-w-zeytin"], lessons: ["g_a1_2_var_yok"], title: { tr: "Ekmek var mı?" }, level: "A1" });
    assert.ok(!ce.isError, ce.text);
    const pe = q.all().at(-1)!;
    assert.equal(pe.doc, "s1e01");
    assert.equal(pe.create, true);
    assert.equal((pe.next as any).draft, true);
    // a calendar row and its episode are checked together: on the samples, week 0 has no unit for the episode's ref
    const sc = await call(client, "set_calendar", { season: 1, story: "s1e00", row: { date: "2026-09-14", kind: "episode", week: 0 } });
    assert.ok(sc.isError);
    assert.match(sc.text, /\[ref\] story:s1e00: ref A1_2 but week 0/);
    // the episode itself: its fields, never its id
    const top = await call(client, "edit_step", { id: "s1e00", path: "", patch: { draft: null } });
    assert.ok(!top.isError, top.text);
    assert.equal((q.all().at(-1)!.next as any).draft, undefined);
    assert.deepEqual(q.all().at(-1)!.paths, [["draft"]]);
    assert.match((await call(client, "edit_step", { id: "s1e00", path: "", patch: { id: "s1e09" } })).text, /ids are permanent/);
    assert.equal(readFileSync(story, "utf8"), before);
    assert.ok(!existsSync(join(root, "stories", "s1e01.json")));
    // notes: a comment is written at once; the status is a person's
    const cm = await call(client, "comment", { id: "s1e00", step: "steps/12/choice/options/0", text: "Is this too formal?" });
    assert.ok(!cm.isError, cm.text);
    const notes = JSON.parse(readFileSync(join(root, ".backstage", "review.json"), "utf8")).episodes.s1e00;
    assert.equal(notes.comments[0].at, "12.0");
    assert.equal(notes.comments[0].by, "test-agent");
    assert.match((await call(client, "set_review", { id: "s1e00", status: "approved" })).text, /a person sets/);
    // show reaches the listening editors
    const shown: unknown[] = [];
    events.on((name, data) => { if (name === "show") shown.push(data); });
    await call(client, "show", { id: "s1e00", step: "steps/4" });
    assert.deepEqual(shown, [{ id: "s1e00", step: ["steps", 4] }]);
    events.selection = { page: "episode", kind: "story", id: "s1e00", path: ["steps", 4], at: 1 };
    assert.equal(JSON.parse(((await client.readResource({ uri: "sahne://selection" })).contents[0] as { text: string }).text).id, "s1e00");
  } finally { await close(); }
});

test("direct mode: an edit is saved; a stale read is refused (409) and a new error too (422)", async () => {
  const events = new Events();
  const docs: unknown[] = [];
  events.on((name, data) => { if (name === "doc") docs.push(data); });
  const { client, close } = await connect({ write: true, agentEdits: "direct" }, events);
  try {
    const before = readFileSync(story, "utf8");
    const mtime = Number(/mtime ([\d.]+)/.exec((await call(client, "read_episode", { id: "s1e00" })).text)![1]);
    const r = await call(client, "set_texts", { id: "s1e00", path: "steps/4", texts: { en: "Good evening! In you come." }, mtime });
    assert.ok(!r.isError, r.text);
    const now = readFileSync(story, "utf8");
    const changed = now.split("\n").filter((l, k) => l !== before.split("\n")[k]);
    assert.equal(changed.length, 1);
    assert.match(changed[0], /In you come/);
    assert.equal((docs[0] as { id: string }).id, "s1e00");
    assert.equal(proposalsOf(events).all().length, 0);
    // a stale read: the file changed since
    const t = new Date(Date.now() + 5000);
    utimesSync(story, t, t);
    forget();
    const stale = await call(client, "edit_step", { id: "s1e00", path: 4, patch: { emo: "happy" }, mtime });
    assert.ok(stale.isError);
    assert.match(stale.text, /changed on disk since you read it/);
    // a new error
    const bad = await call(client, "edit_step", { id: "s1e00", path: "steps/2", patch: { who: "nobody_at_all" } });
    assert.ok(bad.isError);
    assert.match(bad.text, /not saved \(422\)/);
    assert.match(readFileSync(story, "utf8"), /In you come/);
    const ok = await call(client, "set_review", { id: "s1e00", status: "reviewed" });
    assert.ok(!ok.isError, ok.text);
  } finally { await close(); }
});

test("over HTTP: a proposal reaches the editors under the client's name, and a person resolves it", async () => {
  const file = join(http1, "stories", "s1e00.json"), before = readFileSync(file, "utf8");
  const ac = new AbortController();
  const stream = await fetch(web.url + "api/events", { signal: ac.signal });
  assert.equal(stream.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = stream.body!.getReader();
  let got = "";
  const heard = (async () => { while (!/event: proposal/.test(got)) { const { value, done } = await reader.read(); if (done) break; got += new TextDecoder().decode(value); } })();
  const client = await httpClient(web.url);
  try {
    const r = await call(client, "set_texts", { id: "s1e00", path: "steps/4", texts: { en: "Evening! Come on in." } });
    assert.ok(!r.isError, r.text);
    const list = (await api(web.url, "GET", "proposals")).body.proposals;
    assert.equal(list.length, 1);
    assert.equal(list[0].by, "http-agent");
    assert.equal(list[0].next.steps[4].en, "Evening! Come on in.");
    await heard;
    assert.match(got, /event: proposal\ndata: \{"action":"added"/);
    assert.equal(readFileSync(file, "utf8"), before);
    assert.equal((await api(web.url, "POST", `proposals/${list[0].id}`, { accepted: true })).status, 200);
    assert.deepEqual((await api(web.url, "GET", "proposals")).body.proposals, []);
    assert.equal((await api(web.url, "POST", "proposals/p999", { accepted: true })).status, 404);
    const w = (await api(web.url, "GET", "world")).body;
    assert.equal(w.agentEdits, "proposals");
    assert.equal(w.shareCards, false);
    assert.equal((await api(web.url, "POST", "selection", { page: "episode", kind: "story", id: "s1e00", path: ["steps", 4] })).status, 200);
    assert.equal((await api(web.url, "GET", "selection")).body.selection.id, "s1e00");
  } finally { await client.close(); ac.abort(); }
  const foreign = await fetch(web.url + "mcp", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.com", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) });
  assert.equal(foreign.status, 403);
  await foreign.text();
  const lost = await fetch(web.url + "mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-session-id": "nope" }, body: "{}" });
  assert.equal(lost.status, 404);
  await lost.text();
});

test("search_words: ids and levels; the main word only with --share-cards; never a translation or a note", async () => {
  const a = await httpClient(plain.url), b = await httpClient(shared.url);
  try {
    const hidden = json(await call(a, "search_words", { query: "portakal" }));
    assert.deepEqual(hidden, [{ id: "a1-w-portakal", level: "A1" }]);
    const shown = json(await call(b, "search_words", { query: "apple" }));
    assert.deepEqual(shown, [{ id: "a1-w-elma", level: "A1", word: "elma" }]);
    const all = (await call(b, "search_words", { query: "" })).text;
    assert.doesNotMatch(all, /apple|orange|میوه|private note/);
    assert.match((await call(a, "edit_step", { id: "s1e00", path: 4, patch: { en: "x" } })).text, /read-only/);
  } finally { await a.close(); await b.close(); }
});

test("over stdio: nothing but MCP on stdout, and proposals reach a running backstage", async () => {
  const before = (await api(web.url, "GET", "proposals")).body.proposals.length;
  const transport = new StdioClientTransport({ command: process.execPath, args: [CLI, "mcp", "--content", http1, "--write", "--backstage", web.url], env: ENV, stderr: "pipe" });
  const client = new Client({ name: "stdio-agent", version: "1.0.0" });
  await client.connect(transport);
  try {
    const ov = json(await call(client, "series_overview"));
    assert.equal(ov.writable, true);
    const r = await call(client, "set_texts", { id: "s1e00", path: "steps/5", texts: { en: "Here you are." } });
    assert.ok(!r.isError, r.text);
    assert.match(r.text, new RegExp(`the backstage editor at ${web.url.replace(/[.]/g, "\\.")}`));
    const list = (await api(web.url, "GET", "proposals")).body.proposals;
    assert.equal(list.length, before + 1);
    assert.equal(list.at(-1).by, "stdio-agent");
    assert.ok(list.at(-1).problems.every((p: { new?: boolean; level: string }) => !(p.new && p.level === "error")));
  } finally { await client.close(); }
});
