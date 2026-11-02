// A new episode (#/new/<season>[/<date>]) in two picks: where (a place, from its picture, and the time of day) and who
// (the cast, from their portraits; the stand-in is always in); then the series' plugins' steps (ui/plugins: what the
// lesson plugin's episode teaches), a title and a line of premise. Everything else comes
// from the day it is on: its id (the season's next free one), kind (a Saturday is a special), week and theme. Or it
// starts from another episode: that one's place, cast, structure and staging, every text cleared (model/skeleton.ts).
// It opens in the script as a draft; it is saved, with its row in the season's calendar, once the check finds no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { allLanguages, playOf, textOf, type SeasonDoc, type StoryDoc, type StoryPlace } from "sahne-story";
import { set } from "../model/path.ts";
import { addDays, arcOfWeek, boardOf, datesOf, isDay, isSunday, rowOn, weekOfArc } from "../model/board.ts";
import { duplicate, skeleton } from "../model/skeleton.ts";
import { change, createDoc, draftOf, go, openDoc, world } from "../store.ts";
import { placeThumb } from "../thumbs.ts";
import { Gallery, type Item } from "./kit/gallery.ts";
import { Empty, Icon } from "./kit/index.ts";
import { characterItems, placeItems } from "./galleries.ts";
import { inLang, langName, Texts, useLangs } from "./lang.ts";
import { lessonOf } from "sahne-lesson";
import { storyPluginsOf } from "../model/plugins.ts";
import { editorPluginsOf, viewerOf } from "./plugins/index.ts";
import { proposals } from "../events.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const long = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function NewEpisode(p: { season?: string; date?: string }) {
  const w = world.value!, langs = useLangs(), all = allLanguages(langs);
  const se = p.season ? (draftOf("season", p.season)?.doc as SeasonDoc | undefined) ?? w.seasons[p.season] : undefined;
  if (!se) return html`<${Empty} icon="board" title=${`No season ${p.season ?? ""}`}><a href="#/board">Back to the board</a></${Empty}>`;
  const eps = w.episodes.filter(e => e.season === se.n);
  const taken = new Set(w.episodes.map(e => e.id));
  // the season's next id no episode has: on disk, new and not saved yet, or proposed by an agent
  const id = useMemo(() => {
    const used = (x: string) => taken.has(x) || !!draftOf("story", x) || proposals.value.some(q => q.kind === "story" && q.create && q.doc === x);
    let k = 1; while (used(`s${se.n}e${pad(k)}`)) k++; return `s${se.n}e${pad(k)}`;
  }, [se.n]);
  const [, opened] = useState(0);
  useEffect(() => { void Promise.all(eps.map(e => openDoc("story", e.id))).then(() => opened(n => n + 1)); }, [se.id]);
  const dates = datesOf(se, eps);
  // an episode's week where the calendar has no row: its arc's
  const arcWeeks = Object.fromEntries(eps.flatMap(e => { const wk = weekOfArc((draftOf("story", e.id)?.doc as StoryDoc | undefined)?.arc?.id); return wk === undefined ? [] : [[e.id, wk]]; }));
  // the day: the route's, else the first free weekday after the season's last episode
  const firstFree = () => { const used = new Set(Object.values(dates)); let d = addDays(Object.values(dates).sort().pop() ?? se.launch ?? new Date().toISOString().slice(0, 10), 1); while (used.has(d) || isSunday(d)) d = addDays(d, 1); return d; };
  const [date, setDate] = useState(p.date ?? firstFree());
  // a date field being cleared or typed into holds no day yet: nothing is placed until it does
  const day = isDay(date) ? date : null;
  const row = day ? rowOn(boardOf(se, { ...dates, [id]: day }, 1, arcWeeks), day) : null;
  const [mode, setMode] = useState<"new" | "copy">("new");
  const [from, setFrom] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null), [time, setTime] = useState<string | null>(null);
  const [cast, setCast] = useState<string[]>([]);
  // each plugin's part of the brief, by plugin id
  const [extra, setExtra] = useState<Record<string, Record<string, unknown>>>({});
  const plugins = editorPluginsOf(w.series), lesson = storyPluginsOf(w.series).some(pl => pl.id === "lesson");
  const [title, setTitle] = useState<Record<string, string>>({}), [premise, setPremise] = useState<Record<string, string>>({});
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";

  // starting from an episode: its place and cast
  useEffect(() => { if (from) void openDoc("story", from).then(d => { const s = d?.doc as StoryDoc | undefined; if (s) { setPlace(s.place); setCast(s.cast.filter(c => c !== standin)); } }); }, [from]);

  const week = row?.week ?? null;
  const arcId = week === null ? null : arcOfWeek(se.n, week);
  const arc = arcId ? se.arcs?.[arcId] : undefined;
  const kind = row?.kind ?? "episode";
  const wants = plugins.map(ep => ep.newEpisode?.wants?.(extra[ep.id] ?? {}, kind) ?? null).filter(Boolean) as string[];
  const on = Object.entries(dates).find(([, d]) => d === date)?.[0];
  const missing = [
    taken.has(id) && `${id} exists already`,
    !day && "a release day",
    day && !row && "a day that is not in a break week",
    on && `${on} is on that day already`,
    day && isSunday(day) && "a day other than a Sunday",
    mode === "copy" && !from && "the episode to start from",
    !place && "a place",
    !cast.length && "at least one of the cast",
    !title[langs.main] && `a title in ${langName(langs.main)}`,
  ].filter(Boolean) as string[];

  const create = async () => {
    if (!row || !arcId || !place) return;
    // a story still names its level (Kumru's): the one the season's other episodes name most
    const levels = eps.map(e => lessonOf((draftOf("story", e.id)?.doc ?? {}) as StoryDoc).level).filter(Boolean) as string[];
    const level = levels.sort((a, b) => levels.filter(x => x === b).length - levels.filter(x => x === a).length)[0];
    const a = arc ?? { ...Object.fromEntries(all.map(l => [l, "…"])), mechanics: ["say"] } as unknown as NonNullable<SeasonDoc["arcs"]>[string];
    const brief = { id, season: se.n, releaseDate: date, kind, week: row.week, arc: { ...a, id: arcId }, place, cast: [standin, ...cast], ...Object.assign({}, ...Object.values(extra)), title, summary: premise, ...(lesson ? { level } : {}) };
    const src = from ? draftOf("story", from)?.doc as StoryDoc | undefined : undefined;
    const doc = mode === "copy" && src ? duplicate(src, brief, langs) : skeleton(brief, { narrator, standin, places: w.places, languages: langs, lesson, play: playOf(null, w.series) });
    if (time) { const scene = doc.steps.find(s => "scene" in s) as { time?: string } | undefined; if (scene) scene.time = time; }
    createDoc("story", id, doc);
    // its row in the season's calendar and, for a new week, the week's theme: saved with it
    await openDoc("season", se.id);
    if (se.calendar) change<SeasonDoc>("season", se.id, s => set(s, ["calendar", id], row));
    if (!arc) change<SeasonDoc>("season", se.id, s => set(s, ["arcs", arcId], a));
    go("episode", id, "brief");
  };

  const pl = place ? w.places[place] as StoryPlace : undefined;
  const items = characterItems({ main: langs.main }).filter(i => i.id !== narrator && i.id !== standin);
  return html`<section class="new-episode">
    <div class="pagehead"><div class="grow">
      <h2>A new ${kind === "special" ? "special" : "episode"} · ${id}</h2>
      <span class="note">Season ${se.n} · <input type="date" class="inline-date" value=${date} aria-label="Release day" onInput=${(e: Event) => setDate((e.target as HTMLInputElement).value)} /> ${day ? `${long(day)}${week !== null ? ` · week ${week}` : " · a break week"}` : ""}
        ${arc && html` · theme: <span ...${inLang(langs.main)}>${textOf(arc, langs.main)}</span>`}</span></div>
      <div class="segmented" role="group" aria-label="Start">
        <button aria-pressed=${mode === "new"} onClick=${() => { setMode("new"); setFrom(null); }}>From scratch</button>
        <button aria-pressed=${mode === "copy"} onClick=${() => setMode("copy")}>From an episode</button></div>
    </div>

    ${mode === "copy" && html`<div class="step-card"><h3><span class="step-n">0</span> Start from</h3>
      <p class="note">Its place, cast, structure and staging, with every text cleared to write again.</p>
      <${Gallery} items=${w.episodes.map((e): Item => ({ id: e.id, label: textOf(e.title, langs.main) ?? e.id, sub: e.id, keywords: textOf(e.title, "en"), art: w.places[e.place] ? () => placeThumb(w.places[e.place]) : null }))} value=${from ? [from] : []} onPick=${setFrom} label="Episodes" size="m" /></div>`}

    <div class="step-card"><h3><span class="step-n">1</span> Where</h3>
      <${Gallery} items=${placeItems()} value=${place ? [place] : []} onPick=${(x: string) => { setPlace(x); setTime(null); }} label="Places" size="m" />
      ${pl?.times && pl.times.length > 1 && html`<div class="row" style="margin-top:8px"><span class="note">Time of day:</span>${pl.times.map(t => html`<button class=${`chip${(time ?? pl.times![0]) === t ? " on" : ""}`} aria-pressed=${(time ?? pl.times![0]) === t} onClick=${() => setTime(t)}>${t}</button>`)}</div>`}</div>

    <div class="step-card"><h3><span class="step-n">2</span> Who</h3>
      <p class="note">${textOf(w.characters[standin]?.name, langs.main) ?? standin}, who ${viewerOf(w.series)} speaks as, is always in it, and ${textOf(w.characters[narrator]?.name, langs.main) ?? narrator} narrates. Pick one to five more.</p>
      <${Gallery} items=${items} value=${cast} multi onPick=${(x: string) => setCast(c => (c.includes(x) ? c.filter(y => y !== x) : [...c, x].slice(0, 5)))} label="Cast" size="s" /></div>

    ${plugins.filter(ep => ep.newEpisode).map((ep, k) => html`<div class="step-card"><h3><span class="step-n">${3 + k}</span> ${ep.newEpisode!.title}</h3>
      <${ep.newEpisode!.View} value=${extra[ep.id] ?? {}} onChange=${(v: Record<string, unknown>) => setExtra(x => ({ ...x, [ep.id]: v }))} kind=${kind} /></div>`)}

    <div class="step-card"><h3><span class="step-n">${3 + plugins.filter(ep => ep.newEpisode).length}</span> Its name</h3>
      <${Texts} label="Title" value=${title} onInput=${(l: string, v?: string) => setTitle(t => ({ ...t, [l]: v ?? "" }))} />
      <${Texts} label="Premise (what happens, in a line: the narrator opens with it)" need="translations" multi value=${premise} onInput=${(l: string, v?: string) => setPremise(t => ({ ...t, [l]: v ?? "" }))} /></div>

    <div class="savebar">
      <span class="grow">${missing.length ? html`Still needed: ${missing.join(" · ")}` : wants.length ? `Ready. The check will want ${wants.join(" and ")} before it saves.` : "Ready: it opens in the script as a draft."}</span>
      <button class="primary" disabled=${missing.length > 0 || !!draftOf("story", id)} onClick=${() => void create()}><${Icon} name="film" size=${16} /> Create and open the script</button></div>
  </section>`;
}
