// The kit as galleries (kit/gallery.ts): the items each picker shows. The cast as portraits (`portrait`), the places as
// their wide shots (thumbs.ts), props and set pieces as sketches (`pieceSvg`, sahne-kit/set-svg), emotions as faces on
// the stand-in, gestures as the stand-in caught at the stroke (drawn once, then kept), sounds with their word, played on
// a click. A picker is a gallery in a popover.

import { html } from "htm/preact";
import { portrait, type AvatarDoc } from "sahne";
import { pieceSvg } from "sahne-kit/set-svg";
import { textOf, type CharacterDoc, type StoryPlace } from "sahne-story";
import { KIT } from "../stage.ts";
import { gestureThumb, placeThumb } from "../thumbs.ts";
import { world } from "../store.ts";
import { Gallery, type Item } from "./kit/gallery.ts";
import { Popover } from "./kit/index.ts";
import { useLangs } from "./lang.ts";

const svgOf = (f: () => string) => { try { return f(); } catch { return ""; } };
/** A character's bust (or head) as SVG; "" for one with no avatar (a puppet). */
export const portraitOf = (c: CharacterDoc | undefined, size = 120, framing: "head" | "bust" | "full" = "bust", emotion?: string) =>
  c?.avatar ? svgOf(() => portrait(c.avatar, KIT, { framing, size, trusted: true, ...(emotion ? { emotion } : {}) })) : "";

/** The stand-in's look: who the gesture and emotion pictures show. */
const model = (): AvatarDoc | undefined => {
  const w = world.value;
  return (w?.characters[w.series?.standin ?? "nima"] ?? Object.values(w?.characters ?? {}).find(c => c.avatar))?.avatar;
};

export function characterItems(o: { main: string; ids?: string[]; href?: boolean; faded?: (c: CharacterDoc) => boolean } = { main: "tr" }): Item[] {
  const all = Object.values(world.value?.characters ?? {}).filter(c => !o.ids || o.ids.includes(c.id)).sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999));
  return all.map(c => ({
    id: c.id, label: textOf(c.name, o.main) ?? c.id, sub: textOf(c.role, "en") ?? c.kind, tags: [c.kind === "extra" ? "extras" : c.kind === "cast" ? "cast" : c.kind],
    keywords: `${c.id} ${Object.values(c.name ?? {}).join(" ")}`, art: portraitOf(c) || null, ...(o.href ? { href: `#/character/${c.id}` } : {}), faded: o.faded?.(c),
  }));
}

export function placeItems(o: { href?: boolean } = {}): Item[] {
  const w = world.value;
  return Object.entries(w?.places ?? {}).map(([id, p]: [string, StoryPlace]) => ({
    id, label: textOf(p.name, "en") ?? id, sub: `${textOf(p.name, "tr") ?? ""} · ${w!.episodes.filter(e => e.place === id).length} episodes`, keywords: `${id} ${Object.values(p.name ?? {}).join(" ")} ${p.district ?? ""}`,
    tags: [p.outdoor ? "outdoors" : "indoors"], art: () => placeThumb(p), ...(o.href ? { href: `#/place/${id}` } : {}),
  }));
}

/** The kit's props (or set pieces) as sketches. */
export function pieceItems(which: "props" | "set"): Item[] {
  return Object.entries(KIT[which]).sort(([a], [b]) => a.localeCompare(b)).map(([id, def]) => ({
    id, label: id.replace(/_/g, " "), sub: def.meta?.about, tags: def.meta?.tags?.slice(0, 2), keywords: `${id} ${(def.meta?.terms ?? []).join(" ")}`,
    art: svgOf(() => pieceSvg(KIT, def, {}, id, 96)) || null,
  }));
}

export const emotionItems = (): Item[] => Object.keys(KIT.face.emotions).map(e => ({ id: e, label: e, art: svgOf(() => { const m = model(); return m ? portrait(m, KIT, { framing: "head", size: 88, emotion: e, trusted: true }) : ""; }) || null }));

export const gestureItems = (): Item[] => Object.entries(KIT.gestures).sort(([a], [b]) => a.localeCompare(b)).map(([g, def]) => {
  const m = model();
  return { id: g, label: g.replace(/_/g, " "), sub: def.needs?.length ? `needs a ${def.needs.join(", ")}` : undefined, tags: def.needs?.includes("target") ? ["at something"] : ["on its own"], art: m ? () => gestureThumb(g, m) : null };
});

const SPEAKER = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>`;
export function soundItems(main: string): Item[] {
  return Object.entries(KIT.sounds ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => {
    const word = (s as { word?: Record<string, string> }).word;
    return { id, label: id.replace(/_/g, " "), sub: word ? word[main] ?? word.en : undefined, tags: [(s as { bus?: string }).bus ?? "sfx"], art: SPEAKER };
  });
}

let playing: HTMLAudioElement | null = null;
/** Play a kit sound (the server serves the recordings). */
export function playSound(id: string) {
  playing?.pause();
  playing = new Audio(`/sounds/${id}.m4a`);
  void playing.play().catch(() => { /* a synthesized sound has no recording */ });
}

export type PickKind = "character" | "place" | "prop" | "piece" | "gesture" | "emotion" | "sound";

/** A gallery of one kind in a popover at a point: a pick calls `onPick` (and, for a sound, plays it). */
export function Picker(p: { kind: PickKind; x: number; y: number; value?: string[]; ids?: string[]; multi?: boolean; onPick(id: string): void; onClose(): void }) {
  const { main } = useLangs();
  const items = p.kind === "character" ? characterItems({ main, ids: p.ids }) : p.kind === "place" ? placeItems() : p.kind === "prop" ? pieceItems("props") : p.kind === "piece" ? pieceItems("set")
    : p.kind === "gesture" ? gestureItems() : p.kind === "emotion" ? emotionItems() : soundItems(main);
  const pick = (id: string) => { if (p.kind === "sound") playSound(id); p.onPick(id); if (!p.multi && p.kind !== "sound") p.onClose(); };
  return html`<${Popover} x=${p.x} y=${p.y} onClose=${p.onClose} label=${`Pick a ${p.kind}`}>
    <div style="width:min(400px,86vw)"><${Gallery} items=${items} value=${p.value} onPick=${pick} multi=${p.multi} size="s" label=${`${p.kind}s`} searchable=${items.length > 6} /></div>
  </${Popover}>`;
}
