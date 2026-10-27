// The Sahne gallery's dev server. One page, index.html, is the gallery: esbuild bundles src/app.ts with
// a lazy chunk per section into dist/app/. The data it shows (data.mjs) is read from disk on each request
// and served as /data/<name>.json (places, needs, cards, plans, sizes, drafts …), so adding a place or a
// draft needs only a reload. Everything else is served from this folder. build.mjs makes the static site.
import * as esbuild from "esbuild";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { BUNDLE, DATA, copyStatic } from "./data.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 5180);

// ---- The bundles ---------------------------------------------------------------------------------

copyStatic(dir + "dist/");
const app = await esbuild.context({ ...BUNDLE, sourcemap: true, outdir: dir + "dist/app", logLevel: "info" });
await app.watch();

// esbuild serves the folder on a port of its own; this server answers /data/* and passes the rest on.
const { port: inner } = await app.serve({ servedir: dir, port: 0 });
http.createServer(async (req, res) => {
  const m = req.url.match(/^\/data\/([a-z]+)\.json(?:\?|$)/);
  if (m) {
    const make = DATA[m[1]];
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
  const up = http.request({ host: "127.0.0.1", port: inner, path: req.url, method: req.method, headers: req.headers }, r => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", e => res.writeHead(502).end(e.message));
  req.pipe(up);
}).listen(port, () => console.log(`sahne gallery on http://localhost:${port}`));
