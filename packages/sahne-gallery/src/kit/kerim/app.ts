// Kerim as an app draws her, for #/kit/kerim: her art and CSS from the kit (ctx.data("kerim"), read from
// disk by serve.mjs on each request), every mood and pose at the app's sizes on its light and dark
// backgrounds, the head crop in the stage's narrator window, and the kit's converted copy beside the app's.

import { Path, groupSvg, SVG_BASE, type Group, type Shape } from "sahne";
import { KERIM_PARTS, type KShape } from "../../../../sahne-kit/src/kerim/art.gen.ts";
import { $, css } from "../../shell/dom.ts";
import type { KerimPage } from "../../shell/data.ts";

/** The app's CSS section for her, her shadow per panel, and the narrator window's head (from the stage's overlay: blink, beak and nod while she talks). */
export function kerimCss(K: KerimPage) {
  css("kerim-app", `${K.css}
.kv-light { --k-shadow: ${K.shadow.light}; }
.kv-dark { --k-shadow: ${K.shadow.dark}; }
.kv-still .kerim, .kv-still .kerim *, .kv-still .kv-head * { animation: none !important; transition: none !important; }`);
  css("kerim-view", `
.kv-panel { border-radius: 14px; padding: 12px 16px 16px; border: 1px solid var(--line); margin: 0 0 14px; }
.kv-light { background: #FFF8EC; color: #2B2420; }
.kv-dark { background: #191A12; color: #EFE7DC; }
.kv-panel h2 { font-size: 15px; margin: 2px 0 6px; }
.kv-row h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .65; margin: 14px 0 6px; }
.kv-cells { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: flex-end; }
.kv-cell { margin: 0; display: grid; justify-items: center; gap: 4px; }
.kv-cell[title] { cursor: pointer; }
.kv-cell figcaption { font-size: 11px; opacity: .65; }
.kv-win { display: block; border-radius: 50%; overflow: hidden; cursor: pointer; background: radial-gradient(circle at 50% 35%, #BFE3EA, #6FA9B8); box-shadow: 0 0 0 4px #FFF4DA, 0 2px 6px rgba(40, 24, 16, .3); }
.kv-svg { display: block; }
.kv-svg svg { width: 100%; height: 100%; display: block; }
.kv-svg.round { border-radius: 50%; overflow: hidden; }
.kv-head { display: block; width: 100%; height: 100%; }
.kv-head svg { display: block; width: 100%; height: 100%; overflow: visible; }
.kv-head .k-head, .kv-head .k-beak-lo { transform-box: view-box; }
.kv-head .k-head { transform-origin: 57px 48px; }
.kv-head .k-beak-lo { transform-origin: 66.6px 41.5px; }
.kv-head .k-lid { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); }
.kv-head.talk .k-beak-lo { transform: rotate(22deg); }
@media (prefers-reduced-motion: no-preference) {
  .kv-head .k-lid { animation: kv-blink 4.8s infinite; }
  .kv-head.talk .k-beak-lo { animation: kv-beak .2s ease-in-out infinite alternate; }
  .kv-head.talk .k-head { animation: kv-nod .42s ease-in-out infinite alternate; }
}
@keyframes kv-blink { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
@keyframes kv-beak { from { transform: none; } to { transform: rotate(22deg); } }
@keyframes kv-nod { from { transform: rotate(-2deg); } to { transform: rotate(3deg) translateY(.5px); } }
`);
}

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** The app's mood switch (setMood in app/ui/kerim/kerim.ts): one-shot moods settle to happy unless held. */
function setMood(K: KerimPage, p: HTMLElement, mood: string, hold = false) {
  clearTimeout(timers.get(p));
  p.classList.remove(...K.moods);
  void p.offsetWidth;
  p.classList.add(mood);
  const back = K.once[mood];
  if (back && !hold) timers.set(p, setTimeout(() => { p.classList.remove(mood); p.classList.add("happy"); }, back));
}

/** The app's pup() (app/ui/kerim/kerim.ts), minus its bubble helpers: a span.kerim.<mood>.pose-<pose>. */
function pup(K: KerimPage, mood: string, size: number, o: { pose?: string; enter?: boolean; hold?: boolean } = {}) {
  const pose = o.pose ?? "perched";
  const s = $("span", `kerim pose-${pose}`);
  if (size) s.style.cssText = `width:${size}px;height:${size}px`;
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", `Kerim, ${mood}`);
  s.innerHTML = pose === "head" ? K.head : K.art; // trusted: the kit's own art, read by the gallery's server
  if (o.enter) {
    s.classList.add("enter-land", K.once[mood] ? "happy" : mood);
    setTimeout(() => { s.classList.remove("enter-land"); setMood(K, s, mood, o.hold); }, K.land);
  } else setMood(K, s, mood, o.hold);
  return s;
}

/** A labelled cell; with a mood, a click replays it as the app would (one-shots settle to happy). */
export function cell(k: HTMLElement, label: string, replay?: () => void) {
  const f = $("figure", "kv-cell");
  f.append(k, $("figcaption", "", label));
  if (replay) { f.title = "Click to replay"; f.onclick = replay; }
  return f;
}

export function row(title: string, cells: HTMLElement[]) {
  const r = $("section", "kv-row"), c = $("div", "kv-cells");
  c.append(...cells);
  r.append($("h3", "", title), c);
  return r;
}

/** How long she moves the beak for a line, as the app's companion does (talkMs in app/ui/kerim/kerim.ts). */
const talkMs = (text: string) => Math.max(900, Math.min(4200, 500 + text.length * 55));

/** The stage's narrator window (packages/sahne overlay): the head crop in a round sky window; a click and she talks. */
function narratorWindow(K: KerimPage, d: number) {
  const w = $("span", "kv-win"), art = $("span", "kv-head");
  w.style.cssText = `width:${d}px;height:${d}px`;
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", "Kerim");
  art.innerHTML = K.head; // trusted: the kit's own art
  w.append(art);
  w.onclick = () => {
    clearTimeout(timers.get(art));
    art.classList.add("talk");
    timers.set(art, setTimeout(() => art.classList.remove("talk"), talkMs("Yavaş yavaş, adım adım.")));
  };
  w.title = "Click: she talks";
  return w;
}

// ---- the stage's copy: sahne-kit/src/kerim/art.gen.ts, converted from the same art (kerim/build.ts) ----
const pathOf = (d: KShape["d"]) => { const p = new Path(); p.cmds = d.map(c => [...c] as typeof c); return p; };
/** A converted shape as kit shapes: the app's rim under the fill (paint-order stroke), or a stroke over it. */
function shapes(s: KShape): Shape[] {
  const path = pathOf(s.d), op = s.opacity === undefined ? {} : { opacity: s.opacity };
  const fill: Shape[] = s.fill ? [{ path, fill: s.fill, flat: true, ...op }] : [];
  const stroke: Shape[] = s.stroke ? [{ path, stroke: { color: s.stroke, width: s.width ?? 1, ...(s.cap ? { cap: s.cap } : {}), ...(s.dash ? { dash: s.dash } : {}) }, flat: true, ...op }] : [];
  return s.under ? [...stroke, ...fill] : [...fill, ...stroke];
}
/** Kerim as the kit draws her: perched (the parts shown by default) or flying (wings spread, the tail fanned, legs tucked). */
function converted(size: number, flying = false) {
  const swap: Record<string, string> = { "wing.fold": "wing.spread", tail: "tail@fan" };
  const drop = new Set(["legs", "head.eye.calm", "head.eye2.calm"]);
  const ids = KERIM_PARTS.filter(p => !p.hidden).map(p => p.id).flatMap(id => !flying ? [id] : drop.has(id) ? [] : id === "wingFar" ? [] : id === "body" ? ["wingFar", id] : [swap[id] ?? id]);
  const by = new Map(KERIM_PARTS.map(p => [p.id, p]));
  const g: Group = { edge: 0, shapes: ids.flatMap(id => by.get(id)!.shapes.flatMap(shapes)) };
  const el = $("span", "kerim");
  el.style.cssText = `width:${size}px;height:${size}px`;
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g${SVG_BASE}>${groupSvg(g, { id: `kvg${size}${flying ? "f" : ""}_`, tiles: new Map(), base: true })}</g></svg>`;
  return el;
}

/** Every mood and pose at the app's sizes, on the app's light or dark background. */
export function panel(K: KerimPage, theme: "light" | "dark") {
  const p = $("div", `kv-panel kv-${theme}`);
  const mood = (m: string, size: number, o: { pose?: string } = {}) => { const k = pup(K, m, size, { ...o, hold: true }); return cell(k, m, () => setMood(K, k, m)); };
  p.append($("h2", "", theme === "light" ? "The app, light (#FFF8EC)" : "The app, dark (#191A12)"));
  p.append(row("Perched, at the app's sizes", [cell(pup(K, "idle", 130, { pose: "hero" }), "hero 130"), ...[96, 88, 64, 44, 30].map(n => cell(pup(K, "idle", n), `${n}`))]));
  p.append(row("Head crop (app bar, gate, lines)", [96, 64, 44, 34, 30, 16].map(n => cell(pup(K, "idle", n, { pose: "head" }), `${n}`))));
  p.append(row("Moods, held (click one to replay it as the app does)", K.moods.map(m => mood(m, 96))));
  p.append(row("Moods on the head", K.moods.map(m => mood(m, 64, { pose: "head" }))));
  p.append(row("Moods at 44", K.moods.map(m => mood(m, 44))));
  const talk = pup(K, "idle", 96), talkHead = pup(K, "idle", 64, { pose: "head" });
  talk.classList.add("talk"); talkHead.classList.add("talk");
  const land = () => { const k = pup(K, "happy", 96, { enter: true }); const c = cell(k, "landing (click)", () => c.replaceWith(land())); return c; };
  p.append(row("Poses", [cell(pup(K, "happy", 96, { pose: "flying" }), "flying"), cell(talk, "talk"), cell(talkHead, "talk, head"), land()]));
  p.append(row("The stage's converted copy beside the app's own", [
    cell(pup(K, "idle", 96, { hold: true }), "app 96"), cell(converted(96), "stage 96"),
    cell(pup(K, "idle", 44, { hold: true }), "app 44"), cell(converted(44), "stage 44"),
    cell(pup(K, "happy", 96, { pose: "flying", hold: true }), "app flying"), cell(converted(96, true), "stage flying"),
  ]));
  p.append(row("Narrator window on the stage (click: she talks)", [100, 64, 40].map(n => cell(narratorWindow(K, n), `${n}`))));
  return p;
}
