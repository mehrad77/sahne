// A gallery: cards with a picture, a name and a line under it, a search box and tag filters over them. Every picker in
// the studio is one (the cast, the places, props, gestures, emotions, sounds; ui/galleries.ts makes their items), and so
// are the Cast and Places pages. A picture is an SVG string, an image URL, or one drawn later (a promise: the card shows a
// placeholder until it lands, and is asked for only once the card nears the screen). One card or several can be picked; a
// card can instead be a link. `Tile` is one card, for pages that lay cards out themselves (the kit page).

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { search } from "../../model/search.ts";

export type Art = string | { url: string } | (() => Promise<string | null>) | null;

export interface Item {
  id: string;
  label: string;
  sub?: string;
  tags?: string[];
  keywords?: string;
  art?: Art;
  /** A link instead of a pick. */
  href?: string;
  /** Text direction and language of the label. */
  lang?: string;
  dir?: string;
  /** Shown faded: there, but not the right thing here (a character not in the episode). */
  faded?: boolean;
  /** Its category (the kit page's shelves, model/kitgroups.ts). */
  shelf?: string;
}

/** Ask for lazy pictures only near the screen: one observer for every card. */
const waiting = new Map<Element, () => void>();
const seen = typeof IntersectionObserver === "function" ? new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { const go = waiting.get(e.target); waiting.delete(e.target); seen!.unobserve(e.target); go?.(); }
}, { rootMargin: "400px" }) : null;

/** A card's picture. */
export function Picture(p: { art?: Art; label: string }) {
  const lazy = typeof p.art === "function" ? p.art : null;
  const [url, setUrl] = useState<string | null>(typeof p.art === "object" && p.art ? p.art.url : null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lazy) return;
    let live = true;
    const go = () => void lazy().then(u => { if (live) setUrl(u); });
    const el = ref.current;
    if (seen && el) { waiting.set(el, go); seen.observe(el); } else go();
    return () => { live = false; if (el) { waiting.delete(el); seen?.unobserve(el); } };
  }, [p.art]);
  if (typeof p.art === "string") return html`<div class="art" dangerouslySetInnerHTML=${{ __html: p.art }}></div>`;
  // what a lazy picture gives is SVG markup or an image URL
  if (url?.startsWith("<")) return html`<div class="art" dangerouslySetInnerHTML=${{ __html: url }}></div>`;
  if (url) return html`<div class="art"><img src=${url} alt="" loading="lazy" /></div>`;
  return html`<div class="art blank" aria-hidden="true" ref=${ref}>${lazy ? "…" : p.label.slice(0, 1)}</div>`;
}

/** One card: a link, or a button that picks. `onHover` hears the pointer come (with the card's picture) and go. */
export function Tile(p: { item: Item; on?: boolean; playing?: boolean; onPick?(id: string): void; onHover?(id: string, art: HTMLElement | null): void }) {
  const i = p.item;
  const body = html`<${Picture} art=${i.art} label=${i.label} /><b lang=${i.lang} dir=${i.dir}>${i.label}</b>${i.sub && html`<small>${i.sub}</small>`}`;
  if (i.href) return html`<a class=${`tile${i.faded ? " faded" : ""}`} href=${i.href} role="listitem">${body}</a>`;
  const hover = p.onHover && {
    onPointerEnter: (e: PointerEvent) => p.onHover!(i.id, (e.currentTarget as HTMLElement).querySelector(".art")),
    onPointerLeave: () => p.onHover!(i.id, null),
  };
  return html`<button class=${`tile${p.on ? " on" : ""}${p.playing ? " playing" : ""}${i.faded ? " faded" : ""}`} role="option" aria-selected=${!!p.on} onClick=${() => p.onPick?.(i.id)} title=${i.sub ? `${i.label}: ${i.sub}` : i.label} ...${hover ?? {}}>${body}${p.on && html`<span class="tick" aria-hidden="true">✓</span>`}</button>`;
}

export function Gallery(p: {
  items: Item[];
  /** Picked ids. */
  value?: string[];
  onPick?(id: string): void;
  multi?: boolean;
  /** Card size: a picker in a popover is small. */
  size?: "s" | "m" | "l";
  searchable?: boolean;
  label: string;
  empty?: string;
}) {
  const [q, setQ] = useState(""), [tag, setTag] = useState<string | null>(null);
  const tags = [...new Set(p.items.flatMap(i => i.tags ?? []))].sort();
  const shown = search(p.items.filter(i => !tag || i.tags?.includes(tag)), q, 1000);
  const picked = new Set(p.value ?? []);
  return html`<div class=${`gallery ${p.size ?? "m"}`}>
    ${(p.searchable ?? p.items.length > 8) && html`<div class="gallery-bar">
      <input type="search" value=${q} placeholder=${`Search ${p.label.toLowerCase()}…`} aria-label=${`Search ${p.label}`} onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} />
      ${tags.length > 1 && tags.length < 24 && html`<div class="tags" role="group" aria-label="Filter">${tags.map(t => html`<button class=${`chip${tag === t ? " on" : ""}`} aria-pressed=${tag === t} onClick=${() => setTag(tag === t ? null : t)}>${t}</button>`)}</div>`}
    </div>`}
    <div class="grid" role=${p.onPick ? "listbox" : "list"} aria-label=${p.label} aria-multiselectable=${p.multi ? "true" : undefined}>
      ${shown.map(i => html`<${Tile} key=${i.id} item=${i} on=${picked.has(i.id)} onPick=${p.onPick} />`)}
    </div>
    ${!shown.length && html`<p class="note">${q ? `Nothing matches “${q}”.` : p.empty ?? "Nothing here yet."}</p>`}
  </div>`;
}
