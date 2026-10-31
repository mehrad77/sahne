// The JSON schemas (schema/*.json): every document of the content root is valid, and a seeded break of each
// kind of rule is refused with a readable path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { validateDoc } from "../check/schema.ts";
import { CHARACTERS, PLACES, storyFile, storyIds } from "../paths.ts";

const json = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
/** The first story of the content root (s1e00, the sample, or Kumru's s1e01). */
const S1 = () => json(storyFile(storyIds()[0]));
const C = (id: string) => json(new URL(`${id}.json`, CHARACTERS));

test("every story and character is valid", () => {
  for (const id of storyIds()) assert.deepEqual(validateDoc("story", json(storyFile(id))), [], id);
  for (const f of readdirSync(CHARACTERS).filter(f => f.endsWith(".json"))) assert.deepEqual(validateDoc("character", json(new URL(f, CHARACTERS))), [], f);
});

test("every place document is valid", () => {
  for (const f of readdirSync(PLACES).filter(f => f.endsWith(".json") && f !== "needs.json")) {
    assert.deepEqual(validateDoc("place", json(new URL(f, PLACES))), [], f);
  }
});

test("a story with a break is refused, naming the path", () => {
  const miss = S1(); delete miss.quiz;
  assert.match(validateDoc("story", miss)[0].message, /quiz/);
  const kind = S1(); kind.kind = "movie";
  assert.ok(validateDoc("story", kind).some(p => p.path === "/kind"));
  const id = S1(); id.id = "x1";
  assert.ok(validateDoc("story", id).some(p => p.path === "/id"));
  const quiz = S1(); quiz.quiz[0].a = 3;
  assert.ok(validateDoc("story", quiz).some(p => p.path === "/quiz/0/a"));
  const step = S1(); step.steps.push({ nonsense: 1 });
  assert.ok(validateDoc("story", step).length > 0);
  const extra = S1(); extra.mood = "x";
  assert.match(validateDoc("story", extra)[0].message, /mood/);
});

test("a character with a break is refused", () => {
  const color = C("ismail"); color.color = "teal";
  assert.ok(validateDoc("character", color).some(p => p.path === "/color"));
  const outfit = C("ismail"); outfit.outfits = { default: {} };
  assert.ok(validateDoc("character", outfit).length > 0);
  const none = C("ismail"); delete none.avatar;
  assert.ok(validateDoc("character", none).length > 0);
  const tempo = C("ismail"); tempo.motion.tempo = 2;
  assert.ok(validateDoc("character", tempo).some(p => p.path === "/motion/tempo"));
});

test("a place with a break is refused", () => {
  const p = json(new URL("bakkal.json", PLACES));
  p.name = { fa: 7 };
  assert.ok(validateDoc("place", p).some(x => x.path === "/name/fa"), "a name is text by language (which languages: lintPlace)");
  const q = json(new URL("bakkal.json", PLACES)); q.size = { w: 0, d: 4 };
  assert.ok(validateDoc("place", q).some(x => x.path === "/size/w"));
});
