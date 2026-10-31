// What the tasks (server/runs/) are making, and what they made and can still undo, by document: the board, the cast,
// the places and each item's page mark it where the work lands (ui/madeby.ts). Pure, so the tests read it as it is.

/** The little of a task this needs (src/runs.ts Run). */
export interface TaskLike {
  id: string; status: string; at: number;
  made?: { kind: string; id: string; step: string; created: boolean }[];
  steps: { id: string; title: string; about?: string; decided?: string[]; status: string; owns: { kind: string; id: string }[] }[];
}
/** A document's mark: the task and step that make it (`live`, while the step works) or made it. */
export interface Mark { task: string; step: string; title: string; about?: string; decided?: string[]; created?: boolean; live: boolean }

/** Every document a task is making now, or made and can still undo, by `kind:id`; a newer task's mark wins, and a working one over a made one. */
export function marksOf(tasks: TaskLike[]): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const t of [...tasks].sort((a, b) => a.at - b.at)) {
    for (const m of t.made ?? []) {
      const s = t.steps.find(x => x.id === m.step);
      if (!s || s.status === "undone") continue;
      out.set(`${m.kind}:${m.id}`, { task: t.id, step: s.id, title: s.title, ...(s.about ? { about: s.about } : {}), ...(s.decided?.length ? { decided: s.decided } : {}), created: m.created, live: false });
    }
  }
  for (const t of tasks) {
    if (t.status === "stopped") continue;
    for (const s of t.steps) if (s.status === "running") for (const o of s.owns) {
      const k = `${o.kind}:${o.id}`, was = out.get(k);
      out.set(k, { task: t.id, step: s.id, title: s.title, ...(s.about ? { about: s.about } : {}), ...(was?.created !== undefined ? { created: was.created } : {}), live: true });
    }
  }
  return out;
}
