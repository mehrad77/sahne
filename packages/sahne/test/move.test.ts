// The life of a place: where a moving flat is at a time of the place's clock (anim/move.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { moveAt, stopsTime } from "../src/anim/move.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const at = (v: { at: number[] } | null, e: number[]) => assert.ok(v && v.at.every((x, i) => near(x, e[i])), JSON.stringify(v?.at));

test("scroll slides a period and starts over; phase shifts it", () => {
  assert.equal(moveAt({ scroll: { dx: -400, ms: 1000 } }, 0)!.dx, -0);
  assert.ok(near(moveAt({ scroll: { dx: -400, ms: 1000 } }, 250)!.dx, -100));
  assert.ok(near(moveAt({ scroll: { dx: -400, ms: 1000 } }, 1250)!.dx, -100));
  assert.ok(near(moveAt({ scroll: { dx: -400, ms: 1000 }, phase: 0.5 }, 0)!.dx, -200));
});

test("a path goes at an even speed, waits at its end, and hides while it waits when asked", () => {
  const path = { pts: [[0, 0, 0], [100, 0, 0], [100, 300, 0]] as [number, number, number][], ms: 4000, wait: 1000 };
  at(moveAt({ path }, 0), [0, 0, 0]);
  at(moveAt({ path }, 1000), [1, 0, 0]); // a quarter of 400 cm: the corner
  at(moveAt({ path }, 3000), [1, 2, 0]);
  at(moveAt({ path }, 4500), [1, 3, 0]); // waiting at the end
  assert.equal(moveAt({ path: { ...path, hide: true } }, 4500), null);
  at(moveAt({ path }, 5000), [0, 0, 0]); // and round again
});

test("sway rocks both ways and blink shows for its share of the period", () => {
  const sway = { rot: 0.1, ms: 2000 };
  assert.ok(near(moveAt({ sway }, 500)!.rot, 0.1) && near(moveAt({ sway }, 1500)!.rot, -0.1));
  assert.ok(moveAt({ blink: { ms: 100, on: 0.3 } }, 20) && moveAt({ blink: { ms: 100, on: 0.3 } }, 50) === null);
});

test("a timetable runs its clock run ms in every period, easing in and out, and stands for the rest", () => {
  const s = { ms: 18000, run: 11000, ease: 2500 };
  assert.ok(near(stopsTime(s, 0), 0) && near(stopsTime(s, 11000), 11000) && near(stopsTime(s, 17999), 11000));
  assert.ok(near(stopsTime(s, 18000), 11000) && near(stopsTime(s, 36000 + 11000), 33000));
  // slow at the start, steady in the middle
  assert.ok(stopsTime(s, 500) < 500 && stopsTime(s, 6000) - stopsTime(s, 5000) > 1000);
  for (let t = 0; t < 40000; t += 250) assert.ok(stopsTime(s, t + 250) >= stopsTime(s, t), `rises at ${t}`);
  // a scroll on the timetable stands still while the train stands, and moves exactly a period in each
  const m = { scroll: { dx: -4000, ms: 11000 }, stops: s };
  assert.ok(near(moveAt(m, 12000)!.dx, moveAt(m, 17000)!.dx) && near(moveAt(m, 12000)!.dx, moveAt(m, 0)!.dx));
  // blink keeps the wall clock
  assert.ok(moveAt({ blink: { ms: 18000, on: 0.5 }, stops: s }, 8000) && moveAt({ blink: { ms: 18000, on: 0.5 }, stops: s }, 10000) === null);
});

test("a timed path holds between equal offsets and shows only inside its parts of the period", () => {
  const path = { pts: [[0, 0, 0], [0, 0, 0], [-60, 0, 0], [-60, 0, 0], [0, 0, 0]] as [number, number, number][], ms: 1000, at: [0, 0.6, 0.7, 0.9, 1] };
  at(moveAt({ path }, 300), [0, 0, 0]);
  at(moveAt({ path }, 650), [-0.3, 0, 0]);
  at(moveAt({ path }, 800), [-0.6, 0, 0]);
  at(moveAt({ path }, 999.999), [0, 0, 0]);
  const shown = { ...path, show: [[0.6, 0.9]] as [number, number][] };
  assert.equal(moveAt({ path: shown }, 300), null);
  at(moveAt({ path: shown }, 800), [-0.6, 0, 0]);
});
