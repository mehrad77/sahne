// The kit (#/kit/<section>/<shelf>): what a scene can be staged with, laid out as a library. On the left the sections
// (props, set pieces, gestures, emotions, sounds) and the shelves of the one open (model/kitgroups.ts), with counts; over
// the cards a search of the section, its tags as filters and the card size. With no shelf and no search, each shelf shows
// its first row and a way to the rest; otherwise the cards come in pages as the list scrolls. A click opens a card's
// details (its id, what it is, its parameters); a sound also plays (a loop until clicked again). Gestures and emotions
// play on the stand-in while the pointer rests on them (live.ts). The same items are the pickers of the script and stage.

import { html } from "htm/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { search } from "../model/search.ts";
import { EMOTION_SHELVES, GESTURE_SHELVES, PROP_SHELVES, SERIES_SHELF, SET_SHELVES, SOUND_SHELVES, shelvesWith, type Shelf } from "../model/kitgroups.ts";
import { kitVersion } from "../kitdocs.ts";
import { liveOff, liveOn } from "../live.ts";
import { KIT } from "../stage.ts";
import { route, say } from "../store.ts";
import { Icon } from "./kit/index.ts";
import { Picture, Tile, type Item } from "./kit/gallery.ts";
import { emotionItems, gestureItems, liveScene, pieceItems, playSound, soundAt, soundClock, soundItems, soundLength, soundPlaying, stopSounds, warmSound } from "./galleries.ts";
import { useLangs } from "./lang.ts";

type Section = "props" | "set" | "gestures" | "emotions" | "sounds";
const SECTIONS: [Section, string, string, readonly Shelf[], string][] = [
  ["props", "Props", "prop", [SERIES_SHELF, ...PROP_SHELVES], "box"], ["set", "Set pieces", "set piece", [SERIES_SHELF, ...SET_SHELVES], "stage"], ["gestures", "Gestures", "gesture", GESTURE_SHELVES, "hand"],
  ["emotions", "Emotions", "emotion", EMOTION_SHELVES, "face"], ["sounds", "Sounds", "sound", SOUND_SHELVES, "sound"],
];
/** Cards a shelf shows in the overview, and cards per page when listing. */
const ROW = 12, PAGE = 96;
const SIZE_KEY = "backstage-kit-size", NARROW_KEY = "backstage-kit-narrow";

export function KitPage() {
  const r = route.value;
  const section = (SECTIONS.some(s => s[0] === r[1]) ? r[1] : "props") as Section, shelfId = r[2] ?? null;
  const [, label, one, shelves] = SECTIONS.find(s => s[0] === section)!;
  const { main } = useLangs();
  const all = useMemo(() => Object.fromEntries(SECTIONS.map(([s]) => [s, s === "props" || s === "set" ? pieceItems(s) : s === "gestures" ? gestureItems() : s === "emotions" ? emotionItems() : soundItems(main)])) as Record<Section, Item[]>, [main, kitVersion.value]);
  const items = all[section];
  const [q, setQ] = useState(""), [tag, setTag] = useState<string | null>(null), [open, setOpen] = useState<string | null>(null);
  const [size, setSize] = useState<"s" | "m" | "l">(() => { try { return (localStorage.getItem(SIZE_KEY) as "s" | "m" | "l") || "m"; } catch { return "m"; } });
  const [limit, setLimit] = useState(PAGE);
  // the side folds to its icons (remembered)
  const [narrow, setNarrow] = useState(() => { try { return localStorage.getItem(NARROW_KEY) === "1"; } catch { return false; } });
  const toggleSide = () => { setNarrow(!narrow); try { localStorage.setItem(NARROW_KEY, narrow ? "0" : "1"); } catch { /* a private window */ } };
  // a new section or shelf starts afresh; leaving the page stops what plays
  useEffect(() => { setTag(null); setOpen(null); setLimit(PAGE); liveOff(); }, [section, shelfId]);
  useEffect(() => { setQ(""); stopSounds(); }, [section]);
  useEffect(() => () => { stopSounds(); liveOff(); }, []);
  const pickSize = (s: "s" | "m" | "l") => { setSize(s); try { localStorage.setItem(SIZE_KEY, s); } catch { /* a private window */ } };

  const onShelf = shelfId ? items.filter(i => i.shelf === shelfId) : items;
  const tagged = tag ? onShelf.filter(i => i.tags?.includes(tag)) : onShelf;
  const shown = search(tagged, q, Infinity);
  const counts = shelvesWith(shelves, items, i => i.shelf ?? "other");
  // the tags of what is on the shelf, the commonest first, as filters
  const tagCounts = new Map<string, number>();
  for (const i of onShelf) for (const t of i.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const facets = [...tagCounts].filter(([t, n]) => n > 1 && n < onShelf.length && t !== shelfId).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18);
  const overview = !shelfId && !q && !tag && counts.length > 1;

  const playing = soundPlaying.value;
  const pick = (id: string) => { if (section === "sounds") playSound(id); setOpen(id); };
  const hover = section === "gestures" || section === "emotions"
    ? (id: string, art: HTMLElement | null) => { const s = art && liveScene(section, id); if (art && s) liveOn(art, s); else liveOff(); }
    : section === "sounds" ? (id: string, art: HTMLElement | null) => { if (art) warmSound(id); } : undefined;
  const tile = (i: Item) => html`<${Tile} key=${i.id} item=${i} on=${open === i.id} playing=${playing === i.id} onPick=${pick} onHover=${hover} />`;

  // the next page arrives as the end of the list comes near
  const more = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = more.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setLimit(l => l + PAGE); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length > limit, section, shelfId]);

  const detail = open ? items.find(i => i.id === open) : undefined;
  return html`<section class="kitlib">
    <div class="pagehead"><h2 class="grow">The kit</h2><span class="note">What a scene is staged with: ${SECTIONS.map(([s, l]) => `${all[s].length} ${l.toLowerCase()}`).join(", ")}.</span></div>
    <div class=${`kitlib-body${narrow ? " narrow" : ""}`}>
      <nav class="kitlib-side" aria-label="Kit sections">
        <button class="iconbtn fold" aria-expanded=${!narrow} aria-controls="kit-side-list" onClick=${toggleSide} title=${narrow ? "Show the sections" : "Fold the sections to icons"} aria-label=${narrow ? "Show the sections" : "Fold the sections to icons"}><${Icon} name="panel" size=${17} /></button>
        <div id="kit-side-list" class="kitlib-secs">${SECTIONS.map(([s, l, , , icon]) => html`<div class=${`kitlib-sec${section === s ? " here" : ""}`}>
          <a href=${`#/kit/${s}`} aria-current=${section === s && !shelfId ? "page" : undefined} title=${narrow ? `${l} (${all[s].length})` : undefined} aria-label=${narrow ? `${l}, ${all[s].length}` : undefined}><${Icon} name=${icon} size=${17} /><span>${l}</span><small>${all[s].length}</small></a>
          ${section === s && !narrow && counts.length > 1 && html`<ul>${counts.map(({ shelf, n }) => html`<li><a href=${`#/kit/${s}/${shelf.id}`} aria-current=${shelfId === shelf.id ? "page" : undefined}><span>${shelf.label}</span><small>${n}</small></a></li>`)}</ul>`}
        </div>`)}</div>
        ${counts.length > 1 && html`<ul class="kitlib-row" aria-label=${`${label}: shelves`}>
          <li><a href=${`#/kit/${section}`} aria-current=${!shelfId ? "page" : undefined}>All</a></li>
          ${counts.map(({ shelf, n }) => html`<li><a href=${`#/kit/${section}/${shelf.id}`} aria-current=${shelfId === shelf.id ? "page" : undefined}>${shelf.label} <small>${n}</small></a></li>`)}
        </ul>`}
      </nav>
      <div class="kitlib-main">
        <div class="kitlib-bar">
          <div class="kitlib-crumbs"><a href=${`#/kit/${section}`}>${label}</a>${shelfId && html` › <b>${[...shelves].find(s => s.id === shelfId)?.label ?? "Other"}</b>`}${tag && html` › <button class="chip on" onClick=${() => setTag(null)} title="Clear the filter">${tag} ✕</button>`}
            <span class="note">${shown.length} ${shown.length === 1 ? one : `${one}s`}</span></div>
          <div class="kitlib-tools">
            <input type="search" value=${q} placeholder=${`Search ${shelfId ? "this shelf" : `${items.length} ${label.toLowerCase()}`}…`} aria-label=${`Search ${label}`} onInput=${(e: Event) => { setQ((e.target as HTMLInputElement).value); setLimit(PAGE); }} />
            <div class="seg" role="group" aria-label="Card size">${(["s", "m", "l"] as const).map(s => html`<button aria-pressed=${size === s} onClick=${() => pickSize(s)} title=${{ s: "Small cards", m: "Medium cards", l: "Large cards" }[s]}>${s.toUpperCase()}</button>`)}</div>
          </div>
          ${facets.length > 0 && html`<div class="tags" role="group" aria-label="Filter by tag">${facets.map(([t, n]) => html`<button class=${`chip${tag === t ? " on" : ""}`} aria-pressed=${tag === t} onClick=${() => setTag(tag === t ? null : t)}>${t} <small>${n}</small></button>`)}</div>`}
        </div>
        <div class=${`gallery ${size}`} onPointerLeave=${() => liveOff()}>
          ${overview
            ? counts.map(({ shelf, n }) => html`<div class="kitlib-shelf">
                <h3><a href=${`#/kit/${section}/${shelf.id}`}>${shelf.label}</a><small>${n}</small>${n > ROW && html`<a class="all" href=${`#/kit/${section}/${shelf.id}`}>See all ${n} ›</a>`}</h3>
                <div class="grid" role="listbox" aria-label=${shelf.label}>${items.filter(i => (i.shelf ?? "other") === shelf.id).slice(0, ROW).map(tile)}</div>
              </div>`)
            : html`<div class="grid" role="listbox" aria-label=${label}>${shown.slice(0, limit).map(tile)}</div>
              ${shown.length > limit && html`<div ref=${more} class="note kitlib-more">Loading more…</div>`}
              ${!shown.length && html`<p class="note">${q ? `Nothing matches “${q}”.` : "Nothing here yet."}</p>`}`}
        </div>
      </div>
      ${detail && html`<${Detail} key=${detail.id} section=${section} item=${detail} playing=${playing === detail.id} onTag=${(t: string) => { setTag(t); setQ(""); }} onClose=${() => setOpen(null)} />`}
    </div>
  </section>`;
}

interface Param { type: string; default?: unknown; about?: string; values?: string[]; min?: number; max?: number }

/** A card's details: a bigger picture, its id to copy, what it is, its tags and its parameters. */
function Detail(p: { section: Section; item: Item; playing: boolean; onTag(t: string): void; onClose(): void }) {
  const { item: i, section } = p;
  const def = section === "props" || section === "set" ? KIT[section][i.id] : undefined;
  const params = Object.entries((def?.meta?.params ?? {}) as Record<string, Param>);
  const gesture = section === "gestures" ? KIT.gestures[i.id] : undefined;
  const sound = section === "sounds" ? KIT.sounds?.[i.id] : undefined;
  const copy = () => { void navigator.clipboard?.writeText(i.id).then(() => say(`Copied “${i.id}”`)); };
  const rows: [string, unknown][] = gesture ? [["Lasts", `${(gesture.dur / 1000).toFixed(1)} s`], ["Needs", gesture.needs?.join(", ") || "nothing"]]
    : sound ? [["Bus", sound.bus], ["Kind", sound.loop ? "a loop" : "a one-shot"], ["Takes", sound.takes ?? 1], ["Recording", sound.recording ? "yes (the patch is its fallback)" : "no, synthesized"], ...Object.entries(sound.word ?? {}).map(([l, w]) => [`Word (${l})`, w] as [string, string])]
    : [];
  return html`<aside class="kitlib-detail" aria-label=${`${i.label}: details`}>
    <header><b>${i.label}</b><button class="iconbtn" onClick=${p.onClose} aria-label="Close"><${Icon} name="close" /></button></header>
    <div class="tile big"><${Picture} art=${i.art} label=${i.label} />${section === "sounds" && html`<${Playhead} id=${i.id} />`}</div>
    ${section === "sounds" && html`<div class="kitlib-play"><button class="primary" onClick=${() => playSound(i.id)}><${Icon} name=${p.playing ? "pause" : "play"} size=${16} /> ${p.playing ? "Stop" : "Play"}</button><${Elapsed} id=${i.id} /></div>`}
    <div class="kitlib-id"><code>${i.id}</code><button class="iconbtn" onClick=${copy} title="Copy the id" aria-label="Copy the id"><${Icon} name="copy" size=${16} /></button></div>
    ${def?.meta?.about && html`<p>${def.meta.about}</p>`}
    ${i.tags?.length && section !== "sounds" ? html`<div class="tags">${i.tags.map(t => html`<button class="chip" onClick=${() => p.onTag(t)}>${t}</button>`)}</div>` : ""}
    ${def?.meta?.terms?.length && html`<p class="note">Also called: ${def.meta.terms.join(", ")}</p>`}
    ${rows.length > 0 && html`<dl>${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${String(v)}</dd>`)}</dl>`}
    ${params.length > 0 && html`<h4>Parameters</h4><table class="grid params"><tbody>${params.map(([k, d]) => html`<tr>
      <td><code>${k}</code></td><td><span class="note">${d.type}${d.values ? `: ${d.values.join(" | ")}` : ""}${d.default !== undefined ? ` = ${JSON.stringify(d.default)}` : ""}</span>${d.about && html`<div>${d.about}</div>`}</td>
    </tr>`)}</tbody></table>`}
  </aside>`;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor(s * 10 % 10)}`;

/** Each frame while `id` plays: where it is (s) and how long it lasts; null when it is not playing. */
function usePlayhead(id: string): { at: number; dur: number } | null {
  const c = soundClock.value?.id === id ? soundClock.value : null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!c) return;
    let raf = 0;
    const step = () => { tick(n => n + 1); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [c]);
  return c ? { at: soundAt(c), dur: c.dur } : null;
}

/** The playhead over a sound's waveform, and what of it has played. */
function Playhead(p: { id: string }) {
  const h = usePlayhead(p.id);
  if (!h) return null;
  const pct = `${Math.min(100, h.at / Math.max(1e-3, h.dur) * 100)}%`;
  return html`<div class="playhead" aria-hidden="true"><div class="played" style=${{ width: pct }}></div><div class="head" style=${{ left: pct }}></div></div>`;
}

/** The time into a sound and its length ("0:01.2 / 0:04.0"). */
function Elapsed(p: { id: string }) {
  const h = usePlayhead(p.id);
  const [dur, setDur] = useState<number | null>(null);
  useEffect(() => { let live = true; void soundLength(p.id).then(d => { if (live) setDur(d); }); return () => { live = false; }; }, [p.id]);
  const total = h?.dur ?? dur;
  return html`<span class="elapsed">${clock(h?.at ?? 0)}${total != null ? ` / ${clock(total)}` : ""}${KIT.sounds?.[p.id]?.loop ? " ⟳" : ""}</span>`;
}
