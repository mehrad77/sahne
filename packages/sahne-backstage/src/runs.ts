// The runs as the editor knows them (server/runs/run.ts): read once, then kept up to date by the server's `run` events
// (events.ts). A step's log is read when it is first shown and grows as the step works, folded into an answer's parts as
// the chat's are (ui/assistant.ts `fold`), so a run's step reads like a conversation.

import { computed, effect, signal } from "@preact/signals";
import { api, type Kind } from "./api.ts";
import { fold, type Part } from "./ui/assistant.ts";
import { marksOf } from "./model/marks.ts";

export type StepStatus = "waiting" | "running" | "asking" | "done" | "failed" | "stopped" | "stale" | "skipped" | "undone";
export interface RunStep {
  id: string; kind: string; title: string; brief: string; about?: string; needs: string[]; owns: { kind: Kind; id: string }[]; model?: string;
  status: StepStatus; summary?: string; decided?: string[]; told?: string[]; startedAt?: number; endedAt?: number; question?: { question: string; options?: string[] }; error?: string; budget?: boolean; usd: number; attempts: number; proposals: string[];
}
/** A document a run wrote and can still undo (server/runs/journal.ts). */
export interface Made { kind: Kind; id: string; step: string; created: boolean; steps: string[] }
/** One write of a run, oldest first: its history (Journal.history). */
export interface Did { step: string; kind: Kind; id: string; created: boolean; at: number }
export interface Run {
  id: string; goal: string; mode?: "check" | "auto"; asks?: "choices" | "never"; made?: Made[]; did?: Did[]; by: string; status: "running" | "gate" | "paused" | "done" | "stopped"; gate?: "plan" | "castAndPlaces"; why?: string;
  gates: { plan: boolean; castAndPlaces: boolean }; passed: string[]; maxUsd: number; usd: number; concurrency: number; agentEdits: string;
  brief: string; steps: RunStep[]; estimateUsd?: number; at: number;
}
/** A step's log as an answer: its parts, and the last row read. */
export interface Log { content: string; parts: Part[]; seq: number }

export const runs = signal<Run[]>([]);
export const logs = signal<Record<string, Log>>({});
let read = false;

/** The runs that wait for the person: at a gate, or with a step that asks. */
export const waiting = computed(() => runs.value.filter(r => r.status === "gate" || (r.status !== "stopped" && r.steps.some(s => s.status === "asking"))));

/** The tasks at work that don't wait for the person: the top bar and the rail say so. */
export const working = computed(() => runs.value.filter(r => r.status === "running" && !waiting.value.includes(r)));
/** What each task is making now, or made and can still undo, by `kind:id` (model/marks.ts). */
export const marks = computed(() => marksOf(runs.value));

// the tab says so while a run waits for the person
if (typeof document !== "undefined") { const base = document.title; effect(() => { document.title = waiting.value.length ? `● ${base}` : base; }); }

/** Why the tasks could not be read (null once they were): the page says it instead of showing none. */
export const runsError = signal<string | null>(null);
export async function loadRuns(): Promise<void> {
  const r = await api.get<{ runs: Run[] }>("runs");
  if (r.status === 200) { runs.value = r.runs; read = true; runsError.value = null; }
  else runsError.value = r.status === 404 ? "this backstage is older than the page (it has no tasks): start it again" : (r as { message?: string }).message ?? `backstage answered ${r.status}`;
}
export const runsRead = () => read;

/** A task's record in the content root's sidecar (server/runs/record.ts): what History and a task card read of a task this backstage's store does not have. */
export interface TaskRecord {
  id: string; goal: string; mode: string; by: string; status: Run["status"]; why?: string; createdAt: number; updatedAt: number; maxUsd: number; usd: number; estimateUsd?: number; brief: string;
  steps: { id: string; kind: string; title: string; about?: string; status: StepStatus; summary?: string; decided?: string[]; needs?: string[]; owns?: { kind: Kind; id: string }[] }[];
  made: Made[]; did: Did[];
}
/** The records of the tasks on this root, newest first: kept apart from `runs`, so a task run elsewhere never counts as working here. */
export const records = signal<TaskRecord[]>([]);
export async function loadRecords(): Promise<void> {
  const r = await api.get<{ tasks: TaskRecord[] }>("tasks");
  if (r.status === 200) records.value = r.tasks;
}
/** The records of tasks this backstage does not run (another port, another config, another person's): read-only. */
export const elsewhere = (): TaskRecord[] => { const here = new Set(runs.value.map(r => r.id)); return records.value.filter(r => !here.has(r.id)); };
/** The record of a task this backstage does not run (null when there is none). */
export async function loadRecord(id: string): Promise<TaskRecord | null> {
  const r = await api.get<{ task: TaskRecord }>(`tasks/${encodeURIComponent(id)}`);
  if (r.status !== 200) return null;
  records.value = [r.task, ...records.value.filter(x => x.id !== id)];
  return r.task;
}

const keyOf = (run: string, step: string) => `${run}:${step}`;

/** A step's log, read once (then the events grow it). */
export async function loadLog(run: string, step: string): Promise<void> {
  const k = keyOf(run, step);
  if (logs.value[k]) return;
  const r = await api.get<{ events: { seq: number; event: { type: string } }[] }>(`runs/${run}/steps/${step}/log`);
  if (r.status !== 200) return;
  const log: Log = { content: "", parts: [], seq: 0 };
  for (const e of r.events) { fold(log, e.event); log.seq = e.seq; }
  logs.value = { ...logs.value, [k]: log };
}

/** A `run` event: a run changed, or one of its steps did something. */
export function heardRun(d: { run?: Run; id?: string; step?: string; seq?: number; event?: { type: string } }): void {
  if (d.run) {
    const i = runs.value.findIndex(r => r.id === d.run!.id), old = runs.value[i];
    // a change heard on the bus has no `made` or `did`: what it wrote is read again a moment later
    const run = { ...d.run, made: d.run.made ?? old?.made, did: d.run.did ?? old?.did };
    runs.value = i < 0 ? [...runs.value, run] : runs.value.map((r, j) => (j === i ? run : r));
    if (!d.run.made) readMadeSoon(run.id);
    return;
  }
  if (!d.id || !d.step || !d.event || d.seq === undefined) return;
  const k = keyOf(d.id, d.step), log = logs.value[k];
  // a log not read yet is read whole when it is shown; one read already grows (a row that grows has the same seq)
  if (!log || d.seq < log.seq) return;
  fold(log, d.event);
  log.seq = d.seq;
  logs.value = { ...logs.value, [k]: { ...log, parts: [...log.parts] } };
}

const pendingMade = new Map<string, number>();
function readMadeSoon(id: string) {
  clearTimeout(pendingMade.get(id));
  pendingMade.set(id, setTimeout(() => void api.get<{ run: Run }>(`runs/${id}`).then(r => { if (r.status === 200) heardRun({ run: r.run }); }), 600) as unknown as number);
}

/** Undo what a run wrote: these documents (with what was built on them), or all of it. What came back, and what was kept. */
export async function undo(id: string, items?: { kind: Kind; id: string }[]): Promise<{ undone: { kind: Kind; id: string }[]; kept: { kind: Kind; id: string }[] } | string> {
  const r = await api.post<{ run: Run; undone: { kind: Kind; id: string }[]; kept: { kind: Kind; id: string }[]; message?: string }>(`runs/${id}`, { action: "undo", ...(items ? { items } : {}) });
  if (r.status !== 200) return r.message ?? `backstage answered ${r.status}`;
  heardRun({ run: r.run });
  return { undone: r.undone, kept: r.kept };
}

export async function act(id: string, body: unknown): Promise<string | null> {
  const r = await api.post<{ run: Run; message?: string }>(`runs/${id}`, body);
  if (r.status !== 200) return r.message ?? `backstage answered ${r.status}`;
  heardRun({ run: r.run });
  return null;
}
export async function actStep(id: string, step: string, body: unknown): Promise<string | null> {
  const r = await api.post<{ run: Run; message?: string }>(`runs/${id}/steps/${step}`, body);
  if (r.status !== 200) return r.message ?? `backstage answered ${r.status}`;
  heardRun({ run: r.run });
  return null;
}
