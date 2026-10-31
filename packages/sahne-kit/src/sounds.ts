// The kit's sounds (DESIGN.md §8.2, STYLE.md "Sound"): every effect and ambience is a patch
// written here, from a few strokes: a noise burst, struck partials, a bell, a held tone.
// Ids are permanent; the Turkish sound words are teaching content.

import { noteFreq, voiceLength, type Filter, type Recording, type Rng, type SoundDef, type SynthVoice as V } from "sahne";

export const lp = (f: Filter["f"], q?: number): Filter => ({ type: "lp", f, q });
export const hp = (f: Filter["f"], q?: number): Filter => ({ type: "hp", f, q });
export const bp = (f: Filter["f"], q?: number): Filter => ({ type: "bp", f, q });

type Noise = "white" | "pink" | "brown";
type Parts = [number, number, number][];

/** A noise burst: up in `a`, down to −60 dB over `d`. */
export const hit = (at: number, d: number, filter: Filter | Filter[], gain = 1, noise: Noise = "white", a = 0.0005): V =>
  ({ src: { noise }, at, gain, env: { a, d }, filter });

/** Struck partials, [ratio, level, seconds to −60 dB] over `f`; rendered until the longest has died, not to the patch's end. */
export const ring = (f: number, parts: Parts, at = 0, gain = 1): V => ({ src: { partials: parts, f }, at, gain, env: { a: 0.0006, hold: Math.max(...parts.map(p => p[2])) } });

/** A held noise bed (ambience): no envelope, so it runs the loop's whole length. */
const bed = (noise: Noise, filter: Filter | Filter[], gain: number, lfo: V["lfo"]): V => ({ src: { noise }, filter, gain, lfo });

/** A small bright bell (free-bar modes, a slowly beating pair) and its strike. `T` is the ring. */
export const bell = (f: number, at: number, gain: number, T: number, beat = 1.006): V[] => [
  ring(f, [[1, 1, T], [beat, 0.5, T * 0.9], [2.76, 0.4, T * 0.45], [5.4, 0.2, T * 0.25], [8.93, 0.08, T * 0.14]], at, gain),
  hit(at, 0.005, hp(3500), gain * 0.12),
];

/** A tulip tea glass struck at `f`. */
const glass = (f: number, at: number, gain: number, T: number): V[] => [
  ring(f, [[1, 1, T], [2.32, 0.45, T * 0.6], [4.25, 0.25, T * 0.35], [6.63, 0.12, T * 0.2]], at, gain),
  hit(at, 0.004, hp(4000), gain * 0.3),
];

/** A soft marimba-like tone (phone tunes). */
const mallet = (f: number, at: number, gain: number): V => ({ ...ring(f, [[1, 1, 0.4], [3.99, 0.2, 0.1], [9.9, 0.05, 0.03]], at, gain), filter: hp(350) });

/** A held tone with a glide, for calls and beeps. */
const tone = (osc: "sine" | "triangle" | "saw" | "square", f: number, f1: number, at: number, len: number, gain: number, a = 0.004, r = 0.05): V =>
  ({ src: { osc, f: f1 === f ? f : { from: f, to: f1, time: len } }, at, gain, env: { a, hold: len, r } });

const XF = 0.5; // renderLoop's crossfade
/**
 * Events over a loop of `dur` at `times`. One that runs past the end is repeated before the start,
 * and one inside the crossfade after the end, so the seam stays continuous and as dense as the rest.
 */
function scatter(dur: number, times: number[], make: (at: number) => V[]): V[] {
  const out: V[] = [];
  for (const t of times) for (const v of make(t)) {
    const at = v.at ?? 0;
    out.push(v);
    if (at + voiceLength(v, 0) > dur) out.push({ ...v, at: at - dur });
    if (at < XF) out.push({ ...v, at: at + dur });
  }
  return out;
}
const uniform = (R: Rng, dur: number, n: number) => Array.from({ length: n }, () => R.range(0, dur));
/** Times spaced `lo`…`hi` apart, from a random start. */
function spaced(R: Rng, dur: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = R.range(0, lo); t < dur; t += R.range(lo, hi)) out.push(t);
  return out;
}

const fx = (tr: string | null, en: string | null, patch: SoundDef["patch"], takes?: number): SoundDef =>
  ({ bus: "fx", ...(tr && en ? { word: { tr, en } } : {}), ...(takes ? { takes } : {}), patch });
const amb = (tr: string | null, en: string | null, dur: number, voices: (R: Rng, dur: number) => V[]): SoundDef =>
  ({ bus: "ambience", loop: true, ...(tr && en ? { word: { tr, en } } : {}), patch: ({ rng }) => ({ rate: 22050, dur, peak: 0.5, voices: voices(rng, dur) }) });

/** One footstep: a heel and, a moment later, the sole. */
function step(R: Rng, surface: string): V[] {
  const j = (x: number) => x * R.range(0.85, 1.15);
  const strike = (at: number, g: number): V[] =>
    surface === "stone" ? [hit(at, j(0.022), [bp(j(2200), 2), lp(7000)], g), ring(j(3100), [[1, 0.3, 0.02], [1.6, 0.2, 0.012]], at, g * 0.35), hit(at, j(0.02), hp(5000), g * 0.08), hit(at, 0.05, lp(250), g * 0.6, "brown")]
    : surface === "wood" ? [ring(j(150), [[1, 1, 0.09], [1.7, 0.5, 0.06], [2.6, 0.3, 0.04]], at, g * 0.8), hit(at, j(0.025), bp(j(1200), 1), g * 0.5)]
    : surface === "carpet" ? [hit(at, j(0.04), lp(j(450)), g, "pink", 0.004)]
    : [hit(at, j(0.018), bp(j(1900), 1.5), g), ring(j(2300), [[1, 0.3, 0.03], [1.8, 0.2, 0.02]], at, g * 0.4), tone("sine", 95, 60, at, 0.02, g * 0.4, 0.001, 0.05)];
  return [...strike(0, R.range(0.85, 1)), ...strike(R.range(0.025, 0.045), R.range(0.35, 0.6))];
}

/** One coo: a soft, hollow tone that swells and fades, falling a little. */
const coo = (at: number, len: number, f0: number, f1: number, g: number): V[] => {
  const env = { a: Math.min(0.12, len * 0.4), d: len * 1.5, s: 0.35, hold: len, r: 0.09 };
  return [
    ...[1, 2, 3].map((h, i): V => ({ ...tone("sine", f0 * h, f1 * h, at, len, g * [1, 0.12, 0.04][i]), env })),
    { src: { noise: "pink" }, at, gain: g * 0.25, env, filter: [bp(f0, 8), lp(1500)] },
  ];
};

/** A herring gull's call: a nasal, falling saw through the beak's formants. */
const gull = (at: number, len: number, f0: number, g: number): V[] => [
  ...[1900, 3300].map((f, i): V => ({
    ...tone("saw", f0 * 1.15, f0 * 0.78, at, len, g * (i ? 0.45 : 1), 0.02, 0.04),
    filter: [bp(f, 2.5), lp(5000)], lfo: { rate: 12, depth: 50, to: "pitch", shape: "noise" },
  })),
  hit(at, 0.02, bp(2600, 2), g * 0.4),
];

/** The Istanbul tram's struck bell: a heavier bell with a hum below and a minor third. */
const gong = (f: number, at: number, g: number): V[] => [
  ring(f, [[0.5, 0.2, 1.4], [1, 1, 1.2], [1.004, 0.6, 1.15], [1.19, 0.35, 0.8], [1.5, 0.25, 0.6], [2, 0.4, 0.5], [2.52, 0.2, 0.35], [3.01, 0.12, 0.25], [4.1, 0.06, 0.15]], at, g),
  hit(at, 0.01, bp(3500, 1), g * 0.2),
];

/** A ship's horn: detuned saws, the filter opening as it swells. */
const horn = (f: number, at: number, g: number, top: number): V => ({
  src: { osc: "saw", f, detune: [-5, 0, 6] }, at, gain: g, env: { a: 0.45, hold: 1.5, r: 0.45 },
  filter: [lp({ from: top * 0.25, to: top, time: 0.8 }, 1.3), lp(top * 1.5)], lfo: { rate: 3, depth: 4, to: "pitch", shape: "noise" },
});

/** A car passing: tyres and an engine note that falls as it goes by. */
function car(R: Rng, at: number, g: number, top: number): V[] {
  const e = R.range(50, 85), len = R.range(2.2, 3.2), env = { a: len * 0.45, hold: len * 0.5, r: len * 0.5 };
  return [
    { src: { noise: "pink" }, at, gain: g, env, filter: [lp({ from: top, to: top * 0.6, time: len }), hp(80)] },
    { src: { osc: "saw", f: { from: e * 1.05, to: e * 0.93, time: len } }, at, gain: g * 0.35, env, filter: lp(top * 0.4) },
  ];
}

/** A distant talker: a voiced buzz through a wandering formant, gated into syllables (and, where the gate stays shut, pauses). */
const talker = (R: Rng, top: number): V => ({
  src: { osc: "saw", f: R.range(95, 230) }, gain: R.range(0.5, 1), filter: [bp(R.range(450, 800), 2), lp(top)],
  lfo: [
    { rate: R.range(3.5, 6), depth: 1, to: "amp", shape: "noise" },
    { rate: R.range(2, 4), depth: 150, to: "pitch", shape: "noise" },
    { rate: R.range(4, 7), depth: 1, to: "cut", shape: "noise" },
  ],
});

/** One remark in a conversation nearby: a buzz drifting in pitch through a formant, gated into syllables. Cheaper than a talker. */
const chat = (R: Rng, at: number, len: number, top: number, g: number): V => {
  const f = R.range(100, 240);
  return {
    src: { osc: "saw", f: { from: f, to: f * R.range(0.75, 1.15), time: len, curve: "lin" } }, at, gain: g, env: { a: 0.08, hold: len, r: 0.15 },
    filter: [bp(R.range(450, 850), 2), lp(top)], lfo: { rate: R.range(4, 6.5), depth: 1, to: "amp", shape: "noise" },
  };
};

/** A laugh: ha-ha-ha, falling a little. */
const laugh = (R: Rng, at: number, g: number): V => {
  const f = R.range(190, 300);
  return {
    src: { osc: "saw", f: { from: f * 1.2, to: f, time: 0.6, curve: "lin" } }, at, gain: g, env: { a: 0.02, hold: R.range(0.4, 0.7), r: 0.12 },
    filter: [bp(R.range(700, 1000), 2.5), lp(3000)], lfo: { rate: R.range(5.5, 7), depth: 0.95, to: "amp" },
  };
};

/** A voice: a buzz through formants `F` (one or two), gliding f0 → f1 (a vendor's call, a cat). */
const vox = (f0: number, f1: number, at: number, len: number, g: number, F: Filter["f"][], a = 0.03, r = 0.08, lfo?: V["lfo"]): V[] =>
  F.map((f, i): V => ({ ...tone("saw", f0, f1, at, len, g / (1 + i), a, r), filter: [bp(f, 2.5 + 2 * i), lp(4500)], lfo }));

/**
 * People singing a line together: `notes` are [name, steps]; each singer (an octave factor) is a buzz
 * through an open "a" at `F`, a little off the others in pitch (`cents`) and time, with a late vibrato of `vib` cents.
 */
function choir(R: Rng, notes: [string, number][], step: number, singers: number[], F: number, cents: number, vib = 0): V[] {
  return singers.flatMap(oct => {
    const d = oct * 2 ** (R.range(-cents, cents) / 1200), lag = R.range(0, 0.04), g = R.range(0.6, 1);
    let t = 0.01;
    return notes.map(([n, k]): V => {
      const f = noteFreq(n) * d, v: V = { ...tone("saw", f, f, t + lag, k * step - 0.03, g, 0.04, 0.09), filter: [bp(F, 1.3), lp(F * 3.5)] };
      if (vib) v.lfo = { rate: 5.5, depth: vib, to: "pitch", delay: 0.12 };
      t += k * step;
      return v;
    });
  });
}

/** Voices again `n` times, `dt` apart, each `k` as loud as the last: bare walls' flutter echo. */
const echo = (vs: V[], n: number, dt: number, k: number): V[] =>
  vs.flatMap(v => Array.from({ length: n + 1 }, (_, i) => ({ ...v, at: (v.at ?? 0) + i * dt, gain: (v.gain ?? 1) * k ** i })));

/** A church bell: hum, prime, minor third, fifth and nominal, the low ones ringing longest. */
const churchBell = (f: number, at: number, g: number): V[] => [
  ring(f, [[0.5, 0.35, 1.45], [1, 1, 1.3], [1.005, 0.5, 1.2]], at, g),
  ring(f, [[1.2, 0.45, 0.9], [1.5, 0.25, 0.6], [2, 0.5, 0.5]], at, g),
  ring(f, [[2.51, 0.25, 0.35], [3.01, 0.15, 0.22], [4.15, 0.08, 0.14]], at, g),
  hit(at, 0.012, bp(1400, 1), g * 0.25),
];

export const SOUNDS: Record<string, SoundDef> = {
  // four ticks half a second apart, the tick brighter than the tock: crisp and dry
  clock_tick: fx("tik tak", "tick tock", ({ rng: R }) => ({
    peak: 0.75, dur: 2, voices: [0, 1, 2, 3].flatMap(i => {
      const tick = i % 2 === 0, at = 0.03 + i * 0.5 + R.range(-0.004, 0.004), g = R.range(0.92, 1);
      return [
        hit(at, 0.012, bp(tick ? 4200 : 2500, 2.5), g),
        ring(tick ? 3100 : 1700, [[1, 0.5, 0.035], [1.73, 0.3, 0.025], [2.9, 0.2, 0.015]], at, g * 0.5),
        ring(tick ? 950 : 620, [[1, 0.3, 0.05]], at, g * 0.35),
      ];
    }),
  })),
  // three knuckle knocks: the door panel's low modes and the knuckle's click
  knock: fx("tık tık", "knock knock", ({ rng: R }) => ({
    peak: 0.75, voices: [0, 0.17, 0.36].flatMap((t, i) => {
      const g = [1, 0.8, 0.92][i] * R.range(0.9, 1), f = R.range(160, 185);
      return [ring(f, [[1, 1, 0.16], [1.58, 0.6, 0.1], [2.31, 0.45, 0.07], [3.9, 0.25, 0.04], [5.3, 0.15, 0.025]], t, g), hit(t, 0.025, bp(1100, 1.2), g * 0.5), hit(t, 0.06, lp(300), g * 0.8, "brown")];
    }),
  })),
  // the brass bell over the shop door: a pair of small bells jangling, quicker strikes first
  doorbell: fx("çın çın", "ding-a-ling", ({ rng: R }) => {
    const v: V[] = [];
    for (let i = 0, t = 0, g = 1; i < 7; i++, g *= 0.75) { v.push(...bell(i % 2 ? 2390 : 2170 * R.range(0.997, 1.003), t, g, 0.55)); t += 0.06 + i * 0.022 + R.range(0, 0.02); }
    return { peak: 0.7, voices: v };
  }),
  // the latch lets go, then the hinge creaks: stick–slip pulses through the door's resonances
  door_open: fx("gıcırt", "creak", () => ({
    peak: 0.65, voices: [
      ring(1850, [[1, 0.6, 0.03], [2.7, 0.4, 0.02], [4.4, 0.3, 0.012]], 0, 0.6), hit(0, 0.01, hp(2500), 0.4),
      ...([[{ from: 900, to: 1400, time: 0.45 }, 5, 1], [2300, 6, 0.4]] as const).map(([f, q, g]): V => ({
        ...tone("saw", 55, 95, 0.08, 0.4, g, 0.06, 0.08), filter: [bp(f, q), lp(4000)],
        lfo: [{ rate: 14, depth: 350, to: "pitch", shape: "noise" }, { rate: 20, depth: 0.5, to: "amp", shape: "noise" }],
      })),
    ],
  })),
  // a soft wooden thud and the latch catching
  door_close: fx("küt", "thud", () => ({
    peak: 0.7, voices: [
      tone("sine", 120, 58, 0, 0.12, 1, 0.002, 0.25), hit(0, 0.12, lp(500), 0.8, "pink"), hit(0, 0.03, bp(900, 1), 0.4),
      ring(1650, [[1, 0.6, 0.03], [2.6, 0.4, 0.02], [4.1, 0.25, 0.012]], 0.025, 0.4), hit(0.025, 0.008, hp(2500), 0.25),
    ],
  })),
  step: fx("tak", "step", ({ rng: R, params }) => {
    const s = String(params.surface ?? "tile");
    return { peak: ({ stone: 0.42, wood: 0.4, carpet: 0.025 } as Record<string, number>)[s] ?? 0.38, voices: step(R, s) };
  }, 4),
  // a çaydanlık on the boil: rumble, rising bubbles (thicker as it boils) and a steam hiss
  kettle: fx("fokur fokur", "bubble bubble", ({ rng: R }) => {
    const v: V[] = [
      { src: { noise: "brown" }, env: { a: 0.3, hold: 2.1, r: 0.35 }, filter: lp(350), gain: 0.7, lfo: { rate: 6, depth: 0.5, to: "amp", shape: "noise" } },
      { src: { noise: "white" }, env: { a: 0.9, hold: 2.1, r: 0.35 }, filter: bp({ from: 4500, to: 6500, time: 2.4 }, 1.2), gain: 0.2, lfo: { rate: 3, depth: 0.3, to: "amp", shape: "noise" } },
    ];
    for (let i = 0; i < 110; i++) { const f = R.range(250, 900); v.push({ ...tone("sine", f, f * 1.6, 0.05 + 2.2 * Math.sqrt(R()), 0.03, R.range(0.12, 0.45), 0.001, 0.03) }); }
    return { peak: 0.65, voices: v };
  }),
  // the glass meets the saucer, bounces once
  tea_glass: fx("çın", "clink", () => ({
    peak: 0.65, voices: [0, 0.028].flatMap((t, i) => {
      const g = i ? 0.35 : 1;
      return [...glass(2650, t, g, 0.45), ring(1720, [[1, 0.7, 0.4], [1.71, 0.45, 0.3], [2.93, 0.35, 0.2], [4.6, 0.2, 0.1]], t, g * 0.7), hit(t, 0.015, bp(900, 1), g * 0.3)];
    }),
  })),
  // a teaspoon stirring: light clinks on the glass over a swirl of tea
  spoon_glass: fx("şıkır şıkır", "clink clink", ({ rng: R }) => ({
    peak: 0.6, voices: [
      { src: { noise: "pink" }, env: { a: 0.15, hold: 1.1, r: 0.2 }, filter: bp(700, 1), gain: 0.1, lfo: { rate: 4.2, depth: 0.6, to: "amp" } },
      ...[0, 0.23, 0.48, 0.7, 0.95, 1.16].flatMap(t => {
        const at = t + R.range(0, 0.04), g = R.range(0.5, 1);
        return [...glass(R.range(2900, 3150), at, g, 0.22), ring(5400, [[1, 0.3, 0.05], [2.9, 0.15, 0.02]], at, g * 0.5)];
      }),
    ],
  })),
  gull: fx("ak ak", "squawk", () => ({ peak: 0.7, voices: [...gull(0, 0.36, 700, 1), ...gull(0.52, 0.16, 760, 0.85), ...gull(0.76, 0.17, 740, 0.8)] })),
  tram_bell: fx("dın dın", "ding ding", () => ({ peak: 0.75, voices: [...gong(1180, 0, 1), ...gong(1180, 0.34, 0.85)] })),
  // the metro's doors closing: quick beeps
  metro_chime: fx("dıt dıt dıt", "beep beep", () => ({
    peak: 0.65, voices: [0, 1, 2, 3, 4, 5].map(i => ({ ...tone("triangle", 1240, 1240, i * 0.19, 0.1, 1, 0.004, 0.015), filter: lp(5000) })),
  })),
  // a ferry's horn across the water: a low fifth swelling, and its echo off the far shore
  ferry_horn: fx("düüüt", "toot", () => ({ peak: 0.7, voices: [horn(98, 0, 1, 1100), horn(147, 0, 0.45, 1100), horn(98, 0.35, 0.18, 450)] })),
  // a friendly ringtone: two bursts of a rising arpeggio
  phone_ring: fx("zırr zırr", "ring ring", () => ({
    peak: 0.7, voices: [0, 1.1].flatMap(t0 => [1175, 1480, 1760, 1480, 1760, 2349].map((f, i) => mallet(f, t0 + i * 0.09, i === 5 ? 1 : 0.8))),
  })),
  message: fx("dıt", "ping", () => ({ peak: 0.65, voices: [mallet(1760, 0, 0.8), mallet(2349, 0.085, 1)] })),
  // a phone camera's shutter: two clicks
  shutter: fx("çıt", "click", () => ({
    peak: 0.7, voices: [
      hit(0, 0.012, bp(3200, 1.5), 0.8), ring(4600, [[1, 0.4, 0.012], [1.6, 0.3, 0.01]], 0, 0.4),
      hit(0.07, 0.02, bp(2200, 1.2), 1), hit(0.07, 0.03, lp(400), 0.5, "brown"), ring(3800, [[1, 0.3, 0.015]], 0.07, 0.4),
    ],
  })),
  // a page lifted (crackling), the air as it falls, and its landing
  page_turn: fx("hışır", "rustle", ({ rng: R }) => ({
    peak: 0.6, voices: [
      { src: { noise: "white" }, env: { a: 0.12, hold: 0.3, r: 0.12 }, filter: bp({ from: 1800, to: 4200, time: 0.35 }, 0.8), gain: 0.7, lfo: { rate: 45, depth: 0.85, to: "amp", shape: "noise" } },
      { src: { noise: "pink" }, at: 0.18, env: { a: 0.06, hold: 0.2, r: 0.12 }, filter: lp(700), gain: 0.5 },
      hit(0.42, 0.025, bp(1500, 1), 0.6),
      ...uniform(R, 0.38, 12).map(t => hit(t + 0.03, 0.003, hp(3000), R.range(0.2, 0.6))),
    ],
  })),
  // the puppet turning: a quick, soft whisk of paper
  paper_flip: fx("hışır", "flip", ({ rng: R }) => ({
    peak: 0.35, voices: [
      { src: { noise: "white" }, env: { a: 0.04, hold: 0.07, r: 0.05 }, filter: bp({ from: R.range(1300, 1700), to: R.range(3000, 3800), time: 0.1 }, 0.9), lfo: { rate: 40, depth: 0.6, to: "amp", shape: "noise" } },
      hit(R.range(0.03, 0.08), 0.003, hp(3000), 0.4), hit(0.11, 0.02, bp(900, 1), 0.3),
    ],
  }), 3),
  // Kerim: coo-COOO-coo, hollow and soft, each note falling a little
  coo: fx("gu guu gu", "coo", () => ({ peak: 0.7, voices: [...coo(0, 0.2, 520, 505, 0.75), ...coo(0.3, 0.5, 560, 495, 1), ...coo(0.92, 0.24, 505, 470, 0.8)] })),
  ui_tap: fx(null, null, () => ({ peak: 0.35, voices: [tone("sine", 1500, 900, 0, 0.02, 1, 0.001, 0.03), hit(0, 0.004, lp(3500), 0.4)] })),

  // ---- the places' effects (M2) -----------------------------------------------------------
  // a room clapping: dozens of hands, cupped and flat, swelling in and dying away
  applause: fx("şak şak", "clap clap", ({ rng: R }) => {
    const sw = (t: number) => Math.min(1, t / 0.35, (2.1 - t) / 0.8);
    return {
      peak: 0.7, voices: [
        { src: { noise: "pink" }, env: { a: 0.35, hold: 1.4, r: 0.6 }, filter: bp(1400, 0.8), gain: 0.25, lfo: { rate: 25, depth: 0.5, to: "amp", shape: "noise" } },
        ...uniform(R, 2.05, 90).map(t => hit(t, R.range(0.008, 0.02), bp(R.range(800, 2400), R.range(1.2, 3)), R.range(0.4, 1) * sw(t))),
      ],
    };
  }, 2),
  // Kerim's beak on the window: three quick taps, the pane ringing a little
  beak_tap: fx("tık tık tık", "tap tap tap", ({ rng: R }) => ({
    peak: 0.7, voices: [0, 0.12, 0.23].flatMap((t, i) => {
      const at = t + R.range(0, 0.02), g = [1, 0.8, 0.9][i] * R.range(0.85, 1);
      return [hit(at, 0.006, bp(R.range(3200, 4000), 2), g), ring(R.range(1300, 1550), [[1, 0.5, 0.06], [2.32, 0.35, 0.04], [4.25, 0.2, 0.025]], at, g * 0.6), hit(at, 0.02, lp(700), g * 0.3, "brown")];
    }),
  }), 2),
  // the kombi's fault beeper: three shrill piezo beeps
  boiler_beep: fx("bip bip bip", "beep beep beep", () => ({
    peak: 0.65, voices: [0, 0.2, 0.4].map(t => ({ ...tone("square", 2730, 2730, t, 0.11, 1, 0.003, 0.01), filter: lp(6000) })),
  })),
  // the bus's doors: a blast of air, the leaves folding with a rattle, the rubber edges meeting
  bus_doors: fx("fışşş", "pssh", () => ({
    peak: 0.7, voices: [
      { src: { noise: "white" }, env: { a: 0.01, hold: 0.25, r: 0.4 }, filter: bp({ from: 3800, to: 2200, time: 0.5 }, 0.9) },
      { src: { noise: "pink" }, at: 0.08, env: { a: 0.05, hold: 0.42, r: 0.08 }, filter: bp(900, 2), gain: 0.4, lfo: { rate: 30, depth: 0.7, to: "amp", shape: "noise" } },
      tone("sine", 110, 60, 0.55, 0.05, 0.9, 0.002, 0.15), hit(0.55, 0.08, lp(400), 0.8, "pink"), hit(0.55, 0.02, bp(1200, 1), 0.3), hit(0.6, 0.03, bp(2500, 3), 0.15),
    ],
  })),
  // a kindergarten singing a line: high voices, never quite together
  children_singing: fx("la la la", "la la la", ({ rng: R }) => ({
    peak: 0.7, voices: choir(R, [["A5", 1], ["A5", 1], ["G5", 1], ["F5", 1], ["E5", 1], ["F5", 1], ["D5", 2]], 0.28, [1, 1, 1, 1], 1050, 35),
  })),
  // the Rum church's two bells, big and small by turns
  church_bells: fx("dan dan", "dong dong", () => ({
    peak: 0.75, voices: ([[0, "D4", 1], [0.52, "A4", 0.8], [1.05, "D4", 0.9]] as const).flatMap(([t, n, g]) => churchBell(noteFreq(n), t, g)),
  })),
  // coins dropped on the counter: each rings bright, bounces once and settles
  coin_clink: fx("şıngır", "chink", ({ rng: R }) => ({
    peak: 0.7, voices: [0, R.range(0.06, 0.1), R.range(0.16, 0.24)].flatMap((t, i) => {
      const f = R.range(2900, 3900), g = [1, 0.7, 0.8][i] * R.range(0.8, 1);
      return [0, R.range(0.035, 0.06)].flatMap((b, k) => [
        ring(f, [[1, 0.6, 0.3], [1.73, 0.4, 0.2], [2.33, 0.3, 0.14], [3.91, 0.15, 0.07]], t + b, g * (k ? 0.35 : 1)),
        hit(t + b, 0.004, hp(4500), g * (k ? 0.15 : 0.4)),
      ]);
    }),
  }), 3),
  // the campus's glass door: the push bar clacks, the pane shivers as it swings, the closer brings it home
  door_glass: fx("şıkırt", "clack", () => ({
    peak: 0.7, voices: [
      hit(0, 0.015, bp(2600, 2), 1), ring(1850, [[1, 0.5, 0.05], [2.6, 0.35, 0.03], [4.3, 0.2, 0.02]], 0, 0.6), hit(0, 0.04, lp(350), 0.5, "brown"),
      ring(640, [[1, 0.4, 0.35], [2.32, 0.3, 0.25], [4.25, 0.2, 0.15], [6.6, 0.1, 0.08]], 0.01, 0.35),
      { src: { noise: "pink" }, at: 0.05, env: { a: 0.15, hold: 0.25, r: 0.2 }, filter: bp({ from: 500, to: 900, time: 0.4 }, 0.8), gain: 0.25 },
      hit(0.62, 0.06, lp(500), 0.9, "pink"), tone("sine", 100, 55, 0.62, 0.04, 0.6, 0.002, 0.12),
      ring(700, [[1, 0.5, 0.3], [2.32, 0.35, 0.22], [4.25, 0.25, 0.12], [6.6, 0.12, 0.07]], 0.62, 0.5), hit(0.63, 0.01, bp(3000, 2), 0.35), hit(0.66, 0.008, hp(3500), 0.2),
    ],
  })),
  // a firework over the water: the boom, its echo off the far shore, a shower of crackles
  fireworks: fx("bum", "boom", ({ rng: R }) => {
    const j = (x: number) => x * R.range(0.85, 1.15), g = R.range(0.85, 1);
    return {
      peak: 0.75, voices: [
        tone("sine", j(80), 38, 0, 0.08, g, 0.002, 0.35), hit(0, j(0.5), lp(j(380)), g, "brown", 0.003), hit(0, 0.12, [hp(900), lp(5000)], g * 0.5, "white", 0.001),
        hit(j(0.42), 0.6, lp(260), g * 0.3, "brown", 0.02),
        { src: { noise: "white" }, at: 0.15, env: { a: 0.25, hold: 0.6, r: 0.7 }, filter: hp(4500), gain: 0.06 },
        ...Array.from({ length: Math.round(j(60)) }, () => {
          const t = 0.2 + 1.5 * R() ** 1.5;
          return hit(t, R.range(0.002, 0.008), bp(R.range(2500, 7000), 1.2), R.range(0.12, 0.45) * (1.8 - t) / 1.6);
        }),
      ],
    };
  }, 3),
  // a bunch of keys handed over: brass and steel clinking in two shakes
  keys_jingle: fx("şıngır şıngır", "jingle jingle", ({ rng: R }) => ({
    peak: 0.7, voices: [0, R.range(0.32, 0.4)].flatMap(t0 => Array.from({ length: 9 }, () => {
      const at = t0 + 0.2 * R() ** 1.6, f = R.range(2600, 5200), g = R.range(0.3, 1);
      return [ring(f, [[1, 0.5, 0.12], [2.76, 0.3, 0.06], [5.4, 0.15, 0.03]], at, g), hit(at, 0.003, hp(5000), g * 0.4)];
    }).flat()),
  })),
  // knitting needles: the tips meeting in pairs, a stitch at a time, the yarn whispering
  knitting_clicks: fx("tıkır tıkır", "click clack", ({ rng: R }) => ({
    peak: 0.7, voices: [
      { src: { noise: "pink" }, env: { a: 0.2, hold: 1.7, r: 0.2 }, filter: bp(1800, 1), gain: 0.06, lfo: { rate: 3, depth: 0.7, to: "amp", shape: "noise" } },
      ...[0.05, 0.42, 0.8, 1.15, 1.52].flatMap(t => [0, R.range(0.07, 0.11)].flatMap((b, k) => {
        const at = t + b + R.range(0, 0.03), g = (k ? 0.55 : 1) * R.range(0.7, 1), f = R.range(3300, 3900);
        return [hit(at, 0.004, bp(f, 3), g), ring(f * 1.2, [[1, 0.35, 0.025], [2.1, 0.2, 0.012]], at, g * 0.5)];
      })),
    ],
  }), 2),
  // a marker on the whiteboard: the felt rubbing, and a squeal where it sticks and slips
  marker_squeak: fx("gıcır gıcır", "squeak squeak", ({ rng: R }) => ({
    peak: 0.7, voices: [[0, 0.22], [0.32, 0.16], [0.58, 0.3]].flatMap(([t, len]) => {
      const f = R.range(1050, 1500);
      return [
        { ...tone("saw", f, f * R.range(0.85, 1.12), t, len, 1, 0.015, 0.03), filter: [hp(900), lp(6000)], lfo: [{ rate: 35, depth: 60, to: "pitch", shape: "noise" }, { rate: 25, depth: 0.6, to: "amp", shape: "noise" }] },
        { src: { noise: "white" }, at: t, env: { a: 0.01, hold: len, r: 0.03 }, filter: bp(4000, 1), gain: 0.25, lfo: { rate: 40, depth: 0.6, to: "amp", shape: "noise" } },
      ];
    }),
  })),
  // a stallholder's call: three quick syllables and a long one, falling (a voice, never words)
  market_call: fx("taze taze", "fresh fresh", ({ rng: R }) => {
    const p = R.range(0.9, 1.1), s = R.range(0.9, 1.1), E = [500, 1750], A = [750, 1250];
    return {
      peak: 0.75, voices: ([[0, 0.16, 200, 210, E], [0.22, 0.12, 215, 220, A], [0.36, 0.14, 210, 200, A], [0.56, 0.75, 240, 175, E]] as const).flatMap(([t, len, f0, f1, F]) => [
        ...vox(f0 * p, f1 * p, t * s, len * s, 1, [...F], 0.02, 0.07, len > 0.5 ? { rate: 6, depth: 40, to: "pitch", shape: "noise", delay: 0.2 } : undefined),
        hit(t * s, 0.02, bp(2500, 1.5), 0.15),
      ]),
    };
  }, 2),
  // a street cat: a nasal "mi", opening to "aa", closing to "oo"
  meow: fx("miyav", "meow", () => ({
    peak: 0.7, voices: [
      ...vox(560, 750, 0, 0.28, 1, [{ from: 450, to: 1000, time: 0.28 }, { from: 2300, to: 1700, time: 0.28 }], 0.06, 0.05),
      ...vox(750, 470, 0.26, 0.38, 1, [{ from: 1000, to: 500, time: 0.38 }, { from: 1700, to: 900, time: 0.38 }], 0.03, 0.12),
    ],
  })),
  // a street dog: two barks, each a chuff of breath and a rough voice falling fast through an open "a", the second a little lower
  bark: fx("hav hav", "woof woof", ({ rng: R }) => {
    const j = (x: number) => x * R.range(0.87, 1.15), f = j(470), F = [j(720), j(1750)], gap = j(0.27), rough: V["lfo"] = { rate: 45, depth: 90, to: "pitch", shape: "noise" };
    return {
      peak: 0.7, voices: ([[0, j(0.15), 1, 1], [gap, j(0.13), 0.92, j(0.85)]] as const).flatMap(([t, len, k, g]) => [
        ...vox(f * k, f * k * 0.48, t, len, g, F, 0.006, 0.05, rough),
        hit(t, 0.06, [bp(F[0] * k, 0.8), lp(3000)], g * 0.5, "pink", 0.002), hit(t, 0.05, lp(300), g * 0.45, "brown"),
      ]),
    };
  }, 3),
  // the queue's display calling the next number: three soft notes
  number_call: fx("tın tın tın", "ding ding ding", () => ({
    peak: 0.65, voices: [1319, 1047, 1568].map((f, i): V => ({ ...ring(f, [[1, 1, 0.9], [2, 0.12, 0.35], [3, 0.04, 0.15]], i * 0.2, i === 2 ? 1 : 0.85), filter: hp(300) })),
  })),
  // the bakery oven's iron door: the latch, a squeal of the hinge, the hot air, the door on its stop
  oven_door: fx("tangır", "clank", () => ({
    peak: 0.7, voices: [
      hit(0, 0.02, bp(2000, 1.5), 0.7), ring(420, [[1, 0.6, 0.35], [2.31, 0.45, 0.25], [3.72, 0.3, 0.16], [5.1, 0.15, 0.1]], 0, 0.6),
      { ...tone("saw", 70, 110, 0.06, 0.22, 0.4, 0.04, 0.05), filter: [bp(1600, 5), lp(4000)], lfo: { rate: 18, depth: 300, to: "pitch", shape: "noise" } },
      { src: { noise: "pink" }, at: 0.1, env: { a: 0.12, hold: 0.25, r: 0.4 }, filter: bp({ from: 900, to: 350, time: 0.5 }, 0.7), gain: 0.5 },
      hit(0.36, 0.05, lp(300), 0.9, "brown"), hit(0.36, 0.015, bp(1500, 1.2), 0.6),
      ring(300, [[1, 0.6, 0.45], [2.31, 0.4, 0.3], [3.72, 0.3, 0.2], [5.1, 0.15, 0.12], [6.9, 0.08, 0.06]], 0.36, 0.8),
    ],
  })),
  // a pen writing: short strokes scratching over the paper
  pen_scratch: fx("cızır cızır", "scratch scratch", ({ rng: R }) => {
    const v: V[] = [];
    for (let t = 0.01; t < 1.2; t += R.range(0.06, 0.16)) {
      const len = R.range(0.06, 0.2), g = R.range(0.5, 1);
      v.push(
        { src: { noise: "white" }, at: t, env: { a: 0.01, hold: len, r: 0.02 }, filter: bp(R.range(3200, 5200), 1.3), gain: g, lfo: { rate: 70, depth: 0.7, to: "amp", shape: "noise" } },
        { src: { noise: "pink" }, at: t, env: { a: 0.01, hold: len, r: 0.03 }, filter: bp(1300, 1), gain: g * 0.3 },
      );
      t += len;
    }
    return { peak: 0.65, voices: v };
  }, 2),
  // a jet coming in to land: a roar that swells and falls away, the turbines whining down as it passes
  plane: fx("vıııın", "zoom", () => {
    const env = { a: 1, hold: 1.25, r: 1.2 };
    return {
      peak: 0.7, voices: [
        { src: { noise: "brown" }, env, filter: lp({ from: 250, to: 500, time: 1.2 }) },
        { src: { noise: "pink" }, env, filter: bp({ from: 500, to: 1300, time: 1.1 }, 0.6), gain: 0.6, lfo: { rate: 2, depth: 0.25, to: "amp", shape: "noise" } },
        { src: { noise: "white" }, env: { a: 1.05, hold: 1.2, r: 0.7 }, filter: hp(3000), gain: 0.1 },
        ...([[2600, 0.08], [1300, 0.12]] as const).map(([f, g]) => tone("triangle", f * 1.08, f * 0.86, 0, 1.25, g, 1, 1.2)),
      ],
    };
  }),
  // the waiting hall's display: a soft, rising "bing" for the next number
  queue_chime: fx("tıng", "bing", () => ({
    peak: 0.65, voices: [ring(1175, [[1, 0.8, 0.7], [2, 0.1, 0.25]], 0, 0.8), ring(1760, [[1, 1, 1.1], [2, 0.12, 0.4], [3, 0.03, 0.2]], 0.1, 1)].map(v => ({ ...v, filter: hp(300) })),
  })),
  // the desk bell at quiz night, slapped: a bright dome ringing long over the plunger's click
  quiz_bell: fx("dıng", "ding", () => ({
    peak: 0.75, voices: [
      ring(2350, [[1, 1, 1.6], [1.004, 0.6, 1.5], [2.32, 0.35, 0.6], [4.25, 0.2, 0.3], [6.2, 0.08, 0.15]], 0.004, 1),
      hit(0, 0.006, bp(3000, 1.5), 0.6), ring(520, [[1, 0.3, 0.04], [2.3, 0.2, 0.02]], 0, 0.5),
    ],
  })),
  // florist's scissors: two snips, each the blades sliding, the stem giving, the blades meeting
  scissors_snip: fx("kırt kırt", "snip snip", ({ rng: R }) => ({
    peak: 0.7, voices: [0, R.range(0.3, 0.36)].flatMap(t => [
      { src: { noise: "white" }, at: t, env: { a: 0.02, hold: 0.05, r: 0.02 }, filter: bp({ from: 3500, to: 5500, time: 0.07 }, 2), gain: 0.5 },
      hit(t + 0.05, 0.012, bp(1300, 1), 0.6), hit(t + 0.05, 0.03, lp(400), 0.4, "brown"),
      hit(t + 0.075, 0.004, hp(3500), 0.8), ring(R.range(4800, 5600), [[1, 0.5, 0.05], [1.7, 0.3, 0.035], [2.9, 0.15, 0.02]], t + 0.075, 0.5),
    ]),
  })),
  // a shop's door chime as someone comes in: ding–dong
  shop_bell: fx("dıng dong", "ding dong", () => ({ peak: 0.7, voices: [...bell(1319, 0, 1, 1.1), ...bell(1047, 0.42, 0.9, 1.5)] })),
  // neighbours singing together on the roof, the men an octave below (a line in Rast, home on D)
  singing: fx("lay lay lom", "tra la la", ({ rng: R }) => ({
    peak: 0.7, voices: choir(R, [["A4", 1], ["A4", 1], ["B4", 1], ["A4", 1], ["G4", 1], ["E4", 1], ["D4", 2]], 0.27, [1, 1, 0.5, 0.5], 750, 15, 15),
  })),
  // thunder close by: the crack with the flash, then the long roll, bumping as it goes
  thunder: fx("gürül gürül", "rumble", ({ rng: R }) => {
    const j = (x: number) => x * R.range(0.85, 1.15);
    return {
      peak: 0.75, voices: [
        hit(0, j(0.25), [hp(600), lp(7000)], 0.5, "white", 0.002), hit(0, j(0.5), lp(1500), 0.8, "pink", 0.003), tone("sine", j(55), 30, 0, 0.15, 0.8, 0.005, 0.6),
        { src: { noise: "brown" }, at: j(0.08), env: { a: 0.2, hold: j(0.95), r: 1.3 }, filter: lp({ from: 500, to: 150, time: 1.8 }), gain: 3, lfo: { rate: j(5), depth: 0.7, to: "amp", shape: "noise" } },
        { src: { noise: "brown" }, at: j(0.5), env: { a: 0.3, hold: 0.6, r: 1.2 }, filter: lp(220), gain: 2.2, lfo: { rate: 3, depth: 0.6, to: "amp", shape: "noise" } },
      ],
    };
  }, 2),
  // the queue's ticket machine: the printer's motor buzzing the slip out, the cutter, the slip dropping
  ticket_print: fx("zırrt", "bzzt", () => ({
    peak: 0.65, voices: [
      { ...tone("square", 240, 240, 0, 0.6, 0.35, 0.02, 0.03), filter: [bp(1400, 2), lp(5000)], lfo: { rate: 80, depth: 0.5, to: "amp" } },
      { src: { noise: "white" }, env: { a: 0.02, hold: 0.6, r: 0.03 }, filter: bp(3200, 1.5), gain: 0.4, lfo: { rate: 160, depth: 0.7, to: "amp" } },
      hit(0.66, 0.01, bp(2500, 2), 1), ring(3400, [[1, 0.4, 0.03], [1.8, 0.25, 0.02]], 0.66, 0.5), hit(0.66, 0.03, lp(400), 0.4, "brown"),
      { src: { noise: "white" }, at: 0.72, env: { a: 0.02, hold: 0.08, r: 0.08 }, filter: bp(2600, 0.9), gain: 0.35, lfo: { rate: 50, depth: 0.7, to: "amp", shape: "noise" } },
    ],
  })),
  // a metal toolbox set down: the box's thump and ring, the tools inside jumping
  toolbox_clank: fx("tangır tungur", "clatter", ({ rng: R }) => ({
    peak: 0.7, voices: [
      tone("sine", 110, 60, 0, 0.05, 0.8, 0.002, 0.15), hit(0, 0.08, lp(450), 0.9, "pink"),
      ring(R.range(480, 560), [[1, 0.5, 0.35], [1.53, 0.4, 0.28], [2.41, 0.35, 0.18], [3.62, 0.2, 0.11], [5.2, 0.1, 0.06]], 0, 0.7),
      ...Array.from({ length: 11 }, () => {
        const at = 0.015 + 0.35 * R() ** 1.4, f = R.range(1400, 4200), g = R.range(0.2, 0.6);
        return [ring(f, [[1, 0.5, 0.07], [2.76, 0.3, 0.04], [5.4, 0.15, 0.02]], at, g), hit(at, 0.004, bp(f, 2), g * 0.5)];
      }).flat(),
    ],
  }), 2),
  // a metro pulling in: the roar and the push of air, the motors whining down, the brakes, the hiss as it stops
  train_arrive: fx("vınnn", "whirr", () => ({
    peak: 0.7, voices: [
      { src: { noise: "brown" }, env: { a: 0.9, hold: 1.5, r: 0.6 }, filter: lp({ from: 180, to: 420, time: 1 }), lfo: { rate: 6, depth: 0.3, to: "amp", shape: "noise" } },
      { src: { noise: "pink" }, env: { a: 0.8, hold: 1, r: 0.6 }, filter: bp(600, 0.7), gain: 0.5 },
      ...([[900, 0.12], [1800, 0.05]] as const).map(([f, g]) => tone("triangle", f, f * 0.55, 0.2, 1.7, g, 0.6, 0.3)),
      { ...tone("saw", 2900, 2750, 1.35, 0.45, 0.12, 0.12, 0.15), filter: bp(3000, 6), lfo: { rate: 15, depth: 40, to: "pitch", shape: "noise" } },
      hit(1.95, 0.05, lp(300), 0.5, "brown"), { src: { noise: "white" }, at: 2, env: { a: 0.01, hold: 0.12, r: 0.35 }, filter: hp(2500), gain: 0.2 },
    ],
  })),
  // a shopping trolley: small wheels rattling along, bumping up the steps
  trolley_wheels: fx("takır takır", "rattle rattle", ({ rng: R }) => ({
    peak: 0.7, voices: [
      { src: { noise: "pink" }, env: { a: 0.08, hold: 1.1, r: 0.15 }, filter: bp(1000, 1.2), gain: 0.5, lfo: { rate: 22, depth: 0.75, to: "amp", shape: "noise" } },
      { src: { noise: "brown" }, env: { a: 0.08, hold: 1.1, r: 0.15 }, filter: lp(200), gain: 0.4, lfo: { rate: 10, depth: 0.5, to: "amp", shape: "noise" } },
      ...[0.2, 0.6, 1].flatMap(t => [hit(t, 0.05, lp(300), 1, "brown"), hit(t, 0.012, bp(1800, 1.5), 0.5), ring(R.range(850, 950), [[1, 0.3, 0.08], [2.6, 0.25, 0.05], [4.4, 0.1, 0.03]], t + 0.01, 0.4)]),
    ],
  })),
  // one gust over the roof: it swells, whistles past the parapet and dies away
  wind_gust: fx("vuuu", "whoosh", ({ rng: R }) => {
    const f = R.range(380, 520), len = R.range(0.9, 1.1), env = { a: len * 0.7, hold: len, r: 1.1 };
    return {
      peak: 0.7, voices: [
        { src: { noise: "pink" }, env, filter: bp({ from: f, to: f * 2, time: len }, 0.9), lfo: { rate: 6, depth: 0.3, to: "amp", shape: "noise" } },
        { src: { noise: "white" }, env, gain: 0.25, filter: bp({ from: f * 2, to: f * 3.2, time: len }, 7) },
        { src: { noise: "brown" }, env, gain: 0.35, filter: lp(160) },
      ],
    };
  }, 2),
  // Kerim taking off: a clap of the wings, then quick beats fading as she goes
  wing_flap: fx("pır pır", "flap flap", ({ rng: R }) => ({
    peak: 0.7, voices: Array.from({ length: 7 }, (_, i) => {
      const at = i * 0.11 + R.range(0, 0.012), g = 0.85 ** i;
      return [
        { src: { noise: "pink" }, at, gain: g, env: { a: 0.025, d: 0.08 }, filter: bp(R.range(700, 1100), 0.9) } as V,
        hit(at + 0.02, 0.012, bp(R.range(1600, 2400), 1.2), g * (i < 2 ? 0.8 : 0.25)),
      ];
    }).flat(),
  }), 2),

  // ---- ambience: seamless loops, levelled to 0.5 -------------------------------------------
  rain: amb("şıpır şıpır", "pitter-patter", 8, (R, dur) => [
    bed("pink", [hp(700), lp(5500)], 0.3, { rate: 0.3, depth: 0.25, to: "amp", shape: "noise" }),
    ...scatter(dur, uniform(R, dur, 420), at => [hit(at, R.range(0.004, 0.015), bp(R.range(2500, 6000), 1.5), R.range(0.1, 0.5))]),
    ...scatter(dur, uniform(R, dur, 40), at => { const f = R.range(1800, 3500); return [tone("sine", f, f * 1.25, at, 0.005, R.range(0.04, 0.12), 0.001, 0.03)]; }),
    ...scatter(dur, uniform(R, dur, 6), at => { const f = R.range(900, 1300); return [tone("sine", f, f * 1.5, at, 0.01, 0.15, 0.001, 0.06)]; }),
  ]),
  // a low bed and gusts that swell, rise in pitch and die away, with a faint whistle in each
  wind: amb("uğul uğul", "whoo", 9, (R, dur) => [
    bed("pink", bp(450, 0.8), 0.3, { rate: 0.4, depth: 0.5, to: "amp", shape: "noise" }),
    bed("brown", lp(180), 0.1, { rate: 0.15, depth: 0.6, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 2.2, 3.8), at => {
      const len = R.range(2.5, 4), f = R.range(380, 600), g = R.range(0.6, 1), env = { a: len * 0.4, hold: len * 0.45, r: len * 0.55 };
      return [
        { src: { noise: "pink" }, at, gain: g, env, filter: bp({ from: f, to: f * 1.8, time: len * 0.45 }, 0.9) },
        { src: { noise: "white" }, at, gain: g * 0.3, env, filter: bp({ from: f * 1.6, to: f * 2.6, time: len * 0.45 }, 6) },
      ];
    }),
  ]),
  waves: amb("şırıl şırıl", "swish", 9, (R, dur) => [
    bed("brown", lp(250), 0.5, { rate: 0.4, depth: 0.4, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.4, 2.5), at => {
      const g = R.range(0.5, 1), f = R.range(500, 900);
      return [
        { src: { noise: "pink" }, at, gain: g, env: { a: R.range(0.5, 0.8), hold: 0.9, r: 1.1 }, filter: bp({ from: f * 0.6, to: f * 1.4, time: 0.9 }, 0.7) },
        hit(at + 0.7, 0.12, lp(260), g * 0.7, "brown", 0.01),
        { src: { noise: "white" }, at: at + 0.75, gain: g * 0.2, env: { a: 0.05, hold: 0.1, r: 1.3 }, filter: hp(2500), lfo: { rate: 30, depth: 0.7, to: "amp", shape: "noise" } },
      ];
    }),
  ]),
  crowd: amb("vızır vızır", "murmur", 7, R => [
    bed("pink", [lp(900), hp(120)], 0.3, { rate: 0.5, depth: 0.3, to: "amp", shape: "noise" }),
    ...Array.from({ length: 5 }, () => talker(R, 1400)),
  ]),
  traffic: amb("vın vın", "vroom", 10, (R, dur) => [
    bed("brown", lp(220), 1, { rate: 0.2, depth: 0.3, to: "amp", shape: "noise" }),
    bed("pink", bp(600, 0.7), 0.3, { rate: 0.4, depth: 0.5, to: "amp", shape: "noise" }),
    bed("white", bp(2500, 0.6), 0.06, { rate: 0.3, depth: 0.6, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.5, 3.2), at => car(R, at, R.range(0.5, 1), 1100)),
  ]),
  street_far: amb(null, null, 9, (R, dur) => [
    bed("brown", lp(160), 1, { rate: 0.2, depth: 0.35, to: "amp", shape: "noise" }),
    bed("pink", [lp(500), hp(60)], 0.15, { rate: 0.3, depth: 0.5, to: "amp", shape: "noise" }),
    ...scatter(dur, [R.range(0.5, 2.5), R.range(5, 7)], at => car(R, at, R.range(0.35, 0.6), 450)),
  ]),
  // the drink fridge: 50 Hz mains hum and its harmonics (whole cycles in the loop), a compressor buzz, the fan
  fridge_hum: amb("vızzz", "hum", 6, () => [
    ...([[50, 0.35], [100, 0.5], [150, 0.15], [200, 0.08]] as const).map(([f, gain]): V => ({ src: { osc: "sine", f }, gain })),
    { src: { osc: "saw", f: 100 }, filter: bp(420, 3), gain: 0.12, lfo: { rate: 0.5, depth: 0.3, to: "amp", shape: "noise" } },
    bed("pink", bp(700, 0.7), 0.1, { rate: 0.4, depth: 0.2, to: "amp", shape: "noise" }),
  ]),
  // ---- the places' ambience (M2); periodic parts make whole cycles in the loop ---------------
  // a city bus idling in traffic, from inside: the diesel's beat wandering with the revs, the panels buzzing, the odd bump
  bus_engine: amb("gırr gırr", "brrrm", 8, (R, dur) => [
    { src: { osc: "saw", f: 35 }, filter: lp(240), gain: 0.7, lfo: [{ rate: 0.25, depth: 120, to: "pitch", shape: "noise" }, { rate: 0.3, depth: 0.25, to: "amp", shape: "noise" }] },
    bed("brown", lp(160), 0.6, { rate: 0.4, depth: 0.3, to: "amp", shape: "noise" }),
    { src: { noise: "white" }, filter: bp(1700, 2), gain: 0.12, lfo: { rate: 17.5, depth: 0.8, to: "amp" } },
    bed("pink", bp(500, 0.8), 0.15, { rate: 0.3, depth: 0.5, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.5, 3), at => [hit(at, R.range(0.06, 0.12), lp(200), R.range(0.3, 0.5), "brown", 0.01), hit(at, 0.02, bp(R.range(1500, 2500), 3), R.range(0.05, 0.1))]),
  ]),
  // the taxi under way, from inside: the engine's hum rising and falling with the traffic, tyres and road under it
  car_engine: amb("vırrr", "purr", 8, (R, dur) => [
    { src: { osc: "saw", f: 62, detune: [-8, 7] }, filter: lp(320), gain: 0.8, lfo: [{ rate: 0.2, depth: 180, to: "pitch", shape: "noise" }, { rate: 0.3, depth: 0.3, to: "amp", shape: "noise" }] },
    bed("pink", [lp(650), hp(50)], 0.9, { rate: 0.25, depth: 0.35, to: "amp", shape: "noise" }),
    bed("white", bp(1600, 0.6), 0.05, { rate: 0.3, depth: 0.5, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.2, 2.6), at => [hit(at, R.range(0.05, 0.1), lp(220), R.range(0.15, 0.35), "brown", 0.008)]),
  ]),
  // the corridor at the break: students talking close by, voices overlapping, now and then a laugh, steps on the tiles
  corridor_chatter: amb("vıdı vıdı", "chatter", 7, (R, dur) => [
    bed("pink", [lp(1200), hp(150)], 0.35, { rate: 0.6, depth: 0.3, to: "amp", shape: "noise" }),
    ...Array.from({ length: 2 }, () => talker(R, 2400)),
    ...scatter(dur, spaced(R, dur, 0.5, 1.1), at => [chat(R, at, R.range(0.8, 2), 2400, R.range(0.4, 0.9))]),
    ...scatter(dur, spaced(R, dur, 1.8, 3.2), at => [laugh(R, at, R.range(0.3, 0.6))]),
    ...scatter(dur, uniform(R, dur, 8), at => [hit(at, 0.02, bp(R.range(1600, 2200), 1.5), R.range(0.05, 0.12))]),
  ]),
  // the corridor outside class: people waiting, talking low further off, steps coming back off the walls
  corridor_murmur: amb("mırıl mırıl", "mumble", 8, (R, dur) => [
    bed("pink", [lp(700), hp(100)], 0.4, { rate: 0.4, depth: 0.3, to: "amp", shape: "noise" }),
    bed("brown", bp(170, 2), 0.25, { rate: 0.3, depth: 0.4, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 0.4, 1.2), at => [chat(R, at, R.range(1, 2.5), 1000, R.range(0.3, 0.7))]),
    ...scatter(dur, spaced(R, dur, 1.6, 3), at => echo([hit(at, 0.02, bp(1900, 1.5), R.range(0.08, 0.15))], 2, 0.09, 0.4)),
  ]),
  // the empty flat: a hollow room tone, and the few sounds from outside coming back off the bare walls
  echo_room: amb("hu hu", "echo", 8, (R, dur) => [
    bed("pink", [bp(140, 1.5), lp(400)], 0.6, { rate: 0.2, depth: 0.3, to: "amp", shape: "noise" }),
    bed("pink", bp(2600, 0.5), 0.03, { rate: 0.3, depth: 0.4, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.5, 3), at => echo([hit(at, R.range(0.01, 0.03), bp(R.range(900, 2400), 2), R.range(0.15, 0.35))], 4, R.range(0.07, 0.1), 0.5)),
    ...scatter(dur, [R.range(2, 5)], at => car(R, at, 0.25, 500)),
  ]),
  // the vapur's engine through the deck: the slow diesel beat, its tappets, the wake churning, the swell on the hull
  ferry_engine: amb("pat pat pat", "putt putt", 9, (R, dur) => [
    { src: { osc: "saw", f: 44 }, filter: lp(200), gain: 0.5 },
    bed("pink", [lp(400), hp(60)], 1.2, { rate: 7, depth: 0.9, to: "amp" }),
    bed("brown", lp(150), 0.6, { rate: 0.3, depth: 0.3, to: "amp", shape: "noise" }),
    { src: { noise: "white" }, filter: bp(2100, 3), gain: 0.05, lfo: { rate: 14, depth: 0.85, to: "amp" } },
    bed("pink", bp(700, 0.6), 0.2, { rate: 0.35, depth: 0.5, to: "amp", shape: "noise" }),
    bed("white", hp(3000), 0.015, { rate: 0.5, depth: 0.5, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 1.2, 2.4), at => [{ src: { noise: "pink" }, at, gain: R.range(0.15, 0.3), env: { a: 0.4, hold: 0.5, r: 0.8 }, filter: bp(R.range(400, 700), 0.8) }]),
  ]),
  // football on the taxi's radio: a commentator racing through a small speaker, the stadium swelling behind, a hiss on top
  radio_football: amb("gooool", "goal", 8, R => {
    const radio = [hp(400), lp(3200)];
    return [
      { src: { noise: "pink" }, filter: [bp(1100, 0.7), ...radio], gain: 0.3, lfo: { rate: 0.4, depth: 0.6, to: "amp", shape: "noise" } },
      {
        src: { osc: "saw", f: R.range(150, 190) }, filter: [bp(R.range(800, 1100), 1.6), ...radio],
        lfo: [{ rate: 7, depth: 1, to: "amp", shape: "noise" }, { rate: 3, depth: 300, to: "pitch", shape: "noise" }, { rate: 6, depth: 1, to: "cut", shape: "noise" }],
      },
      bed("white", hp(5000), 0.03, { rate: 0.5, depth: 0.4, to: "amp", shape: "noise" }),
    ];
  }),
  // riding the M2: the rumble under the floor, the motors' steady whine, wheels knocking over the joints in pairs, the car rattling
  train_running: amb("takır tukur", "clickety-clack", 8, (R, dur) => [
    bed("brown", lp(200), 1, { rate: 0.4, depth: 0.3, to: "amp", shape: "noise" }),
    bed("pink", bp(700, 0.7), 0.3, { rate: 0.6, depth: 0.4, to: "amp", shape: "noise" }),
    { src: { osc: "triangle", f: 520 }, gain: 0.05 }, { src: { osc: "sine", f: 1040 }, gain: 0.02 },
    ...scatter(dur, spaced(R, dur, 0.9, 1.7), at => [0, R.range(0.1, 0.14)].flatMap(b => [hit(at + b, 0.04, bp(R.range(500, 700), 1.5), 0.5), hit(at + b, 0.06, lp(160), 0.7, "brown")])),
    ...scatter(dur, uniform(R, dur, 6), at => [hit(at, 0.015, bp(R.range(2000, 3500), 3), R.range(0.05, 0.15))]),
  ]),
  // the library: a hushed room, and whispers here and there, breath shaped into syllables, an "s" now and then
  whisper: amb("fısıl fısıl", "psst psst", 8, (R, dur) => [
    bed("pink", [lp(500), hp(60)], 0.35, { rate: 0.2, depth: 0.3, to: "amp", shape: "noise" }),
    bed("white", bp(3000, 0.5), 0.02, { rate: 0.3, depth: 0.4, to: "amp", shape: "noise" }),
    ...scatter(dur, spaced(R, dur, 0.9, 2.2), at => {
      const len = R.range(0.6, 1.5), g = R.range(0.3, 1), env = { a: 0.05, hold: len, r: 0.12 };
      return [
        { src: { noise: "white" }, at, gain: g, env, filter: [bp(R.range(1300, 2200), 3), lp(5000)], lfo: [{ rate: R.range(5, 7), depth: 0.9, to: "amp", shape: "noise" }, { rate: 4, depth: 0.8, to: "cut", shape: "noise" }] },
        { src: { noise: "white" }, at, gain: g * 0.5, env, filter: bp(R.range(600, 900), 2.5), lfo: { rate: 6, depth: 0.9, to: "amp", shape: "noise" } },
        hit(at + R.range(0, len), 0.1, [hp(4500), lp(8000)], g * 0.35, "white", 0.03),
      ];
    }),
  ]),
};

// a camera's shutter is the phone's: one sound under both names
SOUNDS.camera_shutter = SOUNDS.shutter;

// Recordings (sounds/SOURCES.md) play instead of these four patches wherever the app serves the
// kit's sound folder; a loop's file carries 0.25 s of the loop on both sides (sounds/build.ts).
const RECORDINGS: Record<string, Recording> = {
  gull: { file: "gull.m4a" },
  ferry_horn: { file: "ferry_horn.m4a" },
  traffic: { file: "traffic.m4a", loop: [0.25, 8.25] },
  crowd: { file: "crowd.m4a", loop: [0.25, 8.25] },
};
for (const [id, recording] of Object.entries(RECORDINGS)) SOUNDS[id].recording = recording;
