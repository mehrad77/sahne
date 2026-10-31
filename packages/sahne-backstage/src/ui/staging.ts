// Staging: the forms for how a line, a beat, a choice's option or a reply is performed, and for a scene. The fields come in
// the order the stories use them most (emo, do, to, at, obj, move, react, link, cam, sfx, voice, tempo; the rest under
// "more"), each with a picker of what is valid there: the cast, the kit's emotions, gestures and sounds, the engine's
// cameras, moves, prop ops and voices, the marks and props of the place the step plays in. A raw JSON drawer edits the
// whole step for anything the forms do not cover; the story check on the server judges it like any other edit.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { CAM_KINDS, MOVE_HOWS, OBJ_OPS, VOICES } from "sahne";
import type { StoryDoc } from "sahne-story";
import { get, set, type Path } from "../model/path.ts";
import { KIT } from "../stage.ts";
import { world } from "../store.ts";
import { Check, NumberField, Select, Text, tx } from "./fields.ts";
import { inLang, inSeries, mainLang } from "./lang.ts";

export interface StagingProps {
  story: StoryDoc;
  saved: StoryDoc;
  /** The staging object: a line or reply itself, a beat's `beat`, an option itself. */
  path: Path;
  cast: string[];
  edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void;
}

const EMOTIONS = Object.keys(KIT.face?.emotions ?? {}).sort();
const GESTURES = Object.keys(KIT.gestures ?? {}).sort();
const SOUNDS = Object.keys(KIT.sounds ?? {}).sort();
const TIMES = ["dawn", "day", "golden", "dusk", "night", "overcast"];

/** The place a step plays in: the scene step at or before it, else the story's opening place. */
export function placeAt(story: StoryDoc, step: number): string {
  for (let i = Math.min(step, story.steps.length - 1); i >= 0; i--) { const s = story.steps[i] as { scene?: string }; if (s?.scene) return s.scene; }
  return story.place;
}

/** What a step can point at there: the cast, the props (the place's and the story's), the marks, the viewer. */
export function targetsAt(story: StoryDoc, step: number, cast: string[]) {
  const pl = world.value?.places[placeAt(story, step)];
  const marks = Object.keys(pl?.marks ?? {});
  const props = [...new Set([...Object.keys(pl?.props ?? {}), ...Object.keys(story.props ?? {})])];
  return { marks, props, targets: [...cast.map(c => `ch:${c}`), ...props.map(p => `obj:${p}`), ...marks.map(m => `mark:${m}`), "viewer"] };
}

export function Staging(p: StagingProps) {
  const step = Number(p.path[1]);
  const v = (get(p.story, p.path) ?? {}) as Record<string, any>;
  const was = (get(p.saved, p.path) ?? {}) as Record<string, any>;
  const { marks, props, targets } = targetsAt(p.story, step, p.cast);
  const put = (k: string, x: unknown) => p.edit(s => set(s, [...p.path, k], x), `${p.path.join(".")}.${k}`);
  const ch = (k: string) => JSON.stringify(v[k]) !== JSON.stringify(was[k]);
  const sel = (k: string, label: string, options: readonly string[]) => html`<${Select} label=${label} value=${v[k]} options=${options} changed=${ch(k)} onInput=${(x: string | undefined) => put(k, x)} />`;
  return html`<div class="fields">
    <h3>Staging</h3>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:0">
      ${sel("emo", "Feeling (emo)", EMOTIONS)}
      ${sel("do", "Gesture (do)", GESTURES)}
      ${sel("to", "Said to (to)", [...p.cast, "viewer"])}
      ${sel("at", "Looking or pointing at (at)", targets)}
      ${sel("cam", "Camera (cam)", CAM_KINDS)}
      ${sel("voice", "Voice", VOICES)}
      <${NumberField} label="Tempo" value=${v.tempo} step=${0.1} min=${0.3} max=${3} changed=${ch("tempo")} onInput=${(x: number | undefined) => put("tempo", x)} />
      <${NumberField} label="Times (n)" value=${v.n} min=${1} max=${12} changed=${ch("n")} onInput=${(x: number | undefined) => put("n", x)} />
    </div>
    ${v.do && html`<${Check} label="Repeat the gesture through the line (loop)" value=${v.loop} onInput=${(x: boolean) => put("loop", x || undefined)} />`}
    <${Moves} value=${v.move} cast=${p.cast} marks=${marks} onInput=${(x: unknown) => put("move", x)} />
    <${Objs} value=${v.obj} props=${props} targets=${targets} onInput=${(x: unknown) => put("obj", x)} />
    <${Reacts} value=${v.react} cast=${p.cast} onInput=${(x: unknown) => put("react", x)} />
    <${Links} value=${v.link} targets=${targets} line=${String(v.tr ?? "")} onInput=${(x: unknown) => put("link", x)} />
    <${Sfx} value=${v.sfx} onInput=${(x: unknown) => put("sfx", x)} />
    <details><summary>More: place changes, phone, a word to stress, a wait, a flashback, clothes</summary>
      <div class="fields" style="margin-top:6px">
        <${Text} label="Place change (env): time:night, state:-open, weather:rain, thunder, lights_on, fireworks, stop, depart (comma between)" value=${[v.env].flat().filter(Boolean).join(", ")} onInput=${(x: string | undefined) => { const l = (x ?? "").split(",").map(t => t.trim()).filter(Boolean); put("env", !l.length ? undefined : l.length === 1 ? l[0] : l); }} />
        ${sel("via", "On the phone or a video call (via)", ["phone", "video"])}
        <${Text} label="A word of the line to stress (on)" lang=${mainLang()} value=${v.on} onInput=${(x: string | undefined) => put("on", x)} />
        ${p.path.at(-1) === "beat" && html`<${NumberField} label="Wait (ms)" value=${v.wait} min=${0} step=${100} onInput=${(x: number | undefined) => put("wait", x)} />`}
        ${p.path.at(-1) === "beat" && sel("who", "Who the beat is about (who)", p.cast)}
        ${sel("frame", "Flashback (frame)", ["past", "past_inset"])}
        <${Json} label="A change of clothes (looks)" value=${v.looks} onInput=${(x: unknown) => put("looks", x)} />
      </div>
    </details>
  </div>`;
}

/** A scene step: where, when, the weather, the place's states, who stands on which mark, Kerim's perch. */
export function SceneFields(p: StagingProps) {
  const v = (get(p.story, p.path) ?? {}) as Record<string, any>;
  const put = (k: string, x: unknown) => p.edit(s => set(s, [...p.path, k], x), `${p.path.join(".")}.${k}`);
  const pl = world.value?.places[v.scene];
  const marks = Object.keys(pl?.marks ?? {});
  const at = (v.at ?? {}) as Record<string, string>;
  return html`<div class="fields">
    <h3>The scene</h3>
    <${Select} label="Place" value=${v.scene} options=${Object.entries(world.value?.places ?? {}).map(([id, d]) => [id, `${inSeries(d.name) ?? id} (${id})`] as [string, string])} onInput=${(x: string | undefined) => x && put("scene", x)} />
    <div class="row">
      <div class="grow"><${Select} label="Time" value=${v.time} options=${TIMES} onInput=${(x: string | undefined) => put("time", x)} /></div>
      <div class="grow"><${Select} label="Weather" value=${v.weather} options=${["grey", "rain"]} onInput=${(x: string | undefined) => put("weather", x)} /></div>
    </div>
    ${pl?.states && html`<div class="row">${Object.keys(pl.states).map(st => html`<${Check} label=${st} value=${[v.state].flat().includes(st)} onInput=${(on: boolean) => {
      const now = [v.state].flat().filter(Boolean) as string[], next = on ? [...now, st] : now.filter(x => x !== st);
      put("state", !next.length ? undefined : next.length === 1 ? next[0] : next);
    }} />`)}</div>`}
    <b>Who stands where</b>
    ${p.cast.filter(c => c !== "kerim").map(c => html`<div class="row"><span style="min-width:90px">${tx(world.value?.characters[c]?.name) || c}</span>
      <div class="grow"><${Select} label="" none="off stage" value=${at[c]} options=${marks} onInput=${(x: string | undefined) => put("at", { ...at, [c]: x })} /></div></div>`)}
    <${Select} label="Kerim's perch" value=${v.kerim} options=${marks} onInput=${(x: string | undefined) => put("kerim", x)} />
  </div>`;
}

type Move = { who?: string; to?: string; how?: string; from?: string };
function Moves(p: { value: unknown; cast: string[]; marks: string[]; onInput(v: unknown): void }) {
  const list: Move[] = p.value ? [p.value as Move | Move[]].flat() : [];
  const write = (l: Move[]) => p.onInput(!l.length ? undefined : l.length === 1 ? l[0] : l);
  return html`<div><b>Moves (move)</b> <button class="small" onClick=${() => write([...list, { who: p.cast[0], to: p.marks[0] }])}>+ a move</button>
    ${list.map((m, i) => html`<div class="row">
      <div class="grow"><${Select} label="Who" value=${m.who} options=${p.cast} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, who: x } : y)))} /></div>
      <div class="grow"><${Select} label="To the mark" value=${m.to} options=${p.marks} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, to: x } : y)))} /></div>
      <div class="grow"><${Select} label="How" value=${m.how} options=${MOVE_HOWS} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, how: x } : y)))} /></div>
      <button class="small danger" onClick=${() => write(list.filter((_, k) => k !== i))} aria-label="Remove the move">×</button></div>`)}
  </div>`;
}

type Op = { id?: string; op?: string; to?: string; ms?: number; set?: unknown };
function Objs(p: { value: unknown; props: string[]; targets: string[]; onInput(v: unknown): void }) {
  const list: Op[] = Array.isArray(p.value) ? p.value : [];
  const write = (l: Op[]) => p.onInput(l.length ? l : undefined);
  return html`<div><b>Props (obj)</b> <button class="small" onClick=${() => write([...list, { id: p.props[0], op: "show" }])}>+ a prop</button>
    ${list.map((o, i) => html`<div class="row">
      <div class="grow"><${Select} label="Prop" value=${o.id} options=${p.props} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, id: x } : y)))} /></div>
      <div class="grow"><${Select} label="Does" value=${o.op} options=${OBJ_OPS} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, op: x } : y)))} /></div>
      ${["give", "take", "place", "go"].includes(o.op ?? "") && html`<div class="grow"><${Select} label="To" value=${o.to} options=${p.targets} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, to: x } : y)))} /></div>`}
      <button class="small danger" onClick=${() => write(list.filter((_, k) => k !== i))} aria-label="Remove the prop op">×</button></div>`)}
  </div>`;
}

function Reacts(p: { value: unknown; cast: string[]; onInput(v: unknown): void }) {
  const map = (p.value && typeof p.value === "object" ? p.value : {}) as Record<string, string | { emo?: string; do?: string }>;
  const write = (m: Record<string, unknown>) => p.onInput(Object.keys(m).length ? m : undefined);
  const emo = (r: unknown) => (typeof r === "string" ? r : (r as { emo?: string })?.emo);
  return html`<div><b>Others react (react)</b> <button class="small" onClick=${() => { const c = p.cast.find(x => !(x in map)); if (c) write({ ...map, [c]: "happy" }); }}>+ a reaction</button>
    ${Object.entries(map).map(([c, r]) => html`<div class="row">
      <span style="min-width:90px">${tx(world.value?.characters[c]?.name) || c}</span>
      <div class="grow"><${Select} label="Feeling" value=${emo(r)} options=${EMOTIONS} onInput=${(x: string | undefined) => write({ ...map, [c]: typeof r === "string" || !r ? x : { ...r, emo: x } })} /></div>
      <div class="grow"><${Select} label="Gesture" value=${typeof r === "object" ? r?.do : undefined} options=${GESTURES} onInput=${(x: string | undefined) => write({ ...map, [c]: { ...(typeof r === "string" ? { emo: r } : r), do: x } })} /></div>
      <button class="small danger" onClick=${() => { const { [c]: _gone, ...rest } = map; write(rest); }} aria-label="Remove the reaction">×</button></div>`)}
  </div>`;
}

function Links(p: { value: unknown; targets: string[]; line: string; onInput(v: unknown): void }) {
  const map = (p.value && typeof p.value === "object" ? p.value : {}) as Record<string, string>;
  const [word, setWord] = useState("");
  const write = (m: Record<string, string>) => p.onInput(Object.keys(m).length ? m : undefined);
  return html`<div><b>Words that point at things (link)</b>
    ${Object.entries(map).map(([w, t]) => html`<div class="row"><span ...${inLang(mainLang())} style="min-width:90px">${w}</span>
      <div class="grow"><${Select} label="" value=${t} options=${p.targets} onInput=${(x: string | undefined) => write(x ? { ...map, [w]: x } : Object.fromEntries(Object.entries(map).filter(([k]) => k !== w)))} /></div></div>`)}
    <div class="row"><select value=${word} style="max-width:200px" aria-label="A word of the line" onChange=${(e: Event) => setWord((e.target as HTMLSelectElement).value)}>
      <option value="">a word of the line…</option>${[...new Set(p.line.toLocaleLowerCase(mainLang()).match(/[\p{L}']+/gu) ?? [])].map(w => html`<option value=${w}>${w}</option>`)}</select>
      <button class="small" disabled=${!word} onClick=${() => { write({ ...map, [word]: p.targets[0] }); setWord(""); }}>+ link it</button></div>
  </div>`;
}

function Sfx(p: { value: unknown; onInput(v: unknown): void }) {
  const list = (p.value ? [p.value].flat() : []) as { id?: string; word?: string }[];
  const write = (l: { id?: string; word?: string }[]) => p.onInput(!l.length ? undefined : l.length === 1 ? l[0] : l);
  return html`<div><b>Sounds (sfx)</b> <button class="small" onClick=${() => write([...list, { id: SOUNDS[0] }])}>+ a sound</button>
    ${list.map((s, i) => html`<div class="row">
      <div class="grow"><${Select} label="Sound" value=${s.id} options=${SOUNDS} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, id: x } : y)))} /></div>
      <div class="grow"><${Text} label="Its written word (a caption)" lang=${mainLang()} value=${s.word} onInput=${(x: string | undefined) => write(list.map((y, k) => (k === i ? { ...y, word: x } : y)))} /></div>
      <button class="small danger" onClick=${() => write(list.filter((_, k) => k !== i))} aria-label="Remove the sound">×</button></div>`)}
  </div>`;
}

/** A JSON value edited as text: applied when it parses. */
export function Json(p: { label: string; value: unknown; rows?: number; onInput(v: unknown): void }) {
  const [text, setText] = useState(p.value === undefined ? "" : JSON.stringify(p.value, null, 2));
  const [bad, setBad] = useState("");
  useEffect(() => { setText(p.value === undefined ? "" : JSON.stringify(p.value, null, 2)); setBad(""); }, [JSON.stringify(p.value)]);
  return html`<div class="field"><label>${p.label}${bad && html` <span style="color:var(--bad)">· ${bad}</span>`}</label>
    <textarea rows=${p.rows ?? 3} style="font:12px/1.4 ui-monospace,monospace" value=${text} aria-label=${p.label} onInput=${(e: Event) => {
      const t = (e.target as HTMLTextAreaElement).value;
      setText(t);
      if (!t.trim()) { setBad(""); p.onInput(undefined); return; }
      try { p.onInput(JSON.parse(t)); setBad(""); } catch (err) { setBad((err as Error).message); }
    }} /></div>`;
}
