// Where the story data lives: the content root. It is the folder named by the env var SAHNE_CONTENT (an
// absolute path), or, without it, this package's samples/ (one short sample story, its characters and two
// places). The root holds stories/, characters/ and places/ (<id>.json each; the extras flat among the
// characters, told apart by `kind: "extra"`). Everything else in it is optional, and the checks that need
// it run only when it is there: cards/ and cards-extra/ (the word cards the stories teach), grammar/ (the
// lessons a story names), syllabus/ (a1.json, what each unit teaches), thumbs/ (the story pictures,
// written by the gallery's thumbs.mjs), needs.json (what each place is asked for) and days.json (the
// release calendar). The schemas stay in this package. A second, optional env var, SAHNE_STORY_DOCS (an
// absolute folder), holds STORIES_WORLD.md (the stories' sites, §2) for the gallery's places board and
// test/needs.test.ts; without it they leave the sites out. Every node reader (the story check, the place
// checker, the extras' generator, the tests, the kit's set build and tests, the gallery's server and
// scripts) names these from here and never builds a path of its own. Node only. Two browser files of the
// gallery import a place by a literal path, since a bundled JSON import cannot name a runtime constant:
// packages/sahne-gallery/src/bakkal.ts and src/systems/places.ts (both read the samples).

import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = new URL("./", import.meta.url);
/** The repo root. */
export const REPO = new URL("../../", import.meta.url);
/** The samples: the content root when SAHNE_CONTENT is not set. */
export const SAMPLES = new URL("samples/", HERE);

const env = process.env.SAHNE_CONTENT;
if (env && !isAbsolute(env)) throw new Error(`SAHNE_CONTENT must be an absolute path, not ${env}`);
/** The content root: $SAHNE_CONTENT, or the samples. Always ends in a slash. */
export const CONTENT = env ? pathToFileURL(resolve(env) + "/") : SAMPLES;
/** Whether the content root is the samples (SAHNE_CONTENT unset). */
export const IS_SAMPLES = !env;

const docs = process.env.SAHNE_STORY_DOCS;
if (docs && !isAbsolute(docs)) throw new Error(`SAHNE_STORY_DOCS must be an absolute path, not ${docs}`);
/** The story docs folder ($SAHNE_STORY_DOCS), or null when it is not set. Always ends in a slash. */
export const STORY_DOCS: URL | null = docs ? pathToFileURL(resolve(docs) + "/") : null;
/** Optional: the sites of the stories, the tables of STORIES_WORLD.md §2 (the gallery's places board, test/needs.test.ts). */
export const STORIES_WORLD: URL | null = STORY_DOCS && new URL("STORIES_WORLD.md", STORY_DOCS);

/** The stories: `<id>.json`. */
export const STORIES = new URL("stories/", CONTENT);
/** One story's file. */
export const storyFile = (id: string): URL => new URL(`${id}.json`, STORIES);
/** Every story id with a file, sorted. */
export const storyIds = (): string[] => existsSync(STORIES) ? readdirSync(STORIES).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort() : [];

/** The characters' documents: the cast roster and the generic extras, `<id>.json`, told apart by `kind`. */
export const CHARACTERS = new URL("characters/", CONTENT);
/** The generic extras (`kind: "extra"`, written by cast/extras.ts): the same folder as the roster. */
export const EXTRAS = CHARACTERS;
/** The place documents: `<id>.json`. */
export const PLACES = new URL("places/", CONTENT);

/** Optional: the word cards, `<id>.json` (with `cards-extra/`). */
export const CARDS = new URL("cards/", CONTENT);
/** Optional: more word cards, `<id>.json`. */
export const CARDS_EXTRA = new URL("cards-extra/", CONTENT);
/** Optional: the grammar lessons, `<id>.json`. */
export const GRAMMAR = new URL("grammar/", CONTENT);
/** Optional: the syllabus data, `a1.json`. */
export const SYLLABUS = new URL("syllabus/", CONTENT);
/** Optional: the story pictures and their index (`thumbs.json`), written by the gallery's thumbs.mjs. */
export const THUMBS = new URL("thumbs/", CONTENT);
/** Optional: what the stories' briefs ask of each place (src/needs.ts). */
export const NEEDS = new URL("needs.json", CONTENT);
/** Optional: the release calendar, { <story id>: { date, week, kind } } (check/world.ts `Day`). */
export const DAYS = new URL("days.json", CONTENT);

/** The JSON schemas of stories, characters and places (stay in the package). */
export const SCHEMA = new URL("schema/", HERE);

/** A file's path for messages: from the repo root when it is inside the repo, else absolute. */
export const repoPath = (u: URL): string => {
  const p = fileURLToPath(u), r = relative(fileURLToPath(REPO), p);
  return r.startsWith("..") ? p : r;
};
