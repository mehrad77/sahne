// A new episode (#/new/<season>[/<date>]) in three picks: where (a place, from its picture, and the time of day), who
// (the cast, from their portraits; the stand-in is always in), and what it teaches (the target words, read live from
// the cards, whose text is never stored; and its lessons); then a title and a line of premise. Everything else comes
// from the day it is on: its id (the season's next free one), kind (a Saturday is a special), week and theme. Or it
// starts from another episode: that one's place, cast, structure and staging, every text cleared (model/skeleton.ts).
// It opens in the script as a draft; it is saved, with its row in the season's calendar, once the check finds no error.

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { allLanguages, textOf, type SeasonDoc, type StoryDoc, type StoryPlace } from "sahne-story";
import { api } from "../api.ts";
import { set } from "../model/path.ts";
import { addDays, arcOfWeek, boardOf, datesOf, isSunday, rowOn, weekOfArc } from "../model/board.ts";
import { duplicate, skeleton } from "../model/skeleton.ts";
import { change, createDoc, draftOf, go, openDoc, world } from "../store.ts";
import { placeThumb } from "../thumbs.ts";
import { Gallery, type Item } from "./kit/gallery.ts";
import { Empty, Icon } from "./kit/index.ts";
import { characterItems, placeItems } from "./galleries.ts";
import { inLang, langName, Texts, useLangs } from "./lang.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const long = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function NewEpisode(p: { season?: string; date?: string }) {
  const w = world.value!, langs = useLangs(), all = allLanguages(langs);
  const se = p.season ? (draftOf("season", p.season)?.doc as SeasonDoc | undefined) ?? w.seasons[p.season] : undefined;
  if (!se) return html`<${Empty} icon="board" title=${`No season ${p.season ?? ""}`}><a href="#/">Back to the board</a></${Empty}>`;
  const eps = w.episodes.filter(e => e.season === se.n);
  const taken = new Set(w.episodes.map(e => e.id));
  const id = useMemo(() => { let k = 1; while (taken.has(`s${se.n}e${pad(k)}`)) k++; return `s${se.n}e${pad(k)}`; }, [se.n]);
  const [, opened] = useState(0);
  useEffect(() => { void Promise.all(eps.map(e => openDoc("story", e.id))).then(() => opened(n => n + 1)); }, [se.id]);
  const dates = datesOf(se, eps);
  // an episode's week where the calendar has no row: its arc's
  const arcWeeks = Object.fromEntries(eps.flatMap(e => { const wk = weekOfArc((draftOf("story", e.id)?.doc as StoryDoc | undefined)?.arc?.id); return wk === undefined ? [] : [[e.id, wk]]; }));
  // the day: the route's, else the first free weekday after the season's last episode
  const firstFree = () => { const used = new Set(Object.values(dates)); let d = addDays(Object.values(dates).sort().pop() ?? se.launch ?? new Date().toISOString().slice(0, 10), 1); while (used.has(d) || isSunday(d)) d = addDays(d, 1); return d; };
  const [date, setDate] = useState(p.date ?? firstFree());
  const row = rowOn(boardOf(se, { ...dates, [id]: date }, 1, arcWeeks), date);
  const [mode, setMode] = useState<"new" | "copy">("new");
  const [from, setFrom] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null), [time, setTime] = useState<string | null>(null);
  const [cast, setCast] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]), [lessons, setLessons] = useState<string[]>([]);
  const [title, setTitle] = useState<Record<string, string>>({}), [premise, setPremise] = useState<Record<string, string>>({});
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";

  // starting from an episode: its place and cast
  useEffect(() => { if (from) void openDoc("story", from).then(d => { const s = d?.doc as StoryDoc | undefined; if (s) { setPlace(s.place); setCast(s.cast.filter(c => c !== standin)); setLessons(s.lessons ?? []); } }); }, [from]);

  const week = row?.week ?? null;
  const arcId = week === null ? null : arcOfWeek(se.n, week);
  const arc = arcId ? se.arcs?.[arcId] : undefined;
  const kind = row?.kind ?? "episode";
  const nWords = kind === "special" ? [10, 12] : [5, 8];
  const on = Object.entries(dates).find(([, d]) => d === date)?.[0];
  const missing = [
    taken.has(id) && `${id} exists already`,
    !row && "a day that is not in a break week",
    on && `${on} is on that day already`,
    isSunday(date) && "a day other than a Sunday",
    mode === "copy" && !from && "the episode to start from",
    !place && "a place",
    !cast.length && "at least one of the cast",
    !title[langs.main] && `a title in ${langName(langs.main)}`,
  ].filter(Boolean) as string[];

  const create = async () => {
    if (!row || !arcId || !place) return;
    // a story still names its level (Kumru's): the one the season's other episodes name most
    const levels = eps.map(e => (draftOf("story", e.id)?.doc as StoryDoc | undefined)?.level).filter(Boolean) as string[];
    const level = levels.sort((a, b) => levels.filter(x => x === b).length - levels.filter(x => x === a).length)[0];
    const a = arc ?? { ...Object.fromEntries(all.map(l => [l, "…"])), mechanics: ["say"] } as unknown as NonNullable<SeasonDoc["arcs"]>[string];
    const brief = { id, season: se.n, releaseDate: date, kind, week: row.week, arc: { ...a, id: arcId }, place, cast: [standin, ...cast], words, lessons, title, summary: premise, level };
    const src = from ? draftOf("story", from)?.doc as StoryDoc | undefined : undefined;
    const doc = mode === "copy" && src ? duplicate(src, brief, langs) : skeleton(brief, { narrator, standin, places: w.places, languages: langs });
    if (time) { const scene = doc.steps.find(s => "scene" in s) as { time?: string } | undefined; if (scene) scene.time = time; }
    createDoc("story", id, doc);
    // its row in the season's calendar and, for a new week, the week's theme: saved with it
    await openDoc("season", se.id);
    if (se.calendar) change<SeasonDoc>("season", se.id, s => set(s, ["calendar", id], row));
    if (!arc) change<SeasonDoc>("season", se.id, s => set(s, ["arcs", arcId], a));
    go("episode", id);
  };

  const pl = place ? w.places[place] as StoryPlace : undefined;
  const items = characterItems({ main: langs.main }).filter(i => i.id !== narrator && i.id !== standin);
  return html`<section class="new-episode">
    <div class="pagehead"><div class="grow">
      <h2>A new ${kind === "special" ? "special" : "episode"} · ${id}</h2>
      <span class="note">Season ${se.n} · <input type="date" class="inline-date" value=${date} aria-label="Release day" onInput=${(e: Event) => setDate((e.target as HTMLInputElement).value)} /> ${long(date)}${week !== null ? ` · week ${week}` : " · a break week"}
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
      <p class="note">${textOf(w.characters[standin]?.name, langs.main) ?? standin}, the learner, is always in it, and ${textOf(w.characters[narrator]?.name, langs.main) ?? narrator} narrates. Pick one to five more.</p>
      <${Gallery} items=${items} value=${cast} multi onPick=${(x: string) => setCast(c => (c.includes(x) ? c.filter(y => y !== x) : [...c, x].slice(0, 5)))} label="Cast" size="s" /></div>

    <div class="step-card"><h3><span class="step-n">3</span> What it teaches</h3>
      <${Words} value=${words} onChange=${setWords} want=${nWords} special=${kind === "special"} />
      <${Lessons} value=${lessons} onChange=${setLessons} /></div>

    <div class="step-card"><h3><span class="step-n">4</span> Its name</h3>
      <${Texts} label="Title" value=${title} onInput=${(l: string, v?: string) => setTitle(t => ({ ...t, [l]: v ?? "" }))} />
      <${Texts} label="Premise (what happens, in a line: the narrator opens with it)" need="translations" multi value=${premise} onInput=${(l: string, v?: string) => setPremise(t => ({ ...t, [l]: v ?? "" }))} /></div>

    <div class="savebar">
      <span class="grow">${missing.length ? html`Still needed: ${missing.join(" · ")}` : words.length < nWords[0] ? `Ready. The check will want ${nWords[0]}–${nWords[1]} target words before it saves.` : "Ready: it opens in the script as a draft."}</span>
      <button class="primary" disabled=${missing.length > 0 || !!draftOf("story", id)} onClick=${() => void create()}><${Icon} name="film" size=${16} /> Create and open the script</button></div>
  </section>`;
}

/** The target words: cards searched live (their text shown, never stored); on a root without cards, ids typed in. */
function Words(p: { value: string[]; onChange(v: string[]): void; want: number[]; special: boolean }) {
  const w = world.value!;
  const [q, setQ] = useState(""), [cards, setCards] = useState<{ id: string; tr: string; en: string }[]>([]);
  const [known, setKnown] = useState<Record<string, { tr: string; en: string }>>({});
  useEffect(() => { if (!w.cards) return; const t = setTimeout(() => void api.get<{ cards: { id: string; tr: string; en: string }[] }>(`cards?q=${encodeURIComponent(q)}`).then(r => setCards(r.cards ?? [])), 250); return () => clearTimeout(t); }, [q]);
  const add = (c: { id: string; tr: string; en: string }) => { setKnown(k => ({ ...k, [c.id]: c })); p.onChange([...p.value, c.id]); };
  return html`<div class="fields">
    <div class="row"><b>Target words</b><span class="note">${p.value.length} of ${p.want[0]}–${p.want[1]} for ${p.special ? "a special" : "an episode"}</span></div>
    <div class="row">${p.value.map(id => html`<span class="chip">${known[id]?.tr ?? id} <button class="small" style="border:0;padding:0 2px" aria-label=${`Remove ${id}`} onClick=${() => p.onChange(p.value.filter(x => x !== id))}>×</button></span>`)}</div>
    ${w.cards ? html`<input type="search" placeholder="search the cards (any language)" value=${q} aria-label="Search the cards" onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} />
      <div class="word-list">${cards.filter(c => !p.value.includes(c.id)).map(c => html`<button class="word" onClick=${() => add(c)}><b>${c.tr}</b><small>${c.en}</small></button>`)}</div>`
    : html`<input placeholder="this root has no cards: type card ids, comma between" value=${p.value.join(", ")} aria-label="Card ids" onInput=${(e: Event) => p.onChange([...new Set((e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean))])} />`}
  </div>`;
}

/** One to three lessons: the root's grammar, or ids typed in. */
function Lessons(p: { value: string[]; onChange(v: string[]): void }) {
  const [lessons, setLessons] = useState<{ id: string; ref?: string }[]>([]);
  useEffect(() => { void api.get<{ lessons: { id: string; ref?: string }[] }>("lessons").then(r => setLessons(r.lessons ?? [])); }, []);
  const toggle = (id: string) => p.onChange(p.value.includes(id) ? p.value.filter(x => x !== id) : [...p.value, id].slice(0, 3));
  return html`<div class="fields" style="margin-top:10px">
    <div class="row"><b>Lessons</b><span class="note">1 to 3</span></div>
    ${lessons.length ? html`<div class="row">${lessons.map(l => html`<button class=${`chip${p.value.includes(l.id) ? " on" : ""}`} aria-pressed=${p.value.includes(l.id)} onClick=${() => toggle(l.id)}>${l.id}${l.ref ? ` · ${l.ref}` : ""}</button>`)}</div>`
    : html`<input placeholder="lesson ids (g_a1_<n>_<slug>), comma between" value=${p.value.join(", ")} aria-label="Lesson ids" onInput=${(e: Event) => p.onChange((e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3))} />`}
  </div>`;
}
