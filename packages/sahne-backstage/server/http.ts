// Backstage's HTTP server (Node only): the JSON API over the content root (content.ts), the page and its bundle (esbuild,
// built into dist/app, git-ignored, and rebuilt when a source changes), the bubbles' font and the kit's sounds. It answers only this machine: a request whose Host or Origin
// is not localhost is refused, so a web page open in the same browser cannot reach it, and a write must be JSON.

import * as esbuild from "esbuild";
import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTENT, IS_SAMPLES } from "../../sahne-story/paths.ts";
import { allProblems, check, exists, forget, isKind, lessons, listing, readDoc, save, searchCards, type Edit } from "./content.ts";
import { headOf } from "./git.ts";
import { readReview, writeReview } from "./review.ts";
import { ai, aiReady } from "./ai.ts";

const HERE = new URL("../", import.meta.url);
const SOUNDS = new URL("../../sahne-kit/sounds/", import.meta.url);
const FONTS = new URL("node_modules/@fontsource/comic-neue/files/", HERE);

export interface Options { port: number; write: boolean; host?: string; log?: boolean }
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

  async function api(req: http.IncomingMessage, res: http.ServerResponse, path: string[]) {
    const [route, a, b] = path;
    const m = req.method ?? "GET";
    if (route === "world" && m === "GET") return json(res, 200, { ...listing(), samples: IS_SAMPLES, writable: o.write, ai: aiReady() });
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
    if (route === "problems" && m === "GET") return json(res, 200, { problems: allProblems() });
    if (route === "review" && m === "GET") return json(res, 200, readReview());
    if (route === "review" && m === "POST") {
      if (!o.write) throw new Fail(403, "read-only: start backstage with --write");
      return json(res, 200, writeReview(await body(req)));
    }
    if (route === "ai" && m === "POST" && a) return json(res, 200, await ai(a, await body(req)));
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
    "/fonts/comic-neue-400.woff2": [new URL("comic-neue-latin-400-normal.woff2", FONTS), "font/woff2"],
    "/fonts/comic-neue-700.woff2": [new URL("comic-neue-latin-700-normal.woff2", FONTS), "font/woff2"],
  };

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? "", origin = req.headers.origin;
      if (!LOCAL.test(host)) throw new Fail(403, "backstage answers localhost only");
      if (origin && !(/^http:\/\//.test(origin) && LOCAL.test(origin.slice(7)))) throw new Fail(403, "not from this machine");
      const url = new URL(req.url ?? "/", "http://localhost");
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
    close: async () => { await new Promise<void>(r => server.close(() => r())); await ctx.dispose(); },
  };
}
