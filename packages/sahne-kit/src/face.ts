// The face: drawn into each actor's face texture whenever a parameter changes (DESIGN.md §6.4).
// Big eyes with lids and moving pupils, two-point brows, and a mouth built from four numbers
// (open, wide, round, smile), so emotions and mouth shapes blend smoothly.
//
// THE FACE ARTIST'S FILE. It owns the face's vocabularies (`FACE_CHOICES`: face shape, eyes, eye
// colour, brows, nose, mouth, ears, marks, facial hair), the texture drawing (`draw`), the ears the
// base body draws (`earGroup`) and the facial hair that hangs below the chin (`facialHairItems`).
// A new value goes in its `FACE_CHOICES` list with names in both languages, and `draw` must draw
// it differently from every other value (the kit tests check). The texture is drawn with the
// canvas subset the still backend records (render/still/recorder.ts): paths, fill, stroke, clip,
// fillRect, save/restore, alpha, line width, caps, joins and dashes; no transforms. The head's
// outlines and anchors (`headPath`, `eyeAt`, `earAt`) live in draw/head.ts, shared with the hair
// and the headwear: change them only with the lead.

import { tone, mix, luma, ellipse, smooth, band, rotateAbout, type Path, type AvatarDoc, type BodyDims, type Box, type Choice, type FaceParams, type FacePreset, type FaceStyle, type Group, type Item, type Kit, type Vec2 } from "sahne";
import { headPath, eyeAt, earAt, HEAD_SHAPES, EAR_SHAPES } from "./draw/head.ts";
import { color, nm, EYES, HAIR_BROW } from "./palette.ts";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface KitFaceStyle extends FaceStyle { headW: number; headH: number; shape: string }

export function faceStyle(a: AvatarDoc, kit: Kit): KitFaceStyle {
  // dyed hair keeps natural brows and a natural beard unless the beard names its own colour
  const b = kit.body(a.body), natural = color(Object.hasOwn(HAIR_BROW, a.hair?.color ?? "") ? HAIR_BROW[a.hair.color] : a.hair?.color, "#2E2019");
  return {
    skin: color(a.skin, "#DCA27A"),
    eyes: a.face?.eyes ?? "round",
    eyeColor: color(a.face?.eyeColor ?? "eye_brown"),
    brows: a.face?.brows ?? "soft",
    browColor: mix(natural, "#1A1210", 0.25),
    nose: a.face?.nose ?? "button",
    mouth: a.face?.mouth ?? "wide",
    marks: a.face?.marks ?? [],
    facialHair: a.facialHair ? { style: a.facialHair.style, color: a.facialHair.color ? color(a.facialHair.color, natural) : natural } : null,
    build: b.build, headW: b.headW, headH: b.headH, shape: a.face?.shape ?? "oval",
  };
}

/** The face vocabularies the builder offers (`kit.features`); the ids are the ones `draw()` knows (the first is the default, except marks and facial hair). */
export const FACE_CHOICES: Record<"face.shape" | "face.eyes" | "face.eyeColor" | "face.brows" | "face.nose" | "face.mouth" | "face.ears" | "face.marks" | "facialHair", Choice> = {
  "face.shape": {
    values: HEAD_SHAPES, default: "oval",
    names: {
      oval: nm("Oval", "oval"), round: nm("Round", "yuvarlak"), square: nm("Square", "köşeli"), long: nm("Long", "uzun"), heart: nm("Heart", "kalp"),
      diamond: nm("Diamond", "elmas şeklinde yüz"), full: nm("Full", "dolgun yüz"),
    },
  },
  // monolid, hooded and upturned are drawn as big and as expressive as the round eye (never a slit);
  // 'çekik göz' is not a name or an alias here: in Turkish it is often pejorative about East Asian people
  "face.eyes": {
    values: ["round", "almond", "sleepy", "dot", "small", "monolid", "hooded", "upturned"], default: "round", weights: { dot: 0.25, hooded: { adult: 1, elder: 2.5, child: 0.4, toddler: 0.2 } },
    names: {
      round: nm("Round", "yuvarlak"), almond: nm("Almond", "badem"), sleepy: nm("Sleepy", "uykulu"), dot: nm("Dots", "nokta"),
      small: nm("Small", "küçük göz"), monolid: nm("Monolid", "tek kapaklı göz"), hooded: nm("Hooded", "düşük kapaklı göz"), upturned: nm("Upturned (cat)", "kedi gözü"),
    },
  },
  "face.eyeColor": { values: Object.keys(EYES), default: "eye_brown", weights: { eye_brown: 4, eye_dark: 4, eye_hazel: 2, eye_green: 1, eye_blue: 1.5, eye_grey: 0.6, eye_amber: 0.6, eye_light_blue: 0.6 } },
  "face.brows": {
    values: ["soft", "thick", "thin", "arched", "straight", "bushy", "joined"], default: "soft", weights: { bushy: { adult: 0.6, elder: 2, child: 0.2, toddler: 0 }, joined: 0.4 },
    names: {
      soft: nm("Soft", "yumuşak"), thick: nm("Thick", "kalın"), thin: nm("Thin", "ince"), arched: nm("Arched", "kavisli"),
      straight: nm("Straight", "düz kaş"), bushy: nm("Bushy", "gür kaş"), joined: nm("Joined", "bitişik kaş"),
    },
  },
  "face.nose": {
    values: ["button", "small", "round", "long", "aquiline", "broad", "upturned"], default: "button", weights: { aquiline: { adult: 1, elder: 1, child: 0.3, toddler: 0 }, upturned: { adult: 0.7, elder: 0.5, child: 1.5, toddler: 1.5 } },
    names: {
      button: nm("Button", "minik"), small: nm("Small", "küçük"), round: nm("Round", "yuvarlak"), long: nm("Long", "uzun"),
      aquiline: nm("Aquiline (high bridge)", "kemerli burun"), broad: nm("Broad", "geniş burun"), upturned: nm("Upturned", "kalkık burun"),
    },
  },
  "face.mouth": {
    values: ["wide", "small", "full", "thin", "bowed"], default: "wide", weights: { thin: { adult: 0.8, elder: 1.5, child: 0.3, toddler: 0.2 } },
    names: { wide: nm("Wide", "geniş"), small: nm("Small", "küçük"), full: nm("Full", "dolgun"), thin: nm("Thin", "ince dudak"), bowed: nm("Heart-shaped lips", "kalp şeklinde dudak") },
  },
  // the ears are drawn by the base body (`earGroup`), from the anchors in draw/head.ts that earrings use too
  "face.ears": {
    values: EAR_SHAPES, default: "round",
    names: { round: nm("Round", "yuvarlak"), small: nm("Small", "küçük kulak"), large: nm("Large", "büyük kulak"), protruding: nm("Protruding", "yana açık kulak") },
  },
  // up to four marks; identity marks (vitiligo, a birthmark, a scar) go in `free` and do not count.
  // The age cues are rare on adults, absent on children, common on elders; deep wrinkles are elder-only.
  "face.marks": {
    values: ["freckles", "mole", "dimples", "laugh_lines", "crows_feet", "forehead_lines", "wrinkles_deep", "vitiligo", "birthmark", "scar_brow"], default: null, max: 4,
    free: ["vitiligo", "birthmark", "scar_brow"],
    names: {
      freckles: nm("Freckles", "çil"), mole: nm("Mole", "ben"), dimples: nm("Dimples", "gamze"), laugh_lines: nm("Laugh lines", "gülme çizgileri"),
      crows_feet: nm("Crow's feet", "kaz ayağı"), forehead_lines: nm("Forehead lines", "alın çizgileri"), wrinkles_deep: nm("Deep wrinkles", "derin kırışıklıklar"),
      vitiligo: nm("Vitiligo", "vitiligo"), birthmark: nm("Birthmark", "doğum lekesi"), scar_brow: nm("Scar through the brow", "kaşta yara izi"),
    },
    weights: {
      laugh_lines: { adult: 0.5, elder: 3, child: 0, toddler: 0 }, crows_feet: { adult: 0.35, elder: 3, child: 0, toddler: 0 },
      forehead_lines: { adult: 0.4, elder: 2.5, child: 0, toddler: 0 }, wrinkles_deep: { adult: 0, elder: 1.5, child: 0, toddler: 0 },
      vitiligo: 0.12, birthmark: 0.25, scar_brow: { adult: 0.2, elder: 0.2, child: 0.08, toddler: 0 },
    },
  },
  facialHair: {
    values: ["stubble", "moustache", "moustache_thick", "moustache_chevron", "beard_trimmed", "beard_short", "beard_no_moustache", "goatee", "beard_full", "beard_long"], default: null,
    names: {
      stubble: nm("Stubble", "kirli sakal"), moustache: nm("Moustache", "bıyık"), moustache_thick: nm("Thick moustache", "gür bıyık"), moustache_chevron: nm("Classic moustache", "klasik bıyık"),
      beard_trimmed: nm("Trimmed beard", "bakımlı sakal"), beard_short: nm("Short beard", "kısa sakal"), beard_no_moustache: nm("Beard without moustache", "bıyıksız sakal"),
      goatee: nm("Goatee", "keçi sakalı"), beard_full: nm("Full beard", "gür sakal"), beard_long: nm("Long beard", "uzun sakal"),
    },
    weights: { beard_long: 0.5, beard_no_moustache: 0.4, goatee: 0.6 },
  },
};

// ---- what the base body draws for the face: ears, and facial hair below the chin ----------------------------

/** One ear as a paper piece in head space (`face.ears`), from its anchor: the base body draws two, behind the head. */
export function earGroup(b: BodyDims, skin: string, side: 1 | -1, ears?: string): Group {
  const e = earAt(b.headW, b.headH, side, ears), sx = e.rx / 3.6, sy = e.ry / 5;
  const tilt = (p: Path) => (e.rot ? p.transform(rotateAbout(e.rot, e.c[0], e.c[1])) : p);
  return {
    shapes: [
      { path: tilt(ellipse(e.c[0], e.c[1], e.rx, e.ry)), fill: skin },
      { path: tilt(ellipse(e.c[0] + side * 0.4 * sx, e.c[1] + 0.3 * sy, 1.7 * sx, 2.9 * sy)), fill: tone(skin, "shade"), flat: true, opacity: 0.8 },
    ],
  };
}

/**
 * Facial hair that leaves the face texture: the hanging part of a long beard, on the head bone and
 * layer `hair_front` (above the face), front view only. The base body adds these items.
 */
export function facialHairItems(b: BodyDims, fh: { style: string; color: string } | null): Item[] {
  if (fh?.style !== "beard_long") return [];
  const W = b.headW, H = b.headH, w = W * 0.17, len = H * 0.3;
  const g: Group = {
    shapes: [
      { path: smooth([[-w, -H * 0.06], [w, -H * 0.06], [w * 1.05, len * 0.45], [w * 0.55, len * 0.9], [0, len], [-w * 0.55, len * 0.9], [-w * 1.05, len * 0.45]], true, 1), fill: fh.color },
      { path: smooth([[-w * 0.35, len * 0.15], [-w * 0.2, len * 0.55], [-w * 0.05, len * 0.85]], false, 1), stroke: { color: tone(fh.color, "deep"), width: 0.6 }, flat: true, opacity: 0.6 },
      { path: smooth([[w * 0.3, len * 0.1], [w * 0.35, len * 0.5], [w * 0.15, len * 0.8]], false, 1), stroke: { color: tone(fh.color, "deep"), width: 0.6 }, flat: true, opacity: 0.6 },
      { path: smooth([[-w * 0.7, len * 0.05], [-w * 0.55, len * 0.4], [-w * 0.35, len * 0.2]], true, 1), fill: tone(fh.color, "light"), flat: true, opacity: 0.3 },
    ],
  };
  return [{ layer: "hair_front", bone: "head", group: g }];
}

export const region = (b: BodyDims): Box => [-b.headW * 0.56, -b.headH * 0.84, b.headW * 0.56, 3];

function trace(ctx: Ctx, p: { trace(c: Ctx): void }) { ctx.beginPath(); p.trace(ctx); }

const MOUTH_IN = "#5B2224", TONGUE = "#D7706E", TEETH = "#FBF8F2";
type P = Vec2 | [number, number, number];
const MOUSTACHES = new Set(["moustache", "moustache_thick", "moustache_chevron"]);
const MOUTH_Y = (H: number, kid: boolean) => -H * (kid ? 0.2 : 0.19);
/** The mouth's half width for a face and its parameters (the dimples sit beside its corners). */
function mouthHalf(s: KitFaceStyle, m: FaceParams["mouth"]): number {
  const wide = s.mouth === "small" ? 0.75 : s.mouth === "full" ? 1.05 : s.mouth === "bowed" ? 0.88 : s.mouth === "thin" ? 0.97 : 1;
  return s.headW * (0.075 + 0.085 * m.wide) * wide * (1 - 0.42 * m.round);
}
/** Skin-toned lines, one path for all of them: 'deep' at `a`; on the darkest skins a light line under each keeps it visible. */
function crease(ctx: Ctx, skin: string, lines: Vec2[][], w: number, a: number) {
  const draw = (dy: number) => { ctx.beginPath(); for (const pts of lines) smooth(dy ? pts.map(([x, y]): Vec2 => [x, y + dy]) : pts, false, 1).trace(ctx); ctx.stroke(); };
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (luma(skin) < 0.22) { ctx.strokeStyle = tone(skin, "light"); ctx.globalAlpha = a * 0.7; ctx.lineWidth = w * 0.65; draw(w * 0.9); }
  // the deep tone of a light skin is a strong pink: a crease takes it a little browner and quieter
  ctx.strokeStyle = mix(tone(skin, "deep"), "#6B4A3F", luma(skin) > 0.45 ? 0.35 : 0.1); ctx.globalAlpha = a; ctx.lineWidth = w;
  draw(0);
  ctx.globalAlpha = 1;
}
/** A soft irregular blob (vitiligo, a birthmark): a smooth closed outline with fixed wobbles, so a face is the same in every browser. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number): Path {
  const pts: Vec2[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, k = 0.78 + 0.32 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts, true, 1);
}

export function draw(ctx: Ctx, st: FaceStyle, f: FaceParams) {
  const s = st as KitFaceStyle, W = s.headW, H = s.headH, kid = s.build === "child" || s.build === "toddler";
  const skin = s.skin, deep = tone(skin, "deep"), shade = tone(skin, "shade");
  const head = headPath(s.shape, W, H);

  // ---- vitiligo first: pale patches of the skin itself, so blush, lines and features lie over them
  if (s.marks.includes("vitiligo")) drawVitiligo(ctx, s);

  // ---- cheeks (stronger on deep skin, where a light blush would vanish)
  const blush = 0.16 + f.blush * 0.45 + (kid ? 0.1 : 0) + (luma(skin) < 0.3 ? 0.12 : 0);
  ctx.save();
  ctx.globalAlpha = blush;
  ctx.fillStyle = mix("#F0767A", skin, 0.25);
  for (const side of [1, -1]) { trace(ctx, ellipse(side * W * 0.3, -H * 0.27, 3.4, 2.3)); ctx.fill(); }
  ctx.restore();

  // ---- freckles and marks: flat printed detail under the features
  if (s.marks.includes("freckles")) {
    ctx.fillStyle = tone(skin, "deep"); ctx.globalAlpha = 0.45;
    for (const [x, y] of [[-8, -15], [-6.5, -13.5], [-9.4, -13], [6.6, -14.6], [8.6, -13.4], [7.2, -12.6], [-1.6, -16.5], [1.8, -16.2]]) { trace(ctx, ellipse(x * W / 44, y * H / 50, 0.42)); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (s.marks.includes("mole")) { ctx.fillStyle = deep; trace(ctx, ellipse(W * 0.2, -H * 0.2, 0.5)); ctx.fill(); }
  if (s.marks.includes("birthmark")) {
    const c = mix(skin, luma(skin) < 0.4 ? "#1C0F08" : "#8A5A3A", luma(skin) < 0.4 ? 0.38 : 0.32), x = -W * 0.31, y = -H * 0.335;
    ctx.fillStyle = c; ctx.globalAlpha = 0.4; trace(ctx, blob(x, y, 2.3, 1.7, 3)); ctx.fill();
    ctx.globalAlpha = 0.85; trace(ctx, blob(x + 0.1, y, 1.75, 1.25, 7)); ctx.fill(); ctx.globalAlpha = 1;
  }
  drawLines(ctx, s, f, kid);
  // a full face's soft double chin: a faint shade arc above the chin (not on toddlers, not under a beard)
  if (s.shape === "full" && s.build !== "toddler" && !(s.facialHair && s.facialHair.style !== "stubble" && !MOUSTACHES.has(s.facialHair.style))) {
    ctx.strokeStyle = shade; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.5; ctx.lineCap = "round";
    trace(ctx, smooth([[-W * 0.2, -H * 0.035], [0, -H * 0.012], [W * 0.2, -H * 0.035]], false, 1)); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---- facial hair under the mouth (beards); clipped by the jaw so it follows the head
  const fh = s.facialHair;
  if (fh && !MOUSTACHES.has(fh.style)) {
    ctx.save(); trace(ctx, head); ctx.clip();
    const mw = W * 0.17, my = MOUTH_Y(H, kid);
    if (fh.style === "stubble") {
      ctx.globalAlpha = 0.28; ctx.fillStyle = fh.color;
      trace(ctx, smooth([[-W * 0.47, -H * 0.36], [-W * 0.3, -H * 0.22], [-mw, -H * 0.24], [0, -H * 0.26], [mw, -H * 0.24], [W * 0.3, -H * 0.22], [W * 0.47, -H * 0.36], [W * 0.5, 2], [-W * 0.5, 2]], true, 0.8)); ctx.fill();
    } else if (fh.style === "goatee") {
      // a chin patch only, from just under the lower lip to the chin
      const gw = W * 0.15;
      ctx.fillStyle = fh.color;
      trace(ctx, smooth([[-gw * 0.4, my + 2.4], [0, my + 2.1], [gw * 0.4, my + 2.4], [gw * 0.72, -H * 0.1], [gw * 0.6, -H * 0.03], [0, 1.2], [-gw * 0.6, -H * 0.03], [-gw * 0.72, -H * 0.1]], true, 1)); ctx.fill();
      ctx.fillStyle = tone(fh.color, "light"); ctx.globalAlpha = 0.22;
      trace(ctx, smooth([[gw * 0.12, my + 3.4], [gw * 0.45, -H * 0.1], [gw * 0.25, -H * 0.05]], true)); ctx.fill();
    } else if (fh.style === "beard_trimmed") {
      // cropped close and kept neat: a crisp cheek line from the sideburn down to the mouth corners with a
      // light cut rim along it, down to the jaw (the rest of its outline is clipped away by the head)
      const beard = smooth([[-W * 0.5, -H * 0.45, 0], [-W * 0.44, -H * 0.34], [-W * 0.33, -H * 0.29], [-mw * 1.08, -H * 0.255, 0], [0, -H * 0.25], [mw * 1.08, -H * 0.255, 0], [W * 0.33, -H * 0.29], [W * 0.44, -H * 0.34], [W * 0.5, -H * 0.45, 0], [W * 0.5, 3, 0], [-W * 0.5, 3, 0]], true, 0.9);
      ctx.fillStyle = fh.color; trace(ctx, beard); ctx.fill();
      ctx.strokeStyle = tone(fh.color, "edge"); ctx.lineWidth = 0.35; ctx.globalAlpha = 0.45; ctx.stroke();
    } else if (fh.style === "beard_no_moustache") {
      // the short beard with the upper lip bare: the hair rises to the mouth corners and under the lower lip
      ctx.fillStyle = fh.color;
      trace(ctx, smooth([[-W * 0.5, -H * 0.4], [-W * 0.38, -H * 0.25], [-mw * 1.15, my - 0.4], [-mw * 0.75, my + 1.8], [0, my + 2.2], [mw * 0.75, my + 1.8], [mw * 1.15, my - 0.4], [W * 0.38, -H * 0.25], [W * 0.5, -H * 0.4], [W * 0.46, -H * 0.05], [W * 0.2, 1.8], [0, 3], [-W * 0.2, 1.8], [-W * 0.46, -H * 0.05]], true, 0.9));
      ctx.fill();
      ctx.fillStyle = tone(fh.color, "light"); ctx.globalAlpha = 0.25;
      trace(ctx, smooth([[W * 0.08, -H * 0.06], [W * 0.26, -H * 0.12], [W * 0.18, -H * 0.02]], true)); ctx.fill();
    } else {
      // a long beard fills the jaw like a full one; its hanging part is a piece of its own (`facialHairItems`)
      const low = fh.style === "beard_long" ? 9 : fh.style === "beard_full" ? 7 : 3;
      ctx.fillStyle = fh.color;
      trace(ctx, smooth([[-W * 0.5, -H * 0.4], [-W * 0.36, -H * 0.24], [-mw * 1.1, -H * 0.22], [0, -H * 0.235], [mw * 1.1, -H * 0.22], [W * 0.36, -H * 0.24], [W * 0.5, -H * 0.4], [W * 0.46, -H * 0.05], [W * 0.2, low * 0.6], [0, low], [-W * 0.2, low * 0.6], [-W * 0.46, -H * 0.05]], true, 0.9));
      ctx.fill();
      ctx.fillStyle = tone(fh.color, "light"); ctx.globalAlpha = 0.25;
      trace(ctx, smooth([[W * 0.08, -H * 0.06], [W * 0.26, -H * 0.12], [W * 0.18, -H * 0.02]], true)); ctx.fill();
    }
    ctx.restore();
  }

  // ---- nose
  drawNose(ctx, s);

  // ---- mouth
  drawMouth(ctx, s, f, kid);
  if (fh && fh.style !== "stubble" && fh.style !== "goatee" && fh.style !== "beard_no_moustache") drawMoustache(ctx, s, fh.color, fh.style, f);

  // ---- eyes
  for (const side of [1, -1] as const) drawEye(ctx, s, f, side, kid);

  // ---- brows
  drawBrows(ctx, s, f, kid);

  // ---- sweat and tears
  if (f.sweat > 0.02) {
    // at the temple, below where a fringe ends
    const k = f.sweat, x = W * 0.43, y = -H * 0.5;
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.fillStyle = "#BFE3F2";
    trace(ctx, smooth([[x, y - 3.2 * k], [x + 1.5 * k, y + 0.6 * k], [x, y + 1.9 * k], [x - 1.5 * k, y + 0.6 * k]], true, 1)); ctx.fill();
    ctx.fillStyle = "#FFFFFF"; trace(ctx, ellipse(x - 0.4 * k, y + 0.2 * k, 0.35 * k, 0.6 * k)); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (f.tears > 0.02) {
    ctx.fillStyle = "#BFE3F2"; ctx.globalAlpha = Math.min(1, f.tears * 1.3);
    for (const side of [1, -1]) {
      const e = eyeAt(W, H, side as 1 | -1), x = e[0] + side * 1.4, y = e[1] + 4.6, k = 0.6 + f.tears * 0.8;
      trace(ctx, smooth([[x, y - 1.6 * k], [x + 0.9 * k, y + 0.4 * k], [x, y + 1.3 * k], [x - 0.9 * k, y + 0.4 * k]], true, 1)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Vitiligo: a few pale patches, uneven between the sides, kept clear of the eyes (face only: the neck and hands are body pieces). */
function drawVitiligo(ctx: Ctx, s: KitFaceStyle) {
  const W = s.headW, H = s.headH, pale = mix(s.skin, "#F6E9DF", 0.76), rim = tone(s.skin, "shade");
  const e = eyeAt(W, H, 1), rx = W * 0.083;
  const patches: [number, number, number, number, number][] = [
    [e[0] + rx * 2.05, e[1] + 1.2, 1.7, 2.6, 1], // beside one eye's outer corner, clear of the eye
    [-e[0] - rx * 1.95, e[1] + 0.8, 1.15, 1.6, 2], // a smaller one at the other
    [-W * 0.16, -H * 0.19, 1.8, 1.5, 4], // at a mouth corner
    [W * 0.1, -H * 0.635, 2.4, 1.6, 5], // on the forehead, below where a short fringe ends
    [W * 0.05, -H * 0.06, 1.5, 1.1, 6], // on the chin
  ];
  ctx.fillStyle = pale; ctx.beginPath();
  for (const [x, y, a, b, seed] of patches) blob(x, y, a, b, seed).trace(ctx);
  ctx.fill();
  ctx.strokeStyle = rim; ctx.globalAlpha = 0.2; ctx.lineWidth = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
}

/** The age lines and dimples: flat creases in the skin's deep tone that read the expression (a smile deepens them). */
function drawLines(ctx: Ctx, s: KitFaceStyle, f: FaceParams, kid: boolean) {
  const W = s.headW, H = s.headH, m = s.marks, sm = Math.max(0, f.mouth.smile), skin = s.skin;
  const deepAll = m.includes("wrinkles_deep"), w = deepAll ? 0.55 : 0.42, boost = deepAll ? 0.2 : 0;
  const my = MOUTH_Y(H, kid), hw = mouthHalf(s, f.mouth), lift = f.mouth.smile * 2.2;
  const S = [1, -1] as const;
  if (m.includes("dimples")) {
    // a short curve beside each mouth corner with a light edge outside it; it shows as the mouth smiles
    const a = 0.12 + 0.43 * Math.min(1, sm * 1.1), y = my - lift - 0.3, x = (side: number) => side * (hw + 1.1);
    crease(ctx, skin, S.map(side => [[x(side) - side * 0.3, y - 0.9], [x(side) + side * 0.15, y], [x(side) - side * 0.2, y + 0.8]] as Vec2[]), 0.45, a);
    ctx.strokeStyle = tone(skin, "light"); ctx.globalAlpha = a * 0.6; ctx.lineWidth = 0.35; ctx.beginPath();
    for (const side of S) smooth([[x(side) + side * 0.4, y - 0.8], [x(side) + side * 0.75, y], [x(side) + side * 0.4, y + 0.7]], false, 1).trace(ctx);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (m.includes("laugh_lines") || deepAll) {
    // from the nose wings round the mouth corners, deeper with the smile
    const cx = hw + 1.2 + sm * 0.6;
    crease(ctx, skin, S.map(side => [[side * W * 0.1, -H * 0.3], [side * (W * 0.155 + sm * 0.5), -H * 0.255], [side * cx, my - lift * 0.4 + 0.2], [side * (cx - 0.35), my - lift * 0.6 + 1.3]] as Vec2[]), w, 0.3 + boost + 0.2 * sm);
  }
  if (m.includes("crows_feet") || deepAll) {
    // a small fan of curved lines beyond each outer eye corner, the outer ones bending away; a squint deepens them
    const n = deepAll ? 4 : 3, lines: Vec2[][] = [];
    for (const side of S) {
      const e = eyeAt(W, H, side), ox = e[0] + side * W * 0.1, oy = e[1] + 0.2;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) - 0.5, ang = u * 62 * Math.PI / 180, l = 1.9 - Math.abs(u) * 0.5, r0 = 1.1;
        const dx = side * Math.cos(ang), dy = Math.sin(ang), bend = u * 0.5;
        lines.push([[ox + dx * r0, oy + dy * r0], [ox + dx * (r0 + l * 0.5), oy + dy * (r0 + l * 0.5) + bend * 0.5], [ox + dx * (r0 + l), oy + dy * (r0 + l) + bend * 1.4]]);
      }
    }
    crease(ctx, skin, lines, w * 0.8, 0.24 + boost + 0.3 * Math.max(f.lower[0], f.lower[1]));
  }
  if (m.includes("forehead_lines") || deepAll) {
    // two level lines (three on an elder) that rise with the brows
    const up = ((f.brows.l[0] + f.brows.l[1] + f.brows.r[0] + f.brows.r[1]) / 4) * 1.6;
    const rows = deepAll || s.build === "elder" ? [0.66, 0.715, 0.77] : [0.67, 0.73];
    crease(ctx, skin, rows.map((r, i): Vec2[] => {
      const y = -H * r - up * (1 - i * 0.15), hw2 = W * (0.24 - i * 0.03);
      return [[-hw2, y + 0.5], [-hw2 * 0.4, y - 0.2], [0, y + 0.15], [hw2 * 0.45, y - 0.25], [hw2, y + 0.45]];
    }), w * 0.9, 0.28 + boost + Math.max(0, up) * 0.12);
  }
  if (deepAll) {
    // marionette lines from the mouth corners towards the jaw, two frown lines between the brows, a chin crease
    const by = eyeAt(W, H, 1)[1] - H * 0.09;
    crease(ctx, skin, [
      ...S.map(side => [[side * (hw + 0.4), my + 0.8], [side * (hw + 0.7), my + 2.8], [side * (hw + 0.5), my + 4.4]] as Vec2[]),
      ...S.map(side => [[side * 0.9, by - 2.4], [side * 0.75, by - 1.2], [side * 0.8, by]] as Vec2[]),
      [[-1.4, -H * 0.075], [0, -H * 0.083], [1.4, -H * 0.075]],
    ], w * 0.9, 0.3 + boost);
  }
}

function drawNose(ctx: Ctx, s: KitFaceStyle) {
  const H = s.headH, skin = s.skin, deep = tone(skin, "deep"), shade = tone(skin, "shade"), ny = -H * 0.305;
  const fill = mix(shade, skin, 0.35);
  let hl: [number, number, number, number] = [-0.5, ny + 0.4, 0.6, 0.45], nostrils = true, line = [1.3, 1.9, 2.4];
  ctx.fillStyle = fill;
  if (s.nose === "long") { trace(ctx, smooth([[0.6, ny - 6], [1.9, ny - 0.5], [1.4, ny + 1.4], [-1.2, ny + 1.5], [-0.4, ny + 0.6], [0.6, ny - 0.2]], true, 0.9)); ctx.fill(); }
  else if (s.nose === "round") { trace(ctx, ellipse(0, ny + 0.2, 2.9, 2.2)); ctx.fill(); }
  else if (s.nose === "small") { trace(ctx, ellipse(0, ny + 0.6, 1.5, 1.1)); ctx.fill(); }
  else if (s.nose === "aquiline") {
    // a high bridge, shown by shading only (there are no profiles): a strip down the shadow side, a light on the bump
    ctx.globalAlpha = 0.55;
    trace(ctx, smooth([[0.5, ny - 8.2], [1.25, ny - 5.2], [1.35, ny - 2], [0.6, ny - 1.5], [0.55, ny - 5], [0.2, ny - 8]], true, 1)); ctx.fill();
    ctx.globalAlpha = 1;
    trace(ctx, smooth([[-1.5, ny + 1.9], [-0.7, ny - 0.6], [0.8, ny - 0.6], [1.6, ny + 1.9], [0, ny + 2.6]], true, 1)); ctx.fill();
    hl = [-0.35, ny - 4.6, 0.38, 1.1]; line = [1.1, 2.3, 2.9];
  } else if (s.nose === "broad") {
    // wide wings under a low, flat bridge; the light on the tip
    ctx.globalAlpha = 0.4; trace(ctx, smooth([[-0.5, ny - 3.4], [0.6, ny - 3.4], [1.1, ny - 0.5], [-1, ny - 0.5]], true, 1)); ctx.fill(); ctx.globalAlpha = 1;
    trace(ctx, smooth([[-3.3, ny + 1.3], [-2.3, ny - 0.4], [0, ny - 1.2], [2.3, ny - 0.4], [3.3, ny + 1.3], [2, ny + 2.4], [0, ny + 2.2], [-2, ny + 2.4]], true, 1)); ctx.fill();
    ctx.strokeStyle = deep; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.4; ctx.lineCap = "round";
    for (const side of [1, -1]) { trace(ctx, smooth([[side * 2.1, ny - 0.1], [side * 1.5, ny + 0.9], [side * 1.9, ny + 1.8]], false, 1)); ctx.stroke(); }
    ctx.globalAlpha = 1;
    hl = [0, ny + 0.5, 0.8, 0.5]; line = [1.6, 2.1, 2.5];
  } else if (s.nose === "upturned") {
    // a short nose with its tip lifted: two small nostrils show instead of the line under it
    trace(ctx, smooth([[-1.7, ny + 1.2], [-0.8, ny - 0.9], [0.8, ny - 0.9], [1.7, ny + 1.2], [0, ny + 1.7]], true, 1)); ctx.fill();
    ctx.fillStyle = mix(deep, "#2A1C16", 0.3); ctx.globalAlpha = 0.6;
    for (const side of [1, -1]) { trace(ctx, ellipse(side * 0.72, ny + 1.15, 0.48, 0.3)); ctx.fill(); }
    ctx.globalAlpha = 1; nostrils = false; hl = [-0.2, ny - 0.15, 0.6, 0.42];
  }
  else { trace(ctx, smooth([[-1.9, ny + 1.4], [-0.6, ny - 0.4], [0.9, ny - 0.2], [1.9, ny + 1.4], [0, ny + 2.1]], true, 1)); ctx.fill(); }
  if (nostrils) {
    ctx.strokeStyle = deep; ctx.globalAlpha = 0.45; ctx.lineWidth = 0.45;
    trace(ctx, smooth([[-line[0], ny + line[1]], [0, ny + line[2]], [line[0], ny + line[1]]], false, 1)); ctx.stroke();
  }
  ctx.fillStyle = tone(skin, "light"); ctx.globalAlpha = 0.55;
  trace(ctx, ellipse(hl[0], hl[1], hl[2], hl[3])); ctx.fill(); ctx.globalAlpha = 1;
}

function drawBrows(ctx: Ctx, s: KitFaceStyle, f: FaceParams, kid: boolean) {
  const W = s.headW, H = s.headH, b = s.brows, inners: Vec2[] = [];
  const thick = b === "thick" ? 2.3 : b === "thin" ? 1.05 : b === "straight" ? 1.7 : b === "bushy" ? 2.7 : b === "joined" ? 1.9 : 1.6;
  const arch = b === "arched" ? 1.2 : b === "straight" ? 0.05 : b === "bushy" ? 0.45 : 0.6;
  const len = b === "bushy" ? 1.08 : 1, reachIn = b === "joined" ? 0.135 : 0.11;
  ctx.fillStyle = s.browColor;
  for (const side of [1, -1] as const) {
    const [inner, outer] = side === 1 ? f.brows.l : f.brows.r;
    const e = eyeAt(W, H, side), by = e[1] - H * (kid ? 0.115 : 0.125);
    const ix = e[0] - side * W * reachIn * len, ox = e[0] + side * W * 0.115 * len;
    const iy = by - inner * 2.6 + (b === "straight" ? 0.3 : 0), oy = by + 0.6 - outer * 2.4 - (b === "straight" ? 0.3 : 0);
    const mid: Vec2 = [(ix + ox) / 2 + side * 0.6, (iy + oy) / 2 - arch - (inner + outer) * 0.3];
    const taper = b === "straight" ? [thick * 1.05, thick, thick * 0.7] : [thick * 1.15, thick, thick * 0.55];
    trace(ctx, band([[ix, iy], mid, [ox, oy]], taper, 1)); ctx.fill();
    inners.push([ix, iy]);
    if (b === "bushy") {
      // the top edge broken by three tufts, and on an elder two long strands at the inner end
      for (const t of [0.22, 0.5, 0.76]) {
        const u = 1 - t, x = u * u * ix + 2 * u * t * mid[0] + t * t * ox, y = u * u * iy + 2 * u * t * mid[1] + t * t * oy;
        const r = thick * (0.32 - t * 0.12);
        trace(ctx, ellipse(x + side * 0.35, y - thick * 0.42, r * 1.25, r)); ctx.fill();
      }
      if (s.build === "elder") {
        ctx.strokeStyle = s.browColor; ctx.lineWidth = 0.3; ctx.lineCap = "round";
        for (const k of [0, 1]) { const x0 = ix + side * (0.5 + k * 1.1), y0 = iy - thick * 0.35 - (mid[1] < iy ? k * 0.3 : 0); trace(ctx, smooth([[x0, y0], [x0 + side * 0.9, y0 - 0.9 - k * 0.2], [x0 + side * 2, y0 - 1.1 - k * 0.2]], false, 1)); ctx.stroke(); }
      }
    }
  }
  if (b === "joined") {
    // the bridge between the inner ends follows both brows, so it bends, never tears
    const [a, c] = inners, my = (a[1] + c[1]) / 2 + 0.25;
    ctx.globalAlpha = 0.85;
    trace(ctx, band([[a[0] + 0.5, a[1] + 0.05], [0, my], [c[0] - 0.5, c[1] + 0.05]], [thick * 0.95, thick * 0.55, thick * 0.95], 1)); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (s.marks.includes("scar_brow")) {
    // a skin-coloured cut across one brow at a third of its length, with a faint line running on above and below it
    const [inner, outer] = f.brows.l;
    const e = eyeAt(W, H, 1), by = e[1] - H * (kid ? 0.115 : 0.125);
    const ix = e[0] - W * reachIn * len, ox = e[0] + W * 0.115 * len, t = 0.35;
    const x = ix + (ox - ix) * t, y = (by - inner * 2.6) * (1 - t) + (by + 0.6 - outer * 2.4) * t - arch * 0.6 - (inner + outer) * 0.15;
    ctx.fillStyle = s.skin;
    trace(ctx, smooth([[x - 0.75, y - thick * 0.9 - 0.3, 0], [x - 0.05, y - thick * 0.9 - 0.3, 0], [x + 0.75, y + thick * 0.9 + 0.3, 0], [x + 0.05, y + thick * 0.9 + 0.3, 0]], true, 1)); ctx.fill();
    ctx.strokeStyle = mix(tone(s.skin, "light"), s.skin, 0.2); ctx.lineWidth = 0.32; ctx.lineCap = "round"; ctx.globalAlpha = 0.9;
    trace(ctx, smooth([[x - 0.9, y - thick * 0.6 - 1.5], [x - 0.6, y - thick * 0.6 - 0.4]], false, 1)); ctx.stroke();
    trace(ctx, smooth([[x + 0.6, y + thick * 0.6 + 0.4], [x + 0.9, y + thick * 0.6 + 1.5]], false, 1)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEye(ctx: Ctx, s: KitFaceStyle, f: FaceParams, side: 1 | -1, kid: boolean) {
  const W = s.headW, H = s.headH, [cx, cy] = eyeAt(W, H, side), i = side === 1 ? 0 : 1;
  const open = Math.max(0, Math.min(1.25, f.eyeOpen[i])), tilt = f.lidTilt[i], low = f.lower[i];
  const deep = tone(s.skin, "deep"), kind = s.eyes;
  if (kind === "dot") {
    // simple ink eyes: they still close and squint
    const ry = 1.9 * Math.max(0.12, open) * (1 - low * 0.5);
    ctx.fillStyle = "#2A1C16";
    trace(ctx, ellipse(cx + f.pupil[0] * 0.5, cy + f.pupil[1] * 0.4, 1.45, ry)); ctx.fill();
    if (open > 0.3) { ctx.fillStyle = "#fff"; trace(ctx, ellipse(cx - 0.45 + f.pupil[0] * 0.5, cy - ry * 0.45, 0.42, 0.42)); ctx.fill(); }
    return;
  }
  // the upturned eye is the whole eye turned 9° about its centre, the outer corner up; the lids act on top
  const rot = kind === "upturned" ? -side * 9 * Math.PI / 180 : 0, co = Math.cos(rot), si = Math.sin(rot);
  const R = (p: P): P => { const dx = p[0] - cx, dy = p[1] - cy, q: P = [cx + dx * co - dy * si, cy + dx * si + dy * co]; if (p.length === 3) q.push(p[2]); return q; };
  const sm = (pts: P[], closed: boolean) => smooth(rot ? pts.map(R) : pts, closed, 1);
  const el = (x: number, y: number, a: number, b: number) => rot ? ellipse(x, y, a, b).transform(rotateAbout(rot, cx, cy)) : ellipse(x, y, a, b);

  const kidK = kid ? 1.12 : 1;
  let rx = W * 0.083 * kidK, ry = H * 0.088 * kidK * (1 + Math.max(0, open - 1) * 0.6);
  if (kind === "almond") { rx *= 1.1; ry *= 0.8; }
  else if (kind === "small") { rx *= 0.84; ry *= 0.84; }
  else if (kind === "monolid") { rx *= 1.1; ry *= 0.76; }
  else if (kind === "hooded") { ry *= 0.9; }
  else if (kind === "upturned") { rx *= 1.05; ry *= 0.88; }
  const eye = el(cx, cy, rx, ry);
  // the eye socket: a thin deep rim, like a hole cut in the paper
  ctx.fillStyle = deep; ctx.globalAlpha = 0.55;
  trace(ctx, el(cx, cy, rx + 0.35, ry + 0.35)); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save();
  trace(ctx, eye); ctx.clip();
  ctx.fillStyle = "#FBF8F3"; ctx.fill();
  // the iris keeps its size on the narrower eyes (it is cut by the lids, as a real one is), so they stay big and readable
  const ir = (kind === "monolid" ? Math.min(rx * 0.92, ry / 0.84) : kind === "upturned" || kind === "hooded" ? Math.min(rx, ry / 0.88) : Math.min(rx, ry)) * 0.8 * (0.92 + 0.08 * f.pupilSize);
  const px = cx + f.pupil[0] * (rx - ir * 0.75), py = cy + f.pupil[1] * Math.max(0.3, ry - ir * 0.7) + ry * 0.06;
  ctx.fillStyle = s.eyeColor; trace(ctx, ellipse(px, py, ir, ir)); ctx.fill();
  ctx.fillStyle = "#16100E"; trace(ctx, ellipse(px, py, ir * 0.52 * f.pupilSize, ir * 0.52 * f.pupilSize)); ctx.fill();
  ctx.fillStyle = "#FFFFFF"; trace(ctx, ellipse(px - ir * 0.36, py - ir * 0.38, ir * 0.27, ir * 0.27)); ctx.fill();
  ctx.globalAlpha = 0.7; trace(ctx, ellipse(px + ir * 0.34, py + ir * 0.3, ir * 0.12, ir * 0.12)); ctx.fill(); ctx.globalAlpha = 1;
  // upper lid: closes from the top; tilt lowers the inner corner (+) or raises it (−)
  const rest = kind === "sleepy" ? 0.22 : kind === "hooded" ? 0.14 : kind === "monolid" ? 0.05 : 0;
  const lidY = cy - ry + (2 * ry) * (1 - Math.min(1, open) + rest * open);
  const innerX = cx - side * rx * 1.2, outerX = cx + side * rx * 1.2;
  const innerY = lidY + tilt * ry * 0.75, outerY = lidY - tilt * ry * 0.35;
  // a monolid's lid is one smooth, flatter curve
  const bulge = -ry * (kind === "monolid" ? 0.12 : 0.28) * Math.min(1, open);
  ctx.fillStyle = s.skin;
  trace(ctx, sm([[innerX, cy - ry * 3, 0], [outerX, cy - ry * 3, 0], [outerX, outerY, 0], [cx, (innerY + outerY) / 2 + bulge], [innerX, innerY, 0]], true)); ctx.fill();
  // lower lid: a smile's squint rises from below
  if (low > 0.01) {
    const ly = cy + ry - 2 * ry * low * 0.62;
    trace(ctx, sm([[innerX, cy + ry * 3, 0], [outerX, cy + ry * 3, 0], [outerX, ly + ry * 0.2, 0], [cx, ly - ry * 0.18], [innerX, ly + ry * 0.2, 0]], true)); ctx.fill();
  }
  const fold = kind === "monolid" && open > 0.12;
  const fx = cx - side * rx * 0.78, ftop = Math.max(innerY, cy - ry * 0.8);
  if (fold) {
    // the inner corner's fold: the lid comes down over the corner in a small wedge of skin
    trace(ctx, sm([[cx - side * rx * 1.3, ftop - 1, 0], [fx, ftop + 0.2], [cx - side * rx * 0.86, cy + ry * 0.45], [cx - side * rx * 1.3, cy + ry, 0]], true)); ctx.fill();
  }
  ctx.restore();
  if (fold) {
    ctx.strokeStyle = tone(s.skin, "deep"); ctx.globalAlpha = 0.45; ctx.lineWidth = 0.35; ctx.lineCap = "round";
    trace(ctx, sm([[fx, ftop + 0.2], [cx - side * rx * 0.86, cy + ry * 0.1], [cx - side * rx * 0.9, cy + ry * 0.45]], false)); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the lash line along the lid
  ctx.strokeStyle = "#2A1C16"; ctx.lineWidth = open < 0.12 ? 0.75 : 0.6; ctx.lineCap = "round";
  if (open < 0.12) {
    trace(ctx, sm([[innerX * 0.92 + cx * 0.08, cy + 0.3], [cx, cy + 0.3 + (low > 0.3 ? -1.3 : 1.1)], [outerX * 0.92 + cx * 0.08, cy + 0.3]], false)); ctx.stroke();
  } else {
    const ly = Math.max(cy - ry, lidY), oy = Math.max(outerY, cy - ry * 0.45);
    trace(ctx, sm([[cx - side * rx * 0.98, Math.max(innerY, cy - ry * 0.6)], [cx, ly + bulge * 0.6], [cx + side * rx * 1.02, oy]], false)); ctx.stroke();
    const flick = kind === "upturned" ? 0.48 : kind === "monolid" ? 0.2 : 0.33;
    trace(ctx, sm([[cx + side * rx * 0.95, oy], [cx + side * rx * (0.95 + flick), oy - 0.9 - (kind === "upturned" ? 0.3 : 0)]], false)); ctx.stroke();
    if (kind === "hooded") {
      // the fold of skin that hangs over the lid, heavier towards the outer corner
      ctx.fillStyle = tone(s.skin, "shade"); ctx.globalAlpha = 0.45;
      const fy = Math.min(ly, cy - ry * 0.55) - 0.6, t = Math.max(0.5, ry * 0.14);
      const spine: P[] = [[cx - side * rx * 0.85, Math.max(innerY, cy - ry * 0.6) - 0.55], [cx, fy + bulge * 0.4], [cx + side * rx * 0.95, oy - 0.25], [cx + side * rx * 1.3, oy + 0.55]];
      trace(ctx, band((rot ? spine.map(R) : spine) as Vec2[], [t * 0.3, t, t * 1.5, t * 0.4], 1)); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawMouth(ctx: Ctx, s: KitFaceStyle, f: FaceParams, kid: boolean) {
  const m = f.mouth, cy = MOUTH_Y(s.headH, kid), hw = mouthHalf(s, m);
  const lift = m.smile * 2.2, open = Math.max(0, Math.min(1, m.open));
  const lip = mix(tone(s.skin, "deep"), "#8E3B36", 0.45), thin = s.mouth === "thin", bowed = s.mouth === "bowed";
  if (open < 0.06) {
    if (bowed) {
      // a small filled upper lip with a cupid's bow over the line, which it follows as the mouth smiles
      const yAt = (x: number) => cy - lift + (lift + m.smile * 1.6) * (1 - (x / hw) ** 2), k = 1 - 0.35 * Math.max(0, -m.smile);
      ctx.fillStyle = lip; ctx.globalAlpha = 0.8;
      trace(ctx, smooth([[-hw, yAt(-hw), 0], [-hw * 0.55, yAt(-hw * 0.55) - 0.6 * k], [-hw * 0.24, yAt(-hw * 0.24) - 0.9 * k], [0, yAt(0) - 0.5 * k], [hw * 0.24, yAt(hw * 0.24) - 0.9 * k], [hw * 0.55, yAt(hw * 0.55) - 0.6 * k], [hw, yAt(hw), 0], [hw * 0.5, yAt(hw * 0.5)], [0, yAt(0)], [-hw * 0.5, yAt(-hw * 0.5)]], true, 1));
      ctx.fill(); ctx.globalAlpha = 0.28; trace(ctx, ellipse(0, yAt(0) + 0.95, hw * 0.42, 0.6)); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = lip; ctx.lineWidth = thin ? 0.55 : 0.75; ctx.lineCap = "round";
    trace(ctx, smooth([[-hw, cy - lift], [0, cy + m.smile * 1.6], [hw, cy - lift]], false, 1)); ctx.stroke();
    if (s.mouth === "full") { ctx.globalAlpha = 0.35; ctx.fillStyle = lip; trace(ctx, ellipse(0, cy + 1.3 + m.smile * 0.6, hw * 0.45, 0.8)); ctx.fill(); ctx.globalAlpha = 1; }
    return;
  }
  const depth = 1.2 + open * 6.2 * (1 + m.round * 0.3);
  const top = cy - lift * 0.4 - open * 0.6 + Math.max(0, m.smile) * 0.4;
  // the bowed mouth keeps a shallow M along its top edge
  const dip = bowed ? 0.55 * (1 - m.round * 0.6) : 0;
  const shape = smooth([[-hw, cy - lift, 0], [-hw * 0.5, top - 0.2 - dip * 0.5], [0, top - (m.round * 0.6) + dip], [hw * 0.5, top - 0.2 - dip * 0.5], [hw, cy - lift, 0], [hw * 0.55, cy + depth * 0.8 - lift * 0.2], [0, cy + depth], [-hw * 0.55, cy + depth * 0.8 - lift * 0.2]], true, 1);
  ctx.save();
  trace(ctx, shape); ctx.fillStyle = MOUTH_IN; ctx.fill(); ctx.clip();
  if (m.teeth > 0.05) { ctx.fillStyle = TEETH; ctx.fillRect(-hw, top - 2, hw * 2, 1.2 + m.teeth * 1.6 + 2); }
  ctx.fillStyle = TONGUE; trace(ctx, ellipse(0, cy + depth + 0.8, hw * 0.62, depth * 0.45)); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = lip; ctx.lineWidth = thin ? 0.4 : bowed ? 0.7 : 0.55; trace(ctx, shape); ctx.stroke();
}

function drawMoustache(ctx: Ctx, s: KitFaceStyle, c: string, style: string, f: FaceParams) {
  const W = s.headW, H = s.headH, y = -H * 0.235 - f.mouth.open * 0.6;
  // one size for the moustache and its highlight
  const chevron = style === "moustache_chevron", thick = style === "moustache_thick" || style === "beard_long", trim = style === "beard_trimmed";
  const w = W * (chevron ? 0.22 : thick ? 0.24 : trim ? 0.18 : 0.19), t = chevron ? 3 : thick ? 3.4 : trim ? 1.9 : 2.3;
  ctx.fillStyle = c;
  if (chevron) {
    // full and even over the upper lip, its lower edge on the lip line, the ends turned down at the corners
    const base = y + t * 0.45, lift = f.mouth.smile * 1.2;
    trace(ctx, smooth([[0, y - t * 0.5], [w * 0.6, y - t * 0.55], [w * 0.95, y - t * 0.1], [w * 1.04, base + 0.8 - lift, 0], [w * 0.78, base - lift * 0.6], [w * 0.4, base + 0.05], [0, base - 0.15], [-w * 0.4, base + 0.05], [-w * 0.78, base - lift * 0.6], [-w * 1.04, base + 0.8 - lift, 0], [-w * 0.95, y - t * 0.1], [-w * 0.6, y - t * 0.55]], true, 1));
    ctx.fill();
  } else {
    trace(ctx, smooth([[0, y - t * 0.7], [w * 0.55, y - t * 0.85], [w, y + t * 0.15], [w * 1.04, y + t * 0.75], [w * 0.5, y + t * 0.35], [0, y + t * 0.2], [-w * 0.5, y + t * 0.35], [-w * 1.04, y + t * 0.75], [-w, y + t * 0.15], [-w * 0.55, y - t * 0.85]], true, 1));
    ctx.fill();
  }
  ctx.fillStyle = tone(c, "light"); ctx.globalAlpha = 0.3;
  trace(ctx, smooth([[-w * 0.7, y - t * 0.3], [-w * 0.2, y - t * 0.55], [-w * 0.35, y - t * 0.1]], true)); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---- Emotions and mouth shapes (the kit's vocabulary, DESIGN.md §5.6) ----------

export const EMOTIONS: Record<string, FacePreset> = {
  neutral: {},
  happy: { lower: [0.45, 0.45], brows: { l: [0.25, 0.15], r: [0.25, 0.15] }, mouth: { smile: 0.9, open: 0.25, wide: 0.75, teeth: 0.7 }, blush: 0.2 },
  laugh: { eyeOpen: [0.1, 0.1], lower: [0.7, 0.7], brows: { l: [0.45, 0.2], r: [0.45, 0.2] }, mouth: { smile: 1, open: 0.8, wide: 0.85, teeth: 1 }, blush: 0.45, headTilt: -0.08 },
  sad: { eyeOpen: [0.8, 0.8], lidTilt: [-0.7, -0.7], pupil: [0, 0.35], brows: { l: [0.85, -0.35], r: [0.85, -0.35] }, mouth: { smile: -0.7, wide: 0.42 }, headTilt: 0.06, posture: -0.6 },
  surprised: { eyeOpen: [1.2, 1.2], pupilSize: 0.82, brows: { l: [0.9, 0.85], r: [0.9, 0.85] }, mouth: { open: 0.65, round: 0.8, wide: 0.3, smile: 0 }, posture: 0.4 },
  curious: { eyeOpen: [1.08, 0.95], pupil: [0.2, -0.1], brows: { l: [0.75, 0.6], r: [0.1, 0] }, mouth: { smile: 0.25, open: 0.08, wide: 0.42, round: 0.3 }, headTilt: 0.1 },
  confused: { eyeOpen: [1, 0.85], brows: { l: [0.7, 0.2], r: [-0.4, -0.2] }, mouth: { smile: -0.25, wide: 0.45, round: 0.15 }, headTilt: -0.12 },
  sorry: { eyeOpen: [0.85, 0.85], lidTilt: [-0.5, -0.5], brows: { l: [0.75, -0.15], r: [0.75, -0.15] }, mouth: { smile: -0.15, wide: 0.6 }, headTilt: 0.08, posture: -0.3 },
  annoyed: { eyeOpen: [0.68, 0.68], lidTilt: [0.55, 0.55], brows: { l: [-0.8, 0.15], r: [-0.8, 0.15] }, mouth: { smile: -0.4, wide: 0.48 }, posture: 0.2 },
  shy: { eyeOpen: [0.82, 0.82], pupil: [0.45, 0.55], lower: [0.2, 0.2], brows: { l: [0.35, 0], r: [0.35, 0] }, mouth: { smile: 0.4, wide: 0.35 }, blush: 0.75, headTilt: 0.14, posture: -0.3 },
  tired: { eyeOpen: [0.42, 0.42], brows: { l: [-0.1, -0.35], r: [-0.1, -0.35] }, mouth: { smile: -0.1, wide: 0.45 }, headTilt: 0.05, posture: -0.8 },
  nervous: { eyeOpen: [1.12, 1.12], pupilSize: 0.78, lidTilt: [-0.35, -0.35], brows: { l: [0.85, 0.15], r: [0.85, 0.15] }, mouth: { smile: -0.45, wide: 0.62, open: 0.12, teeth: 0.9 }, sweat: 1, posture: 0.15 },
  proud: { eyeOpen: [0.82, 0.82], lower: [0.35, 0.35], brows: { l: [0.3, 0.35], r: [0.3, 0.35] }, mouth: { smile: 0.75, wide: 0.62 }, headTilt: -0.06, posture: 0.8 },
  moved: { eyeOpen: [0.78, 0.78], lidTilt: [-0.45, -0.45], lower: [0.3, 0.3], brows: { l: [0.7, 0], r: [0.7, 0] }, mouth: { smile: 0.4, wide: 0.5 }, tears: 0.8, blush: 0.4, headTilt: 0.07 },
};

export const VISEMES: Record<string, Partial<FaceParams["mouth"]>> = {
  rest: { open: 0, round: 0 },
  MBP: { open: 0, wide: 0.42, round: 0.1 },
  A: { open: 0.75, wide: 0.6, round: 0.1, teeth: 0.5 },
  E: { open: 0.45, wide: 0.8, round: 0, teeth: 0.8 },
  I: { open: 0.28, wide: 0.9, round: 0, teeth: 0.9 },
  O: { open: 0.55, wide: 0.3, round: 0.85 },
  U: { open: 0.3, wide: 0.2, round: 1 },
  FV: { open: 0.15, wide: 0.6, round: 0, teeth: 1 },
};
