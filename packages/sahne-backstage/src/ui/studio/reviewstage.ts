// The Review stage of an episode: a read-through, as the audience will take it, the first translation under each line
// (the left column); and beside the stage, whether it is ready to approve (each stage of the work, and the open comments),
// Approve, Watch it, the comments on the episode or the selected line, and "Ask a fresh reader" (the assistant as a second
// reader who did not write it, leaving comments). Approving keeps the episode's signature (model/progress.ts), so a later
// change shows as changed since.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { textOf, type StoryDoc } from "sahne-story";
import { get, type Path } from "../../model/path.ts";
import { blocks } from "../../model/script.ts";
import { rowKey, type Comment, type EpisodeReview } from "../../model/review.ts";
import { approvedReview, type Progress } from "../../model/progress.ts";
import { directionsOf } from "../../model/directions.ts";
import { stagingIn } from "../../model/script.ts";
import { review, reviewer, setReview, setReviewer, world } from "../../store.ts";
import { ASKS, send } from "../assistant.ts";
import { inLang, langName, useLangs } from "../lang.ts";

const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/** The script read-only, as the audience takes it: a click plays that moment, 💬 marks a line with comments. */
export function ReadThrough(p: { id: string; story: StoryDoc; selected: Path | null; select(path: Path): void }) {
  const w = world.value!, langs = useLangs(), main = langs.main, gloss = langs.translations[0];
  const name = (id?: string) => (id ? textOf(w.characters[id]?.name, main) ?? id : "");
  const comments = (review.value[p.id]?.comments ?? []).filter(c => !c.done);
  return html`<div class="read" role="list" aria-label="The script, read through">
    ${blocks(p.story).map(b => {
      const v = (get(p.story, b.path) ?? {}) as Record<string, any>, k = rowKey(b.path), on = p.selected?.join("/") === b.path.join("/");
      const n = comments.filter(c => c.at === k).length;
      const cls = `read-row d${b.depth}${on ? " on" : ""}`;
      const pick = () => p.select(b.path);
      if (b.kind === "scene") return html`<div class=${cls} role="listitem" onClick=${pick}><div class="scene-h">${(textOf(w.places[v.scene]?.name, "en") ?? v.scene).toUpperCase()}${v.time ? html` <span class="note">· ${v.time}</span>` : ""}</div></div>`;
      if (b.kind === "action") return html`<div class=${cls} role="listitem" onClick=${pick}><div class="direction">(${[name(v.beat?.who), ...directionsOf(stagingIn(v) as Record<string, unknown>, name).map(d => d.label)].filter(Boolean).join(", ") || "a pause"})</div></div>`;
      if (b.kind === "choice") return html`<div class=${cls} role="listitem" onClick=${pick}><div class="direction">${name(w.series?.standin)} chooses what to say:</div></div>`;
      if (b.kind === "act") return html`<div class=${cls} role="listitem" onClick=${pick}><div class="direction">${name(w.series?.standin)} does something on stage: ${v.act?.prompt?.[main] ?? ""}</div></div>`;
      const words = b.kind === "line" || b.kind === "option" ? v : v[b.kind] ?? {};
      const who = b.kind === "option" ? w.series?.standin : b.kind === "line" ? v.who : w.series?.narrator;
      return html`<div class=${cls} role="listitem" onClick=${pick}>
        <div class="who">${name(who)}${v.narr ? html` <span class="note">(to us)</span>` : ""}${b.kind === "option" ? html` <span class="note">(option${v.ok ? ", fits" : ""})</span>` : ""}${n ? html` <span class="cmark">💬 ${n}</span>` : ""}</div>
        <div class="say" ...${inLang(main)}>${String(words[main] ?? "")}</div>
        ${gloss && html`<div class="tr-quiet" ...${inLang(gloss)}>${String(words[gloss] ?? "")}</div>`}</div>`;
    })}
  </div>`;
}

/** What stands between the episode and its approval: the stages not done, the open comments. */
export const notDoneOf = (p: Progress) => [...p.stages.filter(x => x.key !== "review" && !x.done).map(x => x.name.toLowerCase()), ...(p.openComments ? [`${p.openComments} open comment${p.openComments > 1 ? "s" : ""}`] : [])];

/** Approve the episode as the reviewer named here; before it is ready, only with a reason, kept as a comment (one write). */
export function approve(id: string, story: StoryDoc, progress: Progress, reason?: string) {
  const notDone = notDoneOf(progress);
  if (notDone.length && !reason?.trim()) return;
  void setReview(id, x => approvedReview(x, { story, reviewer: reviewer.value, notDone, reason: reason?.trim(), id: Math.random().toString(36).slice(2, 10), date: now() }));
}

/** Beside the stage in Review: ready or not, Approve, Watch it, and the comments. `ask` (bumped) opens "Approve anyway…"'s reason. */
export function ReviewSide(p: { id: string; story: StoryDoc; progress: Progress; selected: Path | null; goStage(k: string): void; onWatch(): void; ask?: number }) {
  const r: EpisodeReview = review.value[p.id] ?? {}, langs = useLangs();
  const [text, setText] = useState(""), [why, setWhy] = useState<string | null>(null);
  const key = p.selected ? rowKey(p.selected) : null;
  const list = (r.comments ?? []).filter(c => (key ? c.at === key : true));
  const before = p.progress.stages.filter(x => x.key !== "review");
  const ready = !notDoneOf(p.progress).length;
  const whyBox = useRef<HTMLInputElement>(null);
  // the page's Next bar asks for the reason here
  useEffect(() => { if (p.ask && !ready && !p.progress.approved) { setWhy(w => w ?? ""); requestAnimationFrame(() => whyBox.current?.focus()); } }, [p.ask]);
  const comment = (t: string, at?: string | null) => {
    const c: Comment = { id: Math.random().toString(36).slice(2, 10), ...(at ? { at } : {}), by: reviewer.value || "someone", text: t, date: now() };
    void setReview(p.id, x => ({ ...x, comments: [...(x.comments ?? []), c] }));
  };
  const approveIt = (reason?: string) => { approve(p.id, p.story, p.progress, reason); setWhy(null); };
  const fresh = ASKS.find(a => a.id === "second");
  return html`<div class="review-side">
    <div class="section-block"><h3>Ready to approve?</h3>
      <ul class="ready-list">${before.map(x => html`<li class=${x.done ? "ok" : "no"}><span class="mark">${x.done ? "✓" : "•"}</span><span class="grow">${x.name}: ${x.state}</span>${!x.done && html`<button class="small" onClick=${() => p.goStage(x.key)}>Go</button>`}</li>`)}
        <li class=${p.progress.openComments ? "no" : "ok"}><span class="mark">${p.progress.openComments ? "•" : "✓"}</span><span class="grow">${p.progress.openComments ? `${p.progress.openComments} open comment${p.progress.openComments > 1 ? "s" : ""}` : "No open comments"}</span></li></ul>
      <div class="row wrap">
        ${p.progress.approved ? html`<span class="note">Approved${r.reviewer ? ` by ${r.reviewer}` : ""}.</span><button class="small" onClick=${() => void setReview(p.id, x => ({ ...x, status: "draft" }))}>Take the approval back</button>`
          : ready ? html`<button class="primary" onClick=${() => approveIt()}>Approve</button>`
          : why === null ? html`<button onClick=${() => setWhy("")}>Approve anyway…</button>` : ""}
        <button onClick=${p.onWatch}>▶ Watch it</button>
        <span class="grow"></span>
        <label class="row note"><input type="checkbox" style="width:auto" checked=${r.ai !== false} onChange=${(e: Event) => void setReview(p.id, x => ({ ...x, ai: (e.target as HTMLInputElement).checked }))} /> AI wrote it</label></div>
      ${p.progress.changedSinceApproved && html`<p class="note warn">Changed since it was approved: look at what changed, then approve it again.</p>`}
      ${why !== null && html`<div class="row"><input ref=${whyBox} class="grow" placeholder="Why it can ship before it is ready" value=${why} aria-label="Why approve it now" onInput=${(e: Event) => setWhy((e.target as HTMLInputElement).value)} />
        <button disabled=${!why.trim()} onClick=${() => approveIt(why)}>Approve</button><button class="linkish" onClick=${() => setWhy(null)}>Cancel</button></div>`}
    </div>
    <div class="section-block"><div class="row"><h3 class="grow">${key ? `Comments on line ${key}` : "Comments"}</h3>
      ${fresh && world.value?.ai && html`<button class="small" onClick=${() => void send(fresh.prompt, { fresh: true })} title="The assistant reads it as a second reader who did not write it, and leaves comments">✦ Ask a fresh reader</button>`}</div>
      ${list.length ? list.map(c => html`<div class=${`comment${c.done ? " done" : ""}`}>
        <div class="note">${c.by} · ${c.date}${c.at && !key ? ` · line ${c.at}` : ""}</div><div>${c.text}</div>
        <div class="row"><button class="small" onClick=${() => void setReview(p.id, x => ({ ...x, comments: (x.comments ?? []).map(y => (y.id === c.id ? { ...y, done: !y.done } : y)) }))}>${c.done ? "Open again" : "Resolve"}</button>
          <button class="small danger" onClick=${() => void setReview(p.id, x => ({ ...x, comments: (x.comments ?? []).filter(y => y.id !== c.id) }))}>Delete</button></div></div>`)
      : html`<p class="note">${key ? "No comments on this line." : "No comments yet."}</p>`}
      <div class="row">
        <input placeholder="Your name" value=${reviewer.value} style="max-width:130px" aria-label="Your name" onInput=${(e: Event) => setReviewer((e.target as HTMLInputElement).value)} />
        <input class="grow" placeholder=${key ? "A comment on this line" : "A comment on the episode"} value=${text} aria-label="New comment" onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && text.trim()) { comment(text.trim(), key); setText(""); } }} />
        <button onClick=${() => { if (text.trim()) { comment(text.trim(), key); setText(""); } }} disabled=${!text.trim()}>Comment</button></div>
      ${langs.translations.length > 0 && html`<p class="note">Translators' comments show in Translate too, under the ${langName(langs.translations[0])} and the other languages.</p>`}
    </div>
  </div>`;
}
