// The world state after a cue: where everyone is, what they feel and hold, where every prop is,
// and what the camera frames. `fold(script, i)` (director/direct.ts) computes it as a pure
// function of the script, so any cue can be shown without playing the ones before it.

import type { Vec3 } from "../core/math.ts";
import type { FlatWhen, Side } from "../core/kit.ts";
import type { PlaceDoc } from "../core/types.ts";
import type { CamKind, Target } from "./types.ts";

export interface ActorState {
  id: string;
  /** On stage. */
  on: boolean;
  pos: Vec3;
  /** 0 faces the viewer, + turns to screen right, ±π shows the back. */
  yaw: number;
  emo: string;
  /** The cue that set `emo`: it fades back to the resting mood two cues later. */
  emoAt: number;
  /** Where the eyes rest. */
  look: Target | null;
  /** Prop instances held in each hand. */
  hold: Partial<Record<Side, string>>;
  /** What they wear: a key of the stage's wardrobe for them (absent or "": the cast document). It carries across scenes. */
  costume?: string;
  /** At an `air` mark: a bird hovers there. */
  air?: boolean;
  /** At a `pace` mark: she flies along beside something moving instead of hovering. */
  pace?: boolean;
  /** Seated on a `seat` mark: the seat's height (m above the floor). */
  seat?: number;
  /** Seated side on (a seat mark facing `side_l` −1 or `side_r` 1): the kit's side view, facing that way. */
  seatSide?: 1 | -1;
}

export interface PropState {
  /** Instance id: the place's prop id, or `<id>#<k>` for a part of it that was split off (two of three loaves). */
  id: string;
  /** The place's prop it came from (its terms, its kit). */
  of: string;
  kit: string;
  n?: number;
  /** The kit parameters other than `n` (a clock's time, a label). */
  params: Record<string, unknown>;
  shown: boolean;
  /** Hidden, and its place shows a dashed outline (*yok*). */
  ghost: boolean;
  /** Where it stands, when nobody holds it. */
  at: Vec3 | null;
  holder?: { actor: string; side: Side };
  /** The same thing in every place that lists it (`PropRef.keep`): its count, showing and parameters come along. */
  keep?: true;
  /** Only in these states of the place (`PropRef.in`). */
  in?: string[];
  /** Its own motion (`FlatSpec.move`) held where it starts (`obj set {still: true}`). Not a kit parameter: no new look. */
  still?: boolean;
  /** Waiting in `away` for another place of this site (a site's places carry everything, not only kept props). */
  site?: string;
}

export interface Shot { kind: CamKind; ids: string[]; objs: string[] }

export interface World {
  /** The cue this is the state after (−1: before the first). */
  i: number;
  place: string | null;
  time: string;
  actors: Record<string, ActorState>;
  props: Record<string, PropState>;
  shot: Shot;
  /** The last line: who said it to whom, for the next line's default addressee. */
  last?: { who: string; to?: string };
  /** The cue of the narrator's last line: a narrator line right after another needs no coo first. */
  narr?: number;
  /** The kept props that are not in this place, as they were last seen. */
  away?: Record<string, PropState>;
  /** The place's states that are on (sorted); absent: its defaults. */
  state?: string[];
  /** The weather (`rain`, `grey`); absent: clear. It carries from place to place, as the time does. */
  weather?: string;
  /** `false`: the place's lights are switched off (`env: lights_off`). It carries inside a site; a new site starts with them on. */
  lights?: false;
  /** A vehicle held at a station (`at`, its index in `PlaceDoc.stops.stations`; −1: halted where it was, in traffic), or gone on from it (`go`); absent: it runs on its own. Only in its place. */
  stops?: { at: number; go?: true };
}

/** The key of a prop's look: instances with the same key share one raster. */
export const propKey = (p: { kit: string; n?: number; params: Record<string, unknown> }) =>
  p.kit + "|" + (p.n ?? "") + "|" + JSON.stringify(Object.keys(p.params).sort().map(k => [k, p.params[k]]));

/** What a kept prop takes from place to place (not where it stands). */
export const KEPT = ["n", "shown", "params"] as const;

export function markPos(place: PlaceDoc, mark: string): Vec3 | null {
  const m = place.marks[mark];
  return m ? [m.x, m.y ?? 0, m.z] : null;
}

/** The props of a place in their starting state. */
export function placeProps(place: PlaceDoc): Record<string, PropState> {
  const out: Record<string, PropState> = {};
  for (const [id, ref] of Object.entries(place.props ?? {})) {
    const { kit, at, n, terms: _t, shown, keep, in: states, ...params } = ref;
    const p = typeof at === "string" ? markPos(place, at) : [at.x, at.y, at.z] as Vec3;
    out[id] = { id, of: id, kit, n: typeof n === "number" ? n : undefined, params, shown: shown !== false, ghost: false, at: p, ...(keep ? { keep: true as const } : {}), ...(states ? { in: states } : {}) };
  }
  return out;
}

/**
 * The props of a place the story moves to, with `w.props` and `w.away` updated. A kept prop in the
 * hand of someone in `on` (in the new scene) stays in that hand; every other kept prop gives its
 * count, showing and parameters to the new place's prop of the same id, or waits in `away` until a
 * place lists it again. A split-off part nobody carries rejoins its prop's count. Returns the hands.
 *
 * `site`: the move stays inside one site (`metro_m11` to `metro_osmanbey`), where every prop carries
 * as a kept one does; what waits in `away` for the site is dropped when the story leaves it.
 */
export function enterPlace(w: World, place: PlaceDoc, on: Set<string>, site?: string): Record<string, Partial<Record<Side, string>>> {
  const next = placeProps(place), holds: Record<string, Partial<Record<Side, string>>> = {};
  const away: Record<string, PropState> = Object.fromEntries(Object.entries(w.away ?? {}).filter(([, p]) => !p.site || p.site === site));
  const old = Object.fromEntries(Object.entries(w.props).filter(([, p]) => p.keep || site).map(([k, p]) => [k, { ...p, params: { ...p.params } }]));
  for (const p of Object.values(old)) {
    if (p.holder && on.has(p.holder.actor)) {
      next[p.id] = p;
      (holds[p.holder.actor] ??= {})[p.holder.side] = p.id;
    } else if (p.id !== p.of) {
      const whole = away[p.of] ?? old[p.of];
      if (whole && typeof whole.n === "number") whole.n += p.n ?? 1;
    } else away[p.id] = { ...p, holder: undefined, ...(p.keep ? {} : { site }) };
  }
  for (const [id, p] of Object.entries(next)) {
    const was = away[id];
    if (!(p.keep || was?.site) || !was || p.holder) continue;
    next[id] = { ...p, n: was.n, shown: was.shown, params: was.params, ghost: false };
    delete away[id];
  }
  w.props = next;
  w.away = away;
  return holds;
}

/** The site a place belongs to: its `site`, else its own id. */
export const siteOf = (places: Record<string, PlaceDoc>, id: string | null) => id ? places[id]?.site ?? id : null;

/** The states that are on in a place: `cur` (else its defaults), with `ask` turned on (evicting the rest of its group) or, as `-s`, off. Sorted. */
export function placeState(place: PlaceDoc, cur: string[] | undefined, ask?: string | string[]): string[] {
  const defs = place.states ?? {}, on = new Set(cur ?? Object.keys(defs).filter(k => defs[k].default));
  for (const a of [ask ?? []].flat()) {
    const off = a.startsWith("-"), s = off ? a.slice(1) : a;
    if (!Object.hasOwn(defs, s)) { console.warn("sahne: no state", s, "in", place.id); continue; }
    if (off) { on.delete(s); continue; }
    const g = defs[s].group;
    if (g) for (const k of [...on]) if (defs[k]?.group === g) on.delete(k);
    on.add(s);
  }
  return [...on].sort();
}

/** Shown in these states: no `in`, or one of its states is on. */
export const inState = (list: string[] | undefined, on: string[] | undefined) => !list || list.some(s => !!on?.includes(s));

/** How much a flat with `when` shows (0…1) in a frame's weather, time of day and place states, each blending from `from` to `to` by `k` (`FlatSpec.when`). */
export function whenWeight(when: FlatWhen, f: { time: { from: string; to: string; k: number }; weather: { from: string; to: string; k: number }; state: { from: string[]; to: string[]; k: number } }): number {
  const blend = (a: boolean, b: boolean, k: number) => (a ? 1 : 0) + ((b ? 1 : 0) - (a ? 1 : 0)) * k;
  let w = 1;
  if (when.weather) w *= blend(when.weather.includes(f.weather.from || "clear"), when.weather.includes(f.weather.to || "clear"), f.weather.k);
  if (when.time) w *= blend(when.time.includes(f.time.from), when.time.includes(f.time.to), f.time.k);
  if (when.state) w *= blend(inState(when.state, f.state.from), inState(when.state, f.state.to), f.state.k);
  return w;
}

export const emptyWorld = (cast: string[]): World => ({
  i: -1, place: null, time: "day", props: {}, shot: { kind: "wide", ids: [], objs: [] },
  actors: Object.fromEntries(cast.map(id => [id, { id, on: false, pos: [0, 0, 0] as Vec3, yaw: 0, emo: "neutral", emoAt: -9, look: null, hold: {} }])),
});

export function cloneWorld(w: World): World {
  return {
    ...w, shot: { ...w.shot, ids: [...w.shot.ids], objs: [...w.shot.objs] },
    actors: Object.fromEntries(Object.entries(w.actors).map(([k, a]) => [k, { ...a, pos: [...a.pos] as Vec3, hold: { ...a.hold } }])),
    props: Object.fromEntries(Object.entries(w.props).map(([k, p]) => [k, { ...p, params: { ...p.params }, at: p.at ? [...p.at] as Vec3 : null, holder: p.holder ? { ...p.holder } : undefined }])),
    last: w.last ? { ...w.last } : undefined,
    ...(w.state ? { state: [...w.state] } : {}),
    ...(w.stops ? { stops: { ...w.stops } } : {}),
    ...(w.away ? { away: Object.fromEntries(Object.entries(w.away).map(([k, p]) => [k, { ...p, params: { ...p.params } }])) } : {}),
  };
}
