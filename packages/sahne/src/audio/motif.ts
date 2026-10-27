// Music motifs (DESIGN.md §8.3): a tiny step sequencer. A motif is a few tracks of notes written
// as text, one token per step, played by the kit's instruments (code that turns a note into
// synth voices) and rendered into one buffer like any other patch. Pure.

import { rng, type Rng } from "../core/rng.ts";
import { finish, patchJob, type RenderJob, type Rendered, type SynthVoice } from "./dsp.ts";

/** A note as an instrument plays it. `hit` is a drum stroke (a lower-case token: `d` düm, `t` tek); `f` is then 0. */
export interface Note { f: number; len: number; vel: number; hit?: string }

/** Turns a note into voices, timed from 0; the sequencer moves them to the note's step. */
export type Instrument = (n: Note, r: Rng) => SynthVoice[];

export interface MotifTrack {
  inst: string;
  /**
   * One token per step, separated by spaces (`|` bar lines are ignored):
   * - a note, `D4`, `F#3`, `Bb4`, with `~` for a quarter tone flat (`E~4`, the *segah* of Rast);
   * - `.` a rest, `-` holds the note before for one more step;
   * - `!` after a note accents it, `:n` makes it n steps long (`G4!:4`);
   * - a lower-case word is a drum stroke for a percussion instrument (`d`, `t`, `k`).
   */
  notes: string;
  gain?: number;
  /** Octaves up (+) or down (−). */
  oct?: number;
}

export interface MotifDef {
  bpm: number;
  /** Steps per beat (default 2: eighth notes). */
  steps?: number;
  /** Delays every second step by this fraction of a step (0 … 0.5). */
  swing?: number;
  tracks: MotifTrack[];
  /** Seconds of ring after the last step. */
  tail?: number;
  peak?: number;
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note name's frequency: A4 = 440 Hz; `~` lowers it by a quarter tone. */
export function noteFreq(name: string): number {
  const m = /^([A-G])(#|b)?(~)?(-?\d)?$/.exec(name);
  if (!m) throw new Error(`sahne: not a note: ${name}`);
  const semis = NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) - (m[3] ? 0.5 : 0);
  const midi = 12 * ((m[4] ? +m[4] : 4) + 1) + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface Step { step: number; len: number; f: number; vel: number; hit?: string }

/** A track's notes as steps. */
export function parseTrack(notes: string, oct = 0): Step[] {
  const out: Step[] = [];
  let i = 0;
  for (const tok of notes.split(/\s+/).filter(t => t && t !== "|")) {
    if (tok === ".") { i++; continue; }
    if (tok === "-") { if (out.length) out[out.length - 1].len++; i++; continue; }
    const m = /^([^!:]+)(!)?(?::(\d+))?$/.exec(tok);
    if (!m) throw new Error(`sahne: bad step: ${tok}`);
    const len = m[3] ? +m[3] : 1, vel = m[2] ? 1 : 0.72;
    if (/^[a-z]+$/.test(m[1])) out.push({ step: i, len, f: 0, vel, hit: m[1] });
    else out.push({ step: i, len, f: noteFreq(m[1]) * Math.pow(2, oct), vel });
    i += len;
  }
  return out;
}

/** How many steps a motif lasts (its longest track). */
export function motifSteps(def: MotifDef): number {
  return Math.max(0, ...def.tracks.map(t => parseTrack(t.notes).reduce((n, s) => Math.max(n, s.step + s.len), 0)));
}

/** The motif as a patch's voices: each note's voices moved to its step. */
export function motifVoices(def: MotifDef, instruments: Record<string, Instrument>, seed: number | string = 1): { voices: SynthVoice[]; dur: number } {
  const R = rng(seed), stepS = 60 / def.bpm / (def.steps ?? 2), swing = def.swing ?? 0;
  const voices: SynthVoice[] = [];
  for (const tr of def.tracks) {
    const inst = instruments[tr.inst];
    if (!inst) throw new Error(`sahne: no instrument ${tr.inst}`);
    for (const s of parseTrack(tr.notes, tr.oct ?? 0)) {
      const at = (s.step + (s.step % 2 === 1 ? swing : 0)) * stepS;
      for (const v of inst({ f: s.f, len: s.len * stepS, vel: s.vel, hit: s.hit }, R)) {
        voices.push({ ...v, at: (v.at ?? 0) + at, gain: (v.gain ?? 1) * (tr.gain ?? 1) });
      }
    }
  }
  return { voices, dur: motifSteps(def) * stepS + (def.tail ?? 1.2) };
}

export function motifJob(def: MotifDef, instruments: Record<string, Instrument>, seed: number | string = 1, rate = 32000): RenderJob {
  const { voices, dur } = motifVoices(def, instruments, seed);
  return patchJob({ voices, dur, rate, peak: def.peak ?? 0.7 }, seed);
}

export const renderMotif = (def: MotifDef, instruments: Record<string, Instrument>, seed: number | string = 1, rate = 32000): Rendered =>
  finish(motifJob(def, instruments, seed, rate));
