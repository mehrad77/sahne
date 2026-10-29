// The studio: a top bar (the series, its seasons, search and commands, whether everything is saved, the theme), a rail
// of the places to work (the board, the cast, the places, review, settings), and the page the hash names.
//   #/                      the series and its seasons
//   #/season/<id>           a season's episodes
//   #/episode/<id>          one episode: play it, fix its words, stage it, review it
//   #/review                where every episode stands
//   #/cast, #/character/<id> the cast, a character's look and words
//   #/places, #/place/<id>   the places, a place's marks, props and set pieces
//   #/new/<season>          a new episode from its brief

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "@preact/signals";
import { seasonOf } from "sahne-story";
import { dirtyKeys, go, notice, route, world } from "../store.ts";
import type { Command } from "../model/search.ts";
import { Icon, MOD } from "./kit/index.ts";
import { Palette } from "./kit/palette.ts";
import { cycleTheme, theme } from "./theme.ts";
import { tx } from "./fields.ts";
import { Home } from "./home.ts";
import { Season } from "./season.ts";
import { Episode } from "./episode.ts";
import { ReviewPage } from "./review.ts";
import { CastPage, CharacterPage } from "./cast.ts";
import { PlacePage, PlacesPage } from "./places.ts";
import { NewEpisode } from "./new.ts";

/** The places to work, in the rail. */
const RAIL: [string, string, string][] = [["", "board", "Board"], ["cast", "cast", "Cast"], ["places", "places", "Places"], ["review", "review", "Review"]];

export function App() {
  const w = world.value, r = route.value;
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(o => !o); } };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const commands = useMemo(() => (w ? commandsOf() : []), [w]);
  if (!w) return html`<p style="padding:20px">Opening backstage…</p>`;
  const [page, id] = r;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  // the season on screen: its page, an episode of it, or a new episode in it
  const current = page === "season" || page === "new" ? id : page === "episode" && id ? `s${seasonOf(id)}` : undefined;
  const dirty = dirtyKeys.value.length;
  const area = page === "character" ? "cast" : page === "place" ? "places" : page === "review" ? "review" : page === "cast" || page === "places" ? page : "";
  return html`<div class="studio">
    <header class="topbar">
      <a class="brand" href="#/" style="text-decoration:none;color:inherit"><${Icon} name="stage" size=${22} /> Backstage</a>
      <span class="series" title=${w.series ? tx(w.series.title, "en") : ""}>${w.series ? tx(w.series.title, "en") : "No series yet"}</span>
      <nav class="seasons" aria-label="Seasons">${seasons.map(s => html`<a href=${`#/season/${s.id}`} aria-current=${current === s.id ? "page" : undefined} title=${tx(s.title, "en")}>S${s.n}</a>`)}</nav>
      <button class="search" onClick=${() => setPalette(true)} aria-label="Search and commands"><${Icon} name="search" size=${16} /> Search or run a command <kbd>${MOD} K</kbd></button>
      <span class=${`state${dirty ? " dirty" : ""}${w.writable ? "" : " ro"}`} title=${dirty ? dirtyKeys.value.map(k => k.replace(":", " ")).join(", ") : ""}>
        ${!w.writable ? (w.oldShape ? "Read-only: convert the root" : w.samples ? "Samples · read-only" : "Read-only") : dirty ? `${dirty} unsaved` : "All saved"}</span>
      <button class="iconbtn" onClick=${cycleTheme} title=${`Theme: ${theme.value}`} aria-label=${`Theme: ${theme.value}`}><${Icon} name=${theme.value === "dark" ? "moon" : theme.value === "light" ? "sun" : "auto"} /></button>
    </header>
    <nav class="rail" aria-label="Areas">
      ${RAIL.map(([path, icon, label]) => html`<a href=${`#/${path}`} aria-current=${area === path ? "page" : undefined}><${Icon} name=${icon} size=${22} />${label}</a>`)}
    </nav>
    <div class="page">${w.oldShape ? html`<div class="banner">This content root is in the old language shape (${w.oldShape} files), so nothing is saved until it is converted: <code>node packages/sahne-story/convert/languages.ts</code> with <code>SAHNE_CONTENT</code> set to it.</div>` : ""}
      <main>${pageFor(page, id)}</main></div>
    ${palette && html`<${Palette} commands=${commands} onClose=${() => setPalette(false)} />`}
    ${notice.value && html`<div class=${`notice${notice.value.bad ? " bad" : ""}`} role="status">${notice.value.text}</div>`}
  </div>`;
}

/** Everything the palette can go to or do. */
function commandsOf(): Command[] {
  const w = world.value!;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  return [
    ...[...w.episodes].sort((a, b) => a.id.localeCompare(b.id)).map(e => ({ id: `ep-${e.id}`, what: "Episode", label: `${e.id} · ${tx(e.title)}`, keywords: `${tx(e.title, "en")} ${e.place} ${e.cast.join(" ")}`, hint: e.releaseDate, run: () => go("episode", e.id) })),
    ...seasons.map(s => ({ id: `se-${s.id}`, what: "Season", label: `Season ${s.n} · ${tx(s.title, "en")}`, keywords: s.id, run: () => go("season", s.id) })),
    ...seasons.map(s => ({ id: `new-${s.id}`, what: "New", label: `A new episode in season ${s.n}`, keywords: "create add write", run: () => go("new", s.id) })),
    ...Object.values(w.characters).map(c => ({ id: `ch-${c.id}`, what: c.kind === "extra" ? "Extra" : "Character", label: tx(c.name) || c.id, keywords: `${c.id} ${tx(c.role, "en")}`, run: () => go("character", c.id) })),
    ...Object.entries(w.places).map(([pid, p]) => ({ id: `pl-${pid}`, what: "Place", label: tx(p.name, "en") || pid, keywords: `${pid} ${tx(p.name)}`, run: () => go("place", pid) })),
    { id: "go-board", what: "Go", label: "The board", run: () => go() },
    { id: "go-review", what: "Go", label: "Review: where every episode stands", run: () => go("review") },
    { id: "go-cast", what: "Go", label: "The cast", run: () => go("cast") },
    { id: "go-places", what: "Go", label: "The places", run: () => go("places") },
    { id: "theme", what: "Do", label: "Switch the theme (system, light, dark)", run: cycleTheme },
  ];
}

function pageFor(page: string | undefined, id: string | undefined) {
  switch (page) {
    case undefined: return html`<${Home} />`;
    case "season": return html`<${Season} id=${id} />`;
    case "episode": return html`<${Episode} key=${id} id=${id} />`;
    case "review": return html`<${ReviewPage} />`;
    case "cast": return html`<${CastPage} />`;
    case "character": return html`<${CharacterPage} key=${id} id=${id} />`;
    case "places": return html`<${PlacesPage} />`;
    case "place": return html`<${PlacePage} key=${id} id=${id} />`;
    case "new": return html`<${NewEpisode} key=${id} season=${id} />`;
    default: return html`<p>No page ${page}. <a href="#/">The board</a></p>`;
  }
}
