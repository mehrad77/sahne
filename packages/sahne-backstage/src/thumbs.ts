// Pictures the stage draws once and the galleries keep: a place's wide shot, a gesture at its stroke, a step of an
// episode (the storyboard). One hidden stage (on screen, invisible: a stage draws only while visible) takes each job in
// turn, draws its frame and keeps it as an image in IndexedDB under a key that changes with what it shows, so it is drawn
// again only when that changes. A browser without IndexedDB (or one that refuses it) still draws, every time.

import { hashString, mountStage, type AvatarDoc, type Cue, type LoadOptions, type PlaceDoc, type PuppetRef, type Run, type Stage } from "sahne";
import { KIT, LANG } from "./stage.ts";

const W = 360, H = 225, DB = "sahne-backstage-thumbs", STORE = "thumbs";

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
  return new Promise(res => { try { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); } });
}
async function put(key: string, url: string) {
  try { (await db())?.transaction(STORE, "readwrite").objectStore(STORE).put(url, key); } catch { /* full or refused: drawn again next time */ }
}

/** What a picture shows: a place, its cues (the last shown, or `at` of the way through `play`), the cast. */
export interface Scene { place?: PlaceDoc; places?: Record<string, PlaceDoc>; cues: Cue[]; cast: Record<string, AvatarDoc | PuppetRef>; names?: Record<string, string>; play?: { cue: number; at: number }; /** The rest of what `load` takes (an episode's wardrobe, props, narrator). */ load?: Partial<LoadOptions> }
interface Job { key: string; scene: () => Scene; done: (url: string | null) => void }
const queue: Job[] = [];
let stage: Stage | null = null, host: HTMLElement | null = null, busy = false;
const memo = new Map<string, Promise<string | null>>();

/** A scene's picture as an image URL: kept, else drawn when the stage gets to it (null when it cannot be drawn). */
export function snapshot(key: string, scene: () => Scene): Promise<string | null> {
  let p = memo.get(key);
  if (!p) {
    p = get(key).then(hit => hit ?? new Promise<string | null>(done => { queue.push({ key, scene, done }); void pump(); }));
    memo.set(key, p);
  }
  return p;
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    if (!stage) {
      host = Object.assign(document.createElement("div"), { ariaHidden: "true" });
      Object.assign(host.style, { position: "fixed", left: "0", bottom: "0", width: `${W}px`, height: `${H}px`, opacity: "0", pointerEvents: "none", zIndex: "-1" });
      document.body.append(host);
      stage = mountStage(host, { kit: KIT, lang: LANG, bubbles: false, motion: "full", maxDpr: 1 });
    }
    // one picture at a time, when the page is idle: a long episode's strip never holds up typing
    await new Promise<void>(r => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 30)));
    let url: string | null = null;
    try { url = await bake(stage, job.scene()); } catch (e) { console.warn(`backstage thumb: ${(e as Error).message}`); }
    if (url) void put(job.key, url);
    else memo.delete(job.key);
    job.done(url);
  }
  busy = false;
}

function bake(st: Stage, s: Scene): Promise<string | null> {
  st.load({ v: 1, cues: s.cues }, { ...s.load, cast: s.cast, places: s.places ?? (s.place ? { [s.place.id]: s.place } : s.load?.places ?? {}), ...(s.names ? { names: s.names } : {}) });
  if (s.play) {
    st.show(Math.max(0, s.play.cue - 1));
    const run = st.play(s.play.cue) as Run;
    run.pause();
    run.seek(run.dur * s.play.at);
  } else st.show(s.cues.length - 1);
  // the frame is read in the stage's own frame hook, right after it is drawn (a WebGL canvas keeps nothing after)
  return new Promise(res => {
    const timer = setTimeout(() => { off(); res(null); }, 5000);
    const off = st.onFrame(() => {
      off(); clearTimeout(timer);
      res((host!.querySelector("canvas") as HTMLCanvasElement).toDataURL("image/webp", 0.8));
    });
    st.poke();
  });
}

/** A place's wide shot at its first time. */
export const placeThumb = (doc: PlaceDoc & { times?: string[] }) =>
  snapshot(`place|${hashString(JSON.stringify(doc))}`, () => ({ place: doc, cues: [{ scene: { place: doc.id, time: doc.times?.[0] ?? "day", at: {}, cam: "wide" } }], cast: {} }));

/** The end of cue `i` of an episode's performance (the storyboard): kept by everything up to it, so an edit later on keeps it. */
export const cueThumb = (cues: Cue[], i: number, load: Partial<LoadOptions>) => {
  const upTo = cues.slice(0, i + 1);
  return snapshot(`cue|${hashString(JSON.stringify(upTo))}|${hashString(JSON.stringify([load.cast, load.wardrobe, load.places]))}`, () => ({ cues: upTo, cast: (load.cast ?? {}) as Record<string, AvatarDoc | PuppetRef>, load }));
};

/** An empty room a gesture is shown in. */
const ROOM: PlaceDoc = { v: 1, id: "backstage_room", size: { w: 5, d: 3 }, pieces: [], marks: { a: { x: 0, z: 0 } } } as unknown as PlaceDoc;

/** A gesture done by `doc`, at its stroke, the whole figure. */
export const gestureThumb = (gesture: string, doc: AvatarDoc) =>
  snapshot(`gesture2|${gesture}|${hashString(JSON.stringify(doc))}`, () => ({
    place: ROOM, cast: { a: doc },
    cues: [{ scene: { place: ROOM.id, at: { a: "a" }, cam: "wide" } }, { line: { who: "a", text: "…", do: gesture, cam: "wide", voice: "mouthing" } }],
    play: { cue: 1, at: Math.min(0.9, (KIT.gestures[gesture]?.stroke ?? 600) / Math.max(1, KIT.gestures[gesture]?.dur ?? 1200)) },
  }));
