// The airport's set pieces (src/set/airport.ts): they draw finite flats, every motion is sane (a path
// that loops, a blink no faster than three flashes a second, a gentle sway), the words on the board and
// the sign lie inside their art, glass lets taps through, and the s1e01 airport keeps its marks and props.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBounds, rng, type FlatSpec, type Shape } from "sahne";
import { moveAt } from "../../sahne/src/anim/move.ts";
import { MASK_MIN } from "../../sahne/src/interact/hit.ts";
import kit from "../src/full.ts";
import { AIRPORT_PIECES } from "../src/set/airport.ts";
import { existsSync, readFileSync } from "node:fs";
import { PLACES } from "../../sahne-story/paths.ts";

type Params = Record<string, unknown>;
// Kumru's s1e01 airport (any: read at run time from PLACES in sahne-story/paths.ts), when the content root has it
const IST = new URL("ist.json", PLACES);
const ist = existsSync(IST) ? JSON.parse(readFileSync(IST, "utf8")) : { pieces: [] };
const skipIst = existsSync(IST) ? false : "no ist.json in the content root (Kumru's airport)";
const draw = (id: string, p: Params = {}) => kit.set[id].draw(p, rng(id), kit).flats;
/** Each piece with its defaults, and as the s1e01 airport uses it. */
const cases: [string, Params][] = [...Object.keys(AIRPORT_PIECES).map(id => [id, {}] as [string, Params]), ...(ist.pieces as Params[]).filter(p => String(p.kit) in AIRPORT_PIECES).map(p => [String(p.kit), p] as [string, Params])];
const finite = (b: number[]) => b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];

test("the airport pieces are in the kit, and each draws finite flats", () => {
  for (const id of Object.keys(AIRPORT_PIECES)) assert.equal(kit.set[id], AIRPORT_PIECES[id], `${id} in kit.set`);
  for (const [id, p] of cases) {
    const flats = draw(id, p);
    assert.ok(flats.length > 0, id);
    for (const f of flats) {
      assert.ok(finite(groupBounds(f.group)), `${id}: a flat with no finite art`);
      if (f.emissive) assert.ok(finite(groupBounds(f.emissive)), `${id}: emissive art`);
      for (const k of ["x", "y", "z", "ppcm", "lit"] as const) if (f[k] !== undefined) assert.ok(Number.isFinite(f[k]), `${id}.${k}`);
      assert.ok((f.ppcm ?? 1.6) > 0 && (f.ppcm ?? 1.6) <= 3, `${id}: ppcm ${f.ppcm}`);
    }
  }
});

test("moving flats loop sanely, and are where they start at t = 0 (reduced motion)", () => {
  let moving = 0;
  for (const [id, p] of cases) for (const f of draw(id, p)) {
    const m = f.move;
    if (!m) continue;
    moving++;
    if (m.phase !== undefined) assert.ok(m.phase >= 0 && m.phase < 1, `${id}: phase ${m.phase}`);
    if (m.path) {
      assert.ok(m.path.pts.length >= 2 && m.path.pts.every(q => q.length === 3 && q.every(Number.isFinite)), `${id}: path points`);
      assert.ok(m.path.ms >= 500 && (m.path.wait ?? 0) >= 0, `${id}: path timing`);
      // nothing in the place goes faster than a plane taking off (~12 m/s here, a model's size)
      const len = m.path.pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - m.path!.pts[i][0], q[1] - m.path!.pts[i][1], q[2] - m.path!.pts[i][2]), 0);
      assert.ok(len / m.path.ms * 1000 <= 1200, `${id}: ${(len / m.path.ms * 10).toFixed(1)} m/s`);
    }
    if (m.blink) assert.ok(m.blink.ms >= 334 && m.blink.on > 0 && m.blink.on < 1, `${id}: blink at most three times a second`);
    if (m.sway) assert.ok(Math.abs(m.sway.rot ?? 0) <= 0.1 && Math.abs(m.sway.dy ?? 0) <= 5 && m.sway.ms >= 300, `${id}: gentle sway`);
    if (m.scroll) assert.ok(Number.isFinite(m.scroll.dx) && m.scroll.ms > 0, `${id}: scroll`);
    for (const t of [0, 1234, 9876, 123456]) { const at = moveAt(m, t); if (at) assert.ok([...at.at, at.dx, at.dy, at.rot].every(Number.isFinite), `${id} at ${t}`); }
    // at t = 0 a path is at its phase's point: with phase 0, its first point
    if (m.path && !m.phase) assert.deepEqual(moveAt(m, 0)!.at, m.path.pts[0].map(v => v / 100));
  }
  assert.ok(moving >= 10, `${moving} moving flats`);
});

test("text lies inside its flat's art, in Turkish, never drawn as letters", () => {
  let boxes = 0;
  for (const [id, p] of cases) for (const f of draw(id, p) as FlatSpec[]) for (const t of f.text ?? []) {
    boxes++;
    const [x0, y0, x1, y1] = groupBounds(f.group);
    // a blinking cell carries only a speck of art: its box lies inside its board's
    const art = f.move?.blink ? groupBounds(draw(id, p).find(g => g.text && !g.move)!.group) : [x0, y0, x1, y1];
    assert.ok(t.x >= art[0] - 0.5 && t.y >= art[1] - 0.5 && t.x + t.w <= art[2] + 0.5 && t.y + t.h <= art[3] + 0.5, `${id}: "${t.text}" outside its art`);
    assert.ok(t.text.trim().length > 0 && (t.lang ?? "tr") === "tr", `${id}: text`);
  }
  assert.ok(boxes >= 10, `${boxes} boxes`);
  const board = draw("arrivals_board").flatMap(f => f.text ?? []).map(t => t.text);
  for (const w of ["GELİŞ", "TAHRAN", "İNDİ", "RÖTARLI"]) assert.ok(board.includes(w), w);
  assert.deepEqual(draw("hang_sign").flatMap(f => f.text ?? []).map(t => t.text), ["Metro", "Çıkış"]);
});

test("glass and the barrier's panels are seen and tapped through; the arrivals doors swing open", () => {
  const glassy = (s: Shape) => (s.opacity ?? 1) * 255 < MASK_MIN;
  const wall = draw("glass_wall");
  assert.ok(wall[0].group.shapes.every(glassy), "the glass flat is all glass");
  assert.ok(draw("rail")[0].group.shapes.filter(s => s.fill === "#D6E8EE").every(glassy), "the barrier's panels");
  const door = draw("arrivals_door").filter(f => f.hinge !== undefined);
  assert.equal(door.length, 2);
  assert.ok(Math.sign(door[0].swing!) !== Math.sign(door[1].swing!), "the leaves swing apart");
});

test("the s1e01 airport keeps the story's marks and the plane, within budget", { skip: skipIst }, () => {
  for (const m of ["arrive", "board", "gate", "roof", "runway", "wait"]) assert.ok(m in ist.marks, m);
  assert.equal(ist.perch, "roof");
  assert.ok(ist.marks.roof.y > 0 && ist.marks.board.y > 0);
  assert.deepEqual(ist.props.ucak.terms, ["a1-w-ucak"]);
  assert.ok(ist.pieces.some(p => p.kit === "arrivals_door" && p.id === ist.marks.gate.door));
  for (const p of ist.pieces) assert.ok(kit.set[p.kit], p.kit);
  assert.ok(JSON.stringify(ist).length <= 5 * 1024, "the place is at most 5 KB minified");
  // pieces in the four depth bands (the place standard)
  const z = ist.pieces.map(p => p.z);
  assert.ok(z.some(v => v <= -6) && z.some(v => v > -6 && v <= -1.5) && z.some(v => v > -1.5 && v <= 0.5) && z.some(v => v > 0.5));
});
