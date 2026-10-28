// What the story check reads from the content root (node only): the stories, the characters (the cast
// roster and the extras), every place, the series and its seasons, and, when the root has them, the cards
// with their units, the grammar lesson ids, the release calendar (the seasons' `calendar`, or days.json) and
// the syllabus data. Where each lives is ../paths.ts. An
// optional collection the root lacks is `null`, and the rules that need it do not run. Reads, never writes.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { NARRATOR, STANDIN, type CharacterDoc, type SeasonDoc, type SeriesDoc, type StoryDoc, type StoryPlace } from "../src/types.ts";
import { CARDS, CARDS_EXTRA, CHARACTERS, DAYS, EXTRAS, GRAMMAR, PLACES, SERIES, SYLLABUS, repoPath, seasonFile, seasonIds, storyFile, storyIds } from "../paths.ts";

const json = (u: URL) => JSON.parse(readFileSync(u, "utf8"));

export interface Draft { id: string; story: StoryDoc; characters: Record<string, CharacterDoc>; file: string }
export interface Day { id: string; date: string; week: number; kind: "episode" | "special" }
export interface CardUnit { level?: string; ref?: string; tr: string }
export interface Syllabus { words: Record<string, { tr: string; unit: number; page: number; book: string; via?: string }>; lessons: Record<string, { unit: number }>; units?: Record<string, unknown> }
export interface World {
  drafts: Draft[];
  places: Record<string, StoryPlace>;
  /** The word cards (`cards/` and `cards-extra/`), or null when the content root has none. */
  cards: Record<string, CardUnit> | null;
  /** The grammar lessons (`grammar/`), or null when the content root has none. */
  lessons: Record<string, { ref: string; level: string }> | null;
  /** The release calendar (the seasons' `calendar`, else `days.json`), or null when the content root has none. */
  days: Record<string, Day> | null;
  /** The series (`series.json`), or null when the content root has none yet. */
  series: SeriesDoc | null;
  /** The seasons (`seasons/`), by id (the file name). */
  seasons: Record<string, SeasonDoc>;
  /** `days.json` as it is, when the root also has one beside the seasons' calendars (the check keeps the two in step). */
  daysFile?: Record<string, Day> | null;
  syllabus: Syllabus | null;
  /** The cast roster (`CHARACTERS` in paths.ts, every `kind` but `extra`): id (the file name) → character document. */
  cast: Record<string, CharacterDoc>;
  /** The generic extras (`EXTRAS` in paths.ts, written by cast/extras.ts): the character documents with `kind: "extra"`, read as plain JSON so the check can refuse a bad one. */
  extras: Record<string, unknown>;
}

/**
 * A story's characters: Kerim, Nima, its `cast` and its `extras`, read from the roster or the generic
 * extras (paths.ts), the one home of character documents. An id in neither
 * is left out, and the story check reports it.
 */
export function charactersOf(story: StoryDoc, cast = loadCast(), extras = loadExtras()): Record<string, CharacterDoc> {
  const out: Record<string, CharacterDoc> = {};
  for (const id of new Set([NARRATOR, STANDIN, ...(story.cast ?? []), ...(story.extras ?? [])])) {
    const doc = cast[id] ?? (extras[id] as CharacterDoc | undefined);
    if (doc) out[id] = doc;
  }
  return out;
}

/** Every story (`storyIds` in paths.ts) with its characters (`charactersOf`), as serve.mjs finds them. */
export function loadDrafts(): Draft[] {
  const cast = loadCast(), extras = loadExtras();
  return storyIds().map(id => {
    const f = storyFile(id), story: StoryDoc = json(f);
    return { id, story, characters: charactersOf(story, cast, extras), file: repoPath(f) };
  });
}

/** Every place document, by id (the file name). */
export function loadPlaces(): Record<string, StoryPlace> {
  const out: Record<string, StoryPlace> = {};
  for (const f of readdirSync(PLACES).filter(f => f.endsWith(".json") && f !== "needs.json").sort()) out[f.slice(0, -5)] = json(new URL(f, PLACES));
  return out;
}

function loadCardUnits(): Record<string, CardUnit> | null {
  if (!existsSync(CARDS)) return null;
  const out: Record<string, CardUnit> = {};
  for (const dir of [CARDS, CARDS_EXTRA]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith(".json"))) {
      const c = json(new URL(f, dir));
      out[f.slice(0, -5)] = { level: c.level, ref: c.ref, tr: c.tr ?? "" };
    }
  }
  return out;
}

function loadLessons(): Record<string, { ref: string; level: string }> | null {
  const dir = GRAMMAR;
  if (!existsSync(dir)) return null;
  const out: Record<string, { ref: string; level: string }> = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith(".json"))) { const g = json(new URL(f, dir)); out[f.slice(0, -5)] = { ref: g.ref, level: g.level }; }
  return out;
}

/** Every `<file>.json` of a folder, by file name ({} when the folder does not exist). */
function jsonDir<T>(dir: URL): Record<string, T> {
  const out: Record<string, T> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) out[f.slice(0, -5)] = json(new URL(f, dir));
  return out;
}

const isExtra = (x: unknown): boolean => !!x && typeof x === "object" && (x as { kind?: unknown }).kind === "extra";
/** The cast roster: every document of `CHARACTERS` (paths.ts) whose `kind` is not `extra`. */
export const loadCast = (): Record<string, CharacterDoc> => Object.fromEntries(Object.entries(jsonDir<CharacterDoc>(CHARACTERS)).filter(([, c]) => !isExtra(c)));
/** The generic extras: every document of `EXTRAS` (paths.ts) with `kind: "extra"`, generated by `cast/extras.ts`. */
export const loadExtras = (): Record<string, unknown> => Object.fromEntries(Object.entries(jsonDir<unknown>(EXTRAS)).filter(([, c]) => isExtra(c)));

/** The series document, or null when the root has none. */
export const loadSeries = (): SeriesDoc | null => (existsSync(SERIES) ? json(SERIES) : null);
/** Every season document, by id, in season order. */
export const loadSeasons = (): Record<string, SeasonDoc> => Object.fromEntries(seasonIds().map(id => [id, json(seasonFile(id))]));

/**
 * The release calendar: every season's `calendar` when any season has one, else `days.json` of the content
 * root ({ <story id>: { date, week, kind } }), else null.
 */
export function calendarOf(seasons: Record<string, SeasonDoc>, file: Record<string, Day> | null = loadDaysFile()): Record<string, Day> | null {
  const rows = Object.values(seasons).flatMap(s => Object.entries(s.calendar ?? {}));
  if (!rows.length) return file;
  return Object.fromEntries(rows.map(([id, d]) => [id, { id, date: d.date, week: d.week, kind: d.kind }]));
}

/** The release calendar as `loadWorld` reads it (`calendarOf` the seasons). */
export const loadDays = (): Record<string, Day> | null => calendarOf(loadSeasons());

/** `days.json` of the content root, or null without it. */
export function loadDaysFile(): Record<string, Day> | null {
  if (!existsSync(DAYS)) return null;
  const raw: Record<string, Omit<Day, "id">> = json(DAYS);
  return Object.fromEntries(Object.entries(raw).map(([id, d]) => [id, { id, date: d.date, week: d.week, kind: d.kind }]));
}

export function loadSyllabus(): Syllabus | null {
  const f = new URL("a1.json", SYLLABUS);
  return existsSync(f) ? json(f) : null;
}

export function loadWorld(): World {
  const seasons = loadSeasons(), daysFile = loadDaysFile();
  return { drafts: loadDrafts(), places: loadPlaces(), cards: loadCardUnits(), lessons: loadLessons(), days: calendarOf(seasons, daysFile), daysFile, series: loadSeries(), seasons, syllabus: loadSyllabus(), cast: loadCast(), extras: loadExtras() };
}
