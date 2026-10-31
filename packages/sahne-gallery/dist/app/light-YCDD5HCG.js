import {
  BAKKAL
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_ROOF
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  choice,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  TIMES,
  WEATHER
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/light.ts
function build(host, ctx) {
  host.append($("h2", "", "A room through the day"), $("p", "note", "Each time is a light state (sky, ambient, key, haze, glow, practical lamps, shadow, grain); a change blends over 0.9 s, or as slowly as the script asks (time:night:6000). Weather sits over any time; thunder is one flash and its sound (none under Still); the lights switch the room's lamps and glow off, but a street lamp or a window across the street is not on its switch."));
  const shop = bench(host, ctx, { places: [BAKKAL], cast: {}, cues: [{ scene: { place: "bakkal", time: "day", at: {} } }] });
  let slow = false;
  host.append(
    choice("time", Object.keys(TIMES), "day", (t) => {
      shop.play({ beat: { env: `time:${t}${slow ? ":6000" : ""}` } });
    }),
    bar("", toggle("slowly (6 s)", false, (on) => {
      slow = on;
    })),
    bar("weather", ...Object.keys(WEATHER).map((w) => shop.cue(w, { beat: { env: `weather:${w}` } })), shop.cue("thunder", { beat: { env: "thunder" } })),
    bar("lights", shop.cue("off", { beat: { env: "lights_off" } }), shop.cue("on", { beat: { env: "lights_on" } }))
  );
  host.append($("h2", "", "A city lighting up, and the night sky"), $("p", "note", "From a roof: the city's glow along the horizon comes first, then lamps and shops, then the far windows one by one (each flat has its own glowAt), then the moon and the stars. Grey or rain hides the sky (cloud). Pan: the streets slide by, the sky stays put (it is drawn at infinity)."));
  let phase = 0.5;
  const roof = () => ({ ...BENCH_ROOF, pieces: BENCH_ROOF.pieces.map((p) => p.kit === "night_sky" ? { ...p, phase } : p) });
  const cues = (time) => [{ scene: { place: "bench_roof", time, at: { a: "left", b: "right" } } }];
  const city = bench(host, ctx, { places: [roof()], cast: { a: ctx.kit.defaultDoc, b: ctx.kit.defaultDoc }, cues: cues("night") });
  const reload = (time) => {
    city.stage.load({ v: 1, cues: cues(time) }, { cast: { a: ctx.kit.defaultDoc, b: ctx.kit.defaultDoc }, places: { bench_roof: roof() } });
    city.stage.show(0);
  };
  host.append(
    bar(
      "dusk",
      city.cue("dusk falls (16 s)", () => {
        reload("golden");
        return { beat: { env: ["time:night:16000"] } };
      }),
      ...["golden", "dusk", "night"].map((t) => city.cue(t, { beat: { env: `time:${t}` } }))
    ),
    bar(
      "sky",
      ...["clear", "grey", "rain"].map((w) => city.cue(w, { beat: { env: `weather:${w}` } })),
      city.cue("pan left", { beat: { who: "a", cam: "close" } }),
      city.cue("pan right", { beat: { who: "b", cam: "close" } }),
      city.cue("wide", { beat: { cam: "wide" } })
    ),
    choice("moon", ["new", "crescent", "quarter", "full", "waning"], "full", (o) => {
      phase = { new: 0, crescent: 0.12, quarter: 0.25, full: 0.5, waning: 0.8 }[o] ?? 0.5;
      reload("night");
    })
  );
}
export {
  build
};
//# sourceMappingURL=light-YCDD5HCG.js.map
