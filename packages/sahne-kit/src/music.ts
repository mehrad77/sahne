// The kit's music (DESIGN.md §8.3, STYLE.md "Sound"): five code-built instruments and the
// motifs played at scene changes and at the end of a story. Every motif is on D, so they sit
// together: Rast on D (D E F#~ G A B C) where it is bright, Uşşak (D E F G A Bb C) where it is
// intimate, and the only quarter tone is Rast's segah, F#~, in Kerim's theme and the ending.

import type { Instrument, MotifDef, SynthVoice as V } from "sahne";
import { bell, bp, hit, hp, lp, ring } from "./sounds.ts";

const cents = (c: number) => Math.pow(2, c / 1200);

export const INSTRUMENTS: Record<string, Instrument> = {
  /** A bağlama: two steel strings of a course, a few cents apart, and the plectrum's tick. */
  saz: (n, R) => {
    const env = { a: 0.002, hold: n.len + 0.35, r: 0.3 }, filter = [hp(110), lp(6500)];
    return [
      { src: { pluck: n.f * cents(R.range(-4, -1)), decay: 1.3, bright: 0.85 }, gain: n.vel, env, filter },
      { src: { pluck: n.f * cents(R.range(1, 4)), decay: 1.1, bright: 0.9 }, gain: n.vel * 0.7, env, filter },
      hit(0, 0.008, bp(3500, 1), n.vel * 0.1),
    ];
  },
  /** A ney: a soft tone with weak harmonics, breath at the pitch and above it, and a late, gentle vibrato. */
  ney: n => {
    const len = Math.max(n.len, 0.2), env = { a: 0.12, hold: len, r: 0.18 };
    return [
      { src: { partials: [[1, 1, 99], [2, 0.22, 99], [3, 0.08, 99], [4, 0.03, 99]], f: n.f }, gain: n.vel, env, lfo: { rate: 5, depth: 15, to: "pitch", delay: 0.35 } },
      { src: { noise: "white" }, gain: n.vel * 0.9, env, filter: [bp(n.f, 7), bp(n.f, 4)] },
      { src: { noise: "pink" }, gain: n.vel * 0.1, env: { a: 0.06, hold: len, r: 0.15 }, filter: [hp(1200), lp(5000)] },
    ];
  },
  /** A soft pad: detuned triangles and a quiet low-passed saw, slow in and out. */
  pad: n => {
    const a = Math.min(0.5, n.len * 0.4), env = { a, hold: n.len, r: 0.9 };
    return [
      { src: { osc: "triangle", f: n.f, detune: [-7, 0, 7] }, gain: n.vel * 0.8, env, filter: lp(1400) },
      { src: { osc: "saw", f: n.f, detune: [-4, 5] }, gain: n.vel * 0.2, env, filter: lp({ from: 500, to: 1100, time: a + 0.3 }) },
    ];
  },
  /** A small bright bell. */
  bell: n => bell(n.f, 0, n.vel, 1.8, 1.002),
  /** A def: `d` düm (low, its pitch dropping), `t` tek (the rim), `k` ka (soft). */
  def: n => {
    const g = n.vel, skin: [number, number, number][] = [[1, 0.6, 0.09], [1.59, 0.4, 0.07], [2.14, 0.3, 0.05], [2.65, 0.2, 0.04]];
    if (n.hit === "d") return [{ src: { osc: "sine", f: { from: 130, to: 62, time: 0.12 } }, gain: g, env: { a: 0.002, d: 0.4 } }, hit(0, 0.05, lp(900), g * 0.35, "pink")];
    if (n.hit === "t") return [hit(0, 0.07, bp(2600, 1.4), g * 0.7), ring(410, skin, 0, g * 0.6), hit(0, 0.004, hp(4000), g * 0.3)];
    return [hit(0, 0.05, bp(1800, 1.2), g * 0.25), ring(410, skin, 0, g * 0.18)] as V[];
  },
};

export const MOTIFS: Record<string, MotifDef> = {
  // the coo's short–LONG–short (A D A), then down Rast to the tonic; a bell winks at the end
  kerim: {
    bpm: 112, tail: 0.8, tracks: [
      { inst: "ney", notes: "A4 D5:3 A4 | G4 F#~4 E4 D4:3" },
      { inst: "saz", notes: "D3 A3 D4 . | A3 . D4 . | D3 . .", gain: 0.45 },
      { inst: "pad", notes: "D3:11", gain: 0.3 }, { inst: "pad", notes: "A3:11", gain: 0.22 },
      { inst: "bell", notes: ". . . . | . . . . | D6 . .", gain: 0.25 },
    ],
  },
  // a home: saz over a drone, Uşşak, falling to rest
  home: {
    bpm: 84, tail: 0.9, tracks: [
      { inst: "saz", notes: "A4 G4 F4 E4 | F4 E4 D4:2" },
      { inst: "pad", notes: "D3:8", gain: 0.35 }, { inst: "pad", notes: "A3:8", gain: 0.25 },
    ],
  },
  // the school: a bright climb on the saz, the bell answering
  school: {
    bpm: 120, tail: 1, tracks: [
      { inst: "saz", notes: "D4 E4 F#4 G4 | A4 . F#4 . | D4:2" },
      { inst: "bell", notes: ". . . . | A5 . . . | D6:2", gain: 0.45 },
    ],
  },
  // a street, a market: the saz over a düm–tek pattern on the def
  street: {
    bpm: 132, tail: 0.8, tracks: [
      { inst: "saz", notes: "A4 A4 G4 A4 | F4 G4 E4 F4 | D4 E4 D4:2" },
      { inst: "def", notes: "d . t k | d . t k | d t d .", gain: 0.6 },
    ],
  },
  // the Bosphorus: a long ney line over the drone
  sea: {
    bpm: 84, tail: 1, tracks: [
      { inst: "ney", notes: "A4:2 G4 F4 | G4 E4 D4:2" },
      { inst: "pad", notes: "D3:8", gain: 0.35 }, { inst: "pad", notes: "A3:8", gain: 0.25 },
    ],
  },
  // the stinger: Rast's descent from Kerim's theme, landing on D
  end: {
    bpm: 120, tail: 0.6, tracks: [
      { inst: "saz", notes: "G4 F#~4 E4 D4:3" },
      { inst: "bell", notes: ". . . D5:3", gain: 0.3 },
      { inst: "pad", notes: ". . . D3:3", gain: 0.35 }, { inst: "pad", notes: ". . . A3:3", gain: 0.25 },
    ],
  },
};

/** The shared key centre. */
export const TONIC = "D";
