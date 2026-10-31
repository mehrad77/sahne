// The life of a place (DESIGN.md §6.9): where a moving flat (`FlatSpec.move`) is at time t of the
// place's own clock, which runs only while idle life does (reduced motion holds every flat still).

import type { FlatMotion } from "../core/kit.ts";

/** A flat's motion at `t` (ms): an offset in the place (`at`, metres), one in its plane (`dx`, `dy` cm, y up), a rotation (radians); null while it is hidden. */
export function moveAt(m: FlatMotion, t: number): { at: [number, number, number]; dx: number; dy: number; rot: number } | null {
  const ph = m.phase ?? 0, uAt = (tt: number, ms: number) => ((tt / ms + ph) % 1 + 1) % 1;
  if (m.blink && ((uAt(t, m.blink.ms) - (m.blink.at ?? 0)) % 1 + 1) % 1 >= m.blink.on) return null;
  // the timetable's clock: what blink does not use
  const tm = m.stops ? stopsTime(m.stops, t) : t, u = (ms: number) => uAt(tm, ms);
  let at: [number, number, number] = [0, 0, 0], dx = 0, dy = 0, rot = 0;
  if (m.scroll) { const k = u(m.scroll.ms); dx = m.scroll.dx * k; dy = (m.scroll.dy ?? 0) * k; }
  if (m.sway) { const s = Math.sin(u(m.sway.ms) * 2 * Math.PI); rot = (m.sway.rot ?? 0) * s; dy += (m.sway.dy ?? 0) * Math.sin(u(m.sway.ms) * 4 * Math.PI); }
  if (m.path && m.path.pts.length) {
    const { pts, ms, wait = 0 } = m.path, k = u(ms + wait) * (ms + wait) / ms;
    if (k >= 1 && m.path.hide) return null;
    if (m.path.show && !m.path.show.some(([a, b]) => k >= a && k < b)) return null;
    if (m.path.at) return { at: timedAt(pts, m.path.at, k), dx, dy, rot };
    // an even speed along the polyline
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2])), total = lens.reduce((a, b) => a + b, 0);
    let d = Math.min(k, 1) * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const a = pts[i], b = pts[i + 1] ?? a, f = lens[i] ? d / lens[i] : 0;
    at = [(a[0] + (b[0] - a[0]) * f) / 100, (a[1] + (b[1] - a[1]) * f) / 100, (a[2] + (b[2] - a[2]) * f) / 100];
  }
  return { at, dx, dy, rot };
}

/** Where a path with timed offsets (`path.at`) is at `k` (0…1 of its period), metres: eased between two offsets, held before the first time and after the last. */
function timedAt(pts: [number, number, number][], ts: number[], k: number): [number, number, number] {
  let i = 0;
  while (i < pts.length - 1 && k >= (ts[i + 1] ?? 1)) i++;
  const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], t0 = ts[i] ?? 0, t1 = ts[i + 1] ?? 1;
  const f = k <= t0 || t1 <= t0 ? 0 : Math.min(1, (k - t0) / (t1 - t0)), e = f * f * (3 - 2 * f);
  return [(a[0] + (b[0] - a[0]) * e) / 100, (a[1] + (b[1] - a[1]) * e) / 100, (a[2] + (b[2] - a[2]) * e) / 100];
}

/**
 * A timetable's clock at `t` (`FlatMotion.stops`): each period of `ms` it runs for `run` ms, speeding up over `ease` ms, at a
 * steady speed, slowing over `ease` ms, and stands for the rest; it covers exactly `run` ms of motion in each period.
 */
export function stopsTime(s: { ms: number; run: number; ease?: number }, t: number): number {
  const run = Math.min(s.run, s.ms), e = Math.min(s.ease ?? 2500, run / 2), v = run / (run - e), n = Math.floor(t / s.ms), x = Math.min(t - n * s.ms, run);
  // distance under a speed that ramps 0 → v over e, holds, and ramps back to 0 over the last e
  const d = x < e ? v * x * x / (2 * e) : x <= run - e ? v * (x - e / 2) : run - v * (run - x) ** 2 / (2 * e);
  return n * run + d;
}
