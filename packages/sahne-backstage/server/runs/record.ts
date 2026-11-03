// A task's record (Node only): what it set out to do and what it did, in the content root's sidecar
// (`.backstage/tasks/<id>.json`, sahne-story's paths.ts `TASKS`), written by the backstage that runs it whenever it changes,
// so the task travels with the series and History lists it beside the conversations. The run store (store.ts) stays the
// truth for a task at work; a backstage whose store does not have a task (another port, another root's config, another
// machine) shows its record, read-only. Never a checkpoint, a log, a picture or a secret: only the fields named here.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { TASKS, taskFile } from "../../../sahne-story/paths.ts";
import { writeAtomic } from "../../../sahne-story/json.ts";
import { safeId } from "../../src/model/chats.ts";
import type { Did, Made } from "./journal.ts";
import type { Run } from "./run.ts";

export interface RecordStep { id: string; kind: string; title: string; about?: string; status: string; summary?: string; decided?: string[]; needs?: string[]; owns?: { kind: string; id: string }[] }
export interface TaskRecord {
  id: string; goal: string; mode: string; by: string; status: string; why?: string; createdAt: number; updatedAt: number;
  maxUsd: number; usd: number; estimateUsd?: number; brief: string; steps: RecordStep[]; made: Made[]; did: Did[];
}

/** A run as its record keeps it (`updatedAt` aside): named fields only. */
export function recordOf(run: Run, made: Made[], did: Did[], updatedAt: number): TaskRecord {
  return {
    id: run.id, goal: run.goal, mode: run.mode, by: run.by, status: run.status, ...(run.why ? { why: run.why } : {}), createdAt: run.at, updatedAt,
    maxUsd: run.maxUsd, usd: Math.round(run.usd * 1e4) / 1e4, ...(run.estimateUsd !== undefined ? { estimateUsd: run.estimateUsd } : {}), brief: run.brief,
    steps: run.steps.map(s => ({
      id: s.id, kind: s.kind, title: s.title, ...(s.about ? { about: s.about } : {}), status: s.status, ...(s.summary ? { summary: s.summary } : {}),
      ...(s.decided?.length ? { decided: s.decided } : {}), ...(s.needs.length ? { needs: s.needs } : {}), ...(s.owns.length ? { owns: s.owns.map(o => ({ kind: o.kind, id: o.id })) } : {}),
    })),
    made: made.map(m => ({ kind: m.kind, id: m.id, step: m.step, created: m.created, steps: m.steps })),
    did: did.map(d => ({ step: d.step, kind: d.kind, id: d.id, created: d.created, at: d.at })),
  };
}

/** The records' writer: a record is written only when what it says changed, so a series' history is not churned. */
export class Records {
  private readonly last = new Map<string, string>();
  write(run: Run, made: Made[], did: Did[]): void {
    if (!safeId(run.id)) return;
    const same = JSON.stringify(recordOf(run, made, did, 0));
    if (this.last.get(run.id) === same) return;
    if (!this.last.has(run.id)) {
      const old = readRecord(run.id);
      // another store's task of the same old id (`r3`, from before ids had a tail): never written over
      if (old && old.createdAt !== run.at) { console.error(`task ${run.id}: the series has a record of another task of that id; this one's is not written`); this.last.set(run.id, same); return; }
      // a record already on disk that says the same (after a restart) is left as it is
      if (old && JSON.stringify({ ...old, updatedAt: 0 }) === same) { this.last.set(run.id, same); return; }
    }
    writeAtomic(taskFile(run.id), JSON.stringify(recordOf(run, made, did, Date.now()), null, 2) + "\n");
    this.last.set(run.id, same);
  }
}

/** The ids with a record. */
export const recordIds = (): string[] => existsSync(TASKS) ? readdirSync(TASKS).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).filter(safeId) : [];

/** One task's record, or null (none, or not one). */
export function readRecord(id: string): TaskRecord | null {
  if (!safeId(id)) return null;
  const u = taskFile(id);
  if (!existsSync(u)) return null;
  try {
    const r = JSON.parse(readFileSync(u, "utf8")) as TaskRecord;
    return r && r.id === id && typeof r.goal === "string" && Array.isArray(r.steps) ? { ...r, made: Array.isArray(r.made) ? r.made : [], did: Array.isArray(r.did) ? r.did : [] } : null;
  } catch { return null; }
}

/** Every record, newest first. */
export const readRecords = (): TaskRecord[] => recordIds().flatMap(id => { const r = readRecord(id); return r ? [r] : []; }).sort((a, b) => b.updatedAt - a.updatedAt);

/** The highest task number on this root's records (`r7` and `r7-k3f` are 7): a new task numbers after it. */
export const highestRecorded = (): number => Math.max(0, ...recordIds().map(id => Number(/^r(\d+)(?:-|$)/.exec(id)?.[1] ?? 0)));
