// An episode's page: the stage playing it, a scrubber over its cues, the card the learner would see (say, choose, act),
// switches for the flags its callbacks read, the list of its steps (a choice's options and their replies under it), the
// inspector for what is selected, and its problems: the stage lints in the browser as you type, the story check from the
// server a moment later (what the edit brought is marked new). Save writes the file when the edit brings no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { lintStory, suggest, type StoryDoc } from "sahne-story";
import type { Run } from "sahne";
import { checkDocs, checked, change, draftOf, history, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { cueOf, cuePath, equal, get, same, within, type Path } from "../model/path.ts";
import { flagsIn, rows, wordsOnly } from "../model/steps.ts";
import { dirty } from "../model/history.ts";
import { KIT, Preview, solidsOf } from "../stage.ts";
import { Check, Problems } from "./fields.ts";
import { Inspector } from "./inspector.ts";
import { ReviewPanel } from "./review.ts";
import { ChangesPanel } from "./changes.ts";
import { StagePick } from "./pick.ts";
import type { Problem } from "../api.ts";

declare global { interface Window { backstage?: { preview: Preview; select(path: Path | null): void } } }

export function Episode(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(false);
  useEffect(() => { void openDoc("story", id).then(d => setReady(!!d)); }, [id]);
  const d = draftOf("story", id);
  if (!ready || !d) return html`<p>Opening ${id}…</p>`;
  return html`<${Editor} id=${id} />`;
}

function Editor(p: { id: string }) {
  const w = world.value!;
  const d = draftOf("story", p.id)!;
  const story = d.doc as StoryDoc, saved = d.saved as StoryDoc;
  const key = keyOf("story", p.id);
  const box = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview | null>(null);
  const shown = useRef<StoryDoc>(story);
  const [, tick] = useState(0);
  const redraw = () => tick(n => n + 1);
  const [path, setPath] = useState<Path | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [tab, setTab] = useState<"edit" | "review" | "changes">("edit");
  const cast = useMemo(() => [...new Set([w.series?.narrator ?? "kerim", w.series?.standin ?? "nima", ...(story.cast ?? []), ...(story.extras ?? [])])], [story.cast, story.extras]);

  // the stage, once
  useEffect(() => {
    const pv = new Preview(box.current!, story, { places: w.places, characters: w.characters, onChange: redraw });
    preview.current = pv;
    shown.current = story;
    window.backstage = { preview: pv, select: setPath };
    redraw();
    return () => { pv.destroy(); preview.current = null; };
  }, []);

  // the stage follows the document
  useEffect(() => {
    const pv = preview.current;
    if (!pv || shown.current === story) return;
    const t = setTimeout(() => {
      const cue = Math.max(0, pv.player.next - 1);
      pv.update(story, cue, wordsOnly(shown.current, story));
      shown.current = story;
      redraw();
    }, 250);
    return () => clearTimeout(t);
  }, [story]);

  // the server's check, a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => void checkDocs([key]), dirty(d) ? 700 : 0);
    return () => clearTimeout(t);
  }, [story]);

  const lints = useMemo(() => {
    const o = { places: w.places, characters: w.characters, kit: KIT };
    try {
      const ps = lintStory(story, { ...o, solids: solidsOf(w.places) }).map(x => ({ ...x, doc: key, story: p.id } as Problem));
      const ss = suggest(story, o).map(x => ({ rule: "suggest", level: "info", story: p.id, step: x.step, option: x.option, message: x.message, doc: key } as Problem));
      return [...ps, ...ss];
    } catch (e) { return [{ rule: "lint", level: "error", story: p.id, message: String(e), doc: key } as Problem]; }
  }, [story]);

  const pv = preview.current;
  const player = pv?.player;
  const info = player?.info ?? [];
  const playing = player && player.next > 0 ? cuePath(info[Math.max(0, player.next - 1)] ?? { step: 0, kind: "scene" }) : null;

  function select(next: Path | null) {
    setPath(next);
    if (!next || !pv) return;
    const step = Number(next[1]);
    const option = next[2] === "choice" && next[4] !== undefined ? Number(next[4]) : undefined;
    let cue = cueOf(info, next);
    if (cue < 0 && option !== undefined) {
      // an option not picked: go to its choice and pick it
      const at = info.findIndex(i => i.step === step && i.turn?.kind === "choice");
      if (at >= 0) { player!.jump(at); player!.choose(option); redraw(); return; }
    }
    if (cue >= 0) { player!.jump(cue); redraw(); }
  }

  const edit = (fn: (s: StoryDoc) => StoryDoc, field?: string) => change<StoryDoc>("story", p.id, fn, field);
  const problems = [...(checked.value[key] ?? []), ...lints];
  const stepProblems = (n: number) => problems.filter(x => x.step === n && (x.level === "error" || x.level === "warning")).length;
  const allFlags = flagsIn(story);

  return html`<section>
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0">${p.id} · <span lang="tr">${story.title}</span></h2>
        <span class="note">${story.titleEn ?? ""}${story.kind ? ` · ${story.kind}` : ""}${story.releaseDate ? ` · ${story.releaseDate}` : ""}${story.draft ? " · draft" : ""}</span></div>
      <button onClick=${() => history("story", p.id, "undo")} disabled=${!d.past.length} title="Undo">↶ Undo</button>
      <button onClick=${() => history("story", p.id, "redo")} disabled=${!d.future.length} title="Redo">↷ Redo</button>
      <button onClick=${() => history("story", p.id, "revert")} disabled=${!dirty(d)}>Revert</button>
      <button class="primary" onClick=${() => void saveDocs([key])} disabled=${!dirty(d) || !w.writable} title=${w.writable ? "" : "read-only"}>Save</button>
    </div>
    <div class="episode">
      <div>
        <div class="stagebox"><div ref=${box}></div></div>
        ${player && html`<${Transport} preview=${pv!} redraw=${redraw} />`}
        ${pv && html`<${StagePick} preview=${pv} story=${story} path=${path} host=${box.current?.parentElement ?? null} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} />`}
        ${allFlags.length > 0 && html`<div class="panel" style="margin-top:8px"><b>Flags set by earlier stories</b>
          <div class="row">${allFlags.map(f => html`<${Check} label=${f} value=${flags.includes(f)} onInput=${(on: boolean) => {
            const next = on ? [...flags, f] : flags.filter(x => x !== f);
            setFlags(next); pv!.setFlags(next, Math.max(0, player!.next - 1)); redraw();
          }} />`)}</div></div>`}
        <div class="row" role="tablist" style="margin-top:10px">
          ${(["edit", "review", "changes"] as const).map(t => html`<button role="tab" aria-selected=${tab === t} class=${tab === t ? "primary" : ""} onClick=${() => setTab(t)}>${t === "edit" ? "Edit" : t === "review" ? "Review" : "Changes since the last commit"}</button>`)}
        </div>
        <div class="panel" style="margin-top:6px">
          ${tab === "edit" && html`<${Inspector} story=${story} saved=${saved} path=${path} cast=${cast} edit=${edit} select=${select} />`}
          ${tab === "review" && html`<${ReviewPanel} id=${p.id} story=${story} path=${path} />`}
          ${tab === "changes" && html`<${ChangesPanel} id=${p.id} story=${story} savedAt=${d.mtime} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} select=${select} />`}
        </div>
      </div>
      <div>
        <div class="row" style="margin-bottom:6px"><b class="grow">Steps</b><button class="small" onClick=${() => setPath(null)} aria-pressed=${!path}>The episode</button></div>
        <ul class="steps" role="listbox" aria-label="Steps">
          ${rows(story).map(r => {
            const n = Number(r.path[1]);
            const cls = [r.depth === 1 ? "sub" : r.depth === 2 ? "subsub" : "", playing && same(r.path, playing) ? "playing" : "", !equal(get(story, r.path), get(saved, r.path)) ? "changed" : ""].join(" ");
            const np = r.depth === 0 ? stepProblems(n) : 0;
            return html`<li class=${cls} role="option" aria-selected=${same(path, r.path)} onClick=${() => select(r.path)}>
              <span class="n">${r.n}</span>
              <span><span class="kind">${r.kind}</span>${r.who && html`<span class="who">${w.characters[r.who]?.name ?? r.who}</span>`}<span lang="tr">${r.text}</span>${r.gate && html` <span class="chip">${r.gate}</span>`}</span>
              <span>${np ? html`<span class="chip warn">${np}</span>` : ""}</span>
            </li>`;
          })}
        </ul>
        <h3>Problems</h3>
        <${Problems} problems=${path ? problems.filter(x => x.step === undefined || within(path, ["steps", x.step])) : problems} empty="No problems: the story check and the stage lints pass."
          onPick=${(x: Problem) => x.step !== undefined && select(["steps", x.step])} />
      </div>
    </div>
  </section>`;
}

/** Play controls: from the start, back, Devam, a slider over every cue, a slider through the cue playing, the learner's card. */
function Transport(p: { preview: Preview; redraw(): void }) {
  const pl = p.preview.player, info = pl.info, f = pl.footer();
  const run = pl.run as unknown as Run | null;
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const loop = () => { setT(run.dur ? Math.min(1, run.t / run.dur) : 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const at = Math.max(0, pl.next - 1);
  const jump = (i: number) => { pl.jump(i); p.redraw(); };
  return html`<div class="transport panel">
    <div class="row">
      <button onClick=${() => jump(0)} title="The opening scene">⏮</button>
      <button onClick=${() => jump(Math.max(0, at - 1))} title="The cue before">◀</button>
      <button class="primary" onClick=${() => { pl.devam(); p.redraw(); }} disabled=${f.kind === "turn" || f.kind === "end"}>${f.kind === "busy" ? "Finish ▸" : "Devam ▸"}</button>
      <span class="note grow">cue ${at} of ${info.length - 1}${info[at]?.who ? ` · ${info[at].who}` : ""}</span>
    </div>
    <label class="note">Scrub through the cues
      <input type="range" min="0" max=${Math.max(0, info.length - 1)} value=${at} onInput=${(e: Event) => jump(Number((e.target as HTMLInputElement).value))} /></label>
    ${run && html`<label class="note">Inside this cue (mid-cue frames show held props and gestures)
      <input type="range" min="0" max="1000" value=${Math.round(t * 1000)} onInput=${(e: Event) => { run.pause(); run.seek(Number((e.target as HTMLInputElement).value) / 1000 * run.dur); setT(run.t / Math.max(1, run.dur)); }} /></label>`}
    ${f.kind === "turn" && html`<div class="footcard">
      ${f.turn.kind === "say" && html`<button onClick=${() => { pl.say(); p.redraw(); }}><b>Söyle:</b> <span lang="tr">${f.turn.options[0].tr}</span></button>`}
      ${f.turn.kind === "choice" && f.turn.options.map((o, k) => html`<button onClick=${() => { pl.choose(k); p.redraw(); }}>${o.ok ? "✓ " : ""}<span lang="tr">${o.tr}</span> <small class="note">${o.en ?? ""}</small></button>`)}
      ${f.turn.kind === "act" && html`<button onClick=${() => { void pl.act().then(p.redraw); p.redraw(); }}>Act on stage: ${f.turn.act.kind} ${f.turn.prompt?.tr ?? ""}</button>`}
    </div>`}
    ${f.kind === "end" && html`<p class="note">The end of the episode.</p>`}
  </div>`;
}
