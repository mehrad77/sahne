// A season's page: its titles and its episodes in order (id, title, weekday episode or Saturday special, release date,
// where it plays, a draft or not), each a link to the episode page.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { world } from "../store.ts";
import { SeasonEditor } from "./seasons.ts";

export function Season(p: { id?: string }) {
  const w = world.value!, se = p.id ? w.seasons[p.id] : undefined;
  if (!se) return html`<p>No season ${p.id}. <a href="#/">The series</a></p>`;
  const eps = w.episodes.filter(e => e.season === se.n).sort((a, b) => a.id.localeCompare(b.id));
  const [tab, setTab] = useState<"episodes" | "edit">("episodes");
  return html`<section>
    <div class="row"><h2 class="grow">${se.titleEn}</h2>
      <button class=${tab === "episodes" ? "primary" : ""} onClick=${() => setTab("episodes")}>Episodes</button>
      <button class=${tab === "edit" ? "primary" : ""} onClick=${() => setTab("edit")}>Edit the season</button>
      <a href=${`#/new/${se.id}`}><button>+ New episode</button></a></div>
    ${tab === "edit" ? html`<${SeasonEditor} key=${se.id} id=${se.id} />` : html`<div>
    <p><span lang="tr">${se.title}</span> · <span dir="rtl" lang="fa">${se.titleFa}</span></p>
    ${se.summary && html`<p class="note">${se.summary}</p>`}
    <table class="grid" style="margin-top:12px">
      <thead><tr><th>Episode</th><th>Title</th><th>Kind</th><th>Release</th><th>Week</th><th>Place</th><th></th></tr></thead>
      <tbody>${eps.map(e => html`<tr>
        <td><a href=${`#/episode/${e.id}`}>${e.id}</a></td>
        <td><span lang="tr">${e.title}</span>${e.titleEn ? html`<br /><small class="note">${e.titleEn}</small>` : ""}</td>
        <td>${e.kind ?? ""}</td><td>${e.releaseDate ?? ""}</td><td>${w.days?.[e.id]?.week ?? ""}</td><td>${w.places[e.place]?.name?.en ?? e.place}</td>
        <td>${e.draft ? html`<span class="chip warn">draft</span>` : ""}</td></tr>`)}</tbody>
    </table>
    ${!eps.length && html`<p class="note">No episodes in this season yet.</p>`}
    </div>`}
  </section>`;
}
