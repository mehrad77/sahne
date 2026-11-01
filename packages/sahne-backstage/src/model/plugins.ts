// The story plugins backstage knows (sahne-story src/plugin.ts): a series turns on the ones its series.json names. The
// editor adapts and the server checks every story with the series' own.

import { lesson } from "sahne-lesson";
import { pluginsOf, type SeriesDoc, type StoryPlugin } from "sahne-story";

export const STORY_PLUGINS: readonly StoryPlugin[] = [lesson];

/** The plugins a series turns on, of those backstage knows. */
export const storyPluginsOf = (series: SeriesDoc | null | undefined): StoryPlugin[] => pluginsOf(series, STORY_PLUGINS);
