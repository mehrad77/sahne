// Point and click on the stage: the place's marks as pins over the stage (each frame, through the stage's camera), and a
// mode that turns a click into staging for the selected step: a person or a prop it looks or points at (`at`), the person
// it is said to (`to`), the mark someone moves to (`move`). Actors and props come from the interaction layer's `inspect`
// (what a tap hits), marks from the pins. Shot buttons set the step's camera.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CAM_KINDS } from "sahne";
import type { StoryDoc } from "sahne-story";
import { get, set, type Path } from "../model/path.ts";
import { kindOf } from "../model/steps.ts";
import type { Preview } from "../stage.ts";
import { say } from "../store.ts";

type Mode = "off" | "at" | "to" | "move";

/** Where the selected step's staging lives: the step (a line, an option, a reply) or its `beat`. */
export function stagingPath(story: StoryDoc, path: Path | null): Path | null {
  if (!path) return null;
  const v = get(story, path);
  const k = path.at(-2) === "options" ? "option" : kindOf(v);
  if (k === "line" || k === "option") return path;
  if (k === "beat") return [...path, "beat"];
  return null;
}

export function StagePick(p: { preview: Preview; story: StoryDoc; path: Path | null; host: HTMLElement | null; edit(fn: (s: StoryDoc) => StoryDoc): void }) {
  const [mode, setMode] = useState<Mode>("off");
  const [pins, setPins] = useState(false);
  const layer = useRef<HTMLDivElement | null>(null);
  const sp = stagingPath(p.story, p.path);
  const who = (() => { const v = sp ? get(p.story, sp) as { who?: string } | undefined : undefined; return v?.who ?? (p.path?.at(-2) === "options" ? "nima" : undefined); })();
  const latest = useRef({ mode, sp, who, edit: p.edit });
  latest.current = { mode, sp, who, edit: p.edit };

  /** A pick becomes staging. */
  const apply = (target: string) => {
    const { mode: m, sp: at, who: w, edit } = latest.current;
    if (m === "off") return;
    if (!at) { say("Select a line, a beat, an option or a reply first"); return; }
    if (m === "at") edit(s => set(s, [...at, "at"], target));
    else if (m === "to") {
      if (!target.startsWith("ch:")) { say("Said to: click a person"); return; }
      edit(s => set(s, [...at, "to"], target.slice(3)));
    } else if (m === "move") {
      if (!target.startsWith("mark:")) { say("Move to: click a mark's pin"); return; }
      if (!w) { say("Who moves? The selected step has no speaker: set its who first"); return; }
      edit(s => {
        const prev = get(s, [...at, "move"]);
        const list = (prev ? [prev].flat() : []) as { who: string; to: string }[];
        const next = [...list.filter(x => x.who !== w), { who: w, to: target.slice(5) }];
        return set(s, [...at, "move"], next.length === 1 ? next[0] : next);
      });
    }
    say(`${m} → ${target}`);
  };

  // actors and props: what a tap on the stage hits
  useEffect(() => p.preview.ix.on("inspect", e => {
    if (latest.current.mode === "off") return;
    if (e.kind === "piece") { say("That is part of the set: pick a person, a prop or a mark"); return; }
    apply(e.kind === "actor" ? `ch:${e.id}` : `obj:${e.of ?? e.id}`);
  }), [p.preview]);

  // the marks' pins, placed every frame
  useEffect(() => {
    const st = p.preview.stage, el = layer.current;
    if (!el || !pins) { if (el) el.replaceChildren(); return; }
    const draw = () => {
      const marks = st.place?.marks ?? {};
      const ids = Object.keys(marks);
      while (el.children.length > ids.length) el.lastChild!.remove();
      ids.forEach((id, i) => {
        const m = marks[id] as { x: number; y?: number; z: number };
        const q = st.project([m.x, m.y ?? 0, m.z]);
        let pin = el.children[i] as HTMLSpanElement | undefined;
        if (!pin) { pin = document.createElement("span"); el.append(pin); }
        pin.textContent = id;
        pin.title = `mark:${id}`;
        pin.onclick = (ev) => { ev.stopPropagation(); apply(`mark:${id}`); };
        pin.style.display = q ? "" : "none";
        if (q) { pin.style.left = `${q[0]}px`; pin.style.top = `${q[1]}px`; }
      });
    };
    draw();
    return st.onFrame(draw);
  }, [p.preview, pins, p.story]);

  useEffect(() => {
    if (!p.host) return;
    const div = document.createElement("div");
    div.className = "pins";
    p.host.append(div);
    layer.current = div;
    return () => { div.remove(); layer.current = null; };
  }, [p.host]);

  const cam = sp ? get(p.story, [...sp, "cam"]) as string | undefined : undefined;
  return html`<div class="panel" style="margin-top:8px">
    <div class="row">
      <b>On the stage</b>
      <label class="row"><input type="checkbox" style="width:auto" checked=${pins} onChange=${(e: Event) => setPins((e.target as HTMLInputElement).checked)} /> show the marks</label>
      <span class="grow"></span>
      <label class="row">a click sets
        <select value=${mode} style="width:auto" onChange=${(e: Event) => { const m = (e.target as HTMLSelectElement).value as Mode; setMode(m); if (m === "move") setPins(true); }}>
          <option value="off">nothing</option><option value="at">what the step looks or points at</option><option value="to">whom it is said to</option><option value="move">the mark its speaker moves to</option>
        </select></label>
    </div>
    ${sp && html`<div class="row" style="margin-top:6px"><span class="note">Shot:</span>
      ${CAM_KINDS.map(c => html`<button class=${`small${cam === c ? " primary" : ""}`} onClick=${() => p.edit(s => set(s, [...sp, "cam"], cam === c ? undefined : c))}>${c}</button>`)}</div>`}
    ${mode !== "off" && !sp && html`<p class="note">Select a line, a beat, an option or a reply in the steps, then click on the stage.</p>`}
  </div>`;
}
