// An agent asked to look at the stage (server/look.ts): this editor draws the frame, if it is in view (a hidden page draws
// nothing), and posts it back once. The episode is drawn as the agent would edit it (the document comes with the ask, its
// pending proposal included), at the step asked, part way through it; a place as its wide shot.

import { adaptStory, languagesOf, type StoryDoc, type StoryPlace } from "sahne-story";
import type { AvatarDoc, PlaceDoc, PuppetRef } from "sahne";
import { cueOf, type Path } from "./model/path.ts";
import { drawNow, type Scene } from "./thumbs.ts";
import { world } from "./store.ts";

export interface LookAsk { rid: string; kind: "story" | "place"; id: string; doc: unknown; step?: Path; at?: number }

/** The scene an ask shows. */
function sceneOf(a: LookAsk): Scene | null {
  const w = world.value;
  if (!w) return null;
  if (a.kind === "place") {
    const doc = a.doc as PlaceDoc & { times?: string[] };
    return { place: doc, cues: [{ scene: { place: doc.id, time: doc.times?.[0] ?? "day", at: {}, cam: "wide" } }], cast: {} };
  }
  const adapted = adaptStory(a.doc as StoryDoc, { places: w.places as Record<string, StoryPlace>, characters: w.characters, languages: languagesOf(w.series) });
  const perf = adapted.perform();
  if (!perf.script.cues.length) return null;
  const i = a.step ? Math.max(0, cueOf(perf.info, a.step)) : 0;
  return { cues: perf.script.cues.slice(0, i + 1), cast: (adapted.load.cast ?? {}) as Record<string, AvatarDoc | PuppetRef>, load: adapted.load, play: { cue: i, at: a.at ?? 0.4 } };
}

/** Answer an ask, when this page is the one in view. */
export async function answerLook(a: LookAsk): Promise<void> {
  if (document.visibilityState !== "visible") return;
  let image: string | null = null;
  try { const s = sceneOf(a); image = s ? await drawNow(s) : null; } catch (e) { console.warn(`backstage look: ${(e as Error).message}`); }
  if (!image) return;
  await fetch(`/api/look/${a.rid}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) }).catch(() => {});
}
