// The engine's systems, one live demo each (`#/systems/<id>`). Each entry says what it demos: the
// DESIGN.md sections, and in `covers` every engine vocabulary entry it shows (a cue kind, a staging
// field, an env verb, a camera, a particle …). test/coverage.test.ts fails when a vocabulary entry is
// in no demo's `covers`, or a file in this folder is not listed here, so a new engine feature can't land
// without a place in the gallery. Pure data: the demos themselves are loaded when opened.

import type { Ctx } from "../shell/ctx.ts";

export interface SystemDemo {
  id: string;
  title: string;
  group: "Script" | "Stage" | "World" | "People" | "Words" | "Sound" | "Engine";
  /** One line: what it shows. */
  about: string;
  /** DESIGN.md sections it demos (`§6.7`). */
  design: string[];
  /** Vocabulary entries it shows, as `<kind>:<value>` (`cue:scene`, `env:thunder`, `cam:follow`, `emit:flame`, `time:dusk` …; see src/coverage.ts). */
  covers: string[];
  load: () => Promise<{ build(host: HTMLElement, ctx: Ctx): void | Promise<void> }>;
}

const each = (kind: string, values: string) => values.split(" ").map(v => `${kind}:${v}`);

export const SYSTEMS: SystemDemo[] = [
  // ---- the script ----
  {
    id: "script", title: "The cue lab", group: "Script", design: ["§5.6"],
    about: "Write a cue (any kind, any staging field) and play it, seek it, pause it, finish it: the script language, live",
    covers: [...each("cue", "scene line beat act overlay"), ...each("staging", "to emo do at n loop move obj link react cam via voice sfx env frame tempo on costume")],
    load: () => import("./script.ts"),
  },
  {
    id: "director", title: "The director", group: "Script", design: ["§5.6", "§7"],
    about: "What the engine stages on its own: who is addressed, gaze, a gesture's stroke on its word, reactions after the line, the camera, the sounds; a glance",
    covers: ["staging:to", "staging:on", "staging:link", "staging:react", "staging:tempo"],
    load: () => import("./director.ts"),
  },
  // ---- the stage ----
  {
    id: "camera", title: "Camera", group: "Stage", design: ["§6.6"],
    about: "Every framing (wide, two, single, close, objects, follow), headroom for bubbles, depth of field and haze",
    covers: each("cam", "wide two single close obj ots follow split photo"),
    load: () => import("./camera.ts"),
  },
  {
    id: "light", title: "Light and time of day", group: "Stage", design: ["§6.5"],
    about: "Six times, slow changes, weather, thunder, the lights' switch, a city lighting up window by window, the night sky and the moon",
    covers: [...each("time", "dawn day golden dusk night overcast"), ...each("weather", "clear grey rain"), ...each("env", "time weather thunder lights_on lights_off")],
    load: () => import("./light.ts"),
  },
  {
    id: "particles", title: "Particles", group: "Stage", design: ["§6.7"],
    about: "Rain in and out, steam, smoke, a candle's flame, breath in the cold, fireworks; exact under seeking, still under Still",
    covers: [...each("emit", "steam smoke flame"), "env:fireworks", "env:state", "staging:do"],
    load: () => import("./particles.ts"),
  },
  // ---- the world ----
  {
    id: "places", title: "Places, sites and states", group: "World", design: ["§5.1", "§5.5"],
    about: "A place's states (a group, a toggle, a fade), a site's places with props carried and no motif, the wide band, a vehicle's clock that runs, a train that stops and a story that stops it",
    covers: ["cue:scene", "env:state", "env:stop", "env:depart"],
    load: () => import("./places.ts"),
  },
  {
    id: "props", title: "Props", group: "World", design: ["§5.5", "§6.8"],
    about: "show, hide, give (a stack split), take, add, place, set (a clock's time, a label), go (along marks); kept props; words on props",
    covers: each("obj", "show hide give take add own place set go"),
    load: () => import("./props.ts"),
  },
  {
    id: "moves", title: "Moves", group: "World", design: ["§5.4", "§7"],
    about: "Walk, run, hop, enter and exit through a door, fly; stairs climbed step by step; Kerim on the perch, in the air, flying alongside",
    covers: each("move", "walk run hop enter exit fly"),
    load: () => import("./moves.ts"),
  },
  {
    id: "life", title: "The life of a place", group: "World", design: ["§6.9"],
    about: "Flats that move on their own (scroll, path, sway, blink), flats by weather, time or state, crowds, birds and a cat",
    covers: each("motion", "scroll path sway blink"),
    load: () => import("./life.ts"),
  },
  // ---- people ----
  {
    id: "actors", title: "Actors", group: "People", design: ["§6.3", "§6.4", "§7"],
    about: "Gestures (with n and loops), emotions, the mouth, hand shapes, reaching, the paper flip and turn, idle life, costumes",
    covers: ["staging:emo", "staging:do", "staging:n", "staging:loop", "staging:at", "staging:costume"],
    load: () => import("./actors.ts"),
  },
  {
    id: "avatar", title: "Avatar documents", group: "People", design: ["§5.2", "§5.3", "§10"],
    about: "normalize and its notes, hostile documents, the 2 KB cap, trust, compose's notes, a look over a body",
    covers: [],
    load: () => import("./avatar.ts"),
  },
  {
    id: "still", title: "Portraits (the still backend)", group: "People", design: ["§10"],
    about: "SVG portraits at every framing and size, emotions, the back, silhouettes, the cache, a list of fifty, the fallback when WebGL is lost",
    covers: [],
    load: () => import("./still.ts"),
  },
  // ---- words ----
  {
    id: "overlay", title: "Bubbles and the narrator", group: "Words", design: ["§6.8"],
    about: "Speech bubbles and their tails, whisper, silent and mouthed lines, sound words, the narrator's window, at phone and desktop widths",
    covers: [...each("voice", "normal whisper silent mouthing"), "staging:voice", "staging:sfx"],
    load: () => import("./overlay.ts"),
  },
  {
    id: "gloss", title: "Tap to translate", group: "Words", design: ["§6.8"],
    about: "The bubbles' words as buttons: a tap shows the A1 word in English and Persian",
    covers: [],
    load: () => import("./gloss.ts"),
  },
  {
    id: "interact", title: "The learner acts", group: "Words", design: ["§9"],
    about: "tap, drag, go and choose; the hint and the shown answer; explore; the accessible list; the events",
    covers: [...each("act", "tap drag go choose"), "cue:act"],
    load: () => import("./interact.ts"),
  },
  {
    id: "listen", title: "Say it aloud", group: "Words", design: ["§9"],
    about: "Listening for a line: every state and error (with a pretend microphone), and the real one where the browser can",
    covers: [],
    load: () => import("./listen.ts"),
  },
  // ---- sound ----
  {
    id: "audio", title: "The sound engine", group: "Sound", design: ["§8.1", "§8.4", "§8.5"],
    about: "Four buses and their volumes, ducking under a line, the browser's voice and the speech clock, captions, a place's beds crossfading",
    covers: ["staging:sfx"],
    load: () => import("./audio.ts"),
  },
  // ---- the engine ----
  {
    id: "perf", title: "Performance", group: "Engine", design: ["§6.1", "§6.2"],
    about: "The stage's own numbers (frame, pose, atlas, texture), stress runs, the code budgets of every package and set family",
    covers: [],
    load: () => import("./perf.ts"),
  },
];
