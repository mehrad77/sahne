// The place checks: a place's contact sheet (#/places/<id>/sheet: the place at every
// time it lists, at a phone's width and a desktop's) and its camera check (#/places/<id>/camera: a
// stand-in on every mark, framed wide, two and close, and Kerim on the perch and every air mark, framed
// wide; each must lie inside the frame). shots.mjs --places and --camera photograph these views and
// read the check's result from window.cameraCheck.

import { mountStage, type AvatarDoc, type Cue, type Kit, type PlaceDoc, type Stage, type StageOptions } from "sahne";

/** How a check mounts its stages: the gallery's shell frees them when the view changes. */
export type Mount = (el: HTMLElement, o: StageOptions) => Stage;
const plain: Mount = (el, o) => mountStage(el, o);

export const WIDTHS = [1100, 390];
const SHOTS = ["wide", "two", "close"] as const;

const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** A stage box `w` CSS pixels wide, 16:9, in `parent`. */
function box(parent: HTMLElement, w: number) {
  const b = el("div", "stagebox");
  b.style.width = `${w}px`;
  b.style.maxWidth = "none";
  parent.append(b);
  return b;
}

/** The place at every time it lists, once per width: one figure each (data-time, data-w). */
export function contactSheet(host: HTMLElement, doc: PlaceDoc, kit: Kit, mount = plain) {
  for (const w of WIDTHS) {
    const row = el("div", "sheetrow");
    row.append(el("h3", "", `${w} px`));
    for (const time of doc.times?.length ? doc.times : ["day"]) {
      const fig = el("figure", "sheetcell");
      fig.dataset.time = time;
      fig.dataset.w = String(w);
      const stage = mount(box(fig, w), { kit, bubbles: false });
      stage.load({ v: 1, cues: [{ scene: { place: doc.id, time, at: {}, cam: "wide" } }] }, { cast: {}, places: { [doc.id]: doc } });
      fig.append(el("figcaption", "", time));
      row.append(fig);
    }
    host.append(row);
  }
}

export interface CameraResult { mark: string; who: "stand-in" | "kerim"; shot: string; width: number; box: number[] | null; ok: boolean }

/**
 * Stands the stand-in on every mark people stand on (no height, not in the air) and frames it wide, two
 * and close; puts Kerim on the place's perch and every air mark and frames her wide; at each width. A
 * result is ok when the figure (wide) or its head (two, close) was drawn and lies inside the frame (1 px of slack).
 */
export function cameraCheck(host: HTMLElement, doc: PlaceDoc, kit: Kit, standIn: AvatarDoc, mount = plain): CameraResult[] {
  const out: CameraResult[] = [];
  const marks = Object.entries(doc.marks);
  const ground = marks.filter(([, m]) => !m.air && !((m.y ?? 0) > 0)).map(([id]) => id);
  // Kerim: the place's perch and every air mark (other marks up high are spots for things: a sign, a shelf)
  const high = [...new Set([...(doc.perch ? [doc.perch] : []), ...marks.filter(([, m]) => m.air).map(([id]) => id)])];
  const time = doc.times?.[0] ?? "day";
  for (const w of WIDTHS) {
    const stage = mount(box(host, w), { kit, bubbles: false });
    stage.pickable = true;
    // measured now, not on the resize observer's next turn: the check runs before the page paints
    stage.resize();
    const [cw, ch] = stage.cssSize;
    // drawn (a box of real size) and inside the frame, with 1 px of slack
    const inside = (b: number[] | null) => !!b && b[2] - b[0] > 4 && b[3] - b[1] > 4 && b[0] >= -1 && b[1] >= -1 && b[2] <= cw + 1 && b[3] <= ch + 1;
    for (const mark of ground) {
      const cues: Cue[] = [{ scene: { place: doc.id, time, at: { a: mark }, cam: "wide" } }, { beat: { who: "a", cam: "two" } }, { beat: { who: "a", cam: "close" } }];
      stage.load({ v: 1, cues }, { cast: { a: standIn }, places: { [doc.id]: doc } });
      SHOTS.forEach((shot, i) => {
        stage.show(i);
        stage.render();
        // a wide shot shows the whole figure; two and close crop the body by design, so their head must be in
        const b = stage.bounds(shot === "wide" ? "ch:a" : "ch:a.head");
        out.push({ mark, who: "stand-in", shot, width: w, box: b && b.map(Math.round), ok: inside(b) });
      });
    }
    for (const mark of high) {
      stage.load({ v: 1, cues: [{ scene: { place: doc.id, time, at: { kerim: mark }, cam: "wide" } }] }, { cast: { kerim: { puppet: "bird" } }, places: { [doc.id]: doc } });
      stage.show(0);
      stage.render();
      const b = stage.bounds("ch:kerim");
      out.push({ mark, who: "kerim", shot: "wide", width: w, box: b && b.map(Math.round), ok: inside(b) });
    }
  }
  return out;
}

/** The results as a table: one row per mark and figure, one column per width × shot. */
export function cameraTable(results: CameraResult[]) {
  const t = el("table", "linttable t"), head = el("tr");
  const cols = WIDTHS.flatMap(w => SHOTS.map(s => `${w} ${s}`));
  head.append(el("th", "", "mark"), ...cols.map(c => el("th", "", c)));
  t.append(head);
  const rows = [...new Set(results.map(r => `${r.who}|${r.mark}`))];
  for (const key of rows) {
    const [who, mark] = key.split("|"), tr = el("tr");
    tr.append(el("td", "", `${mark}${who === "kerim" ? " (Kerim)" : ""}`));
    for (const w of WIDTHS) for (const s of SHOTS) {
      const r = results.find(x => x.who === who && x.mark === mark && x.width === w && x.shot === s);
      const td = el("td", !r ? "" : r.ok ? "ok" : "bad", !r ? "–" : r.ok ? "✓" : "✗");
      if (r?.box) td.title = r.box.join(", ");
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
}
