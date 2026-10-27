// Tap-to-translate (Kumru's STORIES_DESIGN.md §1, Kumru's STORIES_STAGE.md §7): when glosses are on, every word
// of a line that has a gloss gets a dotted underline, and one tap opens a small popup with its
// translation. The engine knows no language: the app's `lookup` decides which words have a gloss
// and what it says, and the app may open its own popup instead of this one (`open`).

/** What a popup shows for a word: an optional dictionary form, then a line per language. */
export interface Gloss {
  /** The dictionary form, when the word is an inflected one (ekmeği → ekmek). */
  head?: string;
  lines: { text: string; lang?: string; dir?: "ltr" | "rtl" }[];
  /** A note in small type ("+ suffix", "a name"). */
  note?: string;
  /** The learner has this word's card: the underline takes the accent colour. */
  known?: boolean;
}

/** The line a word was found in. */
export interface GlossContext { text: string; who?: string; lang: string }

export interface GlossOptions {
  lookup: (word: string, ctx: GlossContext) => Gloss | null;
  /** Show the gloss in the app's own popup; by default the engine's popup opens. */
  open?: (word: string, gloss: Gloss, anchor: HTMLElement) => void;
  /** Say the word (the popup's speak button appears when this is given). */
  speak?: (word: string, lang: string) => void;
}

/** Letters with an apostrophe suffix (Nima'nın), in any script. */
const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

/**
 * Fill `el` with `text`, the words that have a gloss as buttons. Returns how many words got
 * one. Without options the text goes in as it is.
 */
export function glossInto(el: HTMLElement, text: string, o: GlossOptions | null, ctx: GlossContext): number {
  el.replaceChildren();
  if (!o) { el.textContent = text; return 0; }
  const doc = el.ownerDocument;
  popup(doc); // its stylesheet carries the underline
  let at = 0, n = 0;
  for (const m of text.matchAll(WORD)) {
    const i = m.index ?? 0, word = m[0], g = o.lookup(word, ctx);
    if (!g) continue;
    if (i > at) el.append(text.slice(at, i));
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "sahne-gw" + (g.known ? " sahne-known" : "");
    b.textContent = word;
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", e => { e.stopPropagation(); popup(doc).toggle(b, word, g, o, ctx.lang); });
    el.append(b);
    at = i + word.length; n++;
  }
  if (at < text.length) el.append(text.slice(at));
  return n;
}

// ---- The popup -----------------------------------------------------------------------------

const CSS = `
.sahne-gw { display: inline; font: inherit; line-height: inherit; vertical-align: baseline; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer;
  text-decoration: underline dotted; text-decoration-thickness: 1.5px; text-underline-offset: .2em;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); border-radius: 3px; -webkit-tap-highlight-color: transparent; }
.sahne-gw.sahne-known { text-decoration-color: #2F8C88; }
.sahne-gw:hover, .sahne-gw.sahne-on { background: rgba(47, 140, 136, .14); }
.sahne-gw:focus-visible { outline: 2px solid #2F8C88; outline-offset: 1px; }
.sahne-gpop { position: fixed; z-index: 2147483000; box-sizing: border-box; max-width: min(280px, calc(100vw - 24px)); min-width: 140px;
  padding: 10px 12px 11px; border-radius: 12px; background: #FFFCF5; color: #2B2420; color-scheme: light;
  box-shadow: 0 1px 0 rgba(96, 66, 40, .1), 0 10px 28px -8px rgba(60, 40, 24, .38); font: 16px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  display: grid; gap: 3px; animation: sahne-gpop-in 140ms ease-out; }
.sahne-gpop:focus { outline: none; }
.sahne-gpop:focus-visible { outline: 2px solid #2F8C88; outline-offset: 2px; }
.sahne-gpop-h { display: flex; align-items: center; gap: 8px; }
.sahne-gpop-w { font-weight: 700; font-size: 18px; }
.sahne-gpop-head { color: #74675D; }
.sahne-gpop-say { margin-left: auto; font: inherit; border: 1px solid #DDD3C4; background: #fff; border-radius: 999px; padding: 1px 9px; cursor: pointer; color: inherit; }
.sahne-gpop-note { color: #74675D; font-size: 14px; }
.sahne-gpop [dir="rtl"] { font-size: 17px; }
@keyframes sahne-gpop-in { from { opacity: 0; transform: translateY(3px); } }
@media (prefers-reduced-motion: reduce) { .sahne-gpop { animation: none; } }
`;

class Popup {
  private doc: Document;
  private el: HTMLDivElement | null = null;
  anchor: HTMLElement | null = null;
  private onDown = (e: Event) => { const t = e.target as Node; if (!this.el?.contains(t) && !this.anchor?.contains(t)) this.close(); };
  private onKey = (e: KeyboardEvent) => {
    if (!this.el) return;
    if (e.key === "Escape") { const a = this.anchor; this.close(); a?.focus(); return; }
    // Tab past either end of the popup goes back to the word, which closes it
    if (e.key === "Tab" && this.el.contains(e.target as Node)) {
      const stops = [this.el, ...this.el.querySelectorAll<HTMLElement>("button")], i = stops.indexOf(e.target as HTMLElement);
      if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === stops.length - 1)) { e.preventDefault(); const a = this.anchor; this.close(); a?.focus(); }
    }
  };
  /** Focus going somewhere else than the popup and its word closes it. */
  private onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !this.el?.contains(to) && !this.anchor?.contains(to)) this.close();
  };
  private onMove = () => this.close();

  constructor(doc: Document) {
    this.doc = doc;
    if (!doc.getElementById("sahne-gloss-css")) {
      const s = doc.createElement("style");
      s.id = "sahne-gloss-css"; s.textContent = CSS;
      doc.head.append(s);
    }
  }

  toggle(anchor: HTMLElement, word: string, g: Gloss, o: GlossOptions, lang: string) {
    if (this.anchor === anchor) { this.close(); return; }
    this.close();
    if (o.open) { o.open(word, g, anchor); return; }
    const d = this.doc, el = this.el = d.createElement("div");
    el.className = "sahne-gpop";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", word);
    el.tabIndex = -1;
    const h = d.createElement("div"); h.className = "sahne-gpop-h";
    const w = d.createElement("span"); w.className = "sahne-gpop-w"; w.lang = lang; w.textContent = word;
    h.append(w);
    if (g.head && g.head.toLocaleLowerCase(lang) !== word.toLocaleLowerCase(lang)) {
      const hd = d.createElement("span"); hd.className = "sahne-gpop-head"; hd.lang = lang; hd.textContent = "← " + g.head;
      h.append(hd);
    }
    if (o.speak) {
      const say = d.createElement("button"); say.type = "button"; say.className = "sahne-gpop-say"; say.textContent = "🔊";
      say.setAttribute("aria-label", "Say " + word);
      say.addEventListener("click", () => o.speak!(word, lang));
      h.append(say);
    }
    el.append(h);
    for (const l of g.lines) {
      const p = d.createElement("div"); p.textContent = l.text;
      if (l.lang) p.lang = l.lang;
      if (l.dir) p.dir = l.dir;
      el.append(p);
    }
    if (g.note) { const p = d.createElement("div"); p.className = "sahne-gpop-note"; p.textContent = g.note; el.append(p); }
    d.body.append(el);
    this.anchor = anchor;
    anchor.classList.add("sahne-on");
    anchor.setAttribute("aria-expanded", "true");
    this.place();
    // focus goes into the popup, so a screen reader reads it and the keyboard reaches its button
    el.focus({ preventScroll: true });
    el.addEventListener("focusout", this.onFocusOut);
    d.addEventListener("pointerdown", this.onDown, true);
    d.addEventListener("keydown", this.onKey);
    d.defaultView?.addEventListener("scroll", this.onMove, { passive: true, capture: true });
    d.defaultView?.addEventListener("resize", this.onMove);
  }

  /** Below the word if it fits, else above; always inside the window. */
  place() {
    const el = this.el, a = this.anchor, win = this.doc.defaultView;
    if (!el || !a || !win) return;
    if (!a.isConnected) { this.close(); return; }
    const r = a.getBoundingClientRect(), W = win.innerWidth, H = win.innerHeight, w = el.offsetWidth, h = el.offsetHeight, m = 12;
    const x = Math.max(m, Math.min(W - w - m, r.left + r.width / 2 - w / 2));
    const y = r.bottom + 8 + h <= H - m ? r.bottom + 8 : Math.max(m, r.top - 8 - h);
    el.style.left = Math.round(x) + "px"; el.style.top = Math.round(y) + "px";
  }

  close() {
    const d = this.doc;
    d.removeEventListener("pointerdown", this.onDown, true);
    d.removeEventListener("keydown", this.onKey);
    d.defaultView?.removeEventListener("scroll", this.onMove, { capture: true });
    d.defaultView?.removeEventListener("resize", this.onMove);
    this.el?.removeEventListener("focusout", this.onFocusOut);
    this.el?.remove(); this.el = null;
    if (this.anchor) { this.anchor.classList.remove("sahne-on"); this.anchor.setAttribute("aria-expanded", "false"); }
    this.anchor = null;
  }

  get open() { return !!this.el; }
}

const POPUPS = new WeakMap<Document, Popup>();
/** The one gloss popup of a document. */
export function popup(doc: Document = document): Popup {
  let p = POPUPS.get(doc);
  if (!p) { p = new Popup(doc); POPUPS.set(doc, p); }
  return p;
}
