// The studio: a top bar (the series, its seasons, search and commands, whether everything is saved, the theme), a rail
// of the places to work (the board, the cast, the places, the kit, review; then the agents, the guides and settings),
// the page the hash names, and the side panel (the assistant, the agents, the guides: side.ts).
//   #/                      the home: the series, the next episode, the way in
//   #/board, #/season/<id>  the board: a season's weeks and days, each episode on its release day
//   #/episode/<id>          one episode: play it, fix its words, stage it, review it
//   #/review                where every episode stands
//   #/cast, #/character/<id> the cast, a character's look and words
//   #/places, #/place/<id>   the places, a place's marks, props and set pieces
//   #/new/<season>[/<date>] a new episode (on that day)
//   #/kit                   the kit: props, set pieces, gestures, emotions, sounds
//   #/agents                the agents: how to connect one over MCP, how their edits land, what waits, what they did
//   #/docs[/<guide>[/<at>]] the guides: backstage's README and the story format's
//   #/settings              the assistant's model, the budget

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import "@preact/signals";
import { seasonOf } from "sahne-story";
import { dirtyKeys, go, notice, route, world } from "../store.ts";
import type { Command } from "../model/search.ts";
import { Icon, MOD } from "./kit/index.ts";
import { Palette } from "./kit/palette.ts";
import { proposals } from "../events.ts";
import { assistantOpen, Meter, sideTab } from "./assistant.ts";
import { SidePanel, toggleSide } from "./side.ts";
import { readOnlyHelp, ReadOnlyHelp } from "./readonly.ts";
import { AgentsPage } from "./agents.ts";
import { DocsPage } from "./docs.ts";
import { SettingsPage } from "./settings.ts";
import { cycleTheme, theme } from "./theme.ts";
import { tx } from "./fields.ts";
import { BoardPage } from "./board.ts";
import { HomePage } from "./home.ts";
import { Episode } from "./studio/episode.ts";
import { ReviewPage } from "./review.ts";
import { CastPage, CharacterPage } from "./cast.ts";
import { PlacePage, PlacesPage } from "./places.ts";
import { NewEpisode } from "./new.ts";
import { KitPage } from "./kitpage.ts";

/** The places to work, in the rail; after the gap, the ones about the work. */
const RAIL: [string, string, string][] = [["board", "board", "Board"], ["cast", "cast", "Cast"], ["places", "places", "Places"], ["kit", "hand", "Kit"], ["review", "review", "Review"]];
const RAIL_END: [string, string, string][] = [["agents", "plug", "Agents"], ["docs", "book", "Docs"], ["settings", "settings", "Settings"]];

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
  const area = page === "board" || page === "season" || page === "new" || page === "episode" ? "board" : page === "character" ? "cast" : page === "place" ? "places" : page === "review" ? "review" : page === "cast" || page === "places" || page === "kit" || page === "settings" || page === "agents" || page === "docs" ? page : "";
  const open = assistantOpen.value, waiting = proposals.value.length;
  const link = ([path, icon, label]: [string, string, string]) => html`<a href=${`#/${path}`} aria-current=${area === path ? "page" : undefined}><${Icon} name=${icon} size=${22} />${label}${path === "agents" && waiting ? html`<span class="badge" title=${`${waiting} proposed edit${waiting > 1 ? "s" : ""} waiting`}>${waiting}</span>` : ""}</a>`;
  return html`<div class="studio">
    <header class="topbar">
      <a class="brand" href="#/" style="text-decoration:none;color:inherit"><${Icon} name="stage" size=${22} /> Backstage</a>
      <span class="series" title=${w.series ? tx(w.series.title, "en") : ""}>${w.series ? tx(w.series.title, "en") : "No series yet"}</span>
      <nav class="seasons" aria-label="Seasons">${seasons.map(s => html`<a href=${`#/season/${s.id}`} aria-current=${current === s.id ? "page" : undefined} title=${tx(s.title, "en")}>S${s.n}</a>`)}</nav>
      <button class="search" onClick=${() => setPalette(true)} aria-label="Search and commands"><${Icon} name="search" size=${16} /> Search or run a command <kbd>${MOD} K</kbd></button>
      ${w.writable ? html`<span class=${`state${dirty ? " dirty" : ""}`} title=${dirty ? dirtyKeys.value.map(k => k.replace(":", " ")).join(", ") : ""}>${dirty ? `${dirty} unsaved` : "All saved"}</span>`
        : html`<button class="state ro" onClick=${() => { readOnlyHelp.value = true; }} title="Nothing is saved here. Click for why, and how to save.">${w.oldShape ? "Read-only: convert the root" : w.samples ? "Samples · read-only" : "Read-only"} <span aria-hidden="true">ⓘ</span></button>`}
      ${proposals.value.length > 0 && html`<a class="chip warn" href=${`#/episode/${proposals.value[0].doc}`} title=${proposals.value.map(x => `${x.doc}: ${x.summary}`).join("\n")}>${proposals.value.length} proposed edit${proposals.value.length > 1 ? "s" : ""}</a>`}
      <${Meter} />
      <button class="iconbtn" aria-pressed=${open && sideTab.value === "assistant"} onClick=${() => toggleSide("assistant")} title="The assistant" aria-label="The assistant"><${Icon} name="spark" /></button>
      <button class="iconbtn help" aria-pressed=${open && sideTab.value === "docs"} onClick=${() => toggleSide("docs")} title="Help about this page" aria-label="Help about this page">?</button>
      <button class="iconbtn" onClick=${cycleTheme} title=${`Theme: ${theme.value}`} aria-label=${`Theme: ${theme.value}`}><${Icon} name=${theme.value === "dark" ? "moon" : theme.value === "light" ? "sun" : "auto"} /></button>
    </header>
    <nav class="rail" aria-label="Areas">
      ${RAIL.map(link)}<span class="spacer"></span>${RAIL_END.map(link)}
    </nav>
    <div class="page">${w.oldShape ? html`<div class="banner">This content root is in the old language shape (${w.oldShape} files), so nothing is saved until it is converted: <code>node packages/sahne-story/convert/languages.ts</code> with <code>SAHNE_CONTENT</code> set to it.</div>` : ""}
      <main>${pageFor(page, id)}</main></div>
    <${SidePanel} />
    <${ReadOnlyHelp} />
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
    { id: "go-home", what: "Go", label: "Home", run: () => go() },
    { id: "go-board", what: "Go", label: "The board", run: () => go("board") },
    { id: "go-review", what: "Go", label: "Review: where every episode stands", run: () => go("review") },
    { id: "go-cast", what: "Go", label: "The cast", run: () => go("cast") },
    { id: "go-places", what: "Go", label: "The places", run: () => go("places") },
    { id: "go-kit", what: "Go", label: "The kit: props, gestures, emotions, sounds", run: () => go("kit") },
    { id: "theme", what: "Do", label: "Switch the theme (system, light, dark)", run: cycleTheme },
    { id: "assistant", what: "Do", label: "Open the assistant", run: () => toggleSide("assistant") },
    { id: "help", what: "Do", label: "Help about this page", keywords: "docs guide", run: () => toggleSide("docs") },
    { id: "side-agents", what: "Do", label: "Show the agents beside the page", keywords: "mcp proposals", run: () => toggleSide("agents") },
    { id: "go-agents", what: "Go", label: "Agents: connect one over MCP, how their edits land, what they did", keywords: "mcp claude code proposals activity tools", run: () => go("agents") },
    { id: "go-docs", what: "Go", label: "The guides: backstage and the story format", keywords: "docs help readme keys shortcuts", run: () => go("docs") },
    { id: "settings", what: "Go", label: "Settings: the assistant, the budget", run: () => go("settings") },
  ];
}

function pageFor(page: string | undefined, id: string | undefined) {
  switch (page) {
    case undefined: return html`<${HomePage} />`;
    case "board": case "season": return html`<${BoardPage} />`;
    case "episode": return html`<${Episode} key=${id} id=${id} />`;
    case "review": return html`<${ReviewPage} />`;
    case "cast": return html`<${CastPage} />`;
    case "character": return html`<${CharacterPage} key=${id} id=${id} />`;
    case "places": return html`<${PlacesPage} />`;
    case "place": return html`<${PlacePage} key=${id} id=${id} />`;
    case "new": return html`<${NewEpisode} key=${route.value.join("/")} season=${id} date=${route.value[2]} />`;
    case "kit": return html`<${KitPage} />`;
    case "settings": return html`<${SettingsPage} />`;
    case "agents": return html`<${AgentsPage} />`;
    case "docs": return html`<${DocsPage} guide=${id} at=${route.value[2]} />`;
    default: return html`<p>No page ${page}. <a href="#/">Home</a></p>`;
  }
}
