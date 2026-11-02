// A new version of an episode's steps, step by step (model/stepdiff.ts), drawn the way the script draws them: a summary
// whose parts jump to their step, the unchanged steps folded, and each step that changed with its speaker, its line and
// its translations word by word, its staging as chips added and removed, and, asked for, its picture before and after.
// When too much changed to read this way, a link to the episode's preview instead. Used by an episode's proposals
// (studio/proposals.ts), a proposal's card (proposed.ts) and the changes since the last commit (changes.ts).

import { html } from "htm/preact";
import { useMemo, useRef, useState } from "preact/hooks";
import { adaptStory, languagesOf, playOf, textOf, type StoryDoc } from "sahne-story";
import type { Part } from "../model/diff.ts";
import { stepDiff, type StepChange } from "../model/stepdiff.ts";
import { mergedOnto, type Proposal } from "../events.ts";
import { world } from "../store.ts";
import { cueThumb } from "../thumbs.ts";
import { Picture } from "./kit/gallery.ts";
import { inLang, langName, useLangs } from "./lang.ts";
import { storyPluginsOf } from "../model/plugins.ts";

export type At = { was?: number; now?: number };

/**
 * An episode as accepting a proposal would leave it, from `doc` as it is open or on disk: the proposal's changes merged
 * into it (`mergedOnto`, as `accept` in events.ts does), so the diff never shows the person's own edits, or a save made
 * since, undone; unchanged when it cannot be taken.
 */
export const afterAccepting = (x: Proposal, doc: StoryDoc): StoryDoc => {
  const r = mergedOnto(x, doc);
  return ("doc" in r ? r.doc : doc) as StoryDoc;
};

const parts = (ps: Part[]) => ps.map(d => (d.op === "=" ? d.text : d.op === "-" ? html`<del>${d.text}</del>` : html`<ins>${d.text}</ins>`));

/** The end of step `i` of an episode as the stage draws it (null when the episode cannot be played). */
const pictureOf = (doc: StoryDoc, i: number) => async (): Promise<string | null> => {
  try {
    const w = world.value!;
    const a = adaptStory(doc, { places: w.places, characters: w.characters, languages: languagesOf(w.series), plugins: storyPluginsOf(w.series), play: playOf(doc, w.series) });
    const perf = a.perform();
    const k = perf.info.map(c => c.step).lastIndexOf(i);
    return k < 0 ? null : await cueThumb(perf.script.cues, k, a.load);
  } catch { return null; }
};

const STATUS: Record<StepChange["status"], string> = { same: "", added: "added", removed: "removed", moved: "moved", changed: "changed" };

export function StepDiff(p: {
  was: StoryDoc | null | undefined; now: StoryDoc;
  /** Go to a step (its index before and after; the caller picks the one its script shows). */
  go?(at: At): void;
  /** The episode's preview, linked instead of the diff when too much changed. */
  preview?: string;
  /** Buttons of a step's own (Put back as committed). */
  actions?(e: StepChange): unknown;
}) {
  const { main, translations } = useLangs(), w = world.value!;
  const name = (id: string) => textOf(w.characters[id]?.name, main) ?? id;
  const d = useMemo(() => stepDiff(p.was, p.now, { main, langs: [main, ...translations], name }), [p.was, p.now, main]);
  const [open, setOpen] = useState<Set<number>>(new Set()), [anyway, setAnyway] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const c = d.counts;
  const jump = (pred: (e: StepChange) => boolean) => {
    const k = d.steps.findIndex(pred);
    if (k < 0) return;
    box.current?.querySelector(`[data-sd="${k}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    p.go?.({ was: d.steps[k].was, now: d.steps[k].now });
  };
  const restaged = (e: StepChange) => e.chips.added.length + e.chips.removed.length > 0 && e.status !== "added" && e.status !== "removed";
  const summary = [
    c.added > 0 && html`<button class="link" onClick=${() => jump(e => e.status === "added")}>${c.added} added</button>`,
    c.removed > 0 && html`<button class="link" onClick=${() => jump(e => e.status === "removed")}>${c.removed} removed</button>`,
    c.changed > 0 && html`<button class="link" onClick=${() => jump(e => e.status === "changed")}>${c.changed} changed</button>`,
    c.moved > 0 && html`<button class="link" onClick=${() => jump(e => e.status === "moved")}>${c.moved} moved</button>`,
    c.staging > 0 && html`<button class="link" onClick=${() => jump(restaged)}>${c.staging} restaged</button>`,
  ].filter(Boolean);
  if (!summary.length) return html`<p class="note">The steps are the same.</p>`;
  const head = html`<div class="sd-summary"><b>Steps</b> ${summary.map((x, k) => html`${k ? " · " : ""}${x}`)}</div>`;
  if (d.preview && p.preview && !anyway) return html`<div class="stepdiff" ref=${box}>${head}
    <p class="sd-preview">${p.was?.steps?.length ? "Most of the episode changes" : "A new episode"}: <a href=${p.preview}>open the preview</a> to read it as a whole, or <button class="link" onClick=${() => setAnyway(true)}>see it step by step</button>.</p></div>`;

  // the unchanged steps folded, a run at a time
  const out: unknown[] = [];
  for (let k = 0; k < d.steps.length;) {
    if (d.steps[k].status !== "same") { out.push(html`<${Step} key=${k} k=${k} e=${d.steps[k]} was=${p.was} now=${p.now} name=${name} go=${p.go} actions=${p.actions} />`); k++; continue; }
    let end = k;
    while (end < d.steps.length && d.steps[end].status === "same") end++;
    const from = k;
    if (open.has(from)) for (let q = from; q < end; q++) out.push(html`<${Step} key=${q} k=${q} e=${d.steps[q]} was=${p.was} now=${p.now} name=${name} go=${p.go} />`);
    else out.push(html`<button key=${`f${from}`} class="sd-fold" onClick=${() => setOpen(new Set([...open, from]))}>… ${end - from} step${end - from > 1 ? "s" : ""} unchanged</button>`);
    k = end;
  }
  return html`<div class="stepdiff" ref=${box}>${head}${out}</div>`;
}

/** One step: its number (a moved one's place before and after), the step as the script draws it, its pictures. */
function Step(p: { k: number; e: StepChange; was: StoryDoc | null | undefined; now: StoryDoc; name(id: string): string; go?(at: At): void; actions?(e: StepChange): unknown }) {
  const e = p.e, w = world.value!, { main } = useLangs();
  const [pics, setPics] = useState(false);
  const n = e.status === "moved" ? `${e.was} → ${e.now}` : String(e.now ?? e.was);
  const color = e.who ? (w.characters[e.who]?.color as string | undefined) : undefined;
  const said = e.kind === "line";
  const chips = [...e.chips.kept.map(c => html`<span class="schip">${c}</span>`), ...e.chips.removed.map(c => html`<span class="schip out"><del>${c}</del></span>`), ...e.chips.added.map(c => html`<span class="schip in"><ins>${c}</ins></span>`)];
  const [first, ...rest] = e.texts;
  const pictured = e.status !== "same" && e.kind !== "choice";
  return html`<div class=${`sd-step ${STATUS[e.status]}`} data-sd=${p.k}>
    <button class="sd-n" title=${e.status === "same" ? "Go to this step" : `${e.status}: go to this step`} onClick=${() => p.go?.({ was: e.was, now: e.now })}>${n}</button>
    <div class="sd-body">
      <div class="line-head">
        ${said || e.kind === "beat" ? html`<span class="speaker" style=${color ? `--who:${color}` : ""}>${e.who ? p.name(e.who) : "everyone"}${e.narr ? html`<small> to the viewer</small>` : ""}${e.kind === "beat" ? html`<small> does</small>` : ""}</span>` : html`<span class="sd-kind">${e.kind}</span>`}
        ${chips}${e.status !== "same" && e.status !== "changed" && html`<span class=${`sd-tag ${e.status}`}>${e.status}</span>`}
      </div>
      ${first && html`<div class="sd-said" ...${inLang(first.lang)}>${parts(first.parts)}</div>`}
      ${rest.length > 0 && html`<div class="trans">${rest.map(t => html`<div class="trow"><span class="lang-tag" title=${langName(t.lang)}>${t.lang}</span><span ...${inLang(t.lang)}>${parts(t.parts)}</span></div>`)}</div>`}
      ${e.words.map(r => html`<div class="sd-words" ...${inLang(main)}>${parts(r)}</div>`)}
      ${e.other.length > 0 && html`<p class="note">Also changed: ${e.other.join(", ")}</p>`}
      ${pics && html`<div class="sd-pics">
        ${e.was !== undefined && p.was && html`<figure><${Pic} doc=${p.was} i=${e.was} /><figcaption>Before</figcaption></figure>`}
        ${e.now !== undefined && html`<figure><${Pic} doc=${p.now} i=${e.now} /><figcaption>${p.was ? "After" : "Proposed"}</figcaption></figure>`}</div>`}
    </div>
    <div class="sd-acts">${pictured && html`<button class="small" aria-pressed=${pics} onClick=${() => setPics(!pics)} title="The stage at the end of this step, before and after">Pictures</button>`}${p.actions?.(e)}</div>
  </div>`;
}

/** A step's picture, drawn once asked for (the art function is kept, so the picture is not asked for again each render). */
function Pic(p: { doc: StoryDoc; i: number }) {
  const art = useMemo(() => pictureOf(p.doc, p.i), [p.doc, p.i]);
  return html`<${Picture} art=${art} label=${`Step ${p.i}`} />`;
}
