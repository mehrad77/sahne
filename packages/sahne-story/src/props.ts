// The story's own props (Kumru's STORIES_SCHEMA.md §3), place by place. A prop whose `at` is a point or a
// mark stands in the story's opening place; one whose `at` is a map of place id → point or mark
// stands in each of those places, as one thing (`keep`): its count, showing and parameters go with
// it from place to place (DESIGN.md §5.5).

import type { PropRef } from "sahne";
import type { PropAt, StoryDoc, StoryProp } from "./types.ts";

/** A point or a mark, not a map of places. */
export const isAt = (at: StoryProp["at"]): at is PropAt => typeof at === "string" || typeof (at as { x?: unknown }).x === "number";

/** Where a story prop stands, place by place. */
export const placesOf = (story: StoryDoc, prop: StoryProp): Record<string, PropAt> => (isAt(prop.at) ? { [story.place]: prop.at } : prop.at);

/** The story props that stand in `place`, with `at` resolved and `keep` set. */
export function storyProps(story: StoryDoc, place: string): Record<string, PropRef> {
  const out: Record<string, PropRef> = {};
  for (const [id, p] of Object.entries(story.props ?? {})) {
    const at = placesOf(story, p)[place];
    if (at !== undefined) out[id] = { ...p, at, keep: true };
  }
  return out;
}
