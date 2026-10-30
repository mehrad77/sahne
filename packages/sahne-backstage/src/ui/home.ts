// The home (#/): what backstage opens on. The series' name, the next episode's place framed as a paper theatre's stage,
// a way back into it (the next to be released, else the last), the board, and the rest of the studio in a line. A root
// with no series or no episode yet asks for the first one.

import { html } from "htm/preact";
import { textOf } from "sahne-story";
import { world } from "../store.ts";
import type { Episode } from "../api.ts";
import { placeThumb } from "../thumbs.ts";
import { Icon, MOD } from "./kit/index.ts";
import { Picture } from "./kit/gallery.ts";

const today = new Date().toISOString().slice(0, 10);

/** The episode to go back to: the next to be released, else the last released, else the first. */
function next(eps: Episode[]): Episode | undefined {
  const dated = eps.filter(e => e.releaseDate).sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
  return dated.find(e => e.releaseDate! >= today) ?? dated.at(-1) ?? eps[0];
}

export function HomePage() {
  const w = world.value!;
  const title = w.series ? textOf(w.series.title, "en") ?? "Your series" : null;
  const ep = next(w.episodes), place = ep && w.places[ep.place];
  const epTitle = ep && (textOf(ep.title, "en") ?? ep.id);
  const links: [string, string, string, number?][] = [["cast", "cast", "Cast", Object.keys(w.characters).length], ["places", "places", "Places", Object.keys(w.places).length], ["kit", "hand", "Kit"], ["docs", "book", "Guides"]];
  return html`<section class="home">
    <div class="home-stage" aria-hidden="true">
      <div class="home-scene">${place ? html`<${Picture} art=${() => placeThumb(place)} label=${epTitle!} />` : html`<div class="art blank"><${Icon} name="stage" size=${40} /></div>`}</div>
    </div>
    <p class="home-kicker">Backstage</p>
    <h1>${title ?? "A new series"}</h1>
    <p class="home-lead">${!w.series ? "Name the series, then plan its seasons, write its episodes and stage them here."
      : ep ? "Write the episodes, stage them on the paper theatre and check every line before it goes out."
      : "Plan the first season's weeks, then write and stage its first episode."}</p>
    <div class="home-go">
      ${!w.series ? html`<a class="button primary" href="#/board">Start the series</a>`
        : ep ? html`<a class="button primary" href=${`#/episode/${ep.id}`}><${Icon} name="play" size=${16} /> Continue “${epTitle}”</a><a class="button" href="#/board">Open the board</a>`
        : html`<a class="button primary" href="#/board">Plan the first episode</a>`}
    </div>
    ${ep?.releaseDate && html`<p class="note">${ep.id} · ${ep.releaseDate >= today ? "out" : "came out"} ${new Date(`${ep.releaseDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}${ep.draft ? " · a draft" : ""}</p>`}
    <nav class="home-links" aria-label="The studio">${links.map(([path, icon, label, n]) => html`<a href=${`#/${path}`}><${Icon} name=${icon} size=${17} />${label}${n !== undefined ? html`<small>${n}</small>` : ""}</a>`)}</nav>
    <p class="home-hint"><kbd>${MOD} K</kbd> finds anything${w.samples ? " · these are the samples, read-only" : ""}</p>
  </section>`;
}
