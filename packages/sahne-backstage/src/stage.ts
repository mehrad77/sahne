// The stage an episode plays on in backstage: the whole kit (every set family), Kerim's puppet and the animals', the
// language plugins (Turkish, English, German, Persian; a preview takes its series' main language's), the kit's sounds, the interaction layer (acts, explore, picking) and prop text; Kerim's round window for
// the narrator. `Preview` keeps one stage and a story player over it, and follows the document as it is edited: a change
// to words re-directs the cues (`player.replace`, no reload), anything else adapts and loads again; either way the stage
// goes back to the cue that was showing.

import { interact, mountStage, placeSolids, propText, type Interaction, type LangPlugin, type Kit, type Solid, type Stage } from "sahne";
import full from "sahne-kit/full";
import { puppets as kerimPuppets } from "sahne-kit/kerim";
import { puppets as animals } from "sahne-kit/puppets";
import { K_BUST, K_HEAD, K_HEAD_VB } from "sahne-kit/kerim/art";
import { kerimOnTalk, kerimPortrait } from "sahne-kit/kerim/portrait";
import de from "sahne-de";
import en from "sahne-en";
import fa from "sahne-fa";
import tr from "sahne-tr";
import { world } from "./store.ts";
import { adaptStory, languagesOf, storyPlayer, type CharacterDoc, type Languages, type StoryDoc, type StoryPlace, type StoryPlayer, type StoryStage } from "sahne-story";

export const KIT: Kit = { ...full, puppets: { ...full.puppets, ...kerimPuppets, ...animals } };
/** The language plugins, by the code of a series' main language. */
export const PLUGINS: Record<string, LangPlugin> = { tr, en, de, fa };
/** The plugin of a series' main language: Turkish when none is named (the samples' default); none for a language without a plugin. */
export const langPlugin = (main?: string): LangPlugin | undefined => PLUGINS[main ?? "tr"];
/** The plugin of the open series' main language, for the shared stages (live previews, thumbnails, the place stage). */
export const seriesLang = (): LangPlugin | undefined => langPlugin(languagesOf(world.value?.series).main);
/** Where the kit's recordings are served. */
export const SOUNDS = new URL("/sounds/", location.href).href;

const solidCache = new Map<string, Solid[]>();
/** Each place's solids (the walk routes the lints check), cached by its pieces. */
export function solidsOf(places: Record<string, StoryPlace>): Record<string, Solid[]> {
  return Object.fromEntries(Object.entries(places).map(([id, p]) => {
    const k = `${id}:${JSON.stringify(p.pieces ?? [])}`;
    let s = solidCache.get(k);
    if (!s) { s = placeSolids(p, KIT); solidCache.set(k, s); }
    return [id, s];
  }));
}

export interface PreviewOptions {
  places: Record<string, StoryPlace>;
  characters: Record<string, CharacterDoc>;
  flags?: string[];
  /** The series' languages: the main one is what the stage plays. */
  languages?: Languages;
  onChange?(): void;
}

export class Preview {
  readonly stage: Stage;
  readonly ix: Interaction;
  readonly kerim: HTMLElement;
  adapted!: StoryStage;
  player!: StoryPlayer;
  private o: PreviewOptions;
  private story!: StoryDoc;

  constructor(el: HTMLElement, story: StoryDoc, o: PreviewOptions) {
    this.o = o;
    this.stage = mountStage(el, { kit: KIT, lang: langPlugin(o.languages?.main), sounds: SOUNDS, bubbles: true, motion: "full" });
    this.ix = interact(this.stage, { explore: true });
    propText(this.stage);
    this.kerim = kerimPortrait({ vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD });
    this.load(story);
  }

  private adapt(story: StoryDoc) { return adaptStory(story, { places: this.o.places, characters: this.o.characters, flags: this.o.flags, languages: this.o.languages }); }

  /** Adapt and load the story, at its opening scene. */
  load(story: StoryDoc) {
    this.story = story;
    this.adapted = this.adapt(story);
    const p: StoryPlayer = storyPlayer(this.stage, this.adapted, {
      loadOptions: { narratorEl: this.kerim, onNarratorTalk: kerimOnTalk(this.kerim), narratorSound: "coo" },
      onChange: () => { if (this.player === p) this.o.onChange?.(); },
    });
    this.player = p;
  }

  /** Follow an edit of the story: `words` when only texts changed (re-direct), else a full load; back to `cue`. */
  update(story: StoryDoc, cue: number, words: boolean) {
    if (words && this.story) {
      try {
        this.story = story;
        this.adapted = this.adapt(story);
        this.player.replace(this.adapted);
        this.player.jump(Math.min(cue, this.player.info.length - 1));
        return;
      } catch { /* the art it needs is not loaded: load again */ }
    }
    this.load(story);
    this.player.jump(Math.max(0, Math.min(cue, this.player.info.length - 1)));
  }

  /** Other flags: a gated step comes or goes, so the story is adapted and loaded again. */
  setFlags(flags: string[], cue: number) {
    this.o = { ...this.o, flags };
    this.load(this.story);
    this.player.jump(Math.max(0, Math.min(cue, this.player.info.length - 1)));
  }

  /** New documents of the world (a character's look, a place). */
  setWorld(places: Record<string, StoryPlace>, characters: Record<string, CharacterDoc>) { this.o = { ...this.o, places, characters }; }

  destroy() { this.stage.destroy(); }
}
