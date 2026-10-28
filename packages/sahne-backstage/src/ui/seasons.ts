// The series and its seasons, edited. The series' titles, summary, narrator and stand-in. A season's titles, summary and
// launch; its weeks' arcs (an arc is written in the season and in every story of its week, so editing one edits them all,
// saved together); its release calendar (each episode's date, kind and week, kept in step with the story's own
// releaseDate and kind, saved together); and a new season (`s<n>`, the next free number).

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { SeasonDoc, SeriesDoc, StoryDoc } from "sahne-story";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { change, createDoc, draftOf, go, keyOf, openDoc, saveDocs, world } from "../store.ts";
import { Problems, Select, Text, Tri } from "./fields.ts";
import { checked } from "../store.ts";

const MECHANICS = ["say", "explore", "act", "aloud", "unlocks"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

/** The series' own fields, on the series page. */
export function SeriesEditor() {
  const w = world.value!;
  const [ready, setReady] = useState(false);
  useEffect(() => { if (w.series) void openDoc("series", "series").then(d => setReady(!!d)); }, []);
  if (!w.series) return html`<${NewSeries} />`;
  const d = draftOf("series", "series");
  if (!ready || !d) return html`<p class="note">Opening the series…</p>`;
  const s = d.doc as SeriesDoc, key = keyOf("series", "series");
  const put = (k: string, v: unknown) => change<SeriesDoc>("series", "series", x => set(x, [k], v), k);
  const people = Object.values(w.characters).filter(c => c.kind !== "extra").map(c => [c.id, `${c.name} (${c.kind})`] as [string, string]);
  return html`<div class="panel fields">
    <${Tri} label="Title" keys=${["title", "titleEn", "titleFa"]} doc=${s as unknown as Record<string, unknown>} saved=${d.saved as Record<string, unknown>} onInput=${(k: string, v: string | undefined) => put(k, v ?? "")} />
    <${Text} label="Summary · English" multi value=${s.summary} onInput=${(v: string | undefined) => put("summary", v)} />
    <${Text} label="Summary · Persian" lang="fa" multi value=${s.summaryFa} onInput=${(v: string | undefined) => put("summaryFa", v)} />
    <div class="row">
      <div class="grow"><${Select} label="Narrator" value=${s.narrator} options=${people} onInput=${(v: string | undefined) => v && put("narrator", v)} /></div>
      <div class="grow"><${Select} label="Stand-in (the learner)" value=${s.standin} options=${people} onInput=${(v: string | undefined) => v && put("standin", v)} /></div>
    </div>
    <div class="row"><span class="grow"></span><button class="primary" disabled=${!dirty(d) || !w.writable} onClick=${() => void saveDocs([key])}>Save the series</button></div>
    <${Problems} problems=${checked.value[key] ?? []} empty="" />
  </div>`;
}

/** A content root with no series.json yet: start one. */
function NewSeries() {
  const w = world.value!;
  const [id, setId] = useState("");
  const ok = /^[a-z0-9_]+$/.test(id);
  const start = async () => {
    createDoc("series", "series", { v: 1, id, title: id, titleEn: id, titleFa: id, narrator: "kerim", standin: "nima" });
    if (await saveDocs([keyOf("series", "series")])) go();
  };
  return html`<div class="panel row">
    <input placeholder="the series' id (a-z, 0-9, _)" value=${id} style="max-width:240px" aria-label="The series' id" onInput=${(e: Event) => setId((e.target as HTMLInputElement).value.trim().toLowerCase())} />
    <button class="primary" disabled=${!ok || !w.writable} onClick=${() => void start()}>Start the series</button>
    <span class="note">Its titles, narrator and stand-in can be edited after.</span></div>`;
}

/** A season's editing: its fields, the arcs planner and the calendar. Saves the season and the stories it changed together. */
export function SeasonEditor(p: { id: string }) {
  const w = world.value!;
  const se0 = w.seasons[p.id];
  const eps = w.episodes.filter(e => e.season === se0?.n).map(e => e.id).sort();
  const [ready, setReady] = useState(false);
  useEffect(() => { void Promise.all([openDoc("season", p.id), ...eps.map(id => openDoc("story", id))]).then(() => setReady(true)); }, [p.id]);
  const d = draftOf("season", p.id);
  if (!ready || !d) return html`<p class="note">Opening the season and its episodes…</p>`;
  const se = d.doc as SeasonDoc;
  const keys = [keyOf("season", p.id), ...eps.map(id => keyOf("story", id))];
  const story = (id: string) => draftOf("story", id)?.doc as StoryDoc | undefined;
  const put = (k: string, v: unknown) => change<SeasonDoc>("season", p.id, x => set(x, [k], v), k);
  const anyDirty = keys.some(k => dirty(draftOf(...(k.split(":") as ["season" | "story", string]))));
  const problems = keys.flatMap(k => checked.value[k] ?? []);

  /** An arc edited in the season and in every story of its week. */
  const arc = (aid: string, field: string, v: unknown) => {
    const next = { ...(se.arcs?.[aid] ?? { tr: "", en: "", fa: "", mechanics: [] }), [field]: v } as NonNullable<SeasonDoc["arcs"]>[string];
    change<SeasonDoc>("season", p.id, x => set(x, ["arcs", aid], next), `arc.${aid}.${field}`);
    for (const id of eps) if (story(id)?.arc?.id === aid) change<StoryDoc>("story", id, s => set(s, ["arc"], { id: aid, ...next }), `arc.${aid}.${field}`);
  };
  const addArc = () => {
    const weeks = Object.keys(se.arcs ?? {}).map(k => Number(k.split("w")[1]));
    const aid = `s${se.n}w${pad((weeks.length ? Math.max(...weeks) : 0) + 1)}`;
    put("arcs", { ...(se.arcs ?? {}), [aid]: { tr: "…", en: "…", fa: "…", mechanics: ["say"] } });
  };
  /** A calendar row edited in the season and in its story. */
  const row = (id: string, field: "date" | "kind" | "week", v: unknown) => {
    const cur = se.calendar?.[id] ?? { date: story(id)?.releaseDate ?? "", kind: story(id)?.kind ?? "episode", week: 1 };
    change<SeasonDoc>("season", p.id, x => set(x, ["calendar", id], { ...cur, [field]: v }), `cal.${id}.${field}`);
    if (field === "date") change<StoryDoc>("story", id, s => set(s, ["releaseDate"], v), `cal.${id}.date`);
    if (field === "kind") change<StoryDoc>("story", id, s => set(s, ["kind"], v), `cal.${id}.kind`);
  };
  /** A calendar from what the stories say: their dates and kinds, the week from their arc id. */
  const startCalendar = () => put("calendar", Object.fromEntries(eps.map(id => {
    const s = story(id)!;
    return [id, { date: s.releaseDate ?? "", kind: s.kind ?? "episode", week: Number(/w(\d+)$/.exec(s.arc?.id ?? "")?.[1] ?? 0) }];
  })));

  return html`<div class="fields">
    <div class="panel fields">
      <${Tri} label="Title" keys=${["title", "titleEn", "titleFa"]} doc=${se as unknown as Record<string, unknown>} saved=${d.saved as Record<string, unknown>} onInput=${(k: string, v: string | undefined) => put(k, v ?? "")} />
      <${Text} label="Summary · English" multi value=${se.summary} onInput=${(v: string | undefined) => put("summary", v)} />
      <${Text} label="Summary · Persian" lang="fa" multi value=${se.summaryFa} onInput=${(v: string | undefined) => put("summaryFa", v)} />
      <div class="field"><label>Launch day</label><input type="date" style="max-width:200px" value=${se.launch ?? ""} onInput=${(e: Event) => put("launch", (e.target as HTMLInputElement).value || undefined)} /></div>
    </div>
    <h3>Weeks and their arcs</h3>
    <p class="note">An arc is written in the season and in every story of its week: an edit here changes them all, saved together.</p>
    ${Object.entries(se.arcs ?? {}).map(([aid, a]) => html`<div class="panel fields">
      <div class="row"><b class="grow">${aid}</b><span class="note">${eps.filter(id => story(id)?.arc?.id === aid).join(", ") || "no episode yet"}</span></div>
      <${Tri} label="Arc" doc=${a as unknown as Record<string, unknown>} onInput=${(k: string, v: string | undefined) => arc(aid, k, v ?? "")} />
      <div class="row">${MECHANICS.map(m => html`<label class="row"><input type="checkbox" style="width:auto" checked=${a.mechanics.includes(m)} onChange=${(e: Event) => arc(aid, "mechanics", (e.target as HTMLInputElement).checked ? [...a.mechanics, m] : a.mechanics.filter(x => x !== m))} /> ${m}</label>`)}</div>
    </div>`)}
    <div class="row"><button onClick=${addArc}>+ a week</button></div>
    <h3>Calendar</h3>
    ${!se.calendar ? html`<p class="note">This season has no calendar: the dates live in the stories${w.days ? " and days.json" : ""}. <button class="small" onClick=${startCalendar}>Start one from the episodes</button></p>`
    : html`<table class="grid"><thead><tr><th>Episode</th><th>Date</th><th>Kind</th><th>Week</th></tr></thead><tbody>
      ${Object.keys({ ...se.calendar, ...Object.fromEntries(eps.map(id => [id, 1])) }).sort().map(id => {
        const r = se.calendar![id];
        return html`<tr><td>${eps.includes(id) ? html`<a href=${`#/episode/${id}`}>${id}</a>` : html`${id} <small class="note">not written yet</small>`}</td>
          <td><input type="date" value=${r?.date ?? ""} onInput=${(e: Event) => row(id, "date", (e.target as HTMLInputElement).value)} /></td>
          <td><select value=${r?.kind ?? ""} onChange=${(e: Event) => row(id, "kind", (e.target as HTMLSelectElement).value)}><option value="episode">episode (Mon–Fri)</option><option value="special">special (Sat)</option></select></td>
          <td><input type="number" min="0" style="width:70px" value=${r?.week ?? ""} onInput=${(e: Event) => row(id, "week", Number((e.target as HTMLInputElement).value))} /></td></tr>`;
      })}</tbody></table>`}
    <div class="row toolbar" style="bottom:0;top:auto;position:sticky;border-top:1px solid var(--line);border-bottom:0">
      <span class="grow note">${keys.filter(k => dirty(draftOf(...(k.split(":") as ["season" | "story", string])))).map(k => k.replace(":", " ")).join(", ") || "No changes."}</span>
      <button class="primary" disabled=${!anyDirty || !w.writable} onClick=${() => void saveDocs(keys)}>Save the season</button>
    </div>
    <${Problems} problems=${problems} empty="" />
  </div>`;
}

/** A new season: the next free number. */
export function NewSeason() {
  const w = world.value!;
  const n = Math.max(0, ...Object.values(w.seasons).map(s => s.n)) + 1;
  const make = async () => {
    const id = `s${n}`;
    createDoc("season", id, { v: 1, id, n, title: `${n}. sezon`, titleEn: `Season ${n}`, titleFa: `فصل ${n}`, arcs: { [`s${n}w01`]: { tr: "…", en: "…", fa: "…", mechanics: ["say"] } }, calendar: {} });
    if (await saveDocs([keyOf("season", id)])) go("season", id);
  };
  return html`<button disabled=${!w.series || !w.writable} onClick=${() => void make()}>+ Season ${n}</button>`;
}
