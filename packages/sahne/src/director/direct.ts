// The director (DESIGN.md §4.2): turns one cue and the world before it into a performance,
// filling in the staging a writer leaves out — who faces and looks at whom, when the gesture's
// stroke meets its word, where the camera goes, how a prop passes from hand to hand.
// Pure: no DOM, no clock. `fold` replays a script to any cue.

import { polyLength, type Vec3 } from "../core/math.ts";
import { rng } from "../core/rng.ts";
import { wideBox } from "../render/paper/camera.ts";
import type { GestureDef, Side } from "../core/kit.ts";
import type { PlaceDoc } from "../core/types.ts";
import { matchFallback, type LangPlugin, type Speech } from "../core/lang.ts";
import { route, type Solid } from "./route.ts";
import type { Act, Cue, Move, ObjOp, Reaction, Sfx, Staging, Target, Voice } from "../script/types.ts";
import { cloneWorld, emptyWorld, enterPlace, inState, markPos, placeState, siteOf, type ActorState, type Shot, type World } from "../script/world.ts";
import { CAM_MS, DOOR_CLOSE_MS, SIT_MS, SOUND_MS, STATE_FADE_MS, STATE_ROLL_MS, emptyTrack, legLengths, stairSteps, walkAt, type ActorTrack, type Perf } from "../anim/timeline.ts";

/** A seat mark seen side on (`facing` side_l or side_r): which way the sitter faces, for the kit's side view. */
const seatSideOf = (m?: { facing?: string }): 1 | -1 | undefined => m?.facing === "side_r" ? 1 : m?.facing === "side_l" ? -1 : undefined;

export interface DirectCtx {
  places: Record<string, PlaceDoc>;
  gestures: Record<string, GestureDef>;
  lang: LangPlugin;
  /** Lines by this id go to the narrator inset (Kerim). */
  narrator?: string;
  /** Each character's motion tempo (1 = average; İsmail is quick, Maria Teyze slow). */
  tempo?: Record<string, number>;
  /** Each character's resting mood, which an emotion fades back to (default neutral). */
  rest?: Record<string, string>;
  /** Heights in metres, for strides and hand heights (default 1.7). */
  heights?: Record<string, number>;
  /** Actors played by a kit puppet: its kind (a `bird` perches and flies; a `bird` or a `cat` is side-on) and its own gestures. */
  puppets?: Record<string, { kind: string; gestures: Record<string, GestureDef> }>;
  /** A kit sound's written word in the scene's language, for a sound bubble the script gives no word. */
  soundWord?: (id: string) => string | undefined;
  /** The narrator's own sound before speaking (Kerim's coo) and how long it lasts (ms). */
  narratorSound?: { id: string; ms: number };
  /** Each place's solid lines (`placeSolids`): a walk goes round them (DESIGN.md §7). Without them, walks go straight. */
  solids?: Record<string, Solid[]>;
}

/** Facing someone in conversation (DESIGN.md §6.3: up to ±35°). */
export const TALK_YAW = 0.32;
/** A cat's step, m: half its gait cycle (rig/cat.ts); a person's stride scaled to a cat's height would be a scurry. */
const CAT_STRIDE = 0.28;
const WALK_YAW = 0.55, BACK_YAW = Math.PI - 0.5, TURN_MS = 420, WALK_SPEED = 1.15, RUN_SPEED = 2.4, HOP_SPEED = 0.85, FLY_SPEED = 2.6, FLAP_S = 0.92;

const sameShot = (a: Shot, b: Shot) => a.kind === b.kind && a.ids.join() === b.ids.join() && a.objs.join() === b.objs.join();

/** Which way a paper puppet faces while it travels: three-quarters to the side, or its back when walking away. */
export function travelYaw(d: Vec3): number {
  const dx = d[0], dz = d[2], s = dx >= 0 ? 1 : -1;
  if (dz < -Math.abs(dx) * 0.6) return s * BACK_YAW;
  if (Math.abs(dx) < 0.3 * Math.abs(dz)) return 0;
  return s * WALK_YAW;
}

export function faceYaw(from: Vec3, to: Vec3): number {
  const dx = to[0] - from[0];
  return Math.abs(dx) < 0.15 ? 0 : Math.sign(dx) * TALK_YAW;
}

/** The side of an actor a world point is on, in its paper space: `l` is the art's +x. */
export function sideOf(a: { pos: Vec3; yaw: number }, p: Vec3 | null): Side {
  if (!p) return "r";
  const px = (p[0] - a.pos[0]) * Math.cos(a.yaw) - (p[2] - a.pos[2]) * Math.sin(a.yaw);
  return px > 0.02 ? "l" : "r";
}

class Direction {
  readonly w: World;
  readonly perf: Perf;
  private ctx: DirectCtx;
  private place: PlaceDoc | null;
  constructor(w0: World, i: number, ctx: DirectCtx) {
    this.ctx = ctx;
    this.w = cloneWorld(w0); this.w.i = i;
    this.place = w0.place ? ctx.places[w0.place] ?? null : null;
    this.perf = { cue: i, dur: 0, before: w0, after: this.w, tracks: {}, props: [], cams: [], bubbles: [], doors: [], times: [], sounds: [], lines: [] };
  }

  track(id: string): ActorTrack { return this.perf.tracks[id] ??= emptyTrack(); }
  end(t: number) { if (Number.isFinite(t)) this.perf.dur = Math.max(this.perf.dur, t); }

  /** A change of clothes at `t`: at once, in every motion setting. */
  dress(id: string, key: string, t: number) {
    const a = this.w.actors[id];
    if (!a || (a.costume ?? "") === key) return;
    this.track(id).costumes.push({ t, key });
    a.costume = key;
    this.end(t + 300);
  }
  actor(id: string | undefined): ActorState | undefined { return id ? this.w.actors[id] : undefined; }
  tempo(id: string | undefined, st?: Staging) { return (st?.tempo ?? 1) * (id ? this.ctx.tempo?.[id] ?? 1 : 1); }
  height(id: string) { return this.ctx.heights?.[id] ?? 1.7; }
  /** An actor's gestures: a kit puppet has its own. */
  defs(id: string | undefined) { return (id && this.ctx.puppets?.[id]?.gestures) || this.ctx.gestures; }
  bird(id: string | undefined) { return !!id && this.ctx.puppets?.[id]?.kind === "bird"; }
  cat(id: string | undefined) { return !!id && this.ctx.puppets?.[id]?.kind === "cat"; }
  /** An animal drawn side-on (a bird, a cat): it turns by mirroring, never three-quarters, and takes no seat. */
  sideOn(id: string | undefined) { return this.bird(id) || this.cat(id); }
  /** Side-on: towards −x it mirrors (π), towards +x it is 0, and with no clear side it keeps its yaw. */
  side(id: string, dx: number, eps = 0.15) { return Math.abs(dx) < eps ? this.w.actors[id].yaw : dx < 0 ? Math.PI : 0; }
  /** The yaw to face `q` from `p`: a person three-quarters, an animal side-on. */
  faceTo(id: string, p: Vec3, q: Vec3) { return this.sideOn(id) ? this.side(id, q[0] - p[0]) : this.yawTo(id, p, q); }
  /** A person facing someone: a turn of TALK_YAW towards them; seated with the back to the camera (a car's front seats), over the shoulder, still from behind. */
  yawTo(id: string, p: Vec3, q: Vec3) {
    const a = this.w.actors[id], f = faceYaw(p, q);
    return a && a.seat !== undefined && Math.abs(a.yaw) > Math.PI / 2 ? Math.PI - f : f;
  }

  /** A rough world point for a target: enough to pick an arm and to frame a shot. */
  point(t: Target | undefined): Vec3 | null {
    if (!t) return null;
    const [kind, rest] = [t.slice(0, t.indexOf(":")), t.slice(t.indexOf(":") + 1)];
    if (t === "viewer") return null;
    if (kind === "obj") {
      const p = this.w.props[rest];
      if (!p) return null;
      if (p.holder) { const h = this.w.actors[p.holder.actor]; return h ? [h.pos[0], h.pos[1] + this.height(h.id) * 0.6, h.pos[2]] : null; }
      return p.at;
    }
    if (kind === "ch") { const [id] = rest.split("."); const a = this.w.actors[id]; return a ? [a.pos[0], a.pos[1] + this.height(id) * 0.7, a.pos[2]] : null; }
    if (kind === "mark") return this.place ? markPos(this.place, rest) : null;
    if (kind === "pass") {
      const [a, b] = rest.split(":").map(id => this.w.actors[id]);
      return a && b ? [(a.pos[0] + b.pos[0]) / 2, 1.0 + (a.pos[1] + b.pos[1]) / 2, (a.pos[2] + b.pos[2]) / 2] : null;
    }
    return null;
  }

  setEmo(id: string, emo: string, t: number) {
    const a = this.w.actors[id];
    if (!a) return;
    this.track(id).emos.push({ t, emo });
    a.emo = emo; a.emoAt = this.w.i;
  }

  look(id: string, at: Target | null, t: number) {
    const a = this.w.actors[id];
    if (!a || a.look === at && !this.track(id).looks.length) return;
    this.track(id).looks.push({ t, at });
    a.look = at;
  }

  turn(id: string, yaw: number, t: number, dur = TURN_MS) {
    const a = this.w.actors[id];
    if (!a || Math.abs(a.yaw - yaw) < 0.03) return;
    this.track(id).turns.push({ t, yaw, dur });
    a.yaw = yaw;
    this.end(t + dur);
  }

  /** Perform a gesture so that its stroke lands at `stroke` (ms); returns its start and end. */
  gesture(id: string, g: string, o: { stroke?: number; start?: number; at?: Target; n?: number; loop?: boolean; tempo: number; side?: Side }): { t0: number; stroke: number; t1: number } | null {
    const def = this.defs(id)[g], a = this.w.actors[id];
    if (!def || !a) { if (!def) console.warn("sahne: no gesture", g); return null; }
    const k = o.tempo;
    const t0 = Math.max(0, o.start ?? (o.stroke ?? 0) - def.stroke / k);
    const side = o.side ?? sideOf(a, this.point(o.at) ?? this.point(a.look ?? undefined));
    // a kit puppet beats a counting loop n times (rig/bird.ts), so its gesture lasts that much longer
    const len = (def.dur + (this.ctx.puppets?.[id] && def.loop && o.n && !o.loop ? (o.n - 1) * (def.loop[1] - def.loop[0]) : 0)) / k;
    const tr = this.track(id);
    tr.gestures.push({ t0, id: g, side, at: o.at, n: o.n, loop: !!o.loop && !!def.loop, tempo: k, len });
    tr.gestures.sort((x, y) => x.t0 - y.t0);
    this.end(t0 + len);
    return { t0, stroke: t0 + def.stroke / k, t1: t0 + len };
  }

  /** When the word a gesture or a prop change belongs to is said (ms into the speech). */
  wordTime(sp: Speech | null, word: string | undefined, link: Record<string, Target> | undefined, target: Target | undefined, last = false): number | null {
    if (!sp || !sp.words.length) return null;
    const match = this.ctx.lang.match ?? matchFallback;
    if (word) { const w = sp.words.find(x => match(x.text, word) || x.text.toLowerCase() === word.toLowerCase()); if (w) return w.t0; }
    if (target && link) {
      const tokens = Object.entries(link).filter(([, v]) => v === target).map(([k]) => k);
      // the last mention: "Ekmek var. Şu ekmek çok taze." points at the second
      const hits = sp.words.filter(x => tokens.some(tok => match(x.text, tok)));
      if (hits.length) return hits[hits.length - 1].t0;
    }
    return last ? sp.words[sp.words.length - 1].t0 : sp.words[0].t0;
  }

  // ---- Cues ------------------------------------------------------------------------------

  scene(s: { place: string; time?: string; weather?: string; state?: string | string[]; at: Record<string, string>; perch?: string; cam?: Shot["kind"]; costume?: Record<string, string>; stop?: string }) {
    const place = this.ctx.places[s.place];
    if (!place) throw new Error(`sahne: no place ${s.place}`);
    const w = this.w, changed = w.place !== s.place, from = w.place;
    // another place of the same site (the metro car to its platform): no new motif, and every prop carries
    const site = changed && from ? siteOf(this.ctx.places, s.place) : null, sibling = !!site && site === siteOf(this.ctx.places, from);
    w.place = s.place; this.place = place;
    if (s.time) w.time = s.time;
    if (s.weather) w.weather = s.weather === "clear" ? undefined : s.weather;
    // the lights stay as they were inside a site; another site starts with them on
    if (changed && !sibling) w.lights = undefined;
    // a new place starts in its default states; the same place keeps its own
    w.state = placeState(place, changed ? undefined : w.state, s.state);
    // a vehicle that stops: the scene may open with it standing at a station; another place's timetable is not this one's
    const j = s.stop ? place.stops?.stations.indexOf(s.stop) ?? -1 : -1;
    if (s.stop && j < 1) console.warn("sahne: no station", s.stop);
    w.stops = j >= 1 ? { at: j } : changed ? undefined : w.stops;
    // a new place: its own props start afresh, kept ones come as they were, and kept ones in a hand that comes along stay there
    // a bird narrator in the cast perches (the scene's perch, else the place's, if it is there in this state) unless placed; else only her window shows
    const at = { ...s.at }, nar = this.ctx.narrator, perch = s.perch ?? place.perch;
    if (nar && w.actors[nar] && !at[nar] && perch && inState(place.marks[perch]?.in, w.state) && this.bird(nar)) at[nar] = perch;
    const holds = changed ? enterPlace(w, place, new Set(Object.keys(at).filter(id => place.marks[at[id]])), sibling ? site! : undefined) : {};
    for (const a of Object.values(w.actors)) {
      const mark = at[a.id], m = mark ? place.marks[mark] : undefined;
      // in the same place, whoever stays keeps what they hold; whoever leaves takes it along
      const hold = changed ? holds[a.id] ?? {} : a.hold;
      if (!m && !changed) for (const id of Object.values(a.hold)) if (id && w.props[id]) w.props[id] = { ...w.props[id], shown: false };
      if (!m) { a.on = false; a.hold = {}; continue; }
      // an animal is side-on: facing `l` mirrors it (π), else it faces the place's centre
      const yaw = this.sideOn(a.id) ? (m.facing === "l" || !m.facing && m.x > (place.camera?.wide?.x ?? 0) ? Math.PI : 0) : m.facing === "l" ? -TALK_YAW : m.facing === "r" ? TALK_YAW : m.facing === "back" ? Math.PI : 0;
      const seat = m.seat !== undefined && !this.sideOn(a.id) ? m.seat : undefined;
      Object.assign(a, { on: true, pos: [m.x, m.y ?? 0, m.z], yaw, emo: this.ctx.rest?.[a.id] ?? "neutral", emoAt: -9, look: null, hold, air: !!m.air, pace: !!m.air && !!m.pace, seat, seatSide: seat !== undefined ? seatSideOf(m) : undefined });
    }
    // dressed at the cut
    for (const [id, key] of Object.entries(s.costume ?? {})) if (w.actors[id]) w.actors[id].costume = key;
    w.shot = { kind: s.cam ?? "wide", ids: [], objs: [] };
    w.last = undefined;
    // a new scene is a cut: the performance starts from the new world
    this.perf.before = cloneWorld(w);
    this.end(300);
    // the place's motif when the story moves here (the first scene has the app's opening theme)
    if (changed && from && !sibling && place.motif) this.perf.sounds.push({ t: 0, id: place.motif, music: true });
  }

  /** A change of the place's surroundings: `time:<t>[:<ms>]` (over `ms`, default 900: a slow nightfall is longer, up to a minute), `state:<s>` (`state:-<s>` off; `:fade` fades instead of cutting; `:roll` takes 1.4 s, for a roller shutter whose flats `reveal`), `weather:<w>`, `thunder`, `lights_on`/`lights_off` (at `at`, ms), `stop:<station>` and `depart` (a vehicle that stops comes in to the station and holds there, doors open, or goes on; neither waits for the train), and a bare `stop` (it slows to a halt where it is, a jam, until `depart`). */
  env(e: string, at = 0) {
    const w = this.w;
    if (e.startsWith("time:")) { const [time, ms] = e.slice(5).split(":"), d = ms ? Math.max(0, Math.min(60000, Number(ms) || 900)) : undefined; this.perf.times.push({ t: 0, time, ...(d !== undefined ? { ms: d } : {}) }); w.time = time; this.end(d ?? 900); }
    else if (e.startsWith("state:") && this.place) {
      const [s, how] = e.slice(6).split(":"), on = placeState(this.place, w.state, s), roll = how === "roll", fade = how === "fade" || roll, ms = roll ? STATE_ROLL_MS : STATE_FADE_MS;
      // changes in one beat are one change: it fades if any of them does, and takes the longest
      const list = this.perf.states ??= [], last = list[list.length - 1];
      let len = fade ? ms : 0;
      if (last?.t === 0) { last.on = on; last.fade ||= fade; if (fade) last.ms = len = Math.max(last.ms ?? 0, ms); else len = last.fade ? last.ms ?? STATE_FADE_MS : 0; } else list.push({ t: 0, on, fade, ...(roll ? { ms } : {}) });
      w.state = on;
      this.end(len);
    } else if (e.startsWith("weather:")) {
      const weather = e.slice(8);
      (this.perf.weathers ??= []).push({ t: 0, weather });
      w.weather = weather === "clear" ? undefined : weather;
      this.end(1500);
    } else if (e === "lights_on" || e === "lights_off") {
      const on = e === "lights_on";
      (this.perf.lights ??= []).push({ t: at, on });
      w.lights = on ? undefined : false;
      this.end(at + 600);
    } else if (e === "stop") {
      // a halt where it is, between stations (a jam), until depart
      if (this.place?.stops) { (this.perf.stops ??= []).push({ t: at, at: -1, arrive: true }); w.stops = { at: -1 }; }
      this.end(at);
    } else if (e.startsWith("stop:")) {
      const j = this.place?.stops?.stations.indexOf(e.slice(5)) ?? -1;
      if (j < 1) console.warn("sahne: no station", e.slice(5));
      else { (this.perf.stops ??= []).push({ t: at, at: j, arrive: true }); w.stops = { at: j }; this.end(at); }
    } else if (e === "depart") {
      if (w.stops && !w.stops.go) { (this.perf.stops ??= []).push({ t: at, at: w.stops.at, go: true }); w.stops = { at: w.stops.at, go: true }; }
      this.end(at);
    } else if (e.startsWith("fireworks")) {
      // n bursts, 0.7 s apart, over the far band of the wide shot (DESIGN.md §6.7); each with the kit's sound
      const n = Math.max(1, Math.min(6, Number(e.split(":")[1]) || 3)), P = this.place, b = wideBox(P), R = rng(`${P?.id}|${w.i}|fireworks`);
      const list = this.perf.bursts ??= [];
      for (let k = 0; k < n; k++) {
        const t = at + k * 700, x = b.x0 + (b.x1 - b.x0) * (0.2 + 0.6 * R()), y = b.y1 - 0.2 + R() * 0.8;
        list.push({ t, at: [x * 1.4, y, b.z - 10], seed: `${P?.id}|${w.i}|${k}` });
        this.perf.sounds.push({ t, id: "fireworks" });
      }
      this.perf.sounds.sort((a, b) => a.t - b.t);
      this.end(at + (n - 1) * 700 + 1800);
    } else if (e === "thunder") {
      // one flash a second at most (no flashing faster than three a second, DESIGN.md §6.7); the sound carries it in Still
      const fl = this.perf.flashes ??= [];
      if (!fl.length) fl.push({ t: 0 });
      this.perf.sounds.push({ t: 0, id: "thunder" });
      this.perf.sounds.sort((a, b) => a.t - b.t);
      this.end(1000);
    } else console.warn("sahne: no env", e);
  }

  move(m: Move, t0: number, tempo: number): { t1: number; inside: number } {
    const a = this.w.actors[m.who], place = this.place;
    if (!a || !place) return { t1: t0, inside: t0 };
    const to = markPos(place, m.to), fly = m.how === "fly";
    if (!to) { console.warn("sahne: no mark", m.to); return { t1: t0, inside: t0 }; }
    // seated: up first, then away
    if (a.seat !== undefined && a.on) { this.track(m.who).seats.push({ t: t0, h: null }); a.seat = undefined; a.seatSide = undefined; t0 += SIT_MS; }
    // a fly from off stage comes in from outside the wide frame, on the side nearer the mark, above it
    const cx = place.camera?.wide?.x ?? 0, hw = (place.camera?.wide?.w ?? place.size.w * 0.86) / 2;
    const flyIn = fly && !a.on, enter = m.how === "enter" || flyIn;
    const doorName = m.from ?? Object.keys(place.marks).find(k => place.marks[k].door && inState(place.marks[k].in, this.w.state));
    const door = doorName ? place.marks[doorName] : undefined;
    // the marks to pass on the way (a stairway's landings)
    const via = (m.via ?? []).map(v => markPos(place, v)).filter((p): p is Vec3 => { if (!p) console.warn("sahne: no mark to pass", m.via); return !!p; });
    let pts: Vec3[], doorLeg = 0;
    const through = (m.how === "enter" || m.how === "exit") && door?.out;
    // a door up a stair (a landing's flat door) keeps its mark's height, on both sides
    const dy = door?.y ?? 0;
    if (m.how === "enter" && door?.out) pts = [[door.out.x, dy, door.out.z], [door.x, dy, door.z], ...via, to];
    else if (m.how === "exit" && door?.out) { pts = [[...a.pos] as Vec3, ...via, [door.x, dy, door.z], [door.out.x, dy, door.out.z]]; doorLeg = via.length; }
    else pts = [flyIn ? [cx + (to[0] < cx ? -1 : 1) * (hw + 0.8), Math.max(to[1], 1.6) + 0.6, to[2]] : [...a.pos] as Vec3, ...via, to];
    // on foot, each leg goes round the place's solid lines (a bird flies over them); the door leg keeps its index
    const solids = fly ? undefined : this.ctx.solids?.[this.w.place ?? ""];
    if (solids?.length) {
      const doorPt = through ? (m.how === "enter" ? 1 : pts.length - 2) : -1, way: Vec3[] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        // only the door's own leg (out to the door mark, or back) passes its leaf
        const leaf = through && (m.how === "enter" ? i === 1 : i === pts.length - 1) ? door?.door : undefined;
        way.push(...(route(pts[i - 1], pts[i], solids, { state: this.w.state, door: leaf, size: place.size }) ?? []), pts[i]);
        if (i === doorPt) doorLeg = way.length - 2;
      }
      pts = way;
    }
    const tr = this.track(m.who);
    // the way of travel: a person three-quarters or her back, an animal side-on
    const yawOf = (d: Vec3) => this.sideOn(m.who) ? this.side(m.who, d[0], 0.05) : travelYaw(d);
    if (enter) {
      tr.on.push({ t: t0, on: true }); a.on = true; a.pos = [...pts[0]] as Vec3;
      tr.turns.push({ t: t0, yaw: yawOf([pts[1][0] - pts[0][0], 0, pts[1][2] - pts[0][2]]), dur: 1 });
      if (flyIn) a.yaw = tr.turns[tr.turns.length - 1].yaw;
    }
    // a fly: the 3D length at FLY_SPEED, a wingbeat each FLAP_S, an arc up to 0.8 m
    const speed = (fly ? FLY_SPEED : m.how === "run" ? RUN_SPEED : m.how === "hop" ? HOP_SPEED : WALK_SPEED) * tempo;
    // walking up or down more than 10 cm is a stair, taken a riser at a time (and slower)
    const steps = fly || m.how === "hop" ? [] : pts.slice(1).map((p, i) => stairSteps(p[1] - pts[i][1]));
    const stair = steps.some(n => n > 0) ? steps : undefined;
    const lens = legLengths(pts, fly, stair);
    const total = lens.reduce((x, y) => x + y, 0);
    const dur = total / speed * 1000 + 300, t1 = t0 + dur, air = fly && !!place.marks[m.to].air, pace = air && !!place.marks[m.to].pace;
    tr.walks.push({ t0, t1, pts, how: m.how ?? "walk", stride: fly ? FLY_SPEED * FLAP_S : this.cat(m.who) ? CAT_STRIDE : (m.how === "hop" && !this.bird(m.who) ? 0.42 : 0.62) * this.height(m.who) / 1.7, ...(fly ? { lift: Math.min(0.8, 0.12 * total), air, ...(pace ? { pace } : {}) } : {}), ...(stair ? { steps: stair } : {}) });
    if (fly || a.air) { a.air = air; a.pace = pace; }
    // face the way of travel at each leg, turning as the leg starts
    let acc = 0, inside = t0;
    lens.forEach((l, i) => {
      const t = t0 + (acc / total) * (dur - 300) + (i ? 0 : -120);
      const d: Vec3 = [pts[i + 1][0] - pts[i][0], 0, pts[i + 1][2] - pts[i][2]];
      if (l > 0.05 && !(i === 0 && enter)) this.turn(m.who, yawOf(d), Math.max(t0, t), i ? 380 : 260);
      acc += l;
      // through the door: the end of the door's leg (the first for an entrance, the one before the last for an exit)
      if (i === doorLeg && door?.out && (m.how === "enter" || m.how === "exit")) inside = t0 + (acc / total) * (dur - 300);
    });
    if ((m.how === "enter" || m.how === "exit") && door?.door) {
      const tDoor = m.how === "enter" ? t0 : inside;
      const pass = m.how === "enter" ? inside : t1;
      this.perf.doors.push({ piece: door.door, t0: Math.max(0, tDoor - 150), t1: pass - 250, mark: doorName });
      this.end(pass + DOOR_CLOSE_MS);
    }
    if (m.how === "exit") { tr.on.push({ t: t1, on: false }); a.on = false; }
    a.pos = [...pts[pts.length - 1]] as Vec3;
    this.end(t1);
    // arriving on a seat, or a mark that says which way to face, a person turns that way (front when it does not say) as the walk ends
    const mk = place.marks[m.to];
    if (mk && m.how !== "exit" && !this.sideOn(m.who) && (mk.seat !== undefined || mk.facing)) this.turn(m.who, mk.facing === "l" ? -TALK_YAW : mk.facing === "r" ? TALK_YAW : mk.facing === "back" ? Math.PI : 0, t1 - 200, 380);
    // onto a seat: sits down as the walk ends
    const seat = place.marks[m.to]?.seat;
    if (seat !== undefined && m.how !== "exit" && !this.sideOn(m.who)) { const side = seatSideOf(place.marks[m.to]); tr.seats.push({ t: t1, h: seat, ...(side ? { side } : {}) }); a.seat = seat; a.seatSide = side; this.end(t1 + SIT_MS); }
    return { t1, inside };
  }

  /** A line (with speech) or a beat (without). */
  line(st: Staging & { who?: string; text?: string; wait?: number }) {
    const w = this.w, ctx = this.ctx, who = st.who, speaker = this.actor(who);
    const tempo = this.tempo(who, st);
    const voice: Voice = st.voice ?? "normal";

    // emotions fade to the resting mood two cues after they were set (unless the speaker gets a new one now)
    for (const a of Object.values(w.actors)) {
      const rest = ctx.rest?.[a.id] ?? "neutral";
      if (a.emo !== rest && w.i - a.emoAt >= 2 && !(a.id === who && st.emo)) { this.track(a.id).emos.push({ t: 0, emo: rest }); a.emo = rest; }
    }

    // the narrator speaks from the inset; the rest of the line's staging still happens on stage
    const narrator = !!who && who === ctx.narrator && !!st.text;
    if (narrator) {
      const sp = ctx.lang.speech(st.text!, { rate: tempo });
      this.perf.bubbles.push({ t0: 150, t1: Infinity, id: `c${w.i}:${who}`, kind: "narrator", text: st.text!, who, voice });
      // the narrator coos as the window opens, then speaks (not again on a narrator line right after another)
      const coo = ctx.narratorSound && w.narr !== w.i - 1 ? ctx.narratorSound : null;
      if (coo) this.perf.sounds.push({ t: 150, id: coo.id });
      const t0 = 150 + (coo ? coo.ms + 80 : 0);
      if (voice !== "silent" && voice !== "mouthing" && sp.words.length) this.perf.lines.push({ t0, t1: t0 + sp.dur, who, text: st.text!, whisper: voice === "whisper", rate: tempo, words: sp.words });
      // in the cast, her beak (or mouth) speaks with the window
      if (speaker && voice !== "silent") this.track(who).speech.push({ t0, t1: t0 + sp.dur, keys: sp.keys, voice });
      this.end(t0 + sp.dur + 300);
      w.narr = w.i;
    }

    const onStage = Object.values(w.actors).filter(a => a.on);
    // the narrator speaks to the viewer, and nobody on stage looks or turns to her
    let to = st.to ?? (narrator && speaker ? "viewer" : undefined);
    const lead = narrator ? undefined : speaker;
    // (nor speaks to her unless told: a line or beat with no one else on stage goes to no one)
    if (!to && speaker) {
      if (w.last && w.last.who !== who && w.actors[w.last.who]?.on) to = w.last.who;
      else {
        const others = onStage.filter(a => a.id !== who && a.id !== ctx.narrator);
        if (others.length) to = others.sort((x, y) => Math.abs(x.pos[0] - speaker.pos[0]) - Math.abs(y.pos[0] - speaker.pos[0]))[0].id;
      }
    }
    const addressee = to && to !== "all" && to !== "viewer" ? this.actor(to) : undefined;

    // ---- moves
    const moves = st.move ? (Array.isArray(st.move) ? st.move : [st.move]) : [];
    const arrive: Record<string, number> = {};
    let entered: number | undefined, entering = false;
    for (const m of moves) {
      const r = this.move(m, arrive[m.who] ?? 0, this.tempo(m.who));
      arrive[m.who] = r.t1;
      if (m.how === "enter") { entering = true; entered = Math.min(entered ?? Infinity, r.inside); }
      if (m.how === "exit") entering = true;
    }
    // ---- a change of clothes, once any walk is done
    for (const [id, key] of Object.entries(st.costume ?? {})) this.dress(id, key, arrive[id] ?? 0);

    // ---- speech timing
    // a beat has no text at all; a line whose text is only "…" is the silent card
    const isLine = st.text !== undefined && !narrator, text = isLine ? st.text! : "";
    const silent = isLine && (voice === "silent" || /^[\s.…]*$/.test(text));
    const sp = isLine && !silent ? ctx.lang.speech(text, { rate: tempo, voice: voice === "whisper" || voice === "mouthing" ? voice : undefined }) : null;
    let tSpeak = who && arrive[who] !== undefined ? arrive[who] + 120 : entered !== undefined ? entered + 150 : 260;

    // ---- obj: work out a give first, because the line is timed to the hand-over
    const ops = st.obj ?? [];
    const give = ops.find(o => o.op === "give" && who);
    let giveAt: number | undefined;
    if (give && who) giveAt = this.planGive(who, give, tempo, sp, tSpeak, v => { tSpeak = v; }, Math.max(120, arrive[who] ?? 0, give.to ? arrive[give.to] ?? 0 : 0));

    const tEnd = sp ? tSpeak + sp.dur : silent && speaker ? tSpeak + 1100 : tSpeak;

    // ---- facing and gaze: the speaker to the addressee, the listeners to the speaker
    const tFace = who && arrive[who] !== undefined ? arrive[who] - 150 : 0;
    if (speaker && addressee && !give) this.turn(speaker.id, this.faceTo(speaker.id, speaker.pos, addressee.pos), Math.max(0, tFace));
    if (speaker && to) this.look(speaker.id, to === "viewer" ? "viewer" : addressee ? "ch:" + addressee.id : null, Math.max(0, tFace));
    let k = 0;
    // a lead off stage (a voice on the phone) draws no looks: there is no one there to look at
    const heard = !!lead && (lead.on || arrive[lead.id] !== undefined);
    for (const a of onStage) {
      if (!lead || !heard || a.id === who || arrive[a.id] !== undefined) continue;
      const tl = 80 + 70 * k++;
      this.look(a.id, "ch:" + lead.id, tl);
      if (!give) this.turn(a.id, this.faceTo(a.id, a.pos, lead.pos), tl + 60);
    }
    for (const [id, t1] of Object.entries(arrive)) {
      const a = w.actors[id];
      const face = id === who ? addressee : lead ?? addressee;
      if (a?.on && face && face.id !== id) { this.turn(id, this.faceTo(id, a.pos, face.pos), t1 - 200); this.look(id, "ch:" + face.id, t1 - 200); }
    }

    // ---- emotion
    if (st.emo && who) this.setEmo(who, st.emo, Math.max(0, tSpeak - 220));

    // ---- the gesture, its stroke on its word
    let stroke: number | undefined, strokeAt: Target | undefined;
    // a breath in the cold is not a gesture: a puff from the mouth, on its word
    if (st.do === "breath" && who) {
      const wt = this.wordTime(sp, st.on, st.link, undefined);
      (this.perf.puffs ??= []).push({ t: wt !== null ? tSpeak + wt : tSpeak, who });
      this.end(tSpeak + 1300);
    } else if (st.do && who && !(give && st.do === "give")) {
      const at = st.at ?? (this.defs(who)[st.do]?.needs?.includes("target") && to ? (to === "viewer" ? "viewer" : "ch:" + to) : undefined);
      const wt = this.wordTime(sp, st.on, st.link, at);
      const r = this.gesture(who, st.do, { stroke: wt !== null ? tSpeak + wt : silent ? tSpeak + 300 : tSpeak, at, n: st.n, loop: st.loop, tempo });
      if (r) {
        stroke = r.stroke; strokeAt = at;
        if (st.do === "look" && at) this.look(who, at, r.t0 + 120);
        // the addressee's eyes follow a point (şu directs attention: Küntay & Özyürek 2006)
        if (at?.startsWith("obj:") && addressee && !st.react?.[addressee.id]) this.look(addressee.id, at, r.stroke + 250);
      }
    }

    // ---- props
    for (const op of ops) {
      if (op === give) continue;
      const tOp = this.opTime(op, sp, tSpeak, st, stroke);
      this.applyOp(who, op, tOp, tempo);
      if ((op.op === "hide" || op.op === "show") && addressee && !st.react?.[addressee.id]) this.look(addressee.id, "obj:" + op.id, tOp + 200);
    }

    // ---- speech and its bubble
    if (who && speaker && isLine) {
      if (sp) {
        this.track(who).speech.push({ t0: tSpeak, t1: tSpeak + sp.dur, keys: sp.keys, voice });
        if (voice !== "mouthing" && sp.words.length) this.perf.lines.push({ t0: tSpeak, t1: tSpeak + sp.dur, who, text, whisper: voice === "whisper", rate: tempo, words: sp.words });
      }
      this.perf.bubbles.push({ t0: tSpeak, t1: Infinity, id: `c${w.i}:${who}`, kind: "speech", text: silent ? "…" : text, who, voice, actor: who });
    }

    // ---- reactions, after the line (at most two)
    const tLine = Math.max(tEnd + 150, (giveAt ?? 0) + 300);
    for (const [id, r0] of Object.entries(st.react ?? {}).slice(0, 2)) {
      const r: Reaction = typeof r0 === "string" ? (this.defs(id)[r0] ? { do: r0 } : { emo: r0 }) : r0;
      if (!w.actors[id]) continue;
      // following a point with the eyes happens as the point lands, not after the line
      const tReact = r.at && r.at === strokeAt && stroke !== undefined ? stroke + 250 : tLine;
      if (r.emo) this.setEmo(id, r.emo, tReact);
      if (r.at) this.look(id, r.at, tReact - 100);
      if (r.do) {
        const g = this.gesture(id, r.do, { start: tReact, at: r.at ?? (who ? "ch:" + who : undefined), tempo: this.tempo(id) });
        if (g && r.do === "look" && r.at) this.look(id, r.at, g.t0 + 120);
      }
      this.end(tReact + 600);
    }

    // ---- sounds and their words
    for (const s of st.sfx ? (Array.isArray(st.sfx) ? st.sfx : [st.sfx]) : []) this.sound(s, entering ? 0 : silent ? tSpeak + 350 : 0, moves);

    // ---- light
    // a switch is flicked on the speaker's gesture stroke, when there is one (a hand on the switch)
    for (const e of [st.env ?? []].flat()) this.env(e, stroke ?? 0);

    // ---- camera
    // a narrator on stage stays out of the shot unless the line frames her
    this.camera(st, narrator && !["follow", "single", "close"].includes(st.cam ?? "") ? undefined : who, addressee?.id, entering, silent, ops, isLine);

    this.end(tEnd + 250);
    if (st.wait) this.end(st.wait);
    // only someone on stage speaking a line becomes the next line's default addressee
    if (who && speaker && isLine) w.last = { who, to };
  }

  /** Hand a prop over: pick it up first if it is lying somewhere, then pass it on the line's first word. */
  planGive(who: string, op: ObjOp, tempo: number, sp: Speech | null, tSpeak: number, setSpeak: (t: number) => void, start = 120): number | undefined {
    const w = this.w, giver = w.actors[who], recv = op.to ? w.actors[op.to] : undefined;
    // what the giver already holds of it comes first, then the thing where it lies
    let src = Object.values(w.props).find(p => (p.id === op.id || p.of === op.id) && p.holder?.actor === who) ?? w.props[op.id];
    if (!giver || !recv || !src || (src.holder && src.holder.actor !== who)) { console.warn("sahne: cannot give", op); return; }
    // both turn towards each other first, once any walking is done
    this.turn(who, this.yawTo(who, giver.pos, recv.pos), start - 120);
    this.turn(recv.id, this.yawTo(recv.id, recv.pos, giver.pos), start - 60);
    const side: Side = src.holder ? src.holder.side : sideOf(giver, recv.pos), rside: Side = sideOf(recv, giver.pos);
    this.look(recv.id, "ch:" + who, start - 60);
    let t = start;
    let inst = src.id;
    if (!src.holder) {
      // pick it up: the giver reaches for it, and at the stroke it is in the hand
      const pick = this.gesture(who, "take", { start: t, at: "obj:" + src.id, tempo, side });
      const tPick = pick?.stroke ?? t;
      this.look(who, "obj:" + src.id, t);
      if (op.n && src.n && op.n < src.n) {
        let k = 1;
        while (w.props[`${src.id}#${k}`]) k++;
        inst = `${src.id}#${k}`;
        const rest = { ...src, n: src.n - op.n };
        w.props[src.id] = rest;
        this.perf.props.push({ t: tPick, id: src.id, state: rest });
        src = { ...src, id: inst, n: op.n };
      }
      const held = { ...src, id: inst, at: null, holder: { actor: who, side } };
      w.props[inst] = held;
      this.perf.props.push({ t: tPick, id: inst, state: { ...held } });
      this.track(who).holds.push({ t: tPick, side, prop: inst });
      t = (pick ? pick.stroke + (pick.t1 - pick.stroke) * 0.3 : t);
    }
    // the hand-over: both hands meet between them on the stroke
    const pass = `pass:${who}:${recv.id}`;
    const g = this.gesture(who, "give", { start: t, at: pass, tempo, side });
    const tGive = g?.stroke ?? t + 400;
    this.look(who, "ch:" + recv.id, t);
    const takeDef = this.defs(recv.id).take;
    if (takeDef) this.gesture(recv.id, "take", { start: Math.max(0, tGive - takeDef.stroke / this.tempo(recv.id)), at: pass, tempo: this.tempo(recv.id), side: rside });
    const now = { ...w.props[inst], at: null, holder: { actor: recv.id, side: rside } };
    w.props[inst] = now;
    this.perf.props.push({ t: tGive, id: inst, state: { ...now } });
    this.track(who).holds.push({ t: tGive, side, prop: null });
    this.track(recv.id).holds.push({ t: tGive, side: rside, prop: inst });
    delete giver.hold[side];
    recv.hold[rside] = inst;
    this.perf.props.sort((a, b) => a.t - b.t);
    // "Buyrun!" as the hand goes out
    if (sp) setSpeak(Math.max(tSpeak, tGive - 260));
    this.end(tGive + 800);
    return tGive;
  }

  /** *Yok*: the thing goes as the gesture lands (or on the last word); *var*: it appears as it is named. */
  opTime(op: ObjOp, sp: Speech | null, tSpeak: number, st: Staging, stroke: number | undefined): number {
    if (!sp || !sp.words.length) return stroke ?? tSpeak;
    const linked = st.link && Object.values(st.link).includes("obj:" + op.id) ? this.wordTime(sp, undefined, st.link, "obj:" + op.id) : null;
    const last = tSpeak + sp.words[sp.words.length - 1].t0;
    if (op.op === "hide") return stroke ?? last;
    return linked !== null ? tSpeak + linked : stroke ?? last;
  }

  applyOp(who: string | undefined, op: ObjOp, t: number, tempo: number) {
    const w = this.w, p = w.props[op.id];
    if (!p) { console.warn("sahne: no prop", op.id); return; }
    let next = { ...p, params: { ...p.params } };
    if (op.op === "hide") next = { ...next, shown: false, ghost: true };
    else if (op.op === "show") next = { ...next, shown: true, ghost: false };
    else if (op.op === "add") next = { ...next, n: (p.n ?? 1) + (op.n ?? 1) };
    else if (op.op === "set") {
      const { n, ...rest } = op.set ?? {};
      // `n` is the count and `still` holds its motion: neither is a parameter of its look
      const { still, ...params } = rest;
      next = { ...next, ...(typeof n === "number" ? { n } : {}), ...(typeof still === "boolean" ? { still } : {}), params: { ...next.params, ...params } };
    }
    else if (op.op === "go") {
      // along marks to a mark: the timeline moves it (`Perf.paths`); a held prop is put down first
      const P = this.place, marks = [...(op.via ?? []), op.to ?? ""];
      const pts = P ? marks.map(m => markPos(P, m.startsWith("mark:") ? m.slice(5) : m)) : [];
      if (p.holder || !p.at || !pts.length || pts.some(x => !x)) { console.warn("sahne: prop cannot go", op.id, p.holder ? "(held)" : "", op.to); return; }
      const path = [p.at, ...pts as Vec3[]], ms = op.ms ?? polyLength(path) / 0.9 * 1000;
      (this.perf.paths ??= []).push({ id: op.id, t0: t, t1: t + ms, pts: path });
      next = { ...next, at: path[path.length - 1] };
      this.end(t + ms);
    }
    else if (op.op === "take" && who) {
      const a = w.actors[who];
      if (!a) return;
      const side = sideOf(a, p.at ?? (p.holder ? w.actors[p.holder.actor]?.pos ?? null : null));
      const g = this.gesture(who, "take", { stroke: t, at: "obj:" + op.id, tempo, side });
      t = g?.stroke ?? t;
      // taking some of a stack splits it, as a give does: the rest stays, the hand holds a prop of its own (`ekmek#1`)
      if (op.n && p.n && op.n < p.n && !p.holder) {
        let k = 1;
        while (w.props[`${p.id}#${k}`]) k++;
        const inst = `${p.id}#${k}`, rest = { ...p, n: p.n - op.n }, held = { ...next, id: inst, n: op.n, at: null, holder: { actor: who, side } };
        w.props[p.id] = rest;
        w.props[inst] = held;
        a.hold[side] = inst;
        this.track(who).holds.push({ t, side, prop: inst });
        this.perf.props.push({ t, id: p.id, state: rest }, { t, id: inst, state: { ...held } });
        this.perf.props.sort((x, y) => x.t - y.t);
        this.end(t + 300);
        return;
      }
      // taken out of someone else's hand: that hand is empty from the stroke on
      if (p.holder && p.holder.actor !== who) {
        const from = w.actors[p.holder.actor];
        if (from) { delete from.hold[p.holder.side]; this.track(from.id).holds.push({ t, side: p.holder.side, prop: null }); }
      }
      next = { ...next, at: null, holder: { actor: who, side } };
      a.hold[side] = op.id;
      this.track(who).holds.push({ t, side, prop: op.id });
    } else if (op.op === "place") {
      // put down on a mark (out of whoever held it)
      const m = op.at ?? op.to, pos = m && this.place ? markPos(this.place, m.startsWith("mark:") ? m.slice(5) : m) : null;
      if (!pos) { console.warn("sahne: no mark to place on", op); return; }
      if (p.holder) {
        const from = w.actors[p.holder.actor];
        if (from) { delete from.hold[p.holder.side]; this.track(from.id).holds.push({ t, side: p.holder.side, prop: null }); }
      }
      next = { ...next, at: pos, holder: undefined };
    } else { console.warn("sahne: obj op not built yet", op.op); return; }
    w.props[op.id] = next;
    this.perf.props.push({ t, id: op.id, state: next });
    this.perf.props.sort((a, b) => a.t - b.t);
    this.end(t + 300);
  }

  /** A sound and its written word, where it comes from: an entrance's sound comes from its door. */
  sound(s: Sfx, t: number, moves: Move[]) {
    let at = s.at;
    const door = moves.find(m => m.how === "enter" || m.how === "exit");
    if (!at && door && this.place) {
      const mark = door.from ?? Object.keys(this.place.marks).find(k => this.place!.marks[k].door);
      if (mark) at = "mark:" + mark;
    }
    this.perf.sounds.push({ t, id: s.id, at, params: s.params });
    const word = s.word ?? this.ctx.soundWord?.(s.id);
    if (word) this.perf.bubbles.push({ t0: t, t1: t + SOUND_MS, id: `c${this.w.i}:sfx:${s.id}:${t}`, kind: "sound", text: word, at });
    this.end(t + SOUND_MS);
  }

  /** The sounds the staging makes by itself: footsteps, a door opening and shutting, a paper flip. */
  autoSounds() {
    const p = this.perf, surface = this.place?.surface;
    for (const [id, tr] of Object.entries(p.tracks)) {
      // a step each time a foot comes down (the walk's phase passes a whole number); a cat's paws are silent
      for (const seg of tr.walks) {
        if (seg.how === "fly" || this.cat(id)) continue;
        let last = Math.floor(walkAt(seg, seg.t0).phase);
        for (let t = seg.t0 + 10; t <= seg.t1; t += 10) {
          const ph = Math.floor(walkAt(seg, t).phase);
          if (ph > last) p.sounds.push({ t, id: "step", at: "ch:" + id, params: surface ? { surface } : undefined, auto: true });
          last = ph;
        }
      }
      // turning past side-on shows the other side of the paper
      let yaw = p.before.actors[id]?.yaw ?? 0, on = p.before.actors[id]?.on ?? false;
      const ons = [...tr.on];
      for (const k of [...tr.turns].sort((a, b) => a.t - b.t)) {
        while (ons.length && ons[0].t <= k.t) on = ons.shift()!.on;
        if (on && k.dur > 1 && Math.sign(Math.cos(yaw) || 1) !== Math.sign(Math.cos(k.yaw) || 1)) p.sounds.push({ t: k.t + k.dur * 0.45, id: "paper_flip", at: "ch:" + id, auto: true });
        yaw = k.yaw;
      }
    }
    for (const d of p.doors) {
      const at = d.mark ? "mark:" + d.mark : undefined;
      p.sounds.push({ t: d.t0, id: "door_open", at, auto: true }, { t: d.t1 + DOOR_CLOSE_MS * 0.8, id: "door_close", at, auto: true });
    }
  }

  /**
   * An act (DESIGN.md §9): the camera frames what the learner acts on (wide unless `cam` says
   * otherwise); the answer (the learner's `result`, else `expect`) then changes the world. A tap or
   * a choice: the learner's actor looks and points at it, and whoever asked looks too. A drag: the
   * prop goes to the person (out of the hand that held it, or taken from where it lies) or onto the
   * mark. A go: the learner's actor walks to the mark and turns to whoever asked.
   */
  act(a: Act) {
    const w = this.w, on = (id?: string) => id && w.actors[id]?.on ? id : undefined;
    const who = on(a.who), by = on(a.by), kind = a.cam ?? "wide";
    const shot: Shot = kind === "wide" ? { kind, ids: [], objs: [] }
      : { kind, ids: [who, by].filter((x): x is string => !!x), objs: a.targets.filter(t => t.startsWith("obj:")).map(t => t.slice(4)).filter(id => w.props[id] && !w.props[id].holder) };
    if (!sameShot(shot, w.shot)) { this.perf.cams.push({ t: 0, shot }); w.shot = shot; }
    this.end(CAM_MS);
    const res = a.result ?? a.expect;
    if (!res) return;
    const tempo = this.tempo(who);
    if (a.kind === "go") {
      if (!who || !res.startsWith("mark:")) return;
      const r = this.move({ who, to: res.slice(5), how: "walk" }, 0, tempo), me = w.actors[who];
      if (by) { this.turn(who, this.yawTo(who, me.pos, w.actors[by].pos), r.t1 - 200); this.look(who, "ch:" + by, r.t1 - 200); }
      return;
    }
    if (a.kind === "drag") {
      const id = a.obj ?? a.targets.find(t => t.startsWith("obj:"))?.slice(4), p = id ? w.props[id] ?? Object.values(w.props).find(q => q.of === id) : undefined;
      if (!p) { console.warn("sahne: nothing to drag", a); return; }
      if (res.startsWith("ch:")) {
        const to = on(res.slice(3).split(".")[0]);
        if (!to) return;
        if (p.holder && p.holder.actor !== to) this.planGive(p.holder.actor, { id: p.id, op: "give", to }, this.tempo(p.holder.actor), null, 0, () => {}, 120);
        else if (!p.holder) this.applyOp(to, { id: p.id, op: "take" }, 300, this.tempo(to));
        if (who && to !== who) this.look(who, "ch:" + to, 0);
      } else if (res.startsWith("mark:")) this.applyOp(who, { id: p.id, op: "place", at: res }, 200, tempo);
      return;
    }
    if (who && !res.startsWith("ch:" + who)) {
      this.look(who, res, 0);
      this.gesture(who, "point", { start: 80, at: res, tempo });
    }
    if (by && by !== who) this.look(by, res, 200);
  }

  camera(st: Staging, who: string | undefined, to: string | undefined, entering: boolean, silent: boolean, ops: ObjOp[], isLine: boolean) {
    const w = this.w;
    let shot: Shot | null = null;
    const objs = ops.filter(o => ["hide", "show", "give", "take"].includes(o.op)).map(o => o.id).filter(id => w.props[id] && !w.props[id].holder);
    if (st.cam === "wide" || (!st.cam && entering)) shot = { kind: "wide", ids: [], objs: [] };
    else if (st.cam) shot = { kind: st.cam, ids: [who, to].filter((x): x is string => !!x && !!w.actors[x]?.on), objs: st.at?.startsWith("obj:") ? [st.at.slice(4)] : objs };
    else if (who && w.actors[who]?.on && (isLine || objs.length)) {
      if (silent) shot = { kind: "close", ids: [who], objs: [] };
      else {
        const ids = [who, to].filter((x): x is string => !!x && !!w.actors[x]?.on);
        shot = { kind: ids.length > 1 ? "two" : "single", ids, objs };
      }
    }
    if (shot && !sameShot(shot, w.shot)) {
      this.perf.cams.push({ t: 0, shot });
      w.shot = shot;
      this.end(CAM_MS);
    }
  }
}

export function direct(w0: World, cue: Cue, i: number, ctx: DirectCtx): Perf {
  const d = new Direction(w0, i, ctx);
  if ("scene" in cue) d.scene(cue.scene);
  else if ("line" in cue) d.line(cue.line);
  else if ("beat" in cue) d.line({ ...cue.beat, text: undefined });
  else if ("act" in cue) d.act(cue.act);
  else d.end(0); // overlay cues are later
  return settle(d);
}

/**
 * A glance off the script (an act's hint or its shown answer): `ids` look at `at`, and `point`
 * points at it; nothing else in the world changes. `i` is the cue the stage is on.
 */
export function glance(w0: World, i: number, ctx: DirectCtx, ids: string[], at: Target, point?: string): Perf {
  const d = new Direction(w0, i, ctx);
  ids.forEach((id, k) => { if (d.w.actors[id]?.on) d.look(id, at, 60 * k); });
  if (point && d.w.actors[point]?.on) d.gesture(point, "point", { start: 100, at, tempo: d.tempo(point) });
  d.end(600);
  return settle(d);
}

function settle(d: Direction): Perf {
  d.autoSounds();
  // the evaluator reads every list in time order, whatever order the parts were planned in
  const byT = (a: { t: number }, b: { t: number }) => a.t - b.t;
  for (const tr of Object.values(d.perf.tracks)) {
    tr.turns.sort(byT); tr.emos.sort(byT); tr.looks.sort(byT); tr.holds.sort(byT); tr.on.sort(byT); tr.costumes.sort(byT);
    tr.walks.sort((a, b) => a.t0 - b.t0); tr.gestures.sort((a, b) => a.t0 - b.t0); tr.speech.sort((a, b) => a.t0 - b.t0);
  }
  d.perf.props.sort(byT); d.perf.cams.sort(byT); d.perf.times.sort(byT); d.perf.sounds.sort(byT);
  d.perf.lines.sort((a, b) => a.t0 - b.t0);
  return d.perf;
}

/** Every cue's performance, each starting from the world the one before it left. */
export function directAll(cues: Cue[], cast: string[], ctx: DirectCtx): Perf[] {
  const out: Perf[] = [];
  let w = emptyWorld(cast);
  cues.forEach((c, i) => { const p = direct(w, c, i, ctx); out.push(p); w = p.after; });
  return out;
}

/** The world after cue `i` (DESIGN.md §4: fold). */
export function fold(cues: Cue[], i: number, cast: string[], ctx: DirectCtx): World {
  return i < 0 ? emptyWorld(cast) : directAll(cues.slice(0, i + 1), cast, ctx)[i].after;
}
