// The kit as galleries (kit/gallery.ts): the items each picker shows. The cast as portraits (`portrait`), the places as
// their wide shots (thumbs.ts), props and set pieces as sketches (`pieceSvg`, sahne-kit/set-svg), emotions as faces on
// the stand-in, gestures as the stand-in caught at the stroke (drawn once, then kept), sounds with their word, played on
// a click (their pictures are their waveforms, drawn when idle). A picker is a gallery in a popover. Each item knows its
// shelf (model/kitgroups.ts), the kit page's categories.

import { signal } from "@preact/signals";
import { html } from "htm/preact";
import { AudioEngine, hashString, portrait, type AvatarDoc } from "sahne";
import { pieceSvg } from "sahne-kit/set-svg";
import { languagesOf, textOf, type CharacterDoc, type StoryPlace } from "sahne-story";
import { EMOTION_SHELVES, PROP_SHELVES, SET_SHELVES, gestureShelf, shelfOf } from "../model/kitgroups.ts";
import { KIT, SOUNDS } from "../stage.ts";
import { emotionScene, emotionThumb, gestureScene, gestureThumb, placeThumb } from "../thumbs.ts";
import { world } from "../store.ts";
import { Gallery, type Item } from "./kit/gallery.ts";
import { Popover } from "./kit/index.ts";
import { useLangs } from "./lang.ts";

const svgOf = (f: () => string) => { try { return f(); } catch { return ""; } };
/** A character's bust (or head) as SVG; "" for one with no avatar (a puppet). */
export const portraitOf = (c: CharacterDoc | undefined, size = 120, framing: "head" | "bust" | "full" = "bust", emotion?: string) =>
  c?.avatar ? svgOf(() => portrait(c.avatar, KIT, { framing, size, trusted: true, ...(emotion ? { emotion } : {}) })) : "";

/** The stand-in's look: who the gesture and emotion pictures show. */
export const model = (): AvatarDoc | undefined => {
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
  const l = languagesOf(w?.series);
  return Object.entries(w?.places ?? {}).map(([id, p]: [string, StoryPlace]) => ({
    id, label: textOf(p.name, l.main, ...l.translations) ?? id, sub: `${l.translations.length ? `${textOf(p.name, ...l.translations) ?? ""} · ` : ""}${w!.episodes.filter(e => e.place === id).length} episodes`, keywords: `${id} ${Object.values(p.name ?? {}).join(" ")} ${p.district ?? ""}`,
    tags: [p.outdoor ? "outdoors" : "indoors"], art: () => placeThumb(p), ...(o.href ? { href: `#/place/${id}` } : {}),
  }));
}

/** The kit's props (or set pieces) as sketches. */
export function pieceItems(which: "props" | "set"): Item[] {
  return Object.entries(KIT[which]).sort(([a], [b]) => a.localeCompare(b)).map(([id, def]) => ({
    id, label: id.replace(/_/g, " "), sub: def.meta?.about, tags: def.meta?.tags, keywords: `${id} ${(def.meta?.terms ?? []).join(" ")} ${(def.meta?.tags ?? []).join(" ")}`,
    shelf: shelfOf(which === "props" ? PROP_SHELVES : SET_SHELVES, def.meta?.tags).id,
    art: async () => svgOf(() => pieceSvg(KIT, def, {}, id, 96)) || null,
  }));
}

export const emotionItems = (): Item[] => Object.keys(KIT.face.emotions).map(e => { const m = model(); return { id: e, label: e, shelf: shelfOf(EMOTION_SHELVES, [e]).id, art: m ? () => emotionThumb(e, m) : null }; });

export const gestureItems = (): Item[] => Object.entries(KIT.gestures).sort(([a], [b]) => a.localeCompare(b)).map(([g, def]) => {
  const m = model();
  return { id: g, label: g.replace(/_/g, " "), sub: def.needs?.length ? `needs a ${def.needs.join(", ")}` : undefined, shelf: gestureShelf(def.needs).id, art: m ? () => gestureThumb(g, m) : null };
});

let engine: AudioEngine | null = null;
const audio = () => engine ??= new AudioEngine(KIT, { sounds: SOUNDS });

/** The sound playing now (a loop plays until it is clicked again or another starts). */
export const soundPlaying = signal<string | null>(null);
let ends: ReturnType<typeof setTimeout> | undefined;

/**
 * Where the playing sound is: it started at `t0` (the audio context's time) from `from` s into its `dur`; a loop goes
 * round between `a` and `b` (the engine starts a loop at a point of its own, and a recording may loop a span of itself).
 */
export interface SoundClock { id: string; t0: number; from: number; dur: number; loop: boolean; a: number; b: number }
export const soundClock = signal<SoundClock | null>(null);

/** Seconds into the playing sound, now. */
export function soundAt(c: SoundClock): number {
  const t = c.from + Math.max(0, (engine?.ctx?.currentTime ?? c.t0) - c.t0);
  return c.loop ? c.a + (t - c.a) % Math.max(1e-3, c.b - c.a) : Math.min(t, c.dur);
}

/** How long a sound lasts, s: its recording where it loads, else its patch. */
export async function soundLength(id: string): Promise<number> {
  const rec = await audio().recording(id);
  return rec ? rec.duration : audio().length(id) / 1000;
}

/** Stop whatever sound is playing. */
export function stopSounds() {
  clearTimeout(ends);
  engine?.ambience([]); engine?.stopAll();
  soundPlaying.value = null;
  soundClock.value = null;
}

/** Play a kit sound, its recording where it has one, else its patch; a click on the loop that is playing stops it. */
export function playSound(id: string) {
  const def = KIT.sounds?.[id];
  if (!def) return;
  const again = soundPlaying.value === id && def.loop;
  stopSounds();
  if (again) return;
  const e = audio();
  e.setEnabled(true);
  const go = async () => {
    // the recording first (or knowing there is none), and a loop's patch rendered, so it starts now and the clock is true
    const rec = await e.recording(id);
    if (soundPlaying.value !== id || !e.ctx) return;
    const dur = rec ? rec.duration : e.length(id) / 1000, t0 = e.ctx.currentTime;
    if (def.loop) {
      if (!rec) e.render(id);
      e.ambience([id], true);
      const [a, b] = (rec && def.recording?.loop) || [0, dur];
      soundClock.value = { id, t0, from: a + (hashString(id) % 1000) / 1000 * (b - a), dur, loop: true, a, b };
    } else {
      e.play(id);
      soundClock.value = { id, t0, from: 0, dur, loop: false, a: 0, b: dur };
      ends = setTimeout(() => { if (soundPlaying.value === id) { soundPlaying.value = null; soundClock.value = null; } }, Math.max(400, dur * 1000));
    }
  };
  soundPlaying.value = id;
  if (e.running) go(); else void e.ctx?.resume().then(go, go);
}

/** Load a sound's recording ahead of a click (the pointer is on its card), so the first click plays it. */
export const warmSound = (id: string) => { void audio().recording(id); };

/** A sound's waveform as SVG (what plays: its recording where it loads, else its patch), drawn when the page is idle. */
const waveQueue: (() => void)[] = [];
let waving = false;
async function waveform(id: string): Promise<string | null> {
  const rec = await audio().recording(id);
  return new Promise(res => {
    waveQueue.push(() => {
      const data = rec ? rec.getChannelData(0) : audio().render(id)?.data;
      if (!data) return res(null);
      const N = 48, step = Math.max(1, Math.floor(data.length / N));
      let peak = 1e-6;
      const amp = Array.from({ length: N }, (_, k) => { let m = 0; for (let i = k * step; i < Math.min(data.length, (k + 1) * step); i += 4) m = Math.max(m, Math.abs(data[i])); peak = Math.max(peak, m); return m; });
      const bars = amp.map((a, k) => { const h = Math.max(1.5, a / peak * 34); return `<rect x="${k * 4 + 1}" y="${(40 - h) / 2}" width="2.4" height="${h.toFixed(1)}" rx="1.2"/>`; }).join("");
      res(`<svg class="wave" viewBox="0 0 194 40" preserveAspectRatio="none" fill="currentColor">${bars}</svg>`);
    });
    if (!waving) pumpWaves();
  });
}
function pumpWaves() {
  waving = waveQueue.length > 0;
  if (!waving) return;
  const next = () => { waveQueue.shift()?.(); pumpWaves(); };
  if ("requestIdleCallback" in window) requestIdleCallback(next, { timeout: 600 }); else setTimeout(next, 16);
}

export function soundItems(main: string): Item[] {
  return Object.entries(KIT.sounds ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => {
    const word = s.word;
    return { id, label: id.replace(/_/g, " "), sub: word ? word[main] ?? word.en : undefined, shelf: s.bus, tags: [s.loop ? "loop" : "one-shot", ...(s.recording ? ["recorded"] : [])], keywords: `${id} ${Object.values(word ?? {}).join(" ")}`, art: () => waveform(id) };
  });
}

/** What a card plays while the pointer rests on it: a gesture or an emotion on the stand-in (live.ts). */
export function liveScene(kind: "gestures" | "emotions", id: string) {
  const m = model();
  return m ? () => (kind === "gestures" ? gestureScene(id, m) : emotionScene(id, m)) : null;
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
