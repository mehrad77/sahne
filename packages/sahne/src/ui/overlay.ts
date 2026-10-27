// HTML laid over the stage (DESIGN.md §6.8): speech bubbles, sound words and the narrator
// inset. Real text, so it stays crisp, zooms, and reaches screen readers.
//
// The stage owns one Overlay, calls set() whenever the lines on stage change and layout() on
// every frame it draws while the camera or the speakers move. layout() reads nothing from the
// DOM: sizes are measured when a bubble's text changes (and by a ResizeObserver when the host
// resizes or fonts load), so a frame only projects anchors and writes transforms.
//
// Layers, bottom to top: the narrator's window, every tail, sound words, speech bubbles, the
// narrator's bubble. Tails sit under all bodies so a tail never covers another bubble's text.

import type { Vec3 } from "../core/math.ts";
import { OVERLAY_CSS } from "./overlay-css.ts";
import { glossInto, popup, type GlossOptions } from "./gloss.ts";
import { crowding, inside, keepSide, placements, separate, tailAim, tailTo, type Body, type Placement, type Pt, type Rect, type Side, type Tail } from "./place.ts";

export type BubbleKind = "speech" | "sound" | "narrator";

export interface Bubble {
  /** Stable while the bubble is on screen; a new id is a new bubble. */
  id: string;
  kind: BubbleKind;
  text: string;
  /** Who says it (speech, narrator). */
  who?: string;
  /** World point the bubble belongs to: above a speaker's head, or where a sound comes from. Unused for the narrator. */
  anchor?: Vec3;
  /**
   * The speaker's mouth and head (world): the tail then points at the mouth and stops just outside
   * the head. `head` is the head's centre, a point on its outline to the side and one at its top.
   */
  mouth?: Vec3;
  head?: [Vec3, Vec3, Vec3];
  /** "silent" draws the "…" of a line with no words; "whisper" a dashed, quieter bubble. */
  voice?: "normal" | "whisper" | "silent" | "mouthing";
  /** Language of the text (its `lang` attribute). Default "tr". */
  lang?: string;
  /** The speaker's display name, read by screen readers before the line ("İsmail: …"); not shown unless `remote`. */
  name?: string;
  /** The speaker is off stage, heard on a phone or a call: the bubble shows the name with a phone mark, and has no tail. */
  remote?: boolean;
}

export interface OverlayOptions {
  /** World point to CSS pixels inside the host; null when it is behind the camera. */
  project: (p: Vec3) => [number, number] | null;
  /** Reduced motion: bubbles appear without movement. */
  still?: boolean;
  /** Accessible label of a sound word, in the app's language. Default `sound: <text>`. */
  soundLabel?: (text: string) => string;
}

export interface InsetOptions {
  /** What the window shows (Kerim); it is sized to fill the window. */
  el: HTMLElement;
  who: string;
  /** Bottom corner of the window. Default "left". */
  side?: "left" | "right";
  /** Called when a narrator bubble appears or changes its text (true, the text) and when it goes (false). */
  onTalk?: (talking: boolean, text: string) => void;
}

interface Item {
  b: Bubble;
  root: HTMLDivElement;
  inner: HTMLElement;
  /** The card of a speech or narrator bubble; null for a sound word. */
  body: HTMLDivElement | null;
  text: HTMLElement;
  sr: HTMLElement | null;
  /** The tail, a sibling in the tails' layer; null for a sound word. */
  tail: SVGSVGElement | null;
  w: number; h: number;
  fitted: boolean;
  placed: boolean;
  off: boolean;
  side: Side;
  leaving: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  tf: string; ttf: string;
}

const STYLE_ID = "sahne-overlay-css";
const SVG = "http://www.w3.org/2000/svg";
/** Edge margin, the inset window's paper rim, and the fade-out time (ms; the CSS uses 120). */
const M = 8, RIM = 4, OUT = 120;
/** The tail drawn pointing down from a base along y = 0, in a 20×20 box stretched to the tail's size. */
const TAIL_FILL = "M0 0C4 5.5 7.6 12.6 10 20 12.4 12.6 16 5.5 20 0Z";
const TAIL_EDGE = "M0 0C4 5.5 7.6 12.6 10 20 12.4 12.6 16 5.5 20 0";
const VOICES = ["normal", "whisper", "silent", "mouthing"] as const;
const FLAGS = ["sahne-wait", "sahne-out", "sahne-off"];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A steady tilt for a sound word, from its id: 4–10 degrees either way. */
function tilt(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = (h >>> 0) / 4294967296;
  return (u < 0.5 ? -1 : 1) * (4 + (u * 2 % 1) * 6);
}

export class Overlay {
  readonly el: HTMLElement;
  private o: OverlayOptions;
  /** Tap-to-translate on the lines' words, when on. */
  private gloss: GlossOptions | null = null;
  /** The position of the bubble an open gloss belongs to, when it was last placed. */
  private popAt = "";
  private doc: Document;
  private items = new Map<string, Item>();
  private byEl = new Map<Element, Item>();
  private ro: ResizeObserver;
  private W = 0; private H = 0;
  /** Text size, tail length and the window's diameter for the current host size. */
  private fs = 16; private T = 14; private D = 80;
  // the narrator's window
  private win: HTMLDivElement | null = null;
  private art: HTMLDivElement | null = null;
  private insetO: InsetOptions | null = null;
  private winShown = false;
  private winPlaced = false;
  private winTf = "";
  private winTimer: ReturnType<typeof setTimeout> | undefined;
  private talking: string | null = null;

  constructor(host: HTMLElement, o: OverlayOptions) {
    this.o = o;
    this.doc = host.ownerDocument;
    if (!this.doc.getElementById(STYLE_ID)) {
      const s = this.doc.createElement("style");
      s.id = STYLE_ID; s.textContent = OVERLAY_CSS;
      this.doc.head.append(s);
    }
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    this.el = this.doc.createElement("div");
    this.el.className = "sahne-ov" + (o.still ? " sahne-still" : "");
    host.append(this.el);
    this.ro = new ResizeObserver(es => this.observed(es));
    this.ro.observe(this.el);
    this.resize(this.el.clientWidth, this.el.clientHeight);
    this.doc.fonts?.addEventListener("loadingdone", this.refit);
  }

  /** Show exactly these bubbles (add, update, remove the rest), positioned for the current camera. */
  set(bubbles: Bubble[]) {
    const seen = new Set<string>(), dirty: Item[] = [];
    for (const b of bubbles) {
      seen.add(b.id);
      let it = this.items.get(b.id);
      if (it && it.b.kind !== b.kind) { this.drop(it); it = undefined; }
      if (!it) { it = this.make(b); dirty.push(it); continue; }
      if (it.leaving) this.revive(it);
      if (this.update(it, b)) dirty.push(it);
    }
    for (const it of [...this.items.values()]) if (!seen.has(it.b.id) && !it.leaving) this.leave(it);
    if (dirty.length) this.fit(dirty);
    this.syncNarrator();
    this.layout();
  }

  /** Re-position after the camera moved. */
  layout() {
    const { W, H } = this;
    if (!W || !H || (!this.items.size && !this.winShown)) return;
    const room = { W, H, m: M, T: this.T };
    const dpr = window.devicePixelRatio || 1, snap = (v: number) => Math.round(v * dpr) / dpr;
    const D = this.D, left = (this.insetO?.side ?? "left") === "left";
    // the window sits in a bottom corner, the narrator's bubble beside it; both stay put
    const wx = left ? M + RIM : W - M - RIM - D, wy = H - M - RIM - D;
    const centre: Pt = [wx + D / 2, wy + D / 2];
    let bodies: (Body & { it?: Item; a?: Pt | null })[] = [];
    const alts: { i: number; ps: Placement[]; a: Pt | null; it: Item }[] = [];
    const gapOf = (p: Placement) => Math.min(p.gap, Math.max(8, this.T * 0.6));
    if (this.win && this.winShown) {
      const tf = `translate3d(${snap(wx)}px,${snap(wy)}px,0)`;
      if (tf !== this.winTf) { this.win.style.transform = tf; this.winTf = tf; }
      if (!this.winPlaced) { this.winPlaced = true; this.win.classList.remove("sahne-wait"); }
      bodies.push({ r: { x: wx - RIM, y: wy - RIM, w: D + 2 * RIM, h: D + 2 * RIM }, mob: 0 });
    }
    for (const it of this.items.values()) {
      if (it.leaving || !it.w) continue;
      const b = it.b, { w, h } = it;
      if (b.kind === "narrator") {
        const gap = RIM + this.T + 2;
        const x = left ? wx + D + gap : wx - gap - w;
        bodies.push({ r: inside({ x, y: centre[1] - D * 0.12 - h / 2, w, h }, room), mob: 0, it, a: centre });
        continue;
      }
      const a = b.anchor ? this.o.project(b.anchor) : null;
      if (b.kind === "sound") {
        // just above the source and a little to its right, so the clock or the door stays in view
        this.hide(it, !a);
        if (a) bodies.push({ r: inside({ x: a[0] - w * 0.3, y: a[1] - h - 2, w, h }, room), mob: 4, it });
        continue;
      }
      const ps = placements(a, w, h, room, it.side), p = ps[0];
      it.side = p.side;
      if (ps.length > 1) alts.push({ i: bodies.length, ps, a, it });
      bodies.push({ r: p.r, mob: 1, it, a, lim: keepSide(p.side, a, w, h, gapOf(p)) });
    }
    separate(bodies, room);
    // when the pushes could not make room (a long line on a phone), a speech bubble tries its
    // other sides and keeps the one that at least halves the overlap
    let crowd = alts.length ? crowding(bodies) : 0;
    for (const alt of alts) {
      const { w, h } = alt.it;
      if (crowd < w * h * 0.05) continue;
      let best: typeof bodies | null = null, bestC = crowd * 0.5, side = alt.it.side;
      for (const p of alt.ps.slice(1)) {
        const trial = bodies.map(B => ({ ...B }));
        trial[alt.i] = { ...trial[alt.i], r: p.r, lim: keepSide(p.side, alt.a, w, h, gapOf(p)) };
        separate(trial, room);
        const c = crowding(trial);
        if (c < bestC && crowd - c > w * h * 0.1) { best = trial; bestC = c; side = p.side; }
      }
      if (best) { bodies = best; crowd = bestC; alt.it.side = side; }
    }
    for (const B of bodies) if (B.it) this.put(B.it, B.r, B.a ?? null, snap, centre);
    // an open gloss follows its word as the bubble moves
    const pop = popup(this.doc);
    if (pop.anchor && !pop.anchor.isConnected) pop.close();
    else if (pop.anchor && this.el.contains(pop.anchor)) {
      // only when its bubble moved: placing reads the page's layout
      const moved = [...this.items.values()].find(it => it.root.contains(pop.anchor!))?.tf ?? "";
      if (moved !== this.popAt) { this.popAt = moved; pop.place(); }
    }
  }

  /** The narrator's round window in a corner, with an element the app draws (Kerim). null hides it. */
  inset(o: InsetOptions | null) {
    const prev = this.insetO;
    this.insetO = o;
    if (this.talking !== null && prev?.onTalk !== o?.onTalk) { prev?.onTalk?.(false, ""); o?.onTalk?.(true, this.talking); }
    if (o) {
      const win = this.window();
      if (this.art!.firstChild !== o.el || this.art!.childNodes.length !== 1) this.art!.replaceChildren(o.el);
      win.dataset.side = o.side ?? "left";
      win.dataset.who = o.who;
    } else if (this.talking !== null) this.art?.replaceChildren(); // the window stays for the narrator, empty
    this.syncWindow();
    this.layout();
  }

  /** Reduced motion on or off (the `still` option, changed later). */
  setStill(still: boolean) { this.el.classList.toggle("sahne-still", still); }

  /** Words with a gloss get a dotted underline and open a translation on one tap; null turns it off. */
  setGloss(o: GlossOptions | null) {
    if (o === this.gloss) return;
    this.gloss = o;
    const pop = popup(this.doc);
    if (pop.anchor && this.el.contains(pop.anchor)) pop.close();
    const live = [...this.items.values()].filter(it => !it.leaving);
    for (const it of live) this.fillText(it);
    if (live.length) { this.fit(live); this.layout(); }
  }

  /** The bubble's words, plain or glossable. */
  private fillText(it: Item) {
    const b = it.b, silent = b.kind !== "sound" && b.voice === "silent", pop = popup(this.doc);
    if (pop.anchor && it.text.contains(pop.anchor)) pop.close();
    glossInto(it.text, silent ? "…" : b.text, silent ? null : this.gloss, { text: b.text, who: b.who, lang: b.lang ?? "tr" });
  }

  destroy() {
    const pop = popup(this.doc);
    if (pop.anchor && this.el.contains(pop.anchor)) pop.close();
    this.ro.disconnect();
    this.doc.fonts?.removeEventListener("loadingdone", this.refit);
    for (const it of this.items.values()) clearTimeout(it.timer);
    clearTimeout(this.winTimer);
    this.items.clear(); this.byEl.clear();
    this.el.remove();
  }

  // ---- Bubbles ------------------------------------------------------------------

  private make(b: Bubble): Item {
    const d = this.doc, root = d.createElement("div");
    let inner: HTMLElement, body: HTMLDivElement | null = null, text: HTMLElement, sr: HTMLElement | null = null, tail: SVGSVGElement | null = null;
    if (b.kind === "sound") {
      inner = text = d.createElement("span");
      inner.className = "sahne-snd-in";
      inner.style.setProperty("--sahne-rot", tilt(b.id).toFixed(1) + "deg");
    } else {
      inner = d.createElement("div");
      inner.className = "sahne-b-in";
      body = d.createElement("div");
      body.className = "sahne-b-body";
      sr = d.createElement("span");
      sr.className = "sahne-sr";
      text = d.createElement("span");
      text.dir = "auto";
      body.append(sr, text);
      inner.append(body);
      tail = d.createElementNS(SVG, "svg");
      tail.setAttribute("viewBox", "0 0 20 20");
      tail.setAttribute("preserveAspectRatio", "none");
      tail.setAttribute("aria-hidden", "true");
      for (const [cls, dd] of [["sahne-t-fill", TAIL_FILL], ["sahne-t-edge", TAIL_EDGE]]) {
        const p = d.createElementNS(SVG, "path");
        p.setAttribute("class", cls); p.setAttribute("d", dd);
        tail.append(p);
      }
    }
    root.append(inner);
    root.setAttribute("role", "note");
    const it: Item = {
      b, root, inner, body, text, sr, tail, w: 0, h: 0, fitted: false, placed: false, off: false,
      side: "above", leaving: false, timer: undefined, tf: "", ttf: "",
    };
    this.paint(it, null);
    if (tail) this.el.append(tail);
    this.el.append(root);
    this.items.set(b.id, it);
    const measured = body ?? inner;
    this.byEl.set(measured, it);
    this.ro.observe(measured);
    return it;
  }

  /** Write what changed between two versions of a bubble; true when its size may have changed. */
  private update(it: Item, b: Bubble) {
    const old = it.b;
    it.b = b;
    if (old.text === b.text && old.voice === b.voice && old.lang === b.lang && old.name === b.name && old.who === b.who && !old.remote === !b.remote) return false;
    return this.paint(it, old);
  }

  private paint(it: Item, old: Bubble | null) {
    const b = it.b, voice = VOICES.includes(b.voice ?? "normal") ? b.voice ?? "normal" : "normal";
    let resized = false;
    if (!old || (old.voice ?? "normal") !== voice) {
      const kind = b.kind === "sound" ? "sahne-snd" : b.kind === "narrator" ? "sahne-narr" : "sahne-speech";
      const v = b.kind === "sound" ? "" : "sahne-v-" + voice;
      const keep = (e: Element) => old ? FLAGS.filter(f => e.classList.contains(f)) : ["sahne-wait"];
      it.root.className = [b.kind === "sound" ? "" : "sahne-b", kind, v, ...keep(it.root)].filter(Boolean).join(" ");
      if (it.tail) it.tail.setAttribute("class", ["sahne-tail", kind, v, ...keep(it.tail)].join(" "));
      resized = true;
    }
    const shown = b.kind !== "sound" && voice === "silent" ? "…" : b.text;
    if (it.text.textContent !== shown || old?.lang !== b.lang) { this.fillText(it); resized = true; }
    const lang = b.lang ?? "tr";
    if (it.text.lang !== lang) it.text.lang = lang;
    if (b.kind === "sound") it.root.setAttribute("aria-label", (this.o.soundLabel ?? (t => "sound: " + t))(b.text));
    if (it.sr) {
      // a remote speaker's name is shown, as a line above the text; otherwise it is only read
      const remote = !!b.remote && !!b.name, name = b.name ? b.name + (remote ? "" : ": ") : "";
      const cls = remote ? "sahne-b-who" : "sahne-sr";
      if (it.sr.className !== cls) { it.sr.className = cls; resized = true; }
      if (it.sr.textContent !== name) { it.sr.textContent = name; resized = true; }
    }
    it.root.dataset.id = b.id;
    if (b.who) it.root.dataset.who = b.who; else delete it.root.dataset.who;
    if (resized) it.fitted = false;
    return resized;
  }

  /** Add or remove a state class on a bubble and its tail. */
  private flag(it: Item, f: string, on: boolean) {
    it.root.classList.toggle(f, on);
    it.tail?.classList.toggle(f, on);
  }

  private leave(it: Item) {
    const pop = popup(this.doc);
    if (pop.anchor && it.root.contains(pop.anchor)) pop.close();
    if (!it.placed) { this.drop(it); return; }
    it.leaving = true;
    this.flag(it, "sahne-out", true);
    it.timer = setTimeout(() => this.drop(it), OUT + 40);
  }

  private revive(it: Item) {
    clearTimeout(it.timer);
    it.leaving = false;
    this.flag(it, "sahne-out", false);
  }

  private drop(it: Item) {
    clearTimeout(it.timer);
    const measured = it.body ?? it.inner;
    this.ro.unobserve(measured);
    this.byEl.delete(measured);
    it.root.remove();
    it.tail?.remove();
    if (this.items.get(it.b.id) === it) this.items.delete(it.b.id);
  }

  private hide(it: Item, off: boolean) {
    if (off !== it.off) { it.off = off; this.flag(it, "sahne-off", off); }
  }

  /**
   * Measure bubbles after their text changed, and shrink each card to its longest line (CSS
   * keeps a wrapped box at its max width, which leaves a wide empty margin). Writes, then reads,
   * then writes, then reads: two layouts for the whole batch, never one per bubble.
   */
  private fit(list: Item[]) {
    const cards = list.filter(it => it.body && !it.leaving);
    for (const it of cards) it.body!.style.width = "";
    const range = this.doc.createRange(), want: number[] = [];
    for (const it of cards) {
      const body = it.body!, ow = body.offsetWidth;
      if (!ow || it.b.voice === "silent") { want.push(0); continue; }
      const k = body.getBoundingClientRect().width / ow || 1; // undo a running pop's scale
      range.selectNodeContents(it.text);
      // a line is every rect at its height (glossable words are boxes of their own)
      const lines: { mid: number; l: number; r: number }[] = [];
      for (const r of range.getClientRects()) {
        if (!r.width) continue;
        const mid = (r.top + r.bottom) / 2, L = lines.find(x => Math.abs(x.mid - mid) < r.height / 2);
        if (L) { L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); } else lines.push({ mid, l: r.left, r: r.right });
      }
      let line = 0;
      for (const L of lines) line = Math.max(line, (L.r - L.l) / k);
      const cs = getComputedStyle(body);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const w = Math.ceil(line + pad + 1);
      want.push(line && w < ow - 1 ? w : 0);
    }
    cards.forEach((it, i) => { if (want[i]) it.body!.style.width = want[i] + "px"; });
    for (const it of list) {
      const e = it.body ?? it.inner;
      it.w = e.offsetWidth; it.h = e.offsetHeight;
      it.fitted = it.w > 0;
    }
  }

  private refit = () => {
    const live = [...this.items.values()].filter(it => !it.leaving);
    if (live.length) { this.fit(live); this.layout(); }
  };

  private observed(es: ResizeObserverEntry[]) {
    const refit: Item[] = [];
    let moved = false;
    for (const e of es) {
      if (e.target === this.el) { this.resize(e.contentRect.width, e.contentRect.height); continue; }
      const it = this.byEl.get(e.target);
      if (!it || it.leaving) continue;
      const s = e.borderBoxSize?.[0], w = s ? s.inlineSize : e.contentRect.width, h = s ? s.blockSize : e.contentRect.height;
      if (!it.fitted && w) refit.push(it);
      else if (Math.abs(w - it.w) > 0.5 || Math.abs(h - it.h) > 0.5) { it.w = w; it.h = h; moved = true; }
    }
    // a bubble that could not be measured when it was set (a hidden host): fit it next frame,
    // since resizing it inside this callback would loop the observer
    if (refit.length) requestAnimationFrame(() => {
      const live = refit.filter(it => !it.leaving && this.items.get(it.b.id) === it);
      if (live.length) { this.fit(live); this.layout(); }
    });
    if (moved) this.layout();
  }

  /** Sizes that follow the stage: text 16–19 px, bubbles at most 60% wide (≤ 320 px), the window. */
  private resize(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    const wider = W !== this.W;
    this.W = W; this.H = H;
    this.fs = +clamp(14.6 + W * 0.005, 16, 19).toFixed(2);
    this.T = Math.round(clamp(H * 0.035, 11, 18));
    this.D = Math.round(clamp(Math.min(W * 0.085 + 26, H * 0.42), 40, 100));
    const maxw = Math.round(Math.min(W * 0.6, 320));
    const maxn = Math.round(Math.max(120, Math.min(maxw, W - 2 * M - this.D - 2 * RIM - this.T - 4)));
    const s = this.el.style;
    s.setProperty("--sahne-fs", this.fs + "px");
    s.setProperty("--sahne-snd-fs", Math.round(this.fs * 1.25) + "px");
    s.setProperty("--sahne-maxw", maxw + "px");
    s.setProperty("--sahne-maxn", maxn + "px");
    s.setProperty("--sahne-inset", this.D + "px");
    s.setProperty("--sahne-tailw", Math.round(this.fs * 1.25) + "px");
    if (wider) this.refit();
    this.layout();
  }

  /** Write a bubble's position and its tail; the first time, let it pop from the tail's base. */
  private put(it: Item, r: Rect, a: Pt | null, snap: (v: number) => number, centre: Pt) {
    const x = snap(r.x), y = snap(r.y);
    const tf = `translate3d(${x}px,${y}px,0)`;
    if (tf !== it.tf) { it.root.style.transform = tf; it.tf = tf; }
    let t: Tail | null = null;
    if (it.tail) {
      const fs = this.fs, base = Math.round(fs * 1.25);
      const opts = { radius: fs * 1.1, base, inset: 7, min: 5, max: Math.max(this.T * 3, 44) };
      const m = a && it.b.mouth ? this.o.project(it.b.mouth) : null, hd = m && it.b.head ? it.b.head.map(p => this.o.project(p)) : null;
      if (m && hd && hd[0] && hd[1] && hd[2]) {
        const c = hd[0], rx = Math.hypot(hd[1][0] - c[0], hd[1][1] - c[1]), ry = Math.hypot(hd[2][0] - c[0], hd[2][1] - c[1]);
        t = tailAim({ x, y, w: it.w, h: it.h }, m, { c, rx: Math.max(rx, 1), ry: Math.max(ry, 1) }, { ...opts, gap: 3 });
      } else t = a ? tailTo({ x, y, w: it.w, h: it.h }, a, opts) : null;
      if (t && it.b.kind === "narrator") {
        // stop at the window's rim, not its centre
        t.len = Math.max(12, Math.hypot(centre[0] - t.x, centre[1] - t.y) - (this.D / 2 + RIM) + 2);
      }
      const ttf = t ? `translate3d(${(t.x - base / 2).toFixed(2)}px,${t.y.toFixed(2)}px,0) rotate(${t.angle.toFixed(4)}rad) scale(1,${(t.len / 20).toFixed(3)})` : "scale(0)";
      if (ttf !== it.ttf) { it.tail.style.transform = ttf; it.ttf = ttf; }
    }
    if (!it.placed) {
      it.placed = true;
      if (it.tail) it.inner.style.transformOrigin = t ? `${(t.x - x).toFixed(1)}px ${(t.y - y).toFixed(1)}px` : "50% 100%";
      this.flag(it, "sahne-wait", false);
    }
  }

  // ---- The narrator ---------------------------------------------------------------

  /** Tell the window (and the app) whether the narrator is speaking, and show or hide the window. */
  private syncNarrator() {
    let text: string | null = null;
    for (const it of this.items.values()) if (it.b.kind === "narrator" && !it.leaving) { text = it.b.text; break; }
    if (text !== this.talking) {
      const was = this.talking;
      this.talking = text;
      if (this.win) { if (text !== null) this.win.dataset.talking = ""; else delete this.win.dataset.talking; }
      if (text !== null || was !== null) this.insetO?.onTalk?.(text !== null, text ?? "");
    }
    this.syncWindow();
  }

  private window() {
    if (this.win) return this.win;
    const win = this.win = this.doc.createElement("div");
    win.className = "sahne-inset";
    win.hidden = true;
    const ring = this.doc.createElement("div");
    ring.className = "sahne-inset-in";
    this.art = this.doc.createElement("div");
    this.art.className = "sahne-inset-art";
    ring.append(this.art);
    win.append(ring);
    this.el.prepend(win);
    return win;
  }

  /** The window shows while it has content or a narrator bubble is up. */
  private syncWindow() {
    const want = !!this.insetO || this.talking !== null;
    if (!want && !this.win) return;
    const win = this.window();
    if (want) {
      clearTimeout(this.winTimer);
      if (this.talking !== null && win.dataset.talking === undefined) win.dataset.talking = "";
      if (!this.winShown) {
        this.winShown = true;
        win.classList.remove("sahne-out");
        if (win.hidden) { win.hidden = false; win.classList.add("sahne-wait"); this.winPlaced = false; }
      }
    } else if (this.winShown) {
      this.winShown = false;
      win.classList.add("sahne-out");
      this.winTimer = setTimeout(() => {
        win.hidden = true;
        win.classList.remove("sahne-out");
        if (!this.insetO) this.art?.replaceChildren();
      }, OUT + 40);
    }
  }
}
