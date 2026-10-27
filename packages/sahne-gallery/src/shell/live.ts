// A script played on a stage of its own: the home page's film and the docs' `sahne` blocks. The script
// plays with the gallery's documents: every test place (src/bench.ts), the content root's places, the
// bakkal's two people, Nima and İsmail, Kerim (the kit's bird puppet), Pisi the cat and a gull, and
// any places of the page's own (`places`). It plays once (or `loop`s,
// from the opening again), and a button plays it again; `onCue` hears each cue as it starts,
// `preroll` holds the opening that long before it plays, and `start` begins the first run at a scene cue.

import type { AvatarDoc, Cue, PlaceDoc, Run, Script, Stage } from "sahne";
import { $, button, frame } from "./dom.ts";
import type { Ctx } from "./ctx.ts";
import { BENCH_DOCS } from "../places/common.ts";
import { ISMAIL, NIMA } from "../bakkal.ts";

export interface Live { stage: Stage; box: HTMLElement; play(): void }

export async function live(host: HTMLElement, ctx: Ctx, script: Script, o: { loop?: boolean; controls?: boolean; onCue?: (i: number, cue: Cue) => void; preroll?: number; places?: PlaceDoc[]; cast?: Record<string, AvatarDoc>; names?: Record<string, string>; start?: number } = {}): Promise<Live> {
  const box = frame("16 / 9");
  host.append(box);
  const docs = [...BENCH_DOCS, ...o.places ?? [], ...await ctx.data("places").catch(() => [])];
  const stage = ctx.mount(box);
  let token = 0, run: Run | null = null;
  ctx.cleanup(() => { token++; });
  const play = async () => {
    const mine = ++token;
    run?.finish();
    stage.load(script, { cast: { nima: NIMA, ismail: ISMAIL, kerim: { puppet: "bird" }, pisi: { puppet: "cat" }, gull: { puppet: "gull" }, ...o.cast }, places: Object.fromEntries(docs.map(d => [d.id, d])), names: { nima: "Nima", ismail: "İsmail", kerim: "Kerim", pisi: "Pisi", gull: "the gull", ...o.names } });
    // the first time from `start` (a scene cue), then always from the opening
    let from = o.start ?? 0;
    stage.show(from);
    o.onCue?.(from, script.cues[from]);
    do {
      if (o.preroll) { await new Promise(r => setTimeout(r, o.preroll)); if (mine !== token) return; }
      for (let i = from + 1; i < script.cues.length; i++) {
        o.onCue?.(i, script.cues[i]);
        run = stage.play(i);
        await run.done;
        if (mine !== token) return;
      }
      if (!o.loop) return;
      await new Promise(r => setTimeout(r, 2500));
      if (mine !== token) return;
      from = 0;
      stage.show(0);
      o.onCue?.(0, script.cues[0]);
    } while (o.loop);
  };
  if (o.controls !== false) {
    const bar = $("div", "bar");
    bar.append(button("▶ Play again", () => void play()));
    host.append(bar);
  }
  void play();
  return { stage, box, play: () => void play() };
}
