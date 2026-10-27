// Determinism of the bundles (DESIGN.md §14): every package is bundled twice, each time in a process of its own and
// with the entries in a different order, and the two outputs must be byte-identical. An app's content-hashed chunks and
// its service worker's cache depend on it: a bundle that differs between two builds of the same source would
// invalidate every learner's offline copy on each deploy. Part of `pnpm sahne check`.
//
//   node determinism.mjs

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const ENTRIES = [
  "sahne/src/index.ts", "sahne/src/listen/index.ts", "sahne-tr/src/index.ts", "sahne-kit/src/index.ts",
  "sahne-kit/src/kerim/index.ts", "sahne-kit/src/set/all.ts", "sahne-story/src/index.ts",
];

if (process.argv[2] === "--hash") {
  // one build: each entry bundled alone, minified and not, with its source map; prints "<entry> <sha256>" per line
  const order = process.argv[3] === "reverse" ? [...ENTRIES].reverse() : ENTRIES;
  for (const e of order) for (const minify of [false, true]) {
    const r = await build({
      entryPoints: [ROOT + e], bundle: true, minify, format: "esm", write: false, logLevel: "error", sourcemap: "external",
      outdir: "out", external: e.startsWith("sahne-kit") || e.startsWith("sahne-story") ? ["sahne", "sahne-tr"] : [],
    });
    const h = createHash("sha256");
    for (const f of r.outputFiles.sort((a, b) => a.path < b.path ? -1 : 1)) h.update(f.contents);
    console.log(`${e}${minify ? " (minified)" : ""} ${h.digest("hex")}`);
  }
} else {
  const run = order => new Map(execFileSync("node", [new URL(import.meta.url).pathname, "--hash", order], { encoding: "utf8", maxBuffer: 1 << 24 })
    .trim().split("\n").map(l => { const i = l.lastIndexOf(" "); return [l.slice(0, i), l.slice(i + 1)]; }));
  const a = run("forward"), b = run("reverse");
  let bad = 0;
  for (const [k, v] of a) if (b.get(k) !== v) { bad++; console.log(`DIFF ${k}: two builds of the same source are not byte-identical`); }
  if (bad) process.exit(1);
  console.log(`ok   ${a.size} bundles identical across two builds`);
}
