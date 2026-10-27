// Tests of the light (DESIGN.md §6.5): dawn, the weather over the time of day,
// lightning, and how the director and the timeline carry them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMES, WEATHER, cloudAt, glowWeight, withFlash, withWeather, type LightState } from "../src/render/paper/light.ts";
import { directAll, type DirectCtx } from "../src/director/direct.ts";
import { evaluate } from "../src/anim/timeline.ts";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import type { PlaceDoc } from "../src/core/types.ts";

const lum = (c: number[]) => c[0] + c[1] + c[2];
const finite = (l: LightState) => Object.values(l).every(v => (Array.isArray(v) ? v : [v]).every(Number.isFinite));

test("dawn: practicals still on, a little glow, a key far weaker than day's and a cooler sky", () => {
  const d = TIMES.dawn;
  assert.ok(d.practical > 0.5 && d.glow > 0.3 && d.glow < TIMES.night.glow);
  assert.ok(lum(d.key) < lum(TIMES.day.key) * 0.7);
  assert.ok(d.skyTop[2] > d.skyTop[0], "a blue sky above");
});

test("weather: clear changes nothing; grey and rain weaken the sun and the shadows, and stay finite at every time", () => {
  for (const t of Object.keys(TIMES)) {
    assert.deepEqual(withWeather(TIMES[t], "clear"), TIMES[t]);
    assert.deepEqual(withWeather(TIMES[t], "unknown"), TIMES[t]);
    for (const w of ["grey", "rain"]) {
      const l = withWeather(TIMES[t], w);
      assert.ok(finite(l), `${t} ${w}`);
      assert.ok(lum(l.key) < lum(TIMES[t].key) + 1e-9 && l.shadow <= TIMES[t].shadow, `${t} ${w}`);
    }
  }
  assert.ok(withWeather(TIMES.day, "rain").practical > TIMES.day.practical, "rain lights the lamps a little");
  assert.equal(WEATHER.rain.bed, "rain");
});

test("lightning brightens the sky by up to a third, and nothing at 0", () => {
  assert.deepEqual(withFlash(TIMES.night, 0), TIMES.night);
  const f = withFlash(TIMES.night, 1);
  assert.ok(lum(f.skyTop) > lum(TIMES.night.skyTop) && f.skyTop.every(v => v <= 1));
});

const place: PlaceDoc = { v: 1, id: "class", size: { w: 8, d: 4 }, pieces: [], marks: { here: { x: 0, z: 0 } } };
const ctx: DirectCtx = { places: { class: place }, gestures: {}, lang: { id: "x", speech: speechFallback, match: matchFallback } };

test("the scene's weather, env weather: and thunder: the world keeps it, the timeline blends it, the flash rises and fades", () => {
  const ps = directAll([
    { scene: { place: "class", at: { a: "here" }, weather: "grey" } },
    { beat: { env: "weather:rain" } },
    { beat: { env: ["thunder", "thunder"] } },
    { scene: { place: "class", at: { a: "here" } } },
  ], ["a"], ctx);
  assert.equal(ps[0].after.weather, "grey");
  assert.equal(ps[1].after.weather, "rain");
  const mid = evaluate(ps[1], 750).weather;
  assert.ok(mid.from === "grey" && mid.to === "rain" && mid.k > 0.3 && mid.k < 0.7, JSON.stringify(mid));
  assert.equal(ps[2].flashes?.length, 1, "one flash at a time, never a flicker");
  assert.ok(ps[2].sounds.some(s => s.id === "thunder"));
  const fl = (t: number) => evaluate(ps[2], t).flash;
  assert.ok(fl(30) > 0.3 && fl(60) === 1 && fl(300) > 0 && fl(300) < 1 && fl(500) === 0);
  assert.equal(ps[3].after.weather, "rain", "the weather carries into the next scene");
});

test("lights_off and lights_on: on the gesture's stroke, over 0.6 s; kept inside a site, back on in another", () => {
  const room: PlaceDoc = { v: 1, id: "room", site: "flat", size: { w: 8, d: 4 }, pieces: [], marks: { here: { x: 0, z: 0 } } };
  const hall: PlaceDoc = { ...room, id: "hall" };
  const shop: PlaceDoc = { ...room, id: "shop", site: undefined };
  const c: DirectCtx = { ...ctx, places: { room, hall, shop }, gestures: { reach: { dur: 900, stroke: 400, keys: [{ t: 0 }, { t: 400, arm: 1 }, { t: 900 }] } } };
  const ps = directAll([
    { scene: { place: "room", at: { a: "here" } } },
    { line: { who: "a", text: "…", voice: "silent", do: "reach", env: "lights_off" } },
    { scene: { place: "hall", at: { a: "here" } } },
    { scene: { place: "shop", at: { a: "here" } } },
  ], ["a"], c);
  const ev = ps[1].lights![0];
  assert.ok(!ev.on && ev.t >= 300, `off at the stroke (${ev.t} ms)`);
  assert.equal(evaluate(ps[1], 0).lights, 1);
  const mid = evaluate(ps[1], ev.t + 300).lights;
  assert.ok(mid > 0.3 && mid < 0.7, `halfway (${mid})`);
  assert.equal(evaluate(ps[1], ev.t + 700).lights, 0);
  assert.equal(ps[2].after.lights, false, "still off in another room of the flat");
  assert.equal(evaluate(ps[2], 0).lights, 0);
  assert.equal(ps[3].after.lights, undefined, "a new site starts with its lights on");
});

test("windows come on one by one: glowAt sets where a flat's glow starts, over the next 0.12 of the time's glow", () => {
  assert.equal(glowWeight(undefined, 0.3), 1);
  assert.equal(glowWeight(0.5, 0.4), 0);
  assert.ok(Math.abs(glowWeight(0.5, 0.56) - 0.5) < 1e-9);
  assert.equal(glowWeight(0.5, 0.7), 1);
  // dusk lights the early windows, night all of them; stars (0.8) wait for night
  assert.ok(glowWeight(0.15, TIMES.dusk.glow) === 1 && glowWeight(0.8, TIMES.dusk.glow) === 0 && glowWeight(0.8, TIMES.night.glow) === 1);
});

test("cloud hides the sky: none when clear, most in grey, all in rain, blending as the weather changes", () => {
  assert.equal(cloudAt({ from: "clear", to: "clear", k: 1 }), 0);
  assert.equal(cloudAt({ from: "grey", to: "grey", k: 1 }), 0.9);
  assert.equal(cloudAt({ from: "clear", to: "rain", k: 0.5 }), 0.5);
  assert.equal(cloudAt({ from: "fog", to: "fog", k: 1 }), 0, "an unknown weather is clear");
});

test("a time change can take its time (env time:<t>:<ms>): a slow nightfall", () => {
  const ps = directAll([{ scene: { place: "class", at: { a: "here" }, time: "golden" } }, { beat: { env: "time:night:8000" } }, { beat: { env: "time:day" } }], ["a"], ctx);
  const k = (i: number, t: number) => evaluate(ps[i], t).time.k;
  assert.ok(k(1, 4000) > 0.4 && k(1, 4000) < 0.6 && k(1, 8000) === 1 && ps[1].dur >= 8000, "halfway at 4 s");
  assert.equal(k(2, 900), 1, "the default is still 0.9 s");
});

test("stop:<station> and depart hold a vehicle that stops and start it again; a scene can open at a station; another place drops it", () => {
  const car: PlaceDoc = { v: 1, id: "car", size: { w: 8, d: 3 }, life: "run", pieces: [], marks: { here: { x: 0, z: 0 } }, stops: { stations: ["A", "B", "C"] } };
  const shop: PlaceDoc = { ...car, id: "shop", life: undefined, stops: undefined };
  const c: DirectCtx = { ...ctx, places: { car, shop } };
  const ps = directAll([
    { scene: { place: "car", at: { a: "here" } } },
    { beat: { env: "stop:C" } },
    { line: { who: "a", text: "…", voice: "silent" } },
    { beat: { env: "depart" } },
    { scene: { place: "car", at: { a: "here" }, stop: "B" } },
    { beat: { env: "stop:A" } },
    { scene: { place: "shop", at: { a: "here" } } },
  ], ["a"], c);
  assert.equal(evaluate(ps[0], 0).stops, null, "it runs on its own");
  assert.deepEqual(ps[1].stops, [{ t: 0, at: 2, arrive: true }]);
  assert.deepEqual(evaluate(ps[1], 10).stops, { at: 2, arrive: true, go: false });
  assert.deepEqual(evaluate(ps[2], 0).stops, { at: 2, arrive: false, go: false }, "still held in the next cue");
  assert.deepEqual(evaluate(ps[3], 10).stops, { at: 2, arrive: false, go: true });
  assert.deepEqual(ps[4].after.stops, { at: 1 }, "the scene opens at B");
  assert.equal(ps[5].stops, undefined, "the first station is where it starts: no stop there");
  assert.equal(ps[6].after.stops, undefined);
});

test("a bare stop halts a vehicle that stops where it is (a jam), and depart sends it on", () => {
  const car: PlaceDoc = { v: 1, id: "car", size: { w: 8, d: 3 }, life: "run", pieces: [], marks: { here: { x: 0, z: 0 } }, stops: { stations: ["A", "B"] } };
  const shop: PlaceDoc = { ...car, id: "shop", stops: undefined };
  const ps = directAll([
    { scene: { place: "car", at: { a: "here" } } },
    { beat: { env: "stop" } },
    { beat: { env: "depart" } },
    { scene: { place: "shop", at: { a: "here" } } },
    { beat: { env: "stop" } },
  ], ["a"], { ...ctx, places: { car, shop } });
  assert.deepEqual(evaluate(ps[1], 10).stops, { at: -1, arrive: true, go: false });
  assert.deepEqual(evaluate(ps[2], 10).stops, { at: -1, arrive: false, go: true });
  assert.equal(ps[4].stops, undefined, "no halt where nothing stops");
});

test("a seat mark facing side_l or side_r seats its sitter side on: placed there, walked there, and no more once up", () => {
  const bus: PlaceDoc = { v: 1, id: "bus", size: { w: 8, d: 3 }, pieces: [], marks: { s: { x: 0, z: 0, seat: 0.45, facing: "side_l" }, t: { x: 1, z: 0, seat: 0.45, facing: "side_r" }, aisle: { x: 2, z: 0.5 } } };
  const ps = directAll([
    { scene: { place: "bus", at: { a: "s", b: "aisle" } } },
    { beat: { move: { who: "b", to: "t" } } },
    { beat: { move: { who: "a", to: "aisle" } } },
  ], ["a", "b"], { ...ctx, places: { bus } });
  assert.deepEqual(evaluate(ps[0], 0).actors.a.seat, { h: 0.45, k: 1, side: -1 });
  assert.equal(evaluate(ps[0], 0).actors.a.yaw, 0, "faces front: the side view is drawn by the stage");
  assert.equal(evaluate(ps[1], ps[1].dur).actors.b.seat?.side, 1);
  assert.equal(evaluate(ps[2], ps[2].dur).actors.a.seat, null);
  assert.equal(ps[2].after.actors.a.seatSide, undefined);
});
