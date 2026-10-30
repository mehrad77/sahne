// #/: what Sahne is, for someone who has never seen it: a short film playing (src/film.ts), what the engine does (each with
// a link to its live demo), the few lines that mount a stage, and what the gallery holds (counted from
// the kit, the engine and the data, so it is always current). The owner's review page is #/dev.

import { CUE_KINDS, STAGING_FIELDS, TIMES, WEATHER, type PieceDef } from "sahne";
import { $, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { live } from "../shell/live.ts";
import { FILM, FILM_EXTRAS, FILM_PLACES, FILM_TITLES } from "../film.ts";
import { textOf } from "sahne-story";

const FEATURES: [string, string, string][] = [
  ["Cut-paper puppets", "People built from a kit of parts: faces that talk and blink, 39 gestures and 14 emotions, walks, carries and idle life, all posed by one rig.", "#/systems/actors"],
  ["A director", "You write who says what. The director picks the gaze, the gesture's timing, the listeners' reactions and the camera shot.", "#/systems/director"],
  ["Light and weather", "Dawn to night and overcast, rain, thunder and fireworks; windows and lamps glow after dark. The art is never redrawn: one shader lights the paper.", "#/systems/light"],
  ["Places from set pieces", "Streets, shops, roofs and waterfronts made of parametric pieces, with crowds, birds and traffic that live in them.", "#/places"],
  ["Sound, made in code", "A synthesizer and a sequencer: sound effects, ambience and music motifs, the browser's voice keeping time with the mouths.", "#/systems/audio"],
  ["Learners act", "Tap, drag, choose or say it aloud. Hints, an accessible list, and tap-to-translate on the bubbles' words.", "#/systems/interact"],
  ["Avatars", "A builder screen and a few hundred bytes of JSON per person; SVG portraits for lists and cards.", "#/systems/avatar"],
  ["Stories", "A story format with turns, choices and acts, its lints and a player, ready for an app to draw.", "#/stories/s1e00"],
];

const QUICK = `import { mountStage } from "sahne";
import kit from "sahne-kit/full";
import tr from "sahne-tr";

const stage = mountStage(el, { kit, lang: tr });
stage.load(script, { cast: { nima, ismail }, places: { bench_shore } });
stage.show(0);
for (let i = 1; i < script.cues.length; i++) await stage.play(i).done;`;

export async function render(host: HTMLElement, ctx: Ctx) {
  const k = ctx.kit;

  // ---- the hero ----
  const hero = $("section", "hero");
  const word = $("h1", "wordmark");
  word.setAttribute("aria-label", "Sahne, Turkish for “stage”");
  word.append($("span", "word"), $("small", "", "Turkish for “stage”"));
  const go = $("div", "ctas");
  const cta = (label: string, href: string, main = false) => { const a = link(label, href); a.className = `cta${main ? " main" : ""}`; return a; };
  const gh = cta("GitHub ↗", "https://github.com/mehrad77/sahne");
  gh.target = "_blank"; gh.rel = "noopener";
  go.append(cta("Get started", "#/docs/start", true), cta("See every system", "#/systems/script"), cta("Play a story", "#/stories/s1e00"), gh);
  hero.append(word, $("p", "tagline", "A paper-theatre stage engine for interactive scenes on the web: cut-paper puppets, lip-sync, light and weather, sound, all drawn in code."), go);
  host.append(hero);
  const stageSlot = $("div", "hero-stage");
  host.append(stageSlot);
  // the film, with a title card at its start and each chapter's caption, as a film's subtitles
  const title = $("div", "film-title"), cap = $("div", "film-cap");
  title.append($("small", "", "Sahne presents"), $("b", "", "Son Vapur"), $("span", "", "The Last Ferry · a film in one script"));
  let capTimer = 0;
  // the samples' extras it casts (an actor whose extra is missing stands in as the kit's default person)
  const extras = new Map((await ctx.data("extras").catch(() => [])).map(x => [x.file.replace(/\.json$/, ""), x]));
  const cast = Object.fromEntries(Object.entries(FILM_EXTRAS).map(([actor, id]) => [actor, extras.get(id)?.avatar ?? ctx.kit.defaultDoc]));
  const names = Object.fromEntries(Object.entries(FILM_EXTRAS).map(([actor, id]) => [actor, textOf(extras.get(id)?.name) ?? actor]));
  // ?chapter=<n> starts the film at its nth chapter (for checking one)
  const chapter = Number(ctx.route.query.get("chapter") ?? 0), starts = [...FILM_TITLES.keys()];
  const film = await live(stageSlot, ctx, FILM, { loop: true, controls: false, preroll: 2600, places: FILM_PLACES, cast, names, start: starts[chapter] ?? 0, onCue: i => {
    if (i === 0 && !chapter) { title.classList.add("on"); setTimeout(() => title.classList.remove("on"), 2800); }
    const t = FILM_TITLES.get(i);
    if (!t) return;
    cap.textContent = t;
    cap.classList.add("on");
    clearTimeout(capTimer);
    capTimer = setTimeout(() => cap.classList.remove("on"), 3200);
  } });
  ctx.cleanup(() => clearTimeout(capTimer));
  film.box.append(title, cap);
  host.append($("p", "note", `Live, not a video: a ${FILM.cues.length}-cue script in ${FILM_TITLES.size} places, directed and drawn in your browser as it plays. Turn on sound in the top bar.`));

  // ---- what it is ----
  host.append($("h2", "", "What it is"));
  for (const t of [
    "Sahne plays illustrated dialogue scenes the way a paper theatre would: flat, hand-cut figures in layers, lit like a stage. An app writes a script (who speaks, to whom, with what gesture) and Sahne directs and performs it: the timing, the gaze, the shots, the mouths, the sounds.",
    "Everything is drawn in code from a kit (people, set pieces, props, sounds and music), so a whole city of scenes costs a few hundred kilobytes, not a folder of images. The engine has no dependencies and renders with WebGL2, with an SVG backend for stills.",
    "It is built for language learning. Sahne is the stage of Kumru, an app for learning Turkish, and its Turkish plugin times the mouths from the spelling. The engine itself knows no language and no app.",
  ]) host.append($("p", "prose-p", t));

  // ---- what it does ----
  host.append($("h2", "", "What it does"));
  const feats = $("div", "cards");
  for (const [title, text, hash] of FEATURES) {
    const a = link("", hash);
    a.className = "card";
    a.append($("b", "", title), $("small", "", text));
    feats.append(a);
  }
  host.append(feats);

  // ---- quick start ----
  host.append($("h2", "", "In a few lines"));
  const pre = $("pre", "code");
  pre.textContent = QUICK;
  const more = $("p", "note");
  more.append("The whole walk-through, with a scene that plays: ", link("Your first scene", "#/docs/start"), ". The design, the formats and the budgets: ", link("DESIGN.md", "#/docs/design"), ".");
  host.append(pre, more);

  // ---- the numbers, from the kit and the engine ----
  const defs = new Set<PieceDef>([...Object.values(k.set), ...Object.values(k.props)]);
  const variants = [...defs].reduce((n, d) => n + Object.keys(d.variants ?? {}).length, 0);
  const sounds = Object.values(k.sounds ?? {});
  const [places, drafts, world] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("drafts").catch(() => []), ctx.data("world").catch(() => [])]);
  const planned = world.filter(w => !w.placeholder).length;
  const stats: [string, number | string, string][] = [
    ["set generators", defs.size, "#/kit/set"],
    ["their variants", variants, "#/kit/set"],
    ["set pieces / props", `${Object.keys(k.set).length} / ${Object.keys(k.props).length}`, "#/kit/set"],
    ["character parts", Object.keys(k.parts).length, "#/kit/people"],
    ["gestures", Object.keys(k.gestures).length, "#/kit/gestures"],
    ["emotions", Object.keys(k.face.emotions).length, "#/kit/gestures"],
    ["sound effects", sounds.filter(s => !s.loop).length, "#/kit/sound"],
    ["ambience loops", sounds.filter(s => s.loop).length, "#/kit/sound"],
    ["music motifs", Object.keys(k.motifs ?? {}).length, "#/kit/sound"],
    ["places built", planned ? `${places.length} of ${planned}` : places.length, "#/places"],
    ["stories", drafts.length, "#/stories"],
    ["cue kinds · staging fields", `${CUE_KINDS.length} · ${STAGING_FIELDS.length}`, "#/systems/script"],
    ["times · weathers", `${Object.keys(TIMES).length} · ${Object.keys(WEATHER).length}`, "#/systems/light"],
  ];
  const grid = $("div", "cards stats");
  for (const [label, n, hash] of stats) {
    const a = link("", hash);
    a.className = "card";
    a.append($("b", "", String(n)), $("small", "", label));
    grid.append(a);
  }
  host.append($("h2", "", "In the gallery"), grid);

  const foot = $("p", "note");
  foot.append("Code MIT, art CC BY 4.0, except Kerim, Kumru's mascot, whose art is all rights reserved. ", link("Contributing", "#/docs/contributing"), " · ", link("For maintainers", "#/dev"));
  host.append(foot);
}
