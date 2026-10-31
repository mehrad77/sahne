// The builder screen's stylesheet, injected once per document by mountBuilder (builder.ts). Every
// class is prefixed `sahne-bld`. The look is the kit's: warm cream paper and ink, cards cut from
// paper with a light rim and a soft shadow cast down-right (the light is upper left), no outlines.
//
// A host themes it through the custom properties on `.sahne-bld` (set them on the host or any
// ancestor-free selector of its own). It follows the system's dark theme unless the root says
// `data-theme="light"` or `"dark"`. The layout follows the builder's own width (a container
// query), not the window's: the preview on top below 720 px, beside the panel above it.

export const BUILDER_CSS = `
.sahne-bld {
  --sb-bg: #F5EEE2;
  --sb-card: #FFFCF5;
  --sb-sunk: #EDE3D3;
  --sb-ink: #2B2420;
  --sb-mute: #74675D;
  --sb-line: rgba(112, 90, 72, .2);
  --sb-accent: #2F7F7A;
  --sb-accent-ink: #FFFFFF;
  --sb-warm: #E0622C;
  --sb-focus: #E0622C;
  --sb-lift: .5px 1px 0 rgba(96, 66, 40, .10), 1.5px 3px 7px rgba(72, 48, 26, .13);
  --sb-rim: inset 0 1px 0 rgba(255, 255, 255, .7);
  --sb-radius: 14px;
  --sb-tile: 76px;
  --sb-thumb: 64px;
  container: sahne-bld / inline-size;
  height: 100%; min-height: 0; box-sizing: border-box; color: var(--sb-ink); background: var(--sb-bg);
  font-size: 15px; line-height: 1.35; color-scheme: light; -webkit-tap-highlight-color: transparent; text-align: start;
}
.sahne-bld[data-theme="dark"] {
  --sb-bg: #1F1B18; --sb-card: #2A2521; --sb-sunk: #171412; --sb-ink: #F1E8DC; --sb-mute: #A99C8F;
  --sb-line: rgba(255, 240, 220, .13); --sb-accent: #62B9B1; --sb-accent-ink: #10201F; --sb-warm: #F0874F; --sb-focus: #F0A060;
  --sb-lift: 0 1px 0 rgba(0, 0, 0, .3), 1.5px 3px 8px rgba(0, 0, 0, .35); --sb-rim: inset 0 1px 0 rgba(255, 245, 230, .06);
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  .sahne-bld:not([data-theme="light"]) {
    --sb-bg: #1F1B18; --sb-card: #2A2521; --sb-sunk: #171412; --sb-ink: #F1E8DC; --sb-mute: #A99C8F;
    --sb-line: rgba(255, 240, 220, .13); --sb-accent: #62B9B1; --sb-accent-ink: #10201F; --sb-warm: #F0874F; --sb-focus: #F0A060;
    --sb-lift: 0 1px 0 rgba(0, 0, 0, .3), 1.5px 3px 8px rgba(0, 0, 0, .35); --sb-rim: inset 0 1px 0 rgba(255, 245, 230, .06);
    color-scheme: dark;
  }
}
.sahne-bld *, .sahne-bld *::before, .sahne-bld *::after { box-sizing: border-box; }
.sahne-bld [hidden] { display: none !important; }
.sahne-bld button { font: inherit; color: inherit; margin: 0; cursor: pointer; -webkit-user-select: none; user-select: none; }
.sahne-bld :focus { outline: none; }
.sahne-bld :focus-visible { outline: 3px solid var(--sb-focus); outline-offset: 2px; }
.sahne-bld .sahne-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---- layout: the preview on top, the panel under it; side by side when wide ---- */
.sahne-bld-in { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.sahne-bld-view { flex: 0 0 auto; height: clamp(250px, 46vh, 440px); display: flex; flex-direction: column; overflow: hidden; background: var(--sb-bg); }
.sahne-bld-pic { position: relative; flex: 1 1 auto; min-height: 0; background: var(--sb-sunk); }
.sahne-bld-side { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
@container sahne-bld (min-width: 720px) {
  .sahne-bld-in { display: grid; grid-template-columns: minmax(300px, 5fr) 7fr; }
  .sahne-bld-view { height: auto; min-height: 420px; border-radius: 0; }
  .sahne-bld-side { border-inline-start: 1px solid var(--sb-line); }
}

/* ---- the preview ---- */
.sahne-bld-stage, .sahne-bld-still { position: absolute; inset: 0; }
.sahne-bld-stage { touch-action: manipulation; cursor: pointer; }
.sahne-bld-stage:focus-visible { outline-offset: -4px; }
.sahne-bld-still { display: grid; place-items: center; padding: 10px;
  background: radial-gradient(ellipse at 40% 30%, #FFF8EA 0%, #F3E7D3 60%, #E9DAC2 100%); }
.sahne-bld-still > svg { width: 100%; height: 100%; max-height: 100%; }
.sahne-bld[data-dark] .sahne-bld-still { filter: brightness(.92); }
/* round paper buttons over the preview */
.sahne-bld-tools { position: absolute; inset: 10px 10px auto 10px; display: flex; justify-content: space-between; gap: 8px; pointer-events: none; }
.sahne-bld-tools > div { display: flex; gap: 6px; pointer-events: auto; }
.sahne-bld-round {
  width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; display: grid; place-items: center;
  background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-rim), var(--sb-lift);
  transition: transform .12s ease, opacity .12s ease;
}
.sahne-bld-round svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sahne-bld-round:active { transform: translateY(1px) scale(.96); }
.sahne-bld-round[aria-disabled="true"] { opacity: .45; cursor: default; }
.sahne-bld-round[aria-pressed="true"] { background: var(--sb-accent); color: var(--sb-accent-ink); }
.sahne-bld-turn { position: absolute; inset-inline-end: 10px; bottom: 10px; }
/* the emotion strip: the learner's own face, acting */
.sahne-bld-moods {
  flex: none; display: flex; gap: 3px; justify-content: safe center;
  padding: 6px 6px 4px; overflow-x: auto; scrollbar-width: none; background: var(--sb-bg);
}
.sahne-bld-moods::-webkit-scrollbar { display: none; }
.sahne-bld-mood {
  flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; overflow: hidden;
  background: var(--sb-card); box-shadow: var(--sb-rim), var(--sb-lift); display: grid; place-items: center;
}
.sahne-bld-mood svg { width: 40px; height: 40px; display: block; }
.sahne-bld-mood[aria-checked="true"] { box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); }
/* a narrow builder shows six faces, so the strip never scrolls */
@container sahne-bld (max-width: 345px) { .sahne-bld-mood:nth-child(n+7) { display: none; } }

/* ---- tabs ---- */
.sahne-bld-tabs { flex: none; display: flex; gap: 2px; padding: 8px 8px 0; overflow-x: auto; scrollbar-width: none; background: var(--sb-bg); }
.sahne-bld-tabs::-webkit-scrollbar { display: none; }
.sahne-bld-tab {
  flex: 1 0 auto; min-height: 44px; padding: 8px 12px; border: 0; border-radius: 12px 12px 0 0; background: transparent;
  color: var(--sb-mute); font-weight: 600; font-size: 14px; white-space: nowrap; position: relative;
}
.sahne-bld-tab[aria-selected="true"] { background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-rim), 0 -1px 4px rgba(72, 48, 26, .06); }
.sahne-bld-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 30%; right: 30%; bottom: 6px; height: 3px; border-radius: 3px; background: var(--sb-accent); }
.sahne-bld-tab:focus-visible { outline-offset: -3px; }

/* ---- the panel ---- */
.sahne-bld-panel { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--sb-card); padding: 4px 14px 18px; }
.sahne-bld-field { padding: 12px 0 6px; border-top: 1px dashed var(--sb-line); }
.sahne-bld-field:first-child { border-top: 0; }
.sahne-bld-fh { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
.sahne-bld-fh h3 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--sb-mute); }
.sahne-bld-note { font-size: 12.5px; color: var(--sb-mute); }
.sahne-bld-note.sahne-bld-warn { color: var(--sb-warm); font-weight: 600; }
.sahne-bld-sub { margin: 10px 0 6px; font-size: 12.5px; color: var(--sb-mute); font-weight: 600; }

/* option tiles: a thumbnail of the character wearing it, on a sunk paper card */
.sahne-bld-opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--sb-tile), 1fr)); gap: 8px; }
.sahne-bld-opts[data-few] { grid-template-columns: repeat(auto-fill, minmax(var(--sb-tile), 84px)); }
.sahne-bld-opt {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; min-height: 44px;
  padding: 5px 4px 6px; border: 0; border-radius: 12px; background: transparent; text-align: center;
}
.sahne-bld-thumb {
  width: var(--sb-thumb); height: var(--sb-thumb); border-radius: 12px; background: var(--sb-sunk); display: grid; place-items: center; overflow: hidden;
  transition: transform .14s ease, box-shadow .14s ease;
}
.sahne-bld-thumb > svg { width: 100%; height: 100%; display: block; }
.sahne-bld-thumb:empty::before { content: ""; width: 40%; height: 40%; border-radius: 50%; background: var(--sb-line); }
.sahne-bld-lab { font-size: 12px; line-height: 1.2; color: var(--sb-mute); max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.sahne-bld-opt[aria-checked="true"] .sahne-bld-thumb { background: var(--sb-bg); box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); transform: translateY(-1px); }
.sahne-bld-opt[aria-checked="true"] .sahne-bld-lab { color: var(--sb-ink); font-weight: 600; }
.sahne-bld-opt:hover .sahne-bld-thumb { box-shadow: 0 0 0 1.5px var(--sb-line), var(--sb-lift); }
.sahne-bld-opt[aria-checked="true"]:hover .sahne-bld-thumb { box-shadow: 0 0 0 2.5px var(--sb-accent), var(--sb-lift); }
.sahne-bld-opt[aria-disabled="true"] { cursor: default; }
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb { position: relative; }
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb > svg { filter: grayscale(.7); }
/* a locked option is veiled in its own card's paper, so it reads in both themes */
.sahne-bld-opt[aria-disabled="true"] .sahne-bld-thumb::after { content: ""; position: absolute; inset: 0; background: var(--sb-sunk); opacity: .5; }
.sahne-bld-lock {
  position: absolute; top: 2px; inset-inline-end: 2px; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; background: var(--sb-card); color: var(--sb-ink); box-shadow: var(--sb-lift);
}
.sahne-bld-lock svg { width: 13px; height: 13px; fill: currentColor; }
.sahne-bld-badge {
  position: absolute; top: 3px; inset-inline-start: 3px; padding: 1px 6px; border-radius: 99px; font-size: 10.5px; font-weight: 700;
  background: var(--sb-warm); color: #fff; letter-spacing: .02em;
}
.sahne-bld-none { font-size: 22px; color: var(--sb-mute); }
.sahne-bld-hidden .sahne-bld-opts { opacity: .6; }

/* colour swatches: paper discs */
.sahne-bld-sws { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 2px; }
.sahne-bld-sw { position: relative; width: 44px; height: 44px; border: 0; padding: 0; background: transparent; border-radius: 50%; display: grid; place-items: center; justify-self: center; }
.sahne-bld-sw > span { width: 32px; height: 32px; border-radius: 50%; background: var(--c); box-shadow: inset 1px 1.5px 0 rgba(255, 255, 255, .35), inset -1px -2px 0 rgba(0, 0, 0, .12), .5px 1px 2px rgba(72, 48, 26, .25); transition: transform .12s ease; }
.sahne-bld-sw[aria-checked="true"] > span { transform: scale(1.06); box-shadow: 0 0 0 3px var(--sb-card), 0 0 0 5.5px var(--sb-accent); }
.sahne-bld-sw[aria-disabled="true"] > span { opacity: .45; }
.sahne-bld-sw .sahne-bld-lock { top: 0; inset-inline-end: 0; width: 18px; height: 18px; }
.sahne-bld-sw .sahne-bld-lock svg { width: 10px; height: 10px; }

/* small choices: which colour, the side, a tag filter, "more" */
.sahne-bld-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.sahne-bld-chip {
  min-height: 36px; padding: 6px 12px; border: 0; border-radius: 99px; display: inline-flex; align-items: center; gap: 7px;
  background: var(--sb-sunk); color: var(--sb-ink); font-size: 13.5px; position: relative;
}
.sahne-bld-chip::before { content: ""; position: absolute; inset: -4px 0; }
.sahne-bld-chip[aria-checked="true"], .sahne-bld-chip[aria-pressed="true"] { background: var(--sb-accent); color: var(--sb-accent-ink); font-weight: 600; }
.sahne-bld-chip i { width: 16px; height: 16px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1.5px var(--sb-card); }
.sahne-bld-more { margin-top: 8px; background: transparent; box-shadow: inset 0 0 0 1.5px var(--sb-line); color: var(--sb-accent); font-weight: 600; min-height: 44px; }

/* the height slider */
.sahne-bld-range { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; font-size: 13px; color: var(--sb-mute); }
.sahne-bld-range input { width: 100%; min-height: 44px; margin: 0; accent-color: var(--sb-accent); background: transparent; }

/* ---- the foot: Cancel and Done ---- */
.sahne-bld-foot { flex: none; display: flex; justify-content: flex-end; gap: 10px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: var(--sb-card); border-top: 1px solid var(--sb-line); }
.sahne-bld-btn { min-height: 46px; min-width: 104px; padding: 10px 20px; border: 0; border-radius: 99px; font-weight: 700; background: var(--sb-sunk); }
.sahne-bld-btn.sahne-bld-primary { background: var(--sb-accent); color: var(--sb-accent-ink); box-shadow: var(--sb-rim), var(--sb-lift); }
.sahne-bld-btn:active { transform: translateY(1px); }

@media (prefers-reduced-motion: reduce) {
  .sahne-bld *, .sahne-bld *::before, .sahne-bld *::after { transition: none !important; animation: none !important; }
}
.sahne-bld[data-still] *, .sahne-bld[data-still] *::before { transition: none !important; }
@media (forced-colors: active) {
  .sahne-bld-opt[aria-checked="true"] .sahne-bld-thumb, .sahne-bld-sw[aria-checked="true"] > span, .sahne-bld-mood[aria-checked="true"] { outline: 3px solid Highlight; }
  .sahne-bld-tab[aria-selected="true"] { outline: 2px solid Highlight; }
}
`;
