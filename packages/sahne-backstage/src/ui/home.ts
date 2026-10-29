// The series page: what the series is, its narrator and stand-in, and its seasons with how many episodes each has.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { world } from "../store.ts";
import { NewSeason, SeriesEditor } from "./seasons.ts";
import { tx } from "./fields.ts";

export function Home() {
  const w = world.value!, s = w.series;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  const count = (n: number) => w.episodes.filter(e => e.season === n).length;
  const [editing, setEditing] = useState(!s);
  const orphans = w.episodes.filter(e => !seasons.some(se => se.n === e.season)).sort((a, b) => a.id.localeCompare(b.id));
  return html`<section>
    <h2>${s ? tx(s.title, "en") : "No series"}</h2>
    ${s ? html`<p><span lang="tr">${tx(s.title)}</span> · <span dir="rtl" lang="fa">${tx(s.title, "fa")}</span></p>
      ${s.summary && html`<p class="note">${tx(s.summary, "en")}</p>`}
      <p class="row"><span class="chip">narrator: ${w.characters[s.narrator]?.name ?? s.narrator}</span><span class="chip">stand-in: ${w.characters[s.standin]?.name ?? s.standin}</span>
        <span class="chip">${w.episodes.length} episodes</span><span class="chip">${Object.keys(w.characters).length} characters</span><span class="chip">${Object.keys(w.places).length} places</span></p>`
    : html`<p class="note">This content root has no series.json yet. The story check warns until one is added, with a ${"seasons/s<n>.json"} per season.</p>`}
    <button onClick=${() => setEditing(!editing)} aria-pressed=${editing}>${editing ? "Done" : s ? "Edit the series" : "Start the series"}</button>
    ${editing && html`<div style="margin-top:8px"><${SeriesEditor} /></div>`}
    <div class="row"><h3 class="grow">Seasons</h3><${NewSeason} /></div>
    <div class="cards">
      ${seasons.map(se => html`<a class="card" href=${`#/season/${se.id}`}><b>${tx(se.title, "en")}</b><small lang="tr">${tx(se.title)}</small>
        <small>${count(se.n)} episodes${se.launch ? ` · from ${se.launch}` : ""}${se.calendar ? "" : " · no calendar"}</small></a>`)}
    </div>
    ${orphans.length > 0 && html`<h3>Episodes without a season document (${orphans.length})</h3>
      <p class="note">Their season has no ${"seasons/s<n>.json"} yet: the story check warns, and the season's page cannot list them. Add the season above.</p>
      <div class="cards">${orphans.map(e => html`<a class="card" href=${`#/episode/${e.id}`}><b>${e.id}</b><small lang="tr">${tx(e.title)}</small><small>${e.kind ?? ""}${e.releaseDate ? ` · ${e.releaseDate}` : ""}${e.draft ? " · draft" : ""}</small></a>`)}</div>`}
    ${w.samples && html`<p class="note" style="margin-top:16px">These are Sahne's samples. Kumru runs backstage on its own data/ with <code>pnpm backstage</code>.</p>`}
  </section>`;
}
