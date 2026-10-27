// Tests of the synthesizer and the sequencer: the pure half of the audio (DESIGN.md §8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPatch, renderLoop, rms, pitchOf, spectrum, curveAt, type Patch } from "../src/audio/dsp.ts";
import { noteFreq, parseTrack, motifSteps, renderMotif, type Instrument } from "../src/audio/motif.ts";

const finite = (x: Float32Array) => x.every(Number.isFinite);
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test("a patch renders the same samples for the same seed, levelled to its peak", () => {
  const p: Patch = { voices: [{ src: { noise: "white" }, env: { a: 0.002, d: 0.08 } }, { src: { osc: "sine", f: 440 }, env: { d: 0.3 }, at: 0.05 }] };
  const a = renderPatch(p, "x"), b = renderPatch(p, "x"), c = renderPatch(p, "y");
  assert.ok(finite(a.data));
  assert.deepEqual(a.data, b.data);
  assert.notDeepEqual(a.data, c.data);
  assert.ok(Math.abs(peak(a.data) - 0.7) < 1e-6);
  assert.ok(Math.abs(a.data.length / a.rate - (0.05 + 0.005 + 0.3 + 0.05)) < 0.01, "the length is where the last voice ends");
});

test("sources sound at their pitch: an oscillator, a pluck, FM, partials", () => {
  for (const [src, f] of [
    [{ osc: "saw", f: 220 }, 220], [{ osc: "square", f: 330 }, 330], [{ osc: "triangle", f: 262 }, 262],
    [{ pluck: 196, decay: 1.2 }, 196], [{ fm: 300, ratio: 1, index: 0.8 }, 300], [{ partials: [[1, 1, 1], [2, 0.4, 0.6]], f: 440 }, 440],
  ] as const) {
    const r = renderPatch({ voices: [{ src: src as Patch["voices"][0]["src"], env: { hold: 0.5, r: 0.05 } }] });
    const p = pitchOf(r.data, r.rate, 2000, 2048);
    assert.ok(Math.abs(p / f - 1) < 0.03, `${JSON.stringify(src)}: ${p.toFixed(1)} Hz`);
  }
});

test("a low-pass filter takes the highs out of noise, and a glide moves", () => {
  const raw = renderPatch({ voices: [{ src: { noise: "white" }, env: { hold: 0.3 } }], peak: 0.5 }, 3);
  const lp = renderPatch({ voices: [{ src: { noise: "white" }, env: { hold: 0.3 }, filter: { type: "lp", f: 800 } }], peak: 0.5 }, 3);
  const hi = (x: Float32Array) => { const s = spectrum(x, 2000, 512, 16); return s.slice(8).reduce((a, b) => a + b, 0) / s.reduce((a, b) => a + b, 0); };
  assert.ok(hi(lp.data) < hi(raw.data) * 0.2, `${hi(lp.data).toFixed(3)} vs ${hi(raw.data).toFixed(3)}`);
  assert.equal(curveAt({ from: 100, to: 400, time: 1 }, 0.5), 200);
  const g = renderPatch({ voices: [{ src: { osc: "sine", f: { from: 200, to: 800, time: 1 } }, env: { hold: 1 } }] });
  assert.ok(pitchOf(g.data, g.rate, 1000, 1024) < pitchOf(g.data, g.rate, 28000, 1024) * 0.5);
});

test("a loop joins its end to its start without a click", () => {
  const r = renderLoop({ dur: 2, voices: [{ src: { noise: "pink" }, filter: { type: "lp", f: 900 }, lfo: { rate: 0.5, depth: 0.6, to: "amp", shape: "noise" } }] }, 5);
  assert.equal(r.data.length, Math.round(2 * r.rate));
  assert.ok(finite(r.data));
  const n = r.data.length, jump = Math.abs(r.data[0] - r.data[n - 1]);
  const typical = rms(r.data) * 2;
  assert.ok(jump < typical, `seam ${jump.toFixed(3)} vs ${typical.toFixed(3)}`);
});

test("notes, rests, holds, accents, lengths and quarter tones parse", () => {
  assert.ok(Math.abs(noteFreq("A4") - 440) < 1e-9);
  assert.ok(Math.abs(noteFreq("A3") - 220) < 1e-9);
  assert.ok(Math.abs(noteFreq("C#4") / noteFreq("C4") - Math.pow(2, 1 / 12)) < 1e-9);
  assert.ok(Math.abs(noteFreq("E~4") / noteFreq("E4") - Math.pow(2, -0.5 / 12)) < 1e-9);
  const s = parseTrack("D4 . F#4:2 - | G4! d t");
  assert.deepEqual(s.map(x => [x.step, x.len, x.vel, x.hit ?? ""]), [[0, 1, 0.72, ""], [2, 3, 0.72, ""], [5, 1, 1, ""], [6, 1, 0.72, "d"], [7, 1, 0.72, "t"]]);
  assert.throws(() => parseTrack("H4"));
});

test("a motif lasts its steps plus its tail and plays every note", () => {
  const sine: Instrument = n => [{ src: { osc: "sine", f: n.f || 100 }, env: { a: 0.01, d: n.len, s: 0 }, gain: n.vel }];
  const def = { bpm: 120, tracks: [{ inst: "sine", notes: "A4 . C5 . E5:2" }, { inst: "sine", notes: "d . . t" }], tail: 0.5 };
  assert.equal(motifSteps(def), 6);
  const r = renderMotif(def, { sine });
  assert.ok(Math.abs(r.data.length / r.rate - (6 * 0.25 + 0.5)) < 0.01);
  assert.ok(finite(r.data));
  assert.ok(rms(r.data, Math.round(0.5 * r.rate), Math.round(0.6 * r.rate)) > 0.02, "the second note sounds");
  assert.throws(() => renderMotif({ bpm: 90, tracks: [{ inst: "nope", notes: "A4" }] }, { sine }));
});

test("a pluck is in tune high up too (the loop's averaging delays half a sample)", () => {
  // the strongest frequency within ±60 cents, to half a cent
  const cents = (x: Float32Array, fs: number, f0: number) => {
    let best = 0, at = 0;
    for (let c = -60; c <= 60; c += 0.5) {
      const f = f0 * Math.pow(2, c / 1200);
      let re = 0, im = 0;
      for (let i = 0; i < 8192; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / 8192), s = x[3000 + i] * w; re += s * Math.cos(2 * Math.PI * f * i / fs); im += s * Math.sin(2 * Math.PI * f * i / fs); }
      if (Math.hypot(re, im) > best) { best = Math.hypot(re, im); at = c; }
    }
    return at;
  };
  for (const f of [147, 587, 1175]) {
    const r = renderPatch({ voices: [{ src: { pluck: f, decay: 2 }, env: { hold: 0.6 } }] });
    assert.ok(Math.abs(cents(r.data, r.rate, f)) <= 2, `${f} Hz: ${cents(r.data, r.rate, f)} cents`);
  }
});

test("a loop of a steady hum keeps its level through the crossfade", () => {
  // 100 Hz in a 2 s loop: the folded halves are in phase, so an equal-power fade would swell by 3 dB
  const r = renderLoop({ dur: 2, voices: [{ src: { osc: "sine", f: 100 } }] }, 1), w = Math.round(0.05 * r.rate);
  const body = rms(r.data, r.data.length / 2, r.data.length / 2 + w);
  for (let t = 0; t < 0.5; t += 0.05) {
    const at = Math.round(t * r.rate), v = rms(r.data, at, at + w);
    assert.ok(Math.abs(v / body - 1) < 0.03, `${t.toFixed(2)} s: ${(v / body).toFixed(3)}`);
  }
});

test("a one-shot starts and ends at silence even with low rumble in it (no DC step at its edges)", () => {
  const r = renderPatch({ voices: [{ src: { noise: "brown" }, env: { a: 0.002, d: 0.08 }, filter: { type: "lp", f: 300 } }, { src: { osc: "sine", f: { from: 120, to: 50, time: 0.1 } }, env: { d: 0.15 } }] }, 4);
  assert.equal(r.data[0], 0);
  assert.ok(Math.abs(r.data[r.data.length - 1]) < 0.005, `${r.data[r.data.length - 1]}`);
  assert.ok(Math.abs(Math.max(...r.data.map(Math.abs)) - 0.7) < 1e-6);
});
