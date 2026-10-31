// Review: what to review and where each episode stands, worked out from the evidence (model/review.ts). On an episode's
// page: each block reviewed with ✓ in the script's gutter and each translation checked beside it, a mark turning amber
// when its block changes; the Review tab's stage (Draft, In review, Ready, Approved), what keeps it from Ready, the
// sign-off, and comments on the episode or a block. The review page (#/review): what needs you, nearest launch first,
// each episode with its stage, a strip of its blocks and its passes; and the notes exported as markdown. The notes live in
// the sidecar (server/review.ts), never in a story. Nothing here assumes language lessons: translations, word cards and
// the known-word ratio show only when the series has them.

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import type { SeasonDoc, StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { allProblems, loadAllProblems, review, reviewer, setReview, setReviewer, world, type Comment, type EpisodeReview } from "../store.ts";
import { datesOf } from "../model/board.ts";
import type { Path } from "../model/path.ts";
import { checkedOf, rowKey, sigAt, standingOf, STAGE_NAME, STAGES, type Block, type BlockState, type Stage, type Standing } from "../model/review.ts";
import { tx } from "./fields.ts";
import { inLang, langName, useLangs } from "./lang.ts";

export { checkedOf, rowKey };
const pad = (n: number) => String(n).padStart(2, "0");
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 864e5);
const when = (date: string | undefined) => {
  if (!date) return "no date";
  const n = daysUntil(date);
  return n === 0 ? "launches today" : n === 1 ? "launches tomorrow" : n > 1 ? `launches in ${n} days` : `launched ${-n} day${n === -1 ? "" : "s"} ago`;
};
/** A block's path from its key in the notes (`5.1.0` → steps/5/choice/options/1/reply/0). */
export const pathOfKey = (key: string): Path => {
  const [s, o, r] = key.split(".").map(Number);
  return ["steps", s!, ...(o !== undefined ? ["choice", "options", o] : []), ...(r !== undefined ? ["reply", r] : [])] as Path;
};

/** Change one episode's notes, signed with the reviewer's name. */
export const putReview = (id: string, fn: (r: EpisodeReview) => EpisodeReview) => void setReview(id, x => ({ ...fn(x), reviewer: reviewer.value || x.reviewer }));

/** Mark a block reviewed, or one of its translations checked, as the block is now. A block changed since its marks starts again. */
export function markStep(id: string, story: Pick<StoryDoc, "steps">, path: Path, what: "reviewed" | string, on: boolean) {
  const key = rowKey(path), sig = sigAt(story, path);
  putReview(id, x => {
    const steps = { ...(x.steps ?? {}) }, prev = steps[key];
    const s = prev?.sig && prev.sig !== sig ? {} : { ...(prev ?? {}) };
    if (what === "reviewed") { if (on) s.reviewed = true; else delete s.reviewed; }
    else {
      const c = new Set(checkedOf(s)); if (on) c.add(what); else c.delete(what);
      delete s.persian;
      if (c.size) s.checked = [...c].sort(); else delete s.checked;
    }
    if (s.reviewed || s.checked?.length) s.sig = sig; else delete s.sig;
    if (Object.keys(s).length) steps[key] = s; else delete steps[key];
    return { ...x, steps };
  });
}

/** Mark a block done: reviewed, and every translation it holds checked. */
export function markDone(id: string, story: Pick<StoryDoc, "steps">, b: Block) {
  putReview(id, x => ({ ...x, steps: { ...(x.steps ?? {}), [b.key]: { reviewed: true, ...(b.langs.length ? { checked: [...b.langs].sort() } : {}), sig: sigAt(story, b.path) } } }));
}

/** A block's review in the script's gutter: reviewed (amber once the block changed since), and its comments. */
export function ReviewGutter(p: { id: string; story: Pick<StoryDoc, "steps">; path: Path; onComments(): void }) {
  const r = review.value[p.id], key = rowKey(p.path), n = r?.steps?.[key];
  const stale = !!n?.sig && n.sig !== sigAt(p.story, p.path);
  const open = (r?.comments ?? []).filter(c => c.at === key && !c.done).length;
  return html`<button class=${`gut-btn${n?.reviewed ? (stale ? " stale" : " on") : ""}`} title=${stale ? "Changed since it was reviewed (click to review it again)" : n?.reviewed ? "Reviewed (click to undo)" : "Mark reviewed"} aria-pressed=${!!n?.reviewed && !stale}
      onClick=${() => markStep(p.id, p.story, p.path, "reviewed", stale || !n?.reviewed)}>✓</button>
    <button class=${`gut-btn${open ? " on" : ""}`} title=${open ? `${open} open comments` : "Comment on it"} onClick=${p.onComments}>${open ? `💬${open}` : "💬"}</button>`;
}

/** Draft → In review → Ready → Approved, the current step lit (amber when approved but changed since). */
export function Stepper(p: { stage: Stage; compact?: boolean }) {
  const at = p.stage === "changed" ? 3 : STAGES.indexOf(p.stage);
  if (p.compact) return html`<span class=${`stage-chip ${p.stage}`}>${STAGE_NAME[p.stage]}</span>`;
  return html`<ol class=${`stepper${p.stage === "changed" ? " changed" : ""}`} aria-label=${`Stage: ${STAGE_NAME[p.stage]}`}>${STAGES.map((s, i) => html`<li class=${i < at ? "past" : i === at ? "now" : ""} aria-current=${i === at ? "step" : undefined}>${i === at ? STAGE_NAME[p.stage] : STAGE_NAME[s]}</li>`)}</ol>`;
}

const STATE_WORD: Record<BlockState, string> = { todo: "to review", partial: "partly reviewed", done: "reviewed", unverified: "reviewed (before marks remembered the block)", changed: "changed since it was reviewed" };
/** One cell per block, in script order: reviewed, changed since, to review, an error on it, a comment on it. */
export function BlockStrip(p: { id: string; blocks: Omit<Block, "path">[]; standing: Standing; errorSteps: Set<number>; onPick?(key: string): void }) {
  const open = new Set((review.value[p.id]?.comments ?? []).filter(c => !c.done && c.at).map(c => c.at!));
  return html`<div class="block-strip" role="list" aria-label=${`${p.standing.done} of ${p.standing.total} blocks reviewed`}>${p.blocks.map(b => {
    const st = p.standing.states[b.key] ?? "todo", err = p.errorSteps.has(b.step) && b.key === String(b.step);
    const title = `${b.key}${b.who ? ` · ${b.who}` : ""}: ${b.text.slice(0, 90)}\n${STATE_WORD[st]}${err ? " · an error" : ""}${open.has(b.key) ? " · an open comment" : ""}`;
    return html`<a role="listitem" class=${`cell ${st}${err ? " err" : ""}${open.has(b.key) ? " talk" : ""}${b.key.includes(".") ? " sub" : ""}`} title=${title} aria-label=${title}
      href=${`#/episode/${p.id}/at/${b.key}`} onClick=${p.onPick ? (e: MouseEvent) => { e.preventDefault(); p.onPick!(b.key); } : undefined}></a>`;
  })}</div>`;
}

/** Each translation's checks as a small ring: "en 8/12". */
export function Passes(p: { standing: Standing }) {
  const ps = Object.entries(p.standing.passes);
  if (!ps.length) return null;
  return html`<span class="passes">${ps.map(([l, x]) => html`<span class=${`pass${x.done === x.total ? " full" : ""}`} title=${`${langName(l)}: checked in ${x.done} of the ${x.total} blocks that hold it`} style=${`--p:${x.total ? Math.round((x.done / x.total) * 100) : 0}`}><i aria-hidden="true"></i>${l} ${x.done}/${x.total}</span>`)}</span>`;
}

/** The review tab on an episode's page: the stage, what keeps it from Ready, the sign-off, and the comments. */
export function ReviewPanel(p: { id: string; story: StoryDoc; path: Path | null; standing: Standing; onReview?(): void }) {
  const r: EpisodeReview = review.value[p.id] ?? {}, st = p.standing;
  const [text, setText] = useState(""), [why, setWhy] = useState<string | null>(null);
  const key = p.path ? rowKey(p.path) : null;
  const comments = (r.comments ?? []).filter(c => (key ? c.at === key : true));
  const comment = (t: string, at?: string | null) => {
    const c: Comment = { id: Math.random().toString(36).slice(2, 10), ...(at ? { at } : {}), by: reviewer.value || "someone", text: t, date: now() };
    putReview(p.id, x => ({ ...x, comments: [...(x.comments ?? []), c] }));
  };
  const add = () => { if (!text.trim()) return; comment(text.trim(), key); setText(""); };
  const approve = (reason?: string) => {
    putReview(p.id, x => ({ ...x, status: "approved" }));
    if (reason) comment(`Approved before it was ready (${st.missing.join(", ")}): ${reason}`);
    setWhy(null);
  };
  return html`<div class="fields review-panel">
    <${Stepper} stage=${st.stage} />
    <p class="note">${st.done} of ${st.total} blocks reviewed${st.changed ? `, ${st.changed} changed since` : ""}<${Passes} standing=${st} />${r.reviewer ? ` · last by ${r.reviewer}` : ""}</p>
    ${st.missing.length > 0 && st.stage !== "approved" && html`<p class="note">Not ready yet: ${st.missing.join(" · ")}.</p>`}
    <div class="row wrap">
      ${p.onReview && st.stage !== "approved" && html`<button class="primary" onClick=${p.onReview}>${st.done ? "Continue reviewing" : "Start reviewing"}</button>`}
      ${st.stage === "ready" && html`<button class="primary" onClick=${() => approve()}>Approve</button>`}
      ${(st.stage === "draft" || st.stage === "in-review") && why === null && html`<button class="linkish" onClick=${() => setWhy("")}>Approve anyway…</button>`}
      ${(st.stage === "approved" || st.stage === "changed") && html`<button onClick=${() => putReview(p.id, x => ({ ...x, status: "draft" }))}>Take the approval back</button>`}
      <span class="grow"></span>
      <label class="row"><input type="checkbox" style="width:auto" checked=${r.ai !== false} onChange=${(e: Event) => putReview(p.id, x => ({ ...x, ai: (e.target as HTMLInputElement).checked }))} /> AI wrote it</label>
    </div>
    ${why !== null && html`<div class="row"><input class="grow" placeholder="Why it can ship before it is ready" value=${why} aria-label="Why approve it now" onInput=${(e: Event) => setWhy((e.target as HTMLInputElement).value)} />
      <button disabled=${!why.trim()} onClick=${() => approve(why.trim())}>Approve</button><button class="linkish" onClick=${() => setWhy(null)}>Cancel</button></div>`}
    <p class="note">Mark a block reviewed with ✓ in the script's gutter${useLangs().translations.length ? ", and a translation checked with ✓ beside it" : ""}. A mark turns amber when its block changes.</p>
    <h3>${key ? `Comments on block ${key}` : "Comments on the episode"}</h3>
    ${comments.map(c => html`<div class=${`comment${c.done ? " done" : ""}`}>
      <div class="note">${c.by} · ${c.date}${c.at && !key ? ` · block ${c.at}` : ""}</div><div>${c.text}</div>
      <div class="row"><button class="small" onClick=${() => putReview(p.id, x => ({ ...x, comments: (x.comments ?? []).map(y => (y.id === c.id ? { ...y, done: !y.done } : y)) }))}>${c.done ? "Open again" : "Done"}</button>
        <button class="small danger" onClick=${() => putReview(p.id, x => ({ ...x, comments: (x.comments ?? []).filter(y => y.id !== c.id) }))}>Delete</button></div>
    </div>`)}
    <div class="row">
      <input placeholder="Your name" value=${reviewer.value} style="max-width:140px" aria-label="Your name" onInput=${(e: Event) => setReviewer((e.target as HTMLInputElement).value)} />
      <input class="grow" placeholder=${key ? "A comment on this block" : "A comment on the episode"} value=${text} aria-label="New comment" onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => e.key === "Enter" && add()} />
      <button onClick=${add} disabled=${!text.trim()}>Comment</button>
    </div>
  </div>`;
}

/** The known-word ratio the story check reports, if it does (it needs the cards). */
const ratioOf = (msgs: { rule: string; message: string }[]) => { const m = msgs.find(x => x.rule === "words" && /known words ([\d.]+)%/.test(x.message)); return m ? Number(/known words ([\d.]+)%/.exec(m.message)![1]) : null; };

/** Every episode's blocks as saved (GET /api/review/blocks), read when the review page opens. */
const savedBlocks = signal<Record<string, Omit<Block, "path">[]> | null>(null);
async function loadBlocks() { const r = await api.get<{ episodes: Record<string, Omit<Block, "path">[]> }>("review/blocks"); if (r.status === 200) savedBlocks.value = r.episodes; }

type Filter = "needs" | "errors" | "week" | "changed" | "ai" | "all";
const FILTERS: [Filter, string][] = [["needs", "Needs you"], ["errors", "Has errors"], ["week", "Launches this week"], ["changed", "Changed since review"], ["ai", "AI-written"], ["all", "All"]];
const ACTION: Record<Stage, string> = { draft: "Start review", "in-review": "Continue", ready: "Approve", approved: "Open", changed: "Look again" };

/** #/review: what needs you, nearest launch first, and where every episode stands. */
export function ReviewPage() {
  const w = world.value!, langs = useLangs();
  const [filter, setFilter] = useState<Filter>("needs");
  useEffect(() => { if (!allProblems.value) void loadAllProblems(); void loadBlocks(); }, []);
  const ps = allProblems.value, blocks = savedBlocks.value;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n) as (SeasonDoc & { n: number })[];
  const orphan = w.episodes.filter(e => !seasons.some(s => s.n === e.season));
  const rowsOf = (eps: typeof w.episodes, se?: SeasonDoc) => {
    const dates = se ? datesOf(se, eps) : {};
    return eps.map(e => {
      const mine = ps?.filter(x => x.doc === `story:${e.id}`) ?? [], bs = blocks?.[e.id] ?? [];
      const standing = standingOf(review.value[e.id], bs as Block[], { errors: mine.filter(x => x.level === "error").length, translations: langs.translations });
      return { e, date: dates[e.id] ?? e.releaseDate, mine, bs, standing, ratio: ratioOf(mine) };
    }).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.e.id.localeCompare(b.e.id));
  };
  type R = ReturnType<typeof rowsOf>[number];
  const keep = (x: R) => filter === "all" ? true : filter === "needs" ? x.standing.stage !== "approved" : filter === "errors" ? x.standing.errors > 0
    : filter === "week" ? !!x.date && daysUntil(x.date) >= 0 && daysUntil(x.date) <= 7 : filter === "changed" ? x.standing.changed > 0 : review.value[x.e.id]?.ai !== false;
  const groups: [string, R[]][] = [...seasons.map(s => [tx(s.title, "en"), rowsOf(w.episodes.filter(e => e.season === s.n), s)] as [string, R[]]), ...(orphan.length ? [["Without a season", rowsOf(orphan)] as [string, R[]]] : [])];
  return html`<section class="review-page">
    <div class="row"><h2 class="grow">Review</h2><button class="small" onClick=${() => download(markdown(groups.flatMap(g => g[1])))}>Export the notes (markdown)</button></div>
    <p class="note">What needs a person's eye before it launches, nearest launch first. An episode is Ready when every block is reviewed${langs.translations.length ? " and its translations checked" : ""}, with no errors and no open comments; then someone approves it. The notes are kept beside the content (.backstage/review.json), never in a story.${!ps || !blocks ? " Reading every episode…" : ""}</p>
    <div class="filters" role="group" aria-label="Show">${FILTERS.map(([f, label]) => html`<button class=${`chip${filter === f ? " on" : ""}`} aria-pressed=${filter === f} onClick=${() => setFilter(f)}>${label}</button>`)}</div>
    ${groups.map(([title, all]) => {
      const shown = all.filter(keep), count = (s: Stage) => all.filter(x => x.standing.stage === s).length;
      const next = all.find(x => x.date && daysUntil(x.date) >= 0 && x.standing.stage !== "approved");
      return html`<div class="review-season">
        <div class="row"><h3 class="grow">${title} <span class="note">· ${count("approved")} of ${all.length} approved</span></h3></div>
        <div class="stage-bar" role="img" aria-label=${(["approved", "ready", "in-review", "draft", "changed"] as Stage[]).map(s => `${count(s)} ${STAGE_NAME[s]}`).join(", ")}>
          ${(["approved", "ready", "in-review", "changed", "draft"] as Stage[]).map(s => count(s) ? html`<span class=${s} style=${`flex:${count(s)}`} title=${`${count(s)} ${STAGE_NAME[s]}`}></span>` : "")}</div>
        <div class="stage-legend note">${(["approved", "ready", "in-review", "changed", "draft"] as Stage[]).filter(s => count(s)).map(s => html`<span><i class=${s}></i>${count(s)} ${STAGE_NAME[s].toLowerCase()}</span>`)}</div>
        ${next && html`<p class=${`next-launch${next.date && daysUntil(next.date) <= 7 ? " soon" : ""}`}>Next: <a href=${`#/episode/${next.e.id}`}>${next.e.id}</a> ${when(next.date)}, ${STAGE_NAME[next.standing.stage].toLowerCase()}${next.standing.missing.length ? `: ${next.standing.missing.join(", ")}` : ""}.</p>`}
        ${shown.length ? html`<div class="review-list" role="list">${shown.map(x => html`<div class="review-row" role="listitem">
          <div class="who"><a href=${`#/episode/${x.e.id}`}><b>${x.e.id}</b></a> <span ...${inLang(langs.main)}>${tx(x.e.title)}</span>
            <div class="note">${x.date ?? "no date"} · ${when(x.date)}${review.value[x.e.id]?.ai !== false ? " · AI" : ""}</div></div>
          <${Stepper} stage=${x.standing.stage} compact />
          <div class="strip-col"><${BlockStrip} id=${x.e.id} blocks=${x.bs} standing=${x.standing} errorSteps=${new Set(x.mine.filter(m => m.level === "error" && m.step !== undefined).map(m => m.step!))} />
            <div class="note">${x.standing.done}/${x.standing.total} reviewed<${Passes} standing=${x.standing} />${x.standing.errors ? html` · <span class="bad">${x.standing.errors} error${x.standing.errors === 1 ? "" : "s"}</span>` : ""}${x.standing.openComments ? ` · ${x.standing.openComments} 💬` : ""}${x.ratio !== null ? ` · known words ${x.ratio}%` : ""}</div></div>
          <a class=${`button small${x.standing.stage === "ready" ? " primary" : ""}`} href=${`#/episode/${x.e.id}${x.standing.stage === "approved" ? "" : "/review"}`}>${ACTION[x.standing.stage]}</a>
        </div>`)}</div>` : html`<p class="note">${filter === "needs" ? "Nothing here needs you." : "None."}</p>`}
      </div>`;
    })}
  </section>`;
}

/** The notes as markdown: each episode's stage, what keeps it from Ready, and its comments. */
function markdown(list: { e: { id: string; title: unknown }; standing: Standing }[]): string {
  const w = world.value!, out = [`# Review notes: ${w.series ? tx(w.series.title, "en") : "the series"}`, ""];
  for (const { e, standing } of list) {
    const r = review.value[e.id] ?? {};
    out.push(`## ${e.id} · ${tx(e.title as never)}`, "", `- ${STAGE_NAME[standing.stage]}: ${standing.done} of ${standing.total} blocks reviewed${r.ai !== false ? " (written by AI)" : ""}${r.reviewer ? `, last by ${r.reviewer}` : ""}`);
    if (standing.missing.length && standing.stage !== "approved") out.push(`- Not ready: ${standing.missing.join(", ")}`);
    for (const c of r.comments ?? []) out.push(`- ${c.done ? "[x]" : "[ ]"} ${c.at ? `block ${c.at}: ` : ""}${c.text} (${c.by}, ${c.date})`);
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
