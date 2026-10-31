// Hair helpers, shared by both hair files. Every crown comes from the head's own outline
// (`Head.crown`), so a style fits every face shape, build and body. A hair part draws on the head
// bone: `hair_back` behind the head (in front view, behind the whole body), `hair_front` over it.
// What hangs below the chin over the chest (plaits, locs, a tail over the shoulder) goes on the
// neck bone and layer `hair_lock`, in the front view only (it sits under the arms and hands).
// Hair has no colours of its own: it is `ctx.hair`; a tie or a bead is `tone(hair, "deep")` until
// the document has an accent colour. Under a hat, `compose` cuts the head pieces to the hat's region
// (`ctx.clip`); a style that would rather tuck in reads it. A style says how far it stands off the
// scalp (`bulk`, `HAIR_BULK`), so hats and coverings can sit on it (`hairBulk`) without naming styles.

import { tone, type BodyDims, type Group, type Item, type PartCtx, type PartDef, type Shape, type Vec2 } from "sahne";
import { headOf, type Head } from "./head.ts";
import { S, strand, named } from "./shapes.ts";

/**
 * Hair bulk presets, adult cm off the scalp over the crown (`PartDef.bulk`): `low` close (a crop,
 * cornrows, braids at the scalp), `mid` a short curly or twisted style, `high` an afro or puffs. A
 * style may give its own number instead (`bulk: 8`). A style that says nothing is `low`.
 */
export const HAIR_BULK = { low: 2.5, mid: 5, high: 9 } as const;

/**
 * The bulk of the hair a character wears, in cm for its build (adult cm × H / 50): what a hat or a
 * covering reads to sit on the hair (a brimmed hat lifts by it, a wrap grows by it). Works from any
 * part's context, the hair's own or a hat's; a hidden hair style still has its bulk.
 */
export function hairBulk(ctx: Pick<PartCtx, "avatar" | "body" | "kit">): number {
  const id = ctx.avatar.hair?.style, p = typeof id === "string" && Object.hasOwn(ctx.kit.parts, id) ? ctx.kit.parts[id] : undefined;
  const v = typeof p?.bulk === "number" && Number.isFinite(p.bulk) ? Math.max(0, p.bulk) : HAIR_BULK.low;
  return v * ctx.body.headH / 50;
}

/** A hair style: its names, and a drawing from the head, the hair colour and the whole context. */
export function hairPart(en: string, tr: string, draw: (h: Head, c: string, ctx: PartCtx) => { front: Item[]; back: Item[] }, rest: Partial<Omit<PartDef, "slot" | "draw">> = {}): PartDef {
  return named("hair", en, tr, { ...rest, draw: ctx => draw(headOf(ctx), ctx.hair, ctx) });
}

/** A hair piece on the head bone. */
export const onHead = (layer: "hair_back" | "hair_front", group: Group): Item => ({ layer, bone: "head", group });

/** A hanging piece (below the chin, over the chest) on the neck bone, layer `hair_lock`: front view only. */
export const onNeck = (group: Group): Item => ({ layer: "hair_lock", bone: "neck", group });

/** A head-space point in the neck bone's frame (for pieces that start on the head and hang on the neck). */
export const headToNeck = (b: BodyDims, [x, y]: Vec2): Vec2 => [x, y - b.neckL];

/** The back of a short or medium style: the crown grown by `v`, down to the nape (`nape`, a fraction of H; `longer` cm more). */
export function backCover(h: Head, c: string, v: number, nape = -0.16, longer = 0): Group {
  const { W, H } = h, top = h.crown(v, Math.PI * 0.98, Math.PI * 2.02, 10);
  return {
    shapes: [
      S([...top, [W / 2 + v * 0.6, -H * 0.3 + longer], [W * 0.3, -H * 0.18 + longer], [0, H * nape + longer], [-W * 0.3, -H * 0.18 + longer], [-W / 2 - v * 0.6, -H * 0.3 + longer]], c),
      strand([[-W * 0.18, -H * 0.9], [-W * 0.08, -H * 0.6], [-W * 0.12, -H * 0.32]], tone(c, "deep"), 0.6, 0.45),
      strand([[W * 0.16, -H * 0.88], [W * 0.1, -H * 0.55], [W * 0.14, -H * 0.3]], tone(c, "deep"), 0.6, 0.45),
    ],
  };
}

/**
 * The front of a short style: the crown grown by `v`, a hairline at `line` (a fraction of H above
 * the chin, 0.73 is the usual) and temples at `temple`, with a light sheen and a strand.
 */
export function shortFront(h: Head, c: string, v: number, line: number, temple: number): Group {
  const { W, H } = h, top = h.crown(v, Math.PI * 1.02, Math.PI * 1.98, 10), side = W / 2 - 0.4;
  return {
    shapes: [
      S([[-side - v * 0.5, -H * 0.44, 0], ...top, [side + v * 0.5, -H * 0.44, 0], [side - 0.6, -H * 0.42, 0],
        [W * 0.36, -H * temple], [W * 0.18, -H * (line + 0.02)], [-W * 0.04, -H * line], [-W * 0.2, -H * (line + 0.05)], [-W * 0.36, -H * temple], [-side + 0.6, -H * 0.42, 0]], c),
      sheen(h, c, v - 1.2),
      strand([[-W * 0.12, -H * 0.97], [-W * 0.02, -H * 0.86], [W * 0.02, -H * (line + 0.05)]], tone(c, "deep"), 0.5, 0.5),
    ],
  };
}

/** The light catching the top of the hair, upper left: a flat arc just inside the crown (on the crown ellipse, `Head.arc`, so it stays inside the hair on every face shape). */
export function sheen(h: Head, c: string, v: number, a0 = 1.25, a1 = 1.62, width = 1.4, opacity = 0.55): Shape {
  return { ...strand(h.arc(v, Math.PI * a0, Math.PI * a1, 5), tone(c, "light"), width, opacity) };
}
