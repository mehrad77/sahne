// The inspector beside the stage: what is selected, in plain words. Nothing selected shows the place (its names, size,
// Kerim's perch, the floor's sound, what the wide shot spans); a piece its sketch, variant and the params its generator
// declares; a prop what it sits on and at which height; a mark its facing, seat and the states it is in.

import { html } from "htm/preact";
import { useMemo } from "preact/hooks";
import type { StoryPlace } from "sahne-story";
import { set } from "../../model/path.ts";
import { duplicate, heights, posOf, remove, type Sel } from "../../model/place.ts";
import { KIT } from "../../stage.ts";
import { Check, NumberField, Text } from "../fields.ts";
import { Texts } from "../lang.ts";
import { pieceItems } from "../galleries.ts";
import { Picture } from "../kit/gallery.ts";
import { Json } from "../staging.ts";
import { PieceParams, putPiece } from "./source.ts";

type Edit = (fn: (x: StoryPlace) => StoryPlace, field?: string) => void;
const FACING: [string, string, string][] = [["", "·", "Straight on"], ["l", "←", "A little to screen left"], ["r", "→", "A little to screen right"], ["back", "↑", "Back to the camera"], ["side_l", "⇠", "Side on, facing left (on a seat)"], ["side_r", "⇢", "Side on, facing right (on a seat)"]];
const r2 = (n: number) => Math.round(n * 100) / 100;

const Chips = (p: { options: readonly string[]; value: readonly string[]; onToggle(v: string): void; label: string }) =>
  html`<div class="pl-chips" role="group" aria-label=${p.label}>${p.options.map(o => html`<button class=${`pl-chip${p.value.includes(o) ? " on" : ""}`} aria-pressed=${p.value.includes(o)} onClick=${() => p.onToggle(o)}>${o.replace(/_/g, " ")}</button>`)}</div>`;

function Xyz(p: { at: { x: number; y: number; z: number }; y?: boolean; onInput(k: "x" | "y" | "z", v: number): void }) {
  return html`<div class="pl-xyz">${(p.y === false ? ["x", "z"] as const : ["x", "y", "z"] as const).map(k => html`<label>${k === "x" ? "across (x)" : k === "y" ? "up (y)" : "depth (z)"}
    <input type="number" step="0.05" value=${p.at[k]} onInput=${(e: Event) => { const v = Number((e.target as HTMLInputElement).value); if (!Number.isNaN(v)) p.onInput(k, v); }} /></label>`)}</div>`;
}

/** The states a thing shows in (`in`): none picked means every state. */
function InStates(p: { doc: StoryPlace; value?: string[]; onInput(v: string[] | undefined): void }) {
  const states = Object.keys(p.doc.states ?? {});
  if (!states.length) return "";
  const v = p.value ?? [];
  return html`<div><div class="lbl">Only in these states ${v.length ? "" : "(now: in all)"}</div>
    <${Chips} label="States" options=${states} value=${v} onToggle=${(s: string) => { const n = v.includes(s) ? v.filter(x => x !== s) : [...v, s]; p.onInput(n.length ? n : undefined); }} /></div>`;
}

export function Inspector(p: { doc: StoryPlace; sel: Sel; edit: Edit; select(s: Sel): void; saved: StoryPlace }) {
  const { doc, sel } = p;
  if (sel?.kind === "piece" && doc.pieces[sel.i]) return html`<${PieceCard} ...${p} i=${sel.i} />`;
  if (sel?.kind === "prop" && doc.props?.[sel.id]) return html`<${PropCard} ...${p} id=${sel.id} />`;
  if (sel?.kind === "mark" && doc.marks[sel.id]) return html`<${MarkCard} ...${p} id=${sel.id} />`;
  return html`<${PlaceCard} doc=${doc} edit=${p.edit} />`;
}

function Head(p: { kit?: string; which?: "set" | "props"; title: string; sub?: string; onDuplicate?(): void; onDelete(): void }) {
  const art = useMemo(() => p.kit && p.which ? pieceItems(p.which).find(i => i.id === p.kit)?.art : undefined, [p.kit, p.which]);
  return html`<header>${art && html`<${Picture} art=${art} label=${p.kit ?? ""} />`}
    <div class="grow"><h3>${p.title}</h3>${p.sub && html`<small>${p.sub}</small>`}</div>
    ${p.onDuplicate && html`<button class="small" title="Duplicate (⌘D)" onClick=${p.onDuplicate}>Copy</button>`}
    <button class="small danger" title="Delete (Delete key)" onClick=${p.onDelete}>Delete</button></header>`;
}

function PlaceCard(p: { doc: StoryPlace; edit: Edit }) {
  const { doc, edit } = p, wide = doc.camera?.wide;
  const marks = Object.keys(doc.marks);
  const setWide = (from: number, to: number) => edit(x => set(x, ["camera", "wide"], { ...x.camera?.wide, x: r2((from + to) / 2), w: r2(Math.max(0.5, to - from)) }), "camera.wide");
  return html`<div class="panel pl-card">
    <header><div class="grow"><h3>The place</h3><small>Select a thing on the stage or the plan to change it.</small></div></header>
    <${Texts} label="Name" value=${doc.name} onInput=${(l: string, v: string | undefined) => edit(x => set(x, ["name", l], v ?? ""), `name.${l}`)} />
    <div class="row">
      <div class="grow"><${NumberField} label="Width (m)" value=${doc.size.w} step=${0.5} onInput=${(v: number | undefined) => v && edit(x => set(x, ["size", "w"], v))} /></div>
      <div class="grow"><${NumberField} label="Depth (m)" value=${doc.size.d} step=${0.5} onInput=${(v: number | undefined) => v && edit(x => set(x, ["size", "d"], v))} /></div>
    </div>
    <div><div class="lbl">Kerim lands on</div><${Chips} label="Kerim's perch" options=${marks} value=${doc.perch ? [doc.perch] : []} onToggle=${(m: string) => edit(x => set(x, ["perch"], x.perch === m ? undefined : m))} /></div>
    <div><div class="lbl">The floor sounds like</div><${Chips} label="Floor sound" options=${["stone", "wood", "tile", "carpet"]} value=${doc.surface ? [doc.surface] : []} onToggle=${(s: string) => edit(x => set(x, ["surface"], x.surface === s ? undefined : s))} /></div>
    <div><div class="lbl">The wide shot spans (metres across; the red bracket on the plan)</div>
      ${wide ? html`<div class="pl-xyz">
        <label>from <input type="number" step="0.1" value=${r2(wide.x - wide.w / 2)} onInput=${(e: Event) => setWide(Number((e.target as HTMLInputElement).value), wide.x + wide.w / 2)} /></label>
        <label>to <input type="number" step="0.1" value=${r2(wide.x + wide.w / 2)} onInput=${(e: Event) => setWide(wide.x - wide.w / 2, Number((e.target as HTMLInputElement).value))} /></label>
        <label>at depth <input type="number" step="0.1" value=${wide.z ?? ""} onInput=${(e: Event) => { const v = (e.target as HTMLInputElement).value; edit(x => set(x, ["camera", "wide", "z"], v === "" ? undefined : Number(v)), "camera.wide.z"); }} /></label></div>`
        : html`<button class="small" onClick=${() => edit(x => set(x, ["camera", "wide"], { x: 0, w: x.size.w }))}>Frame the wide shot</button>`}
    </div>
  </div>`;
}

function PieceCard(p: { doc: StoryPlace; i: number; edit: Edit; select(s: Sel): void }) {
  const { doc, i, edit } = p, pc = doc.pieces[i], def = KIT.set?.[pc.kit];
  const put = putPiece(edit, i);
  const sel: Sel = { kind: "piece", i };
  return html`<div class="panel pl-card">
    <${Head} kit=${pc.kit} which="set" title=${pc.id ?? pc.kit.replace(/_/g, " ")} sub=${`${pc.kit} · set piece ${i}`}
      onDuplicate=${() => { let s: Sel = null; edit(x => { const d = duplicate(x, sel); s = d.sel; return d.doc; }); p.select(s); }}
      onDelete=${() => { if (confirm(`Delete the ${pc.kit}?`)) { edit(x => remove(x, sel)); p.select(null); } }} />
    ${def?.meta?.about && html`<p class="note" style="margin:0">${def.meta.about}</p>`}
    ${def?.variants && html`<div><div class="lbl">Look</div><${Chips} label="Variant" options=${Object.keys(def.variants)} value=${pc.variant ? [pc.variant] : []} onToggle=${(v: string) => put("variant", pc.variant === v ? undefined : v)} /></div>`}
    <${Xyz} at=${{ x: pc.x, y: pc.y ?? 0, z: pc.z }} onInput=${(k: "x" | "y" | "z", v: number) => put(k, k === "y" && v === 0 ? undefined : v)} />
    <${PieceParams} pc=${pc} put=${put} />
    <${InStates} doc=${doc} value=${pc.in} onInput=${(v: string[] | undefined) => put("in", v)} />
    <${Text} label="Its name for stories (piece:<name>), if a story opens or switches it" value=${pc.id} onInput=${(v: string | undefined) => put("id", v)} />
  </div>`;
}

function PropCard(p: { doc: StoryPlace; id: string; edit: Edit; select(s: Sel): void }) {
  const { doc, id, edit } = p, pr = doc.props![id], def = KIT.props?.[pr.kit];
  const sel: Sel = { kind: "prop", id }, pos = posOf(doc, sel)!;
  const put = (k: string, v: unknown) => edit(x => set(x, ["props", id, k], v), `prop.${id}.${k}`);
  const onMark = typeof pr.at === "string" ? pr.at : "";
  const hs = useMemo(() => heights(doc), [doc]);
  return html`<div class="panel pl-card">
    <${Head} kit=${pr.kit} which="props" title=${id} sub=${`${pr.kit} · prop`}
      onDuplicate=${() => { let s: Sel = null; edit(x => { const d = duplicate(x, sel); s = d.sel; return d.doc; }); p.select(s); }}
      onDelete=${() => { if (confirm(`Delete the prop ${id}? A story that names it breaks.`)) { edit(x => remove(x, sel)); p.select(null); } }} />
    ${def?.meta?.about && html`<p class="note" style="margin:0">${def.meta.about}</p>`}
    <div><div class="lbl">It sits</div>
      <select value=${onMark} aria-label="It sits on" onChange=${(e: Event) => { const m = (e.target as HTMLSelectElement).value; put("at", m || { ...pos }); }}>
        <option value="">where it is put (free)</option>${Object.keys(doc.marks).map(m => html`<option value=${m}>on the mark ${m}</option>`)}</select></div>
    ${!onMark && html`<div><div class="lbl">At the height of</div>
      <${Chips} label="Height" options=${hs.map(h => h.label)} value=${hs.filter(h => Math.abs(h.y - pos.y) < 0.026).map(h => h.label)} onToggle=${(l: string) => put("at", { ...pos, y: hs.find(h => h.label === l)!.y })} /></div>
      <${Xyz} at=${pos} onInput=${(k: "x" | "y" | "z", v: number) => put("at", { ...pos, [k]: v })} />`}
    ${def?.variants && html`<div><div class="lbl">Look</div><${Chips} label="Variant" options=${Object.keys(def.variants)} value=${pr.variant ? [pr.variant] : []} onToggle=${(v: string) => put("variant", pr.variant === v ? undefined : v)} /></div>`}
    <div class="row">
      <div class="grow"><${NumberField} label="How many" value=${pr.n} min=${1} onInput=${(v: number | undefined) => put("n", v && v > 1 ? v : undefined)} /></div>
      <div class="grow" style="align-self:end"><${Check} label="Shown when the scene opens" value=${pr.shown !== false} onInput=${(v: boolean) => put("shown", v ? undefined : false)} /></div>
    </div>
    <${InStates} doc=${doc} value=${pr.in} onInput=${(v: string[] | undefined) => put("in", v)} />
    <details><summary class="note">All of it (JSON)</summary><${Json} label=${id} rows=${6} value=${pr} onInput=${(v: unknown) => edit(x => set(x, ["props", id], v))} /></details>
  </div>`;
}

function MarkCard(p: { doc: StoryPlace; id: string; edit: Edit; select(s: Sel): void; saved: StoryPlace }) {
  const { doc, id, edit } = p, m = doc.marks[id];
  const put = (k: string, v: unknown) => edit(x => set(x, ["marks", id, k], v), `mark.${id}.${k}`);
  const fresh = !p.saved.marks?.[id];
  const rename = (to: string | undefined) => {
    if (!to || !/^[a-z0-9_]+$/.test(to) || doc.marks[to]) return;
    edit(x => ({ ...x, marks: Object.fromEntries(Object.entries(x.marks).map(([k, v]) => [k === id ? to : k, v])), ...(x.perch === id ? { perch: to } : {}) }));
    p.select({ kind: "mark", id: to });
  };
  return html`<div class="panel pl-card">
    <${Head} title=${`Mark ${id}`} sub=${m.air ? "a spot in the air (a bird hovers there)" : m.seat !== undefined ? "a seat" : "a spot on the floor"}
      onDelete=${() => { if (confirm(`Delete the mark ${id}? A story that names it breaks.`)) { edit(x => remove(x, { kind: "mark", id })); p.select(null); } }} />
    ${fresh && html`<${Text} label="Its name (stories use it; it can change until the place is saved)" value=${id} onInput=${rename} />`}
    <div><div class="lbl">Facing</div><div class="pl-face" role="group" aria-label="Facing">
      ${FACING.map(([v, a, t]) => html`<button class=${`pl-chip${(m.facing ?? "") === v ? " on" : ""}`} title=${t} aria-label=${t} aria-pressed=${(m.facing ?? "") === v} onClick=${() => put("facing", v || undefined)}>${a}</button>`)}</div></div>
    <${Xyz} at=${{ x: m.x, y: m.y ?? 0, z: m.z }} onInput=${(k: "x" | "y" | "z", v: number) => put(k, k === "y" && v === 0 ? undefined : v)} />
    <div class="row">
      <${Check} label="A seat" value=${m.seat !== undefined} onInput=${(on: boolean) => put("seat", on ? 0.45 : undefined)} />
      ${m.seat !== undefined && html`<label class="row" style="font-size:13px">seat height <input type="number" step="0.05" style="width:70px" value=${m.seat} onInput=${(e: Event) => put("seat", Number((e.target as HTMLInputElement).value))} /></label>`}
    </div>
    <${Check} label="In the air (a bird hovers there)" value=${!!m.air} onInput=${(on: boolean) => put("air", on || undefined)} />
    <${Check} label="Kerim's perch" value=${doc.perch === id} onInput=${(on: boolean) => edit(x => set(x, ["perch"], on ? id : undefined))} />
    <${InStates} doc=${doc} value=${m.in} onInput=${(v: string[] | undefined) => put("in", v)} />
  </div>`;
}
