// The kit every gallery stage plays with: the whole kit (every set family, `sahne-kit/full`),
// Kerim's puppet and the animals' (Pisi, the gulls), with the Turkish plugin, and the content root's own kit items (kit/,
// sahne-story/paths.ts) once `addContentKit` has run (app.ts, before the first view).

import type { Kit } from "sahne";
import full from "sahne-kit/full";
import { puppets as kerim } from "sahne-kit/kerim";
import { puppets as animals } from "sahne-kit/puppets";
import tr from "sahne-tr";
import { data } from "./data.ts";

export const KIT: Kit = { ...full, puppets: { ...full.puppets, ...kerim, ...animals } };
export const LANG = tr;

/** Adds the content root's drawn kit items to `KIT` (in place, so every holder of it sees them). Nothing to do without any. */
export async function addContentKit(): Promise<void> {
  try {
    const docs = await data("kit");
    if (!docs.length) return;
    const { withDrawings } = await import("sahne-kit/drawing");
    Object.assign(KIT, withDrawings(KIT, docs));
  } catch (e) { console.warn(`the content root's kit items are not on the stage: ${(e as Error).message}`); }
}
