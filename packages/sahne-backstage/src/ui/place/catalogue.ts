// The catalogue: the kit's set pieces and props as sketches, and a new mark. A pick puts the stage (and the plan) in drop
// mode: the next click there puts it down.

import { html } from "htm/preact";
import { useMemo, useState } from "preact/hooks";
import { pieceItems } from "../galleries.ts";
import { Gallery } from "../kit/gallery.ts";
import type { Drop } from "./stage.ts";

export function Catalogue(p: { drop: Drop | null; onPick(d: Drop | null): void; onClose(): void }) {
  const [tab, setTab] = useState<"set" | "props" | "mark">("props");
  const items = useMemo(() => (tab === "mark" ? [] : pieceItems(tab)), [tab]);
  const picked = p.drop && p.drop.kind !== "mark" ? [p.drop.kit] : [];
  return html`<div class="panel pl-card pl-cat">
    <header><div class="grow"><h3>Add to the place</h3><small>Pick one, then click the stage or the plan where it goes.</small></div>
      <button class="small" onClick=${p.onClose}>Done</button></header>
    <div class="tabs" role="tablist">
      ${([["props", "Props"], ["set", "Set pieces"], ["mark", "A mark"]] as const).map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} onClick=${() => setTab(k)}>${l}</button>`)}
    </div>
    ${tab === "mark"
      ? html`<p class="note">A mark is a spot a person stands, sits or flies to. Stories name it.</p>
        <button class=${p.drop?.kind === "mark" ? "primary" : ""} onClick=${() => p.onPick(p.drop?.kind === "mark" ? null : { kind: "mark" })}>${p.drop?.kind === "mark" ? "Click the floor…" : "Put a mark"}</button>`
      : html`<${Gallery} key=${tab} items=${items} size="s" label=${tab === "set" ? "Set pieces" : "Props"} value=${picked}
          onPick=${(kit: string) => p.onPick(picked[0] === kit ? null : { kind: tab === "set" ? "piece" : "prop", kit })} />`}
  </div>`;
}
