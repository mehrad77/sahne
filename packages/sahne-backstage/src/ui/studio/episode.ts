// An episode in the studio (#/episode/<id>): its script on the left (ui/studio/script.ts), between its head (title,
// premise, cast, what it teaches) and its quiz and glosses; the stage on the right, playing the block the cursor is in,
// with its transport (the opening, back, play, a scrubber over every cue and one through the cue playing), the learner's
// card, the flags its callbacks read, clicks on the stage, and its problems, review and changes. The stage lints run in
// the browser as you type, the story check on the server a moment later (what the edit brought is marked new). The
// selected block's full staging opens in a drawer. Save writes the file when the edit brings no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { langFor, lintStory, seasonOf, suggest, textOf, type StoryDoc } from "sahne-story";
import type { Run } from "sahne";
import { checkDocs, checked, change, draftOf, history, keyOf, openDoc, review, saveDocs, world } from "../../store.ts";
import { cueOf, cuePath, within, type Path } from "../../model/path.ts";
import { flagsIn, wordsOnly } from "../../model/steps.ts";
import { dirty } from "../../model/history.ts";
import { KIT, Preview, solidsOf } from "../../stage.ts";
import { Problems } from "../fields.ts";
import { ReviewPanel } from "../review.ts";
import { ChangesPanel } from "../changes.ts";
import { AiDraft, AiReview } from "../ai.ts";
import { Drawer, Icon, MOD } from "../kit/index.ts";
import { inLang, useLangs } from "../lang.ts";
import type { Problem } from "../../api.ts";
import { Script } from "./script.ts";
import { EpisodeHead, Glosses, Quiz } from "./sections.ts";
import { Details } from "./details.ts";
import { Direct } from "./direct.ts";
import { Strip } from "./strip.ts";
import { ghostsOf, suggestionsOf, taken } from "../../model/autostage.ts";
import { get, set } from "../../model/path.ts";

declare global { interface Window { backstage?: { preview: Preview; select(path: Path | null): void } } }

export function Episode(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(!!draftOf("story", id));
  useEffect(() => { void openDoc("story", id).then(d => setReady(!!d)); }, [id]);
  const d = draftOf("story", id);
  if (!ready || !d) return html`<p class="note">Opening ${id}…</p>`;
  return html`<${Studio} id=${id} />`;
}

function Studio(p: { id: string }) {
  const w = world.value!, langs = useLangs();
  const d = draftOf("story", p.id)!;
  const story = d.doc as StoryDoc, saved = d.saved as StoryDoc;
  const key = keyOf("story", p.id);
  const box = useRef<HTMLDivElement>(null);
  const preview = useRef<Preview | null>(null);
  const shown = useRef<StoryDoc>(story);
  const [, tick] = useState(0);
  const redraw = () => tick(n => n + 1);
  const [path, setPath] = useState<Path | null>(null), [focusTick, setFocusTick] = useState(0);
  const [flags, setFlags] = useState<string[]>([]);
  const [tab, setTab] = useState<"problems" | "review" | "changes" | "ai">("problems");
  const [details, setDetails] = useState(false);
  const cast = useMemo(() => [...new Set([w.series?.narrator ?? "kerim", w.series?.standin ?? "nima", ...(story.cast ?? []), ...(story.extras ?? [])])], [story.cast, story.extras]);
  const lang = langFor(langs.main);

  // the stage, once
  useEffect(() => {
    const pv = new Preview(box.current!, story, { places: w.places, characters: w.characters, onChange: redraw, languages: langs });
    preview.current = pv;
    shown.current = story;
    window.backstage = { preview: pv, select: x => select(x, true) };
    redraw();
    return () => { pv.destroy(); preview.current = null; };
  }, []);

  // the stage follows the document
  useEffect(() => {
    const pv = preview.current;
    if (!pv || shown.current === story) return;
    const t = setTimeout(() => {
      pv.update(story, Math.max(0, pv.player.next - 1), wordsOnly(shown.current, story));
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

  const { lints, suggestions } = useMemo(() => {
    const o = { places: w.places, characters: w.characters, kit: KIT, lang };
    try {
      const ps = lintStory(story, { ...o, solids: solidsOf(w.places) }).map(x => ({ ...x, doc: key, story: p.id } as Problem));
      const raw = suggest(story, o);
      const sugg = suggestionsOf(story, { lang, lints: raw, gestures: Object.keys(KIT.gestures), emotions: Object.keys(KIT.face.emotions), narrator: w.series?.narrator ?? "kerim", standin: w.series?.standin ?? "nima" });
      return { lints: ps, suggestions: sugg };
    } catch (e) { return { lints: [{ rule: "lint", level: "error", story: p.id, message: String(e), doc: key } as Problem], suggestions: {} }; }
  }, [story]);
  const nSuggest = Object.values(suggestions).reduce((n, x) => n + x.length, 0);
  /** Every suggestion of the episode, taken (one edit). */
  const takeAll = () => edit(s => Object.entries(suggestions).reduce((x, [k, ss]) => {
    const path = k.split("/").map(v => (/^\d+$/.test(v) ? Number(v) : v));
    const base = "beat" in ((get(x, path) ?? {}) as object) ? [...path, "beat"] : path;
    return set(x, base, ss.reduce((st, sg) => taken(st, sg.fix), (get(x, base) ?? {}) as Record<string, unknown>));
  }, s), "take-all");

  const pv = preview.current, player = pv?.player, info = player?.info ?? [];
  const ghosts = pv ? ghostsOf(info, pv.stage.perfs) : {};
  const playing = player && player.next > 0 ? cuePath(info[Math.max(0, player.next - 1)] ?? { step: 0, kind: "scene" }) : null;

  /** Select a block (and put the cursor in it with `focus`): the stage plays that moment. */
  function select(next: Path | null, focus = false) {
    setPath(next);
    if (focus) setFocusTick(n => n + 1);
    const pv = preview.current;
    if (!next || !pv) return;
    const pl = pv.player, inf = pl.info;
    const step = Number(next[1]);
    const option = next[2] === "choice" && next[4] !== undefined ? Number(next[4]) : undefined;
    const cue = cueOf(inf, next);
    if (cue < 0 && option !== undefined) {
      // an option not picked: go to its choice and pick it
      const at = inf.findIndex(i => i.step === step && i.turn?.kind === "choice");
      if (at >= 0) { pl.jump(at); pl.choose(option); redraw(); return; }
    }
    if (cue >= 0) { pl.jump(cue); redraw(); }
  }

  const edit = (fn: (s: StoryDoc) => StoryDoc, field?: string) => change<StoryDoc>("story", p.id, fn, field);
  const problems = [...(checked.value[key] ?? []), ...lints];
  const marks: Record<number, { errors: number; warnings: number }> = {};
  for (const x of problems) if (x.step !== undefined && (x.level === "error" || x.level === "warning")) { const m = (marks[x.step] ??= { errors: 0, warnings: 0 }); if (x.level === "error") m.errors++; else m.warnings++; }
  const status = review.value[p.id]?.status ?? "draft", comments = review.value[p.id]?.comments?.length ?? 0;
  const allFlags = flagsIn(story);
  const errors = problems.filter(x => x.level === "error").length;
  const save = () => void saveDocs([key, keyOf("season", `s${seasonOf(p.id)}`)]);

  return html`<section class="studio-episode" onKeyDown=${(e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } }}>
    <div class="toolbar row">
      <div class="grow" style="min-width:0"><h2 style="margin:0"><span class="note">${p.id}</span> <span ...${inLang(langs.main)}>${textOf(story.title, langs.main)}</span></h2>
        <span class="note">${textOf(story.title, "en") ?? ""}${story.kind === "special" ? " · special" : ""}${story.releaseDate ? ` · ${story.releaseDate}` : ""}${story.draft ? " · draft" : ""}</span></div>
      <button onClick=${() => setTab("review")} title="Its status and comments">${status === "draft" ? "To review" : status}${comments ? ` · ${comments} 💬` : ""}</button>
      <button class="iconbtn" onClick=${() => history("story", p.id, "undo")} disabled=${!d.past.length} title=${`Undo (${MOD} Z)`} aria-label="Undo"><${Icon} name="undo" /></button>
      <button class="iconbtn" onClick=${() => history("story", p.id, "redo")} disabled=${!d.future.length} title=${`Redo (⇧${MOD} Z)`} aria-label="Redo"><${Icon} name="redo" /></button>
      <button onClick=${() => history("story", p.id, "revert")} disabled=${!dirty(d)}>Revert</button>
      ${nSuggest > 0 && html`<button onClick=${takeAll} title="Take every staging the rules suggest (the dashed chips); undo takes them back">Take ${nSuggest} suggestion${nSuggest > 1 ? "s" : ""}</button>`}
      <button aria-pressed=${details} onClick=${() => setDetails(!details)} title="All the staging of the selected block">Details</button>
      <button class="primary" onClick=${save} disabled=${!dirty(d) || !w.writable} title=${w.writable ? `Save (${MOD} S)` : "read-only"}><${Icon} name="save" size=${16} /> Save</button>
    </div>
    <div class="studio-split">
      <div class="script-col">
        <${EpisodeHead} story=${story} saved=${saved} edit=${edit} />
        <${Script} id=${p.id} story=${story} saved=${saved} selected=${path} focusTick=${focusTick} playing=${playing} select=${select} edit=${edit} marks=${marks} ghosts=${ghosts} suggestions=${suggestions} />
        <${Quiz} story=${story} saved=${saved} edit=${edit} />
        <${Glosses} story=${story} saved=${saved} edit=${edit} />
      </div>
      <div class="stage-col">
        ${pv && player && html`<${Strip} preview=${pv} story=${shown.current} at=${Math.max(0, player.next - 1)} select=${select} jump=${(i: number) => { player.jump(i); redraw(); }} />`}
        <div class="stagebox"><div ref=${box}></div></div>
        ${player && html`<${Transport} preview=${pv!} redraw=${redraw} />`}
        ${pv && html`<${Direct} preview=${pv} story=${story} path=${path} host=${box.current?.parentElement ?? null} edit=${edit} cast=${cast} />`}
        ${allFlags.length > 0 && html`<div class="flags"><span class="note">Flags from earlier stories:</span>${allFlags.map(f => html`<button class=${`chip${flags.includes(f) ? " on" : ""}`} aria-pressed=${flags.includes(f)} onClick=${() => {
          const next = flags.includes(f) ? flags.filter(x => x !== f) : [...flags, f];
          setFlags(next); pv!.setFlags(next, Math.max(0, player!.next - 1)); redraw();
        }}>${f}</button>`)}</div>`}
        <div class="tabs" role="tablist">
          ${(["problems", "review", "changes", ...(w.ai ? ["ai"] as const : [])] as const).map(t => html`<button role="tab" aria-selected=${tab === t} onClick=${() => setTab(t)}>${t === "problems" ? `Problems${errors ? ` (${errors})` : ""}` : t === "review" ? "Review" : t === "ai" ? "Second reader" : "Changes"}</button>`)}
        </div>
        ${tab === "problems" && html`<${Problems} problems=${path ? problems.filter(x => x.step === undefined || within(path, ["steps", x.step])) : problems} empty="No problems: the story check and the stage lints pass."
          onPick=${(x: Problem) => x.step !== undefined && select(["steps", x.step], true)} />`}
        ${tab === "review" && html`<${ReviewPanel} id=${p.id} story=${story} path=${path} />`}
        ${tab === "ai" && html`<${AiDraft} story=${story} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} /><${AiReview} story=${story} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} select=${(x: Path) => select(x, true)} />`}
        ${tab === "changes" && html`<${ChangesPanel} id=${p.id} story=${story} savedAt=${d.mtime} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} select=${(x: Path) => select(x, true)} />`}
      </div>
    </div>
    ${details && html`<${Drawer} title="Details" onClose=${() => setDetails(false)}><${Details} story=${story} saved=${saved} path=${path} cast=${cast} edit=${edit} /></${Drawer}>`}
  </section>`;
}

/** Play controls: from the start, back, play on, a scrubber over every cue and one through the cue playing, the learner's card. */
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
  return html`<div class="transport">
    <div class="row">
      <button class="iconbtn" onClick=${() => jump(0)} title="The opening scene" aria-label="The opening scene"><${Icon} name="prev" /></button>
      <button class="iconbtn" onClick=${() => jump(Math.max(0, at - 1))} title="The cue before" aria-label="The cue before"><${Icon} name="undo" /></button>
      <button class="primary" onClick=${() => { pl.devam(); p.redraw(); }} disabled=${f.kind === "turn" || f.kind === "end"}><${Icon} name="play" size=${14} /> ${f.kind === "busy" ? "Finish" : "Next"}</button>
      <input type="range" class="grow" min="0" max=${Math.max(0, info.length - 1)} value=${at} aria-label="Scrub through the cues" onInput=${(e: Event) => jump(Number((e.target as HTMLInputElement).value))} />
      <span class="note">${at}/${info.length - 1}</span>
    </div>
    ${run && html`<input type="range" min="0" max="1000" value=${Math.round(t * 1000)} aria-label="Inside this cue" title="Inside this cue (mid-cue: held props and gestures)" onInput=${(e: Event) => { run.pause(); run.seek(Number((e.target as HTMLInputElement).value) / 1000 * run.dur); setT(run.t / Math.max(1, run.dur)); }} />`}
    ${f.kind === "turn" && html`<div class="footcard">
      ${f.turn.kind === "say" && html`<button onClick=${() => { pl.say(); p.redraw(); }}><b>Say:</b> <span ...${inLang(useLangs().main)}>${f.turn.options[0].tr}</span></button>`}
      ${f.turn.kind === "choice" && f.turn.options.map((o, k) => html`<button onClick=${() => { pl.choose(k); p.redraw(); }}>${o.ok ? "✓ " : ""}<span ...${inLang(useLangs().main)}>${o.tr}</span> <small class="note">${o.en ?? ""}</small></button>`)}
      ${f.turn.kind === "act" && html`<button onClick=${() => { void pl.act().then(p.redraw); p.redraw(); }}>Act on stage: ${f.turn.act.kind} ${f.turn.prompt?.tr ?? ""}</button>`}
    </div>`}
    ${f.kind === "end" && html`<p class="note">The end of the episode.</p>`}
  </div>`;
}
