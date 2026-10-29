// Places: every place of the root (#/places) and a place's page (#/place/<id>): the place on a stage at its times and
// states, its marks as pins you drag on the floor (`Stage.floorAt`) or add with a click, its props, its set pieces with a
// control for each param their generator declares (`PieceDef.meta`), its perch, camera, ambience and surface, and its
// checks live (the 5 KB budget, `lintPlace` and its rules, then the server's place check).
//
// A piece's art comes from its seed: its `seed`, else the site with its `id`, else the site with its kit and position
// (`pieceSeed`). Naming an unnamed piece, or moving one, would change its art; so the editor pins the seed it had first.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { mountStage, pieceSeed, type PieceRef, type Stage } from "sahne";
import { lintPlace, MAX_BYTES, PLACE_RULES, type StoryPlace } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { KIT, LANG } from "../stage.ts";
import { change, checkDocs, checked, createDoc, draftOf, go, history, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { Check, NumberField, Problems, Section, Select, Text } from "./fields.ts";
import { Json } from "./staging.ts";
import type { Problem } from "../api.ts";
import { Gallery } from "./kit/gallery.ts";
import { placeItems } from "./galleries.ts";
import { useLangs } from "./lang.ts";

const SOUNDS = Object.keys(KIT.sounds ?? {}).sort();
const r2 = (n: number) => Math.round(n * 100) / 100;
const bytesOf = (doc: unknown) => new TextEncoder().encode(JSON.stringify(doc)).length;

export function PlacesPage() {
  const w = world.value!;
  const [id, setId] = useState("");
  const ok = /^[a-z0-9_]+$/.test(id) && !w.places[id];
  const { main, translations } = useLangs();
  return html`<section>
    <div class="pagehead"><h2 class="grow">Places</h2>
      <form class="row" onSubmit=${(e: Event) => { e.preventDefault(); if (!ok) return; createDoc("place", id, { v: 1, id, name: Object.fromEntries([main, ...translations].map(l => [l, id])), size: { w: 6, d: 4 }, pieces: [], marks: { a: { x: 0, z: 0 } } }); go("place", id); }}>
        <input value=${id} placeholder="new place id" style="max-width:200px" aria-label="A new place's id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim().toLowerCase())} />
        <button disabled=${!ok}>New place</button></form></div>
    <${Gallery} items=${placeItems({ href: true })} label="Places" size="l" />
  </section>`;
}

export function PlacePage(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(!!draftOf("place", id));
  useEffect(() => { if (!draftOf("place", id)) void openDoc("place", id).then(d => setReady(!!d)); }, [id]);
  if (!ready || !draftOf("place", id)) return html`<p>Opening ${id}…</p>`;
  return html`<${Place} key=${id} id=${id} />`;
}

function Place(p: { id: string }) {
  const w = world.value!;
  const d = draftOf("place", p.id)!, doc = d.doc as StoryPlace;
  const key = keyOf("place", p.id);
  const edit = (fn: (x: StoryPlace) => StoryPlace, field?: string) => change<StoryPlace>("place", p.id, fn, field);
  const box = useRef<HTMLDivElement>(null), pinsEl = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [time, setTime] = useState<string | undefined>(doc.times?.[0]);
  const [states, setStates] = useState<string[]>(Object.entries(doc.states ?? {}).filter(([, s]) => s.default).map(([k]) => k));
  const [adding, setAdding] = useState(false);
  const [piece, setPiece] = useState<number | null>(null);
  const drag = useRef<{ id: string; x: number; z: number } | null>(null);

  const show = (st: Stage, place: StoryPlace) => {
    st.load({ v: 1, cues: [{ scene: { place: place.id, at: {}, ...(time ? { time } : {}), ...(states.length ? { state: states } : {}) } }] }, { cast: {}, places: { [place.id]: place } });
    st.show(0);
  };
  useEffect(() => {
    const st = mountStage(box.current!, { kit: KIT, lang: LANG, bubbles: false, motion: "full", sounds: new URL("/sounds/", location.href).href });
    stage.current = st;
    try { show(st, doc); } catch (e) { console.warn(e); }
    return () => { st.destroy(); stage.current = null; };
  }, []);
  // the stage follows the document (not while a mark is dragged: the pin moves alone, the place loads on release)
  useEffect(() => {
    const t = setTimeout(() => { if (stage.current && !drag.current) try { show(stage.current, doc); } catch (e) { console.warn(e); } }, 250);
    return () => clearTimeout(t);
  }, [doc, time, states.join()]);
  useEffect(() => { const t = setTimeout(() => void checkDocs([key]), 700); return () => clearTimeout(t); }, [doc]);

  // the marks' pins, every frame; a pin drags its mark on the floor
  useEffect(() => {
    const st = stage.current, el = pinsEl.current;
    if (!st || !el) return;
    const draw = () => {
      const marks = { ...doc.marks, ...(drag.current ? { [drag.current.id]: { ...doc.marks[drag.current.id], x: drag.current.x, z: drag.current.z } } : {}) };
      const ids = Object.keys(marks);
      while (el.children.length > ids.length) el.lastChild!.remove();
      ids.forEach((mid, i) => {
        const m = marks[mid];
        const q = st.project([m.x, m.y ?? 0, m.z]);
        let pin = el.children[i] as HTMLSpanElement | undefined;
        if (!pin) { pin = document.createElement("span"); el.append(pin); }
        pin.textContent = mid; pin.dataset.mark = mid;
        pin.className = drag.current?.id === mid ? "hit" : "";
        pin.style.display = q ? "" : "none";
        if (q) { pin.style.left = `${q[0]}px`; pin.style.top = `${q[1]}px`; }
      });
    };
    draw();
    return st.onFrame(draw);
  }, [doc]);

  const floor = (e: PointerEvent, y = 0) => {
    const st = stage.current!, r = st.el.getBoundingClientRect();
    return st.floorAt(e.clientX - r.left, e.clientY - r.top, y);
  };
  const onPinDown = (e: PointerEvent) => {
    const mid = (e.target as HTMLElement).dataset.mark;
    if (!mid) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const m = doc.marks[mid];
    drag.current = { id: mid, x: m.x, z: m.z };
  };
  const onPinMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const f = floor(e, doc.marks[drag.current.id].y ?? 0);
    if (f) { drag.current.x = r2(f[0]); drag.current.z = r2(f[2]); }
  };
  const onPinUp = () => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    edit(x => set(x, ["marks", g.id], { ...x.marks[g.id], x: g.x, z: g.z }));
  };
  const onStageClick = (e: MouseEvent) => {
    if (!adding) return;
    const f = floor(e as unknown as PointerEvent);
    if (!f) return;
    let n = 1;
    while (doc.marks[`mark${n}`]) n++;
    edit(x => set(x, ["marks", `mark${n}`], { x: r2(f[0]), z: r2(f[2]) }));
    setAdding(false);
  };

  const lints = useMemo(() => { try { return lintPlace(doc, { kit: KIT }).map(x => ({ ...x, story: `place:${p.id}`, doc: key } as Problem)); } catch (e) { return [{ rule: "lint", level: "error", story: p.id, message: String(e), doc: key } as Problem]; } }, [doc]);
  const server = (checked.value[key] ?? []).filter(x => x.rule === "schema");
  const size = bytesOf(doc);
  const used = w.episodes.filter(e => e.place === p.id);
  return html`<section>
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0">${doc.name?.en ?? p.id} <small class="note">${p.id}${d.create ? " · new" : ""}${doc.site ? ` · site ${doc.site}` : ""}</small></h2></div>
      <a href="#/places">← places</a>
      <button onClick=${() => history("place", p.id, "undo")} disabled=${!d.past.length}>↶ Undo</button>
      <button onClick=${() => history("place", p.id, "redo")} disabled=${!d.future.length}>↷ Redo</button>
      <button class="primary" onClick=${() => void saveDocs([key])} disabled=${!dirty(d) || !w.writable}>Save</button>
    </div>
    <div class="episode">
      <div>
        <div class="stagebox" style=${adding ? "cursor:crosshair" : ""} onClick=${onStageClick}>
          <div ref=${box}></div>
          <div class="pins" ref=${pinsEl} onPointerDown=${onPinDown} onPointerMove=${onPinMove} onPointerUp=${onPinUp}></div>
        </div>
        <div class="panel row" style="margin-top:8px">
          ${doc.times?.length ? html`<label class="row">time <select value=${time} style="width:auto" onChange=${(e: Event) => setTime((e.target as HTMLSelectElement).value)}>${doc.times.map(t => html`<option>${t}</option>`)}</select></label>` : ""}
          ${Object.keys(doc.states ?? {}).map(s => html`<${Check} label=${s} value=${states.includes(s)} onInput=${(on: boolean) => setStates(on ? [...states, s] : states.filter(x => x !== s))} />`)}
          <span class="grow"></span>
          <button class=${adding ? "primary" : ""} onClick=${() => setAdding(!adding)}>${adding ? "Click the floor…" : "+ a mark"}</button>
        </div>
        <p class="note">Drag a mark's pin to move it on the floor. ${used.length ? `Opens ${used.map(e => e.id).join(", ")}.` : ""}</p>
        <${Section} title=${`Marks (${Object.keys(doc.marks).length})`}>
          <table class="grid"><thead><tr><th>Mark</th><th>x</th><th>y</th><th>z</th><th>facing</th><th>seat</th><th></th></tr></thead><tbody>
          ${Object.entries(doc.marks).map(([mid, m]) => html`<tr><td>${mid}</td>
            ${(["x", "y", "z"] as const).map(k => html`<td><input type="number" step="0.05" style="width:70px" value=${m[k] ?? ""} onInput=${(e: Event) => { const v = (e.target as HTMLInputElement).value; edit(x => set(x, ["marks", mid, k], v === "" ? undefined : Number(v)), `m.${mid}.${k}`); }} /></td>`)}
            <td><select value=${m.facing ?? ""} style="width:auto" onChange=${(e: Event) => edit(x => set(x, ["marks", mid, "facing"], (e.target as HTMLSelectElement).value || undefined))}>${["", "l", "r", "back", "side_l", "side_r"].map(f => html`<option value=${f}>${f || "—"}</option>`)}</select></td>
            <td><input type="number" step="0.05" style="width:60px" value=${m.seat ?? ""} onInput=${(e: Event) => { const v = (e.target as HTMLInputElement).value; edit(x => set(x, ["marks", mid, "seat"], v === "" ? undefined : Number(v))); }} /></td>
            <td><button class="small danger" onClick=${() => confirm(`Delete the mark ${mid}? A story that names it breaks.`) && edit(x => set(x, ["marks", mid], undefined))}>×</button></td></tr>`)}
          </tbody></table></${Section}>
        <${Section} title=${`Props (${Object.keys(doc.props ?? {}).length})`} open=${false}>
          ${Object.entries(doc.props ?? {}).map(([pid, pr]) => html`<${Json} label=${`${pid} (${pr.kit})`} rows=${4} value=${pr} onInput=${(v: unknown) => edit(x => set(x, ["props", pid], v))} />`)}
          <${AddProp} onAdd=${(pid: string, kit: string) => edit(x => set(x, ["props", pid], { kit, at: Object.keys(x.marks)[0] ?? { x: 0, y: 0.9, z: 0 } }))} />
        </${Section}>
      </div>
      <div class="fields">
        <div class="panel fields">
          ${(["tr", "en", "fa"] as const).map(k => html`<${Text} label=${`Name · ${k}`} lang=${k} value=${doc.name?.[k]} onInput=${(v: string | undefined) => edit(x => set(x, ["name", k], v ?? ""), `name.${k}`)} />`)}
          <div class="row">
            <div class="grow"><${NumberField} label="Width (m)" value=${doc.size.w} step=${0.5} onInput=${(v: number | undefined) => v && edit(x => set(x, ["size", "w"], v))} /></div>
            <div class="grow"><${NumberField} label="Depth (m)" value=${doc.size.d} step=${0.5} onInput=${(v: number | undefined) => v && edit(x => set(x, ["size", "d"], v))} /></div>
          </div>
          <${Select} label="Kerim's perch" value=${doc.perch} options=${Object.keys(doc.marks)} onInput=${(v: string | undefined) => edit(x => set(x, ["perch"], v))} />
          <${Select} label="Floor sound (surface)" value=${doc.surface} options=${["stone", "wood", "tile", "carpet"]} onInput=${(v: string | undefined) => edit(x => set(x, ["surface"], v))} />
          <${Text} label="Times it is seen at (comma between)" value=${(doc.times ?? []).join(", ")} onInput=${(v: string | undefined) => { const l = (v ?? "").split(",").map(s => s.trim()).filter(Boolean); edit(x => set(x, ["times"], l.length ? l : undefined)); }} />
          <div class="field"><label>Ambience</label><div class="row">${SOUNDS.filter(s => /amb|crowd|traffic|rain|wind|sea|gull|cafe|room|street|metro|kitchen|birds/.test(s) || (doc.ambience ?? []).includes(s)).map(s => html`<${Check} label=${s} value=${(doc.ambience ?? []).includes(s)} onInput=${(on: boolean) => { const n = on ? [...(doc.ambience ?? []), s] : (doc.ambience ?? []).filter(x => x !== s); edit(x => set(x, ["ambience"], n.length ? n : undefined)); }} />`)}</div></div>
          <${Json} label="Camera (eye, wide)" value=${doc.camera} onInput=${(v: unknown) => edit(x => set(x, ["camera"], v))} />
        </div>
        <${Pieces} doc=${doc} selected=${piece} select=${setPiece} edit=${edit} />
        <h3>Checks <span class=${`chip ${size > MAX_BYTES ? "bad" : "ok"}`}>${size} of ${MAX_BYTES} bytes</span></h3>
        <p class="note">${PLACE_RULES.map(r => `${lints.some(x => x.rule === r && x.level === "error") ? "✗" : lints.some(x => x.rule === r) ? "!" : "✓"} ${r}`).join(" · ")}</p>
        <${Problems} problems=${[...server, ...lints]} empty="No problems: the place lint passes." />
      </div>
    </div>
  </section>`;
}

function AddProp(p: { onAdd(id: string, kit: string): void }) {
  const [id, setId] = useState(""), [kit, setKit] = useState("");
  const kits = Object.keys(KIT.set ?? {}).sort();
  return html`<div class="row"><input placeholder="prop id" value=${id} style="max-width:140px" aria-label="A new prop's id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim())} />
    <select value=${kit} style="max-width:180px" aria-label="Its kit" onChange=${(e: Event) => setKit((e.target as HTMLSelectElement).value)}><option value="">kit…</option>${kits.map(k => html`<option>${k}</option>`)}</select>
    <button class="small" disabled=${!/^[a-z0-9_]+$/.test(id) || !kit} onClick=${() => { p.onAdd(id, kit); setId(""); }}>+ a prop</button></div>`;
}

/** The set pieces: a list, and for the selected one its place, variant and the params its generator declares. */
function Pieces(p: { doc: StoryPlace; selected: number | null; select(i: number | null): void; edit(fn: (x: StoryPlace) => StoryPlace, field?: string): void }) {
  const pieces = p.doc.pieces;
  const i = p.selected, pc = i !== null ? pieces[i] : undefined;
  const def = pc ? KIT.set?.[pc.kit] : undefined;
  /** Edit piece `i`, pinning its seed first when its art would change (it has no id or seed yet). */
  const put = (k: string, v: unknown) => p.edit(x => {
    const cur = x.pieces[i!];
    const pinned: PieceRef = cur.seed || cur.id ? cur : { ...cur, seed: pieceSeed(x, cur) };
    return set(x, ["pieces", i!], { ...pinned, [k]: v });
  }, `piece.${i}.${k}`);
  const [kit, setKit] = useState("");
  return html`<${Section} title=${`Set pieces (${pieces.length})`}>
    <div style="max-height:220px;overflow:auto"><table class="grid"><tbody>
      ${pieces.map((x, k) => html`<tr style=${k === i ? "background:var(--chip)" : "cursor:pointer"} onClick=${() => p.select(k)}><td>${k}</td><td>${x.kit}${x.variant ? ` · ${x.variant}` : ""}</td><td>${x.id ?? ""}</td><td class="note">${x.x}, ${x.y ?? 0}, ${x.z}</td></tr>`)}
    </tbody></table></div>
    <div class="row" style="margin-top:6px"><select value=${kit} style="max-width:200px" aria-label="A piece to add" onChange=${(e: Event) => setKit((e.target as HTMLSelectElement).value)}><option value="">a set piece…</option>${Object.keys(KIT.set ?? {}).sort().map(k => html`<option>${k}</option>`)}</select>
      <button class="small" disabled=${!kit} onClick=${() => { p.edit(x => set(x, ["pieces"], [...x.pieces, { kit, x: 0, z: -1 }])); p.select(pieces.length); }}>+ add</button></div>
    ${pc && html`<div class="panel fields" style="margin-top:8px">
      <div class="row"><b class="grow">${pc.kit} ${i}</b>
        <button class="small danger" onClick=${() => { if (confirm(`Delete piece ${i} (${pc.kit})?`)) { p.edit(x => set(x, ["pieces"], x.pieces.filter((_, k) => k !== i))); p.select(null); } }}>Delete</button></div>
      ${def?.meta?.about && html`<p class="note">${def.meta.about}</p>`}
      <${Text} label=${`Id (names it for stories: piece:<id>)${pc.seed ? "" : pc.id ? "" : " · its art is kept"}`} value=${pc.id} onInput=${(v: string | undefined) => put("id", v)} />
      <div class="row">${(["x", "y", "z"] as const).map(k => html`<div class="grow"><${NumberField} label=${k} step=${0.05} value=${pc[k]} onInput=${(v: number | undefined) => put(k, v)} /></div>`)}</div>
      ${def?.variants && html`<${Select} label="Variant" value=${pc.variant} options=${Object.keys(def.variants)} onInput=${(v: string | undefined) => put("variant", v)} />`}
      ${Object.entries(def?.meta?.params ?? {}).map(([name, spec]) => {
        const types = [spec.type].flat(), v = pc[name];
        if (types.includes("enum") && spec.values) return html`<${Select} label=${name} value=${v} none=${`default (${String(spec.default ?? "")})`} options=${spec.values} onInput=${(x: string | undefined) => put(name, x)} />`;
        if (types[0] === "bool") return html`<${Check} label=${`${name}${spec.about ? ` · ${spec.about}` : ""}`} value=${v ?? spec.default} onInput=${(x: boolean) => put(name, x === spec.default ? undefined : x)} />`;
        if (types[0] === "int" || types[0] === "num") return html`<${NumberField} label=${name} value=${v} min=${spec.min} max=${spec.max} step=${types[0] === "int" ? 1 : 0.05} onInput=${(x: number | undefined) => put(name, x)} />`;
        if (types[0] === "text" || types[0] === "color") return html`<${Text} label=${`${name}${types[0] === "color" ? " (a palette id or #hex)" : ""}`} value=${v} placeholder=${spec.default === undefined ? "" : String(spec.default)} onInput=${(x: string | undefined) => put(name, x)} />`;
        return html`<${Json} label=${`${name} (${types.join(" or ")})`} value=${v} onInput=${(x: unknown) => put(name, x)} />`;
      })}
    </div>`}
  </${Section}>`;
}
