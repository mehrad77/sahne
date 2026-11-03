// The languages of a series (src/texts.ts): the old shape upgraded (src/upgrade.ts) by its fixed table, in place and
// only once; the converter (convert/languages.ts) on a copy of the samples, keeping each number's spelling, the key
// order and the final newline, and its --check; and the check asking each text in the series' languages
// (check/languages.ts), with a language code that is a step's own key refused.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSeries, checkStory } from "../check/rules.ts";
import { loadWorld, type World } from "../check/world.ts";
import kit from "../../sahne-kit/src/full.ts";
import { dirOf, isOldShape, languagesOf, lintPlace, textIn, textOf, upgrade, type StoryDoc } from "../src/index.ts";

const world = loadWorld();
const fresh = (): World => structuredClone(world);

test("a story's old fields become maps in their places, by the fixed table", () => {
  const old = { id: "s1e99", title: "Merhaba", titleEn: "Hello", titleFa: "سلام", summary: "Nima says hello.", summaryFa: "نیما سلام می‌کند.", place: "bakkal",
    gl: { "elma": ["سیب", "apple"] }, quiz: [{ q: "Kim?", en: "Who?", fa: "کی؟", options: ["a", "b", "c"], a: 0, why: "“x”", kind: "comp" }], steps: [] };
  const d = upgrade("story", old) as Record<string, unknown>;
  assert.deepEqual(Object.keys(d), ["id", "title", "summary", "place", "gl", "quiz", "steps"], "each map where its field was");
  assert.deepEqual(d.title, { tr: "Merhaba", en: "Hello", fa: "سلام" });
  assert.deepEqual(d.summary, { en: "Nima says hello.", fa: "نیما سلام می‌کند." }, "the summary was English");
  assert.deepEqual(d.gl, { elma: { fa: "سیب", en: "apple" } });
  assert.deepEqual((d.quiz as Record<string, unknown>[])[0], { q: { tr: "Kim?", en: "Who?", fa: "کی؟" }, options: ["a", "b", "c"], a: 0, why: "“x”", kind: "comp" });
  assert.equal(upgrade("story", d), d, "a document in the new shape comes back as it is");
  assert.ok(isOldShape("story", old) && !isOldShape("story", d));
});

test("a character's name is the main language's, its role and bio English's", () => {
  const d = upgrade("character", { id: "x", name: "İsmail", nameFa: "اسماعیل", kind: "cast", role: "The grocer", roleFa: "بقال", bio: "Gossips.", bioFa: "غیبت می‌کند." });
  assert.deepEqual(d, { id: "x", name: { tr: "İsmail", fa: "اسماعیل" }, kind: "cast", role: { en: "The grocer", fa: "بقال" }, bio: { en: "Gossips.", fa: "غیبت می‌کند." } });
  assert.deepEqual(upgrade("series", { v: 1, id: "s", title: "T", titleEn: "T", titleFa: "ت", narrator: "kerim", standin: "nima" }), { v: 1, id: "s", title: { tr: "T", en: "T", fa: "ت" }, narrator: "kerim", standin: "nima" });
});

test("texts: by language, a plain string as the main one's, the direction of each", () => {
  assert.equal(textIn({ tr: "a", fa: "b" }, "fa"), "b");
  assert.equal(textIn("a", "fa", "tr"), undefined);
  assert.equal(textIn("a", "tr", "tr"), "a");
  assert.equal(textOf({ en: "x" }, "fa", "en"), "x");
  assert.equal(dirOf("fa"), "rtl");
  assert.equal(dirOf("pt-BR"), "ltr");
  assert.deepEqual(languagesOf(null), { main: "tr", translations: ["en", "fa"] });
});

test("the converter rewrites a root once, keeping numbers, key order and the newline", () => {
  const root = mkdtempSync(join(tmpdir(), "sahne-lang-"));
  try {
    cpSync(fileURLToPath(new URL("../samples/", import.meta.url)), root, { recursive: true });
    const story = join(root, "stories", "s1e00.json"), nima = join(root, "characters", "nima.json");
    const s = JSON.parse(readFileSync(story, "utf8")) as StoryDoc & Record<string, unknown>;
    const old: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === "title") Object.assign(old, { title: s.title.tr, titleEn: s.title.en, titleFa: s.title.fa });
      else if (k === "summary") Object.assign(old, { summary: s.summary!.en, summaryFa: s.summary!.fa });
      else old[k] = v;
    }
    writeFileSync(story, JSON.stringify(old, null, 2)); // no final newline
    const n = JSON.parse(readFileSync(nima, "utf8"));
    const oldNima = { ...n, name: n.name.tr, nameFa: n.name.fa, role: n.role.en, roleFa: n.role.fa, bio: n.bio.en, bioFa: n.bio.fa };
    writeFileSync(nima, JSON.stringify(oldNima, null, 2).replace(/"height": ([0-9.]+)/, "\"height\": $1000") + "\n");
    const run = (...a: string[]) => spawnSync(process.execPath, [fileURLToPath(new URL("../convert/languages.ts", import.meta.url)), ...a], { env: { ...process.env, SAHNE_CONTENT: root }, encoding: "utf8" });
    assert.equal(run("--check").status, 1, "the old shape fails --check");
    assert.match(run().stdout, /converted 2 of/);
    const text = readFileSync(story, "utf8");
    assert.ok(!text.endsWith("\n"), "no newline stays none");
    assert.deepEqual(JSON.parse(text), s, "the story is the new shape again, key for key");
    assert.deepEqual(Object.keys(JSON.parse(text)), Object.keys(s), "in the file's key order");
    assert.match(readFileSync(nima, "utf8"), /"height": [0-9.]+000/, "a number keeps its spelling");
    assert.equal(run("--check").status, 0);
    assert.match(run().stdout, /all in the new shape already/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("each text in the series' languages: a missing translation is an error", () => {
  const w = fresh(), d = w.drafts[0], line = d.story.steps.findIndex(s => "who" in s);
  delete (d.story.steps[line] as unknown as Record<string, unknown>).fa;
  delete (d.story.title as Record<string, string>).en;
  const ms = checkStory(d, w).filter(p => p.rule === "schema").map(p => p.message);
  assert.ok(ms.includes(`/steps/${line}: the line has no fa text`), ms.join("\n"));
  assert.ok(ms.includes("/title: the title has no en text"), ms.join("\n"));
});

test("a language code may not be a step's own key, nor main and translation both", () => {
  const w = fresh();
  w.series!.languages = { main: "tr", translations: ["to", "tr"] };
  const ms = checkSeries(w).filter(p => p.level === "error").map(p => p.message);
  assert.ok(ms.some(m => /to is a step's own key/.test(m)), ms.join("\n"));
  assert.ok(ms.some(m => /tr is the main language and a translation/.test(m)), ms.join("\n"));
});

test("files still in the old shape: one warning, naming them", () => {
  const w = fresh(); w.oldShape = ["a.json", "b.json"];
  const ps = checkSeries(w).filter(p => /old language shape/.test(p.message));
  assert.equal(ps.length, 1);
  assert.equal(ps[0].level, "warning");
});

test("a place is named in each of the series' languages", () => {
  const bakkal = world.places.bakkal;
  assert.ok(!lintPlace(bakkal, { kit }).some(p => /no name/.test(p.message)));
  assert.ok(lintPlace(bakkal, { kit, languages: { main: "tr", translations: ["en", "de"] } }).some(p => p.message === "no name in de"));
});

test("the story language: Turkish and German by plugin, another by plain words", async () => {
  const { langFor, lintStory, suggest, trLang } = await import("../src/index.ts");
  assert.equal(langFor("tr"), trLang);
  const nl = langFor("nl");
  assert.equal(nl.id, "nl");
  assert.deepEqual(nl.words("Goedemorgen, Nima!").map(w => w.w), ["goedemorgen", ",", "nima", "."]);
  assert.ok(nl.resolver(["Brood"])("brood") && !nl.resolver(["Brood"])("broden"), "exact words only");
  // the samples' story, read as Turkish by default and by name, gives the same lints and suggestions
  const d = world.drafts[0], o = { places: world.places, characters: d.characters, kit };
  assert.deepEqual(lintStory(d.story, { ...o, lang: trLang }), lintStory(d.story, o));
  assert.deepEqual(suggest(d.story, { ...o, lang: trLang }), suggest(d.story, o));
  // a series in a language with no plugin has no Turkish lints: its line keys are nl
  const story = structuredClone(d.story) as StoryDoc & { steps: Record<string, unknown>[] };
  for (const s of story.steps) if ("who" in s) { s.nl = s.tr; delete s.tr; }
  assert.ok(!lintStory(story, { ...o, lang: nl }).some(p => ["deixis", "var_yok", "number", "time"].includes(p.rule)));
});
