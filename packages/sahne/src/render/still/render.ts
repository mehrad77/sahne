// The still backend (DESIGN.md §4.2, §10): a composed puppet as an SVG string. The same pieces
// the paper backend rasterises are drawn as vectors: groups through `groupSvg` inside their
// bone's transform, limb strips through `rig/strip.ts`, and the face by running the kit's own
// canvas drawing against a recording context. Used for portraits, story tiles, Still motion and
// the fallback without WebGL2.

import type { Item, Kit } from "../../core/kit.ts";
import type { BodyDims, ViewName } from "../../core/types.ts";
import { apply, type Affine, type Box, type Vec2 } from "../../core/math.ts";
import { mix } from "../../core/color.ts";
import { solve, restPose, ARM_BONE, type PoseState } from "../../rig/skeleton.ts";
import { stripJoints, stripGeometry, stripOutline, stripSlice, stripeSpans, stripeDuty, type StripGeom } from "../../rig/strip.ts";
import { faceFrom, type FaceParams } from "../../face/params.ts";
import { groupBounds, groupSvg, shadowFilter, svgId, svgPaint, SVG_BASE, type Tile } from "../../art/shape.ts";
import { poly, svgNums, svgList, type Path } from "../../art/path.ts";
import type { Puppet } from "../../avatar/compose.ts";
import type { Framing } from "../paper/camera.ts";
import { SvgContext } from "./recorder.ts";

/** What the still backend needs of a puppet; a figure with no face (the silhouette) leaves the face fields out. */
export type Figure = Pick<Puppet, "body" | "bones" | "views"> & Partial<Pick<Puppet, "faceStyle" | "faceRegion">>;

export interface StillOptions {
  /**
   * How much of the figure a picture shows: the head with a little neck, head to mid-chest, or the
   * whole figure. These are crops of a fixed shape (head and bust are square, tight on the face for a
   * list avatar); the paper stage's `figureBox` frames the same three words for a live canvas of any
   * shape, and its bust is wider and taller (to the belt), so a builder preview and a portrait of
   * one character are not the same crop.
   */
  framing: Framing;
  view?: ViewName;
  /** A pose to draw (a key pose for Still motion); the rest pose by default. */
  pose?: PoseState;
  /** An emotion of the kit (`happy`) or explicit face parameters; neutral by default. */
  face?: string | FaceParams;
  /** Which alternative to draw where an item has several (the hand shapes, `hand_l: "point"`); the default one otherwise. */
  alt?: Record<string, string>;
  /** The longer side of the picture in px, for its `width` and `height`; left out, the SVG scales to its container. */
  size?: number;
  /** The size in px to choose the amount of detail for (default `size`, or 96 without one: a list). One decimal up to 160 px, two above. */
  detail?: number;
  /** Decimals of the coordinates, 0 … 3; by default from `detail`. */
  digits?: number;
  /** Starts every id in the SVG (clip paths, the shadow filter); make it unique per picture on a page. */
  idPrefix?: string;
  /** A fill behind the figure, `#hex`. */
  background?: string;
  /** The paper's soft layer shadows (an SVG filter per layer); by default from a `detail` of 160 px. */
  shadow?: boolean;
  /** The light rim along limbs and sleeves; by default from a `detail` of 100 px. */
  rim?: boolean;
  /** Leave out the details that are about a pixel in a list (flat marks and bare strokes); by default up to a `detail` of 160 px. */
  small?: boolean;
  /** What a screen reader says: the picture gets `role="img"` and this as its `aria-label`. */
  label?: string;
}

// where the paper shader's rim starts on a strip (the outer fifth of its half width), and its tint
const RIM = 0.8, CREAM = "#FFF7EB";
// a coarser band than the stage's 12 sections and 8-segment caps: indistinguishable at portrait size
const SEG = 8, CAP = 6;

const pixels = (n: unknown): number | undefined => typeof n === "number" && n > 0 && n <= 4096 ? n : undefined;

/** The amount of detail an output gets: decimals, the limb rim and the layer shadows, from `detail` (or the size) unless given. */
export function detailOf(o: Pick<StillOptions, "size" | "detail" | "digits" | "rim" | "shadow" | "small">): { digits: number; rim: boolean; shadow: boolean; small: boolean } {
  // a tenth of a centimetre is under a pixel up to 160 px: the output gets a quarter shorter
  const px = pixels(o.detail) ?? pixels(o.size) ?? 96;
  return { digits: Number.isFinite(o.digits) ? Math.min(3, Math.max(0, Math.round(o.digits!))) : px <= 160 ? 1 : 2, rim: o.rim ?? px >= 100, shadow: o.shadow ?? px >= 160, small: o.small ?? px <= 160 };
}

/**
 * The finishing touches of a picture, made on the string so a cached render serves every size: the
 * `width` and `height` of the longer side `size` (from the view box), a `label`, and `idPrefix` in
 * front of every id and reference.
 */
export function finishSvg(svg: string, o: { size?: number; label?: string; idPrefix?: string }): string {
  const px = pixels(o.size), pre = o.idPrefix ? svgId(o.idPrefix) : "", at = svg.indexOf(">");
  if (pre) svg = svg.replace(/( id="|\(#)/g, "$1" + pre);
  const vb = /viewBox="([^"]+)"/.exec(svg.slice(0, at + 1))?.[1].split(" ").map(Number);
  let extra = "";
  if (px && vb) { const k = px / Math.max(vb[2], vb[3]); extra += ` width="${Math.round(vb[2] * k)}" height="${Math.round(vb[3] * k)}"`; }
  if (typeof o.label === "string" && o.label) extra += ` role="img" aria-label="${o.label.slice(0, 120).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)}"`;
  return extra ? svg.slice(0, at) + extra + svg.slice(at) : svg;
}

/** The box of a box under an affine map. */
function boxApply(m: Affine, b: Box): Box {
  const p = [apply(m, b[0], b[1]), apply(m, b[2], b[1]), apply(m, b[2], b[3]), apply(m, b[0], b[3])];
  return [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))];
}

const finite = (b: Box) => b.every(Number.isFinite);
/** The area where two boxes meet. */
const meet = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1]);
const union = (a: Box | null, b: Box): Box => a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b;

/** A square around a box: the same centre, the longer side, and a margin (a fraction of it) on each side. */
function square(b: Box, margin: number): Box {
  const s = Math.max(b[2] - b[0], b[3] - b[1]) * (1 + 2 * margin) / 2, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return [cx - s, cy - s, cx + s, cy + s];
}

/**
 * The box a framing shows, from the body's measurements, the posed bones and, for a full figure,
 * the pieces' boxes in paper space. Head and bust are squares; a full figure keeps its own shape.
 */
function frameBox(framing: Framing, b: BodyDims, world: Map<string, Affine>, items: { it: Item; box: Box }[]): Box {
  // a full figure needs neither (a kit puppet, a bird, has no neck); the head and bust crops need both
  const head = world.get("head"), neck = world.get("neck");
  if (framing !== "full" && (!head || !neck)) throw new Error("sahne: the skeleton has no head or neck");
  const W = b.headW, H = b.headH;
  // the head with its ears and a little neck, and what rises above the crown or out to the side (a bun, a hat), within reason
  let x0 = -W / 2 - 3.6, x1 = W / 2 + 3.6, top = -H * 1.04;
  for (const { it } of items) if (it.bone === "head" && it.group && (it.layer === "hair_front" || it.layer === "hair_back" || it.layer === "headwear")) {
    const g = groupBounds(it.group);
    x0 = Math.min(x0, Math.max(g[0], -W * 0.8)); x1 = Math.max(x1, Math.min(g[2], W * 0.8)); top = Math.min(top, Math.max(g[1], -H * 1.5));
  }
  const hb: Box | null = head ? boxApply(head, [x0, top, x1, H * 0.1]) : null;
  if (framing === "head") {
    // the picture ends at the neck, so a shoulder never pokes in: its top edge goes up, and the head sits low in it
    const q = square(hb!, 0.05), dy = hb![3] + (q[3] - q[1]) * 0.02 - q[3];
    return [q[0], q[1] + dy, q[2], q[3] + dy];
  }
  if (framing === "bust") {
    const n = apply(neck!, 0, 0), half = Math.max((hb![2] - hb![0]) / 2, b.shoulderW / 2 + b.armW[0] * 0.6 + 1);
    return square([n[0] - half, hb![1], n[0] + half, Math.max(n[1] + b.torsoL * 0.5, hb![3])], 0.04);
  }
  let all: Box | null = null;
  for (const { box } of items) all = union(all, box);
  const u = all ?? hb;
  if (!u) throw new Error("sahne: nothing to frame");
  const m = Math.max(u[2] - u[0], u[3] - u[1]) * 0.03;
  return [u[0] - m, u[1] - m, u[2] + m, u[3] + m];
}

/** A bone's transform as an attribute (nothing for the identity). */
function transform(m: Affine, digits: number): string {
  const [a, b, c, d, e, f] = m;
  if (Math.abs(a - 1) + Math.abs(b) + Math.abs(c) + Math.abs(d - 1) < 1e-4) return e || f ? ` transform="translate(${svgList([e, f], digits)})"` : "";
  return ` transform="matrix(${svgList([a, b, c, d], 4)} ${svgList([e, f], digits)})"`;
}

/** A strip as polygons: the band (a lighter rim round it when `core` is given), its stripes and caps. */
function stripSvg(full: StripGeom, core: StripGeom | null, color: string, stripes: [string, number, number] | undefined, digits: number): string {
  const P = (pts: Vec2[], fill: string) => pts.length > 2 ? `<path d="${poly(pts).toCompactD(digits)}" fill="${fill}"/>` : "";
  const ink = (stripes && svgPaint(stripes[0])) || null, duty = stripeDuty(stripes?.[2]);
  const layer = (g: StripGeom, base: string, stripe: string | null) => {
    let out = P(stripOutline(g), base);
    if (stripe) {
      for (const [a, b] of stripeSpans(g.length, stripes![1], duty)) out += P(stripSlice(g, a, b), stripe);
      // a cap takes the colour of the band at its end, as the shader gives it
      for (const c of [g.capFrom, g.capTo]) if (c && (c.along / stripes![1]) % 1 <= duty) out += P(c.pts, stripe);
    }
    return out;
  };
  const rim = (c: string) => mix(c, CREAM, 0.5);
  return core ? layer(full, rim(color), ink ? rim(ink) : null) + layer(core, color, ink) : layer(full, color, ink);
}

/** A piece to draw: its box in paper space, its bone's transform (a strip is in paper space already), and for a strip its bands. */
interface Node { it: Item; box: Box; m?: Affine; full?: StripGeom; core?: StripGeom | null; color?: string }

/**
 * The SVG of a figure at rest or in `pose`: default hand shapes, no props, one view, cropped to
 * the framing. Throws when the figure has no finite geometry (`portrait` then shows the silhouette).
 */
export function renderSvg(puppet: Figure, kit: Kit, o: StillOptions): string {
  const view = o.view === "back" ? "back" : "front", pre = svgId(o.idPrefix ?? "s"), b = puppet.body, { digits, rim, shadow, small } = detailOf(o);
  const world = solve(puppet.bones, o.pose ?? restPose());

  // an arm raised to the face (eat, drink, think) is drawn after the head, as the stage does
  const raised = new Set<string>();
  const head = world.get("head");
  if (view === "front" && head) for (const s of ["l", "r"]) {
    const h = world.get("hand_" + s);
    if (h && apply(h, 0, b.handL * 0.5)[1] < apply(head, 0, 0)[1] + 6) raised.add(s);
  }
  // with everything on that arm's bones: the hand shapes, a ring, a watch, a held phone
  const armSide = (it: Item) => it.strip?.chain.startsWith("arm_") ? it.strip.chain.slice(4) : ARM_BONE.exec(it.bone)?.[1] ?? "";

  const nodes: Node[] = [], later: Node[] = [], items = puppet.views[view], dflt: Record<string, string> = {};
  for (const it of items) if (it.alt?.default) dflt[it.alt.key] = it.alt.value;
  for (const it of items) {
    if (it.alt && (Object.hasOwn(o.alt ?? {}, it.alt.key) ? o.alt![it.alt.key] : dflt[it.alt.key]) !== it.alt.value) continue;
    const m = world.get(it.bone);
    let n: Node | null = null;
    if (it.strip) {
      const j = stripJoints(world, it.strip.chain), color = svgPaint(it.strip.color);
      if (j && color) {
        const full = stripGeometry(j, it.strip, it.layer, { seg: SEG, capSeg: CAP });
        const pts = stripOutline(full);
        n = { it, box: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))], full, color,
          core: rim ? stripGeometry(j, it.strip, it.layer, { seg: SEG, capSeg: CAP, scale: RIM }) : null };
      }
    } else if (m && it.face && puppet.faceRegion) n = { it, m, box: boxApply(m, puppet.faceRegion) };
    else if (m && it.group) n = { it, m, box: boxApply(m, groupBounds(it.group)) };
    if (n && finite(n.box)) (raised.has(armSide(it)) ? later : nodes).push(n);
  }
  nodes.push(...later);

  const vb = frameBox(o.framing, b, world, nodes);
  if (!finite(vb) || !(vb[2] > vb[0]) || !(vb[3] > vb[1])) throw new Error("sahne: nothing to draw");

  // a detail that would be about a pixel in a list (96 px) is left out (a glint, a stitch, a crease)
  const minDetail = small ? Math.max(vb[2] - vb[0], vb[3] - vb[1]) / 96 * 1.2 : 0;
  const fp = typeof o.face === "string" ? faceFrom(Object.hasOwn(kit.face.emotions, o.face) ? kit.face.emotions[o.face] : undefined) : o.face ?? faceFrom(undefined);
  let body = "", bone: string | null = null;
  // a clip path that several shapes of a bone share is written once (hair under a hat); one table per bone, since a clip is read in the user space of whoever refers to it
  const clips = new Map<string, Map<Path, string>>(), clipsOf = (bone: string) => { let m = clips.get(bone); if (!m) clips.set(bone, m = new Map()); return m; };
  // a print's tile is laid out in the user space of each shape that uses it, so one table serves every bone
  const tiles = new Map<Tile, string>();
  const close = () => { if (bone !== null) body += "</g>"; bone = null; };
  nodes.forEach((n, i) => {
    // a piece that only grazes the picture (a shoulder under a head: a small part of a big piece, a sliver of the picture) is left out
    const m = meet(n.box, vb);
    if (m < area(vb) * (o.framing === "head" ? 0.06 : 0.01) && m < area(n.box) * 0.5) return;
    if (n.full) { close(); body += stripSvg(n.full, n.core ?? null, n.color!, n.it.strip!.stripes, digits); return; }
    if (n.it.bone !== bone) { close(); body += `<g${transform(n.m!, digits)}>`; bone = n.it.bone; }
    if (n.it.face) {
      // the canvas draws with mitre joins, which the root's round ones would change
      const ctx = new SvgContext(`${pre}f`, digits);
      kit.face.draw(ctx as unknown as CanvasRenderingContext2D, puppet.faceStyle!, fp, puppet.faceRegion!);
      body += `<g stroke-linejoin="miter">${ctx.done()}</g>`;
    } else body += groupSvg(n.it.group!, { id: `${pre}${i}_`, shadow: shadow ? `${pre}s` : undefined, digits, base: true, clips: clipsOf(n.it.bone), tiles, minDetail });
  });
  close();

  // the back is the paper seen from behind, mirrored as the stage's turn shows it: the wearer's left (+x) is on the viewer's left
  const w = vb[2] - vb[0], h = vb[3] - vb[1], bg = svgPaint(o.background), x0 = view === "back" ? -vb[2] : vb[0];
  if (view === "back") body = `<g transform="matrix(-1 0 0 1 0 0)">${body}</g>`;
  // the filter is defined only when some layer lies on another and refers to it (a head seldom does)
  return finishSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgList([x0, vb[1], w, h], digits)}">` +
    (body.includes(`(#${pre}s)`) ? `<defs>${shadowFilter(`${pre}s`)}</defs>` : "") +
    (bg ? `<rect x="${svgNums([x0])}" y="${svgNums([vb[1]])}" width="${svgNums([w])}" height="${svgNums([h])}" fill="${bg}"/>` : "") +
    `<g${SVG_BASE}>${body}</g></svg>`, { size: o.size, label: o.label });
}
