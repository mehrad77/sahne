// The series' and a season's own settings, in a dialog: the series' title and summary in its languages, its languages
// (the translations added or removed here; the one it is written in is set in series.json), how its episodes play with
// (when they are interactive) the stand-in the viewer speaks as, and its narrator; a season's title, summary and launch
// day. A foot kept in view says whether there is anything to save, with Discard and Save. A root without series.json
// starts one here (with a season document for each season its stories use, saved together: the check needs both); a new
// season takes the next number. The weeks' themes and the calendar are edited on the board itself (ui/board.ts).

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { allLanguages, languagesOf, LANGS, textOf, type SeasonDoc, type SeriesDoc, type StoryDoc } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { change, checked, createDoc, draftOf, go, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { Problems, Select } from "./fields.ts";
import { startSeries } from "../model/series.ts";
import { langName, Texts, useLangs } from "./lang.ts";
import { SaveButton } from "./readonly.ts";
import { editorPluginsOf } from "./plugins/index.ts";

const filled = (codes: string[], text: (l: string) => string) => Object.fromEntries(codes.map(l => [l, text(l)]));

/** The foot of a settings dialog, kept in view while the fields scroll: whether there is anything to save, Discard and
 * Save (or, read-only, why nothing is saved). */
function SettingsFoot(p: { dirty: boolean; onSave(): void; onDiscard(): void; label: string }) {
  const writable = !!world.value?.writable;
  return html`<div class="settings-foot">
    <span class=${`grow note${p.dirty ? " unsaved" : ""}`}>${!writable ? "Changes stay in this tab." : p.dirty ? "Unsaved changes" : "Nothing to save"}</span>
    ${p.dirty && html`<button onClick=${p.onDiscard}>Discard</button>`}
    <${SaveButton} disabled=${!p.dirty} onSave=${p.onSave} label=${p.label} /></div>`;
}

/** One part of a settings dialog, under a heading. */
const Part = (p: { title: string; children?: unknown }) => html`<section class="settings-part"><h3>${p.title}</h3>${p.children}</section>`;

/** The series' own fields. */
export function SeriesSettings() {
  const w = world.value!;
  const [ready, setReady] = useState(false);
  useEffect(() => { if (w.series) void openDoc("series", "series").then(d => setReady(!!d)); }, []);
  const langs = useLangs();
  if (!w.series) return html`<${NewSeries} />`;
  const d = draftOf("series", "series");
  if (!ready || !d) return html`<p class="note">Opening the series…</p>`;
  const s = d.doc as SeriesDoc, was = d.saved as SeriesDoc, key = keyOf("series", "series");
  const put = (k: string, v: unknown) => change<SeriesDoc>("series", "series", x => set(x, [k], v), k);
  const people = Object.values(w.characters).filter(c => c.kind !== "extra").map(c => [c.id, `${textOf(c.name, langs.main) ?? c.id} (${c.kind})`] as [string, string]);
  const play = s.play ?? "interactive";
  // the stand-in is core (the viewer speaks as them in an interactive episode); a plugin may name them ("the learner")
  const standinName = editorPluginsOf(s).map(ep => ep.standin).find(Boolean);
  const ways: [string, string, string][] = [
    ["interactive", "Interactive", "The viewer says the stand-in's lines, chooses and acts. The story waits for them."],
    ["watch", "Watch only", "It plays on time alone: no choices, nothing to do, no cards."],
  ];
  return html`<div class="fields settings">
    <${Part} title="Name">
      <${Texts} label="Title" value=${s.title} saved=${was.title} onInput=${(l: string, v?: string) => put("title", { ...s.title, [l]: v ?? "" })} />
      <${Texts} label="Summary" multi value=${s.summary} saved=${was.summary} onInput=${(l: string, v?: string) => put("summary", { ...s.summary, [l]: v ?? "" })} />
    </${Part}>
    <${Part} title="Languages"><${SeriesLanguages} s=${s} put=${put} /></${Part}>
    <${Part} title="How its episodes play">
      <div class="way-cards" role="radiogroup" aria-label="How its episodes play">${ways.map(([v, name, about]) => html`
        <button role="radio" aria-checked=${play === v} class=${`way-card${play === v ? " on" : ""}`} onClick=${() => put("play", v === "interactive" ? undefined : v)}>
          <b>${name}</b><span>${about}</span></button>`)}</div>
      <p class="note">An episode can play the other way: its Brief says so.</p>
      ${play === "interactive" && html`<div class="pair">
        <${Select} label=${`Who the viewer speaks as${standinName ? ` (${standinName})` : ""}`} value=${s.standin} options=${people} onInput=${(v?: string) => v && put("standin", v)} /></div>`}
    </${Part}>
    <${Part} title="Narrator">
      <div class="pair"><${Select} label="Who tells the story" value=${s.narrator} options=${people} onInput=${(v?: string) => v && put("narrator", v)} /></div>
    </${Part}>
    <${Problems} problems=${checked.value[key] ?? []} empty="" />
    <${SettingsFoot} dirty=${dirty(d)} onSave=${() => void saveDocs([key])} onDiscard=${() => void openDoc("series", "series", true)} label="Save the series" />
  </div>`;
}

/** The series' languages: the one it is written in (the stage plays it), and its translations, which every episode,
 * character and place is translated into. A translation is added from the languages Sahne has a story language for
 * (sahne-story `LANGS`); a removed one keeps its texts in the files, but nothing asks for them any more. */
function SeriesLanguages(p: { s: SeriesDoc; put(k: string, v: unknown): void }) {
  const langs = languagesOf(p.s);
  const free = Object.keys(LANGS).filter(l => l !== langs.main && !langs.translations.includes(l));
  const setTr = (translations: string[]) => p.put("languages", { main: langs.main, translations });
  return html`<ul class="lang-list" aria-label="The series' languages">
      <li><span class="code">${langs.main}</span><span class="name">${langName(langs.main)}</span><span class="role main">Written in · the stage plays it</span></li>
      ${langs.translations.map(l => html`<li><span class="code">${l}</span><span class="name">${langName(l)}</span><span class="role">Translation</span>
        <button class="small quiet" aria-label=${`Stop translating into ${langName(l)}`} onClick=${() => setTr(langs.translations.filter(x => x !== l))}>Remove</button></li>`)}
      <li class="add">${free.length > 0
        ? html`<select value="" aria-label="Add a language to translate into" onChange=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) setTr([...langs.translations, v]); (e.target as HTMLSelectElement).value = ""; }}>
            <option value="">+ Add a language…</option>${free.map(l => html`<option value=${l}>${langName(l)}</option>`)}</select>`
        : html`<span class="note">Every language Sahne has a story language for is here.</span>`}</li>
    </ul>
    <p class="note">Every episode, character and place is translated into these; a new one starts empty, and Translate shows how far along it is. Removing one keeps its texts in the files. The language it is written in is set in <code>series.json</code>.</p>`;
}

/** A content root with no series.json yet: start one. */
function NewSeries() {
  const w = world.value!;
  const [id, setId] = useState("");
  const ok = /^[a-z0-9_]+$/.test(id);
  const [busy, setBusy] = useState(false);
  /** The series and a season document for every season the stories use, saved together (the check needs both). */
  const start = async () => {
    setBusy(true);
    const stories = (await Promise.all(w.episodes.map(e => openDoc("story", e.id)))).filter(Boolean).map(d => d!.doc as StoryDoc);
    const { series, seasons } = startSeries(id, stories, { narrator: "kerim", standin: "nima" });
    createDoc("series", "series", series);
    for (const se of seasons) if (!w.seasons[se.id]) createDoc("season", se.id, se);
    const ok = await saveDocs([keyOf("series", "series"), ...seasons.map(se => keyOf("season", se.id))]);
    setBusy(false);
    if (ok) go("board");
  };
  return html`<div class="fields">
    <p>This content root has no <code>series.json</code> yet.</p>
    <input placeholder="the series' id (a-z, 0-9, _)" value=${id} aria-label="The series' id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim().toLowerCase())} />
    <button class="primary" disabled=${!ok || !w.writable || busy} onClick=${() => void start()}>${busy ? "Starting…" : "Start the series"}</button>
    <span class="note">It also writes a season document for each season the episodes use, with their arcs. The titles, narrator and stand-in can be edited after.</span></div>`;
}

/** A season's own fields: titles, summary, launch day. */
export function SeasonSettings(p: { id: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { void openDoc("season", p.id).then(d => setReady(!!d)); }, [p.id]);
  const d = draftOf("season", p.id);
  if (!ready || !d) return html`<p class="note">Opening the season…</p>`;
  const se = d.doc as SeasonDoc, was = d.saved as SeasonDoc, key = keyOf("season", p.id);
  const put = (k: string, v: unknown) => change<SeasonDoc>("season", p.id, x => set(x, [k], v), k);
  return html`<div class="fields settings">
    <${Texts} label="Title" value=${se.title} saved=${was.title} onInput=${(l: string, v?: string) => put("title", { ...se.title, [l]: v ?? "" })} />
    <${Texts} label="Summary" multi value=${se.summary} saved=${was.summary} onInput=${(l: string, v?: string) => put("summary", { ...se.summary, [l]: v ?? "" })} />
    <div class="field"><label>Launch day (the board starts its week)</label><input type="date" value=${se.launch ?? ""} onInput=${(e: Event) => put("launch", (e.target as HTMLInputElement).value || undefined)} /></div>
    <${Problems} problems=${checked.value[key] ?? []} empty="" />
    <${SettingsFoot} dirty=${dirty(d)} onSave=${() => void saveDocs([key])} onDiscard=${() => void openDoc("season", p.id, true)} label="Save the season" />
  </div>`;
}

/** A new season: the next free number, with a first week to plan. */
export function NewSeason() {
  const w = world.value!, langs = useLangs();
  const n = Math.max(0, ...Object.values(w.seasons).map(s => s.n)) + 1;
  const all = allLanguages(langs);
  const make = async () => {
    const id = `s${n}`;
    createDoc("season", id, { v: 1, id, n, title: filled(all, () => `Season ${n}`), arcs: { [`s${n}w01`]: { ...filled(all, () => "…"), mechanics: ["say"] } }, calendar: {} });
    if (await saveDocs([keyOf("season", id)])) go("season", id);
  };
  return html`<button disabled=${!w.series || !w.writable} onClick=${() => void make()} title=${w.writable ? "" : "Read-only: backstage was started without --write"}>+ Season ${n}</button>`;
}
