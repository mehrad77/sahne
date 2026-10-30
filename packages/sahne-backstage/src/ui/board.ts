// The season board (#/board and #/season/<id>): a season's weeks as rows and Monday to Saturday as
// columns (model/board.ts), each episode a card on its release day: the picture of its place, its title, a special or not,
// a draft, its review status and its problems. Each week's row starts with its theme (its arc, edited in place in the
// main language, and in every language and with its mechanics from its menu: written in the season and in every story of
// the week, saved together). Dragging a card to another day moves its release (the season's calendar row and the story's
// own date and kind, saved together); an empty day starts a new episode on it. Episodes with no date wait under the
// board. The series' and the season's settings open in a modal.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { allLanguages, textOf, type SeasonDoc, type StoryDoc } from "sahne-story";
import { arcOfWeek, boardOf, datesOf, rowOn, weekOfArc, type Day, type Week } from "../model/board.ts";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { allProblems, change, checked, draftOf, keyOf, loadAllProblems, openDoc, review, route, saveDocs, say, world } from "../store.ts";
import type { Episode } from "../api.ts";
import { placeThumb } from "../thumbs.ts";
import { Empty, Icon, Modal, Popover } from "./kit/index.ts";
import { Picture } from "./kit/gallery.ts";
import { inLang, Texts, useLangs } from "./lang.ts";
import { NewSeason, SeasonSettings, SeriesSettings } from "./seasons.ts";
import { SaveButton } from "./readonly.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MECHANICS = ["say", "explore", "act", "aloud", "unlocks"] as const;
const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const today = new Date().toISOString().slice(0, 10);
/** A day's label on the board: its number, with the month where a month begins and in the board's first cell. */
const dayLabel = (date: string, first: boolean) => (first || date.endsWith("-01") ? short(date) : String(Number(date.slice(8))));
/** A week's span, Monday to Saturday: `14–19 Sept`, or `28 Sept – 3 Oct` across a month. */
const span = (monday: string, saturday: string) => (monday.slice(5, 7) === saturday.slice(5, 7) ? `${Number(monday.slice(8))}–${short(saturday)}` : `${short(monday)} – ${short(saturday)}`);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function Board(p: { id?: string }) {
  const w = world.value!;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  const id = p.id ?? seasons[0]?.id;
  const [settings, setSettings] = useState<"series" | "season" | null>(w.series ? null : "series");
  if (!w.series || !id || !w.seasons[id]) return html`<section>
    <div class="pagehead"><h2 class="grow">${w.series ? textOf(w.series.title, "en") : "A new series"}</h2>${w.series && html`<${NewSeason} />`}</div>
    <${Empty} icon="board" title=${w.series ? "No season yet" : "This content root has no series yet"}>
      ${w.series ? html`<p>Start the first season, then plan its weeks here.</p><${NewSeason} />` : html`<p>Name the series to start planning.</p><button class="primary" onClick=${() => setSettings("series")}>Start the series</button>`}</${Empty}>
    ${settings && html`<${Modal} title="Series settings" onClose=${() => setSettings(null)}><${SeriesSettings} /></${Modal}>`}
  </section>`;
  return html`<${SeasonBoard} key=${id} id=${id} settings=${settings} setSettings=${setSettings} />`;
}

function SeasonBoard(p: { id: string; settings: "series" | "season" | null; setSettings(s: "series" | "season" | null): void }) {
  const w = world.value!, langs = useLangs(), gloss = langs.translations[0];
  const eps = w.episodes.filter(e => e.season === w.seasons[p.id].n).sort((a, b) => a.id.localeCompare(b.id));
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ week: number; x: number; y: number } | null>(null);
  // the season and its stories open, so a move or a theme edits them together
  useEffect(() => { void Promise.all([openDoc("season", p.id), ...eps.map(e => openDoc("story", e.id))]).then(() => setReady(true)); }, [p.id]);
  useEffect(() => { if (!allProblems.value) void loadAllProblems(); }, []);
  const sd = draftOf("season", p.id);
  const se = (sd?.doc ?? w.seasons[p.id]) as SeasonDoc;
  const story = (id: string) => draftOf("story", id)?.doc as StoryDoc | undefined;
  const dates = datesOf(se, eps.map(e => ({ id: e.id, releaseDate: story(e.id)?.releaseDate ?? e.releaseDate })));
  const arcWeeks = Object.fromEntries(eps.flatMap(e => { const wk = weekOfArc(story(e.id)?.arc?.id); return wk === undefined ? [] : [[e.id, wk]]; }));
  const weeks = boardOf(se, dates, 1, arcWeeks);
  const unscheduled = eps.filter(e => !dates[e.id]);
  const keys = [keyOf("season", p.id), ...eps.map(e => keyOf("story", e.id))];
  const changed = keys.filter(k => { const [kind, id] = k.split(":") as ["season" | "story", string]; return dirty(draftOf(kind, id)); });

  /**
   * Move an episode to a day: its calendar row (a calendar is started from every episode's date if the season has none),
   * the story's own date and kind, and, to another week, that week's theme (a week with none takes the episode's).
   */
  const move = (ep: string, day: Day) => {
    if (!ready) return say("still opening the season's episodes", true);
    if (dates[ep] === day.date) return;
    const taken = Object.entries(dates).find(([, d]) => d === day.date)?.[0];
    if (taken) return say(`${taken} is on ${short(day.date)} already: move it first`, true);
    const row = rowOn(weeks, day.date);
    if (!row) return say("that is a break week", true);
    change<SeasonDoc>("season", p.id, s => {
      const cal = s.calendar ?? Object.fromEntries(Object.entries(dates).flatMap(([id, d]) => { const r = rowOn(weeks, d); return r ? [[id, r]] : []; }));
      return set(s, ["calendar"], { ...cal, [ep]: row });
    }, `move.${ep}`);
    change<StoryDoc>("story", ep, s => set(set(s, ["releaseDate"], row.date), ["kind"], row.kind), `move.${ep}`);
    const was = story(ep)?.arc, aid = arcOfWeek(se.n, row.week);
    if (was && was.id !== aid) {
      const { id: _, ...text } = was;
      const next = se.arcs?.[aid] ?? text;
      if (!se.arcs?.[aid]) change<SeasonDoc>("season", p.id, s => set(s, ["arcs", aid], next), `move.${ep}`);
      change<StoryDoc>("story", ep, s => set(s, ["arc"], { id: aid, ...next }), `move.${ep}`);
    }
  };

  /** A week's theme, written in the season and every story of the week. */
  const theme = (week: number, next: NonNullable<SeasonDoc["arcs"]>[string]) => {
    const aid = arcOfWeek(se.n, week);
    change<SeasonDoc>("season", p.id, s => set(s, ["arcs", aid], next), `arc.${aid}`);
    for (const e of eps) if (story(e.id)?.arc?.id === aid) change<StoryDoc>("story", e.id, s => set(s, ["arc"], { id: aid, ...next }), `arc.${aid}`);
  };
  const arcOf = (week: number) => se.arcs?.[arcOfWeek(se.n, week)];
  const blankArc = () => ({ ...Object.fromEntries(allLanguages(langs).map(l => [l, ""])), mechanics: ["say"] }) as unknown as NonNullable<SeasonDoc["arcs"]>[string];

  return html`<section class="board-page">
    <div class="pagehead">
      <div class="grow"><h2 ...${inLang(langs.main)}>${textOf(se.title, langs.main, ...langs.translations) ?? `Season ${se.n}`}</h2>
        <span class="note">${[gloss && textOf(se.title, gloss) && html`<span ...${inLang(gloss)}>${textOf(se.title, gloss)}</span>`, plural(eps.length, "episode"), se.launch && `from ${short(se.launch)}`].filter(Boolean).map((x, k) => html`${k ? " · " : ""}${x}`)}</span></div>
      <button onClick=${() => p.setSettings("season")} title="The season's titles, summary and launch day"><${Icon} name="settings" size=${16} /> Season settings</button>
      <button onClick=${() => p.setSettings("series")} title="The series' titles, languages, narrator and stand-in"><${Icon} name="settings" size=${16} /> Series settings</button>
      <${NewSeason} />
      <a href=${`#/new/${p.id}`}><button class="primary"><${Icon} name="plus" size=${16} /> New episode</button></a>
    </div>
    ${!se.calendar && w.writable && html`<p class="note">The days come from each episode's own date. Drag an episode to another day to start the season's calendar.</p>`}
    <div class="board" role="grid" aria-label=${`Season ${se.n}: weeks and days`}>
      <div class="board-head" role="row"><span role="columnheader">Week · theme</span>${DAYS.map((d, k) => html`<span role="columnheader" class=${k === 5 ? "special" : ""}>${d}${k === 5 ? html` <small>special</small>` : ""}</span>`)}</div>
      ${weeks.map((wk: Week) => {
        const arc = wk.week ? arcOf(wk.week) : undefined;
        return html`<div class=${`board-row${wk.week === null ? " break" : ""}${wk.days.some(d => d.date === today) || (wk.monday <= today && today < wk.days[5].date) ? " now" : ""}${wk.days.some(d => d.episode) ? "" : " unplanned"}`} role="row">
          <div class="week" role="rowheader">
            ${wk.week === null ? html`<b>Break</b><small>${span(wk.monday, wk.days[5].date)}</small>` : html`
              <div class="row" style="gap:4px;flex-wrap:nowrap"><b>Week ${wk.week}</b><span class="grow"></span>
                <button class="iconbtn" style="width:24px;height:24px" title="The theme in every language, and what the learner does" aria-label=${`Week ${wk.week}'s theme`} onClick=${(e: MouseEvent) => setMenu({ week: wk.week!, x: e.clientX, y: e.clientY })}><${Icon} name="settings" size=${14} /></button></div>
              <small>${span(wk.monday, wk.days[5].date)}</small>
              <input class="theme" ...${inLang(langs.main)} value=${arc ? textOf(arc, langs.main) ?? "" : ""} placeholder="This week's theme…" aria-label=${`Week ${wk.week}'s theme`}
                onInput=${(e: Event) => theme(wk.week!, { ...(arc ?? blankArc()), [langs.main]: (e.target as HTMLInputElement).value })} />
              ${arc && html`<div class="mech">${arc.mechanics.map(m => html`<span class="chip">${m}</span>`)}</div>`}`}
          </div>
          ${wk.days.map((day, k) => {
            const ep = day.episode ? eps.find(e => e.id === day.episode) : undefined;
            const can = wk.week !== null && !ep && w.writable;
            return html`<div role="gridcell" aria-label=${short(day.date)} class=${`day kind-${day.kind}${over === day.date ? " over" : ""}${day.date < today ? " past" : ""}${day.date === today ? " today" : ""}`}
              onDragOver=${(e: DragEvent) => { if (drag && wk.week !== null) { e.preventDefault(); setOver(day.date); } }}
              onDragLeave=${() => setOver(o => (o === day.date ? null : o))}
              onDrop=${(e: DragEvent) => { e.preventDefault(); setOver(null); const id = e.dataTransfer?.getData("text/plain") || drag; if (id) move(id, day); setDrag(null); }}>
              <span class="date"><span class="wd">${DAYS[k]} </span>${dayLabel(day.date, wk === weeks[0] && k === 0)}${day.date === today ? html` <b>today</b>` : ""}</span>
              ${ep ? html`<${EpisodeCard} e=${ep} story=${story(ep.id)} onDrag=${(on: boolean) => setDrag(on ? ep.id : null)} />`
                : can ? html`<a class="slot" href=${`#/new/${p.id}/${day.date}`} title=${`A new ${day.kind} on ${short(day.date)}`}><${Icon} name="plus" size=${16} /><span>${day.kind === "special" ? "Special" : "Episode"}</span></a>` : ""}
            </div>`;
          })}
        </div>`;
      })}
    </div>
    ${unscheduled.length > 0 && html`<h3>Not on the calendar (${unscheduled.length})</h3><p class="note">Drag one onto a day.</p>
      <div class="tray">${unscheduled.map(e => html`<${EpisodeCard} e=${e} story=${story(e.id)} onDrag=${(on: boolean) => setDrag(on ? e.id : null)} />`)}</div>`}
    ${changed.length > 0 && html`<div class="savebar"><span class="grow">${changed.map(k => k.replace(":", " ")).join(", ")}
        ${changed.flatMap(k => (checked.value[k] ?? []).filter(x => x.new && x.level === "error")).map(x => html`<span class="bad-line">${x.story}: ${x.message}</span>`)}</span>
      <button onClick=${() => { for (const k of changed) { const [kind, id] = k.split(":") as ["season" | "story", string]; void openDoc(kind, id, true); } }}>Discard</button>
      <${SaveButton} onSave=${() => void saveDocs(changed)} label="Save the board" /></div>`}
    ${menu && html`<${Popover} x=${menu.x} y=${menu.y} onClose=${() => setMenu(null)} label=${`Week ${menu.week}`}>
      <div class="fields" style="width:min(360px,80vw)"><b>Week ${menu.week}: ${arcOfWeek(se.n, menu.week)}</b>
        <${Texts} label="The theme" value=${arcOf(menu.week) as unknown as Record<string, unknown>} onInput=${(l: string, v?: string) => theme(menu.week, { ...(arcOf(menu.week) ?? blankArc()), [l]: v ?? "" })} />
        <div class="field"><label>What the learner does this week</label><div class="row">${MECHANICS.map(m => {
          const a = arcOf(menu.week) ?? blankArc(), on = a.mechanics.includes(m);
          return html`<label class="row" style="gap:4px"><input type="checkbox" style="width:auto" checked=${on} onChange=${() => theme(menu.week, { ...a, mechanics: on ? a.mechanics.filter(x => x !== m) : [...a.mechanics, m] })} />${m}</label>`;
        })}</div></div></div></${Popover}>`}
    ${p.settings && html`<${Modal} title=${p.settings === "series" ? "Series settings" : `Season ${se.n} settings`} onClose=${() => p.setSettings(null)}>
      ${p.settings === "series" ? html`<${SeriesSettings} />` : html`<${SeasonSettings} id=${p.id} />`}</${Modal}>`}
  </section>`;
}

/** An episode on the board: its place's picture, title, kind, draft, review status and problems; a link, and a drag handle. */
function EpisodeCard(p: { e: Episode; story?: StoryDoc; onDrag(on: boolean): void }) {
  const w = world.value!, { main } = useLangs();
  const status = review.value[p.e.id]?.status ?? "draft";
  const probs = (allProblems.value ?? []).filter(x => x.story === p.e.id);
  const errors = probs.filter(x => x.level === "error").length, warnings = probs.filter(x => x.level === "warning").length;
  const place = w.places[p.story?.place ?? p.e.place];
  const title = p.story?.title ?? p.e.title;
  return html`<a class=${`ep-card ${status}`} href=${`#/episode/${p.e.id}`} draggable=${w.writable ? "true" : "false"}
    onDragStart=${(ev: DragEvent) => { ev.dataTransfer?.setData("text/plain", p.e.id); p.onDrag(true); }} onDragEnd=${() => p.onDrag(false)}>
    <${Picture} art=${place ? () => placeThumb(place) : null} label=${p.e.id} />
    <b ...${inLang(main)}>${textOf(title, main) ?? p.e.id}</b>
    <small>${p.e.id}${(p.story?.kind ?? p.e.kind) === "special" ? " · special" : ""}</small>
    <span class="badges">
      <span class=${`chip ${status === "approved" ? "ok" : status === "reviewed" ? "" : "warn"}`}>${status === "draft" ? "to review" : status}</span>
      ${(p.story?.draft ?? p.e.draft) && html`<span class="chip">draft</span>`}
      ${errors > 0 && html`<span class="chip bad" title="errors">${errors} ✕</span>`}${warnings > 0 && html`<span class="chip warn" title="warnings">${warnings} !</span>`}
    </span></a>`;
}

/** The board of the route's season (or the first). */
export const BoardPage = () => html`<${Board} id=${route.value[0] === "season" ? route.value[1] : undefined} />`;
