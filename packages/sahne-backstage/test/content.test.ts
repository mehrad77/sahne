// The save gate (server/content.ts `check`) on a temp copy of the samples: what counts as a problem the edit brings, and
// what the files already had. An old problem stays old wherever its step moves.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-content-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
after(() => rmSync(root, { recursive: true, force: true }));

const { check, forget, readDoc, save } = await import("../server/content.ts");

const storyFile = join(root, "stories", "s1e00.json");
/** Change a file of the root as another editor would, and read the root again. */
const onDisk = (file: string, fn: (doc: any) => void) => { const d = JSON.parse(readFileSync(file, "utf8")); fn(d); writeFileSync(file, JSON.stringify(d, null, 2) + "\n"); forget(); };
const brought = (edits: Parameters<typeof check>[0]) => check(edits).filter(p => p.new && p.level === "error").map(p => p.message);

test("an old problem stays old when a step above it is inserted, deleted or moved; one more of it is new", () => {
  const was = readFileSync(storyFile, "utf8");
  try {
    onDisk(storyFile, d => { d.steps[11].narr = true; }); // ismail narrates: an error the file already has
    const story = () => structuredClone(readDoc("story", "s1e00").doc) as { steps: Record<string, unknown>[] };
    assert.ok(check([{ kind: "story", id: "s1e00", doc: story() }]).some(p => /narr is only for/.test(p.message) && !p.new));
    const inserted = story(); inserted.steps.splice(7, 0, structuredClone(inserted.steps[6]));
    assert.deepEqual(brought([{ kind: "story", id: "s1e00", doc: inserted }]), []);
    const deleted = story(); deleted.steps.splice(2, 1);
    assert.ok(!brought([{ kind: "story", id: "s1e00", doc: deleted }]).some(m => /narr is only for/.test(m)));
    const twice = story(); twice.steps.splice(12, 0, structuredClone(twice.steps[11]));
    assert.ok(brought([{ kind: "story", id: "s1e00", doc: twice }]).some(m => /narr is only for/.test(m)), "a second narrating ismail is new");
  } finally { writeFileSync(storyFile, was); forget(); }
});

test("a new document is checked against the files' own baseline: an old problem across documents does not block it", () => {
  const was = readFileSync(storyFile, "utf8");
  try {
    onDisk(storyFile, d => { d.steps[2].if = "s1e09_seen"; }); // s1e00 names a flag no story sets: the season's rule, already broken
    const next = structuredClone(readDoc("story", "s1e00").doc) as Record<string, unknown> & { steps: Record<string, unknown>[] };
    delete next.steps[2].if;
    const created = { ...next, id: "s1e01", releaseDate: "2026-09-15", title: { tr: "Bir", en: "One", fa: "یک" } };
    const problems = check([{ kind: "story", id: "s1e01", doc: created, create: true }]);
    const flag = problems.find(p => /flag s1e09_seen/.test(p.message));
    assert.ok(flag, "the old flag problem is reported");
    assert.ok(!flag.new, "and it is not the new episode's");
  } finally { writeFileSync(storyFile, was); forget(); }
});

test("a season or series edit is checked with the stories it governs", () => {
  const seasonFile = join(root, "seasons", "s1.json"), seriesFile = join(root, "series.json");
  const was = { season: readFileSync(seasonFile, "utf8"), series: readFileSync(seriesFile, "utf8") };
  try {
    onDisk(seasonFile, d => { d.calendar = { s1e00: { date: "2026-09-14", kind: "episode", week: 0 } }; });
    // the calendar row moved, the story's date not: the story breaks
    const season = readDoc("season", "s1").doc as Record<string, unknown>;
    const moved = { ...season, calendar: { s1e00: { date: "2026-09-15", kind: "episode", week: 0 } } };
    assert.ok(brought([{ kind: "season", id: "s1", doc: moved }]).some(m => /releaseDate 2026-09-14 but Days has 2026-09-15/.test(m)));
    // the lesson plugin turned off: every story's lesson fields are now wrong
    const series = readDoc("series", "series").doc as { plugins?: string[] };
    assert.ok(brought([{ kind: "series", id: "series", doc: { ...series, plugins: (series.plugins ?? []).filter(p => p !== "lesson") } }]).length > 0);
    // a translation added is the translation work, not a broken story: it saves
    const langs = (series as { languages: { main: string; translations: string[] } }).languages;
    const r = save([{ kind: "series", id: "series", doc: { ...series, languages: { ...langs, translations: [...langs.translations, "de"] } } }], { write: true });
    assert.equal(r.status, 200, r.message);
  } finally { writeFileSync(seasonFile, was.season); writeFileSync(seriesFile, was.series); forget(); }
});

test("a kit item is checked as the root's loader reads it: a variant whose params its generator refuses is an error", () => {
  const bad = check([{ kind: "kit_variant", id: "flag.x_club", doc: { of: "flag", name: "x_club", params: { kind: "bunting", w: "wide" } }, create: true }]);
  assert.ok(bad.some(p => p.new && p.level === "error" && p.doc === "kit_variant:flag.x_club"), JSON.stringify(bad));
  const good = check([{ kind: "kit_variant", id: "flag.x_club", doc: { of: "flag", name: "x_club", params: { kind: "bunting", w: 420 } }, create: true }]);
  assert.deepEqual(good.filter(p => p.new && p.level === "error"), []);
});
