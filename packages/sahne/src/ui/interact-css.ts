// The interaction layer's stylesheet (interact/index.ts), injected once per document. Every class
// is prefixed `sahne-ix`. Rings are paper-coloured light, never red or green: there is no right or
// wrong colour (DESIGN.md §9). `--sahne-ix-glow` and `--sahne-ix-focus` can be replaced by the app.

export const INTERACT_CSS = `
.sahne-ix { --sahne-ix-glow: 255, 236, 170; --sahne-ix-focus: #2F8C88;
  position: absolute; inset: 0; pointer-events: none; z-index: 5; font: inherit; -webkit-tap-highlight-color: transparent; }
.sahne-ix-ring { position: absolute; left: 0; top: 0; border-radius: 50%; box-sizing: border-box; pointer-events: none;
  border: 2px solid rgba(var(--sahne-ix-glow), .9); box-shadow: 0 0 0 3px rgba(var(--sahne-ix-glow), .28), 0 0 18px 6px rgba(var(--sahne-ix-glow), .45);
  opacity: 0; transition: opacity .25s; will-change: translate; }
.sahne-ix-ring.on { opacity: 1; }
.sahne-ix-ring.ack { border-width: 2px; animation: sahne-ix-ack .7s ease-out forwards; }
.sahne-ix-ring.pick { border-style: dashed; box-shadow: none; border-color: rgba(255, 252, 240, .85); }
.sahne-ix-ring.hint { animation: sahne-ix-breathe 1.6s ease-in-out infinite; }
.sahne-ix-ring.show { border-width: 3px; box-shadow: 0 0 0 4px rgba(var(--sahne-ix-glow), .5), 0 0 26px 10px rgba(var(--sahne-ix-glow), .6); }
.sahne-ix-ring.drop { border-style: solid; box-shadow: 0 0 0 3px rgba(var(--sahne-ix-glow), .4); }
.sahne-ix-ring.spot { pointer-events: auto; cursor: pointer; background: rgba(var(--sahne-ix-glow), .22); border-style: dashed; box-shadow: none; padding: 0; margin: 0; }
.sahne-ix-ring.spot:hover { background: rgba(var(--sahne-ix-glow), .4); }
@keyframes sahne-ix-ack { 0% { opacity: .95; scale: .82; } 100% { opacity: 0; scale: 1.18; } }
@keyframes sahne-ix-breathe { 0%, 100% { scale: .94; opacity: .7; } 50% { scale: 1.06; opacity: 1; } }
.sahne-still .sahne-ix-ring { transition: none; animation: none !important; }
.sahne-still .sahne-ix-ring.ack { opacity: .8; }
.sahne-ix-list { position: absolute; left: 8px; right: 8px; bottom: 8px; pointer-events: auto; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 8px; border-radius: 12px; background: rgba(255, 252, 245, .94); color: #2B2420; box-shadow: 0 2px 10px rgba(60, 40, 20, .2); }
.sahne-ix-list:empty { display: none; }
.sahne-ix-list.sahne-ix-auto:not(:focus-within) { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.sahne-ix-q { margin: 0 6px 0 2px; font-weight: 600; }
.sahne-ix-list button { font: inherit; color: inherit; min-height: 44px; min-width: 44px; padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(112, 90, 72, .45); background: #FFFDF8; cursor: pointer; }
.sahne-ix-list button:focus-visible, .sahne-ix-ring.spot:focus-visible { outline: 3px solid var(--sahne-ix-focus); outline-offset: 2px; }
.sahne-ix-list button[disabled] { opacity: .55; cursor: default; }
.sahne-ix-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
