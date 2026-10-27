// A script played on a stage of its own: the home page's hero and the docs' `sahne` blocks. The script
// plays with the gallery's documents: every test place (src/bench.ts), the content root's places and
// the bakkal's two people, Nima and İsmail. It plays once (or `loop`s, from the opening again), and a
// button plays it again.

import type { Run, Script, Stage } from "sahne";
import { $, button, frame } from "./dom.ts";
import type { Ctx } from "./ctx.ts";
import { BENCH_DOCS } from "../places/common.ts";
import { ISMAIL, NIMA } from "../bakkal.ts";

export interface Live { stage: Stage; box: HTMLElement; play(): void }

export async function live(host: HTMLElement, ctx: Ctx, script: Script, o: { loop?: boolean; controls?: boolean } = {}): Promise<Live> {
  const box = frame("16 / 9");
  host.append(box);
  const docs = [...BENCH_DOCS, ...await ctx.data("places").catch(() => [])];
  const stage = ctx.mount(box);
  let token = 0, run: Run | null = null;
  ctx.cleanup(() => { token++; });
  const play = async () => {
    const mine = ++token;
    run?.finish();
    stage.load(script, { cast: { nima: NIMA, ismail: ISMAIL }, places: Object.fromEntries(docs.map(d => [d.id, d])), names: { nima: "Nima", ismail: "İsmail" } });
    stage.show(0);
    do {
      for (let i = 1; i < script.cues.length; i++) {
        run = stage.play(i);
        await run.done;
        if (mine !== token) return;
      }
      if (!o.loop) return;
      await new Promise(r => setTimeout(r, 2500));
      if (mine !== token) return;
      stage.show(0);
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
