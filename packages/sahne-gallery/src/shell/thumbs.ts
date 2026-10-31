// Thumbnails of set pieces and props drawn by the stage itself, so a piece built in depth (a road, a
// carriage) looks as it does in a place, not as flat SVG. One hidden stage stages each piece alone
// (kit/solo.ts), renders it and keeps the frame as an image; images are kept in IndexedDB, keyed by the
// generator's drawing code and params, so they are baked once and again only when the code changes.

import { hashString, type AvatarDoc, type Cue, type PlaceDoc, type PuppetRef, type Stage } from "sahne";
import type { Ctx } from "./ctx.ts";
import { solo, type SoloOptions } from "../kit/solo.ts";
import type { Gen } from "../kit/catalog.ts";

const W = 360, H = 240, DB = "sahne-gallery-thumbs", STORE = "thumbs";

let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  return dbp ??= new Promise(res => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function get(key: string): Promise<string | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise(res => { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
}
async function put(key: string, url: string) {
  const d = await db();
  d?.transaction(STORE, "readwrite").objectStore(STORE).put(url, key);
}
/** Forgets every baked thumbnail. */
export async function clearThumbs() { const d = await db(); d?.transaction(STORE, "readwrite").objectStore(STORE).clear(); }

const keyOf = (gen: Gen, o: SoloOptions) => `${gen.id}|${hashString(gen.def.draw.toString() + JSON.stringify(gen.meta ?? {}))}|${JSON.stringify(o)}`;

/** What a thumbnail shows: a place, the cues to its end, the cast. */
export interface Scene { place: PlaceDoc; cues: Cue[]; cast: Record<string, AvatarDoc | PuppetRef> }
interface Job { key: string; label: string; scene: () => Scene; done: (url: string | null) => void }
const queue: Job[] = [];
let stage: Stage | null = null, host: HTMLElement | null = null, busy = false;

/** A piece's thumbnail as an image URL: from the cache, else baked when the stage gets to it (null if it can't be drawn). */
export const thumb = (ctx: Ctx, gen: Gen, o: SoloOptions) => snapshot(ctx, keyOf(gen, o), gen.id, () => solo(gen, o));

/** Any scene's thumbnail: a place's wide shot (the board), cached under `key` (make it change with what it shows). */
export async function snapshot(ctx: Ctx, key: string, label: string, scene: () => Scene): Promise<string | null> {
  const hit = await get(key);
  if (hit) return hit;
  return new Promise(done => { queue.push({ key, label, scene, done }); pump(ctx); });
}
/** Drops the jobs not started (the view changed). */
export function cancelThumbs() { for (const j of queue.splice(0)) j.done(null); }

async function pump(ctx: Ctx) {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    if (!stage) {
      // out of the way but on screen: a stage draws only while it is visible
      host = Object.assign(document.createElement("div"), { ariaHidden: "true" });
      Object.assign(host.style, { position: "fixed", left: "0", bottom: "0", width: `${W}px`, height: `${H}px`, opacity: "0", pointerEvents: "none", zIndex: "-1" });
      document.body.append(host);
      // the baker lives as long as the page, beside the views' stages (not freed on a route change)
      const { mountStage } = await import("sahne");
      stage = mountStage(host, { kit: ctx.kit, bubbles: false, motion: "still", maxDpr: 1 });
    }
    let url: string | null = null;
    try { url = await bake(stage, job.scene()); } catch (e) { console.warn(`thumb ${job.label}: ${(e as Error).message}`); }
    if (url) put(job.key, url);
    job.done(url);
  }
  busy = false;
}

function bake(st: Stage, { place, cues, cast }: Scene): Promise<string | null> {
  st.load({ v: 1, cues }, { cast, places: { [place.id]: place } });
  st.show(cues.length - 1);
  // the frame is read in the stage's own frame hook, right after it is drawn (a WebGL canvas keeps nothing after)
  return new Promise(res => {
    const timer = setTimeout(() => { off(); res(null); }, 4000);
    const off = st.onFrame(() => {
      off(); clearTimeout(timer);
      res((host!.querySelector("canvas") as HTMLCanvasElement).toDataURL("image/webp", 0.82));
    });
    st.poke();
  });
}
