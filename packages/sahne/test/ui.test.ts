// Tests of the overlay's pure geometry: where a speech tail starts, where it points, and where it stops.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tailAim, tailTo, type HeadOval, type Pt } from "../src/ui/place.ts";

const OPTS = { radius: 18, base: 20, inset: 7, min: 5, max: 60, gap: 3 };
const tip = (t: { x: number; y: number; angle: number; len: number }): Pt => [t.x - Math.sin(t.angle) * t.len, t.y + Math.cos(t.angle) * t.len];
const inOval = (p: Pt, h: HeadOval) => ((p[0] - h.c[0]) / h.rx) ** 2 + ((p[1] - h.c[1]) / h.ry) ** 2;

test("a tail above a head points at the mouth and stops just outside the head", () => {
  const head: HeadOval = { c: [200, 200], rx: 40, ry: 50 }, mouth: Pt = [200, 230];
  const t = tailAim({ x: 140, y: 80, w: 120, h: 40 }, mouth, head, OPTS)!;
  assert.ok(Math.abs(t.y - (80 + 40 - OPTS.inset)) < 0.01, "it leaves the bottom edge");
  const p = tip(t);
  assert.ok(inOval(p, head) > 1 && inOval(p, head) < 1.3, `the tip is just outside the head (${inOval(p, head).toFixed(2)})`);
  const dir = Math.atan2(mouth[1] - t.y, mouth[0] - t.x) - Math.PI / 2;
  assert.ok(Math.abs(dir - t.angle) < 1e-9, "it points at the mouth");
});

test("from the side, the tail still aims at the mouth", () => {
  const head: HeadOval = { c: [200, 200], rx: 40, ry: 50 }, mouth: Pt = [200, 230];
  const t = tailAim({ x: 280, y: 150, w: 120, h: 50 }, mouth, head, OPTS)!;
  assert.ok(Math.abs(t.x - (280 + OPTS.inset)) < 0.01, "it leaves the left edge");
  const p = tip(t);
  assert.ok(p[0] > 240 && p[1] > 175, "it ends at the right cheek, below the base");
  assert.ok(inOval(p, head) >= 1, "outside the head");
});

test("a far bubble keeps a capped tail, and one beside the anchor falls back to tailTo", () => {
  const head: HeadOval = { c: [200, 400], rx: 40, ry: 50 };
  const t = tailAim({ x: 140, y: 10, w: 120, h: 40 }, [200, 430], head, OPTS)!;
  assert.equal(t.len, OPTS.inset + OPTS.max);
  assert.equal(tailAim({ x: 100, y: 100, w: 200, h: 200 }, [200, 200], head, OPTS), null, "a mouth under the bubble has no tail");
  assert.ok(tailTo({ x: 140, y: 80, w: 120, h: 40 }, [200, 150], OPTS));
});
