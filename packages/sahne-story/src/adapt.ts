// The story adapter (Kumru's STORIES_STAGE.md §3): a story document becomes a Sahne script.
//
//   scene              → scene (the place id is the set id; `kerim` is her perch)
//   line               → line, text = tr after personalising, staging passed through unchanged
//   Kerim's narration  → line for the narrator inset, to: "viewer"
//   a stand-in line    → the reply card (a turn), then the line for nima; "…" with voice silent is the "…" card
//   beat               → beat
//   act                → act, whose result goes back like a choice; its reaction is a beat
//   spot               → overlay, with Kerim's staging
//   choice             → the reply card with its options; the picked line, its reactions and the reply become cues
//   looks              → the cast's starting clothes, the wardrobe, and `costume` on the scene, line or beat that changes them
//
// Translations (en, fa) never reach the stage: they stay in `info`, for the log and the card. The
// host's personalising runs on every text that reaches the stage: lines, link keys, sound words,
// prop labels and phone screens, an act's prompt, a spot's example and the display names.

import type { ActCue, AvatarDoc, Cue, LoadOptions, PlaceDoc, PuppetRef, Script, Staging, VoiceSpec } from "sahne";
import { lowerTr } from "sahne-tr";
import { isAct, isBeat, isChoice, isLine, isScene, isSpot, NARRATOR, STANDIN, type CharacterDoc, type ChoiceOption, type Gate, type LineStep, type BeatStep, type Step, type StoryDoc, type Text3 } from "./types.ts";
import { storyProps } from "./props.ts";
import { dressing } from "./looks.ts";

export interface AdaptOptions {
  places: Record<string, PlaceDoc>;
  characters: Record<string, CharacterDoc>;
  /** The learner's own avatar, which plays Nima; without one, Nima's own look. */
  learner?: AvatarDoc | null;
  /**
   * The host's personalising (Kumru's `personalizeStr`): the name and hometown tokens become the
   * learner's. It runs on the Turkish that reaches the stage and on the translations the host shows
   * (the card, the log), with `lang` saying which: the tokens are written differently per language
   * (`Nima`, `نیما`; `Tahran`, `Tehran`, `تهران`).
   */
  personalise?: (text: string, lang?: "tr" | "en" | "fa") => string;
  /** Flags set by earlier stories, for `if` / `unless` lines (Kumru's STORIES_SCHEMA.md §4.7). */
  flags?: Iterable<string>;
}

/** What the learner picked: a choice's option index, or the target an act ended on. */
export type Picks = Record<string, number | string>;

/** One option of the reply card: the Turkish line and its translations. */
export interface CardOption extends Text3 { ok?: boolean; tone?: string }

/** A card shown before its cue plays. */
export type Turn =
  | { kind: "say"; step: number; silent: boolean; options: [CardOption] }
  | { kind: "choice"; step: number; id: string; to?: string; options: CardOption[] }
  | { kind: "act"; step: number; id: string; act: ActCue["act"]; prompt?: Text3; to?: string };

/** What the host needs to know about a cue: the story step it came from, the line with its translations, and the card before it. */
export interface CueInfo {
  step: number;
  kind: "scene" | "line" | "say" | "beat" | "act" | "react" | "spot" | "reply";
  who?: string;
  tr?: string;
  en?: string;
  fa?: string;
  narr?: boolean;
  note?: { en?: string; fa?: string };
  turn?: Turn;
  /** The choice option a `say` or `reply` cue belongs to. */
  option?: number;
  /** A `reply` cue's index in its option's `reply` list (gated replies that were skipped still count). */
  reply?: number;
}

export interface Performance { script: Script; info: CueInfo[] }

export interface StoryStage {
  story: StoryDoc;
  /** Every card of the story, in order (on the paths the default picks take). */
  turns: Turn[];
  /** What `Stage.load` needs besides the script: the cast's avatars, the places with the story's props, the other branches' cues. */
  load: Pick<LoadOptions, "cast" | "wardrobe" | "places" | "extra" | "narrator" | "names" | "voices" | "tempo" | "terms">;
  /** The script for these picks (missing ones take option 0, or an act's expected target). */
  perform(picks?: Picks): Performance;
  /** The picks that perform() uses where `picks` says nothing. */
  defaults: Picks;
}

const STAGING = ["to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "of"] as const;

const passes = (g: Gate, flags: Set<string>) => (!g.if || flags.has(g.if)) && (!g.unless || !flags.has(g.unless));

/** Every string inside a value, personalised (a phone's screen may be an object of texts). */
function deep<T>(v: T, p: (s: string) => string): T {
  if (typeof v === "string") return p(v) as T;
  if (Array.isArray(v)) return v.map(x => deep(x, p)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x, p)])) as T;
  return v;
}

export function adaptStory(story: StoryDoc, o: AdaptOptions): StoryStage {
  const P = o.personalise ?? ((s: string) => s);
  const p = (s: string) => P(s, "tr");
  const flags = new Set(o.flags ?? []);
  const word = (k: string) => { const a = lowerTr(p(k)); return a !== k ? a : lowerTr(p(k[0].toUpperCase() + k.slice(1))); };

  /** The staging fields of a step, with the texts in them personalised. */
  function staging(s0: Staging): Staging {
    const s = s0 as Staging & Record<string, unknown>, out: Record<string, unknown> = {};
    for (const k of STAGING) if (s[k] !== undefined) out[k] = s[k];
    if (s.link) out.link = Object.fromEntries(Object.entries(s.link).map(([k, t]) => [word(k), t]));
    if (s.obj) out.obj = s.obj.map(op => (op.set ? { ...op, set: deep(op.set, p) } : op));
    if (s.sfx) out.sfx = deep(s.sfx, p);
    return out as Staging;
  }
  const t3 = (t: Text3): Text3 => ({ tr: p(t.tr), ...(t.en !== undefined ? { en: P(t.en, "en") } : {}), ...(t.fa !== undefined ? { fa: P(t.fa, "fa") } : {}) });
  const card = (op: ChoiceOption): CardOption => ({ ...t3(op), ...(op.ok ? { ok: true } : {}), ...(op.tone ? { tone: op.tone } : {}) });

  const defaults: Picks = {};
  for (const s of story.steps) {
    if (isChoice(s)) defaults[s.choice.id] = 0;
    if (isAct(s) && s.act.expect) defaults[s.act.id] = s.act.expect;
  }

  function perform(picks: Picks = {}): Performance {
    const cues: Cue[] = [], info: CueInfo[] = [];
    const push = (c: Cue, i: CueInfo) => { cues.push(c); info.push(i); };
    // the clothes a top-level step changes (looks.ts): not staging a story writes, so not in STAGING
    const worn = (step: number) => (dressed.changes[step] ? { costume: { ...dressed.changes[step] } } : {});
    const line = (l: LineStep | (ChoiceOption & { who: string }), step: number, kind: CueInfo["kind"], extra: Partial<CueInfo> = {}, top = false) => {
      const st: Staging = { ...staging(l), ...(top ? worn(step) : {}) };
      const narr = "narr" in l && l.narr === true;
      if (narr && !st.to) st.to = "viewer";
      push({ line: { who: l.who, text: p(l.tr), ...st } }, { step, kind, who: l.who, ...t3(l), ...(narr ? { narr } : {}), ...("note" in l && l.note ? { note: { ...(l.note.en !== undefined ? { en: P(l.note.en, "en") } : {}), ...(l.note.fa !== undefined ? { fa: P(l.note.fa, "fa") } : {}) } } : {}), ...extra });
    };
    const beat = (b: BeatStep, step: number, kind: CueInfo["kind"], extra: Partial<CueInfo> = {}, top = false) =>
      push({ beat: { ...staging(b.beat), ...(top ? worn(step) : {}), ...(b.beat.who ? { who: b.beat.who } : {}), ...(b.beat.wait !== undefined ? { wait: b.beat.wait } : {}) } }, { step, kind, ...(b.beat.who ? { who: b.beat.who } : {}), ...extra });

    story.steps.forEach((s: Step, step) => {
      if (!passes(s, flags)) return;
      if (isScene(s)) {
        push({ scene: { place: s.scene, at: { ...(s.at ?? {}) }, ...(s.time ? { time: s.time } : {}), ...(s.weather ? { weather: s.weather } : {}), ...(s.state ? { state: s.state } : {}), ...(s.kerim ? { perch: s.kerim } : {}), ...(s.stop ? { stop: s.stop } : {}), ...worn(step) } }, { step, kind: "scene" });
      } else if (isLine(s)) {
        if (s.who === STANDIN) {
          const silent = s.voice === "silent";
          line(s, step, "say", { turn: { kind: "say", step, silent, options: [t3(s)] } }, true);
        } else line(s, step, "line", {}, true);
      } else if (isBeat(s)) beat(s, step, "beat", {}, true);
      else if (isSpot(s)) {
        const { lesson, ex, show, tr } = s.spot;
        push({ overlay: { kind: show ?? "spot", lesson, ex: p(ex), ...(tr ? { tr: p(tr) } : {}), who: NARRATOR, ...staging(s.spot) } },
          { step, kind: "spot", who: NARRATOR, ...(tr ? { tr: p(tr) } : { tr: p(ex) }), ...(s.spot.en !== undefined ? { en: P(s.spot.en, "en") } : {}), ...(s.spot.fa !== undefined ? { fa: P(s.spot.fa, "fa") } : {}) });
      } else if (isChoice(s)) {
        const c = s.choice, k = Math.min(Math.max(0, Number(picks[c.id] ?? 0) | 0), c.options.length - 1), op = c.options[k];
        const turn: Turn = { kind: "choice", step, id: c.id, ...(c.to ? { to: c.to } : {}), options: c.options.map(card) };
        line({ ...op, who: STANDIN }, step, "say", { turn, option: k });
        (op.reply ?? []).forEach((r, j) => {
          if (!passes(r, flags)) return;
          if (isBeat(r)) beat(r, step, "reply", { option: k, reply: j });
          else line(r, step, "reply", { option: k, reply: j });
        });
      } else if (isAct(s)) {
        const a = s.act;
        const cue = { kind: a.kind, targets: [...a.targets], ...(a.expect ? { expect: a.expect } : {}), ...(a.prompt ? { prompt: p(a.prompt.tr) } : {}),
          // the learner's actor does it, the one who asked hints and shows; a drag moves `item`
          who: STANDIN, ...(a.to ? { by: a.to } : {}), ...(a.item ? { obj: a.item } : {}) } as ActCue["act"];
        const turn: Turn = { kind: "act", step, id: a.id, act: cue, ...(a.prompt ? { prompt: t3(a.prompt) } : {}), ...(a.to ? { to: a.to } : {}) };
        push({ act: cue }, { step, kind: "act", ...(a.to ? { who: a.to } : {}), ...(a.prompt ? t3(a.prompt) : {}), turn });
        const got = picks[a.id] ?? a.expect;
        const react = !a.expect || got === a.expect ? a.react?.ok : a.react?.other;
        if (react && Object.keys(react).length) push({ beat: { react: { ...react } } }, { step, kind: "react" });
      }
    });
    return { script: { v: 1, cues }, info };
  }

  // the cast: Nima is the learner (or Nima's own look); everyone else their character document. A character
  // with a `puppet` is the kit's puppet (Kerim on stage); Kerim without one is only the narrator inset.
  const ids = new Set<string>([...story.cast, ...(story.extras ?? [])]);
  for (const s of story.steps) if (isScene(s)) for (const id of Object.keys(s.at ?? {})) ids.add(id);
  const avatars: Record<string, AvatarDoc> = {}, puppets: Record<string, PuppetRef> = {}, names: Record<string, string> = {}, voices: Record<string, VoiceSpec> = {}, tempo: Record<string, number> = {}, terms: Record<string, string[]> = {};
  for (const id of [...ids, NARRATOR]) {
    const ch = o.characters[id];
    if (ch) {
      names[id] = p(story.names?.[id] ?? ch.name);
      if (ch.voice && (ch.voice.rate !== undefined || ch.voice.pitch !== undefined)) voices[id] = { ...(ch.voice.rate !== undefined ? { rate: ch.voice.rate } : {}), ...(ch.voice.pitch !== undefined ? { pitch: ch.voice.pitch } : {}) } as VoiceSpec;
      if (ch.motion?.tempo !== undefined) tempo[id] = ch.motion.tempo;
      if (ch.terms?.length) terms[id] = [...ch.terms];
      if (ch.puppet) { puppets[id] = { puppet: ch.puppet }; continue; }
    }
    if (id === NARRATOR) continue;
    const doc = id === STANDIN ? o.learner ?? ch?.avatar : ch?.avatar;
    if (doc) avatars[id] = doc;
  }
  // what they wear: the story's looks dress the cast, the later ones are the wardrobe the cues' `costume` names
  const dressed = dressing(story, avatars, o.characters, s => passes(s, flags));
  const cast: Record<string, AvatarDoc | PuppetRef> = { ...avatars, ...dressed.base, ...puppets };

  // the places the story visits, each with the story's own props that stand there (kept from place to place), their labels personalised
  const places: Record<string, PlaceDoc> = {};
  for (const id of new Set([story.place, ...story.steps.filter(isScene).map(s => s.scene)])) {
    const pl = o.places[id];
    if (!pl) continue;
    const props = { ...(pl.props ?? {}), ...storyProps(story, id) };
    places[id] = { ...pl, props: Object.fromEntries(Object.entries(props).map(([k, ref]) => [k, Object.fromEntries(Object.entries(ref).map(([f, v]) => [f, f === "kit" || f === "terms" || f === "at" || f === "keep" ? v : deep(v, p)]))])) as PlaceDoc["props"] };
  }

  // every other option and act result, so the stage builds the art a branch needs
  const base = perform(defaults);
  const turns = base.info.flatMap(i => (i.turn ? [i.turn] : []));
  const extra: { at: number; cues: Cue[] }[] = [];
  base.info.forEach((i, at) => {
    const t = i.turn;
    if (!t || t.kind === "say") return;
    const alts: (number | string)[] = t.kind === "choice" ? t.options.map((_, k) => k).filter(k => k !== defaults[t.id]) : t.act.targets.filter(x => x !== defaults[t.id]).slice(0, 1);
    for (const alt of alts) extra.push({ at, cues: perform({ ...defaults, [t.id]: alt }).script.cues.slice(at) });
  });

  return { story, turns, defaults, perform, load: { cast, wardrobe: dressed.wardrobe, places, extra, narrator: NARRATOR, names, voices, tempo, terms } };
}
