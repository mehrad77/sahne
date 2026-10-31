// Props: things a story names, shows, hides, gives and counts. Origin at the bottom centre.
// A prop in someone's hand is drawn with `held: true`, its origin at the grip: a prop may draw
// itself the way people carry it (bread stands in the crook of the arm). Words on a prop (a sign's
// label, a phone's screen) are `text` on its first flat, which the page lays out as HTML: never drawn.

import { ellipse, rrect, rect, tone, mul, rotate, translate, type Affine, type PieceDef, type Shape, type TextSpec, type Vec2 } from "sahne";
import { P, L } from "./draw.ts";
import { phoneFace } from "../carry.ts";

const CRUST = "#C8863F";

/** One somun lying on its base, centred on x = 0, its base at y = 0. */
function loaf(w = 26, h = 12): Shape[] {
  return [
    P([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2 - 1, -h * 0.55], [w * 0.3, -h], [-w * 0.3, -h], [-w / 2 + 1, -h * 0.55]], CRUST),
    L([[-w * 0.28, -h * 0.72], [-w * 0.05, -h * 0.9]], tone(CRUST, "light"), 1.6, 0.9), L([[w * 0.02, -h * 0.72], [w * 0.25, -h * 0.9]], tone(CRUST, "light"), 1.6, 0.9),
    { path: ellipse(-w * 0.15, -h * 0.66, w * 0.18, 1.4), fill: tone(CRUST, "light"), flat: true, opacity: 0.5 },
  ];
}
const place = (shapes: Shape[], m: Affine): Shape[] => shapes.map(s => ({ ...s, path: s.path.transform(m) }));

/**
 * Turkish bread loaves (somun); `n` is the count. On a counter they lie side by side. Held
 * (`held`), they stand on end in the crook of the arm, fanned a little against the chest, as
 * people carry bread home: still countable, and the forearm and hand go in front of them.
 */
const bread: PieceDef = { draw(p) {
  const n = typeof p.n === "number" ? p.n : 3, w = 26, h = 12, shapes: Shape[] = [];
  if (p.held) {
    const step = h * 0.85, x0 = -(n - 1) * step / 2;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.16, x = x0 + i * step;
      // stand the loaf on its end (its base towards the body), then fan it from the bottom
      shapes.push(...place(loaf(w, h), mul(translate(x, 0), mul(rotate(a), mul(translate(h / 2, -w / 2), rotate(-Math.PI / 2))))));
    }
    return { flats: [{ group: { shapes }, ppcm: 5, id: "bread" }] };
  }
  const gap = 4, total = n * w + (n - 1) * gap;
  for (let i = 0; i < n; i++) shapes.push(...place(loaf(w, h), translate(-total / 2 + i * (w + gap) + w / 2, 0)));
  return { flats: [{ group: { shapes }, ppcm: 5, shadow: "drop", id: "bread" }] };
},
  meta: {
    about: "Turkish somun loaves, side by side on a counter or stood on end in the crook of the arm when held.",
    params: { n: { type: "int", min: 0, default: 3, about: "how many loaves" } },
    tags: ["food"],
  } };

/** Simits stacked on a round tray. */
const simitTray: PieceDef = { draw(p) {
  const n = typeof p.n === "number" ? p.n : 5, shapes: Shape[] = [{ path: rrect(-24, -3, 48, 3, 1.5), fill: "#B8BEC4" }];
  const pos: Vec2[] = [[-12, -3], [0, -3], [12, -3], [-6, -9], [6, -9], [0, -15]].slice(0, n) as Vec2[];
  for (const [x, y] of pos) {
    const ring = ellipse(x, y - 4, 7.5, 4.2).add(ellipse(x, y - 4.3, 3.2, 1.5));
    shapes.push({ path: ring, fill: "#B5652A", evenodd: true });
    for (let k = 0; k < 7; k++) shapes.push({ path: ellipse(x - 5 + k * 1.7, y - 6.2 + (k % 2) * 1.2, 0.5, 0.35), fill: "#F2E1B8", flat: true });
  }
  return { flats: [{ group: { shapes }, ppcm: 5, shadow: "drop", id: "simit" }] };
},
  meta: {
    about: "Simits stacked on a round tray.",
    params: { n: { type: "int", min: 0, max: 6, default: 5, about: "how many simits" } },
    tags: ["food"],
  } };

/** Bottles of milk side by side; `n` is the count. */
const milk: PieceDef = { draw(p) {
  const n = typeof p.n === "number" ? p.n : 1, gap = 1.2, w = 9.2, total = n * w + (n - 1) * gap, shapes: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const x = -total / 2 + w / 2 + i * (w + gap);
    shapes.push(
      P([[x - 4.6, 0, 0], [x + 4.6, 0, 0], [x + 4.6, -15], [x + 2.8, -19.5], [x + 2.6, -22, 0], [x - 2.6, -22, 0], [x - 2.8, -19.5], [x - 4.6, -15]], "#FBF8F2"),
      { path: rrect(x - 2.8, -25.4, 5.6, 3.8, 1), fill: "#2E6FB6" },
      { path: rect(x - 4.6, -13, 9.2, 6.5), fill: "#5C93D1", flat: true },
      { path: ellipse(x, -9.8, 2, 1.5), fill: "#FBF8F2", flat: true },
    );
  }
  return { flats: [{ group: { shapes }, ppcm: 6, id: "milk" }] };
},
  meta: {
    about: "Bottles of milk side by side.",
    params: { n: { type: "int", min: 0, default: 1, about: "how many bottles" } },
    tags: ["food"],
  } };

/**
 * A fixed sign, `kind` `plate` or `post`: `plate` a `w` × `h` enamel plate (default 90 × 28) screwed to a wall or a
 * door, its origin the plate's bottom centre (lift it with the piece's `y`); `post` a `w` × `h` panel (default
 * 150 × 56) between two posts, its top at `top` cm (default 230), its origin the posts' feet. `label` in a print
 * font, `sub` a smaller second line, on `color` (default the city's navy) inside a white rule.
 */
function fixedSign(p: Record<string, unknown>, kit: { color(id: string): string }) {
  const post = p.kind === "post", w = typeof p.w === "number" ? p.w : post ? 150 : 90, h = typeof p.h === "number" ? p.h : post ? 56 : 28;
  const top = post ? -(typeof p.top === "number" ? p.top : 230) : -h, c = typeof p.color === "string" ? kit.color(p.color) : "#23406E", steel = "#9AA2A9";
  const k = Math.min(3, h * 0.12), rule = Math.max(2, h * 0.08);
  const shapes: Shape[] = [];
  if (post) for (const x of [-w / 2 + 12, w / 2 - 12]) shapes.push({ path: rect(x - 3, top + h / 2, 6, -top - h / 2), fill: steel }, { path: rect(x + 1, top + h / 2, 2, -top - h / 2), fill: tone(steel, "shade"), flat: true, opacity: 0.6 });
  shapes.push({ path: rrect(-w / 2, top, w, h, k), fill: "#F4F1EA" }, { path: rrect(-w / 2 + rule, top + rule, w - 2 * rule, h - 2 * rule, Math.max(0.5, k - rule / 2)), fill: c },
    { path: rect(-w / 2 + rule, top + h - rule - h * 0.12, w - 2 * rule, h * 0.12), fill: tone(c, "shade"), flat: true, opacity: 0.45 });
  if (!post) for (const x of [-w / 2 + rule * 2.2, w / 2 - rule * 2.2]) shapes.push({ path: ellipse(x, top + h / 2, rule * 0.7, rule * 0.7), fill: "#D9DDE0", flat: true });
  const label = typeof p.label === "string" ? p.label.trim() : "", sub = typeof p.sub === "string" ? p.sub.trim() : "";
  const pad = post ? rule * 3 : rule * 4, lh = sub ? (h - 2 * pad) * 0.62 : h - 2 * pad, text: TextSpec[] = [];
  // a line's size fits its length on one line (a print capital is about 0.62 of its size wide)
  const size = (t: string, bh: number) => Math.min(bh * 0.72, (w - 2 * pad) / (t.length * 0.62));
  if (label) text.push({ text: label, x: -w / 2 + pad, y: top + pad, w: w - 2 * pad, h: lh, size: size(label, lh), font: "print", color: "#FFFFFF", weight: 700 });
  if (sub) text.push({ text: sub, x: -w / 2 + pad, y: top + pad + lh, w: w - 2 * pad, h: h - 2 * pad - lh, size: size(sub, h - 2 * pad - lh), font: "print", color: "#FFFFFF" });
  return { flats: [{ group: { shapes, edge: 0.6 }, ppcm: 2, id: "sign", ...(text.length ? { text } : {}) }] };
}

/**
 * A hand-made welcome sign on a stick (the arrivals hall): a 70 × 36 cm board in `color` (default
 * teal) with a sheet of card taped on, and `label` on the card in a hand font. The origin is the
 * stick's foot, also in the hand: held, it stands up out of the fist, the same art. `kind` `plate` or
 * `post` is a fixed sign instead (`fixedSign`).
 */
const signBoard: PieceDef = { draw(p, _r, kit) {
  if ((p.kind === "plate" || p.kind === "post") && !p.held) return fixedSign(p, kit);
  // standing, the stick's foot is the origin; held, the hand grips it just under the board (the stick goes on below the fist), so it is shown at chest height, not before the face
  const w = 70, h = 36, up = p.held ? 5 : 32, below = p.held ? 12 : 0, top = -up - h, c = kit.color(typeof p.color === "string" ? p.color : "fab_06"), card = kit.color("fab_01"), wood = kit.color("fab_19");
  const board = rrect(-w / 2, top, w, h, 2.5), sheet = rrect(-w / 2 + 3, top + 3, w - 6, h - 6, 1);
  const tape = (x: number, a: number): Shape => ({ path: rect(-3.2, -1.1, 6.4, 2.2).transform(mul(translate(x, top + 3.4), rotate(a))), fill: kit.color("fab_02"), flat: true, opacity: 0.8 });
  const shapes: Shape[] = [
    { path: rrect(-1.6, top + h * 0.4, 3.2, up + below + h * 0.6, 0.8), fill: wood },
    L([[-0.7, below - 1], [-0.7, top + h + 2]], tone(wood, "light"), 0.6, 0.6),
    { path: board, fill: c },
    { path: rect(w / 2 - 3, top, 3, h), fill: tone(c, "shade"), flat: true, opacity: 0.55, clip: board },
    { path: sheet, fill: card },
    { path: rect(w / 2 - 6, top + 3, 3, h - 6), fill: tone(card, "shade"), flat: true, opacity: 0.35, clip: sheet },
    tape(-w / 2 + 6, -0.5), tape(w / 2 - 6, 0.5),
  ];
  const label = typeof p.label === "string" ? p.label.trim() : "";
  const text: TextSpec[] = label ? [{ text: label, x: -w / 2 + 4.5, y: top + 5, w: w - 9, h: h - 9, size: 9, font: "hand" }] : [];
  // held up, it is shown: over the arms, not cradled
  return { flats: [{ group: { shapes }, ppcm: 3, id: "sign", ...(p.held ? { front: true } : {}), ...(text.length ? { text } : {}) }] };
}, variants: { plate: { kind: "plate" }, post: { kind: "post" } },
  meta: {
    about: "A hand-made welcome sign on a stick: a board with a card taped on and a word in a hand font; held up out of the fist. Or a fixed sign: an enamel plate on a wall or door, or a panel on two posts.",
    params: {
      kind: { type: "enum", values: ["stick", "plate", "post"], default: "stick", about: "a sign on a stick, a plate on a wall or door, a panel on two posts" },
      color: { type: "color", default: "fab_06", about: "the board, a fabric id or a hex (fixed signs: the city's navy)" },
      label: { type: "text", about: "the word on the card; a fixed sign's main line" },
      sub: { type: "text", about: "a fixed sign's smaller second line" },
      w: { type: "num", min: 0, about: "a fixed sign's width, cm (plate 90, post 150)" },
      h: { type: "num", min: 0, about: "a fixed sign's height, cm (plate 28, post 56)" },
      top: { type: "num", min: 0, default: 230, about: "a post sign's top, cm above the ground" },
    },
    tags: ["sign", "paper"],
  } };

/** What a phone's `screen` says: a string, or `{ title, lines }` one per line. */
export function screenText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (!v || typeof v !== "object") return "";
  const o = v as { title?: unknown; lines?: unknown };
  return [o.title, ...(Array.isArray(o.lines) ? o.lines : [])].filter((x): x is string => typeof x === "string" && x.trim() !== "").join("\n");
}

/**
 * A phone standing upright, 7.2 × 14.8 cm, in a `color` case (default black): the same face as the held
 * part (`phone_held`). With a `screen` its words fill the screen below the status bar, self-lit; without
 * one it shows two message bubbles. Held, it stands up out of the fist, the screen to the viewer.
 */
const phone: PieceDef = { draw(p, _r, kit) {
  const w = 7.2, L = 14.8, x0 = -w / 2, y0 = -L, bz = w * 0.08, top = y0 + bz + L * 0.12, say = screenText(p.screen);
  const shapes = phoneFace(kit, kit.color(typeof p.color === "string" ? p.color : "fab_22"), x0, y0, w, L, false, say ? undefined : [top, top + L * 0.5]);
  const text: TextSpec[] = say ? [{ text: say, x: x0 + bz + 0.4, y: top + 0.4, w: w - 2 * bz - 0.8, h: L * 0.56, size: 1.1, align: "left", font: "screen", lit: 0 }] : [];
  return { flats: [{ group: { shapes }, ppcm: 12, id: "phone", ...(text.length ? { text } : {}) }] };
},
  meta: {
    about: "A phone standing upright, its screen showing words or two message bubbles; held, it stands up out of the fist.",
    params: {
      color: { type: "color", default: "fab_22", about: "the case, a fabric id or a hex" },
      screen: { type: "text", about: "a string, or {title, lines}; none shows two bubbles" },
    },
    tags: ["phone"],
  } };

export const PROPS: Record<string, PieceDef> = { bread, simit_tray: simitTray, milk, sign_board: signBoard, phone };

/** The family's set pieces and props (`index.ts`). */
export const set: Record<string, PieceDef> = {};
export const props = PROPS;
