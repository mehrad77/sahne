// Story plugins: what a series adds to the core story format, such as lessons (sahne-lesson). A plugin brings its own step
// kinds (each with its schema and the cues it becomes), its own story and line fields, checks and lints, the texts it needs
// in the series' languages, and a word for the assistant's prompt.
//
// The seam is inverted: sahne-story owns this interface and never imports a plugin. A host (the gate, backstage, the
// gallery, an app's reader) holds the plugins it knows and passes them in; `series.json` `plugins` names the ones a series
// turns on, and `pluginsOf` picks those. A story read without its plugin is checked as core only, so a plugin's step or
// field is a schema error there.

import type { Cue } from "sahne";
import type { CueInfo, Shown } from "./adapt.ts";
import type { Problem } from "./lint.ts";
import type { CharacterDoc, SeriesDoc, Step, StoryDoc, StoryStaging } from "./types.ts";
import type { Languages } from "./texts.ts";
import type { StoryLang } from "./lang.ts";
import type { PlayMode } from "./play.ts";

/** A text a story lacks in one of the series' languages: where it is (a JSON path) and what is missing. */
export interface PluginGap { path: string; message: string }

/** What a plugin step's `adapt` may use: the adapter's own helpers, so its cues read like the core's. */
export interface AdaptContext {
  /** The step's index in the story. */
  step: number;
  /** The series' main language: the one that reaches the stage. */
  main: string;
  /** How the story plays (src/play.ts): in `watch`, a step must not wait for the viewer. */
  play: PlayMode;
  /** A main-language text personalised for the stage. */
  p(text: string): string;
  /** A step's main-language text. */
  said(t: object): string;
  /** A step's texts in every language of the series, as the host shows them. */
  shown(t: object): Shown;
  /** The staging fields of a step, ready for a cue. */
  staging(s: StoryStaging): Record<string, unknown>;
  /** Add a cue with what the host knows of it. */
  push(cue: Cue, info: CueInfo): void;
}

/** A step kind a plugin adds. */
export interface PluginStep {
  /** The step's key (`spot` for `{ spot: … }`): it names the kind in the schema and the editor. */
  key: string;
  /** The JSON schema of the whole step (a branch of the core schema's `step` oneOf). */
  schema: object;
  /** Whether a step is one of these. */
  is(step: Step | object): boolean;
  /** The cues the step becomes. */
  adapt(step: object, ctx: AdaptContext): void;
  /** Who acts on stage in the step and how, for the staging lints (budget, moves, clothes), as a beat's. */
  staging?(step: object): { who: string; staging: StoryStaging };
}

/** Where a plugin check adds a problem: `rule` is the plugin's own, `step` the story step it is on. */
export type PluginAdd = (rule: string, level: "error" | "warning" | "info", message: string, step?: number) => void;

/** What a plugin's story check reads. `world` is the check's World (check/world.ts), kept loose so src/ never imports check/. */
export interface PluginCheckContext {
  story: StoryDoc;
  characters: Record<string, CharacterDoc>;
  world: unknown;
  languages: Languages;
  lang: StoryLang;
  /** How the story plays (src/play.ts): a plugin decides what its parts do in a watch-only episode. */
  play: PlayMode;
  /** Every main-language text of the story with its step (check/rules.ts `texts`). */
  texts: { tr: string; step: number; kind: string; who?: string; narr?: boolean }[];
  /** The names the story may use as words: the characters', the places', the language's own (a hometown token). */
  names: string[];
  /** A text as the check compares it: lower case in the story language, punctuation gone. */
  norm(text: string): string;
  add: PluginAdd;
}

/** What a plugin's season check reads: every story of the season, the world, and the texts of any story. */
export interface PluginSeasonContext {
  world: unknown;
  stories: StoryDoc[];
  lang: StoryLang;
  texts(story: StoryDoc): { tr: string; step: number; kind: string }[];
  add(rule: string, level: "error" | "warning" | "info", story: string, message: string): void;
}

/** Schema fragments merged into the core schemas while the plugin is on. */
export interface PluginSchema {
  /** Story fields (top level), and the ones of them the story must have. */
  story?: { properties?: Record<string, object>; required?: string[] };
  /** Fields of a line step (and of the lines in a choice's replies). */
  line?: Record<string, object>;
  /** Fields of a choice (`choice.kind` values, say, go through `choice`). */
  choice?: Record<string, object>;
}

export interface StoryPlugin {
  /** The id `series.json` `plugins` names. */
  id: string;
  steps?: PluginStep[];
  schema?: PluginSchema;
  /** Checks on one story, run after the core's. */
  check?(ctx: PluginCheckContext): void;
  /** Checks across the stories of a season (`checkSeason`). */
  season?(ctx: PluginSeasonContext): void;
  /** What a line adds to its cue's info for the host (a note for the learner), from the line's own fields. */
  lineInfo?(line: object, personalise: (text: string, lang: string) => string): Partial<CueInfo>;
  /** Lints on one story (staging against the text, as `lintStory`'s). */
  lint?(story: StoryDoc, o: { lang: StoryLang; play: PlayMode }): Problem[];
  /** The plugin's texts a story must have in the series' languages (`/gl/akşam` …), as the core's `storyLanguageGaps`. */
  languageGaps?(story: StoryDoc, languages: Languages): PluginGap[];
  /** What the assistant should know when the plugin is on: a few sentences, added to its prompt. */
  prompt?: string;
}

/** The plugins a series turns on, from those the host has, in the series' order. Names the host lacks are left out (`missingPlugins` says which). */
export function pluginsOf(series: Pick<SeriesDoc, "plugins"> | null | undefined, given: readonly StoryPlugin[]): StoryPlugin[] {
  return (series?.plugins ?? []).flatMap(id => given.filter(p => p.id === id));
}

/** The plugins a series names that the host does not have. */
export const missingPlugins = (series: Pick<SeriesDoc, "plugins"> | null | undefined, given: readonly StoryPlugin[]): string[] =>
  (series?.plugins ?? []).filter(id => !given.some(p => p.id === id));

/** The plugin step a step is, if any. */
export function pluginStepOf(step: Step | object, plugins: readonly StoryPlugin[]): PluginStep | undefined {
  for (const p of plugins) for (const k of p.steps ?? []) if (k.is(step)) return k;
  return undefined;
}
