// The place page's own styles, added to the document once by the page (the studio's shared styles are in index.html).

const CSS = `
.pl { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 14px; align-items: start; }
.pl-main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.pl-side { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 64px; max-height: calc(100vh - 80px); overflow: auto; }
.pl-ov { position: absolute; inset: 0; touch-action: none; }
.pl-ov.dropping { cursor: crosshair; }
.pl-ov svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.pl-ov .outline { fill: color-mix(in srgb, var(--accent) 14%, transparent); stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 4; }
.pl-ov .outline.ghost { fill: color-mix(in srgb, var(--warn) 16%, transparent); stroke: var(--warn); stroke-dasharray: none; }
.pl-ov .hover { fill: none; stroke: color-mix(in srgb, var(--accent) 60%, transparent); stroke-width: 1.5; }
.pl-pins { position: absolute; inset: 0; pointer-events: none; }
.pl-pin { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; cursor: grab; display: grid; place-items: center; }
.pl-pin .x { width: 18px; height: 18px; position: relative; }
.pl-pin .x::before, .pl-pin .x::after { content: ""; position: absolute; left: 50%; top: 50%; width: 18px; height: 4px; margin: -2px 0 0 -9px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 0 1px #0006; }
.pl-pin .x::before { transform: rotate(45deg); } .pl-pin .x::after { transform: rotate(-45deg); }
.pl-pin.air .x::before, .pl-pin.air .x::after { background: #7fb6e8; }
.pl-pin .name { position: absolute; top: 14px; font-size: 11px; line-height: 1.2; padding: 0 5px; border-radius: 4px; background: #000a; color: #fff; white-space: nowrap; }
.pl-pin .arrow { position: absolute; top: -16px; font-size: 13px; color: #fff; text-shadow: 0 0 3px #000; }
.pl-pin.on .x::before, .pl-pin.on .x::after { background: var(--warn); }
.pl-pin.on .name { background: var(--warn); color: #000; }
.pl-pin .perch { position: absolute; left: 12px; top: -14px; font-size: 13px; }
.pl-hint { position: absolute; left: 10px; bottom: 10px; padding: 4px 10px; border-radius: 99px; background: #000b; color: #fff; font-size: 12.5px; pointer-events: none; }
.pl-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 8px 12px; }
.pl-strip .group { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.pl-strip .group > b { font-size: 12px; color: var(--mute); font-weight: 600; margin-right: 4px; text-transform: uppercase; letter-spacing: .04em; }
.pl-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 99px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); font-size: 13px; cursor: pointer; }
.pl-chip.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.pl-chip.off { opacity: .55; }
.pl-chip .x, .pl-chip .play { border: 0; background: none; padding: 0 0 0 2px; color: inherit; cursor: pointer; font-size: 12px; opacity: .7; }
.pl-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.pl-plan { padding: 8px; }
.pl-plan svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; }
.pl-plan .room { fill: color-mix(in srgb, var(--chip) 70%, transparent); stroke: var(--line); }
.pl-plan .far { fill: none; stroke: var(--line); stroke-dasharray: 3 3; }
.pl-plan .piece rect { fill: var(--raised); stroke: var(--mute); stroke-width: 1; }
.pl-plan .piece.back rect { opacity: .45; }
.pl-plan .piece text, .pl-plan .mark text, .pl-plan .prop text { font-size: 9px; fill: var(--mute); pointer-events: none; }
.pl-plan .prop circle { fill: var(--warn); }
.pl-plan .mark path { stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; fill: none; }
.pl-plan .mark.air path { stroke: #7fb6e8; }
.pl-plan .on rect, .pl-plan .on circle { stroke: var(--accent); stroke-width: 2.5; }
.pl-plan .on path { stroke: var(--warn); }
.pl-plan .on text { fill: var(--ink); font-weight: 700; }
.pl-plan .cam { stroke: var(--curtain); stroke-width: 2; fill: none; }
.pl-plan .cam-label { font-size: 9px; fill: var(--curtain); }
.pl-plan g { cursor: grab; }
.pl-card { display: flex; flex-direction: column; gap: 8px; }
.pl-card header { display: flex; align-items: center; gap: 8px; }
.pl-card header .art { width: 56px; height: 56px; flex: none; border-radius: 8px; background: var(--chip); display: grid; place-items: center; overflow: hidden; }
.pl-card header .art img, .pl-card header .art svg { max-width: 100%; max-height: 100%; }
.pl-card header h3 { margin: 0; font-size: 16px; }
.pl-card header small { color: var(--mute); }
.pl-card .lbl { font-size: 12.5px; color: var(--mute); margin-bottom: 3px; }
.pl-xyz { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pl-xyz label { font-size: 12px; color: var(--mute); }
.pl-xyz input { width: 100%; }
.pl-face { display: grid; grid-template-columns: repeat(6, auto); gap: 4px; justify-content: start; }
.pl-budget { height: 6px; border-radius: 3px; background: var(--chip); overflow: hidden; }
.pl-budget > i { display: block; height: 100%; background: var(--accent); }
.pl-budget.bad > i { background: var(--bad); }
.pl-cat .gallery .grid { max-height: 52vh; overflow: auto; }
@media (max-width: 980px) { .pl { grid-template-columns: 1fr; } .pl-side { position: static; max-height: none; } }
`;

export function placeStyles() {
  if (typeof document === "undefined" || document.getElementById("place-css")) return;
  const el = document.createElement("style");
  el.id = "place-css";
  el.textContent = CSS;
  document.head.append(el);
}
