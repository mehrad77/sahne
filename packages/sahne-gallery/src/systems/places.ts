// Places, sites and states (DESIGN.md §5.1, §5.5, §6.9): a test room with states (a group of two
// layouts, a toggle for the pictures, cut or faded), the street of the same site (the loaf she holds
// comes along, no new music) against a street of another site (the motif plays), the wide band raised
// for height, and a vehicle's clock: the M11 car as a running place, Kerim flying along outside,
// beside the same car without `life: "run"` and pace marks, which stops when idle.

import type { Cue, PlaceDoc, Run, Stage } from "sahne";
import { $, bar, button, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { bench, BENCH_ROOM, BENCH_STREET } from "./bench.ts";
// a bundled JSON import needs a literal path: the sample in sahne-story/samples/places/
import metroJson from "../../../sahne-story/samples/places/metro_m11.json" with { type: "json" };

/** A street like the test street, but a site of its own: leaving the room for it is a move between sites. */
const OTHER: PlaceDoc = { ...BENCH_STREET, id: "bench_other", site: undefined, name: { tr: "Başka sokak", en: "Another street" } };

export function build(host: HTMLElement, ctx: Ctx) {
  const me = ctx.kit.defaultDoc;

  // ---- states, sites, the wide band ----
  host.append($("h2", "", "States and sites"), $("p", "note",
    "The test room has states: shop and waiting are one group (one at a time), pictures is a toggle. A piece, mark or prop with in: [states] shows only in them: the bread goes with the shop, the benches come with the waiting room. env state:<s> is a cut; with :fade, a 0.4 s fade. " +
    "The test street is another place of the same site (site: bench): she takes the loaves, goes out, and still holds them though they are not kept props, and no motif plays. Another street, a site of its own, plays its motif. Back in the room, it is as she left it; a scene's state picks the layout on the way in."));
  let raised = false, fade = true;
  const room = (): PlaceDoc => raised ? { ...BENCH_ROOM, camera: { wide: { ...BENCH_ROOM.camera!.wide!, y1: 4 } } } : BENCH_ROOM;
  const start: Cue[] = [{ scene: { place: "bench_room", at: { a: "mid" } } }];
  const TAKE: Cue = { beat: { who: "a", obj: [{ id: "ekmek", op: "take" }] } }, STREET: Cue = { scene: { place: "bench_street", at: { a: "mid" } } };
  const AWAY: Cue = { scene: { place: "bench_other", at: { a: "mid" } } }, BACK: Cue = { scene: { place: "bench_room", at: { a: "mid" } } };
  const WAITING: Cue = { scene: { place: "bench_room", state: ["waiting"], at: { a: "mid" } } };
  // Stage.act plays a cue from the world as it is, but only into places and prop looks the loaded script reaches: the buttons' cues go in as `extra`
  const extra = [{ at: 1, cues: [TAKE, STREET, BACK] }, { at: 1, cues: [TAKE, AWAY, WAITING] }];
  const site = bench(host, ctx, { places: [BENCH_ROOM, BENCH_STREET, OTHER], cast: { a: me }, cues: start, load: { extra } });
  const log = $("p", "note");
  const say = () => {
    const w = site.stage.world(), held = Object.values(w.actors.a?.hold ?? {}).map(id => `${id} (${w.props[id]?.n ?? 1})`);
    const music = site.stage.perf?.sounds.filter(s => s.music).map(s => s.id).join(", ");
    log.textContent = `place ${w.place} · states ${(w.state ?? []).join(", ") || "its defaults"} · she holds ${held.join(", ") || "nothing"} · music on this cue: ${music || "none"}`;
  };
  const cue = (label: string, c: Cue | (() => Cue)) => button(label, () => { site.play(typeof c === "function" ? c() : c).done.then(say); });
  const st = (s: string) => () => ({ beat: { env: `state:${s}${fade ? ":fade" : ""}` } });
  const reload = () => { site.stage.load({ v: 1, cues: start }, { cast: { a: me }, places: { bench_room: room(), bench_street: BENCH_STREET, bench_other: OTHER }, extra }); site.stage.show(0); say(); };
  host.append(
    log,
    bar("states", cue("shop", st("shop")), cue("waiting", st("waiting")), cue("pictures off", st("-pictures")), cue("pictures on", st("pictures")), toggle(":fade", fade, on => { fade = on; }, "a 0.4 s fade instead of a cut")),
    bar("site", cue("take the loaves", TAKE), cue("to the street (same site)", STREET), cue("to another street (another site)", AWAY),
      cue("back to the room", BACK), cue("back as the waiting room", WAITING),
      button("start again", reload)),
    $("p", "note", "The wide band: the wide shot fits camera.wide's width at its depth, and its height from y0 to y1 (default 0.15 to 2.45 m, people standing). A stairwell or a roof with a water tank raises y1; here to 4 m, so the frame pulls back to show the whole wall."),
    bar("wide band", toggle("raise y1 to 4 m", false, on => { raised = on; reload(); })),
  );
  setTimeout(say, 300);

  // ---- a vehicle's clock ----
  host.append($("h2", "", "A vehicle's clock, and Kerim keeping pace"), $("p", "note",
    "A place's own clock moves its flats (§6.9). It runs while a cue plays and with idle life, which stops after a while without input (here 8 s rather than 20, to see it sooner); then the view outside freezes. " +
    "The M11 car on the right is a running place (life: \"run\"): its clock goes on for as long as it is on stage, at 30 frames a second, and Kerim's air marks outside are pace marks, so she flies along, wings beating, drifting about her spot. " +
    "On the left the same car without either: leave the page alone and it stops, and Kerim only hovers. The top bar's Still holds both where they start."));
  const after = metroJson as unknown as PlaceDoc;
  const before: PlaceDoc = { ...after, id: "metro_still", life: undefined, marks: Object.fromEntries(Object.entries(after.marks).map(([k, m]) => [k, { ...m, pace: undefined }])) };
  const pair = $("div");
  pair.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px";
  host.append(pair);
  const cars: { stage: Stage; n: HTMLElement; play(c: Cue): Run }[] = [];
  for (const [label, doc] of [["no life: run, no pace marks", before], ["life: run, pace marks", after]] as const) {
    const fig = $("figure");
    fig.style.margin = "0";
    pair.append(fig);
    const b = bench(fig, ctx, { places: [doc], cast: { kerim: { puppet: "bird" } }, cues: [{ scene: { place: doc.id, at: { kerim: "outside" } } }], stage: { idleTimeout: 8000 } });
    const n = $("figcaption", "", label);
    fig.append(n);
    cars.push({ stage: b.stage, n, play: b.play });
  }
  const t0 = performance.now();
  const iv = setInterval(() => cars.forEach(c => {
    const life = (c.stage as unknown as { lifeT: number }).lifeT;
    c.n.textContent = `${c.n.textContent!.split(" · ")[0]} · ${((performance.now() - t0) / 1000).toFixed(0)} s on the page · the place's clock at ${(life / 1000).toFixed(1)} s`;
  }), 500);
  ctx.cleanup(() => clearInterval(iv));
  host.append(bar("both",
    button("Kerim to the far window", () => cars.forEach(c => c.play({ beat: { move: { who: "kerim", to: "outside_far", how: "fly" } } }))),
    button("back to the near window", () => cars.forEach(c => c.play({ beat: { move: { who: "kerim", to: "outside", how: "fly" } } }))),
  ));

  // ---- a vehicle that stops, held by the story ----
  host.append($("h2", "", "A train that stops, and a story that stops it"), $("p", "note",
    "The M11 car keeps a timetable (its place's stops, §6.9): on its own it runs from station to station, easing into each; the doors slide open, one passenger gets off and another gets on, the doors shut and it pulls away, while the display reads \"Gelecek istasyon: …\" on the leg and the station's name at the stop. " +
    "A story can take hold of it: env stop:<station> brings it in to that station (from where it is if it is already on its way there, else on the whole leg to it) and holds it there with the doors open; env depart shuts the doors and goes on. A scene can open standing at a station (scene.stop). Only the flats on the stops clock wait; the straps, the train alongside and Kerim keep the place's own clock."));
  const stops = (after.stops?.stations ?? []).slice(1);
  const train = bench(host, ctx, { places: [after], cast: { kerim: { puppet: "bird" } }, cues: [{ scene: { place: after.id, at: { kerim: "outside" } } }] });
  host.append(
    bar("stop at", ...stops.map(st => train.cue(st, { beat: { env: `stop:${st}` } }))),
    bar("then", train.cue("depart", { beat: { env: "depart" } }), train.cue("open at Hasdal (scene.stop)", { scene: { place: after.id, at: { kerim: "outside" }, stop: "Hasdal" } }), train.cue("let it run", { scene: { place: after.id, at: { kerim: "outside" } } })),
  );
}
