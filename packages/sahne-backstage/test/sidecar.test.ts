// The content root's sidecar for the assistant (server/chats.ts, server/runs/record.ts, src/model/chats.ts): conversations
// kept one file each, trimmed, the newest 100, with ids that can never be a path; written only with --write, while a
// read-only backstage says the browser keeps them; a browser's own conversations moved once; and a task's record, written
// by the backstage that runs it and read by another one on the same root (another config) that never ran it.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chatOf, keptChat, KEEP_CHAT, KEEP_THINKING, safeId, toMove } from "../src/model/chats.ts";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CLI = fileURLToPath(new URL("../server/cli.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-sidecar-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
// two people's config folders: two backstages on one root that share no store
const configA = mkdtempSync(join(tmpdir(), "backstage-sidecar-a-")), configB = mkdtempSync(join(tmpdir(), "backstage-sidecar-b-"));

function start(args: string[], config: string): Promise<{ url: string; p: ChildProcess }> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [CLI, "--port", "0", "--content", root, ...args], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SAHNE_BACKSTAGE_CONFIG: config } });
    let out = "";
    const onData = (d: Buffer) => { out += d; const m = /sahne-backstage on (http:\/\/localhost:\d+\/)/.exec(out); if (m) res({ url: m[1], p }); };
    p.stdout!.on("data", onData); p.stderr!.on("data", onData);
    p.on("exit", c => rej(new Error(`exited ${c}: ${out}`)));
    setTimeout(() => { p.kill(); rej(new Error(`no "sahne-backstage on" line in 60 s: ${out}`)); }, 60_000).unref();
  });
}
const stop = (p?: ChildProcess) => new Promise<void>(r => {
  if (!p || p.exitCode !== null || p.signalCode !== null) { p?.stdout?.destroy(); p?.stderr?.destroy(); return r(); }
  p.once("exit", () => r());
  p.kill("SIGKILL");
  p.stdout?.destroy(); p.stderr?.destroy();
});

let rw: { url: string; p: ChildProcess }, other: { url: string; p: ChildProcess }, ro: { url: string; p: ChildProcess };
before(async () => { [rw, other, ro] = await Promise.all([start(["--write"], configA), start(["--write"], configB), start([], configA)]); });
after(async () => { await Promise.all([stop(rw?.p), stop(other?.p), stop(ro?.p)]); for (const d of [root, configA, configB]) rmSync(d, { recursive: true, force: true }); });

const call = async (base: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(base + "api/" + path, { method, headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
};
const CHATS = join(root, ".backstage", "chats");
const chat = (at: number, text = "Hello") => ({ title: text, at, turns: [{ role: "user", content: text }, { role: "assistant", content: "Hi", parts: [{ type: "thinking", text: "t".repeat(5000) }, { type: "tool", name: "read_story", detail: "a long result", summary: "read" }, { type: "text", text: "Hi" }] }] });

test("kept: the thinking shortened, no tool's result or picture, the oldest turns dropped to fit; ids are never a path", () => {
  const k = chatOf({ ...chat(1), turns: [...chat(1).turns, { role: "user", content: "x", pictures: ["data"] }, { role: "nobody", content: "y" }] }, "c1")!;
  assert.equal(k.turns.length, 3, "a turn of no one is dropped");
  const parts = k.turns[1].parts as { type: string; text?: string; detail?: string }[];
  assert.equal(parts[0].text!.length, KEEP_THINKING);
  assert.equal(parts[1].detail, undefined);
  assert.ok(!("pictures" in k.turns[2]));
  assert.equal(chatOf({ turns: [] }, "c1"), null, "no time");
  const big = keptChat({ id: "c2", title: "big", at: 1, turns: Array.from({ length: 50 }, (_, i) => ({ role: "user" as const, content: `${i} ${"w".repeat(10_000)}` })) });
  assert.ok(JSON.stringify(big).length <= KEEP_CHAT && big.turns.at(-1)!.content.startsWith("49 "), "the newest turns stay");
  for (const ok of ["c1", "mz3k2-a9", "r12-k3f"]) assert.ok(safeId(ok), ok);
  for (const bad of ["", "..", "../x", "a/b", "A1", "-x", "a.json", "a b", "x".repeat(65), 7]) assert.ok(!safeId(bad), String(bad));
});

test("moved once: this browser's conversations the series lacks, or has older", () => {
  const local = [{ id: "c1", title: "a", at: 5, turns: [{ role: "user" as const, content: "a" }] }, { id: "c2", title: "b", at: 5, turns: [{ role: "user" as const, content: "b" }] }, { id: "c3", title: "c", at: 9, turns: [] }, { id: "../x", title: "d", at: 1, turns: [{ role: "user" as const, content: "d" }] }];
  assert.deepEqual(toMove(local, [{ id: "c1", at: 3 }, { id: "c2", at: 7 }]).map(c => c.id), ["c1"], "the series' newer c2 stays; an empty or unsafe one is not moved");
  assert.deepEqual(toMove(local, []).map(c => c.id), ["c1", "c2"]);
});

test("chats: written, listed newest first, read, deleted; refused read-only and for an id that is not one", async () => {
  assert.deepEqual((await call(rw.url, "GET", "chats")).body, { chats: [], write: true });
  assert.deepEqual((await call(ro.url, "GET", "chats")).body.write, false, "a read-only backstage: the browser keeps them");
  assert.equal((await call(rw.url, "PUT", "chats/c1", chat(1000, "first"))).status, 200);
  const put = await call(rw.url, "PUT", "chats/c2", chat(2000, "second"));
  assert.deepEqual([put.status, put.body.chat.id, put.body.chat.messages], [200, "c2", 1]);
  const list = (await call(rw.url, "GET", "chats")).body.chats;
  assert.deepEqual(list.map((c: { id: string; title: string }) => [c.id, c.title]), [["c2", "second"], ["c1", "first"]]);
  assert.ok(list.every((c: { size: number; turns?: unknown }) => c.size > 0 && c.turns === undefined), "the list has no turns");
  const one = await call(rw.url, "GET", "chats/c1");
  assert.equal(one.body.chat.turns[1].parts[0].text.length, KEEP_THINKING, "trimmed by the server, whatever the browser sent");
  const onDisk = JSON.parse(readFileSync(join(CHATS, "c1.json"), "utf8"));
  assert.ok(!JSON.stringify(onDisk).includes("a long result"), "a tool's result is never written");
  assert.equal((await call(other.url, "GET", "chats/c2")).body.chat.title, "second", "another backstage on the root reads it");
  assert.equal((await call(ro.url, "PUT", "chats/c3", chat(3))).status, 403);
  assert.equal((await call(ro.url, "DELETE", "chats/c1")).status, 403);
  assert.equal((await call(rw.url, "PUT", "chats/c3", { turns: "no" })).status, 400);
  for (const bad of ["..%2Fx", "%2e%2e", "a%2Fb", "C1", "x.json", "%2E%2E%2Fseries"]) {
    // refused as no id (400), or not even reaching the route once fetch resolves the dots (404)
    assert.ok([400, 404].includes((await call(rw.url, "PUT", `chats/${bad}`, chat(1))).status), bad);
    assert.ok([400, 404].includes((await call(rw.url, "GET", `chats/${bad}`)).status), bad);
  }
  assert.equal((await call(rw.url, "PUT", "chats/..%2Fx", chat(1))).status, 400, "a slash inside the id");
  assert.equal((await call(rw.url, "PUT", "chats/a/b", chat(1))).status, 404);
  assert.deepEqual(readdirSync(CHATS).sort(), ["c1.json", "c2.json"], "nothing written anywhere else");
  assert.ok(existsSync(join(root, "series.json")));
  assert.equal((await call(rw.url, "DELETE", "chats/c1")).status, 200);
  assert.equal((await call(rw.url, "DELETE", "chats/c1")).status, 404);
  assert.equal((await call(rw.url, "GET", "chats/c1")).status, 404);
});

test("chats: the newest 100 per root, by their own time", async () => {
  for (let i = 0; i < 102; i++) assert.equal((await call(rw.url, "PUT", `chats/n${i}`, chat(10_000 + i))).status, 200);
  const ids = (await call(rw.url, "GET", "chats")).body.chats.map((c: { id: string }) => c.id);
  assert.equal(ids.length, 100);
  assert.deepEqual([ids[0], ids.at(-1)], ["n101", "n2"], "the oldest went (c2, n0, n1)");
  assert.equal(readdirSync(CHATS).length, 100);
});

test("a task's record: written as it changes, read by a backstage that never ran it, whose own tasks take other ids", async () => {
  const plan = { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "X", brief: "Make x.", about: "Makes X", owns: [{ kind: "character", id: "x_person" }] }] };
  const { run } = (await call(rw.url, "POST", "runs", { goal: "a task in A", plan })).body;
  const file = join(root, ".backstage", "tasks", `${run.id}.json`);
  const rec = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual([rec.id, rec.status, rec.goal, rec.steps[0].about, rec.made, rec.did], [run.id, "gate", "a task in A", "Makes X", [], []]);
  assert.ok(!("brief" in rec.steps[0]) && !("gates" in rec) && !("concurrency" in rec), "named fields only");
  await call(rw.url, "POST", `runs/${run.id}`, { action: "stop" });
  assert.equal(JSON.parse(readFileSync(file, "utf8")).status, "stopped");
  // the other backstage has its own store: the task is not its, but its record is the series'
  assert.equal((await call(other.url, "GET", `runs/${run.id}`)).status, 404);
  const seen = await call(other.url, "GET", `tasks/${run.id}`);
  assert.deepEqual([seen.status, seen.body.task.status, seen.body.task.goal], [200, "stopped", "a task in A"]);
  assert.ok((await call(other.url, "GET", "tasks")).body.tasks.some((t: { id: string }) => t.id === run.id));
  assert.equal((await call(other.url, "GET", "tasks/..%2Fchats%2Fn5")).status, 404);
  const mine = (await call(other.url, "POST", "runs", { goal: "a task in B", plan })).body.run;
  assert.notEqual(mine.id, run.id);
  assert.equal(Number(/^r(\d+)/.exec(mine.id)![1]), Number(/^r(\d+)/.exec(run.id)![1]) + 1, "numbered after the root's records");
  assert.equal((await call(ro.url, "GET", `tasks/${mine.id}`)).body.task.goal, "a task in B", "a read-only backstage reads records too");
});
