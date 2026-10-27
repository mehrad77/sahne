// The story checker: every story and the characters (where they live is paths.ts) against the story docs, as a table of
// stories × rules, and the problems below it.
//
//   node packages/sahne-story/stories.ts                 the table, the problems and the season report
//   node packages/sahne-story/stories.ts s1e01           only these stories
//   node packages/sahne-story/stories.ts --check         exits 1 on any error (warnings and info pass)
//   node packages/sahne-story/stories.ts --quiet         errors and warnings only, no info

import { parseArgs } from "node:util";
import { placeSolids } from "sahne";
import kit from "../sahne-kit/src/full.ts";
import { loadCards, loadNeeds } from "./load.ts";
import { checkCast, checkPlaces, checkSeason, checkStory, type CheckProblem } from "./check/rules.ts";
import { loadWorld } from "./check/world.ts";

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean", default: false }, quiet: { type: "boolean", default: false } } });
const world = loadWorld();
const needs = loadNeeds();
const solids = Object.fromEntries(world.drafts.map(d => [d.story.id, Object.fromEntries(Object.entries(world.places).map(([id, p]) => [id, placeSolids(p, kit)]))]));
const opts = { kit, cards: loadCards(), needs, solids };
const drafts = world.drafts.filter(d => !positionals.length || positionals.includes(d.id));

const RULES = ["schema", "id", "calendar", "ref", "cast", "counts", "flags", "quiz", "mistake", "text", "words", "recycle", "character", "place"];
const problems: CheckProblem[] = [...checkPlaces(world), ...checkCast(world, opts), ...drafts.flatMap(d => checkStory(d, world, opts)), ...checkSeason(world, world.drafts, opts).filter(p => !positionals.length || positionals.includes(p.story) || p.story === "season")];
const cell = (story: string, rule: string) => {
  const ps = problems.filter(p => p.story === story && (p.rule === rule || (rule === "place" && !RULES.includes(p.rule))));
  return ps.some(p => p.level === "error") ? "ERR" : ps.some(p => p.level === "warning") ? "warn" : ".";
};
console.log(["story".padEnd(8), ...RULES.map(r => r.slice(0, 6).padEnd(6))].join(" "));
for (const d of drafts) console.log([d.id.padEnd(8), ...RULES.map(r => cell(d.story.id, r).padEnd(6))].join(" "));
for (const level of ["error", "warning", "info"] as const) {
  if (level === "info" && o.quiet) continue;
  const ps = problems.filter(p => p.level === level);
  if (ps.length) console.log(`\n${level}s`);
  for (const p of ps) console.log(`  ${p.story}${p.step !== undefined ? ` step ${p.step}` : ""} [${p.rule}] ${p.message}`);
}
const errors = problems.filter(p => p.level === "error").length;
console.log(`\n${drafts.length} stories, ${errors} errors, ${problems.filter(p => p.level === "warning").length} warnings`);
if (o.check && errors) process.exit(1);
