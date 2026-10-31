// The episode as a screenplay (model/script.ts): one block per step, typed into. A scene heading (the place, its time,
// who starts where); a line (the speaker, the words in the main language, the translations as smaller rows under it,
// the staging as chips); an action (who does what, with no words); the learner's choice with its options and their
// replies indented under it; a grammar spot; an act on stage. The keys of a screenplay:
//   Enter              a new line after this one, said by the one before last (a conversation alternates)
//   Tab, Shift Tab     an empty line becomes an action, an action a line
//   @ in an empty line  pick the speaker          / in an empty line  insert a block (scene, line, choice, spot …)
//   (                  type how it is said: (waves, happy, to İsmail) becomes the staging (model/parenthetical.ts)
//   Backspace in an empty line  delete it        ⌘↑ ⌘↓  move it        ⌘D  duplicate it        ⌘Z ⇧⌘Z  undo, redo
// Focusing a block selects it, and the stage plays that moment.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { allLanguages, languagesOf, textOf, type StoryDoc } from "sahne-story";
import { get, set, type Path } from "../../model/path.ts";
import { addAfter, blocks, convert, duplicateAt, emptyLine, INSERTS, moveBy, nextSpeaker, remove, stagingIn, template, type Block, type Insert } from "../../model/script.ts";
import { chipsOf, parseParenthetical } from "../../model/parenthetical.ts";
import { taken, type Ghost, type Suggest } from "../../model/autostage.ts";
import { KIT } from "../../stage.ts";
import { history, review, say, world } from "../../store.ts";
import { checkedOf, markStep, rowKey } from "../review.ts";
import { Icon, Popover } from "../kit/index.ts";
import { Picker } from "../galleries.ts";
import { inLang, langName, useLangs } from "../lang.ts";
import { placeAt, targetsAt } from "../staging.ts";

export interface ScriptProps {
  id: string;
  story: StoryDoc;
  saved: StoryDoc;
  selected: Path | null;
  /** Bumped to move the cursor to `selected`. */
  focusTick: number;
  playing: Path | null;
  select(path: Path | null, focus?: boolean): void;
  edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void;
  /** Problems by step index, for the gutter. */
  marks?: Record<number, { errors: number; warnings: number }>;
  /** What shows in a block's gutter beside its number (review marks, notes). */
  gutter?(b: Block): unknown;
  /** What the director does by itself on each block (never written), and what the rules suggest, by block path. */
  ghosts?: Record<string, Ghost>;
  suggestions?: Record<string, Suggest[]>;
}

const key = (p: Path) => p.join("/");
const isMod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

export function Script(p: ScriptProps) {
  const langs = useLangs(), w = world.value!;
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";
  const list = blocks(p.story);
  const [menu, setMenu] = useState<{ kind: "insert" | "speaker"; path: Path; x: number; y: number } | null>(null);
  /** The block whose parenthetical is being typed. */
  const [paren, setParen] = useState<string | null>(null);
  const name = (id: string) => textOf(w.characters[id]?.name, langs.main) ?? id;

  /** Apply a script edit and move the cursor where it says. */
  const apply = (r: { story: StoryDoc; focus: Path | null }) => { p.edit(() => r.story); p.select(r.focus, true); };

  /** The keys of a block's main text field. */
  const keys = (b: Block, text: string) => (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const empty = !text;
    const target = e.target as HTMLElement;
    const rect = () => { const r = target.getBoundingClientRect(); return { x: r.left, y: r.bottom + 4 }; };
    if (e.key === "Enter" && !e.shiftKey && !isMod(e)) {
      e.preventDefault();
      const who = nextSpeaker(p.story, b.path, { standin, narrator });
      apply(addAfter(p.story, b.path, emptyLine(who, langs)));
    } else if (e.key === "Backspace" && empty && b.kind === "line" && !isMod(e)) {
      const step = get(p.story, b.path) as Record<string, unknown>;
      if (allLanguages(langs).some(l => step[l])) return;
      e.preventDefault();
      apply(remove(p.story, b.path));
    } else if (e.key === "Tab" && empty && (b.kind === "line" || b.kind === "action")) {
      e.preventDefault();
      p.edit(s => convert(s, b.path, b.kind === "line" ? "action" : "line", langs));
      p.select(b.path, true);
    } else if (e.key === "@" && empty && b.kind === "line") { e.preventDefault(); setMenu({ kind: "speaker", path: b.path, ...rect() }); }
    else if (e.key === "/" && empty && b.depth === 0) { e.preventDefault(); setMenu({ kind: "insert", path: b.path, ...rect() }); }
    else if (e.key === "Enter" && e.altKey) { e.preventDefault(); takeAll(b.path); }
    else if (e.key === "(" && !e.altKey && (b.kind === "line" || b.kind === "option" || b.kind === "action")) { e.preventDefault(); setParen(key(b.path)); }
    else if (isMod(e) && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); apply(moveBy(p.story, b.path, e.key === "ArrowUp" ? -1 : 1)); }
    else if (isMod(e) && e.key.toLowerCase() === "d") { e.preventDefault(); apply(duplicateAt(p.story, b.path)); }
    else if (isMod(e) && e.key.toLowerCase() === "z") { e.preventDefault(); history("story", p.id, e.shiftKey ? "redo" : "undo"); }
    else if (e.key === "ArrowUp" && !e.shiftKey && (target as HTMLTextAreaElement).selectionStart === 0) { const i = list.findIndex(x => key(x.path) === key(b.path)); if (i > 0) { e.preventDefault(); p.select(list[i - 1].path, true); } }
    else if (e.key === "ArrowDown" && !e.shiftKey && (target as HTMLTextAreaElement).selectionEnd === text.length) { const i = list.findIndex(x => key(x.path) === key(b.path)); if (i < list.length - 1) { e.preventDefault(); p.select(list[i + 1].path, true); } }
  };

  /** Every suggestion of a block, taken. */
  const takeAll = (path: Path) => {
    const ss = p.suggestions?.[key(path)] ?? [];
    if (!ss.length) return;
    const base = "beat" in ((get(p.story, path) ?? {}) as object) ? [...path, "beat"] : path;
    p.edit(s => set(s, base, ss.reduce((x, sg) => taken(x, sg.fix), (get(s, base) ?? {}) as Record<string, unknown>)), `${key(path)}.take`);
  };

  const insert = (kind: Insert, after: Path) => {
    const who = nextSpeaker(p.story, after, { standin, narrator });
    const step = template(kind, { story: p.story, langs, who, standin, narrator, place: placeAt(p.story, Number(after[1])) });
    apply(addAfter(p.story, after, step));
  };

  const common = { ...p, keys, name, narrator, standin, setMenu, paren, setParen };
  return html`<div class="script" role="list" aria-label="The script">
    ${list.map(b => html`<${BlockView} key=${key(b.path)} b=${b} ...${common} />`)}
    <button class="script-add" onClick=${(e: MouseEvent) => setMenu({ kind: "insert", path: list.at(-1)?.path ?? ["steps", -1], x: e.clientX, y: e.clientY })}><${Icon} name="plus" size=${14} /> Add a block <kbd>/</kbd></button>
    ${menu?.kind === "insert" && html`<${Popover} x=${menu.x} y=${menu.y} onClose=${() => setMenu(null)} label="Insert a block">
      <div class="menu">${INSERTS.map(k => html`<button onClick=${() => { insert(k, menu.path); setMenu(null); }}><b>${INSERT_NAMES[k][0]}</b><small>${INSERT_NAMES[k][1]}</small></button>`)}</div></${Popover}>`}
    ${menu?.kind === "speaker" && html`<${Picker} kind="character" x=${menu.x} y=${menu.y} ids=${[...(p.story.cast ?? []), ...(p.story.extras ?? []), narrator]} value=${[(get(p.story, menu.path) as { who?: string })?.who ?? ""]}
      onPick=${(id: string) => { p.edit(s => set(s, [...menu.path, "who"], id)); p.select(menu.path, true); }} onClose=${() => setMenu(null)} />`}
  </div>`;
}

const INSERT_NAMES: Record<Insert, [string, string]> = {
  line: ["Line", "someone says something"], action: ["Action", "someone does something, with no words"], narration: ["Narration", "the narrator, to the viewer"],
  scene: ["Scene", "a new place or time"], choice: ["Choice", "the learner picks what to say"], spot: ["Grammar spot", "the narrator points out a line"], act: ["Act", "the learner does something on stage"],
};

type Common = ScriptProps & {
  b: Block; keys(b: Block, text: string): (e: KeyboardEvent) => void; name(id: string): string; narrator: string; standin: string;
  setMenu(m: { kind: "insert" | "speaker"; path: Path; x: number; y: number } | null): void;
  paren: string | null; setParen(k: string | null): void;
};

/** A block: its gutter, and its body by kind. */
function BlockView(p: Common) {
  const b = p.b, k = key(b.path);
  const on = !!p.selected && key(p.selected) === k, playing = !!p.playing && key(p.playing) === k;
  const changed = JSON.stringify(get(p.story, b.path)) !== JSON.stringify(get(p.saved, b.path));
  const m = b.depth === 0 ? p.marks?.[Number(b.path[1])] : undefined;
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on || !el.current) return;
    const f = el.current.querySelector<HTMLElement>("[data-main]") ?? el.current.querySelector<HTMLElement>("input, textarea, select, button");
    if (f && !el.current.contains(document.activeElement)) f.focus({ preventScroll: true });
    el.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [on, p.focusTick]);
  return html`<div ref=${el} role="listitem" data-block=${k} class=${`blk ${b.kind} d${b.depth}${on ? " on" : ""}${playing ? " playing" : ""}${changed ? " changed" : ""}`}
    onFocusIn=${() => { if (!on) p.select(b.path); }} onClick=${(e: MouseEvent) => { if (!on && (e.target as HTMLElement).closest("button,input,textarea,select") === null) p.select(b.path, true); }}>
    <div class="gutter"><span class="n">${b.path.slice(1).filter(x => typeof x === "number").join(".")}</span>
      ${m?.errors ? html`<span class="mark bad" title=${`${m.errors} errors`}>●</span>` : m?.warnings ? html`<span class="mark warn" title=${`${m.warnings} warnings`}>●</span>` : ""}
      ${p.gutter?.(b)}</div>
    <div class="body">${body(p)}</div>
  </div>`;
}

function body(p: Common) {
  switch (p.b.kind) {
    case "scene": return html`<${SceneBlock} ...${p} />`;
    case "line": return html`<${LineBlock} ...${p} />`;
    case "option": return html`<${LineBlock} ...${p} />`;
    case "action": return html`<${ActionBlock} ...${p} />`;
    case "choice": return html`<${ChoiceBlock} ...${p} />`;
    case "spot": return html`<${SpotBlock} ...${p} />`;
    case "act": return html`<${ActBlock} ...${p} />`;
  }
}

/** A textarea that grows with its text. */
function Grow(p: { value: string; lang: string; main?: boolean; placeholder?: string; label: string; onInput(v: string): void; onKeyDown?(e: KeyboardEvent): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = ref.current; if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; } }, [p.value]);
  return html`<textarea ref=${ref} rows=${1} class=${p.main ? "said" : "tr-row"} ...${inLang(p.lang)} value=${p.value} placeholder=${p.placeholder} aria-label=${p.label} data-main=${p.main ? "" : undefined}
    onInput=${(e: Event) => p.onInput((e.target as HTMLTextAreaElement).value)} onKeyDown=${p.onKeyDown} />`;
}

/** The translations of a block's text, as small rows. */
function Translations(p: Common & { at: Path }) {
  const langs = useLangs(), v = (get(p.story, p.at) ?? {}) as Record<string, unknown>;
  const checked = checkedOf(review.value[p.id]?.steps?.[rowKey(p.b.path)]);
  return html`<div class="trans">${langs.translations.map(l => html`<div class="trow"><span class="lang-tag" title=${langName(l)}>${l}</span>
    <${Grow} value=${String(v[l] ?? "")} lang=${l} label=${`${langName(l)}`} placeholder=${`${langName(l)}…`} onInput=${(x: string) => p.edit(s => set(s, [...p.at, l], x), `${key(p.at)}.${l}`)} />
    ${!v[l] ? html`<span class="missing" title=${`No ${langName(l)} yet`}>·</span>`
    : html`<button class=${`tcheck${checked.includes(l) ? " on" : ""}`} aria-pressed=${checked.includes(l)} title=${checked.includes(l) ? `${langName(l)} checked` : `Mark the ${langName(l)} checked`} onClick=${() => markStep(p.id, p.b.path, l, !checked.includes(l))}>✓</button>`}</div>`)}</div>`;
}

/** The staging written on a block, as chips (× clears one), and the parenthetical field that adds to it. */
function Staged(p: Common & { at: Path; who?: string }) {
  const w = world.value!, { main } = useLangs();
  const [paren, setText] = useState("");
  const open = p.paren === key(p.at), setOpen = (on: boolean) => p.setParen(on ? key(p.at) : null);
  const setParen = setText;
  const step = get(p.story, p.at);
  const st = stagingIn(step) as Record<string, unknown>;
  const chips = chipsOf(st, p.name);
  const base = "beat" in ((step ?? {}) as object) ? [...p.at, "beat"] : p.at;
  const ghost = p.ghosts?.[key(p.at)], sugg = p.suggestions?.[key(p.at)] ?? [];
  const take = (sg: Suggest) => p.edit(s => set(s, base, taken((get(s, base) ?? {}) as Record<string, unknown>, sg.fix)), `${key(p.at)}.take`);
  const commit = () => {
    if (!paren.trim()) { setOpen(false); return; }
    const pl = w.places[placeAt(p.story, Number(p.at[1]))];
    const cast = [...(p.story.cast ?? []), ...(p.story.extras ?? []), p.narrator];
    const { staging, rest } = parseParenthetical(paren, {
      gestures: Object.keys(KIT.gestures), emotions: Object.keys(KIT.face.emotions),
      cast: cast.map(id => ({ id, names: Object.values(w.characters[id]?.name ?? {}) })),
      marks: Object.keys(pl?.marks ?? {}), props: targetsAt(p.story, Number(p.at[1]), cast).props.map(id => ({ id, names: [] })),
    }, p.who ?? "");
    p.edit(s => Object.entries(staging).reduce((x, [k, v]) => set(x, [...base, k], v), s), `${key(p.at)}.paren`);
    if (rest.length) say(`not understood: ${rest.join(", ")}`, true);
    setParen(""); setOpen(false);
    // back to the line's words
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-block="${key(p.b.path)}"] [data-main]`)?.focus());
  };
  const clear = (k: string) => p.edit(s => set(s, [...base, k], undefined));
  return html`<span class="staged">
    ${chips.map(c => html`<span class="schip set">${c.label}<button aria-label=${`Clear ${c.key}`} onClick=${() => clear(c.key)}>×</button></span>`)}
    ${ghost?.to && !st.to && html`<span class="schip ghost" title="The director's choice: who it is said to. Set it to change it.">→ ${ghost.to === "viewer" ? "us" : p.name(ghost.to)}</span>`}
    ${ghost?.cam && !st.cam && html`<span class="schip ghost" title="The director's shot. The shot bar on the stage changes it.">${ghost.cam} shot</span>`}
    ${sugg.map(sg => html`<button class="schip suggest" title=${`${sg.why}: click (or ⌥ Enter for all) to take it`} onClick=${() => take(sg)}>+ ${chipsOf(sg.fix as Record<string, unknown>, p.name).map(c => c.label).join(", ")}</button>`)}
    ${open ? html`<input class="paren" autofocus value=${paren} placeholder="(waves, happy, to …)" aria-label="How it is said" lang=${main === "tr" ? "en" : undefined}
      onInput=${(e: Event) => setParen((e.target as HTMLInputElement).value)} onBlur=${commit}
      onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { setParen(""); setOpen(false); } }} />`
    : html`<button class="schip add" onClick=${() => setOpen(true)} title="How it is said: type (waves, happy, to …)">( )</button>`}
  </span>`;
}

function LineBlock(p: Common) {
  const { main } = useLangs(), w = world.value!;
  const option = p.b.kind === "option";
  const step = (get(p.story, p.b.path) ?? {}) as Record<string, unknown>;
  const who = option ? p.standin : String(step.who ?? "");
  const text = String(step[main] ?? "");
  const narr = step.narr === true;
  const color = w.characters[who]?.color as string | undefined;
  return html`<div class="line-head">
      ${option ? html`<span class="speaker" style=${color ? `--who:${color}` : ""}>${p.name(who)}<small> chooses</small></span>`
      : html`<button class="speaker" style=${color ? `--who:${color}` : ""} title="Who speaks (or type @ in an empty line)" onClick=${(e: MouseEvent) => p.setMenu({ kind: "speaker", path: p.b.path, x: e.clientX, y: e.clientY })}>${p.name(who) || "who?"}${narr ? html`<small> to the viewer</small>` : ""}</button>`}
      ${option && html`<button class=${`schip${step.ok ? " ok" : ""}`} aria-pressed=${!!step.ok} title="The fitting answer" onClick=${() => p.edit(s => set(s, [...p.b.path, "ok"], step.ok ? undefined : true))}>✓ fits</button>
        <select class="tone" value=${String(step.tone ?? "")} aria-label="Tone" onChange=${(e: Event) => p.edit(s => set(s, [...p.b.path, "tone"], (e.target as HTMLSelectElement).value || undefined))}>
          <option value="">tone…</option>${["polite", "warm", "formal", "casual", "blunt", "rude"].map(t => html`<option value=${t}>${t}</option>`)}</select>`}
      ${(step.if || step.unless) && html`<span class="schip gate" title="Shown only when an earlier story set (or did not set) this flag">${step.if ? `if ${step.if}` : `unless ${step.unless}`}</span>`}
      <${Staged} ...${p} at=${p.b.path} who=${who} />
    </div>
    <${Grow} main value=${text} lang=${main} label=${`${p.name(who)}'s line`} placeholder=${option ? "What the learner may say…" : "What they say…"} onInput=${(x: string) => p.edit(s => set(s, [...p.b.path, main], x), `${key(p.b.path)}.${main}`)} onKeyDown=${p.keys(p.b, text)} />
    <${Translations} ...${p} at=${p.b.path} />`;
}

function ActionBlock(p: Common) {
  const beat = ((get(p.story, p.b.path) as { beat?: Record<string, unknown> })?.beat ?? {});
  const who = beat.who as string | undefined;
  return html`<div class="line-head action-head">
    <button class="speaker" data-main title="Who does it" onKeyDown=${p.keys(p.b, "")} onClick=${(e: MouseEvent) => p.setMenu({ kind: "speaker", path: [...p.b.path, "beat"], x: e.clientX, y: e.clientY })}>${who ? p.name(who) : "everyone"}</button>
    <span class="note">does</span><${Staged} ...${p} at=${p.b.path} who=${who} />
    ${beat.wait !== undefined && html`<span class="schip">waits ${beat.wait} ms</span>`}</div>`;
}

function SceneBlock(p: Common) {
  const w = world.value!, { main } = useLangs();
  const s = get(p.story, p.b.path) as { scene: string; time?: string; weather?: string; at?: Record<string, string> };
  const pl = w.places[s.scene];
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const cast = [...(p.story.cast ?? []), ...(p.story.extras ?? [])];
  return html`<div class="scene-head">
    <button class="place" data-main onKeyDown=${p.keys(p.b, "")} onClick=${(e: MouseEvent) => setPick({ x: e.clientX, y: e.clientY })} title="The place">${(textOf(pl?.name, "en") ?? s.scene).toUpperCase()}</button>
    ${(pl?.times?.length ?? 0) > 1 && html`<select value=${s.time ?? ""} aria-label="Time of day" onChange=${(e: Event) => p.edit(x => set(x, [...p.b.path, "time"], (e.target as HTMLSelectElement).value || undefined))}><option value="">${pl!.times![0]}</option>${pl!.times!.slice(1).map(t => html`<option value=${t}>${t}</option>`)}</select>`}
    ${s.weather && html`<span class="schip">${s.weather}</span>`}
    <span class="note" ...${inLang(main)}>${textOf(pl?.name, main)}</span></div>
    <div class="starts">${cast.map(c => html`<label class="start"><span>${p.name(c)}</span>
      <select value=${s.at?.[c] ?? ""} aria-label=${`Where ${p.name(c)} starts`} onChange=${(e: Event) => p.edit(x => set(x, [...p.b.path, "at", c], (e.target as HTMLSelectElement).value || undefined))}>
        <option value="">off stage</option>${Object.keys(pl?.marks ?? {}).map(m => html`<option value=${m}>${m}</option>`)}</select></label>`)}</div>
    ${pick && html`<${Picker} kind="place" x=${pick.x} y=${pick.y} value=${[s.scene]} onPick=${(id: string) => p.edit(x => set(x, [...p.b.path, "scene"], id))} onClose=${() => setPick(null)} />`}`;
}

function ChoiceBlock(p: Common) {
  const c = (get(p.story, [...p.b.path, "choice"]) ?? {}) as { id: string; kind?: string; to?: string; options: unknown[] };
  const put = (k: string, v: unknown) => p.edit(s => set(s, [...p.b.path, "choice", k], v));
  return html`<div class="choice-head"><b data-main tabindex="0" onKeyDown=${p.keys(p.b, "")}>${p.name(p.standin)} chooses</b>
    <select value=${c.kind ?? ""} aria-label="What the choice is about" onChange=${(e: Event) => put("kind", (e.target as HTMLSelectElement).value || undefined)}>
      <option value="polite">how polite</option><option value="meaning">what it means</option><option value="action">what to do</option></select>
    <span class="note">said to</span><select value=${c.to ?? ""} aria-label="Said to" onChange=${(e: Event) => put("to", (e.target as HTMLSelectElement).value || undefined)}>
      ${(p.story.cast ?? []).filter(x => x !== p.standin).map(x => html`<option value=${x}>${p.name(x)}</option>`)}</select>
    <button class="small" disabled=${c.options.length >= 3} onClick=${() => p.edit(s => set(s, [...p.b.path, "choice", "options", c.options.length], Object.fromEntries(allLanguages(languagesNow()).map(l => [l, ""]))))}>+ an option</button></div>`;
}
/** The open series' languages, outside a component. */
const languagesNow = () => languagesOf(world.value?.series);

function SpotBlock(p: Common) {
  const { main } = useLangs();
  const sp = (get(p.story, [...p.b.path, "spot"]) ?? {}) as Record<string, unknown>;
  const lines = blocks(p.story).filter(b => b.kind === "line").map(b => String((get(p.story, b.path) as Record<string, unknown>)[main] ?? "")).filter(Boolean);
  return html`<div class="spot-head"><b data-main tabindex="0" onKeyDown=${p.keys(p.b, "")}>Grammar spot</b>
    <select value=${String(sp.lesson ?? "")} aria-label="Lesson" onChange=${(e: Event) => p.edit(s => set(s, [...p.b.path, "spot", "lesson"], (e.target as HTMLSelectElement).value))}>
      ${(p.story.lessons ?? []).map(l => html`<option value=${l}>${l}</option>`)}</select>
    <span class="note">on the line</span>
    <select value=${String(sp.ex ?? "")} ...${inLang(main)} aria-label="The line it points at" onChange=${(e: Event) => p.edit(s => set(s, [...p.b.path, "spot", "ex"], (e.target as HTMLSelectElement).value))}>
      <option value="">pick a line…</option>${lines.map(t => html`<option value=${t}>${t}</option>`)}</select></div>
    <${Translations} ...${p} at=${[...p.b.path, "spot"]} />`;
}

function ActBlock(p: Common) {
  const { main } = useLangs();
  const a = (get(p.story, [...p.b.path, "act"]) ?? {}) as { kind: string; targets: string[]; prompt?: Record<string, string> };
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const props = targetsAt(p.story, Number(p.b.path[1]), []).props;
  return html`<div class="act-head"><b>${p.name(p.standin)} acts</b>
    <select value=${a.kind} aria-label="How" onChange=${(e: Event) => p.edit(s => set(s, [...p.b.path, "act", "kind"], (e.target as HTMLSelectElement).value))}>
      <option value="tap">taps</option><option value="drag">drags</option><option value="go">goes to</option><option value="choose">chooses</option></select>
    ${a.targets.map(t => html`<span class="schip set">${t.replace(/^obj:/, "")}<button aria-label=${`Remove ${t}`} onClick=${() => p.edit(s => set(s, [...p.b.path, "act", "targets"], a.targets.filter(x => x !== t)))}>×</button></span>`)}
    <button class="schip add" onClick=${(e: MouseEvent) => setPick({ x: e.clientX, y: e.clientY })}>+ what</button></div>
    <${Grow} main value=${a.prompt?.[main] ?? ""} lang=${main} label="The prompt" placeholder="What the learner is asked to do…" onInput=${(x: string) => p.edit(s => set(s, [...p.b.path, "act", "prompt", main], x), `${key(p.b.path)}.prompt`)} onKeyDown=${p.keys(p.b, a.prompt?.[main] ?? "")} />
    ${pick && html`<${Popover} x=${pick.x} y=${pick.y} onClose=${() => setPick(null)} label="A prop on stage"><div class="menu">
      ${props.map(id => html`<button onClick=${() => { p.edit(s => set(s, [...p.b.path, "act", "targets"], [...a.targets, `obj:${id}`])); setPick(null); }}>${id.replace(/_/g, " ")}</button>`)}
      ${!props.length && html`<p class="note">The place has no props.</p>`}</div></${Popover}>`}`;
}
