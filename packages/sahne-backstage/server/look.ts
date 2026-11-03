// Pictures of the stage for an agent (`look`, Node only). The stage draws only in a browser, so the server asks the open
// editors (a `look` event with a one-time request id and the document to draw, the agent's own pending proposal included)
// and waits: the first visible editor that draws it posts the picture back (`POST /api/look/<rid>`). A request id is
// answered once; an unknown or answered one is refused. With no visible editor, nothing answers and the wait ends.
// An agent on stdio (`cli.ts mcp --backstage`) asks the running backstage the same way and waits on `GET /api/look/<rid>`.

import { randomBytes } from "node:crypto";
import type { Events } from "./events.ts";

/** What an editor is asked to draw. */
export interface LookAsk { rid: string; kind: "story" | "place"; id: string; doc: unknown; step?: (string | number)[]; at?: number }
/** How long an agent waits for a picture, in ms. */
export const LOOK_WAIT = 20_000;
/** The largest picture taken, in bytes of base64. */
export const LOOK_MAX = 3_000_000;

/** One process's open requests. */
export class Looks {
  private open = new Map<string, { done: (png: Buffer | null) => void; promise: Promise<Buffer | null> }>();

  /** Open a request (its id given, or a new one) and wait up to `ms` for its picture: null when none comes. */
  wait(rid: string = randomBytes(8).toString("hex"), ms = LOOK_WAIT): { rid: string; picture: Promise<Buffer | null> } {
    const had = this.open.get(rid);
    if (had) return { rid, picture: had.promise };
    let done!: (png: Buffer | null) => void;
    const promise = new Promise<Buffer | null>(r => { done = r; });
    const timer = setTimeout(() => this.answer(rid, null), ms);
    timer.unref?.();
    this.open.set(rid, { done: png => { clearTimeout(timer); done(png); }, promise });
    return { rid, picture: promise };
  }

  /** An editor's picture for a request (a PNG data URL or base64): false when the id is unknown or answered already. */
  answer(rid: string, image: string | null): boolean {
    const o = this.open.get(rid);
    if (!o) return false;
    this.open.delete(rid);
    const b64 = image ? image.replace(/^data:image\/png;base64,/, "") : "";
    o.done(b64 && b64.length <= LOOK_MAX && /^[A-Za-z0-9+/=]+$/.test(b64) ? Buffer.from(b64, "base64") : null);
    return true;
  }

  isOpen(rid: string): boolean { return this.open.has(rid); }
}

const all = new WeakMap<Events, Looks>();
/** The process's requests: one per event bus, as for proposals. */
export function looksOf(events: Events): Looks {
  let l = all.get(events);
  if (!l) { l = new Looks(); all.set(events, l); }
  return l;
}

/** Ask the editors for a picture and wait for it: here, or at a running backstage (`remote`) for an agent on stdio. */
export async function lookAt(events: Events, ask: Omit<LookAsk, "rid">, remote?: URL | null): Promise<Buffer | null> {
  const looks = looksOf(events);
  const { rid, picture } = looks.wait();
  events.emit("look", { ...ask, rid });
  if (!remote) return picture;
  // on stdio: the event reached the running backstage (index.ts forwards it); its answer is waited for there
  looks.answer(rid, null);
  try {
    const r = await fetch(new URL(`api/look/${rid}`, remote), { signal: AbortSignal.timeout(LOOK_WAIT + 5000) });
    if (!r.ok) return null;
    const j = await r.json() as { image?: string | null };
    return j.image ? Buffer.from(j.image, "base64") : null;
  } catch { return null; }
}
