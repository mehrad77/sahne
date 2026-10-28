// The editor's shell: the side bar (the series, its seasons, the cast, the places, review) and the page the hash names.
//   #/                      the series and its seasons
//   #/season/<id>           a season's episodes
//   #/episode/<id>          one episode: play it, fix its words, stage it

import { html } from "htm/preact";
import "@preact/signals";
import { dirtyKeys, notice, route, world } from "../store.ts";
import { Home } from "./home.ts";
import { Season } from "./season.ts";
import { Episode } from "./episode.ts";

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
      <div class="group">Seasons</div>
      ${seasons.map(s => html`<a href=${`#/season/${s.id}`} aria-current=${here("season", s.id)}>${s.titleEn}</a>`)}
      ${!seasons.length && html`<p class="note">No seasons yet.</p>`}
      ${dirtyKeys.value.length > 0 && html`<p class="note" style="margin-top:14px">Unsaved: ${dirtyKeys.value.map(k => k.replace(":", " ")).join(", ")}</p>`}
    </nav>
    <main>${pageFor(page, id)}</main>
    ${notice.value && html`<div class=${`notice${notice.value.bad ? " bad" : ""}`} role="status">${notice.value.text}</div>`}
  </div>`;
}

function pageFor(page: string | undefined, id: string | undefined) {
  switch (page) {
    case undefined: return html`<${Home} />`;
    case "season": return html`<${Season} id=${id} />`;
    case "episode": return html`<${Episode} key=${id} id=${id} />`;
    default: return html`<p>No page ${page}. <a href="#/">The series</a></p>`;
  }
}
