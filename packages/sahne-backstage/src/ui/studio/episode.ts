// An episode in the studio (#/episode/<id>): its script on the left (ui/studio/script.ts), between its head (title,
// premise, cast, what it teaches) and its quiz and glosses; the stage on the right, playing the block the cursor is in,
// with its transport (the opening, back, play, a scrubber over every cue and one through the cue playing), the learner's
// card, the flags its callbacks read, clicks on the stage, and its problems, review and changes. The stage lints run in
// the browser as you type, the story check on the server a moment later (what the edit brought is marked new). The
// selected block's full staging opens in a drawer. Save writes the file when the edit brings no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { allLanguages, langFor, lintStory, seasonOf, suggest, textOf, type StoryDoc } from "sahne-story";
import type { Run } from "sahne";
import { checkDocs, checked, change, draftOf, history, keyOf, openDoc, review, route, saveDocs, world } from "../../store.ts";
import { cueOf, cuePath, type Path } from "../../model/path.ts";
import { flagsIn, wordsOnly } from "../../model/steps.ts";
import { dirty } from "../../model/history.ts";
import { KIT, Preview, solidsOf } from "../../stage.ts";
import { pathOfKey, ReviewGutter, ReviewPanel } from "../review.ts";
import { blocksOf, standingOf, STAGE_NAME } from "../../model/review.ts";
import { NotesPanel } from "./notes.ts";
import { ChangesPanel } from "../changes.ts";
import { AskMenu } from "../assistant.ts";
import { settingsNow } from "../settings.ts";
import { Popover } from "../kit/index.ts";
import { Drawer, Icon, MOD } from "../kit/index.ts";
import { SaveButton } from "../readonly.ts";
import { SuggestionsReview } from "./suggestions.ts";
import { inLang, useLangs } from "../lang.ts";
import type { Problem } from "../../api.ts";
import { Script } from "./script.ts";
import { EpisodeHead, Glosses, Quiz } from "./sections.ts";
import { Details } from "./details.ts";
import { Direct } from "./direct.ts";
import { Strip } from "./strip.ts";
import { rememberScene, takeResume } from "../../recent.ts";
import { ProposalsBar, ProposedEpisode } from "./proposals.ts";
import { conflicts, postSelection, proposals, proposalsRead, shown as agentShown } from "../../events.ts";
import { ghostsOf, suggestionsOf, taken, type Suggest } from "../../model/autostage.ts";
import { get, set } from "../../model/path.ts";

declare global { interface Window { backstage?: { preview: Preview; select(path: Path | null): void } } }

export function Episode(p: { id?: string }) {
  const id = p.id ?? "";
  // a new episode an agent proposes is not on disk: its page shows the proposal until it is taken (then its draft opens)
  // the latest: an agent that goes on editing its new episode proposes it again, each holding the one before
  const proposed = proposals.value.filter(x => x.kind === "story" && x.doc === id && x.create).sort((a, b) => b.at - a.at)[0];
  const [missing, setMissing] = useState(false);
  const read = proposalsRead.value;
  useEffect(() => { setMissing(false); if (read && !draftOf("story", id) && !proposed) void openDoc("story", id).then(d => setMissing(!d)); }, [id, !!proposed, read]);
  const d = draftOf("story", id);
  if (d) return html`<${Studio} key=${id} id=${id} />`;
  if (proposed) return html`<${ProposedEpisode} x=${proposed} />`;
  return html`<p class="note">${missing ? html`There is no episode ${id}. <a href="#/board">Back to the board</a>` : `Opening ${id}…`}</p>`;
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
  const [tab, setTab] = useState<"problems" | "review" | "changes">("problems");
  const [asks, setAsks] = useState<{ x: number; y: number } | null>(null);
  const [here, setHere] = useState(false);
  const [details, setDetails] = useState(false);
  const cast = useMemo(() => [...new Set([w.series?.narrator ?? "kerim", w.series?.standin ?? "nima", ...(story.cast ?? []), ...(story.extras ?? [])])], [story.cast, story.extras]);
  const lang = langFor(langs.main);

  // the stage, once
  useEffect(() => {
    const pv = new Preview(box.current!, story, { places: w.places, characters: w.characters, onChange: redraw, languages: langs });
    preview.current = pv;
    shown.current = story;
    window.backstage = { preview: pv, select: x => select(x, true) };
    // opened from the home's Continue: back at the cue last worked on
    const resume = takeResume(p.id);
    if (resume !== null && resume < pv.player.info.length) pv.player.jump(resume);
    redraw();
    return () => { pv.destroy(); preview.current = null; };
  }, []);

  // the stage follows the document
  useEffect(() => {
    const pv = preview.current;
    if (!pv || shown.current === story) return;
    const t = setTimeout(() => {
      pv.update(story, Math.max(0, pv.player.next - 1), wordsOnly(shown.current, story, allLanguages(langs)));
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
  const [reviewing, setReviewing] = useState(false);
  const nameOf = (id: string) => textOf(w.characters[id]?.name, langs.main) ?? id;
  /** One block's suggestions, taken. */
  const takeAt = (at: Path) => {
    const ss = suggestions[at.join("/")];
    if (!ss?.length) return;
    edit(s => { const base = "beat" in ((get(s, at) ?? {}) as object) ? [...at, "beat"] : at; return set(s, base, ss.reduce((st, sg) => taken(st, sg.fix), (get(s, base) ?? {}) as Record<string, unknown>)); }, "take-auto");
  };
  /** The picked suggestions (by block), taken as one edit: what the review dialog adds. */
  const takeSome = (picked: Record<string, Suggest[]>) => edit(s => Object.entries(picked).reduce((x, [k, ss]) => {
    const path = k.split("/").map(v => (/^\d+$/.test(v) ? Number(v) : v));
    const base = "beat" in ((get(x, path) ?? {}) as object) ? [...path, "beat"] : path;
    return set(x, base, ss.reduce((st, sg) => taken(st, sg.fix), (get(x, base) ?? {}) as Record<string, unknown>));
  }, s), "take-all");

  const pv = preview.current, player = pv?.player, info = player?.info ?? [];
  // the cue on the stage is the scene last worked on (the home shows it)
  const at = player ? Math.max(0, player.next - 1) : -1;
  useEffect(() => { if (pv && at >= 0 && box.current) rememberScene(p.id, at, pv, box.current); }, [at, pv]);
  const ghosts = pv ? ghostsOf(info, pv.stage.perfs) : {};
  const playing = player && player.next > 0 ? cuePath(info[Math.max(0, player.next - 1)] ?? { step: 0, kind: "scene" }) : null;

  /** Select a block (and put the cursor in it with `focus`): the stage plays that moment. */
  function select(next: Path | null, focus = false) {
    // leaving a line: its staging suggestions taken, when the settings say so
    if (path && settingsNow()?.applySuggestions && (!next || next.join("/") !== path.join("/"))) takeAt(path);
    setPath(next);
    postSelection({ page: "episode", kind: "story", id: p.id, path: next });
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
  // an agent pointed here
  useEffect(() => { const s = agentShown.value; if (s && s.id === p.id && s.step) select(s.step, true); }, [agentShown.value?.n]);
  // from the review page: a block (#/episode/<id>/at/<key>), or the episode's review (#/episode/<id>/review)
  useEffect(() => { const [, , sub, k] = route.value; if (sub === "at" && k) select(pathOfKey(k), true); if (sub === "review") setTab("review"); }, [route.value.join("/")]);
  const mine = proposals.value.filter(x => (x.kind === "story" && x.doc === p.id) || x.also?.some(a => a.kind === "story" && a.doc === p.id));
  const conflict = conflicts.value.has(key);
  const problems = [...(checked.value[key] ?? []), ...lints];
  const marks: Record<number, { errors: number; warnings: number }> = {};
  for (const x of problems) if (x.step !== undefined && (x.level === "error" || x.level === "warning")) { const m = (marks[x.step] ??= { errors: 0, warnings: 0 }); if (x.level === "error") m.errors++; else m.warnings++; }
  const comments = review.value[p.id]?.comments?.length ?? 0;
  const allFlags = flagsIn(story);
  const errors = problems.filter(x => x.level === "error").length;
  const standing = standingOf(review.value[p.id], blocksOf(story, langs), { errors, translations: langs.translations });
  const save = () => void saveDocs([key, keyOf("season", `s${seasonOf(p.id)}`)]);

  return html`<section class="studio-episode" onKeyDown=${(e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } }}>
    <div class="toolbar row">
      <div class="grow" style="min-width:0"><h2 style="margin:0"><span class="note">${p.id}</span> <span ...${inLang(langs.main)}>${textOf(story.title, langs.main)}</span></h2>
        <span class="note">${[langs.translations[0] && html`<span ...${inLang(langs.translations[0])}>${textOf(story.title, langs.translations[0]) ?? ""}</span>`, story.kind === "special" && "special", story.releaseDate, story.draft && "draft"].filter(Boolean).map((x, k) => html`${k ? " · " : ""}${x}`)}</span></div>
      <button class=${`stage-btn ${standing.stage}`} onClick=${() => setTab("review")} title=${`Its review: ${standing.done} of ${standing.total} blocks reviewed${standing.missing.length ? `; not ready: ${standing.missing.join(", ")}` : ""}`}>${STAGE_NAME[standing.stage]}${comments ? ` · ${comments} 💬` : ""}</button>
      <button class="iconbtn" onClick=${() => history("story", p.id, "undo")} disabled=${!d.past.length} title=${`Undo (${MOD} Z)`} aria-label="Undo"><${Icon} name="undo" /></button>
      <button class="iconbtn" onClick=${() => history("story", p.id, "redo")} disabled=${!d.future.length} title=${`Redo (⇧${MOD} Z)`} aria-label="Redo"><${Icon} name="redo" /></button>
      <button onClick=${() => history("story", p.id, "revert")} disabled=${!dirty(d)}>Revert</button>
      ${nSuggest > 0 && html`<button onClick=${() => setReviewing(true)} title="The rules suggest staging the script lacks: a gesture the words call for, a feeling the punctuation shows, a fix for a check (the dashed chips in the script). Review them before any is added."><${Icon} name="spark" size=${16} /> ${nSuggest} suggested staging${nSuggest > 1 ? "s" : ""}…</button>`}
      ${w.ai && html`<button onClick=${(e: MouseEvent) => setAsks({ x: e.clientX, y: e.clientY + 12 })} title="Ask the assistant about this episode or the selected block"><${Icon} name="spark" size=${16} /> Ask</button>`}
      <button aria-pressed=${details} onClick=${() => setDetails(!details)} title="All the staging of the selected block">Details</button>
      <${SaveButton} onSave=${save} disabled=${!dirty(d)} title=${`Save (${MOD} S)`} />
    </div>
    ${conflict && html`<div class="banner">An agent wrote this episode while you had unsaved edits: <button class="small" onClick=${() => { void openDoc("story", p.id, true); conflicts.value = new Set([...conflicts.value].filter(k => k !== key)); }}>Take theirs</button> or save yours over it (the server will say it changed on disk; reload first to merge by hand).</div>`}
    <${ProposalsBar} list=${mine} story=${story} select=${select} />
    <div class="studio-split">
      <div class="script-col">
        <${EpisodeHead} story=${story} saved=${saved} edit=${edit} />
        <${Script} id=${p.id} story=${story} saved=${saved} selected=${path} focusTick=${focusTick} playing=${playing} select=${select} edit=${edit} marks=${marks} ghosts=${ghosts} suggestions=${suggestions}
          gutter=${(b: { path: Path }) => html`<${ReviewGutter} id=${p.id} story=${story} path=${b.path} onComments=${() => { select(b.path); setTab("review"); }} />`} />
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
          ${(["problems", "review", "changes"] as const).map(t => html`<button role="tab" aria-selected=${tab === t} onClick=${() => setTab(t)}>${t === "problems" ? `Notes${errors ? ` (${errors})` : ""}` : t === "review" ? "Review" : "Changes"}</button>`)}
        </div>
        ${tab === "problems" && html`<label class="row note"><input type="checkbox" style="width:auto" checked=${here} onChange=${(e: Event) => setHere((e.target as HTMLInputElement).checked)} /> only the selected block</label>
          <${NotesPanel} problems=${problems} path=${path} select=${select} edit=${edit} onlyHere=${here} />`}
        ${tab === "review" && html`<${ReviewPanel} id=${p.id} story=${story} path=${path} standing=${standing} />`}
        ${tab === "changes" && html`<${ChangesPanel} id=${p.id} story=${story} savedAt=${d.mtime} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} select=${(x: Path) => select(x, true)} />`}
      </div>
    </div>
    ${asks && html`<${Popover} x=${asks.x} y=${asks.y} onClose=${() => setAsks(null)} label="Ask the assistant"><${AskMenu} onDone=${() => setAsks(null)} /></${Popover}>`}
    ${reviewing && nSuggest > 0 && html`<${SuggestionsReview} story=${story} suggestions=${suggestions} name=${nameOf} onClose=${() => setReviewing(false)}
      onAdd=${(picked: Record<string, Suggest[]>) => { takeSome(picked); setReviewing(false); }} onGo=${(at: Path) => { setReviewing(false); select(at, true); }} />`}
    ${details && html`<${Drawer} float title="Details" onClose=${() => setDetails(false)}><${Details} story=${story} saved=${saved} path=${path} cast=${cast} edit=${edit} /></${Drawer}>`}
  </section>`;
}

/** Play controls: from the start, back, play on, a scrubber over every cue and one through the cue playing, the learner's card. */
function Transport(p: { preview: Preview; redraw(): void }) {
  // a card shows its line in the main language, and a choice option its first translation under it
  const { main, translations: [gloss] } = useLangs();
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
      ${f.turn.kind === "say" && html`<button onClick=${() => { pl.say(); p.redraw(); }}><b>Say:</b> <span ...${inLang(main)}>${f.turn.options[0].text[main] ?? f.turn.options[0].tr}</span></button>`}
      ${f.turn.kind === "choice" && f.turn.options.map((o, k) => html`<button onClick=${() => { pl.choose(k); p.redraw(); }}>${o.ok ? "✓ " : ""}<span ...${inLang(main)}>${o.text[main] ?? o.tr}</span>${gloss && o.text[gloss] && html` <small class="note" ...${inLang(gloss)}>${o.text[gloss]}</small>`}</button>`)}
      ${f.turn.kind === "act" && html`<button onClick=${() => { void pl.act().then(p.redraw); p.redraw(); }}>Act on stage: ${f.turn.act.kind} ${f.turn.prompt?.tr ?? ""}</button>`}
    </div>`}
    ${f.kind === "end" && html`<p class="note">The end of the episode.</p>`}
  </div>`;
}
