// The MCP server (server/mcp.ts) on temp copies of the samples. In memory: every read tool and resource; proposals mode
// queues a checked document and never writes (the file's bytes stay), an agent's proposals compose and a rejected one
// takes those built on it; direct mode writes, and refuses a stale read (409) and a new error (422); a read-only
// backstage refuses every edit. Over HTTP (/mcp of a spawned backstage): a proposal reaches GET /api/proposals and the
// event stream, under the client's name, and a person resolves it; the localhost guard holds; search_words gives a
// card's word only with --share-cards. Over stdio (`cli.ts mcp --backstage`): proposals reach the running backstage.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fullKit from "../../sahne-kit/src/full.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LABELLED } from "../src/model/tools.ts";

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
  const r = await c.callTool({ name, arguments: args }) as { content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };
  const texts = r.content.filter(x => x.type === "text").map(x => x.text!);
  return { text: texts.join("\n\n"), last: texts.at(-1)!, isError: !!r.isError, images: r.content.filter(x => x.type === "image") as { data: string; mimeType: string }[] };
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
    // a server that never says where it listens fails the file in a minute, rather than hanging the gate
    setTimeout(() => { p.kill(); rej(new Error(`no "sahne-backstage on" line in 60 s: ${out}`)); }, 60_000).unref();
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
    // every tool reads in plain words in the chat and the activity log (src/model/tools.ts)
    for (const t of tools) assert.ok(LABELLED.includes(t), `${t} has no words in src/model/tools.ts`);
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
    assert.deepEqual(res, ["sahne://format", "sahne://kit-guide", "sahne://languages", "sahne://selection"]);
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

test("the proposals an agent sees: waiting and answered; it takes back only its own", async () => {
  const events = new Events();
  const a = await connect({ write: true, agentEdits: "proposals" }, events);
  const q = proposalsOf(events);
  try {
    assert.ok(!(await call(a.client, "edit_doc", { kind: "season", id: "s1", path: "title", patch: { en: "One" } })).isError);
    assert.ok(!(await call(a.client, "edit_doc", { kind: "place", id: "bakkal", path: "name", patch: { en: "The corner shop" } })).isError);
    const [p1, p2] = q.all().slice(-2);
    q.resolve(p1.id, false);
    const l = await call(a.client, "list_proposals");
    assert.match(l.text, new RegExp(`${p2.id} · place bakkal · you`));
    assert.match(l.text, new RegExp(`${p1.id} · rejected · season s1`));
    // another agent's proposal is not this one's to take back
    q.add({ ...p2, by: "someone-else" } as never);
    const other = q.all().at(-1)!;
    assert.match((await call(a.client, "withdraw_proposal", { id: other.id })).text, /proposed by someone-else, not by you/);
    const w = await call(a.client, "withdraw_proposal", { id: p2.id });
    assert.ok(!w.isError, w.text);
    assert.equal(json(await call(a.client, "list_proposals")).resolved[0].outcome, "withdrawn");
    q.resolve(other.id, false);
  } finally { await a.close(); }
});

test("the series, its seasons, places and characters: read, edited, themed, created, checked and refused as a save would be", async () => {
  const events = new Events();
  const { client, close } = await connect({ write: true, agentEdits: "proposals" }, events);
  const q = proposalsOf(events);
  try {
    // read_doc gives any kind as JSON; edit_doc proposes a merge patch at a path
    const se = await call(client, "read_doc", { kind: "season", id: "s1" });
    assert.ok(!se.isError, se.text);
    assert.equal(json(se).id, "s1");
    const t = await call(client, "edit_doc", { kind: "season", id: "s1", path: "title", patch: { en: "The first season" } });
    assert.ok(!t.isError, t.text);
    const pt = q.all().at(-1)!;
    assert.equal(pt.kind, "season");
    assert.deepEqual(pt.paths, [["title"]]);
    assert.equal((pt.next as any).title.en, "The first season");
    assert.equal((pt.next as any).title.tr, "Birinci sezon");
    // reading it again is the season as proposed, and a second edit builds on it
    assert.match((await call(client, "read_doc", { kind: "season", id: "s1" })).text, new RegExp(`pending proposal ${pt.id}`));
    q.resolve(pt.id, false);
    // a save's refusals hold for a proposal too: an id never changes
    const idc = await call(client, "edit_doc", { kind: "place", id: "bakkal", path: "", patch: { id: "market" } });
    assert.ok(idc.isError);
    assert.match(idc.text, /ids never change/);
    // a week's theme reaches the season and every episode of that week, each only at its arc
    const wt = await call(client, "set_week_theme", { season: 1, week: 0, texts: { tr: "Bir deneme", en: "A try", fa: "یک آزمایش" } });
    assert.ok(!wt.isError, wt.text);
    const pw = q.all().at(-1)!;
    assert.deepEqual(pw.paths, [["arcs", "s1w00"]]);
    const ep = pw.also!.find(a => a.doc === "s1e00")!;
    assert.deepEqual(ep.paths, [["arc"]]);
    assert.equal((ep.next as any).arc.en, "A try");
    assert.deepEqual((ep.next as any).arc.mechanics, ["say", "explore", "act"]);
    q.resolve(pw.id, false);
    // where a place's mark is used, and taking away a mark an episode stands on is a new error
    const uses = json(await call(client, "find_uses", { kind: "place", id: "bakkal" }));
    assert.ok(uses.some((u: { story: string }) => u.story === "s1e00"));
    const doc = JSON.parse(readFileSync(join(root, "places", "bakkal.json"), "utf8"));
    const counter = json(await call(client, "find_uses", { kind: "place", id: "bakkal", part: "counter" }));
    assert.ok(counter.length, "s1e00 stands someone at the counter");
    {
      const gone = await call(client, "edit_doc", { kind: "place", id: "bakkal", path: "marks", patch: { counter: null } });
      assert.ok(gone.isError, gone.text);
      assert.match(gone.text, /story:s1e00/);
    }
    // new documents: a season, a place copied from another, a character
    const ns = await call(client, "create_season", { title: { tr: "İkinci sezon", en: "Season two", fa: "فصل دوم" } });
    assert.ok(!ns.isError, ns.text);
    assert.equal(q.all().at(-1)!.doc, "s2");
    assert.equal(q.all().at(-1)!.create, true);
    const np = await call(client, "create_place", { id: "dukkan", name: { tr: "Dükkan", en: "Shop", fa: "مغازه" }, from: "bakkal" });
    assert.ok(!np.isError, np.text);
    assert.deepEqual(Object.keys((q.all().at(-1)!.next as any).marks), Object.keys(doc.marks));
    assert.match((await call(client, "read_doc", { kind: "place", id: "dukkan" })).text, /your proposal p\d+, a new place/);
    assert.match((await call(client, "create_place", { id: "bakkal", name: { tr: "x" } })).text, /a place already/);
    const nc = await call(client, "create_character", { id: "ayse", name: { tr: "Ayşe", fa: "عایشه" }, role: { en: "a neighbour", fa: "همسایه" }, bio: { en: "Lives upstairs.", fa: "طبقه بالا" } });
    assert.ok(!nc.isError, nc.text);
    // the season at a glance
    const cs = await call(client, "check_season", { id: "s1" });
    assert.ok(!cs.isError, cs.text);
    assert.match(cs.text, /s1e00 · /);
    assert.ok(Array.isArray(json(cs).freeDays));
    assert.equal(readFileSync(join(root, "seasons", "s1.json"), "utf8").includes("The first season"), false, "nothing is written in proposals mode");
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
    // a week without an arc names the weeks there are
    const nw = await call(client, "create_episode", { season: 1, releaseDate: "2026-09-16", kind: "episode", week: 1, place: "bakkal", cast: ["ismail", "nima"], words: [], lessons: [], title: { tr: "Yok" } });
    assert.ok(nw.isError);
    assert.match(nw.text, /has arcs for week 0: pick one of those, or give week 1 a theme first with set_week_theme/);
    // the agent reads and goes on editing the episode it proposed; each edit is the new episode again, built on the last
    const rp = await call(client, "read_episode", { id: "s1e01" });
    assert.ok(!rp.isError, rp.text);
    assert.match(rp.text, new RegExp(`s1e01 is your proposal ${pe.id}, a new episode`));
    assert.match(rp.text, /mtime none/);
    const ep = await call(client, "edit_step", { id: "s1e01", path: "", patch: { level: "A1" } });
    assert.ok(!ep.isError, ep.text);
    const pe2 = q.all().at(-1)!;
    assert.equal(pe2.create, true);
    assert.equal(pe2.after, pe.id);
    assert.equal(pe2.base, undefined);
    assert.match((await call(client, "comment", { id: "s1e01", text: "x" })).text, new RegExp(`s1e01 is only proposed \\(${pe.id}\\)`));
    q.resolve(pe.id, false);
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
    // in proposals mode a person decides: another agent is told so, and nothing is written
    const sr = await call(client, "set_review", { id: "s1e00", status: "approved" });
    assert.match(sr.text, /not set: in proposals mode a person decides/);
    assert.equal(JSON.parse(readFileSync(join(root, ".backstage", "review.json"), "utf8")).episodes.s1e00.status, undefined);
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

// ---- the drawing loop: kit items -----------------------------------------------------------------------------------------------

const chalkboard = () => ({
  id: "x_cafe_chalkboard", as: "prop", about: "A chalkboard menu, on an easel or hung on the wall.", tags: ["cafe"], terms: [],
  params: { color: { type: "color", default: "#2F3B35", about: "the board" }, label: { type: "text", default: "Menu" }, kind: { type: "enum", values: ["easel", "wall"], default: "easel" } },
  kinds: {
    easel: { size: [60, 110], ppcm: 8, grip: [0, -60], flats: [{ shapes: [{ d: "M-30 0L-24 -110H24L30 0Z", fill: "$color" }, { d: "M-20 -20H20V-90H-20Z", fill: { tone: "$color", step: "shade" }, flat: true }], text: [{ text: "$label", x: -18, y: -86, w: 36, h: 60, font: "hand", lang: "fr" }], glow: [], sway: null, shadow: "drop" }] },
    wall: { size: [80, 60], ppcm: 6, grip: [0, -30], flats: [{ shapes: [{ d: "M-40 0V-60H40V0Z", fill: "$color" }], text: [{ text: "$label", x: -36, y: -56, w: 72, h: 50, lang: "tr" }] }] },
  },
  repeat: { gap: 6 }, variants: { wall: { kind: "wall" } }, solid: null,
});
const isPng = (img: { data: string; mimeType: string }) => img.mimeType === "image/png" && Buffer.from(img.data, "base64").subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
const kitFile = (...p: string[]) => join(root, "kit", ...p);

test("kit_search lists set pieces and props with family, use and variants, and filters them", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "proposals" });
  try {
    type Row = { id: string; family: string; as: string; about: string; variants: string[] };
    const search = async (a: Record<string, unknown>) => json(await call(client, "kit_search", a)) as Row[];
    const set = await search({ kind: "set", query: "frontage" });
    assert.equal(set[0].id, "frontage");
    assert.equal(set[0].family, "street");
    assert.equal(set[0].as, "set");
    assert.ok(Array.isArray(set[0].variants) && set[0].about.length > 8);
    const food = await search({ kind: "props", family: "food" });
    assert.ok(food.length > 3 && food.every(r => r.family === "food" && r.as !== "set"));
    assert.ok((await search({ kind: "set", family: "street", as: "prop" })).every(r => r.as === "prop"));
    const tag = (await search({ kind: "props", query: "tea" })).find(r => r.id === "tea")!;
    assert.deepEqual((await search({ kind: "props", family: "food", query: "tea" })).map(r => r.id).includes(tag.id), true);
    assert.deepEqual(await search({ kind: "set", family: "nonesuch" }), []);
    // an item that is both a set piece and a prop shows under each
    const all = (await search({ kind: "props", limit: 200 })).length;
    assert.equal(all, Object.keys(fullKit.props).length, "kind props lists every prop, the both ones too");
    assert.equal((await search({ kind: "set", limit: 200 })).length, Object.keys(fullKit.set).length);
    // no kind: props and set pieces together, each saying which
    const any = await search({ query: "flag" });
    assert.ok(any.some(r => r.as !== "prop") && any.every(r => typeof r.as === "string"), JSON.stringify(any.map(r => [r.id, r.as])));
    assert.ok((await search({ query: "cup" })).some(r => r.id === "cup"));
  } finally { await close(); }
});

test("kit_read shows a generator's params, variants and source, with its sheet; kit_render returns the picture and the checks", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "proposals" });
  try {
    const r = await call(client, "kit_read", { id: "tea" });
    assert.ok(!r.isError, r.text);
    const d = json(r);
    assert.equal(d.id, "tea");
    assert.equal(d.family, "food");
    assert.ok(Object.keys(d.params).length > 0 && d.source.file === "packages/sahne-kit/src/set/food.ts");
    // where the source is, not the source: an agent reads lines from..to of the file itself
    assert.equal(d.source.text, undefined);
    assert.ok(d.source.line > 0 && d.source.from <= d.source.line && d.source.to > d.source.line);
    assert.match(r.text, /source: packages\/sahne-kit\/src\/set\/food\.ts:\d+ \(lines \d+-\d+\)/);
    const src = readFileSync(new URL(`../../../${d.source.file}`, import.meta.url), "utf8").split("\n");
    assert.match(src[d.source.line - 1], /^(export\s+)?(const|function)\s/);
    assert.ok(Buffer.byteLength(r.text) < 4000, `kit_read stays short (${Buffer.byteLength(r.text)} bytes)`);
    assert.equal(r.images.length, 1);
    assert.ok(isPng(r.images[0]));
    const g = await call(client, "kit_render", { id: "frontage", views: ["day"], seeds: ["a", "b"] });
    assert.ok(!g.isError, g.text);
    assert.equal(g.images.length, 2);
    assert.ok(g.images.every(isPng));
    assert.match(g.text, /^frontage: 0 errors/);
    assert.ok(Array.isArray(json(g).problems));
    assert.ok(!(await call(client, "kit_render", { id: "tea", zoom: "scene", views: ["day"] })).isError, "zoom scene");
    assert.ok((await call(client, "kit_render", { id: "tea", zoom: "huge" })).isError, "zoom is auto or scene");
    const one = await call(client, "kit_render", { id: "tea", params: { n: 3 } });
    assert.equal(one.images.length, 1);
    assert.match((await call(client, "kit_render", { id: "tea", params: { nonesuch: 1 } })).text, /nonesuch/);
    assert.match((await call(client, "kit_render", { id: "tea", variant: "nonesuch" })).text, /no variant nonesuch/);
    assert.ok((await call(client, "kit_render", { id: "nonesuch" })).isError);
    assert.ok((await call(client, "kit_render", {})).isError);
    assert.ok((await call(client, "kit_read", { id: "x_nothing" })).isError);
    const guide = ((await client.readResource({ uri: "sahne://kit-guide" })).contents[0] as { text: string }).text;
    assert.match(guide, /^# Pieces drawn as data/);
    assert.match(guide, /## Paper/);
    assert.match(guide, /## Props/);
  } finally { await close(); }
});

test("kit_render takes a list of items and draft_kit_item a list of drawings: one picture, the problems of each", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "proposals" });
  try {
    const r = await call(client, "kit_render", { items: [{ id: "chair" }, { id: "frontage", variant: "firin" }, { doc: chalkboard(), params: { held: true } }] });
    assert.ok(!r.isError, r.text);
    assert.equal(r.images.length, 1);
    assert.ok(isPng(r.images[0]));
    assert.deepEqual(json(r).items.map((i: { id: string }) => i.id), ["chair", "frontage", "x_cafe_chalkboard"]);
    const d = await call(client, "draft_kit_item", { docs: [chalkboard(), { ...chalkboard(), id: "x_cafe_chalkboard_two" }] });
    assert.ok(!d.isError, d.text);
    assert.equal(d.images.length, 1);
    assert.match(d.text, /^x_cafe_chalkboard_two: 0 errors/m);
    assert.match((await call(client, "kit_render", { items: [{ id: "chair" }], id: "chair" })).text, /not both/);
    assert.match((await call(client, "kit_render", { items: [{ id: "chair", variant: "nope" }] })).text, /no variant nope/);
    assert.ok(!existsSync(kitFile("pieces", "x_cafe_chalkboard_two.json")), "a draft writes nothing");
  } finally { await close(); }
});

test("draft_kit_item renders a drawing and writes nothing; a bad drawing is refused with what to fix", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "proposals" });
  try {
    const good = await call(client, "draft_kit_item", { doc: chalkboard() });
    assert.ok(!good.isError, good.text);
    assert.match(good.text, /^x_cafe_chalkboard: 0 errors/);
    assert.equal(good.images.length, 1);
    assert.ok(isPng(good.images[0]));
    assert.deepEqual(json(good).problems.filter((p: string) => p.startsWith("error")), []);
    assert.ok(!existsSync(kitFile("pieces", "x_cafe_chalkboard.json")));
    const rendered = await call(client, "kit_render", { doc: chalkboard(), as: "set", views: ["night"] });
    assert.ok(!rendered.isError, rendered.text);
    assert.equal(rendered.images.length, 1);
    // an undeclared param in a variant, a colour that is no param, and an id that is not the content's
    const stray = chalkboard(); (stray.variants as Record<string, unknown>).wall = { kind: "wall", nonesuch: 1 };
    const bad = await call(client, "draft_kit_item", { doc: stray });
    assert.ok(bad.isError);
    assert.match(bad.text, /nonesuch/);
    assert.equal(bad.images.length, 0);
    assert.match((await call(client, "draft_kit_item", { doc: { ...chalkboard(), id: "cafe_chalkboard" } })).text, /x_/);
    assert.match((await call(client, "draft_kit_item", { doc: { ...chalkboard(), id: "chair" } })).text, /x_/);
    const dollar = chalkboard(); dollar.kinds.easel.flats[0].shapes[0].fill = "$colour";
    assert.match((await call(client, "draft_kit_item", { doc: dollar })).text, /colour/);
    // a variant of a generator of the kit: its params must be ones it declares, with legal values
    const v = await call(client, "draft_variant", { of: "flag", name: "x_club", params: { kind: "bunting" } });
    assert.ok(!v.isError, v.text);
    assert.equal(v.images.length, 1);
    assert.match((await call(client, "draft_variant", { of: "flag", name: "x_club", params: { nonesuch: 1 } })).text, /nonesuch/);
    assert.match((await call(client, "draft_variant", { of: "flag", name: "club", params: {} })).text, /x_/);
    assert.match((await call(client, "draft_variant", { of: "nonesuch", name: "x_a", params: {} })).text, /nonesuch/);
  } finally { await close(); }
});

test("save_kit_item and save_variant: a proposal in proposals mode, a file in direct mode; replacing needs the mtime", async () => {
  const events = new Events();
  const p = await connect({ write: true, agentEdits: "proposals" }, events);
  try {
    const r = await call(p.client, "save_kit_item", { doc: chalkboard() });
    assert.ok(!r.isError, r.text);
    assert.match(r.text, /proposal p\w+ is waiting/);
    assert.ok(!existsSync(kitFile("pieces", "x_cafe_chalkboard.json")), "a proposal writes nothing");
    const pending = await proposalsOf(events).pending();
    const mine = pending.find(x => x.doc === "x_cafe_chalkboard")!;
    assert.equal(mine.kind, "kit_piece");
    assert.equal(mine.create, true);
    const sv = await call(p.client, "save_variant", { of: "flag", name: "x_club", params: { kind: "bunting" } });
    assert.ok(!sv.isError, sv.text);
    assert.equal((await proposalsOf(events).pending()).find(x => x.doc === "flag.x_club")!.kind, "kit_variant");
    assert.ok(!existsSync(kitFile("variants", "flag.x_club.json")));
    // the same drawing again builds on the first
    const again = await call(p.client, "save_kit_item", { doc: chalkboard() });
    assert.match(again.text, /earlier proposal/);
  } finally { await p.close(); }

  const d = await connect({ write: true, agentEdits: "direct" });
  try {
    forget();
    const r = await call(d.client, "save_kit_item", { doc: chalkboard() });
    assert.ok(!r.isError, r.text);
    assert.deepEqual(Object.keys(json(r).saved), ["kit_piece:x_cafe_chalkboard"]);
    assert.equal(JSON.parse(readFileSync(kitFile("pieces", "x_cafe_chalkboard.json"), "utf8")).id, "x_cafe_chalkboard");
    // a saved drawing is in the kit now: kit_search finds it in this series, kit_read gives its mtime, and it renders by id
    const found = json(await call(d.client, "kit_search", { kind: "props", family: "series" })) as { id: string; family: string }[];
    assert.deepEqual(found.map(x => x.id), ["x_cafe_chalkboard"]);
    const read = await call(d.client, "kit_read", { id: "x_cafe_chalkboard" });
    const mtime = json(read).mtime as number;
    assert.equal(json(read).doc.id, "x_cafe_chalkboard");
    assert.ok(isPng((await call(d.client, "kit_render", { id: "x_cafe_chalkboard", variant: "wall" })).images[0]));
    // replacing: not without the mtime, not with a stale one
    assert.match((await call(d.client, "save_kit_item", { doc: chalkboard() })).text, /exists already/);
    assert.match((await call(d.client, "save_kit_item", { doc: chalkboard(), mtime: mtime - 1000 })).text, /changed on disk/);
    const next = { ...chalkboard(), about: "A chalkboard menu on an easel or on the wall." };
    assert.ok(!(await call(d.client, "save_kit_item", { doc: next, mtime })).isError);
    assert.match(readFileSync(kitFile("pieces", "x_cafe_chalkboard.json"), "utf8"), /on an easel or on the wall/);
    // a variant of the saved drawing
    const v = await call(d.client, "save_variant", { of: "x_cafe_chalkboard", name: "x_green", params: { color: "#2E5B3A" } });
    assert.ok(!v.isError, v.text);
    assert.deepEqual(JSON.parse(readFileSync(kitFile("variants", "x_cafe_chalkboard.x_green.json"), "utf8")), { of: "x_cafe_chalkboard", name: "x_green", params: { color: "#2E5B3A" } });
    assert.deepEqual(json(await call(d.client, "kit_read", { id: "x_cafe_chalkboard.x_green" })).doc.params, { color: "#2E5B3A" });
    // refusals: an id that is not the content's, an error in the drawing
    const before = readdirSync(kitFile("pieces")).length;
    assert.match((await call(d.client, "save_kit_item", { doc: { ...chalkboard(), id: "cafe_chalkboard" } })).text, /x_/);
    assert.match((await call(d.client, "save_kit_item", { doc: { ...chalkboard(), id: "chair" } })).text, /x_/);
    const stray = { ...chalkboard(), id: "x_stray" }; (stray.variants as Record<string, unknown>).wall = { nonesuch: 1 };
    const bad = await call(d.client, "save_kit_item", { doc: stray });
    assert.ok(bad.isError);
    assert.match(bad.text, /nonesuch/);
    assert.match((await call(d.client, "save_variant", { of: "flag", name: "x_bad", params: { nonesuch: 1 } })).text, /nonesuch/);
    assert.equal(readdirSync(kitFile("pieces")).length, before);
    // the story check still passes with the kit items in the root
    assert.match((await call(d.client, "check_episode", { id: "s1e00" })).text, /s1e00: 0 errors/);
  } finally { await d.close(); rmSync(kitFile(), { recursive: true, force: true }); forget(); }
});

test("read-only: saving a kit item is refused, and says why", async () => {
  const { client, close } = await connect({ write: false, agentEdits: "direct" });
  try {
    for (const [name, args] of [["save_kit_item", { doc: chalkboard() }], ["save_variant", { of: "flag", name: "x_club", params: { kind: "bunting" } }]] as const) {
      const r = await call(client, name, args);
      assert.ok(r.isError, name);
      assert.match(r.text, /read-only/, name);
    }
    assert.ok(!existsSync(kitFile("pieces", "x_cafe_chalkboard.json")));
  } finally { await close(); }
});

test("show opens a set piece or prop on the kit page", async () => {
  const events = new Events(), seen: unknown[] = [];
  const { client, close } = await connect({ write: false, agentEdits: "proposals" }, events);
  try {
    assert.match((await call(client, "show", { id: "tea" })).text, /no editor is listening/);
    events.on((n, data) => { if (n === "show") seen.push(data); });
    assert.match((await call(client, "show", { id: "tea" })).text, /prop tea on the kit page/);
    assert.match((await call(client, "show", { id: "frontage" })).text, /set piece frontage/);
    assert.deepEqual(seen, [{ id: "tea", kit: "props" }, { id: "frontage", kit: "set" }]);
    assert.ok((await call(client, "show", { id: "nonesuch" })).isError);
  } finally { await close(); }
});
