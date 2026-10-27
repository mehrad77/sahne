// Set pieces for the metro, following STYLE.md. Units are centimetres;
// each flat's origin is its bottom centre, except a hanging strap's, which is where it hangs (it
// sways about it). Pieces that move on their own carry `move` (FlatMotion).
//
// The M11 car seen from the aisle: its far side (`metro_wall`: windows, a door pair, ads, the ceiling
// band and its lights), the floor, benches, poles, grab rails with straps, the route strip and the
// next-station display over the door. Outside, `scroll_view` layers go by behind the window openings
// (the wall is their mask: it is drawn after them), each a seamless strip that slides by its period
// and starts over; `metro_alongside` is the train on the next track, nearly still beside us.
//
// The station (2c.7): the platform across the track, the street entrance and the M sign; and the car's
// doors and windows as pieces of their own (`metro_door`, `metro_window`), so a story can tap or open one.
//
// The car's timetable (`stops` on the wall, the display, the route strip and the outside layers; `TIMETABLE`): it runs a leg to
// the next station, eases into it and stands there while the doors slide open, one passenger gets off and another gets on
// (`metro_riders`), and the doors shut; the display reads "Gelecek istasyon: …" on the leg and the station's name at the stop,
// the route strip lights the station it goes to, and a `platform` layer comes in at each stop.

import { ellipse, rect, rrect, poly, tone, mix, TIMETABLE, type FlatMotion, type PieceDef, type Shape, type Vec2, type Rng, type Path, type LightSpec, type FlatSpec, type TextSpec } from "sahne";
import { hex, S, P, L, num, str, holed, copies, ridge, timetable, AT_STOP, doorTimes, stopsParam, type Pt } from "./draw.ts";
import { person, drawPerson, personFlats } from "./people.ts";

/** The car's colours: pale panels, a cool dado, rubber seals, steel, and one accent (the line's colour). */
const CAR = { panel: "#E6E7E2", dado: "#C9D0D3", skirt: "#5B656D", rubber: "#46515A", door: "#C6CDD1", ceil: "#EFEFEA", steel: "#C3C9CE", accent: "#2F8C88", seat: "#3F6E9E", warn: "#E0B23A", lamp: "#FFF6DA" };
/** Window sill and head, cm above the floor: a seated eye at 120, a standing one at 160, both inside. */
export const WIN = { sill: 92, head: 198 };

/**
 * The car's timetable (`stops` on its pieces; `true` takes the engine's `TIMETABLE`, as the place's `stops` does): a leg of `run`
 * ms to the next station, easing out of one and into the next over `ease` ms, then standing at it until `ms`. The outside stops
 * with the car (`FlatMotion.stops`); the doors, the display, the route strip and the passengers follow the same periods. All of
 * them are on the place's stops clock (`clock: "stops"`), so a story can hold the car at a station and start it again.
 */
export { timetable, type Timetable } from "./draw.ts";
export { TIMETABLE };

// ---- The car ------------------------------------------------------------------------------

/** The car's far side: window openings (`windows`: `{x, w}`), door pairs (`doors`: centres), ad cards over the windows, the cove, the light strip and the ceiling up to `h`. */
const metroWall: PieceDef = { draw(p, r) {
  const w = num(p.w, 1000), h = num(p.h, 400), acc = hex(p.color, CAR.accent);
  const wins = (p.windows as { x: number; w: number }[] | undefined) ?? [{ x: -215, w: 240 }, { x: 215, w: 240 }];
  const doors = (p.doors as number[] | undefined) ?? [0];
  const winHole = (o: { x: number; w: number }) => rrect(o.x - o.w / 2, -WIN.head, o.w, WIN.head - WIN.sill, 10);
  const doorHoles = (dx: number) => [rrect(dx - 57, -186, 48, 86, 7), rrect(dx + 9, -186, 48, 86, 7)];
  // on a timetable the doors are their own flats behind the wall, sliding into it at each stop; the wall keeps the doorway open
  const tt = timetable(p.stops), moving: FlatSpec[] = [];
  const shapes: Shape[] = [S(holed(rect(-w / 2, -h, w, h), [...wins.map(winHole), ...doors.flatMap(dx => tt ? [rect(dx - 66, -200, 132, 200)] : doorHoles(dx))]), CAR.panel, { evenodd: true })];
  const glow: Shape[] = [];
  // dado, skirting and the accent line under the sills
  shapes.push(S(rect(-w / 2, -88, w, 80), CAR.dado), S(rect(-w / 2, -8, w, 8), CAR.skirt), S(rect(-w / 2, -91, w, 3), acc, { flat: true }));
  // windows: a rubber seal, faint glass and two glints (the outside shows through the hole)
  for (const o of wins) {
    const x0 = o.x - o.w / 2, wh = WIN.head - WIN.sill;
    shapes.push(S(holed(rrect(x0 - 6, -WIN.head - 6, o.w + 12, wh + 12, 14), [winHole(o)]), CAR.rubber, { evenodd: true }));
    shapes.push(S(winHole(o), "#D6ECF2", { flat: true, opacity: 0.1 }));
    shapes.push(L([[x0 + o.w * 0.12, -WIN.sill - 14], [x0 + o.w * 0.3, -WIN.head + 34]], "#FFFFFF", 4, 0.22), L([[x0 + o.w * 0.2, -WIN.sill - 8], [x0 + o.w * 0.34, -WIN.sill - 50]], "#FFFFFF", 2, 0.18));
    // an ad card above it, a picture with no words: hills and a sun, a tulip, the sea
    const ax = o.x - 70, ay = -236, kind = r.int(0, 2);
    shapes.push(S(rrect(ax - 3, ay - 3, 146, 32, 2), CAR.steel), S(rect(ax, ay, 140, 26), "#FBF7EE"));
    if (kind === 0) shapes.push(S(rect(ax, ay, 140, 26), "#BFE0EE", { flat: true }), P([[ax, ay + 26, 0], [ax, ay + 16], [ax + 50, ay + 9], [ax + 100, ay + 17], [ax + 140, ay + 12], [ax + 140, ay + 26, 0]], "#5E9A55", { flat: true }), S(ellipse(ax + 112, ay + 8, 5), "#F2B705", { flat: true }));
    else if (kind === 1) shapes.push(S(rect(ax, ay, 140, 26), "#F3E3D3", { flat: true }), L([[ax + 70, ay + 24], [ax + 70, ay + 12]], "#4E7A48", 1.6, 1), P([[ax + 63, ay + 13, 0], [ax + 62, ay + 4], [ax + 66, ay + 8], [ax + 70, ay + 2], [ax + 74, ay + 8], [ax + 78, ay + 4], [ax + 77, ay + 13, 0]], "#C4302B", { flat: true }), S(rect(ax + 10, ay + 9, 34, 3), acc, { flat: true }), S(rect(ax + 10, ay + 15, 24, 3), "#B9B2A6", { flat: true }));
    else shapes.push(S(rect(ax, ay, 140, 26), "#2E5E8C", { flat: true }), ...[0, 1, 2].map(k => L(Array.from({ length: 8 }, (_, i) => [ax + 4 + i * 19, ay + 8 + k * 6 + (i % 2) * 2.5] as Vec2), "#8DB8DA", 1.4, 0.9)), S(rect(ax + 98, ay + 3, 3, 10), "#FBF7EE", { flat: true }), P([[ax + 101, ay + 4, 0], [ax + 112, ay + 12, 0], [ax + 101, ay + 12, 0]], "#FBF7EE", { flat: true }));
  }
  // door pairs: the frame, two glazed leaves, the seam, yellow edges and the closing lamp (unlit while they stay shut)
  for (const dx of doors) {
    const [hl, hr] = doorHoles(dx);
    shapes.push(S(holed(rect(dx - 72, -206, 144, 206), [rect(dx - 66, -200, 132, 200)]), CAR.rubber, { evenodd: true }));
    if (tt) {
      const ts = doorTimes(tt), lamp: FlatMotion = { blink: { ms: tt.ms, on: ts[4] - ts[1], at: ts[1] }, clock: "stops" };
      for (const k of [-1, 1]) moving.push({ group: { shapes: doorLeaf(dx, k, 0), edge: 1 }, z: -0.6, ppcm: 0.9, shadow: "none", move: { path: { pts: [[0, 0, 0], [0, 0, 0], [k * 63, 0, 0], [k * 63, 0, 0], [0, 0, 0]], ms: tt.ms, at: ts }, clock: "stops" } });
      moving.push({ group: { shapes: [S(ellipse(dx + 60, -213, 4.5, 3.5), "#FFB35C")], edge: 0 }, emissive: { shapes: [S(ellipse(dx + 60, -213, 9, 7), "#FFB35C", { flat: true })], edge: 0 }, z: 0.5, ppcm: 0.9, lit: 0, shadow: "none", move: lamp });
      shapes.push(S(rect(dx - 66, -200, 4, 200), CAR.warn, { flat: true }), S(rect(dx + 62, -200, 4, 200), CAR.warn, { flat: true }));
      shapes.push(S(ellipse(dx + 60, -213, 4.5, 3.5), "#E07A3A"), S(ellipse(dx + 59, -214, 1.6, 1.2), "#FFD2A8", { flat: true }));
      continue;
    }
    shapes.push(S(holed(rect(dx - 66, -200, 65, 200), [hl]), CAR.door, { evenodd: true }), S(holed(rect(dx + 1, -200, 65, 200), [hr]), CAR.door, { evenodd: true }));
    for (const [hx, hole] of [[dx - 57, hl], [dx + 9, hr]] as const) {
      shapes.push(S(holed(rrect(hx - 3, -189, 54, 92, 9), [hole]), CAR.rubber, { evenodd: true }), S(hole, "#D6ECF2", { flat: true, opacity: 0.1 }));
      shapes.push(L([[hx + 8, -112], [hx + 22, -170]], "#FFFFFF", 3, 0.2));
    }
    shapes.push(S(rect(dx - 1.5, -200, 3, 200), CAR.rubber, { flat: true }), S(rect(dx - 66, -16, 132, 14), tone(CAR.door, "shade")));
    shapes.push(S(rect(dx - 66, -200, 4, 200), CAR.warn, { flat: true }), S(rect(dx + 62, -200, 4, 200), CAR.warn, { flat: true }));
    shapes.push(S(ellipse(dx + 60, -213, 4.5, 3.5), "#E07A3A"), S(ellipse(dx + 59, -214, 1.6, 1.2), "#FFD2A8", { flat: true }));
  }
  // the cove, the light strip and the ceiling: panel joints and a vent
  shapes.push(S(rect(-w / 2, -284, w, 44), tone(CAR.panel, "light")), S(rect(-w / 2, -246, w, 6), tone(CAR.panel, "shade"), { flat: true, opacity: 0.35 }));
  shapes.push(S(rect(-w / 2, -h, w, h - 284), CAR.ceil), S(rrect(-w / 2 + 8, -297, w - 16, 12, 6), "#FBFAF2"));
  glow.push(S(rrect(-w / 2 + 8, -297, w - 16, 12, 6), CAR.lamp, { flat: true }), S(rrect(-w / 2, -302, w, 22, 11), CAR.lamp, { flat: true, opacity: 0.35 }));
  for (let x = -w / 2 + 120; x < w / 2; x += 120) shapes.push(L([[x, -h], [x, -300]], tone(CAR.ceil, "shade"), 0.8, 0.6));
  let vent = rect(-w / 2 + 20, -334, 24, 4);
  for (let x = -w / 2 + 64; x < w / 2 - 40; x += 44) vent = vent.add(rect(x, -334, 24, 4));
  shapes.push(S(vent, tone(CAR.ceil, "deep"), { flat: true, opacity: 0.6 }));
  const lights: LightSpec[] = [-160, 160].map(x => ({ x, y: 262, z: 210, color: "#FFF1D6", radius: 6, intensity: 1.4, at: ["dusk", "night"] }));
  return { flats: [{ group: { shapes, edge: 1 }, emissive: { shapes: glow, edge: 0 }, ppcm: 0.9 }, ...moving], lights };
},
  meta: {
    about: "A metro car's far side: window openings, door pairs, ad cards, the cove, the light strip and the ceiling.",
    params: {
      w: { type: "num", default: 1000, about: "cm" },
      h: { type: "num", default: 400, about: "up to the ceiling, cm" },
      color: { type: "color", default: "#2F8C88", about: "the line's accent, a palette id or a hex" },
      windows: { type: "list", about: "{x, w} window openings, cm; default two of 240 at ±215" },
      doors: { type: "list", about: "door pairs' centres, cm; default [0]" },
      stops: { ...stopsParam, about: "the car's timetable (true or {ms, run, ease}): the doors slide open at each stop and shut before the next leg, the lamp lit meanwhile" },
    },
    tags: ["metro", "wall", "window", "door", "light"],
  } };

/** The car's floor: speckled rubber, a yellow strip at each door (`doors`), a shade along the far side. Lies flat from the wall towards us. */
const metroFloor: PieceDef = { draw(p, r) {
  const w = num(p.w, 1000), d = num(p.d, 600), c = hex(p.color, "#8E969C");
  let lt: Path = ellipse(-w / 2, 0, 0.1), dk: Path = ellipse(-w / 2, 0, 0.1);
  for (let i = 0; i < 1100; i++) { const e = ellipse(r.range(-w / 2, w / 2), r.range(0, d), r.range(1, 2.2)); if (i % 2) lt = lt.add(e); else dk = dk.add(e); }
  const shapes: Shape[] = [S(rect(-w / 2, 0, w, d), c), S(lt, tone(c, "light"), { flat: true, opacity: 0.55 }), S(dk, tone(c, "shade"), { flat: true, opacity: 0.45 })];
  shapes.push(S(rect(-w / 2, 0, w, 34), tone(c, "deep"), { flat: true, opacity: 0.25 }));
  for (const dx of (p.doors as number[] | undefined) ?? [0]) shapes.push(S(rect(dx - 70, 3, 140, 12), CAR.warn), S(rect(dx - 70, 20, 140, 3), CAR.warn, { flat: true, opacity: 0.8 }));
  return { flats: [{ group: { shapes, edge: 0 }, pitch: -Math.PI / 2, ppcm: 0.4, lit: 1 }] };
},
  meta: {
    about: "A metro car's floor laid flat: speckled rubber, a yellow strip at each door, a shade along the far side.",
    params: {
      w: { type: "num", default: 1000, about: "cm" },
      d: { type: "num", default: 600, about: "depth, cm" },
      color: { type: "color", default: "#8E969C", about: "a palette id or a hex" },
      doors: { type: "list", about: "door centres, cm; default [0]" },
    },
    tags: ["metro", "floor"],
  } };

/** A bench of moulded seats along the wall, under a window: `w` cm, `color` (the seats). */
const metroBench: PieceDef = { draw(p) {
  const w = num(p.w, 230), c = hex(p.color, CAR.seat), n = Math.max(1, Math.round(w / 46)), sw = w / n, base = "#5A646C";
  const shapes: Shape[] = [S(rect(-w / 2, -42, w, 42), base), S(rect(-w / 2, -8, w, 8), tone(base, "deep"))];
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * sw;
    shapes.push(S(rrect(x0 + 3, -90, sw - 6, 46, [9, 9, 4, 4]), c), S(rect(x0 + 6, -86, sw - 12, 3), tone(c, "light"), { flat: true, opacity: 0.6 }));
    shapes.push(S(rrect(x0 + 1.5, -51, sw - 3, 11, 5), tone(c, "light")), S(rect(x0 + 4, -42, sw - 8, 2), tone(c, "deep"), { flat: true, opacity: 0.5 }));
  }
  // the end screens: a steel hoop each side
  for (const e of [-w / 2 - 2, w / 2 + 2]) shapes.push(S(rrect(e - 2.6, -112, 5.2, 112, 2.6), CAR.steel), S(rect(e - 6, -3, 12, 3), tone(CAR.steel, "shade")));
  return { flats: [{ group: { shapes, edge: 0.8 }, ppcm: 1.2, shadow: "drop" }] };
},
  meta: {
    about: "A metro bench of moulded seats along the wall, a steel hoop at each end.",
    params: {
      w: { type: "num", default: 230, about: "cm" },
      color: { type: "color", default: "#3F6E9E", about: "the seats, a palette id or a hex" },
    },
    tags: ["metro", "seating"],
  } };

/** A floor-to-ceiling pole, `h` cm. */
const metroPole: PieceDef = { draw(p) {
  const h = num(p.h, 296);
  const shapes: Shape[] = [
    S(ellipse(0, -1.5, 7, 2.6), tone(CAR.steel, "shade")), S(rrect(-2.4, -h, 4.8, h, 2.4), CAR.steel),
    L([[-0.9, -h + 4], [-0.9, -8]], "#FFFFFF", 0.9, 0.55), S(rect(1, -h + 2, 1.2, h - 6), tone(CAR.steel, "shade"), { flat: true, opacity: 0.5 }),
    S(rect(-6, -h, 12, 3), tone(CAR.steel, "shade")),
  ];
  return { flats: [{ group: { shapes, edge: 0.5 }, ppcm: 2 }] };
},
  meta: {
    about: "A steel floor-to-ceiling pole.",
    params: { h: { type: "num", default: 296, about: "cm" } },
    tags: ["metro"],
  } };

/** A grab rail at `y` cm, `w` long, hung from the ceiling, with `n` straps that sway together, each a little after the last. */
const metroStraps: PieceDef = { draw(p) {
  const w = num(p.w, 230), n = Math.max(1, Math.round(num(p.n, 5))), y = num(p.rail, 196), hand = hex(p.color, "#ECE6D2");
  const rail: Shape[] = [S(rrect(-w / 2, -y - 2.5, w, 5, 2.5), CAR.steel), L([[-w / 2 + 2, -y - 1.2], [w / 2 - 2, -y - 1.2]], "#FFFFFF", 0.8, 0.5)];
  for (const xe of [-w / 2 + 12, w / 2 - 12]) rail.push(S(rect(xe - 1.3, -296, 2.6, 296 - y), CAR.steel), S(rrect(xe - 3.5, -y - 4, 7, 8, 2), tone(CAR.steel, "shade")));
  const strap: Shape[] = [S(rrect(-1.8, -1, 3.6, 20, 1.2), "#384451"), S(holed(rrect(-6.5, 17, 13, 13, 5), [rrect(-4, 19.5, 8, 8, 3.5)]), hand, { evenodd: true }), S(rect(-2.6, 15, 5.2, 4), "#384451")];
  const flats = [{ group: { shapes: rail, edge: 0.5 }, ppcm: 1.2 }, ...Array.from({ length: n }, (_, i) => ({
    group: { shapes: strap, edge: 0.4 }, x: -w / 2 + (i + 0.5) * w / n, y, z: 1, ppcm: 3,
    move: { sway: { rot: 0.075, ms: 2600 }, phase: 0.025 * i },
  }))];
  return { flats };
},
  meta: {
    about: "A grab rail hung from the ceiling, with straps that sway together, each a little after the last.",
    params: {
      w: { type: "num", default: 230, about: "cm" },
      n: { type: "int", min: 0, default: 5, about: "how many straps" },
      rail: { type: "num", default: 196, about: "the rail's height, cm" },
      color: { type: "color", default: "#ECE6D2", about: "the handles, a palette id or a hex" },
    },
    tags: ["metro"],
  } };

/** The next-station display: a dark screen with amber `text` (HTML), `w` cm wide. */
const metroDisplay: PieceDef = { draw(p) {
  const w = num(p.w, 150), text = String(p.text ?? ""), st = (p.stations as string[] | undefined) ?? [], tt = timetable(p.stops);
  const screen = rect(-w / 2 + 4, -32, w - 8, 28);
  const shapes: Shape[] = [S(rect(-2, -45, 4, 10), CAR.rubber), S(rrect(-w / 2, -36, w, 36, 4), "#3B444C"), S(screen, "#14191D", { flat: true })];
  const line = (text: string): TextSpec[] => [{ text, x: -w / 2 + 7, y: -31, w: w - 14, h: 26, color: "#FFB547", font: "screen", weight: 600, lit: 0 }];
  if (tt && st.length > 1) {
    // a leg to each station after the first: "Gelecek istasyon: …" while it runs, the station's name while it stands there
    const legs = st.length - 1, all = legs * tt.ms, flats: FlatSpec[] = [{ group: { shapes, edge: 0.6 }, emissive: { shapes: [S(screen, "#FFB547", { flat: true, opacity: 0.16 })], edge: 0 }, ppcm: 2.5 }];
    for (let j = 1; j <= legs; j++) {
      const t0 = (j - 1) * tt.ms, blank = { shapes: [S(screen, "#14191D", { flat: true })], edge: 0 };
      flats.push({ group: blank, z: 0.2, ppcm: 2.5, lit: 0, text: line(`Gelecek istasyon: ${st[j]}`), move: { blink: { ms: all, on: tt.run / all, at: t0 / all }, clock: "stops" } });
      flats.push({ group: blank, z: 0.2, ppcm: 2.5, lit: 0, text: line(st[j]), move: { blink: { ms: all, on: (tt.ms - tt.run) / all, at: (t0 + tt.run) / all }, clock: "stops" } });
    }
    return { flats };
  }
  return { flats: [{
    group: { shapes, edge: 0.6 }, emissive: { shapes: [S(screen, "#FFB547", { flat: true, opacity: 0.16 })], edge: 0 }, ppcm: 2.5,
    text: text ? [{ text, x: -w / 2 + 7, y: -31, w: w - 14, h: 26, color: "#FFB547", font: "screen", weight: 600, lit: 0 }] : undefined,
  }] };
},
  meta: {
    about: "The next-station display: a dark screen with amber text.",
    params: {
      text: { type: "text", default: "", about: "the screen's text" },
      w: { type: "num", default: 150, about: "cm" },
      stations: { type: "list", about: "the line's stations in the order the car goes; with stops, the next one's name while it runs, its own while it stands" },
      stops: { ...stopsParam },
    },
    tags: ["metro", "sign"],
  } };

/** The route over the door: a line (`line`, its badge) of `n` stations between `ends` [left, right], passed ones grey, the next one (`at`) blinking. Only the ends are named (HTML). */
const routeStrip: PieceDef = { draw(p) {
  const w = num(p.w, 220), n = Math.max(2, num(p.n, 7)), at = num(p.at, n - 1), c = hex(p.color, CAR.accent), line = String(p.line ?? "");
  const ends = (p.ends as string[] | undefined) ?? [];
  const x0 = -w / 2 + 44, x1 = w / 2 - 16, cx = (i: number) => x0 + i * (x1 - x0) / (n - 1);
  const shapes: Shape[] = [S(rrect(-w / 2, -44, w, 44, 5), CAR.steel), S(rrect(-w / 2 + 2, -42, w - 4, 40, 4), "#FBFAF6"), S(rect(x0, -16.8, x1 - x0, 3.6), c, { flat: true })];
  if (line) shapes.push(S(rrect(-w / 2 + 7, -37, 30, 17, 3), c));
  const tt = timetable(p.stops), ring = (i: number, col: string) => [S(ellipse(cx(i), -15, 4.6), col), S(ellipse(cx(i), -15, 2.5), "#FBFAF6", { flat: true })];
  for (let i = 0; i < n; i++) shapes.push(...ring(i, !tt && i < at ? "#AEB8BE" : c));
  const dot = S(ellipse(cx(at), -15, 5), "#F2B705");
  const lw = (x1 - x0) / 2 + 4, lab = (text: string, x: number, align: "left" | "right") => ({ text, x, y: -40, w: lw, h: 15, align, font: "print" as const, weight: 600, color: "#2B2420" });
  const text = [...(line ? [{ text: line, x: -w / 2 + 7, y: -37, w: 30, h: 17, color: "#FFFFFF", font: "print" as const, weight: 700 }] : []),
    ...(ends[0] ? [lab(ends[0], x0 - 6, "left")] : []), ...(ends[1] ? [lab(ends[1], x1 + 6 - lw, "right")] : [])];
  if (tt) {
    // on the timetable: through each leg and its stop, the stations passed grey and the one it goes to lit
    const legs = n - 1, flats: FlatSpec[] = [{ group: { shapes, edge: 0.6 }, ppcm: 2, text: text.length ? text : undefined }];
    for (let j = 1; j <= legs; j++) flats.push({
      group: { shapes: [...Array.from({ length: j }, (_, i) => ring(i, "#AEB8BE")).flat(), S(ellipse(cx(j), -15, 5), "#F2B705")], edge: 0.5 },
      emissive: { shapes: [S(ellipse(cx(j), -15, 4.2), "#FFD27A", { flat: true })], edge: 0 }, z: 0.5, ppcm: 2, move: { blink: { ms: legs * tt.ms, on: 1 / legs, at: (j - 1) / legs }, clock: "stops" },
    });
    return { flats };
  }
  return { flats: [
    { group: { shapes, edge: 0.6 }, ppcm: 2, text: text.length ? text : undefined },
    { group: { shapes: [dot], edge: 0.5 }, emissive: { shapes: [S(ellipse(cx(at), -15, 4.2), "#FFD27A", { flat: true })], edge: 0 }, z: 0.5, ppcm: 2, move: { blink: { ms: 1400, on: 0.6 } } },
  ] };
},
  meta: {
    about: "The route over the door: a line's stations between two named ends, passed ones grey, the next one blinking.",
    params: {
      w: { type: "num", default: 220, about: "cm" },
      n: { type: "int", min: 2, default: 7, about: "how many stations" },
      at: { type: "int", min: 0, about: "the next station's index; default the last" },
      color: { type: "color", default: "#2F8C88", about: "the line's colour, a palette id or a hex" },
      line: { type: "text", default: "", about: "the line's badge, e.g. M2" },
      ends: { type: "list", about: "[left, right] end stations' names" },
      stops: { ...stopsParam, about: "the car's timetable (true or {ms, run, ease}): the lit station moves on a station each leg, the ones passed grey" },
    },
    tags: ["metro", "sign"],
  } };

// ---- The outside, going by ------------------------------------------------------------------

interface Layer {
  /** cm the strip slides each period (negative: the outside goes left, the train goes right), and the period, ms. */
  dx: number; ms: number; ppcm: number; edge: number;
  /** How tall the strip is, cm. */
  h: number;
  /** Shapes in the strip: `rep` repeats a period's shapes across it; continuous bands span `lo` … `hi` themselves. Night glow goes in `lit`. */
  draw(r: Rng, per: number, lo: number, hi: number, rep: (s: Shape[]) => Shape[], lit: Shape[]): Shape[];
}

const FAR_TOWERS = ["#9FB0BF", "#B4C0CB", "#8FA3B6", "#A9B3AE"];
const HOUSES = ["#E9D7B5", "#DCC6A6", "#CFD8CF", "#E3C3B0", "#C9CFD8", "#F0E2C6"];
const TREES = ["#5F8F55", "#6E9C5C", "#4E7A48", "#7FA35F"];

export const VIEW_LAYERS: Record<string, Layer> = {
  /** The viaduct's own edge: concrete parapet, a railing and catenary masts with their wires. Fast. */
  masts: { dx: -600, ms: 1300, ppcm: 0.6, edge: 1, h: 290, draw(_r, per, lo, hi, rep) {
    const steel = "#87929A", conc = "#C4BFB4", wire = "#3F4850";
    const out = [L([[lo, -278], [hi, -278]], wire, 1.2, 0.85), L([[lo, -262], [hi, -262]], wire, 1.4, 0.9)];
    out.push(...rep(Array.from({ length: 6 }, (_, i) => L([[i * per / 6, -278], [i * per / 6, -262]], wire, 0.6, 0.7))));
    const m = per * 0.35;
    out.push(...rep([S(rect(m - 5, -288, 10, 228), steel), S(rect(m - 2, -288, 2.5, 228), tone(steel, "light"), { flat: true, opacity: 0.6 }), S(rect(m - 10, -64, 20, 6), tone(steel, "shade")),
      L([[m, -268], [m + 95, -265]], tone(steel, "deep"), 3.4, 1), L([[m, -286], [m + 84, -268]], tone(steel, "deep"), 2, 1), S(ellipse(m + 70, -258, 3, 5), "#9E6B4F")]));
    out.push(S(rect(lo, -100, hi - lo, 4), "#8E979E"), S(rect(lo, -80, hi - lo, 3), "#8E979E"));
    out.push(...rep(Array.from({ length: 4 }, (_, i) => S(rect(i * per / 4 + 30 - 2, -100, 4, 44), "#8E979E"))));
    out.push(S(rect(lo, -56, hi - lo, 56), conc), S(rect(lo, -61, hi - lo, 7), tone(conc, "light")));
    out.push(...rep(Array.from({ length: 3 }, (_, i) => L([[i * per / 3 + 70, -54], [i * per / 3 + 70, 0]], tone(conc, "shade"), 1.4, 0.6))));
    return out;
  } },
  /** The town below the viaduct: low blocks with tiled roofs, trees and cypresses, a road with lamps and a car. */
  town: { dx: -1200, ms: 6000, ppcm: 0.45, edge: 1.6, h: 260, draw(r, per, lo, hi, rep, lit) {
    const G = 110, out: Shape[] = [S(rect(lo, -G - 8, hi - lo, G + 8), "#A9B58F")];
    const blocks: Shape[] = [], wins: Shape[] = [];
    for (let x = r.range(0, 40); x < per - 60;) {
      const bw = r.range(40, 100), bh = r.range(18, 45), c = r.pick(HOUSES), y = -G - 4 - bh;
      blocks.push(S(rect(x, y, bw, bh), c), S(rect(x + bw - 5, y, 5, bh), tone(c, "shade"), { flat: true, opacity: 0.45 }));
      if (r.chance(0.6)) blocks.push(P([[x - 6, y, 0], [x + bw + 6, y, 0], [x + bw / 2, y - r.range(8, 14), 0]], "#B5583A"));
      else blocks.push(S(rect(x - 2, y - 4, bw + 4, 5), tone(c, "deep")));
      for (let fy = y + 6; fy < -G - 12; fy += 12) for (let wx = x + 6; wx < x + bw - 10; wx += 11) {
        wins.push(S(rect(wx, fy, 5, 6), "#6E7F92", { flat: true, opacity: 0.85 }));
        if (r.chance(0.4)) lit.push(S(rect(wx, fy, 5, 6), "#FFD27A", { flat: true }));
      }
      x += bw + r.range(20, 70);
    }
    out.push(...rep(blocks), ...rep(wins));
    const trees: Shape[] = [];
    for (let i = 0; i < 12; i++) {
      const x = r.range(0, per), g = r.pick(TREES);
      if (r.chance(0.3)) trees.push(S(ellipse(x, -G - 22, 5, 24), "#3F6B45"));
      else { const rx = r.range(9, 16); trees.push(S(rect(x - 1.5, -G - 8, 3, 10), "#7A5A44"), S(ellipse(x, -G - 7 - rx * 0.8, rx, rx * 0.8), g), S(ellipse(x - rx * 0.3, -G - 7 - rx * 1.05, rx * 0.45, rx * 0.33), tone(g, "light"), { flat: true, opacity: 0.6 })); }
    }
    out.push(...rep(trees));
    // the road nearest the viaduct, and what is on it
    out.push(S(rect(lo, -112, hi - lo, 16), "#7A8086"), S(rect(lo, -96, hi - lo, 4), tone("#A9B58F", "shade")));
    out.push(...rep(Array.from({ length: 8 }, (_, i) => S(rect(i * per / 8, -105, 26, 2.2), "#F4F1EA", { flat: true }))));
    const lamps: Shape[] = [];
    for (const x of [per * 0.2, per * 0.7]) { lamps.push(L([[x, -112], [x, -158], [x + 10, -162]], "#3B3B40", 2.4, 1), S(ellipse(x + 12, -161, 5, 2.5), "#3B3B40")); lit.push(S(ellipse(x + 12, -159, 4, 2), "#FFE6A8", { flat: true })); }
    out.push(...rep(lamps));
    const cx = per * r.range(0.4, 0.6), car = r.pick(["#C4553A", "#2E5E8C", "#F2B705", "#F4F1EA"]);
    out.push(...rep([P([[cx - 22, -99, 0], [cx + 22, -99, 0], [cx + 22, -109], [cx + 12, -111], [cx + 6, -119, 0], [cx - 10, -119, 0], [cx - 18, -110], [cx - 22, -109]], car), S(rect(cx - 8, -117, 13, 6), "#7E93A8", { flat: true }), S(ellipse(cx - 13, -98, 3.5), "#2B2420"), S(ellipse(cx + 13, -98, 3.5), "#2B2420")]));
    return out;
  } },
  /** The far side: a pale ridge with towers and a mosque on it, green hills, a scatter of roofs. Slow. */
  hills: { dx: -2400, ms: 60000, ppcm: 0.25, edge: 2.2, h: 380, draw(r, per, lo, hi, rep, lit) {
    const out: Shape[] = [S(ridge(r, per, lo, hi, 230, 20), "#B3C5C6")];
    const towers: Shape[] = [];
    for (let i = 0; i < 4; i++) {
      const x = per * (0.08 + i * 0.12) + r.range(-20, 20), tw = r.range(12, 24), th = r.range(25, 60), c = r.pick(FAR_TOWERS), y = -214 - th;
      towers.push(S(rect(x, y, tw, th + 10), c), S(rect(x + tw * 0.65, y, tw * 0.35, th + 10), tone(c, "shade"), { flat: true, opacity: 0.4 }));
      if (r.chance(0.5)) towers.push(P([[x, y, 0], [x + tw, y, 0], [x + tw / 2, y - tw * 0.6, 0]], tone(c, "light")));
      for (let k = 0; k < th / 14; k++) if (r.chance(0.5)) lit.push(S(rect(x + 3, y + 6 + k * 14, tw - 6, 3), "#FFE2A6", { flat: true, opacity: 0.8 }));
    }
    // a mosque on the ridge: a dome on a drum, half-domes and two minarets (k: its scale)
    const mx = per * 0.72, my = -214, mc = "#CDD2D4", k = 0.6, q = (x: number, y: number): Pt => [mx + x * k, my - y * k, 0];
    towers.push(S(rect(mx - 60 * k, my - 34 * k, 120 * k, 40 * k), mc), P([q(-34, 34), [mx - 30 * k, my - 58 * k], [mx, my - 72 * k], [mx + 30 * k, my - 58 * k], q(34, 34)], mc), S(rect(mx - 2 * k, my - 82 * k, 4 * k, 11 * k), tone(mc, "shade")));
    towers.push(P([q(-60, 34), [mx - 52 * k, my - 46 * k], q(-38, 34)], tone(mc, "light")), P([q(38, 34), [mx + 52 * k, my - 46 * k], q(60, 34)], tone(mc, "light")));
    for (const m of [-78, 78]) {
      const mm = mx + m * k;
      towers.push(S(rect(mm - 3.5 * k, my - 120 * k, 7 * k, 126 * k), mc), S(rect(mm - 6 * k, my - 92 * k, 12 * k, 3 * k), tone(mc, "shade")), P([[mm - 4 * k, my - 120 * k, 0], [mm, my - 140 * k, 0], [mm + 4 * k, my - 120 * k, 0]], "#8E9AA3"));
      lit.push(S(rect(mm - 6 * k, my - 92 * k, 12 * k, 3 * k), "#FFE6A8", { flat: true }));
    }
    out.push(...rep(towers));
    out.push(S(ridge(r, per, lo, hi, 192, 26), "#8CAA8C"));
    const roofs: Shape[] = [], woods: Shape[] = [];
    for (let i = 0; i < 26; i++) woods.push(S(ellipse(r.range(0, per), -r.range(140, 185), r.range(14, 30), r.range(7, 12)), "#7A9A7E", { flat: true, opacity: 0.7 }));
    for (let i = 0; i < 60; i++) {
      const x = r.range(0, per), y = -r.range(115, 165), rw = r.range(8, 16);
      roofs.push(S(rect(x, y, rw, 5), r.chance(0.7) ? "#C27A5E" : "#E9E1D2", { flat: true, opacity: 0.85 }));
      if (r.chance(0.35)) lit.push(S(rect(x + 2, y + 5, 3, 2.5), "#FFD27A", { flat: true }));
    }
    out.push(...rep(woods), ...rep(roofs));
    return out;
  } },
  /** The tunnel wall close by, underground: dark concrete in ring segments, cable trays along it, and lamps that flick past. Fast. */
  tunnel: { dx: -900, ms: 800, ppcm: 0.6, edge: 1, h: 340, draw(_r, per, lo, hi, rep, lit) {
    const wall = "#34383C", out: Shape[] = [S(rect(lo, -340, hi - lo, 340), wall), S(rect(lo, -340, hi - lo, 60), tone(wall, "deep")), S(rect(lo, -40, hi - lo, 40), tone(wall, "deep"))];
    // the joints between the rings, and a refuge niche now and then
    out.push(...rep([0.25, 0.75].map(k => L([[k * per, -340], [k * per, 0]], tone(wall, "deep"), 2.4, 0.9))));
    out.push(...rep([S(rect(per * 0.48, -190, 50, 150), "#26292C"), S(rect(per * 0.48, -190, 50, 6), tone(wall, "light"), { flat: true, opacity: 0.5 })]));
    // the cable trays: three bundles along the wall, one with a brace
    for (const [y, c] of [[-112, "#1E2124"], [-100, "#4A4F54"], [-88, "#2B2E31"]] as const) out.push(L([[lo, y], [hi, y]], c, 3.2, 1));
    out.push(...rep([0.1, 0.6].map(k => S(rect(k * per - 2, -118, 4, 36), "#5A6066"))));
    // two lamps every period, and their pools of light on the wall
    for (const k of [0.05, 0.55]) {
      out.push(...rep([S(rrect(per * k, -168, 34, 9, 3), "#C9CCC2")]));
      lit.push(S(rrect(per * k - 4, -170, 42, 13, 5), "#FFF4D8", { flat: true }), S(ellipse(per * k + 17, -150, 60, 38), "#FFE9B8", { flat: true, opacity: 0.18 }));
    }
    return out;
  } },
  /** Paper clouds, very slow. */
  clouds: { dx: -3000, ms: 240000, ppcm: 0.25, edge: 2.5, h: 200, draw(r, per, _lo, _hi, rep) {
    const out: Shape[] = [];
    for (let i = 0; i < 4; i++) {
      const x = per * (i + r.range(0.1, 0.6)) / 4, y = -r.range(40, 150), s = r.range(0.7, 1.3);
      out.push(P([[x - 70 * s, y, 0], [x - 60 * s, y - 16 * s], [x - 30 * s, y - 24 * s], [x - 8 * s, y - 40 * s], [x + 24 * s, y - 32 * s], [x + 50 * s, y - 20 * s], [x + 76 * s, y, 0]], "#FBFBF7", { opacity: 0.92 }));
    }
    return rep(out);
  } },
};

/** One layer of the outside going by (`layer`: masts, town, hills, clouds or tunnel), a seamless strip covering `w` cm plus its period; `dx`, `ms` and `phase` override the layer's speed. */
const scrollView: PieceDef = { draw(p, r) {
  const tt = timetable(p.stops);
  if (String(p.layer) === "platform" || String(p.layer) === "bus_stop") {
    // the station (or the bus stop): one that leaves as the leg starts and another that comes in as it ends, both stopping with the car
    const t = tt ?? TIMETABLE, far = Math.abs(num(p.dx, 3600)), lit: Shape[] = [], art = String(p.layer) === "bus_stop" ? busStopArt(r, num(p.w, 1200), lit) : platformArt(r, num(p.w, 1600), lit);
    return { flats: [0, 1].map(k => ({
      group: { shapes: art, edge: 1 }, emissive: { shapes: lit, edge: 0 }, switch: false as const, ppcm: 0.6,
      move: { path: { pts: (k ? [[far, 0, 0], [0, 0, 0]] : [[0, 0, 0], [-far, 0, 0]]) as [number, number, number][], ms: t.run }, stops: t, clock: "stops" },
    })) };
  }
  const lay = VIEW_LAYERS[String(p.layer)] ?? VIEW_LAYERS.town;
  const dx = num(p.dx, lay.dx), ms = num(p.ms, lay.ms), w = num(p.w, 1600), per = Math.abs(dx) || 1000;
  const lo = -w / 2 - Math.max(0, dx), hi = w / 2 + Math.max(0, -dx), box = rect(lo, -lay.h, hi - lo, lay.h + 0.5);
  const rep = (ss: Shape[]) => ss.map(s => ({ ...s, path: copies(s.path, per, lo, hi) }));
  const lit: Shape[] = [], art = lay.draw(r, per, lo, hi, rep, lit);
  const cut = (ss: Shape[]) => ss.map(s => ({ ...s, clip: box }));
  return { flats: [{
    group: { shapes: cut(art), edge: lay.edge }, switch: false, emissive: lit.length ? { shapes: cut(rep(lit)), edge: 0 } : undefined,
    ppcm: lay.ppcm, move: { scroll: { dx, ms }, phase: num(p.phase, 0), ...(tt ? { stops: tt, clock: "stops" as const } : {}) },
  }] };
},
  meta: {
    about: "One layer of the outside going by a train's windows, a seamless strip that slides and starts over.",
    params: {
      layer: { type: "enum", values: ["masts", "town", "hills", "clouds", "tunnel", "platform", "bus_stop"], default: "town", about: "tunnel: the wall of an underground line close by; platform: a station's platform that the car stops at; bus_stop: a bus stop on the pavement that the bus stops at (on its timetable)" },
      w: { type: "num", default: 1600, about: "cm covered; platform: its length" },
      dx: { type: "num", about: "cm it slides each period, negative goes left; default the layer's; platform: how far it goes in a leg (3600)" },
      ms: { type: "num", about: "the period, ms; default the layer's" },
      phase: { type: "num", min: 0, max: 1, default: 0 },
      stops: { ...stopsParam, about: "the car's timetable (true or {ms, run, ease}): the outside slows to a stop at each station and pulls away again" },
    },
    tags: ["metro", "view", "sky"],
  } };

/** The train on the next track, `len` cm of it from its tail end, cut at the floor line (our parapet hides its wheels): a pale car, its windows in a dark band, people in some, a door pair, a `color` stripe. It keeps pace with us: a slow drift and the rails' rock. */
const metroAlongside: PieceDef = { draw(p, r) {
  const len = num(p.len, 900), c = hex(p.color, "#D9534A"), x0 = -len / 2, body = "#DDE3E7", band = "#3A4550";
  const shapes: Shape[] = [P([[x0 + 2, 0, 0], [x0 + len, 0, 0], [x0 + len, -290, 0], [x0 + 46, -290], [x0 + 10, -268], [x0, -222], [x0, -30]], body)];
  shapes.push(S(rect(x0 + 2, -190, len - 2, 104), band), S(rect(x0 + 2, -80, len - 2, 10), c, { flat: true }), S(rect(x0 + 2, -68, len - 2, 2.5), tone(c, "deep"), { flat: true }), S(rect(x0 + 40, -290, len - 40, 8), tone(body, "light"), { flat: true }));
  for (const ax of [x0 + 260, x0 + 640]) shapes.push(S(rrect(ax - 60, -306, 120, 18, 6), tone(body, "shade")));
  const glow: Shape[] = [S(ellipse(x0 + 10, -44, 4, 3), "#FF5A4A", { flat: true }), S(ellipse(x0 + 10, -58, 4, 3), "#FF5A4A", { flat: true })];
  shapes.push(S(ellipse(x0 + 10, -44, 4.5, 3.5), "#B3261E"), S(ellipse(x0 + 10, -58, 4.5, 3.5), "#B3261E"));
  // the tail cab's window, the side windows (some with someone in them) and a door pair
  shapes.push(P([[x0 + 6, -110, 0], [x0 + 64, -110, 0], [x0 + 64, -238, 0], [x0 + 28, -238], [x0 + 10, -214]], "#55657A"));
  const pane = (x: number, y: number, w: number, h: number) => {
    shapes.push(S(rrect(x, y, w, h, 8), "#6F8296"));
    if (r.chance(0.55)) { const hx = x + r.range(18, w - 18), sk = r.pick(["#E8B98F", "#C98E62", "#8D5A3B", "#F1CBA5"]), cl = r.pick(["#2E5E8C", "#7A3E6E", "#3E7A3A", "#B3261E", "#4A4A4A"]); shapes.push(S(rrect(hx - 17, y + h - 26, 34, 26, [12, 12, 0, 0]), cl, { flat: true, opacity: 0.85 }), S(ellipse(hx, y + h - 36, 10, 11), sk, { flat: true, opacity: 0.85 }), S(ellipse(hx, y + h - 43, 10.5, 6), r.pick(["#2B2420", "#5B3A29", "#A0522D"]), { flat: true, opacity: 0.85 })); }
    shapes.push(S(rrect(x, y, w, h, 8), "#D6ECF2", { flat: true, opacity: 0.18 }), L([[x + w * 0.2, y + h - 10], [x + w * 0.45, y + 10]], "#FFFFFF", 3, 0.25));
    glow.push(S(rrect(x, y, w, h, 8), "#FFE6B0", { flat: true, opacity: 0.9 }));
  };
  for (const wx of [x0 + 110, x0 + 470, x0 + 600, x0 + 730]) pane(wx, -180, 105, 84);
  const dx = x0 + 330;
  shapes.push(S(rect(dx - 66, -250, 132, 250), tone(body, "shade")), S(rect(dx - 1.5, -250, 3, 250), band, { flat: true }));
  pane(dx - 56, -224, 46, 120); pane(dx + 10, -224, 46, 120);
  return { flats: [{
    group: { shapes, edge: 1.4 }, switch: false, emissive: { shapes: glow, edge: 0 }, ppcm: 0.6,
    move: { path: { pts: [[0, 0, 0], [-30, 0, 0], [12, 0, 0], [0, 0, 0]], ms: 12000 }, sway: { rot: 0.0012, dy: 0.7, ms: 1500 } },
  }] };
},
  meta: {
    about: "The train on the next track from its tail end: windows with people in some, a door pair, a stripe; drifting and rocking beside us.",
    params: {
      len: { type: "num", default: 900, about: "cm of it shown" },
      color: { type: "color", default: "#D9534A", about: "the stripe, a palette id or a hex" },
    },
    tags: ["metro", "vehicle"],
  } };

// ---- The station, and the car's doors and windows on their own -----------------------------------

/** The station's colours: the metro's red, the signs' navy, wall tiles and their joints, platform stone, the tunnel's dark. */
const ST = { red: "#D7262E", navy: "#22344E", tile: "#ECEAE2", grout: "#C9C4B8", stone: "#A29E97", dark: "#1F2428" };
/** An İETT bus window (`metro_window` bus; `cabin` bus has the same): sill and head, cm above the floor, and width. */
const BUS_WIN = { sill: 98, head: 200, w: 150 };

/** Running-bond tile joints, `tw` × `th` cm, printed over a path. */
const tiles = (path: Path, tw: number, th: number, c = ST.grout, op = 0.85): Shape => ({ path, flat: true, opacity: op, tile: { w: tw, h: th * 2, shapes: [S(rect(0, 0, tw, 0.9), c), S(rect(0, th, tw, 0.9), c), S(rect(0, 0, 0.9, th), c), S(rect(tw / 2, th, 0.9, th), c)] } });

/** The metro's mark, a red M on a white square of `s` cm with its top left at (x, y); at night the white glows round the M. */
function mMark(x: number, y: number, s: number) {
  const m = poly(([[0, 1], [0, 0], [0.25, 0], [0.5, 0.42], [0.75, 0], [1, 0], [1, 1], [0.77, 1], [0.77, 0.38], [0.5, 0.8], [0.23, 0.38], [0.23, 1]] as Vec2[]).map(([u, v]) => [x + s * (0.17 + u * 0.66), y + s * (0.2 + v * 0.6)] as Vec2));
  return {
    sh: [S(rrect(x, y, s, s, s * 0.14), "#FBFAF6"), S(m, ST.red, { flat: true })],
    glow: [S(holed(rrect(x, y, s, s, s * 0.14), [m]), "#FFF6E2", { flat: true, evenodd: true, opacity: 0.85 }), S(m, "#FF5A50", { flat: true, opacity: 0.6 })],
  };
}

/** A poster in a steel frame, `w` × `h` with its top left at (x, y): a picture without words, `kind` 0 the Bosphorus and a ferry, 1 a glass of tea, 2 tulips. */
function poster(x: number, y: number, w: number, h: number, kind: number): Shape[] {
  const out: Shape[] = [S(rrect(x - 4, y - 4, w + 8, h + 8, 2), CAR.steel), S(rect(x, y, w, h), "#FBF7EE")], f = { flat: true };
  if (kind === 0) {
    const sea = y + h * 0.58, fx = x + w * 0.22, fy = sea + h * 0.12;
    out.push(S(rect(x, y, w, h * 0.58), "#F3D9A8", f), S(ellipse(x + w * 0.72, y + h * 0.3, w * 0.11), "#F29E4C", f), P([[x, sea, 0], [x, sea - h * 0.08], [x + w * 0.3, sea - h * 0.14], [x + w * 0.62, sea - h * 0.06], [x + w, sea - h * 0.1], [x + w, sea, 0]], "#8E9E9A", f), S(rect(x, sea, w, h * 0.42), "#3F7FA6", f));
    out.push(P([[fx, fy - 8, 0], [fx + 52, fy - 8, 0], [fx + 46, fy, 0], [fx + 4, fy, 0]], "#F4F2EC", f), S(rect(fx + 8, fy - 15, 34, 7), "#F4F2EC", f), S(rect(fx + 22, fy - 23, 6, 8), "#24272B", f));
    for (let i = 0; i < 3; i++) out.push(L([[x + w * 0.12 + i * 30, sea + h * 0.3 + i * 5], [x + w * 0.12 + i * 30 + 12, sea + h * 0.3 + i * 5]], "#8DB8DA", 1.2, 0.9));
  } else if (kind === 1) {
    const cx = x + w / 2, by = y + h * 0.78;
    out.push(S(rect(x, y, w, h), "#B83A2E", f), S(ellipse(cx, by + 3, w * 0.3, 7), "#F4F1EA", f));
    out.push(P([[cx - 13, by, 0], [cx + 13, by, 0], [cx + 9, by - 24], [cx + 15, by - 52, 0], [cx - 15, by - 52, 0], [cx - 9, by - 24]], "#F1DFC4", f), P([[cx - 11, by - 3, 0], [cx + 11, by - 3, 0], [cx + 8, by - 24], [cx + 13, by - 44, 0], [cx - 13, by - 44, 0], [cx - 8, by - 24]], "#8E2A16", f), S(ellipse(cx - 6, by - 34, 1.8, 6), "#FFFFFF", { flat: true, opacity: 0.45 }));
  } else {
    out.push(S(rect(x, y, w, h), "#E4EDF0", f));
    for (let i = 0; i < 3; i++) {
      const tx = x + w * (0.25 + i * 0.25), ty = y + h * (0.36 + (i % 2) * 0.1);
      out.push(L([[tx, y + h], [tx + (i - 1) * 4, ty]], "#4E7A48", 2, 1), P([[tx - 8, ty + 4, 0], [tx - 9, ty - 10], [tx - 3, ty - 5], [tx, ty - 13], [tx + 3, ty - 5], [tx + 9, ty - 10], [tx + 8, ty + 4, 0]], ["#D7262E", "#F2B705", "#B04A8C"][i], f));
    }
  }
  return out;
}

/**
 * The car's sliding door pair as a piece of its own, tappable: the rubber frame with its yellow posts, two glazed leaves
 * that slide apart into the wall by `open` (0 shut … 1 wide open; while 0 < `open` < 1 the closing lamp blinks), and what
 * the doorway shows (`beyond`): "none", a hole for whatever is behind it; "tunnel", a dark tunnel wall with its cables;
 * "platform", a station's tiles and the platform's yellow edge. It is `metro_wall`'s door: put it over one (the same x)
 * to tap it or open it. `n` pairs side by side, `gap` cm apart.
 */
const metroDoor: PieceDef = { draw(p) {
  const n = Math.max(1, Math.round(num(p.n, 1))), gap = num(p.gap, 300), open = Math.min(1, Math.max(0, num(p.open, 0))), beyond = str(p.beyond, "none"), s = open * 63;
  const sh: Shape[] = [], lamp: Shape[] = [], glow: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * gap, c = { clip: rect(dx - 66, -200, 132, 200) };
    if (beyond === "tunnel") sh.push(S(rect(dx - 66, -200, 132, 200), "#2A2F34"), S(rect(dx - 66, -200, 132, 40), "#22272B", { flat: true }), S(rect(dx - 20, -200, 26, 200), "#343A40", { flat: true, opacity: 0.8 }), ...[-150, -143, -136, -62].map(y => L([[dx - 66, y], [dx + 66, y]], "#14181B", 2.2, 0.9)));
    else if (beyond === "platform") sh.push(S(rect(dx - 66, -200, 132, 200), ST.tile), tiles(rect(dx - 66, -200, 132, 186), 30, 15), S(rect(dx - 66, -112, 132, 14), "#3E9A4E"), S(rect(dx - 66, -14, 132, 14), ST.stone), S(rect(dx - 66, -11, 132, 6), CAR.warn));
    for (const k of [-1, 1]) {
      const lx = k < 0 ? dx - 66 - s : dx + 1 + s, hx = lx + (k < 0 ? 9 : 8), hole = rrect(hx, -186, 48, 86, 7);
      sh.push(S(holed(rect(lx, -200, 65, 200), [hole]), CAR.door, { evenodd: true, ...c }), S(holed(rrect(hx - 3, -189, 54, 92, 9), [hole]), CAR.rubber, { evenodd: true, ...c }));
      sh.push(S(hole, "#D6ECF2", { flat: true, opacity: 0.1, ...c }), { ...L([[hx + 8, -112], [hx + 22, -170]], "#FFFFFF", 3, 0.2), ...c }, S(rect(lx, -16, 65, 14), tone(CAR.door, "shade"), c), S(rect(k < 0 ? dx - 2 - s : dx + s, -200, 2, 200), CAR.rubber, { flat: true, ...c }));
    }
    sh.push(S(holed(rect(dx - 72, -206, 144, 206), [rect(dx - 66, -200, 132, 200)]), CAR.rubber, { evenodd: true }), S(rect(dx - 66, -200, 4, 200), CAR.warn, { flat: true }), S(rect(dx + 62, -200, 4, 200), CAR.warn, { flat: true }));
    sh.push(S(ellipse(dx + 60, -213, 4.5, 3.5), "#E07A3A"), S(ellipse(dx + 59, -214, 1.6, 1.2), "#FFD2A8", { flat: true }));
    lamp.push(S(ellipse(dx + 60, -213, 4.5, 3.5), "#FFB35C")); glow.push(S(ellipse(dx + 60, -213, 9, 7), "#FFB35C", { flat: true }));
  }
  const ppcm = Math.min(2, 1900 / ((n - 1) * gap + 150)), flats: FlatSpec[] = [{ group: { shapes: sh, edge: 1 }, ppcm, id: "metro_door" }];
  if (open > 0 && open < 1) flats.push({ group: { shapes: lamp, edge: 0 }, emissive: { shapes: glow, edge: 0 }, z: 0.5, ppcm, lit: 0, move: { blink: { ms: 700, on: 0.5 } } });
  return { flats };
},
  meta: {
    about: "A metro car's sliding door pair that opens apart, showing a hole, a tunnel or a platform beyond; its lamp blinks while it moves.",
    params: {
      open: { type: "num", min: 0, max: 1, default: 0, about: "0 shut … 1 wide open" },
      beyond: { type: "enum", values: ["none", "tunnel", "platform"], default: "none", about: "what the doorway shows" },
      n: { type: "int", min: 1, default: 1, about: "pairs side by side" },
      gap: { type: "num", default: 300, about: "between pairs, cm" },
    },
    tags: ["metro", "door"],
  } };

/**
 * A window as a piece of its own, tappable: a frame round an opening the outside shows through, `w` wide between `sill` and
 * `head` (cm above the floor, which is its origin). `kind` "metro" (default) is `metro_wall`'s window (rubber seal, faint
 * glass, glints): put it over one. "bus" is an İETT bus window, `cabin` bus's: a black frame with dotted frit, a tinted
 * pane, the sliding vent at the top with its catch, and on some pillars the red emergency hammer. `n` side by side, `gap` cm apart.
 */
const metroWindow: PieceDef = { draw(p, r) {
  const bus = str(p.kind, "metro") === "bus", n = Math.max(1, Math.round(num(p.n, 1))), w = num(p.w, bus ? BUS_WIN.w : 240);
  const sill = num(p.sill, bus ? BUS_WIN.sill : WIN.sill), head = num(p.head, bus ? BUS_WIN.head : WIN.head), wh = head - sill, gap = num(p.gap, w + (bus ? 14 : 190));
  const sh: Shape[] = [], frame = "#24272A";
  for (let i = 0; i < n; i++) {
    const x0 = (i - (n - 1) / 2) * gap - w / 2, hole = rrect(x0, -head, w, wh, bus ? 6 : 10);
    if (!bus) {
      sh.push(S(holed(rrect(x0 - 6, -head - 6, w + 12, wh + 12, 14), [hole]), CAR.rubber, { evenodd: true }), S(hole, "#D6ECF2", { flat: true, opacity: 0.1 }));
      sh.push(L([[x0 + w * 0.12, -sill - 14], [x0 + w * 0.3, -head + 34]], "#FFFFFF", 4, 0.22), L([[x0 + w * 0.2, -sill - 8], [x0 + w * 0.34, -sill - 50]], "#FFFFFF", 2, 0.18));
      continue;
    }
    const vent = -head + 30, inner = rrect(x0 + 4, -head + 4, w - 8, wh - 8, 4);
    sh.push(S(holed(rrect(x0 - 5, -head - 5, w + 10, wh + 10, 9), [hole]), frame, { evenodd: true }), S(holed(rrect(x0, -head, w, wh, 6), [inner]), frame, { evenodd: true, flat: true, opacity: 0.92 }));
    sh.push({ path: holed(rrect(x0 + 4, -head + 4, w - 8, wh - 8, 4), [rrect(x0 + 10, -head + 10, w - 20, wh - 20, 3)]), evenodd: true, flat: true, opacity: 0.85, tile: { w: 3.4, h: 3.4, shapes: [S(ellipse(1.7, 1.7, 1.05), frame)] } });
    sh.push(S(hole, "#B9D3CF", { flat: true, opacity: 0.14 }), S(rect(x0, vent, w, 4), frame), S(rect(x0 + w / 2 - 1.5, -head, 3, 31), frame), S(rrect(x0 + w / 2 + 4, vent - 7, 9, 4, 1.5), "#9AA2A8"));
    sh.push(L([[x0 + w * 0.14, -sill - 12], [x0 + w * 0.32, vent + 22]], "#FFFFFF", 4, 0.22), L([[x0 + w * 0.22, -sill - 8], [x0 + w * 0.34, -sill - 44]], "#FFFFFF", 2, 0.18));
    if (r.chance(0.5)) { const hx = x0 + w + 7; sh.push(S(rect(hx - 5, -head + 20, 10, 4), "#5A6168"), S(rrect(hx - 1.6, -head + 27, 3.2, 22, 1.4), "#C4302B"), S(rrect(hx - 6, -head + 23, 12, 5, 1.5), "#8E979E")); }
  }
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, ppcm: Math.min(2.5, 1900 / ((n - 1) * gap + w + 30)), id: "metro_window" }] };
}, variants: { bus: { kind: "bus" } },
  meta: {
    about: "A metro car's window on its own, the outside showing through; or an İETT bus window with frit, a vent and a hammer.",
    params: {
      kind: { type: "enum", values: ["metro", "bus"], default: "metro" },
      n: { type: "int", min: 1, default: 1, about: "side by side" },
      w: { type: "num", about: "cm; default 240, bus 150" },
      sill: { type: "num", about: "cm above the floor; default 92, bus 98" },
      head: { type: "num", about: "cm above the floor; default 198, bus 200" },
      gap: { type: "num", about: "centre to centre, cm; default w + 190, bus w + 14" },
    },
    tags: ["metro", "window", "vehicle"],
  } };

/**
 * An underground metro platform, `w` cm wide, seen across the track. In front, lying flat, the platform's edge `d` cm deep:
 * the white coping, the yellow tactile strip, granite slabs. Below it, 110 cm down, the track bed: sleepers, two rails, the
 * drain and the covered third rail by the far wall. The far wall rises to the ceiling at `h`: concrete under the platform's
 * level (cable trays, a refuge niche), tiles over it with the line's band (`color`), the station's name on a navy sign with
 * the M (`name`, default "OSMANBEY"), picture posters, the ceiling's light strip. At one end (`tunnel`: 1 right, -1 left,
 * 0 none) the station stops at a portal with a red signal: a train on the track passes behind it and shows in the tunnel's
 * mouth. A departure board hangs over the edge at `bx` (`board`, default "Taksim: geliyor"). Its lights are always on.
 */
const platform: PieceDef = { draw(p, r) {
  const w = num(p.w, 1400), h = num(p.h, 380), d = num(p.d, 260), c = hex(p.color, "#3E9A4E"), side = Math.sign(num(p.tunnel, 1));
  const T = 300, drop = 110, Y = (v: number) => -drop - v, end = side * (w / 2 - 260), a = side < 0 ? end : -w / 2, b = side > 0 ? end : w / 2, mid = (a + b) / 2;
  const name = str(p.name, "OSMANBEY"), board = str(p.board, "Taksim: geliyor"), bx = num(p.bx, a + (b - a) * 0.22), ppcm = Math.min(1, 1900 / Math.max(w, drop + h));
  // the far wall: concrete under the platform's level, tiles over it, the skirting, the line's band, the ceiling and its light
  const wall: Shape[] = [S(rect(-w / 2, Y(h), w, drop + h), "#5B5F63")], glow: Shape[] = [];
  for (const y of [-34, -42, -50]) wall.push(L([[-w / 2, Y(y)], [w / 2, Y(y)]], "#2A2E32", 2.4, 0.9));
  wall.push(S(rrect(mid + 150, Y(-8), 70, 92, [8, 8, 0, 0]), "#3B3F43"));
  wall.push(S(rect(a, Y(h - 40), b - a, h - 40), ST.tile), tiles(rect(a, Y(h - 40), b - a, h - 40), 30, 15));
  wall.push(S(rect(a, Y(16), b - a, 16), "#6E7378"), S(rect(a, Y(272), b - a, 22), c), S(rect(a, Y(250), b - a, 3), tone(c, "deep"), { flat: true, opacity: 0.5 }));
  wall.push(S(rect(-w / 2, Y(h), w, 40), "#4B5157"), S(rrect(a + 12, Y(h - 12), b - a - 24, 10, 5), "#F1F3F0"));
  glow.push(S(rrect(a + 12, Y(h - 12), b - a - 24, 10, 5), "#F4F8FF", { flat: true }), S(rrect(a, Y(h - 6), b - a, 24, 12), "#F4F8FF", { flat: true, opacity: 0.3 }));
  // the name sign with the M, and a poster each side of it
  const mk = mMark(mid - 196, Y(228), 48);
  wall.push(S(rrect(mid - 204, Y(236), 408, 64, 6), ST.navy), ...mk.sh);
  glow.push(...mk.glow);
  for (const k of [-1, 1]) { const px = mid + k * 400 - 60; if (px > a + 30 && px + 150 < b) wall.push(...poster(px, Y(215), 120, 150, r.int(0, 2))); }
  const flats: FlatSpec[] = [];
  // the track bed, lying flat from the far wall to the platform's edge
  let sleepers = rect(-w / 2, 52, 24, 196);
  for (let x = -w / 2 + 64; x < w / 2; x += 64) sleepers = sleepers.add(rect(x, 52, 24, 196));
  const bed: Shape[] = [S(rect(-w / 2, 0, w, T), "#6B675F"), S(sleepers, "#8C877E"), S(rect(-w / 2, 138, w, 16), "#45423D", { flat: true })];
  for (const y of [82, 212]) bed.push(S(rect(-w / 2, y, w, 7), "#6F757A"), S(rect(-w / 2, y + 1, w, 2), "#C9D0D4", { flat: true }));
  bed.push(S(rect(-w / 2, 20, w, 12), "#E2D7A8"), S(rect(-w / 2, 31, w, 2), "#8E8770", { flat: true }));
  flats.push({ group: { shapes: bed, edge: 0 }, y: -drop, z: -T, pitch: -Math.PI / 2, ppcm: Math.min(0.5, 1900 / w), lit: 1 });
  // the tunnel: dark past the station's end, its lamps, and the portal in front of the track
  if (side) {
    const x0 = Math.min(end, side * w / 2), tw = Math.abs(side * w / 2 - end), hx = end + side * 130, sx = end + side * 18;
    wall.push(S(rect(x0, Y(h), tw, drop + h), ST.dark));
    for (let x = x0 + 20; x < x0 + tw; x += 50) wall.push(S(rect(x, Y(h), 10, drop + h), "#2A3036", { flat: true }));
    for (let x = x0 + 50; x < x0 + tw; x += 120) { wall.push(S(rrect(x - 4, Y(152), 8, 5, 2), "#4A5058")); glow.push(S(ellipse(x, Y(150), 6, 4), "#CFE3FF", { flat: true })); }
    const portal: Shape[] = [S(holed(rect(x0, Y(h), tw, h + drop), [rrect(hx - 90, Y(300), 180, 300 + drop, [90, 90, 0, 0])]), "#8A8E91", { evenodd: true })];
    portal.push(S(holed(rrect(hx - 104, Y(314), 208, 314 + drop, [104, 104, 0, 0]), [rrect(hx - 90, Y(300), 180, 300 + drop, [90, 90, 0, 0])]), "#6E7276", { evenodd: true }));
    portal.push(S(rect(sx - 1.5, Y(130), 3, 130), "#2E3236"), S(rrect(sx - 8, Y(172), 16, 42, 4), "#1E2226"), S(ellipse(sx, Y(161), 4.5), "#8E1F1A"), S(ellipse(sx, Y(145), 4.5), "#1F4D2E"));
    flats.push({ group: { shapes: wall, edge: 1 }, emissive: { shapes: glow, edge: 0 }, y: -drop, z: -T, ppcm }, { group: { shapes: portal, edge: 1 }, emissive: { shapes: [S(ellipse(sx, Y(161), 9), "#FF4A3A", { flat: true })], edge: 0 }, y: -drop, z: -24, ppcm });
  } else flats.push({ group: { shapes: wall, edge: 1 }, emissive: { shapes: glow, edge: 0 }, y: -drop, z: -T, ppcm });
  flats[1].text = [{ text: name, x: mid - 138, y: Y(230), w: 334, h: 52, size: 34, color: "#FFFFFF", font: "print", weight: 700 }];
  // the platform's edge, lying flat towards us: coping, the tactile strip, granite slabs
  const edge: Shape[] = [S(rect(a, 0, b - a, d), ST.stone), { path: rect(a, 58, b - a, d - 58), flat: true, opacity: 0.6, tile: { w: 60, h: 60, shapes: [S(rect(0, 0, 60, 1.2), "#7F7B74"), S(rect(0, 0, 1.2, 60), "#7F7B74")] } }];
  edge.push(S(rect(a, 0, b - a, 13), "#DAD6CC"), S(rect(a, 0, b - a, 2.5), "#55595D", { flat: true }), S(rect(a, 18, b - a, 40), CAR.warn), { path: rect(a, 18, b - a, 40), flat: true, opacity: 0.55, tile: { w: 6, h: 6, shapes: [S(ellipse(3, 3, 1.7), tone(CAR.warn, "shade"))] } });
  flats.push({ group: { shapes: edge, edge: 0 }, pitch: -Math.PI / 2, ppcm: Math.min(0.6, 1900 / (b - a)), lit: 1 });
  // the departure board, hung from the ceiling over the edge
  const rod = Math.max(0, h - 230 - 54), bsh: Shape[] = [S(rect(-62, -54 - rod, 3, rod), "#5A6168"), S(rect(59, -54 - rod, 3, rod), "#5A6168"), S(rrect(-95, -54, 190, 54, 5), "#2E3640"), S(rect(-88, -47, 176, 40), "#11161B", { flat: true })];
  flats.push({ group: { shapes: bsh, edge: 0.6 }, emissive: { shapes: [S(rect(-88, -47, 176, 40), "#FFB547", { flat: true, opacity: 0.16 })], edge: 0 }, x: bx, y: 230, z: 60, ppcm: 2,
    text: [{ text: board, x: -86, y: -45, w: 172, h: 36, size: 15, color: "#FFB547", font: "screen", weight: 600, lit: 0 }] });
  const lights: LightSpec[] = [0.2, 0.5, 0.8].map(k => ({ x: a + (b - a) * k, y: h - 30, z: -80, color: "#F2F6FF", radius: 5, intensity: 0.9 }));
  return { flats, lights };
},
  meta: {
    about: "An underground metro platform seen across the track: the edge, the track bed, a tiled wall with the name sign, a tunnel and a departure board.",
    params: {
      w: { type: "num", default: 1400, about: "cm" },
      h: { type: "num", default: 380, about: "the ceiling's height, cm" },
      d: { type: "num", default: 260, about: "the platform edge's depth, cm" },
      color: { type: "color", default: "#3E9A4E", about: "the line's band, a palette id or a hex" },
      tunnel: { type: "int", min: -1, max: 1, default: 1, about: "the tunnel's end: 1 right, -1 left, 0 none" },
      name: { type: "text", default: "OSMANBEY", about: "the station's name" },
      board: { type: "text", default: "Taksim: geliyor", about: "the departure board's text" },
      bx: { type: "num", about: "the board's x, cm; default near the left of the platform" },
    },
    tags: ["metro", "station", "sign", "light"],
  } };

/**
 * A street entrance to the metro, `w` cm wide, seen from the pavement: granite walls round a stairwell going down (the steps
 * fade into the dark, the hall's light glows at the bottom, handrails go down both sides), a glass enclosure the street shows
 * through, and a glass canopy on steel posts (its flat top a perch) with the M on its fascia beside the station's `name`.
 * `closed`: a shutter grille pulled down across the stairs, a sign hung on it (`sign`, default "ARIZA") and a cone. Lit at night.
 */
const metroEntrance: PieceDef = { draw(p) {
  const w = num(p.w, 330), xi = w / 2 - 38, H = 272, name = str(p.name, "").trim(), stone = "#B5AFA5", steel = "#7D868D";
  const sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [];
  // behind the stairs: the back glass (the street shows through) on its mullions, the back wall, the dark mouth and the lit hall below
  sh.push(S(rect(-xi, -H, 2 * xi, H - 118), "#CFE6EE", { flat: true, opacity: 0.16 }), S(rect(-xi * 0.34 - 2, -H, 4, H - 118), steel), S(rect(xi * 0.34 - 2, -H, 4, H - 118), steel), S(rect(-xi, -124, 2 * xi, 6), steel));
  sh.push(S(rect(-xi, -118, 2 * xi, 30), stone), S(rect(-xi, -88, 2 * xi, 88), "#262B31"), S(rect(-xi * 0.78, -86, xi * 1.56, 20), "#363C44", { flat: true }), S(rect(-xi * 0.74, -68, xi * 1.48, 7), "#F2EEDF", { flat: true, opacity: 0.85 }));
  glow.push(S(rect(-xi * 0.78, -74, xi * 1.56, 16), "#FFF1D6", { flat: true, opacity: 0.9 }));
  // the steps, nearest at the bottom: each a tread with its yellow nosing and a dark drop behind, smaller and darker going down
  for (let i = 0, y = 0, hs = 9.8; i < 9; i++, y -= hs, hs *= 0.84) {
    const t = i / 9, tread = mix("#CBC6BD", "#454A51", t * 0.9), x = xi * (1 - t * 0.22);
    sh.push(S(rect(-x, y - hs, 2 * x, hs), tread), S(rect(-x, y - hs, 2 * x, hs * 0.22), tone(tread, "deep"), { flat: true }), S(rect(-x, y - 1.3, 2 * x, 1.3), "#E0B23A", { flat: true, opacity: 0.85 - t * 0.7 }));
  }
  // the stairwell's sides going down, their handrails, the walls' faces and caps, the posts
  for (const k of [-1, 1]) {
    sh.push(P([[k * xi, 0, 0], [k * xi * 0.78, -48, 0], [k * xi * 0.78, -118, 0], [k * xi, -118, 0]], tone(stone, "shade")));
    sh.push(L([[k * (xi - 5), -94], [k * xi * 0.82, -72]], "#C3C9CE", 3, 1), L([[k * (xi - 9), -94], [k * (xi - 9), -80]], "#8E979E", 1.6, 1));
    const x0 = k < 0 ? -w / 2 : xi;
    sh.push(S(rect(x0, -118, 38, 118), stone), S(rect(x0 - 3, -126, 44, 8), "#CBC5BA"), L([[x0 + 1, -40], [x0 + 37, -40]], tone(stone, "shade"), 1, 0.6), L([[x0 + 1, -80], [x0 + 37, -80]], tone(stone, "shade"), 1, 0.6));
    sh.push(S(rect(k * (w / 2 - 19) - 4, -H, 8, H - 126), steel), L([[k * (w / 2 - 19) - 2, -H + 4], [k * (w / 2 - 19) - 2, -130]], "#FFFFFF", 1, 0.35));
  }
  // the canopy: its glass top, the fascia with the M and the name, the light strip under it
  const mk = mMark(-w / 2 - 12, -H - 31, 28);
  sh.push(S(rect(-w / 2 - 22, -H - 40, w + 44, 6), "#BFDDE6", { opacity: 0.9 }), S(rect(-w / 2 - 18, -H - 34, w + 36, 34), "#2F353C"), S(rect(-w / 2 + 10, -H, w - 20, 3), "#F1EEE4"), ...mk.sh);
  glow.push(...mk.glow, S(rect(-w / 2 + 6, -H, w - 12, 8), "#FFF1D6", { flat: true, opacity: 0.8 }));
  if (name) text.push({ text: name, x: -w / 2 + 24, y: -H - 31, w: w - 10, h: 28, size: 18, color: "#FFFFFF", align: "left", font: "print", weight: 700 });
  if (p.closed) {
    // the shutter box, its rails, the grille of bars and links, and the sign and a cone in front
    sh.push(S(rect(-xi - 6, -H, 2 * xi + 12, 20), steel), S(rect(-xi - 5, -H + 20, 5, H - 20), steel), S(rect(xi, -H + 20, 5, H - 20), steel), S(rect(-xi, -7, 2 * xi, 7), steel));
    sh.push({ path: rect(-xi, -H + 20, 2 * xi, H - 27), flat: true, tile: { w: 10, h: 16, shapes: [S(rect(0, 0, 1.6, 16), "#8E979E"), S(rrect(0, 0, 10, 2.2, 1), "#A9B1B7"), S(rrect(5, 8, 10, 2.2, 1), "#A9B1B7")] } });
    sh.push(L([[-24, -166], [-30, -150]], "#3B3B40", 0.8, 1), L([[24, -166], [30, -150]], "#3B3B40", 0.8, 1), S(rrect(-40, -151, 80, 38, 2), "#FBF7EE"), S(rect(-36, -147, 72, 3), "#C4302B", { flat: true }));
    text.push({ text: str(p.sign, "ARIZA"), x: -36, y: -143, w: 72, h: 26, size: 15, color: "#C4302B", font: "print", weight: 800 });
    const cx = xi * 0.55, cone = poly([[cx - 13, -5], [cx + 13, -5], [cx + 4, -52], [cx - 4, -52]]);
    sh.push(S(cone, "#F07A2A"), S(rect(cx - 12, -32, 24, 7), "#F4F2EE", { flat: true, clip: cone }), S(rrect(cx - 17, -6, 34, 6, 2), "#2B2F33"));
  }
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, emissive: { shapes: glow, edge: 0 }, switch: false, ppcm: Math.min(2, 1900 / (w + 44)), ...(text.length ? { text } : {}) }],
    lights: [{ x: 0, y: H - 10, z: 20, color: "#FFF1D6", radius: 3, intensity: 0.5, at: ["dusk", "night"], switch: false }] };
},
  meta: {
    about: "A street entrance to the metro: stairs going down, a glass enclosure and canopy with the M and the name; shuttered when closed.",
    params: {
      w: { type: "num", default: 330, about: "cm" },
      name: { type: "text", default: "", about: "the station's name on the fascia" },
      closed: { type: "bool", about: "a shutter down, a sign on it and a cone" },
      sign: { type: "text", default: "ARIZA", about: "closed: the sign's word" },
    },
    tags: ["metro", "station", "sign", "light"],
  } };

/**
 * The metro's sign, lit at night: the red M on a white square, and with a `name` the station's name. `kind` "post" (default):
 * the M's box on a grey post `h` cm tall, the name on a navy plate under it; "over" (a variant): a navy band `w` cm wide to
 * hang over an entrance, the M at its left and the name beside it. `n` side by side.
 */
const metroSign: PieceDef = { draw(p) {
  const over = str(p.kind, "post") === "over", name = str(p.name, "").trim(), n = Math.max(1, Math.round(num(p.n, 1))), H = num(p.h, 330), W = num(p.w, 280);
  const gap = over ? W + 40 : 160, sh: Shape[] = [], glow: Shape[] = [], text: TextSpec[] = [], steel = "#6F777E";
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * gap;
    if (over) {
      const s = 44, top = -s - 14, mk = mMark(dx - W / 2 + 7, top + 7, s);
      sh.push(S(rect(dx - W * 0.36 - 1.5, top - 34, 3, 36), steel), S(rect(dx + W * 0.36 - 1.5, top - 34, 3, 36), steel), S(rrect(dx - W / 2, top, W, s + 14, 6), ST.navy), S(rect(dx - W / 2 + 4, -5, W - 8, 2), "#4A6488", { flat: true }), ...mk.sh);
      glow.push(...mk.glow);
      if (name) text.push({ text: name, x: dx - W / 2 + s + 16, y: top + 8, w: W - s - 26, h: s - 2, size: 24, color: "#FFFFFF", font: "print", weight: 700 });
    } else {
      const s = 62, mk = mMark(dx - s / 2, -H, s);
      sh.push(S(rect(dx - 14, -5, 28, 5), "#5A6168"), S(rrect(dx - 5, -H + s, 10, H - s - 4, 2), steel), L([[dx - 2.4, -H + s + 4], [dx - 2.4, -8]], "#FFFFFF", 1, 0.35), S(rrect(dx - s / 2 - 5, -H - 5, s + 10, s + 10, 7), "#4A5258"), ...mk.sh);
      glow.push(...mk.glow);
      if (name) { sh.push(S(rrect(dx - 58, -H + s + 14, 116, 28, 3), ST.navy)); text.push({ text: name, x: dx - 54, y: -H + s + 16, w: 108, h: 24, size: 14, color: "#FFFFFF", font: "print", weight: 700 }); }
    }
  }
  const span = (n - 1) * gap + (over ? W : 80);
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, emissive: { shapes: glow, edge: 0 }, switch: false, ppcm: Math.min(3, 1900 / Math.max(span, over ? 100 : H + 10)), id: "metro_sign", ...(text.length ? { text } : {}) }] };
}, variants: { over: { kind: "over" } },
  meta: {
    about: "The metro's lit M sign: on a post with the name under it, or a navy band over an entrance with the name beside it.",
    params: {
      kind: { type: "enum", values: ["post", "over"], default: "post" },
      name: { type: "text", default: "", about: "the station's name" },
      n: { type: "int", min: 1, default: 1, about: "side by side" },
      h: { type: "num", default: 330, about: "post: its height, cm" },
      w: { type: "num", default: 280, about: "over: the band's width, cm" },
    },
    tags: ["metro", "sign", "light"],
  } };

/** One leaf of a door pair at `dx` (`k` -1 left, 1 right), slid `s` cm into the wall: glazed, with its rubber, shade and the seam's edge. */
function doorLeaf(dx: number, k: number, s: number): Shape[] {
  const lx = k < 0 ? dx - 66 - s : dx + 1 + s, hx = lx + (k < 0 ? 9 : 8), hole = rrect(hx, -186, 48, 86, 7);
  return [
    S(holed(rect(lx, -200, 65, 200), [hole]), CAR.door, { evenodd: true }), S(holed(rrect(hx - 3, -189, 54, 92, 9), [hole]), CAR.rubber, { evenodd: true }),
    S(hole, "#D6ECF2", { flat: true, opacity: 0.1 }), L([[hx + 8, -112], [hx + 22, -170]], "#FFFFFF", 3, 0.2), S(rect(lx, -16, 65, 14), tone(CAR.door, "shade")),
    S(rect(k < 0 ? dx - 2 - s : dx + s, -200, 2, 200), CAR.rubber, { flat: true }),
  ];
}

/** A station platform `w` cm long seen across from the car: the platform's edge, a tiled back wall with a navy band and M marks, pillars, a canopy with its lights, benches and a few people waiting. Night glow goes in `lit`. */
function platformArt(r: Rng, w: number, lit: Shape[]): Shape[] {
  const x0 = -w / 2, out: Shape[] = [S(rect(x0, -300, w, 300), ST.tile), tiles(rect(x0, -300, w, 230), 30, 15), S(rect(x0, -70, w, 58), "#D9D5CB")];
  out.push(S(rect(x0, -232, w, 30), ST.navy), S(rect(x0, -202, w, 3), ST.red, { flat: true }));
  for (let x = x0 + 260; x < w / 2 - 100; x += 520) { const m = mMark(x - 13, -230, 26); out.push(...m.sh); lit.push(...m.glow); }
  // benches against the wall
  for (let x = x0 + 120; x < w / 2 - 120; x += 520) out.push(S(rect(x, -58, 150, 8), "#7A858E"), S(rect(x + 10, -50, 6, 38), "#5A646C"), S(rect(x + 134, -50, 6, 38), "#5A646C"));
  // people waiting along the platform, muted
  for (let x = x0 + r.range(200, 320); x < w / 2 - 80; x += r.range(260, 420)) {
    const d = drawPerson(person(r, { umbrellas: 0, flags: 0 }), "stand", 0.4), dir = r.chance(0.5) ? 1 : -1;
    out.push(...[...d.legs[0], ...d.body, ...d.arm[0]].map(s => ({ ...s, path: (dir < 0 ? s.path.mirrorX() : s.path).move(x, -12) })));
  }
  // the platform: its stone top and the yellow edge towards the track
  out.push(S(rect(x0, -12, w, 12), ST.stone), S(rect(x0, -12, w, 3.5), CAR.warn, { flat: true }));
  // pillars and the canopy, its lamps
  for (let x = x0 + 100; x < w / 2; x += 400) out.push(S(rect(x - 12, -330, 24, 318), "#C9CCCF"), S(rect(x + 4, -330, 8, 318), "#B4B8BC", { flat: true, opacity: 0.7 }));
  out.push(S(rect(x0 - 30, -348, w + 60, 20), "#5F6970"), S(rect(x0 - 30, -330, w + 60, 4), "#4A535A"));
  for (let x = x0 + 60; x < w / 2; x += 200) { out.push(S(rrect(x, -326, 90, 6, 3), "#F4F1E6")); lit.push(S(rrect(x - 6, -328, 102, 10, 5), "#FFF1D6", { flat: true })); }
  return out;
}

/** A bus stop on the pavement `w` cm long, seen from the bus: the kerb and the pavement, an İETT shelter (glass, its roof, a navy
 * panel with the bus mark, a bench), the timetable post, a tree and a street lamp, and a few people waiting. Night glow goes in `lit`. */
function busStopArt(r: Rng, w: number, lit: Shape[]): Shape[] {
  const x0 = -w / 2, out: Shape[] = [], navy = "#22344E", frame = "#3B4249";
  // a tree and the lamp behind, at the back of the pavement
  out.push(S(rect(x0 + w * 0.82 - 4, -300, 8, 300), "#6B4A35"), S(ellipse(x0 + w * 0.82, -330, 90, 70), "#5F8F55"), S(ellipse(x0 + w * 0.82 - 30, -350, 50, 36), "#7FA35F", { flat: true, opacity: 0.7 }));
  out.push(L([[x0 + w * 0.12, 0], [x0 + w * 0.12, -420], [x0 + w * 0.12 + 40, -428]], "#3B3B40", 5, 1), S(ellipse(x0 + w * 0.12 + 46, -424, 14, 6), "#3B3B40"));
  lit.push(S(ellipse(x0 + w * 0.12 + 46, -419, 11, 5), "#FFE6A8", { flat: true }));
  // the shelter: back glass, the roof, the navy panel, a bench
  const sx = -110, sw = 300;
  out.push(S(rect(sx, -250, sw, 236), "#BFD9E0", { flat: true, opacity: 0.35 }), ...[0, 1, 2, 3].map(i => S(rect(sx + i * sw / 3 - 3, -250, 6, 236), frame)));
  out.push(S(rect(sx - 10, -266, sw + 20, 16), frame), S(rect(sx - 10, -270, sw + 20, 5), tone(frame, "light")));
  out.push(S(rect(sx + sw - 64, -240, 56, 120), navy), S(rrect(sx + sw - 56, -228, 40, 22, 4), "#FBFAF6"), S(rect(sx + sw - 52, -222, 32, 10), navy, { flat: true }), S(ellipse(sx + sw - 46, -208, 3), navy), S(ellipse(sx + sw - 26, -208, 3), navy));
  lit.push(S(rect(sx + sw - 60, -236, 48, 112), "#DDE8FF", { flat: true, opacity: 0.5 }), S(rect(sx, -262, sw, 6), "#FFF1D6", { flat: true }));
  out.push(S(rect(sx + 20, -62, 170, 9), "#7A858E"), S(rect(sx + 30, -53, 6, 41), "#5A646C"), S(rect(sx + 174, -53, 6, 41), "#5A646C"));
  // the timetable post with its sign at the kerb
  out.push(S(rect(sx - 60, -260, 6, 248), "#8E979E"), S(rrect(sx - 82, -300, 50, 44, 4), "#F2B705"), S(rect(sx - 76, -292, 38, 6), navy, { flat: true }), S(rect(sx - 76, -280, 28, 4), navy, { flat: true, opacity: 0.7 }));
  // people waiting, muted
  for (const x of [sx + 60, sx + 150, sx + 330, sx - 180].map(v => v + r.range(-20, 20))) {
    const d = drawPerson(person(r, { umbrellas: 0, flags: 0 }), "stand", 0.35), dir = r.chance(0.5) ? 1 : -1;
    out.push(...[...d.legs[0], ...d.body, ...d.arm[0]].map(s => ({ ...s, path: (dir < 0 ? s.path.mirrorX() : s.path).move(x, -12) })));
  }
  // the pavement and the kerb towards the road
  out.push(S(rect(x0, -12, w, 12), "#BDB4A4"), S(rect(x0, -4, w, 4), "#D8D2C6"));
  return out;
}

/**
 * Passengers who get on and off at each stop, on the car's timetable (`stops`, default the kit's): put it at a door (its x, the
 * wall's z). At every stop one gets off (from a spot to the doorway and out onto the platform) and then one gets on (in from the
 * platform to a spot), stands there for the leg, and gets off at the next stop. `spots`: where they stand, `[x, z]` cm from the
 * door (z towards the viewer); `n` how many take turns (1 or 2).
 */
const metroRiders: PieceDef = { draw(p, r) {
  const tt = timetable(p.stops ?? true) ?? TIMETABLE, n = Math.max(1, Math.min(2, Math.round(num(p.n, 2)))), spots = (p.spots as [number, number][] | undefined) ?? [[-150, 80], [135, 80]];
  const all = 2 * tt.ms, f = (ms: number) => ms / all, out: [number, number, number] = [0, 0, -55], door: [number, number, number] = [0, 0, 15];
  const k = [tt.run + AT_STOP.on[0], tt.run + AT_STOP.on[1], tt.run + AT_STOP.on[2], tt.ms + tt.run + AT_STOP.off[0], tt.ms + tt.run + AT_STOP.off[1], tt.ms + tt.run + AT_STOP.off[2]].map(f);
  const flats: FlatSpec[] = [];
  for (let i = 0; i < n; i++) {
    const [sx, sz] = spots[i % spots.length], spot: [number, number, number] = [sx, 0, sz], side = sx < 0 ? -1 : 1, who = person(r, { umbrellas: 0, flags: 0 }), step = r.range(480, 560);
    const mv = (show: [number, number]): FlatMotion => ({ path: { pts: [out, door, spot, spot, door, out], ms: all, at: k, show: [show] }, phase: i / 2, clock: "stops" });
    const o = { at: [0, 0] as [number, number], mute: 0.12, flagState: "flags" };
    flats.push(...personFlats(who, "walk", { ...o, dir: side, move: mv([k[0], k[2]]), step }));
    flats.push(...personFlats(who, "stand", { ...o, dir: -side, move: { ...mv([k[2], k[3]]), sway: { rot: 0.006, dy: 0.4, ms: r.range(2600, 3600) } } }));
    flats.push(...personFlats(who, "walk", { ...o, dir: -side, move: mv([k[3], k[5]]), step }));
  }
  return { flats };
},
  meta: {
    about: "Passengers who get off and on at each stop of the car's timetable, through a door, standing between stops.",
    params: {
      n: { type: "int", min: 1, max: 2, default: 2, about: "how many take turns" },
      spots: { type: "list", about: "[x, z] cm from the door where each stands; default [[-150, 80], [135, 80]]" },
      stops: { ...stopsParam, default: true },
    },
    tags: ["metro", "people"],
  } };

export const METRO_PIECES: Record<string, PieceDef> = {
  metro_wall: metroWall, metro_floor: metroFloor, metro_bench: metroBench, metro_pole: metroPole, metro_straps: metroStraps,
  metro_display: metroDisplay, route_strip: routeStrip, scroll_view: scrollView, metro_alongside: metroAlongside, metro_riders: metroRiders,
  metro_door: metroDoor, metro_window: metroWindow, platform, metro_entrance: metroEntrance, metro_sign: metroSign,
};

/** The family's set pieces and props (`index.ts`). The train on the next track (s1e01's "şu tren") is a prop too, so it is tappable and a line can point at it; so are the car's doors and windows and the M sign. */
export const set = METRO_PIECES;
export const props: Record<string, PieceDef> = { metro_alongside: METRO_PIECES.metro_alongside, metro_door: METRO_PIECES.metro_door, metro_window: METRO_PIECES.metro_window, metro_sign: METRO_PIECES.metro_sign };
