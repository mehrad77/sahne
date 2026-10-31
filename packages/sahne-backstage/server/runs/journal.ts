// What a run wrote, so it can be undone (Node only): every save a run's step made, in order, each document's file text
// before it (none when the save created it) and the mtime the save left. Undoing goes back write by write, newest first,
// each only while the file is still as that write left it: a document written after it (by a person, or by a step that
// is not being undone) is kept and said. A shared document (a season several steps added rows to) comes back exactly as
// it was before the undone steps' writes. In the run store (store.ts).

import { rmSync, statSync } from "node:fs";
import { fileOf, forget, type Before, type Kind } from "../content.ts";
import type { Store } from "./store.ts";
import { writeAtomic } from "../../../sahne-story/json.ts";

export interface Written { seq: number; run: string; step: string; kind: Kind; id: string; before: string | null; after: number; at: number }
export interface Undone { kind: Kind; id: string; removed: boolean; mtime?: number }
/** A document a run wrote, as a person sees it: who made it (its first step), whether the run created it, still there. */
export interface Made { kind: Kind; id: string; step: string; created: boolean; steps: string[] }

export class Journal {
  private readonly store: Store;
  constructor(store: Store) {
    this.store = store;
    store.db.exec("CREATE TABLE IF NOT EXISTS journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, run TEXT NOT NULL, step TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, before TEXT, after REAL NOT NULL, at INTEGER NOT NULL)");
  }

  /** A step's save: each document's text before it, and its new mtime. */
  record(run: string, step: string, before: Before[], saved: Record<string, number>): void {
    const put = this.store.db.prepare("INSERT INTO journal (run, step, kind, id, before, after, at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const b of before) {
      const mtime = saved[`${b.kind}:${b.id}`];
      if (mtime !== undefined) put.run(run, step, b.kind, b.id, b.text, mtime, Date.now());
    }
  }

  /** Every write of a run still in effect, oldest first. */
  of(run: string): Written[] {
    return this.store.db.prepare("SELECT seq, run, step, kind, id, before, after, at FROM journal WHERE run = ? ORDER BY seq").all(run) as unknown as Written[];
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

  /** Take these writes back, newest first, each while its file is as it left it. What came back, and what was kept. */
  undo(which: Written[]): { undone: Undone[]; kept: Written[] } {
    const done = new Map<string, Undone>(), kept: Written[] = [];
    for (const w of [...which].sort((a, b) => b.seq - a.seq)) {
      const u = fileOf(w.kind, w.id), k = `${w.kind}:${w.id}`;
      let now: number | null = null;
      try { now = statSync(u).mtimeMs; } catch { /* gone */ }
      if (now !== w.after) { kept.push(w); continue; }
      if (w.before === null) { rmSync(u); done.set(k, { kind: w.kind, id: w.id, removed: true }); }
      else done.set(k, { kind: w.kind, id: w.id, removed: false, mtime: writeAtomic(u, w.before) });
      this.store.db.prepare("DELETE FROM journal WHERE seq = ?").run(w.seq);
    }
    if (done.size) forget();
    return { undone: [...done.values()], kept: kept.filter(w => !done.has(`${w.kind}:${w.id}`)) };
  }
}
