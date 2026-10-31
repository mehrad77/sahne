// The command palette (⌘K or Ctrl K, or the search box in the top bar): jump to any episode, character, place or
// season, or run a command, by typing a few letters of it (model/search.ts). Arrow keys move, Enter runs, Escape closes.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { search, type Command } from "../../model/search.ts";

export function Palette(p: { commands: Command[]; onClose(): void }) {
  const [q, setQ] = useState(""), [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = search(p.commands, q);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setAt(0), [q]);
  const run = (c: Command | undefined) => { if (!c) return; p.onClose(); c.run(); };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); p.onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt(i => Math.min(list.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(list[at]); }
  };
  return html`<div class="scrim" onPointerDown=${(e: PointerEvent) => { if (e.target === e.currentTarget) p.onClose(); }}>
    <div class="palette" role="dialog" aria-label="Search and commands">
      <input ref=${input} value=${q} placeholder="Go to an episode, a character, a place… or run a command" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-list"
        aria-activedescendant=${list[at] ? `pal-${list[at].id}` : undefined} onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} onKeyDown=${key} />
      <ul id="palette-list" role="listbox">
        ${list.map((c, i) => html`<li id=${`pal-${c.id}`} role="option" aria-selected=${i === at} onPointerMove=${() => setAt(i)} onClick=${() => run(c)}>
          <span class="what">${c.what}</span><span>${c.label}</span>${c.hint && html`<span class="hint">${c.hint}</span>`}</li>`)}
        ${!list.length && html`<li class="note">Nothing matches “${q}”.</li>`}
      </ul>
    </div>
  </div>`;
}
