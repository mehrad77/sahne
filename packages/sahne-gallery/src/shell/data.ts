// What the gallery shows from disk (data.mjs): serve.mjs reads it on each request (/data/<name>.json), so a
// new place or draft shows after a reload; the static site (build.mjs) has it written once. Each is
// fetched once per page load.

import type { AvatarDoc, PlaceDoc } from "sahne";
import type { CardIndex, CharacterDoc, Needs, StoryDoc } from "sahne-story";
import type { DrawingDoc, VariantDoc } from "sahne-kit/drawing";

/** A planned place of Kumru's STORIES_WORLD.md §2. */
export interface WorldRow { id: string; place: string; district: string; stories: string; notes: string; link: string; placeholder: boolean }
/** A story the gallery plays: the bakkal test scene, then each draft. */
export interface Draft { id: string; fixture?: boolean; story: StoryDoc; characters: Record<string, CharacterDoc> }
/** One row of size.mjs: a bundle's gzip size against its budget. */
export interface Size { name: string; gzip: number; budget: number | null; ok: boolean; warn?: boolean }
/** Kerim's page: her art, moods and CSS section from the kit, and her shadow per theme. */
export interface KerimPage { art: string; head: string; moods: string[]; once: Record<string, number>; land: number; css: string; shadow: { light: string; dark: string } }

/** A generic extra (a character document with `kind: "extra"` in $SAHNE_CONTENT/characters/): its file name and whatever the file holds. */
export interface Extra { file: string; name?: string; avatar?: AvatarDoc; [k: string]: unknown }

/** A doc of the repo (data.mjs DOCS): the sidebar's entry, and one rendered (`/data/docs/<slug>.json`). */
export interface DocEntry { slug: string; title: string; group: string }
export interface Doc extends DocEntry { file: string; html: string; toc: { id: string; depth: number; text: string }[]; source: string }

export interface DataMap {
  places: PlaceDoc[];
  needs: Needs;
  /** The content root's own kit items (kit/), [] when it has none. */
  kit: (DrawingDoc | VariantDoc)[];
  /** The content root's cards, or null without them (the card rules do not run). */
  cards: CardIndex | null;
  catalogue: CataloguePlan;
  world: WorldRow[];
  vocab: [string, string, string][];
  drafts: Draft[];
  /** The cast roster, $SAHNE_CONTENT/characters/<id>.json (every kind but extra), by `order`. */
  cast: CharacterDoc[];
  extras: Extra[];
  sizes: Size[];
  kerim: KerimPage;
  docs: DocEntry[];
}
/** sahne-kit/catalogue/plan.json, as the catalogue reads it. */
export interface CataloguePlan { parts: unknown[]; features: unknown[]; patterns: unknown[]; palettes: Record<string, unknown>; deferred: unknown[] }

/** The kit's recordings, beside the page (the dev server and the static site both serve dist/sounds/). */
export const SOUNDS_URL = typeof document === "undefined" ? "dist/sounds/" : new URL("dist/sounds/", document.baseURI).href;

const cache = new Map<string, Promise<unknown>>();
/** One of the gallery's data files; a failure rejects with the server's message. */
export function data<K extends keyof DataMap>(name: K): Promise<DataMap[K]> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(new URL(`data/${name}.json`, document.baseURI)).then(async r => { if (!r.ok) throw new Error(`/data/${name}.json: ${await r.text()}`); return r.json(); });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p as Promise<DataMap[K]>;
}

/** One doc, rendered (data.mjs `doc`). */
export const doc = (slug: string): Promise<Doc> => {
  const name = `docs/${slug}`;
  let p = cache.get(name);
  if (!p) {
    p = fetch(new URL(`data/${name}.json`, document.baseURI)).then(r => { if (!r.ok) throw new Error(`no doc ${slug}`); return r.json(); });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p as Promise<Doc>;
};

export type { AvatarDoc };
