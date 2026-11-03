// JSON in a read-only editor: a frame with the file's name and a lock, numbered lines, and keys, strings, numbers,
// true/false/null and punctuation each in their own colour (`.json-*` in index.html, from the theme's tokens). A tokenizer,
// not a parser: text that is not JSON shows as it is. JSON strings hold no newline, so each line is tokenized alone.

import { html } from "htm/preact";
import { Icon } from "./icons.ts";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

function colour(line: string): unknown[] {
  const out: unknown[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    if (m[1]) out.push(m[2] ? html`<span class="json-key">${m[1]}</span><span class="json-punct">${m[2]}</span>` : html`<span class="json-str">${m[1]}</span>`);
    else if (m[3]) out.push(html`<span class="json-lit">${m[3]}</span>`);
    else if (m[4]) out.push(html`<span class="json-num">${m[4]}</span>`);
    else out.push(html`<span class="json-punct">${m[5]}</span>`);
    last = m.index! + m[0].length;
  }
  out.push(line.slice(last));
  return out;
}

/** `text` (a JSON document) in a read-only editor named `name`. */
export function JsonCode(p: { text: string; name?: string; label?: string; class?: string }) {
  const lines = p.text.replace(/\n$/, "").split("\n");
  return html`<div class=${`json-editor ${p.class ?? ""}`} aria-disabled="true">
    <div class="json-bar"><span class="grow">${p.name ?? "JSON"}</span><span class="json-ro"><${Icon} name="lock" size=${12} /> Read-only</span></div>
    <pre class="json" aria-label=${p.label} tabindex="0">${lines.map((l, i) => html`<span class="json-line"><span class="json-ln" aria-hidden="true">${i + 1}</span><span>${colour(l)}</span></span>`)}</pre></div>`;
}
