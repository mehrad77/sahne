// A place's Source tab: every field as it is stored (the marks as numbers, the set pieces as a list, each prop and the
// camera as JSON), for what the stage and the inspector don't show. `PieceParams` is the control for each param a
// piece's generator declares (`PieceDef.meta`), shared with the inspector.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { type PieceRef } from "sahne";
import type { StoryPlace } from "sahne-story";
import { set } from "../../model/path.ts";
import { pinned } from "../../model/place.ts";
import { KIT } from "../../stage.ts";
import { Check, NumberField, Section, Select, Text } from "../fields.ts";
import { Json } from "../staging.ts";

type Edit = (fn: (x: StoryPlace) => StoryPlace, field?: string) => void;

/** Edit piece `i`, pinning its seed first when its art would change (it has no id or seed yet). */
export const putPiece = (edit: Edit, i: number) => (k: string, v: unknown) =>
  edit(x => set(x, ["pieces", i], { ...pinned(x, x.pieces[i]), [k]: v }), `piece.${i}.${k}`);

/** A control for each param the piece's generator declares. */
export function PieceParams(p: { pc: PieceRef; put(k: string, v: unknown): void }) {
  const def = KIT.set?.[p.pc.kit];
  return html`${Object.entries(def?.meta?.params ?? {}).map(([name, spec]) => {
    const types = [spec.type].flat(), v = p.pc[name], put = (x: unknown) => p.put(name, x);
    if (types.includes("enum") && spec.values) return html`<${Select} label=${name} value=${v} none=${`default (${String(spec.default ?? "")})`} options=${spec.values} onInput=${put} />`;
    if (types[0] === "bool") return html`<${Check} label=${`${name}${spec.about ? ` · ${spec.about}` : ""}`} value=${v ?? spec.default} onInput=${(x: boolean) => put(x === spec.default ? undefined : x)} />`;
    if (types[0] === "int" || types[0] === "num") return html`<${NumberField} label=${name} value=${v} min=${spec.min} max=${spec.max} step=${types[0] === "int" ? 1 : 0.05} onInput=${put} />`;
    if (types[0] === "text" || types[0] === "color") return html`<${Text} label=${`${name}${types[0] === "color" ? " (a palette id or #hex)" : ""}`} value=${v} placeholder=${spec.default === undefined ? "" : String(spec.default)} onInput=${put} />`;
    return html`<${Json} label=${`${name} (${types.join(" or ")})`} value=${v} onInput=${put} />`;
  })}`;
}

export function PlaceSource(p: { doc: StoryPlace; edit: Edit }) {
  const { doc, edit } = p;
  return html`<div>
    <${Section} title=${`Marks (${Object.keys(doc.marks).length})`}>
      <table class="grid"><thead><tr><th>Mark</th><th>x</th><th>y</th><th>z</th><th>facing</th><th>seat</th><th></th></tr></thead><tbody>
      ${Object.entries(doc.marks).map(([mid, m]) => html`<tr><td>${mid}</td>
        ${(["x", "y", "z"] as const).map(k => html`<td><input type="number" step="0.05" style="width:70px" value=${m[k] ?? ""} onInput=${(e: Event) => { const v = (e.target as HTMLInputElement).value; edit(x => set(x, ["marks", mid, k], v === "" ? undefined : Number(v)), `m.${mid}.${k}`); }} /></td>`)}
        <td><select value=${m.facing ?? ""} style="width:auto" onChange=${(e: Event) => edit(x => set(x, ["marks", mid, "facing"], (e.target as HTMLSelectElement).value || undefined))}>${["", "l", "r", "back", "side_l", "side_r"].map(f => html`<option value=${f}>${f || "—"}</option>`)}</select></td>
        <td><input type="number" step="0.05" style="width:60px" value=${m.seat ?? ""} onInput=${(e: Event) => { const v = (e.target as HTMLInputElement).value; edit(x => set(x, ["marks", mid, "seat"], v === "" ? undefined : Number(v))); }} /></td>
        <td><button class="small danger" onClick=${() => confirm(`Delete the mark ${mid}? A story that names it breaks.`) && edit(x => set(x, ["marks", mid], undefined))}>×</button></td></tr>`)}
      </tbody></table></${Section}>
    <${Pieces} doc=${doc} edit=${edit} />
    <${Section} title=${`Props (${Object.keys(doc.props ?? {}).length})`} open=${false}>
      ${Object.entries(doc.props ?? {}).map(([pid, pr]) => html`<${Json} label=${`${pid} (${pr.kit})`} rows=${4} value=${pr} onInput=${(v: unknown) => edit(x => set(x, ["props", pid], v))} />`)}
      <${AddProp} onAdd=${(pid: string, kit: string) => edit(x => set(x, ["props", pid], { kit, at: Object.keys(x.marks)[0] ?? { x: 0, y: 0.9, z: 0 } }))} />
    </${Section}>
    <${Section} title="Camera and the rest">
      <${Json} label="Camera (eye, wide)" rows=${6} value=${doc.camera} onInput=${(v: unknown) => edit(x => set(x, ["camera"], v))} />
      <${Json} label="States" rows=${4} value=${doc.states} onInput=${(v: unknown) => edit(x => set(x, ["states"], v))} />
    </${Section}>
  </div>`;
}

function AddProp(p: { onAdd(id: string, kit: string): void }) {
  const [id, setId] = useState(""), [kit, setKit] = useState("");
  const kits = Object.keys(KIT.props ?? {}).sort();
  return html`<div class="row"><input placeholder="prop id" value=${id} style="max-width:140px" aria-label="A new prop's id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim())} />
    <select value=${kit} style="max-width:180px" aria-label="Its kit" onChange=${(e: Event) => setKit((e.target as HTMLSelectElement).value)}><option value="">kit…</option>${kits.map(k => html`<option>${k}</option>`)}</select>
    <button class="small" disabled=${!/^[a-z0-9_]+$/.test(id) || !kit} onClick=${() => { p.onAdd(id, kit); setId(""); }}>+ a prop</button></div>`;
}

/** The set pieces: a list, and for the selected one its place, variant and the params its generator declares. */
function Pieces(p: { doc: StoryPlace; edit: Edit }) {
  const pieces = p.doc.pieces;
  const [i, select] = useState<number | null>(null);
  const pc = i !== null ? pieces[i] : undefined;
  const def = pc ? KIT.set?.[pc.kit] : undefined;
  const put = putPiece(p.edit, i ?? 0);
  const [kit, setKit] = useState("");
  return html`<${Section} title=${`Set pieces (${pieces.length})`}>
    <div style="max-height:220px;overflow:auto"><table class="grid"><tbody>
      ${pieces.map((x, k) => html`<tr style=${k === i ? "background:var(--chip)" : "cursor:pointer"} onClick=${() => select(k)}><td>${k}</td><td>${x.kit}${x.variant ? ` · ${x.variant}` : ""}</td><td>${x.id ?? ""}</td><td class="note">${x.x}, ${x.y ?? 0}, ${x.z}</td></tr>`)}
    </tbody></table></div>
    <div class="row" style="margin-top:6px"><select value=${kit} style="max-width:200px" aria-label="A piece to add" onChange=${(e: Event) => setKit((e.target as HTMLSelectElement).value)}><option value="">a set piece…</option>${Object.keys(KIT.set ?? {}).sort().map(k => html`<option>${k}</option>`)}</select>
      <button class="small" disabled=${!kit} onClick=${() => { p.edit(x => set(x, ["pieces"], [...x.pieces, { kit, x: 0, z: -1 }])); select(pieces.length); }}>+ add</button></div>
    ${pc && html`<div class="panel fields" style="margin-top:8px">
      <div class="row"><b class="grow">${pc.kit} ${i}</b>
        <button class="small danger" onClick=${() => { if (confirm(`Delete piece ${i} (${pc.kit})?`)) { p.edit(x => set(x, ["pieces"], x.pieces.filter((_, k) => k !== i))); select(null); } }}>Delete</button></div>
      ${def?.meta?.about && html`<p class="note">${def.meta.about}</p>`}
      <${Text} label=${`Id (names it for stories: piece:<id>)${pc.seed ? "" : pc.id ? "" : " · its art is kept"}`} value=${pc.id} onInput=${(v: string | undefined) => put("id", v)} />
      <div class="row">${(["x", "y", "z"] as const).map(k => html`<div class="grow"><${NumberField} label=${k} step=${0.05} value=${pc[k]} onInput=${(v: number | undefined) => put(k, v)} /></div>`)}</div>
      ${def?.variants && html`<${Select} label="Variant" value=${pc.variant} options=${Object.keys(def.variants)} onInput=${(v: string | undefined) => put("variant", v)} />`}
      <${PieceParams} pc=${pc} put=${put} />
    </div>`}
  </${Section}>`;
}
