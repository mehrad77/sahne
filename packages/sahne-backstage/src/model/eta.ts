// How long a task has left (src/ui/runs.ts): the steps done so far took this long on average; the steps still to do,
// as many at once as the task runs, take about as long. Nothing until a step is done. Pure, for the tests.

export interface Timed { kind: string; status: string; startedAt?: number; endedAt?: number }

/** Milliseconds left, about, or null when nothing is done yet to go by (or nothing is left). */
export function timeLeft(steps: Timed[], concurrency: number, now: number): number | null {
  const work = steps.filter(s => s.kind !== "plan"), done = work.filter(s => s.status === "done" && s.startedAt !== undefined && s.endedAt !== undefined);
  const left = work.filter(s => s.status === "waiting" || s.status === "running" || s.status === "asking");
  if (!done.length || !left.length) return null;
  const each = done.reduce((t, s) => t + (s.endedAt! - s.startedAt!), 0) / done.length;
  // a working step is partly done already
  const owed = left.reduce((t, s) => t + (s.status === "running" && s.startedAt !== undefined ? Math.max(each * 0.1, each - (now - s.startedAt)) : each), 0);
  return owed / Math.max(1, Math.min(concurrency, left.length));
}

/** "about 4 min left", "about a minute left", "under a minute left". */
export function leftWords(ms: number): string {
  const min = Math.round(ms / 60_000);
  return ms < 45_000 ? "under a minute left" : min <= 1 ? "about a minute left" : `about ${min} min left`;
}
