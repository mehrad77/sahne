// #/kit/people?tab=studio: the avatar builder's live preview on its own (`Stage.studio`, DESIGN.md §10).
// A phone-sized and a desktop-sized stage show one actor alone, with the controls the builder has: swap
// the look live, a height slider, every mood, every gesture that needs no prop or partner, the turn,
// the framing of each stage and the backdrop (sky, a wall, or none: a transparent canvas). The looks are
// the cast roster ($SAHNE_CONTENT/characters/, each avatar and each outfit, `look=<id>` or
// `look=<id>.<outfit>`), the extras (kind extra, in the same folder), and any story character the roster lacks. The stress runs are in
// #/systems/perf. Look, mood, backdrop and framings are in the URL.

import { applyLook, type AvatarDoc, type Backdrop, type Framing, type Stage } from "sahne";
import { textOf, type CharacterDoc } from "sahne-story";
import { $, bar, button, choice, css, slider } from "../../shell/dom.ts";
import type { Ctx } from "../../shell/ctx.ts";

const FRAMINGS = ["full", "bust", "head"] as const satisfies readonly Framing[];
const BACKDROPS = ["sky", "wall", "none"] as const satisfies readonly Backdrop[];
/** The looks are the authors' (hex colours and cast parts allowed). */
const OWN = { trusted: true };

export async function studio(host: HTMLElement, ctx: Ctx) {
  css("people-studio", `
.std-stages { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin: 8px 0; }
.std-stages figure { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; max-width: 100%; }
.std-stages figcaption { color: var(--mute); font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.std-stages figcaption .bar { margin: 0; }
.std-host { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); touch-action: manipulation; user-select: none; max-width: 100%; }
.std-host.phone { width: 330px; height: 520px; }
.std-host.wide { width: 600px; height: 380px; }
@media (max-width: 640px) { .std-host.wide { height: 300px; } }
/* the page behind a transparent stage: stripes and a gradient, so a dark or light fringe on the paper's edge would show */
.std-host.alpha { background: repeating-linear-gradient(45deg, #7C5CBF 0 14px, #F2B705 14px 28px); }
.std-host.alpha.wide { background: linear-gradient(90deg, #E8F1FF, #FFE8F0); }
.std-stats { color: var(--mute); font: 12px ui-monospace, monospace; margin-top: 10px; white-space: pre-wrap; }
.std-log { font: 12px ui-monospace, monospace; margin-top: 6px; white-space: pre-wrap; }
`);
  const kit = ctx.kit, q = ctx.route.query;
  const [cast, extras, drafts] = await Promise.all([ctx.data("cast").catch(() => []), ctx.data("extras").catch(() => []), ctx.data("drafts").catch(() => [])]);
  // the looks, by id: each roster avatar and its outfits (Kerim is a puppet, not a document), each extra, then draft characters the roster lacks
  const looks: { id: string; name: string; doc: AvatarDoc }[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string, doc: AvatarDoc) => { if (!seen.has(id)) { seen.add(id); looks.push({ id, name, doc }); } };
  const character = (id: string, c: CharacterDoc) => {
    if (!c.avatar) return;
    const name = textOf(c.name) || id;
    add(id, name, c.avatar);
    for (const [o, look] of Object.entries(c.outfits ?? {})) add(`${id}.${o}`, `${name} (${o})`, applyLook(c.avatar, look));
  };
  for (const c of cast) character(c.id, c);
  for (const x of extras) {
    if (x.avatar) character(`extra.${x.file}`, x as unknown as CharacterDoc); // outfits too, as the cast page links them
    else if ("v" in x && "body" in x) add(`extra.${x.file}`, x.file, x as unknown as AvatarDoc);
  }
  for (const d of drafts) for (const [id, c] of Object.entries(d.characters)) if (!seen.has(id)) character(id, c);
  if (!looks.length) { host.append($("p", "note", "No looks: the cast roster ($SAHNE_CONTENT/characters/) is empty or could not be read.")); return; }
  const lookIds = looks.map(l => l.id), lookNames = Object.fromEntries(looks.map(l => [l.id, l.name]));
  const moods = ["neutral", ...Object.keys(kit.face.emotions).filter(m => m !== "neutral")];
  const S = {
    look: lookIds.find(n => n === q.get("look")) ?? lookIds[0],
    mood: moods.find(m => m === q.get("mood")) ?? "neutral",
    bg: BACKDROPS.find(b => b === q.get("bg")) ?? "sky",
  };
  let doc = looks.find(l => l.id === S.look)!.doc;

  host.append($("p", "note", "One actor alone, as the builder's preview shows it: idle life (breathing, blinks, glances) runs while a stage is on screen. Both stages share every control; tap a stage to play the next gesture. \"none\" makes the canvas transparent: the stripes behind it should meet the paper's edge with no fringe. Motion and sound follow the top bar; the stress runs are in Systems → perf."));

  // ---- the two stages ----
  interface Slot { name: string; el: HTMLElement; stage: Stage; id: string; framing: Framing; loadMs: number }
  const slots: Slot[] = [];
  const stages = $("div", "std-stages"), log = $("div", "std-log"), stats = $("div", "std-stats");
  const say = (t: string) => { log.textContent = t; };
  const TAPS = Object.keys(kit.gestures).filter(n => !kit.gestures[n].needs?.length);
  let tapped = 0;

  function mount(name: string, label: string, framing: Framing) {
    const fig = $("figure"), el = $("div", `std-host ${name}`);
    const cap = $("figcaption");
    fig.append(el, cap);
    stages.append(fig);
    const t = performance.now();
    const stage = ctx.mount(el, { bubbles: false, alpha: true, onContext: lost => say(`${name}: the GPU ${lost ? "took the drawing context away (an app would show its SVG still now)" : "gave it back: the look comes back by itself"}`) });
    const slot: Slot = { name, el, stage, id: "me", framing, loadMs: 0 };
    cap.append($("span", "", label), choice("", FRAMINGS, framing, f => { slot.framing = f; stage.setFraming(f); ctx.setQuery({ [`${name}f`]: f === (name === "phone" ? "full" : "bust") ? null : f }); }));
    if (!stage.webgl) { el.textContent = "No WebGL2 here: the app shows an SVG still instead."; el.style.display = "grid"; el.style.placeItems = "center"; return slot; }
    slot.id = stage.studio(doc, { framing, backdrop: S.bg, label: "The character", ...OWN });
    slot.loadMs = Math.round((performance.now() - t) * 10) / 10;
    if (S.mood !== "neutral") stage.mood(slot.id, S.mood);
    el.addEventListener("pointerdown", () => { if (TAPS.length) stage.gesture(slot.id, TAPS[tapped++ % TAPS.length]); });
    slots.push(slot);
    return slot;
  }
  const each = (fn: (s: Slot) => void) => { for (const s of slots) if (s.stage.webgl) fn(s); };
  const paintBackdrop = () => { for (const s of stages.querySelectorAll(".std-host")) s.classList.toggle("alpha", S.bg === "none"); };
  host.append(stages);
  mount("phone", "phone 330 × 520", FRAMINGS.find(f => f === q.get("phonef")) ?? "full");
  mount("wide", "desktop 600 × 380", FRAMINGS.find(f => f === q.get("widef")) ?? "bust");
  paintBackdrop();

  // ---- the controls ----
  let heightRow: HTMLElement;
  const setHeight = (h: number) => { const input = heightRow.querySelector("input")!, out = heightRow.querySelector("output")!; input.value = String(h); out.textContent = h.toFixed(2); };
  const lookRow = choice("look", lookIds, S.look, n => {
    S.look = n; doc = looks.find(l => l.id === n)!.doc; setHeight(doc.body.height ?? 0.5);
    ctx.setQuery({ look: n === lookIds[0] ? null : n });
    each(s => s.stage.setAvatar(s.id, doc, OWN));
  }, lookNames);
  // a new look on every input event, which is what a dragged control asks of the stage
  heightRow = slider("height", 0, 1, 0.01, doc.body.height ?? 0.5, h => { doc = { ...doc, body: { ...doc.body, height: h } }; each(s => s.stage.setAvatar(s.id, doc, OWN)); }, v => v.toFixed(2));
  const moodRow = choice("mood", moods, S.mood, m => { S.mood = m; ctx.setQuery({ mood: m === "neutral" ? null : m }); each(s => s.stage.mood(s.id, m)); });
  // every gesture an actor alone can do: none that needs a prop or a partner; `count` shows three
  const gestures = Object.entries(kit.gestures).filter(([, d]) => !d.needs?.some(n => n !== "target"));
  const gestureRow = bar("gesture", ...gestures.map(([n, d]) => button(n === "count" ? "count 3" : n, () => each(s => s.stage.gesture(s.id, n, n === "count" ? { n: 3 } : {})), undefined,
    `${d.dur} ms, stroke at ${d.stroke} ms${d.needs?.includes("target") ? " · points ahead (it wants a target)" : ""}${d.loop ? " · loopable" : ""}${d.hands === 2 ? " · two hands" : ""}`)));
  host.append(
    lookRow, bar("", heightRow), moodRow, gestureRow,
    bar("turn", button("flip (back / front)", () => each(s => s.stage.flip(s.id)))),
    choice("backdrop", BACKDROPS, S.bg, b => { S.bg = b; ctx.setQuery({ bg: b === "sky" ? null : b }); each(s => s.stage.setBackdrop(b)); paintBackdrop(); }, { none: "none (transparent)" }),
    stats, log,
  );

  // ---- the readout ----
  const tick = setInterval(() => {
    stats.textContent = slots.filter(s => s.stage.webgl).map(s => {
      const t = s.stage.stats;
      return `${s.name}: first load ${s.loadMs} ms · look swap ${t.swapMs} ms · scene build ${t.atlasMs} ms · ${t.layers} layer(s) · ${(t.texKB / 1024).toFixed(1)} MB textures · frame ${t.frameMs} ms (pose ${t.poseMs} ms) · ${t.vertices} vertices`;
    }).join("\n");
  }, 500);
  ctx.cleanup(() => clearInterval(tick));
}
