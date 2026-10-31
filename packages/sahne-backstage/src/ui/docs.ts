// The guides (#/docs/<guide>[/<anchor>], and the side panel's Docs tab): the repo's own READMEs, backstage's and the
// story format's, served as they are (`GET /api/docs`) and drawn here (src/model/markdown.ts), so the help is the same
// text the repo keeps and never a copy of it. The page has the contents beside the guide and a search over both; the
// side panel shows the part about the page you are on (the episode studio's, with its keys, beside an episode), and
// the same search.

import { html } from "htm/preact";
import type { JSX } from "preact";
import { signal } from "@preact/signals";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { api } from "../api.ts";
import { route } from "../store.ts";
import { contents, linkOf, parse, sectionOf, textOf, type Block, type Inline } from "../model/markdown.ts";
import { Icon } from "./kit/index.ts";

interface Guide { id: string; title: string; path: string; blocks: Block[] }

const guides = signal<Guide[] | null>(null);
let loading: Promise<void> | null = null;
/** Both guides, read once. */
function loadGuides() {
  loading ??= (async () => {
    const r = await api.get<{ docs: { id: string; title: string; path: string }[] }>("docs");
    if (r.status !== 200) { guides.value = []; return; }
    const all = await Promise.all(r.docs.map(d => api.get<{ markdown: string }>(`docs/${d.id}`)));
    guides.value = r.docs.map((d, i) => ({ ...d, blocks: parse(all[i].markdown ?? "") }));
  })();
  return loading;
}
const useGuides = () => { useEffect(() => { void loadGuides(); }, []); return guides.value; };

/** The part of a guide about each page. */
const HELP: Record<string, [string, string]> = {
  "": ["backstage", "the-board"], season: ["backstage", "the-board"], episode: ["backstage", "the-episode-studio"], new: ["backstage", "a-new-episode"],
  cast: ["backstage", "the-pages"], character: ["backstage", "a-characters-page"], places: ["backstage", "the-pages"], place: ["backstage", "a-places-page"],
  kit: ["backstage", "the-kit-as-galleries"], review: ["backstage", "review-notes-serverreviewts"], settings: ["backstage", "the-assistant-providers-and-the-budget-serverassistantts-serverai-serversettingsts"],
  agents: ["backstage", "mcp-server-and-agent-edits-servermcpts-serverproposalsts-servereventsts"], docs: ["backstage", "the-studio"],
};

// ---- drawing ------------------------------------------------------------------------------------------------------------

function Words(p: { xs: Inline[]; g: Guide; all: Guide[] }): JSX.Element {
  const link = (to: string, kids: Inline[]) => { const href = linkOf(to, p.g.path, p.all); return html`<a href=${href} target=${href.startsWith("#") ? undefined : "_blank"} rel="noreferrer"><${Words} xs=${kids} g=${p.g} all=${p.all} /></a>`; };
  return html`${p.xs.map(x => x.t === "text" ? x.text : x.t === "code" ? html`<code>${x.text}</code>`
    : x.t === "a" ? link(x.href, x.kids) : x.t === "b" ? html`<b><${Words} xs=${x.kids} g=${p.g} all=${p.all} /></b>` : html`<em><${Words} xs=${x.kids} g=${p.g} all=${p.all} /></em>`)}` as JSX.Element;
}

function Blocks(p: { blocks: Block[]; g: Guide; all: Guide[] }): JSX.Element {
  const w = (xs: Inline[]) => html`<${Words} xs=${xs} g=${p.g} all=${p.all} />`;
  return html`${p.blocks.map(b => {
    switch (b.t) {
      case "h": { const H = `h${Math.min(6, b.level + 1)}`; return html`<${H} id=${`doc-${b.id}`}>${w(b.kids)}</${H}>`; }
      case "p": return html`<p id=${b.lead ? `doc-${b.lead.id}` : undefined}>${w(b.kids)}</p>`;
      case "ul": return html`<ul>${b.items.map(it => html`<li><${Blocks} blocks=${it} g=${p.g} all=${p.all} /></li>`)}</ul>`;
      case "ol": return html`<ol>${b.items.map(it => html`<li><${Blocks} blocks=${it} g=${p.g} all=${p.all} /></li>`)}</ol>`;
      case "code": return html`<pre class="code"><code>${b.text}</code></pre>`;
      case "table": return html`<div class="tablewrap"><table class="grid"><thead><tr>${b.head.map(c => html`<th>${w(c)}</th>`)}</tr></thead><tbody>${b.rows.map(r => html`<tr>${r.map(c => html`<td>${w(c)}</td>`)}</tr>`)}</tbody></table></div>`;
      case "quote": return html`<blockquote><${Blocks} blocks=${b.kids} g=${p.g} all=${p.all} /></blockquote>`;
    }
  })}` as JSX.Element;
}

/** Every part (heading or lead) of the guides whose words have all of the query's, best first. */
function search(all: Guide[], query: string) {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: { g: Guide; id: string; text: string; snippet: string; score: number }[] = [];
  for (const g of all) for (const c of contents(g.blocks)) {
    const body = textOf(sectionOf(g.blocks, c.id)), hay = `${c.text} ${body}`.toLocaleLowerCase();
    if (!words.every(x => hay.includes(x))) continue;
    const at = body.toLocaleLowerCase().indexOf(words[0]);
    hits.push({ g, id: c.id, text: c.text, snippet: body.slice(Math.max(0, at - 50), at + 110).trim(), score: words.filter(x => c.text.toLocaleLowerCase().includes(x)).length * 10 - c.depth - body.length / 20000 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 30);
}

function Results(p: { all: Guide[]; query: string; onPick?(): void }) {
  const hits = useMemo(() => search(p.all, p.query), [p.all, p.query]);
  if (!p.query.trim()) return null;
  if (!hits.length) return html`<p class="note">Nothing in the guides says “${p.query}”.</p>`;
  return html`<ul class="doc-hits">${hits.map(h => html`<li><a href=${`#/docs/${h.g.id}/${h.id}`} onClick=${p.onPick}><b>${h.text}</b> <small class="note">${h.g.title}</small></a><div class="note">…${h.snippet}…</div></li>`)}</ul>`;
}

// ---- the page and the panel ---------------------------------------------------------------------------------------------

export function DocsPage(p: { guide?: string; at?: string }) {
  const all = useGuides(), [query, setQuery] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const g = all?.find(x => x.id === (p.guide ?? "backstage")) ?? all?.[0];
  useEffect(() => {
    if (!g) return;
    const el = p.at ? document.getElementById(`doc-${p.at}`) : null;
    if (el) el.scrollIntoView({ block: "start" }); else body.current?.scrollIntoView({ block: "start" });
  }, [g, p.at]);
  if (!all) return html`<p class="note">Opening the guides…</p>`;
  if (!g) return html`<p class="note">No guides here.</p>`;
  const toc = contents(g.blocks);
  return html`<section class="docs">
    <aside class="doc-side">
      <input type="search" placeholder="Search the guides" aria-label="Search the guides" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} />
      ${query.trim() ? html`<${Results} all=${all} query=${query} onPick=${() => setQuery("")} />` : html`
      <nav class="tabs" role="tablist">${all.map(x => html`<a role="tab" aria-selected=${x.id === g.id} href=${`#/docs/${x.id}`}>${x.title}</a>`)}</nav>
      <ol class="toc">${toc.map(c => html`<li class=${`d${c.depth}`}><a href=${`#/docs/${g.id}/${c.id}`} aria-current=${p.at === c.id ? "true" : undefined}>${c.text}</a></li>`)}</ol>`}
      <p class="note">The guides are the repo's own <code>${g.path}</code>, as it is in this checkout.</p>
    </aside>
    <article class="doc" ref=${body}><${Blocks} blocks=${g.blocks} g=${g} all=${all} /></article>
  </section>`;
}

/** The side panel's Docs tab: the part about this page, and a search. */
export function DocsPanel() {
  const all = useGuides(), [query, setQuery] = useState("");
  if (!all) return html`<p class="note">Opening the guides…</p>`;
  const [page] = route.value, [gid, id] = HELP[page ?? ""] ?? HELP[""];
  const g = all.find(x => x.id === gid);
  const part = g ? sectionOf(g.blocks, id) : [];
  const title = part[0]?.t === "h" ? part[0].text : part[0]?.t === "p" ? part[0].lead?.text : undefined;
  return html`<div class="side-docs">
    <input type="search" placeholder="Search the guides" aria-label="Search the guides" value=${query} onInput=${(e: Event) => setQuery((e.target as HTMLInputElement).value)} />
    ${query.trim() ? html`<${Results} all=${all} query=${query} />` : g && part.length ? html`
      <div class="row"><b class="grow">About this page${title ? `: ${title}` : ""}</b><a class="small" href=${`#/docs/${g.id}/${id}`}><${Icon} name="book" size=${14} /> Open the guide</a></div>
      <article class="doc"><${Blocks} blocks=${part} g=${g} all=${all} /></article>` : html`<p class="note">No guide part for this page. <a href="#/docs">The guides</a></p>`}
  </div>`;
}

