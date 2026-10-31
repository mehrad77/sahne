// The cast: everyone of the series as a portrait (#/cast), and a character's page (#/character/<id>): their look in
// Sahne's builder in author mode (every part, the cast's own included), their outfits (each previewed on them), their
// name, role and bio in the series' languages, colour, voice, how they address the others, the places they belong to, and
// the raw document for the rest (the album, the catchphrases). Extras are generated (sahne-story/cast/extras.ts): they are
// shown, never edited. A new character starts from a card at the head of the cast (or the header's button): a modal asks
// who they are (a name, the id made from it, a role) and what they look like to begin with (the stand-in, a few random
// looks, or a copy of someone), then opens their page; with a few words about them, the assistant drafts the rest there
// (their role, bio and names, as a proposal to accept). Ids are permanent, and a taken or retired one is refused. A
// character no one needs is deleted after a confirmation, from their card's menu (a right click) or their page: never
// an extra, the stand-in or the narrator, or one an episode names.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { applyLook, AVATAR_MAX_BYTES, createBuilder, mountBuilder, portrait, serialize, type AvatarDoc, type BuilderUI } from "sahne";
import type { CharacterDoc } from "sahne-story";
import { set } from "../model/path.ts";
import { idFrom, idProblem } from "../model/newid.ts";
import { dirty } from "../model/history.ts";
import { KIT } from "../stage.ts";
import { change, checkDocs, checked, createDoc, deleteCharacter, draftOf, go, history, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { newChat, send } from "./assistant.ts";
import { NumberField, Problems, Section, Select, tx } from "./fields.ts";
import { ProposalsStrip, ProposedDoc, proposedNew } from "./proposed.ts";
import { Gallery, type Item } from "./kit/gallery.ts";
import { Icon, Modal, Popover } from "./kit/index.ts";
import { characterItems } from "./galleries.ts";
import { inSeries, Texts, useLangs } from "./lang.ts";
import { Json } from "./staging.ts";
import { SaveButton } from "./readonly.ts";

const svg = (doc: unknown, size = 120, framing: "head" | "bust" | "full" = "bust") => {
  try { return portrait(doc, KIT, { framing, size, trusted: true }); } catch { return ""; }
};
const bytes = (doc: AvatarDoc) => new TextEncoder().encode(serialize(doc)).length;

export function CastPage() {
  const w = world.value!, { main } = useLangs();
  const [tab, setTab] = useState<"cast" | "extras">("cast");
  const items = characterItems({ main, href: true }).filter(i => (tab === "extras") === i.tags?.includes("extras"));
  const n = Object.values(w.characters).filter(c => c.kind === "extra").length;
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null), [deleting, setDeleting] = useState<string | null>(null);
  // a right click on a character's card: open them, or delete them
  const onMenu = (e: MouseEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.tile[href^='#/character/']")?.getAttribute("href")?.slice(12);
    if (!id) return;
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY });
  };
  const PLUS = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  const add: Item = { id: "+new", label: "New character", sub: w.writable ? "A name, a role and a look to start from" : "Read-only: start backstage with --write to add people", keywords: "new add", art: PLUS, cls: `newcard${w.writable ? "" : " off"}` };
  return html`<section>
    <div class="pagehead"><h2 class="grow">The cast</h2>${w.writable && html`<button onClick=${() => setAdding(true)}><${Icon} name="plus" size=${16} /> New character</button>`}</div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected=${tab === "cast"} onClick=${() => setTab("cast")}>Characters (${Object.keys(w.characters).length - n})</button>
      <button role="tab" aria-selected=${tab === "extras"} onClick=${() => setTab("extras")}>Extras (${n})</button></div>
    ${tab === "extras" && html`<p class="note">The silent people of the places, written by <code>sahne-story/cast/extras.ts</code>: shown here, never edited by hand.</p>`}
    <div onContextMenu=${onMenu}><${Gallery} items=${tab === "cast" ? [add, ...items] : items} label=${tab === "extras" ? "Extras" : "Characters"} size="l" onPick=${(id: string) => { if (id === add.id && w.writable) setAdding(true); }} /></div>
    ${adding && html`<${NewCharacter} onClose=${() => setAdding(false)} />`}
    ${menu && html`<${Popover} x=${menu.x} y=${menu.y} onClose=${() => setMenu(null)} label=${`${menu.id}: actions`}><div class="menu">
      <button onClick=${() => { setMenu(null); go("character", menu.id); }}><b>Open</b><small>their page: the look, outfits, bio</small></button>
      <button class="danger" disabled=${!!whyKept(menu.id)} title=${whyKept(menu.id) ?? undefined} onClick=${() => { setDeleting(menu.id); setMenu(null); }}><b>Delete…</b><small>${whyKept(menu.id) ?? "after you confirm"}</small></button>
    </div></${Popover}>`}
    ${deleting && html`<${DeleteCharacter} id=${deleting} onClose=${() => setDeleting(null)} />`}
  </section>`;
}

/** Who a new character is and how they look to begin with; creating them opens their page (the builder, outfits, bio). */
function NewCharacter(p: { onClose(): void }) {
  const w = world.value!, l = useLangs(), say = l.translations[0];
  const named = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; } };
  const retired = new Set(w.retired ?? []);
  const taken = (id: string) => !!w.characters[id] || retired.has(id);
  const [name, setName] = useState(""), [role, setRole] = useState(""), [about, setAbout] = useState("");
  const [typed, setTyped] = useState<string | null>(null), [editId, setEditId] = useState(false);
  const id = typed ?? idFrom(name, taken);
  const problem = idProblem(id, id => !!w.characters[id], id => retired.has(id));
  // the looks to start from: the stand-in, four random ones (a new roll each time), or a copy of someone
  const standin = w.characters[w.series?.standin ?? "nima"]?.avatar;
  const [roll, setRoll] = useState(1);
  const randoms = useMemo(() => [0, 1, 2, 3].map(k => { try { const b = createBuilder(KIT, standin ?? {}); b.randomize(`new-${roll}-${k}`); return b.doc; } catch { return undefined; } }).filter(Boolean) as AvatarDoc[], [roll]);
  const people = Object.values(w.characters).filter(c => c.kind !== "extra" && c.avatar).sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999));
  const [start, setStart] = useState<string>(standin ? "standin" : "r0");
  const lookOf = (k: string): AvatarDoc | undefined => k === "standin" ? standin as AvatarDoc : k.startsWith("r") ? randoms[Number(k.slice(1))] : w.characters[k.slice(5)]?.avatar as AvatarDoc | undefined;
  const look = lookOf(start);
  const ok = !!name.trim() && !problem;
  const texts = (first: string, langs: string[]) => Object.fromEntries(langs.map((x, k) => [x, k === 0 && first.trim() ? first.trim() : "…"]));
  const create = () => {
    const order = Math.max(0, ...Object.values(w.characters).filter(c => c.kind !== "extra").map(c => Number(c.order ?? 0))) + 1;
    createDoc("character", id, { id, order, name: texts(name, [l.main]), kind: "cast", role: texts(role, l.translations), bio: texts("", l.translations), color: "#7A6A58", level: "A1", ...(look ? { avatar: look } : {}) });
    p.onClose();
    go("character", id);
    if (about.trim() && w.ai) void draftWith(id);
  };
  /** Saved first (the assistant edits what is on disk), then the assistant drafts their page, as a proposal, in a conversation of its own. */
  const draftWith = async (id: string) => {
    if (!await saveDocs([keyOf("character", id)])) return;
    newChat();
    const langs = [l.main, ...l.translations].join(", ");
    await send(`I just added the character ${id} ("${name.trim()}") to the cast. What they are like: ${about.trim()}\n\nDraft their page from that: read_doc character ${id}, then one edit_doc on it with a role (one line) and a bio (two or three sentences) in ${l.translations.join(" and ") || l.main}, their name in ${langs} (the same name, written as each language writes it), a level if it says, and a colour that suits them. Keep the id and the name in ${l.main} as they are. Then give them their own look, from scratch: read_look ${id}, then one set_look with from "blank" that chooses every section to fit them (body: age and build; face: shape, eyes, brows, nose, mouth; hair and its colour; each piece of clothing and its colour; extras), with values read_look lists. Then say in one line what you drafted.`);
  };
  const pick = (k: string, doc: unknown, label: string) => html`<button type="button" class=${`look${start === k ? " on" : ""}`} aria-pressed=${start === k} onClick=${() => setStart(k)} title=${label}>
    <span class="art" dangerouslySetInnerHTML=${{ __html: svg(doc, 88, "bust") }}></span><small>${label}</small></button>`;
  return html`<${Modal} title="A new character" onClose=${p.onClose}>
    <form class="newchar" onSubmit=${(e: Event) => { e.preventDefault(); if (ok) create(); }}>
      <div class="newchar-who">
        <div class="newchar-face" dangerouslySetInnerHTML=${{ __html: look ? svg(look, 132, "bust") : "" }}></div>
        <div class="fields">
          <div class="field"><label for="nc-name">Name <small class="note">(${named(l.main)})</small></label>
            <input id="nc-name" ...${inSeries(l.main)} value=${name} placeholder="Elif" autofocus onInput=${(e: Event) => setName((e.target as HTMLInputElement).value)} />
            <div class="newchar-id">${editId
              ? html`<input value=${id} aria-label="The id" onInput=${(e: Event) => setTyped((e.target as HTMLInputElement).value.trim().toLowerCase())} />`
              : html`<code>${id || "…"}</code><button type="button" class="linkish" onClick=${() => { setTyped(id); setEditId(true); }}>edit</button>`}
              <small class=${problem && (name || typed) ? "bad" : "note"}>${problem && (name || typed) ? problem : id ? "its id, for good" : "type a name, or an id"}</small></div></div>
          ${say && html`<div class="field"><label for="nc-role">Role <small class="note">(${named(say)}, one line)</small></label>
            <input id="nc-role" ...${inSeries(say)} value=${role} placeholder="the baker next door" onInput=${(e: Event) => setRole((e.target as HTMLInputElement).value)} /></div>`}
        </div>
      </div>
      ${w.ai ? html`<div class="field"><label for="nc-about">Describe them <small class="note">(optional: the assistant drafts the role, bio and names from it)</small></label>
        <textarea id="nc-about" rows="2" value=${about} placeholder="An old neighbour who knows everyone's business and feeds the gulls every morning" onInput=${(e: Event) => setAbout((e.target as HTMLTextAreaElement).value)}></textarea></div>` : ""}
      <div class="field"><label>Start from <small class="note">(the look is theirs to change on their page)</small></label>
        <div class="newchar-looks">
          ${standin && pick("standin", standin, "the stand-in")}
          ${randoms.map((d, k) => pick(`r${k}`, d, "random"))}
          <button type="button" class="look reroll" onClick=${() => { setRoll(r => r + 1); if (start.startsWith("r")) setStart("r0"); }} title="Four new random looks"><${Icon} name="redo" size=${22} /><small>new ones</small></button>
        </div></div>
      ${people.length > 0 && html`<details class="newchar-copy" open=${start.startsWith("copy:")}><summary>or copy someone's look</summary>
        <div class="newchar-looks">${people.map(c => pick(`copy:${c.id}`, c.avatar, tx(c.name) || c.id))}</div></details>`}
      <p class="note">${about.trim() && w.ai ? "They are saved at once, so the assistant can draft their page: its draft waits there for you to accept." : l.translations.length ? `The name in ${l.translations.map(named).join(" and ")}, the bio and the rest are on their page; the assistant can fill the translations.` : "The bio and the rest are on their page."}</p>
      <div class="row" style="justify-content:flex-end"><button type="button" onClick=${p.onClose}>Cancel</button><button class="primary" disabled=${!ok}>${about.trim() && w.ai ? "Create and draft" : "Create and open"}</button></div>
    </form>
  </${Modal}>`;
}

/** Why a character cannot be deleted (an extra, the stand-in or narrator, named by an episode), or null. */
function whyKept(id: string): string | null {
  const w = world.value!, c = w.characters[id];
  if (c?.kind === "extra") return "an extra: written by cast/extras.ts";
  if (w.series?.standin === id) return "the series' stand-in";
  if (w.series?.narrator === id) return "the series' narrator";
  const used = w.episodes.filter(e => e.cast?.includes(id)).map(e => e.id);
  return used.length ? `in ${used.length === 1 ? "an episode" : `${used.length} episodes`}: ${used.join(", ")}` : null;
}

/** Delete a character, after a confirmation: what goes, and that the id is not to be reused. */
function DeleteCharacter(p: { id: string; onClose(): void; onDone?(): void }) {
  const w = world.value!, c = (draftOf("character", p.id)?.doc ?? w.characters[p.id]) as CharacterDoc | undefined;
  const onDisk = !!w.characters[p.id], [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); const ok = await deleteCharacter(p.id); setBusy(false); if (ok) { p.onClose(); p.onDone?.(); } };
  return html`<${Modal} title=${`Delete ${tx(c?.name) || p.id}?`} onClose=${p.onClose}>
    <div class="row" style="gap:14px;align-items:flex-start">
      ${c?.avatar && html`<div class="newchar-face" style="width:96px;height:96px" dangerouslySetInnerHTML=${{ __html: svg(c.avatar, 96, "bust") }}></div>`}
      <div class="grow"><p style="margin-top:0">${onDisk ? html`Their file <code>characters/${p.id}.json</code> is deleted: their look, outfits, name, role and bio.` : "They were never saved, so this only drops them."}</p>
        <p class="note">No episode names them. ${onDisk ? `The id ${p.id} is best not reused: a copy of the root may still name it.` : ""}</p></div>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button onClick=${p.onClose}>Cancel</button><button class="danger primary" disabled=${busy} onClick=${() => void go()}><${Icon} name="trash" size=${15} /> Delete</button></div>
  </${Modal}>`;
}

export function CharacterPage(p: { id?: string }) {
  const id = p.id ?? "";
  const [ready, setReady] = useState(!!draftOf("character", id));
  useEffect(() => { if (!draftOf("character", id) && !proposedNew("character", id)) void openDoc("character", id).then(d => setReady(!!d)); }, [id]);
  const d = draftOf("character", id);
  const proposed = proposedNew("character", id);
  if (!d && proposed) return html`<${ProposedDoc} x=${proposed} />`;
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
  const [deleting, setDeleting] = useState(false);

  // the look the builder made last: a look that differs came from outside (an accepted proposal, undo, redo), and the
  // builder, which cannot be handed a new look, is mounted again on it
  const made = useRef<unknown>(c.avatar), [outside, setOutside] = useState(0);
  useEffect(() => { if (c.avatar !== made.current) { made.current = c.avatar; setOutside(n => n + 1); } }, [c.avatar]);
  useEffect(() => {
    if (!host.current || !c.avatar || extra) return;
    ui.current = mountBuilder(host.current, { kit: KIT, doc: c.avatar, mode: "author", lang: "en", preview: "stage", onChange: doc => { made.current = doc; edit(x => set(x, ["avatar"], doc), "avatar"); } });
    return () => { ui.current?.destroy(); ui.current = null; };
  }, [p.id, d.create ? "new" : "old", outside]);

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
      ${!extra && w.writable && html`<button class="danger" onClick=${() => setDeleting(true)} disabled=${!!whyKept(p.id)} title=${whyKept(p.id) ?? "Delete this character, after a confirmation"}><${Icon} name="trash" size=${15} /> Delete</button>`}
      ${!extra && html`<${SaveButton} onSave=${() => void saveDocs([key])} disabled=${!dirty(d)} />`}
    </div>
    ${deleting && html`<${DeleteCharacter} id=${p.id} onClose=${() => setDeleting(false)} onDone=${() => go("cast")} />`}
    <${ProposalsStrip} kind="character" id=${p.id} />
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
          <${Texts} label="Name" value=${c.name} saved=${was.name} onInput=${(l: string, v: string | undefined) => put("name", { ...c.name, [l]: v ?? "" })} />
          <${Texts} label="Role" need="translations" value=${c.role} saved=${was.role} onInput=${(l: string, v: string | undefined) => put("role", { ...c.role, [l]: v ?? "" })} />
          <${Texts} label="Bio" need="translations" multi value=${c.bio} saved=${was.bio} onInput=${(l: string, v: string | undefined) => put("bio", { ...c.bio, [l]: v ?? "" })} />
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
            onChange=${(e: Event) => { const on = (e.target as HTMLInputElement).checked, now = (c.places ?? []) as string[]; const n = on ? [...now, pid] : now.filter(x => x !== pid); put("places", n.length ? n : undefined); }} /> ${inSeries(pl.name) ?? pid}</label>`)}</div>
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
