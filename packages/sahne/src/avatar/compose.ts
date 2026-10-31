// compose(): an avatar document plus a kit becomes a puppet — bones and the ordered pieces of
// both views. The slot rules live here and in `rules.ts`, so every kit gets them (DESIGN.md §5.2).

import type { Kit, Item, FaceStyle, PartCtx, PartDef } from "../core/kit.ts";
import type { AvatarDoc, AvatarNote, BodyDims, ViewName } from "../core/types.ts";
import type { Box } from "../core/math.ts";
import type { Path } from "../art/path.ts";
import { clipsOf, type Shape } from "../art/shape.ts";
import { humanoid, type BoneDef } from "../rig/skeleton.ts";
import { normalize } from "./normalize.ts";
import { usesOf, hiddenSlots, type Use } from "./rules.ts";

export interface Puppet {
  /** The normalized document that was composed (the kit's default character when the input was unusable). */
  avatar: AvatarDoc;
  body: BodyDims;
  bones: BoneDef[];
  views: Record<ViewName, Item[]>;
  faceStyle: FaceStyle;
  faceRegion: Box;
  /** The seated side view (`Kit.side`, DESIGN.md §6.3), when the kit draws one: its pieces in draw order and its face's box. */
  side?: { items: Item[]; faceRegion: Box };
  /** What was dropped, replaced, hidden or clipped on the way, for the builder to explain. */
  notes: AvatarNote[];
}

/** The pieces of a part cut to regions: only those on the head bone; a shape with a clip of its own (a print) keeps it and is cut to the regions too. */
const cut = (it: Item, regions: Path[]): Item => {
  if (it.bone !== "head" || !it.group) return it;
  const clip = (s: Shape) => { const all = [...clipsOf(s), ...regions]; return all.length === 1 ? all[0] : all; };
  return { ...it, group: { ...it.group, shapes: it.group.shapes.map(s => ({ ...s, clip: clip(s) })) } };
};

/**
 * Never throws. The document goes through `normalize` first, and an unusable one draws the kit's
 * default character. Then, from the parts' own metadata: hidden slots are not drawn, clipped
 * slots get `ctx.clip` and `Shape.clip` (kit.ts, "Slot rules"; several clipping parts cut to the
 * region inside all of them), and a part's `PartOut.alt` moves
 * the default of those alternatives (a held cane closes the hand).
 *
 * `o.trusted` is false unless you say otherwise, so a document from another learner is safe by
 * default: `#RRGGBB` colours, `custom` parts and parts tagged `cast` are refused. Pass
 * `{ trusted: true }` only for the app's own cast documents; the stage and `portrait` take the same
 * option and pass it on.
 */
export function compose(avatar: AvatarDoc, kit: Kit, o: { trusted?: boolean } = {}): Puppet {
  const notes: AvatarNote[] = [];
  let doc = normalize(avatar, kit, { trusted: o.trusted ?? false, notes });
  if (!doc) { notes.push({ field: "doc", id: "", why: "unknown" }); doc = normalize(kit.defaultDoc, kit, { trusted: true }) ?? kit.defaultDoc; }

  const body = kit.body(doc.body);
  const skin = kit.color(doc.skin, "#D9A47A"), hair = kit.color(doc.hair.color, "#2A1B12");
  const uses = usesOf(doc, kit), hidden = hiddenSlots(uses);
  const active: Use<PartDef>[] = [{ field: "body", id: "", part: kit.base, colors: [], pattern: null, inks: [], side: null }];
  for (const u of uses) {
    const by = hidden.get(u.part.slot);
    if (by === undefined) active.push(u); else notes.push({ field: u.field, id: u.id, why: "hidden", by });
  }

  type Clip = { front: Path; back: Path; by: string };
  /** The parts that clip a slot, in table order: a part of it is cut to all their regions, and reads the last (a hat over a covering's). */
  const ctxOf = (u: Use<PartDef>, clips: Clip[]): PartCtx => {
    const clip = clips.length ? clips[clips.length - 1] : null;
    // the document's colours, then the part's defaults; a colour with neither is left to the part
    const n = Math.max(u.colors.length, u.part.defaults?.length ?? 0), inks = (u.inks ?? []).map(c => kit.color(c));
    return {
      avatar: doc, body, skin, hair, colors: Array.from({ length: n }, (_, i) => kit.color(u.colors[i] ?? u.part.defaults?.[i])),
      pattern: u.pattern, inks, side: u.side ?? null,
      garment: u.id ? { id: u.id, colors: u.colors, pattern: u.pattern, ...(u.inks?.length ? { inks: u.inks } : {}), ...(u.side ? { side: u.side } : {}) } : null,
      kit, clip: clip?.front ?? null, clipBack: clip?.back ?? null,
    };
  };

  const clipAt = new Map<string, Clip[]>();
  for (const u of active) if (u.part.clips) {
    const c = ctxOf(u, []), cl: Clip = { front: u.part.clips.keep(c, "front"), back: u.part.clips.keep(c, "back"), by: u.id };
    for (const s of new Set(u.part.clips.slots)) clipAt.set(s, [...(clipAt.get(s) ?? []), cl]);
  }

  const views: Record<ViewName, Item[]> = { front: [], back: [] }, rest: Record<string, string> = {};
  for (const u of active) {
    const cs = clipAt.get(u.part.slot) ?? [];
    const out = u.part.draw(ctxOf(u, cs));
    for (const c of cs) notes.push({ field: u.field, id: u.id, why: "clipped", by: c.by });
    for (const v of ["front", "back"] as const) for (const it of out[v] ?? []) views[v].push(cs.length ? cut(it, cs.map(c => c[v])) : it);
    for (const [k, val] of Object.entries(out.alt ?? {})) if (!(k in rest) && typeof val === "string") rest[k] = val;
  }
  for (const v of ["front", "back"] as const) {
    const order = kit.layers[v];
    const rank = (it: Item) => { const i = order.indexOf(it.layer); return i < 0 ? order.length : i; };
    // a stable sort keeps the parts' own order inside a layer
    views[v] = views[v].map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i).map(x => x.it);
    // a worn part moves the default alternative (the hand round a cane), where that alternative exists
    for (const [k, val] of Object.entries(rest)) {
      if (!views[v].some(it => it.alt?.key === k && it.alt.value === val)) continue;
      views[v] = views[v].map(it => it.alt?.key === k && (it.alt.default || it.alt.value === val) ? { ...it, alt: { ...it.alt, default: it.alt.value === val } } : it);
    }
  }

  // the side view, from the same parts and colours
  let side: Puppet["side"];
  if (kit.side && kit.face.regionSide) {
    const worn = active.filter(u => u.id).map(u => ({ slot: u.part.slot, id: u.id, part: u.part, colors: ctxOf(u, []).colors }));
    try { side = { items: kit.side({ avatar: doc, body, skin, hair, kit, worn }), faceRegion: kit.face.regionSide(body) }; } catch (e) { console.warn("sahne: no side view", e); }
  }
  return { avatar: doc, body, bones: humanoid(body), views, ...(side ? { side } : {}), faceStyle: kit.face.style(doc, kit), faceRegion: kit.face.region(body), notes };
}
