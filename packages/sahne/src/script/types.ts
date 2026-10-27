// The script: what the engine plays (DESIGN.md §5.6). Each app turns its own content into a
// script; Kumru's story adapter is in Kumru's STORIES_STAGE.md §3.

/** `obj:<prop>`, `ch:<actor>`, `ch:<actor>.<part>` (hand, head, chest), `mark:<mark>` or `viewer`. */
export type Target = string;

export type CamKind = (typeof CAM_KINDS)[number];
export type MoveHow = (typeof MOVE_HOWS)[number];
export type Voice = (typeof VOICES)[number];
export type ObjOpKind = (typeof OBJ_OPS)[number];
export type ActKind = (typeof ACT_KINDS)[number];

// The script's vocabularies as values, so tools can list them (the gallery's coverage test, lints).
// `ots`, `split` and `photo` are framed as a bust for now; `own` is typed only (DESIGN.md §5.6).
export const CAM_KINDS = ["wide", "two", "single", "close", "obj", "ots", "follow", "split", "photo"] as const;
export const MOVE_HOWS = ["walk", "run", "hop", "enter", "exit", "fly"] as const;
export const VOICES = ["normal", "whisper", "silent", "mouthing"] as const;
export const OBJ_OPS = ["show", "hide", "give", "take", "add", "own", "place", "set", "go"] as const;
export const ACT_KINDS = ["tap", "drag", "go", "choose"] as const;
/** The `env` verbs: `time:<t>[:<ms>]`, `state:[-]<s>[:fade|:roll]`, `weather:<w>`, `fireworks[:n]`, `stop:<station>`, and the bare `thunder`, `lights_on`, `lights_off`, `stop` (a halt where it is), `depart`. */
export const ENV_VERBS = ["time", "state", "weather", "fireworks", "thunder", "lights_on", "lights_off", "stop", "depart"] as const;

/** `from` names the door mark of an `enter` (default: the place's first mark with a door). */
/** `via`: marks to pass on the way (the landings of a stairway); a leg that climbs or goes down more than 10 cm is taken in steps. */
export interface Move { who: string; to: string; how?: MoveHow; from?: string; via?: string[] }

export interface ObjOp {
  id: string;
  op: ObjOpKind;
  /** give: the receiver; place, go: a mark. */
  to?: string;
  /** go: marks to pass on the way. */
  via?: string[];
  /** go: how long it takes (ms); by default at 0.9 m/s. */
  ms?: number;
  /** give, take, add: how many. */
  n?: number;
  /** place: a mark or a target. */
  at?: string;
  /** set: parameters (a clock's `time`, a label); `still: true` holds the prop's own motion (a rolling ball, a swinging lamp) where it starts. */
  set?: Record<string, unknown>;
}

export interface Reaction { emo?: string; do?: string; at?: Target }
/** A sound from the kit: `word` overrides the kit's sound word, `at` is where it comes from, `params` go to its patch. */
export interface Sfx { id: string; word?: string; at?: Target; params?: Record<string, unknown> }

/** Staging on a line or a beat. Every field is optional; the director fills in the rest. */
export interface Staging {
  to?: string;
  emo?: string;
  do?: string;
  at?: Target;
  n?: number;
  loop?: boolean;
  move?: Move | Move[];
  obj?: ObjOp[];
  link?: Record<string, Target>;
  react?: Record<string, string | Reaction>;
  cam?: CamKind;
  via?: "phone" | "video";
  voice?: Voice;
  sfx?: Sfx | Sfx[];
  /** `time:<t>`, `state:<s>` (`-<s>` turns one off, `:fade` fades, `:roll` fades slowly and lets a `reveal` flat roll), several at once as a list. */
  env?: string | string[];
  frame?: "past" | "past_inset";
  /** Speed of this cue's speech and gestures (İsmail, quickly: 1.4). */
  tempo?: number;
  /** The word the gesture's stroke meets ("yok" for a shrug); default: the word linked to its target, else the first word. */
  on?: string;
  /** A change of clothes as the line starts (after any walk on): actor → a key of `LoadOptions.wardrobe[actor]`, "" for the cast document. */
  costume?: Record<string, string>;
}

/** `costume`: actor → wardrobe key, dressed at the cut ("" the cast document). */
export interface SceneCue { scene: { place: string; time?: string; weather?: string; /** States to turn on beside the place's defaults. */ state?: string | string[]; at: Record<string, string>; perch?: string; cam?: CamKind; costume?: Record<string, string>; /** The vehicle stands at this station as the scene opens, doors open (`PlaceDoc.stops`). */ stop?: string } }
export interface LineCue { line: Staging & { who: string; text: string } }
/** A staging moment with no speech; `who` performs `do` and `emo`. `wait` holds the stage for that long (ms). */
export interface BeatCue { beat: Staging & { who?: string; wait?: number } }
/**
 * The learner acts on stage (DESIGN.md §9): `tap` a thing or person, `drag` a prop (`obj`) to
 * someone or to a mark, `go` to a mark, or `choose` between things. Without `expect` any target
 * is accepted (a choice). The stage writes the answer into `result`; until then the world after
 * the cue (`fold`) takes `expect`.
 */
export interface Act {
  kind: ActKind;
  /** tap, choose: the things to pick from; drag: where the prop may go (`ch:` or `mark:`); go: marks. */
  targets: Target[];
  expect?: Target;
  /** What is asked, in the scene's language (the accessible list's label; the app may show it). */
  prompt?: string;
  /** The actor the learner plays: looks and points at the answer, walks to it, takes a prop. */
  who?: string;
  /** Who asked: a hint is their gaze, a shown answer their point. */
  by?: string;
  /** drag: the prop being moved. */
  obj?: string;
  /** The framing while the learner acts (default `wide`, so every target is in view). */
  cam?: CamKind;
  /** The learner's answer, once given. */
  result?: Target;
}
export interface ActCue { act: Act }
export interface OverlayCue { overlay: { kind: string; [k: string]: unknown } }

export type Cue = SceneCue | LineCue | BeatCue | ActCue | OverlayCue;

type KeysOf<T> = T extends unknown ? keyof T : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type CueKind = KeysOf<Cue>;
export const CUE_KINDS = ["scene", "line", "beat", "act", "overlay"] as const;
/** Every field of `Staging`, the director's knobs on a line or a beat. */
export const STAGING_FIELDS = ["to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "costume"] as const;
// the lists above must name every member of their types, no more and no fewer
const _cue: Same<(typeof CUE_KINDS)[number], CueKind> = true;
const _staging: Same<(typeof STAGING_FIELDS)[number], keyof Staging> = true;
void _cue; void _staging;

export interface Script { v: 1; cues: Cue[] }
