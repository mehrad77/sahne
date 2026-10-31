// What an assistant's answer is made of, drawn (ui/assistant.ts keeps the conversation): its thinking as a muted block
// that streams open and folds to "Thought for 12s" once the answer moves on, and its tool calls as one group per run of
// calls, a line saying what they did ("Read 3 things · 2 edits"), open while they run, then folded. Each call is a row in
// plain words (model/tools.ts) with its icon, a spinner turning to ✓ or ✕, and its time; opened, it shows what it was
// given and what came back. A proposal a call made shows under its group, folded or not. `useStickToBottom` keeps a
// scroller on its newest line while it grows, until the person scrolls up (and again once they scroll back down).

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { groupSummary, pathWords, toolLabel, type ToolKind } from "../../model/tools.ts";
import { Icon } from "../kit/index.ts";
import { Markdown } from "../md.ts";

export type Thinking = { type: "thinking"; text: string; at?: number; ms?: number };
export type ToolPart = { type: "tool"; id?: string; name: string; input?: unknown; ok?: boolean; summary?: string; detail?: string; ms?: number; at?: number; proposal?: string };

/** A clock for the live timers, ticking once a second while an answer runs. */
export const now = signal(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
export function tick(on: boolean) {
  clearInterval(ticker);
  now.value = Date.now();
  if (on) ticker = setInterval(() => { now.value = Date.now(); }, 1000);
}

export const secs = (ms: number) => (ms < 1000 ? `${Math.max(0, Math.round(ms))} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

const ICON: Record<ToolKind, string> = { read: "book", search: "search", check: "check", edit: "note", create: "plus", comment: "chat", show: "play", look: "camera", web: "globe", memory: "box", ask: "chat" };

/** The model's thinking: open while it streams (unless folded by hand), folded after. */
/** How near the bottom (px) still counts as at it. */
const NEAR = 48;

/**
 * Keep `scroller()` at its bottom as `grows` changes, while the person is there: scrolling up lets it be, scrolling back to
 * the bottom sticks again. Returns the ref to put on an element inside it (the scroller is found from it).
 */
export function useStickToBottom<T extends HTMLElement>(grows: unknown, scroller: (el: T) => HTMLElement | null = el => el) {
  const ref = useRef<T>(null), stuck = useRef(true), seen = useRef<{ el: HTMLElement; off(): void } | null>(null);
  useEffect(() => {
    const s = ref.current && scroller(ref.current);
    // the scroller can come later (a box that opens): listen to whichever is there now
    if (s && seen.current?.el !== s) {
      seen.current?.off();
      const on = () => { stuck.current = s.scrollHeight - s.scrollTop - s.clientHeight < NEAR; };
      s.addEventListener("scroll", on, { passive: true });
      seen.current = { el: s, off: () => s.removeEventListener("scroll", on) };
    }
    if (s && stuck.current) s.scrollTop = s.scrollHeight;
  }, [grows]);
  useEffect(() => () => seen.current?.off(), []);
  return ref;
}

/** The nearest ancestor that scrolls (or would, once it overflows). */
export const scrollerOf = (el: HTMLElement): HTMLElement | null => {
  for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if (o === "auto" || o === "scroll") return e; }
  return null;
};

export function ThinkingBlock(p: { part: Thinking; live: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const t = p.part, shown = open ?? p.live;
  // while it streams, its box shows the newest thought (unless the person scrolled up in it)
  const box = useStickToBottom<HTMLDivElement>(t.text, el => el.querySelector<HTMLElement>(".think-text"));
  const took = t.ms ?? (p.live && t.at ? now.value - t.at : undefined);
  const label = p.live ? `Thinking${took !== undefined ? ` · ${Math.round(took / 1000)} s` : "…"}` : `Thought${took !== undefined ? ` for ${Math.max(1, Math.round(took / 1000))} s` : ""}`;
  return html`<div ref=${box} class=${`think${p.live ? " live" : ""}${shown ? " open" : ""}`}>
    <button type="button" class="think-head" aria-expanded=${shown} onClick=${() => setOpen(!shown)}><span class="caret" aria-hidden="true">›</span>${label}</button>
    ${shown && (t.text.trim() ? html`<${Markdown} class="think-text" text=${t.text} />` : html`<div class="think-text note">The model thought without showing its thinking.</div>`)}
  </div>`;
}

/** A run of tool calls: one line for all of them, each call a row that opens to its input and result. */
export function ToolGroup(p: { calls: ToolPart[]; live: boolean; stopped: boolean; after?: unknown }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const running = p.calls.some(c => c.ok === undefined) && p.live;
  const shown = open ?? running;
  const bad = p.calls.filter(c => c.ok === false).length;
  const ms = p.calls.reduce((n, c) => n + (c.ms ?? 0), 0);
  const head = running ? `${toolLabel(p.calls.at(-1)!.name, p.calls.at(-1)!.input).label}…` : groupSummary(p.calls);
  return html`<div class=${`tools${shown ? " open" : ""}${bad ? " has-bad" : ""}`}>
    <button type="button" class="tools-head" aria-expanded=${shown} onClick=${() => setOpen(!shown)}>
      <span class="caret" aria-hidden="true">›</span>${running ? html`<span class="spin" aria-hidden="true"></span>` : html`<${Icon} name=${bad ? "close" : "check"} size=${12} />`}
      <span class="grow">${head}</span><small>${p.calls.length > 1 ? `${p.calls.length} calls · ` : ""}${ms ? secs(ms) : ""}</small></button>
    ${shown && html`<ol class="tool-rows">${p.calls.map(c => html`<${ToolRow} call=${c} live=${p.live} stopped=${p.stopped} />`)}</ol>`}
  </div>${p.after}`;
}

function ToolRow(p: { call: ToolPart; live: boolean; stopped: boolean }) {
  const [open, setOpen] = useState(false);
  const c = p.call, { label, kind } = toolLabel(c.name, c.input);
  const state = c.ok === true ? "ok" : c.ok === false ? "bad" : p.live ? "run" : "stopped";
  const took = c.ms ?? (state === "run" && c.at ? now.value - c.at : undefined);
  return html`<li class=${`tool-row ${state}${open ? " open" : ""}`}>
    <button type="button" class="tool-line" aria-expanded=${open} onClick=${() => setOpen(!open)} title=${c.name}>
      <${Icon} name=${ICON[kind]} size=${13} /><span class="grow">${label}</span>
      ${state === "run" ? html`<span class="spin" aria-label="running"></span>` : state === "ok" ? html`<span class="mark ok" aria-label="done">✓</span>` : state === "bad" ? html`<span class="mark bad" aria-label="refused">✕</span>` : html`<span class="mark" aria-label="stopped">–</span>`}
      <small>${took !== undefined ? secs(took) : ""}</small></button>
    ${state === "bad" && !open && c.summary && html`<div class="tool-why">${c.summary}</div>`}
    ${open && html`<div class="tool-open">
      ${inputOf(c.input)}
      ${c.detail || c.summary ? html`<div class="tool-io"><b>${c.ok === false ? "Refused" : "Result"}</b><pre>${c.detail || c.summary}</pre></div>` : state === "run" ? html`<div class="note">Running…</div>` : p.stopped ? html`<div class="note">Stopped before it answered.</div>` : ""}
    </div>`}
  </li>`;
}

/** A call's input as a few lines of words: paths as places in the episode, texts as they read, the rest as short JSON. */
function inputOf(input: unknown) {
  if (!input || typeof input !== "object" || !Object.keys(input).length) return null;
  const rows = Object.entries(input as Record<string, unknown>).map(([k, v]) => {
    const words = /^(path|at|from|to|step)$/.test(k) ? pathWords(v) : typeof v === "string" ? v : JSON.stringify(v, null, 1);
    return html`<tr><th>${k}</th><td><pre>${words.length > 1200 ? `${words.slice(0, 1200)}…` : words}</pre></td></tr>`;
  });
  return html`<div class="tool-io"><b>Given</b><table class="tool-input">${rows}</table></div>`;
}

/** What is happening now, in a few words, for the live line under the answer. */
export function liveLine(parts: { type: string }[], since: number): string {
  const last = parts.at(-1) as (ToolPart | Thinking | { type: string }) | undefined;
  const what = !last ? "Thinking" : last.type === "thinking" ? "Thinking" : last.type === "tool" && (last as ToolPart).ok === undefined ? toolLabel((last as ToolPart).name, (last as ToolPart).input).label : last.type === "text" ? "Writing" : "Thinking";
  return `${what}… ${Math.round((now.value - since) / 1000)} s`;
}
