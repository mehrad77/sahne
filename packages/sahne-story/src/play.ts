// How an episode plays: `interactive`, where the viewer answers, says their lines, chooses and acts, and the story waits for
// them; or `watch`, where it plays on time alone, with no taps, cards or choices, and the viewer only watches. A story's own
// `play` wins, then its series' default (`series.json` `play`), then interactive.

import type { SeriesDoc, StoryDoc } from "./types.ts";

export type PlayMode = "interactive" | "watch";
export const PLAY_MODES: readonly PlayMode[] = ["interactive", "watch"];

/** How a story plays in its series. */
export const playOf = (story: Pick<StoryDoc, "play"> | null | undefined, series?: Pick<SeriesDoc, "play"> | null): PlayMode =>
  story?.play ?? series?.play ?? "interactive";

/** The arc mechanics that need the viewer (an answer, a tap, their voice): none of them in a watch-only episode. */
export const INTERACTIVE_MECHANICS = ["say", "act", "explore", "aloud"] as const;
