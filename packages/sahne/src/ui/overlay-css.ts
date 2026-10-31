// The overlay's stylesheet, injected once per document by Overlay (overlay.ts). Every class is
// prefixed `sahne-`. Sizes that follow the stage's width (--sahne-fs, --sahne-maxw, --sahne-maxn,
// --sahne-inset, --sahne-tailw) are written on the root by the overlay when the host resizes.
//
// The stage is a lit world, so the overlay keeps its paper colours in the dark theme too. The
// font family is inherited from the host (the app's font); sound words use a rounded face that
// `--sahne-sound-font` can replace.

export const OVERLAY_CSS = `
.sahne-ov {
  --sahne-paper: #FFFCF5;
  --sahne-ink: #2B2420;
  --sahne-mute: #74675D;
  --sahne-edge: rgba(112, 90, 72, .62);
  --sahne-sound: #E0622C;
  --sahne-sky: radial-gradient(circle at 36% 30%, #EAF5F2 0%, #C5E2E1 52%, #A5CDCF 100%);
  position: absolute; inset: 0; overflow: hidden; contain: strict; pointer-events: none;
  color: var(--sahne-ink); color-scheme: light;
  font-size: var(--sahne-fs, 16px); line-height: 1.3; font-weight: 400; letter-spacing: 0;
  text-align: left; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent;
}
.sahne-ov > * { position: absolute; left: 0; top: 0; will-change: transform; }
.sahne-ov > div { pointer-events: auto; }
.sahne-ov > [hidden] { display: none; }
.sahne-ov > .sahne-wait, .sahne-ov > .sahne-off { visibility: hidden; }
.sahne-ov > .sahne-wait, .sahne-ov > .sahne-wait * { animation: none !important; }
.sahne-ov > .sahne-out { pointer-events: none; }
/* layers: the window, every tail, sound words, speech, the narrator */
.sahne-ov > .sahne-inset { z-index: 0; }
.sahne-ov > .sahne-tail { z-index: 1; }
.sahne-ov > .sahne-snd { z-index: 2; }
.sahne-ov > .sahne-b { z-index: 3; }
.sahne-ov > .sahne-b.sahne-narr { z-index: 4; }
.sahne-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* speech and narrator bubbles: a warm paper card, a soft shadow cast down-right (the light is
   upper left), no outline; the tail sits behind the card and points at the anchor */
.sahne-b-in {
  position: relative;
  filter: drop-shadow(.5px 1px 0 rgba(96, 66, 40, .10)) drop-shadow(1.5px 4px 6px rgba(72, 48, 26, .17));
  animation: sahne-pop 160ms cubic-bezier(.3, .9, .4, 1.25) backwards;
}
.sahne-b-body {
  position: relative; box-sizing: border-box; width: max-content; max-width: var(--sahne-maxw, 300px);
  padding: .42em .78em .48em; border-radius: 1.1em;
  background: linear-gradient(170deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 60%), var(--sahne-paper);
  box-shadow: inset 0 -1px 0 rgba(150, 112, 80, .08);
  text-align: center; text-wrap: balance; overflow-wrap: break-word; white-space: normal;
}
/* a speaker heard on a phone: the name, with a phone mark, above the line */
.sahne-b-who { display: block; font-size: .78em; font-weight: 600; opacity: .72; line-height: 1.2; margin-bottom: .1em; }
.sahne-b-who::before { content: "\\1F4DE\\FE0E\\00A0" / ""; }
.sahne-tail {
  width: var(--sahne-tailw, 20px); height: 20px; overflow: visible; pointer-events: none;
  transform-origin: 50% 0; transform: scale(0);
  filter: drop-shadow(0 1px 1.2px rgba(72, 48, 26, .16));
  animation: sahne-in 160ms ease-out backwards;
}
.sahne-tail .sahne-t-fill { fill: var(--sahne-paper); }
.sahne-tail .sahne-t-edge { fill: none; stroke: none; }

/* the narrator: a warmer cream, beside the round window */
.sahne-narr { --sahne-paper: #FFF4DA; }
.sahne-narr .sahne-b-body { max-width: var(--sahne-maxn, 260px); }

/* a line with no words: only "…" */
.sahne-v-silent .sahne-b-body {
  padding: .02em .62em .3em; font-size: 1.25em; line-height: 1; letter-spacing: .1em;
  color: var(--sahne-mute); font-weight: 600;
}

/* whispered and mouthed lines: quieter, with a broken edge */
.sahne-v-whisper .sahne-b-body, .sahne-v-mouthing .sahne-b-body {
  font-size: .9em; color: var(--sahne-mute); border: 1.5px dashed var(--sahne-edge);
  background: var(--sahne-paper); box-shadow: none;
}
.sahne-v-mouthing .sahne-b-body { border-style: dotted; border-width: 2px; font-style: italic; }
.sahne-v-whisper > .sahne-b-in, .sahne-v-mouthing > .sahne-b-in { filter: drop-shadow(1px 2.5px 3px rgba(72, 48, 26, .10)); }
.sahne-v-whisper .sahne-t-edge, .sahne-v-mouthing .sahne-t-edge {
  stroke: var(--sahne-edge); stroke-width: 1.5px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke;
}
.sahne-v-mouthing .sahne-t-edge { stroke-width: 2px; stroke-dasharray: .1 4; stroke-linecap: round; }

/* sound words: bold rounded letters cut from warm paper, tilted, no box */
.sahne-snd-in {
  display: block; white-space: nowrap; padding: .1em .15em;
  font: 800 var(--sahne-snd-fs, 20px)/1 var(--sahne-sound-font, ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Varela Round", "Nunito", system-ui, sans-serif);
  letter-spacing: .02em; word-spacing: .14em; color: var(--sahne-sound);
  transform: rotate(var(--sahne-rot, -6deg));
  text-shadow:
    2px 0 0 var(--sahne-paper), -2px 0 0 var(--sahne-paper), 0 2px 0 var(--sahne-paper), 0 -2px 0 var(--sahne-paper),
    1.5px 1.5px 0 var(--sahne-paper), -1.5px 1.5px 0 var(--sahne-paper), 1.5px -1.5px 0 var(--sahne-paper), -1.5px -1.5px 0 var(--sahne-paper),
    2px 3.5px 3px rgba(72, 48, 26, .28);
  animation: sahne-stamp 200ms cubic-bezier(.3, 1.3, .5, 1) backwards;
}

/* the narrator's round window, cut in the paper: a paper rim, a shadow inside under its top edge */
.sahne-inset-in {
  position: relative; width: var(--sahne-inset, 80px); height: var(--sahne-inset, 80px);
  border-radius: 50%; overflow: hidden; background: var(--sahne-sky);
  box-shadow: 0 0 0 4px var(--sahne-paper), .5px 1.5px 0 4px rgba(96, 66, 40, .12), 1.5px 5px 9px 3px rgba(72, 48, 26, .2);
  animation: sahne-pop 200ms cubic-bezier(.3, .9, .4, 1.2) backwards;
}
.sahne-inset-in::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  box-shadow: inset 2px 3px 4px rgba(34, 52, 52, .32), inset 0 0 0 1px rgba(70, 50, 36, .14);
}
.sahne-inset-art { position: absolute; inset: 0; display: grid; }
.sahne-inset-art > * { width: 100%; height: 100%; }

.sahne-out > .sahne-b-in, .sahne-out > .sahne-inset-in { animation: sahne-out 120ms ease-in forwards; }
.sahne-out > .sahne-snd-in, .sahne-ov > .sahne-tail.sahne-out { animation: sahne-fade 120ms ease-in forwards; }

/* still: no movement, only fades */
.sahne-ov.sahne-still .sahne-b-in, .sahne-ov.sahne-still .sahne-snd-in, .sahne-ov.sahne-still .sahne-inset-in { animation-name: sahne-in; }
.sahne-ov.sahne-still .sahne-out > * { animation-name: sahne-fade; }
@media (prefers-reduced-motion: reduce) {
  .sahne-ov .sahne-b-in, .sahne-ov .sahne-snd-in, .sahne-ov .sahne-inset-in { animation-name: sahne-in; }
  .sahne-ov .sahne-out > * { animation-name: sahne-fade; }
}

@keyframes sahne-pop { from { opacity: 0; transform: scale(.55); } 70% { transform: scale(1.03); } }
@keyframes sahne-stamp { from { opacity: 0; transform: scale(1.5) rotate(calc(var(--sahne-rot, -6deg) * 2.5)); } }
@keyframes sahne-in { from { opacity: 0; } }
@keyframes sahne-out { to { opacity: 0; transform: scale(.9); } }
@keyframes sahne-fade { to { opacity: 0; } }
`;
