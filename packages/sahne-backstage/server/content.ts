// The content root as backstage edits it (Node only; imported after SAHNE_CONTENT is set, server/index.ts). Seven kinds of
// document, each a file named by its id: the series, the seasons, the stories (the episodes), the characters, the places and
// the root's own kit items (a drawn piece `x_<id>`, a drawn variant `<of>.x_<name>`; sahne-kit's DRAWING.md). The kit items are
// added to the full kit (`kit()`), which the checks and the place lints use. Where each lives is sahne-story's paths.ts, never a path built here. A save is a set of documents checked together (a
// season's calendar and its stories' dates change in one save): the edited documents are swapped into the world the story
// check reads (check/world.ts) and checked with the gate's own options (stories.ts: the full kit, the places' solids, the
// cards, the needs). The rules across documents (the season's dates and arcs, the cast's order) run over all of them, so an
// edit that breaks another document is caught. A problem the files already had does not block a save; one the edit brings does.

import { existsSync, readdirSync } from "node:fs";
import { placeSolids, type Kit, type Solid } from "sahne";
import full from "../../sahne-kit/src/full.ts";
import { withDrawings, type DrawingDoc, type VariantDoc } from "../../sahne-kit/src/drawing.ts";
import { CHARACTERS, IS_SAMPLES, PLACES, SERIES, kitPieceFile, kitPieceIds, kitVariantFile, kitVariantIds, seasonFile, seasonIds, storyFile, storyIds } from "../../sahne-story/paths.ts";
import { loadCards, loadContentKit, loadNeeds } from "../../sahne-story/load.ts";
import { validateDoc } from "../../sahne-story/check/schema.ts";
import { checkCast, checkPlaces, checkSeason, checkSeries, checkStory, RETIRED_CHARACTERS, type CheckOptions, type CheckProblem } from "../../sahne-story/check/rules.ts";
import { calendarOf, charactersOf, loadWorld, type World } from "../../sahne-story/check/world.ts";
import { languagesOf, lintPlace, seasonOf, upgrade, type CharacterDoc, type SeasonDoc, type SeriesDoc, type StoryDoc, type StoryPlace } from "../../sahne-story/src/index.ts";
import { plain, readFile, textFor, writeAtomic } from "../../sahne-story/json.ts";

export type Kind = "series" | "season" | "story" | "character" | "place" | "kit_piece" | "kit_variant";
export const KINDS: Kind[] = ["series", "season", "story", "character", "place", "kit_piece", "kit_variant"];
type KitKind = "kit_piece" | "kit_variant";
const isKitKind = (k: Kind): k is KitKind => k === "kit_piece" || k === "kit_variant";

/** What each kind's ids look like. The series has one document, id `series`. */
const ID: Record<Kind, RegExp> = {
  series: /^series$/,
  season: /^s[1-9][0-9]?$/,
  story: /^s[1-9][0-9]?e[0-9]{2}$/,
  character: /^[a-z0-9_]+$/,
  place: /^[a-z0-9_]+$/,
  kit_piece: /^x_[a-z0-9_]+$/,
  kit_variant: /^[a-z][a-z0-9_]*\.x_[a-z0-9_]+$/,
};

const jsonIds = (dir: URL) => (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json") && f !== "needs.json").map(f => f.slice(0, -5)).sort() : []);

/** A document's file. Only for ids of the kind's pattern. */
export function fileOf(kind: Kind, id: string): URL {
  if (!ID[kind].test(id)) throw new Error(`not a ${kind} id: ${id}`);
  switch (kind) {
    case "series": return SERIES;
    case "season": return seasonFile(id);
    case "story": return storyFile(id);
    case "character": return new URL(`${id}.json`, CHARACTERS);
    case "place": return new URL(`${id}.json`, PLACES);
    case "kit_piece": return kitPieceFile(id);
    case "kit_variant": return kitVariantFile(id.slice(0, id.lastIndexOf(".")), id.slice(id.lastIndexOf(".") + 1));
  }
}

/** Every id of a kind with a file. */
export function idsOf(kind: Kind): string[] {
  switch (kind) {
    case "series": return existsSync(SERIES) ? ["series"] : [];
    case "season": return seasonIds();
    case "story": return storyIds();
    case "character": return jsonIds(CHARACTERS);
    case "place": return jsonIds(PLACES);
    case "kit_piece": return kitPieceIds();
    case "kit_variant": return kitVariantIds().map(v => `${v.of}.${v.name}`);
  }
}

export const isKind = (k: string): k is Kind => (KINDS as string[]).includes(k);
export const exists = (kind: Kind, id: string) => ID[kind].test(id) && idsOf(kind).includes(id);

/** A document as the browser gets it: plain JSON and the file's mtime (a save names it, so a change on disk is not overwritten). */
/** A document as the browser edits it: plain JSON, in the new language shape (sahne-story/src/upgrade.ts). */
export function readDoc(kind: Kind, id: string): { doc: unknown; mtime: number } {
  const r = readFile(fileOf(kind, id));
  return { doc: kind === "place" || isKitKind(kind) ? plain(r.doc) : upgrade(kind, plain(r.doc)), mtime: r.mtime };
}

// ---- checks ----------------------------------------------------------------------------------------------------------------

export interface Edit { kind: Kind; id: string; doc: unknown; mtime?: number; create?: boolean }
export interface Problem extends CheckProblem { doc: string; new?: boolean }

let cached: World | null = null;
const world = (): World => (cached ??= loadWorld());
/**
 * The content files still in the old language shape. While there are any, nothing is saved: a root is converted whole
 * (sahne-story/convert/languages.ts), never a file at a time, so an app that still reads the old fields gets one shape.
 */
export const oldShape = (): string[] => world().oldShape;

/** Forget the world read from disk (after a save, or a change made elsewhere). */
export const forget = () => { cached = null; every = null; gate = null; ownKit = null; solids.clear(); };

// ---- the root's own kit items ------------------------------------------------------------------------------------------------

interface Own { kit: Kit; docs: (DrawingDoc | VariantDoc)[]; problems: string[] }
let ownKit: Own | null = null;
const own = (): Own => (ownKit ??= (() => { const c = loadContentKit({ kit: full }); return { ...c, kit: withDrawings(full, c.docs) }; })());
/** The full kit with the root's own kit items (the good ones) added. */
export const kit = (): Kit => own().kit;
/** The kit items as the browser's stage adds them (`GET /api/kit`): the good documents, and a line for each file that is not. */
export const kitDocs = (): { docs: (DrawingDoc | VariantDoc)[]; problems: string[] } => ({ docs: own().docs, problems: own().problems });
const docKey = (d: DrawingDoc | VariantDoc) => ("of" in d ? `kit_variant:${d.of}.${d.name}` : `kit_piece:${d.id}`);

/**
 * The kit with these edited kit items in place of their files, and what is wrong with each edit: its schema, then its place in
 * the kit (a taken id, a generator or param the kit does not have). Pieces go in before variants, one at a time, so one
 * bad item leaves out only itself.
 */
export function kitWithEdits(edits: Edit[]): { kit: Kit; problems: Problem[] } {
  const mine = edits.filter(e => isKitKind(e.kind)), keys = new Set(mine.map(e => `${e.kind}:${e.id}`)), problems: Problem[] = [];
  const bad = (e: Edit, message: string) => problems.push({ rule: "kit", level: "error", story: `${e.kind}:${e.id}`, message, doc: `${e.kind}:${e.id}` });
  const docs: { doc: DrawingDoc | VariantDoc; edit?: Edit }[] = own().docs.filter(d => !keys.has(docKey(d))).map(doc => ({ doc }));
  for (const e of mine) {
    const schema = validateDoc(e.kind as KitKind, e.doc);
    if (schema.length) { for (const x of schema.slice(0, 6)) bad(e, `${x.path} ${x.message}`); continue; }
    docs.push({ doc: e.doc as DrawingDoc | VariantDoc, edit: e });
  }
  let k = full;
  for (const { doc, edit } of [...docs.filter(d => !("of" in d.doc)), ...docs.filter(d => "of" in d.doc)]) {
    try { k = withDrawings(k, [doc]); } catch (err) { if (edit) bad(edit, (err as Error).message); }
  }
  return { kit: k, problems };
}

const solids = new Map<string, Solid[]>();
const solidsOf = (places: Record<string, StoryPlace>): Record<string, Solid[]> =>
  Object.fromEntries(Object.entries(places).map(([id, p]) => {
    const key = `${id}:${JSON.stringify(p.pieces ?? [])}`;
    let s = solids.get(key);
    if (!s) { s = placeSolids(p, kit()); solids.set(key, s); }
    return [id, s];
  }));

let gate: Omit<CheckOptions, "solids"> | null = null;
const options = (k?: Kit): Omit<CheckOptions, "solids"> => { gate ??= { kit: kit(), cards: loadCards(), needs: loadNeeds() }; return k ? { ...gate, kit: k } : gate; };

/** The world with the edits in it: a story's characters read again from the edited cast, the calendar from the edited seasons. */
function withEdits(w0: World, edits: Edit[]): World {
  const w: World = { ...w0, drafts: [...w0.drafts], places: { ...w0.places }, cast: { ...w0.cast }, extras: { ...w0.extras }, seasons: { ...w0.seasons } };
  for (const e of edits) {
    if (e.kind === "series") w.series = e.doc as SeriesDoc;
    else if (e.kind === "season") w.seasons[e.id] = e.doc as SeasonDoc;
    else if (e.kind === "place") w.places[e.id] = e.doc as StoryPlace;
    else if (e.kind === "character") {
      const c = e.doc as CharacterDoc;
      if (c?.kind === "extra") { w.extras[e.id] = c; delete w.cast[e.id]; } else { w.cast[e.id] = c; delete w.extras[e.id]; }
    }
  }
  if (edits.some(e => e.kind === "season")) w.days = calendarOf(w.seasons, w.daysFile ?? null);
  const stories = new Map(edits.filter(e => e.kind === "story").map(e => [e.id, e.doc as StoryDoc]));
  w.drafts = w.drafts.map(d => (stories.has(d.id) ? { ...d, story: stories.get(d.id)! } : d));
  for (const [id, story] of stories) if (!w.drafts.some(d => d.id === id)) w.drafts.push({ id, story, characters: {}, file: `stories/${id}.json` });
  w.drafts.sort((a, b) => a.id.localeCompare(b.id));
  w.drafts = w.drafts.map(d => ({ ...d, characters: charactersOf(d.story, w.cast, w.extras) }));
  return w;
}

/**
 * The stories that use a place or a character, and where: a place they are set in (the episode's own, or a scene's), a
 * character in their cast or saying a line. With `part` (a place's mark or prop, a word card's id), only the stories
 * that name it, and the paths that do. The check reads it so a place's or character's edit that breaks a story is a new
 * error; `find_uses` gives it to agents.
 */
export function usesOf(kind: "place" | "character" | "card", id: string, part?: string, w: World = world()): { story: string; paths: string[] }[] {
  const out: { story: string; paths: string[] }[] = [];
  for (const d of w.drafts) {
    const s = d.story as unknown as Record<string, unknown>, steps = (s.steps ?? []) as Record<string, unknown>[];
    const paths: string[] = [];
    const scan = (v: unknown, path: string, hit: (x: unknown, key?: string) => boolean, key?: string) => {
      if (hit(v, key)) { paths.push(path); return; }
      if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}/${i}`, hit));
      else if (v && typeof v === "object") for (const [k2, x] of Object.entries(v)) scan(x, `${path}/${k2}`, hit, k2);
    };
    if (kind === "place") {
      const here = s.place === id || steps.some(x => x.scene === id);
      if (!here) continue;
      if (!part) paths.push(s.place === id ? "place" : `steps/${steps.findIndex(x => x.scene === id)}`);
      else steps.forEach((x, i) => scan(x, `steps/${i}`, v => v === part || (typeof v === "string" && (v.endsWith(`.${part}`) || v === `obj:${part}` || v.startsWith(`obj:${part}#`)))));
    } else if (kind === "character") {
      if (((s.cast ?? []) as string[]).includes(id)) paths.push("cast");
      steps.forEach((x, i) => scan(x, `steps/${i}`, (v, k2) => k2 === "who" && v === id));
    } else {
      if (((s.words ?? []) as string[]).includes(id)) paths.push("words");
      steps.forEach((x, i) => scan(x, `steps/${i}`, v => v === id));
    }
    if (paths.length) out.push({ story: d.id, paths: [...new Set(paths)] });
  }
  return out;
}

/** The problems of the edited documents in a world: each story's own and season rules, each character's, each place's, the series'. */
function problemsIn(w: World, edits: Edit[], k?: Kit): Problem[] {
  const out: Problem[] = [];
  const o = options(k);
  const sol = (places: Record<string, StoryPlace>) => (k ? Object.fromEntries(Object.entries(places).map(([id, p]) => [id, placeSolids(p, k)])) : solidsOf(places));
  const tag = (doc: string) => (p: CheckProblem): Problem => ({ ...p, doc });
  // a place or a character is checked with the stories that use it: a mark taken away, a voice changed, breaks them
  const users = edits.filter(e => e.kind === "place" || e.kind === "character").flatMap(e => usesOf(e.kind as "place" | "character", e.id, undefined, w).map(u => u.story));
  const stories = [...new Set([...edits.filter(e => e.kind === "story").map(e => e.id), ...users])];
  if (stories.length) {
    const placed = sol(w.places);
    const opts: CheckOptions = { ...o, solids: Object.fromEntries(stories.map(id => [id, placed])) };
    for (const id of stories) {
      const d = w.drafts.find(x => x.id === id);
      if (d) out.push(...checkStory(d, w, opts).map(tag(`story:${id}`)));
    }
    // the rules across stories, for every story: an edit of one can break another (two on one date)
    out.push(...checkSeason(w, w.drafts, opts).map(p => tag(p.story === "season" ? `season:s${seasonOf(stories[0])}` : `story:${p.story}`)(p)));
  }
  const characters = edits.filter(e => e.kind === "character").map(e => e.id);
  // the cast check over everyone: an edit of one can clash with another (two with one order)
  if (characters.length) out.push(...checkCast(w, o).map(p => tag(`character:${p.story.split(":")[1]}`)(p)));
  for (const e of edits.filter(e => e.kind === "place")) {
    const doc = w.places[e.id];
    out.push(...checkPlaces({ ...w, places: { [e.id]: doc } }).map(tag(`place:${e.id}`)));
    for (const p of lintPlace(doc, { kit: o.kit, cards: o.cards, needs: o.needs, languages: languagesOf(w.series) })) out.push({ rule: p.rule, level: p.level, story: `place:${e.id}`, message: p.message, doc: `place:${e.id}` });
  }
  if (edits.some(e => e.kind === "series" || e.kind === "season")) {
    for (const p of checkSeries(w)) {
      const doc = p.story === "series" ? "series:series" : p.story.startsWith("season:") ? `season:${p.story.slice(7)}` : `story:${p.story}`;
      out.push({ ...p, doc });
    }
  }
  return out;
}

const key = (p: CheckProblem) => `${p.rule}|${p.level}|${p.story}|${p.step ?? ""}|${p.message}`;

/** Check edited documents: every problem of theirs, the ones the edit brought marked `new`. */
export function check(edits: Edit[]): Problem[] {
  const w0 = world();
  const before = new Set(problemsIn(w0, edits.filter(e => !e.create && exists(e.kind, e.id) && !isKitKind(e.kind)).map(e => ({ ...e, doc: currentDoc(w0, e) }))).map(key));
  const withKit = edits.some(e => isKitKind(e.kind)) ? kitWithEdits(edits) : null;
  const after = problemsIn(withEdits(w0, edits), edits, withKit?.kit);
  return [...(withKit?.problems ?? []).map(p => ({ ...p, new: true })), ...after.map(p => (before.has(key(p)) ? p : { ...p, new: true }))];
}

/** The document a kind and id have in the world now (what an edit replaces). */
function currentDoc(w: World, e: Edit): unknown {
  switch (e.kind) {
    case "series": return w.series;
    case "season": return w.seasons[e.id];
    case "story": return w.drafts.find(d => d.id === e.id)?.story;
    case "place": return w.places[e.id];
    case "character": return w.cast[e.id] ?? w.extras[e.id];
    case "kit_piece": case "kit_variant": return readDoc(e.kind, e.id).doc;
  }
}

// ---- saving ------------------------------------------------------------------------------------------------------------------

export interface SaveResult { status: 200 | 400 | 403 | 409 | 422; saved?: Record<string, number>; problems?: Problem[]; message?: string }

/** Why an edit may not be made at all: an id of the wrong pattern, a new id that is taken or retired, an old one that is gone. */
export function refuse(e: Edit): string | null {
  if (!ID[e.kind].test(e.id)) return `${e.id} is not a ${e.kind} id`;
  if (!e.doc || typeof e.doc !== "object" || Array.isArray(e.doc)) return `${e.kind} ${e.id}: not a document`;
  const has = exists(e.kind, e.id);
  if (e.create) {
    if (has) return `${e.kind} ${e.id} exists already: ids are permanent, pick a new one`;
    if (e.kind === "character" && RETIRED_CHARACTERS.has(e.id)) return `${e.id} is a retired character id`;
  } else if (!has) return `${e.kind} ${e.id} has no file`;
  const d = e.doc as { id?: unknown; of?: unknown; name?: unknown };
  const docId = e.kind === "kit_variant" ? `${String(d.of)}.${String(d.name)}` : d.id;
  if (e.kind !== "series" && docId !== e.id) return `${e.kind} ${e.id}: its id is ${String(docId)}; ids never change`;
  if (e.kind === "character" && !e.create && (e.doc as CharacterDoc).kind === "extra") return `${e.id} is an extra: extras are written by sahne-story/cast/extras.ts`;
  return null;
}

/** Save a set of documents: refused whole when one is refused, changed on disk since it was read (409), or brings an error (422). */
export function save(edits: Edit[], o: { write: boolean }): SaveResult {
  if (!o.write) return { status: 403, message: IS_SAMPLES ? "the samples are read-only: start backstage with --write to edit them" : "this backstage is read-only (no --write)" };
  if (oldShape().length) return { status: 403, message: `the content root is in the old language shape (${oldShape().length} files): run node packages/sahne-story/convert/languages.ts on it first` };
  if (!edits.length) return { status: 400, message: "nothing to save" };
  for (const e of edits) { const why = refuse(e); if (why) return { status: 400, message: why }; }
  for (const e of edits) if (!e.create && e.mtime !== undefined && readFile(fileOf(e.kind, e.id)).mtime !== e.mtime) return { status: 409, message: `${e.kind} ${e.id} changed on disk since it was opened: reload it` };
  const problems = check(edits);
  if (problems.some(p => p.new && p.level === "error")) return { status: 422, problems, message: "the edit brings errors" };
  const saved: Record<string, number> = {};
  for (const e of edits) { const u = fileOf(e.kind, e.id); saved[`${e.kind}:${e.id}`] = writeAtomic(u, textFor(u, e.doc)); }
  forget();
  return { status: 200, saved, problems };
}

let every: Problem[] | null = null;
/** Every problem of the content root, as `stories.ts --check` finds them (cached until the next save or reload). */
export function allProblems(): Problem[] {
  if (every) return every;
  const w = world();
  const edits: Edit[] = [
    ...(w.series ? [{ kind: "series" as const, id: "series", doc: w.series }] : []),
    ...w.drafts.map(d => ({ kind: "story" as const, id: d.id, doc: d.story })),
    ...Object.keys(w.cast).map(id => ({ kind: "character" as const, id, doc: w.cast[id] })),
    ...Object.keys(w.places).map(id => ({ kind: "place" as const, id, doc: w.places[id] })),
  ];
  every = problemsIn(w, edits);
  for (const line of own().problems) {
    const m = /^kit\/(pieces|variants)\/(.+?)\.json: (.*)$/s.exec(line), doc = m ? `${m[1] === "pieces" ? "kit_piece" : "kit_variant"}:${m[2]}` : "kit";
    every.push({ rule: "kit", level: "error", story: doc, message: m ? m[3] : line, doc });
  }
  if (!w.series) every.push(...checkSeries(w).map(p => ({ ...p, doc: "series:series" })));
  return every;
}

/** Word cards matching a search (Turkish or English), for the word picker: read live, never written anywhere. */
export function searchCards(q: string, limit = 40): { id: string; tr: string; en: string; level?: string }[] {
  const cards = options().cards;
  if (!cards) return [];
  const s = q.trim().toLocaleLowerCase("tr");
  return Object.entries(cards).filter(([id, c]) => !c.retired && (!s || id.includes(s) || c.tr.toLocaleLowerCase("tr").includes(s) || c.en.toLowerCase().includes(s)))
    .slice(0, limit).map(([id, c]) => ({ id, tr: c.tr, en: c.en, ...(c.level ? { level: c.level } : {}) }));
}

/** The grammar lessons' ids with their unit, for the lesson picker (none on a root without grammar/). */
export function lessons(): { id: string; ref?: string }[] {
  return Object.entries(world().lessons ?? {}).map(([id, l]) => ({ id, ref: l.ref }));
}

/** Everything the browser lists: the series, the seasons with their episodes, the cast, the places. */
export function listing() {
  const w = world();
  const episodes = w.drafts.map(d => ({ id: d.id, season: d.story.season, title: d.story.title, kind: d.story.kind, releaseDate: d.story.releaseDate, draft: !!d.story.draft, place: d.story.place, cast: d.story.cast }));
  return { series: w.series, seasons: w.seasons, episodes, characters: { ...w.cast, ...w.extras } as Record<string, CharacterDoc>, places: w.places, days: w.days, cards: !!w.cards };
}
