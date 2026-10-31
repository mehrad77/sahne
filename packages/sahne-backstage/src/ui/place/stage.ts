// The place on a stage you edit: a click selects the piece or prop under it (the interaction layer's hit test, on a copy
// whose unnamed pieces are named so each hit names its piece: `shownDoc`), a drag moves it along the floor at its own
// height (its outline follows; the place loads again on release), a mark is a spike pin with its facing, dragged the
// same way, and in drop mode a click puts the catalogue's pick where it lands (a prop on a piece sits at that piece's height).

import { html } from "htm/preact";
import { useEffect, useRef } from "preact/hooks";
import { interact, mountStage, rayZ, type Interaction, type Stage } from "sahne";
import type { StoryPlace } from "sahne-story";
import { heightOn, posOf, selOfTarget, shownDoc, targetOf, type Sel } from "../../model/place.ts";
import { KIT, seriesLang, SOUNDS } from "../../stage.ts";

/** What the catalogue is putting down. */
export type Drop = { kind: "piece" | "prop"; kit: string } | { kind: "mark" };
type Point = { x: number; y: number; z: number };

const ARROW: Record<string, string> = { l: "←", r: "→", back: "↑", side_l: "⇠", side_r: "⇢" };
/** Pieces as big as the room: a click selects them, but only a selected one drags (a stray drag would move the wall). */
const BACKDROP = new Set(["wall", "street", "floor"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function PlaceStage(p: {
  doc: StoryPlace; sel: Sel; time?: string; states: string[]; drop: Drop | null;
  select(s: Sel): void; move(s: Sel, dx: number, dz: number): void; onDrop(at: Point, d: Drop): void;
}) {
  const box = useRef<HTMLDivElement>(null), ov = useRef<HTMLDivElement>(null), pins = useRef<HTMLDivElement>(null);
  const outline = useRef<SVGPolygonElement>(null), hover = useRef<SVGPolygonElement>(null);
  const stage = useRef<{ st: Stage; ix: Interaction } | null>(null);
  const live = useRef(p);
  live.current = p;
  /** A press on a thing: it drags once the pointer has moved a few pixels, across at the thing's own depth. The stage's
   *  camera is low, so a few pixels up or down are a metre of depth: only a thing on the floor (a mark, a sack) drags in
   *  depth too; a raised one keeps its depth, which the plan and the arrow keys set. */
  const drag = useRef<{ sel: Sel; z: number; deep: boolean; from: [number, number]; x0: number; floor0: number; dx: number; dz: number; moved: boolean } | null>(null);
  const hovered = useRef<string | null>(null);

  const show = () => {
    const s = stage.current, { doc, time, states } = live.current;
    if (!s) return;
    try {
      s.st.load({ v: 1, cues: [{ scene: { place: doc.id, at: {}, ...(time ? { time } : {}), ...(states.length ? { state: states } : {}) } }] }, { cast: {}, places: { [doc.id]: shownDoc(doc) } });
      s.st.show(0);
    } catch (e) { console.warn(e); }
  };

  /** The pins, the selection's outline (moved by the drag) and the hovered thing's, from the last frame's quads. */
  const draw = () => {
    const s = stage.current, el = pins.current;
    if (!s || !el) return;
    const { doc, sel } = live.current, g = drag.current;
    const quad = (target: string | null, dx = 0, dz = 0) => {
      if (!target) return "";
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const pk of s.st.picks) {
        if (pk.target !== target && !pk.target.startsWith(target + "#")) continue;
        for (const c of pk.c) {
          const q = s.st.project([c[0] + dx, c[1], c[2] + dz]);
          if (!q) continue;
          x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
        }
      }
      return x0 === Infinity ? "" : `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`;
    };
    const t = targetOf(doc, sel), moving = g?.moved && g.sel?.kind !== "mark";
    outline.current?.setAttribute("points", quad(t, moving ? g!.dx : 0, moving ? g!.dz : 0));
    outline.current?.classList.toggle("ghost", !!moving);
    hover.current?.setAttribute("points", hovered.current && hovered.current !== t ? quad(hovered.current) : "");

    const ids = Object.keys(doc.marks);
    while (el.children.length > ids.length) el.lastChild!.remove();
    ids.forEach((mid, i) => {
      const m = doc.marks[mid], dragged = g?.sel?.kind === "mark" && g.sel.id === mid;
      const x = m.x + (dragged ? g!.dx : 0), z = m.z + (dragged ? g!.dz : 0);
      const q = s.st.project([x, m.y ?? 0, z]);
      let pin = el.children[i] as HTMLSpanElement | undefined;
      if (!pin) { pin = document.createElement("span"); el.append(pin); }
      const on = sel?.kind === "mark" && sel.id === mid;
      const sig = `${mid}|${m.facing ?? ""}|${doc.perch === mid}|${!!m.air}|${on}`;
      if (pin.dataset.sig !== sig) {
        pin.dataset.sig = sig; pin.dataset.mark = mid;
        pin.className = `pl-pin${m.air ? " air" : ""}${on ? " on" : ""}`;
        pin.title = `${mid}: drag to move it`;
        pin.innerHTML = `<span class="x"></span><span class="name"></span>${m.facing ? `<span class="arrow">${ARROW[m.facing] ?? ""}</span>` : ""}${doc.perch === mid ? `<span class="perch" title="Kerim's perch">🕊</span>` : ""}`;
        (pin.querySelector(".name") as HTMLElement).textContent = mid;
      }
      pin.style.display = q ? "" : "none";
      if (q) { pin.style.left = `${q[0]}px`; pin.style.top = `${q[1]}px`; }
    });
  };

  useEffect(() => {
    const st = mountStage(box.current!, { kit: KIT, lang: seriesLang(), bubbles: false, motion: "full", sounds: SOUNDS });
    const ix = interact(st, { explore: false });
    stage.current = { st, ix };
    show();
    const off = st.onFrame(draw);
    return () => { off(); st.destroy(); stage.current = null; };
  }, []);
  // the stage follows the document (not while something is dragged: its outline moves alone, the place loads on release)
  useEffect(() => {
    const t = setTimeout(() => { if (!drag.current) show(); }, 250);
    return () => clearTimeout(t);
  }, [p.doc, p.time, p.states.join()]);
  useEffect(draw, [p.doc, p.sel]);

  const local = (e: PointerEvent): [number, number] => { const r = ov.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const floor = (xy: [number, number], y: number) => stage.current?.st.floorAt(xy[0], xy[1], y) ?? null;
  /** Where the pointer is across, at depth `z`. */
  const across = (xy: [number, number], z: number) => { const s = stage.current; return (s && rayZ(s.ix.ray(xy[0], xy[1]), z)?.[0]) ?? null; };

  const onDown = (e: PointerEvent) => {
    const s = stage.current;
    if (!s || e.button !== 0) return;
    const xy = local(e), { doc, sel, drop } = live.current;
    if (drop) {
      // a prop dropped on a prop sits beside it; on a piece, where it was hit, at the height things sit at on its kind
      const hit = drop.kind === "prop" ? s.ix.hitAt(xy[0], xy[1]) : null, on = selOfTarget(doc, hit?.target);
      const y = on?.kind === "prop" ? posOf(doc, on)!.y : on?.kind === "piece" ? heightOn(doc, doc.pieces[on.i].kit) : 0;
      if (hit && y > 0) { live.current.onDrop({ x: r2(hit.p[0]), y, z: r2(hit.p[2]) }, drop); return; }
      // else on the floor, kept in the room (a click on the back wall puts it at the wall's foot)
      const f = floor(xy, 0), d = doc.size.d / 2, x = f ? f[0] : across(xy, -d);
      if (x !== null) live.current.onDrop({ x: r2(x), y: 0, z: r2(f ? Math.max(-d, Math.min(d, f[2])) : -d) }, drop);
      return;
    }
    const mid = (e.target as HTMLElement).closest<HTMLElement>(".pl-pin")?.dataset.mark;
    const next: Sel = mid ? { kind: "mark", id: mid } : selOfTarget(doc, s.ix.hitAt(xy[0], xy[1])?.target);
    const was = !!next && targetOf(doc, next) === targetOf(doc, sel) && (next.kind !== "mark" || (sel?.kind === "mark" && sel.id === next.id));
    live.current.select(next);
    if (!next) return;
    if (next.kind === "piece" && BACKDROP.has(doc.pieces[next.i].kit) && !was) return;
    const at = posOf(doc, next), f = at && across(xy, at.z), f0 = floor(xy, 0);
    if (!at || f === null || !f0) return;
    e.preventDefault();
    try { ov.current!.setPointerCapture(e.pointerId); } catch { /* a pointer the page did not see go down */ }
    drag.current = { sel: next, z: at.z, deep: at.y < 0.05, from: xy, x0: f, floor0: f0[2], dx: 0, dz: 0, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const s = stage.current, g = drag.current;
    if (!s) return;
    const xy = local(e);
    if (!g) {
      const t = live.current.drop ? null : s.ix.hitAt(xy[0], xy[1])?.target ?? null;
      const sel = selOfTarget(live.current.doc, t);
      const target = sel ? targetOf(live.current.doc, sel) : null;
      if (target !== hovered.current) { hovered.current = target; draw(); }
      return;
    }
    if (!g.moved && Math.hypot(xy[0] - g.from[0], xy[1] - g.from[1]) < 4) return;
    const f = across(xy, g.z), f0 = floor(xy, 0);
    if (f === null || !f0) return;
    g.moved = true; g.dx = f - g.x0; g.dz = g.deep && !e.altKey ? f0[2] - g.floor0 : 0;
    draw();
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (g?.moved) live.current.move(g.sel, g.dx, g.dz);
    draw();
  };
  const onLeave = () => { if (hovered.current) { hovered.current = null; draw(); } };

  const hint = p.drop ? `Click where the ${p.drop.kind === "mark" ? "new mark" : p.drop.kit.replace(/_/g, " ")} goes · Esc cancels`
    : p.sel ? "Drag to move it across · ↑↓ or the plan set its depth · Delete removes · Esc lets go" : "Click a thing to select it · drag a pin to move a mark";
  return html`<div class="stagebox">
    <div ref=${box}></div>
    <div ref=${ov} class=${`pl-ov${p.drop ? " dropping" : ""}`} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} onPointerLeave=${onLeave}>
      <svg aria-hidden="true"><polygon ref=${hover} class="hover" /><polygon ref=${outline} class="outline" /></svg>
      <div ref=${pins} class="pl-pins"></div>
      <div class="pl-hint">${hint}</div>
    </div>
  </div>`;
}
