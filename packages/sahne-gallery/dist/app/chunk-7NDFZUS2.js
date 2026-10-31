import {
  BENCH_DOCS
} from "./chunk-WB6XEHS3.js";
import {
  ISMAIL,
  NIMA
} from "./chunk-VFMRH5SO.js";
import {
  $,
  button,
  frame
} from "./chunk-4TGKXDN4.js";

// src/shell/live.ts
async function live(host, ctx, script, o = {}) {
  const box = frame("16 / 9");
  host.append(box);
  const docs = [...BENCH_DOCS, ...o.places ?? [], ...await ctx.data("places").catch(() => [])];
  const stage = ctx.mount(box);
  let token = 0, run = null;
  ctx.cleanup(() => {
    token++;
  });
  const play = async () => {
    const mine = ++token;
    run?.finish();
    stage.load(script, { cast: { nima: NIMA, ismail: ISMAIL, kerim: { puppet: "bird" }, pisi: { puppet: "cat" }, gull: { puppet: "gull" }, ...o.cast }, places: Object.fromEntries(docs.map((d) => [d.id, d])), names: { nima: "Nima", ismail: "\u0130smail", kerim: "Kerim", pisi: "Pisi", gull: "the gull", ...o.names } });
    let from = o.start ?? 0;
    stage.show(from);
    o.onCue?.(from, script.cues[from]);
    do {
      if (o.preroll) {
        await new Promise((r) => setTimeout(r, o.preroll));
        if (mine !== token) return;
      }
      for (let i = from + 1; i < script.cues.length; i++) {
        o.onCue?.(i, script.cues[i]);
        run = stage.play(i);
        await run.done;
        if (mine !== token) return;
      }
      if (!o.loop) return;
      await new Promise((r) => setTimeout(r, 2500));
      if (mine !== token) return;
      from = 0;
      stage.show(0);
      o.onCue?.(0, script.cues[0]);
    } while (o.loop);
  };
  if (o.controls !== false) {
    const bar = $("div", "bar");
    bar.append(button("\u25B6 Play again", () => void play()));
    host.append(bar);
  }
  void play();
  return { stage, box, play: () => void play() };
}

export {
  live
};
//# sourceMappingURL=chunk-7NDFZUS2.js.map
