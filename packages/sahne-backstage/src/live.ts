// The kit page's hover previews: a gesture or an emotion played, over and over, on the card under the pointer. One stage
// for them all, mounted the first time and laid over the card's picture (fixed, under no pointer), shown while the
// pointer rests there and hidden when it leaves or the page scrolls. With reduced motion, the pictures stay still.

import { mountStage, type Run, type Stage } from "sahne";
import { KIT, LANG } from "./stage.ts";
import { loadScene, type Scene } from "./thumbs.ts";

let stage: Stage | null = null, host: HTMLElement | null = null, run: Run | null = null;
let token = 0, timer: ReturnType<typeof setTimeout> | undefined;

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Play `scene` over `el` (a card's picture) once the pointer has rested there a moment. */
export function liveOn(el: HTMLElement, scene: () => Scene & { play: { cue: number } }) {
  if (still()) return;
  const t = ++token;
  clearTimeout(timer);
  timer = setTimeout(() => { if (t === token) start(t, el, scene()); }, 140);
}

/** Stop and hide the preview. */
export function liveOff() {
  token++;
  clearTimeout(timer);
  run?.pause(); run = null;
  if (host) host.style.visibility = "hidden";
}

function start(t: number, el: HTMLElement, s: Scene & { play: { cue: number } }) {
  if (!host) {
    host = Object.assign(document.createElement("div"), { ariaHidden: "true", className: "live-preview" });
    document.body.append(host);
    addEventListener("scroll", liveOff, { capture: true, passive: true });
  }
  const r = el.getBoundingClientRect();
  Object.assign(host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, visibility: "visible" });
  stage ??= mountStage(host, { kit: KIT, lang: LANG, bubbles: false, motion: "full", maxDpr: 2 });
  stage.resize();
  loadScene(stage, s);
  const loop = () => {
    if (t !== token || !stage) return;
    stage.show(Math.max(0, s.play.cue - 1));
    run = stage.play(s.play.cue);
    void run.done.then(() => setTimeout(loop, 500));
  };
  loop();
}
