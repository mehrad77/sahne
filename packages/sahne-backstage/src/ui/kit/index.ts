// The studio's small parts, used by every page: a chip, an empty state, a drawer beside the page, a modal over it, and a
// popover at a point (it closes on Escape or a click outside). Pickers and galleries build on these (gallery.ts).

import { html } from "htm/preact";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { Icon } from "./icons.ts";

export { Icon } from "./icons.ts";

export const Chip = (p: { tone?: "bad" | "warn" | "ok" | ""; title?: string; children?: ComponentChildren }) =>
  html`<span class=${`chip ${p.tone ?? ""}`} title=${p.title}>${p.children}</span>`;

/** What a page shows when it has nothing yet, with the one thing to do about it. */
export const Empty = (p: { icon?: string; title: string; children?: ComponentChildren }) => html`<div class="empty">
  ${p.icon && html`<${Icon} name=${p.icon} size=${28} />`}<b>${p.title}</b>${p.children}</div>`;

/** A panel on the page's right: the assistant, a step's details. */
export const Drawer = (p: { title: ComponentChildren; onClose(): void; children?: ComponentChildren; label?: string }) => html`<aside class="drawer" aria-label=${p.label ?? "Side panel"}>
  <header><b>${p.title}</b><button class="iconbtn" onClick=${p.onClose} aria-label="Close"><${Icon} name="close" /></button></header>
  <div class="body">${p.children}</div></aside>`;

/**
 * A dialog over the page (the browser's own modal `<dialog>`: the page behind is inert, focus stays inside, Escape closes
 * it), for settings that are a task of their own: the series', a season's. A click on the backdrop closes it too.
 */
export function Modal(p: { title: ComponentChildren; onClose(): void; children?: ComponentChildren; label?: string; wide?: boolean }) {
  const el = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = el.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return html`<dialog class=${`modal${p.wide ? " wide" : ""}`} ref=${el} aria-label=${p.label ?? (typeof p.title === "string" ? p.title : "Dialog")}
    onClose=${p.onClose} onCancel=${(e: Event) => { e.preventDefault(); p.onClose(); }}
    onClick=${(e: MouseEvent) => { if (e.target === el.current) p.onClose(); }}>
    <header><b>${p.title}</b><button class="iconbtn" onClick=${p.onClose} aria-label="Close"><${Icon} name="close" /></button></header>
    <div class="body">${p.children}</div></dialog>`;
}

/** A popover at a screen point (kept on screen), closed by Escape or a click outside it. */
export function Popover(p: { x: number; y: number; onClose(): void; children?: ComponentChildren; label?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    const down = (e: PointerEvent) => { if (el.current && !el.current.contains(e.target as Node)) p.onClose(); };
    addEventListener("keydown", key);
    const t = setTimeout(() => addEventListener("pointerdown", down), 0);
    return () => { removeEventListener("keydown", key); removeEventListener("pointerdown", down); clearTimeout(t); };
  }, []);
  useEffect(() => {
    const d = el.current;
    if (!d) return;
    const r = d.getBoundingClientRect();
    d.style.left = `${Math.max(8, Math.min(p.x, innerWidth - r.width - 8))}px`;
    d.style.top = `${Math.max(8, Math.min(p.y, innerHeight - r.height - 8))}px`;
  });
  return html`<div class="popover" ref=${el} role="dialog" aria-label=${p.label ?? "Options"} style=${`left:${p.x}px;top:${p.y}px`}>${p.children}</div>`;
}

/** Keyboard shortcut text for this platform: ⌘ on a Mac, Ctrl elsewhere. */
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
