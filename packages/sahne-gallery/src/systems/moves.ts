// Moves (DESIGN.md §5.4, §5.5 marks, §7): a person walks, runs, hops, exits and enters through a door
// that swings; Kerim flies in from outside the frame to the perch, onto the counter, hops along it,
// hovers at an air mark and flies along at a pace mark; stairs climbed a riser at a time (follow cam,
// slow tempo); seated passengers in the taxi's back seat: a seat mark seats whoever is there until they move; and a
// walk round a railing (solid lines), through its gate only on an entrance or an exit.

import type { CamKind, Cue, MoveHow, PlaceDoc } from "sahne";
import { $, bar, choice } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { bench, BENCH_ROOM, BENCH_STAIRS, BENCH_TAXI_BACK } from "./bench.ts";

/** The test room with marks to walk between, and Kerim's: the counter's top, a spot in the air, a pace spot. */
const ROOM: PlaceDoc = {
  ...BENCH_ROOM, id: "moves_room",
  marks: {
    ...BENCH_ROOM.marks, left: { x: -2.2, z: 0.1, facing: "r" }, right: { x: 2.6, z: 0.1, facing: "l" },
    c1: { x: -0.35, y: 0.87, z: -0.3 }, c2: { x: 1.4, y: 0.87, z: -0.3 },
    air: { x: -1.6, y: 1.9, z: -0.6, air: true }, pace: { x: 1.2, y: 1.8, z: -0.5, air: true, pace: true },
  },
};

/** A yard behind a campus railing whose gate is a door mark's leaf: a walk goes round the railing, an exit or an entrance through the gate. */
const YARD: PlaceDoc = {
  v: 1, id: "moves_yard", size: { w: 9, d: 4 }, camera: { wide: { x: 0, w: 9.4, z: -1.6 } },
  pieces: [
    { kit: "street", variant: "far", x: 0, z: -9, w: 2400 },
    { kit: "floor", x: 0, z: -1.5, w: 1400, d: 700, tile: 60, a: "#C9C2B6", b: "#BDB5A8" },
    { kit: "park_edge", variant: "campus", id: "gate", x: 0, z: -1.3, w: 600 },
  ],
  marks: {
    street: { x: -1.6, z: 0.3, facing: "r" }, yard: { x: -1.6, z: -2.5 }, far: { x: 2, z: -2.6 },
    gate: { x: 0, z: -0.8, door: "gate", out: { x: 0, z: -3.2 } },
  },
};

export function build(host: HTMLElement, ctx: Ctx) {
  const me = ctx.kit.defaultDoc;
  const mv = (who: string, to: string, how?: MoveHow): Cue => ({ beat: { move: { who, to, ...(how ? { how } : {}) } } });

  // ---- a person and a bird ----
  host.append($("h2", "", "Walk, run, hop, exit, enter, fly"), $("p", "note",
    "move: {who, to, how} takes an actor to a mark. walk is 1.1 m/s or so, run faster; hop: a person hops, both feet off the floor each step and the knees giving on landing, slower and in shorter steps; Kerim hops along the counter; a hop never takes stairs (a change of height in one go). " +
    "exit leaves through the door of the place's door mark (it swings open, then shuts behind) and ends at its out side, off stage; enter comes in from out through the door. " +
    "fly is a bird's: about 2.6 m/s along an arc, a wingbeat each 0.92 s, no footsteps; from off stage she comes in from outside the frame. On the perch (the place's perch, the ledge) she sits; at an air mark she keeps flying, hovering; at a pace mark (air plus pace) she flies along, drifting about the spot, as beside a train."));
  const room = bench(host, ctx, { places: [ROOM], cast: { a: me, kerim: { puppet: "bird" } }, cues: [{ scene: { place: ROOM.id, at: { a: "mid" } } }] });
  host.append(
    bar("person", room.cue("walk left", mv("a", "left")), room.cue("walk right", mv("a", "right")), room.cue("run left", mv("a", "left", "run")), room.cue("run right", mv("a", "right", "run")),
      room.cue("hop to the middle", mv("a", "mid", "hop")), room.cue("exit", mv("a", "door", "exit")), room.cue("enter", mv("a", "mid", "enter"))),
    bar("Kerim", room.cue("fly in to the perch", mv("kerim", "ledge", "fly")), room.cue("onto the counter", mv("kerim", "c1", "fly")),
      room.cue("hop along it", mv("kerim", "c2", "hop")), room.cue("hop back", mv("kerim", "c1", "hop")),
      room.cue("into the air (hover)", mv("kerim", "air", "fly")), room.cue("to the pace mark (fly along)", mv("kerim", "pace", "fly"))),
    bar("", room.cue("both at once", { beat: { move: [{ who: "a", to: "right", how: "run" }, { who: "kerim", to: "ledge", how: "fly" }] } }), room.cue("start again", () => { room.load([{ scene: { place: ROOM.id, at: { a: "mid" } } }]); return { beat: { wait: 1 } }; })),
  );

  // ---- round, not through ----
  host.append($("h2", "", "Round a railing, through its gate"), $("p", "note",
    "Walls, railings, a building's front, counters and glass partitions are solid lines on the floor (each generator's solid, DESIGN.md §7). A walk that would cross one goes round it, on the shortest way that keeps 25 cm clear, through a gap or round the line's end; the stage, the story lint and the place lint use the same router, so a writer is warned of each detour. " +
    "A gate or a door is solid too, except to an entrance or an exit through the door mark that names it: then it swings open on the way and shuts behind. Here the walk to the yard goes round the railing's end; exit leaves through the gate."));
  const yard = bench(host, ctx, { places: [YARD], cast: { a: me }, cues: [{ scene: { place: YARD.id, at: { a: "street" } } }] });
  host.append(
    bar("walk", yard.cue("into the yard (round)", mv("a", "yard")), yard.cue("across the yard", mv("a", "far")), yard.cue("back to the street (round)", mv("a", "street")), yard.cue("to the gate", mv("a", "gate"))),
    bar("door", yard.cue("exit through the gate", mv("a", "gate", "exit")), yard.cue("enter through the gate", mv("a", "street", "enter")),
      yard.cue("start again", () => { yard.load([{ scene: { place: YARD.id, at: { a: "street" } } }]); return { beat: { wait: 1 } }; })),
  );

  // ---- stairs ----
  host.append($("h2", "", "Stairs"), $("p", "note",
    "The kit's stairwell: two flights of 8 risers of 18 cm, with landings. A walking leg that rises or falls more than 10 cm is a stair (move's via lists the landings): she climbs a riser at a time, the body rising early in each step and the foot planted on the tread, the knee higher going up, leaning into the climb; a climb takes longer than the flat. " +
    "cam: follow keeps her in frame; the wide shot shows the whole stairwell, since the place raises its wide band to 5.3 m. tempo: 0.33 plays at a third of the speed, to check the feet."));
  const SCENE: Cue = { scene: { place: "bench_stairs", at: { a: "hall" } } };
  let cam: CamKind = "wide", tempo = 1;
  const UP = (): Cue => ({ beat: { move: { who: "a", to: "landing2", via: ["foot", "top1", "foot2", "top2"] }, cam, tempo } });
  const DOWN = (): Cue => ({ beat: { move: { who: "a", to: "hall", via: ["top2", "foot2", "top1", "foot"] }, cam, tempo } });
  const stairs = bench(host, ctx, { places: [BENCH_STAIRS], cast: { a: me }, cues: [SCENE] });
  host.append(
    bar("climb", stairs.cue("up", () => { stairs.load([SCENE]); return UP(); }), stairs.cue("down", () => { stairs.load([SCENE, UP()]); return DOWN(); })),
    choice("cam", ["wide", "follow"] as const, "wide", o => { cam = o; }),
    choice("tempo", ["1", "0.33"], "1", o => { tempo = +o; }),
  );

  // ---- seated passengers ----
  host.append($("h2", "", "Seated passengers"), $("p", "note",
    "The taxi turned round (cabin taxi_back, a running place): two passengers on the rear bench, the road going away behind them. Its marks are what the taxi's brief asks (needs.json): the driver and the front passenger with their backs to us (a mark's facing: back; talking, they turn over the shoulder), the rear bench, and Kerim flying along outside the window (an air mark with pace). The seats are seat marks (the seat's height, here 0.55 m): whoever a scene puts there, or who walks there, sits, the hips on the cushion and the thighs towards you, and stays seated through every line until they move. Moving gets them up first (SIT_MS), then they go, and sit again on a seat mark."));
  const taxi = bench(host, ctx, { places: [BENCH_TAXI_BACK], cast: { a: me, b: me, driver: me, front: me, kerim: { puppet: "bird" } },
    cues: [{ scene: { place: "bench_taxi_back", at: { a: "back_l", b: "back_r", driver: "driver", front: "front", kerim: "outside" } } }] });
  host.append(bar("try",
    taxi.cue("the driver asks over his shoulder", { line: { who: "driver", text: "Nereye?", to: "a" } }),
    taxi.cue("she answers (all stay seated)", { line: { who: "a", text: "Feriköy'e, lütfen.", to: "driver", do: "nod" } }),
    taxi.cue("she slides to the middle", { beat: { move: { who: "a", to: "back_m" }, cam: "wide" } }),
    taxi.cue("and back", { beat: { move: { who: "a", to: "back_l" }, cam: "wide" } }),
    taxi.cue("wide", { beat: { cam: "wide" } }),
  ));
}
