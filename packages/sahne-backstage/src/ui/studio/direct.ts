// Directing on the stage: the selected block staged by clicking what is on stage. With *Direct* on, a click on a person
// opens a menu of gestures (each a picture of it), feelings (each a face), what they look at, where they walk, and "say it
// to them"; on a prop: point at it, hold it up, touch it, show it, hide it, give it; on a mark's pin: the speaker walks
// there. Dragging a person onto a mark's pin walks them there. What the speaker does goes on the block itself; what
// another person does goes on it as their reaction (`react`). The shot bar sets the block's camera (auto clears it). Every
// action is an edit of the script: its chips show it, undo takes it back.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { InspectEvent } from "sahne";
import { textOf, type StoryDoc } from "sahne-story";
import { get, set, type Path } from "../../model/path.ts";
import type { Preview } from "../../stage.ts";
import { say, world } from "../../store.ts";
import { kindOf } from "../../model/steps.ts";
import { Icon, Popover } from "../kit/index.ts";
import { Gallery } from "../kit/gallery.ts";
import { emotionItems, gestureItems } from "../galleries.ts";
import { useLangs } from "../lang.ts";
import { targetsAt } from "../staging.ts";

const SHOTS = ["wide", "two", "single", "close", "follow"] as const;

/** Where the selected block's staging lives: the step (a line, an option, a reply) or its `beat`. */
export function stagingPath(story: StoryDoc, path: Path | null): Path | null {
  if (!path) return null;
  const v = get(story, path);
  const k = path.at(-2) === "options" ? "option" : kindOf(v);
  if (k === "line" || k === "option") return path;
  if (k === "beat") return [...path, "beat"];
  return null;
}

type Menu = { x: number; y: number; target: string; kind: "actor" | "prop" };

export function Direct(p: { preview: Preview; story: StoryDoc; path: Path | null; host: HTMLElement | null; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void; cast: string[] }) {
  const w = world.value!, { main } = useLangs();
  const [on, setOn] = useState(false), [pins, setPins] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null), [tab, setTab] = useState<"gesture" | "feeling" | "look" | "walk">("gesture");
  const layer = useRef<HTMLDivElement | null>(null);
  const sp = stagingPath(p.story, p.path);
  const speaker = (() => { const v = sp ? get(p.story, sp) as { who?: string } | undefined : undefined; return v?.who ?? (p.path?.at(-2) === "options" ? w.series?.standin ?? "nima" : undefined); })();
  const name = (id: string) => textOf(w.characters[id]?.name, main) ?? id;
  const live = useRef({ on, sp, speaker });
  live.current = { on, sp, speaker };
  const drag = useRef<string | null>(null);

  /** Write staging for `who` on the selected block: on the block for its speaker, as a reaction for anyone else. */
  const stage = (who: string | null, fields: Record<string, unknown>, label: string) => {
    const at = live.current.sp;
    if (!at) { say("Select a line, an action, an option or a reply first"); return; }
    if (!who || who === live.current.speaker) p.edit(s => Object.entries(fields).reduce((x, [k, v]) => set(x, [...at, k], v), s), `direct.${label}`);
    else p.edit(s => set(s, [...at, "react", who], { ...((get(s, [...at, "react", who]) as object) ?? {}), ...fields }), `direct.${label}`);
    setMenu(null);
  };
  /** Someone walks to a mark on the selected block. */
  const walk = (who: string, mark: string) => {
    const at = live.current.sp;
    if (!at) { say("Select a line, an action, an option or a reply first"); return; }
    p.edit(s => {
      const prev = get(s, [...at, "move"]);
      const list = (prev ? [prev].flat() : []) as { who: string; to: string }[];
      const next = [...list.filter(x => x.who !== who), { who, to: mark }];
      return set(s, [...at, "move"], next.length === 1 ? next[0] : next);
    }, "direct.walk");
    setMenu(null);
  };

  // a click on the stage: a person or a prop opens its menu
  useEffect(() => p.preview.ix.on("inspect", (e: InspectEvent) => {
    if (!live.current.on) return;
    if (e.kind === "piece") { say("That is part of the set: click a person, a prop or a mark"); return; }
    const r = p.host?.getBoundingClientRect();
    const x = (r?.left ?? 0) + ((e as { x?: number }).x ?? 0), y = (r?.top ?? 0) + ((e as { y?: number }).y ?? 0);
    setTab("gesture");
    setMenu({ x, y, target: e.kind === "actor" ? `ch:${e.id}` : `obj:${e.of ?? e.id}`, kind: e.kind === "actor" ? "actor" : "prop" });
  }), [p.preview]);

  // a person dragged onto a mark's pin walks there
  useEffect(() => {
    const host = p.host, ix = p.preview.ix;
    if (!host) return;
    const down = (e: PointerEvent) => {
      if (!live.current.on) return;
      const r = host.getBoundingClientRect(), hit = ix.hitAt(e.clientX - r.left, e.clientY - r.top);
      drag.current = hit?.target.startsWith("ch:") ? hit.target.slice(3).split(".")[0] : null;
      if (drag.current) setPins(true);
    };
    const up = (e: PointerEvent) => {
      const who = drag.current;
      drag.current = null;
      const pin = (e.target as HTMLElement)?.closest?.(".pins span") as HTMLElement | null ?? document.elementsFromPoint(e.clientX, e.clientY).find(el => el.matches(".pins span")) as HTMLElement | undefined;
      if (who && pin?.dataset.mark) { walk(who, pin.dataset.mark); say(`${name(who)} walks to ${pin.dataset.mark}`); }
    };
    host.addEventListener("pointerdown", down, true);
    addEventListener("pointerup", up, true);
    return () => { host.removeEventListener("pointerdown", down, true); removeEventListener("pointerup", up, true); };
  }, [p.host, p.preview]);

  // the marks' pins, placed every frame through the stage's camera
  useEffect(() => {
    const st = p.preview.stage, el = layer.current;
    if (!el || !(pins || on)) { if (el) el.replaceChildren(); return; }
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
        pin.dataset.mark = id;
        pin.title = live.current.speaker ? `${name(live.current.speaker)} walks here` : `mark ${id}`;
        pin.onclick = ev => { ev.stopPropagation(); if (live.current.speaker) walk(live.current.speaker, id); };
        pin.style.display = q ? "" : "none";
        if (q) { pin.style.left = `${q[0]}px`; pin.style.top = `${q[1]}px`; }
      });
    };
    draw();
    return st.onFrame(draw);
  }, [p.preview, pins, on, p.story]);

  useEffect(() => {
    if (!p.host) return;
    const div = document.createElement("div");
    div.className = "pins";
    p.host.append(div);
    layer.current = div;
    return () => { div.remove(); layer.current = null; };
  }, [p.host]);

  useEffect(() => { p.host?.classList.toggle("directing", on); }, [on, p.host]);

  const cam = sp ? get(p.story, [...sp, "cam"]) as string | undefined : undefined;
  const who = menu?.kind === "actor" ? menu.target.slice(3).split(".")[0] : null;
  const prop = menu?.kind === "prop" ? menu.target : null;
  const { marks, targets } = targetsAt(p.story, Number(p.path?.[1] ?? 0), p.cast);
  return html`<div class="direct-bar">
    <button class=${on ? "primary" : ""} aria-pressed=${on} onClick=${() => setOn(!on)} title="Click people and props on the stage to stage the selected block"><${Icon} name="hand" size=${16} /> Direct</button>
    <button class="small" aria-pressed=${pins} onClick=${() => setPins(!pins)}>Marks</button>
    <span class="grow"></span>
    ${sp ? html`<span class="note">Shot</span><div class="segmented small" role="group" aria-label="Shot">
      <button aria-pressed=${!cam} onClick=${() => p.edit(s => set(s, [...sp, "cam"], undefined))} title="The director's choice">auto</button>
      ${SHOTS.map(c => html`<button aria-pressed=${cam === c} onClick=${() => p.edit(s => set(s, [...sp, "cam"], c))}>${c}</button>`)}</div>`
    : html`<span class="note">Select a line or an action to stage it</span>`}
    ${on && !sp && html`<p class="note" style="width:100%">Select a block of the script, then click people and props on the stage.</p>`}
    ${menu && html`<${Popover} x=${menu.x} y=${menu.y} onClose=${() => setMenu(null)} label="Direct">
      <div class="direct-menu">
        ${who ? html`<b>${name(who)}${who === speaker ? " (says the line)" : " (reacts)"}</b>
          <div class="tabs" role="tablist">${(["gesture", "feeling", "look", "walk"] as const).map(t => html`<button role="tab" aria-selected=${tab === t} onClick=${() => setTab(t)}>${t === "gesture" ? "Gesture" : t === "feeling" ? "Feeling" : t === "look" ? "Look at" : "Walk to"}</button>`)}</div>
          ${tab === "gesture" && html`<${Gallery} items=${gestureItems()} onPick=${(g: string) => stage(who, { do: g }, "do")} label="Gestures" size="s" searchable=${true} />`}
          ${tab === "feeling" && html`<${Gallery} items=${emotionItems()} onPick=${(e: string) => stage(who, { emo: e }, "emo")} label="Feelings" size="s" />`}
          ${tab === "look" && html`<div class="menu">${targets.filter(t => t !== `ch:${who}`).map(t => html`<button onClick=${() => stage(who, { at: t }, "at")}>${t.startsWith("ch:") ? name(t.slice(3)) : t.replace(/^(obj|mark):/, "").replace(/_/g, " ")}</button>`)}</div>`}
          ${tab === "walk" && html`<div class="menu">${marks.map(m => html`<button onClick=${() => walk(who, m)}>${m}</button>`)}</div>`}
          ${who !== speaker && speaker && html`<button class="small" onClick=${() => stage(null, { to: who }, "to")}>${name(speaker)} says it to ${name(who)}</button>`}`
        : prop && html`<b>${prop.slice(4).replace(/_/g, " ")}</b><div class="menu">
          <button onClick=${() => stage(null, { do: "point", at: prop }, "point")}>${speaker ? name(speaker) : "The speaker"} points at it</button>
          <button onClick=${() => stage(null, { do: "hold_up", at: prop }, "hold")}>holds it up</button>
          <button onClick=${() => stage(null, { do: "touch", at: prop }, "touch")}>touches it</button>
          <button onClick=${() => stage(null, { obj: [...((sp ? get(p.story, [...sp, "obj"]) : []) as unknown[] ?? []), { id: prop.slice(4), op: "show" }] }, "show")}>shows it (it appears)</button>
          <button onClick=${() => stage(null, { obj: [...((sp ? get(p.story, [...sp, "obj"]) : []) as unknown[] ?? []), { id: prop.slice(4), op: "hide" }] }, "hide")}>hides it</button>
          ${speaker && html`<button onClick=${() => { const to = sp ? get(p.story, [...sp, "to"]) as string | undefined : undefined; if (!to) { say("Whom to? Say the line to someone first"); return; } stage(null, { do: "give", at: prop, obj: [{ id: prop.slice(4), op: "give", to }] }, "give"); }}>gives it to whom it is said to</button>`}
        </div>`}
      </div></${Popover}>`}
  </div>`;
}
