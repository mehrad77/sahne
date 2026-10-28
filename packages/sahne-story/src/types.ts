// The story document of Kumru's STORIES_SCHEMA.md (§3–§5), as far as the stage reads it.
// Fields the stage never reads (quiz, summary, album …) are kept loose.

import type { AvatarDoc, Look, PlaceDoc, PropRef, Staging } from "sahne";

/** The staging a story writes: everything but `costume`, which the adapter derives from `looks`. */
export type StoryStaging = Omit<Staging, "costume">;

/** A change of clothes (§5.2): an outfit name of the character's `outfits` ("default" the avatar), or a look on what they wear now. */
export type LookRef = string | Look;
/** Character id → change of clothes. Only on the story, a scene, a line or a beat (never inside a choice or an act). */
export type Looks = Record<string, LookRef>;

/** Turkish, English and Persian. Only `tr` ever reaches the stage. */
export interface Text3 { tr: string; en?: string; fa?: string }

/** `if` / `unless`: a callback to a flag an earlier story set (§4.7). */
export interface Gate { if?: string; unless?: string }

/** A line (§4.1): who speaks, the text, and its staging (§4.2). */
export interface LineStep extends StoryStaging, Text3, Gate {
  who: string;
  /** Changes of clothes as the line starts (a coat coming off). */
  looks?: Looks;
  narr?: true;
  note?: { en?: string; fa?: string };
  mistake?: { fix: string };
  /** `frame: "past_inset"`: the scene it pictures. */
  of?: { story: string; step: number };
}

export interface BeatStep extends Gate { beat: StoryStaging & { who?: string; wait?: number; looks?: Looks } }

export interface SceneStep extends Gate {
  scene: string;
  time?: string;
  /** States of the place to turn on beside its defaults (the class empty, the shutter down). */
  state?: string | string[];
  weather?: string;
  at?: Record<string, string>;
  /** The mark where Kerim perches in the world. */
  kerim?: string;
  /** A vehicle that stops (the metro car) stands at this station as the scene opens, doors open (`PlaceDoc.stops`). */
  stop?: string;
  /** Changes of clothes from this scene on. */
  looks?: Looks;
}

export interface SpotStep extends Gate {
  spot: StoryStaging & { lesson: string; ex: string; en?: string; fa?: string; tr?: string; show?: string };
}

export interface ChoiceOption extends StoryStaging, Text3 {
  ok?: boolean;
  tone?: "polite" | "warm" | "formal" | "casual" | "blunt" | "rude";
  sets?: string;
  warm?: Record<string, number>;
  /** What follows the pick: lines and beats (a pause before a reluctant answer). */
  reply?: (LineStep | BeatStep)[];
}

export interface ChoiceStep extends Gate {
  choice: { id: string; kind?: "polite" | "meaning" | "action"; to?: string; options: ChoiceOption[] };
}

export interface ActStep extends Gate {
  act: {
    id: string;
    kind: "tap" | "drag" | "go" | "choose";
    prompt?: Text3;
    targets: string[];
    expect?: string;
    /** drag: the prop that is dragged. */
    item?: string;
    to?: string;
    react?: { ok?: Record<string, ReactValue>; other?: Record<string, ReactValue> };
    warm?: Record<string, number>;
  };
}

/** Where a prop stands: a point or a mark. */
export type PropAt = PropRef["at"];
/**
 * A story-only prop (Kumru's STORIES_SCHEMA.md §3): `at` is where it stands in the story's opening place,
 * or a map of place id → where it stands there. It is one thing in every place it is in.
 */
export interface StoryProp { kit: string; at: PropAt | Record<string, PropAt>; n?: number; terms?: string[]; shown?: boolean; [param: string]: unknown }

export type ReactValue =NonNullable<Staging["react"]>[string];

export type Step = LineStep | BeatStep | SceneStep | SpotStep | ChoiceStep | ActStep;

export interface Arc { id: string; tr: string; en?: string; fa?: string; mechanics: ("say" | "explore" | "act" | "aloud" | "unlocks")[] }

export interface StoryDoc {
  id: string;
  releaseDate?: string;
  kind?: "episode" | "special";
  level?: string;
  season?: number;
  arc?: Arc;
  ref?: string;
  title: string;
  titleEn?: string;
  titleFa?: string;
  place: string;
  cast: string[];
  extras?: string[];
  lessons?: string[];
  words?: string[];
  gl?: Record<string, [string, string]>;
  /** Story-only props, added to the places their `at` names (src/props.ts). */
  props?: Record<string, StoryProp>;
  /** What the cast wears from the start (§5.2). */
  looks?: Looks;
  /** A display name for a character in this story only, before the learner meets them by name (s1e14: Maria is "Teyze"). */
  names?: Record<string, string>;
  steps: Step[];
  draft?: true;
  [k: string]: unknown;
}

/** The series: the one story world of a content root (`series.json`, schema/series.json). Its episodes are the story documents. */
export interface SeriesDoc {
  v: 1;
  id: string;
  title: string;
  titleEn: string;
  titleFa: string;
  summary?: string;
  summaryFa?: string;
  /** The narrator's and the stand-in's character ids (the stage casts `NARRATOR` and `STANDIN`). */
  narrator: string;
  standin: string;
}

/** One release of an episode: its date, whether it is a weekday episode or a Saturday special, and its week. */
export interface CalendarRow { date: string; kind: "episode" | "special"; week: number }

/** A season of the series (`seasons/s<n>.json`, schema/season.json): its episodes are the stories `s<n>eNN`. No level. */
export interface SeasonDoc {
  v: 1;
  id: string;
  n: number;
  title: string;
  titleEn: string;
  titleFa: string;
  summary?: string;
  summaryFa?: string;
  /** The first release day of the season. */
  launch?: string;
  /** Each week's arc, by arc id (`s<n>wNN`): every story of the week carries the same `arc`. */
  arcs?: Record<string, Omit<Arc, "id">>;
  /** The release calendar, by story id: the source of truth for each story's `releaseDate` and `kind`. */
  calendar?: Record<string, CalendarRow>;
}

/** The season a story id belongs to (`s12e03` → 12), or 0 for an id that is not one. */
export const seasonOf = (id: string): number => Number(/^s([1-9][0-9]?)e[0-9]{2}$/.exec(id)?.[1] ?? 0);

/** The character document (§5): what the stage reads of it. */
export interface CharacterDoc {
  id: string;
  name: string;
  nameFa?: string;
  kind: "narrator" | "standin" | "cast" | "extra";
  color?: string;
  avatar?: AvatarDoc;
  /** A kit puppet plays this character instead of an avatar (§5): Kerim's "bird" puts her on stage. */
  puppet?: string;
  /** The app's ids for what this character is (Kumru's card ids, `a1-w-kus`): a tap on them gives these. */
  terms?: string[];
  /** Named changes of clothes for `looks` (§5.2); "default" is reserved for the avatar itself. */
  outfits?: Record<string, Look>;
  motion?: { tempo?: number; energy?: string; signature?: string[] };
  voice?: { rate?: number; pitch?: number; neural?: string };
  [k: string]: unknown;
}

export const isLine = (s: Step): s is LineStep => "who" in s;
export const isBeat = (s: Step): s is BeatStep => "beat" in s;
export const isScene = (s: Step): s is SceneStep => "scene" in s;
export const isSpot = (s: Step): s is SpotStep => "spot" in s;
export const isChoice = (s: Step): s is ChoiceStep => "choice" in s;
export const isAct = (s: Step): s is ActStep => "act" in s;

/** The stand-in's id: the learner plays Nima. */
export const STANDIN = "nima";
/** The narrator's id. */
export const NARRATOR = "kerim";

/**
 * A place document as Kumru keeps it (Kumru's STORIES_SCHEMA.md §6): a Sahne place with its name in three
 * languages and its district. `placeholder` marks a draft whose art stands in for the real thing: the
 * place lints only warn on it.
 */
export interface StoryPlace extends PlaceDoc {
  /** Every place is named in all three languages (only `tr` reaches the stage). */
  name: { tr: string; en: string; fa: string };
  district?: string;
  placeholder?: string;
  props?: Record<string, StoryPlaceProp>;
}
/** A place's prop. `decor`: dressing with no word to teach, so it needs no `terms`. */
export type StoryPlaceProp = PropRef & { decor?: boolean };
