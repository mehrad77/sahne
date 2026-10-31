import {
  $,
  button,
  frame
} from "./chunk-4TGKXDN4.js";
import {
  interact,
  propText
} from "./chunk-BLASJ6YA.js";

// src/systems/bench.ts
function bench(host, ctx, o) {
  const box = frame(o.ratio ?? "16 / 9");
  host.append(box);
  const stage = ctx.mount(box, o.stage);
  if (o.text !== false) propText(stage);
  const ix = o.interact ? interact(stage, { explore: false }) : void 0;
  const panel = $("pre", "log cue");
  panel.textContent = "Each button plays a cue; the cue shows here, as a script would write it.";
  host.append(panel);
  const places = Object.fromEntries(o.places.map((p) => [p.id, p]));
  const load = (cues, show) => {
    stage.load({ v: 1, cues }, { cast: o.cast ?? {}, places, ...o.load });
    stage.show(show ?? cues.length - 1);
  };
  load(o.cues, o.show);
  const play = (cue) => {
    panel.textContent = JSON.stringify(cue, null, 1).replace(/\n\s*/g, " ");
    return stage.act(cue);
  };
  return {
    stage,
    box,
    ix,
    load,
    play,
    cue: (label, c, title) => button(label, () => play(typeof c === "function" ? c() : c), void 0, title),
    note: (text) => {
      panel.textContent = text;
    }
  };
}

export {
  bench
};
//# sourceMappingURL=chunk-ZRNRQOB7.js.map
