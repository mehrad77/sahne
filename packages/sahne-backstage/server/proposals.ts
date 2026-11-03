// Agents' edits waiting for a person (Node only): a queue, one per backstage process, kept in the person's store
// (runs/store.ts) when the server gives one, so a restart loses none; never written to the content root.
// In proposals mode (the default) an agent's write tool (mcp.ts) computes the whole new document, checks it, and queues
// it here; the open editor shows it (`proposal` events, `GET /api/proposals`), and a person accepts or rejects it
// (`POST /api/proposals/<id>`). The browser applies an accepted proposal itself, as an edit like any other (Undo, the
// check, Save): backstage never saves a proposal.
//
// Several proposals on one document compose simply: an agent's proposal is computed from the document on disk plus that
// agent's own latest pending proposal on it (`after` names that one), so each holds the ones before it. Accepting one
// therefore applies those it was built on as well (they are resolved with it); rejecting one drops those built on it.
// Proposals of different agents are independent, each against the disk. `base` is the mtime the proposal was computed
// from, and `from` the document itself (the file at that mtime, or the agent's own pending proposal it was built on, as
// mcp.ts `current` reads it): the editor merges the proposal's changes from `from` into what it has, so a save made since
// is kept, never reverted. The same author proposing the same documents again (a step
// of a run that starts over after a restart) gets the proposal it made, not a second one.

import { exists, readDoc, type Kind, type Problem } from "./content.ts";
import type { Events } from "./events.ts";
import type { Store } from "./runs/store.ts";

/** A document that changes with a proposal's main one (a season's calendar row with its episode's date). */
/** A document a proposal changes. `paths` (for one that changes with the main one) are its changed places: accepting it
 * sets only those, so it never undoes a person's unsaved edits or an earlier accepted proposal on the same document. */
export interface ProposalEdit { kind: Kind; doc: string; next: unknown; base?: number; create?: boolean; paths?: (string | number)[][]; /** The document it was computed from (`add` finds it). */ from?: unknown }

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
  /** The step of a run that made it (runs/). */
  step?: string;
  /** The document it was computed from (`add` finds it). */
  from?: unknown;
}

export type NewProposal = Omit<Proposal, "id" | "at">;
/** An answered proposal, as an agent learns of it. */
export interface Resolved { id: string; kind: Kind; doc: string; summary: string; by: string; at: number; outcome: "accepted" | "rejected" | "withdrawn" }
/** How many answered proposals are kept. */
const KEEP_RESOLVED = 50;

/** Where proposals go: this process's queue, or a running backstage's (stdio mode with --backstage). */
export interface Queue {
  pending(): Promise<Proposal[]>;
  add(p: NewProposal): Promise<Proposal>;
  /** The latest answered proposals, newest first: accepted, rejected, or withdrawn by the agent that made them. */
  resolved(): Promise<Resolved[]>;
  /** Take back a pending proposal of `by` (and the ones built on it): the ids that left. */
  withdraw(id: string, by: string): Promise<string[]>;
  /** Where a person sees them, for the agent's answer. */
  where: string;
}

export class Proposals implements Queue {
  private list = new Map<string, Proposal>();
  private done: Resolved[] = [];
  private n = 0;
  readonly where: string;
  private readonly events: Events;
  private readonly store?: Store;

  constructor(events: Events, where = "the open backstage editor", store?: Store) {
    this.events = events; this.where = where; this.store = store;
    const kept = store?.get<{ n: number; pending: Proposal[]; done: Resolved[] } | null>("proposals", null);
    if (kept) { this.n = kept.n; this.done = kept.done; for (const p of kept.pending) this.list.set(p.id, p); }
  }
  private keep() { this.store?.set("proposals", { n: this.n, pending: this.all(), done: this.done }); }

  all(): Proposal[] { return [...this.list.values()]; }
  get(id: string): Proposal | undefined { return this.list.get(id); }
  async pending(): Promise<Proposal[]> { return this.all(); }
  async resolved(): Promise<Resolved[]> { return [...this.done]; }

  async add(p: NewProposal): Promise<Proposal> {
    // what it proposes, not what it was computed from (`from`, which add puts on each edit)
    const what = (x: { next: unknown; also?: ProposalEdit[] }) => JSON.stringify([x.next, (x.also ?? []).map(({ from: _f, ...a }) => a)]);
    const same = this.all().find(q => q.by === p.by && q.kind === p.kind && q.doc === p.doc && what(q) === what(p));
    if (same) return same;
    const out: Proposal = { ...p, ...this.fromOf(p, p.by), ...(p.also ? { also: p.also.map(a => ({ ...a, ...this.fromOf(a, p.by) })) } : {}), id: `p${++this.n}`, at: Date.now() };
    this.list.set(out.id, out);
    this.keep();
    this.events.emit("proposal", { action: "added", proposal: out });
    return out;
  }

  /**
   * The document an edit was computed from, as mcp.ts `current` gives it to the agent: its own latest pending proposal of
   * the document, else one that carried it along, else the file, when it is still at the edit's `base`. Nothing for a new
   * document, or for a file that changed since (the editor then refuses to merge rather than guess).
   */
  private fromOf(e: { kind: Kind; doc: string; base?: number; create?: boolean }, by: string): { from?: unknown } {
    const mine = this.all().filter(x => x.by === by);
    const own = latestOf(mine, by, e.kind, e.doc);
    if (own) return { from: own.next };
    const carried = [...mine].sort((a, b) => b.at - a.at).flatMap(x => x.also ?? []).find(a => a.kind === e.kind && a.doc === e.doc);
    if (carried) return { from: carried.next };
    if (e.create || e.base === undefined) return {};
    try {
      if (!exists(e.kind, e.doc)) return {};
      const r = readDoc(e.kind, e.doc);
      return r.mtime === e.base ? { from: r.doc } : {};
    } catch { return {}; }
  }

  /**
   * A person's answer. Accepted: it and the proposals it was built on leave the queue (the browser applies its `next`,
   * which holds them). Rejected: it and the proposals built on it leave. Returns what left, or null for an unknown id.
   */
  resolve(id: string, accepted: boolean, withdrawn = false): Proposal[] | null {
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
      this.done.unshift({ id: g.id, kind: g.kind, doc: g.doc, summary: g.summary, by: g.by, at: Date.now(), outcome: accepted ? "accepted" : withdrawn ? "withdrawn" : "rejected" });
      this.events.emit("proposal", { action: "resolved", proposal: g, accepted, ...(withdrawn ? { withdrawn: true } : {}), ...(g === p ? {} : { with: p.id }) });
    }
    this.done.length = Math.min(this.done.length, KEEP_RESOLVED);
    this.keep();
    return gone;
  }

  /** An agent takes back its own proposal: it and the ones built on it leave, as a rejection would take them. */
  async withdraw(id: string, by: string): Promise<string[]> {
    const p = this.list.get(id);
    if (!p) throw new Error(`no pending proposal ${id}`);
    if (p.by !== by) throw new Error(`${id} was proposed by ${p.by}, not by you: only a person answers it`);
    return (this.resolve(id, false, true) ?? []).map(x => x.id);
  }
}

/** Latest pending proposal of `by` on a document, to build the next one on. */
export const latestOf = (list: Proposal[], by: string, kind: Kind, doc: string): Proposal | undefined =>
  list.filter(p => p.by === by && p.kind === kind && p.doc === doc).sort((a, b) => b.at - a.at || Number(b.id.slice(1)) - Number(a.id.slice(1)))[0];

const queues = new WeakMap<Events, Proposals>();
/** The process's queue: one per event bus (http.ts makes one bus, with its store; the assistant and /mcp share it). */
export function proposalsOf(events: Events, store?: Store): Proposals {
  let q = queues.get(events);
  if (!q) { q = new Proposals(events, undefined, store); queues.set(events, q); }
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
    resolved: async () => ((await call("GET", "proposals")) as { resolved?: Resolved[] }).resolved ?? [],
    withdraw: async (id, by) => ((await call("POST", `proposals/${id}`, { withdraw: by })) as { resolved: string[] }).resolved,
  };
}
