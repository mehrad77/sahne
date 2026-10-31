// The Sahne gallery's dev server. One page, index.html, is the gallery: esbuild bundles src/app.ts with
// a lazy chunk per section into dist/app/. The data it shows (data.mjs) is read from disk on each request
// and served as /data/<name>.json (places, needs, cards, plans, sizes, drafts …), so adding a place or a
// draft needs only a reload. Everything else is served from this folder. build.mjs makes the static site.
import * as esbuild from "esbuild";
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUNDLE, DATA, copyStatic, doc } from "./data.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 5180);

// ---- The bundles ---------------------------------------------------------------------------------

copyStatic(dir + "dist/");
const app = await esbuild.context({ ...BUNDLE, sourcemap: true, outdir: dir + "dist/app", logLevel: "info" });
await app.watch();

// esbuild serves the folder on a port of its own; this server answers /data/* and passes the rest on.
const { port: inner } = await app.serve({ servedir: dir, port: 0 });
http.createServer(async (req, res) => {
  const m = req.url.match(/^\/data\/([a-z]+|docs\/[a-z]+)\.json(?:\?|$)/);
  if (m) {
    const make = m[1].startsWith("docs/") ? () => doc(m[1].slice(5)) ?? Promise.reject(new Error("no such doc")) : DATA[m[1]];
    if (!make) { res.writeHead(404).end(); return; }
    try {
      const body = JSON.stringify(await make());
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(body);
    } catch (e) {
      console.warn(`/data/${m[1]}: ${e.message}`);
      res.writeHead(500, { "content-type": "text/plain" }).end(String(e.message));
    }
    return;
  }
  // the repo's assets/ (the README's pictures, shown in #/docs/overview), as the static site has them
  const a = req.url.match(/^\/assets\/([a-z0-9/_.-]+\.(jpg|png|svg))$/);
  if (a && !a[1].includes("..")) {
    const file = new URL(`../../assets/${a[1]}`, import.meta.url);
    if (existsSync(file)) { res.writeHead(200, { "content-type": a[2] === "svg" ? "image/svg+xml" : `image/${a[2] === "jpg" ? "jpeg" : a[2]}` }).end(readFileSync(file)); return; }
  }
  const up = http.request({ host: "127.0.0.1", port: inner, path: req.url, method: req.method, headers: req.headers }, r => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", e => res.writeHead(502).end(e.message));
  req.pipe(up);
}).listen(port, () => console.log(`sahne gallery on http://localhost:${port}`));
