// The gallery as a static site, in dist/site/ (deployed to https://sahne.shab.boo by .github/workflows/pages.yml):
// the page and its head, the bundle minified, every /data/<name>.json written once (data.mjs), the sounds,
// the font, the favicon and the social card (the repo's assets/social-preview.jpg as og.jpg). Every URL in
// the page is relative to it, so the site also works under a sub-path. It builds from the samples only: with
// SAHNE_CONTENT or SAHNE_STORY_DOCS set it refuses, so a public site never carries other content.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.env.SAHNE_CONTENT || process.env.SAHNE_STORY_DOCS) {
  console.error("build.mjs: unset SAHNE_CONTENT and SAHNE_STORY_DOCS; the static site is built from the samples only");
  process.exit(1);
}
const { BUNDLE, DATA, copyStatic } = await import("./data.mjs");

const dir = fileURLToPath(new URL(".", import.meta.url));
const out = dir + "dist/site/";
rmSync(out, { recursive: true, force: true });
mkdirSync(out + "data", { recursive: true });

await esbuild.build({ ...BUNDLE, minify: true, outdir: out + "dist/app", logLevel: "warning" });
copyStatic(out + "dist/");
for (const [name, make] of Object.entries(DATA)) writeFileSync(`${out}data/${name}.json`, JSON.stringify(await make()));
for (const f of ["index.html", "favicon.svg"]) cpSync(dir + f, out + f);
cpSync(dir + "../../assets/social-preview.jpg", out + "og.jpg");
writeFileSync(out + ".nojekyll", "");
console.log(`built ${out}`);
