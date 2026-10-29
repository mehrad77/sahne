// The editor's shell: the side bar (the series, its seasons, the cast, the places, review) and the page the hash names.
//   #/                      the series and its seasons
//   #/season/<id>           a season's episodes
//   #/episode/<id>          one episode: play it, fix its words, stage it, review it
//   #/review                where every episode stands
//   #/cast, #/character/<id> the cast, a character's look and words
//   #/places, #/place/<id>   the places, a place's marks, props and set pieces
//   #/new/<season>          a new episode from its brief

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import "@preact/signals";
import { dirtyKeys, notice, route, world } from "../store.ts";
import { Home } from "./home.ts";
import { Season } from "./season.ts";
import { Episode } from "./episode.ts";
import { ReviewPage } from "./review.ts";
import { CastPage, CharacterPage } from "./cast.ts";
import { PlacePage, PlacesPage } from "./places.ts";
import { NewEpisode } from "./new.ts";

export function App() {
  const w = world.value, r = route.value;
  if (!w) return html`<p>Loading…</p>`;
  const [page, id] = r;
  const here = (...p: string[]) => (p.join("/") === r.slice(0, p.length).join("/") && (p.length || !r.length) ? "page" : undefined);
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  return html`<div class="shell">
    <nav class="nav">
      <h1>Backstage</h1>
      <div class="sub">${w.series?.titleEn ?? "No series yet"}${w.samples ? " · samples" : ""}${w.writable ? "" : " · read-only"}</div>
      <a href="#/" aria-current=${here()}>The series</a>
      <a href="#/review" aria-current=${here("review")}>Review</a>
      <a href="#/cast" aria-current=${here("cast")}>The cast</a>
      <a href="#/places" aria-current=${here("places")}>Places</a>
      <div class="group">Seasons</div>
      ${seasons.map(s => html`<${SeasonNav} key=${s.id} id=${s.id} n=${s.n} title=${s.titleEn} />`)}
      ${!seasons.length && html`<p class="note">No seasons yet.</p>`}
      ${dirtyKeys.value.length > 0 && html`<p class="note" style="margin-top:14px">Unsaved: ${dirtyKeys.value.map(k => k.replace(":", " ")).join(", ")}</p>`}
    </nav>
    <main>${pageFor(page, id)}</main>
    ${notice.value && html`<div class=${`notice${notice.value.bad ? " bad" : ""}`} role="status">${notice.value.text}</div>`}
  </div>`;
}

/** A season in the side bar, opened to its episodes (open by itself while one of them, or the season, is on screen). */
function SeasonNav(p: { id: string; n: number; title: string }) {
  const w = world.value!, r = route.value;
  const eps = w.episodes.filter(e => e.season === p.n).sort((a, b) => a.id.localeCompare(b.id));
  const inside = (r[0] === "season" && r[1] === p.id) || (r[0] === "episode" && eps.some(e => e.id === r[1]));
  // null until the caret is used: then open while on its season or one of its episodes
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? inside;
  return html`<div class="season-nav">
    <div class="row" style="gap:0;flex-wrap:nowrap">
      <button class="caret" aria-expanded=${shown} aria-label=${`${shown ? "Close" : "Open"} ${p.title}`} onClick=${() => setOpen(!shown)}>${shown ? "▾" : "▸"}</button>
      <a class="grow" href=${`#/season/${p.id}`} aria-current=${r[0] === "season" && r[1] === p.id ? "page" : undefined}>${p.title} <small class="note">${eps.length}</small></a>
    </div>
    ${shown && html`<div class="eps">${eps.map(e => html`<a href=${`#/episode/${e.id}`} aria-current=${r[0] === "episode" && r[1] === e.id ? "page" : undefined} title=${e.titleEn ?? ""}>
      <span class="id">${e.id.slice(-3)}</span> <span lang="tr">${e.title}</span>${e.kind === "special" ? html` <small class="note">special</small>` : ""}${e.draft ? html` <small class="note">draft</small>` : ""}</a>`)}
      <a href=${`#/new/${p.id}`} class="note">+ a new episode</a></div>`}
  </div>`;
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
    default: return html`<p>No page ${page}. <a href="#/">The series</a></p>`;
  }
}
