// The metro's set pieces (src/set/metro.ts): they draw finite flats, the outside's scrolling layers
// are seamless strips wide enough for their slide, every motion is sane and still at rest, and the
// words on the route strip and the display lie inside their art.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBounds, rng, type FlatSpec, type Path, type Shape } from "sahne";
import { moveAt } from "../../sahne/src/anim/move.ts";
import kit from "../src/full.ts";
import { METRO_PIECES, VIEW_LAYERS, TIMETABLE } from "../src/set/metro.ts";
import { readFileSync } from "node:fs";
import { PLACES } from "../../sahne-story/paths.ts";

type Params = Record<string, unknown>;
// the s1e01 place document (any: read at run time from PLACES in sahne-story/paths.ts)
const metro = JSON.parse(readFileSync(new URL("metro_m11.json", PLACES), "utf8"));
const draw = (id: string, p: Params = {}) => kit.set[id].draw(p, rng(id), kit).flats;
/** Each piece with its defaults, and as the s1e01 metro uses it. */
const cases: [string, Params][] = [...Object.keys(METRO_PIECES).map(id => [id, {}] as [string, Params]), ...(metro.pieces as Params[]).filter(p => String(p.kit) in METRO_PIECES).map(p => [String(p.kit), p] as [string, Params])];

test("the metro pieces are in the kit, and each draws finite flats", () => {
  for (const id of Object.keys(METRO_PIECES)) assert.equal(kit.set[id], METRO_PIECES[id], `${id} in kit.set`);
  for (const [id, p] of cases) {
    const flats = draw(id, p);
    assert.ok(flats.length, `${id}: flats`);
    for (const f of flats) for (const g of [f.group, ...(f.emissive ? [f.emissive] : [])]) {
      assert.ok(g.shapes.length && g.shapes.every(s => s.path.finite() && (!s.clip || (s.clip as Path).finite())), `${id}: finite paths`);
      assert.ok(groupBounds(g).every(Number.isFinite), `${id}: finite bounds`);
      // it fits the atlas (2048 px a side)
      const b = groupBounds(g), ppcm = f.ppcm ?? 1.6;
      assert.ok((b[2] - b[0]) * ppcm < 2040 && (b[3] - b[1]) * ppcm < 2040, `${id}: ${Math.round((b[2] - b[0]) * ppcm)} × ${Math.round((b[3] - b[1]) * ppcm)} px`);
    }
  }
});

/** A path's subpaths, each as its list of points (every coordinate pair of its commands). */
function subpaths(p: Path): [number, number][][] {
  const out: [number, number][][] = [];
  for (const c of p.cmds) {
    if (c[0] === "M") out.push([]);
    for (let i = 1; i < c.length; i += 2) out[out.length - 1].push([c[i] as number, c[i + 1] as number]);
  }
  return out;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test("each scrolling layer is a seamless strip: its slide plus the span it covers, its art repeating every |dx|", () => {
  for (const [layer, L] of Object.entries(VIEW_LAYERS)) for (const w of [1200, 2400]) {
    const [f] = draw("scroll_view", { layer, w }), s = f.move!.scroll!, per = Math.abs(s.dx);
    assert.equal(s.dx, L.dx, `${layer}: the layer's slide`);
    const lo = -w / 2 - Math.max(0, s.dx), hi = w / 2 + Math.max(0, -s.dx);
    const b = groupBounds(f.group);
    assert.ok(b[0] <= -w / 2 && b[2] >= w / 2 + per - 1, `${layer} w ${w}: the strip [${b[0]}, ${b[2]}] covers the span and a period`);
    assert.ok(b[2] - b[0] >= w + per - 1 && b[2] - b[0] <= w + per + 2, `${layer} w ${w}: and no more`);
    for (const sh of [...f.group.shapes, ...(f.emissive?.shapes ?? [])] as Shape[]) {
      const subs = subpaths(sh.path), pts = subs.flat();
      const twin = (x: number, y: number) => pts.some(([u, v]) => near(u, x + per) && near(v, y));
      for (const sp of subs) {
        const xs = sp.map(q => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
        if (x1 - x0 < per) {
          // a thing of one period (a mast, a house, a cloud): its copy is a period on, wherever that is still on the strip
          if (x1 + per <= hi) for (const [x, y] of sp) assert.ok(twin(x, y), `${layer}: a copy of the point (${x}, ${y}) at +${per}`);
        } else if (sp.length > 5) {
          // a ridge line: the same height a period on
          for (const [x, y] of sp) if (x > lo && x + per < hi) assert.ok(twin(x, y), `${layer}: the ridge repeats at x ${x}`);
        } else assert.ok(x0 <= lo + 0.01 && x1 >= hi - 0.01, `${layer}: a band spans the strip`);
      }
    }
  }
});

test("the metro's motions are sane, and every moving flat shows at rest (reduced motion holds t = 0)", () => {
  let moving = 0;
  for (const [id, p] of cases) for (const f of draw(id, p) as FlatSpec[]) {
    const m = f.move;
    if (!m) continue;
    moving++;
    const ph = m.phase ?? 0;
    assert.ok(ph >= 0 && ph < 1, `${id}: phase in [0, 1)`);
    if (m.scroll) assert.ok(m.scroll.dx !== 0 && m.scroll.ms >= 500 && Math.abs(m.scroll.dx / m.scroll.ms) <= 0.6, `${id}: a scroll of at most 0.6 cm/ms`);
    if (m.sway) assert.ok(m.sway.ms >= 800 && Math.abs(m.sway.rot ?? 0) <= 0.12 && Math.abs(m.sway.dy ?? 0) <= 3, `${id}: a gentle sway`);
    // on the car's timetable a flat follows the stops: a leg's words, a door, a passenger, a platform (the timetable test below)
    const timed = !!m.stops || !!m.path?.at || (m.blink?.ms ?? 0) >= TIMETABLE.ms;
    if (timed) continue;
    if (m.blink) assert.ok(m.blink.ms >= 400 && m.blink.on > 0.3 && m.blink.on < 1, `${id}: a blink that shows most of the time`);
    if (m.path) {
      const { pts, ms } = m.path;
      assert.ok(ms >= 2000 && pts.length >= 2 && pts.flat().every(Number.isFinite), `${id}: a slow path`);
      assert.deepEqual(pts[0], pts[pts.length - 1], `${id}: the path is a loop, so it never jumps`);
      assert.ok(pts.every(q => Math.hypot(...q) <= 60), `${id}: it drifts, it does not leave`);
    }
    assert.ok(moveAt(m, 0), `${id}: shown at rest`);
    for (const t of [0, 333, 4000, 61000]) { const at = moveAt(m, t); if (at) assert.ok([...at.at, at.dx, at.dy, at.rot].every(Number.isFinite), `${id}: finite at ${t}`); }
  }
  assert.ok(moving >= 10, `the car moves: ${moving} moving flats`);
});

test("the route strip and the display put their words inside their art; no words, no text", () => {
  const inside = (t: { x: number; y: number; w: number; h: number }, b: number[]) => t.x >= b[0] && t.y >= b[1] && t.x + t.w <= b[2] && t.y + t.h <= b[3];
  for (const [id, p] of [["route_strip", { ends: ["Havalimanı", "Gayrettepe"], line: "M11" }], ["route_strip", { ends: ["Yenikapı", "Hacıosman"], line: "M2", w: 300, n: 9, at: 3 }], ["metro_display", { text: "Gayrettepe" }], ["metro_display", { text: "Osmanbey", w: 110 }]] as [string, Params][]) {
    const [f] = draw(id, p), b = groupBounds(f.group);
    assert.ok(f.text?.length, `${id}: text`);
    for (const t of f.text!) assert.ok(t.text && inside(t, b), `${id} "${t.text}": inside the flat`);
    // the two ends' labels never overlap
    const [l, r] = f.text!.filter(t => t.align === "left" || t.align === "right");
    if (l && r) assert.ok(l.x + l.w <= r.x + 0.01, `${id}: the end labels apart`);
  }
  assert.equal(draw("route_strip")[0].text, undefined);
  assert.equal(draw("metro_display")[0].text, undefined);
  const [screen] = draw("metro_display", { text: "Gayrettepe" });
  assert.equal(screen.text![0].lit, 0, "the screen lights itself");
});

test("the car has its lights at night, and the s1e01 metro keeps its marks and props", () => {
  const out = kit.set.metro_wall.draw({}, rng("w"), kit);
  assert.ok(out.lights?.length && out.lights.every(l => l.at?.includes("night")), "practical lights at night");
  assert.ok(out.flats[0].emissive?.shapes.length, "a light strip that glows");
  for (const k of ["outside", "outside_far", "stand_l", "stand_r", "window"]) assert.ok(k in metro.marks, `mark ${k}`);
  assert.ok(metro.marks.outside.air && metro.marks.outside_far.air, "Kerim's marks outside are in the air");
  for (const [k, term] of [["tren", "a1-w-metro"], ["ucak", "a1-w-ucak"]]) assert.ok((metro.props as Record<string, { terms: string[] }>)[k]?.terms.includes(term), `prop ${k}`);
  assert.ok(JSON.stringify(metro).length <= 5120, "the place is at most 5 KB");
});

test("on the timetable the car stops at each station: the outside stands, the doors open and shut, the words and the lit station follow the legs", () => {
  const T = TIMETABLE, stations = ["A", "B", "C", "D"], legs = stations.length - 1;
  const at = (fs: FlatSpec[], t: number) => fs.filter(f => !f.move || moveAt(f.move, t));
  // the display: one leg's words at a time, "Gelecek istasyon: B" on the leg, "B" at the stop
  const disp = draw("metro_display", { stations, stops: true }) as FlatSpec[];
  const words = (t: number) => at(disp, t).flatMap(f => f.text ?? []).map(x => x.text);
  assert.deepEqual(words(0), ["Gelecek istasyon: B"]);
  assert.deepEqual(words(T.run + 100), ["B"]);
  assert.deepEqual(words(T.ms + 100), ["Gelecek istasyon: C"]);
  assert.deepEqual(words(legs * T.ms - 100), ["D"]);
  for (let t = 0; t < legs * T.ms; t += 997) assert.equal(words(t).length, 1, `one line at ${t}`);
  // the route strip: one lit station at a time
  const strip = draw("route_strip", { n: 4, stops: true }) as FlatSpec[];
  for (let t = 0; t < legs * T.ms; t += 997) assert.equal(at(strip, t).filter(f => f.move).length, 1, `one lit station at ${t}`);
  // the doors: shut on the leg, wide open mid-stop, shut again before the next leg
  const leaves = (draw("metro_wall", { stops: true }) as FlatSpec[]).filter(f => f.move?.path);
  assert.equal(leaves.length, 2);
  const slid = (t: number) => Math.abs(moveAt(leaves[0].move!, t)!.at[0]) * 100;
  assert.ok(slid(T.run / 2) < 0.01 && slid(T.run + 3000) > 60 && slid(T.ms - 100) < 0.01);
  // the outside stands still through the stop and moves on the leg
  const view = (draw("scroll_view", { layer: "town", stops: true }) as FlatSpec[])[0].move!;
  assert.ok(Math.abs(moveAt(view, T.run + 500)!.dx - moveAt(view, T.ms - 500)!.dx) < 1e-6 && moveAt(view, T.run / 2)!.dx !== moveAt(view, 0)!.dx);
  // the platform is in place at the stop, out of sight mid-leg
  const plat = (draw("scroll_view", { layer: "platform", stops: true }) as FlatSpec[]).map(f => f.move!);
  assert.ok(plat.some(m => Math.abs(moveAt(m, T.run + 2000)!.at[0]) < 1e-6) && plat.every(m => Math.abs(moveAt(m, T.run / 2)!.at[0]) > 10));
  // the passengers: nobody walks through a shut door, and someone gets on at every stop
  const riders = (draw("metro_riders", {}) as FlatSpec[]).map(f => f.move!);
  const walking = (t: number) => riders.filter(m => { const r = moveAt(m, t); return r && Math.abs(r.at[2]) < 0.3 && Math.abs(r.at[0]) < 0.4; }).length;
  for (let t = 0; t < 2 * T.ms; t += 211) {
    const u = t % T.ms, open = u > T.run + 1100 && u < T.ms - 1400;
    if (!open) assert.equal(walking(t), 0, `nobody in the doorway at ${t}, doors shut`);
  }
  assert.ok(walking(T.run + 2900) > 0 && walking(T.ms + T.run + 2900) > 0, "someone comes through the door at each stop");
});
