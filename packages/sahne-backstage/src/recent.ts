// The scene last worked on, for the home (ui/home.ts): the episode, the cue on the stage and a picture of the stage as it
// was then (its next frame, at the pictures' size: thumbs.ts), kept in this browser once the cue has stayed a moment. The
// home's Continue asks the episode to open at that cue.

import type { Preview } from "./stage.ts";
import { THUMB } from "./thumbs.ts";

export interface Recent { id: string; cue: number; picture?: string; at: number }
const KEY = "backstage-recent";

export function recent(): Recent | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null") as Recent | null; } catch { return null; }
}
const keep = (r: Recent) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* full, or a private window */ } };

let timer: ReturnType<typeof setTimeout> | undefined, latest = "";
/** The stage's next frame, covering the pictures' size (a WebGL canvas keeps nothing after a frame, so it is read in the frame hook). */
function grab(pv: Preview, host: HTMLElement): Promise<string | null> {
  return new Promise(res => {
    const timer = setTimeout(() => { off(); res(null); }, 2000);
    const off = pv.stage.onFrame(() => {
      off(); clearTimeout(timer);
      const src = host.querySelector("canvas");
      if (!src?.width) return res(null);
      const out = Object.assign(document.createElement("canvas"), { width: THUMB.w, height: THUMB.h });
      const k = Math.max(THUMB.w / src.width, THUMB.h / src.height), w = src.width * k, h = src.height * k;
      out.getContext("2d")?.drawImage(src, (THUMB.w - w) / 2, (THUMB.h - h) / 2, w, h);
      res(out.toDataURL("image/webp", 0.8));
    });
    pv.stage.poke();
  });
}

/** The stage in `host` shows cue `cue` of episode `id`: kept, with a picture of it, once it has stayed a moment. */
export function rememberScene(id: string, cue: number, pv: Preview, host: HTMLElement) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const was = recent(), at = Date.now();
    latest = `${id}|${cue}`;
    keep({ id, cue, at, picture: was?.id === id && was.cue === cue ? was.picture : undefined });
    void grab(pv, host).then(picture => { if (picture && latest === `${id}|${cue}`) keep({ id, cue, at, picture }); });
  }, 800);
}

let resume: { id: string; cue: number } | null = null;
/** Open episode `id` at `cue` next time its page opens (the home's Continue). */
export const resumeAt = (id: string, cue: number) => { resume = { id, cue }; };
/** The cue episode `id` should open at, once. */
export function takeResume(id: string): number | null {
  const r = resume;
  resume = null;
  return r?.id === id ? r.cue : null;
}
