// Backstage's HTTP server (Node only): the JSON API over the content root (content.ts), the page and its bundle (esbuild,
// built into dist/app, git-ignored, and rebuilt when a source changes), the bubbles' font and the kit's sounds. It answers only this machine: a request whose Host or Origin
// is not localhost is refused, so a web page open in the same browser cannot reach it, and a write must be JSON. The same
// guard covers the MCP server at /mcp (mcp.ts, Streamable HTTP, one session per client), the editors' event stream
// (events.ts), the agents' proposals (proposals.ts) and what agents did (agents.ts). The guides (`GET /api/docs`) are
// the repo's own READMEs, served as they are.

import * as esbuild from "esbuild";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CONTENT, IS_SAMPLES } from "../../sahne-story/paths.ts";
import { allProblems, check, exists, forget, isKind, kitDocs, lessons, listing, oldShape, readDoc, save, searchCards, type Edit } from "./content.ts";
import { headOf } from "./git.ts";
import { readReview, writeReview } from "./review.ts";
import { requestOf, runAssistant, usageSummary } from "./assistant.ts";
import { MODELS } from "./ai/providers/anthropic.ts";
import { overrides, readiness, readSettings, settingsFile, writeSettings, webOf } from "./settings.ts";
import { Events, selectionOf } from "./events.ts";
import { Agents, callOf } from "./agents.ts";
import { createMcp, type AgentEdits } from "./mcp.ts";
import { proposalsOf, type NewProposal, type ProposalEdit } from "./proposals.ts";
import { looksOf } from "./look.ts";
import { DOCS } from "./guides.ts";
import { forgetNote, readMemory, remember } from "./memory.ts";

const HERE = new URL("../", import.meta.url);
const CLI_PATH = fileURLToPath(new URL("cli.ts", import.meta.url));
export { DOCS } from "./guides.ts";
const SOUNDS = new URL("../../sahne-kit/sounds/", import.meta.url);
const FONTS = new URL("node_modules/@fontsource/comic-neue/files/", HERE);

export interface Options { port: number; write: boolean; host?: string; log?: boolean; agentEdits?: AgentEdits; shareCards?: boolean }
export interface Running { url: string; port: number; close(): Promise<void> }

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

class Fail extends Error {
  readonly status: number; readonly body?: object;
  constructor(status: number, message: string, body?: object) { super(message); this.status = status; this.body = body; }
}

async function body(req: http.IncomingMessage): Promise<unknown> {
  if (!/^application\/json\b/.test(req.headers["content-type"] ?? "")) throw new Fail(415, "a write is application/json");
  let n = 0;
  const parts: Buffer[] = [];
  for await (const c of req) { n += (c as Buffer).length; if (n > 8 << 20) throw new Fail(413, "too large"); parts.push(c as Buffer); }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new Fail(400, "not JSON"); }
}

/** The stale or missing story pictures, from the gallery's thumbs.mjs --check (no browser needed). */
function staleThumbs(): Promise<string[]> {
  return new Promise(res => {
    const p = spawn(process.execPath, [fileURLToPath(new URL("../../sahne-gallery/thumbs.mjs", import.meta.url)), "--check"], { env: { ...process.env, SAHNE_CONTENT: fileURLToPath(CONTENT) }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", d => (out += d)); p.stderr.on("data", d => (out += d));
    p.on("close", () => res(/missing or stale: (.*)/.exec(out)?.[1].split(", ").map(s => s.trim()).filter(Boolean) ?? []));
    p.on("error", () => res([]));
  });
}

export async function serve(o: Options): Promise<Running> {
  const ctx = await esbuild.context({
    entryPoints: [fileURLToPath(new URL("src/index.ts", HERE))], bundle: true, format: "esm", target: "es2022", sourcemap: true,
    outdir: fileURLToPath(new URL("dist/app", HERE)), logLevel: o.log ? "info" : "silent",
  });
  const { port: inner } = await ctx.serve({ servedir: fileURLToPath(HERE), port: 0, host: "127.0.0.1" });

  const json = (res: http.ServerResponse, status: number, v: unknown) => res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(v));

  // how agents' edits land: --agent-edits, else the person's settings; changed on the Agents page for agents that connect after
  let agentEdits: AgentEdits = o.agentEdits ?? readSettings().agentEdits ?? "proposals";
  const shareCards = o.shareCards === true;
  const events = new Events(), proposals = proposalsOf(events), agents = new Agents(events), looks = looksOf(events);
  const writable = () => o.write && !oldShape().length;
  /** The assistant, as `GET /api/world` gives it: false when it cannot run, so a plain truthiness check still works. */
  const aiOf = () => {
    const r = readiness();
    return r.ready ? { ready: true, provider: r.provider, model: r.model ?? (r.provider === "anthropic" ? MODELS.full : "local"), web: webOf(readSettings()) } : false;
  };
  /** The settings for the editor: what is in effect, where the file is, what the environment overrides, and whether keys are set (never the keys). */
  const settingsView = () => ({ settings: readSettings(), file: settingsFile(), overrides: overrides(), keys: { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY, tavily: !!process.env.TAVILY_API_KEY }, ai: readiness(), web: webOf(readSettings()), raw: existsSync(settingsFile()) ? readFileSync(settingsFile(), "utf8") : null });

  // ---- MCP over Streamable HTTP: a session per client, made by its initialize request ----
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();
  async function mcp(req: http.IncomingMessage, res: http.ServerResponse) {
    const sid = req.headers["mcp-session-id"];
    if (typeof sid === "string") {
      const s = sessions.get(sid);
      if (!s) return json(res, 404, { jsonrpc: "2.0", error: { code: -32001, message: "no such MCP session: initialize again" }, id: null });
      return s.transport.handleRequest(req, res);
    }
    if (req.method !== "POST") return json(res, 400, { jsonrpc: "2.0", error: { code: -32000, message: "no MCP session: send an initialize request first" }, id: null });
    const first = await body(req);
    if (!isInitializeRequest(first)) return json(res, 400, { jsonrpc: "2.0", error: { code: -32000, message: "no MCP session: send an initialize request first" }, id: null });
    const mode = agentEdits;
    let sessionId: string | undefined;
    const server = createMcp({ write: o.write, agentEdits: mode, shareCards, events, onCall: c => agents.record(c, sessionId) });
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: id => { sessionId = id; sessions.set(id, { server, transport }); agents.open(id, server, mode); },
      onsessionclosed: id => { sessions.delete(id); agents.close(id); },
    });
    transport.onclose = () => { if (transport.sessionId) { sessions.delete(transport.sessionId); agents.close(transport.sessionId); } };
    await server.connect(transport);
    await transport.handleRequest(req, res, first);
  }

  /** Everything the Agents page shows: how to connect, how edits land, who is connected, what they did, and the tools. */
  const agentsView = async (req: http.IncomingMessage) => ({
    mcpUrl: `http://${req.headers.host}/mcp`, cli: CLI_PATH, content: IS_SAMPLES ? null : fileURLToPath(CONTENT), write: o.write, writable: writable(), agentEdits, shareCards,
    sessions: agents.sessions(), editors: events.size, activity: agents.recent(), pending: proposals.all().length,
    tools: await agents.catalog(() => createMcp({ write: o.write, agentEdits, shareCards, events })),
  });

  /** A proposal another backstage process sends (`cli.ts mcp --backstage`), checked here, against this root. */
  function proposalOf(v: unknown): NewProposal {
    const b = v as Partial<NewProposal>;
    const edit = (e: Partial<ProposalEdit>, what: string): ProposalEdit => {
      if (!e || !isKind(String(e.kind)) || typeof e.doc !== "string" || !e.next || typeof e.next !== "object" || Array.isArray(e.next)) throw new Fail(400, `${what} is { kind, doc, next, base?, create? }`);
      if (!e.create && !exists(e.kind!, e.doc)) throw new Fail(400, `${what}: there is no ${e.kind} ${e.doc}`);
      const paths = Array.isArray(e.paths) ? e.paths.filter(p => Array.isArray(p) && p.every(k => typeof k === "string" || typeof k === "number")) : undefined;
      return { kind: e.kind!, doc: e.doc, next: e.next, ...(typeof e.base === "number" ? { base: e.base } : {}), ...(e.create === true ? { create: true } : {}), ...(paths ? { paths } : {}) };
    };
    const main = edit(b as Partial<ProposalEdit>, "a proposal");
    const also = Array.isArray(b.also) ? b.also.map((e, i) => edit(e, `also[${i}]`)) : [];
    const paths = Array.isArray(b.paths) ? b.paths.filter(p => Array.isArray(p) && p.every(k => typeof k === "string" || typeof k === "number")) : [];
    const problems = check([main, ...also].map(e => ({ kind: e.kind, id: e.doc, doc: e.next, mtime: e.base, create: e.create })));
    return { ...main, ...(also.length ? { also } : {}), paths, summary: String(b.summary ?? "").slice(0, 500), by: String(b.by ?? "agent").slice(0, 80) || "agent", problems, ...(typeof b.after === "string" && proposals.get(b.after) ? { after: b.after } : {}) };
  }

  async function api(req: http.IncomingMessage, res: http.ServerResponse, path: string[]) {
    const [route, a, b] = path;
    const m = req.method ?? "GET";
    if (route === "world" && m === "GET") return json(res, 200, { ...listing(), samples: IS_SAMPLES, writable: writable(), oldShape: oldShape().length, ai: aiOf(), agentEdits, shareCards });
    if (route === "events" && m === "GET") return events.stream(req, res);
    if (route === "events" && m === "POST") {
      // another backstage process on this root (cli.ts mcp --backstage) tells the editors what it did
      const e = await body(req) as { event?: unknown; data?: unknown };
      const d = (e?.data ?? {}) as Record<string, unknown>;
      if (e?.event === "show" && typeof d.id === "string") { events.emit("show", { id: d.id, step: Array.isArray(d.step) ? d.step : null }); return json(res, 200, { ok: true }); }
      if (e?.event === "doc" && typeof d.kind === "string" && typeof d.id === "string") { forget(); events.emit("doc", { kind: d.kind, id: d.id, mtime: d.mtime, ...(typeof d.by === "string" ? { by: d.by } : {}) }); return json(res, 200, { ok: true }); }
      if (e?.event === "look" && typeof d.rid === "string" && /^[0-9a-f]{16}$/.test(d.rid)) { looks.wait(d.rid); events.emit("look", d); return json(res, 200, { ok: true }); }
      if (e?.event === "activity") { const c = callOf(d); if (!c) throw new Fail(400, "an activity is { by, tool, ok, ms, summary }"); agents.record(c); return json(res, 200, { ok: true }); }
      throw new Fail(400, "expected { event: \"show\" | \"doc\" | \"activity\" | \"look\", data }");
    }
    // a picture of the stage an agent asked for (look.ts): an editor posts it once; an agent on stdio waits for it here
    if (route === "look" && a && m === "POST") {
      const v = await body(req) as { image?: unknown };
      if (!looks.answer(a, typeof v?.image === "string" ? v.image : null)) throw new Fail(404, `no open look ${a}: answered already, or never asked`);
      return json(res, 200, { ok: true });
    }
    if (route === "look" && a && m === "GET") {
      if (!/^[0-9a-f]{16}$/.test(a)) throw new Fail(400, "not a look id");
      const png = await looks.wait(a).picture;
      return json(res, 200, { image: png ? png.toString("base64") : null });
    }
    if (route === "selection" && m === "GET") return json(res, 200, { selection: events.selection });
    if (route === "selection" && m === "POST") {
      const s = selectionOf(await body(req));
      if (!s) throw new Fail(400, "expected { page, kind?, id?, path? }");
      events.selection = s;
      return json(res, 200, { ok: true });
    }
    if (route === "proposals" && m === "GET" && !a) return json(res, 200, { proposals: proposals.all(), resolved: await proposals.resolved() });
    if (route === "proposals" && m === "POST" && !a) {
      if (!writable()) throw new Fail(403, "this backstage is read-only: it takes no proposals");
      return json(res, 200, { proposal: await proposals.add(proposalOf(await body(req))) });
    }
    if (route === "proposals" && m === "POST" && a) {
      const v = await body(req) as { accepted?: unknown; withdraw?: unknown };
      // an agent on stdio (--backstage) takes back its own proposal
      if (typeof v?.withdraw === "string") {
        try { return json(res, 200, { resolved: await proposals.withdraw(a, v.withdraw) }); } catch (e) { throw new Fail(400, (e as Error).message); }
      }
      if (typeof v?.accepted !== "boolean") throw new Fail(400, "expected { accepted: true | false } or { withdraw: <agent> }");
      const gone = proposals.resolve(a, v.accepted);
      if (!gone) throw new Fail(404, `no proposal ${a}`);
      return json(res, 200, { resolved: gone.map(p => p.id) });
    }
    if (route === "reload" && m === "POST") { forget(); return json(res, 200, { ok: true }); }
    if (route === "doc" && m === "GET" && a && b) {
      if (!isKind(a) || !exists(a, b)) throw new Fail(404, `no ${a} ${b}`);
      return json(res, 200, readDoc(a, b));
    }
    if (route === "check" && m === "POST") {
      const edits = editsOf(await body(req));
      return json(res, 200, { problems: check(edits) });
    }
    if (route === "save" && m === "POST") {
      const r = save(editsOf(await body(req)), { write: o.write });
      return json(res, r.status, r);
    }
    if (route === "head" && m === "GET" && a && b) {
      if (!isKind(a) || !exists(a, b)) throw new Fail(404, `no ${a} ${b}`);
      return json(res, 200, { doc: await headOf(a, b) });
    }
    if (route === "cards" && m === "GET") return json(res, 200, { cards: searchCards(new URL(req.url ?? "", "http://localhost").searchParams.get("q") ?? "") });
    if (route === "lessons" && m === "GET") return json(res, 200, { lessons: lessons() });
    if (route === "kit" && m === "GET") return json(res, 200, kitDocs());
    if (route === "problems" && m === "GET") return json(res, 200, { problems: allProblems() });
    if (route === "review" && m === "GET") return json(res, 200, readReview());
    if (route === "review" && m === "POST") {
      if (!o.write) throw new Fail(403, "read-only: start backstage with --write");
      return json(res, 200, writeReview(await body(req)));
    }
    if (route === "assistant" && m === "POST") {
      const ask = requestOf(await body(req));
      if (typeof ask === "string") throw new Fail(400, ask);
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
      // a closed tab stops the spending: the provider's request is aborted
      const stop = new AbortController();
      res.on("close", () => { if (!res.writableEnded) stop.abort(); });
      await runAssistant(ask, e => { if (!res.writableEnded) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`); }, { write: o.write, agentEdits, shareCards, events, signal: stop.signal, onCall: c => agents.record(c) });
      res.end();
      return;
    }
    if (route === "settings" && m === "GET") return json(res, 200, settingsView());
    if (route === "settings" && m === "POST") { const s = writeSettings(await body(req)); if (s.agentEdits) agentEdits = s.agentEdits; return json(res, 200, settingsView()); }
    if (route === "agents" && m === "GET") return json(res, 200, await agentsView(req));
    if (route === "agents" && m === "POST") {
      const v = await body(req) as { agentEdits?: unknown };
      if (v?.agentEdits !== "proposals" && v?.agentEdits !== "direct") throw new Fail(400, "expected { agentEdits: \"proposals\" | \"direct\" }");
      agentEdits = v.agentEdits;
      writeSettings({ ...readSettings(), agentEdits });
      events.emit("activity", null);
      return json(res, 200, await agentsView(req));
    }
    if (route === "docs" && m === "GET" && !a) return json(res, 200, { docs: Object.entries(DOCS).map(([id, d]) => ({ id, title: d.title, path: d.path })) });
    if (route === "docs" && m === "GET" && a) {
      const d = Object.hasOwn(DOCS, a) ? DOCS[a] : undefined;
      if (!d) throw new Fail(404, `no guide ${a}`);
      return json(res, 200, { id: a, title: d.title, path: d.path, markdown: readFileSync(d.file, "utf8") });
    }
    // what the assistant remembers (memory.ts): read, kept and deleted from Settings
    if (route === "memory" && m === "GET") return json(res, 200, { notes: readMemory() });
    if (route === "memory" && m === "POST") {
      if (!o.write) throw new Fail(403, "read-only: start backstage with --write");
      const v = await body(req) as { text?: unknown };
      try { return json(res, 200, { note: remember(String(v?.text ?? "")), notes: readMemory() }); } catch (e) { throw new Fail(400, (e as Error).message); }
    }
    if (route === "memory" && m === "DELETE" && a) {
      if (!o.write) throw new Fail(403, "read-only: start backstage with --write");
      if (!forgetNote(a)) throw new Fail(404, `no note ${a}`);
      return json(res, 200, { notes: readMemory() });
    }
    if (route === "usage" && m === "GET") return json(res, 200, usageSummary(readSettings().caps));
    if (route === "thumbs" && m === "GET") return json(res, 200, { stale: await staleThumbs(), command: "node packages/sahne-gallery/thumbs.mjs (in the Sahne repo, with SAHNE_CONTENT set)" });
    throw new Fail(404, `no route ${m} /api/${path.join("/")}`);
  }

  function editsOf(v: unknown): Edit[] {
    const list = (v as { edits?: unknown })?.edits;
    if (!Array.isArray(list)) throw new Fail(400, "expected { edits: [...] }");
    return list.map(e => {
      const x = e as Edit;
      if (!x || !isKind(x.kind) || typeof x.id !== "string") throw new Fail(400, "an edit is { kind, id, doc, mtime?, create? }");
      return { kind: x.kind, id: x.id, doc: x.doc, mtime: typeof x.mtime === "number" ? x.mtime : undefined, create: x.create === true };
    });
  }

  const files: Record<string, [URL, string]> = {
    "/": [new URL("index.html", HERE), "text/html; charset=utf-8"],
    "/favicon.svg": [new URL("favicon.svg", HERE), "image/svg+xml"],
    "/brand/lockup.svg": [new URL("../../assets/brand/sahne-backstage-header.svg", HERE), "image/svg+xml"],
    "/brand/lockup-dark.svg": [new URL("../../assets/brand/sahne-backstage-header-dark.svg", HERE), "image/svg+xml"],
    "/brand/lockup-stacked.svg": [new URL("../../assets/brand/sahne-backstage-header-stacked.svg", HERE), "image/svg+xml"],
    "/brand/lockup-stacked-dark.svg": [new URL("../../assets/brand/sahne-backstage-header-stacked-dark.svg", HERE), "image/svg+xml"],
    "/fonts/comic-neue-400.woff2": [new URL("comic-neue-latin-400-normal.woff2", FONTS), "font/woff2"],
    "/fonts/comic-neue-700.woff2": [new URL("comic-neue-latin-700-normal.woff2", FONTS), "font/woff2"],
  };

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? "", origin = req.headers.origin;
      if (!LOCAL.test(host)) throw new Fail(403, "backstage answers localhost only");
      if (origin && !(/^http:\/\//.test(origin) && LOCAL.test(origin.slice(7)))) throw new Fail(403, "not from this machine");
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/mcp") return await mcp(req, res);
      if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname.slice(5).split("/").map(decodeURIComponent));
      const f = files[url.pathname];
      if (f) { res.writeHead(200, { "content-type": f[1], "cache-control": "no-store" }).end(readFileSync(f[0])); return; }
      const s = /^\/sounds\/([a-z0-9_]+\.m4a)$/.exec(url.pathname);
      if (s) {
        const u = new URL(s[1], SOUNDS);
        if (!existsSync(u)) throw new Fail(404, "no such sound");
        res.writeHead(200, { "content-type": "audio/mp4" }).end(readFileSync(u));
        return;
      }
      if (!url.pathname.startsWith("/dist/app/")) throw new Fail(404, "not found");
      const up = http.request({ host: "127.0.0.1", port: inner, path: url.pathname, method: "GET" }, r => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
      up.on("error", e => res.writeHead(502).end(e.message));
      up.end();
    } catch (e) {
      const st = (e as { status?: unknown }).status;
      const f = e instanceof Fail ? e : new Fail(typeof st === "number" ? st : 500, (e as Error).message);
      if (f.status === 500) console.error(e);
      if (!res.headersSent) json(res, f.status, { message: f.message, ...(f.body ?? {}) });
    }
  });
  await new Promise<void>(r => server.listen(o.port, o.host ?? "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://localhost:${port}/`, port,
    close: async () => {
      await Promise.all([...sessions.values()].map(s => s.transport.close().catch(() => {})));
      const closed = new Promise<void>(r => server.close(() => r()));
      server.closeAllConnections(); // the event streams and MCP streams stay open otherwise
      await closed;
      await ctx.dispose();
    },
  };
}
