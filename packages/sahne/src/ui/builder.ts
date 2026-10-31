// The default builder screen (DESIGN.md §10): the headless model (avatar/builder.ts) drawn as a
// warm paper panel with a live preview. Five tabs (Body, Face, Hair, Clothes, Extras); every option
// is a thumbnail of the character wearing it (`portrait` of `builder.preview`), drawn in time slices
// so no task runs long; colours are paper discs, patterns and sides are small choices. The preview
// is the paper stage's studio (idle life, a tap plays a gesture, the emotion strip, the turn
// button, the framing follows the tab) or, without WebGL2, the still portrait redrawn on every change.
//
// Generic engine code: the words come from the kit's labels and the screen's own (builder-plan.ts),
// what is offered and unlocked from the host. No network, no storage. A learner sees the host's
// `offer` (a starter set) and the kit's open and locked parts; an author (`mode: "author"`) sees
// every part, the cast's own marked, and may keep hex colours and custom parts.

import type { Kit } from "../core/kit.ts";
import type { AvatarDoc, Build, WearSide } from "../core/types.ts";
import { createBuilder, type Builder, type BuilderOptions, type FieldInfo, type Option } from "../avatar/builder.ts";
import { serialize } from "../avatar/normalize.ts";
import { at, isObj } from "../avatar/rules.ts";
import { portrait } from "../render/still/portrait.ts";
import type { Framing } from "../render/paper/camera.ts";
import { mountStage, type Stage, type Motion, type Backdrop } from "../stage.ts";
import { BUILDER_CSS } from "./builder-css.ts";
import { uiWords, fill, fieldFraming, sectionFraming, emotionStrip, tapGestures, tagFilters, passes, colourSlots, withMark, roving, type UiWords } from "./builder-plan.ts";

export interface BuilderUIOptions {
  kit: Kit;
  /** The starting document (anything: it is normalized; nothing usable starts from the kit's default). */
  doc?: unknown;
  /** `learner` (default): the kit's learner parts, narrowed by `offer`. `author`: every part, the cast's included, and a trusted document. */
  mode?: "learner" | "author";
  /** The unlock tokens the learner has (`PartDef.unlock`, palette and pattern unlocks). */
  unlocked?: Iterable<string>;
  /** What a learner is offered (a starter set): the rest is absent, not locked. See `BuilderOptions.offer`. */
  offer?: BuilderOptions["offer"];
  /** Show a "More" button on a field whose options `offer` holds back (default false). */
  more?: boolean;
  /** The builds the learner may pick. */
  builds?: Build[];
  /** Language of the labels: the kit's labels and the screen's own words (`en`, `tr`; others fall back to English). */
  lang?: string;
  /** How a locked option is earned, from its token ("Finish week 3"). Default: a generic "not unlocked yet". */
  unlockLabel?: (token: string) => string;
  /** The host's own words over the screen's. */
  words?: Partial<UiWords>;
  /** `auto` (default) follows the system. */
  theme?: "auto" | "light" | "dark";
  /** The preview's motion (DESIGN.md §7). Default: still under reduced motion, else full. */
  motion?: Motion;
  /** `still` always shows the SVG portrait, never a WebGL stage (default `stage`, which falls back by itself). */
  preview?: "stage" | "still";
  /** What stands behind the character on the stage (default `wall`). */
  backdrop?: Backdrop;
  /** The first tab (default `body`). */
  section?: string;
  /** A seed for each press of the dice (default random). */
  seed?: () => number | string;
  onChange?(doc: AvatarDoc): void;
  onDone?(doc: AvatarDoc): void;
  onCancel?(): void;
  /**
   * Asked before Cancel and Start over throw work away, when there is some (the host shows its own
   * confirmation and answers); without it they act at once. Start over stays undoable either way.
   */
  confirm?(action: "cancel" | "reset", doc: AvatarDoc): boolean | Promise<boolean>;
}

export interface BuilderUI {
  readonly el: HTMLElement;
  readonly builder: Builder;
  readonly doc: AvatarDoc;
  /** The live preview, or null while the still portrait stands in (no WebGL2, or `preview: "still"`). */
  readonly stage: Stage | null;
  readonly section: string;
  setSection(id: string): void;
  setLang(lang: string): void;
  setUnlocked(ids: Iterable<string>): void;
  setTheme(theme: "auto" | "light" | "dark"): void;
  setMotion(m: Motion): void;
  destroy(): void;
}

const STYLE_ID = "sahne-builder-css";
const SVG = "http://www.w3.org/2000/svg";
/** A slice of thumbnail drawing, ms: well under the 50 ms of a long task (DESIGN.md §12). */
const SLICE = 10;
const ICONS: Record<string, string> = {
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3",
  redo: "m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h3",
  dice: "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  turn: "M7 7.5C4.6 8.4 3 9.6 3 11c0 2.8 4 5 9 5s9-2.2 9-5c0-1.4-1.6-2.6-4-3.5M12 16l-2.5-2.5M12 16l-2.5 2.5M12 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
};
const LOCK = "M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z";
let serial = 0;

/** A small DOM helper: a tag with classes, attributes and children. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== false) el.setAttribute(k === "cls" ? "class" : k, v === true ? "" : v);
  for (const c of kids) if (c !== null) el.append(c);
  return el;
}
function icon(d: string): SVGSVGElement {
  const s = document.createElementNS(SVG, "svg"), p = document.createElementNS(SVG, "path");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); p.setAttribute("d", d);
  s.append(p);
  return s;
}
const lockIcon = () => { const s = icon(LOCK); s.style.stroke = "none"; return h("span", { cls: "sahne-bld-lock", "aria-hidden": "true" }, s); };

/** Mount the builder screen in `host` (which should have a height: the panel scrolls inside it). */
export function mountBuilder(host: HTMLElement, o: BuilderUIOptions): BuilderUI {
  const { kit } = o, author = o.mode === "author", uid = `sb${++serial}`;
  const doc0 = host.ownerDocument;
  if (!doc0.getElementById(STYLE_ID)) doc0.head.append(Object.assign(doc0.createElement("style"), { id: STYLE_ID, textContent: BUILDER_CSS }));

  let unlocked = new Set(o.unlocked ?? []), lang = o.lang ?? "en", words = uiWords(lang, o.words);
  const builder = createBuilder(kit, o.doc, {
    unlocked: t => unlocked.has(t), builds: o.builds, lang, trusted: author, cast: author, offer: author ? undefined : o.offer,
  });
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motion: Motion = o.motion ?? (reduced ? "still" : "full"), theme = o.theme ?? "auto";
  let section = builder.sections().some(s => s.id === o.section) ? o.section! : "body";
  let framing: Framing = sectionFraming(section), mood = "neutral", back = false, taps = 0, sid = "me";
  /** Per field: the colour slot being edited and the tag filter. */
  const slotOf = new Map<string, number>(), tagOf = new Map<string, string | null>(), notes = new Map<string, { text: string; warn: boolean }>();
  const kw = (k: string, fb: string) => kit.labels?.[k]?.[lang] ?? fb;
  const unlockText = (t?: string) => (t && o.unlockLabel?.(t)) || words.lockedHow;
  const opts = { trusted: author };

  // ---- the frame -----------------------------------------------------------------------------------
  const root = h("div", { cls: "sahne-bld", role: "group", lang });
  const live = h("div", { cls: "sahne-sr", "aria-live": "polite" });
  const stageHost = h("div", { cls: "sahne-bld-stage" });
  const stillEl = h("div", { cls: "sahne-bld-still", hidden: true });
  const btn = (name: string, cls = "sahne-bld-round") => { const b = h("button", { type: "button", cls, "data-act": name }); b.append(icon(ICONS[name])); return b; };
  const undoB = btn("undo"), redoB = btn("redo"), diceB = btn("dice"), resetB = btn("reset"), turnB = btn("turn", "sahne-bld-round sahne-bld-turn");
  const moodsEl = h("div", { cls: "sahne-bld-moods", role: "radiogroup" });
  const view = h("div", { cls: "sahne-bld-view" }, h("div", { cls: "sahne-bld-pic" }, stageHost, stillEl,
    h("div", { cls: "sahne-bld-tools" }, h("div", {}, undoB, redoB), h("div", {}, diceB, resetB)), turnB), moodsEl);
  const tabsEl = h("div", { cls: "sahne-bld-tabs", role: "tablist" });
  const panel = h("div", { cls: "sahne-bld-panel", role: "tabpanel", id: `${uid}-panel`, tabindex: "0" });
  const doneB = h("button", { type: "button", cls: "sahne-bld-btn sahne-bld-primary", "data-act": "done" });
  const cancelB = h("button", { type: "button", cls: "sahne-bld-btn", "data-act": "cancel" });
  const foot = h("div", { cls: "sahne-bld-foot" }, o.onCancel ? cancelB : null, o.onDone ? doneB : null);
  if (!o.onCancel && !o.onDone) foot.hidden = true;
  root.append(h("div", { cls: "sahne-bld-in" }, view, h("div", { cls: "sahne-bld-side" }, tabsEl, panel, foot)), live);
  host.append(root);

  const say = (t: string) => { live.textContent = ""; requestAnimationFrame(() => { live.textContent = t; }); };

  // ---- time-sliced drawing of thumbnails -------------------------------------------------------------
  // The queue is replaced on every redraw, so a stale picture is never drawn; a slice is a posted
  // message (no timer clamp) and stops after SLICE ms.
  let queue: (() => void)[] = [], posted = false;
  const ch = new MessageChannel();
  ch.port1.onmessage = () => {
    posted = false;
    const t = performance.now();
    while (queue.length && performance.now() - t < SLICE) queue.shift()!();
    if (queue.length) { posted = true; ch.port2.postMessage(0); }
  };
  const runJobs = (jobs: (() => void)[]) => { queue = jobs; if (!posted && jobs.length) { posted = true; ch.port2.postMessage(0); } };
  /** A job that puts a portrait of `make()` into `el`, unless it shows that picture already. */
  const pic = (el: HTMLElement, make: () => unknown, po: Parameters<typeof portrait>[2]) => () => {
    if (!el.isConnected) return;
    const d = make();
    if (!d) return;
    const key = `${po?.framing}|${po?.emotion ?? ""}|${po?.view ?? ""}|${serialize(d as AvatarDoc)}`;
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    el.innerHTML = portrait(d, kit, { ...opts, ...po });
  };

  // ---- theme and motion ------------------------------------------------------------------------------
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  function dark() { return theme === "dark" || (theme === "auto" && !!mq?.matches); }
  function paintTheme() {
    if (theme === "auto") root.removeAttribute("data-theme"); else root.dataset.theme = theme;
    root.toggleAttribute("data-dark", dark());
    root.toggleAttribute("data-still", motion === "still");
    // the stage is a lit world: dimmed in a dark theme, not recoloured (DESIGN.md §3)
    if (stage) { stage.dim = dark() ? 0.92 : 1; stage.setMotion(motion); }
  }
  const onScheme = () => paintTheme();
  mq?.addEventListener("change", onScheme);

  // ---- the preview -----------------------------------------------------------------------------------
  let stage: Stage | null = null;
  if (o.preview !== "still") {
    const s = mountStage(stageHost, { kit, bubbles: false, motion, dim: dark() ? 0.92 : 1, onContext: () => showPreview() });
    if (s.webgl) {
      stage = s;
      sid = s.studio(builder.doc, { framing, backdrop: o.backdrop ?? "wall", label: words.preview, trusted: author });
    } else s.destroy();
  }
  const usingStill = () => !stage || stage.lost;
  const gestures = tapGestures(Object.keys(kit.gestures ?? {}));
  let stillDoc: AvatarDoc | null = null, stillRaf = 0;
  /** Draw the still portrait (coalesced to a frame), when it is what shows. */
  function drawStill() {
    if (!usingStill() || stillRaf) return;
    stillRaf = requestAnimationFrame(() => {
      stillRaf = 0;
      stillEl.innerHTML = portrait(stillDoc ?? builder.doc, kit, { ...opts, framing, view: back ? "back" : "front", emotion: mood, detail: 400, idPrefix: `${uid}p`, label: words.preview });
    });
  }
  function showPreview() {
    const still = usingStill();
    stillEl.hidden = !still; stageHost.hidden = still;
    if (still) { stageHost.removeAttribute("role"); stageHost.removeAttribute("tabindex"); drawStill(); }
    else { stageHost.setAttribute("role", "button"); stageHost.tabIndex = 0; stageHost.setAttribute("aria-label", words.wave); }
  }
  /** Show a document that is not committed (the height slider while it moves). */
  function look(d: AvatarDoc) {
    if (stage && !stage.lost) void stage.setAvatar(sid, d, opts);
    stillDoc = d; drawStill();
  }
  function frame(f: Framing) {
    if (f === framing) return;
    framing = f;
    stage?.setFraming(f);
    drawStill();
  }
  function wave() {
    if (!stage || stage.lost || !gestures.length || motion === "still") return;
    stage.gesture(sid, gestures[taps++ % gestures.length]);
  }
  stageHost.addEventListener("click", wave);
  stageHost.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wave(); } });

  // ---- the static parts: tabs, tools, moods ----------------------------------------------------------
  const emos = emotionStrip(Object.keys(kit.face?.emotions ?? {}));
  function labelStatic() {
    root.setAttribute("lang", lang);
    root.setAttribute("aria-label", words.builder);
    const lab = (b: HTMLElement, t: string) => { b.setAttribute("aria-label", t); b.title = t; };
    lab(undoB, words.undo); lab(redoB, words.redo); lab(diceB, words.randomize); lab(resetB, words.reset);
    lab(turnB, back ? words.front : words.turn);
    doneB.textContent = words.done; cancelB.textContent = words.cancel;
    moodsEl.setAttribute("aria-label", words.moods);
    tabsEl.setAttribute("aria-label", words.builder);
    const secs = builder.sections();
    if (tabsEl.children.length !== secs.length) tabsEl.replaceChildren(...secs.map(s => h("button", { type: "button", cls: "sahne-bld-tab", role: "tab", id: `${uid}-tab-${s.id}`, "aria-controls": panel.id, "data-sec": s.id })));
    secs.forEach((s, i) => {
      // updated in place, so the focus stays on the tab
      const b = tabsEl.children[i] as HTMLButtonElement, on = s.id === section;
      b.textContent = s.label; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `${uid}-tab-${section}`);
    if (moodsEl.children.length !== emos.length) moodsEl.replaceChildren(...emos.map(e => h("button", { type: "button", cls: "sahne-bld-mood", role: "radio", "data-emo": e })));
    emos.forEach((e, i) => { const b = moodsEl.children[i] as HTMLElement, t = words.emotions[e] ?? e; b.setAttribute("aria-label", t); b.title = t; });
    showPreview();
  }
  function syncTools() {
    undoB.setAttribute("aria-disabled", String(!builder.canUndo));
    redoB.setAttribute("aria-disabled", String(!builder.canRedo));
    turnB.setAttribute("aria-pressed", String(back));
  }

  // ---- the panel ---------------------------------------------------------------------------------------
  /** A group's current value, as the `data-v` of the item that should be checked. */
  const enc = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const fieldsNow = () => builder.fields(section);
  function slotsOf(f: FieldInfo) {
    if (f.kind === "color") return [{ index: 0, label: f.label }];
    // an ink waits for the one before it (the model needs them in order)
    return colourSlots(f, { colour: kw("colour", words.colour), colourN: words.colourN, ink: words.ink })
      .filter(s => s.index <= f.colors || builder.getColor(f.id, s.index - 1) !== null);
  }
  function activeSlot(f: FieldInfo) {
    const slots = slotsOf(f), want = slotOf.get(f.id) ?? 0;
    return slots.some(s => s.index === want) ? want : slots[0]?.index ?? 0;
  }
  /** What the panel's structure depends on: when it is unchanged, a change only updates states and pictures. */
  function signature(): string {
    return JSON.stringify([lang, section, [...unlocked].sort(), fieldsNow().map(f => {
      const slot = activeSlot(f);
      return [f, builder.options(f.id).map(x => [x.value, x.label, x.locked, x.reserved]), slotsOf(f).map(s => s.label), slot,
        f.colors || f.kind === "color" ? builder.colorOptions(f.id, slot).map(c => [c.id, c.locked]) : 0,
        f.patterns ? builder.patternOptions(f.id).map(x => [x.value, x.locked]) : 0, o.more && builder.hasMore(f.id), tagOf.get(f.id) ?? null, notes.get(f.id)];
    })]);
  }

  function optionTile(f: FieldInfo, x: Option, what: "opt" | "pat", role: "radio" | "checkbox"): HTMLButtonElement {
    const v = enc(x.value), thumb = h("span", { cls: "sahne-bld-thumb", "aria-hidden": "true" });
    const lockId = x.locked ? `${uid}-l-${f.id}-${what}-${v}` : undefined;
    const b = h("button", {
      type: "button", cls: "sahne-bld-opt", role, "aria-checked": "false", tabindex: "-1", "data-v": v,
      "aria-disabled": x.locked ? "true" : undefined, "aria-describedby": lockId, title: x.locked ? `${x.label} · ${words.locked}: ${unlockText(x.unlock)}` : x.label,
    }, thumb, h("span", { cls: "sahne-bld-lab" }, x.label));
    if (x.locked) b.append(lockIcon(), h("span", { cls: "sahne-sr", id: lockId }, `${words.locked}: ${unlockText(x.unlock)}`));
    if (x.reserved) b.append(h("span", { cls: "sahne-bld-badge", "aria-hidden": "true" }, x.reserved === "cast" ? words.cast : words.hidden));
    if (x.reserved) b.setAttribute("aria-label", `${x.label} (${x.reserved === "cast" ? words.cast : words.hidden})`);
    return b;
  }
  function group(f: FieldInfo, what: string, role: string, label: string, kids: HTMLElement[], cls: string) {
    const g = h("div", { cls, role, "aria-label": label, "data-field": f.id, "data-what": what });
    g.append(...kids);
    return g;
  }
  function fieldEl(f: FieldInfo): HTMLElement {
    const hid = `${uid}-f-${f.id}`, sec = h("section", { cls: "sahne-bld-field" + (f.hidden ? " sahne-bld-hidden" : ""), "aria-labelledby": hid, "data-field": f.id });
    const head = h("div", { cls: "sahne-bld-fh" }, h("h3", { id: hid }, f.label));
    const note = notes.get(f.id);
    if (note) head.append(h("span", { cls: "sahne-bld-note" + (note.warn ? " sahne-bld-warn" : "") }, note.text));
    else if (f.hidden) head.append(h("span", { cls: "sahne-bld-note" }, words.hiddenBy));
    sec.append(head);

    if (f.kind === "number") {
      const r = h("input", { type: "range", min: "0", max: "1", step: "0.01", "aria-labelledby": hid, "data-field": f.id, "data-what": "range" });
      r.value = String(builder.get(f.id));
      sec.append(h("div", { cls: "sahne-bld-range" }, h("span", { "aria-hidden": "true" }, words.shorter), r, h("span", { "aria-hidden": "true" }, words.taller)));
      return sec;
    }
    if (f.kind !== "color") {
      const all = builder.options(f.id), tags = tagFilters(all), tag = tags.includes(tagOf.get(f.id) ?? "") ? tagOf.get(f.id)! : null;
      // a long list (an author's) gets tag filters, the cast's own among them; a short one only the badges
      const reserved = tags.length > 0 && all.some(x => x.reserved);
      if (tags.length) {
        const chips = [null, ...(reserved ? ["cast"] : []), ...tags.filter(t => t !== "cast")].map(t => h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": String(t === tag), tabindex: t === tag ? "0" : "-1", "data-v": enc(t) }, t === null ? words.all : t === "cast" && reserved ? words.cast : t));
        sec.append(group(f, "tag", "radiogroup", `${f.label}: ${words.all}`, chips, "sahne-bld-chips"));
      }
      const multi = f.kind === "multi", shown = all.filter(x => passes(x, tag));
      const g = group(f, "opt", multi ? "group" : "radiogroup", f.label, shown.map(x => optionTile(f, x, "opt", multi ? "checkbox" : "radio")), "sahne-bld-opts");
      g.setAttribute("aria-labelledby", hid); g.removeAttribute("aria-label");
      if (shown.length <= 6) g.setAttribute("data-few", "");
      sec.append(g);
      if (o.more && !author && builder.hasMore(f.id)) sec.append(h("button", { type: "button", cls: "sahne-bld-chip sahne-bld-more", "data-act": "more", "data-field": f.id }, words.more));
    }
    const slots = f.kind === "color" ? [{ index: 0, label: f.label }] : f.colors ? slotsOf(f) : [];
    if (slots.length) {
      const slot = activeSlot(f);
      if (f.kind !== "color") sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, kw("colour", words.colour)));
      if (slots.length > 1) {
        sec.append(group(f, "slot", "radiogroup", kw("colour", words.colour), slots.map(s => {
          const c = builder.getColor(f.id, s.index), dot = h("i", { "aria-hidden": "true" });
          dot.style.setProperty("--c", c ? kit.color(c) : "transparent");
          return h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": String(s.index === slot), tabindex: "-1", "data-v": String(s.index) }, dot, s.label);
        }), "sahne-bld-chips"));
      }
      const label = f.kind === "color" ? f.label : `${f.label}: ${slots.find(s => s.index === slot)?.label ?? ""}`;
      sec.append(group(f, "sw", "radiogroup", label, builder.colorOptions(f.id, slot).map(c => {
        const b = h("button", { type: "button", cls: "sahne-bld-sw", role: "radio", "aria-checked": "false", tabindex: "-1", "data-v": c.id, "aria-label": c.locked ? `${c.label} (${words.locked}: ${unlockText(c.unlock)})` : c.label, title: c.label, "aria-disabled": c.locked ? "true" : undefined }, h("span", {}));
        b.style.setProperty("--c", c.hex);
        if (c.locked) b.append(lockIcon());
        return b;
      }), "sahne-bld-sws"));
    }
    if (f.patterns) {
      const pl = kw("pattern", words.pattern);
      sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, pl));
      const g = group(f, "pat", "radiogroup", `${f.label}: ${pl}`, builder.patternOptions(f.id).map(x => optionTile(f, x, "pat", "radio")), "sahne-bld-opts");
      g.setAttribute("data-few", "");
      sec.append(g);
    }
    if (f.sides && f.sides.length > 1) {
      const sl = kw("side", words.side);
      sec.append(h("div", { cls: "sahne-bld-sub", "aria-hidden": "true" }, sl), group(f, "side", "radiogroup", `${f.label}: ${sl}`, f.sides.map(s =>
        h("button", { type: "button", cls: "sahne-bld-chip", role: "radio", "aria-checked": "false", tabindex: "-1", "data-v": s }, words.sides[s] ?? s)), "sahne-bld-chips"));
    }
    return sec;
  }

  /** The value a group's checked item has now. */
  function valueOf(field: string, what: string): string | string[] {
    switch (what) {
      case "opt": { const v = builder.get(field); return Array.isArray(v) ? v : enc(v); }
      case "sw": { const f = builder.field(field); return enc(f ? builder.getColor(field, f.kind === "color" ? 0 : activeSlot(f)) : null); }
      case "pat": return enc(builder.getPattern(field));
      case "side": return enc(builder.getSide(field));
      case "slot": { const f = builder.field(field); return f ? String(activeSlot(f)) : "0"; }
      case "tag": return enc(tagOf.get(field) ?? null);
      default: return "";
    }
  }
  /** Check what is current, keep one tab stop per group, and queue the pictures. */
  function sync() {
    const vis: (() => void)[] = [], rest: (() => void)[] = [], thumbs: [HTMLButtonElement, () => void][] = [];
    for (const g of panel.querySelectorAll<HTMLElement>("[data-what]")) {
      const field = g.dataset.field!, what = g.dataset.what!;
      if (what === "range") { const r = g as HTMLInputElement; if (!dragging) r.value = String(builder.get(field)); continue; }
      const cur = valueOf(field, what), items = [...g.querySelectorAll<HTMLButtonElement>(":scope > button[data-v]")];
      let stop: HTMLButtonElement | null = null;
      for (const b of items) {
        const on = Array.isArray(cur) ? cur.includes(b.dataset.v!) : cur === b.dataset.v;
        b.setAttribute("aria-checked", String(on));
        if (on && !stop) stop = b;
      }
      const focus = g.contains(document.activeElement) ? document.activeElement as HTMLButtonElement : null;
      for (const b of items) b.tabIndex = b === (focus ?? stop ?? items[0]) ? 0 : -1;
      if (what !== "opt" && what !== "pat") continue;
      const f = builder.field(field);
      if (!f) continue;
      const fr = fieldFraming(field), detail = 96;
      for (const b of items) {
        const el = b.querySelector<HTMLElement>(".sahne-bld-thumb")!, v = b.dataset.v === "" ? null : b.dataset.v!;
        const make = what === "pat" ? () => withPattern(field, v)
          : f.kind === "multi" ? () => builder.preview(field, withMark(cur as string[], v!, f.max ?? 3)) ?? builder.preview(field, [v])
          : () => builder.preview(field, v) ?? lockedDoc(field, v);
        thumbs.push([b, pic(el, make, { framing: fr, detail, idPrefix: `${uid}t` })]);
      }
    }
    // the pictures in view first (read after every write above, so layout runs once)
    const pr = panel.getBoundingClientRect();
    for (const [b, job] of thumbs) { const r = b.getBoundingClientRect(); (r.bottom > pr.top && r.top < pr.bottom ? vis : rest).push(job); }
    for (const b of moodsEl.querySelectorAll<HTMLButtonElement>("button[data-emo]")) {
      const on = b.dataset.emo === mood;
      b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1;
      vis.push(pic(b, () => builder.doc, { framing: "head", emotion: b.dataset.emo, detail: 48, idPrefix: `${uid}m` }));
    }
    syncTools();
    runJobs([...vis, ...rest]);
  }
  /** A locked part as worn, for its thumbnail (the model will not preview what it refuses). */
  function lockedDoc(field: string, v: string | null): unknown {
    const d = JSON.parse(serialize(builder.doc)) as Record<string, any>, ks = field.split("."), last = ks.pop()!;
    let c = d;
    for (const k of ks) c = c[k] ??= {};
    c[last] = v === null ? undefined : { id: v };
    return d;
  }
  function withPattern(field: string, id: string | null): unknown {
    const d = JSON.parse(serialize(builder.doc)), g = at(d, field);
    if (!isObj(g)) return null;
    if (id === null) { delete g.pattern; delete g.inks; } else g.pattern = id;
    return d;
  }

  let sig = "", dragging = false;
  /** Redraw the panel: rebuilt when its structure changed (the focus kept by its item), else only synced. */
  function render(force = false) {
    const next = signature();
    if (force || next !== sig) {
      sig = next;
      const a = document.activeElement as HTMLElement | null, inside = !!a && panel.contains(a);
      const g = a?.closest<HTMLElement>("[data-what]"), key = inside && g ? [g.dataset.field, g.dataset.what, a?.dataset.v] : null;
      const top = panel.scrollTop;
      panel.replaceChildren(...fieldsNow().map(fieldEl));
      panel.scrollTop = top;
      if (key) {
        const g2 = panel.querySelector<HTMLElement>(`[data-field="${CSS.escape(key[0]!)}"][data-what="${key[1]}"]`);
        const t = key[1] === "range" ? g2 : g2?.querySelector<HTMLElement>(`button[data-v="${CSS.escape(key[2] ?? "")}"]`) ?? g2?.querySelector<HTMLElement>('button[aria-checked="true"]') ?? g2?.querySelector("button");
        (t ?? panel).focus({ preventScroll: true });
      } else if (inside) panel.focus({ preventScroll: true });
    }
    sync();
  }

  // ---- input -----------------------------------------------------------------------------------------
  function note(field: string, text: string, warn = true) { notes.set(field, { text, warn }); say(text); render(); }
  function choose(g: HTMLElement, b: HTMLButtonElement) {
    const field = g.dataset.field!, what = g.dataset.what!, v = b.dataset.v === "" ? null : b.dataset.v!;
    const f = builder.field(field);
    notes.delete(field);
    if (b.getAttribute("aria-disabled") === "true") {
      const text = b.querySelector(".sahne-sr")?.textContent ?? (b.getAttribute("aria-label") ?? words.locked);
      return note(field, text);
    }
    if (what !== "tag" && what !== "slot") frame(fieldFraming(field));
    let ok = true;
    switch (what) {
      case "opt": ok = builder.set(field, v); if (!ok && f?.kind === "multi") return note(field, fill(words.max, f.max ?? 3)); break;
      case "sw": ok = f ? builder.setColor(field, f.kind === "color" ? 0 : activeSlot(f), v!) : false; break;
      case "pat": ok = builder.setPattern(field, v); break;
      case "side": ok = builder.setSide(field, v as WearSide); break;
      case "slot": slotOf.set(field, Number(v)); break;
      case "tag": tagOf.set(field, v); break;
    }
    render();
    if (!ok) say(words.lockedHow);
  }
  panel.addEventListener("click", e => {
    const t = e.target as HTMLElement, b = t.closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.act === "more") { builder.more(b.dataset.field!); return; }
    const g = b.parentElement;
    if (g?.dataset.what) choose(g, b);
  });
  panel.addEventListener("keydown", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-v]"), g = b?.parentElement;
    if (!b || !g?.dataset.what) return;
    const items = [...g.querySelectorAll<HTMLButtonElement>(":scope > button[data-v]")], i = roving(e.key, items.indexOf(b), items.length);
    if (i < 0) return;
    e.preventDefault();
    const n = items[i];
    for (const x of items) x.tabIndex = x === n ? 0 : -1;
    n.focus();
    // a radio is checked by the arrow that reaches it (a checkbox only by Space); a locked one only says how to earn it
    if (g.getAttribute("role") === "radiogroup") {
      if (n.getAttribute("aria-disabled") === "true") say(n.getAttribute("aria-label") ?? n.querySelector(".sahne-sr")?.textContent ?? words.locked);
      else choose(g, n);
    }
  });
  panel.addEventListener("input", e => {
    const r = e.target as HTMLInputElement;
    if (r.dataset.what !== "range") return;
    dragging = true;
    frame("full");
    const d = builder.preview(r.dataset.field!, Number(r.value));
    if (d) look(d);
  });
  panel.addEventListener("change", e => {
    const r = e.target as HTMLInputElement;
    if (r.dataset.what !== "range") return;
    dragging = false; stillDoc = null;
    builder.set(r.dataset.field!, Number(r.value));
  });
  panel.addEventListener("focusin", e => {
    const f = (e.target as HTMLElement).closest<HTMLElement>("[data-field]")?.dataset.field;
    if (f && (e.target as HTMLElement).matches("button[data-v], input")) frame(fieldFraming(f));
  });

  function setSection(id: string, focus = false) {
    if (!builder.sections().some(s => s.id === id)) return;
    section = id;
    frame(sectionFraming(id));
    labelStatic();
    panel.scrollTop = 0;
    render(true);
    if (focus) tabsEl.querySelector<HTMLElement>(`[data-sec="${id}"]`)?.focus();
  }
  tabsEl.addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-sec]"); if (b) setSection(b.dataset.sec!); });
  tabsEl.addEventListener("keydown", e => {
    const tabs = [...tabsEl.querySelectorAll<HTMLElement>("[data-sec]")], i = roving(e.key, tabs.findIndex(t => t.dataset.sec === section), tabs.length);
    if (i < 0) return;
    e.preventDefault();
    setSection(tabs[i].dataset.sec!, true);
  });

  function setMood(e: string) {
    mood = e;
    if (stage && !stage.lost) stage.mood(sid, e);
    drawStill(); sync();
  }
  moodsEl.addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-emo]"); if (b) setMood(b.dataset.emo!); });
  moodsEl.addEventListener("keydown", e => {
    // only the faces shown (a narrow builder hides the last)
    const shown = [...moodsEl.querySelectorAll<HTMLElement>("[data-emo]")].filter(b => b.offsetParent !== null), i = roving(e.key, shown.findIndex(b => b.dataset.emo === mood), shown.length);
    if (i < 0) return;
    e.preventDefault();
    setMood(shown[i].dataset.emo!);
    shown[i].focus();
  });

  let dice = 0;
  // whether there is work to lose: the document differs from where the builder started
  const started = serialize(builder.doc);
  const ask = async (a: "cancel" | "reset") => !o.confirm || serialize(builder.doc) === started || await o.confirm(a, builder.doc);
  async function act(name: string) {
    switch (name) {
      case "undo": if (builder.undo()) say(words.undone); break;
      case "redo": if (builder.redo()) say(words.redone); break;
      case "dice": builder.randomize(o.seed?.() ?? `${Date.now()}:${++dice}:${Math.random()}`); say(words.random); break;
      case "reset": if (await ask("reset")) { builder.reset(); say(words.resetDone); } break;
      case "turn":
        back = !back;
        if (stage && !stage.lost) stage.flip(sid);
        labelStatic(); syncTools(); drawStill();
        break;
      case "done": o.onDone?.(builder.doc); break;
      case "cancel": if (await ask("cancel")) o.onCancel?.(); break;
    }
  }
  root.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (b && !panel.contains(b) && b.getAttribute("aria-disabled") !== "true") void act(b.dataset.act!);
  });
  root.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z" || k === "y") { e.preventDefault(); void act(k === "y" || e.shiftKey ? "redo" : "undo"); }
  });

  // ---- changes from the model ----------------------------------------------------------------------------
  let last = builder.doc;
  const unsub = builder.subscribe(d => {
    if (d !== last) {
      last = d; stillDoc = null;
      if (stage && !stage.lost) void stage.setAvatar(sid, d, opts);
      drawStill();
      o.onChange?.(d);
    }
    render();
  });

  paintTheme();
  labelStatic();
  render(true);

  return {
    el: root, builder,
    get doc() { return builder.doc; },
    get stage() { return usingStill() ? null : stage; },
    get section() { return section; },
    setSection: id => setSection(id),
    setLang(l) {
      if (l === lang) return;
      lang = l; words = uiWords(l, o.words);
      labelStatic();
      builder.lang = l;
    },
    setUnlocked(ids) { unlocked = new Set(ids); render(); },
    setTheme(t) { theme = t; paintTheme(); },
    setMotion(m) { motion = m; paintTheme(); },
    destroy() {
      unsub(); queue = []; ch.port1.close();
      cancelAnimationFrame(stillRaf);
      mq?.removeEventListener("change", onScheme);
      stage?.destroy();
      root.remove();
    },
  };
}
