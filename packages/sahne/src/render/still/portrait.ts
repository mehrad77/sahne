// Portraits (DESIGN.md §10): an avatar document as an SVG string, framed at head, bust or full
// length, cached by the document's content. A list of 50 friends never starts a renderer, only
// asks this for 50 strings. A document that is missing or cannot be drawn gets the neutral paper
// silhouette instead, never an error.

import type { Kit, Item, PartCtx } from "../../core/kit.ts";
import type { ViewName } from "../../core/types.ts";
import { smooth } from "../../art/path.ts";
import { svgPaint } from "../../art/shape.ts";
import { hashString } from "../../core/rng.ts";
import { humanoid } from "../../rig/skeleton.ts";
import { compose } from "../../avatar/compose.ts";
import { normalize, serialize } from "../../avatar/normalize.ts";
import type { Framing } from "../paper/camera.ts";
import { renderSvg, finishSvg, detailOf } from "./render.ts";

export interface PortraitOptions {
  framing?: Framing;
  /** The longer side in px; left out, the SVG scales to its container. */
  size?: number;
  /** The size in px to choose the amount of detail for; by default `size`, or a list's 96 without one. A portrait that a stylesheet sizes but should look sharp large says `detail: 400`. */
  detail?: number;
  /** An emotion of the kit (`happy`); a calm neutral face by default. */
  emotion?: string;
  /** `back` shows the back of the head and the clothes. */
  view?: ViewName;
  /** A `#hex` fill behind the figure. */
  background?: string;
  /** Soft layer shadows and the limb rim; by default they come with the detail (160 and 100 px). */
  shadow?: boolean;
  rim?: boolean;
  /** Whether the document is the app's own (a story's cast): hex colours and the cast's reserved parts are drawn. By default it is not, so a document from another learner can only use the palettes and the learner parts. */
  trusted?: boolean;
  /** Put in front of every id of the picture. Two portraits of the same character on one page (the app bar and the profile) share their ids, which is harmless unless the first is hidden with `display: none`; give each place its own prefix. */
  idPrefix?: string;
  /** What a screen reader says: the picture gets `role="img"` and this as its `aria-label`. */
  label?: string;
}

// ---- the cache -----------------------------------------------------------------------------------
// Bounded by size (the characters of the keys and pictures), not by count: a head is 4 KB and a
// full figure 12, and a list of 450 friends must fit so that the next refresh costs nothing.

const LIMIT = 6_000_000;
let limit = LIMIT, chars = 0;
const cache = new Map<string, string>();

/** The cached value of `key`, made by `make` the first time; the least recently used entries go when the cache is over its size. */
function memo(key: string, make: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) { cache.delete(key); cache.set(key, hit); return hit; }
  const v = make();
  cache.set(key, v);
  chars += key.length + v.length;
  for (const [k, old] of cache) {
    if (chars <= limit || k === key) break;
    cache.delete(k); chars -= k.length + old.length;
  }
  return v;
}

/** Forget every cached picture (tests, or a kit that changed); `max` also sets the size the cache may grow to, in characters. */
export function clearPortraits(max = LIMIT) { cache.clear(); chars = 0; limit = max; }

/** How much the cache holds: pictures, and the characters of them and their keys. */
export const portraitCacheSize = () => ({ entries: cache.size, chars });

// ---- when something goes wrong -----------------------------------------------------------------------

let report: ((error: unknown) => void) | null = null;

/**
 * Called with the error when a portrait cannot be drawn and the silhouette stands in. A bad
 * document never gets here (`normalize` has already made it safe, or refused it); this is a kit that
 * throws, or a face that calls canvas methods the recording context lacks, so every character would
 * look unauthored. Dev builds log it; `null` stops.
 */
export function onPortraitError(fn: ((error: unknown) => void) | null) { report = fn; }

const fail = (e: unknown) => { try { report?.(e); } catch { /* the hook is not allowed to break a portrait */ } };

// ---- portraits ----------------------------------------------------------------------------------------

/** A short id prefix from a key: 53 bits, so two different pictures on a page cannot share one by chance or by design. */
const tag = (key: string) => (4294967296 * (2097151 & hashString("~" + key)) + hashString(key)).toString(36);

const framingOf = (o: PortraitOptions): Framing => o.framing === "bust" || o.framing === "full" ? o.framing : "head";

/**
 * The portrait of a character as an SVG string. `doc` is an avatar document, or anything: a
 * missing, malformed, old-style or hostile one gives `silhouette`. The picture is made once per
 * document (after `normalize`, so two spellings of one character share it), framing, face and
 * level of detail, and cached; the size, `idPrefix` and `label` are put on the string afterwards.
 * Its ids (clip paths, the shadow filter) carry a prefix from that key, so different portraits on
 * one page never collide.
 *
 * A first render takes about half a millisecond: a list of more than 40 documents that are new to
 * the page is better filled in chunks (a frame each) than in one go.
 */
export function portrait(doc: unknown, kit: Kit, o: PortraitOptions = {}): string {
  const framing = framingOf(o), trusted = o.trusted === true, d = detailOf(o), nd = normalize(doc, kit, { trusted });
  if (!nd) return silhouette(kit, o);
  const bg = svgPaint(o.background) ?? "", emotion = typeof o.emotion === "string" && Object.hasOwn(kit.face.emotions, o.emotion) ? o.emotion : "", view = o.view === "back" ? "back" : "front";
  // what `trusted` allowed is in the normalized document already: it is not a part of the key
  const key = [kit.id, framing, emotion, view, bg, d.digits, d.rim, d.shadow, d.small, serialize(nd)].join("|");
  return finishSvg(memo(key, () => {
    try {
      return renderSvg(compose(nd, kit, { trusted }), kit, { framing, face: emotion, view, background: bg, ...d, idPrefix: "p" + tag(key) });
    } catch (e) {
      fail(e);
      return plain(kit, framing, bg, d);
    }
  }), o);
}

// the paper of the placeholder: a warm grey that sits on cream and on dark alike
const PAPER = "#C9BFAF";

/**
 * What lists show before a learner has designed a character: a neutral paper cut-out of an
 * adult in one tone, no face and no clothes, framed like a portrait. It is drawn from the kit's
 * own base body (head, ears, neck, limbs, hands), so it matches the real portraits. It never throws:
 * if the kit cannot draw it, two plain shapes stand in.
 */
export function silhouette(kit: Kit, o: PortraitOptions = {}): string {
  return finishSvg(plain(kit, framingOf(o), svgPaint(o.background) ?? "", detailOf(o)), o);
}

/** The silhouette without its size: cached. */
function plain(kit: Kit, framing: Framing, bg: string, d: { digits: number; rim: boolean; shadow: boolean }): string {
  const key = ["sil", kit.id, framing, bg, d.digits, d.rim, d.shadow].join("|");
  return memo(key, () => {
    try { return draw(kit, framing, bg, d, "z" + tag(key)); } catch (e) { fail(e); return bare(framing, bg); }
  });
}

/** Two shapes, a head and shoulders, for when the kit cannot draw the silhouette. */
function bare(framing: Framing, bg: string): string {
  const tall = framing === "full", w = tall ? 50 : 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 100">` + (bg ? `<rect width="${w}" height="100" fill="${bg}"/>` : "") +
    (tall ? `<circle cx="25" cy="14" r="10" fill="${PAPER}"/><path d="M8 100V36q0-8 8-8h18q8 0 8 8v64z" fill="${PAPER}"/>`
      : `<circle cx="50" cy="40" r="22" fill="${PAPER}"/><path d="M12 100c0-26 16-36 38-36s38 10 38 36z" fill="${PAPER}"/>`) + "</svg>";
}

function draw(kit: Kit, framing: Framing, bg: string, d: { digits: number; rim: boolean; shadow: boolean }, idPrefix: string): string {
  // the part context is the real thing: the kit's default character with the neutral adult body
  const doc = normalize({ ...kit.defaultDoc, body: { build: "adult", height: 0.5, shape: "average" } }, kit, { trusted: true }) ?? kit.defaultDoc;
  const b = kit.body(doc.body), T = b.torsoL, sw = b.shoulderW / 2, ww = b.waistW / 2 + 1, hw = b.hipW / 2 + 1, nw = b.neckW / 2 + 1;
  const ctx: PartCtx = { avatar: doc, body: b, skin: PAPER, hair: PAPER, colors: [], pattern: null, garment: null, kit, clip: null };
  const torso = smooth([[-nw, -T - 0.5, 0], [-(sw - 1), -T + 1.5], [-(sw + 0.5), -T + 6, 0], [-ww - 1, -T * 0.35], [-hw, 6, 0], [0, 9], [hw, 6, 0], [ww + 1, -T * 0.35], [sw + 0.5, -T + 6, 0], [sw - 1, -T + 1.5], [nw, -T - 0.5, 0]], true, 1);
  const mine = (layer: string, bone: string): Item => ({ layer, bone, group: { shapes: [{ path: torso, fill: PAPER }] } });
  const rank = (it: Item) => { const i = kit.layers.front.indexOf(it.layer); return i < 0 ? kit.layers.front.length : i; };
  // one flat tone: the painted shade patches are left out, and the bare head is an egg (the kit's head is shaped for its hair)
  const w = b.headW / 2, H = b.headH, egg = smooth([[0, -H], [w * 0.55, -H * 0.97], [w * 0.88, -H * 0.8], [w, -H * 0.55], [w * 0.9, -H * 0.28], [w * 0.62, -H * 0.08], [w * 0.3, -H * 0.01], [0, 0],
    [-w * 0.3, -H * 0.01], [-w * 0.62, -H * 0.08], [-w * 0.9, -H * 0.28], [-w, -H * 0.55], [-w * 0.88, -H * 0.8], [-w * 0.55, -H * 0.97]], true, 1);
  const flat = (it: Item): Item => it.layer === "head" ? { ...it, group: { shapes: [{ path: egg, fill: PAPER }] } } : it.group ? { ...it, group: { ...it.group, shapes: it.group.shapes.filter(s => !s.flat) } } : it;
  // the base body without its face, and a torso, in the kit's layer order as compose has it
  const front = [...(kit.base.draw(ctx).front ?? []).filter(it => !it.face).map(flat), mine("torso", "spine")].map((it, i) => ({ it, i })).sort((x, y) => rank(x.it) - rank(y.it) || x.i - y.i).map(x => x.it);
  return renderSvg({ body: b, bones: humanoid(b), views: { front, back: front } }, kit, { framing, background: bg, ...d, idPrefix });
}
