// The seated side view (Sahne DESIGN.md §6.3, `Kit.side`): a person seen side on, facing screen right, sitting on a seat seen
// from the aisle (a bus seat). It is not drawn part by part: it is derived from the composed character, so every part has it
// for free. The head is a profile with the nose and chin in its outline; the hair and the headwear come by family (short, long,
// tied, curly, bald; a scarf, a cap, a hat, a beanie); the clothes take the worn parts' colours (a top with long or short
// sleeves, a coat over it, trousers, shorts, a skirt or a dress, shoes). Pieces go in draw order on the bones of `seatedSide`
// (the far limbs `_l` first, shaded; the near ones `_r` last), so there are no layers. The face is a profile too (`drawSide`):
// the near eye, its brow, a cheek and the mouth at the edge, with a moustache or a beard; it talks and blinks like the front one.
// Units cm, y down; the head bone's origin is the chin's level, the head rising to −H.

import { smooth, ellipse, rect, rrect, tone, mix, type Box, type BodyDims, type FaceParams, type FaceStyle, type Group, type Item, type Path, type SideCtx, type StripSpec, type Vec2 } from "sahne";
import type { KitFaceStyle } from "./face.ts";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const S = (path: Path, fill: string, o: Partial<{ flat: boolean; opacity: number }> = {}) => ({ path, fill, ...o });
/** A closed outline through points given in head heights (x forwards, y down), scaled by `k`. */
const outline = (pts: [number, number][], k: number, closed = true) => smooth(pts.map(([x, y]): Vec2 => [x * k, y * k]), closed, 1);
const has = (id: string, ...words: string[]) => words.some(w => id.includes(w));

// ---- the head --------------------------------------------------------------------------------------

/** The profile of the head, facing right, in head heights: crown, back of the skull, nape, jaw, chin, lips, nose, brow, forehead. */
function profile(nose: string | undefined, kid: boolean): [number, number][] {
  const tip = nose === "button" || kid ? 0.49 : nose === "long" || nose === "large" || nose === "hooked" ? 0.56 : 0.52;
  return [
    [0.05, -1], [-0.3, -0.95], [-0.5, -0.72], [-0.5, -0.42], [-0.36, -0.16], [-0.12, -0.02], [0.22, 0.02], [0.36, -0.03],
    [0.41, -0.12], [0.43, -0.2], [0.41, -0.25], [0.45, -0.3], [tip, -0.35], [0.47, -0.42], [0.44, -0.52], [0.46, -0.6],
    [0.43, -0.78], [0.3, -0.94],
  ];
}

/** The face texture's box for the side view, in head-bone space: the front of the head, eye to chin. */
export const regionSide = (b: BodyDims): Box => [b.headH * 0.04, -b.headH * 0.8, b.headH * 0.62, 3];

// ---- hair and headwear by family ---------------------------------------------------------------------

type Hair = "short" | "medium" | "long" | "tied" | "curly" | "bald";
function hairFamily(id: string): Hair {
  if (has(id, "bald")) return "bald";
  if (has(id, "afro", "curly", "puffs")) return "curly";
  if (has(id, "bun", "ponytail", "pigtails")) return "tied";
  if (has(id, "long", "locs")) return "long";
  if (has(id, "bob", "shoulder")) return "medium";
  return "short";
}

/** Hair as pieces behind the head (a fall, a ponytail, the mass of curls) and over it (the cap), facing right. */
function hairPieces(id: string, c: string, H: number): { behind: Group[]; over: Group[] } {
  const fam = hairFamily(id), shade = tone(c, "shade"), light = tone(c, "light");
  const cap = (back: number): Group => ({ shapes: [
    S(outline([[0.4, -0.8], [0.32, -0.98], [-0.08, -1.08], [-0.48, -0.9], [-0.56, -0.56], [-0.48, -0.3], [-0.32, back], [-0.24, -0.34], [-0.1, -0.5], [0.06, -0.62], [0.22, -0.74]], H), c),
    S(outline([[0.18, -0.94], [-0.12, -1.02], [-0.36, -0.92], [-0.12, -0.96]], H), light, { flat: true, opacity: 0.35 }),
  ] });
  const receding = id.includes("receding");
  if (fam === "bald") return { behind: [], over: receding ? [{ shapes: [S(outline([[-0.2, -0.72], [-0.48, -0.66], [-0.5, -0.4], [-0.36, -0.2], [-0.28, -0.36], [-0.16, -0.5]], H), c)] }] : [] };
  if (fam === "curly") return {
    behind: [{ shapes: [S(ellipse(-0.14 * H, -0.7 * H, 0.62 * H, 0.46 * H), c), S(ellipse(-0.28 * H, -0.82 * H, 0.32 * H, 0.2 * H), light, { flat: true, opacity: 0.25 })] }],
    over: [{ shapes: [S(outline([[0.38, -0.82], [0.3, -1.06], [0.0, -1.16], [-0.1, -0.86], [0.12, -0.74]], H), c)] }],
  };
  if (fam === "tied") {
    const pony = id.includes("ponytail") || id.includes("pigtails");
    return {
      behind: [pony
        ? { shapes: [S(outline([[-0.46, -0.78], [-0.62, -0.62], [-0.68, -0.2], [-0.6, 0.18], [-0.52, -0.12], [-0.5, -0.52]], H), c), S(rrect(-0.53 * H, -0.8 * H, 0.1 * H, 0.08 * H, 0.03 * H), shade)] }
        : { shapes: [S(ellipse(-0.52 * H, (id.includes("low") ? -0.38 : -0.86) * H, 0.17 * H, 0.15 * H), c), S(ellipse(-0.56 * H, (id.includes("low") ? -0.42 : -0.9) * H, 0.08 * H, 0.06 * H), light, { flat: true, opacity: 0.3 })] }],
      over: [cap(-0.22)],
    };
  }
  if (fam === "long" || fam === "medium") {
    const end = fam === "long" ? 0.55 : 0.08;
    return { behind: [{ shapes: [S(outline([[-0.3, -0.9], [-0.56, -0.62], [-0.6, -0.1], [-0.56, end], [-0.2, end + 0.04], [-0.12, -0.08], [-0.16, -0.5]], H), c), S(outline([[-0.5, -0.4], [-0.52, end - 0.05], [-0.42, end - 0.05], [-0.42, -0.3]], H), shade, { flat: true, opacity: 0.35 })] }], over: [cap(-0.3)] };
  }
  return { behind: [], over: [cap(id.includes("buzz") || id.includes("fade") ? -0.36 : -0.28)] };
}

/** Headwear by family: a covering (the whole head but the face), a cap with its peak forwards, a beanie, a brimmed hat. */
function headwear(id: string, c: string, c2: string, H: number): Group | null {
  if (has(id, "headscarf", "hijab", "turban", "dastar")) return { shapes: [
    S(outline([[0.4, -0.84], [0.28, -1.04], [-0.12, -1.12], [-0.56, -0.9], [-0.64, -0.42], [-0.58, 0.1], [-0.38, 0.42], [0.1, 0.42], [0.32, 0.1], [0.36, -0.04], [0.2, -0.16], [0.16, -0.5], [0.3, -0.74]], H), c),
    S(outline([[0.4, -0.84], [0.3, -0.76], [0.2, -0.6], [0.24, -0.66], [0.33, -0.8]], H), tone(c, "shade"), { flat: true, opacity: 0.5 }),
  ] };
  if (has(id, "kippah", "taqiyah")) return { shapes: [S(outline([[0.14, -0.98], [-0.06, -1.07], [-0.3, -1.0], [-0.2, -0.94], [0.0, -0.96]], H), c)] };
  if (has(id, "beanie")) return { shapes: [S(outline([[0.4, -0.78], [0.3, -1.1], [-0.1, -1.2], [-0.5, -1.0], [-0.56, -0.66], [-0.1, -0.74]], H), c), S(rect(-0.56 * H, -0.76 * H, 0.98 * H, 0.1 * H), tone(c, "shade"))] };
  if (has(id, "cap_", "baseball", "flat")) return { shapes: [
    S(outline([[0.36, -0.84], [0.28, -1.06], [-0.1, -1.14], [-0.5, -0.98], [-0.54, -0.8], [0.1, -0.84]], H), c),
    S(outline([[0.3, -0.86], [0.72, -0.82], [0.7, -0.78], [0.3, -0.8]], H), id.includes("baseball") ? c2 : tone(c, "shade")),
  ] };
  if (has(id, "hat")) return { shapes: [S(outline([[0.3, -0.86], [0.24, -1.2], [-0.4, -1.22], [-0.46, -0.86]], H), c), S(rrect(-0.72 * H, -0.9 * H, 1.36 * H, 0.08 * H, 0.03 * H), tone(c, "shade"))] };
  return null;
}

// ---- the body ----------------------------------------------------------------------------------------

/** The person seated side on, facing right, from the composed character (`Kit.side`). */
export function side(c: SideCtx): Item[] {
  const b = c.body, H = b.headH, skin = c.skin, deep = tone(skin, "shade"), kid = b.build === "child" || b.build === "toddler";
  const worn = (slot: string) => c.worn.find(w => w.slot === slot);
  const top = worn("top"), bottom = worn("bottom"), dress = worn("dress"), outer = worn("outer"), shoes = worn("shoes"), hair = worn("hair");
  const cover = worn("head"), hat = worn("hat");
  const col = (w: typeof top, i = 0, d = "#7A8A99") => w?.colors[i] ?? w?.colors[0] ?? d;
  const topC = dress ? col(dress) : col(top, 0, "#E9E4D6"), outerC = outer ? col(outer) : null;
  const shortSleeve = !!top && !outer && has(top.id, "tshirt", "polo", "short", "tank", "vest") && !dress;
  const legC = dress ? null : col(bottom, 0, "#4F5B66"), legTo = !bottom || dress ? 0 : has(bottom.id, "shorts") ? 0.42 : has(bottom.id, "skirt") ? 0 : 1;
  const skirt = dress ?? (bottom && has(bottom.id, "skirt") ? bottom : null), skirtC = skirt ? col(skirt) : null;
  const items: Item[] = [], far = (x: string) => tone(x, "shade");
  const strip = (chain: StripSpec["chain"], color: string, widths: [number, number, number], from = 0, to = 1, caps?: StripSpec["caps"]): Item =>
    ({ layer: "side", bone: chain.startsWith("arm") ? "spine" : "hips", strip: { chain, widths, color, from, to, ...(caps ? { caps } : {}) } });
  const grow = (w: [number, number, number], k: number): [number, number, number] => [w[0] * k, w[1] * k, w[2] * k];
  const sleeveTo = shortSleeve ? 0.42 : 1, sleeveC = outerC ?? topC;
  const footL = b.H * 0.14;
  const shoe = (color: string): Group => ({ shapes: [
    S(smooth([[-footL * 0.22, -b.footH * 0.9], [footL * 0.45, -b.footH * 0.7], [footL * 0.8, -b.footH * 0.35], [footL * 0.82, b.footH * 0.1], [-footL * 0.25, b.footH * 0.1], [-footL * 0.3, -b.footH * 0.4]], true, 1), color),
    S(rect(-footL * 0.25, b.footH * 0.02, footL * 1.07, b.footH * 0.12), tone(color, "deep")),
  ] });
  const shoeC = col(shoes, 0, "#3B3B40");
  const hand: Group = { shapes: [S(smooth([[-b.armW[2] * 0.5, 0], [b.armW[2] * 0.55, 0], [b.armW[2] * 0.6, b.handL * 0.7], [0, b.handL], [-b.armW[2] * 0.55, b.handL * 0.6]], true, 1), skin)] };
  const leg = (s: "l" | "r") => {
    const shade = (x: string) => s === "l" ? far(x) : x;
    items.push(strip(`leg_${s}`, shade(skin), b.legW));
    if (legC && legTo > 0) items.push(strip(`leg_${s}`, shade(legC), grow(b.legW, 1.12), 0, legTo, legTo < 1 ? undefined : "from"));
    items.push({ layer: "side", bone: `foot_${s}`, group: shoe(shade(shoeC)) });
  };
  const arm = (s: "l" | "r") => {
    const shade = (x: string) => s === "l" ? far(x) : x;
    items.push(strip(`arm_${s}`, shade(skin), b.armW));
    items.push(strip(`arm_${s}`, shade(sleeveC), grow(b.armW, 1.15), 0, sleeveTo, sleeveTo < 1 ? undefined : "from"));
    items.push({ layer: "side", bone: `hand_${s}`, group: { shapes: hand.shapes.map(x => ({ ...x, fill: shade(skin) })) } });
  };

  // far side: the leg, then the arm behind the body
  leg("l"); arm("l");
  // the body: the torso from the hips to the shoulders, a little deeper at the chest; a coat over it, open at the front
  const T = b.torsoL, chest = b.shoulderW * 0.42, hips = b.hipW * 0.52;
  const torso = smooth([[-hips * 0.55, 4], [-hips * 0.6, -T * 0.4], [-chest * 0.55, -T * 0.82], [-chest * 0.4, -T + 1], [chest * 0.3, -T + 2], [chest * 0.55, -T * 0.72], [chest * 0.48, -T * 0.4], [hips * 0.5, -T * 0.1], [hips * 0.55, 4]], true, 1);
  const body: Group = { shapes: [S(torso, topC), S(smooth([[-hips * 0.55, 2], [-chest * 0.5, -T * 0.7], [-chest * 0.3, -T * 0.75], [-hips * 0.35, 0]], true, 1), tone(topC, "shade"), { flat: true, opacity: 0.4 })] };
  if (outerC) body.shapes.push(S(smooth([[-hips * 0.62, 6], [-hips * 0.66, -T * 0.4], [-chest * 0.6, -T * 0.84], [-chest * 0.42, -T + 0.5], [chest * 0.2, -T + 1.5], [chest * 0.4, -T * 0.6], [hips * 0.36, 6]], true, 1), outerC));
  items.push({ layer: "side", bone: "spine", group: body });
  // the lap of a skirt or a dress, over the thighs to the knee
  // (a long one, a modest dress, a kameez, a maxi skirt, falls on to the ankle)
  const long = !!skirt && has(skirt.id, "long", "modest", "maxi", "kameez", "abaya");
  const lap = (s: "l" | "r"): Item | null => skirtC ? strip(`leg_${s}`, s === "l" ? far(skirtC) : skirtC, grow(b.legW, long ? 1.35 : 1.45), 0, long ? 0.93 : 0.56, "from") : null;
  { const l = lap("l"); if (l) items.push(l); }
  // the neck and the head
  items.push({ layer: "side", bone: "neck", group: { shapes: [S(rrect(-b.neckW * 0.42, -b.neckL - 4, b.neckW * 0.8, b.neckL + 8, 3), skin), S(rect(-b.neckW * 0.42, -b.neckL - 4, b.neckW * 0.3, b.neckL + 8), deep, { flat: true, opacity: 0.3 })] } });
  const hp = hair && !cover ? hairPieces(hair.id, c.hair, H) : { behind: [], over: [] };
  for (const g of hp.behind) items.push({ layer: "side", bone: "head", group: g });
  const head = outline(profile(c.avatar.face?.nose, kid), H);
  items.push({ layer: "side", bone: "head", group: { shapes: [S(head, skin), S(outline([[-0.48, -0.6], [-0.5, -0.4], [-0.34, -0.16], [-0.1, -0.04], [-0.3, -0.3]], H), deep, { flat: true, opacity: 0.25 })] } });
  // the ear, in front of the nape
  if (!cover) items.push({ layer: "side", bone: "head", group: { shapes: [S(ellipse(-0.1 * H, -0.44 * H, 0.075 * H, 0.12 * H), skin), S(ellipse(-0.09 * H, -0.44 * H, 0.04 * H, 0.075 * H), deep, { flat: true, opacity: 0.6 })] } });
  items.push({ layer: "side", bone: "head", face: true });
  for (const g of hp.over) items.push({ layer: "side", bone: "head", group: g });
  for (const w of [cover, hat]) { const g = w && headwear(w.id, col(w), col(w, 1, tone(col(w), "light")), H); if (g) items.push({ layer: "side", bone: "head", group: g }); }
  // near side: the leg (and the lap over it), then the arm on the lap
  leg("r");
  { const l = lap("r"); if (l) items.push(l); }
  arm("r");
  return items;
}

// ---- the profile face --------------------------------------------------------------------------------

/** The side view's face (`Kit.face.drawSide`): the near eye looking forwards, its brow, a cheek, the mouth at the front edge, a moustache or a beard; it blinks and talks. */
export function drawSide(ctx: Ctx, st: FaceStyle, f: FaceParams) {
  const s = st as KitFaceStyle, H = s.headH, skin = s.skin, kid = s.build === "child" || s.build === "toddler";
  // the cheek
  ctx.save(); ctx.globalAlpha = 0.18 + f.blush * 0.45 + (kid ? 0.1 : 0); ctx.fillStyle = mix("#F0767A", skin, 0.25);
  ctx.beginPath(); ellipse(0.24 * H, -0.28 * H, 0.08 * H, 0.05 * H).trace(ctx); ctx.fill(); ctx.restore();
  // the eye: an almond facing forwards, the iris at its front, closing from the top
  const open = Math.max(0, Math.min(1.2, f.eyeOpen[1])), ex = 0.34 * H + f.pupil[0] * 0.01 * H, ey = -0.5 * H, ew = 0.075 * H, eh = 0.04 * H * open;
  if (open > 0.08) {
    ctx.fillStyle = "#FBF8F2"; ctx.beginPath(); smooth([[ex - ew, ey], [ex, ey - eh], [ex + ew * 0.7, ey - eh * 0.3], [ex + ew * 0.5, ey + eh * 0.5], [ex, ey + eh * 0.8]], true, 1).trace(ctx); ctx.fill();
    ctx.fillStyle = s.eyeColor; ctx.beginPath(); ellipse(ex + ew * 0.32, ey + f.pupil[1] * eh * 0.3, ew * 0.42, Math.min(ew * 0.42, eh * 0.95)).trace(ctx); ctx.fill();
    ctx.fillStyle = "#1A1210"; ctx.beginPath(); ellipse(ex + ew * 0.38, ey + f.pupil[1] * eh * 0.3, ew * 0.2 * f.pupilSize, Math.min(ew * 0.2, eh * 0.6)).trace(ctx); ctx.fill();
  }
  // the lid's line (the whole eye when it is shut) and the lashes' corner
  ctx.strokeStyle = "#2B1E18"; ctx.lineWidth = 0.55; ctx.lineCap = "round";
  ctx.beginPath(); smooth([[ex - ew, ey], [ex, ey - Math.max(eh, 0.006 * H)], [ex + ew * 0.75, ey - eh * 0.25]], false, 1).trace(ctx); ctx.stroke();
  // the brow, raised or lowered with the face's
  const by = ey - 0.09 * H - (f.brows.r[0] + f.brows.r[1]) * 0.02 * H;
  ctx.strokeStyle = s.browColor; ctx.lineWidth = s.brows === "thick" ? 1.4 : s.brows === "thin" ? 0.6 : 0.95;
  ctx.beginPath(); smooth([[ex - ew * 1.1, by + 0.01 * H], [ex, by - 0.012 * H], [ex + ew * 0.9, by]], false, 1).trace(ctx); ctx.stroke();
  // the mouth at the front edge: the line from the lips back to the corner, opening as it talks
  const mx = 0.42 * H, my = -0.2 * H, back = 0.07 * H * (0.8 + 0.4 * f.mouth.wide), gape = f.mouth.open * 0.06 * H, smile = f.mouth.smile * 0.012 * H;
  if (gape > 0.15) { ctx.fillStyle = "#5B2224"; ctx.beginPath(); smooth([[mx, my - gape * 0.4], [mx - back, my - smile], [mx, my + gape * 0.6]], true, 1).trace(ctx); ctx.fill(); }
  ctx.strokeStyle = mix(tone(skin, "deep"), "#6B4A3F", 0.3); ctx.lineWidth = 0.6;
  ctx.beginPath(); smooth([[mx, my], [mx - back * 0.6, my - smile * 0.4], [mx - back, my - smile]], false, 1).trace(ctx); ctx.stroke();
  // facial hair: a moustache over the lip, a beard along the jaw
  const fh = s.facialHair;
  if (fh) {
    ctx.fillStyle = fh.color;
    if (fh.style !== "beard_no_moustache" && fh.style !== "stubble") { ctx.beginPath(); smooth([[mx + 0.01 * H, my - 0.035 * H], [mx - back * 1.1, my - 0.03 * H], [mx - back, my - 0.005 * H], [mx + 0.01 * H, my - 0.012 * H]], true, 1).trace(ctx); ctx.fill(); }
    if (fh.style.startsWith("beard") || fh.style === "goatee" || fh.style === "stubble") {
      ctx.globalAlpha = fh.style === "stubble" ? 0.3 : 1;
      ctx.beginPath(); smooth(fh.style === "goatee"
        ? [[mx - 0.01 * H, my + 0.04 * H], [mx - 0.12 * H, my + 0.06 * H], [mx - 0.1 * H, my + 0.2 * H], [mx - 0.02 * H, my + 0.2 * H]]
        : [[mx, my + 0.03 * H], [mx - 0.2 * H, my - 0.02 * H], [0.06 * H, -0.36 * H], [0.02 * H, -0.12 * H], [0.08 * H, 0.04 * H], [0.3 * H, 0.08 * H], [mx, my + 0.16 * H]], true, 1).trace(ctx);
      ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}
