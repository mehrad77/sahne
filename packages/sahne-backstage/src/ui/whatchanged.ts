// What a task changed in a document it did not create (server/runs/journal.ts `before`): an episode as the step diff
// reads it (stepdiff.ts), anything else field by field, its words diffed; against the text before the task first wrote it.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { diffWords } from "../model/diff.ts";
import { Modal } from "./kit/index.ts";
import { StepDiff } from "./stepdiff.ts";

const shown = (v: unknown) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 1).replace(/\n\s*/g, " "));
const parse = (t: string | null): Record<string, unknown> | null => { try { return t === null ? null : JSON.parse(t); } catch { return null; } };

const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** What differs, as rows: a field, or inside a field that is a map (a season's calendar, its arcs), each entry that changed. */
function rowsOf(was: Record<string, unknown>, now: Record<string, unknown>, at: string[] = []): { at: string[]; was: unknown; now: unknown }[] {
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].filter(k => JSON.stringify(was[k]) !== JSON.stringify(now[k]))
    .flatMap(k => (at.length < 1 && isMap(was[k]) && isMap(now[k]) ? rowsOf(was[k] as Record<string, unknown>, now[k] as Record<string, unknown>, [...at, k]) : [{ at: [...at, k], was: was[k], now: now[k] }]));
}

function FieldsDiff(p: { was: Record<string, unknown>; now: Record<string, unknown> }) {
  const rows = rowsOf(p.was, p.now);
  if (!rows.length) return html`<p class="note">Nothing differs now: it is as it was before the task.</p>`;
  return html`<dl class="fields-diff">${rows.map(r => html`<dt>${r.at.join(" › ")}</dt><dd>${r.was === undefined ? html`<ins>${shown(r.now)}</ins>` : r.now === undefined ? html`<del>${shown(r.was)}</del>`
    : diffWords(shown(r.was), shown(r.now)).map(c => (c.op === "=" ? c.text : c.op === "-" ? html`<del>${c.text}</del>` : html`<ins>${c.text}</ins>`))}</dd>`)}</dl>`;
}

export function WhatChanged(p: { task: string; kind: string; id: string; name: string; onClose(): void }) {
  const [d, setD] = useState<{ before: string | null; now: string | null } | string | null>(null);
  useEffect(() => {
    void api.get<{ before: string | null; now: string | null; message?: string }>(`runs/${p.task}/before?kind=${p.kind}&id=${encodeURIComponent(p.id)}`)
      .then(r => setD(r.status === 200 ? { before: r.before, now: r.now } : (r.message ?? `backstage answered ${r.status}`)));
  }, [p.task, p.kind, p.id]);
  const was = typeof d === "object" && d ? parse(d.before) : null, now = typeof d === "object" && d ? parse(d.now) : null;
  return html`<${Modal} title=${`What the task changed in ${p.name}`} onClose=${p.onClose} wide>
    ${d === null ? html`<p class="note">Reading…</p>` : typeof d === "string" ? html`<p class="note bad">${d}</p>`
      : !now ? html`<p class="note">It is gone now.</p>` : !was ? html`<p class="note">The task made it: there was nothing before.</p>`
      : p.kind === "story" ? html`<${StepDiff} was=${was as unknown as StoryDoc} now=${now as unknown as StoryDoc} />`
      : html`<${FieldsDiff} was=${was} now=${now} />`}
  </${Modal}>`;
}
