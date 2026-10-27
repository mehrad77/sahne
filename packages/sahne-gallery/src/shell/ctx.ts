// What every section gets from the shell (`Ctx`): the route it is showing, the gallery-wide settings
// (motion, sound, captions, theme, stage width), stages that follow those settings and are freed when
// the route changes, and the data files.

import { mountStage, type Motion, type Stage, type StageOptions } from "sahne";
import { KIT, LANG } from "./kit.ts";
import { data, SOUNDS_URL } from "./data.ts";

/** Where the gallery is: `#/<section>/<path…>?<query>`. */
export interface Route { section: string; path: string[]; query: URLSearchParams }

export function parseRoute(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, ""), q = h.indexOf("?");
  const path = (q < 0 ? h : h.slice(0, q)).split("/").filter(Boolean).map(decodeURIComponent);
  return { section: path[0] ?? "", path: path.slice(1), query: new URLSearchParams(q < 0 ? "" : h.slice(q + 1)) };
}
export const routeHash = (section: string, path: string[] = [], query?: URLSearchParams | Record<string, string>) => {
  const q = new URLSearchParams(query).toString();
  return `#/${[section, ...path].filter(Boolean).map(encodeURIComponent).join("/")}${q ? `?${q}` : ""}`;
};

/** The gallery-wide switches in the top bar. */
export interface Settings {
  motion: Motion;
  sound: boolean;
  captions: boolean;
  theme: "auto" | "light" | "dark";
  /** The widest a stage frame may be: the phone and the desktop the camera check measures (place-check.ts), or the view's width. */
  width: "fit" | "390" | "1100";
}
const KEY = "sahne-gallery:settings";
const DEFAULTS: Settings = { motion: "full", sound: false, captions: true, theme: "auto", width: "fit" };

function loadSettings(): Settings {
  let s: Partial<Settings> = {};
  try { s = JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { /* no storage: the defaults */ }
  // reduced motion asks for Still, as an app would; sound always starts off (a browser wants a tap first)
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { ...DEFAULTS, ...(reduced ? { motion: "still" } : {}), ...s, sound: false };
}

/** Live stages past this many are a sign a section mounts too many: browsers keep about 16 WebGL contexts. */
export const MAX_STAGES = 6;

export class Ctx {
  route: Route = parseRoute();
  settings: Settings = loadSettings();
  readonly kit = KIT;
  readonly lang = LANG;
  readonly data = data;
  private stages: Stage[] = [];
  /** How many live stages this view may have before the shell warns (a contact sheet has ten). */
  maxStages = MAX_STAGES;
  private cleanups: (() => void)[] = [];
  private listeners = new Set<(s: Settings) => void>();

  /** Changes settings, applies them to every live stage and remembers them. */
  setSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    try { const { sound: _, ...keep } = this.settings; localStorage.setItem(KEY, JSON.stringify(keep)); } catch { /* not remembered */ }
    for (const st of this.stages) this.apply(st);
    for (const f of this.listeners) f(this.settings);
    this.applyPage();
  }
  onSettings(f: (s: Settings) => void) { this.listeners.add(f); this.cleanup(() => this.listeners.delete(f)); }
  applyPage() {
    const r = document.documentElement;
    if (this.settings.theme === "auto") r.removeAttribute("data-theme"); else r.dataset.theme = this.settings.theme;
    r.style.setProperty("--frame-max", this.settings.width === "fit" ? "none" : `${this.settings.width}px`);
  }
  private apply(st: Stage) {
    st.setMotion(this.settings.motion);
    st.setCaptions(this.settings.captions);
    if (st.soundOn !== this.settings.sound) st.setSound(this.settings.sound);
  }

  /** A stage in `el` with the gallery's kit and settings, destroyed when the route changes. */
  mount(el: HTMLElement, opts: Partial<StageOptions> = {}): Stage {
    const st = mountStage(el, { kit: KIT, lang: LANG, motion: this.settings.motion, captions: this.settings.captions, sounds: SOUNDS_URL, ...opts });
    if (this.settings.sound) st.setSound(true);
    this.stages.push(st);
    if (this.stages.length > this.maxStages) console.warn(`gallery: ${this.stages.length} live stages on ${location.hash} (browsers keep about 16 WebGL contexts)`);
    return st;
  }
  /** Destroys a stage before the route changes (a section that swaps one stage for another). */
  unmount(st: Stage) { st.destroy(); this.stages = this.stages.filter(s => s !== st); }
  get live() { return this.stages.length; }

  /** Runs when the route changes. */
  cleanup(f: () => void) { this.cleanups.push(f); }

  /** Changes the route's query in place, without rebuilding the view (a section's controls keep their state in the URL). */
  setQuery(patch: Record<string, string | number | boolean | null | undefined>) {
    const q = new URLSearchParams(this.route.query);
    for (const [k, v] of Object.entries(patch)) if (v === null || v === undefined || v === "") q.delete(k); else q.set(k, String(v));
    this.route = { ...this.route, query: q };
    history.replaceState(null, "", routeHash(this.route.section, this.route.path, q));
  }

  /** Frees the view: every stage, timer and listener a section left. */
  reset(route: Route) {
    for (const f of this.cleanups.splice(0)) { try { f(); } catch (e) { console.error(e); } }
    for (const st of this.stages.splice(0)) st.destroy();
    this.maxStages = MAX_STAGES;
    this.route = route;
  }
}
