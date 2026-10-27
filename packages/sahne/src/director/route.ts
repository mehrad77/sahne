// Solid lines on the floor and the ways round them (DESIGN.md §7): a wall, a railing, a building's front
// or a counter is a line people do not walk through. A set piece's generator says where its lines are
// (`PieceDef.solid`); a walk that would cross one goes round it, through a gap or round its end, on the
// shortest way that keeps clear of every line. Gates and doors are solid too, except to an entrance or an
// exit through their own door mark. Pure: the director bakes the way into the walk, so seeking stays exact.

import type { Vec3 } from "../core/math.ts";
import { withVariant, type Kit, type PieceDef } from "../core/kit.ts";
import type { PlaceDoc } from "../core/types.ts";

/** A solid line in the floor plane, metres (`x`, `z`), as placed: `door` names the piece whose leaf it is (a gate, a door); `in` the place states it stands in. */
export interface Solid { a: [number, number]; b: [number, number]; piece?: string; door?: string; in?: string[] }

/** How far a walker keeps from a line, metres (half a body's width and a little). */
export const CLEAR = 0.25;
/** How far round a line's end a walker turns, metres. */
const ROUND = CLEAR * 1.3;

/** The solid lines of a place, from its pieces' generators (`PieceDef.solid`); a piece with `solid: false` has none. */
export function placeSolids(place: PlaceDoc, kit: Pick<Kit, "set">): Solid[] {
  const out: Solid[] = [];
  for (const p of place.pieces ?? []) {
    const def: PieceDef | undefined = kit.set[p.kit];
    if (!def?.solid || (p as { solid?: unknown }).solid === false || typeof p.x !== "number" || typeof p.z !== "number") continue;
    for (const s of def.solid(withVariant(def, p as Record<string, unknown>))) {
      out.push({
        a: [round(p.x + s.a[0] / 100), round(p.z + s.a[1] / 100)], b: [round(p.x + s.b[0] / 100), round(p.z + s.b[1] / 100)],
        ...(p.id ? { piece: p.id } : {}), ...(s.door && p.id ? { door: p.id } : {}), ...(p.in?.length ? { in: [...p.in] } : {}),
      });
    }
  }
  return out;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
type P2 = [number, number];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Whether the walk p→q crosses the line a→b (lengthened by `CLEAR` at each end): touching it at the walk's own ends does not count. */
function crosses(p: P2, q: P2, a: P2, b: P2): boolean {
  const len = dist(a, b);
  if (len < 1e-6) return false;
  const d: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const A: P2 = [a[0] - d[0] * CLEAR, a[1] - d[1] * CLEAR], B: P2 = [b[0] + d[0] * CLEAR, b[1] + d[1] * CLEAR];
  const r = sub(q, p), s = sub(B, A), den = cross(r, s);
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(A, p), s) / den, u = cross(sub(A, p), r) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
}

export interface RouteOptions {
  /** The place states on now: a solid with `in` stands only in one of them. */
  state?: string[];
  /** A door piece the walk goes through (an entrance or an exit at its door mark): its leaf is no wall to this walk. */
  door?: string;
  /** The place's floor (`size`): the way round stays on it, give or take a metre (off stage, beyond the frame's edge, is fine). */
  size?: { w: number; d: number };
}

/**
 * The way from `from` to `to` round the solid lines: the points to pass between them (none for a straight walk),
 * or null when there is no way at all. Each point's height is taken along the walk, so a stair stays a stair.
 */
export function route(from: Vec3, to: Vec3, solids: Solid[], o: RouteOptions = {}): Vec3[] | null {
  const on = new Set(o.state ?? []);
  const lines = solids.filter(s => (!s.in || s.in.some(x => on.has(x))) && !(s.door && s.door === o.door));
  const P: P2 = [from[0], from[2]], Q: P2 = [to[0], to[2]];
  const free = (p: P2, q: P2) => !lines.some(l => crosses(p, q, l.a, l.b));
  if (free(P, Q)) return [];
  // the turning points: just round each end of each line, on both sides
  const w = o.size ? o.size.w / 2 + 1 : Infinity, back = o.size ? -o.size.d - 1 : -Infinity, front = o.size ? 2 : Infinity;
  const nodes: P2[] = [P];
  for (const l of lines) {
    const len = dist(l.a, l.b);
    if (len < 1e-6) continue;
    const d: P2 = [(l.b[0] - l.a[0]) / len, (l.b[1] - l.a[1]) / len], n: P2 = [-d[1], d[0]];
    for (const [e, k] of [[l.a, -1], [l.b, 1]] as [P2, number][]) for (const side of [-1, 1]) {
      const v: P2 = [round(e[0] + k * d[0] * ROUND + side * n[0] * ROUND), round(e[1] + k * d[1] * ROUND + side * n[1] * ROUND)];
      if (Math.abs(v[0]) <= w && v[1] >= back && v[1] <= front) nodes.push(v);
    }
  }
  nodes.push(Q);
  // the shortest way through the turning points (Dijkstra; ties go to the earlier point, so the way is always the same)
  const N = nodes.length, best = new Array<number>(N).fill(Infinity), prev = new Array<number>(N).fill(-1), done = new Array<boolean>(N).fill(false);
  best[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < N; k++) if (!done[k] && best[k] < Infinity && (i < 0 || best[k] < best[i] - 1e-9)) i = k;
    if (i < 0 || i === N - 1) break;
    done[i] = true;
    for (let k = 1; k < N; k++) {
      if (done[k] || k === i) continue;
      const c = best[i] + dist(nodes[i], nodes[k]);
      if (c < best[k] - 1e-9 && free(nodes[i], nodes[k])) { best[k] = c; prev[k] = i; }
    }
  }
  if (best[N - 1] === Infinity) return null;
  const way: P2[] = [];
  for (let k = prev[N - 1]; k > 0; k = prev[k]) way.unshift(nodes[k]);
  // heights along the way, by distance walked
  const total = best[N - 1];
  let acc = 0, last = P;
  return way.map(v => { acc += dist(last, v); last = v; const f = acc / total; return [v[0], round(from[1] + (to[1] - from[1]) * f), v[1]] as Vec3; });
}

/** How much longer the way round is than the straight walk, metres (0 when straight). */
export function detour(from: Vec3, to: Vec3, way: Vec3[]): number {
  const pts = [from, ...way, to];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return len - Math.hypot(to[0] - from[0], to[2] - from[2]);
}
