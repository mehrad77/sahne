// Builds the kit's recorded sounds (DESIGN.md §8.3) from the source recordings in library/:
// each is cut, mixed to mono, cleaned of rumble, faded (or, for ambience, made a seamless loop
// with a little of the loop on both sides), levelled, and encoded as AAC. SOURCES.md lists every
// source file with its author and licence; library/ itself is local only (git-ignored).
//
//   node packages/sahne-kit/sounds/build.ts           rebuild every recording
//   node packages/sahne-kit/sounds/build.ts --check   the files exist, fit the budget and are listed in SOURCES.md
//
// Needs ffmpeg (decoding) and afconvert (macOS, Apple's AAC encoder).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rng, renderLoop, rms } from "sahne";
import { SOUNDS } from "../src/sounds.ts";

const DIR = new URL(".", import.meta.url).pathname, LIB = DIR + "library/", FS = 44100;
/** Seconds of the loop carried before its start and after its end (a decoder's padding may shift it). */
export const PAD = 0.25;
const MAX_BYTES = 80 * 1024;

interface Cut {
  src: string;
  /** Seconds into the source. */
  start: number;
  dur: number;
  /** High-pass (Hz): city rumble under a gull, wind on the microphone. */
  hp?: number;
  /** Low-pass (Hz): a crowd further away, its consonants softened so no word can be made out. */
  lp?: number;
  fadeIn?: number;
  fadeOut?: number;
  /** One-shots: the loudest sample. */
  peak?: number;
  /** Ambience: a seamless loop, as loud (RMS) as the kit's synthesized loop of the same id. */
  loop?: boolean;
}

/** Which part of which source each recording is. Their files are `<id>.m4a`. */
export const CUTS: Record<string, Cut> = {
  // two gulls calling over Şişli, the city below them
  gull: { src: "gull-istanbul-sisli-felix.blume-167374.mp3", start: 28.45, dur: 2.5, hp: 450, fadeIn: 0.06, fadeOut: 0.3, peak: 0.7 },
  // a ship's horn in Istanbul, its third blast and its echo off the shore
  ferry_horn: { src: "horn-istanbul-cruiser-felix.blume-162350.mp3", start: 15.45, dur: 5.55, hp: 35, fadeIn: 0.08, fadeOut: 0.7, peak: 0.7 },
  // a side street in Istanbul seen from a balcony: cars and a lorry going by
  traffic: { src: "traffic-istanbul-side-street-fielastro-250507.mp3", start: 95, dur: 8, hp: 40, loop: true },
  // a crowd murmuring at a distance, never a word that can be made out
  crowd: { src: "crowd-murmuring-blaastaal-766658.mp3", start: 49, dur: 8, hp: 80, lp: 3500, loop: true },
};

function decode(src: string, start: number, dur: number): Float32Array {
  const b = execFileSync("ffmpeg", ["-v", "error", "-ss", String(start), "-t", String(dur), "-i", LIB + src, "-ac", "1", "-ar", String(FS), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
}

/** A two-pole Butterworth filter, run forwards and backwards so it shifts nothing. */
function butter(x: Float32Array, f: number, high: boolean) {
  const w = Math.tan(Math.PI * f / FS), k = Math.SQRT2, a0 = 1 + k * w + w * w;
  const a1 = 2 * (w * w - 1) / a0, a2 = (1 - k * w + w * w) / a0;
  const [b0, b1, b2] = high ? [1 / a0, -2 / a0, 1 / a0] : [w * w / a0, 2 * w * w / a0, w * w / a0];
  const pass = () => {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  };
  pass(); x.reverse(); pass(); x.reverse();
}
function clean(x: Float32Array, c: Cut) { if (c.hp) butter(x, c.hp, true); if (c.lp) butter(x, c.lp, false); }

function scale(x: Float32Array, g: number) { for (let i = 0; i < x.length; i++) x[i] *= g; }
const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

function oneShot(c: Cut): Float32Array {
  const x = decode(c.src, c.start, c.dur);
  clean(x, c);
  const fi = Math.round((c.fadeIn ?? 0.01) * FS), fo = Math.round((c.fadeOut ?? 0.05) * FS);
  for (let i = 0; i < fi; i++) x[i] *= Math.sin(i / fi * Math.PI / 2) ** 2;
  for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= Math.sin(i / fo * Math.PI / 2) ** 2;
  scale(x, (c.peak ?? 0.7) / peakOf(x));
  return x;
}

/** A seamless loop (the overhang folded back over the start, as dsp.ts does), with PAD of it on both sides. */
function loop(id: string, c: Cut): Float32Array {
  const X = Math.round(0.5 * FS), N = Math.round(c.dur * FS);
  const long = decode(c.src, c.start, c.dur + 0.5);
  clean(long, c);
  const L = long.slice(0, N);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < X; i++) { ab += long[N + i] * long[i]; aa += long[N + i] ** 2; bb += long[i] ** 2; }
  const rho = Math.max(0, Math.min(1, ab / Math.sqrt(aa * bb || 1)));
  for (let i = 0; i < X; i++) {
    const k = i / X, co = Math.cos(k * Math.PI / 2), si = Math.sin(k * Math.PI / 2);
    L[i] = (long[N + i] * co + long[i] * si) / Math.sqrt(1 + 2 * rho * co * si);
  }
  // as loud as the synthesized loop it replaces, and never near clipping
  const def = SOUNDS[id], seed = `${id}:0`;
  const target = def ? rms(renderLoop(def.patch({ rng: rng(seed), take: 0, params: {} }), seed).data) : 0.12;
  scale(L, Math.min(target / rms(L), 0.9 / peakOf(L)));
  const P = Math.round(PAD * FS), out = new Float32Array(N + 2 * P);
  out.set(L.subarray(N - P), 0); out.set(L, P); out.set(L.subarray(0, P), P + N);
  return out;
}

function wav(path: string, x: Float32Array) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(FS, 24); b.writeUInt32LE(FS * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
}

/** What is wrong with the built recordings (nothing: an empty list). Needs neither ffmpeg nor the library. */
export function check(): string[] {
  const problems: string[] = [], sources = readFileSync(DIR + "SOURCES.md", "utf8");
  for (const [id, c] of Object.entries(CUTS)) {
    const file = DIR + id + ".m4a", rec = SOUNDS[id]?.recording;
    if (!existsSync(file)) { problems.push(`${id}.m4a is missing: run the build`); continue; }
    if (statSync(file).size > MAX_BYTES) problems.push(`${id}.m4a is ${statSync(file).size} bytes, over ${MAX_BYTES}`);
    if (!sources.includes(c.src)) problems.push(`${c.src} is not in SOURCES.md`);
    if (rec?.file !== id + ".m4a") problems.push(`sounds.ts: ${id} does not name ${id}.m4a as its recording`);
    const want = c.loop ? [PAD, PAD + c.dur] : undefined;
    if (JSON.stringify(rec?.loop) !== JSON.stringify(want)) problems.push(`sounds.ts: ${id}'s loop should be ${JSON.stringify(want)}`);
  }
  return problems;
}

if (import.meta.filename !== process.argv[1]) { /* imported (the kit's tests): nothing to run */ }
else if (process.argv.includes("--check")) {
  const p = check();
  for (const m of p) console.error(m);
  if (p.length) process.exit(1);
  console.log(`recordings OK (${Object.keys(CUTS).length})`);
} else {
  const tmp = mkdtempSync(join(tmpdir(), "sahne-rec-"));
  for (const [id, c] of Object.entries(CUTS)) {
    if (!existsSync(LIB + c.src)) { console.error(`${id}: ${c.src} is not in library/ (SOURCES.md says where it comes from)`); process.exitCode = 1; continue; }
    const x = c.loop ? loop(id, c) : oneShot(c), w = join(tmp, id + ".wav");
    wav(w, x);
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", "-c", "1", w, DIR + id + ".m4a"]);
    console.log(`${id}.m4a ${(x.length / FS).toFixed(2)} s, ${statSync(DIR + id + ".m4a").size} bytes`);
  }
  for (const m of check()) console.error(m);
}
