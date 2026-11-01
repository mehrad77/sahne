// Review: where each episode stands in the work, read from model/progress.ts as the episode page's stages bar is. The review
// page (#/review): what needs you, nearest launch first, each episode with its stages (Brief, Script, Translate, a plugin's
// own, Review), the one it is at, and a link straight there; and the notes exported as markdown. The notes live in the
// sidecar (server/review.ts), never in a story. The translations' checks (written in Translate, `markStep`) are the marks
// it keeps. Nothing here assumes language lessons: a plugin's stage shows only when the series turns it on.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { SeasonDoc, StoryDoc } from "sahne-story";
import { allProblems, draftOf, loadAllProblems, openDoc, review, reviewer, setReview, world, type EpisodeReview } from "../store.ts";
import { datesOf } from "../model/board.ts";
import type { Path } from "../model/path.ts";
import { checkedOf, rowKey, sigAt } from "../model/review.ts";
import { progressOf, type Progress } from "../model/progress.ts";
import { tx } from "./fields.ts";
import { inLang, useLangs } from "./lang.ts";
import { editorPluginsOf } from "./plugins/index.ts";

export { checkedOf, rowKey };
const pad = (n: number) => String(n).padStart(2, "0");
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

/** Where an episode stands, in a word: approved, changed since, ready to approve (every other stage done), or in progress. */
type Standing = "approved" | "changed" | "ready" | "working";
const standingOf = (p: Progress): Standing => p.approved ? "approved" : p.changedSinceApproved ? "changed" : p.stages.filter(x => x.key !== "review").every(x => x.done) && !p.openComments ? "ready" : "working";
const STANDING: Record<Standing, string> = { approved: "Approved", changed: "Changed since approved", ready: "Ready to approve", working: "In progress" };

type Filter = "needs" | "errors" | "week" | "changed" | "ai" | "all";
const FILTERS: [Filter, string][] = [["needs", "Needs you"], ["errors", "Has errors"], ["week", "Launches this week"], ["changed", "Changed since approved"], ["ai", "AI-written"], ["all", "All"]];

/** #/review: what needs you, nearest launch first, and where every episode stands. */
export function ReviewPage() {
  const w = world.value!, langs = useLangs();
  const [filter, setFilter] = useState<Filter>("needs");
  const [, opened] = useState(0);
  useEffect(() => { if (!allProblems.value) void loadAllProblems(); void Promise.all(w.episodes.map(e => openDoc("story", e.id))).then(() => opened(n => n + 1)); }, []);
  const ps = allProblems.value, plugins = editorPluginsOf(w.series);
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n) as (SeasonDoc & { n: number })[];
  const orphan = w.episodes.filter(e => !seasons.some(s => s.n === e.season));
  const rowsOf = (eps: typeof w.episodes, se?: SeasonDoc) => {
    const dates = se ? datesOf(se, eps) : {};
    return eps.flatMap(e => {
      const story = draftOf("story", e.id)?.saved as StoryDoc | undefined;
      if (!story) return [];
      const mine = ps?.filter(x => x.doc === `story:${e.id}`) ?? [];
      const stages = plugins.flatMap(ep => (ep.stage ? [{ key: ep.stage.key, name: ep.stage.name, ...ep.stage.state({ story, problems: mine }) }] : []));
      const progress = progressOf({ story, langs, review: review.value[e.id], errors: mine.filter(x => x.level === "error").length, suggestions: {}, stages });
      return [{ e, date: dates[e.id] ?? e.releaseDate, errors: mine.filter(x => x.level === "error").length, progress, standing: standingOf(progress) }];
    }).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.e.id.localeCompare(b.e.id));
  };
  type R = ReturnType<typeof rowsOf>[number];
  const keep = (x: R) => filter === "all" ? true : filter === "needs" ? x.standing !== "approved" : filter === "errors" ? x.errors > 0
    : filter === "week" ? !!x.date && daysUntil(x.date) >= 0 && daysUntil(x.date) <= 7 : filter === "changed" ? x.standing === "changed" : review.value[x.e.id]?.ai !== false;
  const groups: [string, R[]][] = [...seasons.map(s => [tx(s.title, "en"), rowsOf(w.episodes.filter(e => e.season === s.n), s)] as [string, R[]]), ...(orphan.length ? [["Without a season", rowsOf(orphan)] as [string, R[]]] : [])];
  const order: Standing[] = ["approved", "ready", "working", "changed"];
  return html`<section class="review-page">
    <div class="row"><h2 class="grow">Review</h2><button class="small" onClick=${() => download(markdown(groups.flatMap(g => g[1])))}>Export the notes (markdown)</button></div>
    <p class="note">What needs a person's eye before it launches, nearest launch first. An episode is ready to approve when every stage of its work is done (its brief, its script staged${langs.translations.length ? ", every translation checked" : ""}${plugins.some(p => p.stage) ? ", the plugins' checks passing" : ""}) and no comment is open.</p>
    <div class="filters" role="group" aria-label="Show">${FILTERS.map(([f, label]) => html`<button class=${`chip${filter === f ? " on" : ""}`} aria-pressed=${filter === f} onClick=${() => setFilter(f)}>${label}</button>`)}</div>
    ${groups.map(([title, all]) => {
      const shown = all.filter(keep), count = (s: Standing) => all.filter(x => x.standing === s).length;
      const next = all.find(x => x.date && daysUntil(x.date) >= 0 && x.standing !== "approved");
      return html`<div class="review-season">
        <div class="row"><h3 class="grow">${title} <span class="note">· ${count("approved")} of ${all.length} approved</span></h3></div>
        <div class="stage-bar" role="img" aria-label=${order.map(s => `${count(s)} ${STANDING[s]}`).join(", ")}>
          ${order.map(s => count(s) ? html`<span class=${s === "working" ? "in-review" : s} style=${`flex:${count(s)}`} title=${`${count(s)} ${STANDING[s]}`}></span>` : "")}</div>
        <div class="stage-legend note">${order.filter(s => count(s)).map(s => html`<span><i class=${s === "working" ? "in-review" : s}></i>${count(s)} ${STANDING[s].toLowerCase()}</span>`)}</div>
        ${next && html`<p class=${`next-launch${next.date && daysUntil(next.date) <= 7 ? " soon" : ""}`}>Next: <a href=${`#/episode/${next.e.id}`}>${next.e.id}</a> ${when(next.date)}, ${STANDING[next.standing].toLowerCase()}.</p>`}
        ${shown.length ? html`<div class="review-list" role="list">${shown.map(x => {
          const at = x.progress.next ?? "review", st = x.progress.stages.find(y => y.key === at);
          return html`<div class="review-row" role="listitem">
          <div class="who"><a href=${`#/episode/${x.e.id}`}><b>${x.e.id}</b></a> <span ...${inLang(langs.main)}>${tx(x.e.title)}</span>
            <div class="note">${x.date ?? "no date"} · ${when(x.date)}${review.value[x.e.id]?.ai !== false ? " · AI" : ""}</div></div>
          <div class="mini-stages" aria-label="Its stages">${x.progress.stages.map(y => html`<span class=${`ms${y.done ? " done" : ""}${y.key === x.progress.next ? " next" : ""}`} title=${`${y.name}: ${y.state}`}>${y.done ? "✓" : ""} ${y.name}</span>`)}</div>
          <div class="note">${STANDING[x.standing]}${st && x.standing !== "approved" ? ` · ${st.name}: ${st.state}` : ""}${x.errors ? html` · <span class="bad">${x.errors} error${x.errors === 1 ? "" : "s"}</span>` : ""}</div>
          <a class=${`button small${x.standing === "ready" ? " primary" : ""}`} href=${`#/episode/${x.e.id}/${x.standing === "ready" || x.standing === "approved" || x.standing === "changed" ? "review" : at}`}>${x.standing === "ready" ? "Approve" : x.standing === "approved" ? "Open" : x.standing === "changed" ? "Look again" : `Go to ${st?.name ?? "it"}`}</a>
        </div>`; })}</div>` : html`<p class="note">${filter === "needs" ? "Nothing here needs you." : "None."}</p>`}
      </div>`;
    })}
  </section>`;
}

/** The notes as markdown: each episode's standing, the stage it is at, and its comments. */
function markdown(list: { e: { id: string; title: unknown }; progress: Progress; standing: Standing }[]): string {
  const w = world.value!, out = [`# Review notes: ${w.series ? tx(w.series.title, "en") : "the series"}`, ""];
  for (const { e, progress, standing } of list) {
    const r = review.value[e.id] ?? {};
    out.push(`## ${e.id} · ${tx(e.title as never)}`, "", `- ${STANDING[standing]}${r.ai !== false ? " (written by AI)" : ""}${r.reviewer ? `, last by ${r.reviewer}` : ""}`);
    for (const st of progress.stages) out.push(`- ${st.done ? "[x]" : "[ ]"} ${st.name}: ${st.state}`);
    for (const c of r.comments ?? []) out.push(`- ${c.done ? "[x]" : "[ ]"} ${c.at ? `line ${c.at}: ` : ""}${c.text} (${c.by}, ${c.date})`);
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
