// An episode in the studio (#/episode/<id>[/<stage>]), built around the stages of the work (model/progress.ts): the top says
// where it stands (the stages bar: Brief, Script, Translate, a plugin's own, Review), the one next step, and a task writing
// it; the stage on the page fills the left column (brief.ts, script.ts, translate.ts, a plugin's Sections, reviewstage.ts);
// the stage on the right plays the line you are on, with its transport (the opening, back, next, play, a scrubber over every
// cue and one through the cue playing), the viewer's card, the flags its callbacks read and, in Script, directing on it;
// and Needs you (needs.ts) gathers what wants a person. The stage lints run in the browser as you type, the story check on
// the server a moment later (what the edit brought is marked new). Save writes the file when the edit brings no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { allLanguages, langFor, lintStory, playOf, seasonOf, suggest, textOf, type StoryDoc } from "sahne-story";
import type { Run } from "sahne";
import { checkDocs, checked, change, draftOf, go, history, keyOf, openDoc, review, route, saveDocs, setReview, world } from "../../store.ts";
import { cueOf, cuePath, type Path } from "../../model/path.ts";
import { flagsIn, wordsOnly } from "../../model/steps.ts";
import { dirty } from "../../model/history.ts";
import { KIT, Preview, solidsOf } from "../../stage.ts";
import { pathOfKey } from "../review.ts";
import { ReadThrough, ReviewSide } from "./reviewstage.ts";
import { blocksOf, checkedOf } from "../../model/review.ts";
import { episodeSig, nextStepOf, progressOf, type StageKey, type StepAction } from "../../model/progress.ts";
import { blocks } from "../../model/script.ts";
import { marks as marksNow, runs as runsNow } from "../../runs.ts";
import { NeedsYou } from "./needs.ts";
import { ChangesPanel } from "../changes.ts";
import { AskMenu, send } from "../assistant.ts";
import { settingsNow } from "../settings.ts";
import { Popover } from "../kit/index.ts";
import { Drawer, Icon, MOD, Modal } from "../kit/index.ts";
import { SeriesSettings } from "../seasons.ts";
import { Translate } from "./translate.ts";
import { SaveButton } from "../readonly.ts";
import { inLang, langName, useLangs } from "../lang.ts";
import type { Problem } from "../../api.ts";
import { Script } from "./script.ts";
import { Brief } from "./brief.ts";
import { editorPluginsOf } from "../plugins/index.ts";
import { Details } from "./details.ts";
import { Direct } from "./direct.ts";
import { Strip } from "./strip.ts";
import { rememberScene, takeResume } from "../../recent.ts";
import { ProposedEpisode } from "./proposals.ts";
import { conflicts, postSelection, proposals, proposalsRead, shown as agentShown } from "../../events.ts";
import { ghostsOf, suggestionsOf, taken, type Suggest } from "../../model/autostage.ts";
import { get, set } from "../../model/path.ts";
import { MadeByTask } from "../madeby.ts";
import { storyPluginsOf } from "../../model/plugins.ts";

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
  // a proposal's link to read it as a whole (studio/proposals.ts)
  const [, , sub, pid] = route.value, whole = sub === "proposal" ? proposals.value.find(x => x.id === pid && x.kind === "story" && x.doc === id) : undefined;
  if (whole) return html`<${ProposedEpisode} x=${whole} />`;
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
  const [asks, setAsks] = useState<{ x: number; y: number } | null>(null);
  const [more, setMore] = useState<{ x: number; y: number } | null>(null);
  const [drawer, setDrawer] = useState<"details" | "changes" | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const [trLang, setTrLang] = useState<string>(langs.translations[0] ?? langs.main);
  // the Script stage's view: only the words, and a translation under each line (remembered in this browser)
  const [onlyWords, setOnlyWords] = useStored("backstage:words-only", false);
  const [showTr, setShowTr] = useStored("backstage:show-translation", false);
  const cast = useMemo(() => [...new Set([w.series?.narrator ?? "kerim", w.series?.standin ?? "nima", ...(story.cast ?? []), ...(story.extras ?? [])])], [story.cast, story.extras]);
  const lang = langFor(langs.main);
  const plugins = editorPluginsOf(w.series);

  // the stage, once
  useEffect(() => {
    const pv = new Preview(box.current!, story, { places: w.places, characters: w.characters, onChange: redraw, languages: langs, plugins: storyPluginsOf(w.series), play: w.series?.play });
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
    const o = { places: w.places, characters: w.characters, kit: KIT, lang, plugins: storyPluginsOf(w.series) };
    try {
      const ps = lintStory(story, { ...o, solids: solidsOf(w.places) }).map(x => ({ ...x, doc: key, story: p.id } as Problem));
      const raw = suggest(story, o);
      const sugg = suggestionsOf(story, { lang, lints: raw, gestures: Object.keys(KIT.gestures), emotions: Object.keys(KIT.face.emotions), narrator: w.series?.narrator ?? "kerim", standin: w.series?.standin ?? "nima" });
      return { lints: ps, suggestions: sugg };
    } catch (e) { return { lints: [{ rule: "lint", level: "error", story: p.id, message: String(e), doc: key } as Problem], suggestions: {} }; }
  }, [story]);
  /** One block's suggestions, taken. */
  const takeAt = (at: Path) => {
    const ss = suggestions[at.join("/")];
    if (!ss?.length) return;
    edit(s => { const base = "beat" in ((get(s, at) ?? {}) as object) ? [...at, "beat"] : at; return set(s, base, ss.reduce((st, sg) => taken(st, sg.fix), (get(s, base) ?? {}) as Record<string, unknown>)); }, "take-auto");
  };
  /** The picked suggestions (by block), taken as one edit. */
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
  // a task's question about this episode: answered in Needs you
  const asks2 = runsNow.value.flatMap(r => r.steps.filter(st => st.status === "asking" && st.question && st.owns.some(o => o.kind === "story" && o.id === p.id)).map(st => ({ run: r, step: st })));
  const mine = proposals.value.filter(x => (x.kind === "story" && x.doc === p.id) || x.also?.some(a => a.kind === "story" && a.doc === p.id));
  const conflict = conflicts.value.has(key);
  const problems = [...(checked.value[key] ?? []), ...lints];
  const marks: Record<number, { errors: number; warnings: number }> = {};
  for (const x of problems) if (x.step !== undefined && (x.level === "error" || x.level === "warning")) { const m = (marks[x.step] ??= { errors: 0, warnings: 0 }); if (x.level === "error") m.errors++; else m.warnings++; }
  const allFlags = flagsIn(story);
  const errors = problems.filter(x => x.level === "error").length;
  const save = () => void saveDocs([key, keyOf("season", `s${seasonOf(p.id)}`)]);

  // where the episode stands in the work, and the stage on the page (#/episode/<id>/<stage>)
  const live = marksNow.value.get(`story:${p.id}`)?.live;
  const pluginStages = plugins.flatMap(ep => (ep.stage ? [{ key: ep.stage.key, name: ep.stage.name, ...ep.stage.state({ story, problems }) }] : []));
  const progress = progressOf({ story, langs, review: review.value[p.id], errors, suggestions, drafting: live ? { step: Math.max(1, blocks(story).length), total: Math.max(1, blocks(story).length) } : null, stages: pluginStages });
  const keys = progress.stages.map(x => x.key);
  const [, , sub, k] = route.value;
  const stage: StageKey = keys.includes(sub) ? sub : sub === "at" ? "script" : sub === "review" ? "review" : live ? "script" : progress.next ?? "review";
  const goStage = (s: StageKey) => go("episode", p.id, s);
  // from the review page: a block (#/episode/<id>/at/<key>); from a translator's link: the language (#/episode/<id>/translate/<lang>)
  useEffect(() => { if (sub === "at" && k) select(pathOfKey(k), true); if (sub === "translate" && k && langs.translations.includes(k)) setTrLang(k); }, [route.value.join("/")]);
  const next = nextStepOf(progress, stage, { lang: trLang, drafting: !!live });
  /** Do what a next-step button says. */
  const act = (a: StepAction) => {
    if (a.startsWith("go:")) return goStage(a.slice(3));
    switch (a) {
      case "draft": return void send("This episode is a draft. Write its steps from its title, premise, cast and place, and what the series' plugins ask of it, in the series' languages, using the place's marks. Propose the result.");
      case "first-unstaged": if (progress.unstaged[0]) select(progress.unstaged[0], true); return;
      case "add-all": return takeSome(suggestions);
      case "first-untranslated": { const b = blocksOf(story, langs).find(x => !checkedOf(review.value[p.id]?.steps?.[x.key]).includes(trLang)); if (b) select(b.path, true); return; }
      case "next-language": { const l = progress.langs.find(x => x.done < x.total); if (l) setTrLang(l.lang); return; }
      case "draft-language": return void send(`Fill in every missing ${langName(trLang)} translation in this episode, natural and simple. Propose them.`);
      case "settings": return setSettingsOpen(true);
      case "watch": return watch();
      case "approve": return void setReview(p.id, r => ({ ...r, status: "approved", sig: episodeSig(story) }));
    }
  };
  /** Watch it through: the stage full width from the opening scene, running on by itself. */
  const watch = () => {
    if (stage !== "review") goStage("review");
    setWatching(true);
    const pl = preview.current?.player;
    if (pl) { pl.jump(0); pl.setAuto(true); redraw(); }
  };
  const unwatch = () => { setWatching(false); preview.current?.player.setAuto(false); redraw(); };
  const title = textOf(story.title, langs.main);
  const view = (() => {
    if (stage === "brief") return html`<${Brief} story=${story} saved=${saved} edit=${edit} onWrite=${() => goStage("script")} />`;
    if (stage === "script") return html`<div class="lead"><span class="grow">The words, and what each person does under them. Select a line to change its directions; dashed chips are suggestions.</span>
        <label class="row note"><input type="checkbox" style="width:auto" checked=${onlyWords} onChange=${() => setOnlyWords(!onlyWords)} /> Words only</label>
        ${langs.translations[0] && html`<label class="row note"><input type="checkbox" style="width:auto" checked=${showTr} onChange=${() => setShowTr(!showTr)} /> Show the ${langName(langs.translations[0])}</label>`}</div>
      <${Script} id=${p.id} story=${story} saved=${saved} selected=${path} focusTick=${focusTick} playing=${playing} select=${select} edit=${edit} marks=${marks} ghosts=${ghosts} suggestions=${suggestions}
        wordsOnly=${onlyWords} showTr=${showTr ? langs.translations[0] : null} watch=${playOf(story, w.series) === "watch"} onMore=${(x: Path) => { select(x); setDrawer("details"); }} />`;
    if (stage === "translate") return html`<${Translate} id=${p.id} story=${story} selected=${path} lang=${trLang} langs=${progress.langs} setLang=${setTrLang} select=${select} edit=${edit} onSettings=${() => setSettingsOpen(true)} />`;
    if (stage === "review") return html`<div class="lead"><span class="grow">Read it as the audience will, with the ${langName(langs.translations[0] ?? langs.main)} under each line. Click a line to play it and comment on it.</span></div>
      <${ReadThrough} id=${p.id} story=${story} selected=${path} select=${(x: Path) => select(x)} />`;
    const ep = plugins.find(x => x.stage?.key === stage);
    return ep?.Sections ? html`<${ep.Sections} story=${story} saved=${saved} edit=${edit} />` : null;
  })();

  return html`<section class="studio-episode" onKeyDown=${(e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } }}>
    <div class="ep-top">
      <div class="ep-title">
        <div class="grow" style="min-width:0"><h2 ...${inLang(langs.main)}>${title || "Untitled episode"}</h2>
          <span class="sub">${[langs.translations[0] && textOf(story.title, langs.translations[0]) && html`<span ...${inLang(langs.translations[0])}>${textOf(story.title, langs.translations[0])}</span>`, story.kind === "special" && "special", story.releaseDate, playOf(story, w.series) === "watch" && "watch only", progress.approved ? "approved" : story.draft ? "draft" : ""].filter(Boolean).map((x, k) => html`${k ? " · " : ""}${x}`)}</span></div>
        <span class=${`saved-state${dirty(d) ? " dirty" : ""}`}>${dirty(d) ? "Unsaved" : "Saved"}</span>
        <span class="tool-group">
          <button class="iconbtn" onClick=${() => history("story", p.id, "undo")} disabled=${!d.past.length} title=${`Undo (${MOD} Z)`} aria-label="Undo"><${Icon} name="undo" /></button>
          <button class="iconbtn" onClick=${() => history("story", p.id, "redo")} disabled=${!d.future.length} title=${`Redo (⇧${MOD} Z)`} aria-label="Redo"><${Icon} name="redo" /></button></span>
        ${dirty(d) && html`<${SaveButton} onSave=${save} title=${`Save (${MOD} S)`} />`}
        ${w.ai && html`<button onClick=${(e: MouseEvent) => setAsks({ x: e.clientX, y: e.clientY + 12 })} title="Ask the assistant about this episode or the selected line"><${Icon} name="spark" size=${16} /> Ask</button>`}
        <button class="iconbtn" aria-label="More" title="More" onClick=${(e: MouseEvent) => setMore({ x: e.clientX - 200, y: e.clientY + 12 })}>⋯</button>
      </div>
      <nav class="stages" aria-label="Stages of the work">${progress.stages.map(x => html`<button class=${`stage-tab${x.done ? " done" : ""}${progress.next === x.key ? " next" : ""}`} aria-current=${stage === x.key} onClick=${() => goStage(x.key)}>
        <span class="name"><span class="mark" aria-hidden="true">${x.done ? "✓" : ""}</span>${x.name}${x.plugin ? html`<span class="plug">plugin</span>` : ""}</span>
        <span class="state">${progress.next === x.key && !x.done ? "Next · " : ""}${x.state}</span></button>`)}</nav>
      <div class="next-step"><span class="label">Next</span><span class="what">${next.what}</span>
        ${next.alt && html`<button onClick=${() => act(next.alt!.action)}>${next.alt.label}</button>`}
        ${next.act && html`<button class="primary" onClick=${() => act(next.act!.action)}>${next.act.label} ▸</button>`}</div>
      <${MadeByTask} kind="story" id=${p.id} />
    </div>
    ${conflict && html`<div class="banner">An agent wrote this episode while you had unsaved edits: <button class="small" onClick=${() => { void openDoc("story", p.id, true); conflicts.value = new Set([...conflicts.value].filter(k => k !== key)); }}>Take theirs</button> or save yours over it (the server will say it changed on disk; reload first to merge by hand).</div>`}
    <div class=${`studio-split${watching ? " watching" : ""}`}>
      ${!watching && html`<div class="script-col">${view}</div>`}
      <div class="stage-col">
        ${pv && player && html`<${Strip} preview=${pv} story=${shown.current} at=${Math.max(0, player.next - 1)} select=${select} jump=${(i: number) => { player.jump(i); redraw(); }} />`}
        <div class="stagebox"><div ref=${box}></div></div>
        ${watching && player && html`<${Subtitle} info=${info[Math.max(0, player.next - 1)]} />`}
        ${player && html`<${Transport} preview=${pv!} redraw=${redraw} watch=${playOf(story, w.series) === "watch"} />`}
        ${watching && html`<div class="row" style="justify-content:center"><button onClick=${unwatch}>Back to reading</button></div>`}
        ${stage === "review" && !watching && html`<${ReviewSide} id=${p.id} story=${story} progress=${progress} selected=${path} goStage=${goStage} onWatch=${watch} />`}
        ${pv && stage === "script" && html`<${Direct} preview=${pv} story=${story} path=${path} host=${box.current?.parentElement ?? null} edit=${edit} cast=${cast} />`}
        ${allFlags.length > 0 && html`<div class="flags"><span class="note">Flags from earlier stories:</span>${allFlags.map(f => html`<button class=${`chip${flags.includes(f) ? " on" : ""}`} aria-pressed=${flags.includes(f)} onClick=${() => {
          const next = flags.includes(f) ? flags.filter(x => x !== f) : [...flags, f];
          setFlags(next); pv!.setFlags(next, Math.max(0, player!.next - 1)); redraw();
        }}>${f}</button>`)}</div>`}
      </div>
    </div>
    <${NeedsYou} story=${story} problems=${problems} suggestions=${progress.suggestions} comments=${progress.openComments} proposals=${mine} asks=${asks2}
      open=${needsOpen} setOpen=${setNeedsOpen} select=${select} edit=${edit} goStage=${goStage} addAll=${() => takeSome(suggestions)} setLang=${setTrLang} />
    ${asks && html`<${Popover} x=${asks.x} y=${asks.y} onClose=${() => setAsks(null)} label="Ask the assistant"><${AskMenu} onDone=${() => setAsks(null)} /></${Popover}>`}
    ${more && html`<${Popover} x=${more.x} y=${more.y} onClose=${() => setMore(null)} label="More"><div class="menu">
      <button onClick=${() => { setDrawer("changes"); setMore(null); }}><b>Changes</b><small>what changed since the last save and commit</small></button>
      <button disabled=${!path} onClick=${() => { setDrawer("details"); setMore(null); }}><b>More about this line</b><small>everything on the selected line, and the file's data</small></button>
      <button disabled=${!dirty(d)} onClick=${() => { history("story", p.id, "revert"); setMore(null); }}><b>Revert</b><small>back to the saved file</small></button>
      <button onClick=${() => { setSettingsOpen(true); setMore(null); }}><b>Series settings</b><small>languages, how episodes play, the narrator</small></button></div></${Popover}>`}
    ${settingsOpen && html`<${Modal} title="Series settings" onClose=${() => setSettingsOpen(false)}><${SeriesSettings} /></${Modal}>`}
    ${drawer === "details" && html`<${Drawer} float title="More about this line" onClose=${() => setDrawer(null)}><${Details} story=${story} saved=${saved} path=${path} cast=${cast} edit=${edit} /></${Drawer}>`}
    ${drawer === "changes" && html`<${Drawer} float title="Changes" onClose=${() => setDrawer(null)}><${ChangesPanel} id=${p.id} story=${story} savedAt=${d.mtime} edit=${(fn: (s: StoryDoc) => StoryDoc) => edit(fn)} select=${(x: Path) => select(x, true)} /></${Drawer}>`}
  </section>`;
}

/** Play controls: from the start, back, play on, a scrubber over every cue and one through the cue playing, the learner's card. */
function Transport(p: { preview: Preview; redraw(): void; watch?: boolean }) {
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
      <button class=${p.watch ? "" : "primary"} onClick=${() => { pl.devam(); p.redraw(); }} disabled=${f.kind === "turn" || f.kind === "end"}><${Icon} name="play" size=${14} /> ${f.kind === "busy" ? "Finish" : "Next"}</button>
      <button class=${p.watch ? "primary" : ""} onClick=${() => { if (!pl.auto && f.kind === "end") pl.jump(0); pl.setAuto(!pl.auto); p.redraw(); }} title=${p.watch ? "A watch-only episode plays on time alone" : "Play on by itself, stopping at the viewer's cards"}>${pl.auto ? "Pause" : "Play"}</button>
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

/** A view setting kept in this browser (a missing or blocked storage keeps the default). */
function useStored<T>(name: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const x = localStorage.getItem(name); return x === null ? fallback : JSON.parse(x) as T; } catch { return fallback; } });
  return [v, (x: T) => { setV(x); try { localStorage.setItem(name, JSON.stringify(x)); } catch { /* the setting lasts this visit */ } }];
}

/** What the cue playing says, in the main language and the first translation: the watch view's subtitle. */
function Subtitle(p: { info?: { tr?: string; text?: Record<string, string> } }) {
  const { main, translations: [gloss] } = useLangs();
  const said = p.info?.text?.[main] ?? p.info?.tr;
  return html`<div class="subtitle">${said ? html`<span ...${inLang(main)}>${said}</span>${gloss && p.info?.text?.[gloss] && html`<small ...${inLang(gloss)}>${p.info.text[gloss]}</small>`}` : html`&nbsp;`}</div>`;
}
