// The cast: everyone of the series as a portrait (#/cast), and a character's page (#/character/<id>): their look in
// Sahne's builder in author mode (every part, the cast's own included), their outfits (each previewed on them), their
// names, role and bio in Turkish and Persian, colour, voice, how they address the others, the places they belong to, and
// the raw document for the rest (the album, the catchphrases). Extras are generated (sahne-story/cast/extras.ts): they are
// shown, never edited. A new character gets a new id: ids are permanent, and a retired one is refused.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { applyLook, AVATAR_MAX_BYTES, mountBuilder, portrait, serialize, type AvatarDoc, type BuilderUI } from "sahne";
import type { CharacterDoc } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { KIT } from "../stage.ts";
import { change, checkDocs, checked, createDoc, draftOf, go, history, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { NumberField, Problems, Section, Select, Text, tx } from "./fields.ts";
import { Json } from "./staging.ts";

const svg = (doc: unknown, size = 120, framing: "head" | "bust" | "full" = "bust") => {
  try { return portrait(doc, KIT, { framing, size, trusted: true }); } catch { return ""; }
};
const bytes = (doc: AvatarDoc) => new TextEncoder().encode(serialize(doc)).length;

export function CastPage() {
  const w = world.value!;
  const all = Object.values(w.characters).sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999));
  const roster = all.filter(c => c.kind !== "extra"), extras = all.filter(c => c.kind === "extra");
  const card = (c: CharacterDoc) => html`<a class="card" href=${`#/character/${c.id}`}>
    <div class="portrait" dangerouslySetInnerHTML=${{ __html: c.avatar ? svg(c.avatar) : "" }}></div>
    <b>${tx(c.name)}</b><small>${c.id} · ${c.kind}${c.role ? ` · ${tx(c.role, "en")}` : ""}</small></a>`;
  return html`<section>
    <div class="row"><h2 class="grow">The cast</h2><${NewCharacter} /></div>
    <div class="cards">${roster.map(card)}</div>
    <h3>Extras (${extras.length}, written by sahne-story/cast/extras.ts)</h3>
    <div class="cards">${extras.map(card)}</div>
  </section>`;
}

function NewCharacter() {
  const w = world.value!;
  const [id, setId] = useState("");
  const taken = !!w.characters[id], ok = /^[a-z][a-z0-9_]*$/.test(id) && !taken;
  const create = () => {
    const order = Math.max(0, ...Object.values(w.characters).filter(c => c.kind !== "extra").map(c => Number(c.order ?? 0))) + 1;
    const base = w.characters[w.series?.standin ?? "nima"]?.avatar;
    createDoc("character", id, { id, order, name: { tr: id[0].toUpperCase() + id.slice(1), fa: "…" }, kind: "cast", role: { en: "…", fa: "…" }, bio: { en: "…", fa: "…" }, color: "#7A6A58", level: "A1", ...(base ? { avatar: base } : {}) });
    go("character", id);
  };
  return html`<form class="row" onSubmit=${(e: Event) => { e.preventDefault(); if (ok) create(); }}>
    <input value=${id} placeholder="new id (a-z, 0-9, _)" style="max-width:200px" aria-label="A new character's id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim().toLowerCase())} />
    <button disabled=${!ok}>${taken ? "Taken" : "New character"}</button></form>`;
}

export function CharacterPage(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(!!draftOf("character", id));
  useEffect(() => { if (!draftOf("character", id)) void openDoc("character", id).then(d => setReady(!!d)); }, [id]);
  const d = draftOf("character", id);
  if (!ready || !d) return html`<p>Opening ${id}…</p>`;
  return html`<${Character} key=${id} id=${id} />`;
}

function Character(p: { id: string }) {
  const w = world.value!;
  const d = draftOf("character", p.id)!, c = d.doc as CharacterDoc & Record<string, any>, was = d.saved as CharacterDoc;
  const key = keyOf("character", p.id);
  const extra = c.kind === "extra";
  const edit = (fn: (x: CharacterDoc) => CharacterDoc, field?: string) => change<CharacterDoc>("character", p.id, fn, field);
  const put = (k: string, v: unknown) => edit(x => set(x, [k], v), k);
  const host = useRef<HTMLDivElement>(null);
  const ui = useRef<BuilderUI | null>(null);
  const [outfit, setOutfit] = useState<string>("");

  useEffect(() => {
    if (!host.current || !c.avatar || extra) return;
    ui.current = mountBuilder(host.current, { kit: KIT, doc: c.avatar, mode: "author", lang: "en", preview: "stage", onChange: doc => edit(x => set(x, ["avatar"], doc), "avatar") });
    return () => { ui.current?.destroy(); ui.current = null; };
  }, [p.id, d.create ? "new" : "old"]);

  useEffect(() => { const t = setTimeout(() => void checkDocs([key]), 600); return () => clearTimeout(t); }, [c]);

  const outfits = Object.keys(c.outfits ?? {});
  const look = outfit && c.avatar ? applyLook(c.avatar, c.outfits![outfit]) : c.avatar;
  const size = c.avatar ? bytes(c.avatar) : 0;
  const others = Object.values(w.characters).filter(o => o.kind === "cast" && o.id !== p.id);
  return html`<section>
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0">${tx(c.name)} <small class="note">${p.id} · ${c.kind}${d.create ? " · new" : ""}</small></h2></div>
      <a href="#/cast">← the cast</a>
      <button onClick=${() => history("character", p.id, "undo")} disabled=${!d.past.length}>↶ Undo</button>
      <button onClick=${() => history("character", p.id, "redo")} disabled=${!d.future.length}>↷ Redo</button>
      <button class="primary" onClick=${() => void saveDocs([key])} disabled=${extra || !dirty(d) || !w.writable}>Save</button>
    </div>
    ${extra && html`<p class="note">An extra: generated by <code>node packages/sahne-story/cast/extras.ts</code>, so it is shown here, never edited.</p>`}
    ${c.puppet && html`<p class="note">Played by the kit's ${c.puppet} puppet: no look to build.</p>`}
    <div class="episode">
      <div>
        ${c.avatar && !extra && html`<div class="panel"><div ref=${host} style="height:620px"></div>
          <p class="note"><span class=${`chip ${size > AVATAR_MAX_BYTES ? "bad" : "ok"}`}>${size} of ${AVATAR_MAX_BYTES} bytes</span></p></div>`}
        ${c.avatar && html`<${Section} title=${`Outfits (${outfits.length})`}>
          <div class="row">${["", ...outfits].map(o => html`<button class=${`small${outfit === o ? " primary" : ""}`} onClick=${() => setOutfit(o)}>${o || "default"}</button>`)}</div>
          <div class="row" style="align-items:flex-start;margin-top:8px">
            <div class="portrait" style="width:180px" dangerouslySetInnerHTML=${{ __html: svg(look, 220, "full") }}></div>
            <div class="grow">${!extra && html`<${Json} label=${outfit ? `The outfit "${outfit}" (a look: clothes only)` : "Every outfit, by name (a look each: clothes only; \"default\" is the avatar itself)"} rows=${10}
              value=${outfit ? c.outfits?.[outfit] : c.outfits} onInput=${(v: unknown) => put("outfits", outfit ? { ...(c.outfits ?? {}), [outfit]: v } : v)} />`}</div>
          </div></${Section}>`}
      </div>
      <div class="fields">
        ${!extra && html`<div class="panel fields">
          <${Text} label="Name (Turkish)" lang="tr" value=${c.name?.tr} changed=${c.name?.tr !== was.name?.tr} onInput=${(v: string | undefined) => put("name", { ...c.name, tr: v ?? "" })} />
          <${Text} label="Name (Persian)" lang="fa" value=${c.name?.fa} changed=${c.name?.fa !== was.name?.fa} onInput=${(v: string | undefined) => put("name", { ...c.name, fa: v ?? "" })} />
          <${Text} label="Role · English" value=${c.role?.en} onInput=${(v: string | undefined) => put("role", { ...c.role, en: v ?? "" })} />
          <${Text} label="Role · Persian" lang="fa" value=${c.role?.fa} onInput=${(v: string | undefined) => put("role", { ...c.role, fa: v ?? "" })} />
          <${Text} label="Bio · English" multi value=${c.bio?.en} onInput=${(v: string | undefined) => put("bio", { ...c.bio, en: v ?? "" })} />
          <${Text} label="Bio · Persian" lang="fa" multi value=${c.bio?.fa} onInput=${(v: string | undefined) => put("bio", { ...c.bio, fa: v ?? "" })} />
          <div class="row">
            <label class="field">Colour <input type="color" style="width:60px;height:34px;padding:2px" value=${c.color} onInput=${(e: Event) => put("color", (e.target as HTMLInputElement).value.toUpperCase())} /></label>
            <div class="grow"><${NumberField} label="Order" value=${c.order} min=${1} onInput=${(v: number | undefined) => put("order", v)} /></div>
            <div class="grow"><${Select} label="Level" value=${c.level} options=${["A1", "A2", "B1"]} onInput=${(v: string | undefined) => put("level", v)} /></div>
          </div>
          <div class="row">
            <div class="grow"><${NumberField} label="Voice pitch" value=${c.voice?.pitch} step=${0.05} onInput=${(v: number | undefined) => put("voice", { ...(c.voice ?? {}), pitch: v })} /></div>
            <div class="grow"><${NumberField} label="Voice rate" value=${c.voice?.rate} step=${0.05} onInput=${(v: number | undefined) => put("voice", { ...(c.voice ?? {}), rate: v })} /></div>
          </div>
        </div>
        <${Section} title="How they address the others (sen or siz)">
          ${others.map(o => html`<div class="row"><span style="min-width:110px">${tx(o.name)}</span><div class="grow"><${Select} label="" value=${c.address?.[o.id]} options=${["sen", "siz"]}
            onInput=${(v: string | undefined) => { const a = { ...(c.address ?? {}) }; if (v) a[o.id] = v; else delete a[o.id]; put("address", Object.keys(a).length ? a : undefined); }} /></div></div>`)}
        </${Section}>
        <${Section} title="Where they belong (places)">
          <div class="row">${Object.entries(w.places).map(([pid, pl]) => html`<label class="row"><input type="checkbox" style="width:auto" checked=${(c.places ?? []).includes(pid)}
            onChange=${(e: Event) => { const on = (e.target as HTMLInputElement).checked, now = (c.places ?? []) as string[]; const n = on ? [...now, pid] : now.filter(x => x !== pid); put("places", n.length ? n : undefined); }} /> ${pl.name?.en ?? pid}</label>`)}</div>
        </${Section}>
        <${Section} title="The whole document (album, catchphrases, motion …)" open=${false}>
          <${Json} label=${`characters/${p.id}.json`} rows=${16} value=${c} onInput=${(v: unknown) => v && typeof v === "object" && edit(() => v as CharacterDoc)} />
        </${Section}>`}
        <h3>Problems</h3>
        <${Problems} problems=${checked.value[key] ?? []} empty="No problems: the cast check passes." />
      </div>
    </div>
  </section>`;
}
