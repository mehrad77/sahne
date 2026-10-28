// The series page: what the series is, its narrator and stand-in, and its seasons with how many episodes each has.

import { html } from "htm/preact";
import { world } from "../store.ts";

export function Home() {
  const w = world.value!, s = w.series;
  const seasons = Object.values(w.seasons).sort((a, b) => a.n - b.n);
  const count = (n: number) => w.episodes.filter(e => e.season === n).length;
  return html`<section>
    <h2>${s?.titleEn ?? "No series"}</h2>
    ${s ? html`<p><span lang="tr">${s.title}</span> · <span dir="rtl" lang="fa">${s.titleFa}</span></p>
      ${s.summary && html`<p class="note">${s.summary}</p>`}
      <p class="row"><span class="chip">narrator: ${w.characters[s.narrator]?.name ?? s.narrator}</span><span class="chip">stand-in: ${w.characters[s.standin]?.name ?? s.standin}</span>
        <span class="chip">${w.episodes.length} episodes</span><span class="chip">${Object.keys(w.characters).length} characters</span><span class="chip">${Object.keys(w.places).length} places</span></p>`
    : html`<p class="note">This content root has no series.json yet. The story check warns until one is added, with a seasons/s<n>.json per season.</p>`}
    <h3>Seasons</h3>
    <div class="cards">
      ${seasons.map(se => html`<a class="card" href=${`#/season/${se.id}`}><b>${se.titleEn}</b><small lang="tr">${se.title}</small>
        <small>${count(se.n)} episodes${se.launch ? ` · from ${se.launch}` : ""}${se.calendar ? "" : " · no calendar"}</small></a>`)}
    </div>
    ${w.samples && html`<p class="note" style="margin-top:16px">These are Sahne's samples. Kumru runs backstage on its own data/ with <code>pnpm backstage</code>.</p>`}
  </section>`;
}
