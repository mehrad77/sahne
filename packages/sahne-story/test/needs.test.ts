// needs.json of the content root (paths.ts, optional): what the stories' briefs ask of each place. Its places
// are `<site>` or `<site>_<sub>`, every term is a live card, times are the stage's, and a prop id means one kit
// thing in its place, and every story of the content root is covered. Skipped when the content root has no
// needs.json (the samples have none); with STORIES_WORLD.md ($SAHNE_STORY_DOCS), also every A1 site of its §2
// has needs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadCards, loadNeeds } from "../load.ts";
import { STORIES_WORLD, storyIds } from "../paths.ts";
import { cardProblem, needsOf, type Needs, type NeedProp } from "../src/index.ts";
import kit from "../../sahne-kit/src/full.ts";
import { plan } from "../../sahne-kit/set/build.ts";

const needs: Needs = loadNeeds() ?? {};
const cards = loadCards();
const skip = Object.keys(needs).length ? false : "the content root has no needs.json";
const world = STORIES_WORLD && existsSync(STORIES_WORLD) ? readFileSync(STORIES_WORLD, "utf8") : "";
// the A1 sites: §2's first table (the rows before "Not used in A1" and the placeholders)
const A1 = [...world.slice(0, world.indexOf("**Not used in A1")).matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map(m => m[1]);
const places = Object.entries(needs).flatMap(([site, s]) => Object.entries(s.places).map(([id, p]) => ({ site, id, p })));

test("every A1 site of STORIES_WORLD §2 has needs, and nothing else does", { skip: skip || (world ? false : "SAHNE_STORY_DOCS is not set (no STORIES_WORLD.md)") }, () => {
  assert.deepEqual(Object.keys(needs).sort(), [...A1].sort());
});

test("a place is its site or <site>_<sub>, and ids are unique", { skip }, () => {
  for (const { site, id } of places) assert.ok(id === site || id.startsWith(site + "_"), id);
  assert.equal(new Set(places.map(x => x.id)).size, places.length);
  for (const { site, id } of places) assert.equal(needsOf(needs, id)?.site, site, id);
});

test("every story is covered, and a place's stories are its site's", { skip }, () => {
  const all = new Set(places.flatMap(({ p }) => p.stories));
  for (const id of storyIds()) assert.ok(all.has(id), id);
  for (const { site, id, p } of places) for (const s of p.stories) assert.ok(needs[site].stories.includes(s), `${id}: ${s}`);
});

test("every term is a live card (any level), and times are the stage's", { skip: skip || (cards ? false : "the content root has no cards") }, () => {
  const bad: string[] = [];
  for (const { id, p } of places) {
    for (const list of [p.props, p.storyProps]) for (const [pid, q] of Object.entries(list ?? {}) as [string, NeedProp][])
      for (const t of q.terms) { const why = cardProblem(cards!, t); if (why) bad.push(`${id}.${pid}: ${why}`); }
    for (const t of p.times ?? []) assert.ok(["day", "golden", "dusk", "night", "dawn", "overcast"].includes(t), `${id}: ${t}`);
  }
  assert.deepEqual(bad, []);
});

test("states: at most one default per group", { skip }, () => {
  for (const { id, p } of places) {
    const defaults = Object.values(p.states ?? {}).filter(s => s.default).map(s => s.group ?? "");
    assert.equal(new Set(defaults).size, defaults.length, id);
  }
});

test("every prop names a kit generator, drawn or planned (sahne-kit/set/plan.json), and a variant it has or will have", { skip }, () => {
  const planned = plan(), bad: string[] = [];
  for (const { id, p } of places) for (const list of [p.props, p.storyProps]) for (const [pid, q] of Object.entries(list ?? {}) as [string, NeedProp][]) {
    const def = kit.props[q.kit] ?? kit.set[q.kit], todo = planned[q.kit];
    if (!def && !todo) { bad.push(`${id}.${pid}: no generator ${q.kit}`); continue; }
    if (q.variant && !Object.hasOwn(def?.variants ?? {}, q.variant) && !todo?.variants.includes(q.variant)) bad.push(`${id}.${pid}: ${q.kit} has no variant ${q.variant}`);
  }
  assert.deepEqual(bad, []);
});

test("every sound a place asks for is a kit sound", { skip }, () => {
  const missing = places.flatMap(({ id, p }) => (p.sounds ?? []).filter(x => !kit.sounds?.[x]).map(x => `${id}: ${x}`));
  assert.deepEqual(missing, []);
});
