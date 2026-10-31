// The kit's sounds and music, checked by numbers (nobody here can listen): every sound renders
// cleanly at its level and length, loops join, and the sounds that carry meaning have their shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, renderPatch, renderLoop, renderMotif, parseTrack, motifSteps, noteFreq, rms, spectrum, pitchOf, type Rendered } from "sahne";
import kit, { SOUNDS, INSTRUMENTS, MOTIFS } from "../src/index.ts";

const SURFACES = ["stone", "wood", "tile", "carpet"];
const QUIET = new Set(["step", "paper_flip", "ui_tap"]);
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const secs = (r: Rendered) => r.data.length / r.rate;

/** Render a take as the engine does: the patch's rng and the renderer seeded by the id and take. */
function render(id: string, take = 0, params: Record<string, unknown> = {}): Rendered {
  const def = SOUNDS[id], seed = `${id}:${take}`, p = def.patch({ rng: rng(seed), take, params });
  return def.loop ? renderLoop(p, seed) : renderPatch(p, seed);
}

/** Loudness per 5 ms frame. */
function frames(r: Rendered, ms = 5): number[] {
  const w = Math.round(r.rate * ms / 1000), out: number[] = [];
  for (let i = 0; i + w <= r.data.length; i += w) out.push(rms(r.data, i, i + w));
  return out;
}
/** Runs of frames louder than `k` × the loudest: [start, end) in seconds. */
function segments(r: Rendered, k: number, gap = 0.03): [number, number][] {
  const f = frames(r), top = Math.max(...f), out: [number, number][] = [];
  f.forEach((v, i) => {
    if (v < top * k) return;
    const t = i * 0.005, last = out[out.length - 1];
    if (last && t - last[1] <= gap) last[1] = t + 0.005; else out.push([t, t + 0.005]);
  });
  return out;
}
/** The spectral centroid (Hz) of a window. */
function centroid(r: Rendered, at: number, size = 512): number {
  const s = spectrum(r.data, Math.round(at * r.rate), size, 64);
  let m = 0, w = 0;
  s.forEach((v, b) => { m += v; w += v * (b + 0.5) * r.rate / 2 / 64; });
  return w / m;
}

test("the kit carries the sounds, instruments and motifs", () => {
  assert.equal(kit.sounds, SOUNDS);
  assert.equal(kit.instruments, INSTRUMENTS);
  assert.equal(kit.motifs, MOTIFS);
  for (const id of Object.keys(SOUNDS)) assert.match(id, /^[a-z]+(_[a-z]+)*$/);
});

test("every sound renders every take on every surface: finite, at its level, a sensible length, silent at its ends", () => {
  for (const [id, def] of Object.entries(SOUNDS)) {
    for (let take = 0; take < (def.takes ?? 1); take++) for (const surface of def.loop ? ["tile"] : SURFACES) {
      const r = render(id, take, { surface }), p = peak(r.data), what = `${id} take ${take} ${surface}`;
      assert.ok(r.data.every(Number.isFinite), `${what}: not finite`);
      if (def.loop) {
        assert.equal(def.bus, "ambience", what);
        assert.equal(r.rate, 22050, what);
        assert.ok(secs(r) >= 6 && secs(r) <= 10, `${what}: ${secs(r)} s`);
        assert.ok(Math.abs(p - 0.5) < 0.01, `${what}: peak ${p}`);
        continue;
      }
      assert.equal(def.bus, "fx", what);
      assert.equal(r.rate, 32000, what);
      const quiet = id === "step" && surface === "carpet";
      if (!quiet) assert.ok(QUIET.has(id) ? p >= 0.3 && p <= 0.45 : p >= 0.6 && p <= 0.8, `${what}: peak ${p}`);
      assert.ok(secs(r) >= 0.04 && secs(r) <= 2.6, `${what}: ${secs(r).toFixed(2)} s`);
      assert.equal(r.data[0], 0, `${what}: starts off zero`);
      const end = peak(r.data.subarray(r.data.length - Math.round(0.002 * r.rate)));
      assert.ok(end < 0.01 * p, `${what}: ends at ${(end / p).toFixed(3)} of its peak (a click)`);
    }
  }
});

test("takes differ, and the same take is the same every time", () => {
  for (const [id, def] of Object.entries(SOUNDS)) {
    assert.deepEqual(render(id, 0).data, render(id, 0).data, id);
    if ((def.takes ?? 1) > 1) assert.notDeepEqual(render(id, 0).data, render(id, 1).data, id);
  }
  assert.ok((SOUNDS.step.takes ?? 1) >= 4);
});

test("every sound word has Turkish and English, and the words are the agreed ones", () => {
  const WORDS: Record<string, [string, string] | null> = {
    clock_tick: ["tik tak", "tick tock"], knock: ["tık tık", "knock knock"], doorbell: ["çın çın", "ding-a-ling"],
    door_open: ["gıcırt", "creak"], door_close: ["küt", "thud"], step: ["tak", "step"], kettle: ["fokur fokur", "bubble bubble"],
    tea_glass: ["çın", "clink"], spoon_glass: ["şıkır şıkır", "clink clink"], gull: ["ak ak", "squawk"], tram_bell: ["dın dın", "ding ding"],
    metro_chime: ["dıt dıt dıt", "beep beep"], ferry_horn: ["düüüt", "toot"], phone_ring: ["zırr zırr", "ring ring"], message: ["dıt", "ping"],
    shutter: ["çıt", "click"], page_turn: ["hışır", "rustle"], paper_flip: ["hışır", "flip"], coo: ["gu guu gu", "coo"], ui_tap: null,
    rain: ["şıpır şıpır", "pitter-patter"], wind: ["uğul uğul", "whoo"], waves: ["şırıl şırıl", "swish"], crowd: ["vızır vızır", "murmur"],
    traffic: ["vın vın", "vroom"], street_far: null, fridge_hum: ["vızzz", "hum"],
    // the places' sounds (M2)
    applause: ["şak şak", "clap clap"], beak_tap: ["tık tık tık", "tap tap tap"], boiler_beep: ["bip bip bip", "beep beep beep"],
    bus_doors: ["fışşş", "pssh"], camera_shutter: ["çıt", "click"], church_bells: ["dan dan", "dong dong"], children_singing: ["la la la", "la la la"],
    coin_clink: ["şıngır", "chink"], door_glass: ["şıkırt", "clack"], fireworks: ["bum", "boom"], keys_jingle: ["şıngır şıngır", "jingle jingle"],
    knitting_clicks: ["tıkır tıkır", "click clack"], marker_squeak: ["gıcır gıcır", "squeak squeak"], market_call: ["taze taze", "fresh fresh"],
    meow: ["miyav", "meow"], number_call: ["tın tın tın", "ding ding ding"], oven_door: ["tangır", "clank"], pen_scratch: ["cızır cızır", "scratch scratch"],
    plane: ["vıııın", "zoom"], queue_chime: ["tıng", "bing"], quiz_bell: ["dıng", "ding"], scissors_snip: ["kırt kırt", "snip snip"],
    shop_bell: ["dıng dong", "ding dong"], singing: ["lay lay lom", "tra la la"], thunder: ["gürül gürül", "rumble"], ticket_print: ["zırrt", "bzzt"],
    toolbox_clank: ["tangır tungur", "clatter"], train_arrive: ["vınnn", "whirr"], trolley_wheels: ["takır takır", "rattle rattle"],
    wind_gust: ["vuuu", "whoosh"], wing_flap: ["pır pır", "flap flap"],
    bus_engine: ["gırr gırr", "brrrm"], car_engine: ["vırrr", "purr"], corridor_chatter: ["vıdı vıdı", "chatter"], corridor_murmur: ["mırıl mırıl", "mumble"],
    echo_room: ["hu hu", "echo"], ferry_engine: ["pat pat pat", "putt putt"], radio_football: ["gooool", "goal"], train_running: ["takır tukur", "clickety-clack"],
    whisper: ["fısıl fısıl", "psst psst"],
    // the props' sounds
    bark: ["hav hav", "woof woof"],
  };
  assert.deepEqual(Object.keys(SOUNDS).sort(), Object.keys(WORDS).sort());
  for (const [id, w] of Object.entries(WORDS)) assert.deepEqual(SOUNDS[id].word ? [SOUNDS[id].word!.tr, SOUNDS[id].word!.en] : null, w, id);
});

test("ambience loops are their length, join without a seam, and keep their level across it", () => {
  for (const [id, def] of Object.entries(SOUNDS)) {
    if (!def.loop) continue;
    const p = def.patch({ rng: rng(`${id}:0`), take: 0, params: {} }), r = render(id), x = r.data, n = x.length;
    assert.equal(n, Math.round(p.dur! * r.rate), id);
    const jump = Math.abs(x[0] - x[n - 1]), step = rms(x) * 2;
    assert.ok(jump < step, `${id}: seam jump ${jump.toFixed(3)} vs ${step.toFixed(3)}`);
    // the level just before the end and just after the start (the folded crossfade) matches the whole
    const w = Math.round(0.25 * r.rate), whole = rms(x);
    for (const part of [rms(x, n - w, n), rms(x, 0, w), rms(x, w, 2 * w)]) assert.ok(part > whole * 0.35 && part < whole * 2.5, `${id}: ${part.toFixed(3)} vs ${whole.toFixed(3)}`);
  }
});

test("clock_tick: four crisp ticks evenly spaced, the tick brighter than the tock", () => {
  const r = render("clock_tick"), s = segments(r, 0.2);
  assert.equal(s.length, 4, JSON.stringify(s));
  const gaps = s.slice(1).map((x, i) => x[0] - s[i][0]), mean = gaps.reduce((a, b) => a + b) / gaps.length;
  assert.ok(mean > 0.4 && mean < 0.6, `spacing ${mean}`);
  for (const g of gaps) assert.ok(Math.abs(g - mean) < 0.05 * mean, `uneven: ${gaps}`);
  for (const [a, b] of s) assert.ok(b - a < 0.06, `not crisp: ${b - a}`);
  const c = s.map(([a]) => centroid(r, a));
  assert.ok(c[0] > c[1] * 1.15 && c[2] > c[3] * 1.15, `centroids ${c.map(Math.round)}`);
});

test("coo: three notes, short–LONG–short, between 350 and 700 Hz", () => {
  const r = render("coo"), s = segments(r, 0.12);
  assert.equal(s.length, 3, JSON.stringify(s));
  const len = s.map(([a, b]) => b - a);
  assert.ok(len[1] > len[0] * 1.5 && len[1] > len[2] * 1.5, `lengths ${len}`);
  for (const [a, b] of s) {
    const f = pitchOf(r.data, r.rate, Math.round((a + b) / 2 * r.rate) - 1024, 2048, 200, 1500);
    assert.ok(f > 350 && f < 700, `pitch ${f.toFixed(0)} Hz`);
  }
  assert.ok(secs(r) > 1 && secs(r) < 1.4, `${secs(r)} s`);
});

test("bark: two short barks, each falling in pitch, the second no higher than the first", () => {
  for (let take = 0; take < (SOUNDS.bark.takes ?? 1); take++) {
    const r = render("bark", take), s = segments(r, 0.15);
    assert.equal(s.length, 2, `take ${take}: ${JSON.stringify(s)}`);
    for (const [a, b] of s) assert.ok(b - a > 0.08 && b - a < 0.22, `take ${take}: a bark of ${(b - a).toFixed(3)} s`);
    const at = (t: number) => pitchOf(r.data, r.rate, Math.round(t * r.rate) - 256, 512, 100, 1200);
    const f = s.map(([a, b]) => [at(a + 0.02), at(b - 0.03)]);
    for (const [hi, lo] of f) assert.ok(hi > 300 && hi < 600 && lo < hi * 0.8, `take ${take}: ${hi.toFixed(0)} → ${lo.toFixed(0)} Hz`);
    assert.ok(f[1][0] <= f[0][0], `take ${take}: the second bark starts higher`);
    assert.ok(secs(r) < 0.6, `take ${take}: ${secs(r)} s`);
  }
});

test("doorbell is bright: most of its energy is above 2 kHz", () => {
  const r = render("doorbell");
  let hi = 0, all = 0;
  for (let t = 0.01; t < secs(r) - 0.1; t += 0.05) {
    const s = spectrum(r.data, Math.round(t * r.rate), 1024, 64); // 250 Hz bands
    s.forEach((v, b) => { all += v * v; if (b >= 8) hi += v * v; });
  }
  assert.ok(hi / all > 0.8, `${(hi / all).toFixed(2)} above 2 kHz`);
});

test("step: soft and short on every surface, and much quieter on carpet than on stone", () => {
  for (let take = 0; take < 4; take++) {
    const stone = render("step", take, { surface: "stone" }), carpet = render("step", take, { surface: "carpet" });
    const loud = (r: Rendered) => Math.max(...frames(r, 10)); // the loudest 10 ms
    assert.ok(loud(carpet) < loud(stone) * 0.25, `take ${take}: ${loud(carpet)} vs ${loud(stone)}`);
    for (const s of SURFACES) { const r = render("step", take, { surface: s }); assert.ok(secs(r) >= 0.06 && secs(r) <= 0.2, `${s}: ${secs(r)}`); }
  }
  assert.deepEqual(render("step", 0, {}).data, render("step", 0, { surface: "tile" }).data, "tile is the default");
});

test("camera_shutter is the shutter; boiler_beep is three short beeps", () => {
  assert.equal(SOUNDS.camera_shutter, SOUNDS.shutter);
  const s = segments(render("boiler_beep"), 0.2);
  assert.equal(s.length, 3, JSON.stringify(s));
  for (const [a, b] of s) assert.ok(b - a > 0.08 && b - a < 0.16, `beep ${b - a}`);
});

test("thunder and the engines are low; the pen, the keys and the coins are high", () => {
  const mean = (id: string) => { const r = render(id); let c = 0, n = 0; for (let t = 0.05; t < secs(r) - 0.1; t += 0.1) { if (rms(r.data, Math.round(t * r.rate), Math.round(t * r.rate) + 512) > 0.02) { c += centroid(r, t); n++; } } return c / n; };
  for (const id of ["thunder", "bus_engine", "ferry_engine", "train_running"]) { const c = mean(id); assert.ok(c < 1500, `${id}: centroid ${c.toFixed(0)} Hz`); }
  for (const id of ["pen_scratch", "keys_jingle", "coin_clink"]) { const c = mean(id); assert.ok(c > 3000, `${id}: centroid ${c.toFixed(0)} Hz`); }
});

test("the singing ends on D: the neighbours' line and the children's", () => {
  for (const [id, d] of [["singing", noteFreq("D4")], ["children_singing", noteFreq("D5")]] as const) {
    const r = render(id), f = pitchOf(r.data, r.rate, Math.round((secs(r) - 0.45) * r.rate), 2048, 100, 1200);
    const off = Math.abs(1200 * Math.log2(f / d)) % 1200;
    assert.ok(Math.min(off, 1200 - off) < 50, `${id} ends on ${f.toFixed(0)} Hz`);
  }
});

test("every instrument plays a note cleanly; the def plays its three strokes", () => {
  for (const [name, inst] of Object.entries(INSTRUMENTS)) {
    const hits = name === "def" ? ["d", "t", "k"] : [undefined];
    for (const hit of hits) {
      const voices = inst({ f: hit ? 0 : noteFreq("D4"), len: 0.4, vel: 0.8, hit }, rng(1));
      assert.ok(voices.length > 0, name);
      const r = renderPatch({ voices }, 1);
      assert.ok(r.data.every(Number.isFinite) && peak(r.data) > 0.69, `${name} ${hit ?? ""}`);
    }
  }
  const saz = renderPatch({ voices: INSTRUMENTS.saz({ f: noteFreq("A4"), len: 0.3, vel: 1 }, rng(2)) });
  assert.ok(Math.abs(pitchOf(saz.data, saz.rate, 3200, 2048, 200, 1000) / 440 - 1) < 0.02, "the saz plays in tune");
  const ney = renderPatch({ voices: INSTRUMENTS.ney({ f: noteFreq("D5"), len: 0.6, vel: 1 }, rng(3)) });
  assert.ok(Math.abs(pitchOf(ney.data, ney.rate, 6400, 2048, 200, 1500) / noteFreq("D5") - 1) < 0.02, "the ney plays in tune");
});

test("every motif parses, uses known instruments, lasts its brief, and ends quietly", () => {
  const LEN: Record<string, [number, number]> = { kerim: [3, 4], home: [2.5, 4], school: [2.5, 4], street: [2.5, 4], sea: [2.5, 4], end: [1.6, 2.4] };
  assert.deepEqual(Object.keys(MOTIFS).sort(), Object.keys(LEN).sort());
  for (const [id, def] of Object.entries(MOTIFS)) {
    assert.ok(motifSteps(def) > 0, id);
    for (const t of def.tracks) assert.ok(t.inst in INSTRUMENTS, `${id}: ${t.inst}`);
    const r = renderMotif(def, INSTRUMENTS, id), [lo, hi] = LEN[id];
    assert.ok(r.data.every(Number.isFinite), id);
    assert.ok(secs(r) >= lo && secs(r) <= hi, `${id}: ${secs(r).toFixed(2)} s`);
    assert.ok(Math.abs(peak(r.data) - 0.7) < 0.01, id);
    assert.equal(r.data[0], 0, id);
    assert.ok(peak(r.data.subarray(r.data.length - 64)) < 0.01, `${id}: does not end quietly`);
  }
});

test("every motif's melody comes home to D, the shared tonic, and the end stinger lands on it", () => {
  const semis = (f: number) => 12 * Math.log2(f / noteFreq("D4"));
  const degree = (f: number) => Math.abs(semis(f) - Math.round(semis(f))) < 1e-6 ? ((Math.round(semis(f)) % 12) + 12) % 12 : -1;
  const isD = (f: number) => degree(f) === 0;
  for (const [id, def] of Object.entries(MOTIFS)) {
    const melody = parseTrack(def.tracks[0].notes, def.tracks[0].oct ?? 0);
    assert.ok(isD(melody[melody.length - 1].f), `${id} ends on ${melody[melody.length - 1].f.toFixed(1)} Hz`);
  }
  // in the stinger, every pitched note sounding at the last step is the tonic or its fifth
  const end = MOTIFS.end, last = motifSteps(end) - 1;
  const ringing = end.tracks.flatMap(t => parseTrack(t.notes, t.oct ?? 0).filter(s => s.f > 0 && s.step <= last && s.step + s.len > last));
  assert.ok(ringing.length > 0);
  for (const s of ringing) assert.ok(degree(s.f) === 0 || degree(s.f) === 7, `${s.f.toFixed(1)} Hz`);
  const melody = parseTrack(end.tracks[0].notes);
  assert.ok(isD(melody[melody.length - 1].f) && melody[melody.length - 1].len >= 2, "the last melody note is a held D");
});

test("the recordings are built, within budget, listed in SOURCES.md and named by their sounds", async () => {
  const { check } = await import("../sounds/build.ts");
  assert.deepEqual(check(), []);
  for (const id of ["gull", "ferry_horn", "traffic", "crowd"]) assert.ok(SOUNDS[id].recording, `${id} has a recording`);
});
