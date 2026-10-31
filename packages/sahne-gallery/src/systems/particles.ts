// Particles (DESIGN.md §6.7): rain outdoors and seen from inside, steam from a çaydanlık, smoke from a
// chimney, a candle's flame, breath in a cold room (and on a beat: do: breath), fireworks. All of it is
// worked out from the time alone, so seeking is exact; under Still it holds as one moment.

import type { PlaceDoc } from "sahne";
import { $, bar } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { bench, BENCH_ROOM, BENCH_STREET, BENCH_PARTY } from "./bench.ts";

export function build(host: HTMLElement, ctx: Ctx) {
  const me = ctx.kit.defaultDoc;
  const street: PlaceDoc = { ...BENCH_STREET, outdoor: true, pieces: [...BENCH_STREET.pieces, { kit: "chimney", x: 2.6, y: 3.2, z: -3.4, smoke: true }] };

  host.append($("h2", "", "Rain, smoke and fireworks outdoors"), $("p", "note", "Rain falls through a place marked outdoor, in front of and behind the actors (and brings its sound bed); a chimney's smoke rises; fireworks burst over the far band at night, 0.7 s apart."));
  const out = bench(host, ctx, { places: [street], cast: { a: me }, cues: [{ scene: { place: "bench_street", time: "overcast", weather: "rain", at: { a: "mid" } } }] });
  host.append(bar("try",
    out.cue("rain", { beat: { env: "weather:rain" } }), out.cue("clear", { beat: { env: "weather:clear" } }),
    out.cue("night", { beat: { env: "time:night" } }), out.cue("fireworks ×3", { beat: { env: "fireworks:3" } }), out.cue("fireworks ×6", { beat: { env: "fireworks:6" } }),
  ));

  host.append($("h2", "", "Steam, breath and rain behind the window"), $("p", "note", "Inside, rain falls only beyond the back wall (through the window and the door). The çaydanlık steams (a prop's emitter). In a cold state every actor's breath shows every few seconds; do: breath puts one on a beat."));
  const room = bench(host, ctx, { places: [BENCH_ROOM], cast: { a: me }, cues: [{ scene: { place: "bench_room", time: "dusk", at: { a: "mid" } } }] });
  host.append(bar("try",
    room.cue("cold", { beat: { env: "state:cold" } }), room.cue("warm", { beat: { env: "state:-cold" } }),
    room.cue("breathe", { beat: { who: "a", do: "breath" } }), room.cue("rain outside", { beat: { env: "weather:rain" } }), room.cue("clear", { beat: { env: "weather:clear" } }),
  ));

  host.append($("h2", "", "Flames, and what a hand carries"), $("p", "note", "A candle's flame is particles on its wick: tongues that rise and narrow, a core and a halo, self-lit. A cake with many candles keeps drawn flames. In a hand a prop keeps its fire and steam where it is on the prop: the cake carried in lit (s1e30), the candles, a hot glass of tea."));
  const party = bench(host, ctx, { places: [BENCH_PARTY], cast: { a: me }, cues: [{ scene: { place: BENCH_PARTY.id, time: "night", at: { a: "here" } } }] });
  host.append(
    bar("try", party.cue("night", { beat: { env: "time:night" } }), party.cue("lights off", { beat: { env: "lights_off" } }), party.cue("lights on", { beat: { env: "lights_on" } })),
    bar("carry", party.cue("the cake", { beat: { who: "a", obj: [{ id: "pasta", op: "take" }], cam: "wide" } }), party.cue("the candles", { beat: { who: "a", obj: [{ id: "mum", op: "take" }], cam: "wide" } }),
      party.cue("a glass of tea", { beat: { who: "a", obj: [{ id: "cay", op: "take", n: 1 }], cam: "wide" } }), party.cue("closer", { beat: { who: "a", cam: "close" } })),
  );
}
