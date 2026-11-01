// What a run wrote, so it can be undone (Node only): every save a run's step made, in order, each document's file text
// before it (none when the save created it) and a hash of the text it left. Undoing works document by document: from the
// run's newest write of it back through the writes being undone, as long as the file still holds what the newest left; it
// then gets the text from before the earliest of them (or goes, if the run created it). A document written after that (by
// a person, or by a step that is not being undone) is kept and said, so a shared one (a season several steps added rows
// to) comes back exactly as it was before the undone steps. In the run store (store.ts).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { fileOf, forget, type Before, type Kind } from "../content.ts";
import type { Store } from "./store.ts";
import { writeAtomic } from "../../../sahne-story/json.ts";

export interface Written { seq: number; run: string; step: string; kind: Kind; id: string; before: string | null; after: number; hash: string | null; at: number }
export interface Undone { kind: Kind; id: string; removed: boolean; mtime?: number }
/** One write of a run, as a person reads it in its history. */
export interface Did { step: string; kind: Kind; id: string; created: boolean; at: number }
/** A document a run wrote, as a person sees it: who made it (its first step), whether the run created it, still there. */
export interface Made { kind: Kind; id: string; step: string; created: boolean; steps: string[] }

const hashOf = (text: string | null) => (text === null ? null : createHash("sha1").update(text).digest("hex"));
const textAt = (u: URL) => (existsSync(u) ? readFileSync(u, "utf8") : null);

export class Journal {
  private readonly store: Store;
  constructor(store: Store) {
    this.store = store;
    store.db.exec("CREATE TABLE IF NOT EXISTS journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, run TEXT NOT NULL, step TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, before TEXT, after REAL NOT NULL, at INTEGER NOT NULL)");
    try { store.db.exec("ALTER TABLE journal ADD COLUMN hash TEXT"); } catch { /* there already */ }
  }

  /** A step's save: each document's text before it, and what it left (read back at once). */
  record(run: string, step: string, before: Before[], saved: Record<string, number>): void {
    const put = this.store.db.prepare("INSERT INTO journal (run, step, kind, id, before, after, hash, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const b of before) {
      const mtime = saved[`${b.kind}:${b.id}`];
      if (mtime !== undefined) put.run(run, step, b.kind, b.id, b.text, mtime, hashOf(textAt(fileOf(b.kind, b.id))), Date.now());
    }
  }

  /** A document's text before a run first wrote it (null: the run created it), and now (null: gone): what it changed. */
  before(run: string, kind: Kind, id: string): { before: string | null; now: string | null } | null {
    const first = this.of(run).find(w => w.kind === kind && w.id === id);
    return first ? { before: first.before, now: textAt(fileOf(kind, id)) } : null;
  }

  /** Every write of a run still in effect, oldest first. */
  of(run: string): Written[] {
    return this.store.db.prepare("SELECT seq, run, step, kind, id, before, after, hash, at FROM journal WHERE run = ? ORDER BY seq").all(run) as unknown as Written[];
  }

  /** The documents a run wrote (still undoable): the step that first wrote each, and whether the run created it. */
  made(run: string): Made[] {
    const out = new Map<string, Made>();
    for (const w of this.of(run)) {
      const k = `${w.kind}:${w.id}`, m = out.get(k);
      if (!m) out.set(k, { kind: w.kind, id: w.id, step: w.step, created: w.before === null, steps: [w.step] });
      else if (!m.steps.includes(w.step)) m.steps.push(w.step);
    }
    return [...out.values()];
  }

  /** What a run did, write by write, oldest first: which step wrote which document, whether it created it, and when. */
  history(run: string): Did[] {
    return this.of(run).map(w => ({ step: w.step, kind: w.kind, id: w.id, created: w.before === null, at: w.at }));
  }

  /** Take these writes back, document by document. What came back, and the writes kept (their document changed since). */
  undo(run: string, which: Written[]): { undone: Undone[]; kept: Written[] } {
    const chosen = new Set(which.map(w => w.seq)), all = this.of(run), undone: Undone[] = [], kept: Written[] = [];
    for (const key of [...new Set(which.map(w => `${w.kind}:${w.id}`))]) {
      const rows = all.filter(w => `${w.kind}:${w.id}` === key).reverse(), top = rows[0];
      const u = fileOf(top.kind, top.id), now = textAt(u);
      // the file must still be as the run's newest write left it (an older row has no hash: its mtime says)
      const same = top.hash !== null ? hashOf(now) === top.hash : now !== null && Math.abs(statSync(u).mtimeMs - top.after) < 1;
      const chain: Written[] = [];
      if (same) for (const w of rows) { if (!chosen.has(w.seq)) break; chain.push(w); }
      kept.push(...rows.filter(w => chosen.has(w.seq) && !chain.includes(w)));
      if (!chain.length) continue;
      const first = chain[chain.length - 1];
      if (first.before === null) { rmSync(u); undone.push({ kind: first.kind, id: first.id, removed: true }); }
      else undone.push({ kind: first.kind, id: first.id, removed: false, mtime: writeAtomic(u, first.before) });
      const del = this.store.db.prepare("DELETE FROM journal WHERE seq = ?");
      for (const w of chain) del.run(w.seq);
    }
    if (undone.length) forget();
    return { undone, kept };
  }
}
