import {
  KIT,
  LANG
} from "./chunk-Y35JX3JV.js";
import {
  SOUNDS_URL,
  data
} from "./chunk-6PR3AWGB.js";
import {
  mountStage
} from "./chunk-BLASJ6YA.js";

// src/shell/ctx.ts
function parseRoute(hash = location.hash) {
  const h = hash.replace(/^#\/?/, ""), q = h.indexOf("?");
  const path = (q < 0 ? h : h.slice(0, q)).split("/").filter(Boolean).map(decodeURIComponent);
  return { section: path[0] ?? "", path: path.slice(1), query: new URLSearchParams(q < 0 ? "" : h.slice(q + 1)) };
}
var routeHash = (section, path = [], query) => {
  const q = new URLSearchParams(query).toString();
  return `#/${[section, ...path].filter(Boolean).map(encodeURIComponent).join("/")}${q ? `?${q}` : ""}`;
};
var KEY = "sahne-gallery:settings";
var DEFAULTS = { motion: "full", sound: false, captions: true, theme: "auto", width: "fit" };
function loadSettings() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { ...DEFAULTS, ...reduced ? { motion: "still" } : {}, ...s, sound: false };
}
var MAX_STAGES = 6;
var Ctx = class {
  route = parseRoute();
  settings = loadSettings();
  kit = KIT;
  lang = LANG;
  data = data;
  stages = [];
  /** How many live stages this view may have before the shell warns (a contact sheet has ten). */
  maxStages = MAX_STAGES;
  cleanups = [];
  listeners = /* @__PURE__ */ new Set();
  /** Changes settings, applies them to every live stage and remembers them. */
  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try {
      const { sound: _, ...keep } = this.settings;
      localStorage.setItem(KEY, JSON.stringify(keep));
    } catch {
    }
    for (const st of this.stages) this.apply(st);
    for (const f of this.listeners) f(this.settings);
    this.applyPage();
  }
  onSettings(f) {
    this.listeners.add(f);
    this.cleanup(() => this.listeners.delete(f));
  }
  applyPage() {
    const r = document.documentElement;
    if (this.settings.theme === "auto") r.removeAttribute("data-theme");
    else r.dataset.theme = this.settings.theme;
    r.style.setProperty("--frame-max", this.settings.width === "fit" ? "none" : `${this.settings.width}px`);
  }
  apply(st) {
    st.setMotion(this.settings.motion);
    st.setCaptions(this.settings.captions);
    if (st.soundOn !== this.settings.sound) st.setSound(this.settings.sound);
  }
  /** A stage in `el` with the gallery's kit and settings, destroyed when the route changes. */
  mount(el, opts = {}) {
    const st = mountStage(el, { kit: KIT, lang: LANG, motion: this.settings.motion, captions: this.settings.captions, sounds: SOUNDS_URL, ...opts });
    if (this.settings.sound) st.setSound(true);
    this.stages.push(st);
    if (this.stages.length > this.maxStages) console.warn(`gallery: ${this.stages.length} live stages on ${location.hash} (browsers keep about 16 WebGL contexts)`);
    return st;
  }
  /** Destroys a stage before the route changes (a section that swaps one stage for another). */
  unmount(st) {
    st.destroy();
    this.stages = this.stages.filter((s) => s !== st);
  }
  get live() {
    return this.stages.length;
  }
  /** Runs when the route changes. */
  cleanup(f) {
    this.cleanups.push(f);
  }
  /** Changes the route's query in place, without rebuilding the view (a section's controls keep their state in the URL). */
  setQuery(patch) {
    const q = new URLSearchParams(this.route.query);
    for (const [k, v] of Object.entries(patch)) if (v === null || v === void 0 || v === "") q.delete(k);
    else q.set(k, String(v));
    this.route = { ...this.route, query: q };
    history.replaceState(null, "", routeHash(this.route.section, this.route.path, q));
  }
  /** Frees the view: every stage, timer and listener a section left. */
  reset(route) {
    for (const f of this.cleanups.splice(0)) {
      try {
        f();
      } catch (e) {
        console.error(e);
      }
    }
    for (const st of this.stages.splice(0)) st.destroy();
    this.maxStages = MAX_STAGES;
    this.route = route;
  }
};

export {
  parseRoute,
  routeHash,
  Ctx
};
//# sourceMappingURL=chunk-CZRUW744.js.map
