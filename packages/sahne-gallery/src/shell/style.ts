// The gallery's one stylesheet, put in the page once by the shell.

export const CSS = `
:root { --sahne-text-hand: "Comic Neue", "Segoe Print", "Chalkboard SE", "Bradley Hand", cursive; --sahne-text-print: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif; --sahne-text-screen: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
:root { --bg: #F4EFE6; --ink: #2B2420; --mute: #7A6E64; --line: #DDD3C4; --chip: #FFFDF8; --accent: #2F8C88; --warn: #B7791F; --bad: #B23A2A; --side: #EDE6DA; --frame-max: none; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1E1B19; --ink: #EFE7DC; --mute: #A89C90; --line: #3A342F; --chip: #2A2623; --side: #24201D; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #1E1B19; --ink: #EFE7DC; --mute: #A89C90; --line: #3A342F; --chip: #2A2623; --side: #24201D; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); }
.app { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
.side { background: var(--side); border-right: 1px solid var(--line); padding: 12px 10px 24px; position: sticky; top: 0; height: 100vh; overflow: auto; }
.side .brand { padding: 4px 8px 10px; display: block; text-decoration: none; }
/* the sahne GALLERY lockup (assets/brand/, written by brand/build.mjs), light or dark with the theme */
.side .brand .lockup { display: block; width: 100%; max-width: 200px; aspect-ratio: 671 / 112; background: url(assets/brand/sahne-gallery-header.svg) left center / contain no-repeat; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .side .brand .lockup { background-image: url(assets/brand/sahne-gallery-header-dark.svg); } }
:root[data-theme="dark"] .side .brand .lockup { background-image: url(assets/brand/sahne-gallery-header-dark.svg); }
.side .brand small { color: var(--mute); font-weight: 400; display: block; font-size: 12px; margin-top: 6px; }
.side nav a { display: block; color: var(--ink); text-decoration: none; padding: 3px 8px; border-radius: 8px; font-size: 13.5px; }
.side nav a.top { font-weight: 650; margin-top: 6px; }
.side nav a.sub { padding-left: 18px; color: var(--mute); }
.side nav a.sub small { opacity: .8; }
.side nav a.sub:has(.icon) { display: flex; gap: 7px; align-items: flex-start; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side nav a.sub .icon { width: 16px; height: 16px; flex: none; margin-top: 2px; border-radius: 3px; }
.side nav .group { margin: 10px 8px 3px 10px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 10.5px; font-weight: 750; text-transform: uppercase; letter-spacing: .09em; color: var(--accent); }
.side nav .subs > .group:first-child { border-top: 0; padding-top: 2px; margin-top: 4px; }
.side nav a:hover { background: var(--chip); }
.side nav details.explore { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 8px; }
.side nav details.explore summary { cursor: pointer; padding: 3px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--mute); font-weight: 650; }
.side nav details.explore summary:hover { color: var(--ink); }
.side nav a[aria-current="page"] { background: var(--accent); color: #fff; }
.main { min-width: 0; }
.topbar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.topbar .crumbs { font-weight: 650; margin-right: auto; }
.topbar .menu { display: inline-block; }
.app.folded { grid-template-columns: 0 1fr; }
.app.folded .side { visibility: hidden; padding: 0; border: 0; }
.topbar details.settings { position: relative; }
.topbar details.settings summary { list-style: none; cursor: pointer; border: 1px solid var(--line); background: var(--chip); border-radius: 999px; padding: 3px 11px; }
.topbar details.settings summary::-webkit-details-marker { display: none; }
.topbar details.settings summary::before { content: "⚙ "; color: var(--mute); }
.topbar details.settings[open] summary, .topbar details.settings summary:hover { border-color: var(--accent); }
.topbar details.settings .panel { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; display: grid; gap: 4px; padding: 10px 12px; min-width: 260px; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px #0003; }
.topbar details.settings .panel > * { justify-self: start; margin: 0; }
.view { max-width: 1180px; margin: 0 auto; padding: 16px 16px 60px; }
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .side { position: fixed; z-index: 10; inset: 0 30% 0 0; transform: translateX(-102%); transition: transform .2s; height: 100vh; }
  .app.open .side { transform: none; box-shadow: 0 0 40px #0004; }
  .app.folded { grid-template-columns: 1fr; }
  .app.folded .side { visibility: visible; padding: 12px 10px 24px; }
}
h1 { font-size: 20px; margin: 4px 0 6px; }
h2 { font-size: 16px; margin: 22px 0 6px; }
h3 { font-size: 14px; margin: 14px 0 4px; }
.head h2 { margin-top: 18px; }
.note { color: var(--mute); margin: 0 0 10px; font-size: 13px; max-width: 80ch; }
.bar { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 6px 0; }
.bar > b { color: var(--mute); font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; margin-right: 2px; min-width: 56px; }
button, select, input[type=text], input[type=search], input[type=number] { font: inherit; color: var(--ink); background: var(--chip); border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; }
select, input[type=text], input[type=search], input[type=number] { border-radius: 8px; }
button { cursor: pointer; }
button:hover { border-color: var(--accent); }
button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
button.primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.slider, .pick { display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--mute); }
.slider output { min-width: 3ch; color: var(--ink); font-variant-numeric: tabular-nums; }
.chip { display: inline-block; font-size: 11px; font-weight: 600; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; color: var(--mute); vertical-align: 1px; white-space: nowrap; }
.chip.ok { border-color: var(--accent); color: var(--accent); }
.chip.warn { border-color: var(--warn); color: var(--warn); }
.chip.bad { border-color: var(--bad); color: var(--bad); }
.chip.ph { border-style: dashed; }
.frame { position: relative; width: 100%; max-width: var(--frame-max); border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: #CFE3EE; margin: 8px 0; }
.card { background: var(--chip); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin: 0 0 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.cards > a.card { color: var(--ink); text-decoration: none; display: grid; gap: 4px; margin: 0; }
.cards > a.card:hover { border-color: var(--accent); }
.cards > a.card small { color: var(--mute); }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 8px 0; font-size: 13px; }
.facts dt { color: var(--mute); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.tile { margin: 0; background: var(--chip); border: 1px solid var(--line); border-radius: 12px; padding: 8px; display: grid; gap: 6px; color: var(--ink); text-decoration: none; }
a.tile:hover { border-color: var(--accent); }
.tile .art { height: 140px; display: grid; place-items: center; background: #EDE6DA; border-radius: 8px; overflow: hidden; }
.tile .art img, .tile .art svg { max-width: 100%; max-height: 136px; }
.tile figcaption, .tile .cap { font: 12px ui-monospace, monospace; display: flex; flex-wrap: wrap; gap: 4px; justify-content: space-between; align-items: center; }
table.t { border-collapse: collapse; font-size: 13px; margin: 6px 0; }
table.t th, table.t td { border: 1px solid var(--line); padding: 3px 8px; text-align: left; vertical-align: top; }
table.t th { color: var(--mute); font-weight: 600; }
.ok { color: var(--accent); } .bad { color: var(--bad); } .warn { color: var(--warn); }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 16px; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.log { font: 12px ui-monospace, monospace; max-height: 220px; overflow: auto; background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 8px; white-space: pre-wrap; }
.meter { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.meter > i { display: block; height: 100%; background: var(--accent); }
.checks { margin: 6px 0 10px; padding-left: 20px; font-size: 13px; }
.sites { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.site .art { height: 150px; display: grid; place-items: center; background: #EDE6DA; border-radius: 8px; overflow: hidden; margin-bottom: 6px; }
.site .art img { width: 100%; height: 100%; object-fit: cover; }
.site h3 { margin: 4px 0 0; }
.placerow { border-top: 1px solid var(--line); padding: 6px 0; display: grid; gap: 4px; font-size: 13px; }
.placerow small { display: block; }
.rules .chip { margin: 1px 0; }
.marks { position: absolute; inset: 0; pointer-events: none; }
.marks .pin { position: absolute; transform: translate(-50%, -100%); pointer-events: auto; font-size: 11px; padding: 1px 7px; opacity: .88; white-space: nowrap; background: #FFFDF8E8; color: #2B2420; border-color: #0002; }
.marks .pin.perch, .marks .pin.air, .marks .pin.pace { border-color: #B7791F; }
.marks .pin.door { border-color: #2F8C88; }
.sheetrow { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.sheetrow h3 { width: 100%; }
.sheetcell { margin: 0; }
.sheetcell .stagebox, .camstages .stagebox { aspect-ratio: 16 / 9; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin: 6px 0; }
.camstages { display: flex; flex-wrap: wrap; gap: 10px; }
.params { display: grid; gap: 6px; margin: 6px 0 10px; }
.param { display: grid; grid-template-columns: 92px 1fr; gap: 2px 8px; align-items: center; font-size: 12.5px; }
.param code { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.param input[type=text], .param select { width: 100%; min-width: 0; }
.param input[type=range] { grid-column: 2; width: 100%; }
.param small { grid-column: 2; color: var(--mute); font-size: 11.5px; line-height: 1.3; }
/* the home page */
.cards.why .card { margin: 0; } .cards.why p { margin: 6px 0 0; color: var(--mute); font-size: 13.5px; line-height: 1.5; }
.how { list-style: none; padding: 0; margin: 6px 0 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; counter-reset: none; }
.how li { position: relative; background: var(--chip); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px 12px 50px; display: grid; gap: 3px; }
.how li .n { position: absolute; left: 12px; top: 12px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: #fff; font-weight: 700; }
.how li small { color: var(--mute); font-size: 13px; line-height: 1.45; }
@media (min-width: 900px) { .how li:not(:last-child)::after { content: "→"; position: absolute; right: -9px; top: 14px; color: var(--mute); background: var(--bg); padding: 0 1px; } }
a.card.news { display: grid; gap: 4px; margin: 22px 0 6px; padding: 14px 16px; text-decoration: none; color: var(--ink); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--chip)); }
a.card.news small { text-transform: uppercase; letter-spacing: .06em; color: var(--accent); font-weight: 700; font-size: 11.5px; }
a.card.news b { font-size: 17px; } a.card.news span { color: var(--mute); }
a.card.news:hover { border-color: var(--ink); }
.cards.packages code { font-size: 12px; color: var(--accent); }
.cards.packages .pkg { display: flex; align-items: center; gap: 8px; } .cards.packages .pkg img { border-radius: 5px; flex: none; }
.cards.stats { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.hero { padding: 18px 0 6px; }
.hero .wordmark { margin: 0; }
/* sah·n·e, the mark as its n (assets/brand/sahne-wordmark*.svg), light or dark with the theme */
.hero .wordmark .word { display: block; height: clamp(48px, 9vw, 84px); aspect-ratio: 294 / 81.5; background: url(assets/brand/sahne-wordmark.svg) left center / contain no-repeat; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hero .wordmark .word { background-image: url(assets/brand/sahne-wordmark-dark.svg); } }
:root[data-theme="dark"] .hero .wordmark .word { background-image: url(assets/brand/sahne-wordmark-dark.svg); }
.hero .wordmark small { display: block; font: italic 400 15px/1.6 Georgia, serif; color: var(--mute); letter-spacing: 0; margin-top: 4px; }
.hero .tagline { font-size: clamp(16px, 2.4vw, 20px); line-height: 1.4; max-width: 46ch; margin: 12px 0 14px; }
.ctas { display: flex; flex-wrap: wrap; gap: 8px; }
.cta { display: inline-block; padding: 7px 15px; border-radius: 999px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); text-decoration: none; font-weight: 600; }
.cta:hover { border-color: var(--accent); }
.cta.main { background: var(--accent); border-color: var(--accent); color: #fff; }
.hero-stage .frame { border-radius: 16px; box-shadow: 0 10px 30px #0002; }
.film-title, .film-cap { position: absolute; pointer-events: none; opacity: 0; transition: opacity .8s; color: #fff; text-shadow: 0 1px 8px #000a; z-index: 3; }
.film-title { inset: 0; display: grid; place-content: center; text-align: center; background: radial-gradient(#0008, #000c); }
.film-title b { font: 700 clamp(30px, 7vw, 64px)/1.05 Georgia, serif; }
.film-title small { font: 600 clamp(10px, 1.4vw, 13px)/1.6 system-ui, sans-serif; letter-spacing: .3em; text-transform: uppercase; opacity: .8; }
.film-title span { font: italic 400 clamp(12px, 2vw, 17px)/1.6 Georgia, serif; opacity: .85; }
.film-cap { left: 14px; bottom: 12px; font: 600 clamp(11px, 1.6vw, 14px)/1.2 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; background: #0006; padding: 5px 10px; border-radius: 6px; }
.film-title.on, .film-cap.on { opacity: 1; }
.prose-p { max-width: 72ch; font-size: 15px; line-height: 1.6; margin: 0 0 10px; }
pre.code, .prose pre { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; overflow: auto; max-width: 100%; }
/* the docs */
.doc-head small { color: var(--mute); }
.toc { background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 6px 12px; margin: 10px 0; max-width: 72ch; }
.toc summary { cursor: pointer; font-weight: 600; }
.toc ul { margin: 6px 0; padding-left: 18px; columns: 2 260px; }
.toc li.sub { margin-left: 14px; font-size: 13px; }
.prose { max-width: 80ch; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.prose h1 { font-size: 28px; margin: 14px 0 10px; }
.prose h2 { font-size: 21px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
.prose h3 { font-size: 17px; margin: 20px 0 6px; }
.prose h1, .prose h2, .prose h3, .prose h4 { scroll-margin-top: 56px; }
.prose code { font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip); border: 1px solid var(--line); border-radius: 5px; padding: 0 4px; }
.prose pre code, pre.code code { border: 0; padding: 0; background: none; font-size: inherit; }
/* code in colour (highlight.js's classes, written by data.mjs), in the page's light and dark */
:root { --hl-key: #A23E8C; --hl-str: #2F7A3A; --hl-num: #B5541D; --hl-com: #8C8176; --hl-fn: #2462A8; --hl-type: #1F7F7B; --hl-attr: #8A5A00; --hl-meta: #6B5CA5; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --hl-key: #E28AD0; --hl-str: #9BD08A; --hl-num: #F2A36B; --hl-com: #8F857B; --hl-fn: #82B4F0; --hl-type: #6FD0C8; --hl-attr: #E5C07B; --hl-meta: #B4A6F0; } }
:root[data-theme="dark"] { --hl-key: #E28AD0; --hl-str: #9BD08A; --hl-num: #F2A36B; --hl-com: #8F857B; --hl-fn: #82B4F0; --hl-type: #6FD0C8; --hl-attr: #E5C07B; --hl-meta: #B4A6F0; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in.hljs-keyword, .hljs-literal { color: var(--hl-key); }
.hljs-string, .hljs-regexp, .hljs-template-string, .hljs-symbol { color: var(--hl-str); }
.hljs-number { color: var(--hl-num); }
.hljs-comment, .hljs-quote { color: var(--hl-com); font-style: italic; }
.hljs-title, .hljs-title.function_, .hljs-function .hljs-title { color: var(--hl-fn); }
.hljs-type, .hljs-title.class_, .hljs-built_in { color: var(--hl-type); }
.hljs-attr, .hljs-attribute, .hljs-property, .hljs-variable, .hljs-params { color: var(--hl-attr); }
.hljs-meta, .hljs-subst, .hljs-tag, .hljs-name { color: var(--hl-meta); }
.prose table { border-collapse: collapse; display: block; overflow-x: auto; margin: 10px 0; font-size: 13.5px; }
.prose th, .prose td { border: 1px solid var(--line); padding: 5px 8px; text-align: left; vertical-align: top; }
.prose th { background: var(--chip); }
.prose img { max-width: 100%; height: auto; border-radius: 10px; }
/* a markdown picture (a screenshot, a diagram) framed like a print on a mat, apart from the text */
.prose img.pic { display: block; width: auto; max-width: 100%; max-height: 460px; margin: 14px auto; padding: 6px; background: var(--chip); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 1px 2px #0000000f, 0 8px 22px #0000001a; }
.prose img.pic { cursor: zoom-in; }
.pic-zoom { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 3vh 3vw; background: #000000c4; cursor: zoom-out; }
.pic-zoom img { max-width: 94vw; max-height: 94vh; border-radius: 10px; background: var(--chip); box-shadow: 0 20px 60px #0008; }
.prose blockquote { margin: 10px 0; padding: 2px 14px; border-left: 3px solid var(--accent); color: var(--mute); }
.prose .live { margin: 10px 0 4px; }
.prose pre.mermaid { background: none; border: 0; padding: 6px 0; text-align: center; overflow-x: auto; width: min(1100px, calc(100vw - 290px)); max-width: none; }
@media (max-width: 860px) { .prose pre.mermaid { width: auto; } }
.prose pre.mermaid svg { max-width: 100%; height: auto; }
.prose details.src summary { cursor: pointer; color: var(--mute); font-size: 13px; }
`;
