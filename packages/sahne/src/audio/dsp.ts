// The synthesizer (DESIGN.md §8.2): a patch is a small graph of voices, each a source (an
// oscillator, noise, a Karplus–Strong pluck, FM or a set of decaying partials) through an
// envelope, filters and LFOs. Patches are rendered here, in plain code, into sample buffers that
// the audio engine plays: the same patch and seed give the same samples in every browser and in
// Node, so sounds can be tested and drawn as spectrograms. Pure: no DOM, no Web Audio.

import { rng, type Rng } from "../core/rng.ts";

/** A value that glides from `from` to `to` over `time` seconds (exponentially when both are positive). */
export type Curve = number | { from: number; to: number; time: number; curve?: "lin" | "exp" };

/**
 * Amplitude: up over `a`, down to the sustain level `s` over `d` (to −60 dB of the way), held
 * until `hold` seconds from the voice's start, then down over `r` (to −60 dB). Seconds.
 * Without `hold`, a voice with no sustain ends after its decay, and one with a sustain holds to the patch's `dur`.
 */
export interface Env { a?: number; d?: number; s?: number; hold?: number; r?: number }

export type Source =
  /** Band-limited where it matters (saw and square); `detune` adds unison copies, in cents. */
  | { osc: "sine" | "triangle" | "saw" | "square"; f: Curve; detune?: number[] }
  | { noise: "white" | "pink" | "brown" }
  /** A plucked string: `decay` is the time to −60 dB, `bright` 0…1 the pick's brightness. */
  | { pluck: number; decay?: number; bright?: number }
  /** Two-operator FM: a carrier at `fm` Hz, a modulator at `ratio` × that, with this index. */
  | { fm: Curve; ratio: number; index: Curve }
  /** Additive: [ratio to f, amplitude, seconds to −60 dB] per partial (bells, glass, wood). */
  | { partials: [number, number, number][]; f: number };

export interface Filter { type: "lp" | "hp" | "bp"; f: Curve; q?: number }

/** `amp`: depth 0…1 of tremolo; `pitch`: cents; `cut`: octaves. `noise` is a smooth random wander at about `rate` Hz. */
export interface Lfo { rate: number; depth: number; to: "amp" | "pitch" | "cut"; shape?: "sine" | "noise"; delay?: number }

export interface SynthVoice {
  src: Source;
  /** Start, seconds from the patch's start. */
  at?: number;
  gain?: number;
  env?: Env;
  filter?: Filter | Filter[];
  lfo?: Lfo | Lfo[];
}

export interface Patch {
  voices: SynthVoice[];
  /** Length in seconds; the default is where the last voice ends. A loop's length. */
  dur?: number;
  /** The loudest sample after rendering (default 0.7): sounds are levelled by their peak. */
  peak?: number;
  /** Samples per second (default 32000; ambience can take 22050). */
  rate?: number;
}

export interface Rendered { rate: number; data: Float32Array }

const LN1000 = Math.log(1000);

export function curveAt(c: Curve, t: number): number {
  if (typeof c === "number") return c;
  const k = c.time > 0 ? Math.min(1, Math.max(0, t / c.time)) : 1;
  const exp = c.curve ? c.curve === "exp" : c.from > 0 && c.to > 0;
  return exp ? c.from * Math.pow(c.to / c.from, k) : c.from + (c.to - c.from) * k;
}

const constant = (c: Curve) => typeof c === "number";

interface EnvTimes { a: number; d: number; s: number; r: number; hold: number; len: number }

/**
 * A voice's envelope times. A pluck or partials ring for their own decay; a sustained voice holds
 * to the patch's end (`dur`) unless it names `hold`.
 */
function envTimes(v: SynthVoice, dur: number): EnvTimes {
  const e = v.env ?? {}, a = e.a ?? 0.005, d = e.d ?? 0, s = e.s ?? (d > 0 ? 0 : 1), r = e.r ?? 0.05;
  const natural = "pluck" in v.src ? v.src.decay ?? 1.5 : "partials" in v.src ? Math.max(...v.src.partials.map(p => p[2])) : 0;
  const hold = e.hold ?? (s > 0 ? Math.max(a + d, natural, dur - (v.at ?? 0) - r) : a + d);
  return { a, d, s, r, hold, len: hold + r };
}

/** Where a voice ends (seconds after its start), with its release. */
export const voiceLength = (v: SynthVoice, dur: number) => envTimes(v, dur).len;

function envAt(e: EnvTimes, t: number): number {
  if (t < 0 || t > e.len) return 0;
  let v: number;
  if (t < e.a) v = t / e.a;
  else if (e.d > 0) v = e.s + (1 - e.s) * Math.exp(-LN1000 * (t - e.a) / e.d);
  else v = e.s > 0 ? e.s : 1;
  if (t > e.hold) v *= Math.exp(-LN1000 * (t - e.hold) / Math.max(1e-4, e.r));
  return v;
}

/** A smooth random value per `rate` Hz, −1…1 (cosine-interpolated). */
function wander(R: Rng, rate: number, n: number, fs: number): Float32Array {
  const out = new Float32Array(n), per = Math.max(1, Math.round(fs / Math.max(0.01, rate)));
  let a = R() * 2 - 1, b = R() * 2 - 1;
  for (let i = 0; i < n; i++) {
    const k = (i % per) / per;
    if (i > 0 && i % per === 0) { a = b; b = R() * 2 - 1; }
    out[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  }
  return out;
}

// polyBLEP: removes most of the aliasing of a saw or square's jump
function blep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

/** Render one voice's raw source (before the envelope and filters), `n` samples. */
function source(v: SynthVoice, n: number, fs: number, R: Rng, pitchMod: Float32Array | null): Float32Array {
  const out = new Float32Array(n), src = v.src;
  const pm = (i: number) => pitchMod ? Math.pow(2, pitchMod[i] / 1200) : 1;
  if ("osc" in src) {
    const detune = src.detune?.length ? src.detune : [0];
    const fixed = constant(src.f) && !pitchMod;
    for (const cents of detune) {
      const ratio = Math.pow(2, cents / 1200);
      let ph = R();
      const f0 = fixed ? curveAt(src.f, 0) * ratio : 0;
      for (let i = 0; i < n; i++) {
        const f = fixed ? f0 : curveAt(src.f, i / fs) * ratio * pm(i), dt = Math.min(0.49, f / fs);
        let y: number;
        switch (src.osc) {
          case "sine": y = Math.sin(2 * Math.PI * ph); break;
          case "triangle": y = 1 - 4 * Math.abs(Math.round(ph - 0.25) - (ph - 0.25)); break;
          case "saw": y = 2 * ph - 1 - blep(ph, dt); break;
          default: y = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt);
        }
        out[i] += y / detune.length;
        ph += dt; if (ph >= 1) ph -= 1;
      }
    }
  } else if ("noise" in src) {
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = R() * 2 - 1;
      if (src.noise === "white") out[i] = w;
      else if (src.noise === "pink") {
        // Paul Kellet's economy pink filter
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
      } else { last = (last + 0.02 * w) / 1.02; out[i] = last * 3.5; }
    }
  } else if ("pluck" in src) {
    // Karplus–Strong: a burst of noise circulates in a delay line one period long, losing its highs.
    // The two-point average in the loop delays half a sample, so the line is half a sample shorter.
    const f = src.pluck, N = Math.max(1, fs / f - 0.5), len = Math.ceil(N) + 2, line = new Float32Array(len);
    const bright = src.bright ?? 0.6, decay = src.decay ?? 1.5;
    const loss = Math.pow(0.001, 1 / (f * decay));
    let lp = 0;
    const coef = 0.15 + 0.8 * bright;
    for (let i = 0; i < len; i++) { lp += coef * ((R() * 2 - 1) - lp); line[i] = lp; }
    let w = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const rd = (w - N + len * 2) % len, i0 = Math.floor(rd), fr = rd - i0;
      const y = line[i0 % len] * (1 - fr) + line[(i0 + 1) % len] * fr;
      const next = (y + prev) * 0.5 * loss;
      prev = y;
      line[w] = next; w = (w + 1) % len;
      out[i] = y;
    }
  } else if ("fm" in src) {
    let pc = 0, pmod = 0;
    for (let i = 0; i < n; i++) {
      const t = i / fs, fc = curveAt(src.fm, t) * pm(i), I = curveAt(src.index, t);
      out[i] = Math.sin(2 * Math.PI * pc + I * Math.sin(2 * Math.PI * pmod));
      pc += fc / fs; pmod += fc * src.ratio / fs;
      if (pc > 1) pc -= Math.floor(pc); if (pmod > 1) pmod -= Math.floor(pmod);
    }
  } else {
    for (const [ratio, amp, decay] of src.partials) {
      const f = src.f * ratio;
      if (f >= fs * 0.48) continue;
      const k = -LN1000 / (decay * fs);
      let ph = R(), g = amp;
      const step = Math.exp(k), dph = f / fs;
      for (let i = 0; i < n; i++) {
        out[i] += Math.sin(2 * Math.PI * ph) * g;
        ph += dph * pm(i); if (ph >= 1) ph -= 1;
        g *= step;
      }
    }
  }
  return out;
}

/** A state-variable filter (topology-preserving): stable while its cutoff moves. */
function filter(x: Float32Array, fl: Filter, fs: number, cutMod: Float32Array | null): void {
  const q = Math.max(0.3, fl.q ?? 0.707), k = 1 / q;
  let ic1 = 0, ic2 = 0, g = 0, a1 = 0, a2 = 0, a3 = 0;
  const fixed = constant(fl.f) && !cutMod;
  const coef = (fc: number) => {
    g = Math.tan(Math.PI * Math.min(fs * 0.45, Math.max(10, fc)) / fs);
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
  };
  coef(curveAt(fl.f, 0));
  for (let i = 0; i < x.length; i++) {
    if (!fixed && (i & 15) === 0) coef(curveAt(fl.f, i / fs) * (cutMod ? Math.pow(2, cutMod[i]) : 1));
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = fl.type === "lp" ? v2 : fl.type === "bp" ? v1 * k : v0 - k * v1 - v2;
  }
}

function lfoWave(l: Lfo, n: number, fs: number, R: Rng): Float32Array {
  const out = l.shape === "noise" ? wander(R, l.rate, n, fs) : new Float32Array(n);
  if (l.shape !== "noise") { const ph = R(); for (let i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * (ph + l.rate * i / fs)); }
  if (l.delay) for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / (l.delay * fs));
  return out;
}

/** Render a voice into `out` (mixed in), from sample `start`. */
function renderVoice(v: SynthVoice, out: Float32Array, fs: number, R: Rng, dur: number) {
  const start = Math.round((v.at ?? 0) * fs), times = envTimes(v, dur);
  const n = Math.min(out.length - start, Math.ceil(times.len * fs));
  if (n <= 0) return;
  const lfos = v.lfo ? (Array.isArray(v.lfo) ? v.lfo : [v.lfo]) : [];
  const mod = (to: Lfo["to"]) => {
    const ls = lfos.filter(l => l.to === to);
    if (!ls.length) return null;
    const sum = new Float32Array(n);
    for (const l of ls) { const w = lfoWave(l, n, fs, R); for (let i = 0; i < n; i++) sum[i] += w[i] * l.depth; }
    return sum;
  };
  const pitch = mod("pitch"), cut = mod("cut");
  // tremolo: each amp LFO dips the level by up to its depth (0…1)
  let amp: Float32Array | null = null;
  for (const l of lfos.filter(l => l.to === "amp")) {
    amp ??= new Float32Array(n).fill(1);
    const w = lfoWave(l, n, fs, R), d = Math.min(1, l.depth);
    for (let i = 0; i < n; i++) amp[i] *= 1 - d * (0.5 + 0.5 * w[i]);
  }
  const x = source(v, n, fs, R, pitch);
  for (const fl of v.filter ? (Array.isArray(v.filter) ? v.filter : [v.filter]) : []) filter(x, fl, fs, cut);
  const gain = v.gain ?? 1;
  for (let i = 0; i < n; i++) {
    const y = x[i] * envAt(times, i / fs) * gain;
    out[start + i] += amp ? y * amp[i] : y;
  }
}

/** A render in steps, one voice per step, so a long patch can be spread over idle moments. */
export type RenderJob = Generator<void, Rendered, void>;

/** Run a render job to the end. */
export function finish(job: RenderJob): Rendered {
  for (;;) { const r = job.next(); if (r.done) return r.value; }
}

/** Render a patch, one voice per step. */
export function* patchJob(p: Patch, seed: number | string = 1): RenderJob {
  const fs = p.rate ?? 32000, R = rng(seed);
  const dur = p.dur ?? Math.max(0.01, ...p.voices.map(v => (v.at ?? 0) + voiceLength(v, 0)));
  const out = new Float32Array(Math.ceil(dur * fs));
  for (const v of p.voices) { renderVoice(v, out, fs, R, dur); yield; }
  // DC out with a 10 Hz high-pass, not by subtracting the mean: that would lift a silent start
  // and end off zero, and a one-shot would click at both ends
  const k = 1 - 2 * Math.PI * 10 / fs;
  for (let i = 0, px = 0, py = 0; i < out.length; i++) { py = out[i] - px + k * py; px = out[i]; out[i] = py; }
  level(out, p.peak ?? 0.7, false);
  return { rate: fs, data: out };
}

/** Render a patch into samples, levelled to its peak. The same patch and seed give the same samples. */
export const renderPatch = (p: Patch, seed: number | string = 1): Rendered => finish(patchJob(p, seed));

/**
 * A seamless loop of `p.dur` seconds (ambience): rendered `xfade` longer, and the overhang
 * folded back over the start. The two halves' correlation sets the law: equal-power for noise,
 * nearer equal-gain for a steady hum, which an equal-power fade would swell.
 */
export function* loopJob(p: Patch, seed: number | string = 1, xfade = 0.5): RenderJob {
  const fs = p.rate ?? 22050, dur = p.dur ?? 6, X = Math.round(xfade * fs), N = Math.round(dur * fs);
  // a little past the overhang, so held voices are not yet releasing where it is folded back
  const long = (yield* patchJob({ ...p, rate: fs, dur: dur + xfade + 0.1, peak: 1 }, seed)).data;
  const out = long.slice(0, N);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < X; i++) { ab += long[N + i] * long[i]; aa += long[N + i] ** 2; bb += long[i] ** 2; }
  const rho = Math.max(0, Math.min(1, ab / Math.sqrt(aa * bb || 1)));
  for (let i = 0; i < X; i++) {
    const k = i / X, c = Math.cos(k * Math.PI / 2), s = Math.sin(k * Math.PI / 2);
    out[i] = (long[N + i] * c + long[i] * s) / Math.sqrt(1 + 2 * rho * c * s);
  }
  level(out, p.peak ?? 0.7);
  return { rate: fs, data: out };
}

export const renderLoop = (p: Patch, seed: number | string = 1, xfade = 0.5): Rendered => finish(loopJob(p, seed, xfade));

/** Scale to a peak, and take out any DC offset first (unless `dc` is false). */
export function level(x: Float32Array, peak: number, dc = true) {
  let mean = 0;
  if (dc) for (let i = 0; i < x.length; i++) mean += x[i];
  mean /= x.length || 1;
  let max = 0;
  for (let i = 0; i < x.length; i++) { x[i] -= mean; const a = Math.abs(x[i]); if (a > max) max = a; }
  if (max > 1e-9) { const g = peak / max; for (let i = 0; i < x.length; i++) x[i] *= g; }
}

// ---- Analysis, for tests and the gallery's spectrograms ------------------------------------

export function rms(x: Float32Array, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

/** Magnitudes of `bins` frequency bands (0 … fs/2) of a window of `size` samples at `at` (a plain DFT; for small windows). */
export function spectrum(x: Float32Array, at: number, size: number, bins: number): Float32Array {
  const out = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const w = Math.PI * (b + 0.5) / bins;
    let re = 0, im = 0;
    for (let i = 0; i < size; i++) {
      const s = (x[at + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size));
      re += s * Math.cos(w * i); im -= s * Math.sin(w * i);
    }
    out[b] = Math.hypot(re, im) / size;
  }
  return out;
}

/** The strongest pitch in a window, by autocorrelation (Hz), between lo and hi. */
export function pitchOf(x: Float32Array, fs: number, at: number, size: number, lo = 60, hi = 2000): number {
  const l0 = Math.floor(fs / hi), l1 = Math.ceil(fs / lo), c = new Float64Array(l1 + 2);
  let best = 0;
  for (let lag = l0; lag <= l1 + 1; lag++) {
    let s = 0;
    for (let i = 0; i < size; i++) s += (x[at + i] ?? 0) * (x[at + i + lag] ?? 0);
    c[lag] = s; best = Math.max(best, s);
  }
  // the first peak near the best one: every multiple of the period correlates as well
  for (let lag = l0 + 1; lag <= l1; lag++) if (c[lag] >= best * 0.9 && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) return fs / lag;
  return 0;
}
