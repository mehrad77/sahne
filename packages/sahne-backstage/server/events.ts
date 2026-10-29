// What backstage tells the open editors (Node only): one bus per process, sent to every browser that listens on
// `GET /api/events` (Server-Sent Events, a keep-alive comment every 20 s). The events, each a JSON `data` under its
// `event:` name:
//   proposal  { action: "added" | "resolved", proposal, accepted? }   an agent's edit waiting for a person (proposals.ts)
//   doc       { kind, id, mtime }                                       a document an agent wrote itself (direct mode)
//   show      { id, step }                                              an agent asks the open editors to go there
//   usage     { today, month, caps }                                    after each AI call (ai/budget.ts)
// The editor also tells backstage what it has open (`POST /api/selection`), for an agent to read as a resource.

import type http from "node:http";

export type EventName = "proposal" | "doc" | "show" | "usage";
export const EVENT_NAMES: EventName[] = ["proposal", "doc", "show", "usage"];

/** What the open editor shows: its page, and the document and step selected there. */
export interface Selection { page: string; kind?: string; id?: string; path?: (string | number)[]; at: number }

type Listener = (name: EventName, data: unknown) => void;

export class Events {
  private listeners = new Set<Listener>();
  /** The editor's last selection (`POST /api/selection`), or null before one. */
  selection: Selection | null = null;

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  emit(name: EventName, data: unknown): void {
    for (const fn of [...this.listeners]) {
      try { fn(name, data); } catch { /* a listener's failure is its own */ }
    }
  }

  /** How many listen (browsers on /api/events, a forwarder). */
  get size(): number { return this.listeners.size; }

  /** Answer `GET /api/events`: a stream that stays open until the browser goes. */
  stream(req: http.IncomingMessage, res: http.ServerResponse, keepAliveMs = 20_000): void {
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.write(": backstage events\n\n");
    const off = this.on((name, data) => { res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`); });
    const beat = setInterval(() => res.write(": keep-alive\n\n"), keepAliveMs);
    beat.unref();
    const end = () => { clearInterval(beat); off(); };
    req.on("close", end);
    res.on("close", end);
  }
}

/** A selection from the editor's JSON, checked; null when it is not one. */
export function selectionOf(v: unknown): Selection | null {
  const b = v as { page?: unknown; kind?: unknown; id?: unknown; path?: unknown };
  if (!b || typeof b.page !== "string" || !b.page) return null;
  const out: Selection = { page: b.page.slice(0, 200), at: Date.now() };
  if (typeof b.kind === "string") out.kind = b.kind.slice(0, 40);
  if (typeof b.id === "string") out.id = b.id.slice(0, 80);
  if (Array.isArray(b.path) && b.path.every(k => typeof k === "string" || typeof k === "number")) out.path = b.path.slice(0, 20) as (string | number)[];
  return out;
}
