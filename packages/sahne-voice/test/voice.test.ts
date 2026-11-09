import { test } from "node:test";
import assert from "node:assert/strict";
import { tr } from "sahne-tr";
import type { SpeakOptions, VoiceProvider } from "sahne";
import { clipFile, clipVoice, hash, type Manifest } from "../src/index.ts";
import { candidates } from "../build/voices.ts";

test("hash and clip names are stable", () => {
  assert.equal(hash("a"), hash("a"));
  assert.notEqual(hash("a"), hash("b"));
  assert.match(hash("Hoş geldin!"), /^[0-9a-f]{14}$/);
  assert.equal(clipFile("farzad", "Hoş geldin!"), clipFile("farzad", "Hoş geldin!"));
  assert.notEqual(clipFile("farzad", "Hoş geldin!"), clipFile("kerim", "Hoş geldin!"));
});

/** A stand-in for Web Audio: a buffer source that "plays" for the buffer's length. */
function fakeOut() {
  const started: number[] = [];
  const ctx = {
    decodeAudioData: async () => ({ duration: 1.2 }),
    createBufferSource() {
      const src = { buffer: null as unknown, onended: null as null | (() => void), connect() {}, stop() {}, start() { started.push(1); setTimeout(() => src.onended?.(), 5); } };
      return src;
    },
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
  };
  return { out: { context: ctx } as unknown as AudioNode, started };
}

const manifest: Manifest = { story: "s1e01", lines: { farzad: { "Hoş geldin!": { f: "a.m4a", ms: 1200, sig: "x" } } } };
const fetcher = (async (u: string) => (u.endsWith("manifest.json") ? { ok: true, json: async () => manifest } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;

test("clipVoice plays a line's clip, with its start, words and end", async () => {
  const v = await clipVoice({ base: "/voices/s1e01/", lang: tr, fetch: fetcher });
  assert.equal(v.count, 1);
  assert.equal(v.available("tr"), true);
  const { out, started } = fakeOut(), seen: string[] = [];
  await new Promise<void>(done => {
    v.speak("Hoş geldin!", { lang: "tr", who: "farzad", out, onStart: () => seen.push("start"), onWord: i => seen.push(`w${i}`), onEnd: () => { seen.push("end"); done(); } } as SpeakOptions);
  });
  assert.equal(started.length, 1);
  assert.deepEqual(seen.filter(s => s === "start" || s === "end"), ["start", "end"]);
});

test("clipVoice hands a line with no clip to the fallback, and without one leaves it unvoiced", async () => {
  const said: string[] = [];
  const fallback: VoiceProvider = { id: "f", available: () => true, speak: (t) => { said.push(t); return { cancel() {} }; }, cancel() {} };
  const v = await clipVoice({ base: "/voices/s1e01/", lang: tr, fetch: fetcher, fallback });
  const { out } = fakeOut();
  v.speak("Hoş geldin, Mehrad!", { lang: "tr", who: "farzad", out });
  assert.deepEqual(said, ["Hoş geldin, Mehrad!"]);
  const bare = await clipVoice({ base: "/voices/s1e01/", lang: tr, fetch: fetcher });
  assert.equal(bare.speak("Başka.", { lang: "tr", who: "farzad", out }), null);
});

test("clipVoice leaves an unvoiced character's lines silent, never the fallback", async () => {
  const said: string[] = [];
  const fallback: VoiceProvider = { id: "f", available: () => true, speak: (t) => { said.push(t); return { cancel() {} }; }, cancel() {} };
  const m: Manifest = { ...manifest, unvoiced: ["nima"] };
  const f = (async (u: string) => (u.endsWith("manifest.json") ? { ok: true, json: async () => m } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
  const v = await clipVoice({ base: "/v/", lang: tr, fetch: f, fallback });
  const { out } = fakeOut();
  assert.equal(v.speak("Hoş bulduk!", { lang: "tr", who: "nima", out }), null);
  assert.deepEqual(said, []);
});

test("clipVoice without a manifest is its fallback alone", async () => {
  const v = await clipVoice({ base: "/x/", lang: tr, fetch: (async () => ({ ok: false })) as unknown as typeof fetch });
  assert.equal(v.count, 0);
  assert.equal(v.available("tr"), false);
});

test("candidates: an accented character hears their own language's voices and two Turkish ones", () => {
  const p = (id: string, lang: string, gender: "female" | "male" | "child", f0: number) => ({ id, lang, gender, f0, source: "", license: "" });
  const all = [p("fa_m01", "fa", "male", 110), p("fa_m02", "fa", "male", 130), p("fa_f01", "fa", "female", 220), p("tr_m01", "tr", "male", 120), p("tr_m02", "tr", "male", 140), p("tr_m03", "tr", "male", 100)];
  const c = candidates({ gender: "male", age: "adult", accent: "fa" }, all, 4).map(x => x.id);
  assert.deepEqual(c, ["fa_m01", "fa_m02", "tr_m01", "tr_m03"]);
  assert.ok(candidates({ gender: "female", age: "adult" }, all, 3).every(x => x.lang === "tr"));
  const kids = [...all, p("tr_f01", "tr", "female", 240), p("tr_c01", "tr", "child", 300)];
  assert.deepEqual(candidates({ gender: "male", age: "child" }, kids, 2).map(x => x.id), ["tr_c01", "tr_f01"]);
  assert.ok(!candidates({ gender: "female", age: "adult" }, kids, 9).some(x => x.gender === "child"));
});
