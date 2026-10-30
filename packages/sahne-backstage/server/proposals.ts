// Agents' edits waiting for a person (Node only): an in-memory queue, one per backstage process, never written to disk.
// In proposals mode (the default) an agent's write tool (mcp.ts) computes the whole new document, checks it, and queues
// it here; the open editor shows it (`proposal` events, `GET /api/proposals`), and a person accepts or rejects it
// (`POST /api/proposals/<id>`). The browser applies an accepted proposal itself, as an edit like any other (Undo, the
// check, Save): backstage never saves a proposal.
//
// Several proposals on one document compose simply: an agent's proposal is computed from the document on disk plus that
// agent's own latest pending proposal on it (`after` names that one), so each holds the ones before it. Accepting one
// therefore applies those it was built on as well (they are resolved with it); rejecting one drops those built on it.
// Proposals of different agents are independent, each against the disk. `base` is the mtime the proposal was computed
// from, so the editor can tell when the file changed since.

import type { Kind, Problem } from "./content.ts";
import type { Events } from "./events.ts";

/** A document that changes with a proposal's main one (a season's calendar row with its episode's date). */
/** A document a proposal changes. `paths` (for one that changes with the main one) are its changed places: accepting it
 * sets only those, so it never undoes a person's unsaved edits or an earlier accepted proposal on the same document. */
export interface ProposalEdit { kind: Kind; doc: string; next: unknown; base?: number; create?: boolean; paths?: (string | number)[][] }

export interface Proposal {
  id: string;
  /** The document: its kind and id, and the whole document as proposed. */
  kind: Kind;
  doc: string;
  next: unknown;
  /** The mtime of the file it was computed from (none for a new document). */
  base?: number;
  /** A new document (its first save creates it). */
  create?: boolean;
  /** Other documents that change with it, saved in the same save. */
  also?: ProposalEdit[];
  /** The changed places in `next`, as paths (`["steps", 3]`). */
  paths: (string | number)[][];
  /** One line for a person: what it changes. */
  summary: string;
  /** Who proposed it: `assistant`, or an MCP client's name. */
  by: string;
  at: number;
  /** The check of `next` (with `also`): every problem, the ones it brings marked `new`. */
  problems: Problem[];
  /** The pending proposal of the same agent on the same document it was built on. */
  after?: string;
}

export type NewProposal = Omit<Proposal, "id" | "at">;

/** Where proposals go: this process's queue, or a running backstage's (stdio mode with --backstage). */
export interface Queue {
  pending(): Promise<Proposal[]>;
  add(p: NewProposal): Promise<Proposal>;
  /** Where a person sees them, for the agent's answer. */
  where: string;
}

export class Proposals implements Queue {
  private list = new Map<string, Proposal>();
  private n = 0;
  readonly where: string;
  private readonly events: Events;

  constructor(events: Events, where = "the open backstage editor") { this.events = events; this.where = where; }

  all(): Proposal[] { return [...this.list.values()]; }
  get(id: string): Proposal | undefined { return this.list.get(id); }
  async pending(): Promise<Proposal[]> { return this.all(); }

  async add(p: NewProposal): Promise<Proposal> {
    const out: Proposal = { ...p, id: `p${++this.n}`, at: Date.now() };
    this.list.set(out.id, out);
    this.events.emit("proposal", { action: "added", proposal: out });
    return out;
  }

  /**
   * A person's answer. Accepted: it and the proposals it was built on leave the queue (the browser applies its `next`,
   * which holds them). Rejected: it and the proposals built on it leave. Returns what left, or null for an unknown id.
   */
  resolve(id: string, accepted: boolean): Proposal[] | null {
    const p = this.list.get(id);
    if (!p) return null;
    const gone: Proposal[] = [p];
    if (accepted) {
      for (let a = p.after && this.list.get(p.after); a; a = a.after ? this.list.get(a.after) : undefined) gone.push(a);
      for (const q of this.list.values()) if (q.after && gone.some(g => g.id === q.after)) delete q.after;
    } else {
      let grew = true;
      while (grew) {
        grew = false;
        for (const q of this.list.values()) if (q.after && gone.some(g => g.id === q.after) && !gone.includes(q)) { gone.push(q); grew = true; }
      }
    }
    for (const g of gone) {
      this.list.delete(g.id);
      this.events.emit("proposal", { action: "resolved", proposal: g, accepted, ...(g === p ? {} : { with: p.id }) });
    }
    return gone;
  }
}

/** Latest pending proposal of `by` on a document, to build the next one on. */
export const latestOf = (list: Proposal[], by: string, kind: Kind, doc: string): Proposal | undefined =>
  list.filter(p => p.by === by && p.kind === kind && p.doc === doc).sort((a, b) => b.at - a.at || Number(b.id.slice(1)) - Number(a.id.slice(1)))[0];

const queues = new WeakMap<Events, Proposals>();
/** The process's queue: one per event bus (http.ts makes one bus; the assistant and /mcp share it). */
export function proposalsOf(events: Events): Proposals {
  let q = queues.get(events);
  if (!q) { q = new Proposals(events); queues.set(events, q); }
  return q;
}

/** A running backstage's queue, over its localhost API: what stdio mode uses with --backstage. */
export function remoteQueue(base: string): Queue {
  const u = new URL(base);
  if (u.protocol !== "http:" || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) throw new Error(`--backstage must be a backstage on this machine (http://localhost:<port>/), not ${base}`);
  const api = (p: string) => new URL(`api/${p}`, u.href.endsWith("/") ? u : new URL(u.href + "/"));
  const call = async (method: string, p: string, body?: unknown) => {
    const r = await fetch(api(p), { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({})) as { message?: string };
    if (!r.ok) throw new Error(`the backstage at ${u.href} answered ${r.status}: ${j.message ?? r.statusText}`);
    return j;
  };
  return {
    where: `the backstage editor at ${u.href}`,
    pending: async () => ((await call("GET", "proposals")) as { proposals: Proposal[] }).proposals,
    add: async p => ((await call("POST", "proposals", p)) as { proposal: Proposal }).proposal,
  };
}
