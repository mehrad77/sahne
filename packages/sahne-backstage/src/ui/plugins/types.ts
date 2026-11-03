// The editor half of a story plugin (sahne-story src/plugin.ts is the story half): what a plugin adds to backstage's pages.
// A series turns a plugin on by name in series.json; `editorPluginsOf` (./index.ts) gives the editor halves of the ones on.

import type { Languages, StoryDoc } from "sahne-story";
import type { Path } from "../../model/path.ts";
import type { Problem } from "../../api.ts";

/** What a plugin's part of the episode page gets: the story, how it was saved, and the page's edit. */
export interface EpisodeProps { story: StoryDoc; saved: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void }

/** A step kind of the plugin's, in the script: its name in the insert menu, the step it inserts, and its block. */
export interface EditorBlock {
  /** The step's key (`spot`), as the story plugin's `PluginStep.key`. */
  kind: string;
  /** The insert menu's name and what it does: ["Grammar point", "the narrator explains a line"]. */
  name: [string, string];
  /** A new step of this kind, in the series' languages. */
  template(o: { story: StoryDoc; langs: Languages }): unknown;
  /** The block's body (beside its gutter): `path` is the step, `keys` the script's keys for its main field, `translations`
   * the script's rows for the texts at a path in each translation (with their checked marks). */
  View(p: EpisodeProps & { path: Path; keys(e: KeyboardEvent): void; translations(at: Path): unknown }): unknown;
}

/** What a plugin adds to the new-episode page: one step of fields, and what they put in the brief. */
export interface NewEpisodeStep {
  /** The step's heading: "What it teaches". */
  title: string;
  /** The fields; `value` is the plugin's part of the brief, kept by the page. */
  View(p: { value: Record<string, unknown>; onChange(v: Record<string, unknown>): void; kind: "episode" | "special" }): unknown;
  /** A word for the page's ready line when the brief would not pass the check yet ("5–8 target words"), or null. */
  wants?(value: Record<string, unknown>, kind: "episode" | "special"): string | null;
}

export interface EditorPlugin {
  /** The story plugin's id. */
  id: string;
  /** A row in the episode's head: what the episode teaches, at a glance. */
  Head?(p: EpisodeProps): unknown;
  /** Its fields in the episode's Brief: what the series asks of an episode beyond the core's (the target words, the lessons). */
  Brief?(p: EpisodeProps): unknown;
  /** Its own part of the episode: the view of its stage. */
  Sections?(p: EpisodeProps): unknown;
  /** Its own stage of the work, between Translate and Review: its name, and where the episode stands in it (its own
   * problems carry its id: `Problem.plugin`). The stage shows `Sections`. */
  stage?: { key: string; name: string; state(p: { story: StoryDoc; problems: Problem[] }): { done: boolean; state: string } };
  /** Its step kinds in the script. */
  blocks?: EditorBlock[];
  /** A line's own fields in its details: the learner's note. */
  LineFields?(p: EpisodeProps & { path: Path }): unknown;
  /** Its step on the new-episode page. */
  newEpisode?: NewEpisodeStep;
  /** What it calls the viewer, who speaks as the stand-in in an interactive episode: "the learner". */
  viewer?: string;
}
