// Prop text's stylesheet (ui/prop-text.ts), injected once per document. Every class is prefixed
// `sahne-pt`. Each box is laid out flat at about the size it shows and put on its paper plane by a
// `matrix3d`; its font is the page's `--sahne-text-<font>` (DESIGN.md §6.8), and nothing in it
// takes a tap.

export const PROP_TEXT_CSS = `
.sahne-pt { position: absolute; inset: 0; overflow: hidden; contain: strict; pointer-events: none; color-scheme: light; }
.sahne-pt[hidden] { display: none; }
.sahne-pt > div { position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; padding: 0; border: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center; transform-origin: 0 0; pointer-events: none; user-select: none;
  line-height: 1.15; letter-spacing: 0; word-spacing: normal; text-transform: none; font-style: normal; font-variant: normal; text-indent: 0;
  text-shadow: none; direction: ltr; white-space: pre-line; overflow-wrap: break-word; text-wrap: balance; hyphens: manual;
  -webkit-font-smoothing: antialiased; transition: opacity .12s; color: transparent; }
.sahne-pt > div[hidden] { display: none; }
.sahne-pt > div.sahne-pt-off { opacity: 0; }
.sahne-pt.sahne-still > div { transition: none; }
.sahne-pt-t { flex: none; }
.sahne-pt-sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
