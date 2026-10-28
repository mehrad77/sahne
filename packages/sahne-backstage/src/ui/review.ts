// Review: on an episode's page, where it stands (an AI draft, reviewed, approved), whether AI wrote it, each step reviewed
// and its Persian checked, and comments on it or on a step; and the review page (#/review): every episode of each season
// with its status, how much of it is reviewed and Persian-checked, its problems and its known-word ratio, and the notes
// exported as markdown. The notes live in the sidecar (server/review.ts), never in a story.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { StoryDoc } from "sahne-story";
import { allProblems, loadAllProblems, review, reviewer, setReview, setReviewer, world, type Comment, type EpisodeReview, type Status } from "../store.ts";
import { rows } from "../model/steps.ts";
import type { Path } from "../model/path.ts";
import { Select } from "./fields.ts";

const STATUS_NAME: Record<Status, string> = { draft: "AI draft", reviewed: "reviewed", approved: "approved" };
const rowKey = (path: Path) => [path[1], path[4], path[6]].filter(x => x !== undefined).join(".");
const pad = (n: number) => String(n).padStart(2, "0");
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** The panel on an episode's page, for the selected step (or the whole episode). */
export function ReviewPanel(p: { id: string; story: StoryDoc; path: Path | null }) {
  const r: EpisodeReview = review.value[p.id] ?? {};
  const [text, setText] = useState("");
  const key = p.path ? rowKey(p.path) : null;
  const note = key ? r.steps?.[key] ?? {} : null;
  const all = rows(p.story), done = all.filter(x => r.steps?.[rowKey(x.path)]?.reviewed).length, fa = all.filter(x => r.steps?.[rowKey(x.path)]?.persian).length;
  const comments = (r.comments ?? []).filter(c => (key ? c.at === key : true));
  const put = (fn: (r: EpisodeReview) => EpisodeReview) => void setReview(p.id, x => ({ ...fn(x), reviewer: reviewer.value || x.reviewer }));
  const mark = (what: "reviewed" | "persian", on: boolean) => put(x => {
    const steps = { ...(x.steps ?? {}) }, s = { ...(steps[key!] ?? {}) };
    if (on) s[what] = true; else delete s[what];
    if (Object.keys(s).length) steps[key!] = s; else delete steps[key!];
    return { ...x, steps };
  });
  const add = () => {
    if (!text.trim()) return;
    const c: Comment = { id: Math.random().toString(36).slice(2, 10), ...(key ? { at: key } : {}), by: reviewer.value || "someone", text: text.trim(), date: now() };
    put(x => ({ ...x, comments: [...(x.comments ?? []), c] }));
    setText("");
  };
  return html`<div class="fields">
    <div class="row">
      <div class="grow"><${Select} label="This episode is" value=${r.status ?? "draft"} options=${(Object.keys(STATUS_NAME) as Status[]).map(s => [s, STATUS_NAME[s]] as [string, string])} onInput=${(s: string | undefined) => put(x => ({ ...x, status: (s ?? "draft") as Status }))} /></div>
      <label class="row"><input type="checkbox" style="width:auto" checked=${r.ai !== false} onChange=${(e: Event) => put(x => ({ ...x, ai: (e.target as HTMLInputElement).checked }))} /> AI wrote it</label>
    </div>
    <p class="note">${done} of ${all.length} steps reviewed · Persian checked in ${fa}${r.reviewer ? ` · last by ${r.reviewer}` : ""}</p>
    ${note && html`<div class="row">
      <label class="row"><input type="checkbox" style="width:auto" checked=${!!note.reviewed} onChange=${(e: Event) => mark("reviewed", (e.target as HTMLInputElement).checked)} /> step ${key} reviewed</label>
      <label class="row"><input type="checkbox" style="width:auto" checked=${!!note.persian} onChange=${(e: Event) => mark("persian", (e.target as HTMLInputElement).checked)} /> its Persian checked</label>
    </div>`}
    <h3>${key ? `Comments on step ${key}` : "Comments on the episode"}</h3>
    ${comments.map(c => html`<div class="panel" style=${c.done ? "opacity:.55" : ""}>
      <div class="note">${c.by} · ${c.date}${c.at && !key ? ` · step ${c.at}` : ""}</div><div>${c.text}</div>
      <div class="row"><button class="small" onClick=${() => put(x => ({ ...x, comments: (x.comments ?? []).map(y => (y.id === c.id ? { ...y, done: !y.done } : y)) }))}>${c.done ? "Open again" : "Done"}</button>
        <button class="small danger" onClick=${() => put(x => ({ ...x, comments: (x.comments ?? []).filter(y => y.id !== c.id) }))}>Delete</button></div>
    </div>`)}
    <div class="row">
      <input placeholder="Your name" value=${reviewer.value} style="max-width:140px" aria-label="Your name" onInput=${(e: Event) => setReviewer((e.target as HTMLInputElement).value)} />
      <input class="grow" placeholder=${key ? "A comment on this step" : "A comment on the episode"} value=${text} aria-label="New comment" onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => e.key === "Enter" && add()} style="flex:1" />
      <button onClick=${add} disabled=${!text.trim()}>Comment</button>
    </div>
  </div>`;
}

/** The known-word ratio the story check reports, if it does (it needs the cards). */
const ratioOf = (msgs: { rule: string; message: string }[]) => { const m = msgs.find(x => x.rule === "words" && /known words ([\d.]+)%/.test(x.message)); return m ? Number(/known words ([\d.]+)%/.exec(m.message)![1]) : null; };

/** #/review: where every episode stands. */
export function ReviewPage() {
  const w = world.value!;
  useEffect(() => { if (!allProblems.value) void loadAllProblems(); }, []);
  const ps = allProblems.value;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  const orphan = w.episodes.filter(e => !seasons.some(s => s.n === e.season));
  const groups: [string, typeof w.episodes][] = [...seasons.map(s => [s.titleEn, w.episodes.filter(e => e.season === s.n)] as [string, typeof w.episodes]), ...(orphan.length ? [["Without a season", orphan] as [string, typeof w.episodes]] : [])];
  const count = (id: string, level: string) => ps?.filter(p => p.doc === `story:${id}` && p.level === level).length ?? 0;
  return html`<section>
    <div class="row"><h2 class="grow">Review</h2><button onClick=${() => download(markdown())}>Export the notes (markdown)</button></div>
    <p class="note">Where each episode stands. The notes are kept beside the content (.backstage/review.json), never in a story.${!ps ? " Checking every episode…" : ""}</p>
    ${groups.map(([title, eps]) => {
      const n = eps.length, by = (s: Status) => eps.filter(e => (review.value[e.id]?.status ?? "draft") === s).length;
      return html`<h3>${title} · ${by("approved")} of ${n} approved, ${by("reviewed")} reviewed</h3>
      <table class="grid"><thead><tr><th>Episode</th><th>Status</th><th>Steps reviewed</th><th>Persian</th><th>Errors</th><th>Warnings</th><th>Known words</th><th>Open comments</th></tr></thead>
      <tbody>${eps.map(e => {
        const r = review.value[e.id] ?? {}, steps = Object.values(r.steps ?? {});
        const ratio = ps ? ratioOf(ps.filter(p => p.doc === `story:${e.id}`)) : null;
        return html`<tr><td><a href=${`#/episode/${e.id}`}>${e.id}</a> <span lang="tr">${e.title}</span></td>
          <td><span class=${`chip ${r.status === "approved" ? "ok" : r.status === "reviewed" ? "" : "warn"}`}>${STATUS_NAME[r.status ?? "draft"]}</span>${r.ai !== false ? " · AI" : ""}</td>
          <td>${steps.filter(s => s.reviewed).length}</td><td>${steps.filter(s => s.persian).length}</td>
          <td>${ps ? count(e.id, "error") : "…"}</td><td>${ps ? count(e.id, "warning") : "…"}</td><td>${ratio === null ? "—" : `${ratio}%`}</td>
          <td>${(r.comments ?? []).filter(c => !c.done).length}</td></tr>`;
      })}</tbody></table>`;
    })}
  </section>`;
}

/** The notes as markdown: each episode's status and its open comments. */
function markdown(): string {
  const w = world.value!, out = [`# Review notes: ${w.series?.titleEn ?? "the series"}`, ""];
  for (const e of w.episodes) {
    const r = review.value[e.id];
    if (!r) continue;
    out.push(`## ${e.id} · ${e.title}`, "", `- Status: ${STATUS_NAME[r.status ?? "draft"]}${r.ai !== false ? " (written by AI)" : ""}${r.reviewer ? `, last by ${r.reviewer}` : ""}`);
    for (const c of r.comments ?? []) out.push(`- ${c.done ? "[x]" : "[ ]"} ${c.at ? `step ${c.at}: ` : ""}${c.text} (${c.by}, ${c.date})`);
    out.push("");
  }
  return out.join("\n");
}

function download(text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = "review-notes.md";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
