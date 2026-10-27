// The animal puppets (DESIGN.md §5.4): Pisi the street cat on sahne's cat rig (rig/cat.ts) and the gulls on its bird rig
// (rig/bird.ts), built in code like Kerim's (sahne-kit/kerim). Not in the kit's index, so a page that casts no animal never
// loads them: it imports `sahne-kit/puppets` and adds `puppets` to its kit ({ ...kit, puppets: { ...kerim, ...puppets } }),
// and a cast entry `{ puppet: "cat" }` is Pisi, `{ puppet: "gull" }` a gull.

import { cat } from "./cat.ts";
import { gull } from "./gull.ts";

export { cat, CAT_RIG, CAT_MOODS, CAT_EMO, CAT_GESTURES } from "./cat.ts";
export { gull, GULL_RIG, GULL_MOODS, GULL_EMO, GULL_GESTURES } from "./gull.ts";

/** For a kit's `puppets`: a cast entry `{ puppet: "cat" }` is Pisi, `{ puppet: "gull" }` a gull. */
export const puppets = { cat, gull };
