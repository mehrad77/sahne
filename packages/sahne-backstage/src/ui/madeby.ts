// Where a task's work lands (model/marks.ts), on an item's own page: a quiet line saying a task is writing it now and
// what it does, or that a task made it, with why, what it decided, Undo, and the way to the task.

import { html } from "htm/preact";
import { useEffect } from "preact/hooks";
import { loadLog, logs, marks, runs } from "../runs.ts";
import { dirtyKeys, keyOf } from "../store.ts";
import { doingNow } from "./chat/parts.ts";
import { Chip, Confirm, Icon } from "./kit/index.ts";
import { undoAsk, undoDoc, type Kind2 } from "./runs.ts";

export function MadeByTask(p: { kind: Kind2; id: string; name?: string }) {
  const m = marks.value.get(`${p.kind}:${p.id}`);
  const run = m && runs.value.find(r => r.id === m.task), step = run?.steps.find(s => s.id === m?.step);
  useEffect(() => { if (m?.live) void loadLog(m.task, m.step); }, [m?.live, m?.task, m?.step]);
  if (!m || !run || !step) return null;
  const href = `#/agents/tasks/${m.task}`, see = html`<a class="button small" href=${href}><${Icon} name="list" size=${14} /> See the task</a>`;
  if (m.live) {
    const log = logs.value[`${m.task}:${m.step}`], dirty = dirtyKeys.value.includes(keyOf(p.kind, p.id));
    return html`<div class="made-by live" role="status"><${Chip} tone="ok" live>A task is writing this now</${Chip}>
      <span class="note grow">${step.title}${log ? ` · ${doingNow(log.parts)}…` : ""}</span>${see}
      ${dirty && html`<p class="note warn">You have unsaved edits here: what the task writes will need merging with them.</p>`}</div>`;
  }
  return html`<div class="made-by"><${Icon} name="spark" size=${15} /><span class="grow">${m.created ? "Made" : "Changed"} by a task${m.about ? html`<span class="note"> · ${m.about}</span>` : ""}</span>
    ${run.agentEdits === "direct" && html`<${Confirm} label=${html`<${Icon} name="undo" size=${14} /> Undo`} ask=${undoAsk(run, p.id, p.name ?? p.id, step)} yes="Yes, undo" run=${() => undoDoc(run, p.kind, p.id)} />`}${see}
    ${m.decided && html`<details class="made-by-decided"><summary>What it decided</summary><ul>${m.decided.map(d => html`<li>${d}</li>`)}</ul></details>`}</div>`;
}
