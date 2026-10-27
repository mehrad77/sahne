// Tests of what a reacting flat remembers (anim/react.ts, DESIGN.md §6.9): pigeons fly off from a passer-by, stay where
// they land, and take off again only when someone comes near them there; replayed from where people walked, so it is
// the same at every seek. How far a head turns, and which of an animal's flats shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { flights, fleeAt, lookToward, reactShows, type Sample } from "../src/anim/react.ts";

const FLEE = { r: 1.3, away: 1.4 };
/** A person walking along z = 0 from x0 to x1 at 1 m/s from t0, sampled every 50 ms. */
const walk = (x0: number, x1: number, t0 = 0, id = "a"): Sample[] => {
  const n = Math.round(Math.abs(x1 - x0) / 0.05), out: Sample[] = [];
  for (let i = 0; i <= n; i++) out.push({ t: t0 + i * 50, id, x: x0 + (x1 - x0) * i / n, z: 0 });
  return out;
};

test("a passer-by within reach sends it off away from them; it stays where it lands after they go", () => {
  const fl = flights([0, 0], FLEE, walk(-3, -1.2), Infinity);
  assert.equal(fl.length, 1);
  assert.ok(fl[0].to[0] > 0, "away from them (they came from the left)");
  const end = fleeAt([0, 0], fl, 1e6);
  assert.ok(end.dx > 1.3 && end.u === 0, "landed, resting, not back home");
  const mid = fleeAt([0, 0], fl, (fl[0].t0 + fl[0].t1) / 2);
  assert.ok(mid.u > 0.4 && mid.u < 0.6 && mid.dir === 1, "mid-flight, going right");
});

test("nobody near: it never moves; a walker who keeps coming sends it on again from where it landed", () => {
  assert.deepEqual(flights([0, 0], FLEE, walk(-3, -2), Infinity), []);
  const fl = flights([0, 0], FLEE, walk(-3, 4), Infinity);
  assert.ok(fl.length >= 2, `chased along: ${fl.length}`);
  assert.ok(fl.every((f, i) => i === 0 || f.from[0] === fl[i - 1].to[0]), "each flight starts where the last landed");
});

test("someone standing close when it lands sends it on; the same samples give the same flights", () => {
  // walks up and stops 1 m short of where it lands
  const s = [...walk(-3, -1.2), ...walk(-1.2, 0.5, 2000)];
  const a = flights([0, 0], FLEE, s, Infinity), b = flights([0, 0], FLEE, s, Infinity);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 2);
  // seeking: where it is at t depends only on t
  for (const t of [0, 900, 1800, 2600, 5000]) assert.deepEqual(fleeAt([0, 0], a, t), fleeAt([0, 0], b, t));
});

test("a head turns to someone within its reach, all the way within 60 % of it; with a reach of 0 only a tap turns it", () => {
  assert.equal(lookToward(2.4, Infinity), 0);
  assert.equal(lookToward(2.4, 3), 0);
  assert.equal(lookToward(2.4, 1), 1);
  const mid = lookToward(2.4, 1.92);
  assert.ok(mid > 0.4 && mid < 0.6, `${mid}`);
  for (const d of [0, 0.5, Infinity]) assert.equal(lookToward(0, d), 0, `d ${d}`);
});

test("show: rest while still, away while going (that way), asleep while the head is down, awake while it is turned", () => {
  const still = { moving: false, dir: 1 as const, look: 0 }, going = { moving: true, dir: -1 as const, look: 0 }, looking = { moving: false, dir: 1 as const, look: 0.3 };
  assert.ok(reactShows({}, still) && reactShows({}, going) && reactShows({}, looking));
  assert.ok(reactShows({ show: "rest" }, still) && !reactShows({ show: "rest" }, going));
  assert.ok(!reactShows({ show: "away" }, still) && reactShows({ show: "away" }, going));
  assert.ok(reactShows({ show: "away", face: -1 }, going) && !reactShows({ show: "away", face: 1 }, going));
  assert.ok(reactShows({ show: "asleep" }, still) && !reactShows({ show: "asleep" }, looking));
  assert.ok(!reactShows({ show: "awake" }, still) && reactShows({ show: "awake" }, looking));
});
