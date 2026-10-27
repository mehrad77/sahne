// A cue's performance as a timeline (DESIGN.md §7): tracks of timed events that the director
// writes, and `evaluate(perf, t)`, which turns them into the state of the stage at time t.
// Pure and deterministic, so a run can `seek`, `finish` and `pause`, and a frame can be tested.

import { clamp, ease, lerp, polyAt, smoothstep, type Vec3 } from "../core/math.ts";
import type { Side } from "../core/kit.ts";
import type { MouthKey, WordSpan } from "../core/lang.ts";
import type { MoveHow, Target, Voice } from "../script/types.ts";
import type { PropState, Shot, World } from "../script/world.ts";
import type { BubbleKind } from "../ui/overlay.ts";

export const EMO_MS = 320, LOOK_MS = 220, CAM_MS = 450, HOLD_MS = 380, DOOR_OPEN_MS = 380, DOOR_CLOSE_MS = 520, TIME_MS = 900, SOUND_MS = 1300, STATE_FADE_MS = 400, STATE_ROLL_MS = 1400, WEATHER_MS = 1500, FLASH_RISE_MS = 60, FLASH_MS = 400, LIGHTS_MS = 600, SIT_MS = 700;

export interface WalkSeg {
  t0: number; t1: number;
  /** The path, world metres; walking keeps an even speed along it, easing in and out at the ends. */
  pts: Vec3[];
  how: MoveHow;
  /** Metres per step (a fly: per wingbeat). */
  stride: number;
  /** A fly's arc: metres above the straight line at its middle. */
  lift?: number;
  /** A fly that ends at an `air` mark: the bird keeps flying there. */
  air?: boolean;
  /** …and that mark is a `pace` one: she flies along there. */
  pace?: boolean;
  /** Per leg, the steps of a stair (0: a flat leg): a leg that climbs is taken a riser at a time. */
  steps?: number[];
}

/** A stair's riser (m): a leg that rises more than STAIR_MIN is taken in steps of about this. */
export const RISER = 0.18, STAIR_MIN = 0.1;
/** The steps of a leg that rises `dy` metres: 0 for a flat one. */
export const stairSteps = (dy: number) => Math.abs(dy) > STAIR_MIN ? Math.max(1, Math.round(Math.abs(dy) / RISER)) : 0;

/**
 * How long each leg of a path is to walk (m): along the floor, and a stair's height counts 1.2 times
 * over (climbing is slower); a fly goes the straight 3D length.
 */
export function legLengths(pts: Vec3[], fly: boolean, steps?: number[]): number[] {
  return pts.slice(1).map((p, i) => {
    const dy = p[1] - pts[i][1];
    return fly ? Math.hypot(p[0] - pts[i][0], dy, p[2] - pts[i][2]) : Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2]) + (steps?.[i] ? Math.abs(dy) * 1.2 : 0);
  });
}

export interface ActorTrack {
  walks: WalkSeg[];
  /** Turn to `yaw` from `t` over `dur`. */
  turns: { t: number; yaw: number; dur: number }[];
  emos: { t: number; emo: string }[];
  looks: { t: number; at: Target | null }[];
  gestures: { t0: number; id: string; side: Side; at?: Target; n?: number; loop?: boolean; tempo: number; /** ms of real time it lasts */ len: number }[];
  speech: { t0: number; t1: number; keys: MouthKey[]; voice: Voice }[];
  holds: { t: number; side: Side; prop: string | null }[];
  on: { t: number; on: boolean }[];
  /** A change of clothes at `t` (a wardrobe key, "" the cast document). */
  costumes: { t: number; key: string }[];
  /** Sitting down on a seat `h` m high from `t`, or standing up (`h: null`), over SIT_MS. */
  seats: { t: number; h: number | null; side?: 1 | -1 }[];
}

export interface TimedBubble {
  t0: number; t1: number;
  id: string; kind: BubbleKind; text: string; who?: string; voice?: Voice;
  /** What the bubble belongs to: an actor (above the head) or a target (a sound's source). */
  actor?: string; at?: Target;
}

/**
 * A sound at `t`. `at` is where it comes from (for panning and its word); `auto` sounds come from
 * the staging itself (steps, doors, a paper flip) and are left out in Still; `music` is a motif.
 */
export interface SoundEvent { t: number; id: string; at?: Target; params?: Record<string, unknown>; auto?: boolean; music?: boolean }

/** A line to be voiced, its words timed from `t0` by the language plugin's estimate. */
export interface VoiceLine { t0: number; t1: number; who: string; text: string; whisper: boolean; rate: number; words: WordSpan[] }

export interface Perf {
  cue: number;
  /** When everything has settled (ms). Loops and idle life go on after it. */
  dur: number;
  before: World;
  after: World;
  tracks: Record<string, ActorTrack>;
  /** A prop instance becomes `state` at `t` (null: it is gone, merged back or used up). */
  props: { t: number; id: string; state: PropState | null }[];
  cams: { t: number; shot: Shot; cut?: boolean }[];
  bubbles: TimedBubble[];
  /** A door piece stands open between t0 and t1; `mark` is the door's mark. */
  doors: { piece: string; t0: number; t1: number; mark?: string }[];
  /** The time of day changes at `t`, blending over `ms` (TIME_MS by default; a slow nightfall is longer). */
  times: { t: number; time: string; ms?: number }[];
  /** The place's states change at `t`: a cut, or a fade over STATE_FADE_MS. Optional: a performance built elsewhere may have none. */
  states?: { t: number; on: string[]; fade: boolean; /** Own length of the change, ms (`:roll`: a shutter takes longer than a fade). */ ms?: number }[];
  /** The weather changes at `t`, blending over WEATHER_MS. */
  weathers?: { t: number; weather: string }[];
  /** Lightning at `t`: a flash that rises over FLASH_RISE_MS and fades over FLASH_MS. */
  flashes?: { t: number }[];
  /** The place's lights switch on or off at `t`, over LIGHTS_MS. */
  lights?: { t: number; on: boolean }[];
  /** A vehicle that stops (`PlaceDoc.stops`) is brought in to station `at` and held there (`arrive`), or goes on from it (`go`), at `t`. */
  stops?: { t: number; at: number; arrive?: boolean; go?: boolean }[];
  /** A breath in the cold at `t` (`do: "breath"`). */
  puffs?: { t: number; who: string }[];
  /** A firework bursts at `t` at `at` (world metres; `env: fireworks`). */
  bursts?: { t: number; at: Vec3; seed: string }[];
  /** A prop goes along `pts` (world metres) from `t0` to `t1` (`obj go`). */
  paths?: { id: string; t0: number; t1: number; pts: Vec3[] }[];
  /** Sorted by t. */
  sounds: SoundEvent[];
  /** Sorted by t0. */
  lines: VoiceLine[];
}

export const emptyTrack = (): ActorTrack => ({ walks: [], turns: [], emos: [], looks: [], gestures: [], speech: [], holds: [], on: [], costumes: [], seats: [] });

// ---- Evaluation ---------------------------------------------------------------------------

export interface ActorFrame {
  id: string;
  on: boolean;
  pos: Vec3;
  yaw: number;
  /** The paper walk: steps so far, how much of it shows, and the travel direction (world). */
  walk: { phase: number; amount: number; dir: Vec3; how: MoveHow; /** On a stair: +1 up, −1 down (times the walk's amount). */ climb: number } | null;
  emo: { from: string; to: string; k: number };
  look: { from: Target | null; to: Target | null; k: number };
  gestures: { id: string; t: number; side: Side; at?: Target; n?: number; loop?: boolean }[];
  /** The mouth: blending from viseme `v0` to `v1` by `k`; `amount` fades speech in and out. */
  mouth: { v0: string; v1: string; k: number; amount: number; voice: Voice } | null;
  hold: Partial<Record<Side, { prop: string | null; w: number }>>;
  /** A turn of more than ~10° in progress: how far along it is (0…1), for the blink that goes with it. */
  turning: number | null;
  /** The wardrobe key worn ("" the cast document). */
  costume: string;
  /** At an `air` mark (a bird hovers). */
  air: boolean;
  /** At a `pace` mark (a bird flies along). */
  pace: boolean;
  /** Seated: the seat's height (m) and how far down (0…1: 1 sitting, between while sitting down or getting up). */
  seat: { h: number; k: number; /** Seated side on (`Mark.facing` side_l −1, side_r 1): the side view. */ side?: 1 | -1 } | null;
}

export interface Frame {
  t: number;
  /** Past the performance's end: only loops and idle life move now. */
  done: boolean;
  actors: Record<string, ActorFrame>;
  props: Record<string, PropState>;
  shot: { from: Shot; to: Shot; k: number; cut: boolean };
  time: { from: string; to: string; k: number };
  /** The place's states: what shows fades from `from` to `to` by `k` (1 at once for a cut). */
  state: { from: string[]; to: string[]; k: number };
  weather: { from: string; to: string; k: number };
  /** Lightning now, 0…1. */
  flash: number;
  /** The place's switched lights: 1 on, 0 off. */
  lights: number;
  /** A vehicle held at station `at` (`arrive`: brought in to it by this performance), or gone on from it (`go`); null: it runs on its own. The stage turns it into the stops clock. */
  stops: { at: number; arrive: boolean; go: boolean } | null;
  bubbles: TimedBubble[];
  doors: Record<string, number>;
}

/** The last event at or before `t` in a list sorted by `t`. */
function lastAt<T extends { t: number }>(list: T[], t: number): [T | undefined, T | undefined] {
  let cur: T | undefined, prev: T | undefined;
  for (const e of list) { if (e.t > t) break; prev = cur; cur = e; }
  return [cur, prev];
}

export function walkAt(seg: WalkSeg, t: number): { pos: Vec3; phase: number; amount: number; dir: Vec3; climb: number } {
  // a fly goes the 3D length, along an arc `lift` above the line at its middle; walking measures the floor, and a stair its height too
  const fly = seg.how === "fly", lens = legLengths(seg.pts, fly, seg.steps);
  const total = lens.reduce((a, b) => a + b, 0) || 1e-6, T = seg.t1 - seg.t0;
  // even speed with short ease-in and ease-out phases (accelerate, cruise, slow down)
  const a = Math.min(0.22, 260 / T), b = Math.min(0.25, 320 / T), u = clamp((t - seg.t0) / T, 0, 1);
  const v = 1 / (1 - a / 2 - b / 2);
  const s = u < a ? v * u * u / (2 * a) : u > 1 - b ? 1 - v * (1 - u) * (1 - u) / (2 * b) : v * (u - a / 2);
  let d = clamp(s, 0, 1) * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
  const p0 = seg.pts[i], p1 = seg.pts[i + 1] ?? p0, k = lens[i] ? clamp(d / lens[i], 0, 1) : 1, n = seg.steps?.[i] ?? 0;
  // on a stair the body rises early in each step, then the foot is planted on the tread
  const q = k * n, y = n ? p0[1] + (p1[1] - p0[1]) * Math.min(1, (Math.floor(q) + smoothstep(0, 0.4, q - Math.floor(q))) / n) : lerp(p0[1], p1[1], k);
  const pos: Vec3 = [lerp(p0[0], p1[0], k), y + (seg.lift ?? 0) * Math.sin(Math.PI * clamp(s, 0, 1)), lerp(p0[2], p1[2], k)];
  const l = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) || 1, dir: Vec3 = [(p1[0] - p0[0]) / l, 0, (p1[2] - p0[2]) / l];
  const amount = Math.min(clamp((t - seg.t0) / 200, 0, 1), clamp((seg.t1 - t) / 260, 0, 1));
  // the steps so far: a flat leg's length in strides, a stair's in risers
  let phase = 0;
  for (let j = 0; j < i; j++) phase += seg.steps?.[j] || lens[j] / seg.stride;
  phase += n ? k * n : k * lens[i] / seg.stride;
  return { pos, phase, amount, dir, climb: n ? Math.sign(p1[1] - p0[1]) * amount : 0 };
}

/** A value driven by tweens that may start before the previous one has finished. */
function chained(start: number, keys: { t: number; to: number; dur: number }[], t: number, e = ease.inOut): number {
  let from = start, cur: { t: number; to: number; dur: number } | undefined;
  const at = (time: number) => cur ? from + (cur.to - from) * e(clamp((time - cur.t) / Math.max(1, cur.dur), 0, 1)) : start;
  for (const k of keys) {
    if (k.t > t) break;
    const f = at(k.t);
    cur = k; from = f;
  }
  return at(t);
}

function visemeAt(keys: MouthKey[], t: number): { v0: string; v1: string; k: number } {
  if (!keys.length) return { v0: "rest", v1: "rest", k: 1 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const cur = keys[i], prev = keys[i - 1], next = keys[i + 1];
  // coarticulation: move into a shape over 70 ms (or half the shape, if it is shorter)
  const len = next ? next.t - cur.t : 200, ramp = Math.min(70, len / 2);
  return { v0: prev?.v ?? "rest", v1: cur.v, k: clamp((t - cur.t) / ramp, 0, 1) };
}

export function evaluate(perf: Perf, t: number): Frame {
  const B = perf.before, actors: Record<string, ActorFrame> = {};
  for (const [id, a0] of Object.entries(B.actors)) {
    const tr = perf.tracks[id];
    const af: ActorFrame = {
      id, on: a0.on, pos: [...a0.pos] as Vec3, yaw: a0.yaw, walk: null,
      emo: { from: a0.emo, to: a0.emo, k: 1 }, look: { from: a0.look, to: a0.look, k: 1 },
      gestures: [], mouth: null, hold: {}, turning: null, costume: a0.costume ?? "", air: !!a0.air, pace: !!a0.pace,
      seat: a0.seat !== undefined ? { h: a0.seat, k: 1, ...(a0.seatSide ? { side: a0.seatSide } : {}) } : null,
    };
    for (const side of ["l", "r"] as const) if (a0.hold[side]) af.hold[side] = { prop: a0.hold[side]!, w: 1 };
    actors[id] = af;
    if (!tr) continue;
    const [on] = lastAt(tr.on, t);
    if (on) af.on = on.on;
    const [c] = lastAt(tr.costumes ?? [], t);
    if (c) af.costume = c.key;
    // sitting down or getting up (a seat mark), eased over SIT_MS
    const [st, stPrev] = lastAt(tr.seats ?? [], t);
    if (st) {
      const k = ease.inOut(clamp((t - st.t) / SIT_MS, 0, 1)), was = stPrev ? stPrev.h : a0.seat ?? null, wasSide = stPrev ? stPrev.side : a0.seatSide;
      af.seat = st.h !== null ? { h: st.h, k, ...(st.side ? { side: st.side } : {}) } : was !== null && k < 1 ? { h: was, k: 1 - k, ...(wasSide ? { side: wasSide } : {}) } : null;
    }
    // position: the last walk that has started; a fly that has reached an `air` mark hovers there, any other walk lands
    for (const w of tr.walks) {
      if (w.t0 > t) break;
      const s = walkAt(w, t);
      af.pos = s.pos; af.air = !!w.air && t >= w.t1; af.pace = !!w.pace && af.air;
      if (t < w.t1) af.walk = { phase: s.phase, amount: s.amount, dir: s.dir, how: w.how, climb: s.climb };
    }
    af.yaw = chained(a0.yaw, tr.turns.map(k => ({ t: k.t, to: k.yaw, dur: k.dur })), t);
    let prevYaw = a0.yaw;
    for (const k of tr.turns) {
      if (k.t > t) break;
      if (t < k.t + k.dur && Math.abs(k.yaw - prevYaw) > 0.18 && k.dur > 1) af.turning = (t - k.t) / k.dur;
      prevYaw = k.yaw;
    }
    const [e, ePrev] = lastAt(tr.emos, t);
    if (e) af.emo = { from: ePrev?.emo ?? a0.emo, to: e.emo, k: ease.out(clamp((t - e.t) / EMO_MS, 0, 1)) };
    const [l, lPrev] = lastAt(tr.looks, t);
    if (l) af.look = { from: lPrev ? lPrev.at : a0.look, to: l.at, k: ease.out(clamp((t - l.t) / LOOK_MS, 0, 1)) };
    for (const g of tr.gestures) {
      if (g.t0 > t || (!g.loop && t > g.t0 + g.len)) continue;
      af.gestures.push({ id: g.id, t: (t - g.t0) * g.tempo, side: g.side, at: g.at, n: g.n, loop: g.loop });
    }
    for (const s of tr.speech) {
      if (t < s.t0 || t > s.t1 + 120) continue;
      const v = visemeAt(s.keys, t - s.t0);
      const amount = Math.min(clamp((t - s.t0) / 60, 0, 1), clamp((s.t1 + 120 - t) / 120, 0, 1));
      af.mouth = { ...v, amount, voice: s.voice };
    }
    for (const side of ["l", "r"] as const) {
      const keys = tr.holds.filter(h => h.side === side);
      const [h] = lastAt(keys, t);
      if (!h) continue;
      const k = clamp((t - h.t) / HOLD_MS, 0, 1);
      af.hold[side] = h.prop ? { prop: h.prop, w: ease.inOut(k) } : { prop: null, w: 1 - ease.inOut(k) };
    }
  }

  const props: Record<string, PropState> = { ...B.props };
  for (const ev of perf.props) {
    if (ev.t > t) break;
    if (ev.state) props[ev.id] = ev.state; else delete props[ev.id];
  }
  // a prop on its way (`obj go`): along its path, easing in and out
  for (const pa of perf.paths ?? []) {
    const p = props[pa.id];
    if (pa.t0 > t || !p || p.holder) continue;
    props[pa.id] = { ...p, at: polyAt(pa.pts, ease.inOut(clamp((t - pa.t0) / Math.max(1, pa.t1 - pa.t0), 0, 1))) };
  }

  const [cam, camPrev] = lastAt(perf.cams, t);
  const shot = cam
    ? { from: camPrev?.shot ?? B.shot, to: cam.shot, k: cam.cut ? 1 : ease.inOut(clamp((t - cam.t) / CAM_MS, 0, 1)), cut: !!cam.cut }
    : { from: B.shot, to: B.shot, k: 1, cut: false };

  const [tm, tmPrev] = lastAt(perf.times, t);
  const time = tm ? { from: tmPrev?.time ?? B.time, to: tm.time, k: ease.inOut(clamp((t - tm.t) / (tm.ms ?? TIME_MS), 0, 1)) } : { from: B.time, to: B.time, k: 1 };

  const [st, stPrev] = lastAt(perf.states ?? [], t), s0 = B.state ?? [];
  const state = st ? { from: stPrev?.on ?? s0, to: st.on, k: st.fade ? ease.inOut(clamp((t - st.t) / (st.ms ?? STATE_FADE_MS), 0, 1)) : 1 } : { from: s0, to: s0, k: 1 };

  const [wt, wtPrev] = lastAt(perf.weathers ?? [], t), w0 = B.weather ?? "clear";
  const weather = wt ? { from: wtPrev?.weather ?? w0, to: wt.weather, k: ease.inOut(clamp((t - wt.t) / WEATHER_MS, 0, 1)) } : { from: w0, to: w0, k: 1 };
  let flash = 0;
  for (const fl of perf.flashes ?? []) {
    if (fl.t > t) break;
    const u = t - fl.t;
    flash = Math.max(flash, u < FLASH_RISE_MS ? u / FLASH_RISE_MS : Math.max(0, 1 - (u - FLASH_RISE_MS) / FLASH_MS));
  }

  const [li, liPrev] = lastAt(perf.lights ?? [], t), l0 = B.lights === false ? 0 : 1;
  const lights = li ? (liPrev ? (liPrev.on ? 1 : 0) : l0) + ((li.on ? 1 : 0) - (liPrev ? (liPrev.on ? 1 : 0) : l0)) * ease.inOut(clamp((t - li.t) / LIGHTS_MS, 0, 1)) : l0;

  const [so] = lastAt(perf.stops ?? [], t), sb = B.stops;
  const stops = so ? { at: so.at, arrive: !!so.arrive, go: !!so.go } : sb ? { at: sb.at, arrive: false, go: !!sb.go } : null;

  const doors: Record<string, number> = {};
  for (const d of perf.doors) {
    const open = ease.inOut(clamp((t - d.t0) / DOOR_OPEN_MS, 0, 1)) * (1 - ease.inOut(clamp((t - d.t1) / DOOR_CLOSE_MS, 0, 1)));
    doors[d.piece] = Math.max(doors[d.piece] ?? 0, open);
  }

  return {
    t, done: t >= perf.dur, actors, props, shot, time, state, weather, flash, lights, stops, doors,
    bubbles: perf.bubbles.filter(b => b.t0 <= t && t < b.t1),
  };
}
