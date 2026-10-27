// The interaction layer (DESIGN.md §9): taps and drags on the stage, the acts, explore, and the
// accessible list. It is attached to a stage, not built into it, so a page that never lets the
// learner act (the avatar builder) does not load it:
//
//   const ix = interact(stage, { explore: true });   // before stage.load, so the atlas gets its alpha masks
//   ix.on("inspect", e => showWord(e.terms));
//   const run = stage.play(i);                        // an act cue: an ActRun
//   const r = await run.result;                       // { target, misses, hinted, shown, … }
//
// Hit tests use the quads the last frame drew and the atlas's alpha masks (interact/hit.ts); the
// act's rules are the pure state machine in interact/act.ts. Rings are HTML over the stage, and
// every act and explore has a list of buttons for keyboards and screen readers.

import type { Vec3 } from "../core/math.ts";
import type { Act, ActCue, Target } from "../script/types.ts";
import { inState, type PropState, type World } from "../script/world.ts";
import type { Run, Stage } from "../stage.ts";
import { heldKey } from "../stage.ts";
import { AlphaMasks, isTarget, partOf, pickTop, rayAt, rayZ, type Hit, type Pick, type Ray } from "./hit.ts";
import { dragged, inspectOf, nameOf, propOf, resolvedCue, skipAct, startAct, targetOf, tryAct, type ActState, type InspectEvent, type Outcome, type SceneInfo } from "./act.ts";
export type { InspectEvent };
import { INTERACT_CSS } from "../ui/interact-css.ts";

export interface InteractWords {
  /** The explore list's label. */
  explore: string;
  /** An act's label when it has no prompt. */
  act: string;
  /** Announced with the hint, and with the answer shown. */
  hint: (name: string) => string;
  shown: (name: string) => string;
  /** A drag's button: the thing and where it goes. */
  drag: (what: string, to: string) => string;
}

export const INTERACT_WORDS: InteractWords = {
  explore: "On stage", act: "Your turn",
  hint: n => `Look: ${n}`, shown: n => `It is ${n}`, drag: (w, t) => `${w} → ${t}`,
};

export interface InteractOptions {
  /** Taps on a person or a prop raise `inspect` (off by default: each story week turns it on). */
  explore?: boolean;
  /** The accessible list: "auto" (default) is hidden until the keyboard reaches it; "always" shows it. */
  list?: "auto" | "always";
  /** Move focus to the list when an act starts: "auto" (default) only when focus is on the stage already. */
  focus?: "auto" | "always" | "never";
  words?: Partial<InteractWords>;
}

export interface ActResult {
  /** The cue (−1 for `request`). */
  cue: number;
  kind: Act["kind"];
  /** The accepted target: the learner's, or the answer shown after the third miss. */
  target: Target | null;
  expect?: Target;
  misses: number;
  hinted: boolean;
  shown: boolean;
  tries: Target[];
  via: "pointer" | "list" | "skip";
}

export interface ActEvent {
  phase: "ask" | "miss" | "hint" | "show" | "done";
  cue: number;
  act: Act;
  /** The try (miss, hint, show) or the result (done). */
  target?: Target | null;
  misses: number;
  result?: ActResult;
}

/** A performance that waits for the learner: `result` resolves when the act is answered, `done` when the answer has been performed. */
export interface ActRun extends Run {
  readonly act: Act;
  readonly result: Promise<ActResult>;
  /** The targets with their names, as the accessible list shows them. */
  readonly options: { target: Target; label: string }[];
  /** Answer as the learner would (an app's own control). */
  answer(t: Target): void;
  /** Move on: the answer is shown and the act completes with it (`shown`, via "skip"). */
  skip(): void;
}

type Events = { inspect: InspectEvent; act: ActEvent };
type Ring = { el: HTMLElement; target: Target; kind: string };

/** Pointer slack, CSS pixels: a tap this close to a target counts as on it (fingers are wide). */
const SLACK = { touch: 26, pen: 14, mouse: 8 } as Record<string, number>;
/** Movement that turns a press into a drag, CSS pixels. */
const MOVE = 8;
/** How long a shown answer stays before the act completes (ms). */
const SHOW_MS = 1100;

interface Current {
  cue: ActCue; i: number; scripted: boolean; w: World;
  s: ActState; inner: Run;
  resolve: (r: ActResult) => void; done: () => void;
  run: ActRun; prev: Element | null;
  closing: boolean;
}

export class Interaction {
  readonly stage: Stage;
  readonly el: HTMLDivElement;
  explore: boolean;
  private o: InteractOptions;
  private words: InteractWords;
  private list: HTMLDivElement;
  private live: HTMLDivElement;
  private rings: Ring[] = [];
  private fns: { [K in keyof Events]: Set<(e: Events[K]) => void> } = { inspect: new Set(), act: new Set() };
  private cur: Current | null = null;
  private ptr: { id: number; x0: number; y0: number; type: string; drag: { id: string; z: number; off: Vec3 } | null; moved: boolean } | null = null;
  private listKey = "";
  private offFrame: () => void;
  private canvas: HTMLCanvasElement;
  /** The alpha masks of the stage's atlas, made as it is drawn. */
  readonly masks = new AlphaMasks();

  constructor(stage: Stage, o: InteractOptions = {}) {
    this.stage = stage; this.o = o; this.explore = !!o.explore;
    this.words = { ...INTERACT_WORDS, ...o.words };
    const doc = stage.el.ownerDocument;
    if (!doc.getElementById("sahne-ix-css")) doc.head.append(Object.assign(doc.createElement("style"), { id: "sahne-ix-css", textContent: INTERACT_CSS }));
    if (getComputedStyle(stage.el).position === "static") stage.el.style.position = "relative";
    this.el = doc.createElement("div"); this.el.className = "sahne-ix";
    this.list = doc.createElement("div"); this.list.className = "sahne-ix-list" + (o.list === "always" ? "" : " sahne-ix-auto"); this.list.setAttribute("role", "group"); this.list.tabIndex = -1;
    this.live = doc.createElement("div"); this.live.className = "sahne-ix-sr"; this.live.setAttribute("aria-live", "polite");
    this.el.append(this.list, this.live);
    stage.el.append(this.el);
    stage.pickable = true; stage.atlasHook = this.masks;
    stage.interaction = this;
    this.canvas = stage.canvas;
    this.canvas.addEventListener("pointerdown", this.down);
    this.canvas.addEventListener("pointermove", this.move);
    this.canvas.addEventListener("pointerup", this.up);
    this.canvas.addEventListener("pointercancel", this.cancel);
    this.offFrame = stage.onFrame(() => this.layout());
  }

  on<K extends keyof Events>(type: K, fn: (e: Events[K]) => void): () => void {
    this.fns[type].add(fn);
    return () => this.fns[type].delete(fn);
  }

  private emit<K extends keyof Events>(type: K, e: Events[K]) { for (const fn of this.fns[type]) fn(e); }

  /** Turn explore on or off (a week's mechanics). */
  setExplore(on: boolean) { this.explore = on; this.listKey = ""; this.syncList(); }

  /** Show the accessible list always, or only when the keyboard reaches it. */
  setList(mode: "auto" | "always") { this.o.list = mode; this.list.classList.toggle("sahne-ix-auto", mode !== "always"); }

  /** Move focus into the list (its first button). */
  focus() { (this.list.querySelector("button:not([disabled])") as HTMLElement | null ?? this.list).focus(); }

  /** The act waiting for the learner, if any. */
  get active(): ActRun | null { return this.cur?.run ?? null; }

  // ---- Acts ----------------------------------------------------------------------------------

  /** Play act cue `i` of the stage's script (Stage.play calls this for an act with no answer yet). */
  play(i: number): ActRun {
    const c = this.stage.script.cues[i];
    if (!c || !("act" in c)) throw new Error(`sahne: cue ${i} is not an act`);
    return this.begin(c, i, true);
  }

  /** An act that is not in the script, from the world on stage now: its answer is performed but not written into the script. */
  request(act: Act): ActRun { return this.begin({ act }, -1, false); }

  private begin(cue: ActCue, i: number, scripted: boolean): ActRun {
    if (this.cur) this.close(this.cur, skipAct(this.cur.cue.act, this.cur.s), "skip");
    const st = this.stage;
    const w = scripted && i > 0 ? st.perfs[i - 1]?.after ?? st.world() : st.world();
    // the ask: only the framing (the answer is performed once there is one)
    const ask = st.direct({ act: { ...cue.act, expect: undefined, result: undefined } }, w, scripted ? i : w.i + 1);
    let resolve!: (r: ActResult) => void, done!: () => void;
    const result = new Promise<ActResult>(r => { resolve = r; });
    const finished = new Promise<void>(r => { done = r; });
    const self = this;
    const cur: Current = {
      cue, i, scripted, w, s: startAct(), inner: st.perform(ask), resolve, done, prev: st.el.ownerDocument.activeElement, closing: false,
      run: {
        cue: i, act: cue.act, result, done: finished,
        get dur() { return cur.inner.dur; }, get t() { return cur.inner.t; },
        get options() { return self.options(cue.act); },
        finish: () => cur.inner.finish(), seek: (t: number) => cur.inner.seek(t), pause: () => cur.inner.pause(), resume: () => cur.inner.resume(),
        answer: (t: Target) => { if (self.cur === cur) self.attempt(t, "list"); },
        skip: () => { if (self.cur === cur && !cur.s.result) self.close(cur, skipAct(cue.act, cur.s), "skip"); },
      },
    };
    this.cur = cur;
    this.canvas.style.touchAction = cue.act.kind === "drag" ? "none" : "manipulation";
    this.clearRings();
    const a = cue.act;
    // where to go is invisible on the floor, so marks always show; a choice shows its two things
    if (a.kind === "go") for (const t of a.targets) this.ring(t, "spot");
    if (a.kind === "choose") for (const t of a.targets) this.ring(t, "pick");
    if (a.kind === "drag") { const id = dragged(a); if (id) this.ring("obj:" + id, "pick"); }
    this.listKey = ""; this.syncList();
    this.say(a.prompt ?? "");
    const f = this.o.focus ?? "auto";
    if (f === "always" || (f === "auto" && st.el.contains(cur.prev))) this.focus();
    this.emit("act", { phase: "ask", cue: i, act: a, misses: 0 });
    return cur.run;
  }

  /** A try at the act waiting: a hit on stage or a button of the list. */
  private attempt(t: Target, via: "pointer" | "list"): Outcome {
    const cur = this.cur;
    if (!cur || cur.closing) return "ignore";
    const a = cur.cue.act, { s, out } = tryAct(a, cur.s, t);
    cur.s = s;
    if (out === "ignore") return out;
    const tried = targetOf(a, t);
    if (out === "hit") { this.close(cur, s, via); return out; }
    const expect = a.expect!;
    const others = a.by ? [a.by] : Object.values(this.stage.world().actors).filter(x => x.on && x.id !== a.who).map(x => x.id);
    if (out === "miss") this.ack(tried!);
    if (out === "hint") {
      this.ack(tried!);
      this.ring(expect, "hint");
      this.whenIdle(() => this.stage.glance(others, expect));
      this.say(this.words.hint(this.name(expect)));
    }
    if (out === "show") {
      cur.closing = true;
      this.clearRings("hint");
      this.ring(expect, "show");
      this.whenIdle(() => this.stage.glance(others, expect, a.by));
      this.say(this.words.shown(this.name(expect)));
      this.syncList();
      setTimeout(() => { if (this.cur === cur) this.close(cur, s, via); }, SHOW_MS);
    }
    this.emit("act", { phase: out, cue: cur.i, act: a, target: tried, misses: s.misses });
    return out;
  }

  /** The act is answered: write the answer in, perform it, and let the app know. */
  private close(cur: Current, s: ActState, via: ActResult["via"]) {
    const st = this.stage, a = cur.cue.act;
    cur.s = s;
    if (this.cur === cur) this.cur = null;
    const res: ActResult = { cue: cur.i, kind: a.kind, target: s.result, expect: a.expect, misses: s.misses, hinted: s.hinted, shown: s.shown, tries: s.tries, via };
    const cue = resolvedCue(cur.cue, s.result);
    if (cur.scripted) {
      st.setCues(cur.i, [cue, ...st.script.cues.slice(cur.i + 1)]);
      cur.inner = st.perform(st.perfs[cur.i]);
    } else cur.inner = st.perform(st.direct(cue, cur.w, cur.w.i + 1));
    cur.inner.done.then(cur.done);
    this.clearRings();
    this.canvas.style.touchAction = "manipulation";
    // focus goes back where it was (or stays in the list) when the act was answered from the list
    const doc = st.el.ownerDocument, inList = this.list.contains(doc.activeElement);
    this.listKey = ""; this.syncList();
    if (inList) {
      const p = cur.prev as HTMLElement | null;
      if (p && p.isConnected && !this.list.contains(p) && p !== doc.body) p.focus();
      else if (this.list.querySelector("button")) this.focus();
      // nothing left to focus in the list: the stage itself keeps focus, so the next Tab goes on from here
      else { if (!st.el.hasAttribute("tabindex")) st.el.tabIndex = -1; st.el.focus(); }
    }
    cur.resolve(res);
    this.emit("act", { phase: "done", cue: cur.i, act: a, target: s.result, misses: s.misses, result: res });
  }

  /** Run `fn` once the stage is not performing (a hint never cuts a line short). */
  private whenIdle(fn: () => void) {
    const st = this.stage, go = () => { if (!st.perf || st.now() >= st.perf.dur) fn(); else setTimeout(go, 120); };
    go();
  }

  /** The act's targets with their names. */
  options(a: Act): { target: Target; label: string }[] {
    const id = a.kind === "drag" ? dragged(a) : undefined;
    return a.targets.filter(t => !(id && t === "obj:" + id)).map(t => ({ target: t, label: id ? this.words.drag(this.name("obj:" + id), this.name(t)) : this.name(t) }));
  }

  // ---- Names and explore ---------------------------------------------------------------------

  /** A target's name: the app's (`LoadOptions.names`, by actor id or by target), else the place's, else its id. */
  name(t: Target): string { return nameOf(t, this.scene()); }

  private scene(): SceneInfo {
    const st = this.stage;
    return { names: st.names, terms: st.terms, place: st.place, props: st.frame?.props ?? st.world().props };
  }

  private prop(id: string): PropState | undefined { return propOf(this.scene().props, id); }

  /** What `inspect` says about a target. */
  inspectOf(t: Target, via: "pointer" | "list", x?: number, y?: number): InspectEvent | null { return inspectOf(t, this.scene(), via, x, y); }

  private inspect(t: Target, via: "pointer" | "list", x?: number, y?: number) {
    const e = this.inspectOf(t, via, x, y);
    if (!e) return;
    this.ack(e.kind === "actor" ? "ch:" + e.id : t);
    this.say(e.name ?? "");
    this.emit("inspect", e);
  }

  // ---- Hit tests -----------------------------------------------------------------------------

  /** The ray from the camera through a point of the stage, in CSS pixels. */
  ray(x: number, y: number): Ray {
    const st = this.stage, [w, h] = st.cssSize;
    return rayAt(st.cam, st.aspect, x / w * 2 - 1, 1 - y / h * 2);
  }

  /** The topmost person, prop or piece drawn at a point of the stage (CSS pixels) in the last frame; transparent corners pass through. */
  hitAt(x: number, y: number, skip?: (p: Pick) => boolean): Hit | null {
    return pickTop(this.stage.picks, this.ray(x, y), (p, s, v) => !p.rect || this.masks.paper(p.rect, s, v), skip);
  }

  // ---- Pointer -------------------------------------------------------------------------------

  private xy(e: PointerEvent): [number, number] { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  private down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button > 0) return;
    const [x, y] = this.xy(e), a = this.cur?.cue.act;
    this.ptr = { id: e.pointerId, x0: x, y0: y, type: e.pointerType, drag: null, moved: false };
    if (!a || a.kind !== "drag" || this.cur!.closing) return;
    const id = dragged(a), want = "obj:" + id, p = id ? this.prop(id) : undefined;
    if (!p || !this.near(x, y, [want], e.pointerType)) return;
    const st = this.stage, f = st.frame;
    const c = f ? st.point("obj:" + p.id, f) : null, ray = this.ray(x, y);
    const z = (p.at ?? c)?.[2] ?? 0, q = rayZ(ray, z);
    if (!q) return;
    // lying: hold it where it was grabbed; in a hand: by its base
    const at0 = p.at ?? (c ? [c[0], c[1] - 0.1, c[2]] as Vec3 : q);
    this.ptr.drag = { id: p.id, z, off: [q[0] - at0[0], q[1] - at0[1], 0] };
    st.held = { id: p.id, at: at0, from: heldKey(p) };
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  private move = (e: PointerEvent) => {
    const P = this.ptr;
    if (!P || P.id !== e.pointerId) return;
    const [x, y] = this.xy(e);
    if (Math.hypot(x - P.x0, y - P.y0) > MOVE) P.moved = true;
    if (!P.drag) return;
    const q = rayZ(this.ray(x, y), P.drag.z), st = this.stage;
    if (q && st.held) { st.held = { ...st.held, at: [q[0] - P.drag.off[0], q[1] - P.drag.off[1], P.drag.z] }; st.poke(); }
    // the person or mark it would land on
    const a = this.cur?.cue.act, t = a ? this.dropAt(x, y, P.type) : null;
    this.clearRings("drop");
    if (t) this.ring(t, "drop");
  };

  private up = (e: PointerEvent) => {
    const P = this.ptr;
    if (!P || P.id !== e.pointerId) return;
    this.ptr = null;
    const [x, y] = this.xy(e), cur = this.cur, a = cur?.cue.act;
    if (P.drag) {
      this.clearRings("drop");
      const t = P.moved && a ? this.dropAt(x, y, P.type) : null;
      const out = t ? this.attempt(t, "pointer") : "ignore";
      // a drop that is not taken (nowhere, or a miss) puts the thing back
      if (out !== "hit") { this.stage.held = null; this.stage.poke(); }
      return;
    }
    if (P.moved) return;
    if (a && !cur!.closing && a.kind !== "drag") {
      const t = this.near(x, y, a.targets, P.type);
      if (t) { this.attempt(t, "pointer"); return; }
    }
    if (this.explore) {
      // a person or a thing under the finger, or one within its slack (a loaf is a few pixels on a phone), else a piece
      const hit = this.hitAt(x, y), f = this.stage.frame;
      const things = f ? [...Object.values(f.actors).filter(a => a.on).map(a => "ch:" + a.id), ...Object.values(f.props).filter(p => p.shown && inState(p.in, f.state.to)).map(p => "obj:" + p.id)] : [];
      const t = hit && !hit.target.startsWith("piece:") ? hit.target : this.near(x, y, things, P.type) ?? hit?.target;
      // an animal that answers a tap (FlatReact.tap): it flutters or looks up, whether or not it has words
      if (hit?.poke) this.stage.tapFlat(hit.poke, hit.p);
      if (t) this.inspect(t, "pointer", x, y);
    }
  };

  private cancel = (e: PointerEvent) => {
    if (this.ptr?.id !== e.pointerId) return;
    if (this.ptr.drag) { this.stage.held = null; this.stage.poke(); this.clearRings("drop"); }
    this.ptr = null;
  };

  /** Where a dragged thing would land: one of the act's targets other than itself. */
  private dropAt(x: number, y: number, type: string): Target | null {
    const a = this.cur?.cue.act;
    if (!a) return null;
    const id = dragged(a), held = this.stage.held?.id;
    return this.near(x, y, a.targets.filter(t => t !== "obj:" + id), type, p => !!held && p.target === "obj:" + held, true);
  }

  /**
   * Which of `targets` is at a point: the topmost thing drawn there if it is one of them, else the
   * nearest that shows within a finger's slack (`SLACK`; less of it over another person or thing).
   * Marks are found by their ring on the floor. A drop (`loose`) takes the nearest box whatever is
   * drawn over it, so the milk lands on İsmail even over the bread on his counter.
   */
  private near(x: number, y: number, targets: Target[], type: string, skip?: (p: Pick) => boolean, loose = false): Target | null {
    const slack = SLACK[type] ?? SLACK.mouse;
    const hit = this.hitAt(x, y, skip), things = targets.filter(t => !t.startsWith("mark:"));
    const direct = hit ? things.find(t => isTarget(t, hit.target)) : undefined;
    if (direct) return direct;
    let best: Target | null = null, bd = Infinity;
    if (loose) {
      // a drop: the nearest box, whatever is drawn over it
      for (const t of things) { const b = this.box(t, skip); const d = b ? boxDist(b, x, y) : Infinity; if (d < bd) { bd = d; best = t; } }
      if (bd > slack) { best = null; bd = Infinity; }
    } else {
      // a tap: look around it, nearest first, for one of them that shows there (over someone or
      // something else, only close by: a loaf in front of İsmail's apron is a few pixels on a phone)
      search: for (const k of !hit || hit.target.startsWith("piece:") ? [0.35, 0.7, 1] : [0.35, 0.7]) for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4, h = this.hitAt(x + Math.cos(a) * slack * k, y + Math.sin(a) * slack * k, skip);
        const t = h ? things.find(t => isTarget(t, h.target)) : undefined;
        if (t) { best = t; bd = slack * k; break search; }
      }
    }
    // a mark: within its ring on the floor
    for (const t of targets.filter(t => t.startsWith("mark:"))) {
      const b = this.box(t);
      if (b && boxDist(b, x, y) <= slack && boxDist(b, x, y) < (best ? bd : Infinity)) { best = t; bd = boxDist(b, x, y); }
    }
    return best;
  }

  /** A target's box on screen (CSS pixels): the quads drawn for it in the last frame, or a mark's ring on the floor. */
  private box(t: Target, skip?: (p: Pick) => boolean): [number, number, number, number] | null {
    const st = this.stage;
    if (t.startsWith("mark:")) {
      const m = st.place?.marks[t.slice(5)];
      const c = m ? st.project([m.x, 0, m.z]) : null, e = m ? st.project([m.x + 0.38, 0, m.z]) : null;
      if (!c || !e) return null;
      const rx = Math.max(22, Math.abs(e[0] - c[0])), ry = Math.max(14, rx * 0.4);
      return [c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry];
    }
    let b: [number, number, number, number] | null = null;
    for (const p of st.picks) {
      if (!isTarget(t, p.bone ? p.target + "." + partOf(p.bone) : p.target) || skip?.(p)) continue;
      for (const v of p.c) {
        const q = st.project(v);
        if (!q) continue;
        b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])] : [q[0], q[1], q[0], q[1]];
      }
    }
    return b;
  }

  // ---- Rings, the list, the live region ---------------------------------------------------------

  private ring(t: Target, kind: string) {
    const doc = this.stage.el.ownerDocument;
    const el = doc.createElement(kind === "spot" ? "button" : "div");
    el.className = `sahne-ix-ring ${kind}`;
    if (kind === "spot") {
      (el as HTMLButtonElement).type = "button"; el.tabIndex = -1; el.setAttribute("aria-label", this.name(t));
      el.addEventListener("click", () => this.attempt(t, "pointer"));
    }
    const r = { el, target: t, kind };
    this.rings.push(r);
    this.el.prepend(el);
    this.place(r);
    requestAnimationFrame(() => el.classList.add("on"));
    if (kind === "ack") setTimeout(() => this.drop(r), 750);
  }

  /** A gentle sign that a tap landed: a ring that opens and fades. */
  private ack(t: Target) { this.ring(t.startsWith("ch:") ? t.split(".")[0] : t, "ack"); }

  private drop(r: Ring) { r.el.remove(); this.rings = this.rings.filter(x => x !== r); }

  private clearRings(kind?: string) { for (const r of [...this.rings]) if (!kind || r.kind === kind) this.drop(r); }

  private place(r: Ring) {
    const b = this.box(r.target);
    if (!b) { r.el.style.visibility = "hidden"; return; }
    const pad = r.target.startsWith("mark:") ? 0 : 8, w = b[2] - b[0] + pad * 2, h = b[3] - b[1] + pad * 2;
    r.el.style.visibility = "";
    r.el.style.width = w + "px"; r.el.style.height = h + "px";
    r.el.style.translate = `${b[0] - pad}px ${b[1] - pad}px`;
  }

  /** After each frame: rings follow the camera and the actors; the explore list follows who and what is on stage. */
  private layout() {
    this.el.classList.toggle("sahne-still", this.stage.motion === "still");
    for (const r of this.rings) this.place(r);
    this.syncList();
  }

  private syncList() {
    const cur = this.cur, a = cur?.cue.act;
    let items: { target: Target; label: string }[] = [], label = "";
    if (a) { items = this.options(a); label = a.prompt ?? this.words.act; }
    else if (this.explore) {
      const f = this.stage.frame;
      if (f) {
        for (const x of Object.values(f.actors)) if (x.on) items.push({ target: "ch:" + x.id, label: this.name("ch:" + x.id) });
        // the props of the place's current states (a held one always)
        for (const p of Object.values(f.props)) if (p.shown && (p.at || p.holder) && (p.holder || inState(p.in, f.state.to))) items.push({ target: "obj:" + p.id, label: this.name("obj:" + p.id) });
      }
      label = this.words.explore;
    }
    const key = label + "|" + (cur?.closing ? "x" : "") + items.map(i => i.target + "=" + i.label).join(",");
    if (key === this.listKey) return;
    const had = this.list.contains(this.stage.el.ownerDocument.activeElement), idx = [...this.list.querySelectorAll("button")].indexOf(this.stage.el.ownerDocument.activeElement as HTMLButtonElement);
    this.listKey = key;
    const doc = this.stage.el.ownerDocument;
    this.list.replaceChildren();
    this.list.setAttribute("aria-label", label);
    if (!items.length) return;
    this.list.append(Object.assign(doc.createElement("p"), { className: "sahne-ix-q", textContent: label }));
    for (const it of items) {
      const b = doc.createElement("button");
      b.type = "button"; b.textContent = it.label; b.dataset.target = it.target;
      if (a) { b.disabled = !!cur!.closing; b.onclick = () => this.attempt(it.target, "list"); }
      else b.onclick = () => this.inspect(it.target, "list");
      this.list.append(b);
    }
    if (had) (this.list.querySelectorAll("button")[Math.max(0, idx)] as HTMLElement | undefined ?? this.list).focus();
  }

  private say(text: string) { this.live.textContent = ""; if (text) setTimeout(() => { this.live.textContent = text; }, 30); }

  destroy() {
    // an act still waiting ends with its answer shown, but nothing more is performed
    const cur = this.cur;
    if (cur) {
      this.cur = null;
      const s = skipAct(cur.cue.act, cur.s), a = cur.cue.act;
      cur.resolve({ cue: cur.i, kind: a.kind, target: s.result, expect: a.expect, misses: s.misses, hinted: s.hinted, shown: s.shown, tries: s.tries, via: "skip" });
      cur.done();
    }
    this.offFrame();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.el.remove();
    if (this.stage.interaction === this) this.stage.interaction = null;
    this.stage.pickable = false; this.stage.picks = []; this.stage.held = null;
    if (this.stage.atlasHook === this.masks) this.stage.atlasHook = null;
    this.masks.dispose();
  }
}

const boxDist = (b: [number, number, number, number], x: number, y: number) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));

/** Attach the interaction layer to a stage (before `load`, so its atlas gets the alpha masks). */
export function interact(stage: Stage, o: InteractOptions = {}): Interaction { return new Interaction(stage, o); }
