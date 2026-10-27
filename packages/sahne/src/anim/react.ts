// What a reacting flat remembers (DESIGN.md §6.9, `FlatReact.flee`): pigeons that fly off from a passer-by stay
// where they land, and take off again only when someone comes near them there. Worked out by replaying where people
// walked in this place since its scene began, so seeking and replaying land in the same state. Pure.

import { walkAt, type Perf } from "./timeline.ts";
import type { FlatReact } from "../core/kit.ts";

/** Where a person was at `t` (ms on the current performance's clock; earlier performances are before 0). */
export interface Sample { t: number; id: string; x: number; z: number }

/** How often a walk is sampled, ms. */
const STEP = 60;

/**
 * Where the people stood and walked in `perfs` (this place's performances since its scene began, the last the one on
 * stage), on the last one's clock: earlier ones end at its start. `skip` leaves out actors who do not count (Kerim).
 */
export function peopleSamples(perfs: Perf[], skip: (id: string) => boolean): Sample[] {
  const out: Sample[] = [];
  let off = 0;
  for (let k = perfs.length - 1; k >= 0; k--) {
    const p = perfs[k];
    if (k < perfs.length - 1) off -= p.dur;
    for (const [id, a] of Object.entries(p.before.actors)) if (!skip(id) && a.on && !a.air) out.push({ t: off, id, x: a.pos[0], z: a.pos[2] });
    for (const [id, tr] of Object.entries(p.tracks)) {
      if (skip(id)) continue;
      for (const w of tr.walks) {
        if (w.how === "fly") continue;
        for (let t = w.t0; ; t = Math.min(w.t1, t + STEP)) { const q = walkAt(w, t).pos; out.push({ t: off + t, id, x: q[0], z: q[2] }); if (t >= w.t1) break; }
      }
    }
  }
  return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One take-off: from `from` at `t0` to `to` at `t1` (metres, the floor plane). */
export interface Flight { t0: number; t1: number; from: [number, number]; to: [number, number] }

/**
 * Where a thing at `home` that keeps `r` m from people has gone by `until`: each time someone comes within `r` of where
 * it is, it goes `away` m along x, away from them, at `speed` m/s; while going it notices no one, and as it arrives it
 * looks again (someone still close sends it on).
 */
export function flights(home: [number, number], flee: { r: number; away: number; speed?: number }, samples: Sample[], until: number): Flight[] {
  const out: Flight[] = [], last = new Map<string, Sample>(), ms = Math.max(350, flee.away / (flee.speed ?? 2.4) * 1000);
  let at: [number, number] = [...home], busy = -Infinity;
  const go = (t: number, s: Sample) => {
    const dir = at[0] >= s.x ? 1 : -1, to: [number, number] = [at[0] + dir * flee.away, at[1]];
    out.push({ t0: t, t1: t + ms, from: at, to }); at = to; busy = t + ms;
  };
  const near = (s: Sample) => Math.hypot(s.x - at[0], s.z - at[1]) < flee.r;
  for (const s of samples) {
    if (s.t > until) break;
    // landing: anyone still close sends it on, from where it landed
    while (busy > -Infinity && s.t >= busy && out.length < 64) { const end = busy; busy = -Infinity; const c = [...last.values()].find(near); if (c) go(end, c); }
    last.set(s.id, s);
    if (s.t < busy) continue;
    if (near(s)) go(s.t, s);
  }
  return out;
}

/** Where it is at `t` along its flights: its offset from home, how far through a flight (`u`, 0 resting), and which way it goes. */
export function fleeAt(home: [number, number], fl: Flight[], t: number): { dx: number; dz: number; u: number; dir: -1 | 1 } {
  let pos: [number, number] = home, u = 0, dir: -1 | 1 = 1;
  for (const f of fl) {
    if (t < f.t0) break;
    dir = f.to[0] >= f.from[0] ? 1 : -1;
    if (t >= f.t1) { pos = f.to; continue; }
    u = (t - f.t0) / (f.t1 - f.t0);
    const e = u * u * (3 - 2 * u);
    pos = [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e];
    break;
  }
  return { dx: pos[0] - home[0], dz: pos[1] - home[1], u, dir };
}

/** How far a resting head turns to the nearest person `d` m off (`FlatReact.look`, 0…1, eased): all the way within 60 % of its reach `r`, not at all beyond it; with `r` 0 only a tap turns it. */
export function lookToward(r: number, d: number): number {
  if (!(r > 0)) return 0;
  const x = Math.max(0, Math.min(1, (r - d) / (r * 0.4)));
  return x * x * (3 - 2 * x);
}

/**
 * Whether a reacting flat is drawn now (`FlatReact.show`), from how its animal stands: `rest` while it is still, `away` while it
 * goes (and only that way, with `face`); `asleep` while its head is not turned (`look` 0) and `awake` while it is, so a sleeper
 * shuts its eyes again as its head goes down. Without `show` it always is.
 */
export function reactShows(rc: Pick<FlatReact, "show" | "face">, re: { moving: boolean; dir: -1 | 1; look: number }): boolean {
  switch (rc.show) {
    case "rest": return !re.moving;
    case "away": return re.moving && (rc.face === undefined || rc.face === re.dir);
    case "asleep": return !(re.look > 0);
    case "awake": return re.look > 0;
    default: return true;
  }
}
