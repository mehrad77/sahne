// AI help in the editor (server/ai.ts; shown only when the server has a key): rewrite the selected line, option or reply
// with an instruction; review the whole episode against its brief, each finding a jump to its step and, for a line, a
// fix to accept; and, for a draft, write its steps from the brief. Every answer is a suggestion: accepting it is an edit
// like any other, undone with Undo and judged by the story check before it can be saved.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { textOf, type StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { diffWords } from "../model/diff.ts";
import { get, set, type Path } from "../model/path.ts";
import { say, world } from "../store.ts";
import { Text } from "./fields.ts";

type T3 = { tr: string; en: string; fa: string };
const castOf = (story: StoryDoc) => Object.fromEntries([...(story.cast ?? []), ...(story.extras ?? []), world.value?.series?.narrator ?? "kerim"].map(id => {
  const c = world.value?.characters[id] as { name?: string; role?: string; kind?: string } | undefined;
  return [id, { name: textOf(c?.name), role: textOf(c?.role, "en"), kind: c?.kind }];
}));

async function askAi<T>(what: string, body: object): Promise<T | null> {
  const r = await api.post<T & { message?: string }>(`ai/${what}`, body);
  if (r.status !== 200) { say(r.message ?? `AI help failed (${r.status})`, true); return null; }
  return r;
}

/** A suggested text beside the current one, word by word. */
const Suggest = (p: { was: Partial<T3>; now: T3 }) => html`<div class="diff fields">
  ${(["tr", "en", "fa"] as const).map(k => html`<div lang=${k} dir=${k === "fa" ? "rtl" : "ltr"}><small class="note">${k} </small>${diffWords(p.was[k] ?? "", p.now[k]).map(d => (d.op === "=" ? d.text : d.op === "-" ? html`<del>${d.text}</del>` : html`<ins>${d.text}</ins>`))}</div>`)}
</div>`;

/** Rewrite the selected line, option or reply. */
export function AiRewrite(p: { story: StoryDoc; path: Path; edit(fn: (s: StoryDoc) => StoryDoc): void }) {
  const [how, setHow] = useState(""), [busy, setBusy] = useState(false);
  const [out, setOut] = useState<(T3 & { why: string }) | null>(null);
  if (!world.value?.ai) return null;
  const cur = get(p.story, p.path) as Partial<T3>;
  const run = async () => {
    setBusy(true); setOut(null);
    const r = await askAi<{ suggestion: T3 & { why: string } }>("rewrite", { story: p.story, path: p.path, instruction: how, cast: castOf(p.story) });
    setBusy(false);
    if (r) setOut(r.suggestion);
  };
  return html`<details class="panel"><summary><b>Ask Claude to rewrite it</b></summary>
    <div class="row" style="margin-top:6px"><input class="grow" style="flex:1" placeholder="how (simpler, warmer, more polite …)" value=${how} aria-label="How to rewrite it" onInput=${(e: Event) => setHow((e.target as HTMLInputElement).value)} />
      <button onClick=${() => void run()} disabled=${busy}>${busy ? "Asking…" : "Suggest"}</button></div>
    ${out && html`<${Suggest} was=${cur} now=${out} /><p class="note">${out.why}</p>
      <div class="row"><button class="primary" onClick=${() => { p.edit(s => ["tr", "en", "fa"].reduce((x, k) => set(x, [...p.path, k], out[k as keyof T3]), s)); setOut(null); }}>Accept</button><button onClick=${() => setOut(null)}>Discard</button></div>`}
  </details>`;
}

interface Finding { step: number; severity: "error" | "warning" | "note"; message: string; fix?: T3 }

/** A second reader over the whole episode. */
export function AiReview(p: { story: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc): void; select(path: Path): void }) {
  const [brief, setBrief] = useState(""), [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ summary: string; findings: Finding[] } | null>(null);
  if (!world.value?.ai) return html`<p class="note">AI help is off: start backstage with ANTHROPIC_API_KEY set.</p>`;
  const run = async () => {
    setBusy(true);
    const r = await askAi<{ summary: string; findings: Finding[] }>("review", { story: p.story, brief, cast: castOf(p.story) });
    setBusy(false);
    if (r) setOut(r);
  };
  return html`<div class="fields">
    <p class="note">A second reader that did not write the episode (Claude, ${"claude-opus-5-5"}): its words, translations, quiz and staging against its brief. Only the story's text is sent.</p>
    <${Text} label="The brief (optional: what the episode should do)" multi value=${brief} onInput=${(v: string | undefined) => setBrief(v ?? "")} />
    <div class="row"><span class="grow"></span><button class="primary" onClick=${() => void run()} disabled=${busy}>${busy ? "Reading the episode…" : "Review it"}</button></div>
    ${out && html`<p>${out.summary}</p>
      ${out.findings.map(f => {
        const path: Path = ["steps", f.step];
        const line = f.step >= 0 && typeof (get(p.story, path) as { tr?: unknown })?.tr === "string";
        return html`<div class="panel">
          <div class="row"><span class=${`chip ${f.severity === "error" ? "bad" : f.severity === "warning" ? "warn" : ""}`}>${f.severity}</span>
            ${f.step >= 0 ? html`<a href="#" onClick=${(e: Event) => { e.preventDefault(); p.select(path); }}>step ${f.step}</a>` : html`<span class="note">the episode</span>`}</div>
          <p style="margin:4px 0">${f.message}</p>
          ${f.fix && line && html`<${Suggest} was=${get(p.story, path) as Partial<T3>} now=${f.fix} /><button class="small" onClick=${() => p.edit(s => ["tr", "en", "fa"].reduce((x, k) => set(x, [...path, k], f.fix![k as keyof T3]), s))}>Accept the fix</button>`}
        </div>`;
      })}
      ${!out.findings.length && html`<p class="note">Nothing to fix.</p>`}`}
  </div>`;
}

/** A draft's steps written from its brief. */
export function AiDraft(p: { story: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc): void }) {
  const [brief, setBrief] = useState(p.story.summary?.en && p.story.summary.en !== "…" ? p.story.summary.en : ""), [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ steps: unknown[]; quiz: unknown[]; notes: string } | null>(null);
  if (!world.value?.ai || !p.story.draft) return null;
  const run = async () => {
    setBusy(true);
    const r = await askAi<{ steps: unknown[]; quiz: unknown[]; notes: string }>("draft", { story: p.story, brief, cast: castOf(p.story) });
    setBusy(false);
    if (r) setOut(r);
  };
  return html`<details class="panel" style="margin-top:8px"><summary><b>Ask Claude to draft this episode from its brief</b></summary>
    <${Text} label="The brief" multi value=${brief} onInput=${(v: string | undefined) => setBrief(v ?? "")} />
    <div class="row"><span class="grow"></span><button onClick=${() => void run()} disabled=${busy || !brief.trim()}>${busy ? "Writing…" : "Draft it"}</button></div>
    ${out && html`<p>${out.steps.length} steps and ${out.quiz.length} quiz items. ${out.notes}</p>
      <div class="row"><button class="primary" onClick=${() => { p.edit(s => set(set(s, ["steps"], out.steps), ["quiz"], out.quiz)); setOut(null); }}>Replace the steps and quiz</button><button onClick=${() => setOut(null)}>Discard</button></div>`}
  </details>`;
}
