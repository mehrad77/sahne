// The place checker: every place document (PLACES in paths.ts) against the standard, as a table
// of places × rules, and the problems below it.
//
//   node packages/sahne-story/places.ts                 the table and the problems
//   node packages/sahne-story/places.ts bakkal ist      only these places
//   node packages/sahne-story/places.ts --check         exits 1 on any error (warnings pass)
//   node packages/sahne-story/places.ts --file <path>   also a document elsewhere (a draft)

import { readdirSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import kit from "../sahne-kit/src/full.ts";
import { loadCards, loadNeeds } from "./load.ts";
import { PLACES as DIR } from "./paths.ts";
import { lintPlace, PLACE_RULES, type Needs, type StoryPlace } from "./src/index.ts";

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean", default: false }, file: { type: "string", multiple: true } } });
const needs: Needs | undefined = loadNeeds();
const files = [...readdirSync(DIR).filter(f => f.endsWith(".json") && f !== "needs.json").map(f => new URL(f, DIR)), ...(o.file ?? [])];
const docs: StoryPlace[] = files.map(f => JSON.parse(readFileSync(f, "utf8"))).filter(d => !positionals.length || positionals.includes(d.id));
const cards = loadCards();

const width = Math.max(8, ...docs.map(d => d.id.length));
console.log(["place".padEnd(width), ...PLACE_RULES.map(r => r.padEnd(8))].join(" "));
let errors = 0;
const details: string[] = [];
for (const doc of docs) {
  const ps = lintPlace(doc, { kit, cards, needs });
  errors += ps.filter(p => p.level === "error").length;
  console.log([doc.id.padEnd(width), ...PLACE_RULES.map(r => {
    const mine = ps.filter(p => p.rule === r);
    return (mine.some(p => p.level === "error") ? `✗ ${mine.length}` : mine.length ? `! ${mine.length}` : "✓").padEnd(8);
  })].join(" ") + (doc.placeholder ? "  (placeholder)" : ""));
  for (const p of ps) details.push(`${doc.id}  ${p.level === "error" ? "error" : "warn "}  ${p.rule.padEnd(8)} ${p.message}`);
}
const planned = Object.values(needs ?? {}).flatMap(s => Object.keys(s.places));
console.log(needs ? `\n${docs.length} of ${planned.length} places built; ${errors} error(s)` : `\n${docs.length} places; ${errors} error(s)`);
if (details.length) console.log("\n" + details.join("\n"));
if (o.check && errors) process.exit(1);
