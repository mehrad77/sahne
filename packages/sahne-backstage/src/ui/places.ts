// Places: every place of the root (#/places) and a place's page (#/place/<id>).
//
// A place's page is the place on a stage you edit (`place/stage.ts`): a click selects a piece, a prop or a mark, a drag
// moves it on the floor, and the catalogue (`place/catalogue.ts`) drops new ones where you click. Under it are the times,
// states and ambience (`place/mood.ts`) and a ground plan (`place/plan.ts`) to place things in depth. Beside it the
// inspector (`place/inspector.ts`) shows what is selected in plain words, then the checks live (the 5 KB budget,
// `lintPlace` and its rules, then the server's place check). The Source tab (`place/source.ts`) keeps every field as it
// is stored. Selection and moves are pure (`model/place.ts`).
//
// A piece's art comes from its seed: its `seed`, else the site with its `id`, else the site with its kit and position
// (`pieceSeed`). Naming an unnamed piece, or moving one, would change its art; so the editor pins the seed it had first.

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { lintPlace, MAX_BYTES, PLACE_RULES, type StoryPlace } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { duplicate, move, nextId, nudge, posOf, remove, type Sel } from "../model/place.ts";
import { KIT } from "../stage.ts";
import { change, checkDocs, checked, createDoc, draftOf, go, history, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { Problems } from "./fields.ts";
import { ProposalsStrip, ProposedDoc, proposedNew } from "./proposed.ts";
import type { Problem } from "../api.ts";
import { Gallery } from "./kit/gallery.ts";
import { placeItems } from "./galleries.ts";
import { inLang, inSeries, useLangs } from "./lang.ts";
import { Catalogue } from "./place/catalogue.ts";
import { Inspector } from "./place/inspector.ts";
import { MoodStrip } from "./place/mood.ts";
import { GroundPlan } from "./place/plan.ts";
import { PlaceSource } from "./place/source.ts";
import { PlaceStage, type Drop } from "./place/stage.ts";
import { placeStyles } from "./place/style.ts";
import { SaveButton } from "./readonly.ts";

const bytesOf = (doc: unknown) => new TextEncoder().encode(JSON.stringify(doc)).length;
const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };

export function PlacesPage() {
  const w = world.value!;
  const [id, setId] = useState(""), [from, setFrom] = useState("");
  const ok = /^[a-z0-9_]+$/.test(id) && !w.places[id];
  const { main, translations } = useLangs();
  const create = (e: Event) => {
    e.preventDefault();
    if (!ok) return;
    const name = Object.fromEntries([main, ...translations].map(l => [l, id]));
    const base = from ? w.places[from] : null;
    createDoc("place", id, base ? { ...structuredClone(base), id, name, site: undefined } : { v: 1, id, name, size: { w: 6, d: 4 }, pieces: [], marks: { a: { x: 0, z: 0 } } });
    go("place", id);
  };
  return html`<section>
    <div class="pagehead"><h2 class="grow">Places</h2>
      <form class="row" onSubmit=${create}>
        <input value=${id} placeholder="new place id" style="max-width:200px" aria-label="A new place's id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim().toLowerCase())} />
        <select value=${from} style="max-width:220px" aria-label="Start from" onChange=${(e: Event) => setFrom((e.target as HTMLSelectElement).value)}>
          <option value="">an empty room</option>${Object.keys(w.places).sort().map(p => html`<option value=${p}>a copy of ${p}</option>`)}</select>
        <button disabled=${!ok}>New place</button></form></div>
    <${Gallery} items=${placeItems({ href: true })} label="Places" size="l" />
  </section>`;
}

export function PlacePage(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(!!draftOf("place", id));
  useEffect(() => { if (!draftOf("place", id) && !proposedNew("place", id)) void openDoc("place", id).then(d => setReady(!!d)); }, [id]);
  const proposed = proposedNew("place", id);
  if (!draftOf("place", id) && proposed) return html`<${ProposedDoc} x=${proposed} />`;
  if (!ready || !draftOf("place", id)) return html`<p>Opening ${id}…</p>`;
  return html`<${Place} key=${id} id=${id} />`;
}

function Place(p: { id: string }) {
  placeStyles();
  const w = world.value!;
  const d = draftOf("place", p.id)!, doc = d.doc as StoryPlace;
  const key = keyOf("place", p.id);
  const edit = (fn: (x: StoryPlace) => StoryPlace, field?: string) => change<StoryPlace>("place", p.id, fn, field);
  const [tab, setTab] = useState<"stage" | "source">("stage");
  const [time, setTime] = useState<string | undefined>(doc.times?.[0]);
  const [states, setStates] = useState<string[]>(Object.entries(doc.states ?? {}).filter(([, s]) => s.default).map(([k]) => k));
  const [sel, setSel] = useState<Sel>(null);
  const [adding, setAdding] = useState(false);
  const [drop, setDrop] = useState<Drop | null>(null);
  useEffect(() => { const t = setTimeout(() => void checkDocs([key]), 700); return () => clearTimeout(t); }, [doc]);
  // a selection whose thing is gone (undone, deleted in Source) lets go
  useEffect(() => { if (sel && !posOf(doc, sel)) setSel(null); }, [doc]);

  const put = (at: { x: number; y: number; z: number }, dr: Drop) => {
    let s: Sel = null;
    edit(x => {
      if (dr.kind === "piece") { s = { kind: "piece", i: x.pieces.length }; return set(x, ["pieces"], [...x.pieces, { kit: dr.kit, x: at.x, ...(at.y ? { y: at.y } : {}), z: at.z }]); }
      if (dr.kind === "prop") { const id = nextId(Object.keys(x.props ?? {}), dr.kit); s = { kind: "prop", id }; return set(x, ["props", id], { kit: dr.kit, at }); }
      const id = nextId(Object.keys(x.marks), "mark"); s = { kind: "mark", id };
      return set(x, ["marks", id], { x: at.x, z: at.z });
    });
    setSel(s);
    setDrop(null);
    setAdding(false);
  };
  const del = (s: Sel) => {
    if (!s) return;
    const what = s.kind === "piece" ? `the ${doc.pieces[s.i]?.kit}` : `the ${s.kind} ${s.id}? A story that names it breaks.`;
    if (!confirm(`Delete ${what}${s.kind === "piece" ? "?" : ""}`)) return;
    edit(x => remove(x, s));
    setSel(null);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (tab !== "stage" || typing(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { if (drop) setDrop(null); else setSel(null); return; }
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); history("place", p.id, e.shiftKey ? "redo" : "undo"); return; }
      if (!sel) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); del(sel); return; }
      if (mod && e.key.toLowerCase() === "d" && sel.kind !== "mark") { e.preventDefault(); let s: Sel = null; edit(x => { const r = duplicate(x, sel); s = r.sel; return r.doc; }); setSel(s); return; }
      const step = e.shiftKey ? 0.25 : 0.05;
      const dir: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (dir[e.key]) { e.preventDefault(); edit(x => nudge(x, sel, ...dir[e.key]), `nudge.${JSON.stringify(sel)}`); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [tab, sel, drop, doc]);

  const langs = useLangs();
  const lints = useMemo(() => { try { return lintPlace(doc, { kit: KIT, languages: langs }).map(x => ({ ...x, story: `place:${p.id}`, doc: key } as Problem)); } catch (e) { return [{ rule: "lint", level: "error", story: p.id, message: String(e), doc: key } as Problem]; } }, [doc, langs.main, langs.translations.join()]);
  const server = (checked.value[key] ?? []).filter(x => x.rule === "schema");
  const size = bytesOf(doc);
  const used = w.episodes.filter(e => e.place === p.id);
  const pick = (dr: Drop | null) => { setDrop(dr); if (dr) setSel(null); };

  return html`<section>
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0" ...${inLang(langs.main)}>${inSeries(doc.name) ?? p.id} <small dir="ltr" lang="en" class="note">${p.id}${d.create ? " · new" : ""}${doc.site ? ` · site ${doc.site}` : ""}${used.length ? ` · opens ${used.map(e => e.id).join(", ")}` : ""}</small></h2></div>
      <div class="tabs" role="tablist" style="margin:0;border:0">
        <button role="tab" aria-selected=${tab === "stage"} onClick=${() => setTab("stage")}>Stage</button>
        <button role="tab" aria-selected=${tab === "source"} onClick=${() => setTab("source")}>Source</button></div>
      <a href="#/places">← places</a>
      <button onClick=${() => history("place", p.id, "undo")} disabled=${!d.past.length} title="Undo (⌘Z)">↶ Undo</button>
      <button onClick=${() => history("place", p.id, "redo")} disabled=${!d.future.length} title="Redo (⇧⌘Z)">↷ Redo</button>
      <${SaveButton} onSave=${() => void saveDocs([key])} disabled=${!dirty(d)} />
    </div>
    <${ProposalsStrip} kind="place" id=${p.id} />
    <div class="pl">
      <div class="pl-main">
        <div style=${tab === "stage" ? "" : "display:none"}>
          <${PlaceStage} doc=${doc} sel=${sel} time=${time} states=${states} drop=${drop} select=${setSel}
            move=${(s: Sel, dx: number, dz: number) => edit(x => nudge(x, s, dx, dz))} onDrop=${put} />
        </div>
        ${tab === "stage" ? html`
          <${MoodStrip} doc=${doc} edit=${edit} time=${time} setTime=${setTime} states=${states} setStates=${setStates} />
          <${GroundPlan} doc=${doc} sel=${sel} drop=${drop} select=${setSel} onDrop=${put}
            moveTo=${(s: Sel, x: number, z: number) => edit(y => move(y, s, x, z))} />`
          : html`<${PlaceSource} doc=${doc} edit=${edit} />`}
      </div>
      <div class="pl-side">
        ${tab === "stage" && (adding
          ? html`<${Catalogue} drop=${drop} onPick=${pick} onClose=${() => { setAdding(false); setDrop(null); }} />`
          : html`<button class="primary" onClick=${() => setAdding(true)}>+ Add a prop, a set piece or a mark</button>
            <${Inspector} doc=${doc} sel=${sel} edit=${edit} select=${setSel} saved=${d.saved as StoryPlace} />`)}
        <div class="panel pl-card">
          <header><h3 class="grow">Checks</h3><span class=${`chip ${size > MAX_BYTES ? "bad" : "ok"}`}>${size} of ${MAX_BYTES} bytes</span></header>
          <div class=${`pl-budget${size > MAX_BYTES ? " bad" : ""}`} title="The 5 KB budget"><i style=${`width:${Math.min(100, size / MAX_BYTES * 100)}%`}></i></div>
          <p class="note" style="margin:0">${PLACE_RULES.map(r => `${lints.some(x => x.rule === r && x.level === "error") ? "✗" : lints.some(x => x.rule === r) ? "!" : "✓"} ${r}`).join(" · ")}</p>
          <${Problems} problems=${[...server, ...lints]} empty="No problems: the place lint passes." />
        </div>
      </div>
    </div>
  </section>`;
}
