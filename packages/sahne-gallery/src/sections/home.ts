// #/: Sahne for someone who has never seen it: a short film playing (src/film.ts), why it exists, how a script becomes
// a scene, the packages and what each is for, what's new, what the engine does (each with a link to its live demo), the
// few lines that mount a stage, and what the gallery holds (counted from the kit, the engine and the data, so it is
// always current). The owner's review page is #/dev.

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

/** Why Sahne exists: the problem each answers. */
const WHY: [string, string][] = [
  ["A scene you can change like text", "An illustrated, animated dialogue usually takes a writer, an illustrator, an animator and an editor, and every fix goes round all four again. In Sahne the script is the scene: change a line, a gesture or a language, and the scene changes with it."],
  ["Light enough for any page", "Nothing is a video and nothing is a painted image. People, places and sounds are drawn in code from a kit, so a city of scenes weighs a few hundred kilobytes and plays on a phone."],
  ["Made with the people who write", "Writers, directors and reviewers work in Backstage, a studio beside a live stage. AI can draft, stage and translate there, but a person approves every word before a learner sees it."],
];

/** How a scene is made, one step at a time. */
const HOW: [string, string, string][] = [
  ["1", "Write", "Who says what, to whom, where. A story is a few hundred bytes of JSON: written in Backstage, by an agent, or by your app."],
  ["2", "Direct", "The director reads the script and decides the rest: where people look, when the gesture lands, how listeners react, which shot."],
  ["3", "Perform", "The stage draws the performance with cut-paper puppets in WebGL2: mouths timed from the spelling by a language plugin, light, weather, sound."],
  ["4", "Act", "The learner taps, drags, chooses or answers aloud, and the scene answers back. Or, in a watch-only episode, simply watches."],
];

/** The packages, by what they are for, each with its doc. */
const PACKAGES: [string, string, string, string][] = [
  ["sahne", "The engine", "Formats, the director, the rig, faces, the WebGL2 paper stage and an SVG one for stills, audio and interaction. No dependencies.", "#/docs/engine"],
  ["sahne-kit", "The art", "People, set pieces, props, animals, sounds and music, all drawn in code; and the tools to draw more as data.", "#/docs/kit"],
  ["sahne-tr · en · de · fa", "The languages", "Turkish, English, German and Persian: mouths timed from the spelling, numbers said aloud, spoken answers heard.", "#/docs/turkish"],
  ["sahne-story", "The stories", "Series, seasons and episodes in any language, their checks and lints, places, and the player that turns a story into scripts.", "#/docs/stories"],
  ["sahne-lesson", "The lessons", "A story plugin: grammar spots, target words, glosses and a quiz, for a series that teaches.", "#/docs/lesson"],
  ["sahne-backstage", "The studio", "Backstage: write, stage, translate and review episodes beside a live stage, with an assistant and agents over MCP.", "#/docs/backstage"],
  ["sahne-gallery", "This site", "Every system with a live demo, the kit, the places, the docs, and the project's checks.", "#/docs/gallery"],
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
  go.append(cta("Get started", "#/get-started", true), cta("What's new: Backstage", "#/new"), cta("Play a story", "#/stories/s1e00"), gh);
  hero.append(word, $("p", "tagline", "Illustrated, interactive dialogue scenes for the web, written like a screenplay and played like a paper theatre: cut-paper puppets, lip-sync in four languages, light, weather and sound, all drawn in code."), go);
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

  // ---- why ----
  host.append($("h2", "", "Why Sahne"));
  const why = $("div", "cards why");
  for (const [title, text] of WHY) { const c = $("div", "card"); c.append($("b", "", title), $("p", "", text)); why.append(c); }
  host.append(why);
  host.append($("p", "prose-p", "It was made for language learning: Sahne is the stage of Kumru, an app for practising Turkish, where every lesson is a scene. The engine itself knows no language and no app."));

  // ---- how ----
  host.append($("h2", "", "How a script becomes a scene"));
  const how = $("ol", "how");
  for (const [n, title, text] of HOW) { const li = $("li"); li.append($("span", "n", n), $("b", "", title), $("small", "", text)); how.append(li); }
  host.append(how);
  const howMore = $("p", "note");
  howMore.append("Walk through it with a scene that plays: ", link("Your first scene", "#/docs/start"), ". Every system, with a live demo: ", link("Explore the engine", "#/systems/script"), ".");
  host.append(howMore);

  // ---- what's new ----
  const fresh = link("", "#/new");
  fresh.className = "card news";
  fresh.append($("small", "", "What's new"), $("b", "", "Backstage: a studio for the whole series"), $("span", "", "Write, stage, translate and review episodes beside a live stage, with an assistant and agents you can watch and undo. And English, German and Persian, story plugins, and more kit."));
  host.append(fresh);

  // ---- the packages ----
  host.append($("h2", "", "The packages"));
  host.append($("p", "note", "Sahne is a set of small packages: take the engine alone, or the whole stack up to the studio."));
  const pk = $("div", "cards packages");
  for (const [name, role, text, hash] of PACKAGES) {
    const a = link("", hash);
    a.className = "card";
    a.append($("code", "", name), $("b", "", role), $("small", "", text));
    pk.append(a);
  }
  host.append(pk);

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
