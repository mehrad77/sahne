// src/systems/registry.ts
var each = (kind, values) => values.split(" ").map((v) => `${kind}:${v}`);
var SYSTEMS = [
  // ---- the script ----
  {
    id: "script",
    title: "The cue lab",
    group: "Script",
    design: ["\xA75.6"],
    about: "Write a cue (any kind, any staging field) and play it, seek it, pause it, finish it: the script language, live",
    covers: [...each("cue", "scene line beat act overlay"), ...each("staging", "to emo do at n loop move obj link react cam via voice sfx env frame tempo on costume")],
    load: () => import("./script-3IIJGIZY.js")
  },
  {
    id: "director",
    title: "The director",
    group: "Script",
    design: ["\xA75.6", "\xA77"],
    about: "What the engine stages on its own: who is addressed, gaze, a gesture's stroke on its word, reactions after the line, the camera, the sounds; a glance",
    covers: ["staging:to", "staging:on", "staging:link", "staging:react", "staging:tempo"],
    load: () => import("./director-C5XJR2E3.js")
  },
  // ---- the stage ----
  {
    id: "camera",
    title: "Camera",
    group: "Stage",
    design: ["\xA76.6"],
    about: "Every framing (wide, two, single, close, objects, follow), headroom for bubbles, depth of field and haze",
    covers: each("cam", "wide two single close obj ots follow split photo"),
    load: () => import("./camera-R3YU4WDA.js")
  },
  {
    id: "light",
    title: "Light and time of day",
    group: "Stage",
    design: ["\xA76.5"],
    about: "Six times, slow changes, weather, thunder, the lights' switch, a city lighting up window by window, the night sky and the moon",
    covers: [...each("time", "dawn day golden dusk night overcast"), ...each("weather", "clear grey rain"), ...each("env", "time weather thunder lights_on lights_off")],
    load: () => import("./light-YCDD5HCG.js")
  },
  {
    id: "particles",
    title: "Particles",
    group: "Stage",
    design: ["\xA76.7"],
    about: "Rain in and out, steam, smoke, a candle's flame, breath in the cold, fireworks; exact under seeking, still under Still",
    covers: [...each("emit", "steam smoke flame"), "env:fireworks", "env:state", "staging:do"],
    load: () => import("./particles-7XZK3YD2.js")
  },
  // ---- the world ----
  {
    id: "places",
    title: "Places, sites and states",
    group: "World",
    design: ["\xA75.1", "\xA75.5"],
    about: "A place's states (a group, a toggle, a fade), a site's places with props carried and no motif, the wide band, a vehicle's clock that runs, a train that stops and a story that stops it",
    covers: ["cue:scene", "env:state", "env:stop", "env:depart"],
    load: () => import("./places-FSTH5ISX.js")
  },
  {
    id: "props",
    title: "Props",
    group: "World",
    design: ["\xA75.5", "\xA76.8"],
    about: "show, hide, give (a stack split), take, add, place, set (a clock's time, a label), go (along marks); kept props; words on props",
    covers: each("obj", "show hide give take add own place set go"),
    load: () => import("./props-JIHJQGBV.js")
  },
  {
    id: "moves",
    title: "Moves",
    group: "World",
    design: ["\xA75.4", "\xA77"],
    about: "Walk, run, hop, enter and exit through a door, fly; stairs climbed step by step; Kerim on the perch, in the air, flying alongside",
    covers: each("move", "walk run hop enter exit fly"),
    load: () => import("./moves-USKHUD43.js")
  },
  {
    id: "life",
    title: "The life of a place",
    group: "World",
    design: ["\xA76.9"],
    about: "Flats that move on their own (scroll, path, sway, blink), flats by weather, time or state, crowds, birds and a cat",
    covers: each("motion", "scroll path sway blink"),
    load: () => import("./life-DRJFQ4E3.js")
  },
  // ---- people ----
  {
    id: "actors",
    title: "Actors",
    group: "People",
    design: ["\xA76.3", "\xA76.4", "\xA77"],
    about: "Gestures (with n and loops), emotions, the mouth, hand shapes, reaching, the paper flip and turn, idle life, costumes",
    covers: ["staging:emo", "staging:do", "staging:n", "staging:loop", "staging:at", "staging:costume"],
    load: () => import("./actors-WLR5JFD4.js")
  },
  {
    id: "avatar",
    title: "Avatar documents",
    group: "People",
    design: ["\xA75.2", "\xA75.3", "\xA710"],
    about: "normalize and its notes, hostile documents, the 2 KB cap, trust, compose's notes, a look over a body",
    covers: [],
    load: () => import("./avatar-TMUZO7JZ.js")
  },
  {
    id: "still",
    title: "Portraits (the still backend)",
    group: "People",
    design: ["\xA710"],
    about: "SVG portraits at every framing and size, emotions, the back, silhouettes, the cache, a list of fifty, the fallback when WebGL is lost",
    covers: [],
    load: () => import("./still-FHJJWA2H.js")
  },
  // ---- words ----
  {
    id: "overlay",
    title: "Bubbles and the narrator",
    group: "Words",
    design: ["\xA76.8"],
    about: "Speech bubbles and their tails, whisper, silent and mouthed lines, sound words, the narrator's window, at phone and desktop widths",
    covers: [...each("voice", "normal whisper silent mouthing"), "staging:voice", "staging:sfx"],
    load: () => import("./overlay-EHFTYOCM.js")
  },
  {
    id: "gloss",
    title: "Tap to translate",
    group: "Words",
    design: ["\xA76.8"],
    about: "The bubbles' words as buttons: a tap shows the A1 word in English and Persian",
    covers: [],
    load: () => import("./gloss-W4YLB53V.js")
  },
  {
    id: "interact",
    title: "The learner acts",
    group: "Words",
    design: ["\xA79"],
    about: "tap, drag, go and choose; the hint and the shown answer; explore; the accessible list; the events",
    covers: [...each("act", "tap drag go choose"), "cue:act"],
    load: () => import("./interact-JVXRQZTP.js")
  },
  {
    id: "listen",
    title: "Say it aloud",
    group: "Words",
    design: ["\xA79"],
    about: "Listening for a line: every state and error (with a pretend microphone), and the real one where the browser can",
    covers: [],
    load: () => import("./listen-HF6J2JQS.js")
  },
  // ---- sound ----
  {
    id: "audio",
    title: "The sound engine",
    group: "Sound",
    design: ["\xA78.1", "\xA78.4", "\xA78.5"],
    about: "Four buses and their volumes, ducking under a line, the browser's voice and the speech clock, captions, a place's beds crossfading",
    covers: ["staging:sfx"],
    load: () => import("./audio-M6OUWTUV.js")
  },
  // ---- the engine ----
  {
    id: "perf",
    title: "Performance",
    group: "Engine",
    design: ["\xA76.1", "\xA76.2"],
    about: "The stage's own numbers (frame, pose, atlas, texture), stress runs, the code budgets of every package and set family",
    covers: [],
    load: () => import("./perf-YF23QK3H.js")
  }
];

export {
  SYSTEMS
};
//# sourceMappingURL=chunk-MBHY5FZF.js.map
