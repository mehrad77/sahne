// The ground plan: the place from above, as a stage designer draws it. Across is x, down is z toward the audience; the
// room is `size` (w × d) around the middle, and what stands behind it (the street, the far band) is drawn on a strip at
// the top. Pieces are boxes (the room's own, the floor and the walls, are lines), props dots, marks spike crosses with
// their facing, and the wide shot a bracket at the depth it fits. Drag anything to move it in x and z.

import { html } from "htm/preact";
import { useRef, useState } from "preact/hooks";
import type { StoryPlace } from "sahne-story";
import { posOf, sameSel, type Sel } from "../../model/place.ts";
import type { Drop } from "./stage.ts";

const S = 60; // px a metre
const LINE = new Set(["floor", "wall", "street"]);
const DIR: Record<string, [number, number]> = { l: [-1, 0.35], r: [1, 0.35], back: [0, -1], side_l: [-1, 0], side_r: [1, 0] };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function GroundPlan(p: { doc: StoryPlace; sel: Sel; drop: Drop | null; select(s: Sel): void; moveTo(s: Sel, x: number, z: number): void; onDrop(at: { x: number; y: number; z: number }, d: Drop): void }) {
  const { doc } = p, w = doc.size.w, d = doc.size.d;
  const back = -d / 2 - 0.9; // the strip for what stands behind the room
  const x0 = -w / 2 - 0.6, x1 = w / 2 + 0.6, z0 = back - 0.4, z1 = d / 2 + 0.5;
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ sel: Sel; x: number; z: number; moved: boolean } | null>(null);

  const toPlan = (e: PointerEvent): [number, number] => {
    const m = svg.current!.getScreenCTM()!.inverse(), pt = svg.current!.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(m);
    return [r2(q.x / S), r2(q.y / S)];
  };
  const at = (s: Sel, x: number, z: number) => (drag && sameSel(drag.sel, s) ? [drag.x, drag.z] : [x, z]);
  const clampZ = (z: number) => Math.max(z, back);

  const down = (s: Sel) => (e: PointerEvent) => {
    e.stopPropagation();
    if (p.drop) return;
    p.select(s);
    const pos = posOf(doc, s);
    if (!pos) return;
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* a pointer the page did not see go down */ }
    setDrag({ sel: s, x: pos.x, z: pos.z, moved: false });
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const [x, z] = toPlan(e);
    setDrag({ ...drag, x, z, moved: true });
  };
  const up = () => {
    if (drag?.moved) p.moveTo(drag.sel, drag.x, drag.z);
    setDrag(null);
  };
  const bg = (e: PointerEvent) => {
    if (!p.drop) { p.select(null); return; }
    const [x, z] = toPlan(e);
    p.onDrop({ x, y: 0, z }, p.drop);
  };
  const on = (s: Sel) => sameSel(p.sel, s) ? " on" : "";
  // a piece is named on the plan when it is selected or has room for its name (the wall's row is crowded); else on hover
  const named = (i: number) => sameSel(p.sel, { kind: "piece", i }) || !doc.pieces.some((q, k) => k !== i && !LINE.has(q.kit) && Math.abs(q.x - doc.pieces[i].x) < 0.7 && Math.abs(clampZ(q.z) - clampZ(doc.pieces[i].z)) < 0.35);
  const wide = doc.camera?.wide;

  return html`<div class="panel pl-plan">
    <svg ref=${svg} viewBox=${`${x0 * S} ${z0 * S} ${(x1 - x0) * S} ${(z1 - z0) * S}`} role="img" aria-label="Ground plan: the place from above"
      onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} style=${p.drop ? "cursor:crosshair" : ""}>
      <rect class="far" x=${x0 * S} y=${z0 * S} width=${(x1 - x0) * S} height=${(-d / 2 - z0) * S} onPointerDown=${bg} />
      <rect class="room" x=${-w / 2 * S} y=${-d / 2 * S} width=${w * S} height=${d * S} onPointerDown=${bg} />
      <text x=${x0 * S + 4} y=${z0 * S + 11} class="cam-label" style="fill:var(--faint)">behind</text>
      <text x=${0} y=${z1 * S - 6} text-anchor="middle" class="cam-label" style="fill:var(--faint)">audience ↓</text>
      ${wide && html`<g class="camera" style="pointer-events:none">
        <path class="cam" d=${`M ${(wide.x - wide.w / 2) * S} ${((wide.z ?? 0) * S) - 6} v 6 H ${(wide.x + wide.w / 2) * S} v -6`} />
        <text class="cam-label" x=${(wide.x - wide.w / 2) * S + 3} y=${(wide.z ?? 0) * S + 12}>wide shot</text></g>`}
      ${doc.pieces.map((pc, i) => {
        const s: Sel = { kind: "piece", i }, [x, z] = at(s, pc.x, pc.z), far = z < back, zz = clampZ(z);
        if (LINE.has(pc.kit)) return html`<g class=${`piece back${on(s)}`} onPointerDown=${down(s)}><title>${pc.kit} ${i}</title>
          <rect x=${-w / 2 * S} y=${zz * S - 2} width=${w * S} height=${4} /><text x=${w / 2 * S + 3} y=${zz * S + 3}>${pc.kit}</text></g>`;
        return html`<g class=${`piece${far || z < -d / 2 ? " back" : ""}${on(s)}`} onPointerDown=${down(s)}><title>${pc.id ?? pc.kit} (${pc.kit} ${i})</title>
          <rect x=${x * S - 15} y=${zz * S - 6} width=${30} height=${12} rx=${2} />
          ${named(i) && html`<text x=${x * S} y=${zz * S + 16} text-anchor="middle">${pc.kit.replace(/_/g, " ")}</text>`}</g>`;
      })}
      ${Object.entries(doc.props ?? {}).map(([id, pr]) => {
        const s: Sel = { kind: "prop", id }, pos = posOf(doc, s);
        if (!pos || typeof pr.at === "string") return "";
        const [x, z] = at(s, pos.x, pos.z);
        return html`<g class=${`prop${on(s)}`} onPointerDown=${down(s)}><title>${id} (${pr.kit}) at ${pos.y} m</title>
          <circle cx=${x * S} cy=${clampZ(z) * S} r=${4} stroke="none" /></g>`;
      })}
      ${Object.entries(doc.marks).map(([id, m]) => {
        const s: Sel = { kind: "mark", id }, [x, z] = at(s, m.x, m.z), X = x * S, Z = clampZ(z) * S, f = m.facing && DIR[m.facing];
        return html`<g class=${`mark${m.air ? " air" : ""}${on(s)}`} onPointerDown=${down(s)}><title>${id}${m.air ? " (in the air)" : ""}${m.y ? ` at ${m.y} m` : ""}</title>
          <circle cx=${X} cy=${Z} r=${10} fill="transparent" />
          <path d=${`M ${X - 6} ${Z - 6} L ${X + 6} ${Z + 6} M ${X + 6} ${Z - 6} L ${X - 6} ${Z + 6}`} />
          ${f && html`<path d=${`M ${X} ${Z} l ${f[0] * 16} ${f[1] * 16}`} style="stroke-width:1.5" />`}
          <text x=${X + 9} y=${Z - 7}>${id}${doc.perch === id ? " 🕊" : ""}</text></g>`;
      })}
    </svg>
  </div>`;
}
