// The still backend: SVG output of a composed puppet (DESIGN.md §4.2).

export { renderSvg, type StillOptions, type Figure } from "./render.ts";
export { portrait, silhouette, clearPortraits, portraitCacheSize, onPortraitError, type PortraitOptions } from "./portrait.ts";
export { SvgContext } from "./recorder.ts";
