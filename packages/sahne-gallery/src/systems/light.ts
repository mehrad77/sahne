// Light and time of day (DESIGN.md §6.5): the six times, a slow change (dusk falling over seconds),
// weather over any time, thunder, the lights on and off (a street lamp off the switch stays lit), and
// at night a city lighting up window by window (glowAt) under a sky that holds still while the camera
// pans (FlatSpec.sky), with the moon in its phase, hidden by cloud.

import { TIMES, WEATHER, type Cue, type PlaceDoc } from "sahne";
import { $, bar, choice, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL } from "../bakkal.ts";
import { bench, BENCH_ROOF } from "./bench.ts";

export function build(host: HTMLElement, ctx: Ctx) {
  // ---- the bakkal: times, weather, thunder, the lights ----
  host.append($("h2", "", "A room through the day"), $("p", "note", "Each time is a light state (sky, ambient, key, haze, glow, practical lamps, shadow, grain); a change blends over 0.9 s, or as slowly as the script asks (time:night:6000). Weather sits over any time; thunder is one flash and its sound (none under Still); the lights switch the room's lamps and glow off, but a street lamp or a window across the street is not on its switch."));
  const shop = bench(host, ctx, { places: [BAKKAL], cast: {}, cues: [{ scene: { place: "bakkal", time: "day", at: {} } }] });
  let slow = false;
  host.append(
    choice("time", Object.keys(TIMES), "day", t => { shop.play({ beat: { env: `time:${t}${slow ? ":6000" : ""}` } }); }),
    bar("", toggle("slowly (6 s)", false, on => { slow = on; })),
    bar("weather", ...Object.keys(WEATHER).map(w => shop.cue(w, { beat: { env: `weather:${w}` } })), shop.cue("thunder", { beat: { env: "thunder" } })),
    bar("lights", shop.cue("off", { beat: { env: "lights_off" } }), shop.cue("on", { beat: { env: "lights_on" } })),
  );

  // ---- the roof: the city lighting up, the sky, the moon ----
  host.append($("h2", "", "A city lighting up, and the night sky"), $("p", "note", "From a roof: the city's glow along the horizon comes first, then lamps and shops, then the far windows one by one (each flat has its own glowAt), then the moon and the stars. Grey or rain hides the sky (cloud). Pan: the streets slide by, the sky stays put (it is drawn at infinity)."));
  let phase = 0.5;
  const roof = (): PlaceDoc => ({ ...BENCH_ROOF, pieces: BENCH_ROOF.pieces.map(p => p.kit === "night_sky" ? { ...p, phase } : p) });
  const cues = (time: string): Cue[] => [{ scene: { place: "bench_roof", time, at: { a: "left", b: "right" } } }];
  const city = bench(host, ctx, { places: [roof()], cast: { a: ctx.kit.defaultDoc, b: ctx.kit.defaultDoc }, cues: cues("night") });
  const reload = (time: string) => { city.stage.load({ v: 1, cues: cues(time) }, { cast: { a: ctx.kit.defaultDoc, b: ctx.kit.defaultDoc }, places: { bench_roof: roof() } }); city.stage.show(0); };
  host.append(
    bar("dusk",
      city.cue("dusk falls (16 s)", () => { reload("golden"); return { beat: { env: ["time:night:16000"] } }; }),
      ...["golden", "dusk", "night"].map(t => city.cue(t, { beat: { env: `time:${t}` } })),
    ),
    bar("sky", ...["clear", "grey", "rain"].map(w => city.cue(w, { beat: { env: `weather:${w}` } })),
      city.cue("pan left", { beat: { who: "a", cam: "close" } }), city.cue("pan right", { beat: { who: "b", cam: "close" } }), city.cue("wide", { beat: { cam: "wide" } })),
    choice("moon", ["new", "crescent", "quarter", "full", "waning"], "full", o => { phase = { new: 0, crescent: 0.12, quarter: 0.25, full: 0.5, waning: 0.8 }[o] ?? 0.5; reload("night"); }),
  );
}
