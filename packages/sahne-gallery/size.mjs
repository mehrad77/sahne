// The code budgets of DESIGN.md §12, measured the way an app ships them: each package bundled and
// minified on its own (the others left out), then gzipped. `pnpm check` runs it; it fails over budget.
//
//   node size.mjs          the sizes and the budgets
//   node size.mjs --json   the same as JSON (for an app's build to read)

import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { PLACES } from "../sahne-story/paths.ts";

const ROOT = new URL("../", import.meta.url).pathname;
// `warn`: over budget is reported, not failed.
// The last two are what an app loads for its lists and for its builder: an app that imports only
// these names gets only their code.
const E = (names) => ({ code: `export { ${names} } from ${JSON.stringify(ROOT + "sahne/src/index.ts")};` });
const BUNDLES = [
  { name: "engine and Turkish plugin", entries: ["sahne/src/index.ts", "sahne-tr/src/index.ts"], budget: 150 },
  { name: "the German plugin (sahne-de)", entries: ["sahne-de/src/index.ts"], budget: 25 },
  { name: "kit code", entries: ["sahne-kit/src/index.ts"], budget: 150 },
  { name: "Kerim's puppet (sahne-kit/kerim)", entries: ["sahne-kit/src/kerim/index.ts"], budget: 8 },
  { name: "the animal puppets (sahne-kit/puppets: Pisi, the gulls)", entries: ["sahne-kit/src/puppets/index.ts"], budget: 8 },
  { name: "portraits (normalize, portrait, silhouette)", ...E("normalize, serialize, isAvatarDoc, isLegacyChar, portrait, silhouette"), budget: 20 },
  { name: "the builder with its stage", ...E("normalize, serialize, portrait, mountBuilder"), budget: 100 },
  // measured, no budget yet: the optional listening module, and Kumru's story adapter with its lints
  { name: "say it aloud (sahne/listen)", entries: ["sahne/src/listen/index.ts"] },
  { name: "story adapter and lints (sahne-story)", entries: ["sahne-story/src/index.ts"], external: ["sahne", "sahne-tr"] },
];
// the set kit (sahne-kit/set): each family is a chunk an app loads when its places need it, measured
// without the engine and without the kit code it shares (palette, carry); the whole set is told, not held
const SET_DIR = new URL("../sahne-kit/src/set/", import.meta.url);
const NOT_FAMILIES = new Set(["all.ts", "draw.ts", "index.ts", "families.gen.ts", "people.ts"]);
const families = readdirSync(SET_DIR).filter(f => f.endsWith(".ts") && !NOT_FAMILIES.has(f)).sort();
for (const f of families) BUNDLES.push({ name: `set family ${f.slice(0, -3)}`, entries: [`sahne-kit/src/set/${f}`], external: ["sahne"], shared: true, budget: 40 });
BUNDLES.push({ name: `the whole set (${families.length} families)`, entries: ["sahne-kit/src/set/all.ts"], external: ["sahne"], shared: true, budget: 250, warn: true });

// a set family's imports from outside src/set/ (the palette, a carried phone's face) are the kit code's, already loaded
const SET_PATH = new URL("../sahne-kit/src/set/", import.meta.url).pathname;
const SHARED = { name: "shared", setup(b) { b.onResolve({ filter: /^\.\.\// }, a => a.importer.startsWith(SET_PATH) ? { path: a.path, external: true } : undefined); } };

const out = [];
for (const b of BUNDLES) {
  const r = await build({
    stdin: { contents: b.code ?? b.entries.map(e => `export * from ${JSON.stringify(ROOT + e)};`).join("\n"), resolveDir: ROOT, loader: "ts" },
    bundle: true, minify: true, format: "esm", write: false, logLevel: "error",
    // each budget counts its own code: the kit is measured without the engine it imports
    external: b.external ?? (b.entries?.some(e => e.startsWith("sahne-kit")) ? ["sahne"] : []),
    plugins: b.shared ? [SHARED] : [],
  });
  const js = r.outputFiles[0].contents, gz = gzipSync(js, { level: 9 }).length;
  out.push({ name: b.name, minified: js.length, gzip: gz, budget: b.budget ? b.budget * 1024 : null, ok: !b.budget || gz <= b.budget * 1024, warn: !!b.warn });
}

// the place documents (PLACES in sahne-story/paths.ts): all of them together, minified, as the
// app ships them; each one's own 5 KB is checked by lintPlace
const placeJson = readdirSync(PLACES).filter(f => f.endsWith(".json") && f !== "needs.json")
  .map(f => JSON.stringify(JSON.parse(readFileSync(new URL(f, PLACES), "utf8")))).join("\n");
const placeGz = gzipSync(placeJson, { level: 9 }).length;
out.push({ name: `places (${placeJson ? placeJson.split("\n").length : 0} documents)`, minified: placeJson.length, gzip: placeGz, budget: 100 * 1024, ok: placeGz <= 100 * 1024, warn: false });

if (process.argv.includes("--json")) console.log(JSON.stringify(out));
else for (const o of out) console.log(`${o.budget === null ? "info" : o.ok ? "ok  " : o.warn ? "warn" : "OVER"} ${o.name}: ${(o.gzip / 1024).toFixed(1)} KB gzip (${o.budget === null ? "no budget" : `budget ${o.budget / 1024} KB`}), ${(o.minified / 1024).toFixed(0)} KB minified`);
process.exit(out.every(o => o.ok || o.warn) ? 0 : 1);
