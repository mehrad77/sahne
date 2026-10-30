// The series' and a season's own settings, in a drawer beside the board: the series' title and summary in its
// languages, its languages (shown: they are set in series.json), its narrator and stand-in; a season's title, summary
// and launch day. A root without series.json starts one here (with a season document for each season its stories use,
// saved together: the check needs both); a new season takes the next number. The weeks' themes and the calendar are
// edited on the board itself (ui/board.ts).

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { allLanguages, textOf, type SeasonDoc, type SeriesDoc, type StoryDoc } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { change, checked, createDoc, draftOf, go, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { Problems, Select } from "./fields.ts";
import { startSeries } from "../model/series.ts";
import { langName, Texts, useLangs } from "./lang.ts";
import { SaveButton } from "./readonly.ts";

const filled = (codes: string[], text: (l: string) => string) => Object.fromEntries(codes.map(l => [l, text(l)]));

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
  return html`<div class="fields">
    <${Texts} label="Title" value=${s.title} saved=${was.title} onInput=${(l: string, v?: string) => put("title", { ...s.title, [l]: v ?? "" })} />
    <${Texts} label="Summary" multi value=${s.summary} saved=${was.summary} onInput=${(l: string, v?: string) => put("summary", { ...s.summary, [l]: v ?? "" })} />
    <div class="field"><label>Languages</label><div class="row">${allLanguages(langs).map((l, i) => html`<span class="chip" title=${l}>${langName(l)}${i === 0 ? " · main" : ""}</span>`)}</div>
      <p class="note">The main language is the one the stage plays; the others are its translations. They are set in series.json.</p></div>
    <div class="row">
      <div class="grow"><${Select} label="Narrator" value=${s.narrator} options=${people} onInput=${(v?: string) => v && put("narrator", v)} /></div>
      <div class="grow"><${Select} label="Stand-in (the learner)" value=${s.standin} options=${people} onInput=${(v?: string) => v && put("standin", v)} /></div>
    </div>
    <div class="row"><span class="grow"></span><${SaveButton} disabled=${!dirty(d)} onSave=${() => void saveDocs([key])} label="Save the series" /></div>
    <${Problems} problems=${checked.value[key] ?? []} empty="" />
  </div>`;
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
  return html`<div class="fields">
    <${Texts} label="Title" value=${se.title} saved=${was.title} onInput=${(l: string, v?: string) => put("title", { ...se.title, [l]: v ?? "" })} />
    <${Texts} label="Summary" multi value=${se.summary} saved=${was.summary} onInput=${(l: string, v?: string) => put("summary", { ...se.summary, [l]: v ?? "" })} />
    <div class="field"><label>Launch day (the board starts its week)</label><input type="date" value=${se.launch ?? ""} onInput=${(e: Event) => put("launch", (e.target as HTMLInputElement).value || undefined)} /></div>
    <div class="row"><span class="grow"></span><${SaveButton} disabled=${!dirty(d)} onSave=${() => void saveDocs([key])} label="Save the season" /></div>
    <${Problems} problems=${checked.value[key] ?? []} empty="" />
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
