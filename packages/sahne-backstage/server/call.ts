#!/usr/bin/env node
// Call any backstage MCP tool from the shell, so an agent with no MCP set up uses the very same tools (and checks):
//
//   node packages/sahne-backstage/server/call.ts <tool> ['<json args>' | @file.json | -] --content <abs folder> [--write] [--out <dir>]
//   node packages/sahne-backstage/server/call.ts list [<tool>] --content <root>     the tools, with their input schemas
//   node packages/sahne-backstage/server/call.ts read <resource uri> --content <root>   e.g. sahne://kit-guide
//
// Each image result is saved as a PNG under --out (default a temp dir), copied to <out>/latest.png, and its path printed
// first as `image: <path>`, so the caller can Read it; then the answer's text. An answer with pictures leaves out its JSON
// (the text says the same) unless --json; one without prints it. The exit code is 1 when the tool answered with an error.
// Flags: --write (else every write tool refuses), --agent-edits direct|proposals (default direct with --write: a one-shot
// process has no editor to accept a proposal), --share-cards, --out <dir>.
//
// --session <name> keeps one server process alive across calls (started on first use, on a unix socket in a private folder),
// so the kit and resvg load once; it stops after 15 idle minutes, with `--session <name> --stop`, and restarts itself when a
// TypeScript source of the kit, the engine, the story package or backstage changed, so an edit to a generator shows in the
// next render. `--session <name> --status` says whether it runs. Drawings (kit/*.json) are read fresh on every call.
// The socket, the session's log and the default --out live in a folder only this user can open (privateDir); a call waits
// at most --timeout seconds (default 120, or SAHNE_CALL_TIMEOUT_MS) for its session to answer.

import { parseArgs } from "node:util";
import { createHash, randomBytes } from "node:crypto";
import { createConnection, createServer, type Socket } from "node:net";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const PACKAGES = join(dirname(HERE), "../..");
export const IDLE_MS = 15 * 60_000;
/** How long a call waits for its session's answer before it gives up (SAHNE_CALL_TIMEOUT_MS or --timeout replace it). */
export const TIMEOUT_MS = 120_000;

// ---- the answer: what a call comes back as ------------------------------------------------------------------------------

type Block = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
interface Answer { isError: boolean; content: Block[] }
interface Config { content: string; write: boolean; agentEdits: "direct" | "proposals"; shareCards: boolean }
type Command = { kind: "tool"; name: string; args: Record<string, unknown> } | { kind: "list"; name?: string } | { kind: "read"; uri: string };

// ---- the server, in this process --------------------------------------------------------------------------------------------

/** The MCP server (mcp.ts) and a client of it linked in memory: the same tools an agent reaches over stdio. */
async function boot(c: Config) {
  if (c.content) process.env.SAHNE_CONTENT = c.content; else delete process.env.SAHNE_CONTENT;
  const [{ createMcp }, { Events }, { Client }, { InMemoryTransport }] = await Promise.all([
    import("./mcp.ts"), import("./events.ts"), import("@modelcontextprotocol/sdk/client/index.js"), import("@modelcontextprotocol/sdk/inMemory.js"),
  ]);
  const server = createMcp({ write: c.write, agentEdits: c.agentEdits, shareCards: c.shareCards, events: new Events(), fresh: true, by: "call.ts" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "call.ts", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
type Booted = Awaited<ReturnType<typeof boot>>;

async function perform(client: Booted, cmd: Command): Promise<Answer> {
  if (cmd.kind === "tool") {
    const r = await client.callTool({ name: cmd.name, arguments: cmd.args }) as { content: Block[]; isError?: boolean };
    return { isError: !!r.isError, content: r.content };
  }
  if (cmd.kind === "list") {
    const tools = (await client.listTools()).tools.filter(t => !cmd.name || t.name === cmd.name);
    if (cmd.name && !tools.length) return { isError: true, content: [{ type: "text", text: `no tool ${cmd.name}: \`list\` names them` }] };
    if (cmd.name) {
      const t = tools[0];
      return { isError: false, content: [{ type: "text", text: `${t.name}\n  ${(t.description ?? "").replace(/\n/g, " ")}\n  input: ${JSON.stringify(t.inputSchema)}` }] };
    }
    // one line a tool (its first sentence); `list <tool>` gives the whole description and the input schema
    const lines = tools.map(t => `${t.name.padEnd(16)} ${((t.description ?? "").replace(/\n/g, " ").match(/^.*?[.:](\s|$)/)?.[0] ?? t.description ?? "").trim().slice(0, 150)}`);
    const res = (await client.listResources()).resources.map(r => `${r.uri}  ${r.description ?? r.name}`);
    return { isError: false, content: [{ type: "text", text: `${USAGE}\n\n${tools.length} tools (call.ts list <tool>: its description and input)\n${lines.join("\n")}\n\nresources (call.ts read <uri>)\n${res.join("\n")}` }] };
  }
  const r = await client.readResource({ uri: cmd.uri });
  return { isError: false, content: r.contents.map(x => ({ type: "text" as const, text: "text" in x ? String(x.text) : `(${x.mimeType ?? "binary"} resource)` })) };
}

// ---- the session: one server process kept alive ---------------------------------------------------------------------------

/** `dir` made (mode 0700) or checked: a real folder (not a link), owned by this user, that no one else can open. Throws otherwise. */
export function privateDir(dir: string): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = lstatSync(dir), uid = process.getuid?.();
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`${dir} is not a folder of its own (a link or a file): remove it, call.ts keeps its sockets there`);
  if (uid !== undefined && st.uid !== uid) throw new Error(`${dir} belongs to another user (uid ${st.uid}): call.ts will not put its sockets there`);
  if (st.mode & 0o077) chmodSync(dir, 0o700);
  return dir;
}

/** A unix socket's path must stay short (104 bytes on macOS, with its NUL): the longest one call.ts makes. */
const SOCK_MAX = 100;

/** The private folder of this user's sessions: in the temp folder, or ~/.cache/sahne-call when a socket's path there would be too long. */
export function callDir(tmp = tmpdir(), cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache")): string {
  const inTmp = join(tmp, `sahne-call-${process.getuid?.() ?? 0}`);
  if (Buffer.byteLength(join(inTmp, "0123456789.sock")) <= SOCK_MAX) return privateDir(inTmp);
  const cache = join(cacheHome, "sahne-call");
  if (Buffer.byteLength(join(cache, "0123456789.sock")) > SOCK_MAX) throw new Error(`no short folder for the session's socket (${cache} is too long): set TMPDIR to a shorter folder`);
  mkdirSync(cacheHome, { recursive: true, mode: 0o700 });
  return privateDir(cache);
}

/** The socket of a session: <callDir>/<10 hex of this checkout and its name>.sock, so two worktrees' sessions of one name never meet. */
export const sockOf = (name: string, dir = callDir()) => join(dir, `${createHash("sha1").update(`${PACKAGES}\0${name}`).digest("hex").slice(0, 10)}.sock`);

/** The newest mtime of the TypeScript the server was built from (SAHNE_CALL_WATCH: other folders, for the test). */
export function newest(dirs: string[] = (process.env.SAHNE_CALL_WATCH ? process.env.SAHNE_CALL_WATCH.split(":") : ["sahne", "sahne-kit", "sahne-story", "sahne-backstage"].map(p => join(PACKAGES, p)))): number {
  let t = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === "test" || e.name === "samples" || e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith(".ts")) t = Math.max(t, statSync(p).mtimeMs);
    }
  };
  for (const d of dirs) if (existsSync(d)) walk(d);
  return t;
}

/** The session process: serves requests (one at a time) on the socket until idle or stopped. */
async function serve(name: string, c: Config) {
  const path = sockOf(name), built = newest(), started = Date.now();
  const client = await boot(c);
  let idle: NodeJS.Timeout, chain: Promise<unknown> = Promise.resolve();
  const bye = (code = 0) => { try { unlinkSync(path); } catch {} process.exit(code); };
  const tick = () => { clearTimeout(idle); idle = setTimeout(() => bye(), Number(process.env.SAHNE_CALL_IDLE_MS) || IDLE_MS); };
  const server = createServer(sock => {
    let buf = "";
    sock.on("data", d => {
      buf += d;
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      tick();
      chain = chain.then(() => handle(sock, line));
    });
    sock.on("error", () => {});
  });
  async function handle(sock: Socket, line: string) {
    let reply: unknown;
    let exit = false;
    try {
      const req = JSON.parse(line) as { op: "stop" | "status" | "run"; config?: Config; cmd?: Command };
      if (req.op === "stop") { reply = { stopped: true }; exit = true; }
      else if (req.op === "status") reply = { pid: process.pid, up: Math.round((Date.now() - started) / 1000), config: c, stale: newest() > built };
      else if (JSON.stringify(req.config) !== JSON.stringify(c)) reply = { mismatch: `session ${name} serves ${c.content || "the samples"}${c.write ? " (--write)" : ""}: stop it first (--session ${name} --stop)` };
      else if (newest() > built) { reply = { restart: true }; exit = true; }
      else reply = await perform(client, req.cmd!);
    } catch (e) { reply = { isError: true, content: [{ type: "text", text: `failed: ${(e as Error).message}` }] }; }
    if (exit) { try { unlinkSync(path); } catch {} }
    sock.end(`${JSON.stringify(reply)}\n`, () => { if (exit) process.exit(0); });
  }
  const listen = () => new Promise<void>((res, rej) => { server.once("error", rej); server.listen(path, () => res()); });
  try { await listen(); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE") throw e;
    if (await alive(path)) return process.exit(0); // another session process won the race
    try { unlinkSync(path); } catch {}
    await listen();
  }
  tick();
}

const alive = (path: string) => new Promise<boolean>(res => { const s = createConnection(path, () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });

/** The wait for a session's answer: --timeout (seconds), else SAHNE_CALL_TIMEOUT_MS, else TIMEOUT_MS. */
export function timeoutOf(flag?: string): number {
  const ms = flag !== undefined ? Number(flag) * 1000 : Number(process.env.SAHNE_CALL_TIMEOUT_MS || TIMEOUT_MS);
  if (!Number.isFinite(ms) || ms <= 0) throw new Error(`--timeout is a number of seconds above 0, not ${flag}`);
  return ms;
}

/** One request to the session process on `path`: the answer, or null when nothing listens. Rejects when nothing came back in `ms`. */
export function ask(path: string, req: unknown, ms = timeoutOf(), name = "this"): Promise<Record<string, unknown> | null> {
  return new Promise((res, rej) => {
    const s = createConnection(path);
    let buf = "", connected = false;
    const timer = setTimeout(() => {
      s.destroy();
      rej(new Error(`the session ${name} did not answer within ${Math.round(ms / 100) / 10} s${connected ? " (it serves one call at a time: one may still be running before this one)" : ""}. Wait longer with --timeout <seconds> (or SAHNE_CALL_TIMEOUT_MS), or stop it with --session ${name} --stop`));
    }, ms);
    const done = (v: Record<string, unknown> | null) => { clearTimeout(timer); res(v); };
    s.on("connect", () => { connected = true; s.write(`${JSON.stringify(req)}\n`); });
    s.on("data", d => { buf += d; });
    s.on("end", () => { try { done(JSON.parse(buf)); } catch { done(null); } });
    s.on("error", () => done(null));
  });
}

/** Why a session did not start: the last lines of its log (where its error is), and where the log is. */
export function notStarted(name: string, log: string): string {
  let tail = "";
  try { tail = readFileSync(log, "utf8").trimEnd().split("\n").slice(-6).join("\n"); } catch {}
  return `the session ${name} did not start${tail ? `:\n${tail}\n` : " "}(the whole log: ${log})`;
}

async function startSession(name: string, c: Config, flags: string[]) {
  const path = sockOf(name), log = join(callDir(), `${name.replace(/\W/g, "_")}.log`);
  const fd = openSync(log, "a");
  const p = spawn(process.execPath, [HERE, "--serve", "--session", name, ...flags], { detached: true, stdio: ["ignore", fd, fd], env: process.env });
  p.unref();
  for (let i = 0; i < 600; i++) {
    if (await alive(path)) return;
    if (p.exitCode !== null) break;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(notStarted(name, log));
}

/** The answer of a session process, starting or restarting it when it is not running or its source is stale. */
async function viaSession(name: string, c: Config, flags: string[], cmd: Command, ms: number): Promise<Answer> {
  const path = sockOf(name);
  for (let attempt = 0; attempt < 3; attempt++) {
    let r = await ask(path, { op: "run", config: c, cmd }, ms, name);
    if (r === null) { await startSession(name, c, flags); r = await ask(path, { op: "run", config: c, cmd }, ms, name); }
    if (r === null || r.restart) continue;
    if (r.mismatch) throw new Error(String(r.mismatch));
    return r as unknown as Answer;
  }
  throw new Error(`the session ${name} would not answer`);
}

// ---- the command line ------------------------------------------------------------------------------------------------------

async function argsOf(raw: string | undefined): Promise<Record<string, unknown>> {
  if (raw === undefined) return {};
  const text = raw === "-" ? readFileSync(0, "utf8") : raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
  let v: unknown;
  try { v = JSON.parse(text); } catch (e) { throw new Error(`the arguments are not JSON (${(e as Error).message}); pass '{...}', @file.json or - for stdin`); }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("the arguments are one JSON object, like '{\"id\":\"frontage\"}'");
  return v as Record<string, unknown>;
}

/** A PNG's name no other call shares, in the order they were made: <yyyymmdd-hhmmss-mmm>-<pid>-<n>-<4 hex>-<tool>.png. */
export function pngName(tool: string, n: number, at = new Date()): string {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace("T", "-").replace(".", "-").slice(0, 19);
  return `${stamp}-${process.pid}-${n}-${randomBytes(2).toString("hex")}-${tool.replace(/\W+/g, "_")}.png`;
}

/**
 * An answer as the shell prints it: each picture saved as a PNG under `dir` (never over another file) and its path first
 * (`image: <path>`), the first also as <dir>/latest.png; then the text. The JSON block (the last, after the pictures: the text says
 * the same, but a drawing's document is only there) on one line as `data: {…}`, whole with `json`; with no pictures, as it is.
 */
export function emit(a: Answer, dir: string, tool: string, json = false): { images: string; text: string } {
  mkdirSync(dir, { recursive: true });
  let n = 0;
  const images: string[] = [], texts: string[] = [];
  a.content.forEach((b, i) => {
    if (b.type === "image") {
      const file = join(dir, pngName(tool, ++n)), bytes = Buffer.from(b.data, "base64");
      writeFileSync(file, bytes, { flag: "wx" });
      if (n === 1) writeFileSync(join(dir, "latest.png"), bytes);
      images.push(`image: ${file}`);
      return;
    }
    const data = i === a.content.length - 1 && i > 0 && a.content.some(x => x.type === "image") && /^[[{]/.test(b.text);
    texts.push(!data ? b.text : json ? JSON.stringify(JSON.parse(b.text), null, 1) : `data: ${JSON.stringify(JSON.parse(b.text))}`);
  });
  return { images: images.join("\n"), text: texts.join("\n") };
}

const USAGE = `usage: call.ts <tool> ['<json args>' | @file.json | -] [--content <abs folder>] [--write] [--session <name>] [--out <dir>] [--json] [--timeout <s>]
       call.ts list [<tool>]   call.ts read <uri>   call.ts --session <name> --stop|--status
  pictures: printed first as image: <path> (on stdout, even with an error), the first also <out>/latest.png; then the text,
  and its data on one line (data: {…}); --json prints the data whole`;

async function main(): Promise<"serving" | void> {
  const { values: o, positionals: pos } = parseArgs({
    allowPositionals: true,
    options: {
      content: { type: "string" }, write: { type: "boolean", default: false }, out: { type: "string" }, session: { type: "string" }, stop: { type: "boolean", default: false },
      status: { type: "boolean", default: false }, serve: { type: "boolean", default: false }, "agent-edits": { type: "string" }, "share-cards": { type: "boolean", default: false },
      timeout: { type: "string" }, json: { type: "boolean", default: false },
    },
  });
  const content = o.content ?? process.env.SAHNE_CONTENT ?? "";
  if (content && !isAbsolute(content)) throw new Error(`--content is an absolute folder, not ${content}`);
  const agentEdits = (o["agent-edits"] ?? (o.write ? "direct" : "proposals")) as "direct" | "proposals";
  if (agentEdits !== "direct" && agentEdits !== "proposals") throw new Error("--agent-edits is direct or proposals");
  const config: Config = { content: content ? resolve(content) : "", write: o.write, agentEdits, shareCards: o["share-cards"] };
  // the flags a session process is started with (it reads the same ones)
  const flags = [...(config.content ? ["--content", config.content] : []), ...(config.write ? ["--write"] : []), "--agent-edits", agentEdits, ...(config.shareCards ? ["--share-cards"] : [])];

  const ms = timeoutOf(o.timeout);
  if (o.serve) { if (!o.session) throw new Error("--serve is for a session"); await serve(o.session, config); return "serving"; }
  if (o.session && (o.stop || o.status)) {
    const r = await ask(sockOf(o.session), { op: o.stop ? "stop" : "status" }, ms, o.session);
    if (o.stop) console.log(r ? `session ${o.session} stopped` : `session ${o.session} was not running`);
    else console.log(r ? `session ${o.session}: pid ${r.pid}, up ${r.up} s, ${(r.config as Config).content || "the samples"}${(r.config as Config).write ? " (--write)" : ""}${r.stale ? ", its source changed (the next call restarts it)" : ""}` : `session ${o.session} is not running`);
    return;
  }
  const [verb, ...rest] = pos;
  if (!verb) {
    console.error(USAGE);
    process.exit(2);
  }
  const cmd: Command = verb === "list" ? { kind: "list", name: rest[0] } : verb === "read" ? { kind: "read", uri: rest[0] ?? "sahne://kit-guide" } : { kind: "tool", name: verb, args: await argsOf(rest[0]) };
  // the default --out: a private folder (a session's own, kept; else a new one per call)
  const out = o.out ?? (o.session ? privateDir(join(callDir(), `out-${o.session.replace(/\W/g, "_")}`)) : mkdtempSync(join(callDir(), "out-")));
  const a = o.session ? await viaSession(o.session, config, flags, cmd, ms) : await perform(await boot(config), cmd);
  const { images, text } = emit(a, out, verb, o.json);
  // the pictures on stdout even with an error (a sheet with one bad item draws the rest); the error's text on stderr
  if (images) console.log(images);
  if (a.isError) { console.error(text); process.exitCode = 1; } else console.log(text);
}

if (process.argv[1] === HERE) {
  // leave once stdout and stderr have drained (a pipe may still hold a long answer)
  const leave = (code: number) => process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
  main().then(r => { if (r !== "serving") leave(Number(process.exitCode ?? 0)); }, e => { console.error(`call.ts: ${(e as Error).message}`); leave(1); });
}
