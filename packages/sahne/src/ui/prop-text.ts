// Prop text (DESIGN.md §6.8): the words on a sign, a label, a phone's screen, as real HTML laid on
// the paper plane the stage drew them on. It is attached to a stage like the interaction layer, so a
// page without props (the avatar builder) never loads it:
//
//   const pt = propText(stage);   // any time; it follows `stage.texts` after every frame
//   pt.destroy();
//
// Each box is laid out flat at about the size it shows (k CSS px per cm, in √2 steps), shrunk to fit,
// and put on its plane by the camera's exact plane-to-screen `matrix3d` (`flatMatrix`). Hidden behind
// the near plane, from behind, off screen, while the GPU is away, and faded out when an actor nearer
// the camera covers a quarter of it. Taps go through to the stage.

import { lookAt, mat4Mul, perspective, type Vec3 } from "../core/math.ts";
import type { TextSpec } from "../core/kit.ts";
import { NEAR, FAR } from "../render/paper/camera.ts";
import { nameOf } from "../interact/act.ts";
import type { Stage } from "../stage.ts";
import { PROP_TEXT_CSS } from "./prop-text-css.ts";

type V4 = [number, number, number, number];
type Pt = [number, number];
/** Where a flat was drawn: its origin, and metres per cm along its right and down axes (`Stage.texts`). */
export interface FlatAt { O: Vec3; R: Vec3; D: Vec3 }

/** The clip coordinates of v (w = 1: a point; 0: a direction). */
const clip = (vp: ArrayLike<number>, v: Vec3, w: number): V4 => [0, 1, 2, 3].map(r => vp[r] * v[0] + vp[4 + r] * v[1] + vp[8 + r] * v[2] + vp[12 + r] * w) as V4;

/**
 * A text box's plane in clip space (T its top-left corner, U and V per cm right and down) and its
 * corners on screen in CSS px (top left, top right, bottom right, bottom left; y down); null when a
 * corner is nearer than the near plane, or the box is seen from behind (mirrored on screen).
 */
export function textQuad(vp: ArrayLike<number>, css: Pt, f: FlatAt, t: TextSpec): { U: V4; V: V4; T: V4; pts: Pt[] } | null {
  const { O, R, D } = f, Q: Vec3 = [O[0] + R[0] * t.x + D[0] * t.y, O[1] + R[1] * t.x + D[1] * t.y, O[2] + R[2] * t.x + D[2] * t.y];
  const U = clip(vp, R, 0), V = clip(vp, D, 0), T = clip(vp, Q, 1), hw = css[0] / 2, hh = css[1] / 2, pts: Pt[] = [];
  for (const [x, y] of [[0, 0], [t.w, 0], [t.w, t.h], [0, t.h]]) {
    const w = T[3] + U[3] * x + V[3] * y;
    if (!(w >= NEAR)) return null;
    pts.push([hw * ((T[0] + U[0] * x + V[0] * y) / w + 1), hh * (1 - (T[1] + U[1] * x + V[1] * y) / w)]);
  }
  // seen from the front, right is right and down is down: (p1 − p0) × (p3 − p0) > 0 with y down
  const [p0, p1, , p3] = pts;
  return (p1[0] - p0[0]) * (p3[1] - p0[1]) - (p1[1] - p0[1]) * (p3[0] - p0[0]) > 0 ? { U, V, T, pts } : null;
}

const num = (v: number) => +v.toPrecision(9);

/** The `matrix3d` taking a box of W = t.w·k by H = t.h·k CSS px (transform-origin 0 0) onto its plane: pixel (X, Y) is world Q + (R/k)X + (D/k)Y, in screen px, normalised by w at the corner. */
function matrixOf(q: { U: V4; V: V4; T: V4 }, css: Pt, k: number): string {
  const { U, V, T } = q, hw = css[0] / 2, hh = css[1] / 2, s = 1 / (k * T[3]), t = 1 / T[3];
  return `matrix3d(${[hw * (U[0] + U[3]) * s, hh * (U[3] - U[1]) * s, 0, U[3] * s, hw * (V[0] + V[3]) * s, hh * (V[3] - V[1]) * s, 0, V[3] * s, 0, 0, 1, 0, hw * (T[0] + T[3]) * t, hh * (T[3] - T[1]) * t, 0, 1].map(num).join()})`;
}

/** The CSS `matrix3d` for a text box on a drawn flat (`vp` column-major, `css` the canvas in CSS px, `k` CSS px per cm of the laid-out box); null behind the near plane or from behind. */
export function flatMatrix(vp: ArrayLike<number>, css: Pt, f: FlatAt, t: TextSpec, k: number): string | null {
  const q = textQuad(vp, css, f, t);
  return q && matrixOf(q, css, k);
}

/** CSS px per cm, in √2 steps, 2…40: the text is laid out near the size it shows, and reflows only now and then. */
const quantise = (raw: number) => Math.min(40, Math.max(2, 2 ** (Math.round(Math.log2(Math.max(raw, 1e-6)) * 2) / 2)));

interface Box {
  el: HTMLDivElement; sr: HTMLSpanElement; txt: HTMLDivElement;
  /** What was written last: the transform, the layout (text, size, font), the name, the stacking. */
  m: string; lay: string; name: string; z: number;
  W: number; H: number; px: number; fitted: boolean;
}

export interface PropText { readonly el: HTMLDivElement; destroy(): void }

class Layer implements PropText {
  readonly el: HTMLDivElement;
  private stage: Stage;
  private boxes = new Map<string, Box>();
  private offFrame: () => void;
  private onLost = () => { this.el.hidden = true; };
  private onFonts = () => { for (const b of this.boxes.values()) { b.fitted = false; if (!b.el.hidden) this.fit(b); } };

  constructor(stage: Stage) {
    this.stage = stage;
    const doc = stage.el.ownerDocument;
    if (!doc.getElementById("sahne-pt-css")) doc.head.append(Object.assign(doc.createElement("style"), { id: "sahne-pt-css", textContent: PROP_TEXT_CSS }));
    this.place();
    this.el = doc.createElement("div"); this.el.className = "sahne-pt";
    // first, so the bubbles and the interaction layer stay above it
    stage.el.prepend(this.el);
    stage.canvas.addEventListener("webglcontextlost", this.onLost);
    doc.fonts?.addEventListener("loadingdone", this.onFonts);
    this.offFrame = stage.onFrame(() => this.frame());
  }

  /** The layer is laid over the stage, so the stage must be its containing block. A stage not yet in the page has no computed style: it is asked again on its frames until it is. */
  private placed = false;
  private place() {
    if (this.placed || !this.stage.el.isConnected) return;
    if (getComputedStyle(this.stage.el).position === "static") this.stage.el.style.position = "relative";
    this.placed = true;
  }

  private make(key: string): Box {
    const doc = this.el.ownerDocument, el = doc.createElement("div"), sr = doc.createElement("span"), txt = doc.createElement("div");
    sr.className = "sahne-pt-sr"; txt.className = "sahne-pt-t";
    el.append(sr, txt); this.el.append(el);
    const b: Box = { el, sr, txt, m: "", lay: "", name: "", z: -1, W: 0, H: 0, px: 0, fitted: false };
    this.boxes.set(key, b);
    return b;
  }

  /** Shrink the font (×0.88, down to 0.35) until the text fits its box, words unbroken where they can be. */
  private fit(b: Box) {
    b.txt.style.overflowWrap = "normal";
    for (let fit = 1; ; fit = Math.max(0.35, fit * 0.88)) {
      b.el.style.fontSize = b.px * fit + "px";
      if (fit <= 0.35 || (b.txt.scrollHeight <= b.H + 0.5 && b.txt.scrollWidth <= b.W + 0.5)) break;
    }
    b.txt.style.overflowWrap = "";
    b.fitted = true;
  }

  private frame() {
    const st = this.stage, f = st.frame;
    if (!f) return;
    this.place();
    this.el.hidden = false;
    this.el.classList.toggle("sahne-still", st.motion === "still");
    const css = st.cssSize, cam = st.cam, vp = mat4Mul(perspective(cam.fov, st.aspect, NEAR, FAR), lookAt(cam.eye, cam.target));
    const seen = new Set<string>(), scene = { names: st.names, terms: st.terms, place: st.place, props: f.props };
    st.texts.forEach((r, i) => {
      for (const t of r.spec.text ?? []) {
        const key = `${r.target}|${t.x}|${t.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const b = this.boxes.get(key) ?? this.make(key), q = textQuad(vp, css, r, t);
        const xs = q?.pts.map(p => p[0]) ?? [], ys = q?.pts.map(p => p[1]) ?? [];
        if (!q || Math.max(...xs) < 0 || Math.min(...xs) > css[0] || Math.max(...ys) < 0 || Math.min(...ys) > css[1]) { b.el.hidden = true; continue; }
        b.el.hidden = false;
        const k = quantise(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) / t.w);
        // the layout: refitted only when the text, its box, its font or k changes
        const lay = [t.text, t.w, t.h, k, t.size, t.font, t.weight, t.align, t.lang].join("|");
        if (b.lay !== lay) {
          b.lay = lay; b.W = t.w * k; b.H = t.h * k; b.px = (t.size ?? t.h * 0.45) * k; b.fitted = false;
          const s = b.el.style;
          s.width = b.W + "px"; s.height = b.H + "px";
          s.fontFamily = t.font ? `var(--sahne-text-${t.font})` : ""; s.fontWeight = t.weight ? String(t.weight) : ""; s.textAlign = t.align ?? "center";
          b.txt.lang = t.lang ?? "tr"; b.txt.textContent = t.text;
        }
        if (!b.fitted) this.fit(b);
        const m = matrixOf(q, css, k);
        if (b.m !== m) b.el.style.transform = b.m = m;
        const name = nameOf(r.target, scene);
        if (b.name !== name) b.sr.textContent = (b.name = name) ? name + ": " : "";
        if (b.z !== i) b.el.style.zIndex = String(b.z = i);
      }
    });
    for (const [key, b] of this.boxes) if (!seen.has(key)) { b.el.remove(); this.boxes.delete(key); }
  }

  destroy() {
    this.offFrame();
    this.stage.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.el.ownerDocument.fonts?.removeEventListener("loadingdone", this.onFonts);
    this.el.remove(); this.boxes.clear();
  }
}

/** Lay the text of the props and set pieces on stage over it as HTML (DESIGN.md §6.8). */
export function propText(stage: Stage): PropText { return new Layer(stage); }
