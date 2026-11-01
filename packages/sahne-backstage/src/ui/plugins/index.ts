// The editor halves of the story plugins backstage knows (model/plugins.ts has their story halves). A series turns a
// plugin on by name in series.json; the pages ask `editorPluginsOf` for the ones on.

import type { SeriesDoc } from "sahne-story";
import { storyPluginsOf } from "../../model/plugins.ts";
import { lessonEditor } from "./lesson.ts";
import type { EditorBlock, EditorPlugin } from "./types.ts";

export type { EditorBlock, EditorPlugin, EpisodeProps, NewEpisodeStep } from "./types.ts";

export const EDITOR_PLUGINS: readonly EditorPlugin[] = [lessonEditor];

/** The editor halves of the plugins a series turns on. */
export const editorPluginsOf = (series: SeriesDoc | null | undefined): EditorPlugin[] =>
  storyPluginsOf(series).flatMap(sp => EDITOR_PLUGINS.filter(ep => ep.id === sp.id));

/** The plugin block of a step kind, if a plugin the series turns on has one. */
export const pluginBlockOf = (series: SeriesDoc | null | undefined, kind: string): EditorBlock | undefined =>
  editorPluginsOf(series).flatMap(ep => ep.blocks ?? []).find(b => b.kind === kind);
