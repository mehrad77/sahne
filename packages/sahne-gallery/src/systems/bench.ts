// What every system demo stands on: a stage loaded with a small test place and cast, and a way to play a
// cue on it that also shows the cue, as the script would write it. A demo's buttons are cues, so the
// demos double as a guide to the script (DESIGN.md §5.6).

import { interact, propText, type AvatarDoc, type Cue, type Interaction, type LoadOptions, type PlaceDoc, type PuppetRef, type Run, type Stage, type StageOptions } from "sahne";
import { $, button, frame } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";

export interface BenchOptions {
  places: PlaceDoc[];
  cast?: Record<string, AvatarDoc | PuppetRef>;
  /** The script to load; `show` (default: the last) is the cue shown at the start. */
  cues: Cue[];
  show?: number;
  load?: Partial<LoadOptions>;
  stage?: Partial<StageOptions>;
  ratio?: string;
  /** Attach the interaction layer (before load, as it must be). */
  interact?: boolean;
  /** Lay out the pieces' and props' words (propText). Default on. */
  text?: boolean;
}

export interface Bench {
  stage: Stage;
  box: HTMLElement;
  ix?: Interaction;
  /** Loads a script again (a new cast or place), showing cue `show` (default the last). */
  load(cues: Cue[], show?: number): void;
  /** Plays a cue now from the world as it is (Stage.act), and shows it in the cue panel. */
  play(cue: Cue): Run;
  /** A button that plays a cue. */
  cue(label: string, cue: Cue | (() => Cue), title?: string): HTMLButtonElement;
  /** Shows a cue (or a note) in the panel without playing it. */
  note(text: string): void;
}

export function bench(host: HTMLElement, ctx: Ctx, o: BenchOptions): Bench {
  const box = frame(o.ratio ?? "16 / 9");
  host.append(box);
  const stage = ctx.mount(box, o.stage);
  if (o.text !== false) propText(stage);
  const ix = o.interact ? interact(stage, { explore: false }) : undefined;
  const panel = $("pre", "log cue");
  panel.textContent = "Each button plays a cue; the cue shows here, as a script would write it.";
  host.append(panel);
  const places = Object.fromEntries(o.places.map(p => [p.id, p]));
  const load = (cues: Cue[], show?: number) => {
    stage.load({ v: 1, cues }, { cast: o.cast ?? {}, places, ...o.load });
    stage.show(show ?? cues.length - 1);
  };
  load(o.cues, o.show);
  const play = (cue: Cue) => { panel.textContent = JSON.stringify(cue, null, 1).replace(/\n\s*/g, " "); return stage.act(cue); };
  return {
    stage, box, ix, load, play,
    cue: (label, c, title) => button(label, () => play(typeof c === "function" ? c() : c), undefined, title),
    note: text => { panel.textContent = text; },
  };
}

/** A small room, a street and a stair for the demos (most demos use the test places of src/bench.ts). */
export { BENCH_ROOM, BENCH_STREET, BENCH_STAIRS, BENCH_CROWD, BENCH_ROOF, BENCH_SHORE, BENCH_FERIKOY, BENCH_FLAT, BENCH_PARTY, BENCH_CLASS, BENCH_TAXI, BENCH_TAXI_BACK } from "../bench.ts";
