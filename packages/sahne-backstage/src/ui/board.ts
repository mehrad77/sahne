// The season board (#/board and #/season/<id>), under the series' seasons as tabs (and + Season): a season's weeks as rows and Monday to Saturday as
// columns (model/board.ts), each episode a card on its release day: the picture of its place, its title, a special or not,
// a draft, its review status and its problems. Each week's row starts with its theme (its arc, edited in place in the
// main language, and in every language and with its mechanics from its menu: written in the season and in every story of
// the week, saved together). Dragging a card to another day moves its release (the season's calendar row and the story's
// own date and kind, saved together); an empty day starts a new episode on it. Episodes with no date wait under the
// board. A new episode not on disk shows too, on its day: one an agent proposes (dashed, "proposed": it opens the preview
// to accept or reject) and one taken but not saved yet ("unsaved"). The series' and the season's settings open in a modal.
// A switch beside them (remembered) shows the season as a list instead: its episodes by week and date, one row each.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { allLanguages, seasonOf, textOf, type SeasonDoc, type StoryDoc } from "sahne-story";
import { arcOfWeek, boardOf, datesOf, rowOn, themed, weekOfArc, type Day, type Week } from "../model/board.ts";
import { set } from "../model/path.ts";
import { dirty } from "../model/history.ts";
import { allProblems, change, checked, draftOf, drafts, keyOf, loadAllProblems, openDoc, review, route, saveDocs, say, world } from "../store.ts";
import { proposals } from "../events.ts";
import type { Episode } from "../api.ts";
import { placeThumb } from "../thumbs.ts";
import { Empty, Icon, Modal, Popover } from "./kit/index.ts";
import { Picture } from "./kit/gallery.ts";
import { inLang, Texts, useLangs } from "./lang.ts";
import { NewSeason, SeasonSettings, SeriesSettings } from "./seasons.ts";
import { ProposalsStrip } from "./proposed.ts";
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
const VIEW_KEY = "backstage-board-view";
type View = "calendar" | "list";

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
  const n = w.seasons[p.id].n;
  const onDisk = w.episodes.filter(e => e.season === n);
  // new episodes not on disk: taken but unsaved (a draft), or proposed by an agent (the latest of its proposals)
  const asEpisode = (id: string, d: StoryDoc): Episode => ({ id, season: n, title: d.title, kind: d.kind, releaseDate: d.releaseDate, draft: !!d.draft, place: d.place, cast: d.cast ?? [] });
  const unsaved = Object.keys(drafts.value).filter(k => k.startsWith("story:")).map(k => k.slice(6)).filter(id => seasonOf(id) === n && !onDisk.some(e => e.id === id)).map(id => asEpisode(id, draftOf("story", id)!.doc as StoryDoc));
  const proposed = new Map<string, StoryDoc>();
  for (const x of [...proposals.value].sort((a, b) => a.at - b.at)) if (x.kind === "story" && x.create && seasonOf(x.doc) === n && !onDisk.some(e => e.id === x.doc) && !unsaved.some(e => e.id === x.doc)) proposed.set(x.doc, x.next as StoryDoc);
  const eps = [...onDisk, ...unsaved, ...[...proposed].map(([id, d]) => asEpisode(id, d))].sort((a, b) => a.id.localeCompare(b.id));
  const markOf = (id: string) => (proposed.has(id) ? "proposed" : unsaved.some(e => e.id === id) ? "unsaved" : undefined);
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ week: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "calendar"; } catch { return "calendar"; } });
  const pickView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* a private window */ } };
  // the season and its stories open, so a move or a theme edits them together
  useEffect(() => { void Promise.all([openDoc("season", p.id), ...onDisk.map(e => openDoc("story", e.id))]).then(() => setReady(true)); }, [p.id]);
  useEffect(() => { if (!allProblems.value) void loadAllProblems(); }, []);
  const sd = draftOf("season", p.id);
  const se = (sd?.doc ?? w.seasons[p.id]) as SeasonDoc;
  const story = (id: string) => (draftOf("story", id)?.doc ?? proposed.get(id)) as StoryDoc | undefined;
  const dates = datesOf(se, eps.map(e => ({ id: e.id, releaseDate: story(e.id)?.releaseDate ?? e.releaseDate })));
  const arcWeeks = Object.fromEntries(eps.flatMap(e => { const wk = weekOfArc(story(e.id)?.arc?.id); return wk === undefined ? [] : [[e.id, wk]]; }));
  const weeks = boardOf(se, dates, 1, arcWeeks);
  const unscheduled = eps.filter(e => !dates[e.id]);
  const keys = [keyOf("season", p.id), ...eps.filter(e => !proposed.has(e.id)).map(e => keyOf("story", e.id))];
  const changed = keys.filter(k => { const [kind, id] = k.split(":") as ["season" | "story", string]; return dirty(draftOf(kind, id)); });

  /**
   * Move an episode to a day: its calendar row (a calendar is started from every episode's date if the season has none),
   * the story's own date and kind, and, to another week, that week's theme (a week with none takes the episode's).
   */
  const move = (ep: string, day: Day) => {
    if (!ready) return say("still opening the season's episodes", true);
    if (proposed.has(ep)) return say(`${ep} is only proposed: accept it first, then move it`, true);
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
    const t = themed(se, week, next);
    change<SeasonDoc>("season", p.id, s => themed(s, week, next).season, `arc.${t.aid}`);
    for (const e of eps) if (story(e.id) && t.story(story(e.id)!)) change<StoryDoc>("story", e.id, s => t.story(s) ?? s, `arc.${t.aid}`);
  };
  const arcOf = (week: number) => se.arcs?.[arcOfWeek(se.n, week)];
  const blankArc = () => ({ ...Object.fromEntries(allLanguages(langs).map(l => [l, ""])), mechanics: ["say"] }) as unknown as NonNullable<SeasonDoc["arcs"]>[string];

  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  return html`<section class="board-page">
    <nav class="season-tabs" aria-label="Seasons">${seasons.map(x => html`<a href=${`#/season/${x.id}`} aria-current=${x.id === p.id ? "page" : undefined}>Season ${x.n}${textOf(x.title, langs.main) && textOf(x.title, langs.main) !== `Season ${x.n}` ? html`<small ...${inLang(langs.main)}>${textOf(x.title, langs.main)}</small>` : ""}</a>`)}<${NewSeason} /></nav>
    <div class="pagehead">
      <div class="grow"><h2 ...${inLang(langs.main)}>${textOf(se.title, langs.main, ...langs.translations) ?? `Season ${se.n}`}</h2>
        <span class="note">${[gloss && textOf(se.title, gloss) && html`<span ...${inLang(gloss)}>${textOf(se.title, gloss)}</span>`, plural(eps.length - proposed.size, "episode"), proposed.size > 0 && `${proposed.size} proposed`, se.launch && `from ${short(se.launch)}`].filter(Boolean).map((x, k) => html`${k ? " · " : ""}${x}`)}</span></div>
      <div class="seg viewseg" role="group" aria-label="View">${([["calendar", "calendar", "The calendar: weeks and days"], ["list", "list", "A list: one row per episode"]] as const).map(([v, icon, t]) => html`<button aria-pressed=${view === v} onClick=${() => pickView(v)} title=${t} aria-label=${t}><${Icon} name=${icon} size=${16} /></button>`)}</div>
      <button onClick=${() => p.setSettings("season")} title="The season's titles, summary and launch day"><${Icon} name="settings" size=${16} /> Season settings</button>
      <button onClick=${() => p.setSettings("series")} title="The series' titles, languages, narrator and stand-in"><${Icon} name="settings" size=${16} /> Series settings</button>
      <a href=${`#/new/${p.id}`}><button class="primary"><${Icon} name="plus" size=${16} /> New episode</button></a>
    </div>
    <${ProposalsStrip} kind="season" id=${p.id} /><${ProposalsStrip} kind="series" />
    ${view === "list" ? html`<${EpisodeList} weeks=${weeks} eps=${eps} unscheduled=${unscheduled} dates=${dates} arcOf=${arcOf} story=${story} markOf=${markOf} seasonId=${p.id} />` : html`
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
              ${ep ? html`<${EpisodeCard} e=${ep} story=${story(ep.id)} mark=${markOf(ep.id)} onDrag=${(on: boolean) => setDrag(on ? ep.id : null)} />`
                : can ? html`<a class="slot" href=${`#/new/${p.id}/${day.date}`} title=${`A new ${day.kind} on ${short(day.date)}`}><${Icon} name="plus" size=${16} /><span>${day.kind === "special" ? "Special" : "Episode"}</span></a>` : ""}
            </div>`;
          })}
        </div>`;
      })}
    </div>
    ${unscheduled.length > 0 && html`<h3>Not on the calendar (${unscheduled.length})</h3><p class="note">Drag one onto a day.</p>
      <div class="tray">${unscheduled.map(e => html`<${EpisodeCard} e=${e} story=${story(e.id)} mark=${markOf(e.id)} onDrag=${(on: boolean) => setDrag(on ? e.id : null)} />`)}</div>`}`}
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
function EpisodeCard(p: { e: Episode; story?: StoryDoc; mark?: "proposed" | "unsaved"; onDrag(on: boolean): void }) {
  const w = world.value!, { main } = useLangs();
  const status = review.value[p.e.id]?.status ?? "draft";
  const place = w.places[p.story?.place ?? p.e.place];
  const title = p.story?.title ?? p.e.title;
  const proposed = p.mark === "proposed";
  return html`<a class=${`ep-card ${proposed ? "proposed" : status}`} href=${`#/episode/${p.e.id}`} draggable=${w.writable && !proposed ? "true" : "false"}
    title=${proposed ? "Proposed by an agent: open it to accept or reject it" : p.mark === "unsaved" ? "New and not saved yet: open it and save" : undefined}
    onDragStart=${(ev: DragEvent) => { ev.dataTransfer?.setData("text/plain", p.e.id); p.onDrag(true); }} onDragEnd=${() => p.onDrag(false)}>
    <${Picture} art=${place ? () => placeThumb(place) : null} label=${p.e.id} />
    <b ...${inLang(main)}>${textOf(title, main) ?? p.e.id}</b>
    <small>${p.e.id}${(p.story?.kind ?? p.e.kind) === "special" ? " · special" : ""}</small>
    <${Badges} e=${p.e} story=${p.story} mark=${p.mark} /></a>`;
}

/** An episode's state: proposed or unsaved, else its review status; a draft; its errors and warnings. */
function Badges(p: { e: Episode; story?: StoryDoc; mark?: "proposed" | "unsaved" }) {
  const status = review.value[p.e.id]?.status ?? "draft";
  const probs = (allProblems.value ?? []).filter(x => x.story === p.e.id);
  const errors = probs.filter(x => x.level === "error").length, warnings = probs.filter(x => x.level === "warning").length;
  return html`<span class="badges">
    ${p.mark ? html`<span class=${`chip ${p.mark === "proposed" ? "suggest" : "warn"}`}>${p.mark}</span>`
      : html`<span class=${`chip ${status === "approved" ? "ok" : status === "reviewed" ? "" : "warn"}`}>${status === "draft" ? "to review" : status}</span>`}
    ${(p.story?.draft ?? p.e.draft) && html`<span class="chip">draft</span>`}
    ${errors > 0 && html`<span class="chip bad" title="errors">${errors} ✕</span>`}${warnings > 0 && html`<span class="chip warn" title="warnings">${warnings} !</span>`}
  </span>`;
}

/** The season as a list: each week (its dates and theme) with its episodes in release order, then those with no date. */
function EpisodeList(p: { weeks: Week[]; eps: Episode[]; unscheduled: Episode[]; dates: Record<string, string>; arcOf(week: number): Record<string, unknown> | undefined; story(id: string): StoryDoc | undefined; markOf(id: string): "proposed" | "unsaved" | undefined; seasonId: string }) {
  const langs = useLangs();
  const groups = p.weeks.filter(wk => wk.days.some(d => d.episode)).map(wk => ({ wk, eps: wk.days.flatMap(d => (d.episode ? p.eps.filter(e => e.id === d.episode) : [])) }));
  if (!p.eps.length) return html`<${Empty} icon="board" title="No episode yet"><p>Start the season's first.</p><a href=${`#/new/${p.seasonId}`}><button class="primary">New episode</button></a></${Empty}>`;
  const row = (e: Episode) => html`<${EpisodeRow} e=${e} story=${p.story(e.id)} mark=${p.markOf(e.id)} date=${p.dates[e.id]} />`;
  return html`<div class="ep-list" role="list" aria-label="Episodes">
    ${groups.map(({ wk, eps }) => {
      const arc = wk.week ? p.arcOf(wk.week) : undefined, theme = arc && textOf(arc as never, langs.main);
      return html`<div class="ep-week"><h3><b>${wk.week === null ? "Break" : `Week ${wk.week}`}</b><small>${span(wk.monday, wk.days[5].date)}</small>${theme && html`<span class="theme" ...${inLang(langs.main)}>${theme}</span>`}<small class="count">${plural(eps.length, "episode")}</small></h3>${eps.map(row)}</div>`;
    })}
    ${p.unscheduled.length > 0 && html`<div class="ep-week"><h3><b>Not on the calendar</b><small class="count">${plural(p.unscheduled.length, "episode")}</small></h3>${p.unscheduled.map(row)}</div>`}
  </div>`;
}

/** One episode in the list: its place's picture, title (and its first translation), day, place, cast and state. */
function EpisodeRow(p: { e: Episode; story?: StoryDoc; mark?: "proposed" | "unsaved"; date?: string }) {
  const w = world.value!, langs = useLangs(), gloss = langs.translations[0];
  const s = p.story, place = w.places[s?.place ?? p.e.place], title = s?.title ?? p.e.title;
  const cast = (s?.cast ?? p.e.cast).map(c => textOf(w.characters[c]?.name, langs.main) ?? c);
  const special = (s?.kind ?? p.e.kind) === "special";
  const day = p.date ? new Date(`${p.date}T12:00:00Z`) : undefined;
  return html`<a class=${`ep-row ${p.mark === "proposed" ? "proposed" : review.value[p.e.id]?.status ?? "draft"}`} href=${`#/episode/${p.e.id}`} role="listitem">
    <span class="when">${day ? html`<b>${day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</b><small>${short(p.date!)}</small>` : html`<small>no date</small>`}</span>
    <${Picture} art=${place ? () => placeThumb(place) : null} label=${p.e.id} />
    <span class="what"><b ...${inLang(langs.main)}>${textOf(title, langs.main) ?? p.e.id}</b>${gloss && textOf(title, gloss) && html`<small ...${inLang(gloss)}>${textOf(title, gloss)}</small>`}</span>
    <span class="meta"><small>${p.e.id}${special ? " · special" : ""}</small><small>${place ? textOf(place.name, langs.main, ...langs.translations) ?? place.id : ""}${cast.length ? ` · ${cast.join(", ")}` : ""}</small></span>
    <${Badges} e=${p.e} story=${p.story} mark=${p.mark} />
  </a>`;
}

/** The board of the route's season (or the first). */
export const BoardPage = () => html`<${Board} id=${route.value[0] === "season" ? route.value[1] : undefined} />`;
