// Set pieces and props of the vehicles family, following STYLE.md. Units cm; each flat's
// origin is its bottom centre, except a hanging thing's (the taxi mirror's scarf), which is where it hangs.
// A vehicle's window openings are holes, so what is drawn behind them (`scroll_view`, `skyline`, `traffic`)
// shows through, as in `metro_wall`. Words (a taxi's roof sign and plate, the tram's route board, a meter, a
// bus's next stop) are text boxes the page draws, never letters in the art. Riders in windows are faceless.

import { ellipse, groupBounds, rect, rrect, poly, smooth, tone, mix, type FlatMotion, type FlatSpec, type LightSpec, type Path, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { hex, S, P, L, num, str, holed, goes, copies, glowOnly, timetable, doorTimes, stopsParam, fit, fitText, rider, type Pt } from "./draw.ts";

const DARK = "#2B2F33", CHROME = "#C3C9CE", TYRE = "#232629", GLASS = "#4E6072", POLE = "#E2A72E";
/** Car colours as Istanbul's streets have them: mostly white, silver, grey and black. */
const CAR_COLORS = ["#F4F2EE", "#F4F2EE", "#C9CDD1", "#8E979E", "#3B3F45", "#2E3A59", "#9E2B25", "#5B7A8C", "#E9E1D2"];
const TAXI = "#F2C230", PLATE_L = ["AB", "KM", "FT", "DR", "ZN", "HY", "BC", "TL"];

/** The Turkish flag `w` wide with its hoist at (x, y), flying to the left (`dir` -1) or right. */
function flag(x: number, y: number, w: number, dir: number): Shape[] {
  const h = w * 2 / 3, x0 = dir < 0 ? x - w : x, cx = x0 + w * (dir < 0 ? 0.62 : 0.38), cy = y + h / 2, s = h * 0.12;
  const star = poly(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? s * 0.42 : s; return [cx + w * 0.17 * (dir < 0 ? -1 : 1) + Math.cos(a) * q, cy + Math.sin(a) * q] as Vec2; }));
  return [S(rect(x0, y, w, h), "#E30A17"), S(ellipse(cx, cy, h * 0.25), "#FFFFFF", { flat: true }), S(ellipse(cx + h * 0.06 * (dir < 0 ? -1 : 1), cy, h * 0.2), "#E30A17", { flat: true }), S(star, "#FFFFFF", { flat: true })];
}

// ---- Cars --------------------------------------------------------------------------------------

interface CarArt { sh: Shape[]; glow: Shape[]; tail: Shape[]; text: TextSpec[] }

/** A car side on, facing right, `len` cm long, wheels on y = 0: `kind` sedan, hatch, van (a minibus) or taxi (a sedan with its roof sign `sign`), in `c`; `plate` (and a taxi's `stand` on its door) as text. */
function carArt(len: number, c: string, kind: string, r: Rng, plate = "", sign = "", stand = ""): CarArt {
  const van = kind === "van", hatch = kind === "hatch", sh: Shape[] = [], text: TextSpec[] = [];
  const R = van ? 33 : 30, wx = van ? 140 : 133, roof = van ? -208 : -141;
  const body = smooth((van ? [[-214, -20, 0], [-217, -200, 0], [-206, -208, 0], [126, -208, 0], [160, -190], [200, -122], [212, -100], [217, -46], [210, -20, 0]]
    : hatch ? [[-200, -18, 0], [-206, -50], [-203, -90], [-190, -128], [-160, -141], [38, -141], [66, -131], [104, -92, 0], [150, -82], [196, -70], [205, -46], [198, -18, 0]]
      : [[-212, -18, 0], [-215, -48], [-213, -72], [-196, -88], [-140, -92, 0], [-100, -132], [-62, -141], [38, -141], [66, -131], [104, -92, 0], [150, -82], [205, -70], [215, -46], [208, -18, 0]]) as Pt[], true, 1);
  const glass = van ? rrect(-196, -184, 300, 54, 6).add(poly([[112, -184], [146, -184], [184, -128], [112, -128]]))
    : smooth((hatch ? [[-186, -95, 0], [-180, -126], [-158, -136], [34, -136], [58, -127], [90, -95, 0]] : [[-128, -95, 0], [-96, -129], [-62, -136], [34, -136], [58, -127], [90, -95, 0]]) as Pt[], true, 1);
  const front = van ? 214 : hatch ? 203 : 212, back = van ? -216 : hatch ? -204 : -214;
  sh.push(S(body, c), S(rect(-230, -46, 460, 26), tone(c, "shade"), { flat: true, opacity: 0.32, clip: body }), L([[-130, -88], [150, -80]], tone(c, "light"), 2.2, 0.55));
  sh.push(S(rect(front - 26, -36, 30, 18), "#3B3F45", { clip: body }), S(rect(back - 4, -36, 28, 18), "#3B3F45", { clip: body }));
  // the glass (an actor behind shows through it, dimly), headrests inside, pillars and glints
  sh.push(S(glass, GLASS, { flat: true, opacity: 0.55 }), S(rrect(16, roof + 14, 16, 18, 5), "#25292D", { flat: true, opacity: 0.45, clip: glass }), S(rrect(-80, roof + 16, 16, 18, 5), "#25292D", { flat: true, opacity: 0.45, clip: glass }));
  sh.push(...(van ? [-96, 0] : [-26]).map(x => S(rect(x, roof + 2, 9, (van ? 58 : 46)), DARK)), L([[-40, -100], [-10, roof + 8]], "#FFFFFF", 3, 0.25), L([[40, -100], [62, -126]], "#FFFFFF", 2, 0.2));
  // doors, handles, the mirror, lights
  for (const x of van ? [-40, 0, 108] : hatch ? [-28, 104] : [-126, -28, 104]) sh.push(L([[x, van ? -128 : -92], [x, -24]], tone(c, "deep"), 1.2, 0.6));
  for (const x of van ? [-30, 120] : [-70, 48]) sh.push(S(rrect(x, van ? -118 : -84, 16, 4, 2), tone(c, "deep")));
  sh.push(P([[van ? 186 : 96, van ? -132 : -100, 0], [van ? 200 : 112, van ? -138 : -106, 0], [van ? 202 : 114, van ? -126 : -96, 0], [van ? 188 : 100, van ? -124 : -94, 0]], c));
  const hl: Pt[] = van ? [[200, -104, 0], [214, -100, 0], [216, -90, 0], [202, -92, 0]] : [[front - 18, -74, 0], [front - 2, -69, 0], [front, -60, 0], [front - 16, -62, 0]];
  const tl: Pt[] = van ? [[-217, -112, 0], [-210, -112, 0], [-210, -82, 0], [-217, -82, 0]] : [[back, -77, 0], [back + 10, -79, 0], [back + 10, -64, 0], [back, -62, 0]];
  sh.push(P(hl, "#F4F1E0"), P(tl, "#B3261E"));
  const glow = [S(ellipse(front - 4, van ? -96 : -66, 14, 9), "#FFF3C4", { flat: true })], tail = [S(ellipse(back + 4, van ? -96 : -70, 9, 11), "#FF4A3A", { flat: true })];
  // wheels in their arches
  for (const x of [-wx, wx]) {
    let lug = ellipse(x + R * 0.36, -R, R * 0.09);
    for (let i = 1; i < 5; i++) lug = lug.add(ellipse(x + Math.cos(i * 1.2566) * R * 0.36, -R + Math.sin(i * 1.2566) * R * 0.36, R * 0.09));
    sh.push(S(ellipse(x, -R, R * 1.18), "#1E2124", { flat: true, clip: rect(x - 2 * R, -3 * R, 4 * R, 2.55 * R) }), S(ellipse(x, -R, R), TYRE), S(ellipse(x, -R, R * 0.6), "#B9BFC4"), S(lug, "#8E979E", { flat: true }), S(ellipse(x, -R, R * 0.16), "#8E979E", { flat: true }));
  }
  if (kind === "taxi") {
    sh.push(S(rect(-24, roof - 3, 48, 3), DARK), S(rrect(-33, roof - 18, 66, 15, 3), "#F7F1DE"), S(rect(-33, roof - 6, 66, 3), DARK, { flat: true, opacity: 0.6 }));
    glow.push(S(rrect(-36, roof - 21, 72, 21, 6), "#FFF3C4", { flat: true, opacity: 0.8 }));
    if (sign) text.push({ text: sign, x: -31, y: roof - 17, w: 62, h: 11, size: 8.5, color: "#2B2420", font: "print", weight: 800 });
    if (stand) text.push({ text: stand, x: -20, y: -78, w: 116, h: 13, size: 7, color: "#2B2420", font: "print", weight: 700 });
  }
  if (plate) { sh.push(S(rrect(back + 1, -56, 40, 10, 1), "#F7F7F2"), S(rect(back + 1, -56, 5, 10), "#2E4FA0", { flat: true })); text.push({ text: plate, x: back + 7, y: -55.5, w: 33, h: 9, size: 6.2, color: "#1E1E20", font: "print", weight: 700 }); }
  return { sh, glow, tail, text };
}

/**
 * A car from outside, side on, facing right (`dir` -1 left), its wheels on the ground: `kind` sedan (default), hatch, van or
 * taxi, `len` cm long, in `color` (a taxi is yellow; a plain car takes a seeded street colour). Its glass is dark but see-through,
 * so someone sitting behind it shows. The plate is text (`plate`, a seeded Istanbul plate, a taxi's "34 T …"); a taxi has its
 * roof sign (`sign`, default "TAKSİ"), lit at night, and its stand's name on the door (`stand`, none by default). Head and
 * tail lights glow at night. It can drive along `go` (`ms`, `wait`, `phase`). `n` cars in a row.
 */
const car: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "sedan"), taxi = kind === "taxi", n = Math.max(1, Math.round(num(p.n, 1))), len = num(p.len, kind === "van" ? 460 : kind === "hatch" ? 405 : 430);
  const dir = num(p.dir, 1) < 0 ? -1 : 1, gap = len + 60, c = hex(p.color, taxi ? TAXI : r.pick(CAR_COLORS)), move = goes(p), k = len / 430;
  const sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap, plate = str(p.plate, taxi ? `34 T ${r.int(1000, 9999)}` : `34 ${r.pick(PLATE_L)} ${r.int(100, 9999)}`);
    const a = carArt(430, c, kind, r, plate, taxi ? str(p.sign, "TAKSİ") : "", taxi ? str(p.stand, "") : "");
    sh.push(...fit(a.sh, k, dir, x)); glow.push(...fit([...a.glow, ...a.tail], k, dir, x)); text.push(...fitText(a.text, k, dir, x));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, emissive: { shapes: glow, edge: 0 }, switch: false, ppcm: Math.min(2.5, 1900 / ((n - 1) * gap + len + 20)), id: "car", ...(text.length ? { text } : {}), ...(move ? { move } : {}) }] };
}, variants: { taxi: { kind: "taxi" } },
  meta: {
    about: "A car side on: a sedan, hatchback, minibus or yellow taxi with its roof sign, plate as text; it can drive along a path.",
    params: {
      kind: { type: "enum", values: ["sedan", "hatch", "van", "taxi"], default: "sedan" },
      len: { type: "num", about: "cm; sedan 430, hatch 405, van 460" },
      dir: { type: "int", min: -1, max: 1, default: 1, about: "-1 faces left" },
      color: { type: "color", about: "a palette id or a hex; taxi yellow, else a seeded street colour" },
      n: { type: "int", min: 1, default: 1, about: "how many in a row" },
      plate: { type: "text", about: "default a seeded Istanbul plate" },
      sign: { type: "text", default: "TAKSİ", about: "a taxi's roof sign" },
      stand: { type: "text", default: "", about: "a taxi's stand name on the door" },
      go: { type: "list", about: "a path of [x, y, z] points (cm) it drives along" },
      ms: { type: "num", min: 500, default: 20000, about: "the drive's time along go, ms" },
      wait: { type: "num", min: 0, default: 0, about: "ms between drives" },
      hide: { type: "bool", default: true, about: "hidden while it waits" },
      phase: { type: "num", default: 0, about: "where along go it starts, 0…1" },
    },
    terms: ["a1-w-araba", "a1-w-taksi"],
    tags: ["vehicle"],
  } };

/**
 * Cars in a city street seen through a window, a seamless strip like `scroll_view`'s: the far pavement and kerb, the road
 * and its lane marks, a far lane of cars going left (smaller, hazier) and a near lane going right, in seeded street
 * colours, a yellow taxi in most strips, now and then a courier's scooter. Stopped (a jam: brake lights at night), or
 * `moving`: the strip slides by `dx` cm every `ms` (from `phase`) and covers `w` cm plus its period.
 */
const traffic: PieceDef = { draw(p, r) {
  const moving = !!p.moving, dx = num(p.dx, -1400), ms = num(p.ms, 7000), w = num(p.w, 1600), per = moving ? Math.abs(dx) || 1400 : w + 400;
  const lo = moving ? -w / 2 - Math.max(0, dx) : -per / 2, hi = moving ? w / 2 + Math.max(0, -dx) : per / 2;
  const rep = (ss: Shape[]) => ss.map(s => moving ? { ...s, path: copies(s.path, per, lo, hi), ...(s.clip ? { clip: copies(s.clip as Path, per, lo, hi) } : {}) } : fit([s], 1, 1, lo)[0]);
  const sh: Shape[] = [S(rect(lo, -92, hi - lo, 16), "#C2BBAE"), S(rect(lo, -78, hi - lo, 8), "#A9A49B"), S(rect(lo, -70, hi - lo, 70.5), "#6F7479"), S(rect(lo, -70, hi - lo, 4), "#5E6368", { flat: true })];
  const marks = Math.max(1, Math.round(per / 220)), cars: Shape[] = [], lit: Shape[] = [];
  cars.push(...Array.from({ length: marks }, (_, i) => S(rect(i * per / marks, -38, 70, 3), "#EDEAE2", { flat: true })));
  for (const [y, s, d, mute] of [[-42, 0.78, -1, 0.22], [-4, 1, 1, 0]] as const) {
    const taxiAt = r.chance(0.75) ? r.int(0, 2) : -1;
    let x = r.range(10, 80);
    for (let i = 0; ; i++) {
      const kind = i === taxiAt ? "taxi" : r.pick(["sedan", "sedan", "hatch", "hatch", "van"]), len = (kind === "van" ? 460 : kind === "hatch" ? 405 : 430) * s;
      if (x + len > per - 40) {
        // a courier on a scooter in the near lane's last gap
        if (d > 0 && per - 40 - x > 190 && r.chance(0.5)) {
          const m = x + 70, top = r.pick(["#2E5E8C", "#3E7A3A", "#4A4A4A"]);
          cars.push(S(ellipse(m - 40, y - 14, 14), TYRE), S(ellipse(m + 40, y - 14, 14), TYRE), P([[m - 52, y - 22, 0], [m + 30, y - 22, 0], [m + 50, y - 52, 0], [m + 40, y - 56, 0], [m + 20, y - 34, 0], [m - 48, y - 40, 0]], "#C9CDD1"));
          cars.push(S(rrect(m - 60, y - 84, 38, 38, 4), "#C4302B"), S(rrect(m - 22, y - 96, 22, 52, 8), top), S(ellipse(m - 10, y - 108, 11), "#F4F2EE"), L([[m, y - 76], [m + 40, y - 58]], top, 6, 1));
        }
        break;
      }
      const a = carArt(430, mix(kind === "taxi" ? TAXI : r.pick(CAR_COLORS), "#A9B2BA", mute), kind, r), k = len / 430;
      cars.push(...fit(a.sh, k, d, x + len / 2, y)); lit.push(...fit(a.glow, k, d, x + len / 2, y));
      if (!moving) lit.push(...fit(a.tail, k, d, x + len / 2, y));
      x += len + (moving ? r.range(90, 300) : r.range(30, 80));
    }
  }
  // the strip's copies reach a period past each end: sized from what is drawn, so a long street still fits the atlas
  const group = { shapes: [...sh, ...rep(cars)], edge: 1 }, emis = lit.length ? { shapes: rep(lit), edge: 0 } : null;
  const span = Math.max(...[group, ...(emis ? [emis] : [])].map(g => { const [x0, , x1] = groupBounds(g); return x1 - x0; }));
  return { flats: [{
    group, switch: false, ...(emis ? { emissive: emis } : {}),
    ppcm: Math.min(0.8, 1900 / span), ...(moving ? { move: { scroll: { dx, ms }, phase: num(p.phase, 0), ...(timetable(p.stops) ? { stops: timetable(p.stops)!, clock: "stops" as const } : {}) } } : {}),
  }] };
}, meta: {
  about: "A seamless strip of city traffic seen through a window: two lanes of cars and a taxi, stopped in a jam or sliding by.",
  params: {
    moving: { type: "bool", about: "the strip slides by; else a jam with brake lights" },
    dx: { type: "num", default: -1400, about: "cm the strip slides every ms" },
    stops: { ...stopsParam, about: "moving on a vehicle's timetable (true or {ms, run, ease}): it slows to a stop with the vehicle at each stop" },
    ms: { type: "num", default: 7000 },
    w: { type: "num", default: 1600, about: "cm covered" },
    phase: { type: "num", default: 0 },
  },
  terms: ["a2-w-trafik"],
  tags: ["vehicle"],
} };

// ---- The road from a moving car ------------------------------------------------------------------

const WALLS = ["#E8D5B5", "#D9B48F", "#C98E6B", "#E3C9A0", "#B9C4BE", "#EFE6D8", "#D7A27A", "#A9B59A", "#CDB8C2", "#E6CFA1", "#F0E2C8"];
const AWNS = ["#B3261E", "#2E6B4F", "#2E5E8C", "#C9A227", "#7A3E6E", "#D9534A", "#3E7A3A"];
const ASPHALT = "#666B70", PAVE = "#BDB4A4", KERB = "#D8D2C6", LITW = "#FFD98A", FLOOR = -Math.PI / 2;

/** A car seen from behind (tail lights, the plate) or coming at us (`front`: headlights, the grille), 180 cm wide, wheels on y = 0: `kind` sedan, taxi or van, in `c`; `stop` lights its brake lights. */
function carEnd(c: string, front: boolean, kind: string, stop = false): { sh: Shape[]; glow: Shape[] } {
  const van = kind === "van", roof = van ? -200 : -140, sh: Shape[] = [], glow: Shape[] = [];
  const body = smooth([[-88, -24, 0], [-91, -58], [-86, -86, 0], [86, -86, 0], [91, -58], [88, -24, 0]] as Pt[], true, 1);
  const top = smooth((van ? [[-87, -84, 0], [-84, -194, 0], [-74, -200, 0], [74, -200, 0], [84, -194, 0], [87, -84, 0]] : [[-80, -84, 0], [-64, -134, 0], [-54, -140, 0], [54, -140, 0], [64, -134, 0], [80, -84, 0]]) as Pt[], true, 1);
  const glass = van ? (front ? rrect(-76, -184, 152, 84, 6) : rrect(-70, -184, 140, 70, 6)) : smooth([[-70, -90, 0], [-56, -130, 0], [56, -130, 0], [70, -90, 0]] as Pt[], true, 1);
  for (const k of [-1, 1]) sh.push(S(rrect(k * 74 - 13, -30, 26, 30, 4), TYRE), S(rrect(k * 92 - 7, -98, 14, 10, 3), c));
  sh.push(S(rect(-78, -26, 156, 20), "#2B2F33"), S(top, c), S(body, c), S(glass, front ? "#33404C" : "#3A4654"), L([[-40, -96], [-20, -124]], "#FFFFFF", 3, 0.22));
  sh.push(S(rect(24, roof - 10, 80, 190), tone(c, "shade"), { flat: true, opacity: 0.3, clip: body.add(top) }), S(rrect(-86, -42, 172, 14, 6), tone(c, "shade")), L([[-84, -86], [84, -86]], tone(c, "light"), 2, 0.6));
  const py = front ? -40 : -56;
  sh.push(S(rrect(-22, py, 44, 11, 1.5), "#F7F7F2"), S(rect(-22, py, 5, 11), "#2E4FA0", { flat: true }));
  for (const k of [-1, 1]) {
    if (front) {
      sh.push(P([[k * 52, -77, 0], [k * 84, -75, 0], [k * 86, -64, 0], [k * 55, -62, 0]], "#F4F1E0"));
      glow.push(S(ellipse(k * 69, -69, 24, 14), "#FFF3C4", { flat: true }), S(ellipse(k * 69, -69, 62, 30), "#FFF3C4", { flat: true, opacity: 0.25 }));
    } else {
      sh.push(P([[k * 60, -80, 0], [k * 88, -78, 0], [k * 88, -62, 0], [k * 62, -64, 0]], stop ? "#FF3B2F" : "#B3261E"));
      glow.push(S(ellipse(k * 75, -71, 16, 11), "#FF4A3A", { flat: true, opacity: stop ? 1 : 0.75 }));
    }
  }
  if (front) sh.push(S(rrect(-42, -76, 84, 15, 4), DARK));
  else if (stop) glow.push(S(ellipse(0, roof + 12, 18, 5), "#FF4A3A", { flat: true }));
  if (kind === "taxi") { sh.push(S(rect(-16, roof - 3, 32, 3), DARK), S(rrect(-24, roof - 15, 48, 12, 3), "#F7F1DE")); glow.push(S(rrect(-26, roof - 17, 52, 16, 5), "#FFF3C4", { flat: true, opacity: 0.8 })); }
  return { sh, glow };
}

/** One building of a street seen from a car (`road`), `w` cm along the street, from x = 0 to w: ground-floor shops (a sign board, glass with goods, a door, an awning or a shutter down) under 3–6 floors of windows (shutters, balconies, an AC unit), a water tank on the roof; its lit windows and lit shops apart. */
function block(r: Rng, w: number): { sh: Shape[]; lit: Shape[]; shop: Shape[] } {
  const c = r.pick(WALLS), fl = r.int(3, 6), G = 400, H = G + fl * 300 + 30, sh: Shape[] = [], lit: Shape[] = [], shop: Shape[] = [];
  sh.push(S(rect(0, -H, w, H), c), S(rect(0, -G, w, G), mix(c, "#8F877C", 0.5)), S(rect(-4, -H - 16, w + 8, 20), tone(c, "light")), S(rect(0, -H, 16, H), tone(c, "deep"), { flat: true, opacity: 0.45 }));
  const n = Math.max(1, Math.round(w / 460)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * sw + 24, ww = sw - 48, a = r.pick(AWNS);
    sh.push(S(rect(x, -G + 28, ww, 62), a), S(rect(x + 12, -G + 40, ww - 24, 38), "#F6F1E6", { flat: true, opacity: 0.4 }));
    if (r.chance(0.15)) { sh.push({ path: rect(x, -G + 100, ww, G - 100), fill: "#A9AEB1", tile: { w: 40, h: 12, shapes: [S(rect(0, 9, 40, 3), "#8E9497")] } }); continue; }
    const g = rect(x + 6, -G + 106, ww - 12, G - 106);
    sh.push(S(g, "#3F4C58"), S(rect(x + ww - 96, -G + 106, 74, G - 106), "#2C3640"));
    for (let j = 0; j < 4; j++) sh.push(S(rect(x + 20 + j * (ww - 130) / 4, -G + 250 + r.range(0, 60), (ww - 150) / 5, r.range(60, 140)), r.pick(["#D9534A", "#E0B23A", "#7FC4E8", "#5E9A55", "#F4EFE4", "#C98E62"]), { flat: true, opacity: 0.8 }));
    shop.push(S(rect(x + 6, -G + 106, ww - 110, 140), "#FFD27A", { flat: true, opacity: 0.85 }), S(rect(x + 6, -G + 246, ww - 110, G - 246), "#FFC867", { flat: true, opacity: 0.45 }), S(rect(x + ww - 88, -G + 114, 58, G - 120), "#FFD27A", { flat: true, opacity: 0.6 }), S(rect(x + 12, -G + 40, ww - 24, 38), "#FFF1C8", { flat: true, opacity: 0.8 }));
    if (r.chance(0.55)) {
      const aw = rect(x - 8, -G + 96, ww + 16, 70);
      sh.push(S(aw, a), { path: aw, flat: true, opacity: 0.5, tile: { w: 60, h: 70, shapes: [S(rect(0, 0, 30, 70), "#F6F1E6")] } });
      let sc = ellipse(x - 8 + 15, -G + 166, 15, 9);
      for (let s = x + 37; s < x + ww; s += 30) sc = sc.add(ellipse(s, -G + 166, 15, 9));
      sh.push(S(sc, a));
    }
  }
  const bays = Math.max(2, Math.round(w / 180)), bw = w / bays, sht = r.pick(["#5E7F5A", "#7A5A3E", "#B8B2A6", "#4F6D8A"]);
  for (let f = 0; f < fl; f++) {
    const y = -G - f * 300 - 40;
    for (let b = 0; b < bays; b++) {
      const x = b * bw + bw / 2, win = rect(x - 40, y - 180, 80, 160);
      sh.push(S(rect(x - 48, y - 188, 96, 176), tone(c, "light")), S(win, "#4A5866"));
      if (r.chance(0.4)) sh.push(S(rect(x - 74, y - 180, 30, 160), sht), S(rect(x + 44, y - 180, 30, 160), sht));
      if (r.chance(0.5)) lit.push(S(win, LITW, { flat: true, opacity: 0.95 }));
      if (r.chance(0.12)) sh.push(S(rrect(x + 50, y - 60, 60, 40, 4), "#E9E6DF"));
    }
    if (r.chance(0.4)) sh.push(S(rect(10, y - 8, w - 20, 12), tone(c, "deep")), { path: rect(10, y - 90, w - 20, 82), flat: true, opacity: 0.85, tile: { w: 14, h: 82, shapes: [S(rect(0, 0, 3, 82), "#2B2F33"), S(rect(0, 0, 14, 4), "#2B2F33")] } });
  }
  if (r.chance(0.7)) sh.push(S(rrect(r.range(30, Math.max(40, w - 150)), -H - 130, 120, 112, 14), "#E3DED4"));
  if (r.chance(0.5)) sh.push(L([[w * 0.6, -H], [w * 0.6, -H - 220]], "#3B3F45", 4, 1), L([[w * 0.6 - 50, -H - 190], [w * 0.6 + 50, -H - 190]], "#3B3F45", 3, 1));
  return { sh, lit, shop };
}

/** A tree on the pavement at `x`: its grate, trunk and a round canopy in three greens. */
function tree(r: Rng, x: number): Shape[] {
  const h = r.range(560, 760), R = r.range(150, 210), g = r.pick(["#5E8A4A", "#4F7A3E", "#6C9455"]);
  const cr = (dx: number, dy: number, k: number) => smooth(Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2, q = R * k * (0.85 + 0.15 * Math.sin(i * 2.7 + dx)); return [x + dx + Math.cos(a) * q, -h + R + dy + Math.sin(a) * q * 0.85] as Vec2; }), true, 1);
  return [S(rect(x - 50, -5, 100, 5), "#4A4E52"), S(poly([[x - 14, 0], [x - 9, -h + R], [x + 9, -h + R], [x + 14, 0]]), "#6B4E3A"), S(cr(0, 0, 1), g), S(cr(-R * 0.3, -R * 0.25, 0.6), tone(g, "light"), { flat: true, opacity: 0.6 }), S(cr(R * 0.35, R * 0.3, 0.55), tone(g, "shade"), { flat: true, opacity: 0.5 })];
}

/** A street lamp at `x`, `h` tall, its arm reaching `d` cm (toward the road; both ways on a median when `two`); its head's glow apart. */
function lamp(x: number, h: number, d: number, two = false): { sh: Shape[]; glow: Shape[] } {
  const sh: Shape[] = [S(rrect(x - 10, -40, 20, 40, 3), "#4E555B"), S(poly([[x - 6, 0], [x - 4, -h], [x + 4, -h], [x + 6, 0]]), "#5A6168")], glow: Shape[] = [];
  for (const k of two ? [-1, 1] : [Math.sign(d) || 1]) {
    const e = x + k * Math.abs(d);
    sh.push(L([[x, -h + 10], [x + k * Math.abs(d) * 0.5, -h - 30], [e, -h - 20]], "#5A6168", 7, 1), S(rrect(e - 30, -h - 24, 60, 16, 6), "#3B4046"), S(rect(e - 24, -h - 10, 48, 5), "#FFF6D8", { flat: true }));
    // the bulb and its halo (a pool of light on the ground cannot be drawn on this upright flat: it floated as a disc)
    glow.push(S(ellipse(e, -h - 6, 40, 16), LAMP_GLOW, { flat: true }), S(ellipse(e, -h + 10, 120, 70), LAMP_GLOW, { flat: true, opacity: 0.22 }));
  }
  return { sh, glow };
}
const LAMP_GLOW = "#FFE6A8";

/** `road`'s cross-sections, cm across the street seen ahead (x > 0 our kerb side, our lane at 0): kerbs, building lines (null: none), parked cars, trees and lamps (right, left), lane lines, oncoming and same-way lanes, a median. */
interface Cross { kerb: [number, number]; face: [number | null, number | null]; park: [number | null, number | null]; furn: [number, number]; lines: number[]; on: number[]; ahead: number[]; median?: [number, number]; sea?: boolean }
const CROSS: Record<string, Cross> = {
  street: { kerb: [460, -750], face: [800, -1050], park: [350, -640], furn: [570, -880], lines: [-175], on: [-350], ahead: [0] },
  avenue: { kerb: [460, -1430], face: [820, -1760], park: [350, null], furn: [590, -625], lines: [-175, -1075], on: [-900, -1250], ahead: [0, -350], median: [-725, -525] },
  coast: { kerb: [200, -525], face: [null, -760], park: [null, null], furn: [430, -640], lines: [-175], on: [-350], ahead: [0], sea: true },
};

/** A resolution for shapes: `want` px/cm, less if they would be more than an atlas layer across. */
const pp = (ss: Shape[], want: number) => { const [x0, y0, x1, y1] = groupBounds({ shapes: ss }); return Math.min(want, 1900 / Math.max(x1 - x0, y1 - y0, 1)); };

/** Copies of shapes every `per` cm along y, from `y0` to `y1` (a strip of road marks). */
const alongY = (ss: Shape[], per: number, y0: number, y1: number): Shape[] => ss.map(s => {
  const out = s.path.move(0, y0);
  for (let y = y0 + per; y < y1 - 1; y += per) out.add(s.path.move(0, y));
  return { ...s, path: out };
});

/**
 * A city road seen ahead from a moving car, in true depth behind a cabin's windscreen (`cabin`), or behind it through the
 * rear window (`view: "back"`): the asphalt lying on the ground to the vanishing point, its lane dashes, kerbs painted
 * black and white and the pavements; building rows on both sides (`side`: "both", "right", "left" or "none") whose
 * ground floors are shops (sign boards, glass, awnings, shutters) and whose windows light one building after another at
 * dusk; trees and street lamps (lit at night, on no switch) on the pavements, parked cars; a car ahead keeping its
 * distance (behind: a car following, headlights on at night) and oncoming cars, headlights at night. `kind`: "street"
 * (default; a lane each way), "avenue" (two lanes each way and a median of trees and lamps) or "coast" (the Bosphorus
 * shore: a promenade, a railing and the sea on the right, the far shore and the bridge, lit at night). Everything that
 * passes comes at the camera along paths in true perspective (`ms` the time to drive 10 m, default 1300), or goes away
 * from it behind, and loops out of sight: buildings slide out from the far street's row, the rest is born small in the
 * haze. `moving: false`: stopped in a jam (the car ahead close, its brake lights on; only the other way moves).
 * Set it at the cabin's depth (its origin is the windscreen's plane; everything is at least 30 cm behind it) and
 * lower it to put the road where the eye wants it (`y` about 0.25 m under the taxi's camera). `phase` shifts it all.
 */
const road: PieceDef = { draw(p, r) {
  const kind = Object.hasOwn(CROSS, str(p.kind, "")) ? str(p.kind, "") : "street", X = CROSS[kind], back = str(p.view, "front") === "back", m = back ? -1 : 1;
  const run = p.moving !== false, v = 1000 / Math.max(900, num(p.ms, 1300)), side = str(p.side, "both"), ph0 = num(p.phase, 0);
  const T = 9000, NEAR = 30, FAR = 24000, PER = 600, flats: FlatSpec[] = [];
  const mx = (x: number) => x * m, ph = (k: number) => ((k + ph0) % 1 + 1) % 1;
  /** A path toward the camera from z0 to z1 (front), or away from it from z1 to z0 (back). */
  const go = (z0: number, z1: number, ms: number, k: number, wait = 0): { move?: FlatMotion; z: number; gone?: true } => {
    const phase = ph(back ? 1 - k : k), d = back ? z0 - z1 : z1 - z0, start = back ? z1 : z0;
    if (run) return { z: start, move: { path: { pts: [[0, 0, 0], [0, 0, d]], ms, wait, hide: wait > 0 }, phase } };
    // stopped (a jam): each thing still where the moving road has it at its start, spread along the street (not all at the far end);
    // one waiting out of sight there is left out
    const f = phase * (ms + wait) / ms;
    return f >= 1 && wait > 0 ? { z: start, gone: true } : { z: start + d * Math.min(1, f) };
  };
  const xs = [X.kerb[1], X.kerb[0], ...(X.face[1] !== null ? [X.face[1]] : []), ...(X.face[0] !== null ? [X.face[0]] : [])], x0 = Math.min(...xs) - 400, x1 = X.sea ? 900 : Math.max(...xs) + 400;
  // the ground (still): asphalt, wheel tracks, kerbs, pavements, a median; split near and far for its resolution
  const ground = (y0: number, y1: number): Shape[] => {
    const h = y1 - y0, out: Shape[] = [S(rect(x0, y0, x1 - x0, h), PAVE), S(rect(X.kerb[1], y0, X.kerb[0] - X.kerb[1], h), ASPHALT)];
    for (const x of [X.kerb[0] - 20, X.kerb[1]]) out.push(S(rect(x, y0, 20, h), KERB), S(rect(x + (x > 0 ? -6 : 20), y0, 6, h), "#3E4247", { flat: true, opacity: 0.5 }));
    for (const x of [...X.ahead, ...X.on]) for (const t of [-55, 55]) out.push(S(rect(x + t - 22, y0, 44, h), tone(ASPHALT, "shade"), { flat: true, opacity: 0.25 }));
    if (X.median) out.push(S(rect(X.median[0], y0, X.median[1] - X.median[0], h), KERB), S(rect(X.median[0] + 20, y0, X.median[1] - X.median[0] - 40, h), "#7C9A5C"));
    for (const f of X.face) if (f !== null) out.push(S(rect(f + (f > 0 ? -30 : 0), y0, 30, h), "#8F877C", { flat: true, opacity: 0.5 }));
    if (X.sea) out.push(S(rect(650, y0, 250, h), "#B9B2A6"));
    return fit(out, 1, m);
  };
  // (the near part reaches 4 m behind the windscreen, so a low camera never sees past its edge)
  flats.push({ group: { shapes: ground(-3600, 400), edge: 0 }, pitch: FLOOR, ppcm: Math.min(0.16, 1900 / (x1 - x0)), switch: false, pick: false });
  flats.push({ group: { shapes: ground(-FAR, -3600), edge: 0 }, pitch: FLOOR, ppcm: 1900 / FAR, switch: false, pick: false });
  if (X.sea) flats.push({ group: { shapes: [S(rect(mx(900) - (back ? 8000 : 0), -FAR, 8000, FAR), "#3F7894")], edge: 0 }, pitch: FLOOR, y: -60, ppcm: 1900 / FAR, switch: false, pick: false });
  // the marks that pass (dashes, the kerbs' paint, the pavements' joints, the sea's glints), a period long; near and far
  const mark: Shape[] = [];
  for (const x of X.lines) mark.push(S(rect(x - 18, -PER, 36, 300), "#F2EFE8"));
  for (const x of [X.kerb[0] - 20, X.kerb[1], ...(X.median ? [X.median[0], X.median[1] - 20] : [])]) for (let y = -PER; y < 0; y += 200) mark.push(S(rect(x, y, 20, 100), "#2B2F33", { flat: true, opacity: 0.85 }));
  for (const [a, b] of [[X.kerb[0], X.face[0] ?? 650], [X.face[1] ?? X.kerb[1] - 400, X.kerb[1]]]) for (let y = -PER; y < 0; y += 100) mark.push(S(rect(a, y, b - a, 4), "#8F877C", { flat: true, opacity: 0.35 }));
  mark.push(S(rrect(X.kerb[0] - 70, -PER / 2, 40, 70, 4), "#3E4247", { flat: true, opacity: 0.8 }));
  if (X.sea) for (let i = 0; i < 9; i++) mark.push(S(ellipse(r.range(1000, 7000), -r.range(0, PER), r.range(40, 110), 6), "#CFE6EE", { flat: true, opacity: 0.55 }));
  // (ahead the strip starts a period further and comes a period nearer; behind it starts at the windscreen and goes a period away)
  const k0 = back ? 0 : 1, slide = (per: number): Partial<FlatSpec> => run ? { move: { path: { pts: [[0, 0, 0], [0, 0, back ? -per : per]], ms: per / v }, phase: ph(0) } } : {};
  const strip = (a: number, b: number, ppcm: number) => flats.push({ group: { shapes: fit(alongY(mark, PER, -NEAR - b * PER, -NEAR - (a - 1) * PER), 1, m), edge: 0 }, pitch: FLOOR, ppcm, switch: false, pick: false, ...slide(PER) });
  strip(k0, 6, 0.15); strip(7, Math.ceil(FAR / PER), 1900 / FAR);
  // now and then on the road: a zebra crossing, a patch of new asphalt with a manhole (each short, so it passes out of sight whole)
  const L1 = T - 100 - NEAR, a0 = X.median ? X.median[1] : X.kerb[1];
  for (const [i, sh] of [[0.7, Array.from({ length: Math.floor((X.kerb[0] - a0 - 60) / 100) }, (_, j) => S(rect(a0 + 40 + j * 100, -450, 55, 450), "#F2EFE8"))], [0.25, [P([[-60, -20], [190, -40], [230, -330], [-40, -300]], tone(ASPHALT, "deep"), { flat: true, opacity: 0.5 }), S(holed(ellipse(-110, -150, 34, 30), [ellipse(-110, -150, 26, 22)]), "#3B3F45", { flat: true, evenodd: true })]]] as [number, Shape[]][]) {
    const mv = go(-T + 100, -NEAR, L1 / v, i);
    flats.push({ group: { shapes: fit(sh, 1, m), edge: 0 }, pitch: FLOOR, z: mv.z, ppcm: 0.2, switch: false, pick: false, ...(mv.move ? { move: mv.move } : {}) });
  }
  // the buildings: each slides out from under the far row (still, beyond T) and goes out of sight before the windscreen
  for (const s of [1, -1]) {
    const f = X.face[s > 0 ? 0 : 1];
    if (f === null || side === "none" || side === (s > 0 ? "left" : "right")) continue;
    const xf = mx(f), yaw = -Math.sign(xf) * Math.PI / 2, mir = xf > 0 ? 1 : -1, wmax = Math.min(1400, 1.98 * Math.abs(f) - 500), L0 = T - NEAR;
    const ws: number[] = [];
    for (let t = 0; t < L0 - 600;) { const w = r.range(Math.min(700, wmax * 0.7), wmax); ws.push(w); t += w; }
    const k = L0 / ws.reduce((a, b) => a + b, 0);
    let u = 0;
    for (const w0 of ws) {
      const w = w0 * k, b = block(r, w), mv = go(-T - w, -NEAR - w, L0 / v, 1 - u / L0), ppcm = 0.15;
      u += w;
      // the art runs from the far end (its origin, so it is sorted by it) toward the camera
      flats.push({ group: { shapes: fit(b.sh, 1, mir), edge: 1 }, emissive: { shapes: fit([...b.shop, ...b.lit], 1, mir), edge: 0 }, x: xf, z: mv.z, yaw, ppcm, switch: false, pick: false, glowAt: r.range(0.15, 0.6), ...(mv.move ? { move: mv.move } : {}) });
    }
    // the far row: blocks of the same street in the haze, still; its origin at its near end (−T), so a building beyond it is under it
    const far: Shape[] = [], lit: Shape[] = [];
    for (let x = 0; x < FAR - T;) {
      const w = r.range(900, 1600), h = r.range(1300, 2400), c = r.pick(WALLS);
      far.push(S(rect(x, -h, w, h), c), S(rect(x, -400, w, 400), mix(c, "#8F877C", 0.5)), S(rect(x, -h, 18, h), tone(c, "deep"), { flat: true, opacity: 0.4 }), { path: rect(x + 60, -h + 60, w - 120, h - 500), flat: true, opacity: 0.55, tile: { w: 180, h: 300, shapes: [S(rect(50, 60, 80, 160), "#4A5866")] } });
      for (let i = 0; i < 6; i++) lit.push(S(rect(x + 110 + Math.floor(r.range(0, (w - 240) / 180)) * 180, -h + 120 + Math.floor(r.range(0, (h - 600) / 300)) * 300, 80, 160), LITW, { flat: true, opacity: 0.8 }));
      x += w;
    }
    const fx = (ss: Shape[]) => fit(ss, 1, -mir);
    flats.push({ group: { shapes: fx(far), edge: 1.5 }, emissive: { shapes: fx(lit), edge: 0 }, x: xf, z: -T, yaw, ppcm: pp(far, 0.05), switch: false, pick: false, glowAt: 0.45 });
  }
  // trees and lamps on the pavements and the median, cars parked by the kerbs: each slot one flat facing us, a slot every 22 m
  const car = (front: boolean, stop = false, k = r.pick(["sedan", "sedan", "taxi", "van", "sedan", "sedan"])) => carEnd(k === "taxi" ? TAXI : r.pick(CAR_COLORS), front, k, stop);
  for (const s of [0, 1]) {
    const fx = X.furn[s], px = X.park[s], n = Math.round(L1 / 2200), med = !!X.median && s === 1;
    for (let i = 0; i < n; i++) {
      const sh: Shape[] = [], glow: Shape[] = [], lampHere = med || X.sea || i % 2 === 0;
      if (px !== null && r.chance(0.7)) { const c = car((s === 1) !== back); sh.push(...fit(c.sh, 1, 1, px)); }
      if (!lampHere || r.chance(0.5)) sh.unshift(...tree(r, fx + (lampHere ? Math.sign(fx) * 140 : 0)));
      if (lampHere) { const l = lamp(fx, med ? 900 : 780, -Math.sign(fx) * 170, med); sh.push(...l.sh); glow.push(...l.glow); }
      const mv = go(-T + 100, -NEAR, L1 / v, (i + r.range(-0.15, 0.15)) / n);
      flats.push({ group: { shapes: fit(sh, 1, m), edge: 0.8 }, emissive: { shapes: fit(glow, 1, m), edge: 0 }, z: mv.z, ppcm: 0.45, switch: false, pick: false, ...(mv.move ? { move: mv.move } : {}) });
    }
  }
  // the coast's railing (a strip that slides a period) and the far shore across the water, its lights at night
  if (X.sea) {
    const rail: Shape[] = [], xr = mx(650), dir = xr > 0 ? 1 : -1;
    for (let z = -NEAR - (back ? 0 : PER); z > -T; z -= 150) rail.push(S(rect(z + T - 4, -110, 8, 110), "#E9E6DF"));
    rail.push(S(rect(0, -112, T, 9), "#E9E6DF"), S(rect(0, -60, T, 6), "#E9E6DF"));
    flats.push({ group: { shapes: fit(rail, 1, dir), edge: 0.5 }, x: xr, z: -T, yaw: -dir * Math.PI / 2, ppcm: 1900 / T, switch: false, pick: false, ...slide(PER) });
    const hill: Shape[] = [], lights: Shape[] = [];
    hill.push(S(smooth([[0, 0, 0], [0, -700], [6000, -1400], [14000, -900], [22000, -1800], [32000, -1100], [40000, -1500], [40000, 0, 0]] as Pt[], true, 1), "#7F9A86"));
    for (let i = 0; i < 90; i++) { const x = r.range(400, 39000), y = -r.range(60, 700); hill.push(S(rect(x, y, 60, 40), r.pick(["#F0E2C8", "#E3C9A0", "#C98E6B"]), { flat: true })); if (r.chance(0.6)) lights.push(S(rect(x + 10, y + 10, 40, 22), LITW, { flat: true })); }
    flats.push({ group: { shapes: fit(hill, 1, m, mx(2500)), edge: 2 }, emissive: { shapes: fit(lights, 1, m, mx(2500)), edge: 0 }, z: -22000, ppcm: 1900 / 40000, switch: false, pick: false, glowAt: 0.4 });
  }
  // the traffic: the car ahead keeping its distance (behind us, the one following), and the other way's cars passing
  const near = run ? (back ? 1600 : 3400) : (back ? 700 : 900);
  // in a jam, a queue in each lane: a car every 7 m, brake lights on
  X.ahead.forEach((x, i) => {
    for (let j = 0, n = run ? 1 : 4; j < n; j++) {
      const c = car(back, !run && !back), z = -near - i * 2000 - j * 700 - (run ? 0 : r.range(0, 120));
      flats.push({ group: { shapes: c.sh, edge: 0.8 }, emissive: { shapes: c.glow, edge: 0 }, x: mx(x) + (run ? 0 : r.range(-25, 25)), z, ppcm: j ? 0.5 : 0.8, switch: false, pick: false, move: { ...(run ? { path: { pts: [[0, 0, 0], [0, 0, -300 - i * 900], [0, 0, 0]] as [number, number, number][], ms: 11000 + i * 4000 } } : {}), sway: { rot: 0.004, dy: run ? 1 : 0.3, ms: 700 + i * 90 + j * 60 }, phase: ph(i * 0.37 + j * 0.21) } });
    }
  });
  for (let i = 0; i < 2; i++) {
    const c = car(!back), mv = go(-T + 100, -NEAR, L1 / ((run ? 2 : 1.2) * v), (i + r.range(-0.15, 0.15)) / 2, r.range(1500, 4500));
    if (mv.gone) continue;
    flats.push({ group: { shapes: c.sh, edge: 0.8 }, emissive: { shapes: c.glow, edge: 0 }, x: mx(X.on[i % X.on.length]), z: mv.z, ppcm: 0.8, switch: false, pick: false, ...(mv.move ? { move: mv.move } : {}) });
  }
  // our own lights on the road: the headlights' pool ahead, the tail lights' red behind
  // (nested ellipses that shrink and add up towards the middle, so the pool has no edge: no gradients in paper)
  const pool = (y0: number, y1: number, w: number, c: string, op: number) => [1, 0.8, 0.6, 0.4, 0.22].map(k => S(ellipse(0, (y0 + y1) / 2, w * k, Math.abs(y1 - y0) / 2 * k), c, { flat: true, opacity: op }));
  flats.push(glowOnly(back ? pool(-350, -1300, 170, "#FF4A3A", 0.025) : pool(-900, -3800, 300, "#FFF3C4", 0.035), { pitch: FLOOR, ppcm: 0.1, pick: false }));
  return { flats };
}, variants: { street: { kind: "street" }, avenue: { kind: "avenue" }, coast: { kind: "coast" }, back: { view: "back" }, jam: { moving: false } },
  meta: {
    about: "A city road in true depth seen ahead from a moving car (or behind it): buildings, trees, lamps, parked and passing cars.",
    params: {
      kind: { type: "enum", values: ["street", "avenue", "coast"], default: "street" },
      view: { type: "enum", values: ["front", "back"], default: "front", about: "back: through the rear window" },
      moving: { type: "bool", default: true, about: "false: stopped in a jam" },
      ms: { type: "num", min: 900, default: 1300, about: "ms to drive 10 m" },
      side: { type: "enum", values: ["both", "right", "left", "none"], default: "both", about: "which sides have buildings" },
      phase: { type: "num", default: 0, about: "shifts everything along" },
    },
    terms: ["a1-w-yol"],
    tags: ["vehicle"],
  } };

// ---- Inside a vehicle ----------------------------------------------------------------------------

/** The taxi from the back seat (`cabin`'s taxi). */
function taxiCabin(p: Record<string, unknown>): PieceOut {
  const w = num(p.w, 320), up = hex(p.color, "#3A3E44"), liner = "#C2B9AA", dash = "#3A3D42", sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  const screen = poly([[-118, -112], [118, -112], [103, -192], [94, -199], [-94, -199], [-103, -192]]);
  const side = (k: number) => poly([[k * w / 2, -114], [k * 136, -114], [k * 118, -190], [k * w / 2, -176]]);
  // the roof lining and pillars round the windscreen and the front doors' windows, the floor, sun visors and the dome light
  sh.push(S(holed(rect(-w / 2, -236, w, 236), [screen, side(-1), side(1)]), liner, { evenodd: true }), S(rect(-w / 2, -236, w, 28), tone(liner, "light")), S(rect(-w / 2, -44, w, 74), "#26292D"));
  sh.push(S(rrect(-22, -230, 44, 9, 4), "#F4F0E4"), S(rrect(-96, -199, 74, 15, 5), tone(liner, "shade")), S(rrect(22, -199, 74, 15, 5), tone(liner, "shade")));
  for (const k of [-1, 1]) {
    sh.push(P([[k * 118, -112, 0], [k * 136, -114, 0], [k * 118, -190, 0], [k * 103, -192, 0]], tone(liner, "shade")), S(side(k), "#D6ECF2", { flat: true, opacity: 0.08 }));
    sh.push(P([[k * w / 2, -114, 0], [k * 136, -114, 0], [k * 140, -44, 0], [k * w / 2, -44, 0]], "#474B51"), L([[k * (w / 2 - 4), -86], [k * 142, -86]], "#5E636A", 3, 1));
  }
  sh.push(S(screen, "#D6ECF2", { flat: true, opacity: 0.08 }), L([[-80, -122], [-50, -185]], "#FFFFFF", 4, 0.2), L([[60, -120], [80, -160]], "#FFFFFF", 2, 0.18));
  // the dashboard: the instruments under their hood (lit at night), vents, the radio, the glove box, the meter on top
  sh.push(P([[-w / 2, -44, 0], [-w / 2, -112, 0], [-140, -115], [-96, -117], [-88, -126], [-62, -131], [-36, -126], [-28, -117], [60, -116], [w / 2 - 12, -114], [w / 2, -112, 0], [w / 2, -44, 0]], dash), L([[-w / 2 + 4, -111], [-96, -114], [-28, -114], [w / 2 - 4, -111]], tone(dash, "light"), 2, 0.5));
  sh.push(S(rrect(-90, -114, 56, 20, 7), "#1C1F23"), S(ellipse(-76, -104, 7.5), "#2B3036"), S(ellipse(-48, -104, 7.5), "#2B3036"), L([[-76, -104], [-80, -109]], "#E07A3A", 1, 1), L([[-48, -104], [-44, -109]], "#E07A3A", 1, 1));
  glow.push(S(ellipse(-76, -104, 7), "#9FD8FF", { flat: true, opacity: 0.5 }), S(ellipse(-48, -104, 7), "#9FD8FF", { flat: true, opacity: 0.5 }));
  sh.push(S(rrect(-26, -110, 52, 62, 4), "#2F3237"), S(rrect(-22, -106, 19, 10, 2), "#1C1F23"), S(rrect(3, -106, 19, 10, 2), "#1C1F23"), S(rrect(86, -108, 24, 10, 2), "#1C1F23"));
  for (const x of [-20, -13, -6, 5, 12, 19, 89, 96, 103]) sh.push(L([[x, -105], [x + 2, -97]], "#4A4E54", 1, 1));
  sh.push(S(rrect(-20, -90, 40, 13, 2), "#16181B"), S(rect(-14, -87, 28, 6), "#2A3A2A", { flat: true }), S(ellipse(-12, -68, 4), "#55595F"), S(ellipse(12, -68, 4), "#55595F"));
  sh.push({ path: rrect(40, -96, 72, 26, 4), stroke: { color: tone(dash, "deep"), width: 1 }, flat: true, opacity: 0.8 }, S(rrect(70, -86, 12, 3, 1.5), "#55595F"));
  sh.push(S(rrect(18, -130, 36, 13, 2), "#16181B"), S(rect(21, -127.5, 30, 8), "#3A1414", { flat: true }));
  glow.push(S(rect(-14, -87, 28, 6), "#FFB547", { flat: true, opacity: 0.8 }), S(rect(21, -127.5, 30, 8), "#FF5A4A", { flat: true, opacity: 0.8 }));
  const fare = str(p.fare, "").trim();
  if (fare) text.push({ text: fare, x: 21, y: -127.5, w: 30, h: 8, size: 5.5, color: "#FF6A5A", font: "screen", lit: 0 });
  // the steering wheel (the driver sits on the left), in front of the dash
  const wheel: Shape[] = [S(rrect(-70, -96, 16, 40, 5), "#25282C"), S(holed(ellipse(-62, -104, 27), [ellipse(-62, -104, 21.5)]), "#2A2D31", { evenodd: true }), S(rect(-84, -107, 44, 6), "#2A2D31"), S(rect(-65, -104, 6, 22), "#2A2D31"), S(rrect(-73, -113, 22, 17, 6), "#34383D"), S(ellipse(-62, -105, 3), "#8E979E")];
  // the mirror, hung from the top of the windscreen, with a Beşiktaş scarf over it and a nazar bead under it
  const hang: Shape[] = [S(rect(-1.5, 0, 3, 9), "#25282C"), S(rrect(-19, 8, 38, 11, 4), "#25282C"), S(rrect(-17, 9.5, 34, 8, 3), "#9FB2C2", { flat: true }), L([[-12, 17], [-6, 11]], "#FFFFFF", 1.2, 0.5)];
  if (p.scarf !== false) {
    for (const k of [-1, 1]) {
      const end = poly([[k * 13, 12], [k * 20, 12], [k * 24, 58], [k * 16, 59]]);
      hang.push(S(end, "#F4F2EE"), { path: end, flat: true, tile: { w: 30, h: 10, shapes: [S(rect(0, 0, 30, 5), "#1E1E20")] } });
      for (let j = 0; j < 4; j++) hang.push(L([[k * (16.5 + j * 2.3), 58], [k * (16.5 + j * 2.3), 64]], "#1E1E20", 0.8, 0.9));
    }
    hang.push(S(rrect(-21, 5, 42, 7, 3), "#1E1E20"), S(rect(-21, 8, 42, 1.5), "#F4F2EE", { flat: true }));
  }
  hang.push(L([[0, 19], [0, 33]], "#C9A227", 0.6, 1), S(ellipse(0, 37, 4.4), "#1F4FA0"), S(ellipse(0, 37, 3), "#FFFFFF", { flat: true }), S(ellipse(0, 37, 2), "#6FB6E8", { flat: true }), S(ellipse(0, 37, 0.9), "#111316", { flat: true }));
  // the front seats' backs, their headrests, a newspaper in a map pocket, the console and the gear lever between them
  const seats: Shape[] = [S(rrect(-18, -58, 36, 44, 5), "#2F3236"), S(rrect(-3, -74, 6, 18, 2), "#1E2124"), S(ellipse(0, -76, 5.5, 5), "#3C4046"), L([[8, -60], [15, -70]], "#1E2124", 4, 1)];
  for (const k of [-1, 1]) {
    const cx = k * 68, back = smooth([[cx - 46, -14, 0], [cx - 49, -80], [cx - 44, -100], [cx, -105], [cx + 44, -100], [cx + 49, -80], [cx + 46, -14, 0]], true, 1);
    seats.push(S(rect(cx - 13, -118, 3, 16), CHROME), S(rect(cx + 10, -118, 3, 16), CHROME), S(rrect(cx - 23, -134, 46, 20, 8), up), S(back, up), S(rect(cx + 26, -110, 26, 100), tone(up, "shade"), { flat: true, opacity: 0.4, clip: back }));
    seats.push(S(rrect(cx - 30, -94, 60, 44, 10), tone(up, "light"), { flat: true, opacity: 0.3 }), S(rrect(cx - 36, -50, 72, 32, 4), tone(up, "deep")), L([[cx - 34, -49], [cx + 34, -49]], tone(up, "light"), 1.2, 0.6));
    if (k < 0) seats.push(P([[cx - 26, -48, 0], [cx - 24, -64, 0], [cx + 6, -66, 0], [cx + 4, -48, 0]], "#EDE7D8"), ...[0, 1, 2].map(j => L([[cx - 20, -60 + j * 3.5], [cx + 1, -61.5 + j * 3.5]], "#9A958A", 1, 0.8)));
  }
  return { flats: [
    { group: { shapes: sh, edge: 1 }, emissive: { shapes: glow, edge: 0 }, ppcm: Math.min(2, 1900 / w), ...(text.length ? { text } : {}) },
    { group: { shapes: hang, edge: 0.5 }, y: 199, z: 4, ppcm: 4, move: { sway: { rot: 0.04, ms: 1400 } } },
    { group: { shapes: wheel, edge: 0.7 }, z: 28, ppcm: 3 },
    { group: { shapes: seats, edge: 0.9 }, z: 92, ppcm: 2 },
  ], lights: [{ x: -40, y: 100, z: 40, color: "#9FD8FF", radius: 1.5, intensity: 0.25, at: ["dusk", "night"] }] };
}

/**
 * The taxi seen from the front looking back (`cabin`'s taxi with `view: "back"`), at the passengers on the rear bench: the
 * roof lining with its dome light, the rear window and the rear doors' windows (openings: the road going away shows through,
 * `road` with `view: "back"`), the C-pillars, the parcel shelf, the bench's back with its headrests and seat belts; a
 * little in front, the seat cushion the passengers sit on (about 45 cm, puppet scale), behind their legs; nearest, the
 * front seats' backs at the frame's edges, low, and the armrest between them, over the car's floor, which reaches down past
 * the frame so a shot low enough to show the front seats' sitters whole never sees under the car.
 */
function taxiBack(p: Record<string, unknown>): PieceOut {
  const w = num(p.w, 460), up = hex(p.color, "#3A3E44"), liner = "#C2B9AA", sh: Shape[] = [], glow: Shape[] = [];
  const rear = poly([[-112, -128], [112, -128], [100, -196], [88, -203], [-88, -203], [-100, -196]]);
  // the cabin is a box seen from inside, so its sides and roof agree with the road's perspective: this flat is its back
  // (the rear window, the C-pillars, the bench), `IW` cm each side; the doors and the roof are flats of their own, running from
  // here towards the camera (`walls` below), the street showing through the doors' windows at the angle it really has
  const IW = 152;
  sh.push(S(holed(rect(-IW, -240, 2 * IW, 240), [rear]), liner, { evenodd: true }), S(rect(-IW, -240, 2 * IW, 30), tone(liner, "light")), S(rect(-IW, -40, 2 * IW, 70), "#26292D"));
  for (const k of [-1, 1]) {
    // the C-pillar, shaded on its inner face, down to the door
    sh.push(P([[k * 112, -128, 0], [k * IW, -122, 0], [k * IW, -196, 0], [k * 100, -196, 0]], tone(liner, "shade")), P([[k * IW, -122, 0], [k * 150, -122, 0], [k * 156, -40, 0], [k * IW, -40, 0]], "#474B51"));
    // the seat belt from the pillar's top down across the bench's corner, its buckle by the cushion
    sh.push(L([[k * 132, -186], [k * 120, -150], [k * 104, -60]], "#2B2E33", 5, 1), S(rrect(k * 104 - 5, -66, 10, 14, 2), "#8E979E"), S(rrect(k * 40 - 4, -54, 8, 12, 2), "#8E979E"));
  }
  sh.push(S(rear, "#D6ECF2", { flat: true, opacity: 0.07 }), L([[-70, -140], [-40, -195]], "#FFFFFF", 4, 0.18), L([[60, -136], [74, -170]], "#FFFFFF", 2, 0.16));
  // the parcel shelf under the rear window, the third brake light's housing, a box of tissues on it
  sh.push(P([[-112, -128, 0], [112, -128, 0], [120, -116, 0], [-120, -116, 0]], "#2F3236"), S(rrect(-22, -136, 44, 8, 3), "#1C1F23"), S(rrect(56, -140, 30, 13, 2), "#7FB8C9"), S(rect(64, -143, 14, 4), "#F4F2EE"));
  // the bench's back with its two pleated halves, the headrests behind where heads go
  const back = smooth([[-138, -44, 0], [-142, -96], [-132, -116], [0, -120], [132, -116], [142, -96], [138, -44, 0]], true, 1);
  sh.push(S(back, up), S(rect(-2, -118, 4, 76), tone(up, "deep"), { flat: true, opacity: 0.6, clip: back }));
  for (const x of [-96, -60, 60, 96]) sh.push(L([[x, -112], [x, -50]], tone(up, "deep"), 1.6, 0.45));
  sh.push(S(rect(-140, -120, 40, 80), tone(up, "light"), { flat: true, opacity: 0.18, clip: back }));
  for (const x of [-72, 72]) sh.push(S(rect(x - 9, -132, 3, 14), CHROME), S(rect(x + 6, -132, 3, 14), CHROME), S(rrect(x - 24, -150, 48, 20, 8), up));
  // the cushion, in front of the bench's back and behind the sitters' legs
  const cushion: Shape[] = [S(rrect(-146, -50, 292, 18, 8), tone(up, "light")), S(rect(-140, -34, 280, 34), tone(up, "deep")), L([[-140, -33], [140, -33]], tone(up, "light"), 1.2, 0.5), S(rect(-2, -50, 4, 16), tone(up, "deep"), { flat: true, opacity: 0.6 })];
  // nearest: the front seats' backs at the edges, low, and the armrest with its cup holders between them
  // the car's floor in front, reaching down past the frame however low the shot goes
  const front: Shape[] = [S(rect(-w / 2, -6, w, 126), "#26292D")];
  for (const k of [-1, 1]) {
    const cx = k * (w / 2 - 20), b = smooth([[cx - 70, 120, 0], [cx - 74, -70], [cx - 60, -96], [cx, -100], [cx + 60, -96], [cx + 74, -70], [cx + 70, 120, 0]], true, 1);
    front.push(S(b, up), S(rect(cx - 74, -100, 30, 100), tone(up, "shade"), { flat: true, opacity: 0.35, clip: b }), S(rrect(cx - 46, -84, 92, 40, 8), tone(up, "deep"), { flat: true, opacity: 0.5 }));
  }
  front.push(S(rrect(-26, -52, 52, 52, 8), "#2F3236"), S(ellipse(-10, -46, 6, 2.6), "#1C1F23"), S(ellipse(10, -46, 6, 2.6), "#1C1F23"));
  // the doors, each a flat along the car from the C-pillar towards the camera (`DW` cm): the rear door's window and the front
  // door's beyond the B-pillar (openings), the lining above, the door panel with its pocket and handle below, the floor's edge
  const DW = 260, walls: FlatSpec[] = [], rearWin = rrect(10, -192, 104, 70, 7), frontWin = rrect(136, -196, 120, 74, 7);
  const door: Shape[] = [
    S(holed(rect(0, -240, DW, 240), [rearWin, frontWin]), liner, { evenodd: true }), S(rect(0, -240, DW, 30), tone(liner, "light")),
    S(rect(116, -240, 18, 120), tone(liner, "shade")), S(rearWin, "#D6ECF2", { flat: true, opacity: 0.08 }), S(frontWin, "#D6ECF2", { flat: true, opacity: 0.08 }),
    S(rect(0, -122, DW, 82), "#474B51"), L([[0, -118], [DW, -118]], "#5E636A", 4, 1), S(rect(0, -40, DW, 70), "#26292D"),
    S(rrect(60, -98, 40, 9, 4), "#5E636A"), S(rrect(14, -72, 84, 26, 5), "#3B3F45"), S(rrect(190, -98, 40, 9, 4), "#5E636A"), S(rrect(150, -72, 90, 26, 5), "#3B3F45"),
    L([[24, -184], [46, -136]], "#FFFFFF", 3, 0.16), L([[150, -186], [176, -134]], "#FFFFFF", 3, 0.16),
  ];
  for (const k of [-1, 1]) walls.push({ group: { shapes: door, edge: 1 }, x: k * IW, yaw: -Math.PI / 2, ppcm: 1.6, shadow: "none" });
  // the roof's lining overhead, from the back towards the camera, with the dome light near the back
  const roof: Shape[] = [S(rect(-IW, -DW, 2 * IW, DW), tone(liner, "light")), L([[-IW, -150], [IW, -150]], tone(liner, "shade"), 1.2, 0.5), S(rrect(-26, -60, 52, 22, 6), "#F4F0E4")];
  walls.push({ group: { shapes: roof, edge: 0.6 }, emissive: { shapes: [S(rrect(-22, -57, 44, 16, 5), "#FFF4D6", { flat: true })], edge: 0 }, y: 240, pitch: Math.PI / 2, ppcm: 1.2, shadow: "none" });
  // and the floor under the bench and the front seats
  walls.push({ group: { shapes: [S(rect(-IW, 0, 2 * IW, DW), "#26292D")], edge: 0 }, pitch: -Math.PI / 2, ppcm: 0.5, shadow: "none" });
  return { flats: [
    { group: { shapes: sh, edge: 1 }, emissive: { shapes: glow, edge: 0 }, ppcm: Math.min(2, 1900 / (2 * IW)) },
    ...walls,
    { group: { shapes: cushion, edge: 0.8 }, z: 20, ppcm: 2 },
    { group: { shapes: front, edge: 0.9 }, z: 150, ppcm: Math.min(2, 1900 / w) },
  ], lights: [{ x: 0, y: 225, z: 60, color: "#FFF1D6", radius: 1.6, intensity: 0.3, at: ["dusk", "night"] }] };
}

/** The İETT bus from its aisle (`cabin`'s bus); its windows are `metro_window` bus's. */
function busCabin(p: Record<string, unknown>, r: Rng): PieceOut {
  const w = num(p.w, 1000), h = num(p.h, 245), door = p.door === null ? null : num(p.door, w / 2 - 200), pole = hex(p.color, POLE), wall = "#D9DBD6", frame = "#24272A";
  const SILL = 98, HEAD = 200, WW = 150, sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  const wins: number[] = [];
  for (let x = -w / 2 + 24 + WW / 2; x + WW / 2 < w / 2 - 20; x += WW + 14) if (door === null || Math.abs(x - door) > WW / 2 + 80) wins.push(x);
  const leaf = (lx: number) => rrect(lx + 7, -198, 50, 180, 5);
  // the doorway is open in the wall: the leaves are flats of their own that slide aside (for an entrance or an exit through a door
  // mark naming this piece, `slide`; at each stop of a timetable, `stops`)
  const tt = timetable(p.stops), moving: FlatSpec[] = [];
  sh.push(S(holed(rect(-w / 2, -h, w, h), [...wins.map(x => rrect(x - WW / 2, -HEAD, WW, HEAD - SILL, 6)), ...(door === null ? [] : [rect(door - 66, -208, 132, 208)])]), wall, { evenodd: true }));
  // under the windows: the side panel, the heater duct with its slots
  let slots = rect(-w / 2 + 10, -16, 14, 3);
  for (let x = -w / 2 + 34; x < w / 2 - 20; x += 24) slots = slots.add(rect(x, -16, 14, 3));
  sh.push(S(rect(-w / 2, -SILL + 2, w, SILL - 2), "#A9B2B8"), S(rect(-w / 2, -24, w, 24), "#5E676E"), S(slots, "#3B4249", { flat: true }));
  // each window: sill, black frame, dotted frit, tint, the sliding vent, glints; an ad card over it
  for (const x of wins) {
    const x0 = x - WW / 2, wh = HEAD - SILL, vent = -HEAD + 30;
    sh.push(S(rect(x0 - 6, -SILL - 4, WW + 12, 6), tone(wall, "light")), S(holed(rrect(x0 - 5, -HEAD - 5, WW + 10, wh + 10, 9), [rrect(x0, -HEAD, WW, wh, 6)]), frame, { evenodd: true }));
    sh.push(S(holed(rrect(x0, -HEAD, WW, wh, 6), [rrect(x0 + 4, -HEAD + 4, WW - 8, wh - 8, 4)]), frame, { evenodd: true, flat: true, opacity: 0.92 }));
    sh.push({ path: holed(rrect(x0 + 4, -HEAD + 4, WW - 8, wh - 8, 4), [rrect(x0 + 10, -HEAD + 10, WW - 20, wh - 20, 3)]), evenodd: true, flat: true, opacity: 0.85, tile: { w: 3.4, h: 3.4, shapes: [S(ellipse(1.7, 1.7, 1.05), frame)] } });
    sh.push(S(rrect(x0, -HEAD, WW, wh, 6), "#B9D3CF", { flat: true, opacity: 0.14 }), S(rect(x0, vent, WW, 4), frame), S(rect(x - 1.5, -HEAD, 3, 31), frame), L([[x0 + 22, -SILL - 12], [x0 + 48, vent + 22]], "#FFFFFF", 4, 0.22));
    sh.push(S(rrect(x - 50, -229, 100, 22, 2), "#FBF7EE"), S(rect(x - 48, -227, 38, 18), r.pick(["#3F7FA6", "#D9534A", "#5E9A55", "#F2B705"]), { flat: true }), S(rect(x - 4, -223, 44, 3), "#B9B2A6", { flat: true }), S(rect(x - 4, -216, 30, 3), "#B9B2A6", { flat: true }));
  }
  // the cove and ceiling, its light strip
  sh.push(S(rect(-w / 2, -h, w, h - 232), "#EEEDE7"), S(rrect(-w / 2 + 10, -h + 4, w - 20, 6, 3), "#FBFAF2"));
  glow.push(S(rrect(-w / 2 + 10, -h + 4, w - 20, 6, 3), "#FFF6DA", { flat: true }), S(rrect(-w / 2, -h, w, 18, 9), "#FFF6DA", { flat: true, opacity: 0.3 }));
  if (door !== null) {
    // the middle door: frame, two glazed leaves with grab bars, the yellow step, its lamp and the ramp's sign
    sh.push(S(holed(rect(door - 72, -214, 144, 214), [rect(door - 66, -208, 132, 208)]), "#2F3338", { evenodd: true }));
    for (const k of [-1, 1]) {
      const lx = k < 0 ? door - 66 : door + 1, edge = k < 0 ? lx + 63.5 : lx;
      const leafSh = [S(holed(rect(lx, -208, 65, 208), [leaf(lx)]), "#3B4046", { evenodd: true }), S(leaf(lx), "#B9D3CF", { flat: true, opacity: 0.12 }), S(rrect(lx + 4, -112, 57, 4, 2), pole), L([[lx + 16, -60], [lx + 34, -150]], "#FFFFFF", 3, 0.2), S(rect(edge, -208, 1.5, 208), DARK, { flat: true })];
      moving.push({ group: { shapes: leafSh, edge: 1 }, z: -0.6, ppcm: Math.min(1, 1900 / w), shadow: "none", slide: k * 62, ...(tt ? { move: { path: { pts: [[0, 0, 0], [0, 0, 0], [k * 62, 0, 0], [k * 62, 0, 0], [0, 0, 0]], ms: tt.ms, at: doorTimes(tt) }, clock: "stops" as const } } : {}) });
    }
    sh.push(S(rect(door - 66, -6, 132, 6), "#E0B23A"), S(ellipse(door, -221, 5, 3.5), "#3FA34D"), S(rrect(door + 40, -232, 18, 18, 2), "#2E5E9E"));
    sh.push({ path: ellipse(door + 48, -221, 4), stroke: { color: "#FFFFFF", width: 1.2 }, flat: true }, L([[door + 46, -229], [door + 46, -222], [door + 52, -222]], "#FFFFFF", 1.4, 1));
    glow.push(S(ellipse(door, -221, 9, 7), "#7CFF9A", { flat: true }));
  }
  // the next stop's display near the front
  const sx = -w / 4;
  sh.push(S(rect(sx - 1.5, -h, 3, 6), DARK), S(rrect(sx - 60, -h + 6, 120, 22, 3), "#2E3640"), S(rect(sx - 56, -h + 9, 112, 16), "#11161B", { flat: true }));
  glow.push(S(rect(sx - 56, -h + 9, 112, 16), "#FFB547", { flat: true, opacity: 0.16 }));
  const next = str(p.text, "").trim(), st = (p.stations as string[] | undefined) ?? [], line = (t: string): TextSpec[] => [{ text: t, x: sx - 54, y: -h + 10, w: 108, h: 14, size: 9, color: "#FFB547", font: "screen", weight: 600, lit: 0 }];
  if (tt && st.length > 1) {
    // on the timetable: "Sonraki durak: …" on the way, the stop's name while it stands there
    const legs = st.length - 1, all = legs * tt.ms, blank = { shapes: [S(rect(sx - 56, -h + 9, 112, 16), "#11161B", { flat: true })], edge: 0 };
    for (let j = 1; j <= legs; j++) {
      const t0 = (j - 1) * tt.ms;
      moving.push({ group: blank, z: 0.2, ppcm: Math.min(1, 1900 / w), lit: 0, text: line(`Sonraki durak: ${st[j]}`), move: { blink: { ms: all, on: tt.run / all, at: t0 / all }, clock: "stops" } });
      moving.push({ group: blank, z: 0.2, ppcm: Math.min(1, 1900 / w), lit: 0, text: line(st[j]), move: { blink: { ms: all, on: (tt.ms - tt.run) / all, at: (t0 + tt.run) / all }, clock: "stops" } });
    }
  } else if (next) text.push(...line(next));
  // in front: the grab rail along the ceiling on its hangers, the poles with stop buttons, the card reader by the door
  const poles = Array.isArray(p.poles) ? (p.poles as unknown[]).filter((x): x is number => typeof x === "number") : door === null ? [-w / 4, w / 4] : [door - 100, door + 100, -w / 4];
  const ps: Shape[] = [S(rrect(-w / 2, -216, w, 5, 2.5), pole), L([[-w / 2 + 2, -215], [w / 2 - 2, -215]], "#FFFFFF", 0.8, 0.4)], pglow: Shape[] = [];
  for (let x = -w / 2 + 60; x < w / 2; x += 220) ps.push(S(rect(x - 1.2, -h, 2.4, h - 214), CHROME));
  for (const x of poles) ps.push(S(ellipse(x, -1.5, 7, 2.6), tone(pole, "shade")), S(rrect(x - 2.6, -h, 5.2, h, 2.6), pole), L([[x - 1, -h + 4], [x - 1, -6]], "#FFFFFF", 0.9, 0.4), S(rrect(x - 4.5, -134, 9, 12, 2.5), "#3B4046"), S(ellipse(x, -128, 3.2), "#D7262E"));
  if (door !== null && poles.length) {
    const vx = poles[0] + 3;
    ps.push(S(rrect(vx, -134, 16, 26, 3), "#E9E4D6"), S(rect(vx + 3, -131, 10, 7), "#1F2A1F", { flat: true }), S(ellipse(vx + 8, -116, 4.5), "#F2B705", { flat: true }));
    pglow.push(S(rect(vx + 3, -131, 10, 7), "#7CFF9A", { flat: true, opacity: 0.7 }));
  }
  const ppcm = Math.min(1, 1900 / w), lights: LightSpec[] = [-w / 4, w / 4].map(x => ({ x, y: h - 10, z: 120, color: "#F4F6FF", radius: 5, intensity: 0.9, at: ["dusk", "night"] }));
  return { flats: [
    { group: { shapes: sh, edge: 1 }, emissive: { shapes: glow, edge: 0 }, ppcm, ...(text.length ? { text } : {}) },
    { group: { shapes: ps, edge: 0.5 }, ...(pglow.length ? { emissive: { shapes: pglow, edge: 0 } } : {}), z: 45, ppcm: Math.min(1.5, 1900 / w) },
    ...moving,
  ], lights };
}

/**
 * A vehicle's inside around the actors, `kind`:
 * - "taxi" (default): seen from the back seat, `w` cm wide; `view: "back"` turns round to the passengers on the rear bench (`taxiBack`). Furthest, the windscreen and the front doors' windows (openings
 *   the city behind shows through) in the roof lining and pillars, sun visors, the dashboard with its lit instruments, vents,
 *   radio, glove box and the meter on top (`fare`, its words; none by default); the rear-view mirror hung from the top of
 *   the windscreen with a Beşiktaş scarf over it (`scarf: false` takes it off) and a nazar bead, swaying; the steering
 *   wheel on the left; nearest, the front seats' backs (`color`) with headrests, a newspaper in a pocket, the gear lever.
 * - "bus": an İETT bus's far side, `w` × `h`: windows (openings, as `metro_window` bus) along it, the side panel and heater
 *   duct, ad cards, the ceiling's light strip, the middle door at `door` (x; null for none) with its yellow step and lamp,
 *   the next stop's display (`text`, none by default); in front, the grab rail and `poles` (x list) in `color`, with stop
 *   buttons and the card reader by the door.
 */
const cabin: PieceDef = { draw(p, r) {
  return str(p.kind, "taxi") === "bus" ? busCabin(p, r) : str(p.view, "front") === "back" ? taxiBack(p) : taxiCabin(p);
}, variants: { taxi: { kind: "taxi" }, taxi_back: { kind: "taxi", view: "back" }, bus: { kind: "bus" } },
  meta: {
    about: "A vehicle's inside round the actors: a taxi from the back seat or looking back at the rear bench, or an İETT bus's aisle.",
    params: {
      kind: { type: "enum", values: ["taxi", "bus"], default: "taxi" },
      view: { type: "enum", values: ["front", "back"], default: "front", about: "a taxi's: back turns round to the rear bench" },
      w: { type: "num", about: "cm; taxi 320, taxi back 460, bus 1000" },
      color: { type: "color", about: "a palette id or a hex: the seats' upholstery, or the bus's poles" },
      fare: { type: "text", about: "the taxi meter's words" },
      scarf: { type: "bool", default: true, about: "the scarf over the taxi's mirror" },
      h: { type: "num", default: 245, about: "the bus's height, cm" },
      door: { type: "num", about: "the bus's middle door's x, cm, or null for none; default w/2 − 200" },
      poles: { type: "list", about: "the bus's poles' x, cm" },
      text: { type: "text", about: "the bus's next-stop display" },
      stations: { type: "list", about: "the bus's stops in the order it goes; with stops, the next one on the display on the way, its own at the stop" },
      stops: { ...stopsParam, about: "the bus's timetable (true or {ms, run, ease}): its door slides open at each stop and shuts before it goes on" },
    },
    terms: ["a1-w-taksi", "a1-w-otobus"],
    tags: ["vehicle"],
  } };

/** Moquette: a navy-ish cloth flecked with colours, printed over a path. */
const moquette = (path: Path, base: string): Shape => ({ path, flat: true, opacity: 0.75, tile: { w: 9, h: 9, shapes: [S(rect(1, 2, 2.6, 1.2), "#E0B23A"), S(rect(5.5, 6, 2.6, 1.2), "#D9534A"), S(rect(4, 0.5, 1.2, 2.6), "#7FC4E8"), S(rect(0.5, 6.5, 1.2, 1.2), tone(base, "light"))] } });

/**
 * A row of `n` seats, `kind`: "bus" (default), forward-facing bus seats seen from the aisle, one behind another `pitch` cm
 * apart, facing `dir` (1 right): grey shells, padded backs and cushions in flecked moquette (`color`), a grab handle in
 * `rail` on each back, a steel leg; "metro", moulded seats along the car's side facing us, moquette pads, steel armrests
 * between pairs and a hoop at each end, on a rail with open floor under them.
 */
const seats: PieceDef = { draw(p) {
  const metro = str(p.kind, "bus") === "metro", n = Math.max(1, Math.round(num(p.n, 4))), c = hex(p.color, metro ? "#2F6F8F" : "#2B3A67"), sh: Shape[] = [];
  if (metro) {
    const sw = 46, W = n * sw, shell = "#C9CED2";
    sh.push(S(rect(-W / 2 - 4, -42, W + 8, 6), "#5A646C"));
    for (let x = -W / 2 + sw; x < W / 2; x += 2 * sw) sh.push(S(poly([[x - 4, -36], [x + 4, -36], [x + 2, -12], [x - 2, -12]]), "#4A535A"), S(rect(x - 8, -14, 16, 4), "#4A535A"));
    for (let i = 0; i < n; i++) {
      const x0 = -W / 2 + i * sw, back = rrect(x0 + 7, -94, sw - 14, 40, 8), pan = rrect(x0 + 5, -52, sw - 10, 6, 3);
      sh.push(S(rrect(x0 + 3, -98, sw - 6, 52, [12, 12, 4, 4]), shell), S(back, c), moquette(back, c), S(rrect(x0 + 2, -50, sw - 4, 10, 4), shell), S(pan, c), moquette(pan, c), S(rect(x0 + 8, -91, sw - 16, 3), tone(c, "light"), { flat: true, opacity: 0.5 }));
    }
    for (let i = 2; i < n; i += 2) { const x = -W / 2 + i * sw; sh.push(S(rrect(x - 2, -72, 4, 30, 2), CHROME), S(rrect(x - 6, -75, 12, 4, 2), "#8E979E")); }
    for (const e of [-W / 2 - 4, W / 2 + 4]) sh.push(S(rrect(e - 2.6, -118, 5.2, 118, 2.6), CHROME), S(rect(e - 6, -3, 12, 3), tone(CHROME, "shade")));
    return { flats: [{ group: { shapes: sh, edge: 0.8 }, ppcm: Math.min(2, 1900 / (W + 20)), shadow: "drop" }] };
  }
  const pitch = num(p.pitch, 80), dir = num(p.dir, 1) < 0 ? -1 : 1, rail = hex(p.rail, POLE), shell = "#5F676E";
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch, back = smooth([[x - 26, -48, 0], [x - 33, -104], [x - 24, -107], [x - 15, -50, 0]], true, 1), cush = rrect(x - 26, -52, 50, 12, 5);
    sh.push(S(holed(rrect(x - 42, -126, 18, 15, 6), [rrect(x - 38, -122, 10, 8, 3)]), rail, { evenodd: true }), P([[x - 30, -44, 0], [x - 39, -110], [x - 33, -115], [x - 22, -112], [x - 16, -46, 0]], shell));
    sh.push(S(back, c), moquette(back, c), S(rect(x + 8, -40, 4, 38), CHROME), S(rrect(x + 3, -3, 14, 3, 1.2), "#8E979E"), S(rrect(x - 24, -42, 46, 6, 2), shell), S(cush, c), moquette(cush, c), L([[x - 22, -51], [x + 20, -51]], tone(c, "light"), 1.2, 0.5));
  }
  return { flats: [{ group: { shapes: dir < 0 ? fit(sh, 1, -1) : sh, edge: 0.8 }, ppcm: Math.min(2, 1900 / (n * pitch + 40)) }] };
}, variants: { bus: { kind: "bus" }, metro: { kind: "metro" } },
  meta: {
    about: "A row of seats: forward-facing bus seats seen from the aisle, or a metro car's side seats facing us, in moquette.",
    params: {
      kind: { type: "enum", values: ["bus", "metro"], default: "bus" },
      n: { type: "int", min: 1, default: 4 },
      color: { type: "color", about: "a palette id or a hex: the moquette" },
      pitch: { type: "num", default: 80, about: "bus seats' spacing, cm" },
      dir: { type: "int", min: -1, max: 1, default: 1, about: "bus seats face right (1) or left (-1)" },
      rail: { type: "color", about: "a palette id or a hex: the bus seats' grab handles" },
    },
    terms: ["a1-w-koltuk"],
    tags: ["seating", "vehicle"],
  } };

// ---- The ferry and the tram ----------------------------------------------------------------------

const HULL = "#F4F2EC", ROOFS = "#DAD6CC", FUNNEL = "#24272B", RAIL = "#EFEDE6", TEAK = "#A06A3C";

/** A ferry's funnel, `w` wide at its foot at (x, y) and `h` tall, raked back: black with a white band and a red line, a cap. */
function funnel(x: number, y: number, w: number, h: number): Shape[] {
  const f = poly([[x - w / 2, y], [x + w / 2, y], [x + w / 2 + h * 0.1, y - h], [x - w / 2 + h * 0.12, y - h]]);
  return [S(f, FUNNEL), S(rect(x - w, y - h * 0.72, w * 2.4, h * 0.14), HULL, { clip: f }), S(rect(x - w, y - h * 0.66, w * 2.4, h * 0.03), "#C4302B", { flat: true, clip: f }), S(rect(x - w / 2 + h * 0.1, y - h - 10, w + 6, 14), "#1A1C1F"), S(rect(x + w * 0.2, y - h, w * 0.18, h * 0.6), "#3A3E44", { flat: true, opacity: 0.5, clip: f })];
}
/** A life ring at (x, y), radius `R`: orange with four white bands. */
const lifeRing = (x: number, y: number, R: number): Shape[] => [S(holed(ellipse(x, y, R), [ellipse(x, y, R * 0.6)]), "#F07A2A", { evenodd: true }), ...[[x - R, y - 3, R * 0.4, 6], [x + R * 0.6, y - 3, R * 0.4, 6], [x - 3, y - R, 6, R * 0.4], [x - 3, y + R * 0.6, 6, R * 0.4]].map(([a, b, c, d]) => S(rect(a, b, c, d), "#F4F2EE", { flat: true }))];

/** The ferry beside the pier (`ferry`'s alongside). */
function ferryAlongside(p: Record<string, unknown>, r: Rng): PieceOut {
  const len = num(p.len, 2400), k = len / 1800, dir = num(p.dir, 1) < 0 ? -1 : 1, sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  const hull = smooth([[-850, 0, 0], [-878, -60], [-896, -150], [-895, -196, 0], [0, -192], [905, -206, 0], [880, -100], [858, 0, 0]], true, 1);
  let ports = ellipse(-700, -160, 9);
  for (let x = -560; x <= 560; x += 140) ports = ports.add(ellipse(x, -160, 9));
  sh.push(S(hull, HULL), S(rect(-920, -60, 1840, 34), tone(HULL, "shade"), { flat: true, opacity: 0.3, clip: hull }), S(rect(-920, -26, 1840, 26), "#2B2F33", { clip: hull }), S(rect(-920, -132, 1840, 14), "#2B2F33", { clip: hull }), S(rect(-920, -72, 1840, 9), "#2B2F33", { clip: hull }), S(ports, "#55657A", { flat: true }));
  // the decks: the saloon and the upper saloon with their windows (riders in some, lit at night), roofs, the bridge, the mast
  const deckhouse = (x0: number, x1: number, y: number, hh: number, ww: number, step: number, wy: number, wh: number) => {
    sh.push(S(rect(x0, y - hh, x1 - x0, hh), "#F7F5EF"), S(rect(x0 - 26, y - hh - 10, x1 - x0 + 52, 12), ROOFS));
    for (let x = x0 + 40; x + ww < x1 - 20; x += step) {
      sh.push(S(rrect(x, wy, ww, wh, 10), "#55657A"));
      if (r.chance(0.45)) sh.push(...rider(r, x + ww / 2 + r.range(-14, 14), wy + wh, 1.2));
      sh.push(L([[x + ww * 0.25, wy + wh - 8], [x + ww * 0.5, wy + 8]], "#FFFFFF", 3, 0.25));
      glow.push(S(rrect(x, wy, ww, wh, 10), "#FFE6B0", { flat: true, opacity: 0.9 }));
    }
  };
  deckhouse(-760, 720, -190, 210, 88, 112, -362, 80);
  deckhouse(-560, 520, -410, 190, 70, 100, -568, 66);
  sh.push(S(rect(250, -700, 300, 100), "#F7F5EF"), S(rect(240, -712, 320, 12), ROOFS), S(rect(468, -900, 7, 190), "#3B3F45"), L([[440, -860], [505, -860]], "#3B3F45", 3, 1));
  for (let x = 266; x < 530; x += 52) sh.push(S(rect(x, -682, 40, 36), "#2E3A48"));
  glow.push(S(ellipse(471, -906, 6), "#FFF6DA", { flat: true }));
  // the open ends: rails on the main deck fore and aft and round the upper deck aft, with people and life rings; the funnel; the flag
  const railing = (x0: number, x1: number, y: number) => { sh.push(S(rect(x0, y - 92, x1 - x0, 6), TEAK), L([[x0, y - 46], [x1, y - 46]], RAIL, 3, 1)); for (let x = x0; x <= x1; x += 26) sh.push(L([[x, y - 88], [x, y]], RAIL, 2.4, 1)); };
  for (let i = 0; i < 3; i++) sh.push(...rider(r, -740 + i * 60 + r.range(-10, 10), -470, 1.3));
  railing(-890, -760, -190); railing(722, 890, -194); railing(-790, -560, -410);
  sh.push(...lifeRing(-820, -240, 16), ...lifeRing(-640, -460, 16), ...funnel(40, -600, 160, 280), L([[-888, -190], [-888, -470]], "#3B3F45", 3, 1), ...flag(-888, -470, 80, -1));
  const name = str(p.name, "").trim();
  if (name) text.push({ text: name, x: 560, y: -186, w: 300, h: 34, size: 26, color: "#2B2420", font: "print", weight: 700 });
  return { flats: [{ group: { shapes: fit(sh, k, dir), edge: 1.4 }, emissive: { shapes: fit(glow, k, dir), edge: 0 }, switch: false, ppcm: Math.min(1, 1900 / len), move: { sway: { rot: 0.003, dy: 2, ms: 5200 } }, ...(text.length ? { text: fitText(text, k, dir) } : {}) }],
    emitters: [{ kind: "smoke", x: dir * 72 * k, y: 890 * k, w: 90 * k }] };
}

/** The ferry's upper deck from on board (`ferry`'s deck). */
function ferryDeck(p: Record<string, unknown>): PieceOut {
  const w = num(p.w, 1400), d = num(p.d, 360), nb = Math.max(0, Math.round(num(p.benches, 2))), fx = -w / 2 + 140, hx = w / 2 - 160;
  const deck: Shape[] = [S(rect(-w / 2, 0, w, d), "#B88A5A"), { path: rect(-w / 2, 0, w, d), flat: true, opacity: 0.7, tile: { w: 180, h: 28, shapes: [S(rect(0, 0, 180, 1.6), "#5A4030"), S(rect(0, 0, 1.6, 14), "#6E5038"), S(rect(90, 14, 1.6, 14), "#6E5038"), S(rect(0, 14, 180, 1.6), "#5A4030")] } }, S(rect(-w / 2, 0, w, 10), RAIL)];
  // the rail along the ship's side: white posts and bars, a teak top rail, a life ring
  const rail: Shape[] = [S(rect(-w / 2, -14, w, 14), RAIL)];
  for (let x = -w / 2 + 20; x < w / 2; x += 110) rail.push(S(rect(x - 2.5, -100, 5, 100), RAIL));
  rail.push(S(rect(-w / 2, -36, w, 4), RAIL), S(rect(-w / 2, -64, w, 4), RAIL), S(rrect(-w / 2, -106, w, 8, 3), TEAK), L([[-w / 2, -104.5], [w / 2, -104.5]], tone(TEAK, "light"), 1.2, 0.7), ...lifeRing(hx - 185, -70, 16));
  // the funnel on its casing at one end, the deckhouse and the bridge with its mast and flag at the other
  const fun: Shape[] = [S(rect(fx - 110, -150, 220, 150), HULL), S(rect(fx - 110, -150, 220, 8), ROOFS), S(rrect(fx - 20, -130, 44, 124, 4), "#9A9890"), ...[0, 1, 2, 3, 4].map(j => L([[fx - 14, -118 + j * 8], [fx + 18, -118 + j * 8]], "#6E6C66", 1.6, 1)), ...funnel(fx, -150, 140, 420)];
  const house: Shape[] = [S(rect(hx - 150, -250, 300, 250), HULL), S(rect(hx - 165, -262, 330, 12), ROOFS), S(rrect(hx - 128, -208, 70, 202, 5), TEAK), S(rrect(hx - 116, -194, 46, 50, 4), "#55657A"), S(ellipse(hx - 66, -104, 3), "#C9A227")];
  for (const x of [hx - 30, hx + 50]) house.push(S(rrect(x, -200, 60, 60, 8), "#55657A"), L([[x + 12, -150], [x + 30, -192]], "#FFFFFF", 2.4, 0.25));
  house.push(S(rect(hx - 100, -370, 220, 108), HULL), S(rect(hx - 112, -380, 244, 10), ROOFS), S(rect(hx + 60, -560, 6, 180), "#3B3F45"), S(ellipse(hx - 60, -388, 9, 7), "#C9CDD1"), ...flag(hx + 66, -556, 60, 1));
  for (let x = hx - 90; x < hx + 110; x += 42) house.push(S(rect(x, -356, 34, 40), "#2E3A48"));
  // the benches against the rail, facing us: teak slats on black iron
  const bench: Shape[] = [], x0 = fx + 130, x1 = hx - 170, bw = nb ? Math.min(240, (x1 - x0) / nb - 30) : 0;
  for (let i = 0; i < nb; i++) {
    const x = x0 + (i + 0.5) * (x1 - x0) / nb;
    for (const e of [-1, 1]) bench.push(S(rect(x + e * (bw / 2 - 8) - 2.5, -100, 5, 100), "#3B3F45"), L([[x + e * (bw / 2 - 8), -66], [x + e * (bw / 2 - 2), -66]], "#3B3F45", 3, 1));
    for (let j = 0; j < 3; j++) bench.push(S(rrect(x - bw / 2, -98 + j * 14, bw, 9, 2), TEAK));
    bench.push(S(rrect(x - bw / 2, -50, bw, 8, 2), TEAK), S(rrect(x - bw / 2, -44, bw, 5, 2), tone(TEAK, "shade")));
  }
  const ppcm = Math.min(1.4, 1900 / w), flats: FlatSpec[] = [
    { group: { shapes: deck, edge: 0 }, pitch: -Math.PI / 2, ppcm: Math.min(0.6, 1900 / w), lit: 1 },
    { group: { shapes: rail, edge: 0.7 }, ppcm },
    { group: { shapes: fun, edge: 1 }, z: 20, ppcm: 1.5 },
    { group: { shapes: house, edge: 1 }, emissive: { shapes: [S(ellipse(hx - 60, -388, 8), "#FFF6DA", { flat: true })], edge: 0 }, z: 20, ppcm: 1.5 },
  ];
  if (nb) flats.push({ group: { shapes: bench, edge: 0.7 }, z: 34, ppcm });
  return { flats, emitters: [{ kind: "smoke", x: fx + 25, y: 580, w: 60 }] };
}

/**
 * A Bosphorus ferry (vapur), `kind`:
 * - "alongside" (default): beside the pier, side on, facing right (`dir` -1 left), `len` cm long, cut at the waterline: a
 *   white hull with black rubbing strakes and portholes, the saloon and the upper saloon with rows of windows (riders in
 *   some, lit at night), the open decks fore and aft with rails, people and life rings, the bridge and its mast, the black
 *   funnel with the company's white band and red line, smoking, the flag at the stern, its `name` on the bow (none by
 *   default); it rocks at its moorings.
 * - "deck": its upper deck from on board, `w` cm: the teak deck (`d` deep, lying flat), the white rail with a life ring
 *   (the sea and the city behind show over it), the funnel on its casing at the left, smoking, the deckhouse and the
 *   bridge with mast and flag at the right, and `benches` (default 2) against the rail.
 */
const ferry: PieceDef = { draw(p, r) {
  return str(p.kind, "alongside") === "deck" ? ferryDeck(p) : ferryAlongside(p, r);
}, variants: { alongside: { kind: "alongside" }, deck: { kind: "deck" } },
  meta: {
    about: "A Bosphorus ferry (vapur): beside the pier side on, rocking and smoking, or its upper deck from on board with benches.",
    params: {
      kind: { type: "enum", values: ["alongside", "deck"], default: "alongside" },
      len: { type: "num", default: 2400, about: "alongside: length, cm" },
      dir: { type: "int", min: -1, max: 1, default: 1, about: "alongside: -1 faces left" },
      name: { type: "text", about: "alongside: the name on the bow" },
      w: { type: "num", default: 1400, about: "deck: width, cm" },
      d: { type: "num", default: 360, about: "deck: depth, cm" },
      benches: { type: "int", min: 0, default: 2, about: "deck: benches against the rail" },
    },
    terms: ["a1-w-vapur"],
    tags: ["vehicle", "water"],
  } };

/**
 * The red nostalgic tram of İstiklal, one car side on, facing right (`dir` -1 left), `len` cm long: red panels with gold
 * lining, a cream window band with riders in its windows (lit at night), open platforms at both ends with the headlamp,
 * the brass bell and the lifeguard trays, a single truck, the clerestory roof with its route board (`route`, default
 * "Taksim – Tünel"), the trolley pole up to the wire at `wire` cm (or `pantograph: true`), and sometimes a child riding on
 * the back step (`hanger`, else seeded). It passes along `go` (`ms`, `wait`, `phase`), rocking on the rails.
 */
const tram: PieceDef = { draw(p, r) {
  const len = num(p.len, 880), k = len / 880, dir = num(p.dir, 1) < 0 ? -1 : 1, wire = num(p.wire, 520), red = "#A8322A", cream = "#EFE3C6", under = "#2E2A28", gold = "#D9B25A";
  const sh: Shape[] = [], glow: Shape[] = [], move = goes(p);
  // the underframe, the truck with its springs and spoked wheels, the steps and lifeguards
  sh.push(S(rect(-420, -84, 840, 16), under), S(rect(-190, -74, 380, 14), under));
  for (const e of [-1, 1]) sh.push(S(rect(e > 0 ? 338 : -422, -70, 84, 7), under), S(rect(e > 0 ? 404 : -450, -30, 46, 8), under), L([[e * 130 - 34, -62], [e * 130, -54], [e * 130 + 34, -62]], "#4A4440", 3, 1));
  for (const x of [-130, 130]) {
    sh.push(S(ellipse(x, -36, 36), "#2B2726"), S(ellipse(x, -36, 28), "#4A4440", { flat: true }));
    for (let i = 0; i < 6; i++) sh.push(L([[x, -36], [x + Math.cos(i * 1.047) * 27, -36 + Math.sin(i * 1.047) * 27]], "#2B2726", 2.4, 1));
    sh.push(S(ellipse(x, -36, 7), "#6E6660"));
  }
  // the body: red panels with lining, the cream window band, the windows, the letterboard
  sh.push(S(rect(-330, -172, 660, 92), red), { path: rrect(-318, -162, 636, 72, 4), stroke: { color: gold, width: 1.4 }, flat: true, opacity: 0.9 }, S(rect(-330, -292, 660, 120), cream), S(rect(-330, -304, 660, 14), red));
  for (let i = 0; i < 6; i++) {
    const x = -312 + i * 107;
    sh.push(S(rrect(x, -278, 88, 92, [14, 14, 3, 3]), "#4E5E6E"));
    if (r.chance(0.6)) sh.push(...rider(r, x + 44 + r.range(-16, 16), -186, 1.1));
    sh.push(L([[x + 20, -196], [x + 44, -268]], "#FFFFFF", 3, 0.22));
    glow.push(S(rrect(x, -278, 88, 92, [14, 14, 3, 3]), "#FFE6B0", { flat: true, opacity: 0.85 }));
  }
  // the platforms at both ends: the rounded dash, posts, the end windows, lamps
  for (const e of [-1, 1]) {
    sh.push(P([[e * 330, -80, 0], [e * 412, -80], [e * 446, -104], [e * 450, -150], [e * 440, -174], [e * 330, -174, 0]], red), L([[e * 340, -160], [e * 430, -160], [e * 440, -140]], gold, 1.4, 0.9));
    sh.push(S(rrect(e > 0 ? 344 : -430, -282, 86, 96, 8), "#5E6E7E"), S(rect(e > 0 ? 334 : -340, -292, 6, 120), cream), S(rect(e > 0 ? 430 : -436, -290, 6, 116), cream), L([[e * 360, -200], [e * 380, -270]], "#FFFFFF", 3, 0.2));
    sh.push(S(ellipse(e * 446, -128, 9), e > 0 ? "#C3C9CE" : under), S(ellipse(e * 446, -128, 6.5), e > 0 ? "#F4F1E0" : "#B3261E"));
    glow.push(S(ellipse(e * 448, -128, e > 0 ? 16 : 10), e > 0 ? "#FFF3C4" : "#FF4A3A", { flat: true }));
  }
  sh.push(S(ellipse(410, -181, 8, 6), "#C9A227"), S(rect(409, -189, 2, 4), "#8E7A2A"), S(ellipse(407, -183, 2.5, 1.6), "#F2DB8A", { flat: true }));
  // the roof, the clerestory and its vents, the route board
  sh.push(P([[-452, -292, 0], [452, -292, 0], [446, -312], [400, -322], [-400, -322], [-446, -312]], "#C9C4B8"), S(rect(-280, -344, 560, 24), "#BDB7AA"));
  for (let x = -268; x < 270; x += 70) sh.push(S(rect(x, -340, 34, 12), "#55657A", { flat: true }));
  // what takes the current from the wire
  if (p.pantograph) {
    const mid = (-328 - wire) / 2;
    sh.push(S(rect(-50, -330, 100, 8), under), L([[-40, -330], [34, mid]], "#3B3F45", 3.4, 1), L([[34, mid], [-6, -wire + 4]], "#3B3F45", 3, 1), L([[-30, -330], [34, mid]], "#3B3F45", 2, 1), S(rect(-48, -wire, 84, 5), "#3B3F45"));
  } else {
    sh.push(S(rrect(-250, -332, 70, 12, 4), under), S(rrect(-236, -340, 40, 10, 3), "#4A4440"), L([[-215, -336], [260, -wire + 4]], "#3B3F45", 4, 1), S(ellipse(262, -wire + 3, 6, 4), "#3B3F45"));
  }
  sh.push(S(rrect(-214, -382, 428, 40, 4), under), S(rrect(-210, -378, 420, 32, 3), "#F7F1DE"));
  // a child riding on the back step, holding the post
  if (p.hanger ?? r.chance(0.5)) {
    const top = r.pick(["#C4553A", "#2E5E8C", "#E0A83A", "#3E7A3A"]), sk = r.pick(["#E8B98F", "#C98E62", "#8D5A3B"]);
    sh.push(L([[-462, -84], [-458, -68]], "#3E4650", 6, 1), L([[-470, -84], [-474, -68]], "#3E4650", 6, 1), S(rrect(-478, -132, 24, 50, 8), top), L([[-458, -124], [-440, -158]], top, 5, 1), S(ellipse(-466, -144, 10, 11), sk), S(ellipse(-467, -151, 10.5, 6), "#2B2420"));
  }
  const text = fitText([{ text: str(p.route, "Taksim – Tünel"), x: -205, y: -375, w: 410, h: 26, size: 19, color: "#2B2420", font: "print", weight: 700 }], k, dir);
  return { flats: [{
    group: { shapes: fit(sh, k, dir), edge: 1 }, emissive: { shapes: fit(glow, k, dir), edge: 0 }, switch: false, ppcm: Math.min(1.8, 1900 / (len * 1.07)), text,
    ...(move ? { move: { ...move, sway: { rot: 0.002, dy: 0.6, ms: 900 } } } : {}),
  }] };
}, meta: {
  about: "İstiklal's red nostalgic tram, side on: riders in its windows, the route board, the trolley pole to the wire; it can pass along a path.",
  params: {
    len: { type: "num", default: 880, about: "cm" },
    dir: { type: "int", min: -1, max: 1, default: 1, about: "-1 faces left" },
    wire: { type: "num", default: 520, about: "the wire's height, cm" },
    pantograph: { type: "bool", about: "a pantograph instead of the trolley pole" },
    hanger: { type: "bool", about: "a child riding on the back step; default seeded" },
    route: { type: "text", default: "Taksim – Tünel" },
      go: { type: "list", about: "a path of [x, y, z] points (cm) it passes along" },
      ms: { type: "num", min: 500, default: 20000, about: "the time along go, ms" },
      wait: { type: "num", min: 0, default: 0, about: "ms between passes" },
      hide: { type: "bool", default: true, about: "hidden while it waits" },
      phase: { type: "num", default: 0, about: "where along go it starts, 0…1" },
  },
  terms: ["a2-w-tramvay"],
  tags: ["vehicle"],
} };

/** The family's set pieces and props (`index.ts`). The car is a prop too, so a story can point at the taxi. */
export const set: Record<string, PieceDef> = { cabin, seats, traffic, road, ferry, tram, car };
export const props: Record<string, PieceDef> = { car };
