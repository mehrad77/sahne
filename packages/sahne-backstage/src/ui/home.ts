// The home (#/): what backstage opens on. The series' name, the scene last worked on framed as a paper theatre's stage
// (recent.ts; before any, the next episode's place), a way back into it, the board, and the rest of the studio in a
// line. Continue opens the curtains, the scene grows to fill the page and the episode opens under it at that cue; with
// reduced motion it simply opens. A root with no series or no episode yet asks for the first one.

import { html } from "htm/preact";
import { useRef } from "preact/hooks";
import { textOf } from "sahne-story";
import { go, world } from "../store.ts";
import type { Episode } from "../api.ts";
import { recent, resumeAt } from "../recent.ts";
import { placeThumb } from "../thumbs.ts";
import { Icon, MOD } from "./kit/index.ts";
import { Picture, type Art } from "./kit/gallery.ts";

const today = new Date().toISOString().slice(0, 10);

/** The episode to go back to when nothing was worked on here: the next to be released, else the last, else the first. */
function next(eps: Episode[]): Episode | undefined {
  const dated = eps.filter(e => e.releaseDate).sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
  return dated.find(e => e.releaseDate! >= today) ?? dated.at(-1) ?? eps[0];
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 60 / 24)} days ago`;
};

/** Open the curtains, grow the scene to fill the page, and go to the episode under it. */
function enter(home: HTMLElement, id: string, cue: number | undefined) {
  if (cue !== undefined) resumeAt(id, cue);
  const scene = home.querySelector<HTMLElement>(".home-scene"), page = home.closest<HTMLElement>(".page");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !scene || !page || !scene.animate) return go("episode", id);
  home.classList.add("opening");
  setTimeout(() => {
    const from = scene.getBoundingClientRect(), to = page.getBoundingClientRect();
    const fly = Object.assign(document.createElement("div"), { className: "home-fly", ariaHidden: "true" });
    const img = scene.querySelector("img");
    if (img) fly.append(img.cloneNode());
    document.body.append(fly);
    const box = (r: DOMRect, radius: number) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: `${radius}px` });
    const grow = fly.animate([box(from, 6), box(to, 0)], { duration: 560, easing: "cubic-bezier(.65, 0, .25, 1)", fill: "forwards" });
    void grow.finished.then(() => {
      go("episode", id);
      // the episode's page draws under the picture; then the picture fades away
      setTimeout(() => void fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" }).finished.then(() => fly.remove()), 250);
    });
  }, 620);
}

export function HomePage() {
  const w = world.value!;
  const ref = useRef<HTMLElement>(null);
  const title = w.series ? textOf(w.series.title, "en") ?? "Your series" : null;
  const last = recent();
  const worked = last && w.episodes.find(e => e.id === last.id);
  const ep = worked ?? next(w.episodes), place = ep && w.places[ep.place];
  const epTitle = ep && (textOf(ep.title, "en") ?? ep.id);
  const art: Art = worked && last.picture ? { url: last.picture } : place ? () => placeThumb(place) : null;
  const links: [string, string, string, number?][] = [["cast", "cast", "Cast", Object.keys(w.characters).length], ["places", "places", "Places", Object.keys(w.places).length], ["kit", "hand", "Kit"], ["docs", "book", "Guides"]];
  const onContinue = (e: MouseEvent) => {
    if (!ep || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    enter(ref.current!, ep.id, worked ? last.cue : undefined);
  };
  return html`<section class="home" ref=${ref}>
    <div class="home-stage" aria-hidden="true">
      <div class="home-scene">${art ? html`<${Picture} art=${art} label=${epTitle ?? ""} />` : html`<div class="art blank"><${Icon} name="stage" size=${40} /></div>`}</div>
    </div>
    <p class="home-kicker">Backstage</p>
    <h1>${title ?? "A new series"}</h1>
    <p class="home-lead">${!w.series ? "Name the series, then plan its seasons, write its episodes and stage them here."
      : ep ? "Write the episodes, stage them on the paper theatre and check every line before it goes out."
      : "Plan the first season's weeks, then write and stage its first episode."}</p>
    <div class="home-go">
      ${!w.series ? html`<a class="button primary" href="#/board">Start the series</a>`
        : ep ? html`<a class="button primary" href=${`#/episode/${ep.id}`} onClick=${onContinue}><${Icon} name="play" size=${16} /> Continue “${epTitle}”</a><a class="button" href="#/board">Open the board</a>`
        : html`<a class="button primary" href="#/board">Plan the first episode</a>`}
    </div>
    ${ep && html`<p class="note">${worked ? `${ep.id} · where you left off, cue ${last.cue} · ${ago(last.at)}`
      : ep.releaseDate ? `${ep.id} · ${ep.releaseDate >= today ? "out" : "came out"} ${new Date(`${ep.releaseDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}${ep.draft ? " · a draft" : ""}` : ep.id}</p>`}
    <nav class="home-links" aria-label="The studio">${links.map(([path, icon, label, n]) => html`<a href=${`#/${path}`}><${Icon} name=${icon} size=${17} />${label}${n !== undefined ? html`<small>${n}</small>` : ""}</a>`)}</nav>
    <p class="home-hint"><kbd>${MOD} K</kbd> finds anything${w.samples ? " · these are the samples, read-only" : ""}</p>
  </section>`;
}
