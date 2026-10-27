// The audio engine (DESIGN.md §8.1): Web Audio with four buses (voice, effects, ambience,
// music), each with its own volume, and music and ambience ducking while a voice speaks. Kit
// sounds and motifs are rendered once by the synthesizer (dsp.ts) and played as buffers; a sound
// with a recording plays the recording instead, once it has loaded (the patch is its fallback).
//
// Sound is off until the app turns it on, from a tap: browsers start audio only after one. While
// the page is hidden, the context sleeps. Where Safari supports it, the session is "ambient" (or the
// app's choice), so an iPhone's silent switch silences everything played here: effects, music and
// recorded voices. "playback" plays through the switch but pauses the device's other audio.

import type { Bus, Kit } from "../core/kit.ts";
import { hashString } from "../core/rng.ts";
import { finish, loopJob, patchJob, type RenderJob, type Rendered } from "./dsp.ts";
import { motifJob } from "./motif.ts";
import { rng } from "../core/rng.ts";

export const DEFAULT_VOLUMES: Record<Bus, number> = { voice: 1, fx: 0.8, ambience: 0.3, music: 0.5 };

/** How far music and ambience go down while a voice speaks: music never plays under speech. */
const DUCK: Partial<Record<Bus, number>> = { music: 0, ambience: 0.45 };

/** An idle moment (with how long it lasts, where the browser says). */
const idle = (cb: (d?: IdleDeadline) => void) => { if (typeof requestIdleCallback === "function") requestIdleCallback(cb, { timeout: 400 }); else setTimeout(() => cb(), 16); };

export interface PlayOptions {
  /** When, in the context's time (seconds); default now. */
  when?: number;
  /** −1 (left) … 1 (right). */
  pan?: number;
  params?: Record<string, unknown>;
  take?: number;
  gain?: number;
}

export interface Playing { stop(): void; readonly when: number }

/** The page's audio session where Safari supports it (`navigator.audioSession`). */
export type AudioSessionType = "ambient" | "playback";

interface Source { node: AudioBufferSourceNode; when: number; bus: Bus }

export class AudioEngine {
  readonly kit: Kit;
  ctx: AudioContext | null = null;
  enabled = false;
  volumes: Record<Bus, number>;
  private master: GainNode | null = null;
  private buses = {} as Record<Bus, GainNode>;
  private ducks = {} as Record<Bus, GainNode>;
  private rendered = new Map<string, Rendered>();
  /** Renders under way, and the ones waiting for an idle moment. */
  private jobs = new Map<string, RenderJob>();
  /** Renders waiting for idle moments, and what to do once the ones before it are done. */
  private queue: { key: string; make?: () => RenderJob; then?: () => void }[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private counts = new Map<string, number>();
  private live = new Set<Source>();
  private loops = new Map<string, { node: AudioBufferSourceNode; gain: GainNode }>();
  private ambient: string[] = [];
  private ducked = false;
  private destroyed = false;
  private unlock = () => { if (this.enabled && this.ctx && this.ctx.state !== "running" && !document.hidden) void this.ctx.resume().catch(() => {}); };
  private onVis = () => {
    if (!this.ctx || !this.enabled) return;
    if (document.hidden) void this.ctx.suspend().catch(() => {}); else this.unlock();
  };

  /** Where the kit's recordings are served from (a URL ending in "/"); without it, only patches play. */
  readonly soundsUrl: string | null;
  readonly session: AudioSessionType;
  private recs = new Map<string, AudioBuffer | null>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private decoder: BaseAudioContext | null = null;

  constructor(kit: Kit, o: { volumes?: Partial<Record<Bus, number>>; sounds?: string; session?: AudioSessionType } = {}) {
    this.kit = kit;
    this.volumes = { ...DEFAULT_VOLUMES, ...o.volumes };
    this.soundsUrl = o.sounds ?? null;
    this.session = o.session ?? "ambient";
  }

  /** Whether a sound plays a recording here. */
  recorded(id: string) { return !!this.kit.sounds?.[id]?.recording && !!this.soundsUrl; }

  /** A sound's recording, fetched and decoded once; null where it has none or it fails to load (the patch plays instead). */
  recording(id: string): Promise<AudioBuffer | null> {
    const rec = this.kit.sounds?.[id]?.recording;
    if (!rec || !this.soundsUrl) return Promise.resolve(null);
    let p = this.loading.get(id);
    if (!p) {
      const url = this.soundsUrl + rec.file;
      p = (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.arrayBuffer();
          // an offline context decodes before the first tap; a buffer plays in any context
          const dec = this.ctx ?? (this.decoder ??= new OfflineAudioContext(1, 1, 48000));
          return await dec.decodeAudioData(data);
        } catch (e) {
          console.warn("sahne: the recording did not load, so the patch plays instead:", url, e);
          return null;
        }
      })();
      void p.then(b => this.recs.set(id, b));
      this.loading.set(id, p);
    }
    return p;
  }

  /** Turn sound on (call it from a tap) or off. */
  setEnabled(on: boolean) {
    if (this.destroyed || on === this.enabled) return;
    this.enabled = on;
    if (on) {
      if (!this.ctx) this.open();
      this.unlock();
      this.ambience(this.ambient, true);
    } else if (this.ctx) {
      this.stopAll();
      for (const id of [...this.loops.keys()]) this.stopLoop(id, 0.05);
      void this.ctx.suspend().catch(() => {});
    }
  }

  private open() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = this.session;
    } catch { /* not supported */ }
    const ctx = this.ctx = new AC({ latencyHint: "interactive" });
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    for (const bus of ["voice", "fx", "ambience", "music"] as const) {
      const duck = this.ducks[bus] = ctx.createGain(), g = this.buses[bus] = ctx.createGain();
      g.gain.value = this.volumes[bus];
      g.connect(duck); duck.connect(this.master);
    }
    for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, this.unlock, true);
    document.addEventListener("visibilitychange", this.onVis);
  }

  setVolume(bus: Bus, v: number) {
    this.volumes[bus] = Math.min(1, Math.max(0, v));
    const g = this.buses[bus];
    if (g && this.ctx) g.gain.setTargetAtTime(this.volumes[bus], this.ctx.currentTime, 0.03);
  }

  /**
   * The voice bus's input, for a voice provider that plays recordings (it takes the context from
   * `voiceOut.context`): its volume is the voice volume, so the provider adds none. Null before sound
   * is first turned on, or where there is no Web Audio.
   */
  get voiceOut(): AudioNode | null { return this.buses.voice ?? null; }

  /** The context's clock (s), or 0 before sound is on. */
  get time() { return this.ctx?.currentTime ?? 0; }
  get running() { return this.enabled && this.ctx?.state === "running"; }

  // ---- Rendering ------------------------------------------------------------------------------

  private key(id: string, take: number, params: Record<string, unknown>) { return `${id}|${take}|${JSON.stringify(params, Object.keys(params).sort())}`; }

  /** A render of a sound's take or a motif, not yet run. */
  private job(id: string, take = 0, params: Record<string, unknown> = {}): { key: string; make: () => RenderJob } | null {
    const def = this.kit.sounds?.[id];
    if (def) {
      const key = this.key(id, take, params), seed = `${id}:${take}:${key}`;
      return { key, make: () => { const patch = def.patch({ rng: rng(seed), take, params }); return def.loop ? loopJob(patch, seed) : patchJob(patch, seed); } };
    }
    const m = this.kit.motifs?.[id];
    if (m && this.kit.instruments) { const inst = this.kit.instruments; return { key: "motif|" + id, make: () => motifJob(m, inst, id) }; }
    return null;
  }

  private run(j: { key: string; make: () => RenderJob }): Rendered {
    let r = this.rendered.get(j.key);
    if (!r) {
      // finish a render already under way in idle moments, or do it all now
      const job = this.jobs.get(j.key) ?? j.make();
      this.jobs.delete(j.key);
      r = finish(job);
      this.rendered.set(j.key, r);
    }
    return r;
  }

  /** The samples of one take of a kit sound, rendered once. For playing, and for the gallery's pictures. */
  render(id: string, take = 0, params: Record<string, unknown> = {}): Rendered | null {
    const j = this.kit.sounds?.[id] ? this.job(id, take, params) : null;
    return j ? this.run(j) : null;
  }

  renderMotif(id: string): Rendered | null {
    const j = this.kit.motifs?.[id] ? this.job(id) : null;
    return j ? this.run(j) : null;
  }

  isRendered(id: string, take = 0, params: Record<string, unknown> = {}) { return this.rendered.has(this.kit.sounds?.[id] ? this.key(id, take, params) : "motif|" + id); }

  /** How long a sound (or a motif) lasts, ms. */
  length(id: string): number {
    const r = this.kit.sounds?.[id] ? this.render(id) : this.renderMotif(id);
    return r ? r.data.length / r.rate * 1000 : 0;
  }

  /**
   * Render sounds ahead of time in idle moments, a voice at a time, so neither preparing nor
   * playing them stalls a frame. Every take of each; `params` for a sound that needs them (a step's surface).
   */
  prepare(list: (string | { id: string; params?: Record<string, unknown> })[], then?: () => void) {
    for (const it of list) {
      const id = typeof it === "string" ? it : it.id, params = typeof it === "string" ? {} : it.params ?? {};
      // a recording loads in the background; its patch is rendered only if it fails
      if (this.recorded(id)) { void this.recording(id).then(b => { if (!b) this.prepare([it]); }); continue; }
      const takes = this.kit.sounds?.[id]?.takes ?? 1;
      for (let k = 0; k < takes; k++) {
        const j = this.job(id, k, params);
        if (j && !this.rendered.has(j.key) && !this.queue.some(q => q.key === j.key)) this.queue.push(j);
      }
    }
    if (then) this.queue.push({ key: "", then });
    this.work();
  }

  private working = false;
  private work() {
    if (this.working || this.destroyed) return;
    this.working = true;
    idle(deadline => {
      this.working = false;
      const until = performance.now() + Math.min(12, deadline ? deadline.timeRemaining() : 8);
      while (this.queue.length && performance.now() < until) {
        const j = this.queue[0];
        if (j.then || !j.make) { this.queue.shift(); j.then?.(); continue; }
        if (this.rendered.has(j.key)) { this.queue.shift(); continue; }
        let job = this.jobs.get(j.key);
        if (!job) { job = j.make(); this.jobs.set(j.key, job); }
        const r = job.next();
        if (r.done) { this.rendered.set(j.key, r.value); this.jobs.delete(j.key); this.queue.shift(); }
      }
      if (this.queue.length) this.work();
    });
  }

  private buffer(key: string, r: Rendered): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let b = this.buffers.get(key);
    if (!b) {
      b = ctx.createBuffer(1, r.data.length, r.rate);
      b.copyToChannel(r.data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(key, b);
    }
    return b;
  }

  // ---- Playing --------------------------------------------------------------------------------

  /** Play a kit sound on its bus. Nothing happens while sound is off or the kit has no such sound. */
  play(id: string, o: PlayOptions = {}): Playing | null {
    const def = this.kit.sounds?.[id];
    if (!def || def.loop || !this.running) return null;
    const takes = def.takes ?? 1;
    // takes in turn from a seeded start, so a run of steps never repeats one take twice in a row
    const n = this.counts.get(id) ?? hashString(id) % takes;
    this.counts.set(id, n + 1);
    const rec = this.recs.get(id);
    if (rec) return this.start(rec, def.bus, o);
    if (this.recorded(id) && !this.recs.has(id)) void this.recording(id);
    const take = o.take ?? n % takes, params = o.params ?? {};
    const r = this.render(id, take, params);
    if (!r) return null;
    return this.start(this.buffer(this.key(id, take, params), r), def.bus, o);
  }

  /** Play a motif on the music bus. */
  motif(id: string, o: PlayOptions = {}): Playing | null {
    if (!this.running) return null;
    const r = this.renderMotif(id);
    return r ? this.start(this.buffer("motif|" + id, r), "music", o) : null;
  }

  private start(buf: AudioBuffer | null, bus: Bus, o: PlayOptions): Playing | null {
    const ctx = this.ctx;
    if (!buf || !ctx) return null;
    const node = ctx.createBufferSource();
    node.buffer = buf;
    let out: AudioNode = node;
    if (o.gain !== undefined && o.gain !== 1) { const g = ctx.createGain(); g.gain.value = o.gain; out.connect(g); out = g; }
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); out.connect(p); out = p; }
    out.connect(this.buses[bus]);
    const when = Math.max(ctx.currentTime, o.when ?? 0);
    const src: Source = { node, when, bus };
    this.live.add(src);
    node.onended = () => this.live.delete(src);
    node.start(when);
    return { when, stop: () => { try { node.stop(); } catch { /* not started */ } this.live.delete(src); } };
  }

  /** Stop the sounds scheduled for later (a skipped performance); the ones already sounding ring on. */
  stopPending() {
    const now = this.time;
    for (const s of [...this.live]) if (s.when > now + 0.005 && s.bus !== "ambience") { try { s.node.stop(); } catch { /* */ } this.live.delete(s); }
  }

  /** Stop every one-shot now. */
  stopAll() {
    for (const s of [...this.live]) { try { s.node.stop(); } catch { /* */ } }
    this.live.clear();
  }

  /** Crossfade the ambience to these loops (a scene's place). */
  ambience(ids: string[], force = false) {
    const want = ids.filter(id => this.kit.sounds?.[id]?.loop);
    if (!force && want.join() === this.ambient.join() && (!this.enabled || want.every(id => this.loops.has(id)))) return;
    this.ambient = want;
    if (!this.enabled || !this.ctx) return;
    for (const id of [...this.loops.keys()]) if (!want.includes(id)) this.stopLoop(id, 1.2);
    for (const id of want) {
      if (this.loops.has(id)) continue;
      const again = () => { if (this.ambient.includes(id)) this.ambience(this.ambient, true); };
      // a recording: once it has loaded (or failed, and the patch takes over)
      if (this.recorded(id) && !this.recs.has(id)) { void this.recording(id).then(again); continue; }
      const rec = this.recs.get(id) ?? null, span = rec ? this.kit.sounds![id].recording!.loop : undefined;
      // a loop is several seconds of samples: render it in an idle moment, then fade it in
      if (!rec && !this.isRendered(id)) { this.prepare([id], again); continue; }
      const r = rec ? null : this.render(id), ctx = this.ctx!;
      const buf = rec ?? (r && this.buffer(this.key(id, 0, {}), r));
      if (!buf) continue;
      const node = ctx.createBufferSource(), gain = ctx.createGain();
      node.buffer = buf; node.loop = true;
      const [a, b] = span ?? [0, buf.duration];
      if (span) { node.loopStart = a; node.loopEnd = b; }
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      node.connect(gain); gain.connect(this.buses.ambience);
      // start somewhere inside the loop, so two places' loops never line up
      node.start(ctx.currentTime, a + (hashString(id) % 1000) / 1000 * (b - a));
      this.loops.set(id, { node, gain });
    }
  }

  private stopLoop(id: string, fade: number) {
    const l = this.loops.get(id), ctx = this.ctx;
    if (!l || !ctx) return;
    this.loops.delete(id);
    l.gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    try { l.node.stop(ctx.currentTime + fade); } catch { /* */ }
  }

  /** A voice is speaking: music goes away and ambience goes down, and they come back after. */
  duck(on: boolean) {
    if (on === this.ducked) return;
    this.ducked = on;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [bus, level] of Object.entries(DUCK) as [Bus, number][]) {
      this.ducks[bus].gain.setTargetAtTime(on ? level : 1, ctx.currentTime, on ? 0.06 : 0.35);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAll();
    for (const ev of ["pointerdown", "keydown", "touchend"]) document.removeEventListener(ev, this.unlock, true);
    document.removeEventListener("visibilitychange", this.onVis);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
