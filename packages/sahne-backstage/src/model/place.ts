// A place as the place page edits it on its stage and its ground plan: what is selected (a piece by index, a prop or a
// mark by id), what a hit on the stage is, moving and removing a thing, the heights things sit at, and new ids.
// Pure: Node-tested (test/place.test.ts).
//
// A piece's art comes from its seed (`pieceSeed`): an unnamed piece's seed is its kit and position, so moving it would
// change its art. Every move pins the seed it had first, as the page's other edits do.

import { pieceSeed, type Mark, type PieceRef, type PlaceDoc, type PropRef } from "sahne";

export type Sel = { kind: "piece"; i: number } | { kind: "prop"; id: string } | { kind: "mark"; id: string } | null;

type Doc = PlaceDoc & { props?: Record<string, PropRef> };
const r2 = (n: number) => Math.round(n * 100) / 100;
/** The prefix of the ids the stage's copy gives unnamed pieces (no kit or story id starts with it). */
const TEMP = "@";

export const sameSel = (a: Sel, b: Sel) => !!a && !!b && a.kind === b.kind && (a.kind === "piece" ? a.i === (b as { i: number }).i : (a as { id: string }).id === (b as { id: string }).id);

/** A piece with its seed pinned: the same art wherever it moves and whatever it is named. */
export const pinned = (doc: Doc, p: PieceRef): PieceRef => (p.seed || p.id ? p : { ...p, seed: pieceSeed(doc, p) });

/** The copy the stage draws: each unnamed piece named `@<index>` with its seed pinned, so a hit names its piece. */
export function shownDoc<T extends Doc>(doc: T): T {
  return { ...doc, pieces: doc.pieces.map((p, i) => (p.id ? p : { ...pinned(doc, p), id: `${TEMP}${i}` })) };
}

/** What a stage hit (`piece:@3`, `piece:door`, `obj:ekmek#1`) selects in `doc`, or null. */
export function selOfTarget(doc: Doc, target: string | null | undefined): Sel {
  if (!target) return null;
  const i = target.indexOf(":"), kind = target.slice(0, i), id = target.slice(i + 1);
  if (kind === "piece") {
    if (id.startsWith(TEMP)) { const n = Number(id.slice(TEMP.length)); return doc.pieces[n] ? { kind: "piece", i: n } : null; }
    const n = doc.pieces.findIndex(p => p.id === id);
    return n >= 0 ? { kind: "piece", i: n } : null;
  }
  if (kind === "obj") { const pid = id.split("#")[0]; return doc.props?.[pid] ? { kind: "prop", id: pid } : null; }
  return null;
}

/** The stage target that draws a selection (what its outline is made of). */
export function targetOf(doc: Doc, sel: Sel): string | null {
  if (!sel) return null;
  if (sel.kind === "piece") { const p = doc.pieces[sel.i]; return p ? `piece:${p.id ?? `${TEMP}${sel.i}`}` : null; }
  if (sel.kind === "prop") return `obj:${sel.id}`;
  return null;
}

/** Where a selected thing stands (a prop on a mark stands on its mark). */
export function posOf(doc: Doc, sel: Sel): { x: number; y: number; z: number } | null {
  if (!sel) return null;
  if (sel.kind === "piece") { const p = doc.pieces[sel.i]; return p ? { x: p.x, y: p.y ?? 0, z: p.z } : null; }
  if (sel.kind === "mark") { const m = doc.marks[sel.id]; return m ? { x: m.x, y: m.y ?? 0, z: m.z } : null; }
  const pr = doc.props?.[sel.id];
  if (!pr) return null;
  if (typeof pr.at === "string") { const m = doc.marks[pr.at]; return m ? { x: m.x, y: m.y ?? 0, z: m.z } : null; }
  return { ...pr.at };
}

/** The document with the selected thing at floor point (x, z); a prop on a mark becomes free there, at its mark's height. */
export function move<T extends Doc>(doc: T, sel: Sel, x: number, z: number): T {
  x = r2(x); z = r2(z);
  if (!sel) return doc;
  if (sel.kind === "piece") {
    const p = doc.pieces[sel.i];
    if (!p) return doc;
    return { ...doc, pieces: doc.pieces.map((q, k) => (k === sel.i ? { ...pinned(doc, q), x, z } : q)) };
  }
  if (sel.kind === "mark") {
    const m = doc.marks[sel.id];
    return m ? { ...doc, marks: { ...doc.marks, [sel.id]: { ...m, x, z } } } : doc;
  }
  const pr = doc.props?.[sel.id], at = posOf(doc, sel);
  if (!pr || !at) return doc;
  return { ...doc, props: { ...doc.props, [sel.id]: { ...pr, at: { x, y: at.y, z } } } };
}

/** Moved by (dx, dz) metres. */
export function nudge<T extends Doc>(doc: T, sel: Sel, dx: number, dz: number): T {
  const at = posOf(doc, sel);
  return at ? move(doc, sel, at.x + dx, at.z + dz) : doc;
}

/** The document without the selected thing. */
export function remove<T extends Doc>(doc: T, sel: Sel): T {
  if (!sel) return doc;
  if (sel.kind === "piece") return { ...doc, pieces: doc.pieces.filter((_, k) => k !== sel.i) };
  const key = sel.kind === "mark" ? "marks" : "props";
  const { [sel.id]: _, ...rest } = (doc[key] ?? {}) as Record<string, unknown>;
  return { ...doc, [key]: rest };
}

/** A copy of the selected piece or prop beside it (a piece's copy keeps its art: its seed is pinned, its id dropped). */
export function duplicate<T extends Doc>(doc: T, sel: Sel): { doc: T; sel: Sel } {
  if (sel?.kind === "piece") {
    const p = doc.pieces[sel.i];
    if (!p) return { doc, sel };
    const { id: _, ...copy } = { ...pinned(doc, p), seed: pieceSeed(doc, p) };
    return { doc: { ...doc, pieces: [...doc.pieces, { ...copy, x: r2(p.x + 0.3) }] }, sel: { kind: "piece", i: doc.pieces.length } };
  }
  if (sel?.kind === "prop") {
    const pr = doc.props?.[sel.id], at = posOf(doc, sel);
    if (!pr || !at) return { doc, sel };
    const id = nextId(Object.keys(doc.props ?? {}), sel.id.replace(/\d+$/, ""));
    return { doc: { ...doc, props: { ...doc.props, [id]: { ...pr, at: { ...at, x: r2(at.x + 0.15) } } } }, sel: { kind: "prop", id } };
  }
  return { doc, sel };
}

/** `base` if free, else `base2`, `base3`… (`mark` gives `mark1`). */
export function nextId(taken: readonly string[], base: string): string {
  const has = new Set(taken);
  if (base !== "mark" && !has.has(base)) return base;
  for (let n = base === "mark" ? 1 : 2; ; n++) if (!has.has(`${base}${n}`)) return `${base}${n}`;
}

/** Kits that are the room itself, not something one puts a thing on. */
const ROOM = new Set(["floor", "wall", "street", "window", "awning", "shutter", "lamp", "clock", "picture", "calendar"]);

/** The heights things sit at in this place (the floor, and each height its props and standing marks use, to 0.05),
 *  each named after the piece most of them are nearest (`0.9 · counter`), with how many use it. */
export function heights(doc: Doc): { y: number; label: string; kit?: string; n: number }[] {
  const spots: { x: number; y: number; z: number }[] = [];
  for (const pr of Object.values(doc.props ?? {})) if (typeof pr.at === "object" && pr.at.y > 0) spots.push(pr.at);
  for (const m of Object.values(doc.marks) as Mark[]) if (!m.air && (m.y ?? 0) > 0) spots.push({ x: m.x, y: m.y!, z: m.z });
  const groups = new Map<number, string[]>();
  const things = doc.pieces.filter(p => !ROOM.has(p.kit));
  for (const s of spots) {
    const y = Math.round(s.y * 20) / 20;
    const near = things.reduce<PieceRef | null>((b, p) => (!b || Math.hypot(p.x - s.x, p.z - s.z) < Math.hypot(b.x - s.x, b.z - s.z) ? p : b), null);
    groups.set(y, [...(groups.get(y) ?? []), near?.kit ?? ""]);
  }
  const named = [...groups].sort(([a], [b]) => a - b).map(([y, kits]) => {
    const count = new Map<string, number>();
    for (const k of kits) count.set(k, (count.get(k) ?? 0) + 1);
    const kit = [...count].sort((a, b) => b[1] - a[1])[0][0];
    return { y, label: kit ? `${y} · ${kit.replace(/_/g, " ")}` : String(y), ...(kit ? { kit } : {}), n: kits.length };
  });
  return [{ y: 0, label: "0 · floor", n: 0 }, ...named];
}

/** The height things usually sit at on a kind of piece (the one most of them use), or 0. */
export const heightOn = (doc: Doc, kit: string) => heights(doc).filter(h => h.kit === kit).sort((a, b) => b.n - a.n)[0]?.y ?? 0;
