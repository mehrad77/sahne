// Markdown a model writes (the assistant's answers), drawn: the same parser as the guides (src/model/markdown.ts), so
// **bold**, `code`, lists, tables and fenced code read as they should, not as their marks. Links open beside the editor,
// except the editor's own (#/…). A table scrolls sideways in a narrow panel. Streaming text is parsed again as it grows.

import { html } from "htm/preact";
import type { JSX } from "preact";
import { useMemo } from "preact/hooks";
import { parse, type Block, type Inline } from "../model/markdown.ts";

function Words(p: { xs: Inline[] }): JSX.Element {
  return html`${p.xs.map(x => x.t === "text" ? x.text : x.t === "code" ? html`<code>${x.text}</code>`
    : x.t === "a" ? html`<a href=${x.href} target=${x.href.startsWith("#") ? undefined : "_blank"} rel="noreferrer"><${Words} xs=${x.kids} /></a>`
    : x.t === "b" ? html`<b><${Words} xs=${x.kids} /></b>` : html`<em><${Words} xs=${x.kids} /></em>`)}` as JSX.Element;
}

function Blocks(p: { blocks: Block[] }): JSX.Element {
  const w = (xs: Inline[]) => html`<${Words} xs=${xs} />`;
  return html`${p.blocks.map(b => {
    switch (b.t) {
      case "h": return html`<p class="md-h">${w(b.kids)}</p>`;
      case "p": return html`<p>${w(b.kids)}</p>`;
      case "ul": return html`<ul>${b.items.map(it => html`<li><${Blocks} blocks=${it} /></li>`)}</ul>`;
      case "ol": return html`<ol>${b.items.map(it => html`<li><${Blocks} blocks=${it} /></li>`)}</ol>`;
      case "code": return html`<pre class="code"><code>${b.text}</code></pre>`;
      case "table": return html`<div class="tablewrap"><table class="grid"><thead><tr>${b.head.map(c => html`<th>${w(c)}</th>`)}</tr></thead><tbody>${b.rows.map(r => html`<tr>${r.map(c => html`<td>${w(c)}</td>`)}</tr>`)}</tbody></table></div>`;
      case "quote": return html`<blockquote><${Blocks} blocks=${b.kids} /></blockquote>`;
    }
  })}` as JSX.Element;
}

/** A model's Markdown as HTML. */
export function Markdown(p: { text: string; class?: string }) {
  const blocks = useMemo(() => { try { return parse(p.text); } catch { return null; } }, [p.text]);
  return blocks ? html`<div class=${`md ${p.class ?? ""}`}><${Blocks} blocks=${blocks} /></div>` : html`<div class=${p.class} style="white-space:pre-wrap">${p.text}</div>`;
}
